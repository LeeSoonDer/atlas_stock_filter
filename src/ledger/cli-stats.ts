import "dotenv/config";
import { readOutcomeUpdates, readScreeningEntries } from "./ledger.js";
import { computeLedgerStats } from "./stats.js";

function formatPct(v: number | null): string {
  return v === null ? "不可得" : `${v.toFixed(1)}%`;
}

function main(): void {
  const screenings = readScreeningEntries();
  const outcomes = readOutcomeUpdates();
  const stats = computeLedgerStats(screenings, outcomes);

  console.log("Bucket".padEnd(34), "Total", "Resolved", "Pending", "HitRate", "DeathRate");
  for (const s of stats) {
    console.log(
      s.bucket.padEnd(34),
      String(s.totalCandidates).padEnd(6),
      String(s.resolvedCount).padEnd(9),
      String(s.pendingCount).padEnd(8),
      formatPct(s.hitRate).padEnd(8),
      formatPct(s.deathRate),
    );
  }
}

main();
