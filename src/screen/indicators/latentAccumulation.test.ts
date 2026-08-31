import { test } from "node:test";
import assert from "node:assert/strict";
import { rsLineNewHigh } from "./rsLineNewHigh.js";
import { volumeDryup } from "./volumeDryup.js";
import { aboveVwapStreak } from "./aboveVwapStreak.js";
import type { CleanBar } from "./series.js";

function bar(date: string, high: number, low: number, close: number, volume = 1000): CleanBar {
  return { date, open: close, high, low, close, volume };
}

// --- rsLineNewHigh ---

test("rsLineNewHigh: DONE-WHEN case - broad market falls, symbol flat -> ratio creates a new high, symbol's own price is not at a new high -> true", () => {
  const spyBars: CleanBar[] = [
    bar("2026-01-01", 101, 99, 100),
    bar("2026-01-02", 100, 98, 99),
    bar("2026-01-03", 99, 97, 98),
    bar("2026-01-04", 98, 96, 97),
    bar("2026-01-05", 97, 95, 96), // SPY falling every day
  ];
  const symbolBars: CleanBar[] = [
    bar("2026-01-01", 51, 49, 50),
    bar("2026-01-02", 51, 49, 50),
    bar("2026-01-03", 51, 49, 50),
    bar("2026-01-04", 51, 49, 50),
    bar("2026-01-05", 51, 49, 50), // symbol flat -> close/SPY ratio rises every day as SPY falls
  ];
  const result = rsLineNewHigh(symbolBars, spyBars, 5, false);
  assert.equal(result, true);
});

test("rsLineNewHigh: ratio at a new high but the symbol's own price is ALSO at a new high -> false (not the quiet-accumulation pattern)", () => {
  const spyBars: CleanBar[] = [
    bar("2026-01-01", 101, 99, 100),
    bar("2026-01-02", 100, 98, 99),
    bar("2026-01-03", 99, 97, 98),
    bar("2026-01-04", 98, 96, 97),
    bar("2026-01-05", 97, 95, 96),
  ];
  const symbolBars: CleanBar[] = [
    bar("2026-01-01", 51, 49, 50),
    bar("2026-01-02", 51, 49, 50),
    bar("2026-01-03", 51, 49, 50),
    bar("2026-01-04", 51, 49, 50),
    bar("2026-01-05", 51, 49, 50),
  ];
  const result = rsLineNewHigh(symbolBars, spyBars, 5, true);
  assert.equal(result, false);
});

test("rsLineNewHigh: symbol falls faster than SPY -> ratio is NOT at a new high -> false", () => {
  const spyBars: CleanBar[] = [
    bar("2026-01-01", 101, 99, 100),
    bar("2026-01-02", 100, 98, 99),
    bar("2026-01-03", 99, 97, 98),
    bar("2026-01-04", 98, 96, 97),
    bar("2026-01-05", 97, 95, 96),
  ];
  const symbolBars: CleanBar[] = [
    bar("2026-01-01", 51, 49, 50),
    bar("2026-01-02", 49, 47, 48),
    bar("2026-01-03", 47, 45, 46),
    bar("2026-01-04", 45, 43, 44),
    bar("2026-01-05", 43, 41, 42), // symbol falls faster than SPY -> ratio declines
  ];
  const result = rsLineNewHigh(symbolBars, spyBars, 5, false);
  assert.equal(result, false);
});

test("rsLineNewHigh: zero overlapping dates between symbol and SPY series -> null (不可得), not a fabricated false", () => {
  const spyBars: CleanBar[] = [bar("2026-01-01", 101, 99, 100)];
  const symbolBars: CleanBar[] = [bar("2099-01-01", 51, 49, 50)];
  assert.equal(rsLineNewHigh(symbolBars, spyBars, 5, false), null);
});

// --- volumeDryup ---

test("volumeDryup: a day within the lookback window drops to exactly the threshold ratio -> true (<=, not <)", () => {
  // avgWindow=3, lookbackDays=5, threshold=0.30 -> need 8 bars total.
  const bars: CleanBar[] = [
    bar("d1", 10, 9, 10, 1000),
    bar("d2", 10, 9, 10, 1000),
    bar("d3", 10, 9, 10, 1000), // trailing-3 avg for d4 = 1000
    bar("d4", 10, 9, 10, 1000),
    bar("d5", 10, 9, 10, 1000),
    bar("d6", 10, 9, 10, 1000), // trailing-3 avg for d7 = 1000
    bar("d7", 10, 9, 10, 300), // exactly 30% of trailing-3 avg (1000)
    bar("d8", 10, 9, 10, 1000),
  ];
  assert.equal(volumeDryup(bars, 5, 3, 0.3), true);
});

test("volumeDryup: no day drops below the threshold -> false", () => {
  const bars: CleanBar[] = Array.from({ length: 8 }, (_, i) => bar(`d${i}`, 10, 9, 10, 1000));
  assert.equal(volumeDryup(bars, 5, 3, 0.3), false);
});

test("volumeDryup: insufficient bars for avgWindow + lookbackDays -> null", () => {
  const bars: CleanBar[] = Array.from({ length: 4 }, (_, i) => bar(`d${i}`, 10, 9, 10, 1000));
  assert.equal(volumeDryup(bars, 5, 3, 0.3), null);
});

// --- aboveVwapStreak ---

test("aboveVwapStreak: close stays above its trailing rolling VWAP for every day of the streak window -> true", () => {
  // vwapWindow=3, streakDays=3 -> need 6 bars. Typical price (H+L+C)/3 kept low, close kept high, so close > vwap every day.
  const bars: CleanBar[] = [
    bar("d1", 10, 8, 9, 100),
    bar("d2", 10, 8, 9, 100),
    bar("d3", 10, 8, 9, 100),
    bar("d4", 10, 8, 20, 100), // close jumps well above typical price -> above VWAP
    bar("d5", 20, 18, 20, 100),
    bar("d6", 20, 18, 20, 100),
  ];
  assert.equal(aboveVwapStreak(bars, 3, 3), true);
});

test("aboveVwapStreak: one day in the streak window closes at/below its trailing VWAP -> false", () => {
  const bars: CleanBar[] = [
    bar("d1", 10, 8, 9, 100),
    bar("d2", 10, 8, 9, 100),
    bar("d3", 10, 8, 9, 100),
    bar("d4", 10, 8, 20, 100),
    bar("d5", 10, 8, 5, 100), // close well below typical price -> below VWAP, breaks the streak
    bar("d6", 20, 18, 20, 100),
  ];
  assert.equal(aboveVwapStreak(bars, 3, 3), false);
});

test("aboveVwapStreak: a zero-volume trailing window makes that day's VWAP undefined -> treated as not-above (false), not skipped", () => {
  const bars: CleanBar[] = [
    bar("d1", 10, 8, 9, 0),
    bar("d2", 10, 8, 9, 0),
    bar("d3", 10, 8, 9, 0),
    bar("d4", 10, 8, 20, 0),
    bar("d5", 10, 8, 20, 0),
    bar("d6", 10, 8, 20, 0),
  ];
  assert.equal(aboveVwapStreak(bars, 3, 3), false);
});

test("aboveVwapStreak: insufficient bars for vwapWindow + streakDays -> null", () => {
  const bars: CleanBar[] = Array.from({ length: 3 }, (_, i) => bar(`d${i}`, 10, 8, 9, 100));
  assert.equal(aboveVwapStreak(bars, 3, 3), null);
});
