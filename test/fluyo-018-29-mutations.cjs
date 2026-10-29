"use strict";
/* FLUYO-018.29 — Mutaciones sobre COPIAS aisladas (nunca sobre el árbol). Cada regresión real de R1 (encabezado de Present por su alto
   real) y G1 (saltar en pausa enseña el momento) debe hacer fallar su suite:
   · U*: test/fluyo-018-29.test.cjs (estático y vm, ~2 s).
   · B*: test/fluyo-018-29-browser.cjs en Chrome real, solo el viewport que lo delata (ONLY=…).
   Uso: node test/fluyo-018-29-mutations.cjs   (Playwright vía NODE_PATH; SKIP_BROWSER=1 solo las U; ONLY_MUT=U3 una, ONLY_MUT=B todas las de Chrome) */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const NL = "\n", CRLF = "\r\n";

const UNIT = ["--test", "test/fluyo-018-29.test.cjs"];
const BROWSER = ["test/fluyo-018-29-browser.cjs"];
const MARK = "if(isPaused(c)) started.playback.revealAt = times[k];";
const ALWAYS = [MARK, "started.playback.revealAt = times[k];"];
const NEVER = [MARK, ""];
const EXIT = ["ids.has(fx.stepId) && fx.enter<1 ?", "ids.has(fx.stepId) ?"];
const OTHERS = ["if(fx.virtualAt===at) ids.add(fx.stepId);", "ids.add(fx.stepId);"];
const MUTATE = ["Object.assign({}, fx, {alpha:1, enter:1})", "Object.assign(fx, {alpha:1, enter:1})"];
const HALF = ["Object.assign({}, fx, {alpha:1, enter:1})", "Object.assign({}, fx, {alpha:1})"];
const NO_EDITOR = ['  if (typeof FluyoStoryClock !== "undefined") rs = FluyoStoryClock.reveal(rs, scPlayback);\n', ""];
const NO_VIEWER = ["FluyoStoryClock.reveal(FluyoStory.renderState(story.playback, story.scenario, storyNow()), story.playback)", "FluyoStory.renderState(story.playback, story.scenario, storyNow())"];
const FIXED = ["top=Math.max(24, presentHeaderBottom()-r.top)", "top=presentHasStory()?84:24"];
const NO_ROUTE = ['  if(route) probe("psFlow is"+route.status, route.text);\n', ""];
const NO_CLOSE = ['  if(end && end.summary && !$("psSummary").textContent) probe("psSummary", end.summary);\n', ""];
const LEFTOVER = ["  for(const el of probes) el.remove();\n", ""];
const STALE = ["  presentStoryRefresh();\n  /* el mando", "  /* el mando"];
const NO_TRACE = ['FluyoStory.describe("finished", sc, {logEvents:run.trace.events, cursorVirtual:0}, ()=>"", ()=>null)', 'FluyoStory.describe("finished", sc, null, ()=>"", ()=>null)'];
/* [nombre, suite, archivo, desde, hasta, ONLY del browser test] */
const MUTATIONS = [
  ["U1 CACHE no sube (sigue v102)", UNIT, "sw.js", 'const CACHE = "fluyo-static-v120";', 'const CACHE = "fluyo-static-v102";'],
  ["U2 el kernel se toca (scenario-playback.js)", UNIT, "js/scenario-playback.js", "const CUE_FADE_IN_MS = 140;", "const CUE_FADE_IN_MS = 0;"],
  ["U3 se revela también reproduciendo", UNIT, "js/story-clock.js", ...ALWAYS],
  ["B3 se revela también reproduciendo", BROWSER, "js/story-clock.js", ...ALWAYS, "l844"],
  ["U4 saltar en pausa no marca el momento", UNIT, "js/story-clock.js", ...NEVER],
  ["U5 alpha 1 también en la salida del cue", UNIT, "js/story-clock.js", ...EXIT],
  ["U6 se revelan cues de otros momentos", UNIT, "js/story-clock.js", ...OTHERS],
  ["U7 reveal muta la proyección de entrada", UNIT, "js/story-clock.js", ...MUTATE],
  ["U8 reveal deja la entrada a medias (enter)", UNIT, "js/story-clock.js", ...HALF],
  ["U9 el editor no pasa por reveal", UNIT, "js/editor-scenarios.js", ...NO_EDITOR],
  ["B9 el editor (y Present) no pasa por reveal", BROWSER, "js/editor-scenarios.js", ...NO_EDITOR, "d1440"],
  ["U10 el Viewer no pasa por reveal", UNIT, "js/viewer.js", ...NO_VIEWER],
  ["B10 el Viewer no pasa por reveal", BROWSER, "js/viewer.js", ...NO_VIEWER, "m390"],
  ["U11 vuelve el alto fijo de 84 px", UNIT, "js/present-story.js", ...FIXED],
  ["B11 vuelve el alto fijo de 84 px", BROWSER, "js/present-story.js", ...FIXED, "l844"],
  ["U12 la ruta no entra en la reserva", UNIT, "js/present-story.js", ...NO_ROUTE],
  ["B12 la ruta no entra en la reserva", BROWSER, "js/present-story.js", ...NO_ROUTE, "l812"],
  ["U13 el cierre de «terminada» no entra en la reserva", UNIT, "js/present-story.js", ...NO_CLOSE],
  ["B13 el cierre de «terminada» no entra en la reserva", BROWSER, "js/present-story.js", ...NO_CLOSE, "l844"],
  ["U14 las filas sonda se quedan en el DOM", UNIT, "js/present-story.js", ...LEFTOVER],
  ["U15 se mide sin repintar el encabezado de la página", UNIT, "js/present-story.js", ...STALE],
  ["U16 el cierre se calcula sin el Trace", UNIT, "js/present-story.js", ...NO_TRACE],
];

