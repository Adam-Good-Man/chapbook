import path from "node:path";
import {
  SCRIPT_ASPECT_RATIO,
  SCRIPT_DEFAULT_EPISODE_SEC,
  SCRIPT_EPISODE_BATCH,
  SCRIPT_SCHEMA_VERSION,
  isAutoScriptEnabled,
} from "./config.js";
import { chatJson } from "./llm.js";
import { editorSystemFor } from "./locales.js";
import {
  renderScriptEpisodeMarkdown,
  renderScriptSeriesMarkdown,
  scriptEpisodesBatchPrompt,
  scriptSeriesBiblePrompt,
} from "./prompts.js";
import {
  ensureDir,
  flattenChapters,
  loadNovel,
  pathExists,
  readJson,
  saveMeta,
  scriptDir,
  scriptEpisodePath,
  scriptEpisodesDir,
  scriptJsonPath,
  writeJson,
  writeText,
} from "./store.js";

function print(msg) {
  console.log(msg);
}

function flattenChaptersWithVolume(outline) {
  const list = [];
  for (const volume of outline.volumes || []) {
    for (const chapter of volume.chapters || []) {
      list.push({
        ...chapter,
        volumeIndex: volume.index,
        volumeTitle: volume.title,
      });
    }
  }
  return list.sort((a, b) => (a.globalIndex || 0) - (b.globalIndex || 0));
}

function emptySeriesShell({ meta, outline }) {
  const chapters = flattenChaptersWithVolume(outline);
  return {
    schemaVersion: SCRIPT_SCHEMA_VERSION,
    kind: "novel-video-script",
    source: {
      novelSlug: meta.slug,
      title: meta.title || outline.title || "",
      language: outline.language || meta.language || "zh",
      locale: outline.locale || meta.locale || "",
      genre: outline.genre || meta.genre || "",
      subgenre: outline.subgenre || "",
      logline: outline.logline || "",
      synopsis: outline.synopsis || "",
    },
    consumerNotes: [
      "Read script.json for series bible (cast/locations/visual/audio/production).",
      "Read 分集/*.json for per-episode scenes, dialogue, and shot lists.",
      "Each shot has visualPrompt + videoPrompt (English) for image/video generators.",
      "Dialogue/plot fields follow the novel language.",
      "episode.index matches novel chapter globalIndex (1:1).",
    ],
    production: null,
    visualBible: null,
    audioBible: null,
    cast: [],
    locations: [],
    props: [],
    continuityRules: [],
    episodePolicy: null,
    episodeIndex: chapters.map((c) => ({
      index: c.globalIndex,
      id: `ep_${String(c.globalIndex).padStart(3, "0")}`,
      title: c.title || "",
      chapterId: c.id,
      status: "pending",
      file: null,
    })),
    stats: {
      plannedEpisodes: chapters.length,
      completedEpisodes: 0,
      updatedAt: new Date().toISOString(),
    },
  };
}

async function loadOrInitScript(slug, meta, outline) {
  const file = scriptJsonPath(slug);
  if (await pathExists(file)) {
    const existing = await readJson(file);
    // refresh episodeIndex if outline grew
    const chapters = flattenChaptersWithVolume(outline);
    const byIndex = new Map((existing.episodeIndex || []).map((e) => [e.index, e]));
    existing.episodeIndex = chapters.map((c) => {
      const prev = byIndex.get(c.globalIndex);
      return (
        prev || {
          index: c.globalIndex,
          id: `ep_${String(c.globalIndex).padStart(3, "0")}`,
          title: c.title || "",
          chapterId: c.id,
          status: "pending",
          file: null,
        }
      );
    });
    existing.stats = existing.stats || {};
    existing.stats.plannedEpisodes = chapters.length;
    existing.source = {
      ...(existing.source || {}),
      novelSlug: meta.slug,
      title: meta.title || outline.title || existing.source?.title || "",
      language: outline.language || meta.language || existing.source?.language || "zh",
      genre: outline.genre || meta.genre || existing.source?.genre || "",
    };
    return existing;
  }
  return emptySeriesShell({ meta, outline });
}

function hasSeriesBible(script) {
  return Boolean(script?.production && Array.isArray(script.cast) && script.cast.length);
}

async function countEpisodeFiles(slug) {
  const dir = scriptEpisodesDir(slug);
  if (!(await pathExists(dir))) return 0;
  const { readdir } = await import("node:fs/promises");
  const files = await readdir(dir);
  return files.filter((name) => /^第\d+集-.*\.json$/i.test(name)).length;
}

