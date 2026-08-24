import type { DetectorsConfig, IndicatorFlags } from "../indicators/types.js";
import type { ProfileName } from "../types.js";

export interface NearMissDetail {
  detectorId: string;
  conditionDescription: string;
  currentValue: number;
  thresholdValue: number;
  percentAway: number;
}

/**
 * TASK_CARD_05 SCOPE 2: "其余桶临界未达标者(距阈值 <= 10%)补足". Each
 * detector mixes boolean and numeric conditions differently (see each
 * detector's own file), so rather than building a generic per-condition
 * margin system for all 4, this mirrors each detector's EXACT condition
 * set but gives ONE representative numeric condition a
 * nearMissThresholdPercent grace band while every other condition still
 * must hold exactly - a documented simplification, not an attempt to
 * replicate every possible "how close" combination. The graced
 * condition is chosen as the one most naturally read as "about to
 * qualify": proximity-to-52-week-high for momentum breakout, BB-width
 * percentile for compression, RSI for oversold reversal. Institutional
 * accumulation has no numeric-grace equivalent (its 4 conditions are
 * all boolean) - its near-miss is simply "exactly one condition short
 * of minConditionsRequired".
 *
 * Returns null when the symbol is NOT a near miss (either already
 * triggered, or missing more than the one graced condition).
 */
export function checkNearMissMomentumBreakout(flags: IndicatorFlags, config: DetectorsConfig): NearMissDetail | null {
  const c = config.detectorA_momentumBreakout;
  const { pctOf52WeekHigh, smaAlignedBullish, maxVolumeRatioLast5Days, rs6MonthPercentile } = flags;
  if (pctOf52WeekHigh === null || smaAlignedBullish === null || maxVolumeRatioLast5Days === null || rs6MonthPercentile === null) return null;

  const alreadyTriggered =
    pctOf52WeekHigh >= c.pctOf52WeekHigh && smaAlignedBullish && maxVolumeRatioLast5Days >= c.volumeRatioThreshold && rs6MonthPercentile >= c.rs6MonthPercentileThreshold;
  if (alreadyTriggered) return null;

  const otherConditionsHold = smaAlignedBullish && maxVolumeRatioLast5Days >= c.volumeRatioThreshold && rs6MonthPercentile >= c.rs6MonthPercentileThreshold;
  if (!otherConditionsHold) return null;

  const gracedFloor = c.pctOf52WeekHigh * 0.9;
  if (pctOf52WeekHigh < gracedFloor) return null;

  const percentAway = ((c.pctOf52WeekHigh - pctOf52WeekHigh) / c.pctOf52WeekHigh) * 100;
  return { detectorId: "momentum_breakout", conditionDescription: "pctOf52WeekHigh", currentValue: pctOf52WeekHigh, thresholdValue: c.pctOf52WeekHigh, percentAway };
}

export function checkNearMissVolatilityCompression(flags: IndicatorFlags, config: DetectorsConfig): NearMissDetail | null {
  const c = config.detectorB_volatilityCompression;
  const { bbWidthPercentile120, pctOf52WeekHigh, sidewaysBaseDays, volumeAvg20, volumeAvg50, latestClose, sma200 } = flags;
  if (
    bbWidthPercentile120 === null ||
    pctOf52WeekHigh === null ||
    sidewaysBaseDays === null ||
    volumeAvg20 === null ||
    volumeAvg50 === null ||
    latestClose === null ||
    sma200 === null
  ) {
    return null;
  }

  const proximityOrBase = pctOf52WeekHigh >= 1 - c.proximityTo52WeekHighPct || sidewaysBaseDays >= c.sidewaysBaseMinDays;
  const volumeContracted = volumeAvg20 < volumeAvg50 * c.volumeContractionRatioThreshold;
  const priceAboveSma200 = latestClose >= sma200;

  const alreadyTriggered = bbWidthPercentile120 <= c.bbWidthPercentileThreshold && proximityOrBase && volumeContracted && priceAboveSma200;
  if (alreadyTriggered) return null;

  const otherConditionsHold = proximityOrBase && volumeContracted && priceAboveSma200;
  if (!otherConditionsHold) return null;

  const gracedCeiling = c.bbWidthPercentileThreshold * 1.1;
  if (bbWidthPercentile120 > gracedCeiling) return null;

  const percentAway = ((bbWidthPercentile120 - c.bbWidthPercentileThreshold) / c.bbWidthPercentileThreshold) * 100;
  return { detectorId: "volatility_compression_setup", conditionDescription: "bbWidthPercentile120", currentValue: bbWidthPercentile120, thresholdValue: c.bbWidthPercentileThreshold, percentAway };
}

export function checkNearMissOversoldReversal(flags: IndicatorFlags, profile: ProfileName, config: DetectorsConfig): NearMissDetail | null {
  const c = config.detectorC_oversoldReversal;
  const { rsi14, week52PositionPct, maxVolumeRatioLast10Days, obvSlope20 } = flags;
  if (rsi14 === null || week52PositionPct === null || maxVolumeRatioLast10Days === null || obvSlope20 === null) return null;

  const rsiThreshold = profile === "SMALL_SPEC" ? c.rsiThresholdSmallSpec : c.rsiThresholdStandard;
  const volumeSpike = maxVolumeRatioLast10Days >= c.stopLossVolumeRatioThreshold;
  const obvTurnedPositive = obvSlope20 > 0;
  const reversalSignal = volumeSpike || obvTurnedPositive;

  const alreadyTriggered = rsi14 <= rsiThreshold && week52PositionPct <= c.week52PositionThreshold && reversalSignal;
  if (alreadyTriggered) return null;

  const otherConditionsHold = week52PositionPct <= c.week52PositionThreshold && reversalSignal;
  if (!otherConditionsHold) return null;

  const gracedCeiling = rsiThreshold * 1.1;
  if (rsi14 > gracedCeiling) return null;

  const percentAway = ((rsi14 - rsiThreshold) / rsiThreshold) * 100;
  return { detectorId: "oversold_reversal", conditionDescription: "rsi14", currentValue: rsi14, thresholdValue: rsiThreshold, percentAway };
}

export function checkNearMissInstitutionalAccumulation(flags: IndicatorFlags, config: DetectorsConfig): NearMissDetail | null {
  const c = config.detectorD_institutionalAccumulation;
  const { insiderCluster, institutionalTrend, shortInterestChangePercent, shortInterestPercentOfFloat, sma50, latestClose, obvSlope20 } = flags;

  const shortInterestDecline = shortInterestChangePercent !== null && shortInterestChangePercent <= -c.shortInterestSignificantDeclinePercent;
  const shortInterestSqueeze =
    shortInterestPercentOfFloat !== null && sma50 !== null && latestClose !== null
      ? shortInterestPercentOfFloat >= c.squeezeMinFloatPercent && latestClose >= sma50
      : false;

  const conditionsMet = [insiderCluster === true, institutionalTrend === "up", shortInterestDecline || shortInterestSqueeze, obvSlope20 !== null && obvSlope20 > 0].filter(Boolean).length;

  if (conditionsMet >= c.minConditionsRequired) return null; // already triggered
  if (conditionsMet !== c.minConditionsRequired - 1) return null; // more than one condition short

  return {
    detectorId: "institutional_accumulation_proxy",
    conditionDescription: "conditionsMet",
    currentValue: conditionsMet,
    thresholdValue: c.minConditionsRequired,
    percentAway: 0, // not a percentage metric for this detector - see file comment
  };
}
