import { fetchEnrichment, fetchQuoteBatch } from "./yahooClient.js";
import { saveCheckpoint, type CheckpointState } from "./checkpoint.js";
import fetchConfig from "../../config/fetch.json" with { type: "json" };

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
 */
export async function runEnrichmentPhase(
  symbols: string[],
  checkpoint: CheckpointState,
  checkpointPath: string,
): Promise<void> {
  const done = new Set([...Object.keys(checkpoint.enrichResults), ...checkpoint.enrichFailures]);
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
