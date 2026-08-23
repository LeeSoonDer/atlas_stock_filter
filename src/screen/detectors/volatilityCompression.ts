import type { IDetector, DetectorResult } from "./IDetector.js";
import type { IndicatorFlags, DetectorsConfig } from "../indicators/types.js";

const DETECTOR_ID = "volatility_compression_setup";

/**
 * Detector B - Volatility Compression Setup (ambush-type; TASK_CARD_02
 * SCOPE 3). All four conditions must hold: BB width percentile <= 20
 * (120-day window); price within 15% of the 52-week high OR a sideways
 * base of >= 30 trading days; volume contraction (20-day avg < 50-day
 * avg, scaled by a configurable ratio); price >= SMA200.
 *
 * strengthScore: average of three normalized margins, scaled to 0..100:
 *   - squeeze tightness: 1 - bbWidthPercentile/100 (lower percentile = tighter = stronger)
 *   - proximity to the 52-week high (0..1, informative even when the
 *     sideways-base branch is what satisfied condition 2)
 *   - volume contraction depth: 1 - volumeAvg20/volumeAvg50, floored at 0
 * Not a cross-bucket ranking signal - only used to sort within this bucket.
 */
export const volatilityCompressionDetector: IDetector = {
  id: DETECTOR_ID,
  name: "波动挤压蓄势",
  detect(flags: IndicatorFlags, _profile, config: DetectorsConfig): DetectorResult {
    const c = config.detectorB_volatilityCompression;
    const { bbWidthPercentile120, pctOf52WeekHigh, sidewaysBaseDays, volumeAvg20, volumeAvg50, latestClose, sma200 } = flags;

    const evidence = { bbWidthPercentile120, pctOf52WeekHigh, sidewaysBaseDays, volumeAvg20, volumeAvg50, latestClose, sma200 };

    if (
      bbWidthPercentile120 === null ||
      pctOf52WeekHigh === null ||
      sidewaysBaseDays === null ||
      volumeAvg20 === null ||
      volumeAvg50 === null ||
      latestClose === null ||
      sma200 === null
    ) {
      return { detectorId: DETECTOR_ID, triggered: false, strengthScore: null, evidence: { ...evidence, reason: "insufficient_data" } };
    }

    const proximityOrBase =
      pctOf52WeekHigh >= 1 - c.proximityTo52WeekHighPct || sidewaysBaseDays >= c.sidewaysBaseMinDays;
    const volumeContracted = volumeAvg20 < volumeAvg50 * c.volumeContractionRatioThreshold;

    const triggered =
      bbWidthPercentile120 <= c.bbWidthPercentileThreshold &&
      proximityOrBase &&
      volumeContracted &&
      latestClose >= sma200;

    if (!triggered) {
      return { detectorId: DETECTOR_ID, triggered: false, strengthScore: null, evidence };
    }

    const marginSqueeze = 1 - bbWidthPercentile120 / 100;
    const marginProximity = pctOf52WeekHigh;
    const marginContraction = Math.max(0, 1 - volumeAvg20 / volumeAvg50);
    const strengthScore = ((marginSqueeze + marginProximity + marginContraction) / 3) * 100;

    return { detectorId: DETECTOR_ID, triggered: true, strengthScore, evidence };
  },
};
