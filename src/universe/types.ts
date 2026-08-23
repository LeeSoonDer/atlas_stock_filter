export type SourceExchange = "NASDAQ" | "NYSE";

export interface RawSymbolRecord {
  symbol: string;
  securityName: string;
  exchange: SourceExchange;
  etfFlag: boolean;
  testIssueFlag: boolean;
}

export interface ExclusionResult {
  excluded: boolean;
  reason: ExclusionReason | null;
}

export type ExclusionReason =
  | "TEST_ISSUE"
  | "ETF_ETN_FLAG"
  | "ETF_ETN_NAME"
  | "WARRANT"
  | "RIGHT"
  | "UNIT"
  | "PREFERRED"
  | "SPAC"
  | "LEVERAGED_INVERSE"
  | "DEBT_SECURITY";

export interface UniverseSymbol extends RawSymbolRecord {
  /** Populated once Module 4 fetches quote data; undefined pre-fetch. */
}