/* el árbol entero (salvo .git): el Service Worker y el alcance necesitan todo lo que se sirve */
function copyTree(dest) {
  for (const entry of fs.readdirSync(root).filter((e) => e !== ".git")) {
    const from = path.join(root, entry);
    if (fs.existsSync(from)) fs.cpSync(from, path.join(dest, entry), { recursive: true });
  }
}
function runSuite(dir, args, only) {
  const browser = args === BROWSER;
  const r = spawnSync(process.execPath, args, { cwd: dir, encoding: "utf8", timeout: browser ? 600000 : 120000, env: { ...process.env, ONLY: browser ? only : "", FLUYO_GIT_ROOT: root } });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

const t0 = Date.now();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-018-29-mut-"));
const list = MUTATIONS.filter((m) => !(process.env.SKIP_BROWSER && m[1] === BROWSER)).filter((m) => { const o = process.env.ONLY_MUT; if (!o) return true; const id = m[0].split(" ")[0]; return id === o || (/^[UB]$/.test(o) && id[0] === o); });
let failed = 0;
try {
  const base = path.join(tmp, "base"); fs.mkdirSync(base); copyTree(base);
  const sanity = [[UNIT, ""], ...[...new Set(list.filter((m) => m[1] === BROWSER).map((m) => m[5]))].map((o) => [BROWSER, o])];
  for (const [args, only] of sanity) {
    const sane = runSuite(base, args, only);
    if (sane.code !== 0) { console.error("La copia sin mutar NO pasa " + args.join(" ") + " " + only + ":\n" + sane.out.slice(-2000)); process.exit(2); }
  }
  console.log("copia sin mutar: suites OK (0/" + list.length + " mutaciones aplicadas)");
  list.forEach(([name, args, file, from, to, only], i) => {
    const dir = path.join(tmp, "m" + i); fs.mkdirSync(dir); copyTree(dir);
    const p = path.join(dir, file);
    const src = fs.readFileSync(p, "utf8"), crlf = src.includes(CRLF);
    const text = src.replaceAll(CRLF, NL);
    if (!text.includes(from)) { console.log("  ✘ " + name + " — el patrón no existe (mutación obsoleta)"); failed++; return; }
    fs.writeFileSync(p, text.replace(from, () => to).replaceAll(NL, crlf ? CRLF : NL));
    const r = runSuite(dir, args, only);
    const killed = r.code !== 0;
    const n = (r.out.match(/^not ok |^\s+✘ /gm) || []).length;
    console.log((killed ? "  ✔ detectada  " : "  ✘ SOBREVIVE  ") + name + (killed ? "  (" + n + " comprobaciones fallan)" : ""));
    if (!killed) failed++;
    fs.rmSync(dir, { recursive: true, force: true });
  });
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log((failed ? "\nFLUYO-018.29 mutaciones: " + failed + " sin detectar" : "\nFLUYO-018.29 mutaciones: " + list.length + "/" + list.length + " detectadas") + " · " + ((Date.now() - t0) / 1000).toFixed(1) + " s");
process.exit(failed ? 1 : 0);
