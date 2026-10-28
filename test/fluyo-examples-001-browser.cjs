"use strict";
/* FLUYO-EXAMPLES-001 — QA funcional en Chrome real (cdp-lite, sin dependencias). Uso: node test/fluyo-examples-001-browser.cjs
   Galería (3 ejemplos, 6 ▶) → Viewer de cada Historia, momento a momento, con su frase y el fallo real donde toca; una
   reproducción completa sin tocar nada; el botón «Ejemplo» y ?ejemplo= en español e inglés, sin tocar el documento que ya
   había; un slug retirado sigue cargando; el botón funciona sin red; ningún error de consola. */
const fs = require("node:fs"), path = require("node:path");
const { serve, launch } = require("./cdp-lite.cjs");
const root = path.join(__dirname, "..");
let ok = 0, ko = 0;
const check = (c, msg) => { c ? ok++ : ko++; console.log((c ? "  ✔ " : "  ✘ ") + msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const load = (slug, lang = "es") => JSON.parse(fs.readFileSync(path.join(root, "ejemplos", "data", lang === "es" ? "" : lang, slug + ".fluyo.json"), "utf8"));
async function open(srv) {
  const b = await launch(), errors = [];
  b.on((d) => {
    if (d.method === "Runtime.exceptionThrown") errors.push(d.params.exceptionDetails.exception ? d.params.exceptionDetails.exception.description : d.params.exceptionDetails.text);
    if (d.method === "Runtime.consoleAPICalled" && d.params.type === "error") errors.push(d.params.args.map((a) => a.value || a.description).join(" "));
  });
  b.errors = errors;
  return b;
}
const USER_DOC = { version: 5, app: "fluyo", doc: { theme: "dark", customBg: "", cur: 0, nextEventTypeId: 2,
  eventTypes: [{ id: 1, name: "Mío", primitive: "FLOW", sentenceTemplate: "{source} → {target}", visual: { kind: "token", value: "●" }, motion: "normal" }],
  pages: [{ name: "Lo mío", nextId: 4, behaviors: [], nextScenarioId: 2,
    nodes: [{ id: 1, shape: "rect", x: 200, y: 200, w: 160, h: 60, label: "A", color: "#6a9fb5", fill: null, border: "solid", lblPos: "center", textBg: null, font: null, bold: false, pulse: false, order: 1 },
      { id: 2, shape: "rect", x: 500, y: 200, w: 160, h: 60, label: "B", color: "#6a9fb5", fill: null, border: "solid", lblPos: "center", textBg: null, font: null, bold: false, pulse: false, order: 2 }],
    edges: [{ id: 3, from: 1, to: 2, route: "straight", fromSide: null, toSide: null, waypoints: [], label: "", font: null, bold: false, endArrow: true, startArrow: false, flowDir: "normal" }],
    scenarios: [{ id: 1, engineVersion: 2, name: "Mi historia", nextStepId: 2, steps: [{ id: 1, at: 0, action: "SEND", edgeId: 3, eventTypeId: 1, message: "Mi frase" }] }] }] },
  settings: { speed: 0.5, dots: 3, build: false, stagger: 0.45, grid: false, snap: false, font: "Georgia, serif", single: false } };

(async () => {
  const srv = await serve(root);
  try {
    console.log("\nGALERÍA");
    let links;
    { const b = await open(srv);
      try {
        await b.goto(srv.base + "/ejemplos/");
        const g = await b.ev(`({ cards: [...document.querySelectorAll(".gallery .card")].map(c => ({ title: c.querySelector("h2").textContent, learn: !!c.querySelector(".learn"),
          stories: [...c.querySelectorAll(".stories a")].map(a => ({ text: a.querySelector(".name").textContent, href: a.getAttribute("href") })), img: c.querySelector("img").naturalWidth })) })`);
        check(g.cards.length === 3, "3 ejemplos: " + g.cards.map((c) => c.title).join(" · "));
        check(g.cards.every((c) => c.stories.length === 2 && c.learn), "cada uno con «Aprenderás» y 2 Historias");
        await sleep(300);
        const imgs = await b.ev(`[...document.querySelectorAll(".gallery img")].map(i => i.naturalWidth)`);
        check(imgs.every((w) => w > 0), "las 3 vistas previas cargan");
        links = g.cards.flatMap((c) => c.stories.map((s) => ({ card: c.title, story: s.text, href: s.href })));
        await b.viewport(390, 844, true); await b.goto(srv.base + "/ejemplos/");
        const m = await b.ev(`({ first: document.querySelector(".stories a").getBoundingClientRect().bottom, h: innerHeight, scroll: document.documentElement.scrollWidth })`);
        check(m.scroll <= 390, "móvil 390: sin scroll horizontal (" + m.scroll + ")");
        check(m.first < m.h * 2, "móvil 390: el primer ▶ cerca de la primera pantalla (" + Math.round(m.first) + " / " + m.h + ")");
        check(!b.errors.length, "galería sin errores de consola " + b.errors.join(" | "));
      } finally { b.close(); } }

    console.log("\nVIEWER · cada Historia, momento a momento (es y con la interfaz en inglés)");
    for (const lang of ["es", "en"]) for (const l of links) {
      const b = await open(srv);
      try {
        const url = new URL(l.href, srv.base + "/ejemplos/").href.replace("/s/#", lang === "en" ? "/s/?lang=en#" : "/s/#");
        await b.goto(url, 900);
        const slug = { "Compra online": "compra-online", "Inicio de sesión (OAuth 2.0)": "inicio-de-sesion-oauth2", "Pedido asíncrono con cola": "pedido-asincrono-cola" }[l.card];
        const sc = load(slug).doc.pages[0].scenarios.find((s) => s.name === l.story);
        const name = await b.ev(`document.getElementById("stTitle").textContent + "|" + document.getElementById("story").hidden`);
        await b.ev(`document.getElementById("stPlay").click()`); await sleep(200);
        await b.ev(`document.getElementById("stPause").click()`); await sleep(150);
        const seen = [];
        for (let i = 0; i < 12; i++) {
          seen.push(await b.ev(`[document.getElementById("stTitle").textContent, document.getElementById("stCaption").textContent, document.getElementById("stProgress").textContent].join(" ¦ ")`));
          const more = await b.ev(`(() => { const n = document.getElementById("stNext"); if (n.hidden || n.disabled) return false; n.click(); return true; })()`);
          if (!more) break; await sleep(150);
        }
        const titles = seen.join("\n"), msgs = sc.steps.map((s) => s.message);
        const covered = msgs.filter((m) => titles.includes(m)).length;
        const fail = titles.includes(lang === "en" ? "Not completed" : "No se completó");
        const expectFail = /falla|banco/i.test(l.story);
        check(covered === msgs.length && fail === expectFail && !b.errors.length,
          `[${lang}] ${l.card} › ${l.story}: ${covered}/${msgs.length} frases vistas, fallo ${fail ? "sí" : "no"}${b.errors.length ? " · ERRORES " + b.errors.join(" | ") : ""}`);
        if (lang === "en" && fail) console.log("      " + seen.find((s) => s.includes("Not completed")));
      } finally { b.close(); }
    }

    console.log("\nVIEWER · una reproducción completa sin tocar nada");
    { const b = await open(srv);
      try {
        const l = links.find((x) => x.story === "Un pedido");
        await b.goto(new URL(l.href, srv.base + "/ejemplos/").href, 900);
        await b.ev(`document.getElementById("stPlay").click()`);
        let last = ""; for (let i = 0; i < 60; i++) { await sleep(250); last = await b.ev(`document.getElementById("stProgress").textContent + "|" + document.getElementById("stPlay").hidden`); if (/^\s*$|\|false$/.test(last) && i > 4) break; }
        const end = await b.ev(`({ play: !document.getElementById("stPlay").hidden, txt: document.getElementById("stPlay").textContent })`);
        check(end.play && !b.errors.length, "«Un pedido» se reproduce hasta el final y vuelve a ofrecer «" + end.txt.trim() + "»");
      } finally { b.close(); } }

    console.log("\nEDITOR · botón «Ejemplo» y ?ejemplo=");
    for (const lang of ["es", "en"]) {
      const b = await open(srv);
      try {
        await b.goto(srv.base + "/" + (lang === "en" ? "?lang=en" : ""), 900);
        await b.ev(`applyProjectData(${JSON.stringify(USER_DOC)}); scheduleAutosave(); true`);
        const before = await b.ev(`JSON.stringify({p: doc.pages[0], e: doc.eventTypes})`);
        await b.ev(`document.getElementById("btnDemo").click()`); await sleep(700);
        const r = await b.ev(`({ pages: doc.pages.map(p => p.name), cur: doc.cur, nodes: P().nodes.map(n => n.label), stories: P().scenarios.map(s => s.name), uiMode, active: scActiveScenario().name,
          mine: JSON.stringify({p: doc.pages[0], e: doc.eventTypes.slice(0, 1)}), ui: document.getElementById("tabScenarios").textContent.trim(), ets: doc.eventTypes.length })`);
        const ed = load("compra-online", lang).doc.pages[0];
        check(r.pages.length === 2 && r.cur === 1 && r.nodes.join() === ed.nodes.map((n) => n.label).join(), `[${lang}] «Ejemplo» crea la página «${r.pages[1]}» con la edición ${lang}: ${r.nodes.join(", ")}`);
        check(r.stories.join() === ed.scenarios.map((s) => s.name).join() && r.uiMode === "story" && r.active === ed.scenarios[0].name, `[${lang}] modo Historias con «${r.active}» seleccionada (${r.stories.join(" · ")})`);
        check(r.mine === before && r.ets === 4, `[${lang}] el documento que ya había no cambia (página y EventType propios intactos)`);
        await b.ev(`document.getElementById("btnDemo").click()`); await sleep(700);
        const again = await b.ev(`doc.pages.map(p => p.name).join(" · ")`);
        check(again.split(" · ").length === 3, `[${lang}] pulsarlo otra vez añade otra página: ${again}`);
        // Reproducir en el editor hasta el fallo
        await b.ev(`scSelectStory(P().scenarios[1].id); scRefreshIfVisible(); true`);
        await b.ev(`(document.querySelector("#scPlay, [data-sc-play], #btnScPlay") || [...document.querySelectorAll("#panelScenarios button")].find(x => /Reproducir|Play/.test(x.textContent))).click()`);
        await sleep(9000);
        const fail = await b.ev(`document.body.innerText.includes(${JSON.stringify(lang === "en" ? "Not completed" : "No se completó")})`);
        check(fail, `[${lang}] reproducida en el editor, «${ed.scenarios[1].name}» muestra el fallo real`);
        check(!b.errors.length, `[${lang}] editor sin errores de consola ${b.errors.join(" | ")}`);
      } finally { b.close(); }
    }
    for (const [slug, lang] of [["compra-online", "es"], ["pedido-asincrono-cola", "en"], ["inicio-de-sesion-oauth2", "es"], ["kafka-event-pipeline", "es"]]) {
      const b = await open(srv);
      try {
        await b.goto(srv.base + "/?ejemplo=" + slug + (lang === "en" ? "&lang=en" : ""), 1200);
        const r = await b.ev(`({ nodes: P().nodes.length, stories: (P().scenarios || []).map(s => s.name), uiMode, first: P().nodes.map(n => n.label)[0] })`);
        if (slug === "kafka-event-pipeline") check(r.nodes > 0 && r.uiMode === "edit", `?ejemplo=${slug} (retirado) sigue cargando su diagrama de siempre (${r.nodes} nodos)`);
        else {
          const ed = load(slug, lang).doc.pages[0];
          check(r.stories.join() === ed.scenarios.map((s) => s.name).join() && r.uiMode === "story" && r.first === ed.nodes[0].label,
            `?ejemplo=${slug} [${lang}]: edición ${lang} («${r.first}»), modo Historias, ${r.stories.join(" · ")}`);
        }
        check(!b.errors.length, `?ejemplo=${slug} sin errores de consola ${b.errors.join(" | ")}`);
      } finally { b.close(); }
    }

    console.log("\nSIN RED · el botón «Ejemplo» sale de la caché del service worker");
    { const b = await open(srv);
      try {
        await b.goto(srv.base + "/", 900);
        await b.ev(`navigator.serviceWorker.ready.then(() => true)`);
        for (let i = 0; i < 40; i++) { if (await b.ev(`caches.keys().then(async k => k.length && !!(await caches.match("./ejemplos/data/compra-online.fluyo.json")))`)) break; await sleep(250); }
        await b.goto(srv.base + "/", 900);
        srv.setOffline(true);
        await b.goto(srv.base + "/", 900);
        await b.ev(`document.getElementById("btnDemo").click()`); await sleep(800);
        const r = await b.ev(`({ stories: P().scenarios.length, cache: document.documentElement.dataset && 1 })`);
        check(r.stories === 2, "sin red: «Ejemplo» carga «Compra online» con sus 2 Historias");
      } finally { srv.setOffline(false); b.close(); } }
  } finally { srv.server.close(); }
  console.log(`\n${ok} ✔ · ${ko} ✘`);
  process.exit(ko ? 1 : 0);
})();
