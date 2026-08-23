import { test } from "node:test";
import assert from "node:assert/strict";
import { sma } from "./sma.js";
import { rsi } from "./rsi.js";
import { bollingerWidthSeries } from "./bollinger.js";
import { atr } from "./atr.js";
import { week52 } from "./week52.js";
import { volumeAvg, volumeRatioLatest } from "./volume.js";
import { obvSeries, obvSlope } from "./obv.js";
import { percentileRank } from "./percentile.js";
import { trailingReturn } from "./relativeStrength.js";
import { sidewaysBaseDays } from "./sidewaysBase.js";
import type { CleanBar } from "./series.js";

function closeTo(actual: number | null, expected: number, tolerance = 1e-6): void {
  assert.ok(actual !== null, `expected a number, got null`);
  assert.ok(
    Math.abs((actual as number) - expected) < tolerance,
    `expected ${actual} to be close to ${expected}`,
  );
}

test("sma: average of a fixed 5-value window", () => {
  assert.equal(sma([1, 2, 3, 4, 5], 5), 3);
});

test("sma: null when fewer values than window", () => {
  assert.equal(sma([1, 2, 3], 5), null);
});

test("rsi: monotonically increasing series (all gains, zero losses) -> RSI = 100", () => {
  const closes = Array.from({ length: 20 }, (_, i) => i + 1); // 1..20, delta=+1 every day
  closeTo(rsi(closes, 14), 100);
});

test("rsi: monotonically decreasing series (all losses, zero gains) -> RSI = 0", () => {
  const closes = Array.from({ length: 20 }, (_, i) => 20 - i); // 20..1, delta=-1 every day
  closeTo(rsi(closes, 14), 0);
});

test("rsi: hand-computed mixed case, period=4", () => {
  // deltas: +0.25, +0.25, -0.75, +0.9
  // avgGain = (0.25+0.25+0+0.9)/4 = 0.35
  // avgLoss = (0+0+0.75+0)/4 = 0.1875
  // RS = 0.35/0.1875 = 1.866666...7
  // RSI = 100 - 100/(1+RS) = 65.116279069767...
  const closes = [44, 44.25, 44.5, 43.75, 44.65];
  closeTo(rsi(closes, 4), 65.116279069767, 1e-9);
});

test("rsi: null when insufficient data", () => {
  assert.equal(rsi([1, 2, 3], 14), null);
});

test("bollinger width: constant price series -> width = 0", () => {
  const closes = [10, 10, 10, 10, 10];
  const widths = bollingerWidthSeries(closes, 5, 2);
  assert.equal(widths.length, 1);
  closeTo(widths[0], 0);
});

test("bollinger width: hand-computed case, period=4, stdDev=2", () => {
  // mean = (2+4+4+4)/4 = 3.5
  // variance = ((2-3.5)^2 + 3*(4-3.5)^2) / 4 = (2.25 + 0.75) / 4 = 0.75
  // std = sqrt(0.75) = 0.8660254037844...
  // width = (4*std) / mean = 3.4641016151378.../3.5 = 0.9897433186108...
  const closes = [2, 4, 4, 4];
  const widths = bollingerWidthSeries(closes, 4, 2);
  assert.equal(widths.length, 1);
  closeTo(widths[0], 0.9897433186108, 1e-9);
});

function bar(date: string, high: number, low: number, close: number, volume = 1000): CleanBar {
  return { date, open: close, high, low, close, volume };
}

test("atr: hand-computed 2-bar case, period=1 (trivial smoothing)", () => {
  // bar0: close=10. bar1: high=12, low=8, prevClose=10 -> TR = max(12-8, |12-10|, |8-10|) = max(4,2,2) = 4
  const bars = [bar("d0", 10, 10, 10), bar("d1", 12, 8, 11)];
  closeTo(atr(bars, 1), 4);
});

test("week52: high/low/position over the whole window", () => {
  const bars = [bar("d0", 12, 8, 10), bar("d1", 15, 9, 14), bar("d2", 13, 11, 12)];
  const result = week52(bars, 3, 12);
  assert.equal(result.high, 15);
  assert.equal(result.low, 8);
  closeTo(result.positionPct as number, (12 - 8) / (15 - 8));
  closeTo(result.pctOfHigh as number, 12 / 15);
});

test("volumeAvg and volumeRatioLatest: fixed volumes", () => {
  const bars = [bar("d0", 1, 1, 1, 100), bar("d1", 1, 1, 1, 200), bar("d2", 1, 1, 1, 300)];
  closeTo(volumeAvg(bars, 3) as number, 200);
  // ratio excludes the latest day from the average: avg of [100,200] = 150, latest=300 -> ratio=2
  closeTo(volumeRatioLatest(bars, 2) as number, 2);
});

test("obv: up/down/flat days accumulate correctly", () => {
  const bars = [bar("d0", 1, 1, 10, 100), bar("d1", 1, 1, 12, 50), bar("d2", 1, 1, 12, 30), bar("d3", 1, 1, 9, 40)];
  // obv[0]=0; d1 up -> +50 => 50; d2 flat -> 50; d3 down -> -40 => 10
  assert.deepEqual(obvSeries(bars), [0, 50, 50, 10]);
});

test("obv slope: perfectly linear OBV series has an exact slope", () => {
  const obv = [0, 10, 20, 30, 40]; // slope = 10 per day
  closeTo(obvSlope(obv, 5) as number, 10);
});

test("percentileRank: known population", () => {
  // 3 of 5 values (10,20,30) are <= 30 -> 60%
  closeTo(percentileRank([10, 20, 30, 40, 50], 30) as number, 60);
});

test("trailingReturn: simple 2-point return", () => {
  const closes = [100, 105, 110, 121];
  closeTo(trailingReturn(closes, 3) as number, 0.21); // 121/100 - 1
});

test("sidewaysBaseDays: counts consecutive days within the band, stops at the breakout", () => {
  // latest=100, bandPct=0.05 -> band [95,105]. Walking backward: 102,98,101,99 all inside; 80 breaks it.
  const closes = [80, 99, 101, 98, 102, 100];
  assert.equal(sidewaysBaseDays(closes, 0.05), 5);
});
