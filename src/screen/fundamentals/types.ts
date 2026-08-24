export interface RawPeriod {
  date: Date;
  totalRevenue?: number;
  grossProfit?: number;
  netIncome?: number;
}

/** Raw inputs to computeFundamentalFlags, already ascending by date (oldest first). */
export interface RawFundamentalsData {
  quarterlyFinancials: RawPeriod[];
  annualFinancials: RawPeriod[];
  totalCash?: number;
  totalDebt?: number;
  /** All known earnings dates (past and future) from calendarEvents; may be empty. */
  earningsDates: Date[];
}

export interface FundamentalsConfig {
  fundamentals: {
    revenueGrowthAccelDecelEpsilon: number;
    grossMarginFlatEpsilon: number;
    highLeverageDebtToCashRatio: number;
    earningsSoonWindowDays: number;
  };
}
