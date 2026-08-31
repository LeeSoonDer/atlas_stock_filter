import { test } from "node:test";
import assert from "node:assert/strict";
import { selectCandidates } from "./selectCandidates.js";
import type { SelectableSymbol, SelectConfig } from "./types.js";

const config: SelectConfig = { select: { maxCandidates: 5, maxWatchlist: 10 }, footprintStrengthBands: [{ minRatio: 0, band: "弱" }] };

function sym(symbol: string, buckets: string[], bucketScores: Record<string, number>): SelectableSymbol {
  return { symbol, profile: "STANDARD", buckets, bucketScores, flags: {} as never };
}

test("round robin cycles A->B->C->D, one pick per bucket per round, until maxCandidates fills", () => {
  const symbols: SelectableSymbol[] = [
    sym("A1", ["momentum_breakout"], { momentum_breakout: 90 }),
    sym("A2", ["momentum_breakout"], { momentum_breakout: 80 }),
    sym("B1", ["volatility_compression_setup"], { volatility_compression_setup: 70 }),
    sym("C1", ["oversold_reversal"], { oversold_reversal: 60 }),
    sym("D1", ["institutional_accumulation_proxy"], { institutional_accumulation_proxy: 50 }),
    sym("D2", ["institutional_accumulation_proxy"], { institutional_accumulation_proxy: 95 }),
  ];
  const candidates = selectCandidates(symbols, new Set(), config);
  assert.equal(candidates.length, 5);
  // Round 1: A1 (best in A), B1, C1, D2 (best in D, score 95 > D1's 50). Round 2: A2 (5th seat).
  assert.deepEqual(candidates.map((c) => c.symbol), ["A1", "B1", "C1", "D2", "A2"]);
});

test("a symbol hitting multiple buckets is assigned only to its highest-scoring bucket, one seat only", () => {
  const symbols: SelectableSymbol[] = [
    sym("Multi", ["momentum_breakout", "oversold_reversal"], { momentum_breakout: 40, oversold_reversal: 85 }),
    sym("A1", ["momentum_breakout"], { momentum_breakout: 90 }),
  ];
  const candidates = selectCandidates(symbols, new Set(), config);
  assert.equal(candidates.length, 2);
  const multi = candidates.find((c) => c.symbol === "Multi")!;
  assert.equal(multi.primaryBucket, "oversold_reversal"); // higher score (85 > 40)
  assert.deepEqual(multi.allBucketsHit, ["momentum_breakout", "oversold_reversal"]); // transparency field still lists both
});

test("empty buckets exhaust gracefully - fewer than maxCandidates if not enough symbols exist", () => {
  const symbols: SelectableSymbol[] = [sym("Only1", ["oversold_reversal"], { oversold_reversal: 50 })];
  const candidates = selectCandidates(symbols, new Set(), config);
  assert.equal(candidates.length, 1);
});

test("promoted symbols (previously watchlisted, now fully triggering) get priority seats first, sorted by score", () => {
  const symbols: SelectableSymbol[] = [
    sym("HighScore", ["momentum_breakout"], { momentum_breakout: 95 }),
    sym("PromotedLow", ["oversold_reversal"], { oversold_reversal: 30 }),
    sym("PromotedHigh", ["volatility_compression_setup"], { volatility_compression_setup: 60 }),
  ];
  const previousWatchlist = new Set(["PromotedLow", "PromotedHigh"]);
  const candidates = selectCandidates(symbols, previousWatchlist, config);
  // Promoted symbols go first (sorted by their own score: PromotedHigh 60 > PromotedLow 30), then normal round robin fills the rest.
  assert.deepEqual(
    candidates.map((c) => c.symbol),
    ["PromotedHigh", "PromotedLow", "HighScore"],
  );
  assert.equal(candidates.find((c) => c.symbol === "PromotedHigh")!.promoted, true);
  assert.equal(candidates.find((c) => c.symbol === "HighScore")!.promoted, false);
});

test("a previously-watchlisted symbol that still doesn't trigger any bucket is not promoted", () => {
  const symbols: SelectableSymbol[] = [sym("StillWaiting", [], {})];
  const candidates = selectCandidates(symbols, new Set(["StillWaiting"]), config);
  assert.equal(candidates.length, 0);
});
