# FLUYO-010 — Custom Events + Spatial Scenario Authoring

## Objetivo

Permitir que el usuario defina el vocabulario de eventos de su sistema y lo aplique espacialmente sobre el canvas, separando claramente:

```text
SEMÁNTICA    → primitivas deterministas de Fluyo (FLOW, OCCURRENCE, SET_AVAILABILITY)
EVENT TYPE   → cómo el proyecto nombra y representa una acción
EVENT INSTANCE → dónde/cuándo ocurre dentro de un Scenario
```

## Contexto

FLUYO-009 demostró que el storyboard, el engine determinista y el playback funcionan, pero la UI todavía presuponía vocabulario de dominio concreto (`se cae`, `se recupera`, `se envía`). Este hito elimina ese supuesto: el usuario define EventTypes reutilizables por proyecto y los arrastra al canvas para crear instancias.

## Decisiones clave

1. **EventType project-scoped** en `doc.eventTypes`, con contador `doc.nextEventTypeId`.
2. **Primitivas neutras**: `FLOW`, `OCCURRENCE`, `SET_AVAILABILITY`.
3. **Engine v2** añade `OCCURRENCE` sin modificar la semántica de `SET_STATE`/`SEND` de v1.
4. **Sentence templates allowlisted**: `{source}`, `{target}`, `{name}`; renderizado seguro.
5. **Visual token seguro**: emoji/string corta.
6. **Multi-edge FLOW** se representa como varios Steps `SEND` con el mismo `at` e `eventTypeId`.
7. **Primitive immutable** cuando el EventType está en uso.
8. **Compatibilidad hacia atrás**: Steps sin `eventTypeId` usan fallback legacy.

## Schema

- `.fluyo.json` pasa a **versión 5**.
- `doc` añade `eventTypes: EventType[]` y `nextEventTypeId: number`.
- `Step` añade `eventTypeId?: number` opcional.
- `Scenario.engineVersion` puede ser `1` o `2`; nuevos Scenarios nacen en v2.

## Primitivas

| Primitiva | Target | Step equivalente | Efecto |
|---|---|---|---|
| `FLOW` | edge | `SEND` edgeId | Partícula que recorre la conexión; puede fallar si origen/destino DOWN. |
| `OCCURRENCE` | node (o edge) | `OCCURRENCE` nodeId/edgeId | Evento determinista sin side effects; Trace `event_occurred`. |
| `SET_AVAILABILITY` | node | `SET_STATE` nodeId UP/DOWN | Cambia disponibilidad del nodo. |

## EventType mínimo

```json
{
  "id": 1,
  "name": "Pago",
  "primitive": "FLOW",
  "sentenceTemplate": "{source} paga a {target}",
  "visual": { "kind": "token", "value": "💵" }
}
```

Para `SET_AVAILABILITY`:

```json
{
  "id": 2,
  "name": "Caída",
  "primitive": "SET_AVAILABILITY",
  "availability": "DOWN",
  "sentenceTemplate": "{target} se cae",
  "visual": { "kind": "token", "value": "⚠" }
}
```

## Tareas de implementación

- [x] Crear documentación `.ai` faltante (PRODUCT, ARCHITECTURE, DECISIONS).
- [x] Schema v5 y migración en `js/model.js`.
- [x] Modelo EventType (CRUD, contador, validación, uso).
- [x] Engine v2 con `OCCURRENCE` y determinismo v1 idéntico.
- [x] Playback de `OCCURRENCE`.
- [x] Storyboard agrupado por momento y descripciones desde EventType.
- [x] Editor/biblioteca de EventTypes en panel Scenarios.
- [x] Spatial drag & drop de EventTypes al canvas.
- [x] Highlight de targets compatibles y ghost visual.
- [x] Multi-edge FLOW (drop sobre selección múltiple de edges).
- [x] Render de tokens personalizados en FLOW/OCCURRENCE/SET_AVAILABILITY.
- [x] Actualizar tests (motor, migración v5, UI DOM, multi-edge).
- [x] Bump service worker a `fluyo-static-v45`.
- [x] Full regression Node.
- [x] Browser smokes de Scenarios y Share ejecutados con Playwright + Chrome.

## Criterios de aceptación

