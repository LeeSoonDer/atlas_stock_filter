# Stockpit — 完整系统手册

> 快照日期:2026-09-04。这份文档的目的是让一个从未接触过这套系统的人(或 AI)读完之后,达到和系统作者同等的理解水平——不只是"有什么功能",而是"为什么是这样,哪里有边界,哪里踩过坑"。
>
> 这是**时间点快照**,不是自动更新的文档。任何具体细节在使用前都应对照实际代码复核,尤其是本文日期之后的改动。

---

# 第一部分:理念

## 1.1 这是什么

Stockpit 是一个**个人投资研究系统**,不是选股软件,不是自动交易系统,也不是"AI 帮你炒股"的产品。

它由两个引擎组成,形成一个漏斗:

```
Atlas(广度)          Stockpit 网页(枢纽)         研究层(深度)
全美股 5000+ 标的  →  展示 / 交接 / 记录 / 追踪  →  Claude 对话里的深度分析
"该看哪些"                                          "这一只到底怎样"
```

**核心目标不是收益率,是过程质量。** 系统承诺的是:纪律化的筛选、有证据的反驳、全量归档的前向验证。它管到"这只值得注意"为止,之后的介入、仓位、执行,全部属于使用者自己的领地。

## 1.2 五条不可动摇的原则

这五条不是"当前限制",是**设计选择**。任何改动如果违反它们,都是在改变这个系统的性质,不是在改进它。

### 原则一:应用层永不产出判断

Atlas 和 Stockpit 的代码里**零 LLM 调用**。它们只做三件事:拉取诚实的数据、机械计算、渲染展示。所有"这只股票怎么样"的判断,都发生在使用者自己的 Claude 对话里。

这不是因为技术做不到,而是因为:一旦应用自己会"给结论",使用者就会开始信任一个无法审计、无法追责的黑箱。系统的价值在于**把判断的责任牢牢留在人手里**,同时把机械劳动全部自动化。

具体体现:Atlas 的 HTML 报告里,所有需要判断的位置(候选描述、板块判断、本周总结)全部渲染成字面的"待研究层填充"占位符。代码里没有任何一条路径能生成判断性文字——这一点是被 grep 验证过的。

### 原则二:数据诚实,永不编造

任何数据源失败、任何字段拿不到,都必须显式标记为「不可得」,绝不能:
- 用 0 代替
- 用旧数据冒充新数据
- 静默省略让人以为"没有这一项"

体现在代码各处:`[UNAVAILABLE: source]`、`不可得`、`可得/不可得/未知` 三态标注。账本统计里,一个还没有任何结果回填的桶,命中率显示「不可得」而不是 0%——**没测量过的桶不是 0% 的桶**。

### 原则三:前向验证,不做回测

系统的证据基础是**真实的未来结果**,不是历史回测。每一次筛选出的候选和观察哨都会写进一份**只追加、永不删改**的账本(`output/ledger.jsonl`),之后由使用者手动回填"这个设想后来兑现了/失效了/无事发生"。

为什么不回测:回测极易过拟合,而且回测好看的策略不等于使用者本人能执行的策略。账本最终暴露的是**使用者自己的行为模式**——哪类信号对"我"有效。

宪法级约束:账本条目**永不删除或修改**,只能追加。这一点连代码层面都做了保证(账本模块只有 `appendFileSync`,没有任何改写函数)。

### 原则四:隔离即功能

系统有一个"红队/反证"机制——用一个**完全独立的对话**,拿一份**剥离了原始推理的数据包**,去攻击已有的结论。

这个隔离是功能本体,不是形式:红队拿到的数据包在**类型层面**就装不下证据字段(`DissentInputCandidate` 只有 symbol 和 primaryBucket 两个字段)。这不是"约定不传",是"结构上传不了"。

任何整合、重构、优化,都**不得破坏这个隔离**。

### 原则五:$0 运营成本

整套系统的月成本必须是 0。这条约束推导出了几乎所有架构决策:
- 不用付费 LLM API → 推理必须在使用者自己的 Claude 订阅对话里进行 → **人必须在场**
- 不用付费托管 → Vercel Hobby + Supabase 免费版 → serverless 300 秒上限 → **重计算必须留在本地**
- 不用付费数据源 → Yahoo Finance 为主,FMP/FRED 免费额度为辅

**这条约束的代价必须被诚实认知**:它让"完全无人值守的全自动流程"在结构上不可能。见 §5.2。

