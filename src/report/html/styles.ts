/**
 * claude_code_design_draft.md — "信息分层版 v2". Supersedes the TASK_CARD_07
 * Part C single-density "intel briefing" skin: the report is now five
 * numbered strata (地层), each with its own type scale / density / surface
 * treatment (§2 of the draft) rather than a uniform stack of look-alike
 * panels. Design reference: Atlas's `[data-project="atlas"]` token set from
 * the refined-functionalism skill (`~/.claude/skills/refined-functionalism/
 * references/tokens.css`) - this file's :root below carries the exact same
 * values, plus two additions the draft's §5 asks for that the shared token
 * set doesn't define (`--sunken`, a level darker than `--surface` for the
 * footprint-detail expand region; `--border-dim`, a step darker than
 * `--border` for the de-emphasized layer-03/04 dividers).
 *
 * `--fg`/`--muted`/`--accent`/`--up`/`--down`/`--warn`/`--mono` are kept as
 * aliases so sparkline.ts and semanticLabels.ts's callers keep resolving
 * without changes (they only ever read color, never the literal token name).
 */
export const REPORT_STYLES = `
:root{
  --bg:#0B0E14;--surface:#141922;--sunken:#0F131B;--elevated:#1C2230;--overlay:#232B3B;
  --border:#262E3D;--border-dim:#1C2230;--border-strong:#34405480;
  --text:#E8EDF5;--text-2:#9AA6B8;--text-muted:#5E6B80;
  --accent:#22C9D6;--accent-strong:#55E0EA;--accent-weak:#22C9D614;
  --pos:#16C784;--neg:#EA3943;--warn:#F0A020;
  --bucket-momentum:#2F80FF;--bucket-vol:#A855F7;--bucket-instl:#16C784;--bucket-oversold:#F0A020;
  --strength-strong:#16C784;--strength-mid:#9AA6B8;--strength-weak:#5E6B80;
  --font-display:'Manrope',system-ui,sans-serif;--font-body:'Manrope',system-ui,sans-serif;
  --font-mono:'JetBrains Mono',ui-monospace,monospace;
  --r-xs:4px;--r-sm:6px;--r-md:10px;--r-lg:12px;
  --s-1:4px;--s-2:8px;--s-3:12px;--s-4:16px;--s-5:24px;--s-6:32px;--s-7:48px;--s-8:64px;

  /* aliases for shared helpers (sparkline.ts / semanticLabels.ts) */
  --fg:var(--text);--muted:var(--text-2);--mono:var(--font-mono);
  --up:var(--pos);--down:var(--neg);
}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:var(--font-body);font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased;font-feature-settings:'tnum' 1;padding:0 0 80px}
.mono,.tabular{font-family:var(--font-mono);font-feature-settings:'tnum' 1}
.wrap{max-width:1180px;margin:0 auto;padding:0 32px}
a{color:inherit;text-decoration:none}
.up{color:var(--pos)}.down{color:var(--neg)}.neu{color:var(--text-2)}.warn{color:var(--warn)}.muted{color:var(--text-2)}
.placeholder{color:var(--text-muted);font-style:italic}

/* ===== masthead ===== */
.masthead{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1px solid var(--border);padding:28px 32px 16px;max-width:1180px;margin:0 auto}
.brand{font-size:22px;font-weight:800;letter-spacing:3px}.brand span{color:var(--accent)}
.meta{text-align:right;font-size:11.5px;color:var(--text-2)}.meta b{color:var(--text)}

/* ===== TASK_CARD_08 Part A: credit-tight warning bar (rendered only when creditRegime.label === "tight") ===== */
.credit-warning-bar{max-width:1180px;margin:0 auto;padding:10px 32px;background:color-mix(in srgb, var(--neg) 14%, transparent);border-bottom:1px solid var(--neg);display:flex;gap:12px;align-items:baseline;flex-wrap:wrap}
.credit-warning-label{color:var(--neg);font-weight:700;font-size:13px}
.credit-warning-detail{color:var(--text-2);font-size:12px}
.credit-unknown-note{max-width:1180px;margin:0 auto;padding:6px 32px;color:var(--text-muted);font-size:11.5px;font-style:italic;border-bottom:1px solid var(--border-dim)}

/* ===== stratum head (repeated at the top of every numbered layer) ===== */
.stratum{padding-top:40px}
.stratum:first-of-type{padding-top:32px}
.stratum[data-stratum="04"],.stratum[data-stratum="05"]{border-top:1px solid var(--border);margin-top:var(--s-8);padding-top:var(--s-8)}
.stratum-head{display:flex;align-items:baseline;gap:10px;margin-bottom:20px}
.stratum-no{font-family:var(--font-mono);font-size:11px;font-weight:700}
.stratum-name{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.16em}
.stratum-rule{flex:1;height:1px;background:var(--border)}
.stratum-meta{font-size:11.5px;color:var(--text-2)}
.stratum[data-stratum="01"] .stratum-no,.stratum[data-stratum="01"] .stratum-name,
.stratum[data-stratum="02"] .stratum-no,.stratum[data-stratum="02"] .stratum-name{color:var(--accent)}
.stratum[data-stratum="03"] .stratum-no,.stratum[data-stratum="03"] .stratum-name{color:var(--text-2)}
.stratum[data-stratum="04"] .stratum-no,.stratum[data-stratum="04"] .stratum-name,
.stratum[data-stratum="05"] .stratum-no,.stratum[data-stratum="05"] .stratum-name{color:var(--text-muted)}

/* ===== 01 · 值得研究 ===== */
.s01-title{font-size:52px;font-weight:800;letter-spacing:-.025em;line-height:1.05}
.s01-sub{font-size:14.5px;color:var(--text-2);margin-top:10px;max-width:76ch;line-height:1.6}
.s01-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1px;background:var(--border);border-radius:var(--r-md);overflow:hidden;margin-top:28px}
.s01-card{background:var(--surface);padding:18px 20px;display:block}
.s01-card-top{display:flex;justify-content:space-between;align-items:flex-start}
.s01-card .tk{font-family:var(--font-mono);font-size:26px;font-weight:700}
.s01-card .band{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}
.s01-card .band.strength-strong{color:var(--strength-strong)}.s01-card .band.strength-mid{color:var(--strength-mid)}.s01-card .band.strength-weak{color:var(--strength-weak)}.s01-card .band.strength-na{color:var(--text-muted)}
.s01-strength-bar{height:3px;border-radius:2px;background:var(--elevated);margin-top:10px;overflow:hidden}
.s01-strength-bar i{display:block;height:100%;border-radius:2px}
.s01-card-meta{display:flex;align-items:center;gap:6px;margin-top:10px;font-size:11px;color:var(--text-2)}
.dot{display:inline-block;width:7px;height:7px;border-radius:50%;flex-shrink:0}
.s01-empty{font-size:14.5px;color:var(--text-2);margin-top:28px;padding:20px 0;border-top:1px solid var(--border)}

.s01-env{display:flex;flex-wrap:wrap;gap:0;border-top:1px solid var(--border);margin-top:28px;padding-top:18px}
.s01-env-item{display:flex;flex-direction:column;gap:3px;padding:0 20px 0 0;position:relative}
.s01-env-item + .s01-env-item{padding-left:20px}
.s01-env-item + .s01-env-item::before{content:"";position:absolute;left:0;top:2px;width:1px;height:11px;background:var(--border)}
.s01-env-item .k{font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em}
.s01-env-item .v{font-size:15px;font-weight:700}
.s01-env-note{flex-basis:100%;margin-top:12px;font-size:12.5px}

/* ===== 02 · 候选明细 (only layer with card surface) ===== */
.s02-legend{display:flex;flex-wrap:wrap;gap:16px;margin-bottom:20px;font-size:11.5px;color:var(--text-2)}
.s02-legend .item{display:flex;align-items:center;gap:6px}
.s02-legend .dot.zero{background:transparent;border:1.5px solid var(--text-muted)}
.s02-legend .item.zero{color:var(--text-muted)}

.cand-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);margin-bottom:14px;overflow:hidden}
.cand-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding:20px 22px 16px;border-left:2px solid var(--strength-mid)}
.cand-card[data-strength="strong"] .cand-head{border-left-color:var(--strength-strong)}
.cand-card[data-strength="mid"] .cand-head{border-left-color:var(--strength-mid)}
.cand-card[data-strength="weak"] .cand-head,.cand-card[data-strength="na"] .cand-head{border-left-color:var(--strength-weak)}
.cand-head-left{display:flex;align-items:baseline;gap:12px;min-width:0}
.cand-idx{font-family:var(--font-mono);font-size:12px;color:var(--text-muted);flex-shrink:0}
.cand-tk{font-family:var(--font-mono);font-size:36px;font-weight:700;flex-shrink:0}
.cand-nm{font-size:13px;color:var(--text-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cand-strength{text-align:right;flex-shrink:0}
.cand-strength .band{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}
.cand-strength .band.strength-strong{color:var(--strength-strong)}.cand-strength .band.strength-mid{color:var(--strength-mid)}.cand-strength .band.strength-weak{color:var(--strength-weak)}.cand-strength .band.strength-na{color:var(--text-muted)}
.cand-strength-bar{width:140px;height:4px;border-radius:2px;background:var(--elevated);margin-top:6px;overflow:hidden}
.cand-strength-bar i{display:block;height:100%;border-radius:2px}
.cand-strength .frac{font-size:10.5px;color:var(--text-muted);margin-top:4px;font-family:var(--font-mono)}

.cand-metarow{display:flex;flex-wrap:wrap;gap:14px;align-items:center;padding:0 22px 16px;font-size:11.5px;color:var(--text-2)}
.cand-metarow .bucket-name{display:flex;align-items:center;gap:6px}
.cand-metarow .sep{color:var(--border-strong)}
.cand-metarow .tier-warn{color:var(--warn);font-weight:600}

.cand-datarow{display:flex;gap:20px;padding:0 22px 18px;flex-wrap:wrap}
.cand-facts{flex:1;min-width:280px;display:grid;grid-template-columns:repeat(3,1fr);gap:10px 16px}
.cand-fact .lbl{font-size:9.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)}
.cand-fact .val{font-family:var(--font-mono);font-size:13.5px;font-weight:600;margin-top:2px}
.cand-spark{flex-shrink:0;text-align:right}
.cand-spark .shape{font-size:10.5px;color:var(--text-muted);margin-top:4px}

.cand-foot{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 22px;border-top:1px solid var(--border)}
.cand-foot-text{flex:1;min-width:0}
.cand-verdict{font-family:var(--font-mono);font-size:11.5px;color:var(--accent-strong);margin-bottom:3px}
.cand-foot .desc{font-size:12.5px;color:var(--text-2);flex:1;min-width:0}
.cand-expand-btn{flex-shrink:0;background:none;border:1px solid var(--border);border-radius:var(--r-sm);color:var(--text-2);font-size:11px;font-family:var(--font-body);padding:5px 12px;cursor:pointer}
.cand-expand-btn:hover{border-color:var(--border-strong);color:var(--text)}

.cand-detail{background:var(--sunken);border-top:1px solid var(--border)}
.cand-detail-title{font-size:11px;color:var(--text-2);padding:14px 22px 8px}
.cand-cond-row{display:grid;grid-template-columns:20px 1fr 210px 74px;gap:10px;align-items:baseline;padding:7px 22px;font-size:12px}
.cand-cond-row .sym{font-weight:700}
.cand-cond-row .sym.hit{color:var(--pos)}.cand-cond-row .sym.miss{color:var(--text-muted)}.cand-cond-row .sym.unavailable{color:var(--text-muted)}
.cand-cond-row .label{color:var(--text-2)}
.cand-cond-row .fmv{font-family:var(--font-mono);font-size:11px;color:var(--text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cand-cond-row .state3{font-size:10px;text-align:right;color:var(--text-muted)}
.cand-detail-foot{font-size:11px;color:var(--text-muted);padding:10px 22px 14px;border-top:1px solid var(--border-dim);margin-top:4px;line-height:1.6}
/* TASK_CARD_09 Part A: 隐性吸筹复合信号 - visually distinct (muted, no strength coloring) from the footprintDetail table above it, since these are bonus-only signals, never admission conditions. */
.cand-latent-row{padding:8px 22px 14px;font-size:11.5px;color:var(--text-2)}
.cand-latent-title{color:var(--text-muted);font-size:10.5px;margin-bottom:6px}
.cand-latent-items{display:flex;flex-wrap:wrap;gap:6px 16px}

.s02-legend-foot{display:flex;flex-wrap:wrap;gap:18px;margin-top:18px;font-size:11.5px}
.s02-legend-foot .item{display:flex;align-items:center;gap:6px;color:var(--text-2)}

/* ===== 03 · 观察哨 (dense table, no card surfaces) ===== */
.watch-table{border:1px solid var(--border);border-radius:var(--r-md);overflow:hidden}
.watch-head-row{display:grid;grid-template-columns:88px 18px 1fr 200px;gap:10px;padding:9px 22px;font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid var(--border)}
.watch-row{display:grid;grid-template-columns:88px 18px 1fr 200px;gap:10px;align-items:center;padding:9px 22px;border-bottom:1px solid var(--border-dim);font-size:12.5px}
.watch-row:last-child{border-bottom:none}
.watch-row .wtk{font-family:var(--font-mono);font-weight:700}
.watch-row .wname{color:var(--text-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.watch-row .wstrength{text-align:right;font-size:11px;color:var(--text-2)}
.watch-promo-note{font-size:12px;color:var(--pos);padding:10px 22px;border-top:1px solid var(--border-dim)}

/* ===== 04 · 证据层 (de-surfaced, lower density) ===== */
.s04-back{font-size:11px;color:var(--text-2)}
.sector-table{border:1px solid var(--border-dim);border-radius:var(--r-md);overflow:hidden}
.sector-head-row{display:grid;grid-template-columns:auto 1fr auto auto auto;gap:12px;padding:8px 18px;font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid var(--border-dim)}
.sort-btn{background:none;border:none;color:inherit;font:inherit;text-transform:inherit;letter-spacing:inherit;cursor:pointer;padding:0;display:inline-flex;align-items:center;gap:3px}
.sort-btn:hover{color:var(--text-2)}
.sort-btn[data-active="true"]{color:var(--accent)}
.sort-btn .arrow{font-size:9px}
.flowline{display:grid;grid-template-columns:auto 1fr auto auto auto;gap:12px;align-items:center;padding:9px 18px;border-bottom:1px solid var(--border-dim);font-size:12px}
.flowline:last-child{border-bottom:none}
.flowline.anomaly{background:var(--accent-weak)}
.flowline .fr{font-family:var(--font-mono);color:var(--text-muted);font-size:11px;width:16px}
.flowline .fn{font-weight:600}
.flowline .star{font-size:9px;color:var(--accent);margin-left:6px}
.flowline .fp2{text-align:right;font-weight:600}
.flowline .fd{text-align:right;color:var(--text-2);font-size:11px}
.flowline.anomaly .fd{color:var(--accent);font-weight:700}
.flowline .ff{text-align:right;font-size:10px;padding:2px 8px;border-radius:var(--r-xs);min-width:44px;font-weight:600}
.flowline .ff.in{color:var(--pos)}.flowline .ff.out{color:var(--neg)}.flowline .ff.flat{color:var(--text-2)}
.sector-note{font-size:12px;color:var(--text-2);margin-top:10px}

.s04-grid{display:grid;grid-template-columns:1.25fr 1fr;gap:24px;margin-top:24px}
.s04-col-h{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:12px}
.sec-lite{border-bottom:1px solid var(--border-dim);padding:12px 0}
.sec-lite:first-child{padding-top:0}
.sec-lite:last-child{border-bottom:none}
.sec-lite-top{display:flex;justify-content:space-between;align-items:center}
.sec-lite-name{font-size:13px;font-weight:700;display:flex;align-items:center;gap:7px}
.sec-lite-name .dot{width:6px;height:6px}
.sec-lite-name .dot.in{background:var(--pos)}.sec-lite-name .dot.out{background:var(--neg)}.sec-lite-name .dot.flat{background:var(--text-muted)}
.sec-lite-tag{font-size:10px;color:var(--text-2)}
.sec-lite-data{font-size:11px;color:var(--text-2);margin-top:4px;display:flex;gap:12px;flex-wrap:wrap}
.sec-lite-data b{color:var(--text)}
.sec-lite-verdict{font-size:12px;line-height:1.6;margin-top:6px}
.sec-lite-pool{font-size:10.5px;color:var(--accent);margin-top:6px;font-family:var(--font-mono)}
.sec-lite-nopool{font-size:10.5px;color:var(--text-muted);margin-top:6px}
.sec-lite-coverage{font-size:10px;color:var(--text-muted);margin-top:4px}

.theme-lite{border:1px solid var(--border-dim);border-radius:var(--r-md);padding:16px 18px;margin-bottom:12px}
.theme-lite-tag{font-size:9.5px;letter-spacing:.05em;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px}
.theme-lite-name{font-size:15px;font-weight:700}
.theme-lite-strength{font-size:10px;margin-left:8px;color:var(--text-2);font-weight:600}
.theme-lite-arith{font-size:11.5px;color:var(--text-2);margin-top:8px;line-height:1.6}
.theme-lite-arith b{color:var(--text);font-family:var(--font-mono)}
.theme-lite-members{font-size:11px;color:var(--text-muted);margin-top:8px}
.theme-lite-members .tik{background:var(--sunken);border:1px solid var(--border-dim);border-radius:var(--r-xs);padding:2px 7px;margin-right:4px;color:var(--accent)}
.theme-lite-verdict{font-size:12px;line-height:1.6;margin-top:10px;padding-top:10px;border-top:1px solid var(--border-dim)}
.theme-lite-watchpoints{font-size:10.5px;color:var(--text-muted);margin-top:8px}
.zero-hit-note{font-size:11.5px;color:var(--text-2);line-height:1.7;margin-top:14px;padding-top:14px;border-top:1px solid var(--border-dim)}

/* ===== 05 · 流程与账本 (lowest density, plain text) ===== */
.s05-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:32px}
.s05-col-h{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:8px}
.s05-col{font-size:12px;color:var(--text-2);line-height:1.7}
.s05-col .placeholder{font-size:12px}
.s05-col ul{list-style:none}
.s05-col li{padding:4px 0}
.s05-disc{max-width:88ch;font-size:11px;color:var(--text-muted);line-height:1.7;margin-top:28px;padding-top:16px;border-top:1px solid var(--border-dim)}
.s05-fingerprint{font-family:var(--font-mono);font-size:10.5px;color:var(--text-muted);margin-top:10px}

.footer{text-align:center;font-size:11px;color:var(--text-muted);margin-top:40px;letter-spacing:1px}

@media print {
  :root{
    --bg:#fff;--surface:#fff;--sunken:#f5f6f8;--elevated:#eef0f3;--overlay:#fff;
    --border:#d8dee8;--border-dim:#e6eaf0;--border-strong:#b7c1d1;
    --text:#111417;--text-2:#444b57;--text-muted:#767f8c;
    --accent:#0e7490;--accent-strong:#0e7490;--accent-weak:#0e749014;
    --pos:#0f7a4e;--neg:#b3242d;--warn:#94590a;
  }
  body{background:#fff;color:#111}
  [data-stratum]{break-inside:avoid}
  [data-noprint]{display:none !important}
  [data-detail]{display:block !important}
}
`;
