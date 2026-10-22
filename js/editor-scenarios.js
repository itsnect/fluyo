"use strict";
/* FLUYO-011. Biblioteca → Canvas → Historia. Estado de interacción efímero;
   las operaciones persistidas usan el modelo, undo y autosave existentes. */
let scStoryDrag = null;
let scActiveId = null,
  scPlayback = null,
  scRafId = null,
  scStatus = "idle",
  scErrors = [];
let scEditingEventTypeId = null,
  scEventDialogMode = "create",
  scDrag = null,
  scPlacement = null;
let scPointerStart = null,
  scContext = null,
  scUiReady = false,
  scFocusReturn = null;
let scFeedback = null,
  scSelectedStep = null,
  scNewEventId = null,
  scNoticeTimer = null,
  scPopoverReturn = null;
let scSuppressClick = false,
  scPhraseParts = [],
  scVisual = "●",
  scMessageColor = "#d0576a",
  scFillColor = "#3aa7e8",
  scPreviewTimer = null;
let scResizeObserver = null,
  scStorySignature = "",
  scLastPage = null,
  scPrevActiveId = null;

function isScenarioPlaybackActive() {
  return scStatus === "running" || scStatus === "completed";
}

function scActiveScenario() {
  const pg = P();
  if (!pg || !pg.scenarios) return null;
  if (scActiveId != null) {
    const found = pg.scenarios.find((s) => s.id === scActiveId);
    if (found) return found;
  }
  /* Si la seleccionada ya no existe (p. ej. Undo de «Duplicar»/«Nueva»), vuelve a la anterior antes que a la primera. */
  const prev = scPrevActiveId != null && pg.scenarios.find((s) => s.id === scPrevActiveId);
  return prev || pg.scenarios[0] || null;
}

function scFormatTime(ms) {
  if (!Number.isFinite(ms)) ms = 0;
  return (ms / 1000).toFixed(1) + " s";
}

function scParseTime(v) {
  const n = parseFloat(String(v).replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 1000);
}

function formatRelativeDelay(ms) {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  if (ms === 0) return "al mismo tiempo";
  if (ms < 1000) return ms + " ms después";
  const s = ms / 1000;
  // Para segundos usamos formato claro: entero cuando no hay decimal relevante
  if (s === Math.floor(s)) return s + " s después";
  // 1.5 s, 2.5 s… con un decimal; evitamos floats raros
  const rounded = Math.round(s * 10) / 10;
  return rounded.toFixed(1).replace(".0", "") + " s después";
}

function parseHumanDelay(value, unit) {
  const n = parseFloat(String(value).replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return null;
  if (unit === "ms") return Math.round(n);
  if (unit === "s") return Math.round(n * 1000);
  return null;
}

function scNodeLabel(id) {
  const n = nodeById(id);
  if (!n) return null;
  return (n.label || "").split("\n")[0].trim() || null;
}

function scNodeFallback(id) {
  return scNodeLabel(id) || "Elemento sin nombre";
}

/* «A → B» en el sentido del RECORRIDO (FLUYO-STEP-REVERSE-002): con `reverse`, «B → A». Una sola regla: traversalEnds. */
function scEdgeLabel(id, reverse) {
  const e = edgeById(id);
  if (!e) return null;
  const t = traversalEnds(e, reverse);
  const a = scNodeLabel(t.source),
    b = scNodeLabel(t.target);
  return (a || "?") + " → " + (b || "?");
}

function scEdgeSecondary(id) {
  const e = edgeById(id);
  if (!e || !e.label) return null;
  return (e.label || "").split("\n")[0].trim() || null;
}

function scTargetLabel(step) {
  if (step.action === "SET_STATE") return scNodeFallback(step.nodeId);
  return scEdgeLabel(step.edgeId, step.reverse) || "Conexión sin nombre";
}

function scIsTargetMissing(step) {
  if (step.action === "SET_STATE" || step.action === "OCCURRENCE") return !nodeById(step.nodeId);
  const e = edgeById(step.edgeId);
  if (!e) return true;
  return !nodeById(e.from) || !nodeById(e.to);
}

function describeScenarioStep(step) {
  const missing = scIsTargetMissing(step);
  const et = step.eventTypeId ? eventTypeById(step.eventTypeId) : null;

  if (step.action === "SET_STATE") {
    const label = scNodeFallback(step.nodeId);
    if (et) {
      const sentence = renderEventSentence(et, null, label);
      return {
        primary: missing ? "⚠ " + sentence : sentence,
        targetType: "node",
        targetId: step.nodeId,
        missing,
        eventType: et,
        secondary: null,
      };
    }
    const verb = step.state === "DOWN" ? "se cae" : step.state === "UP" ? "se recupera" : "cambia de estado";
    return {
      primary: missing ? "⚠ Elemento eliminado" : label + " " + verb,
      targetType: "node",
      targetId: step.nodeId,
      missing,
      eventType: null,
      secondary: null,
    };
  }

  if (step.action === "OCCURRENCE") {
    const label = scNodeFallback(step.nodeId);
    if (et) {
      const sentence = renderEventSentence(et, null, label);
      return {
        primary: missing ? "⚠ " + sentence : sentence,
        targetType: "node",
        targetId: step.nodeId,
        missing,
        eventType: et,
        secondary: null,
      };
    }
    return {
      primary: missing ? "⚠ Elemento eliminado" : label + " ocurre",
      targetType: "node",
      targetId: step.nodeId,
      missing,
      eventType: null,
      secondary: null,
    };
  }

  // SEND
  const primary = scEdgeLabel(step.edgeId, step.reverse);
  const secondary = scEdgeSecondary(step.edgeId);
  if (et) {
    const e = edgeById(step.edgeId),
      t = traversalEnds(e, step.reverse);
    const source = e ? scNodeFallback(t.source) : "?";
    const target = e ? scNodeFallback(t.target) : "?";
    const sentence = renderEventSentence(et, source, target);
    return {
      primary: missing ? "⚠ " + sentence : sentence,
      targetType: "edge",
      targetId: step.edgeId,
      missing,
      eventType: et,
      secondary,
    };
  }
  return {
    primary: missing ? "⚠ Conexión eliminada" : (primary || "?") + " envía",
    targetType: "edge",
    targetId: step.edgeId,
    missing,
    eventType: null,
    secondary,
  };
}

function scBehaviorForNode(nodeId) {
  const pg = P();
  if (!pg || !pg.behaviors) return null;
  const b = pg.behaviors.find((x) => x.nodeId === nodeId);
  return b ? b.initialState : null;
}

function scSetBehavior(nodeId, state) {
  const pg = P();
  if (!pg) return;
  pushUndo();
  setInitialAvailability(pg, nodeId, state);
  scheduleAutosave();
  scRenderBehaviors();
  scRenderFlow();
}

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* Motivo de un envío que no llegó, con el nodo del recorrido: el origen o el destino según el sentido del Step. */
function scSendFailText(step, reason) {
  const t = traversalEnds(edgeById(step.edgeId), step.reverse);
  return reason === "source_down"
    ? (scNodeLabel(t.source) || "El origen") + " no está disponible"
    : (scNodeLabel(t.target) || "El destino") + " no está disponible";
}

function scRuntimeStateForStep(step) {
  if (!scPlayback || !isScenarioPlaybackActive()) return { status: "pending", detail: null };
  // Para SEND respetamos la duración visual del cue antes de mostrar el resultado.
  if (step.action === "SEND") {
    if (scPlayback.activeSends.some((s) => s.stepId === step.id)) return { status: "active", detail: null };
    const completed = scPlayback.completedSends.find((s) => s.stepId === step.id);
    if (completed) {
      if (completed.terminalType === "send_failed") {
        return { status: "failed", detail: scSendFailText(step, completed.terminalReason) };
      }
      return { status: "success", detail: null };
    }
  }
  const events = scPlayback.logEvents || [];
  // Buscar el evento más avanzado para este step
  let last = null;
  for (const ev of events) {
    if (ev.stepId === step.id) last = ev;
  }
  if (!last) {
    // Aún no llegamos al timestamp
    if (scPlayback.cursorVirtual < scVisibleAt(step)) return { status: "pending", detail: null };
    return { status: step.action === "SET_STATE" ? "completed" : "active", detail: null };
  }
  if (last.type === "state_changed" || last.type === "event_occurred")
    return { status: "completed", detail: null };
  if (last.type === "send_succeeded") return { status: "success", detail: null };
  if (last.type === "send_failed") {
    return { status: "failed", detail: scSendFailText(step, last.reason) };
  }
  if (last.type === "send_started") return { status: "active", detail: null };
  return { status: "pending", detail: null };
}

function scStatusMark(status) {
  switch (status) {
    case "pending":
      return "○";
    case "active":
      return "▶";
    case "completed":
      return "✓";
    case "success":
      return "✓";
    case "failed":
      return "✕";
    default:
      return "○";
  }
}

function scSelectTarget(type, id) {
  if (!id) return;
  if (type === "node" && nodeById(id)) {
    selectOnly("node", id);
  } else if (type === "edge" && edgeById(id)) {
    selectOnly("edge", id);
  }
}

function scRenderTraceLog() {
  const cont = $("scTraceLog");
  if (!cont) return;
  cont.innerHTML = "";
  let events = [];
  if (scPlayback) {
    events = scPlayback.logEvents.slice();
  }
  if (!events.length) {
    const p = document.createElement("p");
    p.className = "hint";
    p.textContent = "El registro aparecerá aquí al reproducir la historia.";
    cont.appendChild(p);
    return;
  }
  events.forEach((ev) => {
    const line = document.createElement("div");
    line.className = "scLogLine";
    const mark = document.createElement("span");
    mark.className = "scLogMark";
    const body = document.createElement("span");
    const time = scFormatTime(ev.at);
    if (ev.type === "state_changed") {
      const lbl = scNodeLabel(ev.nodeId) || "Nodo #" + ev.nodeId;
      mark.textContent = "◦";
      body.textContent = time + "  " + escapeHtml(lbl) + " " + (ev.from || "UP") + " → " + ev.to;
    } else if (ev.type === "event_occurred") {
      const lbl = scNodeLabel(ev.nodeId) || "Nodo #" + ev.nodeId;
      mark.textContent = "●";
      body.textContent = time + "  " + escapeHtml(lbl) + "  Ocurre";
    } else if (ev.type === "send_started") {
      const lbl = scEdgeLabel(ev.edgeId, ev.reverse) || "Conexión #" + ev.edgeId;
      mark.textContent = "→";
      body.textContent = time + "  " + escapeHtml(lbl) + "  Sale";
    } else if (ev.type === "send_succeeded") {
      const lbl = scEdgeLabel(ev.edgeId, ev.reverse) || "Conexión #" + ev.edgeId;
      mark.textContent = "✓";
      line.classList.add("success");
      const result = document.createElement("span");
      result.className = "scLogResult";
      result.textContent = "Llegó";
      body.appendChild(document.createTextNode(time + "  " + escapeHtml(lbl) + "  "));
      body.appendChild(result);
    } else if (ev.type === "send_failed") {
      const lbl = scEdgeLabel(ev.edgeId, ev.reverse) || "Conexión #" + ev.edgeId;
      mark.textContent = "✕";
      line.classList.add("fail");
      const reasonText =
        ev.reason === "source_down"
          ? "Origen no disponible"
          : ev.reason === "target_down"
            ? "Destino no disponible"
            : "No llegó";
      const result = document.createElement("span");
      result.className = "scLogResult";
      result.textContent = reasonText;
      body.appendChild(document.createTextNode(time + "  " + escapeHtml(lbl) + "  "));
      body.appendChild(result);
    }
    line.appendChild(mark);
    line.appendChild(body);
    cont.appendChild(line);
  });
  cont.scrollTop = cont.scrollHeight;
}

/* FLUYO-016. La Historia activa es estado del editor (nunca del documento) y pertenece a UNA página:
   los ids de Scenario/Step sólo son únicos por página/Historia. Se invoca desde renderTabs() en cada
   cambio de página o de documento: la selección se descarta y se cae en una Historia válida de la
   página nueva (la primera). */
function scSyncPage() {
  let pg = null;
  try { pg = P(); } catch { return; }
  if (scLastPage === pg) return;
  const first = scLastPage === null;
  scLastPage = pg;
  if (first) return;
  scActiveId = null;
  scPrevActiveId = null;
  scSelectedStep = null;
  scContext = null;
  scStorySignature = "";
  scFlowPending = null;
  if (isScenarioPlaybackActive()) scReset();
  if (scUiReady) {
    scCancelPlacement();
    scErrors = [];
    scRefreshIfVisible();
  }
}

/* Selecciona una Historia: un solo punto para el estado efímero que depende de ella. */
function scSelectStory(id) {
  const from = scLastPage === P() ? scActiveScenario() : null;
  scPrevActiveId = from && from.id !== id ? from.id : null;
  scActiveId = id;
  scLastPage = P();
  scSelectedStep = null;
  scContext = null;
  scStorySignature = "";
  scErrors = [];
  scFlowPending = null;
}

function scNewScenario() {
  if (isScenarioPlaybackActive()) scReset();
  scCancelPlacement();
  const pg = P();
  pushUndo();
  const sc = createScenario(pg, defaultScenarioName(pg));
  scSelectStory(sc.id);
  scheduleAutosave();
  scRenderPanel();
  scNotice(sc.name + " creada");
}

function scDuplicateScenario() {
  const src = scActiveScenario();
  if (!src) return;
  if (isScenarioPlaybackActive()) scReset();
  scCancelPlacement();
  const pg = P();
  pushUndo();
  const copy = duplicateScenario(pg, src.id);
  scSelectStory(copy.id);
  scheduleAutosave();
  scRenderPanel();
  scNotice("Historia duplicada: " + copy.name);
}

function scDeleteScenario() {
  const sc = scActiveScenario();
  if (!sc) return;
  if (isScenarioPlaybackActive()) scReset();
  const moments = storyboardGroups(sc.steps).length;
  const detail = moments ? " Tiene " + moments + (moments === 1 ? " momento." : " momentos.") : "";
  if (!confirm("¿Eliminar la historia «" + sc.name + "»?" + detail + " Los eventos de la biblioteca se conservan.")) return;
  const pg = P();
  const index = pg.scenarios.findIndex((s) => s.id === sc.id);
  pushUndo();
  deleteScenario(pg, sc.id);
  const next = pg.scenarios[Math.min(index, pg.scenarios.length - 1)];
  scSelectStory(next ? next.id : null);
  scheduleAutosave();
  scRenderPanel();
}

function scSwitchScenario(id) {
  if (isScenarioPlaybackActive()) scReset();
  scCancelPlacement();
  scStoryDragCleanup();
  scSelectStory(+id);
  scRenderPanel();
}

function scRenameScenario(name) {
  const sc = scActiveScenario();
  if (!sc) return;
  const trimmed = String(name).trim();
  if (!trimmed || trimmed.length > 120) return;
  if (sc.name === trimmed) return;
  if (isScenarioPlaybackActive()) scReset();
  pushUndo();
  sc.name = trimmed;
  scheduleAutosave();
  scRenderHeader();
}

function scAddStateStep(nodeId, state, eventTypeId) {
  if (isScenarioPlaybackActive()) return;
  const sc = scActiveScenario();
  if (!sc) return;
  if (sc.engineVersion !== FluyoScenarios.ENGINE_VERSION) return;
  pushUndo();
  const def = { at: scStepDefaultTime(sc), action: "SET_STATE", nodeId, state };
  if (eventTypeId) def.eventTypeId = eventTypeId;
  createStep(sc, def);
  scheduleAutosave();
  scRenderStoryboard();
  scRenderButtons();
}

function scAddSendStep(edgeId, eventTypeId) {
  if (isScenarioPlaybackActive()) return;
  const sc = scActiveScenario();
  if (!sc) return;
  if (sc.engineVersion !== FluyoScenarios.ENGINE_VERSION) return;
  pushUndo();
  const def = { at: scStepDefaultTime(sc), action: "SEND", edgeId };
  if (eventTypeId) def.eventTypeId = eventTypeId;
  createStep(sc, def);
  scheduleAutosave();
  scRenderStoryboard();
  scRenderButtons();
}

function scAddOccurrenceStep(nodeId, eventTypeId) {
  if (isScenarioPlaybackActive()) return;
  const sc = scActiveScenario();
  if (!sc) return;
  if (sc.engineVersion !== FluyoScenarios.ENGINE_VERSION) return;
  pushUndo();
  const def = { at: scStepDefaultTime(sc), action: "OCCURRENCE", nodeId };
  if (eventTypeId) def.eventTypeId = eventTypeId;
  createStep(sc, def);
  scheduleAutosave();
  scRenderStoryboard();
  scRenderButtons();
}

function scCanvasAddNodeStep(state) {
  const s = singleSel();
  if (!s || s.type !== "node") return;
  scAddStateStep(s.obj.id, state);
}

function scCanvasAddEdgeSend() {
  const s = singleSel();
  if (!s || s.type !== "edge") return;
  scAddSendStep(s.obj.id);
}

/* Eliminar: si el momento desaparece, su espera se colapsa (misma política que unirse, model.js). */
function scDeleteStep(id) {
  if (!scEditable()) return;
  const sc = scActiveScenario(),
    r = storyboardRemoveStep(sc.steps, id);
  if (!r) return;
  pushUndo();
  sc.steps = r.steps;
  scSetArrivalDependencies(sc, FluyoStoryClock.pruneArrivalDependencies(sc));
  scheduleAutosave();
  scRenderStoryboard();
  scRenderButtons();
}

function scRun(opts) {
  /* opts.present: Present reproduce con este mismo motor sin tocar el panel del editor. */
  const inPresent = !!(opts && opts.present);
  if (scStatus === "running") return;
  if (scStatus === "completed") scReset();
  scCancelPlacement();
  const sc = scActiveScenario();
  if (!sc || !sc.steps.length) return; /* una Historia vacía no se reproduce (el botón ya está deshabilitado) */
  scErrors = [];
  /* FLUYO-018.18: el reloj de la Historia (story-clock.js) decide qué tiempo ve la reproducción; pausar y saltar no
     cambian la receta, que sigue siendo una sola, compartida con Present y el Viewer (story-playback.js). */
  scClock = typeof FluyoStoryClock !== "undefined" ? FluyoStoryClock.create() : null;
  /* FLUYO-018.21: la misma receta + el instante visible de cada momento (dependencias de llegada, story-clock.js) */
  const started = typeof FluyoStoryClock !== "undefined" ? FluyoStoryClock.start(P(), sc, scNow()) : FluyoStory.start(P(), sc, scNow());
  if (!started.ok) {
    scErrors = started.errors;
    scRenderErrors();
    if (typeof presentStoryRefresh === "function") presentStoryRefresh();
    return;
  }
  scPlayback = started.playback;
  scStatus = "running";
  scFollowedStep = null;
  /* FLUYO-018.14b: reproducir es del modo Historia (B1); la salida «Editar»/«Volver a editar» nunca se bloquea (B3). */
  if (!inPresent && typeof switchPanelTab === "function") switchPanelTab("scenarios");
  /* FLUYO-018.17 (D3): reproducir recupera el lienzo: la hoja ampliada vuelve a su altura de transporte (Ampliar sigue disponible). */
  if (!inPresent && typeof setStoryExpanded === "function" && typeof isSheetLayout === "function" && isSheetLayout()) setStoryExpanded(false);
  scRenderButtons();
  scRenderPanel();
  /* FLUYO-018.12: en móvil la hoja se compacta al reproducir; si el diagrama quedaba debajo, se trae a la vista. */
  if (!inPresent && typeof revealAboveSheet === "function") revealAboveSheet("page");
  scScheduleTick();
}

function scReset() {
  scCancelPlacement();
  scStorySignature = "";
  if (scRafId !== null) {
    cancelAnimationFrame(scRafId);
    scRafId = null;
  }
  scPlayback = null;
  scClock = null;
  scStatus = "idle";
  scErrors = [];
  scFollowedStep = null;
  const tabProp = $("tabProperties");
  if (tabProp) tabProp.disabled = false;
  scRenderPanel();
  if (typeof presentStoryRefresh === "function") presentStoryRefresh();
}

function scScheduleTick() {
  if (scRafId !== null) cancelAnimationFrame(scRafId);
  scRafId = requestAnimationFrame(scTick);
}

function scTick() {
  scRafId = null;
  if (!scPlayback || scStatus !== "running") return;
  /* en pausa no se piden fotogramas propios: la proyección queda quieta en el instante pausado */
  if (scIsPaused()) return;
  FluyoScenarioPlayback.tick(scPlayback, scNow());
  scRenderStatus();
  scRenderStoryboard();
  scFollowActive();
  scRenderTraceLog();
  if (typeof presentStoryRefresh === "function") presentStoryRefresh();
  if (FluyoStory.isFinished(scPlayback)) {
    scStatus = "completed";
    scRenderButtons();
    scRenderStatus();
    if (typeof presentStoryRefresh === "function") presentStoryRefresh();
  } else {
    scScheduleTick();
  }
}

function buildScenarioRenderState() {
  if (!scPlayback) return null;
  let rs = FluyoStory.renderState(scPlayback, scActiveScenario(), scNow());
  /* FLUYO-018.29 (G1): el momento al que se saltó en pausa se ve entero ya (story-clock.js) */
  if (typeof FluyoStoryClock !== "undefined") rs = FluyoStoryClock.reveal(rs, scPlayback);
  /* SCENARIOS-SEMANTICS-001 FASE 4: lo que el lienzo pinta de la ruta observada (null sin ruta; FASE 5: también en Present) */
  const flow = scFlowOverlay();
  if (flow) rs.flow = flow;
  return rs;
}

/* ─────────── FLUYO-018.18: pausar, reanudar y saltar entre momentos ───────────
   El estado sigue siendo scStatus (idle | running | completed): «en pausa» es running con el reloj congelado, no un
   estado nuevo. Saltar vuelve a ejecutar la misma receta con el origen desplazado (FluyoStoryClock.seek): el resultado es
   el de una reproducción continua en ese instante. Nada de esto toca el documento ni crea Undo. */
let scClock = null;
function scNow() {
  const real = performance.now();
  return scClock ? FluyoStoryClock.now(scClock, real) : real;
}
/* FLUYO-018.21: instante en que un Step se hace visible en esta reproducción (su `at` si su momento no espera nada). */
function scVisibleAt(step) {
  return typeof FluyoStoryClock !== "undefined" ? FluyoStoryClock.visibleAt(scPlayback, step) : step.at;
}
function scIsPaused() {
  return scStatus === "running" && !!scClock && FluyoStoryClock.isPaused(scClock);
}
function scAfterTransport() {
  scRenderButtons();
  scRenderStatus();
  if (typeof presentStoryRefresh === "function") presentStoryRefresh();
}
function scPause() {
  if (scStatus !== "running" || !scClock || scIsPaused()) return;
  FluyoStoryClock.pause(scClock, performance.now());
  if (scRafId !== null) { cancelAnimationFrame(scRafId); scRafId = null; }
  scAfterTransport();
}
function scResume() {
  if (!scIsPaused()) return;
  FluyoStoryClock.resume(scClock, performance.now());
  scAfterTransport();
  scScheduleTick();
}
function scTogglePause() {
  if (scIsPaused()) scResume();
  else scPause();
}
/* Momento en curso y destinos de ⏮ / ⏭ (la unidad es el momento, nunca el Step). Terminada, «anterior» vuelve al último. */
function scMomentNav() {
  const sc = scActiveScenario();
  if (!sc || !scPlayback || !scClock || !isScenarioPlaybackActive()) return { times: [], index: -1, prev: null, next: null };
  const times = FluyoStoryClock.momentTimes(sc, scPlayback), vt = scPlayback.cursorVirtual || 0;
  const index = FluyoStoryClock.momentIndex(times, vt);
  const prev = scStatus === "completed" ? (times.length ? times.length - 1 : null) : FluyoStoryClock.prevTarget(times, vt);
  const next = scStatus === "completed" ? null : FluyoStoryClock.nextTarget(times, vt);
  return { times, index, prev, next };
}
function scSeekMoment(i) {
  const sc = scActiveScenario();
  if (!sc || !scPlayback || !scClock || !isScenarioPlaybackActive()) return false;
  /* desde «terminada» se vuelve a ese momento en pausa: quien salta quiere mirarlo, no que siga solo */
  if (scStatus === "completed") FluyoStoryClock.pause(scClock, performance.now());
  const r = FluyoStoryClock.seek(scClock, performance.now(), P(), sc, i);
  if (!r.ok) return false;
  scPlayback = r.playback;
  scStatus = "running";
  scFollowedStep = null;
  scStorySignature = "";
  scRenderButtons();
  scRenderStatus();
  scRenderStoryboard();
  scFollowActive();
  scRevealMoment();
  scRenderTraceLog();
  if (typeof presentStoryRefresh === "function") presentStoryRefresh();
  if (!scIsPaused()) scScheduleTick();
  return true;
}
/* Al saltar, el lienzo enseña el momento ENTERO (D6): si sus destinos —los elementos de sus eventos y los dos extremos de
   sus conexiones— no están todos en la zona libre, se centra su caja sin cambiar el zoom (como scRevealTarget). Un momento
   con varios eventos simultáneos ya no deja uno fuera de la vista. Presentando, la vista es la de Present: no se toca. */
function scRevealMoment() {
  if (typeof cv === "undefined" || typeof visibleCanvasRect !== "function" || (typeof presenting !== "undefined" && presenting)) return;
  const sc = scActiveScenario(), n = scMomentNav();
  if (!sc || n.index < 0) return;
  const at = FluyoStoryClock.momentTimes(sc)[n.index];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (nd) => { if (!nd) return; x0 = Math.min(x0, nd.x - nd.w / 2); y0 = Math.min(y0, nd.y - nd.h / 2); x1 = Math.max(x1, nd.x + nd.w / 2); y1 = Math.max(y1, nd.y + nd.h / 2); };
  for (const st of sc.steps) {
    if (st.at !== at) continue;
    if (st.edgeId) { const e = edgeById(st.edgeId); if (e) { add(nodeById(e.from)); add(nodeById(e.to)); } }
    else add(nodeById(st.nodeId));
  }
  if (!isFinite(x0)) return;
  const v = visibleCanvasRect();
  if (x0 * viewZoom + viewX >= v.left && y0 * viewZoom + viewY >= v.top && x1 * viewZoom + viewX <= v.right && y1 * viewZoom + viewY <= v.bottom) return;
  let cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  /* si el momento no cabe a este zoom (no se encoge: suelo de 0,6, decisión 148), se centra su primer elemento o, si solo hay
     conexiones, el punto medio de la primera: lo mismo que «un destino a la vista» del seguimiento de 018.17 */
  if ((x1 - x0) * viewZoom > v.width || (y1 - y0) * viewZoom > v.height) {
    const steps = scOrderedSteps().filter((st) => st.at === at);
    const p = scTargetPosition(steps.find((st) => !st.edgeId) || steps[0]);
    if (p) { cx = p.x; cy = p.y; }
  }
  viewX = v.left + v.width / 2 - cx * viewZoom;
  viewY = v.top + v.height / 2 - cy * viewZoom;
}
function scSeekStep(step) {
  const sc = scActiveScenario();
  if (!sc || !step) return false;
  return scSeekMoment(FluyoStoryClock.momentTimes(sc).indexOf(step.at));
}
function scPrevMoment() {
  const n = scMomentNav();
  if (n.prev !== null) scSeekMoment(n.prev);
}
function scNextMoment() {
  const n = scMomentNav();
  if (n.next !== null) scSeekMoment(n.next);
}

/* FLUYO-018.17 (D3): el paso activo se ve dos veces. En la línea de tiempo, su fila se trae a la vista (solo desplaza el
   contenedor .scStoryboardSection; si el usuario desplazó a mano hace menos de 2 s, se respeta). En el lienzo, su destino se
   trae a la zona libre solo cuando sale de ella y solo al cambiar de paso: nunca a cada fotograma. */
let scFollowedStep = null, scUserScrollAt = 0, scAutoScrolling = false;
function scFollowActive() {
  if (!scPlayback || !isScenarioPlaybackActive()) return;
  const sc = scActiveScenario();
  if (!sc) return;
  /* el paso en curso: la fila activa (un evento en tránsito) o, si el momento es instantáneo (una ocurrencia, que pasa a
     completada en el acto), el último paso cuyo instante ya llegó */
  const activeRow = $("scStoryboard")?.querySelector?.(".scStoryRow.scStatus_active");
  let step = activeRow && activeRow.dataset ? sc.steps.find((x) => String(x.id) === String(activeRow.dataset.stepId)) : null;
  if (!step) { const cur = scPlayback.cursorVirtual || 0; const past = sc.steps.filter((s) => scVisibleAt(s) <= cur); step = past.length ? past[past.length - 1] : null; }
  if (!step || String(step.id) === String(scFollowedStep)) return;
  scFollowedStep = step.id;
  const row = $("scStoryboard")?.querySelector?.('[data-step-id="' + step.id + '"]');
  if (row && typeof performance !== "undefined" && performance.now() - scUserScrollAt > 2000) scScrollIntoView(row);
  if (typeof cv !== "undefined" && scTargetOffscreen(step)) scRevealTarget(step, false);
}
/* Desplaza SOLO el contenedor desplazable más cercano (línea de tiempo, biblioteca), nunca la hoja ni la página: scrollIntoView
   desplazaba también el aside y «Volver a editar» se iba fuera de la hoja (auditoría de 018.17). */
function scScrollIntoView(el) {
  if (!el || !el.getBoundingClientRect || typeof getComputedStyle !== "function") return;
  let c = el.parentElement;
  while (c && c !== document.body) {
    const cs = getComputedStyle(c);
    if (/(auto|scroll)/.test(cs.overflowY) && c.scrollHeight > c.clientHeight + 1) break;
    if (/(auto|scroll)/.test(cs.overflowX) && c.scrollWidth > c.clientWidth + 1) break;
    c = c.parentElement;
  }
  if (!c || c === document.body) return;
  const r = el.getBoundingClientRect(), cr = c.getBoundingClientRect();
  scAutoScrolling = true;
  if (r.top < cr.top) c.scrollTop += r.top - cr.top - 4;
  else if (r.bottom > cr.bottom) c.scrollTop += r.bottom - cr.bottom + 4;
  if (r.left < cr.left) c.scrollLeft += r.left - cr.left - 4;
  else if (r.right > cr.right) c.scrollLeft += r.right - cr.right + 4;
  requestAnimationFrame(() => { scAutoScrolling = false; });
}
function scIsScenariosTabActive() {
  const panel = $("panelScenarios");
  return panel && panel.style.display !== "none";
}
/* Superficies y controles compartidos. Siempre texto, nunca HTML del proyecto. */
function scEl(tag, cls, text) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
}
function scButton(text, fn, cls) {
  const el = scEl("button", cls, text);
  el.type = "button";
  el.onclick = fn;
  return el;
}
/* Marca de estado en <body> para el CSS de la hoja móvil (FLUYO-018.12). Tolerante a los DOM falsos de los tests. */
/* FLUYO-018.14b: el glifo de un control (▶ ■ ↻ ▾) sigue en su texto —lo leen los tests y el lector de pantalla lo
   ignora (aria-hidden)— pero se pinta con el trazo del sistema (.glyph, styles.css). Tolerante a los DOM falsos de vm. */
