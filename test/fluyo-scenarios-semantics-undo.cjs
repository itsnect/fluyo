"use strict";
/* SCENARIOS-SEMANTICS-001 (FASE 1) — Deshace en un texto los cambios de FASE 1 en los archivos servidos (css/styles.css,
   index.html, js/geometry.js, js/model.js, js/render.js, js/ui.js; sw.js solo sube CACHE y lo tratan los propios tests).
   Lo usan los tests de alcance de slices anteriores (FLOW-FADE, HIT-TEST, D6, PRSKIN, 019.4a) para comparar el resto del
   archivo con su base, como fluyo-019-4a-undo.cjs con 019.4a. Cada hunk del parche de FASE 1 (el de 59588a9 sobre ce8e699,
   leído de git, con su contexto) se sustituye por su texto anterior. Si FASE 1 cambia y esto no, los tests de alcance
   antiguos fallan: es lo que se quiere. El alcance de FASE 1 lo vigila test/fluyo-scenarios-semantics-1.test.cjs. */
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const gitRoot = process.env.FLUYO_GIT_ROOT || root;
const FROM = "ce8e699", TO = "59588a9";
const FILES = new Set(["css/styles.css", "index.html", "js/geometry.js", "js/model.js", "js/render.js", "js/ui.js"]);
const cache = new Map();

function hunks(f) {
  if (cache.has(f)) return cache.get(f);
  const diff = execFileSync("git", ["-C", gitRoot, "diff", "-U3", FROM, TO, "--", f], { encoding: "utf8" }).replace(/\r\n/g, "\n").split("\n");
  const out = []; let h = null;
  for (const l of diff) {
    if (l.startsWith("@@")) { h = { old: [], now: [] }; out.push(h); continue; }
    if (!h || l.startsWith("\\")) continue;
    if (l.startsWith(" ")) { h.old.push(l.slice(1)); h.now.push(l.slice(1)); }
    else if (l.startsWith("-")) h.old.push(l.slice(1));
    else if (l.startsWith("+")) h.now.push(l.slice(1));
  }
  const pairs = out.map((x) => [x.now.join("\n"), x.old.join("\n")]);
  cache.set(f, pairs);
  return pairs;
}

function undoSemantics(file, src) {
  const f = file.replace(/\\/g, "/");
  if (!FILES.has(f)) return src;
  return hunks(f).reduce((s, [now, old]) => s.replace(now, () => old), src);
}
module.exports = { undoSemantics };
