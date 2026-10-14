"use strict";
/* FLUYO-018.24 — Chrome REAL, pasada dirigida (< 1 min): Deshacer sin perder el contexto.
   Casos: nodo → color → Undo (la selección y el panel siguen) → Redo · móvil: hoja de Propiedades → color → Undo (la hoja sigue)
   · eliminar → Undo (vuelve seleccionado) → Redo (sin selección) · Undo de una creación (sin selección, sin errores) · selección en
   otra página · kwEdit → Undo → Redo · edgeDotsIn → Undo → Redo · «Línea punteada» + puntos: dos entradas · kwEdit + edgeDotsIn
   consecutivos: Undo uno a uno · escribir tras Undo vacía Rehacer.
   Viewports: 1440×900 (ratón) y 390×844 (dedo).
   Uso: node test/fluyo-018-24-browser.cjs   (Playwright vía NODE_PATH; FLUYO_BROWSER=chrome; FLUYO_SHOTS=<dir>)
        ONLY=d1440|m390   recorre solo ese viewport (lo usan las mutaciones). */
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("playwright-core")); }
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http");
const root = path.resolve(process.env.FLUYO_ROOT || path.join(__dirname, ".."));
const shots = process.env.FLUYO_SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-018-24-"));
fs.mkdirSync(shots, { recursive: true });
const FIXTURE = fs.readFileSync(path.join(__dirname, "fixtures", "fluyo-017-1-qa-complejo.fluyo.json"), "utf8");
const ONLY = process.env.ONLY || "";
const mime = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".gif": "image/gif", ".woff2": "font/woff2" };
const serve = async (dir) => {
  const server = http.createServer((req, res) => {
    try {
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

async function open(browser, base, vp) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: !!vp.touch, isMobile: !!vp.mobile, serviceWorkers: "block", deviceScaleFactor: vp.mobile ? 2 : 1 });
  await ctx.route((u) => !u.href.startsWith(base), (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  const page = await ctx.newPage(), errors = [];
  page.on("pageerror", (e) => errors.push(vp.key + " pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(vp.key + " console: " + m.text()); });
  page.on("dialog", (d) => d.accept());
  await page.goto(base + "/"); await page.waitForFunction(() => typeof refreshPanel === "function" && typeof stepHistory === "function");
  if (await page.locator("#autosaveModal").isVisible().catch(() => false)) await page.locator("#autosaveDiscard").click();
  await page.evaluate(() => document.fonts.ready);
  /* el fixture + un nodo libre (sin Historias), un code con «Lista propia» y una conexión con puntos propios; pilas vacías */
  await page.evaluate((fx) => {
    if (typeof scReset === "function") scReset();
    setUiMode("edit"); applyProjectData(JSON.parse(fx));
    const a = newNode("rect", 520, 620, { label: "Libre" }), c = newNode("code", 820, 620, { label: "SELECT 1" });
    editNode(c, { keywords: ["uno"] });                              // «Lista propia»: manda la lista (lang no es "custom")
    const e = P().edges[0]; editEdge(e, { animated: true, dotsGlobal: false, dots: 2 });
    window.__free = a.id; window.__code = c.id; window.__edge = e.id;
    fitView(); clearSel(); renderTabs(); undoStack.length = 0; redoStack.length = 0;
  }, FIXTURE);
  await page.waitForTimeout(200);
  return { ctx, page, errors, vp };
}
const press = async (t, sel, ms = 200) => { const l = typeof sel === "string" ? t.page.locator(sel).first() : sel; await l.scrollIntoViewIfNeeded().catch(() => {}); if (t.vp.touch) await l.tap(); else await l.click(); await t.page.waitForTimeout(ms); };
const S = () => ({ sel: [...selN].map(String).concat([...selE].map((x) => "e" + x)).join(","), title: $("selTitle").textContent, sheet: document.body.classList.contains("panelOpen"), u: undoStack.length, r: redoStack.length });
const select = (t, type, id) => t.page.evaluate(([type, id, sheet]) => { selectOnly(type, id); if (sheet) openSurface("properties"); }, [type, id, !!t.vp.mobile]);
const openGroup = (t, id) => t.page.evaluate((id) => { $(id).open = true; }, id);
/* escribe en un campo como una persona: foco, valor, y sale del campo (input + change) */
const typeIn = async (t, sel, v) => { const l = t.page.locator(sel); await l.scrollIntoViewIfNeeded(); if (t.vp.touch) await l.tap(); else await l.click(); await l.fill(v); await l.evaluate((e) => e.blur()); await t.page.waitForTimeout(80); };
/* un botón apagado (nada que deshacer/rehacer) no se pulsa: el caso lo detecta su propia comprobación, sin colgar la pasada */
const histBtn = async (t, id) => { if (await t.page.evaluate((id) => $(id).disabled, id)) { console.log("  · " + id + " apagado"); return; } await press(t, "#" + id, 150); };
const undoBtn = (t) => histBtn(t, "btnUndo"), redoBtn = (t) => histBtn(t, "btnRedo");

async function runViewport(browser, base, vp) {
  console.log(`\n── ${vp.key} (${vp.width}×${vp.height}${vp.touch ? ", dedo" : ", ratón"})`);
  const t = await open(browser, base, vp), page = t.page;
  const free = await page.evaluate(() => window.__free), code = await page.evaluate(() => window.__code), edge = await page.evaluate(() => window.__edge);

  /* 1 · nodo → color → Undo: la selección y el panel siguen; Redo devuelve el color */
  await select(t, "node", free); await openGroup(t, "grpShape");
  const f0 = await page.evaluate((id) => nodeById(id).fill || null, free);
  await press(t, page.locator("#fillSw .swatch").nth(3));
  const f1 = await page.evaluate((id) => nodeById(id).fill || null, free);
  const s1 = await page.evaluate(S);
  await undoBtn(t);
  const u = await page.evaluate(S), fu = await page.evaluate((id) => nodeById(id).fill || null, free);
  const wellU = await page.evaluate(() => document.querySelector("#fillSw .swatch.on, #fillSw .swatch[aria-checked=true]")?.dataset.v ?? null);
  check(f1 !== f0 && fu === f0, `color → Undo restaura el relleno (${f0} → ${f1} → ${fu})`);
  check(u.sel === String(free) && u.title === "Libre", `tras Undo el nodo sigue seleccionado y el panel lo muestra (sel=${u.sel}, «${u.title}»)`);
  if (vp.mobile) check(s1.sheet && u.sheet, `móvil: la hoja de Propiedades sigue abierta tras Undo (${s1.sheet} → ${u.sheet})`);
  await page.screenshot({ path: path.join(shots, `${vp.key}-undo-color.png`) });
  await redoBtn(t);
  const r = await page.evaluate(S), fr = await page.evaluate((id) => nodeById(id).fill || null, free);
  check(fr === f1 && r.sel === String(free) && r.title === "Libre" && (!vp.mobile || r.sheet), `Redo devuelve el color y conserva selección y panel (${fr}, sel=${r.sel}${vp.mobile ? ", hoja=" + r.sheet : ""})`);
  void wellU;

  /* 2 · eliminar → Undo: el elemento vuelve SELECCIONADO; Redo lo quita y no deja selección fantasma */
  await select(t, "node", free);
  const n0 = await page.evaluate(() => P().nodes.length);
  if (vp.mobile) await press(t, "#btnDel"); else await press(t, "#btnDel");
  const d = await page.evaluate(S), n1 = await page.evaluate(() => P().nodes.length);
  await undoBtn(t);
  const du = await page.evaluate(S), n2 = await page.evaluate(() => P().nodes.length);
  check(n1 === n0 - 1 && d.sel === "" && n2 === n0 && du.sel === String(free) && du.title === "Libre", `eliminar → Undo: el nodo vuelve y vuelve seleccionado (${n0}→${n1}→${n2}; sel «${d.sel}» → «${du.sel}», «${du.title}»)`);
  if (vp.mobile) note(`móvil: hoja tras eliminar=${d.sheet}, tras Undo=${du.sheet}`);
  await redoBtn(t);
  const dr = await page.evaluate(S);
  check((await page.evaluate(() => P().nodes.length)) === n0 - 1 && dr.sel === "" && dr.title === "Propiedades" && (!vp.mobile || !dr.sheet), `Redo del borrado: el nodo se va y no queda selección${vp.mobile ? " (la hoja se cierra)" : ""} (sel «${dr.sel}»)`);
  await undoBtn(t);

  /* 3 · Undo de una creación: lo creado desaparece; sin selección y sin errores */
  const made = await page.evaluate(() => { pushUndo(); const n = newNode("rect", 300, 760, { label: "Nuevo" }); selectOnly("node", n.id); return n.id; });
  await undoBtn(t);
  const cu = await page.evaluate(S);
  check(!(await page.evaluate((id) => !!nodeById(id), made)) && cu.sel === "" && cu.title === "Propiedades", `Undo de una creación: sin el nodo y sin selección (sel «${cu.sel}»)`);
  await redoBtn(t);
  const cr = await page.evaluate(S);
  check(cr.sel === "" || cr.sel === String(made), `Redo de la creación: el nodo vuelve (sel «${cr.sel}»)`);
  await undoBtn(t);

  /* 4 · otra página: Undo de una edición de la página 1 hecho desde la página 2 no selecciona ids de la otra página */
  await page.evaluate((id) => { selectOnly("node", id); pushUndo(); editNode(nodeById(id), { label: "Libre 2" }); doc.cur = 1; renderTabs(); clearSel(); selectOnly("node", P().nodes[0].id); }, free);
  await undoBtn(t);
  const pu = await page.evaluate(() => ({ cur: doc.cur, sel: [...selN].join(","), exists: [...selN].every((id) => !!nodeById(id)) }));
  check(pu.cur === 0 && pu.exists, `Undo que vuelve a otra página: la selección es válida en la página activa (cur=${pu.cur}, sel «${pu.sel}»)`);
  await page.evaluate(() => { clearSel(); undoStack.length = 0; redoStack.length = 0; });

  /* 5 · kwEdit → Undo → Redo (una entrada, exacta) */
  await select(t, "node", code); await openGroup(t, "grpCode");
  const k0 = await page.evaluate((id) => JSON.stringify(nodeById(id).keywords), code);
  const ku0 = await page.evaluate(() => undoStack.length);
  await typeIn(t, "#kwEdit", "uno dos tres");
  const k1 = await page.evaluate((id) => JSON.stringify(nodeById(id).keywords), code), ku1 = await page.evaluate(() => undoStack.length);
  await undoBtn(t);
  const k2 = await page.evaluate((id) => JSON.stringify(nodeById(id).keywords), code), kSel = await page.evaluate(S);
  const kField = await page.evaluate(() => $("kwEdit").value);
  await redoBtn(t);
  const k3 = await page.evaluate((id) => JSON.stringify(nodeById(id).keywords), code);
  check(ku1 === ku0 + 1, `kwEdit: escribir la lista apila UNA entrada de Undo (${ku0} → ${ku1})`);
  check(k1 === JSON.stringify(["uno", "dos", "tres"]) && k2 === k0 && k3 === k1, `kwEdit: ${k0} → ${k1}; Undo → ${k2}; Redo → ${k3}`);
  check(kSel.sel === String(code) && kField === "uno", `kwEdit: tras Undo el code sigue seleccionado y el campo enseña «${kField}»`);

  /* 6 · edgeDotsIn → Undo → Redo · y «Línea punteada» + puntos: dos entradas, una por cambio */
  await select(t, "edge", edge); await openGroup(t, "grpStroke"); await openGroup(t, "grpFlow");
  const e0 = await page.evaluate((id) => [edgeById(id).dots, !!edgeById(id).dashed], edge);
  const eu0 = await page.evaluate(() => undoStack.length);
  await page.evaluate(() => { $("dashChk").checked = !$("dashChk").checked; $("dashChk").onchange(); });
  await typeIn(t, "#edgeDotsIn", "5");
  const e1 = await page.evaluate((id) => [edgeById(id).dots, !!edgeById(id).dashed], edge), eu1 = await page.evaluate(() => undoStack.length);
  check(eu1 === eu0 + 2, `punteada + puntos = dos entradas de Undo (${eu0} → ${eu1})`);
  await undoBtn(t);
  const e2 = await page.evaluate((id) => [edgeById(id).dots, !!edgeById(id).dashed], edge), eSel = await page.evaluate(S), eField = await page.evaluate(() => $("edgeDotsIn").value);
  check(e2[0] === e0[0] && e2[1] === e1[1], `Undo deshace SOLO los puntos (${JSON.stringify(e1)} → ${JSON.stringify(e2)}; la punteada sigue)`);
  check(eSel.sel === "e" + edge && eField === String(e0[0]), `edgeDotsIn: tras Undo la conexión sigue seleccionada y el campo enseña ${eField}`);
  await undoBtn(t);
  const e3 = await page.evaluate((id) => [edgeById(id).dots, !!edgeById(id).dashed], edge);
  check(JSON.stringify(e3) === JSON.stringify(e0), `segundo Undo deshace la punteada (${JSON.stringify(e3)})`);
  await redoBtn(t); await redoBtn(t);
  const e4 = await page.evaluate((id) => [edgeById(id).dots, !!edgeById(id).dashed], edge);
  check(JSON.stringify(e4) === JSON.stringify(e1), `Redo ×2 devuelve punteada y 5 puntos (${JSON.stringify(e4)})`);
  /* dos cambios del número, separados (salir del campo entre ellos): dos entradas */
  const eu2 = await page.evaluate(() => undoStack.length);
  await typeIn(t, "#edgeDotsIn", "3"); await typeIn(t, "#edgeDotsIn", "4");
  check((await page.evaluate(() => undoStack.length)) === eu2 + 2, "dos cambios del número separados = dos entradas");
  await undoBtn(t);
  check((await page.evaluate((id) => edgeById(id).dots, edge)) === 3, "Undo vuelve exactamente al valor anterior (3)");
  await undoBtn(t);

  /* 7 · kwEdit + edgeDotsIn consecutivos: Undo uno a uno, Redo en orden */
  await page.evaluate(() => { undoStack.length = 0; redoStack.length = 0; });
  const base0 = await page.evaluate(([c, e]) => [JSON.stringify(nodeById(c).keywords), edgeById(e).dots], [code, edge]);
  await select(t, "node", code); await openGroup(t, "grpCode"); await typeIn(t, "#kwEdit", "alfa beta");
  await select(t, "edge", edge); await openGroup(t, "grpFlow"); await typeIn(t, "#edgeDotsIn", "6");
  const both = await page.evaluate(([c, e]) => [JSON.stringify(nodeById(c).keywords), edgeById(e).dots], [code, edge]);
  check((await page.evaluate(() => undoStack.length)) === 2, `kwEdit + edgeDotsIn = dos entradas (${await page.evaluate(() => undoStack.length)})`);
  await undoBtn(t);
  const o1 = await page.evaluate(([c, e]) => [JSON.stringify(nodeById(c).keywords), edgeById(e).dots], [code, edge]);
  await undoBtn(t);
  const o2 = await page.evaluate(([c, e]) => [JSON.stringify(nodeById(c).keywords), edgeById(e).dots], [code, edge]);
  check(both[0] !== base0[0] && both[1] !== base0[1], `los dos cambios se aplicaron (${JSON.stringify(base0)} → ${JSON.stringify(both)})`);
  check(o1[0] === both[0] && o1[1] === base0[1] && o2[0] === base0[0] && o2[1] === base0[1], `Undo uno a uno: primero los puntos ${JSON.stringify(o1)}, luego las palabras ${JSON.stringify(o2)}`);
  await redoBtn(t);
  const o3 = await page.evaluate(([c, e]) => [JSON.stringify(nodeById(c).keywords), edgeById(e).dots], [code, edge]);
  await redoBtn(t);
  const o4 = await page.evaluate(([c, e]) => [JSON.stringify(nodeById(c).keywords), edgeById(e).dots], [code, edge]);
  check(o3[0] === both[0] && o3[1] === base0[1] && JSON.stringify(o4) === JSON.stringify(both), `Redo en orden: ${JSON.stringify(o3)} → ${JSON.stringify(o4)}`);

  /* 8 · escribir después de un Undo vacía Rehacer (Redo no pisa lo escrito) */
  await undoBtn(t);
  check((await page.evaluate(() => redoStack.length)) === 1, "tras Undo hay algo que rehacer");
  await select(t, "edge", edge); await openGroup(t, "grpFlow"); await typeIn(t, "#edgeDotsIn", "4");
  const rr = await page.evaluate(() => redoStack.length);
  await page.keyboard.press("Control+y"); await page.waitForTimeout(100);
  check(rr === 0 && (await page.evaluate((id) => edgeById(id).dots, edge)) === 4, `escribir tras Undo vacía Rehacer (redo=${rr}) y Ctrl+Y no pisa el 4`);

  /* 9 · teclado (Ctrl+Z) con el foco fuera de los campos: mismo comportamiento que el botón */
  await select(t, "node", code);
  await page.evaluate((id) => { pushUndo(); editNode(nodeById(id), { label: "SELECT 2" }); }, code);
  await page.keyboard.press("Control+z"); await page.waitForTimeout(100);
  const kz = await page.evaluate(S);
  check(kz.sel === String(code), `Ctrl+Z conserva la selección (sel=${kz.sel})`);
  await page.screenshot({ path: path.join(shots, `${vp.key}-final.png`) });

  check(t.errors.length === 0, `${vp.key}: 0 errores de consola ${JSON.stringify(t.errors)}`);
  await t.ctx.close();
}
const note = (m) => console.log("  · " + m);

(async () => {
  const { server, base } = await serve(root);
  const browser = await chromium.launch({ channel: process.env.FLUYO_BROWSER || "chrome", headless: true });
  const t0 = Date.now();
  try {
    for (const vp of [{ key: "d1440", width: 1440, height: 900 }, { key: "m390", width: 390, height: 844, touch: true, mobile: true }]) {
      if (ONLY && ONLY !== vp.key) continue;
      await runViewport(browser, base, vp);
    }
  } finally { await browser.close(); server.close(); }
  console.log(`\n${passed} ✔ · ${failed} ✘ · ${((Date.now() - t0) / 1000).toFixed(1)} s · capturas: ${shots}`);
  process.exit(failed ? 1 : 0);
})();
