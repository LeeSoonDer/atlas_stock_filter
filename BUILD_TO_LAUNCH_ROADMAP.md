# Atlas 从建造到落地 —— 完整路线图

> 这是你从今天(纸面完备,代码为零)到运行态(账本积累真实周期)的全程地图。分四大阶段,每阶段有明确的开始动作、结束标志、以及"卡住了怎么办"。

* * *

## 阶段总览

```
阶段 0  开仓准备        30 分钟     一次性
阶段 1  代码建造        2 至 4 周   逐卡循环,主要是挂机等 Claude Code
阶段 2  推理层组建      1 小时      建两个 Project
阶段 3  首次真实周期    半天        走通全链,暴露摩擦
阶段 4  进入运行态      永久        每周 SOP + 每月复盘
```

时间是估算,取决于你每天投入多少。核心工作量不在你写代码(你不写),在你验收和 push。

* * *

## 阶段 0 — 开仓准备(30 分钟,一次做完)

### 0.1 环境确认
- Claude Pro 订阅有效,VS Code 里 Claude Code 能跑
- Node.js 已装(Claude Code 会用)
- GitHub 账号就绪

### 0.2 开仓(照抄 SETUP.md Step 1 至 3)
```powershell
mkdir C:\Users\SD\Desktop\atlas
xcopy /E /H /Y "C:\Users\SD\Desktop\ai-project-template\*" "C:\Users\SD\Desktop\atlas\"
cd C:\Users\SD\Desktop\atlas
```
把本包解压,复制进去:
- `constitution\` 五份文件 → repo 根目录 `constitution\`
- `cards\` 七张卡 → repo 根目录 `cards\`
- `projects\` 和 `sop\` → repo 的 `docs\`(一起版本管理)

```powershell
git init
git add .
git commit -m "init: template + governance + constitution v1.1 + cards"
gh repo create atlas --private --source=. --push
```

### 阶段 0 结束标志
GitHub 上能看到你的私有 atlas repo,里面有宪法和任务卡。**此时代码还是零,只是骨架就位。**

* * *

## 阶段 1 — 代码建造(2 至 4 周,逐卡循环)

这是主体。你的角色:**贴卡 → 挂机 → 验收 → push → 贴下一卡。** 你几乎不碰代码。

### 1.1 启动 Claude Code(SETUP.md Step 5)
VS Code 终端跑 `claude`,贴那条已写好的首指令(在 SETUP.md Step 5,直接复制)。等它输出 LOADED 行,确认它读完了宪法。

### 1.2 逐卡执行顺序(严格按序,不跳)
```
CARD 01  骨架 + 双档宇宙 + 数据接入
   ↓ 验收: npm run screen 出 2000+ 标的 JSON
CARD 02  技术三桶检测器
   ↓ 验收: 三桶各有命中,抽查对照 TradingView
CARD 03  基本面旗标 + 板块 + 环境
   ↓ 验收: 旗标准确,环境快照齐全
CARD 04  机构蓄势代理桶
   ↓ 验收: Form 4/做空数据对得上官方源
CARD 03-PATCH  板块资金异动 + 事件窗口  ← 新补丁,放这里
   ↓ 验收: 板块密度表出来,事件窗口日期准确
CARD 05  选取器 + 观察哨 + 双payload + HTML报告 + 账本
   ↓ 验收: 五件产出齐全,payload 贴进 Radar 能出辩护状
