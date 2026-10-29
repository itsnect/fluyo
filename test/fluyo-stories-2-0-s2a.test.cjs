"use strict";
/* FLUYO-STORIES-2.0 S2a · Portada y otras formas — tests de unidad (vm, sobre el Viewer y el Share reales).
   La familia de una Historia es su página (D1); el propósito, el nombre de la página y el de la Historia (D2). Un enlace de Historia
   lleva sus otras formas detrás de la elegida, salvo que se desmarque (D3). El Viewer abre en una portada (sistema, Historia y
   desenlace, D5) y al terminar ofrece «Otras formas» (D4). Sin kernel, sin formato nuevo, sin MCP. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path");
const { execFileSync } = require("node:child_process");
const { makeViewer, read } = require("./viewer-harness.cjs");
const root = path.join(__dirname, "..");
const gitRoot = process.env.FLUYO_GIT_ROOT || root;
const BASE = "7aa22f1";
const J = (v) => JSON.parse(JSON.stringify(v));
const atBase = (f) => execFileSync("git", ["-C", gitRoot, "show", BASE + ":" + f], { encoding: "utf8" });
const example = (slug) => JSON.parse(read(`ejemplos/data/${slug}.fluyo.json`));
const idOf = (p, name) => p.doc.pages[p.doc.cur].scenarios.find((s) => s.name === name).id;

/* Un enlace con el share-url.js de esta tarea (o el de la base, para comparar byte a byte) */
async function link(projectData, options, base = false) {
  const c = makeViewer();
  c.run(base ? atBase("js/share-url.js") : read("js/share-url.js"));
  c.context.project = projectData; c.context.options = options;
  const url = await c.run("createShareUrl(project,'https://fluyo.space/',options)");
  const doc = J(await c.run("decodeDeepLink(" + JSON.stringify(new URL(url).hash.slice(3)) + ")"));
  return { url, doc, names: doc.doc.pages[doc.doc.cur].scenarios.map((s) => s.name) };
}
/* El Viewer real abierto en un enlace */
async function viewer(url, lang) {
  const v = makeViewer({ hash: new URL(url).hash, search: lang ? "?lang=" + lang : "" });
  /* los ejemplos tienen nodos con icono: el arnés no trae Image */
  v.context.Image = class { constructor() { this.complete = false; this.naturalWidth = 0; } };
  if (lang) v.run(`FluyoI18n.setLocale(${JSON.stringify(lang)})`);
  await v.boot();
  await v.waitForPhase((p) => p === "ready");
  /* en el DOM de mentira, vaciar con textContent no quita los hijos (en Chrome, sí) */
  Object.defineProperty(v.el("stOthersList"), "textContent", { set(t) { this.children = []; this._t = t; }, get() { return this._t || ""; } });
  v.frames(2);
  v.read = () => ({ kicker: v.el("stKicker").textContent, title: v.el("stTitle").textContent, outcome: v.el("stOutcome").textContent,
    others: v.el("stOthers").hidden ? null : v.el("stOthersList").children.map((b) => b.children.map((s) => s.textContent).join(" · ")),
    story: v.run("storyScenario() && storyScenario().name") });
  v.finish = () => { v.run("storyPlay(); storySeek(storyNav().times.length - 1)"); v.advance(60000); v.frames(3); };
  return v;
}

test("S1 · applyShareKind con withOthers: la elegida primero y detrás las demás CON pasos de su página, en su orden; nada de otras páginas", () => {
  const c = makeViewer(); c.run(read("js/share-url.js"));
  const st = (id, n) => ({ id, steps: Array.from({ length: n }, (_, i) => ({ id: i + 1 })) });
  c.context.mk = () => ({ doc: { cur: 1, pages: [{ scenarios: [st(1, 2)] }, { scenarios: [st(1, 1), st(2, 0), st(3, 2), st(4, 1)] }] } });
  const ids = (expr) => J(c.run(expr).doc.pages.map((p) => p.scenarios.map((s) => s.id)));
  assert.deepEqual(ids('applyShareKind(mk(),{kind:"story",scenarioId:3,withOthers:true})'), [[], [3, 1, 4]], "la vacía (2) no viaja; la página 0 tampoco");
  assert.deepEqual(ids('applyShareKind(mk(),{kind:"story",scenarioId:3,withOthers:false})'), [[], [3]], "desmarcada: solo la elegida");
  assert.deepEqual(ids('applyShareKind(mk(),{kind:"story",scenarioId:3})'), [[], [3]], "sin la opción: como siempre");
  assert.deepEqual(ids('applyShareKind(mk(),{kind:"story",scenarioId:9,withOthers:true})'), [[], []], "id desconocido: ninguna (falla cerrado)");
  assert.deepEqual(ids('applyShareKind(mk(),{kind:"diagram",withOthers:true})'), [[], []], "solo el diagrama: ninguna");
  assert.deepEqual(ids("applyShareKind(mk(),undefined)"), [[1], [1, 2, 3, 4]], "sin options: crudo");
});

