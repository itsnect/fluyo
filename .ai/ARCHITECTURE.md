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
| `js/story-clock.js` | `FluyoStoryClock` (FLUYO-018.18): el reloj de una Historia —pausar, reanudar, saltar a un momento— sobre la misma receta. FLUYO-018.21: también el instante VISIBLE de cada momento (dependencias de llegada, `scenario.arrivalDependencies`; desde 018.22 la regla de validez está en `model.js` y aquí se reexporta). Puro y FUERA del kernel (fluyo-mcp no lo copia). Lo cargan el editor y el Viewer. FLUYO-018.29: saltar en pausa marca `revealAt` y `reveal(rs, playback)` enseña entero el momento (solo presentación, decisión 257). |
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
- `settings`: `{ speed, dots, build, stagger, grid, snap, font, single, skin? }`. `skin` (FLUYO-019.2) es opcional y de lista cerrada: solo se persiste `"built"`; ausente = plano (la normalización quita cualquier otro valor).

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
- fluyo-mcp: `src/layout.ts` expone `layoutPage(page)` (única adaptación página → `layeredLayout`, usada por `propose_layout`; hasta 018.10 también por `edit_diagram.relayout`, retirado); `src/propose-layout.ts` es la tool nº 13 (decisión 98): normaliza con el kernel, calcula, comprueba `coordMax` (del kernel), arma lotes ≤200 aplicándolos en memoria con `authorDocument` para encadenar revisiones. No devuelve documento ni guarda estado.
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
- **F1**: *(018.7a, sustituido en 018.7c)* la ✕ de página vaciaba `undoStack`/`redoStack` porque los snapshots identificaban la página por índice. Ver «Eliminar páginas y Undo estructural».
- MCP: 16 tools. `set_theme`, `reorder_nodes` y `duplicate_node` existen como tools de UNA operación (llaman a `authorDocument` con la operación homónima) y como operaciones de `author_document` (lotes, refs de copias). `describe_document` publica `theme`, `customBg`, `capabilities.themes` y `z` por elemento.
- Pruebas: `test/fluyo-018-7a-f1.test.cjs`, `test/fluyo-018-7a.test.cjs` (caracterización de `pasteClip`/`dupSel`), `test/fluyo-018-7a-domain.test.cjs` (dominio, autoría, paridad editor↔MCP, golden compartido `test/fixtures/fluyo-018-7a-golden.json`), `test/fluyo-018-7a-mutations.cjs` (62), `test/fluyo-018-7a-browser.cjs` (Chrome real contra HEAD); fluyo-mcp: `test/fluyo-018-7a.test.ts`, `scripts/mutate-018-7a.ts` (33).

## Eliminar páginas y Undo estructural (FLUYO-018.7c)

```text
✕ de la pestaña (ui.js) ─► requestDeletePage (selection.js): confirm(impacto) ─► Cancelar: nada
                                                                             └► Aceptar: scReset si hay Playback ─► deletePageIn ─► Undo {insertPage, page, index, curPage}
MCP author_document delete_page {pageIndex, expectedName} ─► FluyoAuthoring (índices estables del lote) ─► deletePageIn ─► pageMap
                       model.js: pageRemovalImpactIn · pageCurAfterRemoval · deletePageIn · restorePageIn
```

- **Dominio** (`model.js`): `pageRemovalImpactIn` (pura: nodos, conexiones, Behaviors, Historias con pasos y momentos, EventTypes que quedan sin uso), `pageCurAfterRemoval` (regla de `cur`), `deletePageIn` (`last_page`, `page_not_found`; devuelve el MISMO objeto página e `impact`; no toca EventTypes) y `restorePageIn` (reinserta ese objeto y conserva la página activa). Decisión 103.
- **Undo/Redo** (`selection.js`): entradas por referencia (`page`, `insertPage`, `removePage`); `applyHistoryEntry` aplica y devuelve la inversa; `stepHistory` la pasa a la otra pila. Ninguna entrada guarda un índice de página. Decisión 104.
- **Lotes** (`story-authoring.js`): `ctx.pages` = página de cada índice del lote (hueco `null` si se eliminó; `create_page` añade al final); `ctx.d` es siempre el documento vivo. `pageOf` resuelve por `ctx.pages` (`PAGE_DELETED`/`PAGE_NOT_FOUND`); `batchIndexOf`/`liveIndexOf`/`inBatch` traducen entre índices del lote y del documento (usos de EventTypes, validación final). `pageMap` solo si se eliminó alguna página. Decisión 105.
- MCP: operación `delete_page` en el schema de `author_document` (`expectedName` obligatorio), `pageMap` en la respuesta y en el resumen; sin tool nueva (16). `describe_document` sin cambios (decisión 106).
- `sw.js`: `CACHE` v64 → v65 (cambian `model.js`, `selection.js`, `ui.js`; sin archivos servidos nuevos).
- Pruebas: `test/fluyo-018-7c.test.cjs` (editor real: confirmación, Cancelar/Aceptar, Playback, Undo/Redo estructural y secuencias aleatorias contra un modelo), `test/fluyo-018-7c-domain.test.cjs` (dominio, autoría, lotes, integridad, documentos antiguos, paridad editor↔MCP y golden compartido `test/fixtures/fluyo-018-7c-golden.json`), `test/fluyo-018-7a-f1.test.cjs` (regresión permanente de F1, adaptada), `test/fluyo-018-7c-mutations.cjs` (45), `test/fluyo-018-7c-browser.cjs` (Chrome real contra HEAD); fluyo-mcp: `test/fluyo-018-7c.test.ts`, `scripts/mutate-018-7c.ts` (28).

## La biblioteca de EventTypes en Undo/Redo (FLUYO-018.7d)

- `selection.js`: `libSnap()` (mismos objetos EventType + copia de su contenido + `nextEventTypeId`) va en TODA entrada (`pageSnap`, `insertPage`); `stepHistory` captura la biblioteca actual para la inversa, aplica la entrada y, si aplica, `restoreLibrary` (contenido a los mismos objetos, array repuesto, contador sin bajar). Decisión 107.
- Las rutas de biblioteca del editor (`scSaveEventType`, `scDeleteEventUI`) no cambian: ya hacían `pushUndo()` antes de mutar. `model.js`, kernel y MCP sin cambios. `sw.js`: `CACHE` v66.
- Pruebas: `test/fluyo-018-7d.test.cjs`, `test/fluyo-018-7d-mutations.cjs` (12), `test/fluyo-018-7d-browser.cjs` (Chrome real); adaptados `fluyo-015-qa-browser.cjs` §11 y `fluyo-017-3-browser.cjs` §C.

## «Añadir como página» con su biblioteca (FLUYO-018.8)

```text
Share → Viewer → «Abrir en Fluyo» (#d=) ─┐
#d= de MCP · ?ejemplo= ─────────────────┴─► presentIncomingDocument ─► «Añadir … como página nueva» (incomingAsNewPage)
   └─► appendPagesFrom (state.js): documentFromProjectData ─► importPagesIn(doc, nd) (model.js) ─► doc.cur = primera añadida ─► Undo/Redo vacíos
```

- **Dominio** (`importPagesIn`, decisión 108): páginas al final + TODOS los EventTypes del entrante con ids nuevos del receptor (bloque reservado, todo o nada) y los `eventTypeId` de sus Steps remapeados; los Steps hacia un EventType que el entrante no define apuntan a un id reservado inexistente (el error previo se conserva). Devuelve `{pageIndex, pages, eventTypes:[{from,to}], unresolved:[{from,to}]}`; errores `invalid_document(pages|eventTypes|page|incoming)`, `id_exhausted`. No toca `doc.cur`, tema, fondo ni la identidad de las páginas/EventTypes del receptor; no conserva referencias al entrante ni lo modifica.
- **Editor**: `appendPagesFrom` solo navega (activa la primera página añadida), vacía `undoStack`/`redoStack` (decisión 109), `clearSel`/`renderTabs`; `incomingAsNewPage` sin cambios (autoguardado tras resolver). Sin aviso nuevo.
- Invariante de las Historias: cada Historia importada conserva su semántica exacta (EventType salvo el id, frase, `FluyoStory.stepMeta`, Trace); las del receptor no cambian; el documento combinado es válido si lo eran los dos.
- `sw.js`: `CACHE` v66 → v67 (`model.js`, `state.js`). Kernel sincronizado en fluyo-mcp (`kernelId` nuevo; ningún contrato MCP cambia).
- Pruebas: `test/fluyo-018-8.test.cjs` (dominio, editor real completo con `test/fluyo-018-8-harness.cjs`, flujo Share → `decodeDeepLink` → modal → «Añadir como página» en `vm`, paridad editor ↔ dominio, regresiones 018.7c/7d, aleatorio), `test/fluyo-018-8-mutations.cjs` (21), `test/fluyo-018-8-browser.cjs` (Chrome real, oráculo HEAD).

## create_diagram y create_from_template por el dominio (FLUYO-018.9)

```text
create_diagram ──────────┐  key → ref · nombre de color → HEX · auto-layout (layeredLayout) · input = nodes[i]/edges[j]
create_from_template ────┘  (la plantilla da la entrada de create_diagram)
   └─► documento en blanco del editor: projectToSerializable(doc, settingsFromProjectData({...settings, ...ajustes}))  (model.js)
       └─► rename_page · set_theme · create_node · create_connection ─► FluyoAuthoring.apply (lotes ≤ 200, encadenados por refs → ids)
           └─► documento v5 canónico (= author_document byte a byte, misma revision)
```

- Autoridad: el kernel (defaults, ids, reglas de entrada, auto-lazo, límites, nombres de página). `src/diagram.ts` solo adapta el contrato y traduce los errores (`input`, `key`, `requested` en los límites de conteo); el rechazo tiene la forma del de `author_document` y no devuelve documento (decisiones 110–112).
- Dominio: `createNodeIn` pone los defaults de `code` antes del spec (decisión 113). `sw.js`: `CACHE` v67 → v68 (`model.js`). Kernel sincronizado en fluyo-mcp (`kernelId` nuevo).
- Pruebas: Fluyo `test/fluyo-018-9.test.cjs` (createNodeIn + paridad con el editor real), `test/fluyo-018-9-mutations.cjs` (7), `test/fluyo-018-9-browser.cjs` (Chrome real: los `#d=` de las dos tools en el editor y el Viewer); MCP `test/fluyo-018-9.test.ts` (golden derivado del dominio `test/fixtures/fluyo-018-9-golden.json`, reglas, errores, plantillas, stdio), `scripts/mutate-018-9.ts` (30).

## Retirada de edit_diagram y enlace del resultado (FLUYO-018.10)

```text
author_document (y set_theme · reorder_nodes · duplicate_node) ─► FluyoAuthoring ─► documento final ─► openLink (link.ts) ─► editorUrl
create_diagram · create_from_template ─────────────────────────► documento v5 ──────► openLink (link.ts) ─► enlace en el resumen
propose_layout ─► solo lectura (lotes para author_document)          edit_diagram: retirada (sin handler, sin schema, sin builders)
```

- MCP: 15 tools (`server.ts`, `verify-deploy.sh`). Una sola codificación `#d=` (`openLink`; `buildOpenLink` es su envoltorio). `src/diagram.ts` queda con `parseDocument` (export_diagram) y los adaptadores de 018.9. Decisiones 114–116.
- Editor: solo documentación (`docs/index.html`, `README.md`); `CACHE` v69. Kernel sin cambios.
- Pruebas: MCP `test/fluyo-018-10.test.ts` (editorUrl, contrato, cobertura del sustituto, búsqueda estática, stdio), `scripts/mutate-018-10.ts` (20); Fluyo `test/fluyo-018-10.test.cjs` (docs ↔ contrato, CACHE), `test/fluyo-018-10-mutations.cjs` (9), `test/fluyo-018-10-browser.cjs` (Chrome real: author_document → editorUrl → editor; docs/ precacheada v69 y offline).

## Base táctil y móvil (FLUYO-018.12)

```text
              >1100 px                         ≤1100 px                          ≤700 px
cabecera  todo a la vista (order CSS)   ajustes y archivo → menú «Más»   + Exportar → «Más», Presentar → barra inferior
panel     columna fija, pestañas        columna fija, pestañas           hoja inferior: ⚙ (Propiedades) · Historias · Cerrar
                     openSurface / closeSurface / toggleSurface (ui.js) — la única puerta a las dos superficies
```

- `ui.js`: `placeChrome` (reubica los mismos nodos según `matchMedia`), superficies + `revealAboveSheet`, menú «Más» (enlaces del proyecto y Open Source), menú de la pestaña activa (`openPageMenu`: renombrar en línea, eliminar con `requestDeletePage`), `syncTouchBar`, `syncHistoryButtons`. El tramo `renderTabs` … «Modo presentación» lo copian los arneses de vm: ahí solo se declara.
- `interaction.js`: modos táctiles `touchLink`/`touchMulti` (`touchModes`), Undo de arrastre diferido al primer movimiento real (`drag.snap`), radios de acierto de esquinas y codos ampliados con dedo (sin cambio visual).
- `render.js`: `canvasDpr`/`resizeCanvas` (respaldo × densidad, tope 2) y una escala en `render()`; `editor-runtime.js` y `viewer.js` pasan la vista en px CSS + `dpr`. `editor-runtime.js` sincroniza Deshacer/Rehacer cada fotograma (solo escribe si cambia).
- `editor-scenarios.js`: solo dos marcas en `<body>` (`scPlaybackOn`, `scPlacing`) y revelar el diagrama al reproducir.
- `export.js`: «Ejemplo» en página nueva. `sw.js`: `CACHE` v70. Sin cambios en `model.js` ni `config.js` (kernel del MCP intacto). Decisiones 117–122.
- Pruebas: `test/fluyo-018-12.test.cjs` (precache, ids, cabecera, `renderTabs` en vm, DPR en vm, Ejemplo con el editor completo de 018.8), `test/fluyo-018-12-mutations.cjs` (18: 8 estáticas/vm + 10 en Chrome), `test/fluyo-018-12-browser.cjs` (Chrome real: 390/375/768 táctil y 1280/1440 ratón, 16 flujos; escritorio idéntico a HEAD; diferencias móviles frente a HEAD documentadas; DPR 2 en editor y Viewer).

