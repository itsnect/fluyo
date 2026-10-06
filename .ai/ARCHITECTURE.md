# ARCHITECTURE.md — Arquitectura técnica de Fluyo

## Stack

- HTML + CSS + JavaScript vanilla, sin build ni dependencias de runtime.
- Scripts clásicos (`<script src>`) que comparten ámbito global.
- Sin módulos ES: un `import` de nivel superior rompería la apertura desde `file://`.
- Canvas 2D para el editor y el viewer.
- Service worker cache-first para offline.

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `index.html` | Interfaz completa del editor. |
| `js/config.js` | Constantes: paleta, temas, tipografías, iconos, GIFs, tamaños. |
| `js/model.js` | Documento, páginas, fábricas, validación y migración de `.fluyo.json`. |
| `js/state.js` | Estado mutable del editor, autoguardado, viewport, interacción de alto nivel. |
| `js/selection.js` | Selección, portapapeles, deshacer/rehacer. |
| `js/geometry.js` | Geometría de nodos y aristas, rutas ortogonales, etiquetas. |
| `js/render.js` | Dibujado del canvas, bucle de animación, overlays de Scenario. |
| `js/interaction.js` | Ratón, teclado, zoom/pan, drag & drop del canvas. |
| `js/editor-runtime.js` | Bucle del editor, renderState, integración con playback. |
| `js/scenario-engine.js` | Motor determinista puro de Scenarios (v1/v2). |
| `js/scenario-playback.js` | Proyección de Trace a datos visuales (sin DOM). |
| `js/story-playback.js` | Receta ÚNICA de reproducción (`FluyoStory`): metadata por Step, ejecución, fin, estado de pintura y texto humano. Compartida por editor, Present y Viewer. |
| `js/document-integrity.js` | `FluyoIntegrity` (FLUYO-017.1): autoridad única de integridad del documento. Pura, sin DOM; la cargan el editor (FLUYO-018.4, para confirmar borrados) y fluyo-mcp. |
| `js/story-authoring.js` | `FluyoAuthoring` (FLUYO-017.2): lote atómico de operaciones de Historia sobre una copia. Pura; no cargada por el editor (la consume fluyo-mcp). |
| `js/editor-scenarios.js` | Panel de Historias (Scenarios), selección de la Historia activa, storyboard, autoría, playback UI. |
| `js/ui.js` | Panel lateral, pestañas, cajones, controles de propiedades. |
| `js/export.js` | Guardar/abrir `.fluyo.json`, exportar GIF/PNG/JPG/SVG. |
| `js/deeplink.js` | Carga de documentos desde `#d=`. |
| `js/share-url.js` | Codificación de enlaces compartidos. |
| `js/editor-share.js` | Diálogo de compartir. |
| `js/viewer.js` | Viewer read-only de `/s/` (con reproducción de la Historia compartida). |
| `sw.js` | Service worker y cache. |

## Formato `.fluyo.json`

```text
{ version, app, doc, settings }
```

- `version`: entero. Actualmente 5.
- `doc`: `{ theme, customBg, cur, eventTypes, nextEventTypeId, pages }`.
- `page`: `{ name, nodes, edges, nextId, behaviors, scenarios, nextScenarioId }`.
- `settings`: `{ speed, dots, build, stagger, grid, snap, font, single }`.

Los `id` son únicos por página para nodos/edges; los contadores `nextId`, `nextScenarioId`, `nextStepId`, `nextEventTypeId` nunca bajan.

## Scenarios

- `Scenario` tiene `engineVersion`, `name`, `nextStepId` y `steps`.
- `Step` v1: `SET_STATE` (nodeId, state) o `SEND` (edgeId).
- `Step` v2: añade `OCCURRENCE` (nodeId/edgeId) y `eventTypeId` opcional en todos.
- El motor es determinista, puro y sin DOM/timers/aleatoriedad.

## EventTypes

- Project-scoped: viven en `doc.eventTypes`.
- Cada uno define `name`, `primitive`, `sentenceTemplate`, `visual`, `motion` y, para `SET_AVAILABILITY`, `availability`.
- `presentation.nodeEffects` guarda el efecto visual opcional sobre nodos (icono, tamaño del símbolo, mensaje, colores, resaltado, parpadeo, atenuación). `presentation.connectionEffects` (FLUYO-015) guarda cómo viaja el símbolo por una conexión (tamaño, forma de moverse, rastro, al llegar, mientras viaja). Ninguno altera el Trace.
- Las primitivas son: `FLOW`, `OCCURRENCE`, `SET_AVAILABILITY`.
- Los templates solo permiten placeholders allowlisted: `{source}`, `{target}`, `{name}`.

