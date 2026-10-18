import {
  CHAPTER_SOFT_MAX,
  DEFAULT_NOVEL_CHARS,
  MAX_CHAPTER_CHARS,
  MAX_NOVEL_CHARS,
  MIN_CHAPTER_CHARS,
  MIN_NOVEL_CHARS,
} from "./config.js";
import { parseWordTarget } from "./text.js";

export function looksManufactured(n) {
  const value = Math.abs(Math.round(Number(n) || 0));
  if (value < 20) return false;
  if (value >= 10_000 && value % 10_000 === 0) return true;
  if (value >= 1_000 && value % 1_000 === 0) return true;
  if (value >= 100 && value % 100 === 0) return true;
  if (value >= 50 && value % 50 === 0) return true;
  return false;
}

function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

export function scatterInt(min, max) {
  let low = Math.ceil(Math.min(min, max));
  let high = Math.floor(Math.max(min, max));
  if (high <= low) return low;
  let n = randInt(low, high);
  for (let i = 0; i < 16 && looksManufactured(n); i += 1) {
    n += randInt(3, 41);
    if (n > high) n = high - randInt(7, 29);
    if (n < low) n = low + randInt(5, 23);
  }
  return Math.min(high, Math.max(low, n));
}

export function naturalizeAround(base, { spread = 0.08, min, max } = {}) {
  const center = Number(base) || DEFAULT_NOVEL_CHARS;
  const delta = (Math.random() * 2 - 1) * center * spread;
  let n = Math.round(center + delta) + randInt(13, 97);
  n = Math.min(max, Math.max(min, n));
  if (looksManufactured(n)) {
    n = scatterInt(Math.max(min, n - 800), Math.min(max, n + 800));
  }
  return n;
}

export function resolveNovelBudget(rawInput, { soft = false } = {}) {
  if (rawInput === undefined || rawInput === null || rawInput === "") {
    return naturalizeAround(DEFAULT_NOVEL_CHARS, {
      spread: 0.09,
      min: MIN_NOVEL_CHARS,
      max: MAX_NOVEL_CHARS,
    });
  }
  const parsed = typeof rawInput === "number" ? Math.round(rawInput) : parseWordTarget(rawInput);
  if (!parsed || Number.isNaN(parsed)) {
    const err = new Error(`无法解析目标字数：${rawInput}`);
    err.code = "WORD_PARSE";
    throw err;
  }
  if (parsed < MIN_NOVEL_CHARS || parsed > MAX_NOVEL_CHARS) {
    if (soft) {
      // 续写/已有大纲时：按现有字数夹回区间，避免因裁章后合计略低而中断
      return naturalizeAround(Math.min(MAX_NOVEL_CHARS, Math.max(MIN_NOVEL_CHARS, parsed)), {
        spread: 0.02,
        min: MIN_NOVEL_CHARS,
        max: MAX_NOVEL_CHARS,
      });
    }
    const err = new Error(
      `目标字数必须在约 ${MIN_NOVEL_CHARS} 到 ${MAX_NOVEL_CHARS} 之间（短篇自然篇幅）。`,
    );
    err.code = "WORD_RANGE";
    throw err;
  }
  if (looksManufactured(parsed) || parsed % 100 === 0) {
    return naturalizeAround(parsed, {
      spread: 0.055,
      min: MIN_NOVEL_CHARS,
      max: MAX_NOVEL_CHARS,
    });
  }
  return parsed;
}

export function rollChapterQuota() {
  const target = scatterInt(5_360, 9_640);
  const min = Math.max(MIN_CHAPTER_CHARS, target - scatterInt(240, 520));
  const max = Math.min(MAX_CHAPTER_CHARS, target + scatterInt(260, 540));
  const softMax = Math.min(CHAPTER_SOFT_MAX, max + scatterInt(160, 380));
  return { target, min, max, softMax };
}

export const MIN_CHAPTERS_PER_VOLUME = 10;
export const MAX_CHAPTERS_PER_VOLUME = 20;

export function rollVolumeChapterCount(avoid = []) {
  let n = scatterInt(MIN_CHAPTERS_PER_VOLUME, MAX_CHAPTERS_PER_VOLUME);
  for (let i = 0; i < 12; i += 1) {
    if (!avoid.includes(n) && !looksManufactured(n)) return n;
    n = scatterInt(MIN_CHAPTERS_PER_VOLUME, MAX_CHAPTERS_PER_VOLUME);
  }
  return n;
}

export function planVolumeChapterCounts(volumes) {
  const counts = [];
  const used = new Map();
  return volumes.map((volume) => {
    const recent = counts.slice(-2);
    let estimated = rollVolumeChapterCount(recent);
    for (let i = 0; i < 10 && (used.get(estimated) || 0) >= 2; i += 1) {
      estimated = rollVolumeChapterCount([...recent, estimated]);
    }
    counts.push(estimated);
    used.set(estimated, (used.get(estimated) || 0) + 1);
    return { ...volume, estimatedChapters: estimated };
  });
}

export function stampChapterQuotas(bible, { preferMin = MIN_NOVEL_CHARS } = {}) {
  let total = 0;
  for (const volume of bible.volumes || []) {
    let volumeTotal = 0;
    for (const chapter of volume.chapters || []) {
      chapter.quota = chapter.quota || rollChapterQuota();
      volumeTotal += chapter.quota.target;
    }
    volume.targetWordCount = volumeTotal;
    volume.estimatedChapters = Math.max(
      Number(volume.estimatedChapters) || 0,
      (volume.chapters || []).length,
    );
    total += volumeTotal;
  }

  // 章数偏少时，把单章配额往上抬，尽量贴近长篇下限，避免合计掉到一百万以下
  if (preferMin && total > 0 && total < preferMin) {
    const scale = preferMin / total;
    total = 0;
    for (const volume of bible.volumes || []) {
      let volumeTotal = 0;
      for (const chapter of volume.chapters || []) {
        const q = chapter.quota;
        const target = Math.min(
          MAX_CHAPTER_CHARS,
          Math.max(MIN_CHAPTER_CHARS, Math.round(q.target * scale) + scatterInt(17, 83)),
        );
        chapter.quota = {
          target,
          min: Math.max(MIN_CHAPTER_CHARS, target - scatterInt(180, 420)),
          max: Math.min(MAX_CHAPTER_CHARS, target + scatterInt(180, 420)),
          softMax: Math.min(CHAPTER_SOFT_MAX, target + scatterInt(260, 520)),
        };
        volumeTotal += chapter.quota.target;
      }
      volume.targetWordCount = volumeTotal;
      total += volumeTotal;
    }
  }

  // 规划总字数：已有章节配额 + 未完成章估算；过低则抬回长篇下限附近
  let planned = total;
  for (const volume of bible.volumes || []) {
    const have = (volume.chapters || []).length;
    const want = Number(volume.estimatedChapters) || have;
    if (want > have) {
      planned += (want - have) * scatterInt(6_800, 8_600);
    }
  }
  bible.targetWordCount = Math.max(total, planned);
  if (preferMin && bible.targetWordCount < preferMin) {
    bible.targetWordCount = naturalizeAround(preferMin, {
      spread: 0.04,
      min: MIN_NOVEL_CHARS,
      max: MAX_NOVEL_CHARS,
    });
  }
  return bible;
}
