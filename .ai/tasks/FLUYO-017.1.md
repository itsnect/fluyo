# FLUYO-017.1 — MCP: contrato de autoría de Historias

Estado: SLICE DE LECTURA IMPLEMENTADO Y VERIFICADO POR QA INDEPENDIENTE (§15): READY FOR DONE. Autoría/mutación NO implementada. Sin commit, sin push.
Fecha: 1 de octubre de 2026.
Alcance: §1–§13 son el diseño aprobado; §14 es lo realmente implementado (describe_document, run_story, FluyoIntegrity, kernel compartido, paridad). Si difieren, manda §14.

Relación con FLUYO-017: es la investigación de la «Propuesta 1» de §9 de `FLUYO-017.md` y la resolución conceptual del bug B2 de §5.

## 0. Resumen

- **El contrato es viable con el código actual y sin segundo engine.** Se comprobó con un spike descartable (fuera de los repos): los scripts clásicos `config.js`, `safe-svg.js`, `model.js`, `scenario-engine.js`, `scenario-playback.js` y `story-playback.js` se cargan **sin modificar** en un `vm` de Node sin DOM (≈1,3 ms y 111 KB por contexto) y producen el Trace real de las dos Historias del caso Cliente→Kafka→Comercio (§9).
- **La arquitectura deseada (Domain Model → Editor | MCP → Shared Engine) ya existe a medias**: `model.js`, el engine y `FluyoStory` son puros y compartidos por editor, Present y Viewer. Faltan cuatro piezas pequeñas (§8): una autoridad de integridad, tres/cuatro funciones de autoría que hoy viven dentro de `editor-scenarios.js`, y una forma de entregar esos mismos archivos a `fluyo-mcp` sin copiarlos a mano.
- **B2 también existe en el editor** (no sólo en MCP): `deleteSel` (`js/selection.js:73`) borra nodos y conexiones sin tocar Steps ni Behaviors. La solución es una única autoridad de validación de integridad en el dominio (§7), no una regla en MCP.
- Hallazgo importante para no inventar semántica: **el engine no comprueba disponibilidad en `OCCURRENCE`**. Un «Procesamiento» sobre Kafka caído sigue emitiendo `event_occurred`. Hay que declararlo como acontecimiento **narrado** (§5, §9).

## 1. Estado actual

### Qué soporta `fluyo-mcp` hoy (HEAD `d8df96b`, paquete 1.0.0)

- Nueve tools puras y sin estado: `create_diagram`, `edit_diagram`, `export_diagram`, `list_icons|colors|anims|fonts|templates`, `create_from_template`. Transportes stdio y HTTP stateless (1 MB entrada, 200 KB por respuesta, 30 req/min por IP; enlace `#d=` hasta 16.000 caracteres).
- Sólo Structure: nodos, conexiones, tema, nombre de página, relayout. `create_diagram` emite documentos **v3**; el editor es v5.
- Los schemas (`src/model.ts`, zod) son `passthrough`: `eventTypes`, `behaviors`, `scenarios` y `nextEventTypeId` **sobreviven** pero no se interpretan ni validan. Ningún fixture de contrato (`test/fixtures`) los contiene.
- `remove_node` / `remove_edge` (`src/diagram.ts`) sólo actualizan estructura: dejan Steps y Behaviors huérfanos (B2). Además `remove_node` no limpia `behaviors`.
- Mecanismo ya existente de reutilización con el editor: `scripts/sync-config.ts` evalúa `fluyo/js/config.js` con `vm` y genera `src/generated/config.ts`; `check:config` y el job `drift` de CI detectan desfase. Es el precedente de este diseño (§8).

### Qué ofrece hoy el dominio del editor (reutilizable)

| Pieza | Dónde | ¿Pura? | Notas |
|---|---|---|---|
| Normalizar/validar documento | `model.js#projectFromProjectData` | Sí (deep copy) | Valida forma de Steps, ids, contadores. **No** valida referencias a nodos/conexiones ni a EventTypes. |
| Fábricas de Historia | `createScenario`, `duplicateScenario`, `defaultScenarioName`, `copyScenarioName` | Sí (reciben `pg`) | Ids irreutilizables, copia profunda. |
| Steps | `createStep`, `deleteStep`, `validatePersistedStep` | Sí (reciben `sc`) | `createStep` rechaza engine > 2. |
| EventTypes | `createEventType`, `updateEventType`, `deleteEventType`, `eventTypeById`, `eventTypeUseCount` | **Leen la global `doc`** | Ya protegen: primitiva/disponibilidad inmutables si está en uso (dec. 17), no se borra en uso (dec. 22), placeholders allowlisted. |
| Semántica temporal | `storyboardMoveByOne`, `storyboardMoveStep`, `storyboardRemoveStep`, `storyboardInsertDuplicate`, `storyboardCollapsedGroups` | Sí | Política única de esperas (dec. 41, 44, 47). |
| Validación de ejecución | `scenario-engine.js#validateExecution` (interna a `runScenario`) | Sí | Referencias a nodos/conexiones/behaviors, ids, tiempos, límites, versión. **No** conoce EventTypes. |
| Ejecución | `FluyoScenarios.runScenario` → Trace; `FluyoStory.start` = validar + ejecutar + `makePlayback` | Sí | Única receta compartida editor/Present/Viewer (dec. 53). |
| Resultado por Step | `scRuntimeStateForStep` (`editor-scenarios.js:216`), `FluyoStory.caption`, `render.js` | Derivado del playback | **Triplicado**: tres lecturas del mismo Trace. |
| Elegir acción desde un EventType | `scApplyTargets` (`editor-scenarios.js:2279`) | **No** (UI) | FLOW→SEND, OCCURRENCE→OCCURRENCE, SET_AVAILABILITY→SET_STATE+`availability`. Inline. |
| Cambiar espera | `scSetStepDelay` (`editor-scenarios.js:1271`) | **No** (UI) | Desplaza el momento y los posteriores. |
| Disponibilidad inicial | `editor-scenarios.js:205` | **No** (UI) | `pg.behaviors.filter` + push. |

### Verificaciones del spike (resultados reales, no inferencias)

1. Con el documento v5 de §9 el kernel carga en `vm.createContext({})` y no filtra `window`/`document`.
2. `runScenario` sobre Historia A: dos envíos completados; sobre Historia B: ver §9.
3. Borrar la conexión 5 «como lo hacen editor y MCP» → `missing_edge` en A.
4. Borrar el nodo Comercio → `missing_behavior_node` **y** `missing_edge`.
5. Un Step con `eventTypeId: 99` (inexistente) o con un EventType FLOW sobre una acción OCCURRENCE **pasa** el engine y `projectFromProjectData`. Hoy **ninguna capa** valida esas referencias.

## 2. Principios del contrato

1. **El engine es la autoridad.** MCP nunca calcula un resultado: lo pide al kernel y lo transporta.
2. **Un kernel, dos consumidores.** El mismo código del editor, byte a byte, ejecuta en MCP. Nada se porta a TypeScript.
3. **Documento entra, documento sale.** Sin sesión, sin estado en servidor (compatible con el HTTP stateless actual).
4. **Todo es copia.** El original nunca se muta (§6).
5. **Alcance explícito en cada operación**, verificado por el servidor (§3).
6. **Lo que el modelo no representa se declara**, no se infiere (§5).

## 3. Contrato propuesto

Tres tools nuevas, aditivas (las nueve actuales no cambian). Nombres provisionales.

| Tool | Efecto | Anotaciones MCP |
|---|---|---|
| `describe_document` | Lectura compacta (§3.1). | `readOnlyHint`, `idempotentHint` |
| `author_document` | Aplica un lote atómico de operaciones sobre una copia, valida y devuelve el documento nuevo + informe (§3.2, §5, §6). | puro (devuelve copia) |
| `run_story` | Ejecuta una o todas las Historias con el engine y devuelve resultados verificables (§3.3). | `readOnlyHint`, `idempotentHint` |

`edit_diagram` sigue existiendo para Structure; pasa por la misma autoridad de integridad (§7). Es deseable (no obligatorio en el slice 1) que `author_document` acepte también las operaciones de estructura para que el lote sea uno solo.

### 3.1 Lectura: `describe_document`

Entrada: `{document, level?: "outline"|"page"|"story", pageIndex?, scenarioId?, includeSteps?}`. Por defecto `outline`.

Pensada para contexto de agente: ids numéricos junto a etiquetas, sin coordenadas, estilos, imágenes ni waypoints. Objetivo: <2 KB para el caso de prueba, creciendo con el número de Historias y no con el de píxeles. Sin pasar de `outline`, **nunca** devuelve `img`/`svg`/`code`.

```jsonc
{
  "kernel": {"documentVersion": 5, "engineVersion": 2, "kernelId": "sha256:…", "supportsDocumentVersions": [1,2,3,4,5]},
  "revision": "sha256:…",                       // de §6
  "limits": {"maxSteps": 1000, "maxTraceEvents": 2000, "maxVirtualMs": 86400000},
  "vocabulary": {                               // EventTypes: ALCANCE GLOBAL (document)
    "scope": "document",
    "eventTypes": [
      {"id": 1, "name": "Pago", "primitive": "FLOW", "sentence": "{source} paga a {target}", "token": "💵", "usedBy": 2},
      {"id": 4, "name": "Caída", "primitive": "SET_AVAILABILITY", "availability": "DOWN", "sentence": "{target} deja de responder", "usedBy": 1}
    ]
  },
  "pages": [{
    "index": 0, "name": "Pago",
    "nodes": [{"id":1,"label":"Cliente"},{"id":2,"label":"Kafka"},{"id":3,"label":"Comercio"}],
    "connections": [{"id":4,"from":1,"to":2},{"id":5,"from":2,"to":3}],
    "behavior": {"scope": "page", "initialUnavailable": []},       // sólo nodos con initialState DOWN
    "stories": [{"id":1,"name":"Historia A","engineVersion":2,"steps":3,"executable":true,"validation":"ok"}]
  }],
  "unmodeled": ["retries","queues","timeouts","causal dependencies between steps","payloads","business logic of any node"]
}
```

- `level:"story"` + `pageIndex` + `scenarioId` añade los Steps **en orden efectivo** y agrupados por momento: `{stepId, at, moment, event:{id,name}, action, target:{kind,id,label}, sentence}`. La frase sale de `renderEventSentence` (no se redacta fuera del kernel).
- Cada elemento declara su **alcance** (`document`/`page`/`story`) para que el agente sepa qué modificará una operación antes de proponerla.
- Etiquetas duplicadas (dos nodos «Kafka», dos Historias «Historia A») se marcan con `ambiguous:true`; el agente debe usar ids. Es el riesgo señalado en FLUYO-017 §9.
- Una Historia con `engineVersion` > 2 o inválida se lista con `executable:false` y su código; no se oculta ni se reinterpreta.
- Versiones: acepta 1..5 como el editor (`projectFromProjectData` migra). La salida de `author_document` es siempre v5 normalizada, y lo indica; el editor ya abre v3.

