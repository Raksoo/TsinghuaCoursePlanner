"use strict";

/* ============================================================
   .ics export — the hand-off from this planner to the phone's
   calendar.

   - Beijing has a fixed UTC+8 offset (no DST), so each meeting is
     converted to UTC explicitly; times stay right whatever timezone
     the importing device is in.
   - Holidays (calendar.js) are skipped by default; a single meeting
     that was moved by hand is written on its new date, with the
     same UID as its normal slot, so a later export replaces it.
   - UIDs are courseId-slotIdx-wN. SEQUENCE counts up per export so
     calendars that honour UIDs (Google, Outlook) update instead of
     duplicating. Apple Calendar's file import doesn't, hence the
     "dedicated calendar" advice in the modal.
   - On phones the file goes through the share sheet (Web Share API),
     where "Add to Calendar" is one tap; desktop downloads the file.
   ============================================================ */
function icsEscape(s){
  return String(s==null?"":s)
    .replace(/\\/g,"\\\\")
    .replace(/;/g,"\\;")
    .replace(/,/g,"\\,")
    .replace(/\n/g,"\\n");
}

/* UTC Date for a Beijing-local "YYYY-MM-DD" + "HH:MM". */
function beijingISOToUTC(iso, hhmm){
  const [y, m, d] = String(iso).split("-").map(Number);
  const [hh, mm] = String(hhmm).split(":").map(Number);
  return new Date(Date.UTC(y, m-1, d, hh - 8, mm, 0));
}
/* UTC Date for a semester week + weekday (1=Mon) + "HH:MM" Beijing time. */
function beijingToUTC(week, day, hhmm){
  return beijingISOToUTC(dateKey(week, day), hhmm);
}
function fmtICSDate(d){
  return d.getUTCFullYear()
    + pad2(d.getUTCMonth()+1) + pad2(d.getUTCDate()) + "T"
    + pad2(d.getUTCHours()) + pad2(d.getUTCMinutes()) + "00Z";
}
function foldICSLine(line){
  // RFC5545 line folding at 75 octets, continuation lines start with a space.
  if(line.length <= 75) return line;
  let out = line.slice(0,75), rest = line.slice(75);
  while(rest.length){
    out += "\r\n " + rest.slice(0,74);
    rest = rest.slice(74);
  }
  return out;
}

/* One row per meeting that will be written (or skipped, with the reason),
   honouring holidays and per-meeting overrides. */
function icsOccurrences(opts){
  const courseIds = opts.courseIds;
  const rows = [];
  state.courses.filter(c => courseIds.has(c.id)).forEach(c=>{
    const weeks = parseWeeks(c.weeks).filter(w => w>=opts.weekFrom && w<=opts.weekTo);
    (c.slots||[]).forEach((slot, si)=>{
      weeks.forEach(w=>{
        const ov = overrideFor(c.id, si, w);
        const hol = holidayOn(w, +slot.day);
        const base = { course:c, slot, slotIdx:si, week:w, holiday:hol, override:ov };
        if(ov && !ov.movedTo){ rows.push(Object.assign(base, { skip:"cancelled" })); return; }
        if(ov && ov.movedTo){
          rows.push(Object.assign(base, {
            date: ov.movedTo, start: ov.start || slot.start, end: ov.end || slot.end, moved:true
          }));
          return;
        }
        if(hol && opts.skipHolidays){ rows.push(Object.assign(base, { skip:"holiday" })); return; }
        rows.push(Object.assign(base, { date: dateKey(w, +slot.day), start: slot.start, end: slot.end }));
      });
    });
  });
  return rows;
}

/* opts: {courseIds, weekFrom, weekTo, skipHolidays, includeChinese, inclNumber,
          inclInstructor, inclDept, inclStatus, inclCredits, inclNote,
          travelMin, alarmMin, seq} */