## Testing

- Tests en `test/*.cjs` con `node --test`.
- Motor y playback se ejecutan en `vm` sin DOM.
- Tests DOM usan un DOM falso.
- Browser smokes usan Chrome headless vía CDP.

## Restricciones duras

- Sin `import` de nivel superior.
- Sin backend ni almacenamiento remoto.
- Service worker cache-first: cualquier cambio en assets requiere bump de `CACHE`.
- Cualquier PR que toque un archivo servido debe subir la constante `CACHE` en `sw.js`.

## Composición de escenarios (FLUYO-011)

- `editor-scenarios.js` presenta Eventos → Canvas → Historia. No añade primitivas ni altera el schema.
- La biblioteca es del proyecto; las apariciones pertenecen al escenario. Nombre/frase/símbolo/efectos visuales se editan globalmente, objetivos/tiempo se editan localmente.
- Si no hay Scenario, colocar un evento crea uno por defecto; la acción se deshace junto con la colocación.
- El modal nativo de eventos vive fuera de `aside`. Un único cuerpo tiene scroll y cabecera/pie quedan accesibles.
- La frase se edita como segmentos de texto y botones de nombres. La conversión conserva el template existente, incluidos orden, repeticiones y literales; no interpreta HTML.
- La historia deriva grupos por `at`, ordenados cronológicamente; dentro de cada grupo conserva el orden de array que usa el motor. No se persisten entidades de agrupación.
- `scPlacement`, `scContext`, `scDrag` y feedback visual son estado efímero. Los targets usan `edgePoints`, coordenadas de mundo y tolerancia en píxeles. No hay fallback de selección al soltar en vacío.
- `interaction.js` deja que Scenarios consuma la colocación antes de iniciar un gesto normal del canvas. `render.js` consulta compatibilidad/hover y mantiene los overlays de reproducción fuera del estado persistido.
- Las mutaciones usan `pushUndo` y `scheduleAutosave`. Cambiar el intervalo mueve el grupo completo y los posteriores; quitar una aparición cuyo momento desaparece colapsa su espera (FLUYO-012.1, `storyboardRemoveStep`).
- El panel mide su ancho real con ResizeObserver: debajo de 300 px la biblioteca pasa a palette flotante. Durante reproducción la biblioteca se compacta.
- `test/fluyo-011-browser.cjs` prueba el flujo real en Chrome, texto pintado en canvas, responsive y upgrade de la caché anterior a la actual. Playwright se proporciona externamente mediante NODE_PATH, sin dependencia de runtime ni build.
- FLUYO-012: la semántica de orden de Historia vive en `model.js` (`storyboardMoveByOne`, `storyboardMoveStep`, `storyboardDropTarget`), compartida por menú y arrastre. `render.js` dibuja los overlays de nodo en dos pasos (fill/dim/highlight en `drawNode`; símbolo+mensaje en un pase posterior vía `computeNodeCueLayout`). La duración visual (`presentation.nodeEffects.visualDuration*`) es sólo presentación.
- FLUYO-012.1: Historia deriva los tiempos de la posición narrativa (esperas en los huecos; unir un momento colapsa su espera). `render.js` apila los cues de texto de un nodo (`nodeTextCues`, `computeNodeCueLayout` con `offset`). Menú de aparición y `scDuplicateStep` en `editor-scenarios.js`.
- FLUYO-012.1 (QA final): `model.js` concentra toda la semántica temporal de Historia (`storyboardMoveByOne`, `storyboardMoveStep`, `storyboardRemoveStep`, `storyboardInsertDuplicate`, `storyboardCollapsedGroups`); menú, arrastre, borrado y duplicado la invocan y nunca recalculan tiempos por su cuenta. Invariante probado: orden y `at` de Historia = Steps persistidos = Trace = Playback, también tras guardar/importar/deep link. Menú de aparición: `scStoryMenu` + `scMenuSections` (secciones y submenús en el mismo popover). Los contadores de ids (`nextStepId`) nunca bajan, ni con undo: el undo restaura Steps/orden/`at` exactos, no el contador.

## Present con Historia (FLUYO-013)

