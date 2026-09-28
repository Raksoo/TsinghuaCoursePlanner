"use strict";

/* ============================================================
   Getting data out of the Info portal and into the planner.

   The planner can never read the portal itself: different origin, no
   CORS, login cookie, and no backend to proxy through. The reading has
   to happen *inside* the portal tab. So this module is not a fetcher —
   it is the guided hand-off:

     1. give the user a one-click way to run the reader over there
        (bookmarklet, or the console snippet as a fallback),
     2. take the result back (postMessage from the portal tab, or a
        dropped/chosen file, or pasted page source),
     3. show what would change, and only then write.

   Nothing is ever written without the preview. Messages are only
   accepted from the portal's own origin.
   ============================================================ */

/* The course system (zhjwe) has no login of its own — it trusts the session
   you get from the Info portal. Opening a zhjwe link cold therefore fails;
   you have to sign in at info.tsinghua.edu.cn first, and only then does the
   direct link work. That is why step 1 below is the login, not the page. */
const PORTAL_ORIGIN = "http://zhjwe.cic.tsinghua.edu.cn";       // for the postMessage check
const PORTAL_LOGIN = "https://info.tsinghua.edu.cn/f/info/gxfw_fg/common/index";
const PORTAL_SCHEDULE_URL = "http://zhjwe.cic.tsinghua.edu.cn/xkJxs.vxkJxsXkbBs.do?url=/xkJxs.vxkJxsXkbBs.do&m=kbSearchforPortal";
/* The course registration system's own entry page. It is a frameset: the
   menu on the left, the list in an iframe on the right — which is why the
   catalog scraper looks for its form inside frames, not just in the top
   document. From here you pick the course query from the menu. */
const PORTAL_CATALOG_URL = "http://zhjwe.cic.tsinghua.edu.cn/xkJxs.vxkJxsXkbBs.do?url=/xkJxs.vxkJxsXkbBs.do&m=main&showtitle=0";

/* What the two imports have in common, so the dialog can stay one dialog. */
const PORTAL_IMPORTS = {
  catalog: {
    kind: "catalog",
    title: "Import the course catalog",
    lead: "Lists every course open this semester (~5,000). Do this once per semester. " +
          "The list stays in this browser — it is never uploaded anywhere.",
    pageUrl: PORTAL_CATALOG_URL,
    pageIcon: "\ud83d\udcda",
    pageLinkLabel: "Open course registration",
    pageHelp: "There, pick “Course registration information query” → “Query courses open this semester”, and leave the filters on “All departments”.",
    tool: "tools/portal-scrape.js",
    run: "thuScrape()",
    bookmarklet: "📚 THU Catalog",
    pageName: "the course list",
    takes: "about 4 minutes",
    accepts: "file",
  },
  schedule: {
    kind: "schedule",
    title: "Import my timetable",
    lead: "Reads the courses you are actually registered for — including the room, which the catalog does not have.",
    pageUrl: PORTAL_SCHEDULE_URL,
    pageIcon: "\ud83d\udcc5",
    pageLinkLabel: "Open my timetable",
    pageHelp: "It is also in the portal menu under “Course registration”, as the weekly timetable.",
    tool: "tools/portal-schedule-scrape.js",
    run: "thuSchedule()",
    bookmarklet: "📅 THU Schedule",
    pageName: "your timetable",
    takes: "a few seconds",
    accepts: "file-or-source",
  },
};

let portalImportWhat = "catalog";
let portalImportPending = null;       // validated record, waiting for confirmation

function appBaseUrl(){
  return location.origin + location.pathname.replace(/[^/]*$/, "");
}

