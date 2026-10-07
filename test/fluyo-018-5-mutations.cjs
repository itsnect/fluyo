"use strict";
/* FLUYO-018.5 — Mutaciones sobre COPIAS aisladas (nunca sobre el árbol): cada defecto plausible de las páginas (createPageIn/renamePageIn,
   create_page/rename_page), de las reglas de entrada de nodo (HEX, icon, anim) y de los límites de autoría debe hacer fallar
   test/fluyo-018-5.test.cjs (o las suites previas que fijan el contrato). Uso: node test/fluyo-018-5-mutations.cjs */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const NL = "\n", CRLF = "\r\n";
const AUTH = "js/story-authoring.js", MODEL = "js/model.js", STATE = "js/state.js", UI = "js/ui.js";

const MUTATIONS = [
  // ── dominio de páginas
  ["P1 createPageIn inserta al principio en vez de al final", MODEL, "  d.pages.push(page);\n  return {pageIndex:d.pages.length-1, page};", "  d.pages.unshift(page);\n  return {pageIndex:0, page};"],
  ["P2 createPageIn cambia la página activa", MODEL, "  d.pages.push(page);\n  return {pageIndex:d.pages.length-1, page};", "  d.pages.push(page); d.cur=d.pages.length-1;\n  return {pageIndex:d.pages.length-1, page};"],
  ["P3 el nombre por defecto no es «Página N+1»", MODEL, "\"Página \"+(d.pages.length+1) : pageNameOf(name)", "\"Página \"+d.pages.length : pageNameOf(name)"],
  ["P4 createPageIn devuelve un pageIndex equivocado", MODEL, "return {pageIndex:d.pages.length-1, page};", "return {pageIndex:d.pages.length, page};"],
  ["P5 el nombre no tiene tope de longitud", MODEL, "!name.trim() || name.length>PAGE_NAME_MAX)", "!name.trim())"],
  ["P6 un nombre de solo espacios se acepta", MODEL, "|| !name.trim() || name.length>PAGE_NAME_MAX)", "|| name.length>PAGE_NAME_MAX)"],
  ["P7 el tope de nombre es 120 y no 80", MODEL, "const PAGE_NAME_MAX=80;", "const PAGE_NAME_MAX=120;"],
  ["P8 renamePageIn no comprueba el límite superior del índice", MODEL, " || pageIndex<0 || pageIndex>=d.pages.length) throw projectDataError(\"page_not_found\"", " || pageIndex<0) throw projectDataError(\"page_not_found\""],
  ["P9 renamePageIn renombra otra página", MODEL, "page=d.pages[pageIndex], from=page.name;", "page=d.pages[0], from=page.name;"],
  ["P10 renamePageIn no valida el nombre", MODEL, "const next=pageNameOf(name), page=", "const next=name, page="],
  // ── authoring: páginas
  ["Q1 create_page se declara de alcance «page»", AUTH, "create_page:\"document\", rename_page:\"document\",", "create_page:\"page\", rename_page:\"document\","],
  ["Q2 create_page ignora el nombre", AUTH, "r = createPageIn(ctx.d, op.name);", "r = createPageIn(ctx.d);"],
  ["Q3 create_page admite pageIndex", AUTH, "create_page:[\"name\"],", "create_page:[\"name\",\"pageIndex\"],"],
  ["Q4 rename_page renombra una página fija (la 0)", AUTH, "r = renamePageIn(ctx.d, liveIndexOf(ctx, op.pageIndex), op.name);", "r = renamePageIn(ctx.d, 0, op.name);"],   // 018.7c: ancla actualizada; misma intención
  ["Q5 el error de nombre pierde su código", AUTH, "return reject(\"INVALID_NAME\", `El nombre de la página", "return reject(\"INVALID_FIELD\", `El nombre de la página"],
  ["Q6 las operaciones de página pierden el alcance document (exigen pageIndex de página)", AUTH, "const documentLevel = expected===\"eventType\" || expected===\"document\";", "const documentLevel = expected===\"eventType\";"],
  ["Q7 create_page no informa del pageIndex creado", AUTH, "return {entityKind:\"page\", entityId:pageIndex, pageIndex, created:true,", "return {entityKind:\"page\", entityId:0, pageIndex:0, created:true,"],   // 018.7c: ancla actualizada; misma intención
  // ── reglas de entrada
  ["R1 el color HEX acepta cualquier longitud", AUTH, "const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;", "const HEX_COLOR = /^#[0-9a-fA-F]+$/;"],
  ["R2 el color HEX no está anclado", AUTH, "const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;", "const HEX_COLOR = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})/;"],
  ["R3 fill no se valida", AUTH, "const NODE_COLOR_FIELDS = [\"color\",\"fill\",", "const NODE_COLOR_FIELDS = [\"color\","],
  ["R4 el icono no se busca en el catálogo", AUTH, "if(typeof spec[k]!==\"string\" || !projectOwn(catalog, spec[k]))", "if(typeof spec[k]!==\"string\")"],
  ["R5 el catálogo se busca con `in` (acepta «constructor»)", AUTH, "!projectOwn(catalog, spec[k])", "!(spec[k] in catalog)"],
  ["R6 la forma icon no exige icon", AUTH, "if(shape===\"icon\" && spec.icon===undefined) throw", "if(false) throw"],
  ["R7 la forma anim no exige anim", AUTH, "if(shape===\"anim\" && spec.anim===undefined) throw", "if(false) throw"],
  ["R8 update_node no aplica las reglas de entrada", AUTH, "      nodeInputRules(patch, patch.shape===undefined && rec ? rec.shape : patch.shape, false);\n", ""],
  ["R9 create_node no aplica las reglas de entrada", AUTH, "      nodeInputRules(spec, spec.shape, true);\n", ""],
  // ── límites
  ["L1 coordMax = 100001", AUTH, "coordMax:100000,", "coordMax:100001,"],
  ["L2 maxNodesPerPage = 301", AUTH, "maxNodesPerPage:300,", "maxNodesPerPage:301,"],
  ["L3 maxConnectionsPerPage = 601", AUTH, "maxConnectionsPerPage:600}", "maxConnectionsPerPage:601}"],
  ["L4 sizeMin = 9", AUTH, "sizeMin:10,", "sizeMin:9,"],
  ["L5 sizeMax = 5001", AUTH, "sizeMax:5000,", "sizeMax:5001,"],
  ["L6 el conteo rechaza también el límite exacto (>=)", AUTH, "if(n>LIMITS[limitName] && n>b)", "if(n>=LIMITS[limitName] && n>b)"],
  ["L7 el conteo es retroactivo (documentos antiguos que ya excedían)", AUTH, "if(n>LIMITS[limitName] && n>b)", "if(n>LIMITS[limitName])"],
  ["L8 x,y se comprueban aunque el lote no los escriba (retroactivo)", AUTH, "for(const f of [\"x\",\"y\"]) if(w.fields.has(f) && Math.abs", "for(const f of [\"x\",\"y\"]) if(true && Math.abs"],
  ["L9 los límites no se evalúan", AUTH, "    if(over.length) return failure(over);", "    if(false) return failure(over);"],
  ["L10 el rechazo no dice el valor actual", AUTH, "{code:\"LIMIT_EXCEEDED\", limitName, limit, actual, field,", "{code:\"LIMIT_EXCEEDED\", limitName, limit, field,"],
  ["L11 los waypoints no se vigilan en update_connection", AUTH, "if(patch.waypoints!==undefined) watch(ctx, op, op.pageIndex, \"connection\", id, [\"waypoints\"]);", "if(false) watch(ctx, op, op.pageIndex, \"connection\", id, [\"waypoints\"]);"],
  ["L12 los límites se evalúan por operación y no sobre el estado final", AUTH, "      watch(ctx, op, op.pageIndex, \"node\", n.id, [\"x\",\"y\",\"w\",\"h\"]);", "      watch(ctx, op, op.pageIndex, \"node\", n.id, [\"x\",\"y\",\"w\",\"h\"]); { const o=limitErrors(ctx, ctx.d); if(o.length) throw reject(\"LIMIT_EXCEEDED\", o[0].message, {}); }"],
  ["L13 los nodos eliminados dentro del lote se siguen comprobando", AUTH, "      if(!rec) continue;\n", "      if(!rec){ out.push(limitError(\"coordMax\", \"x\", 0, {where:\"x\"})); continue; }\n"],
  ["L14 el conteo de conexiones usa la lista de nodos", AUTH, "[pg.edges, \"maxConnectionsPerPage\", \"connections\"]", "[pg.nodes, \"maxConnectionsPerPage\", \"connections\"]"],
  // ── editor (misma autoridad)
  ["E1 ui.js vuelve a crear páginas por su cuenta", UI, "    addPage(); clearSel();", "    doc.pages.push(blankPage(\"Página \"+(doc.pages.length+1))); doc.cur=doc.pages.length-1; clearSel();"],
  ["E2 ui.js vuelve a renombrar por su cuenta", UI, "      try{ renamePage(i,nn); }", "      try{ pg.name=nn; }"],
  ["E3 addPage no activa la página nueva", STATE, "function addPage(){ const r=createPageIn(doc); doc.cur=r.pageIndex; return r.page; }", "function addPage(){ const r=createPageIn(doc); return r.page; }"],
  ["E4 renamePage renombra otra página", STATE, "return renamePageIn(doc,index,name).page;", "return renamePageIn(doc,0,name).page;"],
];

