import { escapeHtml } from "./escapeHtml.js";
import { renderSparklineSvg } from "./sparkline.js";
import { REPORT_STYLES } from "./styles.js";
import { bbPercentileLabel, institutionalTrendLabel, rsiLabel, smaAlignmentLabel, volumeRatioLabel, week52PositionLabel } from "./semanticLabels.js";
import type { HotSectorEntry, SectorFlowEntry } from "../../screen/sector_scan/types.js";
import type { FootprintCondition } from "../../screen/detectors/IDetector.js";
import type { IndicatorFlags } from "../../screen/indicators/types.js";
import type { HtmlReportCandidateInput, HtmlWatchlistInput, RadarCandidateVerdict, RadarThemeInput, ReportInput } from "./types.js";

const PLACEHOLDER = "待研究层填充";
const FLOW_LABEL: Record<string, string> = { flow_in: "流入", flow_out: "流出", flat: "横盘", unknown: "不可得" };
const BREADTH_LABEL: Record<string, string> = { healthy: "健康", narrowing: "收窄", weak: "疲弱", unknown: "不可得" };
const ENTRY_STRUCTURE_LABEL: Record<string, string> = { breakout: "突破型(追高位)", pullback_to_ma: "回踩型(接回踩)" };
const FLOW_CLASS: Record<string, string> = { flow_in: "in", flow_out: "out", flat: "flat", unknown: "flat" };
const RISK_LABEL: Record<string, string> = { normal: "正常", elevated: "偏高", high: "高" };
/** 第四号修正案 修正案十一: an 爆发 theme must be labelled 追高风险区 and a
 * 衰竭 one 退潮. A fixed mapping from Radar's own enum, not app judgment. */
const STAGE_CAVEAT: Record<string, string> = { 爆发: "追高风险区", 衰竭: "退潮" };

/** BUCKET_ORDER's canonical ids, duplicated as a literal here rather than
 * imported from src/screen/select/types.ts - that module pulls in
 * nearMiss.ts's detector-config types, and the report layer stays a one-way
 * dependency (screen -> report), never the reverse. */
const BUCKETS: Array<{ id: string; label: string; colorVar: string }> = [
  { id: "momentum_breakout", label: "动能突破", colorVar: "--bucket-momentum" },
  { id: "volatility_compression_setup", label: "波动挤压蓄势", colorVar: "--bucket-vol" },
  { id: "oversold_reversal", label: "超卖反转", colorVar: "--bucket-oversold" },
  { id: "institutional_accumulation_proxy", label: "机构蓄势代理", colorVar: "--bucket-instl" },
  { id: "sector_contagion", label: "板块传导", colorVar: "--bucket-contagion" },
];
const BUCKET_BY_ID = new Map(BUCKETS.map((b) => [b.id, b]));

function fmt(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined) return "不可得";
  return Number.isInteger(v) ? String(v) : v.toFixed(digits);
}
function fmtPct(v: number | null, digits = 2): string {
  return v === null ? "不可得" : `${(v * 100).toFixed(digits)}%`;
}
function pctClass(v: number | null): string {
  if (v === null) return "neu";
  return v > 0 ? "up" : v < 0 ? "down" : "neu";
}
/** A Radar-only slot: its text verbatim, or the literal placeholder. */
function radarText(text: string | undefined, cls: string, fallback = PLACEHOLDER): string {
  return text ? `<p class="${cls}">${escapeHtml(text)}</p>` : `<p class="${cls} placeholder">${escapeHtml(fallback)}</p>`;
}
function bucketDot(id: string): string {
  const b = BUCKET_BY_ID.get(id);
  return `<span class="dot" style="background:${b ? `var(${b.colorVar})` : "var(--text-muted)"}"></span>`;
}

/** claude_code_design_draft.md §1.2 band -> CSS class. Matches config/card05.json's
 * footprintStrengthBands labels exactly - a 5th value ("不可得") covers the
 * ratio===null case, which computeFootprintStrength already returns literally. */
function strengthClass(band: string): string {
  if (band === "强") return "strength-strong";
  if (band === "中") return "strength-mid";
  if (band === "中偏弱" || band === "弱") return "strength-weak";
  return "strength-na";
}
function strengthColorVar(band: string): string {
  const cls = strengthClass(band);
  if (cls === "strength-strong") return "var(--strength-strong)";
  if (cls === "strength-mid") return "var(--strength-mid)";
  if (cls === "strength-weak") return "var(--strength-weak)";
  return "var(--text-muted)";
}

function totalBucketHits(detectorSummary: Record<string, { triggeredCount: number }>): number {
  return Object.values(detectorSummary).reduce((a, v) => a + v.triggeredCount, 0);
}
function zeroHitBucketIds(detectorSummary: Record<string, { triggeredCount: number }>): string[] {
  return BUCKETS.filter((b) => (detectorSummary[b.id]?.triggeredCount ?? 0) === 0).map((b) => b.id);
}

/* ======================= header: masthead + weather ======================= */

function renderWeatherItem(label: string, valueHtml: string, noteHtml = ""): string {
  return `<div class="w-item"><span class="w-label">${label}</span><span class="w-value">${valueHtml}</span>${noteHtml ? `<span class="w-note">${noteHtml}</span>` : ""}</div>`;
}

/**
 * The market environment as one line of measured facts - SPY vs its 200-day
 * line, VIX, the leading/lagging sector, breadth (修正案十八: describes the
 * current state only, never a direction call) and 52-week highs/lows. The
 * Radar's 大盘复盘 paragraph lives in the evidence section; this strip only
 * says whether one exists.
 */
