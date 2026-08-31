import type { IDetector, DetectorResult, FootprintCondition } from "./IDetector.js";
import type { IndicatorFlags, DetectorsConfig } from "../indicators/types.js";
import { applyLatentAccumulationBonus } from "./latentAccumulationBonus.js";

/**
 * Detector A - Momentum Breakout (TASK_CARD_02 SCOPE 2). All four
 * conditions must hold: close >= 95% of 52-week high; SMA20>50>200 with
 * price above SMA20; volume ratio >= threshold within the breakout day
 * or the last 5 days; RS 6-month percentile >= 80.
 *
 * strengthScore (documented per SCOPE 6): simple average of three
 * normalized margins, each in [0,1], scaled to 0..100:
 *   - how close to the 52-week high (already 0..1, can't exceed it)
 *   - volume-ratio surplus over threshold, capped at 3x and normalized
 *   - RS 6-month percentile / 100
 * Not a cross-bucket ranking signal - only used to sort within this bucket.
 */
const DETECTOR_ID = "momentum_breakout";

/** Builds the 4 named-condition breakdown for claude_code_design_draft.md
 * §1.1's footprintDetail - `unavailable` variant used verbatim on the
 * insufficient-data early return (every underlying flag is null there, so
 * every condition is unavailable), `evaluated` variant used on the normal
 * path (by construction, all 4 flags are non-null there already). */
function unavailableConditions(c: DetectorsConfig["detectorA_momentumBreakout"]): FootprintCondition[] {
  return [
    { bucket: DETECTOR_ID, label: "现价距52周高点比例", field: "pctOf52WeekHigh", actual: null, threshold: `≥ ${(c.pctOf52WeekHigh * 100).toFixed(0)}%`, status: "unavailable", availability: "不可得" },
    { bucket: DETECTOR_ID, label: "均线多头排列(SMA20>50>200 且价格在SMA20上方)", field: "smaAlignedBullish", actual: null, threshold: "true", status: "unavailable", availability: "不可得" },
    { bucket: DETECTOR_ID, label: "近5日最大量比", field: "maxVolumeRatioLast5Days", actual: null, threshold: `≥ ${c.volumeRatioThreshold}x`, status: "unavailable", availability: "不可得" },
    { bucket: DETECTOR_ID, label: "6个月相对强度百分位", field: "rs6MonthPercentile", actual: null, threshold: `≥ ${c.rs6MonthPercentileThreshold}`, status: "unavailable", availability: "不可得" },
  ];
}

function evaluatedConditions(
  c: DetectorsConfig["detectorA_momentumBreakout"],
  pctOf52WeekHigh: number,
  smaAlignedBullish: boolean,
  maxVolumeRatioLast5Days: number,
  rs6MonthPercentile: number,
): FootprintCondition[] {
  return [
    {
      bucket: DETECTOR_ID, label: "现价距52周高点比例", field: "pctOf52WeekHigh",
      actual: `${(pctOf52WeekHigh * 100).toFixed(1)}%`, threshold: `≥ ${(c.pctOf52WeekHigh * 100).toFixed(0)}%`,
      status: pctOf52WeekHigh >= c.pctOf52WeekHigh ? "hit" : "miss", availability: "可得",
    },
    {
      bucket: DETECTOR_ID, label: "均线多头排列(SMA20>50>200 且价格在SMA20上方)", field: "smaAlignedBullish",
      actual: String(smaAlignedBullish), threshold: "true",
      status: smaAlignedBullish === true ? "hit" : "miss", availability: "可得",
    },
    {
      bucket: DETECTOR_ID, label: "近5日最大量比", field: "maxVolumeRatioLast5Days",
      actual: `${maxVolumeRatioLast5Days.toFixed(2)}x`, threshold: `≥ ${c.volumeRatioThreshold}x`,
      status: maxVolumeRatioLast5Days >= c.volumeRatioThreshold ? "hit" : "miss", availability: "可得",
    },
    {
      bucket: DETECTOR_ID, label: "6个月相对强度百分位", field: "rs6MonthPercentile",
      actual: rs6MonthPercentile.toFixed(1), threshold: `≥ ${c.rs6MonthPercentileThreshold}`,
      status: rs6MonthPercentile >= c.rs6MonthPercentileThreshold ? "hit" : "miss", availability: "可得",
    },
  ];
}

export const momentumBreakoutDetector: IDetector = {
  id: DETECTOR_ID,
  name: "动能突破",
  detect(flags: IndicatorFlags, _profile, config: DetectorsConfig): DetectorResult {
    const c = config.detectorA_momentumBreakout;
    const { pctOf52WeekHigh, smaAlignedBullish, maxVolumeRatioLast5Days, rs6MonthPercentile } = flags;

    const evidence = { pctOf52WeekHigh, smaAlignedBullish, maxVolumeRatioLast5Days, rs6MonthPercentile };

    if (
      pctOf52WeekHigh === null ||
      smaAlignedBullish === null ||
      maxVolumeRatioLast5Days === null ||
      rs6MonthPercentile === null
    ) {
      return {
        detectorId: DETECTOR_ID, triggered: false, strengthScore: null,
        evidence: { ...evidence, reason: "insufficient_data" },
        conditions: unavailableConditions(c),
      };
    }

    const conditions = evaluatedConditions(c, pctOf52WeekHigh, smaAlignedBullish, maxVolumeRatioLast5Days, rs6MonthPercentile);

    const triggered =
      pctOf52WeekHigh >= c.pctOf52WeekHigh &&
      smaAlignedBullish === true &&
      maxVolumeRatioLast5Days >= c.volumeRatioThreshold &&
      rs6MonthPercentile >= c.rs6MonthPercentileThreshold;

    if (!triggered) {
      return { detectorId: DETECTOR_ID, triggered: false, strengthScore: null, evidence, conditions };
    }

    const marginProximity = pctOf52WeekHigh;
    const marginVolume = Math.min(maxVolumeRatioLast5Days / c.volumeRatioThreshold, 3) / 3;
    const marginRs = rs6MonthPercentile / 100;
    const baseScore = ((marginProximity + marginVolume + marginRs) / 3) * 100;
    // TASK_CARD_09 Part A / 修正案十五: rsLineNewHigh applies to momentum +
    // compression, aboveVwapStreak applies to all four buckets - see
    // latentAccumulationBonus.ts. Bonus-only: never affects `triggered` above.
    const strengthScore = applyLatentAccumulationBonus(baseScore, [flags.rsLineNewHigh, flags.aboveVwapStreak], config.latentAccumulation.strengthBonusPerFlag);

    return { detectorId: DETECTOR_ID, triggered: true, strengthScore, evidence, conditions };
  },
};
