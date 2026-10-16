/**
 * Re-pushes already-completed local runs to Supabase `atlas_runs`.
 *
 * A screen run's Supabase push is best-effort by design (pushRun.ts logs and
 * returns rather than throwing), so a run whose push was skipped or failed -
 * missing key, network, a table emptied since - had no way back onto the web
 * except re-running the whole screen (~16 min hot, hours cold). This replays
 * the push from the run's own saved screen_run.json through the very same
 * pushRunToSupabase(); nothing is recomputed, so the row is what the original
 * push would have written.
 *
 * Idempotent: a run whose runMeta.timestamp already has an atlas_runs row is
 * skipped, so `--all` is safe to repeat. The check is one filtered query per
 * run (PostgREST compares timestamptz as an instant, so the "+00:00" vs "Z"
 * spelling difference noted in refresh-report.ts doesn't matter), made
 * immediately before that run's insert - so it is not capped by a page size
 * and sees a row this same invocation just wrote. atlas_runs has no unique
 * constraint on run_timestamp, so this check is the only guard; two pushes
 * racing each other could still both insert.
 *
 * Exits non-zero if any push failed (pushRunToSupabase only logs).
 *
 * Usage: npx tsx scripts/push-run.ts --run-id 2026-09-05_1006
 *        npx tsx scripts/push-run.ts --all
 * Requires SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY in .env (same as pushRun.ts).
 */
import "dotenv/config";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { pushRunToSupabase } from "../src/report/supabase/pushRun.js";
import type { ScreenRunResult } from "../src/screen/pipeline.js";

const BASE_DIR = "output/runs";

function credentials(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("[push-run] SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY not set in .env - nothing to push to");
    process.exit(1);
  }
  return { url, key };
}

async function runAlreadyPushed(runTimestamp: string): Promise<boolean> {
  const { url, key } = credentials();
  const ts = encodeURIComponent(new Date(runTimestamp).toISOString());
  const res = await fetch(`${url}/rest/v1/atlas_runs?select=id&run_timestamp=eq.${ts}&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) {
    throw new Error(`could not read atlas_runs: HTTP ${res.status} ${await res.text()}`);
  }
  return ((await res.json()) as unknown[]).length > 0;
}

function targetFolders(argv: string[]): string[] {
  if (argv.includes("--all")) {
    if (!existsSync(BASE_DIR)) return [];
    return readdirSync(BASE_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory() && existsSync(`${BASE_DIR}/${e.name}/screen_run.json`))
      .map((e) => e.name)
      .sort();
  }
  const idx = argv.indexOf("--run-id");
  const runId = idx >= 0 ? argv[idx + 1] : undefined;
  if (!runId) {
    console.error("Usage: npx tsx scripts/push-run.ts --run-id <output/runs folder name> | --all");
    process.exit(1);
  }
  if (!existsSync(`${BASE_DIR}/${runId}/screen_run.json`)) {
    console.error(`[push-run] no ${BASE_DIR}/${runId}/screen_run.json`);
    process.exit(1);
  }
  return [runId];
}

async function main(): Promise<void> {
  const folders = targetFolders(process.argv.slice(2));
  if (!folders.length) {
    console.error(`[push-run] no runs found under ${BASE_DIR}`);
    return;
  }
  credentials();

  let failed = 0;
  for (const folder of folders) {
    const result = JSON.parse(readFileSync(`${BASE_DIR}/${folder}/screen_run.json`, "utf-8")) as ScreenRunResult;
    if (await runAlreadyPushed(result.runMeta.timestamp)) {
      console.error(`[push-run] ${folder}: already in atlas_runs (${result.runMeta.timestamp}), skipped`);
      continue;
    }
    console.error(`[push-run] ${folder}: pushing (${result.runMeta.timestamp})`);
    if (!(await pushRunToSupabase(result))) failed++;
  }
  if (failed) {
    console.error(`[push-run] ${failed} push(es) failed - see the lines above`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(`[push-run] failed: ${(e as Error).message}`);
  // exitCode, not exit(): exiting while a fetch handle is still closing trips
  // a libuv assertion on Windows (Node 24) and the process aborts instead.
  process.exitCode = 1;
});
