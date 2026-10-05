# FLUYO-017.3 — MCP EventType Authoring

Estado: **READY FOR DONE** (QA final ejecutada el 2 de octubre de 2026). Sin commit, sin push. No se empieza FLUYO-018.
Fecha: 2 de octubre de 2026.
Alcance: crear, modificar y eliminar EventTypes (la «biblioteca de eventos») con `author_document`, con **las mismas funciones de dominio que usa el editor**. No hay creación/edición/borrado de nodos o conexiones, ni `edit_diagram`, sesión, persistencia, agente ni generación de Historias.

## 0. Corrección previa de 017.2 (desviación de scope)

017.2 expuso `delete_connection` y `delete_node`, que su contrato no incluía. **Eliminadas** de `FluyoAuthoring` (`OPERATION_SCOPE`, `OPERATION_FIELDS`, handlers), del schema MCP (`src/authoring.ts`), de la descripción de la tool y de la documentación de 017.2. Se **conserva** `FluyoIntegrity.removalImpact` y la política B2; los tests de B2 ahora ejercitan `removalImpact` sobre el estado final (retarget por autoría + eliminación simulada = válida; sin retargetear una Historia se nombra la que falta). Nuevos tests comprueban que ambas operaciones dan `UNKNOWN_OPERATION` en el kernel y no aparecen en `tools/list`. Con ese cambio, `tools/list` volvió a ocupar 34 928 caracteres (35 783 antes) y reflejaba sólo el contrato de Story Authoring. No se tocó ninguna otra semántica.

## 1. Auditoría: el modelo real de un EventType

Fuente: `js/model.js` (`validateEventType`, `createEventType`, `updateEventType`, `deleteEventType`), el modal del editor (`js/editor-scenarios.js`: `scOpenEventDialog`, `scEditorDefinition`, `scSaveEventType`, `scDeleteEventUI`), el test `fluyo-010-qa` (dec. 17, 22) y `document-integrity.js`.

### 1.1 Campos persistidos (`doc.eventTypes[]`, contador `doc.nextEventTypeId`)

| Campo | Regla (en `model.js`) | Qué es |
|---|---|---|
| `id` | entero ≥ 1, único en el documento, asignado por `nextEventTypeId` (nunca se reutiliza) | identidad. **Global al documento**, no de una página ni de una Historia |
| `name` | texto 1–60 tras `trim` | nombre del evento («Pago») |
| `primitive` | `FLOW` \| `OCCURRENCE` \| `SET_AVAILABILITY` | dónde ocurre (conexión / elemento) y qué acción del motor produce: `FLOW→SEND`, `OCCURRENCE→OCCURRENCE`, `SET_AVAILABILITY→SET_STATE` |
| `sentenceTemplate` | texto 1–200; sólo marcadores `{source}` `{target}` `{name}` | la frase («{source} paga a {target}») |
| `visual` | `{kind:"token", value}`; `value` ≤ 8 caracteres (puede ser `""`: se pinta «●») | símbolo que viaja/aparece |
| `motion` | `fast` \| `normal` \| `slow` (opcional; defecto `normal`) | duración visual del viaje por una conexión |
| `availability` | `UP` \| `DOWN`, **sólo** si `primitive === SET_AVAILABILITY` (en otra primitiva se elimina) | estado que provoca el evento |
| `presentation` | `{nodeEffects?, connectionEffects?}`, cada rama normalizada campo a campo con valores por defecto | efectos visuales (FLUYO-011/015) |
| `presentation.connectionEffects` | `size` · `style` (direct/smooth/impulse) · `trail` · `arrival` · `during` (listas cerradas) | cómo viaja el símbolo por una conexión |
| `presentation.nodeEffects` | `showSymbol` `symbolSize` `message` (≤120) `messageColor` `messageSize` `messageWeight` `messageFont` `messagePosition` `highlight` `blink` `dim` `fillColor` `visualDuration` (`brief/normal/long/custom`) `visualDurationMs` (300–10000) | cue sobre un elemento |

**No hay** referencias a nodos ni a conexiones dentro de un EventType. Las referencias van al revés: un Step de una Historia lleva `eventTypeId` (no se copia el EventType) más su propio objetivo (`edgeId`/`nodeId`).

