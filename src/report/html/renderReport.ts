import { escapeHtml } from "./escapeHtml.js";
import { renderSparklineSvg } from "./sparkline.js";
import { REPORT_STYLES } from "./styles.js";
import { bbPercentileLabel, institutionalTrendLabel, rsiLabel, smaAlignmentLabel, volumeRatioLabel, week52PositionLabel } from "./semanticLabels.js";
import type { HtmlReportCandidateInput, ReportInput } from "./types.js";

function fmt(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined) return "不可得";
  return Number.isInteger(v) ? String(v) : v.toFixed(digits);
}

function renderRegimeBanner(input: ReportInput): string {
  const r = input.marketRegime;
  const labelClass = r.label === "顺风" ? "up" : r.label === "逆风" ? "down" : "warn";
  return `
<div class="banner">
  <div class="banner-label">市场环境: <span class="${labelClass}">${escapeHtml(r.label ?? "不可得")}</span>${r.labelUnavailableReason ? ` <span class="muted">(${escapeHtml(r.labelUnavailableReason)})</span>` : ""}</div>
  <div class="flag-row">
    <span>SPY ${fmt(r.spyLatestClose)} vs SMA200 ${fmt(r.spySma200)} (${r.spyCloseVsSma200 ?? "n/a"})</span>
    <span>SMA200斜率 ${fmt(r.spySma200Slope, 4)}</span>
    <span>VIX ${fmt(r.vixCurrent)} / 20日均值 ${fmt(r.vixAvg20)}</span>
    <span>领涨: ${r.leadingSectors.map((s) => escapeHtml(s.sector)).join(", ") || "无"}</span>
    <span>领跌: ${r.laggingSectors.map((s) => escapeHtml(s.sector)).join(", ") || "无"}</span>
  </div>
</div>`;
}

function renderSectorAnomalyBanner(input: ReportInput): string {
  const anomalies = input.sectorFootprints.filter((f) => f.footprintAnomaly);
  if (anomalies.length === 0) {
    return `<div class="banner"><span class="muted">板块资金足迹: 本次运行无 footprint_anomaly。</span></div>`;
  }
  const rows = anomalies
    .map((a) => {
      const dims = a.anomalyDimensions
        .map((dim) => {
          const d = a.densities[dim];
          return `${escapeHtml(dim)}(密度${d.density !== null ? (d.density * 100).toFixed(1) : "不可得"}%, ${d.count}只)`;
        })
        .join(", ");
      return `<div>${escapeHtml(a.sector)}: ${dims}</div>`;
    })
    .join("");
  return `<div class="banner"><div class="banner-label warn">板块资金足迹异动 (仅陈述事实)</div>${rows}</div>`;
}

function renderCandidateCard(c: HtmlReportCandidateInput): string {
  const f = c.flags;
  const badges = [
    `<span class="badge">${escapeHtml(c.primaryBucket)}</span>`,
    ...c.allBucketsHit.filter((b) => b !== c.primaryBucket).map((b) => `<span class="badge muted">${escapeHtml(b)}</span>`),
    c.promoted ? `<span class="badge badge-promoted">PROMOTED</span>` : "",
    c.speculative ? `<span class="badge badge-speculative">SMALL_SPEC 投机警示</span>` : "",
  ].join("");

  const eventWindowHtml =
    c.eventWindow && c.eventWindow.length > 0
      ? `<div class="event-window">${c.eventWindow.map((e) => `⚡ ${escapeHtml(e.type)} ${escapeHtml(e.date)} (${e.daysUntil}天后)`).join(" &nbsp; ")}</div>`
      : "";

  const fmpHtml =
    c.fmp && (c.fmp.peRatioTTMAvailability === "可得" || c.fmp.priceMismatchAvailability === "可得")
      ? `<div class="flag-row">
          <span class="flag-item"><span class="label">P/E(TTM):</span> ${fmt(c.fmp.peRatioTTM)}</span>
          <span class="flag-item"><span class="label">P/B(TTM):</span> ${fmt(c.fmp.pbRatioTTM)}</span>
          <span class="flag-item"><span class="label">PEG(TTM):</span> ${fmt(c.fmp.pegRatioTTM)}</span>
          ${c.fmp.priceMismatch === true ? `<span class="warn">price_mismatch (偏差${fmt(c.fmp.priceDeviationPercent, 1)}%)</span>` : ""}
        </div>`
      : "";

  return `
<div class="card">
  <div class="card-header">
    <span class="symbol">${escapeHtml(c.symbol)}</span>
    <span class="muted">${escapeHtml(c.securityName)}</span>
    ${renderSparklineSvg(c.closes90d)}
  </div>
  <div>${badges}</div>
  ${eventWindowHtml}
  <div class="flag-row">
    <span class="flag-item"><span class="label">RSI14:</span> ${fmt(f.rsi14)} ${rsiLabel(f.rsi14)}</span>
    <span class="flag-item"><span class="label">52周位置:</span> ${f.week52PositionPct !== null ? `${(f.week52PositionPct * 100).toFixed(0)}%` : "不可得"} ${week52PositionLabel(f.week52PositionPct)}</span>
    <span class="flag-item"><span class="label">均线:</span> ${smaAlignmentLabel(f.smaAlignedBullish)}</span>
    <span class="flag-item"><span class="label">BB带宽百分位:</span> ${fmt(f.bbWidthPercentile120, 1)} ${bbPercentileLabel(f.bbWidthPercentile120)}</span>
    <span class="flag-item"><span class="label">量比:</span> ${fmt(f.volumeRatioLatest)} ${volumeRatioLabel(f.volumeRatioLatest)}</span>
  </div>
  <div class="flag-row">
    <span class="flag-item"><span class="label">机构持股趋势:</span> ${institutionalTrendLabel(f.institutionalTrend)}</span>
    <span class="flag-item"><span class="label">内部人集群:</span> ${f.insiderCluster === true ? `是 (${f.insiderClusterDistinctBuyers}人)` : f.insiderCluster === false ? "否" : "不可得"}</span>
    <span class="flag-item"><span class="label">做空余额变化:</span> ${fmt(f.shortInterestChangePercent, 1)}%</span>
    <span class="flag-item"><span class="label">SMA20/50/200:</span> ${fmt(f.sma20)} / ${fmt(f.sma50)} / ${fmt(f.sma200)}</span>
    <span class="flag-item"><span class="label">ATR%:</span> ${f.atrPct !== null ? `${(f.atrPct * 100).toFixed(2)}%` : "不可得"}</span>
  </div>
  ${fmpHtml}
</div>`;
}

