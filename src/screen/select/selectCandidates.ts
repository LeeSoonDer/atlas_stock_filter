import type { DetectorsConfig } from "../indicators/types.js";
import { BUCKET_ORDER } from "./types.js";
import type { SelectableSymbol, SelectConfig, SelectedCandidate } from "./types.js";

function assignPrimaryBucket(s: SelectableSymbol): { bucket: string; score: number } | null {
  if (s.buckets.length === 0) return null;
  let best = s.buckets[0];
  let bestScore = s.bucketScores[best] ?? 0;
  for (const b of s.buckets) {
    const score = s.bucketScores[b] ?? 0;
    if (score > bestScore) {
      best = b;
      bestScore = score;
    }
  }
  return { bucket: best, score: bestScore };
}

/**
 * TASK_CARD_05 SCOPE 2. Two passes:
 *
 * 1. Promotion priority: any symbol that was on the PREVIOUS run's
 *    watchlist and now fully triggers a bucket gets a candidate seat
 *    FIRST (sorted by its new primary-bucket score, highest first),
 *    per "观察哨状态机...标记promoted,优先进候选" - this is a priority
 *    jump, not just an incidental promoted flag on whatever the normal
 *    round-robin would have picked anyway.
 *
 * 2. Round robin over remaining seats: cycles bucket order A->B->C->D->
 *    A... (BUCKET_ORDER), popping the top (highest within-bucket-score)
 *    unused symbol from each bucket in turn, until maxCandidates is
 *    filled or every bucket is exhausted. A symbol that hit multiple
 *    buckets is only ever listed under its PRIMARY bucket (the one
 *    where its strength score is highest) per SCOPE's "多桶命中标的归
 *    其强度分最高的桶,只占一席".
 */
export function selectCandidates(symbols: SelectableSymbol[], previousWatchlistSymbols: Set<string>, config: SelectConfig): SelectedCandidate[] {
  const primaryBySymbol = new Map<string, { bucket: string; score: number }>();
  for (const s of symbols) {
    const primary = assignPrimaryBucket(s);
    if (primary) primaryBySymbol.set(s.symbol, primary);
  }

  const candidates: SelectedCandidate[] = [];
  const used = new Set<string>();

  const promotable = symbols
    .filter((s) => previousWatchlistSymbols.has(s.symbol) && primaryBySymbol.has(s.symbol))
    .sort((a, b) => primaryBySymbol.get(b.symbol)!.score - primaryBySymbol.get(a.symbol)!.score);

  for (const s of promotable) {
    if (candidates.length >= config.select.maxCandidates) break;
    const primary = primaryBySymbol.get(s.symbol)!;
    candidates.push({ symbol: s.symbol, primaryBucket: primary.bucket, primaryBucketScore: primary.score, allBucketsHit: s.buckets, promoted: true });
    used.add(s.symbol);
  }

  const byBucket = new Map<string, Array<{ symbol: string; score: number; allBuckets: string[] }>>();
  for (const b of BUCKET_ORDER) byBucket.set(b, []);
  for (const s of symbols) {
    if (used.has(s.symbol)) continue;
    const primary = primaryBySymbol.get(s.symbol);
    if (!primary) continue;
    byBucket.get(primary.bucket)!.push({ symbol: s.symbol, score: primary.score, allBuckets: s.buckets });
  }
  for (const list of byBucket.values()) list.sort((a, b) => b.score - a.score);

  const pointers = new Map(BUCKET_ORDER.map((b) => [b, 0]));
  while (candidates.length < config.select.maxCandidates) {
    let addedThisRound = false;
    for (const b of BUCKET_ORDER) {
      if (candidates.length >= config.select.maxCandidates) break;
      const list = byBucket.get(b)!;
      const ptr = pointers.get(b)!;
      if (ptr < list.length) {
        const item = list[ptr];
        candidates.push({ symbol: item.symbol, primaryBucket: b, primaryBucketScore: item.score, allBucketsHit: item.allBuckets, promoted: false });
        pointers.set(b, ptr + 1);
        used.add(item.symbol);
        addedThisRound = true;
      }
    }
    if (!addedThisRound) break;
  }

  return candidates;
}

export { assignPrimaryBucket };
