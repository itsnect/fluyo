"use strict";
/* FLUYO-019-HIT-TEST — Mutaciones sobre COPIAS aisladas (nunca sobre el árbol). Cada regresión real del acierto (D1), del puerto
   diferido (D2) o del foco (D7) debe hacer fallar su suite:
   · U*: test/fluyo-019-hit-test.test.cjs (vm, ~5 s).
   · B*: test/fluyo-019-hit-test-browser.cjs en Chrome real, sin la base (SKIP_BASE=1, ~20 s).
   Uso: node test/fluyo-019-hit-test-mutations.cjs   (Playwright vía NODE_PATH; SKIP_BROWSER=1 solo las U; ONLY_MUT=U3 una, ONLY_MUT=B todas las de Chrome) */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const NL = "\n", CRLF = "\r\n";

const UNIT = ["--test", "test/fluyo-019-hit-test.test.cjs"];
const BROWSER = ["test/fluyo-019-hit-test-browser.cjs"];
const INT = "js/interaction.js", GEO = "js/geometry.js", SCN = "js/editor-scenarios.js";
const NODE_FIRST = ["  const n=hitLeafNode(x,y); if(n) return {kind:\"node\", obj:n};", "  const n=hitNode(x,y); if(n) return {kind:\"node\", obj:n};"];   // vuelve «nodo antes que conexión» (el Bug 1)
const TOPMOST = ["(!best || n.w*n.h<best.w*best.h)", "!best"];                                                               // contenedor = el de más arriba, no el más interior
const NO_CONT = ["Math.abs(m.y-n.y)<n.h/2) return true;", "Math.abs(m.y-n.y)<n.h/2) return false;"];                          // nadie es contenedor
const PORT_NOW = ["    connectPending={fromId:host.id, fromSide:arrowSide, p0:{x:p.x,y:p.y}, cx:ev.clientX, cy:ev.clientY, add:ev.shiftKey};", "    connectDrag={fromId:host.id, fromSide:arrowSide};"];   // el puerto vuelve a arrancar en pointerdown
const CLICK_CONNECTS = ["  if(connectPending){ const cp=connectPending; connectPending=null; portClick(cp.p0, cp.add); }", "  if(connectPending){ connectDrag={fromId:connectPending.fromId, fromSide:connectPending.fromSide}; connectPending=null; }"];   // soltar sin moverse conecta
const NO_BLUR = ["  if(a.tagName===\"INPUT\" || a.tagName===\"TEXTAREA\" || a.tagName===\"SELECT\") a.blur();", "  if(a.tagName===\"INPUT\" || a.tagName===\"TEXTAREA\" || a.tagName===\"SELECT\") void 0;"];
const EDITBOX = ["  editing=null; editBox.style.display=\"none\"; editBox.blur();", "  editing=null; editBox.style.display=\"none\";"];
const STORY = ["    if (hitLeafNode(x, y)) return [];", "    if (hitNode(x, y)) return [];"];                                 // Historias: un contenedor vuelve a tapar sus conexiones
const HOVER = ["  else { const t=hitTarget(p.x,p.y); hoverNode=hitSideArrowHost(p.x,p.y) || (t && t.kind===\"node\"? t.obj : null); }", "  else hoverNode=hitSideArrowHost(p.x,p.y) || hitNode(p.x,p.y);"];
const DBL = ["  const t=hitTarget(p.x,p.y), tgt=t && t.obj;", "  const tgt=hitNode(p.x,p.y)||hitEdge(p.x,p.y);"];
/* [nombre, suite, archivo, desde, hasta] */
const MUTATIONS = [
  ["U0 CACHE no sube (sigue v90)", UNIT, "sw.js", 'const CACHE = "fluyo-static-v110";', 'const CACHE = "fluyo-static-v90";'],
  ["U1 vuelve «nodo antes que conexión»", UNIT, INT, ...NODE_FIRST],
  ["U2 contenedor = el de más arriba en Z", UNIT, INT, ...TOPMOST],
  ["U3 nadie es contenedor", UNIT, GEO, ...NO_CONT],
  ["U4 el puerto vuelve a arrancar en pointerdown", UNIT, INT, ...PORT_NOW],
  ["U5 soltar sin moverse conecta", UNIT, INT, ...CLICK_CONNECTS],
  ["U6 sin blur del panel", UNIT, INT, ...NO_BLUR],
  ["U7 closeEditBox no suelta el foco", UNIT, INT, ...EDITBOX],
  ["U8 Historias con hitNode", UNIT, SCN, ...STORY],
  ["U9 hover con hitNode", UNIT, INT, ...HOVER],
  ["U10 doble clic con hitNode ‖ hitEdge", UNIT, INT, ...DBL],
  ["B1 vuelve «nodo antes que conexión»", BROWSER, INT, ...NODE_FIRST],
  ["B2 contenedor = el de más arriba en Z", BROWSER, INT, ...TOPMOST],
  ["B3 nadie es contenedor", BROWSER, GEO, ...NO_CONT],
  ["B4 el puerto vuelve a arrancar en pointerdown", BROWSER, INT, ...PORT_NOW],
  ["B5 soltar sin moverse conecta", BROWSER, INT, ...CLICK_CONNECTS],
  ["B6 sin blur del panel", BROWSER, INT, ...NO_BLUR],
  ["B7 closeEditBox no suelta el foco", BROWSER, INT, ...EDITBOX],
  ["B8 Historias con hitNode", BROWSER, SCN, ...STORY],
  ["B9 doble clic con hitNode ‖ hitEdge", BROWSER, INT, ...DBL],
];

