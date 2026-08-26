export type FlowState = "flow_in" | "flow_out" | "flat";

/**
 * TASK_CARD_07 Part A. One entry per SPDR sector (11 total), ranked by
 * this week's return (independent of sectorStrength.ts's 1mo/3mo
 * composite rank, which stays as-is for candidate-level tailwind/headwind
 * tagging). `weeklyReturn`/density fields are fractions (e.g. 0.023 =
 * +2.3%), matching the existing SectorReturns/SectorFootprint convention
 * - rendering layers multiply by 100 for display, this module doesn't.
 */
export interface SectorFlowEntry {
  sector: string;
  etf: string;
  /** 1 = highest weekly return this run, 11 = lowest. Null only if this sector's weekly return itself is null (no computable OHLCV window) - never expected in practice for a liquid SPDR ETF, but not assumed away. */
  rank: number | null;
  weeklyReturn: number | null;
  squeezeDensity: number | null;
  institutionalDensity: number | null;
  insiderClusterDensity: number | null;
  flowState: FlowState;
  candidatesInSector: number;
  watchlistInSector: number;
}

export interface SectorFlowConfig {
  sectorFlow: {
    /** A sector ranks flow_in only if its rank is <= this AND its weekly return is positive. */
    flowInRankThreshold: number;
    /** A sector ranks flow_out only if its rank is > (11 - this) AND its weekly return is negative. */
    flowOutRankThreshold: number;
  };
}

export type HotSectorKind = "sector" | "basket";

export interface HotSectorDefinition {
  name: string;
  kind: HotSectorKind;
  /** Required when kind === "sector" - must match a SECTOR_TO_ETF key exactly. */
  sector?: string;
  /** Required when kind === "basket" - a hand-curated, unverified approximation (see config/hot_sectors.json's own comment). */
  tickers?: string[];
}

export interface HotSectorsConfig {
  hotSectors: HotSectorDefinition[];
}

/**
 * `origin: "named"` = explicitly configured in config/hot_sectors.json.
 * `origin: "anomaly_detected"` = a real SPDR sector not in that config but
 * flagged footprintAnomaly this run - the card's "以及本周任何实际出现异动的板块" clause.
 */
export type HotSectorOrigin = "named" | "anomaly_detected";

export interface HotSectorEntry {
  name: string;
  kind: HotSectorKind;
  origin: HotSectorOrigin;
  /** Only set for kind === "sector" - the matching full 11-sector entry, reused directly rather than recomputed. */
  sectorFlowRef: SectorFlowEntry | null;
  /** Only set for kind === "basket" - discloses real coverage against this run's actual gate-passed universe, since the basket is an unverified approximation, not an official classification. */
  basketCoverage: { found: number; total: number } | null;
  weeklyReturn: number | null;
  squeezeDensity: number | null;
  flowState: FlowState | "unknown";
  candidatesInPool: string[];
  watchlistInPool: string[];
}
