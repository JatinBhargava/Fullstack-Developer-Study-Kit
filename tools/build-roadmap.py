#!/usr/bin/env python3
"""Build roadmap.html — the AI Engineering Roadmap — from tools/roadmap.txt.

Run from the repo root after editing the outline:

    python3 tools/build-roadmap.py && python3 tools/build-search-index.py

Outline format, one entry per line:
    Part I — Title          a part
    1. Chapter title        a chapter
    1.1. Topic title        a topic; "1.1" is its stable id, used as the
                            progress key in localStorage and in Postgres,
                            so renumbering a topic orphans its progress.
"""
import html
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "tools", "roadmap.txt")
OUT = os.path.join(ROOT, "roadmap.html")
E = html.escape


def parse():
    parts = []
    for raw in open(SRC, encoding="utf-8"):
        line = raw.strip()
        if not line:
            continue
        m = re.match(r"^Part ([IVXLC]+) — (.+)$", line)
        if m:
            parts.append({"n": m.group(1), "t": m.group(2), "chs": []})
            continue
        m = re.match(r"^(\d+)\.(\d+)\. (.+)$", line)
        if m:
            ch = parts[-1]["chs"][-1]
            assert m.group(1) == ch["n"], line
            ch["tps"].append({"id": m.group(1) + "." + m.group(2), "t": m.group(3)})
            continue
        m = re.match(r"^(\d+)\. (.+)$", line)
        if m:
            parts[-1]["chs"].append({"n": m.group(1), "t": m.group(2), "tps": []})
            continue
        raise SystemExit("Cannot parse: " + line)
    return parts


def tid(t):
    return "t-" + t["id"].replace(".", "-")


def render(parts):
    n_tp = sum(len(c["tps"]) for p in parts for c in p["chs"])
    n_ch = sum(len(p["chs"]) for p in parts)

    toc = []
    for i, p in enumerate(parts, 1):
        links = "".join(
            '<a href="#ch-%s"><span class="toc__n">%s</span><span class="toc__t">%s</span>'
            '<b data-tocc="%s">0/%d</b></a>' % (c["n"], c["n"], E(c["t"]), c["n"], len(c["tps"]))
            for c in p["chs"])
        toc.append('<div class="toc__p" style="--c:var(--p%d)"><h3><span>Part %s</span>%s</h3>%s</div>'
                   % (i, p["n"], E(p["t"]), links))

    body = []
    for i, p in enumerate(parts, 1):
        tp_in_part = sum(len(c["tps"]) for c in p["chs"])
        body.append('<section class="part" id="part-%d" style="--c:var(--p%d)">'
                    '<header class="part__hd"><span class="part__n">Part %s</span><h2>%s</h2>'
                    '<span class="part__c" data-partc="%d">0 / %d</span></header>'
                    % (i, i, p["n"], E(p["t"]), i, tp_in_part))
        for c in p["chs"]:
            rows = "".join(
                '<li class="tp" id="%s" data-t="%s" data-s="0">'
                '<button class="st" type="button" data-t="%s" aria-label="%s %s: not started"><i></i></button>'
                '<span class="tp__n">%s</span><span class="tp__t">%s</span><span class="tp__s"></span>'
                '<button class="nb" type="button" data-t="%s" aria-expanded="false">Note</button></li>'
                % (tid(t), t["id"], t["id"], t["id"], E(t["t"], quote=True), t["id"], E(t["t"]), t["id"])
                for t in c["tps"])
            body.append(
                '<section class="ch" id="ch-%s" data-ch="%s">'
                '<div class="ch__hd"><h3><button class="ch__tg" type="button" aria-expanded="true" aria-controls="chb-%s">'
                '<span class="ch__n">%s</span><span class="ch__t">%s</span></button></h3>'
                '<span class="ch__c" data-chc="%s">0/%d</span><span class="mini"><i data-chm="%s"></i></span></div>'
                '<ol class="tps" id="chb-%s">%s</ol></section>'
                % (c["n"], c["n"], c["n"], c["n"].zfill(2), E(c["t"]), c["n"], len(c["tps"]), c["n"], c["n"], rows))
        body.append("</section>")

    return (TEMPLATE
            .replace("{{N_TP}}", str(n_tp))
            .replace("{{N_TP_FMT}}", "{:,}".format(n_tp))
            .replace("{{N_CH}}", str(n_ch))
            .replace("{{N_PART}}", str(len(parts)))
            .replace("{{TOC}}", "".join(toc))
            .replace("{{BODY}}", "".join(body)))


TEMPLATE = r"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AI Engineering Roadmap</title><meta name="description" content="{{N_TP_FMT}} topics across {{N_CH}} chapters, from Spring Boot and RAG through agents, MCP, machine learning and production operations. Sign in to keep your progress in your account."><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Zilla+Slab:wght@400;500;600&family=Source+Sans+3:wght@400;600&family=IBM+Plex+Mono:wght@400;500&display=swap"><style>
:root{
  --paper:#F4F5F1; --surface:#FCFCFA; --sunk:#EDEFE9;
  --ink:#191D19; --ink-2:#3D433C; --muted:#63695F; --faint:#8A9084;
  --rule:#DDE0D7; --rule-soft:#E7E9E2;
  --p1:#1B6E75; --p2:#2F5FA6; --p3:#7A4A9E; --p4:#8C5A16; --p5:#B4541A;
  --signal:#B4541A; --done:#2E6A4E; --done-bg:#2E6A4E14; --prog:#9A6B00; --err:#A8322A;
}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){
    --paper:#151813; --surface:#1C1F1A; --sunk:#212520;
    --ink:#E9EBE3; --ink-2:#C4C8BC; --muted:#969C8E; --faint:#6E7468;
    --rule:#2E322B; --rule-soft:#262A24;
    --p1:#5CB2B9; --p2:#7FA7E3; --p3:#BFA0E8; --p4:#D9A557; --p5:#E2914F;
    --signal:#E2914F; --done:#63B78D; --done-bg:#63B78D18; --prog:#E0B54F; --err:#EE8A80;
  }
}
:root[data-theme="dark"]{
  --paper:#151813; --surface:#1C1F1A; --sunk:#212520;
  --ink:#E9EBE3; --ink-2:#C4C8BC; --muted:#969C8E; --faint:#6E7468;
  --rule:#2E322B; --rule-soft:#262A24;
  --p1:#5CB2B9; --p2:#7FA7E3; --p3:#BFA0E8; --p4:#D9A557; --p5:#E2914F;
  --signal:#E2914F; --done:#63B78D; --done-bg:#63B78D18; --prog:#E0B54F; --err:#EE8A80;
}
*{box-sizing:border-box}
body{margin:0; background:var(--paper); color:var(--ink);
  font-family:"Source Sans 3","Segoe UI",system-ui,sans-serif; font-size:16px; line-height:1.55; -webkit-font-smoothing:antialiased}
