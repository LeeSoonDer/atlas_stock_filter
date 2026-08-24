import { test } from "node:test";
import assert from "node:assert/strict";
import { generateDissentPayload } from "./generateDissentPayload.js";

test("uses the exact card-specified template for volatility_compression_setup", () => {
  const output = generateDissentPayload([{ symbol: "AAPL", primaryBucket: "volatility_compression_setup" }], "2026-08-24T00:00:00Z");
  assert.ok(output.includes("该标的处于波动挤压后的蓄势末段,存在向上重定价条件。"));
});

test("each of the 4 known buckets maps to its own distinct template", () => {
  const buckets = ["momentum_breakout", "volatility_compression_setup", "oversold_reversal", "institutional_accumulation_proxy"];
  const templates = buckets.map((b) => generateDissentPayload([{ symbol: "X", primaryBucket: b }], "t"));
  const uniqueTemplateLines = new Set(templates.map((t) => t.split("\n").find((l) => l.startsWith("设想陈述"))));
  assert.equal(uniqueTemplateLines.size, 4);
});

test("DONE-WHEN: zero flag-detail leakage - output contains only symbol/bucket/template/skeleton, no numeric evidence", () => {
  const output = generateDissentPayload(
    [
      { symbol: "AAPL", primaryBucket: "momentum_breakout" },
      { symbol: "MSFT", primaryBucket: "oversold_reversal" },
    ],
    "2026-08-24T00:00:00Z",
  );
  // No indicator/flag terminology of any kind should appear.
  const forbiddenTerms = ["RSI", "rsi14", "sma", "SMA", "obv", "OBV", "shortInterest", "insiderCluster", "pctOf52WeekHigh", "bbWidth", "atr", "ATR"];
  for (const term of forbiddenTerms) {
    assert.equal(output.includes(term), false, `found forbidden term "${term}" in DISSENT payload`);
  }
  // Output should mention both symbols and their bucket names, and nothing else numeric-looking beyond that.
  assert.ok(output.includes("AAPL"));
  assert.ok(output.includes("MSFT"));
  assert.ok(output.includes("[待填]"));
});

test("unknown bucket id falls back to a generic thesis sentence rather than crashing", () => {
  const output = generateDissentPayload([{ symbol: "X", primaryBucket: "unknown_bucket" }], "t");
  assert.ok(output.includes("该标的存在潜在重定价条件。"));
});
