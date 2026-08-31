import type { FredObservation } from "../../data/fred/types.js";
import type { CreditRegimeConfig, CreditRegimeSnapshot } from "./types.js";

/**
 * TASK_CARD_08 Part A / constitution Amendment No.5 修正案十四.
 *
 * Classifies the current high-yield credit environment from a FRED
 * BAMLH0A0HYM2 (ICE BofA US HY OAS) observation history, most-recent-last.
 * FRED reports this series in percentage points (e.g. "3.60" = 360bp) -
 * every threshold in config/credit.json is in bp, so values are ×100 here.
 *
 * `oasPastBp` is the value `lookbackTradingDays` valid (non-".") prints
 * back from the latest one - an approximation of "两周前" using trading-day
 * count rather than calendar days, since FRED's daily series only prints on
 * business days already. `oasChangeBp` positive = spread widening (risk-off).
 *
 * tight is checked before loose: the amendment's OR condition ("利差高于
 * 450bp，或两周内发散上行超过50bp") treats a fast widening move as an
 * independent trigger regardless of the absolute level - a low-but-rapidly-
 * widening spread (e.g. 200bp -> 265bp) is tight, not loose, by the
 * amendment's literal text.
 */
export function computeCreditRegime(observations: FredObservation[] | null, config: CreditRegimeConfig): CreditRegimeSnapshot {
  const c = config.creditRegime;
  const asOf = new Date().toISOString();

  if (!observations) {
    return {
      asOf,
      oasCurrentBp: null,
      oasPastBp: null,
      oasChangeBp: null,
      label: "unknown",
      labelUnavailableReason: "FRED OAS series unavailable this run (FRED_API_KEY unset or the request failed)",
    };
  }

  const valid = observations.filter((o): o is { date: string; value: number } => o.value !== null);
  if (valid.length <= c.lookbackTradingDays) {
    return {
      asOf,
      oasCurrentBp: null,
      oasPastBp: null,
      oasChangeBp: null,
      label: "unknown",
      labelUnavailableReason: "insufficient OAS history for the configured lookback window",
    };
  }

  const oasCurrentBp = valid[valid.length - 1].value * 100;
  const oasPastBp = valid[valid.length - 1 - c.lookbackTradingDays].value * 100;
  const oasChangeBp = oasCurrentBp - oasPastBp;

  if (oasCurrentBp > c.tightMinBp || oasChangeBp > c.divergentWideningBp) {
    return { asOf, oasCurrentBp, oasPastBp, oasChangeBp, label: "tight", labelUnavailableReason: null };
  }
  if (oasCurrentBp < c.looseMaxBp && oasChangeBp < 0) {
    return { asOf, oasCurrentBp, oasPastBp, oasChangeBp, label: "loose", labelUnavailableReason: null };
  }
  return { asOf, oasCurrentBp, oasPastBp, oasChangeBp, label: "neutral", labelUnavailableReason: null };
}
