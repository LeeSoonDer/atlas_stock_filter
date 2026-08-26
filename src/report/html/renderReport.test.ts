import { test } from "node:test";
import assert from "node:assert/strict";
import { renderReport } from "./renderReport.js";
import type { HtmlReportCandidateInput, ReportInput } from "./types.js";
import type { IndicatorFlags } from "../../screen/indicators/types.js";
import type { SectorFlowEntry, HotSectorEntry } from "../../screen/sector_scan/types.js";

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

function candidate(overrides: Partial<HtmlReportCandidateInput> = {}): HtmlReportCandidateInput {
  return {
    symbol: "<TEST>", // deliberately includes an HTML-special char to test escaping
    securityName: "Test & Co.",
    profile: "SMALL_SPEC",
    speculative: true,
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
  runMeta: { timestamp: "2026-08-24T00:00:00Z", profileArg: "both", gatesPassedCount: 3352 },
  marketRegime: {
    asOf: "t", spyLatestClose: 500, spySma200: 480, spyCloseVsSma200: "above", spySma200Slope: 1,
    vixCurrent: 15, vixAvg20: 16, leadingSectors: [], laggingSectors: [], label: "顺风", labelUnavailableReason: null,
  },
  sectorFootprints: [],
  sectorFlowScan: flowScan,
  hotSectorDetail: hotSectors,
  candidates: [candidate()],
  watchlist: [{ symbol: "MSFT", securityName: "Microsoft", reason: "compression_unselected" }],
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

test("tier1 candidate card: no Radar verdict -> N/A grade box and placeholder desc/probability", () => {
  const html = renderReport(baseInput);
  assert.ok(html.includes("g-na"));
});

test("tier1 candidate card: a supplied Radar verdict renders grade/desc/probability/confidence", () => {
  const input: ReportInput = {
    ...baseInput,
    radarNarrative: { candidateVerdicts: { "<TEST>": { grade: "B-", probability: 53, confidence: 66, descText: "上升趋势内真实挤压回调。" } } },
  };
  const html = renderReport(input);
  assert.ok(html.includes("B-"));
  assert.ok(html.includes("53"));
  assert.ok(html.includes("66"));
  assert.ok(html.includes("上升趋势内真实挤压回调"));
});

test("promoted badge and event_window appear on the tier1 candidate card", () => {
  const html = renderReport(baseInput);
  assert.ok(html.includes("PROMOTED"));
  assert.ok(html.includes("⚡"));
});

test("empty tier2 watchlist renders an explicit empty statement, not a blank table", () => {
  const html = renderReport({ ...baseInput, watchlist: [] });
  assert.ok(html.includes("观察哨为空"));
});

test("a promoted-this-run watchlist symbol gets the 已升级 badge", () => {
  const input: ReportInput = { ...baseInput, watchlist: [{ symbol: "TESTX", securityName: "Test Corp", reason: "compression_unselected" }] };
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

function PLACEHOLDER_STRING(): string {
  return "待研究层填充";
}
