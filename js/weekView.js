"use strict";

/* ============================================================
   Meetings and clashes
   ============================================================ */
function courseEvents(c){
  return (c.slots||[]).map((s, idx)=>({
    course:c, idx, day:+s.day, s:toMin(s.start), e:toMin(s.end), start:s.start, end:s.end, block:s.block
  }));
}
function isVisible(c){ return !!state.visible[c.status]; }

function findClashes(){
  const list = state.courses.filter(isVisible);
  const res = [];
  for(let i=0;i<list.length;i++){
    for(let j=i+1;j<list.length;j++){
      const A=list[i], B=list[j];
      const wA=new Set(parseWeeks(A.weeks)), wB=parseWeeks(B.weeks);
      const shared = wB.filter(w=>wA.has(w));
      if(!shared.length) continue;
      const evA=courseEvents(A), evB=courseEvents(B);
      for(const a of evA) for(const b of evB){
        if(a.day===b.day && a.s < b.e && b.s < a.e){
          res.push({a:A, b:B, day:a.day, weeks:shared,
                    range: fmtMin(Math.max(a.s,b.s))+"–"+fmtMin(Math.min(a.e,b.e))});
        }
      }
    }
  }
  return res;
}

/* ============================================================
   Week grid
   ============================================================ */
function renderGrid(){
  const grid = $("#grid");
  grid.innerHTML = "";
  const week = state.week;

  const events = [];
  state.courses.filter(isVisible).forEach(c=>{
    if(week !== "all" && !parseWeeks(c.weeks).includes(week)) return;
    courseEvents(c).forEach(ev=>events.push(ev));
  });

  let maxDay = 5;
  events.forEach(ev=>{ if(ev.day>maxDay) maxDay = ev.day; });
  const days = [];
  for(let d=1; d<=maxDay; d++) days.push(d);

  let minM = toMin(BLOCKS[0].start), maxM = toMin(BLOCKS[BLOCKS.length-1].end);
  events.forEach(ev=>{ minM = Math.min(minM, ev.s-10); maxM = Math.max(maxM, ev.e+10); });
  const PPM = 0.95;
  const height = (maxM - minM) * PPM;

  // Long gaps between blocks (kept to scale, labelled) — lunch / dinner.
  const BREAKS = [];
  for(let i=0;i<BLOCKS.length-1;i++){
    const gs = toMin(BLOCKS[i].end), ge = toMin(BLOCKS[i+1].start);
    if(ge-gs >= 30) BREAKS.push({ start:gs, end:ge, label: gs < toMin("14:00") ? "Lunch break" : "Dinner break" });
  }

  grid.style.gridTemplateColumns = "78px repeat("+days.length+", minmax(130px,1fr))";

  grid.appendChild(el("div","gutterhead"));
  days.forEach(d=>{
    const hol = holidayOn(week, d);
    const h = el("div","dayhead"+(hol?" holiday":""));
    h.appendChild(document.createTextNode(DAYS[d-1]));
    h.appendChild(el("small", null, week==="all" ? "all weeks" : dayDate(week,d)+(hol ? " · "+hol : "")));
    if(hol) h.title = hol+" — no classes";
    grid.appendChild(h);
  });

  const gutter = el("div","gutter");
  gutter.style.height = height+"px";
  BLOCKS.forEach(b=>{
    const top = (toMin(b.start)-minM)*PPM;
    const lab = el("div","blocklabel");
    lab.style.top = top+"px";
    lab.appendChild(el("b", null, "Block "+b.n));
    lab.appendChild(document.createTextNode(b.start+"–"+b.end));
    gutter.appendChild(lab);
  });
  BREAKS.forEach(br=>{
    const lab = el("div","brk-label", br.label);
    lab.style.top = ((br.start-minM)*PPM)+"px";
    lab.style.height = ((br.end-br.start)*PPM)+"px";
    gutter.appendChild(lab);
  });
  grid.appendChild(gutter);

  const clashes = week==="all" ? findClashes() : findClashes().filter(c=>c.weeks.includes(week));
  const clashIds = new Set();
  clashes.forEach(c=>{ clashIds.add(c.a.id); clashIds.add(c.b.id); });

  days.forEach((d,di)=>{
    const hol = holidayOn(week, d);
    const col = el("div","daycol"+(hol?" holiday":""));
    col.style.height = height+"px";

    // Each block band covers only its own time span (not the gap after it).
    BLOCKS.forEach((b,i)=>{
      const band = el("div","band"+(i%2?" alt":""));
      band.style.top = ((toMin(b.start)-minM)*PPM)+"px";
      band.style.height = ((toMin(b.end)-toMin(b.start))*PPM)+"px";
      col.appendChild(band);
    });
    // Long breaks, hatched, with a small white margin off the blocks above/below.
    const BRK_INSET = 6;
    BREAKS.forEach(br=>{
      const bd = el("div","brk");
      bd.style.top = ((br.start-minM)*PPM + BRK_INSET)+"px";
      bd.style.height = Math.max((br.end-br.start)*PPM - BRK_INSET*2, 6)+"px";
      col.appendChild(bd);
    });
    // Holiday: hatched overlay above the bands, below the events (no classes).
    if(hol){
      const ovl = el("div","holiday-overlay");
      ovl.style.height = height+"px";
      col.appendChild(ovl);
    }
    const dayEv = events.filter(ev=>ev.day===d).sort((a,b)=>a.s-b.s || a.e-b.e);
    // Greedy column assignment (a column is reused once its last event ends).
    const colEnds = [];
    dayEv.forEach(ev=>{
      let placed = false;
      for(let i=0;i<colEnds.length;i++){ if(colEnds[i] <= ev.s){ ev._col = i; colEnds[i] = ev.e; placed = true; break; } }
      if(!placed){ ev._col = colEnds.length; colEnds.push(ev.e); }
    });
    // Column count is per overlap-cluster, so a course that doesn't actually
    // overlap anything keeps the full day width even if other blocks are split.
    for(let i=0;i<dayEv.length;){
      let j=i, end=dayEv[i].e, maxCol=dayEv[i]._col;
      while(j+1<dayEv.length && dayEv[j+1].s < end){ j++; end=Math.max(end, dayEv[j].e); maxCol=Math.max(maxCol, dayEv[j]._col); }
      const ncol = maxCol+1;
      for(let k=i;k<=j;k++) dayEv[k]._ncol = ncol;
      i = j+1;
    }

    dayEv.forEach(ev=>{
      const c = ev.course;
      // Single meeting overrides (calendar.js): moved / cancelled / on a holiday.
      const ov = week==="all" ? null : overrideFor(c.id, ev.idx, week);
      const flag = ov ? (ov.movedTo ? " moved" : " cancelled") : (hol ? " on-holiday" : "");
      const node = el("div","ev "+c.status+flag+(clashIds.has(c.id)?" clash":""));
      const w = 100/ev._ncol;
      node.style.left = "calc("+(ev._col*w)+"% + 4px)";
      node.style.width = "calc("+w+"% - 8px)";
      node.style.top = ((ev.s-minM)*PPM)+"px";
      node.style.height = Math.max((ev.e-ev.s)*PPM - 4, 26)+"px";
      node.appendChild(el("span","t", c.titleEn || c.titleCn));
      node.appendChild(el("span","m", ev.start+"–"+ev.end));
      if(c.room) node.appendChild(el("span","m", c.room));
      node.appendChild(el("span","m", c.credits+" CP"));
      if(week==="all") node.appendChild(el("span","m wk", "Weeks "+(c.weeks||"—")));
      if(ov) node.appendChild(el("span","badge "+(ov.movedTo?"mv":"hol"), overrideBadge(ov)));
      else if(hol) node.appendChild(el("span","badge hol", "Holiday — no class"));
      // Tooltip: what a click does (the card already shows the details).
      let tip = "Click to edit this course";
      if(ov) tip = "This meeting: "+(ov.movedTo ? "moved to "+fmtISO(ov.movedTo)+(ov.start?" "+ov.start+"–"+ov.end:"") : "cancelled")+(ov.note?" — "+ov.note:"")+"\n"+tip;
      else if(hol) tip = hol+" — no classes\n"+tip;
      node.title = tip;
      node.tabIndex = 0;
      node.addEventListener("click", ()=>editCourse(c.id));
      node.addEventListener("keydown", e=>{ if(e.key==="Enter") editCourse(c.id); });
      if(week!=="all"){
        // "Move…" for this one meeting only — shown on hover/focus so the grid stays quiet.
        // Prominent only where a decision is pending (holiday / already moved); quiet elsewhere.
        const mv = el("button","ev-move"+((ov||hol) ? " attn" : ""), ov ? "Edit move" : "Move…");
        mv.type = "button";
        mv.title = "Move or cancel only this meeting (week "+week+")";
        mv.addEventListener("click", e=>{ e.stopPropagation(); openMoveModal(c.id, ev.idx, week); });
        node.appendChild(mv);
      }
      col.appendChild(node);
    });

    grid.appendChild(col);
  });

  if(!events.length){
    const emptyMsg = week==="all"
      ? "No course with an active status is scheduled. Change the filters or add courses."
      : "No course with an active status runs in week "+week+". Change the filters or add courses.";
    const empty = el("div","empty",emptyMsg);
    empty.style.gridColumn = "1 / -1";
    grid.appendChild(empty);
  }
  renderClashes();
  renderHolidayBox();
}

