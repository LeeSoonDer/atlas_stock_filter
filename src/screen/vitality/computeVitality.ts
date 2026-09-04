import type { CleanBar } from "../indicators/series.js";

export interface VitalityConfig {
  vitality: {
    avgWindow: number;
    medianLookbackDays: number;
    medianMin: number;
    activeLookbackDays: number;
    activeRvolThreshold: number;
    activeDaysMin: number;
  };
}

export interface VitalityResult {
  rvolMedian10d: number | null;
  rvolActiveDays20d: number | null;
  /** True only when both raw metrics were computable AND both thresholds were met. Insufficient data -> false (a hard gate can't confirm "passed" from an unknown value - see computeVitality's own doc comment). */
  passed: boolean;
  dataAvailable: boolean;
}

/**
 * Daily RVOL for each of the trailing `lookbackDays` days (oldest first):
 * that day's volume divided by ITS OWN trailing `avgWindow`-day average
 * volume (a rolling window ending the day before, same convention as
 * volume.ts's maxVolumeRatioLastNDays). Days without a full `avgWindow`
 * of prior history, or a zero average, are skipped rather than
 * fabricated - the caller sees fewer points, never a guessed one.
 */
export function dailyRvolSeries(bars: CleanBar[], lookbackDays: number, avgWindow: number): number[] {
  if (bars.length < avgWindow + lookbackDays) return [];
  const out: number[] = [];
  for (let i = bars.length - lookbackDays; i < bars.length; i++) {
    const priorWindow = bars.slice(i - avgWindow, i);
    if (priorWindow.length < avgWindow) continue;
    const avg = priorWindow.reduce((a, b) => a + b.volume, 0) / avgWindow;
    if (avg === 0) continue;
    out.push(bars[i].volume / avg);
  }
  return out;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * TASK_CARD_10 Part A / 修正案二十一 "活跃度地板". A hard gate applied
 * AFTER detector evaluation, BEFORE candidate/watchlist selection, to
 * every symbol regardless of which bucket(s) it hit - a symbol that
 * fails this never becomes a candidate or a watchlist entry.
 *
 * `passed` requires BOTH raw series to have enough real trading history
 * to compute at all - a symbol with insufficient history cannot have
 * "satisfied >= medianMin" affirmatively demonstrated, so it does not
 * pass (matches the card's own literal "两条都满足才通过" - both must be
 * satisfied to pass - and its accepted tradeoff "宁可错过埋伏,不要死股").
 * `dataAvailable` lets the caller distinguish "excluded for being
 * illiquid" from "excluded for insufficient history" in run metadata,
 * even though both currently gate the same way.
 */
export function computeVitality(bars: CleanBar[], config: VitalityConfig): VitalityResult {
  const c = config.vitality;
  const medianSeries = dailyRvolSeries(bars, c.medianLookbackDays, c.avgWindow);
  const activeSeries = dailyRvolSeries(bars, c.activeLookbackDays, c.avgWindow);

  const rvolMedian10d = median(medianSeries);
  const rvolActiveDays20d = activeSeries.length > 0 ? activeSeries.filter((v) => v > c.activeRvolThreshold).length : null;

  const dataAvailable = rvolMedian10d !== null && rvolActiveDays20d !== null;
  const passed = dataAvailable && rvolMedian10d! >= c.medianMin && rvolActiveDays20d! >= c.activeDaysMin;

  return { rvolMedian10d, rvolActiveDays20d, passed, dataAvailable };
}