h1,h2,h3,h4{font-family:"Zilla Slab",Georgia,serif; font-weight:600; text-wrap:balance; margin:0; line-height:1.2}
p{margin:0}
.wrap{max-width:1260px; margin:0 auto; padding:0 28px}
@media (max-width:640px){.wrap{padding:0 16px}}
:where(a,button,input,textarea,summary):focus-visible{outline:2px solid var(--signal); outline-offset:3px; border-radius:2px}
.mono{font-family:"IBM Plex Mono",ui-monospace,monospace}

.mast{border-bottom:2px solid var(--ink); background:var(--surface)}
.mast__in{display:flex; flex-wrap:wrap; gap:32px; align-items:flex-end; justify-content:space-between; padding:44px 28px 24px; max-width:1260px; margin:0 auto}
@media (max-width:640px){.mast__in{padding:30px 16px 20px; gap:22px}}
.mast__id{max-width:60ch; display:flex; flex-direction:column; gap:10px}
.eyebrow{font-family:"IBM Plex Mono",ui-monospace,monospace; font-size:11px; letter-spacing:.16em; text-transform:uppercase; color:var(--muted)}
.mast h1{font-size:clamp(2.1rem,4.6vw,3.1rem); letter-spacing:-.015em}
.mast__sub{color:var(--ink-2); font-size:1.02rem}
.totals{display:flex; gap:26px; align-items:flex-end; flex-wrap:wrap}
.total{display:flex; flex-direction:column; gap:3px; min-width:92px}
.total__n{font-family:"IBM Plex Mono",ui-monospace,monospace; font-variant-numeric:tabular-nums; font-size:1.9rem; line-height:1}
.total__n small{font-size:.9rem; color:var(--faint)}
.total__l{font-family:"IBM Plex Mono",ui-monospace,monospace; font-size:10px; letter-spacing:.13em; text-transform:uppercase; color:var(--muted)}

.bar{position:sticky; top:0; z-index:20; background:var(--surface); border-bottom:1px solid var(--rule)}
.bar__in{display:flex; gap:12px 18px; align-items:center; justify-content:space-between; padding:9px 28px; max-width:1260px; margin:0 auto; flex-wrap:wrap}
@media (max-width:640px){.bar{position:static} .bar__in{padding:8px 16px}}
.bar__l{display:flex; align-items:center; gap:14px; min-width:0; flex-wrap:wrap}
.bar__pct{font-family:"IBM Plex Mono",ui-monospace,monospace; font-size:.8rem; color:var(--muted); white-space:nowrap}
.meter{display:block; width:min(220px,30vw); height:6px; background:var(--sunk); border:1px solid var(--rule); overflow:hidden}
.meter i{display:block; height:100%; width:0; background:var(--done); transition:width .35s ease}
.bar__cur{font-family:"IBM Plex Mono",ui-monospace,monospace; font-size:.72rem; letter-spacing:.06em;
  color:var(--faint); text-decoration:none; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:34ch}
.bar__cur b{color:var(--p1); font-weight:400}
.bar__cur:hover{color:var(--ink)}
.bar__r{display:flex; align-items:center; gap:8px; flex-wrap:wrap}
.btn{font-family:"IBM Plex Mono",ui-monospace,monospace; font-size:11px; letter-spacing:.08em; text-transform:uppercase; padding:6px 12px;
  background:transparent; color:var(--ink-2); border:1px solid var(--rule); cursor:pointer; text-decoration:none; display:inline-block}
.btn:hover{border-color:var(--ink-2); color:var(--ink)}
.btn[hidden]{display:none}
.btn[disabled]{opacity:.5; cursor:default}
.btn--pri{background:var(--ink); color:var(--surface); border-color:var(--ink)}
.btn--pri:hover{color:var(--surface); opacity:.88}
.btn.is-armed{border-color:var(--err); color:var(--err)}

.libs{display:inline-flex; gap:6px; align-items:center}
.gh{display:inline-flex; align-items:center; gap:6px; padding:5px 10px;
  font-family:"IBM Plex Mono",ui-monospace,monospace; font-size:10px;
  letter-spacing:.1em; text-transform:uppercase; text-decoration:none;
  color:var(--ink-2); border:1px solid var(--rule)}
.gh:hover{border-color:var(--ink-2); color:var(--ink)}
.gh svg{width:13px; height:13px; fill:currentColor; flex:none}
@media (max-width:640px){ .gh span{display:none} .gh{padding:5px 8px} }
.lib{position:relative; display:inline-block}
.lib__btn{font-family:"IBM Plex Mono",ui-monospace,monospace; font-size:10px; letter-spacing:.1em;
  text-transform:uppercase; padding:5px 11px; background:transparent; color:var(--ink-2);
  border:1px solid var(--rule); cursor:pointer; display:inline-flex; align-items:center; gap:7px}
.lib__btn:hover{border-color:var(--ink-2); color:var(--ink)}
.lib__btn[aria-expanded="true"]{border-color:var(--ink-2); color:var(--ink)}
.lib__btn[data-here="1"]{border-color:var(--ink-2); color:var(--ink); box-shadow:inset 0 -2px 0 var(--ink-2)}
.lib__btn i{font-style:normal; font-size:8px; opacity:.6}
.lib__menu{position:absolute; top:calc(100% + 6px); right:0; z-index:80; min-width:250px;
  background:var(--surface); border:1px solid var(--rule); box-shadow:0 8px 28px #00000022;
  display:flex; flex-direction:column; padding:5px}
.lib__menu[hidden]{display:none}
.lib__menu a{display:flex; flex-direction:column; gap:2px; padding:8px 11px; text-decoration:none; color:var(--ink); font-size:.92rem}
.lib__menu a span{font-family:"IBM Plex Mono",ui-monospace,monospace; font-size:9.5px; letter-spacing:.08em; text-transform:uppercase; color:var(--muted)}
.lib__menu a:hover{background:var(--sunk)}
.lib__menu a[aria-current="page"]{color:var(--faint); cursor:default}
.lib__menu a[aria-current="page"]:hover{background:transparent}
@media (max-width:640px){ .lib__menu{right:auto; left:0; min-width:200px} }

/* ---- account ---------------------------------------------------------- */
.acct{display:inline-flex; align-items:center; gap:8px}
.sync{display:inline-flex; align-items:center; gap:7px; font-family:"IBM Plex Mono",ui-monospace,monospace; font-size:.72rem;
  letter-spacing:.04em; color:var(--muted); white-space:nowrap; max-width:30ch; overflow:hidden; text-overflow:ellipsis}
.sync::before{content:""; width:7px; height:7px; border-radius:50%; background:var(--faint); flex:none}
.sync[data-state="saved"]::before{background:var(--done)}
.sync[data-state="saving"]::before{background:var(--prog)}
.sync[data-state="offline"]::before{background:var(--signal)}
.sync[data-state="error"]::before{background:var(--err)}
.sync[data-state="error"]{color:var(--err)}

