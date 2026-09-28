/* Phase 1 — the portal's "My timetable" page → meetings.
   Fixture: _Archive/Schedule-Info-Portal/, the real page of a real plan. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadModules, docFrom, fixture, plain } from "./harness.mjs";

const ctx = loadModules(["core", "parser", "scheduleParse"]);
const parseSchedulePage = doc => plain(ctx.parseSchedulePage(doc));

const onePage = docFrom(fixture("schedule-page.html"));
const fivePages = docFrom(fixture("schedule-page-5x.html"));

/* What the page actually shows (verified against overview.png):
   6 courses in 9 grid cells — Digital Economy and Firm Valuation and
   Frontiers each span two blocks. */
const EXPECTED = [
  { number:"70511131", titleEn:"Digital Economy: Global versus Chinese Perspectives",
    day:1, blocks:[1,2], start:"08:00", end:"12:15", room:"建华/经管新楼A201", weeks:"1-3,5" },
  { number:"80511412", titleEn:"Technology and Strategy",
    day:2, blocks:[2], start:"09:50", end:"12:15", room:"建华/经管新楼A307", weeks:"1-12" },
  { number:"80517022", titleEn:"Firm Valuation",
    day:2, blocks:[3,4], start:"13:30", end:"16:55", room:"建华/经管新楼A101", weeks:"1-3,5-8" },
  { number:"60510371", titleEn:"Frontiers of Chinese Contemporary Issues Research",
    day:3, blocks:[3,4], start:"13:30", end:"16:55", room:"建华/经管新楼A419", weeks:"6-9" },
  { number:"80515182", titleEn:"Leadership in A New Era",
    day:3, blocks:[6], start:"19:20", end:"21:45", room:"建华/经管新楼LG1-21", weeks:"5-14" },
  { number:"80250993", titleEn:"Machine Learning",
    day:4, blocks:[2], start:"09:50", end:"12:15", room:"六教6A216", weeks:"1-16" },
];

test("reads every meeting from the timetable grid", () => {
  const out = parseSchedulePage(onePage);
  assert.equal(out.meetings.length, 6);
  const got = out.meetings.map(m => ({
    number: m.number, titleEn: m.titleEn, day: m.day, blocks: m.blocks,
    start: m.start, end: m.end, room: m.room, weeks: m.weeks,
  }));
  assert.deepEqual(got, EXPECTED);
});

test("merges a course that spans two consecutive blocks into one meeting", () => {
  const de = parseSchedulePage(onePage).meetings.find(m => m.number === "70511131");
  assert.deepEqual(de.blocks, [1, 2]);
  assert.equal(de.start, "08:00");
  assert.equal(de.end, "12:15");
  assert.equal(de.merged, true, "a merged meeting is flagged so the UI can warn about the end time");
});

test("a single-block meeting keeps its block and is not flagged as merged", () => {
  const ml = parseSchedulePage(onePage).meetings.find(m => m.number === "80250993");
  assert.deepEqual(ml.blocks, [2]);
  assert.equal(ml.block, 2);
  assert.ok(!ml.merged);
});

test("keeps Chinese room names intact", () => {
  const ml = parseSchedulePage(onePage).meetings.find(m => m.number === "80250993");
  assert.equal(ml.room, "六教6A216");
  assert.ok(!/[ÃÂ�]/.test(ml.room), "no mojibake");
});

test("reads the course sequence and the detail link", () => {
  const de = parseSchedulePage(onePage).meetings.find(m => m.number === "70511131");
  assert.equal(de.seq, "1");
  assert.match(de.detailUrl, /showKcDetail/);
  assert.match(de.detailUrl, /p_kch=70511131/);
  assert.match(de.detailUrl, /p_kxh=1/);
  // Phase 3 depends on these URLs coming from the page, never constructed.
  assert.ok(de.detailUrl.includes("p_xnxq="));
});

test("reads the semester from the detail links", () => {
  assert.equal(parseSchedulePage(onePage).semester, "2026-2027-1");
});

test("a dump containing the page five times still yields six meetings", () => {
  // The archived RTF export repeats the whole document; parsing must not
  // multiply the plan by five.
  assert.equal(parseSchedulePage(fivePages).meetings.length, 6);
});

test("weeks are converted to the app's own notation", () => {
  const out = parseSchedulePage(onePage);
  const fv = out.meetings.find(m => m.number === "80517022");
  assert.equal(fv.weeksRaw, "week 1-3,5-8");
  assert.equal(fv.weeks, "1-3,5-8");
  assert.deepEqual(plain(ctx.parseWeeks(fv.weeks)), [1, 2, 3, 5, 6, 7, 8]);
});

test("week ranges written with an en dash are normalised", () => {
  const html = cellPage(`
    <td id="a2_3">
      <span onmouseover="return overlib('Classroom: R7&lt;br&gt;Week: week 1\u20134',WRAP);">
        <a class="mainHref" href="xkJxs.vxkJxsJxjhBs.do?m=showKcDetail&amp;p_kch=66666666&amp;p_kxh=0&amp;p_xnxq=2026-2027-1">Dashed</a></span><br></td>`);
  const m = parseSchedulePage(docFrom(html)).meetings[0];
  assert.equal(m.weeks, "1-4");
  assert.deepEqual(plain(ctx.parseWeeks(m.weeks)), [1, 2, 3, 4]);
});

