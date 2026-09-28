/* Phase 2 — the timetable is the only reliable answer to "what am I
   actually registered for". So importing it is a reconciliation, not an
   insert: new / differs / registered-nowhere. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadModules, docFrom, fixture, plain } from "./harness.mjs";

const ctx = loadModules(["core", "parser", "scheduleParse", "scheduleImport"]);
const meetingsOf = html => ctx.parseSchedulePage(docFrom(html)).meetings;
const REAL = meetingsOf(fixture("schedule-page.html"));

/* A minimal stand-in for the merged catalog (catalog.js shape). */
const CATALOG = { entries: [
  { key:"70511131-1", number:"70511131", seq:"1", titleEn:"Digital Economy: Global versus Chinese Perspectives",
    titleCn:"数字经济", credits:2, instructor:"CHEN Yubo", dept:"School of Economics and Management", lang:"English" },
  { key:"80250993-0", number:"80250993", seq:"0", titleEn:"Machine Learning", titleCn:"机器学习",
    credits:3, instructor:"", dept:"Department of Computer Science", lang:"" },
]};

const toCourses = (m, cat) => plain(ctx.scheduleToCourses(m, cat));

test("one course with two weekly meetings becomes one course with two slots", () => {
  const courses = toCourses(REAL, null);
  const frontiers = courses.find(c => c.number === "60510371");
  assert.equal(frontiers.slots.length, 1, "Frontiers meets once a week (Wed, blocks 3+4)");
  const digital = courses.find(c => c.number === "70511131");
  assert.equal(digital.slots.length, 1, "Digital Economy meets once a week (Mon, blocks 1+2)");
  assert.equal(courses.length, 6, "six distinct courses in the fixture");
});

test("groups meetings of the same course on different days into one course", () => {
  const courses = toCourses(meetingsOf(twoDayPage()), null);
  assert.equal(courses.length, 1);
  assert.deepEqual(courses[0].slots.map(s => s.day), [1, 4]);
});

test("a registered course arrives as booked, with its room", () => {
  const c = toCourses(REAL, null).find(x => x.number === "70511131");
  assert.equal(c.status, "booked");
  assert.equal(c.slots[0].room, "建华/经管新楼A201");
  assert.equal(c.room, "建华/经管新楼A201", "course.room is set when every slot shares one");
});

test("course.weeks is the union; a slot only carries its own when it differs", () => {
  const courses = toCourses(meetingsOf(differentWeeksPage()), null);
  const c = courses[0];
  assert.equal(c.weeks, "1-8,10-12", "union over both meetings");
  assert.deepEqual(c.slots.map(s => s.weeks), ["1-8", "10-12"]);

  const same = toCourses(REAL, null).find(x => x.number === "70511131");
  assert.equal(same.weeks, "1-3,5");
  assert.equal(same.slots[0].weeks, undefined, "no per-slot weeks when they match the course");
});

test("credits and instructor are filled in from the catalog", () => {
  const c = toCourses(REAL, CATALOG).find(x => x.number === "70511131");
  assert.equal(c.credits, 2);
  assert.equal(c.instructor, "CHEN Yubo");
  assert.equal(c.titleCn, "数字经济");
  assert.equal(c.catalogRef.key, "70511131-1");
});

test("a course the catalog does not know still imports, without credits", () => {
  const c = toCourses(REAL, CATALOG).find(x => x.number === "80517022");
  assert.equal(c.credits, 0);
  assert.ok(c.titleEn);
});

/* ---------- the reconciliation ---------- */

const diff = (mine, meetings, cat) => plain(ctx.diffPlan(mine, ctx.scheduleToCourses(meetings, cat || null)));

test("an empty plan sees every course as new", () => {
  const d = diff([], REAL);
  assert.equal(d.added.length, 6);
  assert.equal(d.changed.length, 0);
  assert.equal(d.missing.length, 0);
});