.intro{padding:34px 0 30px; border-bottom:1px solid var(--rule)}
.intro__g{display:grid; grid-template-columns:1.3fr 1fr; gap:44px; align-items:start}
@media (max-width:900px){.intro__g{grid-template-columns:1fr; gap:26px}}
.intro h2{font-size:1.35rem; margin-bottom:12px}
.intro p{color:var(--ink-2); font-size:.97rem; margin-bottom:11px; max-width:70ch}
.legend{display:flex; flex-wrap:wrap; gap:8px 22px; margin-top:6px; font-size:.88rem; color:var(--muted)}
.legend span{display:inline-flex; align-items:center; gap:8px}
.card{border:1px solid var(--rule); background:var(--surface); padding:20px 22px; display:flex; flex-direction:column; gap:12px}
.card h3{font-size:1.12rem}
.card p{font-size:.93rem; color:var(--ink-2); margin:0}
.card .who{font-family:"IBM Plex Mono",ui-monospace,monospace; font-size:.85rem; color:var(--ink); word-break:break-all}
.card__btns{display:flex; gap:8px; flex-wrap:wrap}
.card__fine{font-size:.82rem !important; color:var(--muted) !important}

.tools{display:flex; flex-wrap:wrap; gap:10px 18px; align-items:center; justify-content:space-between; padding:18px 0}
.seg{display:inline-flex; border:1px solid var(--rule)}
.seg button{font-family:"IBM Plex Mono",ui-monospace,monospace; font-size:10.5px; letter-spacing:.08em; text-transform:uppercase;
  padding:6px 12px; background:transparent; border:0; border-right:1px solid var(--rule); color:var(--muted); cursor:pointer}
.seg button:last-child{border-right:0}
.seg button[aria-pressed="true"]{background:var(--ink); color:var(--surface)}
.tools__r{display:flex; gap:8px; flex-wrap:wrap}

.toc{display:grid; grid-template-columns:repeat(auto-fill,minmax(230px,1fr)); gap:0; border-top:1px solid var(--rule); border-left:1px solid var(--rule); margin-bottom:10px}
.toc__p{border-right:1px solid var(--rule); border-bottom:1px solid var(--rule); background:var(--surface); padding:14px 14px 10px; display:flex; flex-direction:column}
.toc__p h3{font-size:1rem; margin-bottom:8px; display:flex; flex-direction:column; gap:3px}
.toc__p h3 span{font-family:"IBM Plex Mono",ui-monospace,monospace; font-size:9.5px; letter-spacing:.14em; text-transform:uppercase; color:var(--c); font-weight:400}
.toc__p a{display:grid; grid-template-columns:22px 1fr auto; gap:6px; align-items:baseline; padding:3px 0; text-decoration:none; color:var(--ink-2); font-size:.86rem; line-height:1.35}
.toc__p a:hover .toc__t{color:var(--ink); text-decoration:underline; text-underline-offset:2px}
.toc__n{font-family:"IBM Plex Mono",ui-monospace,monospace; font-size:.72rem; color:var(--faint)}
.toc__p a b{font-family:"IBM Plex Mono",ui-monospace,monospace; font-size:.7rem; font-weight:400; color:var(--faint); font-variant-numeric:tabular-nums}
.toc__p a.is-full b,.toc__p a.is-full .toc__n{color:var(--done)}

/* ---- parts, chapters, topics ------------------------------------------ */
.parts{padding:6px 0 60px}
.part{padding-top:40px}
.part__hd{display:flex; flex-wrap:wrap; gap:6px 16px; align-items:baseline; border-bottom:2px solid var(--ink); padding-bottom:9px}
.part__n{font-family:"IBM Plex Mono",ui-monospace,monospace; font-size:10px; letter-spacing:.16em; text-transform:uppercase; color:var(--c)}
.part__hd h2{font-size:1.6rem; letter-spacing:-.01em; flex:1 1 auto}
.part__c{font-family:"IBM Plex Mono",ui-monospace,monospace; font-size:.78rem; color:var(--muted); font-variant-numeric:tabular-nums}
.ch{border-bottom:1px solid var(--rule); scroll-margin-top:70px}
.ch.is-hidden,.tp.is-hidden{display:none}
.ch__hd{display:flex; align-items:center; gap:14px; padding:14px 0}
.ch__hd h3{flex:1 1 auto; min-width:0; font-size:1.12rem}
.ch__tg{display:flex; align-items:baseline; gap:14px; width:100%; background:transparent; border:0; padding:0; cursor:pointer; color:var(--ink); font:inherit; text-align:left}
.ch__tg::before{content:"\25BE"; font-size:.8rem; color:var(--faint); width:10px; flex:none; transition:transform .15s}
.ch__tg[aria-expanded="false"]::before{transform:rotate(-90deg)}
.ch__n{font-family:"IBM Plex Mono",ui-monospace,monospace; font-size:.85rem; font-weight:400; color:var(--c); flex:none}
.ch__tg:hover .ch__t{text-decoration:underline; text-underline-offset:3px; text-decoration-thickness:1px}
.ch__c{font-family:"IBM Plex Mono",ui-monospace,monospace; font-size:.75rem; color:var(--faint); font-variant-numeric:tabular-nums; white-space:nowrap}
.ch.is-full .ch__c{color:var(--done)}
.mini{display:block; width:80px; height:4px; background:var(--sunk); overflow:hidden; flex:none}
.mini i{display:block; height:100%; width:0; background:var(--done); transition:width .3s}
@media (max-width:640px){.mini{display:none} .ch__hd{gap:10px}}

.tps{list-style:none; margin:0 0 14px; padding:0 0 0 24px}
.tps[hidden]{display:none}
@media (max-width:640px){.tps{padding-left:0}}
.tp{display:grid; grid-template-columns:auto 46px 1fr auto auto; gap:4px 12px; align-items:center; padding:6px 8px; border-top:1px solid var(--rule-soft); scroll-margin-top:96px}
.tp:first-child{border-top:0}
.tp:hover{background:var(--surface)}
.tp[data-s="2"]{background:var(--done-bg)}
.tp__n{font-family:"IBM Plex Mono",ui-monospace,monospace; font-size:.76rem; color:var(--faint); font-variant-numeric:tabular-nums}
.tp__t{font-size:.97rem; color:var(--ink)}
.tp[data-s="2"] .tp__t{color:var(--ink-2)}
.tp[data-s="1"] .tp__t{font-weight:600}
.tp__s{font-family:"IBM Plex Mono",ui-monospace,monospace; font-size:9.5px; letter-spacing:.12em; text-transform:uppercase; white-space:nowrap}
.tp[data-s="1"] .tp__s{color:var(--prog)}
.tp[data-s="2"] .tp__s{color:var(--done)}
@media (max-width:640px){.tp{grid-template-columns:auto 40px 1fr auto; padding:7px 4px} .tp__s{display:none}}

