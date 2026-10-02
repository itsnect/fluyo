# FLUYO-017.2 — MCP Story Authoring

> **Actualización (FLUYO-017.3).** `delete_connection` y `delete_node` **ya no existen**: se retiraron por salirse del alcance de este slice (ver `FLUYO-017.3.md` §0). Lo que sigue de ellas en este documento es **histórico**. Se conserva `FluyoIntegrity.removalImpact` y la política B2 (los tests la ejercitan sobre el estado final). Los EventTypes **sí** se crean, editan y eliminan desde 017.3 (scope `eventType`).

Estado: IMPLEMENTADO Y VERIFICADO (autoría de Historias vía MCP). Sin commit, sin push. No se empezó FLUYO-018.
Fecha: 2 de octubre de 2026.
Alcance: `author_document` (lote atómico de operaciones de Historia sobre una copia, con revisión optimista y B2 aplicado), extracción al dominio de la semántica de autoría que vivía en el editor, paridad con el editor real. No hay edición de EventTypes, creación/edición libre del diagrama, `edit_diagram`, sesión viva, persistencia ni UI.

Contexto previo: FLUYO-017 (auditoría), 017.1 (contrato + lectura/validación/ejecución, §14–§15 de `FLUYO-017.1.md`). Política B2 fijada en la QA de 017.1: *una operación de autoría que deje una Historia inválida se rechaza y explica qué Historias/Steps quedarían inválidos*.

## 1. Garantía

```text
describe_document ──▶ author_document ──▶ FluyoIntegrity ──▶ run_story ──▶ Trace
   (revision)        (copia · lote atómico)  (estado final)
```

**Si MCP puede crear una Historia, Fluyo puede ejecutarla sin saber que la creó MCP.** Se prueba de tres maneras: (a) el resultado se valida con `FluyoIntegrity` y toda Historia creada/editada debe ser ejecutable (si no, se rechaza el lote); (b) el editor real, ejecutando su propio Playback sobre la Historia creada por `author_document`, produce el mismo Trace; (c) la misma Historia construida por el editor (funciones reales del panel) y por `author_document` es idéntica paso a paso.

## 2. Arquitectura

```text
editor-scenarios.js ──┐                                     ┌── fluyo-mcp: author_document
 (undo, UI, autosave) ├── model.js (dominio compartido) ────┤   (copia · revisión · forma de la respuesta)
                      │                                     │
                      └── story-authoring.js (FluyoAuthoring.apply) ──→ FluyoIntegrity ──→ motor
```

### 2.1 Extraído del editor a `model.js` (el editor ya consume estas funciones; ni MCP ni el editor tienen copia)

| Función | Qué hace | Antes |
|---|---|---|
| `storyboardSetWait(steps, id, delay, maxAt)` | Espera = tiempo desde el momento anterior (desde 0 si es el primero); desplaza ese momento **y todos los posteriores**. `null` si el Step/espera no es válido; `{error:"out_of_range"}` fuera del tope; `{steps, changed}`. | `scSetStepDelay` |
| `setInitialAvailability(pg, nodeId, state)` | Disponibilidad **inicial** = Behavior de la página; UP no deja Behavior; DOWN queda una vez. | `scSetBehavior` |
| `stepDefinitionForEvent(et, target, at)` | Definición del Step: **la acción sale del EventType** (FLOW→SEND, OCCURRENCE→OCCURRENCE, SET_AVAILABILITY→SET_STATE con su estado). | `scApplyTargets` |
| `eventTypeActionSpec(et)` | Única tabla primitiva→acción/tipo de objetivo. `FluyoIntegrity.eventActionSpec` delega en ella. | duplicada en 017.1 |
| `defaultStepTime(sc, delay)` | Tiempo de un Step añadido al final (0 si vacía; último momento + 1 s). | `scStepDefaultTime` + const del editor |
| `duplicateStep(sc, id)` | Copia en el mismo momento, justo debajo, sin desplazar. | `scDuplicateStep` |
| `retargetStep(pg, sc, stepId, targetId)` | Cambia **sólo** el objetivo (conserva id, EventType, tiempo, orden, presentación). | inline en `scUseTarget` |
| `projectToSerializable(doc, settings)` | Formato de guardado (v5); `serializeProject` lo usa. | inline |

