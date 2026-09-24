#!/usr/bin/env python3
"""Build search-index.js — the data behind the site-wide search (search.js).

Run from the repo root after editing any page:

    python3 tools/build-search-index.py

Each entry is [page, hash, title, context, text, kind]. The hash is either an
element id, or "id/row" where row is a data-row / data-trk value inside that
element; search.js opens whatever is collapsed around it and scrolls there.
"""
import html
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GUIDES = ["java.html", "systemdesign.html", "typescript.html", "ai.html",
          "kubernetes.html", "aws.html", "db.html", "math.html"]
SNIP = 360


def read(name):
    with open(os.path.join(ROOT, name), encoding="utf-8") as f:
        return f.read()


def text(frag):
    frag = re.sub(r"<(script|style)\b.*?</\1>", " ", frag, flags=re.S)
    frag = re.sub(r"<[^>]+>", " ", frag)
    return re.sub(r"\s+", " ", html.unescape(frag)).strip()


def title_of(s):
    return text(re.search(r"<title>(.*?)</title>", s, re.S).group(1))


def block(s, start, tag):
    """Return s[start:end] covering the element that opens at `start`."""
    depth, i = 0, start
    pat = re.compile(r"<(/?)%s\b[^>]*>" % tag)
    for m in pat.finditer(s, start):
        depth += -1 if m.group(1) else 1
        if depth == 0:
            return s[start:m.end()]
    return s[start:]


def syllabus(items, pages):
    name = "syllabus.html"
    s = read(name)
    pages[name] = "Syllabus"
    for pm in re.finditer(r'id="p-([a-z0-9]+)" role="tabpanel"', s):
        start = s.rfind("<", 0, pm.start())
        panel = block(s, start, "section")
        track = text(re.search(r"<h2>(.*?)</h2>", panel, re.S).group(1))
        for lm in re.finditer(r'<section class="lvl"', panel):
            lvl = block(panel, lm.start(), "section")
            ln = text(re.search(r'<span class="lvl__n">(.*?)</span>', lvl).group(1))
            lh = text(re.search(r"<h3>(.*?)</h3>", lvl, re.S).group(1))
            for tm in re.finditer(r'<li class="topic" data-topic="([^"]+)"', lvl):
                li = block(lvl, tm.start(), "li")
                tid = text(re.search(r'<span class="tid">(.*?)</span>', li).group(1))
                ttl = text(re.search(r'<span class="txt">(.*?)</span>', li, re.S).group(1))
                det = re.search(r'<div class="det[^"]*" id="([^"]+)"', li)
                body = ""
                if det:
                    d = block(li, det.start(), "div")
                    qs = " ".join(text(q) for q in re.findall(r'<p class="fu__q">(.*?)</p>', d, re.S))
                    tip = re.search(r'data-tip="([^"]*)"', d)
                    main = text(re.sub(r'<div class="fu">.*', "", d, flags=re.S))
                    body = ((html.unescape(tip.group(1)) + " ") if tip else "") + main[:SNIP] + " " + qs
                items.append([name, det.group(1) if det else "p-" + pm.group(1),
                              tid + "  " + ttl, track + " · " + ln + " " + lh, body.strip(), "Syllabus"])


def ledger(items, pages, name, label):
    s = read(name)
    pages[name] = label
    seen = set()
    for dm in re.finditer(r'<article class="day" id="(day-(\d+))"', s):
        day = block(s, dm.start(), "article")
        dt = text(re.search(r'<h3 class="day__t">(.*?)</h3>', day, re.S).group(1))
        for tm in re.finditer(r'<section class="trk[^"]*" data-trk="([^"]+)"', day):
            sec = block(day, tm.start(), "section")
            trk = text(re.search(r'<button class="chk".*?<span>([^<]*)</span></button>', sec, re.S).group(1))
            q = re.search(r'<p class="trk__q">(.*?)</p>', sec, re.S)
            h = re.search(r'<p class="trk__h">(.*?)</p>', sec, re.S)
            if not q:
                continue
            items.append([name, dm.group(1) + "/" + tm.group(1), text(q.group(1)),
                          "Day %s · %s · %s" % (dm.group(2), trk, dt),
                          text(h.group(1))[:SNIP] if h else "", "Ledger"])
        for sm in re.finditer(r'<section class="dsa" data-trk="([^"]+)"', day):
            sec = block(day, sm.start(), "section")
            pat = re.search(r'<span class="dsa__p">(.*?)</span>', sec)
            for pb in re.finditer(r'data-d="([^"]+)" data-n="([^"]+)" data-diff="([^"]*)" data-pat="([^"]*)"', sec):
                slug = pb.group(1)
                if slug in seen:
                    continue
                seen.add(slug)
                items.append([name, dm.group(1) + "/" + sm.group(1), html.unescape(pb.group(2)),
                              "Day %s · DSA · %s · %s" % (dm.group(2), text(pat.group(1)) if pat else "", pb.group(3)),
                              html.unescape(pb.group(4)), "Problem"])


