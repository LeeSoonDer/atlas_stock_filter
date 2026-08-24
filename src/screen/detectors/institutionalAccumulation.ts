import type { IDetector, DetectorResult } from "./IDetector.js";
import type { IndicatorFlags, DetectorsConfig } from "../indicators/types.js";

const DETECTOR_ID = "institutional_accumulation_proxy";

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

    const triggered = conditionsMet >= c.minConditionsRequired;
    if (!triggered) {
      return { detectorId: DETECTOR_ID, triggered: false, strengthScore: null, evidence };
    }

    const strengthScore = (conditionsMet / conditions.length) * 100;
    return { detectorId: DETECTOR_ID, triggered: true, strengthScore, evidence };
  },
};
