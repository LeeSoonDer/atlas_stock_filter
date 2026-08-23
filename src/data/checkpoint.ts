import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import type { EnrichSlice, QuoteSlice } from "./types.js";

export interface CheckpointState {
  profile: string;
  startedAt: string;
  updatedAt: string;
  quoteResults: Record<string, QuoteSlice>;
  quoteFailures: string[];
  enrichResults: Record<string, EnrichSlice>;
  enrichFailures: string[];
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
  };
}

export function loadCheckpoint(path: string, profile: string): CheckpointState {
  if (!existsSync(path)) {
    return freshCheckpoint(profile);
  }
  const raw = readFileSync(path, "utf-8");
  const state = JSON.parse(raw) as CheckpointState;
  if (state.profile !== profile) {
    return freshCheckpoint(profile);
  }
  return state;
}

/** Atomic write: write to a temp file then rename, so a crash mid-write cannot corrupt the checkpoint. */
export function saveCheckpoint(path: string, state: CheckpointState): void {
  state.updatedAt = new Date().toISOString();
  const tmpPath = `${path}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(state, null, 2), "utf-8");
  renameSync(tmpPath, path);
}
