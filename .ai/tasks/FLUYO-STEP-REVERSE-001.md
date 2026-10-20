# FLUYO-STEP-REVERSE-001 — Un Step FLOW que recorre su conexión al revés (contrato)

Estado: **DESIGN READY** (diseño cerrado, pendiente de aprobación del PO). Sin cambios de código.
Owner/agente actual: libre.

> Repo público: este documento solo contiene decisiones técnicas del proyecto (AGENTS.md §9).

## Objetivo

Definir el contrato mínimo para que un Step `SEND` recorra una conexión existente de `to` a `from`. Con él, una Historia puede
contar «Usuario → API» y «API → Usuario» sobre **una sola** conexión. Tiene que cubrir: el recorrido normal y el inverso, varios
pasos sobre la misma conexión, la ida y vuelta, los documentos antiguos, la serialización, el playback, la frase, el motivo del
fallo, el token, la autoría y Undo/Redo.

## Por qué

Hoy el sentido solo vive en la conexión (`edge.from → edge.to`). Para contar una respuesta hay que dibujar una conexión inversa
(geometría duplicada, a veces invisible). Si no, la frase, el motivo del fallo y el token salen al revés. Añadir un campo al Step
hace que **Fluyo no abra el documento**. La investigación previa, fuera de este repo, lo midió y propuso `reverse: true`.

Esta tarea no da esa propuesta por buena: la audita y la cierra.

## Alcance

- **Incluye**: la auditoría del contrato y del código, la comparación de alternativas, el contrato propuesto, los archivos afectados,
  la compatibilidad, la migración, los tests y la siguiente tarea.
- **No incluye**: implementación, `fluyo-mcp`, Semantic Scenarios FASE 3 ni 019.x. Tampoco commit, push, deploy ni `CACHE`.

## 1. Auditoría: dónde se asume hoy `from → to`

Base: `16ee642` (CACHE v95). Los números de línea son los de ese commit. Mientras se auditaba, FASE 3 de Semantic Scenarios estaba en curso en el árbol de trabajo (no es de esta tarea): `observedFlow` en `model.js`, `story-authoring.js`, `document-integrity.js`, `editor-scenarios.js`, `flow-semantics.js`, más `sw.js` v96. No toca el Step ni el motor.

