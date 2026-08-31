import type { IDetector, DetectorResult, FootprintCondition } from "./IDetector.js";
import type { IndicatorFlags, DetectorsConfig } from "../indicators/types.js";
import { applyLatentAccumulationBonus } from "./latentAccumulationBonus.js";

const DETECTOR_ID = "institutional_accumulation_proxy";

/**
 * Unlike Detectors A/B/C (one shared null-guard, so either every flag is
 * available or none are), each of this detector's 4 conditions has its
 * OWN, independent data dependency - one can be genuinely unavailable
 * while the other 3 are fully evaluated. `status` reflects that per-
 * condition, not detector-wide.
 */
function buildConditions(
  c: DetectorsConfig["detectorD_institutionalAccumulation"],
  insiderCluster: boolean | null,
  institutionalTrend: "up" | "down" | "flat" | null,
  shortInterestChangePercent: number | null,
  shortInterestPercentOfFloat: number | null,
  sma50: number | null,
  latestClose: number | null,
  obvSlope20: number | null,
): FootprintCondition[] {
  const shortInterestDecline = shortInterestChangePercent !== null && shortInterestChangePercent <= -c.shortInterestSignificantDeclinePercent;
  const shortInterestSqueeze =
    shortInterestPercentOfFloat !== null && sma50 !== null && latestClose !== null
      ? shortInterestPercentOfFloat >= c.squeezeMinFloatPercent && latestClose >= sma50
      : false;
  const shortInterestAvailable = shortInterestChangePercent !== null || (shortInterestPercentOfFloat !== null && sma50 !== null && latestClose !== null);

  return [
    {
      bucket: DETECTOR_ID, label: "内部人集群买入(≥2位不同内部人90日内公开市场买入)", field: "insiderCluster",
      actual: insiderCluster === null ? null : String(insiderCluster), threshold: "true",
      status: insiderCluster === null ? "unavailable" : insiderCluster === true ? "hit" : "miss",
      availability: insiderCluster === null ? "不可得" : "可得",
    },
    {
      bucket: DETECTOR_ID, label: "机构持股比例连续上升", field: "institutionalTrend",
      actual: institutionalTrend, threshold: "up",
      status: institutionalTrend === null ? "unavailable" : institutionalTrend === "up" ? "hit" : "miss",
      availability: institutionalTrend === null ? "不可得" : "可得",
    },
    {
      bucket: DETECTOR_ID, label: "空头回补迹象(空头持仓显著下降 或 挤压结构成立)", field: "shortInterestChangePercent / shortInterestPercentOfFloat",
      actual: shortInterestChangePercent !== null ? `变化 ${shortInterestChangePercent.toFixed(1)}%` : shortInterestPercentOfFloat !== null ? `占流通股 ${shortInterestPercentOfFloat.toFixed(1)}%` : null,
      threshold: `变化 ≤ -${c.shortInterestSignificantDeclinePercent}% 或 (占流通股 ≥ ${c.squeezeMinFloatPercent}% 且 现价≥SMA50)`,
      status: !shortInterestAvailable ? "unavailable" : shortInterestDecline || shortInterestSqueeze ? "hit" : "miss",
      availability: shortInterestAvailable ? "可得" : "不可得",
    },
    {
      bucket: DETECTOR_ID, label: "OBV 20日斜率转正", field: "obvSlope20",
      actual: obvSlope20, threshold: "> 0",
      status: obvSlope20 === null ? "unavailable" : obvSlope20 > 0 ? "hit" : "miss",
      availability: obvSlope20 === null ? "不可得" : "可得",
    },
  ];
}

/**
 * Detector D - Institutional Accumulation Proxy (TASK_CARD_04 SCOPE 5).
 * Needs >= minConditionsRequired (config-driven, default 2) of:
 *   1. insiderCluster is true (>=2 distinct insiders bought in the open
 *      market within the lookback window)
 *   2. institutionalTrend === 'up' - "机构持股比例连续上升" read as this
 *      detector's available 2-period trend signal (see
 *      src/screen/institutions/institutionalTrend.ts's own comment for
 *      why only a 2-period comparison is possible with this data source)
 *   3. short interest significantly declining (change% <=
 *      -shortInterestSignificantDeclinePercent) OR a squeeze setup
 *      (SI >= squeezeMinFloatPercent of float AND price >= SMA50)
 *   4. OBV 20-day slope positive (price/volume characteristics aligned)
 *
 * Any condition whose underlying data is unavailable (null) simply
 * cannot contribute - never treated as satisfied by default, consistent
 * with the rest of this project's zero-fabrication convention.
 *
 * strengthScore: how many of the (available) conditions were satisfied,
 * scaled to 0..100 by conditionsMet/totalConditions(4) - simplest
 * possible composite given the conditions are independent booleans
 * rather than continuous margins like Detectors A/B/C. Not a
 * cross-bucket ranking signal - only used to sort within this bucket.
 */
export const institutionalAccumulationDetector: IDetector = {
  id: DETECTOR_ID,
  name: "机构蓄势代理",
  detect(flags: IndicatorFlags, _profile, config: DetectorsConfig): DetectorResult {
    const c = config.detectorD_institutionalAccumulation;
    const {
      insiderCluster,
      institutionalTrend,
      shortInterestChangePercent,
      shortInterestPercentOfFloat,
      sma50,
      latestClose,
      obvSlope20,
    } = flags;

    const shortInterestDecline = shortInterestChangePercent !== null && shortInterestChangePercent <= -c.shortInterestSignificantDeclinePercent;
    const shortInterestSqueeze =
      shortInterestPercentOfFloat !== null && sma50 !== null && latestClose !== null
        ? shortInterestPercentOfFloat >= c.squeezeMinFloatPercent && latestClose >= sma50
        : false;

    const conditions = [
      insiderCluster === true,
      institutionalTrend === "up",
      shortInterestDecline || shortInterestSqueeze,
      obvSlope20 !== null && obvSlope20 > 0,
    ];
    const conditionsMet = conditions.filter(Boolean).length;

    const evidence = {
      insiderCluster,
      institutionalTrend,
      shortInterestChangePercent,
      shortInterestDecline,
      shortInterestSqueeze,
      obvSlope20,
      conditionsMet,
    };

    const footprintConditions = buildConditions(
      c, insiderCluster, institutionalTrend, shortInterestChangePercent, shortInterestPercentOfFloat, sma50, latestClose, obvSlope20,
    );

    const triggered = conditionsMet >= c.minConditionsRequired;
    if (!triggered) {
      return { detectorId: DETECTOR_ID, triggered: false, strengthScore: null, evidence, conditions: footprintConditions };
    }

    const baseScore = (conditionsMet / conditions.length) * 100;
    // TASK_CARD_09 Part A / 修正案十五: aboveVwapStreak applies to all four
    // buckets - see latentAccumulationBonus.ts. Bonus-only: never affects `triggered` above.
    const strengthScore = applyLatentAccumulationBonus(baseScore, [flags.aboveVwapStreak], config.latentAccumulation.strengthBonusPerFlag);
    return { detectorId: DETECTOR_ID, triggered: true, strengthScore, evidence, conditions: footprintConditions };
  },
};
