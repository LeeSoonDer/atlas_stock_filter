/**
 * Re-renders an Atlas run's report.html with any saved Radar output woven
 * into the 待研究层填充 placeholders, then re-pushes it to Supabase.
 *
 * Reuses preview-report.ts's exact ReportInput-reconstruction approach
 * (read the run's screen_run.json + output/checkpoint.json, zero network
 * calls, zero re-run of the screen itself) and adds one thing on top:
 * fetches this run's `atlas_reviews` rows (kind='radar_brief') from
 * Supabase and threads them into `radarNarrative.candidateVerdicts`.
 *
 * Only candidateVerdicts gets populated this way — ATLAS_RADAR_INSTRUCTIONS.md's
 * actual scope is per-candidate briefs only, it does not produce market
 * recap / sector verdicts / emerging themes / weekly forecast content, so
 * those placeholders correctly stay "待研究层填充" even after a refresh.
 * That's not a bug here; closing that gap means expanding Radar's own
 * instructions, a separate decision outside this script's scope.
 *
 * Usage: npx tsx scripts/refresh-report.ts [--run-id <supabase-atlas_runs-id>]
 * Defaults to the most recent Supabase atlas_runs row. Requires
 * SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY in .env (same as pushRun.ts).
 */
import "dotenv/config";
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { renderReport } from "../src/report/html/index.js";
import type { HtmlReportCandidateInput, HtmlWatchlistInput, ReportInput, RadarCandidateVerdict } from "../src/report/html/types.js";
import type { DetectorsConfig } from "../src/screen/indicators/types.js";
import type { SelectConfig } from "../src/screen/select/types.js";
import { allDetectors } from "../src/screen/detectors/index.js";
import { computeFootprintStrength, mergeFootprintDetail } from "../src/report/footprint/footprintStrength.js";
import { computeRiskLevel } from "../src/screen/credit_regime/types.js";
import type { OptionsIntelligence } from "../src/data/options/types.js";

/** options intelligence was never persisted to screen_run.json (it's
 * computed post-selection, in-memory only, in pipeline.ts) - honestly
 * unavailable on re-render rather than re-fetched (these scripts make zero
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

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("[refresh-report] SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY not set in .env - nothing to refresh against.");
  process.exit(1);
}

async function supabaseGet(path: string): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY!, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase GET ${path} failed: HTTP ${res.status} ${await res.text()}`);
  return res.json();
}

async function supabasePatch(path: string, body: unknown): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_KEY!,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase PATCH ${path} failed: HTTP ${res.status} ${await res.text()}`);
}

/** screen_run.json's runMeta.timestamp is the one reliable key shared
 * between a local run folder and its Supabase atlas_runs row (local folder
 * NAMES can't be re-derived after the fact - resolveRunFolder()'s
 * exists-check logic is only correct at write time, for a fresh run).
 * Compared by parsed instant, not raw string equality - Postgres echoes
 * timestamptz back as "...+00:00" while the local JSON has "...Z"; same
 * instant, different string, verified live (both are 2026-09-01T16:39:24.797). */
function findRunFolderByTimestamp(runTimestamp: string): string | null {
  const targetMs = new Date(runTimestamp).getTime();
  const baseDir = "output/runs";
  if (!existsSync(baseDir)) return null;
  for (const entry of readdirSync(baseDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const candidate = `${baseDir}/${entry.name}`;
    const jsonPath = `${candidate}/screen_run.json`;
    if (!existsSync(jsonPath)) continue;
    try {
      const meta = JSON.parse(readFileSync(jsonPath, "utf-8"));
      if (new Date(meta.runMeta?.timestamp).getTime() === targetMs) return candidate;
    } catch {
      continue;
    }
  }
  return null;
}

async function main() {
  const runIdArgIdx = process.argv.indexOf("--run-id");
  const requestedRunId = runIdArgIdx >= 0 ? process.argv[runIdArgIdx + 1] : undefined;

  const query = requestedRunId
    ? `atlas_runs?id=eq.${requestedRunId}&select=id,run_timestamp`
    : `atlas_runs?order=run_timestamp.desc&limit=1&select=id,run_timestamp`;
  const runs = await supabaseGet(query);
  if (!runs.length) {
    console.error(requestedRunId ? `[refresh-report] no atlas_runs row for id ${requestedRunId}` : "[refresh-report] no atlas_runs rows exist yet");
    process.exit(1);
  }
  const { id: atlasRunId, run_timestamp: runTimestamp } = runs[0];
  console.error(`[refresh-report] target run: ${atlasRunId} (${runTimestamp})`);

  const runDir = findRunFolderByTimestamp(runTimestamp);
  if (!runDir) {
    console.error(`[refresh-report] no local output/runs/* folder found with runMeta.timestamp=${runTimestamp} - this machine may not be the one that produced this run.`);
    process.exit(1);
  }
  console.error(`[refresh-report] local run folder: ${runDir}`);

  const reviews = await supabaseGet(
    `atlas_reviews?atlas_run_id=eq.${atlasRunId}&kind=eq.radar_brief&select=symbol,grade,probability,confidence,desc_text`,
  );
  const candidateVerdicts: Record<string, RadarCandidateVerdict> = {};
  for (const r of reviews) {
    candidateVerdicts[r.symbol] = {
      grade: r.grade ?? undefined,
      probability: r.probability ?? undefined,
      confidence: r.confidence ?? undefined,
      descText: r.desc_text ?? undefined,
    };
  }
  console.error(`[refresh-report] ${reviews.length} radar_brief review(s) found for this run: ${Object.keys(candidateVerdicts).join(", ") || "(none)"}`);

  const detectorsConfig = detectorsConfigJson as DetectorsConfig;
  const card04Config = card04ConfigJson as {
    shortInterest: { significantDeclinePercent: number; squeezeMinFloatPercent: number };
    detectorD: { minConditionsRequired: number };
  };
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

  const run = JSON.parse(readFileSync(`${runDir}/screen_run.json`, "utf-8"));
  console.error(`[refresh-report] reading output/checkpoint.json for OHLCV (the slow part, ~270MB) ...`);
  let checkpoint: { enrichResults?: Record<string, { ohlcv?: Array<{ close: number }> }> } = {};
  try {
    checkpoint = JSON.parse(readFileSync("output/checkpoint.json", "utf-8"));
  } catch (e) {
    console.error(`[refresh-report] no checkpoint available (${(e as Error).message}) - sparklines will render empty, honestly, not fabricated.`);
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
    return { symbol: w.symbol, securityName: s?.securityName ?? w.symbol, reason: w.reason, footprintDetail: detail, footprintStrength: strength };
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
    radarNarrative: Object.keys(candidateVerdicts).length > 0 ? { candidateVerdicts } : undefined,
  };

  const html = renderReport(reportInput);
  writeFileSync(`${runDir}/report.html`, html, "utf-8");
  writeFileSync("output/latest.html", html, "utf-8"); // harmless if this wasn't actually the latest run; gets overwritten by the next real screen anyway
  console.error(`[refresh-report] wrote ${runDir}/report.html (${html.length} bytes)`);

  await supabasePatch(`atlas_runs?id=eq.${atlasRunId}`, { report_html: html, report_refreshed_at: new Date().toISOString() });
  console.error(`[refresh-report] Supabase atlas_runs row ${atlasRunId} updated`);
}

main().catch((e) => {
  console.error(`[refresh-report] fatal error: ${(e as Error).stack ?? e}`);
  process.exit(1);
});
