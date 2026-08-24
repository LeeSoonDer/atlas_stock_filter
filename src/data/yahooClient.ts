import YahooFinance from "yahoo-finance2";
import type { EnrichSlice, OHLCVBar, QuoteSlice } from "./types.js";
import type { RawFundamentalsData, RawPeriod } from "../screen/fundamentals/types.js";
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
 *
 * validateResult:false is required here: yahoo-finance2's strict schema
 * validation throws for the whole batch call if even one symbol has an
 * unusual quoteType (e.g. MONEYMARKET) missing fields its schema expects -
 * discovered live during TASK_CARD_01 (a single such symbol failed an
 * entire 200-symbol batch, wrongly marking all 200 as failed). We only
 * read the handful of fields we need and defensively tag missing ones as
 * 不可得 below, so disabling validation does not weaken correctness.
 */
export async function fetchQuoteBatch(symbols: string[]): Promise<QuoteSlice[]> {
  const results = (await yahooFinance.quote(symbols, { return: "array" }, { validateResult: false })) as Array<{
    symbol: string;
    marketCap?: number;
    averageDailyVolume3Month?: number;
    regularMarketPrice?: number;
    quoteType?: string;
    fullExchangeName?: string;
  }>;
  const bySymbol = new Map(results.map((r) => [r.symbol, r]));
  const fetchedAt = nowIso();

  return symbols.map((symbol) => {
    const q = bySymbol.get(symbol);

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

/**
 * Chart-only fetch for market-context tickers (SPY, ^VIX, the 11 SPDR
 * sector ETFs - TASK_CARD_03 SCOPE 2/3), which need OHLCV history but
 * not quoteSummary's profile/institutional/financial modules. Returns
 * an empty array on failure rather than throwing - callers (a small,
 * fixed list of tickers computed once per run) can decide how to
 * degrade per-ticker rather than aborting the whole regime snapshot.
 */
export async function fetchChartBars(symbol: string, lookbackCalendarDays: number): Promise<OHLCVBar[]> {
  try {
    const result = await yahooFinance.chart(symbol, {
      period1: new Date(Date.now() - lookbackCalendarDays * 24 * 60 * 60 * 1000),
      period2: new Date(),
      interval: "1d",
      return: "array",
    });
    return toOhlcvBars(result.quotes);
  } catch (err) {
    console.error(`[chart] ${symbol} failed: ${(err as Error).message}`);
    return [];
  }
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
    yahooFinance.quoteSummary(symbol, { modules: ["assetProfile", "majorHoldersBreakdown", "defaultKeyStatistics"] }),
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
    floatSharesAvailability: "不可得",
    ohlcvAvailability: "不可得",
  };

  if (profileResult.status === "fulfilled") {
    const { assetProfile, majorHoldersBreakdown, defaultKeyStatistics } = profileResult.value;
    if (assetProfile?.sector || assetProfile?.industry) {
      slice.sector = assetProfile.sector;
      slice.industry = assetProfile.industry;
      slice.profileAvailability = "可得";
    }
    if (majorHoldersBreakdown?.institutionsPercentHeld !== undefined) {
      slice.institutionsPercentHeld = majorHoldersBreakdown.institutionsPercentHeld;
      slice.institutionsPercentHeldAvailability = "可得";
    }
    if (defaultKeyStatistics?.floatShares !== undefined) {
      slice.floatShares = defaultKeyStatistics.floatShares;
      slice.floatSharesAvailability = "可得";
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

function toRawPeriods(rows: Array<{ date: Date; totalRevenue?: number; grossProfit?: number; netIncome?: number }>): RawPeriod[] {
  return rows
    .map((r) => ({ date: r.date, totalRevenue: r.totalRevenue, grossProfit: r.grossProfit, netIncome: r.netIncome }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * Fetches raw fundamentals inputs for TASK_CARD_03 SCOPE 1 - three
 * independent calls (a symbol-level quoteSummary for financialData +
 * calendarEvents, plus two fundamentalsTimeSeries calls for quarterly
 * and annual income-statement history), each tagged separately so one
 * failing does not discard the others. validateResult:false on all
 * three: fundamentalsTimeSeries in particular is prone to schema
 * mismatches on less-common period shapes (verified live - a `type:
 * 'trailing'` call threw on this exact validation for AAPL despite
 * returning real, usable data), and we only read the handful of fields
 * we need and defensively check for undefined below, so disabling
 * validation does not weaken correctness. Deliberately does NOT use
 * quoteSummary's incomeStatementHistory/incomeStatementHistoryQuarterly
 * modules - the package's own runtime warning plus a live check both
 * confirmed grossProfit is hardcoded to 0 there since ~Nov 2024;
 * fundamentalsTimeSeries is the verified-working replacement.
 */
export async function fetchFundamentalsRaw(symbol: string): Promise<RawFundamentalsData> {
  const now = Date.now();
  const twoYearsAgo = new Date(now - 2 * 365 * 24 * 60 * 60 * 1000);
  const fiveYearsAgo = new Date(now - 5 * 365 * 24 * 60 * 60 * 1000);

  const [summaryResult, quarterlyResult, annualResult] = await Promise.allSettled([
    yahooFinance.quoteSummary(symbol, { modules: ["financialData", "calendarEvents"] }, { validateResult: false }),
    yahooFinance.fundamentalsTimeSeries(symbol, { period1: twoYearsAgo, type: "quarterly", module: "financials" }, { validateResult: false }),
    yahooFinance.fundamentalsTimeSeries(symbol, { period1: fiveYearsAgo, type: "annual", module: "financials" }, { validateResult: false }),
  ]);

  const raw: RawFundamentalsData = { quarterlyFinancials: [], annualFinancials: [], earningsDates: [] };

  if (summaryResult.status === "fulfilled") {
    const { financialData, calendarEvents } = summaryResult.value as {
      financialData?: { totalCash?: number; totalDebt?: number };
      calendarEvents?: { earnings?: { earningsDate?: Date[] } };
    };
    raw.totalCash = financialData?.totalCash;
    raw.totalDebt = financialData?.totalDebt;
    raw.earningsDates = calendarEvents?.earnings?.earningsDate ?? [];
  }

  if (quarterlyResult.status === "fulfilled") {
    raw.quarterlyFinancials = toRawPeriods(quarterlyResult.value);
  }

  if (annualResult.status === "fulfilled") {
    raw.annualFinancials = toRawPeriods(annualResult.value);
  }

  return raw;
}
