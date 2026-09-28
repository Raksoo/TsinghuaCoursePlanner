/* The storage rule from CLAUDE.md: there are live users. A saved plan
   from an older version of the app must keep loading, unchanged, and
   load() must never write back. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { parseHTML, DOMParser } from "linkedom";
import { repoRoot, plain, pick } from "./harness.mjs";

const OLD_PLAN = readFileSync(join(repoRoot, "tests", "fixtures", "state-old-v1.json"), "utf8");

/* core.js with a recording localStorage, so we can assert that merely
   loading a plan writes nothing back. */
function loadCore(stored){
  const writes = [];
  const map = new Map();
  if(stored != null) map.set("tsinghua-planner-v1", stored);
  const { window, document } = parseHTML("<!doctype html><html><body><div id='toastHost'></div></body></html>");
  const sandbox = {
    window, document, DOMParser, console,
    setTimeout, clearTimeout, Date, Math, JSON, RegExp, Intl,
    localStorage: {
      getItem: k => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => { writes.push(k); map.set(k, String(v)); },
      removeItem: k => { map.delete(k); },
    },
  };
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(repoRoot, "js", "core.js"), "utf8"), ctx, { filename:"js/core.js" });
  return { ctx, writes, read: (...n)=>pick(ctx, ...n) };
}

test("a plan saved before slot.weeks / overrides / icsSeq existed still loads", () => {
  const { ctx, read } = loadCore(OLD_PLAN);
  ctx.load();
  const s = plain(read("state").state);
  assert.equal(s.courses.length, 2);
  assert.equal(s.courses[0].titleEn, "Digital Economy");
  assert.equal(s.courses[0].slots.length, 1);
  assert.equal(s.goal, 18);
  // Fields the old payload never had come back as harmless defaults.
  assert.deepEqual(s.overrides, {});
  assert.equal(s.courses[0].slots[0].weeks, undefined);
  assert.equal(s.courses[0].slots[0].room, undefined);
});

test("loading a plan writes nothing back to storage", () => {
  const { ctx, writes } = loadCore(OLD_PLAN);
  ctx.load();
  assert.deepEqual(writes, [], "load() must not save — it would rewrite a live user's plan on first open");
});

test("no stored plan at all falls back to the seed courses", () => {
  const { ctx, read, writes } = loadCore(null);
  ctx.load();
  assert.ok(plain(read("state").state).courses.length > 0);
  assert.deepEqual(writes, []);
});

test("a corrupt stored plan does not wipe anything on load", () => {
  const { ctx, read, writes } = loadCore("{not json");
  ctx.load();
  assert.ok(plain(read("state").state).courses.length > 0, "falls back to seeds rather than an empty plan");
  assert.deepEqual(writes, []);
});

test("the storage key is unchanged — live users' plans hang off it", () => {
  const { read } = loadCore(null);
  assert.equal(read("STORE_KEY").STORE_KEY, "tsinghua-planner-v1");
});

/* tools/portal-schedule-scrape.js carries its own copy of BLOCKS, because
   it runs on the portal page where core.js is not loaded. Guard the copy. */
test("the scraper's block times match core.js", () => {
  const { read } = loadCore(null);
  const src = readFileSync(join(repoRoot, "tools", "portal-schedule-scrape.js"), "utf8");
  const literal = /window\.BLOCKS\s*=\s*(\[[\s\S]*?\]);/.exec(src);
  assert.ok(literal, "the scraper should still define BLOCKS");
  const scraperBlocks = plain(vm.runInNewContext("(" + literal[1] + ")"));
  assert.deepEqual(scraperBlocks, plain(read("BLOCKS").BLOCKS));
});

/* The portal page declares charset=gb2312. A classic <script src> with no
   charset of its own is decoded using the *document's* encoding, so any
   non-ASCII byte in a file we inject there comes out as mojibake — and a
   mangled character inside a regex literal is a SyntaxError that silently
   defines nothing. Every file that ends up inside the portal page must
   therefore stay pure ASCII. (Found the hard way, 2026-09-28.) */
test("files injected into the portal page contain no non-ASCII characters", () => {
  for(const rel of ["js/scheduleParse.js", "tools/portal-schedule-scrape.js", "tools/portal-scrape.js"]){
    const src = readFileSync(join(repoRoot, rel), "utf8");
    const offenders = [...new Set([...src].filter(c => c.charCodeAt(0) > 127))];
    assert.deepEqual(offenders, [],
      rel + " must stay ASCII — write non-ASCII as \\uXXXX escapes instead");
  }
});

test("the semester constant matches week 1's date", () => {
  const { read } = loadCore(null);
  const { SEMESTER, WEEK1_MONDAY } = read("SEMESTER", "WEEK1_MONDAY");
  assert.equal(SEMESTER, "2026-2027-1");
  // 2026-2027-1 is the autumn term, so week 1 must fall in autumn 2026.
  assert.equal(WEEK1_MONDAY.getFullYear(), 2026);
  assert.equal(WEEK1_MONDAY.getMonth(), 8, "September");
});

/* The progress panel is injected into the portal page too. */
test("the progress overlay stays ASCII as well", () => {
  const src = readFileSync(join(repoRoot, "js", "portalOverlay.js"), "utf8");
  const offenders = [...new Set([...src].filter(c => c.charCodeAt(0) > 127))];
  assert.deepEqual(offenders, [], "js/portalOverlay.js runs inside the portal's gb2312 page");
});
