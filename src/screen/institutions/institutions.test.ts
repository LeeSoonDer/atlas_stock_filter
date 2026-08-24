import { test } from "node:test";
import assert from "node:assert/strict";
import { computeInstitutionalTrend, appendSnapshot } from "./institutionalTrend.js";
import type { InstitutionalTrendConfig } from "./types.js";

const config: InstitutionalTrendConfig = { institutionalTrend: { minDaysBetweenSnapshots: 60, flatBandPercent: 1 } };
const NOW = new Date("2026-08-24T00:00:00Z");

test("computeInstitutionalTrend: fewer than 2 snapshots -> 不可得", () => {
  const result = computeInstitutionalTrend([{ asOf: "2026-08-24", institutionsPercentHeld: 0.5 }], config, NOW);
  assert.equal(result.availability, "不可得");
  assert.equal(result.trend, null);
});

test("computeInstitutionalTrend: snapshots too close together -> 不可得", () => {
  const history = [
    { asOf: "2026-08-10", institutionsPercentHeld: 0.5 },
    { asOf: "2026-08-24", institutionsPercentHeld: 0.55 }, // 14 days apart, < 60
  ];
  const result = computeInstitutionalTrend(history, config, NOW);
  assert.equal(result.availability, "不可得");
});

test("computeInstitutionalTrend: up, down, and flat within the band", () => {
  const base = "2026-05-01"; // > 60 days before NOW
  const up = computeInstitutionalTrend([{ asOf: base, institutionsPercentHeld: 0.5 }, { asOf: "2026-08-24", institutionsPercentHeld: 0.53 }], config, NOW);
  assert.equal(up.trend, "up");

  const down = computeInstitutionalTrend([{ asOf: base, institutionsPercentHeld: 0.5 }, { asOf: "2026-08-24", institutionsPercentHeld: 0.47 }], config, NOW);
  assert.equal(down.trend, "down");

  const flat = computeInstitutionalTrend([{ asOf: base, institutionsPercentHeld: 0.5 }, { asOf: "2026-08-24", institutionsPercentHeld: 0.505 }], config, NOW);
  assert.equal(flat.trend, "flat");
});

test("appendSnapshot: dedupes same-day re-runs (updates, does not duplicate)", () => {
  const history = [{ asOf: "2026-08-20", institutionsPercentHeld: 0.5 }];
  const updated = appendSnapshot(history, 0.55, new Date("2026-08-20T18:00:00Z"));
  assert.equal(updated.length, 1);
  assert.equal(updated[0].institutionsPercentHeld, 0.55);
});

test("appendSnapshot: a genuinely new day appends", () => {
  const history = [{ asOf: "2026-08-20", institutionsPercentHeld: 0.5 }];
  const updated = appendSnapshot(history, 0.55, new Date("2026-08-24T00:00:00Z"));
  assert.equal(updated.length, 2);
});
