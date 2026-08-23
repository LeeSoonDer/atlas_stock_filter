import type { IDetector, DetectorResult } from "./IDetector.js";
import type { IndicatorFlags, DetectorsConfig } from "../indicators/types.js";

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
      return { detectorId: DETECTOR_ID, triggered: false, strengthScore: null, evidence: { ...evidence, reason: "insufficient_data" } };
    }

    const triggered =
      pctOf52WeekHigh >= c.pctOf52WeekHigh &&
      smaAlignedBullish === true &&
      maxVolumeRatioLast5Days >= c.volumeRatioThreshold &&
      rs6MonthPercentile >= c.rs6MonthPercentileThreshold;

    if (!triggered) {
      return { detectorId: DETECTOR_ID, triggered: false, strengthScore: null, evidence };
    }

    const marginProximity = pctOf52WeekHigh;
    const marginVolume = Math.min(maxVolumeRatioLast5Days / c.volumeRatioThreshold, 3) / 3;
    const marginRs = rs6MonthPercentile / 100;
    const strengthScore = ((marginProximity + marginVolume + marginRs) / 3) * 100;

    return { detectorId: DETECTOR_ID, triggered: true, strengthScore, evidence };
  },
};
