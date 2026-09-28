/* Export → import is the backup path: a plan carried from the laptop to the
   desktop, or restored after a browser reset. Whatever the export writes,
   the import has to read back — otherwise settings are silently lost and
   only noticed weeks later. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { parseHTML, DOMParser } from "linkedom";
import { repoRoot } from "./harness.mjs";

/* A FileReader that hands the text straight back — dataShare reads the
   uploaded file through one, and linkedom does not provide it. */
function loadShare(){
  const { window, document } = parseHTML("<!doctype html><html><body><div id='toastHost'></div></body></html>");
  const sandbox = {
    window, document, DOMParser, console,
    setTimeout, clearTimeout, Date, Math, JSON, RegExp, Intl,
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    fetch: async () => { throw new Error("no network in tests"); },
    confirm: () => true,
    alert: msg => { throw new Error("import refused the file: " + msg); },
    renderAll: () => {},
    renderWeekSelect: () => {},
    FileReader: class { readAsText(file){ this.result = file.text; this.onload(); } },
  };
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  for(const name of ["core", "history", "dataShare"]){
    vm.runInContext(readFileSync(join(repoRoot, "js", name + ".js"), "utf8"), ctx, { filename: name });
  }
  return ctx;
}

/* Objects built inside the vm carry that realm's prototypes, which
   deepEqual refuses to match — read them back as JSON. */
function read(ctx, expr){ return JSON.parse(vm.runInContext("JSON.stringify(" + expr + ")", ctx)); }

const EXPORTED = {
  courses: [{
    id: "cat-80517022", titleEn: "Technology and Strategy", number: "80517022", seq: "1",
    credits: 2, status: "booked", weeks: "1-3,5",
    slots: [{ day: 2, start: "09:50", end: "12:15", block: 2 }]
  }],
  visible: { booked: true, bid: true, option: true, out: false },
  week: 3,
  goal: 20,
  overrides: { "cat-80517022|0|2": { movedTo: "2026-09-26", start: "09:50", end: "12:15", note: "" } },
  icsSeq: 3
};

function importInto(ctx, payload){
  vm.runInContext("importJSONFile({ text: " + JSON.stringify(JSON.stringify(payload, null, 2)) + " })", ctx);
  return read(ctx, "({ goal: state.goal, icsSeq: state.icsSeq, courses: state.courses.length," +
    " id: state.courses[0].id, overrides: Object.keys(state.overrides||{}).length })");
}

test("importing the app's own export restores the credit goal", () => {
  const ctx = loadShare();
  const after = importInto(ctx, EXPORTED);
  assert.equal(after.goal, 20, "the credit goal came back with the plan");
});

test("importing restores the export counter, so the next .ics still updates events", () => {
  const ctx = loadShare();
  assert.equal(importInto(ctx, EXPORTED).icsSeq, 3);
});

test("importing keeps course ids and moved meetings", () => {
  const ctx = loadShare();
  const after = importInto(ctx, EXPORTED);
  assert.equal(after.courses, 1);
  assert.equal(after.id, "cat-80517022", "the id has to survive, or the overrides no longer match");
  assert.equal(after.overrides, 1);
});

test("a plain course array (an older export) still imports", () => {
  const ctx = loadShare();
  vm.runInContext("importJSONFile({ text: " + JSON.stringify(JSON.stringify(EXPORTED.courses)) + " })", ctx);
  assert.equal(vm.runInContext("state.courses.length", ctx), 1);
});

/* The reset dialog promises it in so many words: "Courses can be brought
   back with Undo". The credit goal is set once and then forgotten about —
   nobody notices for weeks that it came back as 0. */
test("undo after a reset brings back the credit goal and the filters", () => {
  const ctx = loadShare();
  importInto(ctx, EXPORTED);                       // goal 20, "Dropped" hidden
  vm.runInContext("state.visible.out = true;", ctx);
  const before = read(ctx, "({goal: state.goal, out: state.visible.out, n: state.courses.length})");
  assert.deepEqual(before, { goal: 20, out: true, n: 1 });

  vm.runInContext("resetEverything()", ctx);
  assert.equal(vm.runInContext("state.courses.length", ctx), 0, "reset clears the plan");

  vm.runInContext("undo()", ctx);
  const after = read(ctx, "({goal: state.goal, out: state.visible.out, n: state.courses.length})");
  assert.deepEqual(after, before, "undo restores the plan and the settings it cleared");
});

/* …but an undo of an ordinary course change must not drag view settings
   back with it: the student changes a filter after adding a course, and
   undoing the course should not un-change the filter. */
test("undo of a course change leaves the filters alone", () => {
  const ctx = loadShare();
  importInto(ctx, EXPORTED);
  vm.runInContext("commit('add', {courses: state.courses.concat([{id:'x', titleEn:'X', credits:1, status:'option', weeks:'1-16', slots:[]}])});", ctx);
  vm.runInContext("state.goal = 25; state.visible.out = true;", ctx);
  vm.runInContext("undo()", ctx);
  assert.deepEqual(read(ctx, "({goal: state.goal, out: state.visible.out, n: state.courses.length})"),
    { goal: 25, out: true, n: 1 }, "only the course came back");
});