function scGlyphText(el, glyph, cls, label, glyphFirst) {
  el.textContent = glyphFirst ? glyph + " " + label : label + " " + glyph;
  if (typeof document.createTextNode !== "function" || typeof el.replaceChildren !== "function") return;
  const g = scEl("span", "glyph " + cls, glyph);
  if (g.setAttribute) g.setAttribute("aria-hidden", "true");
  const t = document.createTextNode(glyphFirst ? " " + label : label + " ");
  if (glyphFirst) el.replaceChildren(g, t);
  else el.replaceChildren(t, g);
}
/* Pausar ↔ Reanudar: el mismo botón, icono del sprite y texto (nunca un glifo nuevo). */
function scSetPauseLabel(el, paused) {
  const label = paused ? "Reanudar" : "Pausar";
  if (el.dataset && el.dataset.state === label) return;
  if (el.dataset) el.dataset.state = label;
  if (typeof document.createElementNS !== "function" || typeof el.replaceChildren !== "function") { el.textContent = label; return; }
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"), use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  svg.setAttribute("class", "ic");
  svg.setAttribute("aria-hidden", "true");
  use.setAttribute("href", paused ? "#i-play" : "#i-pause");
  svg.appendChild(use);
  el.replaceChildren(svg, document.createTextNode(label));
}
function scBodyFlag(name, on) {
  const b = document.body;
  if (b && b.classList) b.classList.toggle(name, !!on);
}
function scNotice(message) {
  const el = $("scNotice");
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
  /* FLUYO-018.17: en la hoja móvil el aviso se coloca encima de lo que haya debajo (hoja o barra de colocación), nunca sobre
     «Cancelar». En escritorio lo coloca el CSS. */
  if (typeof isSheetLayout === "function" && isSheetLayout() && el.style) {
    let b = ($("bottomBar") ? $("bottomBar").getBoundingClientRect().height : 52) + 12,
      r = "";
    const aside = document.querySelector("aside");
    /* FLUYO-018.19: en apaisado la hoja está a la derecha (o es la franja de reproducción): el aviso se queda a su izquierda */
    const side = typeof isSideSheet === "function" && isSideSheet() && !(typeof sideStrip === "function" && sideStrip());
    if (aside && document.body.classList.contains("panelOpen") && !document.body.classList.contains("scPlacing")) {
      if (side) r = aside.offsetWidth + 12 + "px";
      else b += aside.offsetHeight;
    }
    const pb = $("scPlacementBar");
    if (pb && !pb.hidden) b = Math.max(b, innerHeight - pb.getBoundingClientRect().top + 12);
    el.style.bottom = b + "px";
    el.style.right = r;
  } else if (el.style) {
    el.style.bottom = "";
    el.style.right = "";
  }
  clearTimeout(scNoticeTimer);
  scNoticeTimer = setTimeout(() => {
    el.hidden = true;
  }, 4500);
}
function scClosePopover(restore = true) {
  const p = $("scPopover");
  if (p) p.hidden = true;
  if (restore && scPopoverReturn?.isConnected) scPopoverReturn.focus();
  scPopoverReturn = null;
}
/* Los menús (⋯, selector, momento) son interruptores: pulsar de nuevo su botón con el menú abierto lo cierra. */
function scMenuToggledOff(anchor) {
  const p = $("scPopover");
  if (!anchor || !p || p.hidden || scPopoverReturn !== anchor) return false;
  scClosePopover();
  return true;
}
function scOpenPopover(anchor) {
  scClosePopover(false);
  const p = $("scPopover");
  if (!p) return null;
  p.replaceChildren();
  p.hidden = false;
  scPopoverReturn = anchor;
  const r = anchor?.getBoundingClientRect?.() || { left: innerWidth / 2, top: 120, bottom: 140 };
  p.style.left = Math.max(12, Math.min(r.left, innerWidth - 310)) + "px";
  p.style.top = Math.max(12, Math.min(r.bottom + 5, innerHeight - 260)) + "px";
  requestAnimationFrame(() => {
    const box = p.getBoundingClientRect();
    p.style.top = Math.max(12, Math.min(box.top, innerHeight - box.height - 12)) + "px";
    p.querySelector("button,input,select")?.focus();
  });
  return p;
}
function scMenu(anchor, items) {
  if (scMenuToggledOff(anchor)) return;
  const p = scOpenPopover(anchor);
  if (!p) return;
  for (const [label, fn, disabled] of items) {
    const b = scButton(label, () => {
      scClosePopover();
      fn();
    });
    b.disabled = !!disabled;
    p.appendChild(b);
  }
}
function scCommit() {
  scheduleAutosave();
  scErrors = [];
  scStorySignature = "";
  scRenderPanel();
}
function scEditable() {
  const s = scActiveScenario();
  return !!s && !isScenarioPlaybackActive() && s.engineVersion === FluyoScenarios.ENGINE_VERSION;
}
function scOrderedSteps() {
  return storyboardOrderedSteps(scActiveScenario()?.steps);
}
function scGroups() {
  return storyboardGroups(scActiveScenario()?.steps);
}
function scStepDefaultTime(sc) {
  return defaultStepTime(sc);
}
function scRenderPanel() {
  scValidatePlacement();
  scRenderHeader();
  scRenderErrors();
  scRenderEventLibrary();
  scRenderStoryboard();
  scRenderButtons();
  scRenderStatus();
  if ($("scDetailsDialog")?.open) {
    scRenderBehaviors();
    scRenderTraceLog();
  }
}
function scRenderHeader() {
  const s = scActiveScenario(),
    title = $("scScenarioTitle");
  if (title) scGlyphText(title, "▾", "g-chev", s ? s.name : "Sin historias", false);
  const u = $("scUnsupported");
  if (u) u.hidden = !s || s.engineVersion === FluyoScenarios.ENGINE_VERSION;
}
function scRenderErrors() {
  const el = $("scErrors");
  if (el) {
    el.textContent = scErrors.join(" ");
    el.hidden = !scErrors.length;
  }
}
function scRenderButtons() {
  const s = scActiveScenario(),
    run = $("scRun"),
    reset = $("scReset");
  if (run) {
    if (scStatus === "completed") scGlyphText(run, "↻", "g-replay", "Repetir", true);
    else scGlyphText(run, "▶", "g-play", "Reproducir", true);
    run.hidden = scStatus === "running";
    run.disabled = !s || !s.steps.length || s.engineVersion !== FluyoScenarios.ENGINE_VERSION;
    run.title = !run.disabled ? "" : !s ? "Crea una historia para poder reproducirla." : !s.steps.length ? "Añade un evento a la historia para poder reproducirla." : "Esta historia necesita una versión compatible de Fluyo.";
  }
  if (reset) {
    reset.hidden = scStatus === "idle";
    /* FLUYO-018.18 (D5): una sola palabra para volver a la Historia lista, en cualquier estado (antes «Terminar» al acabar).
       «Volver a editar» sigue siendo la salida del modo (B2). */
    scGlyphText(reset, "■", "g-stop", "Detener", true);
  }
  /* Transporte (D1–D3, D5): Pausar/Reanudar y los momentos anterior/siguiente solo existen mientras hay reproducción. */
  const pause = $("scPause"), nav = scMomentNav();
  if (pause) {
    pause.hidden = scStatus !== "running";
    scSetPauseLabel(pause, scIsPaused());
  }
  if ($("scPrev")) { $("scPrev").hidden = scStatus === "idle"; $("scPrev").disabled = nav.prev === null; }
  if ($("scNext")) { $("scNext").hidden = scStatus === "idle"; $("scNext").disabled = nav.next === null; }
  const panel = $("panelScenarios");
  if (panel) panel.classList.toggle("scPlaying", isScenarioPlaybackActive());
  scBodyFlag("scPaused", scIsPaused());
  /* FLUYO-018.12: en móvil la hoja se compacta mientras se reproduce, para que se vea la Historia en el lienzo. */
  scBodyFlag("scPlaybackOn", isScenarioPlaybackActive());
  if ($("scEventNew")) $("scEventNew").disabled = isScenarioPlaybackActive();
  if ($("scPaletteToggle")) $("scPaletteToggle").disabled = isScenarioPlaybackActive();
  /* FLUYO-018.17 (D3): nada inerte mientras se reproduce (la paleta no se puede usar); el estado va al CSS de la hoja. */
  if ($("scPaletteToggle")) $("scPaletteToggle").hidden = isScenarioPlaybackActive();
  if (panel && panel.setAttribute) panel.setAttribute("data-sc-status", scStatus);
  /* Hoja compacta sin pasos: en vez de un botón deshabilitado sin explicación, la pista «Añade eventos desde Ampliar». */
  const hint = $("scRunHint");
  if (hint && run) {
    const sheet = typeof isSheetLayout === "function" && isSheetLayout();
    const show = sheet && scStatus === "idle" && !!s && !s.steps.length && s.engineVersion === FluyoScenarios.ENGINE_VERSION;
    hint.hidden = !show;
    if (show) run.hidden = true;
  }
  if (typeof syncStoryState === "function") syncStoryState();
}
function scRenderStatus() {
  scRenderNow();
  scRenderFlow();
  const el = $("scStatus");
  if (!el) return;
  el.textContent =
    scStatus === "idle"
      ? ""
      : scStatus === "running"
        ? "Reproduciendo · " + scFormatTime(scPlayback?.cursorVirtual || 0)
        : "Reproducción terminada";
}
/* FLUYO-018.14b (B9): qué está pasando ahora, con la misma lectura que Present (FluyoStory.describe). Solo escribe si
   cambia; se llama desde scTick a cada fotograma. */
