"use strict";

/* ============================================================
   Tabs and start-up
   ============================================================ */
function showPanel(id){
  document.querySelectorAll(".tab").forEach(t=>t.setAttribute("aria-selected", t.dataset.panel===id ? "true":"false"));
  document.querySelectorAll(".panel").forEach(p=>p.classList.toggle("active", p.id==="panel-"+id));
}

function renderAll(){
  renderCredits();
  renderTable();
  renderArchive();
  renderGrid();
  renderNowBadge();
}

function init(){
  load();

  STATUS.forEach(s=>{
    const o1 = el("option", null, s.label); o1.value = s.id; $("#fStatus").appendChild(o1);
  });
  // The list filter never needs "Dropped" — dropped courses live in the archive instead.
  STATUS.filter(s=>s.id!=="out").forEach(s=>{
    const o2 = el("option", null, s.label); o2.value = s.id; $("#listStatusFilter").appendChild(o2);
  });

  renderWeekSelect();
  renderLegend();
  renderStorageNote();
  fillForm(null);
  renderAll();

  document.querySelectorAll(".tab").forEach(t=>t.addEventListener("click", ()=>showPanel(t.dataset.panel)));

  $("#weekSel").addEventListener("change", e=>{
    const v = e.target.value;
    state.week = v === "all" ? "all" : +v;
    save(); renderGrid();
  });
  $("#search").addEventListener("input", renderTable);
  $("#listStatusFilter").addEventListener("change", renderTable);

  $("#parseBtn").addEventListener("click", ()=>{
    const txt = $("#pasteBox").value;
    if(!txt.trim()){ toast("Paste the course rows first"); return; }
    pending = parsePaste(txt);
    if(!pending.length){ toast("Nothing recognised — paste the fields on separate lines"); }
    renderPreview();
  });
  $("#clearPaste").addEventListener("click", ()=>{ $("#pasteBox").value = ""; pending = []; renderPreview(); });

  $("#addSlot").addEventListener("click", ()=>addSlotRow());
  $("#applyCode").addEventListener("click", ()=>{
    const {slots, weeks} = slotsFromCode($("#fCode").value);
    if(!slots.length){ toast("Expected format: 2-6(week 1-16)"); return; }
    $("#slotRows").innerHTML = "";
    slots.forEach(addSlotRow);
    if(weeks) $("#fWeeks").value = weeks;
    toast(slots.length+(slots.length===1?" meeting applied":" meetings applied"));
  });

  $("#saveCourse").addEventListener("click", ()=>{
    const c = readForm();
    if(!c.titleEn && !c.titleCn){ toast("A title is needed"); return; }
    if(!c.slots.length){ toast("At least one valid meeting is needed"); return; }
    const i = state.courses.findIndex(x=>x.id===c.id);
    if(i>=0) state.courses[i] = c; else state.courses.push(c);
    save(); renderAll(); fillForm(null);
    toast(i>=0 ? "Course updated" : "Course saved");
    showPanel("week"); // feature: land on the week view after saving
  });
  $("#resetForm").addEventListener("click", ()=>fillForm(null));
  $("#deleteCourse").addEventListener("click", ()=>{
    const id = $("#fId").value;
    if(id) deleteCourseWithConfirm(id);
    fillForm(null);
  });

  $("#exportBtn").addEventListener("click", exportJSON);
  $("#importBtn").addEventListener("click", ()=>$("#importFile").click());
  $("#importFile").addEventListener("change", e=>{
    const f = e.target.files[0]; if(!f) return;
    importJSONFile(f);
    e.target.value = "";
  });
  $("#icsExportBtn").addEventListener("click", downloadICS);
  $("#printBtn").addEventListener("click", ()=>{ showPanel("week"); setTimeout(()=>window.print(), 120); });
  $("#resetAll").addEventListener("click", resetToStartingCourses);

  $("#nowBadge").addEventListener("click", ()=>{
    const info = currentSemesterWeek();
    state.week = info.week;
    save(); renderWeekSelect(); renderGrid();
    showPanel("week");
  });

  // Keep the "now" badge correct even if the tab is left open across midnight.
  setInterval(renderNowBadge, 5*60*1000);
}

document.addEventListener("DOMContentLoaded", init);