test("S2 · un enlace de Compra online lleva la familia; sin ella, es byte a byte el enlace de v118; el de diagrama, también", async () => {
  const p = example("compra-online"), before = JSON.stringify(p);
  const banco = idOf(p, "El banco no responde");
  const fam = await link(p, { kind: "story", scenarioId: banco, withOthers: true });
  assert.deepEqual(fam.names, ["El banco no responde", "Compra con éxito"], "la elegida es scenarios[0]");
  const one = await link(p, { kind: "story", scenarioId: banco, withOthers: false });
  assert.deepEqual(one.names, ["El banco no responde"]);
  assert.equal(one.url, (await link(p, { kind: "story", scenarioId: banco }, true)).url, "desmarcada = enlace de la base");
  assert.equal((await link(p, { kind: "diagram" })).url, (await link(p, { kind: "diagram" }, true)).url, "diagrama = enlace de la base");
  assert.ok(fam.url.length - one.url.length < 400, "la familia cuesta poco: +" + (fam.url.length - one.url.length) + " caracteres");
  assert.equal(JSON.stringify(p), before, "el documento del autor no cambia");
});

/* El diálogo de Share real (editor-share.js) sobre el documento de un ejemplo, con lo mínimo del editor alrededor */
function shareDialogOn(project, activeName) {
  const c = makeViewer();
  c.run(read("js/share-url.js"));
  c.context.__project = project;
  /* model.js ya trae doc, P y serializeProject (los del editor); trackEvent se escucha */
  c.run(`var __n = projectFromProjectData(__project), __active = ${JSON.stringify(activeName)}, __events = [];
    doc = __n.doc; settings = __n.settings;
    globalThis.scActiveScenario = () => P().scenarios.find((s) => s.name === __active);
    globalThis.commitEditBox = () => {}; trackEvent = (n) => { __events.push(n); }; globalThis.isScenarioPlaybackActive = () => false;
    var __dlg = document.getElementById("shareDialog"); __dlg.showModal = () => { __dlg.open = true; }; __dlg.close = () => { __dlg.open = false; };
    document.getElementById("shareKindStory").checked = true;
    document.createTextNode = (t) => ({ textContent: t }); document.getElementById("shareStoryName").replaceChildren = function (...k) { this.children = k; };
    document.getElementById("shareCopy").focus = () => {};`);
  c.run(read("js/editor-share.js"));
  /* en el DOM de mentira, vaciar con textContent no quita los hijos (en Chrome, sí) */
  Object.defineProperty(c.context.document.getElementById("shareOthersNames"), "textContent", { set(t) { this.children = []; }, get() { return ""; } });
  c.names = () => c.el("shareOthersNames").children.filter((x) => x.textContent !== " · ").map((x) => x.textContent);
  c.open = () => c.run("showShareDialog()");
  c.create = async () => { await c.run("confirmShare()"); const url = c.el("shareLink").value; return { url, names: J(await c.run(`decodeDeepLink(${JSON.stringify(url.split("#d=")[1])})`)).doc.pages[0].scenarios.map((s) => s.name) }; };
  return c;
}

