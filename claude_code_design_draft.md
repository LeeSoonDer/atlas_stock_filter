# Claude Code 指令 — Atlas 周报 HTML 重构（信息分层版 v2）

> 贴给 Claude Code。目标是把 `output/runs/<date>/report.html` 的生成逻辑改成下面这份分层规格。
> 设计稿参考：本 repo 之外的 mockup `Atlas Weekly Briefing.dc.html`（视觉基准，不要求代码同构）。

---

## 0. 铁律（先读，任何一条与下文冲突时以本节为准）

1. **仅改呈现层。** 允许改的：生成 HTML 的模块（TASK_CARD_05 交付，通常在 `src/report/`）+ 为分层所需的**纯确定性派生字段**。禁止改：宇宙构建、抓取、指标计算、四桶阈值、选取器容量。
2. **零 AI 推理、零新增外部依赖。** 报告仍是自包含单文件 HTML：inline `<style>` + 一个 Google Fonts `<link>` + 少量 vanilla JS。不引入任何 npm 包、构建步骤、CDN 脚本。
3. **不编造数据。** 任何字段缺失时输出 `不可得` 并保留三态标注 `[可得] / [不可得] / [未知]`。禁止用 0、`—` 或空字符串冒充数值。
4. **占位可见。** 研究层未填充的区域必须渲染成可见的斜体占位文案（如「判断 — 待研究层填充」），不得整块隐藏，也不得用假文本填满。
5. 改完在 `ai/decisions.md` 追加一条决策记录（改了什么、为什么、新增字段的定义）。`npm run typecheck` 与 `npm test` 必须通过。

---

## 1. 需要新增的确定性派生字段（唯一的引擎侧改动）

现在报告里看不出「为什么是这只」。新增两项，**纯算术，无判断**：

### 1.1 `footprintDetail`（每个 candidate / watchlist 条目）

检测器在判定时已经逐条比较过阈值——把这些比较结果**保留下来**而不是丢弃。结构：

```ts
type FootprintCondition = {
  bucket: BucketId;            // 归属哪个桶
  label: string;               // 人类可读条件描述，如 "布林带宽处于 90 天最窄 5% 分位"
  field: string;               // 源字段名，如 "bbWidthPct"
  actual: number | string | null;   // 实际值；不可得时 null
  threshold: string;           // 阈值表达式，如 "≤ 5.0"
  status: 'hit' | 'miss' | 'unavailable';
  availability: '可得' | '不可得' | '未知';
};
```

- 每个检测器（A 动能突破 / B 波动挤压 / C 超卖反转 / D 机构蓄势代理）在返回命中结果时同时返回它检查过的**全部**条件，含未命中项与不可得项。
- `label` 与 `threshold` 从 `config/detectors.json`、`config/card04.json` 的实际参数生成，**不要硬编码字面量**——阈值改了描述必须跟着改。
- 双桶命中的标的（如同时进 B 和 D）合并两个桶的条件清单，保留 `bucket` 字段以便分组显示。

### 1.2 `footprintStrength`

```
availableCount = footprintDetail.filter(c => c.status !== 'unavailable').length
hitCount       = footprintDetail.filter(c => c.status === 'hit').length
strengthRatio  = availableCount === 0 ? null : hitCount / availableCount
```

分档（写进 `config/card05.json`，不要写死在代码里）：

| ratio | band |
|---|---|
| ≥ 0.75 | `强` |
| ≥ 0.55 | `中` |
| ≥ 0.35 | `中偏弱` |
| < 0.35 | `弱` |
| null | `不可得` |

- **不可得项不参与分母**，也不算 miss。这一点必须在报告脚注里写明。
- 双桶命中不额外加权，但要在卡片上显示「双桶命中」标签。
- `strengthRatio === null` 的候选排在最后，band 显示 `不可得`，**不要**给它一根 0% 的进度条。

### 1.3 候选排序

候选列表由现有 round-robin 跨桶轮换选出（**不改选取逻辑**），仅**展示顺序**改为按 `strengthRatio` 降序，null 垫底。轮换产生的原始序号仍需保留在 `screen_run.json` 里，便于审计。

---

## 2. 报告结构 — 五个编号地层

整份报告从上到下是五层，**每层的字号、密度、表面处理都必须不同**。这是本次重构的核心；不要退化成一串长得一样的卡片。

页面容器：`max-width:1180px; margin:0 auto; padding:0 32px`。

### 地层带头（每层顶部统一样式）