## 1.3 一句诚实的话

这个系统承诺的是过程质量,不是收益。四个检测桶里真正的机会会被捞进视野,能不能变成收益取决于漏斗的下半段:深度研究 + 执行纪律。系统管到"值得注意"为止,这是它诚实的边界,也是它能长期活下去的原因。

---

# 第二部分:系统构成

## 2.1 三个仓库

| 仓库 | GitHub | 角色 | 本地路径 |
|---|---|---|---|
| **Atlas** | `LeeSoonDer/atlas_stock_filter` | 筛选引擎(CLI,无网页) | `Desktop\atlas` |
| **Stockpit** | `LeeSoonDer/stockpit`(private) | 网页产品(枢纽) | `Desktop\stockpit` |
| **Cockpit** | `LeeSoonDer/stock-research-cockpit` | **冻结存档**,原版单机工具 | `Desktop\stock-research-cockpit` |

### 为什么是三个而不是一个 monorepo

**整合发生在数据库层,不是代码层。** Atlas 和 Stockpit 之间**没有任何代码依赖**——Atlas 不 import Stockpit 的任何东西,反之亦然。它们唯一的耦合是共享的 Supabase 表结构。

这样做的好处:
- Atlas 保持极简依赖(只有 `dotenv` + `yahoo-finance2`),不用被迫装 Next.js/React
- 两边各自的治理体系(宪法、任务卡、rules_core)不用打架
- 任一边可以独立演进、独立测试

**Cockpit 为什么冻结**:它是 Stockpit 的前身。Stockpit 从它的一个分支分出来后,两者已经真正分叉(删了 ETF、改了全部命名和路由、journal 只认 Supabase),不可能再合并。与其维护一个永不合并的长期分支(本质是伪装成分支的 fork),不如让 Stockpit 独立成仓,Cockpit 打上 tag `cockpit-v1.0` 作为可运行的原版存档。

**实际好处**:两个独立文件夹意味着**可以同时运行**(Stockpit 在 3000 端口常驻,原版 Cockpit 需要时在 3001 端口手动起)。同一个文件夹里的两个分支做不到这一点。

## 2.2 控制平面 vs 展示平面

这是理解整套部署架构的关键概念。

```
┌─────────────────────────────────────────────────────┐
│  控制平面 = 你的电脑(本地)                            │
│                                                      │
│  • Atlas CLI(跑筛选,几分钟到几小时)                  │
│  • Stockpit 本地实例(pm2 常驻,localhost:3000)        │
│    └─ "Run screen now" 按钮只在这里出现               │
│  • Claude Desktop + 本地 MCP server                  │
│    └─ 所有 AI 推理在这里发生                          │
└────────────────────┬────────────────────────────────┘
                     │ 读 / 写
                     ▼
┌─────────────────────────────────────────────────────┐
│  Supabase(免费云端 Postgres)= 唯一真相来源            │
│  journal_entries / atlas_runs / atlas_reviews /      │
│  atlas_ledger / watchlist_items / app_settings       │
└────────────────────┬────────────────────────────────┘
                     │ 只读
                     ▼
┌─────────────────────────────────────────────────────┐
│  展示平面 = Vercel(公网)                             │
│  同一份代码,只读展示,任何设备浏览器可访问              │
│  没有"运行扫描"按钮(碰不到你电脑上的 Atlas)           │
└─────────────────────────────────────────────────────┘
```

**同一份代码部署两次**,靠环境变量 `IS_LOCAL_CONTROL_PLANE=true` 决定是否渲染/启用需要本地文件系统的功能。这样不会出现"点了按钮但云端函数根本碰不到我电脑"的死路。

**为什么重计算必须留在本地**:Vercel serverless function 上限 300 秒;Atlas 一次完整扫描热缓存约 16 分钟,冷启动可达 2.5-3 小时(EDGAR Form 4 回溯)。结构上放不进去。

---

# 第三部分:Atlas —— 筛选引擎

## 3.1 它在找什么

Atlas 每次运行会把 NYSE + NASDAQ 约 8500 个原始标的,经过排除闸门降到约 5400,再经过双档位门槛降到约 3200,然后在这些标的里寻找**五种特定形态**。

### 排除闸门(`src/universe/`)

