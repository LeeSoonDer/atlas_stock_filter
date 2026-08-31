import { mkdirSync, writeFileSync } from "node:fs";
import { buildUniverse } from "../universe/index.js";
import type { ExclusionReason } from "../universe/types.js";
import {
  runQuotePhase,
  runEnrichmentPhase,
  runFundamentalsPhase,
  runInstitutionalTrendPhase,
  runInsidersIndexPhase,
  runInsidersFilingsPhase,
  fetchTickerCikMaps,
} from "../data/batchFetcher.js";
import { loadCheckpoint, saveCheckpoint } from "../data/checkpoint.js";
import { fetchChartBars } from "../data/yahooClient.js";
import { fetchLatestShortInterestFile } from "../data/short/fetchShortInterest.js";
import { aggregateInsiderClusters } from "../data/insiders/aggregateInsiderClusters.js";
import type { Availability, FundamentalsSlice, QuoteSlice } from "../data/types.js";
import type { ProfileArg, ProfileName, ProfilesConfig } from "./types.js";
import profilesConfig from "../../config/profiles.json" with { type: "json" };
import detectorsConfigJson from "../../config/detectors.json" with { type: "json" };
import card03ConfigJson from "../../config/card03.json" with { type: "json" };
import card04ConfigJson from "../../config/card04.json" with { type: "json" };
import { computeIndicators } from "./indicators/computeIndicators.js";
import { percentileRank } from "./indicators/percentile.js";
import { trailingReturn } from "./indicators/relativeStrength.js";
import { cleanBars } from "./indicators/series.js";
import type { DetectorsConfig, IndicatorFlags } from "./indicators/types.js";
import { allDetectors } from "./detectors/index.js";
import type { DetectorResult } from "./detectors/IDetector.js";
import { rankSectors } from "./sector/sectorStrength.js";
import { SECTOR_TO_ETF } from "./sector/types.js";
import type { SectorConfig, SectorRanking, SectorReturns } from "./sector/types.js";
import { computeMarketRegime } from "./regime/marketRegime.js";
import type { MarketRegimeSnapshot, RegimeConfig } from "./regime/types.js";
import type { FundamentalsConfig } from "./fundamentals/types.js";
import { computeInstitutionalTrend } from "./institutions/institutionalTrend.js";
import type { InstitutionalTrendConfig } from "./institutions/types.js";
import type { InsiderClusterConfig } from "../data/insiders/types.js";
import { aggregateSectorFootprints } from "./sector_footprint/aggregateSectorFootprint.js";
import type { FootprintConfig, SectorFootprint, SymbolFootprintInput } from "./sector_footprint/types.js";
import sectorFootprintConfigJson from "../../config/sector.json" with { type: "json" };
import { computeEventWindow } from "./event_window/computeEventWindow.js";
import type { EventWindowConfig, EventWindowEntry } from "./event_window/types.js";
import { selectCandidates, selectWatchlist } from "./select/index.js";
import type { SelectableSymbol, SelectConfig, SelectedCandidate, WatchlistEntry } from "./select/types.js";
import { mostRecentPivotHigh, mostRecentPivotLow } from "./indicators/pivotPoints.js";
import { generateAtlasPayload, generateDissentPayload } from "../report/payload/index.js";
import type { PayloadCandidateInput } from "../report/payload/types.js";
import { renderReport } from "../report/html/index.js";
import type { HtmlReportCandidateInput, ReportInput } from "../report/html/types.js";
import { fetchFmpEnrichment } from "../data/enrich/index.js";
import type { FmpConfig, FmpEnrichmentResult } from "../data/enrich/types.js";
import {
  appendLedgerEntry,
  joinScreeningWithOutcome,
  previousWatchlistSymbols as readPreviousWatchlistSymbols,
} from "../ledger/index.js";
import type { ScreeningLedgerEntry } from "../ledger/types.js";
import card05ConfigJson from "../../config/card05.json" with { type: "json" };
import { computeFootprintStrength, mergeFootprintDetail } from "../report/footprint/footprintStrength.js";
import type { FootprintCondition } from "./detectors/IDetector.js";
import { resolveRunFolder } from "./resolveRunFolder.js";
import { computeSectorFlowScan, computeHotSectorDetail } from "./sector_scan/index.js";
import type { BasketTickerStat, CandidateSectorInfo } from "./sector_scan/index.js";
import type { HotSectorEntry, HotSectorsConfig, SectorFlowConfig, SectorFlowEntry } from "./sector_scan/types.js";
import card07ConfigJson from "../../config/card07.json" with { type: "json" };
import hotSectorsConfigJson from "../../config/hot_sectors.json" with { type: "json" };
import creditConfigJson from "../../config/credit.json" with { type: "json" };
import { fetchFredSeries } from "../data/fred/fredClient.js";
import { computeCreditRegime } from "./credit_regime/computeCreditRegime.js";
import { computeRiskLevel } from "./credit_regime/types.js";
import type { CreditRegimeConfig, CreditRegimeSnapshot } from "./credit_regime/types.js";
import card09ConfigJson from "../../config/card09.json" with { type: "json" };
import type { LatentAccumulationConfig } from "./indicators/types.js";
import type { InsiderWeightingConfig } from "../data/insiders/insiderWeighting.js";
import { rsLineNewHigh } from "./indicators/rsLineNewHigh.js";
import { fetchOptionsChain } from "../data/options/fetchOptionsChain.js";
import { computeOptionsIntelligence } from "../data/options/computeOptionsIntelligence.js";
import type { OptionsConfig, OptionsIntelligence } from "../data/options/types.js";

const CHECKPOINT_PATH = "output/checkpoint.json";
const detectorsConfig = detectorsConfigJson as DetectorsConfig;
const card03Config = card03ConfigJson as SectorConfig & RegimeConfig & FundamentalsConfig & EventWindowConfig & {
  dataLookback: { spyCalendarDays: number; vixCalendarDays: number; sectorEtfCalendarDays: number };
};
const card04Config = card04ConfigJson as InsiderClusterConfig &
  InstitutionalTrendConfig & {
    shortInterest: { significantDeclinePercent: number; squeezeMinFloatPercent: number; settlementDateWalkBackDays: number };
    detectorD: { minConditionsRequired: number };
  };
const sectorFootprintConfig = sectorFootprintConfigJson as FootprintConfig;
const card05Config = card05ConfigJson as SelectConfig & FmpConfig;
const card07Config = card07ConfigJson as SectorFlowConfig;
const hotSectorsConfig = hotSectorsConfigJson as HotSectorsConfig;
const creditConfig = creditConfigJson as CreditRegimeConfig;
const FRED_HY_OAS_SERIES_ID = "BAMLH0A0HYM2";
const card09Config = card09ConfigJson as LatentAccumulationConfig & InsiderWeightingConfig & OptionsConfig;

