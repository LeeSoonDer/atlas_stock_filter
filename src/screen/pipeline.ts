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
import { loadCheckpoint } from "../data/checkpoint.js";
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
/** Reshapes card04Config's threshold values into DetectorsConfig's shape at wire-up time - card04.json stays the single source of truth for its own numbers (see Detector D's own file comment). */
const combinedDetectorsConfig: DetectorsConfig = {
  ...detectorsConfig,
  detectorD_institutionalAccumulation: {
    minConditionsRequired: card04Config.detectorD.minConditionsRequired,
    shortInterestSignificantDeclinePercent: card04Config.shortInterest.significantDeclinePercent,
    squeezeMinFloatPercent: card04Config.shortInterest.squeezeMinFloatPercent,
  },
};

/**
 * TASK_CARD_03 SCOPE 2/3: fetches SPY, ^VIX, and the 11 SPDR sector ETFs
 * (13 lightweight chart-only calls, not checkpointed - cheap enough to
 * redo every run) and assembles the sector rankings + market regime
 * snapshot. Computed once per run, independent of --profile.
 */
async function fetchMarketContext(): Promise<{ sectorRankings: SectorRanking[]; marketRegime: MarketRegimeSnapshot }> {
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
      oneMonthReturn: trailingReturn(closes, card03Config.sector.oneMonthTradingDays),
      threeMonthReturn: trailingReturn(closes, card03Config.sector.threeMonthTradingDays),
    };
  });

  const sectorRankings = rankSectors(sectorReturns, card03Config);
  const marketRegime = computeMarketRegime(spyCloses, vixCloses, sectorRankings, card03Config);

  return { sectorRankings, marketRegime };
}

function evaluateProfileGate(
  quote: QuoteSlice,
  config: ProfilesConfig,
): { profile: ProfileName; speculative: boolean } | null {
  const { marketCap, avgDollarVolume: adv } = quote;
  if (marketCap === undefined || adv === undefined) return null;

  const std = config.STANDARD;
  if (marketCap >= std.minMarketCap && (std.maxMarketCap === null || marketCap <= std.maxMarketCap) && adv >= std.minAvgDollarVolume) {
    return { profile: "STANDARD", speculative: std.speculative };
  }
  const spec = config.SMALL_SPEC;
  if (marketCap >= spec.minMarketCap && (spec.maxMarketCap === null || marketCap <= spec.maxMarketCap) && adv >= spec.minAvgDollarVolume) {
    return { profile: "SMALL_SPEC", speculative: spec.speculative };
  }
  return null;
}