test("S3 · el diálogo: la casilla aparece marcada con los nombres; marcada lleva la familia, desmarcada el enlace de siempre; si no cabe, solo la Historia", async () => {
  const p = example("compra-online");
  const c = shareDialogOn(p, "Compra con éxito");
  c.open();
  assert.deepEqual([c.el("shareOthersRow").hidden, c.el("shareOthers").checked, c.names()], [false, true, ["El banco no responde"]], "cada nombre en su nodo, sin traducir");
  const fam = await c.create();
  assert.deepEqual(fam.names, ["Compra con éxito", "El banco no responde"]);
  assert.match(c.el("shareResultNote").textContent, /y sus otras formas/);
  assert.equal(c.el("shareMessage").textContent, "", "sin error");
  c.open(); c.el("shareOthers").checked = false;
  const one = await c.create();
  assert.deepEqual(one.names, ["Compra con éxito"]);
  assert.equal(one.url, (await link(p, { kind: "story", scenarioId: idOf(p, "Compra con éxito") }, true)).url, "desmarcada: el enlace de v118");
  c.open();
  assert.equal(c.el("shareOthers").checked, true, "al reabrir, marcada otra vez");
  c.el("shareKindDiagram").checked = true;
  assert.deepEqual((await c.create()).names, [], "sólo el diagrama: ninguna Historia");
  c.el("shareKindDiagram").checked = false;
  /* si la familia no cabe, se reintenta solo con la Historia y se dice */
  c.run(`var __create = createShareUrl; createShareUrl = (p, b, o) => { if (o && o.withOthers) { const e = new Error("too_large"); e.code = "too_large"; e.stage = "url"; return Promise.reject(e); } return __create(p, b, o); }`);
  c.open();
  assert.deepEqual((await c.create()).names, ["Compra con éxito"]);
  assert.equal(c.el("shareMessage").textContent, "Con sus otras formas el enlace era demasiado grande: solo viaja esta historia.");
  assert.doesNotMatch(c.el("shareResultNote").textContent, /otras formas/);
  assert.deepEqual(J(c.run("__events")), ["share_created", "share_created", "share_created", "share_created"], "la misma analítica de siempre");
  const solo = shareDialogOn(example("funnel-de-ventas"), "x");
  solo.open();
  assert.equal(solo.el("shareOthersRow").hidden, true, "sin otras formas (ni Historias), no hay casilla");
});

test("V1 · portada del Viewer: sistema, Historia y desenlace antes de reproducir; al terminar, «Otras formas» con su desenlace", async () => {
  const p = example("compra-online");
  const v = await viewer((await link(p, { kind: "story", scenarioId: idOf(p, "Compra con éxito"), withOthers: true })).url);
  assert.deepEqual(v.read(), { kicker: "Compra online", title: "Compra con éxito", outcome: "Termina bien", others: null, story: "Compra con éxito" });
  v.finish();
  const end = v.read();
  assert.equal(v.run("story.status"), "completed");
  assert.equal(end.outcome, "Termina bien", "el mismo desenlace al terminar");
  assert.deepEqual(end.others, ["El banco no responde · Falla en el paso 4"]);
});

test("V2 · elegir otra forma la abre en su portada, sin recargar ni tocar el documento; reproducida, acaba como anunciaba", async () => {
  const p = example("compra-online");
  const url = (await link(p, { kind: "story", scenarioId: idOf(p, "Compra con éxito"), withOthers: true })).url;
  const v = await viewer(url);
  const doc0 = v.run("JSON.stringify(doc)"), hash0 = v.context.location.hash;
  v.finish();
  v.el("stOthersList").children[0].onclick();
  v.frames(2);
  assert.deepEqual(v.read(), { kicker: "Compra online", title: "El banco no responde", outcome: "Falla en el paso 4", others: null, story: "El banco no responde" });
  assert.equal(v.run("story"), null, "queda lista, en su portada");
  v.finish();
  assert.equal(v.read().outcome, "Falla en el paso 4", "la portada no mentía");
  assert.deepEqual(v.read().others, ["Compra con éxito · Termina bien"]);
  assert.equal(v.run("JSON.stringify(doc)"), doc0, "el documento instalado no cambia");
  assert.equal(v.context.location.hash, hash0, "la URL no cambia");
});

test("V3 · un enlace de v118 (una sola Historia) abre igual, con portada y sin «Otras formas»; uno anterior a 016 (crudo) ofrece las demás", async () => {
  const p = example("pedido-asincrono-cola");
  const old = await viewer((await link(p, { kind: "story", scenarioId: idOf(p, "Un mensaje que falla") }, true)).url);
  assert.deepEqual(old.read(), { kicker: "Pedido asíncrono con cola", title: "Un mensaje que falla", outcome: "Falla en el paso 4", others: null, story: "Un mensaje que falla" });
  old.finish();
  assert.equal(old.read().others, null, "sin otras formas en el enlace, no aparece nada");
  const raw = await viewer((await link(p, undefined, true)).url);
  assert.equal(raw.read().story, "Un pedido", "crudo: scenarios[0], como siempre");
  raw.finish();
  assert.deepEqual(raw.read().others, ["Un mensaje que falla · Falla en el paso 4"]);
});

