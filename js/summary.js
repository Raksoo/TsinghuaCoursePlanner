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
  renderGoal(t);
  renderFilters();
}

/* Credit-goal mini progress bar in the header */
function renderGoal(t){
  const wrap = $("#goalWrap"); if(!wrap) return;
  t = t || statTotals();
  const booked = t.booked.cp, pending = t.bid.cp + t.option.cp;
  const goal = state.goal || 0;
  const input = $("#goalInput");
  if(input && document.activeElement !== input) input.value = goal ? goal : "";
  const bar = $("#goalBar"), cap = $("#goalCap");
  if(goal > 0){
    bar.style.display = "";
    $("#goalBooked").style.width  = Math.min(100, booked/goal*100) + "%";
    $("#goalPending").style.width = Math.min(100, (booked+pending)/goal*100) + "%";
    const remaining = Math.max(0, goal - booked);
    cap.textContent = booked + " / " + goal + " CP" + (remaining > 0 ? " · " + (+remaining.toFixed(1)) + " to go" : " · reached ✓");
  } else {
    bar.style.display = "none";
    cap.textContent = "Credit goal:";
  }
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
