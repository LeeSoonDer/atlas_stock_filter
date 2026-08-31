# Decisions

Use this format.

## YYYY-MM-DD - Decision Title

Decision:

Reason:

Tradeoff:

Future implications:

## 2026-08-23 - NYSE universe scope read narrowly as Exchange code "N" only

Decision: otherlisted.txt's Exchange column has codes N (NYSE), P (NYSE Arca), Z (Cboe BZX), A (NYSE American), V (IEX). Only "N" is included in the universe.

Reason: constitution/ATLAS_MEMO_NO3_ADJUDICATIONS.md Q5 says "NYSE 与 NASDAQ" without naming Arca/American/Cboe/IEX. Low-cost, purely-internal, reversible-via-config call (rules_core/03 H2 threshold), so self-selected rather than stopping to ask.

Tradeoff: excludes NYSE American / NYSE Arca / Cboe-listed common stock that some readers might expect under "NYSE". Also had the unplanned side effect of structurally excluding most Arca/Cboe-listed leveraged/inverse ETNs before the name-based exclusion gate even runs.

Future implications: if the project owner wants NYSE American included, this is a one-line change in src/universe/fetchSymbolDirectory.ts (NYSE_EXCHANGE_CODE check).

## 2026-08-23 - Added a DEBT_SECURITY exclusion gate not named in TASK_CARD_01's literal category list

Decision: src/universe/exclusionGates.ts excludes corporate debt notes/bonds/debentures (regex-based, validated against live data for zero false positives against "Common Stock/Shares"-suffixed names).

Reason: TASK_CARD_01's SCOPE 2 gate list (OTC/ETF-ETN/leveraged-inverse/warrant/preferred/SPAC) doesn't mention debt notes, but a live probe found 184 corporate debt instruments (e.g. "9.600% Senior Notes Due 2031") slipping into the universe - these are not common stock, violating the constitution's own universe definition ("全部上市普通股及合格ADR", Memo No.3 Q5). Squarely in-scope (same file/module already being built for this card), not an H4 "found elsewhere" case.

Tradeoff: a handful of closed-end bond funds with no coupon/maturity in their name (e.g. "PGIM High Yield Bond Fund, Inc.") remain in the universe - a fund-structure gap, out of this card's scope, not a common-stock false-admit.

Future implications: none blocking; a future card could add closed-end-fund detection if it matters for detector quality.

## 2026-08-23 - Two-phase fetch: cheap quote-batch filter before expensive per-symbol enrichment

Decision: src/data/batchFetcher.ts fetches quote() (marketCap/ADV, batched up to ~200-300 symbols/request) for the WHOLE exclusion-gated universe first, applies the profile gate, THEN fetches chart()/quoteSummary() (OHLCV + institutional %) only for symbols that already passed.

Reason: TASK_CARD_01's literal pipeline text is "宇宙 → 抓取 → 档位过滤 → 输出", which could read as fetch-everything-then-filter. Fetching OHLCV for the full ~5460-symbol universe before filtering would have made the 90-minute full-run constraint much tighter for no benefit, since "档位过滤" only needs marketCap/ADV (quote-level data).

Tradeoff: none identified - same final output shape, dramatically faster (BOTH profile run completed a full pass in 3.8s once quote+enrichment data was warm).

Future implications: none blocking.

## 2026-08-23 - Checkpoint is shared across --profile invocations, not partitioned by profile

Decision: src/data/checkpoint.ts's loadCheckpoint no longer resets state when the stored `profile` label differs from the requested one; Phase A (quote) and Phase B (enrichment) results are symbol-keyed and reused across standard/small_spec/both runs.

Reason: discovered while building the pipeline shell - both fetch phases only depend on symbol identity, not on which profile the user asked for, so partitioning by profile would refetch identical data three times.

Tradeoff: none identified.

Future implications: verified live - running small_spec after standard needed 0 new quote fetches; running both after both needed 0 new fetches of any kind (3.8s total run).

## 2026-08-23 - Disabled yahoo-finance2's schema validation on batch quote() calls

Decision: src/data/yahooClient.ts's fetchQuoteBatch passes `{ validateResult: false }`.

Reason: a live full-universe run showed the library's strict per-symbol Zod validation throwing for an ENTIRE 200-symbol batch when just one symbol (an unusual quoteType like MONEYMARKET) didn't match its schema - this wrongly marked all 200 symbols in that batch as permanently failed, directly violating the card's "单标的失败不阻塞" constraint. Confirmed by a clean rerun: 0 failures across all 5460 symbols after the fix, vs. 800 false failures before it.

Tradeoff: none - the fields we read were already optional-chained and availability-tagged, so skipping the library's own validation doesn't weaken our zero-fabrication guarantee.

Future implications: none blocking.

## 2026-08-23 - TaskStop / process-tree cleanup gotcha (operational note, not a code decision)

Note: stopping a backgrounded `npm run screen` task via the harness's TaskStop did not reliably kill the full descendant process tree (npm -> tsx -> node loader) on Windows, twice in a row. An orphaned first run kept writing to the same output/checkpoint.json concurrently with a second run, producing corrupted/inconsistent failure counts until both process trees were found via `Get-CimInstance Win32_Process` and killed explicitly by PID. Any future interrupt-and-resume testing on this project should verify via a process listing that no orphan survives before trusting checkpoint state.

## 2026-08-23 - TASK_CARD_02: IDetector interface revised from CARD 01's placeholder

Decision: `detect()` now takes precomputed `IndicatorFlags` (not raw `SymbolMarketData`), plus `ProfileName` and `DetectorsConfig`, and always returns a `DetectorResult` (never null) with a `strengthScore`.

Reason: CARD 01's stub was a best guess written before any detector existed. Once real requirements were known (indicators shared across all 3 detectors rather than recomputed per detector; Detector C's RSI threshold varies by profile), the original signature didn't fit. Same file/feature, in-scope refinement, not a new abstraction.

Tradeoff: none identified.

Future implications: Detector D (Institutional Accumulation Proxy, a later card) should fit this same interface without another revision.

## 2026-08-23 - TASK_CARD_02: added sidewaysBaseDays, not in SCOPE 1's indicator list

Decision: `src/screen/indicators/sidewaysBase.ts` implements a documented, config-driven definition (walk backward from latest close, count consecutive days within a +/-bandPct band).

Reason: Detector B's SCOPE text requires "横向基底 >= 30 个交易日" as one OR-branch of its second condition, but SCOPE 1's indicator list doesn't define how to compute it. Needed to implement the detector the card itself specifies - in-scope, not an H4 addition.

Tradeoff: the band-around-latest-close definition is one reasonable choice among several possible "sideways base" definitions; documented in the function's own comment so it's easy to revise if the project owner wants a different one.

Future implications: none blocking.

## 2026-08-23 - TASK_CARD_02: RS percentile ranked across the full gate-passed set, not per-profile

Decision: rs3MonthPercentile/rs6MonthPercentile rank each symbol's return against every symbol in the current run's gate-passed set, regardless of whether it's STANDARD or SMALL_SPEC.

