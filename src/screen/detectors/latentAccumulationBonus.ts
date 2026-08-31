/**
 * TASK_CARD_09 Part A / 修正案十五: shared strength-bonus helper for the
 * three latent-accumulation flags that apply to more than one bucket
 * (rsLineNewHigh: momentum + compression; aboveVwapStreak: all four
 * buckets). Defined once and reused rather than reimplemented per
 * detector, to avoid the "same logic written 4 times, drifts silently"
 * risk already flagged once in this project's history (see the report
 * redesign's own conditions/triggered duplication note in
 * ai/decisions.md). ONLY ever called after a detector's own admission
 * conditions already decided `triggered: true` - never touches whether a
 * bucket triggers, only how its strengthScore is ranked within the
 * bucket. Each true flag adds a fixed, config-driven bonus (default 5
 * points per flag - a disclosed, invented magnitude; the card specifies
 * "强度加分" without an exact formula - see ai/decisions.md), capped so
 * the bonus can never push a score above 100.
 */
export function applyLatentAccumulationBonus(baseScore: number, bonusFlags: Array<boolean | null>, bonusPerFlag: number): number {
  const earned = bonusFlags.filter((f) => f === true).length * bonusPerFlag;
  return Math.min(100, baseScore + earned);
}