| Capa | Lugar | Qué asume hoy |
|---|---|---|
| Motor | `scenario-engine.js:95-98` | Un SEND solo admite `id, at, action, edgeId` (+ `eventTypeId`). Cualquier otra clave da `invalid_scenario`/`extra_fields`. |
| Motor | `scenario-engine.js:172-182` | `sourceState = states.get(edge.from)` y `targetState = states.get(edge.to)`. El fallo es `source_down`/`target_down`. |
| Motor | `scenario-engine.js:73-80` | Ejecuta v1 y v2 (cualquier otra versión es `unsupported_engine_version`). El comentario dice «nunca reinterpretar v2». |
| Persistencia | `model.js:475-492` `validatePersistedStep` | Lista cerrada de claves por acción. Si sobra una, `projectDataError`, y **el documento entero no abre** (editor, Present, Viewer `/s/`, deep link). |
| Persistencia | `model.js:508-536` `normalizeScenarios` | Acepta cualquier `engineVersion ≥ 1`: una Historia v3 se abre, pero no se puede ejecutar. |
| Integridad | `document-integrity.js:120` | Un Step que no pasa `validatePersistedStep` da `invalid_step`. No hay regla propia. |
| Autoría (modelo) | `model.js:603-609` `stepDefinitionForEvent` · `:631` `duplicateStep` · `:641` `retargetStep` | El objetivo de un SEND es solo un `edgeId`. `duplicateStep` copia todas las claves (`...rest`). `retargetStep` solo cambia `edgeId`. |
| Autoría (lote) | `story-authoring.js:132-162` `targetOf` | `{from,to}` busca `e.from===from && e.to===to`; si no la encuentra, `TARGET_NOT_FOUND`. `{edgeId}` y `{ref}` no admiten más claves. |
| Autoría (lote) | `story-authoring.js:887-896` `retarget_step` | Devuelve `{from: edgeIdAnterior, to: edgeIdNuevo}` (son ids de conexión, no nodos). |
| Resultado | `story-playback.js:127` `outcomes` | `reasonNodeId = source_down ? e.from : e.to`. |
| Frase | `story-playback.js:154-160` `sentence` | `{source}` = `e.from`, `{target}` = `e.to`. |
| Mensaje | `story-playback.js:212-220` `caption` | `logEvents` + `edgeEnds(id)` → `from`/`to`. Lo usan Present (`present-story.js:107`) y el Viewer (`viewer.js:228`). |
| Playback | `scenario-playback.js` `processEvent`/`tick` | `activeSends`/`completedSends`/`logEvents` llevan `edgeId`, pero no el sentido. |
| Render | `render.js:882-892` `drawScenarioEdgeOverlay` → `drawFlowOverlay` (`:851`) → `drawEventToken` (`:787`) | El token va de `pts[0]` a `pts[n]`. Si falla con `source_down`, la marca queda en `pts[0]`; en los demás casos, en `pts[n]`. Con la piel, `pts` ya llega aterrizado en `e.to` (`drawEdge`, decisión 213). |
| Panel Historia | `editor-scenarios.js:91-97` `scEdgeLabel` · `:168-176` `describeScenarioStep` · `:220-226`, `:245-250` `scRuntimeStateForStep` · `:320-335` registro · `:2635-2641` `scSentenceAt` | Todas las etiquetas «A → B», las frases y los motivos se leen de `e.from`/`e.to` (lo mismo está duplicado en cinco sitios). |
| Panel Historia | `editor-scenarios.js:1503` menú del Step · `:2712-2716` retarget · `:2449-2460` «Esta misma acción en otras conexiones» | No hay control de sentido. Lo que ya existe se compara por `edgeId`. |
| Undo/Redo | `selection.js:201` `pageSnap` (`deep(pg)`) | Es una copia de la página entera: cualquier clave del Step viaja sola. |
| Compartir | `share-url.js:37-45` · `link-codec.js` | Copia la Historia entera; el codec es genérico. Cualquier clave del Step viaja. |
| Viewer / Present | `viewer.js:119,161,228,262` · `present-story.js:107` | Solo consumen el núcleo compartido (`FluyoStoryClock`, `FluyoStory`, `render`). El encuadre de `viewer.js:262` usa los dos extremos y no depende del sentido. |
| Reloj | `story-clock.js` `schedule`/`travelMs` | La llegada depende de la duración del viaje, no del sentido. |
| Semantic Scenarios | `flow-semantics.js` · tarea `FLUYO-SCENARIOS-SEMANTICS-001` | G = conexiones `FLOWS_TO` de `from` a `to`. `observedFlow = {from,to}` lo eligen los **selectores**. T2: «los tokens nunca alimentan la derivación». |

### Sonda (kernel real, `16ee642`)

| Documento | Carga (`projectFromProjectData`) | Motor | Integridad |
|---|---|---|---|
| v2, SEND normal | abre | ok | valid |
| **v3**, SEND normal | **abre** | `unsupported_engine_version` | `unsupported_engine_version` |
| v2, SEND `reverse:true` | **no abre** | `invalid_scenario`/`extra_fields` | `invalid_step` |
| v3, SEND `reverse:true` | **no abre** | `unsupported_engine_version` | `invalid_step` |

### Hallazgos que corrigen la investigación previa

1. **Subir a `engineVersion 3` no protege más a los lectores antiguos.** Un Step con `reverse` ya hace que no abran el documento,
   sea v2 o v3. Lo único que añade v3 son dos regresiones:
   - **Lector antiguo**: una Historia v3 *sin* `reverse` (es decir, toda Historia nueva) abre, pero no se reproduce
     («Esta historia necesita una versión compatible de Fluyo», `scUnsupported`).
   - **Lector nuevo**: con `ENGINE_VERSION = 3`, **todas las Historias v2 existentes** quedarían sin poder editarse ni ejecutarse.
     El editor solo edita `engineVersion === ENGINE_VERSION` (`editor-scenarios.js:453,467,481,877,923,2695`), y la autoría
     del lote rechaza las demás versiones (`story-authoring.js:104`). Evitarlo exige migrar v2→v3 al cargar, cosa que el
     proyecto no hace (los documentos no se migran: decisiones 169, 199, 215), o tratar v2 y v3 como iguales, y entonces la
     versión no significa nada.
