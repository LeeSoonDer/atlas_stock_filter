import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregateInsiderClusters } from "./aggregateInsiderClusters.js";
import type { ParsedForm4Filing } from "./types.js";

function filing(overrides: Partial<ParsedForm4Filing>): ParsedForm4Filing {
  return {
    accessionPath: "edgar/data/1/x.txt",
    ticker: "TEST",
    cik: "1",
    dateFiled: "2026-08-01",
    periodOfReport: null,
    reportingOwners: [{ cik: "100", name: "Owner A" }],
    transactions: [{ transactionCode: "P", shares: 100, pricePerShare: 10 }],
    fetchedAt: "2026-08-24T00:00:00Z",
    ...overrides,
  };
}

const NOW = new Date("2026-08-24T00:00:00Z");

test("aggregateInsiderClusters: 2 distinct buyers within window -> insiderCluster true", () => {
  const filings = [
    filing({ dateFiled: "2026-08-01", reportingOwners: [{ cik: "100", name: "A" }] }),
    filing({ dateFiled: "2026-08-10", reportingOwners: [{ cik: "200", name: "B" }] }),
  ];
  const result = aggregateInsiderClusters(filings, 90, 2, NOW);
  const test1 = result.get("TEST")!;
  assert.equal(test1.distinctBuyerCount, 2);
  assert.equal(test1.insiderCluster, true);
  assert.equal(test1.mostRecentPurchaseDate, "2026-08-10");
});

test("aggregateInsiderClusters: same buyer twice does not count as 2 distinct buyers", () => {
  const filings = [
    filing({ dateFiled: "2026-08-01", reportingOwners: [{ cik: "100", name: "A" }] }),
    filing({ dateFiled: "2026-08-10", reportingOwners: [{ cik: "100", name: "A" }] }),
  ];
  const result = aggregateInsiderClusters(filings, 90, 2, NOW);
  assert.equal(result.get("TEST")!.distinctBuyerCount, 1);
  assert.equal(result.get("TEST")!.insiderCluster, false);
});

test("aggregateInsiderClusters: sale-only filing (no P transaction) is excluded", () => {
  const filings = [
    filing({ dateFiled: "2026-08-01", reportingOwners: [{ cik: "100", name: "A" }] }),
    filing({ dateFiled: "2026-08-10", reportingOwners: [{ cik: "200", name: "B" }], transactions: [{ transactionCode: "S", shares: 50, pricePerShare: 5 }] }),
  ];
  const result = aggregateInsiderClusters(filings, 90, 2, NOW);
  assert.equal(result.get("TEST")!.distinctBuyerCount, 1);
});

test("aggregateInsiderClusters: filing outside the lookback window is excluded", () => {
  const filings = [
    filing({ dateFiled: "2026-08-01", reportingOwners: [{ cik: "100", name: "A" }] }),
    filing({ dateFiled: "2026-01-01", reportingOwners: [{ cik: "200", name: "B" }] }), // > 90 days before NOW
  ];
  const result = aggregateInsiderClusters(filings, 90, 2, NOW);
  assert.equal(result.get("TEST")!.distinctBuyerCount, 1);
  assert.equal(result.get("TEST")!.insiderCluster, false);
});

test("aggregateInsiderClusters: lagDays computed correctly from most recent purchase", () => {
  const filings = [filing({ dateFiled: "2026-08-14" })]; // 10 days before NOW
  const result = aggregateInsiderClusters(filings, 90, 1, NOW);
  assert.equal(result.get("TEST")!.lagDays, 10);
});
