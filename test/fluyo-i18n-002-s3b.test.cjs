"use strict";
/* FLUYO-I18N-002 S3b — Propiedades en el idioma de la interfaz, SIN tocar el kernel ni el MCP (decisiones 300–313, D-S3b-1…14).
   · C  Catálogo: las 130 claves de S3b (prop.*, shape.*, la cabecera sel.*) con su texto base EXACTO; inglés completo, mismos
        {param}, sin restos de español; fr/ja/zh sin claves nuevas (caen al inglés, D-S3b-2).
   · H  HTML: #propPanel sin texto por migrar; quitadas las marcas, index.html es el de la base byte a byte (español idéntico,
        identificadores intactos: data-group, data-v, value, ids); translate="no" solo en lo que no se traduce (D-S3b-6); los cinco
        rótulos que pinta JS llevan data-i18n-js con el texto base de su clave.
   · X  Escáner (D-S3b-6): translate="no" exime también los atributos del elemento y de su subárbol; fuera de él, no.
   · J  ui.js: lo que queda sin migrar son los 23 falsos positivos conocidos (teclas, fuentes, marca, grupos del cajón); ninguna
        concatenación de texto (C1–C7 son plantillas); ninguna marca data-i18n* creada desde JS (R2).
   · O  Oráculo: en español, la cabecera (metadato y título, cada forma, con y sin texto, conexiones, multiselección) y los nombres
        de forma y de puntas dan EXACTAMENTE lo de la base (747eff8).
   · E  Inglés, en vivo y CJK de prueba: «Box · id 1», «Connection · 1 → 2», «Box without text», «id 1 → Text»…; cambiar de idioma
        después de cargar cambia los nombres (getters, no valores congelados); fr/ja/zh caen al inglés; una plantilla japonesa de
        prueba sale sin espacios puestos por el código.
   · R  Repintado en vivo (D-S3b-13): paintChromeText repinta muestras especiales, rótulos de rejilla, «⋯» y «(Global)».
   · N  Coherencia (D-S3b-11): prop.orderNote cita el texto de canvas.build y de editor.canvas en cada idioma que tiene las tres.
   · A  Alcance frente a 747eff8: solo estos archivos; undoS3b da la base EXACTA y va encima de undoS3a; kernel y MCP intactos;
        trinquete (index.html 65, ui.js 23); CACHE v115.
   Chrome real: test/fluyo-i18n-002-s3b-browser.cjs. Mutaciones: test/fluyo-i18n-002-s3b-mutations.cjs. */
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const scan = require("./i18n-scan.cjs");

const root = path.join(__dirname, "..");
const gitRoot = process.env.FLUYO_GIT_ROOT || root;
const read = scan.read;
const BASE = "747eff8";
const atBase = (f) => execFileSync("git", ["-C", gitRoot, "show", BASE + ":" + f], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).replace(/\r\n/g, "\n");
const hasGit = (() => { try { atBase("sw.js"); return true; } catch { return false; } })();
const DICT_FILES = fs.readdirSync(path.join(root, "js")).map((f) => "js/" + f).filter((f) => scan.DICT.test(f)).sort();
const PANEL = ['<aside id="propPanel">', '<div id="panelScenarios"'];
const S3B = /^(prop\.|shape\.|sel\.(meta\.|untitled$|edgeTitle$|idRef$))/;
const SPANISH = /[áéíóúñ¿¡«»]|\b(el|la|los|las|de|del|que|una?|para|con|por|sin|caja|texto|código|borde|relleno|fondo|puntas|ninguna?|ruta|flecha|puntos|personalizado)\b/i;

