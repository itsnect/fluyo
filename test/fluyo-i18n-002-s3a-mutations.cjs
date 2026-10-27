"use strict";
/* FLUYO-I18N-002 S3a — Mutaciones sobre COPIAS aisladas (nunca sobre el árbol). Cada regresión real de S3a (un valor sembrado que
   vuelve a salir del kernel en español, un nombre que se retraduce al cambiar de idioma, una clave desalineada de config.js, una marca
   traducida, el kernel que nombra la interfaz, una clave que falta, la primera página renombrada sobre un documento con contenido, el
   cajón que vuelve a leer config.js, los grupos Seguridad y DevOps pintados, la reserva en español de render.js, el nombre libre del
   ejemplo buscado en español, la reserva «Origen» del kernel) debe hacer fallar test/fluyo-i18n-002-s3a.test.cjs SIN contar su test de
   alcance (A), que compara el texto con la base y detectaría cualquier mutación sin probar nada.
   Uso: node test/fluyo-i18n-002-s3a-mutations.cjs   (ONLY_MUT=M3 una sola) */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const NL = "\n", CRLF = "\r\n";
const UNIT = ["--test", "--test-skip-pattern=^A · ", "test/fluyo-i18n-002-s3a.test.cjs"];
const ST = "js/state.js", UI = "js/ui.js", IA = "js/interaction.js", EX = "js/export.js", RD = "js/render.js", ED = "js/editor-scenarios.js", MODEL = "js/model.js", EN = "js/i18n-en-editor.js";
const FIRST = 'if(typeof FluyoI18n==="object" && doc.pages.length===1 && !doc.pages[0].nodes.length && !doc.pages[0].edges.length) renamePageIn(doc, 0, seedPageName(1));';
/* [nombre, archivo, desde, hasta] */
const MUTATIONS = [
  ["M1 una forma nueva vuelve a nacer con el «Nodo» del kernel", ST, "Object.assign({shape, x:snapV(x), y:snapV(y)}, seedNodeLabel(shape), extra)", "Object.assign({shape, x:snapV(x), y:snapV(y)}, extra)"],
  ["M2 cambiar de idioma renombra las páginas (retraducir contenido)", ST, FIRST, FIRST + " FluyoI18n.onChange(()=>{ for(let i=0;i<doc.pages.length;i++) doc.pages[i].name=seedPageName(i+1); });"],
  ["M3 una clave de icono se desalinea de config.js", ST, 'db:()=>FluyoI18n.t("icon.db","BD")', 'db:()=>FluyoI18n.t("icon.db","B.D.")'],
  ["M4 se traduce una marca (Kafka)", ST, 'db:()=>FluyoI18n.t("icon.db","BD"),', 'kafka:()=>FluyoI18n.t("icon.kafka","Kafka"), db:()=>FluyoI18n.t("icon.db","BD"),'],
  ["M5 el kernel nombra la interfaz (createPageIn traduce)", MODEL, 'const pageName=name===undefined? "Página "+(d.pages.length+1) : pageNameOf(name);', 'const pageName=name===undefined? FluyoI18n.t("page.untitled","Página {n}",{n:d.pages.length+1}) : pageNameOf(name);'],
  ["M6 falta una clave en el inglés (cae al español)", EN, '  "seed.node":"Node",\n', ""],
  ["M7 la primera página se renombra aunque el documento traiga contenido", ST, " && !doc.pages[0].nodes.length && !doc.pages[0].edges.length) renamePageIn(", ") renamePageIn("],
  ["M8 el icono soltado vuelve a tomar el nombre de config.js", IA, "label:iconName(pendingIcon)", "label:ICONS[pendingIcon].n"],
  ["M9 el cajón pinta Seguridad y DevOps (fuera de S3a, D-S3-12 = a)", UI, 'for(const g of ["Estados","General","Varios","GCP","AWS","Azure"]){', 'for(const g of ["Estados","General","Varios","Seguridad","DevOps","GCP","AWS","Azure"]){'],
  ["M10 render.js recupera la reserva en español", RD, 'const emptyHint = opts.emptyHint ?? "";', 'const emptyHint = opts.emptyHint ?? "Elige una forma o icono a la izquierda y haz clic aquí — o pulsa «Ejemplo»";'],
  ["M11 el nombre libre del ejemplo se busca en español", EX, "if(!used.has(first)) return first;", 'if(!used.has("Ejemplo")) return first;'],
  ["M12 la frase vuelve a dejar «Origen» al kernel", ED, "e ? scNodeFallback(e.from) : scSourceFallback(),", "e ? scNodeFallback(e.from) : null,"],
  ["M13 la paleta de la flecha vuelve a leer config.js", UI, "mk(p.c,paletteName(p)).dataset.palette=p.c;", "mk(p.c,p.n).dataset.palette=p.c;"],
  ["M14 un bloque de código nace con «Node» en vez de su SQL", ST, '|| shape==="code" || shape==="icon"', '|| shape==="icon"'],
  ["M15 el título del ejemplo queda en español", EX, '{label:FluyoI18n.t("example.title","Funnel de ventas")}', '{label:"Funnel de ventas"}']
];

function copyTree(dest) {
  for (const entry of fs.readdirSync(root).filter((e) => e !== ".git" && e !== "node_modules")) {
    const from = path.join(root, entry);
    if (fs.existsSync(from)) fs.cpSync(from, path.join(dest, entry), { recursive: true });
  }
}
function runSuite(dir) {
  const r = spawnSync(process.execPath, UNIT, { cwd: dir, encoding: "utf8", timeout: 300000, env: { ...process.env, FLUYO_GIT_ROOT: root, FLUYO_ROOT: dir } });
  return { code: r.status, timedOut: !!(r.error && r.error.code === "ETIMEDOUT") || r.signal === "SIGTERM", out: (r.stdout || "") + (r.stderr || "") };
}

const t0 = Date.now();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-s3a-mut-"));
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
console.log((failed ? "\nFLUYO-I18N-002 S3a mutaciones: " + failed + " sin detectar" : "\nFLUYO-I18N-002 S3a mutaciones: " + list.length + "/" + list.length + " detectadas") + " · " + ((Date.now() - t0) / 1000).toFixed(1) + " s");
process.exit(failed ? 1 : 0);
