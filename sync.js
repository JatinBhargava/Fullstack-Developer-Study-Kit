/* Site-wide progress sync.

   Load this in <head>, before the page's own scripts. Pages keep reading and
   writing localStorage exactly as before; this file sits underneath:

   - It wraps Storage.prototype.getItem/setItem/removeItem for the tracked
     keys. A page write is turned into a per-item diff against what that page
     last read, and the diff is merged onto the latest stored value. So a page
     holding stale state (another tab, or a sync that landed after it loaded)
     can only change the items it actually touched.
   - Signed in, those diffs queue in "site-sync.v1" and are sent to
     /api/sync about a second later; offline they wait and retry.
   - Changes from other devices are pulled on load. Keys the page has not read
     are written straight in. Keys whose page listens for "storage" events get
     one dispatched, and redraw. For the rest, the change waits in an inbox
     applied on the next load, and the page reloads now (or offers to, if you
     have already started clicking).
   - The Syllabus answer log in IndexedDB ("sde2-answers") is synced record by
     record. Code files and weekly-log attachments stay in this browser.

   Accounts and the session cookie are shared with the roadmap page. */
(function(){
  "use strict";
  if (window.__siteSync) return;
  var LS;
  try { LS = window.localStorage; LS.getItem("x"); } catch (e) { return; }

  var TRACK = ["sde2-ledger-v2","sde2-dsa-done","sde2-dsa-doubt","sde2-srs","sde2-syllabus-v2",
               "opsledger.v1","ai-weekly-log.v1","cp.v1"];
  // Items are synced two levels deep (e.g. cp.v1 -> done -> 4A); sde2-srs
  // entries are one unit each, so a rating's box, due date and count stay together.
  var DEPTH = {"sde2-srs":1};
  // Pages that already redraw on a "storage" event for these keys.
  var LIVE = {"sde2-dsa-done":1,"sde2-dsa-doubt":1,"sde2-srs":1,"ai-weekly-log.v1":1};
  var IDB_KEY = "idb:sde2-answers";
  var META = "site-sync.v1";
  var SEP = "\u001f", PATH = "\u001e";
  var MAX_VALUE = 250 * 1024;

  var tracked = {};
  TRACK.forEach(function(k){ tracked[k] = 1; });
  var P = Storage.prototype, oGet = P.getItem, oSet = P.setItem, oRem = P.removeItem;
  var has = Object.prototype.hasOwnProperty;

  // ---- values as flat item maps ------------------------------------------
  function parse(raw){ if (raw == null) return undefined; try { return JSON.parse(raw); } catch (e) { return raw; } }
  function isObj(x){ return x !== null && typeof x === "object" && !Array.isArray(x); }
  function eq(a, b){ return JSON.stringify(a) === JSON.stringify(b); }
  function depth(k){ return DEPTH[k] || 2; }

  function flat(v, d){
    var out = {};
    if (v === undefined) return out;
    if (!isObj(v)) { out[""] = v; return out; }
    for (var f in v) {
      if (!has.call(v, f)) continue;
      var x = v[f];
      if (d > 1 && isObj(x) && Object.keys(x).length) {
        for (var g in x) if (has.call(x, g)) out[f + PATH + g] = x[g];
      } else out[f] = x;
    }
    return out;
  }
  function unflat(m){
    var ks = Object.keys(m);
    if (ks.length === 1 && ks[0] === "") return m[""];
    var out = {};
    ks.forEach(function(p){ if (p !== "" && p.indexOf(PATH) < 0) out[p] = m[p]; });
    ks.forEach(function(p){
      var i = p.indexOf(PATH); if (i < 0) return;
      var f = p.slice(0, i);
      if (!isObj(out[f])) out[f] = {};
      out[f][p.slice(i + PATH.length)] = m[p];
    });
    return out;
  }
  function diff(k, a, b){
    var d = depth(k), fa = flat(a, d), fb = flat(b, d), out = [];
    for (var f in fb) if (!has.call(fa, f) || !eq(fa[f], fb[f])) out.push({f: f, v: fb[f], d: false});
    for (var g in fa) if (!has.call(fb, g)) out.push({f: g, v: null, d: true});
    return out;
  }
  function apply(k, base, changes){
    // On a copy: flat() shares nested objects with base, and callers compare base with the result.
    var m = flat(base === undefined ? undefined : JSON.parse(JSON.stringify(base)), depth(k));
    changes.forEach(function(c){ if (c.d) delete m[c.f]; else m[c.f] = c.v; });
    return unflat(m);
  }

  // ---- sync state, shared by every tab of this origin ---------------------
  function meta(){ var m = parse(oGet.call(LS, META)); return isObj(m) ? m : {}; }
  function saveMeta(m){ try { oSet.call(LS, META, JSON.stringify(m)); } catch (e) {} }
  function blank(user){ return {uid: user.id, email: user.email, cursor: 0, pending: {}, inbox: {}, idb: {}, idbReady: false}; }

  function queue(m, k, f, v, d){
    var id = k + SEP + f, prev = m.pending[id];
    m.pending[id] = {k: k, f: f, v: d ? null : v, d: d, u: Math.max(Date.now(), prev ? prev.u + 1 : 0)};
  }

  // ---- the storage wrapper ------------------------------------------------
  var seen = {}, pageRead = {}, interacted = false;

  P.getItem = function(k){
    var raw = oGet.call(this, k);
    if (this === LS && tracked[k]) { seen[k] = parse(raw); pageRead[k] = 1; }
    return raw;
  };
  P.setItem = function(k, v){
    if (this !== LS || !tracked[k]) return oSet.call(this, k, v);
    var mine = parse(String(v)), d = diff(k, seen[k], mine);
    seen[k] = mine;
    if (!d.length) return;
    oSet.call(LS, k, JSON.stringify(apply(k, parse(oGet.call(LS, k)), d)));
    record(k, d);
  };
  P.removeItem = function(k){
    if (this !== LS || !tracked[k]) return oRem.call(this, k);
    var d = diff(k, parse(oGet.call(LS, k)), undefined);
    seen[k] = undefined;
    oRem.call(LS, k);
    record(k, d);
  };
  // Another tab changed a key: pages that listen re-read it, so their baseline moves too.
  window.addEventListener("storage", function(ev){
    if (ev.storageArea === LS && tracked[ev.key] && LIVE[ev.key]) seen[ev.key] = parse(ev.newValue);
  });

  function record(k, d){
    var m = meta();
    if (!m.uid) return;
    d.forEach(function(c){ queue(m, k, c.f, c.v, c.d); });
    saveMeta(m);
    scheduleFlush();
  }

  // Merge remote changes for one key into storage. Returns the new value, or
  // undefined when nothing changed. Local edits not yet sent win if newer.
  function writeRemote(m, k, list){
    var keep = list.filter(function(c){
      var p = m.pending[k + SEP + c.f];
      if (p && p.u >= c.u) return false;
      if (p) delete m.pending[k + SEP + c.f];
      return true;
    });
    if (!keep.length) return undefined;
    var cur = parse(oGet.call(LS, k)), next = apply(k, cur, keep);
    if (eq(cur, next)) return undefined;
    oSet.call(LS, k, JSON.stringify(next));
    return {old: cur, next: next};
  }

  // Inbox from a previous pull: apply before this page reads anything.
  (function(){
    var m = meta();
    if (!m.uid || !m.inbox) return;
    var ks = Object.keys(m.inbox);
    if (!ks.length) return;
    ks.forEach(function(k){ writeRemote(m, k, m.inbox[k]); });
    m.inbox = {};
    saveMeta(m);
  })();

  // ---- IndexedDB answer log ----------------------------------------------
  var IDB = (function(){
    var p = null;
    function open(){
      if (p) return p;
      p = new Promise(function(res, rej){
        if (!window.indexedDB) { rej(new Error("no IndexedDB")); return; }
        // Same name, version and upgrade as the Syllabus page, so whichever opens first creates it correctly.
        var r = indexedDB.open("sde2-answers", 1);
        r.onupgradeneeded = function(e){ var db = e.target.result;
          if (!db.objectStoreNames.contains("attempts")) { var s = db.createObjectStore("attempts", {keyPath: "id"}); s.createIndex("k", "k"); } };
        r.onsuccess = function(){ res(r.result); };
        r.onerror = function(){ rej(r.error); };
        r.onblocked = function(){ rej(new Error("blocked")); };
      });
      p.catch(function(){ p = null; });
      return p;
    }
    function tx(mode, fn){
      return open().then(function(db){ return new Promise(function(res, rej){
        var t = db.transaction("attempts", mode), out = fn(t.objectStore("attempts"));
        t.oncomplete = function(){ res(out && out.result); };
        t.onerror = function(){ rej(t.error); };
      }); });
    }
    return {
      all: function(){ return tx("readonly", function(s){ return s.getAll(); }); },
      put: function(rec){ return tx("readwrite", function(s){ s.put(rec); }); },
      del: function(id){ return tx("readwrite", function(s){ s.delete(id); if (/^\d+$/.test(id)) s.delete(Number(id)); }); },
      clear: function(){ return tx("readwrite", function(s){ s.clear(); }); }
    };
  })();

  function hash(s){ var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return s.length + ":" + h; }

  // Not before the first sync has recorded which records the account already
  // has; otherwise an old local copy could overwrite a newer one from elsewhere.
  function scanIdb(){
    if (!meta().idbReady) return Promise.resolve();
    return IDB.all().then(function(recs){
      var m = meta(), ids = {}, n = 0;
      if (!m.uid || !m.idbReady) return;
      m.idb = m.idb || {};
      (recs || []).forEach(function(r){
        var id = String(r.id), s = JSON.stringify(r), h = hash(s);
        ids[id] = 1;
        if (m.idb[id] === h) return;
        m.idb[id] = h;
        if (s.length > MAX_VALUE) return;
        queue(m, IDB_KEY, id, r, false); n++;
      });
      Object.keys(m.idb).forEach(function(id){ if (!ids[id]) { delete m.idb[id]; queue(m, IDB_KEY, id, null, true); n++; } });
      saveMeta(m);
      if (n) scheduleFlush();
    }, function(){});
  }

  function applyIdb(m, list){
    var jobs = [];
    m.idb = m.idb || {};
    list.forEach(function(c){
      var p = m.pending[IDB_KEY + SEP + c.f];
      if (p && p.u >= c.u) return;
      if (p) delete m.pending[IDB_KEY + SEP + c.f];
      if (c.d) { if (m.idb[c.f]) { delete m.idb[c.f]; jobs.push(IDB.del(c.f)); } return; }
      var h = hash(JSON.stringify(c.v));
      if (m.idb[c.f] === h) return;
      m.idb[c.f] = h;
      jobs.push(IDB.put(c.v));
    });
    return Promise.all(jobs).catch(function(){});
  }

  // ---- network ------------------------------------------------------------
  function api(method, path, body, keepalive){
    var init = {method: method, credentials: "same-origin", headers: {}};
    if (body !== undefined) { init.headers["content-type"] = "application/json"; init.body = JSON.stringify(body); }
    if (keepalive) init.keepalive = true;
    return fetch("/api/" + path, init).then(function(r){
      var ct = r.headers.get("content-type") || "";
      if (ct.indexOf("application/json") < 0) { var e = new Error("No API"); e.noApi = true; e.status = r.status; throw e; }
      return r.json().then(function(j){
        if (!r.ok) { var e2 = new Error(j.error || ("HTTP " + r.status)); e2.status = r.status; throw e2; }
        return j;
      });
    });
  }

  var mode = "boot", state = "idle", stateMsg = "", inflight = null, flushT = null, retryT = null, retryMs = 2000, lastPull = 0;

  function scheduleFlush(){ clearTimeout(flushT); flushT = setTimeout(flush, 1000); setState("saving"); }
  function retryLater(fn){ clearTimeout(retryT); retryT = setTimeout(fn, retryMs); retryMs = Math.min(retryMs * 2, 60000); }

  function batchOf(m){
    var out = [], size = 0;
    Object.keys(m.pending).some(function(id){
      var c = m.pending[id], s = JSON.stringify(c).length;
      if (s > MAX_VALUE) { delete m.pending[id]; return false; }
      if (out.length && (out.length >= 400 || size + s > 1500000)) return true;
      out.push(c); size += s; return false;
    });
    return out;
  }

  function flush(){
    if (inflight) return inflight;
    var m = meta();
    if (!m.uid || mode !== "account") return Promise.resolve();
    var batch = batchOf(m);
    saveMeta(m);
    if (!batch.length) { setState("saved"); return Promise.resolve(); }
    setState("saving");
    inflight = api("PUT", "sync", {changes: batch}).then(function(){
      inflight = null; retryMs = 2000;
      var m2 = meta();
      batch.forEach(function(c){ var id = c.k + SEP + c.f; if (m2.pending[id] && m2.pending[id].u === c.u) delete m2.pending[id]; });
      saveMeta(m2);
      if (Object.keys(m2.pending).length) return flush();
      setState("saved");
    }, function(e){
      inflight = null;
      if (e.status === 401) return sessionLost();
      if (e.status >= 400 && e.status < 500 && e.status !== 429) { setState("error", e.message); return; }
      setState("offline"); retryLater(flush);
    });
    return inflight;
  }

  // first: this browser's first sync with this account. Local items the
  // account does not have yet are uploaded; where both have an item, the
  // account's copy wins.
  var pulling = null;
  function pull(first){
    if (pulling) return pulling;
    pulling = pullOnce(first).then(function(){ pulling = null; }, function(){ pulling = null; });
    return pulling;
  }
  function pullOnce(first){
    lastPull = Date.now();
    var snapshot = null, serverIds = {}, reload = false, live = [];
    if (first) {
      snapshot = {};
      TRACK.forEach(function(k){ snapshot[k] = parse(oGet.call(LS, k)); });
    }
    function page(){
      return api("GET", "sync?since=" + (meta().cursor || 0)).then(function(j){
        var m = meta(), groups = {}, jobs = [];
        if (!m.uid) return;
        (j.changes || []).forEach(function(c){
          (groups[c.k] = groups[c.k] || []).push(c);
          serverIds[c.k + SEP + c.f] = 1;
        });
        Object.keys(groups).forEach(function(k){
          var list = groups[k];
          if (k === IDB_KEY) { jobs.push(applyIdb(m, list)); return; }
          if (!tracked[k]) return;
          if (!pageRead[k] || LIVE[k]) {
            var w = writeRemote(m, k, list);
            if (w && pageRead[k]) live.push({k: k, w: w});
            return;
          }
          var probe = apply(k, parse(oGet.call(LS, k)), list);
          if (eq(probe, parse(oGet.call(LS, k)))) return;
          m.inbox[k] = (m.inbox[k] || []).concat(list);
          reload = true;
        });
        m.cursor = j.cursor;
        saveMeta(m);
        return Promise.all(jobs).then(function(){ return j.more ? page() : null; });
      });
    }
    return page().then(function(){
      if (first) {
        var m = meta();
        TRACK.forEach(function(k){
          var f = flat(snapshot[k], depth(k));
          Object.keys(f).forEach(function(p){ if (!serverIds[k + SEP + p]) queue(m, k, p, f[p], false); });
        });
        saveMeta(m);
        return IDB.all().then(function(recs){
          var m2 = meta();
          (recs || []).forEach(function(r){
            var id = String(r.id), s = JSON.stringify(r);
            if (!serverIds[IDB_KEY + SEP + id] && s.length <= MAX_VALUE) queue(m2, IDB_KEY, id, r, false);
            m2.idb[id] = hash(s);
          });
          m2.idbReady = true;
          saveMeta(m2);
        }, function(){ var m3 = meta(); m3.idbReady = true; saveMeta(m3); });
      }
    }).then(function(){
      live.forEach(function(x){
        seen[x.k] = x.w.next;
        try {
          window.dispatchEvent(new StorageEvent("storage", {key: x.k, oldValue: JSON.stringify(x.w.old),
            newValue: JSON.stringify(x.w.next), storageArea: LS, url: location.href}));
        } catch (e) {}
      });
      if (Object.keys(meta().pending).length) flush(); else setState("saved");
      if (reload || first) refreshPage(first);
    }, function(e){
      if (e && e.status === 401) return sessionLost();
      setState("offline"); retryLater(function(){ pull(first); });
    });
  }

  function refreshPage(force){
    var last = 0;
    try { last = Number(sessionStorage.getItem("site-sync.reloaded")) || 0; } catch (e) {}
    if (Date.now() - last < 10000 && !force) { banner(); return; }
    if (interacted && !force) { banner(); return; }
    try { sessionStorage.setItem("site-sync.reloaded", String(Date.now())); } catch (e) {}
    location.reload();
  }

  function sessionLost(){
    var m = meta();
    mode = "guest";
    if (m.uid && !Object.keys(m.pending || {}).length) {
      wipe().then(function(){
        notice("You were signed out. Your progress is safe in your account: sign in to load it.");
        location.reload();
      });
    } else {
      if (m.uid) toast("You were signed out. Changes not yet saved will upload when you sign in again.");
      paint();
    }
  }

  function wipe(){
    TRACK.forEach(function(k){ oRem.call(LS, k); seen[k] = undefined; });
    oRem.call(LS, META);
    oRem.call(LS, "ai-roadmap.cache.v1");
    return IDB.clear().catch(function(){});
  }

  function signedIn(user, fresh){
    var m = meta();
    mode = "account";
    if (m.uid !== user.id) {
      saveMeta(blank(user));
      paint(); setState("saving");
      return pull(true);
    }
    if (m.email !== user.email) { m.email = user.email; saveMeta(m); }
    setState("saving");
    if (fresh) return pull(false).then(function(){ refreshPage(true); });
    return pull(false);
  }

  function signOut(force){
    return flush().then(function(){
      var n = Object.keys(meta().pending || {}).length;
      if (n && !force) { openDialog("unsaved", n); return; }
      return api("POST", "auth/logout", {}).catch(function(){}).then(wipe).then(function(){
        notice("Signed out. Your progress stays in your account.");
        location.reload();
      });
    });
  }

  // ---- UI -----------------------------------------------------------------
  var btn = null, dlg = null, ban = null, formMode = "login";

  function css(){
    var s = document.createElement("style");
    s.textContent = [
      ".ss-btn{display:inline-flex;align-items:center;gap:7px}",
      ".ss-btn::before{content:'';width:7px;height:7px;border-radius:50%;background:var(--muted,#888);flex:none}",
      ".ss-btn[data-state=saved]::before{background:var(--done,#2E6A4E)}",
      ".ss-btn[data-state=saving]::before{background:#C9971C}",
      ".ss-btn[data-state=offline]::before{background:var(--signal,#B4541A)}",
      ".ss-btn[data-state=error]::before{background:#B3261E}",
      ".ss-btn[data-mode=guest]::before{display:none}",
      "dialog.ss{border:1px solid var(--rule,#ccc);background:var(--surface,#fff);color:var(--ink,#111);padding:0;width:min(420px,calc(100vw - 32px));box-shadow:0 18px 60px #00000040}",
      "dialog.ss::backdrop{background:#0008}",
      ".ss form,.ss .ss__in{display:flex;flex-direction:column;gap:14px;padding:24px 24px 22px;position:relative}",
      ".ss h2{font-family:'Zilla Slab',Georgia,serif;font-size:1.4rem;font-weight:600;margin:0}",
      ".ss p{margin:0;font-size:.92rem;color:var(--ink-2,var(--ink,#333));line-height:1.5}",
      ".ss .ss__who{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:.85rem;word-break:break-all;color:var(--ink,#111)}",
      ".ss .ss__fine{font-size:.82rem;color:var(--muted,#666)}",
      ".ss label{display:flex;flex-direction:column;gap:5px;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted,#666)}",
      ".ss input{font:inherit;font-family:'Source Sans 3','Segoe UI',system-ui,sans-serif;font-size:1rem;letter-spacing:0;text-transform:none;color:var(--ink,#111);background:var(--paper,#fafafa);border:1px solid var(--rule,#ccc);padding:9px 11px;border-radius:0}",
      ".ss input:focus{border-color:var(--ink-2,#333);outline:none}",
      ".ss .ss__err{color:#B3261E;font-size:.9rem}",
      ".ss .ss__err:empty{display:none}",
      ".ss .ss__row{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}",
      ".ss .ss__pri{background:var(--ink,#111);color:var(--surface,#fff);border-color:var(--ink,#111)}",
      ".ss .ss__link{background:transparent;border:0;padding:0;color:inherit;font:inherit;font-size:.9rem;cursor:pointer;text-decoration:underline;text-underline-offset:2px}",
      ".ss .ss__x{position:absolute;top:8px;right:10px;background:transparent;border:0;color:var(--muted,#666);font-size:1.4rem;line-height:1;cursor:pointer;padding:4px 8px}",
      ".ss-toast,.ss-ban{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:200;max-width:calc(100vw - 32px);background:var(--ink,#111);color:var(--surface,#fff);",
      "font-family:'Source Sans 3','Segoe UI',system-ui,sans-serif;font-size:.92rem;padding:10px 14px;box-shadow:0 8px 28px #0004;display:flex;gap:14px;align-items:center}",
      ".ss-ban button{font:inherit;font-size:.85rem;background:transparent;color:inherit;border:1px solid currentColor;padding:4px 10px;cursor:pointer}"
    ].join("\n");
    document.head.appendChild(s);
  }

  function label(){
    if (mode !== "account") return "Sign in";
    var n = Object.keys(meta().pending || {}).length;
    return state === "saving" ? "Saving\u2026" : state === "offline" ? "Offline \u00b7 " + n : state === "error" ? "Not saved" : "Synced";
  }
  function paint(){
    if (!btn) return;
    btn.hidden = mode === "boot" || mode === "local";
    btn.setAttribute("data-mode", mode);
    btn.setAttribute("data-state", state);
    btn.textContent = label();
    var m = meta();
    btn.title = mode === "account" ? (m.email || "") + " \u2014 progress syncs to your account" : "Sign in to save your progress to an account";
    btn.setAttribute("aria-label", mode === "account" ? "Account: " + label() : "Sign in to save your progress");
  }
  function setState(s, msg){ state = s; stateMsg = msg || ""; paint(); }

  function el(tag, attrs, text){
    var e = document.createElement(tag);
    for (var a in attrs) if (has.call(attrs, a)) e.setAttribute(a, attrs[a]);
    if (text != null) e.textContent = text;
    return e;
  }

  function openDialog(kind, arg){
    if (!dlg) { dlg = el("dialog", {"class": "ss", "aria-labelledby": "ss-h"}); document.body.appendChild(dlg); }
    dlg.innerHTML = "";
    var x = el("button", {type: "button", "class": "ss__x", "aria-label": "Close"}, "\u00d7");
    x.addEventListener("click", closeDialog);

    if (kind === "account") {
      var m = meta(), n = Object.keys(m.pending || {}).length;
      var box = el("div", {"class": "ss__in"});
      box.appendChild(x);
      box.appendChild(el("h2", {id: "ss-h"}, "Your account"));
      box.appendChild(el("p", {}, "Signed in as"));
      box.appendChild(el("p", {"class": "ss__who"}, m.email || ""));
      box.appendChild(el("p", {}, state === "error" ? "Last save failed: " + stateMsg :
        n ? n + " change" + (n > 1 ? "s" : "") + " waiting to save." : "Progress on every page is saved to your account."));
      box.appendChild(el("p", {"class": "ss__fine"}, "Signing out removes your progress from this browser. It stays in your account."));
      var row = el("div", {"class": "ss__row"});
      var so = el("button", {type: "button", "class": "btn"}, "Sign out");
      so.addEventListener("click", function(){ so.disabled = true; signOut(false); });
      row.appendChild(so);
      box.appendChild(row);
      dlg.appendChild(box);
    } else if (kind === "unsaved") {
      var b2 = el("div", {"class": "ss__in"});
      b2.appendChild(x);
      b2.appendChild(el("h2", {id: "ss-h"}, "Changes not saved yet"));
      b2.appendChild(el("p", {}, arg + " change" + (arg > 1 ? "s have" : " has") + " not reached your account, probably because you are offline. Signing out now loses " + (arg > 1 ? "them" : "it") + "."));
      var r2 = el("div", {"class": "ss__row"});
      var keep = el("button", {type: "button", "class": "btn ss__pri"}, "Stay signed in");
      keep.addEventListener("click", closeDialog);
      var anyway = el("button", {type: "button", "class": "btn"}, "Sign out anyway");
      anyway.addEventListener("click", function(){ signOut(true); });
      r2.appendChild(keep); r2.appendChild(anyway);
      b2.appendChild(r2);
      dlg.appendChild(b2);
    } else {
      formMode = kind === "signup" ? "signup" : "login";
      var up = formMode === "signup";
      var f = el("form", {novalidate: ""});
      f.appendChild(x);
      f.appendChild(el("h2", {id: "ss-h"}, up ? "Create an account" : "Sign in"));
      f.appendChild(el("p", {}, "Your progress on every page \u2014 ticks, notes, quiz ratings and answers \u2014 is saved to your account and follows you to any browser. Whatever you have done in this browser is added to it."));
      var le = el("label", {}, "Email"), ie = el("input", {type: "email", autocomplete: "email", required: "", maxlength: "254"});
      le.appendChild(ie); f.appendChild(le);
      var lp = el("label", {}, "Password"), ip = el("input", {type: "password", autocomplete: up ? "new-password" : "current-password", required: "", minlength: "8", maxlength: "200"});
      if (up) ip.placeholder = "At least 8 characters";
      lp.appendChild(ip); f.appendChild(lp);
      var er = el("p", {"class": "ss__err", role: "alert"});
      f.appendChild(er);
      var r3 = el("div", {"class": "ss__row"});
      var go = el("button", {type: "submit", "class": "btn ss__pri"}, up ? "Create account" : "Sign in");
      var sw = el("button", {type: "button", "class": "ss__link"}, up ? "Have an account? Sign in" : "No account? Create one");
      sw.addEventListener("click", function(){ openDialog(up ? "login" : "signup"); });
      r3.appendChild(go); r3.appendChild(sw); f.appendChild(r3);
      f.addEventListener("submit", function(ev){
        ev.preventDefault();
        var email = ie.value.trim(), pw = ip.value;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { er.textContent = "Enter a valid email address."; return; }
        if (pw.length < 8) { er.textContent = "Password must be at least 8 characters."; return; }
        er.textContent = ""; go.disabled = true; go.textContent = up ? "Creating\u2026" : "Signing in\u2026";
        api("POST", up ? "auth/signup" : "auth/login", {email: email, password: pw}).then(function(j){
          ip.value = "";
          go.textContent = "Loading your progress\u2026";
          notice("Signed in. Progress on every page now saves to your account.");
          signedIn(j.user, true);
        }, function(e){
          go.disabled = false; go.textContent = up ? "Create account" : "Sign in";
          er.textContent = e.status ? e.message : "Could not reach the server. Check your connection and try again.";
        });
      });
      dlg.appendChild(f);
      setTimeout(function(){ ie.focus(); }, 0);
    }
    if (!dlg.open) { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", ""); }
  }
  function closeDialog(){ if (dlg) { if (dlg.close) dlg.close(); else dlg.removeAttribute("open"); } }

  function toast(text){
    if (!document.body) { document.addEventListener("DOMContentLoaded", function(){ toast(text); }); return; }
    var t = el("div", {"class": "ss-toast", role: "status"}, text);
    document.body.appendChild(t);
    setTimeout(function(){ t.remove(); }, 5000);
  }
  // A message that survives the reload that follows it.
  function notice(text){ try { sessionStorage.setItem("site-sync.notice", text); } catch (e) {} }
  function showNotice(){
    var t = null;
    try { t = sessionStorage.getItem("site-sync.notice"); sessionStorage.removeItem("site-sync.notice"); } catch (e) {}
    if (t) toast(t);
  }
  function banner(){
    if (ban || !document.body) return;
    ban = el("div", {"class": "ss-ban", role: "status"});
    ban.appendChild(el("span", {}, "Newer progress from another device is ready."));
    var b = el("button", {type: "button"}, "Reload");
    b.addEventListener("click", function(){ location.reload(); });
    ban.appendChild(b);
    document.body.appendChild(ban);
  }

  function mount(){
    var anchor = document.querySelector("[data-gsearch]");
    css();
    if (!anchor) return;
    btn = el("button", {type: "button", "class": "btn ss-btn", hidden: ""});
    btn.addEventListener("click", function(){ openDialog(mode === "account" ? "account" : "login"); });
    anchor.parentNode.insertBefore(btn, anchor);
    paint();
    showNotice();
  }

  // ---- lifecycle ------------------------------------------------------------
  ["pointerdown", "keydown"].forEach(function(t){
    document.addEventListener(t, function(){ interacted = true; }, true);
  });
  document.addEventListener("visibilitychange", function(){
    if (mode !== "account") return;
    if (document.visibilityState === "hidden") {
      scanIdb();
      var m = meta(), batch = batchOf(m);
      if (batch.length && !inflight && JSON.stringify(batch).length < 60000) {
        api("PUT", "sync", {changes: batch}, true).catch(function(){});
      }
    } else if (Date.now() - lastPull > 30000) {
      pull(false);
    }
  });
  window.addEventListener("online", function(){ if (mode === "account") { retryMs = 2000; flush(); } });
  setInterval(function(){ if (mode === "account" && document.visibilityState === "visible") scanIdb(); }, 60000);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();

  function boot(){
    api("GET", "auth/me").then(function(j){
      retryMs = 2000;
      if (j.user) { signedIn(j.user, false); setTimeout(scanIdb, 3000); return; }
      if (meta().uid) { sessionLost(); return; }
      mode = "guest"; paint();
    }, function(e){
      if (e.noApi) { mode = "local"; paint(); return; }
      if (meta().uid) { mode = "account"; setState("offline"); retryLater(boot); return; }
      mode = "local"; paint();
    });
  }
  boot();

  window.__siteSync = {pull: function(){ return pull(false); }, flush: flush, scan: scanIdb};
})();
