"use strict";
/* FLUYO-I18N-001 — Idioma de la interfaz: infraestructura mínima (js/i18n.js + js/i18n-en.js) y la vertical slice (cabecera del
   editor, mando de Present y Viewer completo).
   · runtime: t() en español devuelve el texto base sin diccionario; en inglés, el del diccionario; falta → español + missing();
     marcadores, plurales; idioma de la carga (?lang › preferencia › español; sin detección automática); applyDom y vuelta atrás.
   · catálogo: cada clave tiene UN texto base en todo el código y el HTML; el inglés tiene exactamente esas claves, sin vacíos y
     con los mismos marcadores; toda llamada lleva clave y texto literales (comprobables sin ejecutar).
   · regiones migradas: ni un texto ni atributo visible sin marca.
   · trinquete: el texto sin migrar de cada archivo (test/fluyo-i18n-001-baseline.json) puede bajar, nunca subir.
   · Viewer y Present en vm, en inglés y en español (el español, byte a byte el de siempre).
   · alcance: el documento y el kernel del MCP no cambian; undoI18n (para los alcances antiguos) devuelve EXACTA la base.
   Chrome real: test/fluyo-i18n-001-browser.cjs. */
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const scan = require("./i18n-scan.cjs");
const { makeViewer } = require("./viewer-harness.cjs");

const root = path.join(__dirname, "..");
const gitRoot = process.env.FLUYO_GIT_ROOT || root;
const read = scan.read;
const BASE = "e82c821";
const atBase = (f) => execFileSync("git", ["-C", gitRoot, "show", BASE + ":" + f], { encoding: "utf8" }).replace(/\r\n/g, "\n");

/* El runtime en un contexto propio: location/localStorage/document opcionales. */
function i18n({ search = "", stored = null, languages = [], document, withEn = true } = {}) {
  const store = new Map(stored === null ? [] : [["fluyo.ui.lang", stored]]);
  const ctx = vm.createContext({ URLSearchParams, Intl, location: { search }, navigator: { languages },
    localStorage: { getItem: (k) => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)) }, document });
  if (withEn) vm.runInContext(read("js/i18n-en.js"), ctx);
  vm.runInContext(read("js/i18n.js"), ctx);
  ctx.store = store;
  ctx.I = vm.runInContext("FluyoI18n", ctx);   /* const de nivel superior: no es propiedad del contexto */
  return ctx;
}
const EN = (() => { const c = vm.createContext({}); vm.runInContext(read("js/i18n-en.js"), c); return c.FLUYO_LOCALES.en; })();

/* ───────────── runtime ───────────── */

test("runtime · español: t() devuelve el texto base tal cual, sin mirar ningún diccionario", () => {
  const c = i18n();
  assert.equal(c.I.locale(), "es");
  assert.equal(c.I.t("present.exit", "Salir"), "Salir");
  assert.equal(c.I.t("clave.inexistente", "Texto base"), "Texto base");
  assert.deepEqual([...c.I.missing()], [], "en español no falta nada: el texto base ES el español");
  assert.equal(c.I.t("story.kicker", "Historia · {name}", { name: "Pago" }), "Historia · Pago");
});

test("runtime · inglés: diccionario; una clave sin traducción cae al español y queda anotada; nunca se pinta una clave", () => {
  const c = i18n({ search: "?lang=en" });
  assert.equal(c.I.locale(), "en");
  assert.equal(c.I.t("present.exit", "Salir"), "Exit");
  assert.equal(c.I.t("story.kicker", "Historia · {name}", { name: "Pago" }), "Story · Pago", "el nombre (contenido del autor) no se traduce");
  assert.equal(c.I.t("no.existe", "Texto base"), "Texto base");
  assert.deepEqual([...c.I.missing()], ["en:no.existe"]);
  assert.equal(c.I.t("page.untitled", "Página {n}", { n: 3 }), "Page 3");
  assert.equal(c.I.t("x", "{a} y {b}", { a: "{b}" }), "{b} y {b}", "una pasada: lo insertado no se vuelve a interpretar");
});

