"use strict";
/* FLUYO-018.15 — coherencia visual del documento: comprobaciones estáticas y en vm (sin navegador).
   · Color con el que nace un nodo: DEFAULT_NODE_COLOR (#857F6C, piedra media) en createNodeIn —editor y MCP— y en
     la herramienta de animaciones del editor. La paleta, los temas y las muestras no cambian.
   · Compatibilidad: un nodo guardado SIN color se sigue leyendo como PALETTE[0] (#6a9fb5); los colores explícitos
     —también #6a9fb5— no se tocan; ningún documento existente (ejemplos, fixtures) cambia al abrirlo y guardarlo.
   · model.js: idéntico a HEAD salvo exactamente el cambio de 018.15.
   · Render compartido (editor, Viewer, Present): sin el cian del editor antiguo. «Resaltar» usa el oliva de activo
     (el mismo que scHighlight), el acento del evento en tránsito es el terracota de su punto, el pulso de una imagen
     brilla con el color del nodo.
   · Panel: la muestra del color por defecto encabeza la rejilla de color del nodo.
   · Fixture compartido con fluyo-mcp (test/fixtures/fluyo-018-15-colores.json). */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const gitRoot = process.env.FLUYO_GIT_ROOT || root;
const head = (f) => execFileSync("git", ["-C", gitRoot, "show", "HEAD:" + f], { encoding: "utf8" });
const J = (v) => JSON.parse(JSON.stringify(v));
const NEW_DEFAULT = "#857F6C", SERVICIO = "#6a9fb5";
const LF = (s) => s.replace(/\r\n/g, "\n");

function kernel() {
  const ctx = vm.createContext({ TextEncoder, TextDecoder, atob, btoa, URL });
  for (const f of ["config.js", "safe-svg.js", "model.js"]) vm.runInContext(read("js/" + f), ctx, { filename: f });
  return ctx;
}
const run = (ctx, src) => J(vm.runInContext(src, ctx));
function configOf(src) {
  const ctx = vm.createContext({});
  vm.runInContext(src + "\n;globalThis.__c={PALETTE,EVENT_SWATCHES,SWATCH_COLORS,THEMES,DEFAULT_FONT,DEFAULT_SIZES};", ctx);
  return J(ctx.__c);
}
/* Sin comentarios: las comprobaciones de «no hay cian» miran el código, no la historia que cuentan los comentarios. */
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

test("config.js: DEFAULT_NODE_COLOR = #857F6C, el punto medio de los tokens grafito y piedra de system.css", () => {
  const ctx = kernel();
  assert.equal(run(ctx, "DEFAULT_NODE_COLOR"), NEW_DEFAULT);
  const tok = (name) => new RegExp("--c-" + name + ":(#[0-9A-Fa-f]{6})").exec(read("css/system.css"))[1];
  const mid = [1, 3, 5].map((i) => Math.floor((parseInt(tok("grafito").slice(i, i + 2), 16) + parseInt(tok("piedra").slice(i, i + 2), 16)) / 2).toString(16).padStart(2, "0")).join("");
  assert.equal("#" + mid.toUpperCase(), NEW_DEFAULT);
});

test("config.js: paleta, muestras, temas, tipografía por defecto y tamaños idénticos a HEAD (los colores del documento no cambian)", () => {
  const now = configOf(read("js/config.js")), old = configOf(head("js/config.js"));
  for (const k of ["PALETTE", "EVENT_SWATCHES", "SWATCH_COLORS", "DEFAULT_FONT", "DEFAULT_SIZES"]) assert.deepEqual(now[k], old[k], k);
  /* THEMES: solo los respaldos code* cambiaron, en 018.14a; lo demás (fondo, aristas, texto) sigue igual */
  for (const t of Object.keys(old.THEMES)) for (const f of ["bg", "grid", "text", "edge", "edgeLbl", "lblBg"]) assert.equal(now.THEMES[t][f], old.THEMES[t][f], t + "." + f);
  assert.deepEqual(now.PALETTE[0], { c: SERVICIO, n: "Servicio" }, "«Servicio» sigue siendo el primero, con su valor");
  assert.ok(!now.PALETTE.some((p) => p.c.toLowerCase() === NEW_DEFAULT.toLowerCase()), "el color por defecto no es una categoría");
});

test("model.js: idéntico a HEAD salvo el color con el que nace un nodo y el comentario del respaldo histórico", () => {
  const now = LF(read("js/model.js")), old = LF(head("js/model.js"));
  assert.ok(now.includes("color:DEFAULT_NODE_COLOR, fill:null"), "createNodeIn usa DEFAULT_NODE_COLOR");
  assert.ok(now.includes("  if(n.color==null) n.color=PALETTE[0].c;\n"), "normalizeProjectNode conserva el respaldo histórico");
  const undo = now.replace("color:DEFAULT_NODE_COLOR, fill:null", "color:PALETTE[0].c, fill:null").replace(/  \/\* Respaldo HISTÓRICO[\s\S]*?MCP\. \*\/\n/, "");
  assert.equal(undo, old);
  assert.equal((now.match(/DEFAULT_NODE_COLOR/g) || []).length, 2, "una vez en el código y otra en el comentario");
});