test("importing the same timetable twice changes nothing", () => {
  const first = plain(ctx.scheduleToCourses(REAL, null));
  const d = plain(ctx.diffPlan(first, ctx.scheduleToCourses(REAL, null)));
  assert.deepEqual(d.added, []);
  assert.deepEqual(d.changed, []);
  assert.deepEqual(d.missing, []);
});

test("a course already in the plan is matched by number+seq, not duplicated", () => {
  const mine = [{ id:"seed-digital", titleEn:"Digital Economy", number:"70511131", seq:"1", credits:1,
                  status:"bid", weeks:"1-3,5", room:"", slots:[{day:1,start:"08:00",end:"11:25",block:1}] }];
  const d = diff(mine, REAL);
  assert.equal(d.added.length, 5, "the other five are new");
  assert.equal(d.changed.length, 1);
  assert.equal(d.changed[0].course.id, "seed-digital", "keeps its id, so .ics UIDs stay stable");
});

test("differences are reported per field, with both values", () => {
  const mine = [{ id:"seed-digital", titleEn:"Digital Economy", number:"70511131", seq:"1", credits:1,
                  status:"bid", weeks:"1-3,5", room:"", slots:[{day:1,start:"08:00",end:"11:25",block:1}] }];
  const fields = diff(mine, REAL).changed[0].fields;
  const byName = Object.fromEntries(fields.map(f => [f.field, f]));
  assert.ok(byName.room, "the room is new information");
  assert.equal(byName.room.mine, "");
  assert.equal(byName.room.portal, "建华/经管新楼A201");
  assert.ok(byName.meetings, "08:00-11:25 vs the portal's blocks 1+2");
  assert.ok(byName.status, "bid in the plan, but actually registered");
  assert.equal(byName.status.portal, "booked");
});

/* The seed courses carry sequences that disagree with the portal
   (Frontiers: plan 0, portal 1). Treating that as two unrelated courses
   listed the same course as both "new" and "not registered" — confusing,
   and wrong: it is one course whose section number needs correcting. */
test("same number, different sequence is one course, not two", () => {
  const mine = [{ id:"seed-frontiers", titleEn:"Frontiers of Chinese Contemporary Issues Research",
                  number:"60510371", seq:"0", credits:1, status:"booked", weeks:"6-9",
                  slots:[{day:3,start:"13:30",end:"16:55"}] }];
  const d = diff(mine, REAL);
  assert.equal(d.missing.length, 0, "it IS registered — just under another sequence");
  assert.ok(!d.added.some(c => c.number === "60510371"), "and it is not a new course either");
  assert.equal(d.changed.length, 1);
  const seqField = d.changed[0].fields.find(f => f.field === "seq");
  assert.ok(seqField, "the sequence difference is what to report");
  assert.equal(seqField.mine, "0");
  assert.equal(seqField.portal, "1");
});

test("with several sections of one course in the plan, only an exact match counts", () => {
  const mine = [
    { id:"a", titleEn:"Chinese", number:"64203022", seq:"1", credits:2, status:"booked", weeks:"1-12", slots:[] },
    { id:"b", titleEn:"Chinese", number:"64203022", seq:"2", credits:2, status:"option", weeks:"1-12", slots:[] },
  ];
  const meetings = meetingsOf(cellPage(`<td id="a5_5">${entry("64203022","3","Chinese","R1","week 1-12")}</td>`));
  const d = diff(mine, meetings);
  assert.equal(d.added.length, 1, "ambiguous: do not guess which section to rewrite");
  assert.equal(d.changed.length, 0);
});

test("a booked course missing from the timetable is flagged, never deleted", () => {
  const mine = [{ id:"ghost", titleEn:"Not registered", number:"99999999", seq:"0", credits:2,
                  status:"booked", weeks:"1-16", slots:[{day:2,start:"08:00",end:"09:35",block:1}] }];
  const d = diff(mine, REAL);
  assert.equal(d.missing.length, 1);
  assert.equal(d.missing[0].course.id, "ghost");
  assert.equal(d.missing[0].suggest, "option");
});

