import { AVG_CHAPTER_CHARS } from "./config.js";
import { formatNumber } from "./text.js";
import { editorSystemFor, getLocale } from "./locales.js";

/** @deprecated 请用 editorSystemFor(language) */
export const EDITOR_SYSTEM = editorSystemFor("zh");

export { editorSystemFor };

export function biblePrompt({
  genre,
  title,
  targetChars,
  extra,
  autoPick,
  deferTitle = false,
  genreBrief = "",
  language = "zh",
  cultureBrief = "",
}) {
  const L = getLocale(language);
  const chapterEstimate = Math.round(targetChars / AVG_CHAPTER_CHARS);
  const volumeEstimate = Math.min(14, Math.max(10, Math.round(chapterEstimate / 24)));
  const titleRule = title && !deferTitle
    ? `Title is fixed: ${title}. The JSON "title" field MUST use this exact title.`
    : `Do not finalize the commercial title yet: set "title" to "${L.untitled}" for now; a later step will name it from the full outline.`;

  let genreRule;
  if (genre) {
    genreRule = `Genre is fixed: ${genre}. Keep this genre; put a finer direction in subgenre. Do not silently switch genres.`;
  } else if (autoPick) {
    genreRule = `Pick one commercially viable genre for ${L.market} from: ${(L.genres || []).join(", ")}.`;
  } else {
    genreRule = `Choose a clear genre/subgenre suitable for ${L.market}.`;
  }

  return `Create a compact novel bible JSON for a long-form commercial novel aimed at: ${L.market}.

LANGUAGE (HARD):
- ${L.writingRule}
- All human-readable string fields (title placeholder, synopsis, logline, character names/speech notes, volume titles/summaries, themes, etc.) MUST be written in ${L.languageName}.
- Think in ${L.languageName} narrative logic. Do NOT transplant another culture's webnovel template (e.g. Chinese xianxia cultivation ranks) unless this market's readers already accept that frame AND you explain the rules inside the story world.

CULTURE / AUDIENCE FIT:
${cultureBrief || L.cultureBrief}
${(L.avoid || []).length ? `Avoid:\n${L.avoid.map((s) => `- ${s}`).join("\n")}` : ""}

RESEARCH MINDSET (before inventing plot):
- Internally check: Would a typical reader in this market find motives, institutions, status, violence, romance, and humor believable?
- Prefer history, social norms, aesthetics, and conflict patterns familiar to ${L.languageName} readers (or carefully introduced secondary-world rules).
- If you borrow another culture's tropes, localize them: explain rules in-world; do not assume readers share that civilization's commonsensical "levels / sects / face".
- Outline must aim at mainstream commercial appetite for this market, not a translated Chinese webnovel skeleton.

COMMERCIAL / CONTRACT-REVIEW QUALITY (HARD when writing for storefront editors):
- One crystal-clear CORE ENGINE the reader can say in one sentence (who wants what, under what irreversible pressure, with what unique leverage). Put it in logline + sellingPoints[0].
- The core must be visible by chapter 1–3: concrete stake, concrete opponent/system, concrete promise of escalation—not vague atmosphere.
- sellingPoints: 3–5 punchy, differentiated hooks (avoid empty “热血/逆袭/真相” without mechanism).
- synopsis must make the reading promise obvious; do not hide the main conflict behind poetic fog.
- Prefer a sharp, high-concept premise over a generic template with swapped names.
- Early chapters must earn retention: scene conflict, information surprise, or costly choice every chapter; ending hooks that change the situation.

Constraints:
- ${genreRule}
${genreBrief ? `- Brief:\n${genreBrief}` : ""}
- ${titleRule}
- Target length about ${formatNumber(targetChars)} ${L.unitLabel}; use irregular numbers, avoid round millions.
- Must include synopsis (200-400 ${L.unitLabel} of immersive blurb, no ending spoilers).
- Plot logic: desire → obstacle → choice → cost → new situation.
- Volume structure must vary; do not repeat the same escalation every volume.
- Keep JSON compact and complete in one response.
${extra ? `- Extra: ${extra}` : ""}

Return JSON:
{
  "title": "",
  "language": "${L.id}",
  "locale": "${L.locale}",
  "genre": "",
  "subgenre": "",
  "targetWordCount": number,
  "synopsis": "",
  "logline": "",
  "sellingPoints": ["", ""],
  "tone": "",
  "audience": "",
  "themes": [""],
  "ending": "",
  "world": {
    "era": "",
    "setting": "short",
    "rules": ["3-5"],
    "factions": [{"name": "", "goal": "", "method": "", "conflict": ""}]
  },
  "characters": [{
    "name": "", "role": "", "age": "", "personality": "",
    "desire": "", "weakness": "", "arc": "", "speech": "", "relationships": ""
  }],
  "mainPlot": "short",
  "subplots": ["", ""],
  "hiddenPlot": "",
  "volumes": [{
    "index": 1,
    "title": "",
    "phase": "",
    "summary": "short",
    "targetWordCount": number,
    "estimatedChapters": number,
    "climax": "",
    "hook": "",
    "focusCharacters": [""]
  }]
}

About 8 characters; about ${volumeEstimate} volumes; each volume 10-20 chapters, not uniform. No chapter-by-chapter outline here.`;
}

