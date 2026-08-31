import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregateInsiderClusters } from "./aggregateInsiderClusters.js";
import type { ParsedForm4Filing, Form4ReportingOwner } from "./types.js";
import type { InsiderWeightingConfig } from "./insiderWeighting.js";

function owner(cik: string, overrides: Partial<Form4ReportingOwner> = {}): Form4ReportingOwner {
  return { cik, name: `Owner ${cik}`, isDirector: false, isOfficer: false, isTenPercentOwner: false, officerTitle: null, ...overrides };
}

function filing(overrides: Partial<ParsedForm4Filing>): ParsedForm4Filing {
  return {
    accessionPath: "edgar/data/1/x.txt",
    ticker: "TEST",
    cik: "1",
    dateFiled: "2026-08-01",
    periodOfReport: null,
    reportingOwners: [owner("100")],
    transactions: [{ transactionCode: "P", shares: 100, pricePerShare: 10 }], // $1,000 - below significantAmountUsd
    fetchedAt: "2026-08-24T00:00:00Z",
    ...overrides,
  };
}

const config: InsiderWeightingConfig = {
  insiderWeighting: {
    topExecWeight: 2.0,
    otherOfficerWeight: 1.5,
    directorWeight: 1.0,
    otherWeight: 1.0,
    significantAmountUsd: 100_000,
    significantMultiplier: 1.5,
    clusterMinWeightedScore: 2.0,
  },
};

const NOW = new Date("2026-08-24T00:00:00Z");

test("aggregateInsiderClusters: 2 distinct plain buyers (weight 1.0 each) -> weightedScore 2.0, insiderCluster true", () => {
  const filings = [
    filing({ dateFiled: "2026-08-01", reportingOwners: [owner("100")] }),
    filing({ dateFiled: "2026-08-10", reportingOwners: [owner("200")] }),
  ];
  const result = aggregateInsiderClusters(filings, 90, config, NOW);
  const test1 = result.get("TEST")!;
  assert.equal(test1.distinctBuyerCount, 2);
  assert.equal(test1.weightedScore, 2.0);
  assert.equal(test1.insiderCluster, true);
  assert.equal(test1.mostRecentPurchaseDate, "2026-08-10");
});

test("aggregateInsiderClusters: same buyer twice does not double-count (MAX weight, not summed)", () => {
  const filings = [
    filing({ dateFiled: "2026-08-01", reportingOwners: [owner("100")] }),
    filing({ dateFiled: "2026-08-10", reportingOwners: [owner("100")] }),
  ];
  const result = aggregateInsiderClusters(filings, 90, config, NOW);
  assert.equal(result.get("TEST")!.distinctBuyerCount, 1);
  assert.equal(result.get("TEST")!.weightedScore, 1.0);
  assert.equal(result.get("TEST")!.insiderCluster, false);
});

test("aggregateInsiderClusters: sale-only filing (no P transaction) is excluded", () => {
  const filings = [
    filing({ dateFiled: "2026-08-01", reportingOwners: [owner("100")] }),
    filing({ dateFiled: "2026-08-10", reportingOwners: [owner("200")], transactions: [{ transactionCode: "S", shares: 50, pricePerShare: 5 }] }),
  ];
  const result = aggregateInsiderClusters(filings, 90, config, NOW);
  assert.equal(result.get("TEST")!.distinctBuyerCount, 1);
});

test("aggregateInsiderClusters: filing outside the lookback window is excluded", () => {
  const filings = [
    filing({ dateFiled: "2026-08-01", reportingOwners: [owner("100")] }),
    filing({ dateFiled: "2026-01-01", reportingOwners: [owner("200")] }), // > 90 days before NOW
  ];
  const result = aggregateInsiderClusters(filings, 90, config, NOW);
  assert.equal(result.get("TEST")!.distinctBuyerCount, 1);
  assert.equal(result.get("TEST")!.insiderCluster, false);
});

test("aggregateInsiderClusters: lagDays computed correctly from most recent purchase", () => {
  const filings = [filing({ dateFiled: "2026-08-14" })]; // 10 days before NOW
  const result = aggregateInsiderClusters(filings, 90, config, NOW);
  assert.equal(result.get("TEST")!.lagDays, 10);
});

