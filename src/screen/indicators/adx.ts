import type { CleanBar } from "./series.js";

/**
 * Wilder's ADX (Average Directional Index), TASK_CARD_09_STANDBY Part A
 * item 5 / 修正案十八's 趋势强度旗标. Same Wilder smoothing convention
 * already used by atr.ts and rsi.ts in this repo.
 *
 * Pipeline: True Range + directional movement per bar -> Wilder-smoothed
 * over `period` -> +DI/-DI -> DX -> ADX (a second Wilder smoothing of DX).
 * That second smoothing is why this needs roughly 2x`period` bars of
 * history, not 1x: null (not a degraded guess) below that.
 *
 * Reads as a strength/trendiness magnitude only - it carries NO direction
 * (a strong downtrend and a strong uptrend both score high), which is
 * exactly why the card uses it as a 震荡区间 warning rather than as any
 * kind of bullish/bearish signal.
 */
export function adx(bars: CleanBar[], period: number): number | null {
  if (bars.length < period * 2 + 1) return null;

  const trueRanges: number[] = [];
  const plusDMs: number[] = [];
  const minusDMs: number[] = [];

  for (let i = 1; i < bars.length; i++) {
    const { high, low } = bars[i];
    const prev = bars[i - 1];
    trueRanges.push(Math.max(high - low, Math.abs(high - prev.close), Math.abs(low - prev.close)));

    const upMove = high - prev.high;
    const downMove = prev.low - low;
    plusDMs.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDMs.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }

  const wilderSmooth = (values: number[]): number[] => {
    // Wilder's running total form: first value is the plain sum of the
    // opening `period` entries, each later one drops 1/period of the
    // running total and adds the new entry.
    const out: number[] = [];
    let running = values.slice(0, period).reduce((a, b) => a + b, 0);
    out.push(running);
    for (let i = period; i < values.length; i++) {
      running = running - running / period + values[i];
      out.push(running);
    }
    return out;
  };

  const smoothedTr = wilderSmooth(trueRanges);
  const smoothedPlusDM = wilderSmooth(plusDMs);
  const smoothedMinusDM = wilderSmooth(minusDMs);

  const dxValues: number[] = [];
  for (let i = 0; i < smoothedTr.length; i++) {
    if (smoothedTr[i] === 0) continue;
    const plusDI = (smoothedPlusDM[i] / smoothedTr[i]) * 100;
    const minusDI = (smoothedMinusDM[i] / smoothedTr[i]) * 100;
    const diSum = plusDI + minusDI;
    if (diSum === 0) continue;
    dxValues.push((Math.abs(plusDI - minusDI) / diSum) * 100);
  }

  if (dxValues.length < period) return null;

  let adxValue = dxValues.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < dxValues.length; i++) {
    adxValue = (adxValue * (period - 1) + dxValues[i]) / period;
  }
  return adxValue;
}