function renderWatchlistTable(input: ReportInput): string {
  const promotedNote =
    input.promotedThisRun.length > 0
      ? `<p class="up">本轮从观察哨升格为候选: ${input.promotedThisRun.map(escapeHtml).join(", ")}</p>`
      : "";

  if (input.watchlist.length === 0) {
    return `${promotedNote}<p class="muted">本次运行观察哨为空。</p>`;
  }

  const rows = input.watchlist
    .map(
      (w) => `<tr><td>${escapeHtml(w.symbol)}</td><td>${escapeHtml(w.securityName)}</td><td>${w.reason === "compression_unselected" ? "波动挤压蓄势(未入选候选)" : "临界未达标"}</td></tr>`,
    )
    .join("");

  return `${promotedNote}<table><thead><tr><th>标的</th><th>名称</th><th>原因</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderLedgerPassiveSection(input: ReportInput): string {
  const pending = input.ledgerPendingBackfill;
  const invalidated = input.ledgerInvalidated;

  const pendingHtml =
    pending.length === 0
      ? `<p class="muted">无到期待回填条目。</p>`
      : `<ul class="plain">${pending.map((e) => `<li>${escapeHtml(e.symbol)} - 筛选于 ${escapeHtml(e.screeningTimestamp)} - <span class="warn">待回填</span></li>`).join("")}</ul>`;

  const invalidatedHtml =
    invalidated.length === 0
      ? `<p class="muted">无已触发无效化条目。</p>`
      : `<ul class="plain">${invalidated.map((e) => `<li>${escapeHtml(e.screening.symbol)} - 筛选于 ${escapeHtml(e.screening.screeningTimestamp)} - <span class="down">已触发无效化于 ${escapeHtml(e.invalidatedAt)}</span></li>`).join("")}</ul>`;

  return `
<h3>已到期待回填</h3>${pendingHtml}
<h3>已触发无效化</h3>${invalidatedHtml}`;
}

/**
 * TASK_CARD_05 SCOPE 5: single self-contained HTML file (inline CSS +
 * SVG sparklines, no external resources - open directly in any
 * browser). No P4_DESIGN_SPEC found in this repo (verified via file
 * search), so the fallback minimal-terminal design applies, with AI-
 * slop (purple gradients, cards-within-cards) deliberately avoided -
 * see styles.ts's own comment.
 */
export function renderReport(input: ReportInput): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>Atlas 周报 - ${escapeHtml(input.runMeta.timestamp)}</title>
<style>${REPORT_STYLES}</style>
</head>
<body>
<h1>Atlas Layer 1 筛选报告</h1>
<div class="muted">运行时间: ${escapeHtml(input.runMeta.timestamp)} | 档位: ${escapeHtml(input.runMeta.profileArg)} | 通过闸门标的数: ${input.runMeta.gatesPassedCount}</div>

<div class="section">
${renderRegimeBanner(input)}
${renderSectorAnomalyBanner(input)}
</div>

<div class="section">
<h2>候选 (${input.candidates.length})</h2>
${input.candidates.map(renderCandidateCard).join("")}
</div>

<div class="section">
<h2>观察哨 (${input.watchlist.length})</h2>
${renderWatchlistTable(input)}
</div>

<div class="section">
<h2>账本被动区</h2>
${renderLedgerPassiveSection(input)}
</div>

</body>
</html>`;
}
