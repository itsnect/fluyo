"use strict";
/* FLUYO-I18N-002 S2a — Mutaciones sobre COPIAS aisladas (nunca sobre el árbol). Cada regresión real de S2a (volver a pegar una frase,
   cambiar un parámetro de sitio, perder una clave del inglés, traducir contenido del autor, la «y» de lista a mano, el español que
   cambia, el registro escapado, el repintado en vivo, una marca del HTML, la sonda de Present) debe hacer fallar
   test/fluyo-i18n-002-s2a.test.cjs SIN contar su test de alcance (A), que compara el texto con la base y detectaría cualquier mutación
   sin probar nada. Uso: node test/fluyo-i18n-002-s2a-mutations.cjs   (ONLY_MUT=M3 una sola) */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const NL = "\n", CRLF = "\r\n";
const UNIT = ["--test", "--test-skip-pattern=^A · ", "test/fluyo-i18n-002-s2a.test.cjs"];
const ED = "js/editor-scenarios.js", SEL = "js/selection.js", I18N = "js/i18n.js", EN = "js/i18n-en-editor.js", PS = "js/present-story.js", HTML = "index.html";
/* [nombre, archivo, desde, hasta] */
const MUTATIONS = [
  ["M1 «{name} ocurre» se vuelve a pegar (nombre + verbo)", ED, 'FluyoI18n.t("step.row.occurs", "{name} ocurre", { name: label })', 'label + " " + FluyoI18n.t("trace.occurs", "Ocurre").toLowerCase()'],
  ["M2 dos parámetros cambian de sitio", ED, 'FluyoI18n.t("step.editEventUses", "Cambia «{name}» en sus {count} usos", { name: et.name, count: uses })', 'FluyoI18n.t("step.editEventUses", "Cambia «{name}» en sus {count} usos", { name: uses, count: et.name })'],
  ["M3 una clave falta en el inglés (cae al español)", EN, '  "stories.new":"New story",\n', ""],
  ["M4 el nombre de un elemento del autor pasa por FluyoI18n.t (se traduciría)", ED, '  return scNodeLabel(id) || FluyoI18n.t("story.unnamed", "Elemento sin nombre");', '  return (scNodeLabel(id) && FluyoI18n.t(scNodeLabel(id), scNodeLabel(id))) || FluyoI18n.t("story.unnamed", "Elemento sin nombre");'],
  ["M5 la lista de llegadas vuelve a unirse con « y » a mano", ED, "  return FluyoI18n.list(ids", "  return (ids"],
  ["M6 la lista de la página se une a mano", SEL, '  const list=FluyoI18n.list(parts, withStories ? "confirm.page.hasStories" : "confirm.page.has");', '  const list=parts.slice(0,-1).join(", ")+(parts.length>1?" y ":"")+parts[parts.length-1];'],
  ["M7 el español cambia un texto («Al comenzar»)", ED, 'g.at === 0 ? FluyoI18n.t("moment.atStart", "Al comenzar")', 'g.at === 0 ? FluyoI18n.t("moment.atStart", "Al empezar")'],
  ["M8 el español une las llegadas con comas (Intl también en español)", I18N, '    if(lang===BASE) return esStyle==="repeat" ? xs.join(" y ") : xs.slice(0,-1).join(", ")+" y "+xs[xs.length-1];\n', ""],
  ["M9 el registro vuelve a escapar HTML dentro de textContent", ED, '      body.textContent = time + "  " + lbl + "  " + FluyoI18n.t("trace.occurs", "Ocurre");', '      body.textContent = time + "  " + escapeHtml(lbl) + "  " + FluyoI18n.t("trace.occurs", "Ocurre");'],
  ["M10 el cambio de idioma en vivo no repinta la hoja", ED, "    scNowLast = \"\";\n    scFlowLast = null;\n    scRenderPanel();\n", "    scNowLast = \"\";\n    scFlowLast = null;\n"],
  ["M11 el botón Reproducir pierde su marca", HTML, '<button id="scRun" type="button" class="primary" data-i18n-js="story.play">', '<button id="scRun" type="button" class="primary">'],
  ["M12 la sonda de Present vuelve a medir «En pausa» en español", PS, 'end ? end.caption : FluyoI18n.t("story.paused","En pausa")', 'end ? end.caption : "En pausa"'],
  ["M13 el plural de una confirmación se pierde (siempre «momentos»)", SEL, 'FluyoI18n.t("confirm.delete.moments",{one:"{count} momento", other:"{count} momentos"},{count:s.moments});', 'FluyoI18n.t("confirm.delete.moments","{count} momentos",{count:s.moments});'],
  ["M14 la frase de un evento nuevo deja de nacer en el idioma de la interfaz", ED, '  get connection() { return FluyoI18n.t("event.defaultPhraseEdge", "{source} envía a {target}"); },', '  connection: "{source} envía a {target}",'],
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
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-s2a-mut-"));
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
console.log((failed ? "\nFLUYO-I18N-002 S2a mutaciones: " + failed + " sin detectar" : "\nFLUYO-I18N-002 S2a mutaciones: " + list.length + "/" + list.length + " detectadas") + " · " + ((Date.now() - t0) / 1000).toFixed(1) + " s");
process.exit(failed ? 1 : 0);