按类型直接剔除:`TEST_ISSUE`(测试证券)、`ETF_ETN_FLAG`/`ETF_ETN_NAME`(基金)、`WARRANT`(权证)、`RIGHT`(配股权)、`UNIT`(单位信托)、`PREFERRED`(优先股)、`SPAC`(空壳)、`LEVERAGED_INVERSE`(杠杆/反向)、`DEBT_SECURITY`(债券类)。

### 双档位门槛(`config/profiles.json`)

| 档位 | 市值 | 日均成交额 | 最低股价 | 标记 |
|---|---|---|---|---|
| **STANDARD** | ≥ $3亿 | ≥ $500万 | ≥ $5 | — |
| **SMALL_SPEC** | $5000万 – $3亿 | ≥ $100万 | ≥ $1 | `speculative: true` |

### 活力地板(TASK_CARD_10,`config/vitality.json`)

在检测之前先剔除"死股":要求 10 日相对成交量(RVOL)中位数 ≥ 0.8,**且**过去 20 天里至少有 3 天 RVOL > 1.2。

实测会拦掉约 66% 的标的(2095/3175)。这个比例偏高但可解释:全宇宙里多数非活跃个股本来就过不了这个双重门槛。这是「宁可错过埋伏,不要死股」的既定代价。

## 3.2 五种机会形态

### 四个"检测桶"(`src/screen/detectors/`,逐标的独立判断)

| 桶 | 大白话 | 核心信号 |
|---|---|---|
| **动量突破** `momentum_breakout` | 刚开始放量往上冲 | 突破结构 + 量能 |
| **波动挤压蓄势** `volatility_compression_setup` | 憋久了,像压紧的弹簧 | 布林带宽百分位极度收缩 + 缩量 |
| **超卖反转** `oversold_reversal` | 跌过头了,开始企稳 | RSI 超卖 + 价格结构 |
| **机构吸筹代理** `institutional_accumulation_proxy` | 有钱在你看不见的地方进场 | Form 4 内部人扎堆买入 + 机构持股趋势 + 空头显著减少(需满足最少条件数) |

四个桶共用同一份预计算的 `IndicatorFlags`,各自独立判断 `triggered`,一个标的可以同时命中多个桶。

### 第五种:板块传染(TASK_CARD_10,`src/screen/detectors/contagion/`)

**和上面四个不是一类东西**——它需要跨标的的板块上下文,单标的的 `IDetector` 接口装不下,所以单独实现。

三阶段逻辑:
1. **找龙头**:某标的单日涨 ≥5% 或 3 日累计 ≥8%,且 RVOL ≥3.0,且突破 20 日区间 → 该板块被标记为 `eventDriven`(有事件驱动)
2. **找滞后者**:在事件驱动板块内,找涨幅明显落后龙头(滞后幅度 ≥6%)但成交已经activate(RVOL ≥1.3)的标的 → 这些是传染候选
3. **卫星警示**:小市值(<$10亿)+ 高 beta(≥1.5)的标的会被打上 `highBetaSatellite` 警示标记

**关键约束**:`highBetaSatellite` **只是警示,绝不排除**。这是宪法「筛选宽容度原则」的要求——风险高、波动大不构成预先排除的理由,判断权留给研究层和使用者。

## 3.3 选取:从几千缩到十几

`config/card05.json`:`maxCandidates: 3`,`maxWatchlist: 8`。

**候选席位分配顺序**:
1. **升级优先**:上一轮在观察哨、这一轮完全触发某个桶的标的,优先占座
2. **传染桶预留块**:`sector_contagion` 有一块预留席位,上限 `ceil(maxCandidates/2)`(3 个候选时 = 2 席),防止传染候选占满全部席位
3. **四桶轮转**:剩余席位在四个桶之间 A→B→C→D 轮流取,避免某一种形态霸占

**观察哨填充优先级**:`contagion_unselected`(传染桶次优)→ `compression_unselected`(挤压桶未入选)→ `near_miss`(差一点点触发,用 10% 宽限带重新判定)

## 3.4 产出

每次运行写进 `output/runs/{YYYY-MM-DD}[_HHMM]/`:

| 文件 | 用途 |
|---|---|
| `ATLAS_PAYLOAD.txt` | 完整证据包,给 Atlas Radar(研究层)分析用 |
| `ATLAS_DISSENT_PAYLOAD.txt` | **隔离包**,只有 symbol + 桶类型,给 Red Team 攻击用 |
| `report.html` | 自包含单文件报告(内联 CSS/SVG,浏览器直接打开) |
| `screen_run.json` | 完整结构化输出,含全部标的的旗标、耗时分解、失败归因 |

