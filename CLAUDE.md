# Tsinghua SEM Course Planner — Project Context

Handoff context for continuing work with Claude Code. Keep this file current:
update it at the end of every feature round (a stale version of it cost a
full re-derivation once already). Last updated: 2026-09-22 (after phases 1–4).

## What this is

A single-purpose, offline-first web app for planning course selection during
Oskar's exchange semester at Tsinghua University SEM (Fall 2026, Sep 14 2026 –
Jan 17 2027). No backend, no login — everything is saved in the browser's
`localStorage`. Shared with fellow exchange students via one URL; each gets a
private, persistent copy of the data in their own browser.

**Live URL:** https://raksoo.github.io/TsinghuaCoursePlanner/
(GitHub Pages, free plan, public repo — `git push` to `main` deploys.)

## Product scope (decided 2026-09-21 — do not re-litigate)

**The app is a planner, not a calendar.** Pipeline: browse catalog → build
plan → check clashes/credits → export `.ics` → the phone's calendar runs the
semester. Rejected as calendar territory: own notifications, walking-time
warnings, personal non-course events, exam-date management, drag & drop of
events. Also rejected: a Learning-Agreement tracker (the existing credit-goal
bar stays as is). Judge new ideas by "does it remove planning work?".

**Roadmap lives in [PLANNING.md](PLANNING.md)** — six phases (Undo ✅ →
holidays + moved meetings ✅ → ICS ✅ → MBA catalog ✅ → portal catalog ◐ (app
side done, snapshot pending) → mobile),
with design decisions, data formats, a consolidated backlog and acceptance
criteria. Read it before starting any of those features.

**Storage rule (there are live users):** `STORE_KEY` stays
`tsinghua-planner-v1`; new state fields are optional with defaults in
`load()`; never rename or restructure existing fields; `load()` never writes
back. Test every phase by loading an old-shape payload from localStorage.

**Data files are JSON under `data/`**, loaded with `fetch()` — so develop
over http (`.claude/launch.json` → "planner" on :8765, or `python3 -m
http.server`), never `file://`.

**Cache busting:** every `<script src>`/stylesheet in `index.html` carries
`?v=<date+letter>`. Bump it in one go (search-replace) on every deploy that
changes JS/CSS — GitHub Pages caches assets ~10 min and a half-updated mix
of old `main.js` + new HTML throws `ReferenceError`s on load.

## Architecture decisions (and why)

- **No backend / no database.** GitHub Pages + `localStorage` over a Claude
  Artifact with a `db` capability, because viewers must not need a login.
  `localStorage` persists across sessions/restarts — "no backend" does not
  mean "data disappears".
- **Public repo, free Pages plan.** Private-repo Pages are still publicly
  reachable on the free plan; course-schedule data is not sensitive.
- **Multi-file, no build step, no framework.** Plain `<script src>` tags in
  dependency order. Edits should touch one small module, not a monolith.
- **Portal catalog = offline snapshot, never a live crawler.** The course
  portal (`zhjwe.cic.tsinghua.edu.cn`) is login-gated and CORS-blocked; the
  app is static. See PLANNING.md phase 5 and `_Archive/Feature_Crawler/`
  (untracked; screenshot + HTML dump of the portal).

## Repo structure