test("options and dropped courses are not flagged as missing", () => {
  const mine = [
    { id:"opt", titleEn:"Maybe", number:"11111111", seq:"0", credits:2, status:"option", weeks:"1-16", slots:[] },
    { id:"out", titleEn:"Dropped", number:"22222222", seq:"0", credits:2, status:"out", weeks:"1-16", slots:[] },
  ];
  assert.deepEqual(diff(mine, REAL).missing, [], "only booked/bid courses claim a registration");
});

/* ---------- applying it ---------- */

test("applying writes only what was selected", () => {
  const mine = [{ id:"seed-digital", titleEn:"Digital Economy", number:"70511131", seq:"1", credits:1,
                  status:"bid", weeks:"1-3,5", room:"", slots:[{day:1,start:"08:00",end:"11:25",block:1}] }];
  const d = ctx.diffPlan(mine, ctx.scheduleToCourses(REAL, null));
  // take one new course and only the room of the changed one
  const next = plain(ctx.applyScheduleDiff(mine, d, {
    added: { "80250993-0": true },
    changed: { "70511131-1": { room: true } },
    missing: {},
  }));
  assert.equal(next.length, 2, "one added, one kept");
  const digital = next.find(c => c.id === "seed-digital");
  assert.equal(digital.room, "建华/经管新楼A201", "room taken");
  assert.equal(digital.status, "bid", "status not taken — it was not selected");
  assert.equal(digital.slots[0].end, "11:25", "meetings not taken either");
  assert.ok(next.find(c => c.number === "80250993"));
});

test("selecting nothing leaves the plan exactly as it was", () => {
  const mine = [{ id:"seed-digital", titleEn:"Digital Economy", number:"70511131", seq:"1", credits:1,
                  status:"bid", weeks:"1-3,5", room:"", slots:[{day:1,start:"08:00",end:"11:25",block:1}] }];
  const d = ctx.diffPlan(mine, ctx.scheduleToCourses(REAL, null));
  const next = plain(ctx.applyScheduleDiff(mine, d, { added:{}, changed:{}, missing:{} }));
  assert.deepEqual(next, plain(mine));
});

test("applying never mutates the plan it was given", () => {
  const mine = [{ id:"seed-digital", titleEn:"Digital Economy", number:"70511131", seq:"1", credits:1,
                  status:"bid", weeks:"1-3,5", room:"", slots:[{day:1,start:"08:00",end:"11:25",block:1}] }];
  const before = JSON.stringify(mine);
  const d = ctx.diffPlan(mine, ctx.scheduleToCourses(REAL, null));
  ctx.applyScheduleDiff(mine, d, { added:{ "80250993-0":true }, changed:{ "70511131-1":{ room:true, meetings:true, status:true } }, missing:{} });
  assert.equal(JSON.stringify(mine), before, "the immutability rule from CLAUDE.md");
});

test("a missing course is only downgraded when that is selected", () => {
  const mine = [{ id:"ghost", titleEn:"Not registered", number:"99999999", seq:"0", credits:2,
                  status:"booked", weeks:"1-16", slots:[{day:2,start:"08:00",end:"09:35",block:1}] }];
  const d = ctx.diffPlan(mine, ctx.scheduleToCourses(REAL, null));
  assert.equal(plain(ctx.applyScheduleDiff(mine, d, { added:{}, changed:{}, missing:{} }))[0].status, "booked");
  assert.equal(plain(ctx.applyScheduleDiff(mine, d, { added:{}, changed:{}, missing:{ ghost:true } }))[0].status, "option");
});

/* ---------- the semester guard ---------- */

/* Week 1 of this planner is a fixed calendar date. A timetable from
   another term maps onto those same week numbers and looks entirely
   plausible while being months off. */
test("the app names the semester its week numbers belong to", () => {
  assert.equal(pickSemester(), "2026-2027-1");
});

test("the parser reports which semester a timetable is from", () => {
  assert.equal(ctx.parseSchedulePage(docFrom(fixture("schedule-page.html"))).semester, "2026-2027-1");
});

