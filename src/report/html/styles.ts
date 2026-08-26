/**
 * TASK_CARD_07 Part C: rebuilt per the project owner's explicit
 * instruction to follow MOCKUP_intel_briefing_v4.html's structure AND
 * visual style (superseding TASK_CARD_05's earlier "no gradient/purple"
 * fallback design, which applied only in the absence of a named design
 * reference - see ai/decisions.md). Dark "intel briefing" aesthetic,
 * single theme (the mockup itself has no light-mode variant and this
 * genre - ops/intel dashboards - is conventionally dark-only by design
 * intent, not an oversight; see ai/decisions.md for this call).
 *
 * --up/--down/--warn/--mono/--fg/--muted/--border/--accent are kept as
 * aliases onto the new token names so sparkline.ts and the still-used
 * .up/.down/.warn/.muted classes keep working unchanged.
 */
export const REPORT_STYLES = `
:root{
  --bg:#0a0e14;--panel:#111720;--panel2:#161d28;--line:#1f2937;
  --ink:#e6edf3;--dim:#8b98a9;--faint:#5a6675;
  --gold:#e0b341;--green:#3fb98a;--red:#e5484d;--blue:#4a90d9;
  --violet:#8b7cf0;--amber:#e0913b;
  --fg:var(--ink);--muted:var(--dim);--border:var(--line);--accent:var(--blue);
  --up:var(--green);--down:var(--red);--warn:var(--amber);
  --mono:ui-monospace,"SF Mono","Cascadia Code",Consolas,monospace;
}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--ink);font-family:'Segoe UI',system-ui,-apple-system,sans-serif;line-height:1.5;padding:32px 20px 80px}
.wrap{max-width:940px;margin:0 auto}
.masthead{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid var(--line);padding-bottom:16px}
.brand{font-size:26px;font-weight:800;letter-spacing:3px}.brand span{color:var(--gold)}
.meta{text-align:right;font-size:12px;color:var(--dim);font-variant-numeric:tabular-nums}.meta b{color:var(--ink)}

.market{background:linear-gradient(160deg,var(--panel2),var(--panel));border:1px solid var(--line);border-radius:12px;padding:20px 22px;margin:22px 0 10px}
.market-h{font-size:11px;letter-spacing:2px;color:var(--faint);text-transform:uppercase;margin-bottom:14px}
.market-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}
.mstat{background:rgba(255,255,255,.02);border:1px solid var(--line);border-radius:8px;padding:11px 13px}
.mstat .k{font-size:10px;color:var(--faint);letter-spacing:.5px;text-transform:uppercase}
.mstat .v{font-size:17px;font-weight:700;margin-top:3px;font-variant-numeric:tabular-nums}
.mstat .s{font-size:11px;margin-top:2px}
.up{color:var(--up)}.down{color:var(--down)}.neu{color:var(--dim)}.warn{color:var(--warn)}.muted{color:var(--muted)}
.market p{font-size:13.5px;line-height:1.7;margin-top:4px}
.anchor{color:var(--blue);border-bottom:1px dotted rgba(74,144,217,.5);cursor:help}
.placeholder{color:var(--faint);font-style:italic}

.seclabel{font-size:11px;letter-spacing:2px;color:var(--faint);text-transform:uppercase;margin:30px 0 12px;display:flex;align-items:center;gap:10px}
.seclabel::after{content:"";flex:1;height:1px;background:var(--line)}

.sectors{display:grid;grid-template-columns:1fr 1fr;gap:11px}
.sec{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:15px 17px;position:relative}
.sec.flow-in{border-left:3px solid var(--green)}
.sec.flow-out{border-left:3px solid var(--red)}
.sec.flow-flat{border-left:3px solid var(--faint)}
.sec-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:9px}
.sec-name{font-size:14px;font-weight:700}
.sec-rank{font-size:10px;color:var(--faint);font-variant-numeric:tabular-nums}
.flowtag{font-size:10px;padding:3px 9px;border-radius:5px;letter-spacing:.5px;font-weight:600}
.flowtag.in{background:rgba(63,185,138,.14);color:var(--green)}
.flowtag.out{background:rgba(229,72,77,.12);color:var(--red)}
.flowtag.flat{background:rgba(90,102,117,.15);color:var(--dim)}
.sec-data{display:flex;gap:14px;flex-wrap:wrap;font-size:11px;color:var(--dim);margin-bottom:9px;font-variant-numeric:tabular-nums}
.sec-data b{color:var(--ink)}
.sec-verdict{font-size:12.5px;line-height:1.6;color:var(--ink)}
.sec-verdict .hl{color:var(--gold)}
.sec-inpool{font-size:10px;color:var(--blue);margin-top:8px;font-family:'Consolas',monospace}
.sec-nopool{font-size:10px;color:var(--faint);margin-top:8px}
.sec-coverage{font-size:10px;color:var(--faint);margin-top:6px}

.theme{background:linear-gradient(160deg,var(--panel2),var(--panel));border:1px solid var(--line);border-left:3px solid var(--violet);border-radius:12px;padding:22px 24px;margin-bottom:18px;position:relative;overflow:hidden}
.theme::before{content:"";position:absolute;top:-40px;right:-40px;width:160px;height:160px;background:radial-gradient(circle,rgba(139,124,240,.12),transparent 70%)}
.theme-tag{font-size:10px;letter-spacing:1.5px;color:var(--violet);text-transform:uppercase;margin-bottom:6px;font-weight:600;position:relative}
.theme-name{font-size:19px;font-weight:700;position:relative}
.strength{display:inline-block;font-size:10px;padding:2px 8px;border-radius:4px;margin-left:10px;vertical-align:middle}
.strength.strong{background:rgba(63,185,138,.15);color:var(--green)}
.strength.mid{background:rgba(224,145,59,.15);color:var(--amber)}
.strength.weak{background:rgba(90,102,117,.18);color:var(--dim)}
.cycle{margin:16px 0}.cycle-track{display:flex;gap:4px}
.cycle-seg{flex:1;height:6px;border-radius:3px;background:var(--line)}.cycle-seg.on{background:var(--violet)}
.cycle-labels{display:flex;justify-content:space-between;margin-top:7px;font-size:10px;color:var(--faint)}
.cycle-labels .active{color:var(--violet);font-weight:700}
.footprints{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}
.fp{background:rgba(255,255,255,.03);border:1px solid var(--line);border-radius:7px;padding:8px 12px;font-size:12px;color:var(--dim);display:flex;gap:8px;align-items:center}
.fp b{color:var(--ink)}.fp .ic{color:var(--green)}
.members{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}
.tik{font-family:'Consolas',monospace;font-size:12px;background:var(--bg);border:1px solid var(--line);border-radius:6px;padding:4px 9px;color:var(--blue);font-weight:600}
.verdict{background:rgba(224,179,65,.06);border:1px solid rgba(224,179,65,.25);border-radius:9px;padding:15px 17px;margin-top:16px}
.verdict-h{font-size:10px;letter-spacing:2px;color:var(--gold);text-transform:uppercase;margin-bottom:8px}
.verdict p{font-size:14px;line-height:1.7}
.anchor-g{color:var(--gold);border-bottom:1px dotted rgba(224,179,65,.5);cursor:help}

.cand{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px 18px;margin-bottom:11px;display:grid;grid-template-columns:auto 1fr auto;gap:16px;align-items:center}
.grade{font-size:22px;font-weight:800;width:52px;height:52px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-family:'Consolas',monospace}
.g-b{background:rgba(63,185,138,.12);color:var(--green);border:1px solid rgba(63,185,138,.3)}
.g-na{background:rgba(90,102,117,.12);color:var(--faint);border:1px solid var(--line);font-size:11px}
.cand-mid .tk{font-family:'Consolas',monospace;font-size:16px;font-weight:700}
.cand-mid .nm{font-size:12px;color:var(--dim);margin-left:8px}
.cand-mid .desc{font-size:12.5px;color:var(--dim);margin-top:5px;line-height:1.6}
.badges{display:flex;gap:6px;margin-top:7px;flex-wrap:wrap}
.bdg{font-size:10px;padding:3px 8px;border-radius:5px;letter-spacing:.5px}
.bdg.bucket{background:rgba(139,124,240,.12);color:var(--violet)}
.bdg.event{background:rgba(224,145,59,.12);color:var(--amber)}
.bdg.sector{background:rgba(74,144,217,.12);color:var(--blue)}
.bdg.promoted{background:rgba(63,185,138,.14);color:var(--green)}
.bdg.speculative{background:rgba(229,72,77,.12);color:var(--red)}
.cand-right{text-align:right;font-size:11px;color:var(--faint);min-width:110px}
.scorebar{display:flex;gap:3px;margin-top:5px;justify-content:flex-end}
.scorebar i{width:14px;height:4px;border-radius:2px;background:var(--line);display:inline-block}.scorebar i.on{background:var(--green)}
.prob{font-size:19px;font-weight:700;color:var(--ink);font-variant-numeric:tabular-nums}
.prob small{font-size:11px;color:var(--faint);font-weight:400}
.watch{background:var(--panel);border:1px solid var(--line);border-radius:10px;overflow:hidden}
.wrow{display:grid;grid-template-columns:auto auto 1fr auto;gap:14px;align-items:center;padding:11px 16px;border-bottom:1px solid var(--line);font-size:13px}
.wrow:last-child{border-bottom:none}
.wrow .wtk{font-family:'Consolas',monospace;font-weight:700;color:var(--blue)}
.wrow .wbucket{font-size:10px;color:var(--violet)}.wrow .wdesc{color:var(--dim);font-size:12px}
.wrow .wtrig{font-size:11px;color:var(--faint);text-align:right}
.promo{color:var(--green);font-size:10px;font-weight:700}
.excl-note{font-size:12px;color:var(--faint);background:var(--panel);border:1px dashed var(--line);border-radius:8px;padding:11px 15px;margin-bottom:11px}
.excl-note b{color:var(--red)}
.forecast{background:linear-gradient(160deg,rgba(139,124,240,.08),var(--panel));border:1px solid rgba(139,124,240,.3);border-radius:12px;padding:24px 26px;margin-top:26px}
.forecast-h{font-size:11px;letter-spacing:2px;color:var(--violet);text-transform:uppercase;margin-bottom:14px}
.forecast p{font-size:14.5px;line-height:1.8;margin-bottom:12px}
.forecast .lead{font-size:16.5px;font-weight:600}
.forecast .sub{font-size:11px;letter-spacing:1px;color:var(--violet);text-transform:uppercase;margin:18px 0 8px;font-weight:600}
.watchitems{list-style:none}
.watchitems li{font-size:13.5px;line-height:1.7;padding:7px 0 7px 24px;position:relative}
.watchitems li::before{content:"→";position:absolute;left:0;color:var(--violet);font-weight:700}
.disc{font-size:11px;color:var(--faint);margin-top:16px;padding-top:12px;border-top:1px solid var(--line);line-height:1.6}
.flowline{display:grid;grid-template-columns:auto 1fr auto auto auto;gap:12px;align-items:center;padding:10px 16px;border-bottom:1px solid var(--line);font-size:12.5px;font-variant-numeric:tabular-nums}
.flowline:last-child{border-bottom:none}
.flowline .fr{font-family:'Consolas',monospace;color:var(--faint);font-size:11px;width:16px}
.flowline .fn{font-weight:600}
.flowline .star{font-size:9px;color:var(--violet);margin-left:6px}
.flowline .fp2{text-align:right;font-weight:600}
.flowline .fd{text-align:right;color:var(--dim);font-size:11px}
.flowline .fd.hot{color:var(--violet);font-weight:700}
.flowline .ff{text-align:right;font-size:10px;padding:2px 8px;border-radius:4px;min-width:44px;font-weight:600}
.flowline .ff.in{background:rgba(63,185,138,.14);color:var(--green)}
.flowline .ff.out{background:rgba(229,72,77,.12);color:var(--red)}
.flowline .ff.flat{background:rgba(90,102,117,.13);color:var(--dim)}
.flowline[data-f="in"]{border-left:2px solid var(--green)}
.flowline[data-f="out"]{border-left:2px solid var(--red)}
.flowline[data-f="flat"]{border-left:2px solid transparent}

.ledger-panel{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px 18px;margin-bottom:11px}
ul.plain{list-style:none;padding:0;margin:0.5rem 0}
ul.plain li{padding:6px 0;border-bottom:1px solid var(--line);font-size:12.5px}
ul.plain li:last-child{border-bottom:none}

table{border-collapse:collapse;width:100%;font-size:.9rem}
th,td{border:1px solid var(--line);padding:.4rem .6rem;text-align:left}
th{color:var(--muted);font-weight:600}

.sparkline{vertical-align:middle}
.footer{text-align:center;font-size:11px;color:var(--faint);margin-top:40px;letter-spacing:1px}
`;
