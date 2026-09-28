"use strict";

/* ============================================================
   Snapshot store (IndexedDB) — everything that was scraped.

   Deliberately separate from the plan:

     localStorage["tsinghua-planner-v1"]  the plan. Small, irreplaceable
                                          (hand-made), never touched here.
     IndexedDB "thu-planner-data"         the catalog snapshot. 1.7 MB,
                                          re-scrapable at any time.

   Why not localStorage for the snapshot: ~5 MB budget per origin and
   synchronous access. A 1.7 MB string would eat a third of it, block the
   main thread on every read, and — worst case — a quota error while
   writing it could take the plan down with it. Separate stores mean a
   full catalog can never damage a plan.

   Why the catalog is not simply shipped with the app: it comes from a
   login-gated portal and is not ours to publish (PLANNING.md, top).
   Everyone imports their own with their own login.

   Every function resolves rather than throws: IndexedDB can be missing
   entirely (private mode, "block all cookies"), and the catalog is a
   nice-to-have — the app must keep working without it.
   ============================================================ */

const SNAPSHOT_DB = "thu-planner-data";
const SNAPSHOT_STORE = "snapshots";
let snapshotDBPromise = null;

function snapshotDB(){
  if(snapshotDBPromise) return snapshotDBPromise;
  snapshotDBPromise = new Promise(resolve=>{
    let req;
    try{ req = indexedDB.open(SNAPSHOT_DB, 1); }
    catch(e){ resolve(null); return; }            // no IndexedDB at all
    req.onupgradeneeded = ()=>{
      const db = req.result;
      if(!db.objectStoreNames.contains(SNAPSHOT_STORE)) db.createObjectStore(SNAPSHOT_STORE, { keyPath:"id" });
    };
    req.onsuccess = ()=> resolve(req.result);
    req.onerror = ()=> resolve(null);             // blocked by the browser
    req.onblocked = ()=> resolve(null);
  });
  return snapshotDBPromise;
}

function snapshotTx(mode, run){
  return snapshotDB().then(db=>{
    if(!db) return null;
    return new Promise(resolve=>{
      let tx;
      try{ tx = db.transaction(SNAPSHOT_STORE, mode); }
      catch(e){ resolve(null); return; }
      const req = run(tx.objectStore(SNAPSHOT_STORE));
      tx.onabort = ()=> resolve(null);            // quota exceeded, for one
      tx.onerror = ()=> resolve(null);
      tx.oncomplete = ()=> resolve(req ? req.result : true);
    });
  }).catch(()=>null);
}

/* One record per source; "catalog" today, "details" later (PLANNING §6).
   Stored as the object it is — structured clone, so reading it back costs
   no JSON.parse of 1.7 MB. */
function snapshotGet(id){ return snapshotTx("readonly", s=>s.get(id)).then(r=>r||null); }
function snapshotPut(record){ return snapshotTx("readwrite", s=>s.put(record)).then(r=>r!==null); }
function snapshotClear(id){ return snapshotTx("readwrite", s=>s.delete(id)).then(r=>r!==null); }

/* Is a snapshot store available at all? Used to phrase the UI honestly:
   "no catalog imported yet" vs. "this browser cannot store one". */
function snapshotAvailable(){ return snapshotDB().then(db=>!!db); }

/* ------------------------------------------------------------
   Validation — an import is rejected *before* anything is written,
   so a wrong file can never replace a good snapshot.
   ------------------------------------------------------------ */

/* Returns {ok:true, record} or {ok:false, error} — never throws. */
function validateCatalogSnapshot(data){
  if(!data || typeof data !== "object") return bad("That file is not a catalog export.");
  if(!Array.isArray(data.courses)) return bad("No “courses” list in that file — is it the catalog JSON from the scraper?");
  if(!data.courses.length) return bad("That catalog is empty.");
  const missing = data.courses.findIndex(c=>!c || !c.number || !c.titleEn && !c.titleCn);
  if(missing >= 0) return bad("Row " + (missing+1) + " has no course number or title — that file looks damaged.");
  return { ok:true, record: {
    id: "catalog",
    source: String(data.source || "Tsinghua Info portal"),
    semester: String(data.semester || ""),
    snapshot: String(data.snapshot || new Date().toISOString().slice(0,10)),
    importedAt: new Date().toISOString(),
    count: data.courses.length,
    rows: data.courses
  }};
}
function bad(error){ return { ok:false, error }; }
