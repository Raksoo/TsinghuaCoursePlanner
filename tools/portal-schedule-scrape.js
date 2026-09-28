/* ============================================================
   Tsinghua portal "My timetable" -> your planner

   Reads the timetable page you are looking at and hands the result
   to the planner. Nothing is written to the portal, nothing leaves
   your browser except to your own planner tab.

   THE EASY WAY: use the " THU Schedule" bookmarklet from the
   planner (Data & sharing -> Portal tools). It runs this file for you.

   THE MANUAL WAY (Safari: Develop -> Show JavaScript Console,
   Chrome: Option-Cmd-J):
   1. Open the portal page that shows your timetable.
   2. Paste this whole file into the console, press Return.
   3. Run:   thuSchedule()
   Your planner opens in a new tab with the import preview.

   Options:
     thuSchedule({ send:false })      only print the result, open nothing
     thuSchedule({ details:false })   skip the per-course detail pages
     thuSchedule({ app:"http://localhost:8765/" })   local dev planner
   ============================================================ */
/* KEEP THIS FILE PURE ASCII.
   It is injected into the portal page, which declares charset=gb2312. A
   classic <script src> without a charset of its own is decoded using the
   *document's* encoding, so a UTF-8 byte here can come out as mojibake --
   and a mangled character inside a regex literal is a SyntaxError that
   defines nothing and fails silently. GitHub Pages happens to send
   "charset=utf-8" and would save us; a plain dev server does not. Write any
   non-ASCII character as a \uXXXX escape. tests/storage.test.mjs enforces
   this. Same rule for js/scheduleParse.js, which this file loads. */
