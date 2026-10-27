"use strict";
/* FLUYO-I18N-002 S3a — Lo que siembra el editor y los nombres de config.js, en el idioma de la interfaz, SIN tocar el kernel ni el MCP
   (decisiones 282, 284, 285 y 288; D-S3-12 = a).
   · O  Oráculo: en español, el código de la base (7305355) y el de ahora dan EXACTAMENTE lo mismo, ejecutados sobre el mismo corpus:
        primera página, página nueva, «Nodo»/«Texto» de cada forma, el ejemplo incorporado (documento entero) con y sin «Ejemplo»
        ocupado, los nombres de iconos, GIFs y paleta, y la frase de un evento de elemento con {source}.
   · E  Inglés: «Page 1», «Page 2», «Node», «Text», el ejemplo («Example», «Example 2», «Sales funnel»…), «DB», «Loading», «Service»,
        «Source»; las marcas tal cual; fr/ja/zh caen al inglés, nunca al español.
   · N  Nunca se retraduce: cambiar de idioma no renombra nada; un documento que ya trae «Página 1» (sesión, archivo, enlace) no se
        toca; un nombre sembrado en otro idioma es contenido.
   · C  Catálogo de config.js: cada nombre traducible tiene su clave con el texto base EXACTO de config.js; la lista de marcas sin
        clave es exacta; el inglés las trae todas.
   · D  D-S3-12 = a: los rótulos de Seguridad y DevOps están preparados, y la lista de grupos que pinta el cajón es la de la base.
   · K  Kernel y MCP: los ocho archivos del kernel (y story-clock, flow-semantics) idénticos a la base; ninguno nombra FluyoI18n;
        el kernel-sources.ts del MCP, si está al lado, es este kernel.
   · S  Estático: quien siembra pasa el valor traducido; render.js sin reserva en español; las claves de S3a en el diccionario del
        editor (page.untitled, la común, ya existía); fr/ja/zh sin claves nuevas.
   · A  Alcance frente a 7305355: solo estos archivos; undoS3a da la base EXACTA y va encima de undoS2b; CACHE v114.
   Chrome real: test/fluyo-i18n-002-s3a-browser.cjs. Mutaciones: test/fluyo-i18n-002-s3a-mutations.cjs. */
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
const BASE = "7305355";
const atBase = (f) => execFileSync("git", ["-C", gitRoot, "show", BASE + ":" + f], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).replace(/\r\n/g, "\n");
const hasGit = (() => { try { atBase("sw.js"); return true; } catch { return false; } })();
const DICT_FILES = fs.readdirSync(path.join(root, "js")).map((f) => "js/" + f).filter((f) => scan.DICT.test(f)).sort();
const SPANISH = /[áéíóúñ¿¡«»]|\b(página|nodo|texto|ejemplo|usuario|cargando|servicio|origen|visitantes|cliente|descartado|formulario|firma)\b/i;
/* Lo que no lleva clave (D-S3-4, decisión 284): marcas de producto y siglas universales, y los grupos de nube enteros */
const ICON_BRANDS = ["kafka", "k8s", "web", "api", "cron", "webhook", "pipeline", "cdn", "dns", "git", "docker"];
const BRAND_GROUPS = ["GCP", "AWS", "Azure"];

