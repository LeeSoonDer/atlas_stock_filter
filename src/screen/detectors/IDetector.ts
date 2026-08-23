import type { SymbolMarketData } from "../../data/types.js";

/**
 * Interface stub only - TASK_CARD_01 MUST-NOT forbids any scoring or
 * indicator-calculation logic. The four v1 opportunity detectors
 * (Momentum Breakout, Volatility Compression Setup, Institutional
 * Accumulation Proxy, Oversold Reversal - Memo No.4, 二) are implemented
 * in a later card against this interface.
 */
export interface DetectorResult {
  detectorId: string;
  triggered: boolean;
  evidence: Record<string, unknown>;
}

export interface IDetector {
  readonly id: string;
  readonly name: string;
  detect(symbol: string, data: SymbolMarketData): DetectorResult | null;
}
