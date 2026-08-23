# Atlas Bootstrap Final — 一次性完整说明书

Atlas:美股注意力配置引擎。应用层(确定性筛选,全美股宇宙 → 四桶检测 → 候选 ≤5 + 观察哨 ≤10)× 研究层(Atlas Radar 辩护状 + Atlas Red Team 分级攻击)× 前向账本闭环。与 Stock Research Cockpit 串联:Atlas 答"看哪些",Cockpit 答"这只怎样"。

## 包内导航

```
README.md                  ← 本文件
SETUP.md                   ← 从零到运行态的总装手册(先读这个)
constitution/              ← 四份宪法(进 repo,冻结法律)
  ATLAS_v1_0.md                v1.0 蓝本(14 模块架构)
  ATLAS_AMENDMENT_NO2_v1_1.md  第二号修正案(数据现实化/双层架构/前向追踪)
  ATLAS_MEMO_NO3_ADJUDICATIONS.md  第三号备忘录(Top5/全市场宇宙/独立repo等)
  ATLAS_MEMO_NO4_FINAL_ADJUDICATIONS.md  第四号备忘录(四桶/双档/辩护状/红队分级/观察哨)
  ATLAS_AMENDMENT_NO3_SECTOR_EVENT.md      第三号修正案(板块资金异动+事件窗口)
cards/                     ← 六张任务卡(进 repo,Claude Code 逐卡执行)
  TASK_CARD_01 骨架+双档宇宙+数据接入
  TASK_CARD_02 技术三桶检测器
  TASK_CARD_03 基本面旗标+板块+环境
  TASK_CARD_03_PATCH 板块资金足迹聚合+事件窗口(修正案三)
  TASK_CARD_04 机构蓄势代理桶
  TASK_CARD_05 选取器+观察哨+双payload+HTML报告+账本
  TASK_CARD_06 收官+后置路线图(13F/仪表盘/MCP/Cockpit反哺)
projects/                  ← claude.ai 侧(两份 Instructions 全文+组建指南)
sop/                       ← 你的操作手册(每周期/每月)
```

## 三条心法(从 Cockpit 继承,刻在这里)

1. **系统的产品不是每份报告,是六个月后被数据校准过的你。**
2. **输入侧(数据/prompt)有天花板,真正缺口在输出侧(纪律/情绪/仓位)。** 红队和账本存在的意义大于任何指标。
3. **拒绝比添加更重要。** 已拒绝清单:回测、组合管理、数据超市、付费数据、自动交易、13F(暂)、提醒系统、固定日程。每个新想法过"一次点击"审计再说。

## 一句诚实的话(对应你的 F21)

你要的"超全能选股器"——评级、风险、介入区间、无效化位、多引擎综合——结构上全在辩护状摘要卡里,一张不少。但这台机器承诺的是**过程质量**:纪律化的筛选、有证据的攻击、全量归档的前向验证。"中短期爆发"是它的猎物,不是它的合同。四桶里真正的爆发候选会被它捞进你的视野,能不能变成收益,取决于漏斗的下半段:Cockpit 深研 + 你的执行纪律。系统管到"值得注意"为止,这是它诚实的边界,也是它能长期活着的原因。

## 启动顺序

SETUP.md Step 0 至 8,照做即可。第一条 Claude Code 指令已写好在 Step 5,直接贴。
