"use strict";

/* ============================================================
   Holidays and moved meetings (feature: show the university's
   holidays in the week view, and let a single meeting be marked
   as moved to another date or cancelled).

   Both live *next to* the courses, never inside them:
   - Holidays come from data/holidays.json (one entry per date).
     The course objects know nothing about them.
   - Overrides live in state.overrides, keyed "courseId|slotIdx|week",
     each { movedTo:"YYYY-MM-DD", start?, end?, note? } — movedTo
     empty/absent means "cancelled, no make-up". Course weeks/slots
     stay exactly as they are; only the display and the .ics export
     read this table.
   ============================================================ */
let HOLIDAYS = [];                     // [{date, name}]
let holidaysStatus = "loading";        // loading | ok | error

function isoDate(d){ return d.getFullYear()+"-"+pad2(d.getMonth()+1)+"-"+pad2(d.getDate()); }
function dateKey(week, day){ return isoDate(dateFor(week, day)); }
/* "Sat Oct 10" from "2026-10-10" (parsed as a local date, not UTC) */
function fmtISO(iso){
  const m = String(iso||"").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!m) return iso||"";
  const d = new Date(+m[1], +m[2]-1, +m[3]);
  return DAYS_SHORT[(d.getDay()+6)%7]+" "+MONTHS[d.getMonth()]+" "+d.getDate();
}

function loadHolidays(){
  return fetch("data/holidays.json")
    .then(r=>{ if(!r.ok) throw new Error(r.status); return r.json(); })
    .then(j=>{
      HOLIDAYS = (j && Array.isArray(j.holidays) ? j.holidays : []).filter(h=>h && /^\d{4}-\d{2}-\d{2}$/.test(h.date));
      holidaysStatus = "ok";
    })
    .catch(()=>{ HOLIDAYS = []; holidaysStatus = "error"; });
}

function holidayOn(week, day){
  if(week==="all") return null;
  const key = dateKey(week, day);
  const h = HOLIDAYS.find(x=>x.date===key);
  return h ? h.name : null;
}
/* Weekdays (1–7) of a week that are holidays, e.g. [{day:1,name:"National Day"}, …] */
function holidayDaysInWeek(week){
  const out = [];
  for(let d=1; d<=7; d++){ const n = holidayOn(week, d); if(n) out.push({day:d, name:n}); }
  return out;
}
/* "Mon–Wed" / "Thu, Fri" — short label for the week dropdown (weekdays only) */
function holidayLabelForWeek(week){
  const days = holidayDaysInWeek(week).map(h=>h.day).filter(d=>d<=5);
  if(!days.length) return "";
  const contiguous = days.every((d,i)=>i===0 || d===days[i-1]+1);
  if(contiguous && days.length>1) return DAYS_SHORT[days[0]-1]+"–"+DAYS_SHORT[days[days.length-1]-1];
  return days.map(d=>DAYS_SHORT[d-1]).join(", ");
}

/* ---------- overrides ---------- */
function overrideKey(courseId, slotIdx, week){ return courseId+"|"+slotIdx+"|"+week; }
function overrideFor(courseId, slotIdx, week){
  return (state.overrides||{})[overrideKey(courseId, slotIdx, week)] || null;
}
function setOverride(courseId, slotIdx, week, data, label){
  const next = Object.assign({}, state.overrides||{});
  next[overrideKey(courseId, slotIdx, week)] = data;
  commit(label || "Move meeting", { overrides: next });
}
function clearOverride(courseId, slotIdx, week, label){
  const next = Object.assign({}, state.overrides||{});
  delete next[overrideKey(courseId, slotIdx, week)];
  commit(label || "Clear moved meeting", { overrides: next });
}
function overrideBadge(ov){
  if(!ov) return "";
  if(!ov.movedTo) return "Cancelled";
  return "→ "+fmtISO(ov.movedTo)+(ov.start && ov.end ? " "+ov.start+"–"+ov.end : "");
}

/* Every meeting across the semester that needs a decision or has one:
   falls on a holiday, or has an override. Dropped courses are skipped. */
function affectedMeetings(){
  const out = [];
  state.courses.filter(c=>c.status!=="out").forEach(c=>{
    const weeks = parseWeeks(c.weeks);
    (c.slots||[]).forEach((slot, si)=>{
      weeks.forEach(w=>{
        const hol = holidayOn(w, +slot.day);
        const ov = overrideFor(c.id, si, w);
        if(!hol && !ov) return;
        out.push({ course:c, slotIdx:si, slot, week:w, day:+slot.day, date:dateKey(w, +slot.day), holiday:hol, override:ov });
      });
    });
  });
  return out.sort((a,b)=>a.date.localeCompare(b.date) || toMin(a.slot.start)-toMin(b.slot.start));
}

/* ---------- "Holidays & moved meetings" box under the clash box ---------- */
/* Single week: only that week's meetings, hidden when there are none.
   All weeks: the whole semester, collapsed by default. */
