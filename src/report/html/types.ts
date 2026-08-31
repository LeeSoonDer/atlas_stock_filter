import type { PayloadCandidateInput } from "../payload/types.js";
import type { MarketRegimeSnapshot } from "../../screen/regime/types.js";
import type { SectorFootprint } from "../../screen/sector_footprint/types.js";
import type { HotSectorEntry, SectorFlowEntry } from "../../screen/sector_scan/types.js";
import type { ScreeningLedgerEntry } from "../../ledger/types.js";
import type { FmpEnrichmentResult } from "../../data/enrich/types.js";
import type { FootprintCondition } from "../../screen/detectors/IDetector.js";
import type { FootprintStrength } from "../footprint/footprintStrength.js";

export interface HtmlReportCandidateInput extends PayloadCandidateInput {
  closes90d: number[];
  fmp: FmpEnrichmentResult | undefined;
  /** claude_code_design_draft.md §1.1/§1.2 - derived from the real detector
   * comparisons this candidate's triggered bucket(s) already made, never
   * fabricated. Merged across all of allBucketsHit for a multi-bucket hit. */
  footprintDetail: FootprintCondition[];
  footprintStrength: FootprintStrength;
}

export interface HtmlWatchlistInput {
  symbol: string;
  securityName: string;
  reason: "compression_unselected" | "near_miss";
  footprintDetail: FootprintCondition[];
  footprintStrength: FootprintStrength;
}

/**
 * TASK_CARD_07 Part C. Every field here is text/structured content that
 * can only come from the Radar reasoning environment (external to this
 * repo) - the "关键边界" architecture rule ("应用层只做数据与渲染,绝不生成
 * 任何判断/预测/白话文字") means this whole object is optional and, when
 * absent or partially filled, renderReport.ts must show a literal
 * placeholder rather than ever synthesizing its own prose. See
 * ai/decisions.md for which mockup v4 sections this covers.
 */
export interface RadarThemeInput {
  name: string;
  strengthLabel: "强" | "中" | "弱";
  lifecycleStage: "萌芽" | "发酵" | "爆发" | "衰竭";
  /** Fact bullets (e.g. "板块挤压密度 23.2%") - still Radar-authored text, rendered verbatim, not app-generated. */
  footprints: string[];
  members: string[];
  verdictText: string;
  falsifiableWatchpoints?: string[];
}

export interface RadarExcludedNoteInput {
  symbols: string[];
  reason: string;
}

/**
 * Mirrors the DISSENT payload skeleton's own blank fields (评级/概率评分/
 * 确信度评分, see generateDissentPayload.ts) - this repo has no way to
 * compute a reprice probability or confidence score itself; these only
 * ever come from a completed Radar pass.
 */
export interface RadarCandidateVerdict {
  grade?: string;
  probability?: number;
  confidence?: number;
  descText?: string;
}

export interface RadarNarrativeInput {
  marketRecapParagraph?: string;
  sectorFlowSummaryLine?: string;
  /** Keyed by HotSectorEntry.name. */
  hotSectorVerdicts?: Record<string, string>;
  emergingThemes?: RadarThemeInput[];
  /** Keyed by candidate symbol. */
  candidateVerdicts?: Record<string, RadarCandidateVerdict>;
  excludedNotes?: RadarExcludedNoteInput[];
  weeklyForecast?: string;
}

export interface ReportInput {
  runMeta: {
    timestamp: string;
    profileArg: string;
    gatesPassedCount: number;
    /** claude_code_design_draft.md §2 layer 01: total per-bucket trigger
     * counts this run, needed for the "四桶总命中次数" summary line and the
     * "零命中的桶" legend at the foot of layer 02 - both pure re-renders of
     * data the pipeline already computes (ScreenRunResult.runMeta.detectorSummary),
     * never app-synthesized. */
    detectorSummary: Record<string, { triggeredCount: number }>;
  };
  marketRegime: MarketRegimeSnapshot;
  sectorFootprints: SectorFootprint[];
  /** TASK_CARD_07 Part A/C: all 11 SPDR sectors, ranked by this week's return. */
  sectorFlowScan: SectorFlowEntry[];
  /** TASK_CARD_07 Part A/C: named hot sectors + any real sector flagged footprintAnomaly this run but not already named. */
  hotSectorDetail: HotSectorEntry[];
  candidates: HtmlReportCandidateInput[];
  watchlist: HtmlWatchlistInput[];
  promotedThisRun: string[];
  ledgerPendingBackfill: ScreeningLedgerEntry[];
  ledgerInvalidated: Array<{ screening: ScreeningLedgerEntry; invalidatedAt: string }>;
  /** TASK_CARD_07 Part C: absent on a pure-screen run (no Radar pass yet) - every prose slot this feeds must show a placeholder, never app-generated text, when undefined. */
  radarNarrative?: RadarNarrativeInput;
}
