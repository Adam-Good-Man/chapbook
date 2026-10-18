import { COVER_HEIGHT, COVER_WIDTH } from "./config.js";

/** 30 种书封排版（参考网文/商业封面常见变体），每次随机抽 3 种 */
export const COVER_LAYOUT_POOL = [
  { id: "centerPoster", label: "居中海报", title: { x: 300, y: 360, anchor: "middle", scale: 1, tracking: 6 }, tags: { mode: "cross", x: 300, y: 0, anchor: "middle" }, hookTop: { x: 36, y: 48, anchor: "start", size: 15 }, blurb: { mode: "block", x: 430, y: 56, maxLen: 14, maxLines: 4, size: 13 }, hookBottom: { x: 36, y: 700, anchor: "start", size: 15, maxLines: 2 }, bands: [{ kind: "mid", y: 220, h: 300, o: 0.32 }] },
  { id: "leftFlush", label: "左侧齐刷", title: { x: 36, y: 250, anchor: "start", scale: 0.92, tracking: 3 }, tags: { mode: "stackDot", x: 36, y: 0, gap: 34 }, hookTop: { x: 36, y: 58, anchor: "start", size: 14 }, blurb: { mode: "block", x: 36, y: 620, maxLen: 16, maxLines: 3, size: 14 }, hookBottom: { x: 36, y: 720, anchor: "start", size: 16, maxLines: 1 }, bands: [{ kind: "left", w: 320, o: 0.5 }] },
  { id: "topMasthead", label: "顶部报头", title: { x: 36, y: 118, anchor: "start", scale: 0.88, tracking: 2 }, tags: { mode: "chips", x: 36, y: 148 }, hookTop: { x: 36, y: 46, anchor: "start", size: 13 }, blurb: { mode: "block", x: 36, y: 640, maxLen: 18, maxLines: 3, size: 14 }, hookBottom: { x: 36, y: 730, anchor: "start", size: 15, maxLines: 1 }, bands: [{ kind: "top", h: 230, o: 0.55 }] },
  { id: "bottomHeavy", label: "下沉重题", title: { x: 300, y: 580, anchor: "middle", scale: 1.05, tracking: 5 }, tags: { mode: "cross", x: 300, y: 0, anchor: "middle" }, hookTop: { x: 36, y: 44, anchor: "start", size: 14 }, blurb: { mode: "none" }, hookBottom: { x: 36, y: 680, anchor: "start", size: 14, maxLines: 2 }, bands: [{ kind: "bottom", y: 480, h: 220, o: 0.48 }] },
  { id: "rightFlush", label: "右侧齐刷", title: { x: 564, y: 280, anchor: "end", scale: 0.9, tracking: 2 }, tags: { mode: "stackDot", x: 564, y: 0, gap: 32, anchor: "end" }, hookTop: { x: 564, y: 50, anchor: "end", size: 13 }, blurb: { mode: "block", x: 280, y: 620, maxLen: 16, maxLines: 3, size: 13, anchor: "end" }, hookBottom: { x: 564, y: 720, anchor: "end", size: 14, maxLines: 1 }, bands: [{ kind: "right", w: 300, o: 0.48 }] },
  { id: "verticalSpine", label: "左侧竖题", title: { mode: "vertical", x: 48, y: 120, scale: 0.78 }, tags: { mode: "chips", x: 110, y: 120 }, hookTop: { x: 110, y: 52, anchor: "start", size: 13 }, blurb: { mode: "block", x: 110, y: 620, maxLen: 16, maxLines: 3, size: 13 }, hookBottom: { x: 110, y: 720, anchor: "start", size: 14, maxLines: 1 }, bands: [{ kind: "left", w: 90, o: 0.42 }] },
  { id: "tiltedImpact", label: "倾斜冲击", title: { x: 300, y: 340, anchor: "middle", scale: 1.02, tracking: 4, rotate: -8 }, tags: { mode: "cross", x: 300, y: 0, anchor: "middle" }, hookTop: { x: 40, y: 70, anchor: "start", size: 14, rotate: -6 }, blurb: { mode: "none" }, hookBottom: { x: 40, y: 710, anchor: "start", size: 15, maxLines: 1 }, bands: [{ kind: "mid", y: 250, h: 220, o: 0.36 }] },
  { id: "magazineCut", label: "杂志切角", title: { x: 40, y: 210, anchor: "start", scale: 0.95, tracking: 1 }, tags: { mode: "slash", x: 40, y: 0 }, hookTop: null, blurb: { mode: "block", x: 40, y: 520, maxLen: 18, maxLines: 4, size: 13 }, hookBottom: { x: 40, y: 700, anchor: "start", size: 14, maxLines: 2 }, bands: [{ kind: "top", h: 260, o: 0.5 }] },
  { id: "cinematicBar", label: "电影宽条", title: { x: 300, y: 430, anchor: "middle", scale: 0.9, tracking: 8 }, tags: { mode: "dots", x: 300, y: 0, anchor: "middle" }, hookTop: { x: 300, y: 380, anchor: "middle", size: 12 }, blurb: { mode: "none" }, hookBottom: { x: 300, y: 470, anchor: "middle", size: 13, maxLines: 1 }, bands: [{ kind: "bar", y: 360, h: 130, o: 0.62 }] },
  { id: "headlineNews", label: "新闻大字", title: { x: 36, y: 150, anchor: "start", scale: 1.08, tracking: 1 }, tags: { mode: "chips", x: 36, y: 180 }, hookTop: { x: 36, y: 56, anchor: "start", size: 12 }, blurb: { mode: "block", x: 36, y: 650, maxLen: 20, maxLines: 2, size: 13 }, hookBottom: null, bands: [{ kind: "top", h: 210, o: 0.58 }] },
  { id: "boxedTitle", label: "框题海报", title: { x: 300, y: 380, anchor: "middle", scale: 0.95, tracking: 5, boxed: true }, tags: { mode: "cross", x: 300, y: 0, anchor: "middle" }, hookTop: { x: 36, y: 50, anchor: "start", size: 14 }, blurb: { mode: "block", x: 36, y: 640, maxLen: 18, maxLines: 3, size: 13 }, hookBottom: { x: 36, y: 730, anchor: "start", size: 14, maxLines: 1 }, bands: [{ kind: "mid", y: 280, h: 240, o: 0.4 }] },
  { id: "dualColumn", label: "双栏信息", title: { x: 36, y: 300, anchor: "start", scale: 0.9, tracking: 2 }, tags: { mode: "stackDot", x: 36, y: 0, gap: 30 }, hookTop: { x: 36, y: 60, anchor: "start", size: 13 }, blurb: { mode: "block", x: 320, y: 300, maxLen: 12, maxLines: 6, size: 13 }, hookBottom: { x: 36, y: 720, anchor: "start", size: 14, maxLines: 1 }, bands: [{ kind: "mid", y: 200, h: 360, o: 0.3 }] },
  { id: "minimalTop", label: "极简顶题", title: { x: 300, y: 120, anchor: "middle", scale: 0.95, tracking: 7 }, tags: { mode: "dots", x: 300, y: 0, anchor: "middle" }, hookTop: null, blurb: { mode: "none" }, hookBottom: { x: 300, y: 720, anchor: "middle", size: 14, maxLines: 1 }, bands: [{ kind: "top", h: 170, o: 0.4 }] },
  { id: "softRibbon", label: "柔带题条", title: { x: 300, y: 300, anchor: "middle", scale: 0.92, tracking: 4 }, tags: { mode: "chips", x: 120, y: 330 }, hookTop: { x: 300, y: 250, anchor: "middle", size: 13 }, blurb: { mode: "none" }, hookBottom: { x: 36, y: 700, anchor: "start", size: 14, maxLines: 2 }, bands: [{ kind: "bar", y: 230, h: 150, o: 0.45 }] },
  { id: "thrillerCluster", label: "悬疑簇集", title: { x: 40, y: 240, anchor: "start", scale: 0.98, tracking: 2 }, tags: { mode: "slash", x: 40, y: 0 }, hookTop: { x: 40, y: 70, anchor: "start", size: 13 }, blurb: { mode: "block", x: 40, y: 500, maxLen: 15, maxLines: 4, size: 12 }, hookBottom: { x: 40, y: 680, anchor: "start", size: 14, maxLines: 2 }, bands: [{ kind: "left", w: 360, o: 0.52 }] },
  { id: "epicWide", label: "史诗阔字", title: { x: 300, y: 520, anchor: "middle", scale: 1.12, tracking: 10 }, tags: { mode: "dots", x: 300, y: 0, anchor: "middle" }, hookTop: { x: 36, y: 48, anchor: "start", size: 14 }, blurb: { mode: "none" }, hookBottom: { x: 300, y: 580, anchor: "middle", size: 13, maxLines: 1 }, bands: [{ kind: "bottom", y: 430, h: 200, o: 0.5 }] },
  { id: "floatingTags", label: "漂浮标签", title: { x: 300, y: 390, anchor: "middle", scale: 1, tracking: 5 }, tags: { mode: "float", x: 60, y: 180 }, hookTop: { x: 36, y: 50, anchor: "start", size: 14 }, blurb: { mode: "none" }, hookBottom: { x: 36, y: 710, anchor: "start", size: 15, maxLines: 1 }, bands: [{ kind: "mid", y: 300, h: 180, o: 0.34 }] },
  { id: "underlineRule", label: "衬线压线", title: { x: 300, y: 340, anchor: "middle", scale: 0.96, tracking: 6, rule: true }, tags: { mode: "cross", x: 300, y: 0, anchor: "middle" }, hookTop: { x: 300, y: 80, anchor: "middle", size: 13 }, blurb: { mode: "block", x: 80, y: 620, maxLen: 18, maxLines: 3, size: 13, anchor: "middle" }, hookBottom: { x: 36, y: 720, anchor: "start", size: 14, maxLines: 1 }, bands: [{ kind: "mid", y: 260, h: 200, o: 0.33 }] },
  { id: "glassCard", label: "玻璃卡片", title: { x: 300, y: 360, anchor: "middle", scale: 0.9, tracking: 4, card: true }, tags: { mode: "chips", x: 140, y: 400 }, hookTop: { x: 300, y: 290, anchor: "middle", size: 12 }, blurb: { mode: "block", x: 110, y: 450, maxLen: 16, maxLines: 3, size: 12, anchor: "middle" }, hookBottom: { x: 36, y: 720, anchor: "start", size: 14, maxLines: 1 }, bands: [] },
  { id: "topRightFocus", label: "右上焦点", title: { x: 560, y: 150, anchor: "end", scale: 0.92, tracking: 2 }, tags: { mode: "stackDot", x: 560, y: 0, gap: 28, anchor: "end" }, hookTop: { x: 36, y: 50, anchor: "start", size: 13 }, blurb: { mode: "block", x: 36, y: 620, maxLen: 18, maxLines: 3, size: 13 }, hookBottom: { x: 36, y: 720, anchor: "start", size: 14, maxLines: 1 }, bands: [{ kind: "top", h: 220, o: 0.45 }] },
  { id: "bottomBanner", label: "底栏题名", title: { x: 36, y: 660, anchor: "start", scale: 0.86, tracking: 3 }, tags: { mode: "slash", x: 36, y: 0 }, hookTop: { x: 36, y: 48, anchor: "start", size: 14 }, blurb: { mode: "block", x: 36, y: 90, maxLen: 18, maxLines: 3, size: 13 }, hookBottom: null, bands: [{ kind: "bottom", y: 580, h: 140, o: 0.55 }] },
  { id: "asymmetricL", label: "L型构图", title: { x: 40, y: 280, anchor: "start", scale: 0.95, tracking: 2 }, tags: { mode: "chips", x: 40, y: 680 }, hookTop: { x: 40, y: 70, anchor: "start", size: 13 }, blurb: { mode: "block", x: 40, y: 500, maxLen: 16, maxLines: 3, size: 13 }, hookBottom: null, bands: [{ kind: "left", w: 280, o: 0.4 }, { kind: "bottom", y: 640, h: 90, o: 0.4 }] },
  { id: "stackedSpineTags", label: "竖签旁题", title: { x: 300, y: 360, anchor: "middle", scale: 1, tracking: 5 }, tags: { mode: "vertical", x: 40, y: 160 }, hookTop: { x: 120, y: 50, anchor: "start", size: 13 }, blurb: { mode: "none" }, hookBottom: { x: 120, y: 710, anchor: "start", size: 14, maxLines: 1 }, bands: [{ kind: "mid", y: 280, h: 200, o: 0.35 }] },
  { id: "ultraSparse", label: "极简留白", title: { x: 300, y: 400, anchor: "middle", scale: 1.05, tracking: 8 }, tags: { mode: "dots", x: 300, y: 0, anchor: "middle" }, hookTop: null, blurb: { mode: "none" }, hookBottom: null, bands: [{ kind: "mid", y: 330, h: 140, o: 0.28 }] },
  { id: "posterLowerThird", label: "三分下区", title: { x: 40, y: 560, anchor: "start", scale: 0.93, tracking: 3 }, tags: { mode: "cross", x: 40, y: 0, anchor: "start" }, hookTop: { x: 40, y: 480, anchor: "start", size: 13 }, blurb: { mode: "none" }, hookBottom: { x: 40, y: 680, anchor: "start", size: 14, maxLines: 2 }, bands: [{ kind: "bottom", y: 450, h: 250, o: 0.5 }] },
  { id: "centerCascade", label: "居中瀑布", title: { x: 300, y: 280, anchor: "middle", scale: 0.95, tracking: 4 }, tags: { mode: "stackDot", x: 300, y: 0, gap: 30, anchor: "middle" }, hookTop: { x: 300, y: 70, anchor: "middle", size: 13 }, blurb: { mode: "block", x: 150, y: 520, maxLen: 16, maxLines: 3, size: 13, anchor: "middle" }, hookBottom: { x: 300, y: 700, anchor: "middle", size: 14, maxLines: 1 }, bands: [{ kind: "mid", y: 180, h: 420, o: 0.3 }] },
  { id: "sideBlurbRail", label: "侧栏简介", title: { x: 40, y: 320, anchor: "start", scale: 0.9, tracking: 2 }, tags: { mode: "chips", x: 40, y: 360 }, hookTop: { x: 40, y: 60, anchor: "start", size: 13 }, blurb: { mode: "verticalRail", x: 540, y: 100, maxChars: 28, size: 12 }, hookBottom: { x: 40, y: 720, anchor: "start", size: 14, maxLines: 1 }, bands: [{ kind: "right", w: 90, o: 0.35 }] },
  { id: "heroOverlap", label: "人物避让顶", title: { x: 300, y: 120, anchor: "middle", scale: 0.88, tracking: 5 }, tags: { mode: "slash", x: 300, y: 0, anchor: "middle" }, hookTop: null, blurb: { mode: "block", x: 40, y: 620, maxLen: 18, maxLines: 3, size: 13 }, hookBottom: { x: 40, y: 720, anchor: "start", size: 14, maxLines: 1 }, bands: [{ kind: "top", h: 170, o: 0.42 }, { kind: "bottom", y: 580, h: 140, o: 0.4 }] },
  { id: "compactBadge", label: "徽章标签", title: { x: 40, y: 360, anchor: "start", scale: 0.94, tracking: 3 }, tags: { mode: "badges", x: 40, y: 400 }, hookTop: { x: 40, y: 70, anchor: "start", size: 13 }, blurb: { mode: "none" }, hookBottom: { x: 40, y: 700, anchor: "start", size: 15, maxLines: 1 }, bands: [{ kind: "left", w: 340, o: 0.45 }] },
  { id: "wideLetterspace", label: "宽距字阶", title: { x: 300, y: 350, anchor: "middle", scale: 0.85, tracking: 14 }, tags: { mode: "dots", x: 300, y: 0, anchor: "middle" }, hookTop: { x: 300, y: 80, anchor: "middle", size: 12 }, blurb: { mode: "block", x: 120, y: 620, maxLen: 16, maxLines: 3, size: 12, anchor: "middle" }, hookBottom: { x: 300, y: 720, anchor: "middle", size: 13, maxLines: 1 }, bands: [{ kind: "bar", y: 300, h: 110, o: 0.5 }] },
];

