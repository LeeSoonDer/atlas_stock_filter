import { escapeHtml } from "./escapeHtml.js";
import { renderSparklineSvg } from "./sparkline.js";
import { REPORT_STYLES } from "./styles.js";
import { bbPercentileLabel, institutionalTrendLabel, rsiLabel, smaAlignmentLabel, volumeRatioLabel, week52PositionLabel } from "./semanticLabels.js";
import type { HotSectorEntry, SectorFlowEntry } from "../../screen/sector_scan/types.js";
import type { FootprintCondition } from "../../screen/detectors/IDetector.js";
import type { IndicatorFlags } from "../../screen/indicators/types.js";
import type { HtmlReportCandidateInput, HtmlWatchlistInput, ReportInput } from "./types.js";

const PLACEHOLDER = "待研究层填充";
const FLOW_LABEL: Record<string, string> = { flow_in: "流入", flow_out: "流出", flat: "横盘", unknown: "不可得" };
const FLOW_CLASS: Record<string, string> = { flow_in: "in", flow_out: "out", flat: "flat", unknown: "flat" };

/** BUCKET_ORDER's own 4 canonical ids, duplicated as a literal tuple here
 * rather than imported from src/screen/select/types.ts - that module pulls
 * in nearMiss.ts's detector-config types, and the report layer should stay
 * a one-way dependency (screen -> report), never the reverse. */
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
function placeholderP(text: string | undefined, fallback = PLACEHOLDER): string {
  return text ? `<p>${escapeHtml(text)}</p>` : `<p class="placeholder">${escapeHtml(fallback)}</p>`;
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

function stratumHead(no: string, name: string, metaHtml: string): string {
  return `<div class="stratum-head"><span class="stratum-no mono">${no}</span><span class="stratum-name">${name}</span><span class="stratum-rule"></span><span class="stratum-meta">${metaHtml}</span></div>`;
}

function renderMasthead(input: ReportInput): string {
  const [datePart, timePartFull] = input.runMeta.timestamp.split("T");
  const timePart = timePartFull ? timePartFull.slice(0, 5) : "n/a";
  return `
<div class="masthead">
  <div class="brand">ATLAS<span>·</span>RADAR</div>
  <div class="meta">WEEKLY INTEL BRIEFING<br><b>${escapeHtml(datePart)}</b> · ${escapeHtml(timePart)} UTC · universe <b>${input.runMeta.gatesPassedCount}</b></div>
</div>`;
}

const RISK_LABEL: Record<string, string> = { normal: "正常", elevated: "偏高", high: "高" };

/**
 * TASK_CARD_08 熔断: "FRED序列取数失败时降级为unknown态并正常运行(不阻塞),
 * 但报告需标注信用数据不可得" - so an `unknown` regime still needs a visible
 * (muted, non-alarming) note even though it triggers none of the tight-state
 * behavior. Renders nothing for loose/neutral - a normal run's markup is
 * unaffected either way.
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

function totalBucketHits(detectorSummary: Record<string, { triggeredCount: number }>): number {
  return Object.values(detectorSummary).reduce((a, v) => a + v.triggeredCount, 0);
}
function zeroHitBucketIds(detectorSummary: Record<string, { triggeredCount: number }>): string[] {
  return BUCKETS.filter((b) => (detectorSummary[b.id]?.triggeredCount ?? 0) === 0).map((b) => b.id);
}

/** ===== 01 · 值得研究 ===== */
function render01(input: ReportInput): string {
  const n = input.candidates.length;
  const zeroHit = zeroHitBucketIds(input.runMeta.detectorSummary);
  const title = n === 0 ? "本周 0 只进入研究层" : `本周 ${n} 只进入研究层,按足迹强度排序`;
  const subParts = [
    `宇宙规模 ${input.runMeta.gatesPassedCount} 只`,
    `四桶本轮共命中 ${totalBucketHits(input.runMeta.detectorSummary)} 次`,
    `候选 ${input.candidates.length} · 观察哨 ${input.watchlist.length}`,
    zeroHit.length > 0 ? `零命中: ${zeroHit.map((id) => BUCKET_BY_ID.get(id)?.label ?? id).join("、")}` : "四桶本轮均有命中",
  ];
  const sub = n === 0 ? "本轮没有标的完整触发任一检测桶的全部条件 - 这是真实市场状态的诚实输出,不是系统故障。" : subParts.join(" · ");

  const cards =
    n === 0
      ? `<div class="s01-empty">${escapeHtml(sub)}</div>`
      : `<div class="s01-cards">${input.candidates
          .map((c) => {
            const cls = strengthClass(c.footprintStrength.band);
            const color = strengthColorVar(c.footprintStrength.band);
            const pct = c.footprintStrength.ratio === null ? 0 : c.footprintStrength.ratio * 100;
            const bucket = BUCKET_BY_ID.get(c.primaryBucket);
            return `<a class="s01-card" href="#cand-${escapeHtml(c.symbol)}">
  <div class="s01-card-top"><span class="tk mono">${escapeHtml(c.symbol)}</span><span class="band ${cls}">${escapeHtml(c.footprintStrength.band)}</span></div>
  ${c.footprintStrength.ratio !== null ? `<div class="s01-strength-bar"><i style="width:${pct.toFixed(0)}%;background:${color}"></i></div>` : ""}
  <div class="s01-card-meta"><span class="dot" style="background:${bucket ? `var(${bucket.colorVar})` : "var(--text-muted)"}"></span>${bucket ? escapeHtml(bucket.label) : escapeHtml(c.primaryBucket)}${c.speculative ? ` · <span class="warn">SMALL_SPEC</span>` : ""}</div>
</a>`;
          })
          .join("")}</div>`;

  const r = input.marketRegime;
  const spyClass = r.spyCloseVsSma200 === "above" ? "up" : r.spyCloseVsSma200 === "below" ? "down" : "neu";
  const spyLabel = r.spyCloseVsSma200 === "above" ? "上方" : r.spyCloseVsSma200 === "below" ? "下方" : "不可得";
  const slopeLabel = r.spySma200Slope === null ? "" : r.spySma200Slope > 0 ? "↑ 斜率向上" : r.spySma200Slope < 0 ? "↓ 斜率向下" : "斜率持平";
  const vixVsAvg = r.vixCurrent === null || r.vixAvg20 === null ? "" : r.vixCurrent > r.vixAvg20 ? "高于20日均值" : r.vixCurrent < r.vixAvg20 ? "低于20日均值" : "持平20日均值";
  const leading = r.leadingSectors[0];
  const lagging = r.laggingSectors[0];

  return `
<div class="stratum" data-stratum="01">
  ${stratumHead("01", "值得研究", `${escapeHtml(input.runMeta.profileArg)} · ${escapeHtml(input.runMeta.timestamp.slice(0, 10))}`)}
  <div class="s01-title">${escapeHtml(title)}</div>
  ${n > 0 ? `<div class="s01-sub">${escapeHtml(sub)}</div>` : ""}
  ${cards}
  <div class="s01-env">
    <div class="s01-env-item"><span class="k">SPY vs 200线</span><span class="v ${spyClass}">${spyLabel}<span style="font-size:11px;font-weight:400;color:var(--text-2);margin-left:6px">${escapeHtml(slopeLabel)}</span></span></div>
    <div class="s01-env-item"><span class="k">VIX</span><span class="v">${fmt(r.vixCurrent)}<span style="font-size:11px;font-weight:400;color:var(--text-2);margin-left:6px">${escapeHtml(vixVsAvg)}</span></span></div>
    <div class="s01-env-item"><span class="k">领涨</span><span class="v" style="font-size:14px">${leading ? escapeHtml(leading.sector) : "不可得"}</span></div>
    <div class="s01-env-item"><span class="k">领跌</span><span class="v" style="font-size:14px">${lagging ? escapeHtml(lagging.sector) : "不可得"}</span></div>
    <div class="s01-env-note">${placeholderP(input.radarNarrative?.marketRecapParagraph)}</div>
  </div>
</div>`;
}

/** ===== 02 · 候选明细 ===== */
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

function renderCandidateCard(c: HtmlReportCandidateInput, index: number, defaultOpen: boolean, verdict: import("./types.js").RadarCandidateVerdict | undefined): string {
  const f = c.flags;
  const cls = strengthClass(c.footprintStrength.band);
  const color = strengthColorVar(c.footprintStrength.band);
  const pct = c.footprintStrength.ratio === null ? 0 : c.footprintStrength.ratio * 100;

  const bucketDots = c.allBucketsHit
    .map((bId) => {
      const b = BUCKET_BY_ID.get(bId);
      return `<span class="bucket-name"><span class="dot" style="background:${b ? `var(${b.colorVar})` : "var(--text-muted)"}"></span>${b ? escapeHtml(b.label) : escapeHtml(bId)}</span>`;
    })
    .join(`<span class="sep">·</span>`);

  const metaParts = [
    bucketDots,
    c.sectorRank ? escapeHtml(c.sectorRank.sector) : "",
    c.eventWindow && c.eventWindow.length > 0 ? `⚡ ${escapeHtml(c.eventWindow[0].type)} ${escapeHtml(c.eventWindow[0].date)}` : "",
    c.promoted ? `<span class="up">观察哨升级而来</span>` : "",
    c.speculative ? `<span class="tier-warn">SMALL_SPEC</span>` : "",
    c.riskLevel !== "normal" ? `<span class="tier-warn">风险等级: ${RISK_LABEL[c.riskLevel]}</span>` : "",
    c.fundamentals?.accrualFlag === true ? `<span class="tier-warn">应计质量存疑</span>` : "",
    c.fundamentals?.dilutionRisk === true ? `<span class="tier-warn">稀释风险(现金跑道${fmt(c.fundamentals.cashRunwayMonths, 1)}个月)</span>` : "",
    c.contagion?.highBetaSatellite === true ? `<span class="tier-warn-red">⚠ 高波动卫星标的(修正案二十:不因此排除,但须加倍审视)</span>` : "",
  ].filter(Boolean);

  const hitCount = c.footprintDetail.filter((d) => d.status === "hit").length;
  const checkedCount = c.footprintDetail.length;
  const contagionRow = c.contagion
    ? (() => {
        const ct = c.contagion!;
        const ownMove = ct.leaderMovePct - ct.lagGapPct;
        return `<div class="cand-contagion-row">板块传导: 龙头 <b>${escapeHtml(ct.leaderTicker)}</b> 涨 ${fmtPct(ct.leaderMovePct, 1)} → 本标的仅涨 ${fmtPct(ownMove, 1)},滞后 <b>${fmtPct(ct.lagGapPct, 1)}</b>(板块事件日期: ${escapeHtml(ct.sectorEventDate)})</div>`;
      })()
    : "";

  return `
<div class="cand-card" id="cand-${escapeHtml(c.symbol)}" data-strength="${cls.replace("strength-", "")}" data-stratum="02">
  <div class="cand-head">
    <div class="cand-head-left">
      <span class="cand-idx mono">${String(index + 1).padStart(2, "0")}</span>
      <span class="cand-tk mono">${escapeHtml(c.symbol)}</span>
      <span class="cand-nm">${escapeHtml(c.securityName)}</span>
    </div>
    <div class="cand-strength">
      <span class="band ${cls}">足迹强度 · ${escapeHtml(c.footprintStrength.band)}</span>
      ${c.footprintStrength.ratio !== null ? `<div class="cand-strength-bar"><i style="width:${pct.toFixed(0)}%;background:${color}"></i></div><div class="frac">${c.footprintStrength.hitCount}/${c.footprintStrength.availableCount} 项命中</div>` : `<div class="frac">强度不可得</div>`}
    </div>
  </div>
  <div class="cand-metarow">${metaParts.join(`<span class="sep">·</span>`)}</div>
  ${contagionRow}
  <div class="cand-datarow">
    <div class="cand-facts">
      <div class="cand-fact"><div class="lbl">RSI14</div><div class="val">${fmt(f.rsi14, 1)} ${rsiLabel(f.rsi14)}</div></div>
      <div class="cand-fact"><div class="lbl">52周位置</div><div class="val">${week52PositionLabel(f.week52PositionPct)}</div></div>
      <div class="cand-fact"><div class="lbl">均线</div><div class="val">${smaAlignmentLabel(f.smaAlignedBullish)}</div></div>
      <div class="cand-fact"><div class="lbl">BB带宽百分位</div><div class="val">${bbPercentileLabel(f.bbWidthPercentile120)}</div></div>
      <div class="cand-fact"><div class="lbl">量比</div><div class="val">${volumeRatioLabel(f.volumeRatioLatest)}</div></div>
      <div class="cand-fact"><div class="lbl">机构持股</div><div class="val">${institutionalTrendLabel(f.institutionalTrend)}</div></div>
    </div>
    <div class="cand-spark">${renderSparklineSvg(c.closes90d, 150, 48)}<div class="shape">90日走势</div></div>
  </div>
  <div class="cand-foot">
    <div class="cand-foot-text">
      ${
        verdict?.grade || verdict?.probability !== undefined || verdict?.confidence !== undefined
          ? `<div class="cand-verdict">评级 ${escapeHtml(verdict.grade ?? "不可得")} · 概率评分 ${fmt(verdict.probability, 0)} · 确信度评分 ${fmt(verdict.confidence, 0)}</div>`
          : `<div class="cand-verdict placeholder">评级: ${PLACEHOLDER}</div>`
      }
      ${verdict?.descText ? `<div class="desc">${escapeHtml(verdict.descText)}</div>` : `<div class="desc placeholder">${PLACEHOLDER}</div>`}
    </div>
    <button type="button" class="cand-expand-btn" data-noprint data-expand-target="detail-${escapeHtml(c.symbol)}">${defaultOpen ? "收起 ▲" : "展开 ▼"}</button>
  </div>
  <div class="cand-detail" id="detail-${escapeHtml(c.symbol)}" data-detail ${defaultOpen ? "" : "hidden"}>
    <div class="cand-detail-title">构成足迹的条件 · ${hitCount} 项命中 / ${checkedCount} 项检查</div>
    ${c.footprintDetail.map(renderConditionRow).join("")}
    <div class="cand-detail-foot">不可得项不参与强度计分,也不计入分母。每一条均可在本次 run 的 screen_run.json 中按 symbol 溯源。</div>
    ${renderLatentAccumulationRow(f)}
    ${renderOptionsIntelligenceRow(c.optionsIntelligence)}
  </div>
</div>`;
}

/** TASK_CARD_09 Part B / 修正案十六: 严格隔离 - visually separated from every other block, explicit "仅供参考,严禁筛选依据" disclaimer, never any directional/counterparty wording (grep-verified). */
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

/** TASK_CARD_09 Part A / 修正案十五: 隐性吸筹复合信号 - strength-bonus-only flags, never a bucket admission condition, kept visually separate from the footprintDetail table above (which IS admission-condition evidence) to avoid implying these gate anything. */
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

function render02(input: ReportInput): string {
  if (input.candidates.length === 0) {
    return `
<div class="stratum" data-stratum="02">
  ${stratumHead("02", "候选明细", "")}
  <p class="muted">本次运行第一层候选为空,见上方 01 层空态说明。</p>
</div>`;
  }
  const cards = input.candidates.map((c, i) => renderCandidateCard(c, i, i === 0, input.radarNarrative?.candidateVerdicts?.[c.symbol])).join("");
  const legend = BUCKETS.map((b) => {
    const count = input.runMeta.detectorSummary[b.id]?.triggeredCount ?? 0;
    const zero = count === 0;
    return `<span class="item${zero ? " zero" : ""}"><span class="dot${zero ? " zero" : ""}" style="${zero ? "" : `background:var(${b.colorVar})`}"></span>${escapeHtml(b.label)} · ${count}次</span>`;
  }).join("");

  return `
<div class="stratum" data-stratum="02">
  ${stratumHead("02", "候选明细", `${input.candidates.length} 只`)}
  ${cards}
  <div class="s02-legend-foot">${legend}</div>
</div>`;
}

/** ===== 03 · 观察哨 ===== */
function renderWatchRow(w: HtmlWatchlistInput, promoted: boolean): string {
  const reasonLabel = w.reason === "contagion_unselected" ? "板块传导(未入选候选)" : w.reason === "compression_unselected" ? "波动挤压蓄势(未入选候选)" : "临界未达标";
  const strengthText = w.footprintStrength.ratio === null ? "不可得" : `${escapeHtml(w.footprintStrength.band)} · ${w.footprintStrength.hitCount}/${w.footprintStrength.availableCount}`;
  return `<div class="watch-row">
  <span class="wtk mono">${escapeHtml(w.symbol)}</span>
  <span></span>
  <span class="wname">${escapeHtml(reasonLabel)} · ${escapeHtml(w.securityName)}${promoted ? ` <span class="up">▲已升级</span>` : ""}</span>
  <span class="wstrength">${strengthText}</span>
</div>`;
}

function render03(input: ReportInput): string {
  const promotedNote = input.promotedThisRun.length > 0 ? `<div class="watch-promo-note">本轮从观察哨升格为候选: ${input.promotedThisRun.map(escapeHtml).join(", ")},不再重复列于下表。</div>` : "";
  if (input.watchlist.length === 0) {
    return `
<div class="stratum" data-stratum="03">
  ${stratumHead("03", "观察哨", "")}
  <p class="muted">本次运行观察哨为空。</p>
</div>`;
  }
  const rows = input.watchlist.map((w) => renderWatchRow(w, input.promotedThisRun.includes(w.symbol))).join("");
  return `
<div class="stratum" data-stratum="03">
  ${stratumHead("03", "观察哨", `${input.watchlist.length} 只`)}
  <div class="watch-table">
    <div class="watch-head-row"><span>ticker</span><span></span><span>说明</span><span style="text-align:right">足迹强度</span></div>
    ${rows}
  </div>
  ${promotedNote}
</div>`;
}

/** ===== 04 · 证据层 ===== */
function renderSectorFlowSpectrum(input: ReportInput): string {
  const anomalySet = new Set(input.sectorFootprints.filter((f) => f.footprintAnomaly).map((f) => f.sector));
  const sorted = [...input.sectorFlowScan].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));

  const rows = sorted
    .map((f: SectorFlowEntry) => {
      const isAnomaly = anomalySet.has(f.sector);
      const star = isAnomaly ? ` <span class="star">★异动</span>` : "";
      return `<div class="flowline${isAnomaly ? " anomaly" : ""}" data-f="${FLOW_CLASS[f.flowState]}" data-rank="${f.rank ?? 99}" data-return="${f.weeklyReturn ?? ""}" data-density="${f.squeezeDensity ?? ""}"><span class="fr">${f.rank ?? "-"}</span><span class="fn">${escapeHtml(f.sector)}${star}</span><span class="fp2 ${pctClass(f.weeklyReturn)}">${fmtPct(f.weeklyReturn, 1)}</span><span class="fd">${fmtPct(f.squeezeDensity, 1)}</span><span class="ff ${FLOW_CLASS[f.flowState]}">${FLOW_LABEL[f.flowState]}</span></div>`;
    })
    .join("");

  return `
<div class="sector-table">
  <div class="sector-head-row" id="sectorSortHeader">
    <span><button type="button" class="sort-btn" data-sort-key="rank" data-active="true" data-noprint>rank<span class="arrow">▲</span></button></span>
    <span>板块</span>
    <span style="text-align:right"><button type="button" class="sort-btn" data-sort-key="return" data-noprint>周涨跌</button></span>
    <span style="text-align:right"><button type="button" class="sort-btn" data-sort-key="density" data-noprint>挤压密度</button></span>
    <span style="text-align:right;min-width:70px">资金流向</span>
  </div>
  <div id="sectorRows">${rows}</div>
</div>
${placeholderP(input.radarNarrative?.sectorFlowSummaryLine, "本区总结待研究层填充")}`;
}

