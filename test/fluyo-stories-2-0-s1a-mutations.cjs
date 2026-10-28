"use strict";
/* FLUYO-STORIES-2.0 S1a — Mutaciones sobre COPIAS aisladas (nunca sobre el árbol). Cada regresión real de «Contar con clics»
   (toque, tipo implícito, blanco, Undo, frase en línea, textos) debe hacer fallar test/fluyo-stories-2-0-s1a.test.cjs SIN contar
   C2 ni C2b (comparan con la base por git).
   Uso: node test/fluyo-stories-2-0-s1a-mutations.cjs   (ONLY_MUT=M3 una sola) */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const NL = "\n", CRLF = "\r\n";
const UNIT = ["--test", "--test-skip-pattern=^C2b? ", "test/fluyo-stories-2-0-s1a.test.cjs"];
const ED = "js/editor-scenarios.js", IN = "js/interaction.js";
/* [nombre, archivo, desde, hasta] */
const MUTATIONS = [
  /* toque */
  ["M1 cuenta también fuera de Historias", ED, `uiMode === "story" && !presenting`, `!presenting`],
  ["M2 Mayús también cuenta (no deja seleccionar)", ED, ` && !ev.shiftKey && !ev.ctrlKey`, ` && !ev.ctrlKey`],
  ["M3 un arrastre corto cuenta como toque", ED, `const SC_TAP_SLOP = 8,`, `const SC_TAP_SLOP = 20,`],
  ["M4 un segundo dedo no anula el toque", ED, `  if (scTap) { scTap = null; return; }\n`, ``],
  ["M5 el botón derecho cuenta", ED, `(ev.button === undefined || ev.button === 0) && `, ``],
  ["M6 reproduciendo, tocar cuenta", ED, `return !isScenarioPlaybackActive() && (!sc || sc.engineVersion`, `return (!sc || sc.engineVersion`],
  ["M7 colocando un evento, el toque también cuenta", ED, `!presenting && !scPlacement && `, `!presenting && `],
  /* blanco */
  ["M8 blanco de 10 px (el de colocar)", ED, `  SC_TAP_EDGE_PX = 12,`, `  SC_TAP_EDGE_PX = 10,`],
  ["M9 blanco de 16 px", ED, `  SC_TAP_EDGE_PX = 12,`, `  SC_TAP_EDGE_PX = 16,`],
  ["M10 la conexión gana al elemento hoja", ED, `  const leaf = hitLeafNode(x, y);\n  if (leaf) return { kind: "node", ids: [leaf.id] };\n`, ``],
  ["M11 varias conexiones: elige la primera sin preguntar", ED, `  if (target.ids.length > 1) {`, `  if (false) {`],
  /* tipo implícito */
  ["M12 siempre crea un tipo nuevo (no reutiliza)", ED, `  if (used.length) return used[used.length - 1];\n`, ``],
  ["M13 reutiliza aunque sea de otra clase", ED, `.filter((et) => et && et.primitive === primitive);`, `.filter((et) => et);`],
  ["M14 el nombre no sigue el idioma de la interfaz", ED, `FluyoI18n.t("step.implicit.edge", "Paso")`, `"Paso"`],
  ["M15 un elemento crea un envío (FLOW)", ED, `const primitive = kind === "edge" ? "FLOW" : "OCCURRENCE";`, `const primitive = "FLOW";`],
  /* Undo */
  ["M16 dos entradas de Undo por toque", ED, `  clearSel();\n  pushUndo();\n  let created = false;`, `  clearSel();\n  pushUndo();\n  pushUndo();\n  let created = false;`],
  ["M17 el toque no deja Undo", ED, `  clearSel();\n  pushUndo();\n  let created = false;`, `  clearSel();\n  let created = false;`],
  ["M18 el doble clic repite el paso", ED, ` && now - scLastTap.t < SC_TAP_REPEAT_MS) return null;`, ` && false) return null;`],
  /* frase en línea */
  ["M19 con el dedo también abre el teclado", ED, `scInlineStep = { id: step.id, focus: pointerType !== "touch" };`, `scInlineStep = { id: step.id, focus: true };`],
  ["M20 el Enter de un IME confirma", ED, `if (e.keyCode === 13 && !e.isComposing) { e.preventDefault(); finish(true); }`, `if (e.keyCode === 13 || e.keyCode === 229) { e.preventDefault(); finish(true); }`],
  ["M21 Escape guarda", ED, `{ e.preventDefault(); e.stopPropagation(); finish(false); }`, `{ e.preventDefault(); e.stopPropagation(); finish(true); }`],
  ["M22 salir del campo no guarda", ED, `  input.onblur = () => finish(true);`, `  input.onblur = () => finish(false);`],
  ["M23 vacía no se quita", ED, `scSetStepMessage(step.id, text ? text : null)`, `scSetStepMessage(step.id, text ? text : (scStepMessage(step) || null))`],
  ["M24 no recorta los espacios", ED, `const text = input.value.trim();`, `const text = input.value.trim() ? input.value : "";`],
  ["M25 reproduciendo también hay campo", ED, `const inline = !isScenarioPlaybackActive() && !d.missing && scEditable();`, `const inline = !d.missing && !!scActiveScenario();`],
  ["M26 la frase de la fila no se puede tocar para editarla", ED, `      said.onclick = (ev) => { ev.stopPropagation(); scBeginInlineMessage(step.id); };\n`, ``],
  /* textos */
  ["M27 el estado vacío vuelve a pedir un evento", ED, `    } else empty.textContent = tap;`, `    } else empty.textContent = FluyoI18n.t("stories.emptyDrag", "Arrastra un evento sobre el sistema para empezar.");`],
  ["M28 en Historias el doble clic edita el texto del elemento", IN, `if(!presenting && uiMode!=="story") openEditorAt(toWorld(ev));`, `if(!presenting) openEditorAt(toWorld(ev));`],
];

