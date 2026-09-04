import type { DetectorsConfig } from "../indicators/types.js";
import {
  checkNearMissInstitutionalAccumulation,
  checkNearMissMomentumBreakout,
  checkNearMissOversoldReversal,
  checkNearMissVolatilityCompression,
} from "./nearMiss.js";
import type { NearMissDetail } from "./nearMiss.js";
import { assignPrimaryBucket } from "./selectCandidates.js";
import type { SelectableSymbol, SelectConfig, WatchlistEntry } from "./types.js";

/**
 * TASK_CARD_05 SCOPE 2, extended by TASK_CARD_10 Part C. Three passes,
 * in priority order:
 *
 * 1. "传导桶的次优标的优先进观察哨" (修正案二十二): every symbol whose
 *    PRIMARY bucket is sector_contagion but didn't get one of the
 *    reserved candidate seats (selectCandidates' own budget cap, not
 *    reproduced here), sorted by score (highest first) - added ahead of
 *    compression_unselected per the card's own priority statement.
 * 2. "挤压蓄势桶未入选者优先": every symbol whose PRIMARY bucket is
 *    volatility_compression_setup but wasn't selected as a candidate,
 *    sorted by score (highest first).
 * 3. "其余桶临界未达标者(<=10%)补足": remaining slots filled by
 *    near-miss symbols (see nearMiss.ts), sorted by how close they are
 *    (smallest percentAway first) - institutional accumulation's
 *    near-miss (percentAway=0, not a percentage metric) sorts after any
 *    genuinely-percentage-graded near miss.
 */
export function selectWatchlist(
  symbols: SelectableSymbol[],
  candidateSymbols: Set<string>,
  detectorsConfig: DetectorsConfig,
  config: SelectConfig,
): WatchlistEntry[] {
  const watchlist: WatchlistEntry[] = [];
  const used = new Set<string>();

  const contagionUnselected = symbols
    .filter((s) => !candidateSymbols.has(s.symbol) && s.buckets.includes("sector_contagion") && assignPrimaryBucket(s)?.bucket === "sector_contagion")
    .map((s) => ({ symbol: s.symbol, score: s.bucketScores["sector_contagion"] ?? 0 }))
    .sort((a, b) => b.score - a.score);

  for (const s of contagionUnselected) {
    if (watchlist.length >= config.select.maxWatchlist) break;
    watchlist.push({ symbol: s.symbol, reason: "contagion_unselected", nearMiss: null });
    used.add(s.symbol);
  }

  const compressionUnselected = symbols
    .filter((s) => !candidateSymbols.has(s.symbol) && s.buckets.includes("volatility_compression_setup"))
    .map((s) => ({ symbol: s.symbol, score: s.bucketScores["volatility_compression_setup"] ?? 0 }))
    .sort((a, b) => b.score - a.score);

  for (const s of compressionUnselected) {
    if (watchlist.length >= config.select.maxWatchlist) break;
    watchlist.push({ symbol: s.symbol, reason: "compression_unselected", nearMiss: null });
    used.add(s.symbol);
  }

  const nearMisses = symbols
    .filter((s) => !candidateSymbols.has(s.symbol) && !used.has(s.symbol) && assignPrimaryBucket(s) === null)
    .map((s) => {
      const nearMiss =
        checkNearMissMomentumBreakout(s.flags, detectorsConfig) ??
        checkNearMissVolatilityCompression(s.flags, detectorsConfig) ??
        checkNearMissOversoldReversal(s.flags, s.profile, detectorsConfig) ??
        checkNearMissInstitutionalAccumulation(s.flags, detectorsConfig);
      return nearMiss ? { symbol: s.symbol, nearMiss } : null;
    })
    .filter((x): x is { symbol: string; nearMiss: NearMissDetail } => x !== null)
    .sort((a, b) => a.nearMiss.percentAway - b.nearMiss.percentAway);

  for (const s of nearMisses) {
    if (watchlist.length >= config.select.maxWatchlist) break;
    watchlist.push({ symbol: s.symbol, reason: "near_miss", nearMiss: s.nearMiss });
  }

  return watchlist;
}
