"use strict";
/* FLUYO-SHELL-001 — Chrome REAL sobre este árbol de trabajo.
   A) Cada página pública (8 + 404) a 1440×900, 375×812 con dedo y 320×640: papel, Plex Mono y Playfair cargadas, cabecera en UNA fila
      de 50 px, 0 scroll horizontal, objetivos de 44 px con el dedo, marca «fluyo» sin hueco, 0 errores de consola.
   B) Navegación: cabecera (Ejemplos ↔ Docs, marca y «Abrir Fluyo» → editor) y pie (legales ↔ hermana en inglés).
   C) 404: el servidor responde 404.html con estado 404 en cualquier ruta (como el hosting); en inglés con la preferencia guardada.
   D) Ejemplos sigue funcionando: «Abrir en el editor» carga el ejemplo en el editor.
   E) Service worker: el editor instala fluyo-static-v109, precachea las páginas y, sin red, /docs/ se abre con el shell.
   F) Comparación con el editor y el Viewer: misma cabecera (alto, filete, fondo) y misma marca (voz, cuerpo, colores).
   Capturas en FLUYO_SHOTS (o un directorio temporal). Uso: node test/fluyo-shell-001-browser.cjs (playwright-core vía NODE_PATH). */
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("playwright-core")); }
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http");
const root = path.resolve(__dirname, "..");
const shots = process.env.FLUYO_SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-shell-001-"));
const mime = { ".html": "text/html; charset=utf-8", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2" };
let offline = false;
const serve = async (dir) => {
  const server = http.createServer((req, res) => {
    if (offline) { req.socket.destroy(); return; }
    let rel = new URL("http://x" + req.url).pathname; if (rel.endsWith("/")) rel += "index.html";
    const file = path.resolve(dir, "." + decodeURIComponent(rel));
    if (file.startsWith(dir + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile()) {
      res.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" }); res.end(fs.readFileSync(file)); return;
    }
    /* Como el hosting: cualquier ruta inexistente responde /404.html con estado 404. */
    res.writeHead(404, { "Content-Type": mime[".html"], "Cache-Control": "no-store" }); res.end(fs.readFileSync(path.join(dir, "404.html")));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { server, base: "http://127.0.0.1:" + server.address().port };
};
const results = [];
const check = (ok, what) => { results.push([!!ok, what]); console.log(`${ok ? "  ✔" : "  ✘"} ${what}`); };
const PAGES = ["/ejemplos/", "/docs/", "/privacidad/", "/privacy/", "/terminos/", "/terms/", "/soporte/", "/support/", "/no-existe/a/b"];
const VIEWS = [
  { name: "1440", viewport: { width: 1440, height: 900 } },
  { name: "375-tactil", viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { name: "320", viewport: { width: 320, height: 640 } },
];

(async () => {
  const { server, base } = await serve(root);
  const browser = await chromium.launch({ channel: process.env.FLUYO_BROWSER || "chrome", headless: !process.env.HEADED });
  const errors = [];
  const ctxOf = async (opts = {}) => {
    const ctx = await browser.newContext({ serviceWorkers: "block", ...opts });
    await ctx.route((u) => u.hostname.endsWith("umami.is"), (r) => r.abort());
    return ctx;
  };
  const watch = (page, tag) => {
    /* El 404 lo pide la propia navegación; en «sw» la CDN de gif.js está bloqueada a propósito (ERR_FAILED), como en fluyo-018-10-browser.cjs. */
    page.on("console", (m) => {
      if (m.type() !== "error" || /404 \(Not Found\)/.test(m.text())) return;
      if (tag.startsWith("sw") && /net::ERR_FAILED|ERR_INTERNET_DISCONNECTED/.test(m.text())) return;
      errors.push(tag + ": " + m.text());
    });
    page.on("pageerror", (e) => errors.push(tag + ": " + String(e)));
    return page;
  };
  const measure = (page) => page.evaluate(() => {
    const cs = (el) => getComputedStyle(el), r = (el) => el.getBoundingClientRect();
    const head = document.querySelector(".siteHead"), bar = head.querySelector(".bar");
    const logo = head.querySelector(".logo"), b = logo.querySelector("b");
    const parts = [logo, ...head.querySelectorAll(".siteNav a"), head.querySelector(".siteOpen")];
    const tops = parts.map((e) => Math.round(r(e).top + r(e).height / 2));
    const fl = document.createRange(); fl.setStart(logo.firstChild, 0); fl.setEnd(logo.firstChild, 3);
    return {
      bg: cs(document.body).backgroundColor, font: cs(document.body).fontFamily.split(",")[0], h1: document.querySelector("h1") ? cs(document.querySelector("h1")).fontFamily.split(",")[0] : null,
      fonts: [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family + " " + f.weight).sort(),
      headH: Math.round(r(head).height), barH: Math.round(r(bar).height), oneRow: Math.max(...tops) - Math.min(...tops) <= 2,
      hscroll: document.documentElement.scrollWidth > innerWidth,
      gap: Math.round(r(b).left - fl.getBoundingClientRect().right), logoFont: cs(logo).fontFamily.split(",")[0], logoSize: cs(logo).fontSize, yo: cs(b).color, logoColor: cs(logo).color,
      nav: [...head.querySelectorAll(".siteNav a")].map((a) => Math.round(r(a).height)), open: [Math.round(r(head.querySelector(".siteOpen")).width), Math.round(r(head.querySelector(".siteOpen")).height)],
      foot: [...document.querySelectorAll(".siteFoot a")].map((a) => Math.round(r(a).height)),
      btns: [...document.querySelectorAll("main .btn")].map((a) => Math.round(r(a).height)),
      lang: document.documentElement.lang, title: document.title, h1text: document.querySelector("h1") && document.querySelector("h1").textContent,
      themeColor: document.querySelector('meta[name="theme-color"]').content, borderB: cs(head).borderBottomColor, headBg: cs(head).backgroundColor,
    };
  });
  try {
    console.log("\nA) páginas × vistas");
    for (const v of VIEWS) {
      const ctx = await ctxOf(v);
      for (const p of PAGES) {
        const page = watch(await ctx.newPage(), v.name + " " + p);
        const resp = await page.goto(base + p, { waitUntil: "load" });
        await page.evaluate(() => document.fonts.ready);
        const m = await measure(page);
        const tag = `${v.name} ${p}`;
        check(m.bg === "rgb(242, 237, 227)" && m.font === '"IBM Plex Mono"' && m.h1 === '"Playfair Display"', `${tag}: papel, Plex Mono y Playfair (${m.bg}, ${m.font}, ${m.h1})`);
        check(m.fonts.includes("IBM Plex Mono 400") && m.fonts.includes("Playfair Display 400"), `${tag}: fuentes cargadas (${m.fonts.join(", ")})`);
        check(m.oneRow && m.headH === 50 && !m.hscroll, `${tag}: cabecera en una fila de ${m.headH} px (filete incluido), sin scroll horizontal`);
        check(m.gap <= 1 && m.logoFont === '"Playfair Display"' && m.yo === "rgb(163, 58, 34)", `${tag}: marca «fluyo» sin hueco (${m.gap} px) y «yo» terracota`);
        if (v.hasTouch) check([...m.nav, m.open[1], ...m.foot, ...m.btns].every((h) => h >= 44) && m.open[0] >= 44, `${tag}: objetivos táctiles ≥ 44 px (nav ${m.nav}, abrir ${m.open}, pie min ${Math.min(...m.foot)}, botones ${[...new Set(m.btns)]})`);
        if (p.startsWith("/no-existe")) check(resp.status() === 404 && m.h1text === "Esta página no existe", `${tag}: 404 con el shell`);
        await page.screenshot({ path: path.join(shots, `${v.name}${p.replace(/\//g, "_")}.png`), fullPage: v.name !== "320" });
        await page.close();
      }
      await ctx.close();
    }

    console.log("\nB) navegación");
    {
      const ctx = await ctxOf({ viewport: { width: 1280, height: 800 } }), page = watch(await ctx.newPage(), "nav");
      await page.goto(base + "/privacidad/");
      const hop = async (sel, expect) => { await Promise.all([page.waitForLoadState("load"), page.click(sel)]); await page.waitForURL((u) => u.pathname === expect); return new URL(page.url()).pathname; };
      check(await hop('.siteNav a:text("Ejemplos")', "/ejemplos/") === "/ejemplos/", "cabecera: Privacidad → Ejemplos");
      check(await page.getAttribute('.siteNav a[aria-current="page"]', "href") === "./", "Ejemplos marcada en la cabecera");
      check(await hop('.siteNav a:text("Docs")', "/docs/") === "/docs/", "cabecera: Ejemplos → Docs");
      check(await hop('.siteFoot a:text("Términos")', "/terminos/") === "/terminos/", "pie: Docs → Términos");
      check(await hop('.siteFoot a:text("Soporte")', "/soporte/") === "/soporte/", "pie: Términos → Soporte");
      check(await hop(".siteLang", "/support/") === "/support/" && (await page.getAttribute("html", "lang")) === "en", "pie: Soporte → Support (en)");
      check(await hop('.siteFoot a:text("Privacy")', "/privacy/") === "/privacy/", "pie (en): Support → Privacy");
      check(await hop('.siteNav a:text("Examples")', "/ejemplos/") === "/ejemplos/", "cabecera (en): Privacy → Examples (ejemplos, en español hasta I18N-002)");
      check(await hop(".siteOpen", "/") === "/", "«Abrir Fluyo» → editor");
      await page.goto(base + "/terms/");
      check(await hop(".siteHead .logo", "/") === "/", "la marca → editor");
      await ctx.close();
    }

    console.log("\nC) 404 en inglés (preferencia guardada, decisión 260)");
    {
      const ctx = await ctxOf({ viewport: { width: 1280, height: 800 } }), page = watch(await ctx.newPage(), "404 en");
      await page.goto(base + "/docs/");
      await page.evaluate(() => localStorage.setItem("fluyo.ui.lang", "en"));
      const resp = await page.goto(base + "/no/existe");
      const m = await measure(page);
      check(resp.status() === 404 && m.lang === "en" && m.h1text === "This page doesn't exist" && m.title === "Page not found · Fluyo", `404 en inglés (${m.lang}, «${m.h1text}», «${m.title}»)`);
      check(await page.textContent(".siteOpen span") === "Open Fluyo" && await page.textContent('.siteNav a[href="/docs/"]') === "Docs", "cabecera del 404 en inglés");
      await page.screenshot({ path: path.join(shots, "404-en.png") });
      await ctx.close();
    }

    console.log("\nD) Ejemplos → editor");
    {
      const ctx = await ctxOf({ viewport: { width: 1440, height: 900 } }), page = watch(await ctx.newPage(), "ejemplo");
      await page.goto(base + "/ejemplos/");
      const href = await page.getAttribute(".card .actions a.btn", "href");
      await Promise.all([page.waitForURL((u) => u.pathname === "/"), page.click(".card .actions a.btn")]);
      await page.waitForFunction(() => typeof doc !== "undefined" && doc.pages.some((pg) => pg.nodes.length >= 5), null, { timeout: 15000 });
      const n = await page.evaluate(() => doc.pages.map((pg) => pg.nodes.length));
      check(href === "../?ejemplo=funnel-de-ventas" && n.some((x) => x === 8), `«Abrir en el editor» (${href}) carga el ejemplo (nodos por página: ${n})`);
      const dl = await page.evaluate(async (b) => (await fetch(b + "/ejemplos/data/funnel-de-ventas.fluyo.json")).ok, base);
      check(dl, "«Descargar JSON» sigue sirviendo el archivo");
      await ctx.close();
    }

    console.log("\nE) service worker v108");
    {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      await ctx.route((u) => u.hostname.endsWith("umami.is") || u.hostname.endsWith("cloudflare.com"), (r) => r.abort());
      const page = watch(await ctx.newPage(), "sw");
      await page.goto(base + "/");
      await page.evaluate(async () => { await navigator.serviceWorker.ready; });
      /* waitForFunction no espera a un predicado async: sondeo explícito, como fluyo-018-10-browser.cjs */
      for (const t0 = Date.now(); Date.now() - t0 < 30000; await page.waitForTimeout(200))
        if (await page.evaluate(async () => { const c = await caches.open("fluyo-static-v109"); return !!(await c.match("./docs/")) && !!(await c.match("./css/pages.css")) && !!navigator.serviceWorker.controller; })) break;
      check(JSON.stringify(await page.evaluate(() => caches.keys())) === '["fluyo-static-v109"]', "el editor instala fluyo-static-v109 con las páginas");
      offline = true; await ctx.setOffline(true);
      const doc = watch(await ctx.newPage(), "sw offline");
      await doc.goto(base + "/docs/");
      const m = await measure(doc);
      check(m.bg === "rgb(242, 237, 227)" && m.font === '"IBM Plex Mono"' && m.headH === 50, "sin red, /docs/ se abre con el shell (hojas y fuentes desde la caché)");
      offline = false; await ctx.close();
    }

    console.log("\nF) comparación con el editor y el Viewer");
    {
      const ctx = await ctxOf({ viewport: { width: 1440, height: 900 } }), page = watch(await ctx.newPage(), "cmp");
      const hdr = (sel, logo) => page.evaluate(([sel, logo]) => {
        const h = document.querySelector(sel), l = document.querySelector(logo), cs = getComputedStyle(h), cl = getComputedStyle(l);
        return { h: Math.round(h.getBoundingClientRect().height), bg: cs.backgroundColor, rule: cs.borderBottomColor, font: cl.fontFamily.split(",")[0], size: cl.fontSize, ink: cl.color, yo: getComputedStyle(l.querySelector("b")).color };
      }, [sel, logo]);
      await page.goto(base + "/"); await page.evaluate(() => document.fonts.ready);
      const ed = await hdr("body > header", "body > header .logo");
      await page.screenshot({ path: path.join(shots, "cmp-editor.png"), clip: { x: 0, y: 0, width: 1440, height: 120 } });
      await page.goto(base + "/s/#d=roto"); await page.evaluate(() => document.fonts.ready);
      const vw = await hdr("#chrome", "#chrome .logo");
      await page.screenshot({ path: path.join(shots, "cmp-viewer.png"), clip: { x: 0, y: 0, width: 1440, height: 120 } });
      await page.goto(base + "/ejemplos/"); await page.evaluate(() => document.fonts.ready);
      const pg = await hdr(".siteHead", ".siteHead .logo");
      await page.screenshot({ path: path.join(shots, "cmp-ejemplos.png"), clip: { x: 0, y: 0, width: 1440, height: 120 } });
      console.log("    editor", JSON.stringify(ed), "\n    viewer", JSON.stringify(vw), "\n    páginas", JSON.stringify(pg));
      const same = (a, b) => a.bg === b.bg && a.rule === b.rule && a.font === b.font && a.size === b.size && a.ink === b.ink && a.yo === b.yo;
      check(same(pg, ed) && same(pg, vw), "fondo, filete y marca (voz, cuerpo, tinta, terracota) iguales a editor y Viewer");
      check(pg.h === ed.h && pg.h === vw.h, `alto de cabecera: páginas ${pg.h} · editor ${ed.h} · Viewer ${vw.h}`);
      await ctx.close();
    }
    check(errors.length === 0, "0 errores de consola/página" + (errors.length ? ": " + errors.slice(0, 5).join(" | ") : ""));
  } finally {
    await browser.close(); server.close();
  }
  const bad = results.filter((r) => !r[0]);
  console.log(`\n${results.length - bad.length} ✔ / ${bad.length} ✘ · capturas en ${shots}`);
  process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
