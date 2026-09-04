import { test } from "node:test";
import assert from "node:assert/strict";
import { computeVitality, dailyRvolSeries } from "./computeVitality.js";
import type { VitalityConfig } from "./computeVitality.js";
import type { CleanBar } from "../indicators/series.js";

function bar(date: string, volume: number): CleanBar {
  return { date, open: 10, high: 10, low: 10, close: 10, volume };
}

const config: VitalityConfig = {
  vitality: { avgWindow: 5, medianLookbackDays: 3, medianMin: 0.8, activeLookbackDays: 6, activeRvolThreshold: 1.2, activeDaysMin: 2 },
};

test("dailyRvolSeries: each day's volume over its own trailing avgWindow-day average (rolling window, includes prior test days once they enter the trailing range)", () => {
  // 5 warm-up days at volume 100 (avg=100), then 3 test days: 100, 150, 50.
  // d8's own trailing-5 window is [d3..d7] = [100,100,100,100,150], avg=110 -
  // it rolls in d7's elevated volume, not just the flat warmup.
  const bars: CleanBar[] = [
    bar("d1", 100), bar("d2", 100), bar("d3", 100), bar("d4", 100), bar("d5", 100),
    bar("d6", 100), bar("d7", 150), bar("d8", 50),
  ];
  const series = dailyRvolSeries(bars, 3, 5);
  assert.deepEqual(series.map((v) => Number(v.toFixed(4))), [1, 1.5, Number((50 / 110).toFixed(4))]);
});

test("dailyRvolSeries: insufficient bars for avgWindow + lookbackDays -> empty", () => {
  const bars: CleanBar[] = Array.from({ length: 4 }, (_, i) => bar(`d${i}`, 100));
  assert.deepEqual(dailyRvolSeries(bars, 3, 5), []);
});

test("computeVitality: passes when both real thresholds are met (DONE-WHEN spot-check shape)", () => {
  // avgWindow=5, need 5 warmup + 6 active-lookback days = 11 bars minimum.
  // Every active-window day trades at 3x the flat 100-volume warmup/baseline -
  // even as the rolling trailing average climbs from picking up prior active
  // days, 300 stays comfortably above it, so the outcome doesn't hinge on
  // precise overlap arithmetic the way a marginal fixture would.
  const bars: CleanBar[] = [
    ...Array.from({ length: 5 }, (_, i) => bar(`w${i}`, 100)), // warmup, avg=100
    bar("a1", 300), bar("a2", 300), bar("a3", 300), bar("a4", 300), bar("a5", 300), bar("a6", 300),
  ];
  const result = computeVitality(bars, config);
  assert.equal(result.dataAvailable, true);
  // Later active days' own trailing average has absorbed enough prior 300-
  // volume active days that their ratio converges toward 1 - this is
  // correct rolling-window behavior (not every one of the 6 stays >1.2),
  // the fixture only needs to clear activeDaysMin.
  assert.ok(result.rvolActiveDays20d! >= config.vitality.activeDaysMin);
  assert.ok(result.rvolMedian10d! >= config.vitality.medianMin);
  assert.equal(result.passed, true);
});

test("computeVitality: fails the median floor even when active-day count would pass (both must be satisfied)", () => {
  const bars: CleanBar[] = [
    ...Array.from({ length: 5 }, (_, i) => bar(`w${i}`, 100)),
    bar("a1", 10), bar("a2", 10), bar("a3", 300), bar("a4", 10), bar("a5", 300), bar("a6", 10),
    // median lookback = last 3 of these (a4,a5,a6): ratios low,high,low -> median low, well under 0.8
  ];
  const result = computeVitality(bars, config);
  assert.equal(result.dataAvailable, true);
  assert.ok(result.rvolMedian10d! < config.vitality.medianMin);
  assert.equal(result.passed, false);
});

test("computeVitality: a real dead-stock shape (flat, unchanging low volume) fails both thresholds", () => {
  const bars: CleanBar[] = Array.from({ length: 15 }, (_, i) => bar(`d${i}`, 50)); // perfectly flat volume -> ratio always 1.0 actually... use declining instead
  // Rebuild: declining volume so trailing avg > current day consistently -> ratio < 1
  const declining: CleanBar[] = [
    bar("w0", 500), bar("w1", 400), bar("w2", 300), bar("w3", 200), bar("w4", 100),
    bar("a1", 30), bar("a2", 30), bar("a3", 30), bar("a4", 30), bar("a5", 30), bar("a6", 30),
  ];
  const result = computeVitality(declining, config);
  assert.equal(result.passed, false);
  void bars;
});

test("computeVitality: insufficient history -> dataAvailable false, passed false (never a fabricated pass)", () => {
  const bars: CleanBar[] = Array.from({ length: 4 }, (_, i) => bar(`d${i}`, 100));
  const result = computeVitality(bars, config);
  assert.equal(result.dataAvailable, false);
  assert.equal(result.passed, false);
  assert.equal(result.rvolMedian10d, null);
});
