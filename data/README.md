# data/

Two kinds of file live here, and the difference matters.

## Shipped with the app (committed)

| File | Where it comes from |
|---|---|
| `catalog-mba.json` | Built by `tools/build-mba-catalog.py` from the two MBA PDFs. Curated by us — rooms, descriptions, syllabus page numbers. |
| `holidays.json` | Typed out from the academic calendar (`assets/`). |
| `departments.json` | Department names and their portal codes. |
| `README.md` | This file. |

## Never committed

| File | Why not |
|---|---|
| `catalog-portal.json` | ~5,000 rows scraped from the Info portal's "Query courses open this semester". |

The portal sits behind a login. Material behind a login has not been
published by the university, and whether its terms permit republishing it is
unsettled — that is not our call to make. So this file stays out of the public
repository **permanently**, not "for now".

That is not a limitation of the feature, because the app does not need the
file: every user imports their own snapshot with their own login
(**Data & sharing → Import the course catalog**), and it is stored in their
browser (IndexedDB, see `js/store.js`). What we share is the *reader*
(`tools/portal-scrape.js`), not the *data*.

A copy of `catalog-portal.json` in this folder is picked up automatically as a
local development convenience — the app tries it after the imported snapshot
and ignores the 404 on the live site. Handy while working on the catalog;
nothing depends on it.

Passing a snapshot to a fellow exchange student privately (AirDrop, chat) is
fine — they have a portal login too. Publishing it is the part we avoid.
