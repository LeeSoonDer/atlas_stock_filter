# Current State

## Completed
- Template initialized; governance, constitution, and cards merged into repo.
- ai/project_overview.md initialized from Atlas idea + constitution cross-check.
- constitution/ (5 files) read in full and treated as frozen law.
- TASK_CARD_01 - Layer 1 skeleton (universe definer, data access, pipeline
  shell, ledger placeholder). DONE, independently verified, pushed to
  origin/master (github.com/LeeSoonDer/atlas_stock_filter).
- TASK_CARD_02 - three pure-technical detector buckets (Momentum Breakout,
  Volatility Compression Setup, Oversold Reversal) + indicator library. DONE.
  - 5 commits (indicators / Detector A / Detector B / Detector C+barrel /
    pipeline wiring), all on master, not yet pushed.
  - Indicator library: SMA20/50/200, Wilder's RSI14, Wilder's ATR14+ATR%,
    52-week high/low/position%, volume avg20/50 + ratios, OBV + 20-day
    slope, Bollinger width + 120-day percentile, 3mo/6mo trailing returns
    (cross-symbol percentile-ranked in the pipeline). Plus sidewaysBaseDays,
    added beyond SCOPE 1's list because Detector B needs it (see decisions.md).
  - 16 unit tests (node:test, zero new dependencies), including hand-traced
    fixtures for RSI and Bollinger width per DONE-WHEN's explicit requirement.
  - Live full-run validation (reusing CARD 01's cached OHLCV, no new network
    calls, 3.8s run): momentum_breakout=27, volatility_compression_setup=316,
    oversold_reversal=25 hits - all three buckets non-zero.
  - Config-driven thresholds verified live: dropping Detector C's RSI
    threshold to an unreachable value drove its count to 0; restoring the
    original config reproduced the exact original counts.
  - DONE-WHEN's TradingView spot-check was NOT literally done (no browser
    access in this environment) - substituted with a numeric sanity check
    against the same underlying OHLCV/indicator values for 3 symbols per
    bucket. Reported to the user as a substituted method, not claimed as
    equivalent. See ai/decisions.md.

## In Progress
- Nothing active. Awaiting user direction on TASK_CARD_03 (explicitly not
  started per the user's instruction to stop after TASK_CARD_02).

## Next Priorities
1. User to review TASK_CARD_02 results (including the TradingView
   substitution) and decide whether to proceed to TASK_CARD_03.
2. git push the TASK_CARD_02 commits once the user confirms (not yet pushed
   as of this writing - CARD 01's commits are pushed, CARD 02's are local only).
3. Undecided: full per-symbol OHLCV bars still live only in
   output/checkpoint.json (grows with every enrichment run, currently
   several hundred MB, gitignored) - a future card should decide their
   permanent storage/access pattern.

## Blockers
- None.

## Temporary Notes
- output/checkpoint.json is large and gitignored; it is a reusable local
  cache (Phase A quote data + Phase B enrichment/OHLCV), not a deliverable.
  Deleting it is safe but forces a full network refetch on the next run.
- Indicator computation itself is fast and re-runs from the cached OHLCV
  every `npm run screen` invocation (not itself cached) - no network cost
  to re-running with different config/detectors.json thresholds.
- Keep this file current after meaningful work.
