"use strict";

/* ============================================================
   Add/edit form
   ============================================================ */
function addSlotRow(slot){
  const host = $("#slotRows");
  const row = el("div","slotrow");

  const f1 = el("label","field"); f1.appendChild(el("span",null,"Day"));
  const daySel = el("select");
  DAYS.forEach((d,i)=>{ const o = el("option",null,d); o.value = i+1; daySel.appendChild(o); });
  daySel.value = slot && slot.day ? slot.day : 1;
  f1.appendChild(daySel); row.appendChild(f1);

  const f2 = el("label","field"); f2.appendChild(el("span",null,"From"));
  const t1 = document.createElement("input"); t1.type = "time"; t1.value = (slot&&slot.start)||"08:00";
  f2.appendChild(t1); row.appendChild(f2);

  const f3 = el("label","field"); f3.appendChild(el("span",null,"To"));
  const t2 = document.createElement("input"); t2.type = "time"; t2.value = (slot&&slot.end)||"09:35";
  f3.appendChild(t2); row.appendChild(f3);

  const f4 = el("label","field"); f4.appendChild(el("span",null,"Block"));
  const bSel = el("select");
  const o0 = el("option",null,"Custom"); o0.value = ""; bSel.appendChild(o0);
  BLOCKS.forEach(b=>{ const o = el("option",null,"Block "+b.n+" ("+b.start+"–"+b.end+")"); o.value = b.n; bSel.appendChild(o); });
  bSel.value = slot && slot.block ? slot.block : "";
  bSel.addEventListener("change", ()=>{
    const b = BLOCKS.find(x=>x.n===+bSel.value);
    if(b){ t1.value = b.start; t2.value = b.end; }
  });
  f4.appendChild(bSel); row.appendChild(f4);

  const rm = el("button","btn danger small","Remove");
  rm.addEventListener("click", ()=>row.remove());
  row.appendChild(rm);

  row._read = () => ({ day:+daySel.value, start:t1.value, end:t2.value, block: bSel.value? +bSel.value : undefined });
  host.appendChild(row);
}

function fillForm(c){
  $("#fId").value        = c ? c.id : "";
  $("#fTitleEn").value   = c ? esc(c.titleEn) : "";
  $("#fTitleCn").value   = c ? esc(c.titleCn) : "";
  $("#fNumber").value    = c ? esc(c.number) : "";
  $("#fSeq").value       = c ? esc(c.seq) : "";
  $("#fCredits").value   = c ? (c.credits||0) : "";
  $("#fInstructor").value= c ? esc(c.instructor) : "";
  $("#fDept").value      = c ? esc(c.dept) : "";
  $("#fLang").value      = c ? esc(c.lang) : "";
  $("#fRoom").value      = c ? esc(c.room) : "";
  $("#fWeeks").value     = c ? esc(c.weeks) : "1-16";
  $("#fStatus").value    = c ? c.status : "option";
  $("#fNote").value      = c ? esc(c.note) : "";
  $("#fCode").value      = "";
  $("#slotRows").innerHTML = "";
  if(c && c.slots && c.slots.length) c.slots.forEach(addSlotRow);
  else addSlotRow();
  $("#formTitle").textContent = c ? "Edit course" : "Add a course manually";
  $("#deleteCourse").style.display = c ? "inline-block" : "none";
  const lead = $("#formLead");
  if(lead){
    lead.textContent = c
      ? "Editing “"+(c.titleEn||c.titleCn||"this course")+"”. Change any field and click Save course, or Delete course to remove it."
      : "For courses with fixed times instead of a block code — such as the SEM electives from the MBA schedule (8:00–11:25, 13:30–16:55, 19:00–22:00). This same form is used to edit an existing course — click any course in the Course list to open it here.";
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
  return {
    id: $("#fId").value || uid(),
    titleEn: $("#fTitleEn").value.trim(),
    titleCn: $("#fTitleCn").value.trim(),
    number: $("#fNumber").value.trim(),
    seq: $("#fSeq").value.trim(),
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
   Paste preview
   ============================================================ */
let pending = [];
function renderPreview(){
  const host = $("#parsePreview");
  host.innerHTML = "";
  if(!pending.length) return;

  const note = el("div","note");
  note.appendChild(el("h3", null, pending.length+(pending.length===1?" course found":" courses found")));
  const tbl = el("table"); tbl.style.minWidth = "0";
  const thead = el("thead");
  thead.innerHTML = "<tr><th style='width:34px'></th><th>Course</th><th style='width:110px'>Time</th><th style='width:75px'>Weeks</th><th style='width:55px'>CP</th></tr>";
  tbl.appendChild(thead);
  const tb = el("tbody");
  pending.forEach((c,i)=>{
    const tr = el("tr");
    const tdC = el("td");
    const cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = true; cb.dataset.i = i;
    tdC.appendChild(cb); tr.appendChild(tdC);
    const tdT = el("td");
    tdT.appendChild(el("span","title", c.titleEn || c.titleCn || "(no title)"));
    tdT.appendChild(el("span","cn", [c.titleCn, c.number, c.instructor, c.dept].filter(Boolean).join(" · ")));
    tr.appendChild(tdT);
    tr.appendChild(el("td","num", slotText(c)));
    tr.appendChild(el("td","num", c.weeks));
    tr.appendChild(el("td","num", c.credits+""));
    tb.appendChild(tr);
  });
  tbl.appendChild(tb);
  const wrap = el("div","tablewrap"); wrap.style.marginTop = "10px"; wrap.appendChild(tbl);
  note.appendChild(wrap);

  const acts = el("div","formactions");
  const add = el("button","btn","Add selected");
  add.addEventListener("click", ()=>{
    const boxes = [...host.querySelectorAll("input[type=checkbox]")];
    let added = 0, skipped = 0;
    boxes.forEach(b=>{
      if(!b.checked) return;
      const c = pending[+b.dataset.i];
      const dup = state.courses.find(x=>x.number && x.number===c.number && String(x.seq)===String(c.seq));
      if(dup){ skipped++; return; }
      state.courses.push(c); added++;
    });
    pending = []; $("#pasteBox").value = ""; renderPreview();
    save(); renderAll();
    toast(added+(added===1?" course added":" courses added")+(skipped?", "+skipped+" skipped as duplicate":""));
    if(added) showPanel("week"); // feature: land on the week view after adding
  });
  const cancel = el("button","btn ghost","Discard");
  cancel.addEventListener("click", ()=>{ pending = []; renderPreview(); });
  acts.appendChild(add); acts.appendChild(cancel);
  acts.appendChild(el("span","hint","New courses come in as “Option” — visible on the calendar, clearly apart from booked ones."));
  note.appendChild(acts);
  host.appendChild(note);
}