2. **Hay una tercera opción con precedente, y se descarta.** La decisión 169 sacó `arrivalDependencies` del Step a la Historia
   precisamente para que los lectores antiguos siguieran abriendo el documento. El sentido no es un caso equivalente:
   - Una dependencia de llegada es tiempo de presentación: el motor no la ve.
   - El sentido es semántica del motor: decide `source_down` frente a `target_down`.
   - Un lector antiguo que ignore una tabla lateral reproduciría el retorno **hacia delante, en silencio**: frase, motivo y token
     al revés.

   Que no abra es mejor que leerlo mal.
3. **El sentido debe ser relativo a la conexión, no un nodo.** La conexión puede reconectarse:
   - en el editor, arrastrando un extremo (`endDrag`);
   - en la autoría, con `updateConnectionIn` `source`/`target` (`model.js:856-868`).

   Si el Step guardara un nodo de origen, reconectar dejaría Historias inválidas. Si guarda un booleano relativo, el Step sigue a
   la conexión, igual que hoy un SEND normal.

## 2. Comparación

| Criterio | **A · `reverse:true` en el Step** | **B · conexión bidireccional** | C · tabla en la Historia (`scenario.reversedSteps`) | A′ · nodo de origen en el Step (`sourceNodeId`) |
|---|---|---|---|---|
| ¿Dice el sentido de **este** Step? | Sí | **No**: dice que se puede ir en los dos sentidos, no hacia dónde va este. Habría que deducirlo del Step anterior (ambiguo con momentos simultáneos; `move_step` lo rompe). | Sí | Sí |
| Ida y vuelta, y varias respuestas en una conexión | Sí | Solo si además se hace A | Sí | Sí |
| Documentos antiguos | Igual que hoy, byte a byte (clave ausente) | Igual | Igual | Igual |
| Lector antiguo con un documento nuevo | **No abre** (no lee mal) | Abre, y no cambia nada (no resuelve) | Abre y **lo lee mal en silencio** | No abre |
| Serialización | Una clave opcional en el Step | Una clave en la conexión | Una lista que se poda con cada borrado o duplicado | Una clave redundante |
| Integridad al reconectar o invertir la conexión | Sigue a la conexión, nunca invalida | — | Igual que A, más la poda | **Queda inválida** si el nodo deja de ser un extremo |
| Renderer y playback | Pinta los puntos al revés para ese envío | Sin cambios (y sin solución) | Igual que A, pero buscando en otra tabla | Igual que A |
| Autoría y Undo | Viaja con el Step (duplicar, copiar Historia, Undo) | — | Hay que copiarla y podarla a mano (como `copyArrivalWaits`) | Viaja con el Step |
| Choque con contratos vigentes | Ninguno: la decisión 221 se respeta (las puntas no son semántica) | Contradice la 221 si acopla las puntas al sentido | Ninguno | Ninguno |

**Decisión: A.**

- El sentido es un dato de la **ocurrencia**, no de la **estructura**.
- Es lo único que se expresa por Step, viaja solo y no puede leerse mal.
- B no basta. C degrada en silencio. A′ es redundante y frágil.

## 3. Contrato propuesto

Si el PO lo aprueba, estas decisiones se numeran a partir de la siguiente libre.

- **D1 · Campo.** Un Step `SEND` admite `reverse: true`: el envío recorre la conexión de `edge.to` a `edge.from`.
  - Si la clave falta, el recorrido es el normal.
  - El formato canónico es **ausente o `true`**. Nadie escribe `false`, y al cargar `false` se quita (`normalizeScenarios`, como
    ya canonicaliza los Behaviors).
  - Cualquier otro valor (`"true"`, `1`, `null`), o la clave en `SET_STATE`/`OCCURRENCE`, se rechaza:
    `projectDataError` → `invalid_step`; en el motor, `invalid_scenario`.
  - Nombre: `reverse`, no `direction`, porque `direction` ya es un parámetro de `move_step` con los valores
    `"earlier"`/`"later"`. Que exista `edge.flowDir:"reverse"` no confunde: esa es una propiedad de apariencia de otro objeto.
- **D2 · Versiones.** `engineVersion` sigue en **2** y `version` en **5**. Esto precisa la decisión 10 con una regla: «una
  extensión de v2 es válida si (a) todo documento válido antes da exactamente el mismo Trace, (b) la clave es opcional y su
  ausencia significa lo de antes, y (c) todo lector anterior la **rechaza** en vez de interpretarla». `reverse` cumple las tres:
  el motor y `validatePersistedStep` actuales lo rechazan. La regla «nunca reinterpretar v2» se mantiene. v3 se reserva para un
  cambio que no cumpla (a)–(c). Sin migración.
