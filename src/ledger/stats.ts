import { BUCKET_ORDER } from "../screen/select/types.js";
import type { OutcomeUpdateLedgerEntry, ScreeningLedgerEntry } from "./types.js";

/** The 4 original buckets plus 修正案二十二's fifth, sector_contagion.
 * BUCKET_ORDER itself stays 4 long because selectCandidates round-robins
 * over it after contagion's reserved seats; the stats must still count a
 * contagion candidate, or up to half of all seats go unmeasured. */
export const STATS_BUCKETS = [...BUCKET_ORDER, "sector_contagion"] as const;

export interface BucketStats {
  bucket: string;
  totalCandidates: number;
  resolvedCount: number;
  pendingCount: number;
  /** % of resolved candidates where repriced === true. Null if resolvedCount === 0 (never fabricated as 0). */
  hitRate: number | null;
  /** % of resolved candidates where invalidationTriggered === true. */
  deathRate: number | null;
}

/**
 * TASK_CARD_05 SCOPE 6 `ledger:stats`: hit/death rate per detector
 * bucket, for month-end review ("月度复盘"). Grouped by
 * `opportunityType` (only ever set on candidate entries - a watchlist
 * entry with no full trigger has opportunityType===null and is
 * excluded, since it never became a thesis to measure). Always
 * includes every known bucket (STATS_BUCKETS), even with zero data
 * (0/0, rates null) - DONE-WHEN requires "四桶汇总" (a 4-bucket
 * summary, five since 修正案二十二), not just whichever buckets happen
 * to have entries yet.
 */
export function computeLedgerStats(
  screenings: ScreeningLedgerEntry[],
  outcomes: OutcomeUpdateLedgerEntry[],
): BucketStats[] {
  const byBucket = new Map<string, ScreeningLedgerEntry[]>();
  for (const bucket of STATS_BUCKETS) byBucket.set(bucket, []);

  for (const s of screenings) {
    if (s.opportunityType === null) continue;
    const arr = byBucket.get(s.opportunityType);
    if (arr) arr.push(s);
  }

  return STATS_BUCKETS.map((bucket): BucketStats => {
    const entries = byBucket.get(bucket) ?? [];
    const resolved = entries
      .map((s) => outcomes.filter((o) => o.symbol === s.symbol && o.refersToScreeningTimestamp === s.screeningTimestamp))
      .map((matches) => (matches.length > 0 ? matches.reduce((a, b) => (a.backfilledAt > b.backfilledAt ? a : b)) : null))
      .filter((o): o is OutcomeUpdateLedgerEntry => o !== null);

    const hitCount = resolved.filter((o) => o.outcome.repriced).length;
    const deathCount = resolved.filter((o) => o.outcome.invalidationTriggered).length;

    return {
      bucket,
      totalCandidates: entries.length,
      resolvedCount: resolved.length,
      pendingCount: entries.length - resolved.length,
      hitRate: resolved.length > 0 ? (hitCount / resolved.length) * 100 : null,
      deathRate: resolved.length > 0 ? (deathCount / resolved.length) * 100 : null,
    };
  });
}
