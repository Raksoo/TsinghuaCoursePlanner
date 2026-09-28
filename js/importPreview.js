"use strict";

/* ============================================================
   The import preview: what would change, before anything does.

   Split out of js/portalImport.js, which handles getting the data
   here; this file only renders the three outcomes of a timetable
   import (new / differs / not registered), tracks what is ticked,
   and applies the selection through commit() so it is undoable.

   Rule of the house: nothing is written without this preview.
   ============================================================ */

/* The three outcomes of a timetable import, each with its own checkboxes.
   Everything is pre-ticked except the downgrades — taking something away
   should be a deliberate click. */
function renderScheduleDiff(host, p){
  const d = p.diff;
  const total = d.added.length + d.changed.length + d.missing.length;
  if(!total){
    const n = el("div","note ok");
    n.appendChild(el("h3", null, "Your plan already matches the portal"));
    n.appendChild(document.createTextNode(
      p.schedule.meetings.length + " meetings read, nothing to change."));
    host.appendChild(n);
    return;
  }

  if(d.added.length){
    const sec = diffSection("New in the portal", d.added.length + " course" + (d.added.length===1?"":"s") +
      " you are registered for but do not have in your plan.");
    d.added.forEach(c=>{
      sec.appendChild(diffRow({
        checked: true,
        onToggle: v=>{ p.sel.added[c.catalogRef.key] = v; updateImportButton(p); },
        title: c.titleEn,
        facts: courseFacts(c),
      }));
    });
    host.appendChild(sec);
  }

  if(d.changed.length){
    const sec = diffSection("Differs from your plan",
      "Tick what you want to take over from the portal.");
    d.changed.forEach(ch=>{
      const box = el("div","diff-course");
      const head = el("div","diff-course-head");
      head.appendChild(el("b", null, ch.course.titleEn || ch.course.titleCn));
      box.appendChild(head);
      ch.fields.forEach(f=>{
        box.appendChild(diffRow({
          checked: true,
          onToggle: v=>{ p.sel.changed[ch.key][f.field] = v; updateImportButton(p); },
          title: f.label,
          compare: { mine: f.mine, portal: f.portal },
          indent: true,
        }));
      });
      sec.appendChild(box);
    });
    host.appendChild(sec);
  }

  if(d.missing.length){
    const sec = diffSection("Not registered in the portal",
      "These are Booked or Bid in your plan, but the portal does not list them. " +
      "Nothing is deleted — you can set them back to Option.", true);
    d.missing.forEach(m=>{
      sec.appendChild(diffRow({
        checked: false,
        onToggle: v=>{ p.sel.missing[m.course.id] = v; updateImportButton(p); },
        title: m.course.titleEn || m.course.titleCn,
        sub: "Currently " + statusLabel(m.course.status) + " — set to Option",
      }));
    });
    host.appendChild(sec);
  }

  const b = el("button","btn"); b.type = "button"; b.id = "portalApplyBtn";
  b.addEventListener("click", applyScheduleImport);
  setPortalAction(b);
  updateImportButton(p);
  scrollToFindings();
}

/* After a hand-off the dialog opens on step 1, which the user has just
   done — the answer is further down. Put it in front of them. */
function scrollToFindings(){
  const host = $("#portalPending"); if(!host) return;
  requestAnimationFrame(()=>{
    const modal = host.closest(".modal");
    if(modal) modal.scrollTop = host.offsetTop - 12;
  });
}

function diffSection(title, hint, warn){
  const sec = el("div","diff-section" + (warn ? " warn" : ""));
  sec.appendChild(el("h4", null, title));
  if(hint) sec.appendChild(el("p","hint", hint));
  return sec;
}

function diffRow(o){
  const row = el("label","diff-row" + (o.indent ? " indent" : ""));
  const cb = document.createElement("input");
  cb.type = "checkbox"; cb.checked = !!o.checked;
  cb.addEventListener("change", ()=>o.onToggle(cb.checked));
  row.appendChild(cb);
  const body = el("div","diff-body");
  body.appendChild(el("span","diff-title", o.title));
  if(o.sub) body.appendChild(el("span","diff-sub", o.sub));
  if(o.facts) body.appendChild(o.facts);
  if(o.compare){
    const cmp = el("span","diff-compare");
    cmp.appendChild(el("s","diff-mine", o.compare.mine || "(empty)"));
    cmp.appendChild(el("span","diff-arrow", " \u2192 "));
    cmp.appendChild(el("b","diff-portal", o.compare.portal || "(empty)"));
    body.appendChild(cmp);
  }
  row.appendChild(body);
  return row;
}

/* A course line is scanned, not read: one meeting per row, and within a row
   time / room / weeks as separate chunks rather than a middot chain. */
function courseFacts(c){
  const box = el("div","fact-lines");
  const slots = c.slots || [];
  slots.forEach((s, i)=>{
    const line = el("div","fact-line");
    line.appendChild(el("span","fact-when", DAYS_SHORT[s.day-1] + " " + s.start + "\u2013" + s.end));
    if(s.room || c.room) line.appendChild(el("span","fact-room", s.room || c.room));
    const wk = s.weeks || c.weeks;
    if(wk) line.appendChild(el("span","fact-weeks", "wk " + wk));
    // Credits and instructor describe the course, not one meeting: they ride
    // along on the first line rather than claiming a row of their own.
    if(i === 0){
      if(c.credits) line.appendChild(el("span","fact-cp", c.credits + " CP"));
      if(c.instructor) line.appendChild(el("span","fact-who", c.instructor));
    }
    box.appendChild(line);
  });
  if(!slots.length && c.credits){
    const line = el("div","fact-line");
    line.appendChild(el("span","fact-cp", c.credits + " CP"));
    if(c.instructor) line.appendChild(el("span","fact-who", c.instructor));
    box.appendChild(line);
  }
  return box;
}

function countSelected(p){
  let n = 0;
  Object.values(p.sel.added).forEach(v=>{ if(v) n++; });
  Object.values(p.sel.changed).forEach(f=>Object.values(f).forEach(v=>{ if(v) n++; }));
  Object.values(p.sel.missing).forEach(v=>{ if(v) n++; });
  return n;
}
function updateImportButton(p){
  const b = $("#portalApplyBtn"); if(!b) return;
  const n = countSelected(p);
  b.textContent = n ? "Apply " + n + " change" + (n===1?"":"s") : "Nothing selected";
  b.disabled = !n;
}

function applyScheduleImport(){
  const p = portalImportPending;
  if(!p || p.what !== "schedule") return;
  const next = applyScheduleDiff(state.courses, p.diff, p.sel);
  const n = countSelected(p);
  commit("Import portal timetable", { courses: next });
  closePortalImport();
  showPanel("week");
  toastUndo(n + " change" + (n===1?"":"s") + " from the portal applied");
}

