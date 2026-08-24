import type { InstitutionalSnapshot } from "../../data/checkpoint.js";

export type InstitutionalTrend = "up" | "down" | "flat";

export interface InstitutionalTrendConfig {
  institutionalTrend: {
    minDaysBetweenSnapshots: number;
    flatBandPercent: number;
  };
}

export type { InstitutionalSnapshot };
