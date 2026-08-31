import type { CleanBar } from "./series.js";

/**
 * TASK_CARD_09 Part A / 修正案十五: "成交量极度干涸" - within the trailing
 * `lookbackDays`, at least one single day's volume fell to `ratioThreshold`
 * (or below) of its own trailing `avgWindow`-day average volume, marking
 * float exhaustion near the end of a compression. Mirrors
 * maxVolumeRatioLastNDays's loop shape (volume.ts) but looks for the
 * MINIMUM ratio instead of the maximum.
 */
export function volumeDryup(bars: CleanBar[], lookbackDays: number, avgWindow: number, ratioThreshold: number): boolean | null {
  if (bars.length < avgWindow + lookbackDays) return null;

  let min: number | null = null;
  for (let i = bars.length - lookbackDays; i < bars.length; i++) {
    const dayVolume = bars[i].volume;
    const priorWindow = bars.slice(i - avgWindow, i);
    if (priorWindow.length < avgWindow) continue;
    const avg = priorWindow.reduce((a, b) => a + b.volume, 0) / avgWindow;
    if (avg === 0) continue;
    const ratio = dayVolume / avg;
    if (min === null || ratio < min) min = ratio;
  }
  if (min === null) return null;
  return min <= ratioThreshold;
}