### 1.2 Qué edita el modal del editor, qué es derivado y qué es sólo presentación

- **Lo que edita la persona:** *Dónde* (conexión|elemento), *Consecuencia* (nada|disponible|no disponible, sólo elementos) → `primitive` y `availability`; nombre; frase (segmentos de texto + chips `source/target/name`); símbolo; movimiento (sólo conexión); efectos de conexión (conexión) o efectos de elemento (elemento).
- **Reglas de forma por primitiva que ya aplica el modal:** una conexión sólo tiene `motion` y `connectionEffects`; un elemento no tiene `motion` (queda `normal`) y sólo tiene `nodeEffects`; sólo `SET_AVAILABILITY` lleva `availability`.
- **Bloqueado si el evento está usado** (UI deshabilitada + `updateEventType` lanza): `primitive` y `availability` (dec. 17). **No se elimina** si está usado (dec. 22; la UI explica «se usa en N lugares»).
- **Derivado:** la acción y el tipo de objetivo (`eventTypeActionSpec`), el estado de un `SET_STATE`, la frase mostrada (`renderEventSentence`), `usedBy`, `id`.
- **Sólo presentación:** `visual`, `motion`, `presentation.*`. No modifican el Trace (FLUYO-015, probado en 017.2).
- **No debe escribir MCP:** `id`, `nextEventTypeId`, `visual.kind`, cualquier `action`/`state`/`at`/objetivo, claves desconocidas, ni efectos de la rama que no corresponde a la primitiva.

### 1.3 Hallazgos de la auditoría

1. `createEventType`/`updateEventType`/`deleteEventType`/`eventTypeById`/`eventTypeUseCount` **leían la global `doc`** y `updateEventType` no era atómico (mutaba campo a campo y podía dejar un EventType a medias).
2. `scEditorDefinition` (el modal) contenía la **forma por primitiva** (qué rama de presentación, `motion` sólo en conexiones, `availability` sólo en SET_AVAILABILITY): lógica de dominio dentro de la UI.
3. `updateEventType` lanzaba `event_type_availability_immutable_when_used` aunque la disponibilidad enviada fuera **la misma** que la actual; como el modal siempre la envía para un evento `SET_AVAILABILITY`, editar el nombre de un evento de disponibilidad usado habría lanzado. Se corrige (sólo bloquea si el valor **cambia**).
4. `createEventType` avanzaba `nextEventTypeId` antes de validar.
5. No hay regla de **nombre único**: el editor permite dos eventos con el mismo nombre (duplicar crea «X (copia)»). MCP sigue esa política y avisa (`DUPLICATE_EVENT_TYPE_NAME`, no bloqueante).

## 2. Arquitectura

```text
Editor (modal) ─────►  model.js:  eventTypeDefinition · createEventTypeIn · updateEventTypeIn · deleteEventTypeIn
                                  eventTypeUsagesIn · eventTypePresentationDiff
MCP author_document ─► FluyoAuthoring (forma de la operación) ──► las MISMAS funciones ──► FluyoIntegrity (estado final / impacto)
```

### 2.1 Extraído al dominio (`model.js`)

| Función | Qué hace |
|---|---|
| `createEventTypeIn(d, def)`, `updateEventTypeIn(d, id, changes)`, `deleteEventTypeIn(d, id)`, `eventTypeByIdIn`, `eventTypeUseCountIn` | Las reglas existentes, ahora sobre **un documento explícito**. Las globales (`createEventType`, `updateEventType`, `deleteEventType`, `eventTypeById`, `eventTypeUseCount`) delegan con `doc`: el editor no cambia de API |
| `eventTypeDefinition(input)` + `eventTypePrimitiveFor(where, consequence)` | La **forma por primitiva** y la traducción dónde/consecuencia → primitiva, que estaba en `scEditorDefinition`. El modal y MCP la llaman |
| `eventTypeUsagesIn(d, id)` | Dónde se usa un evento: `[{pageIndex, storyId, storyName, stepIds}]` |
| `eventTypePresentationDiff(et)` | Sólo lo que la presentación tiene distinto del defecto (lectura compacta para `describe_document`) |
| `EVENT_TYPE_NAME_MAX`, `EVENT_TYPE_SENTENCE_MAX`, `DEFAULT_EVENT_SYMBOL` | Constantes que antes eran literales |
| `projectDataError(code, field)` | Los errores de validación de EventType llevan **`field`** para poder explicarlos |
| Mejoras de robustez en las mismas funciones | `updateEventTypeIn` es **todo o nada** (copia → valida → vuelca; el EventType conserva su identidad de objeto); la disponibilidad idéntica no cuenta como cambio; `createEventTypeIn` sólo avanza el contador si el EventType es válido |

