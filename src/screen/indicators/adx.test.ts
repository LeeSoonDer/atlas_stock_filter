import { test } from "node:test";
import assert from "node:assert/strict";
import { adx } from "./adx.js";
import type { CleanBar } from "./series.js";

function bar(date: string, high: number, low: number, close: number): CleanBar {
  return { date, open: close, high, low, close, volume: 1000 };
}

/** A clean, persistent uptrend: every bar steps up by the same amount. */
function trendingBars(count: number): CleanBar[] {
  return Array.from({ length: count }, (_, i) => bar(`d${i}`, 100 + i * 2 + 1, 100 + i * 2 - 1, 100 + i * 2));
}

/** A tight oscillation with no net direction - alternating up/down days inside a fixed band. */
function rangeBoundBars(count: number): CleanBar[] {
  return Array.from({ length: count }, (_, i) => {
    const close = i % 2 === 0 ? 100 : 102;
    return bar(`d${i}`, close + 1, close - 1, close);
  });
}

test("adx: a persistent one-directional trend scores well above the 25 'trending' threshold", () => {
  const value = adx(trendingBars(60), 14);
  assert.ok(value !== null);
  assert.ok(value! > 25, `expected a trending ADX > 25, got ${value}`);
});

test("adx: a tight oscillating range scores below the 20 'range bound' threshold", () => {
  const value = adx(rangeBoundBars(60), 14);
  assert.ok(value !== null);
  assert.ok(value! < 20, `expected a range-bound ADX < 20, got ${value}`);
});

test("adx: carries magnitude only, not direction - a mirrored downtrend scores the same as the uptrend", () => {
  const up = trendingBars(60);
  const down = up.map((b, i) => bar(`d${i}`, 300 - (b.low - 100), 300 - (b.high - 100), 300 - (b.close - 100)));
  const upValue = adx(up, 14);
  const downValue = adx(down, 14);
  assert.ok(upValue !== null && downValue !== null);
  assert.ok(Math.abs(upValue! - downValue!) < 1e-6, `direction should not change ADX magnitude: up=${upValue} down=${downValue}`);
});

test("adx: needs roughly 2x period of history (the second smoothing pass) - null below that, never a degraded guess", () => {
  assert.equal(adx(trendingBars(20), 14), null);
  assert.ok(adx(trendingBars(30), 14) !== null);
});

test("adx: a perfectly flat series (zero true range) -> null rather than a divide-by-zero artifact", () => {
  const flat = Array.from({ length: 60 }, (_, i) => bar(`d${i}`, 100, 100, 100));
  assert.equal(adx(flat, 14), null);
});
