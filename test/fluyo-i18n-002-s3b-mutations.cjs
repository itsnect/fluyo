"use strict";
/* FLUYO-I18N-002 S3b — Mutaciones sobre COPIAS aisladas (nunca sobre el árbol). Cada regresión real de S3b debe hacer fallar su suite:
   · U*: test/fluyo-i18n-002-s3b.test.cjs SIN su test de alcance (A), que compara el texto con la base y detectaría cualquier mutación
     sin probar nada (un rótulo sin marca, un nombre de forma fijo en español, una concatenación que vuelve, una clave que falta en
     inglés, un identificador traducido, la nota de «Orden de aparición» que deja de citar «Animate reveal», un NT que pierde
     translate="no", un nombre congelado al cargar, un español distinto del de la base…).
   · A*: solo el test de alcance (A): CACHE y undoS3b, que son justamente lo que vigila.
   · B*: test/fluyo-i18n-002-s3b-browser.cjs en Chrome real, solo la parte EN VIVO (ONLY=vivo): el repintado al cambiar de idioma, el
     segmentado que escribe su valor (no su texto) y el cambio de idioma que no toca Deshacer.
   Uso: node test/fluyo-i18n-002-s3b-mutations.cjs   (ONLY_MUT=U3 una sola; SKIP_BROWSER=1 solo U y A) */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const NL = "\n", CRLF = "\r\n";
const UNIT = ["--test", "--test-skip-pattern=^A · ", "test/fluyo-i18n-002-s3b.test.cjs"];
const SCOPE = ["--test", "--test-name-pattern=^A · ", "test/fluyo-i18n-002-s3b.test.cjs"];
const BROWSER = ["test/fluyo-i18n-002-s3b-browser.cjs"];
const HTML = "index.html", UI = "js/ui.js", EN = "js/i18n-en-editor.js", SW = "sw.js", UNDO = "test/fluyo-i18n-002-s3b-undo.cjs";
/* [nombre, suite, archivo, desde, hasta] */
const MUTATIONS = [
  ["U1 un título de grupo pierde su marca", UNIT, HTML, '<span class="pgTitle" data-i18n="prop.group.motion">Movimiento</span>', '<span class="pgTitle">Movimiento</span>'],
  ["U2 un nombre de forma vuelve a ser español fijo", UNIT, UI, 'get rect(){ return FluyoI18n.t("shape.rect","Caja"); }', 'rect:"Caja"'],
  ["U3 «{forma} sin texto» vuelve a concatenarse (rompe ja/zh)", UNIT, UI, 'return FluyoI18n.t("sel.untitled","{shape} sin texto",{shape:SHAPE_NAMES[o.shape]||FluyoI18n.t("shape.unknown","Elemento")});',
    'return (SHAPE_NAMES[o.shape]||FluyoI18n.t("shape.unknown","Elemento"))+" sin texto";'],
  ["U4 «⋯» vuelve a pegar « y cuentagotas»", UNIT, UI, ': grid.id==="swatches" ? FluyoI18n.t("prop.sw.moreAriaEyedrop","Más colores, personalizado y cuentagotas") : FluyoI18n.t("prop.sw.moreAria","Más colores, personalizado"));',
    ': FluyoI18n.t("prop.sw.moreAria","Más colores, personalizado")+(grid.id==="swatches" ? " y cuentagotas" : ""));'],
  ["U5 el metadato vuelve a concatenarse", UNIT, UI, 'FluyoI18n.t("sel.meta.node","{shape} · id {id}",{shape:SHAPE_NAMES[s.obj.shape]||s.obj.shape, id:s.obj.id})', '(SHAPE_NAMES[s.obj.shape]||s.obj.shape)+" · id "+s.obj.id'],
  ["U6 refreshPanel deja «Borde» fijo", UNIT, UI, 'hasBox||esCode ? FluyoI18n.t("prop.border","Borde") :', 'hasBox||esCode ? "Borde" :'],
  ["U7 falta una clave en el inglés (cae al español)", UNIT, EN, '  "prop.arrowSizeOneHalf":"1.5×",\n', ""],
  ["U8 se traduce un identificador de grupo (data-group)", UNIT, HTML, 'data-group="Movimiento"', 'data-group="Motion"'],
  ["U9 la nota de «Orden de aparición» deja de citar «Animate reveal»", UNIT, EN, '"prop.orderNote":"Used with “Animate reveal”, under Canvas."', '"prop.orderNote":"Used with “Reveal”, under Canvas."'],
  ["U10 un NT pierde translate=\"no\" (1×)", UNIT, HTML, '<option value="1" translate="no">1×</option>', '<option value="1">1×</option>'],
  ["U11 el aviso del cuentagotas vuelve a ser español fijo", UNIT, UI, 'alert(FluyoI18n.t("prop.eyedropperUnsupported","Tu navegador no soporta el cuentagotas (usa Chrome o Edge)."))', 'alert("Tu navegador no soporta el cuentagotas (usa Chrome o Edge).")'],
  ["U12 un nombre de punta se congela al cargar (sin getter)", UNIT, UI, 'get none(){ return FluyoI18n.t("prop.arrows.none","Ninguna"); }', 'none:FluyoI18n.t("prop.arrows.none","Ninguna")'],
  ["U13 cambia el español de un rótulo", UNIT, HTML, 'data-i18n="prop.dotsGlobal">Puntos globales</label>', 'data-i18n="prop.dotsGlobal">Puntos global</label>'],
  ["U14 una muestra especial pasa su nombre ya hecho (no se repinta)", UNIT, UI, '{label:()=>FluyoI18n.t("prop.sw.noFill","Sin relleno"), value:"none"', '{label:FluyoI18n.t("prop.sw.noFill","Sin relleno"), value:"none"'],
  ["U15 un rótulo que pinta JS pierde data-i18n-js", UNIT, HTML, '<span class="lblText" id="colorLbl" data-i18n-js="prop.border">Borde</span>', '<span class="lblText" id="colorLbl">Borde</span>'],
  ["U16 el escáner deja de eximir los atributos de translate=no", UNIT, "test/i18n-scan.cjs", 'else if (!noTranslate && !BRAND.test(attrs[a].trim()))', "else if (!BRAND.test(attrs[a].trim()))"],
  ["A1 CACHE no sube (sigue v114)", SCOPE, SW, 'const CACHE = "fluyo-static-v115";', 'const CACHE = "fluyo-static-v114";'],
  ["A2 undoS3b deja de ser exacto", SCOPE, UNDO, "prop.group.motion", "prop.group.motionX"],
  ["B1 paintChromeText no repinta las muestras especiales", BROWSER, UI, '  for(const sw of document.querySelectorAll("#selBody .swatch")) if(sw._name){ const n=sw._name(); sw.title=n; sw.setAttribute("aria-label",n); }\n', ""],
  ["B2 paintChromeText no repinta el rótulo de las rejillas", BROWSER, UI, 'if(g._label) g.setAttribute("aria-label",g._label()); ', ""],
  ["B3 «(Global)» no se repinta", BROWSER, UI, '  if(fg) fg.textContent=FluyoI18n.t("prop.fontGlobal","(Global)");\n', ""],
  ["B4 un segmentado escribe su texto en vez de su valor", BROWSER, UI, 'onPick(b.dataset.v); }));', 'onPick(b.textContent.trim() || b.dataset.v); }));'],
  ["B5 cambiar de idioma apila una entrada de Undo", BROWSER, UI, "FluyoI18n.onChange(()=>{\n  closePageMenu(false);", "FluyoI18n.onChange(()=>{\n  pushUndo();\n  closePageMenu(false);"]
];

