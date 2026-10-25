"use strict";
/* FLUYO-SW-VIEWER-001 — Chrome REAL con el service worker permitido: quien SOLO recibe un enlace (/s/#d=…) lo abre, el Viewer registra
   el SW con su conjunto mínimo, y desde la segunda apertura el enlace funciona SIN RED (D1), sin pedir nunca gif.js ni nada a cdnjs (D2),
   sin cachear el editor (D3), y con cualquier query de /s/ sirviendo el Viewer, nunca el editor (D4-A).
   · Escritorio 1440×900, móvil vertical 390×844 y apaisado 844×390: online /s/?lang=en (inglés, Historia, frase del autor sin traducir)
     → instalación (caché v108 = exactamente VIEWER_ASSETS) → sin red: recarga, /s/ en español, ?lang=fr (cae a español), ?s=demo (no el
     editor), preferencia guardada en inglés, enlace creado con el editor de e82c821 (antes de I18N y Narration).
   · Red: ninguna petición a terceros (cdnjs/Cloudflare incluido) ni a gif.js en toda la vida del Viewer, también la del propio SW.
   · Actualización: con el SW del Viewer instalado, un deploy (CACHE nueva) → la primera apertura es la versión anterior entera, la caché
     anterior se borra, la nueva es otra vez solo la del Viewer, y la siguiente apertura (también sin red) es la versión nueva entera.
   · Editor: su instalación sigue siendo la de siempre (index.html y gif.js en la caché), exportar un GIF descarga un .gif, y con ese SW
     /s/?lang=en sin red abre el Viewer (antes servía el editor).
   Uso: node test/fluyo-sw-viewer-001-browser.cjs   (Playwright vía NODE_PATH; FLUYO_BROWSER=chrome; SKIP_GIF=1 sin red externa) */
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = "1";
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("playwright-core")); }
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), http = require("node:http");
const root = path.resolve(process.env.FLUYO_ROOT || path.join(__dirname, ".."));
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const CACHE = /const CACHE = "([^"]+)";/.exec(read("sw.js"))[1];
const VIEWER = [...read("sw.js").match(/const VIEWER_ASSETS = \[([\s\S]*?)\];/)[1].matchAll(/"\.\/([^"]*)"/g)].map((m) => m[1]);
const MESSAGE = "Cliente solicita el checkout";
const NAR = JSON.parse(read("test/fixtures/fluyo-017-1-cliente-kafka-comercio.fluyo.json"));
NAR.doc.pages[0].scenarios.find((s) => s.steps.length).steps.find((s) => s.action === "SEND").message = MESSAGE;
const OLD_LINK = read("test/fixtures/sw-viewer-001/enlace-e82c821.txt").trim();
const mime = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2" };
/* El servidor marca cada archivo con su versión (VER): JS → self.__v[ruta]; HTML → <meta name="fluyo-ver">. Con VER 2, sw.js lleva otra
   CACHE: es un deploy. Registra lo que se le pide. */