test("runtime · plurales con Intl.PluralRules (params.count)", () => {
  const es = i18n(), en = i18n({ search: "?lang=en" });
  const P = { one: "{count} página", other: "{count} páginas" };
  assert.equal(es.I.t("p", P, { count: 1 }), "1 página");
  assert.equal(es.I.t("p", P, { count: 4 }), "4 páginas");
  assert.equal(es.I.t("p", P, { count: 0 }), "0 páginas");
  vm.runInContext('FLUYO_LOCALES.en.p = {one:"{count} page", other:"{count} pages"};', en);
  assert.equal(en.I.t("p", P, { count: 1 }), "1 page");
  assert.equal(en.I.t("p", P, { count: 2 }), "2 pages");
});

test("runtime · idioma de la carga: ?lang › preferencia de este navegador › español; sin detección automática; lo desconocido es español", () => {
  assert.equal(i18n({ search: "?lang=en", stored: "es" }).I.locale(), "en", "la URL manda en esta carga");
  assert.equal(i18n({ search: "?lang=EN-us" }).I.locale(), "en", "etiqueta BCP 47 normalizada");
  assert.equal(i18n({ stored: "en" }).I.locale(), "en", "la preferencia guardada");
  assert.equal(i18n({ search: "?lang=fr", stored: "en" }).I.locale(), "en", "un idioma sin diccionario se ignora");
  assert.equal(i18n({ search: "?lang=fr" }).I.locale(), "es");
  assert.equal(i18n({ languages: ["en-US", "en"] }).I.locale(), "es", "AUTO_DETECT apagado: nadie ve una interfaz a medias sin pedirla");
  assert.equal(i18n({ search: "?lang=en", withEn: false }).I.locale(), "es", "sin el diccionario cargado, español");
  assert.deepEqual([...i18n().I.supported()], ["es", "en"]);
  assert.match(read("js/i18n.js"), /const AUTO_DETECT=false;/);
});

test("runtime · setLocale: persist guarda la preferencia (solo en este navegador); sin persist, no", () => {
  const c = i18n();
  assert.equal(c.I.setLocale("en"), "en");
  assert.equal(c.store.has("fluyo.ui.lang"), false);
  c.I.setLocale("es", { persist: true });
  assert.equal(c.store.get("fluyo.ui.lang"), "es");
  assert.equal(c.I.setLocale("xx"), "es");
});

/* DOM falso mínimo: elementos con atributos, hijos y nodos de texto. */
function fakeDom() {
  const all = [];
  const text = (data) => ({ nodeType: 3, data });
  const el = (attrs, children = []) => {
    const e = { nodeType: 1, attrs: { ...attrs }, childNodes: children, get children() { return this.childNodes.filter((n) => n.nodeType === 1); },
      getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }, setAttribute(k, v) { this.attrs[k] = String(v); },
      get textContent() { return this.childNodes.map((n) => n.nodeType === 3 ? n.data : n.textContent).join(""); },
      set textContent(v) { this.childNodes = [text(v)]; } };
    all.push(e); return e;
  };
  const doc = { documentElement: { lang: "es" }, querySelectorAll: (sel) => { const a = sel.slice(1, -1); return all.filter((e) => a in e.attrs); } };
  return { doc, el, text };
}

test("runtime · applyDom: texto propio (con su glifo), atributos y <html lang>; volver al español sin recargar", () => {
  const { doc, el, text } = fakeDom();
  const play = el({ "data-i18n": "story.playStory" }, [text("▶ Reproducir historia")]);
  const icon = el({}, []);
  const exit = el({ "data-i18n": "present.exit", "data-i18n-title": "present.exitLong", title: "Salir de la presentación" }, [icon, text("Salir")]);
  const rest = el({ "data-i18n": "viewer.openRest" }, [text(" en Fluyo")]);
  const open = el({ "data-i18n": "viewer.openShort" }, [text("Abrir"), rest]);
  const tip = el({ "data-i18n-tip": "editor.undoHint", "data-tip": "Deshacer · Ctrl+Z" }, []);
  const c = i18n({ search: "?lang=en", document: doc });
  assert.equal(doc.documentElement.lang, "en", "al cargar en inglés ya traduce lo marcado");
  assert.equal(play.textContent, "▶ Play story");
  assert.equal(exit.textContent, "Exit");
  assert.equal(exit.childNodes[0], icon, "el icono sigue siendo el primer hijo");
  assert.equal(exit.getAttribute("title"), "Exit presentation");
  assert.equal(open.textContent, "Open in Fluyo", "«Abrir» y su resto (lblRest, solo escritorio) por separado");
  assert.equal(tip.getAttribute("data-tip"), "Undo · Ctrl+Z");
  c.I.setLocale("es");
  assert.equal(doc.documentElement.lang, "es");
  assert.equal(play.textContent, "▶ Reproducir historia");
  assert.equal(exit.getAttribute("title"), "Salir de la presentación");
  assert.equal(open.textContent, "Abrir en Fluyo");
  assert.equal(tip.getAttribute("data-tip"), "Deshacer · Ctrl+Z");
});

