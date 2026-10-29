"use strict";
/* FLUYO-STORIES-2.0 S2a — Mutaciones sobre COPIAS aisladas (nunca sobre el árbol). Cada regresión real de «Portada y otras formas»
   (la familia en el enlace, la casilla, la portada, «Otras formas», elegir otra forma, las reglas compartidas) debe hacer fallar
   test/fluyo-stories-2-0-s2a.test.cjs SIN contar C1 ni C2 (comparan con la base por git). Present lo cubre el QA en Chrome (D).
   Uso: node test/fluyo-stories-2-0-s2a-mutations.cjs   (ONLY_MUT=M3 una sola) */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const NL = "\n", CRLF = "\r\n";
const UNIT = ["--test", "--test-skip-pattern=^C[12] ", "test/fluyo-stories-2-0-s2a.test.cjs"];
const SU = "js/share-url.js", ES = "js/editor-share.js", SC = "js/story-clock.js", VW = "js/viewer.js", EN = "js/i18n-en.js";
/* [nombre, archivo, desde, hasta] */
const MUTATIONS = [
  /* Share */
  ["M1 la familia nunca viaja", SU, `options.withOthers?current.scenarios`, `false?current.scenarios`],
  ["M2 viajan también las Historias vacías", SU, `s!==selected&&s.steps.length>0`, `s!==selected`],
  ["M3 la elegida deja de ser scenarios[0]", SU, `current.scenarios=[selected,...others]`, `current.scenarios=[...others,selected]`],
  ["M4 la familia viaja aunque se desmarque", ES, `shareOthers(story).length>0 && shareControl("shareOthers").checked`, `shareOthers(story).length>0`],
  ["M5 el diálogo no pide la familia", ES, `{kind,scenarioId:story.id,withOthers}`, `{kind,scenarioId:story.id}`],
  ["M6 la casilla no vuelve a marcarse al abrir", ES, `  shareControl("shareOthers").checked=true;\n`, ``],
  ["M7 si no cabe, falla en vez de quitar la familia", ES, `      if(!withOthers || !shareTooBig(e)) throw e;\n`, `      throw e;\n`],
  ["M8 la casilla sale aunque no haya otras formas", ES, `shareControl("shareOthersRow").hidden=!others.length;`, `shareControl("shareOthersRow").hidden=false;`],
  /* reglas compartidas */
  ["M9 la portada no enseña el desenlace", SC, `if(phase==="ready") return outcomeText(outcomeOf(page, scenario), text);`, `if(phase==="ready") return "";`],
  ["M10 «Otras formas» incluye la propia", SC, `s && s!==scenario && !(scenario && s.id===scenario.id) && Array.isArray`, `s && Array.isArray`],
  ["M11 «Otras formas» incluye las vacías", SC, ` && Array.isArray(s.steps) && s.steps.length>0);`, `);`],
  ["M12 la semilla «Página N» se enseña como sistema", SC, `if(!name || /^(Página|Page) \\d+$/.test(name)) return "";`, `if(!name) return "";`],
  ["M13 la semilla del idioma activo se enseña", SC, `\n        && /^\\d+$/.test(name.slice(parts[0].length, name.length-parts[1].length))) return "";`, `\n        && false) return "";`],
  ["M14 outcomeOf no es el desenlace del motor", SC, `value = run.ok ? outcome(scenario, run.trace) : null;`, `value = run.ok ? {ok:true} : null;`],
  /* Viewer */
  ["M15 el Viewer no enseña el sistema", VW, `(FluyoStoryClock.systemName(P(), FluyoI18n.t) || FluyoI18n.t("story.group","Historia"))`, `FluyoI18n.t("story.group","Historia")`],
  ["M16 «Otras formas» no aparece al terminar", VW, `storyOthers(phase==="finished" ? FluyoStoryClock.otherForms(P(), sc).slice(0, 3) : []);`, `storyOthers([]);`],
  ["M17 «Otras formas» ya en la portada", VW, `storyOthers(phase==="finished" ?`, `storyOthers(phase!=="playing" ?`],
  ["M18 elegir otra forma no la abre", VW, `  storyChoice=id;\n  storyStop();`, `  storyStop();`],
  ["M19 la elegida se ignora", VW, `  return (storyChoice!==null && pg.scenarios.find(s=>s.id===storyChoice && s.steps.length)) || sc;`, `  return sc;`],
  ["M20 la lista no dice cómo acaba cada una", VW, `out.textContent=it.outcome;`, `out.textContent="";`],
  ["M21 «Other ways» no está en inglés", EN, `  "story.others":"Other ways",\n`, ``],
];

function copyTree(dest) {
  for (const entry of ["js", "css", "test", "s", "ejemplos", "sw.js", "index.html"]) fs.cpSync(path.join(root, entry), path.join(dest, entry), { recursive: true });
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
console.log((failed ? "\nFLUYO-STORIES-2.0 S2a mutaciones: " + failed + " sin detectar" : "\nFLUYO-STORIES-2.0 S2a mutaciones: " + list.length + "/" + list.length + " detectadas") + " · " + ((Date.now() - t0) / 1000).toFixed(1) + " s");
process.exit(failed ? 1 : 0);