(function(){
  "use strict";

  const FALLBACK_APP = "https://raksoo.github.io/TsinghuaCoursePlanner/";

  /* Loaded by the bookmarklet, `document.currentScript` is this <script> and
     its src tells us which planner sent us -- localhost while developing, the
     live site otherwise. Pasted into the console there is no currentScript. */
  const ME = document.currentScript;
  const APP = ME ? ME.src.replace(/tools\/[^/]*$/, "") : FALLBACK_APP;

  /* The parser lives in the planner (js/scheduleParse.js) so that the
     scraper and the app can never drift apart. A <script> tag is not
     subject to CORS, so it loads into the portal page even though the
     planner sits on a different origin. */
  /* The on-page progress panel is a nice-to-have: if it will not load we
     carry on with console output rather than failing the scrape. */
  function loadOverlay(base){
    if(typeof thuOverlay === "function") return Promise.resolve();
    return loadScript(base, "js/portalOverlay.js").catch(()=>{});
  }
  function fakeOverlay(){
    return { step: t=>console.log(t), finish: t=>console.log(t), remove: ()=>{} };
  }

  function loadScript(base, path){
    return new Promise((resolve, reject)=>{
      const s = document.createElement("script");
      s.src = base.replace(/\/?$/, "/") + path + "?" + Date.now();
      s.onload = ()=>resolve();
      s.onerror = ()=>reject(new Error("could not load " + path));
      document.head.appendChild(s);
    });
  }

  function loadParser(base){
    if(typeof parseSchedulePage === "function") return Promise.resolve();
    return new Promise((resolve, reject)=>{
      const s = document.createElement("script");
      s.src = base.replace(/\/?$/, "/") + "js/scheduleParse.js?" + Date.now();
      s.onload = ()=> typeof parseSchedulePage === "function"
        ? resolve()
        : reject(new Error("scheduleParse.js loaded but defined nothing"));
      s.onerror = ()=> reject(new Error(
        "Could not load the parser from " + base + ".\n" +
        "Use the planner's 'paste the page source' import instead:\n" +
        "  Option-Cmd-U -> Cmd-A -> Cmd-C, then paste it into the planner."));
      document.head.appendChild(s);
    });
  }

  /* BLOCKS comes from the planner's core.js; the parser needs it to turn
     a block number into clock times. Defined here so the scraper stays a
     single file -- identical to core.js, and covered by the check below. */
  if(typeof BLOCKS === "undefined"){
    window.BLOCKS = [
      {n:1, start:"08:00", end:"09:35"},
      {n:2, start:"09:50", end:"12:15"},
      {n:3, start:"13:30", end:"15:05"},
      {n:4, start:"15:20", end:"16:55"},
      {n:5, start:"17:05", end:"18:40"},
      {n:6, start:"19:20", end:"21:45"}
    ];
  }

  /* The timetable may sit in a frame (the portal uses them elsewhere). */
  function findScheduleDoc(){
    if(document.querySelector("table.kebiao_table")) return document;
    for(let i = 0; i < window.frames.length; i++){
      try{
        const d = window.frames[i].document;
        if(d && d.querySelector("table.kebiao_table")) return d;
      }catch(e){ /* cross-origin frame -- skip */ }
    }
    throw new Error("No timetable on this page. Open the portal page that shows your weekly schedule, then run thuSchedule() again.");
  }

  /* The planner tab.

     The bookmarklet opened it INSIDE the click, where a browser still allows
     window.open; by the time this scrape finishes the gesture is long gone and
     opening one here would be blocked (which is what used to force a download).
     So: use the window the bookmarklet handed over. `__thuPlanner` present but
     null means the browser blocked it even there. Absent means we were pasted
     into a console, and then we may as well try. */
  function plannerWindow(base){
    if("__thuPlanner" in window) return window.__thuPlanner || null;
    try{ return window.open(base.replace(/\/?$/, "/") + "?import=schedule", "thu-planner") || null; }
    catch(e){ return null; }
  }

  const APP_ORIGIN = (function(){ try{ return new URL(APP).origin; }catch(e){ return "*"; } })();
  let planner = null, plannerReady = false, lastProgress = null;

  /* The planner tab is in front now, so its dialog is where progress belongs.
     It tells us when it is loaded; until then messages would be lost. */
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
    lastProgress = { kind:"thu-progress", what:"schedule", text: text, done: done, total: total };
    if(plannerReady) post(lastProgress);
  }

  function sendToApp(base, payload){
    if(!planner){
      console.warn("The planner tab was blocked -- downloading the file instead;\n" +
                   "open the planner and drop it into the import dialog.");
      download(payload, "thu-schedule.json");
      return false;
    }
    let tries = 0;
    const timer = setInterval(function(){
      if(++tries > 90 || (planner && planner.closed)){
        clearInterval(timer);
        console.warn("The planner did not answer -- downloading the file instead.");
        download(payload, "thu-schedule.json");
        return;
      }
      post({ kind:"thu-import", what:"schedule", payload: payload });
    }, 400);
    window.addEventListener("message", function ack(e){
      if(e.origin === APP_ORIGIN && e.data && e.data.kind === "thu-import-ok"){
        clearInterval(timer);
        window.removeEventListener("message", ack);
        console.log("[OK] Sent to the planner -- switch to that tab to review the import.");
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

  window.thuSchedule = async function(opts){
    opts = Object.assign({ send:true, app:APP, details:true }, opts||{});
    planner = opts.send ? plannerWindow(opts.app) : null;
    await loadOverlay(opts.app);
    const panel = typeof thuOverlay === "function" ? thuOverlay("Tsinghua Course Planner") : fakeOverlay();
    // Report to both: the panel for the console path, the planner tab for the
    // bookmarklet path (where the panel is hidden behind it).
    const ui = {
      step: function(t, d, n){ panel.step(t, d, n); progress(t, d, n); },
      finish: function(t, ok){ panel.finish(t, ok); if(ok === false) progress(t); }
    };
    if(opts.send && !planner){
      panel.step("Your browser blocked the planner tab -- allow pop-ups for this page, or use the file this will download.");
    }
    try{
      ui.step("Reading your timetable...");
      await loadParser(opts.app);
      const doc = findScheduleDoc();
      const result = parseSchedulePage(doc);
      if(!result.meetings.length){
        ui.finish("The timetable is empty -- nothing registered this semester?", false);
        console.warn("The timetable is empty -- no courses registered for this semester?");
      }
      console.log("Found " + result.meetings.length + " meeting(s):");
      console.table(result.meetings.map(m=>({
        course: m.titleEn, number: m.number + "-" + m.seq,
        day: m.day, blocks: m.blocks.join("+"), time: m.start + "-" + m.end,
        room: m.room, weeks: m.weeks
      })));

      if(opts.details && result.meetings.length){
        await addDetails(result.meetings, ui);
      }

      if(cancelRequested()){
        ui.finish("Stopped at your request.", false);
        tellCancelled("The timetable was read but not imported.");
        return null;
      }

      window.thuScheduleResult = result;
      if(opts.send){
        const sent = sendToApp(opts.app, result);
        ui.finish(sent
          ? "Done -- " + result.meetings.length + " meetings sent to the planner."
          : "Done -- " + result.meetings.length + " meetings saved to a file (the tab was blocked).", sent);
      } else {
        ui.finish("Done -- result is in window.thuScheduleResult");
      }
      return result;
    }catch(err){
      ui.finish(err.message, false);
      console.error(err.message);
      return null;
    }
  };

  /* The course detail pages: description, exam form, textbooks, credit hours.
     Their URLs come from the timetable itself -- one GET per course, about
     six in all. A failure costs one optional field and nothing else, so a
     course is never lost to a bad detail page. */
  async function addDetails(meetings, ui){
    const byCourse = new Map();
    for(const m of meetings){
      const key = m.number + "-" + m.seq;
      if(!byCourse.has(key)) byCourse.set(key, []);
      byCourse.get(key).push(m);
    }
    // `at` counts where we are, `done` how many actually came back: a
    // failed detail page must not freeze the counter at 1 of 6.
    let at = 0, done = 0;
    for(const [key, group] of byCourse){
      if(cancelRequested()) return;
      at++;
      ui.step("Course details " + at + " of " + byCourse.size + ": " + group[0].titleEn,
              at - 1, byCourse.size);
      try{
        const detail = await fetchDetail(group[0].detailUrl);
        group.forEach(m=>{ m.detail = detail; });
        done++;
      }catch(e){
        console.warn("No details for " + group[0].titleEn + " (" + e.message + ") -- importing without them.");
      }
      await new Promise(r=>setTimeout(r, 400));
    }
    ui.step("Course details: " + done + " of " + byCourse.size + " read.", byCourse.size, byCourse.size);
  }

  async function fetchDetail(url){
    const res = await fetch(new URL(url, location.href).href, { credentials:"include" });
    if(!res.ok) throw new Error("HTTP " + res.status);
    // The portal serves gb2312; res.text() would garble every Chinese
    // character. Decode with the charset the response declares.
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
    return parseCourseDetail(new DOMParser().parseFromString(html, "text/html"));
  }

  if(ME){
    // Came from the bookmarklet: the click WAS the instruction. Just go.
    window.thuSchedule();
  } else {
    console.log("Ready. Run  thuSchedule()  to read your timetable and send it to the planner.");
  }
})();