/* A bookmarklet has to stay short, so it only loads the real tool from
   here. Script tags are not CORS-checked, so this works from the portal
   page even though it lives on another origin.

   The FIRST thing it does is open this planner, and that order is the whole
   point: a browser only allows window.open while a user gesture is running,
   and the gesture is gone the moment anything is awaited. Opening at the end
   of the scrape — after loading scripts and fetching pages — is what made
   Safari block the tab and fall back to a download. Opening here, still
   inside the click, is allowed. The scraper picks the window up from
   window.__thuPlanner; null means the browser blocked it anyway. */
function bookmarkletHref(cfg){
  const app = appBaseUrl();
  return "javascript:(function(){" +
         "try{window.__thuPlanner=window.open('" + app + "?import=" + cfg.kind + "','thu-planner');}catch(e){window.__thuPlanner=null;}" +
         "var s=document.createElement('script');" +
         "s.src='" + app + cfg.tool + "?'+Date.now();" +
         "s.onerror=function(){alert('Could not load the planner tool. Are you online?');};" +
         "document.body.appendChild(s);})()";
}

function openPortalImport(what){
  portalImportWhat = PORTAL_IMPORTS[what] ? what : "catalog";
  portalImportPending = null;
  renderPortalImport();
  const o = $("#portalModalOverlay"); if(o) o.hidden = false;
}
/* The primary action belongs next to Close, not stranded above it. One
   helper so the catalog and the timetable import cannot drift apart. */
function setPortalAction(btn){
  const bar = $("#portalActions"); if(!bar) return;
  const old = bar.querySelector(".portal-primary");
  if(old) old.remove();
  if(btn){ btn.classList.add("portal-primary"); bar.insertBefore(btn, bar.firstChild); }
}

function closePortalImport(){
  setPortalAction(null);
  const o = $("#portalModalOverlay"); if(o) o.hidden = true;
  portalImportPending = null;
}

function renderPortalImport(){
  const host = $("#portalModalBody"); if(!host) return;
  const cfg = PORTAL_IMPORTS[portalImportWhat];
  host.innerHTML = "";
  $("#portalModalTitle").textContent = cfg.title;

  host.appendChild(el("p","hint", cfg.lead));

  // Why this is not a button that just does it — asked once, in one line.
  const why = el("details","portal-why");
  why.appendChild(el("summary", null, "Why can’t the planner just fetch it?"));
  why.appendChild(el("p","hint",
    "The portal needs your login and only answers to pages from its own address. " +
    "This planner is a plain page with no server behind it, so the reading has to happen " +
    "in your portal tab — that is what the steps below do. Your login never passes through here."));
  host.appendChild(why);

  host.appendChild(portalStep(1,
    "Put the reader button in your bookmarks bar",
    "Drag the purple button below up into the bookmarks bar. You only ever do this once — " +
    "clicking it here does nothing, it has to sit up there.",
    portalRunOptions(cfg)));

  host.appendChild(portalStep(2,
    "Open " + cfg.pageName + " in the portal",
    "Sign in first: the course system has no login of its own, so its pages show an error " +
    "until you are signed in at info.tsinghua.edu.cn.",
    portalLoginLinks(cfg)));

  host.appendChild(portalStep(3,
    "Click the button while that page is open",
    "With " + cfg.pageName + " in front of you, click “" + cfg.bookmarklet + "” in your bookmarks bar. " +
    "This planner opens straight away and shows the progress (" + cfg.takes + "), then the result — " +
    "you do not have to type or run anything.",
    portalDropZone(cfg)));

  renderPortalPending();
}

function portalStep(n, title, text, extra){
  const box = el("div","portal-step");
  const head = el("div","portal-step-head");
  head.appendChild(el("span","step", String(n)));
  head.appendChild(el("b", null, title));
  box.appendChild(head);
  if(text) box.appendChild(el("p","hint", text));
  if(extra) box.appendChild(extra);
  return box;
}

/* Sign in first, then the page. The second link is only useful after the
   first one, so it says so instead of looking like an alternative. */
/* An emoji is an icon, not a word: it gets its own inline-block span so the
   link's underline stops at the label. (A child can only escape an
   ancestor's text-decoration by not being plain inline.) */
