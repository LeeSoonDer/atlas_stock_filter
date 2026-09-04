# Cockpit — System Reference

> Snapshot date: 2026-08-31, compiled via direct code exploration of `C:\Users\SD\Desktop\stock-research-cockpit` (a real, working Next.js app — a separate git repo, sibling directory to Atlas, same author/operator). Written for an AI session that has never seen this codebase. This is a point-in-time technical inventory, not living documentation — re-derive from the code before trusting a specific detail on a later date.

## 1. What Cockpit is

"Stock Research Cockpit" is a **personal, single-user Next.js web app** that separates data-gathering from judgment for deep single-ticker research. It fetches and honestly discloses live financial data from multiple sources, assembles it into a structured **"V5 Payload"**, and hands that payload to the operator's own external Claude conversation for analysis — **the app itself never renders a verdict, and makes zero LLM calls anywhere in its own code**. This mirrors Atlas's own Layer-1 philosophy exactly (see `ATLAS.md` §2), independently arrived at for a sister product.

Repo root: `C:\Users\SD\Desktop\stock-research-cockpit`. Next.js 16 / React 18 / Tailwind CSS. Single shared password gate, no user accounts, no multi-tenancy — a permanent personal-tool scope, not a "not yet multi-user" placeholder (`PRODUCT.md`).

Established terminology to preserve: **"V5 Payload"** (the structured data block built for Claude), **"Rating Card"** (Claude's structured verdict/conviction/key-levels JSON response), **"Dissent"** (the adversarial second-review pass), **"Followed vs. Deviated"** (whether the operator's actual action matched the verdict).

## 2. Runtime

`npm run dev` (or `build`/`start`) — a real, persistent Next.js server, normally run locally (`http://localhost:3000`). No `.next` build artifacts or `node_modules` committed, but present in the local working tree. Dependencies: `next` 16.2.10, `react`/`react-dom` 18.3.1, `recharts`, `react-markdown`+`remark-gfm`, `technicalindicators`, `yahoo-finance2`, `lucide-react`, Tailwind stack.

## 3. Pages (`app/`)

| Route | Purpose |
|---|---|
| `/` | **Analyze** — enter a ticker, fetch a live V5 Payload, copy it (or let Claude Desktop pull it directly via MCP) into a Claude conversation, paste the structured response back to save. Renders `<AnalyzeForm>`. |
| `/journal` | **Journal** — full history: aggregated-by-ticker / flat table / card views (mode persisted in `localStorage`), filter bar, verdict-donut + conviction-trend charts, correlated-exposure notice, Markdown/JSON export, backup-reminder nag. |
| `/watchlist` | Tracked tickers (client-side `localStorage`) with live quotes and 4 client-computed alert types: `SUPPORT_BREACH`, `RESISTANCE_BREAK`, `STALE`, `EARNINGS_SOON`. |
| `/report/[id]` | The detailed, printable single-analysis view — used right after saving and for any historical Journal entry. Renders `<ReportViewP8>` (the current, actively-mounted report component tree). EN/CN toggle, history-timeline browsing via `computeHistoryDelta`. |
| `/etf` | ETF holdings lookup. |
| `/settings` | Position-size-calculator inputs, one-time browser-storage→file Journal migration, JSON import/export. |
| `/dev/microviz` | Dev-only sample-state gallery for the MicroViz chart primitives; `notFound()`s in production. |

## 4. API routes (`app/api/**/route.ts`)

Every route starts with `checkAuth(request)` (see §7) before doing anything else.

