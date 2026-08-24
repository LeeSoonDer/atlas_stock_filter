import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import type { EnrichSlice, FundamentalsSlice, QuoteSlice } from "./types.js";

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
  };
}

/**
 * Migrates a checkpoint written before TASK_CARD_03 (missing
 * fundamentalsResults/fundamentalsFailures) so callers can rely on those
 * fields always existing, without discarding the still-valid Phase A/B
 * data already on disk.
 */
function migrate(state: CheckpointState): CheckpointState {
  state.fundamentalsResults ??= {};
  state.fundamentalsFailures ??= [];
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
