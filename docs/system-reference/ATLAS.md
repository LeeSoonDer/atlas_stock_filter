# Atlas — System Reference

> Snapshot date: 2026-08-31. Written for an AI session that has never seen this repo, so it can reach the same working understanding a human operator already has. This is a point-in-time technical inventory, not living documentation — re-derive from the code (`git log`, actual file contents) before trusting any specific detail on a later date.

## 1. What Atlas is

Atlas ("Attention Allocation Engine" / 注意力配置引擎) is a **deterministic, on-demand TypeScript/Node CLI** that scans the full NYSE+NASDAQ US equity universe (~5,000+ raw symbols) and routes a research operator's limited attention to a small set of candidates showing structural/technical/institutional evidence convergence. It does **not** predict the market, does **not** manage a portfolio, and makes **zero LLM calls anywhere in this repo** — that is a constitutional hard rule, not a current limitation.

Repo root: `C:\Users\SD\Desktop\atlas`. Single git repo, currently tagged `v1.0-layer1`.

Non-goals (explicit, from `ai/project_overview.md`): no LLM calls, no scoring/ranking beyond the four detectors, no UI framework/dashboard, no scheduled/cron execution (on-demand only), no automated handoff to Cockpit, no biotech/M&A/distressed-asset engines, no 13F parsing (deferred), no paid data dependencies (Yahoo Finance is primary; FMP is post-screen enrichment only).

## 2. The two-layer architecture (the constitutional "red line")

Atlas is explicitly split into two layers, and **this repo is Layer 1 only**:

- **Layer 1 — Application Layer (this repo)**: 100% deterministic. Universe building, data fetch, technical/fundamental/institutional flag computation, four rule-based detectors, candidate/watchlist selection, report/payload generation, forward-outcome ledger. No judgment, no narrative, no LLM.
- **Research Layer (external, NOT in this repo)**: two **claude.ai Projects** — "Atlas Radar" (bull-case reasoning engine, produces a "候选辩护状" / Candidate Brief per candidate) and "Atlas Red Team" (adversarial dissent engine, produces a graded attack). Their full Project Instructions live in `docs/projects/ATLAS_RADAR_INSTRUCTIONS.md` (Red Team's counterpart is referenced but not present in this repo tree as of this snapshot). These two Projects are configured manually in the claude.ai web UI per `docs/projects/PROJECT_SETUP_GUIDE.md` — Radar's Knowledge holds the constitution files, Red Team's Knowledge holds **only** Memo No.4 (isolation is enforced by omission: Red Team must never see Radar's reasoning framework or the full evidence set).

