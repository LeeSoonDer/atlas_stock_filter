export type Availability = "可得" | "不可得";

export interface OHLCVBar {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
  adjclose: number | null;
}

export interface QuoteSlice {
  symbol: string;
  fetchedAt: string;
  quoteType?: string;
  fullExchangeName?: string;
  regularMarketPrice?: number;
  marketCap?: number;
  marketCapAvailability: Availability;
  averageDailyVolume3Month?: number;
  avgDollarVolume?: number;
  avgDollarVolumeAvailability: Availability;
}

export interface EnrichSlice {
  symbol: string;
  fetchedAt: string;
  sector?: string;
  industry?: string;
  profileAvailability: Availability;
  institutionsPercentHeld?: number;
  institutionsPercentHeldAvailability: Availability;
  /** TASK_CARD_04: needed for the short-squeeze condition (SI >= 15% of float). */
  floatShares?: number;
  floatSharesAvailability: Availability;
  ohlcv?: OHLCVBar[];
  ohlcvTradingDays?: number;
  ohlcvAvailability: Availability;
}

export interface SymbolMarketData extends QuoteSlice, Omit<EnrichSlice, "symbol" | "fetchedAt"> {}

export type RevenueGrowthFlag = "accelerating" | "stable" | "decelerating" | "negative_growth";
export type GrossMarginFlag = "improved" | "worsened" | "flat";
export type ProfitabilityFlag = "profitable" | "loss_narrowing" | "loss_widening";
export type LeverageFlag = "net_cash" | "manageable" | "high_leverage";

/**
 * TASK_CARD_03 SCOPE 1. Only fetched for the "候选" population (symbols
 * that triggered at least one CARD 02 detector bucket) - see
 * ai/decisions.md for why the full gate-passed universe is not used.
 * Every flag defaults to unavailable; only set when its underlying data
 * was actually fetched (zero fabrication, consistent with CARD 01/02).
 */
export interface FundamentalsSlice {
  symbol: string;
  fetchedAt: string;
  revenueGrowthFlag?: RevenueGrowthFlag;
  revenueGrowthFlagAvailability: Availability;
  grossMarginFlag?: GrossMarginFlag;
  grossMarginFlagAvailability: Availability;
  profitabilityFlag?: ProfitabilityFlag;
  profitabilityFlagAvailability: Availability;
  leverageFlag?: LeverageFlag;
  leverageFlagAvailability: Availability;
  totalCash?: number;
  totalDebt?: number;
  earningsSoon: boolean;
  earningsDate?: string;
  earningsDateAvailability: Availability;
}
