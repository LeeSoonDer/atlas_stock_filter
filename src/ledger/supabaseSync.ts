import { appendLedgerEntry, readAllLedgerEntries, DEFAULT_LEDGER_PATH } from "./ledger.js";
import type { LedgerEntry, OutcomeUpdateLedgerEntry } from "./types.js";

/**
 * Two-way sync between this repo's output/ledger.jsonl (the constitutional
 * source of truth - append-only, git-tracked, never edited in place) and the
 * shared Supabase `atlas_ledger` mirror the Cockpit web UI reads/writes.
 *
 * Why two-way: the web lets the operator backfill an outcome without opening
 * a terminal, so outcome_update rows can be born in Supabase. Those must
 * come back into the local file, or the local ledger silently drifts behind
 * and every stats/selection read here becomes wrong. Both directions are
 * append-only on the local side - `pull` only ever calls appendLedgerEntry,
 * never rewrites a line, so Amendment No.2's MUST-NOT still holds.
 *
 * `naturalKey` is what makes both directions idempotent (it's a unique
 * column in Supabase, and the dedupe key when appending locally).
 *
 * Same graceful-degradation convention as the rest of this repo's optional
 * integrations: a missing key or a failed request logs and returns, never
 * throws - a screen run must never fail because the web mirror is down.
 * flagsSnapshot is deliberately not mirrored (large; nothing in the web
 * view reads it).
 */
/** Timestamps are normalized to epoch-ms, never used as raw strings: Postgres
 * echoes timestamptz back as "...+00:00" while local JSON has "...Z" - same
 * instant, different text. A string-based key would make every web-written
 * row look "new" forever and re-append on every pull. */
function ts(value: string): number {
  return new Date(value).getTime();
}

export function naturalKey(entry: LedgerEntry): string {
  return entry.recordType === "screening"
    ? `screening|${entry.symbol}|${ts(entry.screeningTimestamp)}`
    : `outcome|${entry.symbol}|${ts(entry.refersToScreeningTimestamp)}|${ts(entry.backfilledAt)}`;
}

function credentials(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url, key } : null;
}

function toRow(entry: LedgerEntry): Record<string, unknown> {
  const base = { record_type: entry.recordType, symbol: entry.symbol, natural_key: naturalKey(entry) };
  return entry.recordType === "screening"
    ? {
        ...base,
        screening_timestamp: entry.screeningTimestamp,
        profile: entry.profile,
        speculative: entry.speculative,
        status: entry.status,
        buckets: entry.buckets,
        opportunity_type: entry.opportunityType,
      }
    : {
        ...base,
        refers_to_screening_timestamp: entry.refersToScreeningTimestamp,
        backfilled_at: entry.backfilledAt,
        outcome: entry.outcome,
      };
}

async function fetchRemoteKeys(url: string, key: string): Promise<Set<string>> {
  const keys = new Set<string>();
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const res = await fetch(`${url}/rest/v1/atlas_ledger?select=natural_key&limit=${pageSize}&offset=${offset}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${await res.text()}`);
    const rows = (await res.json()) as Array<{ natural_key: string }>;
    for (const r of rows) keys.add(r.natural_key);
    if (rows.length < pageSize) return keys;
  }
}

/** Local -> Supabase: inserts every local entry the mirror doesn't have yet. */
export async function pushLedgerToSupabase(path: string = DEFAULT_LEDGER_PATH): Promise<void> {
  const creds = credentials();
  if (!creds) {
    console.error("[ledger-sync] skipped push (SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY not set in .env)");
    return;
  }
  try {
    const remoteKeys = await fetchRemoteKeys(creds.url, creds.key);
    const missing = readAllLedgerEntries(path).filter((e) => !remoteKeys.has(naturalKey(e)));
    if (missing.length === 0) {
      console.error("[ledger-sync] push: Supabase mirror already up to date");
      return;
    }
    // Chunked so a long-accumulated ledger doesn't build one huge request body.
    for (let i = 0; i < missing.length; i += 500) {
      const chunk = missing.slice(i, i + 500).map(toRow);
      const res = await fetch(`${creds.url}/rest/v1/atlas_ledger`, {
        method: "POST",
        headers: {
          apikey: creds.key,
          Authorization: `Bearer ${creds.key}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal,resolution=ignore-duplicates",
        },
        body: JSON.stringify(chunk),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${await res.text()}`);
    }
    console.error(`[ledger-sync] push done: ${missing.length} entr(ies) mirrored to Supabase`);
  } catch (e) {
    console.error(`[ledger-sync] push failed: ${(e as Error).message} - local ledger is unaffected, not blocking`);
  }
}

/** Supabase -> local: appends any outcome_update written by the web UI that
 * this machine's ledger.jsonl doesn't have yet. Only outcome_updates are
 * pulled - screening rows are only ever born here, from a real run. */
export async function pullLedgerFromSupabase(path: string = DEFAULT_LEDGER_PATH): Promise<void> {
  const creds = credentials();
  if (!creds) {
    console.error("[ledger-sync] skipped pull (SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY not set in .env)");
    return;
  }
  try {
    const localKeys = new Set(readAllLedgerEntries(path).map(naturalKey));
    const res = await fetch(
      `${creds.url}/rest/v1/atlas_ledger?record_type=eq.outcome_update&select=symbol,refers_to_screening_timestamp,backfilled_at,outcome,natural_key`,
      { headers: { apikey: creds.key, Authorization: `Bearer ${creds.key}` } },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status} ${await res.text()}`);
    const rows = (await res.json()) as Array<{
      symbol: string;
      refers_to_screening_timestamp: string;
      backfilled_at: string;
      outcome: OutcomeUpdateLedgerEntry["outcome"];
      natural_key: string;
    }>;

    let appended = 0;
    for (const row of rows) {
      if (localKeys.has(row.natural_key)) continue;
      appendLedgerEntry(
        {
          recordType: "outcome_update",
          symbol: row.symbol,
          refersToScreeningTimestamp: row.refers_to_screening_timestamp,
          backfilledAt: row.backfilled_at,
          outcome: row.outcome,
        },
        path,
      );
      appended += 1;
    }
    console.error(
      appended === 0
        ? "[ledger-sync] pull: no web-written outcomes to bring back"
        : `[ledger-sync] pull done: ${appended} web-written outcome(s) appended to ${path}`,
    );
  } catch (e) {
    console.error(`[ledger-sync] pull failed: ${(e as Error).message} - local ledger is unaffected, not blocking`);
  }
}