function iconLink(icon, label){
  const a = el("a","btn ghost small");
  a.appendChild(el("span","btn-ico", icon)).setAttribute("aria-hidden", "true");
  a.appendChild(el("span","btn-label", label));
  return a;
}

function portalLoginLinks(cfg){
  const wrap = el("div","portal-links");

  const a = el("div","portal-substep");
  a.appendChild(el("span","substep","a"));
  const aBody = el("div");
  const login = iconLink("🔑", "Sign in to the Info portal");
  login.href = PORTAL_LOGIN; login.target = "_blank"; login.rel = "noopener";
  aBody.appendChild(login);
  a.appendChild(aBody);
  wrap.appendChild(a);

  const b = el("div","portal-substep");
  b.appendChild(el("span","substep","b"));
  const bBody = el("div");
  if(cfg.pageUrl){
    const direct = iconLink(cfg.pageIcon, cfg.pageLinkLabel);
    direct.href = cfg.pageUrl; direct.target = "_blank"; direct.rel = "noopener";
    bBody.appendChild(direct);
    bBody.appendChild(el("p","hint",
      "Only works once (a) is done — otherwise the portal shows an error page. " + cfg.pageHelp));
  } else {
    bBody.appendChild(el("p","hint", "Then, in the portal menu: " + cfg.pageHelp));
  }
  b.appendChild(bBody);
  wrap.appendChild(b);
  return wrap;
}

function portalRunOptions(cfg){
  const wrap = el("div","portal-run");
  wrap.appendChild(el("div","drag-hint","⤒  drag this up into the bookmarks bar"));
  const bm = el("a","bookmarklet", cfg.bookmarklet);
  bm.href = bookmarkletHref(cfg);
  bm.title = "Drag me into the bookmarks bar";
  bm.draggable = true;
  bm.addEventListener("click", e=>{
    e.preventDefault();
    toast("Drag this button into your bookmarks bar — clicking it works only on the portal page");
  });
  wrap.appendChild(bm);

  const noBar = el("p","hint");
  noBar.appendChild(document.createTextNode("No bookmarks bar visible? In Safari press "));
  noBar.appendChild(el("kbd", null, "⌘⇧B"));
  noBar.appendChild(document.createTextNode(" (Chrome: "));
  noBar.appendChild(el("kbd", null, "⌘⇧B"));
  noBar.appendChild(document.createTextNode(") to show it."));
  wrap.appendChild(noBar);

  const alt = el("details","portal-alt");
  alt.appendChild(el("summary", null, "Prefer not to use a bookmark? Use the console instead"));
  const p = el("p","hint");
  p.appendChild(document.createTextNode("Copy the code, open the console on the portal page ("));
  p.appendChild(el("kbd", null, "⌥⌘C"));
  p.appendChild(document.createTextNode(" in Safari, "));
  p.appendChild(el("kbd", null, "⌥⌘J"));
  p.appendChild(document.createTextNode(" in Chrome), paste it, press Return, then type "));
  p.appendChild(el("code","k", cfg.run));
  p.appendChild(document.createTextNode("."));
  alt.appendChild(p);
  const copy = el("button","btn ghost small","Copy the code"); copy.type = "button";
  copy.addEventListener("click", ()=>{
    fetch(cfg.tool + "?" + Date.now())
      .then(r=>r.text())
      .then(txt=>navigator.clipboard.writeText(txt))
      .then(()=>toast("Code copied — paste it into the portal page’s console"))
      .catch(()=>toast("Could not copy — open " + cfg.tool + " and copy it by hand"));
  });
  alt.appendChild(copy);
  wrap.appendChild(alt);
  return wrap;
}

