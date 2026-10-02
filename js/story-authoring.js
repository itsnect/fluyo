"use strict";
/* FLUYO-017.2 / 017.3. Autoría de Historias y EventTypes sobre un documento: UN lote atómico de operaciones sobre una COPIA.

   Compone, no reimplementa:
     · las funciones de model.js que ya usa el editor (createScenario, duplicateScenario, createStep,
       storyboard*, stepDefinitionForEvent, storyboardSetWait, duplicateStep, retargetStep, setInitialAvailability,
       createEventTypeIn, updateEventTypeIn, deleteEventTypeIn, eventTypeDefinition: las mismas que ejecuta el editor);
     · FluyoIntegrity (la autoridad de integridad) sobre el ESTADO FINAL del lote y para explicar qué rompería
       borrar o cambiar un EventType usado.
   Aquí sólo viven la forma de las operaciones, la resolución de referencias del lote (`ref`) y la explicación
   estructurada de por qué se rechaza algo. Ninguna regla de tiempo, acción, destino, EventType ni integridad.

   Puro: sin DOM, timers, estado global ni E/S; no muta el proyecto recibido. NO usa ni modifica la global `doc`.
   Cargar tras model.js, scenario-engine.js, story-playback.js y document-integrity.js. Ejecutable en Node (vm).

   apply(project, operations) → {ok:true, project, changes[], touched[], validation} | {ok:false, errors[]}
   Si una sola operación o la validación final falla NO se devuelve ningún documento. */

