import type { Form4ReportingOwner } from "./types.js";

export interface InsiderWeightingConfig {
  insiderWeighting: {
    topExecWeight: number;
    otherOfficerWeight: number;
    directorWeight: number;
    otherWeight: number;
    significantAmountUsd: number;
    significantMultiplier: number;
    clusterMinWeightedScore: number;
  };
}

const TOP_EXEC_TITLE_PATTERN = /chief executive officer|chief financial officer|chief operating officer|\bceo\b|\bcfo\b|\bcoo\b/i;

/**
 * TASK_CARD_09 Part A / 修正案十五 "内部人买入加权": role weight per the
 * card's literal 3-tier ladder. officerTitle is free text from real SEC
 * filings (e.g. "Co-Chief Executive Officer", "Executive Vice President &
 * CFO" - both correctly match as top-exec via substring, verified against
 * real filings during this card). A 10%-owner-only or "isOther" reporting
 * person (neither officer nor director) isn't named by the card at all -
 * falls back to directorWeight, the lowest tier the card explicitly
 * defines, rather than inventing a new one (see ai/decisions.md).
 */
export function insiderRoleWeight(owner: Form4ReportingOwner, config: InsiderWeightingConfig): number {
  const c = config.insiderWeighting;
  if (owner.officerTitle && TOP_EXEC_TITLE_PATTERN.test(owner.officerTitle)) return c.topExecWeight;
  if (owner.isOfficer) return c.otherOfficerWeight;
  if (owner.isDirector) return c.directorWeight;
  return c.otherWeight;
}

/** shares * pricePerShare, or null if either is missing (never fabricated). */
export function transactionDollarAmount(shares: number | null, pricePerShare: number | null): number | null {
  if (shares === null || pricePerShare === null) return null;
  return shares * pricePerShare;
}

/** Role weight, boosted by the significance multiplier when this specific transaction cleared the dollar threshold. */
export function transactionWeight(owner: Form4ReportingOwner, shares: number | null, pricePerShare: number | null, config: InsiderWeightingConfig): number {
  const c = config.insiderWeighting;
  const base = insiderRoleWeight(owner, config);
  const amount = transactionDollarAmount(shares, pricePerShare);
  const significant = amount !== null && amount >= c.significantAmountUsd;
  return significant ? base * c.significantMultiplier : base;
}
