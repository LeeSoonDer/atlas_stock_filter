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

* * *

# 运行手册(TASK_CARD_06 收官版)

以下四节面向"repo 已建好,你要实际用它"的场景——从零 clone 到每周运行、config 调参、出问题时怎么查。SETUP.md 是一次性总装手册(建仓用),这里是常驻参考。

## 安装

```powershell
git clone <your-repo-url> atlas
cd atlas
npm install
copy .env.example .env
```

要求:Node.js >= 18(`package.json` engines 字段声明,当前用 TypeScript 7 + `tsx` 直接跑 `.ts`,无需预编译)。

`.env` 除 `SEC_EDGAR_USER_AGENT` 外全部留空也能跑——SEC 请求会退化用一个格式合规但非真实联系方式的占位符(轻量/一次性用途够用,长期使用建议填真实邮箱,见 `.env.example` 内注释),FMP 缺 key 时估值二次充实会全量标 `不可得`,不阻塞其余流程。

首次 clone 后第一次 `npm run screen` 会触发全量冷启动抓取(全宇宙约 90 分钟 + EDGAR Form 4 90 天回溯约 2.5-3 小时,一次性成本,见下方"首次运行"故障排查条目)——`output/checkpoint.json` 建好之后,后续运行只增量抓取新数据,通常几十秒到几分钟。

## 命令全表

| 命令 | 作用 |
|------|------|
| `npm run screen -- --profile <standard\|small_spec\|both>` | 跑一次完整筛选周期:宇宙构建 → 抓取(行情/OHLCV/内部人/机构/空头) → 技术指标 → 四桶检测器 → 基本面/板块/环境 → 选取器(候选+观察哨) → FMP 二次充实 → 生成 PAYLOAD/DISSENT PAYLOAD/HTML 报告 → 账本写入。`--profile` 必填,三选一。 |
| `npm run ledger:backfill -- --ticker <SYMBOL> [--outcome repriced\|invalidated\|expired_no_event] [--elapsed-days N] [--screening-timestamp <iso>]` | 给某标的补记结果(前向验证账本回填)。不带 `--outcome`/`--elapsed-days` 时走交互式问答;带了则非交互(脚本化用)。同一标的有多条未回填记录时默认选最早一条,`--screening-timestamp` 可指定具体一条。**只追加,从不改写或删除已有账本行**。 |
| `npm run ledger:stats` | 按四桶(momentum_breakout / volatility_compression_setup / oversold_reversal / institutional_accumulation_proxy)汇总总数/已回填数/待回填数/命中率/死亡率(月度复盘用)。无回填数据时命中率与死亡率诚实显示 `不可得`,不臆造 0%。 |
| `npm run typecheck` | `tsc --noEmit`,不产生任何输出文件,纯类型检查。 |
| `npm test` | `node:test` 跑全部 `src/**/*.test.ts`(零新增测试框架依赖)。 |
| `npm run build` | `tsc -p tsconfig.json` 编译到 `dist/`(日常开发不需要,`npm run screen` 直接用 `tsx` 跑源码)。 |

单次运行的产出(均写入 `output/`,前三个文件名带运行时间戳,互不覆盖):

| 文件 | 内容 |
|------|------|
| `atlas_payload_<ts>.txt` | ATLAS PAYLOAD——candidate 全量证据(旗标/基本面/事件窗口/关键价位),贴入 Atlas Radar 用 |
| `atlas_dissent_payload_<ts>.txt` | ATLAS DISSENT PAYLOAD——仅桶类型+模板化设想陈述,零旗标细节(隔离铁律),贴入 Atlas Red Team 用 |
| `atlas_report_<ts>.html` | 自包含单文件 HTML 周报(浏览器直接打开,含 SVG sparkline) |
| `screen_run_<ts>.json` | 完整结构化输出(`ScreenRunResult`——含全部旗标、耗时分解、失败标的归因等),供脚本化消费或调试用 |
| `ledger.jsonl` | 前向结果账本(append-only,进 git 版本控制,宪法要求永久归档见下) |
| `checkpoint.json` | 抓取阶段的本地缓存(gitignored,体积很大,删除会强制全量重抓——见故障排查) |

## Config 说明

所有 `config/*.json` 均为纯数据,改动无需碰代码;改完直接下一次 `npm run screen` 生效。

