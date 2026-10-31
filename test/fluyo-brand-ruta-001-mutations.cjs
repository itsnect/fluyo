"use strict";
/* FLUYO-BRAND-RUTA-001 — Mutaciones sobre COPIAS aisladas (nunca sobre el árbol). Cada regresión real de la marca Ruta (marcado,
   favicon, assets, movimiento, fijo en móvil y con «reducir movimiento», tokens, marca anterior) debe hacer fallar
   test/fluyo-brand-ruta-001.test.cjs SIN contar C1 (compara con la base por git).
   Uso: node test/fluyo-brand-ruta-001-mutations.cjs   (ONLY_MUT=M3 una sola) */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const NL = "\n", CRLF = "\r\n";
const UNIT = ["--test", "--test-skip-pattern=^C1 ", "test/fluyo-brand-ruta-001.test.cjs"];
const ID = "css/identity.css";
/* [nombre, archivo, desde, hasta] — o [nombre, archivo, null, archivo cuyos bytes lo sustituyen] */
const MUTATIONS = [
  /* movimiento */
  ["M1 el bucle se declara también con «reducir movimiento»", ID, `@media (prefers-reduced-motion: no-preference){\n.logoMark .still{display:none;} .logoMark .loop{display:inline;}\n.logoMark .pan{animation:logoMark-pan 4.8s cubic-bezier(.45,0,.2,1) infinite}\n`, `.logoMark .pan{animation:logoMark-pan 4.8s cubic-bezier(.45,0,.2,1) infinite}\n@media (prefers-reduced-motion: no-preference){\n.logoMark .still{display:none;} .logoMark .loop{display:inline;}\n`],
  ["M2 el bucle dura 4 s", ID, `.logoMark .old{animation:logoMark-old 4.8s ease infinite}`, `.logoMark .old{animation:logoMark-old 4s ease infinite}`],
  ["M3 el envío «mejorado» descansa en el centro del tramo", ID, `67%,100%{offset-distance:50%;opacity:1}`, `67%,100%{offset-distance:57.69%;opacity:1}`],
  ["M4 una sola pasada", ID, `.logoMark .tok{offset-path:path("M22 16 H36 V48 H42");offset-rotate:0deg;offset-distance:50%;animation:logoMark-tok 4.8s infinite}`, `.logoMark .tok{offset-path:path("M22 16 H36 V48 H42");offset-rotate:0deg;offset-distance:50%;animation:logoMark-tok 4.8s 1}`],
  ["M5 con movimiento se ven los dos", ID, `.logoMark .still{display:none;} .logoMark .loop{display:inline;}`, `.logoMark .loop{display:inline;}`],
  /* fijo */
  ["M6 el Viewer en móvil oculta el bucle pero lo deja animando", "css/share.css", `#chrome .logo :is(.loop, .loop *){ display:none; animation:none; }`, `#chrome .logo .loop{ display:none; }`],
  ["M7 el editor de 701–860 px anima", "css/styles.css", `  body > header .logo .still{display:inline;} body > header .logo :is(.loop, .loop *){display:none; animation:none;}   /* donde iban sin puntos: el símbolo fijo */\n`, ``],
  ["M8 las páginas en móvil esconden el símbolo", "css/pages.css", `.siteHead .logo .still{ display:inline; } .siteHead .logo :is(.loop, .loop *){ display:none; animation:none; }`, `.siteHead .logo .logoMark{ display:none; }`],
  ["M9 el teléfono en apaisado anima", ID, `@media (orientation:landscape) and (max-height:500px) and (pointer:coarse){ .logo .logoMark .still{display:inline;} .logo .logoMark :is(.loop, .loop *){display:none; animation:none;} }\n`, ``],
  ["M10 el par sin hueco", "css/pages.css", `display:flex; align-items:center; gap:calc(8em / 21); flex:none; margin-inline-end:var(--s-4);`, `display:flex; align-items:center; gap:0; flex:none; margin-inline-end:var(--s-4);`],
  ["M11 el símbolo a 20 px", ID, `.logo .logoMark{width:calc(24em / 21); height:calc(24em / 21);`, `.logo .logoMark{width:calc(20em / 21); height:calc(20em / 21);`],
  /* tokens */
  ["M12 el envío en hex", ID, `.logoMark circle{fill:var(--attention);}`, `.logoMark circle{fill:#A33A22;}`],
  /* marcado */
  ["M13 el fijo con el envío del bucle (36,28)", "index.html", `<circle cx="36" cy="32" r="5.5"/></g><g class="loop">`, `<circle cx="36" cy="28" r="5.5"/></g><g class="loop">`],
  ["M14 el Viewer anuncia el dibujo", "s/index.html", `<svg class="logoMark" viewBox="0 0 64 64" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">`, `<svg class="logoMark" viewBox="0 0 64 64" fill="none" stroke-linecap="round" stroke-linejoin="round" focusable="false">`],
  ["M15 la palabra se traduce", "docs/index.html", `<span class="logoWord" translate="no">fluyo</span>`, `<span class="logoWord">fluyo</span>`],
  ["M16 el 404 con el «yo» terracota", "404.html", `<span class="logoWord" translate="no">fluyo</span>`, `<span class="logoWord" translate="no">flu<b>yo</b></span>`],
  ["M17 el destino del fijo con trazo (el del bucle)", "terms/index.html", `<rect x="42" y="40" width="16" height="16" rx="4" fill="currentColor"/><circle cx="36" cy="32" r="5.5"/>`, `<rect x="42" y="40" width="16" height="16" rx="4" fill="currentColor" stroke="currentColor" stroke-width="3.5"/><circle cx="36" cy="32" r="5.5"/>`],
  /* favicon y assets */
  ["M18 una página con el favicon de los tres puntos", "soporte/index.html", `<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64' fill='none'`, `<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Ccircle cx='18' cy='32' r='7' fill='%23A33A22'/%3E%3C/svg%3E"><link rel="x" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64' fill='none'`],
  ["M19 logo.svg redibujado", "assets/logo.svg", `stroke="#16150f" stroke-width="3.5"/><path`, `stroke="#16150f" stroke-width="3"/><path`],
  ["M20 la OG recomprimida (otros bytes)", "assets/og-image.png", null, "assets/icon-512.png"],
  ["M21 el icono 192 de antes", "assets/icon-192.png", null, "assets/icon-512.png"],
  /* marca anterior */
  ["M22 vuelven los puntos al CSS", "css/styles.css", `body > header > .hdrDiv{height:22px;`, `body > header .logo .dots{margin-left:7px;}\nbody > header > .hdrDiv{height:22px;`],
  ["M23 la marca trae su propia tipografía", ID, `.logoMark circle{fill:var(--attention);}`, `.logoMark circle{fill:var(--attention);}\n.logoWord{font-family:"Playfair Display";}`],
];