### 2.2 Operaciones (scope `eventType`, sin `pageIndex`)

| Operación | Campos | Reutiliza |
|---|---|---|
| `create_event_type` | `name`, `primitive`, `sentence`, `symbol?` (defecto «●», como el modal), `motion?` (sólo FLOW), `availability` (obligatoria en SET_AVAILABILITY, prohibida en el resto), `presentation?` (`{connectionEffects}` para FLOW, `{nodeEffects}` para el resto; parche sobre los defectos), `ref?` | `eventTypeDefinition` → `createEventTypeIn` |
| `update_event_type` | `eventTypeId` (id o `{ref}`), y al menos uno de `name`, `primitive`, `sentence`, `symbol`, `motion`, `availability`, `presentation` (parche sobre la presentación actual) | `updateEventTypeIn` (si cambia la primitiva se reconstruye la definición completa con `eventTypeDefinition`, como hace el modal) |
| `delete_event_type` | `eventTypeId` | `FluyoIntegrity.eventTypeImpact` + `deleteEventTypeIn` |

`add_step` acepta además `eventTypeId: {ref}` de un evento creado en el mismo lote (`create_event_type → add_step → run_story` sin más conversión; el Step guarda el `eventTypeId`, nunca una copia).

## 3. Reglas de un EventType (idénticas en el editor y en MCP)

| Caso | Editor (modal) | MCP (`author_document`) |
|---|---|---|
| Cambiar `primitive` de un evento **usado** | selector deshabilitado; `updateEventType` lanza | `EVENT_TYPE_LOCKED` (`field:"primitive"`, Historias y Steps afectados) |
| Cambiar `availability` de un evento usado | deshabilitado; lanza | `EVENT_TYPE_LOCKED` (`field:"availability"`) |
| Reenviar la **misma** disponibilidad de un usado | guarda sin error (corregido en 017.3) | no es un cambio: `ok` |
| Eliminar un evento usado | la UI explica «se usa en N lugares»; `deleteEventType` lanza `event_type_in_use` | `REFERENCED_ENTITY` con `entity`, `affectedStories`, `affectedSteps`; sin documento |
| Eliminar uno no usado | permitido; el id no se reutiliza | permitido |
| Quitar los Steps que lo usan y borrarlo en el mismo lote | — | válido (estado final); borrar antes de quitarlos, rechazado |
| Nombre, frase, símbolo, movimiento, presentación | cambian y se ven en todos los usos | igual; Steps, tiempos y Trace no cambian |
| Nombre repetido | permitido | permitido + aviso `DUPLICATE_EVENT_TYPE_NAME` |
| Escribir `id`, `action`, `state`, `at`, `visual.kind`, `force`, `pageIndex` | — | rechazado (schema de MCP **y** kernel) |

## 4. Atomicidad, revisión, dryRun y aislamiento

- **Atomicidad**: copia → lote → validación final (`FluyoIntegrity` sobre el ESTADO FINAL). Una operación inválida, o un estado final inválido, no devuelve ningún documento (`isError:true`); el original es idéntico antes y después (snapshot, entrada congelada). `updateEventTypeIn` es todo o nada también en el dominio.
- **Revisión**: `baseRevision` correcta → OK; incorrecta → `REVISION_MISMATCH` con `actualRevision`; `resultRevision` determinista e independiente del proceso, y es la revisión del documento devuelto. Un lote que no cambia nada deja la misma revisión.
- **dryRun**: mismos `changes` y `resultRevision` que la ejecución real, sin `document`; no escribe en la entrada (probado también con entrada congelada); la ejecución real produce exactamente esos cambios.
- **Aislamiento**: un `vm` nuevo por llamada. `run(A) run(B) run(A)` → A1 ≡ A2; `describe(A) · author(A) · describe(A)` idénticos.