function copyTree(dest) {
  for (const entry of ["js", "css", "test", "sw.js", "index.html"]) fs.cpSync(path.join(root, entry), path.join(dest, entry), { recursive: true });
}
function runSuite(dir) {
  const r = spawnSync(process.execPath, UNIT, { cwd: dir, encoding: "utf8", timeout: 300000, env: { ...process.env, FLUYO_GIT_ROOT: root, FLUYO_ROOT: dir } });
  return { code: r.status, timedOut: !!(r.error && r.error.code === "ETIMEDOUT") || r.signal === "SIGTERM", out: (r.stdout || "") + (r.stderr || "") };
}

const t0 = Date.now();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-s1a-mut-"));
const list = MUTATIONS.filter((m) => !process.env.ONLY_MUT || m[0].split(" ")[0] === process.env.ONLY_MUT);
let failed = 0;
try {
  const base = path.join(tmp, "base"); fs.mkdirSync(base); copyTree(base);
  const sane = runSuite(base);
  if (sane.code !== 0) { console.error("La copia sin mutar NO pasa:\n" + sane.out.slice(-3000)); process.exit(2); }
  const ran = (sane.out.match(/^# pass (\d+)/m) || [])[1];
  console.log("copia sin mutar: suite OK (" + ran + " tests sin C2 ni C2b; 0/" + list.length + " mutaciones aplicadas)");
  list.forEach(([name, file, from, to], i) => {
    const dir = path.join(tmp, "m" + i); fs.mkdirSync(dir); copyTree(dir);
    const p = path.join(dir, file);
    const src = fs.readFileSync(p, "utf8"), crlf = src.includes(CRLF);
    const text = src.replaceAll(CRLF, NL);
    if (text.split(from).length !== 2) { console.log("  ✘ " + name + " — el patrón no existe o no es único (mutación obsoleta)"); failed++; return; }
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
console.log((failed ? "\nFLUYO-STORIES-2.0 S1a mutaciones: " + failed + " sin detectar" : "\nFLUYO-STORIES-2.0 S1a mutaciones: " + list.length + "/" + list.length + " detectadas") + " · " + ((Date.now() - t0) / 1000).toFixed(1) + " s");
process.exit(failed ? 1 : 0);