test("runtime · en español no toca el DOM al cargar (el HTML ya es el texto base)", () => {
  const { doc, el, text } = fakeDom();
  const b = el({ "data-i18n": "present.exit" }, [text("Salir")]);
  doc.documentElement.lang = "xx";
  i18n({ document: doc });
  assert.equal(doc.documentElement.lang, "xx");
  assert.equal(b.textContent, "Salir");
});

/* ───────────── catálogo ───────────── */

test("catálogo · toda llamada FluyoI18n.t lleva clave y texto base LITERALES", () => {
  const { uses, callCount } = scan.catalog();
  for (const [f, n] of Object.entries(callCount)) assert.equal(uses.filter((u) => u.file === f).length, n, f + ": cada FluyoI18n.t( se lee sin ejecutar");
  for (const u of uses) {
    assert.ok(typeof u.key === "string" && /^[a-z]+(\.[a-zA-Z]+)+$/.test(u.key), `${u.file}:${u.line} clave literal con forma superficie.nombre: ${u.raw}`);
    assert.ok(u.es !== null && u.es !== "", `${u.file}:${u.line} texto base literal: ${u.raw}`);
  }
});

test("catálogo · una clave, un texto: el mismo español en todo el código y el HTML", () => {
  const by = new Map();
  for (const u of scan.catalog().uses) (by.get(u.key) || by.set(u.key, new Map()).get(u.key)).set(JSON.stringify(u.es), u.file + ":" + u.line + " " + u.raw);
  for (const [k, v] of by) assert.equal(v.size, 1, `«${k}» tiene ${v.size} textos: ${[...v.entries()].map(([t, w]) => t + " (" + w + ")").join(" · ")}`);
});

test("catálogo · el inglés tiene exactamente las claves en uso, sin vacíos, con los mismos marcadores", () => {
  const base = new Map(scan.catalog().uses.map((u) => [u.key, u.es]));
  assert.deepEqual(Object.keys(EN).filter((k) => !base.has(k)), [], "claves de más en js/i18n-en.js (texto que nadie usa)");
  assert.deepEqual([...base.keys()].filter((k) => !(k in EN)), [], "claves sin traducir en js/i18n-en.js");
  for (const [k, es] of base) {
    const en = EN[k];
    assert.ok(typeof en === typeof es && (typeof en !== "string" || en.trim()), k + ": vacío o de otra forma (texto/plural)");
    assert.deepEqual(scan.placeholders(en), scan.placeholders(es), k + ": mismos marcadores {param}");
    if (typeof es === "object") assert.deepEqual(Object.keys(en).sort(), Object.keys(es).sort(), k + ": mismas formas de plural");
  }
});

test("regiones migradas · cabecera del editor, mando de Present y Viewer: ni un texto ni atributo visible sin marca", () => {
  assert.deepEqual(scan.unmarked("index.html", "<header>", '<div id="canvasMenu"'), [], "cabecera del editor");
  assert.deepEqual(scan.unmarked("index.html", '<div id="presentBar">', "<!-- Encabezado de la Historia en Present"), [], "mando de Present");
  assert.deepEqual(scan.unmarked("s/index.html", "<head>", "<!-- Core compartido"), [], "Viewer (título incluido)");
  assert.match(read("s/index.html"), /<title data-i18n="viewer\.docTitle">Diagrama compartido · Fluyo<\/title>/);
});