- **D3 · Vocabulario y una sola regla.** `from`/`to` son siempre de la **conexión**. `source`/`target` son del **recorrido**:
  los mismos nombres que `{source}`/`{target}` de la frase y que `source_down`/`target_down`.
  - En `model.js` (kernel) hay una sola función: `traversalEnds(edge, reverse) → {source, target}`.
  - El motor no depende de `model.js`, así que repite la regla en una línea. Un test ata las dos.
  - Todos los consumidores (frase, resultados, mensaje, etiquetas, registro) llaman a `traversalEnds`. Se acaban los cinco
    `e.from`/`e.to` repetidos del panel.
- **D4 · Motor y Trace.** En un SEND con `reverse`, `sourceState = states.get(edge.to)` y `targetState = states.get(edge.from)`.
  - Los códigos (`source_down`, `target_down`) no cambian: son del recorrido.
  - Los tres eventos del envío (`send_started`, `send_succeeded`, `send_failed`) llevan `reverse:true` detrás de `edgeId`.
  - Sin `reverse` el evento no lleva la clave, así que el Trace de cualquier documento actual es idéntico byte a byte.
  - El Trace se describe solo: el playback, el mensaje y el registro no tienen que volver a consultar el Step (decisión 9).
- **D5 · El sentido sigue a la conexión.** Reconectar un extremo o cambiar `source`/`target` de la conexión cambia los nodos del
  recorrido, igual que hoy en un SEND normal, y nunca invalida la Historia.
  - Borrar la conexión funciona como hoy (`missing_edge`, `removalImpact`).
  - Si un documento antiguo trae una conexión en bucle (`from===to`; la carga lo admite, la autoría no), `reverse` se acepta
    sin regla especial: los dos extremos son el mismo nodo.
- **D6 · Token y marcas.** `scenario-playback` lleva `reverse` de `send_started` a `activeSends`/`completedSends`/`logEvents`.
  `drawScenarioEdgeOverlay` pinta los envíos inversos con una **copia invertida** de `pts`. Una misma conexión puede llevar a la
  vez envíos en los dos sentidos.
  - `drawFlowOverlay` y `drawEventToken` no cambian. El «origen» del fallo `source_down` y la llegada caen solos en el extremo
    del recorrido.
  - Con la piel, el retorno sale del punto aterrizado en `e.to` y llega al ancla lógica de `e.from`, donde está el anillo de
    salida (decisión 213 sin tocar).
  - La vista previa del diálogo de Evento sigue en sentido normal.
- **D7 · Texto.**
  - `sentence(page, step, et)` usa `traversalEnds`.
  - `outcomes` añade `reverse:true` cuando aplica, y `reasonNodeId` sale del recorrido.
  - `caption` lee `ev.reverse` de `logEvents`. La firma de `edgeEnds` no cambia, así que **Viewer y Present no cambian de código**.
  - En el panel, «B → A» en la etiqueta, la frase, el motivo («B no está disponible») y el registro.
- **D8 · Autoría del modelo (kernel).**
  - `stepDefinitionForEvent(et, target, at, reverse)` escribe la clave solo si es `true`.
  - `retargetStep(pg, sc, id, targetId, reverse)` fija el recorrido completo.
  - `setStepReverse(sc, id, bool)` (nueva) da la vuelta a un SEND sin tocar `id`, `at`, el orden ni el EventType.
  - `duplicateStep` y `duplicateScenario` lo heredan (copian todas las claves).
- **D9 · Autoría del lote (`story-authoring.js`).** `target` admite `{edgeId, reverse?}` y `{ref, reverse?}` (`reverse`
  booleano, y solo para una conexión). `{from, to}` resuelve así:
  1. Si hay conexiones directas `from→to`: una se usa en sentido normal; dos o más dan `AMBIGUOUS_TARGET`, como hoy.
  2. Si no hay ninguna directa, se buscan las inversas `to→from`: una se usa con `reverse:true`; dos o más dan
     `AMBIGUOUS_TARGET`.
  3. Si no hay ninguna, `TARGET_NOT_FOUND`.

  Con `{from,to}` no se acepta `reverse` explícito: la forma ya dice el sentido. Lo que hoy funciona no cambia, porque la directa
  gana.
  - `retarget_step`: el `target` describe el recorrido completo (sin `reverse`, es normal). Sirve también para dar la vuelta en el
    sitio, con `{edgeId: mismo, reverse:true}`. **No hay operación nueva.** Su resultado añade `reverse` y `previousReverse`.
  - `add_step` y `duplicate_step` devuelven `reverse:true` cuando aplica.