全局文件(不按日期分):
- `output/ledger.jsonl` —— **前向结果账本,宪法保护,只追加,进 git 版本控制**
- `output/checkpoint.json` —— 抓取缓存(约 270MB,gitignored)。**删除它会导致下次运行重新支付 2.5-3 小时的冷启动成本**

## 3.5 命令

```bash
npm run screen -- --profile <standard|small_spec|both>   # 跑一次完整筛选
npm run ledger:stats                                      # 四桶命中率/死亡率统计
npm run ledger:backfill -- --ticker SYM [--outcome ...]   # 手动回填结果(网页也能做)
npm run ledger:sync                                       # 账本与 Supabase 双向同步
npm run report:refresh [-- --run-id <id>]                 # 把 Radar 评级织回报告并重推
npm run typecheck                                         # tsc --noEmit
npm test                                                  # 300 个单测
```

---

# 第四部分:Stockpit —— 网页

## 4.1 页面结构

| 路由 | 导航名 | 作用 |
|---|---|---|
| `/screener` | **Screener** | 扫描历史列表 + 运行按钮(仅本地)+ 每次运行的详情 |
| `/screener/[id]` | — | 单次扫描详情:候选列表(带交接按钮和已深研标记)+ 内嵌完整报告 + Radar/红队结果 |
| `/journal` | **Journal** | 深度分析记录(聚合/表格/卡片三视图、筛选、图表、导出) |
| `/watchlist` | **Watchlist** | 追踪标的 + 实时报价 + 四类预警 |
| `/outcomes` | **Outcomes** | 账本:四桶命中率统计 + 待回填列表 + 一键标记结果 |
| `/report/[id]` | — | 单次深度分析的完整可打印视图 |
| `/settings` | (右上角) | 仓位计算器参数 + 数据导入导出 |
| `/` | (不在导航) | Analyze 页面。**保留但不展示**——MCP 靠它背后的 API,而且以后 BYOK 会落在这里 |

**命名说明**:原来叫 "Atlas" 和 "Journal"。Atlas 是代号,外人读不懂,改成行业标准词 **Screener**;Journal(交易日志)本身就是投资圈标准说法,保留。**ETF 页面已整体删除**。

## 4.2 API 路由

| 路由 | 方法 | 作用 |
|---|---|---|
| `/api/payload` | POST | 组装 V5 Payload(**MCP 的 build_payload 打的就是这个**) |
| `/api/chart-data` | POST | 单独重取数值型图表数据 |
| `/api/journal` | GET/POST | 记录列表(GET 时顺带跑结果自动回填)/ 新增 |
| `/api/journal/[id]` | GET/PATCH/DELETE | 单条读写删 |
| `/api/journal/[id]/dissent-payload` | POST | 生成隔离审查包 |
| `/api/journal/tickers` | GET | 已分析过的代码集合(供"已深研"标记) |
| `/api/atlas/runs` | GET | 扫描历史列表 |
| `/api/atlas/runs/[id]` | GET | 单次扫描详情 + 关联的研究层结果 |
| `/api/atlas/latest` | GET | 最新一次的 payload 文本(供 MCP 取用) |
| `/api/atlas/reviews` | POST | 保存 Radar 辩护状 / 红队攻击结果 |
| `/api/atlas/run` | GET/POST | 触发扫描 / 查状态(**仅本地控制面**) |
| `/api/atlas/refresh-report` | POST | 重渲染报告(**仅本地控制面**) |
| `/api/atlas/ledger` | GET/POST | 账本统计与待回填 / 记录一条结果 |
| `/api/watchlist` | GET/POST/DELETE | 追踪列表 |
| `/api/settings` | GET/PUT | 仓位参数 |
| `/api/health` | GET | 四个数据源 + 数据库连通性自检 |
| `/api/heartbeat` | GET | Vercel 每日 cron 打的心跳,防 Supabase 暂停 |

除 `/api/heartbeat` 外,全部经过 `checkAuth()` 密码校验。

## 4.3 数据模型(Supabase,6 张表)

