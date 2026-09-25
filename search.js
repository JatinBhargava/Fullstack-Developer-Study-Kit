/* Site-wide search for the study kit.
   Opens with the nav "Search" button, Ctrl/Cmd+K, or "/" outside a text box.
   The index (search-index.js, built by tools/build-search-index.py) is loaded
   on first open. A result link is page#id or page#id/row; on arrival this
   script opens whatever tab, panel or toggle is collapsed around the target
   and scrolls to it. */
(function(){
  "use strict";
  var SRC=(document.currentScript&&document.currentScript.src)||"search.js";
  var IDX_URL=SRC.replace(/search\.js(\?.*)?$/,"search-index.js");
  var HERE=(location.pathname.split("/").pop()||"index.html");
  var KINDS=["All","Syllabus","Guide","Ledger","Weekly log","Problem"];
  var idx=null, loading=null, box=null, inp=null, list=null, stat=null, kind="All", hits=[], sel=0, lastFocus=null;

  function css(){
    var st=document.createElement("style");
    st.textContent=[
      ".gs-btn{display:inline-flex;align-items:center;gap:7px}",
      ".gs-btn kbd{font:inherit;font-size:.85em;opacity:.65;border:1px solid var(--rule,#ccc);padding:0 4px;border-radius:2px}",
      ".gs{position:fixed;inset:0;z-index:1000;display:flex;justify-content:center;align-items:flex-start;padding:8vh 16px 16px;background:rgba(10,12,16,.45)}",
      ".gs[hidden]{display:none}",
      ".gs__p{--gs-a:var(--lnk,var(--java,var(--c,#2b6a9e)));width:100%;max-width:720px;max-height:80vh;display:flex;flex-direction:column;background:var(--paper,#fff);color:var(--ink,#111);border:1px solid var(--rule,#ccc);box-shadow:0 18px 50px rgba(0,0,0,.28)}",
      ".gs__top{display:flex;gap:10px;align-items:center;padding:12px 14px;border-bottom:1px solid var(--rule,#ccc)}",
      ".gs__in{flex:1;min-width:0;font:inherit;font-size:1.05rem;padding:8px 10px;background:var(--surface,#fff);color:var(--ink,#111);border:1px solid var(--rule,#ccc);outline:none}",
      ".gs__in:focus{border-color:var(--gs-a)}",
      ".gs__x{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;background:transparent;border:1px solid var(--rule,#ccc);color:var(--muted,#666);padding:7px 9px;cursor:pointer}",
      ".gs__k{display:flex;flex-wrap:wrap;gap:6px;padding:9px 14px;border-bottom:1px solid var(--rule-soft,var(--rule,#ddd))}",
      ".gs__k button{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;padding:4px 9px;background:transparent;color:var(--muted,#666);border:1px solid var(--rule,#ccc);cursor:pointer}",
      ".gs__k button[aria-pressed=true]{border-color:var(--gs-a);color:var(--gs-a)}",
      ".gs__k button span{opacity:.7;margin-left:4px}",
      ".gs__l{list-style:none;margin:0;padding:4px 0;overflow:auto;flex:1}",
      ".gs__l li{padding:9px 14px;cursor:pointer;border-left:3px solid transparent}",
      ".gs__l li[aria-selected=true]{background:var(--sunk,#f2f2f2);border-left-color:var(--gs-a)}",
      ".gs__t{display:block;font-size:.95rem;line-height:1.35;color:var(--ink,#111)}",
      ".gs__c{display:flex;gap:8px;align-items:baseline;margin-top:3px;font-size:.78rem;color:var(--muted,#666);min-width:0}",
      ".gs__c i{font-style:normal;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:var(--gs-a);border:1px solid currentColor;padding:0 4px;flex:none}",
      ".gs__c span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".gs__s{display:block;margin-top:3px;font-size:.8rem;color:var(--faint,#888);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".gs mark{background:transparent;color:var(--gs-a);font-weight:600}",
      ".gs__f{padding:8px 14px;border-top:1px solid var(--rule,#ccc);font-size:.76rem;color:var(--faint,#888);display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}",
      ".gs__e{padding:22px 14px;color:var(--muted,#666);font-size:.9rem}",
      "@keyframes gsflash{0%{box-shadow:0 0 0 3px var(--lnk,var(--java,var(--c,#2b6a9e)))}100%{box-shadow:0 0 0 3px transparent}}",
      ".gs-flash{animation:gsflash 2.2s ease-out 1}",
      ".is-armed{color:var(--hard,#b3261e)!important;border-color:var(--hard,#b3261e)!important}",
      "@media (max-width:600px){.gs{padding:0}.gs__p{max-height:100vh;height:100%;border:0}.gs-btn kbd{display:none}}"
    ].join("\n");
    document.head.appendChild(st);
  }

  function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g,function(c){
    return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; }); }

  function load(){
    if(idx) return Promise.resolve(idx);
    if(loading) return loading;
    loading=new Promise(function(res,rej){
      var s=document.createElement("script"); s.src=IDX_URL; s.async=true;
      s.onload=function(){
        var d=window.__GS_IDX; if(!d){ rej(new Error("empty index")); return; }
        idx=d.items.map(function(r){
          var t=r[2]||"", c=r[3]||"";
          return {p:d.pages[r[0]][0], pn:d.pages[r[0]][1], h:r[1], t:t, c:c, x:r[4]||"", k:r[5],
                  lt:t.toLowerCase(), lc:c.toLowerCase(), lx:(r[4]||"").toLowerCase()};
        });
        res(idx);
      };
      s.onerror=function(){ loading=null; rej(new Error("could not load search-index.js")); };
      document.head.appendChild(s);
    });
    return loading;
  }

  function build(){
    box=document.createElement("div");
    box.className="gs"; box.hidden=true;
    box.innerHTML='<div class="gs__p" role="dialog" aria-modal="true" aria-label="Search the study kit">'
      +'<div class="gs__top"><input class="gs__in" type="search" placeholder="Search topics, chapters, questions, problems…" aria-label="Search everything" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="true" aria-controls="gs-list">'
      +'<button class="gs__x" type="button">Esc</button></div>'
      +'<div class="gs__k" role="group" aria-label="Filter by type"></div>'
      +'<ul class="gs__l" id="gs-list" role="listbox" aria-label="Results"></ul>'
      +'<div class="gs__f"><span class="gs__st"></span><span>↑↓ move · Enter open · Esc close</span></div></div>';
    document.body.appendChild(box);
    inp=box.querySelector(".gs__in"); list=box.querySelector(".gs__l"); stat=box.querySelector(".gs__st");
    var t; inp.addEventListener("input",function(){ clearTimeout(t); t=setTimeout(run,70); });
    box.addEventListener("click",function(ev){
      if(ev.target===box||ev.target.closest(".gs__x")){ close(); return; }
      var k=ev.target.closest("[data-kind]");
      if(k){ kind=k.getAttribute("data-kind"); run(); inp.focus(); return; }
      var li=ev.target.closest("li[data-i]");
      if(li) go(hits[+li.getAttribute("data-i")]);
    });
    box.addEventListener("keydown",function(ev){
      if(ev.key==="Escape"){ ev.preventDefault(); close(); }
      else if(ev.key==="ArrowDown"){ ev.preventDefault(); move(1); }
      else if(ev.key==="ArrowUp"){ ev.preventDefault(); move(-1); }
      else if(ev.key==="Enter"){ if(hits[sel]){ ev.preventDefault(); go(hits[sel]); } }
      else if(ev.key==="Tab"){ ev.preventDefault(); inp.focus(); }
    });
  }

  function open(){
    if(!box) build();
    lastFocus=document.activeElement;
    box.hidden=false; document.documentElement.style.overflow="hidden";
    inp.focus(); inp.select();
    if(!idx){ list.innerHTML='<li class="gs__e" role="presentation">Loading the index…</li>'; }
    load().then(run,function(e){ list.innerHTML='<li class="gs__e" role="presentation">Search is unavailable: '+esc(e.message)+'</li>'; });
  }
  function close(){
    if(!box||box.hidden) return;
    box.hidden=true; document.documentElement.style.overflow="";
    if(lastFocus&&lastFocus.focus) lastFocus.focus();
  }

  function score(it,terms,phrase){
    var s=0;
    for(var i=0;i<terms.length;i++){
      var w=terms[i], p=it.lt.indexOf(w);
      if(p>-1){ s+=10+(p===0||/\W/.test(it.lt.charAt(p-1))?5:0); continue; }
      if(it.lc.indexOf(w)>-1){ s+=4; continue; }
      if(it.lx.indexOf(w)>-1){ s+=1; continue; }
      return 0;
    }
    if(terms.length>1&&it.lt.indexOf(phrase)>-1) s+=15;
    if(it.p===HERE) s+=1;
    return s;
  }

  function mark(s,terms){
    var h=esc(s);
    terms.forEach(function(w){
      if(w.length<2) return;
      var re=new RegExp("("+esc(w).replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+")","ig");
      h=h.replace(/(<[^>]*>)|([^<]+)/g,function(m,tag,txt){ return tag?tag:txt.replace(re,"<mark>$1</mark>"); });
    });
    return h;
  }

  function snippet(x,terms){
    if(!x) return "";
    var lx=x.toLowerCase(), p=-1;
    for(var i=0;i<terms.length&&p<0;i++) p=lx.indexOf(terms[i]);
    if(p<0) return x.slice(0,140);
    var a=Math.max(0,p-50);
    return (a?"…":"")+x.slice(a,a+160);
  }

  function run(){
    if(!idx) return;
    var q=inp.value.trim().toLowerCase(), terms=q.split(/\s+/).filter(Boolean);
    var counts={All:0};
    var scored=[];
    if(terms.length){
      for(var i=0;i<idx.length;i++){
        var it=idx[i], s=score(it,terms,q);
        if(!s) continue;
        counts.All++; counts[it.k]=(counts[it.k]||0)+1;
        if(kind==="All"||it.k===kind) scored.push([s,i]);
      }
      scored.sort(function(a,b){ return b[0]-a[0]||a[1]-b[1]; });
    }
    hits=scored.slice(0,60).map(function(p){ return idx[p[1]]; });
    sel=0;
    box.querySelector(".gs__k").innerHTML=KINDS.map(function(k){
      return '<button type="button" data-kind="'+k+'" aria-pressed="'+(k===kind)+'">'+k
        +(terms.length?'<span>'+(counts[k]||0)+'</span>':'')+'</button>';
    }).join("");
    if(!terms.length){
      stat.textContent=idx.length.toLocaleString()+" entries across the kit";
      list.innerHTML='<li class="gs__e" role="presentation">Type to search syllabus topics and notes, guide chapters, ledger questions, weekly-log steps and problems. Try <b>idempotency</b>, <b>closure</b>, <b>kafka</b> or <b>two sum</b>.</li>';
      return;
    }
    stat.textContent=scored.length?(scored.length>60?"Top 60 of "+scored.length:scored.length+" result"+(scored.length>1?"s":"")):"";
    if(!hits.length){ list.innerHTML='<li class="gs__e" role="presentation">Nothing matches “'+esc(inp.value.trim())+'”'+(kind!=="All"?" in "+esc(kind)+". Try All.":". Try fewer or shorter words.")+'</li>'; return; }
    list.innerHTML=hits.map(function(h,i){
      var sn=snippet(h.x,terms);
      return '<li role="option" id="gs-o'+i+'" data-i="'+i+'" aria-selected="'+(i===0)+'">'
        +'<span class="gs__t">'+mark(h.t,terms)+'</span>'
        +'<span class="gs__c"><i>'+esc(h.k)+'</i><span>'+esc(h.p===HERE?h.c:h.pn+" · "+h.c)+'</span></span>'
        +(sn?'<span class="gs__s">'+mark(sn,terms)+'</span>':'')+'</li>';
    }).join("");
    inp.setAttribute("aria-activedescendant","gs-o0");
  }

  function move(d){
    if(!hits.length) return;
    var lis=list.querySelectorAll("li[data-i]");
    lis[sel].setAttribute("aria-selected","false");
    sel=(sel+d+hits.length)%hits.length;
    lis[sel].setAttribute("aria-selected","true");
    lis[sel].scrollIntoView({block:"nearest"});
    inp.setAttribute("aria-activedescendant","gs-o"+sel);
  }

  function go(h){
    if(!h) return;
    if(h.p===HERE){
      close();
      if(location.hash==="#"+h.h) reveal(h.h); else location.hash=h.h;
    } else {
      location.href=h.p+"#"+h.h;
    }
  }

  /* ---- arrival: open everything collapsed around the target ---- */
  function controller(id){
    var q='[aria-controls="'+(window.CSS&&CSS.escape?CSS.escape(id):id)+'"]';
    return document.querySelector(q);
  }
  function reveal(hash){
    hash=decodeURIComponent(String(hash||"").replace(/^#/,""));
    if(!hash) return false;
    var parts=hash.split("/"), el=document.getElementById(parts[0]);
    if(!el) return false;
    var chain=[];
    for(var n=el;n&&n!==document.body;n=n.parentElement){ if(n.id) chain.unshift(n); }
    chain.forEach(function(n){
      var b=controller(n.id);
      if(!b) { if(n.hidden&&n!==el) n.hidden=false; return; }
      var collapsed=n.hidden||b.getAttribute("aria-expanded")==="false"||b.getAttribute("aria-selected")==="false";
      if(collapsed) b.click();
      if(n.hidden) n.hidden=false;
    });
    var tgt=el;
    if(parts[1]){
      var v=window.CSS&&CSS.escape?CSS.escape(parts[1]):parts[1];
      var r=el.querySelector('[data-row="'+v+'"],[data-trk="'+v+'"]');
      if(r) tgt=r;
    }
    if(el.classList.contains("det")&&el.closest(".topic")) tgt=el.closest(".topic");
    for(var p=tgt;p&&p!==document.body;p=p.parentElement){ if(p.classList&&p.classList.contains("is-hidden")) p.classList.remove("is-hidden"); }
    setTimeout(function(){
      tgt.style.scrollMarginTop="96px";
      tgt.scrollIntoView({block:"start"});
      tgt.classList.remove("gs-flash"); void tgt.offsetWidth; tgt.classList.add("gs-flash");
    },80);
    return true;
  }
  window.gsReveal=reveal;

  /* Two-click confirm. window.confirm() is blocked inside the artifact
     viewer's frame (it returns false without showing anything), so a
     destructive button asks for a second click instead. */
  window.armConfirm=function(btn,label){
    if(!btn) return false;
    if(btn.getAttribute("data-armed")==="1"){
      clearTimeout(btn.__armT); btn.removeAttribute("data-armed"); btn.classList.remove("is-armed");
      btn.textContent=btn.__armOrig; return true;
    }
    btn.__armOrig=btn.textContent; btn.setAttribute("data-armed","1"); btn.classList.add("is-armed"); btn.textContent=label;
    btn.__armT=setTimeout(function(){ btn.removeAttribute("data-armed"); btn.classList.remove("is-armed"); btn.textContent=btn.__armOrig; },5000);
    return false;
  };

  function init(){
    css();
    document.addEventListener("click",function(ev){
      var b=ev.target.closest&&ev.target.closest("[data-gsearch]");
      if(b){ ev.preventDefault(); open(); }
    });
    document.addEventListener("keydown",function(ev){
      if(box&&!box.hidden) return;
      var t=ev.target, typing=t&&(t.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      if((ev.key==="k"||ev.key==="K")&&(ev.metaKey||ev.ctrlKey)){ ev.preventDefault(); open(); }
      else if(ev.key==="/"&&!typing&&!ev.metaKey&&!ev.ctrlKey&&!ev.altKey){
        if(document.querySelector("dialog[open]")) return;
        ev.preventDefault(); open();
      }
    });
    window.addEventListener("hashchange",function(){ reveal(location.hash); });
    if(location.hash) setTimeout(function(){ reveal(location.hash); },0);
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init); else init();
})();
