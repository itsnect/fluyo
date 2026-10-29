"use strict";
/* FLUYO-I18N-002 S3b — Chrome REAL (CDP sin dependencias, test/cdp-lite.cjs): Propiedades en español (IDÉNTICO a 747eff8, servido
   aparte: FLUYO_BASE_ROOT o, si no se da, un `git archive` de la base) y en inglés.
   · ESPAÑOL  12 selecciones (caja sin texto, BD, texto, code, code con lista propia, icono, imagen, GIF, conexión con puntas,
              movimiento y tramos a mano, Flujo con punta de inicio (W5), conexión sin puntas ni puntos globales, selección
              múltiple): el panel entero (texto propio, title, aria-label, data-tip, placeholder, valor, visibilidad) IGUAL a la base, y
              píxel a píxel en columna (1280), columna mínima (1024) y hoja (375).
   · INGLÉS   Las mismas selecciones: ningún texto del panel en español (lo que queda es contenido del autor); missing() vacío; el
              metadato y los títulos de reserva en inglés; las muestras, las rejillas, «⋯» y «(Global)» en inglés.
   · EN VIVO  es → en → es con cada selección: el panel vuelve EXACTO y en inglés no se ve nada en español; es → qps: todo se repinta
              (también lo que el inglés escribe igual, como «(Global)»); foco, selección y paleta desplegada se conservan; el documento y
              la pila de Undo no cambian. En inglés cada control escribe el mismo documento que en español, con el mismo Undo, y su
              valor (data-v / value), nunca su texto.
   · qps      Todo texto del panel pasa por FluyoI18n (⟦…⟧); sin desbordes en la columna mínima ni en la hoja.
   · CJK      :lang(zh): peso 600 en segmentados y títulos de grupo, sin mayúsculas en el metadato (tokens de S4).
   · IME      Una composición en el campo de texto = una entrada de Undo; Intro no confirma ni cierra nada.
   · CUENTAGOTAS sin EyeDropper: el alert nativo en el idioma de la interfaz.
   · OFFLINE  El service worker v115 instala y sirve el editor sin red, con Propiedades en inglés.
   Uso: node test/fluyo-i18n-002-s3b-browser.cjs   (FLUYO_CHROME=<ruta>; FLUYO_BASE_ROOT=<árbol de 747eff8>; ONLY=es,en,vivo,qps,cjk,ime,eye,sw)
   Sin Chrome: se salta. */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), crypto = require("node:crypto");
const { execSync } = require("node:child_process");
const { serve, launch, CHROME } = require("./cdp-lite.cjs");
const { pseudoDictionary } = require("./i18n-pseudo.cjs");
const scan = require("./i18n-scan.cjs");
const root = path.resolve(process.env.FLUYO_ROOT || path.join(__dirname, ".."));
const BASE = "747eff8";
if (!CHROME || !fs.existsSync(CHROME)) { console.log("(sin Chrome: " + CHROME + ") — se salta"); process.exit(0); }
const ONLY = (process.env.ONLY || "").split(",").filter(Boolean);
const part = (p) => !ONLY.length || ONLY.includes(p);