test("trinquete · el texto sin migrar de cada archivo no crece (baja → reescribe la línea base con node test/i18n-scan.cjs --write-baseline)", () => {
  const base = JSON.parse(read(scan.BASELINE)), now = scan.hardcoded();
  for (const kind of ["js", "html"]) {
    for (const [f, n] of Object.entries(now[kind])) assert.ok(n <= (base[kind][f] || 0), `${f}: ${n} textos sin migrar (línea base ${base[kind][f] || 0}). Pásalos por FluyoI18n.t / data-i18n.`);
    for (const [f, n] of Object.entries(base[kind])) assert.ok((now[kind][f] || 0) >= n, `${f}: bajó a ${now[kind][f] || 0} (línea base ${n}). Reescribe la línea base para fijar lo ganado.`);
  }
});

test("trinquete · el detector sí ve texto nuevo sin migrar (JS y HTML)", () => {
  assert.equal(scan.jsHardcoded('el.textContent="Guardar cambios";').length, 1);
  assert.equal(scan.jsHardcoded('el.textContent=FluyoI18n.t("x.y","Guardar cambios");').length, 0);
  assert.equal(scan.jsHardcoded('if(s.shape==="FLOW") cls="psFlow isOk";').length, 0, "enums y clases no son texto");
  assert.equal(scan.scanHtml('<div><button title="Cerrar">Cerrar</button></div>').issues.length, 2);
  assert.equal(scan.scanHtml('<div><button title="Cerrar" data-i18n-title="a.b" data-i18n="a.b">Cerrar</button></div>').issues.length, 0);
});

/* ───────────── Viewer y Present ───────────── */

/* Un Share con Historia, construido con el propio modelo (como test/fluyo-014.test.cjs). */
const PAGO = `
  const pg=P(); pg.nodes=[N(1,200,"Cliente"),N(2,600,"Comercio")]; pg.edges=[{id:3,from:1,to:2,label:""}]; pg.nextId=4;
  const sc=createScenario(pg,"Cliente paga a Comercio");
  const pago=createEventType({name:"Pago",primitive:"FLOW",sentenceTemplate:"{source} paga a {target}",visual:{value:"💵"}});
  createStep(sc,{at:0,action:"SEND",edgeId:3,eventTypeId:pago.id});
  createStep(sc,{at:2000,action:"SEND",edgeId:3,eventTypeId:pago.id});`;
async function shared(search) {
  const b = makeViewer();
  const project = JSON.parse(JSON.stringify(b.run(`(function(){
    doc={theme:"dark",customBg:"",eventTypes:[],nextEventTypeId:1,pages:[blankPage("Página 1")],cur:0};
    const N=(id,x,label)=>({id,shape:"rect",x,y:240,w:170,h:76,label,color:"#3aa7e8"});
    ${PAGO}
    return serializeProject();
  })()`)));
  b.run(read("js/share-url.js")); b.context.project = project; b.context.location.href = "https://fluyo.space/";
  const hash = new URL(await b.run('createShareUrl(project,"https://fluyo.space/",{story:true})')).hash;
  const v = makeViewer({ search, hash });
  await v.boot(); await v.waitForPhase((p) => p === "ready" || p === "error");
  return v;
}

test("Viewer en inglés (?lang=en): banda, rótulo, pausa, páginas sin nombre, avisos; el contenido del autor, intacto", async () => {
  const v = await shared("?lang=en");
  assert.equal(v.run("FluyoI18n.locale()"), "en");
  assert.equal(v.viewer().phase, "ready");
  assert.equal(v.el("stKicker").textContent, "Story");
  assert.equal(v.el("stPlay").textContent, "▶ Play story");
  assert.equal(v.el("stTitle").textContent, "Cliente paga a Comercio", "el título es contenido del autor: no se traduce");
  v.el("stPlay").onclick(); v.frames(2);
  assert.equal(v.el("stKicker").textContent, "Story · Cliente paga a Comercio");
  assert.equal(v.el("stStop").textContent, "■ Stop");
  assert.equal(v.el("stPause").textContent, "Pause");
  v.run("storyTogglePause()"); v.frames(1);
  assert.equal(v.el("stPause").textContent, "Resume");
  assert.match(v.el("stCaption").textContent, /^Paused( · |$)/, "«En pausa» de la interfaz (+ la frase del autor si ya la hay)");
  v.run("doc.pages[0].name=''; buildTabs();");
  /* el DOM falso del harness acumula hijos al reconstruir: se busca la pestaña y la opción del selector */
  assert.ok(v.el("pgTabs").children.some((b) => b.textContent === "Page 1"), "pestaña");
  assert.ok(v.el("pgSelect").children.some((o) => o.textContent === "01 · Page 1"), "selector");
  assert.deepEqual([...v.run("FluyoI18n.missing()")], []);
  const bad = makeViewer({ search: "?s=otra&lang=en" });
  await bad.boot();
  assert.equal(bad.el("status").textContent, "The diagram link isn't valid.");
});