function renderClashes(){
  const box = $("#clashBox");
  box.innerHTML = "";
  const clashes = findClashes();
  if(!clashes.length){
    const n = el("div","note ok");
    n.innerHTML = "<h3>No clashes</h3>The courses shown work together across the whole semester.";
    box.appendChild(n);
    return;
  }
  const n = el("div","note warn");
  n.appendChild(el("h3", null, clashes.length===1 ? "1 clash" : clashes.length+" clashes"));
  const ul = el("ul");
  clashes.forEach(c=>{
    const li = el("li");
    const wk = c.weeks.length>3 ? ("weeks "+c.weeks[0]+"–"+c.weeks[c.weeks.length-1]) : ("week "+c.weeks.join(", "));
    li.textContent = (c.a.titleEn||c.a.titleCn)+" ↔ "+(c.b.titleEn||c.b.titleCn)+" · "+DAYS[c.day-1]+" "+c.range+" · "+wk;
    ul.appendChild(li);
  });
  n.appendChild(ul);
  box.appendChild(n);
}

function renderWeekSelect(){
  const sel = $("#weekSel");
  sel.innerHTML = "";
  // The dropdown lists only real weeks now; "all weeks · max load" is the toggle.
  const shownWeek = state.week === "all" ? currentSemesterWeek().week : state.week;
  for(let w=1; w<=TOTAL_WEEKS; w++){
    const o = el("option", null, "Week "+w+" · "+weekDates(w).label);
    o.value = w;
    if(w===shownWeek) o.selected = true;
    sel.appendChild(o);
  }
  syncViewControls();
}