- `js/present-story.js` (clásico, tras `editor-scenarios.js`) traduce el estado del Playback existente a la UI de Present: `presentPhase()` deriva de `scStatus`; `presentPlay()` → `scRun({present:true})`; `presentStop()`/`exitPresent()`/`goSlide()` → `scReset()`. `FluyoPresentStory` es puro y testeable en `vm`.
- `presentStoryRefresh()` se llama desde `scTick`, `scReset` y errores de `scRun`, y sólo escribe el DOM cuando cambia el valor. `fitViewPresent()` encaja el diagrama con margen y reserva encabezado y barra.
- Present es read-only: sin undo, autosave ni mutación de Steps/EventTypes. Test real: `test/fluyo-013-browser.cjs`.

## Share Playback (FLUYO-014)

```text
Scenario ──→ js/story-playback.js (FluyoStory) ──→ scenario-engine ──→ Trace ──→ scenario-playback ──→ render.js
              ▲            ▲            ▲
          Editor       Present       Viewer (/s/)
```

- **Una sola receta**: `FluyoStory.start(page, scenario, now)` (valida, ejecuta el motor, construye `stepMeta` y el Playback), `isFinished`, `renderState` (el `scenarioRuntime` que pinta `render.js`) y `describe` (título, momento, mensaje humano y cierre). `scRun`/`scTick`/`buildScenarioRenderState` del editor, `presentStoryRefresh` y el Viewer **llaman** a estas funciones; nadie más ejecuta el motor ni construye Playback. Es puro (sin DOM, RAF, timers ni almacenamiento): se prueba en `vm`.
- **Qué se comparte**: el mismo snapshot `/s/#d=` (sin schema nuevo). `createShareUrl(project, base, {kind, scenarioId})` aplica `applyShareKind` a la **copia** normalizada: `"story"` (por defecto) coloca el Scenario activo del autor como `scenarios[0]` de la página abierta; `"diagram"` vacía `scenarios` en todas las páginas. Sin opciones, el comportamiento anterior no cambia.
- **Viewer**: carga `scenario-engine`, `scenario-playback` y `story-playback` además del core; no carga `editor-scenarios` ni `present-story`. La Historia de una página es `scenarios[0]` con pasos (no hay selector). Su runtime (`story`) es efímero, vive en `viewer.js`, se pinta dentro del único `viewerLoop` y se descarta en `clearViewerDocument` (hashchange/error/arranque), `goPage`, `enterPresent` y antes de «Abrir en Fluyo». El documento instalado nunca se modifica.
- **UI**: sección `#story` bajo el lienzo (nombre de la Historia, mensaje, «▶ Reproducir historia» / «■ Detener» / «↻ Repetir» / «Abrir en Fluyo»), oculta si la página no tiene Historia. El diálogo de compartir del editor ofrece «Compartir historia» / «Compartir sólo el diagrama» sólo si hay Historia.
- **Tests**: `test/fluyo-014.test.cjs` (contrato, vm) y `test/fluyo-014-browser.cjs` (Chrome real: casos Negocio/Humano/Sistema/Simultáneo/Efectos, paridad con Present, navegación y carreras, Abrir en Fluyo, 4 viewports, offline y upgrade del SW v56→v57).

## Lenguaje visual de eventos en movimiento (FLUYO-015)

```text
EventType.presentation.connectionEffects ─→ connectionVisualSpec(et)  (model.js, única especificación)
   → FluyoStory.stepMeta (meta.connection) → scenario-playback (lo copia en activeSends/completedSends)
   → render.js: drawEventToken / drawEventArrival (único pintor) ← drawFlowOverlay
                      ▲ Playback (Editor, Present, Viewer)    ▲ preview del modal (canvas)
```

- Campos (listas cerradas, normalizados campo a campo, sin schema nuevo): `size` small|medium|large (15/20/28 px), `style` direct|smooth|impulse, `trail` none|subtle|marked, `arrival` none|pulse|glow|bounce, `during` none|halo|breathe. Eventos de elemento: `nodeEffects.symbolSize` (16/22/32 px). `motion` (velocidad Rápido/Normal/Lento) no cambia.
- Es presentación pura: la forma de moverse transforma el `progress` (misma duración ⇒ mismo fin, Trace y orden), rastro/halo/llegada son función de `progress`/`ageMs`. Sin timers, listeners ni estado persistente. El motor y `scenario-playback` no interpretan estos campos (sólo los transportan).
- El preview del modal es un `<canvas>` que llama a `drawFlowOverlay`, el mismo pintor de Playback; un único RAF mientras el diálogo está abierto (`scPreviewStop` al cerrar); con «reducir movimiento» pinta un fotograma y sólo anima con «Ver ejemplo».
- Tests: `test/fluyo-015.test.cjs` (vm; incluye «Trace antes = Trace después») y `test/fluyo-015-browser.cjs` (Chrome real).

