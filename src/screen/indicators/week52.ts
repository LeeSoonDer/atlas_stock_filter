import type { CleanBar } from "./series.js";
import { lastN } from "./series.js";

export interface Week52Result {
  high: number | null;
  low: number | null;
  positionPct: number | null; // (close - low) / (high - low), 0..1
  pctOfHigh: number | null; // close / high, 0..1+
}

export function week52(bars: CleanBar[], tradingDays: number, latestClose: number | null): Week52Result {
  if (bars.length === 0 || latestClose === null) {
    return { high: null, low: null, positionPct: null, pctOfHigh: null };
  }
  const window = lastN(bars, tradingDays);
  const high = Math.max(...window.map((b) => b.high));
  const low = Math.min(...window.map((b) => b.low));
  const positionPct = high === low ? null : (latestClose - low) / (high - low);
  const pctOfHigh = high === 0 ? null : latestClose / high;
  return { high, low, positionPct, pctOfHigh };
}
