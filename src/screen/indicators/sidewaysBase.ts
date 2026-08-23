/**
 * Not in TASK_CARD_02's SCOPE 1 indicator list, but required to evaluate
 * Detector B's "横向基底 >= 30 个交易日" branch, which has no other
 * defined computation. Definition (documented per the card's own
 * "write the algorithm in a comment" convention): walking backward from
 * the latest close, count consecutive trading days whose close stays
 * within [latestClose * (1 - bandPct), latestClose * (1 + bandPct)];
 * the count stops at the first day outside that band. bandPct is
 * config-driven (config/detectors.json indicators.sidewaysBase.bandPct).
 */
export function sidewaysBaseDays(closes: number[], bandPct: number): number | null {
  if (closes.length === 0) return null;
  const latest = closes[closes.length - 1];
  const upper = latest * (1 + bandPct);
  const lower = latest * (1 - bandPct);
  let count = 0;
  for (let i = closes.length - 1; i >= 0; i--) {
    if (closes[i] >= lower && closes[i] <= upper) {
      count++;
    } else {
      break;
    }
  }
  return count;
}
