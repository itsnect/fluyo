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

function scEdgeLabel(id) {
  const e = edgeById(id);
  if (!e) return null;
  const a = scNodeLabel(e.from),
    b = scNodeLabel(e.to);
  return (a || "?") + " → " + (b || "?");
}

function scEdgeSecondary(id) {
  const e = edgeById(id);
  if (!e || !e.label) return null;
  return (e.label || "").split("\n")[0].trim() || null;
}

function scTargetLabel(step) {
  if (step.action === "SET_STATE") return scNodeFallback(step.nodeId);
  return scEdgeLabel(step.edgeId) || "Conexión sin nombre";
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
  const primary = scEdgeLabel(step.edgeId);
  const secondary = scEdgeSecondary(step.edgeId);
  if (et) {
    const e = edgeById(step.edgeId);
    const source = e ? scNodeFallback(e.from) : "?";
    const target = e ? scNodeFallback(e.to) : "?";
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
}

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function scRuntimeStateForStep(step) {
  if (!scPlayback || !isScenarioPlaybackActive()) return { status: "pending", detail: null };
  // Para SEND respetamos la duración visual del cue antes de mostrar el resultado.
  if (step.action === "SEND") {
    if (scPlayback.activeSends.some((s) => s.stepId === step.id)) return { status: "active", detail: null };
    const completed = scPlayback.completedSends.find((s) => s.stepId === step.id);
    if (completed) {
      if (completed.terminalType === "send_failed") {
        const reasonText =
          completed.terminalReason === "source_down"
            ? (scNodeLabel(edgeById(step.edgeId)?.from) || "El origen") + " no está disponible"
            : (scNodeLabel(edgeById(step.edgeId)?.to) || "El destino") + " no está disponible";
        return { status: "failed", detail: reasonText };
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
    if (scPlayback.cursorVirtual < step.at) return { status: "pending", detail: null };
    return { status: step.action === "SET_STATE" ? "completed" : "active", detail: null };
  }
  if (last.type === "state_changed" || last.type === "event_occurred")
    return { status: "completed", detail: null };
  if (last.type === "send_succeeded") return { status: "success", detail: null };
  if (last.type === "send_failed") {
    const reasonText =
      last.reason === "source_down"
        ? (scNodeLabel(edgeById(step.edgeId)?.from) || "El origen") + " no está disponible"
        : (scNodeLabel(edgeById(step.edgeId)?.to) || "El destino") + " no está disponible";
    return { status: "failed", detail: reasonText };
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
      const lbl = scEdgeLabel(ev.edgeId) || "Conexión #" + ev.edgeId;
      mark.textContent = "→";
      body.textContent = time + "  " + escapeHtml(lbl) + "  Sale";
    } else if (ev.type === "send_succeeded") {
      const lbl = scEdgeLabel(ev.edgeId) || "Conexión #" + ev.edgeId;
      mark.textContent = "✓";
      line.classList.add("success");
      const result = document.createElement("span");
      result.className = "scLogResult";
      result.textContent = "Llegó";
      body.appendChild(document.createTextNode(time + "  " + escapeHtml(lbl) + "  "));
      body.appendChild(result);
    } else if (ev.type === "send_failed") {
      const lbl = scEdgeLabel(ev.edgeId) || "Conexión #" + ev.edgeId;
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
  /* Una sola receta de ejecución, compartida con Present y el Viewer (story-playback.js). */
  const started = FluyoStory.start(P(), sc, performance.now());
  if (!started.ok) {
    scErrors = started.errors;
    scRenderErrors();
    if (typeof presentStoryRefresh === "function") presentStoryRefresh();
    return;
  }
  scPlayback = started.playback;
  scStatus = "running";
  if (!inPresent && typeof switchPanelTab === "function") switchPanelTab("scenarios");
  const tabProp = $("tabProperties");
  if (tabProp) tabProp.disabled = true;
  scRenderButtons();
  scRenderPanel();
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
  scStatus = "idle";
  scErrors = [];
  const tabProp = $("tabProperties");
  if (tabProp) tabProp.disabled = false;
  scRenderPanel();
  if (typeof presentStoryRefresh === "function") presentStoryRefresh();
}

function scScheduleTick() {
  if (scRafId !== null) cancelAnimationFrame(scRafId);
  scRafId = requestAnimationFrame(scTick);
}

function scTick(now) {
  scRafId = null;
  if (!scPlayback || scStatus !== "running") return;
  FluyoScenarioPlayback.tick(scPlayback, now);
  scRenderStatus();
  scRenderStoryboard();
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
  return FluyoStory.renderState(scPlayback, scActiveScenario(), performance.now());
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
function scNotice(message) {
  const el = $("scNotice");
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
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
  if (title) title.textContent = (s ? s.name : "Sin historias") + " ▾";
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
    run.textContent = scStatus === "completed" ? "↻ Repetir" : "▶ Reproducir";
    run.hidden = scStatus === "running";
    run.disabled = !s || !s.steps.length || s.engineVersion !== FluyoScenarios.ENGINE_VERSION;
    run.title = !run.disabled ? "" : !s ? "Crea una historia para poder reproducirla." : !s.steps.length ? "Añade un evento a la historia para poder reproducirla." : "Esta historia necesita una versión compatible de Fluyo.";
  }
  if (reset) {
    reset.hidden = scStatus === "idle";
    reset.textContent = scStatus === "running" ? "■ Detener" : "Volver a editar";
  }
  const panel = $("panelScenarios");
  if (panel) panel.classList.toggle("scPlaying", isScenarioPlaybackActive());
  if ($("scEventNew")) $("scEventNew").disabled = isScenarioPlaybackActive();
  if ($("scPaletteToggle")) $("scPaletteToggle").disabled = isScenarioPlaybackActive();
}
function scRenderStatus() {
  const el = $("scStatus");
  if (!el) return;
  el.textContent =
    scStatus === "idle"
      ? ""
      : scStatus === "running"
        ? "Reproduciendo · " + scFormatTime(scPlayback?.cursorVirtual || 0)
        : "Reproducción terminada";
}
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
    for (const [index, step] of g.steps.entries()) {
      const row = scStoryRow(step);
      if (g.steps.length > 1 && !isScenarioPlaybackActive())
        row.querySelector(".scStatusMark").textContent = index === g.steps.length - 1 ? "└" : "├";
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
      scSelectedStep = step.id;
      scSelectTarget(d.targetType, d.targetId);
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
  if (r.detail) text.appendChild(scEl("div", "scStepDetail", r.detail));
  if (d.missing && !isScenarioPlaybackActive())
    text.appendChild(scButton("Elegir otro", () => scChangeTarget(step), "scStoryRepair"));
  if (!d.missing && typeof cv !== "undefined" && scTargetOffscreen(step))
    text.appendChild(scButton("Mostrar en el sistema", () => scRevealTarget(step), "scStoryRepair"));
  row.appendChild(text);
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
function scTargetOffscreen(step) {
  const p = scTargetPosition(step);
  if (!p) return false;
  const r = cv.getBoundingClientRect(),
    x = p.x * viewZoom + viewX,
    y = p.y * viewZoom + viewY;
  return x < 0 || y < 0 || x > r.width || y > r.height;
}
function scRevealTarget(step) {
  const p = scTargetPosition(step);
  if (!p) return;
  const r = cv.getBoundingClientRect();
  viewX = r.width / 2 - p.x * viewZoom;
  viewY = r.height / 2 - p.y * viewZoom;
  scStorySignature = "";
  scRenderStoryboard();
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
      a = e && nodeById(e.from),
      b = e && nodeById(e.to);
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
  if (et?.primitive === "FLOW") addItems.push({ label: "Esta misma acción en otras conexiones…", fn: () => scBeginMulti(step.id) });
  const sections = [
    [
      ...(et ? [{ label: "Editar este evento…", hint: uses > 1 ? "Cambia «" + et.name + "» en sus " + uses + " usos" : "Cambia «" + et.name + "»", fn: () => scOpenEventDialog(et.id) }] : []),
      { label: "Usar otro evento aquí…", hint: "Sólo cambia esta aparición", fn: () => scChangeEvent(step, anchor) },
    ],
    [{ label: "Cambiar dónde ocurre…", hint: where ? "Ahora: " + where : "", fn: () => scChangeTarget(step) }],
    [
      { label: "Duplicar", hint: "Al mismo tiempo, justo debajo", fn: () => scDuplicateStep(step.id) },
      { label: "Mover", sub: { title: "Mover", items: moveItems } },
      { label: "Añadir al mismo tiempo", sub: { title: "Añadir al mismo tiempo", items: addItems } },
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
  scSelectedStep = copy.id;
  scCommit();
  scNotice("Duplicado al mismo tiempo, justo debajo.");
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
  scUpdateAccordionSummaries();
}
function scSetAccordionOpen(id, open) {
  const el = $(id);
  if (!el) return;
  if (open) el.setAttribute("open", "");
  else el.removeAttribute("open");
}
function scUpdateAccordionSummaries() {
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
  c.strokeStyle = T.edge; c.lineWidth = 2;
  c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke();
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
  const editing = !!scEditingEventTypeId;
  const et = editing ? updateEventType(scEditingEventTypeId, def) : createEventType(def);
  const id = editing ? scEditingEventTypeId : et.id;
  scNewEventId = id;
  scCloseEventDialog();
  if ($("scEventSearch")) $("scEventSearch").value = "";
  scCommit();
  if ($("panelScenarios").classList.contains("scCompact")) scTogglePalette(true);
  const row = $("scEventLibrary").querySelector('[data-event-type-id="' + id + '"]');
  row?.scrollIntoView({ block: "nearest" });
  row?.querySelector("button")?.focus();
  setTimeout(() => {
    if (scNewEventId === id) scNewEventId = null;
    row?.classList.remove("new");
  }, 2400);
  scNotice(
    editing
      ? "Evento actualizado en todos sus usos."
      : def.name +
          " ya está en Eventos. " +
          (def.primitive === "FLOW" ? "Arrástralo a una conexión." : "Arrástralo a un elemento."),
  );
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
      .steps.filter((x) => x.at === s.at && x.eventTypeId === s.eventTypeId && x.action === "SEND")
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
  if ($("panelScenarios")?.classList.contains("scCompact")) $("scPaletteToggle")?.focus();
  else if (scFocusReturn?.isConnected) scFocusReturn.focus();
}
function scUpdatePlacementBar() {
  const bar = $("scPlacementBar");
  if (!bar) return;
  bar.hidden = !scPlacement && !scContext;
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
    if (hitNode(x, y)) return [];
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
      if (!hitNode(w.x, w.y)) ids = scEdgeCandidates(w.x, w.y).map((e) => e.id);
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
function scResolveDrop(id, x, y, cx, cy) {
  const kind = scPlacement ? scPlacementType() : eventTypeById(id)?.primitive === "FLOW" ? "edge" : "node";
  if (kind === "edge" && !hitNode(x, y)) {
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
    retargetStep(P(), scActiveScenario(), s.id, id);
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
  $("scStoryboard")
    ?.querySelector('[data-step-id="' + scSelectedStep + '"]')
    ?.scrollIntoView({ block: "nearest" });
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
  for (const id of ids) createStep(sc, { at: s.at, action: "SEND", edgeId: id, eventTypeId: s.eventTypeId });
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
function scCanvasPlacementPointer(ev) {
  if (!scPlacement || scDrag) return false;
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
    document.querySelectorAll('input[name="' + name + '"]').forEach((input) => (input.onchange = scUpdateEventPreview));
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
  if (typeof ResizeObserver !== "undefined" && $("panelScenarios")) {
    scResizeObserver = new ResizeObserver(() => {
      const p = $("panelScenarios"),
        aside = p.closest("aside");
      if (!aside) return;
      const narrow = aside.getBoundingClientRect().width < 300;
      p.classList.toggle("scCompact", narrow);
      if (!narrow) scHidePalette();
    });
    scResizeObserver.observe($("panelScenarios").closest("aside"));
  }
  scSelectStory(P().scenarios?.[0]?.id ?? null);
  scRenderPanel();
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
window.eventTypeById = eventTypeById;
window.renderEventSentence = renderEventSentence;
window.eventTypeAllowedTargets = eventTypeAllowedTargets;
