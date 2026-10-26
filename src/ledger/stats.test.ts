import { test } from "node:test";
import assert from "node:assert/strict";
import { computeLedgerStats } from "./stats.js";
import type { OutcomeUpdateLedgerEntry, ScreeningLedgerEntry } from "./types.js";

function screening(symbol: string, ts: string, opportunityType: string | null): ScreeningLedgerEntry {
  return {
    recordType: "screening",
    symbol,
    screeningTimestamp: ts,
    profile: "STANDARD",
    speculative: false,
    status: "candidate",
    buckets: opportunityType ? [opportunityType] : [],
    flagsSnapshot: {} as never,
    holdingPeriod: null,
    opportunityType,
  };
}

function outcome(symbol: string, refersTo: string, repriced: boolean, invalidated: boolean): OutcomeUpdateLedgerEntry {
  return {
    recordType: "outcome_update",
    symbol,
    refersToScreeningTimestamp: refersTo,
    backfilledAt: "2026-09-01T00:00:00Z",
    outcome: { repriced, invalidationTriggered: invalidated, expiredNoEvent: !repriced && !invalidated, elapsedDays: 14 },
  };
}

test("always includes all 5 buckets (4 original + sector_contagion), even with zero data", () => {
  const stats = computeLedgerStats([], []);
  assert.equal(stats.length, 5);
  assert.equal(stats[4].bucket, "sector_contagion");
  assert.ok(stats.every((s) => s.totalCandidates === 0 && s.hitRate === null && s.deathRate === null));
});

test("修正案二十二: a sector_contagion candidate is measured like any other bucket", () => {
  const screenings = [screening("L", "t1", "sector_contagion"), screening("M", "t1", "sector_contagion")];
  const outcomes = [outcome("L", "t1", true, false)];
  const contagion = computeLedgerStats(screenings, outcomes).find((s) => s.bucket === "sector_contagion")!;
  assert.equal(contagion.totalCandidates, 2);
  assert.equal(contagion.resolvedCount, 1);
  assert.equal(contagion.pendingCount, 1);
  assert.equal(contagion.hitRate, 100);
});

test("hit rate and death rate computed only over resolved entries", () => {
  const screenings = [
    screening("A", "t1", "momentum_breakout"),
    screening("B", "t1", "momentum_breakout"),
    screening("C", "t1", "momentum_breakout"), // unresolved
  ];
  const outcomes = [outcome("A", "t1", true, false), outcome("B", "t1", false, true)];
  const stats = computeLedgerStats(screenings, outcomes);
  const momentum = stats.find((s) => s.bucket === "momentum_breakout")!;
  assert.equal(momentum.totalCandidates, 3);
  assert.equal(momentum.resolvedCount, 2);
  assert.equal(momentum.pendingCount, 1);
  assert.equal(momentum.hitRate, 50); // 1 of 2 resolved
  assert.equal(momentum.deathRate, 50); // 1 of 2 resolved
});

test("watchlist entries (opportunityType null) are excluded from bucket stats", () => {
  const screenings = [screening("W", "t1", null)];
  const stats = computeLedgerStats(screenings, []);
  assert.ok(stats.every((s) => s.totalCandidates === 0));
});

test("only the most recent outcome update counts if a symbol was backfilled more than once", () => {
  const screenings = [screening("A", "t1", "oversold_reversal")];
  const outcomes = [
    { ...outcome("A", "t1", true, false), backfilledAt: "2026-09-01T00:00:00Z" },
    { ...outcome("A", "t1", false, true), backfilledAt: "2026-09-05T00:00:00Z" }, // later, corrected
  ];
  const stats = computeLedgerStats(screenings, outcomes);
  const oversold = stats.find((s) => s.bucket === "oversold_reversal")!;
  assert.equal(oversold.hitRate, 0); // the later correction (invalidated, not repriced) wins
  assert.equal(oversold.deathRate, 100);
});
