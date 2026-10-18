import path from "node:path";
import { getModel, ROOT, isAutoScriptEnabled } from "./config.js";
import { formatGenreBrief, pickRandomGenre } from "./genres.js";
import { generateShortOutline, produceShortStory } from "./shortStory.js";
import { generateScriptForNovel, isScriptIncomplete } from "./script.js";
import {
  emptyMemory,
  ensureDir,
  listNovels,
  loadNovel,
  novelDir,
  outlineDir,
  pathExists,
  readJson,
  saveMemory,
  saveMeta,
  writeJson,
} from "./store.js";
import { draftFolderName } from "./text.js";

export const FACTORY_STATE_PATH = path.join(ROOT, "factory-state.json");
/** 短篇工厂：每本一次写完；波次凑齐 COHORT_SIZE 本后进入下一波开新篇 */
export const SESSION_CHAPTERS = 1;
export const COHORT_SIZE = 10;

function print(msg) {
  console.log(msg);
}

function isOutlineIncomplete(meta, outline) {
  if (["draft", "outlining"].includes(meta.status)) return true;
  // 短篇：看 beats；旧长篇有 volumes 的不再纳入短篇工厂续办
  if (meta.product === "short" || outline?.kind === "short-story") {
    return !(outline?.beats?.length);
  }
  if (outline?.volumes?.length && (meta.totalChapters || 0) > 1) {
    return false;
  }
  return !(outline?.beats?.length);
}

function needsBody(meta, outline) {
  if (meta.status === "done") return false;
  if (!["approved", "producing", "paused", "review"].includes(meta.status)) return false;
  if (outline?.kind !== "short-story" && meta.product !== "short" && (meta.totalChapters || 0) > 1) {
    return false;
  }
  return !(meta.writtenChapters || []).includes("full");
}

/**
 * 扫描中断项。优先级：大纲 → 待审 → 正文 → 剧本（仅开启时）
 */
export async function scanInterruptedJobs({ sessionSize = SESSION_CHAPTERS } = {}) {
  void sessionSize;
  const novels = await listNovels();
  const jobs = [];

  for (const novel of novels) {
    const { meta, outline } = await loadNovel(novel.slug);

    if (isOutlineIncomplete(meta, outline)) {
      jobs.push({
        kind: "outline",
        slug: meta.slug,
        title: meta.title || meta.slug,
        status: meta.status,
        detail: "短篇总纲未完成",
        priority: 10,
      });
      continue;
    }

    if (meta.status === "review") {
      jobs.push({
        kind: "approve",
        slug: meta.slug,
        title: meta.title || meta.slug,
        status: meta.status,
        detail: "总纲待审，工厂将自动通过",
        priority: 20,
      });
    }

    if (needsBody(meta, outline)) {
      jobs.push({
        kind: "body",
        slug: meta.slug,
        title: meta.title || meta.slug,
        status: meta.status,
        detail: "短篇正文未写完",
        priority: 40,
      });
    }

    if (await isScriptIncomplete(meta.slug, meta, outline)) {
      const done = meta.scriptCompleted || 0;
      const total = meta.scriptEpisodes || 1;
      jobs.push({
        kind: "script",
        slug: meta.slug,
        title: meta.title || meta.slug,
        status: meta.status,
        detail: `剧本未齐（${done}/${total}）`,
        priority: 50,
      });
    }
  }

  jobs.sort((a, b) => a.priority - b.priority || String(a.slug).localeCompare(String(b.slug)));
  return jobs;
}

async function resumeOutlineJob(job, { onProgress = print } = {}) {
  const { meta } = await loadNovel(job.slug);
  onProgress(`\n续办短篇总纲：《${meta.title || meta.slug}》…`);
  const result = await generateShortOutline({
    slug: meta.slug,
    meta,
    genre: meta.genre,
    extra: meta.extra,
    genreBrief: meta.genreBrief || "",
    onProgress,
  });
  result.meta.status = "approved";
  result.meta.approvedAt = new Date().toISOString();
  result.meta.factoryManaged = true;
  await saveMeta(result.meta);
  onProgress(`《${result.meta.title}》总纲已续完并自动通过。`);
  return result.meta;
}

