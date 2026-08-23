import type { IndicatorFlags, DetectorsConfig } from "../indicators/types.js";
import type { ProfileName } from "../types.js";

/**
 * Revised from TASK_CARD_01's stub now that TASK_CARD_02 defines real
 * detector requirements: detectors operate on precomputed IndicatorFlags
 * (shared across all detectors, computed once per symbol) rather than
 * raw market data, and need the symbol's profile (Detector C's RSI
 * threshold differs for SMALL_SPEC) and the config thresholds.
 *
 * strengthScore is a simple, bucket-internal composite (0..100) for
 * sorting only - not a cross-bucket ranking or candidate selection,
 * which stays out of scope (MUST-NOT). Each detector documents its own
 * formula in its own file. null when not triggered.
 */
export interface DetectorResult {
  detectorId: string;
  triggered: boolean;
  strengthScore: number | null;
  evidence: Record<string, unknown>;
}

export interface IDetector {
  readonly id: string;
  readonly name: string;
  detect(flags: IndicatorFlags, profile: ProfileName, config: DetectorsConfig): DetectorResult;
}
