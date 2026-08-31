import type { IDetector, DetectorResult, FootprintCondition } from "./IDetector.js";
import type { IndicatorFlags, DetectorsConfig } from "../indicators/types.js";

const DETECTOR_ID = "volatility_compression_setup";

type Cfg = DetectorsConfig["detectorB_volatilityCompression"];

function unavailableConditions(c: Cfg): FootprintCondition[] {
  return [
    { bucket: DETECTOR_ID, label: "布林带宽120日百分位", field: "bbWidthPercentile120", actual: null, threshold: `≤ ${c.bbWidthPercentileThreshold}`, status: "unavailable", availability: "不可得" },
    { bucket: DETECTOR_ID, label: "贴近52周高点 或 横盘筑底", field: "pctOf52WeekHigh / sidewaysBaseDays", actual: null, threshold: `52周高点比 ≥ ${((1 - c.proximityTo52WeekHighPct) * 100).toFixed(0)}% 或 横盘天数 ≥ ${c.sidewaysBaseMinDays}天`, status: "unavailable", availability: "不可得" },
    { bucket: DETECTOR_ID, label: "成交量收缩(20日均量 < 50日均量)", field: "volumeAvg20 / volumeAvg50", actual: null, threshold: `20日均量 < 50日均量 × ${c.volumeContractionRatioThreshold}`, status: "unavailable", availability: "不可得" },
    { bucket: DETECTOR_ID, label: "价格站上SMA200", field: "latestClose / sma200", actual: null, threshold: "现价 ≥ SMA200", status: "unavailable", availability: "不可得" },
  ];
}

function evaluatedConditions(
  c: Cfg,
  bbWidthPercentile120: number,
  pctOf52WeekHigh: number,
  sidewaysBaseDays: number,
  volumeAvg20: number,
  volumeAvg50: number,
  latestClose: number,
  sma200: number,
): FootprintCondition[] {
  const proximityOrBase = pctOf52WeekHigh >= 1 - c.proximityTo52WeekHighPct || sidewaysBaseDays >= c.sidewaysBaseMinDays;
  const volumeContracted = volumeAvg20 < volumeAvg50 * c.volumeContractionRatioThreshold;
  return [
    {
      bucket: DETECTOR_ID, label: "布林带宽120日百分位", field: "bbWidthPercentile120",
      actual: bbWidthPercentile120.toFixed(1), threshold: `≤ ${c.bbWidthPercentileThreshold}`,
      status: bbWidthPercentile120 <= c.bbWidthPercentileThreshold ? "hit" : "miss", availability: "可得",
    },
    {
      bucket: DETECTOR_ID, label: "贴近52周高点 或 横盘筑底", field: "pctOf52WeekHigh / sidewaysBaseDays",
      actual: `52周高点比 ${(pctOf52WeekHigh * 100).toFixed(1)}% · 横盘 ${sidewaysBaseDays}天`,
      threshold: `52周高点比 ≥ ${((1 - c.proximityTo52WeekHighPct) * 100).toFixed(0)}% 或 横盘天数 ≥ ${c.sidewaysBaseMinDays}天`,
      status: proximityOrBase ? "hit" : "miss", availability: "可得",
    },
    {
      bucket: DETECTOR_ID, label: "成交量收缩(20日均量 < 50日均量)", field: "volumeAvg20 / volumeAvg50",
      actual: `20日均量/50日均量 = ${(volumeAvg20 / volumeAvg50).toFixed(2)}`,
      threshold: `20日均量 < 50日均量 × ${c.volumeContractionRatioThreshold}`,
      status: volumeContracted ? "hit" : "miss", availability: "可得",
    },
    {
      bucket: DETECTOR_ID, label: "价格站上SMA200", field: "latestClose / sma200",
      actual: `$${latestClose.toFixed(2)} vs SMA200 $${sma200.toFixed(2)}`, threshold: "现价 ≥ SMA200",
      status: latestClose >= sma200 ? "hit" : "miss", availability: "可得",
    },
  ];
}

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
      return {
        detectorId: DETECTOR_ID, triggered: false, strengthScore: null,
        evidence: { ...evidence, reason: "insufficient_data" },
        conditions: unavailableConditions(c),
      };
    }

    const conditions = evaluatedConditions(c, bbWidthPercentile120, pctOf52WeekHigh, sidewaysBaseDays, volumeAvg20, volumeAvg50, latestClose, sma200);

    const proximityOrBase =
      pctOf52WeekHigh >= 1 - c.proximityTo52WeekHighPct || sidewaysBaseDays >= c.sidewaysBaseMinDays;
    const volumeContracted = volumeAvg20 < volumeAvg50 * c.volumeContractionRatioThreshold;

    const triggered =
      bbWidthPercentile120 <= c.bbWidthPercentileThreshold &&
      proximityOrBase &&
      volumeContracted &&
      latestClose >= sma200;

    if (!triggered) {
      return { detectorId: DETECTOR_ID, triggered: false, strengthScore: null, evidence, conditions };
    }

    const marginSqueeze = 1 - bbWidthPercentile120 / 100;
    const marginProximity = pctOf52WeekHigh;
    const marginContraction = Math.max(0, 1 - volumeAvg20 / volumeAvg50);
    const strengthScore = ((marginSqueeze + marginProximity + marginContraction) / 3) * 100;

    return { detectorId: DETECTOR_ID, triggered: true, strengthScore, evidence, conditions };
  },
};
