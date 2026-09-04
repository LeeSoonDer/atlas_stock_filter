import type { ContagionConfig, LeaderScanInput, SectorLeaderInfo, MoveBasis } from "./types.js";

/**
 * TASK_CARD_10 Part B stage 1 (板块级龙头异动识别). Cross-symbol by
 * construction - this is why contagion can't be an IDetector (that
 * interface is single-symbol only, see IDetector.ts). Groups the whole
 * scanned universe by `sector` and, within each sector, looks for any
 * symbol whose move satisfies ALL of: (daily gain OR 3-day cumulative
 * gain) past its threshold, RVOL past its threshold, AND a trailing-high
 * breakout. A sector with zero qualifying symbols is not event_driven -
 * no leader is fabricated to fill the slot.
 *
 * When multiple symbols in one sector qualify, the one with the larger
 * qualifying move (comparing daily-vs-daily and 3d-vs-3d by their own
 * basis, using whichever produced the larger of the two per symbol) is
 * reported as THE leader - report/payload only need one ticker per
 * sector, per the card's own output-field list (`leader_ticker`,
 * singular).
 */
export function computeSectorLeaders(inputs: LeaderScanInput[], config: ContagionConfig): Map<string, SectorLeaderInfo> {
  const c = config.contagion.leader;
  const bySector = new Map<string, LeaderScanInput[]>();
  for (const input of inputs) {
    const list = bySector.get(input.sector) ?? [];
    list.push(input);
    bySector.set(input.sector, list);
  }

  const result = new Map<string, SectorLeaderInfo>();
  for (const [sector, symbols] of bySector) {
    let best: { symbol: LeaderScanInput; movePct: number; basis: MoveBasis } | null = null;

    for (const s of symbols) {
      if (s.rvol === null || s.rvol < c.rvolMin) continue;
      if (s.brokeTrailingHigh !== true) continue;

      const dailyQualifies = s.dailyReturn !== null && s.dailyReturn >= c.dailyGainMin;
      const cumulativeQualifies = s.return3d !== null && s.return3d >= c.cumulative3dGainMin;
      if (!dailyQualifies && !cumulativeQualifies) continue;

      // Report whichever qualifying basis had the larger move for this symbol.
      const candidateMove: { movePct: number; basis: MoveBasis } =
        cumulativeQualifies && (!dailyQualifies || s.return3d! >= s.dailyReturn!)
          ? { movePct: s.return3d!, basis: "3d" }
          : { movePct: s.dailyReturn!, basis: "daily" };

      if (best === null || candidateMove.movePct > best.movePct) {
        best = { symbol: s, movePct: candidateMove.movePct, basis: candidateMove.basis };
      }
    }

    result.set(sector, {
      sector,
      eventDriven: best !== null,
      leaderTicker: best?.symbol.symbol ?? null,
      leaderMovePct: best?.movePct ?? null,
      leaderMoveBasis: best?.basis ?? null,
      leaderRvol: best?.symbol.rvol ?? null,
      sectorEventDate: best?.symbol.latestDate ?? null,
    });
  }
  return result;
}
