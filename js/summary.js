"use strict";

/* ============================================================
   Credit counters: header total, toggle counts, list summary
   ============================================================ */
function statTotals(){
  const t = {};
  STATUS.forEach(s=>{
    const list = state.courses.filter(c=>c.status===s.id);
    t[s.id] = {n:list.length, cp:list.reduce((a,c)=>a+(parseFloat(c.credits)||0),0)};
  });
  return t;
}

function renderCredits(){
  const t = statTotals();
  $("#hsMain").textContent = t.booked.cp+" CP";
  const pending = t.bid.cp + t.option.cp;
  $("#hsSub").textContent = "booked · " + t.booked.n + (t.booked.n===1?" course":" courses")
    + (pending ? "  ·  "+pending+" CP pending" : "");

  const sum = $("#summaryRow");
  if(sum){
    sum.innerHTML = STATUS.map(s=>
      '<span><span class="dot '+s.id+'"></span>'+s.label+' <b>'+t[s.id].cp+' CP</b> ('+t[s.id].n+')</span>'
    ).join("");
  }
  renderFilters();
}

function renderFilters(){
  const host = $("#statusFilters");
  if(!host) return;
  const t = statTotals();
  host.innerHTML = "";
  STATUS.forEach(s=>{
    const b = el("button","tog");
    b.setAttribute("aria-pressed", state.visible[s.id] ? "true" : "false");
    b.setAttribute("title", (state.visible[s.id]?"Hide ":"Show ")+s.label.toLowerCase()+" courses on the calendar");
    b.innerHTML = '<span class="dot '+s.id+'"></span>'+s.label
                + '<span class="cnt">'+t[s.id].n+' · '+t[s.id].cp+' CP</span>';
    b.addEventListener("click", ()=>{
      state.visible[s.id] = !state.visible[s.id];
      save(); renderFilters(); renderGrid();
    });
    host.appendChild(b);
  });
}
