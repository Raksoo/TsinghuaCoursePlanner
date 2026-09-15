# Tsinghua SEM Course Planner

Offline-first course planner for the Tsinghua SEM exchange semester (Fall 2026).
No backend, no login — everything is saved in your browser's local storage.

## Structure

```
index.html       Page skeleton, all markup
styles.css       All styles
js/
  core.js        Constants, seed data, state, localStorage load/save, small helpers
  parser.js      Copy-paste parser for Tsinghua course-system rows
  weekView.js    Week grid rendering, clash detection, week selector, "current week" badge
  summary.js     Header credit counter + status filter toggles
  courseList.js  Course-list table (active courses)
  archive.js     Dropped-courses archive (collapsible, on the Course list tab)
  form.js        Add/edit form + paste-preview
  icsExport.js   .ics (calendar) export
  dataShare.js   JSON export/import, print, reset
  main.js        Tab switching, init(), all event wiring
```

Splitting it up this way means a future change to one feature (say, the .ics export) only
touches `js/icsExport.js` instead of a single multi-thousand-line file.

## Running it locally

No build step needed — just open `index.html` in a browser, or serve the folder with any
static file server, e.g.:

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
