import type { PayloadCandidateInput } from "../payload/types.js";
import type { MarketRegimeSnapshot } from "../../screen/regime/types.js";
import type { SectorFootprint } from "../../screen/sector_footprint/types.js";
import type { ScreeningLedgerEntry } from "../../ledger/types.js";
import type { FmpEnrichmentResult } from "../../data/enrich/types.js";

export interface HtmlReportCandidateInput extends PayloadCandidateInput {
  closes90d: number[];
  fmp: FmpEnrichmentResult | undefined;
}

export interface HtmlWatchlistInput {
  symbol: string;
  securityName: string;
  reason: "compression_unselected" | "near_miss";
}

export interface ReportInput {
  runMeta: { timestamp: string; profileArg: string; gatesPassedCount: number };
  marketRegime: MarketRegimeSnapshot;
  sectorFootprints: SectorFootprint[];
  candidates: HtmlReportCandidateInput[];
  watchlist: HtmlWatchlistInput[];
  promotedThisRun: string[];
  ledgerPendingBackfill: ScreeningLedgerEntry[];
  ledgerInvalidated: Array<{ screening: ScreeningLedgerEntry; invalidatedAt: string }>;
}
