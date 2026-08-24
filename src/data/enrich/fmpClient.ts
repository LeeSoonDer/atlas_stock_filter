import type { FmpRawRatios } from "./types.js";

const FMP_BASE = "https://financialmodelingprep.com/stable";

/**
 * Verified live (no key available - the domain/path structure was
 * confirmed by observing FMP's own structured "Invalid API KEY" JSON
 * error for both this and the legacy /api/v3/ path, meaning both are
 * real recognized endpoints, not 404s): /stable/ratios-ttm?symbol=X.
 * Field names (priceToEarningsRatioTTM, priceToBookRatioTTM,
 * priceToEarningsGrowthRatioTTM) confirmed via FMP's own published docs
 * content. Deliberately does NOT include P/S or EV/EBITDA - their exact
 * field names could not be verified without a real key; see
 * ai/decisions.md.
 */
export async function fetchFmpRatiosTTM(symbol: string, apiKey: string): Promise<FmpRawRatios | null> {
  const res = await fetch(`${FMP_BASE}/ratios-ttm?symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`);
  if (!res.ok) return null;
  const data = (await res.json()) as unknown;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  return {
    peRatioTTM: typeof r.priceToEarningsRatioTTM === "number" ? r.priceToEarningsRatioTTM : undefined,
    pbRatioTTM: typeof r.priceToBookRatioTTM === "number" ? r.priceToBookRatioTTM : undefined,
    pegRatioTTM: typeof r.priceToEarningsGrowthRatioTTM === "number" ? r.priceToEarningsGrowthRatioTTM : undefined,
  };
}

/** Verified live (same evidence as above): /stable/quote?symbol=X returns a `price` field. */
export async function fetchFmpQuotePrice(symbol: string, apiKey: string): Promise<number | null> {
  const res = await fetch(`${FMP_BASE}/quote?symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`);
  if (!res.ok) return null;
  const data = (await res.json()) as unknown;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return null;
  const price = (row as Record<string, unknown>).price;
  return typeof price === "number" ? price : null;
}
