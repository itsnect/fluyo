"use strict";
/* FLUYO-018.9 — smoke en Chrome REAL: los documentos v5 que ahora producen create_diagram y create_from_template (fluyo-mcp) se abren
   por su enlace #d= en el editor y en el Viewer de ESTE árbol de trabajo, sin sesión previa:
     · el editor carga el documento tal cual: serializeProject() es, byte a byte, el documento que devolvió la tool (ya canónico);
     · nodos, conexiones y defaults del dominio (code: etiqueta, lang, keywords/kwBg/kwColor; conexiones; colores HEX) llegan intactos;
     · el Viewer (/s/#d=) llega a «ready» con las mismas páginas, nodos y conexiones;
     · 0 errores de consola y 0 excepciones de página (telemetría externa bloqueada, cloud.umami.is).
   Requiere fluyo-mcp compilado al lado (`npm run build:test` en ../fluyo-mcp, o FLUYO_MCP=<ruta>).
   Uso: node test/fluyo-018-9-browser.cjs   (Playwright vía NODE_PATH; FLUYO_BROWSER=chrome por defecto) */
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("playwright-core")); }
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http");
const { pathToFileURL } = require("node:url");
const root = path.resolve(__dirname, "..");
const mcp = path.resolve(root, process.env.FLUYO_MCP || path.join("..", "fluyo-mcp"));
const shots = process.env.FLUYO_SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-018-9-"));
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
  assert.ok(fs.existsSync(path.join(dist, "diagram.js")), `falta ${dist}: ejecuta npm run build:test en fluyo-mcp`);
  const { createDiagramResult, createFromTemplateResult } = await import(pathToFileURL(path.join(dist, "diagram.js")).href);
  const { buildOpenLink } = await import(pathToFileURL(path.join(dist, "link.js")).href);
  const { TEMPLATES } = await import(pathToFileURL(path.join(dist, "templates.js")).href);

  const { server, base } = await serve(root);
  const browser = await chromium.launch({ channel: process.env.FLUYO_BROWSER || "chrome", headless: process.env.HEADED ? false : true });
  try {
    const DIAGRAM = {
      pageName: "Smoke 018.9", theme: "crema",
      nodes: [
        { key: "api", shape: "rect", label: "API", color: "Servicio" },
        { key: "q", shape: "code", keywords: ["SELECT", "FROM"], kwBg: "Config" },
        { key: "k", shape: "icon", icon: "kafka", label: "Kafka" },
        { key: "db", shape: "cylinder", label: "BD", color: "Datos", fill: "none" },
        { key: "t", shape: "text" },
      ],
      edges: [{ from: "api", to: "q", label: "consulta", lineColor: "Alerta" }, { from: "q", to: "k", route: "ortho", dots: 4 }, { from: "k", to: "db", dashed: true }],
    };
    const cases = [["create_diagram", createDiagramResult(DIAGRAM)], ...TEMPLATES.map((t) => [`create_from_template ${t.id}`, createFromTemplateResult({ templateId: t.id })])];

    for (const [label, r] of cases) {
      console.log(`\n${label}`);
      assert.equal(r.ok, true, JSON.stringify(r.errors));
      const project = r.project;
      const url = buildOpenLink(project, { FLUYO_APP_URL: base + "/" });
      assert.ok(url && url.startsWith(base + "/#d="), "enlace local");
      const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
      await ctx.route((u) => u.hostname.endsWith("umami.is"), (route) => route.abort());   // solo telemetría externa (como 018.8)
      const errors = [];
      const blocked = [];
      const watch = (page) => {
        page.on("console", (m) => { if (m.type() === "error") errors.push(m.text() + " @ " + (m.location().url || "")); });
        page.on("pageerror", (e) => errors.push(String(e)));
        page.on("requestfailed", (q) => blocked.push(q.url()));
        return page;
      };

      /* Editor */
      const ed = watch(await ctx.newPage());
      await ed.goto(url);
      await ed.waitForFunction((n) => typeof doc !== "undefined" && doc.pages[0].nodes.length === n, project.doc.pages[0].nodes.length, { timeout: 15000 });
      const inEditor = await ed.evaluate(() => JSON.parse(JSON.stringify(serializeProject())));
      check(JSON.stringify(inEditor) === JSON.stringify(project), "editor: serializeProject() = documento de la tool, byte a byte (v5 canónico)");
      check(inEditor.version === 5 && !("meta" in inEditor), "editor: v5 y sin meta");
      check(await ed.evaluate(() => !document.querySelector("#incomingModal, .incoming-modal") || getComputedStyle(document.querySelector("#incomingModal, .incoming-modal")).display === "none"), "editor: sin sesión previa no hay modal de documento entrante");
      const pg = inEditor.doc.pages[0];
      check(pg.nodes.every((n) => /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(n.color)), "editor: todos los colores de nodo en HEX");
      check(pg.edges.length === project.doc.pages[0].edges.length && pg.edges.every((e) => e.route && Array.isArray(e.waypoints) && typeof e.endArrow === "boolean" && !("fs" in e)), "editor: conexiones con los defaults del dominio y sin claves legacy");
      if (label === "create_diagram") {
        const code = pg.nodes.find((n) => n.shape === "code");
        const codeLabel = await ed.evaluate(() => CODE_DEFAULT_LABEL);
        check(code.label === codeLabel && code.lang === "sql" && JSON.stringify(code.keywords) === '["SELECT","FROM"]' && code.kwBg === "#c9b458" && code.kwColor === null, "editor: code con la etiqueta por defecto, lang del editor y keywords/kwBg conservados");
        check(pg.nodes.find((n) => n.shape === "text").label === "Texto" && pg.nodes.find((n) => n.shape === "icon").tint === false, "editor: defaults de text e icon");
        check(pg.edges[1].dots === 4 && pg.edges[1].dotsGlobal === false && pg.edges[0].lineColor === "#c16a6a", "editor: dots propio con dotsGlobal:false y lineColor traducido");
        check(inEditor.doc.theme === "crema" && pg.name === "Smoke 018.9", "editor: tema y nombre de página");
      }
      await ed.waitForTimeout(400);
      await ed.screenshot({ path: path.join(shots, label.replace(/\W+/g, "_") + "-editor.png") });

      /* Viewer */
      const vw = watch(await ctx.newPage());
      await vw.goto(url.replace(base + "/#d=", base + "/s/#d="));
      await vw.waitForFunction(() => window.__viewer && window.__viewer.phase === "ready", null, { timeout: 15000 });
      const inViewer = await vw.evaluate(() => ({ pages: window.__viewer.pages, nodes: doc.pages[0].nodes.length, edges: doc.pages[0].edges.length, page: JSON.parse(JSON.stringify(doc.pages[0])) }));
      check(inViewer.pages === 1 && inViewer.nodes === pg.nodes.length && inViewer.edges === pg.edges.length, "viewer: ready con las mismas páginas, nodos y conexiones");
      check(JSON.stringify(inViewer.page.nodes) === JSON.stringify(project.doc.pages[0].nodes) && JSON.stringify(inViewer.page.edges) === JSON.stringify(project.doc.pages[0].edges), "viewer: nodos y conexiones idénticos al documento de la tool");
      await vw.screenshot({ path: path.join(shots, label.replace(/\W+/g, "_") + "-viewer.png") });

      check(errors.length === 0, `0 errores de consola${errors.length ? ": " + errors.join(" | ") + " — bloqueadas: " + blocked.join(", ") : ""}`);
      await ctx.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  const bad = results.filter(([ok]) => !ok).length;
  console.log(`\nFLUYO-018.9 Chrome real: ${results.length - bad}/${results.length} comprobaciones correctas. Capturas: ${shots}`);
  process.exitCode = bad ? 1 : 0;
})().catch((e) => { console.error(e); process.exitCode = 1; });
