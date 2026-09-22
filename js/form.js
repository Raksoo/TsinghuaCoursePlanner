"use strict";

/* ============================================================
   Add/edit form
   ============================================================ */
function addSlotRow(slot){
  const host = $("#slotRows");
  const row = el("div","slotrow");

  // Weekday
  const fDay = el("label","field field-day"); fDay.appendChild(el("span",null,"Weekday"));
  const daySel = el("select");
  DAYS.forEach((d,i)=>{ const o = el("option",null,d); o.value = i+1; daySel.appendChild(o); });
  daySel.value = slot && slot.day ? slot.day : 1;
  fDay.appendChild(daySel); row.appendChild(fDay);

  // Class block (primary choice)
  const fBlk = el("label","field field-block"); fBlk.appendChild(el("span",null,"Class block"));
  const bSel = el("select");
  BLOCKS.forEach(b=>{ const o = el("option",null,"Block "+b.n+"  ·  "+b.start+"–"+b.end); o.value = b.n; bSel.appendChild(o); });
  const oc = el("option",null,"Custom time…"); oc.value = ""; bSel.appendChild(oc);
  fBlk.appendChild(bSel); row.appendChild(fBlk);

  // Custom time (secondary — only shown when "Custom time…" is picked)
  const fTime = el("div","field field-time"); fTime.appendChild(el("span",null,"Custom time"));
  const wrap = el("div","time-wrap");
  const t1 = document.createElement("input"); t1.type = "time"; t1.value = (slot&&slot.start)||"08:00";
  const t2 = document.createElement("input"); t2.type = "time"; t2.value = (slot&&slot.end)||"09:35";
  wrap.appendChild(t1); wrap.appendChild(el("span","time-dash","–")); wrap.appendChild(t2);
  fTime.appendChild(wrap); row.appendChild(fTime);

  // Weeks for this meeting only (optional — portal rows like "1-6(week 1-8),2-6(week 9-16)")
  const fWk = el("label","field field-slotweeks"); fWk.appendChild(el("span",null,"Weeks (this meeting)"));
  const wkInp = document.createElement("input");
  wkInp.type = "text"; wkInp.placeholder = "same as course"; wkInp.value = (slot && slot.weeks) || "";
  wkInp.title = "Leave empty unless this meeting runs in different weeks than the course's Weeks field";
  fWk.appendChild(wkInp); row.appendChild(fWk);

  // Remove
  const rm = el("button","btn danger small slot-remove","Remove");
  rm.addEventListener("click", ()=>row.remove());
  row.appendChild(rm);

  const syncBlock = () => {
    const b = BLOCKS.find(x=>x.n===+bSel.value);
    if(b){ t1.value = b.start; t2.value = b.end; fTime.hidden = true; }
    else { fTime.hidden = false; }
  };
  bSel.addEventListener("change", syncBlock);

  // Initial block: explicit block, else a block whose time matches exactly, else Custom
  if(slot && slot.block) bSel.value = slot.block;
  else if(slot && slot.start){
    const m = BLOCKS.find(b=>b.start===slot.start && b.end===slot.end);
    bSel.value = m ? m.n : "";
  } else bSel.value = 1;
  syncBlock();

  row._read = () => {
    const blk = bSel.value ? +bSel.value : undefined;
    const b = BLOCKS.find(x=>x.n===blk);
    const out = { day:+daySel.value, start: b ? b.start : t1.value, end: b ? b.end : t2.value, block: blk };
    const wk = wkInp.value.trim();
    if(wk && parseWeeks(wk).length) out.weeks = wk;
    return out;
  };
  host.appendChild(row);
}

