import path from "node:path";
import { chat, chatJson } from "./llm.js";
import { getLocale } from "./locales.js";
import {
  isAutoScriptEnabled,
  MIN_SHORT_CHARS,
  MAX_SHORT_CHARS,
  CHAPTER_PRODUCE_MAX_ATTEMPTS,
  SHORT_OUTLINE_MAX_TOKENS,
  SHORT_WRITE_MAX_TOKENS,
  SHORT_CONTINUE_MAX_TOKENS,
  SHORT_CONTINUE_TAIL_CHARS,
  SHORT_TIGHTEN_MAX_TOKENS,
  SHORT_TIGHTEN_KEEP_RATIO,
} from "./config.js";
import { generateScriptForNovel } from "./script.js";
import {
  outlineDir,
  bodyDir,
  renameNovelToTitle,
  saveMeta,
  saveOutline,
  writeText,
  pathExists,
  readJson,
  outlineJsonPath,
} from "./store.js";
import { countChars, clipTail } from "./text.js";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isTransient(error) {
  const message = `${error?.message || error}`;
  return /timeout|timed out|ECONNRESET|fetch failed|socket|429|502|503|504|empty|空内容|rate limit|network|proxy|connect/i.test(
    message,
  );
}

async function withRetries(task, { onProgress, label, maxAttempts = CHAPTER_PRODUCE_MAX_ATTEMPTS } = {}) {
  let last;
  for (let i = 1; i <= maxAttempts; i += 1) {
    try {
      return await task();
    } catch (error) {
      last = error;
      if (!isTransient(error) || i === maxAttempts) throw error;
      const wait = Math.min(60_000, 2000 * 2 ** (i - 1));
      onProgress?.(`${label}中断：${String(error.message || error).slice(0, 100)}；${Math.round(wait / 1000)}s 后重试（${i}/${maxAttempts}）…`);
      await sleep(wait);
    }
  }
  throw last;
}

/** 总纲：省 token，但不降艺术与逻辑标准 */
function shortOutlineSystem() {
  return `你是华语短篇小说大师（文学性+商业完成度并重）。全程简体中文。
硬性标准（不可降）：
- 一场核心冲突、一个主情绪、一个主反转；因果闭环；伏笔全部兑现；人物选择必有代价。
- 人物欲望/弱点具体，说话有辨识度；禁止降智反派、无故崩人设、说明书腔。
- 结构紧凑如短刀：钩子→加压→误导→引爆→余味；忌长篇分卷思维与注水。
- 艺术要求：场面可感、意象克制有效、节奏张弛、可有诙谐/黑色幽默但不冲淡主冲突；结尾忌说教。
篇幅：故事完整即可，自然约 ${MIN_SHORT_CHARS}–${MAX_SHORT_CHARS} 字；禁止凑字，也不必打满上限。`;
}

/** 正文：短 system，质量条款写满但不啰嗦 */
function shortBodySystem() {
  return `华语短篇大师。简体中文。
质量硬杠：开篇即入戏；对话与选择推戏；细节服务于人物与冲突；反转须情理之中；伏笔全回收；代价可见；语言有文学质感（克制、准确、有余味），禁止注水、作者旁白、空洞抒情与降智。写完整即停。`;
}

