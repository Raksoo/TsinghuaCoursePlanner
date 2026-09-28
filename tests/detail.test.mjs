/* Phase 3 — the course detail page.

   The fixtures are the REAL page now (Oskar dumped it on 2026-09-28,
   course 80511412 "Technology and Strategy"), so these tests pin the
   parser to the markup the portal actually serves. The parser still reads
   by label rather than by position, which the shape tests below cover —
   that is what makes it survive the portal's whitespace and its habit of
   putting two label/value pairs in one row. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadModules, docFrom, fixture, plain } from "./harness.mjs";

const ctx = loadModules(["core", "parser", "scheduleParse"]);
const parseCourseDetail = doc => plain(ctx.parseCourseDetail(doc));

const live = docFrom(fixture("course-detail-live.html"));

test("reads every field of the real detail page", () => {
  const d = parseCourseDetail(live);
  assert.equal(d.number, "80511412");
  assert.equal(d.seq, "0");
  assert.equal(d.titleEn, "Technology and Strategy");
  assert.equal(d.dept, "School of Economics and Management");
  assert.equal(d.creditHours, 32);
  assert.equal(d.credits, 2);
  assert.equal(d.features, "01");
  assert.match(d.textbooks, /^Melissa A\. Schilling, Strategic Management/);
  assert.match(d.references, /^Scott Shane/);
  assert.match(d.descriptionEn, /^Analyze the technologies strategies of leading firms/);
  assert.match(d.descriptionCn, /^技术密集型产业的竞争/);
  assert.match(d.fetchedAt, /^\d{4}-\d{2}-\d{2}$/);
});

test("credit hours and credits come back as numbers, not strings", () => {
  const d = ctx.parseCourseDetail(live);
  assert.equal(typeof d.creditHours, "number");
  assert.equal(typeof d.credits, "number");
});

/* The portal pads the department cell with hundreds of blank lines, and
   "Credit" sits right next to "Credit hours" — both are ways to get this
   subtly wrong. */
test("survives the portal's whitespace padding", () => {
  const d = parseCourseDetail(live);
  assert.equal(d.dept, "School of Economics and Management", "no stray whitespace");
  assert.equal(d.creditHours, 32, '"Credit hours" is not confused with "Credit"');
  assert.equal(d.credits, 2);
});

test("an empty field stays empty instead of absorbing the next label", () => {
  const d = parseCourseDetail(live);
  // Both are blank cells on this page; "Instructor name" is followed by
  // the "Credit hours" label, which must not leak into the value.
  assert.ok(!d.instructor);
  assert.ok(!d.testing);
});

test("a dump containing the page four times reads the same as one copy", () => {
  const once = parseCourseDetail(live);
  const four = parseCourseDetail(docFrom(fixture("course-detail-live-4x.html")));
  assert.deepEqual(four, once);
});

/* Shape tolerance: the parser keys on labels, not on positions or classes,
   so these variants have to work even though the live page uses none of them. */
test("labels are matched regardless of colons, case and whitespace", () => {
  const d = parseCourseDetail(docFrom(`<table>
    <tr><td> COURSE NUMBER : </td><td>80517022</td></tr>
    <tr><td>english description</td><td>Valuation of firms.</td></tr></table>`));
  assert.equal(d.number, "80517022");
  assert.equal(d.descriptionEn, "Valuation of firms.");
});

test("works with th labels or one pair per row", () => {
  const d = parseCourseDetail(docFrom(`<table>
    <tr><th>Course number</th><td>60510371</td></tr>
    <tr><th>Credit hours</th><td>32</td></tr>
    <tr><th>English description</th><td>Contemporary China.</td></tr></table>`));
  assert.equal(d.number, "60510371");
  assert.equal(d.creditHours, 32);
  assert.equal(d.descriptionEn, "Contemporary China.");
});

test("a Chinese-language portal page is read through the fallback labels", () => {
  const d = parseCourseDetail(docFrom(`<table>
    <tr><td>课程号</td><td>80515182</td><td>学时</td><td>48</td></tr>
    <tr><td>课程简介</td><td>领导力</td></tr></table>`));
  assert.equal(d.number, "80515182");
  assert.equal(d.creditHours, 48);
  assert.equal(d.descriptionCn, "领导力");
});

test("a page that is not a course detail is reported, not half-parsed", () => {
  assert.throws(() => parseCourseDetail(docFrom("<html><body><p>Session expired</p></body></html>")),
                /detail page|course information/i);
  assert.throws(() => parseCourseDetail(docFrom("<table><tr><td>Hello</td><td>World</td></tr></table>")),
                /course information/i);
});
