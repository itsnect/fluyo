"use strict";
/* FLUYO-019.4a — Mutaciones sobre COPIAS aisladas (nunca sobre el árbol). Cada regresión real del aterrizaje por silueta, de la
   pelota única o un cambio colado en el plano debe hacer fallar su suite:
   · U*: test/fluyo-019-4a.test.cjs (vm, ~3 s).
   · B*: test/fluyo-019-4a-browser.cjs en Chrome real, con la base (~35 s).
   Uso: node test/fluyo-019-4a-mutations.cjs   (Playwright vía NODE_PATH; SKIP_BROWSER=1 solo las U; ONLY_MUT=U3 una, ONLY_MUT=B todas las de Chrome) */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const NL = "\n", CRLF = "\r\n";

const UNIT = ["--test", "test/fluyo-019-4a.test.cjs"];
const BROWSER = ["test/fluyo-019-4a-browser.cjs"];
const SKIN = "js/skin.js", REN = "js/render.js", EXP = "js/export.js";
const MOVE = "  z.x+=u.x*t; z.y+=u.y*t;\n  return out;";
const GUARD_T = "  if(t<=1e-6 || t>L-1) return out;";
const GUARD_IN = "  if(Math.abs(p.x-a.x)<a.w/2-SKIN_EPS && Math.abs(p.y-a.y)<a.h/2-SKIN_EPS) return out;   /* llega desde dentro */\n";
const CANVAS = '  if(rs.skinOn && typeof skinEdgeLanding==="function") pts=skinEdgeLanding(pts, B);';
const SVG = '  if(skinOn && typeof skinEdgeLanding==="function") pts=skinEdgeLanding(pts, B);';
const BALL = "      const p=pointAt(painted(seg), s/seg.L);";
/* [nombre, suite, archivo, desde, hasta] */
const MUTATIONS = [
  ["U0 CACHE no sube (sigue v92)", UNIT, "sw.js", 'const CACHE = "fluyo-static-v94";', 'const CACHE = "fluyo-static-v92";'],
  ["U1 el penúltimo acompaña (vuelve la inclinación de F2)", UNIT, SKIN, MOVE, "  z.x+=u.x*t; z.y+=u.y*t; p.x+=SKIN_DEPTH/2;\n  return out;"],
  ["U2 la punta solo retrocede media silueta", UNIT, SKIN, MOVE, "  z.x+=u.x*t/2; z.y+=u.y*t/2;\n  return out;"],
  ["U3 aterriza también sin silueta (desplazamiento fijo, F3)", UNIT, SKIN, GUARD_T, "  if(t<=1e-6) t=SKIN_DEPTH/2;\n  if(t>L-1) return out;"],
  ["U4 sin la guarda «llega desde dentro»", UNIT, SKIN, GUARD_IN, ""],
  ["U5 sin la guarda t* > L − 1", UNIT, SKIN, GUARD_T, "  if(t<=1e-6) return out;"],
  ["U6 el recorte (clip) de una capa no se aplica", UNIT, SKIN, "  if(!layer.clip) return a;", "  return a;"],
  ["U7 un arco acepta los cortes de su mitad opuesta", UNIT, SKIN, "d=mod(o.ccw? o.a0-th : th-o.a0);", "d=mod(o.ccw? th-o.a0 : o.a0-th);"],
  ["U8 la clave de la memo no lleva el último tramo", UNIT, SKIN, '+"|"+z.x+"|"+z.y+"|"+p.x+"|"+p.y;', '+"|"+z.x+"|"+z.y;'],
  ["U9 la clave de la memo no lleva la caja del destino", UNIT, SKIN, 'const key=B.shape+"|"+B.x+"|"+B.y+"|"+B.w+"|"+B.h+"|"', 'const key=B.shape+"|"+B.y+"|"+B.h+"|"'],
  ["U14 la memo crece sin límite", UNIT, SKIN, "    if(SKIN_LANDING_T.size>=SKIN_LANDING_MEMO) SKIN_LANDING_T.clear();\n", ""],
  ["U10 la pelota va por la ruta lógica (vuelve F13)", UNIT, REN, BALL, "      const p=pointAt(seg.pts, s/seg.L);"],
  ["U11 la α de la pelota con la longitud pintada", UNIT, REN, "      const fade=flowBallFade(s, seg.L);", "      const fade=flowBallFade(s, polyLen(painted(seg)));"],
  ["U12 la pelota aterriza también sin piel", UNIT, REN, '  const landed=rs && rs.skinOn && typeof skinEdgeLanding==="function" ? new Map() : null;', '  const landed=rs && typeof skinEdgeLanding==="function" ? new Map() : null;'],
  ["U13 la pelota usa la regla de antes (con el lado)", UNIT, REN, "landed.set(seg.e.id, skinEdgeLanding(seg.pts, nodeById(seg.e.to)));", 'landed.set(seg.e.id, skinEdgeLanding(seg.pts, "n"));'],
  ["B1 el lienzo no aterriza", BROWSER, REN, CANVAS, "  if(rs.skinOn && typeof skinEdgeLanding===\"function\") pts=pts.map(p=>({x:p.x,y:p.y}));"],
  ["B2 el lienzo aterriza también en plano", BROWSER, REN, CANVAS, '  if(typeof skinEdgeLanding==="function") pts=skinEdgeLanding(pts, B);'],
  ["B3 el SVG no aterriza", BROWSER, EXP, SVG, "  if(skinOn && typeof skinEdgeLanding===\"function\") pts=pts.map(p=>({x:p.x,y:p.y}));"],
  ["B4 la pelota va por la ruta lógica (vuelve F13)", BROWSER, REN, BALL, "      const p=pointAt(seg.pts, s/seg.L);"],
  ["B5 aterriza también sin silueta (desplazamiento fijo, F3)", BROWSER, SKIN, GUARD_T, "  if(t<=1e-6) t=SKIN_DEPTH/2;\n  if(t>L-1) return out;"],
  ["B6 la punta solo retrocede media silueta", BROWSER, SKIN, MOVE, "  z.x+=u.x*t/2; z.y+=u.y*t/2;\n  return out;"],
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
    env: { ...process.env, FLUYO_GIT_ROOT: root, FLUYO_ROOT: dir } });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

const t0 = Date.now();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-4a-mut-"));
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