/* El texto base (español) de cada clave de S3b: el de la base, tal cual */
const KEYS = {
  "prop.content.code": "Código", "prop.content.text": "Texto", "prop.border": "Borde", "prop.color": "Color", "prop.panel": "Panel",
  "prop.fill": "Relleno", "prop.codeText": "Texto del código", "prop.blockBg": "Fondo del bloque", "prop.background": "Fondo", "shape.rect": "Caja",
  "shape.cylinder": "BD", "shape.diamond": "Rombo", "shape.circle": "Círculo", "shape.hex": "Hexágono", "shape.text": "Texto", "shape.code": "Código",
  "shape.icon": "Icono", "shape.image": "Imagen", "sel.meta.node": "{shape} · id {id}", "sel.meta.edge": "Conexión · {from} → {to}",
  "sel.untitled": "{shape} sin texto", "shape.unknown": "Elemento", "sel.idRef": "id {id}", "sel.edgeTitle": "{from} → {to}",
  "prop.sw.default": "Piedra (por defecto)", "prop.sw.customHex": "Personalizado {hex}", "prop.sw.autoFill": "Automático (semitransparente)",
  "prop.sw.noFill": "Sin relleno", "prop.sw.noBg": "Sin fondo", "prop.sw.autoText": "Automático (según la forma y el tema)",
  "prop.swg.border": "Color de línea o borde", "prop.swg.fill": "Relleno de la forma", "prop.swg.textBg": "Fondo del texto",
  "prop.swg.text": "Color del texto", "prop.sw.theme": "Del tema", "prop.swg.kwBg": "Fondo del resaltado", "prop.swg.kwText": "Texto del resaltado",
  "prop.eyedropperUnsupported": "Tu navegador no soporta el cuentagotas (usa Chrome o Edge).", "prop.sw.auto": "Auto",
  "prop.swg.line": "Color de línea de la flecha", "prop.swg.dots": "Color de los puntos animados", "prop.sw.less": "Menos colores",
  "prop.sw.moreAriaEyedrop": "Más colores, personalizado y cuentagotas", "prop.sw.moreAria": "Más colores, personalizado", "prop.sw.more": "Más colores",
  "prop.fontGlobal": "(Global)", "prop.arrows.none": "Ninguna", "prop.arrows.start": "Inicio", "prop.arrows.end": "Fin", "prop.arrows.both": "Ambas",
  "prop.group.appearance": "Apariencia", "prop.shape": "Forma", "prop.customBorder": "Color personalizado del borde", "prop.custom": "Personalizado",
  "prop.eyedropperHint": "Cuentagotas: tomar un color del lienzo", "prop.eyedropper": "Cuentagotas", "prop.tint": "Teñir el icono con el color",
  "prop.customFill": "Color de relleno personalizado", "prop.borderLine": "Línea del borde", "prop.line.solid": "Sólido",
  "prop.line.dashed": "Discontinuo", "prop.line.dotted": "Punteado", "prop.group.text": "Texto", "prop.font": "Tipografía",
  "prop.fontSize": "Tamaño de texto", "prop.fontSizeAuto": "auto", "prop.bold": "Negrita", "prop.boldGlyph": "N",
  "prop.customText": "Color de texto personalizado", "prop.customTextBg": "Fondo de texto personalizado", "prop.position": "Posición",
  "prop.pos.center": "Centro", "prop.pos.top": "Arriba", "prop.pos.bottom": "Abajo", "prop.pos.left": "Izquierda", "prop.pos.right": "Derecha",
  "prop.group.code": "Código", "prop.highlight": "Resaltado", "prop.highlight.none": "Ninguno", "prop.highlight.custom": "Lista propia",
  "prop.highlight.noneOpt": "Ninguna", "prop.highlight.customOpt": "Lista propia…", "prop.kwList": "Lista propia (separadas por espacios o comas)",
  "prop.keyword": "Palabra clave", "prop.customKw": "Color de la palabra clave personalizado", "prop.keywordBox": "Caja de la palabra clave",
  "prop.customKwBox": "Caja de la palabra clave personalizada", "prop.group.motion": "Movimiento", "prop.pulse": "Pulso (resaltar)",
  "prop.order": "Orden de aparición", "prop.orderNote": "Se usa con «Animar aparición», en Lienzo.", "prop.group.stroke": "Trazo",
  "prop.customLine": "Color de línea personalizado", "prop.dashed": "Línea punteada", "prop.route": "Ruta", "prop.route.straight": "Recta",
  "prop.route.ortho": "Ortogonal", "prop.autoRouteHint": "Descarta los tramos que has movido a mano y vuelve al ruteo automático (R)",
  "prop.autoRoute": "Volver a la ruta automática", "prop.exitSide": "Sale por", "prop.side.auto": "Auto", "prop.side.n": "Arriba",
  "prop.side.e": "Derecha", "prop.side.s": "Abajo", "prop.side.w": "Izquierda", "prop.entrySide": "Entra por", "prop.group.direction": "Dirección",
  "prop.arrows": "Puntas", "prop.arrowSize": "Tamaño de flecha", "prop.arrowSizeOneHalf": "1,5×", "prop.arrS": "Punta al inicio",
  "prop.arrE": "Punta al final", "prop.animated": "Puntos en movimiento",
  "prop.flowNote": "El sentido de los puntos se elige al ponerlos en movimiento.", "prop.flowDir": "Sentido de los puntos",
  "prop.flow.normal": "Hacia el destino", "prop.flow.reverse": "Hacia el origen", "prop.flow.alternate": "Ida y vuelta", "prop.group.dots": "Puntos",
  "prop.kind": "Semántica", "prop.kind.generic": "Conexión", "prop.kind.flows": "Flujo", "prop.kind.requires": "Requisito",
  "prop.kindNote": "La punta visible apunta en sentido contrario al flujo. El flujo se calcula de origen a destino; la punta solo cambia la apariencia.",
  "prop.dotColor": "Color de puntos", "prop.customDot": "Color de puntos personalizado", "prop.speed": "Velocidad (× global)",
  "prop.speedGlobal": "1× (global)", "prop.dotsGlobal": "Puntos globales", "prop.dotsOwn": "Puntos (esta flecha)"
};