export async function isScriptIncomplete(slug, meta, outline) {
  if (["draft", "outlining"].includes(meta.status)) return false;
  const isShort = meta.product === "short" || outline?.kind === "short-story";
  if (isShort) {
    const started = await pathExists(scriptJsonPath(slug));
    // 短篇默认不要求剧本；仅 AUTO_SCRIPT / meta.autoScript / 已开写剧本时才视为待补齐
    if (!isAutoScriptEnabled() && !meta.autoScript && !started) return false;
  }
  const planned = meta.totalChapters || flattenChapters(outline || { volumes: [] }).length;
  if (!planned) return false;
  if (!(await pathExists(scriptJsonPath(slug)))) return true;
  const script = await readJson(scriptJsonPath(slug));
  if (!hasSeriesBible(script)) return true;
  const done =
    script.stats?.completedEpisodes ||
    (script.episodeIndex || []).filter((e) => e.status === "done").length ||
    (await countEpisodeFiles(slug));
  return done < planned;
}

async function generateSeriesBible({ meta, outline, script, onProgress }) {
  const language = outline.language || meta.language || "zh";
  onProgress("正在生成视频剧「系列设定」（角色卡/场景库/美术音频 bible）…");
  const payload = await chatJson({
    kind: "outline",
    maxCompletionTokens: 8_000,
    onProgress,
    messages: [
      { role: "system", content: editorSystemFor(language) },
      {
        role: "user",
        content: scriptSeriesBiblePrompt(outline, {
          aspectRatio: SCRIPT_ASPECT_RATIO,
          defaultEpisodeSec: SCRIPT_DEFAULT_EPISODE_SEC,
        }),
      },
    ],
  });

  script.schemaVersion = SCRIPT_SCHEMA_VERSION;
  script.kind = "novel-video-script";
  script.production = payload.production || script.production;
  script.visualBible = payload.visualBible || {};
  script.audioBible = payload.audioBible || {};
  script.cast = Array.isArray(payload.cast) ? payload.cast : [];
  script.locations = Array.isArray(payload.locations) ? payload.locations : [];
  script.props = Array.isArray(payload.props) ? payload.props : [];
  script.continuityRules = Array.isArray(payload.continuityRules) ? payload.continuityRules : [];
  script.episodePolicy = payload.episodePolicy || script.episodePolicy;
  script.stats = {
    ...(script.stats || {}),
    bibleReady: true,
    updatedAt: new Date().toISOString(),
  };

  if (!script.cast.length) {
    throw new Error("系列设定未返回角色卡，请重试剧本生成。");
  }

  await persistScript(meta.slug, script);
  await writeText(path.join(scriptDir(meta.slug), "00-系列设定.md"), renderScriptSeriesMarkdown(script));
  onProgress(`系列设定已写入：${scriptDir(meta.slug)}`);
  return script;
}

function normalizeEpisode(raw, chapter, seriesBible) {
  const index = Number(raw.index) || Number(chapter.globalIndex) || 1;
  const id = raw.id || `ep_${String(index).padStart(3, "0")}`;
  const scenes = Array.isArray(raw.scenes) ? raw.scenes : [];
  return {
    schemaVersion: SCRIPT_SCHEMA_VERSION,
    kind: "novel-video-episode",
    index,
    id,
    title: String(raw.title || chapter.title || `第${index}集`).slice(0, 80),
    chapterRef: {
      chapterId: chapter.id,
      volumeIndex: chapter.volumeIndex,
      chapterIndex: chapter.index,
      globalIndex: chapter.globalIndex,
      chapterTitle: chapter.title || "",
      ...(raw.chapterRef || {}),
    },
    durationSec: Number(raw.durationSec) || seriesBible.production?.defaultEpisodeDurationSec || SCRIPT_DEFAULT_EPISODE_SEC,
    logline: String(raw.logline || "").slice(0, 200),
    plotSummary: String(raw.plotSummary || chapter.summary || "").slice(0, 600),
    emotionalArc: String(raw.emotionalArc || "").slice(0, 200),
    hookOpen: String(raw.hookOpen || "").slice(0, 200),
    hookClose: String(raw.hookClose || chapter.endingHook || "").slice(0, 200),
    castInEpisode: Array.isArray(raw.castInEpisode) ? raw.castInEpisode : [],
    locationsUsed: Array.isArray(raw.locationsUsed) ? raw.locationsUsed : [],
    propsUsed: Array.isArray(raw.propsUsed) ? raw.propsUsed : [],
    bgmSuggestion: String(raw.bgmSuggestion || "").slice(0, 120),
    scenes: scenes.map((sc, i) => ({
      id: sc.id || `sc_${String(i + 1).padStart(2, "0")}`,
      index: Number(sc.index) || i + 1,
      title: String(sc.title || "").slice(0, 80),
      locationId: sc.locationId || "",
      locationName: sc.locationName || "",
      timeOfDay: sc.timeOfDay || "",
      weather: sc.weather || "",
      atmosphere: String(sc.atmosphere || "").slice(0, 120),
      plot: String(sc.plot || "").slice(0, 400),
      conflict: String(sc.conflict || "").slice(0, 200),
      characters: Array.isArray(sc.characters) ? sc.characters : [],
      dialogue: Array.isArray(sc.dialogue) ? sc.dialogue : [],
      action: String(sc.action || "").slice(0, 400),
      shots: Array.isArray(sc.shots)
        ? sc.shots.map((sh, j) => ({
            id: sh.id || `sh_${String(j + 1).padStart(2, "0")}`,
            index: Number(sh.index) || j + 1,
            durationSec: Number(sh.durationSec) || 3,
            shotType: sh.shotType || "medium",
            cameraMove: sh.cameraMove || "static",
            lens: sh.lens || "35mm",
            composition: String(sh.composition || "").slice(0, 160),
            action: String(sh.action || "").slice(0, 300),
            dialogue: sh.dialogue || null,
            visualPrompt: String(sh.visualPrompt || "").slice(0, 800),
            videoPrompt: String(sh.videoPrompt || "").slice(0, 800),
            negativePrompt: String(sh.negativePrompt || "text, watermark, logo").slice(0, 200),
            audio: sh.audio || { vo: "", sfx: "", bgm: "" },
            transition: sh.transition || "cut",
          }))
        : [],
    })),
    createdAt: new Date().toISOString(),
  };
}