function portalDropZone(cfg){
  const wrap = el("div","portal-drop");
  const zone = el("div","dropzone");
  zone.appendChild(el("span","dz-icon","📄"));
  const label = el("span","dz-text","Only if your browser blocked the new tab: a file was downloaded instead — drop it here, or ");
  const pick = el("button","linkbtn","choose a file"); pick.type = "button";
  pick.addEventListener("click", ()=>$("#portalFile").click());
  label.appendChild(pick);
  zone.appendChild(label);
  ["dragenter","dragover"].forEach(ev=>zone.addEventListener(ev, e=>{ e.preventDefault(); zone.classList.add("over"); }));
  ["dragleave","drop"].forEach(ev=>zone.addEventListener(ev, e=>{ e.preventDefault(); zone.classList.remove("over"); }));
  zone.addEventListener("drop", e=>{
    const f = e.dataTransfer && e.dataTransfer.files[0];
    if(f) readPortalFile(f);
  });
  wrap.appendChild(zone);

  if(cfg.accepts === "file-or-source"){
    const alt = el("details","portal-alt");
    alt.appendChild(el("summary", null, "Or paste the page source (works without any of the above)"));
    alt.appendChild(el("p","hint",
      "On the timetable page press ⌥⌘U (Safari: Develop → Show Page Source), then ⌘A, ⌘C, and paste it in here."));
    const ta = document.createElement("textarea");
    ta.id = "portalSourceBox"; ta.spellcheck = false; ta.rows = 4;
    ta.placeholder = "<html> … the portal page’s source …";
    alt.appendChild(ta);
    const read = el("button","btn ghost small","Read this source"); read.type = "button";
    read.addEventListener("click", ()=>{
      const txt = ta.value.trim();
      if(!txt){ toast("Paste the page source first"); return; }
      try{
        const doc = new DOMParser().parseFromString(txt, "text/html");
        acceptPortalPayload("schedule", parseSchedulePage(doc));
      }catch(err){ portalError(err.message); }
    });
    alt.appendChild(read);
    wrap.appendChild(alt);
  }
  return wrap;
}

function readPortalFile(file){
  const r = new FileReader();
  r.onload = ()=>{
    try{ acceptPortalPayload(portalImportWhat, JSON.parse(r.result)); }
    catch(e){ portalError("That file is not valid JSON."); }
  };
  r.onerror = ()=>portalError("That file could not be read.");
  r.readAsText(file);
}

/* The one gate: everything that wants to become stored data comes
   through here, gets validated, and is shown before it is written. */
/* The timetable page has no credits, instructor or department — those come
   from the catalog. So make sure it is loaded before building the diff,
   even when the user never opened the Catalog tab. */
function acceptPortalPayload(what, data){
  if(what === "schedule" && !CATALOG){
    ensureCatalog().then(()=>acceptPortalPayloadNow(what, data));
    return;
  }
  acceptPortalPayloadNow(what, data);
}

function acceptPortalPayloadNow(what, data){
  if(what === "catalog"){
    const res = validateCatalogSnapshot(data);
    if(!res.ok){ portalError(res.error); return; }
    portalImportPending = { what:"catalog", record: res.record };
  } else {
    const meetings = (data && data.meetings) || [];
    if(!meetings.length){ portalError("No courses found in that timetable."); return; }
    /* Week 1 of this planner is a fixed date. A timetable from another term
       would be filed into those weeks and look plausible while being wrong,
       so say so rather than import it. */
    if(data.semester && data.semester !== SEMESTER){
      portalError("That timetable is for semester " + data.semester + ", but this planner is set up for " +
                  SEMESTER + " (week 1 = 14 September 2026). Importing it would put the courses on the wrong dates.");
      return;
    }
    const imported = scheduleToCourses(meetings, CATALOG);
    const diff = diffPlan(state.courses, imported);
    const sel = { added:{}, changed:{}, missing:{} };
    diff.added.forEach(c=>{ sel.added[c.catalogRef.key] = true; });
    diff.changed.forEach(ch=>{
      sel.changed[ch.key] = {};
      ch.fields.forEach(f=>{ sel.changed[ch.key][f.field] = true; });
    });
    diff.missing.forEach(m=>{ sel.missing[m.course.id] = false; });   // taking away needs a click
    portalImportPending = { what:"schedule", schedule: data, imported, diff, sel };
  }
  renderPortalPending();
}

