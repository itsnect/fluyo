"use strict";
/* FLUYO-STORIES-2.0 S1a · Contar con clics — QA funcional en Chrome real (cdp-lite, sin dependencias, ratón y dedo de verdad por CDP).
   De «Historias» a una Historia de 3 momentos narrados sin abrir ningún diálogo; blanco de 12 px a zoom de encaje; arrastrar,
   Mayús y doble clic no cuentan pasos; Undo = una acción; la frase llega al Viewer; móvil 375×812 con el dedo; inglés; un
   documento existente no cambia hasta que se cuenta algo. Uso: node test/fluyo-stories-2-0-s1a-browser.cjs */
const path = require("node:path");
const { serve, launch } = require("./cdp-lite.cjs");
const root = path.join(__dirname, "..");
let ok = 0, ko = 0;
const check = (c, msg) => { c ? ok++ : ko++; console.log((c ? "  ✔ " : "  ✘ ") + msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const N = (id, x, label) => ({ id, shape: "rect", x, y: 250, w: 150, h: 60, label, color: "#6a9fb5", fill: null, border: "solid", lblPos: "center", textBg: null, font: null, bold: false, pulse: false, order: id });
const E = (id, from, to) => ({ id, from, to, route: "straight", fromSide: null, toSide: null, waypoints: [], label: "", font: null, bold: false, endArrow: true, startArrow: false, flowDir: "normal" });
const DOC = { version: 5, app: "fluyo", doc: { theme: "dark", customBg: "", cur: 0, nextEventTypeId: 1, eventTypes: [],
  pages: [{ name: "Sistema", nextId: 6, behaviors: [], nextScenarioId: 1, nodes: [N(1, 200, "Cliente"), N(2, 520, "Tienda"), N(3, 840, "Pagos")], edges: [E(4, 1, 2), E(5, 2, 3)], scenarios: [] }] },
  settings: { speed: 0.5, dots: 3, build: false, stagger: 0.45, grid: false, snap: false, font: "Georgia, serif", single: false } };

async function open(srv, query = "", w = 1440, h = 900, mobile = false) {
  const b = await launch(), errors = [];
  b.on((d) => {
    if (d.method === "Runtime.exceptionThrown") errors.push(d.params.exceptionDetails.exception ? d.params.exceptionDetails.exception.description : d.params.exceptionDetails.text);
    if (d.method === "Runtime.consoleAPICalled" && d.params.type === "error") errors.push(d.params.args.map((a) => a.value || a.description).join(" "));
  });
  b.errors = errors;
  await b.viewport(w, h, mobile);
  await b.goto(srv.base + "/" + query, 900);
  /* acciones del usuario: cada clic, toque, tecla o texto suma uno (AC1) */
  b.actions = 0;
  b.click = async (x, y, opts = {}) => {
    b.actions++;
    const base = { x, y, button: "left", clickCount: opts.count || 1, modifiers: opts.modifiers || 0 };
    await b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
    await b.send("Input.dispatchMouseEvent", { type: "mousePressed", ...base });
    if (opts.to) for (let i = 1; i <= 6; i++) await b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x + (opts.to.x - x) * i / 6, y: y + (opts.to.y - y) * i / 6, button: "left", buttons: 1 });
    await b.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...base, ...(opts.to || {}) });
    await sleep(120);
  };
  b.touch = async (x, y) => {
    b.actions++;
    await b.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    await b.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await sleep(150);
  };
  b.type = async (text) => { b.actions++; await b.send("Input.insertText", { text }); await sleep(60); };
  b.key = async (key) => {
    b.actions++;
    const code = { Enter: 13, Escape: 27 }[key];
    await b.send("Input.dispatchKeyEvent", { type: "keyDown", key, code: key, windowsVirtualKeyCode: code });
    await b.send("Input.dispatchKeyEvent", { type: "keyUp", key, code: key, windowsVirtualKeyCode: code });
    await sleep(120);
  };
  /* punto del mundo → pantalla (CSS px) */
  b.at = (x, y) => b.ev(`(() => { const r = cv.getBoundingClientRect(); return { x: r.left + viewX + ${x} * viewZoom, y: r.top + viewY + ${y} * viewZoom }; })()`);
  return b;
}
const state = (b) => b.ev(`({ steps: (scActiveScenario() || { steps: [] }).steps.map(s => [s.action, s.edgeId || s.nodeId, s.message || ""]),
  types: doc.eventTypes.map(e => e.name), undo: undoStack.length, dialog: !!document.querySelector("dialog[open]"), editBox: getComputedStyle(document.getElementById("editBox")).display !== "none",
  focus: document.activeElement && document.activeElement.className, sel: selN.size + selE.size, x: P().nodes.map(n => n.x).join() })`);
