import { secFetch } from "./secClient.js";
import type { RelevantForm4Filing } from "./types.js";
import type { TickerCikMaps } from "./tickerCikMap.js";

export function ymd(date: Date): string {
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}`;
}

function dailyIndexUrl(date: Date): string {
  const year = date.getUTCFullYear();
  const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
  return `https://www.sec.gov/Archives/edgar/daily-index/${year}/QTR${quarter}/form.${ymd(date)}.idx`;
}

/**
 * Parses a form.idx file's fixed-width rows for form type exactly "4"
 * (not "4/A" - amendments are excluded by exact-match, verified live:
 * the form-type column is left-padded/trimmed text, and "4/A" does not
 * equal "4"). CIK is extracted via regex from the file path column
 * rather than fixed-width byte offsets (verified more robust - the
 * company-name column's width varies enough that offset-based parsing
 * risked off-by-one errors on longer names).
 */
export function parseFormIndex(text: string, cikSet: Set<string>, tickerByCik: Map<string, string>, dateFiled: string): RelevantForm4Filing[] {
  const out: RelevantForm4Filing[] = [];
  for (const line of text.split("\n")) {
    const formType = line.slice(0, 12).trim();
    if (formType !== "4") continue;
    const match = line.match(/edgar\/data\/(\d+)\/(\S+)/);
    if (!match) continue;
    const cik = match[1];
    if (!cikSet.has(cik)) continue;
    const ticker = tickerByCik.get(cik);
    if (!ticker) continue;
    out.push({ cik, ticker, accessionPath: `edgar/data/${cik}/${match[2]}`, dateFiled });
  }
  return out;
}

/**
 * Fetches one day's daily index and filters to Form 4 filings for CIKs
 * in our universe. Returns an empty array (not an error) for
 * non-trading days (weekends/holidays), where SEC simply has no file -
 * verified live behavior returns 404 for those, treated as "nothing
 * filed" rather than a failure.
 */
export async function fetchDailyIndexRelevantFilings(
  date: Date,
  cikSet: Set<string>,
  tickerByCik: Map<string, string>,
  maxRequestsPerSecond: number,
): Promise<RelevantForm4Filing[]> {
  const res = await secFetch(dailyIndexUrl(date), maxRequestsPerSecond);
  if (!res.ok) return [];
  const text = await res.text();
  return parseFormIndex(text, cikSet, tickerByCik, date.toISOString().slice(0, 10));
}
