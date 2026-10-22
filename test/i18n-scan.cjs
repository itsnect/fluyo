"use strict";
/* FLUYO-I18N-001 — Escáner del texto de la interfaz (sin dependencias). Lo usa test/fluyo-i18n-001.test.cjs; no registra tests.
   · catalog(): las claves en uso y su texto base (español) —llamadas FluyoI18n.t("clave", "texto") de js/*.js y elementos marcados
     data-i18n / data-i18n-<atributo> de index.html y s/index.html—.
   · hardcoded(): cuánto texto humano queda SIN migrar por archivo (heurística: literales de JS con aspecto de frase o de palabra
     con mayúscula; nodos de texto y atributos visibles del HTML sin marca). Es la base del trinquete: puede bajar, nunca subir.
   · unmarked(html, desde, hasta): el texto sin marca de una región ya migrada (debe ser 0).
   Uso: node test/i18n-scan.cjs               → resumen
        node test/i18n-scan.cjs --write-baseline → reescribe test/fluyo-i18n-001-baseline.json (solo al migrar texto) */
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8").replace(/\r\n/g, "\n");
const I18N_FILES = ["js/i18n.js", "js/i18n-en.js"];
const HTML_FILES = ["index.html", "s/index.html"];
const BRAND = /^(Fluyo|flu|yo)$/;
const OWN = /^([^\p{L}\p{N}]*)([\s\S]*?)(\s*)$/u;
/* atributo visible → su marca (la que lee FluyoI18n.applyDom) */
const TEXT_ATTRS = { title: "data-i18n-title", "aria-label": "data-i18n-aria-label", "data-tip": "data-i18n-tip", placeholder: "data-i18n-placeholder", alt: null };

function jsFiles() {
  return fs.readdirSync(path.join(root, "js")).filter((f) => f.endsWith(".js")).map((f) => "js/" + f).filter((f) => !I18N_FILES.includes(f)).sort();
}

