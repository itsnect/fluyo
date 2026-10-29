"use strict";
/* FLUYO-STORIES-2.0 S2a · Portada y otras formas — QA funcional en Chrome real (cdp-lite, sin dependencias; ratón y dedo de verdad por CDP).
   A Share: la casilla «Incluir sus otras formas» marcada por defecto lleva la familia; desmarcada, solo la Historia (el enlace de
   siempre). B Viewer: portada (sistema, Historia, desenlace, un CTA), «Otras formas» al terminar y elegir una la abre sin recargar.
   C un enlace de una sola Historia sigue igual. D Present: la misma estructura, el mismo desenlace que el editor y el Viewer; abrir otra
   forma no toca el documento ni Deshacer. E inglés (y fr cae al inglés), cambio de idioma en vivo. F móvil 375×812 con el dedo.
   Uso: node test/fluyo-stories-2-0-s2a-browser.cjs [carpeta-de-capturas] */
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
  await b.goto(url, 1000);
  b.click = async (x, y) => {
    await b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
    await b.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
    await b.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
    await sleep(200);
  };
  b.touch = async (x, y) => {
    await b.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    await b.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await sleep(250);
  };
  b.box = (js) => b.ev(`(() => { const el = ${js}; if (!el) return null; const r = el.getBoundingClientRect(); return r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, left: r.left, right: r.right, top: r.top, bottom: r.bottom } : null; })()`);
  b.press = async (js, how = "click") => { const p = await b.box(js); if (!p) return false; await b[how](p.x, p.y); return true; };
  b.shot = async (name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await b.send("Page.captureScreenshot", { format: "png" }).then((r) => fs.writeFileSync(path.join(SHOTS, name + ".png"), Buffer.from(r.data, "base64"))); } };
  return b;
}
async function until(b, cond, ms = 30000) { for (let t = 0; t < ms; t += 150) { if (await b.ev(cond)) return true; await sleep(150); } return false; }
const $ = (id) => `document.getElementById(${JSON.stringify(id)})`;
/* lo que el Viewer enseña ahora */
const vstate = (v) => v.ev(`({ kicker: ${$("stKicker")}.textContent, title: ${$("stTitle")}.textContent, outcome: ${$("stOutcome")}.textContent,
  outcomeVisible: ${$("stOutcome")}.getBoundingClientRect().width > 0, play: !${$("stPlay")}.hidden, head: ${$("stOthers")}.hidden ? null : document.querySelector(".stOthersHead").textContent,
  others: ${$("stOthers")}.hidden ? null : [...document.querySelectorAll("#stOthersList .stOther")].map((x) => x.children[0].textContent + " · " + x.children[1].textContent),
  href: location.href, doc: JSON.stringify(doc) })`);
const pstate = (b) => b.ev(`({ kicker: ${$("psKicker")}.textContent, title: ${$("psTitle")}.textContent, outcome: ${$("psOutcome")}.textContent,
  head: ${$("psOthers")}.hidden ? null : document.querySelector(".psOthersHead").textContent,
  others: ${$("psOthers")}.hidden ? null : [...document.querySelectorAll("#psOthersList .psOther")].map((x) => x.children[0].textContent + " · " + x.children[1].textContent),
  active: scActiveScenario().name, undo: undoStack.length, doc: JSON.stringify(serializeProject()), view: [viewX, viewY, viewZoom].map((n) => Math.round(n * 100) / 100).join() })`);
const decode = (b, url) => b.ev(`decodeDeepLink(${JSON.stringify(url.split("#d=")[1])}).then((d) => d.doc.pages[d.doc.cur].scenarios.map((s) => s.name))`);
/* reproducir en el Viewer con el botón real y esperar al final («Otras formas» o, sin ellas, el desenlace) */
async function viewerPlay(v, how = "click") {
  await v.press($("stPlay"), how);
  return until(v, `typeof story !== "undefined" && !!story && story.status === "completed" && !!${$("stOutcome")}.textContent`);
}

