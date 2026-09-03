import { test } from "node:test";
import assert from "node:assert/strict";
import { computeSectorMedianHistoricalVol, resolveHighBetaSatellite } from "./sectorVolatility.js";
import type { ContagionConfig } from "./types.js";

const config: ContagionConfig = {
  contagion: {
    leader: { dailyGainMin: 0.05, cumulative3dGainMin: 0.08, rvolMin: 3.0, breakoutLookbackDays: 20, rvolAvgWindow: 50 },
    laggard: { minLagGapPct: 0.06, rvolMin: 1.3 },
    satellite: { maxMarketCap: 1_000_000_000, betaLookbackDays: 60, betaMin: 1.5, volMultipleOfSectorMedian: 1.5 },
  },
};

test("computeSectorMedianHistoricalVol: groups by sector and takes the median, skipping nulls", () => {
  const result = computeSectorMedianHistoricalVol([
    { sector: "Tech", historicalVol: 0.01 },
    { sector: "Tech", historicalVol: 0.02 },
    { sector: "Tech", historicalVol: 0.03 },
    { sector: "Tech", historicalVol: null },
    { sector: "Energy", historicalVol: 0.05 },
  ]);
  assert.equal(result.get("Tech"), 0.02);
  assert.equal(result.get("Energy"), 0.05);
});

test("computeSectorMedianHistoricalVol: a sector with only nulls gets no entry (never fabricated)", () => {
  const result = computeSectorMedianHistoricalVol([{ sector: "Empty", historicalVol: null }]);
  assert.equal(result.has("Empty"), false);
});

test("resolveHighBetaSatellite: beta available -> used directly, historicalVol ignored", () => {
  assert.equal(resolveHighBetaSatellite(2.0, 0.001, 0.0001, config), true);
  assert.equal(resolveHighBetaSatellite(1.0, 999, 0.0001, config), false);
});

test("resolveHighBetaSatellite: beta unavailable -> falls back to historicalVol vs sector median", () => {
  assert.equal(resolveHighBetaSatellite(null, 0.05, 0.02, config), true); // 0.05 > 0.02*1.5
  assert.equal(resolveHighBetaSatellite(null, 0.02, 0.02, config), false);
});

test("resolveHighBetaSatellite: neither metric available -> false, never fabricated", () => {
  assert.equal(resolveHighBetaSatellite(null, null, 0.02, config), false);
  assert.equal(resolveHighBetaSatellite(null, 0.05, null, config), false);
});