/* Reflect the current view (single week vs. all-weeks max-load) in the toggle
   and show the week dropdown only in single-week mode. */
function syncViewControls(){
  const isAll = state.week === "all";
  document.querySelectorAll("#viewToggle .vt").forEach(b=>{
    b.setAttribute("aria-pressed", (b.dataset.view === (isAll ? "all" : "week")) ? "true" : "false");
  });
  const wf = $("#weekSelField");
  if(wf) wf.hidden = isAll;
}

/* ============================================================
   Current-week badge (fixed corner, feature: "show current week")
   ============================================================ */
function renderNowBadge(){
  const host = $("#nowBadge");
  if(!host) return;
  const info = currentSemesterWeek();
  host.classList.toggle("out-of-range", !info.inRange);
  host.innerHTML = "";
  host.appendChild(el("span","kw-dot"));
  let label;
  if(info.raw < 1) label = "Semester starts week 1";
  else if(info.raw > TOTAL_WEEKS) label = "Semester ended (week "+TOTAL_WEEKS+")";
  else label = "Now: Week "+info.week+" of "+TOTAL_WEEKS;
  host.appendChild(el("span","kw-main", label));
  const d = new Date();
  const dow = DAYS_SHORT[(d.getDay()+6)%7];   // Mon-indexed
  host.appendChild(el("span","kw-date", dow+", "+MONTHS[d.getMonth()]+" "+d.getDate()));
}