let scNowLast = "";
function scRenderNow() {
  const box = $("scNow");
  if (!box) return;
  const sc = scActiveScenario();
  const on = scStatus !== "idle" && !!scPlayback && !!sc;
  let label = "", caption = "", progress = "";
  if (on) {
    const d = (typeof FluyoStoryClock !== "undefined" ? FluyoStoryClock : FluyoStory).describe(scStatus === "running" ? "playing" : "finished", sc, scPlayback, (id) => scNodeFallback(id), (id) => edgeById(id));
    label = scStatus === "running" ? (scIsPaused() ? "En pausa" : "Reproduciendo") : "Terminada";
    caption = scStatus === "running" ? (d.caption ? d.title + " · " + d.caption : d.title) : d.summary ? d.caption + " · " + d.summary : d.caption;
    progress = d.moments.length > 1 ? Math.max(0, d.idx + 1) + " / " + d.moments.length : "";
  }
  const sig = [on, label, caption, progress].join("|");
  if (sig === scNowLast) return;
  scNowLast = sig;
  box.hidden = !on;
  if (box.classList) box.classList.toggle("paused", scIsPaused());
  if (box.classList) box.classList.toggle("done", scStatus === "completed");
  if ($("scNowLabel")) $("scNowLabel").textContent = label;
  if ($("scNowCaption")) $("scNowCaption").textContent = caption;
  if ($("scNowProgress")) $("scNowProgress").textContent = progress;
}
/* FLUYO-018.18 (D4): el momento activo se cuenta SOBRE el lienzo (#scNow vive en #wrap), arriba de la zona libre. Si el
   destino de ese momento queda debajo del rótulo, el rótulo baja al pie de la zona libre; nunca tapa lo que se está contando.
   Se llama en cada fotograma (editor-runtime.js) y solo escribe cuando cambia. Coordenadas de lienzo (px CSS). */
let scNowPlace = "";
function scMomentRects() {
  const sc = scActiveScenario(), n = scMomentNav();
  if (!sc || n.index < 0) return [];
  const at = FluyoStoryClock.momentTimes(sc)[n.index], out = [];
  const box = (x0, y0, x1, y1) => ({ left: x0 * viewZoom + viewX, top: y0 * viewZoom + viewY, right: x1 * viewZoom + viewX, bottom: y1 * viewZoom + viewY });
  for (const step of sc.steps) {
    if (step.at !== at) continue;
    if (step.edgeId) {
      /* una conexión cuenta con su recorrido y con sus dos extremos (sale de uno y llega al otro) */
      const e = edgeById(step.edgeId), pts = e && typeof edgePoints === "function" ? edgePoints(e) : null;
      if (pts && pts.length) out.push(box(Math.min(...pts.map((p) => p.x)), Math.min(...pts.map((p) => p.y)), Math.max(...pts.map((p) => p.x)), Math.max(...pts.map((p) => p.y))));
      for (const nd of e ? [nodeById(e.from), nodeById(e.to)] : []) if (nd) out.push(box(nd.x - nd.w / 2, nd.y - nd.h / 2, nd.x + nd.w / 2, nd.y + nd.h / 2));
    } else {
      const nd = nodeById(step.nodeId);
      if (nd) out.push(box(nd.x - nd.w / 2, nd.y - nd.h / 2, nd.x + nd.w / 2, nd.y + nd.h / 2));
    }
  }
  return out;
}
function scPlaceNow() {
  const card = $("scNow");
  if (!card || card.hidden || typeof cv === "undefined" || typeof visibleCanvasRect !== "function") return;
  const v = visibleCanvasRect(), cr = cv.getBoundingClientRect(), wr = $("wrap").getBoundingClientRect();
  /* FLUYO-018.19: centrado en la zona libre (con la hoja lateral abierta, a su izquierda). Si arriba y abajo tapa el destino
     —en apaisado el lienzo es bajo y ancho—, se prueba a los lados, arriba y abajo: el rótulo no cubre nunca el momento. */
  const w = card.offsetWidth, h = card.offsetHeight, M = 10, rects = scMomentRects();
  const center = v.left + (v.width - w) / 2, toLeft = v.left + M, toRight = v.right - w - M;
  const hit = (x, y) => rects.some((r) => r.right > x - 8 && r.left < x + w + 8 && r.bottom > y - 8 && r.top < y + h + 8);
  const top = v.top + M, bottom = v.bottom - h - M;
  const spots = [[center, top], [center, bottom]];
  if (toRight - toLeft > 16) spots.push([toLeft, top], [toRight, top], [toLeft, bottom], [toRight, bottom]);
  const [left, y] = spots.find(([x, yy], i) => (i === 0 || yy > top || bottom > top) && !hit(x, yy)) || spots[0];
  const cx = Math.round(left + w / 2 + cr.left - wr.left);
  const key = Math.round(y + cr.top - wr.top) + "|" + (y !== top) + "|" + cx;
  if (key === scNowPlace) return;
  scNowPlace = key;
  card.style.top = Math.round(y + cr.top - wr.top) + "px";
  card.style.left = cx + "px";
  if (card.classList) card.classList.toggle("atBottom", y !== top);
}
/* ===================== Ruta observada (SCENARIOS-SEMANTICS-001 FASE 3; D5, D6, decisión 233) =====================
   Herramienta bajo el transporte (#scFlow). Existe si la página tiene alguna conexión Flujo y la Historia activa tiene eventos
   (FASE 6, decisión 253: sin la bandera labs, que se retiró). Lee la derivación de flow-semantics.js con el reloj de la Historia:
     · reproduciendo (también en pausa, tras un salto y terminada): el Trace VISIBLE de la reproducción y su cursor;
     · sin reproducir: la misma receta (FluyoStory.run + horario visible de story-clock.js) en el instante 0: «Al inicio · ».
   La base (Trace visible y reloj de los Steps) se memoiza: por reproducción, o por firma del documento sin reproducir. El
   estado se evalúa en cada fotograma de la reproducción y el DOM solo se escribe si cambia. Elegir o quitar la ruta escribe
   AMBOS extremos con UNA entrada de Undo (setObservedFlowIn); cambiar de Historia no escribe. No pinta nada en el lienzo. */
const SC_FLOW_WORDS = {
  AVAILABLE: "Ruta disponible",
  UNAVAILABLE: "Ruta no disponible",
  NO_PATH: "Sin ruta de flujo",
  byDefault: "incluye estados por defecto",
  atStart: "Al inicio · ",
  auto: "Automática",
  noPair: "Elige origen y destino",
  missing: "Un extremo de la ruta ya no existe",
  gone: "—",
  /* FASE 4: línea de tiempo y filas (los del prototipo validado por el PO; § 3.1 y D6) */
  short: { AVAILABLE: "disponible", UNAVAILABLE: "no disponible" },
  none: "ninguno",
  via: "vía ",
  more: " rutas",
  oneMore: " ruta",
  tooMany: "Más de 10 000 rutas",   // recuento no exacto (QA del PO): nunca un número derivado del tope interno
};
let scFlowBase = { key: null, value: null }, scFlowLast = null, scFlowPending = null;
function scFlowShown(pg, sc) {
  return typeof FluyoFlow !== "undefined" && !!pg && !!sc && sc.steps.length > 0 && pg.edges.some((e) => edgeKind(e) === "FLOWS_TO");
}
/* Trace visible y reloj de los Steps de la Historia. Reproduciendo, los de la reproducción; si no, la receta única en edición. */
function scFlowTimeline(pg, sc) {
  if (scPlayback && isScenarioPlaybackActive()) {
    if (scFlowBase.key !== scPlayback) {
      const pb = scPlayback;
      scFlowBase = { key: pb, value: { ok: true, events: pb.trace.events, timeOf: (st) => FluyoStoryClock.visibleAt(pb, st), end: scFlowVisibleEnd(pb.trace.events, pb.stepMeta) } };
    }
    return scFlowBase.value;
  }
  const meta = FluyoStory.stepMeta(sc.steps);
  const key = JSON.stringify([sc.id, pg.nodes.map((n) => n.id), pg.edges.map((e) => [e.id, e.from, e.to, edgeKind(e)]), pg.behaviors, sc.steps, sc.arrivalDependencies || null, meta]);
  if (scFlowBase.key !== key) {
    const run = FluyoStory.run(pg, sc);
    let value = { ok: false };
    if (run.ok) {
      const sch = FluyoStoryClock.schedule(sc, meta);
      const events = sch.shifted ? FluyoStoryClock.visibleTrace(run.trace, sch.byStep).events : run.trace.events;
      value = { ok: true, events, timeOf: (st) => (sch.byStep[st.id] !== undefined ? sch.byStep[st.id] : st.at), end: scFlowVisibleEnd(events, meta) };
    }
    scFlowBase = { key, value };
  }
  return scFlowBase.value;
}
/* FASE 4 (D6): fin VISIBLE de la Historia = el instante en que la reproducción queda «terminada» (FluyoStory.isFinished): el
   último envío llega y su señal breve se apaga (viaje + TERMINAL_MS) y el último efecto de elemento acaba. Las mismas
   duraciones que el Playback (travelMs es la de story-clock.js; el efecto, visualDurationMs del Step). */
function scFlowVisibleEnd(events, meta) {
  const PB = FluyoScenarioPlayback;
  let end = 0;
  for (const ev of events) {
    let d = 0;
    if (ev.type === "send_started") d = FluyoStoryClock.travelMs(meta, ev.stepId) + PB.TERMINAL_MS;
    else if (ev.type === "state_changed" || ev.type === "event_occurred") {
      const fx = meta && meta[ev.stepId] && meta[ev.stepId].nodeEffects, ms = fx && fx.visualDurationMs;
      d = typeof ms === "number" && Number.isFinite(ms) && ms > 0 ? ms : PB.NODE_EFFECT_CUE_MS;
    }
    end = Math.max(end, ev.at + d);
  }
  return end;
}
/* ─────────── FASE 4 — Experiencia de la ruta (D6, § Pintado, § 3.1; decisiones 241–244) ───────────
   Sobre la MISMA base que el estado (Trace visible y fin visible): la ruta estructural, la línea de tiempo y las filas
   (flow-semantics.js). Se memoiza por base, página y par; nada se escribe en el documento ni en la pila de Undo. */
const SC_FLOW_ROWS = 3;
let scFlowRouteMemo = { base: null, value: null };
function scFlowRouteData(pg, sc) {
  const pair = FluyoFlow.resolveObservedFlow(pg, sc);
  if (pair.state !== FluyoFlow.PAIR) return null;
  const base = scFlowTimeline(pg, sc);
  if (!base.ok) return null;
  const m = scFlowRouteMemo;
  if (m.base === base && m.page === pg && m.source === pair.source && m.target === pair.target && m.edges === pg.edges.length && m.nodes === pg.nodes.length) return m.value;
  const route = FluyoFlow.flowRoute(pg, pair.source, pair.target);
  const tl = FluyoFlow.routeTimeline(pg, route, base.events, base.end);
  const value = { route, tl, paths: tl ? FluyoFlow.routePaths(route, SC_FLOW_ROWS) : null };
  scFlowRouteMemo = { base, page: pg, source: pair.source, target: pair.target, edges: pg.edges.length, nodes: pg.nodes.length, value };
  return value;
}
/* Vista de la línea de tiempo y de las filas en el instante t (sin DOM). Sin timeline (NO_PATH, sin par): null. */
function scFlowTrackView(d, t, playing) {
  if (!d || !d.tl) return { track: null, rows: [] };
  const tl = d.tl, pct = (v) => (Math.min(1, Math.max(0, v / tl.end)) * 100).toFixed(3);
  const W = SC_FLOW_WORDS, now = tl.instants[FluyoFlow.routeInstantAt(tl, t)];
  const track = {
    segments: tl.segments.map((s) => ({ left: pct(s.from), width: (pct(s.to) - pct(s.from)).toFixed(3), state: s.status })),
    marks: tl.marks.map((k) => ({ left: pct(k.at), frontier: k.frontier })),
    start: W.short[tl.start], count: tl.frontiers ? String(tl.frontiers) : W.none, final: W.short[tl.final],
    cursor: playing ? pct(t) : null,
  };
  const rows = [];
  if (d.paths && d.paths.total >= 2) {
    const must = new Set(d.paths.mustPass), name = (ids) => ids.map((id) => scNodeFallback(id)).join(" → ");
    for (const p of d.paths.paths) {
      const via = p.filter((id) => !must.has(id)), state = p.every((id) => now.states[id] === "UP") ? FluyoFlow.AVAILABLE : FluyoFlow.UNAVAILABLE;
      rows.push({ state, text: (via.length ? W.via + name(via) : name(p)) + " · " + W.short[state], title: name(p) });
    }
    const more = d.paths.total - d.paths.paths.length;
    if (!d.paths.exact) rows.push({ state: "", text: W.tooMany, title: "" });
    else if (more > 0) rows.push({ state: "", text: "+" + more + (more === 1 ? W.oneMore : W.more), title: "" });
  }
  return { track, rows };
}
/* Lo que el lienzo pinta de la ruta en este fotograma (render.js lo recibe en scenarioRuntime.flow). Solo reproduciendo, con la
   herramienta (Flujo, eventos), con par y con ruta (NO_PATH no pinta fundas, D-Ruta). FASE 5 (D8, decisión 245): también en
   Present, con la misma receta que el Viewer (FluyoFlow.routeOverlay). Todo sale del cursor VIRTUAL: en pausa el dibujo queda
   quieto y un salto da el de una reproducción continua (§ T1). */
function scFlowOverlay() {
  if (!scPlayback || !isScenarioPlaybackActive()) return null;
  const pg = P(), sc = scActiveScenario();
  if (!scFlowShown(pg, sc)) return null;
  let d = null;
  try { d = scFlowRouteData(pg, sc); } catch (err) { if (err && typeof err.code === "string") return null; throw err; }
  if (!d || !d.tl) return null;
  return FluyoFlow.routeOverlay(pg, d.route, d.tl, scPlayback.cursorVirtual || 0);
}
/* FASE 5 (D8, decisión 246): la línea de estado de la ruta en el rótulo de Present (#psFlow, present-story.js; solo la pide
   reproduciendo). Es la MISMA línea que la herramienta (texto, procedencia y estado), solo con par resuelto: sin par o con un
   extremo perdido, nada. */
function scFlowPresentLine() {
  const m = scFlowModel();
  if (!m || !m.status) return null;
  return { status: m.status, text: m.word + (m.why ? " · " + m.why : "") };
}
/* Modelo de la herramienta (sin DOM): qué se ve, con qué valores y qué texto. null = la herramienta no existe. */
function scFlowModel() {
  const pg = P(), sc = scActiveScenario();
  if (!scFlowShown(pg, sc)) return null;
  const playing = isScenarioPlaybackActive() && !!scPlayback;
  const m = { playing, pair: null, status: null, explicitPath: null, from: "auto", to: "auto", fromOptions: [], toOptions: [], word: "", why: "" };
  let flowIds = [];
  try {
    flowIds = FluyoFlow.flowNodes(pg);
    m.pair = FluyoFlow.resolveObservedFlow(pg, sc);
    const tl = scFlowTimeline(pg, sc);
    if (tl.ok && m.pair.state === FluyoFlow.PAIR) {
      const r = FluyoFlow.observedFlowAt(pg, sc, tl.events, playing ? scPlayback.cursorVirtual || 0 : 0, tl.timeOf);
      m.status = r.status;
      m.explicitPath = r.explicitPath;
    }
  } catch (err) {
    if (!err || typeof err.code !== "string") throw err;
    m.pair = m.pair || { state: FluyoFlow.NO_PAIR, origin: null, source: null, target: null, missing: [] };
  }
  const p = m.pair, saved = sc.observedFlow;
  if (p.origin === "story") {
    m.from = p.missing.includes("from") ? "" : String(saved.from);
    m.to = p.missing.includes("to") ? "" : String(saved.to);
  }
  /* Elección a medias (solo en la sesión): un extremo elegido sin el otro todavía no escribe nada. */
  const pend = scFlowPending;
  if (pend && pend.storyId === sc.id && (p.origin !== "story" || m[pend.end] === "")) m[pend.end] = String(pend.id);
  /* Opciones: los nodos de algún Flujo (orden del documento) y los extremos guardados que siguen existiendo aunque ya no
     participen. Cada selector excluye lo que muestra el otro: origen = destino es imposible. */
  const ids = flowIds.slice();
  for (const k of ["from", "to"]) if (saved && pg.nodes.some((n) => n.id === saved[k]) && !ids.includes(saved[k])) ids.push(saved[k]);
  const shownOf = (end) => (m[end] !== "auto" && m[end] !== "" ? +m[end] : p.origin === "structural" ? (end === "from" ? p.source : p.target) : null);
  const autoText = (end) => {
    const id = p.origin === "structural" ? (end === "from" ? p.source : p.target) : null;
    return id !== null ? SC_FLOW_WORDS.auto + " · " + scNodeFallback(id) : SC_FLOW_WORDS.auto;
  };
  for (const end of ["from", "to"]) {
    const other = shownOf(end === "from" ? "to" : "from");
    const list = [{ value: "auto", text: autoText(end) }];
    if (m[end] === "") list.push({ value: "", text: SC_FLOW_WORDS.gone, disabled: true });
    for (const id of ids) if (id !== other) list.push({ value: String(id), text: scNodeFallback(id) });
    m[end + "Options"] = list;
  }
  if (p.state === FluyoFlow.ENDPOINT_MISSING) m.word = SC_FLOW_WORDS.missing;
  else if (p.state === FluyoFlow.NO_PAIR) m.word = SC_FLOW_WORDS.noPair;
  else if (m.status) {
    m.word = (playing ? "" : SC_FLOW_WORDS.atStart) + SC_FLOW_WORDS[m.status];
    m.why = m.status === FluyoFlow.AVAILABLE && m.explicitPath === false ? SC_FLOW_WORDS.byDefault : "";
  }
  /* FASE 4: línea de tiempo (edición: completa y sin cursor; reproduciendo: con el cursor) y filas de la ruta */
  let d = null;
  try { d = m.status && m.status !== FluyoFlow.NO_PATH ? scFlowRouteData(pg, sc) : null; } catch (err) { if (!err || typeof err.code !== "string") throw err; }
  Object.assign(m, scFlowTrackView(d, playing ? scPlayback.cursorVirtual || 0 : 0, playing));
  return m;
}
function scRenderFlow() {
  const box = $("scFlow");
  if (!box) return;
  const m = scFlowModel();
  scRenderFlowCursor(m);
  const sig = m ? JSON.stringify([m.from, m.to, m.fromOptions, m.toOptions, m.word, m.why, m.status, m.playing, m.track && Object.assign({}, m.track, { cursor: null }), m.rows]) : "hidden";
  if (sig === scFlowLast) return;
  scFlowLast = sig;
  scRenderFlowTrack(m);
  box.hidden = !m;
  if (!m) return;
  for (const end of ["from", "to"]) {
    const sel = $(end === "from" ? "scFlowFrom" : "scFlowTo");
    sel.replaceChildren(...m[end + "Options"].map((o) => {
      const opt = scEl("option", "", o.text);
      opt.value = o.value;
      if (o.disabled) opt.disabled = true;
      return opt;
    }));
    sel.value = m[end];
    sel.title = (m[end + "Options"].find((o) => o.value === m[end]) || { text: "" }).text;   // el texto entero aunque el selector lo recorte
    sel.disabled = m.playing;
  }
  box.dataset.state = m.status || (m.pair ? m.pair.state : "");
  $("scFlowWord").textContent = m.word;
  $("scFlowWhy").textContent = m.why ? " · " + m.why : "";
}
/* FASE 4: tramos, marcas, extremos y filas (solo cuando cambian) y el cursor (cada fotograma, solo si se mueve). */
function scRenderFlowTrack(m) {
  const track = m && m.track, rows = (m && m.rows) || [];
  $("scFlowTrack").hidden = !track;
  $("scFlowEnds").hidden = !track;
  if (track) {
    $("scFlowSegs").replaceChildren(...track.segments.map((s) => {
      const el = scEl("span", "scFlowSeg");
      el.dataset.state = s.state;
      el.style.left = s.left + "%";
      el.style.width = s.width + "%";
      return el;
    }));
    $("scFlowMarks").replaceChildren(...track.marks.map((k) => {
      const el = scEl("span", k.frontier ? "scFlowMark scFlowFrontier" : "scFlowMark");
      el.style.left = k.left + "%";
      return el;
    }));
    $("scFlowStart").textContent = track.start;
    $("scFlowCount").textContent = track.count;
    $("scFlowFinal").textContent = track.final;
  }
  $("scFlowRows").hidden = !rows.length;
  $("scFlowRows").replaceChildren(...rows.map((r) => {
    const li = scEl("li", r.state ? "scFlowRow" : "scFlowRow scFlowMore", r.text);
    if (r.state) li.dataset.state = r.state;
    if (r.title) li.title = r.title;
    return li;
  }));
}
let scFlowCursorLast;   // sin valor: el primer pintado siempre escribe (también «oculto»)
function scRenderFlowCursor(m) {
  const at = m && m.track ? m.track.cursor : null;
  if (at === scFlowCursorLast) return;
  scFlowCursorLast = at;
  const el = $("scFlowCursor");
  el.hidden = at === null;
  if (at !== null) el.style.left = at + "%";
}
/* Elegir un extremo. «Automática» quita la ruta guardada (si la hay). Un nodo escribe los DOS extremos: el otro es el que
   muestra su selector (el guardado o el automático); si el otro no tiene valor, la elección espera a que lo tenga. */