function renderHotSectorCardLite(h: HotSectorEntry, verdictText: string | undefined): string {
  const flowClass = h.flowState === "flow_in" ? "in" : h.flowState === "flow_out" ? "out" : "flat";
  const rankData = h.kind === "sector" && h.sectorFlowRef ? `板块 rank <b>${h.sectorFlowRef.rank ?? "n/a"}/11</b>` : `细分主题(篮子近似)`;
  const coverage = h.basketCoverage ? `<div class="sec-lite-coverage">篮子覆盖: ${h.basketCoverage.found}/${h.basketCoverage.total} 成分股在本次筛选宇宙内 - 手工近似,非官方板块分类</div>` : "";
  const poolLine =
    h.candidatesInPool.length > 0 || h.watchlistInPool.length > 0
      ? `<div class="sec-lite-pool">${h.candidatesInPool.length > 0 ? `◆ 进候选池: ${h.candidatesInPool.map(escapeHtml).join(", ")}` : ""}${h.candidatesInPool.length > 0 && h.watchlistInPool.length > 0 ? " · " : ""}${h.watchlistInPool.length > 0 ? `进观察哨: ${h.watchlistInPool.map(escapeHtml).join(", ")}` : ""}</div>`
      : `<div class="sec-lite-nopool">○ 无候选 · 无观察哨</div>`;

  return `
<div class="sec-lite">
  <div class="sec-lite-top"><span class="sec-lite-name"><span class="dot ${flowClass}"></span>${escapeHtml(h.name)}</span><span class="sec-lite-tag">${FLOW_LABEL[h.flowState]}</span></div>
  <div class="sec-lite-data">${rankData}<span>周涨跌 <b class="${pctClass(h.weeklyReturn)}">${fmtPct(h.weeklyReturn, 1)}</b></span><span>挤压密度 <b>${fmtPct(h.squeezeDensity, 1)}</b></span></div>
  ${verdictText ? `<div class="sec-lite-verdict">${escapeHtml(verdictText)}</div>` : `<div class="sec-lite-verdict placeholder">${PLACEHOLDER}</div>`}
  ${coverage}
  ${poolLine}
</div>`;
}