async function resumeApproveJob(job, { onProgress = print } = {}) {
  const { meta } = await loadNovel(job.slug);
  meta.status = "approved";
  meta.approvedAt = new Date().toISOString();
  meta.factoryManaged = true;
  await saveMeta(meta);
  onProgress(`《${meta.title}》总纲自动通过。`);
  return meta;
}

async function resumeScriptJob(job, { onProgress = print } = {}) {
  onProgress(`\n续办剧本：《${job.title}》…`);
  await generateScriptForNovel(job.slug, { onProgress });
  const { meta } = await loadNovel(job.slug);
  return meta;
}

async function resumeBodyJob(job, { onProgress = print } = {}) {
  let { meta, outline } = await loadNovel(job.slug);
  if (meta.status === "review") {
    meta = await resumeApproveJob(job, { onProgress });
    ({ outline } = await loadNovel(meta.slug));
  }
  if (!["approved", "producing", "paused"].includes(meta.status)) {
    onProgress(`《${meta.title}》状态=${meta.status}，跳过正文。`);
    return meta;
  }
  onProgress(`\n续写短篇正文：《${meta.title}》…`);
  const result = await produceShortStory({
    slug: meta.slug,
    meta,
    outline,
    onProgress,
    withScript: false,
  });
  return result.meta;
}

export async function resumeInterruptedWork({
  once = false,
  onProgress = print,
  sessionSize = SESSION_CHAPTERS,
} = {}) {
  let handled = 0;
  const failedKeys = new Set();

  while (true) {
    const jobs = (await scanInterruptedJobs({ sessionSize })).filter(
      (job) => !failedKeys.has(`${job.kind}:${job.slug}`),
    );
    if (!jobs.length) {
      if (handled === 0) onProgress("未发现上次中断或未完成的流程，可开新短篇。");
      else onProgress(`中断续办完成，共处理 ${handled} 项。`);
      return { handled, remaining: (await scanInterruptedJobs({ sessionSize })).length };
    }

    if (handled === 0) {
      onProgress(`\n发现未完成流程，优先续办后再开新篇（本轮可见 ${jobs.length} 项）：`);
      for (const job of jobs.slice(0, 12)) {
        onProgress(`  - [${job.kind}] 《${job.title}》 ${job.detail}`);
      }
      if (jobs.length > 12) onProgress(`  …其余 ${jobs.length - 12} 项`);
    }

    const job = jobs[0];
    const key = `${job.kind}:${job.slug}`;
    onProgress(`\n→ 续办 [${job.kind}] 《${job.title}》`);

    try {
      if (job.kind === "outline") {
        const meta = await resumeOutlineJob(job, { onProgress });
        const latest = await loadNovel(meta.slug);
        if (needsBody(latest.meta, latest.outline)) {
          await produceShortStory({
            slug: latest.meta.slug,
            meta: latest.meta,
            outline: latest.outline,
            onProgress,
          });
        }
      } else if (job.kind === "approve") {
        const meta = await resumeApproveJob(job, { onProgress });
        const latest = await loadNovel(meta.slug);
        if (needsBody(latest.meta, latest.outline)) {
          await produceShortStory({
            slug: latest.meta.slug,
            meta: latest.meta,
            outline: latest.outline,
            onProgress,
          });
        }
      } else if (job.kind === "script") {
        await resumeScriptJob(job, { onProgress });
      } else if (job.kind === "body") {
        await resumeBodyJob(job, { onProgress });
      }
    } catch (error) {
      failedKeys.add(key);
      onProgress(`续办失败，暂时跳过 [${job.kind}] 《${job.title}》：${error.message}`);
    }

    handled += 1;
    if (once) {
      const remaining = (await scanInterruptedJobs({ sessionSize })).length;
      onProgress(`本轮只续办 1 项，剩余 ${remaining} 项。`);
      return { handled, remaining };
    }
  }
}