`editor-scenarios.js` llama ahora a esas funciones (un test lo comprueba y que no conserve la lógica antigua). Los tests existentes del editor (FLUYO-012/012.1/016…) siguen verdes sin tocarlos.

### 2.2 `FluyoAuthoring.apply(project, operations)` (`js/story-authoring.js`)

Clásico, sin DOM, **sin usar ni modificar la global `doc`**. Normaliza una copia (`projectFromProjectData`), aplica el lote en orden con las funciones de §2.1 y las `storyboard*` existentes, valida el **estado final** con `FluyoIntegrity` y devuelve `{ok:true, project, changes, touched, validation}` o `{ok:false, errors}`. Sólo contiene: la forma/estricta de las operaciones, la resolución de `ref` del lote, el cálculo de `affects` y la explicación de rechazos. Ninguna regla de tiempo, acción, destino ni integridad (hay un test de que no menciona el motor).

## 3. Contrato de `author_document`

Entrada: `{document, baseRevision, operations[1..200], dryRun?}`.
Salida (JSON en el 2.º bloque; el 1.º es un resumen):

```text
ok:true  →  valid, dryRun, schemaVersion(5), engineVersion, kernelId,
            baseRevision, resultRevision, changed,
            changes[{operation, scope, operationIndex, pageIndex, entityKind, entityId, created?/deleted?, …, affects{stories[{pageIndex,storyId,name,stepIds?,removedStepIds?}], note?}}],
            touchedStories[{pageIndex,storyId}], validation{valid, preexistingErrors}, unmodeled,
            document   (omitido con dryRun; formato de guardado de Fluyo v5)
ok:false →  valid:false, baseRevision, actualRevision?, errors[...], note   (isError:true; NUNCA hay document)
```

### 3.1 Operaciones y alcance

Cada operación declara `scope` y el servidor lo verifica (`SCOPE_MISMATCH`). Campos desconocidos se rechazan (`INVALID_OPERATION`): nadie puede escribir `action`, `state` ni `at`.

| Operación | Scope | Campos | Reutiliza |
|---|---|---|---|
| `create_story` | story | `pageIndex`, `name?`, `ref?` | `createScenario`, `defaultScenarioName` |
| `rename_story` | story | `storyId`, `name` | — |
| `duplicate_story` | story | `storyId`, `name?`, `ref?` | `duplicateScenario` |
| `delete_story` | story | `storyId` | `deleteScenario` |
| `add_step` | story | `storyId`, `eventTypeId`, `target`, `waitMs?` \| `placement{sameMomentAs, position?}`, `ref?` | `stepDefinitionForEvent`, `defaultStepTime`, `createStep`, `storyboardMoveStep` |
| `remove_step` | story | `storyId`, `stepId` | `storyboardRemoveStep` (colapsa la espera) |
| `move_step` | story | `storyId`, `stepId`, `direction` \| `to{gapIndex}` \| `to{sameMomentAs, after}` | `storyboardMoveByOne`, `storyboardMoveStep` |
| `duplicate_step` | story | `storyId`, `stepId`, `ref?` | `duplicateStep` |
| `retarget_step` | story | `storyId`, `stepId`, `target` | `retargetStep` |
| `set_wait` | story | `storyId`, `stepId`, `waitMs` | `storyboardSetWait` |
| `set_initial_availability` | **page** | `nodeId`, `state` | `setInitialAvailability` |
| ~~`delete_connection`~~ | ~~page~~ | — | **retirada en 017.3** |
| ~~`delete_node`~~ | ~~page~~ | — | **retirada en 017.3** |