test("createNodeIn: toda forma nace con #857F6C; un color explícito se conserva tal cual (también #6a9fb5)", () => {
  const ctx = kernel();
  const shapes = ["rect", "cylinder", "diamond", "circle", "hex", "text", "image", "anim", "code", "icon"];
  const extra = { icon: '{icon:"kafka"}', anim: '{anim:"pulse"}', image: '{img:"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiLz4="}' };
  for (const s of shapes) {
    const n = run(ctx, `(()=>{const pg=blankPage("P");return createNodeIn(pg,Object.assign({shape:"${s}",x:0,y:0},${extra[s] || "{}"}));})()`);
    assert.equal(n.color, NEW_DEFAULT, s);
  }
  for (const c of [SERVICIO, "#7fa66b", NEW_DEFAULT, "#abc"]) {
    assert.equal(run(ctx, `createNodeIn(blankPage("P"),{shape:"rect",x:0,y:0,color:"${c}"}).color`), c);
  }
});

test("documentos: un nodo SIN color se lee como #6a9fb5; los explícitos no cambian; abrir y guardar no migra nada", () => {
  const ctx = kernel();
  const fx = JSON.parse(read("test/fixtures/fluyo-018-15-colores.json"));
  const legacy = fx.doc.pages[0].nodes.find((n) => n.label === "Histórico");
  assert.ok(legacy && !("color" in legacy), "el fixture conserva un nodo sin color");
  const out = run(ctx, `(()=>{const p=projectFromProjectData(${JSON.stringify(fx)});return projectToSerializable(p.doc,p.settings);})()`);
  assert.deepEqual(out.doc.pages[0].nodes.map((n) => [n.label, n.color]), [
    ["Por defecto", NEW_DEFAULT], ["Servicio explícito", SERVICIO], ["BD", NEW_DEFAULT], ["Título", NEW_DEFAULT],
    ["SELECT 1", NEW_DEFAULT], ["Datos", "#7fa66b"], ["Histórico", SERVICIO]]);
  /* Un documento v1 (`state`) sin color en ningún nodo: todos al respaldo histórico */
  const v1 = run(ctx, `projectFromProjectData({state:{nodes:[{id:1,shape:"rect",x:0,y:0,label:"a"},{id:2,shape:"text",x:0,y:90,label:"b"}],edges:[]}}).doc.pages[0].nodes.map(n=>n.color)`);
  assert.deepEqual(v1, [SERVICIO, SERVICIO]);
});

test("ejemplos y fixtures existentes: los colores de cada nodo salen idénticos tras abrir y guardar", () => {
  const ctx = kernel();
  const files = [
    ...fs.readdirSync(path.join(root, "ejemplos/data")).filter((f) => f.endsWith(".json")).map((f) => "ejemplos/data/" + f),
    ...fs.readdirSync(path.join(root, "test/fixtures/regresion-visual")).filter((f) => f.endsWith(".json")).map((f) => "test/fixtures/regresion-visual/" + f),
    "test/fixtures/fluyo-017-1-cliente-kafka-comercio.fluyo.json", "test/fixtures/fluyo-017-1-qa-complejo.fluyo.json",
  ];
  let nodes = 0, servicio = 0;
  for (const f of files) {
    const src = JSON.parse(read(f));
    const out = run(ctx, `(()=>{const p=projectFromProjectData(${JSON.stringify(src)});return projectToSerializable(p.doc,p.settings);})()`);
    const pages = src.doc ? src.doc.pages : [{ nodes: src.state.nodes }];
    pages.forEach((pg, i) => pg.nodes.forEach((n, j) => {
      const o = out.doc.pages[i].nodes[j];
      for (const k of ["color", "fill", "textColor", "textBg", "kwBg", "kwColor"]) if (n[k] !== undefined) assert.equal(o[k], n[k], `${f} nodo ${n.id}.${k}`);
      nodes++; if (n.color === SERVICIO) servicio++;
    }));
    for (const [i, pg] of pages.entries()) for (const [j, e] of (pg.edges || []).entries()) for (const k of ["lineColor", "dotColor"]) if (e[k] !== undefined) assert.equal(out.doc.pages[i].edges[j][k], e[k], `${f} conexión ${e.id}.${k}`);
  }
  assert.ok(nodes > 80 && servicio > 15, `cobertura: ${nodes} nodos, ${servicio} con «Servicio» explícito`);
});

