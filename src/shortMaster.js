/**
 * 短篇大师化后处理：本地启发式 + 多维审稿 + 读者弃读点 + 定向改稿。
 * 目标：压 AI 味、抬可读性与逻辑闭环，而不是「再写得更长」。
 */

import path from "node:path";
import { chat, chatJson } from "./llm.js";
import {
  CHAPTER_PRODUCE_MAX_ATTEMPTS,
  isShortMasterPassEnabled,
  isShortReaderSimEnabled,
  MAX_SHORT_CHARS,
  MIN_SHORT_CHARS,
  SHORT_CRITIC_MAX_TOKENS,
  SHORT_MASTER_MAX_ROUNDS,
  SHORT_READER_SIM_MAX_TOKENS,
  SHORT_REVISE_MAX_TOKENS,
} from "./config.js";
import {
  AI_TASTE_BLACKLIST,
  ANTI_BOREDOM_RULES,
  LOGIC_RULES,
  OPENING_RULES,
} from "./shortCraft.js";
import { novelDir, writeText } from "./store.js";
import { countChars } from "./text.js";

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
      onProgress?.(
        `${label}中断：${String(error.message || error).slice(0, 100)}；${Math.round(wait / 1000)}s 后重试（${i}/${maxAttempts}）…`,
      );
      await sleep(wait);
    }
  }
  throw last;
}

