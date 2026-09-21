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
  importFromHash();

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

  const listHead = document.querySelector("#panel-list thead");
  if(listHead) listHead.addEventListener("click", e=>{
    const th = e.target.closest("th.sortable"); if(!th) return;
    const key = th.dataset.sort;
    if(listSort.key === key) listSort.dir *= -1;
    else { listSort.key = key; listSort.dir = 1; }
    renderTable();
  });

  $("#parseBtn").addEventListener("click", ()=>{
    const txt = $("#pasteBox").value;
    if(!txt.trim()){ toast("Paste the course rows first"); return; }
    activePreviewHost = "#parsePreview";
    pendingEditableWeeks = false;
    pending = parsePaste(txt);
    if(!pending.length){ toast("Nothing recognised — paste the fields on separate lines"); }
    renderPreview();
  });
  $("#clearPaste").addEventListener("click", ()=>{ $("#pasteBox").value = ""; activePreviewHost = "#parsePreview"; pendingEditableWeeks = false; pending = []; renderPreview(); });

  // A help screenshot is optional: reveal it only once it actually loads
  // (also covers a cached image that finishes before this listener attaches),
  // otherwise the dashed placeholder stays.
  function wireHelpImg(imgSel, phSel){
    const img = $(imgSel); if(!img) return;
    const reveal = ()=>{ img.hidden = false; const ph = $(phSel); if(ph) ph.hidden = true; };
    img.addEventListener("load", reveal);
    if(img.complete && img.naturalWidth > 0) reveal();
  }
  wireHelpImg("#pasteHelpImg", "#pasteHelpPlaceholder");
  wireHelpImg("#xlsHelpImg", "#xlsHelpPlaceholder");

  $("#openPasteBtn").addEventListener("click", openPasteModal);
  $("#pasteModalClose").addEventListener("click", closePasteModal);
  $("#pasteModalOverlay").addEventListener("click", e=>{ if(e.target.id==="pasteModalOverlay") closePasteModal(); });

  $("#openXlsBtn").addEventListener("click", openXlsModal);
  $("#xlsModalClose").addEventListener("click", closeXlsModal);
  $("#xlsModalOverlay").addEventListener("click", e=>{ if(e.target.id==="xlsModalOverlay") closeXlsModal(); });
  $("#xlsPickBtn").addEventListener("click", ()=>$("#xlsFile").click());
  $("#xlsFile").addEventListener("change", e=>{
    const f = e.target.files[0]; e.target.value = "";
    if(!f) return;
    $("#xlsFileName").textContent = f.name;
    const r = new FileReader();
    r.onload = () => {
      try{
        activePreviewHost = "#xlsPreview";
        pendingEditableWeeks = true;
        pending = parseScheduleXLS(r.result);
        renderPreview();
        toast(pending.length ? pending.length+(pending.length===1?" course read from the schedule":" courses read from the schedule")
                             : "No courses found in that file");
      }catch(err){ alert("This .xls could not be read: "+err.message); }
    };
    r.readAsArrayBuffer(f);
  });

  const statusInfoBtn = $("#statusInfoBtn"), statusInfo = $("#statusInfo");
  if(statusInfoBtn && statusInfo){
    statusInfoBtn.addEventListener("click", ()=>{
      const show = statusInfo.hidden;
      statusInfo.hidden = !show;
      statusInfoBtn.setAttribute("aria-expanded", show ? "true" : "false");
    });
    document.addEventListener("click", e=>{
      if(!statusInfo.hidden && !statusInfo.contains(e.target) && !statusInfoBtn.contains(e.target)){
        statusInfo.hidden = true; statusInfoBtn.setAttribute("aria-expanded","false");
      }
    });
  }

  $("#addSlot").addEventListener("click", ()=>addSlotRow());

  $("#saveCourse").addEventListener("click", ()=>{
    const c = readForm();
    if(!c.titleEn && !c.titleCn){ toast("A title is needed"); return; }
    if(!(c.credits > 0)){ toast("Enter the course's credits"); return; }
    if(!c.slots.length){ toast("At least one valid meeting is needed"); return; }
    const i = state.courses.findIndex(x=>x.id===c.id);
    if(i>=0) state.courses[i] = c; else state.courses.push(c);
    save(); renderAll(); fillForm(null);
    toast(i>=0 ? "Course updated" : "Course saved");
    showPanel("week"); // feature: land on the week view after saving
  });
  $("#resetForm").addEventListener("click", ()=>{
    const wasEditing = !!$("#fId").value;
    fillForm(null);
    if(wasEditing){
      showPanel("week");                                   // "Cancel edit" → back to the week view
      window.scrollTo({ top:0, behavior:"smooth" });
    } else {
      $("#formTitle").scrollIntoView({ block:"start", behavior:"smooth" });  // "Clear form" → back to the top of the form
      $("#fTitleEn").focus({ preventScroll:true });
    }
  });
  $("#deleteCourse").addEventListener("click", ()=>{
    const id = $("#fId").value;
    if(id) deleteCourseWithConfirm(id);
    fillForm(null);
  });

  $("#goalInput").addEventListener("input", e=>{
    state.goal = parseFloat(e.target.value) || 0;
    save(); renderGoal();
  });

  $("#shareBtn").addEventListener("click", sharePlan);
  $("#exportBtn").addEventListener("click", exportJSON);
  $("#importBtn").addEventListener("click", ()=>$("#importFile").click());
  $("#importFile").addEventListener("change", e=>{
    const f = e.target.files[0]; if(!f) return;
    importJSONFile(f);
    e.target.value = "";
  });
  $("#icsExportBtn").addEventListener("click", openICSModal);
  $("#icsModalCancel").addEventListener("click", closeICSModal);
  $("#icsModalOverlay").addEventListener("click", e=>{ if(e.target.id==="icsModalOverlay") closeICSModal(); });
  $("#icsWeeksAll").addEventListener("click", ()=>{ $("#icsWeekFrom").value="1"; $("#icsWeekTo").value=String(TOTAL_WEEKS); });
  $("#icsWeeksCurrent").addEventListener("click", ()=>{
    const w = currentSemesterWeek().week;
    $("#icsWeekFrom").value = String(w); $("#icsWeekTo").value = String(w);
  });
  $("#icsCoursesAll").addEventListener("click", ()=>{
    document.querySelectorAll("#icsCourseCheckboxes input[type=checkbox]").forEach(cb=>cb.checked=true);
  });
  $("#icsCoursesNone").addEventListener("click", ()=>{
    document.querySelectorAll("#icsCourseCheckboxes input[type=checkbox]").forEach(cb=>cb.checked=false);
  });
  $("#icsTravel").addEventListener("change", e=>{ $("#icsTravelMin").disabled = !e.target.checked; });
  $("#icsModalExport").addEventListener("click", ()=>{
    let weekFrom = +$("#icsWeekFrom").value, weekTo = +$("#icsWeekTo").value;
    if(weekFrom > weekTo){ const t=weekFrom; weekFrom=weekTo; weekTo=t; }
    const ok = downloadICS({
      courseIds: icsModalSelectedIds(), weekFrom, weekTo,
      includeChinese: $("#icsInclCn").checked,
      travelMin: $("#icsTravel").checked ? (parseInt($("#icsTravelMin").value) || 0) : 0
    });
    if(ok) closeICSModal();
  });

  $("#printBtn").addEventListener("click", ()=>{
    renderPrintSheet();
    setTimeout(()=>window.print(), 120);
  });
  $("#resetAll").addEventListener("click", resetEverything);

  $("#nowBadge").addEventListener("click", ()=>{
    const info = currentSemesterWeek();
    state.week = info.week;
    save(); renderWeekSelect(); renderGrid();
    showPanel("week");
  });

  document.addEventListener("keydown", e=>{
    if(e.key!=="Escape") return;
    if(!$("#icsModalOverlay").hidden) closeICSModal();
    if(!$("#pasteModalOverlay").hidden) closePasteModal();
    if(!$("#xlsModalOverlay").hidden) closeXlsModal();
    const si = $("#statusInfo");
    if(si && !si.hidden){ si.hidden = true; $("#statusInfoBtn").setAttribute("aria-expanded","false"); }
  });

  // Keep the "now" badge correct even if the tab is left open across midnight.
  setInterval(renderNowBadge, 5*60*1000);
}

document.addEventListener("DOMContentLoaded", init);
