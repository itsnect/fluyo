"use strict";
/* FLUYO-STORIES-2.0 S2b · Variantes en el editor — QA funcional en Chrome real (cdp-lite, sin dependencias; ratón, teclas y dedo de verdad por CDP).
   A desde el paso: «⋯ → Otra forma desde aquí» crea la variante 1..k con sus frases, la original no cambia, el nombre se escribe
   en línea y se sigue contando; Undo/Redo. B reproduciendo: «⋯ de la Historia → Otra forma desde el paso N». C doble clic y
   «Renombrar» en línea. D selector con desenlaces; guardar/cargar y Share con la variante. E inglés. F móvil 375×812 con el dedo.
   Uso: node test/fluyo-stories-2-0-s2b-browser.cjs [carpeta-de-capturas] */
const path = require("node:path"), fs = require("node:fs");
const { serve, launch } = require("./cdp-lite.cjs");
const root = path.join(__dirname, "..");
const SHOTS = process.argv[2] || null;
let ok = 0, ko = 0;
const check = (c, msg) => { c ? ok++ : ko++; console.log((c ? "  ✔ " : "  ✘ ") + msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function open(url, w = 1440, h = 900, mobile = false) {
  const b = await launch(), errors = [];
  b.on((d) => {
    if (d.method === "Runtime.exceptionThrown") errors.push(d.params.exceptionDetails.exception ? d.params.exceptionDetails.exception.description : d.params.exceptionDetails.text);
    if (d.method === "Runtime.consoleAPICalled" && d.params.type === "error") errors.push(d.params.args.map((a) => a.value || a.description).join(" "));
  });
  b.errors = errors;
  await b.viewport(w, h, mobile);
  await b.goto(url, 1200);
  b.click = async (x, y, clickCount = 1) => {
    await b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
    await b.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount });
    await b.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount });
    await sleep(180);
  };
  b.dbl = async (x, y) => { await b.click(x, y, 1); await b.click(x, y, 2); };
  b.touch = async (x, y) => {
    await b.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    await b.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await sleep(250);
  };
  b.type = async (text) => { await b.send("Input.insertText", { text }); await sleep(80); };
  b.key = async (key, modifiers = 0) => {
    const code = { Enter: 13, Escape: 27, z: 90, y: 89 }[key];
    await b.send("Input.dispatchKeyEvent", { type: "keyDown", key, code: key.length === 1 ? "Key" + key.toUpperCase() : key, windowsVirtualKeyCode: code, modifiers });
    await b.send("Input.dispatchKeyEvent", { type: "keyUp", key, code: key.length === 1 ? "Key" + key.toUpperCase() : key, windowsVirtualKeyCode: code, modifiers });
    await sleep(180);
  };
  b.box = (js) => b.ev(`(() => { const el = ${js}; if (!el) return null; el.scrollIntoView({ block: "nearest" }); const r = el.getBoundingClientRect(); return r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2, left: r.left, right: r.right, top: r.top, bottom: r.bottom, h: r.height } : null; })()`);
  b.press = async (js, how = "click") => { const p = await b.box(js); if (!p) return false; await b[how](p.x, p.y); return true; };
  b.item = (label) => `[...document.querySelectorAll("#scPopover > button")].find((x) => x.firstChild && x.firstChild.textContent.startsWith(${JSON.stringify(label)}))`;
  b.menu = () => b.ev(`[...document.querySelectorAll("#scPopover > button")].map((x) => [x.firstChild.textContent, (x.querySelector(".scMenuHint") || {}).textContent || "", x.disabled])`);
  b.at = (x, y) => b.ev(`(() => { const r = cv.getBoundingClientRect(); return { x: r.left + viewX + ${x} * viewZoom, y: r.top + viewY + ${y} * viewZoom }; })()`);
  b.shot = async (name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); const r = await b.send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(path.join(SHOTS, name + ".png"), Buffer.from(r.data, "base64")); } };
  return b;
}
async function until(b, cond, ms = 15000) { for (let t = 0; t < ms; t += 150) { if (await b.ev(cond)) return true; await sleep(150); } return false; }
const $ = (id) => `document.getElementById(${JSON.stringify(id)})`;
const noCounters = (j) => j.replace(/"next(Step|Scenario)Id":\d+/g, "");
const st = (b) => b.ev(`({ active: (scActiveScenario() || {}).name, names: P().scenarios.map((s) => s.name), undo: undoStack.length,
  field: !!${$("scStoryNameInput")}, focused: document.activeElement && document.activeElement.id, title: ${$("scScenarioTitle")}.textContent, titleHidden: ${$("scScenarioTitle")}.hidden,
  sel: (() => { const f = ${$("scStoryNameInput")}; return f ? [f.selectionStart, f.selectionEnd, f.value.length] : null; })() })`);