```
[JetBrains Mono 11px, 编号 01–05] [10.5px 700 大写字距.16em 层名] [1px 横线撑满] [右侧 11.5px 元信息]
```

- 01、02 的编号与层名用 accent `#22C9D6`；03 用 `#9AA6B8`；04、05 用 `#5E6B80`。层级靠颜色明度**递减**，配合字号递减。
- 04 与 05 的带头上方加一条 `border-top:1px solid #262E3D` + 大留白（≥ 64px），这是全页最重的两道分界。

### 01 · 值得研究（低密度，页面唯一焦点）

- 大标题 `52px / 800 / letter-spacing -.025em`，文案格式：**「本周 N 只进入研究层，按足迹强度排序」**。N=0 时改为「本周 0 只进入研究层」并把副文案变成诚实的空态说明，不要留空白版面。
- 副段落 `14.5px #9AA6B8`，一句话概括：宇宙规模、四桶总命中次数、候选/观察哨拆分、零命中的桶。全部从 `runMeta` 取值。
- 三（至多五）张 ticker 摘要卡：等宽 grid，`gap:1px` + 容器底色 `#262E3D` 做发丝分隔（不是每卡独立边框）。每卡内容：ticker（Mono 26px 700）、强度 band（右上，10px 大写）、强度条（3px 高）、桶色圆点 + 一行元信息。整卡是锚点链接跳到 02 层对应卡片。
- 卡组下方一条 `border-top` 的市场环境条：SPY / VIX / 领涨 / 领跌 + 研究层占位。用 `1px×11px` 竖线分隔，不用管道符。

### 02 · 候选明细（中密度，唯一使用卡片表面的层）

每张卡：`background:#141922; border:1px solid #262E3D; border-radius:12px`，**左边框 2px 用强度色**（强 `#16C784` / 中 `#9AA6B8` / 中偏弱、弱 `#5E6B80`），不要用桶色——桶色留给圆点，避免两套语义抢同一个位置。

卡片三段：

1. **头部**：序号 + ticker（Mono 34–38px）+ 公司全名；右侧「足迹强度」140px 强度条 + band 文字。
2. **元信息行**：桶色圆点 + 桶名（双桶则两个点）· 板块 · 事件窗口 · 升级来源 · 档位警示（SMALL_SPEC 用 `#F0A020`）。
3. **数据行**：左侧 6 列技术指标网格（label 9.5px 大写 / value Mono 13.5px 600），右侧 150×48 SVG sparkline + 一行形态说明。sparkline 无坐标轴、无价格标签（无 OHLC 数值供给时不得暗示精度）。

卡片底栏：左侧研究层描述占位，右侧「足迹明细 展开 ▼」按钮。

**展开区**（`background:#0F131B`，比卡面更暗，表示下沉一级）：
- 标题行「构成足迹的条件 · X 项命中 / Y 项检查」
- 每条一行，grid `20px 1fr 210px 74px`：状态符（`✓` 绿 / `✗` 灰 / `—`）· label · `field actual 阈值`（Mono）· 三态标注
- 末尾脚注一行：不可得项不参与强度计分 + 该项可在同次 `screen_run.json` 溯源
- 默认只展开强度最高的第一张，其余收起。

层尾：四桶图例，命中数为 0 的桶用空心圆点 + 灰字，**不要隐藏**。

### 03 · 观察哨（高密度表格，无卡片）

单个 `border:1px solid #262E3D` 容器 + 表头，行 grid `88px 18px 1fr 200px`，行高比 02 层紧一档（`padding:9px 22px`），分隔线用 `#1C2230`（比 02 层的边框更暗）。表尾一行小字说明本轮已升格为候选、不再重复列出的 ticker。

### 04 · 证据层（次要但常读 — 降密度、去表面）

- 带头右侧放「↑ 返回摘要」锚点。
- **全板块资金流谱**：11 行表格，容器边框降为 `#1C2230`。列头右侧三个排序按钮 `rank / 周涨跌 / 挤压密度`，vanilla JS 重排 DOM 行（见 §3）。异动板块（`config/sector.json` 判定）整行底色 `#22C9D614` + `★` + 一句异动说明，强度条改 accent 色。
- 下方两栏 `grid-template-columns:1.25fr 1fr`：左「热门领域详述」，右「萌芽主题雷达」+「零命中桶说明」。
- 雷达卡里必须写出可溯源的算术：跨板块挤压密度中位数、异动板块的倍数、该板块贡献了几只候选。这些全部来自 `sector.json` 聚合结果，**不要写任何预测性措辞**。
- 「零命中桶说明」直接引用 `runMeta.zeroHitBucketsNote`，措辞定位为「真实市场状态而非故障」。

