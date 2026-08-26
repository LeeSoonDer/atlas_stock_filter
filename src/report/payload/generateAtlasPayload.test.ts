import { test } from "node:test";
import assert from "node:assert/strict";
import { generateAtlasPayload } from "./generateAtlasPayload.js";
import type { PayloadCandidateInput, PayloadInput } from "./types.js";
import type { IndicatorFlags } from "../../screen/indicators/types.js";

const flags: IndicatorFlags = {
  sma20: 100, sma50: 95, sma200: 90, smaAlignedBullish: true,
  rsi14: 65, atr14: 2.5, atrPct: 0.025,
  week52High: 120, week52Low: 80, week52PositionPct: 0.5, pctOf52WeekHigh: 0.9,
  volumeAvg20: 1000000, volumeAvg50: 900000, volumeRatioLatest: 1.5,
  maxVolumeRatioLast5Days: 2, maxVolumeRatioLast10Days: 2,
  obvLatest: 5000000, obvSlope20: 1000,
  bbWidthLatest: 0.1, bbWidthPercentile120: 15, sidewaysBaseDays: 10,
  threeMonthReturn: 0.1, sixMonthReturn: 0.2, rs3MonthPercentile: 70, rs6MonthPercentile: 85,
  tradingDaysAvailable: 260, latestClose: 108,
  insiderCluster: true, insiderClusterDistinctBuyers: 2, insiderClusterLagDays: 5,
  institutionalTrend: "up", institutionalTrendAvailability: "可得",
  shortInterestChangePercent: -20, shortInterestDaysToCover: 1.5, shortInterestPercentOfFloat: 12,
  shortInterestLagDays: 20, shortInterestAvailability: "可得",
};

function candidate(overrides: Partial<PayloadCandidateInput> = {}): PayloadCandidateInput {
  return {
    symbol: "AAPL",
    securityName: "Apple Inc.",
    profile: "STANDARD",
    speculative: false,
    primaryBucket: "momentum_breakout",
    primaryBucketScore: 85,
    allBucketsHit: ["momentum_breakout"],
    promoted: false,
    flags,
    fundamentals: undefined,
    eventWindow: undefined,
    sectorRank: undefined,
    pivotHigh: { date: "2026-08-01", price: 115 },
    pivotLow: { date: "2026-07-15", price: 95 },
    ...overrides,
  };
}

const baseInput: PayloadInput = {
  runMeta: { timestamp: "2026-08-24T00:00:00Z", profileArg: "both", gatesPassedCount: 3352 },
  marketRegime: {
    asOf: "2026-08-24T00:00:00Z",
    spyLatestClose: 500, spySma200: 480, spyCloseVsSma200: "above", spySma200Slope: 1.2,
    vixCurrent: 15, vixAvg20: 16,
    leadingSectors: [], laggingSectors: [],
    label: "顺风", labelUnavailableReason: null,
  },
  sectorFootprints: [],
  sectorFlowScan: [],
  hotSectorDetail: [],
  candidates: [candidate()],
};

test("includes run metadata, regime snapshot, and candidate section headers", () => {
  const output = generateAtlasPayload(baseInput);
  assert.ok(output.includes("ATLAS PAYLOAD"));
  assert.ok(output.includes("市场环境快照"));
  assert.ok(output.includes("顺风"));
  assert.ok(output.includes("AAPL"));
  assert.ok(output.includes("Apple Inc."));
});

test("includes every IndicatorFlags key in the full-flags dump", () => {
  const output = generateAtlasPayload(baseInput);
  for (const key of Object.keys(flags)) {
    assert.ok(output.includes(`${key}:`), `missing flag key: ${key}`);
  }
});

test("includes pivot high/low with date and price", () => {
  const output = generateAtlasPayload(baseInput);
  assert.ok(output.includes("115"));
  assert.ok(output.includes("2026-08-01"));
  assert.ok(output.includes("95"));
  assert.ok(output.includes("2026-07-15"));
});

