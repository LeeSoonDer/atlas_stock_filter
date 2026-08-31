import { fetchEnrichment, fetchFundamentalsRaw, fetchInstitutionsPercentHeld, fetchQuoteBatch } from "./yahooClient.js";
import { saveCheckpoint, type CheckpointState } from "./checkpoint.js";
import { computeFundamentalFlags } from "../screen/fundamentals/computeFundamentalFlags.js";
import { appendSnapshot } from "../screen/institutions/institutionalTrend.js";
import { fetchTickerCikMaps, scanOneDailyIndex, fetchAndParseFiling, lookbackWindowDays } from "./insiders/index.js";
import fetchConfig from "../../config/fetch.json" with { type: "json" };
import card03Config from "../../config/card03.json" with { type: "json" };
import card04Config from "../../config/card04.json" with { type: "json" };
import card09Config from "../../config/card09.json" with { type: "json" };
import type { ProfileName } from "../screen/types.js";

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= fetchConfig.maxRetriesPerSymbol; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < fetchConfig.maxRetriesPerSymbol) {
        const backoff = fetchConfig.backoffBaseMs * Math.pow(fetchConfig.backoffMultiplier, attempt);
        console.error(`[retry] ${label} attempt ${attempt + 1} failed, backing off ${backoff}ms: ${(err as Error).message}`);
        await sleep(backoff);
      }
    }
  }
  throw lastError;
}

/**
 * Phase A: fetches quote-level data (marketCap, avgDollarVolume) for the
 * whole exclusion-gated universe in large batched requests. Resumable:
 * symbols already present in checkpoint.quoteResults or quoteFailures are
 * skipped. A single-symbol failure never blocks the run - failures only
 * occur at the batch level after retries are exhausted, and only that
 * batch's symbols are marked failed; every other batch proceeds normally.
 */
export async function runQuotePhase(
  allSymbols: string[],
  checkpoint: CheckpointState,
  checkpointPath: string,
): Promise<void> {
  const done = new Set([...Object.keys(checkpoint.quoteResults), ...checkpoint.quoteFailures]);
  const remaining = allSymbols.filter((s) => !done.has(s));
  const batches = chunk(remaining, fetchConfig.quoteBatchSize);

  for (const [i, batch] of batches.entries()) {
    try {
      const results = await withRetry(() => fetchQuoteBatch(batch), `quote batch ${i + 1}/${batches.length}`);
      for (const r of results) {
        checkpoint.quoteResults[r.symbol] = r;
      }
    } catch (err) {
      console.error(`[quote phase] batch ${i + 1}/${batches.length} failed after retries, marking ${batch.length} symbols as failed: ${(err as Error).message}`);
      checkpoint.quoteFailures.push(...batch);
    }
    saveCheckpoint(checkpointPath, checkpoint);
    if (i < batches.length - 1) {
      await sleep(fetchConfig.delayMsBetweenQuoteBatches);
    }
  }
}

/**
 * Phase B: fetches enrichment data (sector/industry, institutional %,
 * OHLCV) for symbols that already survived the profile gate. Concurrency-
 * limited, checkpointed per symbol, resumable.
 *
 * One-time migration: TASK_CARD_04 added floatShares to EnrichSlice.
 * An entry cached before that field existed has
 * floatSharesAvailability === undefined (not "不可得" - the field is
 * simply absent from the old JSON), so such entries are treated as
 * NOT done here and get refetched once to backfill it, then cache
 * normally again afterward.
 */
export async function runEnrichmentPhase(
  symbols: string[],
  checkpoint: CheckpointState,
  checkpointPath: string,
): Promise<void> {
  const doneResults = Object.entries(checkpoint.enrichResults)
    .filter(([, v]) => v.floatSharesAvailability !== undefined)
    .map(([symbol]) => symbol);
  const done = new Set([...doneResults, ...checkpoint.enrichFailures]);
  const remaining = symbols.filter((s) => !done.has(s));
  const batches = chunk(remaining, fetchConfig.enrichConcurrency);

  for (const [i, batch] of batches.entries()) {
    const settled = await Promise.allSettled(
      batch.map((symbol) => withRetry(() => fetchEnrichment(symbol), `enrich ${symbol}`)),
    );
    settled.forEach((result, idx) => {
      const symbol = batch[idx];
      if (result.status === "fulfilled") {
        checkpoint.enrichResults[symbol] = result.value;
      } else {
        console.error(`[enrich phase] ${symbol} failed after retries: ${(result.reason as Error).message}`);
        checkpoint.enrichFailures.push(symbol);
      }
    });
    saveCheckpoint(checkpointPath, checkpoint);
    if (i < batches.length - 1) {
      await sleep(fetchConfig.delayMsBetweenEnrichBatches);
    }
  }
}

