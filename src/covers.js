import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
  AUTHOR_PEN_NAME,
  COVER_COUNT,
  COVER_HEIGHT,
  COVER_WIDTH,
  getImageModel,
  getImageQuality,
  isCoverProductionEnabled,
} from "./config.js";
import { editorSystemFor, coverConceptsPrompt } from "./prompts.js";
import { getLocale } from "./locales.js";
import { chatJson, getOpenAIClient } from "./llm.js";
import {
  coverDir,
  ensureDir,
  loadNovel,
  pathExists,
  saveMeta,
  writeJson,
} from "./store.js";
import { sanitizeName } from "./text.js";
import { pickCoverLayouts, getCoverLayout, renderCoverTypographySvg } from "./coverLayouts.js";

const STYLE_FALLBACKS = [
  {
    styleLabel: "水墨意象",
    mood: "苍茫克制",
    palette: "墨色、宣纸白、一点朱红",
    suffix:
      "Chinese ink wash painting aesthetic, expressive brush strokes, negative space, slightly clearer mid band for title overlay, vertical book cover, cinematic atmosphere, no text, no watermark, no signature",
  },
  {
    styleLabel: "厚涂史诗",
    mood: "雄浑压迫",
    palette: "深青、琥珀、暗金",
    suffix:
      "oil painting illustration, dramatic volumetric light, epic book cover, richer lower scene, clearer center for title overlay, vertical 3:4, no text, no watermark, no signature",
  },
  {
    styleLabel: "极简符号",
    mood: "冷峻神秘",
    palette: "高对比单色加一点强调色",
    suffix:
      "minimal symbolic poster design, bold silhouette, graphic design book cover, clean mid composition for typography, vertical 3:4, no text, no watermark, no signature",
  },
];

