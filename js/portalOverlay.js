"use strict";

/* ============================================================
   A small progress panel drawn ON the portal page.

   The scrapers run inside the portal tab, where the only feedback used
   to be console output nobody has open. The catalog scrape takes about
   four minutes -- without a sign of life that reads as "nothing
   happened", which is exactly the bug this project already had once.

   Loaded by both scrapers from the planner. If it fails to load they
   fall back to console logging, so this is never a hard dependency.

   KEEP THIS FILE PURE ASCII: it is injected into the portal's gb2312
   page (see the note in tools/portal-schedule-scrape.js).
   ============================================================ */

function thuOverlay(title){
  var doc = document, box, bar, fill, msg, closed = false;

  function build(){
    box = doc.createElement("div");
    box.setAttribute("style", [
      "position:fixed", "right:18px", "bottom:18px", "z-index:2147483647",
      "width:280px", "padding:14px 16px", "box-sizing:border-box",
      "background:#ffffff", "border:1px solid #d9cfe0", "border-left:4px solid #660874",
      "border-radius:12px", "box-shadow:0 8px 28px rgba(28,20,36,.25)",
      "font:13px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      "color:#1c1424"
    ].join(";"));

    var h = doc.createElement("div");
    h.textContent = title;
    h.setAttribute("style", "font-weight:650;font-size:13.5px;margin-bottom:8px;color:#660874");
    box.appendChild(h);

    msg = doc.createElement("div");
    msg.setAttribute("style", "color:#6b6675;min-height:18px");
    box.appendChild(msg);

    bar = doc.createElement("div");
    bar.setAttribute("style", "height:5px;border-radius:99px;background:#eee6f1;margin-top:10px;overflow:hidden");
    fill = doc.createElement("div");
    fill.setAttribute("style", "height:100%;width:0%;background:#660874;border-radius:99px;transition:width .25s");
    bar.appendChild(fill);
    box.appendChild(bar);

    (doc.body || doc.documentElement).appendChild(box);
  }

  try{ build(); }catch(e){ /* a page we cannot draw on: stay silent */ }

  return {
    /* done/total optional: without them the bar just sits at its width. */
    step: function(text, done, total){
      try{
        if(msg) msg.textContent = text;
        if(fill && total) fill.style.width = Math.round((done / total) * 100) + "%";
      }catch(e){}
      if(typeof console !== "undefined") console.log(text);
    },
    finish: function(text, ok){
      try{
        if(msg) msg.textContent = text;
        if(fill){ fill.style.width = "100%"; if(ok === false) fill.style.background = "#b3261e"; }
        if(box){
          if(ok === false) box.style.borderLeftColor = "#b3261e";
          setTimeout(function(){ remove(); }, ok === false ? 9000 : 3500);
        }
      }catch(e){}
      if(typeof console !== "undefined") console.log(text);
    },
    remove: remove
  };

  function remove(){
    if(closed) return;
    closed = true;
    try{ if(box && box.parentNode) box.parentNode.removeChild(box); }catch(e){}
  }
}