function scFlowPick(end) {
  const sc = scActiveScenario(), m = scFlowModel();
  if (!sc || !m || m.playing) return;
  const value = $(end === "from" ? "scFlowFrom" : "scFlowTo").value;
  if (value === "auto") {
    scFlowPending = null;
    scFlowWrite(sc, null);
    return;
  }
  if (value === "") return;
  const otherEnd = end === "from" ? "to" : "from", p = m.pair;
  let other = m[otherEnd] !== "auto" && m[otherEnd] !== "" ? +m[otherEnd] : null;
  if (other === null && p.origin === "structural") other = otherEnd === "from" ? p.source : p.target;
  if (other === null || other === +value) {
    scFlowPending = { storyId: sc.id, end, id: +value };
    scFlowLast = null;
    scRenderFlow();
    return;
  }
  scFlowPending = null;
  scFlowWrite(sc, end === "from" ? { from: +value, to: other } : { from: other, to: +value });
}
/* Escribe por el dominio con UNA entrada de Undo. Lo que no cambiaría nada (o el dominio rechaza) no apila. */
function scFlowWrite(sc, flow) {
  const pg = P();
  const probe = { nodes: pg.nodes, scenarios: [JSON.parse(JSON.stringify(sc))] };
  let r;
  try {
    r = setObservedFlowIn(probe, sc.id, flow);
  } catch (err) {
    if (err && typeof err.code === "string") { scFlowLast = null; scRenderFlow(); return; }
    throw err;
  }
  if (r.changed) {
    pushUndo();
    setObservedFlowIn(pg, sc.id, flow);
    scheduleAutosave();
  }
  scFlowLast = null;
  scRenderFlow();
}
/* ===================== fin de la ruta observada ===================== */

function scScenarioMenu(anchor) {
  const none = !scActiveScenario();
  scMenu(anchor, [
    ["Renombrar", () => scRenameUI(anchor), none],
    ["Duplicar historia", scDuplicateScenario, none],
    ["Eliminar historia", scDeleteScenario, none],
    ["Condiciones iniciales de esta página", () => scOpenDetails("conditions")],
    ["Detalles", () => scOpenDetails("trace")],
  ]);
}
function scChooseScenario(anchor) {
  const active = scActiveScenario();
  scMenu(anchor, [
    ...(P().scenarios || []).map((s) => [(active && s.id === active.id ? "● " : "○ ") + s.name, () => scSwitchScenario(s.id)]),
    ["+ Nueva historia", scNewScenario],
  ]);
}
function scRenameUI(anchor) {
  const p = scOpenPopover(anchor);
  if (!p) return;
  const label = scEl("label", "", "Nombre de la historia"),
    input = scEl("input");
  input.value = scActiveScenario()?.name || "";
  input.maxLength = 120;
  label.appendChild(input);
  p.appendChild(label);
  const save = () => {
    if (!input.value.trim()) return;
    scRenameScenario(input.value);
    scClosePopover();
  };
  p.appendChild(scButton("Guardar nombre", save));
  input.onkeydown = (e) => {
    if (e.key === "Enter") {
      /* Sin esto, el foco vuelve al botón ⋯ durante la misma pulsación y Enter lo activa: el menú se reabría. */
      e.preventDefault();
      save();
    }
  };
}
function scRenderCanvasActions() {} // La autoría ya no vive en el inspector de propiedades.
function scOpenDetails(kind) {
  scClosePopover(false);
  const dlg = $("scDetailsDialog");
  $("scDetailsTitle").textContent =
    kind === "conditions"
      ? "Condiciones iniciales de esta página"
      : kind === "uses"
        ? "Dónde se usa este evento"
        : "Detalles";
  $("scBehaviors").hidden = kind !== "conditions";
  $("scTraceLog").hidden = kind !== "trace";
  $("scEventUses").hidden = kind !== "uses";
  scRenderBehaviors();
  scRenderTraceLog();
  dlg.showModal();
}
function scRenderBehaviors() {
  const box = $("scBehaviors");
  if (!box) return;
  box.replaceChildren(scEl("p", "hint", "Estas condiciones afectan a las historias de esta página."));
  if (!P().nodes.length)
    box.appendChild(scEl("p", "hint", "Añade un elemento al sistema para definir sus condiciones."));
  for (const n of P().nodes) {
    const row = scEl("div", "scBehaviorRow"),
      label = scEl("span", "", scNodeFallback(n.id)),
      select = scEl("select");
    select.setAttribute("aria-label", "Disponibilidad de " + scNodeFallback(n.id));
    for (const [value, text] of [
      ["UP", "Disponible"],
      ["DOWN", "No disponible"],
    ]) {
      const o = scEl("option", "", text);
      o.value = value;
      select.appendChild(o);
    }
    select.value = scBehaviorForNode(n.id) || "UP";
    select.disabled = isScenarioPlaybackActive();
    select.onchange = () => scSetBehavior(n.id, select.value);
    row.append(label, select);
    box.appendChild(row);
  }
}
function scShowUses(id) {
  const box = $("scEventUses");
  box.replaceChildren();
  doc.pages.forEach((page, pi) =>
    (page.scenarios || []).forEach((s) =>
      s.steps
        .filter((x) => x.eventTypeId === id)
        .forEach((step) => {
          box.appendChild(
            scButton(
              page.name + " · " + s.name,
              () => {
                scReset();
                doc.cur = pi;
                $("scDetailsDialog").close();
                renderTabs();
                refreshPanel();
                scSelectStory(s.id);
                scRenderPanel();
                scSelectedStep = step.id;
                scStorySignature = "";
                scRenderStoryboard();
              },
              "scUse",
            ),
          );
        }),
    ),
  );
  scOpenDetails("uses");
}
/* Biblioteca. Crear no crea ninguna aparición. */
function scRenderEventLibrary() {
  const box = $("scEventLibrary");
  if (!box) return;
  box.replaceChildren();
  const all = doc.eventTypes || [],
    search = $("scEventSearch");
  if (search) search.hidden = all.length <= 8;
  const query = search && !search.hidden ? search.value.trim().toLocaleLowerCase() : "";
  if ($("scPaletteToggle")) $("scPaletteToggle").textContent = "Eventos · " + all.length;
  if (!all.length) {
    const empty = scEl("div", "scEmptyState");
    empty.append(
      scEl("strong", "", "¿Qué puede ocurrir en tu sistema?"),
      scEl(
        "span",
        "",
        "Crea un evento, como Pago, Aprobación o Cierre. Después podrás arrastrarlo al sistema.",
      ),
    );
    box.appendChild(empty);
    return;
  }
  const filtered = all
    .filter((e) => e.name.toLocaleLowerCase().includes(query))
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
  if (!filtered.length) box.appendChild(scEl("p", "hint", "No hay eventos con ese nombre."));
  for (const et of filtered) {
    const row = scEl("div", "scEventRow" + (scNewEventId === et.id ? " new" : ""));
    row.dataset.eventTypeId = et.id;
    const place = scButton(
      "",
      () => {
        if (scSuppressClick) {
          scSuppressClick = false;
          return;
        }
        scBeginPlacement(et.id);
      },
      "scEventPlace",
    );
    place.setAttribute(
      "aria-label",
      et.name + ": colocar en " + (et.primitive === "FLOW" ? "una conexión" : "un elemento"),
    );
    place.disabled = isScenarioPlaybackActive();
    place.append(scEl("span", "scEventSymbol", eventSymbol(et)), scEl("span", "", et.name));
    place.onpointerdown = (ev) => {
      scSuppressClick = false;
      if (ev.button !== 0 || !scCanPlaceEvents()) return;
      scPointerStart = { eventTypeId: et.id, x: ev.clientX, y: ev.clientY };
    };
    const menu = scButton(
      "⋯",
      () =>
        scMenu(menu, [
          ["Editar evento", () => scOpenEventDialog(et.id)],
          ["Duplicar evento", () => scOpenEventDialog(et.id, true)],
          ["Eliminar de la biblioteca", () => scDeleteEventUI(et.id, menu)],
        ]),
      "scMore",
    );
    menu.setAttribute("aria-label", "Opciones de " + et.name);
    menu.disabled = isScenarioPlaybackActive();
    row.append(place, menu);
    box.appendChild(row);
  }
}
function scDeleteEventUI(id, anchor) {
  const et = eventTypeById(id);
  if (!et) return;
  if (eventTypeIsUsed(id)) {
    const p = scOpenPopover(anchor);
    p.append(
      scEl(
        "p",
        "",
        "Este evento se usa en " +
          eventTypeUseCount(id) +
          " lugares. Quítalo o reemplázalo allí antes de eliminarlo.",
      ),
      scButton("Ver dónde se usa", () => {
        scClosePopover(false);
        scShowUses(id);
      }),
    );
    return;
  }
  pushUndo();
  deleteEventType(id);
  scCommit();
  scNotice("Evento eliminado de la biblioteca. Puedes deshacer el cambio.");
}
/* Historia: agrupación temporal derivada, sin nuevas entidades persistidas. */
function scRenderStoryboard() {
  const board = $("scStoryboard"),
    empty = $("scEmptyState");
  if (!board) return;
  const s = scActiveScenario(),
    groups = scGroups();
  const signature = JSON.stringify([
    s?.id,
    s?.steps,
    s?.arrivalDependencies,
    doc.eventTypes,
    groups.flatMap((g) => g.steps.map((x) => [describeScenarioStep(x), scRuntimeStateForStep(x)])),
    scSelectedStep,
    scStatus,
  ]);
  if (signature === scStorySignature) return;
  scStorySignature = signature;
  const scroll = board.parentElement?.scrollTop || 0;
  board.replaceChildren();
  if (empty) {
    empty.replaceChildren();
    empty.hidden = !!groups.length;
    if (!s) {
      empty.append(
        scEl("p", "", "Aún no hay historias."),
        scButton("+ Nueva historia", scNewScenario),
      );
    } else
      empty.textContent = doc.eventTypes?.length
        ? "Arrastra un evento sobre el sistema para empezar."
        : "La historia aparecerá aquí.";
  }
  let prev = 0;
  for (const g of groups) {
    const section = scEl("div", "scStoryGroup");
    section.dataset.at = g.at;
    const delay = scButton(
      g.at === 0 ? "Al comenzar" : formatRelativeDelay(g.at - prev),
      () => scEditTime(g.steps[0].id, delay),
      "scDelay",
    );
    delay.disabled = isScenarioPlaybackActive();
    section.appendChild(delay);
    if (g.steps.length > 1) section.appendChild(scEl("div", "scTogether", "Al mismo tiempo"));
    const waits = s ? FluyoStoryClock.momentWaits(s, g.at) : [];
    if (waits.length) section.appendChild(scEl("div", "scWaits", "No empieza hasta que llegue " + scArrivalNames(waits)));
    for (const [index, step] of g.steps.entries()) {
      const row = scStoryRow(step);
      if (g.steps.length > 1 && !isScenarioPlaybackActive()) {
        const m = row.querySelector(".scStatusMark");
        m.textContent = index === g.steps.length - 1 ? "└" : "├";
        if (m.dataset) m.dataset.mark = index === g.steps.length - 1 ? "branchEnd" : "branch";
      }
      section.appendChild(row);
    }
    if (g.steps.length > 1 && g.steps.some((x) => x.action === "SET_STATE"))
      section.appendChild(
        scEl(
          "p",
          "scGroupWarning",
          "Estos eventos ocurren al mismo tiempo y el orden puede afectar el resultado.",
        ),
      );
    board.appendChild(section);
    prev = g.at;
  }
  if (board.parentElement) board.parentElement.scrollTop = scroll;
}
function scStoryRow(step) {
  const d = describeScenarioStep(step),
    r = scRuntimeStateForStep(step),
    row = scEl(
      "div",
      "scStoryRow scStatus_" +
        r.status +
        (d.missing ? " missing" : "") +
        (scSelectedStep === step.id ? " selected" : ""),
    );
  row.dataset.stepId = step.id;
  const labels = {
    pending: "Pendiente",
    active: "En curso",
    completed: "Completado",
    success: "Completado",
    failed: "No se completó",
  };
  const mark = scEl("span", "scStatusMark", isScenarioPlaybackActive() ? scStatusMark(r.status) : "●");
  mark.setAttribute("aria-label", labels[r.status]);
  /* FLUYO-018.14b: la marca se dibuja con el trazo del sistema según su estado (styles.css); el glifo queda como texto. */
  if (mark.dataset) mark.dataset.mark = isScenarioPlaybackActive() ? r.status : "dot";
  row.appendChild(mark);
  if (!isScenarioPlaybackActive() && !d.missing) {
    const handle = scButton("", () => {}, "scHandle");
    handle.type = "button";
    handle.setAttribute("aria-label", "Reordenar. Arrastra, o usa Alt y las flechas");
    handle.title = "Arrastra para cambiar el orden";
    handle.onpointerdown = (ev) => scStoryDragStart(ev, step, row, handle);
    handle.onkeydown = (ev) => {
      if (!ev.altKey || (ev.key !== "ArrowUp" && ev.key !== "ArrowDown")) return;
      ev.preventDefault();
      if (scMoveStep(step.id, ev.key === "ArrowUp" ? -1 : 1))
        $("scStoryboard")?.querySelector('[data-step-id="' + step.id + '"] .scHandle')?.focus();
    };
    row.appendChild(handle);
  }
  const text = scEl("div", "scStoryText");
  const missingSentence = d.missing
    ? d.targetType === "edge"
      ? "La conexión de este evento ya no existe."
      : "El elemento de este evento ya no existe."
    : null;
  const sentence = missingSentence || d.primary;
  const hasIdentity = !!(d.eventType && d.eventType.name);
  const primaryText = hasIdentity
    ? (d.eventType.visual.value ? d.eventType.visual.value + " " : "") + d.eventType.name
    : sentence;
  const main = scButton(
    primaryText,
    () => {
      /* FLUYO-018.18 (D6): reproduciendo (o en pausa, o terminada), tocar una fila salta a su momento; nada más. */
      if (isScenarioPlaybackActive()) { scSeekStep(step); return; }
      scSelectedStep = step.id;
      scSelectTarget(d.targetType, d.targetId);
      /* FLUYO-018.17 (D2): el lienzo contextualiza: si el destino no está en la zona libre, se trae (sin cambiar el zoom). */
      if (!d.missing && typeof cv !== "undefined" && scTargetOffscreen(step)) scRevealTarget(step, false);
      scStorySignature = "";
      scRenderStoryboard();
      // Una aparición es un objeto: al pulsarla se ofrecen sus acciones.
      if (!isScenarioPlaybackActive()) {
        const again = $("scStoryboard")?.querySelector('[data-step-id="' + step.id + '"] .scStepPrimary');
        if (again) scStoryMenu(step, again);
      }
    },
    "scStorySentence scStepPrimary",
  );
  text.appendChild(main);
  if (hasIdentity && sentence && scNormText(sentence) !== scNormText(d.eventType.name)) {
    text.appendChild(scEl("div", "scStepSecondary", sentence));
  }
  /* FLUYO-MCP-STEP-MESSAGE-001: el mensaje propio del paso (el texto de su globo), bajo la frase. Sin él, el globo es el del evento. */
  if (scStepMessage(step)) text.appendChild(scEl("div", "scStepMessage", "«" + step.message + "»"));
  if (r.detail) text.appendChild(scEl("div", "scStepDetail", r.detail));
  if (d.missing && !isScenarioPlaybackActive())
    text.appendChild(scButton("Elegir otro", () => scChangeTarget(step), "scStoryRepair"));
  if (!d.missing && typeof cv !== "undefined" && scTargetOffscreen(step))
    text.appendChild(scButton("Mostrar en el sistema", () => scRevealTarget(step), "scStoryRepair"));
  row.appendChild(text);
  if (isScenarioPlaybackActive()) {
    /* toda la fila es el objetivo táctil del salto, no solo el nombre del evento */
    row.classList.add("scSeekable");
    main.title = "Ir a este momento";
    row.onclick = (ev) => { if (ev && ev.target && ev.target.closest && ev.target.closest("button")) return; scSeekStep(step); };
  }
  if (!isScenarioPlaybackActive()) {
    const more = scButton("⋯", () => scStoryMenu(step, more), "scMore");
    more.setAttribute("aria-label", "Opciones de " + (d.eventType?.name || sentence));
    row.appendChild(more);
  }
  return row;
}
function scNormText(t) {
  return String(t || "").trim().toLowerCase();
}
function scTargetPosition(step) {
  if (step.edgeId) {
    const e = edgeById(step.edgeId),
      a = e && nodeById(e.from),
      b = e && nodeById(e.to);
    return a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : null;
  }
  return nodeById(step.nodeId);
}
/* FLUYO-018.17: «pantalla» es la zona libre del lienzo (visibleCanvasRect, ui.js: lienzo menos hoja, barra táctil y barra de
   colocación); sin ella, el lienzo entero. Un nodo cuenta entero (su caja), una conexión por su punto medio. */
function scVisibleRect() {
  if (typeof visibleCanvasRect === "function") return visibleCanvasRect();
  const r = cv.getBoundingClientRect();
  return { left: 0, top: 0, right: r.width, bottom: r.height, width: r.width, height: r.height };
}
function scTargetOffscreen(step) {
  const p = scTargetPosition(step);
  if (!p) return false;
  const v = scVisibleRect(), n = step.nodeId ? nodeById(step.nodeId) : null;
  const hw = n ? (n.w / 2) * viewZoom : 0, hh = n ? (n.h / 2) * viewZoom : 0;
  const x = p.x * viewZoom + viewX, y = p.y * viewZoom + viewY;
  return x - hw < v.left || y - hh < v.top || x + hw > v.right || y + hh > v.bottom;
}
function scRevealTarget(step, rerender = true) {
  const p = scTargetPosition(step);
  if (!p) return;
  const v = scVisibleRect();
  viewX = v.left + v.width / 2 - p.x * viewZoom;
  viewY = v.top + v.height / 2 - p.y * viewZoom;
  if (!rerender) return;
  scStorySignature = "";
  scRenderStoryboard();
}
/* El punto que la hoja de Historias quiere ver cuando la página no cabe a tamaño legible: el destino del paso seleccionado
   o, si no hay, el del primero (revealAboveSheet, ui.js). */