```
index.html       Page skeleton, 5 tab panels (week, list, catalog, add, data), all modals
styles.css       All styles incl. print-only layout and the few mobile breakpoints
PLANNING.md      Roadmap + backlog for the next feature rounds (read before building)
data/
  holidays.json      University holidays (one entry per date), curated from the academic calendar
  catalog-mba.json   MBA exchange-list catalog (15 courses + add/drop deadlines), generated
  catalog-portal.json  OPTIONAL portal snapshot (~5,000 rows) — absent until Oskar runs the scraper
tools/
  build-mba-catalog.py  Rebuilds catalog-mba.json from the two PDFs (pdfplumber); the schedule
                        grid, short descriptions and notes are transcribed by hand inside it
  portal-scrape.js      Paste into the browser console on the portal's "Query courses open this
                        semester" page (logged in) → downloads catalog-portal.json. Reads the
                        page's embedded `var gridData = […]`; throttled; resumable
assets/          Help screenshots, sample .xls, the two MBA PDFs, academic calendar PNG
                 (see assets/README.md)
_Archive/        Untracked (.gitignore): old files, portal dump, JSON exports
.claude/launch.json  "planner" = python http.server on :8765 for the browser preview
js/
  core.js        Constants (BLOCKS, CLASS_SCHEDULE, DAYS, STATUS, WEEK1_MONDAY,
                 TOTAL_WEEKS, STORE_KEY), seedCourses(), state, load()/save(),
                 helpers ($, el, toMin, fmtMin, uid, parseWeeks, dateFor, weekDates,
                 dayDate, currentSemesterWeek, statusLabel, slotText, toast)
  history.js     Undo/redo: commit(label, {courses?, overrides?}) is the ONLY way to
                 change the plan (snapshot stack, in memory only); undo()/redo(),
                 toastUndo(), ↶↷ header buttons, ⌘Z/⌘⇧Z handler
  calendar.js    Holidays (loadHolidays → HOLIDAYS, holidayOn, holidayLabelForWeek) and
                 per-meeting overrides (overrideFor/setOverride/clearOverride,
                 affectedMeetings, the "Holidays & moved meetings" box, the Move modal)
  parser.js      Paste parser for portal rows: block codes "2-6(week 1-16)" via
                 slotsFromCode(), free-text guessing for title/instructor/dept/lang
  weekView.js    Week grid (absolute-positioned events, overlap columns), holiday
                 columns + moved/cancelled badges, "Move…" per event, clash detection
                 (findClashes), week selector, "Now: Week X" badge
  summary.js     Header credit counter, credit-goal bar, status filter chips
  courseList.js  Course-list table (active courses), sortable columns, week strips,
                 deleteCourseWithConfirm() (no confirm dialog any more — Undo instead)
  archive.js     Dropped-courses archive (Restore → option / Delete)
  form.js        Add/edit form, "Meetings" slot-row editor (block or custom time),
                 paste + xls modals, shared import preview with "Add selected"
  xlsImport.js   Reads the portal's "Export to XLS" (binary BIFF8, no library):
                 OLE2 container → BIFF records → SST → day×period grid → courses
  catalog.js     Catalog tab: lazy fetch of catalog-mba.json (+ catalog-portal.json if present),
                 mergeCatalogSources() by course number, search/filters (source, programme,
                 dept, weekday, block, "Fits my plan"), cards with clash hints, "Show more"
                 paging, addFromCatalog() (id cat-<key>, key = number or number-seq)
  icsExport.js   icsOccurrences() (holidays skipped, overrides on their new date), buildICS(),
                 deliverICS() (Web Share on phones, download elsewhere), settings modal with
                 live "N events · M skipped" summary; state.icsSeq bumps SEQUENCE per export
  printView.js   Separate print-only timetable (normal flow, page-break safe)
  dataShare.js   JSON export/import, share link (#plan=base64), reset, storage note,
                 block legend table
  main.js        Tabs, init(), all event wiring, keyboard (Escape closes modals)
```

Load order (plain scripts): `core` → `history` → `calendar` → `parser` →
`weekView` → `summary` → `courseList` → `archive` → `form` → `catalog` →
`xlsImport` → `icsExport` → `printView` → `dataShare` → `main`.

**Per-slot weeks:** never call `parseWeeks(c.weeks)` to decide when a
meeting happens — use `slotWeeks(c, slot)` / `courseEvents(c)[i].weeks`.
`c.weeks` stays the union for list/strip/sort.

**Mutation rule:** never assign `state.courses`/`state.overrides` or mutate a
course object in place outside `load()`. Build a new array/object and call
`commit(label, {courses, overrides})` — that saves, re-renders and makes the
change undoable. Follow with `toastUndo(msg)`.

## Data model

```js
// One course:
{
  id: "c1a2b3c",              // uid(); "seed-…" for the 4 starting courses
  titleEn, titleCn,
  number: "70511131", seq: "1",   // course number + sequence (section); seq is never
                                  // hand-typed — only parser/import set it
  credits: 1,
  instructor, dept, lang, room,
  weeks: "1-3,5",              // semester weeks (1-18), parsed by parseWeeks(). This is the
                               // UNION over all slots; a slot may carry its own `weeks`
  status: "booked",            // booked | bid | option | out ("Dropped" in the UI)
  slots: [ {day: 1, start: "08:00", end: "11:25", block: 1, weeks: "1-8"} ],
                               // one entry per weekly meeting; block optional (custom times),
                               // weeks optional (only when this meeting differs from the
                               // course's) — always read via slotWeeks(course, slot)
  note: "...",
  catalogRef: { source: "mba", key: "80517022" }   // only on courses added from the catalog;
                                                   // such courses have id "cat-<number>"
}

// App state — localStorage key "tsinghua-planner-v1":
{
  courses: [...],
  visible: { booked: true, bid: true, option: true, out: false },  // week-grid filter
  week: 1,                     // selected week, or "all" for the max-load view
  goal: 20,                    // credit goal (0 = off); drives the header bar
  overrides: {                 // optional; single meetings moved/cancelled — courses untouched
    "seed-chinese|0|3": { movedTo: "2026-10-10", start: "13:30", end: "16:05", note: "" }
    //  courseId|slotIdx|week → no movedTo = cancelled (no make-up)
  },
  icsSeq: 3                    // optional; export counter → SEQUENCE in the .ics
}
// Also in localStorage: "tsinghua-planner-seen-intro" = "1" once the welcome modal was dismissed.
```

