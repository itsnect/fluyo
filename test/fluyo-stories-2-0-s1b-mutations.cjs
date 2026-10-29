"use strict";
/* FLUYO-STORIES-2.0 S1b — Mutaciones sobre COPIAS aisladas (nunca sobre el árbol). Cada regresión real de «Fallar» («Falla aquí»,
   «Duplicar como fallo», desenlace, Undo, textos) debe hacer fallar test/fluyo-stories-2-0-s1b.test.cjs SIN contar C2 ni C2b
   (comparan con la base por git).
   Uso: node test/fluyo-stories-2-0-s1b-mutations.cjs   (ONLY_MUT=M3 una sola) */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const NL = "\n", CRLF = "\r\n";
const UNIT = ["--test", "--test-skip-pattern=^C2b? ", "test/fluyo-stories-2-0-s1b.test.cjs"];
const ED = "js/editor-scenarios.js", SC = "js/story-clock.js", PS = "js/present-story.js", VW = "js/viewer.js";
/* [nombre, archivo, desde, hasta] */
const MUTATIONS = [
  /* «Falla aquí» */
  ["M1 la caída se queda al final (no va antes del envío)", ED, `  if (moved && moved.changed) sc.steps = moved.steps;\n`, ``],
  ["M2 la caída entra en el MISMO momento que el envío", ED, `{ kind: "gap", index: gap }`, `{ kind: "join", anchorId: id, after: false }`],
  ["M3 cae el origen en vez del destino", ED, `const target = traversalEnds(edgeById(step.edgeId), step.reverse === true).target,`, `const target = traversalEnds(edgeById(step.edgeId), step.reverse === true).source,`],
  ["M4 ignora el sentido del envío", ED, `const target = traversalEnds(edgeById(step.edgeId), step.reverse === true).target,`, `const target = traversalEnds(edgeById(step.edgeId), false).target,`],
  ["M5 es una etiqueta, no una caída del motor", ED, `{ action: "SET_STATE", nodeId: target, state: "DOWN", at:`, `{ action: "OCCURRENCE", nodeId: target, at:`],
  ["M6 la caída no lleva frase", ED, `  setStepMessage(sc, down.id, text);\n`, ``],
  ["M7 la frase no sigue el idioma de la interfaz", ED, `FluyoI18n.t("step.failHereMessage", "{name} no responde", { name: scNodeFallback(target) })`, `"{name} no responde".replace("{name}", scNodeFallback(target))`],
  ["M8 dos entradas de Undo", ED, `  pushUndo();\n  const down = createStep(`, `  pushUndo();\n  pushUndo();\n  const down = createStep(`],
  ["M9 sin entrada de Undo", ED, `  pushUndo();\n  const down = createStep(`, `  const down = createStep(`],
  ["M10 se ofrece aunque el envío ya no se complete", ED, `  return !!o && o.status === "completed";`, `  return !!o;`],
  ["M11 reproduciendo también falla", ED, `function scFailHere(id) {\n  if (!scEditable()) return false;\n`, `function scFailHere(id) {\n`],
  ["M12 el menú del envío no ofrece «Falla aquí»", ED, `    ...(step.action === "SEND" ? [[scFailHereMenuItem(step)]] : []),\n`, ``],
  ["M13 el hint no dice quién cae", ED, `FluyoI18n.t("step.failHereHint", "{name} no responde justo antes", { name: scNodeFallback(traversalEnds(edgeById(step.edgeId), step.reverse === true).target) })`, `FluyoI18n.t("step.failHere", "Falla aquí")`],
  /* «Duplicar como fallo» */
  ["M14 «¿Dónde falla?» actúa sobre la ORIGINAL", ED, `  const copy = duplicateScenario(pg, src.id, scFailCopyNames());\n  scSelectStory(copy.id);\n`, `  const copy = duplicateScenario(pg, src.id, scFailCopyNames());\n`],
  ["M15 duplicar no abre «¿Dónde falla?»", ED, `  scChooseFailure(anchor);\n}`, `}`],
  ["M16 la copia se llama como cualquier copia", ED, `duplicateScenario(pg, src.id, scFailCopyNames())`, `duplicateScenario(pg, src.id, scSeedNames())`],
  ["M17 duplicar no deja Undo", ED, `  const pg = P();\n  pushUndo();\n  const copy = duplicateScenario(pg, src.id, scFailCopyNames());`, `  const pg = P();\n  const copy = duplicateScenario(pg, src.id, scFailCopyNames());`],
  ["M18 «¿Dónde falla?» ofrece envíos que ya no se completan", ED, `sends = storyboardOrderedSteps(sc.steps).filter((x) => scCanFailHere(sc, x));`, `sends = storyboardOrderedSteps(sc.steps).filter((x) => x.action === "SEND");`],
  /* desenlace */
  ["M19 N cuenta pasos, no momentos", SC, `    return {ok:false, moment:k+1,`, `    return {ok:false, moment:storyboardOrderedSteps(scenario.steps).findIndex(s=>failed.has(s.id))+1,`],
  ["M20 una caída cuenta como fallo", SC, `if(ev.type==="send_failed") failed.add(ev.stepId);`, `if(ev.type==="send_failed" || ev.type==="state_changed") failed.add(ev.stepId);`],
  ["M21 sin pasos dice «Termina bien»", SC, `if(!groups.length || !trace || !trace.events) return null;`, `if(!trace || !trace.events) return null;`],
  ["M22 la línea sale antes de terminar", SC, `return phase==="finished" ? outcomeText(`, `return phase!=="ready" ? outcomeText(`],
  ["M23 «Termina bien» no sigue el idioma", SC, `tx("story.outcome.ok", "Termina bien")`, `"Termina bien"`],
  ["M24 Present no pinta el desenlace", PS, `typeof FluyoStoryClock!=="undefined" ? FluyoStoryClock.outcomeLine(dphase, sc, scPlayback, FluyoI18n.t) : ""`, `""`],
  ["M25 el Viewer no pinta el desenlace", VW, `  if($("stOutcome")) storySet("stOutcome","text",FluyoStoryClock.outcomeLine(phase, sc, story && story.playback, FluyoI18n.t));\n`, ``],
  ["M26 el editor no enseña el desenlace", ED, `  if (outcome) board.appendChild(scEl("div", "scOutcome " + (info.outcome.ok ? "ok" : "failed"), outcome));\n`, ``],
  ["M27 el desenlace del editor no se recalcula al cambiar la Historia", ED, `key = JSON.stringify([sc, pg.behaviors || [],`, `key = JSON.stringify([sc.id, pg.behaviors || [],`],
  ["M28 ni al cambiar las condiciones iniciales", ED, `key = JSON.stringify([sc, pg.behaviors || [],`, `key = JSON.stringify([sc,`],
];

function copyTree(dest) {
  for (const entry of ["js", "css", "test", "s", "ejemplos", "sw.js", "index.html"]) fs.cpSync(path.join(root, entry), path.join(dest, entry), { recursive: true });
}
function runSuite(dir) {
  const r = spawnSync(process.execPath, UNIT, { cwd: dir, encoding: "utf8", timeout: 300000, env: { ...process.env, FLUYO_GIT_ROOT: root, FLUYO_ROOT: dir } });
  return { code: r.status, timedOut: !!(r.error && r.error.code === "ETIMEDOUT") || r.signal === "SIGTERM", out: (r.stdout || "") + (r.stderr || "") };
}

const t0 = Date.now();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-s1b-mut-"));
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
console.log((failed ? "\nFLUYO-STORIES-2.0 S1b mutaciones: " + failed + " sin detectar" : "\nFLUYO-STORIES-2.0 S1b mutaciones: " + list.length + "/" + list.length + " detectadas") + " · " + ((Date.now() - t0) / 1000).toFixed(1) + " s");
process.exit(failed ? 1 : 0);
