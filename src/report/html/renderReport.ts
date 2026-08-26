import { escapeHtml } from "./escapeHtml.js";
import { renderSparklineSvg } from "./sparkline.js";
import { REPORT_STYLES } from "./styles.js";
import { bbPercentileLabel, institutionalTrendLabel, rsiLabel, smaAlignmentLabel, volumeRatioLabel, week52PositionLabel } from "./semanticLabels.js";
import type { HotSectorEntry, SectorFlowEntry } from "../../screen/sector_scan/types.js";
import type { HtmlReportCandidateInput, ReportInput } from "./types.js";

const PLACEHOLDER = "待研究层填充";
const FLOW_LABEL: Record<string, string> = { flow_in: "流入", flow_out: "流出", flat: "横盘", unknown: "不可得" };
const FLOW_CLASS: Record<string, string> = { flow_in: "in", flow_out: "out", flat: "flat", unknown: "flat" };

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

/**
 * TASK_CARD_07 Part C: masthead + 大盘环境复盘. The 4 stat cards are pure
 * computed facts (marketRegime, already computed by TASK_CARD_03's
 * regime module); the recap paragraph is Radar-only content per the
 * card's "关键边界" (应用层只做数据与渲染,绝不生成任何判断文字) - shows a
 * literal placeholder, never app-synthesized prose, when Radar hasn't
 * run yet.
 */
function renderMasthead(input: ReportInput): string {
  const [datePart, timePartFull] = input.runMeta.timestamp.split("T");
  const timePart = timePartFull ? timePartFull.slice(0, 5) : "n/a";
  return `
<div class="masthead">
  <div class="brand">ATLAS<span>·</span>RADAR</div>
  <div class="meta">WEEKLY INTEL BRIEFING<br><b>${escapeHtml(datePart)}</b> · ${escapeHtml(timePart)} UTC · universe <b>${input.runMeta.gatesPassedCount}</b></div>
</div>`;
}

function renderMarketRecap(input: ReportInput): string {
  const r = input.marketRegime;
  const spyClass = r.spyCloseVsSma200 === "above" ? "up" : r.spyCloseVsSma200 === "below" ? "down" : "neu";
  const spyLabel = r.spyCloseVsSma200 === "above" ? "上方" : r.spyCloseVsSma200 === "below" ? "下方" : "不可得";
  const slopeLabel = r.spySma200Slope === null ? "" : r.spySma200Slope > 0 ? "↑ 斜率向上" : r.spySma200Slope < 0 ? "↓ 斜率向下" : "斜率持平";
  const vixVsAvg = r.vixCurrent === null || r.vixAvg20 === null ? "" : r.vixCurrent > r.vixAvg20 ? "高于20日均值" : r.vixCurrent < r.vixAvg20 ? "低于20日均值" : "持平20日均值";
  const leading = r.leadingSectors[0];
  const lagging = r.laggingSectors[0];

  return `
<div class="market">
  <div class="market-h">◆ 大盘环境复盘 · 只描述现在,不预报未来</div>
  <div class="market-grid">
    <div class="mstat"><div class="k">SPY vs 200线</div><div class="v ${spyClass}">${spyLabel}</div><div class="s ${spyClass}">${escapeHtml(slopeLabel)}</div></div>
    <div class="mstat"><div class="k">VIX</div><div class="v">${fmt(r.vixCurrent)}</div><div class="s neu">${escapeHtml(vixVsAvg)}</div></div>
    <div class="mstat"><div class="k">领涨</div><div class="v" style="font-size:14px">${leading ? escapeHtml(leading.sector) : "不可得"}</div><div class="s up">${leading?.compositeRank ? `rank ${leading.compositeRank}` : ""}</div></div>
    <div class="mstat"><div class="k">领跌</div><div class="v" style="font-size:14px">${lagging ? escapeHtml(lagging.sector) : "不可得"}</div><div class="s down">${lagging?.compositeRank ? `rank ${lagging.compositeRank}` : ""}</div></div>
  </div>
  ${placeholderP(input.radarNarrative?.marketRecapParagraph)}
</div>`;
}

