import "dotenv/config";
import { runScreen, writeScreenOutput } from "./pipeline.js";
import type { ProfileArg } from "./types.js";
import { pushRunToSupabase } from "../report/supabase/pushRun.js";

const VALID_PROFILES: ProfileArg[] = ["standard", "small_spec", "both"];

function parseArgs(argv: string[]): ProfileArg {
  const idx = argv.indexOf("--profile");
  const value = idx >= 0 ? argv[idx + 1] : undefined;
  if (!value || !VALID_PROFILES.includes(value as ProfileArg)) {
    console.error(`Usage: npm run screen -- --profile <standard|small_spec|both>`);
    process.exit(1);
  }
  return value as ProfileArg;
}

async function main(): Promise<void> {
  const profileArg = parseArgs(process.argv.slice(2));
  console.error(`[cli] Atlas Layer 1 screen starting, profile=${profileArg}`);

  const result = await runScreen(profileArg);
  const path = writeScreenOutput(result);
  await pushRunToSupabase(result);

  console.error(`[cli] done in ${result.runMeta.elapsedMs}ms`);
  console.error(`[cli] output written to ${path}`);
  console.error(`[cli] gatesPassedCount=${result.runMeta.gatesPassedCount}`);
}

main().catch((err) => {
  console.error(`[cli] fatal error: ${(err as Error).stack ?? err}`);
  process.exit(1);
});
