"use strict";
/* Derivación de la disponibilidad de un flujo (SCENARIOS-SEMANTICS-001, FASE 2; decisiones 219–220 y 223–225).
   Contrato congelado: .ai/tasks/FLUYO-SCENARIOS-SEMANTICS-001.md § «FASE 2 — FROZEN SEMANTIC CONTRACT».

   Puro: sin DOM, timers, azar ni estado; nada se persiste. Depende solo de edgeKind (model.js, el único lector de `kind`).
   En FASE 2 la app no lo carga (ni index.html, ni s/index.html, ni el precache): lo cablea FASE 3.

     estructura: G = conexiones con edgeKind(e) === "FLOWS_TO", de from a to (Conexión y Requisito no existen aquí;
                 las puntas visibles y flowDir no cuentan)
     estado:     {nodeId: "UP" | "DOWN"}  — el vocabulario del motor (UP = AVAILABLE, DOWN = UNAVAILABLE)

     flowStatus  NO_PATH      no hay camino en G de source a target (solo estructura; «Sin ruta de flujo»)
                 AVAILABLE    hay un camino en G con TODOS sus nodos UP (origen, intermedios y destino)
                 [UNKNOWN]    reservado: ningún camino AVAILABLE y alguno sin DOWN pero con UNKNOWN (inalcanzable: UNKNOWN se rechaza)
                 UNAVAILABLE  hay camino en G, pero todos tienen algún nodo DOWN
     source === target es el camino trivial que contiene solo ese nodo: nunca NO_PATH.

   Exacto y sin enumerar caminos: «existe un camino cuyos nodos cumplen P» es alcanzabilidad en G restringido a los nodos que
   cumplen P (un camino simple existe si y solo si hay alcanzabilidad). Una búsqueda en anchura con conjunto de visitados por
   consulta: O(V + E), sin tope, termina con ciclos y su respuesta (pertenencia) no depende del orden de nada.

   Errores {code, field}, como projectDataError: invalid_document · node_not_found · missing_edge_endpoint · invalid_availability ·
   invalid_provenance. Nada se adivina ni se coacciona: UNKNOWN o un valor mal formado es invalid_availability. */
