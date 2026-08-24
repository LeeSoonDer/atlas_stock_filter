import { test } from "node:test";
import assert from "node:assert/strict";
import { computeFmpEnrichment } from "./computeFmpEnrichment.js";
import type { FmpConfig } from "./types.js";

const config: FmpConfig = { fmp: { priceMismatchThresholdPercent: 2 } };

test("no ratios and no price -> everything 不可得, never fabricated", () => {
  const result = computeFmpEnrichment(null, null, undefined, config);
  assert.equal(result.peRatioTTMAvailability, "不可得");
  assert.equal(result.priceMismatchAvailability, "不可得");
  assert.equal(result.priceMismatch, null);
});

test("ratios present but individual fields undefined stay 不可得 per-field", () => {
  const result = computeFmpEnrichment({ peRatioTTM: 25.5 }, null, undefined, config);
  assert.equal(result.peRatioTTM, 25.5);
  assert.equal(result.peRatioTTMAvailability, "可得");
  assert.equal(result.pbRatioTTM, null);
  assert.equal(result.pbRatioTTMAvailability, "不可得");
});

test("price deviation within threshold -> priceMismatch false", () => {
  const result = computeFmpEnrichment(null, 101, 100, config); // 1% deviation, threshold 2%
  assert.equal(result.priceDeviationPercent, 1);
  assert.equal(result.priceMismatch, false);
  assert.equal(result.priceMismatchAvailability, "可得");
});

test("price deviation exceeding threshold -> priceMismatch true", () => {
  const result = computeFmpEnrichment(null, 103, 100, config); // 3% deviation, threshold 2%
  assert.equal(result.priceDeviationPercent, 3);
  assert.equal(result.priceMismatch, true);
});

test("price deviation exactly at threshold -> not a mismatch (strictly greater than, per SCOPE's '> 2%')", () => {
  const result = computeFmpEnrichment(null, 102, 100, config); // exactly 2% deviation
  assert.equal(result.priceMismatch, false);
});

test("missing yahooPrice -> price check stays 不可得 even if FMP price exists", () => {
  const result = computeFmpEnrichment(null, 100, undefined, config);
  assert.equal(result.priceMismatchAvailability, "不可得");
});
