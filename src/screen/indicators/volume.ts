import type { CleanBar } from "./series.js";
import { lastN } from "./series.js";

export function volumeAvg(bars: CleanBar[], window: number): number | null {
  if (bars.length < window) return null;
  const slice = lastN(bars, window);
  return slice.reduce((a, b) => a + b.volume, 0) / window;
}

/** Latest day's volume divided by the trailing `avgWindow`-day average (excluding the latest day itself). */
export function volumeRatioLatest(bars: CleanBar[], avgWindow: number): number | null {
  if (bars.length < avgWindow + 1) return null;
  const latest = bars[bars.length - 1].volume;
  const priorWindow = bars.slice(bars.length - avgWindow - 1, bars.length - 1);
  const avg = priorWindow.reduce((a, b) => a + b.volume, 0) / avgWindow;
  return avg === 0 ? null : latest / avg;
}

/** Max single-day volume ratio (that day's volume / trailing avgWindow-day average as of that day) over the last `lookbackDays` days. */
export function maxVolumeRatioLastNDays(bars: CleanBar[], lookbackDays: number, avgWindow: number): number | null {
  if (bars.length < avgWindow + lookbackDays) return null;
  let max: number | null = null;
  for (let i = bars.length - lookbackDays; i < bars.length; i++) {
    const dayVolume = bars[i].volume;
    const priorWindow = bars.slice(i - avgWindow, i);
    if (priorWindow.length < avgWindow) continue;
    const avg = priorWindow.reduce((a, b) => a + b.volume, 0) / avgWindow;
    if (avg === 0) continue;
    const ratio = dayVolume / avg;
    if (max === null || ratio > max) max = ratio;
  }
  return max;
}
