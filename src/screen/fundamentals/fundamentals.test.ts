import { test } from "node:test";
import assert from "node:assert/strict";
import { computeFundamentalFlags } from "./computeFundamentalFlags.js";
import type { RawFundamentalsData, RawPeriod, RawCashFlowPeriod, RawBalanceSheetPeriod } from "./types.js";
import type { QualityFlagsConfig } from "./computeFundamentalFlags.js";
import type { FundamentalsConfig } from "./types.js";

const config: FundamentalsConfig & QualityFlagsConfig = {
  fundamentals: {
    revenueGrowthAccelDecelEpsilon: 0.02,
    grossMarginFlatEpsilon: 0.001,
    highLeverageDebtToCashRatio: 3,
    earningsSoonWindowDays: 14,
    accrualQualityThreshold: 0.1,
    cashRunwayThresholdMonths: 12,
  },
};

function period(dateStr: string, fields: Partial<RawPeriod> = {}): RawPeriod {
  return { date: new Date(dateStr), ...fields };
}

function cfPeriod(dateStr: string, operatingCashFlow?: number): RawCashFlowPeriod {
  return { date: new Date(dateStr), operatingCashFlow };
}

function bsPeriod(dateStr: string, fields: Partial<RawBalanceSheetPeriod> = {}): RawBalanceSheetPeriod {
  return { date: new Date(dateStr), ...fields };
}

function baseRaw(overrides: Partial<RawFundamentalsData> = {}): RawFundamentalsData {
  return {
    quarterlyFinancials: [],
    annualFinancials: [],
    quarterlyCashFlow: [],
    quarterlyBalanceSheet: [],
    earningsDates: [],
    ...overrides,
  };
}

test("revenue growth: accelerating (this year's YoY > last year's YoY by more than epsilon)", () => {
  // yearBefore=100, lastYear=110 (10% growth), thisYear=132 (20% growth) -> accelerating
  const raw = baseRaw({
    annualFinancials: [
      period("2023-01-01", { totalRevenue: 100 }),
      period("2024-01-01", { totalRevenue: 110 }),
      period("2025-01-01", { totalRevenue: 132 }),
    ],
  });
  const result = computeFundamentalFlags(raw, config, "STANDARD");
  assert.equal(result.revenueGrowthFlagAvailability, "可得");
  assert.equal(result.revenueGrowthFlag, "accelerating");
});

test("revenue growth: decelerating", () => {
  // yearBefore=100, lastYear=130 (30% growth), thisYear=143 (10% growth) -> decelerating
  const raw = baseRaw({
    annualFinancials: [
      period("2023-01-01", { totalRevenue: 100 }),
      period("2024-01-01", { totalRevenue: 130 }),
      period("2025-01-01", { totalRevenue: 143 }),
    ],
  });
  const result = computeFundamentalFlags(raw, config, "STANDARD");
  assert.equal(result.revenueGrowthFlag, "decelerating");
});

test("revenue growth: negative growth (latest YoY < 0)", () => {
  const raw = baseRaw({
    annualFinancials: [
      period("2023-01-01", { totalRevenue: 100 }),
      period("2024-01-01", { totalRevenue: 110 }),
      period("2025-01-01", { totalRevenue: 90 }),
    ],
  });
  const result = computeFundamentalFlags(raw, config, "STANDARD");
  assert.equal(result.revenueGrowthFlag, "negative_growth");
});

test("revenue growth: stable (YoY rates within epsilon of each other)", () => {
  // lastYearGrowth=10%, thisYearGrowth=10.5% -> within 0.02 epsilon
  const raw = baseRaw({
    annualFinancials: [
      period("2023-01-01", { totalRevenue: 100 }),
      period("2024-01-01", { totalRevenue: 110 }),
      period("2025-01-01", { totalRevenue: 121.55 }),
    ],
  });
  const result = computeFundamentalFlags(raw, config, "STANDARD");
  assert.equal(result.revenueGrowthFlag, "stable");
});