function renderHeader(input: ReportInput): string {
  const [datePart, timePartFull] = input.runMeta.timestamp.split("T");
  const timePart = timePartFull ? timePartFull.slice(0, 5) : "n/a";
  const r = input.marketRegime;
  const b = input.breadth;

  const spyClass = r.spyCloseVsSma200 === "above" ? "up" : r.spyCloseVsSma200 === "below" ? "down" : "neu";
  const spyLabel = r.spyCloseVsSma200 === "above" ? "上方200D" : r.spyCloseVsSma200 === "below" ? "下方200D" : "不可得";
  const slopeLabel = r.spySma200Slope === null ? "" : r.spySma200Slope > 0 ? "· 斜率向上" : r.spySma200Slope < 0 ? "· 斜率向下" : "· 斜率持平";
  const vixVsAvg = r.vixCurrent === null || r.vixAvg20 === null ? "" : r.vixCurrent > r.vixAvg20 ? "· 高于20日均值" : r.vixCurrent < r.vixAvg20 ? "· 低于20日均值" : "· 持平20日均值";
  const leading = r.leadingSectors[0];
  const lagging = r.laggingSectors[0];
  const breadthText = b.state === "unknown" ? `不可得${b.stateUnavailableReason ? `(${escapeHtml(b.stateUnavailableReason)})` : ""}` : BREADTH_LABEL[b.state];
  const breadthClass = b.state === "healthy" ? "up" : b.state === "weak" ? "down" : "neu";
  const recapLink = input.radarNarrative?.marketRecapParagraph
    ? `<a href="#recap">大盘复盘 ↓</a>`
    : `<span class="placeholder">大盘复盘 · ${PLACEHOLDER}</span>`;

  const div = `<div class="w-div"></div>`;
  return `
<header class="head-sticky">
  <div class="masthead">
    <div class="brand"><span class="brand-mark">ATLAS · RADAR</span><span class="brand-sub">Weekly Intel Briefing</span></div>
    <div class="masthead-meta mono">${escapeHtml(datePart)} · ${escapeHtml(timePart)} UTC · universe ${input.runMeta.gatesPassedCount} · profile ${escapeHtml(input.runMeta.profileArg)}</div>
  </div>
  <div class="weather">
    <div class="weather-row">
      ${renderWeatherItem("SPY", `<span class="${spyClass}">${spyLabel}</span>`, escapeHtml(slopeLabel))}${div}
      ${renderWeatherItem("VIX", fmt(r.vixCurrent), escapeHtml(vixVsAvg))}${div}
      ${renderWeatherItem("领涨", leading ? `<span class="up">${escapeHtml(leading.sector)}</span>` : "不可得")}${div}
      ${renderWeatherItem("领跌", lagging ? `<span class="down">${escapeHtml(lagging.sector)}</span>` : "不可得")}${div}
      ${renderWeatherItem("市场宽度", `<span class="${breadthClass}">${breadthText}</span>`, b.pctAboveSma200 === null ? "" : `· ${b.pctAboveSma200.toFixed(0)}% 站上200线`)}${div}
      ${renderWeatherItem("52周新高/新低", `<span class="mono">${b.newHighCount} / ${b.newLowCount}</span>`, b.pctAboveSma50 === null ? "" : `· ${b.pctAboveSma50.toFixed(0)}% 站上50线`)}${div}
      ${recapLink}
      <div class="weather-links" data-noprint><a href="#evidence">证据层 ↓</a><a href="#tier1">候选 ↑</a></div>
    </div>
  </div>
</header>`;
}

/**
 * TASK_CARD_08 熔断: "FRED序列取数失败时降级为unknown态并正常运行(不阻塞),
 * 但报告需标注信用数据不可得" - so an `unknown` regime still needs a visible
 * (muted, non-alarming) note even though it triggers none of the tight-state
 * behavior. Renders nothing for loose/neutral.
 */
function renderCreditWarning(input: ReportInput): string {
  const cr = input.creditRegime;
  if (cr.label === "tight") {
    const disabledNote = input.smallSpecForcedDisabled
      ? "SMALL_SPEC 档本次运行已强制禁用 · 全部候选风险等级已上调一级"
      : "全部候选风险等级已上调一级";
    return `
<div class="credit-warning-bar">
  <span class="credit-warning-label">⚠ 信用环境收紧</span>
  <span class="credit-warning-detail">OAS=${fmt(cr.oasCurrentBp)}bp(两周前=${fmt(cr.oasPastBp)}bp, 变动=${fmt(cr.oasChangeBp)}bp) · ${escapeHtml(disabledNote)}</span>
</div>`;
  }
  if (cr.label === "unknown") {
    return `
<div class="credit-unknown-note">信用环境: 不可得${cr.labelUnavailableReason ? ` (${escapeHtml(cr.labelUnavailableReason)})` : ""}</div>`;
  }
  return "";
}

/**
 * TASK_CARD_08 Part C item 3 / 修正案十八: two co-occurring, measured facts
 * ("指数强但内部弱,个股突破可靠性下降"). The amendment's "严禁据此预测大盘
 * 走向" is why no wording here says or implies what happens next.
 */
function renderBreadthDivergenceWarning(input: ReportInput): string {
  const b = input.breadth;
  if (!b.breadthDivergence) return "";
  return `
<div class="breadth-warning-bar">
  <span class="breadth-warning-label">⚠ 宽度背离</span>
  <span class="breadth-warning-detail">指数处于200线上方,但仅 ${b.pctAboveSma200 === null ? "不可得" : `${b.pctAboveSma200.toFixed(1)}%`} 的标的站上自身200日均线(52周新高 ${b.newHighCount} / 新低 ${b.newLowCount}) · 个股突破可靠性下降</span>
</div>`;
}

