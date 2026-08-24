import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregateSectorFootprints } from "./aggregateSectorFootprint.js";
import type { FootprintConfig, SymbolFootprintInput } from "./types.js";

const config: FootprintConfig = {
  footprintAggregation: { anomalyMedianMultiplier: 2, anomalyMinAbsoluteCount: 3, minSymbolsForAggregation: 5 },
};

function sym(sector: string, overrides: Partial<SymbolFootprintInput> = {}): SymbolFootprintInput {
  return {
    sector,
    institutionalAccumulationHit: false,
    insiderCluster: false,
    shortInterestDeclineHit: false,
    volatilityCompressionHit: false,
    ...overrides,
  };
}

test("DONE-WHEN: a manually constructed hot sector (many institutional-bucket hits) triggers footprint_anomaly correctly", () => {
  // TestSectorHot: 10 symbols, 8 with institutional_accumulation hits (density 0.8).
  // Three quiet sectors: 10 symbols each, 1 hit apiece (density 0.1).
  // Median across the 4 sectors = (0.1+0.1+0.1+0.8 sorted -> 0.1,0.1,0.1,0.8, mid two are 0.1,0.1) = 0.1.
  // TestSectorHot: 0.8 >= 0.1*2=0.2 AND count=8>=3 -> anomaly on institutionalAccumulation.
  const hot = Array.from({ length: 10 }, (_, i) => sym("TestSectorHot", { institutionalAccumulationHit: i < 8 }));
  const quietA = Array.from({ length: 10 }, (_, i) => sym("QuietA", { institutionalAccumulationHit: i < 1 }));
  const quietB = Array.from({ length: 10 }, (_, i) => sym("QuietB", { institutionalAccumulationHit: i < 1 }));
  const quietC = Array.from({ length: 10 }, (_, i) => sym("QuietC", { institutionalAccumulationHit: i < 1 }));

  const result = aggregateSectorFootprints(
    [...hot, ...quietA, ...quietB, ...quietC],
    ["TestSectorHot", "QuietA", "QuietB", "QuietC"],
    config,
  );

  const hotResult = result.find((r) => r.sector === "TestSectorHot")!;
  assert.equal(hotResult.densities.institutionalAccumulation.count, 8);
  assert.equal(hotResult.densities.institutionalAccumulation.density, 0.8);
  assert.equal(hotResult.footprintAnomaly, true);
  assert.deepEqual(hotResult.anomalyDimensions, ["institutionalAccumulation"]);

  const quietResult = result.find((r) => r.sector === "QuietA")!;
  assert.equal(quietResult.footprintAnomaly, false);
});

test("a sector below minSymbolsForAggregation is skipped, not force-aggregated", () => {
  const tiny = [sym("TinySector"), sym("TinySector", { insiderCluster: true })]; // only 2, threshold is 5
  const normal = Array.from({ length: 10 }, () => sym("NormalSector"));
  const result = aggregateSectorFootprints([...tiny, ...normal], ["TinySector", "NormalSector"], config);

  const tinyResult = result.find((r) => r.sector === "TinySector")!;
  assert.equal(tinyResult.skipped, true);
  assert.ok(tinyResult.skipReason !== null);
  assert.equal(tinyResult.footprintAnomaly, false);
  assert.equal(tinyResult.densities.insiderCluster.density, null); // never fabricated
});

test("absolute-count floor prevents a tiny sector's high density from being flagged anomalous", () => {
  // 2 sectors both above the size floor: SmallHitSector has 5 symbols, 2 hits (density 0.4);
  // BigQuietSector has 20 symbols, 2 hits (density 0.1). Median = avg(0.4,0.1) = 0.25.
  // SmallHitSector: density 0.4 >= 0.25*2=0.5? NO -> not anomalous by threshold either way here,
  // demonstrates count floor with a case where density crosses but count doesn't:
  const smallHit = [
    ...Array.from({ length: 2 }, () => sym("SmallHitSector", { insiderCluster: true })),
    ...Array.from({ length: 3 }, () => sym("SmallHitSector")),
  ]; // 5 symbols, 2 hits, density 0.4, count 2 (< anomalyMinAbsoluteCount 3)
  const bigQuiet = Array.from({ length: 20 }, () => sym("BigQuietSector"));
  const result = aggregateSectorFootprints([...smallHit, ...bigQuiet], ["SmallHitSector", "BigQuietSector"], config);

  const smallResult = result.find((r) => r.sector === "SmallHitSector")!;
  assert.equal(smallResult.densities.insiderCluster.count, 2);
  // Even if density crossed the multiplier threshold, count=2 < anomalyMinAbsoluteCount=3 blocks the flag.
  assert.equal(smallResult.anomalyDimensions.includes("insiderCluster"), false);
});

test("uniform densities across all sectors -> no anomalies anywhere", () => {
  const sectors = ["A", "B", "C"].map((name) => Array.from({ length: 10 }, (_, i) => sym(name, { volatilityCompressionHit: i < 2 })));
  const result = aggregateSectorFootprints(sectors.flat(), ["A", "B", "C"], config);
  assert.ok(result.every((r) => r.footprintAnomaly === false));
});