.st{background:transparent; border:0; padding:4px; margin:-4px; cursor:pointer; line-height:0}
.st i,.legend i{display:inline-block; width:17px; height:17px; border:1.5px solid var(--c); position:relative; background:transparent}
.tp[data-s="1"] .st i,.legend .l1{background:linear-gradient(90deg,var(--prog) 50%,transparent 50%); border-color:var(--prog)}
.tp[data-s="2"] .st i,.legend .l2{background:var(--done); border-color:var(--done)}
.tp[data-s="2"] .st i::after,.legend .l2::after{content:""; position:absolute; left:4.5px; top:1px; width:4px; height:8px;
  border:solid var(--surface); border-width:0 2px 2px 0; transform:rotate(45deg)}
.legend i{--c:var(--muted)}

.nb{font-family:"IBM Plex Mono",ui-monospace,monospace; font-size:9.5px; letter-spacing:.1em; text-transform:uppercase;
  background:transparent; border:1px solid transparent; color:var(--faint); padding:3px 7px; cursor:pointer}
.tp:hover .nb,.nb:focus-visible,.nb[aria-expanded="true"]{border-color:var(--rule); color:var(--ink-2)}
.nb.has-note{color:var(--c); border-color:var(--rule)}
.nb.has-note::after{content:" \2022"}
.tp__note{grid-column:2 / -1; padding:4px 0 6px}
.tp__note textarea{width:100%; min-height:84px; resize:vertical; font:inherit; font-size:.92rem; line-height:1.5; color:var(--ink);
  background:var(--surface); border:1px solid var(--rule); padding:8px 10px}
.tp__note small{display:block; font-family:"IBM Plex Mono",ui-monospace,monospace; font-size:.68rem; color:var(--faint); margin-top:3px}
@keyframes gsflash{from{background:var(--done-bg); box-shadow:inset 3px 0 0 var(--signal)}to{box-shadow:inset 3px 0 0 transparent}}
.gs-flash{animation:gsflash 1.6s ease-out}