CARD 06  收官 + 打 tag
```

### 1.3 每卡的循环动作(五步,每卡都一样)
1. **贴卡:** 把 `cards/TASK_CARD_0X.md` 全文贴给 Claude Code,说"execute this card"
2. **挂机:** 它自己写代码、跑测试、commit。你去干别的
3. **验收:** 它报告 DONE-WHEN 清单。你**逐条**核对(尤其抽查那几项,别只信它说 pass)
4. **push:** 验收过了 → `git push`
5. **下一卡:** 回到第 1 步

### 1.4 卡住了怎么办(熔断纪律)
- Claude Code **同一个错误连续两次** → 它必须停下,输出"升级包"(五栏:卡在哪/试过什么/错误原文/怀疑方向/需要什么)
- 你把升级包**带回来给我**(或新开 claude.ai 对话),诊断后给修正指令
- **绝不允许** Claude Code 一直硬撞同一堵墙烧 token

### 1.5 红线(开发全程)
- 任何时候 Claude Code 想改 `constitution/` 里的东西 → **拒绝**。宪法只走修正案,不在开发中改
- MUST-NOT 是硬红线,不许"顺手多做"
- 每张卡只做自己范围的事

### 阶段 1 结束标志
`npm run screen -- --profile both` 一条命令,产出:候选 JSON + 观察哨 + 两份 payload 文本 + HTML 报告 + 账本写入。**楼盖好了。**

* * *

## 阶段 2 — 推理层组建(1 小时,建两个 Project)

照 `docs/PROJECT_SETUP_GUIDE.md` 做。

### 2.1 建 Atlas Radar
- claude.ai 新建 Project,名 `Atlas Radar`
- Instructions 栏:贴 `ATLAS_RADAR_INSTRUCTIONS.md` 全文
- Knowledge 上传五份:v1.0 + 修正案二 + 修正案三 + 备忘录三 + 备忘录四

### 2.2 建 Atlas Red Team
- 新建 Project,名 `Atlas Red Team`
- Instructions 栏:贴 `ATLAS_RED_TEAM_INSTRUCTIONS.md` 全文
- Knowledge **只**传备忘录四(含红队分级制)。**严禁**传 Radar 材料——隔离是功能本体

### 2.3 隔离纪律
账号里现在四个 Project(cockpit 的两个 + Atlas 两个)。互不上传对方材料。Atlas 候选送 cockpit 时**只给 ticker 名字**,不给辩护状。

### 阶段 2 结束标志
两个 Project 建好,你手动贴一次测试 payload,Radar 能出辩护状,Red Team 能出分级攻击。

* * *

## 阶段 3 — 首次真实周期(半天,走通全链)

按 `docs/SOP_WEEKLY.md` 完整跑一次:
1. `npm run screen` 跑真实数据
2. 打开 HTML 报告看候选
3. 复制 PAYLOAD → Radar → 收辩护状
4. 复制 DISSENT PAYLOAD → Red Team → 收攻击
5. 你裁决:哪几只送 cockpit
6. 把这次遇到的**所有摩擦**记成清单(报告丑?payload 格式别扭?哪步卡手?)

### 3.1 用摩擦清单收官
把清单交给 CARD 06,Claude Code 逐条修。修完打 tag `v1.0-layer1`,push。

### 阶段 3 结束标志
你完整走通了一次"筛选 → 推理 → 反驳 → 裁决",且知道它哪里还别扭。**系统真正可用了。**

* * *

## 阶段 4 — 进入运行态(永久)

### 4.1 每个筛选周期(≤ 60 分钟,每周至少一次)
照 `SOP_WEEKLY.md`。跑筛选 → 看报告 → Radar → Red Team → 裁决 → 送 cockpit。

### 4.2 每月复盘(15 分钟)
照 `SOP_MONTHLY.md`。回填账本 → 看四桶统计 → 固定三问 → 至多改一个参数 → 金丝雀测试。

### 4.3 头三个月的铁律
- **阈值锁死不动。** 让账本积累。忍住"优化"的手——那是 overfit 悬崖
- **每次跳过红队都记一笔。** 连续跳两周期 → 启动 CARD 08(MCP 自动化)消灭摩擦
- **账本全量记录,含失败样本。** 它最终暴露的是你自己的行为模式

### 阶段 4 里程碑
- **第 4 周:** 账本有约 4 至 8 个周期,开始能看四桶差异
- **第 12 周:** 第一次有意义的统计,可以慎重考虑调一个参数
- **第 24 周:** 系统开始显现真实价值——你手里有了一份"哪类信号对我有效"的私人证据

* * *

## 后置扩展(都不急,有信号再做)

| 卡 | 做什么 | 什么时候做 |
|---|---|---|
| CARD 04b | EDGAR 13F 增量解析 | 机构桶证明有价值,且 Form 4 不够用时 |
| CARD 07 | Next.js 交互仪表盘 | HTML 报告用了 1-2 月,你想要图表趋势/手机看时 |
| CARD 08 | MCP 薄代理(消灭复制粘贴) | 手动搬运摩擦让你开始跳红队那天 |
| Cockpit v1.3 反哺 | ACH/双轴/阶段感知/同源审计 | 独立 session,与 Atlas 分流 |

* * *

## 一页纸速查

```
今天       → 阶段 0:开仓 push GitHub(30分钟)
这几周     → 阶段 1:贴卡挂机验收,CARD 01→06(你不写代码)
建完       → 阶段 2:建两个 Project(1小时)
然后       → 阶段 3:首次真实周期,记摩擦,CARD 06 收官
往后       → 阶段 4:每周 SOP + 每月复盘,阈值锁死三个月
```

**唯一的当下动作:阶段 0.2,开仓。** 剩下的都是循环。系统的价值在阶段 4 的账本里,但通往那里的路,今天这 30 分钟就能起步。