function scStoryFocusPoint() {
  const sc = scActiveScenario();
  if (!sc || !sc.steps.length) return null;
  const step = sc.steps.find((x) => x.id === scSelectedStep) || sc.steps[0];
  return scTargetPosition(step);
}
/* Menú de una aparición. Es un objeto narrativo («💵 Pago · Cliente paga a Comercio»), no una
   lista de botones: cabecera con el evento y dónde ocurre, cuatro grupos y submenús.
   Editar ≠ Cambiar: «Editar este evento» modifica el Evento de la biblioteca (afecta a todos
   sus usos); «Usar otro evento aquí» sólo cambia cuál usa ESTA aparición. */
function scStepTitle(step) {
  const d = describeScenarioStep(step);
  return d.eventType?.name ? (d.eventType.visual.value ? d.eventType.visual.value + " " : "") + d.eventType.name : d.primary;
}
function scWhereLabel(step) {
  if (step.edgeId) {
    const e = edgeById(step.edgeId),
      t = traversalEnds(e, step.reverse),
      a = e && nodeById(t.source),
      b = e && nodeById(t.target);
    return a && b ? scNodeFallback(a.id) + " → " + scNodeFallback(b.id) : "";
  }
  return step.nodeId && nodeById(step.nodeId) ? scNodeFallback(step.nodeId) : "";
}
function scStoryMenu(step, anchor) {
  const et = eventTypeById(step.eventTypeId),
    d = describeScenarioStep(step),
    uses = et ? eventTypeUseCount(et.id) : 0,
    ordered = scOrderedSteps(),
    index = ordered.findIndex((x) => x.id === step.id),
    where = scWhereLabel(step);
  const sameTime = () => {
    scCancelPlacement();
    scContext = { kind: "same", stepId: step.id, scenarioId: scActiveScenario().id, page: P() };
    scUpdatePlacementBar();
    if ($("panelScenarios").classList.contains("scCompact")) scTogglePalette();
  };
  const others = ordered.filter((x) => x.id !== step.id && !scIsTargetMissing(x));
  const moveItems = [
    { label: "Antes", fn: () => scMoveStep(step.id, -1), disabled: index <= 0 },
    { label: "Después", fn: () => scMoveStep(step.id, 1), disabled: index < 0 || index >= ordered.length - 1 },
    {
      label: "Al mismo tiempo que…",
      disabled: !others.length,
      sub: {
        title: "Al mismo tiempo que…",
        items: others.map((x) => ({ label: scStepTitle(x), hint: scWhereLabel(x), fn: () => scMoveStepTo(step.id, { kind: "join", anchorId: x.id, after: true }) })),
      },
    },
  ];
  const addItems = [{ label: "Otro evento…", fn: sameTime }];
  const waitItem = scArrivalMenuItem(step);
  if (et?.primitive === "FLOW") addItems.push({ label: "Esta misma acción en otras conexiones…", fn: () => scBeginMulti(step.id) });
  const sections = [
    [
      ...(et ? [{ label: "Editar este evento…", hint: uses > 1 ? "Cambia «" + et.name + "» en sus " + uses + " usos" : "Cambia «" + et.name + "»", fn: () => scOpenEventDialog(et.id) }] : []),
      { label: "Usar otro evento aquí…", hint: "Sólo cambia esta aparición", fn: () => scChangeEvent(step, anchor) },
    ],
    [
      { label: "Cambiar dónde ocurre…", hint: where ? "Ahora: " + where : "", fn: () => scChangeTarget(step) },
      ...(step.action === "SEND" ? [scReverseMenuItem(step)] : [scMessageMenuItem(step, anchor)]),
    ],
    [
      { label: "Duplicar", hint: "Al mismo tiempo, justo debajo", fn: () => scDuplicateStep(step.id) },
      { label: "Mover", sub: { title: "Mover", items: moveItems } },
      { label: "Añadir al mismo tiempo", sub: { title: "Añadir al mismo tiempo", items: addItems } },
      waitItem,
    ],
    [
      {
        label: "Eliminar",
        danger: true,
        fn: () => {
          scDeleteStep(step.id);
          scNotice("Quitado de esta historia. El evento sigue en la biblioteca.");
        },
      },
    ],
  ];
  scMenuSections(anchor, { title: scStepTitle(step), subtitle: d.primary !== scStepTitle(step) ? d.primary : "", sections });
}
/* FLUYO-STEP-REVERSE-003: «Invertir sentido» da la vuelta al Step en su misma conexión (A → B ⇄ B → A). Reutiliza
   setStepReverse (decisión 237): sin operación nueva, una sola entrada de Undo y la selección no cambia (decisión 189).
   El hint dice cómo QUEDARÁ, porque «Cambiar dónde ocurre» ya dice cómo está. Sin conexión no hay sentido que invertir. */
function scReverseMenuItem(step) {
  const flipped = scWhereLabel({ edgeId: step.edgeId, reverse: step.reverse !== true });
  return { label: "Invertir sentido", hint: flipped ? "Pasa a: " + flipped : "", fn: () => scToggleStepReverse(step.id), disabled: scIsTargetMissing(step) };
}
function scToggleStepReverse(id) {
  if (!scEditable()) return false;
  const sc = scActiveScenario(),
    s = sc.steps.find((x) => x.id === id);
  if (!s || s.action !== "SEND" || scIsTargetMissing(s)) return false;
  pushUndo();
  setStepReverse(sc, id, s.reverse !== true);
  scCommit();
  return true;
}
/* ─────────── FLUYO-MCP-STEP-MESSAGE-001: «Mensaje del paso…» (decisión 255) ───────────
   El texto del globo de ESTA aparición, en vez del mensaje de su evento (que sigue siendo el de todos sus usos). Solo en eventos de
   elemento: un envío no tiene globo. Reutiliza setStepMessage (model.js): una entrada de Undo, la selección no cambia y no toca
   tiempos, orden, objetivo ni dependencias. "" o solo espacios no son un mensaje: para quitarlo está «Quitar mensaje». */
function scStepMessage(step) {
  return step && step.action !== "SEND" && typeof step.message === "string" ? step.message : null;
}
function scMessageMenuItem(step, anchor) {
  const own = scStepMessage(step),
    fx = eventTypeById(step.eventTypeId)?.presentation?.nodeEffects;
  const hint = own ? "«" + own + "»" : fx?.message ? "Ahora el del evento: «" + fx.message + "»" : "Ahora sin mensaje";
  return { label: "Mensaje del paso…", hint, fn: () => scEditStepMessage(step.id, anchor), disabled: scIsTargetMissing(step) };
}
function scEditStepMessage(id, anchor) {
  if (!scEditable()) return;
  const step = scActiveScenario()?.steps.find((x) => x.id === id);
  if (!step || step.action === "SEND") return;
  const p = scOpenPopover(anchor);
  if (!p) return;
  const own = scStepMessage(step),
    fx = eventTypeById(step.eventTypeId)?.presentation?.nodeEffects;
  const label = scEl("label", "", "Mensaje de este paso"),
    input = scEl("input", "scMessageInput");
  input.value = own || "";
  input.maxLength = STEP_MESSAGE_MAX_LEN;
  if (fx?.message) input.placeholder = fx.message;
  label.appendChild(input);
  p.append(label, scEl("p", "", "Se ve en el globo de este paso, en lugar del mensaje del evento. No cambia tiempos."));
  const save = () => {
    if (!input.value.trim()) {
      input.setCustomValidity("Escribe el mensaje, o usa «Quitar mensaje».");
      input.reportValidity();
      return;
    }
    scSetStepMessage(id, input.value);
    scClosePopover();
  };
  input.oninput = () => input.setCustomValidity("");
  input.onkeydown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault(); // como en «Renombrar»: el Enter no debe reabrir el menú
      save();
    }
  };
  p.appendChild(scButton("Guardar mensaje", save));
  if (own)
    p.appendChild(
      scButton("Quitar mensaje", () => {
        scSetStepMessage(id, null);
        scClosePopover();
      }),
    );
  input.focus();
}
function scSetStepMessage(id, message) {
  if (!scEditable()) return false;
  const sc = scActiveScenario(),
    s = sc && sc.steps.find((x) => x.id === id);
  if (!s || s.action === "SEND") return false;
  if ((scStepMessage(s) ?? null) === message) return false;
  pushUndo();
  setStepMessage(sc, id, message);
  scCommit();
  return true;
}
/* Menú agrupado: cabecera opcional, secciones separadas y submenús que sustituyen el contenido
   (con «‹ Volver»). Cada entrada: {label, hint?, fn?, sub?:{title,items}, disabled?, danger?}. */
function scMenuSections(anchor, menu) {
  if (scMenuToggledOff(anchor)) return;
  const p = scOpenPopover(anchor);
  if (!p) return;
  const fill = (m, back) => {
    p.replaceChildren();
    if (back) p.appendChild(scButton("‹ Volver", () => { fill(back, null); p.querySelector("button")?.focus(); }, "scMenuBack"));
    if (m.title) p.appendChild(scEl("div", "scMenuHead", m.title));
    if (m.subtitle) p.appendChild(scEl("div", "scMenuSub", m.subtitle));
    const sections = m.sections || [m.items];
    sections.forEach((items, si) => {
      if (si > 0) p.appendChild(scEl("div", "scMenuSep"));
      for (const it of items) {
        const b = scButton(it.label, () => {
          if (it.sub) {
            fill({ title: it.sub.title, sections: [it.sub.items] }, m);
            p.querySelector(".scMenuBack")?.focus();
            return;
          }
          scClosePopover();
          it.fn?.();
        }, it.danger ? "scMenuDanger" : "");
        if (it.hint) b.appendChild(scEl("span", "scMenuHint", it.hint));
        if (it.sub) b.appendChild(scEl("span", "scMenuChevron", "▸"));
        b.disabled = !!it.disabled;
        p.appendChild(b);
      }
    });
  };
  fill(menu, null);
}
/* Duplicar: la copia entra en el MISMO momento, justo después del original («Al mismo
   tiempo»). Razón de producto: el usuario no pidió ninguna espera y el modelo no tiene dónde
   guardar una «espera por defecto» sin inventar tiempo ni desplazar el resto de la historia.
   Si quiere la copia en otro momento, la mueve (Mover ▸) o cambia su espera. */
function scDuplicateStep(id) {
  if (!scEditable()) return;
  const sc = scActiveScenario(),
    src = sc.steps.find((s) => s.id === id);
  if (!src) return;
  if (sc.steps.length >= FluyoScenarios.MAX_SCENARIO_STEPS) {
    scNotice("La historia ya tiene el máximo de eventos.");
    return;
  }
  pushUndo();
  const copy = duplicateStep(sc, id);
  scSetArrivalDependencies(sc, FluyoStoryClock.copyArrivalWaits(sc, id, copy.id));
  scSelectedStep = copy.id;
  scCommit();
  scNotice("Duplicado al mismo tiempo, justo debajo.");
}
/* ─────────── FLUYO-018.21: «Esperar a que llegue…» ───────────
   Una dependencia de llegada es de la HISTORIA (scenario.arrivalDependencies, story-clock.js): «este momento no empieza
   hasta que llegue este envío». Se declara desde un evento, pero espera su MOMENTO entero (es atómico), y solo admite
   envíos de momentos anteriores. Sin dependencias el campo no existe: las Historias antiguas no cambian. */
function scSetArrivalDependencies(sc, list) {
  if (list) sc.arrivalDependencies = list;
  else delete sc.arrivalDependencies;
}
function scArrivalNames(ids) {
  const sc = scActiveScenario();
  return ids
    .map((id) => sc && sc.steps.find((x) => x.id === id))
    .filter(Boolean)
    .map((x) => "«" + scStepTitle(x) + "»" + (scWhereLabel(x) ? " (" + scWhereLabel(x) + ")" : ""))
    .join(" y ");
}
function scArrivalMenuItem(step) {
  const sc = scActiveScenario(),
    cands = FluyoStoryClock.arrivalCandidates(sc, step.id),
    mine = FluyoStoryClock.stepWaits(sc, step.id),
    together = sc.steps.filter((x) => x.at === step.at).length;
  /* primero los envíos que llegan a donde ocurre este evento (o, si es un envío, a donde sale) */
  const here = step.edgeId ? traversalEnds(edgeById(step.edgeId), step.reverse).source : step.nodeId;
  const arrives = (x) => traversalEnds(edgeById(x.edgeId), x.reverse).target === here;
  const ordered = [...cands.filter(arrives), ...cands.filter((x) => !arrives(x))];
  const items = ordered.map((x) => {
    const on = mine.includes(x.id);
    return { label: (on ? "✓ " : "") + scStepTitle(x), hint: scWhereLabel(x), fn: () => scToggleArrivalWait(step.id, x.id, !on) };
  });
  if (mine.length) items.push({ label: "No esperar", hint: "Empieza a su hora", fn: () => scClearArrivalWaits(step.id) });
  return {
    label: "Esperar a que llegue…",
    hint: mine.length ? "Ahora: " + scArrivalNames(mine) : cands.length ? "Este momento no empieza hasta que llegue un envío" : "Antes tiene que haber un envío",
    disabled: !cands.length && !mine.length,
    sub: {
      title: together > 1 ? "Este momento (" + together + " eventos) no empieza hasta que llegue…" : "Este momento no empieza hasta que llegue…",
      items,
    },
  };
}
function scToggleArrivalWait(stepId, sendId, on) {
  if (!scEditable()) return;
  const sc = scActiveScenario(),
    send = sc.steps.find((x) => x.id === sendId),
    next = FluyoStoryClock.withArrivalWait(sc, stepId, sendId, on);
  if (JSON.stringify(next) === JSON.stringify(sc.arrivalDependencies || null)) return;
  pushUndo();
  scSetArrivalDependencies(sc, next);
  scCommit();
  if (send) scNotice(on ? "Este momento no empezará hasta que llegue «" + scStepTitle(send) + "»." : "Ya no espera a «" + scStepTitle(send) + "».");
}
function scClearArrivalWaits(stepId) {
  if (!scEditable()) return;
  const sc = scActiveScenario(),
    next = FluyoStoryClock.withoutArrivalWaits(sc, stepId);
  if (JSON.stringify(next) === JSON.stringify(sc.arrivalDependencies || null)) return;
  pushUndo();
  scSetArrivalDependencies(sc, next);
  scCommit();
  scNotice("Empieza a su hora: ya no espera ninguna llegada.");
}
function scEditTime(id, anchor) {
  if (!scEditable()) return;
  const groups = scGroups(),
    i = groups.findIndex((g) => g.steps.some((s) => s.id === id)),
    g = groups[i];
  if (!g) return;
  const p = scOpenPopover(anchor),
    label = scEl("label", "", "Espera desde el inicio anterior"),
    input = scEl("input");
  input.type = "number";
  input.min = 0;
  input.step = 0.001;
  input.value = (g.at - (groups[i - 1]?.at || 0)) / 1000;
  input.setAttribute("aria-label", "Espera en segundos");
  label.appendChild(input);
  p.append(label, scEl("p", "", "Segundos. Se desplazan también los eventos posteriores."));
  p.appendChild(
    scButton("Aplicar tiempo", () => {
      const ms = parseHumanDelay(input.value, "s");
      if (ms === null) {
        input.setCustomValidity("Escribe un tiempo igual o mayor que cero.");
        input.reportValidity();
        return;
      }
      scSetStepDelay(id, ms);
      scClosePopover();
    }),
  );
  for (const ms of [250, 500, 1000, 2000, 5000])
    p.appendChild(
      scButton(ms < 1000 ? ms + " ms" : ms / 1000 + " s", () => {
        scSetStepDelay(id, ms);
        scClosePopover();
      }),
    );
}
function scSetStepDelay(id, delay) {
  if (!Number.isSafeInteger(delay) || delay < 0 || !scEditable()) return;
  const sc = scActiveScenario(),
    r = storyboardSetWait(sc.steps, id, delay, FluyoScenarios.MAX_VIRTUAL_TIME_MS);
  if (!r) return;
  if (r.error) {
    scNotice("El tiempo está fuera del rango permitido.");
    return;
  }
  if (!r.changed) return;
  pushUndo();
  sc.steps = r.steps;
  scCommit();
}
/* Mover antes/después y arrastre comparten la semántica de model.js (storyboard*). */
function scMoveStep(id, dir) {
  if (!scEditable()) return false;
  const r = storyboardMoveByOne(scActiveScenario().steps, id, dir);
  if (!r) return false;
  pushUndo();
  scActiveScenario().steps = r.steps;
  scCommit();
  return true;
}
function scMoveStepTo(id, target) {
  if (!scEditable()) return false;
  const r = storyboardMoveStep(scActiveScenario().steps, id, target);
  if (!r || !r.changed) return false;
  pushUndo();
  scActiveScenario().steps = r.steps;
  scCommit();
  return true;
}
/* Arrastre directo en Historia. Nada se escribe en el documento hasta soltar:
   cancelar (Escape / pointercancel) no crea undo ni cambia la selección. */