| Route | Method | Purpose |
|---|---|---|
| `/api/payload` | POST | Validates ticker + depth (+optional `priorAnalysis`), calls `buildV5Payload()`, returns `{payload, chartData}`. |
| `/api/chart-data` | POST | Lightweight chartData-only re-fetch — added specifically so the MCP `save_analysis` path (which never calls `/api/payload`) can still get numeric chartData at save time. Never 500s. |
| `/api/etf-holdings` | POST | ETF holdings + live day-change enrichment per holding. Returns `200` with an `error` field (not 4xx/5xx) when the FMP plan doesn't support the endpoint. |
| `/api/watchlist-quotes` | POST | Batch `{tickers}` → per-ticker `{price, changePct, daysToEarnings, sparkline30d, error}`, each field independently `Promise.allSettled`. |
| `/api/health` | GET | Probes Yahoo/FMP/Finnhub/FRED with `AAPL` + journal read/write health. |
| `/api/journal` | GET, POST | GET lists entries (optional `?ticker=`) — **also runs the server-side outcome auto-fill pass**, rewriting the file only if something changed. POST accepts either a complete `JournalEntry` (browser paste-back) or `{rating_json, full_text?, cn_text?, chat_url?}` (MCP `save_analysis` raw path); also applies any `prior_outcome_update` from the new card onto the referenced prior entry. |
| `/api/journal/[id]` | GET, PATCH, DELETE | GET single entry. PATCH: shallow merge, **or** `{dissent_result}` (MCP `save_dissent` path — requires `dissent.payloadText` to already exist). DELETE removes by id. |
| `/api/journal/[id]/dissent-payload` | POST | Builds + persists `entry.dissent.payloadText` — server counterpart to the "Generate Dissent Payload" button / MCP `build_dissent_payload` tool. |

## 5. Data model (`lib/types.ts`)

- **`JournalEntry`** — the persisted unit: `id, ticker, depth ("QUICK"|"FULL"), createdAt, payloadText, ratingCard: RatingCard`, plus `fullAnalysisEn/Cn, chartData, price_at_analysis, chat_url, followed_status ("followed"|"deviated"), source ("manual"|"mcp"), outcome: JournalOutcome, dissent: {payloadText, createdAt, result?, resultAttachedAt?, source?}`.
- **`RatingCard`** — Claude's structured response (`[key:string]: unknown` passthrough for forward-compat). Core: `v, ticker, mode, timestamp, verdict: "STRONG_BUY"|"BUY_WATCH"|"NEUTRAL"|"AVOID"|"STRONG_AVOID", conviction, entry_timing, risk_level, technical_rating, key_levels:{support[],resistance[]}, thesis_breakers[], data_reliability, summary_one_line`. Optional richer fields: `regime, return_engine, the_story, audit_verdict, eli5, dimension_scores, market_pricing, action_plan: ActionPlan, prior_outcome_update, technical_detail, data_reliability_detail`.
- **`ActionPlan`** — the tactical execution plan: `stance, entry_conditions[], forbidden_zone, stop, invalidation, take_profit[], upgrade_conditions[], abandon_conditions[], synthesis`. Deliberately has **no** position-sizing/probability/expected-value fields anywhere — an enforced "false-precision red line."
- **`DissentResult`** — `audit_verdict, strongest_objection, conviction_adjustment, new_risks_found[], recommended_action`, optional `action_amendment: {direction, amendment}`.
- **`ChartData`** — app-computed numerics never routed through the LLM JSON schema: `price, sma50, sma200, rsi, atrPct, atrAbsolute, roe, grossMargin, revenueGrowth, sparkline90d, sector?`.
- No dedicated `WatchlistItem` type in `lib/types.ts` — it's a local type in `lib/watchlist-store.ts` (`{ticker, note?, addedAt}`), browser-`localStorage`-only.

## 6. The V5 Payload (`lib/payload-format.ts`, `lib/sources/`)

`buildV5Payload(ticker, depth, question?, priorAnalysis?)` fires 8 sources in parallel via `Promise.allSettled`: Yahoo, FMP, Finnhub, FRED, insider activity, FMP quote price, FMP AI-leverage data, macro calendar. Also computes a `Regime` (`lib/regime.ts`).