/* ======================= tier 1 · 值得研究 ======================= */

function renderBucketLegend(input: ReportInput): string {
  const items = BUCKETS.map((b) => {
    const count = input.runMeta.detectorSummary[b.id]?.triggeredCount ?? 0;
    const zero = count === 0;
    return `<span class="bl-item${zero ? " zero" : ""}"><span class="dot${zero ? " zero" : ""}" style="${zero ? "" : `background:var(${b.colorVar})`}"></span>${escapeHtml(b.label)} · ${count}次</span>`;
  }).join("");
  const zeroHit = zeroHitBucketIds(input.runMeta.detectorSummary);
  const note = zeroHit.length > 0 ? `<span class="bl-note">零命中: ${zeroHit.map((id) => BUCKET_BY_ID.get(id)?.label ?? id).join("、")}</span>` : `<span class="bl-note">五桶本轮均有命中</span>`;
  return `<div class="bucket-legend">${items}${note}</div>`;
}

function formatConditionValue(c: FootprintCondition): string {
  const actual = c.actual === null ? "不可得" : String(c.actual);
  return `${c.field}: ${actual} vs ${c.threshold}`;
}

function renderConditionRow(c: FootprintCondition): string {
  const sym = c.status === "hit" ? "✓" : c.status === "miss" ? "✗" : "—";
  return `<div class="cand-cond-row">
  <span class="sym ${c.status}">${sym}</span>
  <span class="label">${escapeHtml(c.label)}</span>
  <span class="fmv mono" title="${escapeHtml(formatConditionValue(c))}">${escapeHtml(formatConditionValue(c))}</span>
  <span class="state3">${escapeHtml(c.availability)}</span>
</div>`;
}

/** TASK_CARD_09 Part B / 修正案十六: 严格隔离 - visually separated, explicit "仅供参考,严禁筛选依据" disclaimer, never any directional/counterparty wording. */
function renderOptionsIntelligenceRow(o: HtmlReportCandidateInput["optionsIntelligence"]): string {
  if (o.availability === "不可得") {
    return `<div class="cand-latent-row cand-options-row"><div class="cand-latent-title">期权情报(仅供研究层参考,严禁作为筛选依据): 不可得</div></div>`;
  }
  return `
<div class="cand-latent-row cand-options-row">
  <div class="cand-latent-title">期权情报(汇总数据·无方向·无交易主体,仅供研究层参考,严禁作为筛选依据)</div>
  <div class="cand-latent-items">
    <span>量比/OI峰值: ${fmt(o.volumeOiRatioMax)}${o.volumeOiRatioAnomaly ? " [活动异常]" : ""}</span>
    <span>近月价外看涨OI: ${fmt(o.nearOtmCallOi)}(较上次运行: ${fmt(o.nearOtmCallOiChange)})</span>
    <span>看跌看涨比: ${fmt(o.putCallRatio, 2)}(较上次运行: ${fmt(o.putCallRatioChange, 2)})</span>
    <span>平值隐含波动率: ${fmt(o.atmImpliedVol, 3)}(较近期运行均值: ${fmt(o.ivMove, 3)})</span>
  </div>
</div>`;
}

/** TASK_CARD_09 Part A / 修正案十五: strength-bonus-only flags, never a bucket admission condition - kept apart from the condition table above them, which IS admission evidence. */
function triState(v: boolean | null): string {
  return v === null ? "不可得" : v ? "是" : "否";
}
function renderLatentAccumulationRow(f: IndicatorFlags): string {
  return `
<div class="cand-latent-row">
  <div class="cand-latent-title">隐性吸筹复合信号(强度加分项,不参与桶准入判定)</div>
  <div class="cand-latent-items">
    <span>RS线创52周新高: ${triState(f.rsLineNewHigh)}</span>
    <span>成交量极度干涸: ${triState(f.volumeDryup)}</span>
    <span>均价位置持续偏上(日线近似VWAP,非真实分钟级): ${triState(f.aboveVwapStreak)}</span>
    <span>内部人加权分: ${f.insiderClusterWeightedScore === null ? "不可得" : f.insiderClusterWeightedScore.toFixed(1)}</span>
  </div>
</div>`;
}

/**
 * One candidate, listed once. Right-hand readout: the deterministic footprint
 * strength first (the v2 draft's chosen primary readout), then Radar's
 * grade/probability/confidence once a brief has been saved - a placeholder
 * until then, never a computed stand-in. The condition evidence sits in a
 * native <details>, open on the strongest (first) card only.
 */