function scStoryRowRects() {
  const board = $("scStoryboard"),
    rows = [];
  if (!board) return rows;
  const groups = [...board.querySelectorAll(".scStoryGroup")];
  groups.forEach((section, gi) => {
    const sr = section.getBoundingClientRect(),
      els = [...section.querySelectorAll(".scStoryRow")];
    els.forEach((el, k) => {
      const r = el.getBoundingClientRect();
      rows.push({
        stepId: Number(el.dataset.stepId),
        groupIndex: gi,
        groupSize: els.length,
        indexInGroup: k,
        // la primera/última fila absorben la espera y el aire del momento
        top: k === 0 ? sr.top : r.top,
        bottom: k === els.length - 1 ? sr.bottom : r.bottom,
      });
    });
  });
  return rows;
}
function scStoryDragCleanup() {
  const d = scStoryDrag;
  if (!d) return;
  scStoryDrag = null;
  d.ghost?.remove();
  d.line?.remove();
  d.row?.classList.remove("scDragSource");
  $("scStoryboard")?.classList.remove("scDragging");
  try { d.handle.releasePointerCapture(d.pointerId); } catch {}
  d.handle.removeEventListener("pointermove", scStoryDragMove);
  d.handle.removeEventListener("pointerup", scStoryDragEnd);
  d.handle.removeEventListener("pointercancel", scStoryDragCancel);
}
function scStoryDragStart(ev, step, row, handle) {
  if ((ev.pointerType === "mouse" && ev.button !== 0) || scStoryDrag || !scEditable()) return;
  ev.preventDefault();
  scStoryDrag = { id: step.id, pointerId: ev.pointerId, x: ev.clientX, y: ev.clientY, active: false, ghost: null, line: null, target: null, row, handle };
  try { handle.setPointerCapture(ev.pointerId); } catch {}
  handle.addEventListener("pointermove", scStoryDragMove);
  handle.addEventListener("pointerup", scStoryDragEnd);
  handle.addEventListener("pointercancel", scStoryDragCancel);
}
function scStoryDragMove(ev) {
  const d = scStoryDrag;
  if (!d || ev.pointerId !== d.pointerId) return;
  if (!d.active) {
    if (Math.hypot(ev.clientX - d.x, ev.clientY - d.y) < 4) return;
    if (!scEditable()) return scStoryDragCleanup();
    d.active = true;
    const step = scActiveScenario().steps.find((s) => s.id === d.id),
      info = describeScenarioStep(step);
    d.ghost = scEl("div", "scDragGhost scStoryGhost", (info.eventType ? eventSymbol(info.eventType) + " " + info.eventType.name : info.primary));
    document.body.appendChild(d.ghost);
    d.row.classList.add("scDragSource");
    $("scStoryboard").classList.add("scDragging");
  }
  d.ghost.style.left = Math.min(ev.clientX + 12, innerWidth - 240) + "px";
  d.ghost.style.top = Math.max(8, ev.clientY - 14) + "px";
  const scroller = $("scStoryboard").parentElement;
  if (scroller) {
    const sr = scroller.getBoundingClientRect();
    if (ev.clientY < sr.top + 28) scroller.scrollTop -= 10;
    else if (ev.clientY > sr.bottom - 28) scroller.scrollTop += 10;
  }
  const groups = scGroups(),
    src = groups.find((g) => g.steps.some((s) => s.id === d.id)),
    hit = storyboardDropTarget(scStoryRowRects(), d.id, ev.clientY, groups.length, src ? src.steps.length : 0),
    change = hit && storyboardMoveStep(scActiveScenario().steps, d.id, hit.target);
  d.target = change && change.changed ? hit.target : null;
  if (!d.target) {
    d.line?.remove();
    d.line = null;
    return;
  }
  const board = $("scStoryboard"),
    br = board.getBoundingClientRect();
  if (!d.line) {
    d.line = scEl("div", "scDropLine");
    d.line.appendChild(scEl("span", "", ""));
    board.appendChild(d.line);
  }
  d.line.dataset.kind = hit.line.kind;
  d.line.firstChild.textContent = hit.line.kind === "join" ? "al mismo tiempo" : "soltar aquí";
  d.line.style.top = hit.line.y - br.top + "px";
}
function scStoryDragEnd(ev) {
  const d = scStoryDrag;
  if (!d || ev.pointerId !== d.pointerId) return;
  const moved = d.active && d.target ? { id: d.id, target: d.target } : null;
  scStoryDragCleanup();
  if (moved && scMoveStepTo(moved.id, moved.target)) scNotice("Historia reordenada.");
}
function scStoryDragCancel() {
  scStoryDragCleanup();
}
function scChangeEvent(step, anchor) {
  const want =
    step.action === "SEND" ? "FLOW" : step.action === "SET_STATE" ? "SET_AVAILABILITY" : "OCCURRENCE";
  scMenu(
    anchor,
    (doc.eventTypes || [])
      .filter((e) => e.primitive === want)
      .map((e) => [
        e.name,
        () => {
          pushUndo();
          step.eventTypeId = e.id;
          if (want === "SET_AVAILABILITY") step.state = e.availability;
          scCommit();
        },
      ]),
  );
}
/* Editor de vocabulario: segmentos de texto y chips allowlisted. */
function scWhereValue() {
  return document.querySelector('input[name="scWhere"]:checked')?.value || "connection";
}
function scConsequenceValue() {
  return document.querySelector('input[name="scConsequence"]:checked')?.value || "none";
}
function scMotionValue() {
  return document.querySelector('input[name="scMotion"]:checked')?.value || DEFAULT_EVENT_MOTION;
}
function scRadioValue(name, allowed, fallback) {
  const v = document.querySelector('input[name="' + name + '"]:checked')?.value;
  return allowed.includes(v) ? v : fallback;
}
/* Metadata que consume Playback (sin el símbolo, que sale de eventSymbol). */
function scPlaybackEffects(et) {
  return FluyoStory.playbackEffects(et);
}
const SYMBOLS_SIZES_UI = SYMBOL_SIZES;
/* Cómo viaja el símbolo por una conexión (presentación pura; ver FLUYO-015). */
function scConnectionEffectsFromUI() {
  return {
    size: scRadioValue("scFlowSize", SYMBOL_SIZES, SYMBOL_SIZE_DEFAULT),
    style: scRadioValue("scFlowStyle", FLOW_STYLES, "direct"),
    trail: scRadioValue("scFlowTrail", FLOW_TRAILS, "none"),
    arrival: scRadioValue("scFlowArrival", FLOW_ARRIVALS, "none"),
    during: scRadioValue("scFlowDuring", FLOW_DURINGS, "none"),
  };
}
function scSetRadio(name, value) {
  document.querySelectorAll('input[name="' + name + '"]').forEach((e) => { e.checked = e.value === value; });
}
function scNodeEffectsFromUI() {
  const useMessage = $("scUseMessage").checked;
  return {
    showSymbol: $("scShowSymbol").checked,
    symbolSize: scRadioValue("scSymbolSize", SYMBOLS_SIZES_UI, SYMBOL_SIZE_DEFAULT),
    message: useMessage ? $("scMessage").value.trim().slice(0, NODE_EFFECT_MAX_MESSAGE_LEN) : "",
    messageColor: useMessage ? ($("scMessageColorCustom").value || scMessageColor) : "",
    messageSize: scRadioValue("scMsgSize", NODE_MESSAGE_SIZES, "medium"),
    messageWeight: scRadioValue("scMsgWeight", NODE_MESSAGE_WEIGHTS, "normal"),
    messageFont: scRadioValue("scMsgFont", NODE_MESSAGE_FONTS, "default"),
    messagePosition: scRadioValue("scMsgPos", NODE_MESSAGE_POSITIONS, "above"),
    highlight: $("scHighlight").checked,
    blink: $("scBlink").checked,
    dim: $("scDim").checked,
    fillColor: $("scUseFill").checked ? ($("scFillColorCustom").value || scFillColor) : "",
    ...scDurationFromUI(),
  };
}
/* «¿Cuánto tiempo se ve?» (presentación). Custom inválido → normal; el guardado lo rechaza antes. */
function scDurationFromUI() {
  const preset = scRadioValue("scVisDur", NODE_VISUAL_DURATIONS, NODE_VISUAL_DURATION_DEFAULT);
  if (preset !== "custom") return { visualDuration: preset, visualDurationMs: NODE_VISUAL_DURATION_MS[preset] };
  const ms = parseVisualDurationSeconds($("scDurationSeconds").value);
  return ms === null
    ? { visualDuration: NODE_VISUAL_DURATION_DEFAULT, visualDurationMs: NODE_VISUAL_DURATION_MS.normal }
    : { visualDuration: "custom", visualDurationMs: ms };
}
function scDurationInvalid() {
  return (
    scWhereValue() === "element" &&
    scRadioValue("scVisDur", NODE_VISUAL_DURATIONS, NODE_VISUAL_DURATION_DEFAULT) === "custom" &&
    parseVisualDurationSeconds($("scDurationSeconds").value) === null
  );
}
/* Lo que edita el modal → definición del EventType. La forma por primitiva (movimiento y efectos de conexión sólo en
   conexiones, efectos de elemento y disponibilidad sólo en elementos) es de model.js: la misma que usa MCP. */
function scEditorDefinition() {
  const connection = scWhereValue() === "connection",
    consequence = connection ? "none" : scConsequenceValue();
  return eventTypeDefinition({
    name: $("scEventName").value.trim(),
    primitive: eventTypePrimitiveFor(connection ? "connection" : "element", consequence),
    sentenceTemplate: scReadPhrase(),
    symbol: scVisual,
    motion: connection ? scMotionValue() : undefined,
    availability: consequence === "up" ? "UP" : "DOWN",
    connectionEffects: connection ? scConnectionEffectsFromUI() : undefined,
    nodeEffects: connection ? undefined : scNodeEffectsFromUI(),
  });
}
function scFillEffectsFromUI() {
  return $("scUseFill").checked ? $("scFillColor").value : "";
}
function scParsePhrase(template) {
  const parts = [];
  let last = 0;
  for (const m of template.matchAll(/\{(source|target|name)\}/g)) {
    parts.push({ text: template.slice(last, m.index) }, { token: m[1] });
    last = m.index + m[0].length;
  }
  parts.push({ text: template.slice(last) });
  return parts;
}
function scReadPhrase() {
  return scPhraseParts.map((p) => (p.token ? "{" + p.token + "}" : p.text)).join("");
}
function scRenderPhrase() {
  const box = $("scPhrase");
  box.replaceChildren();
  scPhraseParts.forEach((part, i) => {
    if (part.token) {
      const names = {
        source: "Origen",
        target: scWhereValue() === "connection" ? "Destino" : "Elemento",
        name: "Nombre del evento",
      };
      const chip = scButton(
        names[part.token],
        () => {
          scPhraseParts.splice(i, 1);
          scMergePhrase();
          scRenderPhrase();
          scUpdateEventPreview();
        },
        "scPhraseChip",
      );
      chip.setAttribute("aria-label", names[part.token] + ". Activar para quitar este nombre de la frase");
      box.appendChild(chip);
    } else {
      const input = scEl("input", "scPhraseText");
      input.type = "text";
      input.value = part.text;
      input.size = Math.max(1, [...part.text].length);
      input.setAttribute("aria-label", "Texto de la frase, segmento " + (i + 1));
      input.oninput = () => {
        part.text = input.value;
        input.size = Math.max(1, [...input.value].length);
        scUpdateEventPreview();
      };
      box.appendChild(input);
    }
  });
  const insert = $("scPhraseInsert");
  insert.replaceChildren();
  for (const [token, name] of (scWhereValue() === "connection"
    ? [
        ["source", "Origen"],
        ["target", "Destino"],
      ]
    : [["target", "Elemento"]]
  ).concat([["name", "Nombre del evento"]]))
    insert.appendChild(
      scButton("+ " + name, () => {
        scPhraseParts.push({ token }, { text: "" });
        scRenderPhrase();
        scUpdateEventPreview();
        box.querySelector("input:last-child")?.focus();
      }),
    );
}
const SC_DEFAULT_PHRASES = { connection: "{source} envía a {target}", element: "{target} cambia" };
/* Cambia de dónde ocurre sin pisar una frase escrita por la persona. */
function scSwitchPhraseForWhere() {
  const where = scWhereValue(),
    other = where === "connection" ? "element" : "connection",
    current = scReadPhrase();
  if (current === SC_DEFAULT_PHRASES[other] || !current.trim()) {
    scPhraseParts = scParsePhrase(SC_DEFAULT_PHRASES[where]);
  } else if (where === "element") {
    scPhraseParts = scPhraseParts.filter((p) => p.token !== "source");
    scMergePhrase();
  }
}
function scMergePhrase() {
  const parts = [];
  for (const p of scPhraseParts) {
    if (p.text !== undefined && parts.length && parts[parts.length - 1].text !== undefined)
      parts[parts.length - 1].text += p.text;
    else parts.push(p);
  }
  scPhraseParts = parts.length ? parts : [{ text: "" }];
}
function scOpenEventDialog(id, duplicate = false) {
  if (isScenarioPlaybackActive()) return;
  scCancelPlacement();
  scClosePopover(false);
  scFocusReturn = document.activeElement;
  const et = id ? eventTypeById(id) : null;
  scEditingEventTypeId = duplicate ? null : id;
  /* FLUYO-018.19: crear (no editar ni duplicar) termina colocando el evento nuevo (scSaveEventType). */
  scEventDialogMode = !et ? "create" : duplicate ? "duplicate" : "edit";
  const used = !!et && !duplicate && eventTypeIsUsed(id);
  $("scEventDialogTitle").textContent = et && !duplicate ? "Editar evento" : "Crear evento";
  $("scEventSave").textContent = et && !duplicate ? "Guardar cambios" : "Crear evento";
  $("scEventDialogSubtitle").textContent = "Disponible en todo este proyecto.";
  $("scEventName").value = et ? et.name + (duplicate ? " (copia)" : "") : "";
  document.querySelectorAll('input[name="scWhere"]').forEach((e) => {
    e.checked = e.value === (et && et.primitive !== "FLOW" ? "element" : "connection");
    e.disabled = used;
  });
  const consequence = et?.primitive === "SET_AVAILABILITY" ? (et.availability === "UP" ? "up" : "down") : "none";
  document.querySelectorAll('input[name="scConsequence"]').forEach((e) => {
    e.checked = e.value === consequence;
    e.disabled = used;
  });
  const effects = normalizeNodeEffects(et?.presentation?.nodeEffects);
  $("scShowSymbol").checked = effects.showSymbol;
  scSetRadio("scSymbolSize", effects.symbolSize);
  const flow = normalizeConnectionEffects(et?.presentation?.connectionEffects);
  scSetRadio("scFlowSize", flow.size);
  scSetRadio("scFlowStyle", flow.style);
  scSetRadio("scFlowTrail", flow.trail);
  scSetRadio("scFlowArrival", flow.arrival);
  scSetRadio("scFlowDuring", flow.during);
  for (const [name, value] of [["scMsgSize", effects.messageSize], ["scMsgWeight", effects.messageWeight], ["scMsgFont", effects.messageFont], ["scMsgPos", effects.messagePosition]])
    document.querySelectorAll('input[name="' + name + '"]').forEach((e) => { e.checked = e.value === value; });
  $("scUseMessage").checked = !!effects.message;
  $("scMessage").value = effects.message || "";
  scMessageColor = effects.messageColor || "#d0576a";
  $("scMessageColorCustom").value = scMessageColor;
  document.querySelectorAll('input[name="scVisDur"]').forEach((e) => { e.checked = e.value === effects.visualDuration; });
  $("scDurationSeconds").value = effects.visualDurationMs / 1000;
  $("scHighlight").checked = effects.highlight;
  $("scBlink").checked = effects.blink;
  $("scDim").checked = effects.dim;
  $("scUseFill").checked = !!effects.fillColor;
  scFillColor = effects.fillColor || "#3aa7e8";
  $("scFillColorCustom").value = scFillColor;
  $("scEventScope").hidden = !et || duplicate;
  $("scEventLocked").hidden = !used;
  $("scEventError").hidden = true;
  $("scCustomVisual").hidden = true;
  scVisual = et?.visual.value ?? DEFAULT_EVENT_SYMBOL;
  $("scEventVisual").value = scVisual;
  const motion = et?.motion || DEFAULT_EVENT_MOTION;
  document.querySelectorAll('input[name="scMotion"]').forEach((e) => {
    e.checked = e.value === motion;
  });
  scSetAccordionOpen("scFlowMore", !!et && (flow.during !== "none" || (et.motion || DEFAULT_EVENT_MOTION) !== DEFAULT_EVENT_MOTION));
  /* FLUYO-018.19: «Cómo se ve» empieza plegado al crear; al editar se abre si el evento ya no viaja como por defecto */
  const flowDefault = normalizeConnectionEffects(undefined);
  scSetAccordionOpen("scFlowLook", !!et && (Object.keys(flowDefault).some((k) => flow[k] !== flowDefault[k]) || (et.motion || DEFAULT_EVENT_MOTION) !== DEFAULT_EVENT_MOTION));
  scPhraseParts = scParsePhrase(et?.sentenceTemplate ?? "{source} envía a {target}");
  const hasAppearance = effects.showSymbol || effects.message || effects.highlight || effects.blink || effects.dim || effects.fillColor;
  scSetAccordionOpen("scAppearance", !!et && hasAppearance);
  scSetAccordionOpen("scBehavior", !!et && consequence !== "none");
  scEditorLayout();
  scRenderPhrase();
  scRenderVisualPicker();
  scRenderColorSwatches("scMessageSwatches", scMessageColor, "scMessageColorCustom");
  scRenderColorSwatches("scFillSwatches", scFillColor, "scFillColorCustom");
  scUpdateEventPreview();
  $("scEventDialog").showModal();
  $("scEventName").focus();
}
function scCloseEventDialog() {
  clearTimeout(scPreviewTimer);
  scPreviewStop();
  $("scEventDialog").close();
  scEditingEventTypeId = null;
  if (scFocusReturn?.isConnected) scFocusReturn.focus();
}
function scEditorLayout() {
  const connection = scWhereValue() === "connection";
  const flowLook = $("scFlowLook");
  if (flowLook) flowLook.hidden = !connection;
  const appearance = $("scAppearance");
  if (appearance) appearance.hidden = connection;
  const behavior = $("scBehavior");
  if (behavior) behavior.hidden = connection;
  $("scVisualLabel").textContent = connection ? "Símbolo que recorre la conexión" : "Símbolo del evento";
  const symbolConfig = $("scShowSymbolConfig");
  if (symbolConfig) symbolConfig.hidden = !$("scShowSymbol").checked;
  const symbolUse = $("scSymbolUse");
  if (symbolUse) symbolUse.textContent = scVisual || "●";
  const messageConfig = $("scMessageConfig");
  if (messageConfig) messageConfig.hidden = !$("scUseMessage").checked;
  const fillConfig = $("scFillConfig");
  if (fillConfig) fillConfig.hidden = !$("scUseFill").checked;
  const durationCustom = $("scDurationCustom");
  if (durationCustom) durationCustom.hidden = scRadioValue("scVisDur", NODE_VISUAL_DURATIONS, NODE_VISUAL_DURATION_DEFAULT) !== "custom";
  /* FLUYO-018.19: la vista previa vive dentro del «Cómo se ve» del tipo elegido (conexión o elemento): se ve donde se ajusta */
  const slot = (connection ? flowLook : appearance)?.querySelector?.(".scPreviewSlot"),
    preview = document.querySelector?.(".scEventPreview");
  if (slot && preview && preview.parentElement !== slot) slot.appendChild(preview);
  scUpdateAccordionSummaries();
}
function scSetAccordionOpen(id, open) {
  const el = $(id);
  if (!el) return;
  if (open) el.setAttribute("open", "");
  else el.removeAttribute("open");
}
const SC_FLOW_SUMMARY = {
  size: { small: "Pequeño", medium: "Mediano", large: "Grande" },
  style: { direct: "Directo", smooth: "Suave", impulse: "Impulso" },
  trail: { none: "Sin rastro", subtle: "Rastro sutil", marked: "Rastro marcado" },
  arrival: { pulse: "Pulso al llegar", glow: "Brillo al llegar", bounce: "Rebote al llegar" },
};
function scUpdateAccordionSummaries() {
  const flowLook = $("scFlowLook");
  if (flowLook && !flowLook.hidden && $("scFlowLookSummary")) {
    const fx = scConnectionEffectsFromUI();
    $("scFlowLookSummary").textContent = ["size", "style", "trail", "arrival"].map((k) => SC_FLOW_SUMMARY[k][fx[k]]).filter(Boolean).join(" · ");
  }
  const appearance = $("scAppearance");
  if (appearance) {
    const summary = appearance.querySelector("summary");
    if (summary) summary.setAttribute("aria-expanded", String(appearance.open));
  }
  if (!appearance || appearance.hidden) return;
  const parts = [];
  if ($("scShowSymbol").checked) parts.push("Símbolo");
  if ($("scUseMessage").checked) parts.push("Mensaje");
  if ($("scHighlight").checked) parts.push("Resaltar");
  if ($("scDim").checked) parts.push("Oscurecer");
  if ($("scBlink").checked) parts.push("Parpadear");
  if ($("scUseFill").checked) parts.push("Color");
  const summary = $("scAppearanceSummary");
  if (summary) summary.textContent = parts.length ? parts.join(" · ") : "Sin personalizar";
  const behavior = $("scBehavior");
  if (behavior && !behavior.hidden) {
    const val = scConsequenceValue();
    const labels = { none: "No cambia cómo responde", down: "Deja de responder", up: "Vuelve a responder" };
    const bs = $("scBehaviorSummary");
    if (bs) bs.textContent = labels[val] || "";
  }
}
function scRenderVisualPicker() {
  const box = $("scVisualPicker");
  box.replaceChildren();
  const values = ["●", "💵", "📦", "👤", "📨", "✓", "⚠"];
  if (scVisual && !values.includes(scVisual)) values.push(scVisual);
  for (const symbol of values) {
    const b = scButton(symbol, () => {
      scVisual = symbol;
      $("scEventVisual").value = symbol;
      scRenderVisualPicker();
      scEditorLayout();
      scUpdateEventPreview();
    });
    b.setAttribute("aria-label", "Usar símbolo " + symbol);
    b.setAttribute("aria-pressed", String(symbol === scVisual));
    box.appendChild(b);
  }
  box.appendChild(
    scButton("+", () => {
      $("scCustomVisual").hidden = false;
      $("scEventVisual").focus();
    }),
  );
}
function scRenderColorSwatches(containerId, currentColor, inputId) {
  const box = $(containerId);
  if (!box) return;
  box.replaceChildren();
  const colors = typeof EVENT_SWATCHES !== "undefined" ? EVENT_SWATCHES : [];
  const current = (currentColor || "").toLowerCase();
  for (const c of colors) {
    const sw = document.createElement("button");
    sw.type = "button";
    sw.className = "scSwatch" + (c.toLowerCase() === current ? " sel" : "");
    sw.style.background = c;
    sw.title = c;
    sw.setAttribute("aria-label", c);
    sw.onclick = () => {
      scPickColor(c, inputId, containerId);
      scUpdateEventPreview();
    };
    box.appendChild(sw);
  }
  const add = scButton("+", () => {
    const input = $(inputId);
    if (input) input.click();
  }, "scColorAdd");
  add.title = "Elegir color personalizado";
  add.setAttribute("aria-label", "Elegir color personalizado");
  box.appendChild(add);
}
function scPickColor(color, inputId, containerId) {
  const input = $(inputId);
  if (input) input.value = color;
  if (containerId) scRenderColorSwatches(containerId, color, inputId);
}
/* Preview vivo de una conexión: un canvas que llama al MISMO pintor que Playback
   (`drawFlowOverlay`). Un único RAF mientras el diálogo está abierto; se cancela al
   cerrar. Con «reducir movimiento» pinta un fotograma y sólo anima con «Ver ejemplo». */