/** 大纲全部完成后，据总纲与分卷理性拟定正式书名 */
export function titleFromOutlinePrompt(bible) {
  const L = getLocale(bible.language || "zh");
  const volumes = (bible.volumes || [])
    .slice(0, 14)
    .map((v) => `Vol.${v.index}「${v.title || ""}」: ${(v.summary || "").slice(0, 60)}`)
    .join("\n");
  const chaptersSample = (bible.volumes || [])
    .flatMap((v) => v.chapters || [])
    .slice(0, 12)
    .map((c) => `#${c.globalIndex} ${c.title}`)
    .join(" / ");
  const leads = (bible.characters || [])
    .slice(0, 5)
    .map((c) => `${c.name} (${c.role})`)
    .join("; ");

  return `You are a senior acquiring editor for ${L.market}.
The full outline is done. Propose a final commercial title IN ${L.languageName}.

Rules:
- Fit genre, conflict, protagonist situation, and selling points; no empty grand words.
- Title must feel native to ${L.languageName} bookstore / storefront search habits (not a translated Chinese webnovel title pattern unless language is Chinese).
- For Chinese: prefer 2–8 characters. For English: punchy 1–6 words or a short phrase. For Japanese/Korean/Russian: follow local commercial title norms.
- No ending spoilers. Give a short reason (<= 60 words equivalent).
- Draft title now: 「${bible.title || L.untitled}」— keep or refine with reason.

Work info:
- language: ${L.id} / ${L.locale}
- genre: ${bible.genre || ""}${bible.subgenre ? ` / ${bible.subgenre}` : ""}
- tone: ${bible.tone || ""}
- logline: ${bible.logline || ""}
- selling points: ${(bible.sellingPoints || []).join(" | ")}
- themes: ${(bible.themes || []).join(", ")}
- leads: ${leads}
- synopsis: ${bible.synopsis || ""}
- main plot: ${(bible.mainPlot || "").slice(0, 280)}
- volumes:
${volumes || "(none)"}
- early chapter titles: ${chaptersSample || "(none)"}

Return JSON only:
{
  "title": "final title in ${L.languageName}",
  "reason": "short rationale in ${L.languageName}"
}`;
}

export function volumeChaptersPrompt({
  bible,
  volume,
  startGlobalIndex,
  batchStartIndex,
  batchCount,
  previousChapters = [],
}) {
  const L = getLocale(bible.language || "zh");
  const prev = previousChapters
    .slice(-3)
    .map((c) => `#${c.globalIndex} ${c.title}: ${c.endingHook || c.summary || ""}`)
    .join("\n");

  return `Generate a small batch of slim chapter outlines for this volume. No long analysis.
Write ALL strings in ${L.languageName}. Narrative logic must fit ${L.market}.

Title: ${bible.title} | ${bible.genre}
Volume ${volume.index}「${volume.title}」: ${volume.summary}
Climax: ${volume.climax || ""}
Volume hook: ${volume.hook || ""}
Cast: ${(bible.characters || []).slice(0, 8).map((c) => c.name).join(", ")}
${prev ? `Continuity:\n${prev}` : "First batch of this volume."}

Requirements:
- Exactly ${batchCount} chapters.
- Local index from ${batchStartIndex}; globalIndex from ${startGlobalIndex}.
- Each chapter: short title, one plot sentence, one ending hook.
- Specific causality; hooks must compel the next click.
- Vary scene/conflict shapes; genre = ${bible.genre}${bible.subgenre ? ` / ${bible.subgenre}` : ""}.
- Do not copy the bible; no essay tone. Complete JSON.

Return:
{
  "volumeIndex": ${volume.index},
  "chapters": [
    {
      "index": ${batchStartIndex},
      "globalIndex": ${startGlobalIndex},
      "title": "short title",
      "summary": "plot beat",
      "pov": "pov",
      "endingHook": "hook"
    }
  ]
}`;
}