function copyTree(dest) {
  for (const entry of ["js", "css", "s", "ejemplos/data", "index.html", "sw.js", "manifest.webmanifest", "test"]) {
    const from = path.join(root, entry);
    if (fs.existsSync(from)) fs.mkdirSync(path.dirname(path.join(dest, entry)), { recursive: true }), fs.cpSync(from, path.join(dest, entry), { recursive: true });
  }
}
function runSuite(dir) {
  const r = spawnSync(process.execPath, ["--test", "test/fluyo-018-5.test.cjs", "test/fluyo-018-3.test.cjs", "test/fluyo-018-2.test.cjs", "test/fluyo-017-2.test.cjs", "test/fluyo-017-2-qa.test.cjs"], { cwd: dir, encoding: "utf8", timeout: 180000 });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-018-5-mut-"));
let failed = 0;
try {
  const base = path.join(tmp, "base"); fs.mkdirSync(base); copyTree(base);
  const sane = runSuite(base);
  if (sane.code !== 0) { console.error("La copia sin mutar NO pasa la suite:\n" + sane.out.slice(-1500)); process.exit(2); }
  console.log("copia sin mutar: suite OK (0/" + MUTATIONS.length + " mutaciones aplicadas)");
  MUTATIONS.forEach(([name, file, from, to], i) => {
    const dir = path.join(tmp, "m" + i); fs.mkdirSync(dir); copyTree(dir);
    const p = path.join(dir, file);
    const src = fs.readFileSync(p, "utf8"), crlf = src.includes(CRLF);
    const text = src.replaceAll(CRLF, NL);
    if (!text.includes(from)) { console.log("  ✘ " + name + " — el patrón no existe (mutación obsoleta)"); failed++; return; }
    fs.writeFileSync(p, (text.replace(from, () => to)).replaceAll(NL, crlf ? CRLF : NL));
    const r = runSuite(dir);
    const killed = r.code !== 0;
    const n = (r.out.match(/^not ok /gm) || []).length;
    console.log((killed ? "  ✔ detectada  " : "  ✘ SOBREVIVE  ") + name + (killed ? "  (" + n + " tests fallan)" : ""));
    if (!killed) failed++;
    fs.rmSync(dir, { recursive: true, force: true });
  });
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(failed ? "\nFLUYO-018.5 mutaciones: " + failed + " sin detectar" : "\nFLUYO-018.5 mutaciones: " + MUTATIONS.length + "/" + MUTATIONS.length + " detectadas");
process.exit(failed ? 1 : 0);
