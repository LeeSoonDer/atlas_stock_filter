export interface ShortInterestRecord {
  symbol: string;
  settlementDate: string;
  currentShortShares: number;
  previousShortShares: number;
  daysToCover: number | null;
  changePercent: number | null;
}

export interface ShortInterestFile {
  settlementDate: string;
  fetchedAt: string;
  lagDays: number;
  records: Map<string, ShortInterestRecord>;
}
