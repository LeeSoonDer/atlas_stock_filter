import { test } from "node:test";
import assert from "node:assert/strict";
import { computeCreditRegime } from "./computeCreditRegime.js";
import { computeRiskLevel } from "./types.js";
import type { CreditRegimeConfig } from "./types.js";
import type { FredObservation } from "../../data/fred/types.js";

const config: CreditRegimeConfig = {
  creditRegime: { looseMaxBp: 350, tightMinBp: 450, divergentWideningBp: 50, lookbackTradingDays: 10 },
};

/** Builds a flat-then-latest-move series: `lookbackTradingDays` days at `pastPct`, then one final day at `currentPct`. */
function flatThenMove(pastPct: number, currentPct: number, lookbackTradingDays: number): FredObservation[] {
  const obs: FredObservation[] = [];
  for (let i = 0; i <= lookbackTradingDays; i++) {
    obs.push({ date: `2024-01-${String(i + 1).padStart(2, "0")}`, value: i === lookbackTradingDays ? currentPct : pastPct });
  }
  return obs;
}

test("computeCreditRegime: null observations (no key / fetch failed) -> unknown, does not block", () => {
  const result = computeCreditRegime(null, config);
  assert.equal(result.label, "unknown");
  assert.match(result.labelUnavailableReason ?? "", /FRED_API_KEY|fetch/);
});

test("computeCreditRegime: fewer valid prints than the lookback window -> unknown", () => {
  const obs: FredObservation[] = [{ date: "2024-01-01", value: 3.5 }, { date: "2024-01-02", value: null }];
  const result = computeCreditRegime(obs, config);
  assert.equal(result.label, "unknown");
  assert.match(result.labelUnavailableReason ?? "", /insufficient/);
});

test("computeCreditRegime: loose - under 350bp and declining over the lookback window", () => {
  const obs = flatThenMove(3.8, 3.2, 10); // 380bp -> 320bp, declining, under 350bp
  const result = computeCreditRegime(obs, config);
  assert.equal(result.oasCurrentBp, 320);
  assert.equal(result.oasChangeBp, -60);
  assert.equal(result.label, "loose");
});

test("computeCreditRegime: tight via absolute level over 450bp, even if not widening", () => {
  const obs = flatThenMove(4.6, 4.7, 10); // 460bp -> 470bp, already above tightMinBp
  const result = computeCreditRegime(obs, config);
  assert.equal(result.oasCurrentBp, 470);
  assert.equal(result.label, "tight");
});

test("computeCreditRegime: tight via divergent widening >50bp even though absolute stays under 450bp - amendment's OR is literal, checked before loose", () => {
  const obs = flatThenMove(2.0, 2.65, 10); // 200bp -> 265bp, +65bp change, absolute well under both loose and tight abs thresholds' overlap
  const result = computeCreditRegime(obs, config);
  assert.equal(result.oasChangeBp, 65);
  assert.equal(result.label, "tight");
});

test("computeCreditRegime: neutral - between the two absolute bands, no divergent widening", () => {
  const obs = flatThenMove(3.9, 4.0, 10); // 390bp -> 400bp: not <350 (not loose), not >450 and change=10bp<50 (not tight)
  const result = computeCreditRegime(obs, config);
  assert.equal(result.label, "neutral");
});

test("computeCreditRegime: neutral - under 350bp but NOT declining (loose requires decline, not just low level)", () => {
  const obs = flatThenMove(3.0, 3.4, 10); // 300bp -> 340bp: under 350bp but rising, so not loose; not tight either
  const result = computeCreditRegime(obs, config);
  assert.equal(result.label, "neutral");
});

/**
 * DONE-WHEN: "可用历史值人工验证:2020年3月应判 tight". No FRED_API_KEY is
 * configured in this environment (no .env file present - see
 * ai/decisions.md), so this cannot be a live API call. Instead this
 * hand-constructs a monotonic ramp anchored on two WebSearch-verified real
 * published figures for BAMLH0A0HYM2 (not from memory): ~360bp in mid-
 * February 2020 (pre-shock baseline) rising to a widely-reported ~1087bp
 * closing print on 2020-03-23 (the COVID credit-shock peak, "22 business
 * days from tights to wides" per multiple financial-press sources). The
 * day-to-day interpolation between those two anchors is synthetic (real
 * FRED prints were not this smooth), but the two anchor values themselves
 * are sourced, and the classification only depends on the last
 * (lookbackTradingDays+1) points, which this ramp keeps monotonically
 * rising through the endpoint - a fair proxy for "does 2020-03 read as
 * tight", which is the DONE-WHEN's actual question.
 */
test("computeCreditRegime: DONE-WHEN historical check - 2020-03 COVID credit shock classifies as tight", () => {
  const businessDays = 22; // documented "tights to wides" window
  const startPct = 3.6; // ~360bp mid-Feb 2020
  const endPct = 10.87; // ~1087bp 2020-03-23 close
  const obs: FredObservation[] = [];
  for (let i = 0; i <= businessDays; i++) {
    const pct = startPct + ((endPct - startPct) * i) / businessDays;
    obs.push({ date: `2020-03-${String(i + 1).padStart(2, "0")}`, value: pct });
  }
  const result = computeCreditRegime(obs, config);
  assert.ok(result.oasCurrentBp !== null && result.oasCurrentBp > config.creditRegime.tightMinBp, `expected current OAS well above ${config.creditRegime.tightMinBp}bp, got ${result.oasCurrentBp}`);
  assert.equal(result.label, "tight");
});

test("computeRiskLevel: STANDARD (non-speculative), credit not tight -> normal", () => {
  assert.equal(computeRiskLevel(false, false), "normal");
});
test("computeRiskLevel: SMALL_SPEC (speculative), credit not tight -> elevated (baseline)", () => {
  assert.equal(computeRiskLevel(true, false), "elevated");
});
test("computeRiskLevel: STANDARD, credit tight -> bumped one level to elevated", () => {
  assert.equal(computeRiskLevel(false, true), "elevated");
});
test("computeRiskLevel: SMALL_SPEC, credit tight -> bumped one level to high", () => {
  assert.equal(computeRiskLevel(true, true), "high");
});
