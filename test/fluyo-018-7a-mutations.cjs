"use strict";
/* FLUYO-018.7a — Mutaciones sobre COPIAS aisladas (nunca sobre el árbol): cada defecto plausible de F1 (Undo tras borrar página),
   set_theme, orden Z y duplicate_node debe hacer fallar las suites de 018.7a. Una mutación puede ser una lista de pares [from,to]
   (cuando la regla vive en dos capas a propósito: dominio y comprobación defensiva).
   Uso: node test/fluyo-018-7a-mutations.cjs */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const NL = "\n", CRLF = "\r\n";
const MODEL = "js/model.js", SEL = "js/selection.js", UI = "js/ui.js", AUTH = "js/story-authoring.js";

const MUTATIONS = [
  // ── F1: Undo/Redo tras borrar una página
  // ── F1: Undo/Redo tras borrar una página. 018.7c sustituyó el hotfix (vaciar pilas) por Undo por REFERENCIA de página; las cuatro
  //    mutaciones se reescriben sobre el mecanismo nuevo con la misma intención: romper la protección contra F1.
  /* Con el borrado registrado como entrada y pilas LIFO, un snapshot por índice vuelve a coincidir con su página al deshacer en orden:
     el defecto observable es índice + borrado fuera del historial (el F1 original). */
  ["F1a los snapshots vuelven a identificar la página por ÍNDICE y el borrado no entra en el historial (F1 original)", [
    [SEL, "function snapPage(){ return pageSnap(P()); }", "function snapPage(){ return Object.assign(pageSnap(P()),{pi:doc.cur}); }"],
    [SEL, "  const i=doc.pages.indexOf(s.page);\n  if(i<0) return null;", "  const i=s.pi!==undefined ? Math.min(s.pi,doc.pages.length-1) : doc.pages.indexOf(s.page);\n  if(i<0) return null;"],
    [SEL, "  restorePageContent(s.page, s.data);", "  restorePageContent(doc.pages[i], s.data);"],
    [SEL, "  pushUndoSnapshot({kind:\"insertPage\", page, index, curPage, lib});\n", ""]]],
  ["F1b Undo del borrado reinserta una copia (las entradas previas de esa página dejan de aplicar)", SEL, "    restorePageIn(doc, s.index, s.page);", "    restorePageIn(doc, s.index, deep(s.page));"],
  ["F1c la ✕ borra sin entrada de Undo", SEL, "  pushUndoSnapshot({kind:\"insertPage\", page, index, curPage, lib});\n", ""],
  ["F1d cancelar el confirm vacía las pilas", SEL, "  if(!confirm(pageDeleteConfirmMessage(pageRemovalImpactIn(doc, index)))) return false;", "  if(!confirm(pageDeleteConfirmMessage(pageRemovalImpactIn(doc, index)))){ undoStack.length=0; redoStack.length=0; return false; }"],
  // ── set_theme: dominio
  ["T1 el dominio acepta un tema desconocido", MODEL, 'if(patch.theme!==undefined && !(typeof patch.theme==="string" && projectOwn(THEMES,patch.theme))) throw projectDataError("invalid_theme","theme");', ""],
  ["T2 el tema se comprueba con `in` (acepta claves heredadas)", MODEL, 'typeof patch.theme==="string" && projectOwn(THEMES,patch.theme)', 'typeof patch.theme==="string" && patch.theme in THEMES'],
  ["T3 null se guarda como null en lugar de \"\"", MODEL, 'd.customBg=patch.customBg===null? "" : patch.customBg;', "d.customBg=patch.customBg;"],
  ["T4 changed siempre true", MODEL, "return {changed:from.theme!==to.theme || from.customBg!==to.customBg,", "return {changed:true,"],
  ["T5 se escribe el tema antes de validar el fondo (no es todo o nada)", MODEL, 'if(patch.customBg!==undefined && patch.customBg!==null && typeof patch.customBg!=="string") throw projectDataError("invalid_document","customBg");', 'if(patch.theme!==undefined) d.theme=patch.theme; if(patch.customBg!==undefined && patch.customBg!==null && typeof patch.customBg!=="string") throw projectDataError("invalid_document","customBg");'],
  ["T6 un parche vacío se acepta", MODEL, 'if(!fields.length) throw projectDataError("empty_patch");', ""],
  ["T7 campos desconocidos del parche se aceptan", MODEL, "authoringSpec(patch,THEME_PATCH_KEYS);\n  const fields", "const fields"],
  // ── set_theme: autoría y editor
  ["T8 customBg no HEX se acepta en autoría", AUTH, 'if(v!==undefined && v!==null && v!=="" && !(typeof v==="string" && HEX_COLOR.test(v)))', "if(false)"],
  ["T9 set_theme sin campos se acepta (autoría y dominio)", [[AUTH, 'if(!Object.keys(patch).length) throw reject("INVALID_OPERATION", "set_theme necesita', 'if(false) throw reject("INVALID_OPERATION", "set_theme necesita'], [MODEL, 'if(!fields.length) throw projectDataError("empty_patch");', ""]]],
  ["T10 set_theme declara otro alcance", AUTH, 'set_theme:"document"', 'set_theme:"page"'],
  ["T11 el editor escribe el tema a mano", UI, '$("themeSel").onchange=()=>{ setThemeIn(doc,{theme:$("themeSel").value}); scheduleAutosave(); };', '$("themeSel").onchange=()=>{ doc.theme=$("themeSel").value; scheduleAutosave(); };'],
  ["T12 el cambio de tema entra en Undo", UI, '$("themeSel").onchange=()=>{ setThemeIn(', '$("themeSel").onchange=()=>{ pushUndo(); setThemeIn('],
  ["T13 el tema se aplica sin comprobar el valor del <select> (customBg a mano)", UI, '$("btnBgClear").onclick=()=>{ setThemeIn(doc,{customBg:""});', '$("btnBgClear").onclick=()=>{ doc.customBg="";'],
  // ── orden Z
  ["Z1 forward y backward intercambiados", MODEL, 'if(placement==="forward"){', 'if(placement==="backward"){'],
  ["Z2 «al frente» ordena por id, no por el orden del documento", MODEL, "return ns.filter(id=>!set.has(id)).concat(ns.filter(id=>set.has(id)));", "return ns.filter(id=>!set.has(id)).concat(ns.filter(id=>set.has(id)).sort((a,b)=>a-b));"],
  ["Z3 «al fondo» ordena por id, no por el orden del documento", MODEL, "return ns.filter(id=>set.has(id)).concat(ns.filter(id=>!set.has(id)));", "return ns.filter(id=>set.has(id)).sort((a,b)=>a-b).concat(ns.filter(id=>!set.has(id)));"],
  ["Z4 changed siempre true", MODEL, "const changed=to.some((id,i)=>id!==from[i]);", "const changed=true;"],
  ["Z5 los nodos se clonan (se pierde la identidad)", MODEL, "pg.nodes.splice(0,pg.nodes.length,...to.map(id=>byId.get(id)));", "pg.nodes.splice(0,pg.nodes.length,...to.map(id=>JSON.parse(JSON.stringify(byId.get(id)))));"],
  ["Z6 reordenar toca el campo order (animación build)", MODEL, "pg.nodes.splice(0,pg.nodes.length,...to.map(id=>byId.get(id)));", "pg.nodes.splice(0,pg.nodes.length,...to.map(id=>byId.get(id))); pg.nodes.forEach((n,i)=>{ n.order=i; });"],
  ["Z7 un id inexistente se ignora", MODEL, 'if(!pg.nodes.some(n=>n.id===id)){ const err=projectDataError("node_not_found","nodes"); err.id=id; throw err; }\n    set.add(id);\n  }\n  return set;', "set.add(id);\n  }\n  return set;"],
  ["Z8 un placement desconocido se acepta", MODEL, 'if(!Z_PLACEMENTS.has(placement)) throw projectDataError("invalid_placement","to");', ""],
  ["Z9 el editor crea Undo aunque no cambie nada", SEL, "  if(plan.every((id,i)=>id===P().nodes[i].id)) return;\n", ""],
  ["Z10 el editor no crea Undo al reordenar", SEL, "  pushUndo();\n  reorderNodesIn(P(), ids, placement);", "  reorderNodesIn(P(), ids, placement);"],
  ["Z11 el editor reordena sin el dominio (solo front)", SEL, "function bringForward(){ reorderSelection(\"forward\"); }", "function bringForward(){ reorderSelection(\"front\"); }"],
  ["Z12 el editor ignora la selección y reordena todo", SEL, "const ids=[...selN];\n  let plan;", "const ids=P().nodes.map(n=>n.id);\n  let plan;"],
  ["Z13 reorder_nodes de autoría ignora «to»", AUTH, "try{ r = reorderNodesIn(pg, ids, op.to); }", 'try{ r = reorderNodesIn(pg, ids, "front"); }'],
  ["Z14 reorder_nodes no informa el cambio de orden", AUTH, "affects:Object.assign({stories:[]}, r.changed ? {order:{from:r.from, to:r.to}} : {})", "affects:{stories:[]}"],
  // ── duplicate_node: dominio
  ["D1 se copian conexiones que salen del conjunto", [[MODEL, "pg.edges.filter(e=>set.has(e.from) && set.has(e.to))", "pg.edges.filter(e=>set.has(e.from) || set.has(e.to))"], [MODEL, "(snapshot.edges||[]).filter(e=>inSet.has(e.from) && inSet.has(e.to))", "(snapshot.edges||[]).filter(e=>inSet.has(e.from) || inSet.has(e.to))"]]],
  ["D2 los Behaviors no se copian", MODEL, "if(projectOwn(map,b.nodeId)){ pg.behaviors.push", "if(false){ pg.behaviors.push"],
  ["D3 los waypoints no se desplazan", MODEL, "(c.waypoints||[]).forEach(w=>{ w.x+=dx; w.y+=dy; });", ""],
  ["D4 los ids no se reservan (el contador no avanza)", MODEL, "let nextId=reserveStructureIds(pg, snapshot.nodes.length+edges.length);", "let nextId=structuralNextId(pg);"],
  ["D5 los ids siguen el orden de la lista", MODEL, "const nodes=pg.nodes.filter(n=>set.has(n.id));", "const nodes=ids.map(id=>pg.nodes.find(n=>n.id===id));"],
  ["D6 la copia conserva el order del original", MODEL, "c.x+=dx; c.y+=dy; c.order=pg.nodes.length;", "c.x+=dx; c.y+=dy;"],
  ["D7 el desplazamiento por defecto es 0", MODEL, "const dx=offset && offset.dx!==undefined ? offset.dx : GRID,", "const dx=offset && offset.dx!==undefined ? offset.dx : 0,"],
  ["D8 las conexiones copiadas no se remapean", MODEL, "c.from=map[e.from]; c.to=map[e.to];", ""],
  ["D9 el Behavior copiado conserva el nodeId original", MODEL, "pg.behaviors.push({...deep(b), nodeId:map[b.nodeId]});", "pg.behaviors.push({...deep(b)});"],
  ["D10 connections:\"none\" se ignora", MODEL, 'const edges=o.connections==="none"? [] : pg.edges', "const edges=pg.edges"],
  ["D11 un id inexistente se ignora al duplicar", MODEL, 'if(!pg.nodes.some(n=>n.id===id)){ const err=projectDataError("node_not_found","nodes"); err.id=id; throw err; }\n    set.add(id);\n  }\n  const nodes', "set.add(id);\n  }\n  const nodes"],
  ["D12 la copia comparte el objeto del original (sin copia profunda)", MODEL, "const c=deep(n); map[n.id]=c.id=nextId++;", "const c=n; map[n.id]=nextId++;"],
  ["D13 las coordenadas se desplazan solo en x", MODEL, "c.x+=dx; c.y+=dy; c.order=pg.nodes.length;", "c.x+=dx; c.order=pg.nodes.length;"],
  // ── duplicate_node: editor
  ["D20 Ctrl+D vuelve a pasar por el portapapeles", SEL, "function dupSel(){\n  if(!selN.size) return;", "function dupSel(){\n  if(!selN.size) return;\n  copySel();"],
  ["D21 Ctrl+D no deja entrada de Undo", SEL, '  catch(err){ if(err && typeof err.code==="string" && err.code!=="id_exhausted") return; throw err; }\n  pushUndoSnapshot(snap);', '  catch(err){ if(err && typeof err.code==="string" && err.code!=="id_exhausted") return; throw err; }'],
  ["D22 Ctrl+D registra Undo antes del dominio (entrada si falla)", SEL, "  const snap=snapPage();\n  let r;\n  try{ r=duplicateNodesIn", "  const snap=snapPage(); pushUndoSnapshot(snap);\n  let r;\n  try{ r=duplicateNodesIn"],
  ["D23 Ctrl+D no selecciona lo nuevo", SEL, "  selN=new Set(r.nodes.map(x=>x.id)); selE=new Set(r.connections.map(x=>x.id));\n  refreshPanel();\n}\n/* Política de borrado", "  refreshPanel();\n}\n/* Política de borrado"],
  ["D24 pegar pierde la cascada de pegados sucesivos", SEL, "  clip.nodes.forEach(n=>{n.x+=GRID; n.y+=GRID;});\n", ""],
  ["D25 pegar no deja entrada de Undo", SEL, "  pushUndoSnapshot(snap);\n  selN=new Set(r.nodes.map(x=>x.id)); selE=new Set(r.connections.map(x=>x.id));\n  // cascada", "  selN=new Set(r.nodes.map(x=>x.id)); selE=new Set(r.connections.map(x=>x.id));\n  // cascada"],
  ["D26 Ctrl+D con solo conexiones seleccionadas duplica algo", SEL, "function dupSel(){\n  if(!selN.size) return;", "function dupSel(){\n  if(!selN.size && !selE.size){ return; }\n  if(!selN.size) selN=new Set(P().nodes.map(n=>n.id));"],
  // ── duplicate_node: autoría
  ["D30 el tope de nodos no cuenta las copias", AUTH, "      ctx.countOps[op.pageIndex] = Object.assign(ctx.countOps[op.pageIndex] || {}, {nodes:ctx.opIndex});\n      const withWaypoints", "      const withWaypoints"],
  ["D31 el tope de conexiones no cuenta las copias", AUTH, "      if(r.connections.length) ctx.countOps[op.pageIndex] = Object.assign(ctx.countOps[op.pageIndex], {connections:ctx.opIndex});\n", ""],
  ["D32 coordMax no se comprueba en las copias", AUTH, 'watch(ctx, op, op.pageIndex, "node", n.id, ["x","y"]);\n        createdList.push', "createdList.push"],
  ["D33 las refs de las copias no se registran", AUTH, 'pageRefs(ctx, "nodes", op.pageIndex).set(cr.ref, n.id); ctx.created.push', "ctx.created.push"],
  ["D34 una ref repetida se acepta", AUTH, 'if(pageRefs(ctx, "nodes", op.pageIndex).has(entry.ref) || copyRefs.some(c=>c.ref===entry.ref))', "if(false)"],
  ["D35 una fuente repetida se acepta", AUTH, "if(ids.includes(id)) throw reject(", "if(false) throw reject("],
  ["D36 el offset de autoría se ignora", AUTH, "options.dx = op.offset.x; options.dy = op.offset.y;", ""],
  ["D37 connections de autoría no se pasa al dominio", AUTH, "const options = {connections:op.connections};", "const options = {};"],
  ["D38 los waypoints de las copias no entran en el aviso", AUTH, "if(e && (e.waypoints||[]).length){ watch(ctx, op, op.pageIndex, \"connection\", c.id, [\"waypoints\"]); withWaypoints.push(c.id); }", ""],
  ["D39 duplicate_node declara otro alcance", AUTH, 'duplicate_node:"page"', 'duplicate_node:"story"'],
  ["D40 reorder_nodes declara otro alcance", AUTH, 'reorder_nodes:"page"', 'reorder_nodes:"story"'],
];

