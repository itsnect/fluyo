"use strict";
/* FLUYO-017.1. Autoridad ÚNICA de integridad de un documento Fluyo.

   Compone, no reimplementa:
     · forma/ids/contadores  → projectFromProjectData (model.js)
     · estructura, Behaviors, referencias de Steps, tiempos, versión y límites
                              → FluyoScenarios.runScenario (el propio motor)
     · lo que ninguna capa comprobaba: EventTypes inexistentes y acciones
       incompatibles con su EventType.

   Puro: sin DOM, timers, almacenamiento ni estado del editor; no muta su entrada.
   Cargar tras model.js, scenario-engine.js y story-playback.js. Ejecutable en Node (vm).
   Lo usan fluyo-mcp (author_document, describe_document) y el editor (FLUYO-018.4: deleteSel consulta removalImpact antes de borrar).

   Resultado: {valid, schemaVersion, engineVersion, errors, stories}
     error = {code, message, scope, pageIndex?, storyId?, stepId?, entityId?, entityKind?, …}
     scope: "document" | "page" | "story" | "step".
     Las páginas no tienen id propio en el modelo: se identifican por su posición (pageIndex).
     storyId = id del Scenario (único por página). Los códigos del motor se conservan tal cual. */

var FluyoIntegrity = (function(){
  /* La acción y el tipo de objetivo de un EventType los decide model.js (eventTypeActionSpec): una sola regla. */
  const eventActionSpec = et => eventTypeActionSpec(et);

  const MESSAGES = {
    invalid_document: "El documento no tiene un formato válido.",
    unsupported_version: "La versión del documento no está soportada.",
    invalid_step: "Un evento de la historia tiene datos inválidos.",
    duplicate_story_id: "Hay historias con el mismo identificador en una página.",
    duplicate_event_type_id: "Hay eventos de la biblioteca con el mismo identificador.",
    invalid_event_type: "Un evento de la biblioteca tiene datos inválidos.",
    missing_event_type: "Un evento de la historia usa un tipo de evento que no existe en la biblioteca.",
    event_type_action_mismatch: "La acción de un evento no corresponde a su tipo de evento.",
    missing_behavior_node: "Un estado inicial apunta a un elemento que ya no existe.",
    duplicate_behavior_node: "Hay estados iniciales duplicados para un mismo elemento."
  };
  function messageFor(raw){
    if(MESSAGES[raw.code]) return MESSAGES[raw.code];
    return FluyoStory.errorMessages([raw])[0];
  }

  const isRecord = v => v!==null && typeof v==="object" && !Array.isArray(v);
  const clone = o => JSON.parse(JSON.stringify(o));

  function makeError(code, scope, where, extra){
    const e = {code, message:"", scope};
    if(where.pageIndex!==undefined) e.pageIndex = where.pageIndex;
    if(where.storyId!==undefined) e.storyId = where.storyId;
    if(where.stepId!==undefined) e.stepId = where.stepId;
    if(extra) for(const k of Object.keys(extra)) if(extra[k]!==undefined) e[k] = extra[k];
    e.message = messageFor(e);
    return e;
  }

  /* Error del motor → error estructurado. Los de estructura/Behaviors son de página; el resto
     (paths «scenario…», «runtime…», «trace…») son de la Historia o de un Step. */
  const isPageLevel = raw => /^(structure|behaviors)/.test(raw.path || "");
  function fromEngine(raw, pageIndex, storyId){
    const pageLevel = isPageLevel(raw);
    const where = pageLevel ? {pageIndex} : {pageIndex, storyId, stepId:raw.stepId};
    const scope = pageLevel ? "page" : (raw.stepId!==undefined ? "step" : "story");
    let entityId, entityKind;
    if(raw.edgeId!==undefined){ entityId = raw.edgeId; entityKind = "edge"; }
    else if(raw.nodeId!==undefined){ entityId = raw.nodeId; entityKind = "node"; }
    return makeError(raw.code, scope, where, {entityId, entityKind, path:raw.path, limit:raw.limit, reason:raw.reason, endpoint:raw.endpoint});
  }

  /* Cuando la normalización falla no hay documento utilizable: se localiza qué entidad la rompió
     reutilizando las propias funciones de model.js sobre COPIAS aisladas (un elemento, un Step, una
     Historia, un EventType cada vez) y, si no se encuentra nada, se informa del documento en conjunto.
     Sólo los duplicados de id se comprueban aquí (model.js los rechaza con un throw sin localizar). */
  function diagnose(project, thrown){
    if(thrown && thrown.code==="unsupported_version") return [makeError("unsupported_version","document",{}, {})];
    const errors = [];
    const d = isRecord(project) && isRecord(project.doc) ? project.doc : null;
    const tryRule = fn => { try{ fn(); return true; }catch(_){ return false; } };
    if(d && Array.isArray(d.eventTypes)){
      const seen = new Set();
      d.eventTypes.forEach((et, i)=>{
        const id = isRecord(et) ? et.id : undefined;
        if(!tryRule(()=>validateEventType(clone(et))))
          errors.push(makeError("invalid_event_type","document",{}, {entityId:id, entityKind:"eventType", path:`eventTypes[${i}]`}));
        else if(seen.has(id))
          errors.push(makeError("duplicate_event_type_id","document",{}, {entityId:id, entityKind:"eventType", path:`eventTypes[${i}]`}));
        seen.add(id);
      });
    }
    if(d && Array.isArray(d.pages)){
      d.pages.forEach((pg, pageIndex)=>{
        if(!isRecord(pg)) return;
        if(Array.isArray(pg.nodes) && Array.isArray(pg.edges)){
          const nodeIds = new Set(), seen = new Set();
          for(const [kind, list] of [["node", pg.nodes], ["edge", pg.edges]]) list.forEach((item, i)=>{
            if(!tryRule(()=>normalizeProjectItem(clone(item)))){
              errors.push(makeError("invalid_structure","page",{pageIndex}, {entityId:isRecord(item)?item.id:undefined, entityKind:kind, path:`${kind}s[${i}]`}));
              return;
            }
            if(seen.has(item.id)){
              const code = kind==="node" ? "duplicate_node_id" : (nodeIds.has(item.id) ? "duplicate_structure_id" : "duplicate_edge_id");
              errors.push(makeError(code, "page", {pageIndex}, {entityId:item.id, entityKind:kind}));
            }
            seen.add(item.id); if(kind==="node") nodeIds.add(item.id);
          });
        }
        if(Array.isArray(pg.behaviors)) pg.behaviors.forEach((b, i)=>{
          if(!tryRule(()=>normalizeBehaviors({behaviors:[clone(b)]})))
            errors.push(makeError("invalid_behavior","page",{pageIndex}, {entityId:isRecord(b)?b.nodeId:undefined, entityKind:"node", path:`behaviors[${i}]`}));
        });
        if(!Array.isArray(pg.scenarios)) return;
        const storyIds = new Set();
        pg.scenarios.forEach(sc=>{
          if(!isRecord(sc)){ errors.push(makeError("invalid_scenario","story",{pageIndex}, {})); return; }
          if(storyIds.has(sc.id)) errors.push(makeError("duplicate_story_id","story",{pageIndex, storyId:sc.id}, {}));
          storyIds.add(sc.id);
          const before = errors.length;
          if(Array.isArray(sc.steps)){
            const stepIds = new Set();
            sc.steps.forEach((step, i)=>{
              const where = {pageIndex, storyId:sc.id, stepId:isRecord(step)?step.id:undefined};
              if(!tryRule(()=>validatePersistedStep(clone(step), sc.engineVersion)))
                errors.push(makeError("invalid_step","step",where,{path:`scenarios.steps[${i}]`}));
              else if(stepIds.has(step.id)) errors.push(makeError("duplicate_step_id","step",where,{path:`scenarios.steps[${i}]`}));
              else stepIds.add(step.id);
            });
          }
          // Nombre, versión de motor, forma de la lista y acciones permitidas por versión (model.js, aislado).
          if(errors.length===before && !tryRule(()=>normalizeScenarios({scenarios:[clone(sc)]})))
            errors.push(makeError("invalid_scenario","story",{pageIndex, storyId:sc.id}, {}));
        });
      });
    }
    if(!errors.length) errors.push(makeError("invalid_document","document",{}, {reason:thrown && thrown.code}));
    return errors;
  }

  /* Referencias a EventTypes y compatibilidad acción ↔ EventType, por Step. */
  function eventTypeErrors(doc, pageIndex, sc){
    const errors = [];
    const byId = new Map(doc.eventTypes.map(et=>[et.id, et]));
    for(const step of sc.steps){
      if(step.eventTypeId===undefined) continue;
      const where = {pageIndex, storyId:sc.id, stepId:step.id};
      const et = byId.get(step.eventTypeId);
      if(!et){ errors.push(makeError("missing_event_type","step",where,{entityId:step.eventTypeId, entityKind:"eventType"})); continue; }
      const spec = eventActionSpec(et);
      if(!spec || spec.action!==step.action)
        errors.push(makeError("event_type_action_mismatch","step",where,{entityId:et.id, entityKind:"eventType", reason:"action"}));
      else if(spec.action==="SET_STATE" && step.state!==spec.state)
        errors.push(makeError("event_type_action_mismatch","step",where,{entityId:et.id, entityKind:"eventType", reason:"availability"}));
    }
    return errors;
  }

  function validateProject(project){
    const out = {valid:false, schemaVersion: isRecord(project) && Number.isInteger(project.version) ? project.version : null,
                 engineVersion: FluyoScenarios.ENGINE_VERSION, errors:[], stories:[]};
    let doc;
    try{ doc = projectFromProjectData(project).doc; }
    catch(thrown){ out.errors = diagnose(project, thrown); return out; }

    doc.pages.forEach((pg, pageIndex)=>{
      const structure = {nodes:pg.nodes, edges:pg.edges};
      /* Estructura y Behaviors se comprueban una vez por página con una Historia vacía de sonda,
         así también se validan las páginas sin Historias. */
      const probe = {id:1, engineVersion:FluyoScenarios.ENGINE_VERSION, name:"probe", nextStepId:1, steps:[]};
      const pageResult = FluyoScenarios.runScenario(structure, pg.behaviors, probe);
      if(!pageResult.ok) for(const raw of pageResult.errors) out.errors.push(fromEngine(raw, pageIndex));
      for(const sc of pg.scenarios){
        const result = FluyoScenarios.runScenario(structure, pg.behaviors, sc);
        const storyErrors = [];
        if(!result.ok) for(const raw of result.errors) if(!isPageLevel(raw)) storyErrors.push(fromEngine(raw, pageIndex, sc.id));
        storyErrors.push(...eventTypeErrors(doc, pageIndex, sc));
        out.errors.push(...storyErrors);
        out.stories.push({pageIndex, storyId:sc.id, executable: result.ok && storyErrors.length===0});
      }
    });
    out.valid = out.errors.length===0;
    return out;
  }

  /* B2 (detección, FLUYO-017.1): ¿qué quedaría inválido si se quitaran estos elementos?
     Simula sobre una COPIA lo que hacen deleteSel (editor) y delete_node (MCP): quitar los nodos y toda conexión
     que los toque, más las conexiones indicadas. FLUYO-017.3: también puede quitar EventTypes (eventTypeIds).
     No toca Steps (que es lo que deja huérfanos) ni Behaviors: el Behavior del nodo se va con él (018.4) y su
     ausencia no cambia el resultado por Historia. No modifica el proyecto recibido ni decide qué hacer. */
  function errorKey(e){ return [e.code, e.pageIndex, e.storyId, e.stepId, e.entityKind, e.entityId].join("|"); }

  /* Errores NUEVOS de `after` respecto a `before`, agrupados por Historia (con sus Steps y códigos). */
  function impactBetween(before, after, copy){
    const known = new Set(before.errors.map(errorKey));
    const errors = after.errors.filter(e=>!known.has(errorKey(e)));
    const pages = (copy && copy.doc && copy.doc.pages) || [];
    const grouped = new Map();
    for(const e of errors){
      if(e.storyId===undefined) continue;
      const key = e.pageIndex + ":" + e.storyId;
      if(!grouped.has(key)){
        const sc = ((pages[e.pageIndex] && pages[e.pageIndex].scenarios) || []).find(x=>x.id===e.storyId);
        grouped.set(key, {pageIndex:e.pageIndex, storyId:e.storyId, storyName:sc && sc.name, stepIds:[], codes:[]});
      }
      const g = grouped.get(key);
      if(e.stepId!==undefined && !g.stepIds.includes(e.stepId)) g.stepIds.push(e.stepId);
      if(!g.codes.includes(e.code)) g.codes.push(e.code);
    }
    return {wouldInvalidate: errors.length>0, errors, affectedStories:[...grouped.values()]};
  }
  function removalImpact(project, removal){
    const list = v => Array.isArray(v) ? v : [];          // un argumento mal formado no lanza: no quita nada
    const nodeIds = new Set(list(removal && removal.nodeIds));
    const edgeIds = new Set(list(removal && removal.edgeIds));
    const eventTypeIds = new Set(list(removal && removal.eventTypeIds));
    const pageIndex = removal && removal.pageIndex;
    const before = validateProject(project);
    const copy = clone(project);
    const eventTypesOnly = eventTypeIds.size>0 && !nodeIds.size && !edgeIds.size && pageIndex===undefined;
    if(!eventTypesOnly){
      const pg = copy && copy.doc && copy.doc.pages && copy.doc.pages[pageIndex];
      if(!pg) return {wouldInvalidate:false, error:"page_not_found", errors:[], affectedStories:[]};
      pg.edges = pg.edges.filter(e=>!edgeIds.has(e.id) && !nodeIds.has(e.from) && !nodeIds.has(e.to));
      pg.nodes = pg.nodes.filter(n=>!nodeIds.has(n.id));
    }
    if(eventTypeIds.size && copy && copy.doc && Array.isArray(copy.doc.eventTypes))
      copy.doc.eventTypes = copy.doc.eventTypes.filter(et=>!(et && eventTypeIds.has(et.id)));
    return impactBetween(before, validateProject(copy), copy);
  }

  /* FLUYO-017.3. ¿Qué quedaría inválido si este EventType desapareciera (candidate = null) o se
     reemplazara por `candidate` (conservando su id)? Es lo que explica un borrado o un cambio de
     primitiva/disponibilidad de un evento usado: los Steps que lo referencian quedarían con un
     EventType inexistente o con una acción incompatible. Sobre una COPIA; no decide nada. */
  function eventTypeImpact(project, eventTypeId, candidate){
    const before = validateProject(project);
    const copy = clone(project);
    const eventTypes = copy && copy.doc && copy.doc.eventTypes;
    const i = Array.isArray(eventTypes) ? eventTypes.findIndex(et=>isRecord(et) && et.id===eventTypeId) : -1;
    if(i<0) return {wouldInvalidate:false, error:"event_type_not_found", errors:[], affectedStories:[]};
    if(candidate===null) eventTypes.splice(i, 1);
    else eventTypes[i] = Object.assign({}, clone(candidate), {id:eventTypeId});
    return impactBetween(before, validateProject(copy), copy);
  }

  return {validateProject, removalImpact, eventTypeImpact, eventActionSpec, errorKey};
})();