| 表 | 内容 | 谁写入 |
|---|---|---|
| `journal_entries` | 深度分析记录(评级卡、全文、结果追踪、反证) | 网页 / MCP |
| `atlas_runs` | 每次扫描一行(报告 HTML、两份 payload、候选/观察哨结构化数据) | Atlas 推送 |
| `atlas_reviews` | Radar 辩护状 / 红队攻击(含结构化的评级/概率/确信度) | MCP |
| `atlas_ledger` | **账本镜像**(本地 `ledger.jsonl` 才是真相来源) | Atlas 同步 / 网页回填 |
| `watchlist_items` | 追踪列表 | 网页 |
| `app_settings` | 仓位参数(单行,id=1) | 网页 |

**账本的双向同步机制**(重要):
- 本地 `output/ledger.jsonl` 是**宪法定义的唯一真相来源**(只追加、进 git)
- Supabase 的 `atlas_ledger` 只是**镜像**,让网页能看统计、能回填
- 网页回填写进 Supabase → Atlas 下次运行(或手动 `npm run ledger:sync`)**拉回本地追加**
- 幂等靠 `natural_key`,时间戳**统一归一化成 epoch 毫秒**再比对——因为 Postgres 回显 timestamptz 是 `+00:00` 格式,本地 JSON 是 `Z` 格式,同一时刻但字符串不同,直接比字符串会导致每次同步都重复追加

## 4.4 MCP 桥接(11 个工具)

`mcp-server/` 是一个**薄 HTTP 代理**:自己不含任何业务逻辑,不做任何 LLM 调用,只是把 Claude Desktop 的工具调用转发给已经在跑的 Stockpit API。

| 工具 | 作用 |
|---|---|
| `build_payload(ticker, depth?, question?)` | 取实时数据组装 V5 Payload |
| `save_analysis(rating_json, ...)` | 保存分析结果到 Journal |
| `build_dissent_payload(entry_id)` | 生成隔离审查包 |
| `save_dissent(entry_id, dissent_json)` | 保存反证结果 |
| `list_journal(ticker?, limit?)` | 列出记录摘要 |
| `get_entry(entry_id)` | 取单条完整记录 |
| `atlas_get_latest_payload()` | 取最新扫描的 ATLAS PAYLOAD |
| `atlas_get_dissent_payload()` | 取最新扫描的隔离包 |
| `atlas_save_radar_brief(symbol, content_text, grade?, probability?, confidence?, desc_text?)` | 保存辩护状 |
| `atlas_save_dissent_verdict(symbol, content_text, ...)` | 保存红队攻击 |
| `atlas_refresh_report(atlas_run_id?)` | 把评级织回报告并重推 Supabase |

**为什么 `atlas_save_radar_brief` 要单独传 grade/probability/confidence**:让 Claude 把它已经算出来的结构化值**当参数直接传**,而不是让后端去正则解析散文——后者又脆又容易错。只有传了这些字段,`atlas_refresh_report` 才能把它们织进报告的占位符。

---

# 第五部分:完整工作流

## 5.1 一个周期长什么样

| 步骤 | 操作 | 自动化程度 |
|---|---|---|
| 1 | 打开 `localhost:3000/screener`,点「Run screen now」 | 一次点击 |
| 2 | 等待(热缓存约 16 分钟) | 全自动,跑完导航出现未读圆点 |
| 3 | 点开报告看候选 | 一次点击 |
| 4 | Claude Desktop 打开 Atlas Radar 项目,说一句"读取最新扫描并出辩护状" | **一句话**,Claude 自己调工具取数据、分析、存回 |
| 5 | 同上,Atlas Red Team 项目 | **一句话** |
| 6 | 回网页看织入评级后的报告 | 自动 |
| 7 | 决定深研哪只 → 点候选旁的「Deep research」按钮 | 一次点击(复制现成指令) |
| 8 | 粘进 Claude Desktop 的分析项目 | 一次粘贴 |
| 9 | (数周后)`/outcomes` 页面点「已重定价/已失效/已过期」回填账本 | 一次点击 |

**整个流程不需要打开终端。**

## 5.2 无法自动化的那一步,以及为什么

第 4、5、8 步**必须有人在场**——需要你本人打开 Claude Desktop 说一句话。

原因很具体,不是"技术难":一次 claude.ai / Claude Desktop 的**对话**在结构上无法被后台无人触发。能被脚本定时调用的只有付费的 Anthropic API,而那违反原则五($0 成本)。

**这是"不用付费 API"能做到的天花板。** 要突破它只有三条路,每条都有明确代价:

1. **用付费 Anthropic API** —— 放弃 $0 成本(按当前用量估算每月几毛到几块钱)
2. **用免费额度的其他模型 API**(Gemini/Groq 等) —— $0 成本可行,但**出分析的不再是 Claude**。你的 Radar/红队/V5 提示词是针对 Claude 行为反复调校的,换模型是"谁在帮你做判断"这个产品层面的真实变化,不是基础设施替换
3. **脚本模拟浏览器操作 claude.ai** —— **不推荐**:大概率违反 Anthropic 消费级服务条款,而且脆弱(界面一改就崩)、要存登录态,违反"不引入重运维"

**但要分清两件事**:"零人工触碰"做不到,"消灭无意义的体力活"完全做到了。文件复制粘贴、翻文件夹找报告、手抄代码、开终端跑账本——这些全部已经消除。

---

# 第六部分:环境与配置

## 6.1 环境变量总表

### Atlas(`atlas/.env`)

| 变量 | 必需性 | 缺失时的行为 |
|---|---|---|
| `SUPABASE_URL` | 选填 | 跳过推送,本地产出不受影响 |
| `SUPABASE_SERVICE_ROLE_KEY` | 选填 | 同上 |
| `FMP_API_KEY` | 选填 | 候选的 P/E、P/B、PEG 全部显示「不可得」 |
| `FRED_API_KEY` | 选填 | **信用闸门永远报 unknown,熔断机制形同虚设** |
| `SEC_EDGAR_USER_AGENT` | 选填 | 用格式合规但假的占位符。SEC 硬性要求 `name@domain` 邮箱格式,长期使用建议填真实可联系邮箱 |
| `FINNHUB_API_KEY` | **无用** | Atlas 代码根本没用到,是早期预留,可无视 |

### Stockpit 本地(`stockpit/.env` + `.env.local`)

| 变量 | 必需性 | 说明 |
|---|---|---|
| `SUPABASE_URL` | **必需** | 缺失时 `lib/supabase.ts` 在模块加载期就抛错 |
| `SUPABASE_SERVICE_ROLE_KEY` | **必需** | 同上 |
| `ACCESS_PASSWORD` | **必需** | 缺失时全站 401(fail closed,不是 fail open) |
| `IS_LOCAL_CONTROL_PLANE` | 本地设 `true` | 决定「运行扫描」按钮是否出现/生效 |
| `ATLAS_REPO_PATH` | 本地必需 | Atlas 仓库绝对路径,触发扫描时用 |
| `FMP_API_KEY` / `FINNHUB_API_KEY` / `FRED_API_KEY` | 选填 | 缺失时对应数据显示「不可得」,不影响其余流程 |

### Stockpit on Vercel

和本地一样,**但 `IS_LOCAL_CONTROL_PLANE` 和 `ATLAS_REPO_PATH` 必须留空**——云端碰不到你电脑上的 Atlas,填了只会让网页错误地显示一个点了没用的按钮。

可选:`CRON_SECRET`——设了之后 Vercel 会用它保护每日心跳接口。

⚠️ **环境变量必须在首次部署前填好**,否则构建阶段就会失败(不是运行时才报错)。

## 6.2 本地常驻(pm2)

```bash
npm install -g pm2 pm2-windows-startup
pm2-startup install                    # 注册开机自启
cd Desktop/stockpit
pm2 start ecosystem.config.js
pm2 save
```

常用:`pm2 status` / `pm2 logs stockpit` / `pm2 restart stockpit`

**Windows 上的坑(已修)**:pm2 默认用 `node` 执行 `script`,而 `npm` 在 Windows 解析成 `npm.cmd`(批处理文件),node 解析不了会崩溃重启循环。`ecosystem.config.js` 因此直接指向 `node_modules/next/dist/bin/next`,绕开 npm 包装层。

## 6.3 Claude Desktop MCP 配置

配置文件位置(**Microsoft Store 版本**,和常规安装不同):

```
C:\Users\SD\AppData\Local\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\claude_desktop_config.json
```

```json
{
  "mcpServers": {
    "stockpit": {
      "command": "node",
      "args": ["C:\\Users\\SD\\Desktop\\stockpit\\mcp-server\\dist\\index.js"],
      "env": {
        "COCKPIT_URL": "http://localhost:3000",
        "COCKPIT_PASSWORD": "<你的 ACCESS_PASSWORD>"
      }
    }
  }
}
```