/* ───────── C · catálogo ───────── */
test("C · catálogo: las 130 claves de S3b con su texto base exacto; inglés completo y sin español; fr/ja/zh sin claves nuevas", () => {
  const uses = scan.catalog().uses.filter((u) => S3B.test(u.key));
  assert.deepEqual([...new Set(uses.map((u) => u.key))].sort(), Object.keys(KEYS).sort(), "las claves en uso son exactamente las de S3b");
  assert.equal(Object.keys(KEYS).length, 130);
  for (const u of uses) assert.equal(u.es, KEYS[u.key], u.key + " (" + u.file + ":" + u.line + ")");
  for (const u of uses) assert.ok(u.file === "index.html" || u.file === "js/ui.js", u.key + ": solo index.html y ui.js la usan (" + u.file + ")");
  const d = scan.dictionaries();
  for (const [k, es] of Object.entries(KEYS)) {
    const en = d.en.editor[k];
    assert.ok(typeof en === "string" && en.trim(), "en: " + k);
    assert.ok(!(k in d.en.common), "en: " + k + " va en el diccionario del EDITOR (el Viewer no carga Propiedades)");
    assert.deepEqual(scan.placeholders(en), scan.placeholders(es), "mismos {param}: " + k);
    assert.doesNotMatch(en.replace(/\{\w+\}/g, ""), SPANISH, `en ${k}: «${en}» parece español`);
    for (const lang of ["fr", "ja", "zh"]) assert.ok(!(k in d[lang].editor) && !(k in d[lang].common), lang + " sin " + k + " (D-S3b-2)");
  }
  /* el vocabulario aprobado (D-S3b-10) y los valores que fija la auditoría */
  const en = d.en.editor;
  for (const [k, v] of [["prop.arrows", "Arrowheads"], ["prop.kind", "Semantics"], ["prop.kind.generic", "Connection"], ["prop.kind.flows", "Flow"], ["prop.kind.requires", "Requirement"],
    ["prop.route", "Routing"], ["prop.route.straight", "Straight"], ["prop.route.ortho", "Orthogonal"], ["prop.exitSide", "Leaves from"], ["prop.entrySide", "Enters at"],
    ["prop.flowDir", "Dot direction"], ["prop.order", "Reveal order"], ["prop.boldGlyph", "B"], ["prop.arrowSizeOneHalf", "1.5×"], ["shape.rect", "Box"]])
    assert.equal(en[k], v, k);
});

