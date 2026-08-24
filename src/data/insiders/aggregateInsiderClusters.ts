import type { ParsedForm4Filing } from "./types.js";

export interface InsiderClusterResult {
  ticker: string;
  distinctBuyerCount: number;
  insiderCluster: boolean;
  mostRecentPurchaseDate: string | null;
  lagDays: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Aggregates parsed Form 4 filings into per-ticker insider-cluster
 * results: "近90日 >= 2 名不同内部人公开市场买入" (trailing lookbackDays,
 * >= minDistinctBuyers distinct insiders with a code-P open-market
 * purchase). Only code "P" transactions count - grants (A), exercises
 * (M), gifts (G), tax withholding (F), sales (S), etc. are ignored per
 * SCOPE 1's explicit "买入交易(P代码公开市场买入)" scope.
 */
export function aggregateInsiderClusters(
  filings: ParsedForm4Filing[],
  lookbackDays: number,
  minDistinctBuyers: number,
  now: Date,
): Map<string, InsiderClusterResult> {
  const cutoff = now.getTime() - lookbackDays * DAY_MS;

  const buyersByTicker = new Map<string, Set<string>>();
  const latestDateByTicker = new Map<string, string>();

  for (const filing of filings) {
    const filedMs = new Date(filing.dateFiled).getTime();
    if (filedMs < cutoff || filedMs > now.getTime()) continue;

    const hasPurchase = filing.transactions.some((t) => t.transactionCode === "P");
    if (!hasPurchase) continue;

    for (const owner of filing.reportingOwners) {
      const set = buyersByTicker.get(filing.ticker) ?? new Set<string>();
      set.add(owner.cik);
      buyersByTicker.set(filing.ticker, set);
    }

    const current = latestDateByTicker.get(filing.ticker);
    if (!current || filing.dateFiled > current) {
      latestDateByTicker.set(filing.ticker, filing.dateFiled);
    }
  }

  const out = new Map<string, InsiderClusterResult>();
  for (const [ticker, buyers] of buyersByTicker) {
    const mostRecent = latestDateByTicker.get(ticker) ?? null;
    const lagDays = mostRecent ? Math.round((now.getTime() - new Date(mostRecent).getTime()) / DAY_MS) : null;
    out.set(ticker, {
      ticker,
      distinctBuyerCount: buyers.size,
      insiderCluster: buyers.size >= minDistinctBuyers,
      mostRecentPurchaseDate: mostRecent,
      lagDays,
    });
  }
  return out;
}