function renderCandidate(c: HtmlReportCandidateInput, index: number, verdict: RadarCandidateVerdict | undefined): string {
  const f = c.flags;
  const cls = strengthClass(c.footprintStrength.band);
  const pct = c.footprintStrength.ratio === null ? 0 : c.footprintStrength.ratio * 100;

  const bucketTag = `<span class="bucket-tag">${c.allBucketsHit.map(bucketDot).join("")}${c.allBucketsHit.map((id) => escapeHtml(BUCKET_BY_ID.get(id)?.label ?? id)).join(" + ")}</span>`;
  const metaParts = [
    bucketTag,
    c.sectorRank ? escapeHtml(c.sectorRank.sector) : "",
    c.eventWindow && c.eventWindow.length > 0 ? `⚡ ${escapeHtml(c.eventWindow[0].type)} <span class="mono">${escapeHtml(c.eventWindow[0].date)}</span>` : "",
    c.promoted ? `<span class="up">↑ 观察哨升级而来</span>` : "",
    c.speculative ? `<span class="tier-warn">SMALL_SPEC</span>` : "",
    c.riskLevel !== "normal" ? `<span class="tier-warn">风险等级: ${RISK_LABEL[c.riskLevel]}</span>` : "",
    c.fundamentals?.accrualFlag === true ? `<span class="tier-warn">应计质量存疑</span>` : "",
    c.fundamentals?.dilutionRisk === true ? `<span class="tier-warn">稀释风险(现金跑道${fmt(c.fundamentals.cashRunwayMonths, 1)}个月)</span>` : "",
    c.contagion?.highBetaSatellite === true ? `<span class="tier-warn-red">⚠ 高波动卫星标的(修正案二十:不因此排除,但须加倍审视)</span>` : "",
    // TASK_CARD_09_STANDBY items 5-6 / 修正案十八: structural markers on
    // momentum-bucket hits. Flags only - they never changed admission.
    c.rangeBoundWarning ? `<span class="tier-warn">⚠ 趋势强度不足(ADX ${fmt(c.flags.adx14, 1)},可能是震荡区间上沿)</span>` : "",
    // A run saved before that card has no entryStructure key at all
    // (undefined, not null) - checks the resolved label, so an unknown
    // structure renders nothing rather than a broken badge.
    c.allBucketsHit.includes("momentum_breakout") && c.flags.entryStructure && ENTRY_STRUCTURE_LABEL[c.flags.entryStructure]
      ? `<span class="entry-structure">${escapeHtml(ENTRY_STRUCTURE_LABEL[c.flags.entryStructure!])}</span>`
      : "",
  ].filter(Boolean);

  const contagionRow = c.contagion
    ? (() => {
        const ct = c.contagion!;
        const ownMove = ct.leaderMovePct - ct.lagGapPct;
        return `<div class="cand-contagion-row">板块传导: 龙头 <b>${escapeHtml(ct.leaderTicker)}</b> 涨 ${fmtPct(ct.leaderMovePct, 1)} → 本标的仅涨 ${fmtPct(ownMove, 1)},滞后 <b>${fmtPct(ct.lagGapPct, 1)}</b>(板块事件日期: ${escapeHtml(ct.sectorEventDate)})</div>`;
      })()
    : "";

  const hasVerdict = verdict?.grade !== undefined || verdict?.probability !== undefined || verdict?.confidence !== undefined;
  const ratingHtml = hasVerdict
    ? `<span class="cand-verdict">${escapeHtml(verdict!.grade ?? "不可得")} · 概率 ${fmt(verdict!.probability, 0)} · 确信度 ${fmt(verdict!.confidence, 0)}</span>`
    : `<span class="placeholder">${PLACEHOLDER}</span>`;
  const hitCount = c.footprintDetail.filter((d) => d.status === "hit").length;

  return `
<article class="cand" id="cand-${escapeHtml(c.symbol)}" data-strength="${cls.replace("strength-", "")}">
  <div class="cand-top">
    <div class="cand-id">
      <span class="cand-rank">${String(index + 1).padStart(2, "0")}</span>
      <span class="ticker">${escapeHtml(c.symbol)}</span>
      <span class="company">${escapeHtml(c.securityName)}</span>
    </div>
    <div class="cand-readout">
      <div class="cand-strength">
        <span class="ro-label">足迹强度</span>
        <span class="band ${cls}">${escapeHtml(c.footprintStrength.band)}</span>
        ${c.footprintStrength.ratio !== null ? `<div class="cand-strength-bar"><i style="width:${pct.toFixed(0)}%;background:${strengthColorVar(c.footprintStrength.band)}"></i></div><div class="frac">${c.footprintStrength.hitCount}/${c.footprintStrength.availableCount} 项命中</div>` : `<div class="frac">强度不可得</div>`}
      </div>
      <div class="cand-rating"><span class="ro-label">评级 · 研究层</span>${ratingHtml}</div>
    </div>
  </div>
  <div class="cand-meta">${metaParts.join(`<span class="sep">·</span>`)}</div>
  ${contagionRow}
  <div class="cand-body">
    <div class="cand-technicals">
      <div class="tech-item"><span class="tech-label">RSI14</span><span class="tech-value">${fmt(f.rsi14, 1)} ${rsiLabel(f.rsi14)}</span></div>
      <div class="tech-item"><span class="tech-label">52周位置</span><span class="tech-value">${week52PositionLabel(f.week52PositionPct)}</span></div>
      <div class="tech-item"><span class="tech-label">均线</span><span class="tech-value">${smaAlignmentLabel(f.smaAlignedBullish)}</span></div>
      <div class="tech-item"><span class="tech-label">BB带宽百分位</span><span class="tech-value">${bbPercentileLabel(f.bbWidthPercentile120)}</span></div>
      <div class="tech-item"><span class="tech-label">量比</span><span class="tech-value">${volumeRatioLabel(f.volumeRatioLatest)}</span></div>
      <div class="tech-item"><span class="tech-label">机构持股</span><span class="tech-value">${institutionalTrendLabel(f.institutionalTrend)}</span></div>
    </div>
    <div class="cand-spark">${renderSparklineSvg(c.closes90d, 150, 48)}<div class="spark-caption">90日走势</div></div>
  </div>
  ${verdict?.descText ? `<p class="cand-desc">${escapeHtml(verdict.descText)}</p>` : `<p class="cand-desc pending">${PLACEHOLDER}</p>`}
  <details class="cand-detail" id="detail-${escapeHtml(c.symbol)}"${index === 0 ? " open" : ""}>
    <summary>构成足迹的条件 · ${hitCount} 项命中 / ${c.footprintDetail.length} 项检查</summary>
    <div class="cand-detail-body">
      ${c.footprintDetail.map(renderConditionRow).join("")}
      <div class="cand-detail-foot">不可得项不参与强度计分,也不计入分母。每一条均可在本次 run 的 screen_run.json 中按 symbol 溯源。</div>
      ${renderLatentAccumulationRow(f)}
      ${renderOptionsIntelligenceRow(c.optionsIntelligence)}
    </div>
  </details>
</article>`;
}