function pickSemester(){
  return plain(ctx.parseSchedulePage(docFrom(fixture("schedule-page.html")))).semester;
}

/* ---------- course details (Phase 3) ---------- */

test("details travel with the course when the scraper attached them", () => {
  const withDetail = ctx.scheduleToCourses(REAL, null);
  const meetings = REAL.map(m => Object.assign({}, m, { detail: { descriptionEn:"About it.", creditHours:16 } }));
  const c = toCourses(meetings, null)[0];
  assert.equal(c.detail.descriptionEn, "About it.");
  assert.equal(withDetail[0].detail, undefined, "no detail when the scraper skipped it");
});

/* The detail page spells "Course features" as a code ("01"); only the
   catalog knows it means "Taught in foreign language". Showing a reader
   a naked code would be worse than showing nothing. */
test("the feature code is resolved to words when the catalog knows the course", () => {
  const cat = { entries: [{ key:"70511131-1", number:"70511131", seq:"1", titleEn:"Digital Economy",
                            credits:2, features:"Taught in foreign language" }] };
  const meetings = REAL.map(m => m.number === "70511131"
    ? Object.assign({}, m, { detail:{ features:"01", descriptionEn:"x" } }) : m);
  const c = toCourses(meetings, cat).find(x => x.number === "70511131");
  assert.equal(c.detail.features, "01", "the raw value is kept as data");
  assert.equal(c.detail.featuresLabel, "Taught in foreign language", "and the words come from the catalog");
});

test("without a catalog entry the raw code is kept but not invented", () => {
  const meetings = REAL.map(m => m.number === "80517022"
    ? Object.assign({}, m, { detail:{ features:"01" } }) : m);
  const c = toCourses(meetings, null).find(x => x.number === "80517022");
  assert.equal(c.detail.features, "01");
  assert.equal(c.detail.featuresLabel, undefined, "no guessing what 01 means");
});

test("details are offered as a change on a course already in the plan", () => {
  const mine = [{ id:"seed-digital", titleEn:"Digital Economy", number:"70511131", seq:"1", credits:1,
                  status:"booked", weeks:"1-3,5", room:"建华/经管新楼A201",
                  slots:[{day:1,start:"08:00",end:"12:15",block:undefined,room:"建华/经管新楼A201"}] }];
  const meetings = REAL.map(m => Object.assign({}, m, { detail:{ descriptionEn:"About it." } }));
  const d = diff(mine, meetings);
  const fields = d.changed[0].fields.map(f => f.field);
  assert.ok(fields.includes("detail"), "a new description is worth offering");
});

function twoDayPage(){
  return cellPage(`
    <td id="a1_1">${entry("12345678", "0", "Twice", "R1", "week 1-16")}</td>
    <td id="a1_4">${entry("12345678", "0", "Twice", "R1", "week 1-16")}</td>`);
}
function differentWeeksPage(){
  return cellPage(`
    <td id="a1_1">${entry("12345678", "0", "Split", "R1", "week 1-8")}</td>
    <td id="a1_4">${entry("12345678", "0", "Split", "R1", "week 10-12")}</td>`);
}
function entry(num, seq, title, room, weeks){
  return `<span onmouseover="return overlib('Classroom: ${room}&lt;br&gt;Week: ${weeks}',WRAP);">` +
         `<a class="mainHref" href="xkJxs.vxkJxsJxjhBs.do?m=showKcDetail&amp;p_kch=${num}&amp;p_kxh=${seq}&amp;p_xnxq=2026-2027-1">${title}</a></span><br>`;
}
function cellPage(cells){
  return `<html><body><table class="kebiao_table"><tbody>
    <tr class="biaoti"><td></td><td>Monday</td><td>Tuesday</td><td>Wednesday</td><td>Thursday</td><td>Friday</td><td>Saturday</td><td>Sunday</td></tr>
    <tr>${cells}</tr></tbody></table></body></html>`;
}

/* A meeting's own `weeks` beats the course's (CLAUDE.md, "Per-slot weeks").
   A plan course that came from a pasted portal row therefore often carries
   per-slot ranges — and taking the portal's corrected weeks has to reach
   them, or the change is applied to the field nothing reads. */