async function persistScript(slug, script) {
  script.stats = {
    ...(script.stats || {}),
    completedEpisodes: (script.episodeIndex || []).filter((e) => e.status === "done").length,
    plannedEpisodes: (script.episodeIndex || []).length,
    updatedAt: new Date().toISOString(),
  };
  await writeJson(scriptJsonPath(slug), script);
}

async function saveEpisodeFiles(slug, episode) {
  const jsonPath = scriptEpisodePath(slug, episode);
  await writeJson(jsonPath, episode);
  const mdPath = jsonPath.replace(/\.json$/i, ".md");
  await writeText(mdPath, renderScriptEpisodeMarkdown(episode));
  return path.basename(jsonPath);
}

async function readPreviousTail(slug, beforeIndex) {
  if (beforeIndex <= 1) return "";
  const dir = scriptEpisodesDir(slug);
  if (!(await pathExists(dir))) return "";
  // find nearest previous done episode file by scanning script index later; here try common path pattern via script.json
  const script = await readJson(scriptJsonPath(slug));
  const prev = (script.episodeIndex || [])
    .filter((e) => e.status === "done" && e.index < beforeIndex)
    .sort((a, b) => b.index - a.index)[0];
  if (!prev?.file) return "";
  const file = path.join(dir, prev.file);
  if (!(await pathExists(file))) return "";
  const ep = await readJson(file);
  return `ep#${ep.index} hookClose=${ep.hookClose || ""}; lastScene=${ep.scenes?.at?.(-1)?.plot || ""}`;
}

async function generateEpisodeBatch({ meta, outline, script, chapters, onProgress }) {
  const language = outline.language || meta.language || "zh";
  const start = chapters[0].globalIndex;
  const end = chapters[chapters.length - 1].globalIndex;
  onProgress(`正在生成分集剧本 第${start}–${end}集（含场景/分镜/对白/画面提示）…`);

  const previousEpisodeTail = await readPreviousTail(meta.slug, start);
  const payload = await chatJson({
    kind: "outline",
    maxCompletionTokens: 10_000,
    onProgress,
    messages: [
      { role: "system", content: editorSystemFor(language) },
      {
        role: "user",
        content: scriptEpisodesBatchPrompt({
          bible: outline,
          seriesBible: script,
          chapters,
          previousEpisodeTail,
        }),
      },
    ],
  });

  const rawList = Array.isArray(payload.episodes) ? payload.episodes : [];
  if (!rawList.length) {
    throw new Error(`分集剧本第${start}–${end}集未返回内容。`);
  }

  const byGlobal = new Map(rawList.map((ep) => [Number(ep.index) || Number(ep.chapterRef?.globalIndex), ep]));
  const saved = [];
  for (const chapter of chapters) {
    const raw =
      byGlobal.get(chapter.globalIndex) ||
      rawList.find((ep) => ep.chapterRef?.chapterId === chapter.id) ||
      rawList[saved.length];
    if (!raw) {
      throw new Error(`缺少第${chapter.globalIndex}集剧本。`);
    }
    const episode = normalizeEpisode(raw, chapter, script);
    if (!episode.scenes.length) {
      throw new Error(`第${episode.index}集缺少场景。`);
    }
    const fileName = await saveEpisodeFiles(meta.slug, episode);
    const slot = (script.episodeIndex || []).find((e) => e.index === episode.index);
    if (slot) {
      slot.status = "done";
      slot.title = episode.title;
      slot.file = fileName;
      slot.id = episode.id;
    }
    saved.push(episode);
  }

  await persistScript(meta.slug, script);
  await writeText(path.join(scriptDir(meta.slug), "00-系列设定.md"), renderScriptSeriesMarkdown(script));
  onProgress(`已完成分集 ${saved.map((e) => e.index).join(", ")} → ${scriptEpisodesDir(meta.slug)}`);
  return saved;
}

