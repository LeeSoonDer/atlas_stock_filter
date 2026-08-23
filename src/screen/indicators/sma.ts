import { lastN } from "./series.js";

/** Simple moving average of the trailing `window` closes. Null if not enough data. */
export function sma(closes: number[], window: number): number | null {
  if (closes.length < window) return null;
  const slice = lastN(closes, window);
  return slice.reduce((a, b) => a + b, 0) / window;
}
