import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyEntryStructure } from "./entryStructure.js";
import type { EntryStructureConfig } from "./entryStructure.js";
import type { CleanBar } from "./series.js";

const config: EntryStructureConfig = {
  entryStructure: {
    breakoutProximityPct: 0.97,
    pullbackMaBandPct: 0.04,
    pullbackVolumeContractionRatio: 0.9,
    pullbackVolumeAvgWindow: 20,
  },
};

function barsWithVolume(latestVolume: number, baselineVolume = 1000): CleanBar[] {
  const bars: CleanBar[] = Array.from({ length: 20 }, (_, i) => ({
    date: `d${i}`, open: 100, high: 100, low: 100, close: 100, volume: baselineVolume,
  }));
  bars[bars.length - 1] = { ...bars[bars.length - 1], volume: latestVolume };
  return bars;
}

test("at/near the 52-week high -> breakout", () => {
  const result = classifyEntryStructure(barsWithVolume(1000), 0.99, 95, 90, 100, true, config);
  assert.equal(result, "breakout");
});

test("breakout wins over pullback when both shapes are arguably present (a symbol at highs riding a rising SMA20)", () => {
  // pctOf52WeekHigh clears the breakout band AND close sits right on SMA20 with quiet volume.
  const result = classifyEntryStructure(barsWithVolume(500), 0.98, 100, 90, 100, true, config);
  assert.equal(result, "breakout");
});

test("pulled back to SMA20 on contracted volume inside an established uptrend -> pullback_to_ma", () => {
  const result = classifyEntryStructure(barsWithVolume(500), 0.85, 101, 90, 100, true, config);
  assert.equal(result, "pullback_to_ma");
});

test("near an MA but volume is NOT contracted -> null (a pullback must be quiet, not just close to a line)", () => {
  const result = classifyEntryStructure(barsWithVolume(2000), 0.85, 101, 90, 100, true, config);
  assert.equal(result, null);
});

test("near an MA on quiet volume but WITHOUT the bullish MA stack -> null (not an uptrend, so not a pullback)", () => {
  const result = classifyEntryStructure(barsWithVolume(500), 0.85, 101, 90, 100, false, config);
  assert.equal(result, null);
});

test("far from both the 52-week high and any MA -> null, never a defaulted label", () => {
  const result = classifyEntryStructure(barsWithVolume(500), 0.6, 150, 160, 100, true, config);
  assert.equal(result, null);
});

test("missing latestClose -> null rather than a fabricated structure", () => {
  assert.equal(classifyEntryStructure(barsWithVolume(500), 0.99, 95, 90, null, true, config), null);
});

test("SMA50 also counts as a pullback target, not just SMA20", () => {
  const result = classifyEntryStructure(barsWithVolume(500), 0.85, 150, 102, 100, true, config);
  assert.equal(result, "pullback_to_ma");
});