test("two courses in one cell become two meetings", () => {
  const html = cellPage(`
    <td id="a3_2">
      <span onmouseover="return overlib('Classroom: R1&lt;br&gt;Week: week 1-4',WRAP);">
        <a class="mainHref" href="xkJxs.vxkJxsJxjhBs.do?m=showKcDetail&amp;p_kch=11111111&amp;p_kxh=0&amp;p_xnxq=2026-2027-1">First</a></span><br>
      <span onmouseover="return overlib('Classroom: R2&lt;br&gt;Week: week 5-8',WRAP);">
        <a class="mainHref" href="xkJxs.vxkJxsJxjhBs.do?m=showKcDetail&amp;p_kch=22222222&amp;p_kxh=0&amp;p_xnxq=2026-2027-1">Second</a></span><br>
    </td>`);
  const out = parseSchedulePage(docFrom(html));
  assert.equal(out.meetings.length, 2);
  assert.deepEqual(out.meetings.map(m => m.titleEn), ["First", "Second"]);
  assert.deepEqual(out.meetings.map(m => m.room), ["R1", "R2"]);
});

test("blocks are only merged when room and weeks match", () => {
  // Same course, adjacent blocks, but a different room in the second one:
  // two separate meetings, because merging would invent a room.
  const html = cellPage(`
    <td id="a1_1">
      <span onmouseover="return overlib('Classroom: R1&lt;br&gt;Week: week 1-4',WRAP);">
        <a class="mainHref" href="xkJxs.vxkJxsJxjhBs.do?m=showKcDetail&amp;p_kch=33333333&amp;p_kxh=0&amp;p_xnxq=2026-2027-1">Split</a></span><br></td>
    <td id="a2_1">
      <span onmouseover="return overlib('Classroom: R9&lt;br&gt;Week: week 1-4',WRAP);">
        <a class="mainHref" href="xkJxs.vxkJxsJxjhBs.do?m=showKcDetail&amp;p_kch=33333333&amp;p_kxh=0&amp;p_xnxq=2026-2027-1">Split</a></span><br></td>`);
  const out = parseSchedulePage(docFrom(html));
  assert.equal(out.meetings.length, 2);
  assert.deepEqual(out.meetings.map(m => m.room), ["R1", "R9"]);
});

test("non-adjacent blocks of the same course stay separate", () => {
  const html = cellPage(`
    <td id="a1_1">
      <span onmouseover="return overlib('Classroom: R1&lt;br&gt;Week: week 1-4',WRAP);">
        <a class="mainHref" href="xkJxs.vxkJxsJxjhBs.do?m=showKcDetail&amp;p_kch=44444444&amp;p_kxh=0&amp;p_xnxq=2026-2027-1">Gap</a></span><br></td>
    <td id="a4_1">
      <span onmouseover="return overlib('Classroom: R1&lt;br&gt;Week: week 1-4',WRAP);">
        <a class="mainHref" href="xkJxs.vxkJxsJxjhBs.do?m=showKcDetail&amp;p_kch=44444444&amp;p_kxh=0&amp;p_xnxq=2026-2027-1">Gap</a></span><br></td>`);
  const out = parseSchedulePage(docFrom(html));
  assert.equal(out.meetings.length, 2);
  assert.deepEqual(out.meetings.map(m => m.blocks), [[1], [4]]);
});

test("an empty timetable parses to no meetings instead of throwing", () => {
  const out = parseSchedulePage(docFrom(cellPage(`<td id="a1_1"></td>`)));
  assert.deepEqual(out.meetings, []);
});

test("a page without a timetable is reported, not silently empty", () => {
  assert.throws(
    () => parseSchedulePage(docFrom("<html><body><p>Please log in</p></body></html>")),
    /timetable/i,
  );
});

test("a meeting without a tooltip still yields day, block and course", () => {
  const html = cellPage(`
    <td id="a5_5">
      <a class="mainHref" href="xkJxs.vxkJxsJxjhBs.do?m=showKcDetail&amp;p_kch=55555555&amp;p_kxh=2&amp;p_xnxq=2026-2027-1">Bare</a></td>`);
  const m = parseSchedulePage(docFrom(html)).meetings[0];
  assert.equal(m.number, "55555555");
  assert.equal(m.day, 5);
  assert.equal(m.block, 5);
  assert.equal(m.room, "");
  assert.equal(m.weeks, "");
});

/* Minimal page with the one structural thing the parser keys on. */
function cellPage(cells){
  return `<html><body><div class="side_content">
    <table class="kebiao_table"><tbody>
      <tr class="biaoti"><td></td><td>Monday</td><td>Tuesday</td><td>Wednesday</td><td>Thursday</td><td>Friday</td><td>Saturday</td><td>Sunday</td></tr>
      <tr>${cells}</tr>
    </tbody></table></div></body></html>`;
}