function copyTree(dest) {
  for (const entry of ["js", "css", "s", "ejemplos/data", "index.html", "sw.js", "manifest.webmanifest", "test"]) {
    const from = path.join(root, entry);
    if (fs.existsSync(from)) fs.mkdirSync(path.dirname(path.join(dest, entry)), { recursive: true }), fs.cpSync(from, path.join(dest, entry), { recursive: true });
  }
}
function runSuite(dir) {
  const r = spawnSync(process.execPath, ["--test", "test/fluyo-018-7a-f1.test.cjs", "test/fluyo-018-7a.test.cjs", "test/fluyo-018-7a-domain.test.cjs", "test/fluyo-018-6.test.cjs", "test/fluyo-018-5.test.cjs", "test/fluyo-018-4.test.cjs", "test/fluyo-018-3.test.cjs", "test/fluyo-018-2.test.cjs", "test/fluyo-017-2.test.cjs", "test/fluyo-017-2-qa.test.cjs"], { cwd: dir, encoding: "utf8", timeout: 240000 });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}
function applyEdits(dir, edits) {
  for (const [file, from, to] of edits) {
    const p = path.join(dir, file);
    const src = fs.readFileSync(p, "utf8"), crlf = src.includes(CRLF);
    const text = src.replaceAll(CRLF, NL);
    if (!text.includes(from)) return false;
    fs.writeFileSync(p, text.replace(from, () => to).replaceAll(NL, crlf ? CRLF : NL));
  }
  return true;
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-018-7a-mut-"));
let failed = 0;
try {
  const base = path.join(tmp, "base"); fs.mkdirSync(base); copyTree(base);
  const sane = runSuite(base);
  if (sane.code !== 0) { console.error("La copia sin mutar NO pasa la suite:\n" + sane.out.slice(-1500)); process.exit(2); }
  console.log("copia sin mutar: suite OK (0/" + MUTATIONS.length + " mutaciones aplicadas)");
  MUTATIONS.forEach((m, i) => {
    const name = m[0], edits = Array.isArray(m[1]) ? m[1] : [[m[1], m[2], m[3]]];
    const dir = path.join(tmp, "m" + i); fs.mkdirSync(dir); copyTree(dir);
    if (!applyEdits(dir, edits)) { console.log("  ✘ " + name + " — el patrón no existe (mutación obsoleta)"); failed++; fs.rmSync(dir, { recursive: true, force: true }); return; }
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
console.log(failed ? "\n" + failed + " mutación(es) sin detectar" : "\nTodas las mutaciones (" + MUTATIONS.length + ") detectadas.");
process.exit(failed ? 1 : 0);
