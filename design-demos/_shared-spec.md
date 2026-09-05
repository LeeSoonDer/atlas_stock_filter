# 共享设计 Spec — Atlas Weekly Intel Briefing UI/UX 升级(三方向共用输入)

## 项目背景

Atlas("Attention Allocation Engine",注意力配置引擎)是一个确定性的 TypeScript/Node CLI 全美股筛选器,对 NYSE+NASDAQ 全市场(约 3350 只标的)按四个检测桶跑规则筛选,产出「≤5 研究候选 + ≤10 观察哨」两层结果,再手动交给姊妹产品 Cockpit 做深度个股分析。Atlas 自己**零 LLM 调用**——本仓库只做机械检测,产出的周报里凡是需要判断/叙事的地方,都明确标"待研究层填充"(研究层是另一个独立的、会调用 LLM 的系统,不在本仓库范围内)。这个"数据与判断分离"的原则和 Cockpit 完全一致,是同一个人做的两个姊妹产品,面向同一个使用者(独立研究者本人)。

## 本次要优化的界面

**Weekly Intel Briefing**——Atlas 唯一的可视化交付物,一份自包含单文件 HTML(`output/latest.html`,内联样式+mini图表,直接浏览器打开),每次筛选跑完自动生成。这就是 Atlas 的"Report 页",地位等同于 Cockpit 的 Report 详情页。

## 现状(真实代码产出,非虚构)——这是要被重新设计的"之前"版本

当前的 `output/latest.html` 用的是一套**完全独立于 refined-functionalism 的临时配色**(`--gold:#e0b341` `--violet:#8b7cf0` `--amber:#e0913b` `--blue:#4a90d9`),不是本次要用的设计系统。当前真实区块顺序(从上到下):

1. **Masthead**:品牌"ATLAS·RADAR" + 日期/时间/宇宙数量(3350)
2. **大盘环境复盘**:4 格统计(SPY vs 200 日线/VIX/领涨板块/领跌板块)+ 一段"待研究层填充"占位文字
3. **全板块资金流谱**:11 个板块按 rank 排列的表格式列表(涨跌%/挤压密度%/流向标签 流入·横盘·流出)
4. **热门领域详述**:2 列网格,每个卡片是一个板块或主题篮子(科技/软件、AI 基建、航天/太空、Financial Services 等),含板块数据+"待研究层填充"判断文字+进候选池/观察哨名单
5. **萌芽主题雷达**:自动检测出的主题雏形卡片(如"Financial Services"的挤压密度异动),同样待研究层判断强度/阶段
6. **第一层·值得研究**(候选,当前 3 个:SBFG/SLP/WSBC):每个候选是一张卡——评级徽章(当前全是"N/A",研究层还没打分)+ ticker+公司名+"待研究层填充"描述+ 5-6 个徽章(bucket类型/所属板块/财报事件/PROMOTED/SMALL_SPEC)+ 一排技术面标签(RSI14/52周位置/均线排列/BB带宽百分位/量比/机构持股)+ 右侧90天走势 sparkline + 占位文字
7. **第二层·观察哨**(当前 8 个:APGE/ALOT/NAVN/NIC/WBI/KFY/FNWD/MBX):紧凑表格行,ticker+桶类型+公司名+触发条件(空)
8. **排除项说明**:占位文字
9. **本周总结与前瞻**:占位文字 + 免责声明
10. **账本被动区**:已到期待回填/已触发失效两个列表(当前都是"无...条目")
11. **Footer**:Layer 1 声明 + profile + gatesPassedCount

## 已识别的真实痛点(可作为这次重构的靶子)

