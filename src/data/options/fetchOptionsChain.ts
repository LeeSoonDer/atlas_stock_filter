import { yahooFinance } from "../yahooClient.js";
import type { RawOptionsChain, RawOptionContract } from "./types.js";

/**
 * No real equity/ETF implied volatility is ever this low in any actual
 * market condition (even the calmest VIX prints imply high-single-digit-
 * percent vol on major names). Live-verified during this card's
 * development (not guessed): fetching real AAPL/SPY/APGE chains returned
 * `impliedVolatility` values like 0.00001 and 0.0039 on the vast majority
 * of contracts (including ones with real, substantial volume) - a
 * placeholder/unset value from Yahoo's backend, not a real computed
 * number. Passing these through would fabricate a plausible-looking but
 * false atmImpliedVol/ivMove; treating them as unavailable is the
 * zero-fabrication-consistent choice. openInterest is NOT filtered the
 * same way - openInterest:0 alongside real nonzero volume is a genuine,
 * expected characteristic of this data source (open interest is an
 * end-of-day figure that lags same-day trading, not a placeholder), and
 * computeOptionsIntelligence.ts already treats openInterest:0 as "skip
 * this contract" for the ratio calc, which is the correct honest response.
 */
const IMPLAUSIBLE_IV_FLOOR = 0.01;

/**
 * TASK_CARD_09 Part B 熔断: never throws. A missing/unstable options chain
 * (yahoo-finance2's options() needs a session crumb, which can fail
 * independently of the rest of this run) degrades to null - the caller
 * treats that as 不可得 for this symbol and moves on, never blocking
 * Part A/C or the rest of the pipeline.
 *
 * Uses the NEAREST expiration only (no `date` override passed) - this is
 * exactly "近月" (near-month) per the card's own wording, and Yahoo's
 * options endpoint already returns the nearest expiration by default
 * when no date is specified (verified against yahoo-finance2's own
 * OptionsResult type: `options[0]` is that nearest expiration's chain).
 */
export async function fetchOptionsChain(symbol: string): Promise<RawOptionsChain | null> {
  try {
    const result = await yahooFinance.options(symbol);
    const nearest = result.options[0];
    if (!nearest) return null;

    const toContract = (c: { strike: number; volume?: number; openInterest?: number; impliedVolatility: number; inTheMoney: boolean }): RawOptionContract => ({
      strike: c.strike,
      volume: c.volume ?? null,
      openInterest: c.openInterest ?? null,
      impliedVolatility: typeof c.impliedVolatility === "number" && c.impliedVolatility >= IMPLAUSIBLE_IV_FLOOR ? c.impliedVolatility : null,
      inTheMoney: c.inTheMoney,
    });

    return {
      underlyingPrice: result.quote?.regularMarketPrice ?? null,
      calls: nearest.calls.map(toContract),
      puts: nearest.puts.map(toContract),
    };
  } catch (err) {
    console.error(`[options] ${symbol} failed: ${(err as Error).message}`);
    return null;
  }
}
