import type { PayloadCandidateInput, PayloadInput } from "./types.js";
import type { HotSectorEntry, SectorFlowEntry } from "../../screen/sector_scan/types.js";

const FLOW_STATE_LABEL: Record<string, string> = { flow_in: "流入", flow_out: "流出", flat: "横盘", unknown: "不可得" };
const CREDIT_LABEL: Record<string, string> = { loose: "宽松", neutral: "中性", tight: "收紧", unknown: "不可得" };

function fmtPct(v: number | null): string {
  return v === null ? "不可得" : `${(v * 100).toFixed(2)}%`;
}

function renderSectorFlowRow(f: SectorFlowEntry): string {
  return `  rank=${f.rank ?? "n/a"} ${f.sector}: 周涨跌=${fmtPct(f.weeklyReturn)}, 挤压密度=${fmtPct(f.squeezeDensity)}, 机构密度=${fmtPct(f.institutionalDensity)}, 内部人集群密度=${fmtPct(f.insiderClusterDensity)}, 资金流向=${FLOW_STATE_LABEL[f.flowState]}, 候选=${f.candidatesInSector}, 观察哨=${f.watchlistInSector}`;
}

function renderHotSectorEntry(h: HotSectorEntry): string[] {
  const lines: string[] = [];
  const coverageNote = h.basketCoverage ? ` (篮子覆盖: ${h.basketCoverage.found}/${h.basketCoverage.total} 成分股在本次筛选宇宙内 - 手工近似,非官方板块分类)` : "";
  lines.push(`${h.name} [${h.kind === "basket" ? "篮子近似" : h.origin === "anomaly_detected" ? "本周异动板块" : "板块"}]${coverageNote}`);
  lines.push(`  周涨跌=${fmtPct(h.weeklyReturn)}, 挤压密度=${fmtPct(h.squeezeDensity)}, 资金流向=${FLOW_STATE_LABEL[h.flowState] ?? "不可得"}`);
  lines.push(`  进候选池: ${h.candidatesInPool.length > 0 ? h.candidatesInPool.join(", ") : "无"}`);
  lines.push(`  进观察哨: ${h.watchlistInPool.length > 0 ? h.watchlistInPool.join(", ") : "无"}`);
  return lines;
}

function fmt(v: number | null | undefined): string {
  if (v === null || v === undefined) return "不可得";
  return Number.isInteger(v) ? String(v) : v.toFixed(4);
}

function formatFlagValue(v: unknown): string {
  if (v === null) return "不可得";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(4);
  return String(v);
}

function renderCandidate(c: PayloadCandidateInput): string[] {
  const lines: string[] = [];
  lines.push("* * *");
  lines.push(`标的: ${c.symbol} (${c.securityName})`);
  lines.push(
    `档位: ${c.profile}${c.speculative ? " [SPECULATIVE]" : ""} | risk_level: ${c.riskLevel} | 主桶: ${c.primaryBucket} (score=${fmt(c.primaryBucketScore)}) | 命中全部桶: ${c.allBucketsHit.join(", ")}${c.promoted ? " | PROMOTED" : ""}`,
  );
  lines.push("");

  lines.push("关键价位:");
  lines.push(`  latestClose=${fmt(c.flags.latestClose)}, SMA20=${fmt(c.flags.sma20)}, SMA50=${fmt(c.flags.sma50)}, SMA200=${fmt(c.flags.sma200)}`);
  lines.push(`  ATR%=${fmt(c.flags.atrPct !== null ? c.flags.atrPct * 100 : null)}%`);
  lines.push(`  近期枢轴高: ${c.pivotHigh ? `${fmt(c.pivotHigh.price)} (${c.pivotHigh.date})` : "不可得"}`);
  lines.push(`  近期枢轴低: ${c.pivotLow ? `${fmt(c.pivotLow.price)} (${c.pivotLow.date})` : "不可得"}`);
  lines.push("");

  lines.push("全旗标:");
  for (const [key, value] of Object.entries(c.flags)) {
    lines.push(`  ${key}: ${formatFlagValue(value)}`);
  }
  lines.push("");

  if (c.fundamentals) {
    const f = c.fundamentals;
    lines.push("基本面 (三态标注):");
    lines.push(`  revenueGrowth: ${f.revenueGrowthFlag ?? "null"} [${f.revenueGrowthFlagAvailability}]`);
    lines.push(`  grossMargin: ${f.grossMarginFlag ?? "null"} [${f.grossMarginFlagAvailability}]`);
    lines.push(`  profitability: ${f.profitabilityFlag ?? "null"} [${f.profitabilityFlagAvailability}]`);
    lines.push(`  leverage: ${f.leverageFlag ?? "null"} [${f.leverageFlagAvailability}] (totalCash=${fmt(f.totalCash)}, totalDebt=${fmt(f.totalDebt)})`);
    lines.push(`  earningsSoon: ${f.earningsSoon} (date=${f.earningsDate ?? "n/a"}) [${f.earningsDateAvailability}]`);
    lines.push("");
  }

  if (c.eventWindow && c.eventWindow.length > 0) {
    lines.push("Event Window:");
    for (const e of c.eventWindow) lines.push(`  ${e.type}: ${e.date} (${e.daysUntil}天后)`);
    lines.push("");
  }

  if (c.sectorRank) {
    lines.push(`板块: ${c.sectorRank.sector} (rank=${c.sectorRank.compositeRank ?? "n/a"}, ${c.sectorRank.classification ?? "n/a"})`);
    lines.push("");
  }

  lines.push("滞后天数:");
  lines.push(`  insiderClusterLagDays: ${fmt(c.flags.insiderClusterLagDays)}`);
  lines.push(`  shortInterestLagDays: ${fmt(c.flags.shortInterestLagDays)}`);
  lines.push("");

  lines.push(...renderOptionsIntelligence(c.optionsIntelligence));

  return lines;
}