1. **候选列表(产品明确定义的"必须主导的核心信息")被压在第 6 个区块才出现**——前面有市场复盘、板块资金流表格、热门领域网格、萌芽主题四大段落,与 refined-functionalism 规范里"Atlas primary info: the candidate list, tier-tagged"以及产品自己的定位"scan-first, drill-second"直接冲突。
2. **四个检测桶(momentum breakout / volatility compression / institutional accumulation / oversold reversal)在界面上没有统一颜色编码**——桶标签(`.bdg.bucket`)全部用同一个紫色,萌芽主题模块又用另一种紫色表达"主题强调",观察哨行的桶文字是纯文字无颜色,三处对"桶"这个核心概念的视觉表达互不一致,违反 refined-functionalism 明确的"Bucket coding must be consistent everywhere it appears"。
3. **候选卡的层级完全靠徽章和边框堆出来,不是靠排版**——一张候选卡里同时有:评级徽章、5 个不同颜色的标签徽章、6 项技术面纯文字标签、sparkline——没有一个"一眼看到最重要那件事"的锚点,ticker 和评级字号并不比周边元素大多少。
4. **待研究层填充的占位文字被当成正文一样渲染**(灰色斜体,但依然占满整行/整块),在候选描述、板块判断、主题判断、总结区都大量出现,视觉上和真实数据抢注意力,而不是明显"次要/待补"。
5. **密度没有按区块意图分层**——市场复盘(应该是低密度速览)、板块资金流表(应该是高密度表格)、候选卡(应该是中密度、评级主导)目前视觉权重几乎一样。
6. **热门领域详述区块存在卡片套卡片的隐患**:2 列网格里每张卡片内部又有数据行+判断段落+成员列表三层堆叠。

## 视觉系统:refined-functionalism · Atlas token(锁定,照抄数值)

来源:`~/.claude/skills/refined-functionalism/references/tokens.css`,选用 `[data-project="atlas"]` 那组。**必须 `<body data-project="atlas">` 并把下面这段完整内联进 `<style>`,颜色/字体/圆角/间距一律引用 `var(--…)`,不允许写死 hex。**

```css
[data-project="atlas"] {
  --bg:            #0B0E14;
  --surface:       #141922;
  --elevated:      #1C2230;
  --overlay:       #232B3B;
  --border:        #262E3D;
  --border-strong: #34405480;

  --text:          #E8EDF5;
  --text-2:        #9AA6B8;
  --text-muted:    #5E6B80;

  --accent:        #22C9D6;   /* signal-cyan,Atlas 专属,区别于 Cockpit 的电光蓝 */
  --accent-weak:   #22C9D61F;
  --accent-strong: #55E0EA;

  --pos:           #16C784;  --pos-weak:  #16C7841F;
  --neg:           #EA3943;  --neg-weak:  #EA39431F;
  --warn:          #F0A020;  --warn-weak: #F0A0201F;
  --info:          #3B82F6;

  /* 四个检测桶——固定颜色,全篇必须一致使用 */
  --bucket-momentum:   #2F80FF;  /* momentum breakout 动量突破 */
  --bucket-vol:        #A855F7;  /* volatility compression 波动挤压 */
  --bucket-instl:      #16C784;  /* institutional accumulation 机构吸筹代理 */
  --bucket-oversold:   #F0A020;  /* oversold reversal 超卖反转 */

  --tier-research: var(--accent);   /* 第一层候选(≤5) */
  --tier-watch:    var(--text-2);   /* 第二层观察哨(≤10) */

  --font-display: 'Manrope', system-ui, sans-serif;
  --font-body:    'Manrope', system-ui, sans-serif;
  --font-mono:    'JetBrains Mono', ui-monospace, monospace;

  --r-xs: 4px; --r-sm: 6px; --r-md: 10px; --r-lg: 14px;
  --s-1: 4px; --s-2: 8px; --s-3: 12px; --s-4: 16px;
  --s-5: 24px; --s-6: 32px; --s-7: 48px; --s-8: 64px;

  --shadow-overlay: 0 8px 32px -8px #00000099;
  --ease: cubic-bezier(.2,.6,.2,1);
  --dur:  160ms;
}
* { box-sizing: border-box; }
body {
  margin: 0; background: var(--bg); color: var(--text);
  font-family: var(--font-body); font-size: 14px; line-height: 1.5;
  font-feature-settings: 'tnum' 1;
}
.mono { font-family: var(--font-mono); font-feature-settings: 'tnum' 1; }
```
Google Fonts:`<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">`

## refined-functionalism 的硬性设计规则(必须遵守,不是建议)