/**
 * TASK_CARD_09_STANDBY item 7 / 修正案十九: the counted fact and nothing
 * else - no sizing verb may ever appear here.
 */
function renderConcentrationBlock(input: ReportInput): string {
  if (input.concentrationWarnings.length === 0) return "";
  const rows = input.concentrationWarnings
    .map((w) => `<div class="concentration-row"><b>${escapeHtml(w.sector)}</b>: ${w.count} 只 — ${w.symbols.map(escapeHtml).join("、")}</div>`)
    .join("");
  return `
<div class="concentration-note">
  <div class="concentration-title">候选集中度(仅陈述事实)</div>
  ${rows}
</div>`;
}

function renderTier1(input: ReportInput): string {
  const n = input.candidates.length;
  if (n === 0) {
    return `
<section class="tier1" id="tier1">
  <div class="tier-head">
    <div class="tier-label research">第一层 · 值得研究</div>
    <div class="tier-title">本周 0 只进入研究层</div>
  </div>
  ${renderBucketLegend(input)}
  <div class="tier-empty empty-state">本轮没有标的完整触发任一检测桶的全部条件 - 这是真实市场状态的诚实输出,不是系统故障。第一层候选为空,观察哨见下。</div>
</section>`;
  }
  const sub = [
    `宇宙规模 ${input.runMeta.gatesPassedCount} 只`,
    `五桶本轮共命中 ${totalBucketHits(input.runMeta.detectorSummary)} 次`,
    `候选 ${n} · 观察哨 ${input.watchlist.length}`,
  ].join(" · ");
  const cards = input.candidates.map((c, i) => renderCandidate(c, i, input.radarNarrative?.candidateVerdicts?.[c.symbol])).join("");
  return `
<section class="tier1" id="tier1">
  <div class="tier-head">
    <div class="tier-label research">第一层 · 值得研究</div>
    <div class="tier-title">本周 ${n} 只进入研究层,按足迹强度排序</div>
    <div class="tier-sub">${escapeHtml(sub)}</div>
  </div>
  ${renderBucketLegend(input)}
  <div class="cand-list">${cards}</div>
  ${renderConcentrationBlock(input)}
</section>`;
}

/* ======================= tier 2 · 观察哨 ======================= */

function renderWatchRow(w: HtmlWatchlistInput, promoted: boolean): string {
  const reasonLabel = w.reason === "contagion_unselected" ? "板块传导(未入选候选)" : w.reason === "compression_unselected" ? "波动挤压蓄势(未入选候选)" : "临界未达标";
  const reasonBucket = w.reason === "contagion_unselected" ? "sector_contagion" : w.reason === "compression_unselected" ? "volatility_compression_setup" : "";
  const strengthText = w.footprintStrength.ratio === null ? "不可得" : `${escapeHtml(w.footprintStrength.band)} · ${w.footprintStrength.hitCount}/${w.footprintStrength.availableCount}`;
  return `<div class="wt-row">
  <span class="wt-ticker">${escapeHtml(w.symbol)}</span>
  <span>${reasonBucket ? bucketDot(reasonBucket) : ""}</span>
  <span class="wt-name">${escapeHtml(reasonLabel)} · ${escapeHtml(w.securityName)}${promoted ? ` <span class="up">▲已升级</span>` : ""}</span>
  <span class="wt-strength">${strengthText}</span>
</div>`;
}

function renderTier2(input: ReportInput): string {
  if (input.watchlist.length === 0) {
    return `
<section class="tier2" id="tier2">
  <div class="tier-head"><div class="tier-label watch">第二层 · 观察哨</div></div>
  <div class="tier-empty empty-state">本次运行观察哨为空。</div>
</section>`;
  }
  const rows = input.watchlist.map((w) => renderWatchRow(w, input.promotedThisRun.includes(w.symbol))).join("");
  const promotedNote = input.promotedThisRun.length > 0 ? `<div class="watch-promo-note">本轮从观察哨升格为候选: ${input.promotedThisRun.map(escapeHtml).join(", ")},不再重复列于下表。</div>` : "";
  return `
<section class="tier2" id="tier2">
  <div class="tier-head">
    <div class="tier-label watch">第二层 · 观察哨</div>
    <div class="tier-sub">${input.watchlist.length} 只 · 苗头达成后下次运行自动升入第一层</div>
  </div>
  <div class="wt-row wt-head"><span>ticker</span><span></span><span>说明</span><span class="wt-strength">足迹强度</span></div>
  ${rows}
  ${promotedNote}
</section>`;
}

/* ======================= evidence ======================= */

