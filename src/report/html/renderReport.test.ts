import { test } from "node:test";
import assert from "node:assert/strict";
import { renderReport } from "./renderReport.js";
import type { HtmlReportCandidateInput, ReportInput } from "./types.js";
import type { IndicatorFlags } from "../../screen/indicators/types.js";

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

const baseInput: ReportInput = {
  runMeta: { timestamp: "2026-08-24T00:00:00Z", profileArg: "both", gatesPassedCount: 3352 },
  marketRegime: {
    asOf: "t", spyLatestClose: 500, spySma200: 480, spyCloseVsSma200: "above", spySma200Slope: 1,
    vixCurrent: 15, vixAvg20: 16, leadingSectors: [], laggingSectors: [], label: "顺风", labelUnavailableReason: null,
  },
  sectorFootprints: [],
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

test("DONE-WHEN design constraint: no gradients, purple/violet keywords, or nested-card AI-slop patterns", () => {
  const html = renderReport(baseInput);
  assert.ok(!/gradient/i.test(html));
  assert.ok(!/purple|violet/i.test(html));
  assert.ok(!/\.card\s+\.card/.test(html)); // no nested .card-inside-.card selector
});

test("renders semantic labels alongside raw values (RSI example from the card)", () => {
  const html = renderReport(baseInput);
  assert.ok(html.includes("27") && html.includes("超卖"));
});

test("SMALL_SPEC speculative warning badge appears for a speculative candidate", () => {
  const html = renderReport(baseInput);
  assert.ok(html.includes("投机警示"));
});

test("promoted badge and event_window highlight appear", () => {
  const html = renderReport(baseInput);
  assert.ok(html.includes("PROMOTED"));
  assert.ok(html.includes("⚡"));
  assert.ok(html.includes("72天后"));
});

test("empty watchlist renders an explicit empty statement, not a blank table", () => {
  const html = renderReport({ ...baseInput, watchlist: [] });
  assert.ok(html.includes("观察哨为空"));
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
