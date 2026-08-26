import type { SectorReturns } from "../sector/types.js";
import type { SectorFootprint } from "../sector_footprint/types.js";
import type { SectorFlowConfig, SectorFlowEntry } from "./types.js";

/**
 * TASK_CARD_07 Part A. Ranks all 11 sectors by this week's return and
 * classifies each into flow_in/flow_out/flat per the card's own literal
 * rule: front N ranks with a positive weekly return = flow_in, back N
 * ranks with a negative weekly return = flow_out, everything else flat
 * (config-driven N via SectorFlowConfig, not hardcoded).
 */
export function computeSectorFlowScan(
  sectorReturns: SectorReturns[],
  sectorFootprints: SectorFootprint[],
  candidateSectorCounts: Map<string, number>,
  watchlistSectorCounts: Map<string, number>,
  config: SectorFlowConfig,
): SectorFlowEntry[] {
  const footprintBySector = new Map(sectorFootprints.map((f) => [f.sector, f]));
  const total = sectorReturns.length;

  const ranked = sectorReturns
    .filter((s) => s.oneWeekReturn !== null)
    .slice()
    .sort((a, b) => b.oneWeekReturn! - a.oneWeekReturn!);
  const rankBySector = new Map(ranked.map((s, i) => [s.sector, i + 1]));

  const { flowInRankThreshold, flowOutRankThreshold } = config.sectorFlow;

  return sectorReturns.map((s) => {
    const rank = rankBySector.get(s.sector) ?? null;
    const footprint = footprintBySector.get(s.sector);
    const densityFor = (dim: "volatilityCompression" | "institutionalAccumulation" | "insiderCluster") =>
      footprint && !footprint.skipped ? footprint.densities[dim].density : null;

    let flowState: SectorFlowEntry["flowState"] = "flat";
    if (rank !== null && s.oneWeekReturn !== null) {
      if (rank <= flowInRankThreshold && s.oneWeekReturn > 0) flowState = "flow_in";
      else if (rank > total - flowOutRankThreshold && s.oneWeekReturn < 0) flowState = "flow_out";
    }

    return {
      sector: s.sector,
      etf: s.etf,
      rank,
      weeklyReturn: s.oneWeekReturn,
      squeezeDensity: densityFor("volatilityCompression"),
      institutionalDensity: densityFor("institutionalAccumulation"),
      insiderClusterDensity: densityFor("insiderCluster"),
      flowState,
      candidatesInSector: candidateSectorCounts.get(s.sector) ?? 0,
      watchlistInSector: watchlistSectorCounts.get(s.sector) ?? 0,
    };
  });
}