let VER = 1; const served = [];
const server = http.createServer((req, res) => {
  try {
    let rel = new URL("http://x" + req.url).pathname; if (rel.endsWith("/")) rel += "index.html";
    let body = fs.readFileSync(path.resolve(root, "." + decodeURIComponent(rel)));
    const ext = path.extname(rel);
    served.push(rel);
    if (rel === "/sw.js") { if (VER === 2) body = Buffer.from(body.toString().replace(CACHE, CACHE + "-deploy")); }
    else if (ext === ".js") body = Buffer.concat([body, Buffer.from(`\n;(self.__v=self.__v||{})[${JSON.stringify(rel)}]=${VER};\n`)]);
    else if (ext === ".html") body = Buffer.from(body.toString().replace("<head>", `<head><meta name="fluyo-ver" content="${VER}">`));
    res.writeHead(200, { "Content-Type": mime[ext] || "application/octet-stream", "Cache-Control": "public, max-age=0, must-revalidate" }); res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
let failed = 0, passed = 0;
const check = (cond, msg) => { if (cond) { passed++; console.log("  ✔ " + msg); } else { failed++; console.log("  ✘ " + msg); } };
const VPS = [{ key: "d1440", width: 1440, height: 900 }, { key: "m390", width: 390, height: 844, mobile: true }, { key: "l844", width: 844, height: 390, mobile: true }];
async function until(p, fn, ms = 20000) { const t = Date.now(); while (Date.now() - t < ms) { if (await p.evaluate(fn).catch(() => false)) return true; await new Promise((r) => setTimeout(r, 150)); } return false; }

(async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + server.address().port;
  const browser = await chromium.launch({ channel: process.env.FLUYO_BROWSER || "chrome", headless: !process.env.HEADED });
  async function context(vp, { allowCdn = false } = {}) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.mobile, hasTouch: !!vp.mobile, deviceScaleFactor: vp.mobile ? 2 : 1, serviceWorkers: "allow" });
    const third = [];
    ctx.on("request", (r) => { if (!r.url().startsWith(base) && !r.url().startsWith("data:") && !r.url().startsWith("blob:")) third.push(r.url()); });
    await ctx.route((u) => !u.href.startsWith(base), (r) => (allowCdn && r.request().url().startsWith("https://cdnjs.cloudflare.com/") ? r.continue() : r.fulfill({ status: 204, body: "" })));
    return { ctx, third };
  }
  const page = async (ctx, url) => {
    const p = await ctx.newPage(), errors = [];
    p.on("pageerror", (e) => errors.push("pageerror: " + e.message));
    p.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
    let navErr = null;
    try { await p.goto(base + url, { timeout: 10000 }); } catch (e) { navErr = e.message.split("\n")[0].replace(/ at https?:\S+/, ""); }
    const ok = !navErr && await p.waitForFunction(() => window.__viewer && window.__viewer.phase === "ready", null, { timeout: 8000 }).then(() => true, () => false);
    return { p, errors, ok, navErr };
  };
  const state = (p) => p.evaluate(() => ({
    viewer: !!window.__viewer, editor: typeof applyProjectData === "function", title: document.title, lang: typeof FluyoI18n === "object" ? FluyoI18n.locale() : null,
    play: (document.getElementById("stPlay") || {}).textContent || "", html: (document.querySelector('meta[name="fluyo-ver"]') || {}).content,
    js: [...new Set(Object.values(self.__v || {}))], nJs: Object.keys(self.__v || {}).length, controlled: !!(navigator.serviceWorker && navigator.serviceWorker.controller),
  }));
  /* si la página no es el Viewer (p. ej. el editor servido por error) no hay Historia: se informa, no se rompe la prueba */
  const play = async (p) => {
    try { await p.evaluate(() => storyPlay()); await p.waitForTimeout(800); return await p.evaluate(() => ({ title: document.getElementById("stTitle").textContent, kicker: document.getElementById("stKicker").textContent, status: window.__viewer.story })); }
    catch (e) { return { title: "(no es el Viewer)", status: null }; }
  };
  const cacheState = (p) => p.evaluate(async () => { const keys = await caches.keys(); const out = {}; for (const k of keys) out[k] = (await (await caches.open(k)).keys()).map((r) => new URL(r.url).pathname); return out; });
  const EN = { title: "Shared diagram · Fluyo", play: "Play story" }, ES = { title: "Diagrama compartido · Fluyo", play: "Reproducir historia" };
  const isLang = (s, L) => s.viewer && !s.editor && s.title === L.title && s.play.includes(L.play);
  try {
    /* el enlace nuevo (Narration: frase del autor en un envío), creado por el editor sin SW */
    const ectx = await browser.newContext({ serviceWorkers: "block" });
    await ectx.route((u) => !u.href.startsWith(base), (r) => r.fulfill({ status: 204, body: "" }));
    const ep = await ectx.newPage(); await ep.goto(base + "/");
    await ep.waitForFunction(() => typeof createShareUrl === "function" && typeof applyProjectData === "function");
    const LINK = await ep.evaluate(async (d) => { applyProjectData(d); const sc = P().scenarios.find((s) => s.steps.length); return new URL(await createShareUrl(serializeProject(), location.href, { kind: "story", scenarioId: sc.id })).hash.slice(3); }, NAR);
    await ectx.close();
    const expected = VIEWER.map((f) => "/" + f).sort();

    for (const vp of VPS) {
      console.log(`\n── ${vp.key} (${vp.width}×${vp.height}) · visitante nuevo, solo el enlace`);
      VER = 1; served.length = 0;
      const { ctx, third } = await context(vp);
      /* online, en inglés por la URL */
      const a = await page(ctx, "/s/?lang=en#d=" + LINK);
      let s = await state(a.p);
      check(a.ok && isLang(s, EN), `${vp.key} online /s/?lang=en: el Viewer en inglés («${s.title}»)`);
      let pl = await play(a.p);
      check(pl.title === MESSAGE && pl.status === "running", `${vp.key} online: la Historia se reproduce y el título del momento es la frase del autor sin traducir («${pl.title}»)`);
      const installed = await until(a.p, async () => { const k = await caches.keys(); return k.length === 1 && (await (await caches.open(k[0])).keys()).length >= 25 && !!navigator.serviceWorker.controller; });
      const cs = await cacheState(a.p);
      check(installed && Object.keys(cs).join() === CACHE, `${vp.key} primera carga: el SW queda instalado y controla el Viewer; caché ${Object.keys(cs).join()} (= ${CACHE})`);
      check(JSON.stringify((cs[CACHE] || []).sort()) === JSON.stringify(expected), `${vp.key} la caché es EXACTAMENTE el conjunto del Viewer (${(cs[CACHE] || []).length} recursos; nada del editor)`);
      check(!(cs[CACHE] || []).some((u) => /^\/(index\.html)?$|editor|export|ui\.js|gif/.test(u)), `${vp.key} sin index.html, scripts del editor ni gif.js en la caché`);
      check(a.errors.length === 0, `${vp.key} online sin errores de consola` + (a.errors.length ? " — " + a.errors[0] : ""));
      /* sin red */
      await ctx.setOffline(true);
      await a.p.reload().catch(() => {});
      const back = await a.p.waitForFunction(() => window.__viewer && window.__viewer.phase === "ready", null, { timeout: 8000 }).then(() => true, () => false);
      s = await state(a.p);
      check(back && isLang(s, EN) && s.controlled, `${vp.key} SIN RED, recargar /s/?lang=en: sigue siendo el Viewer en inglés, no el editor («${s.title}»)`);
      pl = await play(a.p);
      check(pl.title === MESSAGE && pl.status === "running", `${vp.key} sin red: la Historia se reproduce con la frase del autor («${pl.title}»)`);
      for (const [label, url, L] of [["/s/#d= (español)", "/s/#d=" + LINK, ES], ["/s/?lang=fr (idioma desconocido → español)", "/s/?lang=fr#d=" + LINK, ES], ["/s/?s=demo#d=", "/s/?s=demo#d=" + LINK, ES]]) {
        const b = await page(ctx, url); const st = b.ok ? await state(b.p) : { title: b.navErr };
        check(b.ok && isLang(st, L), `${vp.key} sin red ${label}: el Viewer («${st.title}»)`);
        if (b.ok && label.startsWith("/s/#d=")) { const t = await play(b.p); check(t.title === MESSAGE, `${vp.key} sin red, español: frase del autor intacta («${t.title}»)`); }
        await b.p.close();
      }
      /* preferencia guardada (fluyo.ui.lang = en), sin red */
      const c = await page(ctx, "/s/#d=" + LINK);
      await c.p.evaluate(() => localStorage.setItem("fluyo.ui.lang", "en")); await c.p.reload().catch(() => {});
      await c.p.waitForFunction(() => window.__viewer && window.__viewer.phase === "ready", null, { timeout: 8000 }).catch(() => {});
      s = await state(c.p);
      check(isLang(s, EN), `${vp.key} sin red, preferencia guardada en inglés: el Viewer en inglés`);
      await c.p.evaluate(() => localStorage.removeItem("fluyo.ui.lang")); await c.p.close();
      /* enlace creado con el editor de e82c821 (antes de I18N y Narration), sin red */
      const d = await page(ctx, "/s/#d=" + OLD_LINK);
      const od = d.ok ? await play(d.p) : {};
      check(d.ok && od.status === "running" && od.title === "Pago", `${vp.key} sin red, enlace anterior a I18N y Narration: abre y reproduce («${od.title}»)`);
      check(d.errors.length === 0 && a.errors.length === 0, `${vp.key} sin red sin errores de consola` + (d.errors.length ? " — " + d.errors[0] : ""));
      check(third.length === 0, `${vp.key} ninguna petición a terceros (ni cdnjs/Cloudflare) en toda la sesión, SW incluido` + (third.length ? " — " + third[0] : ""));
      check(!served.some((u) => /gif/.test(u)), `${vp.key} ninguna petición a gif.js`);
      await ctx.close();
    }

    console.log("\n── actualización de la caché con el SW del Viewer instalado (390×844)");
    {
      VER = 1; served.length = 0;
      const { ctx, third } = await context(VPS[1]);
      const a = await page(ctx, "/s/#d=" + LINK);
      await until(a.p, async () => (await caches.keys()).length === 1 && !!navigator.serviceWorker.controller);
      await a.p.close();
      VER = 2;   // deploy: otra CACHE en sw.js y archivos nuevos
      const b = await page(ctx, "/s/?lang=en#d=" + LINK);
      const s1 = await state(b.p);
      check(b.ok && s1.html === "1" && s1.js.join() === "1" && s1.nJs === 18 && isLang(s1, EN), `primera apertura tras el deploy: la versión anterior ENTERA (HTML y los 18 scripts v1, sin mezcla) y funciona`);
      const swapped = await until(b.p, async () => { const k = await caches.keys(); return k.length === 1 && k[0].endsWith("-deploy"); }, 25000);
      const cs = await cacheState(b.p);
      check(swapped !== false && Object.keys(cs).join() === CACHE + "-deploy", `la caché anterior se borra y queda solo la nueva (${Object.keys(cs).join()})`);
      check(JSON.stringify((cs[CACHE + "-deploy"] || []).sort()) === JSON.stringify(expected), `la nueva vuelve a ser solo la del Viewer (${(cs[CACHE + "-deploy"] || []).length} recursos)`);
      await b.p.reload(); await b.p.waitForFunction(() => window.__viewer && window.__viewer.phase === "ready", null, { timeout: 8000 }).catch(() => {});
      const s2 = await state(b.p);
      check(s2.html === "2" && s2.js.join() === "2" && s2.nJs === 18, `la siguiente apertura: la versión nueva ENTERA`);
      await ctx.setOffline(true);
      await b.p.reload().catch(() => {}); await b.p.waitForFunction(() => window.__viewer && window.__viewer.phase === "ready", null, { timeout: 8000 }).catch(() => {});
      const s3 = await state(b.p);
      check(s3.html === "2" && s3.js.join() === "2" && isLang(s3, EN), `y sin red: la versión nueva, en inglés`);
      check(third.length === 0 && !served.some((u) => /gif/.test(u)), `actualización sin terceros ni gif.js`);
      await ctx.close();
    }

    console.log("\n── el editor: instalación de siempre, GIF, y su SW con /s/?lang=en sin red (1440×900)");
    {
      VER = 1;
      const { ctx, third } = await context(VPS[0], { allowCdn: !process.env.SKIP_GIF });
      const e = await ctx.newPage(); const errs = []; e.on("pageerror", (x) => errs.push(x.message));
      await e.goto(base + "/");
      await e.waitForFunction(() => typeof applyProjectData === "function");
      if (await e.locator("#autosaveModal").isVisible().catch(() => false)) await e.locator("#autosaveDiscard").click();
      await until(e, async () => (await caches.keys()).length === 1 && (await (await caches.open((await caches.keys())[0])).keys()).length > 40);
      const cs = await cacheState(e);
      const list = cs[CACHE] || [];
      check(list.includes("/index.html") && list.includes("/js/export.js") && list.includes("/s/") && list.length > 60, `editor: su instalación de siempre (${list.length} recursos, index.html, export.js y el Viewer)`);
      if (!process.env.SKIP_GIF) {
        /* gif.js entra en la caché algo después que lo demás (otro addAll, tolerante a fallos, como siempre) */
        await until(e, async () => (await (await caches.open((await caches.keys())[0])).keys()).some((r) => r.url.includes("gif.worker.js")), 20000);
        const all = await e.evaluate(async () => (await (await caches.open((await caches.keys())[0])).keys()).map((r) => r.url));
        check(all.some((u) => /cdnjs\.cloudflare\.com\/ajax\/libs\/gif\.js/.test(u)), "editor: gif.js precacheado como siempre (la única petición a un tercero, la del editor)");
        await e.evaluate((d) => { applyProjectData(d); }, NAR);
        await e.waitForFunction(() => typeof GIF === "function", null, { timeout: 15000 }).catch(() => {});
        const dl = e.waitForEvent("download", { timeout: 60000 }).catch(() => null);
        await e.evaluate(() => { $("btnExport").onclick(); $("exFmt").value = "gif"; $("exRes").value = "1"; $("exGo").onclick(); });
        const got = await dl;
        check(!!got && /\.gif$/.test(got.suggestedFilename()), `editor: exportar GIF descarga ${got ? got.suggestedFilename() : "(nada)"}`);
      }
      check(errs.length === 0, "editor sin errores" + (errs.length ? " — " + errs[0] : ""));
      await ctx.setOffline(true);
      const v = await page(ctx, "/s/?lang=en#d=" + LINK);
      const s = v.ok ? await state(v.p) : { title: v.navErr };
      check(v.ok && isLang(s, EN), `con el SW del editor, SIN RED /s/?lang=en: el Viewer en inglés (antes servía el editor) («${s.title}»)`);
      check(third.every((u) => u.startsWith("https://cdnjs.cloudflare.com/ajax/libs/gif.js/")), "editor: ningún tercero salvo gif.js");
      await ctx.close();
    }
  } finally { await browser.close(); server.close(); }
  console.log(`\nFLUYO-SW-VIEWER-001 browser: ${passed} ✔ · ${failed} ✘`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
