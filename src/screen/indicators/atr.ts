import type { CleanBar } from "./series.js";

/**
 * Wilder's ATR (Average True Range), same smoothing style as RSI.
 * True range at i (i>=1) = max(high-low, |high-prevClose|, |low-prevClose|).
 */
export function atr(bars: CleanBar[], period: number): number | null {
  if (bars.length < period + 1) return null;

  const trueRanges: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const { high, low } = bars[i];
    const prevClose = bars[i - 1].close;
    trueRanges.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
  }

  let value = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trueRanges.length; i++) {
    value = (value * (period - 1) + trueRanges[i]) / period;
  }
  return value;
}

export function atrPct(atrValue: number | null, latestClose: number | null): number | null {
  if (atrValue === null || latestClose === null || latestClose === 0) return null;
  return atrValue / latestClose;
}