export function chapterPrompt({ bible, volume, chapter, nextChapters, memory, previousEnding }) {
  const L = getLocale(bible.language || "zh");
  const next = (nextChapters || [])
    .map((item) => `#${item.globalIndex} ${item.title}: ${item.summary}`)
    .join("\n");

  return `Write one full chapter of the novel body, following the approved outline.

LANGUAGE (HARD): ${L.writingRule}
Market: ${L.market}
Culture logic: keep motives/cause-effect believable for readers of this market; do not smuggle alien webnovel templates.

Title: ${bible.title}
Genre: ${bible.genre}
Tone: ${bible.tone}
World rules: ${(bible.world?.rules || []).join("; ")}
Volume: ${volume.title}${volume.phase ? ` (${volume.phase})` : ""}
Chapter: #${chapter.globalIndex} ${chapter.title}
POV: ${chapter.pov || "as outlined"}
Beat: ${chapter.summary}
Ending hook: ${chapter.endingHook || ""}

Next two chapters (foreshadow only, do not finish their plots):
${next || "Near volume end; land the rhythm."}

Continuity:
timeline: ${memory.timeline || "as prior"}
characterStates: ${JSON.stringify(memory.characterStates || [], null, 0)}
unresolvedHooks: ${(memory.unresolvedHooks || []).join("; ") || "none"}
revealedSecrets: ${(memory.revealedSecrets || []).join("; ") || "none"}
recentEvents: ${(memory.recentEvents || []).join("; ") || "none"}

Previous ending (must continue naturally):
${previousEnding || "This is chapter 1."}

Writing rules:
- Output ONLY chapter prose. First line Markdown heading: # ${chapter.globalIndex} ${chapter.title}
  (keep the number; title text in ${L.languageName})
- Length about ${chapter.quota?.target || 7200} ${L.unitLabel}, within ${chapter.quota?.min || 5300}-${chapter.quota?.max || 9600}.
- No round padding; no word-count footer.
- Full scenes, dialogue, interiority; no outline/bullet/essay voice.
- Enter conflict or suspense quickly; end on a real hook.
- Dialogue matches character speech notes; power/cost logic consistent.
- Fit genre (${bible.genre}${bible.subgenre ? ` / ${bible.subgenre}` : ""}); avoid repeating prior chapter shapes mechanically.
- Do not include author notes or stats.`;
}

export function continueChapterPrompt({ chapter, currentChars, targetMin, targetMax }) {
  return `上一轮正文偏短。当前约 ${currentChars} 字，请继续写到大约 ${targetMin} 字以上、不超过 ${targetMax} 字。
请从上次截断处继续第${chapter.globalIndex}章《${chapter.title}》，用必要的场面和对话补完。
硬性：不要注水；不要重复已给出的章末片段；不要重写开头标题；不要改写已发生的事实。
只输出续写部分。`;
}

export function tightenChapterPrompt({ chapter, currentChars, targetMax }) {
  return `上一轮正文过长（约 ${currentChars} 字）。请把第${chapter.globalIndex}章《${chapter.title}》收束到大约 ${targetMax} 字以内，保留全部关键情节、人物动机和章末钩子。
压缩后的篇幅不要落在整百或整千。只输出完整一章，开头保留标题行。`;
}

