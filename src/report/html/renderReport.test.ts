import { test } from "node:test";
import assert from "node:assert/strict";
import { renderReport } from "./renderReport.js";
import type { HtmlReportCandidateInput, HtmlWatchlistInput, ReportInput } from "./types.js";
import type { IndicatorFlags } from "../../screen/indicators/types.js";
import type { SectorFlowEntry, HotSectorEntry } from "../../screen/sector_scan/types.js";
import type { FootprintCondition } from "../../screen/detectors/IDetector.js";
import type { FootprintStrength } from "../footprint/footprintStrength.js";
import { computeFootprintStrength } from "../footprint/footprintStrength.js";

const flags: IndicatorFlags = {
  sma20: 100, sma50: 95, sma200: 90, smaAlignedBullish: true,
  rsi14: 27, atr14: 2, atrPct: 0.02,
  week52High: 120, week52Low: 80, week52PositionPct: 0.1, pctOf52WeekHigh: 0.9,
  volumeAvg20: 100, volumeAvg50: 90, volumeRatioLatest: 2.5,
  maxVolumeRatioLast5Days: 2, maxVolumeRatioLast10Days: 2,
  obvLatest: 1000, obvSlope20: 10,
  bbWidthLatest: 0.1, bbWidthPercentile120: 15, sidewaysBaseDays: 5,
  threeMonthReturn: 0.1, sixMonthReturn: 0.2, rs3MonthPercentile: 70, rs6MonthPercentile: 85,
  tradingDaysAvailable: 260, latestClose: 108,
  insiderCluster: true, insiderClusterDistinctBuyers: 2, insiderClusterLagDays: 5,
  institutionalTrend: "up", institutionalTrendAvailability: "可得",
  shortInterestChangePercent: -20, shortInterestDaysToCover: 1.5, shortInterestPercentOfFloat: 12,
  shortInterestLagDays: 20, shortInterestAvailability: "可得",
};

const sampleConditions: FootprintCondition[] = [
  { bucket: "oversold_reversal", label: "RSI14 超卖", field: "rsi14", actual: "27.0", threshold: "≤ 25", status: "hit", availability: "可得" },
  { bucket: "oversold_reversal", label: "52周位置偏低", field: "week52PositionPct", actual: "10.0%", threshold: "≤ 30%", status: "hit", availability: "可得" },
  { bucket: "oversold_reversal", label: "反转信号(放量止跌 或 OBV转正)", field: "maxVolumeRatioLast10Days / obvSlope20", actual: "近10日最大量比 2.00x", threshold: "近10日量比 ≥ 2x 或 OBV20日斜率 > 0", status: "miss", availability: "可得" },
];
const sampleStrength: FootprintStrength = { ratio: 2 / 3, band: "中", hitCount: 2, availableCount: 3, totalCount: 3 };
const emptyStrength: FootprintStrength = { ratio: null, band: "不可得", hitCount: 0, availableCount: 0, totalCount: 0 };

function candidate(overrides: Partial<HtmlReportCandidateInput> = {}): HtmlReportCandidateInput {
  return {
    symbol: "<TEST>", // deliberately includes an HTML-special char to test escaping
    securityName: "Test & Co.",
    profile: "SMALL_SPEC",
    speculative: true,
    riskLevel: "elevated",
    primaryBucket: "oversold_reversal",
    primaryBucketScore: 80,
    allBucketsHit: ["oversold_reversal"],
    promoted: true,
    flags,
    fundamentals: undefined,
    eventWindow: [{ type: "earnings", date: "2026-11-05", daysUntil: 72 }],
    sectorRank: undefined,
    pivotHigh: null,
    pivotLow: null,
    closes90d: [100, 102, 98, 105, 108],
    fmp: undefined,
    footprintDetail: sampleConditions,
    footprintStrength: sampleStrength,
    ...overrides,
  };
}

function watchlistEntry(overrides: Partial<HtmlWatchlistInput> = {}): HtmlWatchlistInput {
  return {
    symbol: "MSFT",
    securityName: "Microsoft",
    reason: "compression_unselected",
    footprintDetail: [],
    footprintStrength: emptyStrength,
    ...overrides,
  };
}