const SC_PREVIEW_ARRIVE_MS = 700, SC_PREVIEW_PAUSE_MS = 500;
let scPreviewRaf = null, scPreviewT0 = 0, scPreviewSpec = null, scPreviewCanvas = null, scPreviewOnce = false;
function scPreviewStop() {
  if (scPreviewRaf !== null) cancelAnimationFrame(scPreviewRaf);
  scPreviewRaf = null;
  scPreviewSpec = null;
  scPreviewCanvas = null;
  scPreviewOnce = false;
}
function scPreviewFrame(now) {
  scPreviewRaf = null;
  const canvas = scPreviewCanvas;
  if (!canvas || !canvas.isConnected || !scPreviewSpec) return;
  const { token, connection, motion } = scPreviewSpec;
  const dur = EVENT_MOTION_MS[motion] || EVENT_MOTION_MS.normal;
  const total = dur + SC_PREVIEW_ARRIVE_MS + SC_PREVIEW_PAUSE_MS;
  const reduced = prefersReducedMotion();
  let t = now - scPreviewT0;
  if (scPreviewOnce && t >= total) { scPreviewOnce = false; t = dur * 0.55; }
  else if (!scPreviewOnce && reduced) t = dur * 0.55;
  else t = t % total;
  const w = canvas.clientWidth || 260, h = canvas.clientHeight || 110, dpr = window.devicePixelRatio || 1;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  }
  const c = canvas.getContext("2d"), T = THEMES[doc.theme] || THEMES.dark;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, w, h);
  c.fillStyle = T.bg; c.fillRect(0, 0, w, h);
  const nw = Math.min(64, w * 0.24), nh = 34, y = h / 2, x0 = 12 + nw, x1 = w - 12 - nw;
  /* FLUYO-018.16: la conexión de la vista previa es la del lienzo (edgeStroke: línea de 1,5 y aguja que no toca el destino) */
  const previewStroke = edgeStroke({ endArrow: true }, [{ x: x0, y }, { x: x1, y }]);
  c.strokeStyle = T.edge; c.lineWidth = EDGE_W;
  c.beginPath(); traceSegments(c, previewStroke.line); c.stroke();
  c.fillStyle = T.edge;
  for (const hd of previewStroke.heads) { c.beginPath(); traceSegments(c, hd); c.fill(); }
  c.font = "600 11px 'Segoe UI', system-ui, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
  for (const [cx, label] of [[12 + nw / 2, "Cliente"], [w - 12 - nw / 2, "Comercio"]]) {
    c.fillStyle = T.lblBg; c.strokeStyle = T.edge; c.lineWidth = 1.5;
    c.beginPath(); c.roundRect(cx - nw / 2, y - nh / 2, nw, nh, 8); c.fill(); c.stroke();
    c.fillStyle = T.text; c.fillText(label, cx, y);
  }
  const pts = [{ x: x0, y }, { x: x1, y }];
  const base = { stepId: 0, edgeId: 0, token, connection, duration: dur, terminalType: "send_succeeded", terminalReason: null };
  if (t < dur) drawFlowOverlay(c, pts, [{ ...base, progress: t / dur }], [], T);
  else if (t < dur + SC_PREVIEW_ARRIVE_MS) drawFlowOverlay(c, pts, [], [{ ...base, ageMs: t - dur, cueMs: SC_PREVIEW_ARRIVE_MS }], T);
  if (!reduced || scPreviewOnce) scPreviewRaf = requestAnimationFrame(scPreviewFrame);
}
function scPreviewKick(restart) {
  if (restart) scPreviewT0 = performance.now();
  if (scPreviewRaf === null) scPreviewRaf = requestAnimationFrame(scPreviewFrame);
}
function scUpdateEventPreview() {
  const def = scEditorDefinition(),
    connection = def.primitive === "FLOW",
    box = $("scPreviewDiagram");
  if (!connection) scPreviewStop();
  if (!(connection && box.querySelector(".scPreviewCanvas"))) box.replaceChildren();
  if (connection) {
    const spec = connectionVisualSpec({ visual: { value: scVisual }, presentation: def.presentation });
    const next = { token: scVisual, connection: spec, motion: def.motion };
    let canvas = box.querySelector(".scPreviewCanvas");
    if (!canvas) {
      canvas = scEl("canvas", "scPreviewCanvas");
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", "Ejemplo animado de cómo viajará el evento");
      box.appendChild(canvas);
    }
    const changed = JSON.stringify(next) !== JSON.stringify(scPreviewSpec);
    scPreviewCanvas = canvas;
    scPreviewSpec = next;
    scPreviewKick(changed);
  } else {
    const spec = nodeEffectsVisualSpec({ visual: { value: scVisual }, presentation: def.presentation });
    const classes = ["scPreviewNode"];
    if (def.availability === "DOWN") classes.push("unavailable");
    if (spec.highlight) classes.push("highlight");
    if (spec.dim) classes.push("dim");
    if (spec.fillColor) {
      classes.push("fillColor");
      box.style.setProperty("--effect-color", spec.fillColor + "33");
    } else {
      box.style.removeProperty("--effect-color");
    }
    const stack = scEl("span", "scPreviewStack");
    const node = scEl("span", classes.join(" "), "Solicitud");
    let msg = null;
    if (spec.message) {
      const st = nodeMessageStyle(spec);
      msg = scEl("span", "scPreviewMessage " + st.position, spec.message);
      msg.style.setProperty("--message-color", spec.messageColor || "#d0576a");
      msg.style.fontSize = st.px + "px";
      msg.style.fontWeight = st.weight;
      msg.style.fontFamily = st.family;
      msg.dataset.size = spec.messageSize;
      msg.dataset.weight = spec.messageWeight;
      msg.dataset.font = spec.messageFont;
      msg.dataset.position = spec.messagePosition;
    }
    if (msg && spec.messagePosition === "above") stack.appendChild(msg);
    if (spec.showSymbol) {
      const sym = scEl("span", "scPreviewToken", spec.symbol);
      sym.style.fontSize = SYMBOL_NODE_PX[spec.symbolSize] + "px";
      stack.appendChild(sym);
    }
    if (msg && spec.messagePosition === "center") node.appendChild(msg);
    stack.appendChild(node);
    if (msg && spec.messagePosition === "below") stack.appendChild(msg);
    box.appendChild(stack);
  }
  $("scEventPreview").textContent = renderEventSentence(
    def,
    connection ? "Cliente" : null,
    connection ? "Comercio" : "Solicitud",
  );
}
function scPlayExample() {
  clearTimeout(scPreviewTimer);
  scUpdateEventPreview();
  if (scPreviewSpec) {
    scPreviewOnce = prefersReducedMotion();
    scPreviewKick(true);
    return;
  }
  const item = $("scPreviewDiagram").querySelector(".scPreviewPath,.scPreviewNode");
  item?.classList.add("animate");
  scPreviewTimer = setTimeout(() => item?.classList.remove("animate"), 1200);
}
function scSaveEventType() {
  const def = scEditorDefinition(),
    error = $("scEventError");
  let message = "";
  if (!def.name) message = "Escribe un nombre para reconocer este evento.";
  else if (eventSentenceHasStrayBraces(def.sentenceTemplate))
    message = "Para insertar nombres, usa los botones de la frase.";
  else if (!def.sentenceTemplate.trim()) message = "Escribe cómo quieres contar este evento.";
  else if (def.sentenceTemplate.length > 200) message = "Acorta la frase a 200 caracteres.";
  else if ([...scVisual].length > EVENT_TOKEN_MAX_LEN)
    message = "Este símbolo es demasiado largo. Elige otro.";
  else if (scDurationInvalid()) {
    message = "Escribe cuántos segundos se ve, entre 0,3 y 10.";
    scSetAccordionOpen("scAppearance", true);
  }
  if (message) {
    error.textContent = message;
    error.hidden = false;
    return;
  }
  // Validación antes de abrir una transacción undo; preserva la plantilla exacta.
  try {
    validateEventType({ ...def, id: scEditingEventTypeId || 1, visual: { kind: "token", value: scVisual } });
  } catch {
    error.textContent = "Revisa el nombre, la frase y el símbolo antes de guardar.";
    error.hidden = false;
    return;
  }
  pushUndo();
  const editing = !!scEditingEventTypeId,
    created = !editing && scEventDialogMode === "create";
  const et = editing ? updateEventType(scEditingEventTypeId, def) : createEventType(def);
  const id = editing ? scEditingEventTypeId : et.id;
  scNewEventId = id;
  scCloseEventDialog();
  if ($("scEventSearch")) $("scEventSearch").value = "";
  scCommit();
  const row = $("scEventLibrary").querySelector('[data-event-type-id="' + id + '"]');
  setTimeout(() => {
    if (scNewEventId === id) scNewEventId = null;
    row?.classList.remove("new");
  }, 2400);
  /* FLUYO-018.19 (D12): crear un evento es empezar a colocarlo. El EventType ya está completo y en la biblioteca (su Undo es
     el de arriba); la colocación es la misma de tocar su ficha, y el Step solo nace al elegir un destino (su propio Undo). Si se
     cancela, el evento se queda en la biblioteca para colocarlo después (D10). Editar o duplicar no colocan. */
  if (created && scCanPlaceEvents() && (!scActiveScenario() || scEditable())) {
    scBeginPlacement(id);
    if (scPlacement) {
      scPlacement.origin = "created";
      scUpdatePlacementBar();
      row?.querySelector("button")?.focus();
      return;
    }
  }
  if ($("panelScenarios").classList.contains("scCompact")) scTogglePalette(true);
  scScrollIntoView(row);
  row?.querySelector("button")?.focus();
  const where = def.primitive === "FLOW" ? "una conexión" : "un elemento";
  scNotice(
    editing
      ? "Evento actualizado en todos sus usos."
      : def.name + " ya está en Eventos. " + (scCoarsePointer() ? "Tócalo y luego toca " + where + "." : "Arrástralo a " + where + "."),
  );
}
/* Con el dedo no se arrastra una ficha: se toca y luego se toca el destino. Los textos lo dicen según el puntero. */
function scCoarsePointer() {
  try {
    return typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
  } catch {
    return false;
  }
}
/* Colocación espacial. Selección previa sólo como atajo sobre un objetivo real. */
function scPlacementType() {
  return (
    scPlacement?.targetType ||
    (eventTypeById(scPlacement?.eventTypeId)?.primitive === "FLOW" ? "edge" : "node")
  );
}
function scBeginPlacement(id, kind = "place", stepId = null) {
  if (isScenarioPlaybackActive()) return;
  /* Sin Scenario no se crea nada aquí: se crea al aplicar un destino válido (scApplyTargets),
     dentro de la misma operación de undo que el Step. Así cancelar/soltar en vacío no deja rastro. */
  if (scActiveScenario() ? !scEditable() : kind !== "place") {
    scNotice("No se puede colocar eventos en esta historia.");
    return;
  }
  const et = eventTypeById(id);
  if (!et && kind !== "retarget") return;
  scClosePopover(false);
  scFocusReturn = document.activeElement;
  scPlacement = {
    eventTypeId: id,
    kind,
    stepId,
    scenarioId: scActiveScenario()?.id ?? null,
    page: P(),
    hover: [],
    existing: new Set(),
    targets: new Set(),
    targetType: et?.primitive === "FLOW" ? "edge" : "node",
  };
  scHidePalette();
  scUpdatePlacementBar();
}
function scChangeTarget(step) {
  scBeginPlacement(step.eventTypeId, "retarget", step.id);
  if (!step.eventTypeId && scEditable()) {
    scPlacement = {
      kind: "retarget",
      stepId: step.id,
      scenarioId: scActiveScenario().id,
      page: P(),
      targetType: step.edgeId ? "edge" : "node",
      hover: [],
    };
    scUpdatePlacementBar();
  }
}
function scBeginMulti(id) {
  const s = scActiveScenario()?.steps.find((s) => s.id === id);
  if (!s || s.action !== "SEND" || !s.eventTypeId) return;
  scBeginPlacement(s.eventTypeId, "multi", id);
  if (!scPlacement) return;
  scPlacement.existing = new Set(
    scActiveScenario()
      .steps.filter((x) => x.at === s.at && x.eventTypeId === s.eventTypeId && x.action === "SEND" && (x.reverse === true) === (s.reverse === true))
      .map((x) => x.edgeId),
  );
  scPlacement.targets = new Set();
  scUpdatePlacementBar();
}
function scValidatePlacement() {
  if (
    (scPlacement &&
      (scPlacement.page !== P() ||
        scPlacement.scenarioId !== (scActiveScenario()?.id ?? null) ||
        (scPlacement.stepId && !scActiveScenario()?.steps.some((s) => s.id === scPlacement.stepId)) ||
        (scPlacement.eventTypeId && !eventTypeById(scPlacement.eventTypeId)))) ||
    (scContext &&
      (scContext.page !== P() ||
        scContext.scenarioId !== scActiveScenario()?.id ||
        !scActiveScenario()?.steps.some((s) => s.id === scContext.stepId)))
  )
    scCancelPlacement();
}
function scCancelPlacement() {
  scDrag?.ghost?.remove();
  scDrag = null;
  scPointerStart = null;
  scPlacement = null;
  scContext = null;
  const bar = $("scPlacementBar");
  if (bar) bar.hidden = true;
  /* FLUYO-018.12: en móvil la hoja de Historias se aparta mientras se coloca un evento (CSS, body.scPlacing). */
  scBodyFlag("scPlacing", false);
  if ($("panelScenarios")?.classList.contains("scCompact")) $("scPaletteToggle")?.focus();
  else if (scFocusReturn?.isConnected) scFocusReturn.focus();
}
function scUpdatePlacementBar() {
  const bar = $("scPlacementBar");
  if (!bar) return;
  bar.hidden = !scPlacement && !scContext;
  scBodyFlag("scPlacing", !bar.hidden);
  if (bar.hidden) return;
  const p = scPlacement,
    et = eventTypeById(p?.eventTypeId);
  let text = "";
  if (p?.kind === "multi")
    text =
      "Aplicar " +
      et.name +
      " también a estas conexiones\n" +
      (p.existing.size + p.targets.size) +
      " conexiones en total · Al mismo tiempo";
  else if (p?.origin === "created")
    /* FLUYO-018.19: recién creado, la barra dice qué ha pasado y qué falta, sin descubrir que hay que tocar la ficha */
    text =
      (et?.name || "Evento") +
      " creado. " +
      (scCoarsePointer() ? "Toca " : "Elige ") +
      (scPlacementType() === "edge" ? "la conexión" : "el elemento") +
      " donde ocurre.\n" +
      scTemporalHint();
  else if (p)
    text =
      (p.kind === "retarget" ? "Elige otro lugar para " : "") +
      (et?.name || "este evento") +
      ": elige " +
      (scPlacementType() === "edge" ? "una conexión" : "un elemento") +
      " en el sistema.";
  if (scContext) {
    const s = scActiveScenario()?.steps.find((s) => s.id === scContext.stepId);
    text =
      "Añadiendo al mismo tiempo que “" +
      (s ? describeScenarioStep(s).primary : "") +
      "”" +
      (text ? "\n" + text : "");
  }
  $("scPlacementText").textContent = text;
  $("scPlacementConfirm").hidden = p?.kind !== "multi";
  $("scPlacementConfirm").disabled = !p?.targets?.size;
}
function scEdgeCandidates(x, y) {
  // Geometría compartida con el renderer; radio constante en píxeles de pantalla.
  if (typeof edgePoints !== "function") {
    const e = hitEdge(x, y);
    return e ? [e] : [];
  }
  const radius = 10 / (typeof viewZoom === "number" ? viewZoom : 1),
    found = [];
  for (const e of P().edges) {
    const pts = edgePoints(e);
    let dist = Infinity;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1],
        b = pts[i],
        dx = b.x - a.x,
        dy = b.y - a.y,
        l = dx * dx + dy * dy;
      if (!l) continue;
      const u = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / l));
      dist = Math.min(dist, Math.hypot(x - a.x - u * dx, y - a.y - u * dy));
    }
    if (dist <= radius) found.push({ e, dist });
  }
  found.sort((a, b) => a.dist - b.dist);
  return found
    .filter((f) => f.dist - found[0].dist <= 3 / (typeof viewZoom === "number" ? viewZoom : 1))
    .map((f) => f.e);
}
function scFindDropTargets(kind, x, y, eventTypeId) {
  const allowed = eventTypeAllowedTargets(eventTypeById(eventTypeId));
  if (!allowed.has(kind)) return [];
  if (kind === "edge") {
    if (hitLeafNode(x, y)) return [];
    const candidates = scEdgeCandidates(x, y);
    if (candidates.length !== 1) return [];
    const direct = candidates[0];
    return selE.size > 1 && selE.has(direct.id)
      ? P()
          .edges.filter((e) => selE.has(e.id))
          .map((e) => e.id)
      : [direct.id];
  }
  const n = hitNode(x, y);
  return n ? [n.id] : [];
}
function toWorldFromClient(x, y) {
  const r = cv.getBoundingClientRect();
  return { x: (x - r.left - viewX) / viewZoom, y: (y - r.top - viewY) / viewZoom };
}
function scStartDragEventType(id, x, y) {
  scBeginPlacement(id);
  if (!scPlacement) return;
  const et = eventTypeById(id),
    ghost = scEl("div", "scDragGhost", eventSymbol(et) + " " + et.name);
  document.body.appendChild(ghost);
  scDrag = { eventTypeId: id, ghost };
  scUpdateDrag(x, y);
}
function scTemporalHint() {
  if (scPlacement?.kind === "retarget") return "Cambiará dónde ocurre · conserva su tiempo";
  if (scContext) return "Se añadirá al mismo tiempo";
  return "Se añadirá al final · " + (scActiveScenario()?.steps.length ? "1 s después" : "Al comenzar");
}
function scHoverAt(clientX, clientY) {
  if (!scPlacement) return;
  const r = cv.getBoundingClientRect(),
    inside = clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
  const w = toWorldFromClient(clientX, clientY),
    kind = scPlacementType();
  let ids = [];
  if (inside) {
    if (kind === "edge") {
      if (!hitLeafNode(w.x, w.y)) ids = scEdgeCandidates(w.x, w.y).map((e) => e.id);
    } else {
      const n = hitNode(w.x, w.y);
      if (n) ids = [n.id];
    }
  }
  scPlacement.hover = ids;
  return ids;
}
function scUpdateDrag(x, y) {
  if (!scDrag) return;
  const ids = scHoverAt(x, y) || [],
    et = eventTypeById(scDrag.eventTypeId);
  let detail = "Suelta sobre " + (et.primitive === "FLOW" ? "una conexión" : "un elemento");
  if (ids.length > 1) detail = "Hay varias conexiones aquí. Elige una al soltar.";
  else if (ids.length) {
    const multi = et.primitive === "FLOW" && selE.has(ids[0]) && selE.size > 1;
    detail = multi
      ? "Aplicar " + et.name + " a " + P().edges.filter((e) => selE.has(e.id)).length + " conexiones"
      : scSentenceAt(et, ids[0]);
    if (multi)
      scPlacement.hover = P()
        .edges.filter((e) => selE.has(e.id))
        .map((e) => e.id);
  }
  scDrag.ghost.textContent =
    eventSymbol(et) + " " + et.name + "\n" + detail + "\n" + scTemporalHint();
  scDrag.ghost.style.left = Math.min(x + 14, innerWidth - 320) + "px";
  scDrag.ghost.style.top = Math.max(8, Math.min(y + 16, innerHeight - 100)) + "px";
}
function scSentenceAt(et, id) {
  const e = et.primitive === "FLOW" ? edgeById(id) : null;
  return renderEventSentence(
    et,
    e ? scNodeFallback(e.from) : null,
    e ? scNodeFallback(e.to) : scNodeFallback(id),
  );
}
function scEndDrag(x, y) {
  if (!scDrag) return;
  const id = scDrag.eventTypeId;
  scDrag.ghost.remove();
  scDrag = null;
  scPointerStart = null;
  const r = cv.getBoundingClientRect();
  if (x < r.left || x > r.right || y < r.top || y > r.bottom) {
    scCancelPlacement();
    return;
  }
  const w = toWorldFromClient(x, y);
  scResolveDrop(id, w.x, w.y, x, y);
}
function scResolveDrop(id, x, y, cx, cy, touch = false) {
  const kind = scPlacement ? scPlacementType() : eventTypeById(id)?.primitive === "FLOW" ? "edge" : "node";
  if (kind === "edge" && !hitLeafNode(x, y)) {
    const candidates = scEdgeCandidates(x, y);
    if (candidates.length > 1) {
      const anchor = { getBoundingClientRect: () => ({ left: cx || 100, bottom: cy || 100 }) };
      scMenu(
        anchor,
        candidates.map((e) => [scEdgeLabel(e.id), () => scUseTarget(e.id, false)]),
      );
      return;
    }
  }
  const targets = id
    ? scFindDropTargets(kind, x, y, id)
    : kind === "node"
      ? hitNode(x, y)
        ? [hitNode(x, y).id]
        : []
      : scEdgeCandidates(x, y).map((e) => e.id);
  if (!targets.length) {
    /* FLUYO-018.19 (D13): con el dedo, tocar donde no hay destino no cancela: se sigue colocando (y explorando el lienzo).
       Cancelar es explícito (Cancelar, Escape). Con ratón, como siempre. */
    if (touch && scPlacement) {
      scNotice("Toca " + (kind === "edge" ? "una conexión" : "un elemento") + " compatible para colocarlo, o «Cancelar».");
      return;
    }
    if (scPlacement?.kind !== "multi") scCancelPlacement();
    scNotice(
      "No se añadió nada. Elige " + (kind === "edge" ? "una conexión" : "un elemento") + " compatible.",
    );
    return;
  }
  if (scPlacement?.kind === "multi" || scPlacement?.kind === "retarget") scUseTarget(targets[0], false);
  else scApplyTargets(id, targets);
}
function scCanPlaceEvents() {
  const sc = scActiveScenario();
  return !isScenarioPlaybackActive() && (!sc || sc.engineVersion === FluyoScenarios.ENGINE_VERSION);
}
function scDropEventTypeAt(id, x, y) {
  if (!scCanPlaceEvents()) return;
  scResolveDrop(id, x, y);
}
function scUseTarget(id, multiSelection = true) {
  if (!scPlacement || !(scPlacement.kind === "place" ? scCanPlaceEvents() : scEditable())) return;
  const p = scPlacement;
  if (p.kind === "multi") {
    if (!p.existing.has(id)) {
      if (p.targets.has(id)) p.targets.delete(id);
      else p.targets.add(id);
    }
    scUpdatePlacementBar();
    return;
  }
  if (p.kind === "retarget") {
    const s = scActiveScenario().steps.find((s) => s.id === p.stepId);
    if (!s) return;
    pushUndo();
    // «Cambiar dónde ocurre» solo elige la conexión: el Step conserva su sentido (FLUYO-STEP-REVERSE-001, D10).
    retargetStep(P(), scActiveScenario(), s.id, id, s.action === "SEND" ? s.reverse === true : undefined);
    scCancelPlacement();
    scCommit();
    return;
  }
  const ids =
    multiSelection && p.targetType === "edge" && selE.size > 1 && selE.has(id)
      ? P()
          .edges.filter((e) => selE.has(e.id))
          .map((e) => e.id)
      : [id];
  scApplyTargets(p.eventTypeId, ids);
}
function scApplyTargets(id, targets) {
  if (!scCanPlaceEvents() || !targets.length) return;
  const et = eventTypeById(id);
  if (!et) return;
  const valid = targets.filter((id) => (et.primitive === "FLOW" ? !!edgeById(id) : !!nodeById(id)));
  if (!valid.length) return;
  let sc = scActiveScenario();
  if (scContext && !sc?.steps.some((s) => s.id === scContext.stepId)) return;
  // Un único pushUndo cubre la auto-creación del Scenario y todos los Steps de la operación.
  pushUndo();
  let created = false;
  if (!sc) {
    const pg = P();
    sc = createScenario(pg, defaultScenarioName(pg));
    scSelectStory(sc.id);
    created = true;
  }
  const at = scContext ? sc.steps.find((s) => s.id === scContext.stepId).at : scStepDefaultTime(sc);
  for (const target of valid) {
    scSelectedStep = createStep(sc, stepDefinitionForEvent(et, target, at)).id;
  }
  scCancelPlacement();
  scFeedback = {
    kind: et.primitive === "FLOW" ? "edge" : "node",
    ids: valid,
    until: performance.now() + 750,
  };
  scCommit();
  scScrollIntoView($("scStoryboard")?.querySelector?.('[data-step-id="' + scSelectedStep + '"]'));
  scNotice(
    created
      ? sc.name + " creada"
      : valid.length === 1 ? "Añadido a la historia." : valid.length + " eventos añadidos al mismo tiempo.",
  );
}
function scConfirmMulti() {
  const p = scPlacement;
  if (!p || p.kind !== "multi" || !p.targets.size || !scEditable()) return;
  const sc = scActiveScenario(),
    s = sc.steps.find((s) => s.id === p.stepId);
  if (!s) return;
  const ids = [...p.targets].filter((id) => edgeById(id));
  if (!ids.length) return;
  pushUndo();
  // Las copias recorren sus conexiones en el mismo sentido que el original (D10).
  for (const id of ids) createStep(sc, Object.assign({ at: s.at, action: "SEND", edgeId: id, eventTypeId: s.eventTypeId }, s.reverse === true ? { reverse: true } : {}));
  scCancelPlacement();
  scCommit();
}
function scHighlight(kind, id) {
  if (!scPlacement || scPlacementType() !== kind)
    return scFeedback &&
      scFeedback.kind === kind &&
      scFeedback.ids.includes(id) &&
      performance.now() < scFeedback.until &&
      !isScenarioPlaybackActive()
      ? 2
      : 0;
  return scPlacement.hover?.includes(id) || scPlacement.targets?.has(id) || scPlacement.existing?.has(id)
    ? 2
    : 1;
}
function scHidePalette() {
  const lib = $("scLibrarySection");
  if (lib) {
    lib.classList.remove("scFloating");
    lib.style.left = "";
    lib.style.top = "";
  }
  $("scPaletteToggle")?.setAttribute("aria-expanded", "false");
}
function scTogglePalette(force) {
  const lib = $("scLibrarySection"),
    button = $("scPaletteToggle");
  if (!lib || isScenarioPlaybackActive()) return;
  const open = force === true || !lib.classList.contains("scFloating");
  if (!open) {
    scHidePalette();
    button.focus();
    return;
  }
  lib.classList.add("scFloating");
  const r = button.getBoundingClientRect();
  lib.style.left = Math.max(12, Math.min(r.left - 320, innerWidth - 332)) + "px";
  lib.style.top = Math.max(12, Math.min(r.top, innerHeight - 390)) + "px";
  button.setAttribute("aria-expanded", "true");
  lib.querySelector("button")?.focus();
}
function scGlobalPointerMove(ev) {
  if (
    scPointerStart &&
    !scDrag &&
    Math.hypot(ev.clientX - scPointerStart.x, ev.clientY - scPointerStart.y) > 6
  ) {
    scSuppressClick = true;
    scStartDragEventType(scPointerStart.eventTypeId, ev.clientX, ev.clientY);
  }
  if (scDrag) scUpdateDrag(ev.clientX, ev.clientY);
  else if (scPlacement) scHoverAt(ev.clientX, ev.clientY);
}
function scGlobalPointerUp(ev) {
  if (scDrag) {
    scEndDrag(ev.clientX, ev.clientY);
    setTimeout(() => {
      scSuppressClick = false;
    }, 0);
  }
  scPointerStart = null;
}
/* FLUYO-018.19 (D11, D13): con el dedo, colocar no se decide al apoyar. El lienzo hace su gesto (un dedo desplaza, dos
   pellizcan; interaction.js lo arma como un desplazamiento) y, al soltar, SOLO un toque sin desplazamiento resuelve el destino
   (scCanvasPlacementTap). Así un destino fuera de la vista se alcanza desplazando sin perder la colocación, y desplazar nunca
   coloca. Con ratón no cambia nada: el clic resuelve al apoyar. */
