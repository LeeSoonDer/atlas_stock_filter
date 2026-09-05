export type BreadthState = "healthy" | "narrowing" | "weak" | "unknown";

export interface BreadthConfig {
  breadth: {
    healthyAboveSma200Pct: number;
    weakAboveSma200Pct: number;
    /** New-high/new-low counts closer than this multiple of each other read as "接近" (narrowing), not decisively healthy. */
    newHighLowRatioNarrowingBand: number;
    /** New lows outnumbering new highs by at least this multiple is weak on its own, regardless of the SMA200 percentage. */
    weakNewLowRatio: number;
    /** Below this many symbols with computable SMA200, the whole snapshot is 不可得 rather than a percentage of a handful. */
    minSymbolsForAggregation: number;
  };
  concentration: {
    minSameSectorCount: number;
  };
}

/**
 * One symbol's already-computed indicator values, as consumed by the
 * breadth aggregation - no recomputation happens in the breadth module.
 *
 * `latestHigh`/`latestLow` are the latest BAR's high/low, not the close:
 * a stock "makes a new 52-week high" when it TRADES at one, and
 * week52High is itself the max of daily highs. Comparing the close
 * against it instead would only ever count a stock that closed at the
 * exact top of its 52-week range - measured live on 2026-09-05, that
 * scored 2 new highs out of 3173 symbols while 75 sat within 1% of their
 * high, i.e. an artifact rather than a breadth reading. See
 * ai/decisions.md.
 */
export interface BreadthSymbolInput {
  latestClose: number | null;
  latestHigh: number | null;
  latestLow: number | null;
  sma50: number | null;
  sma200: number | null;
  week52High: number | null;
  week52Low: number | null;
}

export interface BreadthSnapshot {
  /** Percent of symbols with a computable SMA200 whose close is at/above it. null when too few symbols had one. */
  pctAboveSma200: number | null;
  pctAboveSma50: number | null;
  newHighCount: number;
  newLowCount: number;
  /** newHighCount / newLowCount. null when there were zero new lows (undefined ratio, not "infinitely healthy"). */
  newHighLowRatio: number | null;
  state: BreadthState;
  /** TASK_CARD_08 Part C item 3: index above its own 200-line while internals read weak. Never a forecast - see computeBreadth's doc comment. */
  breadthDivergence: boolean;
  /** How many symbols actually had a computable SMA200 / SMA50 - the real denominators, disclosed rather than implied. */
  sma200SampleSize: number;
  sma50SampleSize: number;
  stateUnavailableReason: string | null;
}

/** TASK_CARD_09_STANDBY Part A item 7 / 修正案十九. Facts only - counts and names, never a sizing or allocation suggestion. */
export interface ConcentrationWarning {
  sector: string;
  count: number;
  symbols: string[];
}