function renderSectorFlowSpectrum(input: ReportInput): string {
  const anomalySet = new Set(input.sectorFootprints.filter((f) => f.footprintAnomaly).map((f) => f.sector));
  const sorted = [...input.sectorFlowScan].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));

  const rows = sorted
    .map((f: SectorFlowEntry) => {
      const star = anomalySet.has(f.sector) ? ` <span class="star">★异动</span>` : "";
      return `<div class="flowline" data-f="${FLOW_CLASS[f.flowState]}"><span class="fr">${f.rank ?? "-"}</span><span class="fn">${escapeHtml(f.sector)}${star}</span><span class="fp2 ${pctClass(f.weeklyReturn)}">${fmtPct(f.weeklyReturn, 1)}</span><span class="fd${anomalySet.has(f.sector) ? " hot" : ""}">${fmtPct(f.squeezeDensity, 1)}</span><span class="ff ${FLOW_CLASS[f.flowState]}">${FLOW_LABEL[f.flowState]}</span></div>`;
    })
    .join("");

  return `
<div class="seclabel">全板块资金流谱 · 11板块一览(按rank)</div>
<div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;overflow:hidden;margin-bottom:16px">
  <div style="display:grid;grid-template-columns:auto 1fr auto auto auto;gap:12px;padding:9px 16px;border-bottom:1px solid var(--line);font-size:10px;color:var(--faint);letter-spacing:.5px;text-transform:uppercase">
    <span>rank</span><span>板块</span><span style="text-align:right">周涨跌</span><span style="text-align:right">挤压密度</span><span style="text-align:right;min-width:70px">资金流向</span>
  </div>
  ${rows}
</div>
${placeholderP(input.radarNarrative?.sectorFlowSummaryLine, "本区总结待研究层填充")}`;
}

function renderHotSectorCard(h: HotSectorEntry, verdictText: string | undefined): string {
  const flowClass = h.flowState === "flow_in" ? "flow-in" : h.flowState === "flow_out" ? "flow-out" : "flow-flat";
  const rankData = h.kind === "sector" && h.sectorFlowRef ? `<span>板块 rank <b>${h.sectorFlowRef.rank ?? "n/a"}/11</b></span>` : `<span>细分主题(篮子近似)</span>`;
  const coverage = h.basketCoverage ? `<div class="sec-coverage">篮子覆盖: ${h.basketCoverage.found}/${h.basketCoverage.total} 成分股在本次筛选宇宙内 - 手工近似,非官方板块分类</div>` : "";
  const poolLine =
    h.candidatesInPool.length > 0 || h.watchlistInPool.length > 0
      ? `<div class="sec-inpool">${h.candidatesInPool.length > 0 ? `◆ 进候选池: ${h.candidatesInPool.map(escapeHtml).join(", ")}` : ""}${h.candidatesInPool.length > 0 && h.watchlistInPool.length > 0 ? " · " : ""}${h.watchlistInPool.length > 0 ? `进观察哨: ${h.watchlistInPool.map(escapeHtml).join(", ")}` : ""}</div>`
      : `<div class="sec-nopool">○ 无候选 · 无观察哨</div>`;

  return `
<div class="sec ${flowClass}">
  <div class="sec-top"><span class="sec-name">${escapeHtml(h.name)}</span><span class="flowtag ${FLOW_CLASS[h.flowState]}">${FLOW_LABEL[h.flowState]}</span></div>
  <div class="sec-data">${rankData}<span>周涨跌 <b class="${pctClass(h.weeklyReturn)}">${fmtPct(h.weeklyReturn, 1)}</b></span><span>挤压密度 <b>${fmtPct(h.squeezeDensity, 1)}</b></span></div>
  ${verdictText ? `<div class="sec-verdict">${escapeHtml(verdictText)}</div>` : `<div class="sec-verdict placeholder">${PLACEHOLDER}</div>`}
  ${coverage}
  ${poolLine}
</div>`;
}

