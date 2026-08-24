export type { IDetector, DetectorResult } from "./IDetector.js";
export { momentumBreakoutDetector } from "./momentumBreakout.js";
export { volatilityCompressionDetector } from "./volatilityCompression.js";
export { oversoldReversalDetector } from "./oversoldReversal.js";
export { institutionalAccumulationDetector } from "./institutionalAccumulation.js";

import type { IDetector } from "./IDetector.js";
import { momentumBreakoutDetector } from "./momentumBreakout.js";
import { volatilityCompressionDetector } from "./volatilityCompression.js";
import { oversoldReversalDetector } from "./oversoldReversal.js";
import { institutionalAccumulationDetector } from "./institutionalAccumulation.js";

/** TASK_CARD_04 completes all 4 v1 buckets. */
export const allDetectors: IDetector[] = [
  momentumBreakoutDetector,
  volatilityCompressionDetector,
  oversoldReversalDetector,
  institutionalAccumulationDetector,
];