export function memoryPrompt({ bible, volume, chapter, chapterText, prevMemory, tailChars = 2500 }) {
  const body = String(chapterText || "");
  const excerpt =
    body.length <= tailChars ? body : `…（前文省略，以下为章末 ${tailChars} 字）\n${body.slice(-tailChars)}`;

  return `根据刚刚完成的章节，更新连载连续性备忘。只返回 JSON，不要解释。
重点提取：人物状态变化、地点、新目标、未回收钩子、已揭露信息、关系变化；不要遗漏章中段已揭示、章末仍有效的关键事实。

书名：${bible.title}
章节：第${chapter.globalIndex}章《${chapter.title}》 / 第${volume.index}卷《${volume.title}》
旧备忘：${JSON.stringify(prevMemory)}

本章正文摘录（章末优先，供提取状态；可能不是全文）：
${excerpt}

返回：
{
  "timeline": "更新后的时间位置",
  "characterStates": [{"name": "", "status": "", "location": "", "goal": ""}],
  "unresolvedHooks": ["尚未回收的钩子"],
  "revealedSecrets": ["读者已经知道的关键信息"],
  "recentEvents": ["最近3-6件要事"],
  "relationships": ["关系变化"],
  "lastChapterEnding": "摘录章末 400 字以内，供下一章承接"
}`;
}

/** 续写/记忆用的短 system，避免每次重复超长总编 brief（主写章仍用完整 editorSystemFor） */
export function lightEditorSystemFor(language = "zh") {
  const L = getLocale(language);
  return `你是「${L.market}」连载小说 continuity 助手。用${L.languageName}工作。
只做当前任务：续写、压缩或更新备忘。保持人物动机、时间线、已揭示事实与上一上下文一致；禁止推翻已写情节；禁止输出创作说明。`;
}

export function renderBibleMarkdown(bible) {
  const characters = (bible.characters || [])
    .map(
      (c) =>
        `### ${c.name}（${c.role || ""}）\n- 年龄：${c.age || ""}\n- 性格：${c.personality || ""}\n- 欲望：${c.desire || ""}\n- 弱点：${c.weakness || ""}\n- 弧光：${c.arc || ""}\n- 说话：${c.speech || ""}\n- 关系：${c.relationships || ""}`,
    )
    .join("\n\n");

  const volumes = (bible.volumes || [])
    .map(
      (v) =>
        `### 第${v.index}卷 ${v.title}\n- 阶段：${v.phase || ""}\n- 目标字数：${formatNumber(v.targetWordCount || 0)}\n- 预计章数：${v.estimatedChapters || 0}\n- 高潮：${v.climax || ""}\n- 卷末钩子：${v.hook || ""}\n- 重点人物：${(v.focusCharacters || []).join("、")}\n\n${v.summary || ""}`,
    )
    .join("\n\n");

  return `# 《${bible.title}》· 总纲

- 书名：${bible.title}
- 类型：${bible.genre}${bible.subgenre ? ` / ${bible.subgenre}` : ""}
- 目标字数：${formatNumber(bible.targetWordCount)}
- 目标读者：${bible.audience || ""}
- 文风：${bible.tone || ""}

## 作品简介

${bible.synopsis || ""}

## 一句话卖点

${bible.logline || ""}

## 卖点

${(bible.sellingPoints || []).map((s) => `- ${s}`).join("\n")}

## 主题

${(bible.themes || []).map((s) => `- ${s}`).join("\n")}

## 主线

${bible.mainPlot || ""}

## 支线

${(bible.subplots || []).map((s) => `- ${s}`).join("\n")}

## 暗线

${bible.hiddenPlot || ""}

## 终局方向

${bible.ending || ""}

## 世界观

- 时代：${bible.world?.era || ""}

${bible.world?.setting || ""}

### 规则

${(bible.world?.rules || []).map((s) => `- ${s}`).join("\n")}

### 势力

${(bible.world?.factions || [])
  .map((f) => `- **${f.name}**：诉求=${f.goal}；手段=${f.method}；冲突=${f.conflict}`)
  .join("\n")}

## 人物

${characters}

## 分卷

${volumes}
`;
}

export function renderVolumeMarkdown(volume) {
  const chapters = (volume.chapters || [])
    .map((c) => {
      const lines = [`### 第${c.globalIndex}章 ${c.title}`, c.summary || ""];
      if (c.endingHook) lines.push(`钩子：${c.endingHook}`);
      return lines.filter(Boolean).join("\n");
    })
    .join("\n\n");

  return `# 第${volume.index}卷 ${volume.title}

- 阶段：${volume.phase || ""}
- 章数：${(volume.chapters || []).length}
- 高潮：${volume.climax || ""}
- 卷末钩子：${volume.hook || ""}

## 本卷概述

${volume.summary || ""}

## 逐章细纲

${chapters}
`;
}