function renderHolidayBox(){
  const box = $("#holidayBox");
  if(!box) return;
  box.innerHTML = "";
  if(holidaysStatus==="error"){
    const n = el("div","note warn");
    n.innerHTML = "<h3>Holiday data not loaded</h3>data/holidays.json could not be read — open the app over http(s), not as a file, to see holidays.";
    box.appendChild(n);
  }
  const all = state.week === "all";
  const items = all ? affectedMeetings() : affectedMeetings().filter(it=>it.week===state.week);
  if(!items.length) return;
  const n = el(all ? "details" : "div", "note hol"+(all ? " collapsible" : ""));
  const title = (all ? "Holidays & moved meetings — whole semester" : "Holidays & moved meetings — week "+state.week)
    + " ("+items.length+")";
  n.appendChild(el(all ? "summary" : "h3", all ? "hol-summary" : null, title));
  n.appendChild(el("p","hint", "These single meetings fall on a university holiday or were moved by hand. Ask the instructor whether a holiday session is made up, then record it here — the course itself stays unchanged."));
  const ul = el("ul");
  items.forEach(it=>{
    const li = el("li");
    const c = it.course;
    li.appendChild(el("b", null, c.titleEn||c.titleCn||"Course"));
    let txt = " — "+DAYS_SHORT[it.day-1]+" "+dayDate(it.week, it.day)+" (week "+it.week+"), "+it.slot.start+"–"+it.slot.end;
    if(it.holiday) txt += " · "+it.holiday;
    li.appendChild(document.createTextNode(txt));
    if(it.override){
      const b = el("span","badge "+(it.override.movedTo?"mv":"hol"), overrideBadge(it.override));
      li.appendChild(document.createTextNode(" ")); li.appendChild(b);
      if(it.override.note) li.appendChild(el("span","hint", " "+it.override.note));
    }
    const act = el("span","rowact inline");
    const bMove = el("button","btn ghost small", it.override ? "Edit" : "Move this meeting…");
    bMove.addEventListener("click", ()=>openMoveModal(c.id, it.slotIdx, it.week));
    act.appendChild(bMove);
    if(it.override){
      const bClr = el("button","btn ghost small","Clear");
      bClr.addEventListener("click", ()=>{
        clearOverride(c.id, it.slotIdx, it.week, "Clear move of “"+(c.titleEn||c.titleCn)+"” (week "+it.week+")");
        toastUndo("Move cleared");
      });
      act.appendChild(bClr);
    }
    li.appendChild(act);
    ul.appendChild(li);
  });
  n.appendChild(ul);
  box.appendChild(n);
}

/* ---------- "Move this meeting" modal ---------- */
let moveTarget = null;   // {courseId, slotIdx, week}

function openMoveModal(courseId, slotIdx, week){
  const c = state.courses.find(x=>x.id===courseId);
  const slot = c && (c.slots||[])[slotIdx];
  if(!c || !slot) return;
  moveTarget = { courseId, slotIdx, week };
  const ov = overrideFor(courseId, slotIdx, week);
  const hol = holidayOn(week, +slot.day);
  $("#moveCourse").textContent = c.titleEn||c.titleCn||"Course";
  $("#moveWhen").textContent = DAYS[slot.day-1]+" "+dayDate(week, +slot.day)+" (week "+week+"), "+slot.start+"–"+slot.end
    + (hol ? " · "+hol+" — no classes" : "");
  $("#moveCancelled").checked = !!(ov && !ov.movedTo);
  $("#moveDate").value  = ov && ov.movedTo ? ov.movedTo : "";
  $("#moveStart").value = (ov && ov.start) || slot.start;
  $("#moveEnd").value   = (ov && ov.end) || slot.end;
  $("#moveNote").value  = (ov && ov.note) || "";
  $("#moveClear").hidden = !ov;
  syncMoveFields();
  $("#moveModalOverlay").hidden = false;
  if(!$("#moveCancelled").checked) $("#moveDate").focus();
}
function closeMoveModal(){ $("#moveModalOverlay").hidden = true; moveTarget = null; }
function syncMoveFields(){
  const off = $("#moveCancelled").checked;
  ["#moveDate","#moveStart","#moveEnd"].forEach(sel=>{ $(sel).disabled = off; });
}
function saveMoveModal(){
  if(!moveTarget) return;
  const c = state.courses.find(x=>x.id===moveTarget.courseId);
  const name = c ? (c.titleEn||c.titleCn) : "course";
  const cancelled = $("#moveCancelled").checked;
  const date = $("#moveDate").value, start = $("#moveStart").value, end = $("#moveEnd").value;
  const note = $("#moveNote").value.trim();
  if(!cancelled){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){ toast("Pick the new date"); return; }
    if(!start || !end || toMin(end) <= toMin(start)){ toast("End time must be after the start"); return; }
  }
  const data = cancelled ? { note } : { movedTo: date, start, end, note };
  setOverride(moveTarget.courseId, moveTarget.slotIdx, moveTarget.week, data,
              (cancelled ? "Cancel “" : "Move “")+name+"” (week "+moveTarget.week+")");
  toastUndo(cancelled ? "Meeting marked as cancelled" : "Meeting moved to "+fmtISO(date));
  closeMoveModal();
}
function clearMoveModal(){
  if(!moveTarget) return;
  const c = state.courses.find(x=>x.id===moveTarget.courseId);
  clearOverride(moveTarget.courseId, moveTarget.slotIdx, moveTarget.week,
                "Clear move of “"+(c ? (c.titleEn||c.titleCn) : "course")+"” (week "+moveTarget.week+")");
  toastUndo("Move cleared");
  closeMoveModal();
}