const FONT_CANDIDATES = [
  "/Library/Fonts/Arial Unicode.ttf",
  "/System/Library/Fonts/Supplemental/Songti.ttc",
  "/System/Library/Fonts/STHeiti Medium.ttc",
  "/System/Library/Fonts/Hiragino Sans GB.ttc",
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function print(msg) {
  console.log(msg);
}

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function resolveCoverFont() {
  for (const file of FONT_CANDIDATES) {
    if (await pathExists(file)) return file;
  }
  return null;
}



function wrapByPunctuation(text, { maxLen = 22, maxLines = 2 } = {}) {
  const raw = String(text || "").replace(/\s+/g, "").trim();
  if (!raw) return [];
  if ([...raw].length <= maxLen) return [raw];
  const parts = raw.split(/(?<=[？！。；，、])/);
  const lines = [];
  let buf = "";
  for (const part of parts) {
    if (!part) continue;
    if ([...(buf + part)].length <= maxLen) {
      buf += part;
      continue;
    }
    if (buf) lines.push(buf);
    buf = part;
    if (lines.length >= maxLines - 1) break;
  }
  if (buf && lines.length < maxLines) lines.push(buf);
  if (!lines.length) return [raw.slice(0, maxLen)];
  if (lines.length === 2 && [...lines[1]].length < 4) {
    return [[...raw].slice(0, maxLen).join("")];
  }
  return lines.slice(0, maxLines);
}

function copyLimits(language = "zh") {
  // CJK overlays stay tight; Latin/Cyrillic need more characters for readable phrases.
  if (language === "zh" || language === "ja" || language === "ko") {
    return { tag: 10, hookTop: 22, blurb: 60, hookBottom: 24 };
  }
  return { tag: 24, hookTop: 64, blurb: 140, hookBottom: 72 };
}

function defaultCopy(bible) {
  const L = getLocale(bible.language || "zh");
  const lim = copyLimits(L.id);
  const genre = String(bible.genre || L.genres?.[0] || "Fiction").split(/[／/]/)[0].trim();
  const sub = String(bible.subgenre || "").trim();
  const themes = (bible.themes || []).map((t) => String(t).slice(0, lim.tag)).filter(Boolean);
  const defaults = {
    zh: { plot: "强情节", growth: "人物成长", hook: "长线伏笔", top: "真相从不轻易露面。", bottom: "看清规则后，你还敢往前走吗？" },
    en: { plot: "High stakes", growth: "Character-driven", hook: "Slow-burn secrets", top: "Truth never arrives clean.", bottom: "Once you see the rules—do you still walk forward?" },
    ja: { plot: "強プロット", growth: "人物成長", hook: "伏線回収", top: "真実は、すぐには姿を見せない。", bottom: "ルールを知ったあとも、前へ進むか？" },
    ko: { plot: "강플롯", growth: "인물 성장", hook: "복선", top: "진실은 쉽게 드러나지 않는다.", bottom: "규칙을 본 뒤에도, 당신은 앞으로 가겠는가?" },
    ru: { plot: "Сильный сюжет", growth: "Характеры", hook: "Тайны", top: "Правда не приходит чистой.", bottom: "Увидев правила — пойдёшь ли дальше?" },
  };
  const d = defaults[L.id] || defaults.en;
  const tags = [genre, sub || d.plot, themes[0] || d.growth, themes[1] || d.hook]
    .filter(Boolean)
    .slice(0, 4);
  const compact = L.id === "zh" || L.id === "ja" || L.id === "ko";
  return {
    tags,
    hookTop: String(bible.logline || bible.sellingPoints?.[0] || d.top).slice(0, lim.hookTop),
    blurb: String(bible.synopsis || bible.mainPlot || "")
      .replace(compact ? /\s+/g : /\s{2,}/g, compact ? "" : " ")
      .slice(0, lim.blurb),
    hookBottom: String(
      bible.themes?.[0] && L.id === "zh"
        ? `若${bible.themes[0]}会毁了一切，你还要吗？`
        : d.bottom,
    ).slice(0, lim.hookBottom),
  };
}

function normalizeCopy(payload, bible) {
  const lim = copyLimits(bible.language || "zh");
  const fallback = defaultCopy(bible);
  const raw = payload?.copy || {};
  const tags = (Array.isArray(raw.tags) ? raw.tags : fallback.tags)
    .map((t) => String(t || "").trim().slice(0, lim.tag))
    .filter(Boolean)
    .slice(0, 4);
  return {
    tags: tags.length ? tags : fallback.tags,
    hookTop: String(raw.hookTop || fallback.hookTop).trim().slice(0, lim.hookTop),
    blurb: String(raw.blurb || fallback.blurb).trim().slice(0, lim.blurb),
    hookBottom: String(raw.hookBottom || fallback.hookBottom).trim().slice(0, lim.hookBottom),
  };
}

function normalizeConcepts(payload, bible) {
  const raw = Array.isArray(payload?.covers) ? payload.covers : [];
  const layouts = pickCoverLayouts(COVER_COUNT);
  const covers = [];
  for (let i = 0; i < COVER_COUNT; i += 1) {
    const item = raw[i] || {};
    const fallback = STYLE_FALLBACKS[i % STYLE_FALLBACKS.length];
    const layout = layouts[i] || layouts[0];
    const styleLabel = String(item.styleLabel || fallback.styleLabel).slice(0, 16);
    const mood = String(item.mood || fallback.mood).slice(0, 24);
    const palette = String(item.palette || fallback.palette).slice(0, 40);
    let imagePrompt = String(item.imagePrompt || "").trim();
    if (!imagePrompt) {
      const market = getLocale(bible.language || "zh").market;
      imagePrompt = `Vertical commercial book cover art for "${bible.title}", market: ${market}, genre ${bible.genre || ""}, mood ${mood}. Key scene: ${(bible.synopsis || bible.logline || "").slice(0, 160)}. ${fallback.suffix}`;
    } else if (!/no text|without text|no watermark/i.test(imagePrompt)) {
      imagePrompt = `${imagePrompt}. Vertical book cover 3:4, leave space for typography overlay, absolutely no text, no Chinese characters, no watermark, no signature, no logo.`;
    }
    covers.push({
      index: i + 1,
      styleLabel,
      mood,
      palette,
      imagePrompt,
      layoutId: layout.id,
      layoutLabel: layout.label,
    });
  }
  return { copy: normalizeCopy(payload, bible), covers };
}

async function planCoverConcepts(bible, onProgress = print) {
  onProgress("正在根据总纲策划封面文案；排版将从 30 种版式中随机抽 3 种…");
  try {
    const payload = await chatJson({
      kind: "outline",
      maxCompletionTokens: 3_000,
      onProgress,
      messages: [
        { role: "system", content: editorSystemFor(bible.language || "zh") },
        {
          role: "user",
          content: coverConceptsPrompt(bible, {
            count: COVER_COUNT,
            width: COVER_WIDTH,
            height: COVER_HEIGHT,
            penName: AUTHOR_PEN_NAME,
          }),
        },
      ],
    });
    return normalizeConcepts(payload, bible);
  } catch (error) {
    onProgress(`封面方案策划失败，改用兜底文案与风格：${error.message}`);
    return normalizeConcepts({ covers: [] }, bible);
  }
}

/**
 * 按参考印章样式矢量重绘「龙龙老表」朱文方印：
 * 左上龙、右上龙、左下老、右下表；微倾、朱砂色、毛边印感。
 */
function authorSealSvg(fontFamily = "CoverCJK", fontFaceCss = "") {
  const glyphs = [
    { ch: "龙", x: 48, y: 62 },
    { ch: "龙", x: 112, y: 62 },
    { ch: "老", x: 48, y: 118 },
    { ch: "表", x: 112, y: 118 },
  ];
  const texts = glyphs
    .map(
      (g) =>
        `<text x="${g.x}" y="${g.y}" text-anchor="middle" dominant-baseline="middle" font-family="${fontFamily}" font-size="42" font-weight="700" fill="#d12b2b" filter="url(#inkGrain)">${escapeXml(g.ch)}</text>`,
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="168" height="168" viewBox="0 0 168 168">
  <defs>
    ${fontFaceCss}
    <filter id="inkGrain" x="-30%" y="-30%" width="160%" height="160%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.2" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
    <filter id="stampWear" x="-20%" y="-20%" width="140%" height="140%">
      <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="3" seed="3" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="2.4" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
  </defs>
  <g transform="rotate(-7 84 84)" filter="url(#stampWear)" opacity="0.96">
    <rect x="18" y="18" width="132" height="132" rx="10" ry="10" fill="none" stroke="#d12b2b" stroke-width="9" stroke-linejoin="round"/>
    <rect x="28" y="28" width="112" height="112" rx="6" ry="6" fill="none" stroke="#d12b2b" stroke-width="2.2" stroke-opacity="0.85"/>
    <path d="M34 18.5 H52" stroke="#d12b2b" stroke-width="3" stroke-linecap="round" opacity="0.55"/>
    <path d="M118 149.5 H140" stroke="#d12b2b" stroke-width="3" stroke-linecap="round" opacity="0.45"/>
    <path d="M18.5 118 V138" stroke="#d12b2b" stroke-width="3" stroke-linecap="round" opacity="0.4"/>
    ${texts}
  </g>
</svg>`;
}

async function renderAuthorSealPng(fontFamily, fontFaceCss) {
  const svg = Buffer.from(authorSealSvg(fontFamily, fontFaceCss));
  return sharp(svg).png().toBuffer();
}


async function buildOverlayLayers(title, copy, layoutId = "centerPoster") {
  const fontPath = await resolveCoverFont();
  const fontFamily = fontPath ? "CoverCJK" : "sans-serif";
  const fontFaceCss = fontPath
    ? `@font-face { font-family: 'CoverCJK'; src: url('file://${fontPath}'); }`
    : "";

  const layout = getCoverLayout(layoutId);
  const typeSvg = Buffer.from(
    renderCoverTypographySvg({ title, copy, fontFamily, fontFaceCss, layout }),
  );
  const sealPng = await renderAuthorSealPng(fontFamily, fontFaceCss);

  const zhuSvg = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="36" height="40" viewBox="0 0 36 40">
  <defs>${fontFaceCss}</defs>
  <text x="18" y="28" text-anchor="middle" font-family="${fontFamily}" font-size="22" fill="#f5f7fa" stroke="#111" stroke-width="1.2" paint-order="stroke">${escapeXml("著")}</text>
</svg>`);

  return {
    typePng: await sharp(typeSvg).png().toBuffer(),
    sealPng,
    zhuPng: await sharp(zhuSvg).png().toBuffer(),
    layoutId: layout.id,
    layoutLabel: layout.label,
  };
}

function pickImageSize(model) {
  const name = String(model || "").toLowerCase();
  if (name.includes("dall-e-3") || name.includes("dalle-3")) {
    return "1024x1792";
  }
  return "1024x1536";
}

async function fetchImageBytes(result) {
  const item = result?.data?.[0];
  if (!item) throw new Error("图片接口未返回数据。");
  if (item.b64_json) {
    return Buffer.from(item.b64_json, "base64");
  }
  if (item.url) {
    const response = await fetch(item.url);
    if (!response.ok) {
      throw new Error(`下载封面图失败：HTTP ${response.status}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }
  throw new Error("图片接口既无 b64 也无 url。");
}

async function generateRawCoverImage(prompt, onProgress = print) {
  const client = getOpenAIClient();
  const model = getImageModel();
  const size = pickImageSize(model);
  onProgress(`文生图中（${model} / ${size}）…`);

  const attempts = [
    { model, size, quality: model.includes("gpt-image") ? getImageQuality() : undefined },
    { model: "dall-e-3", size: "1024x1792", quality: "standard" },
  ];

  let lastError;
  for (const attempt of attempts) {
    try {
      const body = {
        model: attempt.model,
        prompt,
        size: attempt.size,
        n: 1,
      };
      if (attempt.quality) body.quality = attempt.quality;
      if (String(attempt.model).includes("dall-e")) {
        body.response_format = "url";
      }
      const result = await client.images.generate(body);
      return await fetchImageBytes(result);
    } catch (error) {
      lastError = error;
      onProgress(`出图失败（${attempt.model}）：${error.message}，尝试备选…`);
    }
  }
  throw lastError || new Error("封面出图失败。");
}

async function finalizeCoverBuffer(rawBytes, overlays) {
  const base = await sharp(rawBytes)
    .resize(COVER_WIDTH, COVER_HEIGHT, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();

  const sealSize = 96;
  const margin = 14;
  const sealLeft = COVER_WIDTH - sealSize - margin - 28;
  const sealTop = COVER_HEIGHT - sealSize - margin;
  const zhuLeft = COVER_WIDTH - margin - 26;
  const zhuTop = sealTop + Math.round((sealSize - 36) / 2);

  return sharp(base)
    .composite([
      { input: overlays.typePng, left: 0, top: 0 },
      {
        input: await sharp(overlays.sealPng)
          .resize(sealSize, sealSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png()
          .toBuffer(),
        left: sealLeft,
        top: sealTop,
      },
      { input: overlays.zhuPng, left: zhuLeft, top: zhuTop },
    ])
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
}

/** 只替换已有封面右下角印章（矢量重绘，不贴图），不重画出图 */
export async function restampCoversForNovel(slug, { onProgress = print } = {}) {
  const { meta } = await loadNovel(slug);
  const dir = coverDir(slug);
  const files = await listExistingCovers(slug);
  if (!files.length) {
    onProgress(`《${meta.title || slug}》还没有封面可替换印章。`);
    return { meta, files: [] };
  }

  const fontPath = await resolveCoverFont();
  const fontFamily = fontPath ? "CoverCJK" : "sans-serif";
  const fontFaceCss = fontPath
    ? `@font-face { font-family: 'CoverCJK'; src: url('file://${fontPath}'); }`
    : "";
  const sealPng = await renderAuthorSealPng(fontFamily, fontFaceCss);
  const zhuPng = await sharp(
    Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="36" height="40" viewBox="0 0 36 40">
  <defs>${fontFaceCss}</defs>
  <text x="18" y="28" text-anchor="middle" font-family="${fontFamily}" font-size="22" fill="#f5f7fa" stroke="#111" stroke-width="1.2" paint-order="stroke">${escapeXml("著")}</text>
</svg>`),
  )
    .png()
    .toBuffer();

  const sealSize = 96;
  const margin = 14;
  const sealLeft = COVER_WIDTH - sealSize - margin - 28;
  const sealTop = COVER_HEIGHT - sealSize - margin;
  const zhuLeft = COVER_WIDTH - margin - 26;
  const zhuTop = sealTop + Math.round((sealSize - 36) / 2);

  // 盖住旧印章区域后再叠矢量新章
  const patchW = sealSize + 44;
  const patchH = sealSize + 28;
  const patchLeft = Math.max(0, COVER_WIDTH - patchW - 6);
  const patchTop = Math.max(0, COVER_HEIGHT - patchH - 6);
  const darkPatch = await sharp({
    create: {
      width: patchW,
      height: patchH,
      channels: 4,
      background: { r: 10, g: 12, b: 16, alpha: 1 },
    },
  })
    .png()
    .toBuffer();

  const resizedSeal = await sharp(sealPng)
    .resize(sealSize, sealSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  for (const name of files) {
    const filePath = path.join(dir, name);
    const buf = await sharp(filePath)
      .resize(COVER_WIDTH, COVER_HEIGHT, { fit: "cover", position: "centre" })
      .composite([
        { input: darkPatch, left: patchLeft, top: patchTop },
        { input: resizedSeal, left: sealLeft, top: sealTop },
        { input: zhuPng, left: zhuLeft, top: zhuTop },
      ])
      .jpeg({ quality: 92, mozjpeg: true })
      .toBuffer();
    const outPath = filePath.replace(/\.(png|webp)$/i, ".jpg");
    await fs.writeFile(outPath, buf);
    if (outPath !== filePath) {
      await fs.unlink(filePath).catch(() => {});
    }
    onProgress(`已矢量重绘印章：${outPath}`);
  }

  return { meta, files };
}

export async function listExistingCovers(slug) {
  const dir = coverDir(slug);
  if (!(await pathExists(dir))) return [];
  const files = await fs.readdir(dir);
  return files.filter((name) => /^封面-\d+/i.test(name) && /\.(jpg|jpeg|png|webp)$/i.test(name));
}

export async function generateCoversForNovel(slug, { force = false, onProgress = print } = {}) {
  if (!isCoverProductionEnabled()) {
    onProgress?.("封面生产已关闭（COVER_ENABLED=0），跳过。");
    const { meta } = await loadNovel(slug);
    return { meta, covers: meta.covers || [], skipped: true };
  }

  const { meta, outline } = await loadNovel(slug);
  const hasShort = outline?.kind === "short-story" && (outline?.beats?.length || outline?.synopsis);
  const hasLong = outline?.volumes?.length;
  if (!hasShort && !hasLong) {
    throw new Error(`《${meta.title || slug}》尚无完整大纲，无法做封面。`);
  }

  const dir = coverDir(slug);
  await ensureDir(dir);
  const existing = await listExistingCovers(slug);
  if (!force && existing.length >= COVER_COUNT) {
    onProgress(`《${meta.title}》封面已有 ${existing.length} 张，跳过（加 --force 可重做）。`);
    return { meta, covers: meta.covers || [], skipped: true };
  }

  if (force && existing.length) {
    for (const name of existing) {
      await fs.unlink(path.join(dir, name));
    }
  }

  const { copy, covers: concepts } = await planCoverConcepts(outline, onProgress);
  onProgress(
    `封面文案：书名《${meta.title || outline.title}》｜标签 ${copy.tags.join(" × ")}`,
  );
  onProgress(
    `排版抽签：${concepts.map((c) => `${c.index}:${c.layoutLabel || c.layoutId}`).join(" / ")}`,
  );
  const covers = [];
  const bookTitle = meta.title || outline.title || slug;

  for (const concept of concepts) {
    onProgress(
      `\n绘制封面 ${concept.index}/${COVER_COUNT}：${concept.styleLabel}｜排版 ${concept.layoutLabel || concept.layoutId}（${concept.mood}）…`,
    );
    const overlays = await buildOverlayLayers(bookTitle, copy, concept.layoutId);
    const raw = await generateRawCoverImage(concept.imagePrompt, onProgress);
    const finalBuf = await finalizeCoverBuffer(raw, overlays);
    const safeStyle = sanitizeName(concept.styleLabel, `风格${concept.index}`).slice(0, 20);
    const fileName = `封面-0${concept.index}-${safeStyle}.jpg`;
    const filePath = path.join(dir, fileName);
    await fs.writeFile(filePath, finalBuf);
    covers.push({
      index: concept.index,
      styleLabel: concept.styleLabel,
      layoutId: concept.layoutId,
      mood: concept.mood,
      palette: concept.palette,
      tags: copy.tags,
      hookTop: copy.hookTop,
      hookBottom: copy.hookBottom,
      file: fileName,
      format: "jpg",
      width: COVER_WIDTH,
      height: COVER_HEIGHT,
      authorSeal: AUTHOR_PEN_NAME,
      prompt: concept.imagePrompt,
      createdAt: new Date().toISOString(),
    });
    onProgress(`已保存 ${filePath}`);
    await sleep(600);
  }

  await writeJson(path.join(dir, "covers.json"), {
    title: meta.title,
    slug: meta.slug,
    author: AUTHOR_PEN_NAME,
    width: COVER_WIDTH,
    height: COVER_HEIGHT,
    copy,
    covers,
  });

  meta.covers = covers.map(({ prompt, ...rest }) => rest);
  meta.coverDir = "封面";
  meta.coverCopy = copy;
  await saveMeta(meta);
  onProgress(`\n《${meta.title}》封面完成：${covers.length} 张 → ${dir}`);
  return { meta, covers, skipped: false };
}