test("V4 · una página con nombre de semilla dice «Historia», como hoy; en inglés, «Story», «Ends well» y «Other ways»", async () => {
  const p = example("compra-online");
  p.doc.pages[0].name = "Página 1";
  const url = (await link(p, { kind: "story", scenarioId: idOf(p, "Compra con éxito"), withOthers: true })).url;
  assert.equal((await viewer(url)).read().kicker, "Historia");
  const en = await viewer(url, "en");
  assert.equal(en.read().kicker, "Story", "«Página 1» también es semilla en inglés");
  assert.equal(en.read().outcome, "Ends well");
  en.finish();
  assert.deepEqual(en.read().others, ["El banco no responde · Fails at step 4"], "el nombre es contenido: no se traduce; el rótulo «Other ways» (data-i18n) lo mira el QA en Chrome");
});

test("V5 · cambiar de idioma con la portada o el final a la vista repinta y no toca el documento", async () => {
  const p = example("compra-online");
  const v = await viewer((await link(p, { kind: "story", scenarioId: idOf(p, "Compra con éxito"), withOthers: true })).url);
  const doc0 = v.run("JSON.stringify(doc)");
  v.run(`FluyoI18n.setLocale("en")`); v.frames(1);
  assert.equal(v.read().outcome, "Ends well");
  v.finish();
  v.run(`FluyoI18n.setLocale("es")`); v.frames(1);
  assert.deepEqual(v.read().others, ["El banco no responde · Falla en el paso 4"]);
  assert.equal(v.run("JSON.stringify(doc)"), doc0);
});

test("K1 · FluyoStoryClock: outcomeOf = el desenlace del motor (los tres ejemplos), otherForms = la página, systemName sin semillas", () => {
  const c = makeViewer();
  const expect = {
    "compra-online": { "Compra con éxito": "Termina bien", "El banco no responde": "Falla en el paso 4" },
    "inicio-de-sesion-oauth2": { "Iniciar sesión": "Termina bien", "El usuario no autoriza": "Termina bien" },
    "pedido-asincrono-cola": { "Un pedido": "Termina bien", "Un mensaje que falla": "Falla en el paso 4" },
  };
  for (const [slug, stories] of Object.entries(expect)) {
    c.context.raw = read(`ejemplos/data/${slug}.fluyo.json`);
    const got = J(c.run(`(() => { const d = JSON.parse(raw), pg = d.doc.pages[0], before = JSON.stringify(d), out = {};
      for (const sc of pg.scenarios) {
        const a = FluyoStoryClock.outcomeOf(pg, sc), b = FluyoStoryClock.outcome(sc, FluyoStory.run(pg, sc).trace);
        if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error("outcomeOf ≠ outcome");
        out[sc.name] = FluyoStoryClock.outcomeText(a);
        out[sc.name + "/otras"] = FluyoStoryClock.otherForms(pg, sc).map((s) => s.name).join();
      }
      out.same = JSON.stringify(d) === before; out.system = FluyoStoryClock.systemName(pg, FluyoI18n.t); return out; })()`));
    assert.equal(got.same, true, slug + ": el documento no cambia");
    const names = Object.keys(stories);
    assert.deepEqual(names.map((n) => got[n]), Object.values(stories), slug);
    assert.deepEqual(names.map((n) => got[n + "/otras"]), [names[1], names[0]], slug + ": cada una ve a la otra");
    assert.equal(got.system, JSON.parse(c.context.raw).doc.pages[0].name);
  }
  const sys = (name) => c.run(`FluyoStoryClock.systemName({ name: ${JSON.stringify(name)} }, FluyoI18n.t)`);
  assert.deepEqual(["Página 3", "Page 12", "  ", "", "Compra online", "Página uno"].map(sys), ["", "", "", "", "Compra online", "Página uno"]);
  c.run(`FluyoI18n.setLocale("ja")`);
  assert.deepEqual(["ページ 2", "ページ 二"].map(sys), ["", "ページ 二"], "la semilla del idioma activo («ページ {n}»)");
  assert.equal(c.run(`FluyoStoryClock.otherForms({ scenarios: [{ id: 1, steps: [1] }, { id: 2, steps: [] }, { id: 3, steps: [1] }] }, { id: 1, steps: [1] }).map((s) => s.id).join()`), "3",
    "sin la propia (por id) ni las vacías");
  assert.equal(c.run(`FluyoStoryClock.phaseOutcome("playing", null, null, null)`), "", "reproduciendo, nada");
});