## Sistema visual (FLUYO-018.13)

```text
index.html ── css/identity.css ── css/system.css ──────────── css/styles.css
              (compartido con      tipografías (@font-face local)  layout: cabecera, rail, marco del
               el Viewer)          tokens  --c-* → --surface…      lienzo, panel, páginas, menús,
                                   componentes: botones, campos,   responsive. Sin valores propios:
                                   pestañas, insignias, menús,     usa los tokens.
                                   tooltip, kbd, material inverso
s/index.html ─ css/identity.css ── css/share.css   (el Viewer NO carga system.css)
```

> Desde 018.14a el Viewer carga `identity.css` + `system.css` + `share.css`; desde FLUYO-SHELL-001 las páginas públicas cargan
> `identity.css` + `system.css` + `pages.css` (ver «Product Shell» al final).

- Dos capas: el chrome es papel hueso con tinta; el lienzo es la superficie de trabajo y su tema es del documento (`doc.theme`, `config.js`, sin cambios). El chrome lo enmarca (`.stage` + `#wrap`: aire, filete de tinta, radio, sombra interior); en ≤700 px va a sangre.
- Tokens: primitivas `--c-*` (hueso, tinta, oliva, terracota, grafito, piedra) → semánticos (`--surface*`, `--ink*`, `--rule*`, `--active*` = oliva, `--attention*` = terracota, `--font-serif`, `--font-mono`, `--fs-*`, `--r-*`, `--ctl-h` de 30 px que pasa a 40 px con `pointer:coarse`). Los nombres de `identity.css` (`--bg`, `--panel`, `--text`, `--muted`, `--accent`…) se redefinen sobre los tokens: Historias y los diálogos pasan al sistema sin reescribirse.
- Componentes: `button` secundario por defecto, `.btnGhost`, `.primary` (terracota), `.iconBtn`, `.danger`; campos mono; casillas como interruptor (`.row`, menú «Más»); `.tabs`; `.badge`; `.menu`/`.menuSection`/`.menuKicker`/`.menuItem` (también `.scPopover` y `.moreMenu`); `[data-tip]`; `.inverse` (mando y rótulo de Present, también por id porque `present-story.js` reescribe el `className` del mando).
- La cabecera de la app se selecciona como `body > header`: Historias y los diálogos tienen sus propios `<header>`.
- Iconos: sprite `<symbol id="i-…">` en `index.html` (trazo 1,6 sobre 24, tamaño `--ic`). Lo generado desde JS sin markup (✕ ▾ ＋ de las pestañas de página) conserva el glifo como texto y se pinta con máscaras CSS (`--mask-*`).
- Lienzo: `render.js` pinta las marcas del editor (selección, tiradores, marco de selección, vista previa de conexión, flechas de los lados) con `editorMark(theme)` (oliva por tema). El diagrama (formas, radios, trazos, texto) no cambia: lo comparten lienzo, SVG exportado y Viewer.
- `ui.js`: `syncSelMeta` (metadato de la selección junto al título del panel), `zoomTo`/`zoomBy`/`syncZoomReadout` (controles de vista en la barra inferior, solo >700 px; `editor-runtime.js` sincroniza la lectura) y `togglePlay`, que cambia solo la palabra. `placeChrome` no cambia.
- `sw.js`: `CACHE` v71; `css/system.css` y las tres fuentes en el núcleo del precache. Sin cambios en `model.js`, `config.js` ni `identity.css` (en 018.14a `config.js` cambia: ver la sección siguiente). Decisiones 123–127.
- Pruebas: `test/fluyo-018-13.test.cjs` (fuentes y licencias, precache, tokens, sprite, cabecera, alcance), `test/fluyo-018-13-browser.cjs` (Chrome real: 1440/1280 ratón, 1024/768/390/375 táctil; fuentes sin terceros, tokens en superficies, una fila, objetivos táctiles, menú, panel, páginas, vista, barra táctil, Present, SW offline) y `test/fluyo-018-13-mutations.cjs`.

## Viewer, tipografía y nodos `code`/BD en el sistema (FLUYO-018.14a)

```text
js/config.js (kernel) ── FONTS (+ Playfair Display, IBM Plex Mono antes de «Mono») · THEMES.code* (respaldos de code)
        │                         └─ fluyo-mcp: sync:config → src/generated/config.ts · sync:kernel → KERNEL_ID nuevo
js/geometry.js ── codeColors · codeFont · codeTokenWeight · cylinderGeom/cylinderSegments/segmentsToSVGPath
        ├─ js/render.js  (lienzo del editor y del Viewer: drawNode, drawCodeNode, shapePath)
        ├─ js/export.js  (SVG de la app)
        └─ fluyo-mcp src/svg.ts (port; el test de paridad carga geometry.js real y compara)
```

- **Cilindro**: una sola geometría de arcos reales (`cylinderSegments`). El contorno (lateral, media elipse inferior, lateral, media elipse superior trasera) se rellena y se traza; el labio es la otra mitad de la misma elipse superior. El lienzo la recorre con `traceSegments` y el SVG con `segmentsToSVGPath`. `shapePath` también la usa, así que el resaltado de Historias abraza el cilindro. Caja, anclajes, acierto y etiqueta no cambian.
- **`code`**: el panel por defecto es el tinte del color del nodo (como `fillFor`). Los respaldos del bloque, el texto y la palabra clave viven en `THEMES.code*` (`codeKwBg:""` = sin caja). La palabra clave se marca con peso 500 (`codeTokenWeight`). Sin `font` propio, el bloque usa IBM Plex Mono (`codeFont`), cuya pila acaba en «Mono». Los valores explícitos del nodo mandan siempre. La maquetación (`codeBlockLayout`) no cambia.
- **Fuentes del lienzo**: `renderFontStacks`/`waitForRenderFonts` (`render.js`) dicen qué pilas usa el documento (global, nodos, conexiones y la del bloque `code`) y esperan a `document.fonts.load`, con un tope de tiempo. Las usan el Viewer (antes del primer render) y la exportación GIF/PNG/JPG (antes de rasterizar). El SVG lleva la pila con su reserva.
- **Viewer**: `s/index.html` carga `identity.css` + `system.css` + `share.css` y precarga la mono. El sprite se oculta con una clase (la CSP no admite `style` inline). La cabecera va en una fila y la Historia es una tarjeta de lectura. El mando de Present usa el material inverso. Los textos con glifo de la Historia (`▶ Reproducir historia`, `↻ Repetir`) los escribe `viewer.js` y no cambian.
- `sw.js`: `CACHE` v72. `model.js` y el formato no cambian. Decisiones 128–130.
- Pruebas: `test/fluyo-018-14a.test.cjs` (contrato `FONTS` y diff de `config.js` frente a HEAD, documentos con fuentes históricas, respaldos y datos explícitos de `code`, geometría del cilindro, uso compartido en lienzo/SVG, espera de fuentes, Viewer CSP-safe), `test/fluyo-018-14a-browser.cjs` (Chrome real, 5 viewports × oscuro/crema: tapa de la BD por píxeles en lienzo, SVG y Viewer; cian 0; cajas verdes solo con `kwBg`; Plex cargada; selector; reabrir; Viewer; exportar espera a las fuentes) y `test/fluyo-018-14a-mutations.cjs`. En fluyo-mcp: paridad de `codeColors`, `codeFont`, `codeTokenWeight` y `cylinderSegments` en `test/visual-regression.test.ts`, y la salida de `pageToSVG` en `test/render.test.ts`.

## Modo Historia, panel por grupos, cabecera e interfaz oscura (FLUYO-018.14b)

```text
estado                 dónde                                         ¿se guarda?
documento              doc / settings (model.js, state.js)            .fluyo.json · autoguardado · #d=
interfaz (preferencia) localStorage["fluyo.ui.theme"] → <html data-ui-theme>   no (solo este navegador)
modo de trabajo        uiMode (ui.js) → body.storyMode                no
superficies            body.panelOpen · body.storyExpanded · <details open>     no
Historia               scActiveId · scStatus · scPlayback (editor-scenarios.js) no
```

- **Modo** (`ui.js`): `setUiMode("edit"|"story")` es la única puerta; `switchPanelTab`, `openSurface`, `toggleSurface`, el conmutador de la cabecera, `#btnStories` y «Volver a editar» (`exitStoryMode`) pasan por ella. `activeSurface()` deriva de `uiMode`. Salir detiene la Historia. En modo Historia el rail no se ve (CSS) y la tecla C no arma «Conectar» (`interaction.js`).
- **Cabecera**: `#modeSwitch` (`.seg`), `#btnCanvas` → `#canvasMenu` (`#canvasTools`: ajustes del documento), Exportar/Compartir/Presentar y «Más» (`#moreTools` > `#hdrTools`: Archivo; `#uiSection`: interfaz; enlaces). `placeChrome` mueve en móvil Exportar a Archivo, `#canvasTools` a «Más» y Presentar a la barra inferior. Menús con la misma política (fuera/Escape/acción los cierran; selectores y casillas no).
- **Panel**: `#rowLabel` arriba y grupos `details.pgroup` (`system.css`); `syncPanelGroups` (al final de `refreshPanel`) oculta grupos sin filas y gestiona «Más colores» (`syncSwatchMore`); `applyGroupDefaults` aplica los abiertos por defecto según la anchura; en la hoja móvil, acordeón. 288 px (> 1024), 216 (tableta); Historias 320 (escritorio), 300 (tableta), 352 (≥ 1600).
- **Hojas** (≤ 700 px): `#propSheetHead` (título + `#btnPanelClose`), toque en el vacío del lienzo (`sheetTapOutside`), Historias compacta/ampliada (`setStoryExpanded`, `#btnStoryExpand`; `scSyncCompact` pasa la biblioteca a paleta flotante en la altura compacta).
- **Historias** (`editor-scenarios.js`, solo UI): `scGlyphText` (glifo como `.glyph` sin cambiar el texto), `scRenderNow` (bloque `#scNow` con `FluyoStory.describe`), marcas con `data-mark`, «Terminar», `scSyncCompact`. Sin cambios de semántica, Steps, Trace ni Playback.
- **Interfaz oscura**: `:root[data-ui-theme="dark"]` en `system.css` redefine todos los semánticos y los tintes tokenizados; `applyUiTheme`/`setUiTheme` (`ui.js`) y el script del `<head>`. El lienzo, el Viewer y la exportación no lo leen.
- `sw.js`: `CACHE` v73 (sin archivos servidos nuevos). `model.js`, kernel, formato, `render.js`, `viewer.js`, `config.js` y MCP sin cambios. Decisiones 131–139.
- Pruebas: `test/fluyo-018-14b.test.cjs` (alcance, tokens del oscuro completos, separación de temas, cabecera, inventario del panel, modo, hojas y transporte en vm), `test/fluyo-018-14b-browser.cjs` (matriz de Chrome real: 1440/1280/1101/768/390/375 × interfaz clara/oscura × lienzo oscuro/crema × editor/panel/Historia/reproduciendo; persistencia; SW v73) y `test/fluyo-018-14b-mutations.cjs`.

## Color del documento (FLUYO-018.15)

```text
qué                                   valor                         dónde                      alcance
nodo nuevo sin color                  DEFAULT_NODE_COLOR #857F6C    config.js → createNodeIn    kernel (editor + MCP)
nodo guardado sin color (histórico)   PALETTE[0].c #6a9fb5          normalizeProjectNode        kernel; nunca cambia
«Servicio» y la paleta                PALETTE (14, sin cambios)     config.js                  datos; list_colors
activo (selección, colocar, Resaltar) activeMark(theme): oliva      render.js (EDITOR_MARK)     editor · Present · Viewer
evento en tránsito                    FLOW_ACCENT #d08b5b           render.js                   editor · Present · Viewer
```

- El color de un nodo es dato: trazo, tinte del relleno (`fillFor`), texto de un nodo `text`/`anim`, puntos de flujo que salen de él (`e.dotColor||A.color`) y brillo del pulso. El render no lo reinterpreta: editor, Viewer, SVG (`export.js`) y `export_diagram` (`fluyo-mcp/src/svg.ts`) dibujan el mismo valor. El tinte lo lee `colorTint` (019.5, decisión 207).
- `ui.js`: la rejilla de color del nodo empieza por «Piedra (por defecto)». `interaction.js`: la herramienta de animaciones crea con `DEFAULT_NODE_COLOR`.
- Los respaldos de `drawAnim`/`colHex` (`render.js`) son `PALETTE[0].c`, el mismo respaldo histórico de la normalización. Desde 019.5, `colHex` es `nodeTint`, con el mismo respaldo.
- `sw.js`: `CACHE` v74. Formato sin cambios. Kernel: `config.js` (constante nueva) y `model.js` (una línea); fluyo-mcp sincronizado (`KERNEL_ID` `cbb6ec00…`). Decisiones 140–142.
- Pruebas: `test/fluyo-018-15.test.cjs` (contrato del default, alcance de `model.js`, compatibilidad de ejemplos y fixtures, render sin cian), `test/fluyo-018-15-browser.cjs` (Chrome real: 1440/1280/1101/768/390/375 × interfaz clara/oscura × lienzo claro/crema/oscuro; editor, Historia real, SVG, Viewer) y `test/fluyo-018-15-mutations.cjs`. Fixture compartido con fluyo-mcp: `test/fixtures/fluyo-018-15-colores.json` (allí, `test/fluyo-018-15.test.ts` y `scripts/mutate-018-15.ts`).