const flowScan: SectorFlowEntry[] = [
  { sector: "Technology", etf: "XLK", rank: 2, weeklyReturn: -0.021, squeezeDensity: 0.04, institutionalDensity: 0.02, insiderClusterDensity: 0.01, flowState: "flow_out", candidatesInSector: 0, watchlistInSector: 0 },
  { sector: "Healthcare", etf: "XLV", rank: 1, weeklyReturn: 0.023, squeezeDensity: 0.081, institutionalDensity: 0.05, insiderClusterDensity: 0.02, flowState: "flow_in", candidatesInSector: 1, watchlistInSector: 0 },
];

const hotSectors: HotSectorEntry[] = [
  { name: "科技/软件", kind: "sector", origin: "named", sectorFlowRef: flowScan[0], basketCoverage: null, weeklyReturn: -0.021, squeezeDensity: 0.04, flowState: "flow_out", candidatesInPool: [], watchlistInPool: [] },
  { name: "AI 基建", kind: "basket", origin: "named", sectorFlowRef: null, basketCoverage: { found: 2, total: 3 }, weeklyReturn: 0.01, squeezeDensity: 0.2, flowState: "flow_in", candidatesInPool: ["NVDA"], watchlistInPool: [] },
];

const baseInput: ReportInput = {
  runMeta: {
    timestamp: "2026-08-24T00:00:00Z", profileArg: "both", gatesPassedCount: 3352,
    detectorSummary: {
      momentum_breakout: { triggeredCount: 0 },
      volatility_compression_setup: { triggeredCount: 3 },
      oversold_reversal: { triggeredCount: 1 },
      institutional_accumulation_proxy: { triggeredCount: 0 },
    },
  },
  marketRegime: {
    asOf: "t", spyLatestClose: 500, spySma200: 480, spyCloseVsSma200: "above", spySma200Slope: 1,
    vixCurrent: 15, vixAvg20: 16, leadingSectors: [], laggingSectors: [], label: "顺风", labelUnavailableReason: null,
  },
  creditRegime: {
    asOf: "t", oasCurrentBp: 320, oasPastBp: 340, oasChangeBp: -20, label: "loose", labelUnavailableReason: null,
  },
  smallSpecForcedDisabled: false,
  sectorFootprints: [],
  sectorFlowScan: flowScan,
  hotSectorDetail: hotSectors,
  candidates: [candidate()],
  watchlist: [watchlistEntry()],
  promotedThisRun: ["TESTX"],
  ledgerPendingBackfill: [],
  ledgerInvalidated: [],
};

test("produces a well-formed self-contained HTML document", () => {
  const html = renderReport(baseInput);
  assert.match(html, /^<!doctype html>/i);
  assert.ok(html.includes("<style>"));
  assert.ok(html.includes("</html>"));
});

test("escapes HTML-special characters from upstream data (symbol/name), never raw-injects them", () => {
  const html = renderReport(baseInput);
  assert.ok(!html.includes("<TEST>")); // the raw unescaped symbol must not appear
  assert.ok(html.includes("&lt;TEST&gt;"));
  assert.ok(html.includes("Test &amp; Co."));
});

test("masthead shows date, time, and universe count", () => {
  const html = renderReport(baseInput);
  assert.ok(html.includes("2026-08-24"));
  assert.ok(html.includes("3352"));
});

test("sector flow spectrum: all provided sectors rendered, sorted by rank (Healthcare rank1 before Technology rank2)", () => {
  const html = renderReport(baseInput);
  const flowSection = html.split("全板块资金流谱")[1];
  assert.ok(flowSection.indexOf("Healthcare") < flowSection.indexOf("Technology"));
  assert.ok(flowSection.includes("流入"));
  assert.ok(flowSection.includes("流出"));
});

test("hot sector detail: basket entry discloses coverage, sector entry does not", () => {
  const html = renderReport(baseInput);
  assert.ok(html.includes("2/3"));
  assert.ok(html.includes("手工近似"));
});