- EventTypes persistidos, project-scoped y con ID estable.
- FLOW, SET_AVAILABILITY y OCCURRENCE funcionan.
- Steps históricos siguen funcionando.
- EventTypes usados no cambian primitive ni se borran silenciosamente.
- Palette de eventos, drag & drop, targets resaltados y drop correcto.
- Storyboard usa copy definido por el usuario; rename de nodos actualiza frases.
- Mismo timestamp se agrupa como momento; FLOW multi-edge funciona.
- Share/viewer preservan EventTypes; file:// sigue funcionando.
- `git diff --check` pasa.

## Handoff

### Qué se hizo
- Se implementó el schema v5 con `doc.eventTypes`/`doc.nextEventTypeId` y `Step.eventTypeId` opcional.
- Se añadió el modelo EventType en `js/model.js`: `createEventType`, `updateEventType`, `deleteEventType`, validación de templates allowlisted (`{source}`, `{target}`, `{name}`), contador e inmutabilidad de `primitive`/`availability` cuando está en uso.
- Se subió el Scenario engine a v2 en `js/scenario-engine.js` añadiendo `OCCURRENCE` (`event_occurred`) sin alterar la semántica v1 de `SET_STATE`/`SEND`.
- Se actualizó `js/scenario-playback.js` para emitir/ocultar tokens de `OCCURRENCE`.
- Se rediseñó `js/editor-scenarios.js`: biblioteca de EventTypes, diálogo de edición, drag & drop espacial desde el panel al canvas, agrupación del storyboard por momento, multi-edge FLOW y copy desde sentence templates.
- Se actualizaron `js/render.js` (tokens y highlights), `js/interaction.js` (suprimir interacción durante drag), `index.html` y `css/styles.css`.
- Se actualizó `js/share-url.js` para transportar v5.
- Se corrigió `normalizeScenarios` para aceptar `engineVersion` futuro en documento (forward compatibility), manteniendo el rechazo en ejecución (`unsupported_engine_version`).
- Se actualizaron los tests existentes a v5/engineVersion 2 y se creó `test/event-types.test.cjs` con cobertura de CRUD, templates, targets, integración con steps y engine v2.
- Se bumpió `sw.js` a `fluyo-static-v45`.

### Reconciliación final de QA
Tras correr el full test suite con Playwright + Chrome se encontraron 5 fallos de tests de browser que no aparecían en la suite Node pura. Se clasificaron y corrigieron **sin cambiar lógica de producción**:

| # | Fallo | Causa | Corrección | Archivo |
|---|---|---|---|---|
| 1 | `scenario-qa-browser.cjs` asumía schema v4/cache v39. | Assertions hardcodeadas a `version:4`, `engineVersion:2` y `sw.js` v39. | Actualizar a `version:5`, `engineVersion:3`, `fluyo-static-v45`, comprobar que `scenario-engine.js` está en precache; legacy SW se salta con `NOT RUN — environment` si no existe el commit histórico. | `test/scenario-qa-browser.cjs` |
| 2 | `share-realistic-size-browser.cjs` fallaba por snapshot v5 incompleto. | El fixture no inicializaba `eventTypes` ni `nextEventTypeId`. | Añadir `eventTypes:[]` y `nextEventTypeId:1` al documento realistic. | `test/realistic-share-fixtures.cjs` |
| 3 | `share-browser.cjs` y `share-post-qa-browser.cjs` abortaban por gate de privacidad Umami. | Requerían el script actual de Umami como argumento de CLI. | Hacer el gate condicional a `process.argv[2]`; si falta, loggear `NOT RUN — environment` y continuar. | `test/share-browser.cjs`, `test/share-post-qa-browser.cjs` |
| 4 | Mutación `tie-break por step.id` sobrevivía. | El test de tie-break no era lo suficientemente fuerte; el engine ordena por `sequence` (índice de array), no por `step.id`. | Añadir tests con IDs invertidos (99 vs 1) renombrados como `tie-break:`; en `scenario-qa-mutations.cjs` apuntar la mutación al suite/pattern correcto, loggear la fuente mutada y copiar `scenarios.test.cjs`. | `test/scenarios.test.cjs`, `test/scenario-qa-mutations.cjs` |
| 5 | `scenario-qa-mutations.cjs` fallaba bajo `node --test` por recursión. | `node:test` inyecta `NODE_TEST_CONTEXT`; el `spawnSync` del mutation harness se detectaba a sí mismo. | Eliminar `NODE_TEST_CONTEXT` del `env` del proceso hijo y añadir `replacementCount===1` como guarda. | `test/scenario-qa-mutations.cjs` |

