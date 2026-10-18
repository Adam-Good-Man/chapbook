---
name: master-short-story
description: >-
  Write or revise Chinese short fiction to master-craft standards: hook in 120
  chars, fair twists, anti-AI-taste, dialogue that moves power, no padding.
  Use when producing short stories, polishing 全文.md, reviewing drafts for
  boredom, or improving generateText short-story output.
---

# 大师级华语短篇

目标：**让人想读下去**，不是正确、完整、空洞。

## 硬标准（违反即失败）

1. **开篇 120 字内**：反常行为 / 危险信息 / 不可调和欲望，至少一；禁天气、简历、世界观说明书、主题宣言。
2. **一场核心冲突 + 一个主情绪 + 一个主爆点**；人物选择必有代价。
3. **每约 800 字一次局势变化**（新信息、新阻碍、新选择）；禁流水账。
4. **反转公平**：至少三处可回看线索；改变意义，不突然换人设。
5. **对话推戏**：每句改变信息、关系或权力；禁正确废话。
6. **结尾忌说教**；主冲突的「选择」必须完成；可留白不可没写完。
7. **禁 AI 套话**：仿佛在诉说、不禁让人、心中涌起、复杂的情绪、命运的安排、阳光洒在、眼神中闪过、嘴角微微上扬、引人深思、内心深处……

## 本仓库流程

代码路径（优先改代码而非只聊天改稿）：

- 技法：`src/shortCraft.js`
- 生产：`src/shortStory.js`
- 大师化闭环：`src/shortMaster.js`（本地预检 → 六维审稿 → 读者弃读模拟 → 定向改稿，最多 2 轮）
- 产出：`content/<书名>/正文/全文.md`；审稿记录：`content/<书名>/审稿/`

命令：

```bash
npm run produce -- <slug>    # 写作含大师化
npm run polish -- <slug>     # 对已有全文再审改
```

关闭后处理（省钱）：`.env` 设 `SHORT_MASTER_PASS=0`。

## 改稿时怎么做

1. 先读总纲 `大纲/00-总纲.md` 与正文，对照开篇钩子、反转、伏笔是否落地。
2. 用六维诊断，每条问题必须引用原文：`hook / tension / character / logic / voice / ending`。
3. 只改 BLOCKING 与 MAJOR；不要为「优美」加字；优先删解释、加场面。
4. 改完再扫一遍黑名单与开篇 120 字。

## 不要做的事

- 不要堆形容词与情绪标签（「他感到悲伤」→ 写他做了什么）。
- 不要把故事「讲清楚」当目标；要让读者自己补一部分。
- 不要全文重写若只需修弃读点；根因修补，忌轮换文风。
