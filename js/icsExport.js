"use strict";

/* ============================================================
   .ics export (feature: import into Google/Android Calendar)

   Beijing has a fixed UTC+8 offset (no DST), so each meeting is
   converted to UTC explicitly — this keeps event times correct
   regardless of the device/browser timezone that later imports
   the file.

   A settings modal lets the user pick a week range and which
   individual courses to include before exporting, rather than
   always exporting whatever the on-screen filters happen to show.
   ============================================================ */
function icsEscape(s){
  return String(s==null?"":s)
    .replace(/\\/g,"\\\\")
    .replace(/;/g,"\\;")
    .replace(/,/g,"\\,")
    .replace(/\n/g,"\\n");
}

/* UTC Date object for a given semester week + weekday (1=Mon) + "HH:MM"
   Beijing local time. */
function beijingToUTC(week, day, hhmm){
  const [hh, mm] = String(hhmm).split(":").map(Number);
  const dayOffset = (week-1)*7 + (day-1);
  // WEEK1_MONDAY's Y/M/D *is* Monday of week 1 in Beijing's calendar.
  const ms = Date.UTC(
    WEEK1_MONDAY.getFullYear(), WEEK1_MONDAY.getMonth(), WEEK1_MONDAY.getDate() + dayOffset,
    hh - 8, mm, 0
  );
  return new Date(ms);
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

/* opts: {courseIds: Set<string>, weekFrom: number, weekTo: number} */
function buildICS(opts){
  const courseIds = (opts && opts.courseIds) || new Set(state.courses.filter(isVisible).map(c=>c.id));
  const weekFrom = (opts && opts.weekFrom) || 1;
  const weekTo = (opts && opts.weekTo) || TOTAL_WEEKS;
  const now = fmtICSDate(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Tsinghua SEM Course Planner//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH"
  ];

  let count = 0;
  state.courses
    .filter(c => courseIds.has(c.id))
    .forEach(c=>{
      const weeks = parseWeeks(c.weeks).filter(w => w>=weekFrom && w<=weekTo);
      (c.slots||[]).forEach((slot, si)=>{
        weeks.forEach(w=>{
          const dtStart = beijingToUTC(w, slot.day, slot.start);
          const dtEnd = beijingToUTC(w, slot.day, slot.end);
          const uidStr = (c.id+"-"+si+"-w"+w+"@tsinghua-planner").replace(/[^A-Za-z0-9@\-]/g,"");
          const summary = icsEscape((c.titleEn || c.titleCn) + (c.titleEn && c.titleCn ? " / "+c.titleCn : ""));
          const descParts = [
            c.instructor ? "Instructor: "+c.instructor : "",
            c.dept || "",
            "Status: "+statusLabel(c.status),
            c.credits ? c.credits+" CP" : "",
            c.note || ""
          ].filter(Boolean);
          lines.push(foldICSLine("BEGIN:VEVENT"));
          lines.push(foldICSLine("UID:"+uidStr));
          lines.push(foldICSLine("DTSTAMP:"+now));
          lines.push(foldICSLine("DTSTART:"+fmtICSDate(dtStart)));
          lines.push(foldICSLine("DTEND:"+fmtICSDate(dtEnd)));
          lines.push(foldICSLine("SUMMARY:"+summary));
          if(c.room) lines.push(foldICSLine("LOCATION:"+icsEscape(c.room)));
          if(descParts.length) lines.push(foldICSLine("DESCRIPTION:"+icsEscape(descParts.join(" · "))));
          lines.push("END:VEVENT");
          count++;
        });
      });
    });

  lines.push("END:VCALENDAR");
  return { text: lines.join("\r\n"), count };
}

function downloadICS(opts){
  const { text, count } = buildICS(opts);
  if(!count){
    toast("No meetings match that selection");
    return false;
  }
  const blob = new Blob([text], {type:"text/calendar;charset=utf-8"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "tsinghua-courses-"+new Date().toISOString().slice(0,10)+".ics";
  document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 500);
  toast(count+(count===1?" event exported":" events exported"));
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
  state.courses.forEach(c=>{
    const row = el("label","ics-course-row");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.dataset.id = c.id;
    cb.checked = c.status !== "out"; // dropped courses default unchecked
    row.appendChild(cb);
    row.appendChild(el("span",null, c.titleEn || c.titleCn || "(no title)"));
    row.appendChild(el("span","cn", statusLabel(c.status)));
    host.appendChild(row);
  });

  $("#icsModalOverlay").hidden = false;
}
function closeICSModal(){ $("#icsModalOverlay").hidden = true; }

function icsModalSelectedIds(){
  return new Set(
    [...document.querySelectorAll("#icsCourseCheckboxes input[type=checkbox]:checked")]
      .map(cb=>cb.dataset.id)
  );
}
