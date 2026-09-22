"use strict";

/* ============================================================
   Course catalog tab (feature: pick courses instead of typing them).

   Source today: data/catalog-mba.json — the MBA exchange list,
   curated once from the schedule + syllabus PDFs by
   tools/build-mba-catalog.py. Loaded lazily the first time the tab
   opens. A later portal snapshot (PLANNING.md phase 5) plugs in as a
   second source with the same card UI.

   "Add to plan" creates a normal course (status Option) with a
   deterministic id "cat-<number>" and a catalogRef, so it dedupes
   and keeps stable .ics UIDs. The catalog never edits existing
   courses.
   ============================================================ */
let CATALOG = null;               // parsed JSON, or null until loaded
let catalogStatus = "idle";       // idle | loading | ok | error
const catalogFilter = { q:"", program:"", day:0, fits:false, hideInPlan:false };

function ensureCatalog(){
  if(catalogStatus !== "idle") return;
  catalogStatus = "loading";
  renderCatalog();
  fetch("data/catalog-mba.json")
    .then(r=>{ if(!r.ok) throw new Error(r.status); return r.json(); })
    .then(j=>{
      if(!j || !Array.isArray(j.courses)) throw new Error("bad file");
      CATALOG = j; catalogStatus = "ok";
    })
    .catch(()=>{ catalogStatus = "error"; })
    .then(renderCatalog);
}

/* The plan course that corresponds to a catalog entry, if any
   (by catalogRef, or simply the same course number). */
function planCourseFor(entry){
  return state.courses.find(c =>
    (c.catalogRef && c.catalogRef.key===entry.key) || (c.number && c.number===entry.number)
  ) || null;
}

/* Booked/bidding courses that overlap this entry in time AND share a week. */
function catalogClashes(entry){
  const eWeeks = new Set(parseWeeks(entry.weeks));
  const out = [];
  state.courses.filter(c => c.status==="booked" || c.status==="bid").forEach(c=>{
    const shared = parseWeeks(c.weeks).filter(w=>eWeeks.has(w));
    if(!shared.length) return;
    const hit = (entry.slots||[]).some(es => (c.slots||[]).some(cs =>
      +cs.day===+es.day && toMin(cs.start) < toMin(es.end) && toMin(es.start) < toMin(cs.end)));
    if(hit) out.push({ course:c, weeks:shared });
  });
  return out;
}

function catalogEntryToCourse(entry){
  return {
    id: "cat-"+entry.key,
    titleEn: entry.titleEn, titleCn: entry.titleCn||"",
    number: entry.number||"", seq: entry.seq||"",
    credits: parseFloat(entry.credits)||0,
    instructor: entry.instructor||"", dept: entry.dept||"", lang: entry.lang||"",
    room: entry.room||"", weeks: entry.weeks||"1-16", status: "option",
    slots: (entry.slots||[]).map(s=>({ day:+s.day, start:s.start, end:s.end })),
    note: entry.notes||"",
    catalogRef: { source:"mba", key:entry.key }
  };
}
function addFromCatalog(entry){
  if(planCourseFor(entry)){ toast("Already in your plan"); return; }
  commit("Add “"+entry.titleEn+"” from catalog", { courses: state.courses.concat([catalogEntryToCourse(entry)]) });
  toastUndo("Added as Option — change its status in the Course list");
}

function catalogMatches(entry){
  const f = catalogFilter;
  if(f.program && entry.program!==f.program) return false;
  if(f.day && !(entry.slots||[]).some(s=>+s.day===f.day)) return false;
  if(f.hideInPlan && planCourseFor(entry)) return false;
  if(f.fits && catalogClashes(entry).length) return false;
  if(f.q){
    const hay = [entry.titleEn, entry.titleCn, entry.number, entry.instructor, entry.program, entry.room, (entry.aliases||[]).join(" ")]
      .join(" ").toLowerCase();
    if(!hay.includes(f.q)) return false;
  }
  return true;
}

function weeksRangeText(weeks){ return "weeks "+(weeks||"—"); }
/* [1,2,3,5,6] -> "1–3, 5–6" */
function compressWeeks(list){
  const out = []; let i = 0;
  while(i < list.length){
    let j = i; while(j+1 < list.length && list[j+1]===list[j]+1) j++;
    out.push(i===j ? String(list[i]) : list[i]+"–"+list[j]);
    i = j+1;
  }
  return out.join(", ");
}

