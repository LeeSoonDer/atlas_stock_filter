import { test } from "node:test";
import assert from "node:assert/strict";
import { selectWatchlist } from "./selectWatchlist.js";
import type { SelectableSymbol, SelectConfig } from "./types.js";
import type { IndicatorFlags, DetectorsConfig } from "../indicators/types.js";

const config: SelectConfig = { select: { maxCandidates: 5, maxWatchlist: 3 }, footprintStrengthBands: [{ minRatio: 0, band: "弱" }] };

const nullFlags: IndicatorFlags = {
  sma20: null, sma50: null, sma200: null, smaAlignedBullish: null,
  rsi14: null, atr14: null, atrPct: null,
  week52High: null, week52Low: null, week52PositionPct: null, pctOf52WeekHigh: null,
  volumeAvg20: null, volumeAvg50: null, volumeRatioLatest: null,
  maxVolumeRatioLast5Days: null, maxVolumeRatioLast10Days: null,
  obvLatest: null, obvSlope20: null,
  bbWidthLatest: null, bbWidthPercentile120: null, sidewaysBaseDays: null,
  threeMonthReturn: null, sixMonthReturn: null, rs3MonthPercentile: null, rs6MonthPercentile: null,
  tradingDaysAvailable: 0, latestClose: null,
  insiderCluster: null, insiderClusterDistinctBuyers: null, insiderClusterLagDays: null,
  institutionalTrend: null, institutionalTrendAvailability: "不可得",
  shortInterestChangePercent: null, shortInterestDaysToCover: null, shortInterestPercentOfFloat: null,
  shortInterestLagDays: null, shortInterestAvailability: "不可得",
  rsLineNewHigh: null, volumeDryup: null, aboveVwapStreak: null, insiderClusterWeightedScore: null,
};

const detectorsConfig: DetectorsConfig = {
  indicators: {} as never,
  detectorA_momentumBreakout: { pctOf52WeekHigh: 0.95, volumeRatioThreshold: 1.8, volumeRatioLookbackDays: 5, rs6MonthPercentileThreshold: 80 },
  detectorB_volatilityCompression: { bbWidthPercentileThreshold: 20, proximityTo52WeekHighPct: 0.15, sidewaysBaseMinDays: 30, volumeContractionRatioThreshold: 1 },
  detectorC_oversoldReversal: { rsiThresholdStandard: 30, rsiThresholdSmallSpec: 25, week52PositionThreshold: 0.3, stopLossVolumeRatioThreshold: 2, stopLossLookbackDays: 10 },
  detectorD_institutionalAccumulation: { minConditionsRequired: 2, shortInterestSignificantDeclinePercent: 15, squeezeMinFloatPercent: 15 },
  latentAccumulation: { strengthBonusPerFlag: 5 },
};

function sym(symbol: string, buckets: string[], bucketScores: Record<string, number>, flags: Partial<IndicatorFlags> = {}): SelectableSymbol {
  return { symbol, profile: "STANDARD", buckets, bucketScores, flags: { ...nullFlags, ...flags } };
}

test("compression-bucket-hit symbols not selected as candidates get watchlist priority, sorted by score", () => {
  const symbols: SelectableSymbol[] = [
    sym("Comp1", ["volatility_compression_setup"], { volatility_compression_setup: 40 }),
    sym("Comp2", ["volatility_compression_setup"], { volatility_compression_setup: 80 }),
    sym("AlreadyCandidate", ["volatility_compression_setup"], { volatility_compression_setup: 99 }),
  ];
  const watchlist = selectWatchlist(symbols, new Set(["AlreadyCandidate"]), detectorsConfig, config);
  assert.deepEqual(
    watchlist.map((w) => w.symbol),
    ["Comp2", "Comp1"],
  );
  assert.ok(watchlist.every((w) => w.reason === "compression_unselected"));
});

test("near-miss symbols fill remaining slots after compression-unselected, sorted by closeness", () => {
  const symbols: SelectableSymbol[] = [
    sym("Comp1", ["volatility_compression_setup"], { volatility_compression_setup: 40 }),
    sym("NearFar", [], {}, { smaAlignedBullish: true, maxVolumeRatioLast5Days: 2, rs6MonthPercentile: 80, pctOf52WeekHigh: 0.86 }), // ~9.5% away
    sym("NearClose", [], {}, { smaAlignedBullish: true, maxVolumeRatioLast5Days: 2, rs6MonthPercentile: 80, pctOf52WeekHigh: 0.94 }), // ~1% away
  ];
  const watchlist = selectWatchlist(symbols, new Set(), detectorsConfig, config);
  assert.deepEqual(
    watchlist.map((w) => w.symbol),
    ["Comp1", "NearClose", "NearFar"],
  );
});

test("maxWatchlist caps the total across both passes", () => {
  const symbols: SelectableSymbol[] = Array.from({ length: 10 }, (_, i) => sym(`Comp${i}`, ["volatility_compression_setup"], { volatility_compression_setup: i }));
  const watchlist = selectWatchlist(symbols, new Set(), detectorsConfig, config); // maxWatchlist=3
  assert.equal(watchlist.length, 3);
});

test("a symbol already hitting some other bucket (fully triggered, just unselected) is not double-counted as a near miss", () => {
  const symbols: SelectableSymbol[] = [sym("Triggered", ["oversold_reversal"], { oversold_reversal: 50 })];
  const watchlist = selectWatchlist(symbols, new Set(), detectorsConfig, config);
  assert.equal(watchlist.length, 0); // not compression, and assignPrimaryBucket !== null excludes it from near-miss checks
});