function renderEvidenceNav(): string {
  return `
<nav class="evidence-nav" id="evidence">
  <span class="evidence-eyebrow">证据与背景</span>
  <span class="evidence-links" data-noprint><a href="#recap">大盘复盘</a><a href="#sector-flow">板块资金流</a><a href="#hot-sectors">热门领域</a><a href="#theme-radar">主题雷达</a><a href="#exclusions">排除项</a><a href="#summary-outlook">总结与前瞻</a><a href="#ledger">账本</a><a href="#tier1">↑ 返回候选</a></span>
</nav>`;
}

function blockHead(eyebrow: string, note = ""): string {
  return `<div class="section-title-row"><div class="section-eyebrow">${eyebrow}</div>${note ? `<div class="section-note">${note}</div>` : ""}</div>`;
}

function renderRecap(input: ReportInput): string {
  return `
<section class="block" id="recap">
  ${blockHead("大盘复盘", "研究层撰写 · 每句须锚定上方天气条或可查证数据")}
  <div class="panel simple-panel">${radarText(input.radarNarrative?.marketRecapParagraph, "prose")}</div>
</section>`;
}

function renderSectorFlow(input: ReportInput): string {
  const anomalySet = new Set(input.sectorFootprints.filter((f) => f.footprintAnomaly).map((f) => f.sector));
  const sorted = [...input.sectorFlowScan].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
  const maxDensity = Math.max(0, ...sorted.map((f) => f.squeezeDensity ?? 0));
  const rows = sorted
    .map((f: SectorFlowEntry) => {
      const isAnomaly = anomalySet.has(f.sector);
      const barPct = f.squeezeDensity === null || maxDensity === 0 ? 0 : (f.squeezeDensity / maxDensity) * 100;
      return `<div class="sf-row${isAnomaly ? " anomaly" : ""}" data-rank="${f.rank ?? 99}" data-return="${f.weeklyReturn ?? ""}" data-density="${f.squeezeDensity ?? ""}"><span class="sf-rank">${f.rank ?? "-"}</span><span class="sf-sector">${escapeHtml(f.sector)}${isAnomaly ? ` <span class="sf-star">★ 足迹异动</span>` : ""}</span><span class="sf-chg ${pctClass(f.weeklyReturn)}">${fmtPct(f.weeklyReturn, 1)}</span><span class="sf-sq"><span class="sf-sq-val">${fmtPct(f.squeezeDensity, 1)}</span><span class="sf-sq-bar"><i style="width:${barPct.toFixed(0)}%"></i></span></span><span class="sf-flow ${FLOW_CLASS[f.flowState]}">${FLOW_LABEL[f.flowState]}</span></div>`;
    })
    .join("");
  return `
<section class="block" id="sector-flow">
  ${blockHead("全板块资金流谱", `${sorted.length} 个板块 · 按 rank 排列 · 排名与涨跌来自板块 ETF,密度来自全宇宙检测`)}
  <div class="panel">
    <div class="sf-row sf-head"><span data-sort-key="rank">#</span><span>板块</span><span style="text-align:right" data-sort-key="return">周涨跌</span><span data-sort-key="density">挤压密度</span><span style="text-align:right">资金流向</span></div>
    <div id="sectorRows">${rows}</div>
    <div class="sf-summary">${radarText(input.radarNarrative?.sectorFlowSummaryLine, "prose", `本区总结${PLACEHOLDER}`)}</div>
  </div>
</section>`;
}

function renderHotSector(h: HotSectorEntry, verdictText: string | undefined): string {
  const rankData = h.kind === "sector" && h.sectorFlowRef ? `板块 rank ${h.sectorFlowRef.rank ?? "n/a"}/11` : `细分主题(篮子近似)`;
  const coverage = h.basketCoverage ? `<div class="hs-coverage">篮子覆盖: ${h.basketCoverage.found}/${h.basketCoverage.total} 成分股在本次筛选宇宙内 - 手工近似,非官方板块分类</div>` : "";
  const pool =
    h.candidatesInPool.length > 0 || h.watchlistInPool.length > 0
      ? `<div class="hs-members">${h.candidatesInPool.length > 0 ? `<span class="accent-mark">◆</span> 进候选池: <span class="mono">${h.candidatesInPool.map(escapeHtml).join(", ")}</span>` : ""}${h.candidatesInPool.length > 0 && h.watchlistInPool.length > 0 ? " · " : ""}${h.watchlistInPool.length > 0 ? `进观察哨: <span class="mono">${h.watchlistInPool.map(escapeHtml).join(", ")}</span>` : ""}</div>`
      : `<div class="hs-members muted">○ 无候选 · 无观察哨</div>`;
  return `
<div class="hs-row">
  <div class="hs-name">${escapeHtml(h.name)}<span class="hs-rank">${rankData}</span></div>
  <div class="hs-stats"><span class="${pctClass(h.weeklyReturn)}">${fmtPct(h.weeklyReturn, 1)}</span> · 挤压密度 ${fmtPct(h.squeezeDensity, 1)} · <span class="sf-flow ${FLOW_CLASS[h.flowState]}">${FLOW_LABEL[h.flowState]}</span></div>
  ${radarText(verdictText, "hs-verdict")}
  ${coverage}
  ${pool}
</div>`;
}

function renderHotSectors(input: ReportInput): string {
  const body =
    input.hotSectorDetail.length === 0
      ? `<div class="simple-panel empty-state">本次运行无热门领域数据。</div>`
      : input.hotSectorDetail.map((h) => renderHotSector(h, input.radarNarrative?.hotSectorVerdicts?.[h.name])).join("");
  return `
<section class="block" id="hot-sectors">
  ${blockHead("热门领域详述", "你点名的 + 本周异动")}
  <div class="panel">${body}</div>
</section>`;
}

