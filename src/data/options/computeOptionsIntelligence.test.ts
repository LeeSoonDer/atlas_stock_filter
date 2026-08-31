import { test } from "node:test";
import assert from "node:assert/strict";
import { computeOptionsIntelligence } from "./computeOptionsIntelligence.js";
import type { OptionsConfig, OptionsHistorySnapshot, RawOptionsChain } from "./types.js";

const config: OptionsConfig = {
  options: { volumeOiRatioAnomalyThreshold: 3, nearOtmCallMinPct: 0.15, nearOtmCallMaxPct: 0.3, ivMoveAvgWindowDays: 20 },
};

test("null chain (fetch failed) -> 不可得, all fields null, never fabricated", () => {
  const { intelligence } = computeOptionsIntelligence(null, [], config);
  assert.equal(intelligence.availability, "不可得");
  assert.equal(intelligence.volumeOiRatioMax, null);
  assert.equal(intelligence.nearOtmCallOi, null);
  assert.equal(intelligence.putCallRatio, null);
  assert.equal(intelligence.atmImpliedVol, null);
});

test("volume/OI anomaly: max ratio above threshold across calls+puts is flagged", () => {
  const chain: RawOptionsChain = {
    underlyingPrice: 100,
    calls: [{ strike: 100, volume: 350, openInterest: 100, impliedVolatility: 0.4, inTheMoney: false }],
    puts: [{ strike: 100, volume: 10, openInterest: 100, impliedVolatility: 0.4, inTheMoney: false }],
  };
  const { intelligence } = computeOptionsIntelligence(chain, [], config);
  assert.equal(intelligence.volumeOiRatioMax, 3.5);
  assert.equal(intelligence.volumeOiRatioAnomaly, true);
});

test("volume/OI: zero or missing openInterest contracts are skipped, not treated as a zero ratio", () => {
  const chain: RawOptionsChain = {
    underlyingPrice: 100,
    calls: [
      { strike: 100, volume: 10, openInterest: 0, impliedVolatility: 0.4, inTheMoney: false },
      { strike: 105, volume: null, openInterest: 50, impliedVolatility: 0.4, inTheMoney: false },
      { strike: 110, volume: 20, openInterest: 40, impliedVolatility: 0.4, inTheMoney: false }, // ratio 0.5, the only valid one
    ],
    puts: [],
  };
  const { intelligence } = computeOptionsIntelligence(chain, [], config);
  assert.equal(intelligence.volumeOiRatioMax, 0.5);
  assert.equal(intelligence.volumeOiRatioAnomaly, false);
});

test("nearOtmCallOi: sums call OI only within the configured 15-30% OTM band, excludes strikes outside it", () => {
  const chain: RawOptionsChain = {
    underlyingPrice: 100,
    calls: [
      { strike: 105, volume: 0, openInterest: 999, impliedVolatility: 0.3, inTheMoney: false }, // 5% OTM - below band
      { strike: 118, volume: 0, openInterest: 300, impliedVolatility: 0.3, inTheMoney: false }, // 18% OTM - in band
      { strike: 125, volume: 0, openInterest: 200, impliedVolatility: 0.3, inTheMoney: false }, // 25% OTM - in band
      { strike: 140, volume: 0, openInterest: 999, impliedVolatility: 0.3, inTheMoney: false }, // 40% OTM - above band
    ],
    puts: [],
  };
  const { intelligence } = computeOptionsIntelligence(chain, [], config);
  assert.equal(intelligence.nearOtmCallOi, 500); // 300 + 200
});

test("putCallRatio: total put volume / total call volume across the full near-month chain", () => {
  const chain: RawOptionsChain = {
    underlyingPrice: 100,
    calls: [{ strike: 100, volume: 200, openInterest: 10, impliedVolatility: 0.3, inTheMoney: false }],
    puts: [{ strike: 100, volume: 50, openInterest: 10, impliedVolatility: 0.3, inTheMoney: false }],
  };
  const { intelligence } = computeOptionsIntelligence(chain, [], config);
  assert.equal(intelligence.putCallRatio, 0.25);
});