export function shortBiblePrompt({ genre, extra, genreBrief, language = "zh" }) {
  const L = getLocale(language);
  const brief = String(genreBrief || "")
    .replace(/文化逻辑：[\s\S]*$/m, "")
    .trim()
    .slice(0, 700);
  return `写短篇「创作圣经」JSON（大师级完成度）。

题材：${genre || "自选高完成度题材"}
${brief ? `brief：\n${brief}` : ""}
${extra ? `额外：${String(extra).slice(0, 450)}` : ""}

设计要求：
- title：可用书名（勿「未命名」）；logline 一句说清谁/欲望/阻碍/杠杆
- coreEmotion + coreTwist 必须锐利；foreshadows≥3 且都能在正文兑现
- beats 5–7：开端冲突→加压→误导/转折→高潮→收束；每拍写清目的与钩子
- 人物 3–5：欲望/弱点/弧光/说话方式具体；sellingPoints 3–5 可感知
- craftNotes：点明本文关键手法（如信息差、物件回收、先抑后扬等）一句即可
- synopsis 120–220字不剧透；ending 写清收束方向与余味，勿写成说明书

只返回 JSON：
{
  "kind": "short-story",
  "title": "",
  "language": "${L.id}",
  "genre": "",
  "subgenre": "",
  "logline": "",
  "synopsis": "",
  "sellingPoints": ["", ""],
  "themes": ["", ""],
  "tone": "",
  "audience": "",
  "coreEmotion": "",
  "coreTwist": "",
  "foreshadows": ["", "", ""],
  "world": { "era": "", "setting": "", "rules": ["", ""] },
  "characters": [{
    "name": "", "role": "", "age": "", "personality": "",
    "desire": "", "weakness": "", "arc": "", "speech": ""
  }],
  "beats": [{
    "index": 1,
    "title": "",
    "purpose": "钩子|加压|误导|反转|高潮|收束",
    "summary": "",
    "hook": ""
  }],
  "ending": "",
  "craftNotes": ""
}`;
}

export function shortBodyPrompt(bible) {
  const beats = (bible.beats || [])
    .map((b) => `${b.index}.[${b.purpose}]${b.title}:${b.summary}`)
    .join("\n");
  const chars = (bible.characters || [])
    .slice(0, 5)
    .map((c) => `- ${c.name}(${c.role})欲=${c.desire};弱=${c.weakness};说=${c.speech || ""}`)
    .join("\n");

  return `按圣经写出完整、可发表水准的短篇正文。

书名：${bible.title}
类型：${bible.genre}${bible.subgenre ? `/${bible.subgenre}` : ""}｜文风：${bible.tone || ""}
情绪：${bible.coreEmotion}｜反转：${bible.coreTwist}
伏笔（须兑现）：${(bible.foreshadows || []).join("；")}
舞台：${bible.world?.era || ""} ${bible.world?.setting || ""}
规则：${(bible.world?.rules || []).slice(0, 4).join("；")}
手法：${bible.craftNotes || ""}
收束方向：${bible.ending || ""}
人物：
${chars || "（见圣经）"}
节拍：
${beats}

铁律：
1. 第一行：# ${bible.title}
2. 逻辑严谨、人物自洽、冲突具体；文学质感与余味不能降；诙谐可用但不冲淡主线。
3. 写完整即停；自然约 ${MIN_SHORT_CHARS}–${MAX_SHORT_CHARS} 字；禁止注水，勿故意冲上限。
4. 只输出正文。`;
}

export function shortContinuePrompt({ title, currentChars, tail, bible }) {
  return `短篇未完（约 ${currentChars} 字）。从截断处续写到完整收束。
硬性：勿重复已写；勿注水；兑现反转「${bible?.coreTwist || ""}」与伏笔；人物代价落地；结尾有余味、忌说教。书名：${title}

章末上下文：
${tail}

只输出续写。`;
}

export function shortEndingRepairPrompt({ title, keepChars, maxChars, coreTwist, foreshadows, ending, tail }) {
  return `下文是短篇《${title}》已保留的前文之后「需要重写的末段上下文」。
前文约 ${keepChars} 字已固定，不可改写前文。请只输出「衔接自然的新结尾」，使全文字数合计不超过约 ${maxChars} 字。

必须：逻辑接上；兑现反转「${coreTwist || ""}」；回收伏笔（${(foreshadows || []).join("；")}）；收束方向参考：${ending || "有代价、有余味"}；保持文学质感；禁止注水与说教。

末段上下文（供衔接，可压缩改写）：
${tail}

只输出新的结尾正文（不要书名标题，不要解释）。`;
}

