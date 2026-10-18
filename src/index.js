import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import {
  assertApiKey,
  getModel,
  MIN_SHORT_CHARS,
  MAX_SHORT_CHARS,
  isAutoScriptEnabled,
} from "./config.js";
import { formatGenreBrief, pickRandomGenre, getLocale, formatCultureBrief, GENRE_POOL } from "./genres.js";
import { generateShortOutline, produceShortStory } from "./shortStory.js";
import { getActiveProxy } from "./llm.js";
import {
  emptyMemory,
  ensureDir,
  listNovels,
  loadNovel,
  novelDir,
  outlineDir,
  saveMemory,
  saveMeta,
} from "./store.js";
import { factoryStatus, runFactory } from "./factory.js";
import { generateScriptForNovel, isScriptIncomplete } from "./script.js";
import { backfillNovels } from "./backfill.js";
import { formatNumber, parseArgs, draftFolderName, folderNameFromTitle } from "./text.js";

const HELP = `
短篇小说工厂  ·  模型 ${getModel()}
默认只生产短篇小说（约 ${MIN_SHORT_CHARS}–${MAX_SHORT_CHARS} 字，不凑字、不设默认目标字数）。
默认不出封面与剧本；推理档位见 .env。

用法：
  npm start                         交互菜单
  npm run new -- [--genre 类型] [--title 书名] [--auto] [--extra 补充] [--script]
  npm run list
  npm run status -- [slug]
  npm run approve -- <slug>
  npm run reject -- <slug>
  npm run produce -- <slug> [--script]   写完整短篇正文
  npm run resume -- [slug]               续写未完成的短篇总纲
  npm run factory -- [--once]            工厂：总纲→正文
  npm run factory:status
  npm run script -- <slug> [--force] [--limit N]  按需生成剧本
  npm run backfill -- [slug] [--dry] [--only script]

选题：
  工厂 / --auto：随机中文题材；全部作品固定简体中文。

流程：
  1. new      短篇圣经 → content/<书名>/大纲
  2. 人工审阅
  3. approve
  4. produce  → content/<书名>/正文/全文.md
  5. script   按需
  6. factory  无人值守连开短篇
`;

function print(msg) {
  console.log(msg);
}

function hasOutlineReady(outline) {
  if (!outline) return false;
  if (outline.kind === "short-story" || outline.beats?.length) return outline.beats?.length > 0;
  return Boolean(outline.volumes?.length);
}

async function pickNovel(slugArg, { allowEmpty = false } = {}) {
  if (slugArg) return slugArg;
  const novels = await listNovels();
  if (!novels.length) {
    if (allowEmpty) return null;
    throw new Error("还没有作品。先运行 npm run new");
  }
  if (novels.length === 1) return novels[0].slug;
  print("\n现有作品：");
  novels.forEach((item, i) => {
    const lang = item.language ? ` ${item.language}` : "";
    print(`  ${i + 1}. ${item.title}  [${item.status}]${lang}  ${item.slug}`);
  });
  throw new Error("请在命令后带上 slug，例如：npm run approve -- 书名");
}

