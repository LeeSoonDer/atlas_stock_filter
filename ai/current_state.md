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

- Report HTML rebuilt as a five-layer information architecture ("信息分层版
  v2", per claude_code_design_draft.md, a project-owner-supplied spec
  superseding TASK_CARD_07 Part C's single-density look). DONE, committed
  (2de1cc2) - this work existed uncommitted in the working tree when this
  session started (from an earlier session); verified clean (npx tsc
  --noEmit + 157/157 tests passing) before committing, no scope changes
  made to it. Five numbered strata (01值得研究/02候选明细/03观察哨/04证据层/
  05流程与账本) replace the prior uniform stack. Two new deterministic
  derived fields support it: footprintDetail (per-condition detector
  comparisons, previously computed but discarded - src/screen/detectors/
  IDetector.ts's new conditions field) and footprintStrength (hit-ratio,
  config-driven bands in card05.json's new footprintStrengthBands key -
  src/report/footprint/footprintStrength.ts). Candidate display order now
  sorts by footprintStrength.ratio (selection logic itself untouched).
  scripts/preview-report.ts added: re-renders report.html from a saved
  screen_run.json + checkpoint.json with zero network calls, for fast
  presentation-layer-only iteration.
- atlas_bootstrap_final upgrade package merged into the repo: constitution/
  ATLAS_AMENDMENT_NO5_SIGNAL_REFINEMENT.md, cards/TASK_CARD_08.md,
  cards/TASK_CARD_09_STANDBY.md, ATLAS_METHODOLOGY.md,
  UPGRADE_DEPLOYMENT_GUIDE.md added (committed b558971). Every other file
  in the package (constitution/ATLAS_v1_0.md, Amendments 2-4, Memos 3-4,
  cards 01-07, MOCKUP_intel_briefing_v4.html) was byte-identical to what
  was already in this repo - confirmed no-op, not restaged.
- TASK_CARD_08 - "防御闸" (credit-regime circuit breaker + minimum price
  gate), constitution Amendment No.5 修正案十四/十七. DONE. The upgrade
  guide's own batch schedule (UPGRADE_DEPLOYMENT_GUIDE.md) puts this card
  first ("批次一 - 现在就做") and TASK_CARD_09 last (needs a 3-4 cycle
  baseline first, not yet accumulated - see Next Priorities) - only CARD
  08 was executed this round.
  - Part A (src/data/fred/ + src/screen/credit_regime/): new FRED client
    fetching BAMLH0A0HYM2 (ICE BofA US HY OAS), degrades to null on any
    failure/missing key (never throws/blocks). computeCreditRegime()
    classifies loose/neutral/tight/unknown per the amendment's literal
    thresholds (350bp/450bp/50bp-divergent-widening/10-trading-day
    lookback, config/credit.json) - tight is checked before loose since
    the amendment's OR condition treats rapid widening as tight
    regardless of absolute level (disclosed interpretation, tested).
    pipeline.ts fetches this once per run (independent of --profile,
    before the profile gate) and force-disables SMALL_SPEC when tight
    regardless of what --profile requested (shouldForceDisableSmallSpec(),
    extracted as a pure function specifically so the DONE-WHEN's
    "hand-construct a tight state test" requirement didn't depend on a
    real FRED key). New risk_level ladder (normal/elevated/high) - no
    such concept existed before this card - baseline from a candidate's
    existing speculative flag, bumped one level when credit is tight.
  - Part B (config/profiles.json's new minPrice field, STANDARD=$5/
    SMALL_SPEC=$1): folded into pipeline.ts's existing evaluateProfileGate
    (now exported for testability) alongside the pre-existing market-cap/
    dollar-volume gate. Missing price data excludes rather than assumes
    pass.
  - 32 new unit tests (157->189, all green, tsc clean), including the
    DONE-WHEN's explicit "2020年3月历史值人工验证" case - built from two
    WebSearch-verified real anchor values (~360bp mid-Feb 2020, ~1087bp
    on 2020-03-23) rather than from memory, since no FRED_API_KEY is
    configured in this environment to verify live.
  - Live-validated on real production data (npm run screen -- --profile
    both, 17.4min, 3177 gate-passed, 0 fetch failures): creditRegime
    correctly came back {label:"unknown", labelUnavailableReason:"..."}
    (no FRED_API_KEY configured here - circuit breaker degraded cleanly,
    run was not blocked). Programmatic spot-check of all 3177 gate-passed
    symbols' regularMarketPrice against their profile's minPrice found
    zero violations (lowest passing price: $1.055, a SMALL_SPEC symbol
    just above its $1 floor).
  - Operational note (same "stale module" class of issue as TASK_CARD_07's
    validation run): edited renderReport.ts (added an unknown-state
    "信用数据不可得" note - the circuit-breaker rule requires the report,
    not just the payload, to flag unavailable credit data) WHILE the
    validation run's Node process was already running - the already-
    loaded module didn't pick up the edit, so that run's report.html was
    missing the note. Caught by grepping the real output; fixed by
    re-rendering via scripts/preview-report.ts (updated to also read the
    new creditRegime/smallSpecForcedDisabled/riskLevel fields) against the
    same real screen_run.json with the final code, diffed against the
    stale version (identical except the missing note + one sparkline's
    sub-pixel coordinate shift from checkpoint.json being incrementally
    written during the 17-minute run), then used to overwrite
    output/runs/2026-08-31/report.html and output/latest.html. See
    ai/decisions.md for the full note - don't edit a module a long-running
    `npm run screen` process has already imported; either wait for it to
    finish or re-render via preview-report.ts afterward.

- TASK_CARD_09 (隐性吸筹复合信号 + 期权情报 + 质量与稀释旗标), constitution
  Amendment No.5 修正案十五/十六/十七. DONE. This is a standby card whose
  own text requires 3-4 full production cycles as a baseline before
  starting (not accumulated - same gap as Next Priority item 1). The
  project owner was explicitly told this precondition was unmet and
  chose, knowingly, to start anyway - recorded as the project owner's
  informed decision, not a session-initiated relaxation of the card's
  discipline (see ai/decisions.md's 2026-08-31 entry).
  - Part A (src/screen/indicators/ new pure functions + src/data/insiders/
    weighting rewrite): rsLineNewHigh, volumeDryup, aboveVwapStreak (all
    strength-bonus-only, never a bucket admission condition - `triggered`
    expressions in all 4 detectors verified unchanged via grep), and
    insiderCluster upgraded from headcount to a role x amount weighted
    score (form4Parser.ts now extracts real reportingOwnerRelationship
    fields, live-verified against real SEC filings including both
    legacy "1"/"0" and current "true"/"false" boolean formats). rsLineNewHigh
    needs SPY bars, fetched once early via a new fetch_spy_rsline phase.
  - Part B (new src/data/options/ module): options intelligence
    (volume/OI ratio anomaly, near-month OTM call OI, put/call ratio,
    ATM implied vol with a run-to-run delta) for the candidate+watchlist
    pool only (<=15, same pool as FMP), fetched strictly after selection
    is finalized so there is no code path back into bucket judgment -
    grep-confirmed zero references in any detector/selection file.
    Isolated, disclaimer-labeled rendering in both payload and report;
    MUST-NOT grep tests confirm no whale/insider-tip-class wording ever
    appears, run against both test output and the source files themselves.
  - Part C (src/screen/fundamentals/ extension): accrualQualityFlag (all
    profiles) and cashRunwayFlag (SMALL_SPEC only - the field is
    `undefined`, not 不可得, on STANDARD symbols by design). Two new
    fundamentalsTimeSeries fetches (cash-flow, balance-sheet modules).
  - Live-validated on real production data across 3 runs; found and
    fixed 2 real bugs neither unit tests nor typecheck caught:
    (1) runFundamentalsPhase's checkpoint cache treated pre-Part-C
    cached entries as "done", so the new fields never actually computed
    on real data - fixed with the same migration pattern already used
    for enrichResults' floatShares backfill (treat a cache entry as
    stale when it's missing a field the new code always sets).
    (2) Yahoo's free options endpoint returns an implausible placeholder
    impliedVolatility (~0.00001) for most contracts (verified by
    directly querying real AAPL/SPY/APGE chains outside the pipeline) -
    added a 1% plausibility floor in fetchOptionsChain.ts, since real
    equity/ETF IV is never that low; openInterest:0 alongside real
    volume was NOT touched (a genuine EOD-lag characteristic, already
    handled correctly by the existing "skip zero-OI contracts" logic).
  - 76 new tests across all 3 parts + the 2 fixes, npx tsc --noEmit
    clean throughout. Every DONE-WHEN item and MUST-NOT constraint
    checked against real generated artifacts (not just test assertions)
    from the third, clean live run (output/runs/2026-08-31_0905/).

- TASK_CARD_10 (活跃度地板 + 板块传导桶 + 席位再分配), constitution Amendment
  No.6 (修正案二十至二十三). DONE, priority=high per the card's own framing
  (fixes the structural defect exposed by the system's first real run: every
  candidate had RVOL < 1, all dead-water stocks). Single commit (b327161,
  project owner explicitly chose one combined commit over per-Part commits
  after being told Part A/B share one pipeline.ts loop by design).
  - Part A (src/screen/vitality/): hard liquidity gate after detector
    evaluation, before selection - rvol_median_10d >= 0.8 AND
    rvol_active_days_20d >= 3, both required. Failing symbols excluded from
    candidates/watchlist only (still counted in sector footprints/flow).
  - Part B (src/screen/detectors/contagion/, the 5th bucket): NOT an
    IDetector (needs cross-symbol sector-leader context a single-symbol
    interface can't supply) - separate pure-function module
    (computeSectorLeaders stage 1, evaluateContagionCandidate stage 2/3),
    merged into buckets/bucketScores/detectorResultsBySymbol manually in
    pipeline.ts. Beta-vs-SPY degrades to historicalVol-vs-sector-median per
    the card's own 熔断 clause. high_beta_satellite is warning-only, never
    excludes (筛选宽容度原则).
  - Part C (src/screen/select/): sector_contagion reserves
    ceil(maxCandidates/2) seats ahead of the original 4-bucket round robin -
    implements Amendment 修正案二十二's literal "at least half" against the
    CURRENT maxCandidates (3, since TASK_CARD_07 already lowered it from 5),
    not the card's own stale "2-3 of 5" text - see ai/decisions.md's
    2026-09-03 entry for the full reconciliation. Watchlist gives
    contagion_unselected top priority.
  - Part D (src/report/): contagion candidates get a dedicated leader/lag
    line + red (not amber) high_beta_satellite badge, visually distinct
    bucket color dot; payload carries all 5 contagion fields + a new
    vitality/event-driven-sectors overview section.
  - Live-validated on real production data (2026-09-03, 3175 gate-passed):
    APGE (the card's own named example, RVOL 0.30) confirmed excluded from
    candidates/watchlist; 2095/3175 (66%) excluded by the floor overall
    (high but explainable - see decisions.md); 5 real event-driven sectors
    detected; 2/3 candidate seats went to sector_contagion (BTCS/CEPO) with
    correct leader/lag-gap figures, BTCS correctly flagged+kept as
    high_beta_satellite; all 8 watchlist seats filled by contagion runners-
    up; zero forbidden wording and DISSENT isolation intact in the real
    generated artifacts (not just test assertions). 51 new tests (249->300,
    all green), tsc clean.
  - Found but explicitly NOT touched (outside this card's Amendment No.6
    authorization, left uncommitted in the working tree): TASK_CARD_08.md's
    new "Part C 市场宽度", TASK_CARD_09_STANDBY.md's new Part A items 5-7
    (both governed by Amendment No.5's 修正案十八/十九), Amendment No.5's own
    new clauses, EXECUTION_RULES.md (a human position-sizing SOP, not
    application code), UPGRADE_DEPLOYMENT_GUIDE.md's update - all synced
    into the repo alongside TASK_CARD_10/Amendment No.6 in an earlier turn
    but out of scope for this card.

## In Progress
- Nothing active. Awaiting the project owner's next instruction.

## Next Priorities
0. If the project owner wants any of the "found but not touched" items
   above acted on (TASK_CARD_08 Part C market breadth, TASK_CARD_09_STANDBY
   Part A items 5-7, Amendment No.5's own new clauses), they need their own
   explicit go-ahead - none are part of TASK_CARD_10's authorization.
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
6. If the user ever wants the credit-regime circuit breaker (TASK_CARD_08
   Part A) actually live rather than perpetually "unknown", set
   FRED_API_KEY in .env (see .env.example, free key at fred.stlouisfed.org)
   - no code change needed, but the first live run's response shape
   should be spot-checked against the WebSearch-verified (not
   live-verified) parsing in src/data/fred/fredClient.ts.
7. TASK_CARD_09 is now DONE (see above) - started on the project owner's
   explicit, informed override of its own baseline precondition. That
   precondition (3-4 full production cycles as a baseline before judging
   whether the new signals help or hurt candidate quality) is still
   genuinely unmet - the signals are live and correct, but nobody should
   claim they're "working well" or "not working" yet without that
   baseline. Once a real Radar/红队 cycle history exists (same gap as
   Next Priority item 1), it becomes possible to actually judge Part A/C's
   signal quality retroactively.
7b. Reusable lesson from TASK_CARD_09's live validation, for any future
   card that adds a new required field to an existing checkpoint.json
   cache table (fundamentalsResults, enrichResults, institutionalHistory,
   optionsHistory, etc.): the "is this symbol already done" check MUST
   test for the new field's presence, not just whether the symbol key
   exists - otherwise pre-existing cache entries silently skip the new
   computation forever. See runEnrichmentPhase's floatShares backfill and
   runFundamentalsPhase's accrualFlagAvailability backfill for the
   pattern to copy. Also: Yahoo's free options endpoint's impliedVolatility
   field is unreliable (returns a ~0.00001 placeholder on most contracts)
   - src/data/options/fetchOptionsChain.ts's IMPLAUSIBLE_IV_FLOOR handles
   this; don't remove it without re-verifying live.
8. Post-v1 roadmap (all optional, none required, none should be
   started without the project owner explicitly requesting that
   specific card - see cards/TASK_CARD_06_AND_ROADMAP.md; note the
   "CARD 07" AND "CARD 08" slots there are both stale/superseded - the
   real TASK_CARD_07 (theme radar) and TASK_CARD_08 (credit regime +
   price gate, this session) are unrelated cards from
   atlas_bootstrap_final, already done - see above):
   - CARD 04b - EDGAR 13F incremental parsing. Trigger: institutional
     bucket proves its value in the forward ledger AND Form 4 proxy
     proves insufficient.
   - "MCP thin proxy" idea (build_atlas_payload/save_brief/save_dissent
     tools) - the roadmap doc's original CARD 08 slot, renumbering TBD
     if still wanted. Trigger: manual copy-paste friction starts causing
     the user to skip the red-team step.
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
