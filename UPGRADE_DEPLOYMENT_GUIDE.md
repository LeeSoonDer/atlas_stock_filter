# 落地指南 v2 — 谁贴哪、谁丢哪、什么时候

> 本次交付含:修正案四(情报简报)+ 修正案五(信号精化)+ CARD 07/08/09 + Radar patch v2/v3。
> 按下面分工与时序执行,别一次全上。

* * *

## 总览:三批,按时序

```
批次零(最高优先)      Radar patch v4 + CARD 10    → 修复死水缺陷
批次一(现在)          Radar patch v2 + CARD 08    → 立刻做,零风险
批次二(CARD06收官后)  CARD 07                     → 报告变情报简报长相
批次三(跑3-4周后)     CARD 09 + Radar patch v3    → 信号精化,需基线
```


* * *

## 批次零 — 最高优先(本次新增,修复结构性缺陷)

> 首次真实运行暴露:全部候选量比低于 1,产出死水标的。本批次修复此问题,并将 Atlas
> 定位校准为"热点挖掘器 + 埋伏"双引擎。**优先级高于批次一。**

### A. 手动贴 claude.ai(2分钟,立刻生效)

**Atlas Radar Project:**
1. Instructions 栏**末尾追加** `projects/ATLAS_RADAR_INSTRUCTIONS_PATCH_v4.md` 全文
2. Knowledge **上传** `constitution/ATLAS_AMENDMENT_NO6_CONTAGION.md`

贴完立刻生效:下次贴 payload,Radar 就会做**市场叙事扫描**(本周在炒什么 + 传导链拆解
+ 与量化足迹交叉印证)。**这部分完全靠 Radar 检索,不依赖 CARD 10。**

### B. 丢 Claude Code:CARD 10

复制进 repo:
* `constitution/ATLAS_AMENDMENT_NO6_CONTAGION.md`
* `cards/TASK_CARD_10.md`

```
读 cards/TASK_CARD_10.md 完整执行,commit per scope item。
先读 constitution/ATLAS_AMENDMENT_NO6_CONTAGION.md 作为授权依据。
本卡修复首次运行暴露的结构性缺陷,优先级高。
DONE-WHEN 通过后停下报告。
```

做完:活跃度地板杀死水标的 + 板块传导桶(第五桶)+ 热点占候选一半席位。

* * *

## 批次一 — 现在就做

### A. 手动贴 claude.ai(2分钟)

**Atlas Radar Project:**
1. Instructions 栏**末尾追加** `projects/ATLAS_RADAR_INSTRUCTIONS_PATCH_v2.md` 全文
2. Knowledge **上传** `constitution/ATLAS_AMENDMENT_NO4_THEME_RADAR.md`

**Atlas Red Team:** 不动(隔离铁律)

贴完立刻生效:下次贴 payload,Radar 就按七区块简报结构产出(大盘复盘 → 全板块扫描 → 主题雷达 → 双层候选 → 排除项 → 长白话)。

### B. 丢 Claude Code:CARD 08(防御闸)

先把这些文件复制进 repo:
* `constitution/ATLAS_AMENDMENT_NO5_SIGNAL_REFINEMENT.md` → repo `constitution/`
* `cards/TASK_CARD_08.md` → repo `cards/`

然后贴给 Claude Code:
```
读 cards/TASK_CARD_08.md 完整执行,commit per scope item。
先读 constitution/ATLAS_AMENDMENT_NO5_SIGNAL_REFINEMENT.md 作为授权依据。
DONE-WHEN 通过后停下报告。
```

**为什么 CARD 08 可以立刻做:** 纯防御性(信用熔断保护 SMALL_SPEC + 股价闸排除摩擦标的),不改变任何筛选逻辑,不需要运行基线就能判断价值。

* * *

## 批次二 — CARD 06 收官后

复制进 repo:
* `constitution/ATLAS_AMENDMENT_NO4_THEME_RADAR.md`
* `cards/TASK_CARD_07.md`
* `MOCKUP_intel_briefing_v4.html`(参照用,放 repo 根目录)

