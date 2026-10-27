"use strict";
/* FLUYO-I18N-002 S2b — Mutaciones sobre COPIAS aisladas (nunca sobre el árbol). Cada regresión real de S2b (pegar texto en el kernel,
   un plural a mano, una clave que falta en el inglés, el kernel que nombra la interfaz, un español que cambia, el recorte con el
   sufijo español, un consumidor que no pasa el proveedor, un nombre del autor convertido en clave) debe hacer fallar
   test/fluyo-i18n-002-s2b.test.cjs SIN contar su test de alcance (A), que compara el texto con la base y detectaría cualquier mutación
   sin probar nada. Uso: node test/fluyo-i18n-002-s2b-mutations.cjs   (ONLY_MUT=M3 una sola) */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const NL = "\n", CRLF = "\r\n";
const UNIT = ["--test", "--test-skip-pattern=^A · ", "test/fluyo-i18n-002-s2b.test.cjs"];
const SP = "js/story-playback.js", MODEL = "js/model.js", CLOCK = "js/story-clock.js", ED = "js/editor-scenarios.js", PS = "js/present-story.js", VW = "js/viewer.js", EN = "js/i18n-en.js";
/* [nombre, archivo, desde, hasta] */
const MUTATIONS = [
  ["M1 «X no está disponible» se vuelve a pegar en el kernel (sujeto + verbo)", SP, 'tx("story.cap.down", "{name} no está disponible", {name:who})', 'who+" no está disponible"'],
  ["M2 el plural del cierre vuelve a ser a mano", SP, 'return tx("story.failedCount", {one:"{count} evento no pudo realizarse", other:"{count} eventos no pudieron realizarse"}, {count:failed});', 'return failed===1 ? "1 evento no pudo realizarse" : failed+" eventos no pudieron realizarse";'],
  ["M3 una clave falta en el inglés (cae al español)", EN, '  "story.cap.up":"{name} is available again",\n', ""],
  ["M4 el kernel nombra la interfaz (no corre en el MCP)", SP, "const textOf = text => typeof text===\"function\" ? text : plainText;", "const textOf = text => typeof text===\"function\" ? text : FluyoI18n.t;"],
  ["M5 el español cambia un texto del kernel («Reproducción terminada»)", SP, 'tx("story.finished", "Reproducción terminada")', 'tx("story.finished", "Reproducción finalizada")'],
  ["M6 duplicar una Historia no pasa el formateador", ED, "duplicateScenario(pg, src.id, scSeedNames())", "duplicateScenario(pg, src.id)"],
  ["M7 el recorte mide el sufijo español en vez del formateado", MODEL, 'const clip=base=>base.slice(0,120-Math.max(copy("").length,copyN("",999).length));', 'const clip=base=>base.slice(0,120-" copia 999".length);'],
  ["M8 la sonda de Present mide el cierre sin el proveedor (en español)", PS, 'cursorVirtual:0}, ()=>"", ()=>null, FluyoI18n.t)', 'cursorVirtual:0}, ()=>"", ()=>null)'],
  ["M9 el Viewer arranca sin el proveedor (errores en español)", VW, "FluyoStoryClock.now(clock, performance.now()), FluyoI18n.t);", "FluyoStoryClock.now(clock, performance.now()));"],
  ["M10 los errores del motor dejan de deduplicarse por texto", SP, "if(!seen.has(msg)){ seen.add(msg); out.push(msg); }", "{ seen.add(msg); out.push(msg); }"],
  ["M11 story-clock no pasa el proveedor a describe (la consecuencia sale en español)", CLOCK, "FluyoStory.describe(phase, scenario, playback, nodeName, edgeEnds, text)", "FluyoStory.describe(phase, scenario, playback, nodeName, edgeEnds)"],
  ["M12 el nombre del elemento (contenido del autor) pasa por el traductor como clave", SP, '(n.label || "").split("\\n")[0].trim() || tx(', 'tx((n.label || "").split("\\n")[0].trim(), (n.label || "").split("\\n")[0].trim()) || tx('],
  ["M13 el español del kernel de model.js cambia («Historia N»)", MODEL, 'const SEED_STORY_ES=n=>"Historia "+n;', 'const SEED_STORY_ES=n=>"Historia n.º "+n;'],
  ["M14 la copia numerada no usa el formateador", MODEL, "while(names.has(candidate)) candidate=copyN(base,n++);", "while(names.has(candidate)) candidate=SEED_COPYN_ES(base,n++);"],
  ["M15 el editor siembra la Historia nueva con el nombre en español fijo", ED, 'story: (n) => FluyoI18n.t("seed.story", "Historia {n}", { n }),', 'story: (n) => "Historia " + n,'],
  ["M16 el kernel guarda el texto de cada error (un cambio de idioma no se nota hasta recargar)", SP, "const msg = (Object.prototype.hasOwnProperty.call(ERROR_MESSAGES, err.code) ? ERROR_MESSAGES[err.code] : ERROR_FALLBACK)(tx);", "const memo = (errorMessages.memo = errorMessages.memo || {}); const msg = memo[err.code] || (memo[err.code] = (Object.prototype.hasOwnProperty.call(ERROR_MESSAGES, err.code) ? ERROR_MESSAGES[err.code] : ERROR_FALLBACK)(tx));"]
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
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-s2b-mut-"));
const list = MUTATIONS.filter((m) => !process.env.ONLY_MUT || m[0].split(" ")[0] === process.env.ONLY_MUT);
let failed = 0;
try {
  const base = path.join(tmp, "base"); fs.mkdirSync(base); copyTree(base);
  const sane = runSuite(base);
  if (sane.code !== 0) { console.error("La copia sin mutar NO pasa:\n" + sane.out.slice(-3000)); process.exit(2); }
  const ran = (sane.out.match(/^# pass (\d+)/m) || [])[1];
  console.log("copia sin mutar: suite OK (" + ran + " tests sin A; 0/" + list.length + " mutaciones aplicadas)");
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
console.log((failed ? "\nFLUYO-I18N-002 S2b mutaciones: " + failed + " sin detectar" : "\nFLUYO-I18N-002 S2b mutaciones: " + list.length + "/" + list.length + " detectadas") + " · " + ((Date.now() - t0) / 1000).toFixed(1) + " s");
process.exit(failed ? 1 : 0);