test("revenue growth: unavailable with fewer than 3 periods", () => {
  const raw = baseRaw({
    annualFinancials: [period("2024-01-01", { totalRevenue: 100 }), period("2025-01-01", { totalRevenue: 110 })],
  });
  const result = computeFundamentalFlags(raw, config, "STANDARD");
  assert.equal(result.revenueGrowthFlagAvailability, "不可得");
  assert.equal(result.revenueGrowthFlag, undefined);
});

test("gross margin: improved and worsened", () => {
  const improved = computeFundamentalFlags(
    baseRaw({
      quarterlyFinancials: [
        period("q1", { totalRevenue: 100, grossProfit: 40 }), // 40%
        period("q2", { totalRevenue: 100, grossProfit: 45 }), // 45%
      ],
    }),
    config,
    "STANDARD",
  );
  assert.equal(improved.grossMarginFlag, "improved");

  const worsened = computeFundamentalFlags(
    baseRaw({
      quarterlyFinancials: [
        period("q1", { totalRevenue: 100, grossProfit: 45 }),
        period("q2", { totalRevenue: 100, grossProfit: 40 }),
      ],
    }),
    config,
    "STANDARD",
  );
  assert.equal(worsened.grossMarginFlag, "worsened");
});

test("profitability: profitable, loss_narrowing, loss_widening, and profit-to-loss swing", () => {
  const profitable = computeFundamentalFlags(
    baseRaw({ quarterlyFinancials: [period("q1", { netIncome: -5 }), period("q2", { netIncome: 10 })] }),
    config,
    "STANDARD",
  );
  assert.equal(profitable.profitabilityFlag, "profitable");

  const narrowing = computeFundamentalFlags(
    baseRaw({ quarterlyFinancials: [period("q1", { netIncome: -20 }), period("q2", { netIncome: -5 })] }),
    config,
    "STANDARD",
  );
  assert.equal(narrowing.profitabilityFlag, "loss_narrowing");

  const widening = computeFundamentalFlags(
    baseRaw({ quarterlyFinancials: [period("q1", { netIncome: -5 }), period("q2", { netIncome: -20 })] }),
    config,
    "STANDARD",
  );
  assert.equal(widening.profitabilityFlag, "loss_widening");

  const swingToLoss = computeFundamentalFlags(
    baseRaw({ quarterlyFinancials: [period("q1", { netIncome: 10 }), period("q2", { netIncome: -5 })] }),
    config,
    "STANDARD",
  );
  assert.equal(swingToLoss.profitabilityFlag, "loss_widening");
});

test("leverage: net_cash, manageable, high_leverage", () => {
  const netCash = computeFundamentalFlags(baseRaw({ totalCash: 100, totalDebt: 50 }), config, "STANDARD");
  assert.equal(netCash.leverageFlag, "net_cash");

  const manageable = computeFundamentalFlags(baseRaw({ totalCash: 100, totalDebt: 200 }), config, "STANDARD"); // ratio 2 < 3
  assert.equal(manageable.leverageFlag, "manageable");

  const highLeverage = computeFundamentalFlags(baseRaw({ totalCash: 100, totalDebt: 400 }), config, "STANDARD"); // ratio 4 >= 3
  assert.equal(highLeverage.leverageFlag, "high_leverage");

  const noCashAtAll = computeFundamentalFlags(baseRaw({ totalCash: 0, totalDebt: 10 }), config, "STANDARD");
  assert.equal(noCashAtAll.leverageFlag, "high_leverage");
});