/**
 * 为小说生成/续写完整视频剧本（系列设定 + 全部分集分镜）。
 * 可断点续跑；force=true 时重建系列设定并重做全部分集。
 */
export async function generateScriptForNovel(
  slug,
  { force = false, limit = Infinity, onProgress = print } = {},
) {
  const { meta, outline } = await loadNovel(slug);
  if (!outline?.volumes?.length) {
    throw new Error(`《${meta.title || slug}》尚无完整大纲，无法生成剧本。`);
  }

  await ensureDir(scriptDir(slug));
  await ensureDir(scriptEpisodesDir(slug));

  let script = await loadOrInitScript(slug, meta, outline);

  if (force) {
    onProgress("强制重建剧本：将重新生成系列设定与分集…");
    const { rm } = await import("node:fs/promises");
    if (await pathExists(scriptEpisodesDir(slug))) {
      await rm(scriptEpisodesDir(slug), { recursive: true, force: true });
      await ensureDir(scriptEpisodesDir(slug));
    }
    script = emptySeriesShell({ meta, outline });
  }

  if (!hasSeriesBible(script)) {
    script = await generateSeriesBible({ meta, outline, script, onProgress });
  } else {
    onProgress("系列设定已在，跳过（加 --force 可重建）。");
  }

  const chapters = flattenChaptersWithVolume(outline);
  const pending = chapters.filter((c) => {
    const slot = (script.episodeIndex || []).find((e) => e.index === c.globalIndex);
    return !slot || slot.status !== "done";
  });

  if (!pending.length) {
    onProgress(`《${meta.title}》剧本已齐：${chapters.length} 集。目录：${scriptDir(slug)}`);
    meta.scriptDir = "剧本";
    meta.scriptStatus = "done";
    meta.scriptEpisodes = chapters.length;
    meta.scriptCompleted = chapters.length;
    await saveMeta(meta);
    return { meta, script, produced: 0, skipped: true };
  }

  let produced = 0;
  for (let i = 0; i < pending.length && produced < limit; i += SCRIPT_EPISODE_BATCH) {
    const remain = Math.min(SCRIPT_EPISODE_BATCH, limit - produced, pending.length - i);
    const batch = pending.slice(i, i + remain);
    await generateEpisodeBatch({ meta, outline, script, chapters: batch, onProgress });
    produced += batch.length;

    meta.scriptDir = "剧本";
    meta.scriptStatus = "producing";
    meta.scriptEpisodes = chapters.length;
    meta.scriptCompleted = (script.episodeIndex || []).filter((e) => e.status === "done").length;
    await saveMeta(meta);
  }

  const completed = (script.episodeIndex || []).filter((e) => e.status === "done").length;
  meta.scriptDir = "剧本";
  meta.scriptStatus = completed >= chapters.length ? "done" : "producing";
  meta.scriptEpisodes = chapters.length;
  meta.scriptCompleted = completed;
  await saveMeta(meta);

  onProgress(
    `《${meta.title}》剧本进度：${completed}/${chapters.length} 集 → ${scriptDir(slug)}` +
      (completed >= chapters.length ? "（已齐）" : "（可续跑）"),
  );

  return { meta, script, produced, skipped: false };
}

export async function listScriptEpisodeFiles(slug) {
  const dir = scriptEpisodesDir(slug);
  if (!(await pathExists(dir))) return [];
  const { readdir } = await import("node:fs/promises");
  const files = await readdir(dir);
  return files.filter((name) => /^第\d+集-.*\.json$/i.test(name)).sort();
}
