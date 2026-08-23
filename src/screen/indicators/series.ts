import type { OHLCVBar } from "../../data/types.js";

export interface CleanBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Filters out any bar with a null field (rather than fabricating a
 * value), so every downstream indicator works over a fully-populated
 * series. Assumes bars are chronologically ascending (oldest first) -
 * true for yahoo-finance2's chart() output, verified live during
 * TASK_CARD_01.
 *
 * Price used is adjclose (falls back to raw close): SMA/RSI/Bollinger/RS
 * all span multiple days, and an unadjusted split/dividend event
 * mid-window would otherwise distort them. high/low/volume have no
 * adjusted counterpart from this data source, so they stay raw - a
 * known, documented limitation: a split inside the lookback window can
 * distort week52High/Low (raw high/low) and ATR (raw high/low mixed
 * with adjusted close, since ATR needs all three together). Rare in
 * practice; not fabricated, just disclosed.
 */
export function cleanBars(bars: OHLCVBar[]): CleanBar[] {
  const out: CleanBar[] = [];
  for (const b of bars) {
    const price = b.adjclose ?? b.close;
    if (price === null || b.open === null || b.high === null || b.low === null || b.volume === null) {
      continue;
    }
    out.push({ date: b.date, open: b.open, high: b.high, low: b.low, close: price, volume: b.volume });
  }
  return out;
}

export function lastN<T>(arr: T[], n: number): T[] {
  return arr.slice(Math.max(0, arr.length - n));
}
