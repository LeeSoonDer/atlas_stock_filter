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
  Form 4 insider clusters (SEC EDGAR), institutional-ownership trend,
  short interest (FINRA), Detector D. DONE. 6 commits + this memory-update
  commit, all local, not yet pushed.
  - src/data/insiders: SEC EDGAR daily-index scan + Form 4 fetch/parse.
    Requires an email-format User-Agent (SEC_EDGAR_USER_AGENT env var,
    documented placeholder fallback) - verified live that a descriptive
    string or URL alone gets 403. Rate-limited to 8 req/s (under SEC's
    10 req/s cap) via a single serialized inter-request delay.
  - src/data/short: FINRA short interest via a free CSV file (NOT the
    'consolidated' API, which requires a token/is not free) - see
    ai/decisions.md. Settlement date discovered by walking backward day
    by day (FINRA's exact schedule isn't programmatically discoverable).
  - src/screen/institutions: institutional-ownership trend, persisted
    cross-run in checkpoint.institutionalHistory. Universally 不可得 on
    this repo's first-ever run (no prior snapshot exists yet) - expected,
    disclosed, not a bug.
  - src/screen/detectors/institutionalAccumulation.ts: Detector D, needs
    >=2 of {insiderCluster, institutionalTrend==='up', short-interest
    decline-or-squeeze, OBV slope positive}.
  - FULL LIVE VALIDATION (90-day lookback, both profiles, cold start):
    31,963 relevant Form-4 filings found, 31,954 parsed (9 were
    duplicate accession paths across scanned days - benign, explained,
    not data loss), 0 failures, 0 rate-limit bans. Took 161 minutes
    end-to-end (includes a one-time floatShares cache-migration
    backfill for all 3352 symbols from earlier cards). detectorSummary:
    momentum_breakout=27, volatility_compression_setup=316,
    oversold_reversal=25, institutional_accumulation_proxy=512 - all 4
    buckets (the full v1 detector set) non-zero. 200 real insider
    clusters found project-wide (171 within the gate-passed universe).
  - Independently re-verified 3 real insider-cluster filings (GWRS/Cohn
    Andrew M., ABCL/Montalbano John S., ACDC's 3-owner Wilks filing) by
    re-fetching directly from SEC, bypassing the pipeline entirely -
    exact match on owner name(s) and transaction code/shares/price each
    time. Substitutes for DONE-WHEN's "对EDGAR网页人工核对" (no browser
    access in this environment), disclosed as such.
  - Subsequent runs are cheap: insiderFilingResults/insiderDailyIndexCache
    accumulate forever (SEC data is immutable once published) - only new
    days/filings get fetched going forward.

## In Progress
- Nothing active. Awaiting user direction on TASK_CARD_05 (explicitly not
  started per the established stop-after-each-card convention).

## Next Priorities
1. User to review TASK_CARD_04 results and decide whether to proceed to
   TASK_CARD_05.
2. git push CARD_02/03/04's commits once the user confirms (only CARD 01
   is on origin/master as of this writing).
3. TASK_CARD_03_PATCH now unblocked (CARD_04's institutional-bucket data
   exists) - could be attempted whenever the user wants it, since its
   only stated prerequisite (CARD 03 + CARD 04 both DONE) is now met.
4. Undecided: full per-symbol OHLCV bars still live only in
   output/checkpoint.json (now includes insider/institutional data too,
   244MB+ and growing), gitignored - a future card should decide their
   permanent storage/access pattern.

## Blockers
- None. (TASK_CARD_03_PATCH's blocker is resolved as of this card.)

## Temporary Notes
- output/checkpoint.json is large (244MB+) and gitignored - a reusable
  local cache across ALL cards' data (quotes/enrichment/fundamentals/
  insider filings/institutional history), not a deliverable. Deleting it
  is safe but forces a full network refetch, INCLUDING the ~2.5-3 hour
  EDGAR Form-4 backfill - warn the user before ever suggesting this.
- Lesson learned this card: piping a long-running background command
  through `| tail -N` hides ALL output until the process exits (tail
  buffers to EOF, it does not stream) - looks identical to "stuck."
  Don't do that for progress-observable background runs; let output go
  directly to the captured file and Read it incrementally instead.
- Keep this file current after meaningful work.