## Conexiones (FLUYO-018.16)

```text
qué                         dónde                                  superficies
ruta (anclas, carriles)     geometry.js edgePoints (sin cambios)   todas; port en svg.ts
trazo + puntas              geometry.js edgeStroke → segmentos     lienzo (traceSegments), SVG (segmentsToSVGPath), svg.ts (port)
funda de selección          render.js EDITOR_MARK.sleeve           solo editor
instrumentos de edición     render.js drawEdge (px de pantalla)    solo editor
puerto de conectar          geometry.js connectPortPoint;          solo editor, solo ratón
                            render.js drawConnectPort;
                            interaction.js hitSideArrow
origen de «Conectar»        render.js drawLinkOrigin (linkFrom)    solo editor, barra táctil
```

- `edgeStroke(e, pts)` devuelve `{line, heads}` con operaciones `M/L/Q/Z`; `traceSegments` y `segmentsToSVGPath` entienden `Q`. Constantes `EDGE_W`, `EDGE_CORNER`, `EDGE_GAP`, `EDGE_HEAD_*` y `CONNECT_PORT_*` en `geometry.js` (no son kernel: el MCP las porta y la paridad las compara).
- `arrowHostNode()` (`selection.js`) es el nodo bajo el ratón; `null` con el dedo. Aciertos de arista, extremos, codos y tramos en px de pantalla (`interaction.js`), nunca menores que antes.
- El SVG ya no lleva `<defs>` de marcadores: cada conexión es un `<path>` de trazo (`stroke-width="1.5"`) y una `<path>` rellena por punta.
- `sw.js`: `CACHE` v75. Formato, modelo y kernel sin cambios. Decisiones 143–145.
- Pruebas: `test/fluyo-018-16.test.cjs` (geometría en vm, contratos de render/interacción/export), `test/fluyo-018-16-browser.cjs` (Chrome real: 6 viewports × interfaz clara/oscura × 3 lienzos; normal, selección, instrumentos, acierto a zoom bajo, conectar con ratón y con dedo, SVG = golden del MCP, Viewer, Historia) y `test/fluyo-018-16-mutations.cjs`. Fixtures compartidos con fluyo-mcp: `test/fixtures/fluyo-018-16-conexiones.json` y `fluyo-018-16-conexiones-svg.json` (allí, `test/fluyo-018-16.test.ts`, la paridad de `edgeStroke` en `visual-regression.test.ts` y `scripts/mutate-018-16.ts`).

## Historias como superficie temporal, panel como hoja y touch (FLUYO-018.17)

```text
estado de la hoja (móvil ≤ 700 px)   closed | compact | expanded | playing   ← storyState() derivado (ui.js) → body[data-story]
compacta   (≈ 125 px)   Historia ▾ · ⋯ · Ampliar / Reproducir · Volver a editar            lienzo ≥ 70 %
ampliada   (auto ≤ tope) + fichas de eventos (carril) + línea de tiempo (único desplazable)  lienzo ≥ max(300px, 40dvh), útil
reproduciendo (≈ 135 px) Momento en curso · Ampliar / Detener · Volver a editar              lienzo ≥ 70 %, destino activo a la vista
zona libre              visibleCanvasRect() = lienzo − hoja − barra táctil − barra de colocación   (única definición)
```

- `ui.js`: `storyState`/`syncStoryState` (se llama desde `setUiMode`, `openSurface`, `closeSurface`, `setStoryExpanded`, `placeChrome` y, vía `syncStoryState` global, desde `scRenderButtons`); `visibleCanvasRect`; `revealAboveSheet` con `REVEAL_MIN_ZOOM` 0,6 y objetivo «paso» (`scStoryFocusPoint`, editor-scenarios.js); `sheetTapOutside` reduce la ampliada solo en el vacío (`hitNode`/`hitEdge`, nunca colocando); `diagramCut` + reencaje en `setUiMode` (columna); `placeChrome` mueve `#grpAnim` → `#animSection` y `#grpHelp` → `#helpSection` de «Más» en móvil (hogares `#grpAnimHome`/`#grpHelpHome` para volver); ⚙ contextual en `refreshPanel`/`placeChrome`; «Conectar» oculto en modo Historia (`syncTouchBar`). `mqSheet`, `uiMode` e `isSheetLayout` viven al principio del archivo.
- `editor-scenarios.js`: `scFollowActive` (desde `scTick`), `scScrollIntoView` (solo el contenedor desplazable más cercano; sustituye a los `scrollIntoView` de colocar/aplicar/crear evento), `scVisibleRect`/`scTargetOffscreen` (nodo entero)/`scRevealTarget(step, rerender)`/`scStoryFocusPoint`; `scRenderButtons` oculta `#scPaletteToggle` reproduciendo, escribe `data-sc-status` en `#panelScenarios` (el CSS oculta «Terminar» en la hoja terminada) y enseña `#scRunHint` («Añade eventos desde Ampliar») en la hoja sin pasos; `scRun` recoge la ampliada; `scNotice` se coloca encima de la hoja o de la barra de colocación; `scSyncCompact` ya no decide por la hoja. Semántica de Steps, Trace y Playback sin cambios.
- `css/styles.css` (≤ 700 px): `--canvas-useful`; `aside.scenariosOpen{height:auto; max-height:…; overflow:hidden}`; `.scHeader` como rejilla de dos filas con las envolturas en `display:contents`; estados por `body[data-story]`; fichas (`#scLibrarySection` en fila); `.scStoryboardSection` único desplazable; hoja de Propiedades `clamp(220px, 40dvh, 360px)`; una fila de muestras; barra de páginas (índices, nombre con `@container`, «＋» sticky); `#scPlacementBar button` a tamaño de control. `css/system.css`: `--ctl-h-touch` 44, `--row-h-touch` 40, campos a 16 px con `pointer:coarse` (al final del archivo).
- `index.html`: `#scRunHint`, `#animSection`, `#helpSection`, `#grpAnimHome`, `#grpHelpHome`; todos los ids anteriores se conservan (`#scStoryAdd` y `#scReset` siguen en el DOM; en la hoja los oculta el CSS). `docs/index.html` explica los cuatro estados.
- `sw.js`: `CACHE` v76. `model.js`, `config.js`, kernel, `render.js`, `geometry.js`, `export.js`, `interaction.js`, Viewer, Share y Present sin cambios (test de alcance contra HEAD). Decisiones 146–151.
- Pruebas: `test/fluyo-018-17.test.cjs` (alcance, CACHE, ids, CSS de estados y touch, `ui.js`/`editor-scenarios.js`, docs; vm: paleta/estado/pista con el editor de Historias real), `test/fluyo-018-17-browser.cjs` (Chrome real: 1440/1280/1101 ratón, 768 tableta, 430/390/375 móvil, 844×390 apaisado; interfaz clara con lienzo oscuro y oscura con crema; fixture de 4 nodos y uno de 12 que no cabe a zoom 0,6: lienzo visible y **útil** por estado —zona libre, destino entero y legible, desplazable, tocable—, un solo desplazable, salida visible en los cuatro estados y tras colocar, seguimiento del paso activo, Propiedades, M1–M3, reencaje, páginas, SW v76 sin red) y `test/fluyo-018-17-mutations.cjs`.
- Revisión manual (misma tarea): `syncRail` devuelve siempre un booleano a `classList.toggle` (decisión 153); el manejador de `#themeSel` escribe `{theme, customBg:""}` y `syncProjectControls` enseña el fondo del tema en `#bgCustom` cuando no hay color propio (decisión 152; `js/state.js` una línea). El selector de sentido de los puntos de una conexión (`#flowSel`, `flowDir` normal/reverse/alternate) sigue existiendo en el grupo «Flujo» del panel, plegado por defecto desde 018.14b (ver la tarea, deuda para 018.18).

## Contar una Historia en cualquier superficie (FLUYO-018.18)

```text
FluyoStory.start / FluyoScenarioPlayback.tick   (kernel, sin cambios: funciones puras del reloj que reciben)
        ▲ el tiempo que ven lo decide ─── FluyoStoryClock (js/story-clock.js, NO kernel)
        │                                  now · pause · resume · momentTimes · momentIndex · prevTarget · nextTarget · seek(i)
   ┌────┴───────────────────┬──────────────────────────────┐
 Editor (editor-scenarios)  Present (present-story → las   Viewer (viewer.js: story.clock)
 scClock · scNow()          mismas scPause/scSeek… del     storyTogglePause · storySeek
 scPause/scResume/          editor)                        band = transporte de alto fijo;
 scSeekMoment/scSeekStep                                   #stNow = rótulo sobre el lienzo
 #scNow sobre el lienzo (scPlaceNow, cada fotograma)
```

- **Reloj**: «en pausa» no es un `scStatus` nuevo (sigue `running`); es el reloj congelado. Saltar a un momento vuelve a ejecutar la misma receta con el origen desplazado (`FluyoStory.start(page, sc, ahora − at)`) y proyecta hasta ese instante: el estado es el de una reproducción continua (test en vm). La unidad es el **momento** (`storyboardGroups`), nunca el Step. Ni el documento ni Undo se tocan.
- **Transporte** (mismas palabras en las tres superficies): Reproducir · Pausar/Reanudar · momento anterior/siguiente · Detener · Repetir. «Detener» sustituye a «Terminar» en cualquier estado. Editor: `#scPrev #scRun #scPause #scNext` + `#scReset` (envoltura `.scTransport`; en la hoja móvil, fila A = transporte, fila B = Detener · Volver a editar). Present: `#psGroup` (Historia) y `#prPages` (páginas) separados, una salida `#prExit`; tocar el lienzo no hace nada. Viewer: `#stActions` en la banda y, presentando, dentro de `#prStory`.
- **Rótulo del momento** (`#scNow` en `#wrap`; `#stNow` en el Viewer): una línea de alto fijo en material inverso; arriba de la zona libre o, si el destino del momento (elementos y los dos extremos de sus conexiones) queda debajo, al pie (`scPlaceNow`/`storyPlace`). Saltar enseña el momento entero (`scRevealMoment`: centra su caja si cabe; si no, su primer elemento).
- **Viewer**: encaja después de colocar la banda y el rótulo y vuelve a encajar al cambiar el tamaño del lienzo si nadie movió la vista (`ResizeObserver`, `viewMoved`); en apaisado corto sin «Hecho con Fluyo»; en el teléfono, selector de página (`#pgSelect`) y sin −/+ con dedo.
- **Páginas**: sin ✕ en las pestañas; ▾ de la activa con cualquier puntero (Renombrar en línea, Eliminar página → `requestDeletePage`); el doble clic abre el mismo renombrado (sin `prompt`). ≤ 700 px: `.pgSelect` abre la lista (`openPageMenu(i, anchor, {list:true})`) con «＋ Nueva página». `revealActiveTab` mantiene la activa a la vista.
- **Dirección**: «Trazo › Dirección» = Puntas (`startArrow`/`endArrow`) + Puntos en movimiento (`animated`) + Sentido (segmentado sobre `#flowSel` → `edge.flowDir`). El grupo de ajuste fino pasa a llamarse «Puntos» (`#grpFlow`, plegado). Mismos datos y valores.
- `sw.js`: `CACHE` v77 y `js/story-clock.js` en el precache. `model.js`, `config.js`, kernel, `render.js`, `geometry.js`, `export.js` y MCP sin cambios (test de alcance contra HEAD). Decisiones 154–161.
- Pruebas: `test/fluyo-018-18.test.cjs` (alcance, release, reloj en vm frente a una reproducción continua, editor real en vm, Viewer en vm, páginas, dirección), `test/fluyo-018-18-browser.cjs` (Chrome real: 1440/1280 ratón, 768 dedo, 390/375 móvil, 844×390 y 812×375 apaisado; editor, Present, Viewer, páginas, dirección; SW v77 sin red) y `test/fluyo-018-18-mutations.cjs`.

## Teléfono en apaisado, diálogo de evento y crear → colocar (FLUYO-018.19)

```text
layout                     condición                                                 hojas
escritorio / tableta       por anchura (> 700 px) o ratón                           columna (sin cambios)
teléfono vertical          max-width: 700px                                          inferiores (018.17)
teléfono apaisado          landscape · max-height 500px · pointer coarse (mqSide)    LATERALES (derecha); reproducir = franja inferior
                           isSheetLayout() = mqSheet || isSideSheet()  ·  isSideSheet() = mqSide
```

- `ui.js`: `mqSide`/`isSideSheet()` al principio; `placeChrome` sube `#pagesBar` (tras `#hdrHistory`) y `#modeBar` (antes de `#btnShare`) a la cabecera en apaisado y los devuelve a `#bottomBar`; `body.sideSheet`; `sideStrip()` y `visibleCanvasRect()` con `left/right` (hoja lateral por la derecha, franja por abajo, hoja apartada colocando); `placePageMenu` abre debajo si no cabe encima; `refitOnRotate` (resize + `pointer: coarse`).
- `editor-scenarios.js`: `scEventDialogMode` (create/edit/duplicate); `scSaveEventType` → `scBeginPlacement` con `origin:"created"` al crear; `scCoarsePointer()` para los textos; `scPlacementTouchPan`/`scCanvasPlacementTap` (colocar con el dedo); `scResolveDrop(…, touch)` no cancela en el vacío con el dedo; `scNotice` a la izquierda de la hoja lateral; `scPlaceNow` centrado en la zona libre y con posiciones laterales; «Cómo se ve» (`scFlowLookSummary`, vista previa movida al plegable activo); Intro en `#scEventName`.
- `interaction.js`: un gancho en `pointerdown` (colocando con el dedo → `panDrag.placing`) y otro en `pointerup` (toque ≤ 8 px → `scCanvasPlacementTap`).
- `css/styles.css`: el bloque «Móvil» rige también en apaisado táctil; al final, el bloque del diálogo (018.19) y el del apaisado (cabecera de 48 px, sin `#bottomBar`, rail desplazable, hojas a la derecha, franja de reproducción, rótulo ≤ 60 %).
- `index.html`: el diálogo con «Cómo se ve» (`#scFlowLook` como `<details>`, la vista previa dentro), sin subtítulo visible, ✕ del sprite y efectos sin glifos; ids conservados.
- `sw.js`: `CACHE` v78 (sin archivos servidos nuevos). `model.js`, formato, kernel, `story-clock.js`, render, Viewer, Share, Present y MCP sin cambios (test de alcance contra HEAD). Decisiones 162–167.
- Pruebas: `test/fluyo-018-19.test.cjs` (alcance, release, crear → colocar con el editor real en vm, colocar con el dedo, diálogo, apaisado, zona libre y reencaje en vm), `test/fluyo-018-19-browser.cjs` (Chrome real: 390×844, 375×812, 844×390, 812×375, 667×375 y 768×1024 con dedo, 1440×900 con ratón; giro; SW v78) y `test/fluyo-018-19-mutations.cjs`.