function portalError(msg){
  const host = $("#portalPending"); if(!host) return;
  host.innerHTML = "";
  const n = el("div","note warn");
  n.appendChild(el("h3", null, "That did not work"));
  n.appendChild(document.createTextNode(msg));
  host.appendChild(n);
}

function renderPortalPending(){
  const host = $("#portalPending"); if(!host) return;
  host.innerHTML = "";
  setPortalAction(null);
  const p = portalImportPending;
  if(!p) return;

  if(p.what === "catalog"){
    const n = el("div","note ok");
    n.appendChild(el("h3", null, "Ready to import"));
    const ul = el("ul");
    ul.appendChild(el("li", null, p.record.count.toLocaleString("en-US") + " courses"));
    if(p.record.semester) ul.appendChild(el("li", null, "Semester " + p.record.semester));
    ul.appendChild(el("li", null, "Snapshot taken " + p.record.snapshot));
    const existing = CATALOG && CATALOG.portal;
    if(existing) ul.appendChild(el("li", null, "Replaces the current snapshot (" + existing.courses.length.toLocaleString("en-US") + " courses from " + existing.snapshot + ")"));
    n.appendChild(ul);
    host.appendChild(n);

    const b = el("button","btn","Import " + p.record.count.toLocaleString("en-US") + " courses"); b.type = "button";
    b.addEventListener("click", confirmPortalImport);
    setPortalAction(b);
    return;
  }

  renderScheduleDiff(host, p);
}

function confirmPortalImport(){
  const p = portalImportPending;
  if(!p || p.what !== "catalog") return;
  snapshotPut(p.record).then(ok=>{
    if(!ok){
      portalError("This browser would not store the catalog. In Safari that usually means " +
                  "“Prevent cross-site tracking” or private browsing — your plan is unaffected.");
      return;
    }
    closePortalImport();
    CATALOG = null; catalogStatus = "idle";
    ensureCatalog(true);
    showPanel("catalog");
    toast(p.record.count.toLocaleString("en-US") + " courses imported");
  });
}

/* ------------------------------------------------------------
   The hand-off from the portal tab.
   ------------------------------------------------------------ */
function wirePortalImport(){
  const o = $("#portalModalOverlay");
  if(o){
    $("#portalModalClose").addEventListener("click", closePortalImport);
    o.addEventListener("click", e=>{ if(e.target.id === "portalModalOverlay") closePortalImport(); });
    $("#portalFile").addEventListener("change", e=>{
      const f = e.target.files[0]; e.target.value = "";
      if(f) readPortalFile(f);
    });
  }

  window.addEventListener("message", e=>{
    // Only the portal may talk to us, and only in the shapes we know.
    if(e.origin !== PORTAL_ORIGIN) return;
    const d = e.data;
    if(!d) return;

    if(d.kind === "thu-progress"){ renderPortalProgress(d); return; }
    if(d.kind === "thu-cancelled"){ renderPortalCancelled(d); return; }

    if(d.kind !== "thu-import" || !d.payload) return;
    const what = d.what === "schedule" ? "schedule" : "catalog";
    clearPortalWait();
    openPortalImport(what);
    acceptPortalPayload(what, d.payload);
    // Tell the sender to stop retrying.
    try{ e.source.postMessage({ kind:"thu-import-ok" }, e.origin); }catch(err){}
  });

  /* The scraper opens us inside the bookmarklet's click and only then starts
     working, so we are here first and must say so — messages sent to a page
     that has not loaded yet are simply lost. */
  const m = /[?&]import=(schedule|catalog)/.exec(location.search);
  if(m && window.opener){
    openPortalImport(m[1]);
    renderPortalProgress({ text: "Waiting for the portal tab\u2026" });
    startPortalWaitTimeout();
    try{ window.opener.postMessage({ kind:"thu-ready" }, PORTAL_ORIGIN); }catch(err){}
    history.replaceState(null, "", location.pathname + location.hash);
  }
}

