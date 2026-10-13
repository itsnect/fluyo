"use strict";
/* FLUYO-018.21 — Mutaciones sobre COPIAS aisladas (nunca sobre el árbol). Cada defecto que el slice evita debe hacer fallar su
   suite:
   · U*: test/fluyo-018-21.test.cjs (vm, segundos).
   · B*: test/fluyo-018-21-browser.cjs en Chrome real (ONLY=…).
   Uso: node test/fluyo-018-21-mutations.cjs   (Playwright vía NODE_PATH; SKIP_BROWSER=1 solo las U; ONLY_MUT=U3 una) */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const NL = "\n", CRLF = "\r\n";

const UNIT = ["--test", "test/fluyo-018-21.test.cjs"];
const BROWSER = ["test/fluyo-018-21-browser.cjs"];
const CLOCK = "js/story-clock.js";
const IGNORED = ["      for(const id of waits) if(arrivals[id]>t) t = arrivals[id];\n", ""];
const GLOBAL = ["      for(const id of waits) if(arrivals[id]>t) t = arrivals[id];\n", "      for(const id in arrivals) if(arrivals[id]>t) t = arrivals[id];\n"];
/* [nombre, suite, archivo, desde, hasta, ONLY del browser test] */
const MUTATIONS = [
  ["U1 dependencia ignorada (el momento no espera)", UNIT, CLOCK, ...IGNORED],
  ["B1 dependencia ignorada (el momento no espera)", BROWSER, CLOCK, ...IGNORED, "play"],
  ["U2 llegada calculada demasiado pronto (desde la salida narrativa)", UNIT, CLOCK, "if(s.action===\"SEND\") arrivals[s.id] = t + travelMs(stepMeta, s.id);", "if(s.action===\"SEND\") arrivals[s.id] = g.at + travelMs(stepMeta, s.id);"],
  ["U3 llegada calculada demasiado pronto (viaje recortado)", UNIT, CLOCK, "if(s.action===\"SEND\") arrivals[s.id] = t + travelMs(stepMeta, s.id);", "if(s.action===\"SEND\") arrivals[s.id] = t + travelMs(stepMeta, s.id) - 100;"],
  ["U4 llegada calculada demasiado tarde (cuenta el pulso de llegada)", UNIT, CLOCK, "if(s.action===\"SEND\") arrivals[s.id] = t + travelMs(stepMeta, s.id);", "if(s.action===\"SEND\") arrivals[s.id] = t + travelMs(stepMeta, s.id) + FluyoScenarioPlayback.TERMINAL_MS;"],
  ["U5 dependencia aplicada al momento incorrecto (al siguiente Step)", UNIT, CLOCK, "for(const id of deps.waits.get(s.id) || []) if(!waits.includes(id)) waits.push(id);", "for(const id of deps.waits.get(s.id - 1) || []) if(!waits.includes(id)) waits.push(id);"],
  ["U6 dependencia aplicada solo al Step (el momento deja de ser atómico)", UNIT, CLOCK, "      for(const s of g.steps){ byStep[s.id] = t;", "      for(const s of g.steps){ byStep[s.id] = deps.waits.get(s.id) ? t : g.at;"],
  ["U7 evento independiente desplazado (barrera global)", UNIT, CLOCK, ...GLOBAL],
  ["B7 evento independiente desplazado (barrera global)", BROWSER, CLOCK, ...GLOBAL, "play"],
  ["U8 sin pausa: lo posterior no conserva su ritmo (E1)", UNIT, CLOCK, "      pause = t - g.at;\n", ""],
  ["U9 ciclo no controlado (se aceptan esperas hacia delante o del mismo momento)", UNIT, CLOCK, " : !(send.at<step.at) ? \"not_earlier\"", ""],
  ["U10 dependencia a SEND inexistente aceptada", UNIT, CLOCK, " : !send ? \"send_missing\"", " : !send ? null"],
  ["U11 el editor acepta cualquier envío como candidato", UNIT, CLOCK, "filter(s=>s.action===\"SEND\" && s.at<step.at)", "filter(s=>s.action===\"SEND\")"],
  ["U12 reproducir no usa el horario visible (Trace sin proyectar)", UNIT, CLOCK, "    if(sch.shifted) started.playback.trace = visibleTrace(started.playback.trace, sch.byStep);\n", ""],
  ["U13 eliminar un envío deja dependencias colgando", UNIT, "js/editor-scenarios.js", "  sc.steps = r.steps;\n  scSetArrivalDependencies(sc, FluyoStoryClock.pruneArrivalDependencies(sc));\n", "  sc.steps = r.steps;\n"],
  ["U14 el Viewer navega por los instantes narrativos", UNIT, "js/viewer.js", "FluyoStoryClock.momentTimes(story.scenario, story.playback)", "FluyoStoryClock.momentTimes(story.scenario)"],
  ["U15 Present cuenta el momento narrativo", UNIT, "js/present-story.js", '(typeof FluyoStoryClock!=="undefined" ? FluyoStoryClock : FluyoStory).describe(dphase', "FluyoStory.describe(dphase"],
  ["U16 una Historia antigua cambia (se infiere desde las conexiones)", UNIT, CLOCK, "    const groups = storyboardGroups((scenario && scenario.steps) || []), deps = arrivalDependencies(scenario);", "    const groups = storyboardGroups((scenario && scenario.steps) || []), deps = arrivalDependencies(scenario);\n    if(!scenario.arrivalDependencies) for(const s of scenario.steps) if(s.action!==\"SEND\") deps.waits.set(s.id, scenario.steps.filter(x=>x.action===\"SEND\" && x.at<s.at).map(x=>x.id));"],
];

function copyTree(dest) {
  for (const entry of fs.readdirSync(root).filter((e) => e !== ".git")) fs.cpSync(path.join(root, entry), path.join(dest, entry), { recursive: true });
}
function runSuite(dir, args, only) {
  const browser = args === BROWSER;
  const r = spawnSync(process.execPath, args, { cwd: dir, encoding: "utf8", timeout: browser ? 300000 : 120000, env: { ...process.env, ONLY: browser ? only : "", FLUYO_GIT_ROOT: root, FLUYO_ROOT: dir } });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-018-21-mut-"));
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
console.log(failed ? "\nFLUYO-018.21 mutaciones: " + failed + " sin detectar" : "\nFLUYO-018.21 mutaciones: " + list.length + "/" + list.length + " detectadas");
process.exit(failed ? 1 : 0);