## Dependencias de llegada (FLUYO-018.21)

```text
documento:  scenario.arrivalDependencies = [{ stepId, waitsForArrivalOf: [sendStepId…] }]   (opcional, aditivo; ausente = ninguna)
motor/Trace: no lo ven (FluyoStory.run igual)        model.js: lo conserva tal cual (normalizeScenarios no lo toca)
model.js (018.22, kernel): arrivalDependencies (validar) · arrivalCandidates · prune/with/copy (forma canónica)
story-clock.js: reexporta la regla → schedule (instante visible por momento) → start = FluyoStory.start + copia del Trace
editor · Present · Viewer: FluyoStoryClock.start / momentTimes(sc, playback) / describe / visibleAt
```

- **Semántica**: «este momento no empieza hasta que llegue este envío». El dato es de la HISTORIA, no del Step (el esquema del Step y el motor rechazan campos extra: `validatePersistedStep`, `invalid_scenario/extra_fields`). Se declara desde un Step; su efecto es el MOMENTO entero (atómico: espera la unión de las dependencias de sus Steps).
- **Validez** (se comprueba al reproducir; lo inválido se ignora, nunca bloquea ni invalida): el Step existe y cada id es un `SEND` de la misma Historia en un momento ANTERIOR (`at` estrictamente menor). Razones: `malformed`, `step_missing`, `send_missing`, `not_send`, `not_earlier`. Sin ciclos posibles: una sola pasada.
- **Instante visible (E2)**: `visible(k) = max(at(k) + pausa(k−1), llegada de cada envío del que dependa k)`, `pausa(k) = visible(k) − at(k)`, `llegada(e) = visible(momento de e) + MOTION_MS[motion]` (la misma duración del Playback). Lo anterior nunca se mueve; lo posterior conserva su ritmo. Sin dependencias, visible = `at` y no se copia el Trace (reproducción idéntica a la anterior).
- **Reproducción**: `FluyoStoryClock.start` = `FluyoStory.start` (receta única) + `playback.schedule` + `playback.trace` = copia con `at` visible y `narrativeAt` (solo si algo se desplaza). `momentTimes(sc, playback)` da los visibles (navegación, progreso, salto); sin playback, los narrativos (identifican el momento de un Step). `describe` recalcula el momento en curso con los visibles. `seek` usa los visibles.
- **Editor** (`editor-scenarios.js`): menú de la aparición › «Esperar a que llegue…» (solo envíos válidos anteriores, primero los que llegan a donde ocurre el evento; «No esperar»); la línea de tiempo pone en el momento «No empieza hasta que llegue «…» (origen → destino)» (`.scWaits`); eliminar un Step limpia las dependencias que lo nombran; duplicar copia la espera; todo con `pushUndo` (el snapshot de página ya incluye las Historias). Estado de las filas, seguimiento, rótulo y ⏮/⏭ por instantes visibles (`scVisibleAt`).
- **Compatibilidad**: el editor actual, el motor, `FluyoIntegrity`, `FluyoAuthoring` (MCP), duplicar Historia, Undo y «Compartir historia» conservan el campo; el MCP lo crea y modifica desde 018.22 (sección siguiente). Kernel, `model.js`, render, formato (`version` 5, `engineVersion` 2) sin cambios. `CACHE` v79.
- Pruebas: `test/fluyo-018-21.test.cjs` (vm: casos 1–7, varios envíos, Trace, salto, formato/MCP/Share, autoría, editor con Undo real, Viewer, Present, alcance), `test/fluyo-018-21-browser.cjs` (Chrome dirigido, ≤ 1 min) y `test/fluyo-018-21-mutations.cjs`.

## Dependencias de llegada en el MCP (FLUYO-018.22)

```text
fluyo-mcp author_document ── FluyoAuthoring (story-authoring.js, kernel) ── arrivalCandidates / withArrivalWaits / prune / copy (model.js, kernel)
editor · Present · Viewer ── FluyoStoryClock (story-clock.js, NO kernel) ── reexporta las mismas funciones de model.js + reloj/horario visible
```

- **Operaciones**: `add_step {waitsForArrivalOf}` y `set_arrival_dependencies {stepId, waitsForArrivalOf}` (reemplaza; `[]` borra). Lo escrito se valida con `arrivalCandidates` y lo inválido se rechaza (`INVALID_ARRIVAL_DEPENDENCY`: `send_missing`, `not_send`, `not_earlier`, `self`, `cycle`, `other_story`). Lo ya almacenado no se revalida.
- **Integridad**: `remove_step` → `pruneArrivalDependencies` (+ `cascade.arrivalDependencies`); `duplicate_step` → `copyArrivalWaits` (solo válidas; no redirige); `duplicate_story` copia literal (ids de Step por Historia); `move_step`/`set_wait` conservan el dato y avisan (`warnings: ARRIVAL_DEPENDENCY_INACTIVE`).
- **Lectura**: `describe_document` expone lo almacenado (`arrivalDependencies`), lo inactivo (`inactiveArrivalDependencies`) y lo que aplica (`waitsForArrivalOf` por paso, `waitsFor` por momento). `run_story`/Trace sin cambios.
- **Kernel**: `story-clock.js` NO entra (`KERNEL_FILES` igual; cambia el contenido de `model.js` y `story-authoring.js`, nuevo `KERNEL_ID`). `CACHE` v80 (`model.js` y `story-clock.js` son servidos).
- Pruebas: `fluyo-mcp/test/fluyo-018-22.test.ts` (33: API, validación, remove/duplicate, describe, paridad con el editor, reproducción, Share), `fluyo-mcp/scripts/mutate-018-22.ts` (23 mutaciones) y `test/fluyo-018-22.test.cjs` (regla en `model.js`, reexport, integración, release).

## Panel de Propiedades: solo la selección (FLUYO-018.23)

```text
cabecera de la selección (#propSheetHead)  nombre · TIPO · ID | Orden ▾ (#rowZ: #btnFront/#btnForward/#btnBackward/#btnBack) · Eliminar (#btnDel) · plegar/cerrar (#btnPanelClose)
contenido (#rowLabel)                      Texto · en un code «Código» (5 líneas, mono)
nodo / code                                ▾ Apariencia (#grpShape) · ▾ Texto (#grpText) · ▸ Código (#grpCode, solo code) · ▸ Movimiento (#grpLayers)
conexión                                   ▾ Trazo (#grpStroke) · ▾ Dirección (#grpRoute) · ▸ Puntos (#grpFlow) · ▸ Texto (#grpText, movido al final)
fuera del panel                            Animación del lienzo → «Lienzo» (#grpAnimHome en #canvasMenu; «Más» en móvil) · Atajos → «Más › Ayuda y gestos»
```

- **Un solo panel** (`#panelProperties`) para columna (288/216), hoja inferior y hoja lateral: mismo DOM, mismos grupos, mismo orden, mismos ids. Cambian el contenedor, los objetivos (`--ctl-h`, `--sw-size` 24/32) y qué grupos empiezan abiertos (`applyGroupDefaults(kind)`: primarios del tipo en columna, todo plegado en la hoja). `refreshPanel` sigue siendo la única lectura de la selección; `placePanelRows(kind)` mueve los mismos nodos (Texto al final en una conexión; `#rowTextColor`/`#rowTextBg` a Código en un code) y `applyGroupDefaults` solo actúa al cambiar de tipo. Ruta, Puntas y Línea del borde van en línea con su etiqueta (`.inlineSeg`) y se apilan con `@container` (< 240 px).
- **Segmentados** (`segBind`/`segSync`/`segOnSelect`, `ui.js`): radiogroup con tabindex móvil y flechas/Inicio/Fin/Espacio; el valor vive en el control nativo oculto (`#shapeSel`, `#borderSel`, `#langSel`, `#routeSel`, `#flowSel`, `#speedFacSel`, `#arrowSizeSel`), que dispara su manejador de siempre. Puntas: `#arrowSeg` (Ninguna · Inicio · Fin · Ambas) escribe solo el booleano que cambia (`startArrow`/`endArrow`) con un Undo; `#arrSChk`/`#arrEChk` siguen reflejándolo. Tamaño de flecha (FLUYO-018.27): `#arrowSizeSeg` (1× · 1,5× · 2×) escribe `edge.arrowSize` con un Undo y se oculta sin puntas.
- **Color de una fila** (`.colorRow`): rejilla de siempre recortada a una fila (`--sw-size`), «⋯» (`.swMore`, `toggleSwatches`) la despliega en el sitio con «Personalizado» y «Cuentagotas» (`.swOpen`); `markSw` antepone una muestra «actual» (`.swCurrent`) si el valor es un color propio y `syncSwatchMore` adelanta la elegida (`.pinned`) si no cabe. `setWell` escribe el pozo con el valor real o `data-auto` (marca de automático), nunca el valor anterior.
- **Plegado** (columna): `<html data-props="folded">` desde `localStorage["fluyo.ui.props"]` (script del `<head>`), `setPropsFolded`, ⚙ (`#btnPanel`, visible también en columna) y `#btnPanelClose`. No lo leen el modo Historia, las hojas ni el documento.
- **Activo = oliva** (`system.css`): `.seg` activo (`aria-checked`/`aria-pressed`/`.active`) con velo y borde `--active`; muestra elegida, «N», «⋯» abierto y pestañas con `--active`.
- `CACHE` v81 (`index.html`, `css/styles.css`, `css/system.css`, `js/ui.js`, `docs/index.html`). Sin cambios en el kernel, `model.js`, el formato, el render, el Viewer, Share ni el MCP.
- Pruebas: `test/fluyo-018-23.test.cjs` (alcance, inventario de ids, jerarquía, separación, segmentados, puntas en vm, color y pozo en vm, oliva, plegado, táctil), `test/fluyo-018-23-browser.cjs` (Chrome real: 1440/1280/1024 ratón, 768 tableta, 390 móvil; nodo, code, BD, conexión, flowDir, puntas, colores, teclado, Undo, plegado, oscuro, Historia/Present) y `test/fluyo-018-23-mutations.cjs` (21).

## Deshacer sin perder el contexto (FLUYO-018.24)

```
pushUndoSnapshot(s) ─► s.sel = {n,e} (selección de la página activa al crear la entrada; memoria, nunca el documento)
stepHistory: was=P(), keep=selSnap() ─► applyHistoryEntry ─► inverse.sel = keep (o vacía si cambió de página)
            └► restoreSelAfterHistory(misma página ? keep : null, s.sel) ─► refreshPanel ─► renderTabs
                 · keep con algo: sobreviven los ids que siguen existiendo (nodeById/edgeById); si no queda ninguno, nada
                 · keep vacía (p. ej. tras eliminar): vuelve s.sel, filtrada igual
                 · otra página: se limpia
```

- **Selección** (`selection.js`): `stepHistory` ya no hace `clearSel()`; `restoreSelAfterHistory` decide y llama a `refreshPanel`, que pinta el panel con los valores restaurados y, en la hoja móvil, la deja abierta mientras quede selección (la cierra, como antes, si no queda). Los ids son estables (contadores que nunca bajan, decisión 104), así que no hay selección «fantasma». El documento, las pilas y la semántica de cada entrada no cambian.
- **Ráfagas de escritura** (`ui.js`): `#kwEdit` y `#edgeDotsIn` apilan una entrada en la primera tecla (`kwDirty`/`dotsDirty`, como `lblDirty`/`fsDirty`); `onchange` (salir del campo, o cada paso de las flechas del número) y `refreshPanel` cierran la ráfaga.
- `CACHE` v82 (`js/selection.js`, `js/ui.js`). Sin cambios en el kernel, `model.js`, el formato, `index.html`, CSS, Historias, Present, el Viewer, Share ni el MCP.
- Pruebas: `test/fluyo-018-24.test.cjs` (vm con el arnés de 018.7c: edición, eliminar, creación, múltiple, otra página, `sel` fuera del documento; estáticos de las ráfagas; alcance), `test/fluyo-018-24-browser.cjs` (Chrome real, 1440 ratón y 390 dedo) y `test/fluyo-018-24-mutations.cjs` (14).

## La ruta que se dobla sola (FLUYO-018.25)