New fields must stay optional — existing users' stored plans and shared
links must keep loading unchanged.

**Tsinghua block notation** `weekday-block`, e.g. `4-2` = Thursday, block 2:

| Block | Time |
|---|---|
| 1 | 08:00–09:35 |
| 2 | 09:50–12:15 |
| 3 | 13:30–15:05 |
| 4 | 15:20–16:55 |
| 5 | 17:05–18:40 |
| 6 | 19:20–21:45 |

MBA courses often use custom times instead (08:00–11:25, 13:30–16:55,
19:00–22:00) — the schedule PDF, not the block table, is authoritative for them.

## Seed courses

`seedCourses()` in `js/core.js`: Digital Economy (CHEN Yubo), Frontiers of
Chinese Contemporary Issues Research (HE Ping), Leadership in A New Era (HU
Jia), Elementary Chinese B (ZHU Wentao). Initial state and "Reset everything"
target.

`seed-leadership` weeks were corrected to `1-3,5-16` (per the MBA schedule
PDF) on 2026-09-22; it meets Wednesday 19:00–22:00.

## Semester calendar facts (from assets/Tsinghua academic calendar.png)

Week 1 = Mon Sep 14 2026, 18 weeks, winter break from Jan 18 2027. Holidays
inside the semester (in `data/holidays.json`): Sep 25 (Fri, W2, Mid-Autumn),
Oct 1–7 (Thu/Fri W3 + Mon–Wed W4, National Day), Jan 1 2027 (Fri, W16). The
MBA schedule PDF already skips week 4 (`Week 1-3,5`); the Language Centre's
Chinese courses (Fri, weeks 1–12) hit Sep 25 and Oct 2. The app warns and
lets the user move/cancel a single meeting — it never edits course data.

## Feature inventory (what exists today)

Week view: single week / "All weeks · max load", status chips with CP counts,
clash box, "Holidays & moved meetings" box (per week; collapsed semester
list in all-weeks mode), holiday columns (hatched, red header), per-meeting
"Move…" (moved/cancelled badges), fixed "Now: Week X of 18" badge (click =
jump). Catalog: MBA list with search, programme/weekday filters, "Fits my
plan", clash hints, syllabus links, one-click add. Global: Undo/Redo buttons
in the header + ⌘Z.
Course list: sortable table, inline status select, week strips, click-row-to-
edit, dropped-courses archive. Add/edit: one form for both, meetings editor
(block dropdown or custom time), paste-from-portal modal with screenshot help,
.xls schedule import modal, preview table with editable weeks/CP for xls
imports, duplicate check by number+seq. Data & sharing: share link, JSON
export/import, .ics export modal (week range, per-course checkboxes,
description fields, optional Apple travel block + reminder), print modal
(dedicated landscape layout), reset, block legend. Welcome/help modal on first
visit (only "Got it" closes it).

## Verified behaviours worth knowing

- `.ics` times are converted Beijing (UTC+8, no DST) → UTC per event; UIDs are
  `courseId-slotIdx-wN` and therefore stable per course id; holidays are
  skipped (toggle) and moved meetings land on their new date with the same
  UID. Untested so far: the iOS share-sheet path on a real iPhone.
- Catalog facts worth knowing: the syllabus says 2 CP for Digital Economy
  (seed says 1); the schedule and the syllabus swap the instructors of
  Pre-intermediate and Intermediate Chinese. Both are in the catalog notes.
- Mobile (375 px, checked 2026-09-22): usable but not designed for it —
  header takes ~40 % of the screen, tabs wrap, week grid scrolls sideways,
  course table is 1320 px wide. Mobile work is PLANNING.md phase 6 and must
  leave desktop pixel-identical.
- `fetch()` of local files fails on `file://` in Chrome — serve the folder
  (`python3 -m http.server 8000`) when the catalog JSON lands.

## Development & deployment

```bash
python3 -m http.server 8000     # local; no build step
git add -A && git commit -m "…" && git push   # deploys via GitHub Pages in < 1 min
```

Code pushes never touch users' stored plans — only the app code updates.

Testing so far is ad hoc: drive the live/local page with Playwright or the
Claude browser tools (tabs, DOM state, `buildICS()` via page.evaluate, PDF
render for print). A committed Playwright suite is a nice-to-have in
PLANNING.md.
