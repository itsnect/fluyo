"use strict";
/* FLUYO-GROWTH-FOUNDATION-001 — QA en Chrome real (cdp-lite, sin dependencias). Uso: node test/fluyo-growth-foundation-001-browser.cjs
   Para que la telemetría se active de verdad, Chrome resuelve fluyo.space al servidor local (--host-resolver-rules) y el script de
   Umami se sustituye (Fetch) por uno falso que aplica el beforeSend de la página y guarda lo que SALDRÍA en window.__sent. Así se
   comprueba el payload ya saneado, no la llamada a trackEvent.
   Recorre: usuario nuevo (Explorar / En blanco / Escape / tocar el lienzo), recurrente, ?ejemplo=, #d= del editor, /s/ (Viewer con
   Historia, de principio a fin), es y en, 390 × 844 táctil, Present, Share y la creación de Historias. Sin errores de consola. */
const path = require("node:path"), fs = require("node:fs"), os = require("node:os");
const { serve, launch } = require("./cdp-lite.cjs");
const root = path.join(__dirname, "..");
const SHOTS = process.env.FLUYO_SHOTS || "";
let ok = 0, ko = 0;
const check = (c, msg) => { c ? ok++ : ko++; console.log((c ? "  ✔ " : "  ✘ ") + msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const FAKE_UMAMI = `(function(){var cs=document.currentScript,bs=window[cs.dataset.beforeSend];window.__sent=window.__sent||[];
window.umami={track:function(n,d){var payload={website:cs.dataset.websiteId,hostname:location.hostname,url:location.pathname+location.search+location.hash,
title:document.title,referrer:document.referrer||"https://referrer.example/",language:navigator.language,screen:"1x1",name:n,data:d};
var p=bs?bs("event",payload):payload;if(p)window.__sent.push(p);return Promise.resolve();}};})();`;

async function open(port, { mobile = false } = {}) {
  const b = await launch(["--host-resolver-rules=MAP fluyo.space 127.0.0.1:" + port, "--disable-features=HttpsUpgrades"]), errors = [];
  b.on((d) => {
    if (d.method === "Runtime.exceptionThrown") errors.push(d.params.exceptionDetails.exception ? d.params.exceptionDetails.exception.description : d.params.exceptionDetails.text);
    if (d.method === "Runtime.consoleAPICalled" && d.params.type === "error") errors.push(d.params.args.map((a) => a.value || a.description).join(" "));
    if (d.method === "Fetch.requestPaused") b.send("Fetch.fulfillRequest", { requestId: d.params.requestId, responseCode: 200,
      responseHeaders: [{ name: "Content-Type", value: "application/javascript" }], body: Buffer.from(FAKE_UMAMI).toString("base64") }).catch(() => {});
  });
  await b.send("Fetch.enable", { patterns: [{ urlPattern: "*cloud.umami.is*" }] });
  if (mobile) await b.viewport(390, 844, true);
  b.errors = errors;
  b.sent = () => b.ev("JSON.stringify(window.__sent||[])").then(JSON.parse);
  b.names = async () => (await b.sent()).map((p) => p.name);
  b.find = async (name) => (await b.sent()).filter((p) => p.name === name).map((p) => p.data || {});
  return b;
}
const BASE = "http://fluyo.space";
const card = (b) => b.ev(`(() => { const c = document.getElementById("entryCard"); if (!c || c.hidden) return null; const r = c.getBoundingClientRect();
  return { title: document.getElementById("entryTitle").textContent, explore: document.querySelector("#entryExplore .entryLbl").textContent,
  blank: document.querySelector("#entryBlank .entryLbl").textContent, x: r.left, y: r.top, w: r.width, h: r.height, vw: innerWidth, vh: innerHeight,
  hScroll: document.documentElement.scrollWidth > innerWidth }; })()`);
const waitFor = async (b, expr, ms = 30000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await b.ev(expr).catch(() => false)) return true; await sleep(150); } return false; };
const PRIVATE = /Compra|Tienda|Pagos|Almac|Banco|Cliente|Online checkout|Online store|Payments|Warehouse|Customer|#d=|ejemplo=|lang=|referrer\.example/;
async function privacyCheck(b, label) {
  const sent = await b.sent();
  const keysOk = sent.every((p) => Object.keys(p).every((k) => ["website", "hostname", "url", "title", "referrer", "name", "data"].includes(k)));
  const fixed = sent.every((p) => p.url === "/" && p.title === "Fluyo" && p.referrer === "");
  const leaks = sent.filter((p) => PRIVATE.test(JSON.stringify(p)));
  check(sent.length > 0 && keysOk && fixed && !leaks.length, `${label}: ${sent.length} eventos salientes, payload fijo y sin contenido (${leaks.length ? "FUGA " + JSON.stringify(leaks) : "ok"})`);
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

(async () => {
  const srv = await serve(root);
  const port = Number(new URL(srv.base).port);
  try {
    console.log("\nNUEVO · escritorio · Explorar");
    { const b = await open(port);
      try {
        await b.goto(BASE + "/", 900);
        const c = await card(b);
        check(!!c && c.title === "Explica tu sistema, no solo lo dibujes." && c.explore === "Ver un sistema en marcha" && c.blank === "Empezar en blanco", "la tarjeta aparece con sus dos salidas: " + (c && c.explore + " / " + c.blank));
        check(!!c && c.x > 0 && c.y > 0 && c.x + c.w < c.vw && c.y + c.h < c.vh, "la tarjeta cabe en el lienzo");
        check(await b.ev(`entryVisible() && P().nodes.length === 0 && document.getElementById("autosaveModal").style.display !== "flex"`), "lienzo vacío, sin modal de sesión");
        check(eq(await b.find("editor_opened"), [{ entry: "direct", returning: "no", locale: "es" }]), "editor_opened {entry:direct, returning:no, locale:es}");
        check(await b.ev(`localStorage.getItem("fluyo.seen")`) === null, "fluyo.seen aún no se escribe mientras la tarjeta espera");
        if (SHOTS) await b.shot(path.join(SHOTS, "g01-entry-desktop-es.png"));
        await b.ev(`document.getElementById("entryExplore").click()`);
        const playing = await waitFor(b, `scStatus === "running"`, 8000);
        check(playing, "Explorar: el ejemplo se abre y su primera Historia se reproduce sola");
        const opened = await b.ev(`({ hidden: document.getElementById("entryCard").hidden, page: P().name, story: scActiveScenario() && scActiveScenario().name, pages: doc.pages.length })`);
        check(opened.hidden && opened.page === "Compra online" && opened.story === "Compra con éxito" && opened.pages === 1, "el ejemplo sustituye al lienzo vacío: " + JSON.stringify(opened));
        await sleep(1500);
        if (SHOTS) await b.shot(path.join(SHOTS, "g02-explore-playing-desktop.png"));
        check(eq(await b.find("entry_chosen"), [{ choice: "explore" }]), "entry_chosen {explore}");
        check(eq(await b.find("example_loaded"), [{ example: "compra-online", source: "entry" }]), "example_loaded {compra-online, entry}");
        check(eq(await b.find("story_started"), [{ surface: "editor", trigger: "entry" }]), "story_started {editor, entry}");
        check(await b.ev(`localStorage.getItem("fluyo.seen")`) === "1", "fluyo.seen = 1 al elegir");
        check(!(await b.find("first_edit_completed")).length && !(await b.find("diagram_created")).length && (await b.ev(`localStorage.getItem("fluyo.autosave.v1")`)) === null,
          "abrir el ejemplo no cuenta como edición ni deja sesión guardada");
        const done = await waitFor(b, `scStatus === "completed"`, 45000);
        await sleep(400);
        check(done && eq(await b.find("story_completed"), [{ surface: "editor" }]), "al terminar: story_completed {editor}, una vez");
        await b.ev(`scPrevMoment()`); await sleep(300); await b.ev(`scTogglePause && scIsPaused() && scTogglePause()`); await waitFor(b, `scStatus === "completed"`, 20000); await sleep(300);
        check((await b.find("story_completed")).length === 1, "saltar atrás y volver a terminar no cuenta otra vez");
        /* Reproducir otra vez con el botón: una ejecución nueva, iniciada por la persona */
        await b.ev(`scReset()`); await b.ev(`scRun()`); await sleep(300);
        check(eq((await b.find("story_started"))[1], { surface: "editor", trigger: "user" }), "Reproducir de nuevo: story_started {editor, user}");
        await b.ev(`scReset()`);
        /* Share: Historia con sus otras formas, después solo el diagrama */
        await b.ev(`document.getElementById("btnShare").click()`); await sleep(200);
        await b.ev(`document.getElementById("shareCreate").click()`); await waitFor(b, `!document.getElementById("shareResult").hidden`, 5000);
        await b.ev(`document.getElementById("shareClose").click()`); await sleep(150);
        await b.ev(`document.getElementById("btnShare").click()`); await sleep(200);
        await b.ev(`document.getElementById("shareOthers").click()`);
        await b.ev(`document.getElementById("shareCreate").click()`); await waitFor(b, `!document.getElementById("shareResult").hidden`, 5000);
        await b.ev(`document.getElementById("shareClose").click()`); await sleep(150);
        await b.ev(`document.getElementById("btnShare").click()`); await sleep(200);
        await b.ev(`document.getElementById("shareKindDiagram").click()`);
        await b.ev(`document.getElementById("shareCreate").click()`); await waitFor(b, `!document.getElementById("shareResult").hidden`, 5000);
        b.shareLink = await b.ev(`document.getElementById("shareLink").value`);
        await b.ev(`document.getElementById("shareClose").click()`); await sleep(150);
        check(eq(await b.find("share_created"), [{ kind: "story", variants: "yes" }, { kind: "story", variants: "no" }, { kind: "diagram", variants: "no" }]),
          "share_created: {story, yes} · {story, no} · {diagram, no}");
        /* Creación de Historias por sus puertas: nueva, copia y variante */
        await b.ev(`scNewScenario()`); await sleep(100); await b.ev(`document.activeElement && document.activeElement.blur()`);
        await b.ev(`scSelectStory(P().scenarios[0].id); scDuplicateScenario()`); await sleep(100); await b.ev(`document.activeElement && document.activeElement.blur()`);
        await b.ev(`scSelectStory(P().scenarios[0].id); scBranchFrom(P().scenarios[0].steps[0].id)`); await sleep(100); await b.ev(`document.activeElement && document.activeElement.blur()`);
        await b.ev(`scSelectStory(P().scenarios[0].id); scDuplicateAsFailure(document.getElementById("scScenarioTitle"))`); await sleep(150);
        await b.ev(`document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}))`); await sleep(100);
        check(eq(await b.find("story_created"), [{ origin: "new" }, { origin: "copy" }, { origin: "variant" }, { origin: "variant" }]), "story_created: new · copy · variant («Otra forma») · variant («Duplicar como fallo»)");
        /* Present: reproducir allí es surface present */
        await b.ev(`scSelectStory(P().scenarios[0].id)`);
        await b.ev(`document.getElementById("btnPresent").click()`); await sleep(500);
        await b.ev(`presentPlay()`); await sleep(400);
        check(eq((await b.find("story_started")).slice(-1)[0], { surface: "present", trigger: "user" }) && (await b.find("present_started")).length === 1, "Present: present_started y story_started {present, user}");
        await b.ev(`typeof exitPresent === "function" ? exitPresent() : document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape"}))`); await sleep(300);
        await privacyCheck(b, "editor");
        check(!b.errors.length, "sin errores de consola " + b.errors.join(" | "));
        /* Recurrente: recargar no vuelve a ofrecer la tarjeta */
        await b.ev(`window.__sent=[]`);
        await b.goto(BASE + "/", 900);
        check(!(await card(b)), "recargar: la tarjeta no vuelve");
        check(eq((await b.find("editor_opened"))[0], { entry: "direct", returning: "yes", locale: "es" }), "editor_opened {returning:yes}");
        /* El enlace de diagrama, abierto en el Viewer y en el editor (#d=) */
        b.hash = new URL(b.shareLink).hash;
      } finally { b.close(); }
      global.HASH = b.hash; }

    console.log("\nNUEVO · En blanco, Escape y tocar el lienzo");
    for (const how of ["blank", "escape", "canvas"]) {
      const b = await open(port);
      try {
        await b.goto(BASE + "/", 800);
        if (how === "blank") await b.ev(`document.getElementById("entryBlank").click()`);
        if (how === "escape") await b.ev(`document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}))`);
        if (how === "canvas") { const r = await b.ev(`(() => { const r = document.getElementById("wrap").getBoundingClientRect(); return [r.left + 40, r.top + 40]; })()`);
          await b.send("Input.dispatchMouseEvent", { type: "mousePressed", x: r[0], y: r[1], button: "left", clickCount: 1 }); await b.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: r[0], y: r[1], button: "left", clickCount: 1 }); }
        await sleep(200);
        const want = how === "blank" ? "blank" : "dismiss";
        check(!(await card(b)) && eq(await b.find("entry_chosen"), [{ choice: want }]) && (await b.ev(`localStorage.getItem("fluyo.seen")`)) === "1" && (await b.ev(`P().nodes.length`)) === 0,
          `${how}: la tarjeta se va, entry_chosen {${want}}, fluyo.seen = 1, el lienzo sigue vacío`);
        check(!(await b.find("example_loaded")).length && !(await b.find("story_started")).length, `${how}: no se carga ningún ejemplo ni se reproduce nada`);
      } finally { b.close(); }
    }

    console.log("\nRECURRENTE (claves de antes de esta versión)");
    for (const [k, v] of [["fluyo.ui.theme", "dark"], ["fluyo.autosave.v1", null]]) {
      const b = await open(port);
      try {
        await b.goto(BASE + "/?lang=es", 500);
        await b.ev(v === null ? `localStorage.setItem("fluyo.autosave.v1", JSON.stringify({version:5,app:"fluyo",doc:{theme:"dark",pages:[{name:"Mía",nodes:[{id:1,shape:"rect",x:0,y:0,w:100,h:50,label:"Secreto"}],edges:[]}]}}))` : `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(v)})`);
        await b.goto(BASE + "/", 900);
        const modal = await b.ev(`document.getElementById("autosaveModal").style.display`);
        check(!(await card(b)) && eq((await b.find("editor_opened"))[0].returning, "yes"), `${k}: sin tarjeta, returning:yes` + (v === null ? ` (modal de sesión: ${modal})` : ""));
      } finally { b.close(); }
    }

    console.log("\nENLACES PROFUNDOS (navegador nuevo): nunca interceptados");
    { const b = await open(port);
      try {
        await b.goto(BASE + "/?ejemplo=inicio-de-sesion-oauth2", 1300);
        check(!(await card(b)) && eq(await b.find("editor_opened"), [{ entry: "example", returning: "no", locale: "es" }]) && eq(await b.find("example_loaded"), [{ example: "inicio-de-sesion-oauth2", source: "url" }]),
          "?ejemplo=: sin tarjeta · editor_opened {example} · example_loaded {url}");
        check(!(await b.find("story_started")).length, "?ejemplo=: no se reproduce solo (comportamiento de siempre)");
        check((await b.ev(`localStorage.getItem("fluyo.seen")`)) === "1", "?ejemplo=: el navegador queda visto");
      } finally { b.close(); } }
    { const b = await open(port);
      try {
        await b.goto(BASE + "/?ejemplo=no-existe", 900);
        check(!(await card(b)), "?ejemplo= desconocido: tampoco hay tarjeta");
      } finally { b.close(); } }
    { const b = await open(port);
      try {
        await b.goto(BASE + "/" + global.HASH, 1300);
        check(!(await card(b)) && eq(await b.find("editor_opened"), [{ entry: "link", returning: "no", locale: "es" }]) && (await b.ev(`P().nodes.length`)) > 0,
          "#d= en el editor: sin tarjeta · editor_opened {link} · el diagrama abierto");
        check(eq(await b.find("file_imported"), [{ source: "link", format: "fluyo_json" }]), "#d=: file_imported {link} como siempre");
      } finally { b.close(); } }

    console.log("\nVIEWER /s/ (Historia de principio a fin, es y en)");
    for (const lang of ["es", "en"]) {
      const b = await open(port);
      try {
        await b.goto(BASE + "/ejemplos/", 500);
        const href = await b.ev(`document.querySelector(".stories a").getAttribute("href")`);
        const url = new URL(href, BASE + "/ejemplos/").href.replace("/s/#", lang === "en" ? "/s/?lang=en#" : "/s/#");
        await b.goto(url, 1200);
        check(eq(await b.find("share_viewed"), [{ story: "yes", locale: lang }]) && !(await b.ev(`!!document.getElementById("entryCard")`)), `[${lang}] share_viewed {story:yes, locale:${lang}}, sin tarjeta`);
        await b.ev(`document.getElementById("stPlay").click()`);
        const end = await waitFor(b, `(window.__sent || []).some((p) => p.name === "viewer_story_completed")`, 60000);
        await sleep(500);
        check(eq(await b.find("viewer_story_started"), [{}]) && eq(await b.find("viewer_story_completed"), [{}]), `[${lang}] viewer_story_started y viewer_story_completed, una vez cada uno (fin: ${end})`);
        check((await b.ev(`localStorage.getItem("fluyo.seen")`)) === null, `[${lang}] el Viewer no marca el navegador como visto`);
        await privacyCheck(b, `[${lang}] viewer`);
        check(!b.errors.length, `[${lang}] viewer sin errores de consola ` + b.errors.join(" | "));
      } finally { b.close(); }
    }
    { const b = await open(port);
      try {
        await b.goto(BASE + "/s/" + global.HASH, 1200);
        check(eq(await b.find("share_viewed"), [{ story: "no", locale: "es" }]), "enlace de diagrama: share_viewed {story:no}");
      } finally { b.close(); } }

    console.log("\nINGLÉS · escritorio");
    { const b = await open(port);
      try {
        await b.goto(BASE + "/?lang=en", 900);
        const c = await card(b);
        check(!!c && c.title === "Explain your system, not just draw it." && c.explore === "See a system in motion" && c.blank === "Start blank", "tarjeta en inglés: " + (c && c.title));
        check(eq(await b.find("editor_opened"), [{ entry: "direct", returning: "no", locale: "en" }]), "editor_opened {locale:en}");
        if (SHOTS) await b.shot(path.join(SHOTS, "g03-entry-desktop-en.png"));
        await b.ev(`document.getElementById("entryExplore").click()`);
        await waitFor(b, `scStatus === "running"`, 8000);
        check(await b.ev(`P().name !== "Compra online" && /checkout/i.test(P().name)`), "Explorar abre la edición inglesa del ejemplo: " + await b.ev(`P().name`));
        await privacyCheck(b, "editor en");
        check(!b.errors.length, "sin errores de consola " + b.errors.join(" | "));
      } finally { b.close(); } }

    console.log("\nMÓVIL 390 × 844 táctil");
    for (const lang of ["es", "en"]) {
      const b = await open(port, { mobile: true });
      try {
        await b.goto(BASE + "/" + (lang === "en" ? "?lang=en" : ""), 900);
        const c = await card(b);
        check(!!c && c.x >= 16 && c.x + c.w <= c.vw - 16 && c.y >= 0 && c.y + c.h <= c.vh && !c.hScroll, `[${lang}] la tarjeta cabe con 16 px de margen y sin scroll horizontal (${c && Math.round(c.w) + "×" + Math.round(c.h)})`);
        const tgt = await b.ev(`[...document.querySelectorAll("#entryCard button")].map(x => Math.round(x.getBoundingClientRect().height))`);
        check(tgt.every((h) => h >= 44), `[${lang}] objetivos táctiles ≥ 44 px (${tgt.join(", ")})`);
        if (SHOTS) await b.shot(path.join(SHOTS, `g04-entry-mobile-${lang}.png`));
        const r = await b.ev(`(() => { const r = document.getElementById("entryExplore").getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
        await b.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: r[0], y: r[1] }] });
        await b.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        const playing = await waitFor(b, `scStatus === "running"`, 8000);
        await sleep(2500);
        if (SHOTS) await b.shot(path.join(SHOTS, `g05-explore-playing-mobile-${lang}.png`));
        check(playing && eq(await b.find("story_started"), [{ surface: "editor", trigger: "entry" }]), `[${lang}] tocar Explorar: la Historia se reproduce`);
        check(await b.ev(`(() => { const n = document.getElementById("scNow"); return !!n && !n.hidden && n.getBoundingClientRect().width > 0; })()`), `[${lang}] el rótulo del momento se ve sobre el lienzo`);
        check(!b.errors.length, `[${lang}] sin errores de consola ` + b.errors.join(" | "));
      } finally { b.close(); }
    }

    console.log("\nMOVIMIENTO REDUCIDO (prefers-reduced-motion: reduce)");
    { const b = await open(port);
      try {
        await b.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
        await b.goto(BASE + "/", 900);
        await b.ev(`document.getElementById("entryExplore").click()`);
        const opened = await waitFor(b, `P().name === "Compra online" && !!scActiveScenario()`, 8000); await sleep(600);
        check(opened && (await b.ev(`scStatus`)) === "idle" && !(await b.find("story_started")).length, "Explorar abre el ejemplo en su Historia, lista para «Reproducir», sin arrancar sola");
        check(eq(await b.find("example_loaded"), [{ example: "compra-online", source: "entry" }]) && eq(await b.find("entry_chosen"), [{ choice: "explore" }]), "y lo cuenta igual: example_loaded {entry} · entry_chosen {explore}");
      } finally { b.close(); } }

    console.log("\nSIN ANALÍTICA FUERA DE fluyo.space (127.0.0.1)");
    { const b = await open(port);
      try {
        await b.goto(srv.base + "/", 900);
        check(!!(await card(b)), "la tarjeta también aparece en local (no depende de la analítica)");
        await b.ev(`document.getElementById("entryBlank").click()`);
        check(!(await b.ev(`!!window.umami || !!document.querySelector('script[src*="umami"]')`)), "local: ni script de Umami ni eventos");
      } finally { b.close(); } }
  } finally { srv.server.close(); }
  console.log(`\n${ok} ok · ${ko} fallos`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