### 3.2 Autoría: `author_document`

Entrada: `{document, operations: Op[], expectRevision?: string, dryRun?: boolean}`. Todo el lote es **atómico**: si falla una operación o la validación final, no se devuelve documento nuevo (`ok:false`, índice de la operación, código). `dryRun` valida y ejecuta sin devolver el documento (barato para explorar).

Cada operación lleva `scope` explícito. El servidor compara el `scope` declarado con el que **le corresponde por definición**; si difieren, rechaza (`scope_mismatch`). Así una operación pensada como local no puede reutilizarse para un cambio global ni al revés.

| Operación | Scope | Direcciona | Efecto / reutiliza |
|---|---|---|---|
| `create_story` | story (en `page`) | `pageIndex`, `name?` | `createScenario` + `defaultScenarioName`. Devuelve `scenarioId`. |
| `rename_story` | story | `pageIndex`, `scenarioId`, `name` | Valida 1–120 caracteres. |
| `duplicate_story` | story | `pageIndex`, `scenarioId`, `name?` | `duplicateScenario` (id nuevo, copia profunda, mismos EventTypes). El original queda **byte a byte igual**. |
| `add_step` | story | `pageIndex`, `scenarioId`, `eventTypeId`, `target` (`edgeId`\|`nodeId`), `placement?` | La **acción se deriva del EventType** (FLOW→SEND, OCCURRENCE, SET_AVAILABILITY→SET_STATE+`availability`) mediante la función extraída E5 (§8). El agente no escribe `action` ni `state`. `placement`: `"append"` (por defecto, como el editor) \| `{sameMomentAs: stepId, position:"before"\|"after"}`. |
| `remove_step` | story | `…, stepId` | `storyboardRemoveStep` (colapsa la espera, dec. 47). |
| `set_wait` | story | `…, stepId, waitMs` | «Espera antes de este momento»; desplaza ese momento y los posteriores (dec. 31/44). Extracción E3. Rechaza fuera de 0–24 h. |
| `retarget_step` | story | `…, stepId, target` | Nuevo objetivo; debe respetar `eventTypeAllowedTargets` del EventType del Step. |
| `move_step` (opcional) | story | `…, stepId, direction` | `storyboardMoveByOne`. Opcional en el slice 1. |
| `set_initial_availability` | **page** | `pageIndex`, `nodeId`, `state` | Behavior de página (`pg.behaviors`). **Afecta a todas las Historias de esa página**; el informe las enumera (`affects`). Extracción E4. Para una caída propia de una variante, usar `add_step` con un EventType SET_AVAILABILITY. |
| `create_event_type` | **eventType** (document) | `definition` | `createEventType`. Aditivo y por tanto seguro. |
| `update_event_type` | **eventType** (document) | `id, changes, expectedUseCount?` | `updateEventType` (ya inmutable primitiva/disponibilidad si se usa). **Global**: el informe devuelve `affects:[{pageIndex,scenarioId,stepIds}]`. Si `expectedUseCount` se envía y no coincide con el uso real, se rechaza (el agente leyó un estado viejo). |
| `delete_event_type` | eventType | `id` | `deleteEventType` (rechaza si está en uso, dec. 22). |

Reglas anti-accidente global:

1. Las operaciones de `story` sólo **referencian** EventTypes; nunca los crean ni editan «en línea». Cambiar vocabulario es otra operación con otro scope.
2. Toda operación de scope `page` o `eventType` incluye en su resultado `affects` (qué Historias/Steps ven el cambio).
3. No hay operación de documento que reescriba `doc.eventTypes` ni `pages` en bloque.
4. Los ids de Historia son **por página** (dec. 63): toda operación de story exige `pageIndex` **y** `scenarioId`; nunca sólo el id.
5. Los ids de Step son **por Historia** y la copia conserva los de su original. La alineación entre Historias se hace por evento/objetivo/momento, nunca por `stepId` (FLUYO-017 §9, Propuesta 2).

Referencias temporales entre operaciones del mismo lote: `add_step` y `create_story` devuelven ids; para encadenar en un lote se admite `ref` local (`{"ref":"b"}` en `create_story`/`duplicate_story`, usado luego como `scenarioId:{"ref":"b"}`), análogo al `key` temporal de `add_node` que ya existe en MCP. No se persiste.

Fuera del slice 1 (explícito): crear/borrar páginas, borrar Historias, insertar un **momento nuevo en medio** de la Historia con espera (exige una función de «insertar momento y desplazar»; hoy sólo existe «cambiar espera»), editar `presentation` visual de un EventType más allá de lo que ya valida `createEventType`/`updateEventType`.

### 3.3 Ejecución: `run_story`

Entrada: `{document, pageIndex, scenarioId | "all"}`. Sin escritura. Detalle en §5.

## 4. Modelo de datos: cómo se representa cada cosa

No hay schema nuevo (sigue v5). El contrato **proyecta** el modelo existente:

| Concepto | Dónde vive | Alcance | Representación para el agente |
|---|---|---|---|
| Structure | `page.nodes[]`, `page.edges[]` (ids compartidos con `nextId`) | página | `nodes:[{id,label}]`, `connections:[{id,from,to}]` |
| EventTypes | `doc.eventTypes[]`, `doc.nextEventTypeId` | **documento** (global) | vocabulario con `primitive`, `sentence`, `availability?`, `usedBy` |
| Behavior | `page.behaviors[] = {nodeId, initialState:"DOWN"\|"UP"}` | **página** (afecta a todas las Historias) | `behavior.initialUnavailable:[nodeId]` |
| History | `page.scenarios[]` (Scenario = Historia, dec. 62), `nextScenarioId` | página | `stories:[{id,name,engineVersion,steps,executable}]` |
| Step | `scenario.steps[] = {id, at, action, nodeId\|edgeId, state?, eventTypeId?}` | Historia | `{stepId, at, moment, event, action, target, sentence}` |

Dos precisiones que el agente debe conocer (se devuelven en `unmodeled` y en el resultado de `run_story`):

- «Disponibilidad» tiene dos puntos de escritura con alcances distintos: Behavior inicial (página) y `SET_STATE` (Historia). La caída de Kafka **sólo para la variante** debe ser un Step.
- `at` es tiempo virtual de narración (ms). El engine no modela latencia ni duración de un envío (FLUYO-017 §4).

## 5. Ejecución

```text
author_document / run_story
        │  (documento)            ┌──────────────────────────────────────────────┐
        ▼                         │ kernel = scripts de fluyo/js, sin modificar   │
 projectFromProjectData ─────────▶│  model.js → FluyoIntegrity → FluyoStory.run   │
 (copia + normaliza)              │            → FluyoScenarios.runScenario       │
                                  └──────────────────────────────────────────────┘
        ▼
 {story, steps[], trace(verbatim), validation, engineVersion, kernelId, traceDigest}
```

Receta única: hoy `FluyoStory.start(page, scenario, now)` hace «validar + `runScenario` + `makePlayback`». Se extrae **`FluyoStory.run(page, scenario)` → `{ok, trace | errors}`** (E1) y `start` pasa a llamarla. Editor, Present, Viewer y MCP ejecutan por el mismo camino. Sin tocar el engine ni su semántica.

Resultado de `run_story` por Historia:

```jsonc
{
  "page": 0, "story": {"id": 2, "name": "Historia B"},
  "engineVersion": 2, "kernelId": "sha256:…",
  "validation": {"ok": true, "errors": [], "warnings": []},
  "steps": [
    {"stepId": 1, "at": 0, "moment": 0, "event": {"id":1,"name":"Pago"},
     "action": "SEND", "target": {"kind":"edge","id":4,"from":"Cliente","to":"Kafka"},
     "sentence": "Cliente paga a Kafka",
     "outcome": {"status": "completed"}},
    {"stepId": 4, "at": 1000, "event": {"id":4,"name":"Caída"}, "action": "SET_STATE",
     "target": {"kind":"node","id":2,"label":"Kafka"},
     "outcome": {"status": "state_changed", "from": "UP", "to": "DOWN"}},
    {"stepId": 2, "at": 1000, "event": {"id":5,"name":"Intento de procesamiento"}, "action": "OCCURRENCE",
     "outcome": {"status": "narrated", "note": "El engine registra la ocurrencia; no comprueba disponibilidad ni efecto."}},
    {"stepId": 3, "at": 2000, "event": {"id":3,"name":"Confirmación"}, "action": "SEND",
     "outcome": {"status": "not_completed", "reason": "source_down", "reasonNode": {"id":2,"label":"Kafka"}}}
  ],
  "trace": [ /* eventos del engine, exactamente como los emite runScenario */ ],
  "traceDigest": "sha256:…",
  "unmodeled": ["retries","queues","timeouts","causality","payments","kafka internals"]
}
```

Reglas:

- `trace` es el array `events` literal del engine. `outcome` se **deriva** de él por una función pura del kernel (E2, `FluyoStory.outcomes(trace, scenario)`): por `stepId`, último evento terminal → `completed` (`send_succeeded`), `not_completed` + `reason` (`source_down`/`target_down`), `state_changed`, `no_change` (SET_STATE hacia el estado que ya tenía: el engine no emite evento), `narrated` (`event_occurred`). Es la única lectura que MCP hace del Trace; coincide con lo que hoy se calcula por triplicado en editor/Present/render, y esos podrán migrar después.
- Las razones se devuelven como **código + nodo**; el texto humano («Kafka no está disponible») se construye con la misma función que ya usa Present/Viewer (`FluyoStory.caption`), no redactado por el LLM. El mensaje del código de error usa `FluyoStory.errorMessages`.
- `traceDigest` = hash del Trace canónico: permite al test de paridad comparar con el editor sin comparar objetos enormes.
- Si la validación falla, no hay `trace`: sólo `validation.errors` (el engine valida **antes** de emitir, `runScenario`).
- Límites del engine (1.000 Steps, 2.000 eventos de Trace, 24 h) se devuelven como error `guard_exceeded`, no se truncan.
- `outcome.status:"narrated"` es obligatorio para OCCURRENCE incluso con el nodo caído. Es el punto en que un LLM tendería a «completar» la historia con una causalidad que no existe.

`kernelId` = hash de los archivos del kernel; junto con `engineVersion` permite reproducir exactamente un resultado.

## 6. Seguridad de edición: working copy

```text
documento original ──▶ projectFromProjectData (deep copy + normalización)
                              │
                     working copy (en memoria, vive una llamada)
                              │ operaciones en orden (author_document)
                              ▼
                     FluyoIntegrity.validateDocument  ──fail──▶ ok:false, sin documento
                              │ ok
                     run_story de las Historias tocadas (opcional: `verify:true`)
                              ▼
            {document: copia nueva, report, baseRevision, resultRevision}
```