- `storyId`/`stepId` aceptan `{ref}` de algo creado antes en el mismo lote. Los ids de Historia son **por página** (`pageIndex` siempre).
- **Target**: `{edgeId}` o `{from, to}` (la conexión entre dos elementos; `AMBIGUOUS_TARGET` si hay varias) para eventos de conexión; `{nodeId}` para eventos de elemento. Debe existir y ser del tipo que exige la acción del EventType (`TARGET_INCOMPATIBLE` / `TARGET_NOT_FOUND`). No hay tipos nuevos.
- **EventTypes**: en 017.2 sólo se referenciaban (`EVENT_TYPE_NOT_FOUND`). Desde 017.3 hay `create_event_type`, `update_event_type` y `delete_event_type` (scope `eventType`): ver `FLUYO-017.3.md`.

### 3.2 Semántica temporal (política de FLUYO-012, sin reescribirla)

El agente habla de **acontecimientos y esperas**, no de `at`:

- `add_step` sin `placement`: al final, tras `waitMs` (por defecto 1000; el primero entra en 0).
- `add_step` con `placement.sameMomentAs`: **al mismo tiempo**. Sin `position` resuelve después de los existentes (igual que «Añadir al mismo tiempo» del editor); con `position: before|after` se coloca junto al ancla.
- `set_wait(B, 2 s)`, `set_wait(C, 5 s)`: A · 2 s · B · 5 s · C. Cambiar la espera de un momento mueve ese momento y todos los posteriores. `waitMs: 0` une el paso al momento anterior («al mismo tiempo») sin inventar un retraso.
- `remove_step`: A·3 s·B·4 s·C, quitar B → **A·4 s·C** (no 7 s).
- `duplicate_step`: la copia entra en el mismo momento, justo debajo; no desplaza nada.
- `move_step`: los instantes son ranuras (el contenido se mueve, los tiempos se quedan); no se inventan instantes.

### 3.3 Atomicidad, revisión y dry run

- **Atómico**: copia → lote → validación final. Si una operación falla o la validación final falla, no se devuelve ningún documento; el original nunca se modifica (probado con entradas congeladas).
- **Revisión**: `revision` = sha256 del JSON canónico (claves ordenadas) del documento **normalizado** (así no depende del formato ni del orden de claves). `describe_document` y `run_story` la anuncian. `baseRevision` es obligatoria: no coincide → `REVISION_MISMATCH` (con la revisión real). `resultRevision` es determinista: misma entrada + mismas operaciones → mismo resultado; la revisión del documento devuelto es `resultRevision` (idempotente: se puede encadenar). Sin timestamps, aleatoriedad ni estado del proceso.
- **dryRun**: `clone → apply → validate → discard`: mismos `changes` y `resultRevision`, sin `document`.
- `isError:true` en rechazos, con JSON estructurado y sin trazas internas.

### 3.4 B2 aplicado

Se evalúa el **estado final del lote** con `FluyoIntegrity` y se comparan los errores con los del documento base: sólo cuentan los **nuevos** (los preexistentes se informan en `validation.preexistingErrors` y no bloquean). Un error nuevo de referencia se explica como:

```text
code: REFERENCED_ENTITY
entity: {kind: "connection"|"element", id, pageIndex}
affectedStories: [{pageIndex, storyId, storyName, stepIds[]}]
affectedSteps:   [{pageIndex, storyId, stepId}]
operationIndex   (la operación que quitó la entidad)
```

- Borrar una conexión usada → rechazado (todas las Historias afectadas identificadas; la que no la usa, no).
- Borrar un nodo usado → rechazado (el elemento y cada conexión que se llevaba, con sus Historias y pasos).
- (histórico) `retarget_step` + `delete_connection` en el mismo lote (en cualquier orden) → **válido**; hoy se ejercita con `removalImpact` sobre el estado final; si sólo se repara una Historia se nombra la que falta.
- Quitar los pasos que referencian y borrar en el mismo lote → válido.
- Además, toda Historia creada o editada por el lote debe quedar **ejecutable** (`STORY_NOT_EXECUTABLE` si no).

### 3.5 Códigos de error

