# FLUYO-008 — Scenario Engine Core

Estado: DONE — re-QA final aprobada; informe independiente original preservado
Owner/agente actual: Codex

> Esta tarea implementa el núcleo de datos y el motor determinista de Scenarios. No incluye UI de autoría, panel, playback visual, overlays, animaciones ni integración con Present. Todo el trabajo debe poder probarse desde Node sin DOM.
>
> **Repo público**: este archivo puede terminar publicado en GitHub. Escribe solo contenido apto para público.

## Objetivo

Implementar la frontera:

```text
Structure
    +
Behavior
    +
Scenario
    ↓
Validation
    ↓
Deterministic Engine
    ↓
Trace
```

El motor debe ser puro, determinista, testeable con Node, independiente del DOM, Canvas, timers reales, analytics y localStorage.

## Por qué

FLUYO-007 cerró la arquitectura conceptual de Scenarios. Este incremento materializa el contrato técnico (D-011–D-013) con un motor ejecutable, migración de formato v4 y garantías de identidad, de modo que el incremento de UI/playback (FLUYO-009) pueda construir sobre una base probada.

## Alcance

### Incluye

- Ajustes de arquitectura obligatorios en FLUYO-007/documentación:
  - `engineVersion` persistido en cada Scenario.
  - Orden semántico de `steps`: orden persistido del array como tie-break bajo mismo `at`.
  - Scope por página explícito para Behavior y Scenarios.
- Schema v4 del documento (`version: 4`) con migración v3→v4.
- Compatibilidad histórica: apertura de documentos v0/v1/v2/v3/v4 por la misma frontera compartida.
- IDs estructurales: nodeId/edgeId, nunca labels; IDs eliminados no se reutilizan.
- IDs propios de Scenario y Step con contadores monotónicos por página.
- Behavior v1: disponibilidad inicial UP/DOWN, canonicalizado a un registro por `nodeId`.
- Scenario v1: `id`, `engineVersion`, `name`, `nextStepId`, `steps`.
- Acciones v1: `SET_STATE` y `SEND`.
- Motor puro `scenario-engine.js`: validación completa antes de ejecución, cola virtual, determinismo, guards y Trace.
- Tests Node: determinismo, orden, matriz SEND, SET_STATE repetido, validación, no mutation, migración, identidad y compatibilidad viewer.

### No incluye

- UI de autoría de Scenarios (pestaña, panel, formularios).
- Playback visual, overlays, animaciones de partículas ni estado visual UP/DOWN.
- Integración con Present.
- Retry, latency, timeout, DLQ, circuit breaker, colas reales, scripting, conditions, branching, randomness o perfiles específicos.
- Analytics de Scenarios.
- Commit, push ni despliegue.

## Contexto necesario

Leer antes de empezar:
- `AGENTS.md`
- `.ai/PRODUCT.md`
- `.ai/ARCHITECTURE.md`
- `.ai/DECISIONS.md`
- `.ai/tasks/FLUYO-007.md`
- Este archivo.

No es necesario leer:
- Código de UI/playback/editor runtime (salvo para regresiones puntuales).
- Repositorio hermano `fluyo-mcp`.

## Criterios de aceptación

- [x] `engineVersion: 1` se persiste en cada Scenario; Trace incluye `engineVersion`.
- [x] El orden del array `steps` es parte de la semántica bajo mismo `at`.
- [x] Behavior y Scenarios viven en cada página; no hay cross-page.
- [x] `serializeProject()` emite v4; `projectFromProjectData()` migra v0/v1/v2/v3 a v4 y rechaza v5+.
- [x] Viewer/deep link/Share conservan campos v4 sin ejecutar engine.
- [x] IDs eliminados de node/edge/scenario/step no se reutilizan; reservas missing y agotamiento cubiertos.
- [x] Engine puro expone API pública con errors[] y pasa todos los tests de contrato, incluido QA independiente.
- [x] No muta Structure, Behavior ni Scenario de entrada.
- [x] No usa DOM, Canvas, Date.now, performance.now, Math.random, timers ni storage.
- [x] Regresiones de suites existentes resueltas.

## Plan

