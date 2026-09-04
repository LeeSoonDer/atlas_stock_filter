# Atlas ↔ Cockpit — Relationship & Integration Status

> Snapshot date: 2026-08-31. Read `ATLAS.md` and `COCKPIT.md` in this same folder first — this file only covers how the two systems relate, not what each one is internally.

## 1. What actually connects them today

**Nothing automated.** The only real link is a manual human step: the operator looks at Atlas's `report.html`/`ATLAS_PAYLOAD.txt`, decides a candidate is worth deep research, and manually types that **ticker symbol only** into Cockpit's Analyze page (`/`). Per constitutional ruling (Atlas's Memo No.3, Q3), Atlas's evidence/flags are deliberately **not** passed along — Cockpit's analysis is meant to start independently, not anchored to Atlas's reasoning.

No code in either repo imports from, calls, or reads files from the other. They are two separate git repos with:
- The same author/operator, same governance template lineage (`ai-project-template` → `CLAUDE.md` router + `rules_core/` + task cards + `ai/` memory files in both).
- The same underlying philosophy: an app that supplies data honestly and **never renders its own judgment**, delegating all inference to the operator's own external Claude conversation (Atlas: zero LLM calls, hands off to Atlas Radar/Red Team Projects; Cockpit: zero LLM calls, hands off to its own V5 analysis Project).
- **No shared code, no shared config, no shared runtime.**

### A design-system claim that does not hold up under inspection

Atlas's own `design-demos/_shared-spec.md` (an exploration doc, itself uncommitted) asserts that Atlas and Cockpit share a "refined-functionalism" design-token system with `data-project="atlas"`/`data-project="cockpit"` variants. Direct inspection of both codebases shows this is only half true:
- Atlas's real, shipped `src/report/html/styles.ts` **does** use the refined-functionalism `data-project="atlas"` tokens (verified: `--bg:#0B0E14`, `--accent:#22C9D6`, etc. match the spec doc's block exactly).
- Cockpit's real, shipped code uses **its own, entirely separate P4/P8 token systems** (`--p8-bg`, `--p8-sig`, etc.) — no `data-project="cockpit"` attribute or "refined-functionalism" reference exists anywhere in the Cockpit repo.

Conclusion: the "shared design system" is aspirational for Cockpit, real for Atlas. Don't assume Cockpit will visually match a refined-functionalism mockup without an actual retrofit — that hasn't happened and isn't currently planned as a task card in either repo.

## 2. What Atlas's own roadmap already anticipated

Before this conversation happened, Atlas's `ai/current_state.md` "Next Priorities" section already named two relevant, deliberately-deferred future items:
- **"MCP thin proxy" idea** (`build_atlas_payload`/`save_brief`/`save_dissent` tools) — explicitly gated: "Trigger: manual copy-paste friction starts causing the user to skip the red-team step." As of this snapshot that trigger condition has been informally reached (the operator raised the automation question in this session), but no card has been written or started.
- **"Cockpit v1.3 反哺 patch"** — explicitly flagged as "an independent parallel line... NOT an Atlas task, separate session/task card only."

Neither of these had been started as of this snapshot. The discussion below is the first concrete design pass at them.

## 3. The integration conversation (this session, 2026-08-31)

The operator asked whether Atlas could be pulled into Cockpit's web app to feel like "one multi-function system," with a specific concrete UX in mind: a section inside the Cockpit web UI with (a) a one-click "run screen" button, (b) a history list below it (one row per day Atlas has run), (c) clicking a row opens that day's full Atlas report inside Cockpit, and (d) the remaining manual step — pushing Atlas's payload into the Atlas Radar/Red Team claude.ai Projects and getting the result back — automated as much as possible **without using the Anthropic API** (i.e., staying inside the operator's normal Claude Pro/Max subscription usage, not pay-per-token billing). The operator also wants the design to leave room for eventually hosting Cockpit publicly on Vercel with Supabase as its database.

### Constraints established as fact (verified live via WebSearch during this session, not from training-data memory — re-verify before relying on this in a future session, since MCP/connector support evolves)

1. **claude.ai's web UI only supports remote (URL-reachable) custom MCP connectors.** Local, stdio-based MCP servers — which is what Cockpit's existing `mcp-server/` package is, and what any new Atlas-side MCP tools would also be — only work inside the **Claude Desktop** app, not the browser. Desktop also supports persistent Projects together with local MCP in the same conversation.
2. MCP tool calls made during a normal Claude Desktop/claude.ai conversation consume the ordinary Pro/Max message quota — they are **not** billed as separate pay-per-token API usage. This is what makes a Desktop-based bridge compatible with the operator's "no API" constraint.
3. Vercel serverless functions default to a 300-second max duration (up to 800s on Enterprise, 1800s in beta via Fluid Compute); Vercel's own stated answer for genuinely long jobs is "Workflows" (pause/resume over minutes to months). None of this is remotely close to Atlas's real runtime (minutes on a warm cache, 2.5–3+ hours on a cold EDGAR backfill) — a hosted Vercel deployment **cannot** execute `npm run screen` inside a serverless function.

