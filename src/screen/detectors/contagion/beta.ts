import type { CleanBar } from "../../indicators/series.js";

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Trailing `lookbackDays` daily returns from the last `lookbackDays + 1` closes. Same convention as volumeRatioLatest: needs a full window, never fabricates a point. */
export function dailyReturnSeries(bars: CleanBar[], lookbackDays: number): number[] {
  if (bars.length < lookbackDays + 1) return [];
  const closes = bars.slice(-(lookbackDays + 1)).map((b) => b.close);
  const out: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] === 0) continue;
    out.push(closes[i] / closes[i - 1] - 1);
  }
  return out;
}

/**
 * TASK_CARD_10 Part B stage 3: 60-day beta vs SPY, Cov(symbol, SPY) / Var(SPY)
 * over daily returns. Closes are date-aligned first (Map keyed by SPY's own
 * bar dates) so a trading-calendar mismatch between the two series can't
 * silently pair the wrong days together, then returns are computed from
 * that aligned pair series - not from two independently-computed return
 * series that happen to be the same length.
 *
 * Returns null (never a guessed beta) when there isn't a full aligned
 * window - per the card's own 熔断 clause, the caller falls back to
 * historicalVolatility() in that case, this function does not fall back
 * to anything itself.
 */
export function computeBeta60d(symbolBars: CleanBar[], spyBars: CleanBar[], lookbackDays: number): number | null {
  const spyByDate = new Map(spyBars.map((b) => [b.date, b.close]));
  const aligned: { symClose: number; spyClose: number }[] = [];
  for (const b of symbolBars) {
    const spyClose = spyByDate.get(b.date);
    if (spyClose !== undefined) aligned.push({ symClose: b.close, spyClose });
  }
  const tail = aligned.slice(-(lookbackDays + 1));
  if (tail.length < lookbackDays + 1) return null;

  const symReturns: number[] = [];
  const spyReturns: number[] = [];
  for (let i = 1; i < tail.length; i++) {
    if (tail[i - 1].symClose === 0 || tail[i - 1].spyClose === 0) continue;
    symReturns.push(tail[i].symClose / tail[i - 1].symClose - 1);
    spyReturns.push(tail[i].spyClose / tail[i - 1].spyClose - 1);
  }
  if (symReturns.length < 2) return null;

  const symMean = mean(symReturns);
  const spyMean = mean(spyReturns);
  let cov = 0;
  let varSpy = 0;
  for (let i = 0; i < symReturns.length; i++) {
    cov += (symReturns[i] - symMean) * (spyReturns[i] - spyMean);
    varSpy += (spyReturns[i] - spyMean) ** 2;
  }
  if (varSpy === 0) return null;
  return cov / varSpy;
}

/**
 * Fallback for computeBeta60d per the card's own 熔断 clause ("beta计算若
 * 数据不足,降级为用历史波动率替代,不阻塞"): raw (non-annualized) sample
 * stddev of daily returns. Never annualized because the card compares it
 * against the SAME sector's median of this same raw metric - the
 * annualization factor is common to every symbol and cancels out in that
 * ratio, so annualizing would add a step with no effect on the comparison.
 */
export function historicalVolatility(bars: CleanBar[], lookbackDays: number): number | null {
  const returns = dailyReturnSeries(bars, lookbackDays);
  if (returns.length < 2) return null;
  const m = mean(returns);
  const variance = returns.reduce((a, b) => a + (b - m) ** 2, 0) / (returns.length - 1);
  return Math.sqrt(variance);
}