## 5. B2

La política B2 (rechazar lo que dejaría una Historia inválida, nombrando Historia y Steps) se aplica a los EventTypes con `FluyoIntegrity.eventTypeImpact` y sigue disponible para estructura con `removalImpact` (sin operaciones MCP que borren nodos o conexiones; ver §0).

## 6. Paridad editor ↔ MCP

- **Fluyo** (`test/fluyo-017-3.test.cjs`): el modal REAL (funciones del editor en `vm`) y `author_document` sobre el mismo punto de partida producen el **documento completo** idéntico (`deepStrictEqual` de EventTypes, Steps, `at`, esperas, simultaneidad, acciones, contadores) y la **misma revisión**; Trace, outcomes, `finalAvailability`, metadata y efectos de presentación idénticos.
- **Golden** `test/fixtures/fluyo-017-3-golden.json` (ahora con `revision`; se regenera con `UPDATE_GOLDEN=1`): se copia a `fluyo-mcp/test/fixtures/stories/` (copia manual: `sync:fixtures` sólo refresca los ejemplos) y MCP comprueba EventTypes, Steps, Trace, outcomes, `finalAvailability`, `stepMeta`, `playback` y `resultRevision == golden.revision`.
- **Ciclo**: `describe_document → author_document → describe_document → run_story` sin pérdida (ids, acciones, frases, tiempos, simultaneidad, revisión).

## 7. QA ejecutada (2 de octubre de 2026)

### 7.1 Fluyo
| Comando | Resultado |
|---|---|
| `node --test test/*.test.cjs` | 742 tests, 742 pass, 0 fail |
| `node --check js/*.js` y `test/*.cjs` | sin errores |
| `git diff --check` | exit 0 (sólo avisos de fin de línea) |
| `node test/fluyo-017-3-mutations.cjs` | **31/31 detectadas** (D13 incluida), ninguna superviviente |
| `node test/fluyo-017-3-browser.cjs` (Chrome real) | OK, 8 bloques |
| `node test/fluyo-016-browser.cjs` (regresión, Chrome real) | OK, 17 bloques (incluye Viewer offline con SW v61) |

### 7.2 fluyo-mcp
| Comando | Resultado |
|---|---|
| `npm test` y `REQUIRE_FLUYO=1 npm test` | 389 tests, 389 pass, 0 fail (ambos) |
| `npm run build` | exit 0 |
| `npm run check:kernel` · `npm run check:config` | idéntico / sincronizado |
| `node scripts/mutate-017-3.ts` | **30/30 detectadas** |
| Servidor real por stdio (`dist/index.js` y `dist-test/src/index.js`) | describe, author válido, author inválido (`REFERENCED_ENTITY`, `EVENT_TYPE_LOCKED`), `run_story`, documento incompatible, Historia inexistente, página inexistente, revisión incorrecta: errores estructurados, **sin trazas internas** |