/* ---- dialog ----------------------------------------------------------- */
dialog.auth{border:1px solid var(--rule); background:var(--surface); color:var(--ink); padding:0; width:min(420px,calc(100vw - 32px)); box-shadow:0 18px 60px #00000040}
dialog.auth::backdrop{background:#0008}
.auth form{display:flex; flex-direction:column; gap:14px; padding:24px 24px 22px}
.auth h2{font-size:1.4rem}
.auth p{font-size:.92rem; color:var(--ink-2)}
.auth label{display:flex; flex-direction:column; gap:5px; font-family:"IBM Plex Mono",ui-monospace,monospace; font-size:10.5px; letter-spacing:.1em; text-transform:uppercase; color:var(--muted)}
.auth input{font:inherit; font-family:"Source Sans 3","Segoe UI",system-ui,sans-serif; font-size:1rem; letter-spacing:0; text-transform:none; color:var(--ink);
  background:var(--paper); border:1px solid var(--rule); padding:9px 11px}
.auth input:focus{border-color:var(--ink-2); outline:none}
.auth__err{color:var(--err) !important; font-size:.9rem}
.auth__err:empty{display:none}
.auth__row{display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap}
.linkbtn{background:transparent; border:0; padding:0; color:var(--p2); font:inherit; font-size:.9rem; cursor:pointer; text-decoration:underline; text-underline-offset:2px}
.gbtn{display:flex; align-items:center; justify-content:center; gap:10px; padding:10px 14px; background:#fff; color:#1f1f1f; border:1px solid #747775;
  font-size:.98rem; font-weight:600; text-decoration:none}
.gbtn[hidden]{display:none}
.gbtn:hover{background:#f2f2f2}
.auth__or{display:flex; align-items:center; gap:10px; font-size:.8rem !important; color:var(--muted) !important}
.auth__or[hidden]{display:none}
.auth__or::before,.auth__or::after{content:""; flex:1; border-top:1px solid var(--rule)}
.auth__x{position:absolute; top:10px; right:12px; background:transparent; border:0; color:var(--muted); font-size:1.4rem; line-height:1; cursor:pointer; padding:4px 8px}

.foot{border-top:2px solid var(--ink); background:var(--surface); padding:26px 0 44px}
.foot p{color:var(--muted); font-size:.87rem; max-width:74ch}
.madeby{font-family:"IBM Plex Mono",ui-monospace,monospace; font-size:10px;
  letter-spacing:.12em; text-transform:uppercase; color:var(--faint);
  margin-top:18px; padding-top:14px; border-top:1px solid var(--rule-soft)}
</style></head><body>
<header class="mast"><div class="mast__in"><div class="mast__id"><span class="eyebrow">Roadmap &middot; {{N_PART}} parts &middot; {{N_CH}} chapters</span><h1>AI Engineering Roadmap</h1><p class="mast__sub">From a Spring Boot service on Postgres to agents, MCP servers, classical machine learning and the work of running all of it in production. {{N_TP_FMT}} topics, each one tracked.</p></div><div class="totals"><div class="total"><span class="total__n" id="tot-done">0<small>/{{N_TP}}</small></span><span class="total__l">Topics done</span></div><div class="total"><span class="total__n" id="tot-prog">0</span><span class="total__l">In progress</span></div><div class="total"><span class="total__n" id="tot-ch">0<small>/{{N_CH}}</small></span><span class="total__l">Chapters done</span></div></div></div></header>
<nav class="bar"><div class="bar__in"><div class="bar__l"><span class="bar__pct" id="pct">0 / {{N_TP}} &middot; 0%</span><span class="meter"><i id="meter"></i></span><a class="bar__cur" id="curlink" href="#t-1-1">Next: <b>1.1</b></a></div><div class="bar__r"><span class="acct"><span class="sync" id="sync" role="status" aria-live="polite">Loading&hellip;</span><button class="btn" type="button" id="signin" hidden>Sign in</button><button class="btn" type="button" id="signout" hidden>Sign out</button></span><button class="btn gs-btn" type="button" data-gsearch aria-label="Search everything (Ctrl+K)">Search <kbd>/</kbd></button><div class="libs"><div class="lib"><button class="lib__btn" type="button" aria-expanded="false" aria-haspopup="true" data-here="1">Ledgers <i>&#9660;</i></button><div class="lib__menu" hidden><a href="index.html">90-Day Ledger<span>daily drill, 270 answers</span></a><a href="platform.html">Platform Ledger<span>60 days, 180 answers</span></a><a href="aiplan.html">AI Engineering Weekly Log<span>22 weeks, 22 projects</span></a><a href="#" aria-current="page" onclick="return false">AI Engineering Roadmap<span>{{N_TP}} topics, {{N_CH}} chapters</span></a><a href="syllabus.html">Software Engineer Syllabus<span>1,332 topics, 10 tracks</span></a></div></div><div class="lib"><button class="lib__btn" type="button" aria-expanded="false" aria-haspopup="true">Guides <i>&#9660;</i></button><div class="lib__menu" hidden><a href="java.html">Java Ground Up<span>56 chapters</span></a><a href="systemdesign.html">System Design Ground Up<span>58 chapters</span></a><a href="typescript.html">TypeScript &amp; React<span>62 chapters</span></a><a href="ai.html">AI Engineering<span>83 chapters</span></a><a href="kubernetes.html">Docker &amp; Kubernetes<span>58 chapters</span></a><a href="aws.html">AWS<span>60 chapters</span></a><a href="db.html">Databases Ground Up<span>66 chapters</span></a><a href="math.html">Mathematics Ground Up<span>69 chapters</span></a><a href="cp.html">Codeforces Ladders<span>2,400 problems</span></a></div></div><a class="gh" href="https://github.com/JatinBhargava" target="_blank" rel="noopener noreferrer" aria-label="GitHub profile"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.011.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg><span>GitHub</span></a></div><button class="btn" type="button" id="export">Export</button><button class="btn" type="button" id="theme">Theme</button></div></div></nav>
<main>
<section class="intro"><div class="wrap intro__g"><div><h2>How to use it</h2><p>Work through the roadmap in order. Parts I to III build one system &mdash; a document-grounded health assistant with an agent and an MCP server in front of it &mdash; and Parts IV and V add the machine learning and production work around it.</p><p>Click the box beside a topic to move it from <em>not started</em> to <em>in progress</em> to <em>done</em>. Every topic also takes a note: what you built, the link, or what you still do not understand.</p><div class="legend"><span><i></i>Not started</span><span><i class="l1"></i>In progress</span><span><i class="l2"></i>Done</span></div></div><div class="card" id="acctcard" aria-live="polite"></div></div></section>
<div class="wrap">
<div class="tools"><div class="seg" role="group" aria-label="Show topics"><button type="button" data-f="all" aria-pressed="true">All</button><button type="button" data-f="0" aria-pressed="false">Not started</button><button type="button" data-f="1" aria-pressed="false">In progress</button><button type="button" data-f="2" aria-pressed="false">Done</button></div><div class="tools__r"><button class="btn" type="button" id="expand">Expand all</button><button class="btn" type="button" id="collapse">Collapse all</button></div></div>
<nav class="toc" aria-label="Chapters">{{TOC}}</nav>
<div class="parts" id="parts">{{BODY}}</div>
</div>
</main>
<dialog class="auth" id="auth" aria-labelledby="auth-h"><form id="authf" novalidate><button class="auth__x" type="button" id="auth-x" aria-label="Close">&times;</button><h2 id="auth-h">Sign in</h2><p id="auth-p">Your topic progress and notes are saved to your account, so they follow you to any browser.</p><a class="gbtn" id="auth-google" href="/api/auth/google/start?next=%2Froadmap.html" hidden><svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg><span>Continue with Google</span></a><p class="auth__or" id="auth-or" hidden>or with email</p><label>Email<input type="email" name="email" id="auth-email" autocomplete="email" required maxlength="254"></label><label>Password<input type="password" name="password" id="auth-pw" autocomplete="current-password" required minlength="8" maxlength="200"></label><p class="auth__err" id="auth-err" role="alert"></p><div class="auth__row"><button class="btn btn--pri" type="submit" id="auth-go">Sign in</button><button class="linkbtn" type="button" id="auth-sw">No account? Create one</button></div></form></dialog>
<footer class="foot"><div class="wrap"><p>Signed in, progress is stored in Postgres and synced a moment after each change; if you go offline, changes wait in this browser and are sent when the connection comes back. Signed out, progress stays in this browser only.</p><p class="madeby">Made By Jatin Bhargava &middot; <span data-year>2026</span></p><script defer src="/_vercel/insights/script.js"></script></div></footer>
<script>
(function(){
  "use strict";
  var GUEST="ai-roadmap.guest.v1", CACHE="ai-roadmap.cache.v1", PEND="ai-roadmap.pending.v1.", UI="ai-roadmap.ui.v1";
  var LABEL=["not started","in progress","done"];

  function load(k,d){ try{ var v=JSON.parse(localStorage.getItem(k)); return v==null?d:v; }catch(e){ return d; } }
  function store(k,v){ try{ if(v==null) localStorage.removeItem(k); else localStorage.setItem(k,JSON.stringify(v)); }catch(e){} }
  function $(id){ return document.getElementById(id); }
  function keys(o){ return Object.keys(o||{}); }

  // ---- DOM index --------------------------------------------------------
  var rows={}, order=[], chapters=[];
  [].forEach.call(document.querySelectorAll(".tp"),function(li){ var id=li.getAttribute("data-t"); rows[id]=li; order.push(id); });
  [].forEach.call(document.querySelectorAll(".ch"),function(ch){
    chapters.push({n:ch.getAttribute("data-ch"), el:ch, ids:[].map.call(ch.querySelectorAll(".tp"),function(li){ return li.getAttribute("data-t"); })});
  });
  var parts=[].map.call(document.querySelectorAll(".part"),function(p,i){
    return {i:i+1, ids:[].map.call(p.querySelectorAll(".tp"),function(li){ return li.getAttribute("data-t"); })};
  });

  // ---- state ------------------------------------------------------------
  // mode: "local" (no API reachable), "guest" (API, signed out), "account".
  var mode="guest", user=null, items={}, pending={};
  var inflight=false, retryMs=2000, retryT=null, flushT=null, lastPull=0, syncMsg="";

  function get(id){ return items[id]||{s:0,n:"",u:0}; }

  function set(id,patch){
    var cur=get(id);
    var next={s:patch.s!=null?patch.s:cur.s, n:patch.n!=null?patch.n:cur.n, u:Math.max(Date.now(),cur.u+1)};
    items[id]=next;
    if(mode==="account"){
      pending[id]=next; store(PEND+user.id,pending); saveCache(); scheduleFlush();
    } else {
      store(GUEST,items);
    }
    paintRow(id); paintTotals();
  }

  function saveCache(){ if(user) store(CACHE,{uid:user.id,email:user.email,items:items}); }

  // ---- API --------------------------------------------------------------
  function api(method,path,body,opts){
    var init={method:method, credentials:"same-origin", headers:{}};
    if(body!==undefined){ init.headers["content-type"]="application/json"; init.body=JSON.stringify(body); }
    if(opts&&opts.keepalive) init.keepalive=true;
    return fetch("/api/"+path,init).then(function(r){
      var ct=r.headers.get("content-type")||"";
      if(ct.indexOf("application/json")<0){ var e=new Error("No API"); e.noApi=true; e.status=r.status; throw e; }
      return r.json().then(function(j){
        if(!r.ok){ var e2=new Error(j.error||("HTTP "+r.status)); e2.status=r.status; throw e2; }
        return j;
      });
    });
  }

  function pull(){
    lastPull=Date.now();
    return api("GET","progress").then(function(j){
      var server=j.items||{}, merged={};
      keys(server).forEach(function(id){ merged[id]=server[id]; });
      keys(pending).forEach(function(id){
        var p=pending[id], sv=server[id];
        if(!sv||sv.u<p.u) merged[id]=p; else delete pending[id];
      });
      items=merged; store(PEND+user.id,pending); saveCache();
      paintAll();
      if(keys(pending).length) flush(); else setSync("saved");
    },function(e){
      if(e.status===401) return sessionLost();
      setSync("offline"); retryLater(pull);
    });
  }

  function scheduleFlush(){ clearTimeout(flushT); flushT=setTimeout(flush,700); setSync("saving"); }

  function retryLater(fn){
    clearTimeout(retryT);
    retryT=setTimeout(fn,retryMs); retryMs=Math.min(retryMs*2,60000);
  }

  function flush(){
    if(mode!=="account"||inflight) return Promise.resolve();
    var ids=keys(pending).slice(0,500);
    if(!ids.length){ setSync("saved"); return Promise.resolve(); }
    var batch=ids.map(function(id){ var p=pending[id]; return {id:id,s:p.s,n:p.n,u:p.u}; });
    inflight=true; setSync("saving");
    return api("PUT","progress",{items:batch}).then(function(){
      inflight=false; retryMs=2000;
      batch.forEach(function(b){ if(pending[b.id]&&pending[b.id].u===b.u) delete pending[b.id]; });
      store(PEND+user.id,pending);
      if(keys(pending).length) return flush();
      setSync("saved");
    },function(e){
      inflight=false;
      if(e.status===401) return sessionLost();
      if(e.status>=400&&e.status<500&&e.status!==429){ setSync("error",e.message); return; }
      setSync("offline"); retryLater(flush);
    });
  }

  function sessionLost(){
    var waiting=keys(pending).length;
    store(CACHE,null);
    mode="guest"; user=null; pending={}; items=load(GUEST,{});
    syncMsg=waiting?("Signed out. "+waiting+" change"+(waiting>1?"s":"")+" will upload when you sign in again."):"Your session ended. Sign in again.";
    paintAll(); setSync("idle");
  }

  // ---- sign in / out ----------------------------------------------------
  function signedIn(u){
    var guest=load(GUEST,{}), moved=0;
    user={id:u.id,email:u.email}; mode="account"; syncMsg="";
    pending=load(PEND+user.id,{});
    keys(guest).forEach(function(id){
      var g=guest[id];
      if(!g||(!g.s&&!g.n)) return;
      if(!pending[id]||pending[id].u<g.u){ pending[id]=g; moved++; }
    });
    store(PEND+user.id,pending); store(GUEST,null);
    if(moved) syncMsg=moved+" topic"+(moved>1?"s":"")+" from this browser added to your account.";
    var c=load(CACHE,null);
    items=(c&&c.uid===user.id)?c.items||{}:{};
    keys(pending).forEach(function(id){ items[id]=pending[id]; });
    saveCache(); paintAll(); setSync("saving");
    return pull();
  }

  function signOut(btn){
    var go=function(){
      return api("POST","auth/logout",{}).catch(function(){}).then(function(){
        if(user) store(PEND+user.id,null);
        store(CACHE,null); mode="guest"; user=null; pending={}; items=load(GUEST,{}); syncMsg="";
        paintAll(); setSync("idle");
      });
    };
    flush().then(function(){
      if(keys(pending).length&&!armed(btn,"Unsaved — sign out?")) return;
      go();
    });
  }

  function armed(btn,label){
    if(btn.getAttribute("data-armed")==="1"){ clearTimeout(btn.__t); btn.removeAttribute("data-armed"); btn.classList.remove("is-armed"); btn.textContent=btn.__o; return true; }
    btn.__o=btn.textContent; btn.setAttribute("data-armed","1"); btn.classList.add("is-armed"); btn.textContent=label;
    btn.__t=setTimeout(function(){ btn.removeAttribute("data-armed"); btn.classList.remove("is-armed"); btn.textContent=btn.__o; },5000);
    return false;
  }

  var dlg=$("auth"), authMode="login";
  function openAuth(m){
    authMode=m||"login";
    var up=authMode==="signup";
    $("auth-h").textContent=up?"Create an account":"Sign in";
    $("auth-go").textContent=up?"Create account":"Sign in";
    $("auth-sw").textContent=up?"Have an account? Sign in":"No account? Create one";
    $("auth-pw").setAttribute("autocomplete",up?"new-password":"current-password");
    $("auth-pw").placeholder=up?"At least 8 characters":"";
    var n=keys(load(GUEST,{})).filter(function(id){ var g=items[id]; return g&&(g.s||g.n); }).length;
    $("auth-p").textContent="Your topic progress and notes are saved to your account, so they follow you to any browser."+
      (n?" The "+n+" topic"+(n>1?"s":"")+" you have marked in this browser will be added to it.":"");
    $("auth-err").textContent="";
    if(dlg.showModal){ if(!dlg.open) dlg.showModal(); } else dlg.setAttribute("open","");
    $("auth-email").focus();
  }
  function closeAuth(){ if(dlg.close) dlg.close(); else dlg.removeAttribute("open"); }
  $("auth-x").addEventListener("click",closeAuth);
  $("auth-sw").addEventListener("click",function(){ openAuth(authMode==="login"?"signup":"login"); });
  $("authf").addEventListener("submit",function(ev){
    ev.preventDefault();
    var email=$("auth-email").value.trim(), pw=$("auth-pw").value, err=$("auth-err"), go=$("auth-go");
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ err.textContent="Enter a valid email address."; return; }
    if(pw.length<8){ err.textContent="Password must be at least 8 characters."; return; }
    err.textContent=""; go.disabled=true;
    api("POST",authMode==="signup"?"auth/signup":"auth/login",{email:email,password:pw}).then(function(j){
      go.disabled=false; $("auth-pw").value=""; closeAuth(); signedIn(j.user);
    },function(e){
      go.disabled=false;
      err.textContent=e.noApi?"Accounts are not available here. Open the deployed site, or run it with `vercel dev`.":
        (e.status?e.message:"Could not reach the server. Check your connection and try again.");
    });
  });
  $("signin").addEventListener("click",function(){ openAuth("login"); });
  $("signout").addEventListener("click",function(){ signOut(this); });

  // ---- painting ---------------------------------------------------------
  function paintRow(id){
    var li=rows[id]; if(!li) return;
    var it=get(id);
    li.setAttribute("data-s",String(it.s));
    li.querySelector(".tp__s").textContent=it.s?LABEL[it.s]:"";
    li.querySelector(".st").setAttribute("aria-label",id+" "+li.querySelector(".tp__t").textContent+": "+LABEL[it.s]);
    var nb=li.querySelector(".nb"); nb.classList.toggle("has-note",!!(it.n&&it.n.trim()));
    var ta=li.querySelector("textarea");
    if(ta&&document.activeElement!==ta) ta.value=it.n||"";
  }

  function count(ids){ var d=0,p=0; ids.forEach(function(id){ var s=get(id).s; if(s===2)d++; else if(s===1)p++; }); return {d:d,p:p}; }

  function paintTotals(){
    var all=count(order), chDone=0;
    chapters.forEach(function(c){
      var k=count(c.ids), full=k.d===c.ids.length;
      if(full) chDone++;
      c.el.classList.toggle("is-full",full);
      document.querySelector('[data-chc="'+c.n+'"]').textContent=k.d+"/"+c.ids.length;
      document.querySelector('[data-chm="'+c.n+'"]').style.width=(k.d/c.ids.length*100)+"%";
      var t=document.querySelector('[data-tocc="'+c.n+'"]'); t.textContent=k.d+"/"+c.ids.length;
      t.parentNode.classList.toggle("is-full",full);
    });
    parts.forEach(function(p){ document.querySelector('[data-partc="'+p.i+'"]').textContent=count(p.ids).d+" / "+p.ids.length; });
    var pc=Math.round(all.d/order.length*100);
    $("pct").textContent=all.d+" / "+order.length+" · "+pc+"%";
    $("meter").style.width=pc+"%";
    $("tot-done").innerHTML=all.d+"<small>/"+order.length+"</small>";
    $("tot-prog").textContent=all.p;
    $("tot-ch").innerHTML=chDone+"<small>/"+chapters.length+"</small>";
    var next=null;
    for(var i=0;i<order.length&&!next;i++) if(get(order[i]).s===1) next=order[i];
    for(var j=0;j<order.length&&!next;j++) if(get(order[j]).s===0) next=order[j];
    var cl=$("curlink");
    if(next){ cl.href="#"+rows[next].id; cl.innerHTML="Next: <b>"+next+"</b> "; cl.appendChild(document.createTextNode(rows[next].querySelector(".tp__t").textContent)); }
    else { cl.removeAttribute("href"); cl.textContent="All topics done"; }
  }

  function setSync(state,msg){
    var el=$("sync"), t;
    if(mode==="local"){ state="idle"; t="Saved in this browser"; }
    else if(mode==="guest"){ state="idle"; t="Not signed in · saved in this browser"; }
    else {
      var n=keys(pending).length;
      t=state==="saving"?"Saving…":state==="offline"?"Offline · "+n+" waiting":state==="error"?"Not saved: "+(msg||"error"):"Saved to account";
    }
    el.setAttribute("data-state",state); el.textContent=t; el.title=user?user.email+" — "+t:t;
    $("signin").hidden=mode!=="guest";
    $("signout").hidden=mode!=="account";
  }

  function paintCard(){
    var c=$("acctcard"), h;
    if(mode==="account"){
      h='<h3>Your progress is saved to your account</h3><p>Signed in as</p><p class="who"></p>'+
        '<p>Changes save to the database about a second after you make them, and follow you to any browser you sign in on.</p>'+
        '<div class="card__btns"><button class="btn" type="button" data-act="signout">Sign out</button></div>';
    } else if(mode==="local"){
      h='<h3>Saved in this browser</h3><p>Accounts need the API, which is not running here. Your progress is kept in this browser&rsquo;s local storage.</p>'+
        '<p class="card__fine">Open the deployed site to sign in, or run it locally with <code>vercel dev</code>.</p>';
    } else {
      h='<h3>Keep your progress in an account</h3><p>Signed out, your progress lives only in this browser. Create a free account to save it to the database and pick up on any device.</p>'+
        '<div class="card__btns"><button class="btn btn--pri" type="button" data-act="signup">Create account</button><button class="btn" type="button" data-act="login">Sign in</button></div>';
    }
    if(syncMsg) h+='<p class="card__fine" id="syncmsg"></p>';
    c.innerHTML=h;
    if(mode==="account") c.querySelector(".who").textContent=user.email;
    if(syncMsg) $("syncmsg").textContent=syncMsg;
  }
  $("acctcard").addEventListener("click",function(ev){
    var b=ev.target.closest("[data-act]"); if(!b) return;
    var a=b.getAttribute("data-act");
    if(a==="signout") signOut(b); else openAuth(a);
  });

  function paintAll(){ order.forEach(paintRow); paintTotals(); paintCard(); }

  // ---- topic interactions -----------------------------------------------
  $("parts").addEventListener("click",function(ev){
    var st=ev.target.closest(".st");
    if(st){ var id=st.getAttribute("data-t"); set(id,{s:(get(id).s+1)%3}); return; }
    var nb=ev.target.closest(".nb");
    if(nb){ toggleNote(nb); return; }
    var tg=ev.target.closest(".ch__tg");
    if(tg){ setOpen(tg,tg.getAttribute("aria-expanded")!=="true"); saveUi(); }
  });

  function toggleNote(nb){
    var id=nb.getAttribute("data-t"), li=rows[id], box=li.querySelector(".tp__note");
    if(!box){
      box=document.createElement("div"); box.className="tp__note"; box.id="nt-"+li.id.slice(2);
      var ta=document.createElement("textarea"); ta.maxLength=4000; ta.value=get(id).n||"";
      ta.setAttribute("aria-label","Note for "+id);
      ta.placeholder="What you built, a link, or what is still unclear";
      var sm=document.createElement("small");
      var paintLen=function(){ sm.textContent=ta.value.length+" / 4000"; };
      ta.addEventListener("input",function(){ set(id,{n:ta.value}); paintLen(); });
      paintLen(); box.appendChild(ta); box.appendChild(sm); li.appendChild(box);
      nb.setAttribute("aria-controls",box.id);
      box.hidden=true;
    }
    var open=box.hidden;
    box.hidden=!open; nb.setAttribute("aria-expanded",open?"true":"false");
    if(open) box.querySelector("textarea").focus();
  }

  // ---- collapse + filter (per browser, not synced) -----------------------
  var ui=load(UI,{closed:[],f:"all"});
  function setOpen(tg,open){
    tg.setAttribute("aria-expanded",open?"true":"false");
    $(tg.getAttribute("aria-controls")).hidden=!open;
  }
  function saveUi(){
    ui.closed=[].filter.call(document.querySelectorAll(".ch__tg"),function(t){ return t.getAttribute("aria-expanded")==="false"; })
      .map(function(t){ return t.getAttribute("aria-controls"); });
    store(UI,ui);
  }
  (ui.closed||[]).forEach(function(cid){ var t=document.querySelector('[aria-controls="'+cid+'"]'); if(t) setOpen(t,false); });
  $("expand").addEventListener("click",function(){ [].forEach.call(document.querySelectorAll(".ch__tg"),function(t){ setOpen(t,true); }); saveUi(); });
  $("collapse").addEventListener("click",function(){ [].forEach.call(document.querySelectorAll(".ch__tg"),function(t){ setOpen(t,false); }); saveUi(); });

  function applyFilter(f){
    ui.f=f; store(UI,ui);
    [].forEach.call(document.querySelectorAll(".seg button"),function(b){ b.setAttribute("aria-pressed",b.getAttribute("data-f")===f?"true":"false"); });
    chapters.forEach(function(c){
      var shown=0;
      c.ids.forEach(function(id){ var hide=f!=="all"&&String(get(id).s)!==f; rows[id].classList.toggle("is-hidden",hide); if(!hide) shown++; });
      c.el.classList.toggle("is-hidden",!shown);
    });
  }
  document.querySelector(".seg").addEventListener("click",function(ev){ var b=ev.target.closest("button"); if(b) applyFilter(b.getAttribute("data-f")); });

  // ---- export -----------------------------------------------------------
  $("export").addEventListener("click",function(){
    var out={exported:new Date().toISOString(), account:user?user.email:null, items:{}};
    order.forEach(function(id){ var it=get(id); if(it.s||it.n) out.items[id]={status:LABEL[it.s], note:it.n||"", updated:it.u?new Date(it.u).toISOString():null}; });
    var a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob([JSON.stringify(out,null,2)],{type:"application/json"}));
    a.download="ai-roadmap-progress.json"; document.body.appendChild(a); a.click();
    setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); },500);
  });

  // ---- lifecycle --------------------------------------------------------
  window.addEventListener("online",function(){ if(mode==="account"){ retryMs=2000; flush(); } });
  document.addEventListener("visibilitychange",function(){
    if(document.visibilityState==="hidden"&&mode==="account"&&keys(pending).length&&!inflight){
      var batch=keys(pending).slice(0,200).map(function(id){ var p=pending[id]; return {id:id,s:p.s,n:p.n,u:p.u}; });
      api("PUT","progress",{items:batch},{keepalive:true}).catch(function(){});
    } else if(document.visibilityState==="visible"&&mode==="account"&&!keys(pending).length&&Date.now()-lastPull>30000){
      pull();
    }
  });

  // First paint from what this browser already has, then ask the server.
  var cache=load(CACHE,null);
  if(cache&&cache.uid){
    mode="account"; user={id:cache.uid,email:cache.email}; items=cache.items||{};
    pending=load(PEND+user.id,{}); keys(pending).forEach(function(id){ items[id]=pending[id]; });
  } else {
    items=load(GUEST,{});
  }
  paintAll(); applyFilter(ui.f||"all"); setSync(mode==="account"?"saving":"idle");

  (function(){
    var q=new URLSearchParams(location.search), ok=q.get("ss"), bad=q.get("ss_error");
    if(!ok&&!bad) return;
    syncMsg=bad||"Signed in with Google.";
    q.delete("ss"); q.delete("ss_error");
    try{ history.replaceState(history.state,"",location.pathname+(q.toString()?"?"+q:"")+location.hash); }catch(e){}
  })();

  api("GET","auth/me").then(function(j){
    var g=!!(j.providers&&j.providers.google);
    $("auth-google").hidden=!g; $("auth-or").hidden=!g;
    if(!j.user){ if(mode==="account") sessionLost(); else { paintCard(); setSync("idle"); } return; }
    if(!user||user.id!==j.user.id){
      if(user) store(CACHE,null);
      return signedIn(j.user);
    }
    user.email=j.user.email;
    return pull();
  },function(e){
    if(e.status===401){ if(mode==="account") sessionLost(); else { paintCard(); setSync("idle"); } return; }
    if(e.noApi&&mode!=="account"){ mode="local"; paintCard(); setSync("idle"); return; }
    if(mode==="account"){ setSync("offline"); retryLater(pull); }
    else { mode="local"; paintCard(); setSync("idle"); }
  });
})();

