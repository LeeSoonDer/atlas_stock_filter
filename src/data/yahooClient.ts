import YahooFinance from "yahoo-finance2";
import type { EnrichSlice, OHLCVBar, QuoteSlice } from "./types.js";
import fetchConfig from "../../config/fetch.json" with { type: "json" };

export const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Fetches quote-level data (marketCap, averageDailyVolume3Month,
 * regularMarketPrice) for a batch of symbols in a single request.
 * Throws on total failure so the caller's retry/backoff can handle it;
 * per-symbol data absence within a successful batch is tagged, not thrown.
 */
export async function fetchQuoteBatch(symbols: string[]): Promise<QuoteSlice[]> {
  const results = await yahooFinance.quote(symbols, { return: "array" });
  const bySymbol = new Map(results.map((r) => [r.symbol, r]));
  const fetchedAt = nowIso();

  return symbols.map((symbol) => {
    const q = bySymbol.get(symbol) as
      | { marketCap?: number; averageDailyVolume3Month?: number; regularMarketPrice?: number; quoteType?: string; fullExchangeName?: string }
      | undefined;

    const marketCap = q?.marketCap;
    const avgVol = q?.averageDailyVolume3Month;
    const price = q?.regularMarketPrice;
    const avgDollarVolume = avgVol !== undefined && price !== undefined ? avgVol * price : undefined;

    return {
      symbol,
      fetchedAt,
      quoteType: q?.quoteType,
      fullExchangeName: q?.fullExchangeName,
      regularMarketPrice: price,
      marketCap,
      marketCapAvailability: marketCap !== undefined ? "可得" : "不可得",
      averageDailyVolume3Month: avgVol,
      avgDollarVolume,
      avgDollarVolumeAvailability: avgDollarVolume !== undefined ? "可得" : "不可得",
    };
  });
}

function toOhlcvBars(quotes: Array<{ date: Date; open: number | null; high: number | null; low: number | null; close: number | null; volume: number | null; adjclose?: number | null }>): OHLCVBar[] {
  return quotes.map((q) => ({
    date: q.date.toISOString().slice(0, 10),
    open: q.open,
    high: q.high,
    low: q.low,
    close: q.close,
    volume: q.volume,
    adjclose: q.adjclose ?? null,
  }));
}

/**
 * Fetches enrichment data (sector/industry, institutional ownership %,
 * OHLCV history) for a single symbol. quoteSummary and chart are fetched
 * independently so a failure in one does not discard the other; each
 * field carries its own availability tag per the constitutional three-state
 * standard (Amendment No.2, 修正案一) - this card uses the two states
 * [可得]/[不可得] per TASK_CARD_01's own scope text.
 */
export async function fetchEnrichment(symbol: string): Promise<EnrichSlice> {
  const fetchedAt = nowIso();
  const lookbackMs = fetchConfig.chartLookbackCalendarDays * 24 * 60 * 60 * 1000;

  const [profileResult, chartResult] = await Promise.allSettled([
    yahooFinance.quoteSummary(symbol, { modules: ["assetProfile", "majorHoldersBreakdown"] }),
    yahooFinance.chart(symbol, {
      period1: new Date(Date.now() - lookbackMs),
      period2: new Date(),
      interval: "1d",
      return: "array",
    }),
  ]);

  const slice: EnrichSlice = {
    symbol,
    fetchedAt,
    profileAvailability: "不可得",
    institutionsPercentHeldAvailability: "不可得",
    ohlcvAvailability: "不可得",
  };

  if (profileResult.status === "fulfilled") {
    const { assetProfile, majorHoldersBreakdown } = profileResult.value;
    if (assetProfile?.sector || assetProfile?.industry) {
      slice.sector = assetProfile.sector;
      slice.industry = assetProfile.industry;
      slice.profileAvailability = "可得";
    }
    if (majorHoldersBreakdown?.institutionsPercentHeld !== undefined) {
      slice.institutionsPercentHeld = majorHoldersBreakdown.institutionsPercentHeld;
      slice.institutionsPercentHeldAvailability = "可得";
    }
  }

  if (chartResult.status === "fulfilled") {
    const bars = toOhlcvBars(chartResult.value.quotes);
    if (bars.length > 0) {
      slice.ohlcv = bars;
      slice.ohlcvTradingDays = bars.length;
      slice.ohlcvAvailability = "可得";
    }
  }

  return slice;
}
