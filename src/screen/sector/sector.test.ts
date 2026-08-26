import { test } from "node:test";
import assert from "node:assert/strict";
import { rankSectors } from "./sectorStrength.js";
import type { SectorConfig, SectorReturns } from "./types.js";

const config: SectorConfig = {
  sector: { oneWeekTradingDays: 5, oneMonthTradingDays: 21, threeMonthTradingDays: 63, tailwindRankCount: 1, headwindRankCount: 1 },
};

test("rankSectors: hand-computed composite rank and tailwind/headwind classification", () => {
  const returns: SectorReturns[] = [
    { sector: "A", etf: "XLA", oneWeekReturn: 0.03, oneMonthReturn: 0.1, threeMonthReturn: 0.2 }, // 1mo rank1, 3mo rank1 -> composite 1
    { sector: "B", etf: "XLB", oneWeekReturn: 0.02, oneMonthReturn: 0.05, threeMonthReturn: 0.15 }, // 1mo rank3, 3mo rank2 -> composite 2.5
    { sector: "C", etf: "XLC", oneWeekReturn: 0.01, oneMonthReturn: 0.08, threeMonthReturn: 0.05 }, // 1mo rank2, 3mo rank3 -> composite 2.5
    { sector: "D", etf: "XLD", oneWeekReturn: -0.01, oneMonthReturn: -0.02, threeMonthReturn: -0.1 }, // 1mo rank4, 3mo rank4 -> composite 4
  ];

  const ranked = rankSectors(returns, config);
  const bySector = new Map(ranked.map((r) => [r.sector, r]));

  assert.equal(bySector.get("A")!.compositeRank, 1);
  assert.equal(bySector.get("A")!.classification, "tailwind");
  assert.equal(bySector.get("B")!.compositeRank, 2);
  assert.equal(bySector.get("B")!.classification, "neutral");
  assert.equal(bySector.get("C")!.compositeRank, 3);
  assert.equal(bySector.get("C")!.classification, "neutral");
  assert.equal(bySector.get("D")!.compositeRank, 4);
  assert.equal(bySector.get("D")!.classification, "headwind");
});

test("rankSectors: sectors with missing returns are excluded from ranking, not fabricated", () => {
  const returns: SectorReturns[] = [
    { sector: "A", etf: "XLA", oneWeekReturn: 0.03, oneMonthReturn: 0.1, threeMonthReturn: 0.2 },
    { sector: "B", etf: "XLB", oneWeekReturn: null, oneMonthReturn: null, threeMonthReturn: 0.15 },
  ];
  const ranked = rankSectors(returns, config);
  const bySector = new Map(ranked.map((r) => [r.sector, r]));

  assert.equal(bySector.get("A")!.compositeRank, 1);
  assert.equal(bySector.get("B")!.compositeRank, null);
  assert.equal(bySector.get("B")!.classification, null);
});
