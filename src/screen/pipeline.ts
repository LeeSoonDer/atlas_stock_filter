import { mkdirSync, writeFileSync } from "node:fs";
import { buildUniverse } from "../universe/index.js";
import type { ExclusionReason } from "../universe/types.js";
import { runQuotePhase, runEnrichmentPhase } from "../data/batchFetcher.js";
import { loadCheckpoint } from "../data/checkpoint.js";
import type { Availability, QuoteSlice } from "../data/types.js";
import type { ProfileArg, ProfileName, ProfilesConfig } from "./types.js";
import profilesConfig from "../../config/profiles.json" with { type: "json" };

const CHECKPOINT_PATH = "output/checkpoint.json";

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

  const symbols: ScreenOutputSymbol[] = gatePassed.map(({ symbol, profile, speculative, quote }) => {
    const raw = universeBySymbol.get(symbol)!;
    const enrich = checkpoint.enrichResults[symbol];
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