function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function pickCoverLayouts(count = 3) {
  const pool = COVER_LAYOUT_POOL.length ? COVER_LAYOUT_POOL : [];
  return shuffle(pool).slice(0, Math.min(count, pool.length));
}

export function getCoverLayout(id) {
  return COVER_LAYOUT_POOL.find((item) => item.id === id) || COVER_LAYOUT_POOL[0];
}

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
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

function titleFontSize(title, scale = 1) {
  const len = [...String(title || "")].length;
  let size = 36;
  if (len <= 2) size = 86;
  else if (len <= 4) size = 70;
  else if (len <= 6) size = 54;
  else if (len <= 8) size = 44;
  return Math.round(size * scale);
}

function commonDefs(fontFaceCss) {
  return `
    ${fontFaceCss || ""}
    <filter id="titleShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="2.6" flood-color="#000000" flood-opacity="0.72"/>
    </filter>
    <linearGradient id="bandV" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000" stop-opacity="0.15"/>
      <stop offset="50%" stop-color="#000" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.2"/>
    </linearGradient>
    <linearGradient id="bandH" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#000" stop-opacity="0.55"/>
      <stop offset="70%" stop-color="#000" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="bandHR" x1="1" y1="0" x2="0" y2="0">
      <stop offset="0%" stop-color="#000" stop-opacity="0.55"/>
      <stop offset="70%" stop-color="#000" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0"/>
    </linearGradient>`;
}