// TASK_CARD_09 Part C: card03Config stays the single source of truth for
// its own 4 threshold numbers; card09Config's 2 new ones are merged in
// at wire-up time here, same pattern pipeline.ts already uses for
// combinedDetectorsConfig.
const fundamentalsConfig = { ...card03Config, fundamentals: { ...card03Config.fundamentals, ...card09Config.fundamentals } };

/**
 * Phase C (TASK_CARD_03): fetches + classifies fundamental flags for the
 * "候选" pool only (symbols that triggered at least one CARD 02 detector
 * bucket - see ai/decisions.md), not the full gate-passed universe.
 * Same concurrency/checkpoint/resume shape as Phase B. TASK_CARD_09 Part
 * C needs each symbol's profile (cash runway is SMALL_SPEC-only).
 */
export async function runFundamentalsPhase(
  symbols: Array<{ symbol: string; profile: ProfileName }>,
  checkpoint: CheckpointState,
  checkpointPath: string,
): Promise<void> {
  // TASK_CARD_09 Part C migration (same pattern as runEnrichmentPhase's
  // floatShares backfill above): an entry cached before accrualFlag
  // existed has accrualFlagAvailability === undefined (the field is
  // simply absent from the old JSON, not "不可得"), so it's treated as
  // NOT done here and gets refetched once to backfill it.
  const doneResults = Object.entries(checkpoint.fundamentalsResults)
    .filter(([, v]) => v.accrualFlagAvailability !== undefined)
    .map(([symbol]) => symbol);
  const done = new Set([...doneResults, ...checkpoint.fundamentalsFailures]);
  const remaining = symbols.filter((s) => !done.has(s.symbol));
  const batches = chunk(remaining, fetchConfig.enrichConcurrency);

  for (const [i, batch] of batches.entries()) {
    const settled = await Promise.allSettled(
      batch.map(async ({ symbol, profile }) => {
        const raw = await withRetry(() => fetchFundamentalsRaw(symbol), `fundamentals ${symbol}`);
        const flags = computeFundamentalFlags(raw, fundamentalsConfig, profile);
        return { symbol, fetchedAt: new Date().toISOString(), ...flags };
      }),
    );
    settled.forEach((result, idx) => {
      const symbol = batch[idx].symbol;
      if (result.status === "fulfilled") {
        checkpoint.fundamentalsResults[symbol] = result.value;
      } else {
        console.error(`[fundamentals phase] ${symbol} failed after retries: ${(result.reason as Error).message}`);
        checkpoint.fundamentalsFailures.push(symbol);
      }
    });
    saveCheckpoint(checkpointPath, checkpoint);
    if (i < batches.length - 1) {
      await sleep(fetchConfig.delayMsBetweenEnrichBatches);
    }
  }
}

/**
 * Phase Institutions (TASK_CARD_04 SCOPE 2): fetches a fresh
 * institutionsPercentHeld for the full gate-passed universe and appends
 * it to checkpoint.institutionalHistory. Deliberately NOT cache-once
 * like Phase B - "done for this run" is tracked by whether today's date
 * already has an entry, so an interrupted run resumes correctly and a
 * same-day retry is automatic (no separate failure list needed, since
 * this phase is designed to re-run fresh every day anyway).
 */
export async function runInstitutionalTrendPhase(
  symbols: string[],
  checkpoint: CheckpointState,
  checkpointPath: string,
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const remaining = symbols.filter((s) => !(checkpoint.institutionalHistory[s] ?? []).some((h) => h.asOf === today));
  const batches = chunk(remaining, fetchConfig.enrichConcurrency);

  for (const [i, batch] of batches.entries()) {
    const settled = await Promise.allSettled(
      batch.map((symbol) => withRetry(() => fetchInstitutionsPercentHeld(symbol), `institutions ${symbol}`)),
    );
    settled.forEach((result, idx) => {
      const symbol = batch[idx];
      if (result.status === "fulfilled" && result.value !== undefined) {
        checkpoint.institutionalHistory[symbol] = appendSnapshot(checkpoint.institutionalHistory[symbol] ?? [], result.value);
      } else if (result.status === "rejected") {
        console.error(`[institutions phase] ${symbol} failed after retries: ${(result.reason as Error).message}`);
      }
    });
    saveCheckpoint(checkpointPath, checkpoint);
    if (i < batches.length - 1) {
      await sleep(fetchConfig.delayMsBetweenEnrichBatches);
    }
  }
}

