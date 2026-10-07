"use strict";
/* FLUYO-017.2 / 017.3 / 018.2 / 018.3 / 018.5. Autoría de Historias, EventTypes, páginas y del diagrama (crear, modificar y eliminar nodos y conexiones) sobre un documento: UN lote atómico de operaciones sobre una COPIA.

   Compone, no reimplementa:
     · las funciones de model.js que ya usa el editor (createScenario, duplicateScenario, createStep,
       storyboard*, stepDefinitionForEvent, storyboardSetWait, duplicateStep, retargetStep, setInitialAvailability,
       createEventTypeIn, updateEventTypeIn, deleteEventTypeIn, eventTypeDefinition, createNodeIn, createConnectionIn,
       updateNodeIn, updateConnectionIn, deleteNodeIn, deleteConnectionIn, createPageIn, renamePageIn,
       setThemeIn, reorderNodesIn, duplicateNodesIn (FLUYO-018.7a), deletePageIn (FLUYO-018.7c): las mismas que ejecuta el editor);
     · FluyoIntegrity (la autoridad de integridad) sobre el ESTADO FINAL del lote y para explicar qué rompería
       borrar o cambiar un EventType usado.
   Aquí sólo viven la forma de las operaciones, la resolución de referencias del lote (`ref`) y la explicación
   estructurada de por qué se rechaza algo. Ninguna regla de tiempo, acción, destino, EventType ni integridad.

   Puro: sin DOM, timers, estado global ni E/S; no muta el proyecto recibido. NO usa ni modifica la global `doc`.
   Cargar tras model.js, scenario-engine.js, story-playback.js y document-integrity.js. Ejecutable en Node (vm).

   apply(project, operations) → {ok:true, project, changes[], refs[], touched[], validation} | {ok:false, errors[]}
   Si una sola operación o la validación final falla NO se devuelve ningún documento. */

