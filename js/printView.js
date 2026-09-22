"use strict";

/* ============================================================
   Dedicated print layout (feature: printing was cutting off days
   on the right and slicing events in half across page breaks,
   because it reused the absolutely-positioned screen grid).

   This builds a completely separate, print-only sheet using normal
   document flow: a real timetable (time-axis grid, see
   renderPrintTimeGrid), bounded to a fixed, print-safe height so it
   can never straddle a page break. Both "Single week" and "All weeks
   · max load" use it — the overlap-column logic already needed for
   same-day clashes handles the max-load case too, so a second,
   separate list layout isn't needed.
   ============================================================ */

/* opts: {courseIds} */
function renderPrintSheet(opts){
  const host = $("#printSheet");
  if(!host) return;
  host.innerHTML = "";
  const week = state.week;
  const courseIds = (opts && opts.courseIds) || new Set(state.courses.filter(c=>c.status!=="out").map(c=>c.id));

  const events = [];
  state.courses.filter(c=>courseIds.has(c.id)).forEach(c=>{
    courseEvents(c).forEach(ev=>{ if(week==="all" || ev.weeks.includes(week)) events.push(ev); });
  });

  let maxDay = 5;
  events.forEach(ev=>{ if(ev.day>maxDay) maxDay = ev.day; });

  const head = el("div","print-head");
  head.appendChild(el("h1", null, "Tsinghua SEM Course Planner — Fall 2026"));
  const sub = week === "all" ? "All weeks · combined (max load)" : ("Week "+week+" · "+weekDates(week).label);
  head.appendChild(el("div","print-sub", sub));
  host.appendChild(head);

  const clashes = week==="all" ? findClashes() : findClashes().filter(c=>c.weeks.includes(week));
  if(clashes.length){
    const warn = el("div","print-warn");
    warn.appendChild(el("strong", null, (clashes.length===1?"1 clash: ":clashes.length+" clashes: ")));
    warn.appendChild(document.createTextNode(
      clashes.map(c=>(c.a.titleEn||c.a.titleCn)+" ↔ "+(c.b.titleEn||c.b.titleCn)).join("; ")
    ));
    host.appendChild(warn);
  }

  renderPrintTimeGrid(host, events, maxDay, week, clashes);

  if(!events.length){
    host.appendChild(el("div","print-empty","No classes match that selection."));
  }
  host.appendChild(el("div","print-foot", "Generated "+new Date().toLocaleString()));
}

/* Real timetable (time-axis grid) — used for both a single printed week
   and "All weeks · max load". Bounded to a fixed, print-safe pixel height
   (rather than a height derived from content, like the on-screen grid)
   so it always fits within one landscape page's content area and
   page-break-inside:avoid can push it whole onto the next page instead
   of ever slicing an event in half. See @page margin in styles.css.

   The gutter is a reserved left margin (GUTTER_W), not a grid column of
   its own — the day-head row and the day-column row both size their N
   day columns from the same "total width minus GUTTER_W" basis, so a
   column lines up exactly under its header. Hour gridlines/labels sit
   on the full clock hour (not the Tsinghua block boundaries, which are
   irregular and read as arbitrary) so the time axis reads like a normal
   timetable. */