function renderHotSectorDetail(input: ReportInput): string {
  if (input.hotSectorDetail.length === 0) {
    return `<div class="s04-col-h">热门领域详述</div><p class="muted">本次运行无热门领域数据。</p>`;
  }
  const cards = input.hotSectorDetail.map((h) => renderHotSectorCardLite(h, input.radarNarrative?.hotSectorVerdicts?.[h.name])).join("");
  return `<div class="s04-col-h">热门领域详述 · 你点名的 + 本周异动</div>${cards}`;
}

/** claude_code_design_draft.md §2 layer 04: "必须写出可溯源的算术:跨板块
 * 挤压密度中位数、异动板块的倍数、该板块贡献了几只候选" - pure arithmetic
 * over sectorFlowScan/sectorFootprints/candidates that are already computed
 * elsewhere in this same ReportInput, no new data source. */
function squeezeDensityMedian(scan: SectorFlowEntry[]): number | null {
  const values = scan.map((f) => f.squeezeDensity).filter((v): v is number => v !== null).sort((a, b) => a - b);
  if (values.length === 0) return null;
  const mid = Math.floor(values.length / 2);
  return values.length % 2 === 0 ? (values[mid - 1] + values[mid]) / 2 : values[mid];
}

function renderThemeRadar(input: ReportInput): string {
  const themes = input.radarNarrative?.emergingThemes ?? [];
  if (themes.length > 0) {
    const cards = themes
      .map((t) => {
        const strengthCls = t.strengthLabel === "强" ? "strength-strong" : t.strengthLabel === "弱" ? "strength-weak" : "strength-mid";
        const fps = t.footprints.map((f) => `<div>▲ ${escapeHtml(f)}</div>`).join("");
        const members = t.members.map((m) => `<span class="tik mono">${escapeHtml(m)}</span>`).join(" ");
        const watchpoints =
          t.falsifiableWatchpoints && t.falsifiableWatchpoints.length > 0
            ? `<div class="theme-lite-watchpoints">可证伪观察点: ${t.falsifiableWatchpoints.map(escapeHtml).join(" / ")}</div>`
            : "";
        return `
<div class="theme-lite">
  <div class="theme-lite-tag">◆ THEME · 足迹拼图,非预言</div>
  <div><span class="theme-lite-name">${escapeHtml(t.name)}</span><span class="theme-lite-strength ${strengthCls}">${escapeHtml(t.strengthLabel)} · ${escapeHtml(t.lifecycleStage)}</span></div>
  <div class="theme-lite-arith">${fps}</div>
  <div class="theme-lite-members">集群成员 ${members}</div>
  <div class="theme-lite-verdict">${escapeHtml(t.verdictText)}</div>
  ${watchpoints}
</div>`;
      })
      .join("");
    return `<div class="s04-col-h">萌芽主题雷达</div>${cards}`;
  }

  const anomalies = input.sectorFootprints.filter((f) => f.footprintAnomaly);
  if (anomalies.length === 0) {
    return `<div class="s04-col-h">萌芽主题雷达</div><p class="muted">本次运行无板块异动,无主题雏形可报,不强行凑数。</p>`;
  }
  const median = squeezeDensityMedian(input.sectorFlowScan);
  const seedlingCards = anomalies
    .map((a) => {
      const contributedCandidates = input.candidates.filter((c) => c.sectorRank?.sector === a.sector).map((c) => c.symbol);
      const dims = a.anomalyDimensions
        .map((dim) => {
          const d = a.densities[dim];
          const multiple = median !== null && median > 0 && d.density !== null ? d.density / median : null;
          return `<div>▲ ${escapeHtml(dim)} 密度 <b>${d.density !== null ? (d.density * 100).toFixed(1) : "不可得"}%</b>(${d.count}只/${a.validSymbolCount}只)${multiple !== null ? ` · 为全场中位数(${(median! * 100).toFixed(1)}%)的 <b>${multiple.toFixed(1)}×</b>` : ""}</div>`;
        })
        .join("");
      return `
<div class="theme-lite">
  <div class="theme-lite-tag">◆ 潜在主题雏形 · 基于板块异动数据自动生成,尚未经研究层确认叙事与生命周期定位</div>
  <div><span class="theme-lite-name">${escapeHtml(a.sector)}</span><span class="theme-lite-strength">强度/阶段待研究层判定</span></div>
  <div class="theme-lite-arith">${dims}<div>贡献候选: ${contributedCandidates.length > 0 ? contributedCandidates.map(escapeHtml).join(", ") : "0只"}</div></div>
  <div class="theme-lite-verdict placeholder">${PLACEHOLDER}</div>
</div>`;
    })
    .join("");
  return `<div class="s04-col-h">萌芽主题雷达</div>${seedlingCards}`;
}