/** claude_code_design_draft.md §2 layer 04: traceable arithmetic only -
 * cross-sector squeeze-density median, the anomaly's multiple of it, and how
 * many candidates the sector contributed. */
function squeezeDensityMedian(scan: SectorFlowEntry[]): number | null {
  const values = scan.map((f) => f.squeezeDensity).filter((v): v is number => v !== null).sort((a, b) => a - b);
  if (values.length === 0) return null;
  const mid = Math.floor(values.length / 2);
  return values.length % 2 === 0 ? (values[mid - 1] + values[mid]) / 2 : values[mid];
}

function renderRadarTheme(t: RadarThemeInput): string {
  const strengthCls = t.strengthLabel === "强" ? "strength-strong" : t.strengthLabel === "弱" ? "strength-weak" : "strength-mid";
  const caveat = STAGE_CAVEAT[t.lifecycleStage];
  const watchpoints =
    t.falsifiableWatchpoints && t.falsifiableWatchpoints.length > 0
      ? `<div class="theme-watchpoints">可证伪观察点: ${t.falsifiableWatchpoints.map(escapeHtml).join(" / ")}</div>`
      : "";
  return `
<div class="theme-card">
  <div class="theme-tag">◆ THEME · 足迹拼图,非预言</div>
  <div class="theme-name">${escapeHtml(t.name)}<span class="theme-strength ${strengthCls}">${escapeHtml(t.strengthLabel)} · ${escapeHtml(t.lifecycleStage)}${caveat ? ` · ${caveat}` : ""}</span></div>
  <div class="theme-footprint">${t.footprints.map((f) => `<span>▲ ${escapeHtml(f)}</span>`).join("")}</div>
  ${t.members.length > 0 ? `<div class="theme-members">集群成员 ${t.members.map((m) => `<span class="mono">${escapeHtml(m)}</span>`).join(" ")}</div>` : ""}
  <p class="theme-verdict">${escapeHtml(t.verdictText)}</p>
  ${watchpoints}
</div>`;
}

function renderZeroHitNote(input: ReportInput): string {
  const zeroHit = zeroHitBucketIds(input.runMeta.detectorSummary);
  if (zeroHit.length === 0) return "";
  const labels = zeroHit.map((id) => BUCKET_BY_ID.get(id)?.label ?? id).join("、");
  return `<div class="zero-hit-note">◆ 零命中桶说明: 本轮 <b>${escapeHtml(labels)}</b> 无标的触发全部条件。这反映的是本轮真实市场状态(该类设置本周确实罕见),而非系统故障 - 见第一层桶图例的空心圆点。</div>`;
}

function renderThemeRadar(input: ReportInput): string {
  const themes = input.radarNarrative?.emergingThemes ?? [];
  let body: string;
  if (themes.length > 0) {
    body = themes.map(renderRadarTheme).join("");
  } else {
    const anomalies = input.sectorFootprints.filter((f) => f.footprintAnomaly);
    if (anomalies.length === 0) {
      body = `<div class="simple-panel empty-state">本次运行无板块异动,无主题雏形可报,不强行凑数。</div>`;
    } else {
      const median = squeezeDensityMedian(input.sectorFlowScan);
      body = anomalies
        .map((a) => {
          const contributed = input.candidates.filter((c) => c.sectorRank?.sector === a.sector).map((c) => c.symbol);
          const dims = a.anomalyDimensions
            .map((dim) => {
              const d = a.densities[dim];
              const multiple = median !== null && median > 0 && d.density !== null ? d.density / median : null;
              const bar = d.density !== null ? `<div class="footprint-bar"><i style="width:${Math.min(100, d.density * 100 * 2).toFixed(0)}%"></i></div>` : "";
              return `<span>▲ ${escapeHtml(dim)} 密度 <b>${d.density !== null ? (d.density * 100).toFixed(1) : "不可得"}%</b>(${d.count}只/${a.validSymbolCount}只)${multiple !== null ? ` · 为全场中位数(${(median! * 100).toFixed(1)}%)的 <b>${multiple.toFixed(1)}×</b>` : ""}</span>${bar}`;
            })
            .join("");
          return `
<div class="theme-card">
  <div class="theme-tag">◆ 潜在主题雏形 · 基于板块异动数据自动生成,尚未经研究层确认叙事与生命周期定位</div>
  <div class="theme-name">${escapeHtml(a.sector)}<span class="theme-strength muted">强度/阶段待研究层判定</span></div>
  <div class="theme-footprint">${dims}<span>贡献候选: ${contributed.length > 0 ? contributed.map(escapeHtml).join(", ") : "0只"}</span></div>
  <p class="theme-verdict placeholder">${PLACEHOLDER}</p>
</div>`;
        })
        .join("");
    }
  }
  return `
<section class="block" id="theme-radar">
  ${blockHead("萌芽主题雷达", "主题必须被数据发现,不得被模型发明")}
  <div class="panel">${body}${renderZeroHitNote(input)}</div>
</section>`;
}

function renderExclusions(input: ReportInput): string {
  const notes = input.radarNarrative?.excludedNotes ?? [];
  const body =
    notes.length === 0
      ? `<p class="placeholder">${PLACEHOLDER}(排除项判定需要研究层的实时信息核实,应用层无法自行判定)</p>`
      : notes.map((n) => `<p class="excluded-note"><b>${n.symbols.length}只已排除</b> - <span class="mono">${n.symbols.map(escapeHtml).join(" · ")}</span>: ${escapeHtml(n.reason)}</p>`).join("");
  return `
<section class="block" id="exclusions">
  ${blockHead("排除项说明")}
  <div class="panel simple-panel">${body}</div>
</section>`;
}

