"use strict";
/* Panel de Scenarios: storyboard system-first, autoría visual, Run/Reset y playback.
   Depende de: doc/P(), model helpers, selection/undo/autosave, render, engine, playback. */

/* ===================== Estado de UI/runtime ===================== */
let scActiveId = null;      // Scenario seleccionado en el panel (estado de UI)
let scPlayback = null;      // instancia de FluyoScenarioPlayback.makePlayback
let scRafId = null;         // id del requestAnimationFrame activo
let scStatus = "idle";      // "idle" | "running" | "completed"
let scErrors = [];          // errores de validación del último Run
let scExpandedStepId = null;// Step expandido en modo edición
let scConfigOpen = false;   // Configuración (estado inicial) expandida
let scTraceOpen = false;    // Trace técnico expandido
let scEditingEventTypeId = null; // EventType en edición (null = crear)
let scDrag = null;          // {eventTypeId, startX, startY, ghostEl}

const DEFAULT_STEP_DELAY = 1000; // ms entre momentos consecutivos al crear desde canvas
const EVENT_PRIMITIVE_LABELS = {
  FLOW: "Recorre una conexión",
  OCCURRENCE: "Ocurre en un elemento",
  SET_AVAILABILITY: "Cambia disponibilidad"
};

function isScenarioPlaybackActive(){ return scStatus === "running" || scStatus === "completed"; }

/* ===================== Helpers ===================== */
function scActiveScenario(){
  const pg = P();
  if(!pg || !pg.scenarios) return null;
  if(scActiveId != null){
    const found = pg.scenarios.find(s => s.id === scActiveId);
    if(found) return found;
  }
  return pg.scenarios[0] || null;
}

function scFormatTime(ms){
  if(!Number.isFinite(ms)) ms = 0;
  return (ms/1000).toFixed(1) + " s";
}

function scParseTime(v){
  const n = parseFloat(String(v).replace(",", "."));
  if(!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 1000);
}

/* Formato relativo humano: 0 -> "al mismo tiempo", 250 -> "250 ms después", etc. */
function formatRelativeDelay(ms){
  if(!Number.isFinite(ms) || ms < 0) ms = 0;
  if(ms === 0) return "al mismo tiempo";
  if(ms < 1000) return ms + " ms después";
  const s = ms / 1000;
  // Para segundos usamos formato claro: entero cuando no hay decimal relevante
  if(s === Math.floor(s)) return s + " s después";
  // 1.5 s, 2.5 s… con un decimal; evitamos floats raros
  const rounded = Math.round(s * 10) / 10;
  return rounded.toFixed(1).replace(".0", "") + " s después";
}

/* Parsea un control humano de delay. value=numero, unit="ms"|"s". Devuelve integer ms o null. */
function parseHumanDelay(value, unit){
  const n = parseFloat(String(value).replace(",", "."));
  if(!Number.isFinite(n) || n < 0) return null;
  if(unit === "ms") return Math.round(n);
  if(unit === "s") return Math.round(n * 1000);
  return null;
}

function scNodeLabel(id){
  const n = nodeById(id);
  if(!n) return null;
  return (n.label || "").split("\n")[0].trim() || null;
}
function scNodeFallback(id){ return scNodeLabel(id) || "Nodo #" + id; }

function scEdgeLabel(id){
  const e = edgeById(id);
  if(!e) return null;
  const a = scNodeLabel(e.from), b = scNodeLabel(e.to);
  return (a || "?") + " → " + (b || "?");
}
function scEdgeSecondary(id){
  const e = edgeById(id);
  if(!e || !e.label) return null;
  return (e.label || "").split("\n")[0].trim() || null;
}
function scTargetLabel(step){
  if(step.action === "SET_STATE") return scNodeFallback(step.nodeId);
  return scEdgeLabel(step.edgeId) || "Conexión #" + step.edgeId;
}
function scIsTargetMissing(step){
  if(step.action === "SET_STATE" || step.action === "OCCURRENCE") return !nodeById(step.nodeId);
  const e = edgeById(step.edgeId);
  if(!e) return true;
  return !nodeById(e.from) || !nodeById(e.to);
}

/* Frontera pura: modelo -> representación humana. */
function describeScenarioStep(step){
  const missing = scIsTargetMissing(step);
  const et = step.eventTypeId ? eventTypeById(step.eventTypeId) : null;

  if(step.action === "SET_STATE"){
    const label = scNodeFallback(step.nodeId);
    if(et){
      const sentence = renderEventSentence(et, null, label);
      return { primary: missing ? ("⚠ " + sentence) : sentence, targetType:"node", targetId:step.nodeId, missing, eventType:et, secondary:null };
    }
    const verb = step.state === "DOWN" ? "se cae" : (step.state === "UP" ? "se recupera" : "cambia de estado");
    return { primary: missing ? "⚠ Elemento eliminado" : (label + " " + verb), targetType:"node", targetId:step.nodeId, missing, eventType:null, secondary:null };
  }

  if(step.action === "OCCURRENCE"){
    const label = scNodeFallback(step.nodeId);
    if(et){
      const sentence = renderEventSentence(et, null, label);
      return { primary: missing ? ("⚠ " + sentence) : sentence, targetType:"node", targetId:step.nodeId, missing, eventType:et, secondary:null };
    }
    return { primary: missing ? "⚠ Elemento eliminado" : (label + " ocurre"), targetType:"node", targetId:step.nodeId, missing, eventType:null, secondary:null };
  }

  // SEND
  const primary = scEdgeLabel(step.edgeId);
  const secondary = scEdgeSecondary(step.edgeId);
  if(et){
    const e = edgeById(step.edgeId);
    const source = e ? scNodeFallback(e.from) : "?";
    const target = e ? scNodeFallback(e.to) : "?";
    const sentence = renderEventSentence(et, source, target);
    return { primary: missing ? ("⚠ " + sentence) : sentence, targetType:"edge", targetId:step.edgeId, missing, eventType:et, secondary };
  }
  return { primary: missing ? "⚠ Conexión eliminada" : ((primary || "?") + " envía"), targetType:"edge", targetId:step.edgeId, missing, eventType:null, secondary };
}

function scBehaviorForNode(nodeId){
  const pg = P();
  if(!pg || !pg.behaviors) return null;
  const b = pg.behaviors.find(x => x.nodeId === nodeId);
  return b ? b.initialState : null;
}
function scSetBehavior(nodeId, state){
  const pg = P();
  if(!pg) return;
  pushUndo();
  pg.behaviors = pg.behaviors.filter(b => b.nodeId !== nodeId);
  if(state === "DOWN") pg.behaviors.push({nodeId, initialState:"DOWN"});
  scheduleAutosave();
  scRenderBehaviors();
}