function fillForm(c){
  $("#fId").value        = c ? c.id : "";
  $("#fTitleEn").value   = c ? esc(c.titleEn) : "";
  $("#fTitleCn").value   = c ? esc(c.titleCn) : "";
  $("#fNumber").value    = c ? esc(c.number) : "";
  $("#fCredits").value   = c ? (c.credits||0) : "";
  $("#fInstructor").value= c ? esc(c.instructor) : "";
  $("#fDept").value      = c ? esc(c.dept) : "";
  $("#fLang").value      = c ? esc(c.lang) : "";
  $("#fRoom").value      = c ? esc(c.room) : "";
  $("#fWeeks").value     = c ? esc(c.weeks) : "1-16";
  $("#fStatus").value    = c ? c.status : "option";
  $("#fNote").value      = c ? esc(c.note) : "";
  $("#slotRows").innerHTML = "";
  if(c && c.slots && c.slots.length) c.slots.forEach(addSlotRow);
  else addSlotRow();
  $("#formTitle").textContent = c ? "Edit course" : "Add a course manually";
  $("#deleteCourse").style.display = c ? "inline-block" : "none";
  const resetBtn = $("#resetForm");
  if(resetBtn){
    resetBtn.textContent = c ? "Cancel edit" : "Clear form";
    resetBtn.title = c ? "Stop editing and empty the form (the saved course is not changed)" : "Empty all fields";
  }
  const lead = $("#formLead");
  if(lead){
    lead.textContent = c
      ? "Editing “"+(c.titleEn||c.titleCn||"this course")+"”. Change anything below, then Save course — or Delete course to remove it."
      : "Enter a course by hand. Only a title, its credits, and one meeting time are required; everything else is optional. Already have one? Click any course under My courses to edit it here — or use the buttons on the right to import.";
  }
}

function editCourse(id){
  const c = state.courses.find(x=>x.id===id);
  if(!c) return;
  showPanel("add");
  fillForm(c);
  $("#formTitle").scrollIntoView({block:"start", behavior:"smooth"});
}

function readForm(){
  const slots = [...document.querySelectorAll("#slotRows .slotrow")]
    .map(r=>r._read())
    .filter(s=>s.start && s.end && toMin(s.end) > toMin(s.start));
  const id = $("#fId").value || uid();
  // No manual "Sequence" field in the form (it's a parser/import artifact,
  // not something worth hand-typing) — carry over an existing course's
  // value untouched instead of losing it on every manual edit.
  const existing = state.courses.find(x=>x.id===id);
  return {
    id,
    titleEn: $("#fTitleEn").value.trim(),
    titleCn: $("#fTitleCn").value.trim(),
    number: $("#fNumber").value.trim(),
    seq: existing ? existing.seq : "",
    credits: parseFloat($("#fCredits").value) || 0,
    instructor: $("#fInstructor").value.trim(),
    dept: $("#fDept").value.trim(),
    lang: $("#fLang").value.trim(),
    room: $("#fRoom").value.trim(),
    weeks: $("#fWeeks").value.trim() || "1-16",
    status: $("#fStatus").value,
    note: $("#fNote").value.trim(),
    slots
  };
}

/* ============================================================
   Paste-from-course-system modal
   ============================================================ */
function openPasteModal(){
  const ov = $("#pasteModalOverlay");
  if(!ov) return;
  ov.hidden = false;
  const box = $("#pasteBox");
  if(box) setTimeout(()=>box.focus(), 30);
}
function closePasteModal(){
  const ov = $("#pasteModalOverlay");
  if(ov) ov.hidden = true;
}
function openXlsModal(){
  const ov = $("#xlsModalOverlay");
  if(ov) ov.hidden = false;
}
function closeXlsModal(){
  const ov = $("#xlsModalOverlay");
  if(ov) ov.hidden = true;
}
function closeImportModals(){ closePasteModal(); closeXlsModal(); }

/* ============================================================
   Preview shared by the paste modal and the .xls import modal
   ============================================================ */
