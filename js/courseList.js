"use strict";

/* ============================================================
   Course list (active courses only — dropped courses live in the
   archive, see archive.js)
   ============================================================ */
function deleteCourseWithConfirm(id){
  const c = state.courses.find(x=>x.id===id);
  if(!c) return;
  if(confirm("Delete “"+(c.titleEn||c.titleCn)+"” permanently?")){
    state.courses = state.courses.filter(x=>x.id!==id);
    save(); renderAll(); toast("Course deleted");
  }
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
    const order = {booked:0, bid:1, option:2, out:3};
    if(order[a.status]!==order[b.status]) return order[a.status]-order[b.status];
    const da=(a.slots[0]||{}).day||9, db=(b.slots[0]||{}).day||9;
    if(da!==db) return da-db;
    return toMin((a.slots[0]||{start:"00:00"}).start) - toMin((b.slots[0]||{start:"00:00"}).start);
  });

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
    tdT.appendChild(el("span","title", c.titleEn || "(no English title)"));
    if(c.titleCn) tdT.appendChild(el("span","cn", c.titleCn));
    if(c.note) tdT.appendChild(el("span","cn", "› "+c.note));
    tr.appendChild(tdT);

    tr.appendChild(el("td","num", c.number + (c.seq? "-"+c.seq : "")));
    tr.appendChild(el("td", null, c.instructor||"—"));
    tr.appendChild(el("td","num", slotText(c)));
    tr.appendChild(el("td","num", c.weeks||"—"));
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