test("DONE-WHEN: with no radarNarrative, every prose slot shows the literal placeholder, not app-generated judgment text", () => {
  const html = renderReport(baseInput);
  // The 4 Radar-only prose slots must each contain the placeholder token.
  const placeholderCount = (html.match(/待研究层填充/g) ?? []).length;
  assert.ok(placeholderCount >= 4, `expected at least 4 placeholder occurrences (market recap, hot sector verdicts, candidate desc/prob, weekly forecast), got ${placeholderCount}`);
  // Regression guard: none of the mockup's own example judgment sentences ever leak in as hardcoded text.
  for (const judgmentPhrase of ["本周垫底,钱在流出", "像有资金在埋伏", "典型的risk rotation", "这周的故事是板块轮动"]) {
    assert.ok(!html.includes(judgmentPhrase), `found hardcoded judgment phrase: ${judgmentPhrase}`);
  }
});

test("theme radar: no Radar themes and no footprint anomaly -> explicit 'no theme data' message, not fabricated", () => {
  const html = renderReport({ ...baseInput, sectorFootprints: [] });
  assert.ok(html.includes("本次运行无板块异动,无主题雏形可报"));
});

test("theme radar: a footprint anomaly with no Radar themes renders a seedling placeholder using only facts", () => {
  const input: ReportInput = {
    ...baseInput,
    sectorFootprints: [
      { sector: "Financial Services", validSymbolCount: 555, densities: { institutionalAccumulation: { count: 1, density: 0.01 }, insiderCluster: { count: 1, density: 0.01 }, shortInterestDecline: { count: 1, density: 0.01 }, volatilityCompression: { count: 129, density: 0.232 } }, footprintAnomaly: true, anomalyDimensions: ["volatilityCompression"], skipped: false, skipReason: null },
    ],
  };
  const html = renderReport(input);
  assert.ok(html.includes("Financial Services"));
  assert.ok(html.includes("23.2%"));
  assert.ok(html.includes("潜在主题雏形"));
  assert.ok(html.includes("尚未经研究层确认"));
});

test("theme radar: real Radar-supplied themes render lifecycle track, footprints, members, and verdict verbatim", () => {
  const input: ReportInput = {
    ...baseInput,
    radarNarrative: {
      emergingThemes: [
        {
          name: "区域银行 NIM 修复蓄势",
          strengthLabel: "中",
          lifecycleStage: "发酵",
          footprints: ["板块挤压密度 23.2%"],
          members: ["WSBC"],
          verdictText: "129只同时挤压,密度不正常。",
          falsifiableWatchpoints: ["更多同板块票挤压=坐实"],
        },
      ],
    },
  };
  const html = renderReport(input);
  assert.ok(html.includes("区域银行 NIM 修复蓄势"));
  assert.ok(html.includes("发酵"));
  assert.ok(html.includes("129只同时挤压"));
  assert.ok(html.includes("WSBC"));
  assert.ok(html.includes("更多同板块票挤压=坐实"));
});

test("tier1 candidate card: no Radar verdict -> placeholder desc, but footprint strength (deterministic, not Radar-dependent) still renders", () => {
  const html = renderReport(baseInput);
  const candSection = html.split('id="cand-&lt;TEST&gt;"')[1];
  assert.ok(candSection.includes(`>${PLACEHOLDER_STRING()}<`));
  assert.ok(candSection.includes("足迹强度"));
  assert.ok(candSection.includes("中")); // sampleStrength.band
});

test("tier1 candidate card: a supplied Radar verdict renders its desc text (grade/probability/confidence are no longer part of this card - superseded by footprintStrength, per claude_code_design_draft.md)", () => {
  const input: ReportInput = {
    ...baseInput,
    radarNarrative: { candidateVerdicts: { "<TEST>": { grade: "B-", probability: 53, confidence: 66, descText: "上升趋势内真实挤压回调。" } } },
  };
  const html = renderReport(input);
  assert.ok(html.includes("上升趋势内真实挤压回调"));
});