`UNKNOWN_OPERATION · SCOPE_MISMATCH · INVALID_OPERATION · INVALID_NAME · INVALID_WAIT · WAIT_OUT_OF_RANGE · PAGE_NOT_FOUND · STORY_NOT_FOUND · STEP_NOT_FOUND · EVENT_TYPE_NOT_FOUND · TARGET_NOT_FOUND · TARGET_INCOMPATIBLE · AMBIGUOUS_TARGET · UNKNOWN_REF · UNSUPPORTED_ENGINE_VERSION · MAX_STEPS · MOVE_UNSUPPORTED · REFERENCED_ENTITY · STORY_NOT_EXECUTABLE · INTEGRITY_VIOLATION · DOCUMENT_UNREADABLE · REVISION_MISMATCH`.

## 4. Decisión que conviene revisar (desviación explícita) — RESUELTA en 017.3: las dos operaciones se retiraron

La petición pide no implementar «eliminación de conexiones» y a la vez exige probar `delete connection X` / `delete node` dentro de un lote (rechazo B2 y aceptación con retarget). Para poder ejercitar B2 en la frontera de autoría se implementaron **`delete_connection` y `delete_node` como operaciones de alcance `page` sujetas a integridad** (no hay creación de conexiones, edición de elementos, retarget estructural ni cambios en `edit_diagram`). Se llevan consigo lo que depende de ellas (conexiones del nodo y su Behavior). Si se prefiere que esas dos operaciones no existan, basta quitarlas de `OPERATION_SCOPE`/`HANDLERS` y del schema; el resto del slice no depende de ellas (los tests de B2 se reducirían a `removalImpact`, de 017.1).

## 5. Archivos

**fluyo** — nuevos: `js/story-authoring.js`, `test/fluyo-017-2.test.cjs` (67 tests), `test/fluyo-017-2-qa.test.cjs` (11), `test/fixtures/fluyo-017-2-golden.json`. Modificados: `js/model.js` (extracciones, `projectToSerializable`), `js/editor-scenarios.js` (consume las funciones compartidas), `js/document-integrity.js` (delega en `eventTypeActionSpec`; exporta `errorKey`), `.ai/ARCHITECTURE.md`, `.ai/DECISIONS.md` (73–77). `sw.js` ya estaba en `CACHE` v61 por 017.1; `model.js` y `editor-scenarios.js` son archivos servidos: **si v61 ya se publicó, hay que subir a v62 y actualizar los pines de los tests**.
**fluyo-mcp** — nuevos: `src/authoring.ts` (schema de operaciones, revisión, respuesta), `src/revision.ts` (JSON canónico, sha256, normalización), `test/fluyo-017-2.test.ts`, `test/fixtures/stories/fluyo-017-2-golden.json`. Modificados: `src/server.ts` (12.ª tool), `src/stories.ts` (`revision` en describe/run), `scripts/sync-kernel.ts` + `src/generated/kernel-sources.ts` (8 archivos de kernel), `README.md`, `test/tools.test.ts` (12 tools; presupuesto de `tools/list` de 30 000 → 40 000 caracteres: el schema de 13 operaciones ocupa ≈ 12 KB, total 35,8 KB), `test/http.test.ts` (paridad HTTP↔stdio incluye `author_document`), `test/fluyo-017-1.test.ts` (lista del kernel), `test/fluyo-017-1-qa.test.ts` (clave `revision` en la lista blanca de `describe`).

## 6. Pruebas y QA

| Comprobación | Resultado |
|---|---|
| Fluyo `node --test test/*.test.cjs` | **670/670** (antes 592; +78) |
| Fluyo `node --check js/*.js test/*.cjs` | OK |
| Fluyo `git diff --check` | limpio (sólo avisos LF/CRLF del entorno) |
| MCP `npm test`, con y sin `REQUIRE_FLUYO=1` | **334/334**, 0 omitidos (antes 294; +40) |
| MCP `build`, `check:kernel`, `check:config` | OK |
| MCP real por stdio | OK: describe → `author_document` (ok, `resultRevision`) y rechazo B2 (`REFERENCED_ENTITY`, `isError:true`), también vía SDK en la suite |
| Tests de navegador (Chrome) de Fluyo | **No ejecutados** (ver §8) |

