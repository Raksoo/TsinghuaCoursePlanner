/* Week lists as the user reads them.

   The MBA schedule skips the National Day week, so "1-3,5" is the normal
   shape of a course's weeks here — not an exotic edge case. Printing such a
   list as a plain first–last range claims a meeting in week 4 that the
   schedule explicitly does not have. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadModules, plain } from "./harness.mjs";

const ctx = loadModules(["core"]);
const { parseWeeks, compressWeeks, weeksLabel } = ctx;

test("a gap in the week list survives the display", () => {
  assert.equal(compressWeeks([1,2,3,5]), "1–3, 5");
});

test("a run of weeks is shortened to a range", () => {
  assert.equal(compressWeeks([1,2,3,4,5,6,7,8,9,10,11,12]), "1–12");
});

test("a single week stays a single week", () => {
  assert.equal(compressWeeks([5]), "5");
});

test("the label says week or weeks and keeps the gap", () => {
  assert.equal(weeksLabel([5]), "week 5");
  assert.equal(weeksLabel([1,2,3,5]), "weeks 1–3, 5");
  assert.equal(weeksLabel([]), "");
});

test("the MBA week string round-trips through parse and display", () => {
  assert.deepEqual(plain(parseWeeks("1-3,5")), [1,2,3,5]);
  assert.equal(compressWeeks(parseWeeks("1-3,5")), "1–3, 5");
});