function copyTree(dest) {
  for (const entry of fs.readdirSync(root).filter((e) => e !== ".git")) {
    const from = path.join(root, entry);
    if (fs.existsSync(from)) fs.cpSync(from, path.join(dest, entry), { recursive: true });
  }
}
function runSuite(dir, args) {
  const browser = args === BROWSER;
  const r = spawnSync(process.execPath, args, { cwd: dir, encoding: "utf8", timeout: browser ? 600000 : 180000,
    env: { ...process.env, FLUYO_GIT_ROOT: root, FLUYO_ROOT: dir, ...(browser ? { SKIP_BASE: "1" } : {}) } });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

const t0 = Date.now();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-hit-test-mut-"));
const list = MUTATIONS.filter((m) => !(process.env.SKIP_BROWSER && m[1] === BROWSER)).filter((m) => { const o = process.env.ONLY_MUT; if (!o) return true; const id = m[0].split(" ")[0]; return id === o || (/^[UB]$/.test(o) && id[0] === o); });
let failed = 0;
try {
  const base = path.join(tmp, "base"); fs.mkdirSync(base); copyTree(base);
  const suites = [UNIT, ...(list.some((m) => m[1] === BROWSER) ? [BROWSER] : [])];
  for (const args of suites) {
    const sane = runSuite(base, args);
    if (sane.code !== 0) { console.error("La copia sin mutar NO pasa " + args.join(" ") + ":\n" + sane.out.slice(-2000)); process.exit(2); }
  }
  console.log("copia sin mutar: suites OK (0/" + list.length + " mutaciones aplicadas)");
  list.forEach(([name, args, file, from, to], i) => {
    const dir = path.join(tmp, "m" + i); fs.mkdirSync(dir); copyTree(dir);
    const p = path.join(dir, file);
    const src = fs.readFileSync(p, "utf8"), crlf = src.includes(CRLF);
    const text = src.replaceAll(CRLF, NL);
    if (!text.includes(from)) { console.log("  ✘ " + name + " — el patrón no existe (mutación obsoleta)"); failed++; return; }
    fs.writeFileSync(p, text.replace(from, () => to).replaceAll(NL, crlf ? CRLF : NL));
    const r = runSuite(dir, args);
    if (r.code !== 0) console.log("  ✔ " + name + " — la suite falla, como debe");
    else { console.log("  ✘ " + name + " — la suite SIGUE PASANDO"); failed++; }
    fs.rmSync(dir, { recursive: true, force: true });
  });
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }
console.log(`\n${list.length - failed}/${list.length} mutaciones detectadas (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
process.exit(failed ? 1 : 0);
