"use strict";
/* FLUYO-I18N-002 S2b — Chrome REAL (CDP sin dependencias, test/cdp-lite.cjs): el texto de la reproducción que compone el kernel y los
   nombres sembrados de Historia, en español (IDÉNTICO a 326872e, servido aparte con FLUYO_BASE_ROOT) y en inglés.
   · EDITOR  Reproducción completa de una Historia que falla («Not completed · …», «Playback finished», «1 step couldn't run») y de
             otra que sale bien; errores de arranque (en el idioma de ese momento); «+ New story» → «Story 1», «Story 2»; duplicar →
             «Story 1 copy», «Story 1 copy 2»; el documento (serializeProject) idéntico al de la base en español; el contenido del autor
             intacto; cambiar de idioma en vivo no cambia ningún nombre ni el documento.
   · PRESENT y VIEWER  La misma reproducción en inglés y en español (la banda, el cierre, «step»).
   · fr  Cae al inglés, nunca al español.
   Uso: node test/fluyo-i18n-002-s2b-browser.cjs   (FLUYO_CHROME=<ruta>; FLUYO_BASE_ROOT=<árbol de 326872e>). Sin Chrome: se salta. */
const fs = require("node:fs"), path = require("node:path");
const { serve, launch, CHROME } = require("./cdp-lite.cjs");
const root = path.resolve(process.env.FLUYO_ROOT || path.join(__dirname, ".."));
const baseRoot = process.env.FLUYO_BASE_ROOT ? path.resolve(process.env.FLUYO_BASE_ROOT) : null;
if (!CHROME || !fs.existsSync(CHROME)) { console.log("(sin Chrome: " + CHROME + ") — se salta"); process.exit(0); }

let passed = 0, failed = 0;
const check = (cond, msg) => { if (cond) { passed++; console.log("  ✔ " + msg); } else { failed++; console.log("  ✘ " + msg); } };
const info = (msg) => console.log("  ℹ " + msg);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SPANISH = /[áéíóúñ¿¡«»]|\b(no está|vuelve a estar|se completó|reproducción|eventos?|conexión|elemento|historia|copia|apunta|pudo|pudieron)\b/i;

const AUTHOR = { story: "Compra con éxito", story2: "El banco no responde", msg: "El cliente pulsa «Pagar» (49 €)", et: "Petición" };
const N = (id, label, x, y) => ({ id, shape: "rect", x, y, w: 170, h: 64, label, color: "#5b8db5", fill: null, border: "solid", lblPos: "center", textBg: null, font: null, bold: false, pulse: false, order: id });
const E = (id, from, to) => ({ id, from, to, route: "straight", fromSide: null, toSide: null, waypoints: [], label: "", font: null, bold: false, endArrow: true, startArrow: false, flowDir: "normal", kind: "FLOWS_TO" });
const S = (id, at, action, target, eventTypeId, extra = {}) => Object.assign({ id, at, action }, action === "SEND" ? { edgeId: target } : { nodeId: target }, eventTypeId ? { eventTypeId } : {}, extra);
const DOC = { version: 5, app: "fluyo", settings: { speed: 0.5, dots: 3, build: false, stagger: 0.45, grid: false, snap: false, font: "Georgia, serif", single: false },
  doc: { theme: "crema", customBg: "", cur: 0, nextEventTypeId: 4,
    eventTypes: [{ id: 1, name: AUTHOR.et, primitive: "FLOW", sentenceTemplate: "{source} pide a {target}", visual: { kind: "token", value: "●" }, motion: "normal" },
      { id: 2, name: "Respuesta", primitive: "FLOW", sentenceTemplate: "{source} responde a {target}", visual: { kind: "token", value: "◆" }, motion: "normal" },
      { id: 3, name: "Caída", primitive: "SET_AVAILABILITY", availability: "DOWN", sentenceTemplate: "{target} se cae", visual: { kind: "token", value: "✕" } }],
    pages: [{ name: "Compra online", nextId: 100, behaviors: [], nextScenarioId: 3,
      nodes: [N(1, "Cliente", 200, 300), N(2, "Tienda online", 500, 300), N(3, "Pagos", 800, 300), N(4, "Banco", 800, 520)],
      edges: [E(6, 1, 2), E(7, 2, 3), E(8, 3, 4)],
      scenarios: [
        { id: 1, engineVersion: 2, name: AUTHOR.story, nextStepId: 4, steps: [S(1, 0, "SEND", 6, 1, { message: AUTHOR.msg }), S(2, 1000, "SEND", 7, 1), S(3, 2000, "SEND", 8, 1)] },
        { id: 2, engineVersion: 2, name: AUTHOR.story2, nextStepId: 4, steps: [S(1, 0, "SEND", 6, 1), S(2, 1000, "SET_STATE", 4, 3, { state: "DOWN" }), S(3, 2000, "SEND", 8, 1)] }] }] } };

