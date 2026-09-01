# Atlas ↔ Cockpit Web Integration — Implementation Status

> Written 2026-09-01. Read `ATLAS_COCKPIT_RELATIONSHIP.md` in this same folder first for the architecture rationale — this file is the concrete build log + remaining checklist.

## Decisions this build is based on (operator's answers, 2026-09-01)

- Multi-device scope: **view-only**. The scan trigger and the Claude-reasoning step (Radar/Red Team) permanently stay on the operator's own machine — no remote/OAuth MCP server needed.
- Scan trigger: **manual button**, not scheduled/cron.
- Journal migration: **full migration to Supabase**, which becomes the sole source of truth (local `data/journal.json` kept only as an inert backup).
- Local Cockpit persistence: **pm2** (chosen over Windows Task Scheduler) — auto-restart on crash, simple status/log commands.
- Account state: operator has **no Supabase or Vercel account yet** — full step-by-step signup included below.
- Also confirmed: the operator wants literal proof of a real frontend+backend ("展示我真的做出来了一个网页有前端后端") and minimum day-to-day friction — no `npm run dev` typed by hand once set up.

## What's already built (code complete, not yet tested — needs live credentials)

**Cockpit repo** (`stock-research-cockpit`):
- `supabase/schema.sql` — full schema: `journal_entries`, `atlas_runs`, `atlas_reviews`, `watchlist_items`, `app_settings`.
- `lib/supabase.ts` — server-only Supabase client (service-role key).
- `lib/journal-file-store.ts` — **rewritten** to be Supabase-backed. Exported function names/signatures (`readEntries`, `writeEntries`, `withJournalLock`, `findEntry`, `isWritable`) are unchanged, so **zero API route files needed to change** for this migration. `writeEntries()` reproduces the old file-store's "whole-array overwrite" semantics via upsert-all + delete-the-rest, so the existing DELETE-by-filtering pattern in `app/api/journal/[id]/route.ts` still works correctly.
- `app/atlas/page.tsx` + `app/atlas/[id]/page.tsx` — history list + detail view (report.html rendered in a sandboxed iframe).
- `app/api/atlas/runs/route.ts`, `app/api/atlas/runs/[id]/route.ts`, `app/api/atlas/latest/route.ts`, `app/api/atlas/reviews/route.ts`, `app/api/atlas/run/route.ts` — new API routes (list, detail, latest-for-MCP, save-review, trigger-run).
- `app/api/heartbeat/route.ts` + `vercel.json` — daily Vercel cron ping to keep Supabase's free tier from auto-pausing.
- `mcp-server/src/index.ts` + `mcp-server/README.md` — 4 new tools (`atlas_get_latest_payload`, `atlas_get_dissent_payload`, `atlas_save_radar_brief`, `atlas_save_dissent_verdict`), same thin-proxy pattern as the existing 6.
- `scripts/migrate-journal-to-supabase.js` — one-time journal migration, idempotent (safe to re-run), does not touch/delete the original `data/journal.json`.
- `ecosystem.config.js` — pm2 process definition for always-on local `npm run dev`.
- `components/nav-bar.tsx` — added "Atlas" nav link.
- `.env.example`, `package.json` — new env vars and dependencies documented/added (`@supabase/supabase-js`, `dotenv` dev-only).

**Atlas repo** (`atlas`):
- `src/report/supabase/pushRun.ts` — pushes one row to `atlas_runs` after every screen run (report.html + both payload texts + summary counts). Plain `fetch` to Supabase's REST endpoint, no new dependency — degrades silently (with a console message) if the Supabase env vars aren't set, matching this repo's existing FMP/FRED/SEC-key conventions exactly.
- `src/screen/cli.ts` — calls `pushRunToSupabase()` right after `writeScreenOutput()`.
- `.env.example` — new `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` vars documented.

**Deliberately not built yet** (needs a live Supabase project to design correctly against, or is a separate decision — see "Remaining" below): auth hardening beyond the existing single-password gate, the actual Vercel deployment, end-to-end testing of any of the above.

## Phase 0 — account creation (only the operator can do this)

