"use strict";
/* FLUYO-I18N-002 S3a — Chrome REAL (CDP sin dependencias, test/cdp-lite.cjs): lo que siembra el editor y los nombres de config.js, en
   español (IDÉNTICO a 7305355, servido aparte: FLUYO_BASE_ROOT o, si no se da, un `git archive` de la base) y en inglés.
   · ESPAÑOL  Arranque, soltar caja, texto, icono y GIF, «＋» y «Ejemplo»: el documento (serializeProject) idéntico al de la base;
              los cajones de iconos y GIFs (texto, title y píxeles) y los nombres de la paleta, idénticos.
   · INGLÉS   «Page 1», «Page 2», «Node», «Text», «DB», «Loading», el ejemplo en inglés; cajones y paleta en inglés, marcas tal cual;
              los grupos Seguridad y DevOps siguen sin pintarse (D-S3-12 = a); missing() vacío.
   · EN VIVO  Cambiar de idioma no toca el documento (los nombres sembrados son contenido) y repinta cajones y paleta.
   · SESIÓN   Una sesión guardada en español que se restaura con la interfaz en inglés conserva «Página 1».
   · fr       Cae al inglés, nunca al español. qps: los nombres de los cajones pasan por FluyoI18n (entre ⟦ ⟧), sin desbordes a 390 px.
   Uso: node test/fluyo-i18n-002-s3a-browser.cjs   (FLUYO_CHROME=<ruta>; FLUYO_BASE_ROOT=<árbol de 7305355>). Sin Chrome: se salta. */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), crypto = require("node:crypto");
const { execSync } = require("node:child_process");
const { serve, launch, CHROME } = require("./cdp-lite.cjs");
const { pseudoDictionary } = require("./i18n-pseudo.cjs");
const root = path.resolve(process.env.FLUYO_ROOT || path.join(__dirname, ".."));
const BASE = "7305355";
if (!CHROME || !fs.existsSync(CHROME)) { console.log("(sin Chrome: " + CHROME + ") — se salta"); process.exit(0); }