function renderHotSectorDetail(input: ReportInput): string {
  if (input.hotSectorDetail.length === 0) {
    return `<div class="seclabel">热门领域详述</div><p class="muted">本次运行无热门领域数据。</p>`;
  }
  const cards = input.hotSectorDetail.map((h) => renderHotSectorCard(h, input.radarNarrative?.hotSectorVerdicts?.[h.name])).join("");
  return `
<div class="seclabel">热门领域详述 · 你点名的 + 本周异动(数据说话,不吹虚火)</div>
<div class="sectors">${cards}</div>`;
}

/**
 * TASK_CARD_07 Part C: "首版可先渲染板块异动作为主题雏形" - when Radar
 * hasn't supplied emergingThemes, render footprint-anomaly sectors as an
 * unconfirmed "seedling" placeholder using only facts (density/count),
 * explicitly labeled as not yet Radar-confirmed. Never guesses a
 * lifecycle stage or strength label - those are Radar's own inferential
 * job per Amendment No.4 修正案十一.
 */
function renderThemeRadar(input: ReportInput): string {
  const themes = input.radarNarrative?.emergingThemes ?? [];
  if (themes.length > 0) {
    const cards = themes
      .map((t) => {
        const stages = ["萌芽", "发酵", "爆发", "衰竭"];
        const activeIdx = stages.indexOf(t.lifecycleStage);
        const track = stages.map((_, i) => `<div class="cycle-seg${i <= activeIdx ? " on" : ""}"></div>`).join("");
        const labels = stages.map((s, i) => `<span${i === activeIdx ? ` class="active"` : ""}>${s}${i === activeIdx ? " ◄ 当前" : ""}</span>`).join("");
        const strengthClass = t.strengthLabel === "强" ? "strong" : t.strengthLabel === "弱" ? "weak" : "mid";
        const fps = t.footprints.map((f) => `<div class="fp"><span class="ic">▲</span> ${escapeHtml(f)}</div>`).join("");
        const members = t.members.map((m) => `<span class="tik">${escapeHtml(m)}</span>`).join("");
        const watchpoints = t.falsifiableWatchpoints && t.falsifiableWatchpoints.length > 0 ? `<div class="disc">可证伪观察点: ${t.falsifiableWatchpoints.map(escapeHtml).join(" / ")}</div>` : "";
        return `
<div class="theme">
  <div class="theme-tag">◆ THEME · 足迹拼图,非预言</div>
  <div class="theme-name">${escapeHtml(t.name)}<span class="strength ${strengthClass}">足迹强度 ${escapeHtml(t.strengthLabel)}</span></div>
  <div class="cycle"><div class="cycle-track">${track}</div><div class="cycle-labels">${labels}</div></div>
  <div class="footprints">${fps}</div>
  <div style="font-size:11px;color:var(--faint);margin-bottom:4px">集群成员</div>
  <div class="members">${members}</div>
  <div class="verdict"><div class="verdict-h">◆ 白话判断 · 每句锚定上方足迹</div><p>${escapeHtml(t.verdictText)}</p></div>
  ${watchpoints}
</div>`;
      })
      .join("");
    return `<div class="seclabel">萌芽主题雷达 · Emerging Theme(激进档 · 苗头即报)</div>${cards}`;
  }

  const anomalies = input.sectorFootprints.filter((f) => f.footprintAnomaly);
  if (anomalies.length === 0) {
    return `<div class="seclabel">萌芽主题雷达 · Emerging Theme(激进档 · 苗头即报)</div><p class="muted">本次运行无板块异动,无主题雏形可报,不强行凑数。</p>`;
  }
  const seedlingCards = anomalies
    .map((a) => {
      const dims = a.anomalyDimensions
        .map((dim) => {
          const d = a.densities[dim];
          return `<div class="fp"><span class="ic">▲</span> ${escapeHtml(dim)} <b>${d.density !== null ? (d.density * 100).toFixed(1) : "不可得"}%</b> <span style="color:var(--faint)">(${d.count}只/${a.validSymbolCount}只)</span></div>`;
        })
        .join("");
      return `
<div class="theme">
  <div class="theme-tag">◆ 潜在主题雏形 · 基于板块异动数据自动生成,尚未经研究层确认叙事与生命周期定位</div>
  <div class="theme-name">${escapeHtml(a.sector)}<span class="strength mid">强度/阶段待研究层判定</span></div>
  <div class="footprints">${dims}</div>
  <div class="verdict placeholder"><div class="verdict-h">◆ 白话判断</div><p>${PLACEHOLDER}</p></div>
</div>`;
    })
    .join("");
  return `<div class="seclabel">萌芽主题雷达 · Emerging Theme(激进档 · 苗头即报)</div>${seedlingCards}`;
}