function renderBands(bands = []) {
  return bands
    .map((b, i) => {
      const o = b.o ?? 0.4;
      if (b.kind === "left") {
        return `<rect x="0" y="0" width="${b.w || 300}" height="${COVER_HEIGHT}" fill="url(#bandH)" opacity="${o}"/>`;
      }
      if (b.kind === "right") {
        return `<rect x="${COVER_WIDTH - (b.w || 300)}" y="0" width="${b.w || 300}" height="${COVER_HEIGHT}" fill="url(#bandHR)" opacity="${o}"/>`;
      }
      if (b.kind === "top") {
        return `<rect x="0" y="0" width="${COVER_WIDTH}" height="${b.h || 200}" fill="url(#bandV)" opacity="${o}"/>`;
      }
      if (b.kind === "bottom") {
        return `<rect x="0" y="${b.y || 560}" width="${COVER_WIDTH}" height="${b.h || 160}" fill="url(#bandV)" opacity="${o}"/>`;
      }
      if (b.kind === "bar") {
        return `<rect x="0" y="${b.y}" width="${COVER_WIDTH}" height="${b.h}" fill="#000" opacity="${o}"/>`;
      }
      // mid
      return `<rect x="0" y="${b.y || 240}" width="${COVER_WIDTH}" height="${b.h || 260}" fill="url(#bandV)" opacity="${o}" data-i="${i}"/>`;
    })
    .join("");
}

