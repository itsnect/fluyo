# FLUYO-009 — Scenario Storyboard UX

## Objetivo

Transformar la UI de Scenarios desde un **form editor** hacia un **system storyboard**: el Scenario se lee como una historia sin abrir controles, las frases se derivan del modelo, el tiempo es relativo, la autoría puede comenzar desde el canvas, el playback ocurre en la misma lista y el Trace técnico pasa a una sección secundaria. No se cambia la semántica del engine.

## Contexto

La iteración anterior (FLUYO-009 base) dejó la UI funcional pero con apariencia de formulario técnico: cards abiertas, timestamps absolutos, Trace como experiencia principal y controles de Scenario compitiendo con la historia. Esta iteración reutiliza todo el engine/playback y el formulario existente, pero lo envuelve en una experiencia de storyboard.

## Decisiones clave

### 1. Modelo de interacción: READ FIRST, EDIT SECOND

- Las cards están **colapsadas por defecto**.
- Una card colapsada muestra: número, frase humana, delay relativo y menú de opciones.
- Hacer click en una card colapsada **selecciona el target en el canvas** (nodo o edge).
- El menú `⋯` expande la card y revela el formulario de edición existente.
- Solo una card puede estar expandida a la vez (`scExpandedStepId`).

### 2. Cards colapsadas/expandibles

- Card colapsada: `.scStepMain` con `.scStepNumber`, `.scStepBody` (`.scStepPrimary`, `.scStepSecondary`, `.scStepDetail`) y `.scStepActions`.
- Card expandida: añade `.scStepForm` con campos de tiempo relativo, acción, target y acciones de reorder/eliminar/cerrar.
- Los estilos están en `css/styles.css` bajo la sección `/* Storyboard Scenarios */`.

### 3. Lenguaje humano

Helper puro `describeScenarioStep(step)` devuelve:

- `SET_STATE DOWN` → `"Kafka se cae"`
- `SET_STATE UP` → `"Kafka se recupera"`
- `SEND` → `"Producer → Kafka envía"` (con secondary opcional del label del edge)
- Target missing → `"⚠ Elemento eliminado"` / `"⚠ Conexión eliminada"`

Nodo sin label usa fallback `"Nodo #<id>"`. Si el usuario renombra `Kafka` → `Broker`, el storyboard se actualiza automáticamente porque las frases se derivan en runtime.

### 4. Tiempo relativo

- Helper puro `formatRelativeDelay(ms)`:
  - `0` → `"al mismo tiempo"`
  - `250` → `"250 ms después"`
  - `1000` → `"1 s después"`
  - `1500` → `"1.5 s después"`
  - `5000` → `"5 s después"`
- La UI muestra el delay respecto al Step anterior; el primer Step solo muestra `"Después de X"` si `at > 0`.
- Timestamps iguales muestran `"al mismo tiempo"` y preservan el orden del array.

### 5. Política de edición del tiempo

Al editar el delay de un Step en índice `i`:

```
newAt = prevAt + delayMs
delta = newAt - steps[i].at
for j >= i: steps[j].at += delta
```

Esto desplaza el Step editado y todos los posteriores, manteniendo las distancias relativas entre los momentos siguientes. Documentado y testeado en `test/scenario-ui-dom.test.cjs`.

### 6. Canvas-first authoring

- Cuando la pestaña Scenarios está activa y hay una selección simple:
  - Nodo seleccionado → acciones `Se cae` / `Se recupera` en el panel de propiedades (`#scCanvasActions`).
  - Edge seleccionado → acción `Enviar`.
- Al pulsar, se crea un Step con el target del canvas y timestamp por defecto:
  - Scenario vacío → `at = 0`
  - Con Steps → `at = lastStep.at + DEFAULT_STEP_DELAY` (1000 ms)
- Las acciones son explícitas: no hay auto-state inteligente.

### 7. Playback en la misma lista

- `scRuntimeStateForStep(step)` deriva el estado visual del Step consumiendo `scPlayback.logEvents`:
  - `pending` → `○`
  - `active` → `▶`
  - `completed` (SET_STATE) → `✓`
  - `success` (SEND) → `✓`
  - `failed` (SEND) → `✕` + `"Destino no disponible"` / `"Origen no disponible"`
- `scRenderStoryboard()` se llama en cada frame del playback (`scTick`), transformando la lista plana en progreso.
- El canvas se sincroniza a través del `buildScenarioRenderState()` existente (overlays de nodo/edge).

### 8. Trace técnico secundario

- El Trace se movió a una sección colapsable (`#scToggleTrace` / `#scTraceWrap`).
- Por defecto está oculto; el usuario puede abrir "Detalles técnicos".
- No se eliminó del runtime ni del contrato.

### 9. Configuración/Initial State

- La sección "Estado inicial" se movió detrás de un botón colapsable `Configuración`.
- Solo se muestran los overrides; el default UP es implícito.

### 10. Header simplificado

- Selector de Scenario, input de nombre y botón `▶ Run` en una sola fila visual.
- `Reset` aparece solo durante playback.
- Botón principal cambia a `▶ Run again` tras completar.

## Archivos modificados