export function renderCatalogMarkdown(bible) {
  const lines = [];
  for (const volume of bible.volumes || []) {
    lines.push(`## 第${volume.index}卷 ${volume.title}`);
    for (const chapter of volume.chapters || []) {
      lines.push(`- 第${chapter.globalIndex}章 ${chapter.title}：${chapter.summary?.slice(0, 40) || ""}`);
    }
    lines.push("");
  }
  return `# 《${bible.title}》· 卷章目录\n\n${lines.join("\n")}\n`;
}

/** 根据总纲生成 3 套「底图+排版」都迥异的封面方案 */
export function coverConceptsPrompt(bible, { count = 3, width = 600, height = 800, penName = "龙龙老表" } = {}) {
  const L = getLocale(bible.language || "zh");
  const volumes = (bible.volumes || [])
    .slice(0, 6)
    .map((v) => `Vol.${v.index} ${v.title || ""}: ${(v.summary || "").slice(0, 80)}`)
    .join("\n");
  const beats = (bible.beats || [])
    .slice(0, 8)
    .map((b) => `${b.index}. [${b.purpose || ""}] ${b.title || ""}: ${(b.summary || "").slice(0, 60)}`)
    .join("\n");
  const leads = (bible.characters || [])
    .slice(0, 4)
    .map((c) => `${c.name} (${c.role})`)
    .join("; ");

  const copyHint =
    L.id === "zh"
      ? `- tags: 3–4 short Chinese tags, 2–6 chars each
- hookTop: one hook line, 12–20 chars
- blurb: 36–60 chars
- hookBottom: one complete aftertaste/question, 14–22 chars
- styleLabel / mood / palette: Chinese`
      : `- tags / hookTop / blurb / hookBottom / styleLabel / mood / palette: ALL in ${L.languageName}
- Keep copy short enough for a ${width}x${height} cover overlay (punchy, commercial)
- Do NOT write Chinese unless language is Chinese`;

  return `You are a commercial book-cover art director for ${L.market}.
Design for one novel:
1) shared overlay copy
2) ${count} distinctly different base-art concepts

LANGUAGE (HARD): ${L.writingRule}
Copy language: ${L.languageName} only.

Copy rules:
${copyHint}

Notes: layout is chosen later by software from ~30 presets; keep copy short and strong.

Hard rules:
- The ${count} image styles must be clearly different (ink/oil/cyber-neon/woodcut/photo/minimal symbol, etc.), not filter variants.
- Visuals must fit genre + plot; portrait ${width}x${height}.
- imagePrompt MUST be English; no book title, tags, author, seal, or logo in the image.
- Leave a relatively clean area for title typography.
- Aesthetic should fit ${L.languageName} bookstore taste, not a default Chinese webnovel cover look unless language is Chinese.

Work:
- Title: ${bible.title || ""}
- Genre: ${bible.genre || ""}${bible.subgenre ? ` / ${bible.subgenre}` : ""}
- Tone: ${bible.tone || ""}
- Selling points: ${(bible.sellingPoints || []).join("; ")}
- Synopsis: ${bible.synopsis || ""}
- Logline: ${bible.logline || ""}
- Main plot: ${(bible.mainPlot || "").slice(0, 220)}
- Core twist / emotion: ${bible.coreTwist || ""} / ${bible.coreEmotion || ""}
- Leads: ${leads}
- Volume moods:
${volumes || "(none)"}
- Short-story beats:
${beats || "(none)"}
- Pen name (do not put in imagePrompt): ${penName}

Return JSON only:
{
  "copy": {
    "tags": ["tag1", "tag2", "tag3", "tag4"],
    "hookTop": "short hook",
    "blurb": "blurb fragment",
    "hookBottom": "one complete aftertaste line"
  },
  "covers": [
    {
      "index": 1,
      "styleLabel": "style label in ${L.languageName}",
      "mood": "mood keywords",
      "palette": "palette description",
      "imagePrompt": "detailed English image prompt..."
    }
  ]
}`;
}