```
parallelLane(e) ─► trackSiblings (mismo par + mismos lados, por id) ─► laneLayout   geometry.js; port idéntico en svg.ts
  candidatas: ESTABLE (la primera en 0; ±g, g ≤ 28 y ≥ 14) · RECOLOCADA (g = 14, corrida lo mínimo)
  elige: menos defectos (nodo atravesado, retroceso, diagonal, cruce) › estable › menor movimiento › +
  U: carril k = k·28 más afuera, anclas apartándose del otro extremo
orthoRoute(p1,d1,p2,d2,off,A,B)
  caras de frente a < 2·pad      ─► pasillos = hueco/2; canal acotado entre los pasillos
  lados que se miran (d1 = −d2)  ─► canal (s+t)/2 + off                       (sin cambios con hueco)
  U (d1 = d2 = u)                ─► canal pasillo exterior + off               (nunca por dentro de un pasillo)
render.js: puntos de flujo n = flowDotCount(edgeDots(e), polyLen(pts)) = clamp(floor(L/24), 1, n)
edgeHandlePts(e) = ortho ? handleRoute(edgePoints(e)) : edgePoints(e)
  handleRoute: fuera los vértices interiores sin giro; se quedan anclas y pasillos (0, 1, n−2, n−1)
  └► barras: render.js (dibujo), hitSegment/segHoverCur/iniciarTramo (interaction.js)
pointerdown sobre barra/anillo/codo ─► routePending (no escribe)
pointermove que cambiaría algo     ─► pushUndo + startRouteGesture (iniciarTramo | codo | anillo) ─► segDrag/wpDrag
pointerup sin moverse              ─► nada · soltar un tramo que quedó recto ─► waypoints:[] (routeIsStraight)
```

- **Geometría compartida**: R1, P1 y P2 cambian `edgePoints` (decisiones 190, 194, 195); el corpus publicado no cambia. La paridad vértice a vértice con `svg.ts` mide ahora también 812 páginas sintéticas (`visual-regression.test.ts`: barrido de lados, hermanas, U y caras cercanas), que el corpus no cubría.
- **Manejadores ≠ trazo**: `edgeHandlePts`, `handleRoute` y `routeIsStraight` son del editor. El trazo, las etiquetas, los puntos de flujo, la exportación y el MCP siguen con `edgePoints`/`edgeStroke` (`edgeStroke` no cambia).
- **Gesto perezoso**: `routePending` vive en `interaction.js` (no en `state.js`). `cancelGestures`, `pointerup` y Escape lo vacían.
- **Puntos de flujo** (decisión 196): solo el lienzo los anima; no toca el SVG ni el MCP.
- `CACHE` v83 (`js/geometry.js`, `js/interaction.js`, `js/render.js`). Sin cambios en el kernel, `model.js`, el formato, `index.html`, CSS, Historias, Present, el Viewer ni Share. En el MCP: `src/svg.ts` (R1), el golden compartido `fluyo-018-16-conexiones-svg.json` y el test de contrato de `add_step` (`waitsForArrivalOf`, aserción obsoleta tras 018.22).
- Pruebas:
  - `test/fluyo-018-25.test.cjs`: vm, comparando con el `geometry.js` de HEAD; la captura, el barrido, lo que cambia y lo que no, corpus, golden, puntas, barras y alcance.
  - `test/fluyo-018-25-browser.cjs`: Chrome real d1440/m390; la captura con el gesto real y su SVG, clic inerte, un movimiento = un Undo, Escape, matrices, guarda de F5 y `editor-inline.html`.
  - `test/fluyo-018-25-mutations.cjs`.
  - En el MCP: `test/fluyo-018-25.test.ts` y la paridad del barrido.
## Tamaño configurable de las puntas (FLUYO-018.27)

```
edge.arrowSize  (opcional; ausente = 1; número acotado en [1, 2]; null lo quita)      model.js: CONNECTION_SPEC_KEYS, CONNECTION_UPDATE_KEYS, UPDATE_NUMBERS, normalizeProjectEdge
edgeStroke(e, pts)                                                                       geometry.js; port idéntico en svg.ts
  size = edgeArrowSize(e)                 → aguja = edgeHeadSegs(tip, u, size): largo 11·k, medio ancho 4·k, muesca 2,8·k, desde la punta
  tip  = ancla − u·EDGE_GAP               → la punta NO se mueve (3 px del ancla), sea cual sea k
  cut  = EDGE_GAP + (11 − 2,8)·k          → la línea muere en la muesca escalada
  ruta (edgePoints), anclas, etiquetas, puntos de flujo: sin cambios; EDGE_W sin cambios
Lienzo (editor, Present, Viewer: render.js), SVG del editor (export.js) y export_diagram (svg.ts) no cambian: ya pasaban la conexión entera a edgeStroke.
UI: #rowArrowSize (Dirección, bajo Puntas) → segOnSelect("arrowSizeSeg","arrowSizeSel") → editEdge(e,{arrowSize}) con pushUndo; oculta con Puntas = Ninguna y para nodos (edgeRows).
```

- **Formato**: `arrowSize` es una clave nueva y opcional de la conexión; ningún documento se migra (una conexión sin la clave se guarda y se dibuja como en 018.25). Un editor anterior la conserva tal cual (passthrough) y la ignora.
- **Medidas** (px de mundo): 1× = 11 × 8; 1,5× = 16,5 × 12; 2× = 22 × 16. Tramo recto delante de la punta en el pasillo de 28 px: 8,8 / 6,35 / 4,3. Con el zoom escala como la línea (a zoom 2, el doble de píxeles).
- **MCP**: `ConnectionSpec`/`ConnectionPatch` (`author_document`: `create_connection`, `update_connection`) y `EdgeSpec` (`create_diagram`, acotado en el schema) llevan `arrowSize`; el kernel (`model.js` resincronizado) lo valida; `describe_document` no cambia (no lista propiedades visuales).
- `CACHE` v84 (`js/geometry.js`, `js/model.js`, `js/ui.js`, `index.html`). Sin cambios en `render.js`, `export.js`, `interaction.js`, CSS, Historias, Present, el Viewer ni Share.
- Pruebas: `test/fluyo-018-27.test.cjs` (vm: corpus idéntico a HEAD sin la clave, escala proporcional, puntas, conexión corta, barrido, modelo, carga, clonado, deep link, estáticos, alcance), `test/fluyo-018-27-browser.cjs` (Chrome real d1440/m390: casos A–F medidos en píxeles, zoom, panel, Undo/Redo, teclado, SVG, eliminar/duplicar, Present, Share → Viewer, dedo) y `test/fluyo-018-27-mutations.cjs`. En el MCP: `test/fluyo-018-27.test.ts`, la paridad con cada tamaño (`visual-regression.test.ts`) y `scripts/mutate-018-27.ts`.

## Piel «construido» (2.5D): ajuste del documento, Present, exportación, Viewer y MCP (FLUYO-019.1 / 019.2 / 019.3)

```
documento: settings.skin ("built" | ausente = plano; model.js SKIN_VALUES, projectSkin)   → geometry.js (anclas, rutas, etiquetas: sin cambios)
      → js/skin.js (puro, sin DOM): skinNode(n, theme, bg) → capas {k, segs M/L/Q/A/Z, fill, stroke, sw, dash?, clip?}
                                    skinEdgeLanding(pts, B) → copia de la ruta con la punta retirada hasta la silueta visible de B (019.4a)
                                    skinEdgePort(p, lineColor, bg) → anillo de salida · skinExtent(n) · skinPaintOrder(nodes) · skinLabelFont(n, globalFont)
      → render.js: drawSkinLayers (traceSegments) ← editor y Present (viewport.skin = editorSkin() = projectSkin(settings), 019.4b) · Viewer (viewport.skin, siempre) · exportación raster (opts.skin)
      → export.js: skinLayersToSVG (segmentsToSVGPath) ← buildSVGDocument(scale, skin)
   editor (019.4b): la misma piel que Present; marcas en pasada final; acierto = lo que se ve      Share: el payload lleva settings entero → el Viewer pinta lo que diga el documento
   fluyo-mcp (019.3): kernel con la normalización · SkinSchema (documenta flat|built, no rechaza) · src/skin.ts = port literal de skin.js
                      → svg.ts pageToSVG(page, theme, {skin, customBg}) ← export_diagram (skin: projectSkin(settings), customBg del documento)
```

- **La piel es un argumento de pintado; el dato es `settings.skin`.** `render(c,t,{skin})` / `buildSVGDocument(scale, skin)` con `"built"` pintan la piel; ausente o cualquier otro valor, el lienzo y el SVG de siempre, byte a byte (los 8 ejemplos, su raster, su documento y su payload de share se comparan con HEAD en `test/fluyo-019-1-browser.cjs` y `test/fluyo-019-2-browser.cjs`). `skinActive(skin, zoom)` la apaga por debajo de 3 px de canto en pantalla (zoom < 0,375).
- **Persistencia (019.2, decisiones 201–204)**: `settings.skin` es una clave **opcional** de lista cerrada (`SKIN_VALUES=["flat","built"]`): `settingsFromProjectData` conserva `"built"` y **quita** la clave en cualquier otro caso (ausente, `"flat"`, otro valor o tipo), como `arrowSize`; `DEFAULT_SETTINGS` no la conoce; `projectSkin(settings)` → `"built"|"flat"` es la lectura canónica (editor, Viewer, exportación). Un documento que no la tiene se carga y se guarda idéntico (archivo, autoguardado, share). Sin versión nueva de formato ni telemetría. Un documento nuevo nace plano.
- **Quién la escribe**: tres mandos, un dato. El `select` «Aspecto» (`#skinSel`) en «Lienzo» (junto a «Tipografía»; en móvil viaja a «Más» con `placeChrome`); el botón `#prSkin` y la tecla **B** en Present. Los tres llaman a `setDocumentSkin` (`ui.js`): escribe `"built"` o quita la clave, autoguarda, sincroniza los mandos (`syncSkinControls`) y **no crea entrada de Undo** (como el resto de ajustes: `pushUndo` es de la página). La fila «Aspecto» del diálogo de exportar (`#exSkin`) arranca con `projectSkin(settings)` y vale **solo para esa exportación**: `exGo` nunca escribe el documento. `syncProjectControls` fija `#skinSel` al cargar. «Añadir como página» ignora la piel del entrante, como su tema y su tipografía.
- **Viewer**: `s/index.html` carga `../js/skin.js` entre `geometry.js` y `render.js` (CSP intacta); `viewerRenderState` pasa `skin: projectSkin(settings)` al viewport, en la vista normal y en Present, sin conmutador. Un Viewer con el service worker anterior (sin `skin.js`) abre un share construido plano y sin errores (los `typeof` de `render.js`).
- **Sistema** (medidas en `skin.js` y en `.ai/tasks/FLUYO-019.md` §4): vector de profundidad constante d = (+8, −8); la cara frontal es exactamente la caja semántica (anclas, rutas, acierto y selección no cambian); tres tonos planos por cara mezclando el color del nodo con el fondo real del lienzo (tema o `customBg`); línea de tinta de 1 px; línea de contacto; LED del color del nodo. `rect` (y formas desconocidas) = bloque; `cylinder` = la geometría de 018.14a con tapa clara y banda lateral; `icon` = glifo plano sobre una peana; `hex`, `diamond`, `circle`, `text`, `code`, `image`, `anim` = planos. Rótulo: `labelLayout` de siempre; la voz pasa a IBM Plex Mono 500 solo si el nodo no trae fuente y la global es la de serie.
- **Conexiones**: la ruta (`edgePoints`, `laneLayout`, `placeEdgeLabels`) no cambia; el aterrizaje mueve una COPIA del último vértice, solo sobre su propio tramo, hasta la silueta visible del destino (FLUYO-019.4a, decisión 213; ver su sección). Antes desplazaba el último vértice (+4, −4) y el penúltimo lo acompañaba, cuando entraba por n/e con tramo final ortogonal. Un anillo de salida en el origen (no con `startArrow`). Los overlays de Historia recortan a `skinExtent` y los cues se apilan sobre la tapa; el Trace no cambia.
- **Orden de pintor** con la piel: derivado (y ascendente, x descendente). Desde FLUYO-019-HIT-TEST-D6 se aplica **dentro** de cada capa (contenedores → conexiones → hojas, decisión 212). Desde FLUYO-019.4b el acierto del editor con la piel recorre esas mismas capas al revés (`nodePaintLayers`, decisión 227); en plano manda el orden Z del documento, como siempre.
- **UI**: `#prSkin` en la barra de Present («Construido» / «Plano», tecla B) y la fila «Aspecto» (`#exSkin`) del diálogo de exportar, que arranca con el de Present y se aplica a los cuatro formatos (todos pasan por `render(..., {export:true})` / `buildSVGDocument`).
- **Color (019.3, decisión 205)**: `skinColor(c, base)` es el único lector de los colores que la piel interpreta: el color del nodo (tonos y LED) y el relleno de los frentes. `#rgb`/`#rrggbb` → el mismo string; `#rrggbbaa` (válido en el dominio, `HEX_COLOR`) → el color opaco compuesto sobre el fondo de la piel, `skinMix(base, rgb, aa/255)`, con `base` = `customBg` `#rgb`/`#rrggbb` o el del tema; cualquier otro valor → `null`, y entonces color = `PALETTE[0]` (respaldo histórico, como `normalizeProjectNode`/`colHex`) y relleno = tono de cara. Total y determinista: no depende de `render.js`. El anillo de salida no interpreta colores. Antes de 019.3 un `#rrggbbaa` hacía lanzar a la piel (exportación, Present y Viewer en fase `error`).
- **MCP (019.3, decisión 206)**: `export_diagram` pinta la misma piel que «Exportar → SVG», verificado contra los goldens de fluyo (`fluyo-019-1-skin.json`, `fluyo-019-2-skin-svg.json`, `fluyo-019-3-colores.json`) y contra el `skin.js` real en `vm` (`visual-regression.test.ts`). Desde FLUYO-019-MCP-PARITY el MCP también aterriza por silueta (019.4a) y pinta las capas de D6: sin brecha. Sin la clave, el SVG de siempre, byte a byte. `create_diagram` acepta `skin` (`"flat"` = ausencia).
- `CACHE` v85 (019.1: `js/skin.js` nuevo; `render.js`, `export.js`, `state.js`, `editor-runtime.js`, `ui.js`, `interaction.js`, `index.html`, `sw.js`) y v86 (019.2: `model.js`, `state.js`, `editor-runtime.js`, `ui.js`, `export.js`, `viewer.js`, `index.html`, `s/index.html`, `sw.js`; sin archivos nuevos) y v87 (019.3: `js/skin.js`).
- Pruebas: `test/fluyo-019-1.test.cjs` (vm: golden `test/fixtures/fluyo-019-1-skin.json`, pureza, activación, aterrizaje, paridad traceSegments/segmentsToSVGPath, alcance) y `test/fluyo-019-1-browser.cjs` (Chrome real: plano = HEAD byte a byte en SVG, raster y documento; Present construido medido en píxeles; B y botón; zoom; cilindro, icono; exportación y diálogo; Historia; capturas). 019.2: `test/fluyo-019-2.test.cjs` (vm: lista cerrada, corpus idéntico a HEAD, Share → Viewer con y sin `skin.js`, editor-runtime, `setDocumentSkin`, Trace e integridad, alcance, golden compartido), `test/fluyo-019-2-browser.cjs` (Chrome real: corpus = HEAD incluido el payload del share; Present escribe el documento, exportar no; autoguardado y recarga; Viewer en crema/oscuro/móvil, vista normal y Present, medido en píxeles; Viewer de HEAD con un share construido; «Abrir en Fluyo»; Historia; upgrade del service worker v85 → v86) y `test/fluyo-019-2-mutations.cjs`. 019.3: `test/fluyo-019-3.test.cjs` (vm: `skinColor` exacto, totalidad, con y sin `render.js`, sin cambios para `#rgb`/`#rrggbb` contra el `skin.js` de `1ee65ee` en todo el corpus, paridad lienzo/SVG con `#rrggbbaa`, golden de color), `test/fluyo-019-3-browser.cjs` (Chrome real: Present, Viewer y exportación con `#rrggbbaa` sin errores y medidos en píxeles; plano = `1ee65ee`) y `test/fluyo-019-3-mutations.cjs`. Goldens compartidos con el MCP: `test/fixtures/fluyo-019-1-skin.json`, `fluyo-019-2-skin.fluyo.json` + `fluyo-019-2-skin-svg.json` y `fluyo-019-3-colores.json`; en fluyo-mcp, `test/fluyo-019-3.test.ts`, la paridad de la piel en `visual-regression.test.ts` y `scripts/mutate-019-3.ts`.

