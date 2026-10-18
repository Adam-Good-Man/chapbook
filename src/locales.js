/** 多语言市场：选题、文化逻辑、读者胃口按语种分离 */

export const LOCALE_POOL = ["zh"];

/** 当前固定全中文作品；保留常量便于以后再开多语 */
export const ZH_LOCALE_RATIO = 1;

export const LOCALES = {
  zh: {
    id: "zh",
    locale: "zh-CN",
    languageName: "中文",
    market: "华语网文市场（中国大陆为主，兼顾港澳台与海外华语读者）",
    script: "简体中文",
    untitled: "未命名",
    writingRule: "全程使用自然流畅的简体中文写作，口语与书面语搭配得当，避免翻译腔。",
    unitLabel: "字",
    genres: [
      "悬疑",
      "都市",
      "奇幻",
      "现实",
      "科幻",
      "历史",
      "喜剧",
      "恐怖",
      "爱情",
      "冒险",
    ],
    flavors: {
      悬疑: ["本格谜案", "信息差反转", "不可靠叙述", "闭环诡计"],
      都市: ["人情博弈", "职场暗战", "市井翻盘", "身份错位"],
      奇幻: ["规则怪谈", "一小片异世界", "代价魔法", "民俗志异"],
      现实: ["底层韧性", "家庭裂痕", "选择与代价", "黑色幽默日常"],
      科幻: ["近未来伦理", "一次实验失控", "记忆/身份", "封闭空间求生"],
      历史: ["一人一事", "边角史料脑洞", "名利局中人", "旅途偶遇"],
      喜剧: ["误会连环", "冷幽默", "夸张人设对撞", "一本正经胡说"],
      恐怖: ["心理压迫", "日常渗怪", "民俗恐怖", "细思极恐"],
      爱情: ["错过与重逢", "不对等心意", "欢喜冤家", "克制暧昧"],
      冒险: ["一趟险路", "寻物夺宝", "绝境抉择", "伙伴试炼"],
    },
    cultureBrief: `面向华语短篇读者：一场核心冲突、一个主情绪、一个主爆点。
开篇即入戏，中段加压与误导，反转须回收伏笔；可用诙谐/黑色幽默，忌注水与说明书腔。
篇幅自然完整即可，不为凑字。`,
    avoid: ["百万字连载式开书与分卷大纲", "无代价开挂", "空洞说教收束"],
  },
  en: {
    id: "en",
    locale: "en-US",
    languageName: "English",
    market: "English-language commercial fiction (US/UK/global Kindle & serial readers)",
    script: "English",
    untitled: "Untitled",
    writingRule:
      "Write the entire outline and prose in natural, contemporary English. No Chinese. Avoid translationese and AI clichés.",
    unitLabel: "words (approx.)",
    genres: [
      "Fantasy",
      "Science Fiction",
      "Thriller/Mystery",
      "Romance",
      "Horror",
      "Historical Fiction",
      "Literary/Contemporary",
      "Adventure",
      "Crime/Noir",
      "Young Adult",
      "Military/Techno-thriller",
    ],
    flavors: {
      Fantasy: ["epic high fantasy", "dark fantasy", "urban fantasy", "portal fantasy", "romantasy", "sword & sorcery"],
      "Science Fiction": ["near-future thriller", "space opera", "cyberpunk", "climate fiction", "first contact", "AI ethics"],
      "Thriller/Mystery": ["psychological thriller", "espionage", "detective procedural", "conspiracy", "domestic thriller"],
      Romance: ["contemporary romance", "enemies-to-lovers", "romantic suspense", "small-town romance"],
      Horror: ["folk horror", "cosmic horror", "psychological horror", "gothic"],
      "Historical Fiction": ["WWII / Cold War", "regency-adjacent society drama", "frontier / colonial tension handled carefully", "industrial-era intrigue"],
      "Literary/Contemporary": ["family saga", "workplace ambition", "immigrant story", "coming-of-age"],
      Adventure: ["survival", "heist", "treasure hunt", "exploration"],
      "Crime/Noir": ["neo-noir", "organized crime", "legal thriller"],
      "Young Adult": ["chosen-one with costs", "boarding-school intrigue", "dystopian resistance"],
      "Military/Techno-thriller": ["special ops", "geopolitical crisis", "defense-tech race"],
    },
    cultureBrief: `Think like a Western commercial novelist, NOT like a translated Chinese webnovel.
Do NOT use xianxia / cultivation / sect ranking / face-culture tropes unless the book is explicitly explaining an East-Asian-inspired secondary world to English readers with clear rules.
Prefer character psychology, agency, moral gray zones, and cause-effect that fits Anglo-American storytelling expectations.
Worldbuilding must feel earned; magic/tech systems need constraints; romance needs consent and emotional logic.
Market taste: strong hooks, chapter-ending tension, series potential, vivid voice.`,
    avoid: [
      "cultivation levels as default progression",
      "face-slapping young-master templates",
      "unexamined harem power fantasy",
      "copying Chinese court/sect politics without localization",
    ],
  },
  ja: {
    id: "ja",
    locale: "ja-JP",
    languageName: "日本語",
    market: "日本の商業小説・ライトノベル／エンタメ小説読者",
    script: "日本語（漢字かな混じり）",
    untitled: "未定稿",
    writingRule:
      "アウトラインも本文も自然な日本語で書く。中国語の直訳調・AI臭い言い回しを避ける。丁寧語と口語を場面に合わせて使い分ける。",
    unitLabel: "文字目安",
    genres: [
      "異世界ファンタジー",
      "ミステリー",
      "ホラー",
      "恋愛",
      "SF",
      "時代小説",
      "青春",
      "ビジネス／社会派",
      "バトル／ヒーローズ",
      "日常系ヒューマンドラマ",
    ],
    flavors: {
      異世界ファンタジー: ["転生もの（理屈を丁寧に）", "学園ファンタジー", "冒険パーティ", "ダークファンタジー"],
      ミステリー: ["本格推理", "警察小説", "日常の謎", "社会派ミステリー"],
      ホラー: ["怪談／民俗", "サイコホラー", "都市伝説"],
      恋愛: ["すれ違い恋愛", "職場恋愛", "再起の恋"],
      SF: ["近未来日本", "AI／ロボット倫理", "ディストピア"],
      時代小説: ["江戸市井", "幕末動乱", "剣と義理（現代読者に通じる動機で）"],
      青春: ["高校群像", "部活もの", "受験／進路"],
      "ビジネス／社会派": ["企業内抗争", "地方再生", "医療／司法"],
      "バトル／ヒーローズ": ["能力バトル", "組織対個人"],
      日常系ヒューマンドラマ: ["家族", "介護", "ご近所の絆"],
    },
    cultureBrief: `日本読者の「納得感」を優先：人間関係の機微、空気、恥／義理、組織内の上下、説明しすぎない余白。
中国式の修仙・宗門ランク上げ・打顔テンプレをそのまま持ち込まない。
異世界・能力ものでも、ルールと代償、日常描写、会話の自然さが必要。
ライトノベル寄りでも、キャラクターの欲求と選択が物語を動かすこと。`,
    avoid: ["無補正の中国網文テンプレ移植", "説明過多で余韻を殺す", "キャラ崩壊の都合主義"],
  },
  ko: {
    id: "ko",
    locale: "ko-KR",
    languageName: "한국어",
    market: "한국 웹소설·장르소설 독자",
    script: "한국어",
    untitled: "제목 미정",
    writingRule:
      "개요와 본문을 모두 자연스러운 한국어로 작성한다. 중국어 직역체·AI 투를 피한다.",
    unitLabel: "자(대략)",
    genres: [
      "판타지",
      "로맨스",
      "미스터리/스릴러",
      "현대물",
      "사극/시대",
      "SF",
      "공포",
      "스포츠/성장",
      "오피스/재벌서사",
      "회귀/빙의(한국식 규칙)",
    ],
    flavors: {
      판타지: ["모험 판타지", "학원물", "다크 판타지", "게임판타지(과도한 스탯창 남발 금지)"],
      로맨스: ["현대 로맨스", "로맨틱 서스펜스", "사극 로맨스"],
      "미스터리/스릴러": ["형사물", "사회파 미스터리", "심리 스릴러"],
      현대물: ["직장/생존", "가족 서사", "지역 공동체"],
      "사극/시대": ["궁중 암투", "조선 후기 시정", "일제강점기 주의깊게"],
      SF: ["근미래 한국", "디스토피아", "AI"],
      공포: ["민간설화", "도시괴담", "심령"],
      "스포츠/성장": ["팀 성장", "개인기량과 관계"],
      "오피스/재벌서사": ["기업 암투", "계급과 욕망(자극만으로 밀지 말 것)"],
      "회귀/빙의(한국식 규칙)": ["정보 우위와 대가", "복수보다 선택과 성장"],
    },
    cultureBrief: `한국 웹소설 독자의 호흡을 따를 것: 감정선, 관계 갈등, 속도감, 챕터 후킹.
중국식 수선(修仙)·종문 레벨업·일방적 참교육 클리셰를 그대로 옮기지 말 것.
회귀/빙의를 쓸 경우에도 한국 독자가 납득할 규칙·대가·인간관계를 세울 것.
재벌/계층 서사는 자극만이 아니라 동기와 윤리적 긴장이 필요.`,
    avoid: ["중국 무협/수선 템플릿 직이식", "설명 없는 사이다 전개", "여성/계층 대상화만으로 끌어가는 전개"],
  },
  ru: {
    id: "ru",
    locale: "ru-RU",
    languageName: "Русский",
    market: "Русскоязычная коммерческая проза (РФ/СНГ, самиздат и онлайн-платформы)",
    script: "Русский язык",
    untitled: "Без названия",
    writingRule:
      "Пиши план и текст целиком на естественном русском. Без китайского и кальки с китайских веб-новелл.",
    unitLabel: "знаков/слов (ориентир)",
    genres: [
      "Фэнтези",
      "Фантастика",
      "Детектив/триллер",
      "Историческая проза",
      "Роман",
      "Ужасы",
      "Приключения",
      "Современная проза",
      "Военная проза",
      "Городское фэнтези",
    ],
    flavors: {
      Фэнтези: ["эпическое", "тёмное", "славянский миф (аккуратно)", "магический реализм"],
      Фантастика: ["ближний космос", "антиутопия", "киберпанк", "альтернативная история"],
      "Детектив/триллер": ["полицейский роман", "шпионский", "психологический"],
      "Историческая проза": ["XX век", "имперская интрига", "фронтир / окраины"],
      Роман: ["современный", "исторический любовный", "меж двух миров без клише"],
      Ужасы: ["фольклорный", "психологический", "городская легенда"],
      Приключения: ["экспедиция", "выживание", "клады и тайны"],
      "Современная проза": ["семья", "провинция", "офис/карьера"],
      "Военная проза": ["современный конфликт (осторожно)", "тыл и судьба"],
      "Городское фэнтези": ["магия в мегаполисе", "тайные общества"],
    },
    cultureBrief: `Думай как русскоязычный жанровый автор: психологическая достоверность, тяжёлый выбор, атмосфера, социальный контекст.
НЕ переноси китайские «уровни культивации», секты и «пощёчины молодым господам» как базовый движок.
Если магия/сила роста — дай понятные ограничения и цену.
Читатель ценит характер, язык, моральную неоднозначность и ощущение мира, а не голый «апгрейд» статистики.`,
    avoid: [
      "шаблоны китайских веб-новелл без адаптации",
      "плоские антагонисты",
      "натужный патриотический пафос без характера",
    ],
  },
};

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