export function chaptersToNextMilestone() {
  return 1;
}

export function factoryBatchSize() {
  return 1;
}

export function defaultFactoryState() {
  return {
    phase: "spawn",
    sessionSize: SESSION_CHAPTERS,
    cohortSize: COHORT_SIZE,
    books: [],
    rotateIndex: 0,
    spawnedInWave: 0,
    wave: 1,
    product: "short",
    updatedAt: new Date().toISOString(),
  };
}

export async function loadFactoryState() {
  if (await pathExists(FACTORY_STATE_PATH)) {
    const raw = await readJson(FACTORY_STATE_PATH);
    return {
      ...defaultFactoryState(),
      ...raw,
      sessionSize: SESSION_CHAPTERS,
      cohortSize: COHORT_SIZE,
      product: "short",
    };
  }
  return defaultFactoryState();
}

export async function saveFactoryState(state) {
  state.updatedAt = new Date().toISOString();
  state.product = "short";
  await writeJson(FACTORY_STATE_PATH, state);
  return state;
}

export async function syncFactoryBooks(state) {
  const novels = await listNovels();
  const known = new Set(state.books);
  for (const novel of novels) {
    if (!known.has(novel.slug)) {
      state.books.push(novel.slug);
      known.add(novel.slug);
    }
  }
  state.books = state.books.filter((slug) => novels.some((n) => n.slug === slug));
  return state;
}

async function createNewShort({ onProgress = print } = {}) {
  const novels = await listNovels();
  const pick = pickRandomGenre({
    recentlyUsed: novels.map((n) => n.genre || n.genreLabel || ""),
    recentlyUsedLanguages: novels.map((n) => n.language).filter(Boolean),
  });
  const genreBrief = formatGenreBrief(pick);
  const slug = draftFolderName();
  const untitled = pick.localeInfo?.untitled || "未命名";
  const meta = {
    slug,
    title: untitled,
    language: pick.language,
    locale: pick.locale,
    market: pick.market,
    cultureBrief: pick.cultureBrief,
    genre: pick.label,
    genreLabel: pick.label,
    genreBrief,
    product: "short",
    status: "draft",
    targetWordCount: 0,
    model: getModel(),
    autoPick: true,
    autoScript: isAutoScriptEnabled(),
    extra: `短篇工厂自动开篇。语言=${pick.localeInfo?.languageName || pick.language}。大类「${pick.genre}」细分「${pick.flavor}」。大师级短篇：逻辑严谨、引人入胜、跌宕起伏，可用诙谐幽默；禁止注水凑字。手法：${pick.structureNotes.join("；")}`,
    createdAt: new Date().toISOString(),
    writtenChapters: [],
    writtenChars: 0,
    factoryManaged: true,
    totalChapters: 1,
    totalVolumes: 1,
  };

  await ensureDir(outlineDir(slug));
  await saveMeta(meta);
  await saveMemory(slug, emptyMemory());
  onProgress(`\n工厂开新短篇，草稿：${novelDir(slug)}`);
  onProgress(`选题：${pick.localeInfo?.languageName || pick.language} · ${pick.label}`);
  onProgress(`手法：${pick.structureNotes.join("；")}`);

  const result = await generateShortOutline({
    slug,
    meta,
    genre: pick.label,
    extra: meta.extra,
    genreBrief,
    onProgress,
  });

  result.meta.status = "approved";
  result.meta.approvedAt = new Date().toISOString();
  result.meta.factoryManaged = true;
  result.meta.genreLabel = pick.label;
  result.meta.genreBrief = genreBrief;
  result.meta.product = "short";
  result.meta.autoScript = isAutoScriptEnabled();
  await saveMeta(result.meta);

  onProgress(`《${result.meta.title}》总纲已通过，开始写正文…`);
  const produced = await produceShortStory({
    slug: result.meta.slug,
    meta: result.meta,
    outline: result.outline,
    onProgress,
    withScript: isAutoScriptEnabled(),
  });
  return produced.meta;
}

