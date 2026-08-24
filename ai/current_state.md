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

## In Progress
- Independent verification of TASK_CARD_05 dispatched in the background;
  awaiting its report.

## Next Priorities
1. Review TASK_CARD_05's independent verification report once it returns.
2. User to decide next step: TASK_CARD_06 (if one exists) or something
   else. Do not proceed further without an explicit new instruction.
3. git push CARD_02/03/04/03_PATCH/05's commits once the user confirms
   (only CARD 01 is on origin/master as of this writing).
4. User should open the generated atlas_report_*.html in a real browser
   and paste an atlas_payload_*.txt into Atlas Radar at least once, to
   close the two verification gaps noted above.
5. Undecided: full per-symbol OHLCV bars still live only in
   output/checkpoint.json (now includes insider/institutional data too,
   very large), gitignored - a future card should decide their permanent
   storage/access pattern.
6. If the user ever wants FMP's PEG/P-E/P-B cross-check live, set
   FMP_API_KEY in .env (see .env.example) - no code change needed, but
   the first live run's response shape should be spot-checked against
   the WebSearch-verified (not live-verified) field names in
   src/data/enrich/computeFmpEnrichment.ts.

## Blockers
- None.

## Temporary Notes
- output/checkpoint.json is large and gitignored - a reusable local
  cache across ALL cards' data. Deleting it forces a full network
  refetch, INCLUDING the ~2.5-3 hour EDGAR Form-4 backfill - warn the
  user before ever suggesting this.
- Keep this file current after meaningful work.
