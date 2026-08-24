import type { Availability } from "../types.js";

export interface FmpRawRatios {
  /** Verified live (search of FMP's own docs, no key available to test end-to-end): field names on /stable/ratios-ttm. Only fields actually confirmed are used - no P/S or EV/EBITDA (couldn't verify their exact field names), see ai/decisions.md. */
  peRatioTTM?: number;
  pbRatioTTM?: number;
  pegRatioTTM?: number;
}

export interface FmpEnrichmentResult {
  peRatioTTM: number | null;
  peRatioTTMAvailability: Availability;
  pbRatioTTM: number | null;
  pbRatioTTMAvailability: Availability;
  pegRatioTTM: number | null;
  pegRatioTTMAvailability: Availability;
  fmpPrice: number | null;
  priceDeviationPercent: number | null;
  /** null = 不可得 (couldn't check, e.g. no key or no FMP price). */
  priceMismatch: boolean | null;
  priceMismatchAvailability: Availability;
}

export interface FmpConfig {
  fmp: {
    priceMismatchThresholdPercent: number;
  };
}
