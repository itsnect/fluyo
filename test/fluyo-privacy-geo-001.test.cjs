"use strict";
/* FLUYO-PRIVACY-GEO-001 — la política describe lo que Umami obtiene de la petición, no solo lo que envía el navegador (decisión 334).
   · Alcance frente a la base: solo texto en las dos políticas y en docs/, un comentario de index.html y CACHE; la telemetría no cambia.
   · Español e inglés declaran lo mismo, y la retención está escrita, nunca pendiente.
   · Sobre la IP solo se afirma lo que dice Umami, atribuido; las afirmaciones desmentidas por la revisión no vuelven. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.join(__dirname, "..");
const BASE = "145d9ac";
const read = (f) => fs.readFileSync(path.join(root, f), "utf8").replace(/\r\n/g, "\n");
const ES = "privacidad/index.html", EN = "privacy/index.html";

test("alcance frente a " + BASE + ": solo las dos políticas, docs/, los comentarios de index.html y analytics.js, y sw.js; undoGeo da la base EXACTA; sw.js solo CACHE v124; telemetría intacta", () => {
  const gitRoot = process.env.FLUYO_GIT_ROOT || root;
  const atBase = (f) => execFileSync("git", ["-C", gitRoot, "show", BASE + ":" + f], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).replace(/\r\n/g, "\n");
  try { atBase("sw.js"); } catch { return; }   // sin git
  const { undoGeo, PIECES, NEW_FILES, BASE_GEO } = require("./fluyo-privacy-geo-001-undo.cjs");
  assert.equal(BASE_GEO, BASE); assert.deepEqual(NEW_FILES, []);
  const SERVED = ["js", "s", "css", "assets", "index.html", "404.html", "sw.js", "manifest.webmanifest", "docs", "ejemplos", "privacidad", "privacy", "soporte", "support", "terminos", "terms"];
  const changed = execFileSync("git", ["-C", gitRoot, "diff", "--name-only", BASE, "--", ...SERVED], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).split("\n").filter(Boolean);
  const FILES = ["docs/index.html", "index.html", "js/analytics.js", ES, EN];
  assert.deepEqual(Object.keys(PIECES).sort(), FILES);
  assert.deepEqual(changed.sort(), [...FILES, "sw.js"].sort());
  for (const f of FILES) assert.equal(undoGeo(f, read(f)), atBase(f), f + ": undoGeo exacto");
  const noCache = (s) => s.replace(/const CACHE = "fluyo-static-v\d+";/, "");
  assert.equal(noCache(read("sw.js")), noCache(atBase("sw.js")), "sw.js: solo la constante");
  assert.match(read("sw.js"), /const CACHE = "fluyo-static-v124";/);
  /* js/analytics.js: una sola línea, dentro del comentario del proveedor; sin él, el archivo es idéntico a la base. */
  const noWhy = (s) => s.replace(/\/\* Se eligió Umami Cloud sobre Vercel Web Analytics[\s\S]*?\*\//, "");
  assert.notEqual(noWhy(read("js/analytics.js")), read("js/analytics.js"), "el comentario sigue ahí");
  assert.equal(noWhy(read("js/analytics.js")), noWhy(atBase("js/analytics.js")), "js/analytics.js: fuera del comentario, nada cambia");
  const an = atBase("js/analytics.js").split("\n"), bn = read("js/analytics.js").split("\n");
  assert.equal(an.length, bn.length); assert.equal(bn.filter((l, i) => l !== an[i]).length, 1, "js/analytics.js: una línea");
  /* index.html: solo dos líneas, ambas dentro del comentario de telemetría; sin él, el archivo es idéntico a la base. */
  const noComment = (s) => s.replace(/<!--\n  Telemetría — solo en el sitio público[\s\S]*?-->/, "");
  assert.notEqual(noComment(read("index.html")), read("index.html"), "el comentario sigue ahí");
  assert.equal(noComment(read("index.html")), noComment(atBase("index.html")), "index.html: fuera del comentario, nada cambia");
  const a = atBase("index.html").split("\n"), b = read("index.html").split("\n");
  assert.equal(a.length, b.length); assert.equal(b.filter((l, i) => l !== a[i]).length, 2, "index.html: dos líneas");
  assert.equal(read("js/editor-analytics.js"), atBase("js/editor-analytics.js"), "ningún evento cambia");
});

test("la política declara en los dos idiomas lo que Umami obtiene de la petición", () => {
  const FACTS = [
    [ES, ["Lo que Umami obtiene de la propia petición", "tu dirección IP y tu User-Agent", "país, región y ciudad aproximados", "navegador, sistema operativo y tipo de dispositivo",
      "identificador de sesión con un hash del sitio, la IP, el User-Agent", "según Umami, rota cada mes por defecto", "esos datos derivados y la secuencia de eventos de cada sesión en el panel de Umami", "Fluyo no envía a Umami ningún identificador de usuario ni de cuenta, y no publica actividad por sesión", "no es una garantía de anonimato absoluto"]],
    [EN, ["What Umami gets from the request itself", "your IP address and User-Agent", "approximate country, region and city", "browser, operating system and device type",
      "session identifier using a hash of the site, the IP, the User-Agent", "according to Umami, rotates monthly by default", "this derived data and each session's sequence of events in Umami's dashboard", "Fluyo sends Umami no user or account identifier and does not publish per-session activity", "not a guarantee of absolute anonymity"]],
  ];
  for (const [f, facts] of FACTS) for (const s of facts) assert.ok(read(f).includes(s), f + ": " + s);
});

