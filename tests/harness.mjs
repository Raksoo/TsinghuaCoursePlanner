/* ============================================================
   Test harness for the app's plain <script> modules.

   The app has no build step and no module system: every js/*.js
   file defines globals and is loaded by a <script src> tag in
   dependency order. To test those functions without touching the
   app, this harness evaluates the files in a vm context that
   mimics the browser globals they expect.

   Usage:
     const { slotsFromCode } = loadModules(["core", "parser"]);
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";
import { DOMParser, parseHTML } from "linkedom";

const here = dirname(fileURLToPath(import.meta.url));
export const repoRoot = join(here, "..");

/* Values built inside the vm realm carry that realm's prototypes, which
   assert.deepEqual refuses to match against host-realm literals. Round-trip
   them into plain host objects before asserting. */
export function plain(v){ return JSON.parse(JSON.stringify(v)); }

/* `function foo(){}` in a script becomes a property of the context, but
   top-level `const`/`let` (STORE_KEY, BLOCKS, state, …) live in the global
   lexical scope and are invisible on the context object. Evaluate them by
   name to read those out. */
export function pick(ctx, ...names){
  return vm.runInContext("({" + names.join(",") + "})", ctx);
}

export function fixture(name){
  return readFileSync(join(here, "fixtures", name), "utf8");
}

/* A document from an HTML string — what the app gets from the real
   DOM and the scraper gets from DOMParser. */
export function docFrom(html){
  return new DOMParser().parseFromString(html, "text/html");
}

/* Evaluate js/<name>.js files in one shared context, in the given
   order, and hand back that context. Globals defined by the files
   (functions, consts) are readable straight off the returned object. */
export function loadModules(names){
  const { window, document } = parseHTML("<!doctype html><html><body></body></html>");
  const sandbox = {
    window, document,
    DOMParser,
    console,
    setTimeout, clearTimeout, setInterval, clearInterval,
    Date, Math, JSON, RegExp, Intl,
    // The app guards every storage access in try/catch, so a throwing
    // stub is a faithful stand-in for "storage unavailable".
    localStorage: memoryStorage(),
    fetch: async () => { throw new Error("fetch is not stubbed in this test"); },
  };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  const ctx = vm.createContext(sandbox);
  for(const name of names){
    const src = readFileSync(join(repoRoot, "js", name + ".js"), "utf8");
    // "use strict" at the top of each file would make top-level `const`
    // invisible to later scripts if they ran in separate scopes — they
    // don't here: vm.runInContext shares one global scope, exactly like
    // <script> tags in a page.
    vm.runInContext(src, ctx, { filename: "js/" + name + ".js" });
  }
  return ctx;
}

function memoryStorage(){
  const map = new Map();
  return {
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: k => { map.delete(k); },
    clear: () => map.clear(),
  };
}
