"use strict";
/* FLUYO-019-FLOW-FADE — «Una pelota por ruta» en Chrome real: editor, Present, Viewer (share) y Present del Viewer, con el reloj
   del producto congelado (playing = false; pausedAt = t) y el fotograma pintado por su propio bucle rAF. Se sirven dos árboles:
   el de trabajo y el de 266ac09 (antes del arreglo).
   · OFF (single:false): el lienzo COMPLETO es idéntico píxel a píxel al de 266ac09 en todas las variantes y superficies.
   · ON: cada pelota pintada (arc r = 7 de drawFlowBalls) tiene α = la regla escrita aquí sobre la conexión en la que está
     (W = min(35, L/2), distancia local); en 266ac09 las variantes con algo que sale de B no la cumplen.
   · ON, llegada a B (la central, id 10): con el reloj puesto para que la pelota esté a 0,5 / 2 / 5 / 10 / 20 / 30 / 37 px del
     ancla, α y px Δ (lienzo frente al mismo fotograma sin flujo, banda de ±8 px) — V1a/V4/V6 dejan de llegar opacas.
   · ON, caso sano (V0, V2a, V2b, REV): lienzo idéntico píxel a píxel a 266ac09.
   · Exportación (render con export:true, el camino del GIF): mismo α que el lienzo.
   · 0 errores de página.
   Uso: node test/fluyo-019-flow-fade-browser.cjs   (Playwright vía NODE_PATH; FLUYO_BROWSER=chrome; FLUYO_QUICK=1 = V0/V1a/V4/V5) */
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("playwright-core")); }
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http");
const { execFileSync } = require("node:child_process");
const root = path.resolve(process.env.FLUYO_ROOT || path.join(__dirname, ".."));
const BEFORE = "266ac09";
const QUICK = !!process.env.FLUYO_QUICK;
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
function treeAt(rev) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-flow-fade-")), tar = path.join(dir, "t.tar");
  execFileSync("git", ["-C", process.env.FLUYO_GIT_ROOT || root, "archive", rev, "-o", tar]);
  execFileSync("tar", ["-xf", "t.tar"], { cwd: dir });
  fs.unlinkSync(tar);
  return dir;
}
let failed = 0, passed = 0;
const check = (cond, msg) => { if (cond) { passed++; console.log("  ✔ " + msg); } else { failed++; console.log("  ✘ " + msg); } };

/* ── variantes (las de la auditoría, §3.3) ── */
const N = (id, x, y) => ({ id, shape: "rect", x, y, w: 160, h: 70, label: "N" + id, color: "#6a9fb5" });
const E = (id, from, to, ex) => Object.assign({ id, from, to, route: "straight", animated: true, flowDir: "normal", endArrow: true }, ex || {});
const AB = () => [N(1, 200, 300), N(2, 640, 300)], ABC = () => [N(1, 200, 300), N(2, 640, 300), N(3, 640, 110)];
const ORTHO_N = { route: "ortho", fromSide: "n", toSide: "n" };
const ALL = [
  ["V0", "central sola", AB(), [E(10, 1, 2)], { same: true }],
  ["V1a", "+ inversa B→A añadida después", AB(), [E(10, 1, 2), E(15, 2, 1)], { leaves: true }],
  ["V1b", "+ inversa B→A que ya estaba (arriba)", AB(), [E(5, 2, 1), E(10, 1, 2)], { longer: true }],
  ["V2a", "+ A→B paralela añadida después", AB(), [E(10, 1, 2), E(15, 1, 2)], { same: true }],
  ["V2b", "+ A→B paralela que ya estaba (arriba)", AB(), [E(5, 1, 2), E(10, 1, 2)], { same: true }],
  ["V3", "+ C→B entra en B desde arriba", ABC(), [E(10, 1, 2), E(15, 3, 2)], {}],
  ["V4", "+ B→C sale de B hacia arriba", ABC(), [E(10, 1, 2), E(15, 2, 3)], { leaves: true }],
  ["V5", "+ A→B por arriba (ortho n→n)", AB(), [E(10, 1, 2), E(15, 1, 2, ORTHO_N)], { longer: true }],
  ["V6", "+ B→A por arriba (ortho n→n, retorno)", AB(), [E(10, 1, 2), E(15, 2, 1, ORTHO_N)], { leaves: true }],
  ["V7", "+ A→C hacia arriba (rama del mismo origen)", ABC(), [E(10, 1, 2), E(15, 1, 3)], {}],
  ["RING", "anillo A→B→C→D→A", [N(1, 200, 300), N(2, 640, 300), N(3, 640, 560), N(4, 200, 560)], [E(10, 1, 2), E(11, 2, 3), E(12, 3, 4), E(13, 4, 1)], { leaves: true }],
  ["REV", "flowDir reverse (D4 fuera)", AB(), [E(10, 1, 2, { flowDir: "reverse" })], { same: true }],
];
const ONLY = process.env.FLUYO_ONLY ? process.env.FLUYO_ONLY.split(",") : null;   // p. ej. FLUYO_ONLY=V2a,V4
const VARIANTS = ONLY ? ALL.filter((v) => ONLY.includes(v[0])) : QUICK ? ALL.filter((v) => ["V0", "V1a", "V4", "V5"].includes(v[0])) : ALL;
const docOf = (nodes, edges, single) => ({ version: 5, app: "fluyo", settings: { grid: false, single, speed: 0.5, dots: 3 },
  doc: { theme: "crema", customBg: "", eventTypes: [], nextEventTypeId: 1, cur: 0, pages: [{ name: "P", behaviors: [], scenarios: [], nextScenarioId: 1, nextId: 90, nodes, edges }] } });