- [x] Crear/actualizar tarea y documentación de arquitectura.
- [x] Implementar schema v4 y migración en `js/model.js`.
- [x] Corregir reutilización de IDs en undo/redo y demo reset.
- [x] Implementar `js/scenario-engine.js` puro.
- [x] Añadir tests del engine y de fronteras.
- [x] Actualizar tests existentes que esperaban v4 unsupported.
- [x] Ejecutar regresiones y `git diff --check`.
- [x] Actualizar `ARCHITECTURE.md`/`DECISIONS.md` según estado implementado.

## Decisiones tomadas

- [D-011](../DECISIONS.md#d-011--scenarios-motor-puro-con-tiempo-virtual-determinista): se implementa motor puro con tiempo virtual determinista.
- [D-012](../DECISIONS.md#d-012--scenarios-definiciones-persistidas-trace-derivado-y-playback-separado): Trace derivado, no persistido.
- [D-013](../DECISIONS.md#d-013--scenarios-por-pagina-y-evolucion-del-formato-a-v4): v4 implementado con `behaviors`/`scenarios`/`nextScenarioId` por página.
- Decisiones específicas del incremento:
  - `engineVersion: 1` en cada Scenario para reproducibilidad semántica.
  - Orden de array como tie-break; no `sequence` persistido.
  - IDs monotónicos de Scenario/Step separados de `nextId` de entidades.
  - Validación completa antes de ejecutar; sin Trace parcial ante error.
  - Guards iniciales: `MAX_SCENARIO_STEPS=1000`, `MAX_RUNTIME_JOBS=2000`, `MAX_TRACE_EVENTS=2000`, `MAX_VIRTUAL_TIME_MS=86400000`, `MAX_STRUCTURE_ENTITIES=10000`.

## Archivos modificados

- `.ai/tasks/FLUYO-007.md` — precisión de las tres decisiones arquitectónicas (engineVersion persistido, orden de array como tie-break, scope por página).
- `.ai/tasks/FLUYO-008.md` — esta tarea.
- `.ai/ARCHITECTURE.md` — estado implementado de Scenarios/v4 y sección de testing.
- `.ai/DECISIONS.md` — D-011/D-012/D-013 actualizados al estado implementado.
- `js/model.js` — schema v4, migración v3→v4, defaults `behaviors`/`scenarios`/`nextScenarioId`, normalización de Behavior/Scenario/IDs, contadores elevados.
- `js/selection.js` — `snapPage()` captura página completa; `applySnap()` conserva marcas altas de IDs para nodos, edges, scenarios y steps.
- `js/export.js` — `btnDemo` ya no reinicia `nextId` (IDs eliminados no se reutilizan).
- `js/share-url.js` — Share transporta v4 en lugar de forzar v3.
- `js/viewer.js` — estado vacío del viewer incluye campos v4.
- `js/scenario-engine.js` — motor puro determinista (nuevo).
- `test/scenarios.test.cjs` — tests del engine: canónico, determinismo, orden, SEND matrix, SET_STATE, validación, guards, pureza (nuevo).
- `test/scenario-migration.test.cjs` — tests de migración v4, IDs/undo, canonicalización Behavior, viewer v4 (nuevo).
- `test/viewer.test.cjs` — espera v4 en Share/deep link; v5 como unsupported.
- `test/share-final-qa.test.cjs` — ancla Q4 actualizada al nuevo estado vacío del viewer.

## Pruebas de implementación (registro anterior al QA)

- `node --test test/scenarios.test.cjs` — 26/26 PASS.
- `node --test test/scenario-migration.test.cjs` — 13/13 PASS.
- `node --test test/share.test.cjs test/viewer.test.cjs` — 37/37 PASS.
- `node --test test/analytics.test.cjs` — 13/13 PASS.
- `node --test test/qa-share.test.cjs test/share-final-qa.test.cjs test/share-post-qa.test.cjs test/share-realistic-size.test.cjs` — 34/34 PASS.
- `node test/render-boundary.cjs` — PASS.
- `node test/render-boundary-run.cjs` — PASS.
- `node test/editor-runtime.cjs` — PASS.
- Total ejecutado: 123 tests PASS.
- `git diff --check` — sin errores de espacios (solo advertencias LF/CRLF preexistentes).

## Pendientes / riesgos

- La UI de autoría y playback visual quedan para FLUYO-009.
- Los guards son operativos; pueden ajustarse tras medición en navegador.
- El renderer actual no interpreta estados UP/DOWN ni Trace; eso es parte del siguiente incremento.
- Los cambios de assets existentes requieren bump de caché. Se preservó el avance v39→v40 y se elevó a v41 por la corrección de model/state/selection. Chrome verificó v39→v40→v41, retirada de cachés anteriores y model/Share v4. Engine fuera de frontend/precache.

## Handoff

### Estado actual

DONE tras corrección post-QA. Los resultados actuales están en «Resolución QA»;
los handoffs anteriores se mantienen como registro histórico. No hay UI de
Scenarios ni playback visual.

### Próximo paso concreto

Revisar el diff y la resolución de los nueve hallazgos con el informe original;
los gates reproducibles están verdes. No continuar con FLUYO-009 durante este trabajo.

## Handoff de QA independiente

Registro histórico previo a las correcciones; la resolución posterior no altera
el informe `.ai/tasks/FLUYO-008-QA.md` ni las aserciones de su suite independiente.

Veredicto: **CHANGES REQUIRED**. Informe completo y reproducciones en
[FLUYO-008-QA.md](FLUYO-008-QA.md). La descripción DONE anterior corresponde al
handoff de implementación y queda supersedida por este resultado de QA.

- Se ejecutaron las 123 pruebas Node existentes: 123 PASS; además, los tres gates de renderer/runtime pasan.
- Suite independiente `test/scenario-independent-qa.test.cjs`: 28 casos, 11 PASS y 17 FAIL esperados contra el contrato, agrupados en nueve defectos. Los fallos no se marcaron como TODO ni se relajaron.
- Diez controles independientes pasan: modelo de referencia con 200 casos congelados/intercalados, límites inclusivos, migración/roundtrip, identidad básica, borrado/restauración y Share→viewer. También pasa QA-04 (undo/redo de Steps); no se reporta como defecto.
- Chrome real: HTTP, archivo histórico→v4, guardar/reabrir, Share→viewer→Open in Fluyo→editar/guardar, `#d=` directo, `file://` y upgrade SW v39→v40 PASS; cero `pageerror`.
- Siete mutaciones detectadas en copias temporales; originales intactos.
- Overhead v4 vacío: +49 bytes JSON por página; +28–31 caracteres de payload comprimido en tres muestras.
- Archivos propios de QA: este handoff, `.ai/tasks/FLUYO-008-QA.md`, `test/scenario-independent-qa.test.cjs`, `test/scenario-qa-browser.cjs`, `test/scenario-qa-mutations.cjs`, `test/scenario-qa-overhead.cjs`.
- Correcciones realizadas: estado/handoff y afirmación sobre SW. No se modificó código productivo, no se añadieron dependencias al producto, UI, commit ni push.
- Riesgos: retargeting de referencias missing; Trace sobre grafos inválidos; guards que impiden recuperar/compartir documentos; validación/counters incompletos; duplicación sin Behavior. Detalle y prioridades en el informe.
- Próximo paso: corregir primero QA-03, QA-01 y QA-07; completar los P2; ejecutar suite independiente hasta 28/28, regresiones y smoke. Mantener FLUYO-008 abierta.

## Resolución QA — corrección post-QA

Los nueve defectos del informe original están corregidos. No se creó otra tarea,
no se modificó el informe QA ni se relajaron sus 28 casos. Las pruebas originales
del engine se adaptaron de `error.code` a `errors[0].code`, manteniendo los códigos
esperados y añadiendo aserciones del array. No se añadió alias `error`.

### Causa, corrección, prueba e impacto por hallazgo

| Hallazgo del informe | Causa raíz | Corrección | Prueba | Compatibilidad |
|---|---|---|---|---|
| QA-03: retargeting missing | nextId sólo contaba entidades vivas | `structuralNextId()` incluye entidades, endpoints, Behavior y targets SET_STATE/SEND; normalización y asignación usan la marca reservada | QA-03 (cinco casos); post-QA missing 17, creación nueva y undo histórico | No renumera entidades ni referencias; sólo eleva counters |
| QA-01: dangling no utilizado | existencia de endpoints se consultaba dentro de SEND | Prevalidación de todas las aristas, incluso con Scenario vacío | QA-01; post-QA dangling sin pasos | Import conserva Structure reparable; sólo Run se bloquea |
| QA-07: guards impiden abrir/Share | límites operativos duplicados en model | Se retiran cotas de steps/tiempo del loader; quedan en runner | QA-07 (tres casos); post-QA y Chrome Save→Share→viewer→Open con 1001 steps | Documento íntegro, sin truncar; límites propios del transporte siguen vigentes |
| QA-02: IDs node/edge ambiguos | Sets de unicidad separados | Set conjunto del namespace de entidades | QA-02; node/node, edge/edge y node/edge post-QA | Canonical loader sigue rechazando duplicados; runner ahora coincide |
| QA-05: nextStepId ignorado por Run | validación omitida | Runner exige contador positivo seguro superior al máximo step persistido | QA-05; malformed counters post-QA | Un input directo inválido no ejecuta; loader puede elevar marcas bajas antes de Run |
| QA-06: error singular/fail-fast | helper err y retornos tempranos | errors[] uniforme y acumulación por fases estables; no referencias de registros malformados | QA-06; errores idénticos en 100 runs; shape/null; guards internos | Cambia API de error del nuevo engine conforme al contrato acordado; no hay consumidor UI previo |
| QA-08: contador ausente | validación antes de derivar mínimo | `projectCounter()` deriva ausentes y eleva bajos, conserva altos | QA-08; nextStepId ausente/bajo/alto post-QA | Ampliación compatible de entrada; campos presentes malformados no se silencian |
| QA-09: overflow | suma/postincremento sin comprobación | Contador mínimo seguro, máximo como marca agotada, reserva previa en factories/helpers/paste | QA-09; último ID asignable, paste atómico y helpers agotados | Entradas imposibles fallan con invalid_document; creación agotada con id_exhausted sin mutación parcial |
| QA-10: duplicar pierde Behavior | clip transportaba sólo Structure | Clip incluye overrides de nodos copiados; remapeo con IDs nuevos, sin copiar Scenarios | QA-10; duplicación múltiple, default UP implícito y Ctrl+D/undo/redo real | Clipboard anterior sin behaviors sigue funcionando; campos Scenario originales no cambian |

### Contrato canónico frente a Run

Share de la tabla supone que el proyecto cabe en el límite del códec/URL. Un
exceso de transporte no se transforma en error del Scenario.

| Caso | Abrir/Guardar | Share/viewer/Open in Fluyo | Run v1 |
|---|---|---|---|
| Scenario v1 bien formado y dentro de guards | Sí | Sí | Sí si Structure/Behavior válidos |
| Referencia node/edge missing o endpoint dangling | Sí; se conserva para reparar | Sí | No, errors[] de referencias |
| 1001 steps bien formados | Sí, íntegros | Sí | No, guard_exceeded |
| Timestamp entero seguro >86400000 | Sí | Sí | No, invalid_timestamp con limit (código existente) |
| engineVersion futura positiva y layout v4 interpretable | Sí, sin reinterpretar | Sí | No, unsupported_engine_version |
| Acción/estado desconocidos, claves indebidas o tipo malformado | No | No | No |
| IDs estructurales/Scenario/Step duplicados | No | No | No para el input individual que recibe Run |
| Contador ausente o bajo, con mínimo representable | Sí, se deriva/eleva | Sí | Input directo no canónico se bloquea; normalizado sí puede ejecutar |
| Contador presente malformado o mínimo que exige overflow | No | No | No |

Una engineVersion futura no equivale a formato futuro arbitrario: hoy se
preserva si puede interpretarse estructuralmente con las acciones/enums/claves
v4. Unknown actions continúan rechazadas sin descartar datos ni instalar una
entrada fallida. Un schema futuro incompatible queda sujeto a migración futura.
`createStep()`/`deleteStep()` bloquean autoría semántica sobre versiones futuras.

Behavior duplicado mantiene la canonicalización explícita preexistente: último
registro válido por nodeId gana al importar; el runner exige una tabla sin
duplicados. No depende del orden incidental de Maps ni del motor.

### Helpers y contadores

Modelo: `createScenario(pg,name)`, `deleteScenario(pg,id)`,
`createStep(sc,definition)`, `deleteStep(sc,id)`. Sin UI, autosave ni undo propio;
la disciplina del editor puede envolverlos con `pushUndo()`. Borrar no baja
marcas; Scenario 1→borrar→crear da 2 y Step 4→borrar→crear da 5. `definition`
recibe datos de la acción sin `id`; la identidad la asigna el modelo.

`Number.MAX_SAFE_INTEGER` queda reservado como contador agotado. Los IDs que
exigirían max+1 se rechazan; no se crea ese último ID ni se degrada precisión.
Paste reserva todo el lote antes de mutar Structure/selección. Las fábricas
asignan su identidad final aunque extras/opts incluyan un id distinto.

### Archivos de esta corrección

- `js/model.js`: validez canónica, reserva missing, contadores y helpers mínimos.
- `js/state.js`: asignación segura en factories de node/edge.
- `js/selection.js`: clipboard/duplicación Behavior y reserva atómica del lote.
- `js/scenario-engine.js`: validación por fases, errors[], grafo íntegro y cursor
  de queue, manteniendo SET_STATE/SEND/Trace y todas las cotas v1.
- `sw.js`: v40→v41, estrategia/precache existentes; engine aún no servido al shell.
- `test/scenarios.test.cjs`: assertions de errors[] sin perder códigos/casos.
- `test/scenario-post-qa.test.cjs`: 19 casos adicionales, incluidas defensas
  internas jobs/eventos con cotas reducidas sólo en una copia del source en VM.
- `test/scenario-qa-browser.cjs`: amplía los gates QA con Ctrl+D, 1001 steps,
  future engineVersion, espera de instalación/activación real y v39→v40→vigente.
- `test/share-browser.cjs`, `test/share-post-qa-browser.cjs`: verifican la CACHE
  vigente leyendo sw.js; conservan pruebas offline, retirada de caches y privacidad.
- `.ai/ARCHITECTURE.md`, `.ai/DECISIONS.md` y esta tarea: distinciones durables y handoff.

### Validación final

- `node --test test/*.test.cjs`: **170/170 PASS** (123 previos + 28 QA + 19 post-QA),
  cero skips/TODO. Suite QA independiente preservada íntegramente.
- `node test/scenario-qa-mutations.cjs`: **7/7 detectadas** en copias temporales.
- `node test/scenario-qa-overhead.cjs`: PASS; overhead sin cambios (+49 bytes
  JSON por página, +28–31 caracteres comprimidos en las muestras).
- `node test/render-boundary.cjs`, `node test/render-boundary-run.cjs`,
  `node test/editor-runtime.cjs`: PASS.
- `node test/scenario-qa-browser.cjs`: PASS histórico/v4/guardar/reabrir,
  Share/viewer/Open/edit, #d= directo, Ctrl+D/undo/redo con Behavior,
  1001 steps/missing/engineVersion 2 y `file://`; SW v39→v40→v41.
- `node test/share-browser.cjs <script Umami capturado>`: PASS, incluyendo
  documento-entrante 38/38 y editor-inline 51/51, viewer offline v41 y privacidad.
- `node test/share-post-qa-browser.cjs <script Umami capturado>`: PASS SVG,
  hashchange/ERROR cleanup, upgrades v37→v38→v41 y privacidad por activación.
- Chrome utilizó Playwright disponible en el entorno, sin dependencia añadida
  al producto. Script actual de Umami capturado en temporal; todas sus peticiones
  de analytics interceptadas/respondidas localmente, sin enviar documentos.
- `git diff --check`: PASS (sólo advertencias LF/CRLF).

### Estado y próximo paso

DONE para la corrección de FLUYO-008. El informe QA original sigue disponible
como evidencia histórica; sus reproducciones ahora pasan. No se desplegó ni se
validó el hosting productivo. No hay cambios de UI/playback, tarea nueva, commit
ni push. Revisar el diff final contra este handoff; no continuar con FLUYO-009
como parte de esta solicitud.

## Re-QA final — 2026-09-29

Veredicto: **APPROVED**. Revalidación focalizada de las nueve correcciones,
sin repetir la auditoría completa ni modificar producción. La tabla «Contrato
canónico frente a Run» coincide con el loader, el runner y las pruebas. El
informe original FLUYO-008-QA y sus 28 tests permanecen intactos como historial.

### Resultado de las correcciones

- Missing: Behavior, SET_STATE, SEND y endpoints reservan IDs en carga y
  asignación. Borrar target 17, crear otra entidad y ejecutar sigue fallando;
  undo del target histórico restaura la identidad y permite Run.
- Duplicación: overrides DOWN/UP explícitos se remapean para múltiples nodos;
  UP implícito no agrega registros. Scenarios y targets de SEND originales
  permanecen intactos; Ctrl+D/undo/redo también pasa en Chrome.
- Persistencia: 1001 steps, timestamps seguros sobre 24 horas, referencias
  missing y engineVersion 2 con layout v4 compatible sobreviven archivo,
  roundtrip, Share, viewer y copia editable. Sin truncado ni fallback v1.
- Ejecución: todas las aristas se validan, incluidas las ajenas al Scenario.
  Nodes/edges usan unicidad conjunta. Errors[] acumula errores deterministas
  por fases y nunca devuelve Trace en fallo. No hay error singular alternativo.
- Contadores: ausentes se derivan, bajos se elevan, altos se conservan; valores
  malformados y mínimos imposibles se rechazan. Factories/helpers/paste detectan
  agotamiento antes de mutar. Se revalidó nextStepId ausente/bajo/alto y undo.
- Guards: únicamente Run. 1000 steps, 2000 eventos, 86400000 ms y 10000 nodes
  o edges son inclusivos. Se añadieron dos casos que prueban 10001 nodes/edges
  persistibles íntegros pero bloqueados al ejecutar. Jobs/eventos internos
  también se prueban con cotas reducidas en VM; 2001 jobs no es alcanzable por
  inputs v1 válidos bajo el límite de 1000 steps.
- Motor: matriz SEND, prioridad source_down, SET_STATE no-op, ambos órdenes
  bajo el mismo timestamp, 200 casos de oracle congelados/intercalados, pureza,
  Trace mínimo y ausencia de propagación siguen pasando.

### Evidencia ejecutada

- `node --test --test-reporter=spec test/*.test.cjs`: **172/172 PASS**, cero
  fallos/skips/TODO; 170 previos conservados + 2 casos estructurales nuevos.
- `node test/scenario-qa-mutations.cjs`: **14/14 detectadas**. Se conservan los
  siete controles anteriores y se añaden las siete regresiones solicitadas:
  reutilizar missing ID, perder Behavior al duplicar, guard en loader, aceptar
  dangling ajena, aceptar ID estructural duplicado, bajar nextStepId alto y
  devolver `{error}`. Cada copia debe fallar la prueba elegida; errores de
  carga/sintaxis no cuentan como detección. Temporales limpiados, fuentes intactas.
- `node test/scenario-qa-overhead.cjs`: PASS, +49 bytes JSON por página y
  +28–31 caracteres comprimidos en las tres muestras.
- `node test/render-boundary.cjs`, `node test/render-boundary-run.cjs` y
  `node test/editor-runtime.cjs`: PASS.
- Chrome local: `scenario-qa-browser.cjs`, `share-browser.cjs`,
  `share-post-qa-browser.cjs` y `share-realistic-size-browser.cjs`: PASS.
  Histórico→save v4→reopen, Share→viewer→Open, #d= directo, duplicación,
  undo/redo y file://. Documento-entrante 38/38 y editor-inline 51/51.
- SVG real y export PNG/SVG, strict codec, límite URL inclusivo, hashchange,
  ERROR cleanup y privacidad siguen verdes. Script Umami capturado reutilizado;
  tráfico del proveedor interceptado localmente, sin enviar documentos.
- SW: CACHE v41; upgrades v39→v40→v41 y v37→v38→v41 eliminan caches previas.
  Assets de modelo/Share v4 comprobados en caché; engine fuera de shell/viewer
  y precache. Referencias v39/v40 restantes son fixtures históricas.
- `git diff --check`: PASS; advertencias LF/CRLF sin errores de espacios.

### Cambios propios y handoff

Sólo `test/scenario-qa-mutations.cjs` (siete mutaciones adicionales),
`test/scenario-post-qa.test.cjs` (dos casos), `test/share-post-qa-browser.cjs`
(comentario obsoleto de versión) y esta tarea. Ninguna corrección productiva fue
necesaria; no se añadió dependencia, UI/playback, tarea, commit ni push.

Riesgos/alcance restantes: no se validó hosting desplegado; el transporte sigue
sujeto a URL/2 MiB independientemente de la validez canónica; engineVersion
futura preservable requiere layout v4 compatible, no acciones nuevas arbitrarias.
Recomendación: mantener FLUYO-008 DONE. Próximo paso concreto: revisión humana
del diff y de esta evidencia; no continuar con FLUYO-009 en esta solicitud.
