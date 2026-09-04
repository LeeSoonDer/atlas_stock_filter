import type { FundamentalsSlice } from "../../data/types.js";
import type { PivotPoint } from "../../screen/indicators/pivotPoints.js";
import type { IndicatorFlags } from "../../screen/indicators/types.js";
import type { EventWindowEntry } from "../../screen/event_window/types.js";
import type { SectorRanking } from "../../screen/sector/types.js";
import type { SectorFootprint } from "../../screen/sector_footprint/types.js";
import type { MarketRegimeSnapshot } from "../../screen/regime/types.js";
import type { ProfileName } from "../../screen/types.js";
import type { HotSectorEntry, SectorFlowEntry } from "../../screen/sector_scan/types.js";
import type { CreditRegimeSnapshot, RiskLevel } from "../../screen/credit_regime/types.js";
import type { OptionsIntelligence } from "../../data/options/types.js";

export interface PayloadCandidateInput {
  symbol: string;
  securityName: string;
  profile: ProfileName;
  speculative: boolean;
  /** TASK_CARD_08 Part A: baseline from `speculative`, bumped one level when this run's credit regime is tight. */
  riskLevel: RiskLevel;
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
  /** TASK_CARD_09 Part B: aggregate-only intelligence, never a selection/detector input - see src/data/options/types.ts's own doc comment for the isolation guarantee. */
  optionsIntelligence: OptionsIntelligence;
  /** TASK_CARD_10 Part B/D / 修正案二十二: present only when this candidate triggered the sector_contagion bucket - "传导逻辑是否成立...由研究层判定,应用层不作判断" (Radar consumes these fields verbatim, never interpreted here). */
  contagion?: {
    leaderTicker: string;
    leaderMovePct: number;
    lagGapPct: number;
    sectorEventDate: string;
    highBetaSatellite: boolean;
  };
}

export interface PayloadInput {
  runMeta: {
    timestamp: string;
    profileArg: string;
    gatesPassedCount: number;
    /** TASK_CARD_10 Part A/D: gate-passed symbols excluded from candidates/watchlist by the vitality floor - see ai/decisions.md for the accepted "宁可错过埋伏,不要死股" tradeoff this counts against. */
    vitalityExcludedCount: number;
    /** TASK_CARD_10 Part B/D: every sector this run marked event_driven (a stage-1 leader was found), for Radar's contagion-narrative verification. */
    eventDrivenSectors: Array<{ sector: string; leaderTicker: string; leaderMovePct: number; sectorEventDate: string }>;
  };
  marketRegime: MarketRegimeSnapshot;
  /** TASK_CARD_08 Part A. */
  creditRegime: CreditRegimeSnapshot;
  smallSpecForcedDisabled: boolean;
  sectorFootprints: SectorFootprint[];
  /** TASK_CARD_07 Part A: all 11 SPDR sectors, ranked by this week's return. */
  sectorFlowScan: SectorFlowEntry[];
  /** TASK_CARD_07 Part A: named hot sectors (config/hot_sectors.json) + any real sector flagged footprintAnomaly this run but not already named. */
  hotSectorDetail: HotSectorEntry[];
  candidates: PayloadCandidateInput[];
}