const TO_END = [0.5, 2, 5, 10, 20, 30, 37];

/* Se inyecta en el editor y en el Viewer (los dos cargan render.js/geometry.js como scripts clásicos) */
const INSTALL = () => {
  if (window.__ff) return;
  const log = []; let cur = null;
  const ob = window.drawFlowBalls; window.drawFlowBalls = function () { cur = "ball"; try { return ob.apply(this, arguments); } finally { cur = null; } };
  const arc = CanvasRenderingContext2D.prototype.arc;
  CanvasRenderingContext2D.prototype.arc = function (x, y, r) { if (window.__ffOn && cur === "ball" && r === 7) log.push({ x, y, ga: this.globalAlpha }); return arc.apply(this, arguments); };
  const raf2 = () => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
  const freeze = (t) => { playing = false; pausedAt = t; };
  const rule = (s, L) => Math.min(1, Math.max(0, Math.min(s, L - s) / Math.min(35, L / 2)));
  const project = (pts, p) => { let best = { dd: 1e9, s: 0 }, acc = 0;
    for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy, l = Math.sqrt(l2);
      const w = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0, dd = Math.hypot(a.x + dx * w - p.x, a.y + dy * w - p.y);
      if (dd < best.dd - 1e-9) best = { dd, s: acc + w * l }; acc += l; } return best; };
  window.__ff = {
    /* surf: {canvas, ctx, view(): {x,y,zoom}} */
    async hash(surf) { const d = surf.ctx.getImageData(0, 0, surf.canvas.width, surf.canvas.height).data;
      const h = await crypto.subtle.digest("SHA-256", d.buffer); return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join(""); },
    async hashes(surf, times) { const out = []; for (const t of times) { freeze(t); await raf2(); out.push(await this.hash(surf)); } return out; },
    /* ON: (1) cada pelota pintada en un barrido del periodo cumple la regla; (2) llegada a B en distancias dadas, con α y px Δ */
    async on(surf, frames, toEnd) {
      const edges = P().edges.map((e) => ({ id: e.id, pts: edgePoints(e) })).map((e) => ({ ...e, L: polyLen(e.pts) }));
      const period = 1 / settings.speed;
      log.length = 0; window.__ffOn = true;
      for (let k = 0; k < frames; k++) { freeze(period * k / frames); await raf2(); }
      window.__ffOn = false;
      const bad = []; let seen = 0;
      for (const b of log) {
        const cands = edges.map((e) => ({ id: e.id, L: e.L, ...project(e.pts, b) })).filter((c) => c.dd < 0.01);
        seen++;
        if (!cands.some((c) => Math.abs(b.ga - rule(c.s, c.L)) < 1e-6)) bad.push(`(${b.x.toFixed(1)},${b.y.toFixed(1)}) α ${b.ga.toFixed(3)} ≠ ${cands.map((c) => "e" + c.id + ":" + rule(c.s, c.L).toFixed(3)).join("/") || "fuera de ruta"}`);
      }
      /* llegada a B: el reloj se pone para que la pelota de la central esté a toEnd px de su ancla de llegada */
      const c10 = edges.find((e) => e.id === 10), z = c10.pts[c10.pts.length - 1], y0 = c10.pts[c10.pts.length - 2];
      const Lu = Math.hypot(z.x - y0.x, z.y - y0.y), u = { x: (z.x - y0.x) / Lu, y: (z.y - y0.y) / Lu }, nrm = { x: -u.y, y: u.x };
      const v = surf.view(), dpr = surf.canvas.width / surf.canvas.getBoundingClientRect().width;
      const grab = () => { const out = []; for (let s = 0; s <= 40; s++) { const row = []; for (let o = -8; o <= 8; o++) { const wx = z.x - u.x * s + nrm.x * o, wy = z.y - u.y * s + nrm.y * o;
        const d = surf.ctx.getImageData(Math.round((v.x + wx * v.zoom) * dpr), Math.round((v.y + wy * v.zoom) * dpr), 1, 1).data; row.push([d[0], d[1], d[2]]); } out.push(row); } return out; };
      const anim = P().edges.map((x) => x.animated), sg = settings.single;
      P().edges.forEach((x) => x.animated = false); settings.single = false; freeze(0); await raf2(); const ref = grab();
      P().edges.forEach((x, i) => x.animated = anim[i]); settings.single = sg;
      const times = [], cache = new Map();
      for (const paths of flowGroups()) { const geos = paths.map((pt) => pathGeometry(pt, cache)).filter((g) => g.total > 0); if (!geos.length) continue;
        const D = Math.max(...geos.map((g) => g.total));
        for (const g of geos) for (const s of g.segs) if (s.e.id === 10) for (const te of toEnd) times.push({ te, t: (s.start + s.L - te) / D / settings.speed }); }
      const arrive = [];
      for (const { te, t } of times) {
        log.length = 0; window.__ffOn = true; freeze(t); await raf2(); window.__ffOn = false;
        const on10 = log.map((b) => ({ ga: b.ga, p: project(c10.pts, b) })).filter((b) => b.p.dd < 0.01 && Math.abs(c10.L - b.p.s - te) < 0.05);
        if (!on10.length) continue;
        const g = grab(); let px = 0;
        const lo = Math.max(0, Math.floor(te) - 2), hi = Math.min(40, Math.ceil(te) + 2);
        for (let s = lo; s <= hi; s++) g[s].forEach((p, j) => { const r = ref[s][j]; px = Math.max(px, (Math.abs(p[0] - r[0]) + Math.abs(p[1] - r[1]) + Math.abs(p[2] - r[2])) / 3); });
        arrive.push({ te, ga: Math.max(...on10.map((b) => b.ga)), px: Math.round(px) });
      }
      freeze(0);
      return { seen, bad, arrive };
    },
    /* el camino del GIF: render(oc, t, {export:true}) en un lienzo aparte, α de las pelotas frente a la regla */
    exportCheck(times) {
      const edges = P().edges.map((e) => ({ id: e.id, pts: edgePoints(e) })).map((e) => ({ ...e, L: polyLen(e.pts) }));
      const b = getBounds(), off = document.createElement("canvas"); off.width = Math.round(b.w); off.height = Math.round(b.h);
      let seen = 0; const bad = [];
      for (const t of times) { const oc = off.getContext("2d"); oc.setTransform(1, 0, 0, 1, 0, 0); oc.translate(-b.x, -b.y);
        log.length = 0; window.__ffOn = true;
        render(oc, t, { export: true, bounds: b, renderState: makeReadOnlyRenderState({ width: off.width, height: off.height }) });
        window.__ffOn = false;
        for (const p of log) { seen++; const c = edges.map((e) => ({ L: e.L, ...project(e.pts, p) })).filter((c) => c.dd < 0.01);
          if (!c.some((c) => Math.abs(p.ga - rule(c.s, c.L)) < 1e-6)) bad.push(`t=${t.toFixed(3)} α ${p.ga.toFixed(3)}`); } }
      return { seen, bad };
    },
  };
};
const EDITOR_SURF = "() => ({ canvas: cv, ctx, view: () => { const v = buildEditorRenderState().viewport; return { x: v.x, y: v.y, zoom: v.zoom }; } })";
const VIEWER_SURF = "() => ({ canvas: sv, ctx: sctx, view: () => ({ x: __viewer.view.x, y: __viewer.view.y, zoom: __viewer.view.zoom }) })";
const OFF_TIMES = Array.from({ length: 12 }, (_, k) => 0.037 + k * 0.161);   // ~2 s, sin caer en múltiplos del periodo de los puntos

