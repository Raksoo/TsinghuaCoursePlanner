/* The planner is used from Germany long before anyone flies to Beijing, and
   European clocks go back on Sun Oct 25 2026 — in the middle of semester
   week 6. Dates built by adding 86 400 000 ms to a local midnight lose an
   hour there and fall back onto the previous day, so every week from 7
   onwards would be labelled, printed and exported one day early.

   Node applies process.env.TZ on the next Date operation, and core.js is
   only evaluated inside loadModules() below — after this line. */
process.env.TZ = "Europe/Berlin";

import { test } from "node:test";
import assert from "node:assert/strict";
import { loadModules } from "./harness.mjs";

const ctx = loadModules(["core"]);
const { dateFor, weekDates, dayDate } = ctx;
const iso = d => d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");

test("week 1 Monday is September 14", () => {
  assert.equal(iso(dateFor(1, 1)), "2026-09-14");
});

test("weeks after the European clock change keep their weekday", () => {
  assert.equal(iso(dateFor(7, 1)), "2026-10-26", "week 7 starts on Monday Oct 26");
  assert.equal(dateFor(7, 1).getDay(), 1);
  assert.equal(iso(dateFor(12, 5)), "2026-12-04", "week 12 Friday");
  assert.equal(dateFor(18, 7).getDay(), 0, "the last Sunday is still a Sunday");
});

test("the New Year's Day holiday falls on the date the calendar data uses", () => {
  assert.equal(iso(dateFor(16, 5)), "2027-01-01");
});

test("week labels do not slip either", () => {
  assert.equal(weekDates(7).label, "Oct 26 – Nov 1");
  assert.equal(dayDate(16, 5), "Jan 1");
});
