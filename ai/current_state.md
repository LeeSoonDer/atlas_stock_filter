# Current State

## Completed
- Template initialized; governance, constitution, and cards merged into repo.
- ai/project_overview.md initialized from Atlas idea + constitution cross-check.
- constitution/ (5 files) read in full and treated as frozen law.
- TASK_CARD_01 - Layer 1 skeleton (universe definer, data access, pipeline
  shell, ledger placeholder). DONE, independently verified, pushed to
  origin/master.
- TASK_CARD_02 - three pure-technical detector buckets (Momentum Breakout,
  Volatility Compression Setup, Oversold Reversal) + indicator library.
  DONE, independently verified, pushed to origin/master.
- TASK_CARD_03 - fundamental flags (366-symbol "候选" pool) + sector
  strength (full 3352-symbol universe) + market environment snapshot
  (run-level). DONE. 4 commits on master, not yet pushed.
  - src/screen/fundamentals: 4 flags (revenueGrowth/grossMargin/
    profitability/leverage) + earningsSoon/earningsDate, each with its
    own Availability tag. Uses yahoo-finance2's fundamentalsTimeSeries
    (verified live that quoteSummary's incomeStatementHistory* modules
    are broken - grossProfit hardcoded to 0 - the package's own runtime
    warning confirms this). Revenue "同比" read as annual-period YoY, not
    quarterly (quarterly history only spans ~5 sequential quarters,
    not enough for a real same-quarter-last-year comparison).
  - src/screen/sector: 11 SPDR sector ETFs (tickers verified live),
    Yahoo's 11 sector strings (verified against real cached data)
    mapped 1:1. Composite rank = average of 1mo-rank and 3mo-rank
    positions, re-ranked. Top/bottom 3 = tailwind/headwind.
  - src/screen/regime: SPY-vs-SMA200 + SMA200 slope + VIX-vs-its-own-
    avg -> a 3-signal majority-vote label (顺风/中性/逆风), with an
    elevated-VIX override. Descriptive only, does not gate screening.
  - "候选" population for fundamentals = the 366 symbols that triggered
    at least one CARD 02 detector bucket (no formal Top-5 selection
    exists yet - see ai/decisions.md). Sector tagging applies to the
    full 3352 (cheap, reuses cached sector names).
  - 15 new unit tests (31 total project-wide), plus a real full live
    run (both profiles, 0 fundamentals fetch failures, ~135s):
    11/11 sectors ranked plausibly, regime label 顺风 with a
    internally-consistent 2-of-3 bullish signal count, 5 sampled
    candidates' fundamentals cross-checked as internally plausible,
    all 14 earnings_soon=true symbols independently re-verified to
    have 0.65-9.65 real days to their earnings date.
  - DONE-WHEN's Yahoo-page spot-check was NOT literally done (no
    browser access) - substituted with the same underlying API data
    (same provider, different access method - a smaller gap than CARD
    02's TradingView substitution). Earnings-calendar cross-check also
    has no independent second source (no Finnhub API key configured) -
    verified internal date arithmetic only. Both disclosed to the user.
  - TASK_CARD_03_PATCH (sector footprint aggregation + event window) NOT
    attempted: its own header states CARD 04 is a co-prerequisite
    (needs CARD 04's institutional-bucket data, which doesn't exist yet).

## In Progress
- Nothing active. Awaiting user direction on TASK_CARD_04 (explicitly not
  started per the established stop-after-each-card convention).

## Next Priorities
1. User to review TASK_CARD_03 results (including the two disclosed
   verification substitutions) and decide whether to proceed to CARD_04.
2. git push CARD_02's and CARD_03's commits once the user confirms (CARD
   01 is pushed; CARD 02 and CARD 03's commits are local-only as of this
   writing).
3. TASK_CARD_03_PATCH remains blocked until CARD_04 (institutional bucket)
   exists.
4. Undecided: full per-symbol OHLCV bars still live only in
   output/checkpoint.json (grows with every enrichment run, gitignored) -
   a future card should decide their permanent storage/access pattern.

## Blockers
- TASK_CARD_03_PATCH blocked on TASK_CARD_04 (its own stated prerequisite).

## Temporary Notes
- output/checkpoint.json is large and gitignored; it is a reusable local
  cache (Phase A quote + Phase B enrichment/OHLCV + Phase C fundamentals),
  not a deliverable. Deleting it is safe but forces a full network refetch.
- Keep this file current after meaningful work.
