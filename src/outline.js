import path from "node:path";
import { chatJson } from "./llm.js";
import { generateScriptForNovel } from "./script.js";
import {
  editorSystemFor,
  biblePrompt,
  renderBibleMarkdown,
  renderCatalogMarkdown,
  renderVolumeMarkdown,
  titleFromOutlinePrompt,
  volumeChaptersPrompt,
} from "./prompts.js";
import { getLocale } from "./locales.js";
import {
  outlineDir,
  renameNovelToTitle,
  saveMeta,
  saveOutline,
  volumeOutlinePath,
  writeText,
} from "./store.js";
import { planVolumeChapterCounts, resolveNovelBudget, rollVolumeChapterCount, stampChapterQuotas, MAX_CHAPTERS_PER_VOLUME, MIN_CHAPTERS_PER_VOLUME } from "./words.js";

const CHAPTER_BATCH_SIZE = 6;

function isLockedTitle(value) {
  const title = String(value || "").trim();
  if (!title) return false;
  const placeholders = new Set(["未命名", "未定稿", "Untitled", "제목 미정", "Без названия", "untitled"]);
  return !placeholders.has(title);
}

function normalizeBible(bible, targetChars) {
  const volumes = (bible.volumes || []).map((volume, i) => ({
    ...volume,
    index: Number(volume.index) || i + 1,
    chapters: [],
  }));

  if (!volumes.length) {
    throw new Error("总纲未返回分卷，无法继续。");
  }

  return {
    ...bible,
    targetWordCount: targetChars,
    volumes: planVolumeChapterCounts(volumes),
  };
}

function normalizeChapter(volume, chapter, fallbackIndex, fallbackGlobal, language = "zh") {
  const index = Number(chapter.index) || fallbackIndex;
  const globalIndex = Number(chapter.globalIndex) || fallbackGlobal;
  const titleMax = language === "zh" || language === "ja" || language === "ko" ? 24 : 72;
  const summaryMax = language === "zh" || language === "ja" || language === "ko" ? 80 : 200;
  const povMax = language === "zh" || language === "ja" || language === "ko" ? 12 : 40;
  const hookMax = language === "zh" || language === "ja" || language === "ko" ? 48 : 120;
  return {
    index,
    globalIndex,
    id: `v${volume.index}-c${index}`,
    title: String(chapter.title || `第${index}章`).slice(0, titleMax),
    summary: String(chapter.summary || "").slice(0, summaryMax),
    pov: String(chapter.pov || "").slice(0, povMax),
    endingHook: String(chapter.endingHook || "").slice(0, hookMax),
  };
}

function attachBatch(volume, payload, startIndex, startGlobalIndex, language = "zh") {
  const raw = payload.chapters || [];
  if (!raw.length) {
    throw new Error(`第${volume.index}卷未返回章节细纲。`);
  }
  return raw.map((chapter, i) =>
    normalizeChapter(volume, chapter, startIndex + i, startGlobalIndex + i, language),
  );
}

function nextGlobalIndex(volumes) {
  let next = 1;
  for (const volume of volumes || []) {
    for (const chapter of volume.chapters || []) {
      next = Math.max(next, Number(chapter.globalIndex || chapter.index || 0) + 1);
    }
  }
  return next;
}

function targetChapterCount(volume) {
  const estimated = Number(volume.estimatedChapters);
  if (Number.isFinite(estimated) && estimated >= MIN_CHAPTERS_PER_VOLUME && estimated <= MAX_CHAPTERS_PER_VOLUME) {
    return estimated;
  }
  return rollVolumeChapterCount();
}

async function generateVolumeChapters({
  bible,
  volume,
  startGlobalIndex,
  onProgress,
}) {
  const target = targetChapterCount(volume);
  volume.chapters = Array.isArray(volume.chapters) ? volume.chapters : [];
  volume.estimatedChapters = target;

  while (volume.chapters.length < target) {
    const batchStartIndex = volume.chapters.length + 1;
    const remaining = target - volume.chapters.length;
    const batchCount = Math.min(CHAPTER_BATCH_SIZE, remaining);
    const batchGlobal = volume.chapters.length
      ? Math.max(...volume.chapters.map((c) => Number(c.globalIndex) || 0)) + 1
      : startGlobalIndex;

    onProgress(
      `第${volume.index}卷《${volume.title}》细纲 ${volume.chapters.length}/${target}，生成本批 ${batchCount} 章…`,
    );

    const payload = await chatJson({
      kind: "outline",
      maxCompletionTokens: 5_000,
      onProgress,
      messages: [
        { role: "system", content: editorSystemFor(bible.language || "zh") },
        {
          role: "user",
          content: volumeChaptersPrompt({
            bible,
            volume,
            startGlobalIndex: batchGlobal,
            batchStartIndex,
            batchCount,
            previousChapters: volume.chapters,
          }),
        },
      ],
    });

    const batch = attachBatch(
      volume,
      payload,
      batchStartIndex,
      batchGlobal,
      bible.language || "zh",
    );
    // 模型偶发多吐几章时截断到本批上限
    volume.chapters.push(...batch.slice(0, batchCount));
  }

  volume.estimatedChapters = volume.chapters.length;
  return volume;
}