### 05 · 流程与账本（最低密度，纯文字，无边框无卡片）

三栏并列：排除项说明 / 本周总结与前瞻 / 前向账本（已到期待回填、已触发无效化的条目数）。全部 12px，占位斜体灰。

层尾：免责声明段（`max-width:88ch`）+ 一行 Mono 运行指纹：`profile · gatesPassedCount · 本次 run 的输出路径`。

---

## 3. 交互（只要两个，vanilla JS，内联在文件末尾）

1. **候选卡展开/收起足迹明细** — 切换 `hidden` + 按钮文案 `展开 ▼ / 收起 ▲`。默认第一张展开。
2. **板块表按列排序** — 三个按钮切换排序键，重排行 DOM，并在按钮旁显示当前排序键。

约束：不用事件委托以外的复杂结构，不引框架，不加动画，不存 localStorage。JS 全挂 `DOMContentLoaded`。禁用 JS 时报告必须仍然完整可读（明细区默认渲染在 DOM 里，靠 `hidden` 控制）。

---

## 4. 打印 / PDF（`@media print`，硬要求）

```css
@media print {
  body { background:#fff; color:#111; }
  [data-stratum] { break-inside:avoid; }
  [data-noprint] { display:none !important; }   /* 顶栏、排序按钮、展开按钮、返回锚点 */
  [data-detail] { display:block !important; }   /* 所有足迹明细强制展开 */
}
```

- 给五个地层容器加 `data-stratum="01".."05"`，交互控件加 `data-noprint`，明细区加 `data-detail`。
- 打印时深色底色改白底深字（表面色 → 极浅灰边框），强度条与 sparkline 保留（用 stroke 而非依赖背景色）。
- 目标：A4 纵向导出后不出现半张被切断的候选卡。

---

## 5. 设计令牌（写进 `<style>` 顶部的 `[data-project="atlas"]`，报告里禁止裸 hex）

```
bg #0B0E14 · surface #141922 · sunken #0F131B · elevated #1C2230 · overlay #232B3B
border #262E3D · border-dim #1C2230 · border-strong #34405480
text #E8EDF5 · text-2 #9AA6B8 · text-muted #5E6B80
accent #22C9D6 · accent-strong #55E0EA · accent-weak #22C9D614
pos #16C784 · neg #EA3943 · warn #F0A020
bucket-momentum #2F80FF · bucket-vol #A855F7 · bucket-instl #16C784 · bucket-oversold #F0A020
font-body/display 'Manrope' · font-mono 'JetBrains Mono'
spacing 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 · radius 4 / 6 / 10 / 12
```

桶色必须全篇一致：圆点、图例、明细分组用同一套。强度色（绿/灰/深灰）与桶色语义不得互换。

---

## 6. 验收清单（自查后再交付）

- [ ] 只滚动第一屏就能回答「这周有几只、分别是什么、哪只最强」
- [ ] 五个地层的字号 / 密度 / 表面处理肉眼可区分；卡片表面只出现在 02 层
- [ ] 去掉全部颜色（灰度打印）后，层级仍然读得出来
- [ ] 每个候选都能展开看到逐条阈值对照，且不可得项明确标注且不计入分母
- [ ] 候选按强度降序，弱者下沉；null 强度垫底且无进度条
- [ ] 板块表三键排序可用；异动板块高亮附带算术说明
- [ ] 零命中桶显式说明，不显示为空白或故障
- [ ] 研究层占位全部可见
- [ ] 打印预览：明细全展开、控件全隐藏、无跨页断卡
- [ ] 单文件自包含（除 Google Fonts 外零外链）；`npm run typecheck` + `npm test` 通过
- [ ] `ai/decisions.md` 已追加本次决策与 `footprintStrength` 定义

---

## 7. 交付方式

1. 先只改一份**用真实 `screen_run.json` 渲染出的 report.html** 给我看，确认视觉后再动生成器的其余分支（0 候选、0 观察哨、双桶、SMALL_SPEC、强度不可得五种边界态各给一份截图或渲染样例）。
2. 五种边界态必须都渲染得体：**0 候选**、**0 观察哨**、**某桶零命中**、**双桶命中**、**strengthRatio 为 null**。
3. 不要顺手「优化」阈值、容量或桶逻辑。任何引擎侧改动想法写进 issue，不要直接改——改图便宜，改系统贵。
