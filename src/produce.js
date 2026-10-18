import {
  CHAPTER_CONTINUE_MAX_TOKENS,
  CHAPTER_CONTINUE_TAIL_CHARS,
  CHAPTER_MEMORY_MAX_TOKENS,
  CHAPTER_MEMORY_TAIL_CHARS,
  CHAPTER_PRODUCE_MAX_ATTEMPTS,
  CHAPTER_TIGHTEN_MAX_TOKENS,
  CHAPTER_UNROUND_ENABLED,
  CHAPTER_WRITE_MAX_TOKENS,
} from "./config.js";
import { chat, chatJson } from "./llm.js";
import {
  editorSystemFor,
  lightEditorSystemFor,
  chapterPrompt,
  continueChapterPrompt,
  memoryPrompt,
  tightenChapterPrompt,
} from "./prompts.js";
import {
  chapterAbsPath,
  findNextChapter,
  flattenChapters,
  saveMemory,
  saveMeta,
  saveOutline,
  writeText,
} from "./store.js";
import { clipTail, countChars } from "./text.js";
import { looksManufactured, rollChapterQuota } from "./words.js";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientProduceError(error) {
  const message = `${error?.message || error} ${error?.cause || ""}`;
  return /timeout|timed out|terminated|ECONNRESET|fetch failed|socket|aborted|und_err|429|502|503|504|524|empty|空内容|rate limit|overloaded|network|proxy|connect/i.test(
    message,
  );
}

async function withRetries(task, { onProgress, label = "请求", maxAttempts = CHAPTER_PRODUCE_MAX_ATTEMPTS } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (!isTransientProduceError(error) || attempt === maxAttempts) {
        throw error;
      }
      const wait = Math.min(90_000, 2500 * 2 ** (attempt - 1));
      onProgress?.(
        `${label}中断：${String(error.message || error).slice(0, 100)}；${Math.round(wait / 1000)} 秒后自动重试（${attempt}/${maxAttempts}）…`,
      );
      await sleep(wait);
    }
  }
  throw lastError;
}

function nextChapterOutlines(outline, current) {
  const all = flattenChapters(outline);
  const idx = all.findIndex(({ chapter }) => chapter.id === current.id);
  return all.slice(idx + 1, idx + 3).map((item) => item.chapter);
}