Cobertura pedida: **creación** (vacía, con un paso, con varios, nombre, ids deterministas e irreutilizables), **edición** (rename, add, remove, move, duplicate, retarget, wait), **temporal** (A 2 s B 5 s C: mover, borrar, duplicar, simultaneidad), **B2** (conexión usada, nodo usado, retarget+borrar en ambos órdenes, varias Historias), **atomicidad** (op1 ok, op2 ok, op3 inválida ⇒ sin documento y original idéntico), **revisión** (correcta, incorrecta, mismo input ⇒ mismo `resultRevision`, independiente del formato, cambia con cualquier cambio), **dry run**, **paridad**.

### 6.1 Paridad con el editor

- **Por Historia completa**: las mismas 11 operaciones se ejecutan con las funciones reales del panel del editor (`scNewScenario`, `scApplyTargets` con y sin contexto «mismo momento», `scSetStepDelay`, `scDuplicateStep`, `scMoveStep`, `scChangeTarget`+`scUseTarget`, `scDeleteStep`, `scSetBehavior`) y con `author_document`: `deepStrictEqual` de los Steps (ids, tiempos, orden, EventType, objetivo), `nextStepId`, nombre y Behaviors; luego, del **Trace, outcomes, disponibilidad final y metadata de Step** al ejecutar ambos. Golden `fluyo-017-2-golden.json` (las operaciones viajan dentro) verificado también en fluyo-mcp contra la tool.
- **Aleatoria**: 40 secuencias × 14 operaciones sorteadas con semilla; tras **cada** operación se compara el editor real con `author_document` (≥ 400 estados) con `deepStrictEqual`. Ningún campo se normaliza.
- **Playback del editor** sobre la Historia creada por `author_document`: mismo Trace.
- **Idempotencia**: normalizar el resultado no lo cambia (la revisión del documento devuelto es `resultRevision`).

### 6.2 QA adversarial

- **Fuzz** (1.200 lotes deterministas en la suite; 4.000 en la sesión de QA, 0 violaciones): lo aceptado no introduce errores de integridad nuevos, toda Historia tocada es ejecutable (`run_story` la ejecuta), `changes` = nº de operaciones, determinista, `dryRun` = real, la revisión es idempotente, la entrada no muta; lo rechazado nunca trae documento y siempre `code` + `message`.
- **Mutaciones sobre copias aisladas** (21; línea base 0/0; cada una detectada; entre paréntesis fallos en Fluyo / MCP con el kernel mutado; `check:kernel` ✖ en todas las de kernel):

| # | Mutación | Fluyo | MCP |
|---|---|---|---|
| N1 | saltarse la validación final (B2) | 6 | 7 |
| N2 | B2 sin explicar qué Historias quedarían inválidas | 4 | 4 |
| N3 | operar sobre la entrada en vez de la copia | 1 | 2 |
| N4 | retarget también reinicia el tiempo | 4 | 3 |
| N5 | ignorar el `scope` declarado | 3 | 1 |
| N6 | la acción no sale del EventType | 14 | 8 |
| N7 | `set_wait` no desplaza los posteriores | 4 | 3 |
| N8 | `remove_step` sin colapsar la espera | 2 | 2 |
| N9 | `duplicate_step` desplaza | 3 | 4 |
| N10 | aceptar Historias tocadas no ejecutables | 1 | 2 |
| N11 | aceptar campos desconocidos (`action`, `at`) | 1 | 1 |
| N12 (histórico, la operación se retiró en 017.3) | `delete_connection` sin quitar la conexión | 4 | 7 |
| N13 | disponibilidad inicial como Behavior duplicado | 2 | 1 |
| N14 | `move_step` cambia los instantes | 2 | 4 |
| N15 | no comprobar `baseRevision` | — | 2 |
| N16 | `resultRevision` no determinista (reloj) | — | 35 |
| N17 | devolver documento en un rechazo | — | 4 |
| N18 | `dryRun` devuelve documento | — | 1 |
| N19 | `changes` vacío | — | 3 |
| N20 | la revisión ignora el contenido | — | 2 |
| N21 | rechazo sin `isError` | — | 5 |