function renderSummary(input: ReportInput): string {
  return `
<section class="block" id="summary-outlook">
  ${blockHead("本周总结与前瞻", "长白话总结 · 下周关注点须具体、可观察、可证伪")}
  <div class="panel simple-panel">
    ${radarText(input.radarNarrative?.weeklyForecast, "prose")}
    <div class="disclaimer">每句均应锚定真实足迹或可查证的板块/价格数据,无无支撑预言。"这周没动"是诚实的合法输出;"值得注意"≠"建议买入",介入、仓位、执行属于你的领地。</div>
  </div>
</section>`;
}

function renderLedger(input: ReportInput): string {
  const pending = input.ledgerPendingBackfill;
  const invalidated = input.ledgerInvalidated;
  const unknown = "不可得(本报告为重渲染版,未重算账本状态)";
  const pendingText = pending === null ? unknown : pending.length === 0 ? "0 条" : `${pending.length} 条 - ${pending.map((e) => escapeHtml(e.symbol)).join(", ")}`;
  const invalidatedText = invalidated === null ? unknown : invalidated.length === 0 ? "0 条" : `${invalidated.length} 条 - ${invalidated.map((e) => escapeHtml(e.screening.symbol)).join(", ")}`;
  return `
<section class="block" id="ledger">
  ${blockHead("前向账本", "只读列表,回填在 Stockpit 的 Outcomes")}
  <div class="panel simple-panel">
    <div class="ledger-line"><span class="l-label">已到期待回填</span><span>${pendingText}</span></div>
    <div class="ledger-line"><span class="l-label">已触发无效化</span><span>${invalidatedText}</span></div>
  </div>
</section>`;
}

/** Progressive enhancement only: turns the sector table's header cells into
 * sort controls when scripts run (a local browser). Inside Stockpit's
 * sandboxed iframe it never runs and the table is simply ranked - nothing
 * on the page depends on it. No framework, no animation, no storage. */
const SORT_SCRIPT = `
document.addEventListener('DOMContentLoaded', function () {
  var rows = document.getElementById('sectorRows');
  if (!rows) return;
  var state = { key: 'rank', dir: 1 };
  document.querySelectorAll('[data-sort-key]').forEach(function (cell) {
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'sort-btn'; btn.textContent = cell.textContent;
    btn.setAttribute('data-active', cell.getAttribute('data-sort-key') === 'rank' ? 'true' : 'false');
    cell.textContent = ''; cell.appendChild(btn);
    btn.addEventListener('click', function () {
      var key = cell.getAttribute('data-sort-key');
      state.dir = state.key === key ? state.dir * -1 : 1; state.key = key;
      var attr = 'data-' + key;
      Array.prototype.slice.call(rows.children).sort(function (a, b) {
        var av = parseFloat(a.getAttribute(attr)), bv = parseFloat(b.getAttribute(attr));
        if (isNaN(av)) av = key === 'rank' ? 999 : -Infinity;
        if (isNaN(bv)) bv = key === 'rank' ? 999 : -Infinity;
        return (av - bv) * state.dir;
      }).forEach(function (r) { rows.appendChild(r); });
      document.querySelectorAll('.sort-btn').forEach(function (b) { b.setAttribute('data-active', b === btn ? 'true' : 'false'); });
    });
  });
});
`;

/**
 * Weekly Intel Briefing, "triage-first" layout (design-demos/triage-first.html,
 * project owner's pick 2026-10-17): sticky weather strip -> tier 1 (every
 * candidate once, footprint strength + Radar rating as the readout) -> tier 2
 * -> one evidence column (大盘复盘, 全板块资金流谱, 热门领域, 主题雷达, 排除项,
 * 总结与前瞻, 账本). Every prose slot is Radar-authored (radarNarrative) or a
 * literal 待研究层填充 placeholder. The only fixed wording that characterises
 * anything is what the constitution prescribes for a deterministic flag
 * (修正案十八's breadth-divergence and range-bound warnings, 修正案二十二's
 * high-beta satellite warning, 修正案十一's 追高风险区/退潮 stage caveats) and
 * the zero-hit note and the 0-candidate empty state from the owner's v2 draft
 * (both say an empty result is the real market state, not a fault) - no market, sector or stock
 * judgment is generated here.
 */
export function renderReport(input: ReportInput): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ATLAS Weekly Intel Briefing - ${escapeHtml(input.runMeta.timestamp)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>${REPORT_STYLES}</style>
</head>
<body data-project="atlas">
${renderHeader(input)}
${renderCreditWarning(input)}
${renderBreadthDivergenceWarning(input)}
<main class="wrap">
${renderTier1(input)}
${renderTier2(input)}
${renderEvidenceNav()}
${renderRecap(input)}
${renderSectorFlow(input)}
${renderHotSectors(input)}
${renderThemeRadar(input)}
${renderExclusions(input)}
${renderSummary(input)}
${renderLedger(input)}
<footer class="fingerprint">ATLAS · Layer 1 情报简报 · profile ${escapeHtml(input.runMeta.profileArg)} · gatesPassedCount ${input.runMeta.gatesPassedCount} · ${escapeHtml(input.runMeta.timestamp)}</footer>
</main>
<script>${SORT_SCRIPT}</script>
</body>
</html>`;
}
