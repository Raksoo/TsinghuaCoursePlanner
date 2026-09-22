"use strict";

/* ============================================================
   Course catalog tab (feature: pick courses instead of typing them).

   Two sources, both static JSON under data/, fetched lazily the
   first time the tab opens:
   - catalog-mba.json — the MBA exchange list, curated once from the
     schedule + syllabus PDFs by tools/build-mba-catalog.py (rich:
     rooms, descriptions, syllabus pages).
   - catalog-portal.json — a read-only snapshot of the portal's
     "Query courses open this semester", taken by Oskar in his own
     logged-in browser with tools/portal-scrape.js (wide: ~5,000
     rows, but only number/seq/title/credits/dept/instructor/time).
     Optional — the tab works without it.
   Rows are merged by course number: an MBA entry absorbs the portal
   row's sequence and remarks; everything else from the portal is
   listed as its own entry.

   "Add to plan" creates a normal course (status Option) with a
   deterministic id "cat-<key>" and a catalogRef, so it dedupes and
   keeps stable .ics UIDs. The catalog never edits existing courses.
   ============================================================ */
let CATALOG = null;               // { entries, mba, portal } once loaded
let catalogStatus = "idle";       // idle | loading | ok | error
const catalogFilter = { q:"", source:"", program:"", dept:"", day:0, block:0, fits:false, hideInPlan:false };
const CATALOG_PAGE = 120;         // cards rendered before "Show more"
let catalogShown = CATALOG_PAGE;

function ensureCatalog(){
  if(catalogStatus !== "idle") return;
  catalogStatus = "loading";
  renderCatalog();
  const get = name => fetch("data/"+name).then(r=>{ if(!r.ok) throw new Error(r.status); return r.json(); });
  Promise.all([ get("catalog-mba.json"), get("catalog-portal.json").catch(()=>null) ])
    .then(([mba, portal])=>{
      if(!mba || !Array.isArray(mba.courses)) throw new Error("bad file");
      CATALOG = mergeCatalogSources(mba, portal && Array.isArray(portal.courses) ? portal : null);
      catalogStatus = "ok";
    })
    .catch(()=>{ catalogStatus = "error"; })
    .then(()=>{ fillCatalogDeptSelect(); renderCatalog(); });
}

/* Portal row → catalog entry (slots via the paste parser's block-code reader). */
function portalRowToEntry(r){
  const parsed = slotsFromCode(r.time||"");
  return {
    key: r.number+"-"+r.seq, source: "portal",
    number: r.number, seq: r.seq,
    titleEn: r.titleEn || r.titleCn || "(untitled)", titleCn: r.titleCn||"",
    credits: parseFloat(r.credits)||0, dept: r.dept||"", instructor: r.instructor||"",
    program: "Portal", lang: "",
    room: "", weeks: parsed.weeks || "", slots: parsed.slots,
    timeRaw: r.time||"", features: r.features||"", remarks: r.remarks||"",
    description: "", notes: ""
  };
}
function mergeCatalogSources(mba, portal){
  const entries = mba.courses.map(e=>Object.assign({ source:"mba" }, e));
  const byNumber = new Map(entries.map(e=>[e.number, e]));
  const portalRows = portal ? portal.courses : [];
  const portalByNumber = new Map();
  portalRows.forEach(r=>{ if(!portalByNumber.has(r.number)) portalByNumber.set(r.number, []); portalByNumber.get(r.number).push(r); });
  portalRows.forEach(r=>{
    const m = byNumber.get(r.number);
    if(m && portalByNumber.get(r.number).length===1){
      // Same course in both: keep the rich MBA entry, take the portal's sequence/remarks.
      m.seq = m.seq || r.seq; m.remarks = r.remarks||""; m.inPortal = true;
      m.key = m.key || r.number;
      return;
    }
    entries.push(portalRowToEntry(r));
  });
  return { entries, mba, portal };
}
function fillCatalogDeptSelect(){
  const sel = $("#catalogDept"); if(!sel || !CATALOG) return;
  const depts = [...new Set(CATALOG.entries.map(e=>e.dept).filter(Boolean))].sort();
  sel.innerHTML = "";
  const o0 = el("option", null, "All"); o0.value = ""; sel.appendChild(o0);
  depts.forEach(d=>{ const o = el("option", null, d); o.value = d; sel.appendChild(o); });
  const f = $("#catalogSourceField"); if(f) f.hidden = !CATALOG.portal;
}
/* "限:非留学生选课" → "Restricted: 非留学生选课" — the prefixes are the part worth translating. */
function remarksText(r){
  return String(r||"").replace(/^限[:：]/, "Restricted: ").replace(/^优先[:：]/, "Priority: ");
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
  const out = [];
  state.courses.filter(c => c.status==="booked" || c.status==="bid").forEach(c=>{
    const shared = new Set();
    (entry.slots||[]).forEach(es=>{
      const eWeeks = new Set(slotWeeks(entry, es));
      (c.slots||[]).forEach(cs=>{
        if(+cs.day!==+es.day || !(toMin(cs.start) < toMin(es.end) && toMin(es.start) < toMin(cs.end))) return;
        slotWeeks(c, cs).forEach(w=>{ if(eWeeks.has(w)) shared.add(w); });
      });
    });
    if(shared.size) out.push({ course:c, weeks:[...shared].sort((a,b)=>a-b) });
  });
  return out;
}

