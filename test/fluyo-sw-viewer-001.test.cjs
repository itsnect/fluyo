"use strict";
/* FLUYO-SW-VIEWER-001 — El Viewer (/s/) registra el service worker y, instalado desde ahí, precachea SOLO lo que necesita quien abre un
   enlace (D1 sí, D2 sí, D3 no); las navegaciones a /s/ con cualquier query sirven el Viewer de la caché y, sin red, el respaldo es el
   Viewer, nunca el editor (D4-A). Comprobaciones estáticas y el sw.js REAL en vm con caches/clients/fetch falsos; lo que solo se ve en
   un navegador (instalar, desconectar, actualizar la caché, idiomas) lo mide test/fluyo-sw-viewer-001-browser.cjs en Chrome.
   · VIEWER_ASSETS = exactamente lo que carga s/index.html (página, hojas, tipografías de system.css, scripts en su orden); sin terceros.
   · Instalación: con una ventana del editor abierta, o con la caché anterior del editor, lo de siempre (ASSETS + PAGE_ASSETS + gif.js);
     si no, solo VIEWER_ASSETS (sin gif.js, sin cdnjs). Las listas del editor no cambian.
   · Fetch: /s/, /s/?lang=en, /s/?lang=fr, /s/?s=demo, /s/index.html → el Viewer de la caché; sin red y sin caché → ./s/; nunca
     ./index.html. El editor y gif.js, como antes.
   · viewer.js registra ../sw.js (ámbito «/») solo en http/https y tras «load».
   · Alcance frente a db380d3: solo sw.js y js/viewer.js; undoSwv da la base EXACTA; CACHE v108. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const { undoShell } = require("./fluyo-shell-001-undo.cjs");
const root = path.resolve(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8").replace(/\r\n/g, "\n");
const BASE = "db380d3";
const ORIGIN = "https://fluyo.space";

/* ───────── el sw.js real con un entorno falso ───────── */
function sw({ clients = [], oldCaches = {}, online = true } = {}) {
  const listeners = {};
  const location = new URL(ORIGIN + "/sw.js");
  const abs = (u) => new URL(typeof u === "string" ? u : u.url, location).href;
  const stores = new Map();
  for (const [name, urls] of Object.entries(oldCaches)) stores.set(name, new Map(urls.map((u) => [abs(u), { body: "old:" + u }])));
  const fetched = [], added = [];
  const store = (name) => { if (!stores.has(name)) stores.set(name, new Map()); const m = stores.get(name);
    return {
      addAll: (list) => { added.push(...list.map(abs)); for (const u of list) { if (!online) return Promise.reject(new Error("offline")); m.set(abs(u), { body: "net:" + abs(u) }); } return Promise.resolve(); },
      put: (req, resp) => { m.set(abs(req), resp); return Promise.resolve(); },
      match: (req) => Promise.resolve(m.get(abs(req))),
      keys: () => Promise.resolve([...m.keys()]),
    }; };
  const caches = {
    open: (n) => Promise.resolve(store(n)),
    keys: () => Promise.resolve([...stores.keys()]),
    delete: (n) => Promise.resolve(stores.delete(n)),
    match: (req) => { for (const m of stores.values()) { const r = m.get(abs(req)); if (r) return Promise.resolve(r); } return Promise.resolve(undefined); },
  };
  class Request { constructor(u) { this.url = abs(u); this.method = "GET"; this.mode = "cors"; } }
  const ctx = {
    URL, Request, caches, console: { warn() {}, error() {}, log() {} },
    fetch: (req) => { fetched.push(abs(req)); return online ? Promise.resolve({ ok: true, body: "net:" + abs(req), clone() { return this; } }) : Promise.reject(new TypeError("Failed to fetch")); },
    self: { location, addEventListener: (t, f) => (listeners[t] = f), skipWaiting: () => Promise.resolve(),
      clients: { matchAll: () => Promise.resolve(clients.map((u) => ({ url: ORIGIN + u }))), claim: () => Promise.resolve() } },
  };
  ctx.self.caches = caches;
  vm.createContext(ctx);
  vm.runInContext(read("sw.js"), ctx, { filename: "sw.js" });
  const R = (code) => vm.runInContext(code, ctx);
  const install = async () => { let p; listeners.install({ waitUntil: (x) => (p = x) }); await p; };
  const navigate = async (u, mode = "navigate") => { let p = null; listeners.fetch({ request: { url: /^https?:/.test(u) ? u : ORIGIN + u, method: "GET", mode }, respondWith: (x) => (p = x) }); return p ? p : "(sin respuesta del SW)"; };
  return { R, install, navigate, stores, fetched, added, abs, setOnline: (v) => (online = v) };
}
const list = (name) => [...read("sw.js").match(new RegExp("const " + name + " = \\[([\\s\\S]*?)\\];"))[1].matchAll(/"\.\/([^"]*)"/g)].map((m) => m[1]);

