"use strict";
/* FLUYO-STORIES-2.0 S2b — Mutaciones sobre COPIAS aisladas (nunca sobre el árbol). Cada regresión real de «Variantes en el editor»
   («Otra forma desde aquí», el momento en curso, el nombre en línea, el selector con desenlace, Undo, textos) debe hacer fallar
   test/fluyo-stories-2-0-s2b.test.cjs SIN contar C1 ni C2 (comparan con la base por git).
   Uso: node test/fluyo-stories-2-0-s2b-mutations.cjs   (ONLY_MUT=M3 una sola) */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const NL = "\n", CRLF = "\r\n";
const UNIT = ["--test", "--test-skip-pattern=^C[12] ", "test/fluyo-stories-2-0-s2b.test.cjs"];
const ED = "js/editor-scenarios.js", EN = "js/i18n-en-editor.js";
/* [nombre, archivo, desde, hasta] */
const MUTATIONS = [
  /* la variante */
  ["M1 copia también lo posterior", ED, `  copy.steps = copy.steps.filter((x) => x.at <= at);\n`, ``],
  ["M2 deja fuera el momento elegido", ED, `copy.steps.filter((x) => x.at <= at)`, `copy.steps.filter((x) => x.at < at)`],
  ["M3 no poda las esperas de llegada", ED, `  scSetArrivalDependencies(copy, FluyoStoryClock.pruneArrivalDependencies(copy));\n  scSelectStory(copy.id);`, `  scSelectStory(copy.id);`],
  ["M4 recorta la ORIGINAL", ED, `  copy.steps = copy.steps.filter((x) => x.at <= at);`, `  src.steps = src.steps.filter((x) => x.at <= at);`],
  ["M5 dos entradas de Undo", ED, `  pushUndo();\n  const copy = duplicateScenario(pg, src.id, scBranchNames());`, `  pushUndo();\n  pushUndo();\n  const copy = duplicateScenario(pg, src.id, scBranchNames());`],
  ["M6 sin entrada de Undo", ED, `  pushUndo();\n  const copy = duplicateScenario(pg, src.id, scBranchNames());`, `  const copy = duplicateScenario(pg, src.id, scBranchNames());`],
  ["M7 se ofrece también en el último momento", ED, `k >= 0 && k < groups.length - 1 };`, `k >= 0 };`],
  ["M8 la variante no queda activa", ED, `  scSelectStory(copy.id);\n  scCommit();\n  scBeginInlineName(true);\n  return true;`, `  scCommit();\n  scBeginInlineName(true);\n  return true;`],
  ["M9 la variante no abre su nombre", ED, `  scCommit();\n  scBeginInlineName(true);\n  return true;`, `  scCommit();\n  return true;`],
  ["M10 la variante se llama como cualquier copia", ED, `duplicateScenario(pg, src.id, scBranchNames())`, `duplicateScenario(pg, src.id, scSeedNames())`],
  ["M11 el paso no ofrece «Otra forma desde aquí»", ED, `scFailHereMenuItem(step)] : []), scBranchMenuItem(step)],`, `scFailHereMenuItem(step)] : [])],`],
  ["M12 reproduciendo usa el momento siguiente", ED, `    k = scMomentNav().index,`, `    k = scMomentNav().index + 1,`],
  ["M13 reproduciendo no se ofrece", ED, `    ...(branch ? [[FluyoI18n.t("stories.branchAt"`, `    ...(false ? [[FluyoI18n.t("stories.branchAt"`],
  /* (sin M14: la reproducción se detiene en scBranchFrom y otra vez al abrir el nombre, scBeginInlineName; quitar una no cambia nada) */
  /* el nombre en línea */
  ["M15 Escape guarda", ED, `    else scRenderHeader();\n  };\n  input.onkeydown = (e) => {\n    if (e.keyCode === 13 && !e.isComposing) { e.preventDefault(); finish(true); }\n    else if (e.keyCode === 27) { e.preventDefault(); e.stopPropagation(); finish(false); }`, `    else scRenderHeader();\n  };\n  input.onkeydown = (e) => {\n    if (e.keyCode === 13 && !e.isComposing) { e.preventDefault(); finish(true); }\n    else if (e.keyCode === 27) { e.preventDefault(); e.stopPropagation(); finish(true); }`],
  ["M16 el Enter de un IME confirma", ED, `if (save && text && text !== sc.name && scActiveScenario() === sc) scRenameScenario(text);`, `if (save && text && text !== sc.name && scActiveScenario() === sc) scRenameScenario(text);\n    else if (!save && text) scRenameScenario(text);`],
  ["M17 guarda sin pasar por scRenameScenario (sin Undo)", ED, `scActiveScenario() === sc) scRenameScenario(text);`, `scActiveScenario() === sc) { sc.name = text; scRenderHeader(); }`],
  ["M18 «Renombrar» sigue sin abrir el nombre en línea", ED, `[FluyoI18n.t("stories.rename", "Renombrar"), () => scBeginInlineName(true), none],`, `[FluyoI18n.t("stories.rename", "Renombrar"), () => {}, none],`],
  ["M19 sin doble clic", ED, `  if ($("scScenarioTitle")) $("scScenarioTitle").ondblclick = () => scBeginInlineName(true);   /* S2b (D2) */\n`, ``],
  ["M20 «Nueva historia» no deja el nombre listo", ED, `  scNotice(FluyoI18n.t("stories.created", "{name} creada", { name: sc.name }));\n  scBeginInlineName(true);\n`, `  scNotice(FluyoI18n.t("stories.created", "{name} creada", { name: sc.name }));\n`],
  ["M21 cambiar de Historia deja el campo abierto", ED, `  scFlowPending = null;\n  scInlineName = null;\n}`, `  scFlowPending = null;\n}`],
  ["M22 renombrar no detiene la reproducción", ED, `  if (isScenarioPlaybackActive()) scReset();\n  scClosePopover(false);\n  scInlineName`, `  scClosePopover(false);\n  scInlineName`],
  /* el selector */
  ["M23 el selector no enseña el desenlace", ED, `        hint: FluyoStoryClock.outcomeText(FluyoStoryClock.outcomeOf(P(), s), FluyoI18n.t),\n`, ``],
  ["M24 el selector enseña el desenlace de la activa en todas", ED, `FluyoStoryClock.outcomeOf(P(), s)`, `FluyoStoryClock.outcomeOf(P(), active || s)`],
  /* textos */
  ["M25 «Another way from here» no está en inglés", EN, `  "step.branchHere":"Another way from here",\n`, ``],
];

