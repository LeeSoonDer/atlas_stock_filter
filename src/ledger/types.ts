import type { IndicatorFlags } from "../screen/indicators/types.js";
import type { ProfileName } from "../screen/types.js";

/**
 * Forward outcome ledger schema (constitution/ATLAS_AMENDMENT_NO2_v1_1.md,
 * 修正案五: Forward Outcome Tracking replaces historical backtesting).
 * Every candidate/watchlist entry a run produces is archived permanently,
 * with no deletion (MUST-NOT: "删除或修改历史账本条目").
 *
 * Revised from TASK_CARD_01's stub (which embedded a mutable-looking
 * `outcome` object directly on the entry) now that backfill is real: a
 * screening entry is NEVER mutated once written. Backfilling an outcome
 * appends a SEPARATE OutcomeUpdateLedgerEntry that references the
 * original screening entry by (symbol, screeningTimestamp) - the append-
 * only file accumulates both record types, and a reader wanting "the
 * current known outcome of candidate X from run Y" joins the two by
 * that reference rather than looking for an edited field. Nothing had
 * ever been written to the ledger before this card (CARD 01-04 built it
 * but never called it), so this is not a breaking migration.
 */
export type LegalHoldingPeriod = "1至2周" | "1至2个月" | "3至6个月";
export type LedgerStatus = "candidate" | "watchlist" | "promoted";

export interface ScreeningLedgerEntry {
  recordType: "screening";
  symbol: string;
  screeningTimestamp: string;
  profile: ProfileName;
  speculative: boolean;
  status: LedgerStatus;
  buckets: string[];
  flagsSnapshot: IndicatorFlags;
  /** Null - Layer 1 (this repo) never assigns a holding period; that is a Research Layer / Module 1 decision per the constitution. */
  holdingPeriod: LegalHoldingPeriod | null;
  /** The candidate's primary bucket (see selectCandidates.ts), or null for a watchlist entry with no full trigger yet. */
  opportunityType: string | null;
}

export interface OutcomeUpdateLedgerEntry {
  recordType: "outcome_update";
  symbol: string;
  /** References the ScreeningLedgerEntry this resolves - do not edit that entry itself. */
  refersToScreeningTimestamp: string;
  backfilledAt: string;
  outcome: {
    repriced: boolean;
    invalidationTriggered: boolean;
    expiredNoEvent: boolean;
    elapsedDays: number;
  };
}

export type LedgerEntry = ScreeningLedgerEntry | OutcomeUpdateLedgerEntry;
