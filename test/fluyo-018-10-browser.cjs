"use strict";
/* FLUYO-018.10 — Chrome REAL.
   A) La capacidad que antes solo tenía edit_diagram: author_document (fluyo-mcp compilado) devuelve `editorUrl` (#d=) al documento FINAL;
      abierto en el editor de ESTE árbol de trabajo, sin sesión previa, serializeProject() es ese documento byte a byte (dos páginas,
      tema y fondo, Historias, EventTypes, Behaviors). Lo mismo para una tool de una operación
      (set_theme) encadenada sobre el resultado.
   B) docs/ (asset servido, D3): la tabla de tools es la del contrato (15, sin edit_diagram), el SW precachea ./docs/ con CACHE v72 y la
      página funciona offline.
   0 errores de consola / página (telemetría externa bloqueada, cloud.umami.is).
   Requiere fluyo-mcp compilado al lado (`npm run build:test` en ../fluyo-mcp, o FLUYO_MCP=<ruta>).
   Uso: node test/fluyo-018-10-browser.cjs   (Playwright vía NODE_PATH; FLUYO_BROWSER=chrome por defecto) */
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("playwright-core")); }
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http");
const { pathToFileURL } = require("node:url");
const root = path.resolve(__dirname, "..");
const mcp = path.resolve(root, process.env.FLUYO_MCP || path.join("..", "fluyo-mcp"));
const shots = process.env.FLUYO_SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-018-10-"));
const PART = process.env.PART || "AB";
const mime = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png" };
const serve = async (dir) => {
  const server = http.createServer((req, res) => {
    try {
      let rel = new URL("http://x" + req.url).pathname; if (rel.endsWith("/")) rel += "index.html";
      const file = path.resolve(dir, "." + decodeURIComponent(rel)); assert.ok(file.startsWith(dir + path.sep));
      res.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" }); res.end(fs.readFileSync(file));
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { server, base: "http://127.0.0.1:" + server.address().port };
};
const results = [];
const check = (ok, what) => { results.push([!!ok, what]); console.log(`${ok ? "  ✔" : "  ✘"} ${what}`); };

(async () => {
  const dist = path.join(mcp, "dist-test", "src");
  assert.ok(fs.existsSync(path.join(dist, "authoring.js")), `falta ${dist}: ejecuta npm run build:test en fluyo-mcp`);
  const { authorDocument } = await import(pathToFileURL(path.join(dist, "authoring.js")).href);
  const { createKernel } = await import(pathToFileURL(path.join(dist, "kernel.js")).href);
  const { revisionOf } = await import(pathToFileURL(path.join(dist, "revision.js")).href);
  const rev = (d) => revisionOf(createKernel(), d);

  const { server, base } = await serve(root);
  process.env.FLUYO_APP_URL = base + "/";
  const browser = await chromium.launch({ channel: process.env.FLUYO_BROWSER || "chrome", headless: !process.env.HEADED });
  const errors = [];
  const newCtx = async () => {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    await ctx.route((u) => u.hostname.endsWith("umami.is"), (route) => route.abort());
    return ctx;
  };
  const watch = (page) => { page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); }); page.on("pageerror", (e) => errors.push(String(e))); return page; };
  try {
    if (PART.includes("A")) {
      console.log("\nA) author_document → editorUrl → editor");
      const blank = createKernel().call("serializeProject()");
      const N = (pi, ref, x, label, extra = {}) => ({ op: "create_node", scope: "page", pageIndex: pi, ref, spec: { shape: "rect", x, y: 0, label, ...extra } });
      const C = (pi, s, t, ref) => ({ op: "create_connection", scope: "page", pageIndex: pi, source: { ref: s }, target: { ref: t }, ...(ref ? { ref } : {}) });
      const r = authorDocument({ document: blank, baseRevision: rev(blank), operations: [
        { op: "set_theme", scope: "document", theme: "crema", customBg: "#f3ead7" },
        { op: "rename_page", scope: "document", pageIndex: 0, name: "Pagos" },
        N(0, "cli", 200, "Cliente"), N(0, "com", 500, "Comercio"), N(0, "ban", 800, "Banco", { shape: "cylinder" }),
        C(0, "cli", "com", "c1"), C(0, "com", "ban", "c2"),
        { op: "set_initial_availability", scope: "page", pageIndex: 0, nodeId: { ref: "ban" }, state: "DOWN" },
        { op: "create_event_type", scope: "eventType", name: "Pago", primitive: "FLOW", sentence: "{source} paga a {target}", symbol: "💵", ref: "pago" },
        { op: "create_story", scope: "story", pageIndex: 0, name: "Compra", ref: "s" },
        { op: "add_step", scope: "story", pageIndex: 0, storyId: { ref: "s" }, eventTypeId: { ref: "pago" }, target: { edgeId: { ref: "c1" } } },
        { op: "add_step", scope: "story", pageIndex: 0, storyId: { ref: "s" }, eventTypeId: { ref: "pago" }, target: { edgeId: { ref: "c2" } } },
        { op: "create_page", scope: "document", name: "Envíos" },
        N(1, "alm", 200, "Almacén"), N(1, "cam", 500, "Camión", { shape: "icon", icon: "kafka" }), C(1, "alm", "cam"),
      ] });
      assert.equal(r.ok, true, JSON.stringify(r.errors));
      check(typeof r.editorUrl === "string" && r.editorUrl.startsWith(base + "/#d="), "author_document devuelve editorUrl hacia el editor local");
      const themed = authorDocument({ document: r.document, baseRevision: r.resultRevision, operations: [{ op: "set_theme", scope: "document", theme: "claro" }] });
      for (const [label, res] of [["author_document (lote rico)", r], ["set_theme encadenado (tool de una operación)", themed]]) {
        const ctx = await newCtx();
        const ed = watch(await ctx.newPage());
        await ed.goto(res.editorUrl);
        await ed.waitForFunction((n) => typeof doc !== "undefined" && doc.pages.length === 2 && doc.pages[0].nodes.length === n, res.document.doc.pages[0].nodes.length, { timeout: 15000 });
        const got = await ed.evaluate(() => JSON.stringify(serializeProject()));
        check(got === JSON.stringify(res.document), `${label}: el editor carga el documento FINAL byte a byte`);
        const s = await ed.evaluate(() => ({ theme: doc.theme, bg: doc.customBg, ets: doc.eventTypes.map((e) => e.name), stories: doc.pages[0].scenarios.map((x) => x.name), beh: doc.pages[0].behaviors.length, pages: doc.pages.map((p) => p.name) }));
        check(JSON.stringify(s.pages) === '["Pagos","Envíos"]' && s.ets.join() === "Pago" && s.stories.join() === "Compra" && s.beh === 1, `${label}: dos páginas, EventType, Historia y Behavior`);
        check(s.theme === res.document.doc.theme && s.bg === res.document.doc.customBg, `${label}: tema ${s.theme} y fondo`);
        check(await ed.evaluate(() => getComputedStyle(document.getElementById("incomingModal")).display === "none"), `${label}: sin sesión no hay modal de documento entrante`);
        await ed.screenshot({ path: path.join(shots, label.replace(/\W+/g, "_") + ".png") });
        await ctx.close();
      }
    }
    if (PART.includes("B")) {
      console.log("\nB) docs/ (asset servido): tools del contrato y precache v72");
      const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
      const cache = /const CACHE = "([^"]+)"/.exec(sw)[1];
      check(cache === "fluyo-static-v75", `sw.js: CACHE = ${cache}`);
      check(sw.includes('"./docs/"'), "sw.js precachea ./docs/");
      const ctx = await newCtx();
      const pg = watch(await ctx.newPage());
      await pg.goto(base + "/docs/");
      const tools = await pg.evaluate(() => [...document.querySelectorAll("table code")].map((c) => c.textContent).filter((t) => /^[a-z_]+$/.test(t) && /_/.test(t) || ["run_story"].includes(t)));
      const EXPECTED = ["author_document", "create_diagram", "create_from_template", "describe_document", "duplicate_node", "export_diagram", "list_anims", "list_colors", "list_fonts", "list_icons", "list_templates", "propose_layout", "reorder_nodes", "run_story", "set_theme"];
      const listed = [...new Set(tools)].filter((t) => EXPECTED.includes(t) || t === "edit_diagram").sort();
      check(JSON.stringify(listed) === JSON.stringify(EXPECTED), `docs/: la tabla nombra las 15 tools del contrato (${listed.length})`);
      const text = await pg.evaluate(() => document.body.innerText);
      const mentions = text.split(/(?<=[.!?])s+/).filter((x) => x.includes("edit_diagram"));
      check(mentions.length > 0 && mentions.every((x) => /retir/.test(x)), "docs/: edit_diagram solo aparece como retirada");
      check(/15 tools|quince tools/i.test(text) && !/nueve tools|9 tools/i.test(text), "docs/: el recuento es 15");
      // Precache real: el SW instala v72 y sirve /docs/ sin red.
      await pg.goto(base + "/");
      await pg.evaluate(async () => { await navigator.serviceWorker.ready; });
      const t0 = Date.now();
      for (;;) { // como fluyo-016-browser: la instalación del SW llena la caché con todo el precache
        if (await pg.evaluate(async () => { const k = await caches.keys(); return k.length === 1 && (await (await caches.open(k[0])).keys()).length > 30; })) break;
        if (Date.now() - t0 > 30000) break;
        await pg.waitForTimeout(200);
      }
      const keys = await pg.evaluate(() => caches.keys());
      check(JSON.stringify(keys) === '["fluyo-static-v75"]', `la caché instalada es solo fluyo-static-v75 (${keys.join()})`);
      const cached = await pg.evaluate(async (b) => !!(await (await caches.open("fluyo-static-v75")).match(b + "/docs/")), base);
      check(cached, "el SW (v72) tiene ./docs/ en caché");
      await ctx.setOffline(true);
      const off = watch(await ctx.newPage());
      const resp = await off.goto(base + "/docs/").catch(() => null);
      check(!!resp && /servidor MCP|tools/i.test(await off.evaluate(() => document.body.innerText)), "docs/ se abre offline desde la caché v72");
      await off.screenshot({ path: path.join(shots, "docs-offline.png"), fullPage: false });
      await ctx.setOffline(false);
      await ctx.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  const offline = errors.filter((e) => !/ERR_INTERNET_DISCONNECTED|net::ERR_FAILED/.test(e));
  check(offline.length === 0, `0 errores de consola/página${offline.length ? ": " + offline.join(" | ") : ""}`);
  const bad = results.filter(([ok]) => !ok).length;
  console.log(`\nFLUYO-018.10 Chrome real: ${results.length - bad}/${results.length} comprobaciones correctas. Capturas: ${shots}`);
  process.exitCode = bad ? 1 : 0;
})().catch((e) => { console.error(e); process.exitCode = 1; });