- **D10 · Editor.**
  - El menú de un Step FLOW tiene «Invertir sentido», con el hint «Ahora: A → B». Es una sola entrada de Undo (`pushUndo` +
    `setStepReverse`).
  - «Cambiar dónde ocurre» **conserva** el sentido del Step: el clic solo elige la conexión.
  - «Esta misma acción en otras conexiones» crea las copias con el `reverse` del original, y compara lo que ya existe por
    `(edgeId, reverse)`.
  - Sin bandera labs: es dato de la Historia, no una herramienta experimental (decisión 216).
  - Cómo se presenta (wording, un atajo «Añadir la respuesta») se decide en el slice de UI.
- **D11 · Lectores antiguos.** Un documento con `reverse` **no abre** en clientes con caché ≤ la de esta tarea, ni en un kernel
  del MCP sin sincronizar. Lo rechazan con `invalid_document` y nunca lo leen mal. Es la misma situación que cuando llegó
  `OCCURRENCE`. `sw.js` ya hace `skipWaiting` y `clients.claim`, así que la ventana es de una carga. El MCP no debe escribir
  `reverse` hasta tener el kernel nuevo (`sync:kernel` + `check:kernel`).
- **D12 · Semantic Scenarios: sin interacción.** FLOWS_TO, la alcanzabilidad, la procedencia y `observedFlow` (elegido con los
  selectores) no leen Steps (T2). `reverse` no altera G.
  - Un aviso del tipo de W5 para un SEND inverso sobre un Flujo («la respuesta va contra el flujo declarado») es posible, pero no
    se abre aquí. Un acuse de recibo sobre un Flujo es legítimo.
  - FASE 3 no se toca.

**No hay SEMANTIC CONFLICT.** La decisión 10 se precisa en D2; no se contradice. Las decisiones 169, 213 y 221 se respetan.

## 4. Ejemplo antes y después (request/response)

Nodos: 1 Usuario, 2 API, 3 Servicio, 4 DB. EventTypes: 1 «Petición» (`{source} pide a {target}`) y 2 «Respuesta»
(`{source} responde a {target}`).

**Antes (hoy).** Hacen falta 6 conexiones: 5 U→A, 6 A→S, 7 S→D, y las inversas 8 D→S, 9 S→A y 10 A→U. Cada SEND va por la suya.
Si se intenta reutilizar la 7 para la respuesta:

```json
{"id":4,"at":3600,"action":"SEND","edgeId":7,"eventTypeId":2}
```
Resultado:
- La frase es «Servicio responde a DB», al revés.
- Con DB caída, el motivo es `target_down · DB`, cuando la que no puede responder es la fuente.
- Con Servicio caído, el motivo es `source_down · Servicio`, cuando ese es el destino de la respuesta.
- El token viaja de S a D.

**Después.** Bastan 3 conexiones (5, 6, 7) y 6 SEND:

```json
{"id":1,"at":0,   "action":"SEND","edgeId":5,"eventTypeId":1}
{"id":2,"at":1200,"action":"SEND","edgeId":6,"eventTypeId":1}
{"id":3,"at":2400,"action":"SEND","edgeId":7,"eventTypeId":1}
{"id":4,"at":3600,"action":"SEND","edgeId":7,"eventTypeId":2,"reverse":true}
{"id":5,"at":4800,"action":"SEND","edgeId":6,"eventTypeId":2,"reverse":true}
{"id":6,"at":6000,"action":"SEND","edgeId":5,"eventTypeId":2,"reverse":true}
```

Lo que da el paso 4, con DB caída:

| Salida | Valor |
|---|---|
| Trace | `{"at":3600,"type":"send_started","stepId":4,"edgeId":7,"reverse":true}` · `{"at":3600,"type":"send_failed","stepId":4,"edgeId":7,"reverse":true,"reason":"source_down"}` |
| Resultado (`outcomes`) | `{stepId:4, action:"SEND", edgeId:7, reverse:true, status:"not_completed", reason:"source_down", reasonNodeId:4}` |
| Frase | «DB responde a Servicio» |
| Mensaje | «No se completó · DB no está disponible» |
| Panel | «DB → Servicio» |
| Token | sale de DB y se apaga allí (`source_down`: alpha mínimo y marca en el extremo de salida) |

