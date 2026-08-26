# TASK CARD 07 — 全板块扫描数据供给 + 双层候选 + 情报简报 HTML 报告

> 丢给 Claude Code 执行。LOADED 确认后开工。前置：CARD 01 至 06 全部验收通过（Layer 1 已上线）。授权来源：第四号宪法修正案（修正案十至十三）。

## GOAL

给应用层补齐三件事，让 payload 能承载新的周报情报简报结构，并让 `npm run screen` 直接产出情报简报风 HTML 报告（参照 MOCKUP_intel_briefing_v3.html 的结构与视觉）。

## SCOPE

### Part A — 全板块资金流数据（src/screen/sector_scan）

1. 扩展现有板块模块，对全部 11 个 SPDR 板块计算：
   * 当前 rank（1至11）
   * 周度表现（周涨跌 %）
   * 挤压足迹密度（该板块内命中挤压桶的标的占比，复用修正案三的聚合）
   * 机构足迹密度、内部人集群密度
   * 资金流向三态判定：flow_in / flow_out / flat（规则进 config，写注释；如 rank 前四且周涨正 = flow_in，rank 后三且周跌 = flow_out，其余 flat）
   * 该板块有多少标的进入候选 / 观察哨
2. 重点热门领域映射：把"科技/软件、AI基建、航天太空"映射到对应板块或自定义标的篮子（config/hot_sectors.json 可维护）。AI 基建与航天太空可能跨板块，用 ticker 篮子近似
3. 输出并入 payload 的 sector_flow_scan 字段

### Part B — 双层候选选取（src/screen/select 扩展）

1. 第一层"值得研究"：至多 3 个，四桶轮询选最强
2. 第二层"观察哨"：至多 8 个，收纳挤压未入选者 + 各桶临界标的（距阈值 ≤10%）
3. 观察哨升级状态机沿用 CARD 05 逻辑，升级者标 promoted
4. 两层分别进 payload

### Part C — 情报简报 HTML 报告（src/report/html 重构）

1. 按 MOCKUP_intel_briefing_v3.html 的结构与视觉重构报告模板：
   * 顶部 masthead + 大盘环境复盘（四指标卡 + 环境快照）
   * 全板块资金流谱（11 板块紧凑呈现，按 rank 排序，流向三态用色边区分）
   * 热门领域详述卡（科技/AI/航天 + 本周异动板块）
   * 主题雷达占位区（主题内容由 Radar 推理层填充，应用层渲染 Radar 返回的 JSON 中 emerging_themes 字段；首版可先渲染板块异动作为主题雏形）
   * 第一层候选卡 + 第二层观察哨表 + 排除项折叠
   * 本周总结区（由 Radar 返回的长白话填充；应用层负责渲染，不生成文字）
2. 视觉沿用 mockup：深色 intel 简报风，色边区分流向，语义化数字，SVG sparkline
3. 自包含单文件，写入日期文件夹（沿用 CARD 05-PATCH 的归档结构）+ 更新 output/latest.html

### 关键边界

* **应用层只做数据与渲染，绝不生成任何判断文字。** 主题白话、板块定位、长总结全部由 Radar 推理层产出，应用层只把 Radar 返回的 JSON 渲染进 HTML。这是双层架构红线。
* 首次运行时若尚无 Radar 返回（纯 screen 阶段），主题区与白话区显示"待研究层填充"占位，不得由应用层编造。

## DONE-WHEN

* [ ] payload 含完整 11 板块 sector_flow_scan
* [ ] 热门领域(科技/AI/航天)映射正确，AI/航天用篮子近似且注明
* [ ] 双层候选正确产出（≤3 深 + ≤8 浅）
* [ ] HTML 报告渲染出 mockup 的完整结构，全板块流谱可见
* [ ] 无 Radar 输入时，主题区与白话区显示占位而非编造文字（grep 验证无硬编码判断句）
* [ ] 报告写入日期文件夹 + latest.html 更新

## MUST-NOT

* 应用层生成任何判断/预测/白话文字（架构红线）
* 板块流向硬编码方向性预言
* LLM 调用

## 熔断

同卡点失败 2 次 → 停止，升级包。AI/航天篮子映射复杂时，首版降级为"仅标注该主题本周有无候选进入"，不强求精确板块归属。
