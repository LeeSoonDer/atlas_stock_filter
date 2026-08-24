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