function buildICS(opts){
  opts = Object.assign({
    courseIds: new Set(state.courses.filter(c=>c.status==="booked").map(c=>c.id)),
    weekFrom: 1, weekTo: TOTAL_WEEKS, skipHolidays: true, seq: 0
  }, opts||{});
  const now = fmtICSDate(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Tsinghua SEM Course Planner//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Tsinghua Fall 2026",
    "X-WR-TIMEZONE:Asia/Shanghai"
  ];

  const rows = icsOccurrences(opts);
  let count = 0, skippedHoliday = 0, skippedCancelled = 0, moved = 0;
  rows.forEach(r=>{
    if(r.skip==="holiday"){ skippedHoliday++; return; }
    if(r.skip==="cancelled"){ skippedCancelled++; return; }
    if(r.moved) moved++;
    const c = r.course;
    const dtStart = beijingISOToUTC(r.date, r.start);
    const dtEnd = beijingISOToUTC(r.date, r.end);
    const uidStr = (c.id+"-"+r.slotIdx+"-w"+r.week+"@tsinghua-planner").replace(/[^A-Za-z0-9@\-]/g,"");
    // Title is English only — the Chinese name never goes in the title.
    const summary = icsEscape(c.titleEn || c.titleCn || "Course");
    const descParts = [
      r.moved ? "Moved from "+DAYS_SHORT[+r.slot.day-1]+" "+dayDate(r.week, +r.slot.day)+(r.holiday ? " ("+r.holiday+")" : "")+(r.override.note ? " — "+r.override.note : "") : "",
      opts.inclNumber && c.number ? "Course "+c.number+(c.seq ? "-"+c.seq : "") : "",
      opts.includeChinese && c.titleCn ? "Chinese: "+c.titleCn : "",
      opts.inclInstructor && c.instructor ? "Instructor: "+c.instructor : "",
      opts.inclDept && c.dept ? c.dept : "",
      opts.inclStatus ? "Status: "+statusLabel(c.status) : "",
      opts.inclCredits && c.credits ? c.credits+" CP" : "",
      opts.inclNote && c.note ? c.note : ""
    ].filter(Boolean);
    lines.push("BEGIN:VEVENT");
    lines.push(foldICSLine("UID:"+uidStr));
    lines.push("SEQUENCE:"+opts.seq);
    lines.push("DTSTAMP:"+now);
    lines.push("LAST-MODIFIED:"+now);
    lines.push("DTSTART:"+fmtICSDate(dtStart));
    lines.push("DTEND:"+fmtICSDate(dtEnd));
    lines.push(foldICSLine("SUMMARY:"+summary));
    if(c.room) lines.push(foldICSLine("LOCATION:"+icsEscape(c.room)));
    if(descParts.length) lines.push(foldICSLine("DESCRIPTION:"+icsEscape(descParts.join(" · "))));
    lines.push(foldICSLine("CATEGORIES:"+icsEscape(statusLabel(c.status))));
    if(opts.travelMin > 0){
      // Apple Calendar: a real travel-time block before the event (other apps ignore this).
      lines.push("X-APPLE-TRAVEL-DURATION;VALUE=DURATION:PT"+opts.travelMin+"M");
      lines.push("BEGIN:VALARM");
      lines.push("ACTION:DISPLAY");
      lines.push(foldICSLine("DESCRIPTION:"+icsEscape("Leave for "+(c.titleEn || c.titleCn || "class"))));
      lines.push("TRIGGER:-PT"+opts.travelMin+"M");
      lines.push("END:VALARM");
    }
    if(opts.alarmMin > 0){
      lines.push("BEGIN:VALARM");
      lines.push("ACTION:DISPLAY");
      lines.push(foldICSLine("DESCRIPTION:"+summary));
      lines.push("TRIGGER:-PT"+opts.alarmMin+"M");
      lines.push("END:VALARM");
    }
    lines.push("END:VEVENT");
    count++;
  });

  lines.push("END:VCALENDAR");
  return { text: lines.join("\r\n"), count, skippedHoliday, skippedCancelled, moved };
}

function icsFileName(opts){
  const wk = opts.weekFrom===opts.weekTo ? "w"+opts.weekFrom : "w"+opts.weekFrom+"-"+opts.weekTo;
  return "tsinghua-"+wk+"-"+new Date().toISOString().slice(0,10)+".ics";
}

