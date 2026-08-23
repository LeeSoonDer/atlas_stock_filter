import type { ExclusionReason, ExclusionResult, RawSymbolRecord } from "./types.js";

/**
 * Name-based heuristics for the constitutional exclusion gate
 * (constitution/ATLAS_MEMO_NO4_FINAL_ADJUDICATIONS.md B7: OTC/ETF/ETN,
 * leveraged & inverse funds, warrants, preferred stock, SPAC).
 *
 * Every pattern below was validated against a live nasdaqlisted.txt /
 * otherlisted.txt download during TASK_CARD_01 (checked for false-positive
 * collisions, e.g. "United Airlines" vs "\bUnit\b", "Wright" vs "\bRight\b",
 * ticker ETN=Eaton Corp vs the word "ETN" in a security name). Heuristic
 * false-kill rate up to 2% is constitutionally accepted and not required to
 * be fixed (Memo No.4, E19).
 *
 * OTC exclusion is structural, not a name pattern: the universe source is
 * nasdaqtrader.com's official NASDAQ + NYSE listing directories, which by
 * construction never include OTC/pink-sheet symbols.
 */
const NAME_PATTERNS: Array<{ reason: ExclusionReason; pattern: RegExp }> = [
  { reason: "ETF_ETN_NAME", pattern: /\bETNs?\b/i },
  { reason: "WARRANT", pattern: /\bWarrants?\b/i },
  { reason: "RIGHT", pattern: /\bRights?\b/i },
  { reason: "UNIT", pattern: /\bUnits?\b/i },
  { reason: "PREFERRED", pattern: /\bPreferred\b/i },
  { reason: "SPAC", pattern: /Acquisition Corp|\bBlank Check\b|\bSPAC\b/i },
  {
    reason: "LEVERAGED_INVERSE",
    pattern: /[0-9]+X\s+(Leveraged|Inverse|Long|Short)|Inverse Leveraged|Double (Long|Short)/i,
  },
  // Not in the card's literal category list, but required by the
  // constitution's universe definition ("全部上市普通股及合格ADR" -
  // ATLAS_MEMO_NO3_ADJUDICATIONS.md Q5): corporate debt notes/bonds are
  // not common stock. Discovered live during TASK_CARD_01 (184 raw
  // "Notes|Bonds|Debentures" hits); this precise pattern was validated
  // against the live directory to produce zero false positives against
  // "Common Stock" / "Common Shares" / "Ordinary Shares" suffixed names
  // (e.g. does not exclude "Our Bond, Inc. - Common Stock"). A residual
  // gap remains for closed-end bond funds with no coupon/maturity in
  // their name (e.g. "PGIM High Yield Bond Fund, Inc.") - out of this
  // card's scope, not a common-stock false-admit, deferred.
  {
    reason: "DEBT_SECURITY",
    pattern:
      /\bDebentures?\b|\bSenior\s+(Secured\s+|Unsecured\s+)?Notes?\b|\bSubordinated\s+(Notes?|Debentures?)\b|\bJunior\s+Subordinated\b|\bFirst\s+Mortgage\s+Bonds?\b|%.*\bdue\b|\bNotes?\s+due\b/i,
  },
];

export function evaluateExclusion(record: RawSymbolRecord): ExclusionResult {
  if (record.testIssueFlag) {
    return { excluded: true, reason: "TEST_ISSUE" };
  }
  if (record.etfFlag) {
    return { excluded: true, reason: "ETF_ETN_FLAG" };
  }
  for (const { reason, pattern } of NAME_PATTERNS) {
    if (pattern.test(record.securityName)) {
      return { excluded: true, reason };
    }
  }
  return { excluded: false, reason: null };
}
