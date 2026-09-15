# Tsinghua SEM Course Planner — Project Context

This file is a full handoff of context for continuing work on this project with
Claude Code (or any other tool). Drop it in the repo root as `CLAUDE.md` (or
just keep it alongside the project) so a fresh session has everything it needs
without re-deriving it.

## What this is

A single-purpose, offline-first web app for planning course selection during
Oskar's exchange semester at Tsinghua University SEM (Fall 2026, Sep 14 2026 –
Jan 17 2027). No backend, no login — everything is saved in the browser's
`localStorage`. Built to be shared with fellow exchange students: they open
the same URL, each gets their own private, persistent copy of the data in
their own browser.

**Live URL:** https://raksoo.github.io/TsinghuaCoursePlanner/
(hosted via GitHub Pages, free plan, public repo)

## Architecture decisions (and why)

These were deliberated explicitly, worth preserving so they aren't
re-litigated:

- **No backend / no database.** Considered a Claude Artifact with a `db`
  capability (real shared backend, per-user private storage) vs. plain GitHub
  Pages + `localStorage`. Went with GitHub Pages because: (a) no login needed
  — Claude Artifacts would require viewers to have a Claude account; (b)
  `localStorage` genuinely persists across browser sessions/restarts (it is
  *not* like `sessionStorage` — this was a point of confusion worth noting
  for anyone revisiting the decision) so "no backend" does not mean "data
  disappears."
- **GitHub Pages, free plan, public repo.** Free plan Pages sites built from
  private repos are still publicly reachable by anyone with the link (not
  access-restricted, just unlisted) — private Pages visibility requires
  GitHub Pro/Team/Enterprise. For course-schedule data this tradeoff was
  judged acceptable.
- **Multi-file structure instead of one HTML file.** The original prototype
  (built as a single self-contained HTML artifact) was split into
  `index.html` + `styles.css` + per-feature JS modules specifically so that
  future edits touch one small file instead of requiring a full read/write of
  a multi-thousand-line document. This was the single biggest pain point that
  triggered the rewrite.
- **No build step.** Plain `<script src="...">` tags in dependency order, no
  bundler, no framework. Deliberate — this is a small hobby tool, a build
  step would be pure overhead.

## Repo structure

```
index.html       Page skeleton, all markup, the ICS-export modal, print-sheet mount point
styles.css       All styles, incl. the ICS modal, archive, now-badge, and print-only layout
js/
  core.js        Constants (BLOCKS, DAYS, STATUS, WEEK1_MONDAY, TOTAL_WEEKS), seed data,
                 state object, localStorage load()/save(), generic helpers ($, el, toMin,
                 fmtMin, uid, parseWeeks, dateFor, weekDates, dayDate, currentSemesterWeek,
                 statusLabel, slotText, toast)
  parser.js      Copy-paste parser for Tsinghua course-system rows (block-code format
                 like "2-6(week 1-16)" plus free-text field guessing for title/instructor/dept)
  weekView.js    Week grid rendering (screen), clash detection, week selector, the
                 fixed-corner "current week" badge
  summary.js     Header credit counter (CP totals) + status filter toggle buttons
  courseList.js  Course-list table (active courses only — dropped ones live in the archive);
                 clicking a row (except on a control) opens it for editing
  archive.js     Dropped-courses archive: collapsible section under the course list,
                 with Restore (→ status "option") and Delete buttons
  form.js        Add/edit form (same form serves both — dynamic lead text says which),
                 the "Meetings" slot-row editor, and the paste-preview UI
  icsExport.js   .ics (iCalendar) generation + the export settings modal (week range +
                 per-course checkboxes)
  printView.js   Dedicated print layout — NOT a reuse of the screen grid, see below
  dataShare.js   JSON export/import, reset-to-seed, storage-availability note, block legend
  main.js        Tab switching, init(), all event-listener wiring, the "now" badge click handler
```

Load order in `index.html` matters (plain scripts, no modules): `core.js` →
`parser.js` → `weekView.js` → `summary.js` → `courseList.js` → `archive.js` →
`form.js` → `icsExport.js` → `printView.js` → `dataShare.js` → `main.js`.

## Data model

```js
// One course:
{
  id: "c1a2b3c",              // uid(), or "seed-xxx" for the 4 starting courses
  titleEn: "...", titleCn: "...",
  number: "70511131", seq: "1",     // course number + sequence (e.g. section)
  credits: 1,
  instructor: "CHEN Yubo", dept: "...", lang: "English",
  room: "Rm. A201, Jianhua Bldg.",
  weeks: "1-3,5",              // semester weeks (1-18) this course runs in — parsed by parseWeeks()
  status: "booked",            // one of: booked | bid | option | out ("Dropped" in the UI)
  slots: [ {day: 1, start: "08:00", end: "11:25", block: 1} ],  // one entry per weekly meeting
  note: "..."
}

// App state (persisted to localStorage under key "tsinghua-planner-v1"):
{
  courses: [ /* array of the above */ ],
  visible: { booked: true, bid: true, option: true, out: false },  // which statuses show on the week grid
  week: 1   // currently selected semester week, or the string "all" for the combined view
}
```

**Tsinghua block-time notation** (`weekday-block`, e.g. `4-2` = Thursday,
block 2): first digit = weekday (1=Monday), second digit = one of 6 blocks
per day:

| Block | Time (approx.) |
|---|---|
| 1 | 08:00–09:35 |
| 2 | 09:50–12:15 |
| 3 | 13:30–15:05 |
| 4 | 15:20–16:55 |
| 5 | 17:05–18:40 |
| 6 | 19:20–21:45 |

The paste-parser (`js/parser.js`) reads the combined format
`2-6(week 1-16)` = weekday 2, block 6, weeks 1–16.

## Starting (seed) courses

Hardcoded in `js/core.js` → `seedCourses()`. Four courses: Digital Economy
(CHEN Yubo), Frontiers of Chinese Contemporary Issues Research (HE Ping),
Leadership in A New Era (HU Jia), Elementary Chinese B (ZHU Wentao). Used both
as the initial state on first load and as the "Reset to starting courses"
target.

## ⚠️ Open item, not yet resolved

`seed-leadership` ("Leadership in A New Era") has **conflicting week ranges**
between sources: the elective list said week 5–14, the official MBA PDF
schedule said week 1-3,5-16. Currently coded as `weeks: "5-14"` with a note
field flagging the discrepancy. **Needs checking against the real schedule
before the semester progresses far enough for it to matter**, then update the
`weeks` field on that course (either by editing `seedCourses()` for future
resets, or just editing the course directly in the running app).

## Feature history

**Round 1 (initial multi-file split):**
1. `.ics` calendar export (for Android/Google Calendar) — Beijing time
   (UTC+8, no DST) converted explicitly to UTC per event so it displays
   correctly regardless of the viewer's device timezone.
2. Saving a course (manual form or paste-parser bulk-add) now jumps to the
   Week view tab automatically.
3. Dropped-course archive: courses with status "Dropped" move out of the
   main course list into a collapsible archive section (Restore/Delete).
4. "Now: Week X of 18" badge fixed in the bottom-right corner, click to jump
   the week selector to today's semester week.
5. Widened the "Course" column in the course-list table (previously
   effectively ~90px because of other fixed-width columns eating a
   1020px-min-width table; now ~370px+ on a 1320px-min-width table).

**Round 2 (refinements after real-world use):**
1. `.ics` export now opens a **settings modal** first — pick a week range
   (from/to dropdowns, plus "All weeks"/"Current week" quick buttons) and
   which individual courses to include (checkboxes, "Select all/none").
   Previously it exported directly using whatever the screen's visibility
   toggles happened to show.
2. **Print view completely rebuilt.** The original approach reused the
   on-screen week grid (which positions events with `position:absolute` for
   pixel-accurate time placement) for printing — this cut off day columns
   past the page width and sliced events in half across page breaks (see the
   PDF Oskar sent showing exactly this). Replaced with `js/printView.js`: a
   separate, print-only layout built with normal document flow (one column
   per day, events stacked in chronological order, `page-break-inside:avoid`
   per event card, forced landscape via `@page{size:landscape}`). No longer
   shares any DOM/CSS with the interactive grid.
3. Course-list rows (and archive rows) are now clickable anywhere (except on
   the status `<select>` or action buttons) to open the course for editing —
   previously only the explicit "Edit" button worked.
4. Add/edit page clarity: tab renamed "Add / edit courses"; the lead
   paragraph above the form is now dynamic — "Editing "X". Change any field
   and click Save course, or Delete course to remove it." when editing, vs.
   the original explanatory text when adding new. The paste-parser panel is
   now wrapped in a `<details open>` (collapsible, smaller textarea:
   96px vs. the original 150px min-height) and the two-column layout gives
   more width to the form column (`grid-template-columns:
   minmax(260px,0.85fr) 1.15fr` instead of an even `1fr 1fr` split).
5. "Meetings" section now has explanatory copy: one row = one recurring
   weekly time slot (a course meeting Monday *and* Wednesday needs two
   rows); "Apply block code" **replaces** all rows rather than adding to
   them; and a highlighted note clarifies that the "Weeks" field applies to
   every meeting together, not per-row.

## Deployment workflow (GitHub Pages)

Repo is already live and public. After any code change:

```bash
git add -A
git commit -m "..."
git push
```

GitHub Pages rebuilds automatically (usually under a minute) — no separate
deploy step, no Pages settings to touch again. Existing users' saved course
lists (in their own browsers' `localStorage`) are untouched by a code push;
only the app code updates for them on next load.

To run locally during development: no build step needed, just open
`index.html` directly, or serve the folder (`python3 -m http.server 8000`)
to avoid any `file://` quirks with `localStorage` in some browsers.

## Testing approach used so far

No test framework — verification was done ad hoc with Playwright
(`chromium.launch({ executablePath: '/opt/pw-browsers/.../chrome' })` in the
build sandbox) driving the page: clicking through tabs, checking DOM state
after actions (row counts, active panel, modal visibility), calling
`buildICS()` directly via `page.evaluate` to sanity-check generated calendar
data, and rendering to PDF (`page.pdf({ landscape: true })`) to visually
verify the print layout. Worth setting up something similar (or a simple
Playwright test file kept in the repo) if this project keeps growing.

## Possible next steps (not requested yet, just visible gaps)

- The `seed-leadership` week-range discrepancy above.
- No automated tests committed to the repo (verification so far was one-off).
- No favicon (harmless 404 in the console on every load).
- The .ics export always regenerates UIDs per (course, slot-index, week) —
  fine for one-off imports, but re-importing an updated export won't dedupe
  against a previously imported one in most calendar apps (each import
  creates fresh copies). Not an issue unless someone wants incremental sync.