function scPlacementTouchPan(ev) {
  return !!scPlacement && !scDrag && ev.pointerType === "touch";
}
function scCanvasPlacementTap(ev) {
  if (!scPlacement || scDrag) return;
  const w = toWorldFromClient(ev.clientX, ev.clientY);
  scResolveDrop(scPlacement.eventTypeId, w.x, w.y, ev.clientX, ev.clientY, true);
}
function scCanvasPlacementPointer(ev) {
  if (!scPlacement || scDrag) return false;
  if (ev.pointerType === "touch") return false;
  if (ev.button !== 0) return true;
  ev.preventDefault();
  const w = toWorldFromClient(ev.clientX, ev.clientY);
  scResolveDrop(scPlacement.eventTypeId, w.x, w.y, ev.clientX, ev.clientY);
  return true;
}
function scInitUI() {
  const bind = (id, fn) => {
    const el = $(id);
    if (el) el.onclick = fn;
  };
  bind("scScenarioTitle", () => scChooseScenario($("scScenarioTitle")));
  bind("scStoryAdd", scNewScenario);
  bind("scScenarioMenu", () => scScenarioMenu($("scScenarioMenu")));
  bind("scRun", scRun);
  bind("scReset", scReset);
  bind("scPause", scTogglePause);
  bind("scPrev", scPrevMoment);
  bind("scNext", scNextMoment);
  /* SCENARIOS-SEMANTICS-001 FASE 3: la ruta observada (solo con la bandera; scRenderFlow decide si existe) */
  if ($("scFlowFrom")) $("scFlowFrom").onchange = () => scFlowPick("from");
  if ($("scFlowTo")) $("scFlowTo").onchange = () => scFlowPick("to");
  bind("scEventNew", () => scOpenEventDialog(null));
  bind("scEventSave", scSaveEventType);
  bind("scEventCancel", scCloseEventDialog);
  bind("scEventClose", scCloseEventDialog);
  bind("scPreviewPlay", scPlayExample);
  bind("scPlacementCancel", scCancelPlacement);
  bind("scPlacementConfirm", scConfirmMulti);
  bind("scPaletteToggle", () => scTogglePalette());
  bind("scDetailsClose", () => $("scDetailsDialog").close());
  bind("scDetailsDone", () => $("scDetailsDialog").close());
  if ($("scEventSearch")) $("scEventSearch").oninput = scRenderEventLibrary;
  if ($("scEventName")) $("scEventName").oninput = scUpdateEventPreview;
  /* FLUYO-018.19: Intro en el nombre crea (o guarda): con el teclado virtual abierto el pie del diálogo queda debajo */
  if ($("scEventName"))
    $("scEventName").onkeydown = (ev) => {
      if (ev.key === "Enter" && !ev.isComposing) {
        ev.preventDefault();
        scSaveEventType();
      }
    };
  if ($("scEventVisual"))
    $("scEventVisual").oninput = () => {
      scVisual = $("scEventVisual").value;
      scRenderVisualPicker();
      scEditorLayout();
      scUpdateEventPreview();
    };
  document.querySelectorAll('input[name="scWhere"]').forEach(
    (input) =>
      (input.onchange = () => {
        scEditorLayout();
        if (!scEditingEventTypeId) scSwitchPhraseForWhere();
        scRenderPhrase();
        scUpdateEventPreview();
      }),
  );
  document
    .querySelectorAll('input[name="scConsequence"]')
    .forEach((input) => (input.onchange = scUpdateEventPreview));
  for (const name of ["scMotion", "scFlowSize", "scFlowStyle", "scFlowTrail", "scFlowArrival", "scFlowDuring", "scSymbolSize"])
    document.querySelectorAll('input[name="' + name + '"]').forEach(
      (input) =>
        (input.onchange = () => {
          scUpdateAccordionSummaries();
          scUpdateEventPreview();
        }),
    );
  for (const id of ["scShowSymbol", "scHighlight", "scBlink", "scDim", "scUseMessage", "scUseFill"]) {
    const el = $(id);
    if (el)
      el.onchange = () => {
        scEditorLayout();
        scUpdateEventPreview();
      };
  }
  if ($("scMessage")) $("scMessage").oninput = scUpdateEventPreview;
  for (const name of ["scMsgSize", "scMsgWeight", "scMsgFont", "scMsgPos"])
    document.querySelectorAll('input[name="' + name + '"]').forEach((input) => (input.onchange = scUpdateEventPreview));
  document.querySelectorAll('input[name="scVisDur"]').forEach((input) => (input.onchange = () => { scEditorLayout(); scUpdateEventPreview(); }));
  if ($("scDurationSeconds")) $("scDurationSeconds").oninput = scUpdateEventPreview;
  bind("scChangeSymbol", () => {
    const first = $("scVisualPicker").querySelector("button");
    $("scVisualPicker").scrollIntoView?.({ block: "center" });
    first?.focus();
  });
  for (const id of ["scMessageColorCustom", "scFillColorCustom"]) {
    const el = $(id);
    if (el)
      el.oninput = () => {
        const containerId = id === "scMessageColorCustom" ? "scMessageSwatches" : "scFillSwatches";
        scRenderColorSwatches(containerId, el.value, id);
        scUpdateEventPreview();
      };
  }
  for (const id of ["scAppearance", "scBehavior"]) {
    const el = $(id);
    if (el)
      el.ontoggle = () => {
        const summary = el.querySelector("summary");
        if (summary) summary.setAttribute("aria-expanded", String(el.open));
      };
  }
  if ($("scEventDialog"))
    $("scEventDialog").addEventListener("cancel", (ev) => {
      ev.preventDefault();
      scCloseEventDialog();
    });
  document.addEventListener("pointermove", scGlobalPointerMove);
  document.addEventListener("pointerup", scGlobalPointerUp);
  document.addEventListener("pointercancel", () => scCancelPlacement());
  document.addEventListener(
    "pointerdown",
    (ev) => {
      const p = $("scPopover");
      if (p && !p.hidden && !p.contains(ev.target) && !scPopoverReturn?.contains?.(ev.target))
        scClosePopover(false);
    },
    true,
  );
  document.addEventListener(
    "keydown",
    (ev) => {
      if (ev.key === "Escape") {
        if ($("scEventDialog")?.open) {
          ev.preventDefault();
          ev.stopImmediatePropagation();
          scCloseEventDialog();
          return;
        }
        if ($("scDetailsDialog")?.open) return;
        if (scStoryDrag) {
          ev.preventDefault();
          ev.stopImmediatePropagation();
          scStoryDragCleanup();
          return;
        }
        if (scPlacement || scContext || scDrag) {
          ev.preventDefault();
          ev.stopImmediatePropagation();
          scCancelPlacement();
          scClosePopover();
          return;
        }
        if (!$("scPopover")?.hidden) {
          ev.preventDefault();
          ev.stopImmediatePropagation();
          scClosePopover();
        }
        scHidePalette();
      }
      const pop = $("scPopover");
      if (pop && !pop.hidden && ["ArrowDown", "ArrowUp"].includes(ev.key)) {
        const items = [...pop.querySelectorAll("button:not(:disabled),input,select")];
        if (items.length) {
          ev.preventDefault();
          ev.stopImmediatePropagation();
          const i = items.indexOf(document.activeElement);
          items[(i + (ev.key === "ArrowDown" ? 1 : items.length - 1)) % items.length].focus();
        }
      }
      if (
        scPlacement &&
        !$("scEventDialog")?.open &&
        !ev.target.closest?.("#scPlacementBar") &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(ev.target.tagName) &&
        ["ArrowRight", "ArrowLeft", "Enter"].includes(ev.key)
      ) {
        const targets = scPlacementType() === "edge" ? P().edges : P().nodes;
        if (!targets.length) return;
        ev.preventDefault();
        ev.stopImmediatePropagation();
        if (ev.key === "Enter" && scPlacement.hover.length === 1) scUseTarget(scPlacement.hover[0], false);
        else {
          const i = targets.findIndex((x) => x.id === scPlacement.hover[0]),
            next =
              targets[
                (i + (ev.key === "ArrowLeft" ? targets.length - 1 : 1) + targets.length) % targets.length
              ];
          scPlacement.hover = [next.id];
          $("scPlacementText").textContent =
            (scPlacementType() === "edge" ? scEdgeLabel(next.id) : scNodeFallback(next.id)) +
            " · Enter para aplicar · Esc para cancelar";
        }
      }
    },
    true,
  );
  /* FLUYO-018.17: un desplazamiento A MANO de la línea de tiempo (rueda o dedo; no el scroll programado que restaura
     scRenderStoryboard) pausa el autoscroll del paso activo durante 2 s. */
  const board = document.querySelector?.(".scStoryboardSection");
  if (board && board.addEventListener) for (const ev of ["wheel", "touchmove"]) board.addEventListener(ev, () => { scUserScrollAt = performance.now(); }, { passive: true });
  if (typeof ResizeObserver !== "undefined" && $("panelScenarios")) {
    scResizeObserver = new ResizeObserver(() => {
      const p = $("panelScenarios"),
        aside = p.closest("aside");
      if (!aside) return;
      scSyncCompact();
    });
    scResizeObserver.observe($("panelScenarios").closest("aside"));
  }
  scSelectStory(P().scenarios?.[0]?.id ?? null);
  scRenderPanel();
}
/* La biblioteca pasa a paleta flotante cuando la columna es estrecha (< 300 px). En la hoja móvil (FLUYO-018.17) los eventos
   son fichas en un carril horizontal y la paleta no se usa. */
function scSyncCompact() {
  const p = $("panelScenarios"),
    aside = p && p.closest && p.closest("aside");
  if (!aside || !p.classList) return;
  const narrow = aside.getBoundingClientRect().width < 300 && !(typeof isSheetLayout === "function" && isSheetLayout());
  p.classList.toggle("scCompact", narrow);
  if (!narrow) scHidePalette();
}
function ensureScenariosUI() {
  if (scUiReady) return;
  scUiReady = true;
  scInitUI();
}
function scRefreshIfVisible() {
  if (scUiReady && scIsScenariosTabActive()) scRenderPanel();
}
window.buildScenarioRenderState = buildScenarioRenderState;
window.isScenarioPlaybackActive = isScenarioPlaybackActive;
window.scReset = scReset;
window.scSyncPage = scSyncPage;
window.ensureScenariosUI = ensureScenariosUI;
window.scRefreshIfVisible = scRefreshIfVisible;
window.scSyncCompact = scSyncCompact;
window.eventTypeById = eventTypeById;
window.renderEventSentence = renderEventSentence;
window.eventTypeAllowedTargets = eventTypeAllowedTargets;
