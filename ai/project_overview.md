# Project Overview

## Project
Atlas — Attention Allocation Engine (注意力配置引擎)

## Problem
Human research attention is finite. Scanning the full US equity universe by hand or feel is unstructured and inconsistent. Atlas exists to systematically route limited research attention to the small set of publicly listed US companies currently showing the highest evidence convergence and structural quality — not to predict the market or claim an information edge (constitution/ATLAS_AMENDMENT_NO2_v1_1.md, 修正案六).

## Scope of This Repository
This repo is **Atlas Layer 1 only** — the deterministic Application Layer defined by the constitution's two-layer execution red line (constitution/ATLAS_AMENDMENT_NO2_v1_1.md, 修正案二). It is a TypeScript/Node CLI, on-demand triggered (no cron), with:

* Dual profile universe definition — `STANDARD` (mkt cap ≥ $300M, ADV ≥ $5M) and `SMALL_SPEC` (mkt cap $50M–$300M, ADV ≥ $1M, tagged `speculative: true`) — over the full NYSE + NASDAQ universe, after constitutional exclusion gates (OTC, SPAC, microcap pump structures, crypto, leveraged/inverse funds, options strategies).
* Four v1 opportunity detectors: Momentum Breakout, Volatility Compression Setup, Institutional Accumulation Proxy, Oversold Reversal (Memo No.4, 二).
* Two-tier output: ≤5 Candidates per run (round-robin across the four buckets) + ≤10 Watchlist entries (application-layer tracked only, auto-upgrades on trigger).
* Sector Capital Footprint Aggregation and Event Window flagging (Amendment No.3, 修正案八/九).
* A versioned Payload Contract handed off to a separate Research Layer (Atlas Radar / Atlas Red Team) that performs all LLM reasoning — **this repo makes zero LLM calls**, per the constitution's two-layer red line.
* A self-contained single-file HTML report (inline styles, mini-charts, opens directly in a browser) plus machine-readable JSON.
* A forward outcome ledger (append-only, permanent, no deletion) — Atlas's evidence base is real forward results, not historical backtesting (Amendment No.2, 修正案五).

## Audience
The project owner, acting as sole operator/researcher. Atlas's candidate output is manually handed to the separate Cockpit system for deep individual-stock research; no automated handoff exists (Memo No.3, Q3).

## Success Criteria
Per Memo No.4 (A2 期望管理条款): the system is judged on process quality — screening discipline, evidence convergence, false-positive defense, and forward verification — not on realized returns. V1 (this repo) succeeds when it reliably runs `npm run screen -- --profile <standard|small_spec|both>` end to end over the full NYSE+NASDAQ universe and produces a constitutionally clean, structurally correct candidate/watchlist JSON — see cards/TASK_CARD_01.md DONE-WHEN for the first concrete milestone.

## Non-Goals (v1 / this repo)
* No LLM calls, no AI reasoning of any kind inside this repo (belongs to the separate Research Layer).
* No scoring/ranking logic, no opportunity-detector implementation yet (TASK_CARD_01 ships interface stubs only).
* No UI framework, no dashboard (a future Next.js dashboard is an optional, non-v1 task card per Memo No.4, D14).
* No scheduled/cron execution — on-demand only.
* No automated handoff to Cockpit (manual candidate handoff, per Memo No.3 Q3).
* No biotech catalyst engine, M&A arbitrage engine, or distressed-asset framework (explicitly excluded from v1.x per Memo No.3, Q6).
* No 13F incremental parsing in v1 (deferred indefinitely per Memo No.4, E18); institutional evidence in v1 is Form 4 + institutional ownership % trend + short interest.
* No paid data dependencies (Yahoo Finance primary; FMP limited to post-screen enrichment of top candidates/watchlist only).
