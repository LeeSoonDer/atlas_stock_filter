import type { FmpEnrichmentResult, FmpConfig, FmpRawRatios } from "./types.js";

const UNAVAILABLE: FmpEnrichmentResult = {
  peRatioTTM: null,
  peRatioTTMAvailability: "不可得",
  pbRatioTTM: null,
  pbRatioTTMAvailability: "不可得",
  pegRatioTTM: null,
  pegRatioTTMAvailability: "不可得",
  fmpPrice: null,
  priceDeviationPercent: null,
  priceMismatch: null,
  priceMismatchAvailability: "不可得",
};

/**
 * TASK_CARD_05 SCOPE 1: pure computation over already-fetched FMP data
 * (network fetch is a separate concern, see fmpClient.ts/fetchFmpData.ts)
 * - "双源偏差 > 2% 打 price_mismatch 旗标" (threshold config-driven,
 * config/card05.json). Only computes priceMismatch when BOTH a real FMP
 * price and a real Yahoo price exist - otherwise 不可得, never guessed.
 */
export function computeFmpEnrichment(ratios: FmpRawRatios | null, fmpPrice: number | null, yahooPrice: number | undefined, config: FmpConfig): FmpEnrichmentResult {
  const result: FmpEnrichmentResult = { ...UNAVAILABLE };

  if (ratios) {
    if (ratios.peRatioTTM !== undefined) {
      result.peRatioTTM = ratios.peRatioTTM;
      result.peRatioTTMAvailability = "可得";
    }
    if (ratios.pbRatioTTM !== undefined) {
      result.pbRatioTTM = ratios.pbRatioTTM;
      result.pbRatioTTMAvailability = "可得";
    }
    if (ratios.pegRatioTTM !== undefined) {
      result.pegRatioTTM = ratios.pegRatioTTM;
      result.pegRatioTTMAvailability = "可得";
    }
  }

  if (fmpPrice !== null && yahooPrice !== undefined && yahooPrice > 0) {
    result.fmpPrice = fmpPrice;
    const deviation = (Math.abs(fmpPrice - yahooPrice) / yahooPrice) * 100;
    result.priceDeviationPercent = deviation;
    result.priceMismatch = deviation > config.fmp.priceMismatchThresholdPercent;
    result.priceMismatchAvailability = "可得";
  }

  return result;
}

export { UNAVAILABLE as FMP_UNAVAILABLE_RESULT };