Payload text format: header (`V5-PAYLOAD v1.2`, mode, ticker, regime, optional PRIOR ANALYSIS/DIMENSION SCORES/THESIS BREAKERS/DISSENT blocks, depth, timestamp, valid-until) → `=== DATA BLOCK ===` → a flat sequence of lines each tagged **`[T1]`** (ticker-specific verified), **`[T0]`** (macro/market-wide context), or **`[T-]`** (source-health meta) → `=== END ===` → `CONTEXT: none` → `QUESTION: ...`.

**Note**: PRODUCT.md documents "PRICE / FUNDAMENTALS / TECHNICAL / CONTEXT" as the DATA BLOCK's four categories, but the raw payload text itself only emits `[T1]/[T0]/[T-]` tags — the 4-category split is a **presentation-layer reclassification** applied afterward by `lib/parse-payload-display.ts` (`classifyLine()`, keyword-matched per line) for `components/data-block-groups.tsx`'s collapsible display on the Analyze page.

| Category (display-only) | Content |
|---|---|
| PRICE | Current price + 90d/52w range (Yahoo, ~15min delay), `[⚠ SOURCE DIVERGENCE]` flag if FMP disagrees >2%, ATR(14)/OBV, 52w-high distance. |
| FUNDAMENTALS | Market cap/PE/EPS, beta/sector/industry, ROE/D-E/rev growth/gross margin/PEG/FCF yield, Altman Z (probe-gated), AI Leverage metric. |
| TECHNICAL | RSI(14)/MACD/price-vs-SMA50/SMA50-vs-SMA200, relative strength vs SPY + sector ETF (1M/3M). |
| CONTEXT | Options P/C ratio + ATM IV, insider 90d activity, news sentiment + headlines, days-to-earnings, short interest, market context line, Fed funds + CPI YoY, macro calendar (FOMC/CPI/Jobs). |

Graceful-degradation pattern, consistent everywhere: every external call is inside `Promise.allSettled`; a failure renders as `[UNAVAILABLE: source] (reason)` or `[PROBE FAILED: source] (reason)` inline — never fabricated, never silently dropped. A trailing `SOURCE HEALTH` line reports live OK/FAILED/PARTIAL per source.

### External sources actually wired in

| Source | Key file(s) | Env var | Feeds |
|---|---|---|---|
| Yahoo Finance (`yahoo-finance2`) | `lib/sources/yahoo.ts` | none required | Price, range, market cap/PE/EPS, OHLCV, options chain, insider transactions |
| Financial Modeling Prep | `lib/sources/fmp.ts`, `fmp-quota.ts` | `FMP_API_KEY` | ROE/D-E/rev growth/margin/PEG/FCF/Altman Z, AI Leverage, 2nd price source, ETF holdings |
| Finnhub | `lib/sources/finnhub.ts` | `FINNHUB_API_KEY` | News sentiment (probe), headlines, earnings calendar, short interest (probe) |
| FRED | `lib/sources/fred.ts`, `lib/macro-calendar.ts` | `FRED_API_KEY` | Fed funds rate, CPI YoY, CPI/Jobs release dates |
| federalreserve.gov (scrape, no key) | `lib/macro-calendar.ts` | — | Next FOMC date only — FRED's own FOMC release series returns unusable placeholder dates, so this is a documented workaround |

## 7. Auth (`lib/auth.ts`)

**No cookie/session mechanism.** `checkAuth(request)` compares the request's `x-access-password` header against `process.env.ACCESS_PASSWORD` — fails **closed** (401) if the env var isn't set server-side. Client side, `lib/api-client.ts` stores the entered password in `localStorage` (`src_access_password`) and attaches it to every request; a `401` clears the stored value so `<PasswordGate>` re-prompts. The gate itself cannot validate — a subsequent API 401 is the real check.

## 8. Journal system (`lib/journal-file-store.ts`, `journal-store.ts`, etc.)

