/* Phase 0 — the snapshot store must never endanger the plan. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { IDBFactory } from "fake-indexeddb";
import { repoRoot, plain } from "./harness.mjs";

/* A fresh in-memory IndexedDB per context, so tests cannot leak into
   each other. `available:false` simulates a browser that blocks it. */
function loadStore({ available = true } = {}){
  const sandbox = {
    console, setTimeout, clearTimeout, Date, JSON, Math, RegExp,
    structuredClone,
  };
  if(available) sandbox.indexedDB = new IDBFactory();
  else Object.defineProperty(sandbox, "indexedDB", {
    get(){ throw new Error("The operation is insecure."); },   // Safari, cookies blocked
  });
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(repoRoot, "js", "store.js"), "utf8"), ctx, { filename:"js/store.js" });
  return ctx;
}

const sampleFile = {
  source: "Tsinghua Info portal", semester: "2026-2027-1", snapshot: "2026-09-22",
  courses: [
    { titleEn:"A New Science of Cities", titleCn:"新城市科学", number:"00000042", seq:"90", credits:2, dept:"School of Architecture", instructor:"龙瀛", time:"4-6(week 1-16)", features:"", remarks:"" },
    { titleEn:"Firm Valuation", titleCn:"公司价值评估", number:"80517022", seq:"0", credits:2, dept:"School of Economics and Management", instructor:"", time:"2-3(week 1-8)", features:"Taught in foreign language", remarks:"" },
  ],
};

test("stores a snapshot and reads it back", async () => {
  const s = loadStore();
  const { record } = s.validateCatalogSnapshot(sampleFile);
  assert.equal(await s.snapshotPut(record), true);
  const back = await s.snapshotGet("catalog");
  assert.equal(back.count, 2);
  assert.equal(back.semester, "2026-2027-1");
  assert.equal(plain(back.rows)[0].titleCn, "新城市科学", "Chinese titles survive the round trip");
});

test("reading a snapshot that was never imported gives null, not an error", async () => {
  const s = loadStore();
  assert.equal(await s.snapshotGet("catalog"), null);
});

test("clearing removes the snapshot", async () => {
  const s = loadStore();
  await s.snapshotPut(s.validateCatalogSnapshot(sampleFile).record);
  assert.equal(await s.snapshotClear("catalog"), true);
  assert.equal(await s.snapshotGet("catalog"), null);
});

test("a browser without IndexedDB degrades quietly instead of throwing", async () => {
  const s = loadStore({ available:false });
  assert.equal(await s.snapshotAvailable(), false);
  assert.equal(await s.snapshotGet("catalog"), null);
  assert.equal(await s.snapshotPut({ id:"catalog", rows:[] }), false);
  assert.equal(await s.snapshotClear("catalog"), false);
});

test("snapshotAvailable is true when the browser can store one", async () => {
  assert.equal(await loadStore().snapshotAvailable(), true);
});

/* Validation happens before any write — this is what protects a good
   snapshot from being replaced by the wrong file. */
test("rejects files that are not a catalog export", () => {
  const s = loadStore();
  for(const input of [null, "text", 42, {}, { courses:"nope" }]){
    assert.equal(s.validateCatalogSnapshot(input).ok, false);
  }
});

test("rejects an empty catalog", () => {
  const r = loadStore().validateCatalogSnapshot({ courses:[] });
  assert.equal(r.ok, false);
  assert.match(r.error, /empty/i);
});

test("rejects a damaged row and says which one", () => {
  const s = loadStore();
  const r = s.validateCatalogSnapshot({ courses:[ sampleFile.courses[0], { titleEn:"No number" } ] });
  assert.equal(r.ok, false);
  assert.match(r.error, /Row 2/);
});

test("a rejected import leaves the existing snapshot untouched", async () => {
  const s = loadStore();
  await s.snapshotPut(s.validateCatalogSnapshot(sampleFile).record);
  const attempt = s.validateCatalogSnapshot({ courses:[] });
  assert.equal(attempt.ok, false);
  assert.equal(attempt.record, undefined, "nothing to write means nothing can be written");
  assert.equal((await s.snapshotGet("catalog")).count, 2);
});

test("a file without a snapshot date still imports, dated today", () => {
  const { ok, record } = loadStore().validateCatalogSnapshot({ courses: sampleFile.courses });
  assert.equal(ok, true);
  assert.match(record.snapshot, /^\d{4}-\d{2}-\d{2}$/);
});
