/**
 * Wilder's RSI (the standard 14-period formula). Requires at least
 * `period + 1` closes (period deltas to seed the initial average).
 * Smoothing: avg = (prevAvg * (period - 1) + current) / period, applied
 * from the first `period` deltas onward - this is the original Wilder
 * method, not a plain SMA-of-RS.
 */
export function rsi(closes: number[], period: number): number | null {
  if (closes.length < period + 1) return null;

  const deltas: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    deltas.push(closes[i] - closes[i - 1]);
  }

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    const d = deltas[i];
    avgGain += Math.max(d, 0);
    avgLoss += Math.max(-d, 0);
  }
  avgGain /= period;
  avgLoss /= period;

  for (let i = period; i < deltas.length; i++) {
    const d = deltas[i];
    const gain = Math.max(d, 0);
    const loss = Math.max(-d, 0);
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}