async function writeOutlineArtifacts(currentSlug, bible) {
  const full = renderBibleMarkdown(bible);
  const worldPart = (full.split("## 世界观")[1] || "").split("## 人物")[0];
  const peoplePart = (full.split("## 人物")[1] || "").split("## 分卷")[0];
  await writeText(path.join(outlineDir(currentSlug), "00-总纲.md"), full);
  await writeText(path.join(outlineDir(currentSlug), "03-卷章目录.md"), renderCatalogMarkdown(bible));
  await writeText(
    path.join(outlineDir(currentSlug), "01-世界观与设定.md"),
    `# 《${bible.title}》· 世界观与设定\n\n${worldPart.trim()}\n`,
  );
  await writeText(
    path.join(outlineDir(currentSlug), "02-人物小传.md"),
    `# 《${bible.title}》· 人物小传\n\n${peoplePart.trim()}\n`,
  );
  for (const volume of bible.volumes || []) {
    await writeText(volumeOutlinePath(currentSlug, volume), renderVolumeMarkdown(volume));
  }
}

async function decideTitleFromOutline(bible, onProgress) {
  onProgress("大纲已齐，正在根据大纲理性拟定正式书名…");
  const payload = await chatJson({
    kind: "outline",
    maxCompletionTokens: 800,
    onProgress,
    messages: [
      { role: "system", content: editorSystemFor(bible.language || "zh") },
      { role: "user", content: titleFromOutlinePrompt(bible) },
    ],
  });
  const finalTitle = String(payload.title || "").trim();
  if (!isLockedTitle(finalTitle)) {
    throw new Error("模型未返回可用书名，请重试大纲收尾命名。");
  }
  if (payload.reason) {
    onProgress(`命名理由：${String(payload.reason).trim()}`);
  }
  return finalTitle;
}

