import type {
  Availability,
  FundamentalsSlice,
  GrossMarginFlag,
  LeverageFlag,
  ProfitabilityFlag,
  RevenueGrowthFlag,
} from "../../data/types.js";
import type { FundamentalsConfig, RawFundamentalsData, RawPeriod } from "./types.js";

function lastNWithField<K extends keyof RawPeriod>(periods: RawPeriod[], field: K, n: number): RawPeriod[] {
  const withField = periods.filter((p) => p[field] !== undefined);
  return withField.slice(Math.max(0, withField.length - n));
}

/**
 * Revenue YoY growth trend (needs 3 annual periods: this year, last year,
 * year before, to compare two consecutive YoY growth rates). "同比"
 * (year-over-year) is read literally as annual-period-over-annual-period,
 * not a quarterly proxy - see ai/decisions.md for why (yahoo's quarterly
 * fundamentalsTimeSeries only returns ~5 sequential quarters, not enough
 * span for a genuine same-quarter-last-year comparison; annual periods
 * reliably span multiple years).
 */
function revenueGrowthFlag(
  annualFinancials: RawPeriod[],
  epsilon: number,
): { flag?: RevenueGrowthFlag; availability: Availability } {
  const periods = lastNWithField(annualFinancials, "totalRevenue", 3);
  if (periods.length < 3) return { availability: "不可得" };

  const [yearBefore, lastYear, thisYear] = periods;
  const rBefore = yearBefore.totalRevenue!;
  const rLast = lastYear.totalRevenue!;
  const rThis = thisYear.totalRevenue!;
  if (rLast === 0 || rBefore === 0) return { availability: "不可得" };

  const thisYearGrowth = rThis / rLast - 1;
  const lastYearGrowth = rLast / rBefore - 1;

  let flag: RevenueGrowthFlag;
  if (thisYearGrowth < 0) flag = "negative_growth";
  else if (thisYearGrowth > lastYearGrowth + epsilon) flag = "accelerating";
  else if (thisYearGrowth < lastYearGrowth - epsilon) flag = "decelerating";
  else flag = "stable";

  return { flag, availability: "可得" };
}

/** Gross margin direction over the last two reported quarters. */
function grossMarginFlag(
  quarterlyFinancials: RawPeriod[],
  epsilon: number,
): { flag?: GrossMarginFlag; availability: Availability } {
  const withRevenue = quarterlyFinancials.filter((p) => p.totalRevenue !== undefined && p.totalRevenue !== 0 && p.grossProfit !== undefined);
  const periods = withRevenue.slice(Math.max(0, withRevenue.length - 2));
  if (periods.length < 2) return { availability: "不可得" };

  const [prev, latest] = periods;
  const marginPrev = prev.grossProfit! / prev.totalRevenue!;
  const marginLatest = latest.grossProfit! / latest.totalRevenue!;
  const diff = marginLatest - marginPrev;

  let flag: GrossMarginFlag;
  if (diff > epsilon) flag = "improved";
  else if (diff < -epsilon) flag = "worsened";
  else flag = "flat";

  return { flag, availability: "可得" };
}

/**
 * Profitability trend over the last two reported quarters. Only 3 states
 * are named in the card (profitable / loss_narrowing / loss_widening);
 * two edge cases need a documented mapping since they're not named:
 * a tied loss magnitude maps to loss_narrowing (treats "not worse" as the
 * closer-to-good direction), and a swing from a profitable prior quarter
 * into a current loss maps to loss_widening (treated as a deterioration).
 */
function profitabilityFlag(quarterlyFinancials: RawPeriod[]): { flag?: ProfitabilityFlag; availability: Availability } {
  const periods = lastNWithField(quarterlyFinancials, "netIncome", 2);
  if (periods.length < 2) return { availability: "不可得" };

  const [prev, latest] = periods;
  const latestNI = latest.netIncome!;
  const prevNI = prev.netIncome!;

  if (latestNI > 0) return { flag: "profitable", availability: "可得" };

  let flag: ProfitabilityFlag;
  if (prevNI > 0) {
    flag = "loss_widening";
  } else {
    const latestLoss = Math.abs(latestNI);
    const prevLoss = Math.abs(prevNI);
    flag = latestLoss > prevLoss ? "loss_widening" : "loss_narrowing";
  }
  return { flag, availability: "可得" };
}

function leverageFlag(
  totalCash: number | undefined,
  totalDebt: number | undefined,
  ratioThreshold: number,
): { flag?: LeverageFlag; availability: Availability } {
  if (totalCash === undefined || totalDebt === undefined) return { availability: "不可得" };

  const netDebt = totalDebt - totalCash;
  let flag: LeverageFlag;
  if (netDebt <= 0) flag = "net_cash";
  else if (totalCash <= 0) flag = "high_leverage";
  else if (totalDebt / totalCash >= ratioThreshold) flag = "high_leverage";
  else flag = "manageable";

  return { flag, availability: "可得" };
}

function earningsSoonFlag(
  earningsDates: Date[],
  now: Date,
  windowDays: number,
): { earningsSoon: boolean; earningsDate?: string; availability: Availability } {
  const future = earningsDates.filter((d) => d.getTime() >= now.getTime()).sort((a, b) => a.getTime() - b.getTime());
  if (future.length === 0) return { earningsSoon: false, availability: "不可得" };

  const nextDate = future[0];
  const daysUntil = (nextDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
  return {
    earningsSoon: daysUntil <= windowDays,
    earningsDate: nextDate.toISOString().slice(0, 10),
    availability: "可得",
  };
}

export function computeFundamentalFlags(
  raw: RawFundamentalsData,
  config: FundamentalsConfig,
  now: Date = new Date(),
): Omit<FundamentalsSlice, "symbol" | "fetchedAt"> {
  const c = config.fundamentals;
  const revenue = revenueGrowthFlag(raw.annualFinancials, c.revenueGrowthAccelDecelEpsilon);
  const margin = grossMarginFlag(raw.quarterlyFinancials, c.grossMarginFlatEpsilon);
  const profitability = profitabilityFlag(raw.quarterlyFinancials);
  const leverage = leverageFlag(raw.totalCash, raw.totalDebt, c.highLeverageDebtToCashRatio);
  const earnings = earningsSoonFlag(raw.earningsDates, now, c.earningsSoonWindowDays);

  return {
    revenueGrowthFlag: revenue.flag,
    revenueGrowthFlagAvailability: revenue.availability,
    grossMarginFlag: margin.flag,
    grossMarginFlagAvailability: margin.availability,
    profitabilityFlag: profitability.flag,
    profitabilityFlagAvailability: profitability.availability,
    leverageFlag: leverage.flag,
    leverageFlagAvailability: leverage.availability,
    totalCash: raw.totalCash,
    totalDebt: raw.totalDebt,
    earningsSoon: earnings.earningsSoon,
    earningsDate: earnings.earningsDate,
    earningsDateAvailability: earnings.availability,
  };
}