## Historias como entidad de primer nivel (FLUYO-016)

```text
documento: page.scenarios[]  (la Historia = Scenario; sin stories[] ni schema nuevo)
editor:    scActiveId + scLastPage (efímeros)  ──→ scActiveScenario()  ──→ Run / Present / Share
```

- **Visible = «Historia»; interno = `Scenario`.** Panel: `HISTORIAS · [● nombre ▾] [+] [⋯]`; `+` crea «Historia N» al instante (sin modal); `⋯` = Renombrar · Duplicar historia · Eliminar historia · Condiciones · Detalles. Estado vacío «Aún no hay historias» + «+ Nueva historia»; arrastrar un Evento sin Historias sigue auto-creándola.
- **Modelo** (`model.js`, puro): `defaultScenarioName(pg)`, `copyScenarioName`, `duplicateScenario(pg,id)` (copia profunda, id de Scenario nuevo e irreutilizable, `nextStepId` conservado —los ids de Step son por Historia—, se inserta justo detrás del original; «X copia», «X copia 2»…).
- **Selección** (`editor-scenarios.js`): `scSelectStory(id)` es el único punto que cambia la Historia activa y limpia `scSelectedStep`/`scContext`/firma del storyboard. `scSyncPage()` se llama desde `renderTabs()`: al cambiar de página o de documento descarta la selección (los ids de Scenario son **por página**: sin esto el id 2 de una página «seleccionaba» el id 2 de otra) y cae en la primera Historia de la página nueva. Cambiar de Historia no es una operación de Undo; crear/duplicar/eliminar/renombrar son **una** (`pushUndo`, que ya snapshotea `page.scenarios`).
- **Playback**: cambiar, crear, duplicar, eliminar o renombrar una Historia hace `scReset()` antes de actuar: sin overlays ni RAF residuales. Sin cambios en `story-playback.js`, `scenario-engine.js`, `scenario-playback.js` ni `render.js`.
- **Share** (`share-url.js#applyShareKind`): «Compartir historia» = `{kind:"story", scenarioId}` → la copia lleva **sólo** esa Historia como `scenarios[0]` de la página abierta; todas las demás Historias (de esa página y de las demás) se vacían. Id inexistente → ninguna (falla cerrado). «Sólo el diagrama» → ninguna. `createShareUrl` sin opciones (o `kind:"story"` sin id) = copia tal cual (snapshot crudo; el editor nunca lo usa). Los EventTypes del proyecto viajan completos.
- **Viewer**: sin cambios de lógica (`scenarios[0]` de la página abierta; sin selector). Añade la etiqueta «Historia» (`#stKicker`; durante/tras reproducir, «Historia · nombre»). **Legacy**: un Share anterior con N Scenarios sigue reproduciendo `scenarios[0]`; los Shares nuevos llevan uno.
- **Present**: lee `scActiveScenario()`; cambiar de diapositiva ya hacía `scReset()`.
- Tests: `test/fluyo-016.test.cjs` (vm), `test/fluyo-016-browser.cjs` (Chrome real), `test/fluyo-016-mutations.cjs` (18 mutaciones sobre copias), arnés `test/fluyo-016-harness.cjs`.

## Kernel compartido e integridad (FLUYO-017.1)

```text
js/{config,safe-svg,model,scenario-engine,scenario-playback,story-playback,document-integrity}.js   ← el kernel
        │ editor / Present / Viewer los cargan con <script>
        └ fluyo-mcp: `sync:kernel` los copia VERBATIM (sha256 + kernelId) y los ejecuta en un `vm` nuevo por llamada
```

