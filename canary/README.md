# Canary Payloads

Frozen reference copies of Atlas's first real-market-data ATLAS PAYLOAD and
ATLAS DISSENT PAYLOAD, per TASK_CARD_06 SCOPE 3 and the constitution's canary
mechanism (`ATLAS_MEMO_NO3_ADJUDICATIONS.md`, S2: "Cockpit 的模型漂移金丝雀检测机制原样移植至
Atlas 两个推理环境"; `ATLAS_AMENDMENT_NO2_v1_1.md`: "金丝雀测试以契约等价与方向等价为漂移检测基准").

## What these are

- `atlas_payload_baseline.txt` — the ATLAS PAYLOAD text block from Atlas's
  very first live production run against real market data
  (`output/atlas_payload_2026-08-24T14-07-43-049Z.txt`, run timestamp
  2026-08-24T14:07:43.049Z, 5 candidates: MRVI/SBFG/TENX/ABCL/RCMT, one per
  detector bucket).
- `atlas_dissent_payload_baseline.txt` — the matching ATLAS DISSENT PAYLOAD
  from that same run.

Both are real output from real network data (Yahoo Finance / SEC EDGAR /
FINRA) — nothing here is synthetic or hand-constructed.

## What "canary" means here (and what it does not mean)

This is a **structural drift baseline**, not a record of a completed human
Radar/Red-Team review. Frozen at this point in time so that whenever Atlas
PAYLOAD/DISSENT PAYLOAD text is later fed into Atlas Radar or Atlas Red Team
(the two Claude-based reasoning environments outside this repo), a future
run's output can be diffed against this baseline for two things per the
constitution's stated basis:

- **契约等价 (contract equivalence)**: the section headers, field names, and
  overall structure a downstream reasoning environment parses against
  haven't silently changed shape.
- **方向等价 (direction equivalence)**: the reasoning environment's read on
  a given input (e.g., how it categorizes the DISSENT PAYLOAD's bucket/thesis
  pairing) hasn't drifted after a model upgrade on the Radar/Red-Team side.

It does **not** certify that this specific payload was ever pasted into
Atlas Radar or that a Red Team pass was run against it — that verification
step is still open (see `ai/decisions.md`'s TASK_CARD_05 entry on the two
externally-gated DONE-WHEN items).

## Regenerating (do not do this casually)

These files are a fixed reference point, not meant to be routinely
overwritten. `npm run screen -- --profile both` generates fresh
`output/atlas_payload_*.txt` / `output/atlas_dissent_payload_*.txt` files
every run — those are the ones to actually use day-to-day. Only replace the
files in this directory if you deliberately want to re-baseline the drift
comparison (e.g., after an intentional PAYLOAD format change).
