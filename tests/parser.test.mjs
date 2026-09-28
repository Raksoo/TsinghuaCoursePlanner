/* The paste parser reads the time codes of a portal row. The portal writes
   one code per *block*, so a lecture that runs a whole morning arrives as
   two codes — the timetable parser already merges those back into one
   meeting (js/scheduleParse.js), and a pasted row has to end up with the
   same plan, or the week grid shows two boxes and the .ics two events for
   one lecture. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadModules, plain } from "./harness.mjs";

const ctx = loadModules(["core", "parser"]);
const code = s => plain(ctx.slotsFromCode(s));

test("one block code becomes one meeting", () => {
  const { slots, weeks } = code("2-2(week 1-16)");
  assert.equal(weeks, "1-16");
  assert.deepEqual(slots, [{ day: 2, start: "09:50", end: "12:15", block: 2 }]);
});

test("two adjacent blocks on the same day are one meeting", () => {
  const { slots, weeks } = code("1-1(week 1-3,5),1-2(week 1-3,5)");
  assert.equal(weeks, "1-3,5");
  assert.equal(slots.length, 1, "one lecture, not two");
  assert.equal(slots[0].start, "08:00");
  assert.equal(slots[0].end, "12:15");
});

test("blocks with a gap between them stay separate meetings", () => {
  const { slots } = code("1-1(week 1-16),1-3(week 1-16)");
  assert.equal(slots.length, 2, "morning and afternoon are two meetings");
  assert.deepEqual(slots.map(s => s.start), ["08:00", "13:30"]);
});

test("two days stay two meetings", () => {
  const { slots } = code("1-2(week 1-16),4-2(week 1-16)");
  assert.deepEqual(slots.map(s => s.day), [1, 4]);
});

test("meetings with different week ranges keep their own weeks", () => {
  const { slots, weeks } = code("1-6(week 1-8),2-6(week 9-16)");
  assert.equal(weeks, "1-16", "the course's weeks are the union");
  assert.deepEqual(slots.map(s => s.weeks), ["1-8", "9-16"]);
});

test("an en dash in the week range still parses to real weeks", () => {
  const { weeks } = code("3-4(week 1–12)");   // the portal writes ranges both ways
  assert.deepEqual(plain(ctx.parseWeeks(weeks)), [1,2,3,4,5,6,7,8,9,10,11,12]);
});

/* A pasted portal row: number, sequence, credits, title, instructor,
   department, language, time code — tab separated, the way a browser
   copies a table row. */
const row = (...f) => plain(ctx.parseRecord(f));

test("a pasted row keeps number, sequence and credits apart", () => {
  const c = row("80511412", "1", "2", "Technology and Strategy", "LI Xibao",
                "School of Economics and Management", "English", "2-2(week 1-12)");
  assert.equal(c.number, "80511412");
  assert.equal(c.seq, "1");
  assert.equal(c.credits, 2);
  assert.equal(c.titleEn, "Technology and Strategy");
});

test("half credits survive the paste", () => {
  const c = row("80511412", "1", "1.5", "Technology and Strategy", "LI Xibao",
                "School of Economics and Management", "English", "2-2(week 1-12)");
  assert.equal(c.credits, 1.5, "1.5 CP is a credit value, never a sequence number");
  assert.equal(c.seq, "1");
});