- **`FluyoStory.run(page, scenario)`** es la única ejecución del motor (`start` la invoca y añade Playback). **`FluyoStory.outcomes(trace, scenario, page)`** deriva el resultado por Step sólo del Trace (`completed`, `not_completed`+razón, `state_changed`, `no_change`, `narrated`); `FluyoStory.finalAvailability(trace, page)` da la disponibilidad al terminar y `FluyoStory.sentence` la frase de un Step.
- **`FluyoIntegrity.validateProject(project)`** → `{valid, schemaVersion, engineVersion, errors[], stories[]}`. Compone `projectFromProjectData` (forma/ids/contadores) y `FluyoScenarios.runScenario` (estructura, Behaviors, referencias de Steps, tiempos, versión, límites); añade `missing_event_type` y `event_type_action_mismatch`. Error: `{code, message, scope: document|page|story|step, pageIndex?, storyId?, stepId?, entityId?, entityKind?}`. Las páginas se identifican por posición.
- **`FluyoIntegrity.removalImpact(project, {pageIndex, nodeIds?, edgeIds?})` (B2, sólo detección)**: simula sobre una copia lo que hacen `deleteSel` y `remove_node` y devuelve qué Historias/Steps quedarían inválidos. No modifica nada; lo consultan `deleteSel` del editor (018.4) y, por la validación del estado final, MCP.
- Pruebas: `test/fluyo-017-1.test.cjs` (fixture `test/fixtures/fluyo-017-1-*.json`; el golden lo generan el camino real del editor, `scRun`, y el kernel). El mismo golden se verifica en fluyo-mcp.

## Autoría de Historias compartida (FLUYO-017.2)

```text
editor-scenarios.js ──┐                                     ┌── fluyo-mcp: author_document (copia, lote atómico, revisión)
 (undo, UI, autosave) ├── model.js (dominio compartido) ────┤
                      │   storyboardSetWait · duplicateStep │
                      │   retargetStep · stepDefinitionForEvent · defaultStepTime · setInitialAvailability
                      │   eventTypeActionSpec · projectToSerializable
                      └── story-authoring.js (FluyoAuthoring.apply) ──→ FluyoIntegrity (estado final) ──→ FluyoStory.run
```

- **Extraído del editor a `model.js`** (el editor ahora llama a estas mismas funciones; ya no tiene copia): `storyboardSetWait(steps,id,delay,maxAt)` (esperas narrativas: el momento y los posteriores se desplazan), `duplicateStep`, `retargetStep` (sólo cambia el objetivo), `stepDefinitionForEvent(et,target,at)` (la acción sale del EventType), `defaultStepTime`, `setInitialAvailability` (disponibilidad INICIAL = Behavior de la **página**) y `eventTypeActionSpec` (la única tabla primitiva→acción; `FluyoIntegrity.eventActionSpec` delega en ella).
- **`FluyoAuthoring.apply(project, operations)`** (`js/story-authoring.js`, clásico, sin DOM, sin tocar la global `doc`): normaliza una COPIA, aplica el lote en orden, evalúa **el estado final** con `FluyoIntegrity` y devuelve `{ok, project, changes, touched, validation}` o `{ok:false, errors}` (nunca un documento parcial). Sólo contiene la forma de las operaciones, las `ref` del lote y la explicación de los rechazos; ninguna regla de tiempo/acción/destino/integridad.
- **Operaciones** (cada una declara su `scope` y se verifica): `story` → `create_story`, `rename_story`, `duplicate_story`, `delete_story`, `add_step`, `remove_step`, `move_step`, `duplicate_step`, `retarget_step`, `set_wait`; `page` → `set_initial_availability`; `eventType` → `create_event_type`, `update_event_type`, `delete_event_type` (FLUYO-017.3; globales al documento, sin `pageIndex`). En 017.3 no había operaciones sobre elementos o conexiones (`delete_connection`/`delete_node` de 017.2 se retiraron); 018.2 añadió `create_node`/`create_connection` (scope `page`) y 018.3 `update_*`/`delete_*` con otra forma ({node}|{connection}, B2 sobre el estado final). Los campos desconocidos se rechazan (nadie escribe `action`, `state` ni `at`).
- **Tiempo narrativo**: `add_step` añade al final tras `waitMs` (por defecto 1 s; el primero entra en 0) o «al mismo tiempo» (`placement.sameMomentAs`, con o sin `position`); `set_wait` fija la espera de un momento; `remove_step` colapsa la espera del momento que desaparece; `duplicate_step` entra en el mismo momento sin desplazar; `move_step` rota ranuras (los instantes no se inventan).
- **B2 aplicado**: un lote que deje una Historia inválida (respecto del documento base) se rechaza con `REFERENCED_ENTITY {entity, affectedStories[{storyId,storyName,stepIds}], affectedSteps, operationIndex}`; retargetear/quitar pasos y borrar en el mismo lote es válido (estado final). Además, toda Historia creada/editada por el lote debe quedar ejecutable.
- **fluyo-mcp** (`author_document`): `revision` = sha256 del JSON canónico (claves ordenadas) del documento **normalizado**; `baseRevision` obligatoria (control optimista, sin estado); `resultRevision` determinista; `dryRun`. Rechazos con `isError:true` y sin documento. Equivalencias de editor y MCP: `test/fluyo-017-2*.test.cjs` (editor real vs kernel, secuencias aleatorias) y `fluyo-mcp/test/fluyo-017-2*.test.ts` (mismo golden).