- **El original no puede mutarse por construcción**: `projectFromProjectData` ya hace `deep(input)` y no retiene la referencia (comentario en su cabecera: «sin instalar estado ni conservar referencias»). El MCP es stateless: no hay almacén al que escribir.
- **Demostrable**: `baseRevision = sha256(JSON canónico del original)`; la respuesta incluye `baseRevision` y `resultRevision`. `expectRevision` en la entrada permite al agente fallar si el documento que tiene en contexto ya no es el que cree. El test de éxito compara el hash del original antes/después y el hash de la Historia A en ambos documentos.
- **Informe de cambios** (`report.changes`): lista estructurada de lo creado/modificado/eliminado por scope (`story:created id=2`, `step:added …`), de modo que un revisor humano o una prueba verifique que no hubo cambios fuera del alcance declarado. Incluye `untouched:{stories:[1], eventTypes:[1,2,3]}` con su hash.
- **Atomicidad**: o todo el lote o nada.
- **Documento revisable**: la salida es un `.fluyo.json` v5 normalizado + enlace `#d=` (si cabe en 16.000 caracteres, igual que hoy) para abrirlo en el editor. Compartir/Viewer no cambian.
- El campo `meta.generator` de MCP se conserva como hoy (sólo en lo creado).
- Una sesión stdio no cambia el modelo: tampoco guarda estado. (Conexión live y persistencia están fuera.)

## 7. Validación y B2

### 7.1 Reglas y autoridad

**Autoridad única: `FluyoIntegrity.validateDocument(doc)`**, un script clásico nuevo del dominio (`js/document-integrity.js`, cargado tras `model.js` y `scenario-engine.js`, puro, sin DOM). Compone, no reimplementa:

| # | Regla | Fuente | Estado |
|---|---|---|---|
| 1 | Schema/forma, ids únicos, contadores `next*` > máximo | `projectFromProjectData` / `normalize*` | existe |
| 2 | Ids únicos de nodos/conexiones por página; extremos de conexión existentes | `validateExecution` (`duplicate_*`, `missing_edge_endpoint`) | existe (hoy sólo al ejecutar) |
| 3 | `behaviors[].nodeId` existe (`missing_behavior_node`), sin duplicados | `validateExecution` | existe (hoy sólo al ejecutar) |
| 4 | Steps → nodo/conexión existente (`missing_node`, `missing_edge`) | `validateExecution` | existe (hoy sólo al ejecutar) |
| 5 | Tiempos enteros ≥ 0 ≤ 24 h; `nextStepId` > máx; Step ids únicos | `validateExecution` | existe |
| 6 | `engineVersion` soportada (1..2); acciones permitidas por versión | `validateExecution` | existe |
| 7 | Límites (1.000 Steps, 10.000 entidades, 2.000 eventos) | `validateExecution`/`runScenario` | existe |
| 8 | **`step.eventTypeId` existe en `doc.eventTypes`** | `FluyoIntegrity` | **nuevo** (`missing_event_type`) |
| 9 | **Compatibilidad EventType ↔ Step**: FLOW↔SEND (objetivo conexión), OCCURRENCE↔OCCURRENCE (nodo), SET_AVAILABILITY↔SET_STATE con `state === availability` | `FluyoIntegrity` | **nuevo** (`event_type_action_mismatch`) |
| 10 | Ids de Historia únicos por página; nombre 1–120 | `normalizeScenarios` | existe |
| 11 | Nombres de Historia duplicados en la página | `FluyoIntegrity` | **nuevo, `warning`** (`ambiguous_story_name`) |
| 12 | Compatibilidad del engine: cada Historia pasa `runScenario` (o declara `unsupported_engine_version`) | engine | existe |

Salida: `{ok, errors:[{code, path:{pageIndex, scenarioId?, stepId?, nodeId?, edgeId?}, …}], warnings:[…], stories:[{pageIndex, scenarioId, executable}]}`. Los **códigos del engine se reutilizan sin renombrar** (`FluyoStory.ERROR_MESSAGES` ya los traduce); sólo las reglas 8, 9 y 11 son códigos nuevos. Cada error trae la ruta suficiente para que el agente identifique **qué Historia y qué Step**.

Las reglas 2–4 y 12 hoy sólo se evalúan cuando alguien pulsa Reproducir. Que se evalúen en el dominio **al terminar cada operación estructural** es lo que cierra B2.

### 7.2 B2: estrategias evaluadas

| Estrategia | Encaje con el modelo existente | Veredicto |
|---|---|---|
| **A. Rechazar y explicar** (con lista de dependientes) | Idéntica a la dec. 22 (EventType en uso: «no se permite borrar; se indica cuántos momentos lo usan»). Respeta la dec. 29 (sin cascada). El agente no puede confirmar en una UI, así que no debe asumir. | **Por defecto** |
| **B. Actualizar referencias explícitamente** (retarget o quitar Steps) | Ya hay semántica reutilizable: `retarget_step`, `storyboardRemoveStep` (colapso de esperas, dec. 47). Es una decisión narrativa del autor, no de la estructura. | **Disponible como operaciones explícitas en el mismo lote** |
| C. Cascada automática silenciosa | Contradice dec. 29 y altera ritmo/narración de Historias que el agente quizá ni leyó. | Descartada |
| D. Permitir y dejar inválido (hoy) | Tolerable en el editor sólo porque hay Undo y el panel muestra el error al humano que acaba de borrar. Inaceptable para un agente: devuelve un documento roto con `ok`. | Descartada para MCP |

**Decisión conceptual:** el invariante se evalúa sobre el **estado final del lote**, no por operación. Eso permite el camino B sin código especial:

```text
[ retarget_step(5 → conexión 7), remove_edge(5) ]   → válido (ya nadie referencia 5)
[ remove_edge(5) ]                                  → rechazado:
   edge_in_use: «Conexión 5 (Kafka→Comercio) la usan:
                 Página 0 · Historia A · Step 3 (Confirmación);
                 Página 0 · Historia B · Step 3 (Confirmación)»
```

Mecánica: `author_document` compara `FluyoIntegrity.validateDocument(copia)` contra los errores del **original**; los errores nuevos son `regressions` y rechazan el lote; los preexistentes se informan como `preexisting` y no bloquean (un documento ya roto puede repararse parcialmente). El mensaje de `edge_in_use`/`node_in_use` **no es una regla aparte**: se agrupa a partir de los errores `missing_edge`/`missing_node`/`missing_behavior_node` con su `path`. Una sola fuente de verdad.

Sobre Behaviors huérfanos: al quitar un nodo, sus `behaviors` son propiedad del nodo, no narrativa; la operación estructural los retira en la misma operación y lo informa (`changes`). El editor hoy no lo hace (hallazgo 4 del spike) y debería adoptar la misma función.

### 7.3 Dónde vive y quién la usa

```text
js/document-integrity.js  (fluyo, dominio puro)
        ▲                       ▲
 editor (adopta después:        MCP kernel
 confirmar en deleteSel)        (author_document, edit_diagram)
```

- **No en MCP**: sería una segunda regla que divergería del editor (el riesgo FLUYO-017 §9).
- **No dentro del engine**: el engine no conoce EventTypes ni documentos; su contrato `runScenario(structure, behaviors, scenario)` es deliberadamente mínimo (dec. 8–10). `FluyoIntegrity` **llama** al engine; no se funde con él.
- **No dentro de `model.js`**: `model.js` no debe depender del engine; el script nuevo depende de ambos, en orden de carga explícito.
- **Editor, en un slice posterior** (no ahora): `deleteSel` consulta `FluyoIntegrity` y ofrece «Esta conexión se usa en N Historias. ¿Quitarla también de ellas?» con Undo. La decisión de UX (confirmar y limpiar vs. bloquear) es de producto y no se toma aquí; lo que sí se fija es que la **regla** sea la misma.

## 8. Reutilización

### 8.1 Arquitectura: ¿es viable el diagrama deseado?

Sí, con extracciones mínimas. El diagrama deseado **ya es la forma real del código** salvo cuatro puntos:

```text
                ┌────────────────────────────── Domain Model (model.js, document-integrity.js) ──┐
                │  documento, EventTypes, Scenarios/Steps, storyboard*, integridad                  │
                └───────────────┬──────────────────────────────────────────────┬──────────────────┘
                                │                                              │
                       Editor (UI, undo, autosave,                    MCP (copia, lote atómico,
                       selección, canvas)                              contrato JSON)
                                └──────────────────────┬───────────────────────┘
                                                       ▼
                         Shared Engine: scenario-engine.js + story-playback.js (run/outcomes)
```

Obstáculos reales (y por qué no bloquean):

1. **`model.js` usa la global `doc`** (`eventTypeById`, `createEventType`, `updateEventType`, `deleteEventType`, `eventTypeUseCount`, y `FluyoStory.stepMeta`). Hoy no es un módulo reutilizable en paralelo. **Solución mínima sin refactor**: un contexto `vm` **por llamada** con `doc` instalado; 1,3 ms. La refactorización «`doc` como parámetro» no se hace ahora.
2. **Scripts clásicos, sin `import`** (restricción dura, test `no-esm.test.ts`). Los scripts nuevos también lo son; MCP los carga con `vm`, igual que `sync-config.ts` ya evalúa `config.js`.
3. **Autoría atrapada en la UI** (`editor-scenarios.js`): hay que extraerla (E3–E5). No se reescribe: se mueve la parte pura al dominio y el editor la llama.
4. **`fluyo-mcp` empaqueta sólo `dist/`**; el Dockerfile no ve `../fluyo`. Hace falta entregar el kernel dentro del paquete.

### 8.2 Qué se reutiliza tal cual

`config.js`, `safe-svg.js`, `model.js` (autoría de Historia/EventType/Step y `storyboard*`), `scenario-engine.js`, `scenario-playback.js` (sólo `makePlayback` por `start`; `run` no lo necesita), `story-playback.js` (`stepMeta`, `errorMessages`, `caption`). Ninguno se modifica en su comportamiento.

### 8.3 Qué hay que extraer (mínimo)

| # | Extracción | Origen | Destino | Quién la usa |
|---|---|---|---|---|
| E1 | `FluyoStory.run(page, scenario)` → `{ok, trace\|errors}`; `start` la invoca | `story-playback.js:start` | mismo archivo | editor, Present, Viewer, MCP |
| E2 | `FluyoStory.outcomes(trace, scenario)` (resultado por Step) | derivación triplicada (`scRuntimeStateForStep`, `caption`, `render`) | `story-playback.js` | MCP ahora; editor/Present después |
| E3 | `storyboardSetWait(steps, id, delay)` con guardas de rango | `scSetStepDelay` (`editor-scenarios.js:1271`) | `model.js` | editor (lo invoca), MCP |
| E4 | `setInitialAvailability(pg, nodeId, state)` | `editor-scenarios.js:205` | `model.js` | editor, MCP |
| E5 | `stepDefinitionForEvent(et, target, at)` + `defaultStepTime(sc)` | `scApplyTargets` (`:2279`) y `scStepDefaultTime`/`DEFAULT_STEP_DELAY` | `model.js` | editor, MCP |
| E6 | `FluyoIntegrity.validateDocument` (§7) | nuevo | `js/document-integrity.js` | MCP ahora; editor después |

