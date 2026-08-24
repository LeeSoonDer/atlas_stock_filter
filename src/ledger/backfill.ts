import type { OutcomeUpdateLedgerEntry, ScreeningLedgerEntry } from "./types.js";

export type BackfillOutcome = "repriced" | "invalidated" | "expired_no_event";

export function buildOutcomeUpdate(
  symbol: string,
  refersToScreeningTimestamp: string,
  outcome: BackfillOutcome,
  elapsedDays: number,
  now: Date = new Date(),
): OutcomeUpdateLedgerEntry {
  return {
    recordType: "outcome_update",
    symbol,
    refersToScreeningTimestamp,
    backfilledAt: now.toISOString(),
    outcome: {
      repriced: outcome === "repriced",
      invalidationTriggered: outcome === "invalidated",
      expiredNoEvent: outcome === "expired_no_event",
      elapsedDays,
    },
  };
}

/** Screening entries for `symbol` that have no outcome_update yet, oldest first (the natural next-to-backfill order). */
export function findUnresolvedScreenings(
  symbol: string,
  screenings: ScreeningLedgerEntry[],
  resolvedTimestamps: Set<string>,
): ScreeningLedgerEntry[] {
  return screenings
    .filter((s) => s.symbol === symbol && !resolvedTimestamps.has(s.screeningTimestamp))
    .sort((a, b) => a.screeningTimestamp.localeCompare(b.screeningTimestamp));
}
