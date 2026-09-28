"use strict";

/* ============================================================
   The timetable → the plan.

   This is a reconciliation, not an insert. The portal's timetable is the
   only reliable answer to "what am I actually registered for", so an
   import has three outcomes:

     new       in the portal, not in the plan      → offer to add (booked)
     differs   in both, but not the same           → offer per field
     missing   booked/bid in the plan, absent
               from the portal                     → warn; never delete

   The third one is the quiet win: it catches a course you believed you
   had. Nothing here writes: it returns a new array for commit() to apply,
   and only the boxes that were ticked are taken.
   ============================================================ */

/* Meetings (one per weekly slot) → courses (one per number+seq, with a
   slot per meeting). Credits, instructor, Chinese title and department are
   not on the timetable page; when the catalog knows the course, take them
   from there. */
function scheduleToCourses(meetings, catalog){
  const byCourse = new Map();
  (meetings || []).forEach(m=>{
    const key = m.number + "-" + m.seq;
    if(!byCourse.has(key)) byCourse.set(key, []);
    byCourse.get(key).push(m);
  });

  const out = [];
  byCourse.forEach((group, key)=>{
    const first = group[0];
    const weekLists = group.map(m=>parseWeeks(m.weeks));
    const union = compressWeekList([...new Set(weekLists.flat())].sort((a,b)=>a-b));
    const allSameWeeks = group.every(m=>m.weeks === first.weeks);
    const rooms = [...new Set(group.map(m=>m.room).filter(Boolean))];

    const course = {
      id: "sch-" + key,
      titleEn: first.titleEn, titleCn: "",
      number: first.number, seq: first.seq,
      credits: 0,
      instructor: "", dept: "", lang: "",
      room: rooms.length === 1 ? rooms[0] : "",
      weeks: union || first.weeks || "",
      status: "booked",                     // it is in the timetable: it is registered
      slots: group.map(m=>{
        const slot = { day: m.day, start: m.start, end: m.end };
        if(m.block) slot.block = m.block;
        if(m.room) slot.room = m.room;
        if(!allSameWeeks && m.weeks) slot.weeks = m.weeks;
        return slot;
      }),
      note: "",
      catalogRef: { source:"schedule", key: key }
    };
    if(group.some(m=>m.merged)) course.note = "Portal lists this over two blocks - check the end time.";

    const entry = catalogEntryFor(catalog, first.number, first.seq);
    if(entry){
      course.credits = parseFloat(entry.credits) || 0;
      course.instructor = entry.instructor || "";
      course.dept = entry.dept || "";
      course.lang = entry.lang || "";
      course.titleCn = entry.titleCn || "";
      course.catalogRef = { source: entry.source || "portal", key: entry.key };
    }
    const detail = group.map(m=>m.detail).find(Boolean);
    if(detail){
      course.detail = Object.assign({}, detail);
      if(!course.credits && detail.credits) course.credits = detail.credits;
      // The detail page gives "Course features" as a bare code ("01"); the
      // catalog spells the same thing out ("Taught in foreign language").
      // Prefer the words, and never show a naked code to a reader.
      if(entry && entry.features) course.detail.featuresLabel = entry.features;
    }
    out.push(course);
  });
  return out;
}

function catalogEntryFor(catalog, number, seq){
  if(!catalog || !catalog.entries) return null;
  return catalog.entries.find(e=>e.number === number && String(e.seq || "") === String(seq || ""))
      || catalog.entries.find(e=>e.number === number)
      || null;
}

/* The same course in the plan, if it is there. Never by id: a course may
   have arrived from the catalog ("cat-...") or been typed by hand, and its
   id must survive the import so the .ics UIDs stay stable.

   The sequence is the awkward part. A hand-typed course often carries the
   wrong section number (the seed courses do), so insisting on an exact
   number+seq match would report one course twice -- once as "new", once as
   "not registered". So: exact match first; failing that, a match on the
   course number alone, but only when exactly one plan course has that
   number. With several sections in the plan there is nothing to guess from,
   and guessing wrong would rewrite the wrong course. */
