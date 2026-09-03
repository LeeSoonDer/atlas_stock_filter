import { test } from "node:test";
import assert from "node:assert/strict";
import { computeSectorLeaders } from "./computeSectorLeaders.js";
import type { ContagionConfig, LeaderScanInput } from "./types.js";

const config: ContagionConfig = {
  contagion: {
    leader: { dailyGainMin: 0.05, cumulative3dGainMin: 0.08, rvolMin: 3.0, breakoutLookbackDays: 20, rvolAvgWindow: 50 },
    laggard: { minLagGapPct: 0.06, rvolMin: 1.3 },
    satellite: { maxMarketCap: 1_000_000_000, betaLookbackDays: 60, betaMin: 1.5, volMultipleOfSectorMedian: 1.5 },
  },
};

function input(overrides: Partial<LeaderScanInput> & { symbol: string; sector: string }): LeaderScanInput {
  return {
    latestDate: "2026-08-28",
    dailyReturn: null,
    return3d: null,
    rvol: null,
    brokeTrailingHigh: null,
    ...overrides,
  };
}

test("a symbol clearing all three leader conditions marks its sector event_driven", () => {
  const inputs: LeaderScanInput[] = [
    input({ symbol: "AAA", sector: "Technology", dailyReturn: 0.07, return3d: 0.09, rvol: 4.0, brokeTrailingHigh: true }),
    input({ symbol: "BBB", sector: "Technology", dailyReturn: 0.01, return3d: 0.02, rvol: 1.1, brokeTrailingHigh: false }),
  ];
  const leaders = computeSectorLeaders(inputs, config);
  const tech = leaders.get("Technology")!;
  assert.equal(tech.eventDriven, true);
  assert.equal(tech.leaderTicker, "AAA");
});

test("a sector with no qualifying symbol is not event_driven, and no leader is fabricated", () => {
  const inputs: LeaderScanInput[] = [
    input({ symbol: "CCC", sector: "Energy", dailyReturn: 0.02, return3d: 0.03, rvol: 1.5, brokeTrailingHigh: true }),
  ];
  const leaders = computeSectorLeaders(inputs, config);
  const energy = leaders.get("Energy")!;
  assert.equal(energy.eventDriven, false);
  assert.equal(energy.leaderTicker, null);
  assert.equal(energy.leaderMovePct, null);
});

test("RVOL threshold met but no breakout -> does not qualify as leader", () => {
  const inputs: LeaderScanInput[] = [
    input({ symbol: "DDD", sector: "Financials", dailyReturn: 0.08, return3d: 0.1, rvol: 5.0, brokeTrailingHigh: false }),
  ];
  const leaders = computeSectorLeaders(inputs, config);
  assert.equal(leaders.get("Financials")!.eventDriven, false);
});

test("multiple qualifying symbols in one sector -> the larger mover is reported as leader", () => {
  const inputs: LeaderScanInput[] = [
    input({ symbol: "SMALLMOVE", sector: "Health Care", dailyReturn: 0.06, return3d: 0.09, rvol: 3.5, brokeTrailingHigh: true }),
    input({ symbol: "BIGMOVE", sector: "Health Care", dailyReturn: 0.15, return3d: 0.2, rvol: 6.0, brokeTrailingHigh: true }),
  ];
  const leaders = computeSectorLeaders(inputs, config);
  const hc = leaders.get("Health Care")!;
  assert.equal(hc.leaderTicker, "BIGMOVE");
  assert.equal(hc.leaderMovePct, 0.2);
  assert.equal(hc.leaderMoveBasis, "3d");
});

test("a symbol qualifying only via 3-day cumulative (not single-day) still counts, reported on the 3d basis", () => {
  const inputs: LeaderScanInput[] = [
    input({ symbol: "SLOWBURN", sector: "Utilities", dailyReturn: 0.02, return3d: 0.09, rvol: 3.2, brokeTrailingHigh: true }),
  ];
  const leaders = computeSectorLeaders(inputs, config);
  const util = leaders.get("Utilities")!;
  assert.equal(util.eventDriven, true);
  assert.equal(util.leaderMoveBasis, "3d");
  assert.equal(util.leaderMovePct, 0.09);
});