/**
 * TASK_CARD_06 SCOPE 2: maps each named pipeline segment (marked via
 * mark() at that segment's completion, in runScreen below) to one of the
 * card's 4 macro timing categories (宇宙/抓取/检测/报告), so a single run's
 * console output and runMeta.timingBreakdown both answer "where did the
 * time go" without needing per-phase log-scraping.
 */
const PHASE_CATEGORY: Record<string, "universe" | "fetch" | "detect" | "report"> = {
  universe: "universe",
  fetch_credit_regime: "fetch",
  fetch_spy_rsline: "fetch",
  fetch_quote: "fetch",
  fetch_enrichment: "fetch",
  fetch_insiders_index: "fetch",
  fetch_insiders_filings: "fetch",
  fetch_institutions: "fetch",
  fetch_short_interest: "fetch",
  detect_indicators: "detect",
  detect_detectors: "detect",
  fetch_fundamentals: "fetch",
  detect_sector_footprint: "detect",
  fetch_market_context: "fetch",
  detect_select: "detect",
  detect_sector_flow: "detect",
  fetch_fmp: "fetch",
  fetch_options: "fetch",
  report_generate: "report",
  report_ledger: "report",
};
/** Reshapes card04Config's threshold values into DetectorsConfig's shape at wire-up time - card04.json stays the single source of truth for its own numbers (see Detector D's own file comment). */
const combinedDetectorsConfig: DetectorsConfig = {
  ...detectorsConfig,
  detectorD_institutionalAccumulation: {
    minConditionsRequired: card04Config.detectorD.minConditionsRequired,
    shortInterestSignificantDeclinePercent: card04Config.shortInterest.significantDeclinePercent,
    squeezeMinFloatPercent: card04Config.shortInterest.squeezeMinFloatPercent,
  },
  latentAccumulation: {
    strengthBonusPerFlag: card09Config.latentAccumulation.strengthBonusPerFlag,
  },
};

/**
 * TASK_CARD_03 SCOPE 2/3: fetches SPY, ^VIX, and the 11 SPDR sector ETFs
 * (13 lightweight chart-only calls, not checkpointed - cheap enough to
 * redo every run) and assembles the sector rankings + market regime
 * snapshot. Computed once per run, independent of --profile.
 */
async function fetchMarketContext(): Promise<{ sectorRankings: SectorRanking[]; marketRegime: MarketRegimeSnapshot; sectorReturns: SectorReturns[] }> {
  const lb = card03Config.dataLookback;
  const [spyBars, vixBars, ...etfBarsList] = await Promise.all([
    fetchChartBars("SPY", lb.spyCalendarDays),
    fetchChartBars("^VIX", lb.vixCalendarDays),
    ...Object.values(SECTOR_TO_ETF).map((etf) => fetchChartBars(etf, lb.sectorEtfCalendarDays)),
  ]);

  const spyCloses = cleanBars(spyBars).map((b) => b.close);
  const vixCloses = cleanBars(vixBars).map((b) => b.close);

  const sectorEtfEntries = Object.entries(SECTOR_TO_ETF);
  const sectorReturns: SectorReturns[] = sectorEtfEntries.map(([sector, etf], i) => {
    const closes = cleanBars(etfBarsList[i]).map((b) => b.close);
    return {
      sector,
      etf,
      // TASK_CARD_07 Part A: weekly return, needed for the sector flow scan's rank/flow-state - reuses the same already-fetched ETF bars, no new network call.
      oneWeekReturn: trailingReturn(closes, card03Config.sector.oneWeekTradingDays),
      oneMonthReturn: trailingReturn(closes, card03Config.sector.oneMonthTradingDays),
      threeMonthReturn: trailingReturn(closes, card03Config.sector.threeMonthTradingDays),
    };
  });

  const sectorRankings = rankSectors(sectorReturns, card03Config);
  const marketRegime = computeMarketRegime(spyCloses, vixCloses, sectorRankings, card03Config);

  return { sectorRankings, marketRegime, sectorReturns };
}

/**
 * TASK_CARD_08 Part A: reads FRED's high-yield OAS series once per run,
 * independent of --profile. Never throws - a missing key or failed request
 * degrades to `label: "unknown"` and the run proceeds unblocked, per the
 * card's own circuit-breaker rule.
 */
export async function fetchCreditRegimeSnapshot(): Promise<CreditRegimeSnapshot> {
  const observations = await fetchFredSeries(FRED_HY_OAS_SERIES_ID, process.env.FRED_API_KEY);
  return computeCreditRegime(observations, creditConfig);
}

export function evaluateProfileGate(
  quote: QuoteSlice,
  config: ProfilesConfig,
): { profile: ProfileName; speculative: boolean } | null {
  const { marketCap, avgDollarVolume: adv, regularMarketPrice: price } = quote;
  if (marketCap === undefined || adv === undefined || price === undefined) return null;

  const std = config.STANDARD;
  if (
    marketCap >= std.minMarketCap &&
    (std.maxMarketCap === null || marketCap <= std.maxMarketCap) &&
    adv >= std.minAvgDollarVolume &&
    price >= std.minPrice
  ) {
    return { profile: "STANDARD", speculative: std.speculative };
  }
  const spec = config.SMALL_SPEC;
  if (
    marketCap >= spec.minMarketCap &&
    (spec.maxMarketCap === null || marketCap <= spec.maxMarketCap) &&
    adv >= spec.minAvgDollarVolume &&
    price >= spec.minPrice
  ) {
    return { profile: "SMALL_SPEC", speculative: spec.speculative };
  }
  return null;
}

function requestedProfiles(arg: ProfileArg): ProfileName[] {
  if (arg === "both") return ["STANDARD", "SMALL_SPEC"];
  return arg === "standard" ? ["STANDARD"] : ["SMALL_SPEC"];
}

/**
 * TASK_CARD_08 Part A DONE-WHEN: "人工构造tight状态测试:SMALL_SPEC确实被禁用".
 * Extracted as a pure function specifically so that construction can be a
 * real unit test rather than only exercised by a live run (which cannot
 * reach `label: "tight"` in this environment - no FRED_API_KEY configured).
 */
export function shouldForceDisableSmallSpec(requested: Set<ProfileName>, creditRegimeLabel: CreditRegimeSnapshot["label"]): boolean {
  return creditRegimeLabel === "tight" && requested.has("SMALL_SPEC");
}