var FluyoFlow = (function(){
  const UP = "UP", DOWN = "DOWN";
  const AVAILABLE = "AVAILABLE", UNAVAILABLE = "UNAVAILABLE", NO_PATH = "NO_PATH";
  const UNKNOWN = "UNKNOWN";   // reservado (D3): nombrado para no colisionar con el futuro; ninguna función lo devuelve ni lo acepta
  const EXPLICIT = "EXPLICIT", DEFAULT = "DEFAULT";
  const FLOWS_TO = "FLOWS_TO";

  function flowError(code, field){
    const e = new Error(code + (field !== undefined ? ": " + field : ""));
    e.code = code; if(field !== undefined) e.field = field;
    return e;
  }
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

  function checkPage(page){
    if(!page || typeof page !== "object" || !Array.isArray(page.nodes) || !Array.isArray(page.edges)) throw flowError("invalid_document", "page");
    if(page.behaviors !== undefined && !Array.isArray(page.behaviors)) throw flowError("invalid_document", "page");
  }
  function nodeIds(page){ return new Set(page.nodes.map(n => n && n.id)); }
  /* Solo UP o DOWN; UNKNOWN y cualquier otra cosa se rechazan (nunca se coaccionan a disponible, no disponible ni por defecto). */
  function availabilityValue(v, nodeId){
    if(v !== UP && v !== DOWN) throw flowError("invalid_availability", String(nodeId));
    return v;
  }
  function checkTime(t){ if(typeof t !== "number" || !Number.isFinite(t)) throw flowError("invalid_document", "t"); }

  /* Adyacencia de G. Una conexión FLOWS_TO con un extremo que no existe hace inválida la consulta; las demás no se miran. */
  function flowGraph(page, ids){
    const adj = new Map();
    for(const e of page.edges){
      if(!e || typeof e !== "object") throw flowError("invalid_document", "edges");
      if(e.kind !== undefined && typeof e.kind !== "string") throw flowError("invalid_document", "kind");
      if(edgeKind(e) !== FLOWS_TO) continue;
      if(!ids.has(e.from) || !ids.has(e.to)) throw flowError("missing_edge_endpoint", "edges");
      if(!adj.has(e.from)) adj.set(e.from, []);
      adj.get(e.from).push(e.to);
    }
    return adj;
  }
  /* ¿target es alcanzable desde source por G pasando solo por nodos que cumplen `pass` (los extremos incluidos)? */
  function reaches(adj, source, target, pass){
    if(!pass(source)) return false;
    const seen = new Set([source]), queue = [source];
    for(let i = 0; i < queue.length; i++){
      const at = queue[i];
      if(at === target) return true;
      for(const n of adj.get(at) || []){
        if(seen.has(n)) continue;
        if(!pass(n)) continue;
        seen.add(n); queue.push(n);
      }
    }
    return false;
  }
  function endpoints(page, source, target){
    checkPage(page);
    const ids = nodeIds(page);
    if(!ids.has(source)) throw flowError("node_not_found", "source");
    if(!ids.has(target)) throw flowError("node_not_found", "target");
    return ids;
  }
  /* El mapa de estados debe cubrir todos los nodos de la página (sin huecos que adivinar). */
  function checkStates(page, states){
    if(!states || typeof states !== "object") throw flowError("invalid_document", "states");
    for(const n of page.nodes) availabilityValue(own(states, n.id) ? states[n.id] : undefined, n.id);
  }

  function status(page, source, target, states){
    const ids = endpoints(page, source, target);
    checkStates(page, states);
    const adj = flowGraph(page, ids);
    if(!reaches(adj, source, target, () => true)) return {status: NO_PATH, adj};
    if(reaches(adj, source, target, id => states[id] === UP)) return {status: AVAILABLE, adj};
    /* aquí iría el UNKNOWN reservado: reaches(adj, source, target, id => states[id] === UP || states[id] === UNKNOWN) */
    return {status: UNAVAILABLE, adj};
  }

  function flowStatus(page, source, target, states){ return status(page, source, target, states).status; }

  /* Estado + el dato para «incluye estados por defecto»: explicitPath = existe un camino AVAILABLE con todos sus nodos EXPLICIT
     (null si el estado no es AVAILABLE). No es un cuarto estado y no cambia el estado. */
  function flowAvailability(page, source, target, states, provenance){
    const r = status(page, source, target, states);
    if(!provenance || typeof provenance !== "object") throw flowError("invalid_document", "provenance");
    for(const n of page.nodes){
      const p = own(provenance, n.id) ? provenance[n.id] : undefined;
      if(p !== EXPLICIT && p !== DEFAULT) throw flowError("invalid_provenance", String(n.id));
    }
    if(r.status !== AVAILABLE) return {status: r.status, explicitPath: null};
    return {status: AVAILABLE, explicitPath: reaches(r.adj, source, target, id => states[id] === UP && provenance[id] === EXPLICIT)};
  }

  /* Disponibilidad visible en t con la misma regla que el motor y el Playback: todo UP (buildInitialStates), luego los Behaviors
     de la página, luego los `state_changed` del Trace con at <= t en su orden (el Trace ya está ordenado). FASE 3 pasará el Trace
     visible (FluyoStoryClock). */
  function availabilityAt(page, events, t){
    checkPage(page); checkTime(t);
    if(!Array.isArray(events)) throw flowError("invalid_document", "events");
    const ids = nodeIds(page), s = {};
    for(const n of page.nodes) s[n.id] = UP;
    for(const b of page.behaviors || []){
      if(!b || !ids.has(b.nodeId)) throw flowError("node_not_found", "behaviors");
      s[b.nodeId] = availabilityValue(b.initialState, b.nodeId);
    }
    for(const ev of events){
      if(!ev || ev.type !== "state_changed") continue;
      if(!(ev.at <= t)) continue;
      if(!ids.has(ev.nodeId)) throw flowError("node_not_found", "events");
      s[ev.nodeId] = availabilityValue(ev.to, ev.nodeId);
    }
    return s;
  }

  /* Procedencia en t (decisión 220): EXPLICIT si hay una afirmación aplicable del usuario —un Behavior de la página (Condiciones),
     cualquier valor, desde el inicio; o un SET_STATE sobre el nodo con timeOf(step) <= t, cambie o no el valor—; si no, DEFAULT.
     La última afirmación decide el VALOR (motor); como todas son del usuario, la procedencia no vuelve a DEFAULT. Se leen los
     Steps y no el Trace porque el motor no emite una afirmación que no cambia el valor. timeOf: instante visible (FASE 3:
     FluyoStoryClock.visibleAt); por defecto step.at. */
  function availabilityProvenance(page, steps, t, timeOf){
    checkPage(page); checkTime(t);
    if(!Array.isArray(steps)) throw flowError("invalid_document", "steps");
    const ids = nodeIds(page), when = typeof timeOf === "function" ? timeOf : (st => st.at), p = {};
    for(const n of page.nodes) p[n.id] = DEFAULT;
    for(const b of page.behaviors || []){
      if(!b || !ids.has(b.nodeId)) throw flowError("node_not_found", "behaviors");
      availabilityValue(b.initialState, b.nodeId);
      p[b.nodeId] = EXPLICIT;
    }
    for(const st of steps){
      if(!st || st.action !== "SET_STATE") continue;
      availabilityValue(st.state, st.nodeId);
      if(!ids.has(st.nodeId)) throw flowError("node_not_found", "steps");
      if(when(st) <= t) p[st.nodeId] = EXPLICIT;
    }
    return p;
  }

  return {AVAILABLE, UNAVAILABLE, NO_PATH, UNKNOWN, EXPLICIT, DEFAULT,
          availabilityAt, flowStatus, flowAvailability, availabilityProvenance};
})();
