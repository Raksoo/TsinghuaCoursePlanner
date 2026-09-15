"use strict";

/* ============================================================
   Dedicated print layout (feature: printing was cutting off days
   on the right and slicing events in half across page breaks,
   because it reused the absolutely-positioned screen grid).

   This builds a completely separate, print-only sheet using
   normal document flow (one column per day, events stacked top
   to bottom in order) so the browser's page-break logic has real
   boxes to work with instead of an absolute-position canvas.
   ============================================================ */
function renderPrintSheet(){
  const host = $("#printSheet");
  if(!host) return;
  host.innerHTML = "";
  const week = state.week;

  const events = [];
  state.courses.filter(isVisible).forEach(c=>{
    if(week !== "all" && !parseWeeks(c.weeks).includes(week)) return;
    courseEvents(c).forEach(ev=>events.push(ev));
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

  const grid = el("div","print-grid");
  grid.style.gridTemplateColumns = "repeat("+maxDay+", 1fr)";

  for(let d=1; d<=maxDay; d++){
    const col = el("div","print-col");
    const dh = el("div","print-daytitle");
    dh.appendChild(document.createTextNode(DAYS[d-1]));
    dh.appendChild(el("small", null, week==="all" ? "all weeks" : dayDate(week,d)));
    col.appendChild(dh);

    const dayEv = events.filter(ev=>ev.day===d).sort((a,b)=>a.s-b.s || a.e-b.e);
    if(!dayEv.length){
      col.appendChild(el("div","print-empty","No classes"));
    } else {
      dayEv.forEach(ev=>{
        const c = ev.course;
        const card = el("div","print-card "+c.status);
        card.appendChild(el("div","print-time", ev.start+"–"+ev.end + (ev.block?" · Block "+ev.block:"")));
        card.appendChild(el("div","print-title", c.titleEn || c.titleCn));
        const meta = [c.instructor, c.room].filter(Boolean).join(" · ");
        if(meta) card.appendChild(el("div","print-meta", meta));
        card.appendChild(el("div","print-meta", (c.credits||0)+" CP · "+statusLabel(c.status)));
        col.appendChild(card);
      });
    }
    grid.appendChild(col);
  }
  host.appendChild(grid);
  host.appendChild(el("div","print-foot", "Generated "+new Date().toLocaleString()));
}