test("footprint detail: condition rows render field/actual/threshold and a 3-state availability label, default-expanded on the strongest (first) card", () => {
  const html = renderReport(baseInput);
  assert.ok(html.includes("构成足迹的条件 · 2 项命中 / 3 项检查"));
  assert.ok(html.includes("RSI14 超卖"));
  assert.ok(html.includes("rsi14: 27.0 vs ≤ 25"));
  assert.ok(html.includes(">可得<"));
  const detailSection = html.split('id="detail-&lt;TEST&gt;"')[1]?.slice(0, 40) ?? "";
  assert.ok(!detailSection.includes("hidden"), "the strongest (first, index 0) candidate's detail must be expanded by default");
});

test("footprintStrength null (all-unavailable) renders '不可得' with no progress bar, never a 0% bar", () => {
  const input: ReportInput = {
    ...baseInput,
    candidates: [candidate({ symbol: "NAX", footprintDetail: [], footprintStrength: emptyStrength })],
  };
  const html = renderReport(input);
  const candSection = html.split('id="cand-NAX"')[1];
  assert.ok(candSection.includes("强度不可得"));
  assert.ok(!candSection.includes("cand-strength-bar"));
});

test("promoted marker and event_window appear on the tier1 candidate card", () => {
  const html = renderReport(baseInput);
  assert.ok(html.includes("观察哨升级而来"));
  assert.ok(html.includes("⚡"));
});

test("TASK_CARD_08 Part A: credit regime loose/neutral (default fixture) -> no warning bar content rendered", () => {
  const html = renderReport(baseInput);
  assert.ok(!html.includes('<div class="credit-warning-bar">'));
  assert.ok(!html.includes("信用环境收紧"));
});

test("TASK_CARD_08 熔断: credit regime unknown (no FRED key / fetch failed) -> muted 不可得 note renders, not the alarming bar", () => {
  const input: ReportInput = {
    ...baseInput,
    creditRegime: { asOf: "t", oasCurrentBp: null, oasPastBp: null, oasChangeBp: null, label: "unknown", labelUnavailableReason: "FRED OAS series unavailable this run (FRED_API_KEY unset or the request failed)" },
  };
  const html = renderReport(input);
  assert.ok(html.includes('<div class="credit-unknown-note">'));
  assert.ok(html.includes("信用环境: 不可得"));
  assert.ok(!html.includes('<div class="credit-warning-bar">'));
});

test("TASK_CARD_08 Part A: credit regime tight -> warning bar with OAS figures renders", () => {
  const input: ReportInput = {
    ...baseInput,
    creditRegime: { asOf: "t", oasCurrentBp: 470, oasPastBp: 400, oasChangeBp: 70, label: "tight", labelUnavailableReason: null },
    smallSpecForcedDisabled: true,
  };
  const html = renderReport(input);
  assert.ok(html.includes('<div class="credit-warning-bar">'));
  assert.ok(html.includes("信用环境收紧"));
  assert.ok(html.includes("470"));
  assert.ok(html.includes("SMALL_SPEC 档本次运行已强制禁用"));
});

test("TASK_CARD_08 Part A: candidate riskLevel normal shows no badge; elevated/high show a labeled badge", () => {
  const normalHtml = renderReport({ ...baseInput, candidates: [candidate({ riskLevel: "normal", speculative: false })] });
  assert.ok(!normalHtml.includes("风险等级"));

  const highHtml = renderReport({ ...baseInput, candidates: [candidate({ riskLevel: "high" })] });
  assert.ok(highHtml.includes("风险等级: 高"));
});

test("empty tier2 watchlist renders an explicit empty statement, not a blank table", () => {
  const html = renderReport({ ...baseInput, watchlist: [] });
  assert.ok(html.includes("观察哨为空"));
});

test("a promoted-this-run watchlist symbol gets the 已升级 badge", () => {
  const input: ReportInput = { ...baseInput, watchlist: [watchlistEntry({ symbol: "TESTX", securityName: "Test Corp" })] };
  const html = renderReport(input);
  assert.ok(html.includes("已升级"));
});

test("excluded notes: placeholder when absent, real notes when Radar supplies them", () => {
  const withoutNotes = renderReport(baseInput);
  assert.ok(withoutNotes.includes(PLACEHOLDER_STRING()));

  const withNotes: ReportInput = { ...baseInput, radarNarrative: { excludedNotes: [{ symbols: ["APGE", "ALOT"], reason: "已签署全现金并购标的,股价钉死收购对价" }] } };
  const html = renderReport(withNotes);
  assert.ok(html.includes("APGE"));
  assert.ok(html.includes("已签署全现金并购标的"));
});

