import { parseFinraCsv } from "./parseFinraCsv.js";
import type { ShortInterestFile } from "./types.js";

function ymd(date: Date): string {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
}

function fileUrl(yyyymmdd: string): string {
  return `https://cdn.finra.org/equity/otcmarket/biweekly/shrt${yyyymmdd}.csv`;
}

/**
 * FINRA's exact settlement-date schedule (mid-month + month-end, shifted
 * for holidays/weekends) isn't published anywhere we can fetch
 * programmatically, and publish lag after settlement varies (~2 weeks
 * per FINRA's own stated cadence - verified live: as of this card's
 * development, the most recent available file was 2026-07-31, ~24 days
 * before the run date, consistent with that lag). Rather than hardcode
 * a guessed schedule, this walks backward day by day from yesterday and
 * uses the first date that actually has a published file - robust to
 * schedule/holiday shifts, and the resulting `lagDays` is exactly what
 * SCOPE 3's "数据延迟显式标注" (data lag explicitly tagged) requires.
 */
export async function fetchLatestShortInterestFile(walkBackDays: number): Promise<ShortInterestFile | null> {
  const now = new Date();
  for (let daysAgo = 1; daysAgo <= walkBackDays; daysAgo++) {
    const candidate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    const url = fileUrl(ymd(candidate));
    const res = await fetch(url);
    if (!res.ok) continue;

    const text = await res.text();
    const records = parseFinraCsv(text);
    if (records.size === 0) continue;

    // Use the settlementDate actually present in the parsed data (ground
    // truth) rather than the candidate filename date we guessed, even
    // though they're expected to match under FINRA's naming convention.
    const settlementDate = [...records.values()][0].settlementDate;
    const settlementDateMs = new Date(`${settlementDate}T00:00:00Z`).getTime();
    const lagDays = Math.round((now.getTime() - settlementDateMs) / (24 * 60 * 60 * 1000));
    return { settlementDate, fetchedAt: now.toISOString(), lagDays, records };
  }
  return null;
}
