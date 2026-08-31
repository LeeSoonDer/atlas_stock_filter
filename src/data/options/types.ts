/**
 * TASK_CARD_09 Part B / 修正案十六: options intelligence for the
 * candidate+watchlist pool only (≤15 symbols - see fetchOptionsChain.ts's
 * caller in pipeline.ts, which runs strictly after selection is already
 * finalized, so there is no code path from this module back into bucket
 * judgment or candidate selection by construction).
 *
 * 诚实标注铁律: every field here is AGGREGATE data only - no per-trade
 * detail, no buy/sell direction, no counterparty identity. Never describe
 * these as a directional bet or an insider signal (grep-verified in
 * ai/decisions.md and the report/payload renderers' own tests) - free
 * options data cannot distinguish a long call buyer from a market-maker's
 * delta hedge or a covered-call writer.
 */
export interface RawOptionContract {
  strike: number;
  volume: number | null;
  openInterest: number | null;
  impliedVolatility: number | null;
  inTheMoney: boolean;
}

export interface RawOptionsChain {
  underlyingPrice: number | null;
  calls: RawOptionContract[];
  puts: RawOptionContract[];
}

export interface OptionsIntelligence {
  /** Max (volume/openInterest) across all near-month strikes with openInterest > 0. */
  volumeOiRatioMax: number | null;
  volumeOiRatioAnomaly: boolean | null;
  /** Sum of call openInterest for strikes 15-30% (config-driven) above the underlying price, near-month expiration only. */
  nearOtmCallOi: number | null;
  /** vs the immediately prior run's value for this symbol - null when there is no prior run to compare against. */
  nearOtmCallOiChange: number | null;
  /** Full-chain put volume / call volume, near-month expiration only. */
  putCallRatio: number | null;
  putCallRatioChange: number | null;
  /** Implied volatility of the strike closest to the underlying price. */
  atmImpliedVol: number | null;
  /** atmImpliedVol minus the average of up to the last `ivMoveAvgWindowDays` RUNS' atmImpliedVol for this symbol (a run-cadence proxy for "20-day average" - this repo does not run daily, so a true trading-day window isn't available; disclosed, not a calendar/trading-day average). null until at least one prior observation exists. */
  ivMove: number | null;
  availability: "可得" | "不可得";
}

export interface OptionsConfig {
  options: {
    volumeOiRatioAnomalyThreshold: number;
    nearOtmCallMinPct: number;
    nearOtmCallMaxPct: number;
    ivMoveAvgWindowDays: number;
  };
}

/**
 * Persisted in checkpoint.json (Record<symbol, OptionsHistorySnapshot[]>,
 * capped at ivMoveAvgWindowDays entries, oldest dropped) - "ivMoveAvgWindowDays"
 * is a run count, not a calendar/trading-day count, since this repo does
 * not run daily (see OptionsIntelligence.ivMove's own doc comment).
 */
export interface OptionsHistorySnapshot {
  asOf: string;
  atmImpliedVol: number | null;
  nearOtmCallOi: number | null;
  putCallRatio: number | null;
}
