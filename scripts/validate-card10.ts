import "dotenv/config";
import { runScreen, writeScreenOutput } from "../src/screen/pipeline.js";

async function main(): Promise<void> {
  console.error(`[validate-card10] starting live run, profile=both (Supabase push intentionally skipped for this validation-only run)`);
  const result = await runScreen("both");
  const path = writeScreenOutput(result);

  console.error(`\n===== TASK_CARD_10 DONE-WHEN spot-check =====`);
  console.error(`gatesPassedCount: ${result.runMeta.gatesPassedCount}`);
  console.error(`vitalityExcludedCount: ${result.runMeta.vitalityExcludedCount}`);
  console.error(`eventDrivenSectors (${result.runMeta.eventDrivenSectors.length}):`);
  for (const e of result.runMeta.eventDrivenSectors) {
    console.error(`  ${e.sector}: leader=${e.leaderTicker} move=${(e.leaderMovePct * 100).toFixed(1)}% date=${e.sectorEventDate}`);
  }
  console.error(`sector_contagion triggeredCount: ${result.runMeta.detectorSummary["sector_contagion"]?.triggeredCount ?? "MISSING"}`);
  console.error(`candidates (${result.selection.candidates.length}):`);
  for (const c of result.selection.candidates) {
    console.error(`  ${c.symbol}: primaryBucket=${c.primaryBucket} score=${c.primaryBucketScore.toFixed(1)}`);
  }
  console.error(`watchlist (${result.selection.watchlist.length}):`);
  for (const w of result.selection.watchlist) {
    console.error(`  ${w.symbol}: reason=${w.reason}`);
  }
  console.error(`\noutput written to ${path}`);
}

main().catch((err) => {
  console.error(`[validate-card10] fatal error: ${(err as Error).stack ?? err}`);
  process.exit(1);
});