- **Storage**: single JSON file `data/journal.json` (server-side `fs`). Transparently strips a UTF-16 BOM on read (a documented real bug from a PowerShell `>` redirect). An unparseable file resets to `[]` rather than 500ing forever. Writes are atomic (temp file + `fs.rename`). `withJournalLock()` serializes every read-modify-write through an in-process `Promise` queue (fixes a documented real concurrent-write data-loss bug).
- **Browser API wrapper** (`journal-store.ts`, `"use client"`): CRUD via `/api/journal*`, `exportAllAsMarkdown/Json()` (includes a Followed-vs-Deviated summary — entries without a recorded outcome excluded from the average, not treated as 0), `importEntries()` (replace-all), one-time `migrateFromBrowserStorage()`.
- **Aggregation** (`journal-aggregate.ts`) — groups by ticker into `{ticker, latest, historyCount, matchedHistory?}`, display-only, never merges/drops records.
- **Server-side outcome auto-fill** (`server-outcome-autofill.ts`, runs inside `GET /api/journal`) — flags entries ≥30 days old missing `outcome_1m` or ≥90 days missing `outcome_3m`, fetches a live price, computes % change, tags the source `"auto"` or `"failed"`.
- **"Parasitic review"** — a re-analysis's `ratingCard.prior_outcome_update` (`{prior_entry_id, breaker_triggered, error_type?, note?}`) is applied, inside the same lock as the new entry's append, to write `outcome.review_*` fields onto the OLD entry without touching manually-entered outcome fields.

## 9. Dissent workflow

- **Trigger** (`lib/pending-dissent.ts`): `needsDissent(entry)` — `conviction >= 7 OR regime === "SMALL_SPEC"` AND no dissent yet. A **visual nag only**; never blocks saving.
- **Packet build** (`lib/dissent-format.ts`): `buildDissentPayload()` produces a `V5-DISSENT v1.2` packet explicitly labeled "隔离审查包 · 原始推理已剥离." Reads **only** `regime, verdict, conviction, risk_level, entry_timing, technical_rating, key_levels, thesis_breakers, summary_one_line` plus the original DATA BLOCK re-extracted from the payload text — never `fullAnalysisEn/Cn`, `eli5`, `market_pricing`, `dimension_scores`, or `action_plan`. This is the actual isolation mechanism (type/field-level, same pattern Atlas uses for its own Dissent Payload).
- **Result parsing** (`lib/parse-dissent-result.ts`): tolerant of raw string or pre-parsed object, validates required fields, never throws.
- **Storage**: `PATCH /api/journal/[id]` with `{dissent_result}`; requires the payload to already exist; tags `dissent.source` (`"manual"|"mcp"`) independently of the entry's own top-level `source`.
- **"Zero-copy dissent"** (documented in `mcp-server/README.md`, P7-B): a separate "Dissent Auditor Project" chat can call `build_dissent_payload`/`save_dissent` itself via MCP — eliminating manual copy/paste while keeping isolation via a genuinely separate chat + fresh context + reasoning-stripped packet.

## 10. The `mcp-server/` package — Cockpit's existing local-MCP bridge

This is the **direct precedent** for how any Atlas↔Claude Desktop automation should be built (see `ATLAS_COCKPIT_RELATIONSHIP.md`).

- `name: "cockpit-mcp-server"`, ESM, single dependency `@modelcontextprotocol/sdk ^1.29.0`. "No business logic lives here and no LLM calls are ever made from this process" (its own README).
- **Transport**: stdio — a plain Node child process launched by Claude Desktop's local-MCP-server mechanism (not usable from claude.ai's web UI, which only accepts remote/URL-based MCP connectors).
- **Config**: env vars `COCKPIT_URL` (default `http://localhost:3000`) and `COCKPIT_PASSWORD` (sent as `x-access-password` on every proxied call). Requires the Cockpit Next.js app to already be running — the MCP server holds no data of its own, it's a thin HTTP proxy (see `MCP_EVALUATION.md` for the architecture rationale).
- **The 6 tools** (`mcp-server/src/index.ts`):
  1. `build_payload(ticker, depth?, question?)` → POST `/api/payload`, returns raw payload text.
  2. `save_analysis(rating_json, full_text?, cn_text?, chat_url?)` → fetches chartData via `/api/chart-data`, POSTs to `/api/journal`, returns `{id, ticker, verdict}`.
  3. `save_dissent(entry_id, dissent_json)` → `PATCH /api/journal/{id}` with `{dissent_result}`.
  4. `build_dissent_payload(entry_id)` → `POST /api/journal/{id}/dissent-payload`, returns raw text.
  5. `list_journal(ticker?, limit?=20)` → compact summaries.
  6. `get_entry(entry_id)` → full record.

