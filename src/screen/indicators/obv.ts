import type { CleanBar } from "./series.js";
import { lastN } from "./series.js";

/** On-Balance Volume, full series aligned 1:1 with `bars` (obv[0] = 0). */
export function obvSeries(bars: CleanBar[]): number[] {
  const out: number[] = [];
  let running = 0;
  for (let i = 0; i < bars.length; i++) {
    if (i > 0) {
      if (bars[i].close > bars[i - 1].close) running += bars[i].volume;
      else if (bars[i].close < bars[i - 1].close) running -= bars[i].volume;
    }
    out.push(running);
  }
  return out;
}

/** Least-squares slope of the trailing `window` OBV values against day index (0..window-1). */
export function obvSlope(obv: number[], window: number): number | null {
  if (obv.length < window) return null;
  const y = lastN(obv, window);
  const n = window;
  const xMean = (n - 1) / 2;
  const yMean = y.reduce((a, b) => a + b, 0) / n;
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (y[i] - yMean);
    denominator += (i - xMean) ** 2;
  }
  return denominator === 0 ? null : numerator / denominator;
}
