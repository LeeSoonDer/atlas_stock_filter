import type { CleanBar } from "./series.js";
import { lastN } from "./series.js";

/**
 * TASK_CARD_09 Part A / Amendment No.5 修正案十五: "相对强度线时序新高" -
 * the symbol's own close / SPY's close ratio series creates a 52-week
 * high while the symbol's own price has NOT - evidence of quiet
 * accumulation during a market-wide pullback, ahead of a price breakout.
 *
 * Ratio points are only built for dates present in BOTH series (a plain
 * date-keyed join) - a handful of non-overlapping dates between two
 * independently-fetched chart() calls are skipped rather than
 * misaligned-by-index. `ownPriceAtNewHigh` is passed in (rather than
 * recomputed here) so this stays a single source of truth with
 * week52()'s own already-computed pctOf52WeekHigh, including that
 * function's same lenient behavior on symbols with less than a full
 * `tradingDays` of history (see week52.ts / cleanBars.ts's disclosed
 * limitation) - deliberately not stricter here, for consistency.
 *
 * null (不可得) only when there is zero date overlap between the two
 * series at all - otherwise this evaluates over whatever overlap exists,
 * same lenient convention as week52().
 */
export function rsLineNewHigh(symbolBars: CleanBar[], spyBars: CleanBar[], tradingDays: number, ownPriceAtNewHigh: boolean): boolean | null {
  const spyCloseByDate = new Map(spyBars.map((b) => [b.date, b.close]));

  const ratioSeries: number[] = [];
  for (const bar of symbolBars) {
    const spyClose = spyCloseByDate.get(bar.date);
    if (spyClose === undefined || spyClose === 0) continue;
    ratioSeries.push(bar.close / spyClose);
  }
  if (ratioSeries.length === 0) return null;

  const window = lastN(ratioSeries, tradingDays);
  const latestRatio = window[window.length - 1];
  const ratioAtNewHigh = latestRatio >= Math.max(...window);

  return ratioAtNewHigh && !ownPriceAtNewHigh;
}
