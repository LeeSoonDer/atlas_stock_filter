import type { SectorConfig, SectorRanking, SectorReturns, TailwindHeadwind } from "./types.js";

/**
 * Ranks sectors by 1-month AND 3-month returns (TASK_CARD_03 SCOPE 2
 * asks for a single "当前排名" per sector from both windows). Formula
 * (documented per this project's convention for composite scores):
 * rank each window separately (best return = rank 1), then average the
 * two rank positions into one composite score, then re-rank by that
 * average - a simple equal-weighted blend of near-term and medium-term
 * momentum, not a magnitude-weighted average of the returns themselves.
 */
export function rankSectors(returns: SectorReturns[], config: SectorConfig): SectorRanking[] {
  const c = config.sector;
  const complete = returns.filter((r) => r.oneMonthReturn !== null && r.threeMonthReturn !== null);
  const incomplete = returns.filter((r) => r.oneMonthReturn === null || r.threeMonthReturn === null);

  const oneMonthRanked = [...complete].sort((a, b) => b.oneMonthReturn! - a.oneMonthReturn!);
  const threeMonthRanked = [...complete].sort((a, b) => b.threeMonthReturn! - a.threeMonthReturn!);
  const oneMonthRankBySector = new Map(oneMonthRanked.map((r, i) => [r.sector, i + 1]));
  const threeMonthRankBySector = new Map(threeMonthRanked.map((r, i) => [r.sector, i + 1]));

  const withCompositeScore = complete.map((r) => ({
    r,
    compositeScore: (oneMonthRankBySector.get(r.sector)! + threeMonthRankBySector.get(r.sector)!) / 2,
  }));
  withCompositeScore.sort((a, b) => a.compositeScore - b.compositeScore);

  const n = withCompositeScore.length;
  const ranked: SectorRanking[] = withCompositeScore.map(({ r }, i) => {
    const compositeRank = i + 1;
    let classification: TailwindHeadwind = "neutral";
    if (compositeRank <= c.tailwindRankCount) classification = "tailwind";
    else if (compositeRank > n - c.headwindRankCount) classification = "headwind";
    return { ...r, compositeRank, classification };
  });

  const unranked: SectorRanking[] = incomplete.map((r) => ({ ...r, compositeRank: null, classification: null }));

  return [...ranked, ...unranked];
}
