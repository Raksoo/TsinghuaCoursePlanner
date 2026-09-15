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
  const ul = $("#blockLegend");
  ul.innerHTML = "";
  BLOCKS.forEach(b=>{ ul.appendChild(el("li", null, "Block "+b.n+": "+b.start+"–"+b.end)); });
  ul.appendChild(el("li", null, "Block code 4-2 means Thursday, block 2 — first digit is the weekday (1 = Monday), second digit the block."));
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
