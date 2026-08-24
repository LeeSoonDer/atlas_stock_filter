import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import type { LedgerEntry, LedgerStatus, OutcomeUpdateLedgerEntry, ScreeningLedgerEntry } from "./types.js";

export const DEFAULT_LEDGER_PATH = "output/ledger.jsonl";

/**
 * Append-only write for either record type. No read/update/delete of an
 * existing line is exposed by design - the constitution requires
 * permanent archival with no post-hoc deletion or selective retention
 * (Amendment No.2, 修正案五; this card's own MUST-NOT).
 */
export function appendLedgerEntry(entry: LedgerEntry, path: string = DEFAULT_LEDGER_PATH): void {
  const dir = dirname(path);
  if (dir && !existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  appendFileSync(path, `${JSON.stringify(entry)}\n`, "utf-8");
}

export function readAllLedgerEntries(path: string = DEFAULT_LEDGER_PATH): LedgerEntry[] {
  if (!existsSync(path)) return [];
  const text = readFileSync(path, "utf-8");
  return text
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as LedgerEntry);
}

export function readScreeningEntries(path: string = DEFAULT_LEDGER_PATH): ScreeningLedgerEntry[] {
  return readAllLedgerEntries(path).filter((e): e is ScreeningLedgerEntry => e.recordType === "screening");
}

export function readOutcomeUpdates(path: string = DEFAULT_LEDGER_PATH): OutcomeUpdateLedgerEntry[] {
  return readAllLedgerEntries(path).filter((e): e is OutcomeUpdateLedgerEntry => e.recordType === "outcome_update");
}

/**
 * TASK_CARD_05 SCOPE 2's watchlist state machine needs "was this ticker
 * on the watchlist last run": the MOST RECENT screening entry per
 * symbol (by screeningTimestamp), keyed to its status. A symbol whose
 * latest status is already 'candidate'/'promoted' is not re-flagged as
 * promotable (it already made it in); only 'watchlist' is eligible.
 */
export function readLatestStatusByTicker(path: string = DEFAULT_LEDGER_PATH): Map<string, LedgerStatus> {
  const latestBySymbol = new Map<string, ScreeningLedgerEntry>();
  for (const entry of readScreeningEntries(path)) {
    const existing = latestBySymbol.get(entry.symbol);
    if (!existing || entry.screeningTimestamp > existing.screeningTimestamp) {
      latestBySymbol.set(entry.symbol, entry);
    }
  }
  const out = new Map<string, LedgerStatus>();
  for (const [symbol, entry] of latestBySymbol) out.set(symbol, entry.status);
  return out;
}

export function previousWatchlistSymbols(path: string = DEFAULT_LEDGER_PATH): Set<string> {
  const latest = readLatestStatusByTicker(path);
  return new Set([...latest.entries()].filter(([, status]) => status === "watchlist").map(([symbol]) => symbol));
}

/** Joins each screening entry with its most recent outcome update (if any), for ledger:stats and ledger:backfill's "already resolved?" check. */
export function joinScreeningWithOutcome(path: string = DEFAULT_LEDGER_PATH): Array<{ screening: ScreeningLedgerEntry; outcome: OutcomeUpdateLedgerEntry | null }> {
  const screenings = readScreeningEntries(path);
  const outcomes = readOutcomeUpdates(path);

  return screenings.map((screening) => {
    const matches = outcomes.filter((o) => o.symbol === screening.symbol && o.refersToScreeningTimestamp === screening.screeningTimestamp);
    const latest = matches.length > 0 ? matches.reduce((a, b) => (a.backfilledAt > b.backfilledAt ? a : b)) : null;
    return { screening, outcome: latest };
  });
}
