import fs from "node:fs/promises";
import path from "node:path";
import { CONTENT_DIR } from "./config.js";
import { chapterFileName, folderNameFromTitle, sanitizeName, volumeDirName } from "./text.js";

export function novelDir(slug) {
  return path.join(CONTENT_DIR, slug);
}

export function outlineDir(slug) {
  return path.join(novelDir(slug), "大纲");
}

export function bodyDir(slug) {
  return path.join(novelDir(slug), "正文");
}

export function coverDir(slug) {
  return path.join(novelDir(slug), "封面");
}

export function scriptDir(slug) {
  return path.join(novelDir(slug), "剧本");
}

export function scriptJsonPath(slug) {
  return path.join(scriptDir(slug), "script.json");
}

export function scriptEpisodesDir(slug) {
  return path.join(scriptDir(slug), "分集");
}

export function scriptEpisodePath(slug, episode) {
  const index = Number(episode.index) || 1;
  const title = sanitizeName(episode.title || `第${index}集`, `集${index}`);
  return path.join(scriptEpisodesDir(slug), `第${String(index).padStart(3, "0")}集-${title}.json`);
}

export function metaPath(slug) {
  return path.join(novelDir(slug), "meta.json");
}

export function outlineJsonPath(slug) {
  return path.join(outlineDir(slug), "outline.json");
}

export function memoryPath(slug) {
  return path.join(novelDir(slug), "状态", "memory.json");
}

export async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

export async function writeJson(file, data) {
  await ensureDir(path.dirname(file));
  await fs.writeFile(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export async function readJson(file) {
  const raw = await fs.readFile(file, "utf8");
  return JSON.parse(raw);
}

export async function writeText(file, text) {
  await ensureDir(path.dirname(file));
  await fs.writeFile(file, text.endsWith("\n") ? text : `${text}\n`, "utf8");
}

export async function pathExists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function uniqueFolderName(base) {
  let name = base;
  let i = 2;
  while (await pathExists(novelDir(name))) {
    name = `${base}-${i}`;
    i += 1;
  }
  return name;
}

export async function renameNovelToTitle(meta, title) {
  const nextTitle = sanitizeName(title, meta.title || "未命名");
  if (!nextTitle || nextTitle === "未命名") {
    meta.title = nextTitle || meta.title;
    await saveMeta(meta);
    return meta;
  }

  const desired = folderNameFromTitle(nextTitle);
  let nextSlug = desired;
  if (nextSlug !== meta.slug) {
    if (await pathExists(novelDir(nextSlug))) {
      nextSlug = await uniqueFolderName(desired);
    }
    const from = novelDir(meta.slug);
    const to = novelDir(nextSlug);
    await fs.rename(from, to);
    if (meta.lastChapterFile) {
      meta.lastChapterFile = String(meta.lastChapterFile).split(meta.slug).join(nextSlug);
    }
    meta.slug = nextSlug;
  }

  meta.title = nextTitle;
  await saveMeta(meta);
  return meta;
}

export async function listNovels() {
  await ensureDir(CONTENT_DIR);
  const entries = await fs.readdir(CONTENT_DIR, { withFileTypes: true });
  const novels = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const file = metaPath(entry.name);
    if (!(await pathExists(file))) continue;
    novels.push(await readJson(file));
  }
  return novels.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export async function loadNovel(slug) {
  const meta = await readJson(metaPath(slug));
  const outline = (await pathExists(outlineJsonPath(slug)))
    ? await readJson(outlineJsonPath(slug))
    : null;
  const memory = (await pathExists(memoryPath(slug)))
    ? await readJson(memoryPath(slug))
    : emptyMemory();
  return { meta, outline, memory };
}

export function emptyMemory() {
  return {
    timeline: "",
    characterStates: [],
    unresolvedHooks: [],
    revealedSecrets: [],
    recentEvents: [],
    relationships: [],
    lastChapterEnding: "",
  };
}

export async function saveMeta(meta) {
  meta.updatedAt = new Date().toISOString();
  await writeJson(metaPath(meta.slug), meta);
  return meta;
}

export async function saveOutline(slug, outline) {
  await writeJson(outlineJsonPath(slug), outline);
}

export async function saveMemory(slug, memory) {
  await writeJson(memoryPath(slug), memory);
}

export function chapterAbsPath(slug, volume, chapter) {
  return path.join(bodyDir(slug), volumeDirName(volume), chapterFileName(chapter));
}

export async function chapterWritten(slug, volume, chapter) {
  return pathExists(chapterAbsPath(slug, volume, chapter));
}

export async function readChapter(slug, volume, chapter) {
  return fs.readFile(chapterAbsPath(slug, volume, chapter), "utf8");
}

export function flattenChapters(outline) {
  const list = [];
  for (const volume of outline.volumes || []) {
    for (const chapter of volume.chapters || []) {
      list.push({ volume, chapter });
    }
  }
  return list;
}

export function findNextChapter(outline, meta) {
  const all = flattenChapters(outline);
  const done = new Set(meta.writtenChapters || []);
  return all.find(({ chapter }) => !done.has(chapter.id));
}

export function volumeOutlinePath(slug, volume) {
  return path.join(outlineDir(slug), "分卷", `${volumeDirName(volume)}.md`);
}

export function novelDisplayName(meta) {
  return `${sanitizeName(meta.title, meta.slug)}（${meta.slug}）`;
}
