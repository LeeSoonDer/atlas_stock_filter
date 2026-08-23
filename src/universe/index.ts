import { fetchRawUniverse } from "./fetchSymbolDirectory.js";
import { evaluateExclusion } from "./exclusionGates.js";
import type { ExclusionReason, RawSymbolRecord } from "./types.js";

export interface BuildUniverseResult {
  rawCount: number;
  excludedCount: number;
  excludedByReason: Record<ExclusionReason, number>;
  universe: RawSymbolRecord[];
}

const EMPTY_REASON_COUNTS: Record<ExclusionReason, number> = {
  TEST_ISSUE: 0,
  ETF_ETN_FLAG: 0,
  ETF_ETN_NAME: 0,
  WARRANT: 0,
  RIGHT: 0,
  UNIT: 0,
  PREFERRED: 0,
  SPAC: 0,
  LEVERAGED_INVERSE: 0,
  DEBT_SECURITY: 0,
};

export async function buildUniverse(): Promise<BuildUniverseResult> {
  const raw = await fetchRawUniverse();
  const excludedByReason = { ...EMPTY_REASON_COUNTS };
  const universe: RawSymbolRecord[] = [];

  for (const record of raw) {
    const { excluded, reason } = evaluateExclusion(record);
    if (excluded && reason) {
      excludedByReason[reason] += 1;
    } else {
      universe.push(record);
    }
  }

  const excludedCount = raw.length - universe.length;
  return { rawCount: raw.length, excludedCount, excludedByReason, universe };
}

export type { RawSymbolRecord, SourceExchange, ExclusionReason } from "./types.js";
