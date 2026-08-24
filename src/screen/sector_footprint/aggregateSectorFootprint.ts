import { FOOTPRINT_DIMENSIONS } from "./types.js";
import type { DimensionDensity, FootprintConfig, FootprintDimension, SectorFootprint, SymbolFootprintInput } from "./types.js";

function hitForDimension(s: SymbolFootprintInput, dim: FootprintDimension): boolean {
  switch (dim) {
    case "institutionalAccumulation":
      return s.institutionalAccumulationHit;
    case "insiderCluster":
      return s.insiderCluster;
    case "shortInterestDecline":
      return s.shortInterestDeclineHit;
    case "volatilityCompression":
      return s.volatilityCompressionHit;
  }
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * TASK_CARD_03_PATCH SCOPE Part A. For each of the 11 sectors, computes
 * 4 hit-density metrics, then flags 'footprint_anomaly' per SCOPE's own
 * "简单法": a sector's dimension is anomalous when its density >=
 * anomalyMedianMultiplier x the cross-sector median for that dimension
 * (computed only over non-skipped sectors) AND its absolute hit count
 * >= anomalyMinAbsoluteCount. A sector with fewer than
 * minSymbolsForAggregation valid symbols is skipped entirely (熔断
 * fallback: "数据不足时降级为跳过该板块而非硬撑"), not force-aggregated
 * from an unreliable small sample.
 *
 * Deliberately produces only numbers/booleans/dimension-name enums,
 * never a generated sentence - satisfies SCOPE's honesty-boundary
 * requirement by construction, not by a downstream filter.
 */
export function aggregateSectorFootprints(
  symbols: SymbolFootprintInput[],
  sectorList: string[],
  config: FootprintConfig,
): SectorFootprint[] {
  const c = config.footprintAggregation;

  const bySector = new Map<string, SymbolFootprintInput[]>();
  for (const sector of sectorList) bySector.set(sector, []);
  for (const s of symbols) {
    if (s.sector === undefined) continue;
    const arr = bySector.get(s.sector);
    if (arr) arr.push(s);
  }

  const raw = sectorList.map((sector) => {
    const syms = bySector.get(sector)!;
    const validSymbolCount = syms.length;
    const skipped = validSymbolCount < c.minSymbolsForAggregation;
    const densities = {} as Record<FootprintDimension, DimensionDensity>;
    for (const dim of FOOTPRINT_DIMENSIONS) {
      const count = syms.filter((s) => hitForDimension(s, dim)).length;
      densities[dim] = { count, density: skipped ? null : count / validSymbolCount };
    }
    return { sector, validSymbolCount, densities, skipped };
  });

  const medianByDimension = {} as Record<FootprintDimension, number>;
  for (const dim of FOOTPRINT_DIMENSIONS) {
    const vals = raw.filter((r) => !r.skipped).map((r) => r.densities[dim].density as number);
    medianByDimension[dim] = median(vals);
  }

  return raw.map((r): SectorFootprint => {
    if (r.skipped) {
      return {
        ...r,
        footprintAnomaly: false,
        anomalyDimensions: [],
        skipReason: `insufficient valid symbols in sector (${r.validSymbolCount} < ${c.minSymbolsForAggregation})`,
      };
    }
    const anomalyDimensions = FOOTPRINT_DIMENSIONS.filter((dim) => {
      const d = r.densities[dim];
      return (d.density as number) >= medianByDimension[dim] * c.anomalyMedianMultiplier && d.count >= c.anomalyMinAbsoluteCount;
    });
    return { ...r, footprintAnomaly: anomalyDimensions.length > 0, anomalyDimensions, skipReason: null };
  });
}
