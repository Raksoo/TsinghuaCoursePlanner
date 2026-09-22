# Tsinghua SEM Course Planner

Offline-first course planner for the Tsinghua SEM exchange semester (Fall 2026).
No backend, no login — everything is saved in your browser's local storage.

## Structure

```
index.html       Page skeleton, the five tab panels, all modals
styles.css       All styles incl. print-only layout
PLANNING.md      Roadmap for upcoming feature rounds
CLAUDE.md        Project context / handoff notes for AI-assisted work
assets/          Help screenshots, sample .xls, MBA schedule + syllabus PDFs, academic calendar
data/            holidays.json (week view) and catalog-mba.json (Catalog tab)
tools/           build-mba-catalog.py — regenerates catalog-mba.json from the PDFs in assets/
js/
  core.js        Constants, seed data, state, localStorage load/save, small helpers
  history.js     Undo/redo (every plan change goes through commit())
  calendar.js    Holidays + single moved/cancelled meetings
  parser.js      Copy-paste parser for Tsinghua course-system rows
  weekView.js    Week grid rendering, clash detection, week selector, "current week" badge
  summary.js     Header credit counter, credit-goal bar, status filter toggles
  courseList.js  Sortable course-list table (active courses)
  archive.js     Dropped-courses archive (collapsible, on the Course list tab)
  form.js        Add/edit form, meetings editor, paste/xls import modals + preview
  catalog.js     Catalog tab (MBA exchange list, filters, one-click add)
  xlsImport.js   Reads the course system's "Export to XLS" schedule (no library)
  icsExport.js   .ics (calendar) export + its settings modal
  printView.js   Dedicated print layout
  dataShare.js   Share link, JSON export/import, reset, block legend
  main.js        Tab switching, init(), all event wiring
```

Splitting it up this way means a future change to one feature (say, the .ics export) only
touches `js/icsExport.js` instead of a single multi-thousand-line file.

## Running it locally

No build step needed — serve the folder with any static file server (the app fetches
`data/*.json`, which browsers block for files opened from disk), e.g.:

```
python3 -m http.server 8000
```

## Hosting via GitHub Pages

1. Push this folder to a GitHub repo (public repo needed for GitHub Pages on the free plan).
2. Repo Settings → Pages → Source: deploy from branch `main`, folder `/ (root)`.
3. Share the resulting `https://<username>.github.io/<repo>/` URL — everyone who opens it gets
   their own private, persistent copy of the data in their own browser (localStorage), no login
   required. Pushing an update to the repo updates the app for everyone; existing saved course
   lists in their browsers are preserved.

Note: on GitHub's free plan, a Pages site is reachable by anyone with the link (not indexed,
but not access-restricted either). Restricting Pages visibility to collaborators requires
GitHub Pro/Team/Enterprise.
