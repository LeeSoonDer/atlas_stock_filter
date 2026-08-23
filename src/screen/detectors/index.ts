export type { IDetector, DetectorResult } from "./IDetector.js";
export { momentumBreakoutDetector } from "./momentumBreakout.js";
export { volatilityCompressionDetector } from "./volatilityCompression.js";
export { oversoldReversalDetector } from "./oversoldReversal.js";

import type { IDetector } from "./IDetector.js";
import { momentumBreakoutDetector } from "./momentumBreakout.js";
import { volatilityCompressionDetector } from "./volatilityCompression.js";
import { oversoldReversalDetector } from "./oversoldReversal.js";

/** TASK_CARD_02 implements 3 of the 4 v1 buckets. Institutional Accumulation Proxy is a later card. */
export const allDetectors: IDetector[] = [
  momentumBreakoutDetector,
  volatilityCompressionDetector,
  oversoldReversalDetector,
];
