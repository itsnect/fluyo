"use strict";
/* FLUYO-GROWTH-FOUNDATION-001 — Mutaciones sobre COPIAS aisladas (nunca sobre el árbol). Cada regresión real de la lógica de esta
   tarea (contrato de eventos, idioma, decisión de la entrada, recurrente/nuevo, enlaces profundos, «una vez por reproducción») debe
   hacer fallar test/fluyo-growth-foundation-001.test.cjs. Solo la lógica con decisiones; el cableado de la tarjeta y los clics los
   cubre el test de navegador.
   Uso: node test/fluyo-growth-foundation-001-mutations.cjs   (ONLY_MUT=M3 una sola) */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const NL = "\n", CRLF = "\r\n";
const UNIT = ["--test", "test/fluyo-growth-foundation-001.test.cjs"];
const AN = "js/analytics.js", EA = "js/editor-analytics.js", EN = "js/entry.js", SC = "js/editor-scenarios.js", VW = "js/viewer.js";
/* [nombre, archivo, desde, hasta] */
const MUTATIONS = [
  /* contrato */
  ["M1 editor_opened vuelve a no llevar propiedades", AN, `editor_opened:{entry:["direct","example","link"], returning:YES_NO, locale:ANALYTICS_LOCALES},`, `editor_opened:{},`],
  ["M2 story_started admite el Viewer como superficie", AN, `story_started:{surface:["editor","present"], trigger:["user","entry"]},`, `story_started:{surface:["editor","present","viewer"], trigger:["user","entry"]},`],
  ["M3 una propiedad libre (nombre de la Historia)", AN, `story_created:{origin:["new","variant","copy"]},`, `story_created:{origin:["new","variant","copy"], name:null},`],
  ["M4 share_created sin variants", AN, `share_created:{kind:["story","diagram"], variants:YES_NO},`, `share_created:{kind:["story","diagram"]},`],
  ["M5 el idioma raro descarta editor_opened (sin «other»)", AN, `return ANALYTICS_LOCALES.includes(l) ? l : "other";`, `return l;`],
  ["M6 el idioma que falla dice «es» en vez de «other»", AN, `  }catch(e){ return "other"; }\n}\nfunction analyticsProps`, `  }catch(e){ return "es"; }\n}\nfunction analyticsProps`],
  ["M7 beforeSend deja pasar la URL", AN, `const safe={website:UMAMI_WEBSITE_ID,hostname:location.hostname,url:"/",title:"Fluyo",referrer:""};`, `const safe={website:UMAMI_WEBSITE_ID,hostname:location.hostname,url:payload.url||"/",title:"Fluyo",referrer:""};`],
  ["M8 viewer_story_completed sin emisor", VW, `if(!story.counted){ story.counted=true; trackEvent("viewer_story_completed"); }`, `if(!story.counted){ story.counted=true; }`],
  /* editor_opened */
  ["M9 el enlace #d= cuenta como directo", EA, `: (typeof DEEP_LINK_PAYLOAD!=="undefined" && DEEP_LINK_PAYLOAD) ? "link" : "direct";`, `: "direct";`],
  ["M10 returning siempre no", EA, `const returning=(typeof ENTRY_STATE==="object" && ENTRY_STATE && ENTRY_STATE.returning) ? "yes" : "no";`, `const returning="no";`],
  ["M11 el ejemplo gana al enlace al revés", EA, `const entry=(typeof EXAMPLE_SLUG!=="undefined" && EXAMPLE_SLUG) ? "example"\n    : (typeof DEEP_LINK_PAYLOAD!=="undefined" && DEEP_LINK_PAYLOAD) ? "link" : "direct";`, `const entry=(typeof DEEP_LINK_PAYLOAD!=="undefined" && DEEP_LINK_PAYLOAD) ? "link"\n    : (typeof EXAMPLE_SLUG!=="undefined" && EXAMPLE_SLUG) ? "example" : "direct";`],
  /* la entrada */
  ["M12 solo fluyo.seen cuenta como recurrente", EN, `      if(typeof k==="string" && k.startsWith("fluyo.")) return {available:true, returning:true};`, `      if(k===ENTRY_SEEN_KEY) return {available:true, returning:true};`],
  ["M13 cualquier clave del origen cuenta como recurrente", EN, `k.startsWith("fluyo.")`, `k.length>0`],
  ["M14 sin almacenamiento se ofrece (saldría en cada carga)", EN, `  }catch(e){ return {available:false, returning:false}; }\n}\n/* La URL trae`, `  }catch(e){ return {available:true, returning:false}; }\n}\n/* La URL trae`],
  ["M15 ?ejemplo= inválido sí se intercepta", EN, `    if(new URLSearchParams(search||"").has("ejemplo")) return true;`, `    if(["compra-online"].includes(new URLSearchParams(search||"").get("ejemplo"))) return true;`],
  ["M16 #d= no cuenta como enlace profundo", EN, `    return /(?:^|[#&])d=/.test(hash||"");`, `    return false;`],
  ["M17 cualquier hash con «d=» (#dd=) cuenta", EN, `/(?:^|[#&])d=/`, `/d=/`],
  ["M18 se ofrece con sesión guardada", EN, `return !deepLink && !autosave && !!state && state.available && !state.returning;`, `return !deepLink && !!state && state.available && !state.returning;`],
  ["M19 se ofrece al recurrente", EN, `return !deepLink && !autosave && !!state && state.available && !state.returning;`, `return !deepLink && !autosave && !!state && state.available;`],
  ["M20 la clave guarda una fecha", EN, `localStorage.setItem(ENTRY_SEEN_KEY, "1")`, `localStorage.setItem(ENTRY_SEEN_KEY, String(Date.now()))`],
  /* Historia: una vez por reproducción */
  ["M21 story_completed sin guarda (cuenta cada final)", SC, `    if (!scRunCounted && scRunSurface) {\n      scRunCounted = true;`, `    if (scRunSurface) {\n      scRunCounted = true;`],
  ["M22 duplicar no cuenta como copia", SC, `scTrack("story_created", { origin: "copy" });`, `scTrack("story_created", { origin: "new" });`],
];

