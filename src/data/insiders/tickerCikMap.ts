import { secFetch } from "./secClient.js";

export interface TickerCikMaps {
  cikByTicker: Map<string, string>;
  tickerByCik: Map<string, string>;
}

interface CompanyTickersEntry {
  cik_str: number;
  ticker: string;
  title: string;
}

/**
 * SEC's public ticker<->CIK mapping (verified live: 10,403 entries as of
 * this card's development). Fetched fresh each run (small, ~800KB,
 * single request) rather than cached, since it's cheap and this keeps
 * ticker changes/new listings current without a separate invalidation
 * mechanism.
 */
export async function fetchTickerCikMaps(maxRequestsPerSecond: number): Promise<TickerCikMaps> {
  const res = await secFetch("https://www.sec.gov/files/company_tickers.json", maxRequestsPerSecond);
  if (!res.ok) throw new Error(`company_tickers.json fetch failed: HTTP ${res.status}`);
  const data = (await res.json()) as Record<string, CompanyTickersEntry>;

  const cikByTicker = new Map<string, string>();
  const tickerByCik = new Map<string, string>();
  for (const entry of Object.values(data)) {
    const cik = String(entry.cik_str);
    cikByTicker.set(entry.ticker, cik);
    tickerByCik.set(cik, entry.ticker);
  }
  return { cikByTicker, tickerByCik };
}
