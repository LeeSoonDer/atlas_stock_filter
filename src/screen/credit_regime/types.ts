export type CreditRegimeLabel = "loose" | "neutral" | "tight" | "unknown";

/**
 * TASK_CARD_08 Part A. `unknown` covers both "FRED_API_KEY not configured"
 * and "fetch failed" - the circuit-breaker's own MUST-NOT forbids using
 * this to predict market direction, so no attempt is made to distinguish
 * those two causes beyond the free-text `labelUnavailableReason`.
 */
export interface CreditRegimeSnapshot {
  asOf: string;
  oasCurrentBp: number | null;
  oasPastBp: number | null;
  oasChangeBp: number | null;
  label: CreditRegimeLabel;
  labelUnavailableReason: string | null;
}

export interface CreditRegimeConfig {
  creditRegime: {
    looseMaxBp: number;
    tightMinBp: number;
    divergentWideningBp: number;
    lookbackTradingDays: number;
  };
}

/**
 * TASK_CARD_08 Part A "全部候选的 risk_level 自动上调一级" - no risk_level
 * concept existed anywhere in this codebase before this card, so this is a
 * new, deliberately minimal 3-tier ladder derived entirely from data the
 * pipeline already has (a candidate's own `speculative` flag) plus this
 * run's credit regime label. No new judgment is introduced.
 */
export type RiskLevel = "normal" | "elevated" | "high";

export function computeRiskLevel(speculative: boolean, creditRegimeTight: boolean): RiskLevel {
  const baseline: RiskLevel = speculative ? "elevated" : "normal";
  if (!creditRegimeTight) return baseline;
  return baseline === "normal" ? "elevated" : "high";
}
