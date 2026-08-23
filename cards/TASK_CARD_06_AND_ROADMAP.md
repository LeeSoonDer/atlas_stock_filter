# TASK CARD 06 — 打磨与验收周(v1 收官卡)

> LOADED 确认后执行。前置:CARD 05 验收通过 + 你已完成至少一次真实周期(含 Radar 与 Red Team)。

## GOAL

用第一次真实运行暴露的问题清单驱动收官:修摩擦、补日志、锁版本。

## SCOPE

1. 真实周期问题清单逐条修复(你提供清单,Claude Code 执行)
2. 运行日志完善:每次 screen 输出耗时分解(宇宙/抓取/检测/报告),失败标的归因汇总
3. 金丝雀 payload 冻结:首次真实 PAYLOAD 与 DISSENT PAYLOAD 存入 canary/ 目录
4. README.md(repo 级):安装、命令全表、config 说明、故障排查
5. git tag `v1.0-layer1`,push GitHub

## DONE-WHEN

* [ ] 问题清单全清或显式记为已接受
* [ ] 新机器按 README 可从零跑通(用 fresh clone 验证)
* [ ] tag 已打,GitHub 同步

* * *

# 后置卡路线图(按需启动,均非 v1 必需)

## CARD 04b — EDGAR 13F 增量解析(无限期后置)
全量 13F 拉取 + 季度环比增量检测 + 新建仓/清仓识别。启动条件:机构蓄势桶在前向账本中表现出价值,且 Form 4 代理明显不足时。

## CARD 07 — Next.js 仪表盘(可选)
Layer 1 输出的 Web 可视化:候选卡片墙、观察哨状态流、账本统计图表。复用 Cockpit 的 P4_DESIGN_SPEC + P4.5 ADDENDUM 作设计宪法。启动条件:HTML 周报用了一至两个月后,你确认想要交互式界面。技术栈与 Cockpit 同构(Next.js + Tailwind + shadcn/ui),可并入或独立部署自选。

## CARD 08 — MCP 薄代理(Mode B 升格,可选)
照抄 cockpit/mcp-server 模式:build_atlas_payload / save_brief / save_dissent 等工具,消灭手动复制粘贴。宪法已预授权(修正案二实施架构:Mode B 启用不构成宪法变更)。启动条件:手动搬运摩擦让你开始跳过红队环节时——那一刻这张卡从可选变必须。

## 独立并行线 — Cockpit v1.3 反哺 patch(备忘录三 S3)
ACH 双假设 / 双轴分离 / 阶段感知矛盾 / 同源污染审计四项,以 append-only patch 形式并入 Stock Research v5 提示词框架。与 Atlas 开发严格分流,单独 session 单独任务卡执行。