var FluyoAuthoring = (function(){
  /* Cada operación tiene UN alcance por definición; el lote debe declararlo y se verifica. */
  const OPERATION_SCOPE = {
    create_story:"story", rename_story:"story", duplicate_story:"story", delete_story:"story",
    add_step:"story", remove_step:"story", move_step:"story", duplicate_step:"story", retarget_step:"story", set_wait:"story",
    set_initial_availability:"page", create_node:"page", create_connection:"page",
    update_node:"page", update_connection:"page", delete_node:"page", delete_connection:"page",
    create_page:"document", rename_page:"document", delete_page:"document", set_theme:"document",
    reorder_nodes:"page", duplicate_node:"page",
    create_event_type:"eventType", update_event_type:"eventType", delete_event_type:"eventType"
  };
  const MAX_OPERATIONS = 200;
  /* Reglas de ENTRADA de autoría (FLUYO-018.5). No son reglas del documento: FluyoIntegrity no las conoce y un documento
     antiguo que las exceda se abre y se ejecuta igual. Se aplican al ESTADO FINAL del lote y solo a lo que el lote escribe
     (ver limitErrors). coordMax acota x,y de los nodos y los puntos de waypoints; sizeMin/sizeMax, w y h. */
  const LIMITS = Object.freeze({coordMax:100000, sizeMin:10, sizeMax:5000, maxNodesPerPage:300, maxConnectionsPerPage:600});
  const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
  /* Campos permitidos por operación (además de op, scope y pageIndex). Un campo desconocido se rechaza:
     p. ej. nadie puede escribir `action`, `state` ni `at` en un paso; el EventType y las esperas lo deciden. */
  const OPERATION_FIELDS = {
    create_story:["name","ref"], rename_story:["storyId","name"], duplicate_story:["storyId","name","ref"], delete_story:["storyId"],
    add_step:["storyId","eventTypeId","target","waitMs","placement","ref"], remove_step:["storyId","stepId"],
    move_step:["storyId","stepId","direction","to"], duplicate_step:["storyId","stepId","ref"],
    retarget_step:["storyId","stepId","target"], set_wait:["storyId","stepId","waitMs"],
    set_initial_availability:["nodeId","state"],
    create_node:["spec","ref"], create_connection:["source","target","spec","ref"],
    update_node:["node","spec"], update_connection:["connection","source","target","spec"],
    delete_node:["node"], delete_connection:["connection"],
    create_page:["name"], rename_page:["pageIndex","name"], delete_page:["pageIndex","expectedName"], set_theme:["theme","customBg"],
    reorder_nodes:["nodes","to"], duplicate_node:["nodes","connections","offset"],
    create_event_type:["name","primitive","sentence","symbol","motion","availability","presentation","ref"],
    update_event_type:["eventTypeId","name","primitive","sentence","symbol","motion","availability","presentation"],
    delete_event_type:["eventTypeId"]
  };
  const onlyKeys = (o, allowed, field) => {
    for(const k of Object.keys(o)) if(!allowed.includes(k)) throw reject("INVALID_OPERATION", `Campo no permitido${field ? " en " + field : ""}: «${k}».`, {field:field ? `${field}.${k}` : k});
  };
  const isRecord = v => v!==null && typeof v==="object" && !Array.isArray(v);
  const isId = v => Number.isSafeInteger(v) && v>=1;

  function reject(code, message, extra){
    const e = new Error(message);
    e.authoring = true; e.code = code; e.extra = extra || {};
    return e;
  }

  /* Un rechazo con varios errores estructurados (p. ej. el que explica un EventType referenciado). */
  function rejectMany(list){ const e = new Error(list[0] ? list[0].message : "rechazado"); e.authoringErrors = list; return e; }

  /* ───────── referencias del lote ───────── */
  function ctxRef(ctx, kind, v, what){
    if(isRecord(v) && typeof v.ref==="string"){
      const r = ctx.refs[kind].get(v.ref);
      if(!r) throw reject("UNKNOWN_REF", `La referencia «${v.ref}» (${what}) no la creó ninguna operación anterior del lote.`, {field:what, ref:v.ref});
      return r;
    }
    if(!isId(v)) throw reject("INVALID_OPERATION", `${what} debe ser un entero ≥ 1 o {ref}.`, {field:what});
    return {id:v};
  }
  /* Páginas del lote (FLUYO-018.7c, índices estables): `ctx.pages[i]` es la página que el índice `i` designa DURANTE TODO el lote —su
     posición al empezar, más las que create_page añade al final—. delete_page la quita del documento (ctx.d, siempre un documento válido)
     pero deja el hueco (null): ningún índice cambia de significado a mitad de lote y usar uno eliminado es PAGE_DELETED. Los índices del
     documento resultante salen en `pageMap`. Sin delete_page, ctx.pages y ctx.d.pages tienen las mismas páginas en el mismo orden. */
  function pageOf(ctx, op){
    if(!Number.isSafeInteger(op.pageIndex) || op.pageIndex<0) throw reject("INVALID_OPERATION", "pageIndex debe ser un entero ≥ 0.", {field:"pageIndex"});
    const del = ctx.deletedPages.get(op.pageIndex);
    if(del) throw reject("PAGE_DELETED", `La página ${op.pageIndex} («${del.name}») la eliminó la operación ${del.operationIndex} (delete_page) de este lote. Dentro de un lote los índices de página no se desplazan: las demás páginas conservan el suyo.`, {pageIndex:op.pageIndex, deletedBy:{operationIndex:del.operationIndex, operation:del.operation}});
    const pg = ctx.pages[op.pageIndex];
    if(!pg) throw reject("PAGE_NOT_FOUND", `pageIndex ${op.pageIndex} fuera de rango (el documento tiene ${ctx.pages.length} página(s)${ctx.deletedPages.size ? `, contando las ${ctx.deletedPages.size} eliminada(s) en este lote` : ""}).`, {pageIndex:op.pageIndex});
    return pg;
  }
  /* Índice del lote ↔ índice en el documento (ctx.d.pages). Son el mismo mientras el lote no elimine páginas. */
  const batchIndexOf = (ctx, liveIndex) => ctx.pages.indexOf(ctx.d.pages[liveIndex]);
  const liveIndexOf = (ctx, batchIndex) => ctx.d.pages.indexOf(ctx.pages[batchIndex]);
  const inBatch = (ctx, list) => list.map(e=>e.pageIndex===undefined ? e : Object.assign({}, e, {pageIndex:batchIndexOf(ctx, e.pageIndex)}));
  function storyOf(ctx, op, pg, editable){
    const r = ctxRef(ctx, "stories", op.storyId, "storyId");
    if(r.pageIndex!==undefined && r.pageIndex!==op.pageIndex) throw reject("INVALID_OPERATION", "La referencia de Historia pertenece a otra página.", {field:"storyId"});
    const sc = pg.scenarios.find(s=>s.id===r.id);
    if(!sc) throw reject("STORY_NOT_FOUND", `No existe la Historia storyId=${r.id} en la página ${op.pageIndex}. Historias: ${pg.scenarios.map(s=>s.id).join(", ") || "ninguna"} (los ids son por página).`, {pageIndex:op.pageIndex, storyId:r.id});
    if(editable && sc.engineVersion!==FluyoScenarios.ENGINE_VERSION)
      throw reject("UNSUPPORTED_ENGINE_VERSION", `La Historia ${sc.id} usa el motor v${sc.engineVersion}; sólo se editan Historias del motor v${FluyoScenarios.ENGINE_VERSION}.`, {pageIndex:op.pageIndex, storyId:sc.id});
    return sc;
  }
  function stepOf(ctx, sc, v, what, pageIndex){
    const r = ctxRef(ctx, "steps", v, what);
    const st = sc.steps.find(s=>s.id===r.id);
    if(!st) throw reject("STEP_NOT_FOUND", `No existe el Step ${what}=${r.id} en la Historia ${sc.id}. Steps: ${sc.steps.map(s=>s.id).join(", ") || "ninguno"}.`, {pageIndex, storyId:sc.id, stepId:r.id});
    return st;
  }
  function nameOf(v, optional){
    if(v===undefined && optional) return undefined;
    if(typeof v!=="string" || !v.trim() || v.length>120) throw reject("INVALID_NAME", "El nombre debe ser un texto de 1 a 120 caracteres.", {field:"name"});
    return v;
  }
  function waitOf(v, field){
    if(!Number.isSafeInteger(v) || v<0) throw reject("INVALID_WAIT", `${field} debe ser un entero ≥ 0 (milisegundos).`, {field});
    return v;
  }
  function eventTypeOf(ctx, v){
    const id = ctxRef(ctx, "eventTypes", v, "eventTypeId").id;
    const et = eventTypeByIdIn(ctx.d, id);
    if(!et) throw reject("EVENT_TYPE_NOT_FOUND", `No existe el evento (EventType) eventTypeId=${id}. Eventos: ${ctx.d.eventTypes.map(e=>e.id).join(", ") || "ninguno"}.`, {eventTypeId:id});
    return et;
  }

  /* Objetivo: {edgeId} | {nodeId} | {from, to} (la conexión entre dos elementos). Debe ser del tipo
     que exige la acción (conexión para SEND; elemento para el resto) y existir en la página. */
  function targetOf(ctx, op, pg, kind, target){
    if(!isRecord(target)) throw reject("INVALID_OPERATION", "target debe ser {ref} | {edgeId} | {nodeId} | {from, to}.", {field:"target"});
    if(target.ref!==undefined){
      // {ref}: la conexión o el elemento creado antes en el lote; el tipo lo decide la acción del evento.
      onlyKeys(target, ["ref"], "target");
      const id = entityOf(ctx, op, target, "target", kind==="connection" ? "edges" : "nodes");
      if(!(kind==="connection" ? pg.edges : pg.nodes).some(x=>x.id===id)) throw reject("TARGET_NOT_FOUND", `La referencia «${target.ref}» (target) ya no existe en la página${deletedNote(ctx, op.pageIndex, kind==="connection" ? "connection" : "node", id)}.`, {target});
      return id;
    }
    onlyKeys(target, ["edgeId","nodeId","from","to"], "target");
    const forms = ["edgeId","nodeId"].filter(k=>target[k]!==undefined).length + (target.from!==undefined || target.to!==undefined ? 1 : 0);
    if(forms!==1) throw reject("INVALID_OPERATION", "target debe tener exactamente una forma: {edgeId} | {nodeId} | {from, to}.", {field:"target"});
    const need = kind==="connection" ? "una conexión (edgeId o from/to)" : "un elemento (nodeId)";
    if(target.edgeId!==undefined || (target.from!==undefined || target.to!==undefined)){
      if(kind!=="connection") throw reject("TARGET_INCOMPATIBLE", `Esta acción necesita ${need}, no una conexión.`, {target});
      if(target.edgeId!==undefined){
        const edgeId = stepEntityId(ctx, op, target.edgeId, "target.edgeId", "edges");
        if(!pg.edges.some(e=>e.id===edgeId)) throw reject("TARGET_NOT_FOUND", `No existe la conexión edgeId=${edgeId} en la página${deletedNote(ctx, op.pageIndex, "connection", edgeId)}.`, {target});
        return edgeId;
      }
      const from = stepEntityId(ctx, op, target.from, "target.from", "nodes"), to = stepEntityId(ctx, op, target.to, "target.to", "nodes");
      const hits = pg.edges.filter(e=>e.from===from && e.to===to);
      if(!hits.length) throw reject("TARGET_NOT_FOUND", `No existe una conexión de ${from} a ${to}.`, {target});
      if(hits.length>1) throw reject("AMBIGUOUS_TARGET", `Hay ${hits.length} conexiones de ${from} a ${to} (${hits.map(e=>e.id).join(", ")}): usa edgeId.`, {target, edgeIds:hits.map(e=>e.id)});
      return hits[0].id;
    }
    if(kind!=="element") throw reject("TARGET_INCOMPATIBLE", `Esta acción necesita ${need}, no un elemento.`, {target});
    const nodeId = stepEntityId(ctx, op, target.nodeId, "target.nodeId", "nodes");
    if(!pg.nodes.some(n=>n.id===nodeId)) throw reject("TARGET_NOT_FOUND", `No existe el elemento nodeId=${nodeId} en la página${deletedNote(ctx, op.pageIndex, "node", nodeId)}.`, {target});
    return nodeId;
  }

  /* ───────── diferencias de una Historia (qué Steps cambiaron de tiempo, orden o existencia) ───────── */
  function stepDelta(before, after){
    // «Cambió» = otro instante, o cambió su posición RELATIVA entre los Steps que existen antes y después
    // (insertar o quitar un paso no cuenta como mover a los demás).
    const common = new Set(before.map(s=>s.id).filter(id=>after.some(s=>s.id===id)));
    const rank = steps => storyboardOrderedSteps(steps).map(s=>s.id).filter(id=>common.has(id));
    const rb = rank(before), ra = rank(after);
    const prev = new Map(before.map(s=>[s.id, s]));
    const changed = [], removed = [];
    for(const s of after){
      const b = prev.get(s.id);
      if(!b || b.at!==s.at || rb.indexOf(s.id)!==ra.indexOf(s.id)) changed.push(s.id);
    }
    const now = new Set(after.map(s=>s.id));
    for(const s of before) if(!now.has(s.id)) removed.push(s.id);
    return {stepIds:changed, removedStepIds:removed};
  }
  const clone = o => JSON.parse(JSON.stringify(o));

  /* ───────── operaciones ───────── */
  function storyAffect(pageIndex, sc, extra){ return {stories:[Object.assign({pageIndex, storyId:sc.id, name:sc.name}, extra||{})]}; }
  function touch(ctx, pageIndex, sc){ ctx.touched.set(`${pageIndex}:${sc.id}`, {pageIndex, storyId:sc.id}); }

  /* ───────── EventTypes: forma de los campos ─────────
     Aquí sólo se comprueba la FORMA de lo que escribe el agente (tipos, campos conocidos, valores de las listas
     cerradas de la UI). Largos, marcadores de la frase, símbolo, unicidad de ids, qué puede cambiar un evento
     usado y la acción que determina cada primitiva las decide model.js (las mismas funciones del editor). */
  const FIELD_RULES = {
    name:()=>`un texto de 1 a ${EVENT_TYPE_NAME_MAX} caracteres`,
    sentence:()=>`un texto de 1 a ${EVENT_TYPE_SENTENCE_MAX} caracteres; sólo admite los marcadores {source}, {target} y {name}`,
    symbol:()=>`un texto de hasta ${EVENT_TOKEN_MAX_LEN} caracteres`,
    primitive:()=>`una de ${[...EVENT_TYPE_PRIMITIVES].join(", ")}`,
    availability:()=>`UP o DOWN, y sólo para primitive SET_AVAILABILITY`,
    motion:()=>`una de ${[...EVENT_TYPE_MOTIONS].join(", ")}, y sólo para primitive FLOW`,
    presentation:()=>`un objeto con {nodeEffects} (eventos de elemento) o {connectionEffects} (eventos de conexión)`
  };
  const DOMAIN_FIELD_TO_OP = {sentenceTemplate:"sentence", visual:"symbol"};
  function etError(field, message){ return reject("INVALID_EVENT_TYPE", message || `«${field}» no es válido: debe ser ${FIELD_RULES[field] ? FIELD_RULES[field]() : "otro valor"}.`, {field}); }
  /* Un error de validación de model.js (lleva `field`) → error estructurado con el nombre del campo de la operación. */
  function fromDomain(e){
    if(e && typeof e.code==="string" && e.field!==undefined && !e.authoring){
      const field = DOMAIN_FIELD_TO_OP[e.field] || e.field;
      return etError(field);
    }
    return e;
  }
  function textOf(v, field){
    if(typeof v!=="string") throw etError(field);
    if(field==="sentence" && eventSentenceHasStrayBraces(v)) throw etError(field);   // misma regla de entrada que el modal del editor
    return v;
  }
  function primitiveOf(v){ if(typeof v!=="string" || !EVENT_TYPE_PRIMITIVES.has(v)) throw etError("primitive"); return v; }
  function motionOf(v, primitive){
    if(primitive!=="FLOW" || typeof v!=="string" || !EVENT_TYPE_MOTIONS.has(v)) throw etError("motion");
    return v;
  }
  function availabilityOf(v, primitive){
    if(primitive!=="SET_AVAILABILITY" || !EVENT_TYPE_AVAILABILITY.has(v)) throw etError("availability");
    return v;
  }
  /* Efectos de presentación del evento: {nodeEffects} para elementos, {connectionEffects} para conexiones, aplicados
     como PARCHE sobre los actuales (o los de por defecto). Los valores los decide el normalizador de model.js: un valor
     que el normalizador no conserva tal cual (fuera de la lista cerrada, color mal formado, texto demasiado largo,
     milisegundos fuera de 300–10000…) se rechaza en lugar de «corregirse» en silencio. Devuelve los efectos completos. */
  function presentationOf(primitive, raw, current){
    const flow = primitive==="FLOW";
    const branch = flow ? "connectionEffects" : "nodeEffects", other = flow ? "nodeEffects" : "connectionEffects";
    const normalize = flow ? normalizeConnectionEffects : normalizeNodeEffects;
    const cur = normalize(current && current[branch]);
    if(raw===undefined) return cur;
    if(!isRecord(raw)) throw etError("presentation");
    for(const k of Object.keys(raw)){
      if(k===other) throw etError(`presentation.${k}`, `«presentation.${k}» no aplica a un evento de ${flow ? "conexión" : "elemento"}: usa «presentation.${branch}».`);
      if(k!==branch) throw etError(`presentation.${k}`, `Campo desconocido en presentation: «${k}». Usa «${branch}».`);
    }
    const patch = raw[branch];
    if(patch===undefined) return cur;
    if(!isRecord(patch)) throw etError(`presentation.${branch}`, `«presentation.${branch}» debe ser un objeto.`);
    for(const k of Object.keys(patch))
      if(!Object.prototype.hasOwnProperty.call(cur, k))
        throw etError(`presentation.${branch}.${k}`, `Campo desconocido en presentation.${branch}: «${k}». Campos: ${Object.keys(cur).join(", ")}.`);
    if(patch.visualDuration==="custom" && patch.visualDurationMs===undefined && cur.visualDuration!=="custom")
      throw etError(`presentation.${branch}.visualDurationMs`, "visualDuration \"custom\" necesita visualDurationMs (entre 300 y 10000).");
    const out = normalize(Object.assign({}, cur, patch));
    for(const k of Object.keys(patch))
      if(out[k]!==patch[k])
        throw etError(`presentation.${branch}.${k}`, `Valor no válido para presentation.${branch}.${k}: ${JSON.stringify(patch[k])}${k==="visualDurationMs" ? " (sólo con visualDuration \"custom\", entre 300 y 10000)" : ""}.`);
    return out;
  }
  const eventTypeSummary = et => Object.assign({id:et.id, name:et.name, primitive:et.primitive, sentence:et.sentenceTemplate, symbol:et.visual.value, motion:et.motion},
    et.availability!==undefined ? {availability:et.availability} : {});
  /* Un mismo nombre en dos eventos no es un error en el editor; se avisa porque el agente los distingue por id. */
  function duplicateNameWarnings(d, et){
    const key = n => n.trim().toLowerCase();
    const same = d.eventTypes.filter(e=>e.id!==et.id && key(e.name)===key(et.name)).map(e=>e.id);
    return same.length ? [{code:"DUPLICATE_EVENT_TYPE_NAME", message:`Ya existe${same.length===1 ? "" : "n"} evento${same.length===1 ? "" : "s"} con el nombre «${et.name}» (eventTypeId ${same.join(", ")}). Distínguelos por id.`, eventTypeIds:same}] : [];
  }
  const snapshotOf = ctx => projectToSerializable(ctx.d, ctx.settings);
  /* `errors` en índices del lote (inBatch). */
  function usageErrors(errors, ctx){
    const stories = [], steps = [];
    for(const e of errors){
      if(e.storyId===undefined) continue;
      let s = stories.find(x=>x.pageIndex===e.pageIndex && x.storyId===e.storyId);
      if(!s){
        const pg = ctx.pages[e.pageIndex], sc = pg && pg.scenarios.find(x=>x.id===e.storyId);
        s = {pageIndex:e.pageIndex, storyId:e.storyId, storyName:sc && sc.name, stepIds:[]}; stories.push(s);
      }
      if(e.stepId!==undefined && !s.stepIds.includes(e.stepId)){ s.stepIds.push(e.stepId); steps.push({pageIndex:e.pageIndex, storyId:e.storyId, stepId:e.stepId}); }
    }
    return {affectedStories:stories, affectedSteps:steps};
  }
  const whoText = stories => stories.map(s=>`«${s.storyName}» (paso${s.stepIds.length===1 ? "" : "s"} ${s.stepIds.join(", ") || "—"})`).join("; ");

  /* ¿Qué rompería quitar o cambiar este EventType? Lo responde FluyoIntegrity sobre una copia; aquí sólo se da forma al rechazo. */
  function blockedByUse(ctx, et, candidate, code, field){
    const impact = FluyoIntegrity.eventTypeImpact(snapshotOf(ctx), et.id, candidate);
    const found = usageErrors(inBatch(ctx, impact.errors), ctx);
    const use = inBatch(ctx, eventTypeUsagesIn(ctx.d, et.id));
    const uses = found.affectedStories.length ? found : {affectedStories:use.map(u=>({pageIndex:u.pageIndex, storyId:u.storyId, storyName:u.storyName, stepIds:u.stepIds})),
                               affectedSteps:use.flatMap(u=>u.stepIds.map(stepId=>({pageIndex:u.pageIndex, storyId:u.storyId, stepId})))};
    const detail = code==="REFERENCED_ENTITY"
      ? `El evento ${et.id} «${et.name}» sigue referenciado por ${whoText(uses.affectedStories)}: no se puede eliminar mientras se use. Quita esos pasos (remove_step) antes de eliminarlo, en el mismo lote o antes.`
      : `El evento ${et.id} «${et.name}» se usa en ${whoText(uses.affectedStories)}: su ${field==="primitive" ? "primitiva (dónde ocurre y qué acción es)" : "disponibilidad (la que provoca)"} no se puede cambiar mientras se use. Crea otro evento para el otro comportamiento.`;
    return reject(code, detail, Object.assign({entity:{kind:"eventType", id:et.id, name:et.name}, integrityCodes:[...new Set(impact.errors.map(e=>e.code))]}, field ? {field} : {}, uses));
  }

  /* ───────── Diagrama: crear nodos y conexiones (FLUYO-018.2) ─────────
     Aquí sólo viven la forma de la operación y las refs del lote (acotadas a UNA página: la misma ref puede existir en
     dos páginas). La creación —shape, campos, ids, source/target, auto-lazo, geometría por defecto, documento válido— es
     createNodeIn/createConnectionIn de model.js, las mismas que el editor: no hay segunda implementación. */
  const DIAGRAM_ERRORS = {
    invalid_document:"INVALID_FIELD", source_not_found:"SOURCE_NOT_FOUND", target_not_found:"TARGET_NOT_FOUND", self_loop:"SELF_LOOP",
    duplicate_structure_id:"DUPLICATE_ID", duplicate_ref:"DUPLICATE_REF", id_exhausted:"ID_EXHAUSTED",
    node_not_found:"NODE_NOT_FOUND", connection_not_found:"CONNECTION_NOT_FOUND"
  };
  /* Errores de createPageIn/renamePageIn → errores estructurados del lote. */
  function fromPageDomain(e, op){
    if(e && typeof e.code==="string" && !e.authoring){
      if(e.code==="invalid_page_name") return reject("INVALID_NAME", `El nombre de la página debe ser un texto de 1 a ${PAGE_NAME_MAX} caracteres (no solo espacios).`, {field:"name"});
      if(e.code==="page_not_found") return reject("PAGE_NOT_FOUND", `pageIndex ${op && op.pageIndex} fuera de rango.`, {pageIndex:op && op.pageIndex});
    }
    return e;
  }
  const isNodeOp = op => /_node$/.test(op.op);
  /* Un error de validación de model.js ({code, field?}) → error estructurado del lote. `id` es el elemento/conexión al que
     apuntaba la operación (para decir qué no existe y, si lo eliminó el propio lote, quién). */
  function fromDiagramDomain(e, op, ctx, id){
    if(!(e && typeof e.code==="string" && !e.authoring && DIAGRAM_ERRORS[e.code])) return e;
    const f = e.field;
    const noun = isNodeOp(op) ? "un elemento" : "una conexión";
    const text = {
      INVALID_FIELD:()=>f===undefined ? "El registro no es válido."
        : (f==="id" || f==="ref") && /^update_/.test(op.op) ? `«${f}» no se puede modificar.`
        : `«${f}» no es válido${/^update_/.test(op.op) ? ` para modificar ${noun} (valor, tipo o campo que no aplica a este elemento)` : ` o no existe en ${noun}`}.`,
      NODE_NOT_FOUND:()=>`No existe el elemento ${id} en la página ${op.pageIndex}${deletedNote(ctx, op.pageIndex, "node", id)}.`,
      CONNECTION_NOT_FOUND:()=>`No existe la conexión ${id} en la página ${op.pageIndex}${deletedNote(ctx, op.pageIndex, "connection", id)}.`,
      SOURCE_NOT_FOUND:()=>"No existe el elemento de origen (source) en la página.",
      TARGET_NOT_FOUND:()=>"No existe el elemento de destino (target) en la página.",
      SELF_LOOP:()=>"Una conexión no puede salir y entrar en el mismo elemento (source y target son el mismo).",
      DUPLICATE_ID:()=>"Ese id ya lo usa un elemento, una conexión o algo que lo referencia: los ids de una página no se reutilizan.",
      DUPLICATE_REF:()=>`La ref «${op.ref}» ya la usa ${op.op==="create_node" ? "otro elemento" : "otra conexión"} de esta página en el lote.`,
      ID_EXHAUSTED:()=>"La página no admite más ids."
    }[DIAGRAM_ERRORS[e.code]]();
    return reject(DIAGRAM_ERRORS[e.code], text, Object.assign({domainCode:e.code}, f!==undefined ? {field:f} : {}, e.code==="duplicate_ref" ? {ref:op.ref} : {}));
  }
  /* Refs de nodos/conexiones del lote: un Map (ref → id) POR PÁGINA y por tipo, que es el que createNodeIn/createConnectionIn
     consultan y rellenan. `ctx.created` guarda el orden de creación para devolver el mapa de refs completo. */
  function pageRefs(ctx, kind, pageIndex){
    let byPage = ctx.diagramRefs[kind].get(pageIndex);
    if(!byPage){ byPage = new Map(); ctx.diagramRefs[kind].set(pageIndex, byPage); }
    return byPage;
  }
  function diagramSpec(op){
    if(!isRecord(op.spec)) throw reject("INVALID_OPERATION", `${op.op} necesita «spec»: un objeto con ${op.op==="create_node" ? "los campos del elemento (shape, x, y…)" : "los campos de la conexión (label, route, fromSide…)"}.`, {field:"spec"});
    for(const k of op.op==="create_node" ? ["ref"] : ["ref","source","target"])
      if(op.spec[k]!==undefined) throw reject("INVALID_OPERATION", `«${k}» va en la operación, no dentro de spec.`, {field:`spec.${k}`});
    return op.spec;
  }
  function withRef(op, spec){
    if(op.ref===undefined) return Object.assign({}, spec);
    if(typeof op.ref!=="string" || !op.ref) throw reject("INVALID_OPERATION", "ref debe ser un texto no vacío.", {field:"ref"});
    return Object.assign({}, spec, {ref:op.ref});
  }
  /* Extremo de una conexión: {ref} (algo creado antes en ESTA página del lote) o {id} (un elemento existente). Devuelve el id;
     que exista lo decide el dominio (source_not_found / target_not_found). */
  /* Elemento (kind "nodes") o conexión (kind "edges") a partir de {ref} (creado antes en el lote, en ESTA página) o {id}.
     Devuelve el id; que exista lo decide el dominio (…_not_found). */
  function entityOf(ctx, op, v, field, kind){
    const noun = kind==="nodes" ? "elemento" : "conexión", un = kind==="nodes" ? "un elemento" : "una conexión";
    if(!isRecord(v)) throw reject("INVALID_OPERATION", `${field} debe ser {ref} (${un} creado antes en el lote, en esta página) o {id} (${un} existente).`, {field});
    onlyKeys(v, ["ref","id"], field);
    if((v.ref!==undefined) === (v.id!==undefined)) throw reject("INVALID_OPERATION", `${field} debe tener exactamente una forma: {ref} o {id}.`, {field});
    if(v.id!==undefined){
      if(!isId(v.id)) throw reject("INVALID_OPERATION", `${field}.id debe ser un entero ≥ 1.`, {field:`${field}.id`});
      return v.id;
    }
    if(typeof v.ref!=="string" || !v.ref) throw reject("INVALID_OPERATION", `${field}.ref debe ser un texto no vacío.`, {field:`${field}.ref`});
    const id = pageRefs(ctx, kind, op.pageIndex).get(v.ref);
    if(id===undefined){
      const elsewhere = [...ctx.diagramRefs[kind]].some(([pi, m])=>pi!==op.pageIndex && m.has(v.ref));
      throw reject("UNKNOWN_REF", elsewhere
        ? `La referencia «${v.ref}» (${field}) es de ${un} creado en OTRA página: las refs son por página.`
        : `La referencia «${v.ref}» (${field}) no la creó ninguna operación anterior del lote en la página ${op.pageIndex} (${noun}).`, {field, ref:v.ref});
    }
    return id;
  }
  const endpointOf = (ctx, op, v, field) => entityOf(ctx, op, v, field, "nodes");
  /* Destino de un Step: un id, o {ref} de algo creado en el lote. */
  function stepEntityId(ctx, op, v, field, kind){
    if(isRecord(v)){ onlyKeys(v, ["ref"], field); return entityOf(ctx, op, v, field, kind); }
    if(!isId(v)) throw reject("INVALID_OPERATION", `${field} debe ser un entero ≥ 1 o {ref}.`, {field});
    return v;
  }
  /* « (eliminado por la operación N)» si el lote ya quitó esa entidad; vacío si no. */
  function deletedNote(ctx, pageIndex, kind, id){
    const d = ctx && ctx.deleted.find(x=>x.pageIndex===pageIndex && x.kind===kind && x.id===id);
    return d ? ` (la eliminó la operación ${d.operationIndex}: ${d.operation}${d.cascadedFrom ? `, en cascada con el elemento ${d.cascadedFrom.id}` : ""})` : "";
  }
  /* ───────── Reglas de entrada de nodo y límites (FLUYO-018.5) ─────────
     Solo en autoría. Se validan los campos que el lote ESCRIBE (en update_node, las claves del parche): un valor antiguo del
     documento, inválido bajo estas reglas, no se revalida ni impide editar el resto del nodo. */
  const NODE_COLOR_FIELDS = ["color","fill","textBg","textColor","kwBg","kwColor"];
  function invalidField(field, message){ return reject("INVALID_FIELD", message, {field}); }
  /* Colores de conexión (FLUYO-018.6): misma regla HEX que los de nodo; null = color del tema. Solo las claves que el lote escribe. */
  const EDGE_COLOR_FIELDS = ["lineColor","dotColor"];
  function edgeInputRules(spec){
    for(const k of EDGE_COLOR_FIELDS){
      const v = spec[k];
      if(v===undefined || v===null) continue;
      if(typeof v!=="string" || !HEX_COLOR.test(v)) throw invalidField(k, `«${k}» debe ser un color HEX (#rgb, #rrggbb o #rrggbbaa) o null (color del tema); recibido ${JSON.stringify(v)}. No se admiten nombres de color.`);
    }
  }
  function nodeInputRules(spec, shape, isCreate){
    for(const k of NODE_COLOR_FIELDS){
      const v = spec[k];
      if(v===undefined || (v===null && (k!=="color" || isCreate))) continue;     // null: «sin valor» en los campos anulables (y color→default al crear)
      if(k==="fill" && v==="none") continue;                                      // «Sin relleno» (forma hueca): valor del documento y del selector del editor; solo en fill
      if(typeof v!=="string" || !HEX_COLOR.test(v)) throw invalidField(k, `«${k}» debe ser un color HEX (#rgb, #rrggbb o #rrggbbaa)${k==="fill" ? ' o "none" (sin relleno)' : ""}; recibido ${JSON.stringify(v)}. No se admiten nombres de color.`);
    }
    if(!isCreate) return;
    for(const [k, catalog, tool] of [["icon", ICONS, "list_icons"], ["anim", ANIMS, "list_anims"]]){
      if(spec[k]===undefined) continue;
      if(typeof spec[k]!=="string" || !projectOwn(catalog, spec[k])) throw invalidField(k, `«${k}» ${JSON.stringify(spec[k])} no existe en el catálogo: consulta ${tool}.`);
    }
    if(shape==="icon" && spec.icon===undefined) throw invalidField("icon", "Un elemento de forma «icon» necesita «icon» (clave del catálogo: list_icons).");
    if(shape==="anim" && spec.anim===undefined) throw invalidField("anim", "Un elemento de forma «anim» necesita «anim» (clave del catálogo: list_anims).");
  }
  /* Qué escribió el lote (y dónde) para comprobar los topes sobre el estado FINAL. Clave por entidad: crear y luego mover es una
     sola entrada; si la entidad ya no existe al final, no se comprueba. */
  function watch(ctx, op, pageIndex, kind, id, fields){
    const key = `${pageIndex}:${kind}:${id}`;
    const w = ctx.watch.get(key) || {pageIndex, kind, id, fields:new Set()};
    for(const f of fields) w.fields.add(f);
    w.operationIndex = ctx.opIndex; w.operation = op.op;
    ctx.watch.set(key, w);
  }
  function limitError(limitName, field, actual, extra){
    const limit = LIMITS[limitName];
    return Object.assign({code:"LIMIT_EXCEEDED", limitName, limit, actual, field,
      message:`${extra.where}: «${field}» = ${actual} ${actual>limit && limitName!=="sizeMin" ? "supera" : "no llega a"} el límite ${limitName} (${limit}).`}, extra);
  }
  /* Estado final del lote contra los topes de autoría. No retroactivo:
       · conteos: solo una página cuyo nº de nodos/conexiones el lote AUMENTÓ respecto al documento de entrada;
       · campos: solo los x,y,w,h (y puntos de waypoints) que el lote escribió y que siguen existiendo. */
  function limitErrors(ctx, d){
    const out = [];
    ctx.pages.forEach((pg, pageIndex)=>{                               // índices del lote; una página eliminada no cuenta
      if(!pg) return;
      const base = ctx.baseCounts[pageIndex] || {nodes:0, edges:0}, last = ctx.countOps[pageIndex] || {};
      for(const [list, limitName, field] of [[pg.nodes, "maxNodesPerPage", "nodes"], [pg.edges, "maxConnectionsPerPage", "connections"]]){
        const n = list.length, b = field==="nodes" ? base.nodes : base.edges;
        if(n>LIMITS[limitName] && n>b)
          out.push(limitError(limitName, field, n, {where:`Página ${pageIndex}`, pageIndex, operationIndex:last[field], operation:field==="nodes" ? "create_node" : "create_connection"}));
      }
    });
    for(const w of ctx.watch.values()){
      const pg = ctx.pages[w.pageIndex];
      const rec = pg && (w.kind==="node" ? pg.nodes : pg.edges).find(x=>x.id===w.id);
      if(!rec) continue;
      const where = `${w.kind==="node" ? "Elemento" : "Conexión"} ${w.id} (página ${w.pageIndex}, operación ${w.operationIndex}: ${w.operation})`;
      const base = {where, pageIndex:w.pageIndex, entity:{kind:w.kind==="node" ? "node" : "connection", id:w.id}, operationIndex:w.operationIndex, operation:w.operation};
      if(w.kind==="node"){
        for(const f of ["x","y"]) if(w.fields.has(f) && Math.abs(rec[f])>LIMITS.coordMax) out.push(limitError("coordMax", f, rec[f], base));
        for(const f of ["w","h"]) if(w.fields.has(f)){
          if(rec[f]<LIMITS.sizeMin) out.push(limitError("sizeMin", f, rec[f], base));
          else if(rec[f]>LIMITS.sizeMax) out.push(limitError("sizeMax", f, rec[f], base));
        }
      }else if(w.fields.has("waypoints")){
        (rec.waypoints||[]).forEach((pt, i)=>{
          for(const f of ["x","y"]) if(Math.abs(pt[f])>LIMITS.coordMax) out.push(limitError("coordMax", `waypoints[${i}].${f}`, pt[f], base));
        });
      }
    }
    return out.sort((a, b)=>(a.operationIndex||0)-(b.operationIndex||0));
  }

  function created(ctx, op, type, rec){
    if(op.ref!==undefined) ctx.created.push({ref:op.ref, type, pageIndex:op.pageIndex, id:rec.id});
  }

  /* Parche de update_*: «spec» (objeto) con al menos un campo (o, en una conexión, un extremo nuevo). Lo que va en la operación
     (source/target) no puede ir también dentro de spec. */
  function updateSpec(op, spec, banned, hasEndpoints){
    if(spec===undefined && hasEndpoints) return {};
    if(!isRecord(spec)) throw reject("INVALID_OPERATION", `${op.op} necesita «spec»: un objeto con los campos a cambiar.`, {field:"spec"});
    for(const k of banned) if(spec[k]!==undefined) throw reject("INVALID_OPERATION", `«${k}» va en la operación, no dentro de spec.`, {field:`spec.${k}`});
    if(!Object.keys(spec).some(k=>spec[k]!==undefined) && !hasEndpoints) throw reject("INVALID_OPERATION", `${op.op} no cambia nada: indica al menos un campo en spec.`, {field:"spec"});
    return spec;
  }
  /* Qué campos cambiaron de verdad y de qué a qué (source/target = from/to del documento). */
  function diffOf(before, after, keys){
    const fields = [], from = {}, to = {};
    for(const k of keys){
      const dk = k==="source" ? "from" : k==="target" ? "to" : k;
      if(JSON.stringify(before[dk])===JSON.stringify(after[dk])) continue;
      fields.push(k); from[k] = before[dk]; to[k] = after[dk];
    }
    return {fields, from, to};
  }
  /* Historias de la página cuyos pasos tocan esos elementos o conexiones (ids de la página). */
  function storiesUsing(pg, pageIndex, nodeIds, edgeIds){
    const out = [];
    for(const sc of pg.scenarios){
      const stepIds = sc.steps.filter(st=>(st.nodeId!==undefined && nodeIds.includes(st.nodeId)) || (st.edgeId!==undefined && edgeIds.includes(st.edgeId))).map(st=>st.id);
      if(stepIds.length) out.push({pageIndex, storyId:sc.id, name:sc.name, stepIds});
    }
    return out;
  }


  /* ───────── Aspecto del documento, orden Z y duplicado de elementos (FLUYO-018.7a) ─────────
     Aquí solo viven la forma de las operaciones, las refs y los límites de ENTRADA; las reglas (tema, colocación Z, clonado,
     ids, conexiones internas, Behaviors) son de model.js: setThemeIn, reorderNodesIn, duplicateNodesIn, las del editor. */
  const MAX_NODE_LIST = 100;
  function themeInputRules(patch){
    if(patch.theme!==undefined && !(typeof patch.theme==="string" && projectOwn(THEMES, patch.theme)))
      throw reject("INVALID_FIELD", `«theme» ${JSON.stringify(patch.theme)} no existe. Temas: ${Object.keys(THEMES).join(", ")}.`, {field:"theme", allowed:Object.keys(THEMES)});
    const v = patch.customBg;
    if(v!==undefined && v!==null && v!=="" && !(typeof v==="string" && HEX_COLOR.test(v)))
      throw reject("INVALID_FIELD", `«customBg» debe ser un color HEX (#rgb, #rrggbb o #rrggbbaa), null o "" (sin fondo personalizado); recibido ${JSON.stringify(v)}. No se admiten nombres de color.`, {field:"customBg"});
  }
  /* Errores de reorderNodesIn/duplicateNodesIn → errores estructurados del lote. */
  function fromNodeSetDomain(e, op, ctx){
    if(!(e && typeof e.code==="string" && !e.authoring)) return e;
    if(e.code==="node_not_found") return reject("NODE_NOT_FOUND", `No existe el elemento ${e.id} en la página ${op.pageIndex}${deletedNote(ctx, op.pageIndex, "node", e.id)}.`, {domainCode:e.code, id:e.id});
    if(e.code==="id_exhausted") return reject("ID_EXHAUSTED", "La página no admite más ids.", {domainCode:e.code});
    if(e.code==="invalid_placement") return reject("INVALID_FIELD", "«to» debe ser front, back, forward o backward.", {field:"to", domainCode:e.code});
    if(e.code==="invalid_document") return reject("INVALID_FIELD", `«${e.field===undefined ? "operación" : e.field}» no es válido.`, {field:e.field, domainCode:e.code});
    return e;
  }
  function nodeList(ctx, op){
    if(!Array.isArray(op.nodes) || !op.nodes.length || op.nodes.length>MAX_NODE_LIST)
      throw reject("INVALID_OPERATION", `nodes debe ser una lista de 1 a ${MAX_NODE_LIST} elementos.`, {field:"nodes"});
    return op.nodes;
  }

  const HANDLERS = {
    create_node(ctx, op, pg){
      const spec = withRef(op, diagramSpec(op));
      nodeInputRules(spec, spec.shape, true);
      let n;
      try{ n = createNodeIn(pg, spec, {refs:pageRefs(ctx, "nodes", op.pageIndex)}); }
      catch(e){ throw fromDiagramDomain(e, op, ctx); }
      watch(ctx, op, op.pageIndex, "node", n.id, ["x","y","w","h"]);
      ctx.countOps[op.pageIndex] = Object.assign(ctx.countOps[op.pageIndex] || {}, {nodes:ctx.opIndex});
      created(ctx, op, "node", n);
      return Object.assign({entityKind:"node", entityId:n.id, created:true}, op.ref!==undefined ? {ref:op.ref} : {},
        {shape:n.shape, label:n.label, x:n.x, y:n.y, w:n.w, h:n.h, affects:{stories:[]}});
    },
    create_connection(ctx, op, pg){
      const source = endpointOf(ctx, op, op.source, "source"), target = endpointOf(ctx, op, op.target, "target");
      const spec = Object.assign(withRef(op, op.spec===undefined ? {} : diagramSpec(op)), {source, target});
      edgeInputRules(spec);
      let e;
      try{ e = createConnectionIn(pg, spec, {refs:pageRefs(ctx, "edges", op.pageIndex)}); }
      catch(err){ throw fromDiagramDomain(err, op, ctx); }
      if(spec.waypoints!==undefined) watch(ctx, op, op.pageIndex, "connection", e.id, ["waypoints"]);
      ctx.countOps[op.pageIndex] = Object.assign(ctx.countOps[op.pageIndex] || {}, {connections:ctx.opIndex});
      created(ctx, op, "connection", e);
      return Object.assign({entityKind:"connection", entityId:e.id, created:true}, op.ref!==undefined ? {ref:op.ref} : {},
        {source:e.from, target:e.to, affects:{stories:[]}});
    },
    update_node(ctx, op, pg){
      const id = entityOf(ctx, op, op.node, "node", "nodes");
      const patch = updateSpec(op, op.spec, []);
      const rec = pg.nodes.find(n=>n.id===id), before = rec && clone(rec);
      nodeInputRules(patch, patch.shape===undefined && rec ? rec.shape : patch.shape, false);
      let n;
      try{ n = updateNodeIn(pg, id, patch); }
      catch(e){ throw fromDiagramDomain(e, op, ctx, id); }
      watch(ctx, op, op.pageIndex, "node", id, ["x","y","w","h"].filter(k=>patch[k]!==undefined));
      const diff = diffOf(before, n, Object.keys(patch).filter(k=>patch[k]!==undefined));
      const incident = pg.edges.filter(e=>e.from===id || e.to===id);
      const moved = ["x","y","w","h","shape"].some(k=>diff.fields.includes(k));
      const relabeled = diff.fields.includes("label");
      return Object.assign({entityKind:"node", entityId:id, updated:true}, diff,
        {affects:Object.assign({stories:relabeled ? storiesUsing(pg, op.pageIndex, [id], incident.map(e=>e.id)) : [],
                  connectionsWithWaypoints:moved ? incident.filter(e=>(e.waypoints||[]).length).map(e=>e.id) : []},
                  relabeled ? {note:"La frase de los pasos que tocan este elemento usa su etiqueta."} : {})});
    },
    update_connection(ctx, op, pg){
      const id = entityOf(ctx, op, op.connection, "connection", "edges");
      const extra = {};
      if(op.source!==undefined) extra.source = endpointOf(ctx, op, op.source, "source");
      if(op.target!==undefined) extra.target = endpointOf(ctx, op, op.target, "target");
      const patch = Object.assign({}, updateSpec(op, op.spec, ["source","target"], Object.keys(extra).length>0), extra);
      const rec = pg.edges.find(e=>e.id===id), before = rec && clone(rec);
      edgeInputRules(patch);
      let e;
      try{ e = updateConnectionIn(pg, id, patch); }
      catch(err){ throw fromDiagramDomain(err, op, ctx, id); }
      if(patch.waypoints!==undefined) watch(ctx, op, op.pageIndex, "connection", id, ["waypoints"]);
      const diff = diffOf(before, e, Object.keys(patch).filter(k=>patch[k]!==undefined));
      const retargeted = diff.fields.includes("source") || diff.fields.includes("target");
      return Object.assign({entityKind:"connection", entityId:id, updated:true}, diff,
        {affects:Object.assign({stories:retargeted ? storiesUsing(pg, op.pageIndex, [], [id]) : []},
                  retargeted ? {note:"Los pasos de esta conexión cambian de frase y de recorrido; sus ids y tiempos no cambian. Los waypoints no se tocan: envía waypoints:[] para volver a la ruta automática."} : {})});
    },
    delete_node(ctx, op, pg){
      const id = entityOf(ctx, op, op.node, "node", "nodes");
      let r;
      try{ r = deleteNodeIn(pg, id); }
      catch(e){ throw fromDiagramDomain(e, op, ctx, id); }
      ctx.deleted.push({kind:"node", pageIndex:op.pageIndex, id, label:r.node.label, operationIndex:ctx.opIndex, operation:op.op});
      for(const cid of r.connections) ctx.deleted.push({kind:"connection", pageIndex:op.pageIndex, id:cid, operationIndex:ctx.opIndex, operation:op.op, cascadedFrom:{kind:"node", id}});
      return {entityKind:"node", entityId:id, deleted:true, label:r.node.label, cascade:{connections:r.connections, behaviors:r.behaviors}, affects:{stories:[]}};
    },
    delete_connection(ctx, op, pg){
      const id = entityOf(ctx, op, op.connection, "connection", "edges");
      let e;
      try{ e = deleteConnectionIn(pg, id); }
      catch(err){ throw fromDiagramDomain(err, op, ctx, id); }
      ctx.deleted.push({kind:"connection", pageIndex:op.pageIndex, id, operationIndex:ctx.opIndex, operation:op.op});
      return {entityKind:"connection", entityId:id, deleted:true, source:e.from, target:e.to, affects:{stories:[]}};
    },
    /* ── Páginas (scope document): createPageIn/renamePageIn de model.js, las mismas que el editor ── */
    create_page(ctx, op){
      let r;
      try{ r = createPageIn(ctx.d, op.name); }
      catch(e){ throw fromPageDomain(e); }
      // Las operaciones siguientes del lote usan este pageIndex (el del lote, siempre al final): sale en `changes` (entityId) y en `pageIndex`.
      ctx.pages.push(ctx.d.pages[r.pageIndex]);                        // la página que el dominio creó, por su índice en el documento
      const pageIndex = ctx.pages.length-1;
      ctx.baseCounts[pageIndex] = {nodes:0, edges:0};
      return {entityKind:"page", entityId:pageIndex, pageIndex, created:true, name:r.page.name, affects:{stories:[]}};
    },
    rename_page(ctx, op){
      pageOf(ctx, op);
      let r;
      try{ r = renamePageIn(ctx.d, liveIndexOf(ctx, op.pageIndex), op.name); }
      catch(e){ throw fromPageDomain(e, op); }
      return {entityKind:"page", entityId:op.pageIndex, pageIndex:op.pageIndex, renamed:true, from:r.from, to:r.page.name, affects:{stories:[]}};
    },
    /* ── Eliminar página (FLUYO-018.7c): deletePageIn de model.js, la misma que la ✕ del editor. Cascada intrínseca (la página se va con
       sus nodos, conexiones, Behaviors, Historias y Steps; los EventTypes se conservan) y regla de cur del dominio. Guarda de intención:
       expectedName debe ser EXACTAMENTE el nombre actual de la página. Nunca deja 0 páginas (se comprueba en cada borrado). ── */
    delete_page(ctx, op){
      if(op.expectedName===undefined) throw reject("INVALID_FIELD", "delete_page necesita «expectedName»: el nombre ACTUAL de la página (el de describe_document). Protege de eliminar otra página por un índice desactualizado.", {field:"expectedName"});
      if(typeof op.expectedName!=="string") throw reject("INVALID_FIELD", "«expectedName» debe ser un texto: el nombre actual de la página, exacto.", {field:"expectedName"});
      const pg = pageOf(ctx, op);
      if(pg.name!==op.expectedName)
        throw reject("PAGE_MISMATCH", `La página ${op.pageIndex} se llama «${pg.name}», no «${op.expectedName}»: no se elimina nada. Vuelve a leer el documento (describe_document) y usa el nombre exacto.`, {pageIndex:op.pageIndex, expectedName:op.expectedName, actualName:pg.name});
      const curFrom = batchIndexOf(ctx, ctx.d.cur);
      let r;
      try{ r = deletePageIn(ctx.d, liveIndexOf(ctx, op.pageIndex)); }
      catch(e){
        if(e && e.code==="last_page") throw reject("CANNOT_DELETE_LAST_PAGE", "No se puede eliminar la única página: un documento tiene siempre al menos una. Crea otra antes en el mismo lote (create_page) o vacía esta.", {pageIndex:op.pageIndex});
        throw fromPageDomain(e, op);
      }
      ctx.pages[op.pageIndex] = null;
      ctx.deletedPages.set(op.pageIndex, {operationIndex:ctx.opIndex, operation:op.op, name:pg.name});
      for(const [k, t] of ctx.touched) if(t.pageIndex===op.pageIndex) ctx.touched.delete(k);
      const im = r.impact;
      return {entityKind:"page", entityId:op.pageIndex, pageIndex:op.pageIndex, deleted:true, name:pg.name,
              contents:{nodes:im.nodes, connections:im.connections, behaviors:im.behaviors, stories:im.stories.length, steps:im.stories.reduce((n, s)=>n+s.steps, 0)},
              affects:{stories:im.stories.map(s=>({pageIndex:op.pageIndex, storyId:s.storyId, name:s.name, moments:s.moments, steps:s.steps, deleted:true})),
                       eventTypesFreed:im.eventTypesFreed},
              cur:{from:curFrom, to:batchIndexOf(ctx, ctx.d.cur)}};
    },
    /* ── Aspecto del documento (scope document): setThemeIn de model.js, la misma que el editor ── */
    set_theme(ctx, op){
      const patch = {};
      for(const k of ["theme","customBg"]) if(op[k]!==undefined) patch[k] = op[k];
      if(!Object.keys(patch).length) throw reject("INVALID_OPERATION", "set_theme necesita «theme» y/o «customBg».", {field:"theme"});
      themeInputRules(patch);
      let r;
      try{ r = setThemeIn(ctx.d, patch); }
      catch(e){
        if(e && e.code==="invalid_theme") throw reject("INVALID_FIELD", "«theme» no es válido.", {field:"theme"});
        if(e && e.code==="invalid_document") throw reject("INVALID_FIELD", `«${e.field}» no es válido.`, {field:e.field});
        throw e;
      }
      return {entityKind:"document", changed:r.changed, theme:r.theme, customBg:r.customBg, affects:{stories:[]}};
    },
    /* ── Orden Z (scope page): reorderNodesIn de model.js. Solo elementos: las conexiones no tienen Z (van siempre bajo los nodos) ── */
    reorder_nodes(ctx, op, pg){
      const ids = nodeList(ctx, op).map((v, i)=>entityOf(ctx, op, v, `nodes[${i}]`, "nodes"));
      let r;
      try{ r = reorderNodesIn(pg, ids, op.to); }
      catch(e){ throw fromNodeSetDomain(e, op, ctx); }
      return {entityKind:"node", entityId:ids[0], changed:r.changed, to:op.to, affects:Object.assign({stories:[]}, r.changed ? {order:{from:r.from, to:r.to}} : {})};
    },
    /* ── Duplicar elementos (scope page): duplicateNodesIn de model.js (la de Ctrl+D). Una operación = un bloque atómico. ── */
    duplicate_node(ctx, op, pg){
      const list = nodeList(ctx, op);
      const ids = [], copyRefs = [];
      list.forEach((entry, i)=>{
        if(!isRecord(entry)) throw reject("INVALID_OPERATION", `nodes[${i}] debe ser un objeto {source, ref?}.`, {field:`nodes[${i}]`});
        onlyKeys(entry, ["source","ref"], `nodes[${i}]`);
        if(entry.source===undefined) throw reject("INVALID_OPERATION", `nodes[${i}].source es obligatorio: {id} o {ref} del elemento a duplicar.`, {field:`nodes[${i}].source`});
        const id = entityOf(ctx, op, entry.source, `nodes[${i}].source`, "nodes");
        if(ids.includes(id)) throw reject("INVALID_OPERATION", `El elemento ${id} aparece más de una vez en nodes.`, {field:`nodes[${i}].source`});
        ids.push(id);
        if(entry.ref!==undefined){
          if(typeof entry.ref!=="string" || !entry.ref) throw reject("INVALID_OPERATION", `nodes[${i}].ref debe ser un texto no vacío.`, {field:`nodes[${i}].ref`});
          if(pageRefs(ctx, "nodes", op.pageIndex).has(entry.ref) || copyRefs.some(c=>c.ref===entry.ref))
            throw reject("DUPLICATE_REF", `La ref «${entry.ref}» ya la usa otro elemento de esta página en el lote.`, {field:`nodes[${i}].ref`, ref:entry.ref});
          copyRefs.push({ref:entry.ref, source:id});
        }
      });
      if(op.connections!==undefined && op.connections!=="internal" && op.connections!=="none")
        throw reject("INVALID_FIELD", "«connections» debe ser \"internal\" (por defecto) o \"none\".", {field:"connections"});
      const options = {connections:op.connections};
      if(op.offset!==undefined){
        if(!isRecord(op.offset)) throw reject("INVALID_FIELD", "«offset» debe ser {x, y} (números).", {field:"offset"});
        onlyKeys(op.offset, ["x","y"], "offset");
        for(const k of ["x","y"]) if(typeof op.offset[k]!=="number" || !Number.isFinite(op.offset[k])) throw reject("INVALID_FIELD", `«offset.${k}» debe ser un número.`, {field:`offset.${k}`});
        options.dx = op.offset.x; options.dy = op.offset.y;
      }
      let r;
      try{ r = duplicateNodesIn(pg, ids, options); }
      catch(e){ throw fromNodeSetDomain(e, op, ctx); }
      const createdList = [];
      for(const n of r.nodes){
        const cr = copyRefs.find(c=>c.source===n.from);
        if(cr){ pageRefs(ctx, "nodes", op.pageIndex).set(cr.ref, n.id); ctx.created.push({ref:cr.ref, type:"node", pageIndex:op.pageIndex, id:n.id}); }
        watch(ctx, op, op.pageIndex, "node", n.id, ["x","y"]);
        createdList.push(Object.assign({kind:"node", from:n.from, id:n.id}, cr ? {ref:cr.ref} : {}));
      }
      ctx.countOps[op.pageIndex] = Object.assign(ctx.countOps[op.pageIndex] || {}, {nodes:ctx.opIndex});
      const withWaypoints = [];
      for(const c of r.connections){
        createdList.push({kind:"connection", from:c.from, id:c.id});
        const e = pg.edges.find(x=>x.id===c.id);
        if(e && (e.waypoints||[]).length){ watch(ctx, op, op.pageIndex, "connection", c.id, ["waypoints"]); withWaypoints.push(c.id); }
      }
      if(r.connections.length) ctx.countOps[op.pageIndex] = Object.assign(ctx.countOps[op.pageIndex], {connections:ctx.opIndex});
      return {entityKind:"node", entityId:r.nodes[0].id, created:createdList, behaviors:r.behaviors,
              affects:{stories:[], connectionsWithWaypoints:withWaypoints}};
    },
    create_story(ctx, op, pg){
      const name = nameOf(op.name, true) || defaultScenarioName(pg);
      const sc = createScenario(pg, name);
      if(op.ref!==undefined) ctx.refs.stories.set(String(op.ref), {id:sc.id, pageIndex:op.pageIndex});
      touch(ctx, op.pageIndex, sc);
      return {entityKind:"story", entityId:sc.id, created:true, affects:storyAffect(op.pageIndex, sc)};
    },
    rename_story(ctx, op, pg){
      const sc = storyOf(ctx, op, pg, false);
      const from = sc.name; sc.name = nameOf(op.name);
      touch(ctx, op.pageIndex, sc);
      return {entityKind:"story", entityId:sc.id, from, to:sc.name, affects:storyAffect(op.pageIndex, sc)};
    },
    duplicate_story(ctx, op, pg){
      const src = storyOf(ctx, op, pg, false);
      const copy = duplicateScenario(pg, src.id);
      if(op.name!==undefined) copy.name = nameOf(op.name);
      if(op.ref!==undefined) ctx.refs.stories.set(String(op.ref), {id:copy.id, pageIndex:op.pageIndex});
      touch(ctx, op.pageIndex, copy);
      return {entityKind:"story", entityId:copy.id, created:true, duplicatedFrom:src.id, affects:storyAffect(op.pageIndex, copy)};
    },
    delete_story(ctx, op, pg){
      const sc = storyOf(ctx, op, pg, false);
      deleteScenario(pg, sc.id);
      ctx.touched.delete(`${op.pageIndex}:${sc.id}`);
      return {entityKind:"story", entityId:sc.id, deleted:true, affects:{stories:[{pageIndex:op.pageIndex, storyId:sc.id, name:sc.name, deleted:true}]}};
    },
    add_step(ctx, op, pg){
      const sc = storyOf(ctx, op, pg, true);
      if(sc.steps.length>=FluyoScenarios.MAX_SCENARIO_STEPS) throw reject("MAX_STEPS", `La Historia ya tiene el máximo de ${FluyoScenarios.MAX_SCENARIO_STEPS} pasos.`, {storyId:sc.id});
      const et = eventTypeOf(ctx, op.eventTypeId);
      const spec = eventTypeActionSpec(et);
      if(!spec) throw reject("EVENT_TYPE_NOT_FOUND", `El evento ${et.id} no tiene una primitiva válida.`, {eventTypeId:et.id});
      const targetId = targetOf(ctx, op, pg, spec.target, op.target);
      const before = clone(sc.steps);
      let step;
      if(op.placement===undefined){
        // Al final de la Historia, tras una espera (por defecto la del editor); el primero entra en 0.
        const wait = op.waitMs===undefined ? DEFAULT_STEP_DELAY_MS : waitOf(op.waitMs, "waitMs");
        step = createStep(sc, stepDefinitionForEvent(et, targetId, defaultStepTime(sc, wait)));
        if(sc.steps.length>1 && step.at>FluyoScenarios.MAX_VIRTUAL_TIME_MS) throw reject("WAIT_OUT_OF_RANGE", "El tiempo resultante supera el máximo de 24 h.", {storyId:sc.id});
      }else{
        if(op.waitMs!==undefined) throw reject("INVALID_OPERATION", "waitMs sólo se usa al añadir al final; con placement la espera es la del momento elegido.", {field:"waitMs"});
        if(isRecord(op.placement)) onlyKeys(op.placement, ["sameMomentAs","position"], "placement");
        if(!isRecord(op.placement) || op.placement.sameMomentAs===undefined) throw reject("INVALID_OPERATION", "placement debe ser {sameMomentAs: stepId, position?: \"before\"|\"after\"}.", {field:"placement"});
        const anchor = stepOf(ctx, sc, op.placement.sameMomentAs, "placement.sameMomentAs", op.pageIndex);
        const pos = op.placement.position;
        if(pos!==undefined && pos!=="before" && pos!=="after") throw reject("INVALID_OPERATION", "position debe ser \"before\" o \"after\".", {field:"placement.position"});
        // Sin position: igual que «Añadir al mismo tiempo» del editor (mismo momento, resuelve después de los existentes).
        step = createStep(sc, stepDefinitionForEvent(et, targetId, anchor.at));
        if(pos!==undefined){
          const r = storyboardMoveStep(sc.steps, step.id, {kind:"join", anchorId:anchor.id, after:pos==="after"});
          if(!r) throw reject("MOVE_UNSUPPORTED", "No se pudo colocar el paso junto al elegido.", {storyId:sc.id});
          sc.steps = r.steps;
        }
      }
      if(op.ref!==undefined) ctx.refs.steps.set(String(op.ref), {id:step.id, pageIndex:op.pageIndex, storyId:sc.id});
      touch(ctx, op.pageIndex, sc);
      const d = stepDelta(before, sc.steps);
      return {entityKind:"step", entityId:step.id, storyId:sc.id, created:true, at:step.at, action:step.action, affects:storyAffect(op.pageIndex, sc, d)};
    },
    remove_step(ctx, op, pg){
      const sc = storyOf(ctx, op, pg, true);
      const st = stepOf(ctx, sc, op.stepId, "stepId", op.pageIndex);
      const before = clone(sc.steps);
      const r = storyboardRemoveStep(sc.steps, st.id);       // misma política que el editor: la espera del momento que desaparece se colapsa
      sc.steps = r.steps;
      touch(ctx, op.pageIndex, sc);
      return {entityKind:"step", entityId:st.id, storyId:sc.id, deleted:true, affects:storyAffect(op.pageIndex, sc, stepDelta(before, sc.steps))};
    },
    move_step(ctx, op, pg){
      const sc = storyOf(ctx, op, pg, true);
      const st = stepOf(ctx, sc, op.stepId, "stepId", op.pageIndex);
      const forms = ["direction","to"].filter(k=>op[k]!==undefined).length;
      if(forms!==1) throw reject("INVALID_OPERATION", "move_step necesita exactamente uno de: direction (\"earlier\"|\"later\") o to ({gapIndex} | {sameMomentAs, after}).", {field:"direction|to"});
      const before = clone(sc.steps);
      let r;
      if(op.direction!==undefined){
        if(op.direction!=="earlier" && op.direction!=="later") throw reject("INVALID_OPERATION", "direction debe ser \"earlier\" o \"later\".", {field:"direction"});
        r = storyboardMoveByOne(sc.steps, st.id, op.direction==="earlier" ? -1 : 1);
      }else{
        const to = op.to;
        if(isRecord(to)) onlyKeys(to, ["gapIndex","sameMomentAs","after"], "to");
        if(!isRecord(to)) throw reject("INVALID_OPERATION", "to debe ser {gapIndex} o {sameMomentAs, after}.", {field:"to"});
        let target;
        if(to.gapIndex!==undefined) target = {kind:"gap", index:to.gapIndex};
        else if(to.sameMomentAs!==undefined) target = {kind:"join", anchorId:stepOf(ctx, sc, to.sameMomentAs, "to.sameMomentAs", op.pageIndex).id, after:!!to.after};
        else throw reject("INVALID_OPERATION", "to debe ser {gapIndex} o {sameMomentAs, after}.", {field:"to"});
        r = storyboardMoveStep(sc.steps, st.id, target);
      }
      if(!r) throw reject("MOVE_UNSUPPORTED", "Ese movimiento no está soportado (p. ej. sacar un paso de un momento simultáneo a un hueco o ya está en el extremo): usa direction o sameMomentAs.", {storyId:sc.id, stepId:st.id});
      sc.steps = r.steps;
      touch(ctx, op.pageIndex, sc);
      return {entityKind:"step", entityId:st.id, storyId:sc.id, affects:storyAffect(op.pageIndex, sc, stepDelta(before, sc.steps))};
    },
    duplicate_step(ctx, op, pg){
      const sc = storyOf(ctx, op, pg, true);
      const st = stepOf(ctx, sc, op.stepId, "stepId", op.pageIndex);
      if(sc.steps.length>=FluyoScenarios.MAX_SCENARIO_STEPS) throw reject("MAX_STEPS", `La Historia ya tiene el máximo de ${FluyoScenarios.MAX_SCENARIO_STEPS} pasos.`, {storyId:sc.id});
      const before = clone(sc.steps);
      const copy = duplicateStep(sc, st.id);                 // mismo momento, justo debajo; no desplaza nada
      if(op.ref!==undefined) ctx.refs.steps.set(String(op.ref), {id:copy.id, pageIndex:op.pageIndex, storyId:sc.id});
      touch(ctx, op.pageIndex, sc);
      return {entityKind:"step", entityId:copy.id, storyId:sc.id, created:true, duplicatedFrom:st.id, affects:storyAffect(op.pageIndex, sc, stepDelta(before, sc.steps))};
    },
    retarget_step(ctx, op, pg){
      const sc = storyOf(ctx, op, pg, true);
      const st = stepOf(ctx, sc, op.stepId, "stepId", op.pageIndex);
      const kind = st.action==="SEND" ? "connection" : "element";
      const targetId = targetOf(ctx, op, pg, kind, op.target);
      const from = st.action==="SEND" ? st.edgeId : st.nodeId;
      retargetStep(pg, sc, st.id, targetId);
      touch(ctx, op.pageIndex, sc);
      return {entityKind:"step", entityId:st.id, storyId:sc.id, from, to:targetId, affects:storyAffect(op.pageIndex, sc, {stepIds:[st.id]})};
    },
    set_wait(ctx, op, pg){
      const sc = storyOf(ctx, op, pg, true);
      const st = stepOf(ctx, sc, op.stepId, "stepId", op.pageIndex);
      const wait = waitOf(op.waitMs, "waitMs");
      const before = clone(sc.steps);
      const r = storyboardSetWait(sc.steps, st.id, wait, FluyoScenarios.MAX_VIRTUAL_TIME_MS);
      if(!r) throw reject("INVALID_WAIT", "No se pudo aplicar la espera.", {storyId:sc.id, stepId:st.id});
      if(r.error) throw reject("WAIT_OUT_OF_RANGE", "El tiempo resultante supera el máximo de 24 h.", {storyId:sc.id, stepId:st.id, waitMs:wait});
      sc.steps = r.steps;
      touch(ctx, op.pageIndex, sc);
      return {entityKind:"step", entityId:st.id, storyId:sc.id, waitMs:wait, affects:storyAffect(op.pageIndex, sc, stepDelta(before, sc.steps))};
    },
    set_initial_availability(ctx, op, pg){
      const nodeId = stepEntityId(ctx, op, op.nodeId, "nodeId", "nodes");
      if(!pg.nodes.some(n=>n.id===nodeId)) throw reject("TARGET_NOT_FOUND", `No existe el elemento nodeId=${nodeId} en la página${deletedNote(ctx, op.pageIndex, "node", nodeId)}.`, {nodeId});
      if(op.state!=="UP" && op.state!=="DOWN") throw reject("INVALID_OPERATION", "state debe ser \"UP\" o \"DOWN\".", {field:"state"});
      setInitialAvailability(pg, nodeId, op.state);
      // La disponibilidad inicial es de la PÁGINA: la ven todas sus Historias, no sólo la que se está escribiendo.
      return {entityKind:"element", entityId:nodeId, pageLevel:true, state:op.state,
              affects:{stories:pg.scenarios.map(s=>({pageIndex:op.pageIndex, storyId:s.id, name:s.name})), note:"La disponibilidad inicial pertenece a la página: rige en todas sus Historias."}};
    },
    /* ── EventTypes (scope eventType: globales al documento; las Historias sólo los referencian por id) ── */
    create_event_type(ctx, op){
      for(const k of ["name","primitive","sentence"]) if(op[k]===undefined) throw etError(k, `create_event_type necesita «${k}»: debe ser ${FIELD_RULES[k]()}.`);
      const primitive = primitiveOf(op.primitive);
      const input = {name:textOf(op.name, "name"), primitive, sentenceTemplate:textOf(op.sentence, "sentence"),
                     symbol:op.symbol===undefined ? DEFAULT_EVENT_SYMBOL : textOf(op.symbol, "symbol")};
      if(op.motion!==undefined) input.motion = motionOf(op.motion, primitive);
      if(op.availability!==undefined || primitive==="SET_AVAILABILITY") input.availability = availabilityOf(op.availability, primitive);
      const effects = presentationOf(primitive, op.presentation, null);
      if(primitive==="FLOW") input.connectionEffects = effects; else input.nodeEffects = effects;
      let et;
      try{ et = createEventTypeIn(ctx.d, eventTypeDefinition(input)); }
      catch(e){ throw fromDomain(e); }
      if(op.ref!==undefined) ctx.refs.eventTypes.set(String(op.ref), {id:et.id});
      return {entityKind:"eventType", entityId:et.id, created:true, eventType:eventTypeSummary(et), warnings:duplicateNameWarnings(ctx.d, et), affects:{stories:[], eventTypeUsedBy:0}};
    },
    update_event_type(ctx, op){
      const et = eventTypeOf(ctx, op.eventTypeId);
      const given = ["name","primitive","sentence","symbol","motion","availability","presentation"].filter(k=>op[k]!==undefined);
      if(!given.length) throw reject("INVALID_OPERATION", "update_event_type necesita al menos un campo a cambiar: name, primitive, sentence, symbol, motion, availability o presentation.", {field:"name|primitive|sentence|symbol|motion|availability|presentation"});
      const before = clone(et);
      const primitive = op.primitive===undefined ? et.primitive : primitiveOf(op.primitive);
      if(op.name!==undefined) textOf(op.name, "name");
      if(op.sentence!==undefined) textOf(op.sentence, "sentence");
      if(op.symbol!==undefined) textOf(op.symbol, "symbol");
      if(op.motion!==undefined) motionOf(op.motion, primitive);
      let changes;
      if(primitive!==et.primitive){
        // Cambia dónde ocurre el evento: como en el modal del editor, se reconstruye la definición completa de la nueva primitiva.
        const input = {name:op.name===undefined ? et.name : op.name, primitive, sentenceTemplate:op.sentence===undefined ? et.sentenceTemplate : op.sentence,
                       symbol:op.symbol===undefined ? et.visual.value : op.symbol, motion:op.motion};
        if(primitive==="SET_AVAILABILITY") input.availability = availabilityOf(op.availability, primitive);
        else if(op.availability!==undefined) availabilityOf(op.availability, primitive);
        const effects = presentationOf(primitive, op.presentation, null);
        if(primitive==="FLOW") input.connectionEffects = effects; else input.nodeEffects = effects;
        changes = eventTypeDefinition(input);
      }else{
        changes = {};
        if(op.name!==undefined) changes.name = op.name;
        if(op.sentence!==undefined) changes.sentenceTemplate = op.sentence;
        if(op.symbol!==undefined) changes.visual = {value:op.symbol};
        if(op.motion!==undefined) changes.motion = op.motion;
        if(op.availability!==undefined) changes.availability = availabilityOf(op.availability, primitive);
        if(op.presentation!==undefined){
          const effects = presentationOf(primitive, op.presentation, et.presentation);
          changes.presentation = primitive==="FLOW" ? {connectionEffects:effects} : {nodeEffects:effects};
        }
      }
      try{ updateEventTypeIn(ctx.d, et.id, changes); }
      catch(e){
        if(e && e.code==="event_type_primitive_immutable_when_used" || e && e.code==="event_type_availability_immutable_when_used"){
          const candidate = Object.assign(clone(before), {primitive:changes.primitive===undefined ? before.primitive : changes.primitive});
          if(candidate.primitive==="SET_AVAILABILITY") candidate.availability = changes.availability===undefined ? before.availability : changes.availability;
          else delete candidate.availability;
          throw blockedByUse(ctx, et, candidate, "EVENT_TYPE_LOCKED", e.field);
        }
        throw fromDomain(e);
      }
      const after = eventTypeByIdIn(ctx.d, et.id);
      const sameJson = (a, b) => JSON.stringify(a)===JSON.stringify(b);
      const fields = [];
      if(before.name!==after.name) fields.push("name");
      if(before.primitive!==after.primitive) fields.push("primitive");
      if(before.sentenceTemplate!==after.sentenceTemplate) fields.push("sentence");
      if(before.visual.value!==after.visual.value) fields.push("symbol");
      if(before.motion!==after.motion) fields.push("motion");
      if(before.availability!==after.availability) fields.push("availability");
      if(!sameJson(before.presentation, after.presentation)) fields.push("presentation");
      const uses = inBatch(ctx, eventTypeUsagesIn(ctx.d, et.id));
      return {entityKind:"eventType", entityId:et.id, fields, from:eventTypeSummary(before), eventType:eventTypeSummary(after),
              warnings:fields.includes("name") ? duplicateNameWarnings(ctx.d, after) : [],
              affects:{stories:uses.map(u=>({pageIndex:u.pageIndex, storyId:u.storyId, name:u.storyName, stepIds:u.stepIds})), eventTypeUsedBy:uses.reduce((n, u)=>n+u.stepIds.length, 0),
                       note:"El evento es global: el cambio se ve en todos sus usos. Los pasos, tiempos y objetivos de las Historias no cambian."}};
    },
    delete_event_type(ctx, op){
      const et = eventTypeOf(ctx, op.eventTypeId);
      // El impacto lo decide FluyoIntegrity (qué Historias y pasos quedarían inválidos); el borrado, model.js (igual que el editor).
      if(FluyoIntegrity.eventTypeImpact(snapshotOf(ctx), et.id, null).wouldInvalidate) throw blockedByUse(ctx, et, null, "REFERENCED_ENTITY");
      try{ deleteEventTypeIn(ctx.d, et.id); }
      catch(e){ if(e && e.code==="event_type_in_use") throw blockedByUse(ctx, et, null, "REFERENCED_ENTITY"); throw e; }
      return {entityKind:"eventType", entityId:et.id, deleted:true, eventType:eventTypeSummary(et), affects:{stories:[], eventTypeUsedBy:0}};
    }
  };

  /* ───────── Estado final: red de seguridad ─────────
     Cada operación ya comprueba lo suyo (existencia, destino, compatibilidad, uso de un EventType); aun así el ESTADO FINAL
     se valida con FluyoIntegrity y cualquier error NUEVO rechaza el lote, nombrando la Historia y el Step. */
  function explain(regress){
    return regress.map(e=>({code:"INTEGRITY_VIOLATION", message:e.message, integrityError:e}));
  }
  /* B2 del diagrama (FLUYO-018.3): los errores NUEVOS del estado final que se deben a algo que el lote eliminó (un elemento o
     una conexión, también la eliminada en cascada con su elemento) se agrupan por entidad eliminada y nombran la Historia, los
     Steps, la operación causante y qué hacer. Nada se limpia en silencio. Lo que no se pueda atribuir queda como INTEGRITY_VIOLATION. */
  function explainRemovals(ctx, regress){
    const groups = new Map(), rest = [];
    for(const e of regress){
      const kind = e.entityKind==="edge" ? "connection" : e.entityKind==="node" ? "node" : null;
      const del = kind && ctx.deleted.find(x=>x.kind===kind && x.pageIndex===e.pageIndex && x.id===e.entityId);
      if(!del){ rest.push(e); continue; }
      const key = `${del.pageIndex}:${del.kind}:${del.id}`;
      if(!groups.has(key)) groups.set(key, {del, errors:[]});
      groups.get(key).errors.push(e);
    }
    const out = [];
    // Orden estable: por operación, el elemento antes que sus conexiones y por id.
    const ordered = [...groups.values()].sort((a, b)=>a.del.operationIndex-b.del.operationIndex || (a.del.kind===b.del.kind ? 0 : a.del.kind==="node" ? -1 : 1) || a.del.id-b.del.id);
    for(const {del, errors} of ordered){
      const uses = usageErrors(errors, ctx);
      const what = del.kind==="node" ? `El elemento ${del.id} «${del.label}»` : `La conexión ${del.id}`;
      const how = del.cascadedFrom ? `, eliminada en cascada al eliminar el elemento ${del.cascadedFrom.id}` : "";
      out.push(Object.assign({
        code:"REFERENCED_ENTITY",
        message:`${what} (página ${del.pageIndex}, operación ${del.operationIndex}: ${del.operation}${how}) sigue referenciad${del.kind==="node" ? "o" : "a"} por ${whoText(uses.affectedStories)}. Esas Historias quedarían inválidas: quita o redirige esos pasos (remove_step, retarget_step) en el mismo lote, o no lo elimines.`,
        operationIndex:del.operationIndex, operation:del.operation, pageIndex:del.pageIndex,
        entity:Object.assign({kind:del.kind, id:del.id}, del.kind==="node" ? {label:del.label} : {}),
        reason:"Los pasos de esas Historias apuntan a un elemento o conexión que ya no existe.",
        integrityCodes:[...new Set(errors.map(x=>x.code))]
      }, del.cascadedFrom ? {cascadedFrom:del.cascadedFrom} : {}, uses));
    }
    return out.concat(explain(rest));
  }

  /* ───────── API ───────── */
  function failure(errors){ return {ok:false, errors}; }
  function normalizedProject(project){
    try{
      const r = projectFromProjectData(project);
      return {ok:true, project:projectToSerializable(r.doc, r.settings)};
    }catch(e){ return {ok:false}; }
  }

  function apply(project, operations){
    if(!Array.isArray(operations) || !operations.length || operations.length>MAX_OPERATIONS)
      return failure([{code:"INVALID_OPERATION", message:`operations debe ser una lista de 1 a ${MAX_OPERATIONS} operaciones.`}]);
    let norm;
    try{ norm = projectFromProjectData(project); }
    catch(_){ return failure([{code:"DOCUMENT_UNREADABLE", message:"El documento no es legible: pide describe_document para ver los errores de validación."}]); }
    const baseline = FluyoIntegrity.validateProject(project);          // errores PREEXISTENTES: no se atribuyen al lote
    const d = norm.doc;                                                // copia profunda (projectFromProjectData no conserva la entrada)
    const ctx = {d, settings:norm.settings, watch:new Map(), countOps:{}, baseCounts:d.pages.map(pg=>({nodes:pg.nodes.length, edges:pg.edges.length})), refs:{stories:new Map(), steps:new Map(), eventTypes:new Map(), none:new Map()},
                diagramRefs:{nodes:new Map(), edges:new Map()}, created:[], deleted:[], touched:new Map(), opIndex:0,
                pages:d.pages.slice(), deletedPages:new Map()};
    const changes = [];

    for(let i=0; i<operations.length; i++){
      const op = operations[i];
      ctx.opIndex = i;
      try{
        if(!isRecord(op) || typeof op.op!=="string") throw reject("INVALID_OPERATION", "Cada operación debe ser un objeto con `op`.");
        const expected = OPERATION_SCOPE[op.op];
        if(!expected) throw reject("UNKNOWN_OPERATION", `Operación desconocida «${op.op}». Operaciones: ${Object.keys(OPERATION_SCOPE).join(", ")}.`, {operation:op.op});
        if(op.scope!==expected) throw reject("SCOPE_MISMATCH", `La operación ${op.op} es de alcance «${expected}» y se declaró «${op.scope}».`, {operation:op.op, expected, declared:op.scope});
        const documentLevel = expected==="eventType" || expected==="document";   // no llevan pageIndex propio (rename_page lo declara en sus campos)
        onlyKeys(op, (documentLevel ? ["op","scope"] : ["op","scope","pageIndex"]).concat(OPERATION_FIELDS[op.op]));
        const pg = documentLevel ? undefined : pageOf(ctx, op);   // los EventTypes y las páginas son del documento
        const r = HANDLERS[op.op](ctx, op, pg);
        changes.push(Object.assign({operation:op.op, scope:expected, operationIndex:i}, documentLevel ? {} : {pageIndex:op.pageIndex}, r));
      }catch(e){
        if(e && e.authoringErrors) return failure(e.authoringErrors.map(x=>Object.assign({operationIndex:i, operation:isRecord(op)?op.op:undefined}, x)));
        if(e && e.authoring) return failure([Object.assign({code:e.code, message:e.message, operationIndex:i, operation:isRecord(op)?op.op:undefined}, e.extra)]);
        if(e && typeof e.code==="string") return failure([{code:"INVALID_OPERATION", message:`La operación ${i} no es válida (${e.code}).`, operationIndex:i, operation:isRecord(op)?op.op:undefined, reason:e.code}]);
        throw e;
      }
    }

    // Topes de autoría sobre el estado final (no por operación): un lote que cruza un tope y vuelve a él es válido.
    const over = limitErrors(ctx, d);
    if(over.length) return failure(over);

    const finalProject = projectToSerializable(d, norm.settings);
    // Se evalúa el ESTADO FINAL, no cada paso intermedio. Sus errores se expresan en índices del lote (los del documento de entrada para
    // sus páginas): un error preexistente de una página que solo cambió de posición no se atribuye al lote.
    const checked = FluyoIntegrity.validateProject(finalProject);
    const after = Object.assign({}, checked, {errors:inBatch(ctx, checked.errors), stories:inBatch(ctx, checked.stories)});
    const known = new Set(baseline.errors.map(FluyoIntegrity.errorKey));
    const regress = after.errors.filter(e=>!known.has(FluyoIntegrity.errorKey(e)));
    if(regress.length) return failure(explainRemovals(ctx, regress));
    // Garantía: toda Historia que el lote creó o editó es ejecutable por Fluyo.
    const bad = [];
    for(const t of ctx.touched.values()){
      const st = after.stories.find(s=>s.pageIndex===t.pageIndex && s.storyId===t.storyId);
      if(st && !st.executable) bad.push({code:"STORY_NOT_EXECUTABLE", message:`La Historia ${t.storyId} (página ${t.pageIndex}) no sería ejecutable.`, pageIndex:t.pageIndex, storyId:t.storyId,
        integrityErrors:after.errors.filter(e=>e.pageIndex===t.pageIndex && e.storyId===t.storyId)});
    }
    if(bad.length) return failure(bad);

    // refs y touched describen el documento RESULTANTE: sus pageIndex son los finales (= pageMap[i].to); lo de páginas eliminadas no sale.
    // changes[] y los errores usan los índices del lote, los que escribió el agente.
    const refs = ctx.created.filter(c=>ctx.pages[c.pageIndex] && !ctx.deleted.some(x=>x.pageIndex===c.pageIndex && x.id===c.id && x.kind===(c.type==="node" ? "node" : "connection")))
      .map(c=>Object.assign({}, c, {pageIndex:liveIndexOf(ctx, c.pageIndex)}));
    const touched = [...ctx.touched.values()].map(t=>Object.assign({}, t, {pageIndex:liveIndexOf(ctx, t.pageIndex)}));
    return Object.assign({ok:true, project:finalProject, changes, refs, touched, validation:{valid:after.valid, preexistingErrors:after.errors.length}},
      ctx.deletedPages.size ? {pageMap:ctx.pages.map((pg, from)=>({from, to:pg ? ctx.d.pages.indexOf(pg) : null}))} : {});
  }

  return {apply, normalizedProject, OPERATION_SCOPE, MAX_OPERATIONS, LIMITS};
})();