- `fluyo/index.html` — reestructuración del panel Scenarios (storyboard, config colapsable, Trace secundario, diálogo "Añadir momento", acciones canvas en panel de propiedades).
- `fluyo/js/editor-scenarios.js` — reescritura completa del render del storyboard, helpers semánticos, edición de delay, canvas-first authoring, integración de playback en la lista.
- `fluyo/js/ui.js` — `refreshPanel()` y `switchPanelTab()` ahora llaman a `scRenderCanvasActions()` para mantener las acciones canvas sincronizadas.
- `fluyo/css/styles.css` — estilos del storyboard, cards colapsadas/expandibles, estados de playback, diálogo semántico y acciones canvas.
- `fluyo/test/scenario-ui-dom.test.cjs` — tests de storyboard, lenguaje humano, tiempo relativo, edición de delay, playback visual, canvas authoring.
- `fluyo/sw.js` — cache bumped a `fluyo-static-v44`.
- `fluyo/.ai/tasks/FLUYO-009.md` — este handoff.

## Tests añadidos / actualizados

En `test/scenario-ui-dom.test.cjs`:

1. `describeScenarioStep` para SET_STATE DOWN, SET_STATE UP, SEND, missing node, missing edge.
2. Rename node actualiza la frase derivada.
3. Nodo sin nombre usa fallback estable.
4. `formatRelativeDelay` casos humanos.
5. Storyboard muestra delays relativos por defecto.
6. Mismo timestamp muestra `"al mismo tiempo"` y preserva orden.
7. Cards colapsadas por defecto; expandir muestra controles.
8. Editar delay desplaza Step y posteriores manteniendo distancias relativas.
9. Mapping SET_STATE/SEND persiste ids correctos.
10. Playback storyboard muestra estados `completed/failed/success` con detalles humanos.
11. Reset vuelve a pending/editable.
12. Trace técnico sigue disponible colapsado.
13. Canvas authoring nodo (`Se cae` / `Se recupera`) crea SET_STATE.
14. Canvas authoring edge (`Enviar`) crea SEND.
15. Canvas authoring timing usa `DEFAULT_STEP_DELAY` para segundo momento.

## Screenshots / Smokes

Browser smoke ejecutado en Chrome headless vía Chrome DevTools Protocol (CDP) con viewport 1366×768:

- Ruta: crear Producer → Kafka → abrir Scenarios → crear 4 momentos desde canvas (`Se cae`, `Enviar`, `Se recupera`, `Enviar`) → ajustar delays a 1 s / 4 s / 1 s → Run.
- Screenshot antes de Run: cards colapsadas leen `Kafka se cae`, `Producer → Kafka envía`, `Kafka se recupera`, `Producer → Kafka envía` con delays relativos.
- Screenshot durante playback: `✓ Kafka se cae`, `✕ Producer → Kafka envía  Destino no disponible`, `○ Kafka se recupera`, `○ Producer → Kafka envía`.
- Screenshot tras Run: `✓ Kafka se cae`, `✕ Producer → Kafka envía  Destino no disponible`, `✓ Kafka se recupera`, `✓ Producer → Kafka envía`.
- Archivos generados en `C:\\Users\\nectd\\AppData\\Local\\Temp\\opencode`:
  - `fluyo-storyboard-nodes.png`
  - `fluyo-storyboard-before-run.png`
  - `fluyo-storyboard-mid-playback.png`
  - `fluyo-storyboard-after-run.png`

## Criterio humano obligatorio

> ¿Puede una persona entender qué va a ocurrir en este Scenario mirando únicamente la lista colapsada?

**SÍ.** El storyboard colapsado del caso Caída de Kafka se lee como una historia completa sin abrir ninguna card.

## Pruebas ejecutadas

- `node --test test/scenarios.test.cjs` — PASS (28 tests).
- `node --test test/scenario-playback.test.cjs` — PASS (8 tests).
- `node --test test/scenario-ui.test.cjs` — PASS (17 tests).
- `node --test test/scenario-ui-dom.test.cjs` — PASS (31 tests).
- `node --test test/scenario-migration.test.cjs test/scenario-independent-qa.test.cjs test/scenario-post-qa.test.cjs test/share.test.cjs test/viewer.test.cjs` — PASS (99 tests).
- `node --test test/scenario-qa-overhead.cjs` — PASS.
- `node --check js/*.js`, `node --check test/*.cjs`, `node --check sw.js` — PASS.
- Browser smoke Chrome headless 1366×768 — PASS.

### Nota sobre tests fallidos

`test/scenario-qa-browser.cjs` requiere `playwright` (no instalado en el entorno); es un requisito de entorno, no de código.

`test/scenario-qa-mutations.cjs` falla en la mutación `"tie-break por step.id"` porque `scenario-independent-qa.test.cjs` no detecta esa mutación concreta. No se modificó `js/scenario-engine.js` en esta iteración; el fallo es preexistente y está fuera del scope de este storyboard UX.

## Riesgos

1. **Selección canvas ↔ storyboard**: el click en una card colapsada llama a `selectOnly()`, lo que puede cambiar la selección mientras el usuario solo quería expandir. El menú `⋯` evita ese conflicto, pero conviene observar en sesiones manuales.
2. **Scroll en Scenario largo**: el panel usa scroll vertical; en 8–10 momentos sigue siendo usable, pero más allá podría necesitar virtualización en iteraciones futuras.
3. **Edición de delay**: la política de desplazar posteriores es clara, pero puede sorprender si el usuario espera que solo cambie el Step editado. Se documentó en la UI vía label `después del anterior`.
4. **Copy de SEND**: la frase `"Producer → Kafka envía"` es gramaticalmente algo forzada en español; alternativas como `"Producer envía a Kafka"` requieren un helper ligeramente más sofisticado. Se dejó extensible mediante `describeScenarioStep()`.

## Próximo paso concreto

Validar la experiencia en una sesión manual real (ratón/táctil) y decidir si se ajusta el copy de SEND o se añaden presets de tiempo más visibles. No continuar con FLUYO-010 hasta que el criterio humano esté confirmado en uso real.