## Tinte de un color de nodo (FLUYO-019.5)

- **Regla (decisión 207)**: `colorTint(color, k)` (`js/geometry.js`, pura, fuera del kernel) es el único lector del tinte de un color de nodo. `#rrggbb` → `rgba(r,g,b,k)` (el string de siempre), `#rgb` expandido, `#rrggbbaa` → alfa `k·aa/255` con 4 decimales, mayúsculas y espacios de los extremos indiferentes; otro valor → `null`. `k`: 0,16 en crema y 0,18 en el resto (relleno y panel de `code`), 0,2 y 0,15 (pista de `anim`).
- **Usuarios**: `fillFor`, `drawAnim` (spinner, progress, ticket) y `svgFillColor` pasan por `nodeTint` (`render.js`: ilegible → `PALETTE[0]`); `codePanelTint` → `colorTint` (ilegible → el fondo del tema). `hexA` (`model.js`, kernel) queda para `FLOW_ACCENT` y los colores de evento, que `normalizeNodeEffects` ya deja en `#rrggbb`; un test de guarda lo vigila.
- **Identidad**: para todo `#rrggbb` los strings y los píxeles son los de antes; el corpus (ejemplos y fixtures) da SVG y raster, plano y «construido», idénticos byte a byte a `b534a97`. La piel (`skin.js`, decisión 205) no cambia.
- **MCP**: port literal de `colorTint` en `src/svg.ts` (`svgFillColor` con `PALETTE[0].hex`, `codePanelTint`); paridad `vm` con `geometry.js` en `visual-regression.test.ts`; fixture compartido `test/fixtures/fluyo-019-5-tinte.json` (tabla de `colorTint` y secuencia de `fill` del SVG del editor real en los tres temas). `KERNEL_ID` sin cambios.
- `CACHE` v88 (`geometry.js`, `render.js`, `export.js`; sin archivos nuevos).
- Pruebas: `test/fluyo-019-5.test.cjs` (vm: tabla, fixture, identidad con `b534a97` en `fillFor`/`svgFillColor`/`codeColors`/`drawAnim` para todo `#rrggbb`, respaldos, guarda de `hexA`, alcance), `test/fluyo-019-5-browser.cjs` (Chrome real: píxeles en raster plano y «construido», editor, Present y Viewer en crema/oscuro/claro/fondo propio; paridad lienzo/SVG; corpus byte a byte), `test/fluyo-019-5-mutations.cjs` (19 mutaciones); fluyo-mcp `test/fluyo-019-5.test.ts` y `scripts/mutate-019-5.ts` (12 mutaciones).

## Pelota única por ruta: fade por conexión (FLUYO-019-FLOW-FADE)

- **Regla (decisión 208)**: en `drawFlowBalls` (`render.js`), α de la pelota = `nodeAlpha · flowBallFade(s, seg.L)`, con `s` la distancia dentro de la conexión en curso y `flowBallFade(s, L) = clamp(min(s, L−s)/min(FLOW_FADE_PX, L/2), 0, 1)`, `FLOW_FADE_PX = 35`. La pelota se apaga en cada ancla de llegada y se enciende en cada ancla de salida, así que el salto entre las dos anclas de un nodo intermedio no se ve.
- **Sin cambios**: el reloj del grupo (`d = f·D`, bucle del GIF), `flowGroups`, `pathGeometry`, `edgePoints`, la posición, el dedupe, el color y el halo. El modo OFF (`drawEdge`, puntos con ventana L/8) es idéntico píxel a píxel. `flowDir` sigue sin aplicarse a la pelota (F3, fuera).
- `CACHE` v89 (`render.js`; sin archivos nuevos).
- Pruebas: `test/fluyo-019-flow-fade.test.cjs` (vm contra el `render.js` de `266ac09`: tabla de `flowBallFade`, matriz V0–V7 de la auditoría + cadenas de 1/2/4 conexiones, tramo compartido, anillo, rama corta, conexión < 70 px y `reverse`; posiciones idénticas, α = regla por conexión, llegada/salida, salto, bucle, caso sano bit a bit, OFF y alcance), `test/fluyo-019-flow-fade-browser.cjs` (Chrome real: editor, Present, Viewer y Present del Viewer; OFF idéntico píxel a píxel a `266ac09`; ON medido en α y px Δ al llegar a B; exportación) y `test/fluyo-019-flow-fade-mutations.cjs` (16 mutaciones).

## Acierto hoja → conexión → contenedor, puerto diferido y foco del panel (FLUYO-019-HIT-TEST)

- **Contenedor** (`isContainerNode(n, nodes)`, `geometry.js`, fuera del kernel): contiene el centro de otro nodo de menor área. Se calcula en cada consulta, sin caché ni dato persistido.
- **Acierto** (`interaction.js`, decisión 209):
  - `hitTarget(x,y)` → `{kind:"node"|"edge", obj}` en el orden hoja (`hitLeafNode`, la de más arriba) → conexión (`hitEdge`) → contenedor (`hitContainerNode`, el de menor área);
  - `hitNode` = hoja ‖ contenedor (destinos de conectar, extremos, «Conectar» táctil, modo Flecha y eventos de nodo de Historias);
  - `hitSideArrowHost` prueba las hojas antes que los contenedores.
  - El orden del `pointerdown` es: instrumentos de la selección → puerto (diferido) → `hitTarget` → vacío.
  - El hover fuera de un arrastre es puerto ‖ el nodo de `hitTarget`.
  - Historias (`editor-scenarios.js`): una conexión solo queda tapada por una hoja (`hitLeafNode`).
- **Puerto diferido** (decisión 210): `connectPending` en el `pointerdown`; `connectDrag` en `pointermove` tras `CONNECT_MOVE_PX` px de pantalla; en `pointerup` sin movimiento, `portClick` (clic con el orden de `hitTarget`). `cancelGestures` y Escape lo anulan.
- **Foco** (decisión 211): `releasePanelFocus()` es lo primero del `pointerdown` del lienzo; `closeEditBox` hace `blur`.
- El pintado no cambia: las conexiones siguen debajo de todos los nodos (decisión 101). Las capas por contenedor (D6) son un slice aparte.
- `CACHE` v90.
- Pruebas:
  - `test/fluyo-019-hit-test.test.cjs` (vm: `isContainerNode`, tabla de la tarea, Z invertido, anidado, puerto de hoja antes que de contenedor, no regresión en rejilla contra `d31703e` en los 8 ejemplos, D3–D5 fijadas, contratos de D2/D7 y alcance);
  - `test/fluyo-019-hit-test-browser.cjs` (Chrome real con gestos reales; la base `d31703e` debe reproducir cada bug);
  - `test/fluyo-019-hit-test-mutations.cjs`.

## Capas de pintado con la piel «construido» (FLUYO-019-HIT-TEST-D6)

- **Regla (decisión 212)**: solo con la piel activa (`rs.skinOn` en `render()`, `skinOn` en `buildSVGDocument`), el orden de pintado es:
  1. contenedores (`isContainerNode`, la misma definición que el acierto de D1), en recorrido en profundidad de fuera adentro;
  2. las conexiones, completas (trazo, aguja, etiqueta, tokens de Historia), y después el flujo (`drawFlowBalls`);
  3. las hojas.

  La `y` (`skinPaintOrder`) solo ordena dentro de cada capa. Sin contenedores, el orden es el de antes.
- `containmentPaintOrder(nodes, order)` (`geometry.js`, fuera del kernel) es pura y devuelve `{containers, leaves}`:
  - padre de un contenedor = el contenedor de menor área (estrictamente mayor que la suya) que contiene su centro; a igual área, el de más arriba;
  - raíces y hermanos se ordenan con `order`;
  - el orden de pintor llega como argumento, así que la función no depende de `skin.js`.

  `render()` (las dos ramas: lienzo y exportación) y `buildSVGDocument` la llaman con `skinPaintOrder`.
- **Superficies**: Present, el Viewer y su Present (el mismo `render()`), GIF/PNG/JPG (rama de exportación) y el SVG del editor.
- **En plano no cambia nada**: el lienzo del editor, Present plano y la exportación plana son píxel a píxel y byte a byte los de antes. `skin.js` no cambia.
- **Paridad con el MCP**: portada (FLUYO-019-MCP-PARITY, fase 2). El contrato es `test/fixtures/fluyo-019-d6-capas.json` (orden esperado, calculado a mano) más `fluyo-019-d6-capas-svg.json` (golden SVG del caso anidado), copiados byte a byte en el MCP.
  - `fluyo-019-mcp-parity.test.ts` compara el caso D línea a línea, salvo los `<text>`, por la medida de texto.
  - `visual-regression.test.ts` compara con el `geometry.js` real en `vm`: el corpus, los 13 casos y 400 páginas aleatorias.
- `CACHE` v91.
- Pruebas: `test/fluyo-019-d6.test.cjs` (vm), `-browser.cjs` (Chrome real; la base `ce8e699` reproduce el bug) y `-mutations.cjs`.

## Aterrizaje por silueta con la piel «construido» (FLUYO-019.4a)

- **Regla (decisión 213)**: con la piel activa, la punta de una conexión **retrocede por su propio último tramo** hasta salir de la **silueta visible** del destino, y el trazo deja después su `EDGE_GAP` de siempre. Queda a la misma distancia del contorno que se ve que en plano del contorno lógico.
  - Silueta (`skinSilhouette(n)`, `skin.js`): las capas **cerradas y rellenas** de `skinNode`, cada una dentro de su `clip` (`skinLayerSpan`). No hay lista de formas: un bloque aporta tapa, lateral y frente; un icono, su peana; el cilindro, cuerpo y tapa, que coinciden con su contorno lógico; las formas sin piel, nada. La línea de contacto (trazo abierto) no es silueta.
  - Corte exacto de la recta con segmentos `L`, cuadráticas `Q` y arcos `A` (`skinLineCuts`). Todas las capas son convexas, así que cada una da un intervalo; los intervalos contiguos desde el ancla se encadenan hasta `t*`.
  - Solo se mueve el último vértice, sobre su recta: ningún tramo se inclina y el origen y el número de puntos no cambian. No se toca si no hay silueta, si `t* = 0`, si el último tramo llega desde dentro de la caja de anclaje (`anchorBox`) o si `t* > L − 1`. Es idempotente.
  - `t*` se memoiza por forma, caja, punta y punto anterior (`SKIN_LANDING_T`, 4096 entradas como mucho): el lienzo lo pide en cada fotograma.
- **Resultado**:
  - bloque por n/e: 8 u (tapa, lateral), por s/w: nada;
  - cilindro y las 7 formas planas: nada en ningún lado;
  - icono: por el este se para en la peana; por el oeste la roza (0,52 u con el tamaño de serie);
  - rectas diagonales que cruzan una tapa: también (casos de D6).
- **Superficies**: `drawEdge` (Present, Viewer, GIF/PNG/JPG y, desde 019.4b, el editor) y `renderConnectorToSVG` llaman a `skinEdgeLanding(pts, B)`.
- **Pelota única (F13)**: `drawFlowBalls(c, t, rs)` coloca la pelota con `pointAt(puntos pintados, s/L)`, con la `s`, la `L` y la `D` lógicas de `pathGeometry`. El reloj, la duración, el bucle del GIF, la α y el número de pelotas no cambian; sin piel o sin aterrizaje, es la de antes bit a bit. Los puntos (modo OFF) y los tokens de Historia ya usaban la línea pintada.
- **No cambia**: el plano, `skinNode` y el resto de `skin.js`, `geometry.js`, las rutas, las anclas, las etiquetas, el acierto, D6, el kernel, Share y la punta de inicio (`startArrow`).
- **MCP**: portado (FLUYO-019-MCP-PARITY) en `src/skin.ts`, como port literal, y en `svg.ts`, con la llamada con el destino.
  - Las copias de `fluyo-019-1-skin.json` y `fluyo-019-2-skin-svg.json` vuelven a ser byte a byte las de fluyo; `fluyo-019-2.test.cjs` exige la igualdad, sin excepción.
  - La paridad con el `skin.js` real en `vm` cubre el corpus con cada nodo como destino y 4000 rutas aleatorias.
  - La pelota única (F13) no existe en el MCP: su SVG es estático.