function renderTier1CandidateCard(c: HtmlReportCandidateInput, verdict: import("./types.js").RadarCandidateVerdict | undefined): string {
  const f = c.flags;
  const badges = [
    `<span class="bdg bucket">${escapeHtml(c.primaryBucket)}</span>`,
    ...c.allBucketsHit.filter((b) => b !== c.primaryBucket).map((b) => `<span class="bdg bucket">${escapeHtml(b)}</span>`),
    c.sectorRank ? `<span class="bdg sector">${escapeHtml(c.sectorRank.sector)}</span>` : "",
    c.eventWindow && c.eventWindow.length > 0 ? `<span class="bdg event">⚡ ${escapeHtml(c.eventWindow[0].type)} ${escapeHtml(c.eventWindow[0].date)}</span>` : "",
    c.promoted ? `<span class="bdg promoted">PROMOTED</span>` : "",
    c.speculative ? `<span class="bdg speculative">SMALL_SPEC</span>` : "",
  ].join("");

  const factsRow = `<div class="flag-row" style="display:flex;flex-wrap:wrap;gap:10px;font-size:11px;color:var(--dim);margin-top:8px">
    <span>RSI14 ${fmt(f.rsi14)} ${rsiLabel(f.rsi14)}</span>
    <span>52周位置 ${week52PositionLabel(f.week52PositionPct)}</span>
    <span>均线 ${smaAlignmentLabel(f.smaAlignedBullish)}</span>
    <span>BB带宽百分位 ${bbPercentileLabel(f.bbWidthPercentile120)}</span>
    <span>量比 ${volumeRatioLabel(f.volumeRatioLatest)}</span>
    <span>机构持股 ${institutionalTrendLabel(f.institutionalTrend)}</span>
  </div>`;

  const gradeBox = verdict?.grade ? `<div class="grade g-b">${escapeHtml(verdict.grade)}</div>` : `<div class="grade g-na">N/A</div>`;
  const rightBox =
    verdict?.probability !== undefined
      ? `概率 <span class="prob">${verdict.probability}<small>/100</small></span><div class="scorebar">${Array.from({ length: 5 }, (_, i) => `<i${i < Math.round(verdict.probability! / 20) ? ' class="on"' : ""}></i>`).join("")}</div>${verdict.confidence !== undefined ? `<div style="margin-top:6px">确信 ${verdict.confidence}</div>` : ""}`
      : `<span class="placeholder">${PLACEHOLDER}</span>`;

  return `
<div class="cand">
  ${gradeBox}
  <div class="cand-mid">
    <span class="tk">${escapeHtml(c.symbol)}</span><span class="nm">${escapeHtml(c.securityName)}</span>
    ${verdict?.descText ? `<div class="desc">${escapeHtml(verdict.descText)}</div>` : `<div class="desc placeholder">${PLACEHOLDER}</div>`}
    <div class="badges">${badges}</div>
    ${factsRow}
  </div>
  <div class="cand-right">${renderSparklineSvg(c.closes90d)}<div style="margin-top:6px">${rightBox}</div></div>
</div>`;
}

function renderTier1Candidates(input: ReportInput): string {
  const cards = input.candidates.map((c) => renderTier1CandidateCard(c, input.radarNarrative?.candidateVerdicts?.[c.symbol])).join("");
  return `<div class="seclabel">第一层 · 值得研究(深讲)</div>${cards || `<p class="muted">本次运行第一层候选为空。</p>`}`;
}

