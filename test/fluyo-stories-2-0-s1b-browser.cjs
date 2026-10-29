"use strict";
/* FLUYO-STORIES-2.0 S1b · Fallar — QA funcional en Chrome real (cdp-lite, sin dependencias, ratón, teclas y dedo de verdad por CDP).
   A éxito: A → B → C «Termina bien». D duplicar como fallo: la copia falla, se modifica y la original no cambia. E Viewer: el enlace
   reproduce el mismo fallo y el mismo desenlace. B fallo: «Falla aquí» en el envío a B; al reproducir B cae, lo que depende de B
   falla y el desenlace dice «Falla en el paso 2», también en Present. C Undo: una vez y la Historia vuelve tal cual. F inglés.
   Además: móvil 375×812 y los ejemplos (Compra online y OAuth) con sus desenlaces, sin cambiar el documento.
   Uso: node test/fluyo-stories-2-0-s1b-browser.cjs */
const path = require("node:path");
const { serve, launch } = require("./cdp-lite.cjs");
const root = path.join(__dirname, "..");
let ok = 0, ko = 0;
const check = (c, msg) => { c ? ok++ : ko++; console.log((c ? "  ✔ " : "  ✘ ") + msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const N = (id, x, label) => ({ id, shape: "rect", x, y: 250, w: 150, h: 60, label, color: "#6a9fb5", fill: null, border: "solid", lblPos: "center", textBg: null, font: null, bold: false, pulse: false, order: id });
const E = (id, from, to) => ({ id, from, to, route: "straight", fromSide: null, toSide: null, waypoints: [], label: "", font: null, bold: false, endArrow: true, startArrow: false, flowDir: "normal" });
const DOC = { version: 5, app: "fluyo", doc: { theme: "dark", customBg: "", cur: 0, nextEventTypeId: 1, eventTypes: [],
  pages: [{ name: "Sistema", nextId: 6, behaviors: [], nextScenarioId: 1, nodes: [N(1, 200, "Cliente"), N(2, 520, "Banco"), N(3, 840, "Pagos")], edges: [E(4, 1, 2), E(5, 2, 3)], scenarios: [] }] },
  settings: { speed: 0.5, dots: 3, build: false, stagger: 0.45, grid: false, snap: false, font: "Georgia, serif", single: false } };
const SPANISH = /[ñáéíóú¿¡]|\b(el|la|los|las|de|del|que|una?|para|con|por|se|sin|y|paso|falla|termina)\b/i;

async function open(srv, query = "", w = 1440, h = 900, mobile = false) {
  const b = await launch(), errors = [];
  b.on((d) => {
    if (d.method === "Runtime.exceptionThrown") errors.push(d.params.exceptionDetails.exception ? d.params.exceptionDetails.exception.description : d.params.exceptionDetails.text);
    if (d.method === "Runtime.consoleAPICalled" && d.params.type === "error") errors.push(d.params.args.map((a) => a.value || a.description).join(" "));
  });
  b.errors = errors;
  await b.viewport(w, h, mobile);
  await b.goto(srv.base + "/" + query, 900);
  b.click = async (x, y) => {
    await b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
    await b.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
    await b.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
    await sleep(150);
  };
  b.touch = async (x, y) => {
    await b.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    await b.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await sleep(180);
  };
  b.type = async (text) => { await b.send("Input.insertText", { text }); await sleep(60); };
  b.key = async (key, modifiers = 0) => {
    const code = { Enter: 13, Escape: 27, z: 90 }[key];
    await b.send("Input.dispatchKeyEvent", { type: "keyDown", key, code: key.length === 1 ? "Key" + key.toUpperCase() : key, windowsVirtualKeyCode: code, modifiers });
    await b.send("Input.dispatchKeyEvent", { type: "keyUp", key, code: key.length === 1 ? "Key" + key.toUpperCase() : key, windowsVirtualKeyCode: code, modifiers });
    await sleep(150);
  };
  /* centro de un elemento (lo trae a la vista) o null */
  b.box = (js) => b.ev(`(() => { const el = ${js}; if (!el) return null; el.scrollIntoView({ block: "nearest" }); const r = el.getBoundingClientRect(); return r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null; })()`);
  b.press = async (js, how = "click") => { const p = await b.box(js); if (!p) return false; await b[how](p.x, p.y); return true; };
  /* el botón del popover cuyo texto empieza por `label` */
  b.menuItem = (label) => `[...document.querySelectorAll("#scPopover > button")].find((x) => x.firstChild && x.firstChild.textContent.startsWith(${JSON.stringify(label)}))`;
  b.menu = () => b.ev(`[...document.querySelectorAll("#scPopover > button, #scPopover .scMenuHead")].map((x) => x.className === "scMenuHead" ? "# " + x.textContent : x.textContent)`);
  b.at = (x, y) => b.ev(`(() => { const r = cv.getBoundingClientRect(); return { x: r.left + viewX + ${x} * viewZoom, y: r.top + viewY + ${y} * viewZoom }; })()`);
  return b;
}
const state = (b) => b.ev(`({ name: (scActiveScenario() || {}).name, steps: (scActiveScenario() || { steps: [] }).steps.map(s => [s.action, s.edgeId || s.nodeId, s.state || "", s.message || ""]),
  outcome: (document.querySelector(".scOutcome") || {}).textContent || "", failed: /failed/.test((document.querySelector(".scOutcome") || {}).className || ""),
  undo: undoStack.length, dialog: !!document.querySelector("dialog[open]") })`);
const page = (b) => b.ev(`JSON.stringify(P())`);
const noCounter = (j) => j.replace(/"nextStepId":\d+/g, "");
async function loadDoc(b) { await b.ev(`applyProjectData(${JSON.stringify(DOC)}); undoStack.length = 0; redoStack.length = 0; true`); }
async function untilDone(b, cond, ms = 9000) { for (let t = 0; t < ms; t += 150) { if (await b.ev(cond)) return true; await sleep(150); } return false; }
/* A → B → C contada con clics y frases (S1a) */
async function tell(b, one, two) {
  await b.press(`document.getElementById("modeStory")`) || await b.ev(`setUiMode("story"); true`);
  await sleep(400);
  const ab = await b.at(360, 250), bc = await b.at(680, 250);
  await b.click(ab.x, ab.y); await b.type(one); await b.key("Enter");
  await b.click(bc.x, bc.y); await b.type(two); await b.key("Enter");
}
/* reproduce en el editor con el botón real y espera a que termine */
async function playEditor(b) {
  await b.press(`document.getElementById("scRun")`);
  return untilDone(b, `scStatus === "completed"`);
}
/* Viewer de un enlace: Reproducir de verdad y esperar al final; devuelve títulos vistos y el desenlace */
async function viewer(link) {
  const v = await launch();
  try {
    await v.goto(link, 1200);
    await v.ev(`document.getElementById("stPlay").click(); true`);
    const seen = new Set();
    for (let t = 0; t < 30000; t += 120) {
      seen.add(await v.ev(`document.getElementById("stTitle").textContent`));
      if (await v.ev(`!!(document.getElementById("stOutcome") && document.getElementById("stOutcome").textContent)`)) break;
      await sleep(120);
    }
    return { seen: [...seen], outcome: await v.ev(`(document.getElementById("stOutcome") || {}).textContent || ""`), summary: await v.ev(`document.getElementById("stSummary").textContent`),
      visible: await v.ev(`(() => { const e = document.getElementById("stOutcome"); return !!e && e.getBoundingClientRect().width > 0; })()`) };
  } finally { v.close(); }
}

(async () => {
  const srv = await serve(root);
  try {
    console.log("\nESCRITORIO 1440×900 · A éxito, D duplicar como fallo, E Viewer, B «Falla aquí» y Present, C Undo");
    { const b = await open(srv);
      try {
        await loadDoc(b);
        /* A · éxito */
        await tell(b, "El cliente paga", "El banco avisa a pagos");
        let s = await state(b);
        check(s.steps.length === 2 && s.outcome === "Termina bien" && !s.failed, "A · A → B → C contada con clics: «" + s.outcome + "»");
        check(await playEditor(b), "A · se reproduce hasta el final");
        check((await state(b)).outcome === "Termina bien" && await b.ev(`scPlayback.logEvents.every((e) => e.type !== "send_failed")`), "A · al terminar sigue «Termina bien» (el motor no registra fallos)");
        await b.press(`document.getElementById("scReset")`);
        const original = await page(b);
        const originalStory = await b.ev(`JSON.stringify(P().scenarios[0])`);

        /* D · duplicar como fallo, con los menús de verdad */
        const undoD = (await state(b)).undo;
        await b.press(`document.getElementById("scScenarioMenu")`);
        check(await b.press(b.menuItem("Duplicar como fallo")), "D · «Duplicar como fallo» en el menú de la Historia");
        await sleep(200);
        const choose = await b.menu();
        check(choose[0] === "# ¿Dónde falla?" && choose.length === 3 && /^Paso 1 · El cliente paga/.test(choose[1]) && /^Paso 2 · El banco avisa a pagos/.test(choose[2]),
          "D · se abre «¿Dónde falla?» con los dos envíos: " + choose.join(" | "));
        await b.press(b.menuItem("Paso 1"));
        s = await state(b);
        check(s.name === "Historia 1 — falla" && JSON.stringify(s.steps) === JSON.stringify([["SET_STATE", 2, "DOWN", "Banco no responde"], ["SEND", 4, "", "El cliente paga"], ["SEND", 5, "", "El banco avisa a pagos"]]),
          "D · la copia «" + s.name + "» falla en el paso 1: " + s.steps.map((x) => x[3]).join(" · "));
        check(s.outcome === "Falla en el paso 2" && s.failed, "D · desenlace de la copia: «" + s.outcome + "»");
        check(s.undo === undoD + 2, "D · duplicar + fallar = 2 entradas de Undo (" + (s.undo - undoD) + ")");
        /* modificar la copia: su frase de caída, escrita en la fila */
        await b.press(`document.querySelector('.scStoryRow[data-step-id="3"] .scStepMessage')`);
        await b.ev(`document.querySelector(".scStepMessageInput").select(); true`);
        await b.type("El banco se cae"); await b.key("Enter");
        check((await state(b)).steps[0][3] === "El banco se cae", "D · la copia se modifica (su frase)");
        check(await b.ev(`JSON.stringify(P().scenarios[0])`) === originalStory, "D · la Historia original no cambia");

        /* E · Viewer de la copia: mismo fallo, mismo desenlace */
        const failLink = await b.ev(`createShareUrl(serializeProject(), location.href, { kind: "story", scenarioId: scActiveScenario().id })`);
        const vf = await viewer(failLink);
        check(vf.outcome === "Falla en el paso 2" && vf.visible, "E · el Viewer reproduce el fallo y acaba en «" + vf.outcome + "»");
        check(vf.seen.includes("El banco se cae") && vf.summary === "2 eventos no pudieron realizarse", "E · con su frase y el mismo resumen del motor («" + vf.summary + "»)");
        const okLink = await b.ev(`createShareUrl(serializeProject(), location.href, { kind: "story", scenarioId: P().scenarios[0].id })`);
        const vo = await viewer(okLink);
        check(vo.outcome === "Termina bien" && vo.summary === "", "E · la original en el Viewer: «" + vo.outcome + "»");

        /* B · «Falla aquí» en la original, desde el ⋯ de la fila */
        await b.ev(`scSwitchScenario(P().scenarios[0].id); true`); await sleep(200);
        const before = await page(b), undo0 = (await state(b)).undo;
        await b.press(`document.querySelector('.scStoryRow[data-step-id="1"] .scMore')`);
        const items = await b.menu();
        check(/^Falla aquíBanco no responde justo antes$/.test(items[1]), "B · «Falla aquí» es la primera acción del envío: «" + items[1] + "»");
        await b.press(b.menuItem("Falla aquí"));
        s = await state(b);
        check(JSON.stringify(s.steps) === JSON.stringify([["SET_STATE", 2, "DOWN", "Banco no responde"], ["SEND", 4, "", "El cliente paga"], ["SEND", 5, "", "El banco avisa a pagos"]]),
          "B · B cae en un momento propio justo antes del envío: " + s.steps.map((x) => x[3]).join(" · "));
        check(s.outcome === "Falla en el paso 2" && s.failed && !s.dialog, "B · el editor dice «" + s.outcome + "», sin diálogos");
        check(s.undo === undo0 + 1, "B · una sola entrada de Undo");
        check(await playEditor(b), "B · se reproduce hasta el final");
        const evs = await b.ev(`scPlayback.logEvents.filter((e) => e.type === "state_changed" || e.type === "send_failed").map((e) => e.type + ":" + (e.stepId) + ":" + (e.reason || e.to))`);
        check(JSON.stringify(evs) === JSON.stringify(["state_changed:3:DOWN", "send_failed:1:target_down", "send_failed:2:source_down"]), "B · el motor: B cae, el envío a B falla y lo que sale de B también: " + evs.join(", "));
        check(await b.ev(`document.querySelectorAll(".scStoryRow.scStatus_failed").length`) === 2, "B · las dos filas de envío quedan «No se completó»");
        await b.press(`document.getElementById("scReset")`);
        /* Present: el mismo desenlace al terminar, en su propia línea */
        await b.press(`document.getElementById("btnPresent")`); await sleep(500);
        await b.press(`document.getElementById("psPlay")`);
        check(await untilDone(b, `!!document.getElementById("psOutcome").textContent`), "B · Present reproduce hasta el final");
        const ps = await b.ev(`({ o: document.getElementById("psOutcome").textContent, s: document.getElementById("psSummary").textContent, v: document.getElementById("psOutcome").getBoundingClientRect().height > 0 })`);
        check(ps.o === "Falla en el paso 2" && ps.v && ps.s === "2 eventos no pudieron realizarse", "B · Present: «" + ps.o + "» · «" + ps.s + "»");
        await b.key("Escape"); await sleep(400);
        if (await b.ev(`typeof presenting !== "undefined" && presenting`)) await b.press(`document.getElementById("prExit")`);
        await b.ev(`if (scStatus !== "idle") scReset(); true`);

        /* C · Undo una vez (Ctrl+Z de verdad): la Historia como antes de «Falla aquí» */
        await b.ev(`document.activeElement && document.activeElement.blur && document.activeElement.blur(); true`);
        await b.key("z", 2); await sleep(200);
        s = await state(b);
        check(noCounter(await page(b)) === noCounter(before), "C · un Ctrl+Z devuelve la página exacta (salvo nextStepId, que nunca baja)");
        check(s.outcome === "Termina bien" && s.undo === undo0, "C · vuelve a «Termina bien» con una sola entrada menos");
        check(noCounter(JSON.stringify(JSON.parse(await page(b)).scenarios[0])) === noCounter(JSON.stringify(JSON.parse(original).scenarios[0])), "C · la original, como al principio");
        check(!b.errors.length, "sin errores de consola " + b.errors.join(" | "));
      } finally { b.close(); } }

    console.log("\nF · INGLÉS");
    { const b = await open(srv, "?lang=en");
      try {
        await loadDoc(b);
        await tell(b, "The customer pays", "The bank tells payments");
        let s = await state(b);
        check(s.outcome === "Ends well", "F · «" + s.outcome + "»");
        await b.press(`document.getElementById("scScenarioMenu")`);
        await b.press(b.menuItem("Duplicate as failure")); await sleep(200);
        const choose = await b.menu(), name = (await state(b)).name;
        check(name === "Story 1 — fails", "F · copy: «" + name + "»");
        check(choose[0] === "# Where does it fail?" && /^Step 1 · The customer pays/.test(choose[1]) && /^Step 2 · The bank tells payments/.test(choose[2]), "F · chooser: " + choose.join(" | "));
        await b.key("Escape"); await b.ev(`scClosePopover(); scSwitchScenario(P().scenarios[0].id); true`); await sleep(200);
        await b.press(`document.querySelector('.scStoryRow[data-step-id="1"] .scMore')`);
        const items = await b.menu();
        check(items[1] === "Fail hereBanco doesn't respond just before", "F · «" + items[1] + "»");
        await b.press(b.menuItem("Fail here"));
        s = await state(b);
        check(s.steps[0][3] === "Banco doesn't respond" && s.outcome === "Fails at step 2", "F · «" + s.steps[0][3] + "» · «" + s.outcome + "»");
        const notice = await b.ev(`document.getElementById("scNotice").textContent`);
        check(notice === "The story now fails at step 2.", "F · notice: «" + notice + "»");
        const panel = await b.ev(`[...document.querySelectorAll(".scOutcome, .scStoryRow .scStepMessage, .scStoryRow .scStatusText")].map((x) => x.textContent).join(" | ")`);
        check(!SPANISH.test(panel.replace(/Banco|Cliente|Pagos/g, "")), "F · no Spanish UI left: " + panel);
        await b.press(`document.getElementById("btnPresent")`); await sleep(500);
        await b.press(`document.getElementById("psPlay")`);
        await untilDone(b, `!!document.getElementById("psOutcome").textContent`);
        const ps = await b.ev(`document.getElementById("psOutcome").textContent + " | " + document.getElementById("psSummary").textContent`);
        check(ps === "Fails at step 2 | 2 steps couldn't run", "F · Present: «" + ps + "»");
        await b.key("Escape"); await sleep(300);
        const link = await b.ev(`createShareUrl(serializeProject(), location.href, { kind: "story", scenarioId: P().scenarios[0].id })`);
        const v = await viewer(link.replace("/s/", "/s/?lang=en"));
        check(v.outcome === "Fails at step 2", "F · Viewer in English: «" + v.outcome + "»");
        check(!b.errors.length, "no console errors " + b.errors.join(" | "));
      } finally { b.close(); } }

    console.log("\nMÓVIL 375×812 · con el dedo");
    { const b = await open(srv, "", 375, 812, true);
      try {
        await loadDoc(b);
        await b.press(`document.getElementById("btnStories")`, "touch"); await sleep(500);
        const ab = await b.at(360, 250), bc = await b.at(680, 250);
        await b.touch(ab.x, ab.y); await b.touch(bc.x, bc.y);
        await b.press(`document.getElementById("btnStoryExpand")`, "touch"); await sleep(500);
        check((await state(b)).outcome === "Termina bien", "la línea del desenlace: «Termina bien»");
        /* el aviso «Historia 1 creada» tapa la fila unos segundos (ya era así): se espera, y el menú se abre tocando la fila */
        await untilDone(b, `document.getElementById("scNotice").hidden`, 8000);
        await b.press(`document.querySelector('.scStoryRow[data-step-id="1"] .scStepPrimary')`, "touch");
        await b.press(b.menuItem("Falla aquí"), "touch");
        const s = await state(b);
        const line = await b.box(`document.querySelector(".scOutcome")`);
        check(s.outcome === "Falla en el paso 2" && !!line, "con el dedo: «" + s.outcome + "», a la vista");
        const scroll = await b.ev(`document.documentElement.scrollWidth`);
        check(scroll <= 375, "sin scroll horizontal (" + scroll + ")");
        check(!b.errors.length, "sin errores de consola " + b.errors.join(" | "));
      } finally { b.close(); } }

    console.log("\nEJEMPLOS · los desenlaces previstos y el documento intacto");
    for (const [slug, expect] of [["compra-online", { "Compra con éxito": "Termina bien", "El banco no responde": "Falla en el paso 4" }],
      ["inicio-de-sesion-oauth2", { "Iniciar sesión": "Termina bien", "El usuario no autoriza": "Termina bien" }]]) {
      const b = await open(srv, "?ejemplo=" + slug);
      try {
        await sleep(700);
        const before = await b.ev(`JSON.stringify(serializeProject())`);
        const got = {};
        for (const sc of await b.ev(`P().scenarios.map((s) => s.id)`)) {
          await b.ev(`scSwitchScenario(${sc}); true`); await sleep(150);
          got[await b.ev("scActiveScenario().name")] = (await state(b)).outcome;
        }
        check(JSON.stringify(got) === JSON.stringify(expect), slug + ": " + JSON.stringify(got));
        await b.ev(`scRun(); true`); await untilDone(b, `scStatus === "completed"`); await b.ev(`scReset(); true`);
        check(await b.ev(`JSON.stringify(serializeProject())`) === before, slug + ": mirar y reproducir sus Historias no cambia el documento");
        if (slug === "compra-online") {
          const id = await b.ev(`P().scenarios.find((s) => s.name === "El banco no responde").id`);
          const v = await viewer(await b.ev(`createShareUrl(serializeProject(), location.href, { kind: "story", scenarioId: ${id} })`));
          check(v.outcome === "Falla en el paso 4", "compra-online · «El banco no responde» en el Viewer: «" + v.outcome + "»");
        }
        check(!b.errors.length, "sin errores de consola " + b.errors.join(" | "));
      } finally { b.close(); }
    }
  } finally { srv.server.close(); }
  console.log(`\n${ok} ✔ · ${ko} ✘`);
  process.exit(ko ? 1 : 0);
})();