function renderZeroHitNote(input: ReportInput): string {
  const zeroHit = zeroHitBucketIds(input.runMeta.detectorSummary);
  if (zeroHit.length === 0) return "";
  const labels = zeroHit.map((id) => BUCKET_BY_ID.get(id)?.label ?? id).join("、");
  return `<div class="zero-hit-note">◆ 零命中桶说明: 本轮 <b>${escapeHtml(labels)}</b> 无标的触发全部条件。这反映的是本轮真实市场状态(该类设置本周确实罕见),而非系统故障 - 见 02 层桶图例的空心圆点标注。</div>`;
}

function render04(input: ReportInput): string {
  return `
<div class="stratum" data-stratum="04">
  ${stratumHead("04", "证据层", `<a href="#top" class="s04-back" data-noprint>↑ 返回摘要</a>`)}
  <div class="seclabel-lite" style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">全板块资金流谱 · 11板块一览</div>
  ${renderSectorFlowSpectrum(input)}
  <div class="s04-grid">
    <div>${renderHotSectorDetail(input)}</div>
    <div>${renderThemeRadar(input)}${renderZeroHitNote(input)}</div>
  </div>
</div>`;
}

/** ===== 05 · 流程与账本 ===== */
function render05(input: ReportInput): string {
  const notes = input.radarNarrative?.excludedNotes ?? [];
  const excludedHtml =
    notes.length === 0
      ? `<p class="placeholder">${PLACEHOLDER}(排除项判定需要研究层的实时信息核实,应用层无法自行判定)</p>`
      : notes.map((n) => `<p><b>${n.symbols.length}只已排除</b> - ${n.symbols.map(escapeHtml).join("·")}: ${escapeHtml(n.reason)}</p>`).join("");

  const forecast = input.radarNarrative?.weeklyForecast;
  const forecastHtml = forecast ? `<p>${escapeHtml(forecast)}</p>` : `<p class="placeholder">${PLACEHOLDER}</p>`;

  const pending = input.ledgerPendingBackfill;
  const invalidated = input.ledgerInvalidated;
  const ledgerHtml = `
    <div>已到期待回填: ${pending.length === 0 ? "0 条" : `${pending.length} 条 - ${pending.map((e) => escapeHtml(e.symbol)).join(", ")}`}</div>
    <div>已触发无效化: ${invalidated.length === 0 ? "0 条" : `${invalidated.length} 条 - ${invalidated.map((e) => escapeHtml(e.screening.symbol)).join(", ")}`}</div>`;

  return `
<div class="stratum" data-stratum="05">
  ${stratumHead("05", "流程与账本", "")}
  <div class="s05-grid">
    <div><div class="s05-col-h">排除项说明</div><div class="s05-col">${excludedHtml}</div></div>
    <div><div class="s05-col-h">本周总结与前瞻</div><div class="s05-col">${forecastHtml}</div></div>
    <div><div class="s05-col-h">前向账本</div><div class="s05-col">${ledgerHtml}</div></div>
  </div>
  <div class="s05-disc">每句均应锚定真实足迹或可查证的板块/价格数据,无无支撑预言。"这周没动"是诚实的合法输出;"值得注意"≠"建议买入",介入、仓位、执行属于你的领地。</div>
  <div class="s05-fingerprint">profile ${escapeHtml(input.runMeta.profileArg)} · gatesPassedCount ${input.runMeta.gatesPassedCount} · ${escapeHtml(input.runMeta.timestamp)}</div>
</div>`;
}

