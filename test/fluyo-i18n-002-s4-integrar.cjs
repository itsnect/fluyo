"use strict";
/* FLUYO-I18N-002 S4 — Paso de integración del CACHE (no es un test; no corre en la suite). Sube la constante CACHE de sw.js y las
   aserciones que la repiten en test/*.cjs (como cada tarea desde v108). Va APARTE del parche de S4 a propósito: S2a (v111) y S4 (v112)
   tocan las mismas ~90 líneas de test, y mientras S2a esté sin commit el parche no debe pisar esos archivos.
   Uso, DESPUÉS del commit de S2a:   node test/fluyo-i18n-002-s4-integrar.cjs [desde] [hasta]     (por defecto 111 → 112)
   Es idempotente: si sw.js ya está en `hasta`, no hace nada. Solo sustituye la cadena exacta "fluyo-static-v<desde>". */
const fs = require("node:fs"), path = require("node:path");
const root = path.join(__dirname, "..");
const from = Number(process.argv[2] || 111), to = Number(process.argv[3] || from + 1);
const OLD = `fluyo-static-v${from}`, NEW = `fluyo-static-v${to}`;
const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
if (sw.includes(NEW)) { console.log(`sw.js ya está en ${NEW}: nada que hacer`); process.exit(0); }
if (!sw.includes(`"${OLD}"`)) { console.error(`sw.js no declara CACHE ${OLD}: ¿S2a ya está integrada con ese número?`); process.exit(1); }
let files = 0, hits = 0;
for (const f of ["sw.js", ...fs.readdirSync(__dirname).filter((n) => n.endsWith(".cjs")).map((n) => path.join("test", n))]) {
  const p = path.join(root, f), s = fs.readFileSync(p, "utf8");
  if (!s.includes(OLD)) continue;
  const n = s.split(OLD).length - 1;
  fs.writeFileSync(p, s.split(OLD).join(NEW)); files++; hits += n;
}
console.log(`CACHE ${OLD} → ${NEW}: ${hits} sustituciones en ${files} archivos`);