- **先构图后打磨**:先定主任务→主信息→层级→关系→渐进展开→构图,最后才是字体/间距/表面/色彩/组件/动效。不要一上来就改颜色圆角。
- **Typography carries hierarchy**:大小 > 字重 > 位置 > 间距 > 对比 > 颜色。不要用卡片/边框/颜色去凑排版本该表达的层级。数字用大号等宽字(`--font-mono`)、tabular对齐。ticker/时间戳/id/评分/价格一律 mono。
- **Color communicates before it decorates**:中性色打底做大部分结构工作,强调色+语义色只用来表达含义,绝不整屏铺色。状态永远"文字词先行,颜色第二"(如 STRONG/DEGRADED,不能只靠一个色块)。
- **Grid 是结构不是牢笼**:允许刻意打破(超大主指标、非对称焦点区),但必须是有意的。
- **留白负责分组和分隔**,优先于分割线;不要为了"看起来极简"硬加留白。
- **表面与边框克制**:bg → surface → elevated → overlay 四级;阴影只用在 overlay/modal;不允许卡片套卡片套卡片。
- **密度分区**:落地/结论页低密度;总览/摘要中密度;表格/对比/分析高密度;原始/诊断极高密度。同一页不同区块密度可以不同,不强求统一。
- **结论→原因→证据**的顺序,证据渐进展开,不强塞给用户,也不做成解释不了的黑箱结论。
- **图表按问题选,不按好看选**:趋势→折线/sparkline;对比→柱状;构成→堆叠柱/谨慎用甜甜圈;多维评分→雷达(仅当真的有多轴时);状态→分数/指示器/进度条。
- **反 AI 感硬禁清单**:紫蓝 AI 感渐变、厚玻璃拟态/模糊、发光/霓虹边框、过度阴影、卡通式超大圆角、pill-everything、装饰性色块/浮动形状、无意义图标或插画、emoji 当图标、持续/弹跳动画、卡片套卡片、重复的完全相同三栏卡片网格、装饰性分隔线、Display 字体用 Inter、SVG 画人脸。**任何一个效果拿掉之后不影响可用性/层级/含义,就该拿掉。**

## 交付要求(每个方向都要满足)

1. 一份完整、可独立在浏览器打开的单文件 HTML(内联全部 CSS/JS,`<body data-project="atlas">`,可以外链 Google Fonts,不依赖构建工具)。
2. **用下面提供的真实数据完整渲染**——这是 Atlas 真实产出的一份周报内容(2026-08-26,universe 3350,profile both),不是虚构数据,请照抄或合理复用,不要编造新的候选/板块/数字。
3. 页面宽度/断点由你自己的构图逻辑决定。
4. 完成后用 Playwright 截图:`npx --yes playwright screenshot "file:///<绝对路径>.html" "<截图路径>.png" --viewport-size=<你选的宽度>,1400 --full-page`。

## 真实数据(2026-08-26 周报,原样照抄自 `atlas/output/latest.html`)

