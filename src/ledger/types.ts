/**
 * Forward outcome ledger schema (constitution/ATLAS_AMENDMENT_NO2_v1_1.md,
 * 修正案五: Forward Outcome Tracking replaces historical backtesting).
 * Every candidate list produced by a screening run must be archived
 * permanently, with no deletion; outcome fields are backfilled once the
 * holding period matures or an invalidation condition triggers. This card
 * ships the schema and an append-only writer only - nothing calls it yet
 * (TASK_CARD_01 SCOPE 6: "不接逻辑").
 */
export type LegalHoldingPeriod = "1至2周" | "1至2个月" | "3至6个月";

export interface LedgerEntry {
  symbol: string;
  screeningTimestamp: string;
  profile: "STANDARD" | "SMALL_SPEC";
  speculative: boolean;
  /** Null until a detector (future card) assigns one. */
  holdingPeriod: LegalHoldingPeriod | null;
  /** Null until a detector (future card) assigns one. */
  opportunityType: string | null;
  outcome: {
    repriced: boolean | null;
    invalidationTriggered: boolean | null;
    elapsedDays: number | null;
    resolvedAt: string | null;
  };
}