### Recommended architecture — "Best Case A" (current, everything still local)

1. **Cockpit gets a new `/atlas` section.** A button ("run this week's screen") calls a new Cockpit API route that `child_process.spawn`s `npm run screen -- --profile both` in the Atlas repo directory as a detached background process, guarded by a lock file to prevent concurrent runs; the UI polls a status endpoint for progress (Atlas's pipeline already emits phase-boundary timing via `console.error` and `runMeta.timingBreakdown` — see `ATLAS.md` §4 — which the status endpoint can tail/read).
2. **History list**: a Cockpit API route reads Atlas's `output/runs/*/` directory (see `ATLAS.md` §8) and lists dates + summary counts (parsed from each day's `screen_run.json`). Clicking a row opens a `/atlas/[date]` page — cheapest version: embed/serve that day's already-generated, self-contained `report.html` directly (zero extra rendering work); richer version (later): parse `screen_run.json` and re-render with Cockpit's own React components/design tokens for a fully native feel.
3. **Close the Radar/Red-Team gap by extending Cockpit's existing `mcp-server/` package** (see `COCKPIT.md` §10) with new Atlas-aware tools — e.g. `atlas_get_latest_payload`, `atlas_get_dissent_payload`, `atlas_save_radar_brief`, `atlas_save_dissent_verdict` — rather than standing up a second, separate MCP server. This keeps a single MCP server / single Claude Desktop config entry serving both products, which is the literal mechanism that makes this feel like "one system."
4. **The operator runs the Radar/Red-Team step from the Claude Desktop app** (not the claude.ai browser, per constraint #1 above), opening the existing "Atlas Radar"/"Atlas Red Team" Projects and giving a short instruction (e.g. "read today's latest screen result and produce the candidate briefs"); Claude calls the new MCP tools itself to fetch the payload and to save its structured response back — eliminating the manual copy/paste of `.txt` files in both directions.
5. **A "send to Cockpit" action** on each candidate in the Atlas report view (inside Cockpit) can fully automate the final ticker handoff — navigate to `/?ticker=XXXX` on Cockpit's existing Analyze page, pre-filled — since there's no reason this specific step needs to stay manual (unlike the Radar/Red-Team step, this one carries no isolation requirement).

**The one ceiling this design cannot remove without using the API**: a Claude Desktop/claude.ai conversation cannot be triggered headlessly. The operator must still be the one who opens the Radar/Red-Team Project and gives the instruction that starts the tool-calling — there is no way to make that step fire automatically the moment a screen run finishes, short of a scheduled script calling the Anthropic Messages API directly (which the operator has explicitly ruled out for cost reasons). Everything else in the loop (running the screen, browsing history, fetching/saving payloads, the final ticker handoff) can be made fully automatic.

### "Best Case B" — after a future move to Vercel + Supabase

Hosting Cockpit's web UI on Vercel breaks the assumption behind step 1 above (Vercel functions can't run a multi-hour local process, and have no persistent local filesystem). The architecture that survives this move splits into two halves:

- **Heavy compute (the actual `npm run screen` execution) stays on a machine the operator controls** — their own PC (manually or via a scheduled local task) or a small always-on box. It is never moved into a Vercel function.
- **That local runner pushes finished results up to Supabase** (a normal authenticated write to the operator's own database — not the Anthropic API) once a run completes. The hosted Cockpit (on Vercel) reads history and reports straight from Supabase; its "run screen" button becomes "write a pending-run request row to Supabase," which the local runner polls for and executes.
- **The Claude Desktop ↔ MCP bridge is unaffected by this move** — Claude Desktop is a desktop app that runs on the operator's own machine regardless of where the Cockpit web UI is hosted, so step 3–4 above carry over unchanged; only the data source those MCP tools read/write would shift from local files to Supabase.
- Journal/ledger data (currently local JSON files on both sides — `data/journal.json` for Cockpit, `output/ledger.jsonl`/`checkpoint.json` for Atlas) would need a Supabase schema; a single JSON-blob column per record plus a few indexed fields (e.g. `run_date`, `candidate_count`) is enough for a personal system — no need to fully normalize.
- The single shared-password gate (`ACCESS_PASSWORD` env var, `COCKPIT.md` §7) is adequate for local-only use but should be upgraded (Supabase Auth or a real session mechanism) before Cockpit sits on a public domain.

## 4. Current status of this integration effort

**Updated 2026-09-01: implementation has started.** The operator confirmed the concrete shape (view-only multi-device access, manual scan trigger, full journal migration to Supabase, pm2 for local persistence, no Supabase/Vercel accounts yet) and code for most of "Best Case A" has been written across both repos — see `INTEGRATION_PLAN.md` in this same folder for the full file-by-file build log and the exact remaining checklist (account creation, `npm install`, running the migration script, pm2 setup, end-to-end testing, and auth hardening before the Vercel URL is used publicly). This section (§1-3 above) remains accurate as the architecture rationale; `INTEGRATION_PLAN.md` is now the authoritative "what's actually built vs. what's left" tracker — update that file, not this one, as work continues.
