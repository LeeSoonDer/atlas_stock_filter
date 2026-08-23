import { lastN } from "./series.js";
import { percentileRank } from "./percentile.js";

/** Bollinger Band width ((upper - lower) / middle) for every day with enough trailing data. Aligned to the tail of `closes`. */
export function bollingerWidthSeries(closes: number[], period: number, stdDevMultiplier: number): number[] {
  const out: number[] = [];
  for (let i = period - 1; i < closes.length; i++) {
    const window = closes.slice(i - period + 1, i + 1);
    const mean = window.reduce((a, b) => a + b, 0) / period;
    const variance = window.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
    const std = Math.sqrt(variance);
    const upper = mean + stdDevMultiplier * std;
    const lower = mean - stdDevMultiplier * std;
    out.push(mean === 0 ? 0 : (upper - lower) / mean);
  }
  return out;
}

export interface BollingerWidthResult {
  latest: number | null;
  percentile: number | null;
}

export function bollingerWidthWithPercentile(
  closes: number[],
  period: number,
  stdDevMultiplier: number,
  percentileWindow: number,
): BollingerWidthResult {
  const widths = bollingerWidthSeries(closes, period, stdDevMultiplier);
  if (widths.length === 0) return { latest: null, percentile: null };
  const latest = widths[widths.length - 1];
  if (widths.length < percentileWindow) return { latest, percentile: null };
  const window = lastN(widths, percentileWindow);
  return { latest, percentile: percentileRank(window, latest) };
}
