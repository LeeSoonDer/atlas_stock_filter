import { test } from "node:test";
import assert from "node:assert/strict";
import { computeMarketRegime } from "./marketRegime.js";
import type { RegimeConfig } from "./types.js";
import type { SectorRanking } from "../sector/types.js";

const smallConfig: RegimeConfig = {
  regime: { spySmaWindow: 5, spySmaSlopeWindow: 3, vixAvgWindow: 3, vixElevatedThreshold: 30 },
};

const sectors: SectorRanking[] = [
  { sector: "A", etf: "XLA", oneWeekReturn: 0.02, oneMonthReturn: 0.1, threeMonthReturn: 0.1, compositeRank: 1, classification: "tailwind" },
  { sector: "B", etf: "XLB", oneWeekReturn: 0.01, oneMonthReturn: 0.05, threeMonthReturn: 0.05, compositeRank: 2, classification: "neutral" },
  { sector: "C", etf: "XLC", oneWeekReturn: -0.01, oneMonthReturn: -0.05, threeMonthReturn: -0.05, compositeRank: 3, classification: "headwind" },
];

test("computeMarketRegime: all 3 signals bullish -> 顺风, hand-traced SMA/slope", () => {
  // spyCloses: linear rise 10..16 (7 points). smaSeries(window=5) = [12,13,14].
  // slope of a perfectly linear 3-point series with step 1 = 1 (exact).
  // spySma200 (latest) = 14, spyLatestClose = 16 -> above.
  const spyCloses = [10, 11, 12, 13, 14, 15, 16];
  // vixCloses: [20,19,18] -> avg=19, current=18 -> below avg (bullish for regime).
  const vixCloses = [20, 19, 18];

  const result = computeMarketRegime(spyCloses, vixCloses, sectors, smallConfig);
  assert.equal(result.spySma200, 14);
  assert.equal(result.spySma200Slope, 1);
  assert.equal(result.spyCloseVsSma200, "above");
  assert.equal(result.vixCurrent, 18);
  assert.equal(result.vixAvg20, 19);
  assert.equal(result.label, "顺风");
});

test("computeMarketRegime: elevated VIX forces 逆风 regardless of trend", () => {
  const highVixConfig: RegimeConfig = { regime: { ...smallConfig.regime, vixElevatedThreshold: 15 } };
  const spyCloses = [10, 11, 12, 13, 14, 15, 16]; // same bullish trend as above
  const vixCloses = [20, 19, 18]; // vixCurrent=18 >= threshold 15
  const result = computeMarketRegime(spyCloses, vixCloses, sectors, highVixConfig);
  assert.equal(result.label, "逆风");
});

test("computeMarketRegime: insufficient history -> label null with a stated reason", () => {
  const result = computeMarketRegime([1, 2], [1, 2], sectors, smallConfig);
  assert.equal(result.label, null);
  assert.ok(result.labelUnavailableReason !== null);
});

test("computeMarketRegime: leading/lagging sectors pass through from the ranking, sorted", () => {
  const spyCloses = [10, 11, 12, 13, 14, 15, 16];
  const vixCloses = [20, 19, 18];
  const result = computeMarketRegime(spyCloses, vixCloses, sectors, smallConfig);
  assert.equal(result.leadingSectors.length, 1);
  assert.equal(result.leadingSectors[0].sector, "A");
  assert.equal(result.laggingSectors.length, 1);
  assert.equal(result.laggingSectors[0].sector, "C");
});
