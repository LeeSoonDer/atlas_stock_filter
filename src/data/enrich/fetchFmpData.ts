import { fetchFmpQuotePrice, fetchFmpRatiosTTM } from "./fmpClient.js";
import { computeFmpEnrichment, FMP_UNAVAILABLE_RESULT } from "./computeFmpEnrichment.js";
import type { FmpConfig, FmpEnrichmentResult } from "./types.js";

/**
 * TASK_CARD_05 SCOPE 1: "候选与观察哨确定后(<= 15只),调FMP补充估值比率与
 * 双源价格校验" - only ever called for the narrowed candidate+watchlist
 * pool (<= 15 symbols), never during full-universe screening (Memo
 * No.4, E17 - "全宇宙阶段禁用FMP"). Gracefully degrades to fully
 * unavailable when FMP_API_KEY isn't configured (no .env present as of
 * this card's development - same pattern as CARD 04's borrow-fee-rate),
 * rather than blocking the rest of the card.
 */
export async function fetchFmpEnrichment(symbol: string, yahooPrice: number | undefined, apiKey: string | undefined, config: FmpConfig): Promise<FmpEnrichmentResult> {
  if (!apiKey) return FMP_UNAVAILABLE_RESULT;

  const [ratios, fmpPrice] = await Promise.all([fetchFmpRatiosTTM(symbol, apiKey), fetchFmpQuotePrice(symbol, apiKey)]);
  return computeFmpEnrichment(ratios, fmpPrice, yahooPrice, config);
}