function renderTier2Watchlist(input: ReportInput): string {
  const promotedNote = input.promotedThisRun.length > 0 ? `<p class="up" style="margin-bottom:9px">本轮从观察哨升格为候选: ${input.promotedThisRun.map(escapeHtml).join(", ")}</p>` : "";
  if (input.watchlist.length === 0) {
    return `<div class="seclabel">第二层 · 观察哨(浅列 · 苗头对了自动升级)</div>${promotedNote}<p class="muted">本次运行观察哨为空。</p>`;
  }
  const rows = input.watchlist
    .map((w) => {
      const promoted = input.promotedThisRun.includes(w.symbol);
      const reasonLabel = w.reason === "compression_unselected" ? "波动挤压蓄势(未入选候选)" : "临界未达标";
      return `<div class="wrow"><span class="wtk">${escapeHtml(w.symbol)}</span><span class="wbucket">${escapeHtml(reasonLabel)}</span><span class="wdesc">${escapeHtml(w.securityName)}${promoted ? ` <span class="promo">▲已升级</span>` : ""}</span><span class="wtrig"></span></div>`;
    })
    .join("");
  return `<div class="seclabel">第二层 · 观察哨(浅列 · 苗头对了自动升级)</div>${promotedNote}<div class="watch">${rows}</div>`;
}

function renderExcludedNotes(input: ReportInput): string {
  const notes = input.radarNarrative?.excludedNotes ?? [];
  if (notes.length === 0) {
    return `<div class="excl-note"><span class="placeholder">${PLACEHOLDER}(排除项判定需要研究层的实时信息核实,应用层无法自行判定)</span></div>`;
  }
  return notes.map((n) => `<div class="excl-note"><b>${n.symbols.length}只已排除</b> — ${n.symbols.map(escapeHtml).join("·")}: ${escapeHtml(n.reason)}</div>`).join("");
}

function renderWeeklyForecast(input: ReportInput): string {
  const forecast = input.radarNarrative?.weeklyForecast;
  return `
<div class="forecast">
  <div class="forecast-h">◆ 本周总结与前瞻 · 戴镣铐的白话</div>
  ${forecast ? `<p>${escapeHtml(forecast)}</p>` : `<p class="placeholder">${PLACEHOLDER}</p>`}
  <div class="disc">每句均应锚定真实足迹或可查证的板块/价格数据,无无支撑预言。"这周没动"是诚实的合法输出;"值得注意"≠"建议买入",介入、仓位、执行属于你的领地。</div>
</div>`;
}

function renderLedgerPassive(input: ReportInput): string {
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
<div class="seclabel">账本被动区</div>
<div class="ledger-panel"><h3 style="font-size:12px;color:var(--faint);margin-bottom:6px">已到期待回填</h3>${pendingHtml}<h3 style="font-size:12px;color:var(--faint);margin:12px 0 6px">已触发无效化</h3>${invalidatedHtml}</div>`;
}

/**
 * TASK_CARD_07 Part C: rebuilt per MOCKUP_intel_briefing_v4.html's
 * structure and visual style (explicit project-owner instruction,
 * superseding the card's own text reference to v3). Architecture
 * boundary throughout: the application layer only renders data it
 * actually computed (numbers, labels, badges, sparklines) - every
 * prose/judgment slot the mockup shows (market recap paragraph, sector
 * verdicts, theme narrative, candidate desc/grade/probability, excluded
 * notes, weekly forecast) is optional Radar-supplied content that shows
 * a literal placeholder when absent, never app-synthesized text. See
 * ai/decisions.md for the full architecture rationale.
 */
export function renderReport(input: ReportInput): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ATLAS Weekly Intel Briefing - ${escapeHtml(input.runMeta.timestamp)}</title>
<style>${REPORT_STYLES}</style>
</head>
<body>
<div class="wrap">
${renderMasthead(input)}
${renderMarketRecap(input)}
${renderSectorFlowSpectrum(input)}
${renderHotSectorDetail(input)}
${renderThemeRadar(input)}
${renderTier1Candidates(input)}
${renderTier2Watchlist(input)}
${renderExcludedNotes(input)}
${renderWeeklyForecast(input)}
${renderLedgerPassive(input)}
<div class="footer">ATLAS · Layer 1 情报简报 · Profile ${escapeHtml(input.runMeta.profileArg)} · gatesPassedCount ${input.runMeta.gatesPassedCount}</div>
</div>
</body>
</html>`;
}