function ensureTitle(text, chapter) {
  const trimmed = String(text || "").trim();
  if (/^#\s/.test(trimmed)) return trimmed;
  return `# 第${chapter.globalIndex}章 ${chapter.title}\n\n${trimmed}`;
}

function langOf(bible) {
  return bible?.language || "zh";
}

async function writeOnce({ bible, volume, chapter, nextChapters, memory, previousEnding, onProgress }) {
  return chat({
    kind: "chapter",
    maxCompletionTokens: CHAPTER_WRITE_MAX_TOKENS,
    onProgress,
    messages: [
      { role: "system", content: editorSystemFor(langOf(bible)) },
      {
        role: "user",
        content: chapterPrompt({
          bible,
          volume,
          chapter,
          nextChapters,
          memory,
          previousEnding,
        }),
      },
    ],
  });
}

function chapterQuota(chapter) {
  if (!chapter.quota?.target) {
    chapter.quota = rollChapterQuota();
  }
  return chapter.quota;
}

async function expandIfShort(draft, chapter, bible) {
  const quota = chapterQuota(chapter);
  let text = draft;
  for (let i = 0; i < 2; i += 1) {
    const chars = countChars(text);
    if (chars >= quota.min) return text;
    const tail = clipTail(text, CHAPTER_CONTINUE_TAIL_CHARS);
    const extra = await chat({
      kind: "chapter",
      maxCompletionTokens: CHAPTER_CONTINUE_MAX_TOKENS,
      messages: [
        { role: "system", content: lightEditorSystemFor(langOf(bible)) },
        {
          role: "user",
          content: `以下是本章目前正文的章末片段（前文已写好，勿重复、勿改写已发生事实）：\n\n${tail}`,
        },
        {
          role: "user",
          content: continueChapterPrompt({
            chapter,
            currentChars: chars,
            targetMin: quota.min,
            targetMax: quota.max,
          }),
        },
      ],
    });
    text = `${text.trim()}\n\n${extra.trim()}`;
  }
  return text;
}

async function tightenIfLong(draft, chapter, bible) {
  const quota = chapterQuota(chapter);
  const chars = countChars(draft);
  if (chars <= quota.softMax) return draft;
  const tightened = await chat({
    kind: "chapter",
    maxCompletionTokens: CHAPTER_TIGHTEN_MAX_TOKENS,
    messages: [
      { role: "system", content: lightEditorSystemFor(langOf(bible)) },
      {
        role: "user",
        content: `${tightenChapterPrompt({
          chapter,
          currentChars: chars,
          targetMax: quota.max,
        })}\n\n原文：\n${draft}`,
      },
    ],
  });
  return tightened;
}

async function unroundIfNeeded(draft, chapter, bible) {
  if (!CHAPTER_UNROUND_ENABLED) return draft;
  const quota = chapterQuota(chapter);
  const chars = countChars(draft);
  if (!looksManufactured(chars) || chars >= quota.max - 80) return draft;
  const tail = clipTail(draft, CHAPTER_CONTINUE_TAIL_CHARS);
  const extra = await chat({
    kind: "chapter",
    maxCompletionTokens: 2_000,
    messages: [
      { role: "system", content: lightEditorSystemFor(langOf(bible)) },
      { role: "user", content: `以下是本章章末片段：\n\n${tail}` },
      {
        role: "user",
        content: `当前约 ${chars} 字，这个数字太整齐。请再补一小段自然余韵或动作收束，大约 ${70 + (chars % 97)} 字，不要重复，不要报字数。只输出续写。`,
      },
    ],
  });
  return `${draft.trim()}\n\n${extra.trim()}`;
}

async function refreshMemory({ bible, volume, chapter, chapterText, memory }) {
  try {
    const next = await chatJson({
      kind: "chapter",
      maxCompletionTokens: CHAPTER_MEMORY_MAX_TOKENS,
      messages: [
        { role: "system", content: lightEditorSystemFor(langOf(bible)) },
        {
          role: "user",
          content: memoryPrompt({
            bible,
            volume,
            chapter,
            chapterText,
            prevMemory: memory,
            tailChars: CHAPTER_MEMORY_TAIL_CHARS,
          }),
        },
      ],
    });
    return {
      ...memory,
      ...next,
      lastChapterEnding: next.lastChapterEnding || clipTail(chapterText.replace(/^#.+\n/, ""), 400),
    };
  } catch {
    return {
      ...memory,
      lastChapterEnding: clipTail(chapterText.replace(/^#.+\n/, ""), 400),
      recentEvents: [...(memory.recentEvents || []), `第${chapter.globalIndex}章《${chapter.title}》已完成`].slice(-6),
    };
  }
}

export async function produceChapters({
  slug,
  meta,
  outline,
  memory,
  limit = Infinity,
  onProgress = () => {},
}) {
  if (meta.status === "done") {
    onProgress("全书已经按大纲生产完毕。");
    return { meta, memory, produced: 0 };
  }
  if (meta.status !== "approved" && meta.status !== "producing" && meta.status !== "paused") {
    throw new Error(`当前状态为「${meta.status}」，只有审核通过后才能开始按章生产。`);
  }

  outline.language = outline.language || meta.language || "zh";
  outline.locale = outline.locale || meta.locale;

  meta.status = "producing";
  meta.writtenChapters = meta.writtenChapters || [];
  await saveMeta(meta);

  let produced = 0;
  let currentMemory = memory;

  while (produced < limit) {
    const next = findNextChapter(outline, meta);
    if (!next) {
      meta.status = "done";
      await saveMeta(meta);
      onProgress("全书章节已按大纲生产完毕。");
      break;
    }

    const { volume, chapter } = next;
    const quota = chapterQuota(chapter);
    await saveOutline(slug, outline);
    onProgress(
      `正在写 第${chapter.globalIndex}章《${chapter.title}》（第${volume.index}卷《${volume.title}》，篇幅约 ${quota.target} 字）…`,
    );

    const text = await withRetries(
      async () => {
        let draft = await writeOnce({
          bible: outline,
          volume,
          chapter,
          nextChapters: nextChapterOutlines(outline, chapter),
          memory: currentMemory,
          previousEnding: currentMemory.lastChapterEnding,
          onProgress,
        });
        draft = ensureTitle(draft, chapter);
        draft = await expandIfShort(draft, chapter, outline);
        draft = ensureTitle(draft, chapter);
        draft = await tightenIfLong(draft, chapter, outline);
        draft = ensureTitle(draft, chapter);
        draft = await unroundIfNeeded(draft, chapter, outline);
        draft = ensureTitle(draft, chapter);
        return draft;
      },
      {
        onProgress,
        label: `第${chapter.globalIndex}章《${chapter.title}》`,
        maxAttempts: CHAPTER_PRODUCE_MAX_ATTEMPTS,
      },
    );

    const chars = countChars(text);
    const file = chapterAbsPath(slug, volume, chapter);
    await writeText(file, text);

    meta.writtenChapters.push(chapter.id);
    meta.writtenChars = (meta.writtenChars || 0) + chars;
    meta.lastChapterId = chapter.id;
    meta.lastChapterFile = file;
    await saveMeta(meta);

    currentMemory = await refreshMemory({
      bible: outline,
      volume,
      chapter,
      chapterText: text,
      memory: currentMemory,
    });
    await saveMemory(slug, currentMemory);

    produced += 1;
    onProgress(
      `已完成 第${chapter.globalIndex}章《${chapter.title}》 ${chars} 字 → ${file}`,
    );
  }

  if (meta.status === "producing" && findNextChapter(outline, meta)) {
    meta.status = "paused";
    await saveMeta(meta);
  }

  return { meta, memory: currentMemory, produced };
}

export { isTransientProduceError, sleep as produceSleep };