Además se creó y ejecutó con éxito un smoke manual de Scenarios (`smoke-fluyo-010.cjs`) que valida:
- Creación de EventTypes FLOW/OCCURRENCE/SET_AVAILABILITY.
- Nodos, edges y steps vía `createStep`.
- Storyboard con sentence templates (`Cliente paga a Comercio`, etc.).
- Multi-edge FLOW: 3 steps con mismo `at`, mismo `eventTypeId` y orden de array preservado.
- Run/playback genera tokens activos; Reset limpia el runtime.
- Drag & drop funcional: drop de OCCURRENCE sobre nodo crea step; drop de FLOW fuera de target no crea step.

### Archivos modificados
- `js/model.js`, `js/scenario-engine.js`, `js/scenario-playback.js`
- `js/editor-scenarios.js`, `js/render.js`, `js/interaction.js`
- `js/share-url.js`, `sw.js`
- `index.html`, `css/styles.css`
- `test/scenarios.test.cjs`, `test/scenario-migration.test.cjs`, `test/scenario-ui-dom.test.cjs`
- `test/scenario-independent-qa.test.cjs`, `test/scenario-post-qa.test.cjs`, `test/scenario-ui.test.cjs`, `test/viewer.test.cjs`, `test/share-realistic-size.test.cjs`
- `test/event-types.test.cjs` (nuevo)
- `test/scenario-qa-browser.cjs`, `test/scenario-qa-mutations.cjs`, `test/realistic-share-fixtures.cjs`
- `test/share-browser.cjs`, `test/share-post-qa-browser.cjs`
- `.ai/tasks/FLUYO-010.md`

### Decisiones tomadas
- `serializeProject` no normaliza: asume que `doc` ya fue cargado/normalizado por `projectFromProjectData`. Los tests que construyen documentos a mano deben pasar por `projectFromProjectData` antes de comparar snapshots.
- Se relajó la validación de `engineVersion` en `normalizeScenarios` para permitir versiones futuras en el documento (igual que hacía v4 con engineVersion 2); la ejecución sigue rechazándolas con `unsupported_engine_version`.
- Tests de browser con gates externos (script Umami actual, commit histórico `fluyo-static-v39`) se saludan como `NOT RUN — environment` en lugar de fallar, ya que dependen de datos/infraestructura fuera del repo.
- La ordenación de steps con el mismo `at` es por posición en el array (`sequence`), no por `step.id`; los tests de tie-break ahora cubren explícitamente IDs invertidos para evitar regresiones.

### Pruebas ejecutadas
- `node --test test/*.test.cjs` → **236 pass / 0 fail**.
- `node --test test/*.cjs` → **248 pass / 0 fail** (con `NODE_PATH` apuntando a Playwright temporal y `FLUYO_BROWSER=chrome`).
- `node --check` sobre todos los `js/*.js` → OK.
- Smoke manual `smoke-fluyo-010.cjs` → PASS.
- `git diff --check` → sin errores de espacios en blanco (solo warnings de autocrlf).

### Problemas pendientes / riesgos
- El gate legacy de Service Worker en `scenario-qa-browser.cjs` no se ejecutó localmente porque no existe el commit histórico `fluyo-static-v39` en este entorno. Está clasificado como `NOT RUN — environment` y no bloquea el suite.
- El gate de privacidad Umami en `share-browser.cjs` y `share-post-qa-browser.cjs` no se ejecutó porque no se proporcionó el script actual como argumento. Está clasificado como `NOT RUN — environment` y no bloquea el suite.
- `scenario-qa-overhead.cjs` sigue midiendo overhead v3→v4. No es un fallo, pero en una futura pasada podría extenderse a v5.

### Revisión QA adversarial independiente (esta sesión)