function copyTree(dest) {
  for (const entry of fs.readdirSync(root).filter((e) => e !== ".git" && e !== "node_modules")) fs.cpSync(path.join(root, entry), path.join(dest, entry), { recursive: true });
}
function runSuite(dir, args) {
  const browser = args === BROWSER;
  const r = spawnSync(process.execPath, args, { cwd: dir, encoding: "utf8", timeout: browser ? 900000 : 300000,
    env: { ...process.env, FLUYO_GIT_ROOT: root, FLUYO_ROOT: dir, ONLY: browser ? "vivo" : "" } });
  return { code: r.status, timedOut: !!(r.error && r.error.code === "ETIMEDOUT"), out: (r.stdout || "") + (r.stderr || "") };
}

const t0 = Date.now();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-s3b-mut-"));
const list = MUTATIONS.filter((m) => (!process.env.ONLY_MUT || m[0].split(" ")[0] === process.env.ONLY_MUT) && !(process.env.SKIP_BROWSER && m[1] === BROWSER));
let failed = 0;
try {
  const base = path.join(tmp, "base"); fs.mkdirSync(base); copyTree(base);
  for (const args of [...new Set(list.map((m) => m[1]))]) {
    const sane = runSuite(base, args);
    if (sane.code !== 0) { console.error("La copia sin mutar NO pasa " + args.join(" ") + ":\n" + sane.out.slice(-3000)); process.exit(2); }
  }
  console.log("copia sin mutar: suites OK (0/" + list.length + " mutaciones aplicadas)");
  list.forEach(([name, args, file, from, to], i) => {
    const dir = path.join(tmp, "m" + i); fs.mkdirSync(dir); copyTree(dir);
    const p = path.join(dir, file);
    const src = fs.readFileSync(p, "utf8"), crlf = src.includes(CRLF);
    const text = src.replaceAll(CRLF, NL);
    if (!text.includes(from)) { console.log("  ✘ " + name + " — el patrón no existe (mutación obsoleta)"); failed++; return; }
    fs.writeFileSync(p, text.replace(from, () => to).replaceAll(NL, crlf ? CRLF : NL));
    const r = runSuite(dir, args);
    const killed = r.code !== 0;
    const n = (r.out.match(/^not ok |^\s+✘ /gm) || []).length;
    console.log((killed ? "  ✔ detectada  " : "  ✘ SOBREVIVE  ") + name + (killed ? (r.timedOut || r.code === null ? "  (cuelga: muere por tiempo)" : "  (" + n + " comprobaciones fallan)") : ""));
    if (!killed) failed++;
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  });
} finally {
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
}
console.log((failed ? "\nFLUYO-I18N-002 S3b mutaciones: " + failed + " sin detectar u obsoletas" : "\nFLUYO-I18N-002 S3b mutaciones: " + list.length + "/" + list.length + " detectadas") + " · " + ((Date.now() - t0) / 1000).toFixed(1) + " s");
process.exit(failed ? 1 : 0);
