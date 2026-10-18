/**
 * Re-renders an Atlas run's report.html with any saved Radar output woven
 * into the 待研究层填充 placeholders, then re-pushes it to Supabase.
 *
 * Input: the run's own report_input.json - the exact ReportInput the screen
 * rendered from - plus Radar's layer from Supabase: per-candidate
 * `atlas_reviews` rows (kind='radar_brief') into
 * `radarNarrative.candidateVerdicts`, and the run's market-level narrative
 * (`atlas_runs.radar_narrative`: 大盘复盘, sector-flow summary, hot-sector
 * verdicts, themes, exclusions, weekly summary) into the rest of
 * radarNarrative. Nothing is recomputed and no market data is fetched, so a
 * refresh takes seconds. Runs saved before report_input.json existed fall
 * back to reconstructReportInput() - see its comment for what that loses.
 * The as-scanned report is kept as report.scan.html before the first
 * overwrite.
 *
 * Usage: npx tsx scripts/refresh-report.ts [--run-id <supabase-atlas_runs-id>]
 * Defaults to the most recent Supabase atlas_runs row. Requires
 * SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY in .env (same as pushRun.ts).
 */
import "dotenv/config";
import { readFileSync, writeFileSync, readdirSync, existsSync, copyFileSync } from "node:fs";
import { renderReport } from "../src/report/html/index.js";
import type {
  HtmlReportCandidateInput,
  HtmlWatchlistInput,
  ReportInput,
  RadarCandidateVerdict,
  RadarExcludedNoteInput,
  RadarNarrativeInput,
  RadarThemeInput,
} from "../src/report/html/types.js";
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

class SupabaseError extends Error {
  constructor(readonly status: number, readonly body: string, path: string) {
    super(`Supabase GET ${path} failed: HTTP ${status} ${body}`);
  }
}

async function supabaseGet(path: string): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY!, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) throw new SupabaseError(res.status, await res.text(), path);
  return res.json();
}

/** True only for PostgREST's "that column doesn't exist" answer (HTTP 400,
 * code 42703 / PGRST204, naming radar_narrative) - judged from the response
 * body, not the error message, which always contains the request path and so
 * would also match a timeout or a 500 on that same request. */
function isMissingNarrativeColumn(e: unknown): boolean {
  return (
    e instanceof SupabaseError &&
    e.status === 400 &&
    /radar_narrative/.test(e.body) &&
    /42703|PGRST204|does not exist|schema cache/i.test(e.body)
  );
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

/** atlas_runs.radar_narrative as Stockpit's POST /api/atlas/narrative stored
 * it (already validated there, lib/atlas-narrative.ts). Only the known keys
 * are carried into the render - candidateVerdicts in particular can never
 * come from here, only from atlas_reviews. The renderer escapes every
 * string, so this does shape selection, not sanitising. */
function pickMarketNarrative(raw: unknown): Omit<RadarNarrativeInput, "candidateVerdicts"> | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const n = raw as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : undefined);
  const out: Omit<RadarNarrativeInput, "candidateVerdicts"> = {
    marketRecapParagraph: str(n.marketRecapParagraph),
    sectorFlowSummaryLine: str(n.sectorFlowSummaryLine),
    weeklyForecast: str(n.weeklyForecast),
    // Keyed by HotSectorEntry.name. The payload prints each heading with a
    // bracketed kind after it ("科技/软件 [板块]", "AI 基建 [篮子近似] (...)"),
    // so a key copied whole from the payload is cut back to the bare name.
    hotSectorVerdicts:
      typeof n.hotSectorVerdicts === "object" && n.hotSectorVerdicts !== null && !Array.isArray(n.hotSectorVerdicts)
        ? Object.fromEntries(
            Object.entries(n.hotSectorVerdicts as Record<string, string>).map(([name, text]) => [name.replace(/\s*\[.*$/, "").trim(), text]),
          )
        : undefined,
    emergingThemes: Array.isArray(n.emergingThemes) ? (n.emergingThemes as RadarThemeInput[]) : undefined,
    excludedNotes: Array.isArray(n.excludedNotes) ? (n.excludedNotes as RadarExcludedNoteInput[]) : undefined,
  };
  const present = Object.entries(out).filter(([, v]) => v !== undefined).map(([k]) => k);
  console.error(`[refresh-report] market narrative: ${present.length > 0 ? present.join(", ") : "(none saved)"}`);
  return present.length > 0 ? out : null;
}

