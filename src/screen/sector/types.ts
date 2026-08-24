/**
 * Yahoo's `sector` field (already cached per-symbol since TASK_CARD_01's
 * assetProfile fetch) uses exactly these 11 strings - confirmed by
 * inspecting the real cached values across all 3352 gate-passed symbols
 * live, not assumed from memory. Maps 1:1 onto the 11 SPDR Select Sector
 * ETFs (tickers verified live via yahooFinance.quote before use).
 */
export const SECTOR_TO_ETF: Record<string, string> = {
  "Basic Materials": "XLB",
  "Communication Services": "XLC",
  Energy: "XLE",
  "Financial Services": "XLF",
  Industrials: "XLI",
  Technology: "XLK",
  "Consumer Defensive": "XLP",
  "Real Estate": "XLRE",
  Utilities: "XLU",
  Healthcare: "XLV",
  "Consumer Cyclical": "XLY",
};

export type TailwindHeadwind = "tailwind" | "neutral" | "headwind";

export interface SectorReturns {
  sector: string;
  etf: string;
  oneMonthReturn: number | null;
  threeMonthReturn: number | null;
}

export interface SectorRanking extends SectorReturns {
  /** 1 = strongest composite rank, 11 = weakest. Null if either return is unavailable. */
  compositeRank: number | null;
  classification: TailwindHeadwind | null;
}

export interface SectorConfig {
  sector: {
    oneMonthTradingDays: number;
    threeMonthTradingDays: number;
    tailwindRankCount: number;
    headwindRankCount: number;
  };
}
