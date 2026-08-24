import { test } from "node:test";
import assert from "node:assert/strict";
import { mostRecentPivotHigh, mostRecentPivotLow } from "./pivotPoints.js";
import type { CleanBar } from "./series.js";

function bar(date: string, high: number, low: number): CleanBar {
  return { date, open: (high + low) / 2, high, low, close: (high + low) / 2, volume: 1000 };
}

// Hand-traced fixture (K=2): index2 (h=20) is a pivot high (12,9 before < 20; 14,11 after < 20);
// index4 (l=6) is a pivot low (10,14 before > 6; 9,8 after > 6). Both are the only valid
// pivots in the K=2-testable range [2,4] (window.length-1-k=6-2=4 down to k=2).
const bars: CleanBar[] = [
  bar("d0", 9, 7),
  bar("d1", 12, 9),
  bar("d2", 20, 14), // pivot high
  bar("d3", 14, 10),
  bar("d4", 11, 6), // pivot low
  bar("d5", 13, 9),
  bar("d6", 10, 8),
];

test("mostRecentPivotHigh: hand-traced 5-bar fractal (K=2)", () => {
  const pivot = mostRecentPivotHigh(bars, 2, 7);
  assert.deepEqual(pivot, { date: "d2", price: 20 });
});

test("mostRecentPivotLow: hand-traced 5-bar fractal (K=2)", () => {
  const pivot = mostRecentPivotLow(bars, 2, 7);
  assert.deepEqual(pivot, { date: "d4", price: 6 });
});

test("returns null when no pivot exists in a strictly monotonic series", () => {
  const rising = Array.from({ length: 10 }, (_, i) => bar(`m${i}`, 10 + i, 8 + i));
  assert.equal(mostRecentPivotHigh(rising, 2, 10), null);
  assert.equal(mostRecentPivotLow(rising, 2, 10), null);
});

test("lookbackDays limits the search window (a pivot outside the window is not found)", () => {
  // Only look at the last 3 bars (d4,d5,d6), which contain no confirmable pivot (K=2 needs 5 bars minimum).
  const pivot = mostRecentPivotHigh(bars, 2, 3);
  assert.equal(pivot, null);
});
