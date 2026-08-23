# Current State

## Completed
- Template initialized; governance, constitution, and cards merged into repo.
- ai/project_overview.md initialized from Atlas idea + constitution cross-check.
- constitution/ (5 files) read in full and treated as frozen law.
- TASK_CARD_01 - Layer 1 skeleton: dual-profile universe definer + yahoo-finance2
  data access + screening pipeline shell + ledger placeholder. DONE (see
  ai/decisions.md 2026-08-23 entries for the notable engineering decisions and
  the one correctness bug found and fixed along the way).
  - 5 scope-item commits (skeleton/universe/data/screen/ledger) + 1 bug-fix
    commit (validateResult:false), all on master.
  - Live full-universe validation run: 8531 raw NYSE+NASDAQ symbols -> 5460
    post-exclusion -> STANDARD 2920 passed (>=1500 required), SMALL_SPEC 432,
    BOTH 3352 (>=2000 required). 0 quote-fetch failures, 0 enrichment
    failures across the full run.
  - Checkpoint/resume verified both live (cross-profile reuse: small_spec
    and both runs needed 0 duplicate fetches) and via an isolated interrupt
    simulation (partial-then-resume, unchanged timestamps proving no
    refetch).
  - 10-symbol spot check (both manual sample and an automated full-3352-set
    check) found zero exclusion-gate leaks and 100% correct speculative
    flagging.

## In Progress
- Nothing active. Awaiting user direction on TASK_CARD_02 (explicitly not
  started per the user's instruction to stop after TASK_CARD_01).

## Next Priorities
1. User to review TASK_CARD_01 results and decide whether to proceed to
   TASK_CARD_02.
2. Undecided: full per-symbol OHLCV bars currently live only in
   output/checkpoint.json (233MB, gitignored) - a future card should decide
   their permanent storage/access pattern before detectors need to consume
   them.

## Blockers
- None.

## Temporary Notes
- output/checkpoint.json is large (~233MB after this validation run) and
  gitignored; it is a reusable local cache (Phase A quote data + Phase B
  enrichment), not a deliverable. Deleting it is safe but forces a full
  network refetch on the next run.
- Keep this file current after meaningful work.
