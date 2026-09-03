import type { FootprintCondition } from "../IDetector.js";
import type { ContagionCandidateInput, ContagionConfig, ContagionEvaluation, SectorLeaderInfo, MoveBasis } from "./types.js";
import { resolveHighBetaSatellite } from "./sectorVolatility.js";

const DETECTOR_ID = "sector_contagion";

function ownMoveForBasis(input: ContagionCandidateInput, basis: MoveBasis): number | null {
  return basis === "daily" ? input.dailyReturn : input.return3d;
}

/**
 * TASK_CARD_10 Part B stages 2-3, per symbol. Only meaningful when the
 * symbol's own sector is `eventDriven` (a stage-1 leader was found) -
 * callers should only invoke this for symbols in such sectors, but a
 * non-event-driven or missing leader is handled defensively here too
 * (never triggers, conditions marked unavailable) rather than assumed
 * away by the caller.
 *
 * `highBetaSatellite` is evidence/warning only (修正案二十 筛选宽容度原则,
 * card MUST-NOT "不得因此排除") - it never gates `triggered`, which is
 * decided purely by the laggard conditions in stage 2.
 */
export function evaluateContagionCandidate(
  input: ContagionCandidateInput,
  leader: SectorLeaderInfo | undefined,
  config: ContagionConfig,
): ContagionEvaluation {
  const c = config.contagion;

  if (!leader || !leader.eventDriven || leader.leaderTicker === null || leader.leaderMoveBasis === null) {
    return {
      triggered: false,
      strengthScore: null,
      leaderTicker: null,
      leaderMovePct: null,
      lagGapPct: null,
      sectorEventDate: null,
      highBetaSatellite: false,
      evidence: { reason: "sector_not_event_driven" },
      conditions: [
        { bucket: DETECTOR_ID, label: "所属板块是否事件驱动(存在龙头异动)", field: "eventDriven", actual: "false", threshold: "true", status: "miss", availability: "可得" },
      ],
    };
  }

  const ownMove = ownMoveForBasis(input, leader.leaderMoveBasis);
  const basisLabel = leader.leaderMoveBasis === "daily" ? "当日涨幅" : "近3日累计涨幅";

  if (ownMove === null || input.rvol === null || input.smaStructureIntact === null) {
    return {
      triggered: false,
      strengthScore: null,
      leaderTicker: leader.leaderTicker,
      leaderMovePct: leader.leaderMovePct,
      lagGapPct: null,
      sectorEventDate: leader.sectorEventDate,
      highBetaSatellite: false,
      evidence: { reason: "insufficient_data", leaderMoveBasis: leader.leaderMoveBasis },
      conditions: [
        { bucket: DETECTOR_ID, label: `落后龙头的${basisLabel}差距`, field: "lagGapPct", actual: null, threshold: `≥ ${(c.laggard.minLagGapPct * 100).toFixed(0)}%`, status: "unavailable", availability: "不可得" },
        { bucket: DETECTOR_ID, label: "成交量温和放大(RVOL)", field: "rvol", actual: null, threshold: `≥ ${c.laggard.rvolMin}x`, status: "unavailable", availability: "不可得" },
        { bucket: DETECTOR_ID, label: "技术结构未破坏(价格≥SMA50或≥SMA200)", field: "smaStructureIntact", actual: null, threshold: "true", status: "unavailable", availability: "不可得" },
        { bucket: DETECTOR_ID, label: "通过活跃度地板", field: "vitalityPassed", actual: String(input.vitalityPassed), threshold: "true", status: input.vitalityPassed ? "hit" : "miss", availability: "可得" },
      ],
    };
  }

  const lagGapPct = leader.leaderMovePct! - ownMove;
  const laggedEnough = lagGapPct >= c.laggard.minLagGapPct;
  const rvolOk = input.rvol >= c.laggard.rvolMin;
  const structureOk = input.smaStructureIntact === true;
  const vitalityOk = input.vitalityPassed === true;

  const conditions: FootprintCondition[] = [
    {
      bucket: DETECTOR_ID, label: `落后龙头的${basisLabel}差距`, field: "lagGapPct",
      actual: `${(lagGapPct * 100).toFixed(1)}%`, threshold: `≥ ${(c.laggard.minLagGapPct * 100).toFixed(0)}%`,
      status: laggedEnough ? "hit" : "miss", availability: "可得",
    },
    {
      bucket: DETECTOR_ID, label: "成交量温和放大(RVOL)", field: "rvol",
      actual: `${input.rvol.toFixed(2)}x`, threshold: `≥ ${c.laggard.rvolMin}x`,
      status: rvolOk ? "hit" : "miss", availability: "可得",
    },
    {
      bucket: DETECTOR_ID, label: "技术结构未破坏(价格≥SMA50或≥SMA200)", field: "smaStructureIntact",
      actual: String(structureOk), threshold: "true",
      status: structureOk ? "hit" : "miss", availability: "可得",
    },
    {
      bucket: DETECTOR_ID, label: "通过活跃度地板", field: "vitalityPassed",
      actual: String(vitalityOk), threshold: "true",
      status: vitalityOk ? "hit" : "miss", availability: "可得",
    },
  ];

  const triggered = laggedEnough && rvolOk && structureOk && vitalityOk;

  // Stage 3: warning-only, only meaningful for an actual candidate (a
  // non-triggered symbol has no "satellite" status to warn about).
  const highBetaSatellite =
    triggered && input.marketCap !== null && input.marketCap < c.satellite.maxMarketCap
      ? resolveHighBetaSatellite(input.beta60d, input.historicalVol, input.sectorMedianHistoricalVol, config)
      : false;

  // Bucket-internal sort key only (same style as momentumBreakoutDetector):
  // average of two normalized margins, each capped at 3x its threshold.
  const strengthScore = triggered
    ? ((Math.min(lagGapPct / c.laggard.minLagGapPct, 3) / 3 + Math.min(input.rvol / c.laggard.rvolMin, 3) / 3) / 2) * 100
    : null;

  return {
    triggered,
    strengthScore,
    leaderTicker: leader.leaderTicker,
    leaderMovePct: leader.leaderMovePct,
    lagGapPct,
    sectorEventDate: leader.sectorEventDate,
    highBetaSatellite,
    evidence: { ownMove, leaderMoveBasis: leader.leaderMoveBasis, marketCap: input.marketCap, beta60d: input.beta60d, historicalVol: input.historicalVol },
    conditions,
  };
}
