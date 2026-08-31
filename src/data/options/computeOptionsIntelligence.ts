import type { OptionsConfig, OptionsHistorySnapshot, OptionsIntelligence, RawOptionContract, RawOptionsChain } from "./types.js";

function closestByStrike(contracts: RawOptionContract[], price: number): RawOptionContract | null {
  let best: RawOptionContract | null = null;
  let bestDiff = Infinity;
  for (const c of contracts) {
    const diff = Math.abs(c.strike - price);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = c;
    }
  }
  return best;
}

function emptyIntelligence(): OptionsIntelligence {
  return {
    volumeOiRatioMax: null,
    volumeOiRatioAnomaly: null,
    nearOtmCallOi: null,
    nearOtmCallOiChange: null,
    putCallRatio: null,
    putCallRatioChange: null,
    atmImpliedVol: null,
    ivMove: null,
    availability: "不可得",
  };
}

/**
 * TASK_CARD_09 Part B. Pure function - no fetching, no persistence side
 * effects (the caller in pipeline.ts owns reading/writing
 * checkpoint.optionsHistory). `priorSnapshots` must already be this
 * symbol's history BEFORE this run (most recent last) - the returned
 * `snapshot` is what the caller should append for next run's comparison.
 *
 * 硬性边界: this function computes AGGREGATE statistics only - it never
 * inspects or returns per-contract counterparty/direction data (none
 * exists in the source data to begin with), and its output is never fed
 * into any selection/detector code path (structurally guaranteed by
 * pipeline.ts calling this only after selection is already finalized -
 * see fetchOptionsChain.ts's own doc comment).
 */
export function computeOptionsIntelligence(
  chain: RawOptionsChain | null,
  priorSnapshots: OptionsHistorySnapshot[],
  config: OptionsConfig,
): { intelligence: OptionsIntelligence; snapshot: OptionsHistorySnapshot } {
  const c = config.options;
  const asOf = new Date().toISOString();

  if (!chain || chain.underlyingPrice === null) {
    return { intelligence: emptyIntelligence(), snapshot: { asOf, atmImpliedVol: null, nearOtmCallOi: null, putCallRatio: null } };
  }

  const allContracts = [...chain.calls, ...chain.puts];
  let volumeOiRatioMax: number | null = null;
  for (const contract of allContracts) {
    if (contract.volume === null || contract.openInterest === null || contract.openInterest === 0) continue;
    const ratio = contract.volume / contract.openInterest;
    if (volumeOiRatioMax === null || ratio > volumeOiRatioMax) volumeOiRatioMax = ratio;
  }
  const volumeOiRatioAnomaly = volumeOiRatioMax === null ? null : volumeOiRatioMax > c.volumeOiRatioAnomalyThreshold;

  const price = chain.underlyingPrice;
  const lowerBound = price * (1 + c.nearOtmCallMinPct);
  const upperBound = price * (1 + c.nearOtmCallMaxPct);
  const otmCalls = chain.calls.filter((call) => call.strike >= lowerBound && call.strike <= upperBound);
  const nearOtmCallOi = otmCalls.length === 0 ? null : otmCalls.reduce((sum, call) => sum + (call.openInterest ?? 0), 0);

  const totalCallVolume = chain.calls.reduce((sum, call) => sum + (call.volume ?? 0), 0);
  const totalPutVolume = chain.puts.reduce((sum, put) => sum + (put.volume ?? 0), 0);
  const putCallRatio = totalCallVolume === 0 ? null : totalPutVolume / totalCallVolume;

  const closestCall = closestByStrike(chain.calls, price);
  const closestPut = closestByStrike(chain.puts, price);
  const ivs = [closestCall?.impliedVolatility, closestPut?.impliedVolatility].filter((v): v is number => v !== null && v !== undefined);
  const atmImpliedVol = ivs.length === 0 ? null : ivs.reduce((a, b) => a + b, 0) / ivs.length;

  const priorWindow = priorSnapshots.slice(-c.ivMoveAvgWindowDays);
  const priorIvs = priorWindow.map((s) => s.atmImpliedVol).filter((v): v is number => v !== null);
  const ivMove = atmImpliedVol !== null && priorIvs.length > 0 ? atmImpliedVol - priorIvs.reduce((a, b) => a + b, 0) / priorIvs.length : null;

  const last = priorSnapshots.length > 0 ? priorSnapshots[priorSnapshots.length - 1] : null;
  const nearOtmCallOiChange = nearOtmCallOi !== null && last !== null && last.nearOtmCallOi !== null ? nearOtmCallOi - last.nearOtmCallOi : null;
  const putCallRatioChange = putCallRatio !== null && last !== null && last.putCallRatio !== null ? putCallRatio - last.putCallRatio : null;

  return {
    intelligence: { volumeOiRatioMax, volumeOiRatioAnomaly, nearOtmCallOi, nearOtmCallOiChange, putCallRatio, putCallRatioChange, atmImpliedVol, ivMove, availability: "可得" },
    snapshot: { asOf, atmImpliedVol, nearOtmCallOi, putCallRatio },
  };
}