export interface ScreenOutputSymbol {
  symbol: string;
  securityName: string;
  exchange: string;
  profile: ProfileName;
  speculative: boolean;
  marketCap: number;
  avgDollarVolume: number;
  regularMarketPrice?: number;
  quoteType?: string;
  fullExchangeName?: string;
  sector?: string;
  industry?: string;
  profileAvailability: Availability;
  institutionsPercentHeld?: number;
  institutionsPercentHeldAvailability: Availability;
  ohlcvTradingDays?: number;
  ohlcvAvailability: Availability;
  fetchedAt: string;
  /** All computed technical indicators (TASK_CARD_02 SCOPE 1). Null fields mean insufficient OHLCV history, never fabricated. */
  flags: IndicatorFlags;
  /** Detector ids this symbol triggered (TASK_CARD_02 SCOPE 2-4). Can be more than one, or empty. */
  buckets: string[];
  /** detectorId -> 0..100 within-bucket sort score (see each detector's own comment for its formula). Only present for triggered buckets. */
  bucketScores: Record<string, number>;
  /** TASK_CARD_03 SCOPE 2. Undefined only if `sector` itself is unavailable (4/3352 symbols as of TASK_CARD_03's validation run). */
  sectorRank?: SectorRanking;
  /**
   * TASK_CARD_03 SCOPE 1. Only present for the "候选" pool (symbols with
   * buckets.length > 0) - undefined here means "not evaluated because
   * out of this card's population scope", which is a different meaning
   * from the constitutional 不可得 tags *inside* this object (which mean
   * "evaluated, but the underlying data wasn't available"). See
   * ai/decisions.md for why the full universe isn't used.
   */
  fundamentals?: FundamentalsSlice;
  /**
   * TASK_CARD_03_PATCH Part B. Only present for the "候选" pool (same
   * population as `fundamentals`, since it reuses fundamentals.earningsDate
   * directly) - undefined means "not evaluated", an empty array means
   * "evaluated, no schedule-certain event within the window".
   */
  eventWindow?: EventWindowEntry[];
}

export interface ScreenRunResult {
  runMeta: {
    timestamp: string;
    profileArg: ProfileArg;
    rawUniverseCount: number;
    postExclusionCount: number;
    excludedByReason: Record<ExclusionReason, number>;
    quoteFetchFailureCount: number;
    quoteFetchFailures: string[];
    gatesPassedCount: number;
    /** TASK_CARD_02 DONE-WHEN: each bucket must have a non-zero hit count, or this run's output must explain why. */
    detectorSummary: Record<string, { triggeredCount: number }>;
    zeroHitBucketsNote: string | null;
    /** TASK_CARD_03 SCOPE 1: size of the "候选" pool that received fundamental-flag enrichment (bucket-triggered symbols only - see ai/decisions.md). */
    fundamentalsCandidatePoolSize: number;
    fundamentalsFetchFailures: string[];
    /** TASK_CARD_03 SCOPE 2/3. */
    sectorRankings: SectorRanking[];
    marketRegime: MarketRegimeSnapshot;
    /** TASK_CARD_08 Part A. */
    creditRegime: CreditRegimeSnapshot;
    /** TASK_CARD_08 Part A: true only when --profile requested SMALL_SPEC AND credit regime is tight this run. */
    smallSpecForcedDisabled: boolean;
    /** TASK_CARD_04. */
    insiders: {
      daysScanned: number;
      relevantFilingsFound: number;
      filingsParsed: number;
      filingsFailed: number;
      symbolsWithCluster: number;
    };
    shortInterest: {
      settlementDate: string | null;
      lagDays: number | null;
      recordCount: number;
    };
    /** TASK_CARD_03_PATCH Part A. One entry per SPDR sector (11), computed over the full gate-passed universe. */
    sectorFootprints: SectorFootprint[];
    /** TASK_CARD_07 Part A. All 11 SPDR sectors, ranked by this week's return. */
    sectorFlowScan: SectorFlowEntry[];
    /** TASK_CARD_07 Part A. Named hot sectors + any real sector flagged footprintAnomaly this run but not already named. */
    hotSectorDetail: HotSectorEntry[];
    elapsedMs: number;
    /**
     * TASK_CARD_06 SCOPE 2: this run's total elapsed time broken into the
     * card's 4 macro categories (宇宙 universe build, 抓取 all network
     * fetch phases, 检测 indicator/detector/selection computation, 报告
     * PAYLOAD/HTML/ledger generation). `detail` has the same numbers at
     * per-segment granularity for deeper debugging.
     */
    timingBreakdown: {
      universeMs: number;
      fetchMs: number;
      detectMs: number;
      reportMs: number;
      detail: Record<string, number>;
    };
    /**
     * TASK_CARD_06 SCOPE 2: which symbols failed, and at which fetch
     * phase(s), across this run. Only phases that fail per-symbol (quote,
     * enrichment, fundamentals) are attributed here - insider filing
     * failures are keyed by SEC accession path, not by symbol, so they
     * stay in `insiders.filingsFailed` above rather than being force-
     * mapped into a symbol they may not cleanly resolve to.
     */
    failureAttribution: {
      bySymbol: Record<string, string[]>;
      totalDistinctSymbolsFailed: number;
    };
  };
  symbols: ScreenOutputSymbol[];
  /** TASK_CARD_05 SCOPE 2/3/4/5/6: the selector's output and the paths of the three generated report artifacts. */
  selection: {
    candidates: SelectedCandidate[];
    watchlist: WatchlistEntry[];
    promotedThisRun: string[];
    /** output/runs/{YYYY-MM-DD[_HHMM]} - the per-run dated folder holding all 4 of this run's artifact files (see resolveRunFolder). */
    runFolder: string;
    atlasPayloadPath: string;
    dissentPayloadPath: string;
    htmlReportPath: string;
  };
}

/**
 * Pipeline shell: universe -> fetch -> profile filter -> output.
 * Fetch is two-phase (see src/data/batchFetcher.ts): cheap quote-level
 * data for the whole exclusion-gated universe first, profile filter
 * applied on that, then expensive enrichment (OHLCV/profile/institutional)
 * only for symbols that already passed. Zero detector/scoring logic
 * (TASK_CARD_01 MUST-NOT) - src/screen/detectors/IDetector.ts is an
 * interface stub only.
 */
