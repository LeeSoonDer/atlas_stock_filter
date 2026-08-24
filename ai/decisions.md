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