async function spawnPhase(state, { onProgress = print, once = false } = {}) {
  while (state.spawnedInWave < state.cohortSize) {
    const interrupted = await scanInterruptedJobs({ sessionSize: state.sessionSize });
    if (interrupted.length) {
      await resumeInterruptedWork({
        once: true,
        onProgress,
        sessionSize: state.sessionSize,
      });
      if (once) return state;
      continue;
    }

    if (state.books.length >= state.cohortSize * state.wave) {
      break;
    }

    const created = await createNewShort({ onProgress });
    if (!state.books.includes(created.slug)) {
      state.books.push(created.slug);
    }
    state.spawnedInWave += 1;
    await saveFactoryState(state);
    if (once) return state;
  }

  state.phase = "spawn";
  state.wave += 1;
  state.spawnedInWave = 0;
  state.rotateIndex = 0;
  onProgress(`\n本波已凑齐约 ${state.cohortSize} 篇短篇，开始下一波开新篇。`);
  await saveFactoryState(state);
  return state;
}

export async function runFactory({
  once = false,
  loops = Infinity,
  onProgress = print,
} = {}) {
  let state = await loadFactoryState();
  state = await syncFactoryBooks(state);

  if (!state.books.length) {
    onProgress("短篇工厂队列为空，将从开新篇开始。");
  } else {
    onProgress(`工厂已登记 ${state.books.length} 篇：${state.books.join("、")}`);
  }

  onProgress("\n—— 启动检查：是否有上次未完成或中断的流程 ——");
  const resumeResult = await resumeInterruptedWork({
    once,
    onProgress,
    sessionSize: state.sessionSize,
  });
  if (once && resumeResult.handled > 0) {
    state = await loadFactoryState();
    onProgress(
      `\n工厂本轮结束（仅续办）。phase=${state.phase} wave=${state.wave} 登记=${state.books.length}`,
    );
    return state;
  }

  await saveFactoryState(state);

  let steps = 0;
  const maxSteps = Number.isFinite(loops) ? loops : once ? 1 : Number.MAX_SAFE_INTEGER;

  while (steps < maxSteps) {
    state = await loadFactoryState();
    state = await syncFactoryBooks(state);

    const pending = await scanInterruptedJobs({ sessionSize: state.sessionSize });
    if (pending.length) {
      onProgress(`\n仍有 ${pending.length} 项未完成，继续优先续办…`);
      await resumeInterruptedWork({ once: true, onProgress, sessionSize: state.sessionSize });
      steps += 1;
      if (once) break;
      continue;
    }

    onProgress(`\n====== 短篇工厂：wave=${state.wave} books=${state.books.length} spawned=${state.spawnedInWave} ======`);
    await spawnPhase(state, { onProgress, once: true });
    steps += 1;
    if (once) break;
  }

  state = await loadFactoryState();
  onProgress(
    `\n工厂本轮结束。wave=${state.wave} 登记篇目=${state.books.length}\n详情见 factory-state.json`,
  );
  return state;
}

export async function factoryStatus() {
  let state = await loadFactoryState();
  state = await syncFactoryBooks(state);
  const interrupted = await scanInterruptedJobs({ sessionSize: state.sessionSize });
  const rows = [];
  for (const slug of state.books) {
    const { meta } = await loadNovel(slug);
    rows.push({
      slug,
      title: meta.title,
      status: meta.status,
      product: meta.product || "short",
      written: meta.writtenChars || 0,
      nextBatch: meta.status === "done" ? 0 : 1,
    });
  }
  return { state, rows, interrupted };
}
