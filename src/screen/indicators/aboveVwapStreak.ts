import type { CleanBar } from "./series.js";

/**
 * TASK_CARD_09 Part A / 修正案十五: "均价位置持续偏上" - close price stayed
 * above an approximate daily VWAP for `streakDays` consecutive most-recent
 * days. Honesty requirement from the card: this is a DAILY approximation
 * (typical price (H+L+C)/3, volume-weighted over a trailing `vwapWindow`-
 * day rolling window as of each day), not a real intraday/minute-level
 * VWAP - callers/renderers must label it as such, never as real VWAP.
 *
 * null (不可得) only when there isn't enough history to evaluate the full
 * streak window at all; otherwise strictly true only if every one of the
 * `streakDays` days individually closed above its own trailing VWAP (a
 * zero-volume window makes that day's VWAP undefined, which is treated as
 * "not above" rather than skipped, since "above an undefined average" is
 * not a claim this can honestly make).
 */
export function aboveVwapStreak(bars: CleanBar[], streakDays: number, vwapWindow: number): boolean | null {
  if (bars.length < vwapWindow + streakDays) return null;

  for (let i = bars.length - streakDays; i < bars.length; i++) {
    const window = bars.slice(i - vwapWindow + 1, i + 1);
    const totalVolume = window.reduce((a, b) => a + b.volume, 0);
    if (totalVolume === 0) return false;
    const vwap = window.reduce((a, b) => a + ((b.high + b.low + b.close) / 3) * b.volume, 0) / totalVolume;
    if (bars[i].close <= vwap) return false;
  }
  return true;
}