let passed = 0, failed = 0;
const check = (cond, msg) => { if (cond) { passed++; console.log("  ✔ " + msg); } else { failed++; console.log("  ✘ " + msg); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* El español de la interfaz que no debe verse en inglés: los textos base de Propiedades y de la cabecera que el inglés cambia */
const DICTS = scan.dictionaries();
const EN = { ...DICTS.en.common, ...DICTS.en.editor };
const PANEL_KEYS = /^(prop\.|shape\.|sel\.|panel\.|editor\.properties$)/;
const ES_TEXTS = new Set(scan.catalog().uses.filter((u) => PANEL_KEYS.test(u.key) && typeof u.es === "string" && EN[u.key] !== u.es && !/\{/.test(u.es)).map((u) => u.es));
const SPANISH = /[áéíóúñ¿¡«»]|\b(sin|texto|caja|borde|relleno|fondo|puntas|ruta|flecha|puntos|ninguna?|personalizado|conexi[oó]n|forma)\b/i;

/* qps: el pseudo-idioma de pruebas (⟦…⟧); fuera de los corchetes solo puede quedar contenido del autor, lo que no se traduce (D-S3b-6)
   y el glifo «⋯» */
const QPS_INIT = "window.FLUYO_LOCALES=" + JSON.stringify({ qps: pseudoDictionary() }) + ";";
const CONTENT = /^(Orders|Note|KAFKA TOPIC|SELECT FROM WHERE|1×|2×|3×|4×|SQL|SQL \/ ksqlDB|#[0-9a-f]{6}|Playfair Display|IBM Plex Mono|Fluyo|⋯|\d+)$/i;

function baseTree() {
  if (process.env.FLUYO_BASE_ROOT) return path.resolve(process.env.FLUYO_BASE_ROOT);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-s3b-base-"));
  execSync(`git -C "${root}" archive ${BASE} | tar -x -C "${dir.replace(/\\/g, "/")}"`, { stdio: "ignore", shell: "bash" });
  return dir;
}
async function boot(b, base, lang, { init = null, w = 1280, h = 900, mobile = false, query = "" } = {}) {
  b.errors = [];
  if (!b.hooked) {
    b.hooked = true;
    b.on((d) => { if (d.method === "Runtime.exceptionThrown") b.errors.push("pageerror: " + JSON.stringify(d.params.exceptionDetails.exception || d.params.exceptionDetails.text).slice(0, 200));
      if (d.method === "Runtime.consoleAPICalled" && d.params.type === "error") b.errors.push("console: " + (d.params.args || []).map((a) => a.value || a.description).join(" ").slice(0, 200)); });
  }
  if (init) await b.send("Page.addScriptToEvaluateOnNewDocument", { source: init });
  await b.viewport(w, h, mobile);
  const q = [lang === "es" ? "" : "lang=" + lang, query].filter(Boolean).join("&");
  await b.goto(base + "/" + (q ? "?" + q : ""));
  for (let i = 0; i < 80; i++) { if (await b.ev("typeof refreshPanel==='function' && typeof FluyoI18n==='object' && typeof serializeProject==='function'").catch(() => false)) break; await sleep(150); }
  await sleep(300);
}
/* El documento de prueba: las formas y conexiones que enseñan cada fila del panel. Etiquetas neutras («Orders», «Note»): en inglés
   el contenido del autor no puede parecer español. */
const IMG = "data:image/svg+xml;base64," + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="50"><rect width="80" height="50" fill="#8a8275"/></svg>').toString("base64");
const SETUP = `(function(){
  const a=newNode('rect',-320,-160,{label:''});
  const b=newNode('cylinder',-100,-160,{label:'Orders'});
  const t=newNode('text',120,-160,{label:'Note'});
  const c=newNode('code',340,-160,{});
  const k=newNode('code',340,60,{keywords:['KAFKA','TOPIC']});
  const i=newNode('icon',-320,80,{icon:'db',label:''});
  const im=newNode('image',-100,80,{img:${JSON.stringify(IMG)},w:80,h:50});
  const g=newNode('anim',120,80,{anim:'spinner',label:'',color:DEFAULT_NODE_COLOR});
  const e1=newEdge(a.id,b.id,{}); editEdge(e1,{startArrow:true, animated:true, waypoints:[{x:-210,y:-60}]});
  const e2=newEdge(b.id,t.id,{}); editEdge(e2,{kind:'FLOWS_TO', startArrow:true, endArrow:false});
  const e3=newEdge(t.id,c.id,{}); editEdge(e3,{endArrow:false, dotsGlobal:false, dots:3});
  undoStack.length=0; redoStack.length=0;
  return JSON.stringify({a:a.id,b:b.id,t:t.id,c:c.id,k:k.id,i:i.id,im:im.id,g:g.id,e1:e1.id,e2:e2.id,e3:e3.id});
})()`;
const STATES = [["caja", "n:a"], ["bd", "n:b"], ["texto", "n:t"], ["code", "n:c"], ["code-lista", "n:k"], ["icono", "n:i"], ["imagen", "n:im"], ["gif", "n:g"],
  ["conexión", "e:e1"], ["flujo-w5", "e:e2"], ["sin-puntas", "e:e3"], ["multi", "m"]];
async function select(b, ids, sel) {
  const [kind, k] = sel.split(":");
  if (kind === "m") await b.ev(`selN.clear(); selE.clear(); selN.add(${ids.a}); selN.add(${ids.b}); selE.add(${ids.e1}); refreshPanel(); true`);
  else await b.ev(`selectOnly(${JSON.stringify(kind === "n" ? "node" : "edge")}, ${ids[k]}); true`);
  if (await b.ev("isSheetLayout() && !document.body.classList.contains('panelOpen')")) await b.ev("openSurface('properties'); true");
  await sleep(150);
}
/* El panel de Propiedades entero (cabecera y #panelProperties), sin las marcas de idioma: lo que se ve y lo que se lee */
const DUMP = `(function(){
  const out=[], A=["title","aria-label","data-tip","placeholder","aria-checked","aria-expanded","aria-hidden","role"];
  const walk=(el)=>{
    const own=[...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.data).join("").replace(/\\s+/g," ").trim();
    const at=A.map(a=>el.getAttribute(a)!==null ? a+"="+el.getAttribute(a) : "").filter(Boolean).join(" ");
    const cs=getComputedStyle(el), vis=cs.display!=="none" && cs.visibility!=="hidden" && el.getClientRects().length>0;
    const val=("value" in el && /^(SELECT|TEXTAREA|INPUT)$/.test(el.tagName)) ? " ="+el.value : el.tagName==="OPTION" ? (el.selected?" *":"") : "";
    out.push(el.tagName+(el.id?"#"+el.id:"")+(vis?"":"·")+(el.open===true?"[open]":"")+(own?" "+own:"")+(at?" {"+at+"}":"")+val);
    for(const c of el.children) if(c.namespaceURI!=="http://www.w3.org/2000/svg") walk(c);
  };
  walk(document.getElementById("propSheetHead")); walk(document.getElementById("panelProperties"));   /* Historias (#panelScenarios) es de S2a */
  return JSON.stringify(out);
})()`;
/* Píxeles comparables entre dos Chrome: sin transiciones, animaciones, cursor parpadeante ni barra de desplazamiento superpuesta (aparece
   y se desvanece; en el campo de texto, según su contenido), con el desplazamiento del panel arriba, con el reloj del lienzo parado (los puntos en movimiento y el GIF), las fuentes cargadas (la muestra que se adelanta,
   .pinned, depende de dónde parte la fila) y el panel ya quieto */
const FREEZE = "(function(){ if(document.getElementById('__freeze')) return true; const s=document.createElement('style'); s.id='__freeze'; s.textContent='*,*::before,*::after{transition:none!important;animation:none!important;caret-color:transparent!important;scrollbar-width:none!important} textarea{overflow:hidden!important}'; document.head.appendChild(s); playing=false; pausedAt=0; if(document.activeElement && document.activeElement.blur) document.activeElement.blur(); return true; })()";
async function clipShot(b, sel) {
  await b.ev(FREEZE); await b.ev("document.fonts.ready.then(()=>{ syncSwatchMore(); for(const e of document.querySelectorAll('#propPanel, #propPanel *')) if(e.scrollTop) e.scrollTop=0; return true; })"); await sleep(250);
  const r = JSON.parse(await b.ev(`(function(){var e=document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect();return JSON.stringify({x:Math.max(0,e.x),y:Math.max(0,e.y),width:Math.ceil(e.width),height:Math.ceil(e.height)});})()`));
  if (!r.width || !r.height) return "vacío";
  const shot = await b.send("Page.captureScreenshot", { format: "png", clip: { ...r, scale: 1 } });
  return shot.data;
}
/* Ruido de rasterizado entre dos Chrome con el MISMO árbol (medido base contra base): hasta ~24 px en el borde del botón «⋯» o de una
   fila de muestras, nunca un texto (un glifo cambiado son cientos). Por encima, es una diferencia. */
const NOISE = 32;
/* Píxeles DECODIFICADOS (los bytes del PNG pueden variar con los mismos píxeles): cuántos difieren y dónde */
async function pixelDiff(cmp, a, z) {
  if (a === z) return { n: 0 };
  if (a === "vacío" || z === "vacío") return { n: -1 };
  return JSON.parse(await cmp.ev(`(async function(){
    const load=(d)=>new Promise(r=>{ const i=new Image(); i.onload=()=>r(i); i.src='data:image/png;base64,'+d; });
    const a=await load(${JSON.stringify(a)}), b=await load(${JSON.stringify(z)});
    if(a.width!==b.width || a.height!==b.height) return JSON.stringify({n:-2, size:[a.width,a.height,b.width,b.height]});
    const c=document.createElement('canvas'); c.width=a.width; c.height=a.height; const x=c.getContext('2d');
    x.drawImage(a,0,0); const da=x.getImageData(0,0,a.width,a.height).data; x.clearRect(0,0,c.width,c.height); x.drawImage(b,0,0); const db=x.getImageData(0,0,b.width,b.height).data;
    let n=0, box=[1e9,1e9,-1,-1];
    for(let i=0;i<da.length;i+=4) if(da[i]!==db[i]||da[i+1]!==db[i+1]||da[i+2]!==db[i+2]||da[i+3]!==db[i+3]){ n++; const p=i/4, X=p%a.width, Y=(p/a.width)|0; box=[Math.min(box[0],X),Math.min(box[1],Y),Math.max(box[2],X),Math.max(box[3],Y)]; }
    return JSON.stringify({n, box});
  })()`));
}
/* Recorre las selecciones: volcado del panel (grupos como los deja el panel y luego todos abiertos) y, si se pide, píxeles */
async function tour(b, ids, { pixels = false } = {}) {
  const out = {};
  for (const [name, sel] of STATES) {
    await select(b, ids, sel);
    const r = { dump: await b.ev(DUMP) };
    if (pixels) r.px = await clipShot(b, "#propPanel");
    await b.ev("document.querySelectorAll('#selBody > details.pgroup').forEach(d=>d.open=true); syncSwatchMore(); true"); await sleep(80);
    r.open = await b.ev(DUMP);
    if (pixels) r.pxOpen = await clipShot(b, "#propPanel");
    await b.ev("applyGroupDefaults(panelKind); true");
    out[name] = r;
  }
  /* la fila de color del borde desplegada («⋯»: Personalizado y Cuentagotas) */
  await select(b, ids, "n:a");
  await b.ev("document.getElementById('swatches')._more.click(); true"); await sleep(80);
  out.desplegada = { dump: await b.ev(DUMP), px: pixels ? await clipShot(b, "#propPanel") : "" };
  await b.ev("collapseSwatches(); true");
  return out;
}
const textsOf = (dump, { visible = false } = {}) => JSON.parse(dump).filter((l) => !visible || !/^[A-Z0-9]+(?:#[\w-]+)?·/.test(l)).flatMap((l) => {
  const m = l.match(/^[A-Z0-9]+(?:#[\w-]+)?·?(?:\[open\])?(?: ([^{=*]*?))?(?: \{(.*)\})?(?: =[\s\S]*| \*)?$/);   /* el valor de un campo es del autor */
  if (!m) return [l];
  const attrs = (m[2] || "").split(/ (?=(?:title|aria-label|data-tip|placeholder|aria-checked|aria-expanded|aria-hidden|role)=)/).filter((a) => /^(title|aria-label|data-tip|placeholder)=/.test(a)).map((a) => a.replace(/^[\w-]+=/, ""));
  return [m[1] || "", ...attrs].filter(Boolean);
});

(async () => {
  const mine = await serve(root);
  const baseRoot = baseTree();
  const old = await serve(baseRoot);
  try {
    if (part("es")) {
      console.log("\nESPAÑOL · idéntico a " + BASE + " (texto, atributos, visibilidad y píxeles)");
      for (const [w, h, mobile, label] of [[1280, 1400, false, "columna 1280"], [1024, 1400, false, "columna mínima 1024"], [375, 812, true, "hoja 375"]]) {
        const res = {};
        for (const [name, srv] of [["ahora", mine], ["base", old]]) {
          const b = await launch();
          try { await boot(b, srv.base, "es", { w, h, mobile }); const ids = JSON.parse(await b.ev(SETUP)); res[name] = await tour(b, ids, { pixels: true }); res[name].errors = b.errors; } finally { b.close(); }
        }
        const cmp = await launch(), bad = [], pxBad = [];
        let shots = 0, noise = 0;
        try {
          await cmp.goto("about:blank");
          for (const k of Object.keys(res.base).filter((x) => x !== "errors")) for (const f of Object.keys(res.base[k])) {
            if (/^px/.test(f)) { shots++; const d = await pixelDiff(cmp, res.ahora[k][f], res.base[k][f]); noise = Math.max(noise, d.n); if (d.n < 0 || d.n > NOISE) pxBad.push(k + "." + f + " " + JSON.stringify(d)); continue; }
            if (res.ahora[k][f] === res.base[k][f]) continue;
            const a = JSON.parse(res.ahora[k][f]), z = JSON.parse(res.base[k][f]), i = a.findIndex((l, j) => l !== z[j]);
            bad.push(k + "." + f); console.log("    ≠ " + k + "." + f + ": " + a[i] + "  ⟷  " + z[i]);
          }
        } finally { cmp.close(); }
        check(bad.length === 0, label + ": " + (Object.keys(res.base).length - 1) + " estados × (panel, grupos abiertos): texto, atributos y visibilidad iguales a la base" + (bad.length ? " — distintos: " + bad.join(", ") : ""));
        check(pxBad.length === 0, label + ": " + shots + " capturas del panel iguales a la base píxel a píxel (máx. " + noise + " px distintos; ruido ≤ " + NOISE + ")" + (pxBad.length ? " — " + pxBad.join(" · ") : ""));
        check(res.ahora.errors.length === 0, label + ": sin errores de consola " + res.ahora.errors.join(" | "));
        if (w === 1280) {
          const caja = JSON.parse(res.ahora.caja.dump), edge = JSON.parse(res.ahora["conexión"].dump);
          check(caja.some((l) => l.startsWith("SPAN#selMeta Caja · id ")) && caja.some((l) => /^SPAN#selTitle Caja sin texto/.test(l)), "la cabecera de siempre: «Caja · id N», «Caja sin texto»");
          check(edge.some((l) => /^SPAN#selMeta Conexión · \d+ → \d+$/.test(l)), "«Conexión · a → b»");
        }
      }
    }

    if (part("en")) {
      console.log("\nINGLÉS · ningún texto del panel en español");
      const b = await launch();
      try {
        await boot(b, mine.base, "en");
        const ids = JSON.parse(await b.ev(SETUP));
        const t = await tour(b, ids);
        let leaks = [];
        for (const [name, r] of Object.entries(t)) for (const s of textsOf(r.open || r.dump)) if (ES_TEXTS.has(s) || SPANISH.test(s)) leaks.push(name + ": «" + s + "»");
        leaks = [...new Set(leaks)];
        check(leaks.length === 0, "12 estados + fila desplegada, con todos los grupos abiertos: sin español " + JSON.stringify(leaks.slice(0, 8)));
        check((await b.ev("JSON.stringify(FluyoI18n.missing())")) === "[]", "missing() vacío");
        const caja = JSON.parse(t.caja.open), edge = JSON.parse(t["conexión"].open), code = JSON.parse(t.code.open), w5 = JSON.parse(t["flujo-w5"].open);
        check(caja.some((l) => /^SPAN#selMeta Box · id \d+$/.test(l)) && caja.some((l) => /^SPAN#selTitle Box without text/.test(l)), "cabecera: «Box · id N», «Box without text»");
        check(edge.some((l) => /^SPAN#selMeta Connection · \d+ → \d+$/.test(l)) && edge.some((l) => /^SPAN#selTitle id \d+ → Orders/.test(l)), "conexión: «Connection · a → b», «id a → Orders»");
        check(caja.some((l) => l.startsWith("SUMMARY") || /SPAN Appearance/.test(l)) && caja.some((l) => /^SPAN#shapeLbl Shape/.test(l)) && caja.some((l) => /^SPAN#shapeValue Box$/.test(l)), "grupo Appearance, «Shape Box»");
        check(code.some((l) => /^LABEL#lblEditLbl Code$/.test(l)) && code.some((l) => /^SPAN#fillLbl Panel$/.test(l)) && code.some((l) => /^SPAN#textColorLbl Code text$/.test(l)) && code.some((l) => /^SPAN#textBgLbl Block background$/.test(l)), "code: Code · Panel · Code text · Block background");
        check(w5.some((l) => /^P#kindNote The visible arrowhead points against the flow/.test(l)) && w5.some((l) => /^SPAN#arrowsValue Start$/.test(l)), "Flujo con punta de inicio: aviso W5 y «Arrowheads Start» en inglés");
        check(caja.some((l) => /title=Stone \(default\) aria-label=Stone \(default\)/.test(l)) && caja.some((l) => /^DIV#swatches.*aria-label=Line or border color/.test(l)), "muestras y rejillas: «Stone (default)», «Line or border color»");
        check(caja.some((l) => /aria-label=More colors, custom and eyedropper/.test(l)) && caja.some((l) => /aria-label=More colors and custom/.test(l)), "«⋯»: frases completas en inglés");
        check(JSON.parse(t.desplegada.dump).some((l) => /BUTTON.*aria-label=Fewer colors data-tip=Fewer colors/.test(l)), "«⋯» desplegado: «Fewer colors»");
        check(caja.some((l) => /^OPTION·? \(Global\)/.test(l)) && caja.some((l) => /^SPAN·? Custom$/.test(l)) && caja.some((l) => /^SPAN·? B \{aria-hidden=true\}$/.test(l)), "«(Global)», «Custom», glifo de negrita «B»");
        check(b.errors.length === 0, "sin errores de consola " + b.errors.join(" | "));
        /* fr/ja/zh: sin claves de S3b, caen al inglés (nunca al español) */
        for (const lang of ["fr", "ja", "zh"]) {
          await boot(b, mine.base, lang);
          const ids2 = JSON.parse(await b.ev(SETUP));
          await select(b, ids2, "n:a");
          const d = JSON.parse(await b.ev(DUMP));
          check(d.some((l) => /^SPAN#selMeta Box · id \d+$/.test(l)) && d.some((l) => /^SPAN#shapeLbl Shape/.test(l)) && !textsOf(JSON.stringify(d)).some((s) => ES_TEXTS.has(s)), lang + ": Propiedades cae al inglés");
        }
      } finally { b.close(); }
    }

    if (part("vivo")) {
      console.log("\nEN VIVO · es → en → es; el documento y el Undo no cambian; cada control escribe lo mismo en los dos idiomas");
      const b = await launch();
      try {
        await boot(b, mine.base, "es", { init: QPS_INIT });
        const ids = JSON.parse(await b.ev(SETUP));
        const docBefore = await b.ev("JSON.stringify(serializeProject())"), undoBefore = await b.ev("undoStack.length");
        const bad = [], stale = [];
        for (const [name, sel] of STATES) {
          await select(b, ids, sel);
          const es0 = await b.ev(DUMP);
          await b.ev("FluyoI18n.setLocale('en'); true"); await sleep(120);
          const en1 = await b.ev(DUMP);
          for (const t of textsOf(en1, { visible: true })) if (ES_TEXTS.has(t)) stale.push(name + ": «" + t + "»");   /* las filas ocultas de otro tipo las repinta refreshPanel al volver a verse */
          await b.ev("FluyoI18n.setLocale('es'); true"); await sleep(120);
          const es2 = await b.ev(DUMP);
          if (es2 !== es0 || en1 === es0) { bad.push(name); const a = JSON.parse(es2), z = JSON.parse(es0), i = a.findIndex((l, j) => l !== z[j]); console.log("    ≠ " + name + ": " + a[i] + "  ⟷  " + z[i]); }
        }
        check(bad.length === 0, "12 selecciones: en inglés cambia y al volver el panel es EXACTO al de antes " + bad.join(", "));
        check(stale.length === 0, "12 selecciones: tras cambiar a inglés no se ve ningún texto del panel en español (nada congelado al cargar) " + JSON.stringify([...new Set(stale)].slice(0, 6)));
        /* es → qps en vivo: lo que se ve (y las opciones de los selectores) se repinta entero, también lo que el inglés escribe igual que
           el español («(Global)», «Panel», «Auto») */
        const unpainted = [];
        for (const [name, sel] of [["caja", "n:a"], ["code", "n:c"], ["conexión", "e:e1"], ["flujo-w5", "e:e2"]]) {
          await select(b, ids, sel);
          await b.ev("FluyoI18n.setLocale('qps'); true"); await sleep(120);
          const dump = JSON.stringify(JSON.parse(await b.ev(DUMP)).filter((l) => !/^[A-Z0-9]+(?:#[\w-]+)?·/.test(l) || /^OPTION/.test(l)));
          const code = (await b.ev("CODE_DEFAULT_LABEL")).split("\n")[0], fonts = JSON.parse(await b.ev("JSON.stringify(FONTS.map(f=>f.n))"));
          for (const t of textsOf(dump)) if (!t.startsWith("⟦") && !CONTENT.test(t) && !fonts.includes(t) && t !== code) unpainted.push(name + ": «" + t + "»");
          await b.ev("FluyoI18n.setLocale('es'); true"); await sleep(120);
        }
        check(unpainted.length === 0, "es → qps en vivo: todo lo visible del panel y las opciones de sus selectores se repintan (⟦…⟧) " + JSON.stringify([...new Set(unpainted)].slice(0, 6)));
        /* foco, selección y fila desplegada */
        await select(b, ids, "n:a");
        await b.ev("document.getElementById('swatches')._more.click(); document.querySelector('#borderSeg .segBtn[data-v=\"dashed\"]').focus(); true");
        await b.ev("FluyoI18n.setLocale('en'); true"); await sleep(120);
        const kept = await b.ev("JSON.stringify([document.activeElement && document.activeElement.dataset.v, [...selN], document.getElementById('swatches').classList.contains('expanded'), document.getElementById('swatches')._more.getAttribute('aria-label')])");
        check(kept === JSON.stringify(["dashed", [ids.a], true, "Fewer colors"]), "foco, selección y paleta desplegada se conservan; «⋯» repintado: " + kept);
        await b.ev("collapseSwatches(); FluyoI18n.setLocale('es'); true");
        check((await b.ev("JSON.stringify(serializeProject())")) === docBefore && (await b.ev("undoStack.length")) === undoBefore, "cambiar de idioma no toca el documento ni la pila de Undo");
        check(b.errors.length === 0, "sin errores de consola " + b.errors.join(" | "));
      } finally { b.close(); }
      /* el mismo recorrido de controles en español y en inglés escribe el mismo documento, con las mismas entradas de Undo */
      const ACT = `(async function(ids){
        const s=(ms)=>new Promise(r=>setTimeout(r,ms)); const log=[];
        const seg=(id,v)=>{ document.querySelector('#'+id+' .segBtn[data-v="'+v+'"]').click(); };
        const sel=(id,v)=>{ const e=document.getElementById(id); e.value=v; e.dispatchEvent(new Event('change')); };
        const sw=(grid,v)=>{ [...document.getElementById(grid).children].find(d=>d.dataset.v===v).click(); };
        selectOnly('node',ids.a); seg('shapeSeg','diamond'); seg('borderSeg','dashed'); sel('lblPosSel','top'); sw('fillSw','none'); sw('swatches',PALETTE[2].c);
        document.getElementById('pulseChk').click(); log.push(undoStack.length);
        selectOnly('node',ids.c); seg('langSeg','none'); seg('langSeg','custom'); sw('kwBgSw','__null__'); log.push(undoStack.length);
        selectOnly('edge',ids.e1); seg('routeSeg','ortho'); sel('fromSel','n'); seg('arrowSeg','end'); seg('arrowSizeSeg','1.5'); seg('kindSeg','REQUIRES');
        seg('speedSeg','3'); seg('flowSeg','reverse'); document.getElementById('dotsGlobalChk').click(); sw('lineSw','__null__'); sw('dotSw',PALETTE[1].c); log.push(undoStack.length);
        await s(50);
        const d=serializeProject(); d.doc.pages.forEach(p=>{ p.name="·"; });   /* el nombre de la página lo siembra S3a en el idioma de quien crea: contenido */
        /* lo que cada control debía escribir (su data-v / value, nunca su texto) */
        const a=nodeById(ids.a), c=nodeById(ids.c), e=edgeById(ids.e1);
        const vals=[a.shape, a.border, a.lblPos, a.fill, a.color===PALETTE[2].c, !!a.pulse, c.lang, e.route, e.fromSide, arrowsOf(e), edgeArrowSize(e), edgeKind(e), edgeSpeedFac(e),
          e.flowDir, e.dotsGlobal, e.lineColor||null, e.dotColor===PALETTE[1].c];
        return JSON.stringify({doc:d, log, undo:undoStack.length, vals});
      })`;
      const runs = {};
      for (const lang of ["es", "en"]) {
        const c = await launch();
        try { await boot(c, mine.base, lang); const ids = JSON.parse(await c.ev(SETUP)); runs[lang] = await c.ev(ACT + "(" + JSON.stringify(ids) + ")"); } finally { c.close(); }
      }
      const es = JSON.parse(runs.es), en = JSON.parse(runs.en);
      if (JSON.stringify(es.doc) !== JSON.stringify(en.doc)) { const a = JSON.stringify(es.doc), z = JSON.stringify(en.doc); let i = 0; while (a[i] === z[i]) i++; console.log("    ≠ doc: …" + a.slice(Math.max(0, i - 120), i + 60) + "  ⟷  …" + z.slice(Math.max(0, i - 120), i + 60)); }
      check(JSON.stringify(es.doc) === JSON.stringify(en.doc) && JSON.stringify(es.log) === JSON.stringify(en.log), "21 cambios desde el panel: mismo documento y mismas entradas de Undo en español y en inglés (" + JSON.stringify(es.log) + ")");
      check(es.log[2] > es.log[0] && es.undo === es.log[2], "cada cambio apila su Undo (" + es.undo + ")");
      const WANT = '["diamond","dashed","top","none",true,true,"none","ortho","n","end",1.5,"REQUIRES",3,"reverse",false,null,true]';
      check(JSON.stringify(es.vals) === WANT && JSON.stringify(en.vals) === WANT, "cada control escribe su valor, no su texto: " + JSON.stringify(en.vals));
    }

    if (part("qps")) {
      console.log("\nqps (pseudo-idioma): todo pasa por FluyoI18n; sin desbordes en la columna mínima ni en la hoja");
      const init = QPS_INIT;
      for (const [w, h, mobile] of [[1024, 900, false], [375, 812, true]]) {
        const q = await launch();
        try {
          await boot(q, mine.base, "qps", { init, w, h, mobile });
          const ids = JSON.parse(await q.ev(SETUP));
          const t = await tour(q, ids);
          const fonts = JSON.parse(await q.ev("JSON.stringify(FONTS.map(f=>f.n))"));
          const code = (await q.ev("CODE_DEFAULT_LABEL")).split("\n")[0];   /* el título de un code es su primera línea: contenido */
          const out = [];
          for (const [name, r] of Object.entries(t)) for (const s of textsOf(r.open || r.dump)) if (!s.startsWith("⟦") && !CONTENT.test(s) && !fonts.includes(s) && s !== code && !/^#[0-9a-f]{6}$/i.test(s)) out.push(name + ": «" + s + "»");
          check(out.length === 0, w + " px: cada texto del panel entre ⟦ ⟧ (fuera: contenido, fuentes, 1×–4×, SQL) " + JSON.stringify([...new Set(out)].slice(0, 8)));
          const over = [];
          for (const [name, sel] of STATES) {
            await select(q, ids, sel);
            await q.ev("document.querySelectorAll('#selBody > details.pgroup').forEach(d=>d.open=true); true"); await sleep(60);
            const o = JSON.parse(await q.ev(`(function(){ const p=document.getElementById('propPanel').getBoundingClientRect(), bad=[];
              for(const el of document.querySelectorAll('#selBody *')){ if(el.closest('.srOnly') || el.namespaceURI==='http://www.w3.org/2000/svg') continue;
                const r=el.getBoundingClientRect(); if(!r.width||!r.height) continue;
                if(r.right>p.right+1 || r.left<p.left-1 || (el.scrollWidth>el.clientWidth+1 && getComputedStyle(el).overflowX!=='visible' && el.tagName!=='SELECT' && el.tagName!=='TEXTAREA' && el.tagName!=='INPUT')) bad.push(el.tagName+'#'+el.id+'.'+el.className+' '+(el.textContent||'').trim().slice(0,30)); }
              return JSON.stringify(bad); })()`));
            if (o.length) over.push(name + ": " + o.slice(0, 2).join(" / "));
          }
          const pw = await q.ev("Math.round(document.getElementById('propPanel').getBoundingClientRect().width)");
          check(over.length === 0, w + " px (panel de " + pw + " px): ningún rótulo, segmentado ni grupo se sale " + JSON.stringify(over.slice(0, 4)));
        } finally { q.close(); }
      }
    }

    if (part("cjk")) {
      console.log("\nCJK (:lang(zh), tokens de S4)");
      const z = await launch();
      try {
        await boot(z, mine.base, "zh");
        const ids = JSON.parse(await z.ev(SETUP));
        await select(z, ids, "e:e1");
        const st = JSON.parse(await z.ev("JSON.stringify([document.documentElement.lang, getComputedStyle(document.querySelector('#routeSeg .segBtn')).fontWeight, getComputedStyle(document.querySelector('#grpStroke > summary')).fontWeight, getComputedStyle(document.getElementById('selMeta')).textTransform])"));
        check(/^zh/.test(st[0]) && st[1] === "600" && st[2] === "600" && st[3] === "none", "segmentados y títulos de grupo a 600, metadato sin mayúsculas: " + JSON.stringify(st));
      } finally { z.close(); }
    }

    if (part("ime")) {
      console.log("\nIME en el campo de texto");
      const b = await launch();
      try {
        await boot(b, mine.base, "en");
        const ids = JSON.parse(await b.ev(SETUP));
        await select(b, ids, "n:b");
        const u0 = await b.ev("undoStack.length");
        await b.ev("const e=document.getElementById('lblEdit'); e.focus(); e.setSelectionRange(e.value.length, e.value.length); true");
        for (const s of ["に", "にほ", "にほん", "日本"]) { await b.send("Input.imeSetComposition", { text: s, selectionStart: s.length, selectionEnd: s.length }); await sleep(30); }
        await b.send("Input.insertText", { text: "日本" }); await sleep(60);
        await b.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
        await b.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 }); await sleep(60);
        const st = JSON.parse(await b.ev(`JSON.stringify([nodeById(${ids.b}).label, undoStack.length, [...selN], document.getElementById('selBody').style.display, document.activeElement.id])`));
        check(st[0].startsWith("Orders日本") && st[1] === u0 + 1, "una composición (y su Intro) = una entrada de Undo: " + JSON.stringify(st.slice(0, 2)));
        check(JSON.stringify(st[2]) === JSON.stringify([ids.b]) && st[3] === "block" && st[4] === "lblEdit", "Intro no cierra el panel ni cambia la selección");
      } finally { b.close(); }
    }

    if (part("eye")) {
      console.log("\nCuentagotas sin EyeDropper: alert en el idioma de la interfaz");
      for (const [lang, want] of [["es", "Tu navegador no soporta el cuentagotas (usa Chrome o Edge)."], ["en", "Your browser doesn't support the eyedropper (use Chrome or Edge)."]]) {
        const b = await launch();
        try {
          await boot(b, mine.base, lang, { init: "delete window.EyeDropper; window.__alerts=[]; window.alert=(m)=>{ window.__alerts.push(String(m)); };" });
          const ids = JSON.parse(await b.ev(SETUP));
          await select(b, ids, "n:a");
          await b.ev("document.getElementById('btnEyedrop').click(); true"); await sleep(100);
          check((await b.ev("JSON.stringify(window.__alerts)")) === JSON.stringify([want]), lang + ": «" + want + "»");
        } finally { b.close(); }
      }
    }

    if (part("sw")) {
      console.log("\nService worker v115 y sin red");
      const b = await launch();
      try {
        await boot(b, mine.base, "en");
        await b.ev("navigator.serviceWorker.register('./sw.js').then(()=>navigator.serviceWorker.ready).then(()=>true)");
        for (let i = 0; i < 60; i++) { if (await b.ev("caches.keys().then(k=>k.includes('fluyo-static-v118'))")) break; await sleep(250); }
        check(await b.ev("caches.keys().then(k=>JSON.stringify(k)==='[\"fluyo-static-v118\"]' || k.includes('fluyo-static-v118'))"), "precache fluyo-static-v118: " + (await b.ev("caches.keys().then(k=>JSON.stringify(k))")));
        await boot(b, mine.base, "en");
        mine.setOffline(true);
        await boot(b, mine.base, "en");
        const ids = JSON.parse(await b.ev(SETUP));
        await select(b, ids, "n:a");
        const d = JSON.parse(await b.ev(DUMP));
        check(d.some((l) => /^SPAN#selMeta Box · id \d+$/.test(l)) && d.some((l) => /^SPAN#shapeLbl Shape/.test(l)), "sin red: el editor arranca del precache y Propiedades sale en inglés");
        mine.setOffline(false);
      } finally { mine.setOffline(false); b.close(); }
    }
  } catch (e) { failed++; console.log("  ✘ excepción: " + (e && e.stack || e)); }
  mine.server.close(); old.server.close();
  console.log(`\nFLUYO-I18N-002 S3b Chrome: ${passed} ✔ · ${failed} ✘`);
  process.exit(failed ? 1 : 0);
})();
