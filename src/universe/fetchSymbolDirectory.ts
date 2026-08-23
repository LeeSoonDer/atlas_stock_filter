import type { RawSymbolRecord } from "./types.js";

const NASDAQ_LISTED_URL = "https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt";
const OTHER_LISTED_URL = "https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt";
const NYSE_EXCHANGE_CODE = "N";

function isDataRow(firstCol: string): boolean {
  return firstCol.trim().length > 0 && !firstCol.startsWith("File Creation Time");
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) {
    throw new Error(`Symbol directory fetch failed: ${url} -> HTTP ${res.status}`);
  }
  return res.text();
}

/**
 * Parses nasdaqtrader.com's nasdaqlisted.txt.
 * Columns: Symbol|Security Name|Market Category|Test Issue|Financial Status|Round Lot Size|ETF|NextShares
 * (verified against a live download; see TASK_CARD_01 report for the probe.)
 */
function parseNasdaqListed(text: string): RawSymbolRecord[] {
  const lines = text.split(/\r?\n/);
  const records: RawSymbolRecord[] = [];
  for (const line of lines.slice(1)) {
    const cols = line.split("|");
    if (!isDataRow(cols[0] ?? "")) continue;
    records.push({
      symbol: cols[0],
      securityName: cols[1] ?? "",
      exchange: "NASDAQ",
      testIssueFlag: cols[3] === "Y",
      etfFlag: cols[6] === "Y",
    });
  }
  return records;
}

/**
 * Parses nasdaqtrader.com's otherlisted.txt and keeps NYSE-primary rows only
 * (Exchange code "N"). Other codes in this file (P=NYSE Arca, Z=Cboe BZX,
 * A=NYSE American, V=IEX) are out of scope: the constitution's approved
 * universe is "NYSE 与 NASDAQ" (constitution/ATLAS_MEMO_NO3_ADJUDICATIONS.md
 * Q5), read narrowly. See TASK_CARD_01 report DEVIATION for this call.
 * Columns: ACT Symbol|Security Name|Exchange|CQS Symbol|ETF|Round Lot Size|Test Issue|NASDAQ Symbol
 */
function parseOtherListed(text: string): RawSymbolRecord[] {
  const lines = text.split(/\r?\n/);
  const records: RawSymbolRecord[] = [];
  for (const line of lines.slice(1)) {
    const cols = line.split("|");
    if (!isDataRow(cols[0] ?? "")) continue;
    if (cols[2] !== NYSE_EXCHANGE_CODE) continue;
    records.push({
      symbol: cols[0],
      securityName: cols[1] ?? "",
      exchange: "NYSE",
      testIssueFlag: cols[6] === "Y",
      etfFlag: cols[4] === "Y",
    });
  }
  return records;
}

export async function fetchRawUniverse(): Promise<RawSymbolRecord[]> {
  const [nasdaqText, otherText] = await Promise.all([
    fetchText(NASDAQ_LISTED_URL),
    fetchText(OTHER_LISTED_URL),
  ]);
  return [...parseNasdaqListed(nasdaqText), ...parseOtherListed(otherText)];
}