test("earnings soon: within window, outside window, and none scheduled", () => {
  const now = new Date("2026-01-01T00:00:00Z");

  const soon = computeFundamentalFlags(
    baseRaw({ earningsDates: [new Date("2026-01-10T00:00:00Z")] }), // 9 days out
    config,
    "STANDARD",
    now,
  );
  assert.equal(soon.earningsSoon, true);
  assert.equal(soon.earningsDate, "2026-01-10");

  const notSoon = computeFundamentalFlags(
    baseRaw({ earningsDates: [new Date("2026-03-01T00:00:00Z")] }), // ~59 days out
    config,
    "STANDARD",
    now,
  );
  assert.equal(notSoon.earningsSoon, false);

  const none = computeFundamentalFlags(baseRaw({ earningsDates: [] }), config, "STANDARD", now);
  assert.equal(none.earningsDateAvailability, "不可得");
  assert.equal(none.earningsSoon, false);

  // a past-only earnings date should be ignored (not treated as "soon")
  const pastOnly = computeFundamentalFlags(
    baseRaw({ earningsDates: [new Date("2025-01-01T00:00:00Z")] }),
    config,
    "STANDARD",
    now,
  );
  assert.equal(pastOnly.earningsDateAvailability, "不可得");
});

// --- TASK_CARD_09 Part C ---

test("accrual quality: matching-period netIncome/operatingCashFlow/totalAssets -> ratio computed, flag over threshold", () => {
  const raw = baseRaw({
    quarterlyFinancials: [period("2026-06-30", { netIncome: 50 })],
    quarterlyCashFlow: [cfPeriod("2026-06-30", 10)], // netIncome(50) - OCF(10) = 40
    quarterlyBalanceSheet: [bsPeriod("2026-06-30", { totalAssets: 200 })], // 40/200 = 0.2, threshold 0.1
  });
  const result = computeFundamentalFlags(raw, config, "STANDARD");
  assert.equal(result.accrualFlagAvailability, "可得");
  assert.ok(result.accrualRatio !== undefined && Math.abs(result.accrualRatio - 0.2) < 1e-9);
  assert.equal(result.accrualFlag, true);
});

test("accrual quality: ratio at or below threshold -> flag false, not flagged", () => {
  const raw = baseRaw({
    quarterlyFinancials: [period("2026-06-30", { netIncome: 15 })],
    quarterlyCashFlow: [cfPeriod("2026-06-30", 5)], // 10/200 = 0.05 < 0.1
    quarterlyBalanceSheet: [bsPeriod("2026-06-30", { totalAssets: 200 })],
  });
  const result = computeFundamentalFlags(raw, config, "STANDARD");
  assert.equal(result.accrualFlag, false);
});

test("accrual quality: no period has all 3 values on the same date -> 不可得, not a guessed match across different dates", () => {
  const raw = baseRaw({
    quarterlyFinancials: [period("2026-06-30", { netIncome: 50 })],
    quarterlyCashFlow: [cfPeriod("2026-03-31", 10)], // different quarter
    quarterlyBalanceSheet: [bsPeriod("2026-06-30", { totalAssets: 200 })],
  });
  const result = computeFundamentalFlags(raw, config, "STANDARD");
  assert.equal(result.accrualFlagAvailability, "不可得");
  assert.equal(result.accrualFlag, undefined);
});

test("accrual quality: falls back to an EARLIER matching quarter when the latest quarter is missing a value", () => {
  const raw = baseRaw({
    quarterlyFinancials: [
      period("2026-03-31", { netIncome: 30 }),
      period("2026-06-30", { netIncome: 50 }), // latest, but no matching cash-flow/balance-sheet period below
    ],
    quarterlyCashFlow: [cfPeriod("2026-03-31", 5)], // 25/100 = 0.25
    quarterlyBalanceSheet: [bsPeriod("2026-03-31", { totalAssets: 100 })],
  });
  const result = computeFundamentalFlags(raw, config, "STANDARD");
  assert.equal(result.accrualFlagAvailability, "可得");
  assert.ok(result.accrualRatio !== undefined && Math.abs(result.accrualRatio - 0.25) < 1e-9);
});