El editor **no cambia de comportamiento** en el slice 1: las extracciones E3–E5 son mover código puro y sustituir el cuerpo del método de UI por una llamada. Los tests existentes (FLUYO-012/012.1/016) cubren esas rutas y deben seguir verdes sin tocarlos.

Tampoco se añade una primitiva, ni `engineVersion`, ni campo persistido.

### 8.4 Cómo llega el kernel a `fluyo-mcp`

| Opción | Evaluación |
|---|---|
| Leer `../fluyo/js` en tiempo de ejecución | Rompe el paquete npm y la imagen Docker. Descartada. |
| **Copia verbatim generada** por `scripts/sync-kernel.ts` en `src/generated/kernel-sources.ts` (strings, compilados a `dist/`) + manifiesto con hash por archivo y commit de `fluyo` + `check:kernel` en CI | Mismo patrón que `sync-config`/`check:config`/`sync-fixtures`/job `drift`. Misma lógica, **cero reimplementación**. El hash es el `kernelId`. **Recomendada.** |
| Paquete publicado desde `fluyo` | Exige build/paquete en un repo «sin build ni dependencias» (restricción dura; requeriría decisión previa en `DECISIONS.md`). Aplazar hasta que haya un tercer consumidor. |
| Portar el kernel a TypeScript | Es exactamente el «segundo engine». Descartada. |

Lo que **sí** se escribe en TypeScript: el contrato JSON (schemas zod de las tres tools), el adaptador `makeKernel()`/`withDocument()`, la conversión de errores y el formateo de `describe_document`. Ninguno contiene reglas de dominio.

## 9. Experimento

Sistema: **Cliente → Kafka → Comercio**. Datos usados en el spike (v5):

- Nodos 1 Cliente, 2 Kafka, 3 Comercio; conexiones 4 (Cliente→Kafka), 5 (Kafka→Comercio).
- EventTypes: 1 *Pago* (FLOW, «{source} paga a {target}»), 2 *Procesamiento* (OCCURRENCE), 3 *Confirmación* (FLOW), 4 *Caída* (SET_AVAILABILITY, DOWN).
- 
### Guion (operaciones del contrato, sin código implementado)

Historia A ya existe en el documento recibido (o se crea con `create_story` + tres `add_step`). Un único lote produce B:

```jsonc
[
  {"op":"duplicate_story","scope":"story","pageIndex":0,"scenarioId":1,"name":"Historia B","ref":"b"},
  {"op":"add_step","scope":"story","pageIndex":0,"scenarioId":{"ref":"b"},
   "eventTypeId":4,"target":{"nodeId":2},                       // «Kafka deja de responder» (vocabulario existente)
   "placement":{"sameMomentAs":2,"position":"before"}}          // en el momento de «Procesamiento», antes de él
]
```

No hace falta vocabulario nuevo. Variante opcional que muestra el scope global: un `create_event_type` previo («Intento de procesamiento», OCCURRENCE, «{target} intenta procesar») y sustituir el Step 2 de B por él (`remove_step` + `add_step`); el vocabulario lo escribe el autor y dice «intenta», no «procesa». El spike ejecutó la variante corta.

### Resultados reales del engine (spike, sin implementación de producción)

**Historia A** (Pago@0 · Procesamiento@1000 · Confirmación@2000):

```text
0     send_started   step1 e4        0     send_succeeded step1 e4
1000  event_occurred step2 n2
2000  send_started   step3 e5        2000  send_succeeded step3 e5
```

**Historia B** (copia de A + Caída(Kafka)@1000 colocada **antes** de Procesamiento):

```text
0     send_started   step1 e4        0     send_succeeded step1 e4
1000  state_changed  step4 n2 UP→DOWN
1000  event_occurred step2 n2                    ← narrado: el engine NO lo bloquea aunque Kafka esté DOWN
2000  send_started   step3 e5        2000  send_failed    step3 e5 reason=source_down
```

Lectura verificable: el pago llegó a Kafka (Kafka estaba UP en t=0), Kafka cae en t=1000, el «procesamiento» queda **registrado como acontecimiento narrado** y la confirmación **no se completa** porque el origen (Kafka) no está disponible. Eso es lo que dicen las reglas actuales; no hay reintento, cola, timeout ni causalidad inferidos.

Control de orden: invertir el orden de Caída y Procesamiento en el mismo momento no cambia la ejecución de la confirmación pero sí el orden de eventos del Trace; el contrato lo expone como `placement.position` explícito, no como efecto lateral.

B2 en el mismo documento: tras borrar la conexión 5, A falla con `missing_edge` (step 3); tras borrar el nodo 3, `missing_behavior_node` + `missing_edge`. Con §7 el lote que borra la conexión 5 sin tocar los Steps se **rechaza** con `edge_in_use` listando Historia A/B, Step 3.

### Qué NO se inventa (y cómo queda declarado)

| No inventado | Cómo se declara |
|---|---|
| Retries, colas, timeouts | `unmodeled`; el agente sólo puede **narrarlos** con EventTypes OCCURRENCE propios, y el resultado es `narrated`, nunca un efecto |
| Lógica de Kafka, procesamiento de pagos | Ídem; «Procesamiento» y «Pago» son vocabulario del autor |
| Causalidad entre Steps | Un Step posterior se ejecuta aunque el anterior falle; se informa por Step |
| Latencia | `at` es tiempo virtual; la duración del viaje es presentación |
| Resultado de un OCCURRENCE sobre un nodo caído | `narrated` + nota explícita |

## 10. Criterios de éxito (cómo se demuestra)

| Criterio | Prueba |
|---|---|
| Original intacto | `baseRevision` igual antes/después; `sha256` del documento de entrada idéntico; la Historia A del resultado es `deep-equal` a la de entrada. |
| Dos Historias válidas | `validateDocument.ok === true` y `run_story` devuelve `validation.ok` para A y B. |
| Referencias válidas | Mutaciones: borrar conexión/nodo usado → lote rechazado; con `retarget_step` en el mismo lote → aceptado; `eventTypeId` inexistente → `missing_event_type`; FLOW sobre OCCURRENCE → `event_type_action_mismatch`. |
| Mismo Trace que el editor | Test de paridad: ejecutar la misma Historia (a) en el kernel de MCP y (b) por `scRun` del arnés del editor (`test/fluyo-016-harness.cjs`) y comparar `traceDigest`. Además `kernelId` de MCP = hash de los archivos de `fluyo/js` (`check:kernel`). |
| Resultados verificables | Cada `outcome` se reconstruye sólo del `trace` devuelto; ningún campo depende del LLM. |
| Sin segundo engine | `src/generated/kernel-sources.ts` es la **única** fuente de lógica de dominio en MCP (diff vs `fluyo/js` = vacío). Búsqueda de `send_failed`, `source_down`, `runScenario` fuera de ese archivo = 0 coincidencias. |
| Alcance | Un lote con `scope` inconsistente → `scope_mismatch`; `update_event_type` con `expectedUseCount` viejo → rechazado; `set_initial_availability` informa `affects` con todas las Historias de la página. |
| Sin regresión del editor | La suite existente (`node --test test/*.test.cjs`) verde tras E1–E5 sin editar los tests. |

## 11. Riesgos y preguntas abiertas

- **Derivas entre kernel vendorizado y `fluyo`**: mitigado con `kernelId` + `check:kernel`; si falla CI, se resincroniza. Mismo riesgo y misma mitigación que `config.ts`.
- **Global `doc`**: un contexto por llamada lo aísla, pero cualquier función nueva del dominio que cree estado de módulo rompería la premisa «una llamada = un contexto». Convención a documentar en ARCHITECTURE.
- **Tamaño de respuesta**: `author_document` devuelve el documento completo (como `edit_diagram`). Con nodos `image` puede superar los 200 KB del HTTP. Alternativa futura: devolver sólo `report` + `patch`, no incluida aquí.
- **Documentos de versión < 5**: se migran al normalizar; la salida es v5. Debe indicarse al agente.
- **Nombre de EventType único**: el modelo no lo exige. Dos «Caída» confunden a un agente. Se propone `ambiguous_event_type_name` como warning, no como regla dura.
- **Decisión de producto pendiente** (no bloquea el slice 1): qué hará el editor con B2 (confirmar y limpiar, o bloquear).
- Compatibilidad hacia delante: si el engine pasa a v3, `createStep` ya lanza `unsupported_engine_version`; el contrato devuelve `executable:false` por Historia, sin degradar silenciosamente.
- Privacidad/seguridad: el kernel es código de confianza del propio repo; el documento entra sólo como datos (nunca se evalúa) y el contexto `vm` se crea sin red ni FS. `vm` no es un sandbox de seguridad: no se usa para ejecutar código de terceros. Debe revisarse que `src/http-logging.ts` no registre cuerpos de las nuevas tools antes de publicarlas.

## 12. Decisión final

1. **¿El contrato es viable?** Sí. Está probado que el kernel actual carga sin DOM y ejecuta las dos Historias. No requiere engine nuevo ni schema nuevo. El único cambio de modelo mental es admitir que la integridad referencial pasa a ser una regla del dominio (hoy sólo ocurre al reproducir).
2. **Mínimo código a implementar.** (a) `FluyoIntegrity.validateDocument` (estimación ~200 líneas: reglas 8, 9, 11 + composición de las existentes); (b) E1–E5 (mover/dividir código ya existente; estimación ~100 líneas netas); (c) en MCP: `sync-kernel` + `kernel.ts` (vm por llamada) + tres tools con sus schemas + conversión de errores. Sin tocar engine, playback visual, render, Share ni Viewer.
3. **Qué modificar en `fluyo`.** `js/story-playback.js` (E1, E2), `js/model.js` (E3, E4, E5 como funciones puras), `js/document-integrity.js` (nuevo, clásico), `js/editor-scenarios.js` (sólo sustituir tres cuerpos por llamadas), tests nuevos de integridad/paridad, `sw.js` (bump de `CACHE` si el script nuevo se sirve, p. ej. si se añade a `index.html`; si sólo lo usa MCP y no se carga en el editor, no hay asset servido nuevo), `.ai/ARCHITECTURE.md` y `.ai/DECISIONS.md` (decisiones: «integridad en el dominio», «el kernel se entrega copiado verbatim»).
4. **Qué modificar en `fluyo-mcp`.** `scripts/sync-kernel.ts` + `check:kernel` (CI/drift), `src/generated/kernel-sources.ts`, `src/kernel.ts`, `src/author.ts` (operaciones/lote/informe), `src/describe.ts`, `src/run-story.ts`, registro en `server.ts`, schemas zod de entrada, endurecer `edit_diagram` (`remove_*` pasan por integridad), fixtures v5 con Historias en `test/fixtures` (hoy ninguno), tests de contrato/paridad/mutación, README. Subir versión del paquete (nuevas tools).
5. **Siguiente slice implementable — «Slice 1: leer, validar, ejecutar» (sólo lectura).** Orden recomendado y por qué: (i) E1 + E2 + `FluyoIntegrity` (reglas 1–12) en `fluyo`; (ii) `sync-kernel` + `describe_document` + `run_story` en `fluyo-mcp`; (iii) prueba de paridad con el editor sobre las Historias A/B del documento de ejemplo. Entrega: un agente puede **entender y ejecutar** cualquier documento v5 con Historias, y detectar B2 en un documento ya roto, sin que aún pueda escribir. Es la parte de mayor riesgo técnico (kernel + paridad) con la menor superficie de mutación. El **Slice 2** añade `author_document` con E3–E5, el guion A/B y la protección B2 en `edit_diagram`. El **Slice 3**, opcional, lleva `FluyoIntegrity` al editor (`deleteSel`).