### Supabase
1. Go to supabase.com → "Start your project" → sign in with GitHub (recommended, since the Cockpit repo is already there).
2. "New project" → name it (e.g. `cockpit-atlas`) → pick a strong database password (save it somewhere — this is separate from the API keys below) → pick a region (closest to you) → Free plan → Create.
3. Wait ~2 minutes for provisioning. Once ready: left sidebar → **SQL Editor** → New query → paste the entire contents of `supabase/schema.sql` → Run. Confirm no errors and that Table Editor shows the 5 new tables.
4. Left sidebar → **Project Settings → API**. Copy two values:
   - **Project URL** → this is `SUPABASE_URL`.
   - **`service_role` secret** (NOT the `anon`/`public` one) → this is `SUPABASE_SERVICE_ROLE_KEY`. Keep this one truly secret — it bypasses all access control.
5. Send me those two values (or paste them directly into `stock-research-cockpit/.env.local` and `atlas/.env` yourself, under the keys already scaffolded in each repo's `.env.example`).

### Vercel
1. Go to vercel.com → "Sign Up" → **Continue with GitHub** (same account that owns `LeeSoonDer/stock-research-cockpit`).
2. "Add New... → Project" → Import `LeeSoonDer/stock-research-cockpit` from the list (Vercel auto-detects Next.js, no config needed beyond env vars).
3. Before the first deploy, add Environment Variables (Project Settings → Environment Variables): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ACCESS_PASSWORD` (pick a real one, not the placeholder) — leave `IS_LOCAL_CONTROL_PLANE`/`ATLAS_REPO_PATH` unset here, since this deployment is view-only by design.
4. Deploy. You'll get a free `https://stock-research-cockpit-xxxx.vercel.app` URL (or a cleaner one if that exact name is free).

I'll hold off on anything that depends on these two being live (testing the routes, running the migration, wiring pm2 against a real deploy) until you've done this and shared the two Supabase keys.

## Phase 0.5 — pm2 (local persistence)

Run once, from the `stock-research-cockpit` directory:
```
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
npm install -g pm2-windows-startup
pm2-startup install
```
After this, Cockpit is always running at `http://localhost:3000` from boot onward — `npm run dev` never needs to be typed again. Useful commands: `pm2 status`, `pm2 logs cockpit`, `pm2 restart cockpit` (after a code change in production mode, or if something looks stuck).

## Remaining after Phase 0 unblocks

1. `npm install` in both repos (picks up the new dependencies).
2. Apply `supabase/schema.sql`, set both repos' env vars (done as part of Phase 0 above).
3. `npm run migrate:journal` once in the Cockpit repo — moves real journal history into Supabase.
4. Set `IS_LOCAL_CONTROL_PLANE=true` and `ATLAS_REPO_PATH=C:\Users\SD\Desktop\atlas` in Cockpit's **local** `.env.local` only (never on Vercel).
5. Run pm2 setup (Phase 0.5).
6. Update Claude Desktop's `claude_desktop_config.json` — no new entry needed, the existing `cockpit` MCP server entry now also carries the 4 `atlas_*` tools once `mcp-server` is rebuilt (`cd mcp-server && npm install && npm run build`) — just restart Claude Desktop.
7. End-to-end test: click "Run screen now" on `/atlas` → confirm a row appears → open it → confirm the report renders → in Claude Desktop's Atlas Radar project, ask it to read the latest run and save a brief → confirm it appears on the run's detail page.
8. **Auth hardening — do this before the Vercel URL is used from anywhere but a trusted network.** The current single-password header check (`lib/auth.ts`) has no rate limiting and was only ever "safe enough" because it was unreachable from the public internet. Once deployed, at minimum: pick a long random `ACCESS_PASSWORD`, and treat upgrading to a real session-based check (or Supabase Auth) as the next task, not indefinitely deferred — flag this back to me when you're ready for it, it's intentionally left out of this pass since it's a self-contained follow-up, not a blocker for testing the rest of this locally.
9. Deploy to Vercel (Phase 0 already connects the repo — every push to `main` auto-deploys after that).
