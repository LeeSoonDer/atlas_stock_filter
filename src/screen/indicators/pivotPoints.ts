import type { CleanBar } from "./series.js";
import { lastN } from "./series.js";

export interface PivotPoint {
  date: string;
  price: number;
}

/**
 * Standard K-bar fractal pivot detection (used for TASK_CARD_05's
 * PAYLOAD "关键价位:近期枢轴高低"): bar i is a pivot high if its high is
 * strictly greater than the highs of the K bars immediately before AND
 * after it (a symmetric window); pivot low is the mirror condition on
 * lows. K=2 (a 5-bar fractal) is a common, well-established default,
 * not a project-specific invention.
 *
 * A pivot needs K future bars to confirm, so the most recent K days can
 * never yet have a confirmed pivot - inherent to the definition, not a
 * gap. Searches backward from the end of the trailing lookbackDays
 * window and returns the first (most recent) confirmed pivot, or null
 * if none exists in that window.
 */
export function mostRecentPivotHigh(bars: CleanBar[], k: number, lookbackDays: number): PivotPoint | null {
  const window = lastN(bars, lookbackDays);
  for (let i = window.length - 1 - k; i >= k; i--) {
    const candidate = window[i].high;
    let isPivot = true;
    for (let j = 1; j <= k; j++) {
      if (window[i - j].high >= candidate || window[i + j].high >= candidate) {
        isPivot = false;
        break;
      }
    }
    if (isPivot) return { date: window[i].date, price: candidate };
  }
  return null;
}

export function mostRecentPivotLow(bars: CleanBar[], k: number, lookbackDays: number): PivotPoint | null {
  const window = lastN(bars, lookbackDays);
  for (let i = window.length - 1 - k; i >= k; i--) {
    const candidate = window[i].low;
    let isPivot = true;
    for (let j = 1; j <= k; j++) {
      if (window[i - j].low <= candidate || window[i + j].low <= candidate) {
        isPivot = false;
        break;
      }
    }
    if (isPivot) return { date: window[i].date, price: candidate };
  }
  return null;
}
