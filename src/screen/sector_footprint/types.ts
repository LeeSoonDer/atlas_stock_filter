export type FootprintDimension = "institutionalAccumulation" | "insiderCluster" | "shortInterestDecline" | "volatilityCompression";

export const FOOTPRINT_DIMENSIONS: FootprintDimension[] = [
  "institutionalAccumulation",
  "insiderCluster",
  "shortInterestDecline",
  "volatilityCompression",
];

export interface SymbolFootprintInput {
  sector: string | undefined;
  institutionalAccumulationHit: boolean;
  insiderCluster: boolean;
  shortInterestDeclineHit: boolean;
  volatilityCompressionHit: boolean;
}

export interface DimensionDensity {
  count: number;
  /** null only when the sector was skipped (insufficient symbols) - never a fabricated 0. */
  density: number | null;
}

/**
 * TASK_CARD_03_PATCH SCOPE Part A, 诚实边界硬编码: this type only carries
 * facts (density numbers + which dimension(s) triggered). No field here
 * is allowed to hold generated directional/predictive text - enforced
 * by construction, since aggregateSectorFootprint.ts never produces a
 * free-text string, only these structured values.
 */
export interface SectorFootprint {
  sector: string;
  validSymbolCount: number;
  densities: Record<FootprintDimension, DimensionDensity>;
  footprintAnomaly: boolean;
  anomalyDimensions: FootprintDimension[];
  skipped: boolean;
  skipReason: string | null;
}

export interface FootprintConfig {
  footprintAggregation: {
    anomalyMedianMultiplier: number;
    anomalyMinAbsoluteCount: number;
    minSymbolsForAggregation: number;
  };
}