test("cash runway: STANDARD profile -> not evaluated at all (undefined, not 不可得)", () => {
  const raw = baseRaw({
    quarterlyBalanceSheet: [bsPeriod("2026-06-30", { cashAndCashEquivalents: 1000 })],
    quarterlyCashFlow: [cfPeriod("q1", -100), cfPeriod("q2", -100), cfPeriod("q3", -100), cfPeriod("q4", -100)],
  });
  const result = computeFundamentalFlags(raw, config, "STANDARD");
  assert.equal(result.cashRunwayMonths, undefined);
  assert.equal(result.cashRunwayAvailability, undefined);
  assert.equal(result.dilutionRisk, undefined);
});

test("cash runway: SMALL_SPEC with fewer than 4 quarters of operatingCashFlow -> 不可得, no partial guess", () => {
  const raw = baseRaw({
    quarterlyBalanceSheet: [bsPeriod("2026-06-30", { cashAndCashEquivalents: 1000 })],
    quarterlyCashFlow: [cfPeriod("2026-06-30", -100), cfPeriod("2026-03-31", -100)],
  });
  const result = computeFundamentalFlags(raw, config, "SMALL_SPEC");
  assert.equal(result.cashRunwayAvailability, "不可得");
  assert.equal(result.cashRunwayMonths, null);
});

test("cash runway: SMALL_SPEC, burning cash, 4 quarters available -> months computed, dilutionRisk true when under threshold", () => {
  const raw = baseRaw({
    quarterlyBalanceSheet: [bsPeriod("2026-06-30", { cashAndCashEquivalents: 1200 })],
    quarterlyCashFlow: [
      cfPeriod("2026-06-30", -100),
      cfPeriod("2026-03-31", -100),
      cfPeriod("2025-12-31", -100),
      cfPeriod("2025-09-30", -100),
    ], // trailing 4Q sum = -400, monthly burn = 400/12 = 33.33, runway = 1200/33.33 = 36 months
  });
  const result = computeFundamentalFlags(raw, config, "SMALL_SPEC");
  assert.equal(result.cashRunwayAvailability, "可得");
  assert.ok(result.cashRunwayMonths !== null && result.cashRunwayMonths !== undefined && Math.abs(result.cashRunwayMonths - 36) < 1e-6);
  assert.equal(result.dilutionRisk, false); // 36 months >= 12-month threshold
});

test("cash runway: SMALL_SPEC, burning cash, runway below the configured threshold -> dilutionRisk true", () => {
  const raw = baseRaw({
    quarterlyBalanceSheet: [bsPeriod("2026-06-30", { cashAndCashEquivalents: 100 })],
    quarterlyCashFlow: [
      cfPeriod("2026-06-30", -100),
      cfPeriod("2026-03-31", -100),
      cfPeriod("2025-12-31", -100),
      cfPeriod("2025-09-30", -100),
    ], // monthly burn = 33.33, runway = 100/33.33 = 3 months < 12
  });
  const result = computeFundamentalFlags(raw, config, "SMALL_SPEC");
  assert.equal(result.dilutionRisk, true);
});

test("cash runway: SMALL_SPEC, cash-flow-positive over the trailing 4 quarters -> months null (formula doesn't apply), still 可得, no penalty", () => {
  const raw = baseRaw({
    quarterlyBalanceSheet: [bsPeriod("2026-06-30", { cashAndCashEquivalents: 500 })],
    quarterlyCashFlow: [
      cfPeriod("2026-06-30", 50),
      cfPeriod("2026-03-31", 50),
      cfPeriod("2025-12-31", 50),
      cfPeriod("2025-09-30", 50),
    ], // trailing sum = 200 >= 0, not burning
  });
  const result = computeFundamentalFlags(raw, config, "SMALL_SPEC");
  assert.equal(result.cashRunwayAvailability, "可得");
  assert.equal(result.cashRunwayMonths, null);
  assert.equal(result.dilutionRisk, false);
});
