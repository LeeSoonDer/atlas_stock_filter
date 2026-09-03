import type { FootprintCondition } from "../IDetector.js";

export interface ContagionConfig {
  contagion: {
    leader: {
      dailyGainMin: number;
      cumulative3dGainMin: number;
      rvolMin: number;
      breakoutLookbackDays: number;
      rvolAvgWindow: number;
    };
    laggard: {
      minLagGapPct: number;
      rvolMin: number;
    };
    satellite: {
      maxMarketCap: number;
      betaLookbackDays: number;
      betaMin: number;
      volMultipleOfSectorMedian: number;
    };
  };
}

/** Which timeframe a leader's qualifying move was measured over - "significantly behind" comparisons for that sector's laggards must use the same basis, or the gap is not a fair reading. */
export type MoveBasis = "daily" | "3d";

/** Stage 1 per-symbol scan input, computed from the same OHLCV bars already fetched for indicators - no new data source. */
export interface LeaderScanInput {
  symbol: string;
  sector: string;
  latestDate: string | null;
  dailyReturn: number | null;
  return3d: number | null;
  rvol: number | null;
  brokeTrailingHigh: boolean | null;
}

export interface SectorLeaderInfo {
  sector: string;
  eventDriven: boolean;
  leaderTicker: string | null;
  leaderMovePct: number | null;
  leaderMoveBasis: MoveBasis | null;
  leaderRvol: number | null;
  sectorEventDate: string | null;
}

/** Stage 2/3 per-symbol input. `smaStructureIntact`/`vitalityPassed` are precomputed upstream (flags.sma50/sma200/latestClose, computeVitality) and passed in rather than recomputed here. */
export interface ContagionCandidateInput {
  symbol: string;
  sector: string;
  dailyReturn: number | null;
  return3d: number | null;
  rvol: number | null;
  smaStructureIntact: boolean | null;
  vitalityPassed: boolean;
  marketCap: number | null;
  beta60d: number | null;
  historicalVol: number | null;
  /** Precomputed once per run via computeSectorMedianHistoricalVol - the reference point for stage 3's beta-unavailable fallback. */
  sectorMedianHistoricalVol: number | null;
}

export interface ContagionEvaluation {
  triggered: boolean;
  /** Simple average of two normalized margins (lag-gap surplus, RVOL surplus), each capped at 3x its threshold - same style as momentumBreakoutDetector's strengthScore. Bucket-internal sort key only, null when not triggered. */
  strengthScore: number | null;
  leaderTicker: string | null;
  leaderMovePct: number | null;
  lagGapPct: number | null;
  sectorEventDate: string | null;
  /** Card Part B stage 3 / 修正案二十: a warning label only, never a reason to drop an already-triggered candidate. */
  highBetaSatellite: boolean;
  evidence: Record<string, unknown>;
  conditions: FootprintCondition[];
}