export function renderShortBibleMarkdown(bible) {
  const beats = (bible.beats || [])
    .map((b) => `### ${b.index}. ${b.title}\n- 功能：${b.purpose}\n- 内容：${b.summary}\n- 钩子：${b.hook || ""}`)
    .join("\n\n");
  const people = (bible.characters || [])
    .map(
      (c) =>
        `### ${c.name}（${c.role || ""}）\n- 年龄：${c.age || ""}\n- 性格：${c.personality || ""}\n- 欲望：${c.desire || ""}\n- 弱点：${c.weakness || ""}\n- 弧光：${c.arc || ""}\n- 说话：${c.speech || ""}`,
    )
    .join("\n\n");

  return `# 《${bible.title}》· 短篇总纲

- 类型：${bible.genre || ""}${bible.subgenre ? ` / ${bible.subgenre}` : ""}
- 文风：${bible.tone || ""}
- 读者：${bible.audience || ""}
- 核心情绪：${bible.coreEmotion || ""}
- 核心反转：${bible.coreTwist || ""}

## 一句话

${bible.logline || ""}

## 简介

${bible.synopsis || ""}

## 卖点

${(bible.sellingPoints || []).map((s) => `- ${s}`).join("\n")}

## 主题

${(bible.themes || []).map((s) => `- ${s}`).join("\n")}

## 世界观

- 时代：${bible.world?.era || ""}
- 舞台：${bible.world?.setting || ""}
- 规则：
${(bible.world?.rules || []).map((r) => `  - ${r}`).join("\n")}

## 人物

${people || "（无）"}

## 伏笔

${(bible.foreshadows || []).map((s) => `- ${s}`).join("\n")}

## 节拍

${beats || "（无）"}

## 结局方向

${bible.ending || ""}

## 手法

${bible.craftNotes || ""}
`;
}