/** 视频生产用系列设定（角色/场景/美术/音频 bible） */
export function scriptSeriesBiblePrompt(bible, { aspectRatio = "9:16", defaultEpisodeSec = 90 } = {}) {
  const L = getLocale(bible.language || "zh");
  const chars = (bible.characters || [])
    .slice(0, 12)
    .map(
      (c) =>
        `- ${c.name} | ${c.role} | age=${c.age || "?"} | ${c.personality || ""} | desire=${c.desire || ""} | look notes=${c.speech || ""}`,
    )
    .join("\n");
  const factions = (bible.world?.factions || [])
    .slice(0, 8)
    .map((f) => `- ${f.name}: ${f.goal || ""} / ${f.method || ""}`)
    .join("\n");

  return `Build a VIDEO-PRODUCTION series bible from this novel outline.
This package will be fed into another video-generation program. Be concrete and machine-usable.

LANGUAGE (HARD):
- Human-readable story fields (names already given, personality, costume notes in cast, location descriptions, continuityRules) in ${L.languageName}.
- visualPrompt / referenceImagePrompt / style keywords for image/video models: English.
- ${L.writingRule}
- Narrative logic must fit ${L.market}; do not invent Chinese xianxia tropes unless language is Chinese and the outline already uses them.

Production defaults:
- aspectRatio: ${aspectRatio}
- defaultEpisodeDurationSec: ${defaultEpisodeSec}
- One novel chapter ≈ one episode (vertical short-drama friendly), cinematic clarity, shootable beats.

Novel:
- Title: ${bible.title || ""}
- Language: ${L.id}
- Genre: ${bible.genre || ""}${bible.subgenre ? ` / ${bible.subgenre}` : ""}
- Tone: ${bible.tone || ""}
- Logline: ${bible.logline || ""}
- Synopsis: ${(bible.synopsis || "").slice(0, 600)}
- World era/setting: ${bible.world?.era || ""} / ${bible.world?.setting || ""}
- Rules: ${(bible.world?.rules || []).join("; ")}
- Factions:
${factions || "(none)"}
- Characters:
${chars || "(none)"}
- Main plot: ${(bible.mainPlot || "").slice(0, 400)}
- Themes: ${(bible.themes || []).join("; ")}

Return JSON only:
{
  "production": {
    "format": "vertical_short_drama",
    "aspectRatio": "${aspectRatio}",
    "fps": 24,
    "resolution": "1080x1920",
    "defaultEpisodeDurationSec": ${defaultEpisodeSec},
    "language": "${L.id}",
    "subtitleLanguage": "${L.id}",
    "deliveryNotes": "short notes for the downstream video pipeline in ${L.languageName}"
  },
  "visualBible": {
    "artStyle": "",
    "colorPalette": "",
    "lighting": "",
    "cameraLanguage": "",
    "costumeEra": "",
    "vfxLevel": "none|light|heavy",
    "referenceNotes": ""
  },
  "audioBible": {
    "musicMood": "",
    "leitmotifs": [""],
    "sfxPalette": [""],
    "voiceStyle": "",
    "mixNotes": ""
  },
  "cast": [{
    "id": "char_01",
    "name": "",
    "role": "protagonist|antagonist|support",
    "ageLook": "",
    "genderPresentation": "",
    "appearance": "",
    "costumeDefault": "",
    "personality": "",
    "voice": "",
    "relationshipTags": [""],
    "referenceImagePrompt": "English consistent character design prompt"
  }],
  "locations": [{
    "id": "loc_01",
    "name": "",
    "type": "interior|exterior|liminal",
    "description": "",
    "timeVariants": ["day", "night"],
    "ambientAudio": "",
    "visualPrompt": "English location plate prompt"
  }],
  "props": [{
    "id": "prop_01",
    "name": "",
    "description": "",
    "storyFunction": "",
    "visualPrompt": "English prop prompt"
  }],
  "continuityRules": ["", ""],
  "episodePolicy": {
    "chapterToEpisode": "1:1",
    "targetScenesPerEpisode": "3-6",
    "targetShotsPerEpisode": "8-16",
    "mustEndOnHook": true
  }
}

Include all major named characters from the outline (stable ids char_01...). Invent locations/props needed for shootability. Keep compact but complete.`;
}

