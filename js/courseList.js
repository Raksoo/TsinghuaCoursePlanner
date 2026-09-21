"use strict";

/* ============================================================
   Course list (active courses only — dropped courses live in the
   archive, see archive.js)
   ============================================================ */
let listSort = { key:null, dir:1 };   // null = default (status, then time)

/* Comparable value for a column; numbers sort numerically, strings A→Z. */
function sortValue(c, key){
  switch(key){
    case "status":     return {booked:0, bid:1, option:2, out:3}[c.status];
    case "course":     return (c.titleEn || c.titleCn || "").toLowerCase();
    case "number":     return (c.number || "") + (c.seq ? "-"+c.seq : "");
    case "instructor": return (c.instructor || "").toLowerCase();
    case "time":       { const s = c.slots[0] || {}; return (s.day || 9) * 10000 + toMin(s.start || "00:00"); }
    case "weeks":      { const w = parseWeeks(c.weeks); return w[0] || 99; }
    case "credits":    return parseFloat(c.credits) || 0;
    case "room":       return (c.room || "").toLowerCase();
  }
  return 0;
}
function sortCmp(a, b){
  return (typeof a === "number" && typeof b === "number") ? a - b : String(a).localeCompare(String(b));
}
function updateSortHeaders(){
  document.querySelectorAll("#panel-list thead th.sortable").forEach(th=>{
    const active = th.dataset.sort === listSort.key;
    th.classList.toggle("sorted", active);
    th.dataset.dir = active ? (listSort.dir > 0 ? "asc" : "desc") : "";
  });
}

/* Ask to confirm, then delete — and still offer a few seconds to undo.
   Keeps the original position for the undo. */
function deleteCourseWithConfirm(id){
  const idx = state.courses.findIndex(x=>x.id===id);
  if(idx<0) return false;
  const c = state.courses[idx];
  if(!confirm("Delete “"+(c.titleEn||c.titleCn||"this course")+"”?")) return false;
  state.courses = state.courses.filter(x=>x.id!==id);
  save(); renderAll();
  toast("Deleted “"+(c.titleEn||c.titleCn||"course")+"”", "Undo", ()=>{
    state.courses.splice(Math.min(idx, state.courses.length), 0, c);
    save(); renderAll(); toast("Deletion undone");
  });
  return true;
}

/* Compact 1–18 week strip: filled cells mark the weeks a course runs. */
function weekStrip(weeksStr){
  const active = new Set(parseWeeks(weeksStr));
  if(!active.size) return null;
  const strip = el("div","weekstrip");
  strip.title = "Runs in weeks "+weeksStr;
  for(let w=1; w<=TOTAL_WEEKS; w++) strip.appendChild(el("span","wk"+(active.has(w)?" on":"")));
  return strip;
}

function renderTable(){
  const tb = $("#tbody");
  tb.innerHTML = "";
  const q = ($("#search").value||"").toLowerCase().trim();
  const sf = $("#listStatusFilter").value;

  const rows = state.courses.filter(c=>{
    if(c.status==="out") return false; // archived, shown separately
    if(sf && c.status!==sf) return false;
    if(!q) return true;
    return [c.titleEn,c.titleCn,c.instructor,c.number,c.dept,c.room].join(" ").toLowerCase().includes(q);
  }).sort((a,b)=>{
    if(listSort.key){
      const d = sortCmp(sortValue(a, listSort.key), sortValue(b, listSort.key));
      if(d) return d * listSort.dir;
      return sortCmp(sortValue(a,"course"), sortValue(b,"course")); // stable tiebreak
    }
    const order = {booked:0, bid:1, option:2, out:3};
    if(order[a.status]!==order[b.status]) return order[a.status]-order[b.status];
    const da=(a.slots[0]||{}).day||9, db=(b.slots[0]||{}).day||9;
    if(da!==db) return da-db;
    return toMin((a.slots[0]||{start:"00:00"}).start) - toMin((b.slots[0]||{start:"00:00"}).start);
  });

  updateSortHeaders();

  if(!rows.length){
    const tr = el("tr"); const td = el("td", null, "No courses match.");
    td.colSpan = 9; td.style.color = "var(--muted)"; td.style.padding = "24px";
    tr.appendChild(td); tb.appendChild(tr); return;
  }

  rows.forEach(c=>{
    const tr = el("tr");
    tr.addEventListener("click", e=>{
      if(e.target.closest("select, button, input")) return;
      editCourse(c.id);
    });

    const tdS = el("td");
    const sel = el("select","statussel "+c.status);
    STATUS.forEach(s=>{
      const o = el("option", null, s.label); o.value = s.id;
      if(s.id===c.status) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener("change", ()=>{
      c.status = sel.value; save(); renderAll();
      if(c.status==="out") toast("Moved to archive");
    });
    tdS.appendChild(sel); tr.appendChild(tdS);

    const tdT = el("td");
    const titleEl = el("span","title", c.titleEn || "(no English title)");
    if(c.note){
      const flag = el("span","note-flag","📝"); flag.title = c.note;
      titleEl.appendChild(document.createTextNode(" ")); titleEl.appendChild(flag);
    }
    tdT.appendChild(titleEl);
    if(c.titleCn) tdT.appendChild(el("span","cn", c.titleCn));
    tr.appendChild(tdT);
    if(c.note) tr.title = c.note;   // note shows as a tooltip on hover, not inline

    tr.appendChild(el("td","num", (c.number||"—") + (c.seq? "-"+c.seq : "")));
    tr.appendChild(el("td", null, c.instructor||"—"));
    tr.appendChild(el("td","time-cell", slotText(c)));

    const tdW = el("td","num");
    tdW.appendChild(el("span","wktext", c.weeks||"—"));
    const strip = weekStrip(c.weeks);
    if(strip) tdW.appendChild(strip);
    tr.appendChild(tdW);

    tr.appendChild(el("td","num", (c.credits||0)+""));
    tr.appendChild(el("td", null, c.room||"—"));

    const tdA = el("td");
    const wrap = el("div","rowact");
    const bE = el("button","btn ghost small","Edit");
    bE.addEventListener("click", ()=>editCourse(c.id));
    const bD = el("button","btn danger small","Delete");
    bD.addEventListener("click", ()=>deleteCourseWithConfirm(c.id));
    wrap.appendChild(bE); wrap.appendChild(bD); tdA.appendChild(wrap); tr.appendChild(tdA);
    tb.appendChild(tr);
  });
}