test("taking the weeks change also corrects the per-slot weeks", () => {
  const mine = [{
    id:"seed-digital", titleEn:"Digital Economy", number:"70511131", seq:"1", credits:1,
    status:"booked", weeks:"1-16", room:"建华/经管新楼A201",
    slots:[{ day:1, start:"08:00", end:"11:25", block:1, weeks:"9-16" }]
  }];
  const d = ctx.diffPlan(mine, ctx.scheduleToCourses(REAL, null));
  const change = d.changed.find(c => c.key === "70511131-1");
  assert.ok(change && change.fields.some(f => f.field === "weeks"), "the preview offers a weeks change");

  const next = plain(ctx.applyScheduleDiff(mine, d, {
    added:{}, changed:{ "70511131-1": { weeks: true } }, missing:{},
  }));
  const slot = next[0].slots[0];
  const effective = plain(ctx.slotWeeks(next[0], slot));
  assert.deepEqual(effective, plain(ctx.parseWeeks(next[0].weeks)),
    "the meeting runs in the weeks the preview said it would");
});

/* Odd/even-week courses write their range as "1-16 (odd weeks)" in Chinese,
   and weeksToAppNotation() cannot turn that into a week list. An empty
   `weeks` makes parseWeeks() return [], and a course with no weeks appears
   in no grid, no clash check and no .ics — it would be silently missing
   from the plan the student trusts. */
test("a week range the parser cannot read falls back to the full semester", () => {
  const meetings = [{
    day: 3, start: "19:20", end: "21:45", block: 6, number: "70511131", seq: "1",
    titleEn: "Digital Economy", room: "建华/经管新楼A201",
    weeksRaw: "1-16单周", weeks: ""
  }];
  const [course] = plain(ctx.scheduleToCourses(meetings, null));
  assert.ok(plain(ctx.parseWeeks(course.weeks)).length > 0, "the course happens in at least one week");
  assert.ok(/1-16单周/.test(course.note), "the portal's own wording is kept so it can be checked");
});

/* Credits decide the header counter and the goal bar, and the plan's own
   number is often a guess (the exchange list and the syllabus disagree for
   at least one seed course). When the catalog knows better, the import has
   to offer that — silently keeping a wrong credit total is the one thing
   the goal bar cannot survive. */
test("a different credit value is offered as a change", () => {
  const mine = [{ id:"seed-digital", titleEn:"Digital Economy", number:"70511131", seq:"1",
                  credits:1, status:"booked", weeks:"1-3,5", room:"建华/经管新楼A201",
                  slots:[{ day:1, start:"08:00", end:"11:25" }] }];
  const d = ctx.diffPlan(mine, ctx.scheduleToCourses(REAL, CATALOG));
  const change = d.changed.find(c => c.key === "70511131-1");
  const cp = change && change.fields.find(f => f.field === "credits");
  assert.ok(cp, "the preview offers the credit change");
  assert.equal(cp.portal, "2");

  const next = plain(ctx.applyScheduleDiff(mine, d, {
    added:{}, changed:{ "70511131-1": { credits: true } }, missing:{},
  }));
  assert.equal(next[0].credits, 2);
});

/* …but a timetable read without a catalog knows no credits at all, and
   "2 CP → 0 CP" would be a lie dressed up as a correction. */
test("an import that knows no credits does not offer to zero them", () => {
  const mine = [{ id:"seed-digital", titleEn:"Digital Economy", number:"70511131", seq:"1",
                  credits:2, status:"booked", weeks:"1-3,5", room:"建华/经管新楼A201",
                  slots:[{ day:1, start:"08:00", end:"11:25" }] }];
  const d = ctx.diffPlan(mine, ctx.scheduleToCourses(REAL, null));
  const change = d.changed.find(c => c.key === "70511131-1");
  assert.ok(!(change && change.fields.some(f => f.field === "credits")),
    "no credit line when the portal side has none");
});
