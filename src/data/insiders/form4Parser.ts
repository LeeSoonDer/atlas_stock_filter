import type { Form4ReportingOwner, Form4Transaction, ParsedForm4Filing } from "./types.js";

function extractOne(text: string, tag: string): string | null {
  const m = text.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  return m ? m[1].trim() : null;
}

function extractAllBlocks(text: string, tag: string): string[] {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "g");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.push(m[1]);
  return out;
}

function normalizeCik(raw: string): string {
  return String(Number(raw));
}

function parseReportingOwners(xml: string): Form4ReportingOwner[] {
  return extractAllBlocks(xml, "reportingOwner").map((block) => {
    const idBlock = extractOne(block, "reportingOwnerId") ?? block;
    const cik = extractOne(idBlock, "rptOwnerCik");
    const name = extractOne(idBlock, "rptOwnerName");
    return { cik: cik ? normalizeCik(cik) : "", name: name ?? "" };
  }).filter((o) => o.cik !== "");
}

function parseTransactions(xml: string): Form4Transaction[] {
  const tableMatch = xml.match(/<nonDerivativeTable>([\s\S]*?)<\/nonDerivativeTable>/);
  if (!tableMatch) return [];

  return extractAllBlocks(tableMatch[1], "nonDerivativeTransaction").map((block) => {
    const codingBlock = extractOne(block, "transactionCoding") ?? "";
    const transactionCode = extractOne(codingBlock, "transactionCode") ?? "";

    const sharesBlock = block.match(/<transactionShares>([\s\S]*?)<\/transactionShares>/);
    const sharesRaw = sharesBlock ? extractOne(sharesBlock[1], "value") : null;

    const priceBlock = block.match(/<transactionPricePerShare>([\s\S]*?)<\/transactionPricePerShare>/);
    const priceRaw = priceBlock ? extractOne(priceBlock[1], "value") : null;

    return {
      transactionCode,
      shares: sharesRaw !== null && sharesRaw !== "" ? Number(sharesRaw) : null,
      pricePerShare: priceRaw !== null && priceRaw !== "" ? Number(priceRaw) : null,
    };
  });
}

/**
 * Parses one Form 4 full-submission text file (the SGML wrapper with an
 * embedded <XML>...</XML> ownershipDocument - verified live structure).
 * Deliberately regex-based, not a full XML parser (SCOPE 1's "简化优先:
 * 只解析买入方向与人数金额,不做全字段解析" - simplify first, only parse
 * buy direction/count/amount, not full-field parsing): extracts only
 * reportingOwner cik/name and nonDerivativeTable transactionCode/shares/
 * pricePerShare - derivativeTable (options, etc.) is deliberately not
 * parsed, matching that same simplification directive.
 *
 * Returns null (not a thrown error) when the file has no XML ownership
 * document at all (a small number of legacy/malformed filings) - the
 * caller treats that filing as unparseable and moves on rather than
 * retrying forever.
 */
export function parseForm4Text(text: string, accessionPath: string, ticker: string, cik: string, dateFiled: string, fetchedAt: string): ParsedForm4Filing | null {
  const xmlMatch = text.match(/<XML>([\s\S]*?)<\/XML>/);
  if (!xmlMatch) return null;
  const xml = xmlMatch[1];

  return {
    accessionPath,
    ticker,
    cik,
    dateFiled,
    periodOfReport: extractOne(xml, "periodOfReport"),
    reportingOwners: parseReportingOwners(xml),
    transactions: parseTransactions(xml),
    fetchedAt,
  };
}