test("event_window entries appear when present", () => {
  const input: PayloadInput = { ...baseInput, candidates: [candidate({ eventWindow: [{ type: "earnings", date: "2026-11-05", daysUntil: 72 }] })] };
  const output = generateAtlasPayload(input);
  assert.ok(output.includes("earnings"));
  assert.ok(output.includes("2026-11-05"));
  assert.ok(output.includes("72天后"));
});

test("sector footprint anomaly summary lists only flagged sectors with their triggered dimensions", () => {
  const input: PayloadInput = {
    ...baseInput,
    sectorFootprints: [
      { sector: "Technology", validSymbolCount: 500, densities: { institutionalAccumulation: { count: 80, density: 0.16 }, insiderCluster: { count: 10, density: 0.02 }, shortInterestDecline: { count: 20, density: 0.04 }, volatilityCompression: { count: 5, density: 0.01 } }, footprintAnomaly: true, anomalyDimensions: ["institutionalAccumulation"], skipped: false, skipReason: null },
      { sector: "Energy", validSymbolCount: 100, densities: { institutionalAccumulation: { count: 5, density: 0.05 }, insiderCluster: { count: 5, density: 0.05 }, shortInterestDecline: { count: 5, density: 0.05 }, volatilityCompression: { count: 5, density: 0.05 } }, footprintAnomaly: false, anomalyDimensions: [], skipped: false, skipReason: null },
    ],
    candidates: [],
  };
  const output = generateAtlasPayload(input);
  assert.ok(output.includes("Technology"));
  assert.ok(output.includes("institutionalAccumulation"));
  assert.ok(!output.includes("Energy:")); // non-anomaly sector not listed in the summary
});

test("no sector anomalies -> explicit 'none this run' statement, not an empty section", () => {
  const output = generateAtlasPayload(baseInput); // sectorFootprints: []
  assert.ok(output.includes("本次运行无板块标记"));
});

test("sector_flow_scan section lists sectors sorted by rank with weekly return, densities, flow state, and pool counts", () => {
  const input: PayloadInput = {
    ...baseInput,
    sectorFlowScan: [
      { sector: "Technology", etf: "XLK", rank: 2, weeklyReturn: -0.021, squeezeDensity: 0.042, institutionalDensity: 0.03, insiderClusterDensity: 0.01, flowState: "flow_out", candidatesInSector: 1, watchlistInSector: 2 },
      { sector: "Healthcare", etf: "XLV", rank: 1, weeklyReturn: 0.023, squeezeDensity: 0.081, institutionalDensity: 0.05, insiderClusterDensity: 0.02, flowState: "flow_in", candidatesInSector: 2, watchlistInSector: 0 },
    ],
  };
  const output = generateAtlasPayload(input);
  const flowSection = output.split("== 全板块资金流谱")[1].split("== 热门领域详述")[0];
  // Healthcare (rank 1) must appear before Technology (rank 2) - sorted by rank.
  assert.ok(flowSection.indexOf("Healthcare") < flowSection.indexOf("Technology"));
  assert.ok(flowSection.includes("2.30%")); // weeklyReturn formatted as a percentage
  assert.ok(flowSection.includes("流入"));
  assert.ok(flowSection.includes("流出"));
});

test("hot sector detail: basket entries disclose coverage; sector entries do not", () => {
  const input: PayloadInput = {
    ...baseInput,
    hotSectorDetail: [
      { name: "AI 基建", kind: "basket", origin: "named", sectorFlowRef: null, basketCoverage: { found: 2, total: 3 }, weeklyReturn: 0.01, squeezeDensity: 0.2, flowState: "flow_in", candidatesInPool: ["NVDA"], watchlistInPool: [] },
      { name: "科技/软件", kind: "sector", origin: "named", sectorFlowRef: null, basketCoverage: null, weeklyReturn: -0.02, squeezeDensity: 0.04, flowState: "flow_out", candidatesInPool: [], watchlistInPool: [] },
    ],
  };
  const output = generateAtlasPayload(input);
  assert.ok(output.includes("2/3"));
  assert.ok(output.includes("手工近似"));
  assert.ok(output.includes("NVDA"));
  assert.ok(output.includes("进候选池: 无")); // 科技/软件 has no candidates this run
});