export function getLocale(id = "zh") {
  return LOCALES[id] || LOCALES.zh;
}

export function pickRandomLocale({ recentlyUsed = [] } = {}) {
  void recentlyUsed;
  return getLocale("zh");
}

export function formatCultureBrief(localeInfo) {
  if (!localeInfo) return "";
  const avoid = (localeInfo.avoid || []).map((s) => `- ${s}`).join("\n");
  return [
    `目标语言：${localeInfo.languageName}（${localeInfo.script}）`,
    `目标市场：${localeInfo.market}`,
    `写作语言硬性要求：${localeInfo.writingRule}`,
    `文化与叙事逻辑：\n${localeInfo.cultureBrief}`,
    avoid ? `明确避免：\n${avoid}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function editorSystemFor(language = "zh") {
  const L = getLocale(language);
  return `你是面向「${L.market}」的资深商业短篇小说总编兼大师级作者。
你必须用「${L.languageName}」的思维方式构思情节、人物动机与世界观，而不是把别的文化的网文模板硬套过来。

硬性要求：
- ${L.writingRule}
- 设定自洽，时间线清楚，人物动机充分，因果能闭环；禁止降智反派、能力无故崩坏、人设无故崩坏。
- 先 entice 后兑现：埋伏笔必须在后文回收，禁止开天窗。
- 人物要有辨识度：说话方式、行动逻辑、欲望和弱点互不相同。
- 开篇立刻抓人；冲突具体、代价可见；结尾有力或有余味。
- 剧情逻辑必须符合目标读者的历史认知、文化直觉与审美习惯；若借用异文化元素，必须在文本内建立可理解的规则。
- 禁止输出与正文无关的解释、免责声明、创作说明。
- 篇幅随剧情自然完成，禁止为凑整百整千而注水；也不必刻意打满上限。

文化锚点：
${L.cultureBrief}

明确避免：
${(L.avoid || []).map((s) => `- ${s}`).join("\n")}`;
}