function renderTagsAbsolute(tags, spec, titleBox) {
  const list = (tags || []).slice(0, 4);
  if (!list.length || !spec) return "";
  const fontFamily = titleBox.fontFamily;
  const titleSize = titleBox.size;
  const titleY = titleBox.y;
  const titleX = titleBox.x;
  const titleAnchor = titleBox.anchor;

  if (["cross", "dots", "slash"].includes(spec.mode)) {
    const sep = spec.mode === "dots" ? " · " : spec.mode === "slash" ? " / " : " × ";
    const line = list.join(sep);
    const x = spec.x ?? titleX;
    const y =
      spec.y && spec.y > 50
        ? spec.y + Math.round(titleSize * 0.55)
        : titleY + Math.round(titleSize * 0.55);
    const anchor = spec.anchor || titleAnchor || "start";
    return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${fontFamily}" font-size="14" fill="#f0f4f8" filter="url(#titleShadow)">${escapeXml(line)}</text>`;
  }

  if (spec.mode === "stackDot") {
    const x = spec.x ?? 36;
    const anchor = spec.anchor || "start";
    const startY = titleY + Math.round(titleSize * 0.75);
    return list
      .map((tag, i) => {
        const y = startY + i * (spec.gap || 32);
        const prefix = anchor === "end" ? `${escapeXml(tag)} ·` : `· ${escapeXml(tag)}`;
        return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${fontFamily}" font-size="15" fill="#f3f6fa" filter="url(#titleShadow)">${prefix}</text>`;
      })
      .join("");
  }

  if (spec.mode === "chips" || spec.mode === "badges") {
    let x = spec.x ?? 36;
    const y = spec.y && spec.y > 20 ? spec.y : titleY + Math.round(titleSize * 0.45);
    const parts = [];
    for (const tag of list) {
      const w = Math.max(52, [...tag].length * 14 + 16);
      const h = spec.mode === "badges" ? 28 : 26;
      parts.push(`<g>
        <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${spec.mode === "badges" ? 12 : 3}" fill="rgba(0,0,0,0.48)" stroke="rgba(255,255,255,0.55)" stroke-width="1"/>
        <text x="${x + w / 2}" y="${y + (spec.mode === "badges" ? 19 : 17)}" text-anchor="middle" font-family="${fontFamily}" font-size="12" fill="#f5f7fa">${escapeXml(tag)}</text>
      </g>`);
      x += w + 8;
      if (x > COVER_WIDTH - 80) break;
    }
    return parts.join("");
  }

  if (spec.mode === "float") {
    const positions = [
      [spec.x || 60, 170],
      [360, 210],
      [120, 250],
      [400, 280],
    ];
    return list
      .map((tag, i) => {
        const [x, y] = positions[i] || [80 + i * 40, 200 + i * 30];
        const w = Math.max(50, [...tag].length * 13 + 14);
        return `<g>
          <rect x="${x}" y="${y}" width="${w}" height="24" rx="2" fill="rgba(0,0,0,0.4)" stroke="rgba(255,255,255,0.4)" stroke-width="1"/>
          <text x="${x + w / 2}" y="${y + 16}" text-anchor="middle" font-family="${fontFamily}" font-size="11" fill="#f5f7fa">${escapeXml(tag)}</text>
        </g>`;
      })
      .join("");
  }

  if (spec.mode === "vertical") {
    const x = spec.x ?? 40;
    let y = spec.y ?? 160;
    return list
      .map((tag) => {
        const chars = [...tag]
          .map((ch, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : 16}">${escapeXml(ch)}</tspan>`)
          .join("");
        const block = `<text y="${y}" font-family="${fontFamily}" font-size="13" fill="#eef3f8" filter="url(#titleShadow)">${chars}</text>`;
        y += [...tag].length * 16 + 18;
        return block;
      })
      .join("");
  }

  return "";
}

function renderTitle(title, spec, fontFamily) {
  if (!spec) return { svg: "", box: { x: 300, y: 360, size: 54, anchor: "middle", fontFamily } };
  const size = titleFontSize(title, spec.scale || 1);
  const tracking = spec.tracking ?? 4;
  const anchor = spec.anchor || "middle";
  const x = spec.x ?? 300;
  const y = spec.y ?? 360;
  const rotate = spec.rotate || 0;
  const transform = rotate ? ` transform="rotate(${rotate} ${x} ${y})"` : "";

  if (spec.mode === "vertical") {
    const chars = [...title]
      .map((ch, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : Math.round(size * 0.95)}">${escapeXml(ch)}</tspan>`)
      .join("");
    const svg = `<text y="${y}" font-family="${fontFamily}" font-size="${size}" font-weight="700" fill="#ffffff" stroke="#111" stroke-width="2.6" paint-order="stroke" filter="url(#titleShadow)">${chars}</text>`;
    return { svg, box: { x, y, size, anchor: "middle", fontFamily } };
  }

  let extras = "";
  if (spec.boxed) {
    const w = Math.min(520, Math.max(220, [...title].length * size * 0.9 + 40));
    const h = size + 36;
    extras += `<rect x="${x - w / 2}" y="${y - size}" width="${w}" height="${h}" rx="4" fill="rgba(0,0,0,0.35)" stroke="rgba(255,255,255,0.55)" stroke-width="1.5"/>`;
  }
  if (spec.card) {
    extras += `<rect x="70" y="${y - 90}" width="460" height="220" rx="10" fill="rgba(0,0,0,0.42)" stroke="rgba(255,255,255,0.25)" stroke-width="1"/>`;
  }
  if (spec.rule) {
    extras += `<rect x="${Math.max(40, x - 160)}" y="${y + 12}" width="320" height="3" fill="#ffffff" opacity="0.75"/>`;
  }

  const svg = `${extras}<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${fontFamily}" font-size="${size}" font-weight="700" fill="#ffffff" stroke="#111" stroke-width="2.8" paint-order="stroke" filter="url(#titleShadow)" letter-spacing="${tracking}"${transform}>${escapeXml(title)}</text>`;
  return { svg, box: { x, y, size, anchor, fontFamily } };
}

function renderHook(text, spec, fontFamily) {
  if (!spec || !text) return "";
  const rotate = spec.rotate ? ` transform="rotate(${spec.rotate} ${spec.x} ${spec.y})"` : "";
  const lines = wrapByPunctuation(text, { maxLen: 22, maxLines: spec.maxLines || 1 });
  if (lines.length <= 1) {
    return `<text x="${spec.x}" y="${spec.y}" text-anchor="${spec.anchor || "start"}" font-family="${fontFamily}" font-size="${spec.size || 14}" fill="#f5f7fa" filter="url(#titleShadow)"${rotate}>${escapeXml(lines[0] || text)}</text>`;
  }
  const tspans = lines
    .map((line, i) => `<tspan x="${spec.x}" dy="${i === 0 ? 0 : 22}">${escapeXml(line)}</tspan>`)
    .join("");
  return `<text y="${spec.y}" text-anchor="${spec.anchor || "start"}" font-family="${fontFamily}" font-size="${spec.size || 14}" fill="#f2f5f8" filter="url(#titleShadow)"${rotate}>${tspans}</text>`;
}

function renderBlurb(text, spec, fontFamily) {
  if (!spec || spec.mode === "none" || !text) return "";
  if (spec.mode === "verticalRail") {
    const chars = [...String(text)].slice(0, spec.maxChars || 28);
    const tspans = chars
      .map((ch, i) => `<tspan x="${spec.x}" dy="${i === 0 ? 0 : 15}">${escapeXml(ch)}</tspan>`)
      .join("");
    return `<text y="${spec.y}" font-family="${fontFamily}" font-size="${spec.size || 12}" fill="#e8eef5" opacity="0.9" filter="url(#titleShadow)">${tspans}</text>`;
  }
  const lines = wrapByPunctuation(text, {
    maxLen: spec.maxLen || 16,
    maxLines: spec.maxLines || 3,
  });
  const x = spec.x ?? 36;
  const anchor = spec.anchor || "start";
  const tspans = lines
    .map((line, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : 20}">${escapeXml(line)}</tspan>`)
    .join("");
  return `<text y="${spec.y}" text-anchor="${anchor}" font-family="${fontFamily}" font-size="${spec.size || 13}" fill="#e8eef5" opacity="0.92" filter="url(#titleShadow)">${tspans}</text>`;
}

export function renderCoverTypographySvg({
  title,
  copy,
  fontFamily,
  fontFaceCss,
  layout,
}) {
  const cfg = layout || COVER_LAYOUT_POOL[0];
  const { svg: titleSvg, box } = renderTitle(title, cfg.title, fontFamily);
  const tagsSvg = renderTagsAbsolute(copy.tags, cfg.tags, box);
  const hookTopSvg = renderHook(copy.hookTop, cfg.hookTop, fontFamily);
  const hookBottomSvg = renderHook(copy.hookBottom, cfg.hookBottom, fontFamily);
  const blurbSvg = renderBlurb(copy.blurb, cfg.blurb, fontFamily);
  const bandsSvg = renderBands(cfg.bands);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${COVER_WIDTH}" height="${COVER_HEIGHT}" viewBox="0 0 ${COVER_WIDTH} ${COVER_HEIGHT}">
  <defs>${commonDefs(fontFaceCss)}</defs>
  ${bandsSvg}
  ${hookTopSvg}
  ${blurbSvg}
  ${titleSvg}
  ${tagsSvg}
  ${hookBottomSvg}
</svg>`;
}
