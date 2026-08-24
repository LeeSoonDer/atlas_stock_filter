/**
 * TASK_CARD_05 SCOPE 5 design fallback (no P4_DESIGN_SPEC found in this
 * repo - verified via file search before writing this): "极简终端风,
 * 禁止 AI-slop(紫渐变/卡片套卡片)". Monospace, flat colors, no
 * gradients, no nested-card chrome - flat sections with thin borders.
 * Respects the OS light/dark preference; no JS dependency.
 */
export const REPORT_STYLES = `
:root {
  --bg: #0d1117;
  --fg: #c9d1d9;
  --muted: #8b949e;
  --border: #30363d;
  --accent: #58a6ff;
  --up: #3fb950;
  --down: #f85149;
  --warn: #d29922;
  --mono: ui-monospace, "SF Mono", "Cascadia Code", Consolas, monospace;
}
@media (prefers-color-scheme: light) {
  :root {
    --bg: #ffffff;
    --fg: #24292f;
    --muted: #57606a;
    --border: #d0d7de;
    --accent: #0969da;
    --up: #1a7f37;
    --down: #cf222e;
    --warn: #9a6700;
  }
}
* { box-sizing: border-box; }
body { background: var(--bg); color: var(--fg); font-family: var(--mono); margin: 0; padding: 1.5rem; line-height: 1.5; }
h1, h2, h3 { font-weight: 600; margin: 1.5rem 0 0.75rem; }
h1 { font-size: 1.25rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; }
h2 { font-size: 1.05rem; color: var(--accent); }
.banner { border: 1px solid var(--border); padding: 0.75rem 1rem; margin-bottom: 1rem; }
.banner-label { font-weight: 600; }
.up { color: var(--up); }
.down { color: var(--down); }
.warn { color: var(--warn); }
.muted { color: var(--muted); }
.badge { display: inline-block; border: 1px solid var(--border); padding: 0.1rem 0.4rem; margin-right: 0.3rem; font-size: 0.8rem; }
.badge-promoted { border-color: var(--accent); color: var(--accent); }
.badge-speculative { border-color: var(--warn); color: var(--warn); }
.card { border: 1px solid var(--border); padding: 1rem; margin-bottom: 1rem; }
.card-header { display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 0.5rem; }
.symbol { font-size: 1.1rem; font-weight: 700; }
.flag-row { display: flex; flex-wrap: wrap; gap: 0.75rem 1.5rem; margin: 0.5rem 0; font-size: 0.9rem; }
.flag-item .label { color: var(--muted); }
table { border-collapse: collapse; width: 100%; font-size: 0.9rem; }
th, td { border: 1px solid var(--border); padding: 0.4rem 0.6rem; text-align: left; }
th { color: var(--muted); font-weight: 600; }
tr.promoted { color: var(--accent); }
.event-window { color: var(--warn); }
.sparkline { vertical-align: middle; }
.section { margin-bottom: 2rem; }
ul.plain { list-style: none; padding: 0; margin: 0.5rem 0; }
ul.plain li { padding: 0.2rem 0; border-bottom: 1px solid var(--border); }
`;
