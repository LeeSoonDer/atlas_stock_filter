import { test } from "node:test";
import assert from "node:assert/strict";
import { computeSectorFlowScan } from "./computeSectorFlowScan.js";
import type { SectorReturns } from "../sector/types.js";
import type { SectorFootprint } from "../sector_footprint/types.js";
import type { SectorFlowConfig } from "./types.js";

const config: SectorFlowConfig = { sectorFlow: { flowInRankThreshold: 2, flowOutRankThreshold: 2 } };

function footprint(sector: string, skipped = false): SectorFootprint {
  return {
    sector,
    validSymbolCount: skipped ? 2 : 20,
    densities: {
      institutionalAccumulation: { count: 2, density: skipped ? null : 0.1 },
      insiderCluster: { count: 1, density: skipped ? null : 0.05 },
      shortInterestDecline: { count: 0, density: skipped ? null : 0 },
      volatilityCompression: { count: 4, density: skipped ? null : 0.2 },
    },
    footprintAnomaly: false,
    anomalyDimensions: [],
    skipped,
    skipReason: skipped ? "insufficient valid symbols in sector (2 < 5)" : null,
  };
}

// Hand-traced: ranked by oneWeekReturn desc -> A(1,+.05) B(2,+.02) C(3, 0) D(4,-.01) E(5,-.04).
// total=5, flowInRankThreshold=2 -> rank<=2 AND return>0: A,B. flowOutRankThreshold=2 -> rank>3 AND return<0: D,E. C stays flat (rank3, and return=0 fails both checks anyway).
const returns: SectorReturns[] = [
  { sector: "A", etf: "XLA", oneWeekReturn: 0.05, oneMonthReturn: 0, threeMonthReturn: 0 },
  { sector: "B", etf: "XLB", oneWeekReturn: 0.02, oneMonthReturn: 0, threeMonthReturn: 0 },
  { sector: "C", etf: "XLC", oneWeekReturn: 0.0, oneMonthReturn: 0, threeMonthReturn: 0 },
  { sector: "D", etf: "XLD", oneWeekReturn: -0.01, oneMonthReturn: 0, threeMonthReturn: 0 },
  { sector: "E", etf: "XLE", oneWeekReturn: -0.04, oneMonthReturn: 0, threeMonthReturn: 0 },
];
const footprints: SectorFootprint[] = [
  footprint("A"),
  footprint("B"),
  footprint("C", true), // skipped -> densities null
  footprint("D"),
  footprint("E"),
];

test("computeSectorFlowScan: rank by weekly return, flow_in/flow_out/flat per config thresholds", () => {
  const result = computeSectorFlowScan(returns, footprints, new Map(), new Map(), config);
  const bySector = new Map(result.map((r) => [r.sector, r]));

  assert.equal(bySector.get("A")!.rank, 1);
  assert.equal(bySector.get("A")!.flowState, "flow_in");
  assert.equal(bySector.get("B")!.rank, 2);
  assert.equal(bySector.get("B")!.flowState, "flow_in");
  assert.equal(bySector.get("C")!.rank, 3);
  assert.equal(bySector.get("C")!.flowState, "flat");
  assert.equal(bySector.get("D")!.rank, 4);
  assert.equal(bySector.get("D")!.flowState, "flow_out");
  assert.equal(bySector.get("E")!.rank, 5);
  assert.equal(bySector.get("E")!.flowState, "flow_out");
});

test("computeSectorFlowScan: a skipped footprint's sector gets null densities, not zeros", () => {
  const result = computeSectorFlowScan(returns, footprints, new Map(), new Map(), config);
  const c = result.find((r) => r.sector === "C")!;
  assert.equal(c.squeezeDensity, null);
  assert.equal(c.institutionalDensity, null);
  assert.equal(c.insiderClusterDensity, null);
});

test("computeSectorFlowScan: a non-skipped sector's densities pass through from the footprint unchanged", () => {
  const result = computeSectorFlowScan(returns, footprints, new Map(), new Map(), config);
  const a = result.find((r) => r.sector === "A")!;
  assert.equal(a.squeezeDensity, 0.2);
  assert.equal(a.institutionalDensity, 0.1);
  assert.equal(a.insiderClusterDensity, 0.05);
});

test("computeSectorFlowScan: candidate/watchlist counts pass through from the provided maps, defaulting to 0", () => {
  const result = computeSectorFlowScan(returns, footprints, new Map([["A", 2]]), new Map([["B", 3]]), config);
  const a = result.find((r) => r.sector === "A")!;
  const b = result.find((r) => r.sector === "B")!;
  const c = result.find((r) => r.sector === "C")!;
  assert.equal(a.candidatesInSector, 2);
  assert.equal(a.watchlistInSector, 0);
  assert.equal(b.watchlistInSector, 3);
  assert.equal(c.candidatesInSector, 0);
});

test("computeSectorFlowScan: a sector with a null weekly return gets null rank and forced flat flowState", () => {
  const withNull: SectorReturns[] = [...returns, { sector: "F", etf: "XLF", oneWeekReturn: null, oneMonthReturn: null, threeMonthReturn: null }];
  const result = computeSectorFlowScan(withNull, [...footprints, footprint("F")], new Map(), new Map(), config);
  const f = result.find((r) => r.sector === "F")!;
  assert.equal(f.rank, null);
  assert.equal(f.flowState, "flat");
});
