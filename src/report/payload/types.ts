import type { FundamentalsSlice } from "../../data/types.js";
import type { PivotPoint } from "../../screen/indicators/pivotPoints.js";
import type { IndicatorFlags } from "../../screen/indicators/types.js";
import type { EventWindowEntry } from "../../screen/event_window/types.js";
import type { SectorRanking } from "../../screen/sector/types.js";
import type { SectorFootprint } from "../../screen/sector_footprint/types.js";
import type { MarketRegimeSnapshot } from "../../screen/regime/types.js";
import type { ProfileName } from "../../screen/types.js";

export interface PayloadCandidateInput {
  symbol: string;
  securityName: string;
  profile: ProfileName;
  speculative: boolean;
  primaryBucket: string;
  primaryBucketScore: number;
  allBucketsHit: string[];
  promoted: boolean;
  flags: IndicatorFlags;
  fundamentals: FundamentalsSlice | undefined;
  eventWindow: EventWindowEntry[] | undefined;
  sectorRank: SectorRanking | undefined;
  pivotHigh: PivotPoint | null;
  pivotLow: PivotPoint | null;
}

export interface PayloadInput {
  runMeta: {
    timestamp: string;
    profileArg: string;
    gatesPassedCount: number;
  };
  marketRegime: MarketRegimeSnapshot;
  sectorFootprints: SectorFootprint[];
  candidates: PayloadCandidateInput[];
}