Documento sin `reverse`: el mismo Trace, la misma frase y el mismo token que hoy, byte a byte.

Cómo se pediría desde la autoría:
- `add_step {target:{from:4, to:3}}` → conexión 7 con `reverse:true` (no hay D→S).
- `add_step {target:{edgeId:7, reverse:true}}` → la forma explícita.
- `retarget_step {target:{edgeId:7}}` → vuelve al sentido normal.

## 5. Archivos afectados (FLUYO-STEP-REVERSE-002)

| Archivo | Cambio | ¿Kernel MCP? |
|---|---|---|
| `js/scenario-engine.js` | `reverse` booleano en SEND (claves permitidas). Extremos del recorrido. `reverse:true` en los 3 eventos. | Sí |
| `js/model.js` | `validatePersistedStep` (solo SEND, booleano). `normalizeScenarios` (quita `false`). `traversalEnds`. `stepDefinitionForEvent(…, reverse)`. `retargetStep(…, reverse)`. `setStepReverse`. | Sí |
| `js/document-integrity.js` | Sin regla nueva (lo hereda de `validatePersistedStep`). Solo hay que comprobar el mensaje `invalid_step`. | Sí |
| `js/story-playback.js` | `outcomes` (`reverse`, `reasonNodeId`). `sentence`. `caption` (con `ev.reverse`). | Sí |
| `js/scenario-playback.js` | Lleva `reverse` en `activeSends`/`completedSends`/`tick`/`logEvents`. | Sí |
| `js/story-authoring.js` | `targetOf` (formas con `reverse` y resolución directa → inversa). `add_step`, `retarget_step` y `duplicate_step` (resultados). | Sí |
| `js/render.js` | `drawScenarioEdgeOverlay`: `pts` invertidos por envío. | No |
| `js/editor-scenarios.js` | `traversalEnds` en `scEdgeLabel`, `describeScenarioStep`, `scRuntimeStateForStep`, el registro y `scSentenceAt`. «Invertir sentido» en el menú. El retarget conserva el sentido. La colocación múltiple compara `(edgeId, reverse)`. | No |
| `js/viewer.js`, `js/present-story.js`, `js/story-clock.js`, `js/flow-semantics.js` | **Sin cambios** (consumen el núcleo). | — |
| `sw.js` | `CACHE` a la siguiente libre. FASE 3 ya ocupa v96 en el árbol de trabajo, así que previsiblemente es v97. | No |
| `.ai/DECISIONS.md` | D1–D12 con número a partir de la siguiente libre, después de las de FASE 3 (que ocupa desde la 230). | — |

## 6. Compatibilidad

| Caso | Resultado | Clase |
|---|---|---|
| Documento antiguo → editor, Present o Viewer nuevos | Igual: Trace, frase, token y guardado byte a byte | SAFE |
| Documento antiguo → MCP con el kernel nuevo | Igual: goldens de `run_story`/`describe_document` intactos | SAFE |
| Documento con `reverse` → cliente nuevo | Correcto en las 3 superficies | SAFE |
| Documento con `reverse` → cliente con caché antigua / MCP sin sincronizar | No abre (`invalid_document`), no lo lee mal | BREAK explícito (igual que `OCCURRENCE`) |
| `reverse:false` escrito a mano | Abre; se guarda sin la clave | SAFE (canónico) |
| Enlaces `/s/` existentes | Sin `reverse`: idénticos | SAFE |
| Workaround actual (conexiones inversas) | Sigue siendo válido; nada lo migra | SAFE |

## 7. Migración

**Ninguna.** No se reescribe ningún documento ni se sube ninguna versión. Las conexiones inversas que ya existen siguen
funcionando. Pasarlas a `reverse` es una decisión del autor, y no se automatiza: quitar una conexión es un cambio del diagrama,
no de la Historia.

## 8. Tests necesarios (en 002)

- **Motor**:
  - normal, inverso, varias respuestas sobre la misma conexión, ida y vuelta en el mismo momento;
  - `source_down`/`target_down` según el recorrido, en los dos sentidos;
  - un bucle;
  - `reverse` no booleano y `reverse` en `SET_STATE`/`OCCURRENCE` → `invalid_scenario`;
  - **Trace idéntico byte a byte** para todos los `ejemplos/data` y `test/fixtures` (incluidas las Historias v1).