/* ───────────── JS: llamadas FluyoI18n.t ───────────── */
const CALL = /FluyoI18n\.t\(\s*(?:"((?:[^"\\]|\\.)*)"|([^,)]*))\s*,\s*(?:"((?:[^"\\]|\\.)*)"|(\{[^{}]*\})|([^,)]*))/g;
function calls(src) {
  const out = [];
  for (const m of src.matchAll(CALL)) {
    const line = src.slice(0, m.index).split("\n").length;
    const key = m[1] !== undefined ? JSON.parse('"' + m[1] + '"') : null;
    let es = null;
    if (m[3] !== undefined) es = JSON.parse('"' + m[3] + '"');
    else if (m[4] !== undefined) es = vm.runInNewContext("(" + m[4] + ")");
    out.push({ key, es, line, raw: m[0] });
  }
  return out;
}

/* ───────────── JS: literales (léxico mínimo: comentarios, cadenas, plantillas y regex) ───────────── */
function strings(src) {
  const res = []; let i = 0, line = 1, last = ""; const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === "\n") { line++; i++; continue; }
    if (c === "/" && src[i + 1] === "/") { while (i < n && src[i] !== "\n") i++; continue; }
    if (c === "/" && src[i + 1] === "*") { i += 2; while (i < n && !(src[i] === "*" && src[i + 1] === "/")) { if (src[i] === "\n") line++; i++; } i += 2; continue; }
    if (c === '"' || c === "'") {
      const l = line; let j = i + 1, s = "";
      while (j < n && src[j] !== c) { if (src[j] === "\\") { s += src[j + 1]; j += 2; continue; } if (src[j] === "\n") line++; s += src[j]; j++; }
      res.push({ s, line: l }); i = j + 1; last = "s"; continue;
    }
    if (c === "`") {
      const l = line; let j = i + 1, s = "", depth = 0;
      while (j < n) {
        const d = src[j];
        if (depth === 0 && d === "`") break;
        if (d === "\\") { s += src[j + 1]; j += 2; continue; }
        if (d === "\n") line++;
        if (depth === 0 && d === "$" && src[j + 1] === "{") { depth = 1; s += " "; j += 2; continue; }
        if (depth > 0) { if (d === "{") depth++; else if (d === "}") depth--; j++; continue; }
        s += d; j++;
      }
      res.push({ s, line: l }); i = j + 1; last = "s"; continue;
    }
    if (c === "/" && (last === "" || last === "kw" || /[=(,:\[!&|?{};+\-*%<>~^]/.test(last))) {
      let j = i + 1, cls = false;
      while (j < n && src[j] !== "\n") { const d = src[j]; if (d === "\\") { j += 2; continue; } if (d === "[") cls = true; else if (d === "]") cls = false; else if (d === "/" && !cls) break; j++; }
      i = j + 1; while (/[a-z]/.test(src[i] || "")) i++; last = "s"; continue;
    }
    if (/\s/.test(c)) { i++; continue; }
    if (/[A-Za-z_$]/.test(c)) { let j = i; while (/[\w$]/.test(src[j] || "")) j++; last = /^(return|typeof|case|in|of|new|delete|void|throw)$/.test(src.slice(i, j)) ? "kw" : "w"; i = j; continue; }
    last = c; i++;
  }
  return res;
}
const ES_CHARS = /[áéíóúñüÁÉÍÓÚÑÜ¿¡«»…—]/;
function looksHuman(raw) {
  const t = raw.replace(/<[^>]+>/g, " ").trim();
  if (t.length < 2 || !/\p{L}/u.test(t)) return false;
  if (/^(https?:|\.{0,2}\/|#|data:|rgba?\(|var\(|\d)/.test(t)) return false;
  if (/^[A-Z_0-9]+$/.test(t) || /^[a-z]+([A-Z][a-z0-9]*)+$/.test(t)) return false;   // enums del modelo, camelCase
  if (ES_CHARS.test(t)) return true;
  if (/^[a-z0-9_.\-:\/\[\]="'#>+~* ,()]+$/.test(t)) return false;                       // selectores, clases, claves
  if (/[A-Za-z]{2,}\s+[A-Za-z]{2,}/.test(t)) return /^[A-Z]/.test(t);                     // frase
  return /^[A-Z][a-z]{2,}$/.test(t);                                                       // «Guardar», «Nodo»
}
/* El texto por defecto de una llamada FluyoI18n.t ya está migrado: no cuenta. */
function jsHardcoded(src) {
  const clean = src.replace(CALL, "FluyoI18n.t(0,0");
  return strings(clean).filter((x) => looksHuman(x.s));
}

/* ───────────── HTML ───────────── */
const VOID = new Set(["input", "img", "br", "hr", "meta", "link", "source", "wbr", "col", "area", "base", "param", "track", "embed"]);
const decode = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
function attrsOf(s) { const a = {}; for (const m of s.matchAll(/([\w:-]+)(?:\s*=\s*"([^"]*)")?/g)) a[m[1]] = m[2] === undefined ? "" : decode(m[2]); return a; }
/* Recorre el HTML (sin <script>, <style> ni comentarios): marcas data-i18n* y texto visible sin marca. */
function scanHtml(html) {
  const src = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");
  const marks = [], issues = [], stack = [];
  for (const m of src.matchAll(/<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>|([^<]+)/g)) {
    if (m[5] !== undefined) {
      const text = decode(m[5]);
      if (!/[\p{L}\p{N}]/u.test(text) || !stack.length) continue;
      const top = stack[stack.length - 1];
      if (top.name === "svg" || stack.some((e) => e.name === "svg" && e.attrs["aria-hidden"] === "true")) continue;
      const body = text.replace(OWN, "$2");
      if (top.attrs["data-i18n"] !== undefined && !top.seen) { top.seen = true; marks.push({ key: top.attrs["data-i18n"], es: body, where: "text" }); continue; }
      if (BRAND.test(body.trim())) continue;
      issues.push({ kind: "text", owner: top.name + (top.attrs.id ? "#" + top.attrs.id : ""), text: body.trim() });
      continue;
    }
    const [, close, name, rest, self] = m;
    const tag = name.toLowerCase();
    if (close) { while (stack.length && stack.pop().name !== tag); continue; }
    const attrs = attrsOf(rest);
    for (const [a, mark] of Object.entries(TEXT_ATTRS)) {
      if (attrs[a] === undefined || !/\p{L}/u.test(attrs[a])) continue;
      const k = mark ? attrs[mark] : undefined;
      if (k !== undefined) marks.push({ key: k, es: attrs[a], where: a });
      else if (!BRAND.test(attrs[a].trim())) issues.push({ kind: a, owner: tag + (attrs.id ? "#" + attrs.id : ""), text: attrs[a] });
    }
    if (!self && !VOID.has(tag)) stack.push({ name: tag, attrs });
  }
  return { marks, issues };
}
const region = (html, from, to) => { const a = html.indexOf(from), b = html.indexOf(to, a); if (a < 0 || b < 0) throw new Error("región no encontrada: " + from); return html.slice(a, b); };
const unmarked = (file, from, to) => scanHtml(region(read(file), from, to)).issues;

/* ───────────── Catálogo y recuento ───────────── */
function catalog() {
  const uses = [];
  for (const f of jsFiles()) for (const c of calls(read(f))) uses.push({ file: f, line: c.line, key: c.key, es: c.es, raw: c.raw });
  for (const f of HTML_FILES) for (const mk of scanHtml(read(f)).marks) uses.push({ file: f, line: 0, key: mk.key, es: mk.es, raw: mk.where });
  const callCount = Object.fromEntries(jsFiles().map((f) => [f, (read(f).match(/FluyoI18n\.t\(/g) || []).length]));
  return { uses, callCount };
}
function hardcoded() {
  const js = {}, html = {};
  for (const f of jsFiles()) { const n = jsHardcoded(read(f)).length; if (n) js[f] = n; }
  for (const f of HTML_FILES) html[f] = scanHtml(read(f)).issues.length;
  return { js, html };
}
const placeholders = (s) => [...String(typeof s === "object" ? Object.values(s).join(" ") : s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

module.exports = { read, jsFiles, calls, strings, looksHuman, jsHardcoded, scanHtml, unmarked, catalog, hardcoded, placeholders, BASELINE: "test/fluyo-i18n-001-baseline.json" };

if (require.main === module) {
  const h = hardcoded(), c = catalog();
  const keys = new Set(c.uses.map((u) => u.key));
  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  console.log(`claves en uso: ${keys.size} · usos: ${c.uses.length}`);
  console.log(`texto sin migrar · JS: ${sum(h.js)} en ${Object.keys(h.js).length} archivos · HTML: ${sum(h.html)}`);
  for (const [f, n] of Object.entries(h.js).sort((a, b) => b[1] - a[1])) console.log(String(n).padStart(5), f);
  for (const [f, n] of Object.entries(h.html)) console.log(String(n).padStart(5), f);
  if (process.argv.includes("--write-baseline")) {
    fs.writeFileSync(path.join(root, module.exports.BASELINE), JSON.stringify(h, null, 2) + "\n");
    console.log("línea base reescrita: " + module.exports.BASELINE);
  }
}
