"use strict";
/* FLUYO-018.12 — Base táctil y móvil: contratos estáticos y en vm (sin navegador).
   · sw.js: CACHE v72; todo lo que cargan index.html y s/index.html sigue precacheado.
   · index.html: ningún id de HEAD desaparece salvo #ossSection (D8); la cabecera no lleva reproducción (D6); los enlaces del
     proyecto viven en el menú «Más» y no en la barra inferior ni en el panel; existen Deshacer/Rehacer, la barra táctil y la hoja.
   · renderTabs (vm, DOM mínimo como los arneses de 018.7c/018.8): la pestaña activa lleva el ▾; el doble clic sigue renombrando con
     ratón y NO con el dedo (ahí manda el menú).
   · render.js (vm): el respaldo del lienzo mide caja × densidad (tope 2) y render() escala una sola vez antes de la vista.
   · export.js (vm, editor completo de 018.8): «Ejemplo» crea una página nueva y no toca la activa (D9). */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const ids = (html) => new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));

test("sw.js: CACHE v72 y todos los assets locales de index.html y s/index.html precacheados", () => {
  const sw = read("sw.js");
  assert.match(sw, /const CACHE = "fluyo-static-v75";/);
  const listed = new Set([...sw.matchAll(/"\.\/([^"]*)"/g)].map((m) => m[1]));
  const local = (html, prefix) => [...html.matchAll(/<(?:script|link)[^>]+(?:src|href)="([^"]+)"/g)].map((m) => m[1])
    .filter((u) => !/^(https?:|data:|#)/.test(u) && !/\.(png|ico|svg)$/.test(u)).map((u) => path.posix.normalize(prefix + u));
  const need = [...local(read("index.html"), ""), ...local(read("s/index.html"), "s/")];
  assert.ok(need.length > 20, "se encuentran los <script>/<link> locales");
  for (const u of need) assert.ok(listed.has(u), "precacheado: " + u);
});

test("index.html: ningún id de HEAD desaparece salvo #ossSection; los nuevos existen", () => {
  let head;
  try { head = execFileSync("git", ["-C", root, "show", "HEAD:index.html"], { encoding: "utf8" }); } catch { return; }   // sin git (copia de mutaciones): se omite
  const now = ids(read("index.html"));
  const lost = [...ids(head)].filter((id) => !now.has(id));
  assert.deepEqual(lost, ["ossSection"], "solo se retira la sección Open Source del panel (pasa al menú «Más»)");
  for (const id of ["btnUndo", "btnRedo", "btnMore", "moreMenu", "moreTools", "hdrTools", "touchBar", "tbConnect", "tbMulti", "tbAll", "tbDone", "tbCancel", "btnPanelClose", "modeBar", "btnStories", "pageMenu"])
    assert.ok(now.has(id), "existe #" + id);
});

test("index.html: cabecera sin reproducción, enlaces en «Más», Pausa en Animación (D6, D8)", () => {
  const html = read("index.html");
  const header = html.slice(html.indexOf("<header>"), html.indexOf("</header>"));
  const menu = header.slice(header.indexOf('id="moreMenu"'));
  const headerOutsideMenu = header.slice(0, header.indexOf('id="moreMenu"'));
  assert.ok(!/id="btnPlay"/.test(header), "Pausa/Play ya no está en la cabecera");
  assert.ok(!/Reproducir|Pausa|Play\b/.test(headerOutsideMenu), "la cabecera no reproduce ni pausa nada");
  const aside = html.slice(html.indexOf('<aside id="propPanel">'), html.indexOf("</aside>"));
  /* FLUYO-018.14b: la sección Animación es el grupo plegable «Animación del lienzo» */
  assert.match(aside.slice(aside.indexOf('id="grpAnim"')), /id="btnPlay"/, "Pausa vive en la sección Animación");
  for (const href of ["docs/", "ejemplos/", "privacidad/", "soporte/", "https://github.com/itsnect/fluyo", "https://github.com/itsnect/fluyo-mcp"])
    assert.ok(menu.includes(`href="${href}"`), "«Más» enlaza " + href);
  const bottom = html.slice(html.indexOf('<div id="bottomBar">'), html.indexOf("</div>", html.indexOf('id="modeBar"')));
  assert.ok(!/<a\s/.test(bottom), "la barra inferior no lleva enlaces");
  assert.ok(!/<a\s/.test(aside) && !/ossLink/.test(aside), "el panel no lleva enlaces ni Open Source");
});

/* Igual que los arneses de 018.7c/018.8: el tramo renderTabs … «Modo presentación» de ui.js, con un DOM mínimo. */
function tabsHarness() {
  const ui = read("js/ui.js");
  const a = ui.indexOf("function renderTabs(){"), b = ui.indexOf("/* ===================== Modo presentación");
  assert.ok(a >= 0 && b > a);
  const el = () => ({ children: [], style: {}, className: "", textContent: "", appendChild(c) { this.children.push(c); return c; }, set innerHTML(v) { this.children = []; } });
  const elements = {}, prompts = [];
  const ctx = vm.createContext({
    document: { getElementById: (id) => (elements[id] ||= el()), createElement: el },
    prompt: (m, v) => { prompts.push(m); return "Nuevo"; }, alert() {}, PAGE_NAME_MAX: 80,
    doc: { cur: 0, pages: [{ name: "Uno" }, { name: "Dos" }] }, renamed: [],
  });
  vm.runInContext(`var $=id=>document.getElementById(id); function clearSel(){} function scheduleAutosave(){} function addPage(){}
    function requestDeletePage(){} function renamePage(i,n){ renamed.push([i,n]); doc.pages[i].name=n; }`, ctx);
  vm.runInContext(ui.slice(a, b), ctx);
  vm.runInContext("renderTabs()", ctx);
  return { ctx, tabs: elements.pagesBar.children, prompts };
}
test("renderTabs: la pestaña activa lleva ▾; doble clic renombra con ratón y no con el dedo", () => {
  const { ctx, tabs, prompts } = tabsHarness();
  const [t0, t1] = tabs;
  assert.ok(t0.children.some((c) => c.className === "pgMore"), "la activa tiene ▾");
  assert.ok(!t1.children.some((c) => c.className === "pgMore"), "las demás no");
  assert.ok(t0.children.some((c) => c.className === "x") && t1.children.some((c) => c.className === "x"), "la ✕ sigue en todas");
  t0.lastPointer = "touch"; t0.ondblclick();
  assert.equal(prompts.length, 0, "con el dedo, el dblclick sintético no abre el prompt");
  t0.lastPointer = "mouse"; t0.ondblclick();
  assert.equal(JSON.stringify(ctx.renamed), JSON.stringify([[0, "Nuevo"]]), "con ratón, doble clic + nombre renombra como siempre");
});

test("render.js: respaldo a caja × densidad (tope 2) y una sola escala antes de la vista", () => {
  const src = read("js/render.js");
  const run = (dpr) => {
    const ctx = vm.createContext({ devicePixelRatio: dpr });
    vm.runInContext(src.slice(src.indexOf("function canvasDpr(){"), src.indexOf("function render(c,t,opts={}){")), ctx);
    const canvas = { width: 0, height: 0 };
    ctx.c = canvas; ctx.k = { getBoundingClientRect: () => ({ width: 390.4, height: 600 }) };
    vm.runInContext("resizeCanvas(c,k)", ctx);
    return [canvas.width, canvas.height, canvas.fluyoDpr];
  };
  assert.deepEqual(run(1), [390, 600, 1]);
  assert.deepEqual(run(2), [781, 1200, 2]);
  assert.deepEqual(run(3), [781, 1200, 2], "tope 2");
  /* el orden de operaciones de render(): limpiar el respaldo entero, escalar por la densidad, y solo después la vista */
  const body = src.slice(src.indexOf("const vp=rs.viewport, dpr=vp.dpr||1;"), src.indexOf("c.scale(vp.zoom, vp.zoom);"));
  assert.ok(body.indexOf("clearRect") < body.indexOf("c.scale(dpr, dpr)") && body.indexOf("c.scale(dpr, dpr)") < body.indexOf("c.translate(vp.x, vp.y)"));
  const rt = read("js/editor-runtime.js");
  assert.match(rt, /width:cv\.width\/\(cv\.fluyoDpr\|\|1\)/, "el editor pasa el ancho en px CSS");
  assert.match(read("js/viewer.js"), /width:sv\.width\/dpr/, "el Viewer también");
});

test("export.js: «Ejemplo» crea una página nueva y no toca la activa (D9)", () => {
  const { fullEditor } = require("./fluyo-018-8-harness.cjs");
  const E = fullEditor();
  E.ctx.performance = { now: () => 0 };
  E.run(`var t0=0, pausedAt=0; function trackEvent(){} function syncProjectControls(){} function scheduleAnalyticsEdit(){}`);
  E.run(`addPage(); doc.pages[0].name="Mía"; doc.cur=0; newNode("rect",10,10); newNode("rect",200,10);`);
  const before = E.run("JSON.stringify(doc.pages[0])");
  const src = read("js/export.js");
  const a = src.indexOf("function examplePageName(){"), b = src.indexOf("/* ===================== Exportación SVG");
  assert.ok(a >= 0 && b > a);
  E.run(src.slice(a, b).replace('$("btnDemo").onclick=', "var __demo="));
  E.run("__demo()");
  assert.deepEqual(E.call("doc.pages.map(p=>p.name)"), ["Mía", "Página 2", "Ejemplo"]);
  assert.equal(E.call("doc.cur"), 2, "la página nueva queda activa");
  assert.equal(E.run("JSON.stringify(doc.pages[0])"), before, "la página que había no cambia ni un byte");
  assert.equal(E.call("P().nodes.length"), 8);
  E.run("__demo()");
  assert.deepEqual(E.call("doc.pages.map(p=>p.name)").slice(-2), ["Ejemplo", "Ejemplo 2"], "un segundo Ejemplo no repite nombre");
});