async function cmdNew(args, io) {
  assertApiKey();
  const autoPick = Boolean(args.auto);
  const wantScript = Boolean(args.script) || isAutoScriptEnabled();
  let genre = args.genre ? String(args.genre) : "";
  let title = args.title ? String(args.title) : "";
  let extra = args.extra ? String(args.extra) : "";
  let language = "zh";
  if (args.lang && String(args.lang).toLowerCase().trim() !== "zh") {
    print(`已忽略 --lang=${args.lang}：当前仅生产中文作品。`);
  }

  if (io) {
    if (!autoPick && !genre) {
      const mode = (
        await io.question("开篇方式：1) 指定类型  2) 随机选题（中文）  [1/2] ")
      ).trim();
      if (mode === "2") {
        genre = "";
      } else {
        const Lhint = language ? getLocale(language) : getLocale("zh");
        const genreHint = (Lhint.id === "zh" ? GENRE_POOL : Lhint.genres).slice(0, 6).join("/");
        genre = (await io.question(`请输入短篇类型（如 ${genreHint}）：`)).trim();
        if (!genre) throw new Error("指定类型不能为空。");
      }
    }
    if (!title) {
      title = (await io.question("作品名（回车则等总纲完成后由模型拟定）：")).trim();
    }
    if (!extra) {
      extra = (await io.question("补充要求（回车跳过）：")).trim();
    }
  }

  const novels = await listNovels();
  const resolvedAuto = autoPick || !genre;
  let genreBrief = "";
  let genrePick = null;
  if (resolvedAuto && !genre) {
    genrePick = pickRandomGenre({
      language: language || undefined,
      recentlyUsed: novels.map((n) => n.genre || n.genreLabel || ""),
      recentlyUsedLanguages: novels.map((n) => n.language).filter(Boolean),
    });
    language = "zh";
    genre = genrePick.label;
    genreBrief = formatGenreBrief(genrePick);
  }

  language = "zh";
  const L = getLocale("zh");
  const cultureBrief = genrePick?.cultureBrief || formatCultureBrief(L);
  if (!genreBrief) {
    genreBrief = [
      `产品：短篇小说`,
      `语言市场：${L.languageName}｜${L.market}`,
      `大类：${genre || "待模型选题"}`,
      `文化逻辑：\n${cultureBrief}`,
    ].join("\n");
  }

  const slug = title ? folderNameFromTitle(title) : draftFolderName();
  const meta = {
    slug,
    title: title || L.untitled,
    lockedTitle: title || undefined,
    language: L.id,
    locale: L.locale,
    market: L.market,
    cultureBrief,
    genre: genre || "待模型选题",
    genreLabel: genrePick?.label || genre || undefined,
    genreBrief: genreBrief || undefined,
    product: "short",
    status: "draft",
    targetWordCount: 0,
    model: getModel(),
    autoPick: resolvedAuto,
    autoScript: wantScript,
    extra: [
      extra,
      `短篇小说。语言=${L.languageName}。按「${L.market}」读者胃口写；禁止硬套异文化长篇连载模板。`,
      genrePick?.flavor
        ? `大类「${genrePick.genre}」细分「${genrePick.flavor}」。手法：${(genrePick.structureNotes || []).join("；")}`
        : genre
          ? `类型：${genre}。逻辑严谨，引人入胜，跌宕起伏，可用诙谐幽默；禁止注水。`
          : "",
    ]
      .filter(Boolean)
      .join(" "),
    createdAt: new Date().toISOString(),
    writtenChapters: [],
    writtenChars: 0,
    totalChapters: 1,
    totalVolumes: 1,
  };

  await ensureDir(novelDir(slug));
  await ensureDir(outlineDir(slug));
  await saveMeta(meta);
  await saveMemory(slug, emptyMemory());

  print(`\n已创建目录：${novelDir(slug)}`);
  print(`模型：${getModel()}｜产品：短篇小说`);
  print(`语言市场：${L.languageName}｜${L.market}`);
  if (genrePick?.label) {
    print(`题材：${genrePick.label}`);
    if (genrePick.structureNotes?.length) {
      print(`手法：${genrePick.structureNotes.join("；")}`);
    }
  } else if (genre) {
    print(`题材：${genre}`);
  }
  if (getActiveProxy()) print(`代理：${getActiveProxy()}`);
  print(`篇幅：故事写完整即可（自然约 ${MIN_SHORT_CHARS}–${MAX_SHORT_CHARS} 字，不凑字）\n`);

  try {
    const result = await generateShortOutline({
      slug,
      meta,
      genre,
      extra: meta.extra,
      genreBrief,
      onProgress: print,
    });

    print("\n短篇总纲已生成，等待人工审核。");
    print(`请审阅：${outlineDir(result.meta.slug)}`);
    print(`通过后：npm run approve -- ${result.meta.slug}`);
    print(`再生产：npm run produce -- ${result.meta.slug}${wantScript ? " --script" : ""}`);
    return result.meta;
  } catch (error) {
    print(`\n总纲未完成，目录已保留：${novelDir(slug)}`);
    print(`稍后继续：npm run resume -- ${slug}`);
    throw error;
  }
}

