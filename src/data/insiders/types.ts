/** A Form 4 filing from a daily index whose issuer CIK is in our universe - not yet fetched/parsed. */
export interface RelevantForm4Filing {
  cik: string;
  ticker: string;
  accessionPath: string;
  dateFiled: string;
}

export interface Form4Transaction {
  transactionCode: string;
  shares: number | null;
  pricePerShare: number | null;
}

export interface Form4ReportingOwner {
  cik: string;
  name: string;
  /**
   * TASK_CARD_09 Part A / 修正案十五: reportingOwnerRelationship fields,
   * needed for insider-cluster weighting by seniority. Live-verified
   * against real SEC filings during this card (not from memory/docs) -
   * the boolean sub-tags are inconsistently either "1"/"0" or
   * "true"/"false" across filings of different vintages (both handled by
   * the parser), and officerTitle is free text (e.g. "Co-Chief Executive
   * Officer", "Executive Vice President & CFO") - absent entirely when
   * the owner isn't an officer.
   */
  isDirector: boolean;
  isOfficer: boolean;
  isTenPercentOwner: boolean;
  officerTitle: string | null;
}

/** The result of fetching + parsing one relevant filing's full text. Only nonDerivativeTable transactions are parsed (SCOPE 1's "简化优先" - buy direction/count/amount only, not full-field parsing). */
export interface ParsedForm4Filing {
  accessionPath: string;
  ticker: string;
  cik: string;
  dateFiled: string;
  periodOfReport: string | null;
  reportingOwners: Form4ReportingOwner[];
  transactions: Form4Transaction[];
  fetchedAt: string;
}

export interface InsiderClusterConfig {
  insiders: {
    lookbackDays: number;
    clusterMinDistinctBuyers: number;
    maxRequestsPerSecond: number;
  };
}
