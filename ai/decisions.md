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