async function cmdResume(slugArg) {
  assertApiKey();
  const novels = await listNovels();
  const pending = novels.filter((item) => ["draft", "outlining"].includes(item.status));
  const slug = slugArg || (pending.length === 1 ? pending[0].slug : await pickNovel(slugArg));
  const { meta } = await loadNovel(slug);
  print(`继续生成《${meta.title || slug}》短篇总纲…`);
  if (getActiveProxy()) print(`代理：${getActiveProxy()}`);
  const result = await generateShortOutline({
    slug,
    meta,
    genre: meta.genre,
    extra: meta.extra,
    genreBrief: meta.genreBrief || "",
    onProgress: print,
  });
  print("\n短篇总纲已生成，等待人工审核。");
  print(`请审阅：${outlineDir(result.meta.slug)}`);
  print(`通过后：npm run approve -- ${result.meta.slug}`);
}

async function cmdList() {
  const novels = await listNovels();
  if (!novels.length) {
    print("还没有作品。");
    return;
  }
  for (const item of novels) {
    const chars = formatNumber(item.writtenChars || 0);
    print(
      `${item.slug}\n  《${item.title}》  lang=${item.language || "zh"}  ${item.genre || ""}  状态=${item.status}  字数=${chars}`,
    );
  }
}

async function cmdStatus(slugArg) {
  const slug = await pickNovel(slugArg);
  const { meta, outline } = await loadNovel(slug);
  print(`书名：${meta.title}`);
  print(`slug：${meta.slug}`);
  print(`产品：${meta.product || outline?.kind || "short"}`);
  print(`语言：${meta.language || outline?.language || "zh"}`);
  print(`市场：${meta.market || ""}`);
  print(`类型：${meta.genre}`);
  print(`状态：${meta.status}`);
  print(`模型：${meta.model || getModel()}`);
  print(`字数：${formatNumber(meta.writtenChars || 0)}`);
  if (outline?.logline) print(`一句话：${outline.logline}`);
  if (outline?.coreEmotion) print(`核心情绪：${outline.coreEmotion}`);
  print(
    `剧本：${meta.scriptCompleted || 0} / ${meta.scriptEpisodes || (meta.autoScript || isAutoScriptEnabled() ? 1 : 0)}（${meta.scriptStatus || "未要求"}）`,
  );
  print(`大纲目录：${outlineDir(slug)}`);
  if (meta.lastChapterFile) print(`正文：${meta.lastChapterFile}`);
}

async function cmdApprove(slugArg) {
  const slug = await pickNovel(slugArg);
  const { meta, outline } = await loadNovel(slug);
  if (!hasOutlineReady(outline)) {
    throw new Error("尚未生成短篇总纲，无法审核通过。");
  }
  if (meta.status !== "review" && meta.status !== "rejected") {
    print(`当前状态为 ${meta.status}，仍标记为已通过。`);
  }
  meta.status = "approved";
  meta.approvedAt = new Date().toISOString();
  meta.product = meta.product || "short";
  await saveMeta(meta);
  print(`《${meta.title}》已通过审核。`);

  if (isAutoScriptEnabled() || meta.autoScript) {
    try {
      if (await isScriptIncomplete(slug, meta, outline)) {
        assertApiKey();
        print("AUTO_SCRIPT 已开，生成剧本…");
        await generateScriptForNovel(slug, { onProgress: print, limit: 1 });
      }
    } catch (error) {
      print(`剧本自动生成失败（可稍后 npm run script -- ${slug}）：${error.message}`);
    }
  } else {
    print("默认不生成剧本。需要时：npm run script -- " + slug);
  }

  print(`开始生产：npm run produce -- ${meta.slug}`);
}

