# Atlas 总装手册(VS Code + Claude Code + GitHub 全自动开发)

## Step 0 — 前置确认

* Claude Pro 订阅有效,Claude Code 可用
* GitHub 账号 + gh CLI(可选)
* ai-project-template 在本地

## Step 1 — 开仓

```powershell
mkdir C:\Users\SD\Desktop\atlas
xcopy /E /H /Y "C:\Users\SD\Desktop\ai-project-template\*" "C:\Users\SD\Desktop\atlas\"
cd C:\Users\SD\Desktop\atlas
```

## Step 2 — 放入本包内容

解压 atlas_bootstrap_final.zip,把以下内容复制进 repo:
* `constitution\` 整个文件夹(四份宪法)
* `cards\` 整个文件夹(六张任务卡)
* (可选,若要同风格 UI 备用)从 cockpit repo 复制 P4_DESIGN_SPEC.md + P4_5_UI_SPEC_ADDENDUM.md 进 repo 根目录

`projects\` 与 `sop\` 文件夹**不进 repo**(它们是 claude.ai 侧与你本人的操作文档),放桌面或进 repo 的 docs/ 皆可,建议进 docs/ 一起版本管理。

## Step 3 — Git + GitHub

```powershell
git init
git add .
git commit -m "init: template + governance + constitution v1.1 + cards"
gh repo create atlas --private --source=. --push
```

(无 gh CLI:GitHub 网页建私有空仓 → `git remote add origin <url>` → `git push -u origin master`)

## Step 4 — 组建双 Project

按 `projects/PROJECT_SETUP_GUIDE.md` 建 Atlas Radar 与 Atlas Red Team。此步可与开发并行,CARD 05 前完成即可。

## Step 5 — 启动 Claude Code

```powershell
code .
```

VS Code 终端跑 `claude`,贴首条指令:

```
This is a cli-tool project (TypeScript, no UI framework).
Read CLAUDE.md and follow its startup sequence completely.
Confirm with the LOADED line before anything else.
Project: Atlas
Idea: Attention allocation engine for US stocks. This repo is
Layer 1 only: a deterministic on-demand screener over the full
NYSE+NASDAQ universe with dual profiles (STANDARD / SMALL_SPEC),
four opportunity detectors, Top 5 candidates + watchlist,
payload generation for a separate LLM research layer, a
self-contained HTML report, and a forward outcome ledger.
Absolutely no LLM calls inside this repo.
The four files in /constitution are frozen law. Read all four
before initializing ai/project_overview.md and ai/current_state.md.
Then read cards/TASK_CARD_01.md and execute it end to end.
Commit per scope item. When DONE-WHEN passes, stop and report.
```

## Step 6 — 逐卡循环(CARD 01 → 06)

每卡:Claude Code 执行 → 报告 DONE-WHEN → 你抽查 → `git push` → 贴下一卡。

熔断纪律:
* 同卡点失败 2 次 → Claude Code 必须停止并出升级包,你把升级包带回咨询
* 任何要求修改 /constitution 的提议 → 自动拒绝,宪法只走修正案程序
* 卡间不允许"顺手多做":MUST-NOT 是红线

## Step 7 — 首次真实周期

CARD 05 验收后,按 `sop/SOP_WEEKLY.md` 跑第一次完整周期(含 Radar + Red Team),把摩擦点记成清单,交给 CARD 06 收官。

## Step 8 — 进入运行态

* 每周期:SOP_WEEKLY(≤ 60 分钟)
* 每月:SOP_MONTHLY(15 分钟)
* 候选深研:ticker 交给 Stock Research Cockpit,Atlas 的工作到此为止
