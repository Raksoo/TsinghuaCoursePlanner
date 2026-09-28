"use strict";

/* ============================================================
   Add tab: everything above the manual form — the catalog search and the
   "catalog says" band. Split out of form.js so both stay readable; the
   form itself keeps the fields, this file keeps the ways into it.
   Needs catalog.js (CATALOG, planCourseFor, catalogClashes,
   catalogEntryToCourse, addFromCatalog) and form.js (fillForm, addSlotRow).
   ============================================================ */
/* ============================================================
   The manual form is collapsed until it is needed (Phase 4): with an
   import and a catalog search above it, typing a course is the rarest
   route — but editing one has to open it.
   ============================================================ */
function openManualForm(){
  const box = $("#manualBox");
  if(box) box.open = true;
}

/* ============================================================
   Catalog search in the Add tab

   Not a second catalog tab: one field over CATALOG.entries with the one
   thing the catalog tab cannot do — "Edit before adding", which fills the
   form and saves nothing.
   ============================================================ */
const ADD_SEARCH_MAX = 8;

function renderAddSearch(){
  const host = $("#addSearchResults"); if(!host) return;
  const field = $("#addSearch");
  const q = field ? field.value.trim().toLowerCase() : "";
  host.innerHTML = "";
  if(q.length < 2){
    if(q) host.appendChild(el("p","hint","Keep typing…"));
    return;
  }
  if(typeof CATALOG === "undefined" || !CATALOG){
    host.appendChild(el("p","hint","Loading the catalog…"));
    ensureCatalog().then(()=>{
      // Only redraw if the field still says what it said — otherwise a slow
      // load would overwrite what the user has typed since.
      if($("#addSearch") && $("#addSearch").value.trim().toLowerCase() === q) renderAddSearch();
    });
    return;
  }
  const hits = [];
  for(const e of CATALOG.entries){
    if(catalogHaystack(e).includes(q)) hits.push(e);
    if(hits.length > ADD_SEARCH_MAX) break;       // one more than we show = "there are others"
  }
  if(!hits.length){
    host.appendChild(el("p","hint","No course matches — try the course number, or the Catalog tab's filters."));
    return;
  }
  const more = hits.length > ADD_SEARCH_MAX;
  hits.slice(0, ADD_SEARCH_MAX).forEach(e=>host.appendChild(addResultRow(e)));
  if(more) host.appendChild(el("p","hint","More courses match — narrow the search, or use the Catalog tab."));
}

/* slotText() prints an em dash when a course has no parsed meetings; in a
   one-line summary that reads like a missing value. Say what is actually
   known instead — the portal's raw time string, or nothing at all. */
function timeFacts(entry){
  const t = slotText(entry);
  if(t && t !== "\u2014") return t;
  return entry.timeRaw ? "portal time " + entry.timeRaw : "no fixed time";
}

function addResultRow(entry){
  const row = el("div","add-result");
  const main = el("div","add-result-main");
  main.appendChild(el("span","title", entry.titleEn || entry.titleCn || "(no title)"));
  const facts = [
    entry.number ? entry.number + (entry.seq ? "-" + entry.seq : "") : "",
    (parseFloat(entry.credits) || 0) + " CP",
    timeFacts(entry),
    entry.weeks ? weeksLabel(parseWeeks(entry.weeks)) : "",
    entry.instructor
  ].filter(Boolean);
  main.appendChild(el("span","cn", facts.join(" · ")));
  // A course that is already in the plan clashes with itself — saying so is
  // noise, not a warning.
  const mine = planCourseFor(entry);
  const clashes = mine ? [] : catalogClashes(entry);
  if(clashes.length){
    const c = clashes[0];
    main.appendChild(el("span","add-result-clash",
      "⚠ clashes with " + (c.course.titleEn || c.course.titleCn) + " in " + weeksLabel(c.weeks)));
  }
  row.appendChild(main);

  const acts = el("div","add-result-acts");
  if(mine){
    acts.appendChild(el("span","add-result-in", "In plan"));
  } else {
    const add = el("button","btn small","Add");
    add.type = "button";
    add.addEventListener("click", ()=>{ addFromCatalog(entry); renderAddSearch(); });
    const edit = el("button","btn ghost small","Edit before adding");
    edit.type = "button";
    edit.addEventListener("click", ()=>{
      fillForm(catalogEntryToCourse(entry), {draft:true});
      $("#fTitleEn").focus({preventScroll:true});
      $("#manualBox").scrollIntoView({block:"start", behavior:"smooth"});
    });
    acts.appendChild(add); acts.appendChild(edit);
  }
  row.appendChild(acts);
  return row;
}

/* ============================================================
   "The catalog says …" band above the form

   Only for courses that came from the catalog (catalogRef). It answers the
   question the plan cannot: has the catalog got times, weeks or a room that
   my copy does not? One button copies them into the form — nothing is
   saved until Save course.
   ============================================================ */
function renderCatalogBand(c){
  const host = $("#catalogBandHost"); if(!host) return;
  host.innerHTML = "";
  if(!c || !c.catalogRef || !c.catalogRef.key) return;
  if(typeof CATALOG === "undefined" || !CATALOG){
    // Catalog not loaded yet — fetch it and fill the band in afterwards,
    // without touching any field the user may be typing in.
    ensureCatalog().then(()=>{
      if($("#fId") && $("#fId").value === c.id) renderCatalogBand(c);
    });
    return;
  }
  const entry = CATALOG.entries.find(e=>e.key === c.catalogRef.key);
  if(!entry) return;

  const facts = [slotText(entry), entry.weeks ? weeksLabel(parseWeeks(entry.weeks)) : "", entry.room].filter(Boolean);
  if(!facts.length) return;
  const same = slotText(entry) === slotText(c)
    && (entry.weeks||"") === (c.weeks||"")
    && (entry.room||"") === (c.room||"");

  const band = el("div", "note catalog-band" + (same ? "" : " warn"));
  band.appendChild(el("span","catalog-band-label", same ? "Catalog · matches your plan" : "Catalog says"));
  band.appendChild(el("span","catalog-band-facts", facts.join(" · ")));
  if(!same){
    const take = el("button","btn ghost small","Use these values");
    take.type = "button";
    take.addEventListener("click", ()=>{
      $("#slotRows").innerHTML = "";
      const slots = entry.slots || [];
      if(slots.length) slots.forEach(addSlotRow); else addSlotRow();
      if(entry.weeks) $("#fWeeks").value = entry.weeks;
      if(entry.room) $("#fRoom").value = entry.room;
      toast("Filled in from the catalog — Save course to keep it");
    });
    band.appendChild(take);
  }
  host.appendChild(band);
}
