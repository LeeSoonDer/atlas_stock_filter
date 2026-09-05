import { test } from "node:test";
import assert from "node:assert/strict";
import { computeBreadth, computeConcentrationWarnings } from "./computeBreadth.js";
import type { BreadthConfig, BreadthSymbolInput } from "./types.js";

const config: BreadthConfig = {
  breadth: {
    healthyAboveSma200Pct: 55,
    weakAboveSma200Pct: 35,
    newHighLowRatioNarrowingBand: 1.5,
    weakNewLowRatio: 2.0,
    minSymbolsForAggregation: 10,
  },
  concentration: { minSameSectorCount: 3 },
};

/** `aboveCount` of `total` symbols sit above both MAs; the rest sit below. A "new high" symbol's latest BAR reaches its 52-week high (it need not close there). */
function universe(total: number, aboveCount: number, newHighs = 0, newLows = 0): BreadthSymbolInput[] {
  return Array.from({ length: total }, (_, i) => {
    const above = i < aboveCount;
    const isNewHigh = i < newHighs;
    const isNewLow = i >= total - newLows;
    const close = isNewHigh ? 195 : isNewLow ? 55 : above ? 120 : 80;
    return {
      latestClose: close,
      // Intraday range around the close - a new-high symbol prints 200 (its
      // 52-week high) intraday but closes at 195, the realistic case that
      // the old close-vs-high comparison missed entirely.
      latestHigh: isNewHigh ? 200 : close + 1,
      latestLow: isNewLow ? 50 : close - 1,
      sma50: 100,
      sma200: 100,
      week52High: isNewHigh ? 200 : 300,
      week52Low: isNewLow ? 50 : 10,
    };
  });
}

test("healthy: >55% above SMA200 and new highs decisively outnumber new lows", () => {
  const snapshot = computeBreadth(universe(100, 70, 20, 2), "above", config);
  assert.equal(snapshot.state, "healthy");
  assert.equal(snapshot.breadthDivergence, false);
  assert.ok(snapshot.pctAboveSma200! > 55);
});

test("weak: below the 35% SMA200 floor", () => {
  const snapshot = computeBreadth(universe(100, 20, 5, 5), "below", config);
  assert.equal(snapshot.state, "weak");
});

test("weak on new-low dominance alone, even with an acceptable SMA200 percentage", () => {
  const snapshot = computeBreadth(universe(100, 60, 3, 30), "below", config);
  assert.equal(snapshot.state, "weak");
});

test("narrowing: in the middle band, or highs and lows too close to call", () => {
  const midBand = computeBreadth(universe(100, 45, 10, 8), "above", config);
  assert.equal(midBand.state, "narrowing");

  const highsLowsClose = computeBreadth(universe(100, 70, 11, 10), "above", config);
  assert.equal(highsLowsClose.state, "narrowing"); // ratio 1.1 sits inside the narrowing band
});

test("DONE-WHEN: breadth_divergence fires only when SPY is above its 200-line AND internals read weak", () => {
  const diverging = computeBreadth(universe(100, 20, 2, 20), "above", config);
  assert.equal(diverging.state, "weak");
  assert.equal(diverging.breadthDivergence, true);

  const weakButIndexAlsoWeak = computeBreadth(universe(100, 20, 2, 20), "below", config);
  assert.equal(weakButIndexAlsoWeak.breadthDivergence, false); // internals weak and index weak agree - no divergence

  const healthyIndexAbove = computeBreadth(universe(100, 70, 20, 2), "above", config);
  assert.equal(healthyIndexAbove.breadthDivergence, false);
});

test("a symbol that TRADED at its 52-week high but closed below it still counts as a new high (the close-only comparison missed these)", () => {
  const snapshot = computeBreadth(
    [
      // Prints 200 intraday (its own 52-week high), closes at 195.
      { latestClose: 195, latestHigh: 200, latestLow: 190, sma50: 100, sma200: 100, week52High: 200, week52Low: 10 },
      // Prints 50 intraday (its own 52-week low), closes at 55.
      { latestClose: 55, latestHigh: 60, latestLow: 50, sma50: 100, sma200: 100, week52High: 300, week52Low: 50 },
    ],
    "above",
    { ...config, breadth: { ...config.breadth, minSymbolsForAggregation: 1 } },
  );
  assert.equal(snapshot.newHighCount, 1);
  assert.equal(snapshot.newLowCount, 1);
});

test("symbols without a computable SMA200 are excluded from the denominator, not counted as 'not above'", () => {
  const withNulls: BreadthSymbolInput[] = [
    ...universe(20, 20),
    ...Array.from({ length: 80 }, () => ({ latestClose: 100, latestHigh: 101, latestLow: 99, sma50: null, sma200: null, week52High: null, week52Low: null })),
  ];
  const snapshot = computeBreadth(withNulls, "above", config);
  assert.equal(snapshot.pctAboveSma200, 100); // 20/20 of those that HAD an SMA200, not 20/100
  assert.equal(snapshot.sma200SampleSize, 20);
});

test("too few symbols with a computable SMA200 -> unknown with a stated reason, never a percentage of a handful", () => {
  const snapshot = computeBreadth(universe(5, 3), "above", config); // minSymbolsForAggregation = 10
  assert.equal(snapshot.state, "unknown");
  assert.equal(snapshot.breadthDivergence, false);
  assert.ok(snapshot.stateUnavailableReason !== null);
});

test("zero new lows -> null ratio (undefined), not a fabricated 'infinitely healthy' number", () => {
  const snapshot = computeBreadth(universe(100, 70, 20, 0), "above", config);
  assert.equal(snapshot.newHighLowRatio, null);
  assert.equal(snapshot.newLowCount, 0);
});

test("concentration: sectors at or above the threshold are reported with counts and tickers, sorted by count", () => {
  const warnings = computeConcentrationWarnings(
    [
      { symbol: "A", sector: "Technology" },
      { symbol: "B", sector: "Technology" },
      { symbol: "C", sector: "Technology" },
      { symbol: "D", sector: "Technology" },
      { symbol: "E", sector: "Energy" },
      { symbol: "F", sector: "Energy" },
      { symbol: "G", sector: "Energy" },
      { symbol: "H", sector: "Healthcare" },
    ],
    config,
  );
  assert.equal(warnings.length, 2);
  assert.equal(warnings[0].sector, "Technology");
  assert.equal(warnings[0].count, 4);
  assert.deepEqual(warnings[0].symbols, ["A", "B", "C", "D"]);
  assert.equal(warnings[1].sector, "Energy");
});

test("concentration: below the threshold -> no warning at all (2 of the same sector is not a warning)", () => {
  const warnings = computeConcentrationWarnings(
    [
      { symbol: "A", sector: "Technology" },
      { symbol: "B", sector: "Technology" },
    ],
    config,
  );
  assert.deepEqual(warnings, []);
});

test("concentration: symbols with no sector are skipped, never grouped under a fabricated bucket", () => {
  const warnings = computeConcentrationWarnings(
    [
      { symbol: "A", sector: undefined },
      { symbol: "B", sector: undefined },
      { symbol: "C", sector: undefined },
    ],
    config,
  );
  assert.deepEqual(warnings, []);
});
