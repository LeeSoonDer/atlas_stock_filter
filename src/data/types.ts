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
  ohlcv?: OHLCVBar[];
  ohlcvTradingDays?: number;
  ohlcvAvailability: Availability;
}

export interface SymbolMarketData extends QuoteSlice, Omit<EnrichSlice, "symbol" | "fetchedAt"> {}
