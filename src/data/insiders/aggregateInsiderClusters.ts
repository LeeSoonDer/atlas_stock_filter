import type { ParsedForm4Filing } from "./types.js";
import type { InsiderWeightingConfig } from "./insiderWeighting.js";
import { transactionWeight } from "./insiderWeighting.js";

export interface InsiderClusterResult {
  ticker: string;
  distinctBuyerCount: number;
  /** TASK_CARD_09 Part A: sum of each distinct buyer's own best (max) role×significance weight - see insiderWeighting.ts. */
  weightedScore: number;
  insiderCluster: boolean;
  mostRecentPurchaseDate: string | null;
  lagDays: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Aggregates parsed Form 4 filings into per-ticker insider-cluster
 * results. TASK_CARD_09 Part A upgrade / 修正案十五: cluster determination
 * is now a weighted score (role seniority × purchase-amount significance),
 * not a raw distinct-buyer headcount - `distinctBuyerCount` is kept for
 * display/context but no longer drives `insiderCluster` on its own.
 *
 * Only code "P" transactions count (unchanged from the original headcount
 * version - grants/exercises/gifts/sales are ignored). Real Form 4 joint
 * filings don't attribute individual transactions to individual owners in
 * this parser's simplified schema (nor, generally, in the raw XML for a
 * jointly-filed report) - every reporting owner named on a filing with at
 * least one P transaction is weighted using that filing's LARGEST P
 * transaction's dollar amount as the significance basis (disclosed
 * interpretation, see ai/decisions.md). A given buyer's contribution to a
 * ticker's weightedScore is the MAX weight across all their qualifying
 * appearances in the window (not summed per-transaction), so one person's
 * multiple purchases don't inflate the score beyond what a single
 * strongest purchase would earn them.
 */
export function aggregateInsiderClusters(
  filings: ParsedForm4Filing[],
  lookbackDays: number,
  config: InsiderWeightingConfig,
  now: Date,
): Map<string, InsiderClusterResult> {
  const cutoff = now.getTime() - lookbackDays * DAY_MS;

  const buyerWeightByTicker = new Map<string, Map<string, number>>();
  const latestDateByTicker = new Map<string, string>();

  for (const filing of filings) {
    const filedMs = new Date(filing.dateFiled).getTime();
    if (filedMs < cutoff || filedMs > now.getTime()) continue;

    const purchases = filing.transactions.filter((t) => t.transactionCode === "P");
    if (purchases.length === 0) continue;

    let bestShares: number | null = null;
    let bestPrice: number | null = null;
    let bestAmount = -Infinity;
    for (const t of purchases) {
      const amount = t.shares !== null && t.pricePerShare !== null ? t.shares * t.pricePerShare : null;
      if (amount !== null && amount > bestAmount) {
        bestAmount = amount;
        bestShares = t.shares;
        bestPrice = t.pricePerShare;
      }
    }
    if (bestShares === null && bestPrice === null) {
      bestShares = purchases[0].shares;
      bestPrice = purchases[0].pricePerShare;
    }

    const buyerWeights = buyerWeightByTicker.get(filing.ticker) ?? new Map<string, number>();
    for (const owner of filing.reportingOwners) {
      const weight = transactionWeight(owner, bestShares, bestPrice, config);
      const existing = buyerWeights.get(owner.cik);
      if (existing === undefined || weight > existing) buyerWeights.set(owner.cik, weight);
    }
    buyerWeightByTicker.set(filing.ticker, buyerWeights);

    const current = latestDateByTicker.get(filing.ticker);
    if (!current || filing.dateFiled > current) {
      latestDateByTicker.set(filing.ticker, filing.dateFiled);
    }
  }

  const out = new Map<string, InsiderClusterResult>();
  for (const [ticker, buyerWeights] of buyerWeightByTicker) {
    const weightedScore = [...buyerWeights.values()].reduce((a, b) => a + b, 0);
    const mostRecent = latestDateByTicker.get(ticker) ?? null;
    const lagDays = mostRecent ? Math.round((now.getTime() - new Date(mostRecent).getTime()) / DAY_MS) : null;
    out.set(ticker, {
      ticker,
      distinctBuyerCount: buyerWeights.size,
      weightedScore,
      insiderCluster: weightedScore >= config.insiderWeighting.clusterMinWeightedScore,
      mostRecentPurchaseDate: mostRecent,
      lagDays,
    });
  }
  return out;
}