- **Bugs encontrados durante la implementación** (corregidos): `affects` marcaba como «cambiados» los pasos posteriores a una inserción (cambio de índice, no de orden relativo); el mensaje B2 decía «referenciado» para una conexión (género); el kernel aceptaba campos desconocidos en operaciones (`action`, `at`…) si el cliente no usaba el schema de MCP → ahora se rechazan también en el kernel; el presupuesto de `tools/list` de un test quedó corto con 13 operaciones (se subió con justificación).

## 7. Limitaciones

- **Sólo Historias y disponibilidad inicial.** No hay edición de EventTypes, creación de conexiones/elementos, ni edición de estilos; `edit_diagram` sigue creando documentos v3 / borrando sin integridad.
- (histórico, retiradas en 017.3) **`delete_connection`/`delete_node`** (ver §4) borran la entidad con sus dependientes directos (conexiones y Behavior del nodo) y rechazan si alguna Historia la referencia; no hay «cascada» que limpie pasos: el agente debe retargetear o quitar los pasos en el mismo lote.
- **Insertar un momento nuevo en medio con espera** no existe: se compone con `add_step` + `move_step` (los instantes son ranuras) y `set_wait`.
- **`move_step`**: no se puede sacar un paso de un momento simultáneo a un hueco (limitación vigente del editor, dec. 41/50).
- **Historias del motor v1** se pueden renombrar/duplicar/borrar pero no editar sus pasos (como el editor).
- **La salida es el documento normalizado de Fluyo (v5)**: se pierden campos de nivel superior desconocidos (p. ej. `meta.generator`) y se canonizan contadores y Behaviors repetidos, igual que al abrirlo en el editor.
- **Tamaño**: el documento completo viaja de ida y vuelta (límite del endpoint remoto de 200 KB; en stdio no hay tope). `dryRun` evita devolverlo.
- **Revisión**: protege de documentos obsoletos entre lectura y escritura del mismo agente; no es un mecanismo de bloqueo entre agentes (el servidor es stateless).
- La integración con una UI que pida aprobación humana queda fuera de este slice.

## 8. FUTURE SCOPE

- **Editor y B2**: `deleteSel` sigue sin consultar `FluyoIntegrity` (decisión de producto pendiente; la política ya está fijada y probada en MCP).
- **Edición de EventTypes** (global, con `affects` y `expectedUseCount`, diseño de 017.1 §3.2) y **creación de conexiones/elementos** (para poder construir sistemas sin el editor).
- **`edit_diagram`**: llevarlo a la misma frontera de integridad (rechazar y explicar) y a v5.
- **Insertar momento con espera** (`add_step` con `afterMoment`+`waitMs`) y **paginación del Trace**/`includeTrace:false` (respuestas grandes).
- Una pasada visual en Chrome del editor antes de publicar: el editor cambió (se extrajo lógica) y sus tests de vm/arnés pasan, pero no se ejecutaron los de navegador.

## 9. Handoff

- **Qué se hizo:** extracción de 8 funciones al dominio compartido (el editor las consume), `FluyoAuthoring` (13 operaciones, lote atómico, B2 sobre estado final, `affects`), `author_document` con revisión canónica/dry run/schema estricto, `revision` en describe/run, README, ARCHITECTURE/DECISIONS (73–77), 78 tests nuevos en Fluyo y 40 en MCP, fuzz y 21 mutaciones.
- **Decisiones tomadas:** §4 (operaciones de borrado como página sujetas a B2); presupuesto de `tools/list` a 40 000; `isError:true` en rechazos; campos desconocidos rechazados en el kernel.
- **Pruebas:** §6.
- **Riesgos:** §7 y §8; tests de navegador pendientes; `sw.js`.
- **Próximo paso concreto (resuelto en 017.3: se retiraron `delete_connection`/`delete_node` y se implementó la edición de EventTypes):** decidir (1) ~~si `delete_connection`/`delete_node` se quedan~~; (2) siguiente slice: edición de EventTypes vía MCP o creación de conexiones/elementos; (3) política del editor ante B2.
