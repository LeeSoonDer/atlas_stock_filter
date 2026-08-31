import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateProfileGate, shouldForceDisableSmallSpec } from "./pipeline.js";
import type { ProfileName, ProfilesConfig } from "./types.js";
import type { QuoteSlice } from "../data/types.js";

const config: ProfilesConfig = {
  STANDARD: { minMarketCap: 300_000_000, maxMarketCap: null, minAvgDollarVolume: 5_000_000, minPrice: 5, speculative: false },
  SMALL_SPEC: { minMarketCap: 50_000_000, maxMarketCap: 300_000_000, minAvgDollarVolume: 1_000_000, minPrice: 1, speculative: true },
};

function quote(overrides: Partial<QuoteSlice>): QuoteSlice {
  return {
    symbol: "TEST",
    fetchedAt: "2026-01-01T00:00:00Z",
    marketCapAvailability: "可得",
    avgDollarVolumeAvailability: "可得",
    marketCap: 500_000_000,
    avgDollarVolume: 10_000_000,
    regularMarketPrice: 20,
    ...overrides,
  };
}

test("TASK_CARD_08 Part B: STANDARD-sized symbol below the $5 price gate is excluded from both profiles", () => {
  const result = evaluateProfileGate(quote({ regularMarketPrice: 4.99 }), config);
  assert.equal(result, null);
});

test("TASK_CARD_08 Part B: STANDARD-sized symbol at exactly $5 passes (>=, not >)", () => {
  const result = evaluateProfileGate(quote({ regularMarketPrice: 5 }), config);
  assert.equal(result?.profile, "STANDARD");
});

test("TASK_CARD_08 Part B: SMALL_SPEC-sized symbol at $1.50 passes its own $1 gate", () => {
  const result = evaluateProfileGate(
    quote({ marketCap: 100_000_000, avgDollarVolume: 2_000_000, regularMarketPrice: 1.5 }),
    config,
  );
  assert.equal(result?.profile, "SMALL_SPEC");
});

test("TASK_CARD_08 Part B: SMALL_SPEC-sized symbol below its own $1 price gate is excluded", () => {
  const result = evaluateProfileGate(
    quote({ marketCap: 100_000_000, avgDollarVolume: 2_000_000, regularMarketPrice: 0.5 }),
    config,
  );
  assert.equal(result, null);
});

test("TASK_CARD_08 Part B: missing price data (undefined) excludes rather than assuming pass", () => {
  const result = evaluateProfileGate(quote({ regularMarketPrice: undefined }), config);
  assert.equal(result, null);
});

test("pre-existing market cap / dollar volume gate behavior is unchanged by the price gate addition", () => {
  const result = evaluateProfileGate(quote({ marketCap: 1_000_000, avgDollarVolume: 100 }), config);
  assert.equal(result, null);
});

// TASK_CARD_08 Part A DONE-WHEN: "人工构造tight状态测试:SMALL_SPEC确实被禁用" - hand-constructed, no live FRED call needed.
test("shouldForceDisableSmallSpec: --profile both + credit tight -> SMALL_SPEC forced off", () => {
  const requested = new Set<ProfileName>(["STANDARD", "SMALL_SPEC"]);
  assert.equal(shouldForceDisableSmallSpec(requested, "tight"), true);
});
test("shouldForceDisableSmallSpec: --profile small_spec + credit tight -> forced off (explicit CLI request does not override)", () => {
  const requested = new Set<ProfileName>(["SMALL_SPEC"]);
  assert.equal(shouldForceDisableSmallSpec(requested, "tight"), true);
});
test("shouldForceDisableSmallSpec: --profile standard + credit tight -> false (nothing to disable, SMALL_SPEC wasn't requested)", () => {
  const requested = new Set<ProfileName>(["STANDARD"]);
  assert.equal(shouldForceDisableSmallSpec(requested, "tight"), false);
});
test("shouldForceDisableSmallSpec: credit loose/neutral/unknown -> never forces SMALL_SPEC off", () => {
  const requested = new Set<ProfileName>(["STANDARD", "SMALL_SPEC"]);
  assert.equal(shouldForceDisableSmallSpec(requested, "loose"), false);
  assert.equal(shouldForceDisableSmallSpec(requested, "neutral"), false);
  assert.equal(shouldForceDisableSmallSpec(requested, "unknown"), false);
});
