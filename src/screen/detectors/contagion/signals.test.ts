import { test } from "node:test";
import assert from "node:assert/strict";
import { brokeAboveTrailingHigh, latestDailyReturn } from "./signals.js";
import type { CleanBar } from "../../indicators/series.js";

function bar(date: string, close: number, high?: number): CleanBar {
  return { date, open: close, high: high ?? close, low: close, close, volume: 1000 };
}

test("latestDailyReturn: basic ratio", () => {
  const bars = [bar("d0", 100), bar("d1", 105)];
  assert.ok(Math.abs(latestDailyReturn(bars)! - 0.05) < 1e-9);
});

test("latestDailyReturn: insufficient bars -> null", () => {
  assert.equal(latestDailyReturn([bar("d0", 100)]), null);
});

test("brokeAboveTrailingHigh: today's close above prior-window high -> true", () => {
  const bars = [bar("d0", 100, 105), bar("d1", 101, 106), bar("d2", 99, 104), bar("d3", 110, 110)];
  assert.equal(brokeAboveTrailingHigh(bars, 3), true);
});

test("brokeAboveTrailingHigh: today's own high is excluded from being compared against itself, only prior bars count", () => {
  // Today's close (105) does not exceed the prior 3 days' high (106), even though today's own high (200) would trivially "contain" any close.
  const bars = [bar("d0", 100, 105), bar("d1", 101, 106), bar("d2", 99, 104), bar("d3", 105, 200)];
  assert.equal(brokeAboveTrailingHigh(bars, 3), false);
});

test("brokeAboveTrailingHigh: insufficient bars -> null", () => {
  assert.equal(brokeAboveTrailingHigh([bar("d0", 100)], 20), null);
});