test("VIEWER_ASSETS es exactamente lo que carga s/index.html: la página, sus hojas, las tipografías de system.css y sus scripts, en su orden", () => {
  const html = read("s/index.html");
  const scripts = [...html.matchAll(/<script src="\.\.\/([^"]+)"/g)].map((m) => m[1]);
  const sheets = [...html.matchAll(/<link rel="stylesheet" href="\.\.\/([^"]+)"/g)].map((m) => m[1]);
  const fonts = [...new Set(sheets.flatMap((c) => [...read(c).matchAll(/url\("\.\.\/(assets\/[^"]+)"\)/g)].map((m) => m[1])))];
  const V = list("VIEWER_ASSETS");
  assert.deepEqual(V.filter((f) => f.startsWith("js/")), scripts, "los scripts de s/index.html, en su orden");
  assert.deepEqual(V.filter((f) => f.startsWith("css/")).sort(), [...sheets].sort(), "sus hojas de estilo");
  assert.deepEqual(V.filter((f) => f.startsWith("assets/")).sort(), [...fonts].sort(), "las tipografías que piden esas hojas");
  assert.equal(V[0], "s/", "la página del Viewer");
  assert.equal(V.length, 1 + sheets.length + fonts.length + scripts.length, "nada más");
  assert.equal(V.length, 25 + 3, "25 + los diccionarios comunes fr, ja y zh (FLUYO-I18N-002 S0)");
  assert.ok(!/cdnjs|gif\.js|https?:/.test(read("sw.js").match(/const VIEWER_ASSETS = \[[\s\S]*?\];/)[0]), "sin terceros ni gif.js");
  const editor = new Set([...list("ASSETS"), ...list("PAGE_ASSETS")]);
  assert.ok(V.every((f) => editor.has(f)), "todo lo del Viewer ya estaba en la caché del editor (el editor no cambia)");
  assert.ok(!V.some((f) => /^js\/(editor-|export|ui|state|interaction|selection|present-story|deeplink|examples)/.test(f)), "nada del editor");
});

test("instalación desde el Viewer (solo /s/ abierto, sin caché anterior): solo VIEWER_ASSETS; sin gif.js ni cdnjs", async () => {
  for (const clients of [["/s/?lang=en"], ["/s/"], []]) {
    const s = sw({ clients });
    await s.install();
    const V = list("VIEWER_ASSETS").map((f) => s.abs("./" + f));
    assert.deepEqual(s.added, V, JSON.stringify(clients) + ": exactamente el conjunto del Viewer");
    assert.ok(!s.added.some((u) => /cdnjs|gif/.test(u)), "sin gif.js ni cdnjs");
    assert.deepEqual([...s.stores.keys()], ["fluyo-static-v121"]);
  }
});

test("instalación con el editor (ventana del editor abierta, o caché anterior del editor): lo de siempre, gif.js incluido", async () => {
  const full = [...list("ASSETS"), ...list("PAGE_ASSETS")];
  for (const [why, opts] of [["el editor registra", { clients: ["/"] }], ["editor y Viewer abiertos", { clients: ["/s/", "/?ejemplo=x"] }],
    ["actualización de quien usó el editor, desde un enlace", { clients: ["/s/"], oldCaches: { "fluyo-static-anterior": ["./", "./index.html", "./s/"] } }],
    ["caché anterior del editor sin index.html explícito", { clients: ["/s/"], oldCaches: { "fluyo-static-anterior": ["./"] } }]]) {
    const s = sw(opts);
    await s.install();
    for (const f of full) assert.ok(s.added.includes(s.abs("./" + f)), why + ": " + f);
    assert.ok(s.added.some((u) => u.startsWith("https://cdnjs.cloudflare.com/ajax/libs/gif.js/")), why + ": gif.js como siempre");
  }
  /* la caché anterior de quien solo abrió enlaces NO convierte la instalación en la del editor */
  const v = sw({ clients: ["/s/"], oldCaches: { "fluyo-static-anterior": ["./s/", "./js/viewer.js"] } });
  await v.install();
  assert.ok(!v.added.some((u) => /gif|index\.html$/.test(u)), "actualización de quien solo abre enlaces: sigue siendo la del Viewer");
});

test("D4-A · /s/ con cualquier query sirve el Viewer de la caché; sin red y sin caché, el respaldo es ./s/, nunca el editor", async () => {
  const s = sw({ clients: ["/s/"] });
  await s.install();
  const viewer = s.abs("./s/");
  for (const u of ["/s/", "/s/?lang=en", "/s/?lang=fr", "/s/?s=demo", "/s/index.html", "/s/?lang=en&x=1"]) {
    s.setOnline(true); s.fetched.length = 0;
    const r = await s.navigate(u);
    assert.equal(r && r.body, "net:" + viewer, u + ": el Viewer precacheado");
    assert.equal(s.fetched.length, 0, u + ": sin red (cache-first)");
    s.setOnline(false);
    assert.equal((await s.navigate(u)).body, "net:" + viewer, u + ": sin red, el Viewer");
  }
  /* caché vacía (p. ej. editor ya instalado antes sin /s/), sin red: respaldo ./s/ si existe, si no nada; NUNCA index.html */
  const e = sw({ clients: ["/"], online: false, oldCaches: { "fluyo-static-v121": ["./index.html", "./s/"] } });
  const r1 = await e.navigate("/s/?lang=en");
  assert.equal(r1.body, "old:./s/", "con el editor instalado y sin red: el Viewer, no el editor");
  const empty = sw({ online: false, oldCaches: { "fluyo-static-v121": ["./index.html"] } });
  assert.equal(await empty.navigate("/s/?lang=en"), undefined, "sin Viewer en caché y sin red: nada (nunca el editor)");
  /* con red y sin caché: se pide la página del Viewer y se guarda como ./s/ (una sola clave para todas las queries) */
  const on = sw({ oldCaches: { "fluyo-static-v121": [] } });
  await on.navigate("/s/?lang=en");
  assert.deepEqual(on.fetched, [s.abs("./s/")], "se pide ./s/, sin la query");
  assert.ok((await on.navigate("/s/?lang=fr")).body.endsWith("/s/"));
});

test("el editor y gif.js, como antes: navegación al editor sin red → ./index.html; gif.js cache-first; terceros, sin tocar", async () => {
  const s = sw({ clients: ["/"], online: false, oldCaches: { "fluyo-static-v121": ["./index.html"] } });
  assert.equal((await s.navigate("/?ejemplo=nope")).body, "old:./index.html", "editor sin red: su index.html");
  assert.equal((await s.navigate("/docs/")).body, "old:./index.html", "otra página sin red: como antes");
  /* gif.js: lo pide el editor al exportar; cache-first como siempre (de la red la primera vez, guardado) */
  const GIF = "https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.js";
  const g = sw({ clients: ["/"] });
  assert.equal((await g.navigate(GIF, "no-cors")).body, "net:" + GIF);
  assert.deepEqual(g.fetched, [GIF]);
  /* otros orígenes (la analítica en fluyo.space): el SW no responde, como antes */
  assert.equal(await sw().navigate("https://cloud.umami.is/script.js", "no-cors"), "(sin respuesta del SW)");
  /* un recurso del Viewer que no es navegación (p. ej. ./js/viewer.js) sigue el camino general cache-first */
  const v = sw({ clients: ["/s/"] }); await v.install(); v.setOnline(false);
  assert.equal((await v.navigate("/js/viewer.js", "no-cors")).body, "net:" + v.abs("./js/viewer.js"));
});

test("viewer.js registra ../sw.js (ámbito «/», el del editor) solo en http/https y tras «load»", () => {
  const src = read("js/viewer.js");
  const fn = src.match(/function registerViewerServiceWorker\(\)\{[\s\S]*?\n\}\nregisterViewerServiceWorker\(\);/);
  assert.ok(fn, "registerViewerServiceWorker y su llamada");
  const run = (protocol, readyState = "complete") => {
    const calls = [], loads = [];
    const ctx = { location: { protocol }, document: { readyState }, console, window: { addEventListener: (t, f) => loads.push([t, f]) },
      navigator: { serviceWorker: { register: (u) => { calls.push(u); return Promise.resolve(); } } } };
    vm.runInNewContext(fn[0], ctx);
    for (const [, f] of loads) f();
    return { calls, loads: loads.map((l) => l[0]) };
  };
  assert.deepEqual(run("file:").calls, [], "file:// no registra (FLUYO-004)");
  assert.deepEqual(run("https:").calls, ["../sw.js"]);
  assert.deepEqual(run("http:", "interactive"), { calls: ["../sw.js"], loads: ["load"] }, "antes de «load», espera a «load»");
  vm.runInNewContext(fn[0], { location: { protocol: "https:" }, document: { readyState: "complete" }, window: {} });   // sin navigator: no rompe
  assert.match(read("js/export.js"), /navigator\.serviceWorker\.register\("\.\/sw\.js"\)/, "el editor sigue registrando ./sw.js");
});

test("alcance frente a db380d3: solo cambian sw.js y js/viewer.js; undoSwv da la base EXACTA; CACHE v108", () => {
  const gitRoot = process.env.FLUYO_GIT_ROOT || root;
  const atBase = (f) => execFileSync("git", ["-C", gitRoot, "show", BASE + ":" + f], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).replace(/\r\n/g, "\n");
  try { atBase("sw.js"); } catch { return; }   // sin git
  for (const f of ["js/export.js", "js/i18n.js", "js/i18n-en.js", "js/share-loader.js", "js/link-codec.js", "js/model.js", "js/story-playback.js", "js/story-clock.js",
    "js/render.js", "js/present-story.js", "js/editor-share.js", "js/share-url.js", "s/index.html", "index.html", "css/share.css", "manifest.webmanifest"])
    assert.equal(undoShell(f, read(f)), atBase(f), f + " sin cambios (FLUYO-SHELL-001, encima, se deshace antes: favicon, manifest, i18n-en)");
  const { undoSwv, PIECES, BASE_SWV } = require("./fluyo-sw-viewer-001-undo.cjs");
  assert.equal(BASE_SWV, BASE);
  assert.deepEqual(Object.keys(PIECES).sort(), ["js/viewer.js", "sw.js"]);
  assert.equal(undoSwv("js/viewer.js", read("js/viewer.js")), atBase("js/viewer.js"));
  assert.equal(undoSwv("sw.js", read("sw.js")).replace("fluyo-static-v121", "fluyo-static-v" + (107 - 1)), atBase("sw.js"));
  assert.match(read("sw.js"), /const CACHE = "fluyo-static-v121";/);
  for (const n of ["ASSETS", "PAGE_ASSETS", "CDN_ASSETS"]) {
    const grab = (s) => (s.match(new RegExp("const " + n + " = \\[[\\s\\S]*?\\];")) || [])[0];
    assert.equal(grab(undoShell("sw.js", read("sw.js"))), grab(atBase("sw.js")), n + ": la lista del editor no cambia (I18N-002 S0, encima, se deshace antes)");
  }
  assert.ok(read("test/fluyo-product-narration-001-undo.cjs").includes("src = undoSwv(file, src);"), "undoNarr deshace antes esta tarea");
});
