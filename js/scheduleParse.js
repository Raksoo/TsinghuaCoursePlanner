"use strict";

/* ============================================================
   Reads the Tsinghua Info portal's "My timetable" page.

   ONE parser, two callers (see PLANNING.md section 12):
   - tools/portal-schedule-scrape.js loads this file into the portal
     page and runs it against that page's live `document`;
   - the app runs it against a `document` built from pasted page
     source, so the import works without console or bookmarklet.
   Both hand in a document -- nothing here touches a global `document`.

   What the page gives us (verified against the archived dump):
     table.kebiao_table, rows = the six Tsinghua blocks ("Section 1...6"),
     columns = Monday...Sunday. A booked cell carries

       <td id="a<block>_<day>">
         <span onmouseover="...overlib('Classroom: <room, often Chinese><br>Week: week 1-3,5', ...)">
           <a href="...showKcDetail&p_kch=<number>&p_kxh=<seq>&...">Title</a></span><br>

   So each cell yields day, block, room, weeks, course number, sequence,
   title and the detail-page URL. Credits, instructor and department are
   NOT on this page -- they come from the catalog by number+seq.
   ============================================================ */

/* A course sitting in two stacked blocks (08:00-09:35 + 09:50-12:15) is
   one lecture in the real world, not two. Merge such runs so the week
   grid and the .ics show one event. The portal only knows whole blocks,
   so the end time can be later than the course's real one -- `merged`
   marks those meetings and the import preview says so. */
function parseSchedulePage(doc){
  const table = doc.querySelector("table.kebiao_table");
  if(!table) throw new Error("No timetable found on this page -- open 'My timetable' in the portal first.");

  const cells = [];
  let semester = "";
  // Only the FIRST table: a saved page can contain the document more
  // than once (the archived RTF export repeats it five times).
  table.querySelectorAll("td[id]").forEach(td=>{
    const m = /^a(\d+)_(\d+)$/.exec(td.id || "");
    if(!m) return;
    const block = +m[1], day = +m[2];
    if(!(block >= 1 && block <= 6 && day >= 1 && day <= 7)) return;
    entriesInCell(td).forEach(e=>{
      if(e.semester && !semester) semester = e.semester;
      cells.push(Object.assign({ day, block }, e));
    });
  });

  return { semester, scraped: today(), meetings: mergeBlocks(cells) };
}

/* One <td> can hold several courses -- each in its own <span> (or, when
   the tooltip is missing, as a bare <a>). */
function entriesInCell(td){
  const out = [];
  td.querySelectorAll("a[href*='showKcDetail']").forEach(a=>{
    const href = a.getAttribute("href") || "";
    const span = a.closest("span");
    const tip = span ? (span.getAttribute("onmouseover") || "") : "";
    const weeksRaw = (/Week:\s*([^'<]*?)\s*(?:<br|['\\]|$)/i.exec(tip) || [])[1] || "";
    out.push({
      number: param(href, "p_kch"),
      seq: param(href, "p_kxh"),
      semester: param(href, "p_xnxq"),
      titleEn: (a.textContent || "").replace(/\s+/g, " ").trim(),
      room: roomFrom(tip),
      weeksRaw: weeksRaw,
      weeks: weeksToAppNotation(weeksRaw),
      detailUrl: href,
    });
  });
  return out;
}

/* overlib('Classroom: <room, often Chinese><br>Week: week 1-3,5', WRAP, ...)
   -- the room runs up to the <br> that starts the week part. The dump
   has it both HTML-escaped and not, depending on how the page was saved. */