Example Claude Desktop config (from the README):
```json
{
  "mcpServers": {
    "cockpit": {
      "command": "node",
      "args": ["C:\\Users\\SD\\Desktop\\stock-research-cockpit\\mcp-server\\dist\\index.js"],
      "env": { "COCKPIT_URL": "http://localhost:3000", "COCKPIT_PASSWORD": "your-ACCESS_PASSWORD-value" }
    }
  }
}
```

## 11. Frontend components (`components/`)

Six subtrees: bare component files (form, nav, password-gate, various view components), `charts/` (conviction ring/trend, dimension radar, fundamentals bar, price-position axis, RSI gauge, SMA structure icon, sparkline, verdict donut/badge), `microviz/` (tiny inline SVG primitives: bar/diverging/gauge/range/ring/segments/spark), `report-p8/` (the current, actively-mounted Report-page tree — hero, six-facet radar/synthesis, action-plan, technical-structure, price-structure-chart, evidence-index, glossary, sticky-score-bar, print-chrome, etc.), `ui/` (badge/button/card/input/textarea/progress/spinner/section-panel + `tokens.ts`/`tokens-p8.ts`).

**Design system — two parallel token sets, both live simultaneously**, both defined as CSS custom properties in `app/globals.css` and mapped into `tailwind.config.ts`:
- **P4 tokens** (bare names): `--bg/--card/--card-2/--line/--txt/--dim/--faint`, semantic `--green/--red/--amber/--cyan`, `--signature #f5a623`, 4 data-category anchors `--cat-price/-fund/-tech/-ctx`. Still rendered by the Analyze page's post-save preview (`paste-back-form.tsx`) and older components (`rating-card-view.tsx`, `report-sections.tsx`, `dissent-result-view.tsx`, `action-plan-view.tsx`).
- **P8 tokens** (`--p8-*`, governed by the authoritative, already-shipped `P8_DESIGN_CONSTITUTION.md`): deep-navy `--p8-bg #0c111c` family, signature `--p8-sig #4d8dff`, semantic `--p8-up/-down/-warn/-watch`, six-facet category dots `--p8-c1..c6`, 5 pipeline-stage tokens. Explicit "6:3:1 color-ratio discipline." Fonts Manrope/JetBrains Mono. Dark-mode only on screen (`darkMode:"class"`), separate `@media print` light palette for PDF export. This is what `report-p8/*` (the live Report page) actually uses.

**Important, verified fact**: this codebase contains **no** `data-project="cockpit"` attribute and **no** "refined-functionalism" token-system reference anywhere — despite Atlas's own `design-demos/_shared-spec.md` describing the two products as sharing that token system. Atlas's real shipped `report.html` genuinely does use refined-functionalism tokens (`data-project="atlas"`); Cockpit does not use them at all, anywhere. See `ATLAS_COCKPIT_RELATIONSHIP.md` for this discrepancy.

## 12. Supporting logic modules (`lib/`)