async function cmdReject(slugArg) {
  const slug = await pickNovel(slugArg);
  const { meta } = await loadNovel(slug);
  meta.status = "rejected";
  await saveMeta(meta);
  print(`《${meta.title}》已打回。可改大纲后重新 approve，或删目录后重新 new。`);
}

async function cmdFactory(args) {
  assertApiKey();
  if (getActiveProxy()) print(`代理：${getActiveProxy()}`);
  const once = Boolean(args.once);
  await runFactory({ once, onProgress: print });
}

async function cmdFactoryStatus() {
  const { state, rows, interrupted = [] } = await factoryStatus();
  print(`product=short  wave=${state.wave}  spawnedInWave=${state.spawnedInWave}`);
  print(`登记顺序：${state.books.join(" → ") || "（空）"}`);
  if (interrupted.length) {
    print(`\n未完成/中断（下次 factory 优先续办，共 ${interrupted.length} 项）：`);
    for (const job of interrupted) {
      print(`  - [${job.kind}] 《${job.title}》 ${job.detail}`);
    }
  } else {
    print("\n无中断项，可正常开新短篇。");
  }
  print("");
  for (const row of rows) {
    print(
      `- 《${row.title}》[${row.status}] ${row.slug}  已写${formatNumber(row.written)}字`,
    );
  }
}

async function cmdCovers(args) {
  print("封面生产已关闭（COVER_ENABLED=0）。如需重新开启，在 .env 设 COVER_ENABLED=1 后再运行 covers。");
  void args;
}

async function cmdScript(args) {
  assertApiKey();
  const slug = await pickNovel(args._[1] || args.slug);
  if (getActiveProxy()) print(`代理：${getActiveProxy()}`);
  const limit = args.limit ? Number(args.limit) : Infinity;
  if (Number.isNaN(limit) || limit <= 0) {
    throw new Error("--limit 必须是正整数");
  }
  const { meta } = await loadNovel(slug);
  meta.autoScript = true;
  await saveMeta(meta);
  await generateScriptForNovel(slug, {
    force: Boolean(args.force),
    limit,
    onProgress: print,
  });
}

async function cmdBackfill(args) {
  assertApiKey();
  if (getActiveProxy()) print(`代理：${getActiveProxy()}`);
  const slug = args._[1] || args.slug || undefined;
  const only = args.only ? String(args.only) : undefined;
  if (only && !/^(covers|script)(,(covers|script))*$/.test(only.replace(/\s+/g, ""))) {
    throw new Error("--only 仅支持 covers、script，或用逗号组合，例如 covers,script");
  }
  await backfillNovels({
    slug: slug || undefined,
    only,
    dry: Boolean(args.dry),
    onProgress: print,
  });
}

async function cmdProduce(args) {
  assertApiKey();
  const slug = await pickNovel(args._[1] || args.slug);
  const { meta, outline } = await loadNovel(slug);
  if (meta.status === "review") {
    throw new Error("总纲仍待审核。请先 npm run approve -- " + slug);
  }
  if (!hasOutlineReady(outline)) {
    throw new Error("缺少短篇总纲，请先 new / resume。");
  }
  const wantScript = Boolean(args.script) || meta.autoScript || isAutoScriptEnabled();
  print(`开始写短篇《${meta.title}》全文…`);
  if (getActiveProxy()) print(`代理：${getActiveProxy()}`);

  const result = await produceShortStory({
    slug,
    meta,
    outline,
    onProgress: print,
    withScript: wantScript,
  });
  print(`\n完成：${result.file}（约 ${formatNumber(result.chars)} 字）`);
}