## EventTypes compartidos entre el editor y MCP (FLUYO-017.3)

```text
Editor (modal) ─────►  model.js:  eventTypeDefinition · eventTypePrimitiveFor · createEventTypeIn · updateEventTypeIn · deleteEventTypeIn
                                  eventTypeUsagesIn · eventTypePresentationDiff
MCP author_document ─► FluyoAuthoring (forma de la operación) ──► las MISMAS funciones ──► FluyoIntegrity (estado final / impacto)
```

- **Extraído del modal a `model.js`**: la forma por primitiva (`eventTypeDefinition`) y la traducción dónde/consecuencia → primitiva (`eventTypePrimitiveFor`). `createEventType`/`updateEventType`/`deleteEventType`/`eventTypeById`/`eventTypeUseCount` delegan con la global `doc` en las variantes `…In(d, …)`: el editor no cambia de API.
- **Operaciones MCP** (scope `eventType`): `create_event_type`, `update_event_type` (parche; si cambia la primitiva se reconstruye la definición completa, como el modal), `delete_event_type` (impacto por `FluyoIntegrity.eventTypeImpact`). `add_step` acepta `eventTypeId: {ref}` de un evento creado en el mismo lote.
- **Reglas**: ver decisiones 78–82 en `.ai/DECISIONS.md`. Rechazos estructurados: `EVENT_TYPE_LOCKED` (campo + usos), `REFERENCED_ENTITY` (EventType, Historias, Steps), `INVALID_EVENT_TYPE` (con `field`), aviso `DUPLICATE_EVENT_TYPE_NAME`.
- **Pruebas**: `test/fluyo-017-3.test.cjs` y `test/fluyo-017-3-qa.test.cjs` (dominio, autoría, paridad con el modal real; el golden incluye la `revision` del documento del editor), `test/fluyo-017-3-mutations.cjs` (mutaciones sobre copias), `test/fluyo-017-3-browser.cjs` (Chrome real: modal, Undo/Redo, Present, Share/Viewer, documentos antiguos; Playwright externo vía NODE_PATH). En fluyo-mcp: `test/fluyo-017-3*.test.ts` y `scripts/mutate-017-3.ts` (mutaciones del kernel regenerado y de `src/`).

## Creación de nodos y conexiones (FLUYO-018.1)

```text
Editor (newNode/newEdge, state.js) ─►  model.js:  createNodeIn · createConnectionIn  ◄─ FluyoAuthoring (018.2) ◄─ author_document (MCP): create_node · create_connection
```

- Operan sobre una página explícita, todo o nada, con la misma normalización que la carga (`normalizeProjectNode`/`normalizeProjectEdge`). Ver decisiones 83–84 y `.ai/tasks/FLUYO-018.md` §22.
- Pruebas: `test/fluyo-018-1.test.cjs`, `test/fluyo-018-1-mutations.cjs`; 018.2: `test/fluyo-018-2.test.cjs`, `test/fluyo-018-2-mutations.cjs` y fluyo-mcp `test/fluyo-018-2.test.ts`, `scripts/mutate-018-2.ts`. Ver decisiones 85–86 y `.ai/tasks/FLUYO-018.2.md`.

## Modificar y eliminar estructura (FLUYO-018.3)

```text
Editor (gestos/panel/Supr) ─► state.js: editNode · editEdge · removeNodes · removeEdges ─►  model.js:  updateNodeIn · updateConnectionIn · deleteNodeIn · deleteConnectionIn
                                                                                              ▲
MCP author_document: update_node · update_connection · delete_node · delete_connection ─► FluyoAuthoring ─► (mismas funciones) ─► FluyoIntegrity (estado final, B2)
```