function copyTree(dest) {
  for (const entry of ["js", "css", "test", "s", "ejemplos", "sw.js", "index.html"]) fs.cpSync(path.join(root, entry), path.join(dest, entry), { recursive: true });
}
function runSuite(dir) {
  const r = spawnSync(process.execPath, UNIT, { cwd: dir, encoding: "utf8", timeout: 300000, env: { ...process.env, FLUYO_GIT_ROOT: root, FLUYO_ROOT: dir } });
  return { code: r.status, timedOut: !!(r.error && r.error.code === "ETIMEDOUT") || r.signal === "SIGTERM", out: (r.stdout || "") + (r.stderr || "") };
}

const t0 = Date.now();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-s2b-mut-"));
const list = MUTATIONS.filter((m) => !process.env.ONLY_MUT || m[0].split(" ")[0] === process.env.ONLY_MUT);
let failed = 0;
try {
  const base = path.join(tmp, "base"); fs.mkdirSync(base); copyTree(base);
  const sane = runSuite(base);
  if (sane.code !== 0) { console.error("La copia sin mutar NO pasa:\n" + sane.out.slice(-3000)); process.exit(2); }
  const ran = (sane.out.match(/^# pass (\d+)/m) || [])[1];
  console.log("copia sin mutar: suite OK (" + ran + " tests sin C1 ni C2; 0/" + list.length + " mutaciones aplicadas)");
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
console.log((failed ? "\nFLUYO-STORIES-2.0 S2b mutaciones: " + failed + " sin detectar" : "\nFLUYO-STORIES-2.0 S2b mutaciones: " + list.length + "/" + list.length + " detectadas") + " · " + ((Date.now() - t0) / 1000).toFixed(1) + " s");
process.exit(failed ? 1 : 0);