let pending = [];
let activePreviewHost = "#parsePreview";   // set by whichever source filled `pending`
let pendingEditableWeeks = false;          // .xls import: weeks aren't in the file, let the user fill them here
function renderPreview(){
  const host = $(activePreviewHost);
  if(!host) return;
  host.innerHTML = "";
  if(!pending.length) return;

  const note = el("div","note");
  note.appendChild(el("h3", null, pending.length+(pending.length===1?" course found":" courses found")));
  const tbl = el("table"); tbl.style.minWidth = "0";
  const thead = el("thead");
  const weeksHead = pendingEditableWeeks ? "Weeks ⚠" : "Weeks";
  const cpHead = pendingEditableWeeks ? "CP ⚠" : "CP";
  thead.innerHTML = "<tr><th style='width:30px'></th><th>Course</th><th style='width:120px'>Time</th><th style='width:92px'>"+weeksHead+"</th><th style='width:62px'>"+cpHead+"</th></tr>";
  tbl.appendChild(thead);
  const tb = el("tbody");
  pending.forEach((c,i)=>{
    const tr = el("tr");
    const tdC = el("td");
    const cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = true; cb.dataset.i = i;
    tdC.appendChild(cb); tr.appendChild(tdC);
    const tdT = el("td");
    tdT.appendChild(el("span","title", c.titleEn || c.titleCn || "(no title)"));
    const sub = [c.titleCn, c.number, c.instructor, c.dept, c.room].filter(Boolean).join(" · ");
    if(sub) tdT.appendChild(el("span","cn", sub));
    tr.appendChild(tdT);
    tr.appendChild(el("td","prev-time", slotText(c)));
    if(pendingEditableWeeks){
      const tdW = el("td");
      const inp = document.createElement("input");
      inp.type = "text"; inp.className = "prev-weeks"; inp.value = c.weeks;
      inp.setAttribute("aria-label", "Weeks for "+(c.titleEn || c.titleCn || "course"));
      inp.addEventListener("input", ()=>{ c.weeks = inp.value.trim() || "1-16"; });
      tdW.appendChild(inp); tr.appendChild(tdW);

      const tdCP = el("td");
      const cpInp = document.createElement("input");
      cpInp.type = "number"; cpInp.step = "0.5"; cpInp.min = "0"; cpInp.className = "prev-cp"; cpInp.value = c.credits || "";
      cpInp.setAttribute("aria-label", "Credits for "+(c.titleEn || c.titleCn || "course"));
      cpInp.addEventListener("input", ()=>{ c.credits = parseFloat(cpInp.value) || 0; });
      tdCP.appendChild(cpInp); tr.appendChild(tdCP);
    } else {
      tr.appendChild(el("td","num", c.weeks));
      tr.appendChild(el("td","num", c.credits+""));
    }
    tb.appendChild(tr);
  });
  tbl.appendChild(tb);
  const wrap = el("div","tablewrap"); wrap.style.marginTop = "10px"; wrap.appendChild(tbl);
  note.appendChild(wrap);

  const acts = el("div","formactions");
  const add = el("button","btn","Add selected");
  add.addEventListener("click", ()=>{
    const boxes = [...host.querySelectorAll("input[type=checkbox]")];
    const toAdd = [];
    let skipped = 0;
    boxes.forEach(b=>{
      if(!b.checked) return;
      const c = pending[+b.dataset.i];
      const dup = state.courses.find(x=>x.number && x.number===c.number && String(x.seq)===String(c.seq));
      if(dup){ skipped++; return; }
      toAdd.push(c);
    });
    const added = toAdd.length;
    pending = []; const pb = $("#pasteBox"); if(pb) pb.value = ""; renderPreview();
    if(added) commit("Add "+added+(added===1?" course":" courses"), { courses: state.courses.concat(toAdd) });
    toastUndo(added+(added===1?" course added":" courses added")+(skipped?", "+skipped+" skipped as duplicate":""));
    if(added){ closeImportModals(); showPanel("week"); } // feature: land on the week view after adding
  });
  const cancel = el("button","btn ghost","Discard");
  cancel.addEventListener("click", ()=>{ pending = []; renderPreview(); });
  acts.appendChild(add); acts.appendChild(cancel);
  acts.appendChild(el("span","hint","New courses come in as “Option” — visible on the calendar, clearly apart from booked ones."));
  note.appendChild(acts);
  host.appendChild(note);
}