test("IP: atribuido a Umami, sin afirmar que la IP sin procesar se guarda en la analítica", () => {
  assert.ok(read(ES).includes("También según Umami, la IP se procesa de forma transitoria para esos cálculos y no se guarda como campo en sus registros de analítica"));
  assert.ok(read(ES).includes("registros operativos y de seguridad, separados de la analítica"));
  assert.ok(read(EN).includes("Also according to Umami, the IP is processed transiently for those calculations and not stored as a field in its analytics records"));
  assert.ok(read(EN).includes("operational and security logs, separate from analytics"));
  assert.doesNotMatch(read(ES), /identificador de sesión anónimo/);
  assert.doesNotMatch(read(ES), /no los combinamos/);
  assert.doesNotMatch(read(EN), /do not combine/);
  assert.doesNotMatch(read(EN), /anonymous session identifier/);
});

test("«ningún identificador de usuario» es cierto: el payload no lleva `id` ni se llama a identify", () => {
  const src = read("js/analytics.js"), body = src.slice(src.indexOf("function analyticsBeforeSend"), src.indexOf("const analyticsQueue"));
  assert.match(body, /const safe=\{website:UMAMI_WEBSITE_ID,hostname:location\.hostname,url:"\/",title:"Fluyo",referrer:""\};/);
  assert.doesNotMatch(src, /umami\.identify|distinct-?id/i);
  assert.doesNotMatch(read("js/editor-analytics.js"), /umami\.identify|distinct-?id/i);
  assert.doesNotMatch(src, /\bfetch\(|XMLHttpRequest/, "el producto no lee datos de analítica");
});

test("la fila de Umami declara IP y User-Agent, y la retención está escrita, no pendiente", () => {
  const row = (f) => read(f).split("\n").find((l) => l.includes("<strong>Umami Cloud</strong>"));
  assert.match(row(ES), /más IP y User-Agent en la petición/);
  assert.match(row(EN), /plus IP and User-Agent on the request/);
  assert.ok(row(ES).includes("<em>Retención de los registros de analítica: 6 meses, la que Umami declara para el plan Hobby que usa Fluyo.</em>"));
  assert.ok(row(EN).includes("<em>Analytics record retention: 6 months, as Umami states for the Hobby plan Fluyo uses.</em>"));
  assert.doesNotMatch(read(ES), /a confirmar/i);
  assert.doesNotMatch(read(EN), /to confirm/i);
});

test("derechos: los registros de sesión de Umami cuentan como datos fuera de tu equipo", () => {
  assert.ok(read(ES).includes("los registros operativos y de seguridad que Vercel, Umami o Cloudflare puedan tener; y los registros de sesión de Umami, descritos en «Telemetría de producto»"));
  assert.ok(read(EN).includes("any operational and security logs Vercel, Umami or Cloudflare may have; and Umami's session records, described under “Product analytics”"));
  assert.ok(!read(ES).includes("no se guarda nada que te identifique"));
  assert.ok(!read(EN).includes("nothing identifying you is stored"));
});

test("compartición: sin «con nadie», con cada proveedor y lo que recibe, en los dos idiomas", () => {
  const table = (f) => read(f).slice(read(f).indexOf("<strong>Vercel</strong></td>"));
  for (const [f, sell, personal, web] of [
    [ES, "Fluyo no vende datos", "información que puede ser personal, como tu IP y tu User-Agent", "En el uso normal del editor, ninguno de ellos recibe el contenido de tus diagramas"],
    [EN, "Fluyo does not sell data", "information that can be personal, such as your IP address and User-Agent", "In normal use of the editor, none of them receives the content of your diagrams"],
  ]) {
    for (const s of [sell, personal, web]) assert.ok(read(f).includes(s), f + ": " + s);
    for (const p of ["<strong>Vercel</strong></td>", "<strong>Google Cloud</strong></td>", "<strong>Umami Cloud</strong></td>", "<strong>Cloudflare</strong></td>"]) assert.ok(table(f).includes(p), f + ": " + p);
    assert.doesNotMatch(read(f), /\[\[VERCEL/, f + ": retención de Vercel escrita");
  }
});

test("alojamiento: fluyo.space en Vercel y mcp.fluyo.space en Google Cloud; los 7 días son de Google Cloud", () => {
  assert.ok(read(ES).includes("<code>fluyo.space</code> está alojado en <strong>Vercel</strong>, y <code>mcp.fluyo.space</code> en <strong>Google Cloud</strong>"));
  assert.ok(read(EN).includes("<code>fluyo.space</code> is hosted on <strong>Vercel</strong>, and <code>mcp.fluyo.space</code> on <strong>Google Cloud</strong>"));
  assert.ok(read(ES).includes("<strong>Retención en Google Cloud: 7 días.</strong>"));
  assert.ok(read(EN).includes("<strong>Retention on Google Cloud: 7 days.</strong>"));
  for (const bad of [/Los dos dominios —/, /Both domains —/, /de los dos dominios/, /for both domains/, /Ninguno de los tres/, /None of the three/]) for (const f of [ES, EN]) assert.doesNotMatch(read(f), bad, f + ": " + bad);
});

test("retención por proveedor: un plazo sin confirmar no lleva cifra; Cloudflare es DNS, no proxy", () => {
  assert.ok(read(ES).includes("en el plan Hobby que usa Fluyo los <em>runtime logs</em> se conservan 1 hora"));
  assert.ok(read(ES).includes("No hemos confirmado un plazo para sus <em>request logs</em> ni para sus <em>CDN requests</em>"));
  assert.ok(read(EN).includes("on the Hobby plan Fluyo uses, <em>runtime logs</em> are kept for 1 hour"));
  assert.ok(read(EN).includes("We have not confirmed a period for its <em>request logs</em> or its <em>CDN requests</em>"));
  assert.ok(read(ES).includes("<strong>Cloudflare</strong> resuelve el DNS de <code>fluyo.space</code>, sin hacer de proxy"));
  assert.ok(read(EN).includes("<strong>Cloudflare</strong> resolves the DNS for <code>fluyo.space</code>, without acting as a proxy"));
});

test("contenido: sin absolutos; se distinguen editor, fragmento, query y MCP", () => {
  /* Las dos políticas tienen la misma estructura: una sección que falta en un idioma es una promesa que el otro no hace. */
  for (const tag of ["h2", "h3", "p", "li", "tr", "table"]) {
    const count = (f) => (read(f).match(new RegExp("<" + tag + "[ >]", "g")) || []).length;
    assert.equal(count(EN), count(ES), "misma cantidad de <" + tag + "> en ES y EN");
  }
  assert.ok(read(ES).includes("La copia viaja en el fragmento <code>#d=</code>"));
  assert.ok(read(EN).includes("The copy travels in the <code>#d=</code> fragment"));
  for (const [f, facts] of [
    [ES, ["Usando el editor, no salen de tu navegador", "Ese contenido no viaja en la petición HTTP", "la ruta y, si la hay, la query", "El contenido solo llega a un servidor si se lo envías expresamente", "El servidor no lo guarda, no lo reenvía a otros servicios", "En el uso normal del editor, ninguno de ellos recibe el contenido de tus diagramas"]],
    [EN, ["When you use the editor, they do not leave your browser", "That content does not travel in the HTTP request", "the path and, if present, the query", "The content only reaches a server if you send it there explicitly", "The server does not store it, does not forward it to other services", "In normal use of the editor, none of them receives the content of your diagrams"]],
  ]) for (const s of facts) assert.ok(read(f).includes(s), f + ": " + s);
  for (const f of [ES, EN, "README.md", "docs/index.html"])
    for (const bad of [/No se envían a ninguna parte/, /not sent anywhere/, /tampoco llega a ningún servidor/, /does not reach any server/, /Nada se comparte/, /Nothing is shared/, /ha salido nunca de tu navegador/, /has ever left your browser/, /nunca salen de tu navegador/, /no se envía nunca<\/strong>/, /no se envía nunca\*\*/, /is never sent\.<\/strong>/])
      assert.doesNotMatch(read(f), bad, f + ": " + bad);
});

test("las afirmaciones desmentidas por la revisión no vuelven", () => {
  for (const f of [ES, EN, "README.md", "docs/index.html"]) {
    for (const bad of [/fingerprint/i, /sin identificar usuarios/i, /no user identification/i, /sin cookies ni identificadores/i, /without cookies or identifiers/i, /analítica de uso agregada/i, /aggregate usage analytics/i, /only two third-party domains/i, /pageviews y /i, /eventos de uso agregados/i, /Con nadie/, /<strong>Nobody/, /se actualizarán esta cifra/, /this figure and the date/, /que caducan con la retención indicada/, /which expire under the retention/, /Tampoco hace perfiles/, /does no profiling/, /ningún perfil/, /no profile that/, /or profile of yours/])
      assert.doesNotMatch(read(f), bad, f + ": " + bad);
  }
  assert.doesNotMatch(read("index.html"), /fingerprint|eventos de uso agregados/i, "comentario de index.html");
  assert.doesNotMatch(read("js/analytics.js"), /fingerprint/i, "comentario de js/analytics.js");
  assert.doesNotMatch(read("AGENTS.md"), /nunca sale del navegador/, "AGENTS.md");
  assert.ok(read("AGENTS.md").includes("los documentos enviados explícitamente al MCP sí los procesa su servicio remoto"), "AGENTS.md");
  for (const [f, link] of [["README.md", "https://fluyo.space/privacidad/"], ["docs/index.html", "../privacidad/"]]) {
    assert.ok(read(f).includes("una lista cerrada de eventos de uso, sin pageviews"), f);
    assert.ok(read(f).includes(link), f + ": enlaza a la política");
  }
});
