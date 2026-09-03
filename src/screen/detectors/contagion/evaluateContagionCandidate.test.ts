import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateContagionCandidate } from "./evaluateContagionCandidate.js";
import type { ContagionCandidateInput, ContagionConfig, SectorLeaderInfo } from "./types.js";

const config: ContagionConfig = {
  contagion: {
    leader: { dailyGainMin: 0.05, cumulative3dGainMin: 0.08, rvolMin: 3.0, breakoutLookbackDays: 20, rvolAvgWindow: 50 },
    laggard: { minLagGapPct: 0.06, rvolMin: 1.3 },
    satellite: { maxMarketCap: 1_000_000_000, betaLookbackDays: 60, betaMin: 1.5, volMultipleOfSectorMedian: 1.5 },
  },
};

const eventDrivenLeader: SectorLeaderInfo = {
  sector: "Technology",
  eventDriven: true,
  leaderTicker: "LEAD",
  leaderMovePct: 0.15,
  leaderMoveBasis: "daily",
  leaderRvol: 5.0,
  sectorEventDate: "2026-08-28",
};

function candidateInput(overrides: Partial<ContagionCandidateInput> = {}): ContagionCandidateInput {
  return {
    symbol: "LAG",
    sector: "Technology",
    dailyReturn: 0.03,
    return3d: 0.04,
    rvol: 1.5,
    smaStructureIntact: true,
    vitalityPassed: true,
    marketCap: null,
    beta60d: null,
    historicalVol: null,
    sectorMedianHistoricalVol: null,
    ...overrides,
  };
}

test("all laggard conditions met -> triggered, with correct lag gap and a positive strengthScore", () => {
  const result = evaluateContagionCandidate(candidateInput(), eventDrivenLeader, config);
  assert.equal(result.triggered, true);
  assert.equal(result.leaderTicker, "LEAD");
  assert.ok(Math.abs(result.lagGapPct! - 0.12) < 1e-9); // 0.15 - 0.03
  assert.ok(result.strengthScore !== null && result.strengthScore > 0);
});

test("not triggered -> strengthScore is null, never a fabricated sort key", () => {
  const result = evaluateContagionCandidate(candidateInput({ rvol: 1.0 }), eventDrivenLeader, config);
  assert.equal(result.strengthScore, null);
});

test("sector not event_driven -> never triggers, leaderTicker null", () => {
  const notEventDriven: SectorLeaderInfo = { ...eventDrivenLeader, eventDriven: false, leaderTicker: null, leaderMoveBasis: null };
  const result = evaluateContagionCandidate(candidateInput(), notEventDriven, config);
  assert.equal(result.triggered, false);
  assert.equal(result.leaderTicker, null);
});

test("lag gap below threshold -> not triggered even with everything else passing", () => {
  const result = evaluateContagionCandidate(candidateInput({ dailyReturn: 0.11 }), eventDrivenLeader, config); // gap = 0.04, below 0.06
  assert.equal(result.triggered, false);
});

test("RVOL below laggard threshold -> not triggered", () => {
  const result = evaluateContagionCandidate(candidateInput({ rvol: 1.0 }), eventDrivenLeader, config);
  assert.equal(result.triggered, false);
});

test("structure broken (below both SMA50 and SMA200) -> not triggered", () => {
  const result = evaluateContagionCandidate(candidateInput({ smaStructureIntact: false }), eventDrivenLeader, config);
  assert.equal(result.triggered, false);
});

test("fails vitality floor -> not triggered (contagion candidates are not exempt from Part A)", () => {
  const result = evaluateContagionCandidate(candidateInput({ vitalityPassed: false }), eventDrivenLeader, config);
  assert.equal(result.triggered, false);
});

test("high_beta_satellite: small-cap with beta above threshold is flagged but STILL triggered (never excluded)", () => {
  const result = evaluateContagionCandidate(
    candidateInput({ marketCap: 500_000_000, beta60d: 2.0 }),
    eventDrivenLeader,
    config,
  );
  assert.equal(result.triggered, true);
  assert.equal(result.highBetaSatellite, true);
});

test("high_beta_satellite: large-cap is never flagged even with high beta", () => {
  const result = evaluateContagionCandidate(
    candidateInput({ marketCap: 5_000_000_000, beta60d: 3.0 }),
    eventDrivenLeader,
    config,
  );
  assert.equal(result.highBetaSatellite, false);
});

test("high_beta_satellite: beta unavailable falls back to historicalVol vs sector median", () => {
  const result = evaluateContagionCandidate(
    candidateInput({ marketCap: 500_000_000, beta60d: null, historicalVol: 0.05, sectorMedianHistoricalVol: 0.02 }),
    eventDrivenLeader,
    config,
  );
  assert.equal(result.triggered, true);
  assert.equal(result.highBetaSatellite, true); // 0.05 > 0.02 * 1.5
});

test("high_beta_satellite: both beta and historicalVol unavailable -> false, not fabricated", () => {
  const result = evaluateContagionCandidate(
    candidateInput({ marketCap: 500_000_000, beta60d: null, historicalVol: null }),
    eventDrivenLeader,
    config,
  );
  assert.equal(result.highBetaSatellite, false);
});

test("missing own-move data -> not triggered, conditions marked unavailable rather than a fabricated miss", () => {
  const result = evaluateContagionCandidate(candidateInput({ dailyReturn: null }), eventDrivenLeader, config);
  assert.equal(result.triggered, false);
  assert.ok(result.conditions.some((c) => c.availability === "不可得"));
});