```
MASTHEAD: ATLAS·RADAR · WEEKLY INTEL BRIEFING · 2026-08-26 · 16:28 UTC · universe 3350 · profile both

=== 大盘环境复盘(只描述现在,不预报未来)===
SPY vs 200日线: 上方 · ↑ 斜率向上
VIX: 15.56 · 高于20日均值
领涨板块: Energy · rank 1
领跌板块: Utilities · rank 11
[本区总结: 待研究层填充]

=== 全板块资金流谱(11板块,按rank)===
rank  板块                          周涨跌   挤压密度   流向
1     Basic Materials               +2.4%    3.5%      流入
2     Financial Services ★异动      +1.3%    23.2%     流入   ← 挤压密度全场最高,标记异动星号
3     Communication Services        +1.1%    6.2%      流入
4     Real Estate                   +0.4%    12.4%     流入
5     Consumer Defensive            -0.2%    8.3%      横盘
6     Technology                    -0.9%    3.1%      横盘
7     Industrials                   -0.9%    7.2%      横盘
8     Energy                        -1.0%    3.1%      横盘
9     Utilities                     -1.2%    6.3%      流出
10    Healthcare                    -1.2%    6.6%      流出
11    Consumer Cyclical             -1.5%    11.9%     流出

=== 热门领域详述(你点名的 + 本周异动)===
科技/软件: 板块rank 6/11 · 周涨跌 -0.9% · 挤压密度 3.1% · 横盘 · [判断待研究层] · 进观察哨: ALOT, NAVN
AI 基建: 细分主题篮子近似 · 周涨跌 -4.7% · 挤压密度 0.0% · 流出 · [判断待研究层] · 篮子覆盖 10/10 成分股在筛选宇宙内(手工近似非官方分类) · 无候选无观察哨
航天/太空: 细分主题篮子近似 · 周涨跌 -7.8% · 挤压密度 0.0% · 流出 · [判断待研究层] · 篮子覆盖 8/8 · 无候选无观察哨
Financial Services: 板块rank 2/11 · 周涨跌 +1.3% · 挤压密度 23.2% · 流入 · [判断待研究层] · ◆进候选池: SBFG, WSBC · 进观察哨: NIC, FNWD

=== 萌芽主题雷达(激进档,苗头即报,尚未经研究层确认)===
主题: Financial Services · 强度/阶段: 待研究层判定
footprint: volatilityCompression 23.2% (129只/555只样本)
[白话判断: 待研究层填充]

=== 第一层·值得研究(候选,本轮共 3 个,round-robin 跨桶选出)===

候选 1 — SBFG (SB Financial Group, Inc. - Common Stock)
  评级: N/A(研究层未打分)
  桶: volatility_compression_setup(波动挤压蓄势)
  板块: Financial Services
  事件: ⚡ earnings 2026-10-29
  标记: PROMOTED(本轮从观察哨升级而来) · SMALL_SPEC(小盘投机档)
  技术面: RSI14 51.72 中性 · 52周位置 近52周高点 · 均线 非多头排列 · BB带宽百分位 极度收缩 · 量比 缩量 · 机构持股 不可得
  描述: 待研究层填充
  90天走势: 有 sparkline(先跌后小幅回升的震荡形态)

候选 2 — SLP (Simulations Plus, Inc. - Common Stock)
  评级: N/A
  桶: volatility_compression_setup + institutional_accumulation_proxy(双桶命中)
  板块: Healthcare
  事件: ⚡ earnings 2026-10-29
  标记: PROMOTED
  技术面: RSI14 64.56 中性 · 52周位置 中位区间 · 均线 多头排列 · BB带宽百分位 极度收缩 · 量比 缩量 · 机构持股 不可得
  描述: 待研究层填充
  90天走势: 有 sparkline(震荡后低位企稳)

候选 3 — WSBC (WesBanco, Inc. - Common Stock)
  评级: N/A
  桶: volatility_compression_setup
  板块: Financial Services
  事件: ⚡ earnings 2026-10-21
  标记: PROMOTED
  技术面: RSI14 46.63 中性 · 52周位置 近52周高点 · 均线 非多头排列 · BB带宽百分位 极度收缩 · 量比 缩量 · 机构持股 不可得
  描述: 待研究层填充
  90天走势: 有 sparkline(高位震荡回落)

=== 第二层·观察哨(本轮 8 个,本轮 SBFG/SLP/WSBC 已从观察哨升格为候选)===
APGE — 波动挤压蓄势(未入选候选) — Apogee Therapeutics, Inc. - Common Stock
ALOT — 波动挤压蓄势(未入选候选) — AstroNova, Inc. - Common Stock
NAVN — 波动挤压蓄势(未入选候选) — Navan, Inc. - Class A Common Stock
NIC  — 波动挤压蓄势(未入选候选) — Nicolet Bankshares Inc. Common Stock
WBI  — 波动挤压蓄势(未入选候选) — WaterBridge Infrastructure LLC Class A Shares Representing LLC Interests
KFY  — 波动挤压蓄势(未入选候选) — Korn Ferry Common Stock
FNWD — 波动挤压蓄势(未入选候选) — Finward Bancorp - common stock
MBX  — 波动挤压蓄势(未入选候选) — MBX Biosciences, Inc. - Common Stock

=== 排除项说明 ===
待研究层填充(排除项判定需要研究层的实时信息核实,应用层无法自行判定)

=== 本周总结与前瞻(戴镣铐的白话)===
待研究层填充
免责声明: 每句均应锚定真实足迹或可查证的板块/价格数据,无无支撑预言。"这周没动"是诚实的合法输出;"值得注意"≠"建议买入",介入、仓位、执行属于你的领地。

=== 账本被动区 ===
已到期待回填: 无到期待回填条目
已触发无效化: 无已触发无效化条目

=== Footer ===
ATLAS · Layer 1 情报简报 · Profile both · gatesPassedCount 3350
```

## 产品自身对"检测桶"的定义(供你判断桶配色/分组逻辑时参考)

四个 v1 检测桶(`ai/project_overview.md`):Momentum Breakout(动量突破)、Volatility Compression Setup(波动挤压蓄势)、Institutional Accumulation Proxy(机构吸筹代理)、Oversold Reversal(超卖反转)。本轮真实数据里只出现了 volatility_compression_setup 和 institutional_accumulation_proxy 两种(候选2双桶命中),另外两桶本轮没有命中标的——这是真实情况,不要编造 momentum/oversold 的候选来"凑齐四桶展示",没有就是没有,可以在设计里体现"四桶今天只响了几个"这个事实本身。
