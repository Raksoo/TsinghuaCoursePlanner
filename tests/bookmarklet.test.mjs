/* The pop-up rule, guarded.

   A browser only allows window.open while a user gesture is running, and the
   gesture is over the moment anything is awaited. The bookmarklet therefore
   has to open the planner BEFORE it injects the scraper — opening it at the
   end of a scrape is what made Safari block the tab and fall back to a
   download. This is invisible in the UI and easy to undo by accident, so it
   is pinned here. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { parseHTML, DOMParser } from "linkedom";
import { repoRoot } from "./harness.mjs";

function loadPortalImport(){
  const { window, document } = parseHTML("<!doctype html><html><body><div id='toastHost'></div></body></html>");
  const sandbox = {
    window, document, DOMParser, console, location: { origin:"https://example.test", pathname:"/planner/", search:"" },
    setTimeout, clearTimeout, Date, Math, JSON, RegExp, Intl,
    localStorage: { getItem:()=>null, setItem(){}, removeItem(){} },
    fetch: async () => { throw new Error("no network"); },
    history: { replaceState(){} },
  };
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  for(const name of ["core", "store", "parser", "scheduleParse", "scheduleImport", "catalog", "portalImport"]){
    vm.runInContext(readFileSync(join(repoRoot, "js", name + ".js"), "utf8"), ctx, { filename:name });
  }
  return ctx;
}

const ctx = loadPortalImport();
const href = kind => vm.runInContext(
  'bookmarkletHref(PORTAL_IMPORTS["' + kind + '"])', ctx);

for(const kind of ["schedule", "catalog"]){
  test(`the ${kind} bookmarklet opens the planner before loading anything`, () => {
    const code = href(kind);
    const open = code.indexOf("window.open(");
    const inject = code.indexOf("createElement('script')");
    assert.ok(open > -1, "it must open the planner itself");
    assert.ok(inject > -1, "and inject the scraper");
    assert.ok(open < inject,
      "window.open must come FIRST — after an await the user gesture is gone and the browser blocks it");
  });

  test(`the ${kind} bookmarklet hands the window over and says which import it is`, () => {
    const code = href(kind);
    assert.match(code, /window\.__thuPlanner\s*=/, "the scraper picks the window up from here");
    assert.ok(code.includes("?import=" + kind), "the planner needs to know what is coming");
  });

  test(`the ${kind} bookmarklet survives a browser that refuses to open it`, () => {
    const code = href(kind);
    assert.match(code, /catch\(e\)\s*\{\s*window\.__thuPlanner\s*=\s*null/,
      "blocked must be distinguishable from 'never tried'");
  });
}

test("the bookmarklet is a single javascript: URL with no line breaks", () => {
  const code = href("schedule");
  assert.ok(code.startsWith("javascript:"));
  assert.ok(!/[\r\n]/.test(code), "a bookmark cannot hold newlines");
});

/* The scrapers must use the handed-over window rather than opening their
   own after the work is done. */
for(const tool of ["portal-schedule-scrape.js", "portal-scrape.js"]){
  test(`${tool} uses the window the bookmarklet opened`, () => {
    const src = readFileSync(join(repoRoot, "tools", tool), "utf8");
    assert.match(src, /"__thuPlanner" in window/,
      "an absent key means console use; a null value means the browser blocked it");
    const useIdx = src.indexOf('"__thuPlanner" in window');
    const ownOpen = src.indexOf("window.open(", useIdx);
    assert.ok(ownOpen > useIdx, "opening one itself is only the console fallback");
  });
}

/* Cancelling a running scrape from the planner tab. */
for(const tool of ["portal-schedule-scrape.js", "portal-scrape.js"]){
  const src = readFileSync(join(repoRoot, "tools", tool), "utf8");

  test(`${tool} listens for a cancel from the planner`, () => {
    assert.match(src, /kind === "thu-cancel"/, "the planner asks it to stop");
    assert.match(src, /planner && planner\.closed/,
      "and closing the planner counts too — there would be nowhere to send the result");
  });

  test(`${tool} checks for the cancel inside its loop, not only at the end`, () => {
    const loop = /for\s*\(/.exec(src);
    assert.ok(loop, "it has a loop to interrupt");
    assert.match(src, /cancelRequested\(\)/, "and asks whether to stop while running");
  });

  test(`${tool} confirms the stop instead of going quiet`, () => {
    assert.match(src, /tellCancelled\(/, "the planner needs to know it really stopped");
  });
}

test("a cancelled catalog run can be picked up again", () => {
  const src = readFileSync(join(repoRoot, "tools", "portal-scrape.js"), "utf8");
  const cancelBlock = src.slice(src.indexOf("if(cancelRequested())"), src.indexOf("let data;"));
  assert.match(cancelBlock, /sessionStorage\.setItem/,
    "four minutes of scraping should not be thrown away by a cancel");
  assert.match(cancelBlock, /resume:true/, "and the message should say how to continue");
});