Today, moving data between Layer 1 and the Research Layer is **100% manual**: the operator copies `ATLAS_PAYLOAD.txt` into the Atlas Radar chat and `ATLAS_DISSENT_PAYLOAD.txt` into the Atlas Red Team chat, then copies the responses back out by hand (typically into `brief.md`/`dissent.md` files the operator creates alongside that run's other artifacts — the pipeline does not write these). No code in this repo talks to the Anthropic API or to claude.ai. See `docs/ATLAS_COCKPIT_RELATIONSHIP.md` for the automation options discussed to close this gap.

Downstream of both layers: **Cockpit** (a separate sister product, see `COCKPIT.md` in this same folder) does deep single-ticker research once the operator decides a candidate is worth it. Per constitutional ruling (Memo No.3, Q3), only the **ticker symbol** is handed to Cockpit — never Atlas's evidence/flags — to keep Cockpit's analysis starting point independent.

## 3. Runtime & how to run it

- Node.js ≥ 18, TypeScript run directly via `tsx` (no build step needed day-to-day; `npm run build` exists for `tsc -p tsconfig.json` → `dist/` but isn't part of the normal workflow).
- Single dependency footprint: `dotenv`, `yahoo-finance2` (runtime); `tsx`, `typescript`, `@types/node` (dev). No web framework, no database, no server process of any kind.
- Entry point: `src/screen/cli.ts` → `npm run screen -- --profile <standard|small_spec|both>`. This is the **only** way the pipeline runs; there is no scheduler, no cron, no daemon.
- A full cold-start run (no `output/checkpoint.json` yet) takes ~90 minutes for the full-universe quote/OHLCV fetch plus ~2.5–3 hours for the EDGAR Form 4 90-day insider-filing backfill — a one-time cost. After that, `checkpoint.json` (gitignored, large) makes subsequent runs incremental — tens of seconds to a few minutes.

### Full command table

| Command | What it does |
|---|---|
| `npm run screen -- --profile <standard\|small_spec\|both>` | One full screening cycle end-to-end (see §4). `--profile` is required. |
| `npm run ledger:backfill -- --ticker <SYM> [--outcome repriced\|invalidated\|expired_no_event] [--elapsed-days N] [--screening-timestamp <iso>]` | Manually record a forward outcome for a past candidate/watchlist entry. Interactive if flags omitted. Append-only — never edits/deletes existing ledger lines. |
| `npm run ledger:stats` | Per-bucket hit-rate/death-rate summary across the whole ledger (monthly review). |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm test` | `node:test` runner over every `src/**/*.test.ts` (189+ tests as of the last recorded run in `ai/current_state.md`). |
| `npm run build` | Compiles to `dist/` — not needed for normal use. |

## 4. The pipeline, phase by phase (`src/screen/pipeline.ts`, `runScreen()`)

Each phase is timestamped via an internal `mark()` call and rolled up into a 4-category timing breakdown (universe/fetch/detect/report) plus a per-symbol failure-attribution map, both surfaced in the run's output and in the console log. In call order:

1. **Universe build** (`src/universe/`) — pulls the raw NYSE+NASDAQ symbol directory and applies exclusion gates.
2. **Credit regime check** (`fetchCreditRegimeSnapshot`, `src/screen/credit_regime/`) — one FRED call per run (`BAMLH0A0HYM2`, ICE BofA US High-Yield OAS), independent of `--profile`. Degrades to `label: "unknown"` if `FRED_API_KEY` is unset — never blocks the run.
3. **Phase A: quote fetch** (`runQuotePhase`, `src/data/batchFetcher.ts`) — cheap quote-level data (market cap, ADV, price) for the entire post-exclusion universe, checkpointed.
4. **Profile gate** (`evaluateProfileGate`) — filters to symbols passing either `STANDARD` (mkt cap ≥ $300M, ADV ≥ $5M, price ≥ $5) or `SMALL_SPEC` (mkt cap $50M–$300M, ADV ≥ $1M, price ≥ $1, tagged `speculative: true`) thresholds from `config/profiles.json`. If the credit regime is `"tight"`, `SMALL_SPEC` is **forcibly disabled for this run** regardless of what `--profile` requested (`shouldForceDisableSmallSpec`) — the one behavior-changing effect of the credit circuit breaker.
5. **Phase B: enrichment fetch** (`runEnrichmentPhase`) — OHLCV history, sector/industry, institutional-ownership % — only for gate-passed symbols.
6. **Insider filings** (`src/data/insiders/`) — scans SEC EDGAR daily indexes over a configured lookback window, fetches + parses Form 4 filings (the slow phase on a cold run), aggregates into per-symbol insider clusters (`aggregateInsiderClusters`).
7. **Institutional trend** (`runInstitutionalTrendPhase`) — a fresh institutional-ownership snapshot per gate-passed symbol; trend is inferred by comparing this run's snapshot against a prior run's (needs ≥60 days between snapshots by default, `config/card04.json`'s `institutionalTrend.minDaysBetweenSnapshots` — otherwise correctly reports "不可得", not a bug).
8. **Short interest** (`fetchLatestShortInterestFile`) — latest FINRA short-interest file, settlement-date-aware lag reporting.
9. **RS-line fetch** — a second, independent SPY OHLCV fetch for the `rs_line_new_high` signal (disclosed duplication, not deduped with step 12's SPY fetch, for simplicity).
10. **Technical indicators** (`computeIndicators`, `src/screen/indicators/`) — SMA/RSI/ATR/Bollinger/OBV/52-week position/volume-dry-up/sideways-base/pivot points/relative-strength percentile, per gate-passed symbol, merged with the insider-cluster, institutional-trend, and short-interest fields computed above into one `IndicatorFlags` object per symbol.
11. **Detectors** (`allDetectors`, `src/screen/detectors/`) — the four opportunity buckets (§5) run against each symbol's `IndicatorFlags`.
12. **Fundamentals** (`runFundamentalsPhase`, `src/screen/fundamentals/`) — computed **only for the candidate pool** (symbols that hit ≥1 bucket), not the full universe.
13. **Sector footprint aggregation** (`aggregateSectorFootprints`, `src/screen/sector_footprint/`) — over the full gate-passed universe: per-SPDR-sector hit-density on 4 metrics (institutional accumulation rate, insider-cluster rate, significant-short-interest-decline rate, volatility-compression rate); flags `footprintAnomaly` when density ≥2× the cross-sector median AND count ≥3 (config-driven, `config/sector.json`). Sectors below a minimum valid-symbol count are skipped rather than force-aggregated.
14. **Market context** (`fetchMarketContext`) — SPY/VIX/11 SPDR sector ETFs → sector rankings (1mo/3mo composite) + market regime snapshot (`src/screen/regime/`).
15. **Selection** (`selectCandidates`/`selectWatchlist`, `src/screen/select/`) — see §7.
16. **Sector flow scan + hot-sector detail** (`src/screen/sector_scan/`) — a **separate** weekly-return-based ranking of all 11 sectors (independent of step 14's 1mo/3mo composite — deliberately two different systems), plus hand-curated "hot sector" basket coverage (AI infrastructure, 航天/太空 — `config/hot_sectors.json`, explicitly disclosed as an approximation).
17. **FMP enrichment** (`fetchFmpEnrichment`) — dual-source P/E, P/B, PEG, price-mismatch check — **only** for the ≤15-symbol candidate+watchlist pool, never the full universe. Degrades to `不可得` for everything if `FMP_API_KEY` is unset.
18. **Options intelligence** (`computeOptionsIntelligence`, `src/data/options/`) — same narrow candidate+watchlist pool, computed strictly **after** selection is finalized (no code path back into detector/selection logic).
19. **Report generation** — `generateAtlasPayload`/`generateDissentPayload` (`src/report/payload/`) and `renderReport` (`src/report/html/`) — see §8.
20. **Ledger append** (`src/ledger/`) — one `ScreeningLedgerEntry` per candidate and per watchlist entry, never mutating prior lines.

## 5. The four detectors (`src/screen/detectors/`, config in `config/detectors.json` + `config/card04.json`)

All implement `IDetector { id, name, detect(flags, profile, config): DetectorResult }` (`src/screen/detectors/IDetector.ts`). `DetectorResult` carries `{detectorId, triggered, strengthScore: number|null (0-100, bucket-internal sort only), evidence, conditions: FootprintCondition[]}` — `conditions` is a parallel, presentation-only readout of the same comparisons that produced `triggered`, added later (report-layer use) without touching the original trigger logic.

Canonical bucket order (`BUCKET_ORDER` in `src/screen/select/types.ts`): `momentum_breakout`, `volatility_compression_setup`, `oversold_reversal`, `institutional_accumulation_proxy`.

1. **Momentum Breakout** (`momentumBreakout.ts`) — technical breakout structure.
2. **Volatility Compression Setup** (`volatilityCompression.ts`) — Bollinger-band-width percentile squeeze + volume dry-up.
3. **Oversold Reversal** (`oversoldReversal.ts`) — RSI/price-structure reversal setup.
4. **Institutional Accumulation Proxy** (`institutionalAccumulation.ts`) — Form 4 insider-buy clusters + institutional-ownership trend + short-interest decline, combined (`minConditionsRequired` threshold, `config/card04.json`).

A symbol can hit multiple buckets simultaneously. A `latentAccumulationBonus.ts` module adds a strength bonus for a "latent accumulation" composite (added in the most recent work session, TASK_CARD_09 Part A — see §14).

## 6. Universe & exclusion gates (`src/universe/`)

Raw source: NYSE + NASDAQ symbol directory (`RawSymbolRecord {symbol, securityName, exchange, etfFlag, testIssueFlag}`). Exclusion reasons (`ExclusionReason`, `src/universe/types.ts`): `TEST_ISSUE, ETF_ETN_FLAG, ETF_ETN_NAME, WARRANT, RIGHT, UNIT, PREFERRED, SPAC, LEVERAGED_INVERSE, DEBT_SECURITY`. This is where OTC, SPACs, leveraged/inverse funds, and non-common-stock structures get filtered out before profile gating even runs.

## 7. Selection logic (`src/screen/select/`)

- **`selectCandidates`** — round-robin across the 4 buckets (A→B→C→D), with a **promotion-priority pass** first: any symbol on the *previous* run's watchlist that now fully triggers a bucket gets promoted ahead of fresh picks. Cap: `config/card05.json`'s `select.maxCandidates` (currently 3, changed from the original 5 by TASK_CARD_07 Part B).
- **`selectWatchlist`** — priority: unselected volatility-compression hits first, then near-miss fill (`nearMiss.ts` reimplements each detector's real trigger conditions with a 10%-grace band — a deliberate, disclosed duplication of logic, not a shared-code call into the detectors). Cap: `select.maxWatchlist` (currently 8).
- Output types: `SelectedCandidate {symbol, primaryBucket, primaryBucketScore, allBucketsHit, promoted}`, `WatchlistEntry {symbol, reason: "compression_unselected"|"near_miss", nearMiss}`.
- A candidate's/watchlist entry's **`footprintStrength`** (hit-ratio band, `src/report/footprint/footprintStrength.ts`, bands config-driven via `card05.json`'s `footprintStrengthBands`) determines **display order** in the HTML report — selection itself is untouched by this.

## 8. Output artifacts

Every run writes to `output/runs/{YYYY-MM-DD}[_HHMM]/` (same-day reruns get an `_HHMM` suffix so nothing overwrites):

| File | Content |
|---|---|
| `ATLAS_PAYLOAD.txt` | Full evidence-bearing text for the Radar handoff — one block per candidate: bucket(s), all quantitative flags, fundamentals, event window, sector rank, pivot levels, options intelligence, run-level market/credit-regime/sector-flow context. Built by `generateAtlasPayload()` from `PayloadInput`/`PayloadCandidateInput` (`src/report/payload/types.ts`). |
| `ATLAS_DISSENT_PAYLOAD.txt` | Deliberately isolated — **only** `{symbol, primaryBucket}` per candidate plus a templated thesis statement. `DissentInputCandidate`'s TypeScript type physically cannot hold flags/evidence/scores — isolation enforced at the type level, not just by convention. |
| `report.html` | Self-contained single-file HTML report (inline CSS/SVG sparklines, no external resources, zero network calls to render). Five-layer information architecture (01 值得研究/候选, 02 候选明细, 03 观察哨, 04 证据层, 05 流程与账本) as of the most recent redesign. Uses the "refined-functionalism" `data-project="atlas"` CSS custom-property token set (signal-cyan `#22C9D6` accent, dark-only). Built by `renderReport()` from `ReportInput` (`src/report/html/types.ts`) — carries an **optional** `radarNarrative` field for any prose/judgment text (market recap, per-candidate description, theme verdicts); every one of those slots renders a literal `待研究层填充` placeholder when absent, grep-verified to never contain app-synthesized judgment language. As of this snapshot no real Radar pass has ever populated this field. |
| `screen_run.json` | The full `ScreenRunResult` — every computed flag for every gate-passed symbol, timing breakdown, failure attribution, selection result, sector data. The complete machine-readable record of one run. |
| `brief.md` / `dissent.md` (manual, not pipeline-written) | Where the operator is expected to paste Radar's/Red Team's chat responses, if they choose to keep them alongside the run. |

Two always-current, non-dated pointers: `output/latest.html` (mirrors the newest `report.html`) and the global (not per-run) `output/ledger.jsonl` and `output/checkpoint.json`.

## 9. The forward-outcome ledger (`src/ledger/`)

Append-only by construction (`src/ledger/ledger.ts` uses only `appendFileSync` — no `writeFileSync`/`truncateSync`/`unlinkSync` exist in that file, verifiable by grep). Two record types share one JSONL file (`output/ledger.jsonl`, committed to git — the one `output/` artifact that is *not* gitignored, since the constitution requires permanent archival):

- **`ScreeningLedgerEntry`** — `{recordType:"screening", symbol, screeningTimestamp, profile, speculative, status: "candidate"|"watchlist"|"promoted", buckets, flagsSnapshot, holdingPeriod: null (Layer 1 never assigns one — that's a Research Layer decision), opportunityType}`. Written once per candidate/watchlist entry, per run, never mutated afterward.
- **`OutcomeUpdateLedgerEntry`** — `{recordType:"outcome_update", symbol, refersToScreeningTimestamp, backfilledAt, outcome: {repriced, invalidationTriggered, expiredNoEvent, elapsedDays}}`. Written later, manually, via `npm run ledger:backfill`. Joined to its screening entry **at read time** (`joinScreeningWithOutcome`) — never by editing the original line.

This is Atlas's evidence base: real forward results over time, explicitly **not** historical backtesting (constitution Amendment No.2).

## 10. Config files (`config/*.json` — pure data, no code changes needed to tune)

| File | Controls |
|---|---|
| `profiles.json` | STANDARD/SMALL_SPEC market-cap, ADV, and minimum-price thresholds. |
| `detectors.json` | Technical indicator window parameters (SMA/RSI/ATR/Bollinger) + the 3 technical buckets' trigger thresholds. |
| `card03.json` | Fundamental three-state tolerance, sector-strength ranking windows, market-regime thresholds (SPY/VIX), event-window day count. |
| `card04.json` | Insider-cluster judgment (lookback days, min distinct buyers), institutional-trend judgment (min days between snapshots), short-interest thresholds, Detector D's min-conditions-required. |
| `sector.json` | Sector footprint anomaly thresholds (density multiple + min absolute hits + min valid-symbol count per sector). |
| `card05.json` | Selector capacity (`maxCandidates`/`maxWatchlist`), FMP dual-source price-divergence alert threshold, `footprintStrengthBands`. |
| `card07.json` | Sector flow scan rank-threshold rule (flow_in/flow_out/flat classification). |
| `hot_sectors.json` | Hand-curated basket tickers for named hot sectors (AI infrastructure, 航天/太空) — disclosed approximation, not an official classification. |
| `credit.json` | Credit-regime circuit-breaker thresholds (loose/neutral/tight OAS levels + rapid-widening lookback). |
| `card09.json` | Latent-accumulation composite bonus weighting, insider weighting, options-intelligence window parameters. |
| `fetch.json` | Batch size, inter-batch delay, concurrency, retry/backoff for all network fetch phases. |

## 11. Environment variables (`.env`, template in `.env.example`)

All 4 are optional — every one degrades gracefully rather than blocking the run:

- `FMP_API_KEY` — post-screen valuation enrichment (P/E, P/B, PEG, price cross-check, Altman Z, AI-leverage metrics). Unset → all `不可得`.
- `FINNHUB_API_KEY` — reserved, not yet wired into Layer 1's own pipeline (Cockpit uses Finnhub independently — see `COCKPIT.md`).
- `FRED_API_KEY` — credit-regime circuit breaker. Unset → `label: "unknown"` every run, `SMALL_SPEC` never force-disabled.
- `SEC_EDGAR_USER_AGENT` — **must** be email-format (`name@domain`) or EDGAR returns HTTP 403 (verified live). Unset → a well-formed but fake placeholder is used, fine for light/one-off use only.

## 12. Governance / operating system for this repo

`CLAUDE.md` at repo root is a **150-line-cap routing index only** (no rule bodies) defining a startup sequence: read `CLAUDE.md` → `rules_core/01_WEAK_MODEL_CORRECTIONS.md` → `.ruler/rules/*` → `rules_core/02_DISPATCH_PROTOCOL.md` → `ai/current_state.md` → output a `LOADED:` confirmation line → output the current task card. It defines a **model-tier system** (STRONG/MID/SMALL, abstract tiers not tied to a specific model name) with different latitude per tier, and a **task-card + dispatch/circuit-breaker protocol** (`rules_core/`, `cards/TASK_CARD_0N.md`, `templates/`). This is the **same governance framework** used by the sibling Cockpit repo (both descend from a shared `ai-project-template`).

`constitution/` (7 files) is treated as **frozen law** — amendments only, never edited during normal development:
- `ATLAS_v1_0.md` — original 14-module architecture blueprint.
- `ATLAS_AMENDMENT_NO2_v1_1.md` — data-realism / two-layer architecture / forward-tracking amendment (defines the Layer 1/Research Layer split described in §2).
- `ATLAS_AMENDMENT_NO3_SECTOR_EVENT.md` — sector capital footprint + event window.
- `ATLAS_AMENDMENT_NO4_THEME_RADAR.md` — theme radar / sector flow scan (TASK_CARD_07).
- `ATLAS_AMENDMENT_NO5_SIGNAL_REFINEMENT.md` — credit-regime circuit breaker + latent-accumulation signal refinement (TASK_CARD_08/09).
- `ATLAS_MEMO_NO3_ADJUDICATIONS.md` / `ATLAS_MEMO_NO4_FINAL_ADJUDICATIONS.md` — ruling memos (Top-5 candidates, full-market universe, independent-repo decision, four buckets, dual profiles, Candidate Brief structure, Red Team grading, watchlist mechanics).

`ai/project_overview.md`, `ai/current_state.md` (rewritten in full after every meaningful task, append-only `ai/decisions.md`) are the project's own memory system — read `current_state.md` for the authoritative, detailed history of every task card's execution and validation.

## 13. Where the project actually stands today (as of this snapshot)

- All of TASK_CARD_01 through TASK_CARD_08 are **DONE** and independently verified; tagged `v1.0-layer1`, pushed to `origin/master` (GitHub: `LeeSoonDer/atlas_stock_filter`).
- TASK_CARD_09 (`cards/TASK_CARD_09_STANDBY.md` — latent accumulation composite signals, options intelligence, accrual-quality/cash-runway flags) has its Parts A/B/C implemented per recent commit history (`git log`: "TASK_CARD_09 DONE - update current_state", "Part C - accrual quality + cash runway flags", "live-validation fixes - stale fundamentals cache + implausible options IV") — check `ai/current_state.md` directly for the authoritative done/pending status at read time, since this snapshot may already be stale on this specific point.
- **No real Radar → Red Team → adjudication cycle has ever completed.** The operator has not yet pasted a real `ATLAS_PAYLOAD.txt` into the Atlas Radar Project or a real `ATLAS_DISSENT_PAYLOAD.txt` into Atlas Red Team. This is a known, explicitly accepted open gap (see `ai/current_state.md`'s "Next Priorities" — item 1), not a bug.
- `output/runs/` contains real production runs from 2026-08-24 through 2026-08-31 with real candidate/watchlist output.
- An **uncommitted** (`git status`: `?? design-demos/`) exploration folder exists at repo root: `design-demos/_shared-spec.md` plus two prototype HTML mockups (`bucket-centric.html`, `triage-first.html`) exploring further layout alternatives for the already-shipped refined-functionalism-based `report.html` — not yet reviewed/decided/integrated.
- A separate, currently-open thread of work (this session, 2026-08-31) is discussing **whether/how to integrate Atlas with the sister Cockpit product's web app** — see `docs/ATLAS_COCKPIT_RELATIONSHIP.md`. Nothing from that discussion has been implemented yet; it is a planning conversation only.
