import { readFileSync } from "node:fs";
import type { ScreenRunResult } from "../../screen/pipeline.js";

/**
 * Cockpit↔Atlas web integration: pushes one row per run into the shared
 * Supabase `atlas_runs` table (schema in the Cockpit repo's
 * supabase/schema.sql) so Cockpit's web UI — local or deployed — can list
 * and render this run without ever touching this machine's filesystem.
 *
 * Same graceful-degradation convention as this repo's other optional
 * integrations (FMP/FRED/SEC EDGAR user agent): a missing key or a network
 * failure logs a message and returns, never throws — a screen run's local
 * artifacts (ATLAS_PAYLOAD.txt, report.html, etc.) are already complete and
 * correct by the time this runs, so this step failing must never be
 * mistaken for the run itself failing.
 *
 * Deliberately does not use the @supabase/supabase-js SDK — this repo's
 * dependency footprint stays minimal (dotenv + yahoo-finance2 only), and a
 * single REST insert doesn't need a client library.
 */
export async function pushRunToSupabase(result: ScreenRunResult): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "[screen] Supabase push skipped (SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY not set in .env) - local artifacts are still complete, Cockpit web view just won't see this run",
    );
    return;
  }

  const reportHtml = readFileSync(result.selection.htmlReportPath, "utf-8");
  const atlasPayloadText = readFileSync(result.selection.atlasPayloadPath, "utf-8");
  const dissentPayloadText = readFileSync(result.selection.dissentPayloadPath, "utf-8");
  const runDate = result.runMeta.timestamp.slice(0, 10);

  const row = {
    run_date: runDate,
    run_timestamp: result.runMeta.timestamp,
    profile_arg: result.runMeta.profileArg,
    candidate_count: result.selection.candidates.length,
    watchlist_count: result.selection.watchlist.length,
    gates_passed_count: result.runMeta.gatesPassedCount,
    report_html: reportHtml,
    atlas_payload_text: atlasPayloadText,
    atlas_dissent_payload_text: dissentPayloadText,
  };

  try {
    const res = await fetch(`${url}/rest/v1/atlas_runs`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(row),
    });
    if (!res.ok) {
      console.error(
        `[screen] Supabase push failed: HTTP ${res.status} ${await res.text()} - local artifacts are still complete, not blocking`,
      );
      return;
    }
    console.error(`[screen] Supabase push done: atlas_runs row written for ${runDate}`);
  } catch (e) {
    console.error(
      `[screen] Supabase push failed: ${(e as Error).message} - local artifacts are still complete, not blocking`,
    );
  }
}