test("Viewer en español: exactamente los textos de siempre", async () => {
  const v = await shared("");
  assert.equal(v.run("FluyoI18n.locale()"), "es");
  assert.equal(v.el("stKicker").textContent, "Historia");
  assert.equal(v.el("stPlay").textContent, "▶ Reproducir historia");
  v.el("stPlay").onclick(); v.frames(2);
  assert.equal(v.el("stKicker").textContent, "Historia · Cliente paga a Comercio");
  assert.equal(v.el("stStop").textContent, "■ Detener");
  v.run("storyTogglePause()"); v.frames(1);
  assert.equal(v.el("stPause").textContent, "Reanudar");
  assert.match(v.el("stCaption").textContent, /^En pausa( · |$)/);
  v.run("doc.pages[0].name=''; buildTabs();");
  assert.ok(v.el("pgTabs").children.some((b) => b.textContent === "Página 1"));
  const bad = makeViewer({ search: "?s=otra" });
  await bad.boot();
  assert.equal(bad.el("status").textContent, "El enlace del diagrama no es válido.");
});

/* Present del editor: presentStoryRefresh con el estado mínimo que lee (Historia, fase, describe). */
function present(lang, phase) {
  const els = {};
  const $ = (id) => (els[id] ||= { id, hidden: false, disabled: false, className: "", textContent: "", title: "", attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } });
  const ctx = vm.createContext({ URLSearchParams, Intl, location: { search: lang === "en" ? "?lang=en" : "" }, $, document: {}, presenting: true,
    scActiveScenario: () => ({ name: "Pago", steps: [{}] }), scStatus: phase === "ready" ? "idle" : phase === "finished" ? "completed" : "running",
    scIsPaused: () => phase === "paused", scErrors: [], scPlayback: null, scNodeFallback: () => "", edgeById: () => null, doc: { pages: [{}, {}] },
    FluyoPresentStory: { MAX_DOTS: 12 }, FluyoStory: { describe: () => ({ title: "Pago", moments: [{ label: "a" }], idx: 0, caption: "Cliente paga", summary: "" }) } });
  vm.runInContext(read("js/i18n-en.js"), ctx);
  vm.runInContext(read("js/i18n.js"), ctx);
  vm.runInContext(read("js/present-story.js"), ctx);
  vm.runInContext("presentStoryRefresh()", ctx);
  return els;
}
test("Present en inglés: Reproducir/Repetir/Detener y «En pausa»; la consecuencia (texto del modelo) no cambia", () => {
  assert.equal(present("en", "ready").psPlay.textContent, "▶ Play");
  assert.equal(present("en", "finished").psPlay.textContent, "↻ Replay");
  const p = present("en", "paused");
  assert.equal(p.psStop.textContent, "■ Stop");
  assert.equal(p.psCaption.textContent, "Paused · Cliente paga");
  assert.equal(present("es", "ready").psPlay.textContent, "▶ Reproducir");
  assert.equal(present("es", "paused").psCaption.textContent, "En pausa · Cliente paga");
});

