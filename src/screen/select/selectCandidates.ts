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

const CONTAGION_BUCKET_ID = "sector_contagion";

/**
 * TASK_CARD_05 SCOPE 2, extended by TASK_CARD_10 Part C / 修正案二十二
 * ("板块传导桶在候选选取中占据至少一半席位"). Three passes:
 *
 * 1. Promotion priority: any symbol that was on the PREVIOUS run's
 *    watchlist and now fully triggers a bucket gets a candidate seat
 *    FIRST (sorted by its new primary-bucket score, highest first),
 *    per "观察哨状态机...标记promoted,优先进候选" - this is a priority
 *    jump, not just an incidental promoted flag on whatever the normal
 *    round-robin would have picked anyway. Applies to any bucket,
 *    sector_contagion included.
 *
 * 2. Sector-contagion reservation: up to `ceil(maxCandidates / 2)` of
 *    the seats remaining after promotion go to sector_contagion primary-
 *    bucket symbols (highest score first) - "at least half" from the
 *    amendment, capped here so the original four buckets always keep a
 *    real shot at the rest (the amendment's own card text describes
 *    this same reservation against a 5-seat baseline; computed as a
 *    fraction of the CURRENT maxCandidates rather than hardcoded, since
 *    TASK_CARD_07 already changed that number once - see
 *    ai/decisions.md). A sector with zero contagion hits simply
 *    contributes nothing here, leaving every seat to the round robin.
 *
 * 3. Round robin over remaining seats: cycles bucket order A->B->C->D->
 *    A... (BUCKET_ORDER), popping the top (highest within-bucket-score)
 *    unused symbol from each bucket in turn, until maxCandidates is
 *    filled or every bucket is exhausted. A symbol that hit multiple
 *    buckets is only ever listed under its PRIMARY bucket (the one
 *    where its strength score is highest) per SCOPE's "多桶命中标的归
 *    其强度分最高的桶,只占一席" - a symbol whose primary bucket is
 *    sector_contagion is handled entirely in pass 2 and never enters
 *    this round robin, win or lose its reserved seat.
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

  const contagionSeatsMax = Math.ceil(config.select.maxCandidates / 2);
  const contagionAlreadySeated = candidates.filter((c) => c.primaryBucket === CONTAGION_BUCKET_ID).length;
  const contagionSeatsBudget = Math.max(0, contagionSeatsMax - contagionAlreadySeated);

  const contagionPool = symbols
    .filter((s) => !used.has(s.symbol) && primaryBySymbol.get(s.symbol)?.bucket === CONTAGION_BUCKET_ID)
    .sort((a, b) => primaryBySymbol.get(b.symbol)!.score - primaryBySymbol.get(a.symbol)!.score);

  for (const s of contagionPool.slice(0, contagionSeatsBudget)) {
    if (candidates.length >= config.select.maxCandidates) break;
    const primary = primaryBySymbol.get(s.symbol)!;
    candidates.push({ symbol: s.symbol, primaryBucket: primary.bucket, primaryBucketScore: primary.score, allBucketsHit: s.buckets, promoted: false });
    used.add(s.symbol);
  }

  const byBucket = new Map<string, Array<{ symbol: string; score: number; allBuckets: string[] }>>();
  for (const b of BUCKET_ORDER) byBucket.set(b, []);
  for (const s of symbols) {
    if (used.has(s.symbol)) continue;
    const primary = primaryBySymbol.get(s.symbol);
    if (!primary || primary.bucket === CONTAGION_BUCKET_ID) continue;
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