test("C1 · kernel, codec, formato, render, ejemplos y fluyo-mcp intactos", () => {
  const KEEP = ["js/config.js", "js/safe-svg.js", "js/model.js", "js/scenario-engine.js", "js/scenario-playback.js", "js/story-playback.js", "js/document-integrity.js",
    "js/story-authoring.js", "js/render.js", "js/link-codec.js", "js/deeplink.js", "js/examples.js", "js/editor-scenarios.js", "ejemplos"];
  assert.equal(execFileSync("git", ["-C", gitRoot, "diff", "--name-only", BASE, "--", ...KEEP], { encoding: "utf8" }).trim(), "");
  const mcp = path.join(root, "..", "fluyo-mcp");
  if (fs.existsSync(path.join(mcp, ".git"))) {
    assert.equal(execFileSync("git", ["-C", mcp, "rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim(), "464f4e0", "fluyo-mcp sigue en 464f4e0");
    assert.equal(execFileSync("git", ["-C", mcp, "status", "--porcelain", "--untracked-files=no"], { encoding: "utf8" }).trim(), "", "sin cambios en fluyo-mcp");
  }
});

test("C2 · alcance frente a 7aa22f1: solo estos archivos servidos; undoS2a (para los alcances antiguos) los devuelve EXACTOS", () => {
  const SERVED = ["js", "s", "css", "assets", "index.html", "404.html", "sw.js", "manifest.webmanifest", "docs", "ejemplos", "privacidad", "privacy", "soporte", "support", "terminos", "terms"];
  const { undoS2a, PIECES, NEW_FILES } = require("./fluyo-stories-2-0-s2a-undo.cjs");
  const changed = execFileSync("git", ["-C", gitRoot, "diff", "--name-only", BASE, "--", ...SERVED], { encoding: "utf8" }).split("\n").filter(Boolean);
  const untracked = execFileSync("git", ["-C", gitRoot, "ls-files", "--others", "--exclude-standard", "--", ...SERVED], { encoding: "utf8" }).split("\n").filter(Boolean);
  assert.deepEqual([...new Set([...changed, ...untracked])].sort(), ["css/share.css", "css/styles.css", "index.html", "js/editor-share.js", "js/i18n-en-editor.js", "js/i18n-en.js",
    "js/present-story.js", "js/share-url.js", "js/story-clock.js", "js/viewer.js", "s/index.html", "sw.js"]);
  assert.deepEqual(NEW_FILES, []);
  const noCache = (t) => t.replace(/\r\n/g, "\n").replace(/const CACHE = "fluyo-static-v\d+";/, "");
  for (const f of Object.keys(PIECES).concat("sw.js")) assert.equal(noCache(undoS2a(f, read(f))), noCache(atBase(f)), f + ": undoS2a exacto");
});

test("C3 · claves nuevas en inglés y usadas; sin Undo, analíticas ni campos nuevos; CACHE v119", () => {
  const diff = execFileSync("git", ["-C", gitRoot, "diff", "-U0", BASE, "--", "js", "s", "index.html"], { encoding: "utf8" }).split("\n").filter((l) => /^\+[^+]/.test(l)).join("\n");
  const html = read("index.html") + read("s/index.html"), es = read("js/editor-share.js"), en = read("js/i18n-en.js"), ene = read("js/i18n-en-editor.js");
  for (const k of ["share.others", "share.noteStoryOthers", "share.othersTooLarge"]) {
    assert.ok((es + html).includes(`"${k}"`), k + " se usa");
    assert.ok(ene.includes(`"${k}":`), k + " en inglés (editor)");
  }
  assert.ok(html.includes('data-i18n="story.others"') && en.includes('"story.others":"Other ways"'), "«Otras formas» / «Other ways»");
  assert.doesNotMatch(diff, /pushUndo|undoStack|trackEvent|scheduleAutosave/, "nada nuevo entra en Undo, autoguardado ni analíticas");
  assert.doesNotMatch(diff, /\.(purpose|variantOf|family)\b/, "ningún campo nuevo en el documento");
  assert.match(read("sw.js"), /const CACHE = "fluyo-static-v119";/);
});