function catalogEntryToCourse(entry){
  const noteParts = [entry.notes, entry.remarks ? remarksText(entry.remarks) : "", (!entry.slots||!entry.slots.length) && entry.timeRaw ? "Portal time: "+entry.timeRaw : ""].filter(Boolean);
  return {
    id: "cat-"+entry.key,
    titleEn: entry.titleEn, titleCn: entry.titleCn||"",
    number: entry.number||"", seq: entry.seq||"",
    credits: parseFloat(entry.credits)||0,
    instructor: entry.instructor||"", dept: entry.dept||"", lang: entry.lang||"",
    room: entry.room||"", weeks: entry.weeks||"1-16", status: "option",
    slots: (entry.slots||[]).map(s=>Object.assign({ day:+s.day, start:s.start, end:s.end }, s.block ? {block:s.block} : {}, s.weeks ? {weeks:s.weeks} : {})),
    note: noteParts.join(" · "),
    catalogRef: { source: entry.source||"mba", key:entry.key }
  };
}
function addFromCatalog(entry){
  if(planCourseFor(entry)){ toast("Already in your plan"); return; }
  commit("Add “"+entry.titleEn+"” from catalog", { courses: state.courses.concat([catalogEntryToCourse(entry)]) });
  toastUndo("Added as Option — change its status under My courses");
}

