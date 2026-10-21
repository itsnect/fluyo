"use strict";
/* FLUYO-MCP-STEP-MESSAGE-001 — Mutaciones sobre COPIAS aisladas (nunca sobre el árbol). Cada regresión real del contrato `message`
   (forma y carga, motor, playback, tiempo, autoría y editor) debe hacer fallar test/fluyo-step-message-001.test.cjs SIN contar sus
   tests de alcance (I1, I2): esos comparan el texto con la base y detectarían cualquier mutación sin probar nada.
   Uso: node test/fluyo-step-message-001-mutations.cjs   (ONLY_MUT=M3 una sola) */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const NL = "\n", CRLF = "\r\n";
const UNIT = ["--test", "--test-skip-pattern=^I[12] ", "test/fluyo-step-message-001.test.cjs"];
const EN = "js/scenario-engine.js", MD = "js/model.js", SP = "js/story-playback.js", SA = "js/story-authoring.js", ED = "js/editor-scenarios.js";
/* [nombre, archivo, desde, hasta] */
const MUTATIONS = [
  /* forma y carga */
  ["M1 la carga acepta message en un SEND", MD, "    if(step.action===\"SEND\" || !stepMessageValid(step.message)) throw projectDataError();\n    allowed.push(\"message\");", "    if(!stepMessageValid(step.message)) throw projectDataError();\n    allowed.push(\"message\");"],
  ["M2 \"\" y solo espacios son un mensaje", MD, "typeof v===\"string\" && v.trim().length>0 &&", "typeof v===\"string\" &&"],
  ["M3 sin tope de 120", MD, "&& v.length<=STEP_MESSAGE_MAX_LEN; }", "; }"],
  ["M4 la carga trunca a 120 en vez de rechazar", MD, "function canonicalizePersistedStep(step){", "function canonicalizePersistedStep(step){\n  if(step && typeof step.message===\"string\") step.message=step.message.slice(0,120);"],
  ["M5 la carga normaliza (trim)", MD, "function canonicalizePersistedStep(step){", "function canonicalizePersistedStep(step){\n  if(step && typeof step.message===\"string\" && step.message.trim()) step.message=step.message.trim();"],
  ["M6 la carga quita \"\" en vez de rechazarlo", MD, "function canonicalizePersistedStep(step){", "function canonicalizePersistedStep(step){\n  if(step && typeof step.message===\"string\" && !step.message.trim()) delete step.message;"],
  /* motor */
  ["M7 el motor no filtra message (campo de más)", EN, " && !(k===\"message\" && step.action!==\"SEND\")", ""],
  ["M8 el motor lo filtra también en un SEND", EN, "!(k===\"message\" && step.action!==\"SEND\")", "k!==\"message\""],
  /* playback y tiempo */
  ["M9 el globo ignora el message del paso", SP, "      if(typeof step.message===\"string\") fx.message = step.message;\n", ""],
  ["M10 sin message, el globo queda vacío (pisa el del evento)", SP, "if(typeof step.message===\"string\") fx.message = step.message;", "fx.message = step.message || \"\";"],
  ["M11 la frase dice el message", SP, "    return renderEventSentence(et, null, nodeText(page, step.nodeId));", "    return step.message || renderEventSentence(et, null, nodeText(page, step.nodeId));"],
  ["M12 la duración del globo depende del texto", SP, "if(typeof step.message===\"string\") fx.message = step.message;", "if(typeof step.message===\"string\"){ fx.message = step.message; fx.visualDurationMs = 300 + step.message.length * 40; }"],
  ["M13 el movimiento depende del message (reloj)", SP, "        motion: et && et.motion ? et.motion : DEFAULT_EVENT_MOTION,", "        motion: typeof step.message===\"string\" ? \"slow\" : (et && et.motion ? et.motion : DEFAULT_EVENT_MOTION),"],
  /* kernel de autoría */
  ["M14 stepDefinitionForEvent no escribe message", MD, "    def.message=message;\n", ""],
  ["M15 stepDefinitionForEvent acepta message en un envío", MD, "    if(spec.action===\"SEND\" || !stepMessageValid(message)) throw projectDataError();", "    if(!stepMessageValid(message)) throw projectDataError();"],
  ["M16 setStepMessage(null) no quita la clave", MD, "  if(message===null) delete step.message;", "  if(message===null) step.message=\"\";"],
  ["M17 setStepMessage acepta un SEND", MD, "  if(step.action===\"SEND\") throw projectDataError();\n  if(message===null)", "  if(message===null)"],
  ["M18 duplicateStep pierde el message", MD, "  const copy=createStep(sc,{...rest});", "  const {message:_m,...noMsg}=rest;\n  const copy=createStep(sc,{...noMsg});"],
  ["M19 retargetStep borra el message", MD, "    step.nodeId=targetId;\n  }", "    step.nodeId=targetId;\n    delete step.message;\n  }"],
  /* lote */
  ["M20 add_step ignora message", SA, "const message = op.message===undefined ? undefined : messageOf(op.message, spec);", "const message = undefined;"],
  ["M21 add_step: en FLOW, error genérico (sin explicar)", SA, "    if(spec.action===\"SEND\") throw reject(\"INVALID_OPERATION\", NO_SEND_MESSAGE, {field:\"message\"});\n    if(!stepMessageValid(v))", "    if(!stepMessageValid(v))"],
  ["M22 set_step_message: changed siempre true", SA, "changed:from!==to, affects:storyAffect(op.pageIndex, sc, {stepIds:[st.id]})", "changed:true, affects:storyAffect(op.pageIndex, sc, {stepIds:[st.id]})"],
  ["M23 set_step_message afecta a toda la Historia", SA, "changed:from!==to, affects:storyAffect(op.pageIndex, sc, {stepIds:[st.id]})", "changed:from!==to, affects:storyAffect(op.pageIndex, sc, {stepIds:sc.steps.map(s=>s.id)})"],
  ["M24 set_step_message admite null en un SEND", SA, "      if(st.action===\"SEND\") throw reject(\"INVALID_OPERATION\", NO_SEND_MESSAGE, {field:\"message\", stepId:st.id});\n", ""],
  ["M25 set_step_message no exige message", SA, "      if(op.message===undefined) throw reject(\"INVALID_OPERATION\", \"set_step_message necesita «message»: el texto, o null para quitarlo.\", {field:\"message\"});\n", ""],
  /* editor */
  ["M26 el editor no deja entrada de Undo", ED, "  pushUndo();\n  setStepMessage(sc, id, message);", "  setStepMessage(sc, id, message);"],
  ["M27 el editor hace Undo aunque nada cambie", ED, "  if ((scStepMessage(s) ?? null) === message) return false;\n", ""],
  ["M28 el menú de un envío también ofrece el mensaje", ED, "[scReverseMenuItem(step)] : [scMessageMenuItem(step, anchor)]", "[scReverseMenuItem(step), scMessageMenuItem(step, anchor)] : [scMessageMenuItem(step, anchor)]"],
  ["M29 el hint no dice el mensaje propio", ED, "const hint = own ? \"«\" + own + \"»\" : ", "const hint = "],
];

