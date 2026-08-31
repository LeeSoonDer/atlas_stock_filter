import type { IndicatorFlags, DetectorsConfig } from "../indicators/types.js";
import type { ProfileName } from "../types.js";

/**
 * Claude Code 指令 (claude_code_design_draft.md) §1.1: a detector already
 * compares each of its own named conditions against a threshold before
 * deciding `triggered` - this type is what lets it KEEP those per-condition
 * comparisons instead of discarding them once the boolean AND/OR chain
 * collapses to one `triggered` value. `label`/`threshold` must always be
 * built from the real config values in scope (never a hardcoded literal),
 * so a future threshold tweak can't silently leave a stale description
 * behind. `bucket` is always the detector's own DETECTOR_ID - a multi-
 * bucket symbol's conditions from different detectors get concatenated by
 * the report layer, not by the detector itself.
 */
export type FootprintStatus = "hit" | "miss" | "unavailable";
export type FootprintAvailability = "可得" | "不可得" | "未知";

export interface FootprintCondition {
  bucket: string;
  label: string;
  field: string;
  actual: number | string | null;
  threshold: string;
  status: FootprintStatus;
  availability: FootprintAvailability;
}

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
 *
 * `conditions` (added per claude_code_design_draft.md §1.1) is a pure,
 * additive presentation-layer field - it never feeds back into
 * `triggered`/`strengthScore`, which are computed exactly as before, by
 * the exact same comparison expressions. `conditions` is a SEPARATE,
 * parallel readout of those same already-computed local values, added
 * without touching a single character of the original trigger logic -
 * zero risk of the report layer's presentation needs ever changing what
 * this repo's screener actually selects.
 */
export interface DetectorResult {
  detectorId: string;
  triggered: boolean;
  strengthScore: number | null;
  evidence: Record<string, unknown>;
  conditions: FootprintCondition[];
}

export interface IDetector {
  readonly id: string;
  readonly name: string;
  detect(flags: IndicatorFlags, profile: ProfileName, config: DetectorsConfig): DetectorResult;
}