// --- TASK_CARD_09 Part A weighted-scoring behavior ---

test("weighted scoring: a single CEO purchase alone reaches clusterMinWeightedScore (2.0) - one top exec counts as much as 2 plain buyers", () => {
  const filings = [
    filing({
      dateFiled: "2026-08-01",
      reportingOwners: [owner("100", { isOfficer: true, officerTitle: "Chief Executive Officer" })],
    }),
  ];
  const result = aggregateInsiderClusters(filings, 90, config, NOW);
  const r = result.get("TEST")!;
  assert.equal(r.distinctBuyerCount, 1);
  assert.equal(r.weightedScore, 2.0);
  assert.equal(r.insiderCluster, true);
});

test("weighted scoring: a Co-CEO title (free text) matches the top-exec tier via substring", () => {
  const filings = [filing({ reportingOwners: [owner("100", { isOfficer: true, officerTitle: "Co-Chief Executive Officer" })] })];
  const result = aggregateInsiderClusters(filings, 90, config, NOW);
  assert.equal(result.get("TEST")!.weightedScore, 2.0);
});

test("weighted scoring: a non-CEO/CFO/COO officer gets the 1.5 tier, not 2.0", () => {
  const filings = [filing({ reportingOwners: [owner("100", { isOfficer: true, officerTitle: "EVP, General Counsel" })] })];
  const result = aggregateInsiderClusters(filings, 90, config, NOW);
  assert.equal(result.get("TEST")!.weightedScore, 1.5);
});

test("weighted scoring: a director-only (not officer) owner gets the 1.0 tier", () => {
  const filings = [filing({ reportingOwners: [owner("100", { isDirector: true })] })];
  const result = aggregateInsiderClusters(filings, 90, config, NOW);
  assert.equal(result.get("TEST")!.weightedScore, 1.0);
});

test("weighted scoring: a purchase >= $100k gets the 1.5x significance multiplier on top of role weight", () => {
  const filings = [
    filing({
      reportingOwners: [owner("100", { isDirector: true })], // base weight 1.0
      transactions: [{ transactionCode: "P", shares: 10_000, pricePerShare: 15 }], // $150,000 >= threshold
    }),
  ];
  const result = aggregateInsiderClusters(filings, 90, config, NOW);
  assert.equal(result.get("TEST")!.weightedScore, 1.5); // 1.0 * 1.5
});

test("weighted scoring: a purchase just under $100k does NOT get the significance multiplier", () => {
  const filings = [
    filing({
      reportingOwners: [owner("100", { isDirector: true })],
      transactions: [{ transactionCode: "P", shares: 9_999, pricePerShare: 10 }], // $99,990 < threshold
    }),
  ];
  const result = aggregateInsiderClusters(filings, 90, config, NOW);
  assert.equal(result.get("TEST")!.weightedScore, 1.0);
});

test("weighted scoring: joint filing (multiple owners, no per-owner transaction attribution) weights every named owner by the filing's largest P transaction", () => {
  const filings = [
    filing({
      reportingOwners: [owner("100", { isOfficer: true, officerTitle: "Chief Financial Officer" }), owner("200", { isDirector: true })],
      transactions: [
        { transactionCode: "P", shares: 100, pricePerShare: 10 }, // $1,000
        { transactionCode: "P", shares: 10_000, pricePerShare: 20 }, // $200,000 - the largest, used for both owners
      ],
    }),
  ];
  const result = aggregateInsiderClusters(filings, 90, config, NOW);
  const r = result.get("TEST")!;
  assert.equal(r.distinctBuyerCount, 2);
  assert.equal(r.weightedScore, 2.0 * 1.5 + 1.0 * 1.5); // CFO (top exec, significant) + director (significant)
});

test("weighted scoring: missing shares/price never fabricates a dollar amount - no significance multiplier applied", () => {
  const filings = [
    filing({
      reportingOwners: [owner("100", { isDirector: true })],
      transactions: [{ transactionCode: "P", shares: null, pricePerShare: null }],
    }),
  ];
  const result = aggregateInsiderClusters(filings, 90, config, NOW);
  assert.equal(result.get("TEST")!.weightedScore, 1.0);
});