function copyTree(dest) {
  for (const entry of fs.readdirSync(root).filter((e) => e !== ".git")) {
    const from = path.join(root, entry);
    if (fs.existsSync(from)) fs.cpSync(from, path.join(dest, entry), { recursive: true });
  }
}
function runSuite(dir) {
  const r = spawnSync(process.execPath, UNIT, { cwd: dir, encoding: "utf8", timeout: 300000, env: { ...process.env, FLUYO_GIT_ROOT: root, FLUYO_ROOT: dir } });
  return { code: r.status, timedOut: !!(r.error && r.error.code === "ETIMEDOUT") || r.signal === "SIGTERM", out: (r.stdout || "") + (r.stderr || "") };
}

const t0 = Date.now();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-msg-mut-"));
const list = MUTATIONS.filter((m) => !process.env.ONLY_MUT || m[0].split(" ")[0] === process.env.ONLY_MUT);
let failed = 0;
try {
  const base = path.join(tmp, "base"); fs.mkdirSync(base); copyTree(base);
  const sane = runSuite(base);
  if (sane.code !== 0) { console.error("La copia sin mutar NO pasa:\n" + sane.out.slice(-3000)); process.exit(2); }
  const ran = (sane.out.match(/^# pass (\d+)/m) || [])[1];
  console.log("copia sin mutar: suite OK (" + ran + " tests sin I1/I2; 0/" + list.length + " mutaciones aplicadas)");
  list.forEach(([name, file, from, to], i) => {
    const dir = path.join(tmp, "m" + i); fs.mkdirSync(dir); copyTree(dir);
    const p = path.join(dir, file);
    const src = fs.readFileSync(p, "utf8"), crlf = src.includes(CRLF);
    const text = src.replaceAll(CRLF, NL);
    if (text.split(from).length !== 2) { console.log("  ✘ " + name + " — el patrón no existe o no es único (mutación obsoleta)"); failed++; return; }
    fs.writeFileSync(p, text.replace(from, () => to).replaceAll(NL, crlf ? CRLF : NL));
    const r = runSuite(dir);
    const killed = r.code !== 0;
    const n = (r.out.match(/^not ok /gm) || []).length;
    console.log((killed ? "  ✔ detectada  " : "  ✘ SOBREVIVE  ") + name + (killed ? (r.timedOut || r.code === null ? "  (cuelga: muere por tiempo)" : "  (" + n + " comprobaciones fallan)") : ""));
    if (!killed) failed++;
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  });
} finally {
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
}
console.log((failed ? "\nFLUYO-MCP-STEP-MESSAGE-001 mutaciones: " + failed + " sin detectar" : "\nFLUYO-MCP-STEP-MESSAGE-001 mutaciones: " + list.length + "/" + list.length + " detectadas") + " · " + ((Date.now() - t0) / 1000).toFixed(1) + " s");
process.exit(failed ? 1 : 0);
