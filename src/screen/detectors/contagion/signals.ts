import type { CleanBar } from "../../indicators/series.js";

/** Latest single-day return: close[-1] / close[-2] - 1. Null without at least 2 bars. */
export function latestDailyReturn(bars: CleanBar[]): number | null {
  if (bars.length < 2) return null;
  const prev = bars[bars.length - 2].close;
  if (prev === 0) return null;
  return bars[bars.length - 1].close / prev - 1;
}

/**
 * "收盘价突破近 N 日高点": today's close above the highest HIGH of the
 * `lookbackDays` bars strictly BEFORE today (today itself excluded from
 * its own comparison window - otherwise every day would trivially "break"
 * its own high whenever it's the highest bar in an inclusive window).
 */
export function brokeAboveTrailingHigh(bars: CleanBar[], lookbackDays: number): boolean | null {
  if (bars.length < lookbackDays + 1) return null;
  const today = bars[bars.length - 1];
  const priorWindow = bars.slice(bars.length - 1 - lookbackDays, bars.length - 1);
  const priorHigh = Math.max(...priorWindow.map((b) => b.high));
  return today.close > priorHigh;
}