### 7.3 Mutaciones
- **Fluyo (31)**: dominio (D1–D13), autoría (A1–A13), integridad (I1–I4) y editor (E1). Se re-ejecutó la batería completa tras tocar el test de paridad.
- **MCP (30, `scripts/mutate-017-3.ts`)**: trabaja en un directorio temporal; las de kernel mutan `fluyo/js` de la copia y regeneran el kernel con el `sync-kernel` real. Cubre: quitar `EVENT_TYPE_LOCKED`; quitar `REFERENCED_ENTITY`; permitir cambiar primitiva / disponibilidad de un usado; permitir borrar un usado (3 capas); aceptar `{ref}` o `eventTypeId` inexistente; saltarse la validación final; lote parcial en un error; `update_event_type` parcialmente aplicable; `add_step` con `action`/`state`/`at`; acción no derivada del EventType (siempre SEND / estado fijo); símbolo por defecto; sin espera por defecto; rechazo sin Steps / sin Historias / sin entidad; saltarse `baseRevision`; `REVISION_MISMATCH` sin la real; rechazo que devuelve el documento; `dryRun` que escribe en la entrada o devuelve documento; `resultRevision` falso; describe sin filtro de página / sin truncar etiquetas / `usedBy` a 0 / `usedIn` sin pasos; kernel compartido entre llamadas; campo extra en el schema.
- **Primera pasada MCP: 5 supervivientes.** Análisis: (a) *borrar un usado quitando sólo la comprobación del dominio* y (b) *no identificar las Historias afectadas por una sola vía* eran **equivalentes** por defensa en profundidad (`FluyoIntegrity.eventTypeImpact` y el respaldo del dominio siguen rechazando): se reformularon quitando todas las capas (detectadas) y la capa del dominio sola la cubre D5 de la batería de Fluyo. (c) *símbolo por defecto* era una mutación mal construida (no-op) y además faltaba el test: se añadió el assert de «●». (d) *dryRun escribe en la entrada*: no había test directo (el transporte en memoria serializa): se añadió dryRun con entrada congelada. (e) *campo extra `force` en el schema de `delete_event_type`*: el kernel lo rechazaba y lo enmascaraba: se añadió el contrato exacto de campos de `tools/list`. Segunda pasada: 30/30.

### 7.4 Chrome real (`test/fluyo-017-3-browser.cjs`)
Playwright con `channel: "chrome"` (Chrome real, headless) y eventos reales de ratón y teclado. Fixture Cliente → Comercio creado por el modal real (EventType de conexión «Pago», de elemento «Procesa» con mensaje, de disponibilidad «Cae»), una Historia y 5 Steps colocados con el ratón (el mismo «Pago» 3 veces).
- **A.** Editar nombre y frase de «Pago» (usado): los 3 usos cambian; los Steps (JSON) y el Trace son idénticos; Playback completa; sin residuos; el id se conserva.
- **B.** Disponibilidad: los radios de consecuencia y de «dónde» están deshabilitados en un evento usado; guardar el modal con otro nombre (reenvía la misma disponibilidad) **no lanza**; cambiar la disponibilidad o la primitiva y borrar sí se rechazan con sus códigos; reenviar la misma por API no lanza.
- **C.** Undo/Redo: crear EventType, modificarlo, crear Historia y añadir Step; 4× Ctrl+Z y 4× Ctrl+Y reales. **Semántica existente verificada** (`js/selection.js` sin cambios respecto a HEAD): Undo restaura la **página** (Historias, Steps) exactamente, salvo los contadores de identidad, que no bajan a propósito; la **biblioteca de EventTypes no se deshace** y `nextEventTypeId` no baja.
- **D.** Present: mismo Trace y mismos mensajes (muestreo del estado de render) que Playback; documento idéntico; sin residuos al salir con Escape.
- **E.** Share de una Historia con los EventTypes editados: el payload lleva los EventTypes y sólo esa Historia; el Viewer abre, muestra los nombres editados, reproduce hasta completar y su Trace coincide con el del editor; «sólo diagrama» no lleva Historias.
- **F.** Documentos anteriores: (1) el ejemplo publicado v3 `kafka-event-pipeline` y (2) un documento **generado con el código de HEAD** (`git show`, no el árbol actual) con EventTypes y una Historia. Se abren con «Abrir» (`#fileIn`), muestran sus EventTypes, permiten crear/editar Historias y EventTypes, reproducen, comparten y abren en el Viewer, sin errores de página y sin migraciones.
- Cero errores de página en toda la sesión.

### 7.5 Kernel
El código de `fluyo/js` **no cambió** durante la QA final (sólo tests y documentación), así que no hizo falta `sync:kernel`: `check:kernel` y `check:config` pasan. Prueba de manipulación: alterar un carácter de `src/generated/kernel-sources.ts` hace fallar `check:kernel` (exit 1, «npm run sync:kernel»); restaurar el archivo (mismo sha256) vuelve a pasar. MCP sigue sin reglas de EventTypes en TypeScript (un test lo vigila sobre `src/authoring.ts`).