/** claude_code_design_draft.md §3: exactly two vanilla-JS interactions,
 * inlined at the end of the document, both DOMContentLoaded-gated, no
 * framework, no animation, no localStorage. Everything each toggles is
 * already present in the DOM (controlled via `hidden`), so the report
 * stays fully readable with JS disabled. */
const INTERACTION_SCRIPT = `
document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.cand-expand-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var id = btn.getAttribute('data-expand-target');
      var el = document.getElementById(id);
      if (!el) return;
      var willOpen = el.hasAttribute('hidden');
      if (willOpen) { el.removeAttribute('hidden'); btn.textContent = '收起 ▲'; }
      else { el.setAttribute('hidden', ''); btn.textContent = '展开 ▼'; }
    });
  });

  var sortState = { key: 'rank', dir: 1 };
  var rowsContainer = document.getElementById('sectorRows');
  function applySort(key) {
    if (!rowsContainer) return;
    sortState.dir = sortState.key === key ? sortState.dir * -1 : 1;
    sortState.key = key;
    var attr = key === 'rank' ? 'data-rank' : key === 'return' ? 'data-return' : 'data-density';
    var rows = Array.prototype.slice.call(rowsContainer.children);
    rows.sort(function (a, b) {
      var av = parseFloat(a.getAttribute(attr));
      var bv = parseFloat(b.getAttribute(attr));
      if (isNaN(av)) av = attr === 'data-rank' ? 999 : -Infinity;
      if (isNaN(bv)) bv = attr === 'data-rank' ? 999 : -Infinity;
      return (av - bv) * sortState.dir;
    });
    rows.forEach(function (r) { rowsContainer.appendChild(r); });
    document.querySelectorAll('.sort-btn').forEach(function (b) {
      var active = b.getAttribute('data-sort-key') === key;
      b.setAttribute('data-active', active ? 'true' : 'false');
      var arrow = b.querySelector('.arrow');
      if (active) {
        if (!arrow) { arrow = document.createElement('span'); arrow.className = 'arrow'; b.appendChild(arrow); }
        arrow.textContent = sortState.dir === 1 ? '▲' : '▼';
      } else if (arrow) {
        arrow.remove();
      }
    });
  }
  document.querySelectorAll('.sort-btn').forEach(function (btn) {
    btn.addEventListener('click', function () { applySort(btn.getAttribute('data-sort-key')); });
  });
});
`;

/**
 * claude_code_design_draft.md - "信息分层版 v2": five numbered strata
 * (地层), each with its own type scale / density / surface treatment,
 * superseding TASK_CARD_07 Part C's single-density stack. See
 * ai/decisions.md for the full architecture rationale and the footprintDetail/
 * footprintStrength derivation this render depends on (src/report/footprint/,
 * src/screen/detectors/*.ts's new `conditions` field).
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
<a id="top"></a>
${renderMasthead(input)}
${renderCreditWarning(input)}
<div class="wrap">
${render01(input)}
${render02(input)}
${render03(input)}
${render04(input)}
${render05(input)}
<div class="footer">ATLAS · Layer 1 情报简报 · Profile ${escapeHtml(input.runMeta.profileArg)} · gatesPassedCount ${input.runMeta.gatesPassedCount}</div>
</div>
<script>${INTERACTION_SCRIPT}</script>
</body>
</html>`;
}
