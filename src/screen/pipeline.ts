import { mkdirSync, writeFileSync } from "node:fs";
import { buildUniverse } from "../universe/index.js";
import type { ExclusionReason } from "../universe/types.js";
import { runQuotePhase, runEnrichmentPhase } from "../data/batchFetcher.js";
import { loadCheckpoint } from "../data/checkpoint.js";
import type { Availability, QuoteSlice } from "../data/types.js";
import type { ProfileArg, ProfileName, ProfilesConfig } from "./types.js";
import profilesConfig from "../../config/profiles.json" with { type: "json" };
import detectorsConfigJson from "../../config/detectors.json" with { type: "json" };
import { computeIndicators } from "./indicators/computeIndicators.js";
import { percentileRank } from "./indicators/percentile.js";
import type { DetectorsConfig, IndicatorFlags } from "./indicators/types.js";
import { allDetectors } from "./detectors/index.js";
import type { DetectorResult } from "./detectors/IDetector.js";

const CHECKPOINT_PATH = "output/checkpoint.json";
const detectorsConfig = detectorsConfigJson as DetectorsConfig;

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

  console.error(`[screen] Phase indicators: computing technical indicators for ${gatePassed.length} symbols...`);
  const flagsBySymbol = new Map<string, IndicatorFlags>();
  for (const { symbol } of gatePassed) {
    const ohlcv = checkpoint.enrichResults[symbol]?.ohlcv ?? [];
    flagsBySymbol.set(symbol, computeIndicators(ohlcv, detectorsConfig));
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

    const results: DetectorResult[] = allDetectors.map((d) => d.detect(flags, profile, detectorsConfig));
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
      elapsedMs: Date.now() - t0,
    },
    symbols,
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
