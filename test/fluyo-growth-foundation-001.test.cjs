"use strict";
/* FLUYO-GROWTH-FOUNDATION-001 — contrato de eventos, privacidad del payload y decisión de la entrada del primer minuto.
   Sin dependencias ni red: node --test test/fluyo-growth-foundation-001.test.cjs
   Lo que solo se ve con la página entera (tarjeta, Explorar, Historias reproducidas, Viewer, móvil) está en
   test/fluyo-growth-foundation-001-browser.cjs. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

/* El transporte en un contexto vm con un Umami falso que aplica beforeSend como el de verdad. */
function transport({ host = "fluyo.space", locale = "es" } = {}) {
  const sent = [], scripts = [];
  const ctx = vm.createContext({
    console, location: { hostname: host }, window: {},
    document: { head: { appendChild: (s) => scripts.push(s) }, createElement: () => ({ dataset: {} }) },
    FluyoI18n: { locale: () => locale }
  });
  vm.runInContext(read("js/analytics.js"), ctx);
  ctx.window.umami = { track: (name, data) => { const p = ctx.analyticsBeforeSend("event", { name, data, website: "x", url: "/secreto?ejemplo=1#d=abc", title: "Mi sistema", referrer: "https://privado/", language: "es-CL", screen: "390x844" }); if (p) sent.push(p); } };
  scripts[0] && scripts[0].onload && scripts[0].onload();
  return { ctx, sent, run: (c) => vm.runInContext(c, ctx) };
}
const SCHEMA = JSON.parse(JSON.stringify(transport().run("ANALYTICS_EVENTS")));   // fuera del reino del vm

/* ───────────── Contrato ───────────── */

test("contrato: los eventos históricos siguen con su nombre; los nuevos existen con propiedades enumeradas", () => {
  for (const n of ["editor_opened", "first_edit_completed", "diagram_created", "diagram_saved", "present_started", "diagram_exported", "file_imported",
    "example_loaded", "gif_animation_added", "link_failed", "share_created", "share_viewed", "share_opened_in_editor"]) assert.ok(n in SCHEMA, n);
  assert.deepEqual(Object.keys(SCHEMA.editor_opened), ["entry", "returning", "locale"]);
  assert.deepEqual(SCHEMA.editor_opened.entry, ["direct", "example", "link"]);
  assert.deepEqual(Object.keys(SCHEMA.example_loaded), ["example", "source"]);
  assert.deepEqual(SCHEMA.example_loaded.source, ["url", "menu", "entry"]);
  assert.deepEqual(SCHEMA.share_created, { kind: ["story", "diagram"], variants: ["yes", "no"] });
  assert.deepEqual(SCHEMA.share_viewed.story, ["yes", "no"]);
  assert.deepEqual(SCHEMA.entry_chosen, { choice: ["explore", "blank", "dismiss"] });
  assert.deepEqual(SCHEMA.story_created, { origin: ["new", "variant", "copy"] });
  assert.deepEqual(SCHEMA.story_started, { surface: ["editor", "present"], trigger: ["user", "entry"] });
  assert.deepEqual(SCHEMA.story_completed, { surface: ["editor", "present"] });
  assert.deepEqual(SCHEMA.viewer_story_started, {});
  assert.deepEqual(SCHEMA.viewer_story_completed, {});
  /* first_edit_completed y compañía no cambian */
  assert.deepEqual(SCHEMA.first_edit_completed, {});
  assert.deepEqual(SCHEMA.present_started, {});
});

test("privacidad: toda propiedad es una lista cerrada de palabras cortas (nada libre, nada del documento)", () => {
  for (const [name, props] of Object.entries(SCHEMA)) {
    assert.match(name, /^[a-z_]+$/);
    for (const [k, vals] of Object.entries(props)) {
      assert.ok(Array.isArray(vals) && vals.length > 0 && vals.length <= 16, name + "." + k);
      for (const v of vals) assert.match(v, /^[a-z0-9_-]{1,40}$/, name + "." + k + "=" + v);
    }
  }
});