test("editor: la herramienta de animaciones usa DEFAULT_NODE_COLOR; ningún nodo nuevo nace con PALETTE[0]", () => {
  const inter = read("js/interaction.js");
  assert.match(inter, /label:ANIMS\[pendingAnim\]\.n, color:DEFAULT_NODE_COLOR\}\)/);
  for (const f of fs.readdirSync(path.join(root, "js")).filter((f) => f.endsWith(".js"))) {
    const uses = (code(read("js/" + f)).match(/PALETTE\[0\]/g) || []).length;
    const allowed = { "model.js": 1, "render.js": 2 }[f] || 0;   // normalizeProjectNode · respaldos de drawAnim y colHex
    assert.equal(uses, allowed, `${f}: PALETTE[0] solo como respaldo histórico`);
  }
});

test("panel: la rejilla de color del nodo empieza por la muestra del color por defecto", () => {
  const ui = read("js/ui.js");
  assert.match(ui, /if\(field==="color"\)\{ seen\.add\(DEFAULT_NODE_COLOR\); mk\(DEFAULT_NODE_COLOR,"Piedra \(por defecto\)",DEFAULT_NODE_COLOR\); \}\r?\n  PALETTE\.forEach/);
  assert.match(ui, /buildNodeSwatches\("swatches","color"\);/);
});

test("render compartido: sin el cian del editor antiguo; «Resaltar» en oliva de activo; el evento en tránsito en su terracota", () => {
  const r = read("js/render.js"), rc = code(r);
  assert.ok(!/3aa7e8|58,\s*167,\s*232/i.test(rc), "render.js sin #3aa7e8 en el código");
  assert.match(r, /const FLOW_ACCENT = "#d08b5b";/);
  assert.match(r, /c\.save\(\); c\.fillStyle = FLOW_ACCENT; c\.shadowColor = FLOW_ACCENT;/, "el punto sin símbolo y su halo comparten color");
  assert.equal((rc.match(/#d08b5b/gi) || []).length, 2, "#d08b5b: FLOW_ACCENT y el respaldo de la pelota única (drawFlowBalls)");
  assert.match(r, /function activeMark\(theme\)\{ return EDITOR_MARK\[theme\]\|\|EDITOR_MARK\.dark; \}/);
  assert.match(r, /const m=activeMark\(theme\);/, "editorMark deriva de activeMark");
  const overlay = r.slice(r.indexOf("function drawScenarioNodeOverlay"), r.indexOf("const EDITOR_MARK"));
  assert.match(overlay, /const M = activeMark\(theme\);\s*c\.shadowColor = M\.ink; c\.shadowBlur = 14;\s*c\.strokeStyle = M\.arrow;/);
  assert.match(r, /if\(glow>0\)\{c\.shadowColor=n\.color; c\.shadowBlur=20\*glow;\}/, "pulso de imagen con el color del nodo");
  /* los colores semánticos de la reproducción no cambian: éxito, fallo, mensaje por defecto */
  assert.match(r, /c\.strokeStyle = failed \? "#d0576a" : "#7bb85b";/);
  assert.match(r, /const col = fx\.messageColor \|\| "#d0576a";/);
  for (const f of ["js/geometry.js", "js/export.js", "js/viewer.js", "js/present-story.js", "js/story-playback.js"]) assert.ok(!/3aa7e8|58,\s*167,\s*232/i.test(code(read(f))), f + " sin cian");
});

test("vista previa del efecto «Resaltar» en el diálogo de evento: el mismo oliva que en el lienzo", () => {
  assert.match(read("css/styles.css"), /\.scPreviewNode\.highlight\{box-shadow:0 0 0 3px var\(--active\);\}/);
});

test("Viewer y Present usan el render compartido: no tienen colores propios del documento", () => {
  const s = read("s/index.html");
  for (const f of ["config.js", "geometry.js", "render.js"]) assert.ok(s.includes(`src="../js/${f}`) || s.includes(`src="/js/${f}`) || s.includes(`js/${f}`), "el Viewer carga " + f);
  assert.ok(!/#[0-9a-f]{6}/i.test(code(read("js/viewer.js"))), "viewer.js sin colores literales");
});

test("fixture compartido con fluyo-mcp: idéntico si el repo hermano está al lado", () => {
  const mine = path.join(root, "test/fixtures/fluyo-018-15-colores.json"), theirs = path.join(root, "..", "fluyo-mcp", "test", "fixtures", "fluyo-018-15-colores.json");
  if (!fs.existsSync(theirs)) return;
  assert.equal(LF(fs.readFileSync(theirs, "utf8")), LF(fs.readFileSync(mine, "utf8")));
});

test("sw.js: CACHE v74 (cambian config, model, render, ui, interaction y styles, todos ya precacheados)", () => {
  const sw = read("sw.js");
  assert.match(sw, /const CACHE = "fluyo-static-v75";/);
  for (const f of ["./js/config.js", "./js/model.js", "./js/render.js", "./js/ui.js", "./js/interaction.js", "./css/styles.css"]) assert.ok(sw.includes('"' + f + '"'), f + " precacheado");
});