| File | One-line purpose |
|---|---|
| `settings-store.ts` | Browser `localStorage` — `{accountSize, defaultRiskPct}`. |
| `components/position-calculator.tsx` (not `lib/`) | Position-size calc: `riskAmount = accountSize × riskPct%` (halved for `SMALL_SPEC`), `suggestedShares = floor(riskAmount / (2×ATR))`. |
| `watchlist-store.ts` | Browser `localStorage` — `WatchlistItem{ticker,note?,addedAt}`. |
| `breaker-eval.ts` | Precision-first auto-judge of thesis-breaker text — only auto-triggers on explicit verb + in-range number + no non-price vocabulary; otherwise `NEEDS_MANUAL_REVIEW` rather than guessing. |
| `macro-calendar.ts` | 7-day-TTL cached FOMC/CPI/Jobs calendar (see §6 sources table). |
| `correlated-exposure.ts` | Pure notice (never blocking) — flags a sector when ≥2 active (last 90d, non-AVOID) entries share a sector. |
| `regime.ts` | `determineRegime()` — first-match rules on ADV/price/market-cap → `SMALL_SPEC`/`MID_CAP`/`LARGE_CAP`. |
| `sector-etf-map.ts` | Yahoo sector string → sector ETF ticker (semiconductor industry overrides to SMH). |

Watchlist alert computation itself lives client-side in `app/watchlist/page.tsx`'s `computeAlerts()`, not in a `lib/` module.

## 13. Governance / operating system for this repo

Same template lineage as Atlas (`START_HERE.md` points at the same `ai-project-template` GitHub source). `CLAUDE.md` is the same "Core Index Router" pattern (STRONG/MID/SMALL model tiers, task-card + dispatch-protocol system, `rules_core/`, `templates/`). `ai/` holds `project_overview.md, current_state.md, architecture.md, decisions.md (append-only), coding_rules.md, risk_register.md`. Root-level phase task cards (`P4_5_TASK_CARD.md` through `P6_5_TASK_CARD.md` + matching UI-addendum/design-spec files) document an ad-hoc phase-by-phase build history, referenced from `ai/current_state.md`/`decisions.md`. Practice pattern observed in `current_state.md`: build → verify → independently re-verify → hold for explicit operator commit/push approval (matches `AGENTS.md`'s explicit "Approval Required" list: git push/pull, deletes, installs, secrets, global config, GitHub changes, deploys/billing).

## 14. Design work in flight (not yet integrated)

- `design-demos/` (4 static HTML mockups exploring a further Report-page redesign) + `direction-approved.md` — the operator has already picked a direction (2026-08-29: base structure from `benchmark-standard`, action-plan/technical-structure sections from `kenya-hara-quiet`, `cockpit-instrument` rejected) but **it is not yet built into the real `components/report-p8/*` tree**.
- `cockpit-design-audit.md` (47KB) — a code-verified, "record only" visual audit of the current shipped state (both P4 and P8 trees), meant as raw input for an external designer, not a set of recommendations to act on.
- `P8_DESIGN_CONSTITUTION.md` — by contrast, this one **is** the actual shipped, authoritative spec (matches the live P8 tokens verbatim).
- `claude_code_design_draft.zip` / `claude_code_design_screenshot.zip` (repo root) — confirmed **untracked**, unpacked-and-unreviewed, produced very recently (Aug 30), not referenced anywhere in `ai/current_state.md` or `ai/decisions.md` as of this snapshot — genuinely pending work sitting in the working tree.
- `p8_fintech_mockup.html`, `REFERENCE_direction_B.html`, `full_analysis_layering.html` (repo root) — explicitly superseded historical mockups from when P8 was originally built, not live routes.

## 15. Where the project actually stands today

Per `PRODUCT.md` and `ai/current_state.md`, Cockpit is a mature, actively-used personal tool (P4 through P8+ feature waves shipped) with a working Analyze → Journal → Watchlist → Report loop, a functioning MCP bridge to Claude Desktop, and its own in-flight Report-page redesign (P8/kenya-hara-quiet synthesis, plus the very recent unreviewed `claude_code_design_draft` work). It has no relationship in its own codebase to Atlas beyond shared authorship and shared governance-template lineage — no code, config, or shared design tokens currently cross between the two repos. See `ATLAS_COCKPIT_RELATIONSHIP.md` for the current state of the integration discussion between the two products.