let passed = 0, failed = 0;
const check = (cond, msg) => { if (cond) { passed++; console.log("  ✔ " + msg); } else { failed++; console.log("  ✘ " + msg); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SPANISH = /[áéíóúñ¿¡«»]|\b(página|nodo|texto|ejemplo|usuario|usuarios|cargando|servicio|origen|visitantes|cliente|descartado|formulario|firma|cola|nube|búsqueda|archivo|carpeta|correo)\b/i;

function baseTree() {
  if (process.env.FLUYO_BASE_ROOT) return path.resolve(process.env.FLUYO_BASE_ROOT);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-s3a-base-"));
  execSync(`git -C "${root}" archive ${BASE} | tar -x -C "${dir.replace(/\\/g, "/")}"`, { stdio: "ignore", shell: "bash" });
  return dir;
}

async function boot(b, base, lang, { init = null } = {}) {
  b.errors = [];
  b.on((d) => { if (d.method === "Runtime.exceptionThrown") b.errors.push("pageerror: " + JSON.stringify(d.params.exceptionDetails.exception || d.params.exceptionDetails.text).slice(0, 200));
    if (d.method === "Runtime.consoleAPICalled" && d.params.type === "error") b.errors.push("console: " + (d.params.args || []).map((a) => a.value || a.description).join(" ").slice(0, 200)); });
  if (init) await b.send("Page.addScriptToEvaluateOnNewDocument", { source: init });
  await b.viewport(1440, 900);
  await b.goto(base + "/" + (lang === "es" ? "" : "?lang=" + lang));
  for (let i = 0; i < 80; i++) { if (await b.ev("typeof refreshPanel==='function' && typeof FluyoI18n==='object' && typeof serializeProject==='function'").catch(() => false)) break; await sleep(150); }
  await sleep(300);
}
/* Suelta en el lienzo, con el ratón de verdad, la herramienta armada (lo que hace interaction.js al hacer clic) */
async function dropAt(b, dx, dy) {
  const r = JSON.parse(await b.ev("JSON.stringify(document.getElementById('cv').getBoundingClientRect())"));
  const x = Math.round(r.x + r.width / 2 + dx), y = Math.round(r.y + r.height / 2 + dy);
  await b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await b.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await b.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
  await sleep(120);
}
/* El flujo de creación completo; devuelve el documento y lo que se ve */
async function createAll(b) {
  const first = await b.ev("JSON.stringify(doc.pages.map(p=>p.name))");
  await b.ev("pendingShape='rect'; pendingIcon=null; pendingAnim=null; syncRail(); true"); await dropAt(b, -360, -120);
  await b.ev("pendingShape='text'; pendingIcon=null; pendingAnim=null; syncRail(); true"); await dropAt(b, -120, -120);
  /* icono (BD) y GIF (Cargando), armados como los arma su botón del cajón */
  await b.ev("pendingIcon='db'; pendingShape=null; pendingAnim=null; syncRail(); true"); await dropAt(b, 120, -120);
  await b.ev("document.getElementById('btnAnims').click(); [...document.querySelectorAll('#animDrawer button')][0].click(); true");
  await dropAt(b, 360, -120);
  const labels = await b.ev("JSON.stringify(P().nodes.map(n=>[n.shape,n.label]))");
  await b.ev("document.querySelector('#pagesBar .pgAdd').click(); true"); await sleep(150);
  await b.ev("document.getElementById('btnDemo').click(); true"); await sleep(300);
  await b.ev("document.getElementById('btnDemo').click(); true"); await sleep(300);
  const pages = await b.ev("JSON.stringify(doc.pages.map(p=>p.name))");
  const example = await b.ev("JSON.stringify({nodes:P().nodes.map(n=>n.label), edges:P().edges.map(e=>e.label)})");
  const docJson = await b.ev("JSON.stringify(serializeProject())");
  return { first, labels, pages, example, docJson };
}
/* Cajones y paleta: texto, title, aria-label y píxeles */
async function chrome(b, pixels = true) {
  const out = {};
  await b.ev("document.getElementById('animDrawer').style.display='none'; var d=document.getElementById('iconDrawer'); d.style.display='block'; true"); await sleep(600);
  out.icons = await b.ev("JSON.stringify([...document.querySelectorAll('#iconDrawer h4, #iconDrawer button')].map(e=>e.tagName==='H4' ? '#'+e.textContent : e.textContent+'|'+e.title))");
  if (pixels) out.iconPx = await clipHash(b, "#iconDrawer");
  await b.ev("document.getElementById('iconDrawer').style.display='none'; document.getElementById('animDrawer').style.display='block'; true"); await sleep(600);
  out.anims = await b.ev("JSON.stringify([...document.querySelectorAll('#animDrawer button')].map(e=>e.textContent+'|'+e.title))");
  if (pixels) out.animPx = await clipHash(b, "#animDrawer");
  await b.ev("document.getElementById('animDrawer').style.display='none'; true");
  out.palette = await b.ev("JSON.stringify([...document.querySelectorAll('.swatch')].map(s=>s.parentElement.id+':'+s.title+'|'+s.getAttribute('aria-label')))");
  return out;
}
async function clipHash(b, sel) {
  const r = JSON.parse(await b.ev(`(function(){var e=document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect();return JSON.stringify({x:Math.max(0,e.x),y:Math.max(0,e.y),width:Math.ceil(e.width),height:Math.ceil(Math.min(e.height,880))});})()`));
  const shot = await b.send("Page.captureScreenshot", { format: "png", clip: { ...r, scale: 1 } });
  return crypto.createHash("sha256").update(shot.data).digest("hex").slice(0, 16) + ":" + shot.data.length;
}

(async () => {
  const mine = await serve(root);
  const baseRoot = baseTree();
  const old = await serve(baseRoot);
  try {
    console.log("\nESPAÑOL · idéntico a " + BASE);
    for (const [name, srv] of [["ahora", mine], ["base", old]]) {
      const b = await launch();
      try { await boot(b, srv.base, "es"); srv.flow = await createAll(b); srv.ui = await chrome(b); srv.errors = b.errors; } finally { b.close(); }
    }
    check(mine.flow.first === old.flow.first && mine.flow.first === '["Página 1"]', "primera página: " + mine.flow.first);
    check(mine.flow.labels === old.flow.labels, "caja, texto, icono y GIF: " + mine.flow.labels);
    check(mine.flow.pages === old.flow.pages, "páginas: " + mine.flow.pages);
    check(mine.flow.example === old.flow.example, "el ejemplo, igual");
    check(mine.flow.docJson === old.flow.docJson, "el documento (serializeProject) byte a byte igual a la base");
    check(mine.ui.icons === old.ui.icons, "cajón de iconos: textos y title iguales");
    check(mine.ui.anims === old.ui.anims, "cajón de GIFs: textos y title iguales");
    check(mine.ui.palette === old.ui.palette, "paleta: title y aria-label iguales (" + JSON.parse(mine.ui.palette).length + " muestras)");
    check(mine.ui.iconPx === old.ui.iconPx, "cajón de iconos: píxel a píxel (" + mine.ui.iconPx + ")");
    check(mine.ui.animPx === old.ui.animPx, "cajón de GIFs: píxel a píxel (" + mine.ui.animPx + ")");
    check(mine.errors.length === 0, "sin errores de consola " + mine.errors.join(" | "));

    console.log("\nINGLÉS");
    const b = await launch();
    try {
      await boot(b, mine.base, "en");
      const f = await createAll(b);
      check(f.first === '["Page 1"]', "primera página: " + f.first);
      check(f.labels === '[["rect","Node"],["text","Text"],["icon","DB"],["anim","Loading"]]', "caja, texto, icono y GIF: " + f.labels);
      check(f.pages === '["Page 1","Page 2","Example","Example 2"]', "páginas: " + f.pages);
      const ex = JSON.parse(f.example);
      check(ex.nodes[0] === "Sales funnel" && ex.nodes.includes("Registered\nlead") && JSON.stringify(ex.edges) === '["visit","form","yes","demo","signature","no"]', "el ejemplo en inglés: " + JSON.stringify(ex));
      const ui = await chrome(b, false);
      const icons = JSON.parse(ui.icons), anims = JSON.parse(ui.anims), pal = JSON.parse(ui.palette);
      check(icons.includes("DB|DB") && icons.includes("Queue|Queue") && icons.includes("Load balancer|Load balancer"), "cajón de iconos en inglés");
      check(icons.includes("Kafka|Kafka") && icons.includes("GKE|GKE") && icons.includes("Docker|Docker"), "las marcas, tal cual");
      check(!icons.some((s) => /^#(Seguridad|Security|DevOps)$/.test(s)), "los grupos Seguridad y DevOps siguen sin pintarse (D-S3-12 = a)");
      check(icons.filter((s) => s[0] === "#").join(",") === "#States,#General,#Misc,#GCP,#AWS,#Azure" || icons.filter((s) => s[0] === "#").length === 6, "seis grupos, los de siempre: " + icons.filter((s) => s[0] === "#").join(","));
      check(anims[0] === "Loading|Loading" && anims.includes("Heartbeat|Heartbeat"), "cajón de GIFs en inglés");
      check(pal.some((s) => s.endsWith(":Service|Service")) && pal.some((s) => s.endsWith(":Events / Kafka|Events / Kafka")), "paleta en inglés");
      /* solo los nombres de la paleta (data-palette): «Automático…», «Piedra (por defecto)» y el resto de Propiedades son de su slice (decisión 287) */
      const palNames = JSON.parse(await b.ev("JSON.stringify([...document.querySelectorAll('.swatch[data-palette]')].map(s=>s.title+'|'+s.getAttribute('aria-label')))"));
      check(palNames.length >= 14 * 3, "las muestras con nombre de la paleta: " + palNames.length);
      const leak = [...icons, ...anims, ...palNames].filter((s) => SPANISH.test(s));
      check(leak.length === 0, "sin restos de español en cajones y nombres de la paleta " + JSON.stringify(leak.slice(0, 5)));
      check((await b.ev("JSON.stringify(FluyoI18n.missing())")) === "[]", "missing() vacío");

      console.log("\nEN VIVO");
      const before = await b.ev("JSON.stringify(serializeProject())");
      await b.ev("FluyoI18n.setLocale('es'); true"); await sleep(300);
      const after = await b.ev("JSON.stringify(serializeProject())");
      check(before === after, "cambiar a español no toca el documento («Page 1», «Node», «DB», «Example» son contenido)");
      const uies = await chrome(b, false);
      check(JSON.parse(uies.icons).includes("BD|BD") && JSON.parse(uies.anims)[0] === "Cargando|Cargando" && JSON.parse(uies.palette).some((s) => s.endsWith(":Servicio|Servicio")), "cajones y paleta se repintan en español");
      await b.ev("document.querySelector('#pagesBar .pgAdd').click(); true"); await sleep(150);
      check((await b.ev("doc.pages[doc.pages.length-1].name")) === "Página 5", "lo nuevo nace en el idioma de ahora: «Página 5» junto a «Page 1» (documento mixto)");
      check(b.errors.length === 0, "sin errores de consola " + b.errors.join(" | "));
    } finally { b.close(); }

    console.log("\nSESIÓN guardada en español, restaurada en inglés");
    const s = await launch();
    try {
      await boot(s, mine.base, "es");
      await s.ev("pendingShape='rect'; syncRail(); true"); await dropAt(s, 0, 0);
      await s.ev("saveAutosave(true); true");
      await boot(s, mine.base, "en");
      const shown = await s.ev("getComputedStyle(document.getElementById('autosaveModal')).display");
      await s.ev("restoreAutosaveSession(); closeRestorePrompt(); true"); await sleep(200);
      const names = await s.ev("JSON.stringify(doc.pages.map(p=>p.name)) + ' · ' + P().nodes.map(n=>n.label).join(',')");
      check(shown !== "none" && names === '["Página 1"] · Nodo', "la sesión restaurada conserva «Página 1» y «Nodo» (" + names + ")");
    } finally { s.close(); }

    console.log("\nfr (cae al inglés)");
    const fr = await launch();
    try {
      await boot(fr, mine.base, "fr");
      const f = await createAll(fr);
      check(f.labels === '[["rect","Node"],["text","Text"],["icon","DB"],["anim","Loading"]]' && JSON.parse(f.example).nodes[0] === "Sales funnel", "fr: los valores sembrados en inglés, nunca en español");
      check((await fr.ev("doc.pages[0].name")) === "Page 1", "fr: «Page {n}» del diccionario francés existente (S0): " + (await fr.ev("doc.pages[0].name")));
    } finally { fr.close(); }

    console.log("\nqps (pseudo-idioma) a 1440 y 390");
    const init = "window.FLUYO_LOCALES=" + JSON.stringify({ qps: pseudoDictionary() }) + ";";
    for (const [w, h, mobile] of [[1440, 900, false], [390, 844, true]]) {
      const q = await launch();
      try {
        await boot(q, mine.base, "qps", { init });
        await q.viewport(w, h, mobile); await sleep(300);
        const ui = await chrome(q, false);
        const icons = JSON.parse(ui.icons).filter((x) => x[0] !== "#"), anims = JSON.parse(ui.anims);
        const brands = ["Kafka", "K8s", "Web", "API", "Cron", "Webhook", "CI / CD", "CDN", "DNS", "Git", "Docker", "GKE", "Cloud SQL", "Pub/Sub", "BigQuery", "Cloud Run", "Storage", "Vertex AI", "Functions", "Lambda", "S3", "EC2", "DynamoDB", "SQS", "API GW", "VM", "Cosmos DB", "Service Bus", "AKS"];
        const bad = [...icons, ...anims].filter((x) => { const t = x.split("|")[0]; return !t.startsWith("⟦") && !brands.includes(t); });
        check(bad.length === 0, w + " px: cada nombre traducible pasa por FluyoI18n (⟦…⟧) " + JSON.stringify(bad.slice(0, 5)));
        const over = await q.ev("(function(){var d=document.getElementById('iconDrawer');d.style.display='block';var r=d.scrollWidth>d.clientWidth+1;d.style.display='none';return r;})()");
        check(!over, w + " px: el cajón de iconos no desborda en horizontal");
      } finally { q.close(); }
    }
  } catch (e) { failed++; console.log("  ✘ excepción: " + (e && e.stack || e)); }
  mine.server.close(); old.server.close();
  console.log(`\nFLUYO-I18N-002 S3a Chrome: ${passed} ✔ · ${failed} ✘`);
  process.exit(failed ? 1 : 0);
})();