Reason: the card says the percentile is "在当日全宇宙内" (within that day's full universe) - read as literally the whole screened universe for the run, not segmented by profile.

Tradeoff: a SMALL_SPEC stock's RS percentile is computed against STANDARD-profile stocks too (and vice versa), so it is not a "percentile among peers of the same size class" - if the project owner wants profile-segmented RS instead, this is a small change in src/screen/pipeline.ts's percentile-ranking loop.

Future implications: none blocking.

## 2026-08-23 - TASK_CARD_02: DONE-WHEN's TradingView spot-check done as a numeric substitute

Decision: no browser/TradingView access exists in this environment, so the "抽查每桶3只,人工对照TradingView图形" DONE-WHEN item was satisfied by inspecting the same underlying OHLCV-derived indicator values (price vs SMA/52-week levels, RSI, BB percentile, volume ratios) for 3 symbols per bucket instead of a visual chart comparison.

Reason: honesty over fabrication - claiming to have viewed TradingView charts would violate the project's own anti-hallucination rule. The numeric substitute uses the identical underlying data a chart would show.

Tradeoff: does not catch anything a human's visual pattern-recognition might catch that isn't captured by the computed indicators themselves (e.g., an unusual candle shape). Reported to the user as a substituted method, not silently treated as equivalent.

Future implications: if the user wants a true visual check, they can open the sampled symbols/dates from the TASK_CARD_02 report in their own charting tool.

## 2026-08-24 - TASK_CARD_03: CARD_03_PATCH not attempted - its own stated prerequisite isn't met

Decision: executed only the base TASK_CARD_03.md, not TASK_CARD_03_PATCH.md.

Reason: the patch file's own header states its prerequisite as "CARD 03 与 CARD 04 均验收通过" (sector footprint aggregation needs CARD 04's institutional-bucket data, which doesn't exist yet - CARD 04 hasn't been started). Attempting it now would mean fabricating the institutional density inputs it depends on.

Tradeoff: none - this is the patch file's own stated gate, not a judgment call.

Future implications: revisit TASK_CARD_03_PATCH.md once TASK_CARD_04 is DONE.

## 2026-08-24 - TASK_CARD_03: "候选" population defined as CARD 02's bucket-triggered symbols, not the full universe

Decision: SCOPE 1's fundamental-flag enrichment (financial-statement API calls) ran only on the 366 symbols that triggered at least one CARD 02 detector bucket, not all 3352 gate-passed symbols. Sector-strength tagging (SCOPE 2, cheap - reuses the sector name already cached since CARD 01) still applies to the full 3352.

Reason: no formal Top-5-candidate-selection logic exists yet (deferred to a later card per CARD 02's own MUST-NOT on cross-bucket ranking), so "候选" (candidate) as CARD 03 uses the word has no literal referent yet. Applying full financial-statement enrichment to all 3352 symbols would mean ~6700 new network calls, contradicting the constitution's own stated pattern (Memo No.4 E17: detailed/expensive enrichment applies only after candidates+watchlist are narrowed, capped ~15 symbols) - the bucket-triggered pool is a much closer proxy to that intent.

Tradeoff: a symbol that will later become a formal Top-5 candidate but didn't trigger any CARD 02 bucket (impossible under the current four-detector design, since bucket-triggering is presumably a precondition for candidacy - but worth re-checking once CARD 04's selection logic exists) would lack fundamentals until re-run.

Future implications: once CARD 04 builds real Top-5/Watchlist selection, reassess whether the fundamentals population should switch to that formal candidate+watchlist list instead of the raw bucket-triggered pool.

## 2026-08-24 - TASK_CARD_03: yahoo-finance2's incomeStatementHistory* modules are broken; fundamentalsTimeSeries used instead

Decision: fetchFundamentalsRaw uses `yahooFinance.fundamentalsTimeSeries()` (module: 'financials', type: 'quarterly'/'annual'), not `quoteSummary`'s `incomeStatementHistory`/`incomeStatementHistoryQuarterly` modules.

Reason: verified live, not from memory - the package itself prints a runtime warning that these submodules "have provided almost no data since Nov 2024," and a live AAPL call confirmed `grossProfit` is hardcoded to 0 across every returned period. fundamentalsTimeSeries is the package's own documented replacement; verified separately that its actual field names (`totalRevenue`, `grossProfit`, `netIncome`, unprefixed) differ from the stale prefixed names (`quarterlyTotalRevenue` etc.) shown in the module's own docstring examples - trusted the live JSON response and the .d.ts interface over the docstring.

Tradeoff: none identified - straightforward working replacement.

Future implications: if yahoo-finance2 changes fundamentalsTimeSeries's shape in a future version bump, re-verify live before assuming the field names still hold.

## 2026-08-24 - TASK_CARD_03: revenue "同比" (YoY) growth computed from annual periods, not quarterly

Decision: revenueGrowthFlag compares annual totalRevenue across 3 fiscal years (this year, last year, year before), not quarterly data.

Reason: verified live that yahoo's quarterly fundamentalsTimeSeries only returns ~5 sequential trailing quarters regardless of how far back period1 is requested - not enough span to compare the same calendar quarter a year apart (a genuine YoY comparison). Annual periods reliably span multiple fiscal years and satisfy "同比" literally.

Tradeoff: revenue growth trend updates once a year (per fiscal year-end) rather than quarterly: less responsive than a true quarterly-YoY metric would be, but that metric isn't computable from this free data source.

Future implications: if a future data source provides deeper quarterly history (5+ quarters back), reconsider a true quarterly-YoY version.

## 2026-08-24 - TASK_CARD_04: FINRA's authenticated dataset skipped; free CSV file used instead

Decision: short interest comes from `cdn.finra.org/equity/otcmarket/biweekly/shrt{date}.csv`, not FINRA's `group/equity/name/consolidated_short_interest` API.

Reason: verified live - the "consolidated" API dataset returns 401 without a token (not free); its similarly-named free sibling (`group/otcMarket/name/EquityShortInterest`) is genuinely OTC-only (AAPL returns 204). The CSV file, despite its "otcmarket" URL path, is confirmed to include real NYSE/NASDAQ names.

Tradeoff: none identified - the CSV file has everything SCOPE 3 needs.

Future implications: if FINRA ever locks down this CSV path too, the authenticated API is the fallback, but would need a registered API key (no longer "zero付费依赖" in spirit, even if the key itself is free to obtain).

## 2026-08-24 - TASK_CARD_04: institutional ownership trend will be 不可得 on every symbol until this repo's second-ever run

Decision: accepted as correct, disclosed to the user before running, not silently shipped.

Reason: Yahoo has no API for a clean multi-period aggregate institutional-% trend, so computeInstitutionalTrend compares this run's fresh snapshot against a prior run's persisted snapshot (checkpoint.institutionalHistory) - see the file's own comment. A first-ever run has no prior snapshot to compare against.

Tradeoff: Detector D's institutional-trend condition is effectively unavailable until enough calendar time has passed between two runs (config-driven minDaysBetweenSnapshots, default 60 days) - live-verified the other 3 conditions (insiderCluster, short interest, OBV slope) are sufficient on their own to produce real Detector D hits (512 on the full 90-day run) even with this condition universally unavailable.

Future implications: revisit once this repo has been run repeatedly across a >60-day span in production use.

## 2026-08-24 - TASK_CARD_04: full 90-day EDGAR Form 4 backfill is a ~2.5-3 hour one-time cost

Decision: accepted as the real, disclosed cost of the first-ever run; not narrowed down per the card's own circuit-breaker fallback ("卡死优先降范围,如只解析最近30日"), since the full run completed successfully (0 failures, no 403/429 bans) rather than getting stuck.