### 7.6 Service Worker
`HEAD` = `fluyo-static-v60`; el árbol = `fluyo-static-v61`. Los archivos servidos que cambiaron desde HEAD (`js/model.js`, `js/editor-scenarios.js`, `js/story-playback.js`) obligan a un bump (regla de AGENTS.md); v61 es **un único bump pendiente** sobre HEAD que cubre todo el trabajo sin publicar de 017.x. No se hizo otro bump. `document-integrity.js` y `story-authoring.js` no se sirven (no están en `index.html`). Los tests que fijan la versión ya apuntan a v61. *(Estado histórico: 017.x terminó commiteado en v61; el release 018.x subió a v62.)*

## 8. Bugs encontrados y corregidos

1. **(017.3, previo)** `updateEventType` lanzaba al reenviar la misma disponibilidad de un evento usado: editar el nombre de un evento de disponibilidad usado fallaba en el modal. Corregido; regresiones: D4, tests de editor y de MCP, bloque B de Chrome.
2. **(017.3, previo)** `createEventType` avanzaba el contador antes de validar. Corregido (D13).
3. **(017.3, previo)** `updateEventType` no era atómico. Corregido (D1/D2).
4. **QA final:** sin defectos nuevos del producto. Hallazgos de la propia QA: 3 huecos de test del lado MCP (símbolo por defecto, dryRun sobre entrada congelada, contrato exacto de campos) y referencias obsoletas a `delete_connection`/`delete_node` en `DECISIONS.md` (77), `ARCHITECTURE.md`, el README de fluyo-mcp y `FLUYO-017.2.md`. Todo corregido.

## 9. Archivos (fase de QA final)

**fluyo**: `test/fluyo-017-3.test.cjs` (documento completo + revisión), `test/fixtures/fluyo-017-3-golden.json` (+`revision`), `test/fluyo-017-3-browser.cjs` (nuevo), `.ai/tasks/FLUYO-017.3.md`, `.ai/tasks/FLUYO-017.2.md`, `.ai/DECISIONS.md` (78–82), `.ai/ARCHITECTURE.md`.
**fluyo-mcp**: `test/fluyo-017-3-qa.test.ts` (nuevo), `scripts/mutate-017-3.ts` (nuevo), `test/fixtures/stories/fluyo-017-3-golden.json`, `README.md`.

## 10. Riesgos reales y límites conocidos

- **«Chrome real» = Chrome estable controlado por Playwright (headless)**, no la extensión interactiva. El editor se ejercitó con clics, arrastres y teclado reales, pero Playwright es una dependencia externa (NODE_PATH), igual que en 011/016; no corre en CI del repo.
- **Undo no cubre la biblioteca de EventTypes** (política existente, ahora documentada): crear o editar un evento y pulsar Ctrl+Z no lo revierte. No se cambió.
- **Reglas con dos capas** (dominio e integridad): quitar sólo una no es observable desde MCP; la capa del dominio la cubre la batería de Fluyo (D5), la de integridad la de MCP. La mutación «modificar el documento original» dentro del kernel no es observable a través de MCP (los datos cruzan como JSON); la cubren los tests con entrada congelada y D1.
- MCP no tiene un límite de tamaño de documento propio (existen los topes del motor: 200 operaciones por lote, 1.000 Steps); el fuzz de 017.3 (1.500 lotes) no encontró fallos.
- `sync:fixtures` cambia el fin de línea de 3 ejemplos de fluyo-mcp; no usarlo para los goldens (se copian a mano). El cambio accidental de esta sesión se revirtió.
- **Límites funcionales** (fuera de alcance por diseño): no hay crear/editar/borrar nodos o conexiones, `edit_diagram` no cambia, no hay sesión, persistencia ni agente, ni generación de Historias.
- Sin commit ni push; FLUYO-018 no empezado.

## 11. Próximo paso concreto

Decidir si se commitea 017.x como un único cambio (los árboles de `fluyo` y `fluyo-mcp` tienen cambios sin commitear que van juntos: kernel regenerado + SW v61) y, después, el siguiente slice (edición del diagrama vía MCP) con su propia política B2 para nodos y conexiones.
