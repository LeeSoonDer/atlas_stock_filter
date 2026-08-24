import { test } from "node:test";
import assert from "node:assert/strict";
import { computeFundamentalFlags } from "./computeFundamentalFlags.js";
import type { RawFundamentalsData, RawPeriod } from "./types.js";
import type { FundamentalsConfig } from "./types.js";

const config: FundamentalsConfig = {
  fundamentals: {
    revenueGrowthAccelDecelEpsilon: 0.02,
    grossMarginFlatEpsilon: 0.001,
    highLeverageDebtToCashRatio: 3,
    earningsSoonWindowDays: 14,
  },
};

function period(dateStr: string, fields: Partial<RawPeriod> = {}): RawPeriod {
  return { date: new Date(dateStr), ...fields };
}

function baseRaw(overrides: Partial<RawFundamentalsData> = {}): RawFundamentalsData {
  return {
    quarterlyFinancials: [],
    annualFinancials: [],
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
  const result = computeFundamentalFlags(raw, config);
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
  const result = computeFundamentalFlags(raw, config);
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
  const result = computeFundamentalFlags(raw, config);
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
  const result = computeFundamentalFlags(raw, config);
  assert.equal(result.revenueGrowthFlag, "stable");
});

test("revenue growth: unavailable with fewer than 3 periods", () => {
  const raw = baseRaw({
    annualFinancials: [period("2024-01-01", { totalRevenue: 100 }), period("2025-01-01", { totalRevenue: 110 })],
  });
  const result = computeFundamentalFlags(raw, config);
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
  );
  assert.equal(worsened.grossMarginFlag, "worsened");
});

test("profitability: profitable, loss_narrowing, loss_widening, and profit-to-loss swing", () => {
  const profitable = computeFundamentalFlags(
    baseRaw({ quarterlyFinancials: [period("q1", { netIncome: -5 }), period("q2", { netIncome: 10 })] }),
    config,
  );
  assert.equal(profitable.profitabilityFlag, "profitable");

  const narrowing = computeFundamentalFlags(
    baseRaw({ quarterlyFinancials: [period("q1", { netIncome: -20 }), period("q2", { netIncome: -5 })] }),
    config,
  );
  assert.equal(narrowing.profitabilityFlag, "loss_narrowing");

  const widening = computeFundamentalFlags(
    baseRaw({ quarterlyFinancials: [period("q1", { netIncome: -5 }), period("q2", { netIncome: -20 })] }),
    config,
  );
  assert.equal(widening.profitabilityFlag, "loss_widening");

  const swingToLoss = computeFundamentalFlags(
    baseRaw({ quarterlyFinancials: [period("q1", { netIncome: 10 }), period("q2", { netIncome: -5 })] }),
    config,
  );
  assert.equal(swingToLoss.profitabilityFlag, "loss_widening");
});

test("leverage: net_cash, manageable, high_leverage", () => {
  const netCash = computeFundamentalFlags(baseRaw({ totalCash: 100, totalDebt: 50 }), config);
  assert.equal(netCash.leverageFlag, "net_cash");

  const manageable = computeFundamentalFlags(baseRaw({ totalCash: 100, totalDebt: 200 }), config); // ratio 2 < 3
  assert.equal(manageable.leverageFlag, "manageable");

  const highLeverage = computeFundamentalFlags(baseRaw({ totalCash: 100, totalDebt: 400 }), config); // ratio 4 >= 3
  assert.equal(highLeverage.leverageFlag, "high_leverage");

  const noCashAtAll = computeFundamentalFlags(baseRaw({ totalCash: 0, totalDebt: 10 }), config);
  assert.equal(noCashAtAll.leverageFlag, "high_leverage");
});

test("earnings soon: within window, outside window, and none scheduled", () => {
  const now = new Date("2026-01-01T00:00:00Z");

  const soon = computeFundamentalFlags(
    baseRaw({ earningsDates: [new Date("2026-01-10T00:00:00Z")] }), // 9 days out
    config,
    now,
  );
  assert.equal(soon.earningsSoon, true);
  assert.equal(soon.earningsDate, "2026-01-10");

  const notSoon = computeFundamentalFlags(
    baseRaw({ earningsDates: [new Date("2026-03-01T00:00:00Z")] }), // ~59 days out
    config,
    now,
  );
  assert.equal(notSoon.earningsSoon, false);

  const none = computeFundamentalFlags(baseRaw({ earningsDates: [] }), config, now);
  assert.equal(none.earningsDateAvailability, "不可得");
  assert.equal(none.earningsSoon, false);

  // a past-only earnings date should be ignored (not treated as "soon")
  const pastOnly = computeFundamentalFlags(
    baseRaw({ earningsDates: [new Date("2025-01-01T00:00:00Z")] }),
    config,
    now,
  );
  assert.equal(pastOnly.earningsDateAvailability, "不可得");
});
