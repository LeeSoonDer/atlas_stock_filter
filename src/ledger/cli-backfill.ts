import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { appendLedgerEntry, readOutcomeUpdates, readScreeningEntries } from "./ledger.js";
import { buildOutcomeUpdate, findUnresolvedScreenings } from "./backfill.js";
import type { BackfillOutcome } from "./backfill.js";

interface ParsedArgs {
  ticker: string | null;
  outcome: BackfillOutcome | null;
  elapsedDays: number | null;
  screeningTimestamp: string | null;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = { ticker: null, outcome: null, elapsedDays: null, screeningTimestamp: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--ticker") args.ticker = argv[++i]?.toUpperCase() ?? null;
    else if (argv[i] === "--outcome") {
      const v = argv[++i];
      if (v === "repriced" || v === "invalidated" || v === "expired_no_event") args.outcome = v;
    } else if (argv[i] === "--elapsed-days") args.elapsedDays = Number(argv[++i]);
    else if (argv[i] === "--screening-timestamp") args.screeningTimestamp = argv[++i] ?? null;
  }
  return args;
}

/**
 * TASK_CARD_05 SCOPE 6: `npm run ledger:backfill -- --ticker X`.
 * Non-interactive when --outcome/--elapsed-days are provided (useful
 * for scripting and testing); otherwise prompts via readline. Never
 * edits the original screening entry - always appends a new
 * OutcomeUpdateLedgerEntry (MUST-NOT: "删除或修改历史账本条目").
 */
async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.ticker) {
    console.error("Usage: npm run ledger:backfill -- --ticker <SYMBOL> [--outcome repriced|invalidated|expired_no_event] [--elapsed-days N] [--screening-timestamp <iso>]");
    process.exitCode = 1;
    return;
  }

  const screenings = readScreeningEntries();
  const outcomes = readOutcomeUpdates();
  const resolvedTimestamps = new Set(outcomes.filter((o) => o.symbol === args.ticker).map((o) => o.refersToScreeningTimestamp));
  const unresolved = findUnresolvedScreenings(args.ticker, screenings, resolvedTimestamps);

  if (unresolved.length === 0) {
    console.log(`No unresolved screening entries found for ${args.ticker}.`);
    return;
  }

  let target = unresolved[0];
  if (args.screeningTimestamp) {
    const match = unresolved.find((s) => s.screeningTimestamp === args.screeningTimestamp);
    if (!match) {
      console.error(`No unresolved entry for ${args.ticker} at screeningTimestamp=${args.screeningTimestamp}.`);
      process.exitCode = 1;
      return;
    }
    target = match;
  } else if (unresolved.length > 1 && args.outcome !== null) {
    console.log(`${unresolved.length} unresolved entries for ${args.ticker}; backfilling the oldest (${target.screeningTimestamp}). Pass --screening-timestamp to pick a different one.`);
  }

  let outcome = args.outcome;
  let elapsedDays = args.elapsedDays;

  if (outcome === null || elapsedDays === null || Number.isNaN(elapsedDays)) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
      console.log(`Backfilling ${args.ticker} (screened ${target.screeningTimestamp}, status=${target.status}, bucket=${target.opportunityType ?? "none"})`);
      if (unresolved.length > 1) {
        console.log(`Note: ${unresolved.length} unresolved entries exist for this ticker; backfilling the oldest.`);
      }
      if (outcome === null) {
        const answer = (await rl.question("Outcome? (1=repriced 2=invalidated 3=expired_no_event): ")).trim();
        outcome = answer === "1" ? "repriced" : answer === "2" ? "invalidated" : answer === "3" ? "expired_no_event" : null;
      }
      if (outcome === null) {
        console.error("Invalid outcome selection.");
        process.exitCode = 1;
        return;
      }
      if (elapsedDays === null || Number.isNaN(elapsedDays)) {
        const answer = (await rl.question("Actual elapsed days: ")).trim();
        elapsedDays = Number(answer);
      }
    } finally {
      rl.close();
    }
  }

  if (elapsedDays === null || Number.isNaN(elapsedDays)) {
    console.error("Invalid elapsed days.");
    process.exitCode = 1;
    return;
  }

  const entry = buildOutcomeUpdate(args.ticker, target.screeningTimestamp, outcome, elapsedDays);
  appendLedgerEntry(entry);
  console.log(`Appended outcome_update: ${args.ticker} ${outcome} (${elapsedDays} days), referencing screening ${target.screeningTimestamp}.`);
}

main();