async function openEditor(browser, base, errors, tag) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block", deviceScaleFactor: 1 });
  await ctx.route((u) => !u.href.startsWith(base), (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(tag + " pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(tag + " console: " + m.text()); });
  page.on("dialog", (d) => d.accept());
  await page.goto(base + "/"); await page.waitForFunction(() => typeof applyProjectData === "function" && typeof cv !== "undefined");
  for (const id of ["#autosaveDiscard", "#incomingOpen"]) if (await page.locator(id).isVisible().catch(() => false)) await page.locator(id).click();
  await page.evaluate(INSTALL);
  return { ctx, page };
}
/* las superficies de un documento: editor, Present (editor), Viewer y Present del Viewer. fn(surfName, page, surfExpr) */
async function surfaces(ed, base, data, errors, tag, fn) {
  await ed.page.evaluate((d) => { applyProjectData(d); viewZoom = 1; viewX = 40; viewY = 40; }, data);
  await ed.page.evaluate(() => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))));
  const out = {};
  out.editor = await fn(ed.page, EDITOR_SURF);
  await ed.page.evaluate(async () => { enterPresent(); await new Promise((ok) => setTimeout(ok, 400)); });
  out.present = await fn(ed.page, EDITOR_SURF);
  await ed.page.evaluate(() => exitPresent());
  const payload = await ed.page.evaluate(async () => new URL(await createShareUrl(serializeProject(), location.href, { kind: "diagram" })).hash.slice(3));
  const v = await ed.ctx.newPage();
  v.on("pageerror", (e) => errors.push(tag + " viewer pageerror: " + e.message));
  v.on("console", (m) => { if (m.type() === "error") errors.push(tag + " viewer console: " + m.text()); });
  await v.goto(base + "/s/#d=" + payload);
  await v.waitForFunction(() => window.__viewer && window.__viewer.phase === "ready", null, { timeout: 15000 }).catch(() => {});
  if ((await v.evaluate(() => window.__viewer && window.__viewer.phase)) !== "ready") { errors.push(tag + " viewer: no abre"); await v.close(); return out; }
  await v.evaluate(INSTALL);
  out.single = await v.evaluate(() => !!settings.single);
  out.viewer = await fn(v, VIEWER_SURF);
  await v.evaluate(async () => { enterPresent(); await new Promise((ok) => setTimeout(ok, 400)); });
  out.vpresent = await fn(v, VIEWER_SURF);
  await v.close();
  return out;
}
const SURFS = ["editor", "present", "viewer", "vpresent"];
const SURF_NAME = { editor: "editor", present: "Present", viewer: "Viewer", vpresent: "Present del Viewer" };