async function interactive() {
  const io = readline.createInterface({ input, output });
  try {
    print(HELP);
    print("1) 指定类型开短篇");
    print(`2) 随机开短篇（题材如：${GENRE_POOL.slice(0, 6).join("/")}…）`);
    print("3) 查看全部作品");
    print("4) 查看进度");
    print("5) 审核通过");
    print("6) 打回总纲");
    print("7) 写短篇正文");
    print("8) 续写未完成总纲");
    print("9) 工厂连开短篇");
    print("10) 查看工厂队列");
    print("11) （封面已关闭）");
    print("12) 按需生成剧本");
    print("13) 补齐旧作剧本");
    print("0) 退出");
    const choice = (await io.question("\n请选择：")).trim();
    switch (choice) {
      case "1":
        await cmdNew({}, io);
        break;
      case "2":
        await cmdNew({ auto: true }, io);
        break;
      case "3":
        await cmdList();
        break;
      case "4":
        await cmdStatus(await io.question("slug（回车=自动）：").then((s) => s.trim() || undefined));
        break;
      case "5":
        await cmdApprove(await io.question("slug：").then((s) => s.trim()));
        break;
      case "6":
        await cmdReject(await io.question("slug：").then((s) => s.trim()));
        break;
      case "7": {
        const slug = (await io.question("slug：")).trim();
        const script = (await io.question("同时生成剧本？(y/N) ")).trim().toLowerCase() === "y";
        await cmdProduce({ _: ["produce", slug], script });
        break;
      }
      case "8":
        await cmdResume((await io.question("slug（回车=自动找未完成）：")).trim() || undefined);
        break;
      case "9": {
        const once = (await io.question("只跑一个批次？(y/N) ")).trim().toLowerCase() === "y";
        await cmdFactory(once ? { once: true } : {});
        break;
      }
      case "10":
        await cmdFactoryStatus();
        break;
      case "11": {
        const slug = (await io.question("slug：")).trim();
        const force = (await io.question("强制重做？(y/N) ")).trim().toLowerCase() === "y";
        await cmdCovers({ _: ["covers", slug], force });
        break;
      }
      case "12": {
        const slug = (await io.question("slug：")).trim();
        const force = (await io.question("强制重建全部剧本？(y/N) ")).trim().toLowerCase() === "y";
        const rawLimit = (await io.question("本次最多生成集数（回车=续完）：")).trim();
        await cmdScript({
          _: ["script", slug],
          force,
          limit: rawLimit || undefined,
        });
        break;
      }
      case "13": {
        const slug = (await io.question("slug（回车=全部）：")).trim();
        const dry = (await io.question("仅预览不生成？(y/N) ")).trim().toLowerCase() === "y";
        const onlyRaw = (await io.question("只补哪类（covers/script，回车=缺失项）：")).trim();
        await cmdBackfill({
          _: ["backfill", slug || undefined].filter(Boolean),
          dry,
          only: onlyRaw || undefined,
        });
        break;
      }
      default:
        print("已退出。");
    }
  } finally {
    io.close();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0];

  if (!cmd) {
    await interactive();
    return;
  }

  switch (cmd) {
    case "new":
      await cmdNew(args);
      break;
    case "list":
      await cmdList();
      break;
    case "status":
      await cmdStatus(args._[1]);
      break;
    case "approve":
      await cmdApprove(args._[1]);
      break;
    case "reject":
      await cmdReject(args._[1]);
      break;
    case "produce":
      await cmdProduce(args);
      break;
    case "resume":
      await cmdResume(args._[1]);
      break;
    case "factory":
      await cmdFactory(args);
      break;
    case "factory-status":
      await cmdFactoryStatus();
      break;
    case "covers":
      await cmdCovers(args);
      break;
    case "script":
      await cmdScript(args);
      break;
    case "backfill":
      await cmdBackfill(args);
      break;
    case "help":
    case "-h":
    case "--help":
      print(HELP);
      break;
    default:
      print(`未知命令：${cmd}`);
      print(HELP);
      process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`\n失败：${error.message || error}`);
  process.exitCode = 1;
});
