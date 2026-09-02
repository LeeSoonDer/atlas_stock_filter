/**
 * claude_code_design_draft.md §7.1: "先只改一份用真实 screen_run.json 渲染出的
 * report.html 给我看,确认视觉后再动生成器的其余分支". This script re-renders
 * a report.html from an EXISTING, already-stored screen_run.json (+ the
 * still-warm output/checkpoint.json for OHLCV/sparkline data) - zero live
 * network calls, zero re-run of the screen itself, purely exercising the
 * new renderReport()/footprintStrength code against real prior output.
 *
 * Usage: npx tsx scripts/preview-report.ts <output/runs/DATE> [outFile]
 * Never overwrites the real run's own report.html or output/latest.html -
 * writes to a separate, clearly-labeled preview path only.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { renderReport } from "../src/report/html/index.js";
import type { HtmlReportCandidateInput, HtmlWatchlistInput, ReportInput } from "../src/report/html/types.js";
import type { DetectorsConfig } from "../src/screen/indicators/types.js";
import type { SelectConfig } from "../src/screen/select/types.js";
import { allDetectors } from "../src/screen/detectors/index.js";
import { computeFootprintStrength, mergeFootprintDetail } from "../src/report/footprint/footprintStrength.js";
import { computeRiskLevel } from "../src/screen/credit_regime/types.js";
import type { OptionsIntelligence } from "../src/data/options/types.js";

/** options intelligence was never persisted to screen_run.json (it's
 * computed post-selection, in-memory only, in pipeline.ts) - honestly
 * unavailable on re-render rather than re-fetched (this script makes zero
 * network calls by design), matching this codebase's own 不可得 convention. */
const UNAVAILABLE_OPTIONS_INTELLIGENCE: OptionsIntelligence = {
  volumeOiRatioMax: null,
  volumeOiRatioAnomaly: null,
  nearOtmCallOi: null,
  nearOtmCallOiChange: null,
  putCallRatio: null,
  putCallRatioChange: null,
  atmImpliedVol: null,
  ivMove: null,
  availability: "不可得",
};
import type { LatentAccumulationConfig } from "../src/screen/indicators/types.js";
import detectorsConfigJson from "../config/detectors.json" with { type: "json" };
import card04ConfigJson from "../config/card04.json" with { type: "json" };
import card05ConfigJson from "../config/card05.json" with { type: "json" };
import card09ConfigJson from "../config/card09.json" with { type: "json" };

const runDir = process.argv[2];
const outFile = process.argv[3] ?? `${runDir}/report-preview-v2.html`;
if (!runDir) {
  console.error("usage: npx tsx scripts/preview-report.ts <output/runs/DATE> [outFile]");
  process.exit(1);
}

const detectorsConfig = detectorsConfigJson as DetectorsConfig;
const card04Config = card04ConfigJson as { shortInterest: { significantDeclinePercent: number; squeezeMinFloatPercent: number }; detectorD: { minConditionsRequired: number } };
const card05Config = card05ConfigJson as SelectConfig;
const card09Config = card09ConfigJson as LatentAccumulationConfig;
const combinedDetectorsConfig: DetectorsConfig = {
  ...detectorsConfig,
  detectorD_institutionalAccumulation: {
    minConditionsRequired: card04Config.detectorD.minConditionsRequired,
    shortInterestSignificantDeclinePercent: card04Config.shortInterest.significantDeclinePercent,
    squeezeMinFloatPercent: card04Config.shortInterest.squeezeMinFloatPercent,
  },
  latentAccumulation: {
    strengthBonusPerFlag: card09Config.latentAccumulation.strengthBonusPerFlag,
  },
};

console.error(`[preview] reading ${runDir}/screen_run.json ...`);
const run = JSON.parse(readFileSync(`${runDir}/screen_run.json`, "utf-8"));

console.error(`[preview] reading output/checkpoint.json for OHLCV (this is the slow part, ~270MB) ...`);
let checkpoint: { enrichResults?: Record<string, { ohlcv?: Array<{ close: number }> }> } = {};
try {
  checkpoint = JSON.parse(readFileSync("output/checkpoint.json", "utf-8"));
} catch (e) {
  console.error(`[preview] no checkpoint available (${(e as Error).message}) - sparklines will render empty, honestly, not fabricated.`);
}

