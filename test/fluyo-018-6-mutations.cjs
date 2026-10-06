"use strict";
/* FLUYO-018.6 — Mutaciones sobre COPIAS aisladas (nunca sobre el árbol): cada defecto plausible de las reglas de entrada de 018.6
   (fill:"none" y colores de conexión) debe hacer fallar test/fluyo-018-6.test.cjs (o las suites previas que fijan el contrato).
   Uso: node test/fluyo-018-6-mutations.cjs */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const NL = "\n", CRLF = "\r\n";
const AUTH = "js/story-authoring.js";
const FILL_NONE = 'if(k==="fill" && v==="none") continue;';
const EDGE_MSG = '`«${k}» debe ser un color HEX (#rgb, #rrggbb o #rrggbbaa) o null';
const EDGE_CHECK = 'if(typeof v!=="string" || !HEX_COLOR.test(v)) throw invalidField(k, ' + EDGE_MSG;

const MUTATIONS = [
  // ── fill:"none"
  ["F1 fill:\"none\" vuelve a rechazarse", AUTH, FILL_NONE, "if(false) continue;"],
  ["F2 «none» se acepta en cualquier campo de color", AUTH, FILL_NONE, 'if(v==="none") continue;'],
  ["F3 «none» se acepta sin distinguir mayúsculas ni espacios", AUTH, FILL_NONE, 'if(k==="fill" && typeof v==="string" && v.trim().toLowerCase()==="none") continue;'],
  ["F4 fill acepta cualquier cadena", AUTH, FILL_NONE, 'if(k==="fill" && typeof v==="string") continue;'],
  ["F5 el mensaje de fill no menciona none", AUTH, '${k==="fill" ? \' o "none" (sin relleno)\' : ""}', ""],
  // ── colores de conexión
  ["C1 create_connection no valida los colores", AUTH, "      edgeInputRules(spec);\n", ""],
  ["C2 update_connection no valida los colores", AUTH, "      edgeInputRules(patch);\n", ""],
  ["C3 lineColor no se valida", AUTH, 'const EDGE_COLOR_FIELDS = ["lineColor","dotColor"];', 'const EDGE_COLOR_FIELDS = ["dotColor"];'],
  ["C4 dotColor no se valida", AUTH, 'const EDGE_COLOR_FIELDS = ["lineColor","dotColor"];', 'const EDGE_COLOR_FIELDS = ["lineColor"];'],
  ["C5 null se rechaza", AUTH, "      if(v===undefined || v===null) continue;\n      " + EDGE_CHECK, "      if(v===undefined) continue;\n      " + EDGE_CHECK],
  ["C6 los colores de conexión son retroactivos (se validan aunque no se escriban)", AUTH, "      const v = spec[k];\n      if(v===undefined || v===null) continue;", '      const v = spec[k]===undefined ? "#" : spec[k];\n      if(v===undefined || v===null) continue;'],
  ["C7 el error de color de conexión pierde el campo", AUTH, "throw invalidField(k, " + EDGE_MSG, 'throw invalidField("lineColor", ' + EDGE_MSG],
  ["C8 los colores de conexión admiten nombres (cualquier cadena)", AUTH, EDGE_CHECK, 'if(typeof v!=="string") throw invalidField(k, ' + EDGE_MSG],
  ["C9 el HEX de conexión usa una regex laxa", AUTH, EDGE_CHECK, 'if(typeof v!=="string" || !/#[0-9a-f]{3}/i.test(v)) throw invalidField(k, ' + EDGE_MSG],
  ["C10 la regla de conexión solo comprueba el tipo, no el formato", AUTH, EDGE_CHECK, 'if(typeof v==="number") throw invalidField(k, ' + EDGE_MSG],
  ["C11 update_connection aplica la regla de color DESPUÉS del dominio (orden de errores)", AUTH, "      edgeInputRules(patch);\n      let e;\n      try{ e = updateConnectionIn(pg, id, patch); }\n      catch(err){ throw fromDiagramDomain(err, op, ctx, id); }", "      let e;\n      try{ e = updateConnectionIn(pg, id, patch); }\n      catch(err){ throw fromDiagramDomain(err, op, ctx, id); }\n      edgeInputRules(patch);"],
  // ── la regla de nodo no regresiona
  ["N1 los colores de nodo dejan de validarse", AUTH, 'const NODE_COLOR_FIELDS = ["color","fill","textBg","textColor","kwBg","kwColor"];', "const NODE_COLOR_FIELDS = [];"],
];

function copyTree(dest) {
  for (const entry of ["js", "css", "s", "ejemplos/data", "index.html", "sw.js", "manifest.webmanifest", "test"]) {
    const from = path.join(root, entry);
    if (fs.existsSync(from)) fs.mkdirSync(path.dirname(path.join(dest, entry)), { recursive: true }), fs.cpSync(from, path.join(dest, entry), { recursive: true });
  }
}
function runSuite(dir) {
  const r = spawnSync(process.execPath, ["--test", "test/fluyo-018-6.test.cjs", "test/fluyo-018-5.test.cjs", "test/fluyo-018-3.test.cjs", "test/fluyo-018-2.test.cjs", "test/fluyo-017-2.test.cjs", "test/fluyo-017-2-qa.test.cjs"], { cwd: dir, encoding: "utf8", timeout: 180000 });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-018-6-mut-"));
let failed = 0;
try {
  const base = path.join(tmp, "base"); fs.mkdirSync(base); copyTree(base);
  const sane = runSuite(base);
  if (sane.code !== 0) { console.error("La copia sin mutar NO pasa la suite:\n" + sane.out.slice(-1500)); process.exit(2); }
  console.log("copia sin mutar: suite OK (0/" + MUTATIONS.length + " mutaciones aplicadas)");
  MUTATIONS.forEach(([name, file, from, to], i) => {
    const dir = path.join(tmp, "m" + i); fs.mkdirSync(dir); copyTree(dir);
    const p = path.join(dir, file);
    const src = fs.readFileSync(p, "utf8"), crlf = src.includes(CRLF);
    const text = src.replaceAll(CRLF, NL);
    if (!text.includes(from)) { console.log("  ✘ " + name + " — el patrón no existe (mutación obsoleta)"); failed++; return; }
    fs.writeFileSync(p, (text.replace(from, () => to)).replaceAll(NL, crlf ? CRLF : NL));
    const r = runSuite(dir);
    const killed = r.code !== 0;
    const n = (r.out.match(/^not ok /gm) || []).length;
    console.log((killed ? "  ✔ detectada  " : "  ✘ SOBREVIVE  ") + name + (killed ? "  (" + n + " tests fallan)" : ""));
    if (!killed) failed++;
    fs.rmSync(dir, { recursive: true, force: true });
  });
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(failed ? "\nFLUYO-018.6 mutaciones: " + failed + " sin detectar" : "\nFLUYO-018.6 mutaciones: " + MUTATIONS.length + "/" + MUTATIONS.length + " detectadas");
process.exit(failed ? 1 : 0);