(function(){
  var b=document.getElementById("theme");
  if(!b)return;
  var K="sde2-ledger-theme";
  try{ var s=localStorage.getItem(K); if(s)document.documentElement.setAttribute("data-theme",s); }catch(e){}
  b.addEventListener("click",function(){
    var cur=document.documentElement.getAttribute("data-theme");
    if(!cur){ cur = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark":"light"; }
    var next = cur==="dark" ? "light":"dark";
    document.documentElement.setAttribute("data-theme",next);
    try{ localStorage.setItem(K,next); }catch(e){}
  });
})();

(function(){
  var libs=[].slice.call(document.querySelectorAll('.lib'));
  if(!libs.length)return;
  function closeAll(except){
    libs.forEach(function(l){
      if(l===except)return;
      var b=l.querySelector('.lib__btn'), m=l.querySelector('.lib__menu');
      if(b&&m){ m.hidden=true; b.setAttribute('aria-expanded','false'); }
    });
  }
  libs.forEach(function(lib){
    var btn=lib.querySelector('.lib__btn'), menu=lib.querySelector('.lib__menu');
    if(!btn||!menu)return;
    btn.addEventListener('click',function(ev){
      ev.stopPropagation();
      var willOpen = menu.hidden;
      closeAll(lib);
      menu.hidden = !willOpen;
      btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    });
  });
  document.addEventListener('click',function(ev){
    var inside=false;
    libs.forEach(function(l){ if(l.contains(ev.target)) inside=true; });
    if(!inside) closeAll(null);
  });
  document.addEventListener('keydown',function(ev){
    if(ev.key==='Escape'){
      var open=null;
      libs.forEach(function(l){ var m=l.querySelector('.lib__menu'); if(m&&!m.hidden) open=l; });
      closeAll(null);
      if(open){ var b=open.querySelector('.lib__btn'); if(b)b.focus(); }
    }
  });
})();

(function(){
  var y=new Date().getFullYear();
  [].forEach.call(document.querySelectorAll('[data-year]'),function(el){ el.textContent=y; });
})();
</script><script src="search.js" defer></script></body></html>
"""


def main():
    parts = parse()
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(render(parts))
    n = sum(len(c["tps"]) for p in parts for c in p["chs"])
    print("roadmap.html: %d parts, %d chapters, %d topics, %.0f KB"
          % (len(parts), sum(len(p["chs"]) for p in parts), n, os.path.getsize(OUT) / 1024))


if __name__ == "__main__":
    main()