const norm = (s) => String(s || "").replace(/\s+/g, " ").trim();
async function boot(b, base, lang, { doc = true, path: p = "/" } = {}) {
  b.errors = [];
  b.on((d) => { if (d.method === "Runtime.exceptionThrown") b.errors.push("pageerror: " + JSON.stringify(d.params.exceptionDetails.exception || d.params.exceptionDetails.text).slice(0, 200));
    if (d.method === "Runtime.consoleAPICalled" && d.params.type === "error") b.errors.push("console: " + (d.params.args || []).map((a) => a.value || a.description).join(" ").slice(0, 200)); });
  await b.viewport(1440, 900);
  await b.goto(base + p + (lang === "es" ? "" : "?lang=" + lang));
  for (let i = 0; i < 80; i++) { if (await b.ev("typeof enterPresent==='function' && typeof FluyoI18n==='object' && typeof refreshPanel==='function'").catch(() => false)) break; await sleep(150); }
  if (doc) await b.ev(`applyProjectData(${JSON.stringify(DOC)}); fitView(); clearSel(); renderTabs(); true`);
}
/* Reproduce con `start()` hasta que `done()` y devuelve la secuencia de textos distintos que `read()` vio */
async function sample(b, read, done, ms = 20000) {
  const seen = []; const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const v = norm(await b.ev(read)); if (v && seen[seen.length - 1] !== v) seen.push(v);
    if (await b.ev(done)) { await sleep(150); const w = norm(await b.ev(read)); if (w && seen[seen.length - 1] !== w) seen.push(w); return seen; }
    await sleep(60);
  }
  throw new Error("la reproducción no terminó: " + JSON.stringify(seen));
}
const scNow = "document.getElementById('scNow') ? document.getElementById('scNow').textContent : ''";
async function editorPlay(b, storyId) {
  await b.ev(`setUiMode('story'); scSelectStory(${storyId}); scRenderPanel(); true`); await sleep(250);
  await b.ev("scRun(); true");
  return sample(b, scNow, "/^(Terminada|Finished)/.test((document.getElementById('scNow')||{textContent:''}).textContent.trim())");
}
/* La hoja de Historias (la barra, el transporte, la línea de tiempo y el estado) como píxeles: un hash del PNG recortado */
async function sheetPixels(b) {
  const r = await b.ev("(function(){var e=document.querySelector('.storyBar').parentElement.getBoundingClientRect();return JSON.stringify({x:Math.max(0,e.x),y:Math.max(0,e.y),width:Math.ceil(e.width),height:Math.ceil(e.height)});})()");
  const shot = await b.send("Page.captureScreenshot", { format: "png", clip: { ...JSON.parse(r), scale: 1 } });
  return require("node:crypto").createHash("sha256").update(shot.data).digest("hex").slice(0, 16) + ":" + shot.data.length;
}
const docJson = (b) => b.ev("JSON.stringify(serializeProject())");

