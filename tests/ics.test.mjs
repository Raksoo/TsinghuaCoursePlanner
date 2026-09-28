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

/* RFC 5545 folds at 75 *octets*, not characters. Rooms and Chinese titles
   from the portal are three bytes per character, so a line that looks short
   in the editor is three times as long on the wire. Calendars that enforce
   the limit truncate what they cannot parse — the room is the first thing
   to go. */
test("long lines are folded by byte length, not character count", () => {
  const ctx = loadIcs([{
    id: "cn1", titleEn: "Civil Engineering and Disaster Prevention and Mitigation",
    titleCn: "土木工程与防灾减灾", number: "70511131", seq: "1", credits: 2,
    status: "booked", instructor: "CHEN Yubo", dept: "经济管理学院",
    room: "舜德楼西楼第三阶梯教室 301", weeks: "1",
    note: "Group project, presentation in week 12; bring a laptop",
    slots: [{ day: 1, start: "08:00", end: "09:35", block: 1 }]
  }]);
  const text = String(vm.runInContext(
    "buildICS({ courseIds: new Set(['cn1']), weekFrom:1, weekTo:1, skipHolidays:false," +
    " seq:1, travelMin:0, alarmMin:0, includeChinese:true, inclNote:true," +
    " inclInstructor:true, inclDept:true, inclNumber:true }).text", ctx) || "");

  const lines = text.split("\r\n");
  const tooLong = lines.filter(l => Buffer.byteLength(l, "utf8") > 75);
  assert.deepEqual(tooLong, [], "every folded line stays within 75 octets");

  // Folding must be reversible: unfolding restores the values unchanged.
  const unfolded = text.replace(/\r\n /g, "").split("\r\n");
  assert.ok(unfolded.some(l => l === "LOCATION:舜德楼西楼第三阶梯教室 301"),
    "the room survives folding and unfolding");
  assert.ok(unfolded.some(l => l.includes("经济管理学院") && l.includes("bring a laptop")),
    "the description survives folding and unfolding");
});

/* Notes travel in from the portal and from pasted rows, where line breaks
   are CRLF. A bare CR left inside a content line is not valid ICS. */
test("a note with Windows line breaks does not put a bare CR in the file", () => {
  const ctx = loadIcs([{
    id: "n1", titleEn: "Firm Valuation", number: "80517022", seq: "1", credits: 2,
    status: "booked", weeks: "1", room: "A101",
    note: "Priority: GMBA first.\r\nBring the case pack.",
    slots: [{ day: 1, start: "08:00", end: "09:35", block: 1 }]
  }]);
  const text = String(vm.runInContext(
    "buildICS({ courseIds: new Set(['n1']), weekFrom:1, weekTo:1, skipHolidays:false," +
    " seq:1, travelMin:0, alarmMin:0, inclNote:true }).text", ctx) || "");

  const stray = text.split("\r\n").filter(l => /\r/.test(l));
  assert.deepEqual(stray, [], "no content line carries a stray CR");
  assert.ok(text.replace(/\r\n /g, "").includes("GMBA first.\\nBring the case pack."),
    "the break is escaped as \\n, the way ICS spells it");
});
