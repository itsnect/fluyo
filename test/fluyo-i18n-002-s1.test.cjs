"use strict";
/* FLUYO-I18N-002 S1 — El cromo del editor en inglés (cabecera, Lienzo, Más, rail, cajones, barra táctil, cabecera y vacío del panel,
   selección múltiple, vista, pestañas y menú de página, Compartir, Exportar y su progreso, sesión guardada, enlace entrante, avisos
   de abrir/imagen/GIF/enlace).
   · regiones: ni un texto ni atributo visible sin marca en el cromo de S1; lo que queda fuera está registrado (ayuda con marcado,
     <title>/SEO, el rótulo de reproducción de Historias) y no puede crecer;
   · JS: los archivos del cromo sin texto de interfaz suelto; lo que queda es de S2/S3 o no es interfaz (registrado);
   · inglés completo y sin restos en español; fr/ja/zh sin claves nuevas (caen al inglés) y sin publicar;
   · español igual: texto visible del HTML idéntico al de la base; recuentos, plurales y avisos de JS con el mismo español;
   · contenido del autor: solo viaja como parámetro (nombres de página y de Historia), nunca como clave ni texto base;
   · data-i18n-js: lo que pinta JS lleva en el HTML el mismo texto base que su FluyoI18n.t, y applyDom no lo toca;
   · alcance frente a 41361b5: solo estos archivos; undoS1 da la base EXACTA y va debajo de undoS0; kernel, Historias, Viewer,
     Narration y formato intactos; sw.js solo sube CACHE (v110).
   Chrome real: test/fluyo-i18n-002-s1-browser.cjs. */
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const scan = require("./i18n-scan.cjs");

const root = path.join(__dirname, "..");
const gitRoot = process.env.FLUYO_GIT_ROOT || root;
const read = scan.read;
const BASE = "41361b5";
const atBase = (f) => execFileSync("git", ["-C", gitRoot, "show", BASE + ":" + f], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).replace(/\r\n/g, "\n");
const hasGit = (() => { try { atBase("sw.js"); return true; } catch { return false; } })();
const DICTS = scan.dictionaries();
const EN = { ...DICTS.en.common, ...DICTS.en.editor };
const DICT_FILES = fs.readdirSync(path.join(root, "js")).map((f) => "js/" + f).filter((f) => scan.DICT.test(f)).sort();

/* Las regiones del cromo de S1 en index.html, sin lo registrado fuera de S1. */
const HTML = read("index.html");
const cut = (from, to) => { const a = HTML.indexOf(from), b = HTML.indexOf(to, a); assert.ok(a >= 0 && b > a, "región: " + from); return HTML.slice(a, b); };
const HELP = /<ul class="helpList">[\s\S]*?<\/ul>/;
const SCNOW = /<div id="scNow"[\s\S]*?<\/div>/;
const REGIONS = {
  "cabecera, Lienzo y Más (sin la ayuda con marcado)": () => cut("<header>", "</header>").replace(HELP, ""),
  "rail, lienzo, barra táctil, cabecera y vacío del panel, selección múltiple (sin el rótulo de Historias)": () => cut("<main>", '<div id="selBody"').replace(SCNOW, ""),
  "barra inferior, Present, Compartir, Exportar, progreso, sesión guardada y enlace entrante": () => cut('<div id="bottomBar">', '<script src="js/i18n-en.js">'),
};

test("regiones de S1: ni un texto ni atributo visible sin marca", () => {
  for (const [name, get] of Object.entries(REGIONS)) assert.deepEqual(scan.scanHtml(get()).issues, [], name);
});

test("lo que queda fuera de S1 en esas regiones está registrado y no crece: la ayuda con marcado (13 líneas), el <title> y el rótulo de reproducción", () => {
  const help = HTML.match(HELP)[0];
  assert.equal((help.match(/<li>/g) || []).length, 13, "13 líneas de ayuda con <kbd>/<b> dentro de la frase: necesitan texto con marcado (decisión abierta)");
  assert.doesNotMatch(help, /data-i18n/, "la ayuda sigue sin migrar (no se parchea con traducciones literales por fragmentos)");
  assert.equal(scan.scanHtml(HTML.match(SCNOW)[0]).issues.map((i) => i.text).join(), "Reproduciendo", "el rótulo de reproducción es de Historias (S2)");
  const head = scan.scanHtml(cut("<head>", "</head>")).issues.map((i) => i.text);
  assert.deepEqual(head, ["Fluyo — editor de diagramas de arquitectura animados con export a GIF"], "<title> y SEO: S7");
});

