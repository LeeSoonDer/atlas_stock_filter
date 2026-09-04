import type { ContagionConfig } from "./types.js";

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Per-sector median of historicalVolatility() across the full scanned universe (same population as computeSectorLeaders' grouping) - the reference point for stage 3's historicalVol fallback path. Sectors with no computable values get no entry (never a fabricated median). */
export function computeSectorMedianHistoricalVol(inputs: { sector: string; historicalVol: number | null }[]): Map<string, number> {
  const bySector = new Map<string, number[]>();
  for (const input of inputs) {
    if (input.historicalVol === null) continue;
    const list = bySector.get(input.sector) ?? [];
    list.push(input.historicalVol);
    bySector.set(input.sector, list);
  }
  const result = new Map<string, number>();
  for (const [sector, values] of bySector) {
    const m = median(values);
    if (m !== null) result.set(sector, m);
  }
  return result;
}

/**
 * TASK_CARD_10 Part B stage 3, full decision including the beta-unavailable
 * fallback (card 熔断: "beta计算若数据不足,降级为用历史波动率替代,不阻塞").
 * Only meaningful for an already-`triggered` contagion candidate under the
 * market-cap threshold - callers should gate on that first (see
 * evaluateContagionCandidate's own beta-only partial check for the
 * caller-independent piece of this same decision).
 */
export function resolveHighBetaSatellite(
  beta60d: number | null,
  historicalVol: number | null,
  sectorMedianHistoricalVol: number | null,
  config: ContagionConfig,
): boolean {
  const c = config.contagion.satellite;
  if (beta60d !== null) return beta60d > c.betaMin;
  if (historicalVol !== null && sectorMedianHistoricalVol !== null) {
    return historicalVol > sectorMedianHistoricalVol * c.volMultipleOfSectorMedian;
  }
  return false;
}