function roomFrom(tip){
  const m = /Classroom:\s*([\s\S]*?)\s*(?:<br|&lt;br|Week:|['\\])/i.exec(tip);
  return m ? m[1].replace(/\s+/g, " ").trim() : "";
}

/* "week 1-3,5" -> "1-3,5" (what parseWeeks() in core.js reads).
   \u2013 is an en dash: the portal sometimes writes ranges with one. It is
   spelled as an escape because this whole file must stay pure ASCII -- see
   the note at the top of tools/portal-schedule-scrape.js. */
function weeksToAppNotation(raw){
  const cleaned = String(raw || "").replace(/weeks?/ig, "").replace(/\s+/g, "");
  return /^[\d,\-\u2013]+$/.test(cleaned) ? cleaned.replace(/\u2013/g, "-") : "";
}

function param(url, name){
  const m = new RegExp("[?&]" + name + "=([^&#]*)").exec(url || "");
  return m ? decodeURIComponent(m[1]) : "";
}

function today(){ return new Date().toISOString().slice(0, 10); }

/* Group the cells into meetings. Two cells belong together when they are
   the same course on the same day, in the same room, over the same weeks,
   and their blocks are adjacent. */
function mergeBlocks(cells){
  const groups = new Map();
  cells.forEach(c=>{
    const key = [c.number, c.seq, c.day, c.room, c.weeks].join("|");
    if(!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  });

  const meetings = [];
  groups.forEach(list=>{
    list.sort((a, b)=>a.block - b.block);
    let run = [list[0]];
    for(let i = 1; i < list.length; i++){
      if(list[i].block === run[run.length-1].block + 1) run.push(list[i]);
      else { meetings.push(meetingFrom(run)); run = [list[i]]; }
    }
    meetings.push(meetingFrom(run));
  });

  // Stable, human order: by weekday, then by start time, then by title.
  return meetings.sort((a, b)=>
    a.day - b.day ||
    a.blocks[0] - b.blocks[0] ||
    (a.titleEn || "").localeCompare(b.titleEn || ""));
}

function meetingFrom(run){
  const first = run[0], last = run[run.length-1];
  const bStart = BLOCKS.find(b=>b.n === first.block);
  const bEnd = BLOCKS.find(b=>b.n === last.block);
  const meeting = {
    number: first.number, seq: first.seq, titleEn: first.titleEn,
    day: first.day,
    blocks: run.map(c=>c.block),
    start: bStart ? bStart.start : "",
    end: bEnd ? bEnd.end : "",
    room: first.room,
    weeks: first.weeks, weeksRaw: first.weeksRaw,
    detailUrl: first.detailUrl,
  };
  if(run.length === 1) meeting.block = first.block;   // a plain block keeps its number
  else meeting.merged = true;                          // spans blocks -> custom time, end may be too late
  return meeting;
}

/* ============================================================
   The course detail page (Phase 3).

   Reached ONLY as a link from the timetable -- every meeting carries the
   URL the portal itself put there, so nothing is ever constructed.

   The page is a label/value table: "Course number | 70511131 | Course
   sequence | 1", "Credit hours | 16", two long description cells, and so
   on (see _Archive/Schedule-Info-Portal/click-details.png). We only have a
   screenshot of it, not a markup dump, so this reads by LABEL rather than
   by position or class: find the cell whose text is the label, take the
   next cell. That survives most table shapes, and anything it cannot find
   simply stays empty -- a missing description must never cost you a course.
   ============================================================ */
/* The Chinese labels are \uXXXX escapes on purpose: this file is injected
   into the portal's gb2312 page and must stay pure ASCII (see the note in
   tools/portal-schedule-scrape.js). They are fallbacks in case a portal
   account is set to Chinese; the English ones are what we have seen. */
const DETAIL_FIELDS = [
  ["creditHours",    ["Credit hours", "\u5b66\u65f6"]],
  ["credits",        ["Credit", "\u5b66\u5206"]],
  ["testing",        ["Testing methods", "Examination", "\u8003\u6838\u65b9\u5f0f"]],
  ["textbooks",      ["Textbooks", "Textbook", "\u6559\u6750"]],
  ["references",     ["Reference books", "\u53c2\u8003\u4e66"]],
  ["descriptionEn",  ["English description", "English Description"]],
  ["descriptionCn",  ["Chinese description", "\u8bfe\u7a0b\u7b80\u4ecb"]],
  ["features",       ["Course features", "\u8bfe\u7a0b\u7279\u6027"]],
  ["instructor",     ["Instructor name", "Instructor", "\u4efb\u8bfe\u6559\u5e08"]],
  ["dept",           ["Course department/school/college", "Course department", "\u5f00\u8bfe\u5355\u4f4d"]],
  ["titleEn",        ["Course title", "\u8bfe\u7a0b\u540d"]],
  ["number",         ["Course number", "\u8bfe\u7a0b\u53f7"]],
  ["seq",            ["Course sequence", "\u8bfe\u5e8f\u53f7"]],
];

function parseCourseDetail(doc){
  const cells = [...doc.querySelectorAll("td, th")];
  if(!cells.length) throw new Error("This does not look like a course detail page.");

  const out = {};
  DETAIL_FIELDS.forEach(([key, labels])=>{
    const v = valueForLabel(cells, labels);
    if(v) out[key] = v;
  });
  if(!out.titleEn && !out.number && !out.descriptionEn && !out.descriptionCn){
    throw new Error("No course information found on that page.");
  }
  if(out.creditHours) out.creditHours = parseFloat(out.creditHours) || out.creditHours;
  if(out.credits) out.credits = parseFloat(out.credits) || 0;
  out.fetchedAt = today();
  return out;
}

/* The value cell is the next one that is not itself a label -- the page
   lays out two label/value pairs per row. */
function valueForLabel(cells, labels){
  const wanted = labels.map(l=>normLabel(l));
  for(let i = 0; i < cells.length; i++){
    if(wanted.indexOf(normLabel(cellText(cells[i]))) < 0) continue;
    const next = cells[i+1];
    if(!next) continue;
    const v = cellText(next);
    // An empty field in the portal is an empty cell, not a missing one.
    if(isLabelLike(v, cells)) return "";
    return v;
  }
  return "";
}
function cellText(td){ return (td.textContent || "").replace(/\s+/g, " ").trim(); }
function normLabel(s){ return String(s || "").replace(/\s+/g, " ").replace(/[:\uff1a\s]+$/, "").trim().toLowerCase(); }
function isLabelLike(text, cells){
  const n = normLabel(text);
  if(!n) return false;
  return DETAIL_FIELDS.some(([, labels])=>labels.some(l=>normLabel(l) === n));
}