function stripTitle(text) {
  return String(text || "").replace(/^#\s.+\n*/, "");
}

/** 前 N 个非空白字（用于开篇体检） */
export function firstNChars(text, n = 120) {
  const body = stripTitle(text).replace(/\s+/g, "");
  return body.slice(0, n);
}

export function findAiTasteHits(text) {
  const raw = String(text || "");
  const hits = [];
  for (const phrase of AI_TASTE_BLACKLIST) {
    if (raw.includes(phrase)) hits.push(phrase);
  }
  return [...new Set(hits)];
}

const WEATHER_OPEN =
  /^(清晨|傍晚|深夜|夜色|阳光|晨光|月光|微风|细雨|暴雨|雪花|天色|天气|窗外|春天|夏天|秋天|冬天)/;

/**
 * 零成本本地体检：开篇、套话、篇幅。结果会喂给审稿模型。
 */
export function localCraftAudit(text) {
  const chars = countChars(text);
  const opening = firstNChars(text, 120);
  const issues = [];

  if (chars < MIN_SHORT_CHARS) {
    issues.push({
      severity: "MAJOR",
      lens: "structure",
      note: `篇幅偏短（${chars} 字），主冲突/代价可能未落地`,
      quote: "",
    });
  }
  if (chars > MAX_SHORT_CHARS) {
    issues.push({
      severity: "MAJOR",
      lens: "structure",
      note: `篇幅超限（${chars} 字），可能注水`,
      quote: "",
    });
  }
  if (WEATHER_OPEN.test(opening)) {
    issues.push({
      severity: "BLOCKING",
      lens: "hook",
      note: "开篇像天气/氛围说明书，缺少立刻可读的冲突或反常",
      quote: opening.slice(0, 40),
    });
  }
  if (opening.length >= 80 && !/[？?！!]|为什么|不能|别|必须|已经|突然|门口|电话|血|死|钱|离婚|迟到|报警/.test(opening)) {
    issues.push({
      severity: "MAJOR",
      lens: "hook",
      note: "前120字未见明显冲突信号（疑问、禁令、代价、危机）",
      quote: opening.slice(0, 50),
    });
  }

  for (const phrase of findAiTasteHits(text).slice(0, 12)) {
    issues.push({
      severity: "MAJOR",
      lens: "voice",
      note: `疑似 AI 套话：「${phrase}」`,
      quote: phrase,
    });
  }

  return { chars, opening, issues };
}

function criticSystem() {
  return `你是刻薄但公正的华语短篇责编（Pixar Braintrust 风格）：只诊断问题，不重写全文。
原则：1) 诚实无权威——指出哪里让人弃读，不替作者做创意决定；2) 让故事更好，不为抬杠。
全程简体中文。只输出 JSON。`;
}

function criticUser({ text, bible, localAudit, round }) {
  const localNotes = (localAudit.issues || [])
    .map((i) => `- [${i.severity}] ${i.lens}: ${i.note}${i.quote ? `｜摘「${i.quote}」` : ""}`)
    .join("\n");

  return `第 ${round} 轮审稿。对照圣经与技法，给这篇短篇开诊断单。

书名：${bible?.title || ""}
logline：${bible?.logline || ""}
开篇钩子承诺：${bible?.openingHook || ""}
情绪：${bible?.coreEmotion || ""}｜反转：${bible?.coreTwist || ""}
结尾类型：${bible?.endingType || ""}｜收束：${bible?.ending || ""}
伏笔：${(bible?.foreshadows || []).join("；")}
反乏味承诺：${bible?.antiBoredom || ""}

开篇铁律：${OPENING_RULES.join("；")}
反乏味：${ANTI_BOREDOM_RULES.slice(0, 4).join("；")}
逻辑：${LOGIC_RULES.join("；")}

本地预检（必须纳入 notes，可升/降级）：
${localNotes || "（无）"}
开篇120字抽样：${localAudit.opening || ""}

六维镜头（每条 note 必须带 quote 原文摘录，severity 只许 BLOCKING|MAJOR|POLISH）：
1) hook — 前120字是否产生「为什么/然后呢」
2) tension — 每约800字是否有局势变化；中段是否泄气
3) character — 欲望具体？对话是否推戏？有无降智
4) logic — 因果/伏笔/反转是否公平可回看
5) voice — AI 味、说明书腔、情绪标签、正确废话
6) ending — 主选择是否完成；有无说教；余味是否廉价

裁决：
- clean=true 仅当无 BLOCKING 且 MAJOR≤1（且该 MAJOR 不影响可读）
- dropoutRisk：读者最可能弃读的段落位置与原因（必填）
- mustFix：本轮必须改的 1–5 条（按优先级）

只返回 JSON：
{
  "clean": false,
  "score": 0,
  "dropoutRisk": { "where": "", "why": "" },
  "mustFix": ["", ""],
  "notes": [
    { "severity": "BLOCKING", "lens": "hook", "note": "", "quote": "" }
  ],
  "praise": ["（可选，最多2条真优点）"]
}

正文：
${String(text || "").slice(0, 48_000)}`;
}

function readerSimSystem() {
  return `你是普通网文/短篇读者，不专业、不耐心。只报告「哪里想划走」，不给文学课。简体中文。只输出 JSON。`;
}

function readerSimUser(text) {
  return `通读下面短篇。若你中途想弃读，标出大约字数位置与触发句；若能读完，说最后印象是否「想转发给朋友」还是「正确但无聊」。

只返回 JSON：
{
  "wouldFinish": true,
  "quitAtChars": null,
  "quitTrigger": "",
  "oneLineFeel": "",
  "boringMoments": ["", ""]
}

正文：
${String(text || "").slice(0, 40_000)}`;
}

function reviseSystem() {
  return `你是华语短篇改稿高手。只修审稿单上的问题，不另起炉灶，不注水，不说教。
硬性：保留书名标题行；保持因果与人物动机；删 AI 套话；加强场面与对话推戏；结尾忌主题发言。
简体中文。只输出完整改定正文。`;
}

function reviseUser({ text, bible, critique, reader, round }) {
  const notes = (critique?.notes || [])
    .filter((n) => n.severity === "BLOCKING" || n.severity === "MAJOR")
    .slice(0, 12)
    .map((n) => `- [${n.severity}/${n.lens}] ${n.note}${n.quote ? `｜原文「${n.quote}」` : ""}`)
    .join("\n");
  const must = (critique?.mustFix || []).map((s) => `- ${s}`).join("\n");
  const readerLine = reader
    ? `读者模拟：读完=${reader.wouldFinish}；弃读点=${reader.quitAtChars ?? "无"}；触发=${reader.quitTrigger || ""}；感觉=${reader.oneLineFeel || ""}；无聊点=${(reader.boringMoments || []).join("；")}`
    : "";

  return `第 ${round} 轮定向改稿。对照问题清单改，不要为了「优美」加字。

目标篇幅仍约 ${MIN_SHORT_CHARS}–${MAX_SHORT_CHARS} 字；优先压缩废话，而非拉长。
书名：${bible?.title || ""}
反转须兑现：${bible?.coreTwist || ""}
伏笔：${(bible?.foreshadows || []).join("；")}

必须修：
${must || "（见下方 notes）"}

问题清单：
${notes || "（无）"}
弃读风险：${critique?.dropoutRisk?.where || ""}｜${critique?.dropoutRisk?.why || ""}
${readerLine}

原稿：
${String(text || "").slice(0, 48_000)}

只输出改定后的完整正文（第一行仍是 # 书名）。`;
}

function normalizeCritique(raw, localAudit) {
  const notes = Array.isArray(raw?.notes) ? raw.notes : [];
  const merged = [...notes];
  for (const issue of localAudit.issues || []) {
    const dup = merged.some((n) => n.note === issue.note || (issue.quote && n.quote === issue.quote));
    if (!dup) merged.push(issue);
  }
  const blocking = merged.filter((n) => n.severity === "BLOCKING").length;
  const major = merged.filter((n) => n.severity === "MAJOR").length;
  let clean = Boolean(raw?.clean);
  if (blocking > 0) clean = false;
  if (major > 2) clean = false;

  return {
    clean,
    score: Number(raw?.score) || 0,
    dropoutRisk: raw?.dropoutRisk || { where: "", why: "" },
    mustFix: Array.isArray(raw?.mustFix) ? raw.mustFix : [],
    notes: merged,
    praise: Array.isArray(raw?.praise) ? raw.praise : [],
    blocking,
    major,
  };
}

function renderCritiqueMarkdown({ round, critique, reader, localAudit, charsBefore, charsAfter }) {
  const notes = (critique.notes || [])
    .map((n) => `- **${n.severity}** / ${n.lens}：${n.note}${n.quote ? `\n  > ${n.quote}` : ""}`)
    .join("\n");
  return `# 第 ${round} 轮审稿

- 字数：改前 ${charsBefore} → 改后 ${charsAfter ?? "（本轮未改）"}
- clean：${critique.clean}
- score：${critique.score}
- BLOCKING：${critique.blocking}｜MAJOR：${critique.major}
- 弃读风险：${critique.dropoutRisk?.where || ""} — ${critique.dropoutRisk?.why || ""}

## 必须修

${(critique.mustFix || []).map((s) => `- ${s}`).join("\n") || "（无）"}

## 笔记

${notes || "（无）"}

## 读者模拟

${
  reader
    ? `- 会读完：${reader.wouldFinish}
- 弃读字数：${reader.quitAtChars ?? "无"}
- 触发：${reader.quitTrigger || ""}
- 一句话感觉：${reader.oneLineFeel || ""}
- 无聊点：${(reader.boringMoments || []).join("；") || "无"}`
    : "（未跑）"
}

## 本地预检开篇

${localAudit.opening || ""}

## 优点

${(critique.praise || []).map((s) => `- ${s}`).join("\n") || "（无）"}
`;
}

/**
 * 对短篇正文跑大师化闭环。失败时返回原稿（不阻断生产）。
 */
export async function masterPolishShortStory({
  text,
  bible,
  slug,
  onProgress = () => {},
} = {}) {
  if (!isShortMasterPassEnabled()) {
    return { text, skipped: true, rounds: 0 };
  }

  let current = String(text || "").trim();
  const reviewRoot = path.join(novelDir(slug), "审稿");
  const rounds = [];

  for (let round = 1; round <= SHORT_MASTER_MAX_ROUNDS; round += 1) {
    const localAudit = localCraftAudit(current);
    onProgress(`大师化审稿第 ${round}/${SHORT_MASTER_MAX_ROUNDS} 轮（本地预检 ${localAudit.issues.length} 条）…`);

    const critiqueRaw = await withRetries(
      () =>
        chatJson({
          kind: "chapter",
          maxCompletionTokens: SHORT_CRITIC_MAX_TOKENS,
          onProgress,
          messages: [
            { role: "system", content: criticSystem() },
            {
              role: "user",
              content: criticUser({ text: current, bible, localAudit, round }),
            },
          ],
        }),
      { onProgress, label: "短篇审稿" },
    );

    const critique = normalizeCritique(critiqueRaw, localAudit);

    let reader = null;
    if (isShortReaderSimEnabled()) {
      onProgress(`读者弃读模拟（第 ${round} 轮）…`);
      try {
        reader = await withRetries(
          () =>
            chatJson({
              kind: "chapter",
              maxCompletionTokens: SHORT_READER_SIM_MAX_TOKENS,
              onProgress,
              messages: [
                { role: "system", content: readerSimSystem() },
                { role: "user", content: readerSimUser(current) },
              ],
            }),
          { onProgress, label: "读者模拟" },
        );
        if (reader?.wouldFinish === false || reader?.quitAtChars != null) {
          critique.clean = false;
          critique.mustFix = [
            ...(critique.mustFix || []),
            `消除弃读点：约 ${reader.quitAtChars ?? "?"} 字处——${reader.quitTrigger || reader.oneLineFeel || "节奏泄气"}`,
          ].slice(0, 6);
        }
      } catch (error) {
        onProgress(`读者模拟跳过：${error.message}`);
      }
    }

    const charsBefore = countChars(current);
    await writeText(
      path.join(reviewRoot, `${String(round).padStart(2, "0")}-审稿.md`),
      renderCritiqueMarkdown({
        round,
        critique,
        reader,
        localAudit,
        charsBefore,
        charsAfter: null,
      }),
    );

    const needsRevise = !critique.clean || critique.blocking > 0 || critique.major > 1;

    if (!needsRevise) {
      onProgress(`审稿通过（第 ${round} 轮，score=${critique.score}）`);
      rounds.push({ round, critique, reader, revised: false, chars: charsBefore });
      break;
    }

    onProgress(
      `定向改稿第 ${round} 轮（BLOCKING=${critique.blocking}, MAJOR=${critique.major}）…`,
    );
    const revised = await withRetries(
      () =>
        chat({
          kind: "chapter",
          maxCompletionTokens: SHORT_REVISE_MAX_TOKENS,
          onProgress,
          messages: [
            { role: "system", content: reviseSystem() },
            {
              role: "user",
              content: reviseUser({ text: current, bible, critique, reader, round }),
            },
          ],
        }),
      { onProgress, label: "短篇改稿" },
    );

    let next = String(revised || "").trim();
    if (!/^#\s/.test(next)) {
      next = `# ${bible?.title || "未命名"}\n\n${next}`;
    }
    // 改坏（空/过短）则保留原稿
    if (countChars(next) < Math.min(MIN_SHORT_CHARS * 0.55, charsBefore * 0.5)) {
      onProgress("改稿过短，丢弃本轮改定，保留上一稿");
      rounds.push({ round, critique, reader, revised: false, chars: charsBefore });
      break;
    }

    current = next;
    const charsAfter = countChars(current);
    await writeText(
      path.join(reviewRoot, `${String(round).padStart(2, "0")}-审稿.md`),
      renderCritiqueMarkdown({
        round,
        critique,
        reader,
        localAudit,
        charsBefore,
        charsAfter,
      }),
    );
    await writeText(path.join(reviewRoot, `${String(round).padStart(2, "0")}-改定.md`), current);
    rounds.push({ round, critique, reader, revised: true, chars: charsAfter });
    onProgress(`第 ${round} 轮改定完成：${charsBefore} → ${charsAfter} 字`);
  }

  return { text: current, skipped: false, rounds, reviewDir: reviewRoot };
}