/* ───────────────────────── EDITOR ───────────────────────── */
async function editor(base, lang) {
  const b = await launch();
  try {
    await boot(b, base, lang);
    const before = await docJson(b);
    const fail = await editorPlay(b, 2);
    await sleep(1500);   // los efectos del lienzo terminan; la hoja queda quieta
    const px = await sheetPixels(b);
    const ok = await editorPlay(b, 1);
    const after = await docJson(b);
    // arranque con error: un envío que apunta a una conexión que ya no existe
    await b.ev(`P().scenarios[1].steps[0].edgeId = 999; scSelectStory(2); scRenderPanel(); scRun(); true`); await sleep(300);
    const err = norm(await b.ev("document.getElementById('scErrors') ? document.getElementById('scErrors').textContent : ''"));
    const errOpen = await b.ev("typeof scErrors!=='undefined' ? JSON.stringify(scErrors) : '[]'");
    await b.ev("if (isScenarioPlaybackActive()) scReset(); true");
    return { fail, ok, before, after, err, errOpen, px, errors: b.errors };
  } finally { b.close(); }
}
async function names(base, lang) {
  const b = await launch();
  try {
    await boot(b, base, lang, { doc: false });
    await b.ev("setUiMode('story'); true"); await sleep(200);
    const click = async (id) => { await b.ev(`document.getElementById('${id}').click(); true`); await sleep(150); };
    await click("scStoryAdd"); await click("scStoryAdd");
    const list = () => b.ev("JSON.stringify(P().scenarios.map(s=>s.name))").then(JSON.parse);
    const created = await list();
    const first = await b.ev("P().scenarios[0].id");
    for (let k = 0; k < 2; k++) { await b.ev(`scSelectStory(${first}); scDuplicateScenario(); true`); await sleep(150); }
    const all = await list();
    const doc1 = await docJson(b);
    // en vivo: cambiar de idioma no toca ningún nombre ni el documento
    await b.ev("FluyoI18n.setLocale('en',{persist:false}); true"); await sleep(250);
    const live1 = await docJson(b); await b.ev("FluyoI18n.setLocale('es',{persist:false}); true"); await sleep(250);
    const live2 = await docJson(b);
    // al volver, una Historia nueva nace en el idioma de ahora (español)
    await click("scStoryAdd");
    const lastName = (await list()).slice(-1)[0];
    return { created, all, doc1, live: live1 === doc1 && live2 === doc1, lastName, errors: b.errors };
  } finally { b.close(); }
}

