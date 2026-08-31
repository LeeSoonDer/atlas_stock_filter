export interface RawPeriod {
  date: Date;
  totalRevenue?: number;
  grossProfit?: number;
  netIncome?: number;
}

/** TASK_CARD_09 Part C. */
export interface RawCashFlowPeriod {
  date: Date;
  operatingCashFlow?: number;
}

/** TASK_CARD_09 Part C. */
export interface RawBalanceSheetPeriod {
  date: Date;
  totalAssets?: number;
  cashAndCashEquivalents?: number;
}

/** Raw inputs to computeFundamentalFlags, already ascending by date (oldest first). */
export interface RawFundamentalsData {
  quarterlyFinancials: RawPeriod[];
  annualFinancials: RawPeriod[];
  /** TASK_CARD_09 Part C: 应计质量旗标 needs operatingCashFlow matched to the same period as netIncome. */
  quarterlyCashFlow: RawCashFlowPeriod[];
  /** TASK_CARD_09 Part C: 应计质量(totalAssets) + 现金跑道(cashAndCashEquivalents). */
  quarterlyBalanceSheet: RawBalanceSheetPeriod[];
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
