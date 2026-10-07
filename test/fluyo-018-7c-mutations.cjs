"use strict";
/* FLUYO-018.7c — Mutaciones sobre COPIAS aisladas (nunca sobre el árbol): cada defecto plausible de delete_page (dominio, regla de cur,
   restaurar), del Undo estructural por referencia (F1), de la ✕ del editor y de los índices estables del lote debe hacer fallar las
   suites de 018.7c. Una mutación puede ser una lista de [archivo, from, to].
   Uso: node test/fluyo-018-7c-mutations.cjs */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const NL = "\n", CRLF = "\r\n";
const MODEL = "js/model.js", SEL = "js/selection.js", UI = "js/ui.js", AUTH = "js/story-authoring.js";

const MUTATIONS = [
  // ── dominio: regla de cur, última página, impacto, EventTypes, restaurar
  ["P1 borrar una anterior no desplaza cur (F2)", MODEL, "  if(pageIndex<c) return c-1;\n", ""],
  ["P2 cur solo se recorta (el comportamiento previo)", MODEL, "  if(pageIndex<c) return c-1;\n  if(pageIndex>c) return c;\n  return Math.min(pageIndex, length-2);", "  return Math.min(c, length-2);"],
  ["P3 al borrar la activa pasa a la anterior", MODEL, "  return Math.min(pageIndex, length-2);", "  return Math.max(pageIndex-1, 0);"],
  ["P4 se puede borrar la única página", MODEL, '  if(d.pages.length<=1) throw projectDataError("last_page","pageIndex");\n', ""],
  ["P5 el impacto no lista las Historias", MODEL, "isCurrent:pageIndex===d.cur, isLastPage:", "stories:[], isCurrent:pageIndex===d.cur, isLastPage:"],
  ["P6 «EventTypes liberados» ignora su uso en otras páginas", MODEL, "[...here].filter(id=>!elsewhere.has(id) && ", "[...here].filter(id=>"],
  ["P7 borrar una página elimina los EventTypes que deja sin uso", MODEL, "  d.cur=pageCurAfterRemoval(from, pageIndex, length);\n  return {pageIndex, page, impact,", "  d.cur=pageCurAfterRemoval(from, pageIndex, length);\n  d.eventTypes=d.eventTypes.filter(et=>!impact.eventTypesFreed.includes(et.id));\n  return {pageIndex, page, impact,"],
  ["P11 borrar una página elimina los EventTypes que usa aunque otra página los use", MODEL, "  const [page]=d.pages.splice(pageIndex,1);", "  const [page]=d.pages.splice(pageIndex,1); d.eventTypes=d.eventTypes.filter(et=>!(page.scenarios||[]).some(sc=>(sc.steps||[]).some(st=>st.eventTypeId===et.id)));"],
  ["P12 eventTypesFreed cuenta EventTypes que ya estaban sin uso", MODEL, "[...here].filter(id=>", "[...new Set([...here, ...(d.eventTypes||[]).map(et=>et.id)])].filter(id=>"],
  ["P13 deletePageIn sustituye la biblioteca por una copia", MODEL, "  const [page]=d.pages.splice(pageIndex,1);", "  const [page]=d.pages.splice(pageIndex,1); d.eventTypes=d.eventTypes.map(et=>deep(et));"],
  ["P8 restaurar no conserva la página activa", MODEL, "  if(Number.isSafeInteger(from) && pageIndex<=from) d.cur=from+1;\n", ""],
  ["P9 restaurar inserta una copia (se pierde la identidad)", MODEL, "  d.pages.splice(pageIndex,0,page);", "  d.pages.splice(pageIndex,0,deep(page));"],
  ["P10 restaurar añade al final", MODEL, "  d.pages.splice(pageIndex,0,page);", "  d.pages.push(page);"],
  // ── editor: Undo por referencia y la ✕
  ["E1 los snapshots vuelven a identificar la página por ÍNDICE (F1)", [
    [SEL, "function snapPage(){ return pageSnap(P()); }", "function snapPage(){ return Object.assign(pageSnap(P()),{pi:doc.cur}); }"],
    [SEL, "  const i=doc.pages.indexOf(s.page);\n  if(i<0) return null;", "  const i=s.pi!==undefined ? Math.min(s.pi,doc.pages.length-1) : doc.pages.indexOf(s.page);\n  if(i<0) return null;"],
    [SEL, "  restorePageContent(s.page, s.data);", "  restorePageContent(doc.pages[i], s.data);"]]],
  ["E13 F1 original: snapshots por índice y el borrado fuera del historial", [
    [SEL, "function snapPage(){ return pageSnap(P()); }", "function snapPage(){ return Object.assign(pageSnap(P()),{pi:doc.cur}); }"],
    [SEL, "  const i=doc.pages.indexOf(s.page);\n  if(i<0) return null;", "  const i=s.pi!==undefined ? Math.min(s.pi,doc.pages.length-1) : doc.pages.indexOf(s.page);\n  if(i<0) return null;"],
    [SEL, "  restorePageContent(s.page, s.data);", "  restorePageContent(doc.pages[i], s.data);"],
    [SEL, "  pushUndoSnapshot({kind:\"insertPage\", page, index, curPage, lib});\n", ""]]],
  ["E2 la ✕ sigue vaciando las pilas (hotfix de 018.7a)", SEL, "  pushUndoSnapshot({kind:\"insertPage\", page, index, curPage, lib});", "  pushUndoSnapshot({kind:\"insertPage\", page, index, curPage, lib}); undoStack.length=0; redoStack.length=0;"],
  ["E3 Undo del borrado reinserta una copia", SEL, "    restorePageIn(doc, s.index, s.page);", "    restorePageIn(doc, s.index, deep(s.page));"],
  ["E4 Undo del borrado no devuelve la página activa", SEL, "    const c=doc.pages.indexOf(s.curPage); if(c>=0) doc.cur=c;\n", ""],
  ["E5 la entrada de Undo se crea antes del confirm (Cancelar deja rastro)", SEL, "  if(!confirm(pageDeleteConfirmMessage(pageRemovalImpactIn(doc, index)))) return false;", "  pushUndo(); if(!confirm(pageDeleteConfirmMessage(pageRemovalImpactIn(doc, index)))) return false;"],
  ["E6 sin confirmación cuando la página no tiene elementos", SEL, "  if(!confirm(pageDeleteConfirmMessage(", "  if(pageRemovalImpactIn(doc,index).nodes && !confirm(pageDeleteConfirmMessage("],
  ["E7 el aviso no nombra las Historias", SEL, "    for(const s of impact.stories.slice(0,PAGE_DELETE_LIST_MAX))", "    for(const s of [])"],
  ["E8 aceptar no detiene el Playback", SEL, '  if(editorFrozen() && typeof scReset==="function") scReset();\n', ""],
  ["E9 Redo del borrado recorta cur en lugar de la regla del dominio", SEL, "    deletePageIn(doc, i);\n    return {kind:\"insertPage\"", "    doc.pages.splice(i,1); doc.cur=Math.min(doc.cur,doc.pages.length-1);\n    return {kind:\"insertPage\""],
  ["E10 la inversa de una edición es la foto de la página ACTIVA (comportamiento previo)", SEL, "  const inverse=pageSnap(s.page);", "  const inverse=snapPage();"],
  ["E11 una entrada que ya no aplica bloquea el Undo", SEL, "    if(!inverse) continue;", "    if(!inverse) return;"],
  ["E12 la ✕ borra a mano (sin dominio ni Undo)", UI, "x.onclick=ev=>{ ev.stopPropagation(); requestDeletePage(i); };", "x.onclick=ev=>{ ev.stopPropagation(); if(confirm(\"¿Eliminar «\"+pg.name+\"»?\")){ doc.pages.splice(i,1); doc.cur=Math.min(doc.cur,doc.pages.length-1); clearSel(); renderTabs(); } };"],
  // ── autoría: expectedName, índices estables, pageMap
  ["A1 expectedName se ignora", AUTH, "      if(pg.name!==op.expectedName)\n", "      if(false)\n"],
  ["A2 expectedName es opcional", [[AUTH, 'if(op.expectedName===undefined) throw reject("INVALID_FIELD"', 'if(false) throw reject("INVALID_FIELD"'], [AUTH, 'if(typeof op.expectedName!=="string") throw', 'if(op.expectedName!==undefined && typeof op.expectedName!=="string") throw']]],
  ["A3 expectedName sin distinguir mayúsculas", AUTH, "      if(pg.name!==op.expectedName)\n", "      if(pg.name.toLowerCase()!==String(op.expectedName).toLowerCase())\n"],
  ["A4 expectedName recortado", AUTH, "      if(pg.name!==op.expectedName)\n", "      if(pg.name.trim()!==String(op.expectedName).trim())\n"],
  ["A5 los índices se desplazan a mitad de lote (P-B)", AUTH, "    const pg = ctx.pages[op.pageIndex];\n    if(!pg) throw reject(\"PAGE_NOT_FOUND\"", "    const pg = ctx.d.pages[op.pageIndex];\n    if(!pg) throw reject(\"PAGE_NOT_FOUND\""],
  ["A6 sin hueco: la página se quita también de la lista del lote", AUTH, "      ctx.pages[op.pageIndex] = null;", "      ctx.pages.splice(op.pageIndex, 1);"],
  ["A7 sin pageMap", AUTH, "ctx.deletedPages.size ? {pageMap:", "false ? {pageMap:"],
  ["A8 una página eliminada en el lote no es PAGE_DELETED", AUTH, '    if(del) throw reject("PAGE_DELETED"', '    if(false) throw reject("PAGE_DELETED"'],
  ["A9 refs en índices del lote (no los finales)", AUTH, "      .map(c=>Object.assign({}, c, {pageIndex:liveIndexOf(ctx, c.pageIndex)}));", "      .map(c=>c);"],
  ["A10 las Historias tocadas de una página eliminada siguen en touched", AUTH, "      for(const [k, t] of ctx.touched) if(t.pageIndex===op.pageIndex) ctx.touched.delete(k);\n", ""],
  ["A11 los errores preexistentes no se traducen al lote", AUTH, "{errors:inBatch(ctx, checked.errors), stories:", "{errors:checked.errors, stories:"],
  ["A12 delete_page declara otro alcance", AUTH, 'delete_page:"document"', 'delete_page:"page"'],
  ["A13 delete_page no informa de las Historias que se van", AUTH, "affects:{stories:im.stories.map(", "affects:{stories:[].map("],
  ["A14 create_page devuelve el índice del documento, no el del lote", AUTH, "      const pageIndex = ctx.pages.length-1;", "      const pageIndex = r.pageIndex;"],
  ["A15 los usos de un EventType no se traducen al lote", [[AUTH, "const found = usageErrors(inBatch(ctx, impact.errors), ctx);", "const found = usageErrors(impact.errors, ctx);"], [AUTH, "const use = inBatch(ctx, eventTypeUsagesIn(ctx.d, et.id));", "const use = eventTypeUsagesIn(ctx.d, et.id);"], [AUTH, "      const uses = inBatch(ctx, eventTypeUsagesIn(ctx.d, et.id));", "      const uses = eventTypeUsagesIn(ctx.d, et.id);"]]],
  ["A16 los topes recorren las páginas del documento (no las del lote)", AUTH, "    ctx.pages.forEach((pg, pageIndex)=>{ ", "    ctx.d.pages.forEach((pg, pageIndex)=>{ "],
  ["A17 cur de changes[] en índices del documento", AUTH, "cur:{from:curFrom, to:batchIndexOf(ctx, ctx.d.cur)}", "cur:{from:curFrom, to:ctx.d.cur}"],
  ["A18 delete_page borra por índice del lote en el documento", AUTH, "r = deletePageIn(ctx.d, liveIndexOf(ctx, op.pageIndex));", "r = deletePageIn(ctx.d, op.pageIndex);"],
  ["A19 rename_page renombra por índice del lote en el documento", AUTH, "r = renamePageIn(ctx.d, liveIndexOf(ctx, op.pageIndex), op.name);", "r = renamePageIn(ctx.d, op.pageIndex, op.name);"],
];

function copyTree(dest) {
  for (const entry of ["js", "css", "s", "ejemplos/data", "index.html", "sw.js", "manifest.webmanifest", "test"]) {
    const from = path.join(root, entry);
    if (fs.existsSync(from)) fs.mkdirSync(path.dirname(path.join(dest, entry)), { recursive: true }), fs.cpSync(from, path.join(dest, entry), { recursive: true });
  }
}
const SUITES = ["test/fluyo-018-7c.test.cjs", "test/fluyo-018-7c-domain.test.cjs", "test/fluyo-018-7a-f1.test.cjs", "test/fluyo-018-7a-domain.test.cjs", "test/fluyo-018-5.test.cjs", "test/fluyo-017-2-qa.test.cjs"];
function runSuite(dir) {
  const r = spawnSync(process.execPath, ["--test", ...SUITES], { cwd: dir, encoding: "utf8", timeout: 300000 });
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

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-018-7c-mut-"));
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