function closes90dFor(symbol: string): number[] {
  const ohlcv = checkpoint.enrichResults?.[symbol]?.ohlcv ?? [];
  return ohlcv.slice(-90).map((b) => b.close);
}

const symbolsByTicker = new Map<string, any>(run.symbols.map((s: any) => [s.symbol, s]));

function footprintFor(symbol: string, buckets: string[]) {
  const s = symbolsByTicker.get(symbol);
  const results = s ? allDetectors.map((d) => d.detect(s.flags, s.profile, combinedDetectorsConfig)) : [];
  const conditionsByBucket = new Map(results.map((r) => [r.detectorId, r.conditions]));
  const detail = mergeFootprintDetail(buckets, conditionsByBucket);
  const strength = computeFootprintStrength(detail, card05Config.footprintStrengthBands);
  return { detail, strength };
}

const creditRegimeTight = run.runMeta.creditRegime?.label === "tight";

const htmlCandidates: HtmlReportCandidateInput[] = run.selection.candidates
  .map((c: any) => {
    const s = symbolsByTicker.get(c.symbol);
    const { detail, strength } = footprintFor(c.symbol, c.allBucketsHit);
    return {
      symbol: c.symbol,
      securityName: s?.securityName ?? c.symbol,
      profile: s?.profile ?? "STANDARD",
      speculative: s?.speculative ?? false,
      riskLevel: computeRiskLevel(s?.speculative ?? false, creditRegimeTight),
      primaryBucket: c.primaryBucket,
      primaryBucketScore: c.primaryBucketScore,
      allBucketsHit: c.allBucketsHit,
      promoted: c.promoted,
      flags: s?.flags,
      fundamentals: s?.fundamentals,
      eventWindow: s?.eventWindow,
      sectorRank: s?.sectorRank,
      pivotHigh: null,
      pivotLow: null,
      closes90d: closes90dFor(c.symbol),
      fmp: undefined,
      optionsIntelligence: UNAVAILABLE_OPTIONS_INTELLIGENCE,
      footprintDetail: detail,
      footprintStrength: strength,
    };
  })
  .sort((a: HtmlReportCandidateInput, b: HtmlReportCandidateInput) => {
    if (a.footprintStrength.ratio === null && b.footprintStrength.ratio === null) return 0;
    if (a.footprintStrength.ratio === null) return 1;
    if (b.footprintStrength.ratio === null) return -1;
    return b.footprintStrength.ratio - a.footprintStrength.ratio;
  });

const watchlistForHtml: HtmlWatchlistInput[] = run.selection.watchlist.map((w: any) => {
  const s = symbolsByTicker.get(w.symbol);
  const { detail, strength } = footprintFor(w.symbol, s?.buckets ?? []);
  return {
    symbol: w.symbol,
    securityName: s?.securityName ?? w.symbol,
    reason: w.reason,
    footprintDetail: detail,
    footprintStrength: strength,
  };
});

const reportInput: ReportInput = {
  runMeta: {
    timestamp: run.runMeta.timestamp,
    profileArg: run.runMeta.profileArg,
    gatesPassedCount: run.runMeta.gatesPassedCount,
    detectorSummary: run.runMeta.detectorSummary,
  },
  marketRegime: run.runMeta.marketRegime,
  creditRegime: run.runMeta.creditRegime,
  smallSpecForcedDisabled: run.runMeta.smallSpecForcedDisabled,
  sectorFootprints: run.runMeta.sectorFootprints,
  sectorFlowScan: run.runMeta.sectorFlowScan,
  hotSectorDetail: run.runMeta.hotSectorDetail,
  candidates: htmlCandidates,
  watchlist: watchlistForHtml,
  promotedThisRun: run.selection.promotedThisRun,
  ledgerPendingBackfill: [],
  ledgerInvalidated: [],
};

const html = renderReport(reportInput);
mkdirSync(runDir, { recursive: true });
writeFileSync(outFile, html, "utf-8");
console.error(`[preview] wrote ${outFile} (${html.length} bytes) - real data from ${runDir}, zero network calls, zero fabrication.`);
console.error(`[preview] candidates: ${htmlCandidates.map((c) => `${c.symbol}(${c.footprintStrength.band})`).join(", ")}`);