Reason: cross-referencing SEC's daily Form-4 index against our 3352-symbol universe empirically found ~36% overlap (~430 relevant filings/day), meaning a 90-day window means ~32,000 individual filing fetches. At a safety-margined 8 req/s (SEC's cap is 10 req/s), that floor alone is ~67 minutes; the real run measured 161 minutes end to end (including Phase B's one-time floatShares cache migration for all 3352 symbols).

Tradeoff: every subsequent `npm run screen` run is cheap (only scans new days and fetches filings not already in the permanent insiderFilingResults/insiderDailyIndexCache - both accumulate forever, never re-fetched) - this cost is paid exactly once per environment, not per run.

Future implications: if the checkpoint is ever deleted/reset, this ~2.5-3 hour cost recurs. Worth calling out to the user before any future checkpoint-clearing operation.

## 2026-08-24 - TASK_CARD_03_PATCH: DONE-WHEN item 5 (HTML report + PAYLOAD integration) deferred to CARD 05

Decision: executed Parts A (sector footprint) and B (event window) fully, but explicitly did NOT attempt DONE-WHEN item 5 ("板块异动与事件旗标均进入HTML报告...与PAYLOAD").

Reason: neither the HTML report nor the PAYLOAD generator exist in this repo - both are explicitly CARD 05's scope (src/report/html, src/report/payload, per TASK_CARD_05.md SCOPE 3-5). This patch's own SCOPE only names src/screen/sector_footprint and src/screen/event_window (computation directories), never touching src/report. Building throwaway HTML/PAYLOAD scaffolding now would either duplicate or conflict with CARD 05's actual planned design.

Tradeoff: none - this mirrors the same treatment given to the whole patch being blocked on CARD 04 earlier (disclosed up front, not silently skipped).

Future implications: revisit once CARD 05 exists - sectorFootprints (runMeta) and eventWindow (per-candidate) are already computed and available in the pipeline output for CARD 05's HTML/PAYLOAD code to consume directly.

## 2026-08-24 - TASK_CARD_03_PATCH: config/sector.json created as a new file, not merged into card03.json

Decision: Part A's thresholds live in a new config/sector.json, not as a new section inside the existing config/card03.json.

Reason: the card's own SCOPE text explicitly names "config/sector.json" (not card03.json), and the patch's header frames itself as "append-only,不改动CARD 03已定范围" - a new file is a cleaner literal match than extending an already-shipped card's config file, even though the latter would also have been purely additive.

Tradeoff: none identified.

Future implications: none blocking.

## 2026-08-24 - TASK_CARD_03_PATCH: lockup_expiry and shareholder_meeting/product_launch event types are permanently unpopulated in this implementation

Decision: computeEventWindow only ever returns 'earnings' entries.

Reason: verified live (grepped yahoo-finance2's complete type definitions) that no lockup/IPO-related field exists anywhere in the package. Guessing an expiry date from firstTradeDate + an assumed standard lockup period length would fabricate a specific date the system doesn't actually know (real lockup terms vary by company and can have early-release provisions) - this would violate the project's zero-fabrication principle, so it was deliberately not attempted. shareholder_meeting/product_launch would need a news/calendar data source (e.g. Finnhub) that has no configured API key. The card's own wording ("若IPO标的,profile可得则算" and "尽力而为,不可得则跳过") explicitly anticipates and permits this outcome.

Tradeoff: event_window is currently earnings-only in practice, even though its type system supports all 4 event types.

Future implications: if a Finnhub key is ever configured, shareholder_meeting/product_launch could be added without a type/schema change - only a new data-fetch + merge step.

## 2026-08-24 - TASK_CARD_05: near-miss detection reimplements each detector's exact conditions with one numeric condition given a 10% grace band

Decision: src/screen/select/nearMiss.ts's 4 functions mirror momentum_breakout/volatility_compression_setup/oversold_reversal/institutional_accumulation_proxy's real trigger logic exactly, except exactly one threshold-comparison per detector is relaxed by 10% (documented inline per function) so a symbol that's "close" to triggering can be identified for the watchlist.

Reason: the card requires a watchlist populated partly by "接近触发" (near-trigger) symbols, but no card defines what "near" means numerically. Re-deriving each detector's full boolean condition tree from src/screen/detectors/ (rather than inventing a separate scoring heuristic) keeps near-miss logic provably consistent with the real detectors; picking one representative numeric condition per detector (not all of them) to relax was the simplest rule that avoids ambiguity about which combination of conditions should count as "close."

Tradeoff: which single condition was chosen to relax is a judgment call per detector (documented in the function itself) - a symbol that's very close on a different condition than the one relaxed won't be flagged as near-miss.

Future implications: if the project owner wants a different definition of "near," this is a self-contained, easily revised file.

## 2026-08-24 - TASK_CARD_05: watchlist promotion drops non-compression-eligible candidates that lose their seat to a promotion, by design

Decision: no code changes were made to prevent this; observed and accepted as correct.

Reason: selectCandidates fills seats in two passes - promotion priority (previous watchlist symbols, by score) first, then round-robin for remaining seats. When enough prior-watchlist symbols are promoted to fill all seats, a symbol that was a non-compression candidate last run (and is therefore not compression-bucket watchlist-eligible, and is already-triggered so not near-miss-eligible either) has no path back onto this run's watchlist and disappears from selection entirely. Live-verified across two consecutive runs on real data: MRVI/TENX/ABCL/RCMT (run-1 non-compression candidates) vanished from run-2 selection exactly this way.

Tradeoff: a symbol can go from "candidate" to entirely unselected in one run with no watchlist bridge, which may look surprising in the ledger's history for that symbol.

Future implications: if the project owner wants a "promoted-but-bumped" candidate to land back on the watchlist instead of vanishing, selectWatchlist's eligibility rules would need a new bucket_agnostic fallback path - not attempted here since it's not what the card specifies.

## 2026-08-24 - TASK_CARD_05: FMP enrichment degrades to universal 不可得 when FMP_API_KEY is unset, rather than blocking the run

Decision: src/data/enrich/fetchFmpData.ts checks for the env var up front and, if absent, returns a fully-不可得 FmpEnrichment for every symbol without attempting any network call.

Reason: FMP requires a paid/free-tier-signup API key that isn't configured in this environment; the constitution's own zero-fabrication rule requires 不可得 tagging (not a fabricated or skipped field) when data genuinely can't be obtained, and the card doesn't make FMP enrichment a hard blocking dependency for the rest of the pipeline (candidates/watchlist/detectors don't depend on it). Verified live: a full run with no key set completed normally, reporting "no FMP_API_KEY configured - all 不可得" for all 5 candidates.

Tradeoff: PEG/P-E/P-B dual-source cross-check (SCOPE 1's stated purpose) is inert in this environment until a key is supplied.

Future implications: set FMP_API_KEY in .env (see .env.example) to activate; no code change needed.

## 2026-08-24 - TASK_CARD_05: FMP field names (priceToEarningsRatioTTM etc.) verified via WebSearch, not a live API call

Decision: computeFmpEnrichment.ts reads `priceToEarningsRatioTTM`, `priceToBookRatioTTM`, `priceToEarningsGrowthRatioTTM` from FMP's `/stable/ratios-ttm` response shape; P/S and EV/EBITDA fields were deliberately left out of SCOPE 1's cross-check.

Reason: no FMP_API_KEY was available in this environment to empirically verify field names against a live response (the project's usual anti-hallucination method for external APIs), so field names were instead cross-checked against FMP's own current API documentation and community-reported response samples via WebSearch. P/S and EV/EBITDA field names could not be confirmed with the same confidence from available sources, so they were excluded rather than guessed.

Tradeoff: unlike every other external API integration in this project (Yahoo, SEC EDGAR, FINRA - all live-verified), this one is documentation-verified only; there is real residual risk FMP has since renamed or restructured this response shape.

Future implications: once a real FMP_API_KEY is available, the very first live run's response should be spot-checked against these assumed field names before trusting any FMP-derived value in a real decision.

## 2026-08-24 - TASK_CARD_05: ledger schema split into immutable ScreeningLedgerEntry vs separate append-only OutcomeUpdateLedgerEntry

Decision: src/ledger/types.ts defines two record types in the same output/ledger.jsonl file (discriminated by `recordType`); an outcome/backfill is never written by mutating or replacing the original screening record, only by appending a new OutcomeUpdateLedgerEntry that references it by `(symbol, screeningTimestamp)`.

Reason: the constitution requires the forward outcome ledger be append-only with no mutation or deletion ever (Amendment No.2, 修正案五). A single mutable record (screening fields + outcome fields on one object, outcome filled in later) would require rewriting an existing line in the file, which is exactly the operation the constitution forbids; two record types in one append-only stream satisfies the same relational need without ever touching a previously-written line.

Tradeoff: reading "the current state of a screened symbol" requires joining screening records with their (possibly absent, possibly multiple over time) outcome records at read time (see computeLedgerStats/joinScreeningWithOutcome), rather than a single-record lookup.

Future implications: any future code that reads the ledger must go through the join helpers, never assume one line = one complete record.

## 2026-08-24 - TASK_CARD_05: output/ledger.jsonl is tracked in git, unlike every other output/ artifact

Decision: .gitignore's `output/*.json` blanket rule is left in place for regenerable run artifacts, but output/ledger.jsonl is explicitly NOT ignored and is committed with its real accumulated entries.

Reason: every other file in output/ (checkpoint.json, screen_run_*.json, atlas_payload/dissent/report artifacts) is fully regenerable by re-running the pipeline against live data. The forward outcome ledger is different in kind - it is the project's permanent historical record of what was screened and what happened afterward, and the constitution requires it be archived and never deleted (Amendment No.2, 修正案五). Git's append-friendly, auditable commit history is a reasonable fit for an append-only file that must never be rewritten.

Tradeoff: the repo's git history will grow indefinitely as the ledger grows; large binary-diff-unfriendly growth isn't a concern since it's line-appended JSONL, but repo size should be revisited if the ledger grows very large over years of use.

Future implications: never `git rm`, force-push over, or rewrite history touching this file; any future tooling that also writes to it must also only append.

## 2026-08-24 - TASK_CARD_05: DISSENT payload isolation enforced at the TypeScript type level, not just by convention

Decision: src/report/payload/generateDissentPayload.ts's input type, DissentInputCandidate, is structurally limited to `{ symbol, primaryBucket }` - it cannot compile against a richer candidate object containing flags/evidence/scores, even by accident.

Reason: the constitution's "隔离铁律" (isolation iron rule) requires the red-team DISSENT payload contain zero flag values, evidence, or supporting reasoning - only the bare symbol/bucket/thesis-skeleton needed to write an independent dissenting case. A runtime filter (build the full payload, then strip fields) would be one refactor away from a leak; a type that structurally cannot hold the excluded fields makes that class of leak a compile error instead of a runtime risk. Verified live by grepping both real run's generated DISSENT payload files for any of the excluded field names/values - zero matches both times.

Tradeoff: none identified - this is strictly safer than the alternative with no added complexity.

Future implications: if a future card wants to add any new field to the DISSENT payload, it must be added deliberately to DissentInputCandidate's type, not passed through from the full candidate object.

## 2026-08-24 - TASK_CARD_05: two DONE-WHEN items substituted/disclosed rather than personally verified

Decision: "PAYLOAD 实贴 Atlas Radar 可产出合规辩护状(人工验证一次)" and "HTML 报告浏览器打开,渲染正常,sparkline 可见" were not claimed as directly verified by me.

Reason: no access to Atlas Radar (an external tool the user operates) or a browser rendering environment exists in this environment. Consistent with this project's established pattern (see TASK_CARD_02's TradingView substitution above), the honest move is a structural/textual substitute - inspecting the generated payload text and HTML source directly (grep-verified content, structure, escaping, absence of gradient/purple styling) - reported to the user as a substitution, not silently treated as equivalent to the card's literal instruction.

Tradeoff: does not catch anything only a human's eyes or Atlas Radar's own ingestion logic would catch (e.g., a rendering glitch, an Atlas Radar parsing quirk).

Future implications: the user should open the generated atlas_report_*.html in a real browser and paste the atlas_payload_*.txt into Atlas Radar at least once to close this verification gap.

## 2026-08-24 - TASK_CARD_06: SCOPE 1's real-cycle issue list explicitly accepted as empty, not blocked on

Decision: SCOPE 1 ("真实周期问题清单逐条修复(你提供清单,Claude Code 执行)") was closed with zero items, by the project owner's explicit direction, rather than by finding or fabricating friction points.

Reason: this card's own header states its prerequisite as "CARD 05 验收通过 + 你已完成至少一次真实周期(含 Radar 与 Red Team)" - literally reading that, SCOPE 1 depends on a real screen -> Atlas Radar -> Atlas Red Team cycle having already happened, and on the project owner having personally noticed friction during it. No such cycle's artifacts exist in this repo (docs/sop/SOP_WEEKLY.md is present but is an unfilled procedure template with no actual run log; no record of a PAYLOAD having been pasted into Radar or a DISSENT PAYLOAD run through Red Team - consistent with TASK_CARD_05's own disclosed CANNOT-VERIFY items above). Asked the project owner directly rather than guessing; they chose to accept SCOPE 1 as empty and proceed with the rest of the card now, rather than pausing CARD 06 until a real cycle happens.

Tradeoff: v1.0-layer1 ships without having been pressure-tested through one real end-to-end cycle including the two external LLM reasoning environments. Any friction that a real cycle would have surfaced (PAYLOAD formatting issues Radar chokes on, DISSENT PAYLOAD skeleton fields that turn out to be awkward in practice, etc.) remains undiscovered.

Future implications: once the project owner does run a real cycle, any friction found should still get logged and fixed - just as a normal ai/decisions.md entry / follow-up commit rather than retroactively reopening this card. TASK_CARD_06_AND_ROADMAP.md's post-v1 cards (07/08, CARD 04b) remain available for exactly this kind of iteration.

## 2026-08-25 - Post-v1: output/ reorganized into per-run-date folders, not a task card

Decision: every `npm run screen` run now writes its artifacts to `output/runs/{YYYY-MM-DD}/` (same-day re-runs get an `_HHMM` suffix from the run's own timestamp) instead of flat `output/` files with a full ISO timestamp baked into each filename. Files within a run folder are fixed-named (`ATLAS_PAYLOAD.txt`, `ATLAS_DISSENT_PAYLOAD.txt`, `report.html`, `screen_run.json`) since the folder itself now carries run identity. A new `output/latest.html` is overwritten every run with a copy of that run's report, giving a permanently-stable path for "the newest report" independent of date. `output/ledger.jsonl` and `output/checkpoint.json` were deliberately left at `output/` root, untouched - the ledger is a single global append-only file by constitutional requirement (Amendment No.2), and checkpoint is fetch-layer cache infrastructure, not a per-run artifact; neither fits "reorganize by run date."

Reason: direct project-owner request, explicitly framed as "纯工程整理,不碰任何分析逻辑或 constitution" (pure engineering cleanup, doesn't touch analysis logic or the constitution) - not part of any task card's SCOPE, executed as a normal ad-hoc engineering change outside the card-based workflow rather than requiring a new card. `resolveRunFolder` (the folder-naming logic) was extracted into its own file (`src/screen/resolveRunFolder.ts`) with a `baseDir` parameter specifically so it could get real unit tests (4 cases: first run of a day, second/third same-day runs each getting a distinct suffix, a new day resetting to bare) rather than only being exercised via live pipeline runs - matches this project's established fetch/compute separation convention for pure logic.

Tradeoff: `screen_run.json`/`report.html`/etc. are no longer individually unique filenames across the whole `output/` tree (two different runs both have a file literally named `report.html`, just in different folders) - any external tooling or muscle memory built around globbing flat `output/atlas_report_*.html` patterns needs updating (README, canary/README.md, docs/sop/SOP_WEEKLY.md all updated in the same change).

Future implications: the 4 pre-existing historical run artifacts (all from 2026-08-24) were migrated by hand into `output/runs/2026-08-24/` (first) and `_1409`/`_1418`/`_1419` (subsequent), replicating exactly what the new code would have produced - these are gitignored regenerable files, so the migration itself left no git history. `canary/atlas_payload_baseline.txt`'s cited source path (`output/atlas_payload_2026-08-24T14-07-43-049Z.txt`) no longer exists under that name; `canary/README.md` was updated to note this explicitly rather than leaving a dangling reference.

## 2026-08-27 - TASK_CARD_07 Part B: candidate/watchlist caps changed in place (config/card05.json), not a new parallel config

Decision: `config/card05.json`'s `select.maxCandidates` changed from 5 to 3 and `select.maxWatchlist` from 10 to 8, directly in the same file/keys TASK_CARD_05 introduced - no new `card07.json` `select` section was created alongside it.

Reason: Amendment 13's "双层候选制" (第一层至多3, 第二层至多8) redefines the same underlying selection mechanism CARD 05 built (`selectCandidates`/`selectWatchlist`, promotion state machine, near-miss fill), not a parallel/independent one - the card's own SCOPE text says to reuse CARD 05's logic as-is ("沿用 CARD 05 逻辑"). Two config files both claiming to define the same cap would be a duplicate, contradictable source of truth; a single in-place value change is the more honest representation of "this number changed," and the `select/` module's code required zero changes.

Tradeoff: none identified - this is a pure config value change; every existing selectCandidates/selectWatchlist unit test constructs its own SelectConfig object rather than reading the real file, so none needed updating.

Future implications: `config/card07.json` exists for genuinely new CARD 07 concepts only (currently just `sectorFlow`'s rank thresholds) - it is not the home for tier-cap numbers.

## 2026-08-27 - TASK_CARD_07 Part A: AI 基建/航天太空 hot-sector baskets are a hand-curated, unverified approximation - disclosed, not hidden

Decision: `config/hot_sectors.json`'s two basket-kind entries (AI 基建: 10 tickers; 航天/太空: 8 tickers) were assembled from general knowledge of well-known companies in each theme, not empirically verified against any official industry/sector classification the way every other data source in this repo has been (SEC EDGAR, FINRA, Yahoo fields all live-verified before use per this project's anti-hallucination rule).

Reason: the card explicitly anticipates and sanctions this ("AI基建与航天太空可能跨板块,用ticker篮子近似"), and its own circuit-breaker offers an even lighter fallback ("首版降级为'仅标注该主题本周有无候选进入'") if precise mapping proves too complex. Rather than either fabricating a precise-looking sector classification with no real basis, or taking the minimal checkbox-only fallback, the chosen middle path computes REAL aggregate weekly-return/squeeze-density numbers from whichever basket tickers happen to already be present in that run's gate-passed universe (their OHLCV is already cached from Phase B enrichment - no new network calls) - the underlying per-ticker numbers are real and traceable, only the theme-to-ticker membership itself is an unverified, disclosed approximation.

Tradeoff: some basket tickers may be stale (delisted, renamed, ticker-changed) by the time this runs, given the list was assembled from general knowledge rather than a live lookup. This degrades gracefully rather than fabricating: a ticker not found in `checkpoint.enrichResults` is silently excluded from the average and the resulting reduced coverage is disclosed via `basketCoverage: {found, total}` in both the payload text ("篮子覆盖: N/M...") and (once Part C lands) the HTML report - never silently assumed complete.

Future implications: if the project owner wants a more rigorous basket (or to swap in a real thematic ETF as a proxy, e.g. an existing AI/robotics or space-focused ETF), `config/hot_sectors.json` is the single edit point - no code change needed. Worth revisiting once this repo has run enough times to notice which basket tickers consistently fail to resolve.

## 2026-08-27 - TASK_CARD_07 Part A: sector flow rank is its own weekly-return ranking, independent of sectorStrength.ts's 1mo/3mo composite rank

Decision: `SectorFlowEntry.rank` (1-11, used for the flow_in/flow_out threshold rule) is computed fresh by sorting sectors on `oneWeekReturn` alone - it does NOT reuse or derive from `SectorRanking.compositeRank` (the existing 1-month/3-month blended rank used for candidate-level tailwind/headwind tagging, unchanged since TASK_CARD_03).

Reason: the card's own flow-state rule ties rank directly to weekly return sign ("rank 前四且周涨正 = flow_in"), which only makes sense if rank is itself weekly-return-based - a composite 1mo/3mo rank could disagree with the current week's direction entirely (e.g. a sector up big over 3 months but down this week), which would make the flow_in/flow_out labels internally inconsistent with their own stated numbers. These are now two deliberately separate ranking systems answering two different questions: sectorStrength's composite rank answers "which sector has been strong over the medium term" (feeds candidate-level tailwind/headwind); sector_scan's weekly rank answers "where did money move this week" (feeds the flow scan). Both are legitimate, non-conflicting views computed from the same underlying sector ETF price data.

Tradeoff: a sector could simultaneously show as "headwind" (weak 1mo/3mo) on a candidate's payload entry and "flow_in" (strong this week) in the sector flow scan - this is not a bug, it is two genuinely different timeframes disagreeing, and should be read as such rather than reconciled into one number.

Future implications: if a future card wants a single unified sector ranking, this would need a deliberate redesign rather than just picking one of the two existing systems - they answer different questions on purpose.

## 2026-08-27 - TASK_CARD_07 Part C: dark-only visual theme, no light-mode variant, deliberate

Decision: the rebuilt HTML report has a single dark "intel briefing" theme (background #0a0e14 etc., copied from MOCKUP_intel_briefing_v4.html) with no `@media (prefers-color-scheme: light)` override - unlike TASK_CARD_05's original report, which did support both.

Reason: the project owner explicitly instructed following the mockup's own visual style, and the mockup itself has zero light-mode consideration - it's a single, deliberately dark "ops/intel dashboard" identity, a genre where dark-only is a normal, intentional design choice (not an oversight to "fix"). Adding an unrequested light-mode variant would be inventing design work not asked for, and risks clashing with a reference the project owner named specifically.

Tradeoff: a user with an OS-level light-mode preference gets a dark report regardless - a deliberate deviation from this repo's general "respect OS preference" pattern used elsewhere (e.g. canary docs, this file's own light-mode entries), scoped specifically to this one report's genre-appropriate identity.

Future implications: if the project owner later wants a light-mode toggle, that's a new, explicitly-requested design task, not an omission to quietly patch in.

## 2026-08-27 - TASK_CARD_07 Part C: gradients/violet reintroduced, superseding TASK_CARD_05's "no AI-slop" constraint

Decision: the new styles.ts uses `linear-gradient()` backgrounds (market/theme/forecast panels) and a violet accent color (`--violet`), both of which TASK_CARD_05's own DONE-WHEN explicitly tested AGAINST ("no gradients, purple/violet keywords" - see renderReport.test.ts's TASK_CARD_05-era assertion, now removed).

Reason: TASK_CARD_05's constraint was a documented fallback for the specific situation where no design reference existed ("没有 P4_DESIGN_SPEC... 极简终端风,禁止 AI-slop" - see styles.ts's TASK_CARD_05-era comment) - it was never an absolute, permanent rule independent of context. TASK_CARD_07 gives an explicit, named visual reference (MOCKUP_intel_briefing_v4.html) that the project owner pointed to directly; a user's current, explicit instruction naming a specific design outranks an earlier card's own stopgap fallback preference, especially once that earlier card's stated precondition (no reference exists) no longer holds. The mockup's gradients are subtle panel-to-panel background tints and a soft radial glow, not the bright/saturated "AI-slop" pattern the original constraint was actually guarding against.

Tradeoff: none identified as a functional risk - this is a deliberate, instructed visual direction, not a regression. The old anti-gradient test assertion was removed from renderReport.test.ts rather than kept-but-ignored, since a stale contradictory test would be actively misleading to a future reader.

Future implications: if a later card again lacks a named design reference, TASK_CARD_05's original "no AI-slop" fallback reasoning is still sound guidance to fall back on - it wasn't wrong, just superseded by a more specific instruction for this card.

## 2026-08-27 - TASK_CARD_07 Part C: every mockup prose/judgment element gated behind an optional `radarNarrative` field, defaulting to a literal placeholder

Decision: `ReportInput.radarNarrative` (types.ts) is fully optional, and every function that would otherwise render mockup-style prose (market recap paragraph, per-sector verdict, theme narrative, per-candidate desc/grade/probability/confidence, excluded-item reasoning, weekly forecast) checks for its presence and renders the literal string "待研究层填充" when absent or when a specific sub-field is missing - there is no code path that synthesizes placeholder-adjacent "reasonable-sounding" filler text.

Reason: this is the card's own explicit, non-negotiable architecture boundary ("关键边界: 应用层只做数据与渲染,绝不生成任何判断/预测/白话文字...首次运行时若尚无 Radar 返回...主题区与白话区显示'待研究层填充'占位,不得由应用层编造") and the DONE-WHEN item literally requires it be grep-verifiable ("grep 验证无硬编码判断句"). A single shared literal placeholder string (rather than several different ad-hoc "no data" messages) makes this both simpler to implement correctly and trivially greppable for verification - one string to check for, one string that can never accidentally look like real analysis.

Tradeoff: the pre-Radar report is visually much sparser than the full mockup (most of its content is exactly this kind of prose) - candidate cards show real facts (RSI/SMA/volume/badges/sparkline) but an "N/A" grade box and placeholder desc until a real Radar pass happens. This is intentional, not a regression - the mockup is Radar's finished output, not this repo's own claim.

Future implications: once the project owner does run screen -> Radar -> Red Team and gets back real narrative content, that content needs to be threaded into pipeline.ts's renderReport() call as a `radarNarrative` object (currently nothing populates this - it's wired into the type/render layer only, per this card's own scope boundary; actually parsing a Radar response and building this object is future work, likely CARD 08's MCP-proxy territory or a manual one-off script).

## 2026-08-27 - TASK_CARD_07: stale-module gotcha when live-validating mid-edit (operational note, not a code decision)

Note: launched a background `npm run screen -- --profile both` live-validation run right after Part A's pipeline/payload commit, then continued editing renderReport.ts/styles.ts/types.ts for Part C while that run was still executing in the background (it took ~16 minutes due to the institutions phase). Node.js does not hot-reload a running process's already-imported modules - the run's report.html reflected the OLD pre-Part-C rendering code, even though it finished well after Part C was written to disk and committed, because the process had already loaded the old module bytes into memory at its own start time. The PAYLOAD file from that same run WAS representative of Part A's final code, since payload generation code wasn't being edited concurrently. Caught by manually inspecting the generated file's raw `<style>` block (still showed the old `--fg`/`--muted` primary token names instead of the new `--bg`/`--panel`/`--ink` scheme) rather than trusting the console log's "success" line. Fixed by simply re-running the pipeline once all Part C edits were committed - Phase A/B/insiders were instant on the warm checkpoint, so the corrected re-run only cost ~32 seconds. Any future "live-validate while still editing" workflow on this project should either wait for edits to fully land before launching the validation run, or re-run once more after the last edit before trusting that specific run's output as representative.

## 2026-08-27 - TASK_CARD_07: commit-count/labeling correction, caught by independent verification

Decision: corrected `ai/current_state.md`'s claimed "9 commits" for TASK_CARD_07 to the actual count of 7, and disclosed here (rather than silently fixing) that commit `208fdaa` is mislabeled - its message reads `docs: add TASK_CARD_07, Amendment No.4 (Theme Radar), and the v4 mockup`, but its actual diff (920 insertions, 17 files) also bundles in the complete Part A implementation (`computeSectorFlowScan.ts`, `computeHotSectorDetail.ts`, their tests, `sector_scan/types.ts`/`index.ts`) and the Part B config change (`card05.json` 5/10 -> 3/8) and the `oneWeekReturn` wiring into `pipeline.ts`.

Reason: this was a real git-add staging mistake, already caught and disclosed to the project owner in real time when it happened ("That commit picked up more than intended... Not amending per project convention" - see the conversation itself; this file did not previously record it as a formal decision). Independent verification of this card correctly caught that the memory files' commit description hadn't been updated to reflect the actual, messier git history, and that the stated commit count was simply wrong. Per this project's "prefer new commit over amend" convention, `208fdaa` itself was not rewritten - its actual code content was independently verified as correct regardless of which commit it happens to sit in.

Tradeoff: a future reader using `git log --oneline` to understand "what changed per commit" for this card will find `208fdaa`'s diff doesn't match its stated scope - this note and the corrected current_state.md count are the record of that discrepancy.

Future implications: none blocking - purely a git-history/documentation accuracy fix. Reinforces the general lesson (already noted elsewhere in this file for a different card) to run `git status` and review the actual staged diff before committing, not just before staging, especially when multiple `git add` calls happen close together across several logical units of work.

## 2026-08-31 - claude_code_design_draft.md: Weekly Intel Briefing 重构为五层地层信息架构(信息分层版 v2)

Decision: 按 `claude_code_design_draft.md`(project owner 提供的完整实现指令)重写了 `src/report/html/{renderReport,styles,types}.ts`,把周报从 TASK_CARD_07 Part C 的单一密度"intel briefing"外观,改成五个编号地层(01值得研究/02候选明细/03观察哨/04证据层/05流程与账本),每层字号/密度/表面处理各不相同。新增两个纯确定性派生字段支撑这次重构:

1. `footprintDetail`(`src/screen/detectors/IDetector.ts` 的 `FootprintCondition[]`,四个检测器文件 `momentumBreakout.ts`/`volatilityCompression.ts`/`oversoldReversal.ts`/`institutionalAccumulation.ts` 各自在其 `DetectorResult` 里新增 `conditions` 字段) - 把检测器早已算出、此前被丢弃的逐条阈值比较结果保留下来,`label`/`threshold` 全部从 `config/detectors.json`/`config/card04.json` 的真实参数插值生成,不写死字面量。**这是加法,不是改法**:每个检测器原有的 `triggered`/`strengthScore` 判定表达式一个字符都没动,`conditions` 是从同一批已计算的局部变量并行读出的独立字段。
2. `footprintStrength`(`src/report/footprint/footprintStrength.ts`)- `hitCount/availableCount` 的比值,不可得项不进分母也不算 miss;分档写进 `config/card05.json` 的新键 `footprintStrengthBands`(强≥.75/中≥.55/中偏弱≥.35/弱<.35),ratio 为 null 时(全部条件不可得)显示"不可得"而非 0% 进度条。双桶命中的候选按 `mergeFootprintDetail()` 合并两个桶的条件清单。

`src/screen/pipeline.ts` 新增一个仅存活于内存的 `detectorResultsBySymbol: Map`(不写入 `screen_run.json`,不影响其持久化体积),只在候选+观察哨的窄池(≤15只)上取用来算 footprintDetail - 与既有的 FMP enrichment"永不覆盖全宇宙"先例(Memo No.4 E17)同一个理由。候选的**展示顺序**(不是选取逻辑)现在按 `footprintStrength.ratio` 降序排,null 垫底 - `selectCandidates.ts` 本身完全未改。

Reason: 草案 §0 铁律明确"仅改呈现层...允许改的:生成HTML的模块 + 为分层所需的纯确定性派生字段"。footprintDetail/footprintStrength 都是从已经真实计算过的检测器比较结果和已有 `flags` 推导出来的,不引入任何新判断、新阈值或新外部依赖,满足"零AI推理、零新增依赖"。

Tradeoff: 四个检测器文件的 `conditions` 构造函数(`unavailableConditions`/`evaluatedConditions`)客观上是把已有的比较表达式又写了一遍(而不是复用原表达式的布尔值),存在"两处逻辑各自维护"的理论漂移风险 - 为控制这个风险,`conditions` 的构造严格摆在原判定逻辑**之后**,读同一批已经从 `flags`/`config` 解构出的局部变量,不重新派生新的中间值。`RadarCandidateVerdict.grade`/`probability`/`confidence` 三个字段仍保留在类型里(未删除,向后兼容),但新的候选卡片头部不再渲染它们 - 草案的 02 层规格通篇只提"足迹强度"作为候选卡头部的右侧读数,没有任何一处提到 grade/probability/confidence,视为该草案的既定意图(用确定性证据取代 Radar 主观评级作为首要读数),而非遗漏。

Future implications: 若未来某个 card 想恢复 grade/probability/confidence 的展示,`RadarCandidateVerdict` 类型和 `radarNarrative.candidateVerdicts` 数据通道都还在,只需要在 `renderCandidateCard()` 里重新读取即可,不需要改动上游任何数据结构。`scripts/preview-report.ts`(新增,不属于 `src/`,不在 `npm test` glob 内)是一个可复用的"从已存 screen_run.json + output/checkpoint.json 重渲染 report.html"脚本,零网络调用 - 用于本次交付的视觉验证(见下一条),未来任何一次只改呈现层的重构都可以复用它,不需要重新跑一次完整的 `npm run screen`。

## 2026-08-31 - TASK_CARD_08 (信用环境防御闸 + 最低股价闸) DONE

Decision: 落地 `atlas_bootstrap_final` 升级包(第五号宪法修正案 + CARD 08/09 + 参考文档),按 `UPGRADE_DEPLOYMENT_GUIDE.md` 自己的批次时序只执行 CARD 08(批次一,"现在就做")- CARD 07 已在本 repo 完成且卡片内容与新包逐字节相同(no-op),CARD 09 是待命卡,启动条件(3-4个完整 screen→Radar→红队→账本 周期)尚未满足,原样跳过未动。

**Part A - 信用环境熔断**(`src/data/fred/` + `src/screen/credit_regime/`):新增 FRED 客户端(`fredClient.ts`,纯 fetch,无金鑰或请求失败一律降级为 `null`,从不抛出)拉取 `BAMLH0A0HYM2`(ICE BofA 美国高收益债 OAS),`computeCreditRegime.ts` 按修正案十四的字面文本判定三态 + `unknown`:**tight 判定先于 loose**(利差>450bp **或** 两周内发散上行>50bp,OR 是字面的,即使绝对水平很低,只要两周内快速走阔也判 tight,不判 loose - 已在 `ai/decisions.md` 本条与测试里明确disclose这个解读)。`src/screen/pipeline.ts` 在 universe 建好后、profile gate 判定前抓取一次(独立于 `fetchMarketContext()`,每次 run 一次,与 `--profile` 无关),`tight` 时无论 `--profile` 传了什么都强制把 `SMALL_SPEC` 从 `wanted` 集合里删掉(`shouldForceDisableSmallSpec()`,抽成纯函数专门为了能构造 tight 场景做单元测试,不依赖真实 FRED 金鑰),终端与 payload/report 都有明确原因说明。新增 `risk_level`(`normal`/`elevated`/`high`)- 本 repo 之前完全没有这个概念,是全新的极简三档梯:baseline 取自候选自身已有的 `speculative` 标志(`SMALL_SPEC`=elevated, `STANDARD`=normal),credit tight 时统一上调一级 - 全部从已有数据确定性推导,不引入新判断。

**Part B - 最低股价闸**(`config/profiles.json` 新增 `minPrice` 字段,`STANDARD`=$5/`SMALL_SPEC`=$1):`src/screen/pipeline.ts` 的 `evaluateProfileGate()`(现已 export 供测试)与既有市值/成交额闸并列判定,价格缺失(`undefined`)一律判不过闸,不假设通过。

Reason: 第五号修正案原文授权,CARD 08 卡片本身声明"纯防御性,不改变筛选逻辑,不需要运行基线就能判断价值",与 CARD 09(需要 3-4 周基线)明确区分优先级,直接执行没有风险。

Verification:
- 单元测试新增 32 个(157→189 全绿,`npx tsc --noEmit` clean):FRED JSON 解析(真实 FRED API 文档格式,WebSearch 验证而非记忆 - 本环境无 `FRED_API_KEY`,无法用真实调用验证,属于与 CARD 05 的 FMP 字段名同一模式的已披露残余风险)、`computeCreditRegime` 的 loose/neutral/tight(含"仅靠发散上行触发,不看 loose"这个字面 OR 解读的专项用例)、DONE-WHEN 明确要求的"2020年3月历史值人工验证"(WebSearch 确认两个真实锚点:2020年2月中旬约360bp、2020年3月23日收盘约1087bp、"22个交易日从最紧到最松"这个"最快信用冲击"的公开报导 - 用这两个真实锚点之间的线性插值构造测试序列,不是真实逐日FRED数据,但分类结果只取决于窗口内的首尾值,足以回答"2020年3月是否应判 tight"这个 DONE-WHEN 的真实问题)、`shouldForceDisableSmallSpec` 的四种组合(含"CLI 显式指定 small_spec 也照样被强制关闭"这个专项用例)、`evaluateProfileGate` 的股价闸边界(含"价格缺失不假设通过"和"既有市值/成交额闸行为不受影响"回归用例)、payload/report 两端的 credit_regime 渲染(含 tight 态的红色警示条、**unknown 态的低调"不可得"提示** - 见下方运营笔记、risk_level 徽章仅在非 normal 时显示)。
- 真实生产数据全量 run(`npm run screen -- --profile both`,17.4分钟,3177 gate-passed,0 fetch failure):`runMeta.creditRegime` 正确输出 `{label:"unknown", labelUnavailableReason:"FRED OAS series unavailable this run (FRED_API_KEY unset or the request failed)"}`(本环境无 `.env`/无 FRED 金鑰,熔断机制按设计降级,run 未被阻塞 - 与"跑测试验证方向,而非只信任单元测试"的项目一贯做法一致)。用脚本对全部 3177 个 gate-passed 标的做程序化抽查:`regularMarketPrice` 与各自档位 `minPrice` 比对,**0 违规**,实际最低价 $1.055(一只 SMALL_SPEC 标的,贴着 $1 闸线之上)- 股价闸在真实数据上确认生效。ATLAS_PAYLOAD.txt 的 `信用环境 (credit_regime): 不可得 (...)` 行与 3 个候选各自的 `risk_level: normal` 均在真实产出里核实。

Operational note(与 TASK_CARD_07 那次相同的"stale module"坑,再次踩中并记录): 07 那次事故记录之后本以为已经吸取教训,但这次在**已启动的后台 `npm run screen` 长跑进程期间**又编辑了 `renderReport.ts`(补 unknown 态的提示 - 见下一段),导致这次真实 run 产出的 `report.html` 缺了这一行(Node 长跑进程不会热重载,已加载的模块是编辑前的快照)。用 `scripts/preview-report.ts`(已更新,补上 `creditRegime`/`smallSpecForcedDisabled`/`riskLevel` 三个新字段的读取)对同一份 `screen_run.json` 用**编辑后的最终代码**重新渲染,diff 确认除了 unknown 提示这一行(以及一根 sparkline 因 `checkpoint.json` 在 17 分钟长跑期间被增量写入了几分钟更新数据、坐标有肉眼不可见的微小平移外)完全一致,证明代码本身是对的,只是产出文件滞后 - 已用重新渲染的版本覆盖了 `output/runs/2026-08-31/report.html` 与 `output/latest.html`。教训:长跑期间不要再编辑同一批被导入的模块;下次同类改动应等 run 完全结束再动代码,或改完之后一律用 preview-report.ts 重新渲染一次再核实,不要假设"run 已经在跑所以这次编辑不算数"。

Tradeoff: `renderCreditWarning()` 的字面卡片文本只提到"tight 时报告需标注"(DONE-WHEN 原文),但熔断段落另有一句"报告需标注信用数据不可得" - 这句话没有限定只在 tight 时生效,本环境又恰好每次 run 都是 unknown 态,所以补了一个独立的、非警示性质(灰字斜体,不是红色条)的 `.credit-unknown-note`,与 tight 的红色 `.credit-warning-bar` 区分严重程度,避免"每次 run 都亮红灯"这种狼来了效应。FRED 响应体 JSON 结构(`{observations:[{date,value}]}`,value 为字符串、"."表示缺失)是 WebSearch 验证的官方文档格式,不是真实 API 调用验证 - 未来一旦配置了真实 `FRED_API_KEY`,第一次 run 应比对实际返回值形状与这里的解析逻辑是否一致。

Future implications: 若未来想让某个用户在本地测试 tight 态的真实渲染效果(而不只是单元测试),现在 `computeCreditRegime`/`shouldForceDisableSmallSpec` 都是纯函数,可以直接手工构造观测序列调用,不需要真的等信用市场收紧。`config/credit.json` 的四个阈值(350/450/50bp/10个交易日)全部来自修正案十四原文数字,未做任何本地调整。

Correction (commit message accuracy, caught while reviewing `git log` after committing): 上面 Part A/B 实现本身的 commit(`e7a2846`)message 末尾写了"Also commits: the atlas_bootstrap_final upgrade package..." - 这句不准确,那批 bootstrap 文件(修正案五、CARD 08/09 卡片、方法论/部署指南)实际是**前一个** commit(`b558971`)提交的,`e7a2846` 的 diff 里不含任何 `constitution/`/`cards/`/根目录文档改动(`git show --stat e7a2846 | grep` 确认零匹配)。代码本身没有问题,纯粹是 commit message 最后一句写错了归属 - 按本项目"宁可新开一条记录,不修改历史 commit"的既定原则(见 208fdaa 的先例),不 amend,这里补一条更正记录。

## 2026-08-31 - TASK_CARD_09 启动(项目所有者明知基线条件未满足,仍要求现在启动) + Part A DONE

Decision: CARD 09 是待命卡,卡片原文与部署指南都明确要求先跑满 3-4 个完整 screen→Radar→红队→裁决→账本 周期作为基线,本 repo 目前一次真实 Radar/红队闭环都还没跑过(与 Next Priorities #1 是同一个未闭合的缺口)。就此向项目所有者当面确认,对方明确选择"明知条件未满足,仍要求现在启动"而非等待或先跑一次真实闭环 - 记录在案作为项目所有者的知情决定,不是本次会话自行放宽纪律。因此从这里开始的 CARD 09 实现,其信号质量在真正跑够基线周期之前,项目所有者需自行承担"无法判断候选变好还是变坏"这个卡片自己写明的风险。

**Part A - 隐性吸筹复合信号**(`src/screen/indicators/` 三个新纯函数 + `src/data/insiders/` 权重升级)DONE:

1. `rsLineNewHigh`(`rsLineNewHigh.ts`):个股收盘/SPY收盘比值序列创52周新高,且个股自身价格未创新高。`ownPriceAtNewHigh` 由调用方传入(复用 `computeIndicators` 已算出的 `pctOf52WeekHigh`),不在此函数内重新计算价格窗口 - 单一事实来源,且自然继承 `week52()` 对历史不足标的的同一套宽松窗口惯例(不强制要求满 `tradingDays`)。SPY bars 是新增的、独立于 `fetchMarketContext()` 的早期专用抓取(`pipeline.ts` 的 `fetch_spy_rsline` 阶段,在 Phase indicators 之前),`fetchMarketContext()` 后续仍会为市场环境快照再抓一次 SPY - 两次抓取存在**已披露的重复**,为了不动 `fetchMarketContext()` 现有调用点(避免更大范围重构风险)接受的简化,而非疏漏。
2. `volumeDryup`(`volumeDryup.ts`):镜像 `volume.ts` 现有 `maxVolumeRatioLastNDays` 的循环结构,找最小值而非最大值,复用现有 `volumeAvgWindowLong`(50日)而不是新增一个平行 config 键。
3. `aboveVwapStreak`(`aboveVwapStreak.ts`):典型价 (H+L+C)/3 按成交量加权、滚动窗口(默认20日)算出的近似 VWAP,连续 N 日(默认5)收盘价高于**当日**滚动 VWAP。零成交量窗口视为"未站上"(false)而非跳过,因为"站上一个未定义的均价"本身不是能诚实断言的结论。字段命名与报告渲染文字均明确标注"日线近似,非真实分钟级 VWAP"。
4. 内部人加权(`src/data/insiders/insiderWeighting.ts` + `aggregateInsiderClusters.ts` 重写):`form4Parser.ts` 新增对真实 `reportingOwnerRelationship` 块的解析(`isDirector`/`isOfficer`/`isTenPercentOwner`/`officerTitle`)- **live 验证,非记忆**:直接用 `secFetch` 重新抓取本次会话早些时候 CARD 08 验证时已缓存在 `output/checkpoint.json` 里的真实 accessionPath(AEIS 927003 的真实申报),确认了两个此前不知道的真实细节:布尔子标签在不同年代的申报里不一致地写成 `"1"/"0"` 或 `"true"/"false"`(两种都做了解析兼容),以及 `officerTitle` 是自由文本(真实样本含 "Co-Chief Executive Officer"、"Executive Vice President & CFO"),不是枚举值。职位权重按卡片字面三档(CEO/CFO/COO=2.0,其他高管=1.5,董事=1.0),标题匹配用大小写不敏感的子串正则,已用真实抓取的样本验证"Co-CEO"/"& CFO" 两种真实写法都能命中正确档位。金额显著性(单笔≥$100k ×1.5)判定用同一份申报里**金额最大**的一笔 P 交易(该简化解析器不把交易归属到具体某个申报人,联合申报里的多个申报人共享同一份交易列表,是已披露的解读选择,不是解析缺陷)。集群判定改为"每个不同买方的最高权重求和 ≥ `clusterMinWeightedScore`(默认2.0,与旧版"2人头"默认值刻意保持同一量级,便于历史可比)",同一人多次出现取其**最高**权重而非求和(避免小额反复交易刷分)。
5. 应用到 strengthScore:新增共享辅助函数 `latentAccumulationBonus.ts`(避免 4 个探测器各自重复实现导致的漂移风险 - 这正是本 repo 此前 conditions/triggered 双表达式那次教训的直接应用),每个命中的旗标加 `config/card09.json` 里的 `strengthBonusPerFlag`(默认5分,封顶100)。`rs_line_new_high` 用于 A(动能突破)+B(波动挤压);`volume_dryup` 仅用于 B;`above_vwap_streak` 全4桶通用。**只改 `strengthScore`,`triggered` 判定表达式一个字符未动**(4 个探测器文件逐一 grep 确认)。

Verification: 33 个新测试(211→219 之前那批已含 rsLineNewHigh/volumeDryup/aboveVwapStreak/insiderWeighting/Form4关系解析/bonus辅助函数的全部单测,加上本条新增的 Detector D bonus 集成测试与 HTML 渲染测试),`npx tsc --noEmit` clean。DONE-WHEN 明确要求的"RS线新高逻辑正确:构造测试数据验证'大盘跌个股平'能触发" - 有专项测试字面复现这个场景(SPY 连续下跌、个股走平,断言结果为 true)。

Tradeoff: `insiderRoleWeight()` 对既非 officer 也非 director 的申报人(纯10%大股东或 isOther)落回 `directorWeight`(卡片三档里最低的一档),而不是新发明一个第4档 - 卡片原文没提这种情况,选最保守/最不臆造的处理。`officerTitle` 未做 HTML 实体解码(如 `&amp;`)- 只在子串匹配里用到,不影响 CEO/CFO/COO 判定的正确性,故未处理。

Future implications: `insiderClusterWeightedScore` 是新字段,已进入 payload(全旗标转储自动带出)与 HTML 报告(候选详情卡的"隐性吸筹复合信号"行)。Part B(期权情报)与 Part C(质量与稀释旗标)按卡片"各Part相互独立"的许可,作为后续独立 commit 分别交付。