function renderCatalog(){
  const host = $("#catalogList"); if(!host) return;
  host.innerHTML = "";
  const meta = $("#catalogMeta");
  if(catalogStatus==="loading" || catalogStatus==="idle"){ host.appendChild(el("div","cat-empty","Loading catalog…")); return; }
  if(catalogStatus==="error"){
    const n = el("div","note warn");
    n.innerHTML = "<h3>Catalog not loaded</h3>data/catalog-mba.json could not be read — open the app over http(s), not as a file.";
    host.appendChild(n); return;
  }
  if(meta){
    meta.innerHTML = "";
    meta.appendChild(document.createTextNode("Snapshot from "+CATALOG.snapshot+" · "+CATALOG.courses.length+" courses · "));
    const a1 = el("a", null, "schedule PDF"); a1.href = encodeURI(CATALOG.files.schedule); a1.target = "_blank";
    const a2 = el("a", null, "syllabuses PDF"); a2.href = encodeURI(CATALOG.files.syllabus); a2.target = "_blank";
    meta.appendChild(a1); meta.appendChild(document.createTextNode(" · ")); meta.appendChild(a2);
  }
  const dl = $("#catalogDeadlines");
  if(dl && !dl.childElementCount && Array.isArray(CATALOG.deadlines)){
    CATALOG.deadlines.forEach(d=>{
      const li = el("li");
      li.appendChild(el("b", null, d.label+": "));
      li.appendChild(document.createTextNode(fmtISO(d.from.slice(0,10))+" "+d.from.slice(11)+" – "+fmtISO(d.to.slice(0,10))+" "+d.to.slice(11)));
      dl.appendChild(li);
    });
  }

  const rows = CATALOG.courses.filter(catalogMatches);
  $("#catalogCount").textContent = rows.length+" of "+CATALOG.courses.length;
  if(!rows.length){ host.appendChild(el("div","cat-empty","No course matches these filters.")); return; }
  rows.forEach(entry=>host.appendChild(renderCatalogCard(entry)));
}

function renderCatalogCard(entry){
  const inPlan = planCourseFor(entry);
  const clashes = inPlan ? [] : catalogClashes(entry);
  const card = el("article","cat-card"+(inPlan?" inplan":""));

  const head = el("div","cat-head");
  const titleWrap = el("div","cat-titlewrap");
  const title = el("h3","cat-title", entry.titleEn);
  titleWrap.appendChild(title);
  const badges = el("div","cat-badges");
  badges.appendChild(el("span","cat-badge prog-"+entry.program, entry.program==="Chinese" ? "Language Centre" : (entry.program==="MBA" ? "MBA" : "Course of "+entry.program)));
  badges.appendChild(el("span","cat-badge cp", entry.credits+" CP"));
  if(entry.lang && entry.lang!=="English") badges.appendChild(el("span","cat-badge", entry.lang));
  titleWrap.appendChild(badges);
  head.appendChild(titleWrap);

  const act = el("div","cat-act");
  if(inPlan){
    act.appendChild(el("span","cat-inplan", "In plan · "+statusLabel(inPlan.status)));
    const b = el("button","btn ghost small","Show in list");
    b.addEventListener("click", ()=>{ showPanel("list"); $("#search").value = entry.titleEn; renderTable(); });
    act.appendChild(b);
  } else {
    const b = el("button","btn small","Add to plan");
    b.addEventListener("click", ()=>addFromCatalog(entry));
    act.appendChild(b);
  }
  head.appendChild(act);
  card.appendChild(head);

  const sub = [entry.titleCn, entry.number, entry.instructor].filter(Boolean).join(" · ");
  if(sub) card.appendChild(el("div","cat-sub", sub));

  const when = (entry.slots||[]).map(s=>DAYS_SHORT[s.day-1]+" "+s.start+"–"+s.end).join("; ");
  card.appendChild(el("div","cat-when", when+" · "+weeksRangeText(entry.weeks)+(entry.room ? " · "+entry.room : "")));

  if(clashes.length){
    const w = el("div","cat-clash");
    w.textContent = "Clashes with "+clashes.map(x=>(x.course.titleEn||x.course.titleCn)+" (week"+(x.weeks.length>1?"s ":" ")+compressWeeks(x.weeks)+")").join("; ");
    card.appendChild(w);
  }

  const det = el("details","cat-details");
  det.appendChild(el("summary", null, "Details"));
  if(entry.description) det.appendChild(el("p","cat-desc", entry.description));
  const facts = el("dl","cat-facts");
  const fact = (k,v)=>{ if(!v) return; facts.appendChild(el("dt",null,k)); facts.appendChild(el("dd",null,v)); };
  fact("Prerequisites", entry.prereq);
  fact("Assessment", (entry.assessment||[]).join(", "));
  fact("Department", entry.dept);
  fact("Instructor e-mail", entry.email);
  if(entry.aliases && entry.aliases.length) fact("Also listed as", entry.aliases.join(", "));
  fact("Notes", entry.notes);
  det.appendChild(facts);
  if(entry.syllabusPage && CATALOG.files && CATALOG.files.syllabus){
    const a = el("a","cat-link", "Open syllabus (PDF, page "+entry.syllabusPage+")");
    a.href = encodeURI(CATALOG.files.syllabus)+"#page="+entry.syllabusPage; a.target = "_blank";
    det.appendChild(a);
  }
  card.appendChild(det);
  return card;
}

function wireCatalogControls(){
  const q = $("#catalogSearch"); if(!q) return;
  q.addEventListener("input", ()=>{ catalogFilter.q = q.value.trim().toLowerCase(); renderCatalog(); });
  $("#catalogProgram").addEventListener("change", e=>{ catalogFilter.program = e.target.value; renderCatalog(); });
  $("#catalogDay").addEventListener("change", e=>{ catalogFilter.day = +e.target.value; renderCatalog(); });
  $("#catalogFits").addEventListener("change", e=>{ catalogFilter.fits = e.target.checked; renderCatalog(); });
  $("#catalogHideInPlan").addEventListener("change", e=>{ catalogFilter.hideInPlan = e.target.checked; renderCatalog(); });
}