function copyTree(dest) {
  for (const entry of ["js", "css", "test", "s", "ejemplos", "sw.js", "index.html", "404.html", "privacy", "support", "terms"]) fs.cpSync(path.join(root, entry), path.join(dest, entry), { recursive: true });
}
function runSuite(dir) {
  const r = spawnSync(process.execPath, UNIT, { cwd: dir, encoding: "utf8", timeout: 120000, env: { ...process.env, FLUYO_GIT_ROOT: root, FLUYO_ROOT: dir } });
  return { code: r.status, timedOut: !!(r.error && r.error.code === "ETIMEDOUT") || r.signal === "SIGTERM", out: (r.stdout || "") + (r.stderr || "") };
}

const t0 = Date.now();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-gf-mut-"));
const list = MUTATIONS.filter((m) => !process.env.ONLY_MUT || m[0].split(" ")[0] === process.env.ONLY_MUT);
let failed = 0;
try {
  const base = path.join(tmp, "base"); fs.mkdirSync(base); copyTree(base);
  const sane = runSuite(base);
  if (sane.code !== 0) { console.error("La copia sin mutar NO pasa:\n" + sane.out.slice(-3000)); process.exit(2); }
  const ran = (sane.out.match(/^# pass (\d+)/m) || [])[1];
  console.log("copia sin mutar: suite OK (" + ran + " tests; 0/" + list.length + " mutaciones aplicadas)");
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
console.log((failed ? "\nFLUYO-GROWTH-FOUNDATION-001 mutaciones: " + failed + " sin detectar" : "\nFLUYO-GROWTH-FOUNDATION-001 mutaciones: " + list.length + "/" + list.length + " detectadas") + " · " + ((Date.now() - t0) / 1000).toFixed(1) + " s");
process.exit(failed ? 1 : 0);
