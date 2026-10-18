/**
 * Weekly Intel Briefing - "triage-first" (design-demos/triage-first.html,
 * chosen by the project owner 2026-10-17 over bucket-centric). Supersedes the
 * five-strata v2 skin (claude_code_design_draft.md) while keeping its
 * deterministic content: the market environment collapses into a sticky
 * one-line "weather" strip, tier 1 lists every candidate once (no summary
 * cards repeated by a detail layer), tier 2 is a dense table, and all
 * evidence sits below a single divider as one column of panels.
 *
 * Tokens: Atlas's `[data-project="atlas"]` set from the refined-functionalism
 * skill (`~/.claude/skills/refined-functionalism/references/tokens.css`),
 * values copied verbatim as design-demos/_shared-spec.md requires, plus
 * `--bucket-contagion` (TASK_CARD_10's fifth bucket, absent from the shared
 * set) and the `--strength-*` band colors this report already used.
 *
 * `--fg`/`--muted`/`--up`/`--down`/`--mono` stay as aliases: sparkline.ts
 * strokes with var(--up)/var(--down).
 *
 * Progressive disclosure is native <details>, not script: Stockpit shows
 * this file in a sandboxed iframe with scripts disabled, and a JS-only
 * toggle was dead there.
 */
export const REPORT_STYLES = `
:root{
  --bg:#0B0E14;--surface:#141922;--sunken:#0F131B;--elevated:#1C2230;--overlay:#232B3B;
  --border:#262E3D;--border-strong:#34405480;
  --text:#E8EDF5;--text-2:#9AA6B8;--text-muted:#5E6B80;
  --accent:#22C9D6;--accent-weak:#22C9D61F;--accent-strong:#55E0EA;
  --pos:#16C784;--neg:#EA3943;--warn:#F0A020;
  --bucket-momentum:#2F80FF;--bucket-vol:#A855F7;--bucket-instl:#16C784;--bucket-oversold:#F0A020;--bucket-contagion:#EA3943;
  --tier-research:var(--accent);--tier-watch:var(--text-2);
  --strength-strong:#16C784;--strength-mid:#9AA6B8;--strength-weak:#5E6B80;
  --font-display:'Manrope',system-ui,sans-serif;--font-body:'Manrope',system-ui,sans-serif;
  --font-mono:'JetBrains Mono',ui-monospace,monospace;
  --r-xs:4px;--r-sm:6px;--r-md:10px;--r-lg:14px;
  --s-1:4px;--s-2:8px;--s-3:12px;--s-4:16px;--s-5:24px;--s-6:32px;--s-7:48px;--s-8:64px;
  --ease:cubic-bezier(.2,.6,.2,1);--dur:160ms;
  --fg:var(--text);--muted:var(--text-2);--mono:var(--font-mono);--up:var(--pos);--down:var(--neg);
}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
body{background:var(--bg);color:var(--text);font-family:var(--font-body);font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased;font-feature-settings:'tnum' 1}
.mono{font-family:var(--font-mono);font-feature-settings:'tnum' 1}
a{color:inherit;text-decoration:none}
.wrap{max-width:1180px;margin:0 auto;padding:0 var(--s-6) var(--s-8)}
section[id],article[id]{scroll-margin-top:120px}
.up,.pos{color:var(--pos)}.down,.neg{color:var(--neg)}.neu,.flat{color:var(--text-2)}.warn{color:var(--warn)}.muted{color:var(--text-muted)}

/* Radar-only slots: present, readable, and visibly not content yet. */
.placeholder,.pending{font-size:11.5px;color:var(--text-muted);font-style:italic}
.pending::before{content:"· ";font-style:normal}
.empty-state{font-size:12.5px;color:var(--text-2)}
.prose{font-size:13.5px;line-height:1.75;color:var(--text);max-width:78ch}

/* ===== sticky header: masthead + weather ===== */
header.head-sticky{position:sticky;top:0;z-index:50;background:var(--bg);border-bottom:1px solid var(--border)}
.masthead{max-width:1180px;margin:0 auto;padding:var(--s-3) var(--s-6);display:flex;align-items:baseline;justify-content:space-between;gap:var(--s-4);flex-wrap:wrap}
.brand{display:flex;align-items:baseline;gap:var(--s-3)}
.brand-mark{font-family:var(--font-display);font-weight:800;font-size:15px;letter-spacing:.02em}
.brand-sub{font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-muted);font-weight:600}
.masthead-meta{font-size:12px;color:var(--text-2);white-space:nowrap}
.weather{background:var(--surface);border-top:1px solid var(--border)}
.weather-row{max-width:1180px;margin:0 auto;padding:var(--s-2) var(--s-6);display:flex;align-items:center;gap:var(--s-2) var(--s-4);flex-wrap:wrap;font-size:12.5px}
.w-item{display:flex;align-items:baseline;gap:6px;white-space:nowrap}
.w-label{color:var(--text-muted);font-size:10.5px;text-transform:uppercase;letter-spacing:.06em}
.w-value{font-weight:600}
.w-note{color:var(--text-muted)}
.w-div{width:1px;height:12px;background:var(--border-strong);flex:0 0 auto}
.weather-links{margin-left:auto;display:flex;gap:var(--s-4);flex-wrap:wrap}
.weather-links a,.evidence-nav a{font-size:12px;color:var(--accent);border-bottom:1px solid transparent;transition:border-color var(--dur) var(--ease)}
.weather-links a:hover,.evidence-nav a:hover{border-color:var(--accent)}

/* Warnings sit directly under the header, full width, not sticky. */
.credit-warning-bar,.breadth-warning-bar{max-width:1180px;margin:var(--s-3) auto 0;padding:10px var(--s-5);display:flex;gap:12px;align-items:baseline;flex-wrap:wrap;border-radius:var(--r-md)}
.credit-warning-bar{background:color-mix(in srgb,var(--neg) 14%,transparent);border:1px solid var(--neg)}
.credit-warning-label{color:var(--neg);font-weight:700;font-size:13px}
.credit-warning-detail,.breadth-warning-detail{color:var(--text-2);font-size:12px}
/* amber, not the credit bar's red: a breadth divergence lowers breakout reliability, it does not disable a tier. */
.breadth-warning-bar{background:color-mix(in srgb,var(--warn) 12%,transparent);border:1px solid var(--warn)}
.breadth-warning-label{color:var(--warn);font-weight:700;font-size:13px}
.credit-unknown-note{max-width:1180px;margin:var(--s-2) auto 0;padding:0 var(--s-6);color:var(--text-muted);font-size:11.5px;font-style:italic}

/* ===== tiers ===== */
.tier1,.tier2,.panel{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);overflow:hidden}
.tier1{margin-top:var(--s-5)}.tier2{margin-top:var(--s-6)}
.tier-head{padding:var(--s-5) var(--s-5) var(--s-2)}
.tier-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em}
.tier-label.research{color:var(--tier-research)}.tier-label.watch{color:var(--tier-watch)}
.tier-title{font-size:20px;font-weight:700;margin-top:4px}
.tier-sub{font-size:12.5px;color:var(--text-2);margin-top:2px}

.dot{width:7px;height:7px;border-radius:50%;display:inline-block;flex:0 0 auto}
.dot.zero{background:transparent;border:1px solid var(--text-muted)}
.bucket-legend{display:flex;gap:var(--s-2) var(--s-5);flex-wrap:wrap;padding:var(--s-2) var(--s-5) var(--s-4);font-size:12px}
.bl-item{display:flex;align-items:center;gap:6px;color:var(--text-2)}
.bl-item.zero{color:var(--text-muted)}
.bl-note{font-size:11.5px;color:var(--text-muted)}

/* ===== tier 1 candidate ===== */
.cand{padding:var(--s-5);border-top:1px solid var(--border)}
.cand-top{display:flex;align-items:flex-start;justify-content:space-between;gap:var(--s-4);flex-wrap:wrap}
.cand-id{display:flex;align-items:baseline;gap:var(--s-3);flex-wrap:wrap;min-width:0}
.cand-rank{font-family:var(--font-mono);font-size:11px;color:var(--text-muted);align-self:center}
.ticker{font-family:var(--font-mono);font-size:36px;font-weight:800;letter-spacing:-.01em;line-height:1}
.company{font-size:13px;color:var(--text-2)}
.cand-readout{display:flex;gap:var(--s-5);text-align:right}
.ro-label{display:block;font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em}
.band{font-size:13px;font-weight:700}
.strength-strong{color:var(--strength-strong)}.strength-mid{color:var(--strength-mid)}.strength-weak,.strength-na{color:var(--strength-weak)}
.cand-strength-bar{width:120px;height:4px;background:var(--overlay);border-radius:2px;overflow:hidden;margin:4px 0 2px auto}
.cand-strength-bar i{display:block;height:100%;border-radius:2px}
.frac{font-size:11px;color:var(--text-muted);font-family:var(--font-mono)}
.cand-verdict{font-size:12.5px;color:var(--text);font-family:var(--font-mono)}
.cand-meta{margin-top:var(--s-3);font-size:12.5px;color:var(--text-2);display:flex;align-items:center;gap:var(--s-2);flex-wrap:wrap}
.cand-meta .sep{color:var(--border-strong)}
.bucket-tag{display:inline-flex;align-items:center;gap:6px;color:var(--text);font-weight:600}
.tier-warn{color:var(--warn)}
.tier-warn-red{color:var(--neg);font-weight:600}
.entry-structure{color:var(--text);border:1px solid var(--border-strong);border-radius:var(--r-xs);padding:0 6px;font-size:11.5px}
.cand-contagion-row{margin-top:var(--s-2);font-size:12.5px;color:var(--text-2)}
.cand-contagion-row b{color:var(--text)}
.cand-body{margin-top:var(--s-4);display:flex;align-items:center;justify-content:space-between;gap:var(--s-5)}
.cand-technicals{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:0 var(--s-4);flex:1 1 auto}
.tech-item{display:flex;flex-direction:column;gap:3px}
.tech-label{font-size:9.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted)}
.tech-value{font-family:var(--font-mono);font-size:13px;font-weight:600}
.cand-spark{flex:0 0 auto;text-align:center}
.cand-spark svg{display:block}
.spark-caption{font-size:9.5px;color:var(--text-muted);margin-top:2px}
.cand-desc{margin-top:var(--s-3);font-size:13px;color:var(--text);max-width:90ch}
.cand-desc.pending{font-size:11.5px;color:var(--text-muted)}

.cand-detail{margin-top:var(--s-4);border-top:1px solid var(--border);padding-top:var(--s-3)}
.cand-detail>summary{cursor:pointer;font-size:12px;color:var(--accent);list-style:none;display:inline-flex;gap:6px;align-items:center}
.cand-detail>summary::-webkit-details-marker{display:none}
.cand-detail>summary::after{content:"▾";color:var(--text-muted)}
.cand-detail[open]>summary::after{content:"▴"}
.cand-detail-body{margin-top:var(--s-3);background:var(--sunken);border:1px solid var(--border);border-radius:var(--r-md);padding:var(--s-3) var(--s-4)}
.cand-cond-row{display:grid;grid-template-columns:18px minmax(0,1.2fr) minmax(0,1.6fr) 56px;gap:var(--s-3);align-items:baseline;padding:5px 0;font-size:12.5px}
.cand-cond-row+.cand-cond-row{border-top:1px solid var(--border)}
.cand-cond-row .sym.hit{color:var(--pos)}.cand-cond-row .sym.miss{color:var(--neg)}.cand-cond-row .sym.na{color:var(--text-muted)}
.cand-cond-row .fmv{color:var(--text-2);font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cand-cond-row .state3{color:var(--text-muted);font-size:11px;text-align:right}
.cand-detail-foot{margin-top:var(--s-2);font-size:11px;color:var(--text-muted)}
.cand-latent-row{margin-top:var(--s-3);padding-top:var(--s-2);border-top:1px dashed var(--border-strong);font-size:12px;color:var(--text-2)}
.cand-latent-title{font-size:11px;color:var(--text-muted);margin-bottom:4px}
.cand-latent-items{display:flex;gap:var(--s-2) var(--s-4);flex-wrap:wrap}

.concentration-note{margin:0 var(--s-5) var(--s-5);padding:10px 14px;background:var(--sunken);border:1px solid var(--border);border-radius:var(--r-sm)}
.concentration-title{color:var(--text-2);font-size:11.5px;font-weight:600;letter-spacing:.04em;margin-bottom:4px}
.concentration-row{font-size:12.5px;line-height:1.7}
.tier-empty{padding:0 var(--s-5) var(--s-5)}

/* ===== tier 2 watchlist ===== */
.wt-row{display:grid;grid-template-columns:88px 20px minmax(0,1fr) 140px;align-items:center;gap:var(--s-3);padding:var(--s-2) var(--s-5)}
.wt-row+.wt-row,.wt-head{border-top:1px solid var(--border)}
.wt-head span{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)}
.wt-ticker{font-family:var(--font-mono);font-weight:700;font-size:14px;color:var(--tier-watch)}
.wt-name{font-size:12.5px;color:var(--text-2);min-width:0}
.wt-strength{font-size:12px;color:var(--text-2);text-align:right;font-family:var(--font-mono)}
.watch-promo-note{padding:var(--s-2) var(--s-5) var(--s-4);font-size:12px;color:var(--text-2);border-top:1px solid var(--border)}

/* ===== evidence ===== */
.evidence-nav{display:flex;align-items:baseline;justify-content:space-between;gap:var(--s-3);flex-wrap:wrap;margin:var(--s-7) 0 var(--s-4);border-top:1px solid var(--border);padding-top:var(--s-4)}
.evidence-eyebrow{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--text-muted)}
.evidence-links{display:flex;gap:var(--s-3);flex-wrap:wrap}
.block{margin-top:var(--s-6)}
.section-title-row{display:flex;align-items:baseline;justify-content:space-between;gap:var(--s-3);margin-bottom:var(--s-3);flex-wrap:wrap}
.section-eyebrow{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted)}
.section-note{font-size:12px;color:var(--text-muted)}
.simple-panel{padding:var(--s-4) var(--s-5)}

.sf-row{display:grid;grid-template-columns:32px minmax(0,1fr) 84px 150px 78px;align-items:center;gap:var(--s-3);padding:var(--s-2) var(--s-5);font-size:13px}
.sf-row+.sf-row{border-top:1px solid var(--border)}
.sf-head span{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)}
.sf-row.anomaly{background:var(--accent-weak)}
.sf-rank{font-family:var(--font-mono);color:var(--text-muted)}
.sf-sector{display:flex;align-items:center;gap:8px;min-width:0}
.sf-star{color:var(--accent);font-size:11.5px}
.sf-chg{font-family:var(--font-mono);text-align:right;font-weight:600}
.sf-sq{display:flex;align-items:center;gap:var(--s-2)}
.sf-sq-val{font-family:var(--font-mono);width:46px;flex:0 0 auto;text-align:right}
.sf-sq-bar{flex:1 1 auto;height:4px;background:var(--overlay);border-radius:2px;overflow:hidden}
.sf-sq-bar i{display:block;height:100%;background:var(--text-muted);border-radius:2px}
.sf-row.anomaly .sf-sq-bar i{background:var(--accent)}
.sf-flow{text-align:right;font-weight:600}
.sf-flow.in{color:var(--pos)}.sf-flow.out{color:var(--neg)}.sf-flow.flat{color:var(--text-2)}
.sf-summary{padding:var(--s-3) var(--s-5);border-top:1px solid var(--border)}
.sort-btn{background:none;border:0;color:inherit;font:inherit;text-transform:inherit;letter-spacing:inherit;cursor:pointer}
.sort-btn[data-active="true"]{color:var(--accent)}

.hs-row{padding:var(--s-4) var(--s-5)}
.hs-row+.hs-row{border-top:1px solid var(--border)}
.hs-name{font-size:15px;font-weight:700;display:flex;align-items:baseline;gap:var(--s-3);flex-wrap:wrap}
.hs-rank{font-size:11px;color:var(--text-muted);font-weight:400}
.hs-stats{margin-top:4px;font-size:12.5px;color:var(--text-2);font-family:var(--font-mono)}
.hs-verdict{margin-top:6px;font-size:13px}
.hs-coverage{margin-top:4px;font-size:11.5px;color:var(--text-muted)}
.hs-members{margin-top:6px;font-size:12.5px;color:var(--text-2)}
.hs-members .mono{color:var(--text)}
.hs-members .accent-mark{color:var(--accent);font-weight:700}

.theme-card{padding:var(--s-5)}
.theme-card+.theme-card{border-top:1px solid var(--border)}
.theme-tag{font-size:11px;color:var(--text-muted);letter-spacing:.04em}
.theme-name{margin-top:4px;font-size:15px;font-weight:700;display:flex;align-items:baseline;gap:var(--s-3);flex-wrap:wrap}
.theme-strength{font-size:12px;font-weight:600}
.theme-footprint{margin-top:var(--s-3);font-size:12.5px;color:var(--text-2);display:flex;flex-direction:column;gap:2px}
.footprint-bar{margin-top:6px;height:4px;background:var(--overlay);border-radius:2px;overflow:hidden;max-width:320px}
.footprint-bar i{display:block;height:100%;background:var(--accent);border-radius:2px}
.theme-members{margin-top:var(--s-2);font-size:12.5px;color:var(--text-2)}
.theme-verdict{margin-top:var(--s-3);font-size:13px}
.theme-watchpoints{margin-top:var(--s-2);font-size:12px;color:var(--text-2)}
.zero-hit-note{padding:var(--s-3) var(--s-5);border-top:1px solid var(--border);font-size:12px;color:var(--text-2)}

.excluded-note+.excluded-note{margin-top:var(--s-2)}
.excluded-note .mono{overflow-wrap:anywhere}
.disclaimer{margin-top:var(--s-4);padding-top:var(--s-4);border-top:1px solid var(--border);font-size:12px;color:var(--text-2);line-height:1.6}
.ledger-line{display:flex;gap:var(--s-2);font-size:12.5px;color:var(--text-2)}
.ledger-line .l-label{color:var(--text-muted);min-width:110px}

footer.fingerprint{margin-top:var(--s-7);padding-top:var(--s-5);border-top:1px solid var(--border);font-size:11.5px;color:var(--text-muted)}

@media (max-width:880px){
  /* the weather strip wraps to several lines on a phone - pinned, it would eat the screen */
  header.head-sticky{position:static}
  .wrap,.masthead,.weather-row{padding-left:var(--s-4);padding-right:var(--s-4)}
  .masthead{flex-direction:column;align-items:flex-start;gap:4px}
  .masthead-meta{white-space:normal}
  .weather-links{margin-left:0}
  .cand-readout{text-align:left}
  .cand-strength-bar{margin-left:0}
  .cand-body{flex-direction:column;align-items:stretch}
  .cand-technicals{grid-template-columns:repeat(3,minmax(0,1fr));row-gap:var(--s-3)}
  .cand-spark{align-self:flex-start}
  .cand-cond-row{grid-template-columns:18px minmax(0,1fr) 48px}
  .cand-cond-row .fmv{display:none}
  .wt-row{grid-template-columns:70px 16px minmax(0,1fr)}
  .wt-strength{display:none}
  .sf-row{grid-template-columns:24px minmax(0,1fr) 70px 78px}
  .sf-sq{display:none}
  .ticker{font-size:30px}
}
@media print{
  header.head-sticky{position:static}
  .weather-links,.evidence-links,[data-noprint]{display:none}
}
`;