test("cada trackEvent del código usa un evento del contrato, y cada evento del contrato se emite en algún sitio", () => {
  const used = new Set();
  for (const f of fs.readdirSync(path.join(root, "js")).filter((f) => f.endsWith(".js"))) {
    for (const m of read("js/" + f).matchAll(/(?:trackEvent|scTrack)\(\s*"([a-z_]+)"/g)) { assert.ok(m[1] in SCHEMA, f + ": " + m[1]); used.add(m[1]); }
  }
  for (const n of Object.keys(SCHEMA)) assert.ok(used.has(n), "sin emisor: " + n);
});

test("una propiedad fuera de lista o que falta descarta el evento ENTERO; las válidas pasan sin extras", () => {
  const t = transport();
  t.run('trackEvent("story_started",{surface:"editor"})');                              // falta trigger
  t.run('trackEvent("story_started",{surface:"viewer",trigger:"user"})');               // valor fuera de lista
  t.run('trackEvent("share_created",{kind:"story",variants:true})');                    // booleano, no "yes"
  t.run('trackEvent("story_created",{origin:"new",name:"Compra con éxito"})');          // extra: se quita
  t.run('trackEvent("viewer_story_started",{story:"Compra con éxito"})');               // extra: se quita
  assert.deepEqual(JSON.parse(JSON.stringify(t.sent.map((p) => [p.name, p.data || null]))), [["story_created", { origin: "new" }], ["viewer_story_started", null]]);
});

test("payload saliente: solo website, hostname, url '/', título fijo, referrer vacío, nombre y datos enumerados", () => {
  const t = transport();
  t.run('trackEvent("editor_opened",{entry:"direct",returning:"no",locale:"es"})');
  t.run('trackEvent("share_viewed",{story:"yes",locale:"en"})');
  for (const p of t.sent) {
    assert.deepEqual(Object.keys(p).sort(), ["data", "hostname", "name", "referrer", "title", "url", "website"]);
    assert.equal(p.url, "/"); assert.equal(p.title, "Fluyo"); assert.equal(p.referrer, "");
    assert.ok(!JSON.stringify(p).match(/secreto|Mi sistema|privado|es-CL|390x844|#d=|ejemplo=/));
  }
});

test("analyticsLocale: el idioma de la interfaz, o «other»; nunca descarta editor_opened", () => {
  for (const [l, want] of [["es", "es"], ["en", "en"], ["fr", "fr"], ["ja", "ja"], ["zh", "zh"], ["xx", "other"], ["en-US", "other"], [null, "other"]]) {
    const t = transport({ locale: l });
    assert.equal(t.run("analyticsLocale()"), want, String(l));
    t.run('trackEvent("editor_opened",{entry:"direct",returning:"no",locale:analyticsLocale()})');
    assert.equal(t.sent.length, 1, String(l));
  }
  const t = transport(); t.run('FluyoI18n={locale(){throw Error("x")}}');
  assert.equal(t.run("analyticsLocale()"), "other");
});

test("fuera de fluyo.space no se carga nada ni se envía nada (preview, local, self-host)", () => {
  for (const host of ["localhost", "127.0.0.1", "", "fluyo.vercel.app", "mi-fluyo.example"]) {
    const t = transport({ host });
    t.run('trackEvent("story_started",{surface:"editor",trigger:"user"})');
    assert.equal(t.sent.length, 0, host);
  }
});

/* ───────────── editor_opened en el editor real (mismo arnés que analytics.test.cjs) ───────────── */

test("editor_opened lleva entry, returning y locale sin URL ni documento", () => {
  for (const [setup, want] of [
    ["", { entry: "direct", returning: "no", locale: "es" }],
    ['EXAMPLE_SLUG="compra-online"', { entry: "example", returning: "no", locale: "es" }],
    ['DEEP_LINK_PAYLOAD="AAAA"', { entry: "link", returning: "no", locale: "es" }],
    ["ENTRY_STATE={returning:true}", { entry: "direct", returning: "yes", locale: "es" }],
    ['EXAMPLE_SLUG="x"; DEEP_LINK_PAYLOAD="y"; ENTRY_STATE={returning:false}', { entry: "example", returning: "no", locale: "es" }],
  ]) {
    const t = transport();
    let ready = null;
    t.ctx.document.getElementById = () => ({});
    t.ctx.document.addEventListener = (n, cb) => { if (n === "DOMContentLoaded") ready = cb; };
    vm.runInContext(read("js/editor-analytics.js"), t.ctx);   // sin doc: resetAnalyticsBaseline() falla dentro de su try
    if (setup) t.run("var " + setup.replace(/;\s*/g, "; var "));
    ready();
    assert.deepEqual({ ...t.sent[0].data }, want, setup || "directo");
  }
});

/* ───────────── Decisión de la entrada (js/entry.js, funciones puras) ───────────── */

function entryPure() {
  const src = read("js/entry.js");
  const pure = src.slice(0, src.indexOf("const ENTRY_STATE"));
  const ctx = vm.createContext({ URLSearchParams });
  vm.runInContext(pure, ctx);
  return ctx;
}
function store(keys, { throws = false } = {}) {
  const m = new Map(Object.entries(keys));
  return {
    get length() { if (throws) throw Error("SecurityError"); return m.size; },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => { if (throws) throw Error("SecurityError"); return m.has(k) ? m.get(k) : null; }
  };
}

test("entrada: quién cuenta como recurrente (cualquier clave fluyo.*), quién como nuevo y sin almacenamiento", () => {
  const e = entryPure();
  const st = (keys, o) => ({ ...e.entryStorageState(store(keys, o)) });
  assert.deepEqual(st({}), { available: true, returning: false });
  assert.deepEqual(st({ "otra.app": "1", lang: "es" }), { available: true, returning: false });
  for (const k of ["fluyo.seen", "fluyo.autosave.v1", "fluyo.ui.theme", "fluyo.ui.props", "fluyo.ui.lang"]) assert.deepEqual(st({ [k]: "x" }), { available: true, returning: true }, k);
  assert.deepEqual(st({}, { throws: true }), { available: false, returning: false });
  assert.deepEqual({ ...e.entryStorageState(null) }, { available: false, returning: false });
});

test("entrada: una URL profunda nunca se intercepta, aunque el documento ya se hubiera abierto o sea inválido", () => {
  const e = entryPure();
  for (const [search, hash, deep] of [
    ["", "", false], ["?lang=en", "", false], ["?ejemplo=compra-online", "", true], ["?ejemplo=no-existe", "", true],
    ["?lang=en&ejemplo=x", "", true], ["", "#d=AAAA", true], ["", "#x=1&d=AAAA", true], ["", "#seccion", false], ["", "#dd=1", false]
  ]) assert.equal(e.entryUrlIsDeep(search, hash), deep, search + hash);
});

test("entrada: se ofrece solo sin enlace profundo, sin sesión guardada, con almacenamiento y en un navegador nuevo", () => {
  const e = entryPure();
  const NEW = { available: true, returning: false };
  assert.equal(e.entryShouldOffer({ deepLink: false, autosave: false, state: NEW }), true);
  assert.equal(e.entryShouldOffer({ deepLink: true, autosave: false, state: NEW }), false);
  assert.equal(e.entryShouldOffer({ deepLink: false, autosave: true, state: NEW }), false);
  assert.equal(e.entryShouldOffer({ deepLink: false, autosave: false, state: { available: true, returning: true } }), false);
  assert.equal(e.entryShouldOffer({ deepLink: false, autosave: false, state: { available: false, returning: false } }), false);
  assert.equal(e.entryShouldOffer({ deepLink: false, autosave: false, state: null }), false);
});

test("entrada: la única clave nueva es fluyo.seen = \"1\" y no lleva fecha ni identificador", () => {
  const src = read("js/entry.js");
  assert.match(src, /const ENTRY_SEEN_KEY = "fluyo\.seen";/);
  assert.match(src, /localStorage\.setItem\(ENTRY_SEEN_KEY, "1"\)/);
  assert.equal((src.match(/setItem\(/g) || []).length, 1);
  assert.ok(!/Date\.now|new Date|crypto|Math\.random/.test(src));
});

/* ───────────── Cableado ───────────── */

test("cableado: entry.js va detrás de lo que usa, en el SW, y solo en el editor", () => {
  const html = read("index.html");
  const order = [...html.matchAll(/<script src="js\/([^"]+)"/g)].map((m) => m[1]);
  const at = (f) => order.indexOf(f);
  for (const dep of ["examples.js", "deeplink.js", "state.js", "editor-scenarios.js", "export.js", "ui.js"]) assert.ok(at(dep) < at("entry.js"), dep);
  assert.match(read("sw.js"), /"\.\/js\/entry\.js"/);
  assert.match(read("sw.js"), /const CACHE = "fluyo-static-v122";/);
  assert.ok(!read("s/index.html").includes("entry.js"));
  assert.match(html, /<section id="entryCard"[^>]*hidden>/);
  for (const k of ["entry.title", "entry.explore", "entry.exploreSub", "entry.blank", "entry.blankSub"]) {
    assert.ok(html.includes('data-i18n="' + k + '"'), k);
    assert.ok(read("js/i18n-en-editor.js").includes('"' + k + '":'), "en: " + k);
  }
});

test("cableado: Historia — un story_started por ejecución, story_completed con guarda, creación en sus cinco puertas", () => {
  const sc = read("js/editor-scenarios.js");
  assert.equal((sc.match(/scTrack\("story_started"/g) || []).length, 1);
  assert.equal((sc.match(/scTrack\("story_completed"/g) || []).length, 1);
  assert.match(sc, /if \(!scRunCounted && scRunSurface\) \{\s*scRunCounted = true;\s*scTrack\("story_completed"/);
  assert.equal((sc.match(/scTrack\("story_created", \{ origin: "new" \}\)/g) || []).length, 3);   // botón, tocar, colocar
  assert.equal((sc.match(/scTrack\("story_created", \{ origin: "variant" \}\)/g) || []).length, 2);   // «Otra forma desde aquí» y «Duplicar como fallo»
  assert.equal((sc.match(/scTrack\("story_created", \{ origin: "copy" \}\)/g) || []).length, 1);
  const v = read("js/viewer.js");
  assert.match(v, /if\(!story\.counted\)\{ story\.counted=true; trackEvent\("viewer_story_completed"\); \}/);
  assert.equal((v.match(/trackEvent\("viewer_story_started"\)/g) || []).length, 1);
});

/* ───────────── Inglés publicable (FLUYO-I18N-EN-RELEASE-AUDIT) ───────────── */

test("decisión 277: cada línea de ayuda es UNA frase; el inglés lleva las mismas marcas {kbd}/{b}, en el mismo orden", () => {
  const scan = require("./i18n-scan.cjs");
  const rich = scan.scanHtml(read("index.html")).marks.filter((m) => m.where === "rich");
  assert.equal(rich.length, 12, "12 líneas con marcado (la primera es texto liso)");
  const en = scan.dictionaries().en.editor;
  const kinds = (s) => [...String(s).matchAll(/\{(kbd|b):[^{}]*\}/g)].map((m) => m[1]).join(",");
  for (const m of rich) {
    assert.ok(typeof en[m.key] === "string", "en: " + m.key);
    assert.equal(kinds(en[m.key]), kinds(m.es), m.key + ": mismas marcas");
    assert.doesNotMatch(en[m.key], /[áéíóúñ¿¡]/, m.key + ": en inglés");
  }
  /* las teclas que se nombran en el idioma de la interfaz se traducen (decisión 277): «Supr» → «Del» */
  assert.match(en["help.edit"], /\{kbd:Del\}/);
});

test("inglés publicable: <title> traducible y enlaces legales a la página del mismo idioma; el 404 también", () => {
  assert.match(read("index.html"), /<title data-i18n="editor\.docTitle">/);
  const en = { ...require("./i18n-scan.cjs").dictionaries().en.common, ...require("./i18n-scan.cjs").dictionaries().en.editor };
  assert.doesNotMatch(en["editor.docTitle"], /[áéíóúñ]/);
  assert.equal(en["more.privacyHref"], "privacy/"); assert.equal(en["more.supportHref"], "support/");
  for (const [k, v] of [["shell.privacyPath", "/privacy/"], ["shell.termsPath", "/terms/"], ["shell.supportPath", "/support/"]]) {
    assert.equal(en[k], v); assert.ok(fs.existsSync(path.join(root, v, "index.html")), v + " existe");
    assert.ok(read("404.html").includes('data-i18n-link="' + k + '"'), "404: " + k);
  }
  for (const v of ["privacy", "support"]) assert.ok(fs.existsSync(path.join(root, v, "index.html")));
  assert.match(read("js/i18n.js"), /\["data-i18n-link","href"\]/);
  /* el lienzo vacío no remite a nada que no se vea («Ejemplo» vive en «⋯») */
  assert.match(read("js/editor-runtime.js"), /FluyoI18n\.t\("editor\.emptyCanvas","Empieza añadiendo elementos al lienzo\."\)/);
  assert.equal(en["editor.emptyCanvas"], "Start by adding elements to the canvas.");
});

test("decisión 324: publicados el español y el inglés; fr/ja/zh siguen sin publicar; deuda y enlaces externos escritos", () => {
  const src = read("js/i18n.js");
  assert.match(src, /\{code:"en", tag:"en", name:"English", released:true\}/);
  for (const c of ["fr", "ja", "zh"]) assert.ok(new RegExp('\{code:"' + c + '"[^}]*released:false\}').test(src), c + " sin publicar");
  assert.match(read(".ai/DECISIONS.md"), /^324\. /m);
  const audit = read(".ai/tasks/FLUYO-I18N-EN-RELEASE-AUDIT.md");
  for (const s of ["/ejemplos/", "/docs/", "`fluyo.space/`"]) assert.ok(audit.includes(s), s);
  assert.match(read("test/cdp-lite.cjs"), /--lang=es-ES/);
});