test("putCallRatio: zero call volume -> null, not a divide-by-zero Infinity", () => {
  const chain: RawOptionsChain = {
    underlyingPrice: 100,
    calls: [{ strike: 100, volume: 0, openInterest: 10, impliedVolatility: 0.3, inTheMoney: false }],
    puts: [{ strike: 100, volume: 50, openInterest: 10, impliedVolatility: 0.3, inTheMoney: false }],
  };
  const { intelligence } = computeOptionsIntelligence(chain, [], config);
  assert.equal(intelligence.putCallRatio, null);
});

test("atmImpliedVol: averages the closest-strike call and put IV to the underlying price", () => {
  const chain: RawOptionsChain = {
    underlyingPrice: 100,
    calls: [
      { strike: 95, volume: 0, openInterest: 10, impliedVolatility: 0.9, inTheMoney: true },
      { strike: 100, volume: 0, openInterest: 10, impliedVolatility: 0.4, inTheMoney: false }, // closest call
    ],
    puts: [{ strike: 101, volume: 0, openInterest: 10, impliedVolatility: 0.5, inTheMoney: false }], // closest (only) put
  };
  const { intelligence } = computeOptionsIntelligence(chain, [], config);
  assert.equal(intelligence.atmImpliedVol, 0.45); // (0.4 + 0.5) / 2
});

test("ivMove: null when there is no prior run history to compare against", () => {
  const chain: RawOptionsChain = { underlyingPrice: 100, calls: [{ strike: 100, volume: 0, openInterest: 10, impliedVolatility: 0.5, inTheMoney: false }], puts: [] };
  const { intelligence } = computeOptionsIntelligence(chain, [], config);
  assert.equal(intelligence.ivMove, null);
});

test("ivMove: current ATM IV minus the average of prior run snapshots (trailing run-count window, not calendar days)", () => {
  const chain: RawOptionsChain = { underlyingPrice: 100, calls: [{ strike: 100, volume: 0, openInterest: 10, impliedVolatility: 0.6, inTheMoney: false }], puts: [] };
  const prior: OptionsHistorySnapshot[] = [
    { asOf: "r1", atmImpliedVol: 0.4, nearOtmCallOi: null, putCallRatio: null },
    { asOf: "r2", atmImpliedVol: 0.5, nearOtmCallOi: null, putCallRatio: null },
  ];
  const { intelligence } = computeOptionsIntelligence(chain, prior, config);
  assert.ok(intelligence.ivMove !== null);
  assert.ok(Math.abs(intelligence.ivMove! - (0.6 - 0.45)) < 1e-9);
});

test("nearOtmCallOiChange / putCallRatioChange: vs the single immediately-prior run's snapshot", () => {
  const chain: RawOptionsChain = {
    underlyingPrice: 100,
    calls: [{ strike: 120, volume: 100, openInterest: 500, impliedVolatility: 0.3, inTheMoney: false }],
    puts: [{ strike: 100, volume: 50, openInterest: 10, impliedVolatility: 0.3, inTheMoney: false }],
  };
  const prior: OptionsHistorySnapshot[] = [{ asOf: "r1", atmImpliedVol: 0.3, nearOtmCallOi: 300, putCallRatio: 0.1 }];
  const { intelligence, snapshot } = computeOptionsIntelligence(chain, prior, config);
  assert.equal(intelligence.nearOtmCallOi, 500);
  assert.equal(intelligence.nearOtmCallOiChange, 200); // 500 - 300
  assert.ok(intelligence.putCallRatioChange !== null);
  assert.equal(snapshot.nearOtmCallOi, 500); // the new snapshot to append for the NEXT run's comparison
});

test("the returned snapshot always reflects this run's own values, ready for the caller to append to history", () => {
  const chain: RawOptionsChain = { underlyingPrice: 50, calls: [{ strike: 50, volume: 0, openInterest: 0, impliedVolatility: 0.25, inTheMoney: false }], puts: [] };
  const { snapshot } = computeOptionsIntelligence(chain, [], config);
  assert.equal(snapshot.atmImpliedVol, 0.25);
});
