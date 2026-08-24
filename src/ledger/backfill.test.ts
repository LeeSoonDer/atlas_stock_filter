import { test } from "node:test";
import assert from "node:assert/strict";
import { buildOutcomeUpdate, findUnresolvedScreenings } from "./backfill.js";
import type { ScreeningLedgerEntry } from "./types.js";

function screening(symbol: string, ts: string): ScreeningLedgerEntry {
  return {
    recordType: "screening", symbol, screeningTimestamp: ts, profile: "STANDARD", speculative: false,
    status: "candidate", buckets: [], flagsSnapshot: {} as never, holdingPeriod: null, opportunityType: null,
  };
}

test("buildOutcomeUpdate: repriced maps only repriced=true", () => {
  const entry = buildOutcomeUpdate("AAPL", "t1", "repriced", 14, new Date("2026-09-01T00:00:00Z"));
  assert.equal(entry.outcome.repriced, true);
  assert.equal(entry.outcome.invalidationTriggered, false);
  assert.equal(entry.outcome.expiredNoEvent, false);
  assert.equal(entry.outcome.elapsedDays, 14);
  assert.equal(entry.refersToScreeningTimestamp, "t1");
});

test("buildOutcomeUpdate: invalidated and expired_no_event map correctly, mutually exclusive", () => {
  assert.equal(buildOutcomeUpdate("X", "t1", "invalidated", 5).outcome.invalidationTriggered, true);
  assert.equal(buildOutcomeUpdate("X", "t1", "expired_no_event", 5).outcome.expiredNoEvent, true);
});

test("findUnresolvedScreenings: filters by symbol, excludes resolved, sorted oldest first", () => {
  const screenings = [screening("AAPL", "t3"), screening("AAPL", "t1"), screening("AAPL", "t2"), screening("MSFT", "t1")];
  const resolved = new Set(["t2"]);
  const result = findUnresolvedScreenings("AAPL", screenings, resolved);
  assert.deepEqual(result.map((r) => r.screeningTimestamp), ["t1", "t3"]);
});
