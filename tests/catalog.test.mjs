/* Merging the two catalog sources. The MBA file is the richer one (rooms,
   descriptions, syllabus pages), the portal is the wider one (~5,000 rows) —
   and it is the only place the teaching language is written down. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadModules, plain, pick } from "./harness.mjs";

const ctx = loadModules(["core", "parser", "catalog"]);
const merge = (mba, portal) => plain(ctx.mergeCatalogSources(mba, portal));

const MBA = { snapshot:"2026-07-02", courses: [
  { key:"80511412", number:"80511412", seq:"0", titleEn:"Technology and Strategy",
    credits:2, program:"MiM", lang:"English", room:"A307", description:"Rich text." },
]};
const portalRow = extra => Object.assign({
  number:"80511412", seq:"0", titleEn:"Technology and Strategy", titleCn:"技术与战略",
  credits:2, dept:"School of Economics and Management", instructor:"LI Xibao",
  time:"2-2(week 1-12)", features:"", remarks:"",
}, extra || {});

test("a course in both sources stays one entry and keeps the MBA detail", () => {
  const { entries } = merge(MBA, { courses:[portalRow()] });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].source, "mba");
  assert.equal(entries[0].description, "Rich text.", "the richer source wins");
});

/* The MBA file has no "features" column, so without this the teaching
   language of every MBA-listed course was silently lost in the merge. */
test("the portal's course features survive the merge", () => {
  const { entries } = merge(MBA, { courses:[portalRow({ features:"Taught in foreign language" })] });
  assert.equal(entries[0].features, "Taught in foreign language");
});

test("an MBA entry with its own features is not overwritten", () => {
  const mba = { snapshot:"x", courses:[Object.assign({}, MBA.courses[0], { features:"Curated note" })] };
  const { entries } = merge(mba, { courses:[portalRow({ features:"Taught in foreign language" })] });
  assert.equal(entries[0].features, "Curated note");
});

test("a course only the portal knows becomes its own entry", () => {
  const { entries } = merge(MBA, { courses:[portalRow(), portalRow({ number:"80250993", titleEn:"Machine Learning" })] });
  assert.equal(entries.length, 2);
  const ml = entries.find(e => e.number === "80250993");
  assert.equal(ml.source, "portal");
  assert.equal(ml.key, "80250993-0");
});

test("several sections of one number are listed separately, not merged away", () => {
  const rows = [portalRow({ seq:"1" }), portalRow({ seq:"2" })];
  const { entries } = merge(MBA, { courses: rows });
  assert.equal(entries.length, 3, "the MBA entry plus both portal sections");
});

test("the catalog works with no portal snapshot at all", () => {
  const { entries } = merge(MBA, null);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].source, "mba");
});

/* ---- which plan course a catalog row stands for -----------------------
   "Elementary Chinese B" exists once in the MBA list (no sequence, Fri
   13:30) and ~200 times in the portal (one row per section). Adding the
   Wednesday section must not make the Friday row look booked too — that is
   a different meeting of the same course number. */
const { state } = pick(ctx, "state");
const setPlan = courses => { state.courses = courses; };

const mbaChinese = { key:"64203022", source:"mba", number:"64203022", titleEn:"Elementary Chinese B",
  slots:[{ day:5, start:"13:30", end:"16:05" }] };
const portalChinese = seq => ({ key:"64203022-"+seq, source:"portal", number:"64203022", seq,
  titleEn:"Elementary Chinese B", slots:[{ day:3, start:"09:50", end:"12:15", block:2 }] });

test("adding one section does not mark the other sections as in plan", () => {
  setPlan([ctx.catalogEntryToCourse(portalChinese("10"))]);
  assert.equal(ctx.planCourseFor(portalChinese("10")).number, "64203022", "the added section itself");
  assert.equal(ctx.planCourseFor(portalChinese("1")), null, "a different portal section");
  assert.equal(ctx.planCourseFor(mbaChinese), null, "the MBA row — another meeting entirely");
});

test("the MBA row finds the plan course that meets at the same time", () => {
  setPlan([{ id:"seed-chinese", number:"64203022", seq:"0", titleEn:"Elementary Chinese B",
             status:"booked", slots:[{ day:5, start:"13:30", end:"16:05" }] }]);
  assert.ok(ctx.planCourseFor(mbaChinese), "same number, same meeting, sequence unknown on one side");
  assert.equal(ctx.planCourseFor(portalChinese("10")), null, "a portal section with its own sequence");
});

test("a catalogRef always wins, whatever the times say", () => {
  const c = ctx.catalogEntryToCourse(mbaChinese);
  c.slots = [{ day:1, start:"08:00", end:"09:35" }];   // moved by hand afterwards
  setPlan([c]);
  assert.ok(ctx.planCourseFor(mbaChinese));
});

test("a course without meetings still matches by number", () => {
  setPlan([{ id:"x", number:"64203022", titleEn:"Elementary Chinese B", status:"option", slots:[] }]);
  assert.ok(ctx.planCourseFor(mbaChinese));
});