/**
 * Phase Insiders-Index (TASK_CARD_04 SCOPE 1): scans one daily index per
 * calendar day in the trailing lookbackDays window, caching each day's
 * relevant filings permanently (daily indexes are immutable once SEC
 * publishes them - a day is never rescanned once present in
 * insiderDailyIndexCache, including days with zero relevant filings,
 * e.g. weekends/holidays, whose empty array IS the cached result).
 * Cheap relative to Phase Insiders-Filings below (~1 request/day vs.
 * ~1 request/relevant-filing) - rate-limited via secFetch itself, not
 * an extra delay here.
 */
export async function runInsidersIndexPhase(
  cikSet: Set<string>,
  tickerByCik: Map<string, string>,
  checkpoint: CheckpointState,
  checkpointPath: string,
): Promise<void> {
  const days = lookbackWindowDays(card04Config.insiders.lookbackDays, new Date());
  const remaining = days.filter((d) => !(d in checkpoint.insiderDailyIndexCache));

  let sinceLastSave = 0;
  for (const day of remaining) {
    const filings = await withRetry(
      () => scanOneDailyIndex(day, cikSet, tickerByCik, card04Config.insiders.maxRequestsPerSecond),
      `insider daily index ${day}`,
    );
    checkpoint.insiderDailyIndexCache[day] = filings;
    sinceLastSave++;
    if (sinceLastSave >= 5) {
      saveCheckpoint(checkpointPath, checkpoint);
      sinceLastSave = 0;
    }
  }
  if (sinceLastSave > 0) saveCheckpoint(checkpointPath, checkpoint);
}

/**
 * Phase Insiders-Filings (TASK_CARD_04 SCOPE 1): fetches + parses every
 * relevant filing discovered by runInsidersIndexPhase that isn't already
 * in insiderFilingResults/insiderFilingFailures. This is the card's
 * single most expensive operation (~27,000 filings for the full 90-day
 * window on a cold run per this card's own investigation) - rate-limited
 * sequentially via secFetch, checkpointed every 50 filings (not every
 * one - at this volume, per-filing disk writes would be a meaningful
 * fraction of total runtime on their own) so an interruption loses at
 * most 50 filings of progress, and a resumed run only fetches what's
 * still missing (filings are immutable once published, so cached
 * results are permanent - no re-fetch, ever, for a given accessionPath).
 */
export async function runInsidersFilingsPhase(
  checkpoint: CheckpointState,
  checkpointPath: string,
): Promise<void> {
  const allRelevant = Object.values(checkpoint.insiderDailyIndexCache).flat();
  const done = new Set([...Object.keys(checkpoint.insiderFilingResults), ...checkpoint.insiderFilingFailures]);
  const remaining = allRelevant.filter((f) => !done.has(f.accessionPath));

  let sinceLastSave = 0;
  for (const filing of remaining) {
    try {
      const parsed = await withRetry(
        () => fetchAndParseFiling(filing, card04Config.insiders.maxRequestsPerSecond),
        `insider filing ${filing.accessionPath}`,
      );
      if (parsed) {
        checkpoint.insiderFilingResults[filing.accessionPath] = parsed;
      } else {
        checkpoint.insiderFilingFailures.push(filing.accessionPath);
      }
    } catch (err) {
      console.error(`[insider filings phase] ${filing.accessionPath} failed after retries: ${(err as Error).message}`);
      checkpoint.insiderFilingFailures.push(filing.accessionPath);
    }
    sinceLastSave++;
    if (sinceLastSave >= 50) {
      saveCheckpoint(checkpointPath, checkpoint);
      sinceLastSave = 0;
    }
  }
  if (sinceLastSave > 0) saveCheckpoint(checkpointPath, checkpoint);
}

export { fetchTickerCikMaps };