const COPY = [".ai/DECISIONS.md", ".ai/tasks/FLUYO-BRAND-RUTA-001.md", ".ai/referencias/logo-ruta", "js", "css", "test", "assets", "s", "docs", "ejemplos", "privacidad", "privacy",
  "soporte", "support", "terminos", "terms", "404.html", "index.html", "sw.js", "manifest.webmanifest"];
function copyTree(dest) {
  for (const entry of COPY) fs.cpSync(path.join(root, entry), path.join(dest, entry), { recursive: true });
}
function runSuite(dir) {
  const r = spawnSync(process.execPath, UNIT, { cwd: dir, encoding: "utf8", timeout: 300000, env: { ...process.env, FLUYO_GIT_ROOT: root, FLUYO_ROOT: dir } });
  return { code: r.status, timedOut: !!(r.error && r.error.code === "ETIMEDOUT") || r.signal === "SIGTERM", out: (r.stdout || "") + (r.stderr || "") };
}

const t0 = Date.now();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-ruta-mut-"));
const list = MUTATIONS.filter((m) => !process.env.ONLY_MUT || m[0].split(" ")[0] === process.env.ONLY_MUT);
let failed = 0;
try {
  const base = path.join(tmp, "base"); fs.mkdirSync(base); copyTree(base);
  const sane = runSuite(base);
  if (sane.code !== 0) { console.error("La copia sin mutar NO pasa:\n" + sane.out.slice(-3000)); process.exit(2); }
  const ran = (sane.out.match(/^# pass (\d+)/m) || [])[1];
  console.log("copia sin mutar: suite OK (" + ran + " tests sin C1; 0/" + list.length + " mutaciones aplicadas)");
  list.forEach(([name, file, from, to], i) => {
    const dir = path.join(tmp, "m" + i); fs.mkdirSync(dir); copyTree(dir);
    const p = path.join(dir, file);
    if (from === null) fs.copyFileSync(path.join(dir, to), p);
    else {
      const src = fs.readFileSync(p, "utf8"), crlf = src.includes(CRLF);
      const text = src.replaceAll(CRLF, NL);
      if (text.split(from).length !== 2) { console.log("  ✘ " + name + " — el patrón no existe o no es único (mutación obsoleta)"); failed++; return; }
      fs.writeFileSync(p, text.replace(from, () => to).replaceAll(NL, crlf ? CRLF : NL));
    }
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
console.log((failed ? "\nFLUYO-BRAND-RUTA-001 mutaciones: " + failed + " sin detectar" : "\nFLUYO-BRAND-RUTA-001 mutaciones: " + list.length + "/" + list.length + " detectadas") + " · " + ((Date.now() - t0) / 1000).toFixed(1) + " s");
process.exit(failed ? 1 : 0);
