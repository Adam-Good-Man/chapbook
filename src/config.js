import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env") });

export const ROOT = root;
export const CONTENT_DIR = path.join(ROOT, "content");

/** 产品形态：短篇小说（默认） */
export const PRODUCT_MODE = "short";

/** 短篇自然篇幅区间（字）；不默认具体目标，不凑字 */
export const MIN_SHORT_CHARS = 5_000;
export const MAX_SHORT_CHARS = 30_000;

/** 兼容旧长篇常量（已停用默认路径） */
export const MIN_NOVEL_CHARS = MIN_SHORT_CHARS;
export const MAX_NOVEL_CHARS = MAX_SHORT_CHARS;
export const DEFAULT_NOVEL_CHARS = 0;
export const MIN_CHAPTER_CHARS = 5_000;
export const MAX_CHAPTER_CHARS = 10_000;
export const CHAPTER_SOFT_MAX = 11_000;
export const AVG_CHAPTER_CHARS = 7_500;

/** 短篇正文 / 续写 / 总纲 / 超长收束 token 上限（省钱且保质） */
export const SHORT_OUTLINE_MAX_TOKENS = Number(process.env.SHORT_OUTLINE_MAX_TOKENS || 4_500);
export const SHORT_WRITE_MAX_TOKENS = Number(process.env.SHORT_WRITE_MAX_TOKENS || process.env.CHAPTER_WRITE_MAX_TOKENS || 24_000);
export const SHORT_CONTINUE_MAX_TOKENS = Number(
  process.env.SHORT_CONTINUE_MAX_TOKENS || process.env.CHAPTER_CONTINUE_MAX_TOKENS || 6_000,
);
export const SHORT_CONTINUE_TAIL_CHARS = Number(process.env.SHORT_CONTINUE_TAIL_CHARS || 1_500);
/** 超长时只修结尾：保留前文 + 短请求重写末段 */
export const SHORT_TIGHTEN_MAX_TOKENS = Number(process.env.SHORT_TIGHTEN_MAX_TOKENS || 4_000);
export const SHORT_TIGHTEN_KEEP_RATIO = Number(process.env.SHORT_TIGHTEN_KEEP_RATIO || 0.72);

export const CHAPTER_WRITE_MAX_TOKENS = Number(process.env.CHAPTER_WRITE_MAX_TOKENS || 24_000);
export const CHAPTER_CONTINUE_MAX_TOKENS = Number(process.env.CHAPTER_CONTINUE_MAX_TOKENS || 6_000);
export const CHAPTER_TIGHTEN_MAX_TOKENS = Number(process.env.CHAPTER_TIGHTEN_MAX_TOKENS || 4_000);
export const CHAPTER_MEMORY_MAX_TOKENS = Number(process.env.CHAPTER_MEMORY_MAX_TOKENS || 2_000);
export const CHAPTER_CONTINUE_TAIL_CHARS = Number(process.env.CHAPTER_CONTINUE_TAIL_CHARS || 1_500);
export const CHAPTER_MEMORY_TAIL_CHARS = Number(process.env.CHAPTER_MEMORY_TAIL_CHARS || 2_000);
export const CHAPTER_PRODUCE_MAX_ATTEMPTS = Number(process.env.CHAPTER_PRODUCE_MAX_ATTEMPTS || 3);
export const CHAPTER_UNROUND_ENABLED = /^(1|true|yes)$/i.test(
  String(process.env.CHAPTER_UNROUND_ENABLED || "false").trim(),
);

/** 默认不自动出剧本；仅 --script / AUTO_SCRIPT=1 时生成 */
export function isAutoScriptEnabled() {
  return /^(1|true|yes|on)$/i.test(String(process.env.AUTO_SCRIPT || "0").trim());
}

/** 封面生产已关闭；需要时设 COVER_ENABLED=1（仍建议手动 npm run covers） */
export function isCoverProductionEnabled() {
  return /^(1|true|yes|on)$/i.test(String(process.env.COVER_ENABLED || "0").trim());
}

/** @deprecated 封面默认关闭，请用 isCoverProductionEnabled */
export function isAutoCoverEnabled() {
  return isCoverProductionEnabled() && /^(1|true|yes|on)$/i.test(String(process.env.AUTO_COVER || "0").trim());
}

export function getModel() {
  return process.env.OPENAI_MODEL || "gpt-5.6-luna";
}

export function getApiKey() {
  return (process.env.OPENAI_API_KEY || "").trim();
}

export function getBaseURL() {
  const raw = (process.env.OPENAI_BASE_URL || "").trim();
  return raw || undefined;
}

export function getReasoningEffort(kind) {
  const fallback = "medium";
  const key = kind === "outline" ? "OUTLINE_REASONING_EFFORT" : "CHAPTER_REASONING_EFFORT";
  return (process.env[key] || fallback).trim();
}

export function getTimeoutMs() {
  const raw = Number(process.env.REQUEST_TIMEOUT_MS || 8 * 60 * 1000);
  return Number.isFinite(raw) && raw >= 30_000 ? raw : 8 * 60 * 1000;
}

export const AUTHOR_PEN_NAME = (process.env.AUTHOR_PEN_NAME || "龙龙老表").trim();
export const COVER_WIDTH = 600;
export const COVER_HEIGHT = 800;
/** 开启自动封面时默认只出 1 张（可 COVER_COUNT=3） */
export const COVER_COUNT = Math.max(1, Number(process.env.COVER_COUNT || 1) || 1);
export const AUTHOR_SEAL_PATH = path.join(ROOT, "assets", "seal-龙龙老表.png");

export function getImageQuality() {
  const raw = String(process.env.OPENAI_IMAGE_QUALITY || "low").trim().toLowerCase();
  if (["low", "medium", "high", "auto"].includes(raw)) return raw;
  return "low";
}

export const SCRIPT_EPISODE_BATCH = 3;
export const SCRIPT_SCHEMA_VERSION = "1.0";
export const SCRIPT_ASPECT_RATIO = "9:16";
export const SCRIPT_DEFAULT_EPISODE_SEC = 90;

export function getImageModel() {
  return (process.env.OPENAI_IMAGE_MODEL || "gpt-image-1").trim();
}

export function assertApiKey() {
  if (!getApiKey()) {
    throw new Error("未找到 OPENAI_API_KEY。请在项目根目录的 .env 中填写，可参考 .env.example。");
  }
}
