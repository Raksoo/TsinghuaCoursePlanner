"use strict";

/* ============================================================
   Data & sharing tab
   ============================================================ */
function renderStorageNote(){
  const host = $("#storageNote");
  host.innerHTML = "";
  const n = el("div", storageOK ? "note ok" : "note warn");
  n.innerHTML = storageOK
    ? "<h3>Saved automatically</h3>Changes stay in this browser, including after you close it."
    : "<h3>This browser cannot save locally</h3>Local storage is blocked for files opened from disk, so your courses are lost on reload. Export them as JSON first, or open the file in Firefox or Safari.";
  host.appendChild(n);
}

function renderLegend(){
  const host = $("#scheduleTable");
  if(!host) return;
  host.innerHTML = "";

  const tbl = el("table","schedule-table");
  const thead = el("thead");
  thead.innerHTML = "<tr><th>Period</th><th>Block · 大节</th><th>Section · 小节</th><th>Time</th></tr>";
  tbl.appendChild(thead);

  const tb = el("tbody");
  CLASS_SCHEDULE.forEach(period=>{
    const periodRows = period.blocks.reduce((s,b)=>s+b.subs.length, 0);
    let periodPlaced = false;
    period.blocks.forEach(block=>{
      block.subs.forEach((sub,si)=>{
        const tr = el("tr");
        if(si===0) tr.classList.add("block-start");
        if(!periodPlaced){
          const tdP = el("td","sch-period");
          tdP.rowSpan = periodRows;
          tdP.innerHTML = "<b>"+period.period+"</b><span>"+period.cn+"</span>";
          tr.appendChild(tdP);
          periodPlaced = true;
        }
        if(si===0){
          const tdB = el("td","sch-block");
          tdB.rowSpan = block.subs.length;
          tdB.innerHTML = "<b>Block "+block.n+"</b><span>"+block.cn+"</span>";
          tr.appendChild(tdB);
        }
        tr.appendChild(el("td","sch-sub", "#"+sub.n));
        tr.appendChild(el("td","sch-time num", sub.t));
        tb.appendChild(tr);
      });
    });
  });
  tbl.appendChild(tb);
  host.appendChild(tbl);

  const hint = $("#blockCodeHint");
  if(hint){
    hint.innerHTML = "A block code like <code class=\"k\">4-2</code> means <b>Thursday, Block 2</b> — the "
      + "first digit is the weekday (1 = Monday), the second the block above. A course may run across several "
      + "blocks (e.g. 08:00–11:25 covers blocks 1–2).";
  }
}

function downloadJSON(name, text){
  const blob = new Blob([text], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

function exportJSON(){
  downloadJSON("tsinghua-courses-"+new Date().toISOString().slice(0,10)+".json", JSON.stringify(state, null, 2));
  toast("File exported");
}

function importJSONFile(file){
  const r = new FileReader();
  r.onload = () => {
    try{
      const p = JSON.parse(r.result);
      const list = Array.isArray(p) ? p : p.courses;
      if(!Array.isArray(list)) throw new Error("no course array");
      if(confirm("Importing replaces your current list ("+state.courses.length+" courses). Continue?")){
        state.courses = list.map(c=>Object.assign({id:uid(), status:"option", slots:[], weeks:"1-16"}, c));
        if(p.visible) state.visible = Object.assign(state.visible, p.visible);
        save(); renderAll(); toast(state.courses.length+" courses imported");
      }
    }catch(err){ alert("This file cannot be read: "+err.message); }
  };
  r.readAsText(file);
}

function resetToStartingCourses(){
  if(confirm("Replace all courses with the four starting courses?")){
    state.courses = seedCourses(); save(); renderAll(); toast("Reset done");
  }
}
