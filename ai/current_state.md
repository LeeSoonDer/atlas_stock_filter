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
  - SCOPE 5 (git tag v1.0-layer1 + push) DONE - see below.
  - DONE-WHEN item 2 ("新机器按 README 可从零跑通,用 fresh clone 验证")
    CONFIRMED for real, in two parts across a mid-run interruption. A
    genuine `git clone` of the local repo into a scratch dir, then
    `npm install` / `npx tsc --noEmit` / `npm test` all ran clean with
    zero manual fixups (126/126 tests) - proves the repo is fully
    self-sufficient from a clean checkout. Then the full
    `npm run screen -- --profile both` cold start was launched in that
    same fresh clone; the user shut down the desktop partway through
    (during the Form-4 filing-parsing phase, at 18,244/31,992 filings,
    0 failures) - the run died with the machine, but its checkpoint had
    saved incrementally throughout, so relaunching the identical
    command picked up from there rather than restarting. It completed
    end to end: `[cli] done in 3995411ms` (~66.6 min for the resumed
    leg), 0 failures on quote/enrichment/fundamentals fetch phases (4
    symbols - FISV/NHIC/LION/NIQ - failed the institutional-snapshot
    phase after retries and were skipped without blocking the run, per-
    symbol isolation working as designed), all 3 report artifacts +15
    ledger entries produced. This is real evidence a fresh clone works
    end to end, including surviving an actual process death and resume
    - not a simulated or partial check.
  - TASK_CARD_06 is now DONE. Tagged `v1.0-layer1` and pushed
    branch+tag to origin/master (GitHub: LeeSoonDer/atlas_stock_filter)
    - this is the first push since TASK_CARD_01 (everything from CARD
    02 through CARD 06 was local-only until now). Independent
    verification returned CONFIRMED on every SCOPE item and DONE-WHEN
    item (its own fresh clone/install/typecheck/test, its own
    hash-for-hash `git ls-remote` check that the push really landed,
    its own spot-checks of every README claim against real repo
    contents). One nitpick fixed: decisions.md's "no sop/SOP_WEEKLY.md"
    wording was corrected to note the file does exist (as an unfilled
    template) - the substantive claim (no real cycle happened) was
    already correct.
- Post-v1, direct request (not a task card) - output/ reorganized into
  per-run-date folders. DONE, 3 commits (2f70f90 code, cd3eee8 docs,
  2ba9ea3 ledger growth). See ai/decisions.md 2026-08-25 entry for full
  reasoning. Every `npm run screen` run now writes to
  `output/runs/{YYYY-MM-DD}/` (same-day re-runs get an `_HHMM` suffix)
  with fixed filenames (ATLAS_PAYLOAD.txt, ATLAS_DISSENT_PAYLOAD.txt,
  report.html, screen_run.json) instead of flat output/ files with a
  timestamp in the name. New output/latest.html always mirrors the
  newest report. ledger.jsonl/checkpoint.json untouched at output/
  root (out of scope - global files, not per-run artifacts).
  `resolveRunFolder` extracted to its own file with a real 4-case unit
  test suite. 4 pre-existing historical runs hand-migrated into
  output/runs/2026-08-24/ (+ _1409/_1418/_1419 for the 3 later
  same-day runs) - gitignored, so this left no git history. README.md,
  canary/README.md, and docs/sop/SOP_WEEKLY.md all updated to the new
  paths in the same change. Live-validated with a real run on a new
  calendar day (2026-08-25): got the bare date folder as expected
  (correct - no prior folder for that date), output/latest.html
  verified byte-identical to that run's report.html via diff. npx tsc
  --noEmit clean, npm test 130/130 (126 prior + 4 new).
