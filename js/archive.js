"use strict";

/* ============================================================
   Dropped-course archive (feature: keep "Dropped" courses out of
   the main list, but keep them recoverable)
   ============================================================ */
function renderArchive(){
  const countEl = $("#archiveCount");
  const body = $("#archiveBody");
  if(!countEl || !body) return;

  const dropped = state.courses.filter(c=>c.status==="out");
  countEl.textContent = dropped.length;

  body.innerHTML = "";
  if(!dropped.length){
    body.appendChild(el("div","archive-empty","No dropped courses. Set a course's status to “Dropped” in the list above to send it here."));
    return;
  }

  const wrap = el("div","tablewrap");
  const table = el("table");
  const thead = el("thead");
  thead.innerHTML = "<tr><th>Course</th><th style='width:105px'>Number</th><th style='width:105px'>Instructor</th>"
    + "<th style='width:165px'>Time</th><th style='width:95px'>Weeks</th><th style='width:150px'></th></tr>";
  table.appendChild(thead);
  const tbody = el("tbody");

  dropped.forEach(c=>{
    const tr = el("tr","dim");
    tr.addEventListener("click", e=>{
      if(e.target.closest("select, button, input")) return;
      editCourse(c.id);
    });
    const tdT = el("td");
    tdT.appendChild(el("span","title", c.titleEn || "(no English title)"));
    if(c.titleCn) tdT.appendChild(el("span","cn", c.titleCn));
    tr.appendChild(tdT);
    tr.appendChild(el("td","num", c.number + (c.seq? "-"+c.seq : "")));
    tr.appendChild(el("td", null, c.instructor||"—"));
    tr.appendChild(el("td","num", slotText(c)));
    tr.appendChild(el("td","num", c.weeks||"—"));

    const tdA = el("td");
    const rowact = el("div","rowact");
    const bRestore = el("button","btn ghost small","Restore");
    bRestore.title = "Set status back to Option";
    bRestore.addEventListener("click", ()=>{
      c.status = "option"; save(); renderAll();
      toast("Restored as Option");
    });
    const bDel = el("button","btn danger small","Delete");
    bDel.addEventListener("click", ()=>deleteCourseWithConfirm(c.id));
    rowact.appendChild(bRestore); rowact.appendChild(bDel);
    tdA.appendChild(rowact); tr.appendChild(tdA);

    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  wrap.appendChild(table);
  body.appendChild(wrap);
}