注意:环境变量名仍是 `COCKPIT_*`(mcp-server 代码里读的就是这个名字),改名会失效。改完配置需**完全退出并重开** Claude Desktop。

前提:Stockpit 必须正在运行(pm2 常驻就满足)——mcp-server 自己没有数据,只是转发。

## 6.4 Supabase 建表

完整 schema 在 `stockpit/supabase/schema.sql`,在 Supabase 控制台 SQL Editor 里整份跑一次即可。文件是**幂等**的(`create table if not exists` + `add column if not exists`),可以安全重复执行。

**免费版的坑**:项目 7 天无数据库活动会自动暂停。已用 `vercel.json` 里的每日 cron 打 `/api/heartbeat` 解决。如果哪天删了那个路由却没意识到,项目会静默暂停。

---

# 第七部分:已知边界与坑

## 7.1 认证强度(**部署前必须处理**)

现在是单一共享密码,通过 `x-access-password` 请求头校验,**没有任何速率限制**。这套机制在 localhost 下"够用"仅仅是因为外人连不到。

**一旦挂到公网 URL,它就是唯一的门,而且可被脚本无限次爆破。** 至少要:在 Vercel 环境变量里单独设一个长的随机密码(不必和本地一致,两套配置本来就独立)。更彻底的方案是换成有速率限制的真会话机制或 Supabase Auth——这件事**已被明确识别但尚未实施**。

## 7.2 报告里永远填不满的占位符

`atlas_refresh_report` 只能填**每个候选的评级/概率/确信度/描述**。报告里的「市场复盘」「板块判断」「萌芽主题」「本周总结」这四类占位符**不会被填上**——因为 `ATLAS_RADAR_INSTRUCTIONS.md` 的职责范围本来就只有"逐候选出辩护状",它根本不产出市场级/主题级的叙事内容。

这不是 bug,是提示词范围的问题。要填上必须扩写 Radar 的指令本身——这是一个独立的、需要单独决策的产品改动。

## 7.3 免费额度的真实边界

| 服务 | 限制 | 影响 |
|---|---|---|
| Vercel Hobby | **禁止商业用途**;cron 每天最多 1 次;函数 300 秒上限 | 个人用无碍;重计算不可能放上去 |
| Supabase 免费版 | 500MB 存储;7 天无活动自动暂停 | 纯文本数据绰绰有余;心跳已解决暂停 |
| 自定义域名 | **不可能免费** | `*.vercel.app` 是唯一的 $0 选项 |

**关于替代方案的结论**(已实际查证):Neon 的暂停机制比 Supabase 更聪明(scale-to-zero 秒级恢复,不需要心跳),但 Supabase 自带 Auth 更省事;Cloudflare Pages/Netlify 的免费条款比 Vercel 宽松(允许商业用途),但 Next.js 支持不如 Vercel 原生。**换的成本目前都大于收益。**

唯一值得记住的是 **Render 的免费 Background Worker**(每月 750 小时)——它是目前查到唯一可能让 Atlas 扫描彻底脱离本地电脑的免费路径。Fly.io 已于 2024 年取消永久免费层,不再是选项。

## 7.4 硬件问题(**当前存在,影响使用**)

这台笔记本(ILLEGEAR ONYX V)存在**瞬间断电**问题,已通过事件日志确诊:

- Kernel-Power 41 事件,但 `BugcheckCode = 0`,**且完全没有 minidump**(转储功能是开着的)→ **不是蓝屏崩溃,是硬件层面瞬间断电**
- 零 WHEA 事件(CPU/内存/PCIe 未报错)、零磁盘错误、SMART 健康
- **电池健康度仅 14.6%**(设计 62,320 mWh,当前满充 9,120 mWh)

机制:游戏本负载尖峰时电源适配器往往供不上,需要电池同时放电补足。电池衰减到这个程度内部阻抗过高,尖峰一来电压塌陷,整机断电。

**已造成的实际损失**:一次断电发生在 git 写盘中途,把 `.git/config` 和两个分支引用文件写成了全 NULL 字节。(对象库完好,已从 reflog 完整恢复。)

**⚠️ 安全提示**:锂电池老化到这个程度常会**鼓包**,从内部顶开底盖——如果感觉"底盖松动",很可能就是这个原因,属于起火风险,应立即停用送修。