function planMatchFor(courses, imported, taken){
  const free = c=>!taken || !taken.has(c.id);

  const byRef = courses.find(c=>free(c) && c.catalogRef && imported.catalogRef
                                && c.catalogRef.key === imported.catalogRef.key);
  if(byRef) return byRef;

  const exact = courses.find(c=>free(c) && c.number && c.number === imported.number
                                && String(c.seq || "") === String(imported.seq || ""));
  if(exact) return exact;

  const sameNumber = courses.filter(c=>free(c) && c.number && c.number === imported.number);
  return sameNumber.length === 1 ? sameNumber[0] : null;
}

function diffPlan(courses, imported){
  const added = [], changed = [];
  const matched = new Set();

  imported.forEach(imp=>{
    const mine = planMatchFor(courses, imp, matched);
    if(!mine){ added.push(imp); return; }
    matched.add(mine.id);
    const fields = changedFields(mine, imp);
    if(fields.length) changed.push({ key: imp.catalogRef.key, course: mine, portal: imp, fields });
  });

  /* Claiming a registration the portal does not show is worth knowing about.
     An Option is a plan, not a claim — those stay quiet. */
  const missing = courses
    .filter(c=>(c.status === "booked" || c.status === "bid") && !matched.has(c.id))
    .map(c=>({ course: c, suggest: "option" }));

  return { added, changed, missing };
}

function changedFields(mine, portal){
  const fields = [];
  const add = (field, label, mineVal, portalVal)=>fields.push({ field, label, mine: mineVal, portal: portalVal });

  if(String(mine.seq || "") !== String(portal.seq || ""))
    add("seq", "Section (sequence)", String(mine.seq || "-"), String(portal.seq || "-"));

  if((mine.room || "") !== (portal.room || "") && portal.room)
    add("room", "Room", mine.room || "", portal.room);

  if(meetingsText(mine) !== meetingsText(portal))
    add("meetings", "Meetings", meetingsText(mine), meetingsText(portal));

  if((mine.weeks || "") !== (portal.weeks || "") && portal.weeks)
    add("weeks", "Weeks", mine.weeks || "", portal.weeks);

  if(mine.status !== "booked")
    add("status", "Status", statusLabel(mine.status), "booked");

  if(portal.detail && !sameDetail(mine.detail, portal.detail))
    add("detail", "Course description", mine.detail ? "(older)" : "(none)", "(from the portal)");

  return fields;
}

function meetingsText(c){
  return (c.slots || []).map(s=>
    DAYS_SHORT[s.day-1] + " " + s.start + "-" + s.end + (s.weeks ? " wk " + s.weeks : "")
  ).sort().join("; ");
}
function sameDetail(a, b){
  if(!a || !b) return false;
  return (a.descriptionEn || "") === (b.descriptionEn || "")
      && (a.descriptionCn || "") === (b.descriptionCn || "")
      && (a.testing || "") === (b.testing || "");
}

/* Build the next courses array. `sel` says what was ticked:
     { added:{key:true}, changed:{key:{room:true,…}}, missing:{courseId:true} }
   Nothing is mutated — every touched course is replaced by a copy. */
function applyScheduleDiff(courses, diff, sel){
  sel = sel || {};
  const selAdded = sel.added || {}, selChanged = sel.changed || {}, selMissing = sel.missing || {};

  const patches = new Map();
  diff.changed.forEach(ch=>{
    const picked = selChanged[ch.key];
    if(!picked) return;
    const taken = ch.fields.filter(f=>picked[f.field]);
    if(taken.length) patches.set(ch.course.id, { portal: ch.portal, fields: taken.map(f=>f.field) });
  });

  let next = courses.map(c=>{
    const patch = patches.get(c.id);
    const downgrade = selMissing[c.id];
    if(!patch && !downgrade) return c;
    const copy = Object.assign({}, c);
    if(patch){
      const p = patch.portal;
      patch.fields.forEach(f=>{
        if(f === "room"){ copy.room = p.room; }
        else if(f === "meetings"){ copy.slots = p.slots.map(s=>Object.assign({}, s)); }
        else if(f === "weeks"){ copy.weeks = p.weeks; }
        else if(f === "status"){ copy.status = "booked"; }
        else if(f === "detail"){ copy.detail = p.detail; }
        else if(f === "seq"){ copy.seq = p.seq; }
      });
    }
    if(downgrade) copy.status = "option";
    return copy;
  });

  const newOnes = diff.added.filter(a=>selAdded[a.catalogRef.key]);
  return newOnes.length ? next.concat(newOnes.map(c=>Object.assign({}, c))) : next;
}
