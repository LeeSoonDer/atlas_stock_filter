import type { IDetector, DetectorResult } from "./IDetector.js";
import type { IndicatorFlags, DetectorsConfig } from "../indicators/types.js";

const DETECTOR_ID = "oversold_reversal";

/**
 * Detector C - Oversold Reversal (TASK_CARD_02 SCOPE 4). All conditions
 * must hold: RSI <= threshold (25 for SMALL_SPEC, 30 otherwise); 52-week
 * position <= 30%; a stop-loss volume spike (single-day ratio >= 2) in
 * the last 10 days OR OBV 20-day slope turned positive (divergence
 * flag). Liquidity-still-meets-the-profile-gate is satisfied by
 * construction: this detector only ever runs on symbols that already
 * passed the profile gate in TASK_CARD_01's pipeline, so no separate
 * check is added here (would be redundant).
 *
 * strengthScore: average of three normalized margins, scaled to 0..100:
 *   - how far under the RSI threshold: 1 - rsi/threshold (bounded to
 *     [0,1] since the gate already requires rsi <= threshold)
 *   - how far under the 52-week-position threshold, same bounding logic
 *   - reversal signal strength: volume-spike margin (capped at 3x,
 *     normalized) when present, else a flat 0.5 when only the OBV-slope
 *     divergence flag fired (OBV slope has no natural comparable scale)
 * Not a cross-bucket ranking signal - only used to sort within this bucket.
 */
export const oversoldReversalDetector: IDetector = {
  id: DETECTOR_ID,
  name: "超卖反转",
  detect(flags: IndicatorFlags, profile, config: DetectorsConfig): DetectorResult {
    const c = config.detectorC_oversoldReversal;
    const { rsi14, week52PositionPct, maxVolumeRatioLast10Days, obvSlope20 } = flags;
    const rsiThreshold = profile === "SMALL_SPEC" ? c.rsiThresholdSmallSpec : c.rsiThresholdStandard;

    const evidence = { rsi14, rsiThreshold, week52PositionPct, maxVolumeRatioLast10Days, obvSlope20 };

    if (rsi14 === null || week52PositionPct === null || maxVolumeRatioLast10Days === null || obvSlope20 === null) {
      return { detectorId: DETECTOR_ID, triggered: false, strengthScore: null, evidence: { ...evidence, reason: "insufficient_data" } };
    }

    const volumeSpike = maxVolumeRatioLast10Days >= c.stopLossVolumeRatioThreshold;
    const obvTurnedPositive = obvSlope20 > 0;

    const triggered =
      rsi14 <= rsiThreshold &&
      week52PositionPct <= c.week52PositionThreshold &&
      (volumeSpike || obvTurnedPositive);

    if (!triggered) {
      return { detectorId: DETECTOR_ID, triggered: false, strengthScore: null, evidence };
    }

    const marginRsi = 1 - rsi14 / rsiThreshold;
    const marginPosition = 1 - week52PositionPct / c.week52PositionThreshold;
    const marginReversal = volumeSpike ? Math.min(maxVolumeRatioLast10Days / c.stopLossVolumeRatioThreshold, 3) / 3 : 0.5;
    const strengthScore = ((marginRsi + marginPosition + marginReversal) / 3) * 100;

    return { detectorId: DETECTOR_ID, triggered: true, strengthScore, evidence };
  },
};