/** 按章节细纲批量生成分集剧本（场景+分镜） */
export function scriptEpisodesBatchPrompt({
  bible,
  seriesBible,
  chapters,
  previousEpisodeTail = "",
}) {
  const L = getLocale(bible.language || "zh");
  const cast = (seriesBible.cast || [])
    .slice(0, 16)
    .map((c) => `${c.id}:${c.name}(${c.role})`)
    .join("; ");
  const locs = (seriesBible.locations || [])
    .slice(0, 20)
    .map((l) => `${l.id}:${l.name}`)
    .join("; ");
  const chapterBlock = chapters
    .map(
      (c) =>
        `#${c.globalIndex} id=${c.id} vol=${c.volumeIndex} 「${c.title}」
beat: ${c.summary}
pov: ${c.pov || ""}
endingHook: ${c.endingHook || ""}`,
    )
    .join("\n\n");

  return `Convert the following novel chapter outlines into VIDEO EPISODE scripts for a downstream video-generation program.

LANGUAGE (HARD):
- Dialogue lines, scene plot/conflict/atmosphere, emotionalArc, hooks: ${L.languageName}.
- visualPrompt + videoPrompt + negativePrompt: English.
- Use cast.id / locations.id from the series bible whenever possible; if a new location is required, invent loc_temp_* and describe it.
- ${L.writingRule}

Series context:
- Title: ${bible.title}
- Genre: ${bible.genre}
- Visual: ${JSON.stringify(seriesBible.visualBible || {})}
- Audio: ${JSON.stringify(seriesBible.audioBible || {})}
- Cast: ${cast}
- Locations: ${locs}
- Continuity: ${(seriesBible.continuityRules || []).slice(0, 8).join(" | ")}
- Episode policy: ${JSON.stringify(seriesBible.episodePolicy || {})}
- Production: ${JSON.stringify(seriesBible.production || {})}

Previous episode closing (for continuity; do not repeat):
${previousEpisodeTail || "(series start)"}

Chapters to adapt (1 chapter = 1 episode; episode.index MUST equal chapter.globalIndex):
${chapterBlock}

For EACH episode:
- 3–6 scenes with clear plot beat, conflict, atmosphere
- 8–16 shots total across the episode
- Each shot: shootable action, camera, durationSec, English visualPrompt + videoPrompt
- Dialogue sparse but characterful; attach to shots when spoken on camera
- Open with a hook, close with a hook matching endingHook
- Keep durationSec near ${seriesBible.production?.defaultEpisodeDurationSec || 90}

Return JSON only:
{
  "episodes": [{
    "index": 1,
    "id": "ep_001",
    "title": "",
    "chapterRef": {
      "chapterId": "v1-c1",
      "volumeIndex": 1,
      "chapterIndex": 1,
      "globalIndex": 1,
      "chapterTitle": ""
    },
    "durationSec": 90,
    "logline": "",
    "plotSummary": "",
    "emotionalArc": "",
    "hookOpen": "",
    "hookClose": "",
    "castInEpisode": ["char_01"],
    "locationsUsed": ["loc_01"],
    "propsUsed": ["prop_01"],
    "bgmSuggestion": "",
    "scenes": [{
      "id": "sc_01",
      "index": 1,
      "title": "",
      "locationId": "loc_01",
      "locationName": "",
      "timeOfDay": "day|dusk|night|dawn",
      "weather": "",
      "atmosphere": "",
      "plot": "",
      "conflict": "",
      "characters": ["char_01"],
      "dialogue": [{
        "characterId": "char_01",
        "characterName": "",
        "line": "",
        "emotion": "",
        "delivery": ""
      }],
      "action": "",
      "shots": [{
        "id": "sh_01",
        "index": 1,
        "durationSec": 3,
        "shotType": "establishing|wide|medium|close-up|extreme-close-up|insert|pov|over-shoulder",
        "cameraMove": "static|push-in|pull-out|pan|tilt|orbit|handheld|tracking",
        "lens": "24mm|35mm|50mm|85mm",
        "composition": "",
        "action": "",
        "dialogue": { "characterId": "", "characterName": "", "line": "", "emotion": "" },
        "visualPrompt": "English still / keyframe prompt, consistent with cast & location",
        "videoPrompt": "English motion / camera / performance prompt",
        "negativePrompt": "text, watermark, logo, deformed hands",
        "audio": { "vo": "", "sfx": "", "bgm": "" },
        "transition": "cut|dissolve|whip|match"
      }]
    }]
  }]
}

Return exactly ${chapters.length} episodes in chapter order. No commentary.`;
}