/* Timestamp por defecto al crear un nuevo momento. */
function scStepDefaultTime(sc){
  if(!sc || !sc.steps.length) return 0;
  return sc.steps[sc.steps.length - 1].at + DEFAULT_STEP_DELAY;
}

/* ===================== Render del panel ===================== */
function scRenderPanel(){
  scRenderSelector();
  scRenderName();
  scRenderUnsupported();
  scRenderErrors();
  scRenderEventLibrary();
  scRenderStoryboard();
  scRenderButtons();
  scRenderConfig();
  scRenderTraceLog();
  scRenderCanvasActions();
}

function scRenderSelector(){
  const sel = $("scSel"); if(!sel) return;
  const prev = sel.value;
  sel.innerHTML = "";
  const pg = P();
  const list = pg && pg.scenarios ? pg.scenarios : [];
  for(const sc of list){
    const opt = document.createElement("option");
    opt.value = sc.id;
    opt.textContent = sc.name;
    sel.appendChild(opt);
  }
  sel.value = String(scActiveId || (list[0] && list[0].id) || "");
  if(prev !== sel.value) scActiveId = sel.value ? +sel.value : null;
}

function scRenderName(){
  const sc = scActiveScenario();
  const el = $("scName"); if(!el) return;
  el.value = sc ? sc.name : "";
  el.disabled = !sc || isScenarioPlaybackActive();
}

function scRenderUnsupported(){
  const sc = scActiveScenario();
  const el = $("scUnsupported"); if(!el) return;
  el.style.display = (sc && sc.engineVersion !== FluyoScenarios.ENGINE_VERSION) ? "block" : "none";
}

function scRenderErrors(){
  const el = $("scErrors"); if(!el) return;
  if(!scErrors.length){ el.style.display="none"; el.textContent=""; return; }
  el.style.display = "block";
  el.innerHTML = scErrors.map(e => "• " + escapeHtml(e)).join("<br>");
}