/* Lo que queda en los JS del cromo: de otras slices o no es interfaz (teclas, fuentes, console, claves de datos). */
const LEFT_OK = {
  "js/editor-share.js": [],
  "js/editor-runtime.js": [],
  "js/deeplink.js": ["No se pudo abrir el diagrama del enlace:"],                       // console.warn
  "js/state.js": ["Autosave failed:"],                                                    // console.warn
  "js/interaction.js": ["Enter", "Escape", "Backspace", "Home", "End", "Delete"],          // nombres de tecla
  "js/examples.js": ["Funnel de ventas", "Onboarding de cliente", "Cadena de suministro", "Pipeline de eventos con Apache Kafka", "Arquitectura de microservicios con API Gateway",
    "Flujo de autenticación OAuth 2.0", "Pipeline ETL de datos", "Arquitectura serverless en AWS", "No se pudo cargar el ejemplo «"],   // títulos de ejemplo (S7) y console.warn
  "js/export.js": ["Ejemplo", "Ejemplo ", "Funnel de ventas", "Visitantes", "Leadnregistrado", "¿Califica?", "Oportunidad", "Propuestanenviada", "Cliente", "Descartado", "sí"],   /* (el léxico del escáner lee \n como «n») */   // ejemplo incorporado: valor sembrado (S3)
};
test("JS del cromo: sin texto de interfaz suelto; lo que queda es de otras slices o no es interfaz", () => {
  for (const [f, ok] of Object.entries(LEFT_OK)) {
    const left = [...new Set(scan.jsHardcoded(read(f)).map((x) => x.s))];
    assert.deepEqual(left.filter((s) => !ok.includes(s)), [], f);
  }
  /* ui.js: lo que queda es de Propiedades (S2), Historias (S2), teclas, fuentes o claves de datos; ninguno de los textos de S1 */
  const ui = scan.jsHardcoded(read("js/ui.js")).map((x) => x.s);
  for (const s of ["Nueva página", "Renombrar…", "Eliminar página", "Nombre de la página", "Guardar nombre", "Opciones de la página", "Toca el elemento de destino",
    "Toca elementos para seleccionarlos", " seleccionados", " seleccionado", " elementos", "Propiedades", "GIFs animados", "Clásicas", "Play", "Pausa"]) {
    assert.ok(!ui.some((x) => (/\s/.test(s.trim()) || s.startsWith(" ") ? x.includes(s) : x === s)), "ui.js aún tiene «" + s + "» fuera de FluyoI18n.t");
  }
  assert.ok(!scan.jsHardcoded(read("js/ui.js")).some((x) => /^Limpiar página/.test(x.s)), "ui.js: la confirmación de Limpiar página pasa por FluyoI18n.t");
});

test("inglés completo, sin restos en español; fr/ja/zh sin claves nuevas (caen al inglés) y sin publicar", () => {
  const keys = new Set(scan.catalog().uses.map((u) => u.key));
  assert.deepEqual([...keys].filter((k) => !(k in EN)), [], "claves sin inglés");
  for (const [k, v] of Object.entries(EN)) for (const s of typeof v === "string" ? [v] : Object.values(v)) {
    assert.doesNotMatch(s, /[ñáíóú¿¡«»]|\b(el|la|los|las|de|del|que|una?|para|con|por)\b/, `en ${k}: «${s}» parece español`);
  }
  const s1Keys = [...keys].filter((k) => !(k in (scan.dictionaries().fr.common)) && !(k in DICTS.fr.editor));
  for (const code of ["fr", "ja", "zh"]) {
    const d = { ...DICTS[code].common, ...DICTS[code].editor };
    assert.deepEqual(s1Keys.filter((k) => k in d), [], code + ": las claves de S1 llegan en S5, con su revisión nativa");
  }
  const ctx = vm.createContext({ URLSearchParams, Intl, location: { search: "" }, navigator: { languages: ["en-US"] } });
  for (const f of DICT_FILES) vm.runInContext(read(f), ctx);
  vm.runInContext(read("js/i18n.js"), ctx);
  assert.deepEqual([...vm.runInContext("FluyoI18n.released()", ctx)], ["es"], "nada se publica en S1 (sin selector ni detección)");
  assert.equal(vm.runInContext("FluyoI18n.locale()", ctx), "es", "un sistema en inglés sigue viendo español");
});

/* El texto visible del HTML (sin marcas ni atributos) */
const visibleText = (html) => html.replace(/<!--[\s\S]*?-->/g, "").replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "")
  .replace(/<[^>]+>/g, "\u0000").split("\u0000").map((s) => s.trim()).filter(Boolean);