- **Modelo**:
  - `validatePersistedStep` (matriz de valores y de acciones);
  - `normalizeScenarios` quita `false`;
  - `traversalEnds` frente a la línea del motor (el test que las ata);
  - `setStepReverse`, `retargetStep` y `duplicateStep`/`duplicateScenario` heredan;
  - round-trip `projectToSerializable → projectFromProjectData`.
- **Integridad**: `invalid_step` localizado para los valores inválidos; un documento con `reverse` válido da `valid`.
- **Playback y texto**: el token avanza al revés (posición con progreso 0,25 y 0,75); `outcomes`, `sentence`, `caption` y
  `describe` con DB caída en los dos sentidos.
- **Autoría del lote**:
  - `{from,to}`: directa, inversa, ambigua en cada caso, inexistente;
  - `{edgeId,reverse}`, `{ref,reverse}`;
  - `reverse` sobre un elemento → `TARGET_INCOMPATIBLE`;
  - `{from,to,reverse}` → `INVALID_OPERATION`;
  - `retarget_step` da la vuelta en el sitio;
  - el lote rechazado no deja documento.
- **Render**: el overlay pinta una copia invertida y no muta `pts` ni la ruta; con la piel, la salida va desde la silueta aterrizada.
- **Editor (DOM falso + navegador)**:
  - etiqueta, frase, motivo y registro «B → A»;
  - «Invertir sentido» = 1 Undo y 1 Redo, y la selección se conserva (decisión 189);
  - el retarget conserva el sentido;
  - la colocación múltiple hereda;
  - autoguardado y recarga.
- **Viewer y Present (navegador)**: el mismo token, mensaje y progreso que en el editor; enlace `/s/` con `reverse` de ida y
  vuelta.
- **Mutaciones**: quitar cada rama (motor sin intercambio, Trace sin la clave, caption sin `ev.reverse`, render sin invertir,
  normalización sin quitar `false`, resolución sin la inversa); cada test debe caer.
- **Alcance**: `flow-semantics.js`, `story-clock.js`, `viewer.js` y `present-story.js` sin diff.

## 9. Riesgos

- **Ventana de una carga en clientes antiguos** (D11). Se mitiga con `skipWaiting`/`claim`; está aceptado, como con `OCCURRENCE`.
- **Agentes que escriban `reverse` contra un MCP sin sincronizar** → el documento se rechaza. Hay que sincronizar el kernel
  antes de exponer la opción en el MCP.
- **Una lectura engañosa en un diagrama con Flujo**: un retorno contra la flecha de un Flujo. Es legítimo y queda fuera de este
  alcance (D12).
- **La UX del control**: descubrir «Invertir sentido» dentro del menú puede costar. Se mide en el slice de UI.

## Handoff

### Estado actual

DESIGN READY. Este documento es el único archivo nuevo; no hay código, `CACHE` ni decisiones registradas. El diseño corrige dos
puntos de la investigación previa:
- **v2 + clave opcional en lugar de engineVersion 3**: v3 dejaría sin poder editarse todas las Historias v2 y no protege más a
  los lectores antiguos.
- **`{from,to}`**: resuelve primero la conexión directa y solo si no hay ninguna la inversa, con una ambigüedad en cada nivel.

### Próximo paso concreto

1. El PO aprueba o corrige D1–D12. Hay tres puntos de decisión:
   - D2, quedarse en v2;
   - D9, la resolución directa → inversa;
   - D10, el retarget conserva el sentido.
2. Abrir **FLUYO-STEP-REVERSE-002 — Contrato `reverse` en el kernel y lectura en todas las superficies**. Alcance: §5 completo
   salvo el control «Invertir sentido» del menú (D10), tests de §8 y la `CACHE` siguiente. Se hace **después de FASE 3**, o se rebasa sobre ella: habrá conflictos de texto, no de semántica, en `model.js`, `story-authoring.js`, `document-integrity.js` y `editor-scenarios.js`. El editor ya mostrará bien los
   documentos escritos por la autoría.
3. **FLUYO-STEP-REVERSE-003 — Autoría del sentido en el panel de Historia**. Es el slice de UI con su auditoría en navegador: el
   control, el wording y el posible atajo «Añadir la respuesta».
4. Cuando 002 esté en `main`, en `fluyo-mcp`: `sync:kernel` + `check:kernel`; Zod de `target` con `reverse`; `describe_document`
   y `run_story` en el sentido del recorrido; README con el patrón request/response; tests y mutaciones.
