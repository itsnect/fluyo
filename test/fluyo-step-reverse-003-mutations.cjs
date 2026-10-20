"use strict";
/* FLUYO-STEP-REVERSE-003 — Mutaciones sobre COPIAS aisladas (nunca sobre el árbol). Cada regresión real de «Invertir sentido»
   (menú, acción, Undo, texto y «Cambiar dónde ocurre») debe hacer fallar test/fluyo-step-reverse-003.test.cjs. Se corren los
   bloques de comportamiento (A–D): el alcance (E1) compara el texto con 702f269 y mataría cualquier mutación sin decir nada.
   Uso: node test/fluyo-step-reverse-003-mutations.cjs   (ONLY_MUT=V3 una sola) */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const NL = "\n", CRLF = "\r\n";
const UNIT = ["--test", "--test-name-pattern=^[ABCD]\\d ", "test/fluyo-step-reverse-003.test.cjs"];
const ED = "js/editor-scenarios.js";
const TOGGLE = "  pushUndo();\n  setStepReverse(sc, id, s.reverse !== true);\n  scCommit();";
const ITEM = "      ...(step.action === \"SEND\" ? [scReverseMenuItem(step)] : []),\n";
const CHANGE = "      { label: \"Cambiar dónde ocurre…\", hint: where ? \"Ahora: \" + where : \"\", fn: () => scChangeTarget(step) },\n";
/* [nombre, archivo, desde, hasta] */
const MUTATIONS = [
  ["V1 el menú no tiene «Invertir sentido»", ED, ITEM, ""],
  ["V2 la acción aparece también en Steps que no son FLOW", ED, "...(step.action === \"SEND\" ? [scReverseMenuItem(step)] : [])", "...(true ? [scReverseMenuItem(step)] : [])"],
  ["V3 otro rótulo", ED, "label: \"Invertir sentido\"", "label: \"Invertir dirección\""],
  ["V4 el hint dice cómo está (no cómo quedará)", ED, "reverse: step.reverse !== true });", "reverse: step.reverse === true });"],
  ["V5 la acción siempre pone reverse:true (no alterna)", ED, "setStepReverse(sc, id, s.reverse !== true);", "setStepReverse(sc, id, true);"],
  ["V6 la acción escribe reverse:false en vez de quitar la clave", ED, "setStepReverse(sc, id, s.reverse !== true);", "s.reverse = s.reverse !== true;"],
  ["V7 la acción da la vuelta a la CONEXIÓN en vez de al Step", ED, "setStepReverse(sc, id, s.reverse !== true);", "{ const e = edgeById(s.edgeId); const f = e.from; e.from = e.to; e.to = f; }"],
  ["V8 sin entrada de Undo", ED, TOGGLE, TOGGLE.replace("  pushUndo();\n", "")],
  ["V9 dos entradas de Undo", ED, TOGGLE, "  pushUndo();\n" + TOGGLE],
  ["V10 sin commit (el panel no se repinta)", ED, TOGGLE, TOGGLE.replace("\n  scCommit();", "")],
  ["V11 la acción pierde la selección", ED, TOGGLE, TOGGLE.replace("\n  scCommit();", "\n  scSelectedStep = null;\n  scCommit();")],
  ["V12 edita una Historia que no se puede editar", ED, "function scToggleStepReverse(id) {\n  if (!scEditable()) return false;", "function scToggleStepReverse(id) {"],
  ["V13 sin conexión la entrada sigue activa", ED, "disabled: scIsTargetMissing(step) };", "disabled: false };"],
  ["V14 sin conexión la acción escribe igual", ED, "if (!s || s.action !== \"SEND\" || scIsTargetMissing(s)) return false;", "if (!s || s.action !== \"SEND\") return false;"],
  ["V15 «Cambiar dónde ocurre» olvida el sentido", ED, "retargetStep(P(), scActiveScenario(), s.id, id, s.action === \"SEND\" ? s.reverse === true : undefined);", "retargetStep(P(), scActiveScenario(), s.id, id, undefined);"],
  ["V16 «Invertir sentido» antes de «Cambiar dónde ocurre…»", ED, CHANGE + ITEM, ITEM + CHANGE],
];

function copyTree(dest) {
  for (const entry of fs.readdirSync(root).filter((e) => e !== ".git")) {
    const from = path.join(root, entry);
    if (fs.existsSync(from)) fs.cpSync(from, path.join(dest, entry), { recursive: true });
  }
}
function runSuite(dir) {
  const r = spawnSync(process.execPath, UNIT, { cwd: dir, encoding: "utf8", timeout: 300000, env: { ...process.env, FLUYO_GIT_ROOT: root, FLUYO_ROOT: dir } });
  return { code: r.status, timedOut: !!(r.error && r.error.code === "ETIMEDOUT") || r.signal === "SIGTERM", out: (r.stdout || "") + (r.stderr || "") };
}

const t0 = Date.now();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-rev3-mut-"));
const list = MUTATIONS.filter((m) => !process.env.ONLY_MUT || m[0].split(" ")[0] === process.env.ONLY_MUT);
let failed = 0;
try {
  const base = path.join(tmp, "base"); fs.mkdirSync(base); copyTree(base);
  const sane = runSuite(base);
  if (sane.code !== 0) { console.error("La copia sin mutar NO pasa:\n" + sane.out.slice(-3000)); process.exit(2); }
  console.log("copia sin mutar: suite OK (0/" + list.length + " mutaciones aplicadas)");
  list.forEach(([name, file, from, to], i) => {
    const dir = path.join(tmp, "m" + i); fs.mkdirSync(dir); copyTree(dir);
    const p = path.join(dir, file);
    const src = fs.readFileSync(p, "utf8"), crlf = src.includes(CRLF);
    const text = src.replaceAll(CRLF, NL);
    if (!text.includes(from)) { console.log("  ✘ " + name + " — el patrón no existe (mutación obsoleta)"); failed++; return; }
    fs.writeFileSync(p, text.replace(from, () => to).replaceAll(NL, crlf ? CRLF : NL));
    const r = runSuite(dir);
    const killed = r.code !== 0;
    const n = (r.out.match(/^not ok /gm) || []).length;
    console.log((killed ? "  ✔ detectada  " : "  ✘ SOBREVIVE  ") + name + (killed ? (r.timedOut || r.code === null ? "  (cuelga: muere por tiempo)" : "  (" + n + " comprobaciones fallan)") : ""));
    if (!killed) failed++;
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  });
} finally {
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
}
console.log((failed ? "\nFLUYO-STEP-REVERSE-003 mutaciones: " + failed + " sin detectar" : "\nFLUYO-STEP-REVERSE-003 mutaciones: " + list.length + "/" + list.length + " detectadas") + " · " + ((Date.now() - t0) / 1000).toFixed(1) + " s");
process.exit(failed ? 1 : 0);