export async function generateOutline({
  slug,
  meta,
  genre,
  title,
  extra,
  autoPick,
  targetChars,
  existing = null,
  genreBrief = "",
  volumeDetailLimit = null,
  onProgress = () => {},
}) {
  const language = meta.language || existing?.language || "zh";
  const cultureBrief = meta.cultureBrief || "";
  const system = editorSystemFor(language);
  const L = getLocale(language);
  const words = existing?.volumes?.length
    ? resolveNovelBudget(targetChars || existing.targetWordCount || meta.targetWordCount, { soft: true })
    : resolveNovelBudget(targetChars);
  let bible = existing?.volumes?.length ? existing : null;
  let currentSlug = slug;
  const lockedTitle = isLockedTitle(title)
    ? String(title).trim()
    : isLockedTitle(meta.lockedTitle)
      ? String(meta.lockedTitle).trim()
      : "";
  const deferTitle = !lockedTitle;

  const detailLimitRaw =
    volumeDetailLimit ??
    meta.outlineVolumeLimit ??
    process.env.OUTLINE_VOLUME_LIMIT ??
    "";
  const detailLimit = Number(detailLimitRaw);
  const volumeDetailCap =
    Number.isFinite(detailLimit) && detailLimit > 0 ? Math.floor(detailLimit) : Infinity;
  if (Number.isFinite(volumeDetailCap)) {
    meta.outlineVolumeLimit = volumeDetailCap;
    onProgress(`分卷细纲范围：仅第 1–${volumeDetailCap} 卷（其余卷保留总纲摘要，稍后可续补）`);
  }

  async function syncTitle(titleValue) {
    if (!titleValue) return;
    const renamed = await renameNovelToTitle(meta, titleValue);
    Object.assign(meta, renamed);
    currentSlug = meta.slug;
    bible.title = meta.title;
    onProgress(`书名定为《${meta.title}》，目录：content/${meta.slug}`);
  }

  if (!bible) {
    onProgress(
      deferTitle
        ? `正在生成总纲（语言=${L.languageName}；世界观、人物、分卷；正式书名待大纲完成后再定）…`
        : `正在生成总纲（语言=${L.languageName}；书名、世界观、人物、分卷）…`,
    );
    const rawBible = await chatJson({
      kind: "outline",
      maxCompletionTokens: 12_000,
      onProgress,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: biblePrompt({
            genre,
            title: lockedTitle || "",
            targetChars: words,
            extra,
            autoPick,
            deferTitle,
            genreBrief: genreBrief || meta.genreBrief || "",
            language,
            cultureBrief,
          }),
        },
      ],
    });

    bible = normalizeBible(rawBible, words);
    bible.language = language;
    bible.locale = meta.locale || L.locale;
    meta.language = language;
    meta.locale = meta.locale || L.locale;
    meta.market = meta.market || L.market;
    meta.genre = bible.genre || genre || meta.genre;
    meta.targetWordCount = bible.targetWordCount;
    meta.status = "outlining";
    if (cultureBrief) meta.cultureBrief = cultureBrief;
    if (lockedTitle) {
      meta.lockedTitle = lockedTitle;
      await syncTitle(lockedTitle);
    } else {
      bible.title = L.untitled;
      meta.title = L.untitled;
      onProgress("总纲已出，暂用草稿目录，待细纲完成后再定书名。");
    }
    await saveMeta(meta);
    await saveOutline(currentSlug, bible);
    await writeText(path.join(outlineDir(currentSlug), "00-总纲.md"), renderBibleMarkdown(bible));
  } else {
    onProgress("发现未完成的大纲，从断点继续…");
    bible.language = bible.language || language;
    if (lockedTitle) {
      meta.lockedTitle = lockedTitle;
      await syncTitle(lockedTitle);
    } else if (!isLockedTitle(meta.title) && !isLockedTitle(bible.title)) {
      bible.title = L.untitled;
      meta.title = L.untitled;
    }
    if (bible.genre) meta.genre = bible.genre;
    meta.status = "outlining";
    meta.language = language;
    await saveMeta(meta);
  }

  let globalIndex = nextGlobalIndex(bible.volumes);
  for (const volume of bible.volumes) {
    if (volume.index > volumeDetailCap) {
      onProgress(
        `第${volume.index}卷《${volume.title}》仅保留总纲摘要，跳过细纲（limit=${volumeDetailCap}）`,
      );
      continue;
    }

    const target = targetChapterCount(volume);
    const done = volume.chapters?.length || 0;

    if (done >= target) {
      onProgress(`第${volume.index}卷《${volume.title}》细纲已在（${done}章），跳过`);
      continue;
    }

    if (done > 0) {
      onProgress(`第${volume.index}卷《${volume.title}》已有 ${done} 章，继续补全到 ${target} 章…`);
    }

    await generateVolumeChapters({
      bible,
      volume,
      startGlobalIndex: globalIndex,
      onProgress,
    });
    globalIndex = Math.max(...volume.chapters.map((c) => c.globalIndex)) + 1;
    await saveOutline(currentSlug, bible);
    await writeText(volumeOutlinePath(currentSlug, volume), renderVolumeMarkdown(volume));
  }

  stampChapterQuotas(bible);

  if (lockedTitle) {
    await syncTitle(lockedTitle);
  } else {
    const finalTitle = await decideTitleFromOutline(bible, onProgress);
    await syncTitle(finalTitle);
  }

  await writeOutlineArtifacts(currentSlug, bible);

  const detailedChapters = bible.volumes.reduce((sum, v) => sum + (v.chapters?.length || 0), 0);
  const plannedChapters = bible.volumes.reduce(
    (sum, v) => sum + (Number(v.estimatedChapters) || v.chapters?.length || 0),
    0,
  );
  meta.status = "review";
  meta.totalChapters = plannedChapters || detailedChapters;
  meta.detailedChapters = detailedChapters;
  meta.totalVolumes = bible.volumes.length;
  meta.outlineVolumeLimit = Number.isFinite(volumeDetailCap) ? volumeDetailCap : meta.outlineVolumeLimit;
  meta.targetWordCount = bible.targetWordCount;
  meta.title = bible.title || meta.title;
  meta.genre = bible.genre || meta.genre;
  meta.language = bible.language || language;
  meta.locale = bible.locale || meta.locale || L.locale;
  meta.market = meta.market || L.market;
  meta.writtenChapters = meta.writtenChapters || [];
  meta.writtenChars = meta.writtenChars || 0;
  await saveMeta(meta);
  await saveOutline(currentSlug, bible);
  onProgress(
    `大纲完成：《${meta.title}》共 ${bible.volumes.length} 卷规划 / 已细纲 ${detailedChapters} 章` +
      (Number.isFinite(volumeDetailCap) ? `（细纲至第${volumeDetailCap}卷）` : "") +
      "。",
  );

  const autoScript = !/^(0|false|no|off)$/i.test(String(process.env.AUTO_SCRIPT ?? "0").trim());
  if (autoScript) {
    try {
      onProgress("正在自动生成完整视频剧本（系列设定 + 全部分集分镜）…");
      await generateScriptForNovel(currentSlug, { onProgress });
    } catch (error) {
      onProgress(`剧本生成失败（可稍后 npm run script -- ${currentSlug}）：${error.message}`);
    }
  }

  // reload meta after script may have updated it
  return { meta, outline: bible };
}
