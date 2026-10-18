export function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        args[key] = true;
      } else {
        args[key] = next;
        i += 1;
      }
    } else {
      args._.push(token);
    }
  }
  return args;
}

export function sanitizeName(name, fallback = "untitled") {
  const cleaned = String(name || "")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || fallback;
}

export function pad(num, width) {
  return String(num).padStart(width, "0");
}

export function countChars(text) {
  const body = String(text || "")
    .replace(/^#.+$/m, "")
    .replace(/\s+/g, "");
  return body.length;
}

export function slugify(title) {
  return folderNameFromTitle(title);
}

export function folderNameFromTitle(title) {
  const safe = sanitizeName(title, "未命名").replace(/\s+/g, "").slice(0, 40);
  return safe || "未命名";
}

export function draftFolderName() {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `草稿-${stamp}-${Math.random().toString(36).slice(2, 6)}`;
}

export function extractJson(raw) {
  const text = String(raw || "").trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("模型未返回可解析的 JSON。");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

export function clip(text, max) {
  const value = String(text || "");
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
}

/** 取文本尾部，用于续写/记忆等「保衔接」上下文 */
export function clipTail(text, max) {
  const value = String(text || "");
  if (value.length <= max) return value;
  return `…${value.slice(-max)}`;
}

export function formatNumber(n) {
  return Number(n || 0).toLocaleString("zh-CN");
}

export function parseWordTarget(input) {
  if (input === undefined || input === null || input === "") return null;
  const raw = String(input).trim().toLowerCase().replace(/,/g, "");
  let n = Number(raw);
  if (Number.isNaN(n)) {
    const wan = raw.match(/^(\d+(?:\.\d+)?)万$/);
    if (wan) n = Number(wan[1]) * 10_000;
  }
  if (Number.isNaN(n)) {
    throw new Error(`无法解析目标字数：${input}`);
  }
  return Math.round(n);
}

export function volumeDirName(volume) {
  return `第${pad(volume.index, 2)}卷-${sanitizeName(volume.title, `卷${volume.index}`)}`;
}

export function chapterFileName(chapter) {
  return `第${pad(chapter.globalIndex || chapter.index, 3)}章-${sanitizeName(chapter.title, `章${chapter.index}`)}.md`;
}