## 13. Handoff de esta investigación

- **Qué se hizo:** lectura de `.ai/PRODUCT.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `FLUYO-017.md`, `AGENTS.md`, `js/model.js`, `js/scenario-engine.js`, `js/story-playback.js`, `js/scenario-playback.js` (parcial), `js/selection.js` (undo/borrado), `js/editor-scenarios.js` (autoría y resultados por Step); en `../fluyo-mcp`: README, `package.json`, `Dockerfile`, `src/model.ts`, `src/diagram.ts`, `src/server.ts`, `scripts/sync-*.ts`, `test/no-esm.test.ts`, `tsconfig.json`. Spike descartable de carga del kernel en `vm` y ejecución real de las Historias A/B y de B2 (script en el scratchpad de la sesión, fuera de ambos repos).
- **Archivos modificados:** sólo `.ai/tasks/FLUYO-017.1.md` (nuevo). Ningún archivo de `fluyo` ni de `fluyo-mcp` fue modificado; no se ejecutó la suite completa de ninguno de los dos.
- **Decisiones tomadas:** ninguna de implementación. Las propuestas (autoridad `FluyoIntegrity`, kernel vendorizado, rechazar-y-explicar por defecto en B2, scope explícito por operación) quedan **pendientes de aprobación**; no se añadieron a `.ai/DECISIONS.md` ni se alteró `.ai/PRODUCT.md`.
- **Pruebas ejecutadas:** únicamente el spike descrito (resultados reproducidos en §9). No hay tests nuevos.
- **Riesgos pendientes:** ver §11; además, la discrepancia entre `AGENTS.md` (“no explorar repositorios hermanos”) y el encargo, que autoriza explícitamente revisar `../fluyo-mcp`; no se leyó más de lo necesario del repo hermano.
- **Restricciones cumplidas:** sin UI nueva, ChatGPT, agente autónomo, conexión live, HTTP persistente, autenticación, OpenTelemetry, GitHub, Kafka real, Kubernetes, Terraform ni generación desde código; sin commit, sin push, sin FLUYO-018.
- **Próximo paso concreto:** decidir si se aprueba el Slice 1 (§12.5). Si se aprueba, empezar por E1 + E2 + `FluyoIntegrity` con tests sobre el documento de §9 y las 5 mutaciones de §10, antes de tocar `fluyo-mcp`.


---

## 14. Implementación del slice de lectura (handoff)

Restricción de alcance aprobada: **lectura + validación + ejecución**. No se implementó `author_document`, ni Historias/EventTypes/Behavior/estructura vía MCP, ni se cambió `edit_diagram`, ni el borrado del editor, ni sesión viva/IA/auth.

### 14.1 Qué se implementó

| Pieza | Repo | Resumen |
|---|---|---|
| `FluyoIntegrity` | fluyo | Autoridad única de integridad (`js/document-integrity.js`, clásico, sin DOM). |
| `FluyoStory.run / outcomes / sentence` | fluyo | `run` = única ejecución del motor (`start` la invoca); `outcomes` = resultado por Step derivado sólo del Trace; `sentence` = frase de un Step. Sin cambio de comportamiento del editor. |
| B2 (detección) | fluyo | `FluyoIntegrity.removalImpact`: qué Historias/Steps quedarían inválidos. Sólo detecta. |
| `sync-kernel` / `check:kernel` | fluyo-mcp | Copia verbatim del kernel + hashes + `kernelId`; detección de deriva. |
| `describe_document`, `run_story` | fluyo-mcp | Dos tools de sólo lectura (11 tools en total). |
| Paridad | ambos | Fixture Cliente→Kafka→Comercio + golden generado por el camino real del editor, verificado en los dos repos. |

### 14.2 Contrato final

**`describe_document`** — entrada `{document, pageIndex?, includeSteps? (true)}`. Salida (JSON en el 2.º bloque; el 1.º es un resumen de una línea):

```text
readable, schemaVersion (5: versión que MCP entiende; se acepta 1..5), sourceSchemaVersion, engineVersion, kernelId,
valid, errorCount, errors[≤50], currentPageIndex,
capabilities {readsDocumentVersions, engineVersion, eventPrimitives, stepActions, limits, tools, authoring:false},
eventTypes [{id, name, sentence(plantilla), symbol, primitive, action, target, availability?, motion, usedBy}],
pages [{pageIndex, name,
        nodes [{id, label, shape, icon?, availability}], connections [{id, from, to, fromLabel, toLabel, label?}],
        initialUnavailable [nodeId],
        stories [{storyId, name, engineVersion, stepCount, durationMs, executable,
                  moments? [{at, steps [{stepId, eventTypeId, event, action, state?, target{kind,id,label,from?,to?}, sentence}]}]}]}],
unmodeled [...]
```
Documento ilegible → `{readable:false, valid:false, errors, ...}` (no es error de tool). `pageIndex` fuera de rango → error de tool.

**`run_story`** — entrada `{document, storyId, pageIndex? (por defecto la página actual)}`. Salida:

```text
executed:true →  engineVersion, sourceSchemaVersion, kernelId, page{pageIndex,name}, story{id,name,engineVersion},
                 validation{valid (documento entero), storyExecutable, errors[]},
                 steps [{stepId, at, moment, event{id,name,symbol}|null, action, target, sentence,
                         outcome{status, reason?, reasonNode?, from?, to?, state?, nodeAvailability?, note?, eventIndexes[]}}],
                 trace [eventos del motor, tal cual], traceEngineVersion, traceDigest (sha256 del Trace), unmodeled
executed:false →  reason: "document_unreadable" | "story_not_executable"  (+ validation con los errores; sin trace)
```
`outcome.status`: `completed` · `not_completed` (+`reason` `source_down|target_down`, `reasonNode`) · `state_changed` (+`from/to`) · `no_change` · `narrated` (OCCURRENCE; +`nodeAvailability` y `note`). `eventIndexes` apunta a los eventos del Trace de los que se derivó.

**Desviaciones respecto al diseño (§3) y a la petición**
- **No hay `pageId`**: el modelo no da id a las páginas; se usa `pageIndex` (no se inventó un campo). `storyId` = id del Scenario (por página).
- **`kernel/` → `src/generated/kernel-sources.ts`**: el kernel se guarda verbatim como cadenas en un módulo generado (igual que `config.ts`) en vez de archivos sueltos, porque `tsc` y el Dockerfile sólo llevan `dist/`. Cada archivo con su sha256; el contenido es el de `fluyo/js` carácter a carácter (sólo CRLF→LF).
- `validateProject` devuelve además `stories[{pageIndex,storyId,executable}]` (lo necesitan `describe`/`run_story`) y `schemaVersion`/`engineVersion`.
- `scope` toma los valores `document | page | story | step`.

### 14.3 Cómo se comparte el kernel

```text
fluyo/js/{config,safe-svg,model,scenario-engine,scenario-playback,story-playback,document-integrity}.js
   │  npm run sync:kernel  (scripts/sync-kernel.ts; mismo patrón que sync-config)
   ▼
fluyo-mcp/src/generated/kernel-sources.ts   KERNEL_FILES[{name,sha256,source}] + KERNEL_ID
   │  src/kernel.ts: vm.createContext({}) NUEVO por llamada, carga en orden, JSON in/out, timeout 5 s
   ▼
