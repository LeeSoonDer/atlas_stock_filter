/** Raw trailing return over `tradingDays`: (latest / N-days-ago) - 1. Cross-symbol percentile ranking happens at the pipeline level, not here. */
export function trailingReturn(closes: number[], tradingDays: number): number | null {
  if (closes.length < tradingDays + 1) return null;
  const latest = closes[closes.length - 1];
  const past = closes[closes.length - 1 - tradingDays];
  if (past === 0) return null;
  return latest / past - 1;
}
