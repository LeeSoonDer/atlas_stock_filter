import "dotenv/config";
import { pullLedgerFromSupabase, pushLedgerToSupabase } from "./supabaseSync.js";

/**
 * Manual two-way ledger sync (`npm run ledger:sync`). The same two calls
 * also run automatically around every `npm run screen` (pull before, push
 * after) - this standalone command exists for when you backfilled an
 * outcome from the web and want it in the local ledger without waiting for
 * the next screen run.
 */
async function main(): Promise<void> {
  await pullLedgerFromSupabase();
  await pushLedgerToSupabase();
}

main().catch((err) => {
  console.error(`[ledger-sync] fatal error: ${(err as Error).stack ?? err}`);
  process.exit(1);
});