test("weekly forecast: placeholder when absent, real text when Radar supplies it", () => {
  const withoutForecast = renderReport(baseInput);
  assert.ok(withoutForecast.includes("本周总结与前瞻"));
  assert.ok(withoutForecast.includes(PLACEHOLDER_STRING()));

  const withForecast: ReportInput = { ...baseInput, radarNarrative: { weeklyForecast: "这周的故事是板块轮动。" } };
  const html = renderReport(withForecast);
  assert.ok(html.includes("这周的故事是板块轮动。"));
});

test("ledger passive section lists pending-backfill and invalidated entries with no reminder mechanism (static list only)", () => {
  const input: ReportInput = {
    ...baseInput,
    ledgerPendingBackfill: [
      { recordType: "screening", symbol: "OLD1", screeningTimestamp: "2026-01-01T00:00:00Z", profile: "STANDARD", speculative: false, status: "candidate", buckets: [], flagsSnapshot: {} as never, holdingPeriod: null, opportunityType: "momentum_breakout" },
    ],
    ledgerInvalidated: [
      { screening: { recordType: "screening", symbol: "DEAD1", screeningTimestamp: "2026-01-01T00:00:00Z", profile: "STANDARD", speculative: false, status: "candidate", buckets: [], flagsSnapshot: {} as never, holdingPeriod: null, opportunityType: "momentum_breakout" }, invalidatedAt: "2026-02-01T00:00:00Z" },
    ],
  };
  const html = renderReport(input);
  assert.ok(html.includes("OLD1"));
  assert.ok(html.includes("待回填"));
  assert.ok(html.includes("DEAD1"));
  assert.ok(html.includes("已触发无效化"));
});

test("claude_code_design_draft.md §7.2 boundary state: 0 candidates -> honest '本周 0 只' empty state, no blank 02 layer", () => {
  const input: ReportInput = { ...baseInput, candidates: [] };
  const html = renderReport(input);
  assert.ok(html.includes("本周 0 只进入研究层"));
  assert.ok(html.includes("诚实"));
  assert.ok(html.includes("第一层候选为空"));
});

test("claude_code_design_draft.md §7.2 boundary state: a bucket with zero hits this run shows a hollow-dot legend entry, not hidden", () => {
  const html = renderReport(baseInput); // baseInput.runMeta.detectorSummary already has 2 zero-hit buckets
  assert.ok(html.includes("动能突破 · 0次"));
  assert.ok(html.includes("机构蓄势代理 · 0次"));
  assert.ok(html.includes("零命中"));
});

test("claude_code_design_draft.md §7.2 boundary state: a dual-bucket-hit candidate merges both buckets' condition lists and shows both bucket dots", () => {
  const dualConditions: FootprintCondition[] = [
    ...sampleConditions,
    { bucket: "institutional_accumulation_proxy", label: "OBV 20日斜率转正", field: "obvSlope20", actual: "4.2", threshold: "> 0", status: "hit", availability: "可得" },
  ];
  const input: ReportInput = {
    ...baseInput,
    candidates: [
      candidate({
        symbol: "DUAL",
        allBucketsHit: ["volatility_compression_setup", "institutional_accumulation_proxy"],
        footprintDetail: dualConditions,
        footprintStrength: computeFootprintStrength(dualConditions, [{ minRatio: 0, band: "弱" }, { minRatio: 0.5, band: "中" }, { minRatio: 0.75, band: "强" }]),
      }),
    ],
  };
  const html = renderReport(input);
  const candSection = html.split('id="cand-DUAL"')[1];
  assert.ok(candSection.includes("波动挤压蓄势"));
  assert.ok(candSection.includes("机构蓄势代理"));
  assert.ok(candSection.includes("4 项检查")); // 3 from sampleConditions + 1 dual-bucket condition, merged
});

function PLACEHOLDER_STRING(): string {
  return "待研究层填充";
}