- TASK_CARD_07 - "全板块扫描数据供给 + 双层候选 + 情报简报 HTML 报告"
  (constitution/ATLAS_AMENDMENT_NO4_THEME_RADAR.md, Amendments 10-13).
  DONE, 7 commits (one, 208fdaa, is mislabeled - see ai/decisions.md's
  correction entry). NOTE: this real TASK_CARD_07.md is a DIFFERENT card
  from the "CARD 07 - Next.js dashboard" idea named in
  TASK_CARD_06_AND_ROADMAP.md's optional post-v1 roadmap - that
  roadmap slot is effectively superseded/renumbered by this one; the
  Next.js dashboard idea (if still wanted) would need a new card
  number.
  - Part A (src/screen/sector_scan/): computeSectorFlowScan ranks all
    11 SPDR sectors by a NEW weekly-return metric (independent of
    sectorStrength.ts's existing 1mo/3mo composite rank - see
    ai/decisions.md for why these are deliberately two separate
    systems), classifies flow_in/flow_out/flat via a config-driven
    rank-threshold rule (config/card07.json). computeHotSectorDetail
    covers 科技/软件 (direct Technology sector reuse), AI 基建 + 航天/
    太空 (hand-curated ticker baskets, config/hot_sectors.json -
    explicitly disclosed as an unverified approximation per the
    card's own sanctioned "篮子近似" allowance, with real per-ticker
    coverage disclosure, not fabricated precision), plus any real
    sector flagged footprintAnomaly but not already named. Wired into
    generateAtlasPayload with two new sections (全板块资金流谱,
    热门领域详述), zero new network calls (reuses already-fetched
    sector ETF bars + already-cached basket-ticker OHLCV).
  - Part B: config/card05.json's select caps changed from 5/10 to 3/8
    in place (not a new parallel config) - reuses CARD 05's
    selectCandidates/selectWatchlist/promotion logic unchanged, per
    the card's own "沿用 CARD 05 逻辑" instruction.
  - Part C (src/report/html/): full rebuild of styles.ts/renderReport.ts
    per MOCKUP_intel_briefing_v4.html's structure and visual style -
    an explicit project-owner instruction that supersedes both the
    card's own text reference to v3 AND TASK_CARD_05's earlier no-
    gradient/purple fallback design (which only applied absent a
    named reference - see ai/decisions.md). Dark-only "intel
    briefing" theme, deliberate (matches the mockup's own genre-
    appropriate single-theme design, not an oversight). New optional
    `radarNarrative` field on ReportInput gates every prose/judgment
    slot the mockup shows (market recap paragraph, per-sector
    verdict, theme narrative, per-candidate desc/grade/probability/
    confidence, excluded-item reasoning, weekly forecast) - absent on
    every run so far (no Radar pass has happened), so all of these
    render a literal "待研究层填充" placeholder, grep-verified never
    app-synthesized. One sanctioned exception: footprint-anomaly
    sectors render as an explicitly-unconfirmed "潜在主题雏形" seedling
    card (facts only - density/count, no strength/lifecycle guess)
    when Radar hasn't supplied real themes yet, per the card's own
    "首版可先渲染板块异动作为主题雏形" allowance.
  - Live-validated twice on real production data (a stale-module
    timing gotcha on the first run meant its report.html reflected
    pre-Part-C code even though it finished after Part C was
    committed - Node doesn't hot-reload a running process; caught by
    inspecting the raw `<style>` block, fixed by re-running once all
    edits landed - see ai/decisions.md's operational note). The
    corrected re-run (~32s on warm checkpoint) confirmed: 3 candidates
    + 8 watchlist + 3 promoted (two-tier caps), sector flow scan with
    all 11 sectors correctly rank/flow-classified (hand-verified the
    rank-threshold logic against real numbers, e.g. rank 8 Energy at
    -1.07% correctly stayed "flat" rather than "flow_out" since
    rank 8 isn't > 11-3=8), 4 hot-sector entries (AI 基建 10/10 and
    航天/太空 8/8 basket tickers found in this run's universe - full
    coverage, not degraded), real report.html with all 7 new section
    headers present, 15 placeholder occurrences and zero leaked
    hardcoded judgment phrases (grep-verified against the actual
    generated file, not just unit tests), DISSENT payload isolation
    still holds (0 flag-term matches). npx tsc --noEmit clean, npm
    test 152/152 (143 prior + 17 rewritten renderReport tests + fixes
    to pre-existing sector/regime tests for the new oneWeekReturn
    field).
  - Independent verification: returned CONFIRMED on every DONE-WHEN
    item and MUST-NOT constraint via its own from-scratch re-derivation
    (its own live `npm run screen` run, its own reads of the actual
    renderReport.ts logic, its own greps of fresh output for leaked
    judgment phrases, its own tsc/test runs, its own byte-for-byte
    latest.html comparison). It also caught a real, disclosed problem:
    the claimed "9 commits" was wrong (actually 7), and commit 208fdaa
    is mislabeled - its message says "docs: add TASK_CARD_07..." but
    its actual diff bundles in the full Part A/B implementation code
    too (a consequence of the git-add staging mistake already disclosed
    earlier in this session - not a new problem, but the verifier
    correctly caught that the count/description hadn't been corrected
    to match). Fixed: commit count corrected above; see
    ai/decisions.md's correction entry for the full explanation. Not
    amending 208fdaa itself, per this project's "prefer new commit over
    amend" convention - the actual code content was already functionally
    verified as correct.

## In Progress
- Nothing active. Awaiting the project owner's next instruction.

## Next Priorities
1. User should, at their own convenience, open a generated
   output/runs/<date>/report.html (or output/latest.html for the
   newest one) in a real browser and paste an
   output/runs/<date>/ATLAS_PAYLOAD.txt into Atlas Radar at least once
   - these 2 verification gaps (from TASK_CARD_05, never closed by
   CARD_06 since SCOPE 1 was accepted-empty) remain open. Any friction
   that surfaces from finally doing this should be logged as a normal
   decisions.md entry / follow-up fix, not treated as reopening a card.
2. Once a real Radar pass happens, its narrative output needs to be
   threaded into pipeline.ts's renderReport() call as a
   `radarNarrative` object - currently nothing populates this field;
   parsing a real Radar response into that shape is unbuilt future
   work (see ai/decisions.md's TASK_CARD_07 Part C entry).
3. Undecided: full per-symbol OHLCV bars still live only in
   output/checkpoint.json (now includes insider/institutional data too,
   very large), gitignored - a future card should decide their permanent
   storage/access pattern.
4. If the user ever wants FMP's PEG/P-E/P-B cross-check live, set
   FMP_API_KEY in .env (see .env.example) - no code change needed, but
   the first live run's response shape should be spot-checked against
   the WebSearch-verified (not live-verified) field names in
   src/data/enrich/computeFmpEnrichment.ts.
5. If the AI 基建/航天太空 hot-sector baskets in config/hot_sectors.json
   ever show consistently low coverage (many tickers not found in the
   gate-passed universe across repeated runs), revisit the basket
   composition - see ai/decisions.md's disclosure entry.
6. Post-v1 roadmap (all optional, none required, none should be
   started without the project owner explicitly requesting that
   specific card - see cards/TASK_CARD_06_AND_ROADMAP.md; note the
   "CARD 07" slot there is stale/superseded, see above):
   - CARD 04b - EDGAR 13F incremental parsing. Trigger: institutional
     bucket proves its value in the forward ledger AND Form 4 proxy
     proves insufficient.
   - CARD 08 - MCP thin proxy (build_atlas_payload/save_brief/
     save_dissent tools). Trigger: manual copy-paste friction starts
     causing the user to skip the red-team step.
   - Independent parallel line - Cockpit v1.3 反哺 patch (ACH dual-
     hypothesis etc.) - explicitly NOT an Atlas task, separate session/
     task card only.

## Blockers
- None.

## Temporary Notes
- output/checkpoint.json is large and gitignored - a reusable local
  cache across ALL cards' data. Deleting it forces a full network
  refetch, INCLUDING the ~2.5-3 hour EDGAR Form-4 backfill - warn the
  user before ever suggesting this.
- Keep this file current after meaningful work.