* `config/profiles.json` —— 双档位(STANDARD / SMALL_SPEC)的市值/日均成交额门槛。
* `config/detectors.json` —— 技术指标窗口参数(SMA/RSI/ATR/布林带等)+ 技术三桶(动能突破/波动挤压/超卖反转)各自的触发阈值。
* `config/card03.json` —— 基本面三态标注的容差(如 `revenueGrowthAccelDecelEpsilon`)、板块强度排名窗口、市场环境判定阈值(SPY/VIX)、事件窗口天数。
* `config/card04.json` —— 内部人集群判定(回溯天数/最少不同买家数)、机构持仓趋势判定(快照最小间隔天数,防止用同一次快照误判"趋势")、空头数据阈值(显著下降%/挤压门槛)、Detector D(机构蓄势代理桶)所需最少满足条件数。
* `config/sector.json` —— 板块资金足迹异动判定(密度需达跨板块中位数的倍数 + 最小绝对命中数 + 板块最小有效标的数,低于后者的板块直接跳过聚合,不强行凑数)。
* `config/card05.json` —— 选取器容量(最多候选数/最多观察哨数)、FMP 双源价格偏差告警阈值。
* `config/fetch.json` —— 抓取层参数(批大小、批间延迟、并发数、重试次数/退避倍数、OHLCV 最少交易日要求)。这一层改动影响抓取稳定性与速度,调整前建议先读 `src/data/batchFetcher.ts` 顶部注释。

`.env` 中的 4 个 key(见上方"安装")属于运行时密钥,不进 config/,也不进 git(`.gitignore` 排除 `.env`,只保留 `.env.example` 模板)。

## 故障排查

**首次运行卡很久 / 看起来像挂住了**——不是 bug。全量宇宙抓取(~5460 只标的)+ EDGAR Form 4 90 天回溯是一次性冷启动成本(实测 ~2.5-3 小时,详见 `ai/decisions.md` TASK_CARD_04 相关条目),此后每次运行只增量抓取。若怀疑真的卡死:检查是否有孤儿进程仍占用 `output/checkpoint.json`(Windows 上用 `Get-CimInstance Win32_Process` 按命令行关键字排查 `tsx`/`node` 子进程),而不是直接删 checkpoint 重来——删除会让下次运行重新支付全部冷启动成本。

**FMP 相关字段全是"不可得"**——`FMP_API_KEY` 未在 `.env` 中配置时的预期行为(优雅降级,不阻塞其余流程,见 `.env.example` 注释)。去 financialmodelingprep.com 申请免费 key,填入 `.env` 即可,无需改代码。

**SEC EDGAR 请求返回 403**——`SEC_EDGAR_USER_AGENT` 必须是形如 `name@domain` 的邮箱格式字符串(SEC 侧硬性要求,已用真实请求验证过——纯描述性字符串或 URL 不够)。未设置时会用一个格式合规但非真实联系方式的占位符兜底,轻量用途够用,长期使用建议填真实可联系邮箱。

**跑完某一桶命中数是 0**——不一定是 bug。可能反映当期市场对该类型设置确实冷清/极端。`runMeta.zeroHitBucketsNote` 会给出具体是哪个桶、并提示这可能是真实市场状态而非故障——先看该字段的说明,再怀疑代码。

**机构持仓趋势(institutionalTrend)长期显示"不可得"**——这是 Yahoo 无法提供多期趋势数据的已知限制,Atlas 靠比较本次运行快照与上次运行快照来推算趋势(`config/card04.json` 的 `institutionalTrend.minDaysBetweenSnapshots`,默认 60 天)。两次运行间隔不足 60 天时该字段必然是"不可得",不是抓取失败——见 `ai/decisions.md` TASK_CARD_04 条目。

**想知道某次运行时间花在哪一步**——`screen_run_<ts>.json` 的 `runMeta.timingBreakdown` 按宇宙/抓取/检测/报告四类给出毫秒级分解(`detail` 字段有更细的分段耗时);命令行标准错误输出末尾也会打印一行汇总。哪个标的在哪个抓取阶段失败,看同一 `runMeta` 下的 `failureAttribution.bySymbol`。

**想验证账本真的没有被改写过**——`output/ledger.jsonl` 只会被追加,从不重写或删除(`src/ledger/ledger.ts` 只用 `appendFileSync`,可直接 grep 源码确认没有 `writeFileSync`/`truncateSync`/`unlinkSync`)。`git log --follow output/ledger.jsonl` 能看到这份文件在 git 历史里的每一次改动,任何一次如果不是纯新增行,就值得警惕。

**类型检查或测试失败**——先跑 `npm run typecheck` 和 `npm test` 分别定位是类型问题还是逻辑回归;两者互相独立,能分别复现更快缩小范围。