function catalogMatches(entry){
  const f = catalogFilter;
  if(f.source && entry.source!==f.source) return false;
  if(f.program && entry.program!==f.program) return false;
  if(f.dept && entry.dept!==f.dept) return false;
  if(f.day && !(entry.slots||[]).some(s=>+s.day===f.day)) return false;
  if(f.block && !(entry.slots||[]).some(s=>+s.block===f.block)) return false;
  if(f.hideInPlan && planCourseFor(entry)) return false;
  if(f.fits && catalogClashes(entry).length) return false;
  if(f.q){
    const hay = [entry.titleEn, entry.titleCn, entry.number, entry.seq, entry.instructor, entry.program, entry.dept, entry.room, entry.remarks, (entry.aliases||[]).join(" ")]
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

const catalogSort = { key:null, dir:1 };
const catalogOpen = new Set();      // keys whose details row is expanded

function catalogSortValue(e, key){
  switch(key){
    case "title":  return (e.titleEn||"").toLowerCase();
    case "number": return (e.number||"")+"-"+(e.seq||"");
    case "credits":return parseFloat(e.credits)||0;
    case "dept":   return (e.source==="mba" ? "0"+e.program : "1"+(e.dept||"")).toLowerCase();
    case "instructor": return (e.instructor||"").toLowerCase();
    case "time":   { const s=(e.slots||[])[0]; return s ? (+s.day)*10000+toMin(s.start) : 99999; }
    case "weeks":  { const w=parseWeeks(e.weeks); return w[0]||99; }
  }
  return 0;
}
function sortedEntries(rows){
  if(!catalogSort.key) return rows;
  const k = catalogSort.key, d = catalogSort.dir;
  return rows.slice().sort((a,b)=>{
    const va=catalogSortValue(a,k), vb=catalogSortValue(b,k);
    return (va<vb ? -1 : va>vb ? 1 : 0)*d || (a.titleEn||"").localeCompare(b.titleEn||"");
  });
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
  const mba = CATALOG.mba, portal = CATALOG.portal;
  if(meta){
    meta.innerHTML = "";
    meta.appendChild(document.createTextNode("MBA exchange list from "+mba.snapshot+" ("+mba.courses.length+" courses · "));
    const a1 = el("a", null, "schedule PDF"); a1.href = encodeURI(mba.files.schedule); a1.target = "_blank";
    const a2 = el("a", null, "syllabuses PDF"); a2.href = encodeURI(mba.files.syllabus); a2.target = "_blank";
    meta.appendChild(a1); meta.appendChild(document.createTextNode(" · ")); meta.appendChild(a2); meta.appendChild(document.createTextNode(")"));
    if(portal) meta.appendChild(document.createTextNode(" · Portal snapshot from "+portal.snapshot+" ("+portal.courses.length+" rows, all departments; no rooms)"));
    else meta.appendChild(document.createTextNode(" · No portal snapshot yet (data/catalog-portal.json)"));
  }
  const dl = $("#catalogDeadlines");
  if(dl && !dl.childElementCount && Array.isArray(mba.deadlines)){
    mba.deadlines.forEach(d=>{
      const li = el("li");
      li.appendChild(el("b", null, d.label+": "));
      li.appendChild(document.createTextNode(fmtISO(d.from.slice(0,10))+" "+d.from.slice(11)+" – "+fmtISO(d.to.slice(0,10))+" "+d.to.slice(11)));
      dl.appendChild(li);
    });
  }

  const rows = sortedEntries(CATALOG.entries.filter(catalogMatches));
  $("#catalogCount").textContent = rows.length+" of "+CATALOG.entries.length;
  if(!rows.length){ host.appendChild(el("div","cat-empty","No course matches these filters.")); return; }

  const wrap = el("div","tablewrap catalog");
  const table = el("table");
  const thead = el("thead");
  const cols = [
    ["title","Course"], ["number","Number"], ["credits","CP"], ["dept","Programme / dept."],
    ["instructor","Instructor"], ["time","Time"], ["weeks","Weeks"], [null,"Room"], [null,""]
  ];
  const trh = el("tr");
  cols.forEach(([key,label])=>{
    const th = el("th", key ? "sortable" : null, label);
    if(key){
      th.dataset.sort = key;
      if(catalogSort.key===key){ th.classList.add("sorted"); th.dataset.dir = catalogSort.dir>0 ? "asc" : "desc"; }
      th.addEventListener("click", ()=>{
        if(catalogSort.key===key) catalogSort.dir *= -1; else { catalogSort.key = key; catalogSort.dir = 1; }
        renderCatalog();
      });
    }
    trh.appendChild(th);
  });
  thead.appendChild(trh); table.appendChild(thead);
  const tbody = el("tbody");
  rows.slice(0, catalogShown).forEach(entry=>{
    tbody.appendChild(renderCatalogRow(entry));
    if(catalogOpen.has(entry.key)) tbody.appendChild(renderCatalogDetailsRow(entry));
  });
  table.appendChild(tbody); wrap.appendChild(table); host.appendChild(wrap);
  if(rows.length > catalogShown){
    const more = el("button","btn ghost cat-more", "Show more ("+(rows.length-catalogShown)+" left)");
    more.addEventListener("click", ()=>{ catalogShown += CATALOG_PAGE; renderCatalog(); });
    host.appendChild(more);
  }
}

function programBadge(entry){
  if(entry.source==="portal") return el("span","cat-badge prog-Portal", entry.dept ? entry.dept.replace(/^Department of /,"Dept. of ") : "Portal");
  return el("span","cat-badge prog-"+entry.program, entry.program==="Chinese" ? "Language Centre" : (entry.program==="MBA" ? "MBA" : "Course of "+entry.program));
}
function hasDetails(entry){
  return !!(entry.description || entry.prereq || (entry.assessment||[]).length || entry.notes || entry.features || entry.email || entry.syllabusPage || entry.remarks);
}

function renderCatalogRow(entry){
  const inPlan = planCourseFor(entry);
  const clashes = inPlan ? [] : catalogClashes(entry);
  const tr = el("tr","cat-row"+(inPlan?" inplan":"")+(catalogOpen.has(entry.key)?" open":""));
  const expandable = hasDetails(entry);
  if(expandable){
    tr.classList.add("expandable");
    tr.addEventListener("click", e=>{
      if(e.target.closest("button, a, input, select")) return;
      if(catalogOpen.has(entry.key)) catalogOpen.delete(entry.key); else catalogOpen.add(entry.key);
      renderCatalog();
    });
  }

  const tdT = el("td","cat-td-title");
  const t = el("span","title", entry.titleEn);
  if(expandable) t.prepend(el("span","cat-caret", catalogOpen.has(entry.key) ? "▾ " : "▸ "));
  tdT.appendChild(t);
  if(entry.titleCn) tdT.appendChild(el("span","cn", entry.titleCn));
  if(clashes.length){
    tdT.appendChild(el("span","cat-clash-inline", "Clashes with "+clashes.map(x=>(x.course.titleEn||x.course.titleCn)+" (week"+(x.weeks.length>1?"s ":" ")+compressWeeks(x.weeks)+")").join("; ")));
  }
  if(entry.remarks) tdT.appendChild(el("span","cat-remarks-inline", remarksText(entry.remarks)));
  tr.appendChild(tdT);

  tr.appendChild(el("td","num", (entry.number||"—")+(entry.seq ? "-"+entry.seq : "")));
  tr.appendChild(el("td","num", entry.credits+""));
  const tdP = el("td"); tdP.appendChild(programBadge(entry)); tr.appendChild(tdP);
  tr.appendChild(el("td", null, entry.instructor||"—"));
  const slots = entry.slots||[];
  const tdTime = el("td","time-cell");
  if(slots.length) tdTime.textContent = slots.map(s=>DAYS_SHORT[s.day-1]+" "+s.start+"–"+s.end+(s.block?" (B"+s.block+")":"")+(s.weeks?" · wk "+s.weeks:"")).join("; ");
  else { tdTime.textContent = entry.timeRaw ? entry.timeRaw : "—"; tdTime.classList.add("muted"); tdTime.title = entry.timeRaw ? "Time not in block format" : ""; }
  tr.appendChild(tdTime);
  const tdW = el("td","num"); tdW.appendChild(el("span","wktext", entry.weeks||"—")); const strip = weekStrip(entry.weeks); if(strip) tdW.appendChild(strip); tr.appendChild(tdW);
  tr.appendChild(el("td", null, entry.room||"—"));

  const tdA = el("td");
  const act = el("div","rowact");
  if(inPlan){
    act.appendChild(el("span","cat-inplan", "In plan · "+statusLabel(inPlan.status)));
    const b = el("button","btn ghost small","Show");
    b.title = "Show in My courses";
    b.addEventListener("click", ()=>{ showPanel("list"); $("#search").value = entry.titleEn; renderTable(); });
    act.appendChild(b);
  } else {
    const b = el("button","btn small","Add");
    b.title = "Add to my plan as an Option";
    b.addEventListener("click", ()=>addFromCatalog(entry));
    act.appendChild(b);
  }
  tdA.appendChild(act); tr.appendChild(tdA);
  return tr;
}

function renderCatalogDetailsRow(entry){
  const tr = el("tr","cat-details-row");
  const td = el("td"); td.colSpan = 9;
  const box = el("div","cat-details-box");
  if(entry.description) box.appendChild(el("p","cat-desc", entry.description));
  const facts = el("dl","cat-facts");
  const fact = (k,v)=>{ if(!v) return; facts.appendChild(el("dt",null,k)); facts.appendChild(el("dd",null,v)); };
  fact("Prerequisites", entry.prereq);
  fact("Assessment", (entry.assessment||[]).join(", "));
  fact("Course features", entry.features);
  fact("Department", entry.dept);
  fact("Instructor e-mail", entry.email);
  if(entry.aliases && entry.aliases.length) fact("Also listed as", entry.aliases.join(", "));
  fact("Remarks", entry.remarks ? remarksText(entry.remarks) : "");
  fact("Notes", entry.notes);
  if(facts.childElementCount) box.appendChild(facts);
  if(entry.syllabusPage && CATALOG.mba.files && CATALOG.mba.files.syllabus){
    const a = el("a","cat-link", "Open syllabus (PDF, page "+entry.syllabusPage+")");
    a.href = encodeURI(CATALOG.mba.files.syllabus)+"#page="+entry.syllabusPage; a.target = "_blank";
    box.appendChild(a);
  }
  td.appendChild(box); tr.appendChild(td);
  return tr;
}

function wireCatalogControls(){
  const q = $("#catalogSearch"); if(!q) return;
  const upd = ()=>{ catalogShown = CATALOG_PAGE; renderCatalog(); };
  q.addEventListener("input", ()=>{ catalogFilter.q = q.value.trim().toLowerCase(); upd(); });
  $("#catalogSource").addEventListener("change", e=>{ catalogFilter.source = e.target.value; upd(); });
  $("#catalogProgram").addEventListener("change", e=>{ catalogFilter.program = e.target.value; upd(); });
  $("#catalogDept").addEventListener("change", e=>{ catalogFilter.dept = e.target.value; upd(); });
  $("#catalogDay").addEventListener("change", e=>{ catalogFilter.day = +e.target.value; upd(); });
  $("#catalogBlock").addEventListener("change", e=>{ catalogFilter.block = +e.target.value; upd(); });
  $("#catalogFits").addEventListener("change", e=>{ catalogFilter.fits = e.target.checked; upd(); });
  $("#catalogHideInPlan").addEventListener("change", e=>{ catalogFilter.hideInPlan = e.target.checked; upd(); });
}