test("español igual: el texto del HTML es el de la base (la frase de «Compartir historia» la pinta ahora JS, con el mismo español)", { skip: !hasGit }, () => {
  const now = visibleText(HTML), base = visibleText(atBase("index.html"));
  const gone = base.filter((s, i) => !now.includes(s));
  assert.deepEqual(gone, ["Quien abra el enlace podrá verla suceder: «", "»."], "solo la frase partida alrededor del nombre de la Historia");
  assert.deepEqual(now.filter((s) => !base.includes(s)), [], "ningún texto nuevo");
  const share = read("js/editor-share.js");
  assert.match(share, /FluyoI18n\.t\("share\.storyHint","Quien abra el enlace podrá verla suceder: «\{name\}»\.",\{name:"\\u0000"\}\)\.split\("\\u0000"\)/, "la misma frase entera, con el sitio del nombre como parámetro");
  assert.match(share, /span\.textContent=name;[\s\S]{0,200}replaceChildren\(document\.createTextNode\(parts\[0\]\), span, document\.createTextNode\(parts\.slice\(1\)\.join\(""\)\)\)/, "el nombre del autor en su propio nodo, como antes (texto · nombre · texto)");
});

/* Contexto con el runtime y los diccionarios, en un idioma */
function ctxIn(lang) {
  const ctx = vm.createContext({ URLSearchParams, Intl, location: { search: lang === "es" ? "" : "?lang=" + lang }, navigator: { languages: [] } });
  for (const f of DICT_FILES) vm.runInContext(read(f), ctx);
  vm.runInContext(read("js/i18n.js"), ctx);
  return ctx;
}
test("recuentos de la selección: el español de siempre; el inglés con su plural y su orden", () => {
  const ui = read("js/ui.js");
  const helpers = ui.slice(ui.indexOf("const selNodesText="), ui.indexOf("function syncSelMeta"));
  const old = (n, e) => { const p = []; if (n) p.push(n + (n === 1 ? " nodo" : " nodos")); if (e) p.push(e + (e === 1 ? " flecha" : " flechas")); return p.join(" y ") + " seleccionados"; };
  for (const [lang, want] of [["es", old], ["en", (n, e) => [n && n + (n === 1 ? " node" : " nodes"), e && e + (e === 1 ? " arrow" : " arrows")].filter(Boolean).join(" and ") + " selected"]]) {
    const ctx = ctxIn(lang);
    vm.runInContext(helpers + "; this.mc=(n,e)=>{ selN=new Set(Array.from({length:n},(_,i)=>i)); selE=new Set(Array.from({length:e},(_,i)=>i)); return multiCountText(); };", Object.assign(ctx, { selN: new Set(), selE: new Set() }));
    for (const [n, e] of [[2, 0], [0, 3], [1, 1], [3, 2], [1, 0]]) if (n + e > 0) assert.equal(ctx.mc(n, e), want(n, e), `${lang} ${n}/${e}`);
  }
  const es = ctxIn("es"), en = ctxIn("en");
  const P = { one: "{count} seleccionado", other: "{count} seleccionados" };
  assert.equal(vm.runInContext('FluyoI18n.t("touch.selected",' + JSON.stringify(P) + ',{count:1})', es), "1 seleccionado");
  assert.equal(vm.runInContext('FluyoI18n.t("touch.selected",' + JSON.stringify(P) + ',{count:4})', es), "4 seleccionados");
  assert.equal(vm.runInContext('FluyoI18n.t("touch.selected",' + JSON.stringify(P) + ',{count:4})', en), "4 selected");
  assert.equal(vm.runInContext('FluyoI18n.t("sel.title",{one:"{count} elemento", other:"{count} elementos"},{count:5})', en), "5 elements");
});

test("contenido del autor: solo viaja como parámetro y llega intacto (nombres de página y de Historia), nunca como clave ni como texto base", () => {
  for (const f of ["js/ui.js", "js/editor-share.js", "js/export.js", "js/deeplink.js", "js/examples.js", "js/state.js", "js/interaction.js", "js/editor-runtime.js"]) {
    for (const c of scan.calls(read(f))) {
      assert.ok(typeof c.key === "string" && c.es !== null, `${f}:${c.line} clave y texto base literales: ${c.raw}`);
      assert.doesNotMatch(c.raw, /\.(name|label|message)\s*[,)]/, `${f}:${c.line} un campo del documento no es clave ni texto base`);
    }
  }
  const en = ctxIn("en");
  const name = "Cliente solicita un préstamo {n} «x»";
  assert.equal(vm.runInContext(`FluyoI18n.t("share.storyHint","Quien abra el enlace podrá verla suceder: «{name}».",{name:${JSON.stringify(name)}})`, en), `Anyone who opens the link can watch it happen: “${name}”.`);
  assert.equal(vm.runInContext(`FluyoI18n.t("pages.selectAria","Página {n} de {total}: {name}. Cambiar de página",{n:2,total:3,name:"Página de pagos {total}"})`, en), "Page 2 of 3: Página de pagos {total}. Change page", "el nombre de la página no se traduce ni se reinterpreta");
});

