import type { BreadthConfig, BreadthSnapshot, BreadthState, BreadthSymbolInput, ConcentrationWarning } from "./types.js";

/**
 * TASK_CARD_08 Part C / 修正案十八's 市场宽度标准. Aggregates the
 * ALREADY-computed per-symbol indicators over this run's full gate-passed
 * universe - no new network calls, no recomputation: the same
 * `latestClose`/`sma50`/`sma200`/`week52High`/`week52Low` the detectors
 * already ran on.
 *
 * Symbols missing an input are excluded from that specific denominator
 * rather than counted as "not above" - a symbol with too little history
 * to have an SMA200 is unknown, not bearish, and folding it in as a miss
 * would systematically understate breadth in exactly the young/small-cap
 * names this universe is full of. `sma200SampleSize`/`sma50SampleSize`
 * disclose the real denominators.
 *
 * A "new 52-week high/low" here means the latest close is at or beyond
 * the extreme of its own trailing 52-week window (week52High/Low are
 * computed from that same window in week52.ts) - the standard
 * new-highs-vs-new-lows breadth reading.
 *
 * Strictly descriptive: the card's own MUST-NOT ("只描述当前宽度状态,
 * 严禁据此预测大盘走向") means nothing here may be phrased as, or fed
 * into, a market-direction call. `breadthDivergence` is a factual
 * co-occurrence flag (index above its 200-line AND internals weak), not
 * a prediction that either one is about to resolve toward the other.
 */
export function computeBreadth(
  symbols: BreadthSymbolInput[],
  spyCloseVsSma200: "above" | "below" | null,
  config: BreadthConfig,
): BreadthSnapshot {
  const c = config.breadth;

  const withSma200 = symbols.filter((s) => s.latestClose !== null && s.sma200 !== null);
  const withSma50 = symbols.filter((s) => s.latestClose !== null && s.sma50 !== null);

  const pctAboveSma200 =
    withSma200.length === 0 ? null : (withSma200.filter((s) => s.latestClose! >= s.sma200!).length / withSma200.length) * 100;
  const pctAboveSma50 =
    withSma50.length === 0 ? null : (withSma50.filter((s) => s.latestClose! >= s.sma50!).length / withSma50.length) * 100;

  // "Made a new 52-week high/low" = the latest BAR reached the extreme of
  // its own 52-week window (week52High/Low are themselves the max/min of
  // daily highs/lows over that same window, today included). Using the
  // close here instead would only count a stock that closed at the exact
  // top/bottom of its range - see BreadthSymbolInput's doc comment for the
  // live measurement that showed how badly that undercounts.
  const newHighCount = symbols.filter((s) => s.latestHigh !== null && s.week52High !== null && s.latestHigh >= s.week52High).length;
  const newLowCount = symbols.filter((s) => s.latestLow !== null && s.week52Low !== null && s.latestLow <= s.week52Low).length;
  const newHighLowRatio = newLowCount === 0 ? null : newHighCount / newLowCount;

  if (pctAboveSma200 === null || withSma200.length < c.minSymbolsForAggregation) {
    return {
      pctAboveSma200,
      pctAboveSma50,
      newHighCount,
      newLowCount,
      newHighLowRatio,
      state: "unknown",
      breadthDivergence: false,
      sma200SampleSize: withSma200.length,
      sma50SampleSize: withSma50.length,
      stateUnavailableReason: `Only ${withSma200.length} symbol(s) had a computable SMA200 this run (minimum ${c.minSymbolsForAggregation} required for a breadth reading)`,
    };
  }

  const newLowsDominate = newHighCount === 0 ? newLowCount > 0 : newLowCount / newHighCount >= c.weakNewLowRatio;
  const newHighsExceedLows = newHighCount > newLowCount;
  // "新高新低接近": neither side clears the other by the configured band.
  const highsLowsClose =
    newHighLowRatio !== null && newHighLowRatio < c.newHighLowRatioNarrowingBand && newHighLowRatio > 1 / c.newHighLowRatioNarrowingBand;

  let state: BreadthState;
  if (pctAboveSma200 < c.weakAboveSma200Pct || newLowsDominate) {
    state = "weak";
  } else if (pctAboveSma200 > c.healthyAboveSma200Pct && newHighsExceedLows && !highsLowsClose) {
    state = "healthy";
  } else {
    state = "narrowing";
  }

  return {
    pctAboveSma200,
    pctAboveSma50,
    newHighCount,
    newLowCount,
    newHighLowRatio,
    state,
    breadthDivergence: spyCloseVsSma200 === "above" && state === "weak",
    sma200SampleSize: withSma200.length,
    sma50SampleSize: withSma50.length,
    stateUnavailableReason: null,
  };
}

/**
 * TASK_CARD_09_STANDBY Part A item 7 / 修正案十九. Counts this run's
 * candidate+watchlist symbols by sector and reports every sector at or
 * over the threshold.
 *
 * Sector is the only grouping used: this repo has no "theme" membership
 * data for an arbitrary symbol (the hot-sector baskets in
 * config/hot_sectors.json are a hand-curated ticker list covering a
 * handful of names, not a universe-wide theme taxonomy), so grouping by
 * a fabricated theme label would be inventing data. Disclosed rather
 * than silently narrowed - see ai/decisions.md.
 *
 * The amendment's boundary ("严禁给出任何仓位、配置或规模建议") is why
 * this returns counts and ticker lists only. No field here, and no
 * renderer of it, may turn into advice.
 */
export function computeConcentrationWarnings(
  poolSymbols: Array<{ symbol: string; sector: string | undefined }>,
  config: BreadthConfig,
): ConcentrationWarning[] {
  const bySector = new Map<string, string[]>();
  for (const s of poolSymbols) {
    if (s.sector === undefined) continue;
    const list = bySector.get(s.sector) ?? [];
    list.push(s.symbol);
    bySector.set(s.sector, list);
  }

  return [...bySector.entries()]
    .filter(([, symbols]) => symbols.length >= config.concentration.minSameSectorCount)
    .map(([sector, symbols]) => ({ sector, count: symbols.length, symbols }))
    .sort((a, b) => b.count - a.count);
}
