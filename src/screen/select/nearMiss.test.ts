import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkNearMissMomentumBreakout,
  checkNearMissVolatilityCompression,
  checkNearMissOversoldReversal,
  checkNearMissInstitutionalAccumulation,
} from "./nearMiss.js";
import type { IndicatorFlags, DetectorsConfig } from "../indicators/types.js";

const baseFlags: IndicatorFlags = {
  sma20: null, sma50: 100, sma200: 90, smaAlignedBullish: true,
  rsi14: 50, atr14: null, atrPct: null,
  week52High: null, week52Low: null, week52PositionPct: 0.5, pctOf52WeekHigh: 0.99,
  volumeAvg20: 80, volumeAvg50: 100, volumeRatioLatest: null,
  maxVolumeRatioLast5Days: 2, maxVolumeRatioLast10Days: 1,
  obvLatest: null, obvSlope20: -5,
  bbWidthLatest: null, bbWidthPercentile120: 10, sidewaysBaseDays: 0,
  threeMonthReturn: null, sixMonthReturn: null, rs3MonthPercentile: null, rs6MonthPercentile: 90,
  tradingDaysAvailable: 300, latestClose: 105,
  insiderCluster: false, insiderClusterDistinctBuyers: null, insiderClusterLagDays: null,
  institutionalTrend: null, institutionalTrendAvailability: "不可得",
  shortInterestChangePercent: 0, shortInterestDaysToCover: null, shortInterestPercentOfFloat: null,
  shortInterestLagDays: null, shortInterestAvailability: "可得",
};

const config: DetectorsConfig = {
  indicators: {} as never,
  detectorA_momentumBreakout: { pctOf52WeekHigh: 0.95, volumeRatioThreshold: 1.8, volumeRatioLookbackDays: 5, rs6MonthPercentileThreshold: 80 },
  detectorB_volatilityCompression: { bbWidthPercentileThreshold: 20, proximityTo52WeekHighPct: 0.15, sidewaysBaseMinDays: 30, volumeContractionRatioThreshold: 1 },
  detectorC_oversoldReversal: { rsiThresholdStandard: 30, rsiThresholdSmallSpec: 25, week52PositionThreshold: 0.3, stopLossVolumeRatioThreshold: 2, stopLossLookbackDays: 10 },
  detectorD_institutionalAccumulation: { minConditionsRequired: 2, shortInterestSignificantDeclinePercent: 15, squeezeMinFloatPercent: 15 },
};

test("momentum breakout near-miss: other conditions hold, pctOf52WeekHigh within 10% grace", () => {
  const flags = { ...baseFlags, pctOf52WeekHigh: 0.90 }; // 0.90 < 0.95 threshold but >= 0.95*0.9=0.855
  const result = checkNearMissMomentumBreakout(flags, config);
  assert.ok(result !== null);
  assert.equal(result!.detectorId, "momentum_breakout");
});

test("momentum breakout: already triggered -> not a near miss (null)", () => {
  const result = checkNearMissMomentumBreakout(baseFlags, config); // pctOf52WeekHigh=0.99 >= 0.95
  assert.equal(result, null);
});

test("momentum breakout: outside the grace band -> null", () => {
  const flags = { ...baseFlags, pctOf52WeekHigh: 0.5 };
  assert.equal(checkNearMissMomentumBreakout(flags, config), null);
});

test("momentum breakout: other condition (volume) fails -> not a near miss even if price is close", () => {
  const flags = { ...baseFlags, pctOf52WeekHigh: 0.90, maxVolumeRatioLast5Days: 0.5 };
  assert.equal(checkNearMissMomentumBreakout(flags, config), null);
});

test("volatility compression near-miss: bbWidthPercentile120 slightly above threshold, others hold", () => {
  const flags = { ...baseFlags, bbWidthPercentile120: 21, pctOf52WeekHigh: 0.9, latestClose: 105, sma200: 90, volumeAvg20: 50, volumeAvg50: 100 }; // 21 <= 20*1.1=22
  const result = checkNearMissVolatilityCompression(flags, config);
  assert.ok(result !== null);
});

test("oversold reversal near-miss: RSI slightly above threshold, others hold", () => {
  const flags = { ...baseFlags, rsi14: 32, week52PositionPct: 0.2, maxVolumeRatioLast10Days: 3 }; // 32 <= 30*1.1=33
  const result = checkNearMissOversoldReversal(flags, "STANDARD", config);
  assert.ok(result !== null);
});

test("institutional accumulation near-miss: exactly one condition short", () => {
  const flags = { ...baseFlags, insiderCluster: true, obvSlope20: 100 }; // 2 conditions met = 2, already >= minConditionsRequired... need exactly 1
  // Reset to exactly 1 condition met: insiderCluster true, everything else false/negative
  const oneCondition = { ...baseFlags, insiderCluster: true, obvSlope20: -5, shortInterestChangePercent: 0, institutionalTrend: null };
  const result = checkNearMissInstitutionalAccumulation(oneCondition, config);
  assert.ok(result !== null);
  assert.equal(result!.currentValue, 1);
});

test("institutional accumulation: 2+ conditions met -> already triggered, not a near miss", () => {
  const flags = { ...baseFlags, insiderCluster: true, obvSlope20: 100 };
  assert.equal(checkNearMissInstitutionalAccumulation(flags, config), null);
});

test("institutional accumulation: zero conditions met -> more than one short, not a near miss", () => {
  assert.equal(checkNearMissInstitutionalAccumulation(baseFlags, config), null);
});
