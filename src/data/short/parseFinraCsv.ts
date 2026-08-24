import type { ShortInterestRecord } from "./types.js";

/**
 * Parses FINRA's biweekly short-interest file (pipe-delimited despite the
 * .csv extension - verified live). Column layout confirmed from a real
 * downloaded file's header row, not assumed:
 *   accountingYearMonthNumber|symbolCode|issueName|
 *   issuerServicesGroupExchangeCode|marketClassCode|
 *   currentShortPositionQuantity|previousShortPositionQuantity|
 *   stockSplitFlag|averageDailyVolumeQuantity|daysToCoverQuantity|
 *   revisionFlag|changePercent|changePreviousNumber|settlementDate
 * Parses by header-name lookup (not fixed column index) so a column
 * reorder in a future file doesn't silently corrupt the data.
 */
export function parseFinraCsv(text: string): Map<string, ShortInterestRecord> {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) return new Map();

  const header = lines[0].split("|").map((h) => h.trim());
  const col = (name: string) => header.indexOf(name);

  const symbolCol = col("symbolCode");
  const currentCol = col("currentShortPositionQuantity");
  const previousCol = col("previousShortPositionQuantity");
  const daysToCoverCol = col("daysToCoverQuantity");
  const changePercentCol = col("changePercent");
  const settlementDateCol = col("settlementDate");

  if (symbolCol === -1 || currentCol === -1 || previousCol === -1 || settlementDateCol === -1) {
    throw new Error(`FINRA CSV header missing an expected column: ${header.join(",")}`);
  }

  const out = new Map<string, ShortInterestRecord>();
  for (let i = 1; i < lines.length; i++) {
    const fields = lines[i].split("|");
    const symbol = fields[symbolCol]?.trim();
    if (!symbol) continue;

    const current = Number(fields[currentCol]);
    const previous = Number(fields[previousCol]);
    if (!Number.isFinite(current) || !Number.isFinite(previous)) continue;

    const daysToCoverRaw = daysToCoverCol !== -1 ? Number(fields[daysToCoverCol]) : NaN;
    const changePercentRaw = changePercentCol !== -1 ? Number(fields[changePercentCol]) : NaN;

    out.set(symbol, {
      symbol,
      settlementDate: fields[settlementDateCol]?.trim(),
      currentShortShares: current,
      previousShortShares: previous,
      daysToCover: Number.isFinite(daysToCoverRaw) ? daysToCoverRaw : null,
      changePercent: Number.isFinite(changePercentRaw) ? changePercentRaw : null,
    });
  }
  return out;
}