var FluyoAuthoring = (function(){
  /* Cada operación tiene UN alcance por definición; el lote debe declararlo y se verifica. */
  const OPERATION_SCOPE = {
    create_story:"story", rename_story:"story", duplicate_story:"story", delete_story:"story",
    add_step:"story", remove_step:"story", move_step:"story", duplicate_step:"story", retarget_step:"story", set_wait:"story",
    set_initial_availability:"page",
    create_event_type:"eventType", update_event_type:"eventType", delete_event_type:"eventType"
  };
  const MAX_OPERATIONS = 200;
  /* Campos permitidos por operación (además de op, scope y pageIndex). Un campo desconocido se rechaza:
     p. ej. nadie puede escribir `action`, `state` ni `at` en un paso; el EventType y las esperas lo deciden. */
  const OPERATION_FIELDS = {
    create_story:["name","ref"], rename_story:["storyId","name"], duplicate_story:["storyId","name","ref"], delete_story:["storyId"],
    add_step:["storyId","eventTypeId","target","waitMs","placement","ref"], remove_step:["storyId","stepId"],
    move_step:["storyId","stepId","direction","to"], duplicate_step:["storyId","stepId","ref"],
    retarget_step:["storyId","stepId","target"], set_wait:["storyId","stepId","waitMs"],
    set_initial_availability:["nodeId","state"],
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
  function pageOf(ctx, op){
    if(!Number.isSafeInteger(op.pageIndex) || op.pageIndex<0) throw reject("INVALID_OPERATION", "pageIndex debe ser un entero ≥ 0.", {field:"pageIndex"});
    const pg = ctx.d.pages[op.pageIndex];
    if(!pg) throw reject("PAGE_NOT_FOUND", `pageIndex ${op.pageIndex} fuera de rango (el documento tiene ${ctx.d.pages.length} página(s)).`, {pageIndex:op.pageIndex});
    return pg;
  }
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
  function targetOf(pg, kind, target){
    if(!isRecord(target)) throw reject("INVALID_OPERATION", "target debe ser {edgeId} | {nodeId} | {from, to}.", {field:"target"});
    onlyKeys(target, ["edgeId","nodeId","from","to"], "target");
    const forms = ["edgeId","nodeId"].filter(k=>target[k]!==undefined).length + (target.from!==undefined || target.to!==undefined ? 1 : 0);
    if(forms!==1) throw reject("INVALID_OPERATION", "target debe tener exactamente una forma: {edgeId} | {nodeId} | {from, to}.", {field:"target"});
    const need = kind==="connection" ? "una conexión (edgeId o from/to)" : "un elemento (nodeId)";
    if(target.edgeId!==undefined || (target.from!==undefined || target.to!==undefined)){
      if(kind!=="connection") throw reject("TARGET_INCOMPATIBLE", `Esta acción necesita ${need}, no una conexión.`, {target});
      if(target.edgeId!==undefined){
        if(!isId(target.edgeId) || !pg.edges.some(e=>e.id===target.edgeId)) throw reject("TARGET_NOT_FOUND", `No existe la conexión edgeId=${target.edgeId} en la página.`, {target});
        return target.edgeId;
      }
      if(!isId(target.from) || !isId(target.to)) throw reject("INVALID_OPERATION", "from y to deben ser ids de elemento.", {field:"target"});
      const hits = pg.edges.filter(e=>e.from===target.from && e.to===target.to);
      if(!hits.length) throw reject("TARGET_NOT_FOUND", `No existe una conexión de ${target.from} a ${target.to}.`, {target});
      if(hits.length>1) throw reject("AMBIGUOUS_TARGET", `Hay ${hits.length} conexiones de ${target.from} a ${target.to} (${hits.map(e=>e.id).join(", ")}): usa edgeId.`, {target, edgeIds:hits.map(e=>e.id)});
      return hits[0].id;
    }
    if(kind!=="element") throw reject("TARGET_INCOMPATIBLE", `Esta acción necesita ${need}, no un elemento.`, {target});
    if(!isId(target.nodeId) || !pg.nodes.some(n=>n.id===target.nodeId)) throw reject("TARGET_NOT_FOUND", `No existe el elemento nodeId=${target.nodeId} en la página.`, {target});
    return target.nodeId;
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
  function usageErrors(errors, d){
    const stories = [], steps = [];
    for(const e of errors){
      if(e.storyId===undefined) continue;
      let s = stories.find(x=>x.pageIndex===e.pageIndex && x.storyId===e.storyId);
      if(!s){
        const sc = d.pages[e.pageIndex] && d.pages[e.pageIndex].scenarios.find(x=>x.id===e.storyId);
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
    const found = usageErrors(impact.errors, ctx.d);
    const use = eventTypeUsagesIn(ctx.d, et.id);
    const uses = found.affectedStories.length ? found : {affectedStories:use.map(u=>({pageIndex:u.pageIndex, storyId:u.storyId, storyName:u.storyName, stepIds:u.stepIds})),
                               affectedSteps:use.flatMap(u=>u.stepIds.map(stepId=>({pageIndex:u.pageIndex, storyId:u.storyId, stepId})))};
    const detail = code==="REFERENCED_ENTITY"
      ? `El evento ${et.id} «${et.name}» sigue referenciado por ${whoText(uses.affectedStories)}: no se puede eliminar mientras se use. Quita esos pasos (remove_step) antes de eliminarlo, en el mismo lote o antes.`
      : `El evento ${et.id} «${et.name}» se usa en ${whoText(uses.affectedStories)}: su ${field==="primitive" ? "primitiva (dónde ocurre y qué acción es)" : "disponibilidad (la que provoca)"} no se puede cambiar mientras se use. Crea otro evento para el otro comportamiento.`;
    return reject(code, detail, Object.assign({entity:{kind:"eventType", id:et.id, name:et.name}, integrityCodes:[...new Set(impact.errors.map(e=>e.code))]}, field ? {field} : {}, uses));
  }

  const HANDLERS = {
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
      const targetId = targetOf(pg, spec.target, op.target);
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
      const targetId = targetOf(pg, kind, op.target);
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
      const nodeId = ctxRef(ctx, "none", op.nodeId, "nodeId").id;
      if(!pg.nodes.some(n=>n.id===nodeId)) throw reject("TARGET_NOT_FOUND", `No existe el elemento nodeId=${nodeId} en la página.`, {nodeId});
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
      const uses = eventTypeUsagesIn(ctx.d, et.id);
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
    const ctx = {d, settings:norm.settings, refs:{stories:new Map(), steps:new Map(), eventTypes:new Map(), none:new Map()}, touched:new Map(), opIndex:0};
    const changes = [];

    for(let i=0; i<operations.length; i++){
      const op = operations[i];
      ctx.opIndex = i;
      try{
        if(!isRecord(op) || typeof op.op!=="string") throw reject("INVALID_OPERATION", "Cada operación debe ser un objeto con `op`.");
        const expected = OPERATION_SCOPE[op.op];
        if(!expected) throw reject("UNKNOWN_OPERATION", `Operación desconocida «${op.op}». Operaciones: ${Object.keys(OPERATION_SCOPE).join(", ")}.`, {operation:op.op});
        if(op.scope!==expected) throw reject("SCOPE_MISMATCH", `La operación ${op.op} es de alcance «${expected}» y se declaró «${op.scope}».`, {operation:op.op, expected, declared:op.scope});
        onlyKeys(op, (expected==="eventType" ? ["op","scope"] : ["op","scope","pageIndex"]).concat(OPERATION_FIELDS[op.op]));
        const pg = expected==="eventType" ? undefined : pageOf(ctx, op);   // los EventTypes son del documento, no de una página
        const r = HANDLERS[op.op](ctx, op, pg);
        changes.push(Object.assign({operation:op.op, scope:expected, operationIndex:i}, expected==="eventType" ? {} : {pageIndex:op.pageIndex}, r));
      }catch(e){
        if(e && e.authoringErrors) return failure(e.authoringErrors.map(x=>Object.assign({operationIndex:i, operation:isRecord(op)?op.op:undefined}, x)));
        if(e && e.authoring) return failure([Object.assign({code:e.code, message:e.message, operationIndex:i, operation:isRecord(op)?op.op:undefined}, e.extra)]);
        if(e && typeof e.code==="string") return failure([{code:"INVALID_OPERATION", message:`La operación ${i} no es válida (${e.code}).`, operationIndex:i, operation:isRecord(op)?op.op:undefined, reason:e.code}]);
        throw e;
      }
    }

    const finalProject = projectToSerializable(d, norm.settings);
    const after = FluyoIntegrity.validateProject(finalProject);        // se evalúa el ESTADO FINAL, no cada paso intermedio
    const known = new Set(baseline.errors.map(FluyoIntegrity.errorKey));
    const regress = after.errors.filter(e=>!known.has(FluyoIntegrity.errorKey(e)));
    if(regress.length) return failure(explain(regress));
    // Garantía: toda Historia que el lote creó o editó es ejecutable por Fluyo.
    const bad = [];
    for(const t of ctx.touched.values()){
      const st = after.stories.find(s=>s.pageIndex===t.pageIndex && s.storyId===t.storyId);
      if(st && !st.executable) bad.push({code:"STORY_NOT_EXECUTABLE", message:`La Historia ${t.storyId} (página ${t.pageIndex}) no sería ejecutable.`, pageIndex:t.pageIndex, storyId:t.storyId,
        integrityErrors:after.errors.filter(e=>e.pageIndex===t.pageIndex && e.storyId===t.storyId)});
    }
    if(bad.length) return failure(bad);

    return {ok:true, project:finalProject, changes, touched:[...ctx.touched.values()],
            validation:{valid:after.valid, preexistingErrors:after.errors.length}};
  }

  return {apply, normalizedProject, OPERATION_SCOPE, MAX_OPERATIONS};
})();