- Mover, redimensionar, editar texto/forma/estilo, retargetear y borrar ya no son escrituras inline de los manejadores: el editor aporta la página activa, el undo y el autoguardado; las reglas (parche de claves cerradas, normalización de la carga, auto-lazo, extremos existentes, cascada de conexiones y Behavior) son de `model.js`. Quedan en el editor, por ser **gestos** que dependen de `geometry.js`: `realinearExtremos`/`podarWaypoints` al mover, `moverTramo`, arrastre de waypoints, orden Z, pegar/duplicar. Ver decisiones 87–90 y `.ai/tasks/FLUYO-018.3.md`.
- Estado de B2: **MCP lo aplica** (rechaza). **El editor confirma** (FLUYO-018.4, decisiones 91–92): ver más abajo. *(Hasta 018.3 el editor no hacía nada; ya no.)*
- B2 del diagrama (decisión 89): el estado final decide y el rechazo atribuye cada Historia/Step a la entidad eliminada (`REFERENCED_ENTITY`, con `cascadedFrom` para conexiones eliminadas en cascada).
- Pruebas: `test/fluyo-018-3.test.cjs` (dominio, autoría, B2, refs, paridad con el editor real y Trace; golden `test/fixtures/fluyo-018-3-golden.json` compartido con fluyo-mcp), `test/fluyo-018-3-mutations.cjs` (60 mutaciones) y `test/fluyo-018-3-browser.cjs` (Chrome real contra HEAD; Playwright externo vía NODE_PATH). En fluyo-mcp: `test/fluyo-018-3.test.ts` y `scripts/mutate-018-3.ts`.

## Política de borrado del editor (FLUYO-018.4)

```text
Supr · botón · menú · táctil · Cortar ─► deleteSel (selection.js)
   └─ deleteImpact(nodeIds, edgeIds) ─► FluyoIntegrity.removalImpact (copia de la página activa; sin Historias no se simula)
        ├─ sin Historias afectadas ─► pushUndo ─► removeEdges + removeNodes (nodo + conexiones + Behavior)
        └─ con ellas ─► confirm(deleteConfirmMessage) ─► Cancelar: nada · Aceptar: lo mismo, un solo Undo
```

- `index.html` carga `document-integrity.js` (tras `story-playback.js`) y `sw.js` lo precachea; el archivo no cambió de comportamiento (release 018.x: comentarios de cabecera actualizados y kernel sincronizado con fluyo-mcp).
- Nunca se modifican Steps ni Historias. Con impacto, el mensaje nombra cada Historia con su número de momentos y destinos, y la condición de disponibilidad inicial si el nodo la tiene. Pruebas: `test/fluyo-018-4.test.cjs` (incluye paridad con el B2 de `author_document`) y `test/fluyo-018-4-mutations.cjs` (15 mutaciones).

## Páginas, reglas de entrada y límites de autoría (FLUYO-018.5)

```text
Editor (addPage/renamePage, state.js) ─►  model.js: createPageIn · renamePageIn  ◄─ FluyoAuthoring (create_page, rename_page; scope «document») ◄─ author_document (MCP)
FluyoAuthoring: reglas de entrada de nodo (HEX, icon, anim) + LIMITS sobre el ESTADO FINAL del lote  →  LIMIT_EXCEEDED
```

- `createPageIn(d, name?)` añade al final y devuelve `{pageIndex, page}` sin tocar `d.cur`; `renamePageIn(d, i, name)`. Nombre: texto de 1 a `PAGE_NAME_MAX` (80), no solo espacios. Errores: `invalid_page_name`, `page_not_found`. Las páginas siguen sin id. Decisión 93.
- `FluyoAuthoring.LIMITS` (`coordMax 100000`, `sizeMin 10`, `sizeMax 5000`, `maxNodesPerPage 300`, `maxConnectionsPerPage 600`) es la única fuente; `describe_document` los publica en `capabilities.limits`. Son reglas de **entrada**: ni `FluyoIntegrity` ni la carga los conocen, y un documento antiguo que los excede se abre y se edita (decisiones 94–95).
- Pruebas: `test/fluyo-018-5.test.cjs` (dominio, autoría, reglas, límites, no retroactividad, paridad con el editor real; golden `test/fixtures/fluyo-018-5-golden.json` compartido con fluyo-mcp), `test/fluyo-018-5-mutations.cjs` (44 mutaciones), `test/fluyo-018-5-browser.cjs` (Chrome real contra HEAD); fluyo-mcp: `test/fluyo-018-5.test.ts`, `scripts/mutate-018-5.ts` (37).