/* ------------------------------------------------------------
   Progress relayed from the portal tab.

   The planner tab comes to the front the moment the bookmarklet is
   clicked, which puts the portal's own progress panel behind it. So the
   scraper mirrors its progress here, where the eye already is.
   ------------------------------------------------------------ */
let portalWaitTimer = null;

function renderPortalProgress(d){
  const host = $("#portalPending"); if(!host) return;
  clearTimeout(portalWaitTimer);
  startPortalWaitTimeout();

  let box = host.querySelector(".portal-progress");
  if(!box){
    host.innerHTML = "";
    setPortalAction(null);
    box = el("div","portal-progress");
    box.appendChild(el("div","pp-text"));
    const bar = el("div","pp-bar");
    bar.appendChild(el("div","pp-fill"));
    box.appendChild(bar);
    /* The catalog scrape runs for about four minutes. Being able to call it
       off without hunting for the other tab matters more than the two lines
       this costs. The portal tab is our opener, so it can be reached. */
    const cancel = el("button","linkbtn pp-cancel","Cancel"); cancel.type = "button";
    cancel.addEventListener("click", cancelPortalScrape);
    box.appendChild(cancel);
    host.appendChild(box);
    // Only on the first update: arriving here means steps 1-3 are done, so
    // show the progress rather than the instructions. Scrolling on every
    // tick would fight a user who scrolled up to re-read something.
    scrollToFindings();
  }
  box.querySelector(".pp-text").textContent = d.text || "Working\u2026";
  const fill = box.querySelector(".pp-fill");
  if(d.total){
    fill.style.width = Math.round((d.done / d.total) * 100) + "%";
    fill.classList.remove("indeterminate");
  } else {
    fill.classList.add("indeterminate");
  }
}

function cancelPortalScrape(){
  try{ if(window.opener) window.opener.postMessage({ kind:"thu-cancel" }, PORTAL_ORIGIN); }catch(e){}
  clearPortalWait();
  const host = $("#portalPending"); if(!host) return;
  host.innerHTML = "";
  setPortalAction(null);
  const n = el("div","note");
  n.appendChild(el("h3", null, "Stopping\u2026"));
  n.appendChild(document.createTextNode("Nothing has been changed in your plan."));
  host.appendChild(n);
}

/* The scraper confirms it actually stopped. */
function renderPortalCancelled(d){
  clearPortalWait();
  const host = $("#portalPending"); if(!host) return;
  host.innerHTML = "";
  setPortalAction(null);
  const n = el("div","note");
  n.appendChild(el("h3", null, "Stopped"));
  n.appendChild(document.createTextNode(
    (d && d.text ? d.text + " " : "") + "Your plan is unchanged \u2014 run the reader again whenever you like."));
  host.appendChild(n);
}

/* If nothing arrives, do not sit on "waiting" forever — point at the way
   that always works. */
function startPortalWaitTimeout(){
  clearTimeout(portalWaitTimer);
  portalWaitTimer = setTimeout(()=>{
    const host = $("#portalPending"); if(!host || !host.querySelector(".portal-progress")) return;
    host.innerHTML = "";
    const n = el("div","note warn");
    n.appendChild(el("h3", null, "Nothing arrived from the portal tab"));
    n.appendChild(document.createTextNode(
      "The scrape may still be running \u2014 check the other tab. If it finished and downloaded a file " +
      "instead, drop it into the box in step 3 above."));
    host.appendChild(n);
  }, 60000);
}

function clearPortalWait(){ clearTimeout(portalWaitTimer); portalWaitTimer = null; }

