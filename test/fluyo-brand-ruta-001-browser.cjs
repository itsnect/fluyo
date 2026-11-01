"use strict";
/* FLUYO-BRAND-RUTA-001 — Chrome REAL: la marca Ruta en las cabeceras (decisión 325). Propiedades observables, no píxeles de diseño:
     A · estados: escritorio → bucle a la vista y seis animaciones de 4.8 s en bucle; «reducir movimiento», móvil (390, 375), el editor
         de 701–860 y el teléfono en apaisado → el símbolo fijo y CERO animaciones vivas (ni estilos recalculados en 2 s);
         en todos: 24 px a 8 px de la palabra (en móvil del editor y el Viewer, a escala de la palabra a 19 px), centrados, sin recorte,
         sin pisar el control siguiente y sin scroll horizontal;
     B · el fijo es svg/fluyo-simbolo.svg: el mismo dibujo pintado en un lienzo, píxel a píxel (en los colores de los tokens);
     C · el bucle: el último fotograma es el logo (origen vacío, conexión, destino lleno), el primero también; el envío pasa por el destino
         y descansa en (36,32), donde lo pinta el fijo;
     D · tokens: interfaz oscura del editor → tinta #EDE7DB y envío #DE8B71; las páginas y el Viewer siguen en claro;
     E · Service Worker: CACHE v123 guarda identity.css con la marca nueva y, sin red, el editor la pinta;
     F · favicon de las once páginas y tamaños pequeños (16, 24, 32 px): capturas para el gate del PO;
     H · cabecera del editor a 701, 720, 744, 760 y 768 px táctil (es/en, Editar/Historias): una fila, «Más» a la vista, nada fuera;
     G · 0 errores de consola.
   Uso: node test/fluyo-brand-ruta-001-browser.cjs   (Playwright vía NODE_PATH; FLUYO_BROWSER=chrome por defecto; FLUYO_SHOTS=<dir>) */
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("playwright-core")); }
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http");
const root = path.resolve(process.env.FLUYO_ROOT || path.join(__dirname, ".."));
const shots = process.env.FLUYO_SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-brand-ruta-"));
const mime = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".gif": "image/gif", ".woff2": "font/woff2" };
let offline = false;
const serve = async (dir) => {
  const server = http.createServer((req, res) => {
    try {
      if (offline) { req.socket.destroy(); return; }
      let rel = new URL("http://x" + req.url).pathname; if (rel.endsWith("/")) rel += "index.html";
      const file = path.resolve(dir, "." + decodeURIComponent(rel)); assert.ok(file.startsWith(path.resolve(dir) + path.sep));
      res.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" }); res.end(fs.readFileSync(file));
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { server, base: "http://127.0.0.1:" + server.address().port };
};
let failed = 0, passed = 0;
const check = (cond, msg) => { if (cond) { passed++; console.log("  ✔ " + msg); } else { failed++; console.log("  ✘ " + msg); } };

const SURFACES = [
  { name: "editor", url: "/", head: "body > header", logo: "body > header .logo" },
  { name: "Viewer", url: "/s/#d=roto", head: "#chrome", logo: "#chrome .logo" },
  { name: "ejemplos", url: "/ejemplos/", head: ".siteHead", logo: ".siteHead .logo" },
  { name: "docs", url: "/docs/", head: ".siteHead", logo: ".siteHead .logo" },
  { name: "legal", url: "/privacidad/", head: ".siteHead", logo: ".siteHead .logo" },
  { name: "404", url: "/404.html", head: ".siteHead", logo: ".siteHead .logo" },
];
/* live: ¿bucle?; word: cuerpo de la palabra por superficie (el editor y el Viewer bajan a 19 px en ≤ 700 px) */
const VIEWS = [
  { key: "d1440", vp: { width: 1440, height: 900 }, live: () => true, word: () => 21 },
  { key: "rm1440", vp: { width: 1440, height: 900 }, reduce: true, live: () => false, word: () => 21 },
  { key: "w800", vp: { width: 800, height: 900 }, live: (s) => s.name !== "editor", word: (s) => (s.name === "editor" ? 19 : 21) },
  { key: "t768", vp: { width: 768, height: 1024 }, touch: true, live: (s) => s.name !== "editor", word: (s) => (s.name === "editor" ? 19 : 21) },
  { key: "m390", vp: { width: 390, height: 844 }, touch: true, live: () => false, word: (s) => (s.name === "editor" || s.name === "Viewer" ? 19 : 21) },
  { key: "m375", vp: { width: 375, height: 667 }, touch: true, live: () => false, word: (s) => (s.name === "editor" || s.name === "Viewer" ? 19 : 21) },
  { key: "l844", vp: { width: 844, height: 390 }, touch: true, live: () => false, word: (s) => (s.name === "editor" ? 19 : 21) },   /* 844 px: el editor está en su franja 701–860 */
];

const state = (page, s) => page.evaluate(({ logo, head }) => {
  const l = document.querySelector(logo), m = l.querySelector(".logoMark"), w = l.querySelector(".logoWord"), h = document.querySelector(head);
  const r = (e) => e.getBoundingClientRect(), cs = (e) => getComputedStyle(e);
  const next = l.nextElementSibling && [...h.querySelectorAll(":scope > *, :scope .bar > *")].find((e) => e !== l && !l.contains(e) && !e.contains(l) && r(e).width > 0 && r(e).left >= r(l).left && cs(e).visibility !== "hidden");
  const mr = r(m), wr = r(w), hr = r(h), lr = r(l);
  return {
    still: cs(m.querySelector(".still")).display, loop: cs(m.querySelector(".loop")).display,
    live: document.getAnimations().filter((a) => a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest(".logoMark")).map((a) => [a.animationName, a.effect.getTiming().duration, a.effect.getTiming().iterations, a.playState]),
    size: [mr.width, mr.height], gap: +(wr.left - mr.right).toFixed(2), dy: +((mr.top + mr.height / 2) - (wr.top + wr.height / 2)).toFixed(2),
    word: cs(l).fontSize, wordFont: cs(w).fontFamily.split(",")[0], text: w.textContent, inHead: mr.top >= hr.top && mr.bottom <= hr.bottom && mr.left >= 0,
    clear: !next || r(next).left >= lr.right - 0.5, hscroll: document.documentElement.scrollWidth > innerWidth, ink: cs(l).color,
    send: cs(m.querySelector(cs(m.querySelector(".still")).display === "none" ? ".tok" : ".still circle")).fill, ariaHidden: m.getAttribute("aria-hidden"),
    name: l.getAttribute("aria-label") || l.textContent.trim(),
  };
}, s);
const recalcs = async (page) => {
  const c = await page.context().newCDPSession(page); await c.send("Performance.enable");
  const m = async () => Object.fromEntries((await c.send("Performance.getMetrics")).metrics.map((x) => [x.name, x.value]));
  const a = await m(); await page.waitForTimeout(2000); const z = await m(); await c.detach();
  return { style: z.RecalcStyleCount - a.RecalcStyleCount, ms: +(((z.RecalcStyleDuration - a.RecalcStyleDuration) + (z.LayoutDuration - a.LayoutDuration)) * 1000).toFixed(2) };
};

(async () => {
  const { server, base } = await serve(root);
  const browser = await chromium.launch({ channel: process.env.FLUYO_BROWSER || "chrome", headless: !process.env.HEADED });
  const errors = [];
  const watch = (page, tag) => { page.on("console", (m) => { if (m.type() === "error" && !(offline && /ERR_|Failed to load/.test(m.text()))) errors.push(tag + ": " + m.text()); }); page.on("pageerror", (e) => errors.push(tag + ": " + e)); return page; };
  try {
    console.log("\nA) estados por superficie y vista");
    for (const v of VIEWS) {
      const ctx = await browser.newContext({ viewport: v.vp, hasTouch: !!v.touch, isMobile: !!v.touch, reducedMotion: v.reduce ? "reduce" : "no-preference", serviceWorkers: "block" });
      for (const s of SURFACES) {
        const page = watch(await ctx.newPage(), v.key + " " + s.name);
        await page.goto(base + s.url); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(150);
        const m = await state(page, s), tag = `${v.key} ${s.name}`, live = v.live(s), k = v.word(s) / 21;
        if (live) check(m.loop !== "none" && m.still === "none" && m.live.length === 6 && m.live.every((a) => a[1] === 4800 && a[2] === Infinity && a[3] === "running"),
          `${tag}: bucle a la vista, 6 animaciones de 4.8 s en bucle`);
        else {
          const rc = await recalcs(page);
          check(m.still !== "none" && m.loop === "none" && m.live.length === 0 && rc.style === 0, `${tag}: símbolo fijo, 0 animaciones, ${rc.style} recálculos de estilo en 2 s`);
        }
        check(Math.abs(m.size[0] - 24 * k) < 0.1 && Math.abs(m.size[1] - 24 * k) < 0.1 && Math.abs(m.gap - 8 * k) < 0.1 && Math.abs(m.dy) <= 0.5 && m.word === v.word(s) + "px",
          `${tag}: ${m.size[0].toFixed(1)} px a ${m.gap} px de «fluyo» (${m.word}), centrados (Δ ${m.dy})`);
        check(m.inHead && m.clear && !m.hscroll && m.text === "fluyo" && m.wordFont === '"Playfair Display"' && m.ariaHidden === "true" && /fluyo/i.test(m.name),
          `${tag}: sin recorte ni choque, sin scroll horizontal; «fluyo» en Playfair; símbolo aria-hidden; nombre «${m.name}»`);
        check(m.ink === "rgb(22, 21, 15)" && m.send === "rgb(163, 58, 34)", `${tag}: tinta y envío terracota (${m.ink}, ${m.send})`);
        await page.locator(s.head).screenshot({ path: path.join(shots, `A-${v.key}-${s.name}.png`) });
        await page.close();
      }
      await ctx.close();
    }

    console.log("\nB) el fijo es svg/fluyo-simbolo.svg (mismo dibujo, píxel a píxel)");
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce", serviceWorkers: "block" }), page = watch(await ctx.newPage(), "B");
      await page.goto(base + "/docs/");
      const ref = fs.readFileSync(path.join(root, ".ai/referencias/logo-ruta/svg/fluyo-simbolo.svg"), "utf8");
      const r = await page.evaluate(async (ref) => {
        const m = document.querySelector(".siteHead .logoMark"), cs = getComputedStyle(document.querySelector(".siteHead .logo"));
        const ink = cs.color, send = getComputedStyle(m.querySelector(".still circle")).fill;
        const hex = (rgb) => "#" + rgb.match(/\d+/g).slice(0, 3).map((n) => (+n).toString(16).padStart(2, "0")).join("");
        const ours = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke-linecap="round" stroke-linejoin="round" color="${ink}">`
          + m.querySelector(".still").innerHTML.replace("<circle ", `<circle fill="${send}" `) + "</svg>";
        const img = (svg) => new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = "data:image/svg+xml," + encodeURIComponent(svg); });
        const px = async (svg) => { const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d"); g.drawImage(await img(svg), 0, 0, 256, 256); return g.getImageData(0, 0, 256, 256).data; };
        const a = await px(ours), b = await px(ref);
        let diff = 0, ink2 = 0; for (let i = 0; i < a.length; i += 4) { const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]), Math.abs(a[i + 3] - b[i + 3])); if (d > 8) diff++; if (b[i + 3] > 0) ink2++; }
        return { diff, ink2, colors: [hex(ink), hex(send)] };
      }, ref);
      check(r.colors[0] === "#16150f" && r.colors[1] === "#a33a22", `los tokens claros son los de la referencia (${r.colors})`);
      check(r.ink2 > 3000 && r.diff === 0, `a 256 px: ${r.diff} píxeles distintos de ${r.ink2} pintados`);
      await ctx.close();
    }

    console.log("\nC) el bucle (escritorio)");
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 4, serviceWorkers: "block" }), page = watch(await ctx.newPage(), "C");
      await page.goto(base + "/docs/");
      const at = (t) => page.evaluate((t) => {
        const m = document.querySelector(".siteHead .logoMark"), box = m.getBoundingClientRect(), k = 64 / box.width;
        document.getAnimations().forEach((a) => { a.pause(); a.currentTime = t; });
        const c = (sel) => { const e = m.querySelector(sel), r = e.getBoundingClientRect(), s = getComputedStyle(e); return { x: Math.round((r.left + r.width / 2 - box.left) * k), y: Math.round((r.top + r.height / 2 - box.top) * k), o: +s.opacity, f: +s.fillOpacity }; };
        return { tok: c(".tok"), old: c(".old"), n2: c(".n2"), n3: c(".n3") };
      }, t);
      const f0 = await at(0), fEnd = await at(4799.9), fArr = await at(0.185 * 4800);
      check(f0.old.o === 1 && f0.n2.x === 50 && f0.n2.y === 48 && f0.n2.f === 1 && f0.n3.o === 0, "fotograma 0: origen y conexión a la vista, destino lleno en (50,48), sin caja nueva");
      check(fEnd.old.o === 0 && fEnd.n2.x === 14 && fEnd.n2.y === 16 && fEnd.n2.f === 0 && fEnd.n3.o === 1 && fEnd.n3.x === 50 && fEnd.n3.y === 48, "último fotograma: el destino es ahora el origen (vacío) y la caja nueva el destino: el logo otra vez");
      check(f0.tok.x === 36 && f0.tok.y === 32 && fEnd.tok.x === 36 && fEnd.tok.y === 32 && f0.tok.o === 1 && fEnd.tok.o === 1, `el envío empieza y termina en (36,32), el círculo del fijo: sin salto al pasar al fijo (${f0.tok.x},${f0.tok.y} → ${fEnd.tok.x},${fEnd.tok.y})`);
      check(fArr.tok.x >= 41 && fArr.tok.y === 48, `el envío llega al destino (${fArr.tok.x},${fArr.tok.y})`);
      for (const t of [0, 900, 1100, 1700, 2300, 3200, 4000]) { await at(t); await page.locator(".siteHead .logo").screenshot({ path: path.join(shots, `C-frame-${String(t).padStart(4, "0")}.png`) }); }
      await ctx.close();
    }

    console.log("\nD) interfaz oscura del editor");
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block" }), page = watch(await ctx.newPage(), "D");
      await page.addInitScript(() => { try { localStorage.setItem("fluyo.ui.theme", "dark"); } catch (e) {} });
      await page.goto(base + "/");
      const d = await page.evaluate(() => ({ attr: document.documentElement.getAttribute("data-ui-theme"), ink: getComputedStyle(document.querySelector("body > header .logo")).color, send: getComputedStyle(document.querySelector("body > header .logoMark .tok")).fill, still: getComputedStyle(document.querySelector("body > header .logoMark .still circle")).fill }));
      check(d.attr === "dark" && d.ink === "rgb(237, 231, 219)" && d.send === "rgb(222, 139, 113)" && d.still === d.send, `oscuro: tinta #EDE7DB y envío #DE8B71 (${d.ink}, ${d.send})`);
      await page.locator("body > header").screenshot({ path: path.join(shots, "D-editor-oscuro.png") });
      await page.emulateMedia({ reducedMotion: "reduce" }); await page.locator("body > header").screenshot({ path: path.join(shots, "D-editor-oscuro-fijo.png") });
      await ctx.close();
    }

    console.log("\nE) Service Worker v123 y sin red");
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }), page = watch(await ctx.newPage(), "E");
      await page.goto(base + "/"); await page.evaluate(() => navigator.serviceWorker.ready);
      await page.waitForFunction(() => caches.has("fluyo-static-v123"), null, { timeout: 20000 });
      const c = await page.evaluate(async () => { const k = await caches.keys(), cc = await caches.open("fluyo-static-v123"); const css = await (await cc.match("./css/identity.css")).text(); return { k, mark: /logoMark-tok/.test(css) && !/\.dots/.test(css) }; });
      check(c.k.includes("fluyo-static-v123") && c.mark, `caché ${c.k.join(", ")} con identity.css de la marca Ruta`);
      offline = true; await ctx.setOffline(true);
      await page.reload(); await page.waitForSelector("body > header .logoMark");
      const o = await page.evaluate(() => ({ loop: getComputedStyle(document.querySelector("body > header .logoMark .loop")).display, n: document.getAnimations().length > 0 }));
      check(o.loop !== "none" && o.n, "sin red: el editor sale de la caché con la marca Ruta animada");
      offline = false; await ctx.close();
    }

    console.log("\nF) favicon y tamaños pequeños");
    {
      const icon = fs.readFileSync(path.join(root, ".ai/referencias/logo-ruta/svg/favicon-data-uri.txt"), "utf8").trim();
      const ctx = await browser.newContext({ viewport: { width: 900, height: 400 }, serviceWorkers: "block" }), page = watch(await ctx.newPage(), "F");
      for (const s of SURFACES.concat([{ url: "/privacy/" }, { url: "/terminos/" }, { url: "/terms/" }, { url: "/soporte/" }, { url: "/support/" }])) {
        await page.goto(base + s.url);
        const href = await page.evaluate(() => [...document.querySelectorAll('link[rel="icon"]')].map((l) => l.getAttribute("href")));
        check(href.length === 1 && href[0] === icon, `${s.url}: favicon Ruta`);
      }
      const sizes = [16, 24, 32];
      await page.setContent(`<body style="margin:0;background:#fff;display:flex;gap:24px;padding:16px;align-items:center;font:12px monospace">${sizes.map((z) => `<img id="f${z}" src="${icon}" width="${z}" height="${z}">`).join("")}${sizes.map((z) => `<img id="s${z}" src="${base}/assets/logo.svg" width="${z}" height="${z}">`).join("")}<img id="p192" src="${base}/assets/icon-192.png" width="32" height="32"><span style="background:#16150F;padding:6px;display:flex;gap:8px">${sizes.map((z) => `<img src="${icon}" width="${z}" height="${z}">`).join("")}</span></body>`);
      await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0));
      for (const z of sizes) await page.locator("#f" + z).screenshot({ path: path.join(shots, `F-favicon-${z}.png`) });
      await page.locator("body").screenshot({ path: path.join(shots, "F-small-sizes.png") });
      const px = await page.evaluate(() => { const i = document.getElementById("f16"), c = document.createElement("canvas"); c.width = c.height = 16; const g = c.getContext("2d"); g.drawImage(i, 0, 0, 16, 16); const d = g.getImageData(0, 0, 16, 16).data; let red = 0, dark = 0; for (let k = 0; k < d.length; k += 4) { if (d[k] > 120 && d[k + 1] < 110 && d[k + 2] < 100) red++; if (d[k] < 90 && d[k + 1] < 90 && d[k + 2] < 90) dark++; } return { red, dark }; });
      check(px.red >= 2 && px.dark >= 15, `16 px: el envío terracota (${px.red} px) y la tinta (${px.dark} px) siguen ahí`);
      await ctx.close();
    }
    console.log("\nH) cabecera del editor en tableta vertical táctil (701–768 px), con un documento abierto");
    {
      const FX = fs.readFileSync(path.join(root, "test/fixtures/fluyo-017-1-cliente-kafka-comercio.fluyo.json"), "utf8");
      for (const lang of ["es", "en"]) for (const st of ["Editar", "Historias"]) for (const w of [701, 720, 744, 760, 768]) {
        const ctx = await browser.newContext({ viewport: { width: w, height: 1024 }, hasTouch: true, isMobile: true, serviceWorkers: "block", locale: lang }), page = watch(await ctx.newPage(), `H ${w} ${lang}`);
        await page.goto(base + "/?lang=" + lang); await page.evaluate(() => document.fonts.ready);
        if (await page.locator("#autosaveModal").isVisible().catch(() => false)) await page.locator("#autosaveDiscard").click();
        await page.evaluate((fx) => { applyProjectData(JSON.parse(fx)); fitView(); clearSel(); renderTabs(); }, FX);
        if (st === "Historias") await page.click("#tabScenarios");
        await page.waitForTimeout(250);
        const h = await page.evaluate(() => {
          const hd = document.querySelector("body > header"), hr = hd.getBoundingClientRect(), r = (e) => e.getBoundingClientRect();
          const kids = [...hd.children].filter((e) => e.getClientRects().length && r(e).width > 0);
          const out = kids.filter((e) => r(e).right > hr.right + 0.5 || r(e).left < hr.left - 0.5).map((e) => e.id || e.className.split(" ")[0]);
          const cs = kids.map((e) => r(e).top + r(e).height / 2).sort((a, b) => a - b), rows = 1 + cs.filter((c, i) => i && c - cs[i - 1] > 10).length;
          const more = r(document.getElementById("btnMore")), logo = r(hd.querySelector(".logo"));
          return { rows, out, more: more.width > 0 && more.right <= hr.right + 0.5 && more.left >= hr.left, ov: hd.scrollWidth - hd.clientWidth,
            doc: document.documentElement.scrollWidth - document.documentElement.clientWidth, mark: hd.querySelector(".logoMark").getBoundingClientRect().width > 0, word: hd.querySelector(".logoWord").textContent, logoIn: logo.left >= hr.left && logo.right <= hr.right };
        });
        check(h.rows === 1 && h.more && h.out.length === 0 && h.ov <= 0 && h.doc <= 0 && h.mark && h.word === "fluyo" && h.logoIn,
          `${w} táctil ${lang} ${st}: una fila, «Más» a la vista, ningún control fuera, sin desborde (${h.ov}/${h.doc} px), símbolo + «fluyo» ${h.out.length ? JSON.stringify(h.out) : ""}`);
        if (lang === "es") await page.locator("body > header").screenshot({ path: path.join(shots, `H-${w}-${st}.png`) });
        await ctx.close();
      }
    }
    check(errors.length === 0, "0 errores de consola/página" + (errors.length ? ": " + errors.slice(0, 5).join(" | ") : ""));
  } finally { await browser.close(); server.close(); }
  console.log(`\nFLUYO-BRAND-RUTA-001 Chrome: ${passed} OK, ${failed} fallos · capturas en ${shots}`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