/* ───────── arnés: kernel + FluyoI18n (en un idioma) + las piezas del editor que siembran, de HOY o de la base ───────── */
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
/* `const NOMBRE=` hasta el fin de la sentencia (un objeto entre llaves o una línea) */
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
/* La primera página del documento en blanco (state.js, nivel superior) */
const firstPageStatement = (src) => (src.match(/^if\(typeof FluyoI18n==="object" && doc\.pages\.length===1[^\n]*$/m) || [null])[0];
/* El manejador del botón «Ejemplo» (export.js) */
function demoHandler(src) {
  const at = src.indexOf('$("btnDemo").onclick=');
  return at < 0 ? null : src.slice(at, src.indexOf("\n};", at) + 3);
}
const STATE_FNS = ["newNode", "seedNodeLabel", "newEdge", "addPage", "renamePage", "seedPageName", "iconName", "animName", "paletteName"];
const STATE_CONSTS = ["ICON_NAME_KEYS", "ANIM_NAME_KEYS", "PALETTE_NAME_KEYS", "configName"];
const SC_FNS = ["scNodeLabel", "scNodeFallback", "scSourceFallback", "scSentenceAt"];

function load({ lang = "es", base = false, i18n = true, probe = false } = {}) {
  const src = base ? atBase : read;
  const ctx = vm.createContext({ TextEncoder, TextDecoder, URL, URLSearchParams, Intl, console, GRID: 20, innerWidth: 1280, innerHeight: 800,
    location: { search: lang === "es" ? "" : "?lang=" + lang }, navigator: { languages: [] },
    performance: { now: () => 0 }, document: { documentElement: { lang: "" }, querySelectorAll: () => [] } });
  for (const f of ["config.js", "safe-svg.js", "model.js"]) vm.runInContext(read("js/" + f), ctx, { filename: f });
  if (i18n) {
    for (const f of DICT_FILES) vm.runInContext(read(f), ctx, { filename: f });
    if (probe) { ctx.__probe = probeDict(); vm.runInContext("FLUYO_LOCALES.ja = __probe;", ctx); }
    vm.runInContext(read("js/i18n.js"), ctx, { filename: "i18n.js" });
  }
  const st = src("js/state.js"), ex = src("js/export.js"), sc = src("js/editor-scenarios.js"), ui = src("js/ui.js");
  const code = [
    ...STATE_CONSTS.map((n) => extractConst(st, n)),
    ...STATE_FNS.map((n) => extractFn(st, n)),
    firstPageStatement(st),
    extractFn(ex, "examplePageName"),
    ...SC_FNS.map((n) => extractFn(sc, n)),
    extractFn(ui, "drawerGroupName"),
    /* stubs del resto del editor que toca el botón «Ejemplo» */
    "var t0=0, pausedAt=0; const __btn={}; function $(id){ return id===\"btnDemo\" ? __btn : {}; }",
    "function clearSel(){} function syncProjectControls(){} function renderTabs(){} function centerView(){} function scheduleAutosave(){}",
    "function resetAnalyticsBaseline(){} function trackEvent(){}",
    demoHandler(ex)
  ].filter(Boolean).join("\n");
  vm.runInContext(code, ctx, { filename: "editor#extract" });
  const R = (c) => vm.runInContext(c, ctx);
  const has = (n) => R("typeof " + n + "==='function'");
  return {
    ctx, R,
    doc: () => JSON.parse(R("JSON.stringify(doc)")),
    pageNames: () => R("JSON.stringify(doc.pages.map(p=>p.name))"),
    example: () => R("__btn.onclick(); JSON.stringify(P())"),
    /* en la base, los nombres de la interfaz son los de config.js */
    icon: (k) => has("iconName") ? R(`iconName(${JSON.stringify(k)})`) : R(`ICONS[${JSON.stringify(k)}].n`),
    anim: (k) => has("animName") ? R(`animName(${JSON.stringify(k)})`) : R(`ANIMS[${JSON.stringify(k)}].n`),
    palette: (i) => has("paletteName") ? R(`paletteName(PALETTE[${i}])`) : R(`PALETTE[${i}].n`)
  };
}
function probeDict() {
  const d = {};
  for (const u of scan.catalog().uses) {
    if (u.key in d) continue;
    const ps = [...new Set(scan.placeholders(u.es))];
    const v = "〔" + u.key + "〕" + ps.map((p) => "《{" + p + "}》").join("");
    d[u.key] = typeof u.es === "object" ? { other: v } : v;
  }
  return d;
}
const SHAPES = ["rect", "rounded", "circle", "diamond", "hex", "cylinder", "cloud", "text", "code", "icon", "image", "anim"];
function seedCorpus(h) {
  const out = { pages0: h.pageNames() };
  h.R("addPage(); addPage(); addPage();");
  out.pages = h.pageNames();
  out.nodes = SHAPES.map((s) => { try { return h.R(`(function(){ const n=newNode(${JSON.stringify(s)},100,100,${s === "icon" ? '{icon:"db"}' : s === "anim" ? '{anim:"spinner"}' : "{}"}); return JSON.stringify([n.shape,n.label]); })()`); } catch (e) { return s + ":" + e.code; } });
  return out;
}
const configKeys = (h) => JSON.parse(h.R("JSON.stringify({icons:Object.keys(ICONS), anims:Object.keys(ANIMS), palette:PALETTE.length})"));

/* ───────── O · español idéntico a la base ───────── */
test("O · español IDÉNTICO a 7305355: primera página, página nueva, Nodo/Texto de cada forma, ejemplo, nombres de config.js, frase con {source}", { skip: !hasGit && "sin git" }, () => {
  const now = load(), base = load({ base: true });
  assert.deepEqual(seedCorpus(now), seedCorpus(base), "páginas y etiquetas sembradas");
  /* el ejemplo: el documento entero, dos veces (la segunda, «Ejemplo 2») y con «Ejemplo 3» ocupado */
  for (const h of [now, base]) h.R('doc.pages.push(blankPage("Ejemplo 3"));');
  assert.equal(now.example(), base.example(), "ejemplo · 1");
  assert.equal(now.example(), base.example(), "ejemplo · 2");
  assert.equal(now.example(), base.example(), "ejemplo · 3 salta el ocupado");
  assert.deepEqual(now.doc(), base.doc(), "el documento completo");
  const { icons, anims, palette } = configKeys(now);
  for (const k of icons) assert.equal(now.icon(k), base.icon(k), "icono " + k);
  for (const k of anims) assert.equal(now.anim(k), base.anim(k), "GIF " + k);
  for (let i = 0; i < palette; i++) assert.equal(now.palette(i), base.palette(i), "paleta " + i);
  for (const g of ["Estados", "General", "Varios", "GCP", "AWS", "Azure"]) assert.equal(now.R(`drawerGroupName(${JSON.stringify(g)})`), base.R(`drawerGroupName(${JSON.stringify(g)})`), "grupo " + g);
  /* la frase de un evento de elemento cuya plantilla usa {source}: la reserva del kernel en la base, la del editor ahora */
  for (const h of [now, base]) h.R('doc.pages[0].nodes.push({id:900,shape:"rect",x:0,y:0,w:10,h:10,label:"Banco"});');
  for (const tpl of ["{source} avisa a {target}", "{target} se cae", "{source}{target}", "Sin marcadores"]) {
    const et = JSON.stringify({ name: "Caída", primitive: "SET_AVAILABILITY", sentenceTemplate: tpl });
    assert.equal(now.R(`doc.cur=0; scSentenceAt(${et}, 900)`), base.R(`doc.cur=0; scSentenceAt(${et}, 900)`), tpl);
  }
});

/* ───────── E · inglés ───────── */
test("E · inglés: Page 1, Page 2, Node, Text, el ejemplo, los nombres de config.js y Source; marcas tal cual; fr/ja/zh caen al inglés", () => {
  const h = load({ lang: "en" });
  const c = seedCorpus(h);
  assert.equal(c.pages0, '["Page 1"]');
  assert.equal(c.pages, '["Page 1","Page 2","Page 3","Page 4"]');
  const labels = Object.fromEntries(c.nodes.filter((j) => j.startsWith("[")).map((j) => JSON.parse(j)));   /* las formas que el kernel rechaza, igual que en la base (O) */
  assert.equal(labels.rect, "Node"); assert.equal(labels.circle, "Node"); assert.equal(labels.diamond, "Node"); assert.equal(labels.text, "Text");
  assert.equal(labels.code, h.R("CODE_DEFAULT_LABEL"), "code: el SQL de siempre (no es texto de interfaz)");
  assert.equal(labels.icon, "", "icono sin etiqueta dada: el kernel no siembra nombre");
  const ex = JSON.parse(h.example());
  assert.equal(ex.name, "Example");
  assert.deepEqual(ex.nodes.map((n) => n.label), ["Sales funnel", "Visitors", "Registered\nlead", "Qualified?", "Opportunity", "Proposal\nsent", "Customer", "Discarded"]);
  assert.deepEqual(ex.edges.map((e) => e.label), ["visit", "form", "yes", "demo", "signature", "no"]);
  assert.equal(JSON.parse(h.example()).name, "Example 2", "el nombre libre se busca en el idioma de la interfaz");
  h.R('doc.pages.push(blankPage("Example 3"));');
  assert.equal(JSON.parse(h.example()).name, "Example 4");
  for (const [k, v] of [["db", "DB"], ["user", "User"], ["ai", "AI"], ["lock", "Security"], ["balancer", "Load balancer"], ["kafka", "Kafka"], ["gke", "GKE"], ["gcs", "Storage"], ["pipeline", "CI / CD"], ["shield", "Shield"], ["log", "Logs"]])
    assert.equal(h.icon(k), v, "icono " + k);
  assert.equal(h.anim("spinner"), "Loading"); assert.equal(h.anim("check"), "Success anim");
  assert.equal(h.palette(0), "Service"); assert.equal(h.palette(1), "Events / Kafka");
  assert.equal(h.R("drawerGroupName('Seguridad')"), "Security"); assert.equal(h.R("drawerGroupName('DevOps')"), "DevOps");
  h.R('doc.pages[0].nodes.push({id:900,shape:"rect",x:0,y:0,w:10,h:10,label:"Bank"});');
  assert.equal(h.R('doc.cur=0; scSentenceAt({name:"Down",primitive:"SET_AVAILABILITY",sentenceTemplate:"{source} warns {target}"}, 900)'), "Source warns Bank");
  /* todo lo que sale en inglés, sin restos en español */
  const { icons, anims, palette } = configKeys(h);
  const all = [...icons.map(h.icon), ...anims.map(h.anim), ...Array.from({ length: palette }, (_, i) => h.palette(i)), ...ex.nodes.map((n) => n.label), ...ex.edges.map((e) => e.label)];
  for (const s of all) assert.doesNotMatch(s, SPANISH, s);
  assert.equal(h.R("JSON.stringify(FluyoI18n.missing())"), "[]", "ninguna clave cae al español");
  /* fr/ja/zh (sin claves de S3a, decisión 288): caen al inglés, nunca al español */
  for (const lang of ["fr", "ja", "zh"]) {
    const o = load({ lang });
    assert.equal(o.icon("db"), "DB", lang); assert.equal(o.anim("spinner"), "Loading", lang);
    assert.equal(JSON.parse(o.example()).nodes[0].label, "Sales funnel", lang);
    assert.equal(JSON.parse(o.R("JSON.stringify(newNode('rect',0,0))")).label, "Node", lang);
  }
});

/* ───────── N · nunca se retraduce ───────── */
test("N · nunca se retraduce: cambiar de idioma no renombra; lo que llega con nombre (sesión, archivo, enlace) no se toca", () => {
  const h = load({ lang: "en" });
  h.R("addPage(); newNode('rect',0,0); newNode('text',0,0); __btn.onclick();");
  const before = JSON.stringify(h.doc());
  for (const l of ["es", "fr", "en", "es"]) { h.R(`FluyoI18n.setLocale(${JSON.stringify(l)})`); assert.equal(JSON.stringify(h.doc()), before, "cambio en vivo a " + l); }
  /* con la interfaz en español, lo nuevo nace en español junto a lo inglés: documentos mixtos (decisión 282) */
  h.R("addPage();");
  assert.deepEqual(JSON.parse(h.pageNames()), ["Page 1", "Page 2", "Example", "Página 4"]);
  /* la primera página solo se nombra en el documento en blanco del arranque: un documento que ya trae páginas o contenido, no */
  const es = load({ lang: "es" }), st = firstPageStatement(read("js/state.js"));
  assert.ok(st, "la sentencia de la primera página existe");
  const en = load({ lang: "en" });
  for (const restored of ['{name:"Página 1",nodes:[{id:1}],edges:[],nextId:2,behaviors:[],scenarios:[],nextScenarioId:1}',
    '{name:"Página 1",nodes:[],edges:[{id:1}],nextId:2,behaviors:[],scenarios:[],nextScenarioId:1}']) {
    en.R(`doc.pages=[${restored}]; doc.cur=0;`);
    en.R(st);
    assert.equal(en.R("doc.pages[0].name"), "Página 1", "no se renombra lo que trae contenido");
  }
  en.R('doc.pages=[blankPage("Página 1"), blankPage("Página 2")];'); en.R(st);
  assert.deepEqual(JSON.parse(en.pageNames()), ["Página 1", "Página 2"], "con más de una página, tampoco");
  /* en español la sentencia no cambia nada */
  assert.equal(es.pageNames(), '["Página 1"]');
  /* sin FluyoI18n (arneses): el kernel siembra lo de siempre */
  const bare = load({ i18n: false });
  assert.equal(bare.pageNames(), '["Página 1"]');
  assert.equal(bare.R("addPage().name"), "Página 2");
  assert.equal(bare.R("newNode('rect',0,0).label"), "Nodo");
  assert.equal(bare.R("newNode('text',0,0).label"), "Texto");
  assert.equal(bare.icon("db"), "BD"); assert.equal(bare.palette(0), "Servicio");
});

/* ───────── C · catálogo de config.js ───────── */
test("C · catálogo de config.js: clave con el texto base EXACTO de config.js para cada nombre traducible; marcas sin clave; el inglés completo", () => {
  const h = load({ lang: "es", i18n: false });
  const cfg = JSON.parse(h.R("JSON.stringify({ICONS:Object.fromEntries(Object.entries(ICONS).map(([k,v])=>[k,{g:v.g,n:v.n}])), ANIMS:Object.fromEntries(Object.entries(ANIMS).map(([k,v])=>[k,v.n])), PALETTE:PALETTE.map(p=>({c:p.c,n:p.n}))})"));
  const uses = scan.catalog().uses.filter((u) => u.file === "js/state.js");
  const base = (k) => { const u = uses.filter((x) => x.key === k); return u.length ? u[0].es : undefined; };
  const en = scan.dictionaries().en;
  const keyed = [], brands = [];
  for (const [k, { g, n }] of Object.entries(cfg.ICONS)) {
    if (BRAND_GROUPS.includes(g) || ICON_BRANDS.includes(k)) { brands.push(k); assert.equal(base("icon." + k), undefined, k + ": marca sin clave"); continue; }
    keyed.push(k);
    assert.equal(base("icon." + k), n, "icon." + k + " = config.js");
    assert.ok(typeof en.editor["icon." + k] === "string" && en.editor["icon." + k].trim(), "en: icon." + k);
  }
  assert.equal(keyed.length, 42, "42 nombres de icono traducibles");
  assert.deepEqual(brands.filter((k) => !BRAND_GROUPS.includes(cfg.ICONS[k].g)).sort(), [...ICON_BRANDS].sort(), "la lista de marcas es exacta");
  for (const [k, n] of Object.entries(cfg.ANIMS)) { assert.equal(base("anim." + k), n, "anim." + k); assert.ok(en.editor["anim." + k], "en: anim." + k); }
  /* la paleta, por color: cada color con su nombre */
  const st = read("js/state.js");
  for (const p of cfg.PALETTE) {
    const m = st.match(new RegExp('"' + p.c + '":\\(\\)=>FluyoI18n\\.t\\("(palette\\.[a-z]+)","([^"]+)"\\)'));
    assert.ok(m, "paleta " + p.c + " con clave");
    assert.equal(m[2], p.n, m[1] + " = config.js"); assert.ok(en.editor[m[1]], "en: " + m[1]);
  }
  /* ninguna clave icon./anim./palette. sin su entrada en config.js */
  for (const u of uses.filter((x) => /^icon\./.test(x.key))) assert.ok(cfg.ICONS[u.key.slice(5)], u.key + " existe en config.js");
  for (const u of uses.filter((x) => /^anim\./.test(x.key))) assert.ok(cfg.ANIMS[u.key.slice(5)], u.key + " existe en config.js");
});

/* ───────── D · D-S3-12 = a ───────── */
test("D · D-S3-12 = a: rótulos de Seguridad y DevOps preparados; la lista de grupos que pinta el cajón es la de la base", { skip: !hasGit && "sin git" }, () => {
  const LIST = /for\(const g of (\[[^\]]*\])\)\{/;
  const now = read("js/ui.js").match(LIST), then = atBase("js/ui.js").match(LIST);
  assert.ok(now && then);
  assert.equal(now[1], then[1], "la lista de grupos visibles no cambia");
  assert.equal(now[1], '["Estados","General","Varios","GCP","AWS","Azure"]');
  const uses = scan.catalog().uses;
  assert.ok(uses.some((u) => u.key === "drawer.groupSecurity" && u.es === "Seguridad" && u.file === "js/ui.js"));
  assert.ok(uses.some((u) => u.key === "drawer.groupDevOps" && u.es === "DevOps" && u.file === "js/ui.js"));
  const en = scan.dictionaries().en.editor;
  assert.equal(en["drawer.groupSecurity"], "Security"); assert.equal(en["drawer.groupDevOps"], "DevOps");
  /* el cajón se construye solo desde esa lista: ningún otro sitio pinta grupos */
  assert.equal((read("js/ui.js").match(/data-group/g) || []).length, (atBase("js/ui.js").match(/data-group/g) || []).length);
});

/* ───────── K · kernel y MCP ───────── */
const KERNEL_SCRIPTS = ["config.js", "safe-svg.js", "model.js", "scenario-engine.js", "scenario-playback.js", "story-playback.js", "document-integrity.js", "story-authoring.js"];
test("K · kernel y MCP: los archivos del kernel idénticos a la base; ninguno nombra FluyoI18n; el MCP lleva este kernel", { skip: !hasGit && "sin git" }, () => {
  for (const f of [...KERNEL_SCRIPTS, "story-clock.js", "flow-semantics.js", "geometry.js", "selection.js", "i18n.js", "viewer.js", "present-story.js"])
    assert.equal(read("js/" + f), atBase("js/" + f), f + " idéntico a la base");
  for (const f of KERNEL_SCRIPTS) assert.doesNotMatch(read("js/" + f).replace(/\/\*[\s\S]*?\*\//g, ""), /FluyoI18n/, f + ": no nombra la interfaz");
  const mcp = path.join(root, "..", "fluyo-mcp", "src", "generated", "kernel-sources.ts");
  if (!fs.existsSync(mcp)) return;
  const ts = fs.readFileSync(mcp, "utf8");
  const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
  for (const f of KERNEL_SCRIPTS) {
    const raw = execFileSync("git", ["-C", gitRoot, "show", BASE + ":js/" + f]);
    assert.ok(ts.includes(`name: "${f}",\n    sha256: "${sha(raw)}"`), f + ": el MCP lleva este archivo");
  }
});

/* ───────── S · estático ───────── */
test("S · estático: quien siembra pasa el valor traducido; render.js sin reserva en español; claves en el diccionario del editor; fr/ja/zh sin claves nuevas", () => {
  const ia = read("js/interaction.js");
  assert.match(ia, /newNode\("icon",p\.x,p\.y,\{icon:pendingIcon, label:iconName\(pendingIcon\)\}\)/);
  assert.match(ia, /newNode\("anim",p\.x,p\.y,\{anim:pendingAnim, label:animName\(pendingAnim\), color:DEFAULT_NODE_COLOR\}\)/);
  assert.doesNotMatch(ia, /ICONS\[pendingIcon\]\.n|ANIMS\[pendingAnim\]\.n/);
  const ui = read("js/ui.js");
  assert.doesNotMatch(ui, /ICONS\[k\]\.n|ANIMS\[k\]\.n|\bp\.n\b/, "cajones y paleta pasan por iconName/animName/paletteName");
  assert.equal((ui.match(/paletteName\(p\)/g) || []).length, 3, "las dos rejillas de la paleta y el repintado");
  assert.match(ui, /function paintChromeText\(\)\{[\s\S]*?iconName\(b\.dataset\.icon\)[\s\S]*?animName\(b\.dataset\.anim\)[\s\S]*?paletteName\(p\)/, "se repintan al cambiar de idioma");
  assert.match(read("js/state.js"), /function addPage\(\)\{ const r=createPageIn\(doc, seedPageName\(doc\.pages\.length\+1\)\);/);
  const sc = read("js/editor-scenarios.js");
  assert.doesNotMatch(sc, /renderEventSentence\([^)]*\bnull\b/, "ninguna frase deja al kernel poner «Origen» en español");
  const rd = read("js/render.js");
  assert.doesNotMatch(rd, /Elige una forma/);
  assert.match(rd, /const emptyHint = opts\.emptyHint \?\? "";/);
  assert.match(read("js/editor-runtime.js"), /emptyHint:typeof FluyoI18n==="object" \? FluyoI18n\.t\("editor\.emptyCanvas"/);
  /* el diccionario: lo de S3a, en el del editor; nada en el común salvo page.untitled (ya existía) */
  const d = scan.dictionaries();
  const S3A = /^(seed\.(node|text|source)|icon\.|anim\.|palette\.|example\.|drawer\.group(Security|DevOps)$)/;
  const mine = scan.catalog().uses.filter((u) => S3A.test(u.key)).map((u) => u.key);
  assert.equal(new Set(mine).size, 3 + 42 + 8 + 14 + 16 + 2, "claves de S3a");
  for (const k of mine) { assert.ok(k in d.en.editor, "en editor: " + k); assert.ok(!(k in d.en.common), "no en el común: " + k); }
  assert.ok("page.untitled" in d.en.common);
  for (const lang of ["fr", "ja", "zh"]) for (const k of mine) assert.ok(!(k in d[lang].editor) && !(k in d[lang].common), lang + " sin " + k);
});

/* ───────── A · alcance ───────── */
test("A · alcance frente a 7305355: solo estos archivos; undoS3a da la base EXACTA y va encima de undoS2b; kernel intacto; CACHE v114", { skip: !hasGit && "sin git" }, () => {
  const { undoS3a, PIECES, NEW_FILES } = require("./fluyo-i18n-002-s3a-undo.cjs");
  assert.deepEqual(NEW_FILES, []);
  const FILES = ["js/editor-scenarios.js", "js/export.js", "js/i18n-en-editor.js", "js/interaction.js", "js/render.js", "js/state.js", "js/ui.js"];
  assert.deepEqual(Object.keys(PIECES).sort(), FILES);
  const SERVED = ["js", "s", "css", "assets", "index.html", "404.html", "sw.js", "manifest.webmanifest", "docs", "ejemplos", "privacidad", "privacy", "soporte", "support", "terminos", "terms"];
  const changed = execFileSync("git", ["-C", gitRoot, "diff", "--name-only", BASE, "--", ...SERVED], { encoding: "utf8" }).split("\n").filter(Boolean);
  const untracked = execFileSync("git", ["-C", gitRoot, "ls-files", "--others", "--exclude-standard", "--", ...SERVED], { encoding: "utf8" }).split("\n").filter(Boolean);
  assert.deepEqual([...new Set([...changed, ...untracked])].sort(), [...FILES, "sw.js"].sort());
  for (const f of FILES) assert.equal(undoS3a(f, read(f)), atBase(f), f + ": undoS3a exacto");
  assert.equal(read("sw.js").replace('"fluyo-static-v114"', '"fluyo-static-v' + (114 - 1) + '"'), atBase("sw.js"), "sw.js: solo CACHE (sin archivos nuevos)");
  assert.match(read("sw.js"), /const CACHE = "fluyo-static-v114";/);
  assert.ok(read("test/fluyo-i18n-002-s2b-undo.cjs").includes("src = undoS3a(file, src);"), "undoS2b deshace antes esta tarea");
  for (const f of ["js/config.js", "js/model.js", "js/story-playback.js", "js/safe-svg.js", "js/i18n-en.js", "js/i18n-fr.js", "js/i18n-ja.js", "js/i18n-zh.js",
    "js/i18n-fr-editor.js", "js/i18n-ja-editor.js", "js/i18n-zh-editor.js", "index.html", "s/index.html", "404.html", "css/system.css", "css/styles.css"])
    assert.equal(read(f), atBase(f), f + " sin cambios");
});