/** 按非空白字数切到约 keepChars，尽量落在段落边界 */
function splitKeepAndTail(text, keepChars) {
  const raw = String(text || "");
  const titleMatch = raw.match(/^#\s.+\n*/);
  const title = titleMatch ? titleMatch[0] : "";
  const body = title ? raw.slice(title.length) : raw;
  const paras = body.split(/\n{2,}/);
  const kept = [];
  for (const p of paras) {
    const next = kept.length ? `${kept.join("\n\n")}\n\n${p}` : p;
    if (countChars(`${title}${next}`) > keepChars && kept.length) break;
    kept.push(p);
  }
  const keepText = `${title}${kept.join("\n\n")}`.trim();
  const rest = paras.slice(kept.length).join("\n\n").trim();
  return { keepText, rest };
}

/** 超长兜底：硬裁（仅当结尾重修失败时） */
function trimToMaxChars(text, maxChars) {
  const raw = String(text || "");
  const titleMatch = raw.match(/^#\s.+\n*/);
  const title = titleMatch ? titleMatch[0] : "";
  const body = title ? raw.slice(title.length) : raw;
  if (countChars(raw) <= maxChars) return raw;

  const paras = body.split(/\n{2,}/).filter((p) => p.trim());
  const kept = [];
  for (const p of paras) {
    const next = kept.length ? `${kept.join("\n\n")}\n\n${p}` : p;
    if (countChars(`${title}${next}`) > maxChars && kept.length) break;
    kept.push(p);
  }
  let out = `${title}${kept.join("\n\n")}`.trim();
  if (countChars(out) > maxChars) {
    let n = 0;
    let cut = "";
    for (const ch of out) {
      if (!/\s/.test(ch)) n += 1;
      cut += ch;
      if (n >= maxChars) break;
    }
    out = cut.trim();
  }
  return out;
}

async function repairOverlongEnding(text, outline, { onProgress } = {}) {
  const ratio = Number.isFinite(SHORT_TIGHTEN_KEEP_RATIO) ? SHORT_TIGHTEN_KEEP_RATIO : 0.72;
  const keepTarget = Math.floor(MAX_SHORT_CHARS * Math.min(0.85, Math.max(0.55, ratio)));
  const { keepText, rest } = splitKeepAndTail(text, keepTarget);
  const tail = rest || clipTail(text, 2_500);
  onProgress?.(
    `正文超限，保留前文约 ${countChars(keepText)} 字，短请求重写结尾（不全文重写）…`,
  );

  const ending = await chat({
    kind: "chapter",
    maxCompletionTokens: SHORT_TIGHTEN_MAX_TOKENS,
    onProgress,
    messages: [
      { role: "system", content: shortBodySystem() },
      {
        role: "user",
        content: shortEndingRepairPrompt({
          title: outline.title,
          keepChars: countChars(keepText),
          maxChars: MAX_SHORT_CHARS,
          coreTwist: outline.coreTwist,
          foreshadows: outline.foreshadows,
          ending: outline.ending,
          tail: String(tail).slice(0, 3_500),
        }),
      },
    ],
  });

  let merged = `${keepText.trim()}\n\n${String(ending || "").trim()}`.trim();
  if (countChars(merged) > MAX_SHORT_CHARS) {
    onProgress?.("结尾重修后仍偏长，再本地轻裁…");
    merged = trimToMaxChars(merged, MAX_SHORT_CHARS);
  }
  return merged;
}

function withCompatVolumes(bible) {
  return {
    ...bible,
    kind: "short-story",
    volumes: [
      {
        index: 1,
        title: bible.title,
        summary: bible.synopsis || bible.logline || "",
        estimatedChapters: 1,
        chapters: [
          {
            index: 1,
            globalIndex: 1,
            id: "short-full",
            title: bible.title,
            summary: bible.logline || bible.synopsis || "",
            endingHook: bible.coreTwist || "",
          },
        ],
      },
    ],
  };
}

function normalizeBible(raw) {
  const bible = { ...raw, kind: "short-story" };
  bible.title = String(bible.title || "未命名").trim() || "未命名";
  bible.beats = Array.isArray(bible.beats) ? bible.beats : [];
  bible.characters = Array.isArray(bible.characters) ? bible.characters : [];
  bible.sellingPoints = Array.isArray(bible.sellingPoints) ? bible.sellingPoints : [];
  bible.themes = Array.isArray(bible.themes) ? bible.themes : [];
  bible.foreshadows = Array.isArray(bible.foreshadows) ? bible.foreshadows : [];
  if (!bible.beats.length) {
    throw new Error("短篇圣经未返回情节节拍 beats。");
  }
  return withCompatVolumes(bible);
}

export function bodyPath(slug) {
  return path.join(bodyDir(slug), "全文.md");
}

export async function generateShortOutline({
  slug,
  meta,
  genre,
  extra,
  genreBrief = "",
  onProgress = () => {},
}) {
  const language = meta.language || "zh";
  const L = getLocale(language);
  onProgress(`正在生成短篇总纲（语言=${L.languageName}；简介/世界观/人物/节拍）…`);

  const raw = await chatJson({
    kind: "outline",
    maxCompletionTokens: SHORT_OUTLINE_MAX_TOKENS,
    onProgress,
    messages: [
      { role: "system", content: shortOutlineSystem() },
      {
        role: "user",
        content: shortBiblePrompt({
          genre,
          extra,
          genreBrief: genreBrief || meta.genreBrief || "",
          language,
        }),
      },
    ],
  });

  let bible = normalizeBible(raw);
  bible.language = language;
  bible.locale = meta.locale || L.locale;
  if (meta.lockedTitle) {
    bible.title = meta.lockedTitle;
  }

  // 无书名时用 logline 截取，不再单独打一次定名请求
  if (!meta.lockedTitle && (!bible.title || bible.title === "未命名" || bible.title === L.untitled)) {
    const fromLog = String(bible.logline || bible.synopsis || "未命名短篇")
      .replace(/[《》"""']/g, "")
      .slice(0, 16)
      .trim();
    bible.title = fromLog || "未命名短篇";
    onProgress(`未返回书名，已用 logline 暂定：《${bible.title}》（可后改）`);
  }

  meta.status = "outlining";
  meta.product = "short";
  meta.genre = bible.genre || genre || meta.genre;
  meta.language = language;
  await saveMeta(meta);
  await saveOutline(slug, bible);
  await writeText(path.join(outlineDir(slug), "00-总纲.md"), renderShortBibleMarkdown(bible));

  const renamed = await renameNovelToTitle(meta, bible.title);
  Object.assign(meta, renamed);
  bible.title = meta.title;
  slug = meta.slug;

  meta.status = "review";
  meta.title = bible.title;
  meta.genre = bible.genre || meta.genre;
  meta.product = "short";
  meta.totalChapters = 1;
  meta.totalVolumes = 1;
  await saveMeta(meta);
  await saveOutline(slug, bible);
  await writeText(path.join(outlineDir(slug), "00-总纲.md"), renderShortBibleMarkdown(bible));
  onProgress(`短篇大纲完成：《${meta.title}》`);

  return { meta, outline: bible };
}

export async function produceShortStory({
  slug,
  meta,
  outline,
  onProgress = () => {},
  withScript = false,
}) {
  if (!["approved", "producing", "paused"].includes(meta.status)) {
    throw new Error(`当前状态「${meta.status}」，需先 approve。`);
  }
  if (!outline?.beats?.length) {
    throw new Error("缺少短篇节拍大纲，无法生产正文。");
  }

  meta.status = "producing";
  await saveMeta(meta);

  onProgress(`正在写短篇正文《${meta.title || outline.title}》…`);

  let text = await withRetries(
    async () =>
      chat({
        kind: "chapter",
        maxCompletionTokens: SHORT_WRITE_MAX_TOKENS,
        onProgress,
        messages: [
          { role: "system", content: shortBodySystem() },
          { role: "user", content: shortBodyPrompt(outline) },
        ],
      }),
    { onProgress, label: "短篇正文" },
  );

  text = String(text || "").trim();
  if (!/^#\s/.test(text)) {
    text = `# ${meta.title || outline.title}\n\n${text}`;
  }

  // 过短只续 1 次（续写仍按大师标准收束）
  {
    const n = countChars(text);
    if (n < MIN_SHORT_CHARS) {
      onProgress(`正文偏短（${n} 字），续写收束…`);
      const extra = await chat({
        kind: "chapter",
        maxCompletionTokens: SHORT_CONTINUE_MAX_TOKENS,
        onProgress,
        messages: [
          { role: "system", content: shortBodySystem() },
          {
            role: "user",
            content: shortContinuePrompt({
              title: meta.title || outline.title,
              currentChars: n,
              tail: clipTail(text, SHORT_CONTINUE_TAIL_CHARS),
              bible: outline,
            }),
          },
        ],
      });
      text = `${text.trim()}\n\n${String(extra || "").trim()}`;
    }
  }

  let chars = countChars(text);
  if (chars > MAX_SHORT_CHARS) {
    try {
      text = await repairOverlongEnding(text, outline, { onProgress });
    } catch (error) {
      onProgress(`结尾重修失败，改本地裁切兜底：${error.message}`);
      text = trimToMaxChars(text, MAX_SHORT_CHARS);
    }
    chars = countChars(text);
  }

  const file = bodyPath(slug);
  await writeText(file, text);

  meta.writtenChars = chars;
  meta.writtenChapters = ["full"];
  meta.lastChapterFile = file;
  meta.status = "done";
  meta.product = "short";
  await saveMeta(meta);
  onProgress(`短篇完成：《${meta.title}》 ${chars} 字 → ${file}`);

  if (withScript || isAutoScriptEnabled()) {
    try {
      onProgress("按要求生成剧本…");
      await saveOutline(slug, withCompatVolumes(outline));
      await generateScriptForNovel(slug, { onProgress, limit: 1 });
    } catch (error) {
      onProgress(`剧本生成失败：${error.message}`);
    }
  }

  return { meta, chars, file };
}

export async function loadShortOutline(slug) {
  if (!(await pathExists(outlineJsonPath(slug)))) return null;
  return readJson(outlineJsonPath(slug));
}