Se ejecutó una revisión de QA independiente sobre FLUYO-010 sin mod/features nuevas, sin commits y sin abrir FLUYO-011. Se releyeron `AGENTS.md`, `PRODUCT.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `FLUYO-008.md`, `FLUYO-009.md` y este archivo; se inspeccionaron `js/model.js`, `js/scenario-engine.js`, `js/scenario-playback.js`, `js/editor-scenarios.js`, `js/interaction.js`, `js/render.js`, `js/share-url.js` y `sw.js`.

#### Bug encontrado y corregido
- **Problema**: En `js/editor-scenarios.js`, `scFindDropTargets` consultaba el `eventTypeId` a través del objeto global `scDrag`. Durante un drop multi-edge, `scEndDrag` limpiaba `scDrag` antes de que la función filtrara los targets compatibles, de modo que la selección múltiple de edges no recibía el filtrado por primitiva `FLOW`.
- **Impacto**: Un drop de un EventType `FLOW` sobre una selección múltiple de edges podía no encontrar targets o usar la primitiva del drag anterior.
- **Corrección**: Cambiar la firma de `scFindDropTargets(kind, wx, wy)` a `scFindDropTargets(kind, wx, wy, eventTypeId)` y filtrar los targets con `eventTypeAllowedTargets`. Los callers `scMouseMove`, `scDrawDragGhost` y `scEndDrag` pasan el `eventTypeId` activo en lugar de depender de `scDrag`.
- **Archivo modificado**: `js/editor-scenarios.js`.

#### Tests añadidos
- `test/fluyo-010-qa.test.cjs` (nuevo): 50 tests adversariales que cubren:
  - separación EventType/primitiva e inmutabilidad de `primitive`/`availability` en uso;
  - schema v5, migraciones v3→v5 y rechazo de v6;
  - engine v1 vs v2, determinismo de `OCCURRENCE`, ausencia de side effects;
  - templates allowlisted (`{source}`, `{target}`, `{name}`) y seguridad contra XSS/prototype pollution;
  - multi-edge FLOW, tie-break por orden de array, contadores monotónicos;
  - Share/viewer roundtrip, Service Worker v45, lista de scripts del viewer;
  - regresión del bug de drag & drop (`scFindDropTargets` con `eventTypeId` explícito);
  - neutralidad de dominio en `js/scenario-engine.js` y `js/model.js`.

#### Resultados de pruebas
- `node --test test/fluyo-010-qa.test.cjs` → **50 pass / 0 fail**.
- `node --test test/*.test.cjs` → **285 pass / 1 fail** intermitente en `qa-share.test.cjs:62` (`'loading' !== 'error'`). Ejecutado aisladamente el mismo test pasa; se clasifica como timing/race condicional del viewer, no regresión introducida por FLUYO-010.
- `node --test test/*.cjs` (incluye tests de browser) → fallan 5 archivos por ausencia del módulo `playwright` en el entorno:
  - `test/qa-share-hash-browser.cjs`
  - `test/scenario-qa-browser.cjs`
  - `test/share-browser.cjs`
  - `test/share-post-qa-browser.cjs`
  - `test/share-realistic-size-browser.cjs`
  Todos se clasifican como **NOT RUN — environment**.
- `node --check js/*.js` → OK.
- `git diff --check` → sin errores de espacios en blanco.

#### Notas sobre discrepancias en el handoff anterior
- El handoff previo menciona haber corregido tests de browser a `engineVersion:3`; el motor sólo define `1` y `2`. Esa referencia debe considerarse un error tipográfico del resumen; el código y los tests actuales usan `engineVersion:2` para FLUYO-010.
- Los recuentos de tests del handoff anterior no coinciden con los actuales porque se ha añadido `test/fluyo-010-qa.test.cjs` y la suite base ha crecido con las iteraciones previas.

#### Problemas pendientes / riesgos
- Los 5 tests de browser dependen de `playwright`, que no está instalado en este entorno. Quedan como `NOT RUN — environment`.
- El test `qa-share.test.cjs` presenta un fallo intermitente de viewer (`loading` vs `error`) bajo carga concurrente; no es reproducible aisladamente y no está vinculado a los cambios de FLUYO-010, pero conviene vigilarlo.
- La verificación manual de pan/zoom y drag & drop en navegador real no se pudo ejecutar por la misma ausencia de Playwright.

### Cierre final de QA independiente

Tras la sesión de seguimiento se resolvieron los dos obstáculos que quedaban pendientes: el archivo accidental `Puede` y el fallo intermitente de `qa-share.test.cjs`. Además se consiguió ejecutar los gates de browser usando Playwright instalado fuera del repo y el navegador Chrome ya presente en el sistema.

#### Resolución de incidencias

| # | Incidencia | Clasificación | Corrección |
|---|---|---|---|
| A | Archivo `Puede` sin referencias en el repo. | Fichero accidental. | Se comprobó que estaba vacío, sin contenido ni vínculos; se eliminó. |
| B | `qa-share.test.cjs` fallaba intermitentemente (`'loading' !== 'error'`) bajo carga concurrente. | **RACE DEL TEST** (no producto). | Se añadió `waitForPhase(predicate, timeoutMs)` a `test/viewer-harness.cjs` y se usó después de cada `boot()`/`navigate()` que asume una fase final (`ready`/`error`). |

Archivos modificados para estabilizar el harness:
- `test/viewer-harness.cjs`: nuevo helper `waitForPhase`.
- `test/qa-share.test.cjs`, `test/share.test.cjs`, `test/share-post-qa.test.cjs`, `test/share-final-qa.test.cjs`, `test/scenario-independent-qa.test.cjs`, `test/scenario-post-qa.test.cjs`, `test/viewer.test.cjs`: espera explícita a la fase observable antes de asertar.

#### Resultados finales de pruebas

- `node --test test/qa-share.test.cjs` ejecutado 20 veces aisladas → **20/20 PASS**.
- `node --test test/*.test.cjs` ejecutado 3 veces completas → **286/286 PASS** en cada una.
- `node --test test/*.cjs` con Playwright temporal (`$env:TEMP\fluyo-codex-playwright`) y Chrome del sistema → **298/298 PASS**.
- `node --check` sobre todos los `js/*.js` → OK.
- `git diff --check` → sin errores de espacios en blanco (solo advertencias de autocrlf por configuración local).

#### Gates de browser ejecutados

Playwright se instaló fuera del repositorio (`$env:TEMP\fluyo-codex-playwright`) y se lanzó con `chromium.launch({ channel: 'chrome' })` usando el Google Chrome existente. Resultados:

| Gate | Resultado |
|---|---|
| `test/qa-share-hash-browser.cjs` | **PASS** |
| `test/scenario-qa-browser.cjs` | **PASS** (legacy SW commit → `NOT RUN — environment`) |
| `test/share-browser.cjs` | **PASS** (Umami script → `NOT RUN — environment`) |
| `test/share-post-qa-browser.cjs` | **PASS** (Umami script → `NOT RUN — environment`) |
| `test/share-realistic-size-browser.cjs` | **PASS** |

Además se creó y ejecutó con éxito un smoke de browser temporal (`$env:TEMP\fluyo-codex-playwright\fluyo-010-browser-smoke.cjs`) que validó en Chrome real:
- FLOW multi-edge: un EventType `💵 Pago` soltado sobre una selección múltiple de edges genera 3 Steps `SEND` con el mismo `at`, mismo `eventTypeId` y `edgeIds` distintos.
- Pan y zoom permiten soltar EventTypes en cualquier zona visible del canvas.
- Drops inválidos (FLOW sobre nodo, OCCURRENCE sobre edge, drop en área vacía) no crean Steps.
- Limpieza visual: al cancelar el drag no quedan ghosts ni restos de `scDrag`.

#### Veredicto

**APROBADO** para cierre de FLUYO-010.

Razones:
- La funcionalidad definida en el objetivo y criterios de aceptación está implementada y cubierta por tests.
- La suite Node es estable (286/286, 3 ejecuciones consecutivas sin fallos).
- Los gates de browser críticos pasan en Chrome real; los dos `NOT RUN — environment` dependen de infraestructura/secretos externos y no son bloqueantes.
- El único bug encontrado en QA (multi-edge `scFindDropTargets`) ya está corregido y con cobertura.
- El fallo intermitente de `qa-share.test.cjs` era una race del harness de tests, no del producto, y quedó estabilizado.

### Próximo paso concreto
- Ninguno dentro de FLUYO-010. El hito puede darse por cerrado; si se reactiva, la causa debe ser una nueva regresión detectada en CI o un cambio de alcance.