/* ───────────────────────── PRESENT y VIEWER ───────────────────────── */
async function present(base, lang) {
  const b = await launch();
  try {
    await boot(b, base, lang);
    await b.ev("scSelectStory(2); scRenderPanel(); enterPresent(); true"); await sleep(300);
    await b.ev("presentPlay && presentPlay(); true");
    const seq = await sample(b, "document.getElementById('psCaption').textContent + '|' + document.getElementById('psSummary').textContent", "(function(){var p=document.getElementById('psPlay'); return !!p && !p.hidden && /↻/.test(p.textContent);})()", 20000);
    const probe = await b.ev("typeof presentHeaderBottom==='function' ? presentHeaderBottom() : -1");
    return { seq, probe, errors: b.errors };
  } finally { b.close(); }
}
async function viewer(base, lang) {
  const b = await launch();
  try {
    await boot(b, base, lang);
    await b.ev("scSelectStory(2); scRenderPanel(); true");
    await b.ev("document.getElementById('btnShare').click(); true");
    for (let i = 0; i < 40; i++) { if (await b.ev("!!document.querySelector('#shareDialog[open]')")) break; await sleep(100); }
    await b.ev("document.getElementById('shareCreate').click(); true");
    let link = ""; for (let i = 0; i < 80; i++) { link = await b.ev("document.getElementById('shareLink').value || ''"); if (/#d=/.test(link)) break; await sleep(100); }
    if (!/#d=/.test(link)) throw new Error("sin enlace de Compartir");
    const v = await launch();
    try {
      const verrs = []; v.on((d) => { if (d.method === "Runtime.exceptionThrown") verrs.push("pageerror"); });
      await v.viewport(1440, 900);
      await v.goto(link.replace(/^https?:\/\/[^/]+/, base).replace("/s/#", "/s/" + (lang === "es" ? "" : "?lang=" + lang) + "#"));
      for (let i = 0; i < 80; i++) { if (await v.ev("!!document.getElementById('stPlay') && !document.getElementById('stPlay').hidden")) break; await sleep(150); }
      await v.ev("document.getElementById('stPlay').click(); true");
      const seq = await sample(v, "document.getElementById('stCaption').textContent + '|' + document.getElementById('stSummary').textContent", "(function(){var s=document.getElementById('stSummary'); return !!s && s.textContent.trim().length>0;})()", 20000);
      return { seq, errors: [...b.errors, ...verrs] };
    } finally { v.close(); }
  } finally { b.close(); }
}

(async () => {
  const mine = await serve(root);
  const old = baseRoot ? await serve(baseRoot) : null;
  try {
    console.log("\nEDITOR · español (idéntico a 326872e)");
    const es = await editor(mine.base, "es");
    if (old) {
      const was = await editor(old.base, "es");
      check(JSON.stringify(es.fail) === JSON.stringify(was.fail), "la reproducción que falla dice lo mismo, paso a paso: " + es.fail.join(" ‖ "));
      check(JSON.stringify(es.ok) === JSON.stringify(was.ok), "la reproducción que sale bien, igual");
      check(es.err === was.err && es.errOpen === was.errOpen, "el error de arranque, igual: «" + es.err + "»");
      check(es.before === was.before && es.after === was.after, "el documento, igual antes y después de reproducir");
      check(es.px === was.px, "la hoja de Historias, píxel a píxel igual a 326872e al terminar la reproducción (" + es.px + ")");
    } else info("sin FLUYO_BASE_ROOT: la comparación con 326872e se salta");
    check(es.fail.some((s) => s.includes("No se completó · Banco no está disponible")) && es.fail.some((s) => s.includes("Reproducción terminada") && s.includes("1 evento no pudo realizarse")), "español: «No se completó · Banco no está disponible» y «Reproducción terminada · 1 evento no pudo realizarse»");
    check(es.before === es.after, "reproducir no cambia el documento");
    check(es.err.includes("Un evento apunta a una conexión que ya no existe."), "español: el error de arranque");
    check(es.errors.length === 0, "sin errores de consola " + es.errors.join(" | "));

    console.log("\nEDITOR · inglés");
    const en = await editor(mine.base, "en");
    check(en.fail.some((s) => s.includes("Not completed · Banco is unavailable")), "«Not completed · Banco is unavailable»: el nombre del autor, tal cual");
    check(en.fail.some((s) => s.includes("Banco is unavailable")), "«Banco is unavailable» (consecuencia de caída)");
    check(en.fail.some((s) => /Playback finished/.test(s) && /1 step couldn't run/.test(s)), "«Playback finished · 1 step couldn't run»: step, no evento");
    check(en.ok.some((s) => /Playback finished/.test(s)) && !en.ok.some((s) => /couldn't run/.test(s)), "una Historia que sale bien cierra sin aviso");
    check(en.err.includes("A step points to a connection that no longer exists."), "el error de arranque, en inglés: «" + en.err + "»");
    check(en.before === en.after, "reproducir no cambia el documento (en inglés tampoco)");
    const leak = [...en.fail, ...en.ok, en.err].map((s) => s.replace(/Compra con éxito|El banco no responde|Banco|Tienda online|Cliente|Pagos|Petición|Caída|Respuesta|El cliente pulsa «Pagar» \(49 €\)/g, "")).filter((s) => SPANISH.test(s));
    check(leak.length === 0, "sin restos de español en la reproducción ni en el error " + JSON.stringify(leak));
    check(en.errors.length === 0, "sin errores de consola " + en.errors.join(" | "));

    console.log("\nEDITOR · fr (cae al inglés, nunca al español)");
    const fr = await editor(mine.base, "fr");
    check(fr.fail.some((s) => /Playback finished/.test(s)) && fr.fail.some((s) => /Not completed · Banco is unavailable/.test(s)), "fr: la reproducción en inglés");

    console.log("\nNOMBRES · «+ New story», duplicar, en vivo");
    const nes = await names(mine.base, "es"), nen = await names(mine.base, "en");
    if (old) { const nwas = await names(old.base, "es"); check(JSON.stringify(nes.all) === JSON.stringify(nwas.all) && nes.doc1 === nwas.doc1, "español: nombres y documento IDÉNTICOS a 326872e " + JSON.stringify(nes.all)); }
    check(JSON.stringify(nes.created) === JSON.stringify(["Historia 1", "Historia 2"]) && JSON.stringify(nes.all) === JSON.stringify(["Historia 1", "Historia 1 copia 2", "Historia 1 copia", "Historia 2"]), "español: Historia 1, Historia 2; copias «Historia 1 copia», «Historia 1 copia 2» " + JSON.stringify(nes.all));
    check(JSON.stringify(nen.created) === JSON.stringify(["Story 1", "Story 2"]), "inglés: «+ New story» → «Story 1», «Story 2»");
    check(JSON.stringify(nen.all) === JSON.stringify(["Story 1", "Story 1 copy 2", "Story 1 copy", "Story 2"]), "inglés: duplicar → «Story 1 copy», «Story 1 copy 2» " + JSON.stringify(nen.all));
    check(nen.live && nes.live, "cambiar de idioma en vivo no toca el documento (los nombres son contenido)");
    check(nen.lastName === "Historia 5", "una Historia nueva tras volver al español nace «Historia 5» (el contador es del kernel; cada nombre nace en el idioma de ahora): " + nen.lastName);
    check(nes.errors.length + nen.errors.length === 0, "sin errores de consola " + [...nes.errors, ...nen.errors].join(" | "));

    console.log("\nPRESENT");
    const pes = await present(mine.base, "es"), pen = await present(mine.base, "en");
    if (old) { const pwas = await present(old.base, "es"); check(JSON.stringify(pes.seq) === JSON.stringify(pwas.seq) && pes.probe === pwas.probe, "español idéntico a 326872e (banda y alto del encabezado " + pes.probe + ")"); }
    check(pes.seq.some((s) => s.includes("Reproducción terminada|1 evento no pudo realizarse")), "español: «Reproducción terminada» + «1 evento no pudo realizarse»");
    check(pen.seq.some((s) => s.includes("Not completed · Banco is unavailable")) && pen.seq.some((s) => s.includes("Playback finished|1 step couldn't run")), "inglés: «Not completed · Banco is unavailable», «Playback finished» + «1 step couldn't run»");
    check(pen.probe === pes.probe || Math.abs(pen.probe - pes.probe) < 80, "la sonda de Present reserva el alto del cierre en inglés (" + pen.probe + " frente a " + pes.probe + ")");
    check(pes.errors.length + pen.errors.length === 0, "sin errores de consola " + [...pes.errors, ...pen.errors].join(" | "));

    console.log("\nVIEWER");
    const ves = await viewer(mine.base, "es"), ven = await viewer(mine.base, "en");
    if (old) { const vwas = await viewer(old.base, "es"); check(JSON.stringify(ves.seq) === JSON.stringify(vwas.seq), "español idéntico a 326872e: " + ves.seq.join(" ‖ ")); }
    check(ves.seq.some((s) => s.includes("Reproducción terminada|1 evento no pudo realizarse")), "español: cierre en el Viewer");
    check(ven.seq.some((s) => s.includes("Not completed · Banco is unavailable")) && ven.seq.some((s) => s.includes("Playback finished|1 step couldn't run")), "inglés: «Not completed · Banco is unavailable» y «Playback finished · 1 step couldn't run» en el Viewer: " + ven.seq.join(" ‖ "));
    check(ves.errors.length + ven.errors.length === 0, "sin errores de consola " + [...ves.errors, ...ven.errors].join(" | "));
  } catch (e) { failed++; console.log("  ✘ excepción: " + (e && e.stack || e)); }
  mine.server.close(); old && old.server.close();
  console.log(`\nFLUYO-I18N-002 S2b Chrome: ${passed} ✔ · ${failed} ✘`);
  process.exit(failed ? 1 : 0);
})();