test("data-i18n-js: lo que pinta JS lleva en el HTML el texto base de su clave; applyDom no lo toca", () => {
  const js = scan.scanHtml(HTML).marks.filter((m) => m.where === "js");
  assert.deepEqual(js.map((m) => m.key).sort(), ["canvas.animPause", "common.cancel", "editor.properties", "export.renderingIdle", "incoming.addIt", "incoming.openDiagram", "incoming.title", "share.noteDiagram", "share.titleDiagram"].sort());
  assert.doesNotMatch(read("js/i18n.js"), /data-i18n-js/, "el runtime no lo lee: es solo una marca para el catálogo");
  const doc = { documentElement: {}, querySelectorAll: (sel) => (sel === "[data-i18n]" ? [] : []) };
  const ctx = vm.createContext({ URLSearchParams, Intl, location: { search: "?lang=en" }, navigator: { languages: [] }, document: doc });
  for (const f of DICT_FILES) vm.runInContext(read(f), ctx);
  vm.runInContext(read("js/i18n.js"), ctx);
  assert.equal(doc.documentElement.lang, "en");
});

test("cambio de idioma en vivo: ui.js y editor-share.js repintan lo suyo", () => {
  const ui = read("js/ui.js"), share = read("js/editor-share.js");
  const onUi = ui.slice(ui.indexOf("FluyoI18n.onChange("));
  for (const fn of ["closePageMenu(false)", "paintChromeText()", "renderTabs()", "refreshPanel()", "syncTouchBar()"]) assert.ok(onUi.slice(0, 200).includes(fn), "ui.js: " + fn);
  assert.match(share, /FluyoI18n\.onChange\(\(\)=>\{ for\(const t of Object\.values\(shareTexts\)\) t\.paint\(\); \}\);/);
  assert.doesNotMatch(onUi.slice(0, 300), /pushUndo|scheduleAutosave|editObj|editEdge/, "repintar no toca el documento ni Deshacer");
});

test("alcance frente a " + BASE + ": solo el cromo del editor; undoS1 da la base EXACTA y va debajo de undoS0; kernel, Historias, Viewer, Narration y formato intactos; CACHE v110", { skip: !hasGit }, () => {
  const { undoS1, PIECES, NEW_FILES, BASE_S1 } = require("./fluyo-i18n-002-s1-undo.cjs");
  assert.equal(BASE_S1, BASE);
  assert.deepEqual(NEW_FILES, []);
  const FILES = ["index.html", "js/deeplink.js", "js/editor-runtime.js", "js/editor-share.js", "js/examples.js", "js/export.js", "js/i18n-en-editor.js", "js/i18n.js", "js/interaction.js", "js/state.js", "js/ui.js"];
  assert.deepEqual(Object.keys(PIECES).sort(), FILES);
  const SERVED = ["js", "s", "css", "assets", "index.html", "404.html", "sw.js", "manifest.webmanifest", "docs", "ejemplos", "privacidad", "privacy", "soporte", "support", "terminos", "terms"];
  const changed = execFileSync("git", ["-C", gitRoot, "diff", "--name-only", BASE, "--", ...SERVED], { encoding: "utf8" }).split("\n").filter(Boolean);
  const untracked = execFileSync("git", ["-C", gitRoot, "ls-files", "--others", "--exclude-standard", "--", ...SERVED], { encoding: "utf8" }).split("\n").filter(Boolean);
  assert.deepEqual([...new Set([...changed, ...untracked])].sort(), [...FILES, "sw.js"].sort());
  for (const f of FILES) assert.equal(undoS1(f, read(f)), atBase(f), f + ": undoS1 exacto");
  assert.equal(read("sw.js").replace('"fluyo-static-v110"', '"fluyo-static-v' + (110 - 1) + '"'), atBase("sw.js"), "sw.js: solo CACHE (sin archivos nuevos)");
  assert.match(read("sw.js"), /const CACHE = "fluyo-static-v110";/);
  assert.ok(read("test/fluyo-i18n-002-s0-undo.cjs").includes("src = undoS1(file, src);"), "undoS0 deshace antes esta tarea");
  for (const f of ["js/config.js", "js/safe-svg.js", "js/model.js", "js/scenario-engine.js", "js/scenario-playback.js", "js/story-playback.js", "js/document-integrity.js", "js/story-authoring.js",
    "js/story-clock.js", "js/flow-semantics.js", "js/render.js", "js/selection.js", "js/editor-scenarios.js", "js/present-story.js", "js/viewer.js", "js/viewer-viewport.js", "js/share-url.js",
    "js/link-codec.js", "js/share-loader.js", "js/i18n-en.js", "js/i18n-fr.js", "js/i18n-ja.js", "js/i18n-zh.js", "s/index.html", "404.html", "css/system.css", "css/styles.css"]) {
    assert.equal(read(f), atBase(f), f + " sin cambios");
  }
});
