import { secFetch } from "./secClient.js";
import { fetchDailyIndexRelevantFilings, ymd } from "./dailyIndexScanner.js";
import { parseForm4Text } from "./form4Parser.js";
import type { ParsedForm4Filing, RelevantForm4Filing } from "./types.js";

/** All calendar days (YYYYMMDD) in the trailing lookbackDays window, most recent first, ending yesterday (today's index isn't finalized yet). */
export function lookbackWindowDays(lookbackDays: number, now: Date): string[] {
  const out: string[] = [];
  for (let daysAgo = 1; daysAgo <= lookbackDays; daysAgo++) {
    out.push(ymd(new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000)));
  }
  return out;
}

function dateFromYmd(yyyymmdd: string): Date {
  const y = Number(yyyymmdd.slice(0, 4));
  const m = Number(yyyymmdd.slice(4, 6)) - 1;
  const d = Number(yyyymmdd.slice(6, 8));
  return new Date(Date.UTC(y, m, d));
}

export async function scanOneDailyIndex(
  yyyymmdd: string,
  cikSet: Set<string>,
  tickerByCik: Map<string, string>,
  maxRequestsPerSecond: number,
): Promise<RelevantForm4Filing[]> {
  return fetchDailyIndexRelevantFilings(dateFromYmd(yyyymmdd), cikSet, tickerByCik, maxRequestsPerSecond);
}

export async function fetchAndParseFiling(
  filing: RelevantForm4Filing,
  maxRequestsPerSecond: number,
): Promise<ParsedForm4Filing | null> {
  const res = await secFetch(`https://www.sec.gov/Archives/${filing.accessionPath}`, maxRequestsPerSecond);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${filing.accessionPath}`);
  const text = await res.text();
  return parseForm4Text(text, filing.accessionPath, filing.ticker, filing.cik, filing.dateFiled, new Date().toISOString());
}