function renderPrintTimeGrid(host, events, maxDay, week, clashes){
  const CANVAS_H = 560; // px — safe for A4/Letter landscape at the 12mm @page margin
  const GUTTER_W = 34;  // px

  let minM = toMin(BLOCKS[0].start), maxM = toMin(BLOCKS[BLOCKS.length-1].end);
  events.forEach(ev=>{ minM = Math.min(minM, ev.s-10); maxM = Math.max(maxM, ev.e+10); });
  const PPM = CANVAS_H / (maxM - minM);

  const BREAKS = [];
  for(let i=0;i<BLOCKS.length-1;i++){
    const gs = toMin(BLOCKS[i].end), ge = toMin(BLOCKS[i+1].start);
    if(ge-gs >= 30) BREAKS.push({ start:gs, end:ge });
  }

  const clashIds = new Set();
  (clashes||[]).forEach(c=>{ clashIds.add(c.a.id); clashIds.add(c.b.id); });

  const wrap = el("div","print-timegrid");

  const headrow = el("div","pt-headrow");
  headrow.style.paddingLeft = GUTTER_W+"px";
  headrow.style.gridTemplateColumns = "repeat("+maxDay+", 1fr)";
  for(let d=1; d<=maxDay; d++){
    const hol = holidayOn(week, d);
    const dh = el("div","pt-dayhead"+(hol?" holiday":""));
    dh.appendChild(document.createTextNode(DAYS_SHORT[d-1]));
    dh.appendChild(el("small", null, week==="all" ? "all weeks" : dayDate(week,d)+(hol ? " · "+hol : "")));
    headrow.appendChild(dh);
  }
  wrap.appendChild(headrow);

  const canvas = el("div","pt-canvas");
  canvas.style.height = CANVAS_H+"px";
  canvas.style.paddingLeft = GUTTER_W+"px";

  // Full-clock-hour gridlines + labels, spanning the whole time axis —
  // regular and predictable, unlike the Tsinghua blocks' own start times.
  for(let hm = Math.ceil(minM/60)*60; hm <= Math.floor(maxM/60)*60; hm += 60){
    const top = (hm-minM)*PPM;
    const lab = el("div","pt-hourlabel", fmtMin(hm));
    lab.style.top = top+"px";
    canvas.appendChild(lab);
    const line = el("div","pt-hourline");
    line.style.left = GUTTER_W+"px";
    line.style.top = top+"px";
    canvas.appendChild(line);
  }
  // The last hour tick rarely lands exactly on the canvas's true bottom edge
  // (maxM includes a few minutes' buffer past the last block/event, so it's
  // not a round hour) — close the grid off with an explicit boundary line
  // there, same as the top edge gets from the first hour tick.
  const closeLine = el("div","pt-hourline pt-hourline-end");
  closeLine.style.left = GUTTER_W+"px";
  closeLine.style.top = CANVAS_H+"px";
  canvas.appendChild(closeLine);

  const days = el("div","pt-days");
  days.style.left = GUTTER_W+"px";
  days.style.gridTemplateColumns = "repeat("+maxDay+", 1fr)";

  for(let d=1; d<=maxDay; d++){
    const hol = holidayOn(week, d);
    const col = el("div","pt-daycol"+(hol?" holiday":""));

    BLOCKS.forEach((b,i)=>{
      const band = el("div","pt-band"+(i%2?" alt":""));
      band.style.top = ((toMin(b.start)-minM)*PPM)+"px";
      band.style.height = ((toMin(b.end)-toMin(b.start))*PPM)+"px";
      col.appendChild(band);
    });
    BREAKS.forEach(br=>{
      const bd = el("div","pt-brk");
      bd.style.top = ((br.start-minM)*PPM)+"px";
      bd.style.height = Math.max((br.end-br.start)*PPM, 4)+"px";
      col.appendChild(bd);
    });

    const dayEv = events.filter(ev=>ev.day===d).sort((a,b)=>a.s-b.s || a.e-b.e);
    const colEnds = [];
    dayEv.forEach(ev=>{
      let placed = false;
      for(let i=0;i<colEnds.length;i++){ if(colEnds[i] <= ev.s){ ev._col = i; colEnds[i] = ev.e; placed = true; break; } }
      if(!placed){ ev._col = colEnds.length; colEnds.push(ev.e); }
    });
    for(let i=0;i<dayEv.length;){
      let j=i, end=dayEv[i].e, maxCol=dayEv[i]._col;
      while(j+1<dayEv.length && dayEv[j+1].s < end){ j++; end=Math.max(end, dayEv[j].e); maxCol=Math.max(maxCol, dayEv[j]._col); }
      const ncol = maxCol+1;
      for(let k=i;k<=j;k++) dayEv[k]._ncol = ncol;
      i = j+1;
    }

    dayEv.forEach(ev=>{
      const c = ev.course;
      const w = 100/ev._ncol;
      const ov = week==="all" ? null : overrideFor(c.id, ev.idx, week);
      const flag = ov ? (ov.movedTo ? " moved" : " cancelled") : (hol ? " on-holiday" : "");
      const card = el("div","pt-ev "+c.status+flag+(clashIds.has(c.id)?" clash":""));
      card.style.left = "calc("+(ev._col*w)+"% + 1px)";
      card.style.width = "calc("+w+"% - 2px)";
      card.style.top = ((ev.s-minM)*PPM)+"px";
      card.style.height = Math.max((ev.e-ev.s)*PPM - 2, 15)+"px";
      card.appendChild(el("span","pt-t", c.titleEn || c.titleCn));
      card.appendChild(el("span","pt-m", ev.start+"–"+ev.end));
      if(c.room) card.appendChild(el("span","pt-m", c.room));
      // In "All weeks", cards in the same slot rarely all run the same
      // weeks — without this it reads as if every course met simultaneously,
      // every week, instead of showing the semester's heaviest possible load.
      if(week==="all") card.appendChild(el("span","pt-m pt-wk", "Weeks "+(ev.weeksText||"—")));
      if(ov) card.appendChild(el("span","pt-m pt-flag", overrideBadge(ov)));
      else if(hol) card.appendChild(el("span","pt-m pt-flag", "Holiday — no class"));
      col.appendChild(card);
    });

    days.appendChild(col);
  }

  canvas.appendChild(days);
  wrap.appendChild(canvas);
  host.appendChild(wrap);
}

/* ============================================================
   Print/export settings modal (mirrors the .ics export modal)
   ============================================================ */
function openPrintModal(){
  const scope = $("#printModalScope");
  if(scope) scope.textContent = state.week === "all"
    ? "All weeks · combined (max load)"
    : ("Week "+state.week+" · "+weekDates(state.week).label);

  const host = $("#printCourseCheckboxes");
  host.innerHTML = "";
  const exportable = state.courses.filter(c => c.status !== "out"); // dropped courses are never printed
  if(!exportable.length){
    host.appendChild(el("div","ics-empty","No active courses to print — every course is dropped."));
  }
  exportable.forEach(c=>{
    const row = el("label","ics-course-row");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.dataset.id = c.id;
    cb.checked = true;
    row.appendChild(cb);
    row.appendChild(el("span",null, c.titleEn || c.titleCn || "(no title)"));
    row.appendChild(el("span","cn", statusLabel(c.status)));
    host.appendChild(row);
  });

  $("#printModalOverlay").hidden = false;
}
function closePrintModal(){ $("#printModalOverlay").hidden = true; }

function printModalSelectedIds(){
  return new Set(
    [...document.querySelectorAll("#printCourseCheckboxes input[type=checkbox]:checked")]
      .map(cb=>cb.dataset.id)
  );
}