const shape = (b, js) => b.ev(`JSON.stringify(${js}.steps.map((s) => [s.id, s.at, s.action, s.edgeId || s.nodeId, s.state || "", s.message || "", !!s.reverse]))`);

(async () => {
  const srv = await serve(root);
  try {
    console.log("\nA · DESDE EL PASO (escritorio, Compra online)");
    { const b = await open(srv.base + "/?ejemplo=compra-online");
      try {
        const page0 = await b.ev(`JSON.stringify(P())`), orig0 = await b.ev(`JSON.stringify(P().scenarios[0])`), undo0 = await b.ev(`undoStack.length`);
        /* el ⋯ del primer paso del momento 3 */
        const at3 = await b.ev(`storyboardGroups(scActiveScenario().steps)[2].at`), id3 = await b.ev(`storyboardOrderedSteps(storyboardGroups(scActiveScenario().steps)[2].steps)[0].id`);
        await b.press(`document.querySelector('.scStoryRow[data-step-id="${id3}"] .scMore')`);
        const items = await b.menu();
        const it = items.find((x) => x[0] === "Otra forma desde aquí");
        check(!!it && !it[2] && it[1] === "Copia la historia hasta este paso y sigue por otro camino", "A · el ⋯ del paso ofrece «Otra forma desde aquí»: " + JSON.stringify(it));
        await b.shot("a-step-menu");
        await b.press(b.item("Otra forma desde aquí"));
        let s = await st(b);
        check(s.active === "Compra con éxito — otra forma" && JSON.stringify(s.names) === JSON.stringify(["Compra con éxito", "Compra con éxito — otra forma", "El banco no responde"]),
          "A · la variante, activa y justo detrás de la original: " + s.names.join(" | "));
        check(s.field && s.focused === "scStoryNameInput" && s.titleHidden && s.sel && s.sel[0] === 0 && s.sel[1] === s.sel[2], "A · su nombre, en línea, con el foco y seleccionado");
        const want = await b.ev(`JSON.stringify(JSON.parse(${JSON.stringify(orig0)}).steps.filter((x) => x.at <= ${at3}).map((s) => [s.id, s.at, s.action, s.edgeId || s.nodeId, s.state || "", s.message || "", !!s.reverse]))`);
        check(await shape(b, "scActiveScenario()") === want, "A · exactamente los momentos 1..3, con sus frases (" + JSON.parse(want).length + " pasos)");
        check(await b.ev(`JSON.stringify(P().scenarios[0])`) === orig0, "A · la original, byte a byte");
        check(s.undo === undo0 + 1, "A · una entrada de Undo");
        await b.type("El usuario cancela"); await b.key("Enter");
        s = await st(b);
        check(s.active === "El usuario cancela" && !s.field && !s.titleHidden && s.title.startsWith("El usuario cancela") && s.undo === undo0 + 2, "A · Enter guarda el nombre: «" + s.title + "» (una entrada más)");
        await b.shot("a-variant-named");
        /* seguir contando: tocar una conexión añade el paso al final de la variante */
        const n0 = await b.ev(`scActiveScenario().steps.length`);
        const e = await b.ev(`(() => { const e = P().edges[0], a = nodeById(e.from), z = nodeById(e.to); return { x: (a.x + z.x) / 2, y: (a.y + z.y) / 2 }; })()`);
        const p = await b.at(e.x, e.y); await b.click(p.x, p.y); await b.key("Escape");
        check(await b.ev(`scActiveScenario().steps.length`) === n0 + 1 && await b.ev(`scActiveScenario().name`) === "El usuario cancela", "A · se sigue contando: tocar el sistema añade el paso a la variante");
        /* Undo/Redo con las teclas */
        await b.ev(`document.activeElement && document.activeElement.blur && document.activeElement.blur(); true`);
        await b.key("z", 2); await b.key("z", 2); await b.key("z", 2);
        check(noCounters(await b.ev(`JSON.stringify(P())`)) === noCounters(page0), "A · tres Ctrl+Z (paso, nombre, variante): la página exacta, sin variante");
        await b.key("z", 10); await b.key("z", 10);
        s = await st(b);
        check(JSON.stringify(s.names) === JSON.stringify(["Compra con éxito", "El usuario cancela", "El banco no responde"]) && await shape(b, "P().scenarios[1]") === want, "A · dos Redo: la variante con su nombre, igual");
        check(!b.errors.length, "A · sin errores de consola " + b.errors.join(" | "));
      } finally { b.close(); } }

    console.log("\nB · REPRODUCIENDO · ⋯ de la Historia");
    { const b = await open(srv.base + "/?ejemplo=compra-online");
      try {
        const orig0 = await b.ev(`JSON.stringify(P().scenarios[0])`);
        await b.press($("scRun")); await sleep(400);
        await b.press($("scNext")); await b.press($("scNext"));
        await b.press($("scPause"));
        const n = await b.ev(`scMomentNav().index + 1`);
        await b.press($("scScenarioMenu"));
        const items = await b.menu();
        const it = items.find((x) => /^Otra forma desde el paso/.test(x[0]));
        check(!!it && it[0] === "Otra forma desde el paso " + n && !it[2], "B · en pausa en el momento " + n + ": «" + (it && it[0]) + "»");
        check(await b.ev(`document.querySelectorAll(".scStoryRow .scMore").length`) === 0, "B · el storyboard no gana controles mientras se reproduce");
        await b.shot("b-story-menu-playing");
        await b.press(b.item("Otra forma desde el paso"));
        const s = await st(b);
        check(!(await b.ev(`isScenarioPlaybackActive()`)) && s.active === "Compra con éxito — otra forma" && await b.ev(`storyboardGroups(scActiveScenario().steps).length`) === n,
          "B · detiene la reproducción y crea la variante con " + n + " momentos");
        check(s.field && s.focused === "scStoryNameInput", "B · su nombre queda listo para escribirse");
        check(await b.ev(`JSON.stringify(P().scenarios[0])`) === orig0, "B · la original no cambia");
        await b.key("Escape");
        check(!(await st(b)).field && await b.ev(`scActiveScenario().name`) === "Compra con éxito — otra forma", "B · Escape deja el nombre como estaba");
        check(!b.errors.length, "B · sin errores de consola " + b.errors.join(" | "));
      } finally { b.close(); } }

    console.log("\nC · RENOMBRAR EN LÍNEA · doble clic y «Renombrar»");
    { const b = await open(srv.base + "/?ejemplo=compra-online");
      try {
        const undo0 = await b.ev(`undoStack.length`);
        await b.press($("scScenarioTitle"), "dbl"); await sleep(150);
        let s = await st(b);
        check(s.field && s.focused === "scStoryNameInput" && await b.ev(`${$("scPopover")}.hidden`), "C · doble clic en el título: el nombre en línea (y el selector cerrado)");
        await b.type("Compra feliz"); await b.key("Enter");
        s = await st(b);
        check(s.active === "Compra feliz" && s.undo === undo0 + 1, "C · Enter: «Compra feliz», una entrada de Undo");
        await b.press($("scScenarioMenu")); await b.press(b.item("Renombrar"));
        s = await st(b);
        check(s.field && !(await b.ev(`!!document.querySelector("#scPopover label")`)), "C · «Renombrar» abre el campo en línea, sin popover");
        await b.type("   "); await b.key("Enter");
        check((await st(b)).active === "Compra feliz" && (await st(b)).undo === undo0 + 1, "C · vacío: no cambia nada");
        await b.press($("scScenarioTitle"));
        check(!(await b.ev(`${$("scPopover")}.hidden`)) && !(await st(b)).field, "C · un clic sigue abriendo el selector (el botón «nombre ▾» no cambia)");
        await b.key("Escape");
        check(!b.errors.length, "C · sin errores de consola " + b.errors.join(" | "));
      } finally { b.close(); } }

    console.log("\nD · SELECTOR, GUARDAR/CARGAR Y SHARE");
    { const b = await open(srv.base + "/?ejemplo=compra-online");
      try {
        const id2 = await b.ev(`storyboardOrderedSteps(scActiveScenario().steps)[2].id`);
        await b.ev(`scBranchFrom(${id2}); true`); await b.type("El usuario cancela"); await b.key("Enter");
        await b.press($("scScenarioTitle"));
        const sel = await b.menu();
        check(JSON.stringify(sel.map((x) => [x[0], x[1]])) === JSON.stringify([["○ Compra con éxito", "Termina bien"], ["● El usuario cancela", "Termina bien"], ["○ El banco no responde", "Falla en el paso 4"], ["+ Nueva historia", ""]]),
          "D · el selector con el desenlace de cada una: " + sel.map((x) => x[0] + " · " + x[1]).join(" | "));
        const same = await b.ev(`P().scenarios.filter((s) => s.steps.length).every((s) => FluyoStoryClock.outcomeText(FluyoStoryClock.outcomeOf(P(), s), FluyoI18n.t) === [...document.querySelectorAll("#scPopover > button")].find((x) => x.firstChild.textContent.slice(2) === s.name).querySelector(".scMenuHint").textContent)`);
        check(same, "D · cada pista es FluyoStoryClock.outcomeOf (la regla de Present y el Viewer)");
        await b.shot("d-selector");
        await b.key("Escape");
        const saved = await b.ev(`JSON.stringify(serializeProject())`);
        await b.ev(`applyProjectData(JSON.parse(${JSON.stringify(saved)})); true`); await sleep(300);
        check(JSON.stringify(await b.ev(`P().scenarios.map((s) => s.name)`)) === JSON.stringify(["Compra con éxito", "El usuario cancela", "El banco no responde"]), "D · guardar y cargar conserva la variante y su nombre");
        const link = await b.ev(`createShareUrl(serializeProject(), location.href, { kind: "story", scenarioId: P().scenarios[0].id, withOthers: true })`);
        const v = await open(link);
        try {
          await v.ev(`storyPlay(); storySeek(storyNav().times.length - 1); true`);
          await until(v, `!!story && story.status === "completed"`);
          const others = await v.ev(`[...document.querySelectorAll("#stOthersList .stOther")].map((x) => x.children[0].textContent + " · " + x.children[1].textContent)`);
          check(JSON.stringify(others) === JSON.stringify(["El usuario cancela · Termina bien", "El banco no responde · Falla en el paso 4"]), "D · Share: el Viewer la ofrece en «Otras formas»: " + others.join(" | "));
        } finally { v.close(); }
        check(!b.errors.length, "D · sin errores de consola " + b.errors.join(" | "));
      } finally { b.close(); } }

    console.log("\nE · INGLÉS");
    { const b = await open(srv.base + "/?ejemplo=compra-online&lang=en");
      try {
        const name = await b.ev(`scActiveScenario().name`);
        const id1 = await b.ev(`storyboardOrderedSteps(scActiveScenario().steps)[0].id`);
        await b.press(`document.querySelector('.scStoryRow[data-step-id="${id1}"] .scMore')`);
        const it = (await b.menu()).find((x) => x[0] === "Another way from here");
        check(!!it && it[1] === "Copies the story up to this step and continues another way", "E · «Another way from here»");
        await b.press(b.item("Another way from here"));
        check(await b.ev(`scActiveScenario().name`) === name + " — another way", "E · «" + name + " — another way»");
        await b.key("Escape");
        await b.press($("scScenarioTitle"));
        const hints = (await b.menu()).map((x) => x[1]);
        check(hints.includes("Ends well") && hints.includes("Fails at step 4"), "E · el selector: " + hints.filter(Boolean).join(" | "));
        await b.key("Escape");
        await b.ev(`scSwitchScenario(P().scenarios[0].id); true`); await sleep(150);
        await b.press($("scRun")); await sleep(300); await b.press($("scNext")); await b.press($("scPause"));
        await b.press($("scScenarioMenu"));
        check((await b.menu()).some((x) => x[0] === "Another way from step 2"), "E · reproduciendo: «Another way from step 2»");
        await b.key("Escape");
        check(!b.errors.length, "E · no console errors " + b.errors.join(" | "));
      } finally { b.close(); } }

    console.log("\nF · MÓVIL 375×812 · con el dedo");
    { const b = await open(srv.base + "/?ejemplo=compra-online", 375, 812, true);
      try {
        /* abrir la hoja de Historias y ampliarla (el primer toque puede llegar mientras el ejemplo termina de abrirse) */
        await b.press($("btnStories"), "touch"); await sleep(500);
        for (let i = 0; i < 3 && !(await b.ev(`document.body.classList.contains("storyExpanded")`)); i++) { await b.press($("btnStoryExpand"), "touch"); await sleep(500); }
        check(await b.ev(`document.body.classList.contains("storyExpanded")`), "F · la hoja «Historia» ampliada");
        const id2 = await b.ev(`storyboardOrderedSteps(scActiveScenario().steps)[1].id`);
        await b.press(`document.querySelector('.scStoryRow[data-step-id="${id2}"] .scStepPrimary')`, "touch");
        check(await b.press(b.item("Otra forma desde aquí"), "touch"), "F · tocar la fila y «Otra forma desde aquí»");
        const f = await b.box($("scStoryNameInput"));
        check(!!f && f.left >= 0 && f.right <= 375 && f.top >= 0 && f.bottom <= 812, "F · el campo del nombre, a la vista (" + (f ? Math.round(f.left) + "–" + Math.round(f.right) + " × " + Math.round(f.top) + "–" + Math.round(f.bottom) : "—") + ")");
        await b.shot("f-mobile-name");
        await b.type("Con el dedo"); await b.key("Enter");
        check(await b.ev(`scActiveScenario().name`) === "Con el dedo" && await b.ev(`storyboardGroups(scActiveScenario().steps).length`) === 2, "F · la variante «Con el dedo», con 2 momentos");
        const scroll = await b.ev(`document.documentElement.scrollWidth`);
        check(scroll <= 375, "F · sin scroll horizontal (" + scroll + ")");
        check(!b.errors.length, "F · sin errores de consola " + b.errors.join(" | "));
      } finally { b.close(); } }
  } finally { srv.server.close(); }
  console.log(`\n${ok} ✔ · ${ko} ✘`);
  process.exit(ko ? 1 : 0);
})();