test("Present: el botón de aspecto (ui.js) en inglés y en español", () => {
  const ui = read("js/ui.js");
  const slice = ui.slice(ui.indexOf("function syncPresentSkinButton"), ui.indexOf("function updatePresentBar"));
  for (const [lang, flat, built] of [["en", ["Flat", "Flat look · press B for the built look"], ["Built", "Built look (2.5D) · press B for the flat look"]],
    ["es", ["Plano", "Aspecto plano · pulsa B para ver el construido"], ["Construido", "Aspecto construido (2.5D) · pulsa B para ver el plano"]]]) {
    const b = { textContent: "", title: "", attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } };
    const ctx = vm.createContext({ URLSearchParams, Intl, location: { search: "?lang=" + lang }, settings: {}, $: () => b, projectSkin: (st) => st.skin === "built" ? "built" : "flat" });
    vm.runInContext(read("js/i18n-en.js") + read("js/i18n.js") + slice, ctx);
    vm.runInContext("syncPresentSkinButton()", ctx);
    assert.deepEqual([b.textContent, b.title], flat, lang);
    vm.runInContext('settings.skin="built"; syncPresentSkinButton()', ctx);
    assert.deepEqual([b.textContent, b.title], built, lang);
  }
});

/* ───────────── carga y alcance ───────────── */

test("carga: diccionario → runtime → config.js en el editor y en el Viewer; ambos en el precache; CACHE v105", () => {
  for (const [page, pre] of [["index.html", "js/"], ["s/index.html", "../js/"]]) {
    const h = read(page), at = (f) => h.indexOf('<script src="' + pre + f + '"></script>');
    assert.ok(at("i18n-en.js") > 0 && at("i18n-en.js") < at("i18n.js") && at("i18n.js") < at("config.js"), page);
  }
  const sw = read("sw.js");
  assert.match(sw, /const CACHE = "fluyo-static-v107";/);
  assert.ok(sw.includes('"./js/i18n-en.js"') && sw.includes('"./js/i18n.js"'));
  assert.doesNotMatch(read("s/index.html"), /<script>(?!\s*$)/, "el Viewer sigue sin script en línea (CSP)");
});

test("alcance: el documento, el formato y el kernel del MCP no cambian; i18n no es kernel; nada se guarda en el documento", () => {
  const { undoNarr } = require("./fluyo-product-narration-001-undo.cjs");   /* FLUYO-PRODUCT-NARRATION-001 va encima (kernel): se deshace antes */
  for (const f of ["js/config.js", "js/safe-svg.js", "js/model.js", "js/scenario-engine.js", "js/scenario-playback.js", "js/story-playback.js",
    "js/document-integrity.js", "js/story-authoring.js", "js/story-clock.js", "js/flow-semantics.js", "js/render.js", "js/export.js", "js/state.js",
    "js/deeplink.js", "js/share-url.js", "js/link-codec.js", "js/share-loader.js"]) assert.equal(undoNarr(f, read(f)), atBase(f), f + " sin cambios");
  const src = read("js/i18n.js");
  assert.doesNotMatch(src, /\bdoc\b|settings|projectToSerializable|scheduleAutosave/, "el runtime no lee ni escribe el documento");
  assert.match(src, /STORAGE_KEY="fluyo\.ui\.lang"/, "la preferencia es del navegador, como fluyo.ui.theme");
});

test("undoI18n (para los alcances de slices anteriores) devuelve EXACTOS a la base los archivos servidos que cambia esta tarea; undoMsg la aplica antes que undo030", () => {
  const { undoI18n, PIECES, BASE_I18N, NEW_FILES } = require("./fluyo-i18n-001-undo.cjs");
  assert.equal(BASE_I18N, BASE);
  assert.deepEqual(Object.keys(PIECES).sort(), ["index.html", "js/editor-scenarios.js", "js/present-story.js", "js/ui.js", "js/viewer.js", "s/index.html", "sw.js"]);
  for (const f of Object.keys(PIECES)) {
    let out = undoI18n(f, read(f));
    if (f === "sw.js") out = out.replace('"fluyo-static-v107"', '"fluyo-static-v' + (105 - 1) + '"');
    assert.equal(out, atBase(f), f);
  }
  assert.deepEqual(NEW_FILES, ["js/i18n.js", "js/i18n-en.js"]);
  assert.ok(read("test/fluyo-step-message-001-undo.cjs").includes("src = undo029(file, undo030(file, undoI18n(file, src)));"), "undoMsg deshace esta tarea antes que 018.30 y 018.29");
});
