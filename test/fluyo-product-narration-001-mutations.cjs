"use strict";
/* FLUYO-PRODUCT-NARRATION-001 — Mutaciones sobre COPIAS aisladas (nunca sobre el árbol). Cada regresión real del contrato (`message` en
   cualquier Step y como título del momento: carga, motor, título, tiempo, autoría y editor) debe hacer fallar
   test/fluyo-product-narration-001.test.cjs SIN contar sus tests de alcance (H1, H2): esos comparan el texto con la base y detectarían
   cualquier mutación sin probar nada. Los rótulos (share.css, styles.css) y la sonda de Present los vigila la suite de navegador.
   Uso: node test/fluyo-product-narration-001-mutations.cjs   (ONLY_MUT=N3 una sola) */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const NL = "\n", CRLF = "\r\n";
const UNIT = ["--test", "--test-skip-pattern=^H[12] ", "test/fluyo-product-narration-001.test.cjs"];
const EN = "js/scenario-engine.js", MD = "js/model.js", SP = "js/story-playback.js", SA = "js/story-authoring.js", ED = "js/editor-scenarios.js";
/* [nombre, archivo, desde, hasta] */
const MUTATIONS = [
  /* forma y carga */
  ["N1 la carga vuelve a rechazar message en un SEND", MD, "    if(!stepMessageValid(step.message)) throw projectDataError();\n    allowed.push(\"message\");", "    if(step.action===\"SEND\" || !stepMessageValid(step.message)) throw projectDataError();\n    allowed.push(\"message\");"],
  ["N2 el motor vuelve a ver message en un SEND como campo de más", EN, " && k!==\"message\");", " && !(k===\"message\" && step.action!==\"SEND\"));"],
  /* el título del momento */
  ["N3 el título ignora el message (siempre el evento)", SP, "    if(typeof step.message===\"string\") return step.message;\n    const et = step.eventTypeId", "    const et = step.eventTypeId"],
  ["N4 el título ignora el message de un envío", SP, "    if(typeof step.message===\"string\") return step.message;", "    if(typeof step.message===\"string\" && step.action!==\"SEND\") return step.message;"],
  ["N5 sin message, el título queda vacío", SP, "    return et ? et.name : \"\";\n  }\n  /* Momentos", "    return \"\";\n  }\n  /* Momentos"],
  ["N6 el título repite textos iguales", SP, "        if(n && !names.includes(n)) names.push(n);", "        if(n) names.push(n);"],
  ["N7 la frase del evento dice el message", SP, "      return renderEventSentence(et, e ? nodeText(page,t.source) : \"?\", e ? nodeText(page,t.target) : \"?\");", "      return step.message || renderEventSentence(et, e ? nodeText(page,t.source) : \"?\", e ? nodeText(page,t.target) : \"?\");"],
  ["N19 todos los momentos se marcan narrados (crecerían sin frase)", SP, "if(g.steps.some(s=>typeof s.message===\"string\")) ms[i].narrated = true;", "ms[i].narrated = true;"],
  ["N20 un momento narrado no se marca", SP, "if(g.steps.some(s=>typeof s.message===\"string\")) ms[i].narrated = true;", "if(false) ms[i].narrated = true;"],
  ["N8 el movimiento de un envío depende del message (reloj)", SP, "        motion: et && et.motion ? et.motion : DEFAULT_EVENT_MOTION,", "        motion: typeof step.message===\"string\" && step.action===\"SEND\" ? \"slow\" : (et && et.motion ? et.motion : DEFAULT_EVENT_MOTION),"],
  /* kernel de autoría */
  ["N9 stepDefinitionForEvent rechaza message en un envío", MD, "    if(!stepMessageValid(message)) throw projectDataError();\n    def.message=message;", "    if(spec.action===\"SEND\" || !stepMessageValid(message)) throw projectDataError();\n    def.message=message;"],
  ["N10 setStepMessage rechaza un SEND", MD, "  if(!step) throw projectDataError(\"step_not_found\");\n  if(message===null) delete step.message;", "  if(!step) throw projectDataError(\"step_not_found\");\n  if(step.action===\"SEND\") throw projectDataError();\n  if(message===null) delete step.message;"],
  ["N11 setStepMessage(null) en un envío le quita también el sentido", MD, "  if(message===null) delete step.message;", "  if(message===null){ delete step.message; delete step.reverse; }"],
  /* lote (MCP) */
  ["N12 add_step ignora el message de un FLOW", SA, "const message = op.message===undefined ? undefined : messageOf(op.message);", "const message = op.message===undefined || spec.action===\"SEND\" ? undefined : messageOf(op.message);"],
  ["N13 set_step_message rechaza un SEND", SA, "      const to = op.message===null ? null : messageOf(op.message);", "      if(st.action===\"SEND\") throw reject(\"INVALID_OPERATION\", \"no\", {field:\"message\"});\n      const to = op.message===null ? null : messageOf(op.message);"],
  /* editor */
  ["N14 el menú de un envío no ofrece el mensaje", ED, "      ...(step.action === \"SEND\" ? [scReverseMenuItem(step)] : []),\n      scMessageMenuItem(step, anchor),", "      ...(step.action === \"SEND\" ? [scReverseMenuItem(step)] : [scMessageMenuItem(step, anchor)]),"],
  ["N15 el editor no guarda el mensaje de un envío", ED, "    s = sc && sc.steps.find((x) => x.id === id);\n  if (!s) return false;", "    s = sc && sc.steps.find((x) => x.id === id);\n  if (!s || s.action === \"SEND\") return false;"],
  ["N16 el hint de un envío no dice lo que se lee", ED, "FluyoI18n.t(\"step.message.nowReads\", \"Ahora se lee «{name}»\", { name: et.name })", "\"Ahora sin mensaje\""],
  ["N17 el editor no deja entrada de Undo", ED, "  pushUndo();\n  setStepMessage(sc, id, message);", "  setStepMessage(sc, id, message);"],
  ["N18 la fila no enseña el message de un envío", ED, "  return step && typeof step.message === \"string\" ? step.message : null;", "  return step && step.action !== \"SEND\" && typeof step.message === \"string\" ? step.message : null;"],
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
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-narr-mut-"));
const list = MUTATIONS.filter((m) => !process.env.ONLY_MUT || m[0].split(" ")[0] === process.env.ONLY_MUT);
let failed = 0;
try {
  const base = path.join(tmp, "base"); fs.mkdirSync(base); copyTree(base);
  const sane = runSuite(base);
  if (sane.code !== 0) { console.error("La copia sin mutar NO pasa:\n" + sane.out.slice(-3000)); process.exit(2); }
  const ran = (sane.out.match(/^# pass (\d+)/m) || [])[1];
  console.log("copia sin mutar: suite OK (" + ran + " tests sin H1/H2; 0/" + list.length + " mutaciones aplicadas)");
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
console.log((failed ? "\nFLUYO-PRODUCT-NARRATION-001 mutaciones: " + failed + " sin detectar" : "\nFLUYO-PRODUCT-NARRATION-001 mutaciones: " + list.length + "/" + list.length + " detectadas") + " · " + ((Date.now() - t0) / 1000).toFixed(1) + " s");
process.exit(failed ? 1 : 0);