function escapeHtml(s){
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function scRenderConfig(){
  scRenderBehaviors();
}

function scRenderBehaviors(){
  const cont = $("scBehaviors"); if(!cont) return;
  cont.innerHTML = "";
  const pg = P();
  if(!pg || !pg.behaviors || !pg.behaviors.length){
    const p = document.createElement("p");
    p.className = "hint";
    p.textContent = "Todos los nodos comienzan UP. Añade un override para cambiar el estado inicial.";
    cont.appendChild(p);
    return;
  }
  for(const b of pg.behaviors){
    const row = document.createElement("div");
    row.className = "scBehaviorRow";
    const lbl = scNodeLabel(b.nodeId);
    const nameSpan = document.createElement("span");
    nameSpan.textContent = lbl || "Nodo #"+b.nodeId;
    row.appendChild(nameSpan);

    const stateSel = document.createElement("select");
    stateSel.title = "Estado inicial";
    stateSel.disabled = isScenarioPlaybackActive();
    stateSel.innerHTML = '<option value="UP">UP</option><option value="DOWN">DOWN</option>';
    stateSel.value = b.initialState;
    stateSel.onchange = () => { scSetBehavior(b.nodeId, stateSel.value); };
    row.appendChild(stateSel);

    const del = document.createElement("button");
    del.type = "button"; del.className = "mini";
    del.textContent = "✕";
    del.title = "Quitar override";
    del.setAttribute("aria-label", "Quitar override de " + (lbl || "Nodo #"+b.nodeId));
    del.disabled = isScenarioPlaybackActive();
    del.onclick = () => { scSetBehavior(b.nodeId, "UP"); };
    row.appendChild(del);
    cont.appendChild(row);
  }
}

/* ===================== Storyboard ===================== */
function scRuntimeStateForStep(step){
  if(!scPlayback || !isScenarioPlaybackActive()) return {status:"pending", detail:null};
  const events = scPlayback.logEvents || [];
  // Buscar el evento más avanzado para este step
  let last = null;
  for(const ev of events){
    if(ev.stepId === step.id) last = ev;
  }
  if(!last){
    // Aún no llegamos al timestamp
    if(scPlayback.cursorVirtual < step.at) return {status:"pending", detail:null};
    return {status:"active", detail:null};
  }
  if(last.type === "state_changed" || last.type === "event_occurred") return {status:"completed", detail:null};
  if(last.type === "send_succeeded") return {status:"success", detail:null};
  if(last.type === "send_failed"){
    const reasonText = last.reason === "source_down" ? "Origen no disponible" : "Destino no disponible";
    return {status:"failed", detail:reasonText};
  }
  if(last.type === "send_started") return {status:"active", detail:null};
  return {status:"pending", detail:null};
}

function scRenderStoryboard(){
  const board = $("scStoryboard"); if(!board) return;
  const empty = $("scEmptyState");
  board.innerHTML = "";
  const sc = scActiveScenario();
  if(!sc || !sc.steps || !sc.steps.length){
    if(empty) empty.style.display = "block";
    return;
  }
  if(empty) empty.style.display = "none";

  const playing = isScenarioPlaybackActive();
  let groupAt = null;
  let groupIdx = 0;

  sc.steps.forEach((step, idx) => {
    const isNewGroup = groupAt === null || step.at !== groupAt;
    if(isNewGroup){
      groupAt = step.at;
      groupIdx = idx;
      const delay = groupIdx === 0 ? step.at : (step.at - sc.steps[groupIdx-1].at);
      const header = document.createElement("div");
      header.className = "scMomentHeader";
      header.textContent = groupIdx === 0 && step.at === 0 ? "" : formatRelativeDelay(delay);
      if(header.textContent) board.appendChild(header);
    }
    const runtime = playing ? scRuntimeStateForStep(step) : {status:"pending", detail:null};
    const card = scBuildStepCard(step, idx, runtime);
    board.appendChild(card);
  });
}

function scBuildStepCard(step, idx, runtime){
  const desc = describeScenarioStep(step);
  const card = document.createElement("div");
  card.className = "scStepCard" + (desc.missing ? " missing" : "") + " scStatus_" + runtime.status;

  const main = document.createElement("div");
  main.className = "scStepMain";

  const number = document.createElement("span");
  number.className = "scStepNumber";
  number.textContent = (idx + 1);
  main.appendChild(number);

  const body = document.createElement("div");
  body.className = "scStepBody";

  const primary = document.createElement("div");
  primary.className = "scStepPrimary";
  if(desc.eventType && desc.eventType.visual && desc.eventType.visual.value){
    const token = document.createElement("span");
    token.className = "scEventToken";
    token.textContent = desc.eventType.visual.value + " ";
    primary.appendChild(token);
  }
  primary.appendChild(document.createTextNode(desc.primary));
  body.appendChild(primary);

  if(desc.secondary){
    const secondary = document.createElement("div");
    secondary.className = "scStepSecondary";
    secondary.textContent = desc.secondary;
    body.appendChild(secondary);
  }

  if(runtime.detail){
    const detail = document.createElement("div");
    detail.className = "scStepDetail";
    detail.textContent = runtime.detail;
    body.appendChild(detail);
  }

  main.appendChild(body);

  const actions = document.createElement("div");
  actions.className = "scStepActions";

  const statusMark = document.createElement("span");
  statusMark.className = "scStepStatusMark";
  statusMark.textContent = scStatusMark(runtime.status);
  actions.appendChild(statusMark);

  if(!isScenarioPlaybackActive()){
    const menu = document.createElement("button");
    menu.type = "button"; menu.className = "mini scMenuBtn";
    menu.textContent = "⋯";
    menu.title = "Opciones";
    menu.setAttribute("aria-label", "Opciones del momento " + (idx + 1));
    menu.onclick = (ev) => { ev.stopPropagation(); scToggleExpanded(step.id); };
    actions.appendChild(menu);
  }

  main.appendChild(actions);
  card.appendChild(main);

  if(scExpandedStepId === step.id && !isScenarioPlaybackActive()){
    card.appendChild(scBuildStepForm(step, idx));
  }

  main.onclick = () => {
    if(scExpandedStepId === step.id) return;
    scSelectTarget(desc.targetType, desc.targetId);
  };

  return card;
}

function scStatusMark(status){
  switch(status){
    case "pending": return "○";
    case "active": return "▶";
    case "completed": return "✓";
    case "success": return "✓";
    case "failed": return "✕";
    default: return "○";
  }
}

function scSelectTarget(type, id){
  if(!id) return;
  if(type === "node" && nodeById(id)){ selectOnly("node", id); }
  else if(type === "edge" && edgeById(id)){ selectOnly("edge", id); }
}

function scToggleExpanded(id){
  if(scExpandedStepId === id) scExpandedStepId = null;
  else scExpandedStepId = id;
  scRenderStoryboard();
}

function scBuildStepForm(step, idx){
  const wrap = document.createElement("div");
  wrap.className = "scStepForm";
  const sc = scActiveScenario();

  function makeField(labelText, control){
    const field = document.createElement("div");
    field.className = "scStepField";
    const label = document.createElement("label");
    label.textContent = labelText;
    if(control.id) label.setAttribute("for", control.id);
    if(!control.id && (control.tagName === "SELECT" || control.tagName === "INPUT")){
      const uid = "scStep_" + step.id + "_" + labelText.toLowerCase().replace(/[^a-z0-9]/g,"_");
      control.id = uid; label.setAttribute("for", uid);
    }
    field.appendChild(label);
    field.appendChild(control);
    return field;
  }

  /* Tiempo relativo editable */
  const prev = idx === 0 ? null : sc.steps[idx-1];
  const currentDelay = idx === 0 ? step.at : (step.at - prev.at);

  const timeRow = document.createElement("div");
  timeRow.className = "scTimeRow";
  const timeIn = document.createElement("input");
  timeIn.type = "number"; timeIn.min = 0; timeIn.step = 1;
  const unitSel = document.createElement("select");
  unitSel.innerHTML = '<option value="ms">ms</option><option value="s">segundo(s)</option>';
  if(currentDelay >= 1000 && currentDelay % 1000 === 0){
    timeIn.value = currentDelay / 1000;
    unitSel.value = "s";
  } else {
    timeIn.value = currentDelay;
    unitSel.value = "ms";
  }
  const delayLabel = document.createElement("span");
  delayLabel.className = "scTimeLabel";
  delayLabel.textContent = idx === 0 ? "Después de" : "después del anterior";
  timeRow.appendChild(delayLabel);
  timeRow.appendChild(timeIn);
  timeRow.appendChild(unitSel);

  const applyTime = () => {
    const ms = parseHumanDelay(timeIn.value, unitSel.value);
    if(ms === null) return;
    scSetStepDelay(step.id, ms);
  };
  timeIn.onchange = applyTime;
  unitSel.onchange = applyTime;
  wrap.appendChild(makeField(idx === 0 ? "Tiempo" : "Tiempo relativo", timeRow));

  /* Presets simples */
  const presets = document.createElement("div");
  presets.className = "scTimePresets";
  [250, 500, 1000, 2000, 5000].forEach(ms => {
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "mini";
    btn.textContent = formatRelativeDelay(ms).replace(" después", "");
    btn.onclick = () => { scSetStepDelay(step.id, ms); };
    presets.appendChild(btn);
  });
  wrap.appendChild(presets);

  /* EventType compatible */
  const etSel = document.createElement("select");
  const currentEt = step.eventTypeId ? eventTypeById(step.eventTypeId) : null;
  const compatiblePrimitive = step.action === "SEND" ? "FLOW" : (step.action === "SET_STATE" ? "SET_AVAILABILITY" : "OCCURRENCE");
  doc.eventTypes.forEach(et => {
    if(et.primitive !== compatiblePrimitive) return;
    const opt = document.createElement("option");
    opt.value = et.id;
    opt.textContent = (et.visual.value ? et.visual.value + " " : "") + et.name;
    etSel.appendChild(opt);
  });
  // opción legacy
  const legacyOpt = document.createElement("option");
  legacyOpt.value = "";
  legacyOpt.textContent = step.action === "SET_STATE" ? "Evento por defecto" : (step.action === "SEND" ? "Envío por defecto" : "Evento por defecto");
  etSel.insertBefore(legacyOpt, etSel.firstChild);
  etSel.value = currentEt ? String(currentEt.id) : "";
  etSel.onchange = () => {
    pushUndo();
    const v = etSel.value;
    if(v === "") delete step.eventTypeId;
    else step.eventTypeId = +v;
    // Ajustar semántica si el EventType lo requiere
    const et = step.eventTypeId ? eventTypeById(step.eventTypeId) : null;
    if(step.action === "SET_STATE" && et && et.availability) step.state = et.availability;
    scheduleAutosave();
    scRenderStoryboard();
  };
  wrap.appendChild(makeField("Evento", etSel));

  /* Target según action */
  if(step.action === "SET_STATE" || step.action === "OCCURRENCE"){
    const nodeSel = document.createElement("select");
    P().nodes.forEach(n => {
      const opt = document.createElement("option");
      opt.value = n.id; opt.textContent = scNodeFallback(n.id);
      nodeSel.appendChild(opt);
    });
    if(!P().nodes.some(n=>n.id===step.nodeId)){
      const opt = document.createElement("option");
      opt.value = step.nodeId; opt.textContent = "Nodo #"+step.nodeId;
      nodeSel.appendChild(opt);
    }
    nodeSel.value = step.nodeId;
    nodeSel.onchange = () => { pushUndo(); step.nodeId = +nodeSel.value; scheduleAutosave(); scRenderStoryboard(); };
    wrap.appendChild(makeField("Elemento", nodeSel));

    if(step.action === "SET_STATE"){
      const stateSel = document.createElement("select");
      stateSel.innerHTML = '<option value="DOWN">No disponible</option><option value="UP">Disponible</option>';
      stateSel.value = step.state;
      stateSel.onchange = () => { pushUndo(); step.state = stateSel.value; scheduleAutosave(); scRenderStoryboard(); };
      wrap.appendChild(makeField("Estado", stateSel));
    }
  } else {
    const edgeSel = document.createElement("select");
    P().edges.forEach(e => {
      const opt = document.createElement("option");
      opt.value = e.id; opt.textContent = scEdgeLabel(e.id) || "Conexión #"+e.id;
      edgeSel.appendChild(opt);
    });
    if(!P().edges.some(e=>e.id===step.edgeId)){
      const opt = document.createElement("option");
      opt.value = step.edgeId; opt.textContent = "Conexión #"+step.edgeId;
      edgeSel.appendChild(opt);
    }
    edgeSel.value = step.edgeId;
    edgeSel.onchange = () => { pushUndo(); step.edgeId = +edgeSel.value; scheduleAutosave(); scRenderStoryboard(); };
    wrap.appendChild(makeField("Conexión", edgeSel));
  }

  /* Multi-edge FLOW: añadir otra conexión al mismo momento */
  if(step.action === "SEND" && step.eventTypeId){
    const et = eventTypeById(step.eventTypeId);
    if(et && et.primitive === "FLOW"){
      const addWrap = document.createElement("div");
      addWrap.className = "scStepTargets";
      const addBtn = document.createElement("button");
      addBtn.type = "button"; addBtn.className = "mini";
      addBtn.textContent = "＋ Añadir conexión";
      addBtn.onclick = () => scAddFlowTarget(step);
      addWrap.appendChild(addBtn);
      wrap.appendChild(addWrap);
    }
  }

  /* Reordenar y eliminar */
  const formActions = document.createElement("div");
  formActions.className = "scStepFormActions";

  const up = document.createElement("button");
  up.type = "button"; up.className = "mini";
  up.textContent = "↑";
  up.title = "Subir";
  up.disabled = idx === 0;
  up.onclick = () => scMoveStep(step.id, -1);
  formActions.appendChild(up);

  const down = document.createElement("button");
  down.type = "button"; down.className = "mini";
  down.textContent = "↓";
  down.title = "Bajar";
  down.disabled = idx === sc.steps.length - 1;
  down.onclick = () => scMoveStep(step.id, 1);
  formActions.appendChild(down);

  const del = document.createElement("button");
  del.type = "button"; del.className = "mini danger";
  del.textContent = "Eliminar";
  del.title = "Eliminar acción";
  del.onclick = () => scDeleteStep(step.id);
  formActions.appendChild(del);

  const close = document.createElement("button");
  close.type = "button"; close.className = "mini";
  close.textContent = "Cerrar";
  close.onclick = () => { scExpandedStepId = null; scRenderStoryboard(); };
  formActions.appendChild(close);

  wrap.appendChild(formActions);

  return wrap;
}

/* Política de edición temporal: editar un delay desplaza este Step y todos los posteriores
   manteniendo las distancias relativas entre los momentos siguientes. */
function scSetStepDelay(stepId, delayMs){
  const sc = scActiveScenario();
  if(!sc) return;
  const idx = sc.steps.findIndex(s => s.id === stepId);
  if(idx < 0) return;
  const prevAt = idx === 0 ? 0 : sc.steps[idx-1].at;
  const newAt = prevAt + delayMs;
  const delta = newAt - sc.steps[idx].at;
  if(delta === 0) return;
  pushUndo();
  for(let i = idx; i < sc.steps.length; i++){
    sc.steps[i].at += delta;
  }
  scheduleAutosave();
  scRenderStoryboard();
}

function scRenderButtons(){
  const run = $("scRun"), reset = $("scReset"), add = $("scAddMoment");
  if(run){
    const sc = scActiveScenario();
    run.disabled = !sc || isScenarioPlaybackActive() || sc.engineVersion !== FluyoScenarios.ENGINE_VERSION;
    run.textContent = scStatus === "completed" ? "▶ Run again" : "▶ Run";
    run.style.display = scStatus === "running" ? "none" : "inline-flex";
  }
  if(reset){
    reset.disabled = scStatus === "idle";
    reset.style.display = scStatus === "idle" ? "none" : "inline-flex";
    reset.textContent = "Reset";
  }
  if(add) add.disabled = isScenarioPlaybackActive();
}

function scRenderTraceLog(){
  const cont = $("scTraceLog"); if(!cont) return;
  cont.innerHTML = "";
  let events = [];
  if(scPlayback){
    events = scPlayback.logEvents.slice();
  }
  if(!events.length){
    const p = document.createElement("p"); p.className="hint"; p.textContent="El Trace aparecerá aquí al ejecutar."; cont.appendChild(p); return;
  }
  events.forEach(ev => {
    const line = document.createElement("div");
    line.className = "scLogLine";
    const mark = document.createElement("span");
    mark.className = "scLogMark";
    const body = document.createElement("span");
    const time = scFormatTime(ev.at);
    if(ev.type === "state_changed"){
      const lbl = scNodeLabel(ev.nodeId) || "Nodo #"+ev.nodeId;
      mark.textContent = "◦";
      body.textContent = time + "  " + escapeHtml(lbl) + " " + (ev.from || "UP") + " → " + ev.to;
    } else if(ev.type === "event_occurred"){
      const lbl = scNodeLabel(ev.nodeId) || "Nodo #"+ev.nodeId;
      mark.textContent = "●";
      body.textContent = time + "  " + escapeHtml(lbl) + "  event_occurred";
    } else if(ev.type === "send_started"){
      const lbl = scEdgeLabel(ev.edgeId) || "Conexión #"+ev.edgeId;
      mark.textContent = "→";
      body.textContent = time + "  " + escapeHtml(lbl) + "  Envío";
    } else if(ev.type === "send_succeeded"){
      const lbl = scEdgeLabel(ev.edgeId) || "Conexión #"+ev.edgeId;
      mark.textContent = "✓";
      line.classList.add("success");
      const result = document.createElement("span"); result.className="scLogResult"; result.textContent="Éxito";
      body.appendChild(document.createTextNode(time + "  " + escapeHtml(lbl) + "  "));
      body.appendChild(result);
    } else if(ev.type === "send_failed"){
      const lbl = scEdgeLabel(ev.edgeId) || "Conexión #"+ev.edgeId;
      mark.textContent = "✕";
      line.classList.add("fail");
      const reasonText = ev.reason === "source_down" ? "Origen caído" : (ev.reason === "target_down" ? "Destino caído" : "Falló");
      const result = document.createElement("span"); result.className="scLogResult"; result.textContent=reasonText;
      body.appendChild(document.createTextNode(time + "  " + escapeHtml(lbl) + "  "));
      body.appendChild(result);
    }
    line.appendChild(mark);
    line.appendChild(body);
    cont.appendChild(line);
  });
  cont.scrollTop = cont.scrollHeight;
}

function scRenderStatus(){
  const el = $("scStatus"); if(!el) return;
  if(scStatus === "idle"){ el.textContent = ""; return; }
  if(scStatus === "running"){
    const t = scPlayback ? scPlayback.cursorVirtual : 0;
    el.textContent = "Reproduciendo " + scFormatTime(t);
    return;
  }
  el.textContent = "Completado";
}

/* ===================== Acciones de Scenario ===================== */
function scNewScenario(){
  if(isScenarioPlaybackActive()) return;
  const pg = P();
  pushUndo();
  const sc = createScenario(pg, "Scenario " + (pg.scenarios.length + 1));
  scActiveId = sc.id;
  scExpandedStepId = null;
  scheduleAutosave();
  scRenderPanel();
}
function scDeleteScenario(){
  if(isScenarioPlaybackActive()) scReset();
  const sc = scActiveScenario();
  if(!sc) return;
  if(!confirm("¿Eliminar el Scenario «" + sc.name + "»?")) return;
  const pg = P();
  pushUndo();
  deleteScenario(pg, sc.id);
  scActiveId = pg.scenarios.length ? pg.scenarios[0].id : null;
  scExpandedStepId = null;
  scheduleAutosave();
  scRenderPanel();
}
function scSwitchScenario(id){
  if(isScenarioPlaybackActive()) scReset();
  scActiveId = +id;
  scErrors = [];
  scExpandedStepId = null;
  scRenderPanel();
}
function scRenameScenario(name){
  const sc = scActiveScenario();
  if(!sc || isScenarioPlaybackActive()) return;
  const trimmed = String(name).trim();
  if(!trimmed || trimmed.length > 120) return;
  if(sc.name === trimmed) return;
  pushUndo();
  sc.name = trimmed;
  scheduleAutosave();
  scRenderSelector();
}

/* ===================== Acciones de Behavior ===================== */
function scAddBehaviorUI(){
  if(isScenarioPlaybackActive()) return;
  const pg = P();
  if(!pg || !pg.nodes.length) return;
  const used = new Set((pg.behaviors||[]).map(b=>b.nodeId));
  const node = pg.nodes.find(n => !used.has(n.id));
  if(!node) return;
  scSetBehavior(node.id, "DOWN");
}

/* ===================== Acciones de Step ===================== */
function scAddMomentUI(){
  if(isScenarioPlaybackActive()) return;
  const dialog = $("scMomentDialog");
  if(dialog) dialog.style.display = "flex";
}
function scHideMomentDialog(){
  const dialog = $("scMomentDialog");
  if(dialog) dialog.style.display = "none";
}
function scAddStepFromChoice(kind){
  scHideMomentDialog();
  const sc = scActiveScenario();
  if(!sc) return;
  if(sc.engineVersion !== FluyoScenarios.ENGINE_VERSION) return;
  const pg = P();
  if(kind === "state"){
    if(!pg.nodes.length) return;
    scAddStateStep(pg.nodes[0].id, "DOWN");
  } else if(kind === "send"){
    if(!pg.edges.length) return;
    scAddSendStep(pg.edges[0].id);
  }
}

function scAddStateStep(nodeId, state, eventTypeId){
  if(isScenarioPlaybackActive()) return;
  const sc = scActiveScenario();
  if(!sc) return;
  if(sc.engineVersion !== FluyoScenarios.ENGINE_VERSION) return;
  pushUndo();
  const def = {at: scStepDefaultTime(sc), action:"SET_STATE", nodeId, state};
  if(eventTypeId) def.eventTypeId = eventTypeId;
  createStep(sc, def);
  scheduleAutosave();
  scExpandedStepId = null;
  scRenderStoryboard();
  scRenderButtons();
}
function scAddSendStep(edgeId, eventTypeId){
  if(isScenarioPlaybackActive()) return;
  const sc = scActiveScenario();
  if(!sc) return;
  if(sc.engineVersion !== FluyoScenarios.ENGINE_VERSION) return;
  pushUndo();
  const def = {at: scStepDefaultTime(sc), action:"SEND", edgeId};
  if(eventTypeId) def.eventTypeId = eventTypeId;
  createStep(sc, def);
  scheduleAutosave();
  scExpandedStepId = null;
  scRenderStoryboard();
  scRenderButtons();
}

function scAddOccurrenceStep(nodeId, eventTypeId){
  if(isScenarioPlaybackActive()) return;
  const sc = scActiveScenario();
  if(!sc) return;
  if(sc.engineVersion !== FluyoScenarios.ENGINE_VERSION) return;
  pushUndo();
  const def = {at: scStepDefaultTime(sc), action:"OCCURRENCE", nodeId};
  if(eventTypeId) def.eventTypeId = eventTypeId;
  createStep(sc, def);
  scheduleAutosave();
  scExpandedStepId = null;
  scRenderStoryboard();
  scRenderButtons();
}

function scAddFlowTarget(step){
  if(isScenarioPlaybackActive()) return;
  const sc = scActiveScenario();
  if(!sc) return;
  const et = step.eventTypeId ? eventTypeById(step.eventTypeId) : null;
  if(!et || et.primitive !== "FLOW") return;
  const usedEdges = new Set(sc.steps.filter(s => s.at === step.at && s.eventTypeId === step.eventTypeId && s.action === "SEND").map(s => s.edgeId));
  const nextEdge = P().edges.find(e => !usedEdges.has(e.id));
  if(!nextEdge) return;
  pushUndo();
  createStep(sc, {at: step.at, action:"SEND", edgeId: nextEdge.id, eventTypeId: step.eventTypeId});
  scheduleAutosave();
  scRenderStoryboard();
}

function scCanvasAddNodeStep(state){
  const s = singleSel();
  if(!s || s.type !== "node") return;
  scAddStateStep(s.obj.id, state);
}
function scCanvasAddEdgeSend(){
  const s = singleSel();
  if(!s || s.type !== "edge") return;
  scAddSendStep(s.obj.id);
}

function scDeleteStep(id){
  if(isScenarioPlaybackActive()) return;
  const sc = scActiveScenario();
  if(!sc) return;
  pushUndo();
  deleteStep(sc, id);
  if(scExpandedStepId === id) scExpandedStepId = null;
  scheduleAutosave();
  scRenderStoryboard();
  scRenderButtons();
}
function scMoveStep(id, dir){
  if(isScenarioPlaybackActive()) return;
  const sc = scActiveScenario();
  if(!sc) return;
  const idx = sc.steps.findIndex(s => s.id === id);
  if(idx < 0) return;
  const j = idx + dir;
  if(j < 0 || j >= sc.steps.length) return;
  pushUndo();
  const tmp = sc.steps[idx];
  sc.steps[idx] = sc.steps[j];
  sc.steps[j] = tmp;
  scheduleAutosave();
  scRenderStoryboard();
}

/* ===================== Run / Reset ===================== */
function scRun(){
  if(isScenarioPlaybackActive()) return;
  const sc = scActiveScenario();
  if(!sc) return;
  scErrors = [];
  scExpandedStepId = null;
  const structure = {nodes: P().nodes, edges: P().edges};
  const result = FluyoScenarios.runScenario(structure, P().behaviors || [], sc);
  if(!result.ok){
    const map = {
      missing_node: "Un paso SET_STATE apunta a un nodo que ya no existe.",
      missing_edge: "Un paso SEND apunta a una conexión que ya no existe.",
      missing_edge_endpoint: "Una conexión del diagrama tiene un extremo perdido.",
      duplicate_structure_id: "Hay IDs duplicados entre nodos y conexiones.",
      duplicate_node_id: "Hay IDs de nodo duplicados.",
      duplicate_edge_id: "Hay IDs de conexión duplicados.",
      unsupported_engine_version: "Este Scenario usa una versión de ejecución no soportada.",
      guard_exceeded: "El Scenario excede un límite operativo de ejecución.",
      invalid_timestamp: "Un paso tiene un tiempo fuera de rango.",
      invalid_structure: "La estructura de la página no es válida.",
      invalid_behavior: "El estado inicial de un nodo no es válido.",
      invalid_scenario: "El Scenario tiene datos inválidos.",
      invalid_state: "Un paso SET_STATE tiene un estado no válido.",
      unknown_action: "Un paso tiene una acción desconocida.",
      duplicate_step_id: "Hay IDs de paso duplicados."
    };
    const seen = new Set();
    scErrors = result.errors.map(err => map[err.code] || (err.code ? "Error: " + err.code : "Error desconocido"))
                            .filter(msg => { if(seen.has(msg)) return false; seen.add(msg); return true; });
    scRenderErrors();
    return;
  }
  scPlayback = FluyoScenarioPlayback.makePlayback(result.trace);
  scPlayback.startedAtReal = performance.now();
  scStatus = "running";
  if(typeof switchPanelTab === "function") switchPanelTab("scenarios");
  const tabProp = $("tabProperties");
  if(tabProp) tabProp.disabled = true;
  scRenderButtons();
  scRenderPanel();
  scScheduleTick();
}

function scReset(){
  if(scRafId !== null){ cancelAnimationFrame(scRafId); scRafId = null; }
  scPlayback = null;
  scStatus = "idle";
  scErrors = [];
  const tabProp = $("tabProperties");
  if(tabProp) tabProp.disabled = false;
  scRenderPanel();
}

function scScheduleTick(){
  if(scRafId !== null) cancelAnimationFrame(scRafId);
  scRafId = requestAnimationFrame(scTick);
}
function scTick(now){
  scRafId = null;
  if(!scPlayback || scStatus !== "running") return;
  FluyoScenarioPlayback.tick(scPlayback, now);
  scRenderStatus();
  scRenderStoryboard();
  scRenderTraceLog();
  if(scPlayback.nextEventIndex >= (scPlayback.trace.events||[]).length && scPlayback.activeSends.length===0 && scPlayback.completedSends.length===0){
    scStatus = "completed";
    scRenderButtons();
  } else {
    scScheduleTick();
  }
}

/* ===================== RenderState para el renderer ===================== */
function buildScenarioRenderState(){
  if(!scPlayback) return null;
  const rs = FluyoScenarioPlayback.tick(scPlayback, performance.now());
  return {
    nodeStates: rs.nodeStates,
    activeSends: rs.activeSends,
    completedSends: rs.completedSends,
    activeOccurrences: rs.activeOccurrences,
    completedOccurrences: rs.completedOccurrences,
    scenario: scActiveScenario(),
    suppressFlow: true
  };
}

/* ===================== Canvas-first authoring ===================== */
function scIsScenariosTabActive(){
  const panel = $("panelScenarios");
  return panel && panel.style.display !== "none";
}

function scRenderCanvasActions(){
  const wrap = $("scCanvasActions");
  const btnWrap = $("scCanvasActionButtons");
  if(!wrap || !btnWrap) return;
  const s = singleSel();
  if(!scIsScenariosTabActive() || isScenarioPlaybackActive() || !s){
    wrap.style.display = "none";
    return;
  }
  btnWrap.innerHTML = "";
  if(s.type === "node"){
    const down = document.createElement("button");
    down.type = "button"; down.textContent = "Se cae";
    down.onclick = () => scCanvasAddNodeStep("DOWN");
    btnWrap.appendChild(down);
    const up = document.createElement("button");
    up.type = "button"; up.textContent = "Se recupera";
    up.onclick = () => scCanvasAddNodeStep("UP");
    btnWrap.appendChild(up);
  } else if(s.type === "edge"){
    const send = document.createElement("button");
    send.type = "button"; send.textContent = "Enviar";
    send.onclick = () => scCanvasAddEdgeSend();
    btnWrap.appendChild(send);
  }
  wrap.style.display = btnWrap.children.length ? "block" : "none";
}

/* ===================== Biblioteca de EventTypes ===================== */
function scRenderEventLibrary(){
  const cont = $("scEventLibrary"); if(!cont) return;
  cont.innerHTML = "";
  if(!doc.eventTypes || !doc.eventTypes.length){
    const p = document.createElement("p");
    p.className = "hint";
    p.textContent = "Aún no hay eventos. Crea uno para empezar a construir Scenarios.";
    cont.appendChild(p);
    return;
  }
  for(const et of doc.eventTypes){
    const row = document.createElement("div");
    row.className = "scEventChip";
    row.draggable = false;
    row.dataset.eventTypeId = et.id;
    const token = document.createElement("span");
    token.className = "scEventChipToken";
    token.textContent = et.visual.value || "●";
    const name = document.createElement("span");
    name.className = "scEventChipName";
    name.textContent = et.name;
    const label = document.createElement("span");
    label.className = "scEventChipPrimitive";
    label.textContent = EVENT_PRIMITIVE_LABELS[et.primitive] || et.primitive;
    row.appendChild(token);
    row.appendChild(name);
    row.appendChild(label);
    if(!isScenarioPlaybackActive()){
      row.onpointerdown = ev => scStartDragEventType(et.id, ev.clientX, ev.clientY);
      const editBtn = document.createElement("button");
      editBtn.type = "button"; editBtn.className = "mini";
      editBtn.textContent = "✎";
      editBtn.title = "Editar";
      editBtn.onclick = ev => { ev.stopPropagation(); scOpenEventDialog(et.id); };
      row.appendChild(editBtn);
    }
    cont.appendChild(row);
  }
}

/* ===================== Editor de EventType ===================== */
function scOpenEventDialog(id){
  scEditingEventTypeId = id || null;
  const et = id ? eventTypeById(id) : null;
  $("scEventDialogTitle").textContent = et ? "Editar evento" : "Crear evento";
  $("scEventName").value = et ? et.name : "";
  $("scEventPrimitive").value = et ? et.primitive : "FLOW";
  $("scEventTemplate").value = et ? et.sentenceTemplate : "{source} {target}";
  $("scEventVisual").value = et && et.visual ? et.visual.value : "●";
  $("scEventAvailabilityRow").style.display = (et && et.primitive === "SET_AVAILABILITY") ? "flex" : "none";
  $("scEventAvailability").value = et && et.availability ? et.availability : "DOWN";
  $("scEventDelete").style.display = (et && !eventTypeIsUsed(et.id)) ? "inline-flex" : "none";
  scUpdateEventPreview();
  $("scEventDialog").style.display = "flex";
}
function scCloseEventDialog(){ $("scEventDialog").style.display = "none"; scEditingEventTypeId = null; }
function scUpdateEventPreview(){
  const name = $("scEventName").value.trim();
  const primitive = $("scEventPrimitive").value;
  const template = $("scEventTemplate").value;
  const visual = $("scEventVisual").value;
  const preview = $("scEventPreview");
  const fakeEt = {name, primitive, sentenceTemplate:template, visual:{kind:"token", value:visual}};
  let text;
  if(primitive === "FLOW") text = renderEventSentence(fakeEt, "Cliente", "Comercio");
  else text = renderEventSentence(fakeEt, null, "Solicitud");
  preview.textContent = text;
}
function scSaveEventType(){
  const name = $("scEventName").value.trim();
  const primitive = $("scEventPrimitive").value;
  const template = $("scEventTemplate").value.trim();
  const visual = $("scEventVisual").value.trim();
  const availability = $("scEventAvailability").value;
  if(!name || !template) return;
  pushUndo();
  try{
    if(scEditingEventTypeId){
      const changes = {name, sentenceTemplate:template, visual:{value:visual}};
      if(eventTypeById(scEditingEventTypeId).primitive === "SET_AVAILABILITY" && !eventTypeIsUsed(scEditingEventTypeId)){
        changes.availability = availability;
      }
      updateEventType(scEditingEventTypeId, changes);
    } else {
      const def = {name, primitive, sentenceTemplate:template, visual:{value:visual}};
      if(primitive === "SET_AVAILABILITY") def.availability = availability;
      createEventType(def);
    }
    scheduleAutosave();
    scCloseEventDialog();
    scRenderPanel();
  }catch(e){ console.error(e); alert("No se pudo guardar el evento."); }
}
function scDeleteEventTypeUI(){
  if(!scEditingEventTypeId) return;
  const et = eventTypeById(scEditingEventTypeId);
  if(!et) return;
  if(eventTypeIsUsed(et.id)){
    alert("Este evento se usa en " + eventTypeUseCount(et.id) + " momento(s). Cambia o elimina esas instancias primero.");
    return;
  }
  if(!confirm("¿Eliminar el evento \"" + et.name + "\"?")) return;
  pushUndo();
  deleteEventType(et.id);
  scheduleAutosave();
  scCloseEventDialog();
  scRenderPanel();
}

/* ===================== Drag & Drop espacial de EventTypes ===================== */
function scStartDragEventType(eventTypeId, clientX, clientY){
  if(isScenarioPlaybackActive()) return;
  const et = eventTypeById(eventTypeId); if(!et) return;
  const ghost = document.createElement("div");
  ghost.className = "scDragGhost";
  ghost.textContent = (et.visual.value || "●") + " " + et.name;
  ghost.style.position = "fixed";
  ghost.style.left = clientX + "px";
  ghost.style.top = clientY + "px";
  ghost.style.pointerEvents = "none";
  ghost.style.zIndex = "1000";
  document.body.appendChild(ghost);
  scDrag = {eventTypeId, ghost};
}
function scUpdateDrag(clientX, clientY){
  if(!scDrag) return;
  scDrag.ghost.style.left = (clientX + 12) + "px";
  scDrag.ghost.style.top = (clientY + 12) + "px";
}
function scEndDrag(clientX, clientY){
  if(!scDrag) return;
  const ghost = scDrag.ghost;
  const et = eventTypeById(scDrag.eventTypeId);
  scDrag = null;
  ghost.remove();
  if(!et) return;
  const rect = cv.getBoundingClientRect();
  if(clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return;
  const world = toWorldFromClient(clientX, clientY);
  scDropEventTypeAt(et.id, world.x, world.y);
}
function toWorldFromClient(cx, cy){
  const rect = cv.getBoundingClientRect();
  return { x: (cx - rect.left - viewX)/viewZoom, y: (cy - rect.top - viewY)/viewZoom };
}
function scDropEventTypeAt(eventTypeId, wx, wy){
  const et = eventTypeById(eventTypeId); if(!et) return;
  const sc = scActiveScenario();
  if(!sc || sc.engineVersion !== FluyoScenarios.ENGINE_VERSION) return;
  if(et.primitive === "FLOW"){
    const targets = scFindDropTargets("edge", wx, wy, eventTypeId);
    if(!targets.length) return;
    const at = scStepDefaultTime(sc);
    pushUndo();
    for(const edgeId of targets){
      createStep(sc, {at, action:"SEND", edgeId, eventTypeId: et.id});
    }
    scheduleAutosave();
    scExpandedStepId = null;
    scRenderPanel();
  } else {
    const targets = scFindDropTargets("node", wx, wy, eventTypeId);
    if(!targets.length) return;
    const nodeId = targets[0];
    const at = scStepDefaultTime(sc);
    pushUndo();
    if(et.primitive === "OCCURRENCE"){
      createStep(sc, {at, action:"OCCURRENCE", nodeId, eventTypeId: et.id});
    } else if(et.primitive === "SET_AVAILABILITY"){
      createStep(sc, {at, action:"SET_STATE", nodeId, state: et.availability || "DOWN", eventTypeId: et.id});
    }
    scheduleAutosave();
    scExpandedStepId = null;
    scRenderPanel();
  }
}
function scFindDropTargets(kind, wx, wy, eventTypeId){
  const allowed = eventTypeAllowedTargets(eventTypeById(eventTypeId));
  if(kind === "edge"){
    const direct = hitEdge(wx, wy);
    if(direct){
      // Si hay selección múltiple de edges, aplicar a todas las seleccionadas compatibles.
      if(selE.size > 1 && selE.has(direct.id)){
        return [...selE].filter(id => allowed.has("edge"));
      }
      return allowed.has("edge") ? [direct.id] : [];
    }
    // Si no acertó, considerar edges seleccionadas
    if(selE.size) return [...selE].filter(id => allowed.has("edge"));
    return [];
  }
  const n = hitNode(wx, wy);
  if(n) return allowed.has("node") ? [n.id] : [];
  if(selN.size) return [...selN].filter(id => allowed.has("node"));
  return [];
}

/* ===================== Inicialización de UI ===================== */
function scInitUI(){
  const sel = $("scSel"); if(sel) sel.onchange = () => scSwitchScenario(sel.value);
  const newBtn = $("scNew"); if(newBtn) newBtn.onclick = scNewScenario;
  const delBtn = $("scDel"); if(delBtn) delBtn.onclick = scDeleteScenario;
  const nameIn = $("scName");
  if(nameIn){
    nameIn.onchange = () => scRenameScenario(nameIn.value);
    nameIn.onkeydown = ev => { if(ev.key==="Enter"){ nameIn.blur(); } };
  }
  const addB = $("scAddBehavior"); if(addB) addB.onclick = scAddBehaviorUI;
  const addM = $("scAddMoment"); if(addM) addM.onclick = scAddMomentUI;
  const run = $("scRun"); if(run) run.onclick = scRun;
  const reset = $("scReset"); if(reset) reset.onclick = scReset;

  const toggleConfig = $("scToggleConfig");
  if(toggleConfig) toggleConfig.onclick = () => { scConfigOpen = !scConfigOpen; scRenderConfigToggle(); };
  const toggleTrace = $("scToggleTrace");
  if(toggleTrace) toggleTrace.onclick = () => { scTraceOpen = !scTraceOpen; scRenderTraceToggle(); };

  const momentState = $("scMomentState");
  if(momentState) momentState.onclick = () => scAddStepFromChoice("state");
  const momentSend = $("scMomentSend");
  if(momentSend) momentSend.onclick = () => scAddStepFromChoice("send");
  const momentCancel = $("scMomentCancel");
  if(momentCancel) momentCancel.onclick = scHideMomentDialog;

  const btnEventNew = $("scEventNew");
  if(btnEventNew) btnEventNew.onclick = () => scOpenEventDialog(null);
  const btnEventSave = $("scEventSave");
  if(btnEventSave) btnEventSave.onclick = scSaveEventType;
  const btnEventCancel = $("scEventCancel");
  if(btnEventCancel) btnEventCancel.onclick = scCloseEventDialog;
  const btnEventDelete = $("scEventDelete");
  if(btnEventDelete) btnEventDelete.onclick = scDeleteEventTypeUI;
  const selPrimitive = $("scEventPrimitive");
  if(selPrimitive) selPrimitive.onchange = () => {
    $("scEventAvailabilityRow").style.display = selPrimitive.value === "SET_AVAILABILITY" ? "flex" : "none";
    scUpdateEventPreview();
  };
  ["scEventName","scEventTemplate","scEventVisual","scEventAvailability"].forEach(id=>{
    const el=$(id); if(el) el.oninput = scUpdateEventPreview;
  });

  document.addEventListener("pointermove", scGlobalPointerMove);
  document.addEventListener("pointerup", scGlobalPointerUp);

  scActiveId = (P().scenarios && P().scenarios[0]) ? P().scenarios[0].id : null;
  scRenderPanel();
}
function scGlobalPointerMove(ev){
  if(scDrag) scUpdateDrag(ev.clientX, ev.clientY);
}
function scGlobalPointerUp(ev){
  if(scDrag) scEndDrag(ev.clientX, ev.clientY);
}

function scRenderConfigToggle(){
  const el = $("scConfig"); if(!el) return;
  el.style.display = scConfigOpen ? "block" : "none";
  const btn = $("scToggleConfig"); if(btn) btn.classList.toggle("open", scConfigOpen);
}
function scRenderTraceToggle(){
  const el = $("scTraceWrap"); if(!el) return;
  el.style.display = scTraceOpen ? "block" : "none";
  const btn = $("scToggleTrace"); if(btn) btn.classList.toggle("open", scTraceOpen);
}

/* Arranque diferido: la primera vez que se abre la pestaña Scenarios */
let scUiReady = false;
function ensureScenariosUI(){
  if(scUiReady) return;
  scUiReady = true;
  scInitUI();
}

/* Actualizar panel cuando cambia el documento o la selección */
function scRefreshIfVisible(){
  if(!scUiReady) return;
  if($("panelScenarios") && $("panelScenarios").style.display !== "none"){
    scRenderPanel();
  }
}

// Exponer función de renderState al editor-runtime
window.buildScenarioRenderState = buildScenarioRenderState;
window.isScenarioPlaybackActive = isScenarioPlaybackActive;
window.scReset = scReset;
window.ensureScenariosUI = ensureScenariosUI;
window.scRefreshIfVisible = scRefreshIfVisible;
window.scCanvasAddNodeStep = scCanvasAddNodeStep;
window.scCanvasAddEdgeSend = scCanvasAddEdgeSend;
window.scDrag = scDrag;
window.eventTypeById = eventTypeById;
window.renderEventSentence = renderEventSentence;
window.eventTypeAllowedTargets = eventTypeAllowedTargets;