async function main() {
  const runIdArgIdx = process.argv.indexOf("--run-id");
  const requestedRunId = runIdArgIdx >= 0 ? process.argv[runIdArgIdx + 1] : undefined;

  const runFilter = requestedRunId ? `id=eq.${requestedRunId}` : `order=run_timestamp.desc&limit=1`;
  // radar_narrative is a later column (Stockpit's supabase/schema.sql); a
  // database that hasn't applied it yet still refreshes candidate verdicts.
  let runs: any[];
  try {
    runs = await supabaseGet(`atlas_runs?${runFilter}&select=id,run_timestamp,radar_narrative`);
  } catch (e) {
    if (!isMissingNarrativeColumn(e)) throw e;
    console.error("[refresh-report] atlas_runs.radar_narrative column not present yet - market-level narrative skipped (apply Stockpit's supabase/schema.sql)");
    runs = await supabaseGet(`atlas_runs?${runFilter}&select=id,run_timestamp`);
  }
  if (!runs.length) {
    console.error(requestedRunId ? `[refresh-report] no atlas_runs row for id ${requestedRunId}` : "[refresh-report] no atlas_runs rows exist yet");
    process.exit(1);
  }
  const { id: atlasRunId, run_timestamp: runTimestamp } = runs[0];
  const marketNarrative = pickMarketNarrative(runs[0].radar_narrative);
  console.error(`[refresh-report] target run: ${atlasRunId} (${runTimestamp})`);

  const runDir = findRunFolderByTimestamp(runTimestamp);
  if (!runDir) {
    console.error(`[refresh-report] no local output/runs/* folder found with runMeta.timestamp=${runTimestamp} - this machine may not be the one that produced this run.`);
    process.exit(1);
  }
  console.error(`[refresh-report] local run folder: ${runDir}`);

  // Briefs are inserted, never upserted, so a resaved brief leaves two rows
  // for one symbol. Oldest first: the loop below lets the newest one win.
  const reviews = await supabaseGet(
    `atlas_reviews?atlas_run_id=eq.${atlasRunId}&kind=eq.radar_brief&select=symbol,grade,probability,confidence,desc_text&order=created_at.asc`,
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

  const savedInputPath = `${runDir}/report_input.json`;
  let baseInput: ReportInput;
  if (existsSync(savedInputPath)) {
    baseInput = JSON.parse(readFileSync(savedInputPath, "utf-8")) as ReportInput;
    console.error(`[refresh-report] using ${savedInputPath} - the scan-time render input, nothing recomputed`);
  } else {
    console.error(
      `[refresh-report] WARNING: ${runDir} has no report_input.json (it predates 2026-10-17) - reconstructing from screen_run.json; sector_contagion conditions and leader/lag rows, options intelligence and the scan-time ledger state cannot be recovered and will render as 不可得`,
    );
    baseInput = reconstructReportInput(runDir);
  }

  const hasVerdicts = Object.keys(candidateVerdicts).length > 0;
  const reportInput: ReportInput = {
    ...baseInput,
    radarNarrative: hasVerdicts || marketNarrative ? { ...(marketNarrative ?? {}), ...(hasVerdicts ? { candidateVerdicts } : {}) } : undefined,
  };

  if (marketNarrative?.hotSectorVerdicts) {
    const known = new Set(reportInput.hotSectorDetail.map((h) => h.name));
    const unmatched = Object.keys(marketNarrative.hotSectorVerdicts).filter((name) => !known.has(name));
    if (unmatched.length > 0) {
      console.error(
        `[refresh-report] WARNING: hotSectorVerdicts for ${unmatched.map((n) => `"${n}"`).join(", ")} match no hot sector in this run (have: ${[...known].join(", ")}) - those verdicts will not render; resave keyed by the payload's 热门领域详述 names (the part before any [..])`,
      );
    }
  }

  const html = renderReport(reportInput);
  // Keep the as-scanned report once, before the first refresh overwrites it.
  const scanCopy = `${runDir}/report.scan.html`;
  if (!existsSync(scanCopy) && existsSync(`${runDir}/report.html`)) copyFileSync(`${runDir}/report.html`, scanCopy);
  writeFileSync(`${runDir}/report.html`, html, "utf-8");
  // latest.html points at the newest run; only the default target (the most
  // recent atlas_runs row) may replace it, never an older run picked by id.
  if (!requestedRunId) writeFileSync("output/latest.html", html, "utf-8");
  console.error(`[refresh-report] wrote ${runDir}/report.html (${html.length} bytes)`);

  await supabasePatch(`atlas_runs?id=eq.${atlasRunId}`, { report_html: html, report_refreshed_at: new Date().toISOString() });
  console.error(`[refresh-report] Supabase atlas_runs row ${atlasRunId} updated`);
}

/**
 * Fallback for runs saved before report_input.json existed (2026-10-17):
 * rebuilds a ReportInput from screen_run.json + output/checkpoint.json, the
 * way preview-report.ts does. Some of the original render can't be recovered
 * that way, because the pipeline only ever held it in memory: the
 * sector_contagion evaluation (its conditions, leader/lag row and high-beta
 * flag), options intelligence, and the ledger's state at scan time. Those
 * render as 不可得 here - honest, but poorer than the scan-time report, which
 * is why main() keeps a copy of that original before overwriting it.
 */
function reconstructReportInput(runDir: string): ReportInput {
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
  /** Mirrors config/card09.json's trendStrength.rangeBoundThreshold - this script reads saved run data only, so the threshold is restated rather than importing live config. */
  const RANGE_BOUND_THRESHOLD = 20;

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
        // TASK_CARD_09_STANDBY item 5: re-derived from the saved run's own
        // flags (a run saved before that card has no adx14 and gets `false`).
        rangeBoundWarning:
          (c.allBucketsHit ?? []).includes("momentum_breakout") &&
          typeof s?.flags?.adx14 === "number" &&
          s.flags.adx14 < RANGE_BOUND_THRESHOLD,
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

  return {
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
    // TASK_CARD_08 Part C / item 7: a run saved before those cards recorded
    // neither - an explicit "unknown" beats invented breadth numbers.
    breadth: run.runMeta.breadth ?? {
      pctAboveSma200: null, pctAboveSma50: null, newHighCount: 0, newLowCount: 0, newHighLowRatio: null,
      state: "unknown" as const, breadthDivergence: false, sma200SampleSize: 0, sma50SampleSize: 0,
      stateUnavailableReason: "This saved run predates TASK_CARD_08 Part C - no breadth data was recorded",
    },
    concentrationWarnings: run.runMeta.concentrationWarnings ?? [],
    candidates: htmlCandidates,
    watchlist: watchlistForHtml,
    promotedThisRun: run.selection.promotedThisRun,
    // The ledger's state at scan time was never saved with the run, and this
    // script reads saved data only - so on a re-render it is unknown, not 0.
    ledgerPendingBackfill: null,
    ledgerInvalidated: null,
  };
}

main().catch((e) => {
  console.error(`[refresh-report] fatal error: ${(e as Error).stack ?? e}`);
  process.exit(1);
});