async function loadDoc(b, d = DOC) {
  await b.ev(`applyProjectData(${JSON.stringify(d)}); undoStack.length = 0; redoStack.length = 0; true`);
  b.actions = 0;
}

(async () => {
  const srv = await serve(root);
  try {
    console.log("\nESCRITORIO 1440×900 · de «Historias» a contar 3 momentos, sin diálogos");
    { const b = await open(srv);
      try {
        await loadDoc(b);
        const hist = await b.ev(`(() => { const r = document.getElementById("modeStory").getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`).catch(() => null);
        if (hist) await b.click(hist.x, hist.y); else { b.actions++; await b.ev(`setUiMode("story"); true`); }
        await sleep(400);
        const zoom = await b.ev("viewZoom");
        const empty = await b.ev(`document.getElementById("scEmptyState").innerText`);
        check(/Toca una conexión o un elemento del sistema/.test(empty), "estado vacío: «Toca una conexión o un elemento del sistema…»");
        /* 11 px por debajo del trazo de Cliente → Tienda, a zoom de encaje */
        const ab = await b.at(360, 250), bc = await b.at(680, 250), pagos = await b.at(840, 250);
        await b.click(ab.x, ab.y + 11);
        let s = await state(b);
        check(s.steps.length === 1 && s.steps[0][0] === "SEND" && s.steps[0][1] === 4, `a zoom ${zoom.toFixed(2)}, un clic a 11 px de la conexión crea el envío`);
        check(s.focus === "scStepMessageInput", "el foco queda en la frase de la fila");
        await b.type("El cliente pulsa «Pagar»"); await b.key("Enter");
        await b.click(bc.x, bc.y);
        await b.type("La tienda pide el cobro");
        await b.click(pagos.x, pagos.y);   // salir del campo guarda la frase anterior
        await b.type("Pagos aprueba"); await b.key("Enter");
        s = await state(b);
        check(JSON.stringify(s.steps) === JSON.stringify([["SEND", 4, "El cliente pulsa «Pagar»"], ["SEND", 5, "La tienda pide el cobro"], ["OCCURRENCE", 3, "Pagos aprueba"]]),
          "3 momentos narrados: " + s.steps.map((x) => x[2]).join(" · "));
        check(!s.dialog, "ningún diálogo abierto (tampoco el de Evento)");
        check(s.types.join() === "Paso,Nota", "tipos implícitos: " + s.types.join(", "));
        check(s.undo === 6, "Undo: 3 toques + 3 frases = 6 entradas (" + s.undo + ")");
        check(b.actions <= 12, `AC1: ${b.actions} acciones (clics, teclas y textos) de «Historias» a 3 momentos narrados (≤ 12)`);
        /* reproducir: la frase es el título del momento */
        await b.ev(`scRun(); true`); await sleep(700);
        const now = await b.ev(`document.getElementById("scNow") ? document.getElementById("scNow").innerText : ""`);
        check(/El cliente pulsa «Pagar»/.test(now), "al reproducir, el momento 1 se titula con la frase");
        await b.ev(`scReset(); true`);
        /* Undo/Redo de una acción */
        await b.ev(`undo(); true`);
        s = await state(b);
        check(s.steps.length === 3 && s.steps[2][2] === "", "Undo quita SOLO la última frase");
        await b.ev(`undo(); true`);
        check((await state(b)).steps.length === 2, "otro Undo quita SOLO el último paso");
        await b.ev(`redo(); redo(); true`);
        check((await state(b)).steps.length === 3, "Redo los devuelve");
        /* Share → Viewer: la frase llega intacta */
        const link = await b.ev(`createShareUrl(serializeProject(), location.href, { kind: "story", scenarioId: scActiveScenario().id })`);
        const v = await launch();
        try {
          await v.goto(link, 1200);
          await v.ev(`document.getElementById("stPlay").click(); true`); await sleep(250);
          await v.ev(`document.getElementById("stPause").click(); true`); await sleep(150);
          const seen = [];
          for (let i = 0; i < 5; i++) {
            seen.push(await v.ev(`document.getElementById("stTitle").textContent`));
            const more = await v.ev(`(() => { const n = document.getElementById("stNext"); if (n.hidden || n.disabled) return false; n.click(); return true; })()`);
            if (!more) break; await sleep(150);
          }
          check(["El cliente pulsa «Pagar»", "La tienda pide el cobro", "Pagos aprueba"].every((t) => seen.includes(t)), "Viewer del enlace: " + seen.join(" · "));
        } finally { v.close(); }
        check(!b.errors.length, "sin errores de consola " + b.errors.join(" | "));
      } finally { b.close(); } }

    console.log("\nESCRITORIO · lo que NO cuenta un paso");
    { const b = await open(srv);
      try {
        await loadDoc(b); await b.ev(`setUiMode("story"); fitView(); true`); await sleep(300);
        const ab = await b.at(360, 250), tienda = await b.at(520, 250);
        await b.click(ab.x, ab.y + 17);
        check((await state(b)).steps.length === 0, "a 17 px de la conexión, nada");
        const x0 = (await state(b)).x;
        await b.click(tienda.x, tienda.y, { to: { x: tienda.x + 60, y: tienda.y + 30 } });
        let s = await state(b);
        check(s.steps.length === 0 && s.x !== x0, "arrastrar un elemento lo mueve y no cuenta ningún paso");
        await b.click(ab.x, ab.y, { modifiers: 8 });
        s = await state(b);
        check(s.steps.length === 0 && s.sel === 1, "Mayús + clic selecciona la conexión, sin paso");
        await b.ev(`clearSel(); true`);
        const t2 = await b.at(580, 280);
        await b.click(t2.x, t2.y); await b.click(t2.x, t2.y, { count: 2 });
        await b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: t2.x, y: t2.y });
        await sleep(200);
        s = await state(b);
        check(s.steps.length === 1 && !s.editBox, "doble clic en un elemento: UN paso y no se abre su texto");
        check(!b.errors.length, "sin errores de consola " + b.errors.join(" | "));
      } finally { b.close(); } }

    console.log("\nMÓVIL 375×812 · con el dedo");
    { const b = await open(srv, "", 375, 812, true);
      try {
        await loadDoc(b);
        /* se entra como en el móvil: el botón «Historias» de abajo abre la hoja y deja el sistema encima */
        const hb = await b.ev(`(() => { const r = document.getElementById("btnStories").getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
        await b.touch(hb.x, hb.y); await sleep(500);
        const zoom = await b.ev("viewZoom");
        const ab = await b.at(360, 250);
        await b.touch(ab.x, ab.y + 10);
        let s = await state(b);
        check(s.steps.length === 1 && s.steps[0][1] === 4, `a zoom ${zoom.toFixed(2)}, tocar a 10 px de la conexión crea el envío`);
        check(s.focus !== "scStepMessageInput", "con el dedo no se abre el teclado sobre el lienzo");
        const ab2 = await b.at(680, 250);
        await b.touch(ab2.x, ab2.y);
        check((await state(b)).steps.length === 2, "se sigue contando con el dedo sobre el sistema (2 pasos)");
        /* con la hoja plegada solo se ve la cabecera: la frase se escribe al ampliar «Historia», donde el campo espera */
        const ex = await b.ev(`(() => { const r = document.getElementById("btnStoryExpand").getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
        await b.touch(ex.x, ex.y); await sleep(500);
        const field = await b.ev(`(() => { const f = document.querySelector(".scStepMessageInput"); if (!f) return null; f.scrollIntoView({ block: "nearest" }); const r = f.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, seen: r.bottom <= innerHeight && document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === f }; })()`);
        check(!!field && field.w > 150 && field.seen, "al ampliar «Historia», el campo del último paso está a la vista (" + (field ? Math.round(field.w) + " px, y " + Math.round(field.y) : "no") + ")");
        if (field) {
          await b.touch(field.x, field.y);
          check((await state(b)).focus === "scStepMessageInput", "tocar el campo lo enfoca");
          await b.type("Desde el móvil"); await b.key("Enter");
          check((await state(b)).steps[1][2] === "Desde el móvil", "y la frase se guarda");
        }
        const scroll = await b.ev(`document.documentElement.scrollWidth`);
        check(scroll <= 375, "sin scroll horizontal (" + scroll + ")");
        check(!b.errors.length, "sin errores de consola " + b.errors.join(" | "));
      } finally { b.close(); } }

    console.log("\nINGLÉS");
    { const b = await open(srv, "?lang=en");
      try {
        await loadDoc(b); await b.ev(`setUiMode("story"); fitView(); true`); await sleep(300);
        const empty = await b.ev(`document.getElementById("scEmptyState").innerText`);
        check(/Tap a connection or an element of the system/.test(empty), "empty state: «" + empty.trim() + "»");
        const bc = await b.at(680, 250), cli = await b.at(200, 250);
        await b.click(bc.x, bc.y); await b.key("Escape"); await b.click(cli.x, cli.y);
        const s = await state(b);
        check(s.types.join() === "Step,Note", "implicit types: " + s.types.join(", "));
        const ph = await b.ev(`document.querySelector(".scStepMessageInput") && document.querySelector(".scStepMessageInput").placeholder`);
        check(ph === "Something happens at Cliente", "placeholder: «" + ph + "»");
        check(!b.errors.length, "no console errors " + b.errors.join(" | "));
      } finally { b.close(); } }

    console.log("\nDOCUMENTO EXISTENTE · Compra online (EXAMPLES)");
    { const b = await open(srv, "?ejemplo=compra-online", 1440, 900);
      try {
        await sleep(600);
        const before = await b.ev(`JSON.stringify(serializeProject())`);
        await b.ev(`scSelectStory(P().scenarios[1].id); scRefreshIfVisible(); true`);
        await b.ev(`scRun(); true`); await sleep(1500); await b.ev(`scReset(); true`);
        check(await b.ev(`JSON.stringify(serializeProject())`) === before, "abrir, cambiar de Historia y reproducir no cambia el documento");
        const types0 = await b.ev(`doc.eventTypes.length`);
        const pagosBanco = await b.ev(`(() => { const e = P().edges.find(e => nodeById(e.from).label.startsWith("Pagos") && nodeById(e.to).label.startsWith("Banco")) || P().edges[2]; const p = edgePoints(e), m = { x: (p[0].x + p[p.length - 1].x) / 2, y: (p[0].y + p[p.length - 1].y) / 2 }; const r = cv.getBoundingClientRect(); return { x: r.left + viewX + m.x * viewZoom, y: r.top + viewY + m.y * viewZoom }; })()`);
        await b.click(pagosBanco.x, pagosBanco.y);
        const s = await state(b);
        check(s.steps.length === 7 && (await b.ev(`doc.eventTypes.length`)) === types0, "un toque añade el paso 7 reutilizando un evento de la Historia (sin tipo nuevo)");
        await b.key("Escape");
        await b.ev(`undo(); true`);
        const noCounter = (j) => j.replace(/"nextStepId":\d+/g, "");
        check(noCounter(await b.ev(`JSON.stringify(serializeProject())`)) === noCounter(before), "Undo devuelve el documento byte a byte (salvo nextStepId, que nunca baja: Undo de siempre)");
        check(!b.errors.length, "sin errores de consola " + b.errors.join(" | "));
      } finally { b.close(); } }
  } finally { srv.server.close(); }
  console.log(`\n${ok} ✔ · ${ko} ✘`);
  process.exit(ko ? 1 : 0);
})();
