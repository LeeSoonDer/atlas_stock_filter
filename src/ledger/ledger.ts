import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { LedgerEntry } from "./types.js";

const DEFAULT_LEDGER_PATH = "output/ledger.jsonl";

/**
 * Append-only write. No read/update/delete is exposed by design - the
 * constitution requires permanent archival with no post-hoc deletion or
 * selective retention (Amendment No.2, 修正案五). Not wired into the
 * screening pipeline in this card.
 */
export function appendLedgerEntry(entry: LedgerEntry, path: string = DEFAULT_LEDGER_PATH): void {
  const dir = dirname(path);
  if (dir && !existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  appendFileSync(path, `${JSON.stringify(entry)}\n`, "utf-8");
}
