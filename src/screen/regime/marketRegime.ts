import { sma } from "../indicators/sma.js";
import type { SectorRanking } from "../sector/types.js";
import type { MarketRegimeSnapshot, RegimeConfig } from "./types.js";

function smaSeries(closes: number[], window: number): number[] {
  const out: number[] = [];
  for (let i = window - 1; i < closes.length; i++) {
    const slice = closes.slice(i - window + 1, i + 1);
    out.push(slice.reduce((a, b) => a + b, 0) / window);
  }
  return out;
}

/** Least-squares slope of a value series against its own index (0..n-1). Same method as indicators/obv.ts's obvSlope, duplicated locally (small, self-contained) rather than importing across the indicators/regime boundary for an unrelated series type. */
function leastSquaresSlope(values: number[]): number | null {
  const n = values.length;
  if (n === 0) return null;
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((a, b) => a + b, 0) / n;
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (values[i] - yMean);
    denominator += (i - xMean) ** 2;
  }
  return denominator === 0 ? null : numerator / denominator;
}

/**
 * Market environment snapshot (TASK_CARD_03 SCOPE 3), computed once per
 * run - descriptive only, never changes screening/gate behavior.
 *
 * Label rule (documented per SCOPE 3's requirement): 3 boolean signals -
 * SPY above its SMA200, SMA200 itself trending up (least-squares slope
 * over the trailing spySmaSlopeWindow days), and VIX below its own
 * 20-day average. VIX at or above vixElevatedThreshold overrides
 * everything to 逆风 (elevated fear dominates trend signals regardless
 * of what SPY is doing). Otherwise: >=2 bullish signals -> 顺风,
 * exactly 1 -> 中性, 0 -> 逆风.
 */
export function computeMarketRegime(
  spyCloses: number[],
  vixCloses: number[],
  sectorRankings: SectorRanking[],
  config: RegimeConfig,
): MarketRegimeSnapshot {
  const c = config.regime;
  const asOf = new Date().toISOString();

  const rankedOnly = sectorRankings.filter((r) => r.compositeRank !== null).sort((a, b) => a.compositeRank! - b.compositeRank!);
  const leadingSectors = rankedOnly.filter((r) => r.classification === "tailwind");
  const laggingSectors = [...rankedOnly].reverse().filter((r) => r.classification === "headwind");

  const spySmaValues = smaSeries(spyCloses, c.spySmaWindow);
  const spySma200 = spySmaValues.length > 0 ? spySmaValues[spySmaValues.length - 1] : null;
  const spySma200Slope = leastSquaresSlope(spySmaValues.slice(-c.spySmaSlopeWindow));
  const spyLatestClose = spyCloses.length > 0 ? spyCloses[spyCloses.length - 1] : null;
  const spyCloseVsSma200 = spyLatestClose !== null && spySma200 !== null ? (spyLatestClose > spySma200 ? "above" : "below") : null;

  const vixCurrent = vixCloses.length > 0 ? vixCloses[vixCloses.length - 1] : null;
  const vixAvg20 = sma(vixCloses, c.vixAvgWindow);

  const base: Omit<MarketRegimeSnapshot, "label" | "labelUnavailableReason"> = {
    asOf,
    spyLatestClose,
    spySma200,
    spyCloseVsSma200,
    spySma200Slope,
    vixCurrent,
    vixAvg20,
    leadingSectors,
    laggingSectors,
  };

  if (spyLatestClose === null || spySma200 === null || spySma200Slope === null || vixCurrent === null || vixAvg20 === null) {
    return { ...base, label: null, labelUnavailableReason: "insufficient SPY/VIX history for this run" };
  }

  if (vixCurrent >= c.vixElevatedThreshold) {
    return { ...base, label: "逆风", labelUnavailableReason: null };
  }

  const bullishSignals = [spyLatestClose > spySma200, spySma200Slope > 0, vixCurrent < vixAvg20].filter(Boolean).length;
  const label = bullishSignals >= 2 ? "顺风" : bullishSignals === 1 ? "中性" : "逆风";
  return { ...base, label, labelUnavailableReason: null };
}
