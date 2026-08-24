import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import type { EnrichSlice, FundamentalsSlice, QuoteSlice } from "./types.js";
import type { RelevantForm4Filing, ParsedForm4Filing } from "./insiders/types.js";

export interface InstitutionalSnapshot {
  asOf: string;
  institutionsPercentHeld: number;
}

export interface CheckpointState {
  /**
   * Free-text label, not a partition key. The checkpoint is shared across
   * all --profile invocations (standard/small_spec/both): Phase A quote
   * data is profile-independent (the whole exclusion-gated universe needs
   * it to evaluate any profile gate), and Phase B enrichment keyed by
   * symbol is reused across runs, so e.g. running --profile both after
   * --profile standard does not refetch symbols already enriched.
   */
  profile: string;
  startedAt: string;
  updatedAt: string;
  quoteResults: Record<string, QuoteSlice>;
  quoteFailures: string[];
  enrichResults: Record<string, EnrichSlice>;
  enrichFailures: string[];
  /** Phase C (TASK_CARD_03): keyed by symbol like enrichResults, but only ever populated for the "候选" pool, not the full universe. */
  fundamentalsResults: Record<string, FundamentalsSlice>;
  fundamentalsFailures: string[];
  /**
   * TASK_CARD_04. Accumulates forever, never overwritten: SEC daily
   * indexes and individual Form 4 filings are immutable once published,
   * so once fetched they're cached permanently (unlike enrichResults'
   * per-symbol-once caching, this is per-day / per-filing).
   */
  insiderDailyIndexCache: Record<string, RelevantForm4Filing[]>;
  insiderFilingResults: Record<string, ParsedForm4Filing>;
  insiderFilingFailures: string[];
  /** TASK_CARD_04: one growing snapshot history per symbol, appended (deduped by day) every run - not cache-once, since a real trend needs genuinely fresh data. */
  institutionalHistory: Record<string, InstitutionalSnapshot[]>;
}

export function freshCheckpoint(profile: string): CheckpointState {
  const now = new Date().toISOString();
  return {
    profile,
    startedAt: now,
    updatedAt: now,
    quoteResults: {},
    quoteFailures: [],
    enrichResults: {},
    enrichFailures: [],
    fundamentalsResults: {},
    fundamentalsFailures: [],
    insiderDailyIndexCache: {},
    insiderFilingResults: {},
    insiderFilingFailures: [],
    institutionalHistory: {},
  };
}

/**
 * Migrates a checkpoint written before TASK_CARD_03/04 (missing later
 * fields) so callers can rely on those fields always existing, without
 * discarding the still-valid Phase A/B data already on disk.
 */
function migrate(state: CheckpointState): CheckpointState {
  state.fundamentalsResults ??= {};
  state.fundamentalsFailures ??= [];
  state.insiderDailyIndexCache ??= {};
  state.insiderFilingResults ??= {};
  state.insiderFilingFailures ??= [];
  state.institutionalHistory ??= {};
  return state;
}

export function loadCheckpoint(path: string, profile: string): CheckpointState {
  if (!existsSync(path)) {
    return freshCheckpoint(profile);
  }
  const raw = readFileSync(path, "utf-8");
  return migrate(JSON.parse(raw) as CheckpointState);
}

/** Atomic write: write to a temp file then rename, so a crash mid-write cannot corrupt the checkpoint. */
export function saveCheckpoint(path: string, state: CheckpointState): void {
  state.updatedAt = new Date().toISOString();
  const tmpPath = `${path}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(state, null, 2), "utf-8");
  renameSync(tmpPath, path);
}
