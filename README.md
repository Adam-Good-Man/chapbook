# Chapbook

本地短篇小说工坊。Chapbook 原指单独成册的短篇小书：先立纲，再成文。用兼容 OpenAI 的接口，把中文短篇从选题走到总纲、人工审核，再写成全文。默认只生产小说，不出封面、不出剧本。

篇幅落在大约 5000–30000 字。流程要求故事完整、逻辑能闭环，不为凑字注水，也不预设一个必须打满的字数。

## 它做什么

1. 选题：工厂或 `--auto` 从中文题材池里抽大类和细分，并带上写作手法。
2. 总纲：生成创作圣经（书名、简介、世界观、人物、卖点、主题、节拍、伏笔、结局方向），写成 `大纲/00-总纲.md` 和 `大纲/outline.json`。
3. 审核：状态停在 `review`，等人 `approve` 或 `reject`。
4. 正文：通过后一次写成 `正文/全文.md`。偏短会续写一次；超过上限时保留前文、只重写结尾，失败才本地裁切。
5. 按需：剧本（`npm run script`）、封面（需在 `.env` 打开 `COVER_ENABLED=1`）。

无人值守时用 `npm run factory`：先续办中断稿，再连开新篇。每波默认 10 篇。

## 架构

```
CLI (src/index.js)
        │
        ├─ factory.js     队列、续办、连开
        ├─ shortStory.js  总纲 + 正文
        ├─ genres.js      中文题材 / 手法
        ├─ locales.js     语言与编辑口吻（当前固定简体中文）
        ├─ llm.js         流式对话、JSON、超时重试、代理
        ├─ store.js       content/<书名>/ 读写
        ├─ script.js      按需视频剧本
        ├─ covers.js      按需封面（默认关闭）
        └─ config.js      .env、字数与 token 上限
```

请求经 `llm.js` 走官方或兼容接口。本机代理用 `HTTPS_PROXY`（例如 Clash）。模型名、推理档位、超时都在 `.env`。

写作约束在 `rules/`（结构、人物、对话、结尾、失败模式）和 `src/shortCraft.js`（题材、手法）。`src/shortMaster.js` 是审稿与定向改稿模块，产出可落在 `审稿/`；默认生产路径以总纲和正文为准。

旧的长篇分卷代码（`outline.js`、`produce.js`）还在仓库里，当前命令不再默认走长篇。

### 单篇目录

```
content/<书名>/
  meta.json
  大纲/00-总纲.md
  大纲/outline.json
  正文/全文.md
  状态/memory.json
  剧本/          # 仅 npm run script
  封面/          # 仅 COVER_ENABLED=1
  审稿/          # 若跑了审稿改稿
```

`meta.status` 大致是：`draft` → `outlining` → `review` → `approved` → `producing` → `done`（或 `paused` / `rejected`）。

## 环境

- Node.js 18+
- OpenAI API Key（或兼容网关）

```bash
cp .env.example .env
# 填写 OPENAI_API_KEY，按需填写 HTTPS_PROXY、OPENAI_MODEL
npm install
```

不要把 `.env` 提交到仓库。

## 常用命令

```bash
npm start                         # 交互菜单
npm run new -- --auto             # 随机中文题材，生成总纲
npm run new -- --genre 悬疑 --title 书名
npm run list
npm run approve -- <slug>
npm run produce -- <slug>         # 写全文
npm run resume -- <slug>          # 续未完成的总纲
npm run factory -- --once         # 工厂只跑一轮
npm run factory:status
npm run script -- <slug>          # 按需剧本
npm run status -- <slug>
```

工厂默认自动通过总纲并直接写正文。手动 `new` 会停在审核，需要 `approve` 后再 `produce`。

## 配置要点

| 变量 | 作用 |
|------|------|
| `OPENAI_MODEL` | 对话模型 |
| `OPENAI_BASE_URL` | 兼容网关；官方可留空 |
| `HTTPS_PROXY` | 本机代理 |
| `OUTLINE_REASONING_EFFORT` / `CHAPTER_REASONING_EFFORT` | 总纲 / 正文推理档位 |
| `SHORT_WRITE_MAX_TOKENS` | 正文单次输出上限 |
| `AUTO_SCRIPT` | `1` 时生产完自动出剧本，默认 `0` |
| `COVER_ENABLED` | `1` 时允许封面，默认 `0` |

## 开源说明

生成的小说、封面、运行队列在 `content/` 和 `factory-state.json`，已列入 `.gitignore`。密钥只放在本地 `.env`。

生成文本的著作权与平台投稿合规由使用者自行负责。若目标赛事或平台禁止 AI 生成或辅助，不要用本仓库的产出去投稿。
