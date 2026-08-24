import { test } from "node:test";
import assert from "node:assert/strict";
import { institutionalAccumulationDetector } from "./institutionalAccumulation.js";
import type { IndicatorFlags, DetectorsConfig } from "../indicators/types.js";

const baseFlags: IndicatorFlags = {
  sma20: null, sma50: 100, sma200: null, smaAlignedBullish: null,
  rsi14: null, atr14: null, atrPct: null,
  week52High: null, week52Low: null, week52PositionPct: null, pctOf52WeekHigh: null,
  volumeAvg20: null, volumeAvg50: null, volumeRatioLatest: null,
  maxVolumeRatioLast5Days: null, maxVolumeRatioLast10Days: null,
  obvLatest: null, obvSlope20: null,
  bbWidthLatest: null, bbWidthPercentile120: null, sidewaysBaseDays: null,
  threeMonthReturn: null, sixMonthReturn: null, rs3MonthPercentile: null, rs6MonthPercentile: null,
  tradingDaysAvailable: 300, latestClose: 105,
  insiderCluster: null, insiderClusterDistinctBuyers: null, insiderClusterLagDays: null,
  institutionalTrend: null, institutionalTrendAvailability: "不可得",
  shortInterestChangePercent: null, shortInterestDaysToCover: null, shortInterestPercentOfFloat: null,
  shortInterestLagDays: null, shortInterestAvailability: "不可得",
};

const config: DetectorsConfig = {
  indicators: {} as never,
  detectorA_momentumBreakout: {} as never,
  detectorB_volatilityCompression: {} as never,
  detectorC_oversoldReversal: {} as never,
  detectorD_institutionalAccumulation: {
    minConditionsRequired: 2,
    shortInterestSignificantDeclinePercent: 15,
    squeezeMinFloatPercent: 15,
  },
};

test("Detector D: insiderCluster + OBV positive (2 conditions) -> triggered", () => {
  const flags: IndicatorFlags = { ...baseFlags, insiderCluster: true, obvSlope20: 500 };
  const result = institutionalAccumulationDetector.detect(flags, "STANDARD", config);
  assert.equal(result.triggered, true);
  assert.equal((result.evidence as { conditionsMet: number }).conditionsMet, 2);
  assert.equal(result.strengthScore, 50);
});

test("Detector D: only 1 condition met -> not triggered", () => {
  const flags: IndicatorFlags = { ...baseFlags, insiderCluster: true };
  const result = institutionalAccumulationDetector.detect(flags, "STANDARD", config);
  assert.equal(result.triggered, false);
  assert.equal(result.strengthScore, null);
});

test("Detector D: short interest significant decline counts as one condition", () => {
  const flags: IndicatorFlags = { ...baseFlags, shortInterestChangePercent: -20, institutionalTrend: "up", institutionalTrendAvailability: "可得" };
  const result = institutionalAccumulationDetector.detect(flags, "STANDARD", config);
  assert.equal(result.triggered, true);
});

test("Detector D: squeeze setup (SI >= float threshold AND price >= SMA50) counts as one condition", () => {
  const flags: IndicatorFlags = { ...baseFlags, shortInterestPercentOfFloat: 20, sma50: 100, latestClose: 105, obvSlope20: 10 };
  const result = institutionalAccumulationDetector.detect(flags, "STANDARD", config);
  assert.equal(result.triggered, true); // squeeze + OBV positive = 2 conditions
});

test("Detector D: squeeze setup fails if price is below SMA50 despite high SI%float", () => {
  const flags: IndicatorFlags = { ...baseFlags, shortInterestPercentOfFloat: 20, sma50: 100, latestClose: 90, obvSlope20: 10 };
  const result = institutionalAccumulationDetector.detect(flags, "STANDARD", config);
  assert.equal(result.triggered, false); // only OBV condition met = 1
});

test("Detector D: all-null institutional data -> zero conditions met, not triggered", () => {
  const result = institutionalAccumulationDetector.detect(baseFlags, "STANDARD", config);
  assert.equal(result.triggered, false);
  assert.equal((result.evidence as { conditionsMet: number }).conditionsMet, 0);
});
