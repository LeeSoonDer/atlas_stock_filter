import type { CleanBar } from "./series.js";
import { volumeAvg } from "./volume.js";

export type EntryStructure = "breakout" | "pullback_to_ma";

export interface EntryStructureConfig {
  entryStructure: {
    /** How close to the 52-week high still counts as "at/just past the prior high" (0.97 = within 3%). */
    breakoutProximityPct: number;
    /** How near an SMA the price must sit to read as a pullback TO that MA (0.04 = within 4% either side). */
    pullbackMaBandPct: number;
    /** Pullback also requires quieter trade: latest volume below this multiple of its own trailing average. */
    pullbackVolumeContractionRatio: number;
    pullbackVolumeAvgWindow: number;
  };
}

/**
 * TASK_CARD_09_STANDBY Part A item 6 / 修正案十八's 进场结构区分.
 * Structural label ONLY for symbols that already triggered the momentum
 * bucket - it never gates admission (the card's own "仅作结构标记,不改变
 * 桶判定"), it only tells the research layer whether this candidate is
 * "追高位" (chasing a breakout) or "接回踩" (buying a pullback), because
 * the risk conversation differs sharply between the two.
 *
 * Deliberately checked breakout-first: a symbol sitting at its 52-week
 * high IS a breakout even if it happens to also be near a rising SMA20,
 * which is common in a strong trend. Returns null when neither shape is
 * demonstrable from the data rather than defaulting to one.
 */
export function classifyEntryStructure(
  bars: CleanBar[],
  pctOf52WeekHigh: number | null,
  sma20: number | null,
  sma50: number | null,
  latestClose: number | null,
  smaAlignedBullish: boolean | null,
  config: EntryStructureConfig,
): EntryStructure | null {
  const c = config.entryStructure;
  if (latestClose === null) return null;

  if (pctOf52WeekHigh !== null && pctOf52WeekHigh >= c.breakoutProximityPct) {
    return "breakout";
  }

  // A pullback is only meaningful inside an established uptrend - without
  // the bullish MA stack this is just a symbol trading near a moving
  // average, which says nothing about entry structure.
  if (smaAlignedBullish !== true) return null;

  const nearMa = (ma: number | null): boolean =>
    ma !== null && ma !== 0 && Math.abs(latestClose - ma) / ma <= c.pullbackMaBandPct;

  if (!nearMa(sma20) && !nearMa(sma50)) return null;

  const avgVolume = volumeAvg(bars, c.pullbackVolumeAvgWindow);
  if (avgVolume === null || avgVolume === 0 || bars.length === 0) return null;
  const latestVolume = bars[bars.length - 1].volume;
  if (latestVolume / avgVolume > c.pullbackVolumeContractionRatio) return null;

  return "pullback_to_ma";
}