(async () => {
  const srv = await serve(root);
  const links = {};
  try {
    console.log("\nA · SHARE (editor, Compra online)");
    { const b = await open(srv.base + "/?ejemplo=compra-online");
      try {
        const doc0 = await b.ev(`JSON.stringify(serializeProject())`), undo0 = await b.ev(`undoStack.length`);
        await b.press($("btnShare")); await sleep(300);
        const row = await b.ev(`({ shown: !${$("shareOthersRow")}.hidden && ${$("shareOthersRow")}.getBoundingClientRect().height > 0, checked: ${$("shareOthers")}.checked,
          label: document.querySelector("#shareOthersRow b").textContent, names: ${$("shareOthersNames")}.textContent })`);
        check(row.shown && row.checked && row.label === "Incluir sus otras formas" && row.names === "El banco no responde", "A · la casilla, marcada por defecto: «" + row.label + "» · " + row.names);
        await b.shot("a-share-dialog");
        await b.press($("shareCreate")); await until(b, `!!${$("shareLink")}.value`, 5000);
        links.family = await b.ev(`${$("shareLink")}.value`);
        check(JSON.stringify(await decode(b, links.family)) === JSON.stringify(["Compra con éxito", "El banco no responde"]), "A · el enlace lleva la elegida primero y su otra forma");
        check(await b.ev(`${$("shareResultNote")}.textContent`) === "Quien abra este enlace verá el diagrama y podrá reproducir la historia y sus otras formas. Los cambios posteriores no modificarán este enlace.", "A · la nota lo dice");
        await b.press($("shareClose")); await sleep(200);
        /* se reabre marcada; desmarcada = el enlace de siempre */
        await b.press($("btnShare")); await sleep(300);
        check(await b.ev(`${$("shareOthers")}.checked`), "A · al reabrir vuelve a estar marcada");
        await b.press($("shareOthers")); await sleep(100);
        check(!(await b.ev(`${$("shareOthers")}.checked`)), "A · un clic la desmarca");
        await b.press($("shareCreate")); await until(b, `!!${$("shareLink")}.value`, 5000);
        links.one = await b.ev(`${$("shareLink")}.value`);
        check(JSON.stringify(await decode(b, links.one)) === JSON.stringify(["Compra con éxito"]), "A · desmarcada: solo la Historia");
        check(links.one === await b.ev(`createShareUrl(serializeProject(), location.href, { kind: "story", scenarioId: scActiveScenario().id })`), "A · desmarcada: el enlace es el de siempre, byte a byte");
        check(links.family.length - links.one.length < 400, "A · la familia cuesta +" + (links.family.length - links.one.length) + " caracteres (" + links.family.length + " en total)");
        await b.press($("shareClose")); await sleep(200);
        /* con «sólo el diagrama» la casilla no aplica */
        await b.press($("btnShare")); await sleep(300);
        await b.press($("shareKindDiagram")); await sleep(150);
        const dim = await b.ev(`getComputedStyle(${$("shareOthersRow")}).opacity`);
        await b.press($("shareCreate")); await until(b, `!!${$("shareLink")}.value`, 5000);
        check(dim === "0.45" && JSON.stringify(await decode(b, await b.ev(`${$("shareLink")}.value`))) === "[]", "A · sólo el diagrama: la casilla se apaga y no viaja ninguna Historia");
        await b.press($("shareClose")); await sleep(200);
        check(await b.ev(`JSON.stringify(serializeProject())`) === doc0 && await b.ev(`undoStack.length`) === undo0, "A · compartir no toca el documento ni Deshacer");
        check(!b.errors.length, "A · sin errores de consola " + b.errors.join(" | "));
      } finally { b.close(); } }

    console.log("\nB · VIEWER (enlace con la familia)");
    { const v = await open(links.family);
      try {
        let s = await vstate(v);
        const href0 = s.href, doc0 = s.doc;
        check(s.kicker === "Compra online" && s.title === "Compra con éxito" && s.outcome === "Sin fallos" && s.outcomeVisible && s.play && s.others === null,
          "B · portada: «" + s.kicker + "» / «" + s.title + "» · «" + s.outcome + "», un CTA y nada más");
        await v.shot("b-viewer-cover");
        check(await viewerPlay(v), "B · Reproducir de verdad, hasta el final");
        s = await vstate(v);
        check(s.outcome === "Sin fallos" && s.head === "Otras formas" && JSON.stringify(s.others) === JSON.stringify(["El banco no responde · Falla en el paso 4"]),
          "B · al terminar: «" + s.outcome + "» y «" + s.head + "»: " + (s.others || []).join(" | "));
        await v.shot("b-viewer-end");
        await v.press(`document.querySelector("#stOthersList .stOther")`); await sleep(400);
        s = await vstate(v);
        check(s.title === "El banco no responde" && s.outcome === "Falla en el paso 4" && s.kicker === "Compra online" && s.play && s.others === null,
          "B · elegirla la abre en su portada: «" + s.title + "» · «" + s.outcome + "»");
        check(s.href === href0 && s.doc === doc0, "B · sin recargar: la URL y el documento instalado no cambian");
        await v.shot("b-viewer-other-cover");
        check(await viewerPlay(v), "B · se reproduce la otra forma");
        s = await vstate(v);
        check(s.outcome === "Falla en el paso 4" && JSON.stringify(s.others) === JSON.stringify(["Compra con éxito · Sin fallos"]), "B · acaba como anunciaba la portada; y ofrece volver: " + (s.others || []).join(" | "));
        const sum = await v.ev(`${$("stSummary")}.textContent`);
        check(sum === "1 evento no pudo realizarse", "B · el resumen del motor de siempre: «" + sum + "»");
        check(!v.errors.length, "B · sin errores de consola " + v.errors.join(" | "));
      } finally { v.close(); } }

    console.log("\nC · ENLACE DE UNA SOLA HISTORIA (como en v118)");
    { const v = await open(links.one);
      try {
        let s = await vstate(v);
        check(s.kicker === "Compra online" && s.title === "Compra con éxito" && s.outcome === "Sin fallos", "C · abre con portada");
        await viewerPlay(v);
        s = await vstate(v);
        check(s.outcome === "Sin fallos" && s.others === null, "C · al terminar no hay «Otras formas» (el enlace no las trae)");
        check(!v.errors.length, "C · sin errores de consola " + v.errors.join(" | "));
      } finally { v.close(); } }

    console.log("\nD · PRESENT (editor, Compra online)");
    { const b = await open(srv.base + "/?ejemplo=compra-online");
      try {
        /* el desenlace del editor para cada Historia (S1b), el que Present y el Viewer deben repetir */
        const editor = {};
        for (const id of await b.ev(`P().scenarios.map((s) => s.id)`)) { await b.ev(`scSwitchScenario(${id}); true`); await sleep(150); editor[await b.ev(`scActiveScenario().name`)] = await b.ev(`(document.querySelector(".scOutcome") || {}).textContent || ""`); }
        await b.ev(`scSwitchScenario(P().scenarios[0].id); true`); await sleep(150);
        check(editor["Compra con éxito"] === "Sin fallos" && editor["El banco no responde"] === "Falla en el paso 4", "D · el editor: " + JSON.stringify(editor));
        await b.press($("btnPresent")); await sleep(700);
        let s = await pstate(b);
        const doc0 = s.doc, undo0 = s.undo, view0 = s.view;
        check(s.kicker === "Compra online" && s.title === "Compra con éxito" && s.outcome === editor["Compra con éxito"] && s.others === null, "D · portada: «" + s.kicker + "» / «" + s.title + "» · «" + s.outcome + "»");
        await b.shot("d-present-cover");
        await b.press($("psPlay"));
        check(await until(b, `!${$("psOthers")}.hidden`), "D · Reproducir de verdad, hasta el final");
        s = await pstate(b);
        check(s.kicker === "Historia · Compra con éxito" && s.outcome === "Sin fallos" && s.head === "Otras formas" && JSON.stringify(s.others) === JSON.stringify(["El banco no responde · Falla en el paso 4"]),
          "D · al terminar: «" + s.outcome + "», «" + s.head + "»: " + (s.others || []).join(" | "));
        check(s.view === view0, "D · el diagrama no se movió (el encabezado ya tenía su sitio): " + s.view);
        await b.shot("d-present-end");
        await b.press(`document.querySelector("#psOthersList .psOther")`); await sleep(500);
        s = await pstate(b);
        check(s.active === "El banco no responde" && s.title === "El banco no responde" && s.outcome === editor["El banco no responde"] && s.others === null && await b.ev(`presenting && scStatus === "idle"`),
          "D · elegirla la abre en su portada, sin salir de Present: «" + s.title + "» · «" + s.outcome + "»");
        check(s.doc === doc0 && s.undo === undo0, "D · ni el documento ni Deshacer cambian");
        await b.press($("psPlay"));
        await until(b, `!${$("psOthers")}.hidden`);
        s = await pstate(b);
        check(s.outcome === "Falla en el paso 4" && JSON.stringify(s.others) === JSON.stringify(["Compra con éxito · Sin fallos"]), "D · acaba como el editor y el Viewer: «" + s.outcome + "»");
        await b.press($("prExit")); await sleep(300);
        check(!(await b.ev(`presenting`)) && await b.ev(`undoStack.length`) === undo0, "D · al salir, Deshacer sigue igual");
        check(!b.errors.length, "D · sin errores de consola " + b.errors.join(" | "));
      } finally { b.close(); } }

    console.log("\nE · INGLÉS (y fr cae al inglés)");
    { const b = await open(srv.base + "/?ejemplo=compra-online&lang=en");
      try {
        await b.press($("btnShare")); await sleep(300);
        check(await b.ev(`document.querySelector("#shareOthersRow b").textContent`) === "Include its other ways", "E · Share: «Include its other ways»");
        await b.press($("shareCreate")); await until(b, `!!${$("shareLink")}.value`, 5000);
        check(/its other ways/.test(await b.ev(`${$("shareResultNote")}.textContent`)), "E · la nota en inglés");
        await b.press($("shareClose")); await sleep(200);
        await b.press($("btnPresent")); await sleep(700);
        /* en inglés, «Ejemplo» abre la versión inglesa (EXAMPLES-001): los nombres son los de ese documento */
        const names = await b.ev(`({ page: P().name, stories: P().scenarios.map((x) => x.name) })`);
        let s = await pstate(b);
        check(s.kicker === names.page && names.page === "Online checkout" && s.outcome === "No failures", "E · Present: «" + s.kicker + "» · «" + s.outcome + "»");
        await b.press($("psPlay")); await until(b, `!${$("psOthers")}.hidden`);
        s = await pstate(b);
        check(s.kicker === "Story · " + names.stories[0] && s.head === "Other ways" && JSON.stringify(s.others) === JSON.stringify([names.stories[1] + " · Fails at step 4"]), "E · Present al terminar: «" + s.kicker + "», «" + s.head + "»: " + (s.others || []).join(" | "));
        check(!b.errors.length, "E · sin errores de consola " + b.errors.join(" | "));
      } finally { b.close(); } }
    { const v = await open(links.family.replace("/s/", "/s/?lang=en"));
      try {
        let s = await vstate(v);
        check(s.kicker === "Compra online" && s.outcome === "No failures", "E · Viewer: «" + s.kicker + "» · «" + s.outcome + "»");
        await viewerPlay(v);
        s = await vstate(v);
        check(s.head === "Other ways" && JSON.stringify(s.others) === JSON.stringify(["El banco no responde · Fails at step 4"]), "E · Viewer al terminar: «" + s.head + "»: " + (s.others || []).join(" | "));
        await v.shot("e-viewer-end-en");
        const doc0 = s.doc;
        await v.ev(`FluyoI18n.setLocale("es"); true`); await sleep(300);
        s = await vstate(v);
        check(s.head === "Otras formas" && s.outcome === "Sin fallos" && JSON.stringify(s.others) === JSON.stringify(["El banco no responde · Falla en el paso 4"]), "E · cambiar a español en vivo repinta: «" + s.head + "»");
        check(s.doc === doc0, "E · cambiar de idioma no toca el documento");
        check(!v.errors.length, "E · sin errores de consola " + v.errors.join(" | "));
      } finally { v.close(); } }
    { const v = await open(links.family.replace("/s/", "/s/?lang=fr"));
      try {
        await viewerPlay(v);
        const s = await vstate(v);
        check(s.head === "Other ways" && s.outcome === "No failures", "E · fr cae al inglés, como S1b: «" + s.head + "» · «" + s.outcome + "»");
      } finally { v.close(); } }

    console.log("\nF · MÓVIL 375×812 · con el dedo");
    { const v = await open(links.family, 375, 812, true);
      try {
        let s = await vstate(v);
        const card = await v.box($("stNow"));
        check(s.kicker === "Compra online" && s.outcome === "Sin fallos" && card && card.left >= 0 && card.right <= 375, "F · portada dentro de la pantalla (" + Math.round(card.left) + "–" + Math.round(card.right) + " px)");
        await v.shot("f-mobile-cover");
        check(await viewerPlay(v, "touch"), "F · Reproducir con el dedo, hasta el final");
        const other = await v.box(`document.querySelector("#stOthersList .stOther")`);
        check(!!other && other.left >= 0 && other.right <= 375 && other.h >= 40, "F · «Otras formas» a la vista y tocable (" + (other ? Math.round(other.w) + "×" + Math.round(other.h) : "—") + " px)");
        await v.shot("f-mobile-end");
        await v.touch(other.x, other.y);
        s = await vstate(v);
        check(s.title === "El banco no responde" && s.outcome === "Falla en el paso 4", "F · tocarla la abre: «" + s.title + "» · «" + s.outcome + "»");
        const scroll = await v.ev(`document.documentElement.scrollWidth`);
        check(scroll <= 375, "F · sin scroll horizontal (" + scroll + ")");
        check(!v.errors.length, "F · sin errores de consola " + v.errors.join(" | "));
      } finally { v.close(); } }
  } finally { srv.server.close(); }
  console.log(`\n${ok} ✔ · ${ko} ✘`);
  process.exit(ko ? 1 : 0);
})();
