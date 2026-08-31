import type {
  Availability,
  FundamentalsSlice,
  GrossMarginFlag,
  LeverageFlag,
  ProfitabilityFlag,
  RevenueGrowthFlag,
} from "../../data/types.js";
import type { FundamentalsConfig, RawBalanceSheetPeriod, RawCashFlowPeriod, RawFundamentalsData, RawPeriod } from "./types.js";
import type { ProfileName } from "../types.js";

/** TASK_CARD_09 Part C / 修正案十七. */
export interface QualityFlagsConfig {
  fundamentals: {
    accrualQualityThreshold: number;
    cashRunwayThresholdMonths: number;
  };
}

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

/** null for an invalid Date rather than throwing - defensive against malformed upstream period data. */
function isoDate(d: Date): string | null {
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/**
 * TASK_CARD_09 Part C / 修正案十七 "应计质量旗标": (netIncome - operatingCashFlow) / totalAssets
 * for the MOST RECENT quarter that has all three values for the SAME
 * reporting date - not required to be the latest quarter overall (a
 * quarter missing one of the three simply isn't a candidate). No profile
 * restriction (unlike cash runway below) - the card's text doesn't limit
 * this one to SMALL_SPEC.
 */
function accrualQualityFlag(
  netIncomePeriods: RawPeriod[],
  cashFlowPeriods: RawCashFlowPeriod[],
  balanceSheetPeriods: RawBalanceSheetPeriod[],
  threshold: number,
): { flag?: boolean; availability: Availability; ratio?: number } {
  const cashFlowByDate = new Map(
    cashFlowPeriods
      .filter((p) => p.operatingCashFlow !== undefined && isoDate(p.date) !== null)
      .map((p) => [isoDate(p.date) as string, p.operatingCashFlow!]),
  );
  const assetsByDate = new Map(
    balanceSheetPeriods
      .filter((p) => p.totalAssets !== undefined && isoDate(p.date) !== null)
      .map((p) => [isoDate(p.date) as string, p.totalAssets!]),
  );

  const withNetIncome = [...netIncomePeriods].filter((p) => p.netIncome !== undefined).sort((a, b) => b.date.getTime() - a.date.getTime());
  for (const period of withNetIncome) {
    const key = isoDate(period.date);
    if (key === null) continue;
    const ocf = cashFlowByDate.get(key);
    const assets = assetsByDate.get(key);
    if (ocf === undefined || assets === undefined || assets === 0) continue;
    const ratio = (period.netIncome! - ocf) / assets;
    return { flag: ratio > threshold, availability: "可得", ratio };
  }
  return { availability: "不可得" };
}

/**
 * TASK_CARD_09 Part C / 修正案十七 "现金跑道旗标": 现金及等价物 / 过去12个月
 * 平均现金消耗速率, SMALL_SPEC only (caller gates on profile). Requires
 * the latest cashAndCashEquivalents AND the 4 most recent CONSECUTIVE
 * quarters' operatingCashFlow (a genuine trailing-12-month sum, not a
 * partial-quarter estimate) - anything less is 不可得, never a partial
 * guess. A cash-flow-positive company (trailing OCF sum >= 0) has no
 * "burn rate" the card's formula can divide by - `months: null` with
 * availability still 可得 (evaluated, formula doesn't apply), distinct
 * from a genuine data-availability failure.
 */
function cashRunwayFlag(
  cashFlowPeriods: RawCashFlowPeriod[],
  balanceSheetPeriods: RawBalanceSheetPeriod[],
  thresholdMonths: number,
): { months: number | null; availability: Availability; dilutionRisk?: boolean } {
  const withCash = [...balanceSheetPeriods].filter((p) => p.cashAndCashEquivalents !== undefined).sort((a, b) => b.date.getTime() - a.date.getTime());
  const withOcf = [...cashFlowPeriods].filter((p) => p.operatingCashFlow !== undefined).sort((a, b) => b.date.getTime() - a.date.getTime());
  if (withCash.length === 0 || withOcf.length < 4) {
    return { months: null, availability: "不可得" };
  }

  const latestCash = withCash[0].cashAndCashEquivalents!;
  const trailing4 = withOcf.slice(0, 4);
  const trailingOcfSum = trailing4.reduce((a, p) => a + p.operatingCashFlow!, 0);

  if (trailingOcfSum >= 0) {
    return { months: null, availability: "可得", dilutionRisk: false };
  }
  const monthlyBurn = -trailingOcfSum / 12;
  const months = monthlyBurn === 0 ? null : latestCash / monthlyBurn;
  return { months, availability: "可得", dilutionRisk: months !== null && months < thresholdMonths };
}

export function computeFundamentalFlags(
  raw: RawFundamentalsData,
  config: FundamentalsConfig & QualityFlagsConfig,
  profile: ProfileName,
  now: Date = new Date(),
): Omit<FundamentalsSlice, "symbol" | "fetchedAt"> {
  const c = config.fundamentals;
  const revenue = revenueGrowthFlag(raw.annualFinancials, c.revenueGrowthAccelDecelEpsilon);
  const margin = grossMarginFlag(raw.quarterlyFinancials, c.grossMarginFlatEpsilon);
  const profitability = profitabilityFlag(raw.quarterlyFinancials);
  const leverage = leverageFlag(raw.totalCash, raw.totalDebt, c.highLeverageDebtToCashRatio);
  const earnings = earningsSoonFlag(raw.earningsDates, now, c.earningsSoonWindowDays);
  const accrual = accrualQualityFlag(raw.quarterlyFinancials, raw.quarterlyCashFlow, raw.quarterlyBalanceSheet, c.accrualQualityThreshold);

  const base: Omit<FundamentalsSlice, "symbol" | "fetchedAt"> = {
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
    accrualFlag: accrual.flag,
    accrualFlagAvailability: accrual.availability,
    accrualRatio: accrual.ratio,
  };

  if (profile !== "SMALL_SPEC") return base;

  const runway = cashRunwayFlag(raw.quarterlyCashFlow, raw.quarterlyBalanceSheet, c.cashRunwayThresholdMonths);
  return {
    ...base,
    cashRunwayMonths: runway.months,
    cashRunwayAvailability: runway.availability,
    dilutionRisk: runway.dilutionRisk,
  };
}
