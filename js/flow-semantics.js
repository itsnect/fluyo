"use strict";
/* Derivación de la disponibilidad de un flujo (SCENARIOS-SEMANTICS-001, FASE 2; decisiones 219–220 y 223–225).
   Contrato congelado: .ai/tasks/FLUYO-SCENARIOS-SEMANTICS-001.md § «FASE 2 — FROZEN SEMANTIC CONTRACT».

   Puro: sin DOM, timers, azar ni estado; nada se persiste. Depende solo de edgeKind (model.js, el único lector de `kind`).
   FASE 3 (decisiones 230 y 232) lo cablea en el editor (index.html y precache; el Viewer no lo carga) y añade la ruta observada
   de una Historia: resolveObservedFlow (qué par se observa) y observedFlowAt (su estado en un instante). Las funciones de
   FASE 2 no cambian. FASE 4 (decisiones 241–244) añade lo que se pinta y se cuenta de la ruta: flowRoute, routeEdgeStates,
   routeTimeline y routePaths; tampoco cambian el estado.

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

  /* ─────────── FASE 3 — Ruta observada de una Historia (D5, D-Ruta) ───────────
     Resolución (resolveObservedFlow), determinista e igual en todas las superficies:
       1. scenario.observedFlow con sus dos nodos en la página → PAIR, origen "story";
       2. observedFlow con algún extremo que no existe → ENDPOINT_MISSING (missing: "from"/"to"); NO se cae al par estructural,
          para no observar otra cosa en silencio;
       3. sin observedFlow → PAIR "structural" si en G hay exactamente un nodo sin entradas y exactamente uno sin salidas;
       4. si no → NO_PAIR.
     ENDPOINT_MISSING y NO_PAIR son estados de la herramienta, no de la ruta: no tienen estado de ruta (status null). */
  const PAIR = "PAIR", ENDPOINT_MISSING = "ENDPOINT_MISSING", NO_PAIR = "NO_PAIR";
  const isId = v => Number.isSafeInteger(v) && v >= 1;

  /* Nodos que participan en alguna conexión FLOWS_TO, en orden del documento. */
  function flowNodes(page){
    checkPage(page);
    const adj = flowGraph(page, nodeIds(page)), on = new Set();
    for(const [from, tos] of adj){ on.add(from); for(const to of tos) on.add(to); }
    return page.nodes.filter(n => on.has(n.id)).map(n => n.id);
  }

  function resolveObservedFlow(page, scenario){
    checkPage(page);
    const ids = nodeIds(page);
    const f = scenario ? scenario.observedFlow : undefined;
    if(f !== undefined){
      if(!f || typeof f !== "object" || Array.isArray(f) || !isId(f.from) || !isId(f.to) || f.from === f.to) throw flowError("invalid_document", "observedFlow");
      const missing = ["from", "to"].filter(k => !ids.has(f[k]));
      return {state: missing.length ? ENDPOINT_MISSING : PAIR, origin: "story", source: f.from, target: f.to, missing};
    }
    const adj = flowGraph(page, ids), on = new Set(), hasIn = new Set();
    for(const [from, tos] of adj){ on.add(from); for(const to of tos){ on.add(to); hasIn.add(to); } }
    const sources = page.nodes.filter(n => on.has(n.id) && !hasIn.has(n.id)).map(n => n.id);
    const sinks = page.nodes.filter(n => on.has(n.id) && !adj.has(n.id)).map(n => n.id);
    if(sources.length === 1 && sinks.length === 1) return {state: PAIR, origin: "structural", source: sources[0], target: sinks[0], missing: []};
    return {state: NO_PAIR, origin: null, source: null, target: null, missing: []};
  }

  /* Estado de la ruta observada en t, con el reloj que proyecta la Historia: events = Trace VISIBLE (FluyoStoryClock) y
     timeOf(step) = instante visible del Step (FluyoStoryClock.visibleAt; por defecto step.at). Es la composición de FASE 2:
     availabilityAt + availabilityProvenance + flowAvailability. Devuelve {pair, status, explicitPath}; sin PAIR, status y
     explicitPath son null. «Incluye estados por defecto» = status AVAILABLE y explicitPath false. */
  function observedFlowAt(page, scenario, events, t, timeOf){
    const pair = resolveObservedFlow(page, scenario);
    if(pair.state !== PAIR) return {pair, status: null, explicitPath: null};
    const steps = scenario ? scenario.steps : [];
    const states = availabilityAt(page, events, t);
    const provenance = availabilityProvenance(page, steps, t, timeOf);
    const r = flowAvailability(page, pair.source, pair.target, states, provenance);
    return {pair, status: r.status, explicitPath: r.explicitPath};
  }

  /* ─────────── FASE 4 — Experiencia de la ruta (D6, § Pintado, § 3.1; decisiones 241–244) ───────────
     Lo que se PINTA de una ruta (fundas, barrido), su línea de tiempo y sus filas. Nada cambia el estado de la ruta, que sigue
     siendo flowStatus (D-Ruta), y nada se persiste (B6): todo se recalcula desde estructura + Behaviors + Trace visible.

     Pertenencia (decisión 241), exacta y sin enumerar: una conexión FLOWS_TO es «de la ruta» si está en algún recorrido de
     source a target que no vuelve a entrar en source ni sale de target (las conexiones que entran en el origen o salen del
     destino nunca están en un camino simple); un nodo, si algún recorrido así pasa por él. Es disponible si está en un
     recorrido así con TODOS sus nodos UP. Alcanzabilidad hacia delante desde source y hacia atrás desde target: O(V + E).
     Saber si una conexión está en algún camino SIMPLE es NP-completo en un grafo dirigido; la diferencia solo aparece en un
     ciclo interior de la ruta, que se pinta como parte de ella. */
  const ROUTE = "ROUTE";
  /* Conexiones de G con su id, en orden del documento (mismas comprobaciones que flowGraph). */
  function flowEdges(page, ids){
    const out = [];
    for(const e of page.edges){
      if(!e || typeof e !== "object") throw flowError("invalid_document", "edges");
      if(e.kind !== undefined && typeof e.kind !== "string") throw flowError("invalid_document", "kind");
      if(edgeKind(e) !== FLOWS_TO) continue;
      if(!ids.has(e.from) || !ids.has(e.to)) throw flowError("missing_edge_endpoint", "edges");
      out.push(e);
    }
    return out;
  }
  /* Búsqueda en anchura por una lista de conexiones (hacia delante o hacia atrás), entrando solo en nodos que cumplen `pass`.
     Devuelve {nodo: distancia} de los alcanzados (el inicio incluido si cumple `pass`). */
  function spread(start, edges, forward, pass){
    const next = new Map();
    for(const e of edges){
      const a = forward ? e.from : e.to, b = forward ? e.to : e.from;
      if(!next.has(a)) next.set(a, []);
      next.get(a).push(b);
    }
    const seen = new Map();
    if(!pass(start)) return seen;
    seen.set(start, 0);
    const queue = [start];
    for(let i = 0; i < queue.length; i++){
      const at = queue[i];
      for(const n of next.get(at) || []){
        if(seen.has(n) || !pass(n)) continue;
        seen.set(n, seen.get(at) + 1); queue.push(n);
      }
    }
    return seen;
  }
  const always = () => true;
  /* Ruta estructural de source a target: {status: ROUTE | NO_PATH, source, target, nodes, edges: [{id, from, to, depth}], maxDepth}.
     NO_PATH exactamente cuando flowStatus lo da. `depth` = distancia desde source del nodo del que sale la conexión (orden del
     barrido); maxDepth = nº de «capas» de conexiones. source === target: el camino trivial, sin conexiones. */
  function flowRoute(page, source, target){
    const ids = endpoints(page, source, target);
    const all = flowEdges(page, ids);
    if(source === target) return {status: ROUTE, source, target, nodes: [source], edges: [], maxDepth: 0};
    const g = all.filter(e => e.to !== source && e.from !== target);
    const fwd = spread(source, g, true, always), bwd = spread(target, g, false, always);
    if(!fwd.has(target)) return {status: NO_PATH, source, target, nodes: [], edges: [], maxDepth: 0};
    const inRoute = g.filter(e => fwd.has(e.from) && bwd.has(e.to));
    const depth = spread(source, inRoute, true, always);
    const edges = inRoute.map(e => ({id: e.id, from: e.from, to: e.to, depth: depth.get(e.from)}));
    return {status: ROUTE, source, target, nodes: page.nodes.map(n => n.id).filter(id => fwd.has(id) && bwd.has(id)), edges,
            maxDepth: edges.reduce((m, e) => Math.max(m, e.depth + 1), 0)};
  }
  function checkRoute(route){
    if(!route || typeof route !== "object" || (route.status !== ROUTE && route.status !== NO_PATH) || !Array.isArray(route.nodes) || !Array.isArray(route.edges))
      throw flowError("invalid_document", "route");
  }
  /* Estado de cada conexión de la ruta con `states` (el mapa de availabilityAt): AVAILABLE si está en un recorrido de la ruta con
     todos sus nodos UP; si no, UNAVAILABLE. Con la ruta AVAILABLE hay al menos una; con UNAVAILABLE, ninguna. */
  function routeEdgeStates(route, states){
    checkRoute(route);
    if(!states || typeof states !== "object") throw flowError("invalid_document", "states");
    for(const id of route.nodes) availabilityValue(own(states, id) ? states[id] : undefined, id);
    const out = {};
    if(route.status !== ROUTE) return out;
    const up = id => states[id] === UP;
    const fwd = spread(route.source, route.edges, true, up), bwd = spread(route.target, route.edges, false, up);
    for(const e of route.edges) out[e.id] = fwd.has(e.from) && bwd.has(e.to) ? AVAILABLE : UNAVAILABLE;
    return out;
  }

  /* Línea de tiempo DERIVADA de la ruta (D6, decisión 242): el estado en 0 (con lo que se aplica en 0, como «Al inicio») y en
     cada instante visible en que cambia algún nodo; los eventos del mismo instante se aplican juntos. `events` = Trace visible;
     `end` = fin visible de la Historia. Cada instante: {at, changes: [{nodeId, to}], onRoute, status, frontier, edges, states}.
     frontier = el estado de la RUTA cambia en ese instante (nunca en 0); onRoute = cambió algún nodo de la ruta. Marcas:
     frontera → barra; nodo de la ruta sin frontera → punto; nodos fuera de la ruta → nada. NO_PATH → null (sin timeline). */
  function routeTimeline(page, route, events, end){
    checkPage(page); checkRoute(route);
    if(!Array.isArray(events)) throw flowError("invalid_document", "events");
    if(typeof end !== "number" || !Number.isFinite(end)) throw flowError("invalid_document", "end");
    if(route.status !== ROUTE) return null;
    const onRoute = new Set(route.nodes);
    const ats = [0];
    for(const ev of events) if(ev && ev.type === "state_changed" && ev.at > ats[ats.length - 1]) ats.push(ev.at);
    const instants = [];
    for(const at of ats){
      const states = availabilityAt(page, events, at);
      const changes = events.filter(ev => ev && ev.type === "state_changed" && (at === 0 ? ev.at <= 0 : ev.at === at)).map(ev => ({nodeId: ev.nodeId, to: ev.to}));
      const status = flowStatus(page, route.source, route.target, states);
      const prev = instants.length ? instants[instants.length - 1].status : status;
      instants.push({at, changes, onRoute: changes.some(c => onRoute.has(c.nodeId)), status, frontier: status !== prev,
                     edges: routeEdgeStates(route, states), states});
    }
    const last = instants[instants.length - 1];
    const stop = Math.max(end, last.at);
    const segments = [];
    for(const i of instants){
      const s = segments[segments.length - 1];
      if(s && s.status === i.status) continue;
      if(s) s.to = i.at;
      segments.push({from: i.at, to: stop, status: i.status});
    }
    return {start: instants[0].status, final: last.status, frontiers: instants.filter(i => i.frontier).length, end: stop, instants, segments,
            marks: instants.filter(i => i.frontier || i.onRoute).map(i => ({at: i.at, frontier: i.frontier}))};
  }
  /* Último instante de la timeline con at <= t (el que rige en t); -1 nunca: el instante 0 siempre existe. */
  function routeInstantAt(timeline, t){
    let idx = 0;
    for(let i = 0; i < timeline.instants.length; i++){ if(timeline.instants[i].at <= t) idx = i; else break; }
    return idx;
  }

  /* Filas de la ruta (§ 3.1, decisión 243): caminos SIMPLES de nodos (dos conexiones paralelas no son dos filas), en orden del
     documento. Solo la evidencia enumera; el estado nunca depende de esto. `limit` caminos; `total` exacto si la ruta no tiene
     ciclos (cuenta por programación dinámica, sin enumerar) o si la enumeración cabe en PATH_BUDGET; si no, `exact` = false y
     `total` es una cota inferior. `mustPass` = nodos por los que pasa todo camino (source, target y los que, quitados, separan
     source de target): los demás son los que distinguen cada fila («vía …»). */
  const PATH_BUDGET = 10000;
  function routePaths(route, limit){
    checkRoute(route);
    const want = Number.isSafeInteger(limit) && limit >= 0 ? limit : 0;
    if(route.status !== ROUTE) return {paths: [], total: 0, exact: true, mustPass: []};
    const s = route.source, t = route.target;
    if(s === t) return {paths: want ? [[s]] : [], total: 1, exact: true, mustPass: [s]};
    const next = new Map();
    for(const e of route.edges){
      if(!next.has(e.from)) next.set(e.from, []);
      const l = next.get(e.from);
      if(!l.includes(e.to)) l.push(e.to);
    }
    const mustPass = route.nodes.filter(v => v === s || v === t || !spread(s, route.edges, true, n => n !== v).has(t));
    /* ¿sin ciclos? (Kahn) → cuenta exacta */
    const indeg = new Map(route.nodes.map(v => [v, 0]));
    for(const [, tos] of next) for(const to of tos) indeg.set(to, indeg.get(to) + 1);
    const order = [], queue = route.nodes.filter(v => indeg.get(v) === 0);
    while(queue.length){ const v = queue.shift(); order.push(v); for(const w of next.get(v) || []){ indeg.set(w, indeg.get(w) - 1); if(!indeg.get(w)) queue.push(w); } }
    let total = null, exact = true;
    if(order.length === route.nodes.length){
      const count = new Map();
      for(let i = order.length - 1; i >= 0; i--){
        const v = order[i];
        count.set(v, v === t ? 1 : (next.get(v) || []).reduce((m, w) => m + (count.get(w) || 0), 0));
      }
      total = count.get(s);
    }
    /* enumeración en orden del documento: las `limit` primeras filas y, con ciclos, el recuento dentro del presupuesto */
    const paths = [], stack = [s], seen = new Set([s]);
    let found = 0;
    const cap = total === null ? PATH_BUDGET + 1 : want;
    (function walk(at){
      if(found >= cap) return;
      if(at === t){ if(paths.length < want) paths.push(stack.slice()); found++; return; }
      for(const n of next.get(at) || []){
        if(seen.has(n)) continue;
        seen.add(n); stack.push(n);
        walk(n);
        stack.pop(); seen.delete(n);
        if(found >= cap) return;
      }
    })(s);
    if(total === null){ exact = found <= PATH_BUDGET; total = Math.min(found, PATH_BUDGET); }
    return {paths, total, exact, mustPass};
  }

  return {AVAILABLE, UNAVAILABLE, NO_PATH, UNKNOWN, EXPLICIT, DEFAULT, PAIR, ENDPOINT_MISSING, NO_PAIR, ROUTE, PATH_BUDGET,
          availabilityAt, flowStatus, flowAvailability, availabilityProvenance,
          flowNodes, resolveObservedFlow, observedFlowAt,
          flowRoute, routeEdgeStates, routeTimeline, routeInstantAt, routePaths};
})();