/**
 * TASK_CARD_09 Part B / 修正案十六: kept structurally and visually
 * separate from every other section above (which IS real筛选证据) -
 * this block is汇总数据only, never involved in bucket判定或候选筛选,
 * and严禁 any directional/counterparty wording (grep-verified in
 * ai/decisions.md and this file's own test suite).
 */
function renderOptionsIntelligence(o: PayloadCandidateInput["optionsIntelligence"]): string[] {
  const lines: string[] = [];
  lines.push("期权情报(仅供研究层参考,严禁作为筛选依据,数据为汇总值·无方向·无交易主体):");
  if (o.availability === "不可得") {
    lines.push("  不可得");
    lines.push("");
    return lines;
  }
  lines.push(`  volumeOiRatioMax: ${fmt(o.volumeOiRatioMax)}${o.volumeOiRatioAnomaly ? " [活动异常]" : ""}`);
  lines.push(`  nearOtmCallOi: ${fmt(o.nearOtmCallOi)} (较上次运行变化: ${fmt(o.nearOtmCallOiChange)})`);
  lines.push(`  putCallRatio: ${fmt(o.putCallRatio)} (较上次运行变化: ${fmt(o.putCallRatioChange)})`);
  lines.push(`  atmImpliedVol: ${fmt(o.atmImpliedVol)} (较近期运行均值变化: ${fmt(o.ivMove)})`);
  lines.push("");
  return lines;
}

/**
 * TASK_CARD_05 SCOPE 3: assembles the ATLAS PAYLOAD per Amendment No.2's
 * evidence-involvement contract ("实施架构.三.证据涉入契约") - run
 * metadata, environment snapshot, sector-anomaly summary (Amendment
 * No.3, 修正案八), and per-candidate full flags/event_window/key price
 * levels/three-state tags/lag days. Plain text, copy-and-use ("纯文本块,
 * 复制即用").
 */
export function generateAtlasPayload(input: PayloadInput): string {
  const lines: string[] = [];
  lines.push("ATLAS PAYLOAD");
  lines.push(`Run: ${input.runMeta.timestamp} | Profile: ${input.runMeta.profileArg} | Gate-passed universe: ${input.runMeta.gatesPassedCount}`);
  lines.push("");

  lines.push("== 市场环境快照 ==");
  const r = input.marketRegime;
  lines.push(`Label: ${r.label ?? "不可得"}${r.labelUnavailableReason ? ` (${r.labelUnavailableReason})` : ""}`);
  lines.push(`SPY: close=${fmt(r.spyLatestClose)} vs SMA200=${fmt(r.spySma200)} (${r.spyCloseVsSma200 ?? "n/a"}), SMA200 slope=${fmt(r.spySma200Slope)}`);
  lines.push(`VIX: current=${fmt(r.vixCurrent)} vs 20日均值=${fmt(r.vixAvg20)}`);
  lines.push(`领涨板块: ${r.leadingSectors.map((s) => s.sector).join(", ") || "无"}`);
  lines.push(`领跌板块: ${r.laggingSectors.map((s) => s.sector).join(", ") || "无"}`);
  lines.push("");

  const cr = input.creditRegime;
  lines.push(
    `信用环境 (credit_regime): ${CREDIT_LABEL[cr.label]}${cr.labelUnavailableReason ? ` (${cr.labelUnavailableReason})` : ""} | OAS=${fmt(cr.oasCurrentBp)}bp (两周前=${fmt(cr.oasPastBp)}bp, 变动=${fmt(cr.oasChangeBp)}bp)`,
  );
  if (input.smallSpecForcedDisabled) {
    lines.push("⚠ SMALL_SPEC 档本次运行被信用收紧强制禁用(修正案十四) - 全部候选风险等级已上调一级");
  }
  lines.push("");

  lines.push("== 板块资金足迹异动 (仅陈述事实,零方向性文字) ==");
  const anomalies = input.sectorFootprints.filter((f) => f.footprintAnomaly);
  if (anomalies.length === 0) {
    lines.push("本次运行无板块标记 footprint_anomaly。");
  } else {
    for (const a of anomalies) {
      lines.push(`${a.sector}: 触发维度=[${a.anomalyDimensions.join(", ")}], 板块有效标的数=${a.validSymbolCount}`);
      for (const dim of a.anomalyDimensions) {
        const d = a.densities[dim];
        lines.push(`  ${dim}: 命中数=${d.count}, 密度=${d.density !== null ? (d.density * 100).toFixed(1) : "不可得"}%`);
      }
    }
  }
  lines.push("");

  lines.push("== 全板块资金流谱 (sector_flow_scan, 全11板块, 按rank排序) ==");
  const sortedFlow = [...input.sectorFlowScan].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
  for (const f of sortedFlow) lines.push(renderSectorFlowRow(f));
  lines.push("");

  lines.push("== 热门领域详述 (科技/AI/航天 + 本周异动板块) ==");
  if (input.hotSectorDetail.length === 0) {
    lines.push("本次运行无热门领域数据。");
  } else {
    for (const h of input.hotSectorDetail) {
      lines.push(...renderHotSectorEntry(h));
      lines.push("");
    }
  }

  lines.push(`== 候选 (${input.candidates.length}) ==`);
  for (const c of input.candidates) {
    lines.push(...renderCandidate(c));
  }

  return lines.join("\n");
}