## Entrada de autoría y propose_layout (FLUYO-018.6)

- `story-authoring.js`: `nodeInputRules` admite `fill:"none"`; `edgeInputRules` valida `lineColor`/`dotColor` (HEX o null) en `create_connection` y `update_connection` (decisión 97). Sin cambios en el editor, `index.html` ni `sw.js` (`CACHE` sigue en v63): `story-authoring.js` solo lo carga fluyo-mcp.
- fluyo-mcp: `src/layout.ts` expone `layoutPage(page)` (única adaptación página → `layeredLayout`, usada por `edit_diagram.relayout` y `propose_layout`); `src/propose-layout.ts` es la tool nº 13 (decisión 98): normaliza con el kernel, calcula, comprueba `coordMax` (del kernel), arma lotes ≤200 aplicándolos en memoria con `authorDocument` para encadenar revisiones. No devuelve documento ni guarda estado.
- Pruebas: `test/fluyo-018-6.test.cjs` (Fluyo; golden `test/fixtures/fluyo-018-6-golden.json` compartido con fluyo-mcp), `test/fluyo-018-6-mutations.cjs`; fluyo-mcp `test/fluyo-018-6.test.ts`, `scripts/mutate-018-6.ts`.

## Aspecto, orden Z y duplicado (FLUYO-018.7a)

```text
Editor (themeSel/bgCustom · botones de orden · Ctrl+D/Ctrl+V) ─► ui.js / selection.js ─►  model.js: setThemeIn · reorderedNodeIds/reorderNodesIn · cloneStructureIn/duplicateNodesIn
                                                                                              ▲
MCP author_document (set_theme · reorder_nodes · duplicate_node) y las tools de una operación del mismo nombre ─► FluyoAuthoring ─► (mismas funciones) ─► FluyoIntegrity
```

- **Orden Z = posición en `page.nodes[]`** (no `order`, que es la animación `build`). Las conexiones se dibujan siempre debajo de todos los nodos: no tienen Z. `reorderNodesIn` conserva las identidades de los nodos y el orden relativo **del documento**; `changed:false` ⇒ el editor no crea entrada de Undo. El panel de selección múltiple no ofrece botones de orden (ni antes); la función admite varios nodos.
- **`setThemeIn(d,{theme?,customBg?})`**: parche idempotente (`doc.theme` ∈ `THEMES`, `doc.customBg` string; `null`→`""`). La regla HEX de `customBg` es de entrada de autoría. Sin Undo (el tema es del documento).
- **`cloneStructureIn` / `duplicateNodesIn`**: única autoridad de clonado (pegar, Ctrl+D y `duplicate_node`). Ids reservados en un bloque antes de mutar (todo o nada), nodos en el orden del documento y luego las conexiones internas; los Behaviors de los nodos copiados se copian; Steps, Historias y EventTypes no se tocan. `dupSel` ya no pasa por `copySel` (no pisa el portapapeles del sistema ni `clip`). Undo por snapshot previo (`pushUndoSnapshot`): si el dominio falla no queda entrada.
- **F1**: la ✕ de página vacía `undoStack`/`redoStack` (los snapshots identifican la página por índice). Hotfix mínimo; Undo por referencia a la página (y `delete_page`) es el release 018.7c.
- MCP: 16 tools. `set_theme`, `reorder_nodes` y `duplicate_node` existen como tools de UNA operación (llaman a `authorDocument` con la operación homónima) y como operaciones de `author_document` (lotes, refs de copias). `describe_document` publica `theme`, `customBg`, `capabilities.themes` y `z` por elemento.
- Pruebas: `test/fluyo-018-7a-f1.test.cjs`, `test/fluyo-018-7a.test.cjs` (caracterización de `pasteClip`/`dupSel`), `test/fluyo-018-7a-domain.test.cjs` (dominio, autoría, paridad editor↔MCP, golden compartido `test/fixtures/fluyo-018-7a-golden.json`), `test/fluyo-018-7a-mutations.cjs` (62), `test/fluyo-018-7a-browser.cjs` (Chrome real contra HEAD); fluyo-mcp: `test/fluyo-018-7a.test.ts`, `scripts/mutate-018-7a.ts` (33).
