import type { DetectorsConfig, IndicatorFlags } from "../indicators/types.js";
import type { ProfileName } from "../types.js";
import type { NearMissDetail } from "./nearMiss.js";

export interface SelectableSymbol {
  symbol: string;
  profile: ProfileName;
  buckets: string[];
  bucketScores: Record<string, number>;
  flags: IndicatorFlags;
}

export interface SelectedCandidate {
  symbol: string;
  primaryBucket: string;
  primaryBucketScore: number;
  allBucketsHit: string[];
  /** True if this ticker was on the PREVIOUS run's watchlist and now fully triggers a bucket - SCOPE 2's "观察哨状态机". */
  promoted: boolean;
}

export interface WatchlistEntry {
  symbol: string;
  reason: "compression_unselected" | "near_miss";
  nearMiss: NearMissDetail | null;
}

export interface SelectionResult {
  candidates: SelectedCandidate[];
  watchlist: WatchlistEntry[];
}

export interface SelectConfig {
  select: {
    maxCandidates: number;
    maxWatchlist: number;
  };
}

export const BUCKET_ORDER = [
  "momentum_breakout",
  "volatility_compression_setup",
  "oversold_reversal",
  "institutional_accumulation_proxy",
] as const;