export function renderScriptSeriesMarkdown(script) {
  const p = script.production || {};
  const v = script.visualBible || {};
  const a = script.audioBible || {};
  const cast = (script.cast || [])
    .map((c) => `- **${c.id} ${c.name}**（${c.role}）外观：${c.appearance || ""}；服装：${c.costumeDefault || ""}；声音：${c.voice || ""}`)
    .join("\n");
  const locs = (script.locations || [])
    .map((l) => `- **${l.id} ${l.name}**（${l.type}）：${l.description || ""}`)
    .join("\n");
  const props = (script.props || [])
    .map((x) => `- **${x.id} ${x.name}**：${x.description || ""}`)
    .join("\n");
  return `# 《${script.source?.title || ""}》· 视频剧系列设定

> schemaVersion=${script.schemaVersion || ""} ｜ 供下游视频生产程序读取 \`script.json\` + \`分集/*.json\`

## 制片参数
- 格式：${p.format || ""}
- 画幅：${p.aspectRatio || ""} @ ${p.resolution || ""} / ${p.fps || ""}fps
- 单集默认时长：${p.defaultEpisodeDurationSec || ""} 秒
- 语言：${p.language || ""}
- 交付说明：${p.deliveryNotes || ""}

## 视觉 bible
- 画风：${v.artStyle || ""}
- 色板：${v.colorPalette || ""}
- 光线：${v.lighting || ""}
- 镜头语言：${v.cameraLanguage || ""}
- 服化时代：${v.costumeEra || ""}
- 特效强度：${v.vfxLevel || ""}
- 备注：${v.referenceNotes || ""}

## 音频 bible
- 音乐气质：${a.musicMood || ""}
- 主题动机：${(a.leitmotifs || []).join("；")}
- 音效：${(a.sfxPalette || []).join("；")}
- 人声：${a.voiceStyle || ""}
- 混音：${a.mixNotes || ""}

## 角色卡
${cast || "（无）"}

## 场景库
${locs || "（无）"}

## 道具库
${props || "（无）"}

## 连贯性规则
${(script.continuityRules || []).map((r) => `- ${r}`).join("\n") || "（无）"}

## 分集进度
- 计划集数：${script.episodeIndex?.length || script.stats?.plannedEpisodes || "?"}
- 已完成：${script.stats?.completedEpisodes || 0}
`;
}

export function renderScriptEpisodeMarkdown(episode) {
  const scenes = (episode.scenes || [])
    .map((sc) => {
      const shots = (sc.shots || [])
        .map(
          (sh) =>
            `  - Shot ${sh.index} [${sh.shotType}/${sh.cameraMove}] ${sh.durationSec || "?"}s：${sh.action || ""}\n    visual: ${sh.visualPrompt || ""}\n    video: ${sh.videoPrompt || ""}`,
        )
        .join("\n");
      const dlg = (sc.dialogue || [])
        .map((d) => `  - ${d.characterName || d.characterId}：${d.line}`)
        .join("\n");
      return `### 场景 ${sc.index} ${sc.title || ""}
- 地点：${sc.locationName || sc.locationId}｜${sc.timeOfDay || ""}｜${sc.weather || ""}
- 氛围：${sc.atmosphere || ""}
- 剧情：${sc.plot || ""}
- 冲突：${sc.conflict || ""}
- 动作：${sc.action || ""}
- 对白：
${dlg || "  （无）"}
- 分镜：
${shots || "  （无）"}`;
    })
    .join("\n\n");

  return `# 第${episode.index}集 · ${episode.title || ""}

- id: ${episode.id}
- 对应章节: ${episode.chapterRef?.chapterId || ""} ${episode.chapterRef?.chapterTitle || ""}
- 时长: ${episode.durationSec || "?"}s
- logline: ${episode.logline || ""}
- 剧情摘要: ${episode.plotSummary || ""}
- 情绪弧: ${episode.emotionalArc || ""}
- 开场钩子: ${episode.hookOpen || ""}
- 收束钩子: ${episode.hookClose || ""}
- 出场: ${(episode.castInEpisode || []).join(", ")}
- 场景: ${(episode.locationsUsed || []).join(", ")}
- BGM: ${episode.bgmSuggestion || ""}

## 场景与分镜
${scenes}
`;
}