- `CACHE` v93 (`skin.js`, `render.js`, `export.js`; sin archivos nuevos).
- **Pruebas**:
  - `test/fluyo-019-4a.test.cjs` (vm):
    - matriz de las 10 formas × 3 tamaños × n/e/s/w × codo/recta/diagonal, contra un oráculo de muestreo independiente;
    - invariantes, valores, guardas, pureza, idempotencia, intersección, memo y convexidad;
    - corpus;
    - F13 y modo puntos contra `22f82eb`;
    - alcance.
  - `test/fluyo-019-4a-browser.cjs` (Chrome real; la base `22f82eb` reproduce los defectos):
    - la geometría del render real;
    - punta visible y separación;
    - SVG;
    - plano y corpus frente a la base;
    - Present y Viewer;
    - pelota en píxeles y bucle;
    - rendimiento.
  - `test/fluyo-019-4a-mutations.cjs`.
  - `test/fluyo-019-4a-undo.cjs`: deshace 019.4a en los tests de alcance de slices anteriores.
  - Goldens: la sección `landing` de `fluyo-019-1-skin.json` (ahora con el destino: `{in, out}` por pieza y caso), `fluyo-019-2-skin-svg.json` y `fluyo-019-d6-capas-svg.json`.

## Piel «construido» en el editor (FLUYO-019.4b)

```
editor-runtime.js   editorSkin() = projectSkin(settings) ──→ buildEditorRenderState: viewport.skin ──→ render(): rs.skinOn = skinActive(skin, zoom)
                    editorSkinOn() = skinActive(editorSkin(), viewZoom)  ← ÚNICO predicado del editor (interaction.js: skinHitOn)
render.js (contratos compartidos: el pintor los llama con rs.skinOn, el acierto con editorSkinOn)
  nodePaintLayers(nodes, skinOn)  capas D6 (212) · edgePaintedPoints(e, skinOn) punta aterrizada (213) · nodeSkinExtent(n, skinOn)
  nodeLabelVoice(n, skinOn)       voz del rótulo  · connectPortLift(n, side, skinOn) lo que sobresale la silueta por ese lado
fotograma con la piel: fondo · rejilla → contenedores → conexiones (+ funda, flujo, tokens) → pelota → hojas (+ overlays) → cues de Scenario
                       → drawEditorMarks (drawNodeSelection · drawEdgeHandles)  ← pasada final (en plano: dentro de drawNode/drawEdge)
                       → puerto · «Conectar» · vista previa de soltar · goma · marco rectangular · pista
acierto con la piel:   hoja (al revés de nodePaintLayers, caja + 4 ∪ skinExtent) → conexión (lógica) → contenedor (al revés)
                       extremos: ancla lógica ∪ punta pintada · puerto: connectPortPoint(n, side, zoom, connectPortLift(…))
```

- **Activación (P1, decisión 226)**: el editor sigue a `settings.skin`; `#skinSel` («Aspecto») es el único mando del aspecto y no hay otro. Present y el editor son el mismo `render()`: con el mismo viewport y sin selección, 0 px de diferencia. Con el documento plano, o «built» a zoom < 0,375, el editor es el de `eff5129` (lienzo, acierto y textarea).
- **Capas (212) y aterrizaje (213)**: no cambian. El editor los recibe tal cual. Lo único nuevo en el fotograma es la pasada final de marcas (F6, decisión 228).
- **Contrato de acierto (P2/P3, decisión 227)**: lo que se ve encima es lo que se acierta. Hoja → conexión → contenedor (209), con hojas y contenedores en el orden de pintado al revés, y área de una forma con piel = caja + 4 ∪ `skinExtent` (la tapa y el lateral son del nodo; una conexión bajo una cara pierde ahí la prioridad). «Traer al frente/Enviar atrás» no cambian lo que se ve entre hojas con piel (aceptado). Lo consumen el clic, el arrastre, el hover, el doble clic, los destinos de soltar, «Conectar», el puerto y la autoría de Historias.
- **Marcas (F6/P4, N1/N2, decisión 228)**: marco y esquinas en la caja lógica ±6. Los tiradores de la conexión, sobre los puntos pintados. `hitEdgeEnd` acierta también la punta pintada (N1: icono por el este; N2: el círculo entero en los bloques).
- **Puerto (F7) y textarea (F9), decisión 229**: `connectPortLift` aparta el puerto lo que sobresale la silueta, y lo comparten el dibujo y el acierto. `editBoxGeometry` usa `nodeLabelVoice`, la voz de `drawNode`, con la misma medida de `labelLayout`.
- **Semantic Scenarios**: sin cambios de contrato (Connection / FLOWS_TO / REQUIRES, AVAILABLE / UNAVAILABLE / NO_PATH). Las marcas de semántica se pintan en `drawEdge` como antes, ahora también con la piel en el editor (como ya pasaba en Present). N3 (el anillo de Requisito junto al anillo de salida de la piel) es de FASE 4.
- **No cambian**: `skin.js`, `export.js`, el Viewer, Share, el formato, el kernel y el MCP. Present y la exportación no pintan marcas del editor.
- `CACHE` v95 (`render.js`, `interaction.js`, `geometry.js`, `editor-runtime.js`, `state.js`, `index.html`; sin archivos nuevos).
- Pruebas:
  - `test/fluyo-019-4b.test.cjs` (vm, 12): predicado único y umbral; plano = `eff5129` (registro completo de operaciones del lienzo y rejilla de acierto y textarea); caras; rejilla Q6; orden de pintado y «Traer al frente»; extremos N1/N2; puerto; voz; pasada final; alcance.
  - `test/fluyo-019-4b-browser.cjs` (Chrome real, 49): Q1–Q9, Q11 y el service worker v94 → v95.
  - `test/fluyo-019-4b-mutations.cjs` (20 U + 9 B).
  - `test/fluyo-019-4b-undo.cjs`: deshace 019.4b en los alcances de slices anteriores (decisión 218).

## Semántica de conexiones (SCENARIOS-SEMANTICS-001, FASE 1)

```
documento: edge.kind  (opcional; "FLOWS_TO" | "REQUIRES"; ausente = Conexión; texto desconocido se conserva)   model.js (kernel)
  edgeKind(e) → FLOWS_TO | REQUIRES | GENERIC (solo lectura) · EDGE_KINDS · authoringKind (autoría: lista cerrada o null)
editor:   ?labs=escenarios → LABS_SEMANTICS (ui.js) → #rowKind / #kindSeg en «Trazo» → pushUndo + editEdge(e,{kind}) → updateConnectionIn
          W5: #kindNote (flowArrowReversed / syncKindNote) — aviso si la punta visible de un Flujo apunta al revés; solo lee
lienzo:   edgeSemanticMarks(e, pts) (geometry.js) → drawEdgeSemanticMarks (render.js, dentro de drawEdge; no al exportar)
          editor · Present · Viewer (sin bandera)            exportación y export_diagram: FASE 5
```

- Registro de decisiones: `.ai/architecture/SCENARIO-SEMANTICS-001.md` (aceptado); tarea: `.ai/tasks/FLUYO-SCENARIOS-SEMANTICS-001.md`. Decisiones 214–222.
- Copiar/pegar, duplicar (`cloneStructureIn`), Undo, autoguardado, archivo, `#d=`, Share y «Añadir como página» transportan `kind` sin código propio (copian la conexión entera).
- UNKNOWN sigue fuera del kernel (D3): `SCENARIO_STATES` y `VALID_STATES` solo admiten `UP`/`DOWN`.
- `CACHE` v94 sobre `main` `0409f4d` (v93); en la línea reconstruida sobre `ce8e699` era la v92. Cambian `model.js`, `geometry.js`, `render.js`, `ui.js`, `index.html` y `css/styles.css`; sin archivos nuevos. Kernel del MCP resincronizado; sin cambios en sus schemas.
- Pruebas: `test/fluyo-scenarios-semantics-1.test.cjs` (vm: modelo, corpus = `0409f4d`, autoría, clonado, `#d=`, bandera, selector con Undo/Redo del editor real, W5, marcas, alcance) y `test/fluyo-scenarios-semantics-1-mutations.cjs` (26 mutaciones).
- Línea histórica: `feat/scenario-semantics` (`4fb5872`, sobre `d31703e`) es la primera implementación de FASE 1; `59588a9` (sobre `ce8e699`) es su reaplicación limpia, reintegrada sobre `0409f4d` junto con FASE 2. Los tests de alcance de slices anteriores descuentan FASE 1 con `test/fluyo-scenarios-semantics-undo.cjs` (decisión 218).

## Derivación de la disponibilidad de un flujo (SCENARIOS-SEMANTICS-001, FASE 2)

```
js/flow-semantics.js (FluyoFlow, puro; depende de edgeKind de model.js; desde FASE 3 lo carga el editor, no el Viewer)
  availabilityAt(page, events, t)                → {id: UP|DOWN}       Behaviors + state_changed del Trace con at ≤ t
  flowStatus(page, source, target, states)       → AVAILABLE | UNAVAILABLE | NO_PATH   (G = FLOWS_TO; BFS, O(V+E), sin tope)
  availabilityProvenance(page, steps, t, timeOf) → {id: EXPLICIT|DEFAULT}  Behavior o SET_STATE (aunque no cambie) con timeOf ≤ t
  flowAvailability(…, states, provenance)        → {status, explicitPath}  explicitPath: camino AVAILABLE todo EXPLICIT (o null)
```

- Decisiones 223–225; contrato congelado en `.ai/tasks/FLUYO-SCENARIOS-SEMANTICS-001.md` § FASE 2. UNKNOWN reservado y rechazado (`invalid_availability`).
- FASE 3 lo cablea: el editor lo carga (`<script>`, precache y CACHE v96) y le pasa el Trace visible y `FluyoStoryClock.visibleAt` (sección siguiente).
- Pruebas: `test/fluyo-scenarios-semantics-2.test.cjs` (vm, 33: M1–M6 con > 64 caminos, ciclos, aislamiento, `source == target`, estado, procedencia, equivalencia con el motor, errores, determinismo y 600 grafos aleatorios contra un oráculo de caminos simples) y `test/fluyo-scenarios-semantics-2-mutations.cjs` (18).
- Línea histórica: `94e50fa` (sobre `4fb5872`); reaplicado sobre la FASE 1 reconstruida (`59588a9`, `ca08fc1`) con la misma lógica y reintegrado sobre `0409f4d` sin cambios.

## Ruta observada de una Historia (SCENARIOS-SEMANTICS-001, FASE 3)

```
model.js (kernel)        scenario.observedFlow = {from, to}  opcional; normalizeObservedFlow (conservadora, nunca falla la carga)
                         setObservedFlowIn(pg, scenarioId, flow|null)  única escritura · deleteNodeIn → cascada (observedFlows)
                         setInitialAvailability guarda UP y DOWN (Condiciones → «Disponible» = EXPLICIT)
document-integrity.js    removalImpact(...).observedFlows  aviso, fuera de wouldInvalidate
flow-semantics.js        flowNodes(page) · resolveObservedFlow(page, sc) → PAIR (story|structural) | ENDPOINT_MISSING | NO_PAIR
                         observedFlowAt(page, sc, events, t, timeOf) → {pair, status, explicitPath}   (FASE 2 compuesta)
editor-scenarios.js      bloque «Ruta observada»: scFlowModel (sin DOM) → scRenderFlow (#scFlow, bajo el transporte)
                         sin reproducir: FluyoStory.run + FluyoStoryClock.schedule, t = 0, «Al inicio · »
                         reproduciendo: scPlayback.trace (visible) + cursorVirtual; pausa, ⏮/⏭ y terminada incluidos
```

- Solo con la bandera labs (D10), si la página tiene alguna conexión Flujo y la Historia activa tiene eventos. Con labs apagada, la cabecera de Historias es idéntica a la de v95.
- Se refresca desde `scRenderStatus` (cada fotograma de la reproducción, transporte, panel) y `scSetBehavior`; el DOM solo se escribe si cambia. La base se memoiza por reproducción o por firma del documento.
- Elegir o quitar la ruta: una entrada de Undo (`pushUndo` + `setObservedFlowIn`); borrar un extremo, la misma entrada que el borrado (cascada del dominio).
- No pinta nada en el lienzo, no hay timeline y no toca Viewer, Present, exportación ni la autoría del MCP (FASE 4 y FASE 5). El MCP solo sincroniza el kernel: passthrough y `delete_node` informa `cascade.observedFlows`.
- Decisiones 230–233. Pruebas: `test/fluyo-scenarios-semantics-3.test.cjs` (vm: kernel, derivación con el reloj visible, editor con `state.js` y `selection.js` reales, estático y alcance), `-mutations.cjs` (25), `-browser.cjs` (Chrome real a 1440 y 390, labs apagado frente a v95, SW v95 → v96). Los alcances de slices anteriores descuentan FASE 3 con `test/fluyo-scenarios-semantics-3-undo.cjs`.

## Experiencia de la ruta observada (SCENARIOS-SEMANTICS-001, FASE 4)