/* Phones: share sheet (→ "Add to Calendar"). Desktop / no Web Share: download. */
function deliverICS(text, name){
  const blob = new Blob([text], {type:"text/calendar;charset=utf-8"});
  let file = null;
  try{ file = new File([blob], name, {type:"text/calendar"}); }catch(e){ file = null; }
  if(file && navigator.canShare && navigator.canShare({files:[file]})){
    return navigator.share({ files:[file], title:"Tsinghua courses" })
      .then(()=>"shared")
      .catch(err=>{
        if(err && err.name==="AbortError") return "cancelled";   // user closed the sheet
        downloadBlob(blob, name); return "downloaded";
      });
  }
  downloadBlob(blob, name);
  return Promise.resolve("downloaded");
}
function downloadBlob(blob, name){
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

function downloadICS(opts){
  // Each export bumps SEQUENCE so UID-aware calendars replace the older copy.
  // Optional state field; older saved states simply start at 0.
  const seq = (parseInt(state.icsSeq) || 0) + 1;
  const { text, count } = buildICS(Object.assign({}, opts, { seq }));
  if(!count){
    toast("No meetings match that selection");
    return false;
  }
  state.icsSeq = seq; save();
  deliverICS(text, icsFileName(opts)).then(how=>{
    if(how==="cancelled") return;
    toast(count+(count===1?" event":" events")+(how==="shared" ? " sent to the share sheet" : " exported"));
  });
  return true;
}

/* ============================================================
   Export settings modal
   ============================================================ */
function openICSModal(){
  const from = $("#icsWeekFrom"), to = $("#icsWeekTo");
  from.innerHTML = ""; to.innerHTML = "";
  for(let w=1; w<=TOTAL_WEEKS; w++){
    const o1 = el("option", null, "Week "+w); o1.value = w;
    const o2 = el("option", null, "Week "+w); o2.value = w;
    from.appendChild(o1); to.appendChild(o2);
  }
  from.value = "1";
  to.value = String(TOTAL_WEEKS);

  const host = $("#icsCourseCheckboxes");
  host.innerHTML = "";
  const exportable = state.courses.filter(c => c.status !== "out"); // dropped courses are never exported
  if(!exportable.length){
    host.appendChild(el("div","ics-empty","No active courses to export — every course is dropped."));
  }
  exportable.forEach(c=>{
    const row = el("label","ics-course-row");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.dataset.id = c.id;
    cb.dataset.status = c.status;
    cb.checked = c.status === "booked";   // only what you will actually attend, by default
    row.appendChild(cb);
    row.appendChild(el("span",null, c.titleEn || c.titleCn || "(no title)"));
    row.appendChild(el("span","cn", statusLabel(c.status)));
    host.appendChild(row);
  });

  const holidayNames = [...new Set(HOLIDAYS.map(h=>h.name))];
  $("#icsSkipHolidaysLabel").textContent = "Skip holiday dates"+(holidayNames.length ? " ("+holidayNames.join(", ")+")" : "");
  $("#icsSkipHolidays").checked = true;
  $("#icsModalOverlay").hidden = false;
  renderICSSummary();
}
function closeICSModal(){ $("#icsModalOverlay").hidden = true; }

function icsModalSelectedIds(){
  return new Set(
    [...document.querySelectorAll("#icsCourseCheckboxes input[type=checkbox]:checked")]
      .map(cb=>cb.dataset.id)
  );
}
function icsModalOptions(){
  let weekFrom = +$("#icsWeekFrom").value, weekTo = +$("#icsWeekTo").value;
  if(weekFrom > weekTo){ const t=weekFrom; weekFrom=weekTo; weekTo=t; }
  return {
    courseIds: icsModalSelectedIds(), weekFrom, weekTo,
    skipHolidays: $("#icsSkipHolidays").checked,
    includeChinese: $("#icsInclCn").checked,
    inclNumber: $("#icsInclNumber").checked,
    inclInstructor: $("#icsInclInstructor").checked,
    inclDept: $("#icsInclDept").checked,
    inclStatus: $("#icsInclStatus").checked,
    inclCredits: $("#icsInclCredits").checked,
    inclNote: $("#icsInclNote").checked,
    travelMin: $("#icsTravel").checked ? (parseInt($("#icsTravelMin").value) || 0) : 0,
    alarmMin: $("#icsAlarm").checked ? (parseInt($("#icsAlarmMin").value) || 0) : 0
  };
}
/* Live line under the options: "42 events · 3 skipped (holidays) · 1 moved" */
function renderICSSummary(){
  const host = $("#icsSummary"); if(!host) return;
  const r = buildICS(icsModalOptions());
  const parts = [ r.count+(r.count===1?" event":" events") ];
  if(r.skippedHoliday) parts.push(r.skippedHoliday+" skipped (holidays)");
  if(r.skippedCancelled) parts.push(r.skippedCancelled+" cancelled");
  if(r.moved) parts.push(r.moved+" moved to another date");
  host.textContent = parts.join(" · ");
}
