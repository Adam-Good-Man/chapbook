import {
  formatCultureBrief,
  getLocale,
  pickRandomLocale,
  LOCALES,
} from "./locales.js";
import { SHORT_FLAVORS_ZH, SHORT_GENRES_ZH, SHORT_STRUCTURE_NOTES } from "./shortCraft.js";

export const GENRE_POOL = SHORT_GENRES_ZH;
export const GENRE_FLAVORS = SHORT_FLAVORS_ZH;
export const STRUCTURE_DIVERSITY = SHORT_STRUCTURE_NOTES;

function normalizeGenreLabel(value) {
  return String(value || "")
    .replace(/\s+/g, "")
    .replace(/[／/].*$/, "")
    .trim();
}

export function matchPoolGenre(label, language = "zh") {
  const raw = normalizeGenreLabel(label);
  if (!raw) return null;
  const pool =
    language === "zh" ? SHORT_GENRES_ZH : getLocale(language).genres || SHORT_GENRES_ZH;
  for (const g of pool) {
    const compact = normalizeGenreLabel(g);
    if (raw === compact || raw.startsWith(compact) || raw.includes(compact) || compact.includes(raw)) {
      return g;
    }
  }
  return null;
}

function randomItem(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * 随机短篇选题（固定中文市场）。
 */
export function pickRandomGenre({
  recentlyUsed = [],
  recentlyUsedLanguages = [],
  language,
} = {}) {
  void recentlyUsedLanguages;
  void language;
  const localeInfo = getLocale("zh");
  const pool = SHORT_GENRES_ZH;
  const used = recentlyUsed
    .map((item) => matchPoolGenre(item, "zh"))
    .filter(Boolean);
  const unused = pool.filter((g) => !used.includes(g));
  const genrePool = unused.length ? unused : pool;
  const genre = randomItem(genrePool);
  const flavors = SHORT_FLAVORS_ZH[genre] || [genre];
  const flavor = randomItem(flavors);
  const structureNotes = shuffle(SHORT_STRUCTURE_NOTES).slice(0, 3 + Math.floor(Math.random() * 2));
  return {
    language: "zh",
    locale: localeInfo.locale,
    market: localeInfo.market,
    genre,
    flavor,
    label: `${genre} / ${flavor}`,
    structureNotes,
    cultureBrief: formatCultureBrief(localeInfo),
    localeInfo,
    product: "short",
  };
}

export function formatGenreBrief(pick) {
  if (!pick) return "";
  return [
    `产品：短篇小说`,
    `语言市场：${pick.localeInfo?.languageName || pick.language || "zh"}｜${pick.market || ""}`,
    `大类：${pick.genre}`,
    `细分：${pick.flavor}`,
    `手法要求：${(pick.structureNotes || []).join("；")}`,
    pick.cultureBrief ? `文化逻辑：\n${pick.cultureBrief}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export { pickRandomLocale, getLocale, formatCultureBrief, LOCALES };
