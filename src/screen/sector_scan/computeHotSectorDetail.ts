import type { SectorFootprint } from "../sector_footprint/types.js";
import type { HotSectorEntry, HotSectorsConfig, SectorFlowEntry } from "./types.js";

export interface CandidateSectorInfo {
  symbol: string;
  sector: string | undefined;
}

export interface BasketTickerStat {
  weeklyReturn: number | null;
  volatilityCompressionHit: boolean;
}

/**
 * TASK_CARD_07 Part A. Produces one HotSectorEntry per config/hot_sectors.json
 * definition (kind "sector" reuses the matching SectorFlowEntry directly;
 * kind "basket" aggregates whatever of its configured tickers were found
 * in this run's gate-passed universe - see basketCoverage for the honest
 * disclosure of how much of the basket that actually was), plus one entry
 * per real SPDR sector that isn't already named but was flagged
 * footprintAnomaly this run (the card's "以及本周任何实际出现异动的板块" clause).
 */
export function computeHotSectorDetail(
  sectorFlowScan: SectorFlowEntry[],
  sectorFootprints: SectorFootprint[],
  hotSectorsConfig: HotSectorsConfig,
  basketTickerStats: Map<string, BasketTickerStat>,
  candidates: CandidateSectorInfo[],
  watchlist: CandidateSectorInfo[],
): HotSectorEntry[] {
  const flowBySector = new Map(sectorFlowScan.map((f) => [f.sector, f]));
  const namedSectors = new Set(hotSectorsConfig.hotSectors.filter((d) => d.kind === "sector").map((d) => d.sector));

  const named: HotSectorEntry[] = hotSectorsConfig.hotSectors.map((def) => {
    if (def.kind === "sector") {
      const ref = flowBySector.get(def.sector!) ?? null;
      const inSector = (list: CandidateSectorInfo[]) => list.filter((c) => c.sector === def.sector).map((c) => c.symbol);
      return {
        name: def.name,
        kind: "sector",
        origin: "named",
        sectorFlowRef: ref,
        basketCoverage: null,
        weeklyReturn: ref?.weeklyReturn ?? null,
        squeezeDensity: ref?.squeezeDensity ?? null,
        flowState: ref?.flowState ?? "flat",
        candidatesInPool: inSector(candidates),
        watchlistInPool: inSector(watchlist),
      };
    }

    // kind === "basket"
    const tickers = def.tickers ?? [];
    const found = tickers.filter((t) => basketTickerStats.has(t));
    const returns = found.map((t) => basketTickerStats.get(t)!.weeklyReturn).filter((r): r is number => r !== null);
    const weeklyReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : null;
    const squeezeHits = found.filter((t) => basketTickerStats.get(t)!.volatilityCompressionHit).length;
    const squeezeDensity = found.length > 0 ? squeezeHits / found.length : null;
    const flowState: HotSectorEntry["flowState"] = weeklyReturn === null ? "unknown" : weeklyReturn > 0 ? "flow_in" : weeklyReturn < 0 ? "flow_out" : "flat";
    const inBasket = (list: CandidateSectorInfo[]) => list.filter((c) => tickers.includes(c.symbol)).map((c) => c.symbol);

    return {
      name: def.name,
      kind: "basket",
      origin: "named",
      sectorFlowRef: null,
      basketCoverage: { found: found.length, total: tickers.length },
      weeklyReturn,
      squeezeDensity,
      flowState,
      candidatesInPool: inBasket(candidates),
      watchlistInPool: inBasket(watchlist),
    };
  });

  const anomalyDetected: HotSectorEntry[] = sectorFootprints
    .filter((f) => f.footprintAnomaly && !namedSectors.has(f.sector))
    .map((f) => {
      const ref = flowBySector.get(f.sector) ?? null;
      const inSector = (list: CandidateSectorInfo[]) => list.filter((c) => c.sector === f.sector).map((c) => c.symbol);
      return {
        name: f.sector,
        kind: "sector" as const,
        origin: "anomaly_detected" as const,
        sectorFlowRef: ref,
        basketCoverage: null,
        weeklyReturn: ref?.weeklyReturn ?? null,
        squeezeDensity: ref?.squeezeDensity ?? null,
        flowState: ref?.flowState ?? "flat",
        candidatesInPool: inSector(candidates),
        watchlistInPool: inSector(watchlist),
      };
    });

  return [...named, ...anomalyDetected];
}
