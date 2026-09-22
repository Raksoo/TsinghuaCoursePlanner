"use strict";

/* ============================================================
   Undo / redo for the plan (feature: every change to the course
   list or to moved meetings can be taken back).

   Design: a snapshot stack, not a command log. The plan is small,
   so each history entry simply holds a deep copy of the plan
   (courses + overrides). Every mutation goes through commit(),
   which stores the *previous* plan and replaces state wholesale —
   nothing mutates state.courses in place any more.

   History lives in memory only: localStorage keeps exactly the
   same shape as before, so existing users are unaffected and a
   reload starts with an empty history.
   ============================================================ */
const HISTORY_MAX = 50;
const history_ = { undo: [], redo: [] };   // trailing underscore: window.history is taken

function clonePlan(){
  return JSON.parse(JSON.stringify({ courses: state.courses, overrides: state.overrides || {} }));
}
function applyPlan(plan){
  state.courses = plan.courses;
  state.overrides = plan.overrides || {};
}

/* Replace the plan. `next` holds the new courses and/or overrides (whatever
   is omitted stays as it is). opts.render=false skips the re-render — used
   during start-up, before the page has been drawn once. */
function commit(label, next, opts){
  history_.undo.push({ label, plan: clonePlan() });
  if(history_.undo.length > HISTORY_MAX) history_.undo.shift();
  history_.redo.length = 0;
  applyPlan({
    courses: next.courses !== undefined ? next.courses : state.courses,
    overrides: next.overrides !== undefined ? next.overrides : state.overrides
  });
  save();
  if(!opts || opts.render !== false) renderAll();
}

function undo(){
  const entry = history_.undo.pop();
  if(!entry) return false;
  history_.redo.push({ label: entry.label, plan: clonePlan() });
  applyPlan(entry.plan);
  save(); renderAll();
  toast("Undone: "+entry.label);
  return true;
}
function redo(){
  const entry = history_.redo.pop();
  if(!entry) return false;
  history_.undo.push({ label: entry.label, plan: clonePlan() });
  applyPlan(entry.plan);
  save(); renderAll();
  toast("Redone: "+entry.label);
  return true;
}
function canUndo(){ return history_.undo.length > 0; }
function canRedo(){ return history_.redo.length > 0; }

/* Toast with an Undo action — the standard confirmation after a commit(). */
function toastUndo(msg){ toast(msg, "Undo", undo); }

function renderUndoButtons(){
  const u = $("#undoBtn"), r = $("#redoBtn");
  if(!u || !r) return;
  const last = history_.undo[history_.undo.length-1];
  const next = history_.redo[history_.redo.length-1];
  u.disabled = !last;
  r.disabled = !next;
  u.title = last ? "Undo: "+last.label+" (⌘Z / Ctrl+Z)" : "Nothing to undo";
  r.title = next ? "Redo: "+next.label+" (⌘⇧Z / Ctrl+Y)" : "Nothing to redo";
}

/* ⌘Z / Ctrl+Z and ⌘⇧Z / Ctrl+Y — ignored while typing in a field or while a
   modal is open, so the browser's own text undo keeps working there. */
function historyKeyHandler(e){
  const key = (e.key||"").toLowerCase();
  const mod = e.metaKey || e.ctrlKey;
  if(!mod || (key!=="z" && key!=="y")) return;
  const t = e.target;
  if(t && (t.matches("input, textarea, select") || t.isContentEditable)) return;
  if(document.querySelector(".modal-overlay:not([hidden])")) return;
  e.preventDefault();
  if(key==="y" || (key==="z" && e.shiftKey)) redo(); else undo();
}