describe_document · run_story   (src/stories.ts: sólo da forma al resultado; sin reglas del motor)
```
`npm run check:kernel`: regenera en memoria y compara con el archivo (ignora la línea de revisión); sin `fluyo/` avisa y sale 0 (`omitido`), con `fluyo/` la deriva es fallo. Añadido a `ci.yml` (job `build-and-test` comprueba el aviso; job `drift` la deriva). Además la suite comprueba el sha de cada archivo, `KERNEL_ID`, la igualdad con `fluyo/js` (obligatoria con `REQUIRE_FLUYO=1`) y que `src/*.ts` no contenga `send_failed|source_down|runScenario|validateExecution…`. Coste medido: ≈1,3 ms y 130 KB por contexto.

### 14.4 Cómo funciona `FluyoIntegrity`

`validateProject(project)` (proyecto `.fluyo.json`; no muta; sin DOM):
1. `projectFromProjectData` normaliza (forma, ids, contadores, versión ≤ 5). Si lanza, `diagnose` localiza la causa con las propias funciones de `model.js` sobre copias: `unsupported_version`, `invalid_event_type`, `invalid_step` (con Historia y Step), ids duplicados (`duplicate_node_id|edge_id|structure_id`), o `invalid_document`.
2. Por página, **una sonda de Historia vacía** por el motor valida estructura y Behaviors también en páginas sin Historias (`missing_behavior_node`, `duplicate_*`, `missing_edge_endpoint`).
3. Por Historia, el motor valida referencias de Steps, tiempos, versión y límites (`missing_node`, `missing_edge`, `invalid_timestamp`, `unsupported_engine_version`, `guard_exceeded`, `duplicate_step_id`…). **Códigos del motor sin renombrar**; mensaje humano de `FluyoStory.errorMessages`.
4. Reglas nuevas: `missing_event_type` y `event_type_action_mismatch` (`reason: action|availability`; FLOW↔SEND, OCCURRENCE↔OCCURRENCE, SET_AVAILABILITY↔SET_STATE con el mismo estado).

Error: `{code, message, scope, pageIndex?, storyId?, stepId?, entityId?, entityKind? (node|edge|eventType), path?, limit?, reason?, endpoint?}` (los últimos sólo cuando el motor/regla los aporta). `valid` = sin errores; `stories[].executable` = motor y reglas nuevas OK.

### 14.5 B2

`removalImpact(project, {pageIndex, nodeIds?, edgeIds?})` copia el proyecto, quita lo que hoy quitan `deleteSel` y `remove_node` (nodos + conexiones que los tocan + conexiones indicadas; **no** Steps ni Behaviors), valida y devuelve `{wouldInvalidate, errors (sólo los nuevos), affectedStories:[{pageIndex, storyId, storyName, stepIds, codes}]}`. Con el fixture: borrar la conexión 5 ⇒ A (Step 3) y B (Step 4); C intacta; borrar la 4 ⇒ A (Step 1) y B (Step 2); borrar Kafka ⇒ A, B y C. **No** modifica el documento, **no** limpia Steps, **no** bloquea el editor, **no** toca `edit_diagram`. Un documento ya roto se describe y se informa tal cual (`describe_document` lista `missing_edge` con Historia, Step y conexión). La política de qué hacer queda pendiente (§14.11).

### 14.6 Resultados (fixture Cliente → Kafka → Comercio)

Nodos 1 Cliente, 2 Kafka, 3 Comercio; conexiones 4 (Cliente→Kafka), 5 (Kafka→Comercio); EventTypes 1 Pago, 2 Procesamiento (OCCURRENCE), 3 Confirmación, 4 Caída. Historias (`test/fixtures/fluyo-017-1-cliente-kafka-comercio.fluyo.json`):

| Historia | Pasos |
|---|---|
| A | Cliente paga a Kafka @0 · Kafka procesa el evento @1000 · Comercio recibe confirmación de Kafka @2000 |
| B | **Kafka deja de responder @0** · Cliente paga @1000 · Kafka procesa @2000 · confirmación @3000 |
| C (aísla OCCURRENCE) | Kafka deja de responder @0 · Kafka procesa el evento @1000 |

`describe_document`: 4.324 caracteres compactos para este documento de 2.813 (el peso fijo son `capabilities`, `unmodeled` y la biblioteca; con 60 elementos más con estilo completo es <60 % del documento). Válido, 3 Historias `executable:true`, `usedBy` Pago 2 · Procesamiento 3 · Confirmación 2 · Caída 2.

`run_story`:

| Historia | Resultado por Step |
|---|---|
| A | completed · narrated (Kafka UP) · completed |
| B | state_changed UP→DOWN · **not_completed `target_down`** (Kafka) · **narrated (Kafka DOWN)** · **not_completed `source_down`** (Kafka) |
| C | state_changed UP→DOWN · **narrated, `nodeAvailability:"DOWN"`**, nota «El motor registra la ocurrencia; no comprueba disponibilidad ni efecto» |

En B el pago no llega (Kafka ya caído), el «procesa» queda registrado como narrado y la confirmación no sale. El Trace de C contiene `event_occurred` sobre Kafka caído y ningún `send_failed`: MCP no inventa un fallo ni una causalidad. Digest de B: `sha256:0c0efde0…657f`.

### 14.7 Prueba de paridad

- **Camino 1 (Fluyo/editor)**: `fluyo/test/fluyo-017-1.test.cjs` carga el editor real en el arnés de FLUYO-016, instala el fixture y ejecuta `scSelectStory(id); scRun()` → `scPlayback.trace` y `scPlayback.stepMeta`. Se compara con `FluyoStory.run` del kernel y con `FluyoStory.start`, y todo se verifica contra el **golden** `test/fixtures/fluyo-017-1-golden.json` (Trace, `stepMeta`, resultados por Step).
- **Camino 2 (MCP)**: `fluyo-mcp/test/fluyo-017-1.test.ts` ejecuta el mismo fixture por el kernel copiado y por la tool `run_story`, y compara con el **mismo golden** (copiado; con `fluyo/` al lado se exige que fixture y golden sean idénticos a los de Fluyo). Además ejecuta las fuentes de `fluyo/js` aparte, como el editor (`FluyoStory.start`), y las compara con el kernel de MCP.
- Igualdad **estructural** (`deepEqual`): Trace completo (orden, `at`, tipos, `stepId`, códigos/razones), metadata de Step (`token, motion, nodeEffects, connection, name`), resultados por Step y `traceDigest`. Verdes para A, B y C.
- **Mutación**: cambiar `source_down` dentro de la copia del kernel hace fallar 6 tests (hash, igualdad con `fluyo/js`, B contra golden ×3, paridad con fuentes); restaurado, vuelve a verde.
- Verificación adicional con el servidor real por **stdio** (`node dist/index.js` + `tools/call run_story`, Historia C): `Kafka procesa el evento → narrated, DOWN`.

### 14.8 Archivos modificados

**fluyo** — nuevos: `js/document-integrity.js`, `test/fluyo-017-1.test.cjs` (34 tests), `test/fixtures/fluyo-017-1-cliente-kafka-comercio.fluyo.json`, `test/fixtures/fluyo-017-1-golden.json`. Modificados: `js/story-playback.js` (`run`, `outcomes`, `sentence`, `NARRATED_NOTE`; `start` ahora llama a `run`), `sw.js` (`CACHE` v60→**v61**, por la regla de archivo servido) y los pines de versión en `test/fluyo-010-qa.test.cjs`, `fluyo-013.test.cjs`, `fluyo-014.test.cjs`, `fluyo-015.test.cjs` y un título en `fluyo-011-browser.cjs`; `.ai/ARCHITECTURE.md` (sección y fila nueva), `.ai/DECISIONS.md` (70–72). `document-integrity.js` **no** se carga en el editor ni se añade a `sw.js`.

**fluyo-mcp** — nuevos: `scripts/sync-kernel.ts`, `src/generated/kernel-sources.ts`, `src/kernel.ts`, `src/stories.ts`, `test/fluyo-017-1.test.ts`, `test/fixtures/stories/` (fixture + golden). Modificados: `src/server.ts` (2 tools), `package.json` (`sync:kernel`, `check:kernel`), `.github/workflows/ci.yml`, `README.md`, `test/tools.test.ts`, `test/http.test.ts` (11 tools; la paridad HTTP↔stdio incluye las nuevas), comentarios en `src/http.ts`. La versión del paquete **no** se subió.

### 14.9 Tests y QA ejecutados

| Comprobación | Resultado |
|---|---|
| Suite de Fluyo `node --test test/*.test.cjs` | **540/540** (34 nuevos) |
| `node --check js/*.js` y el test nuevo | OK |
| MCP `npm test` (build + tests), con y sin `REQUIRE_FLUYO=1` | **261/261**, 0 omitidos |
| `npm run build` | OK |
| `check:kernel` (con fluyo/, sin fluyo/, tras mutar la copia) | OK / aviso `omitido` con exit 0 / ✖ |
| `check:config` | OK |
| Fixture Cliente→Kafka→Comercio (A, B, C) | válido, 3 ejecutables, paridad exacta |
| Smoke stdio real | OK |

No se ejecutaron los tests de navegador (Chrome/Playwright) de Fluyo. Cobertura pedida: **Integrity** — documento válido, conexión usada/no usada, nodo usado/no usado, varias Historias sobre la misma conexión, EventType inexistente, acción incompatible, Step válido/inválido, Behavior inexistente, ids duplicados, engine/schema no soportados, legacy, sin mutar entrada. **describe_document** — vacío, una Historia, varias, legacy (v3 y los 8 ejemplos publicados), EventTypes compartidos, Behavior inicial, documento roto, ilegible. **run_story** — normal, Kafka DOWN, OCCURRENCE sobre Kafka DOWN, inválida, EventType inexistente, ilegible, Historia/página inexistente, ids por página.

### 14.10 Limitaciones

- Sólo lectura: el agente no puede crear/editar Historias, EventTypes, Behavior ni estructura. `author_document` no existe.
- `FluyoIntegrity` no lo consulta el editor ni `edit_diagram`: B2 sigue ocurriendo al borrar; sólo se **detecta**. `removalImpact` no está expuesto como tool.
- `describe_document` tiene un coste fijo (`capabilities`, `unmodeled`, biblioteca) que pesa en documentos muy pequeños. La respuesta de `run_story` (hasta 2.000 eventos de Trace) puede acercarse al tope de 200 KB del endpoint remoto.
- Páginas por posición (no hay `pageId` estable); etiquetas duplicadas no se marcan como ambiguas (usar ids).
- Un documento con forma inválida no se puede validar más allá de `diagnose` (la normalización aborta antes). Si la normalización de `model.js` cambia, `diagnose` debe seguirla.
- `outcomes` reproduce la disponibilidad (Behaviors + `state_changed`) sólo para anotar `nodeAvailability`; no recalcula resultados del motor.
- Sin `REQUIRE_FLUYO=1` (job `drift`) las comparaciones con el repo hermano se omiten si falta `fluyo/`.
- Si el motor cambia a propósito hay que regenerar el golden (`UPDATE_GOLDEN=1 node --test test/fluyo-017-1.test.cjs`) y copiarlo a `fluyo-mcp/test/fixtures/stories/`.
- Versión del paquete MCP sin subir; documentación pública sin tocar.

### 14.11 Siguiente decisión

1. **Política B2**: qué hacer al borrar estructura referenciada por Historias —rechazar y explicar (recomendada para MCP), actualizar referencias explícitamente en el mismo lote, o confirmar y limpiar en el editor (con Undo)—. Decidirla antes de implementar autoría y antes de que `edit_diagram`/`deleteSel` consulten `FluyoIntegrity`.
2. Aprobar el **Slice 2 (autoría)**: `author_document` sobre copia con lote atómico y alcance explícito por operación (§3.2), con las extracciones E3–E5 (`storyboardSetWait`, `setInitialAvailability`, `stepDefinitionForEvent`).
3. Decidir si el editor adopta `FluyoIntegrity` (confirmación en `deleteSel`) y `FluyoStory.outcomes` (hoy triplicado en `scRuntimeStateForStep`/`caption`/`render`).


---

## 15. Independent QA (adversarial) — lectura / validación / ejecución

QA independiente sobre el slice de §14, sin autoría ni mutación. Se buscaron divergencias activamente (documentos hostiles, fuzz, mutaciones, paridad con un fixture complejo, servidor real por stdio). **Política B2 fijada (no implementada):** *una operación de autoría que deje una Historia inválida debe rechazarse y explicar exactamente qué Historias/Steps quedarían inválidos.* Este slice sólo la **habilita** (`removalImpact`); no la aplica.

### 15.1 Regresión completa

| Comprobación | Resultado |
|---|---|
| Fluyo `node --test test/*.test.cjs` | **592/592** (antes de la QA 540; +52 nuevos en `fluyo-017-1-qa.test.cjs`) |
| Fluyo `node --check js/*.js test/*.cjs` | OK |
| Fluyo `git diff --check` | **1 hallazgo propio**: línea en blanco sobrante al final de `.ai/DECISIONS.md` (introducida por el slice anterior) → corregido. Sólo quedan avisos `LF/CRLF` del entorno (autocrlf en Windows). |
| MCP `npm test` (build + tests), con y sin `REQUIRE_FLUYO=1` | **294/294**, 0 omitidos (antes 261; +33 en `fluyo-017-1-qa.test.ts`) |
| MCP `npm run build`, `check:kernel`, `check:config` | OK |
| MCP `git diff --check` | limpio (sólo avisos CRLF del entorno) |

Clasificación de lo observado: *regresión*: ninguna. *Test desactualizado*: ninguno (los pines de SW v61 ya se habían actualizado). *Problema de entorno*: (a) el working copy de ambos repos está en CRLF (autocrlf; los índices son LF; `sync-kernel` normaliza CRLF→LF, por eso el hash no depende del checkout); (b) un `npm error` transitorio al lanzar `npm test` justo después de borrar el directorio temporal de mutaciones (que contenía una *junction* a `node_modules`): no se reprodujo; se comprobó que `node_modules` está íntegro (`npm ls`, 94 entradas) y todo vuelve a verde; (c) en un primer intento las copias aisladas de las mutaciones daban 2 fallos de línea base porque faltaban `index.html` y `sw.js` (los comprueba el test de «sin módulos ES»); era un defecto del arnés de la QA, corregido (línea base 0/0).

### 15.2 Bugs encontrados y correcciones (dentro del scope)

| # | Hallazgo | Evidencia | Corrección |
|---|---|---|---|
| Q1 | **`removalImpact` lanzaba `TypeError`** con argumentos mal formados (`edgeIds: 5`, `removal` indefinido). | Test hostil. | Argumentos no-array se tratan como vacíos; `removal` ausente → `page_not_found`. |
| Q2 | **Errores de integridad sin localizar**: ids de Historia, de Step o de EventType duplicados, Historias mal formadas (nombre, motor, Steps), Behaviors y elementos inválidos caían en un `invalid_document` genérico (documento entero). | Sondeo de 70 documentos hostiles y fuzz de 4.000 mutaciones. | `diagnose` ahora localiza con las funciones de `model.js` sobre copias aisladas: `duplicate_story_id`, `duplicate_step_id`, `duplicate_event_type_id`, `invalid_scenario` (con `storyId`), `invalid_behavior`, `invalid_structure`. Los códigos nuevos son sólo `duplicate_story_id` y `duplicate_event_type_id`; el resto reutiliza los del motor. |
| Q3 | **Etiquetas sin tope** en `describe_document`/`run_story`: un elemento `code` con un bloque de 40 líneas se devolvía entero. | Test de contrato. | Se resume a una línea de ≤ 80 caracteres (`…`). La referencia fiable sigue siendo el id; la frase del Step usa la primera línea (kernel). |
| Q4 | **Faltaba el estado final** entre lo que se pidió comparar. | Revisión del contrato. | `FluyoStory.finalAvailability(trace, page)` (kernel) y `finalAvailability` en `run_story`; se compara con el estado final que pinta el Playback del editor. |
| Q5 | `git diff --check`: línea en blanco al final de `DECISIONS.md`. | `git diff --check`. | Corregida. |

Ninguna corrección cambia arquitectura ni entra en autoría. Q2/Q4 tocan el kernel (`document-integrity.js`, `story-playback.js`); la copia de MCP se resincronizó (`sync:kernel`, `check:kernel` verde).

### 15.3 Auditoría de `FluyoIntegrity` (documentos hostiles)

34 casos tabulados (`hostil · …`), cada uno comprueba el error exacto `[code, scope, storyId, stepId, entityKind, entityId]`, que la entrada no se muta y que la respuesta es determinista:

- **Referencias**: Step de conexión → id de nodo; Step de nodo → id de conexión (OCCURRENCE y SET_STATE); conexión/nodo/EventType inexistentes; origen y destino de conexión inexistentes; Behavior de nodo inexistente; Behavior con estado inválido.
- **Relaciones EventType↔acción**: FLOW sobre OCCURRENCE, SET_AVAILABILITY usado en un envío, SET_STATE que contradice la disponibilidad del EventType.
- **Historias**: vacía (válida), con un Step inválido, ids de Historia/Step/EventType/nodo repetidos, id de conexión igual al de un nodo, varias Historias compartiendo EventType y conexión (válido). **Ids repetidos entre páginas son legales** (los ids son por página) y se verifica.
- **Versiones**: schema 1–5 y ausente válidos (incluido el formato v1 con `state`); 0 y 6 → `unsupported_version`; «5» o `app` distinta → `invalid_document`; motor 3 → `unsupported_engine_version`; motor 0/«2»/2,5 u OCCURRENCE en motor 1 → `invalid_scenario`.
- **Forma**: tiempo negativo / no entero / > 24 h, acción desconocida, campo extra, SET_STATE sin estado, nombre vacío, EventType con frase inválida.
- **Propiedades**: determinista; no muta; sin DOM ni globales del navegador; entradas no-documento (`null`, `[]`, `"x"`, `{}`) nunca lanzan; 5.000 elementos × 63 Historias se validan en ≈ 0,2 s.
- **Fuzz** (1.500 mutaciones deterministas en la suite, 4.000 en la sesión de QA): jamás lanza; `valid` ⇒ todas las Historias ejecutables; `executable` ⇔ `executed` en `run_story`; `describe.valid === validate.valid`; ilegible ⇒ no válido; la entrada no muta. 0 inconsistencias.

Comportamiento de normalización **heredado del editor** (no es un bug, pero conviene saberlo, ver 15.12): contadores `nextId/nextStepId` bajos se corrigen en silencio; Behaviors repetidos para un nodo se canonizan (gana el último); el documento «válido» puede diferir del bruto.

### 15.4 B2 / `removalImpact` bajo ataque

| Escenario | Resultado |
|---|---|
| H1 usa A→B; quitar A, B o A→B | H1, Step 1, `missing_edge` (conexión 4) en los tres casos |
| H1 y H2 usan A→B, H3 no; quitar B o A→B | exactamente H1 y H2; **no** H3 |
| Igual, quitar A | H1 y H2 (`missing_edge`) y H3 (usa A en un OCCURRENCE: `missing_node`), cada una con su código |
| Step retargetado a otra conexión + eliminar la original (estado final válido) | `wouldInvalidate:false` |
| Mismo documento sin retarget | `wouldInvalidate:true` (se distinguen) |
| Conexión 3 de la página 2 con ids repetidos en la página 1 | sólo la página 2 |
| Error previo en otra Historia | no se atribuye a la eliminación |
| Argumentos hostiles (`undefined`, `{}`, `nodeIds:"x"`, `pageIndex:-1`…) | no lanza (Q1) |

Evalúa el **estado final**, no la secuencia; no modifica nada (probado también con entradas congeladas).

### 15.5 `describe_document`: auditoría de contrato

- Con el fixture complejo (2 páginas, 4 elementos, 6 EventTypes, 4 Historias) un agente responde **sin documento crudo**: páginas, nodos (con disponibilidad inicial), conexiones, EventTypes (con acción/objetivo/motion/`usedBy`), Historias, qué hace cada Step (evento, objetivo, frase), qué usa cada Step y **cuándo** ocurre (momentos por `at`, simultaneidad visible, orden de resolución, Step legacy sin EventType).
- **Sin fugas**: se verifica que cada clave del resultado está en una lista blanca y que no aparecen `nodeEffects`, `connectionEffects`, `presentation`, `visualDuration`, `waypoints`, `customBg`, `theme`, `settings` ni nada de runtime de Playback/editor (`activeSends`, `cursorVirtual`, `undo`, `autosave`…).
- **Tamaño**: documentos reales publicados (3–5 KB) → ≈ 2,3–2,8 KB; el coste fijo (`capabilities`, `unmodeled`, biblioteca) pesa en documentos muy pequeños (4,3 KB para un documento de 2,8 KB). Con 60 páginas × 3 elementos, `includeSteps:false` < 50 % del documento y `pageIndex` acota la respuesta.
- Documento vacío, multipágina, legacy v1, v3 generado por `create_diagram`, sin Historias, con Historias, EventTypes compartidos y 8 ejemplos publicados: legibles y válidos.
- **Observado, no rediseñado**: demasiado verboso en documentos mínimos (ver 15.12-L2); sin marcado de etiquetas duplicadas (el agente debe usar ids).

### 15.6 `run_story` y OCCURRENCE

- **Kafka DOWN (B)**: comparado con `deepStrictEqual` el Trace completo —`state_changed(UP→DOWN)@0`, `send_started/send_failed(target_down)@1000`, `event_occurred@2000`, `send_started/send_failed(source_down)@3000`— y el resultado, razón y `eventIndexes` de cada Step, y la disponibilidad final.
- **OCCURRENCE con Kafka DOWN**: `status:"narrated"`, `nodeAvailability:"DOWN"`, sin `reason`, sin evento de éxito/fallo asociado en el Trace, la frase del relato («Kafka procesa el evento») separada de la consecuencia del motor, y se comprueba que la respuesta no contiene afirmaciones de que Kafka «procesó». Con el elemento UP el estado sigue siendo `narrated` (no existe un «éxito» de OCCURRENCE). `unmodeled` lo declara siempre.
- Historia no ejecutable (conexión eliminada, EventType inexistente, motor 3): sin Trace, `reason:"story_not_executable"`, errores con Historia/Step. Una Historia sana de un documento con otra rota se ejecuta e informa de ambas cosas.

### 15.7 Paridad editor ↔ MCP (fixture complejo)

`test/fixtures/fluyo-017-1-qa-complejo.fluyo.json` (+ `…-qa-golden.json`, idénticos en ambos repos): 4 elementos (Cliente, Kafka, Comercio, Banco) y 2 páginas; **Banco DOWN inicial** (Behavior de página); EventTypes con `motion` fast/slow y `presentation` (`nodeEffects` con mensaje/resaltado/parpadeo/duración larga; `connectionEffects` con tamaño/estilo/rastro/llegada/mientras viaja); 4 Historias: S1 (waits 0 / 500 / 2500 / 7000, **tres pasos simultáneos**, envío fallido por Banco caído, Step legacy sin EventType), S2 (Kafka cae y vuelve; *cae y confirma en el mismo momento*: manda el orden del array; pago con Kafka caído; OCCURRENCE narrado con Kafka DOWN), S3 (motor v1) y una Historia con el mismo id en la 2.ª página.

- **Camino A (Fluyo real)**: editor en el arnés de FLUYO-016, `scSelectStory; scRun` → `scPlayback.trace`, `scPlayback.stepMeta` y el estado final (`FluyoScenarioPlayback.tick` al final).
- **Camino B (MCP)**: kernel copiado + tool `run_story`.
- `assert.deepStrictEqual` sobre: **Trace** (eventos, orden, tiempos virtuales, códigos de fallo), **metadata de Step** (token, motion, efectos de elemento, efectos de conexión, nombre), **resultados por Step**, **estado final** (Playback y `finalAvailability`), `traceDigest`. Para las 4 Historias. Verde.
- Se comprueba además que el fixture no es trivial (resultados esperados de S1 y S2 fijados a mano) y que **el orden de array en el mismo momento cambia el resultado** (S2 con «confirmar» antes de la caída → `completed`).
- **Normalización**: ninguna. No se normalizó ningún campo (los ids de Step/Historia/EventType y los tiempos virtuales son deterministas); `startedAtReal`, único campo dependiente del reloj, no forma parte de lo comparado.

### 15.8 Kernel drift

`sed s/source_down/source_dowx/` sobre `src/generated/kernel-sources.ts` → `check:kernel` **exit 1** («NO coincide con fluyo/js»); restaurado desde copia: sha256 idéntico (`70a030ed…`) y `check:kernel` vuelve a verde. Sin `fluyo/` (`FLUYO_PATH` inexistente) avisa con `omitido` y sale 0. Además los tests detectan la copia desviada por hash, por igualdad con `fluyo/js` y por el golden.

### 15.9 Aislamiento

- Entradas **profundamente congeladas** (`Object.freeze` recursivo): `validateProject`, `removalImpact`, `run`, `outcomes`, `finalAvailability`, `stepMeta` (en el kernel, con scripts en `"use strict"`) y `describeDocument`/`runStory` (MCP) no intentan mutarlas.
- Snapshot antes/después en MCP: documento, EventTypes, nodos, conexiones, Behaviors, Historias, Steps y contadores idénticos tras `describe` + `run` de las 4 Historias.
- **run(A), run(B), run(A)**: la 3.ª es `deepStrictEqual` a la 1.ª (y distinta de B), en el kernel (mismo contexto) y por la tool; también intercalando documentos distintos y con peticiones concurrentes.
- No hay undo, autosave ni runtime persistente en MCP: cada llamada crea un contexto `vm` nuevo (verificado: el `doc` de un kernel no aparece en el siguiente; `window/document/process/require` no existen dentro).

### 15.10 MCP real por stdio

Se levanta el servidor compilado (`dist-test/src/index.js`) con el cliente MCP del SDK por stdio (`StdioClientTransport`) y se probó antes además `node dist/index.js` a mano: `tools/list` con `readOnlyHint`; `describe_document` y `run_story` sobre el documento real; **documento inválido** → resultado estructurado (`executed:false`, `missing_edge` con Historia, Step y conexión; `isError:false`); **motor incompatible** → `unsupported_engine_version` y `executable:false`; **schema demasiado nuevo** → `readable:false`/`document_unreadable`; **Historia inexistente** y **página inexistente** → error de tool legible con los ids existentes; entradas absurdas (`document:"texto"`, `storyId:"x"`, `-1`, ausente) → mensaje del SDK/servidor. En ningún caso aparece una traza interna (`at …`, `node:internal`, `.ts:`/`.js:línea`).

### 15.11 Mutaciones (copias aisladas en un directorio temporal, borradas al terminar)

Línea base de las copias: 0 fallos en Fluyo y en MCP. Cada fila: fallos en los tests de Fluyo / en MCP (kernel regenerado desde el Fluyo mutado y comparado con el Fluyo real) / `check:kernel` contra la fuente mutada.

| # | Mutación | Fluyo | MCP | check:kernel |
|---|---|---|---|---|
| M1 | eliminar `FluyoIntegrity.validateProject` | 60 | 52 | ✖ |
| M2 | `validateProject` siempre `valid:true` | 15 | 3 | ✖ |
| M3 | eliminar `removalImpact` | 15 | 1 (identidad del kernel; MCP no expone `removalImpact`) | ✖ |
| M4 | cambiar el código B2 `missing_edge` | 9 | 4 | ✖ |
| M5 | MCP usa una copia distinta del kernel (hashes regenerados y coherentes) | — | 11 | ✖ |
| M6 | modificar `source_down` | 4 | 10 | ✖ |
| M7 | saltarse la validación en `run_story` | — | 1 | — |
| M8 | Trace truncado en `run_story` | — | 12 | — |
| M9 | OCCURRENCE «narrado» → «completado» (kernel) | 7 | 19 | ✖ |
| M10 | ignorar EventTypes inexistentes | 2 | 2 | ✖ |
| M11 | `describe_document` siempre `valid:true` | — | 2 | — |
| M12 | MCP inventa «completed» para OCCURRENCE | — | 13 | — |
| M13 | `describe_document` marca todas las Historias como ejecutables | — | 2 | — |

Todas las mutaciones relevantes se detectan. Punto débil honesto: M7 y M3-en-MCP dependen de **un** test cada una (EventType inexistente en `run_story`; identidad del kernel), suficiente para el invariante pero sin redundancia.

### 15.12 Limitaciones (conocidas, no corregidas)

- **L1 · Tamaño de respuesta.** Una Historia de 1.000 pasos produce `run_story` ≈ 713 KB (400 KB compacto) y `describe_document` ≈ 574 KB; el endpoint remoto corta a 200 KB y su mensaje genérico habla del «documento», no de la respuesta. En stdio no hay tope. Historias reales (decenas de pasos) están muy por debajo.
- **L2 · Coste fijo de `describe_document`** (`capabilities`, `unmodeled`, biblioteca ≈ 1,6 KB): domina en documentos mínimos. No se rediseña.
- **L3 · Localización de fallos de estilo**: campos visuales inválidos (geometría, forma, `theme`, `customBg`, lados de conexión, extremos de conexión no enteros) siguen dando `invalid_document` sin ubicación (el documento es ilegible y se informa en conjunto).
- **L4 · Normalización silenciosa heredada** del editor (contadores, Behaviors repetidos): `valid:true` no implica que el documento bruto sea idéntico al normalizado.
- **L5 · Páginas sin id**: `pageIndex` posicional.
- **L6 · Etiquetas duplicadas** no se marcan (usar ids).
- **L7 · No se ejecutaron los tests de navegador (Chrome/Playwright)** de Fluyo: el cambio de `story-playback.js` es una extracción sin cambio de comportamiento, cubierta por la suite vm (540 → 592) y por la prueba con el editor real en el arnés de FLUYO-016; no sustituye una pasada visual en Chrome antes de publicar `sw.js` v61.
- **L8 · Sin `REQUIRE_FLUYO=1` en un clon sin `fluyo/`** las comparaciones con el repo hermano se omiten (el job `drift` de CI las exige).

### 15.13 FUTURE SCOPE (no implementado a propósito)

**FS1 · B2 en el editor.** *Problema:* `deleteSel` borra nodos/conexiones sin tocar Steps ni Behaviors. *Evidencia:* `removalImpact` y los tests B2 sobre el fixture (borrar la conexión 5 invalida A y B; borrar un nodo deja además un Behavior huérfano, `missing_behavior_node`). *Impacto:* un usuario rompe Historias sin aviso (hoy sólo lo ve al reproducir). *Propuesta:* aplicar la política fijada («rechazar o explicar exactamente qué Historias/Steps quedarían inválidos», con confirmación y Undo en el editor) usando `FluyoIntegrity.removalImpact`; decisión de UX pendiente.

**FS2 · `edit_diagram` (`remove_node`/`remove_edge`).** *Problema:* devuelve éxito con un documento que deja de ser ejecutable y deja `behaviors` huérfanos. *Evidencia:* mismo `removalImpact` (reproduce lo que hace `src/diagram.ts`). *Impacto:* un agente entrega un documento roto con `ok`. *Propuesta:* en el slice de autoría, evaluar el estado final del lote con `FluyoIntegrity` y rechazar con `affectedStories[{storyId, storyName, stepIds, codes}]`; permitir retargetar/quitar Steps en el mismo lote.

**FS3 · Retargeting / reparación.** *Problema:* hoy no existe operación para actualizar referencias antes de borrar. *Evidencia:* §15.4 (el estado final con retarget es válido, pero nada permite construirlo vía MCP). *Impacto:* la política «rechazar» sin camino de reparación obliga a borrar y recrear. *Propuesta:* `retarget_step` (objetivo compatible con `eventActionSpec`) como operación explícita de Historia.

**FS4 · Alcance global de un Behavior de página.** *Evidencia:* en el fixture complejo «Banco DOWN» inicial rige en **todas** las Historias de la página (S2 lo recupera con un Step). *Impacto:* una edición local puede cambiar Historias no leídas. *Propuesta:* toda operación de scope `page`/`eventType` devuelve `affects` (diseño §3.2) y se prefiere `SET_STATE` dentro de la Historia para variantes.

**FS5 · Normalización visible.** *Evidencia:* L4. *Impacto:* un agente puede creer que no cambió nada. *Propuesta:* que `author_document` informe de las correcciones de normalización (`normalized:[…]`) y de `baseRevision`/`resultRevision`.

**FS6 · Edición de EventTypes vía MCP.** Global por definición (dec. 13/35); requiere `affects` y `expectedUseCount` (diseño §3.2). Sin evidencia de bug; se deja explícito que nada de la QA lo toca.

**FS7 · Sesión viva.** Sin cambios: MCP sigue siendo documento-entra/documento-sale; ninguna prueba depende de estado compartido.

**FS8 · Respuestas grandes** (L1): `includeTrace:false` / paginación del Trace y un mensaje de tope específico para estas tools.

### 15.14 Conclusión

- **A. Integrity** — *Sí, de forma fiable.* 34 casos hostiles localizados con código/ámbito/Historia/Step/entidad exactos, determinista, sin mutar, sin DOM, 4.000 mutaciones de fuzz sin una excepción ni una inconsistencia, y mutaciones del propio validador detectadas. Límite: L3 (fallos de estilo no localizados) y L4 (normalización silenciosa).
- **B. Describe** — *Sí.* Responde las 8 preguntas sin JSON crudo, sin fugas de estilo/Playback/editor (lista blanca verificada); etiquetas acotadas. Verboso sólo en documentos mínimos (L2).
- **C. Run** — *Sí.* Historia normal, Kafka caído (códigos y orden del Trace exactos), OCCURRENCE narrado, Historia inválida sin Trace y errores estructurados, también por stdio real.
- **D. Parity** — *Sí.* Trace, metadata de Step, resultados, tiempos virtuales, orden, códigos y estado final: `deepStrictEqual` entre el editor real, el kernel y `run_story` sobre dos fixtures (el complejo con waits, simultaneidad, disponibilidad inicial, efectos visuales, motion y fallos); sin campos normalizados.
- **E. Isolation** — *Sí.* Entradas congeladas, snapshot antes/después, run(A)/run(B)/run(A) idénticos, contextos `vm` nuevos, sin estado residual.
- **F. Kernel** — *Sí.* Copia verbatim con sha256 y `kernelId`; `check:kernel` detecta una desviación mínima (`source_down`) y vuelve a verde al restaurar; MCP no contiene reglas del motor (comprobado por búsqueda en `src/`); una copia coherente-pero-distinta (M5) es detectada.
- **G. B2** — *Sí.* `removalImpact` identifica exactamente las Historias y Steps afectados (y no otras), evalúa el estado final (retarget + borrado válido), no modifica nada. La política queda fijada; no está aplicada.
- **H. Qué falta para autoría** — (1) `author_document`: lote atómico sobre copia con `scope` explícito por operación; (2) las extracciones E3–E5 del diseño (`storyboardSetWait`, `setInitialAvailability`, `stepDefinitionForEvent`) fuera de `editor-scenarios.js`; (3) aplicar la política B2 usando `FluyoIntegrity` en el lote (rechazo con `affectedStories`) y `retarget_step` (FS2/FS3); (4) informe de cambios con `baseRevision/resultRevision`, `affects` y correcciones de normalización (FS4/FS5); (5) límite/paginación de respuesta (FS8); (6) decisión de producto sobre el editor (FS1); (7) una pasada visual en Chrome del editor antes de publicar `sw.js` v61 (L7).

**FLUYO-017.1 = READY FOR DONE.** Todo verde: Fluyo 592/592, MCP 294/294 (también con `REQUIRE_FLUYO=1`), `check:kernel`/`check:config`/`build` OK. Sin commit ni push; no se empezó FLUYO-018.
