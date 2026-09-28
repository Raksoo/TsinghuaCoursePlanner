/* Editing a course must not lose what the form cannot show.

   A course from a timetable import carries the portal's description
   (`detail`), the key the catalog matches on (`catalogRef`) and a sequence —
   none of which has an input field. Rebuilding the course from the form
   alone dropped all three: one edit to a note and the description was gone
   for good, with an "Course updated" toast on top. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadModules, plain } from "./harness.mjs";

const ctx = loadModules(["core", "form"]);
const { mergeCourseEdit } = ctx;

const imported = {
  id: "cat-70511131",
  titleEn: "Digital Economy", number: "70511131", seq: "1",
  credits: 2, status: "booked", weeks: "1-3,5",
  slots: [{ day:1, start:"08:00", end:"11:25", room:"A201" }],
  catalogRef: { source:"portal", key:"70511131-1" },
  detail: { descriptionEn: "1. Theoretical Background …", creditHours: 16, fetchedAt: "2026-09-28" },
  note: ""
};

/* What readForm() hands over: only the fields the form renders. */
const fromForm = {
  id: "cat-70511131",
  titleEn: "Digital Economy", titleCn: "", number: "70511131", seq: "1",
  credits: 2, instructor: "", dept: "", lang: "", room: "",
  weeks: "1-3,5", status: "booked", note: "ask about the case study",
  slots: [{ day:1, start:"08:00", end:"11:25", block: undefined, room:"A201" }]
};

test("an edit keeps the portal's description and the catalog link", () => {
  const out = mergeCourseEdit(imported, fromForm);
  assert.deepEqual(plain(out.detail), plain(imported.detail));
  assert.deepEqual(plain(out.catalogRef), plain(imported.catalogRef));
});

test("the form's own fields win over the stored ones", () => {
  const out = mergeCourseEdit(imported, fromForm);
  assert.equal(out.note, "ask about the case study");
  assert.equal(out.status, "booked");
  assert.equal(plain(out.slots).length, 1);
});

test("a room set for one meeting survives the round trip", () => {
  const out = mergeCourseEdit(imported, fromForm);
  assert.equal(out.slots[0].room, "A201");
});

test("a brand-new course carries nothing extra", () => {
  const out = mergeCourseEdit(undefined, fromForm);
  assert.equal(out.detail, undefined);
  assert.equal(out.catalogRef, undefined);
  assert.equal(out.titleEn, "Digital Economy");
});