async function main() {
  const t0 = Date.now();
  const old = treeAt(BEFORE);
  const { server, base } = await serve(root), { server: serverOld, base: baseOld } = await serve(old);
  const browser = await chromium.launch({ channel: process.env.FLUYO_BROWSER || "chrome", headless: !process.env.HEADED });
  const errors = [], table = [];
  try {
    const ed = await openEditor(browser, base, errors, "nuevo"), edOld = await openEditor(browser, baseOld, errors, BEFORE);
    for (const [k, name, nodes, edges, flags] of VARIANTS) {
      console.log(`\n── ${k} · ${name}`);
      /* OFF: el lienzo completo, idéntico a 266ac09 */
      const hashes = (p, surf) => p.evaluate(([s, ts]) => __ff.hashes(eval("(" + s + ")")(), ts), [surf, OFF_TIMES]);
      const offNew = await surfaces(ed, base, docOf(nodes, edges, false), errors, k, hashes);
      const offOld = await surfaces(edOld, baseOld, docOf(nodes, edges, false), errors, k + "@" + BEFORE, hashes);
      for (const s of SURFS) check(offNew[s] && offOld[s] && offNew[s].join() === offOld[s].join(), `${k} OFF · ${SURF_NAME[s]}: ${OFF_TIMES.length} fotogramas idénticos píxel a píxel a ${BEFORE}`);
      check(offNew.single === false, `${k} OFF: el Viewer recibe settings.single = false`);
      /* ON */
      const on = (p, surf) => p.evaluate(([s, te]) => __ff.on(eval("(" + s + ")")(), 120, te), [surf, TO_END]);
      const onNew = await surfaces(ed, base, docOf(nodes, edges, true), errors, k, on);
      const onOld = await surfaces(edOld, baseOld, docOf(nodes, edges, true), errors, k + "@" + BEFORE, on);
      check(onNew.single === true, `${k} ON: el Viewer recibe settings.single = true`);
      for (const s of SURFS) {
        const r = onNew[s], o = onOld[s]; if (!r) { check(false, `${k} ON · ${SURF_NAME[s]}: sin datos`); continue; }
        check(r.seen > 60 && r.bad.length === 0, `${k} ON · ${SURF_NAME[s]}: ${r.seen} pelotas, todas con α = regla por conexión${r.bad.length ? " — " + r.bad.slice(0, 3).join(" · ") : ""}`);
        if (flags.leaves) check(o && o.bad.length > 0, `${k} ON · ${SURF_NAME[s]}: en ${BEFORE} no se cumplía (${o ? o.bad.length : "?"} pelotas fuera de la regla)`);
        const a = Object.fromEntries(r.arrive.map((x) => [x.te, x])), ao = Object.fromEntries((o ? o.arrive : []).map((x) => [x.te, x]));
        const okArr = TO_END.every((te) => a[te]) && a[0.5].ga <= 0.5 / 35 + 1e-6 && a[2].ga <= 2 / 35 + 1e-6 && a[10].ga <= 10 / 35 + 1e-6 && a[37].ga === 1;
        check(okArr, `${k} ON · ${SURF_NAME[s]}: llegada a B α ${TO_END.map((te) => a[te] ? a[te].ga.toFixed(2) : "—").join(" / ")} (a ${TO_END.join("/")} px)`);
        table.push({ k, s, now: TO_END.map((te) => a[te] ? `${a[te].ga.toFixed(2)}·${a[te].px}` : "—"), old: TO_END.map((te) => ao[te] ? `${ao[te].ga.toFixed(2)}·${ao[te].px}` : "—") });
        if (flags.leaves) check(ao[0.5] && ao[0.5].ga === 1 && a[0.5].px + 20 < ao[0.5].px, `${k} ON · ${SURF_NAME[s]}: a 0,5 px de B, px Δ ${ao[0.5] && ao[0.5].px} (${BEFORE}, α 1) → ${a[0.5].px}`);
        if (flags.longer) check(ao[37] && ao[37].ga < 0.7, `${k} ON · ${SURF_NAME[s]}: en ${BEFORE} a 37 px de B la pelota aún no se veía entera (α ${ao[37] && ao[37].ga.toFixed(2)}); ahora 1`);
      }
      if (flags.same) {
        const same = (p, surf) => p.evaluate(([s, ts]) => __ff.hashes(eval("(" + s + ")")(), ts), [surf, OFF_TIMES]);
        const sn = await surfaces(ed, base, docOf(nodes, edges, true), errors, k, same), so = await surfaces(edOld, baseOld, docOf(nodes, edges, true), errors, k + "@" + BEFORE, same);
        for (const s of SURFS) { const diff = sn[s] && so[s] ? OFF_TIMES.map((t, i) => sn[s][i] === so[s][i] ? null : t.toFixed(3)).filter(Boolean) : ["sin datos"];
          check(diff.length === 0, `${k} ON (caso sano) · ${SURF_NAME[s]}: idéntico píxel a píxel a ${BEFORE}${diff.length ? " — distinto en t = " + diff.join(", ") : ""}`); }
      }
      /* el camino de exportación (GIF) */
      await ed.page.evaluate((d) => applyProjectData(d), docOf(nodes, edges, true));
      const ex = await ed.page.evaluate(() => __ff.exportCheck(Array.from({ length: 80 }, (_, i) => i * 2 / 80)));
      check(ex.seen > 40 && ex.bad.length === 0, `${k} ON · exportación (render export:true, GIF): ${ex.seen} pelotas con α = regla${ex.bad.length ? " — " + ex.bad.slice(0, 3).join(" · ") : ""}`);
    }
    check(errors.length === 0, `0 errores de página (${errors.slice(0, 3).join(" | ")})`);
    await ed.ctx.close(); await edOld.ctx.close();
  } finally { await browser.close(); server.close(); serverOld.close(); fs.rmSync(old, { recursive: true, force: true }); }
  console.log("\nLlegada a B (ON), α·pxΔ a " + TO_END.join(" / ") + " px — ahora | " + BEFORE);
  for (const r of table) console.log(`  ${r.k.padEnd(4)} ${SURF_NAME[r.s].padEnd(18)} ${r.now.join("  ")}  |  ${r.old.join("  ")}`);
  console.log(`\nFLUYO-019-FLOW-FADE browser: ${passed} ✔ · ${failed} ✘ · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
