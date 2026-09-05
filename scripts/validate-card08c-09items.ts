import "dotenv/config";
import { runScreen, writeScreenOutput } from "../src/screen/pipeline.js";

/**
 * Live validation for TASK_CARD_08 Part C (市场宽度) and
 * TASK_CARD_09_STANDBY Part A items 5-7 (ADX / 进场结构 / 集中度警示).
 * Same shape as scripts/validate-card10.ts: a real full run, but the
 * Supabase push is deliberately NOT called - this is a code-validation
 * run, not a run meant to appear in Cockpit/Stockpit's shared history.
 */
async function main(): Promise<void> {
  console.error(`[validate] starting live run, profile=both (Supabase push intentionally skipped)`);
  const result = await runScreen("both");
  const path = writeScreenOutput(result);

  const b = result.runMeta.breadth;
  console.error(`\n===== TASK_CARD_08 Part C - 市场宽度 =====`);
  console.error(`state: ${b.state}${b.stateUnavailableReason ? ` (${b.stateUnavailableReason})` : ""}`);
  console.error(`pctAboveSma200: ${b.pctAboveSma200 === null ? "不可得" : b.pctAboveSma200.toFixed(2)}% (sample ${b.sma200SampleSize})`);
  console.error(`pctAboveSma50: ${b.pctAboveSma50 === null ? "不可得" : b.pctAboveSma50.toFixed(2)}% (sample ${b.sma50SampleSize})`);
  console.error(`newHigh/newLow: ${b.newHighCount} / ${b.newLowCount} (ratio ${b.newHighLowRatio === null ? "不可得" : b.newHighLowRatio.toFixed(2)})`);
  console.error(`breadthDivergence: ${b.breadthDivergence} (SPY vs SMA200: ${result.runMeta.marketRegime.spyCloseVsSma200})`);

  console.error(`\n===== TASK_CARD_09_STANDBY item 7 - 候选集中度 =====`);
  if (result.runMeta.concentrationWarnings.length === 0) {
    console.error(`no sector reached the threshold this run`);
  }
  for (const w of result.runMeta.concentrationWarnings) {
    console.error(`  ${w.sector}: ${w.count} - ${w.symbols.join(", ")}`);
  }

  console.error(`\n===== TASK_CARD_09_STANDBY items 5-6 - ADX / 进场结构 =====`);
  const withAdx = result.symbols.filter((s) => s.flags.adx14 !== null);
  const trending = withAdx.filter((s) => s.flags.adx14! > 25).length;
  const rangeBound = withAdx.filter((s) => s.flags.adx14! < 20).length;
  console.error(`adx14 computed for ${withAdx.length}/${result.symbols.length} symbols (>25 trending: ${trending}, <20 range-bound: ${rangeBound})`);
  const structures = result.symbols.reduce<Record<string, number>>((acc, s) => {
    const key = s.flags.entryStructure ?? "null";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  console.error(`entryStructure distribution (full universe): ${JSON.stringify(structures)}`);

  const momentumCandidates = result.selection.candidates.filter((c) => c.allBucketsHit.includes("momentum_breakout"));
  console.error(`momentum-bucket candidates this run: ${momentumCandidates.length}`);
  for (const c of momentumCandidates) {
    const s = result.symbols.find((x) => x.symbol === c.symbol)!;
    console.error(`  ${c.symbol}: adx14=${s.flags.adx14?.toFixed(2) ?? "不可得"} entryStructure=${s.flags.entryStructure ?? "不可得"}`);
  }

  console.error(`\ncandidates: ${result.selection.candidates.map((c) => `${c.symbol}(${c.primaryBucket})`).join(", ")}`);
  console.error(`output written to ${path}`);
}

main().catch((err) => {
  console.error(`[validate] fatal error: ${(err as Error).stack ?? err}`);
  process.exit(1);
});
