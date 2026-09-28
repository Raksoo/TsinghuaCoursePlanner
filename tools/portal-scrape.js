/* ============================================================
   Tsinghua portal -> data/catalog-portal.json
   ------------------------------------------------------------
   Read-only snapshot of "Query courses open this semester"
   (Function menu -> Course registration information query).
   Run it in YOUR logged-in browser; the app never talks to the
   portal itself.

   HOW TO RUN (Safari: Develop -> Show JavaScript Console; Chrome: Option-Cmd-J)
   1. Open the "Query courses open this semester" page, leave the
      filters at "All departments" (or narrow them -- the snapshot
      then only holds what the page would list).
   2. Paste this whole file into the console, press Return.
   3. Test first:      thuScrape({ pages: 3 })
      Full run:        thuScrape()
      Resume later:    thuScrape({ resume: true })   (after a break/error)
   4. When it finishes, a file catalog-portal.json is downloaded.
      Move it to data/ in the planner repo and commit.

   It fetches exactly what clicking "Next" would fetch, one page at
   a time, with a pause between pages (default 800 ms + jitter) --
   about 3-4 minutes for 252 pages. Nothing is written to the portal.
   Progress is kept in sessionStorage so a stopped run can resume.
   ============================================================ */
(function(){
  "use strict";
  const STORE = "thu-scrape-progress";
  const FALLBACK_APP = "https://raksoo.github.io/TsinghuaCoursePlanner/";

  /* Loaded by the bookmarklet, `document.currentScript` is this <script>, and
     its src says which planner sent us. Pasted into a console it is null. */
  const ME = document.currentScript;
  const APP = ME ? ME.src.replace(/tools\/[^/]*$/, "") : FALLBACK_APP;

  /* Progress panel on the portal page. This scrape runs for ~4 minutes;
     without a visible sign of life it reads as "nothing happened". */
  function loadOverlay(base){
    if(typeof thuOverlay === "function") return Promise.resolve();
    return new Promise((resolve)=>{
      const s = document.createElement("script");
      s.src = base.replace(/\/?$/, "/") + "js/portalOverlay.js?" + Date.now();
      s.onload = resolve; s.onerror = resolve;          // optional by design
      document.head.appendChild(s);
    });
  }
  function fakeOverlay(){
    return { step: t=>console.log(t), finish: t=>console.log(t), remove: ()=>{} };
  }

  function findFormDoc(){
    // The list lives in the iframe named "right"; also works if you
    // switched the console context to that frame already.
    if(document.forms.frm) return document;
    const fr = window.frames["right"];
    try{ if(fr && fr.document && fr.document.forms.frm) return fr.document; }catch(e){}
    const ifr = document.querySelector('iframe[name="right"]');
    try{ if(ifr && ifr.contentDocument && ifr.contentDocument.forms.frm) return ifr.contentDocument; }catch(e){}
    throw new Error("Search form not found -- open 'Query courses open this semester' first.");
  }
  const sleep = ms => new Promise(r=>setTimeout(r, ms));
  const strip = html => { const d = document.createElement("div"); d.innerHTML = html||""; return (d.textContent||"").replace(/\s+/g," ").trim(); };
  const links = html => { const d = document.createElement("div"); d.innerHTML = html||""; const a=[...d.querySelectorAll("a")].map(x=>x.textContent.trim()).filter(Boolean); return a.length ? a.join(", ") : strip(html); };

  /* The page embeds the table as `var gridData = [[...],[...]];` -- take that
     block and evaluate it (it is plain array/string literals plus comments). */
  function parsePage(html){
    const a = html.indexOf("var gridData");
    if(a < 0) throw new Error("gridData not found in response (session expired? filters changed?)");
    const b = html.indexOf("</script>", a);
    let body = html.slice(a, b);
    body = body.slice(body.indexOf("=")+1).trim().replace(/;\s*$/, "");
    const rows = Function("return ("+body+")")();
    const mTot = html.match(/Total\s+([\d,]+)\s+page/i);
    const mRec = html.match(/Total\s+([\d,]+)\s+records/i);
    const mTok = html.match(/name="token"\s+value="([^"]+)"/);
    return {
      rows: rows.map(r=>({
        titleEn: strip(r[0]), titleCn: strip(r[1]), number: strip(r[2]), seq: strip(r[3]),
        credits: parseFloat(strip(r[4])) || 0, dept: strip(r[5]), instructor: links(r[6]),
        time: strip(r[7]), features: strip(r[8]), remarks: strip(r[9])
      })),
      totalPages: mTot ? parseInt(mTot[1].replace(/,/g,""),10) : null,
      totalRecords: mRec ? parseInt(mRec[1].replace(/,/g,""),10) : null,
      token: mTok ? mTok[1] : null
    };
  }

  async function fetchPage(doc, page, token){
    const frm = doc.forms.frm;
    const fd = new URLSearchParams();
    [...frm.elements].forEach(e=>{ if(e.name && e.type!=="button" && e.type!=="submit") fd.set(e.name, e.value); });
    fd.set("m", "jxsKkxxSearch");
    fd.set("page", String(page));
    fd.set("goPageNumber", String(page));
    if(token) fd.set("token", token);
    const url = new URL(frm.getAttribute("action"), doc.location.href).href;
    const res = await fetch(url, { method:"POST", body:fd, credentials:"include",
      headers:{ "Content-Type":"application/x-www-form-urlencoded" } });
    if(!res.ok) throw new Error("HTTP "+res.status+" on page "+page);
    // The portal serves gb2312, not UTF-8 -- res.text() would garble every
    // Chinese character. Decode with the charset the response declares
    // (header, else <meta>), defaulting to GBK.
    const bytes = await res.arrayBuffer();
    const ct = res.headers.get("content-type") || "";
    let charset = (ct.match(/charset=([\w-]+)/i) || [])[1];
    if(!charset){
      const head = new TextDecoder("latin1").decode(bytes.slice(0, 4096));
      charset = (head.match(/charset=([\w-]+)/i) || [])[1] || "gbk";
    }
    let html;
    try{ html = new TextDecoder(charset).decode(bytes); }
    catch(e){ html = new TextDecoder("gbk").decode(bytes); }
    return parsePage(html);
  }

  /* The planner tab. See the long note in tools/portal-schedule-scrape.js:
     the bookmarklet opens it inside the click, because a window opened after
     four minutes of scraping would be blocked as a pop-up. */
  function plannerWindow(base){
    if("__thuPlanner" in window) return window.__thuPlanner || null;
    try{ return window.open(base.replace(/\/?$/, "/") + "?import=catalog", "thu-planner") || null; }
    catch(e){ return null; }
  }

  const APP_ORIGIN = (function(){ try{ return new URL(APP).origin; }catch(e){ return "*"; } })();
  let planner = null, plannerReady = false, lastProgress = null;

  window.addEventListener("message", function(e){
    if(e.origin !== APP_ORIGIN) return;
    if(e.data && e.data.kind === "thu-ready"){
      plannerReady = true;
      if(lastProgress) post(lastProgress);
    }
    if(e.data && e.data.kind === "thu-cancel") cancelled = true;
  });

  /* Calling it off from the planner tab. The catalog scrape runs for minutes,
     and hunting for the right tab to stop it is not a reasonable ask.
     Closing the planner counts as cancelling too -- there is nowhere left to
     send the result. */
  let cancelled = false;
  function cancelRequested(){
    return cancelled || (planner && planner.closed);
  }
  function tellCancelled(text){
    try{ if(planner && !planner.closed) planner.postMessage({ kind:"thu-cancelled", text: text || "" }, APP_ORIGIN); }catch(e){}
  }

  function post(msg){
    try{ if(planner && !planner.closed) planner.postMessage(msg, APP_ORIGIN); }catch(e){}
  }
  function progress(text, done, total){
    lastProgress = { kind:"thu-progress", what:"catalog", text: text, done: done, total: total };
    if(plannerReady) post(lastProgress);
  }

  function sendToApp(base, payload){
    if(!planner){
      console.warn("The planner tab was blocked -- downloading the file instead;\n" +
                   "open the planner and drop it into the import dialog.");
      download(payload, "catalog-portal.json");
      return false;
    }
    let tries = 0;
    const timer = setInterval(function(){
      if(++tries > 90 || (planner && planner.closed)){
        clearInterval(timer);
        console.warn("The planner did not answer -- downloading the file instead.");
        download(payload, "catalog-portal.json");
        return;
      }
      post({ kind:"thu-import", what:"catalog", payload: payload });
    }, 400);
    window.addEventListener("message", function ack(e){
      if(e.origin === APP_ORIGIN && e.data && e.data.kind === "thu-import-ok"){
        clearInterval(timer);
        window.removeEventListener("message", ack);
        console.log("[OK] Sent to the planner -- switch to that tab to finish the import.");
      }
    });
    return true;
  }

  function download(obj, name){
    const blob = new Blob([JSON.stringify(obj, null, 1)], {type:"application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  window.thuScrape = async function(opts){
    opts = Object.assign({ pages: 0, delay: 800, resume: false, send: true, app: APP }, opts||{});
    planner = opts.send ? plannerWindow(opts.app) : null;
    await loadOverlay(opts.app);
    const panel = typeof thuOverlay === "function" ? thuOverlay("Tsinghua Course Planner") : fakeOverlay();
    const ui = {
      step: function(t, d, n){ panel.step(t, d, n); progress(t, d, n); },
      finish: function(t, ok){ panel.finish(t, ok); if(ok === false) progress(t); }
    };
    if(opts.send && !planner){
      panel.step("Your browser blocked the planner tab -- allow pop-ups for this page, or use the file this will download.");
    }
    ui.step("Opening the course list...");
    const doc = findFormDoc();
    const frm = doc.forms.frm;
    const semester = (frm.elements["p_xnxq"]||{}).value || "";
    const filters = {};
    ["p_kkdwnm","p_kch","p_kcm","p_xm","p_skxq","p_skjc"].forEach(k=>{ const e=frm.elements[k]; if(e && e.value) filters[k]=e.value; });

    let rows = [], start = 1, token = null, totalPages = null, totalRecords = null;
    if(opts.resume){
      try{
        const p = JSON.parse(sessionStorage.getItem(STORE)||"null");
        if(p && p.semester===semester){ rows = p.rows; start = p.nextPage; totalPages = p.totalPages; totalRecords = p.totalRecords; console.log("Resuming at page", start, "with", rows.length, "rows so far"); }
      }catch(e){}
    }
    const seen = new Set(rows.map(r=>r.number+"-"+r.seq));

    console.log("thuScrape: semester", semester, "filters", filters, opts.pages ? "(test: "+opts.pages+" pages)" : "(full run)");
    for(let page = start; ; page++){
      if(cancelRequested()){
        // The resume state is already in sessionStorage, so a cancelled run
        // can be picked up later with thuScrape({resume:true}).
        sessionStorage.setItem(STORE, JSON.stringify({ semester, rows, nextPage: page, totalPages, totalRecords }));
        ui.finish("Stopped at page " + page + " -- run thuScrape({resume:true}) to continue later.", false);
        tellCancelled("Stopped after " + rows.length + " courses.");
        return null;
      }
      let data;
      try{ data = await fetchPage(doc, page, token); }
      catch(err){
        ui.finish("Stopped at page " + page + " -- " + err.message + ". Run thuScrape({resume:true}) to continue.", false);
        console.error("Stopped at page", page, "--", err.message, "\nRun thuScrape({resume:true}) to continue.");
        sessionStorage.setItem(STORE, JSON.stringify({ semester, rows, nextPage: page, totalPages, totalRecords }));
        return null;
      }
      if(data.token) token = data.token;
      if(data.totalPages) totalPages = data.totalPages;
      if(data.totalRecords) totalRecords = data.totalRecords;
      let added = 0;
      data.rows.forEach(r=>{ const k=r.number+"-"+r.seq; if(!seen.has(k)){ seen.add(k); rows.push(r); added++; } });
      ui.step("Page " + page + (totalPages ? " of " + totalPages : "") + " -- " + rows.length + " courses",
              page, totalPages || 0);
      if(page % 10 === 0 || page === 1) console.log("page", page, "/", totalPages, "-", rows.length, "rows");
      sessionStorage.setItem(STORE, JSON.stringify({ semester, rows, nextPage: page+1, totalPages, totalRecords }));
      const last = (totalPages && page >= totalPages) || (opts.pages && page >= opts.pages) || (!data.rows.length) || (added===0 && page>1);
      if(last) break;
      await sleep(opts.delay + Math.random()*400);
    }

    const out = {
      source: "Tsinghua Info portal -- Query courses open this semester (read-only snapshot, own account)",
      snapshot: new Date().toISOString().slice(0,10),
      semester, filters,
      totalRecordsReported: totalRecords,
      courses: rows
    };
    console.log("Done:", rows.length, "rows", totalRecords ? "(portal reports "+totalRecords+")" : "");
    if(!opts.pages) sessionStorage.removeItem(STORE);
    window.thuScrapeResult = out;
    if(opts.send !== false){
      const sent = sendToApp(opts.app || APP, out);
      ui.finish(sent
        ? "Done -- " + rows.length + " courses sent to the planner."
        : "Done -- " + rows.length + " courses saved to a file (the tab was blocked).", sent);
    } else {
      ui.finish("Done -- " + rows.length + " courses saved to a file.");
      download(out, opts.pages ? "catalog-portal-test.json" : "catalog-portal.json");
    }
    return out;
  };
  if(ME){
    // Came from the bookmarklet: the click was the instruction.
    console.log("Reading the catalog -- this takes a few minutes. Leave this tab open.");
    window.thuScrape();
  } else {
    console.log("Ready. Test with thuScrape({ pages: 3 }) -- full run with thuScrape().");
  }
})();
