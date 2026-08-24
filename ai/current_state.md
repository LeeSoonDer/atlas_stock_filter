# Current State

## Completed
- Template initialized; governance, constitution, and cards merged into repo.
- ai/project_overview.md initialized from Atlas idea + constitution cross-check.
- constitution/ (5 files) read in full and treated as frozen law.
- TASK_CARD_01 - Layer 1 skeleton. DONE, independently verified, pushed to
  origin/master.
- TASK_CARD_02 - three technical detector buckets + indicator library. DONE,
  independently verified. Local commits, not yet pushed.
- TASK_CARD_03 - fundamental flags + sector strength + market regime. DONE,
  independently verified. Local commits, not yet pushed.
- TASK_CARD_04 - fourth detector bucket (Institutional Accumulation Proxy):
  Form 4 insider clusters, institutional-ownership trend, short interest,
  Detector D. DONE, independently verified. Local commits, not yet pushed.
- TASK_CARD_03_PATCH - sector capital footprint aggregation (Part A) +
  event window flag (Part B). DONE except DONE-WHEN item 5 (deferred to
  CARD 05 - see below). 3 commits, all local, not yet pushed.
  - src/screen/sector_footprint: 4 hit-density metrics per SPDR sector
    (institutional_accumulation_proxy rate, insider_cluster rate,
    significant-short-interest-decline rate, volatility_compression_setup
    rate), anomaly = density >= 2x cross-sector median AND count >= 3
    (both config-driven, config/sector.json - a new file per the card's
    explicit naming). A sector below 5 valid symbols is skipped, never
    force-aggregated. Output is facts-only (numbers/booleans/dimension
    names) by construction - no generated text exists to leak direction.
  - src/screen/event_window: extends CARD 03's earningsSoon into a full
    event_window list within a 180-day window (config/card03.json's new
    eventWindow.windowDays - the outer bound of all 3 legal holding
    periods). Only 'earnings' is populated - lockup_expiry has no free
    data source (verified, not guessed) and shareholder_meeting/
    product_launch need Finnhub (no key configured); both explicitly
    permitted to be skipped by the card's own "尽力而为,不可得则跳过".
  - Live full-run validation (cached from CARD 04's backfill, 34s):
    Financial Services flagged footprint_anomaly on volatilityCompression
    (density 0.232 vs median 0.066, 129 hits) - hand-verified correct.
    672 candidates got a populated eventWindow; spot-checked AAON's entry
    against independently recomputed daysUntil arithmetic - exact match.
    Grepped full output for directional/predictive Chinese phrases -
    zero matches.
  - DONE-WHEN item 5 ("板块异动与事件旗标均进入HTML报告...与PAYLOAD") is now
    satisfied by TASK_CARD_05's HTML report + PAYLOAD generator (below) -
    both consume sectorFootprints/eventWindow directly from pipeline output.
- TASK_CARD_05 - selector + watchlist + dual payload generation + HTML
  report + ledger wiring ("Layer 1 全功能可用"). DONE, 7 commits, all
  local, not yet pushed. Independent verification dispatched, not yet
  returned as of this write.
  - src/screen/indicators/pivotPoints.ts: K=2 (5-bar fractal) pivot
    high/low, needed for PAYLOAD's key-level section.
  - src/screen/select/: selectCandidates (promotion-priority pass over
    previous run's watchlist, then round-robin A->B->C->D across the 4
    buckets), selectWatchlist (compression_unselected priority, then
    near-miss fill via nearMiss.ts's 10%-grace-band reimplementation of
    each detector's real conditions - see ai/decisions.md).
  - src/ledger/: rewritten schema - ScreeningLedgerEntry (immutable) +
    separate append-only OutcomeUpdateLedgerEntry, joined at read time.
    Never mutates/deletes a written line (constitution Amendment No.2).
    cli-backfill.ts (interactive + flag-driven), cli-stats.ts, new
    package.json scripts `ledger:backfill` / `ledger:stats`.
  - src/report/payload/: generateAtlasPayload (full evidence-bearing
    Radar handoff text) + generateDissentPayload (red-team payload,
    isolation enforced at the TYPE level - DissentInputCandidate can only
    hold symbol+primaryBucket, not flags/evidence/scores).
  - src/data/enrich/: FMP dual-source P/E, P/B, PEG + price-mismatch
    check. Degrades to universal 不可得 when FMP_API_KEY unset (verified
    live - no key configured in this environment). Field names verified
    via WebSearch, not a live call (no key available) - flagged as a
    residual-risk exception to this project's usual live-verification
    pattern.
  - src/report/html/: self-contained single-file HTML report (inline
    SVG sparklines, flat GitHub-primer-like palette, dark/light via
    prefers-color-scheme, zero external resources, zero gradients).
  - src/screen/pipeline.ts wired end-to-end: reads previous watchlist
    from ledger before writing, runs selection, FMP-enriches the <=15
    candidate+watchlist pool, generates+writes all 3 artifact files,
    appends ledger entries for every candidate/watchlist symbol,
    surfaces ledger's passive pending-backfill/invalidated lists into
    the HTML report.
  - Live-validated twice, back-to-back, on real production data
    (npm run screen -- --profile both, ~33s each): run 1 produced 5
    candidates + 10 watchlist entries, all 3 artifacts generated and
    structurally verified (DISSENT payload grep-checked for zero
    flag/evidence leakage), 15 ledger entries. Run 2 (same cached data)
    exercised the promotion state machine - confirmed exactly the top-5
    highest-scoring run-1 watchlist symbols were promoted, sorted
    descending by score; ledger grew to 30 entries; ledger:stats
    reported correct real counts; observed (expected, not a bug) that
    run-1's non-compression, non-near-miss-eligible candidates that lost
    their seat to a promotion dropped out of selection entirely (see
    ai/decisions.md).
  - Two DONE-WHEN items substituted/disclosed, not personally verified:
    PAYLOAD -> Atlas Radar ingestion (no access to that external tool)
    and HTML report's browser rendering (no browser environment here) -
    see ai/decisions.md for the substitution method used instead.
  - .gitignore extended for new *.txt/*.html artifact types; output/
    ledger.jsonl deliberately left OUT of .gitignore and committed with
    its real 30 accumulated entries (constitutionally required permanent
    record, unlike every other regenerable output/ file).

- TASK_CARD_05 independent verification: returned CONFIRMED on every
  internally-checkable DONE-WHEN item and MUST-NOT constraint, via its
  own from-scratch re-derivation (its own 2 additional live pipeline
  runs, its own greps of the DISSENT payloads, its own tsc/test runs,
  its own ledger append-only trace). The verifier's 2 extra live runs
  added 30 more genuine ledger entries (60 total); confirmed via git
  diff as a pure append and committed (035009d).
- TASK_CARD_06 - "打磨与验收周" (v1 wrap-up card). IN PROGRESS.
  - SCOPE 2 (运行日志完善) DONE, committed (0aaf581): runScreen now
    marks 16 named phase boundaries and rolls them into a 4-category
    timing breakdown (宇宙/抓取/检测/报告) plus a per-symbol failure
    attribution map (quote/enrichment/fundamentals phases only -
    insider filing failures are accession-path-keyed, not symbol-
    keyed, so deliberately excluded rather than force-mapped). Surfaced
    both as a console.error summary line and as new
    runMeta.timingBreakdown / runMeta.failureAttribution fields.
  - SCOPE 3 (金丝雀 payload 冻结) DONE, committed (6ebf709): the first
    real-market-data ATLAS PAYLOAD + DISSENT PAYLOAD (run
    2026-08-24T14:07:43.049Z) copied into canary/ as
    atlas_payload_baseline.txt / atlas_dissent_payload_baseline.txt,
    with canary/README.md explicitly documenting these as a structural
    drift baseline (契约等价/方向等价 per the constitution's S2 canary
    mechanism), NOT a record of a completed Radar/Red-Team review -
    that review still hasn't happened (see SCOPE 1 below).
  - SCOPE 4 (README.md) DONE, committed (8b06008): appended an
    operational "运行手册" section to README.md (installation, full
    command table incl. every output artifact file, config/*.json
    reference cross-checked against actual file contents, troubleshooting
    covering every failure mode this project has actually hit/documented).
    Kept distinct from SETUP.md (one-time bootstrap doc) rather than
    merging them.
  - SCOPE 1 (真实周期问题清单) explicitly accepted as empty by the
    project owner's direction, not fabricated or found - see
    ai/decisions.md 2026-08-24 entry. No real screen -> Atlas Radar ->
    Atlas Red Team cycle has happened yet (no sop/SOP_WEEKLY.md exists);
    asked the project owner directly rather than guessing, they chose
    to accept SCOPE 1 as empty and proceed.
  - SCOPE 5 (git tag v1.0-layer1 + push) PENDING - project owner
    authorized ("tag and push once ready") but this is gated on
    DONE-WHEN item 2 (fresh clone runs through from scratch) actually
    closing out - see In Progress below.

## In Progress
- DONE-WHEN item 2 ("新机器按 README 可从零跑通,用 fresh clone 验证"):
  the fast/structural half is done and real (not simulated) - a genuine
  `git clone` of the local repo into a scratch dir, `npm install`,
  `npx tsc --noEmit`, and `npm test` all ran clean with zero manual
  fixups (126/126 tests), proving the repo is fully self-sufficient
  from a clean checkout. The expensive half - a full `npm run screen`
  cold-start (whole-universe quote/OHLCV fetch + 90-day EDGAR Form 4
  backfill, ~2.5-3 hours against live external APIs) - is running RIGHT
  NOW in that same fresh-clone scratch directory
  (C:\Users\SD\AppData\Local\Temp\claude\c--Users-SD-Desktop\
  f84e2121-ead0-4c9f-941f-be94a160b657\scratchpad\atlas_fresh_clone\
  screen_run_fresh_clone.log), launched via `nohup ... &` so it survives
  independently of any single tool-call's lifecycle. A separate
  polling watcher (grep-until-terminal-line loop) is tracking it for
  completion notification. Once it finishes (success or failure), the
  next steps are: verify its actual output, then (per project owner's
  standing authorization) `git tag v1.0-layer1` and push both the
  branch and tag to origin, closing out SCOPE 5 and this whole card.

## Next Priorities
1. Once the fresh-clone cold-start run completes: inspect its actual
   result (all 3 artifacts generated, ledger appended, no fatal error),
   then git tag v1.0-layer1 and push to origin/master (already
   authorized by the project owner - see above, no need to re-ask).
2. After that push: do the TASK_CARD_06 Memory Update Obligation write
   (this file + ai/decisions.md) marking the card fully DONE, and give
   the project owner the final DONE-WHEN report.
3. User should still, at their own convenience, open a generated
   atlas_report_*.html in a real browser and paste an atlas_payload_*.txt
   into Atlas Radar at least once - these 2 verification gaps (from
   TASK_CARD_05) remain open; per the SCOPE 1 decision above, any
   friction that surfaces from finally doing this should be logged as
   a normal decisions.md entry / follow-up fix rather than reopening
   CARD 06.
4. Undecided: full per-symbol OHLCV bars still live only in
   output/checkpoint.json (now includes insider/institutional data too,
   very large), gitignored - a future card should decide their permanent
   storage/access pattern.
5. If the user ever wants FMP's PEG/P-E/P-B cross-check live, set
   FMP_API_KEY in .env (see .env.example) - no code change needed, but
   the first live run's response shape should be spot-checked against
   the WebSearch-verified (not live-verified) field names in
   src/data/enrich/computeFmpEnrichment.ts.
6. Post-v1 roadmap (all optional, none required for v1): CARD 04b
   (EDGAR 13F incremental parsing), CARD 07 (Next.js dashboard), CARD 08
   (MCP thin proxy) - see cards/TASK_CARD_06_AND_ROADMAP.md for each
   one's stated trigger condition. None should be started without the
   project owner explicitly requesting that specific card.

## Blockers
- None (the fresh-clone cold-start run is in-progress background work,
  not a blocker on anything else).

## Temporary Notes
- output/checkpoint.json is large and gitignored - a reusable local
  cache across ALL cards' data. Deleting it forces a full network
  refetch, INCLUDING the ~2.5-3 hour EDGAR Form-4 backfill - warn the
  user before ever suggesting this.
- Keep this file current after meaningful work.