/* ───────── H · HTML ───────── */
const stripMarks = (html) => html.replace(/ data-i18n(?:-[a-z-]+)?="[^"]*"| translate="no"/g, "");
const region = (html) => html.slice(html.indexOf(PANEL[0]), html.indexOf(PANEL[1]));
test("H · HTML: #propPanel sin texto por migrar; sin las marcas, index.html es el de la base byte a byte; translate=no solo en lo que no se traduce", { skip: !hasGit && "sin git" }, () => {
  assert.deepEqual(scan.unmarked("index.html", ...PANEL), [], "#propPanel sin texto por migrar");
  const now = read("index.html"), base = atBase("index.html");
  assert.equal(stripMarks(now), stripMarks(base), "quitadas las marcas, el HTML es el de la base: mismo español, mismos ids, data-group, data-v y value");
  assert.equal(now.slice(0, now.indexOf(PANEL[0])), base.slice(0, base.indexOf(PANEL[0])), "antes de #propPanel, nada cambia");
  assert.equal(now.slice(now.indexOf(PANEL[1])), base.slice(base.indexOf(PANEL[1])), "después de #propPanel, nada cambia");
  /* identificadores: los grupos se siguen llamando como siempre (lo fijan 018-14b, 018-23) */
  const groups = [...region(now).matchAll(/<details class="pgroup" id="(\w+)" data-group="([^"]+)"/g)].map((m) => m[1] + ":" + m[2]);
  assert.deepEqual(groups, ["grpShape:Apariencia", "grpText:Texto", "grpCode:Código", "grpLayers:Movimiento", "grpStroke:Trazo", "grpRoute:Dirección", "grpFlow:Puntos"]);
  /* translate="no": SQL, «SQL / ksqlDB», 1×–4× y el placeholder de palabras clave de SQL; nada más */
  const nt = [...region(now).matchAll(/<(\w+)([^>]*) translate="no"([^>]*)>([^<]*)/g)].map((m) => m[1] + ":" + (m[4] || (m[2] + m[3]).match(/id="(\w+)"/)[1]));
  assert.deepEqual(nt.sort(), ["button:1×", "button:1×", "button:2×", "button:2×", "button:3×", "button:4×", "button:SQL", "option:1×", "option:2×", "option:2×", "option:3×", "option:4×",
    "option:SQL / ksqlDB", "textarea:kwEdit"].sort());
  /* lo que pinta JS: data-i18n-js con el texto base de su clave (applyDom no lo toca) y ui.js lo pinta por la clave */
  const js = scan.scanHtml(region(now)).marks.filter((m) => m.where === "js").map((m) => m.key + "=" + m.es);
  assert.deepEqual(js, ["editor.properties=Propiedades", "prop.content.text=Texto", "prop.border=Borde", "prop.fill=Relleno", "prop.color=Color", "prop.background=Fondo"]);
  const ui = read("js/ui.js");
  for (const [id, keys] of [["lblEditLbl", ["prop.content.code", "prop.content.text"]], ["colorLbl", ["prop.border", "prop.color"]], ["fillLbl", ["prop.panel", "prop.fill"]],
    ["textColorLbl", ["prop.codeText", "prop.color"]], ["textBgLbl", ["prop.blockBg", "prop.background"]]]) {
    const line = ui.split("\n").find((l) => l.includes('$("' + id + '").textContent'));
    assert.ok(line && keys.every((k) => line.includes('FluyoI18n.t("' + k + '"')), id + ": " + line);
  }
  /* los mismos nombres de forma en los botones, el espejo oculto y SHAPE_NAMES (una clave, tres sitios) */
  for (const v of ["rect", "cylinder", "diamond", "circle", "hex", "text", "code"]) {
    assert.ok(now.includes(`data-v="${v}" aria-label="${KEYS["shape." + v]}" data-tip="${KEYS["shape." + v]}" data-i18n-aria-label="shape.${v}" data-i18n-tip="shape.${v}">`), "botón " + v);
    assert.ok(now.includes(`<option value="${v}" data-i18n="shape.${v}">`), "espejo " + v);
  }
});

/* ───────── X · escáner ───────── */
test("X · escáner (D-S3b-6): translate=no exime también los atributos del elemento y de su subárbol; fuera de él, no", () => {
  const iss = (h) => scan.scanHtml(h).issues.map((i) => i.kind + ":" + i.text);
  assert.deepEqual(iss('<div><textarea placeholder="SELECT FROM WHERE" translate="no"></textarea></div>'), []);
  assert.deepEqual(iss('<div translate="no"><button title="Una ayuda">SQL</button></div>'), []);
  assert.deepEqual(iss('<div><textarea placeholder="SELECT FROM WHERE"></textarea></div>'), ["placeholder:SELECT FROM WHERE"]);
  assert.deepEqual(iss('<div translate="no">1×</div><p title="Una ayuda">Hola</p>'), ["title:Una ayuda", "text:Hola"], "el subárbol se cierra");
  const marks = scan.scanHtml('<div translate="no"><span title="Ayuda" data-i18n-title="a.b">x</span></div>').marks;
  assert.deepEqual(marks.map((m) => m.key), ["a.b"], "una marca dentro de translate=no sigue contando para el catálogo");
});

