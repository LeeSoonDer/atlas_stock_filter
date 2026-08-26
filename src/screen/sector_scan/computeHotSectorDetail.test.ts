import { test } from "node:test";
import assert from "node:assert/strict";
import { computeHotSectorDetail } from "./computeHotSectorDetail.js";
import type { CandidateSectorInfo, BasketTickerStat } from "./computeHotSectorDetail.js";
import type { HotSectorsConfig, SectorFlowEntry } from "./types.js";
import type { SectorFootprint } from "../sector_footprint/types.js";

function flowEntry(overrides: Partial<SectorFlowEntry> & { sector: string }): SectorFlowEntry {
  return {
    etf: "XLX",
    rank: 5,
    weeklyReturn: 0,
    squeezeDensity: 0,
    institutionalDensity: 0,
    insiderClusterDensity: 0,
    flowState: "flat",
    candidatesInSector: 0,
    watchlistInSector: 0,
    ...overrides,
  };
}

function footprint(sector: string, footprintAnomaly = false): SectorFootprint {
  return {
    sector,
    validSymbolCount: 20,
    densities: {
      institutionalAccumulation: { count: 1, density: 0.05 },
      insiderCluster: { count: 1, density: 0.05 },
      shortInterestDecline: { count: 1, density: 0.05 },
      volatilityCompression: { count: 4, density: 0.2 },
    },
    footprintAnomaly,
    anomalyDimensions: footprintAnomaly ? ["volatilityCompression"] : [],
    skipped: false,
    skipReason: null,
  };
}

const config: HotSectorsConfig = {
  hotSectors: [
    { name: "科技/软件", kind: "sector", sector: "Technology" },
    { name: "AI 基建", kind: "basket", tickers: ["NVDA", "AMD", "AVGO"] },
  ],
};

test("computeHotSectorDetail: sector-kind entry reuses the matching SectorFlowEntry and filters candidates/watchlist by sector", () => {
  const flow = [flowEntry({ sector: "Technology", rank: 9, weeklyReturn: -0.02, squeezeDensity: 0.04 })];
  const candidates: CandidateSectorInfo[] = [
    { symbol: "NAVN", sector: "Technology" },
    { symbol: "WSBC", sector: "Financial Services" },
  ];
  const result = computeHotSectorDetail(flow, [footprint("Technology")], config, new Map(), candidates, []);
  const tech = result.find((r) => r.name === "科技/软件")!;

  assert.equal(tech.kind, "sector");
  assert.equal(tech.origin, "named");
  assert.equal(tech.weeklyReturn, -0.02);
  assert.equal(tech.squeezeDensity, 0.04);
  assert.deepEqual(tech.candidatesInPool, ["NAVN"]);
  assert.equal(tech.basketCoverage, null);
});

test("computeHotSectorDetail: basket-kind entry averages weeklyReturn/squeezeDensity over only the tickers actually found in this run", () => {
  const stats = new Map<string, BasketTickerStat>([
    ["NVDA", { weeklyReturn: 0.04, volatilityCompressionHit: true }],
    ["AMD", { weeklyReturn: 0.02, volatilityCompressionHit: false }],
    // AVGO deliberately absent - not in this run's gate-passed universe.
  ]);
  const result = computeHotSectorDetail([], [], config, stats, [], []);
  const ai = result.find((r) => r.name === "AI 基建")!;

  assert.equal(ai.kind, "basket");
  assert.deepEqual(ai.basketCoverage, { found: 2, total: 3 });
  assert.equal(ai.weeklyReturn, 0.03); // (0.04+0.02)/2
  assert.equal(ai.squeezeDensity, 0.5); // 1 of 2 found tickers hit the bucket
  assert.equal(ai.flowState, "flow_in");
});

test("computeHotSectorDetail: basket-kind entry with zero tickers found -> null return/density, unknown flow state, honest coverage", () => {
  const result = computeHotSectorDetail([], [], config, new Map(), [], []);
  const ai = result.find((r) => r.name === "AI 基建")!;

  assert.equal(ai.weeklyReturn, null);
  assert.equal(ai.squeezeDensity, null);
  assert.equal(ai.flowState, "unknown");
  assert.deepEqual(ai.basketCoverage, { found: 0, total: 3 });
});

test("computeHotSectorDetail: an unnamed real sector flagged footprintAnomaly is added as origin=anomaly_detected", () => {
  const flow = [flowEntry({ sector: "Financial Services", rank: 4, weeklyReturn: 0.014, squeezeDensity: 0.232 })];
  const footprints = [footprint("Financial Services", true)];
  const result = computeHotSectorDetail(flow, footprints, config, new Map(), [], []);
  const fin = result.find((r) => r.name === "Financial Services");

  assert.ok(fin, "anomaly-detected sector should appear in the output");
  assert.equal(fin!.origin, "anomaly_detected");
  assert.equal(fin!.kind, "sector");
  assert.equal(fin!.weeklyReturn, 0.014);
});

test("computeHotSectorDetail: a named sector flagged anomaly is NOT duplicated as a second anomaly_detected entry", () => {
  const flow = [flowEntry({ sector: "Technology", rank: 1, weeklyReturn: 0.05, squeezeDensity: 0.3 })];
  const footprints = [footprint("Technology", true)]; // Technology itself is anomalous this run
  const result = computeHotSectorDetail(flow, footprints, config, new Map(), [], []);
  const techEntries = result.filter((r) => r.sectorFlowRef?.sector === "Technology" || r.name === "科技/软件");

  assert.equal(techEntries.length, 1, "Technology should appear exactly once (as the named entry), not also as anomaly_detected");
});

test("computeHotSectorDetail: a real sector that is neither named nor anomalous does not appear at all", () => {
  const flow = [flowEntry({ sector: "Utilities" })];
  const footprints = [footprint("Utilities", false)];
  const result = computeHotSectorDetail(flow, footprints, config, new Map(), [], []);

  assert.equal(result.find((r) => r.name === "Utilities"), undefined);
});
