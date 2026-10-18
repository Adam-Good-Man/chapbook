import { isCoverProductionEnabled } from "./config.js";
import { generateCoversForNovel, listExistingCovers } from "./covers.js";
import { generateScriptForNovel, isScriptIncomplete } from "./script.js";
import { listNovels, loadNovel } from "./store.js";

function print(msg) {
  console.log(msg);
}

function hasUsableOutline(meta, outline) {
  if (["draft", "outlining"].includes(meta.status)) return false;
  if (meta.product === "short" || outline?.kind === "short-story") {
    return Boolean(outline?.beats?.length);
  }
  if (!outline?.volumes?.length) return false;
  const chapters = outline.volumes.reduce((n, v) => n + (v.chapters?.length || 0), 0);
  return chapters > 0;
}

/**
 * 扫描已有书籍中「后来新增能力」仍缺失的部分。
 * @returns {Promise<Array<{ slug, title, status, gaps: string[], details: string[] }>>}
 */
export async function scanBackfillGaps({ slug } = {}) {
  const novels = slug ? [{ slug }] : await listNovels();
  const rows = [];

  for (const novel of novels) {
    const targetSlug = novel.slug;
    const { meta, outline } = await loadNovel(targetSlug);
    if (!hasUsableOutline(meta, outline)) {
      rows.push({
        slug: meta.slug,
        title: meta.title || meta.slug,
        status: meta.status,
        gaps: ["outline"],
        details: ["大纲未完成，跳过补齐（请先 resume 大纲）"],
        actionable: false,
      });
      continue;
    }

    const gaps = [];
    const details = [];

    // 封面已关闭，不再作为缺失项
    if (isCoverProductionEnabled()) {
      const coverFiles = await listExistingCovers(meta.slug);
      if (coverFiles.length < 1) {
        gaps.push("covers");
        details.push(`封面 ${coverFiles.length}/1`);
      }
    }

    if (await isScriptIncomplete(meta.slug, meta, outline)) {
      gaps.push("script");
      const done = meta.scriptCompleted || 0;
      const total =
        meta.scriptEpisodes ||
        meta.totalChapters ||
        (outline.volumes || []).reduce((n, v) => n + (v.chapters?.length || 0), 0) ||
        1;
      details.push(`剧本 ${done}/${total} 集`);
    }

    rows.push({
      slug: meta.slug,
      title: meta.title || meta.slug,
      status: meta.status,
      gaps,
      details,
      actionable: gaps.length > 0,
    });
  }

  return rows;
}

/**
 * 一键补齐已有书缺失的封面、剧本等。
 * @param {{ slug?: string, only?: 'covers'|'script', dry?: boolean, onProgress?: Function }} opts
 */
export async function backfillNovels({
  slug,
  only,
  dry = false,
  onProgress = print,
} = {}) {
  const onlySet = only ? new Set(String(only).split(",").map((s) => s.trim()).filter(Boolean)) : null;
  const rows = await scanBackfillGaps({ slug });
  const todo = rows.filter((row) => {
    if (!row.actionable) return false;
    if (!onlySet) return true;
    return row.gaps.some((g) => onlySet.has(g));
  });

  onProgress(
    dry
      ? `\n【预览】将补齐 ${todo.length} 本（共扫描 ${rows.length} 本）`
      : `\n开始补齐：${todo.length} 本有缺失（共扫描 ${rows.length} 本）`,
  );

  for (const row of rows) {
    if (!row.actionable) {
      onProgress(`- 《${row.title}》[${row.status}] 跳过：${row.details.join("；") || "大纲未就绪"}`);
      continue;
    }
    if (onlySet && !row.gaps.some((g) => onlySet.has(g))) {
      onProgress(`- 《${row.title}》无匹配项（缺口：${row.gaps.join(",") || "无"}），跳过`);
      continue;
    }
    onProgress(`- 《${row.title}》缺口：${row.details.join("；")}`);
  }

  if (dry) {
    onProgress(todo.length ? "\n预览结束。去掉 --dry 即可真正补齐。" : "\n没有需要补齐的项目。");
    return { scanned: rows.length, todo: todo.length, done: 0, failed: [], dry: true };
  }

  if (!todo.length) {
    onProgress("没有需要补齐的项目。");
    return { scanned: rows.length, todo: 0, done: 0, failed: [], dry: false };
  }

  const failed = [];
  let done = 0;

  for (const row of todo) {
    onProgress(`\n══ 《${row.title}》（${row.slug}）══`);
    const { meta, outline } = await loadNovel(row.slug);
    let bookOk = true;

    const wantCovers = (!onlySet || onlySet.has("covers")) && row.gaps.includes("covers");
    const wantScript = (!onlySet || onlySet.has("script")) && row.gaps.includes("script");

    if (wantCovers) {
      try {
        onProgress("补封面…");
        await generateCoversForNovel(row.slug, { onProgress });
      } catch (error) {
        bookOk = false;
        failed.push({ slug: row.slug, kind: "covers", error: error.message });
        onProgress(`封面失败：${error.message}`);
      }
    }

    if (wantScript) {
      try {
        onProgress("补剧本（系列设定 + 分集分镜，可断点续跑）…");
        await generateScriptForNovel(row.slug, { onProgress });
        // 再确认
        const latest = await loadNovel(row.slug);
        if (await isScriptIncomplete(row.slug, latest.meta, latest.outline || outline)) {
          onProgress("剧本仍未完全齐套（可能中断），下次 backfill / script 可续跑。");
        }
      } catch (error) {
        bookOk = false;
        failed.push({ slug: row.slug, kind: "script", error: error.message });
        onProgress(`剧本失败：${error.message}`);
      }
    }

    if (bookOk) {
      done += 1;
      onProgress(`《${meta.title}》本轮补齐完成。`);
    }
  }

  onProgress(
    `\n补齐结束：成功处理 ${done}/${todo.length} 本` +
      (failed.length ? `；失败 ${failed.length} 项` : ""),
  );
  for (const item of failed) {
    onProgress(`  × [${item.kind}] ${item.slug}: ${item.error}`);
  }

  return { scanned: rows.length, todo: todo.length, done, failed, dry: false };
}
