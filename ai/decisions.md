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