**操作建议**:修好之前**不要跑 Atlas 完整扫描**——16 分钟满载 CPU + 大量磁盘写入正是最容易触发断电的工况,而断在写盘中途就会损坏文件。

---

# 第八部分:关键决策记录

理解"为什么是这样"比"是什么"更重要。以下是几个影响深远的决策及其真实理由。

**为什么不合并成 monorepo**:整合发生在数据库层而非代码层,两个仓库零代码依赖。合并会强迫 Atlas 装上它根本不需要的 Next.js/React 依赖,还会让两套治理体系打架。

**为什么在建好之后才拆分仓库(早期反而反对拆分)**:早期拆分等于要把 Cockpit 全套功能重写一遍,纯属重复劳动。等到真正分叉之后(删了 ETF、改了全部命名、journal 只认 Supabase),两条线已不可能收敛,一个永不合并的长期分支实质就是 fork。**同一时刻只能 checkout 一个分支**,不拆文件夹就无法同时运行两个版本——而"保留可运行的原版"是明确要求。

**为什么 Atlas 的整合改动合并回 master 而不是留在分支**:所有 Supabase 触点在缺 key 时都是打印日志后 return,不抛异常,所以没有 key 的克隆行为完全一致。而留在分支上是**已经咬过人的坑**——曾有一次跑筛选时工作区停在 master,导致推送被静默跳过,事后才发现要补跑。

**为什么未读标记存在 localStorage 而不是 Supabase**:"我在这台设备上看过没有"本质上是每台设备各自的状态。同步到云端会导致在电脑上打开就清掉手机上的红点,那不是未读标记该有的行为。

**为什么账本要双向同步而不是直接搬到 Supabase**:本地 `ledger.jsonl` 是宪法定义的真相来源(只追加、进 git、可用 `git log` 审计)。网页回填的结果必须能回到本地,否则本地账本会静默落后,而所有筛选逻辑(观察哨升级、待回填提醒)读的都是本地文件。

**为什么让 Claude 直接传结构化字段而不是后端解析**:Claude 按自己的指令本来就会算出评级/概率/确信度并输出 JSON。让它当工具参数直接传,比后端去正则解析散文可靠得多。

---

# 第九部分:现状与下一步

## 9.1 已完成

Atlas 扫描 → Supabase → 网页展示 → Claude Desktop 出辩护状 → 评级织回报告 → 账本双向同步 → 网页一键回填,整条链路已端到端验证跑通。Journal 已全量迁移 Supabase(6 条真实记录),watchlist/settings 已云端化,pm2 常驻免终端,三个仓库已理清并全部推送 GitHub。

Atlas 侧:`npx tsc --noEmit` 干净,300/300 单测通过。

## 9.2 待办(按优先级)

1. **修笔记本电池**(见 §7.4)—— 在此之前避免跑完整扫描
2. **Vercel 重新指向 `stockpit` 仓库** —— 旧项目指向的分支已删除,当前是坏的
3. **公网密码换成强密码**(见 §7.1)
4. **BYOK(填 API key 在网页跑分析)** —— 已完整设计但未实施。要点:访客的 key **绝不能存进数据库**,只存浏览器 session、每次请求当头部发、后端用完即丢;访客产出的数据要与本人真实记录完全隔离;先只接 Anthropic 一家,架构留可插拔;Atlas 扫描不应开放给访客触发(它不是个性化的,而且触发扫描根本不需要 LLM key,拿 key 当门槛挡不住滥用)
5. **Radar 提示词扩写**(见 §7.2)—— 让市场级占位符也能被填上

## 9.3 给接手者的提醒

- 两个仓库的**治理体系**(`CLAUDE.md` 路由 + `rules_core/` + 任务卡 + `ai/` 记忆文件)是这个项目的实际工作方式,不是摆设。Atlas 的 `constitution/` 是**冻结的法律**,只走修正案,不在开发中直接改。
- 改动任一边的 Supabase 表结构时,**两边都要同步**:schema 在 `stockpit/supabase/schema.sql`,Atlas 侧的读写在 `src/ledger/supabaseSync.ts` 和 `src/report/supabase/pushRun.ts`。
- Atlas 现在只有 `master` 一条线,不要再开长期分支。需要隔离就用短生命周期分支并尽快合并。
- 完整的决策历史在 `atlas/ai/decisions.md`(append-only),遇到"为什么当初这样做"的问题先查那里。