```
flow-semantics.js        flowRoute(page, s, t) → {status: ROUTE|NO_PATH, nodes, edges:[{id, from, to, depth}], maxDepth}
                         routeEdgeStates(route, states) → {edgeId: AVAILABLE|UNAVAILABLE}
                         routeTimeline(page, route, events, end) → {start, final, frontiers, end, instants, segments, marks} | null
                         routePaths(route, limit) → {paths, total, exact, mustPass}            (nada cambia el estado de la ruta)
editor-scenarios.js      scFlowVisibleEnd (fin visible = FluyoStory.isFinished) · scFlowRouteData (memo por base, página y par)
                         scFlowTrackView → #scFlowTrack / #scFlowEnds / #scFlowRows   ·   scFlowOverlay → scenarioRuntime.flow
render.js                drawRouteSleeve (bajo la línea pintada, en drawEdge) · drawRouteNodeMarks (en drawScenarioNodeOverlay)
                         N3: con la piel, sin anillo de salida donde se pinta el anillo de Requisito (no al exportar)
```

- Todo derivado de estructura + Behaviors + Trace VISIBLE (la base de FASE 3); nada se persiste ni apila Undo (N3/B6). Decisiones 241–244.
- La línea de tiempo y las filas viven en `#scFlow`, bajo el estado (orden de D6). Edición: completa y sin cursor. Reproduciendo: cursor = `cursorVirtual / fin visible`; pausa, ⏮/⏭ y terminada lo mueven. No es un control de salto.
- El lienzo solo pinta la ruta reproduciendo, con labs, con par y con ruta (NO_PATH no pinta fundas), y nunca al exportar. (En FASE 4, tampoco en Present ni en el Viewer: lo añade FASE 5, más abajo.) Sin `scenarioRuntime.flow`, `render()` es el de v98 operación a operación.
- Pruebas: `test/fluyo-scenarios-semantics-4.test.cjs` (vm: derivación con oráculos, herramienta y lienzo del editor, pintor con un lienzo que registra operaciones frente a `ae0d619`, estático y alcance), `-mutations.cjs` (36), `-browser.cjs` (Chrome real a 1440 y 390, claro/crema/oscuro con y sin piel, recuento de rutas, labs apagado = v98, Present, reducir movimiento, SW v98 → v99). Los alcances de slices anteriores descuentan FASE 4 con `test/fluyo-scenarios-semantics-4-undo.cjs`.

## Paridad de superficies de la ruta observada (SCENARIOS-SEMANTICS-001, FASE 5)
Decisiones 245–249. Sin cambios de contrato: D5, D-Ruta, `observedFlow`, AVAILABLE / UNAVAILABLE / NO_PATH, la derivación y el pintado de FASE 4 siguen igual.

```
  flow-semantics.js ── routeOverlay(page, route, timeline, t) ──► scenarioRuntime.flow ──► render.js (drawRouteSleeve, drawRouteNodeMarks)
                   └── routeLine(page, scenario, events, t, timeOf) ──► línea de estado
     editor (labs) · Present (labs): scFlowOverlay / scFlowPresentLine (editor-scenarios.js) → #psFlow en #presentStory (present-story.js)
     Viewer (sin bandera): storyFlowOverlay / storyFlowLine (viewer.js) → #stFlow en #stNow; carga flow-semantics.js tras story-clock.js
  exportación: drawEdge con isExport (PNG/JPG/GIF) y renderConnectorToSVG + semanticMarksToSVG (SVG): marcas + N3; overlays nunca
  kernel: FluyoIntegrity.validateProject → warnings (W2, W3) solo si hay · FluyoAuthoring set_observed_flow (setObservedFlowIn)
  fluyo-mcp: kind en zod · describe_document: connectionKind / observedFlow / warnings · svg.ts: port de edgeSemanticMarks (golden)
```

- La línea de estado va en el rótulo sobre el lienzo (decisión del PO tras la auditoría), nunca en la banda ni en el mando: a 390 px no cabían y las dos filas miden lo mismo que en `6701261`.
- La línea aparece solo reproduciendo (también en pausa y terminada) y solo con par resuelto. Viewer y editor dicen lo mismo en el mismo instante.
- Sin `kind`, la exportación (SVG, PNG, `export_diagram`) es la de antes byte a byte.
- Pruebas:
  - `test/fluyo-scenarios-semantics-5.test.cjs` (vm):
    - la receta frente a `6701261` en 150 Historias aleatorias;
    - la paridad Viewer = editor en 200 Historias aleatorias y con dependencias de llegada;
    - Present;
    - la exportación raster y SVG frente a `6701261` en los ejemplos;
    - el golden;
    - los avisos y `set_observed_flow`;
    - el alcance.
  - `-mutations.cjs`: 30 mutaciones.
  - `-browser.cjs` (Chrome real a 1440 y 390):
    - el Viewer y su Present, Present del editor, Share, la exportación y los ejemplos frente a `6701261`;
    - genera el golden con `FLUYO_UPDATE_GOLDEN=1`;
    - SW v99 → v100.
  - En fluyo-mcp: `test/fluyo-scenarios-semantics-5.test.ts` y `scripts/mutate-scenarios-semantics-5.ts` (30).
  - Los alcances de slices anteriores descuentan FASE 5 con `test/fluyo-scenarios-semantics-5-undo.cjs` (`undo5`, antes que `undo4`).

## Product Shell de las páginas públicas (FLUYO-SHELL-001)

```text
docs/ · ejemplos/ · privacidad/ · privacy/ · terminos/ · terms/ · soporte/ · support/ · 404.html
   └─ css/identity.css ── css/system.css ── css/pages.css
                          (tokens y voces    (shell: cabecera, pie, columna de lectura, escala de
                           del producto)      lectura, botones para enlaces, galería, estado 404)
```

- Las páginas usan los tokens del editor y del Viewer: papel `--surface`, tinta, oliva = activo (página actual, foco), terracota = la
  acción de la vista (como mucho una). Playfair para títulos, IBM Plex Mono para el cuerpo de lectura (14,5 px, interlineado 1,7).
  `pages.css` no tiene ningún color fuera de `:root`; su único hex es `--canvas-dark` (= `THEMES.dark.bg`), el fondo de un diagrama.
- No siguen la interfaz oscura (`fluyo.ui.theme`, decisión 134), como el Viewer.
- Marcado común copiado en cada HTML (no hay build): `.siteHead` (marca · Ejemplos · Docs · «Abrir Fluyo»), `.siteFoot` (licencia,
  Privacidad · Términos · Soporte · GitHub · MCP, e idioma hermano con `hreflang`), sprite con `i-edit` e `i-arrow` (iguales a los de
  `s/index.html` e `index.html`), «Ir al contenido» y `<main id="main">`.
- Ancho: contenedor `min(1120px, 100% − 2·gutter)`; columna de lectura `38rem`; la galería usa el ancho completo. Cabecera de
  50 px con el filete dentro, como el editor y el Viewer; a ≤ 440 px «Abrir Fluyo» se queda en icono; con `pointer:coarse`,
  objetivos de 44 px. Propiedades lógicas (preparado para RTL).
- Idiomas: las páginas con URL propia llevan su texto escrito en su idioma; `404.html` (sin idioma en la URL) usa `data-i18n` +
  `js/i18n.js` (decisión 261) y entra en el catálogo de `test/i18n-scan.cjs`. Las pilas CJK y los rótulos sin mayúsculas son de
  FLUYO-I18N-002 · S4 (`--case-kicker`, `--track-kicker` son tokens que S4 puede redefinir bajo `:lang()`).
- `404.html` va con rutas absolutas porque el hosting la sirve en cualquier ruta. El service worker no cambia: sin red, una ruta
  inexistente sigue respondiendo con el editor.
- Marca: favicon (data URI en las 10 páginas, editor y Viewer incluidos), `assets/logo.svg`, iconos PWA y `og-image.png` en hueso y
  terracota; `manifest.webmanifest` con `background_color`/`theme_color` `#F2EDE3`.
- Tests: `test/fluyo-shell-001.test.cjs` (estático y alcance), `test/fluyo-shell-001-browser.cjs` (Chrome real: 1440, 375 con dedo y
  320; navegación; 404; Ejemplos → editor; SW v108 sin red; comparación con editor y Viewer). Los alcances de slices anteriores lo
  descuentan con `test/fluyo-shell-001-undo.cjs` (`undoShell`, debajo de `undoSwv`; `shellOnly` para las listas de archivos).

## Idioma de la interfaz (FLUYO-I18N-001 · I18N-002 S0)

Solo el texto que pone Fluyo; nunca el contenido del autor ni nada del documento (decisión 260). Sin build ni dependencias (261).

```text
js/i18n-<xx>.js          lo COMÚN de un idioma: Viewer, Present, Historia, shell, 404   ← s/index.html y 404.html cargan solo estos
js/i18n-<xx>-editor.js   lo del EDITOR                                                  ← index.html carga los dos de cada idioma
   (ambos: FLUYO_LOCALES.<xx> = Object.assign(FLUYO_LOCALES.<xx> || {}, {...}))
js/i18n.js               FluyoI18n: LANGS · t · num · setLocale · onChange · applyDom · languages · missing
JS                       FluyoI18n.t("clave", "texto base en español", {param})
HTML                     data-i18n="clave" · data-i18n-title|aria-label|tip|placeholder
                         data-i18n-js="clave"  (texto que pinta JS con FluyoI18n.t; applyDom no lo toca)   · S1
                         translate="no"        (atajos, repositorios, formatos, números: nunca se traducen)  · S1
```

- Contenido del autor (nombres de página y de Historia, etiquetas, frases, mensajes) nunca es clave ni texto base de `t()`: solo
  **parámetro** de una plantilla completa («Página {n} de {total}: {name}…»). Recuentos y plurales: plantilla externa completa con
  piezas nominales completas («{nodes} y {edges} seleccionados»); nada de concatenar traducciones.
- El marco que conserva `applyDom` es el glifo inicial («▶ », «■ ») y los espacios; la puntuación de apertura (¿ ¡ « “ ( [) es del
  texto.

- `LANGS` (en `js/i18n.js`): `code` (diccionario y `?lang`), `tag` BCP 47 (`<html lang>`, `Intl`, `:lang()`; `zh-Hans`), `name` en su
  idioma (no se traduce) y `released`. Hoy solo `es` está publicado; `en`, `fr`, `ja`, `zh` se cargan pero solo se ven con `?lang`.
- Idioma de la carga: `?lang` (técnico, no se guarda) › `fluyo.ui.lang` (preferencia del navegador) › idioma del sistema **entre
  los publicados** (primero de `navigator.languages` publicado; si ninguno, inglés si está publicado) › español.
- Reserva: idioma › inglés › español; lo que falta se anota en `missing()`. Plurales con `Intl.PluralRules` del idioma del texto
  que se usa. Números: `FluyoI18n.num(n, opts)`.
- En vivo: `setLocale(code, {persist})` traduce el HTML marcado y avisa a `onChange(fn)`; cada superficie que pinta desde JS se
  suscribe (hoy: Viewer en `viewer.js`; Present y transporte de Historias en `present-story.js`). Sin recargar.
- Escritura (`css/system.css`): `--font-cjk` (sans CJK del sistema) dentro de `--font-mono` y `--font-serif`, antes de la genérica;
  `:root:lang(ja)` / `:root:lang(zh)` reordenan `--font-cjk` y ajustan tokens (`--fs-micro`, `--fs-label`, `--fs-field`,
  `--track-micro`, `--case-kicker`) y anulan `text-transform`. Sin webfonts CJK.
- Offline: todos los diccionarios en `ASSETS`; los comunes, en `VIEWER_ASSETS`.
- Añadir un idioma: sus dos archivos, sus `<script>` (editor: los dos; Viewer y 404: el común), `sw.js` y una fila en `LANGS`.
- Tests: `test/fluyo-i18n-001.test.cjs`, `test/fluyo-i18n-002-s0.test.cjs` (catálogo de todos los idiomas, puerta de publicación,
  carga, offline, peso, escritura, en vivo, alcance), `test/fluyo-i18n-002-s0-browser.cjs` (Chrome real, cinco idiomas, fuentes que
  el navegador usa de verdad por CDP), `test/i18n-scan.cjs` (catálogo, trinquete y `dictionaries()`), `test/i18n-pseudo.cjs`
  (pseudo-idioma `qps` de pruebas, nunca publicado). Los alcances anteriores descuentan esta tarea con
  `test/fluyo-i18n-002-s0-undo.cjs` (`undoS0`, debajo de `undoShell`).
- S1 (cromo del editor en inglés): `test/fluyo-i18n-002-s1.test.cjs`, `test/fluyo-i18n-002-s1-browser.cjs`,
  `test/fluyo-i18n-002-s1-undo.cjs` (`undoS1`, debajo de `undoS0`). Los arneses vm que ejecutan trozos del editor cargan el idioma
  con `test/i18n-vm.cjs` (`loadI18n(ctx)`), como la página. El suscriptor del cromo vive al final de `ui.js` (`paintChromeText` +
  `onChange`); el de Compartir, en `editor-share.js`.
- S2b (el texto del kernel y los nombres sembrados de Historia, decisiones 296–299): `story-playback.js` y `story-clock.js` aceptan un
  proveedor de texto OPCIONAL `text(clave, español, params)` como último argumento (`FluyoI18n.t` en el editor, Present y el Viewer;
  fluyo-mcp no lo pasa y sigue en español); `model.js` acepta el formateador opcional K1 `{story, copy, copyN}`
  (`defaultScenarioName`, `copyScenarioName`, `duplicateScenario`) con la regla de unicidad y el recorte a 120 en el kernel. El kernel no
  conoce `FluyoI18n`. Tests: `test/fluyo-i18n-002-s2b.test.cjs`, `-mutations.cjs`, `-browser.cjs` (Chrome por CDP) y `-undo.cjs`
  (`undoS2b`, encima de `undoS4`); en fluyo-mcp, `test/fluyo-i18n-002-s2b.test.ts`.