/* ───────── J · ui.js ───────── */
const LEFT_UI = ["Home", "End", "Enter", "Playfair Display", "IBM Plex Mono", "Fluyo", "Fluyo", "Home", "End", "Enter", "Estados", "General", "Varios",
  "Estados", "General", "Varios", "Azure", "Enter", "Enter", "Escape", "Home", "End", "Escape"];
test("J · ui.js: solo quedan los 23 falsos positivos conocidos; sin concatenar texto; ninguna marca data-i18n* creada desde JS", () => {
  const ui = read("js/ui.js");
  assert.deepEqual(scan.jsHardcoded(ui).map((x) => x.s), LEFT_UI, "teclas, fuentes, la marca y los grupos del cajón (S3a)");
  const code = ui.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  for (const re of [/\+\s*" sin texto"/, /"Personalizado "\s*\+/, /" y cuentagotas"/, /\+\s*" · id "\s*\+/, /"Conexión · "\s*\+/, /\("id "\s*\+/, /\+\s*" → "\s*\+/,
    /"Más colores, personalizado"\s*\+/])
    assert.doesNotMatch(code, re, "concatenación: " + re);
  assert.doesNotMatch(code, /setAttribute\("data-i18n|dataset\.i18n/, "lo que crea JS no lleva marcas data-i18n* (applyDom tomaría el texto traducido como base, R2)");
  assert.match(code, /alert\(FluyoI18n\.t\("prop\.eyedropperUnsupported",/, "el aviso del cuentagotas, en el alert nativo (D-S3b-12, decisión 280)");
});

/* ───────── arnés vm: la cabecera y los nombres, de HOY o de la base ───────── */
function extractFn(src, name) {
  const at = src.indexOf("\nfunction " + name + "(");
  if (at < 0) return null;
  let i = src.indexOf("{", src.indexOf(")", at)), depth = 0, q = null;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (q) { if (ch === "\\") i++; else if (ch === q) q = null; continue; }
    if (ch === '"' || ch === "'" || ch === "`") q = ch;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return src.slice(at + 1, i + 1);
  }
  throw new Error("sin cierre: " + name);
}
function extractConst(src, name) {
  const at = src.indexOf("\nconst " + name + "=");
  if (at < 0) return null;
  const eq = src.indexOf("=", at) + 1;
  if (src[eq] !== "{") return src.slice(at + 1, src.indexOf("\n", at + 1));
  let i = eq, depth = 0, q = null;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (q) { if (ch === "\\") i++; else if (ch === q) q = null; continue; }
    if (ch === '"' || ch === "'" || ch === "`") q = ch;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return src.slice(at + 1, i + 2);
  }
  throw new Error("sin cierre: " + name);
}
function load({ lang = "es", base = false, probe = null } = {}) {
  const ctx = vm.createContext({ Intl, URLSearchParams, console, location: { search: lang === "es" ? "" : "?lang=" + lang }, navigator: { languages: [] },
    document: { documentElement: { lang: "" }, querySelectorAll: () => [] } });
  for (const f of DICT_FILES) vm.runInContext(read(f), ctx, { filename: f });
  if (probe) { ctx.__probe = probe; vm.runInContext("FLUYO_LOCALES.ja = Object.assign({}, FLUYO_LOCALES.ja, __probe);", ctx); }
  vm.runInContext(read("js/i18n.js"), ctx, { filename: "i18n.js" });
  const ui = base ? atBase("js/ui.js") : read("js/ui.js");
  const code = [
    "const __els={}; function $(id){ return __els[id] || (__els[id]={textContent:'', hidden:false}); }",
    "const selN=new Set(), selE=new Set(); let __nodes=[]; function nodeById(id){ return __nodes.find(n=>n.id===id)||null; }",
    extractConst(ui, "SHAPE_NAMES"), extractConst(ui, "firstLine"), extractConst(ui, "selNodesText"), extractConst(ui, "selEdgesText"),
    extractFn(ui, "syncSelMeta"), extractFn(ui, "selTitleText"), extractConst(ui, "ARROW_NAMES")
  ].join("\n");
  vm.runInContext(code, ctx, { filename: "ui.js#cabecera" });
  return (c) => vm.runInContext(c, ctx);
}
const SHAPES = ["rect", "cylinder", "diamond", "circle", "hex", "text", "code", "icon", "image", "anim", "rounded", "cloud", undefined];
/* cabecera: [metadato | oculto | título] de cada selección del corpus */
function head(R) {
  const nodes = [];
  let id = 1;
  for (const shape of SHAPES) for (const label of ["", "Banco\nCentral", "   \n  "]) nodes.push({ id: id++, shape, label });
  R("__nodes=" + JSON.stringify(nodes) + ";");
  const one = (s) => R(`(function(){ const s=${JSON.stringify(s)}; selN.clear(); selE.clear(); syncSelMeta(1, s); return $("selMeta").textContent+"|"+$("selMeta").hidden+"|"+selTitleText(1, s); })()`);
  const out = nodes.map((obj) => one({ type: "node", obj }));
  for (const [from, to, label] of [[1, 2, ""], [2, 5, ""], [1, 999, ""], [999, 998, ""], [2, 5, "pago"], [3, 3, ""]]) out.push(one({ type: "edge", obj: { id: 500, from, to, label } }));
  out.push(R('selN.clear(); selE.clear(); selN.add(1); selN.add(2); selE.add(9); syncSelMeta(3, null); $("selMeta").textContent+"|"+selTitleText(3, null)'));
  out.push(R('selN.clear(); selE.clear(); syncSelMeta(0, null); $("selMeta").textContent+"|"+$("selMeta").hidden+"|"+selTitleText(0, null)'));
  return out;
}
const names = (R) => R("JSON.stringify([['rect','cylinder','diamond','circle','hex','text','code','icon','image','anim','rounded'].map(k=>SHAPE_NAMES[k]), ['none','start','end','both'].map(k=>ARROW_NAMES[k])])");

/* ───────── O · oráculo en español ───────── */
test("O · español IDÉNTICO a 747eff8: metadato y título de cada forma (con y sin texto), conexiones, multiselección; nombres de forma y de puntas", { skip: !hasGit && "sin git" }, () => {
  const now = load(), base = load({ base: true });
  assert.deepEqual(head(now), head(base));
  assert.equal(names(now), names(base));
  assert.equal(names(now), '[["Caja","BD","Rombo","Círculo","Hexágono","Texto","Código","Icono","Imagen","GIF",null],["Ninguna","Inicio","Fin","Ambas"]]');
  const h = head(now);
  assert.ok(h.includes("Caja · id 1|false|Caja sin texto") && h.includes("Conexión · 1 → 2|false|id 1 → Banco") && h.includes("rounded · id 31|false|Elemento sin texto"), h.slice(0, 3).join(" / "));
});

/* ───────── E · inglés, en vivo, reserva y CJK de prueba ───────── */
test("E · inglés: metadato, títulos de reserva y nombres en inglés; en vivo (getters); fr/ja/zh caen al inglés; plantilla CJK sin espacios del código", () => {
  const en = load({ lang: "en" });
  const h = head(en);
  for (const s of ["Box · id 1|false|Box without text", "Box · id 2|false|Banco", "DB · id 4|false|DB without text", "Code · id 19|false|Code without text",
    "GIF · id 28|false|GIF without text", "rounded · id 31|false|Element without text", "Connection · 1 → 2|false|id 1 → Banco", "Connection · 999 → 998|false|id 999 → id 998",
    "Connection · 2 → 5|false|pago", "2 nodes · 1 arrow|3 elements", "|true|Properties"])
    assert.ok(h.includes(s), "en: " + s + " ∉ " + JSON.stringify(h.slice(0, 4)));
  assert.equal(names(en), '[["Box","DB","Diamond","Circle","Hexagon","Text","Code","Icon","Image","GIF",null],["None","Start","End","Both"]]');
  assert.equal(en("JSON.stringify(FluyoI18n.missing())"), "[]", "ninguna clave cae al español");
  /* en vivo: los nombres se leen al usarse (un valor congelado al cargar no se repintaría) */
  en("FluyoI18n.setLocale('es')");
  assert.equal(names(en), names(load()), "en → es después de cargar");
  assert.deepEqual(head(en), head(load()), "la cabecera también");
  /* fr/ja/zh: sin claves de S3b, caen al inglés; nunca al español */
  for (const lang of ["fr", "ja", "zh"]) {
    const o = load({ lang });
    assert.equal(names(o), names(load({ lang: "en" })), lang);
    assert.ok(head(o).includes("Connection · 1 → 2|false|id 1 → Banco"), lang);
  }
  /* CJK de prueba: el orden y los espacios son de la plantilla, no del código (C1–C5) */
  const ja = load({ lang: "ja", probe: { "shape.rect": "箱", "sel.untitled": "「{shape}」無題", "sel.meta.node": "{shape}・ID{id}", "sel.idRef": "ID{id}", "sel.edgeTitle": "{from}→{to}",
    "sel.meta.edge": "接続・{from}→{to}" } });
  const hj = head(ja);
  assert.ok(hj.includes("箱・ID1|false|「箱」無題") && hj.includes("接続・999→998|false|ID999→ID998"), JSON.stringify(hj.slice(0, 2)));
});

/* ───────── R · repintado en vivo ───────── */
test("R · repintado en vivo (D-S3b-13): paintChromeText repinta lo que Propiedades crea una vez; refreshPanel pinta el resto", () => {
  const ui = read("js/ui.js");
  const paint = extractFn(ui, "paintChromeText");
  assert.match(paint, /for\(const sw of document\.querySelectorAll\("#selBody \.swatch"\)\) if\(sw\._name\)\{ const n=sw\._name\(\); sw\.title=n; sw\.setAttribute\("aria-label",n\); \}/, "muestras especiales");
  assert.match(paint, /for\(const id of swatchGrids\(\)\)\{ const g=\$\(id\); if\(!g\) continue; if\(g\._label\) g\.setAttribute\("aria-label",g\._label\(\)\); if\(g\._more\) paintSwatchMore\(g\); \}/, "rejillas y «⋯»");
  assert.match(paint, /fg\.textContent=FluyoI18n\.t\("prop\.fontGlobal","\(Global\)"\)/, "«(Global)»");
  assert.ok(ui.slice(ui.indexOf("FluyoI18n.onChange(")).slice(0, 200).includes("refreshPanel()"), "el resto lo repinta refreshPanel");
  /* quien crea pasa una función (el nombre se vuelve a pedir al cambiar de idioma) */
  for (const k of ["prop.sw.default", "prop.sw.autoFill", "prop.sw.noFill", "prop.sw.noBg", "prop.sw.autoText", "prop.sw.theme", "prop.sw.auto"])
    assert.ok(ui.includes('()=>FluyoI18n.t("' + k + '"'), k);
  assert.equal((ui.match(/enableSwatchKeyboard\("\w+",\(\)=>FluyoI18n\.t\("prop\.swg\.\w+",/g) || []).length, 8, "los 8 rótulos de rejilla");
  assert.match(extractFn(ui, "swatchTitle"), /d\._name=title;/);
  assert.match(extractFn(ui, "toggleSwatches"), /paintSwatchMore\(grid\);/);
});

/* ───────── N · coherencia de prop.orderNote ───────── */
test("N · coherencia (D-S3b-11): prop.orderNote cita el texto de canvas.build y de editor.canvas en cada idioma que tiene las tres", () => {
  const base = new Map(scan.catalog().uses.map((u) => [u.key, u.es]));
  assert.ok(KEYS["prop.orderNote"].includes(base.get("canvas.build")) && KEYS["prop.orderNote"].includes(base.get("editor.canvas")), "español: «Animar aparición», «Lienzo»");
  let langs = 0;
  for (const [lang, d] of Object.entries(scan.dictionaries())) {
    const all = { ...d.common, ...d.editor };
    if (!("prop.orderNote" in all)) continue;
    langs++;
    for (const k of ["canvas.build", "editor.canvas"]) assert.ok(all[k] && all["prop.orderNote"].includes(all[k]), lang + ": prop.orderNote cita " + k + " («" + all[k] + "»)");
  }
  assert.equal(langs, 1, "hoy solo el inglés la tiene");
});

/* ───────── A · alcance ───────── */
const KERNEL_SCRIPTS = ["config.js", "safe-svg.js", "model.js", "scenario-engine.js", "scenario-playback.js", "story-playback.js", "document-integrity.js", "story-authoring.js"];
test("A · alcance frente a 747eff8: solo estos archivos; undoS3b da la base EXACTA y va encima de undoS3a; kernel y MCP intactos; trinquete; CACHE v115", { skip: !hasGit && "sin git" }, () => {
  const { undoS3b, PIECES, NEW_FILES, BASE_S3B } = require("./fluyo-i18n-002-s3b-undo.cjs");
  const { undoEx, PIECES: PIECES_EX, NEW_FILES: NEW_EX } = require("./fluyo-examples-001-undo.cjs");   /* FLUYO-EXAMPLES-001 va encima de S3b (undoS3b la deshace antes) */
  /* lo que solo cambia FLUYO-EXAMPLES-001 (sin ella, igual que la base) no cuenta para el alcance de S3b */
  const exOnly = (f) => NEW_EX.includes(f) || (!!PIECES_EX[f] && !Object.keys(PIECES).includes(f) && undoEx(f, read(f)) === atBase(f));
  assert.equal(BASE_S3B, BASE);
  assert.deepEqual(NEW_FILES, []);
  const FILES = ["index.html", "js/i18n-en-editor.js", "js/ui.js"];
  assert.deepEqual(Object.keys(PIECES).sort(), FILES);
  const SERVED = ["js", "s", "css", "assets", "index.html", "404.html", "sw.js", "manifest.webmanifest", "docs", "ejemplos", "privacidad", "privacy", "soporte", "support", "terminos", "terms"];
  const changed = execFileSync("git", ["-C", gitRoot, "diff", "--name-only", BASE, "--", ...SERVED], { encoding: "utf8" }).split("\n").filter(Boolean).filter((f) => !exOnly(f));
  const untracked = execFileSync("git", ["-C", gitRoot, "ls-files", "--others", "--exclude-standard", "--", ...SERVED], { encoding: "utf8" }).split("\n").filter(Boolean).filter((f) => !exOnly(f));
  assert.deepEqual([...new Set([...changed, ...untracked])].sort(), [...FILES, "sw.js"].sort());
  for (const f of FILES) assert.equal(undoS3b(f, read(f)), atBase(f), f + ": undoS3b exacto");
  assert.equal(undoEx("sw.js", read("sw.js")).replace('"fluyo-static-v116"', '"fluyo-static-v' + (115 - 1) + '"'), atBase("sw.js"), "sw.js: solo CACHE (sin archivos nuevos)");
  assert.match(read("sw.js"), /const CACHE = "fluyo-static-v116";/);
  assert.ok(read("test/fluyo-i18n-002-s3a-undo.cjs").includes("src = undoS3b(file, src);"), "undoS3a deshace antes esta tarea");
  for (const f of [...KERNEL_SCRIPTS.map((k) => "js/" + k), "js/state.js", "js/selection.js", "js/interaction.js", "js/render.js", "js/i18n.js", "js/i18n-en.js", "js/i18n-fr.js",
    "js/i18n-ja.js", "js/i18n-zh.js", "js/i18n-fr-editor.js", "js/i18n-ja-editor.js", "js/i18n-zh-editor.js", "js/editor-scenarios.js", "s/index.html", "404.html", "css/system.css", "css/styles.css"])
    assert.equal(read(f), atBase(f), f + " sin cambios");
  for (const f of KERNEL_SCRIPTS) assert.doesNotMatch(read("js/" + f).replace(/\/\*[\s\S]*?\*\//g, ""), /FluyoI18n/, f + ": no nombra la interfaz");
  const mcp = path.join(root, "..", "fluyo-mcp", "src", "generated", "kernel-sources.ts");
  if (fs.existsSync(mcp)) {
    const ts = fs.readFileSync(mcp, "utf8");
    const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
    for (const f of KERNEL_SCRIPTS) {
      const raw = execFileSync("git", ["-C", gitRoot, "show", BASE + ":js/" + f]);
      assert.ok(ts.includes(`name: "${f}",\n    sha256: "${sha(raw)}"`), f + ": el MCP lleva este archivo");
    }
  }
  const bl = JSON.parse(read("test/fluyo-i18n-001-baseline.json"));
  assert.equal(bl.html["index.html"], 65, "trinquete: index.html 219 → 65");
  assert.equal(bl.js["js/ui.js"], 23, "trinquete: ui.js 70 → 23");
  const h = scan.hardcoded();
  assert.equal(h.html["index.html"], 65); assert.equal(h.js["js/ui.js"], 23);
});