function requestedProfiles(arg: ProfileArg): ProfileName[] {
  if (arg === "both") return ["STANDARD", "SMALL_SPEC"];
  return arg === "standard" ? ["STANDARD"] : ["SMALL_SPEC"];
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
    elapsedMs: number;
  };
  symbols: ScreenOutputSymbol[];
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

  console.error(`[screen] building universe...`);
  const { rawCount, excludedCount, excludedByReason, universe } = await buildUniverse();
  console.error(`[screen] universe: ${rawCount} raw -> ${universe.length} post-exclusion (${excludedCount} excluded)`);

  const checkpoint = loadCheckpoint(CHECKPOINT_PATH, "ATLAS_UNIVERSE");
  const allSymbols = universe.map((u) => u.symbol);

  console.error(`[screen] Phase A: quote fetch for ${allSymbols.length} symbols...`);
  await runQuotePhase(allSymbols, checkpoint, CHECKPOINT_PATH);
  console.error(`[screen] Phase A done: ${Object.keys(checkpoint.quoteResults).length} fetched, ${checkpoint.quoteFailures.length} failed`);

  const wanted = new Set(requestedProfiles(profileArg));
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

  console.error(`[screen] Phase insiders-filings: fetching + parsing ${relevantFilingCount} filings (this is the slow one)...`);
  await runInsidersFilingsPhase(checkpoint, CHECKPOINT_PATH);
  console.error(`[screen] Phase insiders-filings done: ${Object.keys(checkpoint.insiderFilingResults).length} parsed total, ${checkpoint.insiderFilingFailures.length} failed total`);

  const insiderClusters = aggregateInsiderClusters(
    Object.values(checkpoint.insiderFilingResults),
    card04Config.insiders.lookbackDays,
    card04Config.insiders.clusterMinDistinctBuyers,
    new Date(),
  );

  console.error(`[screen] Phase institutions: fresh institutional-ownership snapshot for ${gatePassedSymbols.length} symbols...`);
  await runInstitutionalTrendPhase(gatePassedSymbols, checkpoint, CHECKPOINT_PATH);
  console.error(`[screen] Phase institutions done`);

  console.error(`[screen] Phase short-interest: fetching latest FINRA file...`);
  const shortInterestFile = await fetchLatestShortInterestFile(card04Config.shortInterest.settlementDateWalkBackDays);
  console.error(
    shortInterestFile
      ? `[screen] Phase short-interest done: settlementDate=${shortInterestFile.settlementDate} lagDays=${shortInterestFile.lagDays} records=${shortInterestFile.records.size}`
      : `[screen] Phase short-interest: no file found within the configured walk-back window`,
  );

  console.error(`[screen] Phase indicators: computing technical indicators for ${gatePassed.length} symbols...`);
  const flagsBySymbol = new Map<string, IndicatorFlags>();
  for (const { symbol } of gatePassed) {
    const ohlcv = checkpoint.enrichResults[symbol]?.ohlcv ?? [];
    const flags = computeIndicators(ohlcv, combinedDetectorsConfig);

    const cluster = insiderClusters.get(symbol);
    flags.insiderCluster = cluster ? cluster.insiderCluster : false;
    flags.insiderClusterDistinctBuyers = cluster?.distinctBuyerCount ?? 0;
    flags.insiderClusterLagDays = cluster?.lagDays ?? null;

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

  console.error(`[screen] Phase detectors: running ${allDetectors.length} detectors...`);
  const detectorSummary: Record<string, { triggeredCount: number }> = {};
  for (const d of allDetectors) detectorSummary[d.id] = { triggeredCount: 0 };

  const symbols: ScreenOutputSymbol[] = gatePassed.map(({ symbol, profile, speculative, quote }) => {
    const raw = universeBySymbol.get(symbol)!;
    const enrich = checkpoint.enrichResults[symbol];
    const flags = flagsBySymbol.get(symbol)!;

    const results: DetectorResult[] = allDetectors.map((d) => d.detect(flags, profile, combinedDetectorsConfig));
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
  console.error(`[screen] Phase fundamentals: ${candidatePool.length} candidate-pool symbols...`);
  await runFundamentalsPhase(candidatePool, checkpoint, CHECKPOINT_PATH);
  console.error(`[screen] Phase fundamentals done: ${Object.keys(checkpoint.fundamentalsResults).length} fetched total, ${checkpoint.fundamentalsFailures.length} failed total`);

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

  console.error(`[screen] Phase market context: sector rankings + regime snapshot...`);
  const { sectorRankings, marketRegime } = await fetchMarketContext();
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

  return {
    runMeta: {
      timestamp: new Date().toISOString(),
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
      elapsedMs: Date.now() - t0,
    },
    symbols: enrichedSymbols,
  };
}

/**
 * Full per-symbol OHLCV bars are intentionally not embedded here (they
 * live in output/checkpoint.json's enrichResults) to keep this file
 * human-scannable rather than tens of MB; a future card can decide their
 * final storage location once detectors need to consume them.
 */
export function writeScreenOutput(result: ScreenRunResult): string {
  const ts = result.runMeta.timestamp.replace(/[:.]/g, "-");
  const path = `output/screen_run_${ts}.json`;
  writeFileSync(path, JSON.stringify(result, null, 2), "utf-8");
  return path;
}