贴给 Claude Code:
```
读 cards/TASK_CARD_07.md 完整执行,commit per scope item。
先读 constitution/ATLAS_AMENDMENT_NO4_THEME_RADAR.md 作为授权依据。
参照 MOCKUP_intel_briefing_v4.html 的结构与视觉重构 HTML 报告。
DONE-WHEN 通过后停下报告。
```

做完:全 11 板块数据进 payload + 双层候选 + HTML 变情报简报长相。

* * *

## 批次三 — 跑完 3 至 4 个完整周期后

**启动条件必须满足**:你已经跑过至少 3 至 4 次完整周期(screen → Radar → 红队 → 裁决 → 账本)。

**理由**:CARD 09 改的是信号质量。没有运行基线,加了之后无法判断候选变好还是变坏。先有基线,再优化。这是防 overfitting 的纪律,不是拖延。

### A. 丢 Claude Code:CARD 09

```
读 cards/TASK_CARD_09_STANDBY.md 完整执行,commit per scope item。
授权依据:constitution/ATLAS_AMENDMENT_NO5_SIGNAL_REFINEMENT.md(修正案十五至十七)。
可按 Part A/B/C 分批执行,各 Part 相互独立。
DONE-WHEN 通过后停下报告。
```

含三部分:
* **Part A 隐性吸筹复合信号**:RS线时序新高 / 成交量干涸 / VWAP位置 / 内部人加权
* **Part B 期权情报**:仅候选池抓取,严禁参与筛选,只作情报给 Radar
* **Part C 质量旗标**:应计质量 + 现金跑道(SMALL_SPEC),均不淘汰

### B. 手动贴 claude.ai

**Atlas Radar Project:**
1. Instructions 栏**末尾追加** `projects/ATLAS_RADAR_INSTRUCTIONS_PATCH_v3.md` 全文
2. Knowledge **上传** `constitution/ATLAS_AMENDMENT_NO5_SIGNAL_REFINEMENT.md`

(patch v3 提前贴也无害——字段不存在时 Radar 按 `[不可得]` 处理。但建议 CARD 09 落地后再贴,避免混淆。)

* * *

## 关键红线(贯穿全部批次)

1. **应用层不生成判断文字** — 主题白话、板块定位、长总结全由 Radar 产出,应用层只算数据 + 渲染
2. **期权不参与筛选** — 只作情报给 Radar 解读,代码层强制隔离;严禁"巨鲸/内幕"类表述
3. **新旗标一律不淘汰** — 除最低股价闸外,所有新增信号都是加分或警示,不是硬闸
4. **红队 Project 永不接收这些材料** — 隔离是功能本体

* * *

## Radar Instructions 最终结构(贴完三份后)

```
[ATLAS_RADAR_INSTRUCTIONS.md]  ← 基础:辩护状六节结构、全部铁律
  ＋
[PATCH_v2]                     ← 七区块周报简报结构
  ＋
[PATCH_v3]                     ← 新信号解读规则与边界
  ＋
[PATCH_v4]                     ← 市场叙事扫描 + 传导候选验证
```

三份叠加,后者不覆盖前者。

Knowledge 累计上传:ATLAS_v1_0 + 修正案二/三/四/五/六 + 备忘录三/四。

* * *

## 一页速查

| 什么 | 贴哪/丢哪 | 何时 |
|---|---|---|
| **Radar PATCH_v4** | claude.ai Radar Instructions | **最优先** |
| **CARD 10** | Claude Code | **最优先** |
| 修正案六 | repo + Radar Knowledge | 最优先 |
| Radar PATCH_v2 | claude.ai Radar Instructions | 现在 |
| 修正案四 | claude.ai Radar Knowledge | 现在 |
| CARD 08 | Claude Code | 现在 |
| CARD 07 | Claude Code | CARD06收官后 |
| CARD 09 | Claude Code | 跑3-4周后 |
| Radar PATCH_v3 | claude.ai Radar Instructions | 跑3-4周后 |
| 修正案五 | repo + claude.ai Radar Knowledge | 随CARD08/09 |
