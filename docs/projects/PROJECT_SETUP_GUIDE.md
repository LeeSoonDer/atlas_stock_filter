# claude.ai Project 组建指南(Atlas 的两个 + 另外三个的去处)

## Project 1: Atlas Radar

1. claude.ai 新建 Project,命名 `Atlas Radar`
2. Instructions 栏:贴入 `ATLAS_RADAR_INSTRUCTIONS.md` 全文(2026-10-17 起含市场层章节;已有的 Project 要把旧指令整段替换)
3. Knowledge 上传八份宪法文件(`constitution/` 目录):
   * ATLAS_v1_0.md
   * ATLAS_AMENDMENT_NO2_v1_1.md
   * ATLAS_MEMO_NO3_ADJUDICATIONS.md
   * ATLAS_MEMO_NO4_FINAL_ADJUDICATIONS.md
   * ATLAS_AMENDMENT_NO3_SECTOR_EVENT.md
   * ATLAS_AMENDMENT_NO4_THEME_RADAR.md(足迹锚定、主题雷达、全板块扫描、长白话总结,新指令的市场层章节以它为准)
   * ATLAS_AMENDMENT_NO5_SIGNAL_REFINEMENT.md(信用闸、期权诚实标注、宽度只描述不预测、集中度不给仓位)
   * ATLAS_AMENDMENT_NO6_CONTAGION.md(筛选宽容度、板块传导叙事验证、市场叙事扫描)
4. 在 Claude Desktop 里用:网站会按需自动启动,直接说"读取最新扫描并出辩护状"。Atlas 工具在 Radar 暂停期间不列出,恢复方法见 `stockpit\使用指南.md` 附录 A

## Project 2: Atlas Red Team

1. 新建 Project,命名 `Atlas Red Team`
2. Instructions 栏:贴入 `ATLAS_RED_TEAM_INSTRUCTIONS.md` 全文(2026-10-25 起含工具入口和保存一节;已有的 Project 要整段替换)
3. Knowledge **只**上传:
   * ATLAS_MEMO_NO4_FINAL_ADJUDICATIONS.md(含红队分级制)
   * **严禁**上传 Radar 指令、五引擎材料或任何正方推理框架——隔离是功能本体
4. 在 Claude Desktop 里用,开新对话说"读取最新隔离包并出红队攻击"。它只会调 `atlas_get_dissent_payload`,不会去取正方证据包

## 另外三个 Project(不在本仓库)

* **Stock Research v5**、**Dissent Auditor**:配置见 `stockpit-suite\v5-prompts\project_instructions\README.md`
* **Lens**:Instructions 贴 `stockpit-suite\stockpit\reasoning\LENS_INSTRUCTIONS.md`;它所依据的手册 `reasoning\COMPANY_INTELLIGENCE_MANUAL.md` 建议传进 Knowledge

## 五 Project 共存纪律

账号内共有五个 Project:Stock Research v5 / Dissent Auditor / Atlas Radar / Atlas Red Team / Lens。
* 严禁互相上传对方材料
* Atlas 候选送 Cockpit 深研时,只递交 ticker(第三号备忘录 Q3 裁决),不递交 Atlas 辩护状全文,保持 Cockpit 分析的独立起点

## 金丝雀测试(移植自 Cockpit S2 裁决)

首次真实运行后,把当次的 ATLAS PAYLOAD 与 ATLAS DISSENT PAYLOAD 各存一份,文件名加 `CANARY_` 前缀,冻结不再修改。每月月度复盘时,把两份金丝雀重新递交对应 Project,对比历史输出:评级方向漂移、结构缺章、铁律违反(出现编造数据或执行命令)任一出现,记录并考虑指令加固。