export async function runScreen(profileArg: ProfileArg): Promise<ScreenRunResult> {
  const t0 = Date.now();
  mkdirSync("output", { recursive: true });

  // TASK_CARD_06 SCOPE 2: one mark() per named segment's completion; the
  // gap between consecutive marks is that segment's elapsed time.
  const marks: Array<{ label: string; t: number }> = [{ label: "start", t: t0 }];
  const mark = (label: string) => marks.push({ label, t: Date.now() });

  console.error(`[screen] building universe...`);
  const { rawCount, excludedCount, excludedByReason, universe } = await buildUniverse();
  console.error(`[screen] universe: ${rawCount} raw -> ${universe.length} post-exclusion (${excludedCount} excluded)`);
  mark("universe");

  const checkpoint = loadCheckpoint(CHECKPOINT_PATH, "ATLAS_UNIVERSE");
  const allSymbols = universe.map((u) => u.symbol);

  console.error(`[screen] Phase credit regime: checking FRED high-yield OAS (${FRED_HY_OAS_SERIES_ID})...`);
  const creditRegime = await fetchCreditRegimeSnapshot();
  console.error(
    `[screen] Phase credit regime done: label=${creditRegime.label}${creditRegime.labelUnavailableReason ? ` (${creditRegime.labelUnavailableReason})` : ""}`,
  );
  mark("fetch_credit_regime");

  console.error(`[screen] Phase A: quote fetch for ${allSymbols.length} symbols...`);
  await runQuotePhase(allSymbols, checkpoint, CHECKPOINT_PATH);
  console.error(`[screen] Phase A done: ${Object.keys(checkpoint.quoteResults).length} fetched, ${checkpoint.quoteFailures.length} failed`);
  mark("fetch_quote");

  const requestedProfileSet = new Set(requestedProfiles(profileArg));
  // TASK_CARD_08 Part A / Amendment No.5 修正案十四: credit-tight forces
  // SMALL_SPEC off this run regardless of what --profile asked for. This is
  // the circuit breaker's one behavior-changing effect - everything else
  // about this card is additive (new fields, no altered gate/bucket logic).
  const smallSpecForcedDisabled = shouldForceDisableSmallSpec(requestedProfileSet, creditRegime.label);
  if (smallSpecForcedDisabled) {
    requestedProfileSet.delete("SMALL_SPEC");
    console.error(
      `[screen] Phase credit regime: SMALL_SPEC forcibly disabled this run (credit regime=tight, OAS=${creditRegime.oasCurrentBp}bp) - see report/payload credit_regime section for detail`,
    );
  }
  const wanted = requestedProfileSet;
  const universeBySymbol = new Map(universe.map((u) => [u.symbol, u]));

  const gatePassed: Array<{ symbol: string; profile: ProfileName; speculative: boolean; quote: QuoteSlice }> = [];
  for (const symbol of allSymbols) {
    const quote = checkpoint.quoteResults[symbol];
    if (!quote) continue;
    const gate = evaluateProfileGate(quote, profilesConfig as ProfilesConfig);
    if (gate && wanted.has(gate.profile)) {
      gatePassed.push({ symbol, profile: gate.profile, speculative: gate.speculative, quote });
    }
  }
  console.error(`[screen] Phase gate: ${gatePassed.length} symbols pass profile=${profileArg}`);

  console.error(`[screen] Phase B: enrichment fetch for ${gatePassed.length} symbols...`);
  await runEnrichmentPhase(gatePassed.map((g) => g.symbol), checkpoint, CHECKPOINT_PATH);
  console.error(`[screen] Phase B done: ${Object.keys(checkpoint.enrichResults).length} enriched total, ${checkpoint.enrichFailures.length} failed total`);
  mark("fetch_enrichment");

  // TASK_CARD_04: insider/institutional/short-interest evidence must be
  // ready BEFORE indicator/detector computation below, unlike CARD 03's
  // fundamentals (which runs after, since it doesn't gate a detector) -
  // Detector D needs this data merged into flags to evaluate at all.
  const gatePassedSymbols = gatePassed.map((g) => g.symbol);

  console.error(`[screen] Phase insiders-index: scanning ${card04Config.insiders.lookbackDays} days of SEC daily indexes...`);
  const { cikByTicker, tickerByCik } = await fetchTickerCikMaps(card04Config.insiders.maxRequestsPerSecond);
  const universeCikSet = new Set(gatePassedSymbols.map((s) => cikByTicker.get(s)).filter((c): c is string => c !== undefined));
  await runInsidersIndexPhase(universeCikSet, tickerByCik, checkpoint, CHECKPOINT_PATH);
  const relevantFilingCount = Object.values(checkpoint.insiderDailyIndexCache).reduce((a, f) => a + f.length, 0);
  console.error(`[screen] Phase insiders-index done: ${Object.keys(checkpoint.insiderDailyIndexCache).length} days scanned, ${relevantFilingCount} relevant filings found`);
  mark("fetch_insiders_index");

  console.error(`[screen] Phase insiders-filings: fetching + parsing ${relevantFilingCount} filings (this is the slow one)...`);
  await runInsidersFilingsPhase(checkpoint, CHECKPOINT_PATH);
  console.error(`[screen] Phase insiders-filings done: ${Object.keys(checkpoint.insiderFilingResults).length} parsed total, ${checkpoint.insiderFilingFailures.length} failed total`);
  mark("fetch_insiders_filings");

  const insiderClusters = aggregateInsiderClusters(
    Object.values(checkpoint.insiderFilingResults),
    card04Config.insiders.lookbackDays,
    card09Config,
    new Date(),
  );

  console.error(`[screen] Phase institutions: fresh institutional-ownership snapshot for ${gatePassedSymbols.length} symbols...`);
  await runInstitutionalTrendPhase(gatePassedSymbols, checkpoint, CHECKPOINT_PATH);
  console.error(`[screen] Phase institutions done`);
  mark("fetch_institutions");

  console.error(`[screen] Phase short-interest: fetching latest FINRA file...`);
  const shortInterestFile = await fetchLatestShortInterestFile(card04Config.shortInterest.settlementDateWalkBackDays);
  console.error(
    shortInterestFile
      ? `[screen] Phase short-interest done: settlementDate=${shortInterestFile.settlementDate} lagDays=${shortInterestFile.lagDays} records=${shortInterestFile.records.size}`
      : `[screen] Phase short-interest: no file found within the configured walk-back window`,
  );
  mark("fetch_short_interest");

  // TASK_CARD_09 Part A: rsLineNewHigh needs SPY bars, so they're fetched
  // here, early (before computeIndicators runs), rather than only later
  // in fetchMarketContext() (which serves the unrelated market-regime
  // snapshot and historically runs after detectors). This is a second,
  // independent SPY chart() call in the same run - a small, disclosed
  // duplication accepted for simplicity over restructuring
  // fetchMarketContext()'s call site (see ai/decisions.md).
  console.error(`[screen] Phase RS-line: fetching SPY bars for the rs_line_new_high signal...`);
  const spyBarsForRsLine = cleanBars(await fetchChartBars("SPY", card03Config.dataLookback.spyCalendarDays));
  mark("fetch_spy_rsline");

  console.error(`[screen] Phase indicators: computing technical indicators for ${gatePassed.length} symbols...`);
  const flagsBySymbol = new Map<string, IndicatorFlags>();
  for (const { symbol } of gatePassed) {
    const ohlcv = checkpoint.enrichResults[symbol]?.ohlcv ?? [];
    const flags = computeIndicators(ohlcv, combinedDetectorsConfig, card09Config);

    const cluster = insiderClusters.get(symbol);
    flags.insiderCluster = cluster ? cluster.insiderCluster : false;
    flags.insiderClusterDistinctBuyers = cluster?.distinctBuyerCount ?? 0;
    flags.insiderClusterLagDays = cluster?.lagDays ?? null;
    flags.insiderClusterWeightedScore = cluster?.weightedScore ?? null;

    flags.rsLineNewHigh = rsLineNewHigh(cleanBars(ohlcv), spyBarsForRsLine, card09Config.latentAccumulation.rsLineTradingDays, flags.pctOf52WeekHigh !== null && flags.pctOf52WeekHigh >= 1);

    const trendResult = computeInstitutionalTrend(checkpoint.institutionalHistory[symbol] ?? [], card04Config);
    flags.institutionalTrend = trendResult.trend;
    flags.institutionalTrendAvailability = trendResult.availability;

    const si = shortInterestFile?.records.get(symbol);
    const floatShares = checkpoint.enrichResults[symbol]?.floatShares;
    if (si) {
      flags.shortInterestChangePercent = si.changePercent;
      flags.shortInterestDaysToCover = si.daysToCover;
      flags.shortInterestPercentOfFloat = floatShares && floatShares > 0 ? (si.currentShortShares / floatShares) * 100 : null;
      flags.shortInterestLagDays = shortInterestFile!.lagDays;
      flags.shortInterestAvailability = "可得";
    }

    flagsBySymbol.set(symbol, flags);
  }

  // RS percentile ranking is cross-symbol ("全宇宙" = every symbol in this
  // run's gate-passed set, not segmented by STANDARD/SMALL_SPEC), so it
  // happens after every symbol's single-symbol indicators are computed.
  const threeMonthReturns = [...flagsBySymbol.values()].map((f) => f.threeMonthReturn).filter((v): v is number => v !== null);
  const sixMonthReturns = [...flagsBySymbol.values()].map((f) => f.sixMonthReturn).filter((v): v is number => v !== null);
  for (const flags of flagsBySymbol.values()) {
    if (flags.threeMonthReturn !== null) {
      flags.rs3MonthPercentile = percentileRank(threeMonthReturns, flags.threeMonthReturn);
    }
    if (flags.sixMonthReturn !== null) {
      flags.rs6MonthPercentile = percentileRank(sixMonthReturns, flags.sixMonthReturn);
    }
  }

  mark("detect_indicators");
  console.error(`[screen] Phase detectors: running ${allDetectors.length} detectors...`);
  const detectorSummary: Record<string, { triggeredCount: number }> = {};
  for (const d of allDetectors) detectorSummary[d.id] = { triggeredCount: 0 };

  // claude_code_design_draft.md §1.1: every detector's full per-condition
  // breakdown is needed later ONLY for the narrow candidate+watchlist pool
  // (<=15 symbols, same "never the full universe" precedent as the FMP
  // enrichment phase below - Memo No.4 E17). Kept in an in-memory Map, not
  // on ScreenOutputSymbol/screen_run.json, so the full-universe (~3350
  // symbols) persisted output size is unaffected by this addition.
  const detectorResultsBySymbol = new Map<string, DetectorResult[]>();

  const symbols: ScreenOutputSymbol[] = gatePassed.map(({ symbol, profile, speculative, quote }) => {
    const raw = universeBySymbol.get(symbol)!;
    const enrich = checkpoint.enrichResults[symbol];
    const flags = flagsBySymbol.get(symbol)!;

    const results: DetectorResult[] = allDetectors.map((d) => d.detect(flags, profile, combinedDetectorsConfig));
    detectorResultsBySymbol.set(symbol, results);
    const buckets: string[] = [];
    const bucketScores: Record<string, number> = {};
    for (const r of results) {
      if (r.triggered) {
        buckets.push(r.detectorId);
        if (r.strengthScore !== null) bucketScores[r.detectorId] = r.strengthScore;
        detectorSummary[r.detectorId].triggeredCount += 1;
      }
    }

    return {
      symbol,
      securityName: raw.securityName,
      exchange: raw.exchange,
      profile,
      speculative,
      marketCap: quote.marketCap!,
      avgDollarVolume: quote.avgDollarVolume!,
      regularMarketPrice: quote.regularMarketPrice,
      quoteType: quote.quoteType,
      fullExchangeName: quote.fullExchangeName,
      sector: enrich?.sector,
      industry: enrich?.industry,
      profileAvailability: enrich?.profileAvailability ?? "不可得",
      institutionsPercentHeld: enrich?.institutionsPercentHeld,
      institutionsPercentHeldAvailability: enrich?.institutionsPercentHeldAvailability ?? "不可得",
      ohlcvTradingDays: enrich?.ohlcvTradingDays,
      ohlcvAvailability: enrich?.ohlcvAvailability ?? "不可得",
      fetchedAt: quote.fetchedAt,
      flags,
      buckets,
      bucketScores,
    };
  });

  const zeroHitBuckets = Object.entries(detectorSummary).filter(([, v]) => v.triggeredCount === 0).map(([id]) => id);
  const zeroHitBucketsNote =
    zeroHitBuckets.length === 0
      ? null
      : `Bucket(s) with zero hits this run: ${zeroHitBuckets.join(", ")}. This can reflect a genuinely quiet/extreme market regime for that setup type rather than a bug - see TASK_CARD_02 report for this run's manual review of whether that is plausible.`;

  // TASK_CARD_03 SCOPE 1: fundamentals only for the "候选" pool (bucket-
  // triggered symbols), not the full gate-passed universe - see
  // ai/decisions.md. Phase C mirrors Phase B's checkpoint/resume shape.
  const candidatePool = symbols.filter((s) => s.buckets.length > 0).map((s) => s.symbol);
  const candidatePoolSet = new Set(candidatePool);
  mark("detect_detectors");
  console.error(`[screen] Phase fundamentals: ${candidatePool.length} candidate-pool symbols...`);
  await runFundamentalsPhase(candidatePool, checkpoint, CHECKPOINT_PATH);
  console.error(`[screen] Phase fundamentals done: ${Object.keys(checkpoint.fundamentalsResults).length} fetched total, ${checkpoint.fundamentalsFailures.length} failed total`);
  mark("fetch_fundamentals");

  // TASK_CARD_03_PATCH Part A: over the full gate-passed universe (not
  // the candidate pool), reusing the buckets/flags already computed above.
  console.error(`[screen] Phase sector footprint: aggregating over ${symbols.length} symbols...`);
  const footprintInputs: SymbolFootprintInput[] = symbols.map((s) => ({
    sector: s.sector,
    institutionalAccumulationHit: s.buckets.includes("institutional_accumulation_proxy"),
    insiderCluster: s.flags.insiderCluster === true,
    shortInterestDeclineHit:
      s.flags.shortInterestChangePercent !== null && s.flags.shortInterestChangePercent <= -card04Config.shortInterest.significantDeclinePercent,
    volatilityCompressionHit: s.buckets.includes("volatility_compression_setup"),
  }));
  const sectorFootprints = aggregateSectorFootprints(footprintInputs, Object.keys(SECTOR_TO_ETF), sectorFootprintConfig);
  const anomalyCount = sectorFootprints.filter((f) => f.footprintAnomaly).length;
  console.error(`[screen] Phase sector footprint done: ${anomalyCount} sector(s) flagged footprint_anomaly`);
  mark("detect_sector_footprint");

  console.error(`[screen] Phase market context: sector rankings + regime snapshot...`);
  const { sectorRankings, marketRegime, sectorReturns } = await fetchMarketContext();
  mark("fetch_market_context");
  const sectorRankBySector = new Map(sectorRankings.map((r) => [r.sector, r]));

  const eventWindowNow = new Date();
  const enrichedSymbols: ScreenOutputSymbol[] = symbols.map((s) => {
    const fundamentals = candidatePoolSet.has(s.symbol) ? checkpoint.fundamentalsResults[s.symbol] : undefined;
    return {
      ...s,
      sectorRank: s.sector !== undefined ? sectorRankBySector.get(s.sector) : undefined,
      fundamentals,
      eventWindow: fundamentals ? computeEventWindow(fundamentals.earningsDate, eventWindowNow, card03Config) : undefined,
    };
  });

  // TASK_CARD_05 SCOPE 2: selector + watchlist. Read the PREVIOUS run's
  // watchlist state from the ledger BEFORE this run appends anything -
  // that's what makes the promotion state machine work across runs.
  const runTimestamp = eventWindowNow.toISOString();
  const previousWatchlist = readPreviousWatchlistSymbols();

  const selectableSymbols: SelectableSymbol[] = enrichedSymbols.map((s) => ({
    symbol: s.symbol,
    profile: s.profile,
    buckets: s.buckets,
    bucketScores: s.bucketScores,
    flags: s.flags,
  }));

  console.error(`[screen] Phase select: candidates + watchlist...`);
  const selectedCandidates: SelectedCandidate[] = selectCandidates(selectableSymbols, previousWatchlist, card05Config);
  const candidateSymbolSet = new Set(selectedCandidates.map((c) => c.symbol));
  const watchlistEntries: WatchlistEntry[] = selectWatchlist(selectableSymbols, candidateSymbolSet, combinedDetectorsConfig, card05Config);
  const promotedThisRun = selectedCandidates.filter((c) => c.promoted).map((c) => c.symbol);
  console.error(`[screen] Phase select done: ${selectedCandidates.length} candidates, ${watchlistEntries.length} watchlist, ${promotedThisRun.length} promoted`);
  mark("detect_select");

  const enrichedBySymbol = new Map(enrichedSymbols.map((s) => [s.symbol, s]));

  // TASK_CARD_07 Part A: full 11-sector flow scan + hot-sector detail
  // (科技/软件, AI基建, 航天/太空 + any real sector flagged footprintAnomaly
  // this run but not already named). Reuses already-fetched sector ETF
  // returns and already-cached basket-ticker OHLCV - no new network calls.
  console.error(`[screen] Phase sector flow: computing weekly flow scan + hot-sector detail...`);
  const candidateSectorCounts = new Map<string, number>();
  const watchlistSectorCounts = new Map<string, number>();
  const candidatesInfo: CandidateSectorInfo[] = selectedCandidates.map((c) => {
    const sector = enrichedBySymbol.get(c.symbol)?.sector;
    if (sector) candidateSectorCounts.set(sector, (candidateSectorCounts.get(sector) ?? 0) + 1);
    return { symbol: c.symbol, sector };
  });
  const watchlistInfo: CandidateSectorInfo[] = watchlistEntries.map((w) => {
    const sector = enrichedBySymbol.get(w.symbol)?.sector;
    if (sector) watchlistSectorCounts.set(sector, (watchlistSectorCounts.get(sector) ?? 0) + 1);
    return { symbol: w.symbol, sector };
  });
  const sectorFlowScan = computeSectorFlowScan(sectorReturns, sectorFootprints, candidateSectorCounts, watchlistSectorCounts, card07Config);

  const basketTickerSet = new Set(hotSectorsConfig.hotSectors.filter((d) => d.kind === "basket").flatMap((d) => d.tickers ?? []));
  const basketTickerStats = new Map<string, BasketTickerStat>();
  for (const ticker of basketTickerSet) {
    const enrich = checkpoint.enrichResults[ticker];
    const matchedSymbol = enrichedBySymbol.get(ticker);
    if (!enrich || !matchedSymbol) continue; // not in this run's gate-passed universe - honestly excluded from the basket average, not fabricated (see config/hot_sectors.json's coverage-disclosure comment)
    const closes = cleanBars(enrich.ohlcv ?? []).map((b) => b.close);
    basketTickerStats.set(ticker, {
      weeklyReturn: trailingReturn(closes, card03Config.sector.oneWeekTradingDays),
      volatilityCompressionHit: matchedSymbol.buckets.includes("volatility_compression_setup"),
    });
  }
  const hotSectorDetail = computeHotSectorDetail(sectorFlowScan, sectorFootprints, hotSectorsConfig, basketTickerStats, candidatesInfo, watchlistInfo);
  console.error(
    `[screen] Phase sector flow done: ${sectorFlowScan.filter((f) => f.flowState === "flow_in").length} flow_in, ${sectorFlowScan.filter((f) => f.flowState === "flow_out").length} flow_out, ${hotSectorDetail.length} hot-sector entries`,
  );
  mark("detect_sector_flow");

  // TASK_CARD_05 SCOPE 1: FMP enrichment only for the narrowed candidate+watchlist pool (<= 15), never the full universe (Memo No.4 E17).
  const enrichPoolSymbols = [...new Set([...selectedCandidates.map((c) => c.symbol), ...watchlistEntries.map((w) => w.symbol)])];
  console.error(`[screen] Phase FMP: ${enrichPoolSymbols.length} candidate+watchlist symbols${process.env.FMP_API_KEY ? "" : " (no FMP_API_KEY configured - all 不可得)"}...`);
  const fmpBySymbol = new Map<string, FmpEnrichmentResult>();
  for (const symbol of enrichPoolSymbols) {
    const yahooPrice = enrichedBySymbol.get(symbol)?.regularMarketPrice;
    const fmp = await fetchFmpEnrichment(symbol, yahooPrice, process.env.FMP_API_KEY, card05Config);
    fmpBySymbol.set(symbol, fmp);
  }
  mark("fetch_fmp");

  // TASK_CARD_09 Part B / 修正案十六: options intelligence, same
  // candidate+watchlist-only pool as FMP above - never the full universe,
  // and structurally downstream of selectCandidates/selectWatchlist
  // (already finalized above), so there is no code path from this data
  // back into bucket judgment or candidate selection.
  console.error(`[screen] Phase options: ${enrichPoolSymbols.length} candidate+watchlist symbols...`);
  const optionsBySymbol = new Map<string, OptionsIntelligence>();
  for (const symbol of enrichPoolSymbols) {
    const chain = await fetchOptionsChain(symbol);
    const priorSnapshots = checkpoint.optionsHistory[symbol] ?? [];
    const { intelligence, snapshot } = computeOptionsIntelligence(chain, priorSnapshots, card09Config);
    optionsBySymbol.set(symbol, intelligence);
    checkpoint.optionsHistory[symbol] = [...priorSnapshots, snapshot].slice(-card09Config.options.ivMoveAvgWindowDays);
  }
  saveCheckpoint(CHECKPOINT_PATH, checkpoint);
  mark("fetch_options");

  function pivotsFor(symbol: string) {
    const ohlcv = checkpoint.enrichResults[symbol]?.ohlcv ?? [];
    const clean = cleanBars(ohlcv);
    return { high: mostRecentPivotHigh(clean, 2, 90), low: mostRecentPivotLow(clean, 2, 90) };
  }
  function closes90dFor(symbol: string): number[] {
    const ohlcv = checkpoint.enrichResults[symbol]?.ohlcv ?? [];
    return cleanBars(ohlcv)
      .slice(-90)
      .map((b) => b.close);
  }

  const payloadCandidates: PayloadCandidateInput[] = selectedCandidates.map((c) => {
    const s = enrichedBySymbol.get(c.symbol)!;
    const pivots = pivotsFor(c.symbol);
    return {
      symbol: c.symbol,
      securityName: s.securityName,
      profile: s.profile,
      speculative: s.speculative,
      // TASK_CARD_08 Part A: baseline from the candidate's own speculative
      // flag, bumped one level when this run's credit regime is tight.
      riskLevel: computeRiskLevel(s.speculative, creditRegime.label === "tight"),
      primaryBucket: c.primaryBucket,
      primaryBucketScore: c.primaryBucketScore,
      allBucketsHit: c.allBucketsHit,
      promoted: c.promoted,
      flags: s.flags,
      fundamentals: s.fundamentals,
      eventWindow: s.eventWindow,
      sectorRank: s.sectorRank,
      pivotHigh: pivots.high,
      pivotLow: pivots.low,
      // TASK_CARD_09 Part B: candidate+watchlist pool only, computed after selection - see the fetch_options phase above.
      optionsIntelligence: optionsBySymbol.get(c.symbol)!,
    };
  });

  // claude_code_design_draft.md §1.1/§1.2: a symbol's own detector results
  // (captured above, in detector-array order = BUCKET_ORDER order) grouped
  // by bucket id, then merged across whichever bucket(s) it actually hit.
  function footprintFor(symbol: string, buckets: string[]): { detail: FootprintCondition[]; strength: ReturnType<typeof computeFootprintStrength> } {
    const results = detectorResultsBySymbol.get(symbol) ?? [];
    const conditionsByBucket = new Map(results.map((r) => [r.detectorId, r.conditions]));
    const detail = mergeFootprintDetail(buckets, conditionsByBucket);
    const strength = computeFootprintStrength(detail, card05Config.footprintStrengthBands);
    return { detail, strength };
  }

  const htmlCandidates: HtmlReportCandidateInput[] = payloadCandidates
    .map((p) => {
      const { detail, strength } = footprintFor(p.symbol, p.allBucketsHit);
      return {
        ...p,
        closes90d: closes90dFor(p.symbol),
        fmp: fmpBySymbol.get(p.symbol),
        footprintDetail: detail,
        footprintStrength: strength,
      };
    })
    // §1.3: display order only (round-robin selection above is untouched) -
    // strongest footprint first, null (all-unavailable) sinks to the bottom.
    .sort((a, b) => {
      if (a.footprintStrength.ratio === null && b.footprintStrength.ratio === null) return 0;
      if (a.footprintStrength.ratio === null) return 1;
      if (b.footprintStrength.ratio === null) return -1;
      return b.footprintStrength.ratio - a.footprintStrength.ratio;
    });

  console.error(`[screen] Phase reporting: generating PAYLOAD, DISSENT PAYLOAD, HTML report...`);
  const atlasPayloadText = generateAtlasPayload({
    runMeta: { timestamp: runTimestamp, profileArg, gatesPassedCount: symbols.length },
    marketRegime,
    creditRegime,
    smallSpecForcedDisabled,
    sectorFootprints,
    sectorFlowScan,
    hotSectorDetail,
    candidates: payloadCandidates,
  });
  const dissentPayloadText = generateDissentPayload(
    selectedCandidates.map((c) => ({ symbol: c.symbol, primaryBucket: c.primaryBucket })),
    runTimestamp,
  );

  const outcomeJoined = joinScreeningWithOutcome();
  const nowForLedger = new Date();
  const MAX_HOLDING_DAYS_FOR_BACKFILL_NUDGE = 180; // outer bound of all 3 legal holding periods (Layer 1 never assigns a specific one - see ai/decisions.md)
  const pendingBackfill = outcomeJoined
    .filter(({ outcome, screening }) => outcome === null && (nowForLedger.getTime() - new Date(screening.screeningTimestamp).getTime()) / 86400000 > MAX_HOLDING_DAYS_FOR_BACKFILL_NUDGE)
    .map(({ screening }) => screening);
  const invalidatedEntries = outcomeJoined
    .filter(({ outcome }) => outcome?.outcome.invalidationTriggered === true)
    .map(({ screening, outcome }) => ({ screening, invalidatedAt: outcome!.backfilledAt }));

  const watchlistForHtml = watchlistEntries.map((w) => {
    const { detail, strength } = footprintFor(w.symbol, enrichedBySymbol.get(w.symbol)?.buckets ?? []);
    return {
      symbol: w.symbol,
      securityName: enrichedBySymbol.get(w.symbol)?.securityName ?? w.symbol,
      reason: w.reason,
      footprintDetail: detail,
      footprintStrength: strength,
    };
  });

  const htmlReportText = renderReport({
    runMeta: { timestamp: runTimestamp, profileArg, gatesPassedCount: symbols.length, detectorSummary },
    marketRegime,
    creditRegime,
    smallSpecForcedDisabled,
    sectorFootprints,
    sectorFlowScan,
    hotSectorDetail,
    candidates: htmlCandidates,
    watchlist: watchlistForHtml,
    promotedThisRun,
    ledgerPendingBackfill: pendingBackfill,
    ledgerInvalidated: invalidatedEntries,
  });

  const runFolder = resolveRunFolder(runTimestamp);
  mkdirSync(runFolder, { recursive: true });
  const atlasPayloadPath = `${runFolder}/ATLAS_PAYLOAD.txt`;
  const dissentPayloadPath = `${runFolder}/ATLAS_DISSENT_PAYLOAD.txt`;
  const htmlReportPath = `${runFolder}/report.html`;
  writeFileSync(atlasPayloadPath, atlasPayloadText, "utf-8");
  writeFileSync(dissentPayloadPath, dissentPayloadText, "utf-8");
  writeFileSync(htmlReportPath, htmlReportText, "utf-8");
  // Always-current pointer to the most recent report, independent of date -
  // "看最新报告" never requires knowing which dated folder to look in.
  writeFileSync("output/latest.html", htmlReportText, "utf-8");
  console.error(`[screen] Phase reporting done: ${atlasPayloadPath}, ${dissentPayloadPath}, ${htmlReportPath} (+ output/latest.html updated)`);
  mark("report_generate");

  // TASK_CARD_05 SCOPE 6: ledger append (candidates + watchlist). Never
  // mutates any existing line - each call is a fresh append.
  for (const c of selectedCandidates) {
    const s = enrichedBySymbol.get(c.symbol)!;
    appendLedgerEntry({
      recordType: "screening",
      symbol: c.symbol,
      screeningTimestamp: runTimestamp,
      profile: s.profile,
      speculative: s.speculative,
      status: c.promoted ? "promoted" : "candidate",
      buckets: c.allBucketsHit,
      flagsSnapshot: s.flags,
      holdingPeriod: null,
      opportunityType: c.primaryBucket,
    });
  }
  for (const w of watchlistEntries) {
    const s = enrichedBySymbol.get(w.symbol)!;
    appendLedgerEntry({
      recordType: "screening",
      symbol: w.symbol,
      screeningTimestamp: runTimestamp,
      profile: s.profile,
      speculative: s.speculative,
      status: "watchlist",
      buckets: s.buckets,
      flagsSnapshot: s.flags,
      holdingPeriod: null,
      opportunityType: null,
    });
  }
  console.error(`[screen] Phase ledger done: ${selectedCandidates.length + watchlistEntries.length} entries appended`);
  mark("report_ledger");

  // TASK_CARD_06 SCOPE 2: fold the mark() timestamps into per-segment
  // durations, then roll those up into the 4 macro categories.
  const detail: Record<string, number> = {};
  for (let i = 1; i < marks.length; i++) {
    detail[marks[i].label] = marks[i].t - marks[i - 1].t;
  }
  const timingBreakdown = {
    universeMs: 0,
    fetchMs: 0,
    detectMs: 0,
    reportMs: 0,
    detail,
  };
  for (const [label, ms] of Object.entries(detail)) {
    const category = PHASE_CATEGORY[label];
    if (category === "universe") timingBreakdown.universeMs += ms;
    else if (category === "fetch") timingBreakdown.fetchMs += ms;
    else if (category === "detect") timingBreakdown.detectMs += ms;
    else if (category === "report") timingBreakdown.reportMs += ms;
  }
  console.error(
    `[screen] timing breakdown: 宇宙=${timingBreakdown.universeMs}ms 抓取=${timingBreakdown.fetchMs}ms 检测=${timingBreakdown.detectMs}ms 报告=${timingBreakdown.reportMs}ms total=${Date.now() - t0}ms`,
  );

  // TASK_CARD_06 SCOPE 2: failure-symbol attribution. Only the 3 fetch
  // phases that key their failures by symbol (not accession path) are
  // attributable here - see the ScreenRunResult.runMeta.failureAttribution
  // doc comment above for why insider filing failures are excluded.
  const failuresBySymbol = new Map<string, string[]>();
  const noteFailure = (symbol: string, phase: string) => {
    const existing = failuresBySymbol.get(symbol);
    if (existing) existing.push(phase);
    else failuresBySymbol.set(symbol, [phase]);
  };
  for (const s of checkpoint.quoteFailures) noteFailure(s, "quote");
  for (const s of checkpoint.enrichFailures) noteFailure(s, "enrichment");
  for (const s of checkpoint.fundamentalsFailures) noteFailure(s, "fundamentals");
  const failureAttribution = {
    bySymbol: Object.fromEntries(failuresBySymbol),
    totalDistinctSymbolsFailed: failuresBySymbol.size,
  };
  console.error(
    failuresBySymbol.size === 0
      ? `[screen] failure attribution: 0 symbols failed at any fetch phase this run`
      : `[screen] failure attribution: ${failuresBySymbol.size} distinct symbol(s) failed (quote=${checkpoint.quoteFailures.length}, enrichment=${checkpoint.enrichFailures.length}, fundamentals=${checkpoint.fundamentalsFailures.length}) - see runMeta.failureAttribution.bySymbol for the full per-symbol breakdown`,
  );

  return {
    runMeta: {
      timestamp: runTimestamp,
      profileArg,
      rawUniverseCount: rawCount,
      postExclusionCount: universe.length,
      excludedByReason,
      quoteFetchFailureCount: checkpoint.quoteFailures.length,
      quoteFetchFailures: checkpoint.quoteFailures,
      gatesPassedCount: symbols.length,
      detectorSummary,
      zeroHitBucketsNote,
      fundamentalsCandidatePoolSize: candidatePool.length,
      fundamentalsFetchFailures: checkpoint.fundamentalsFailures,
      sectorRankings,
      marketRegime,
      creditRegime,
      smallSpecForcedDisabled,
      insiders: {
        daysScanned: Object.keys(checkpoint.insiderDailyIndexCache).length,
        relevantFilingsFound: Object.values(checkpoint.insiderDailyIndexCache).reduce((a, f) => a + f.length, 0),
        filingsParsed: Object.keys(checkpoint.insiderFilingResults).length,
        filingsFailed: checkpoint.insiderFilingFailures.length,
        symbolsWithCluster: [...insiderClusters.values()].filter((c) => c.insiderCluster).length,
      },
      shortInterest: {
        settlementDate: shortInterestFile?.settlementDate ?? null,
        lagDays: shortInterestFile?.lagDays ?? null,
        recordCount: shortInterestFile?.records.size ?? 0,
      },
      sectorFootprints,
      sectorFlowScan,
      hotSectorDetail,
      elapsedMs: Date.now() - t0,
      timingBreakdown,
      failureAttribution,
    },
    symbols: enrichedSymbols,
    selection: {
      candidates: selectedCandidates,
      watchlist: watchlistEntries,
      promotedThisRun,
      runFolder,
      atlasPayloadPath,
      dissentPayloadPath,
      htmlReportPath,
    },
  };
}

/**
 * Full per-symbol OHLCV bars are intentionally not embedded here (they
 * live in output/checkpoint.json's enrichResults) to keep this file
 * human-scannable rather than tens of MB; a future card can decide their
 * final storage location once detectors need to consume them.
 */
export function writeScreenOutput(result: ScreenRunResult): string {
  const path = `${result.selection.runFolder}/screen_run.json`;
  writeFileSync(path, JSON.stringify(result, null, 2), "utf-8");
  return path;
}