def guide(items, pages, name):
    s = read(name)
    pages[name] = title_of(s)
    part = ""
    for m in re.finditer(r'<div class="part">(.*?)</div>|<section class="ch" id="(ch-\d+)"', s, re.S):
        if m.group(1) is not None:
            part = text(m.group(1))
            continue
        ch = block(s, m.start(), "section")
        num = text(re.search(r'<span class="ch__n">(.*?)</span>', ch).group(1))
        h2 = text(re.search(r"<h2>(.*?)</h2>", ch, re.S).group(1))
        tl = re.search(r'<p class="tldr">(.*?)</p>', ch, re.S)
        h3 = " · ".join(text(x) for x in re.findall(r"<h3>(.*?)</h3>", ch, re.S))
        items.append([name, m.group(2), h2, pages[name] + " · " + num + (" · " + part if part else ""),
                      ((text(tl.group(1)) + " ") if tl else "") + h3, "Guide"])


def aiplan(items, pages):
    name = "aiplan.html"
    s = read(name)
    pages[name] = "AI Weekly Log"
    for am in re.finditer(r'<article class="wk[^"]*" id="([^"]+)"', s):
        wk = block(s, am.start(), "article")
        n = text(re.search(r'<span class="wk__n">(.*?)</span>', wk).group(1))
        h3 = text(re.search(r"<h3>(.*?)</h3>", wk, re.S).group(1))
        obj = re.search(r'<p class="wk__obj">(.*?)</p>', wk, re.S)
        items.append([name, am.group(1), "Week %s · %s" % (n, h3), "AI Weekly Log",
                      text(obj.group(1)) if obj else "", "Weekly log"])
        for rm in re.finditer(r'<li data-row="([^"]+)"[^>]*>.*?<span class="t">(.*?)</span>', wk, re.S):
            kind = "Build" if "-b" in rm.group(1) else "Learn"
            items.append([name, am.group(1) + "/" + rm.group(1), text(rm.group(2)),
                          "Week %s · %s · %s" % (n, h3, kind), "", "Weekly log"])


def ladders(items, pages):
    name = "cp.html"
    s = read(name)
    pages[name] = "Codeforces Ladders"
    for lm in re.finditer(r'<section class="lad" data-lad="([^"]+)"', s):
        lad = block(s, lm.start(), "section")
        lt = text(re.search(r'<span class="lad__t">(.*?)</span>', lad).group(1))
        for rm in re.finditer(r'<li class="row" data-row="([^"]+)">.*?<span class="row__n">(.*?)</span>(.*?)</li>', lad, re.S):
            rt = re.search(r'<span class="rt[^"]*">(.*?)</span>', rm.group(3))
            items.append([name, "L-" + lm.group(1) + "/" + rm.group(1), text(rm.group(2)),
                          "Codeforces · " + lt + ((" · " + text(rt.group(1))) if rt else ""), "", "Problem"])


def main():
    items, pages = [], {}
    syllabus(items, pages)
    ledger(items, pages, "index.html", "90-Day Ledger")
    ledger(items, pages, "platform.html", "Platform Ledger")
    for g in GUIDES:
        guide(items, pages, g)
    aiplan(items, pages)
    ladders(items, pages)
    names = list(pages)
    rows = [[names.index(i[0])] + i[1:] for i in items]
    data = {"v": 1, "pages": [[n, pages[n]] for n in names], "items": rows}
    out = os.path.join(ROOT, "search-index.js")
    with open(out, "w", encoding="utf-8") as f:
        f.write("/* generated by tools/build-search-index.py - do not edit */\n")
        f.write("window.__GS_IDX=" + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n")
    by = {}
    for i in items:
        by[i[0]] = by.get(i[0], 0) + 1
    print("%d entries, %.0f KB" % (len(items), os.path.getsize(out) / 1024))
    for k, v in by.items():
        print("  %-18s %d" % (k, v))


if __name__ == "__main__":
    main()
