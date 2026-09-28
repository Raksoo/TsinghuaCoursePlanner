/* The room only matters if it reaches the calendar: LOCATION is what makes
   "time to leave" work on a phone. A course can change room between its
   meetings, so the slot's own room has to win over the course's. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { parseHTML, DOMParser } from "linkedom";
import { repoRoot } from "./harness.mjs";

function loadIcs(courses){
  const { window, document } = parseHTML("<!doctype html><html><body><div id='toastHost'></div></body></html>");
  const sandbox = {
    window, document, DOMParser, console,
    setTimeout, clearTimeout, Date, Math, JSON, RegExp, Intl,
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    fetch: async () => { throw new Error("no network in tests"); },
  };
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  for(const name of ["core", "calendar", "icsExport"]){
    vm.runInContext(readFileSync(join(repoRoot, "js", name + ".js"), "utf8"), ctx, { filename: name });
  }
  vm.runInContext("state.courses = " + JSON.stringify(courses) + "; state.overrides = {};", ctx);
  return ctx;
}

/* buildICS takes a Set (which does not survive JSON) and returns
   {text, count, …} — so build the options and read .text inside the vm,
   and only carry a plain string across the boundary. */
function icsFor(ctx, ids){
  return String(vm.runInContext(
    "buildICS({ courseIds: new Set(" + JSON.stringify(ids) + "), weekFrom:1, weekTo:2," +
    " skipHolidays:false, seq:1, travelMin:0, alarmMin:0 }).text", ctx) || "");
}

test("a slot's own room becomes the event LOCATION", () => {
  const ctx = loadIcs([{
    id: "c1", titleEn: "Two rooms", number: "1", seq: "0", credits: 2, status: "booked",
    weeks: "1-2", room: "Course-level room",
    slots: [
      { day: 1, start: "08:00", end: "09:35", block: 1, room: "建华/经管新楼A201" },
      { day: 3, start: "13:30", end: "15:05", block: 3, room: "六教6A216" },
    ],
  }]);
  const ics = icsFor(ctx, ["c1"]);
  const locations = [...new Set(ics.match(/LOCATION:[^\r\n]*/g) || [])];
  assert.ok(locations.includes("LOCATION:建华/经管新楼A201"), "Monday's room");
  assert.ok(locations.includes("LOCATION:六教6A216"), "Wednesday's room");
  assert.ok(!locations.some(l => l.includes("Course-level room")), "the slot wins when it has one");
});

test("a slot without its own room falls back to the course's", () => {
  const ctx = loadIcs([{
    id: "c2", titleEn: "One room", number: "2", seq: "0", credits: 2, status: "booked",
    weeks: "1-2", room: "Rm. A201, Jianhua Bldg.",
    slots: [{ day: 2, start: "08:00", end: "09:35", block: 1 }],
  }]);
  const ics = icsFor(ctx, ["c2"]);
  assert.match(ics, /LOCATION:Rm\. A201\\, Jianhua Bldg\./, "and commas stay escaped");
});
