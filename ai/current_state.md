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
  - DONE-WHEN item 5 ("板块异动与事件旗标均进入HTML报告...与PAYLOAD") NOT
    satisfied: neither the HTML report nor the PAYLOAD generator exist
    yet - both are explicitly CARD 05's scope. Disclosed before starting
    work, not discovered after. sectorFootprints/eventWindow are already
    in the pipeline output for CARD 05 to consume directly once it exists.

## In Progress
- Nothing active. Awaiting user direction (independent verification of
  this patch not yet dispatched as of this write - about to be).

## Next Priorities
1. Dispatch independent verification of TASK_CARD_03_PATCH.
2. User to review results and decide next step: TASK_CARD_05 (which would
   also complete DONE-WHEN item 5's HTML/PAYLOAD integration), or
   something else.
3. git push CARD_02/03/04/03_PATCH's commits once the user confirms (only
   CARD 01 is on origin/master as of this writing).
4. Undecided: full per-symbol OHLCV bars still live only in
   output/checkpoint.json (now includes insider/institutional data too,
   very large), gitignored - a future card should decide their permanent
   storage/access pattern.

## Blockers
- None (TASK_CARD_03_PATCH's DONE-WHEN item 5 is a disclosed deferral,
  not a blocker on the rest of this patch's work).

## Temporary Notes
- output/checkpoint.json is large and gitignored - a reusable local
  cache across ALL cards' data. Deleting it forces a full network
  refetch, INCLUDING the ~2.5-3 hour EDGAR Form-4 backfill - warn the
  user before ever suggesting this.
- Keep this file current after meaningful work.
