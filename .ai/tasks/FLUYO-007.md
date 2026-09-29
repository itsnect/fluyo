# FLUYO-007 — Arquitectura base de Scenarios

Estado: DONE — diseño cerrado; listo para revisión de arquitectura e implementación posterior
Owner/agente actual: Codex

> Esta tarea es la fuente de verdad del diseño: se puede continuar leyendo este archivo + `AGENTS.md`. Las decisiones duraderas se indexan en [DECISIONS.md](../DECISIONS.md), D-011–D-013. Todo el contenido es apto para el repositorio público.
> DONE significa entrega de arquitectura, no funcionalidad implementada. Los contratos siguientes son propuestos para el próximo incremento; el runtime actual sigue usando v3.

## Objetivo

Definir Structure + Behavior + Scenario → Trace con reglas deterministas, locales y pequeñas, compatibles con el editor y suficientemente precisas para implementar sin reinterpretar el producto.

## Por qué

Un diagrama puede explicar comportamiento reproducible si sus resultados provienen de operaciones explícitas. El ejemplo Producer → Kafka → Consumer → PostgreSQL debe funcionar con primitivas genéricas, sin simular esos productos.

## Alcance

### Incluye

- Contratos serializables, reglas de ejecución, validación, migración, playback, autoría mínima, ejemplo exacto, guards y plan de pruebas.
- Inspección dirigida del formato, IDs, undo/redo, páginas, renderer y persistencia actuales.
- Decisiones técnicas públicas y handoff del primer slice.

### No incluye

- Motor, UI o playback productivos; cambios en archivos servidos.
- Retry, latency, timeout, backoff, colas de mensajes, DLQ, circuit breaker, perfiles específicos o IA.
- Backend, workers de Scenarios, almacenamiento remoto, código ejecutable del usuario, analytics implementados, billing o flags comerciales.
- Commit, push o despliegue.

## Contexto necesario

Bootstrap leído: `AGENTS.md`, `.ai/PRODUCT.md`, `.ai/ARCHITECTURE.md`, `.ai/DECISIONS.md`, FLUYO-004/005/006 y `_TEMPLATE.md`.

Para implementar basta esta tarea + `AGENTS.md`; buscar por los símbolos de §1 y §10 al tocar una frontera. No explorar repositorios hermanos ni cargar todo el repositorio. D-002 y D-003 siguen aplicando.

## Criterios de aceptación

- [x] Las veinte preguntas obligatorias tienen decisiones concretas (§2–§12 y §15).
- [x] Ejemplo completo: Structure, Behavior, Scenario persistido, queue, Trace y playback (§13).
- [x] SEND, estados, orden, no mutation y Reset definidos sin casos ambiguos.
- [x] Esquema real e inconvenientes de identidad actuales comprobados en código.
- [x] Persistencia, migración e invalidación definidas; sin Trace parcial válido.
- [x] Primer slice y pruebas especificados; evolución posible sin implementar futuro.
- [x] Sólo documentación modificada por esta tarea; sin commit/push.

## Plan

- [x] Leer bootstrap y template.
- [x] Inspeccionar símbolos de formato, referencias, renderer, controles y páginas.
- [x] Cerrar contratos y semántica.
- [x] Revisar ejemplo, casos límite y checklist de implementación.
- [x] Registrar decisiones técnicas y handoff.
- [x] Verificar ejemplos JSON, frontera actual y diff.

## 1. Evidencia del repositorio actual

| Frontera | Evidencia comprobada | Consecuencia para Scenarios |
|---|---|---|
| Formato | `js/model.js`: `serializeProject()` devuelve `{version:3,app:"fluyo",doc,settings}`; `projectFromProjectData()` admite 1/2/3 y ausencia de versión | Usar `version`, no inventar `schemaVersion`; modificar la frontera común en la implementación |
| Páginas | `blankPage()` crea `{name,nodes,edges,nextId}`; no existe ID de página; `doc.cur` es índice mutable | Contener Scenarios en la propia página; no referenciar índices ni nombres |
| Entidades | Normalizador exige IDs enteros seguros positivos y únicos entre nodos y edges de cada página; `from`/`to` son numéricos | Mantener IDs numéricos locales; los strings `node_17` del enunciado son ilustrativos |
| Referencias | Normalizador comprueba tipos de `from`/`to`, pero no existencia de endpoints; renderer omite aristas colgantes | El validador de ejecución debe comprobar endpoints explícitamente |
| Creación y copia | `newNode()`/`newEdge()` en `state.js`, y `pasteClip()` en `selection.js`, asignan `nextId++` | Preservar entidades existentes; copiar crea otras identidades |
| Undo/reemplazo | `snapPage()` sólo captura nodes/edges/nextId; `applySnap()` restaura nextId; `btnDemo` en `export.js` lo reinicia a 1 | Hoy no hay garantía de no reutilizar IDs históricos; debe cerrarse antes de ejecutar Scenarios |
| Render | `render(ctx,t,{renderState})` recibe viewport/interacción/selección, pero aún lee `doc`, `settings`, `P()` y geometría global | Añadir sólo datos runtime de pintura explícitos; no asumir renderer completamente puro |
| Flujo | `drawEdge()`, `drawFlowBalls()`, `edgePoints()`, `pointAt()` dibujan partículas decorativas continuas | Reutilizar geometría/Canvas, no interpretarlas como SEND ni propagación |
| Reloj | `editor-runtime.js` usa performance/RAF y segundos para animación | Es otro reloj; nunca suministra tiempo u orden al engine |
| Entrada/salida | Archivo, autosave, deep link, Share y viewer comparten normalización; `appendPagesFrom()` añade páginas completas | Migrar una sola vez en core y transportar todos los campos; viewer puede conservarlos sin ejecutar |

Los handoffs finales de FLUYO-004/005 prevalecen sobre sus registros históricos. FLUYO-006 tiene trabajo previo sin commit y un bloqueo Share documentado: su estado no se resuelve ni se altera aquí.

## 2. Modelo conceptual final

```text
Página del documento Fluyo
  Structure: nodes + edges (IDs, from/to)
  Behavior: disponibilidad inicial por nodeId
  Scenario: pasos explícitos con tiempos virtuales
            ↓ validación completa + snapshot
  Engine puro → Trace efímero
                    ↓
  Playback → datos runtime de pintura → Canvas 2D
```

1. **Structure** es el documento visual existente; para ejecutar se proyecta una página a `{nodes:[{id}],edges:[{id,from,to}]}`. El engine no necesita labels, forma, color, posiciones, orden Z, `animated`, `flowDir`, puntas de flecha ni settings. Las otras páginas no intervienen.
2. **Behavior** es configuración inicial mínima de disponibilidad. No contiene estados arbitrarios ni lógica programable. Cada nodo de cualquier forma es elegible; la forma no implica semántica.
3. **Scenario** es una definición editable de acciones y timestamps en una página. Su nombre es presentación; IDs son identidad.
4. **Trace** es el resultado ordenado e inmutable de una ejecución válida; no es un Scenario ni una animación.

Un SEND sólo evalúa una arista. Producer → Kafka exitoso no genera SEND Kafka → Consumer ni Consumer → PostgreSQL. La estructura no dispara acciones implícitas.

## 3. Contratos persistidos y alcance por página

En v4, cada página añade:

```json
{
  "behaviors": [],
  "scenarios": [],
  "nextScenarioId": 1
}
```

### Behavior v1

`behaviors` es una tabla separada representada como array de registros `{nodeId,initialState}`. Un registro por nodo como máximo. IDs numéricos explícitos evitan claves string y problemas de propiedades de objetos. Lookup runtime con Map local.

- `initialState` admite exactamente `UP` o `DOWN`.
- Sin registro equivale a `UP`. Al editar a UP se puede retirar el override; el significado no cambia. Un UP explícito también es válido.
- No almacenar `currentState` en un nodo ni en behaviors.
- Separar semántica de estilo facilita una proyección futura a System Graph sin crear ECS. Frente a `node.behavior`, exige remap explícito al copiar, que se define en §9.

### Scenario v1

```json
{
  "id": 1,
  "engineVersion": 1,
  "name": "Caída de Kafka",
  "nextStepId": 3,
  "steps": [
    {"id": 1, "at": 0, "action": "SET_STATE", "nodeId": 2, "state": "DOWN"},
    {"id": 2, "at": 1000, "action": "SEND", "edgeId": 5}
  ]
}
```

- Cada Scenario persiste `engineVersion: 1`. La versión del motor es parte del contrato de reproducibilidad: un runner futuro con `engineVersion` distinto no reinterpreta silenciosamente el Scenario. Trace derivado también incluye `engineVersion`.
- IDs de Scenario enteros seguros positivos, únicos en la página. IDs de step del mismo tipo, únicos en ese Scenario. Names no vacíos tras trim, hasta 120 caracteres; no son lookup ni afectan Trace.
- `nextScenarioId` y `nextStepId` asignan IDs monotónicos; deben exceder IDs actuales y referencias de historial relevantes. Creación incrementa, borrado no disminuye; agotamiento de entero seguro bloquea creación. No comparten `nextId` de entidades.
- `at` es entero seguro de milisegundos desde cero, sin decimales, coerción desde strings, números negativos, NaN ni infinito. El límite operativo está en §14.
- `SET_STATE` exige `nodeId` y `state`; `SEND` exige `edgeId`. No hay `target` ambiguo ni campos ejecutables. Cada acción acepta sólo las claves de su contrato; campos de otra acción son error.
- `steps` es una **lista de autoría ordenada**: su índice persistido dentro del array es el desempate semántico cuando coincide `at`. No hay campo `sequence` redundante. El engine ordena una copia por `(at, índice original)` y nunca reordena la definición.
- Orden visual: filas por `at`, después índice original; controles subir/bajar dentro de un mismo timestamp cambian explícitamente el orden de la lista y por tanto la semántica de ejecución. Cambiar `at` conserva la posición en la lista como desempate. Ordenar por `step.id` o por tipo de acción está prohibido; `step.id` es identidad, no orden.
- Escenario vacío es válido: Trace vacío, reloj cero y finalización inmediata.

**Alcance cerrado:** Scenario y Behavior pertenecen a una página, físicamente dentro de ella. Cada página añade `behaviors`, `scenarios` y `nextScenarioId`; no se agrega pageId, `scenario.page` ni referencias cross-page. Mover/reordenar/renombrar página conserva sus definiciones; borrar página las elimina con ella. Igual ID en dos páginas identifica entidades distintas. El runner recibe la página seleccionada, sin leer `doc.cur` dentro del motor.

## 4. Acciones y estados: semántica exacta

Estados v1: **UP**, **DOWN**. No DEGRADED: no existe efecto adicional definido. Availability no describe salud real ni comportamiento específico de Kafka.

### SET_STATE

Al sacar el paso de la cola, consultar estado runtime del nodeId. Si difiere, actualizar el Map y emitir un `state_changed` al mismo `at`, con estado anterior y nuevo. Si ya coincide, es no-op y no emite evento. No genera envíos, fallos pendientes ni acciones nuevas. El estado inicial no emite eventos.

### SEND

Dirección siempre `edge.from → edge.to`, incluso si `flowDir` es reverse/alternate, `startArrow` está activo o `endArrow` apagado. Esos campos son visuales. SEND no tiene payload ni disponibilidad de edge.

1. Emitir `send_started` al `at` del paso, incluso si el source está DOWN (significa intento solicitado).
2. Leer ambos estados runtime en ese instante.
3. Emitir exactamente un terminal al mismo `at`:

| Source | Target | Terminal | Reason |
|---|---|---|---|
| UP | UP | `send_succeeded` | ausente |
| UP | DOWN | `send_failed` | `target_down` |
| DOWN | UP | `send_failed` | `source_down` |
| DOWN | DOWN | `send_failed` | `source_down` |

`source_down` tiene prioridad si ambos caen. UP/DOWN no se modifica al enviar. Cada SEND produce dos eventos contiguos antes de procesar el siguiente paso, aunque tenga el mismo timestamp. Aristas paralelas se distinguen por ID. Un self-edge importado con endpoints válidos usa las mismas reglas; el editor actualmente no crea self-edges, pero el motor no necesita otra excepción.

No retries, latencia, timeout, buffering, consumo ni efecto en otras aristas. IDs inexistentes son errores de prevalidación, nunca `send_failed`.

## 5. Virtual clock, event queue y determinismo

- Reloj `nowMs = 0`, entero local. Salta al `at` del siguiente trabajo; no recorre intervalos vacíos. Duración lógica: último trabajo procesado; cero para lista vacía.
- Inicialización: enqueue de pasos con `sequence = índice original` (0..N-1). Orden total numérico `(at,sequence)`; no depender de estabilidad del sort, Map, timers o prioridad incidental de acciones.
- Ejemplo: dos filas `SET_STATE DOWN`, `SEND` a 1000, en ese orden, hacen fallar SEND. Invertir su orden permite SEND y después cae el nodo. No existe prioridad global SET_STATE.
- Trace se append en el orden de emisión. Su índice es orden total y desempate visual, sin nuevo ID aleatorio.
- Queue v1 puede ser array ordenado con cursor. La abstracción interna es `enqueue(at, work)` y `dequeueMin()`. Los pasos iniciales reciben sus sequences; futuros trabajos runtime reciben `nextSequence++` en el orden determinista en que se generan, siempre mayor que las ya asignadas. Empates futuros se resuelven igual. Insertar antes del cursor por `(at,sequence)` está prohibido; `at >= nowMs`, entero y dentro de guards.
- En v1 SEND emite sus terminales directamente; no agenda trabajo adicional. Esta abstracción permite después programar terminal a 1250 para SEND a 1000 o retry a `nowMs+5000`, sin cambiar reloj, sin timers ni recursión. La política de evaluación al completar latencia y correlación entre intentos requerirá otra decisión/versionado; no queda inventada aquí.

Pseudocódigo de contrato, no implementación:

```text
runScenario(structure, behaviors, scenario):
  errors = validateAll(structure, behaviors, scenario, LIMITS_V1)
  if errors: return {ok:false, errors}   // no trace
  states = Map de nodos: initialState o UP
  queue = copia de pasos, secuencia por índice, orden (at,sequence)
  events = []; nowMs = 0
  while queue no vacía:
    work = dequeueMin(); nowMs = work.at
    apply SET_STATE o SEND según §4; append con guard
  return {ok:true, trace:{engineVersion:1, scenarioId:scenario.id, events}}
```

**Definición de determinismo:** mismos Structure semántico, Behavior efectivo, Scenario (incluido orden de pasos) y `engineVersion`/guards generan exactamente el mismo array de eventos, valores y orden. Serializar el Trace con el orden de claves del contrato da los mismos bytes en 100 ejecuciones o más. Labels, estilos, tema, velocidad visual, pan/zoom y orden de nodos/edges/behaviors no alteran el resultado. IDs no se reasignan durante Run.

No leer DOM, Canvas, Date.now, performance, Math.random, timers, red, almacenamiento, analytics, globals `doc`/`P()`/settings ni estado de ejecuciones anteriores. Crear Maps/queue internos en cada llamada. No mutar ningún input. Sin pseudoaleatoriedad v1; una futura versión requerirá seed explícita. No afirmar determinismo pixel a pixel de Canvas entre dispositivos.

## 6. Trace mínimo y política de persistencia

Envelope runtime `{engineVersion:1,scenarioId,events}`. `events` es unión cerrada:

```text
{at,type:"state_changed",stepId,nodeId,from,to}
{at,type:"send_started",stepId,edgeId}
{at,type:"send_succeeded",stepId,edgeId}
{at,type:"send_failed",stepId,edgeId,reason:"source_down"|"target_down"}
```

`stepId` permite seleccionar la fila y distinguir envíos repetidos por la misma arista al mismo tiempo. `edgeId` basta: source/target se derivan del **snapshot de ejecución**. Labels y geometría tampoco se duplican. No runId, UUID, wall-clock, evento artificial de completed ni estado inicial repetido. `completed` es estado del coordinador, no del sistema simulado.

**Trace no se persiste** en `.fluyo.json`, autosave, URL ni storage aparte. Se conserva sólo en memoria junto al snapshot que lo produjo. Playback necesita ese snapshot: usar el diagrama posteriormente editado para resolver eventos antiguos sería incorrecto. Una nueva definición/estructura invalida el resultado, no lo transforma.

Reproducibilidad: persistir los tres inputs, preservar semántica v4/engine v1 y volver a ejecutar. Presentación/debugging: mantener Trace durante la sesión y mostrar lista exacta de eventos. Export futuro podrá empaquetar inputs + engineVersion + Trace explícitamente, fuera del documento canónico; su formato no se diseña aquí. Una futura modificación incompatible de semántica requiere migración o runner versionado; no cambiar silenciosamente el significado de Scenarios guardados.

## 7. Persistido frente a runtime y Reset

| Persistido en página/documento | Sólo memoria de ejecución |
|---|---|
| nodes, edges, páginas y settings existentes | Snapshot semántico y snapshot visual para resolver IDs |
| behaviors con initialState | Map de current states; nowMs; queue/sequence |
| scenarios, steps y contadores de autoría | Trace; cursor/estado de playback; reloj visual; highlights/partículas |
| Definición y orden de filas | Errores/validity derivados; selección de Scenario en panel |

Run toma una copia, valida completamente y calcula todo el Trace instantáneamente. Sólo tras éxito instala una sesión runtime y empieza reproducción 1x. Error devuelve `{ok:false,errors}` sin clave trace; fallos de guard durante cálculo descartan también los eventos temporales. Nunca presentar un Trace parcial como válido. Un fallo de SEND es resultado válido y no aborta el Scenario.

**Reset** cancela reproducción, descarta Trace y snapshot, limpia partículas/log runtime, devuelve tiempo visual cero y estado del control a IDLE. Vuelve a mostrar el diagrama normal exactamente como estaba antes de Run; el documento nunca fue editado. La próxima ejecución arranca desde Behavior inicial, no desde estados finales. Si la UI muestra una preview de disponibilidad inicial en IDLE, es sólo pintura y no un SET_STATE. Reset no borra pasos/configuración.

Durante RUNNING y COMPLETED se mantienen bloqueadas las ediciones de Structure/Behavior/Scenario hasta Reset. Pan/zoom, inspección y guardado de definición siguen disponibles. Cambiar página, cerrar panel, importar/reemplazar documento, undo/redo o entrar en Present primero resetea la sesión; callbacks tardíos llevan una generación de sesión y no reinstalan overlays. Importación fallida conserva el documento previo según la frontera existente. No duplicar el RAF del editor.

## 8. Persistencia, v4 y migración mínima

**Sí requiere bump v3 → v4**, en el campo real `version`. No por renombrar claves visuales, sino por incorporar semántica que un lector viejo no ejecuta ni debe descartar silenciosamente. Hoy el lector v3 rechaza v4: conservar ese rechazo visible es mejor que prometer edición sin pérdida con versiones antiguas.

- Implementación posterior: `serializeProject()` emite v4; `projectFromProjectData()` admite ausencia de versión, 1/2/3/4 y sigue rechazando mayores/desconocidas. No cambiar el códec v0/v1 del enlace: transporta JSON opaco, no es la versión del documento.
- Documentos históricos aceptados por la frontera actual siguen abriendo. Tras normalización visual actual, añadir por página `behaviors:[]`, `scenarios:[]`, `nextScenarioId:1` si faltan. No inferir Behavior desde iconos, labels, `pulse` ni animaciones.
- V4 también permite campos nuevos ausentes y aplica esos defaults. Campos presentes malformados no se reemplazan por vacío. Counters ausentes se derivan como max ID+1; presentes enteros seguros positivos se elevan si están por debajo del mínimo necesario, sin bajar un valor superior. Datos sin versión con campos nuevos válidos los conservan.
- Scenario/step necesitan el contador correspondiente; elevar mínimo de `page.nextId` también por referencias numéricas a entidades faltantes (steps, behaviors y endpoints), para no revivir referencias con una creación nueva. Si no queda entero seguro para asignar, rechazar creación/entrada que exija un contador imposible.
- Migración sobre copia, idempotente. No renumerar IDs existentes, no cambiar keys guardadas. Scenarios no necesitan una segunda versión interna: v4 fija sus acciones/reglas iniciales; cambios incompatibles se versionan a nivel documento.
- Formato malformado, acción/estado desconocidos o IDs duplicados: rechazar entrada antes de instalar documento. Referencias faltantes y límites de ejecución excedidos: conservar definición bien formada para reparar; marcar inválida y bloquear Run. No rechazar todo el diagrama sólo porque se borró un target.
- Autosave conserva su clave actual, pero guarda envelope v4. Save/Open, restore, deep link, Share, viewer y añadir páginas usan la misma frontera. Viewer del primer slice conserva Scenarios y Behavior sin ejecutar ni cargar runtime del editor. Share sigue siendo snapshot local en URL, con sus límites vigentes; ningún Trace entra en el payload.
- Actualizar docs del formato sólo al implementar v4. Esta tarea no publica v4 como formato ya soportado. No hay SW bump aquí porque sólo cambian documentos `.ai`; el slice deberá subir CACHE al cambiar assets y precachear scripts nuevos.

Retrocompatibilidad significa **lector nuevo abre documentos antiguos**. No significa lector v3 abre v4. Un eventual export v3 exigiría consentimiento explícito de pérdida y queda fuera del slice.

## 9. Identidad, cambios estructurales y validación

### Garantías adicionales necesarias

- IDs de nodos/aristas estables durante toda su vida. No reusar ID eliminado dentro de una página: `nextId` es marca monotónica. Undo/redo restaura entidades con su ID original, pero nunca baja la marca de asignación; usar el máximo del contador vivo y del snapshot.
- Snapshot de undo incluye también behaviors, scenarios y sus contadores; no restaurar sólo estructura. Los contadores Scenario/step tampoco bajan al deshacer. Aplicar cambios de autoría con la misma disciplina de undo/autosave del editor.
- Reemplazar contenido de una página conservando Scenarios (p. ej. Ejemplo) asigna nuevas entidades desde la marca actual, sin reiniciar `nextId`. Referencias anteriores quedan missing. Reemplazar **documento completo** instala páginas/identidades/definiciones de la entrada y elimina el runtime previo.
- Borrar nodo mantiene pasos y Behavior que lo referencian como missing; cascada actual de borrado de edges permanece, por lo que sus SEND quedan missing. No borrar pasos automáticamente ni retargetear por label.
- Cambiar endpoints de un edge conserva su ID y SEND pasa a usar sus nuevos endpoints después de Reset/revalidación. La UI debe mostrar siempre los endpoints actuales; un resultado anterior se invalida. Cambiar label, geometría o estilo conserva IDs y semántica.
- Copiar/duplicar selección crea IDs nuevos y remapea `from`/`to` y los overrides Behavior de los nodos copiados; no copia Scenarios con una selección parcial. `clip` deberá incluir sólo Behavior de esos nodos. Duplicar Scenario en la misma página asigna nuevo Scenario ID y copia pasos con IDs propios y contador propio, conservando references. Copiar página completa entre documentos conserva números y todas sus definiciones porque el namespace es la página.
- Renombrar o reordenar páginas no afecta referencias. Los IDs de Scenario no se usan fuera de su página; no es necesario un contador global.

### Validación previa completa

Validador puro devuelve errores `{code,path,stepId?}` en orden estable de recorrido, sin mensajes con comportamiento supuesto. Primero shape/tipos y duplicados, después referencias, después límites. Paths basados en índices de inputs, no locale ni orden de propiedades de objetos. No consultar referencias mientras su tipo sea inválido. El renderer/UI traduce códigos a mensajes locales.

| Invalida Run | Regla |
|---|---|
| Structure malformado | IDs no positivos/seguros, duplicados entre nodes y edges, endpoints no numéricos, arrays incorrectos |
| Edge colgante | Validar endpoints de todas las aristas de la página, no sólo SEND usados; engine exige un grafo íntegro |
| Behavior inválido | Duplicados nodeId, nodo ausente, initialState distinto de UP/DOWN, registro malformado |
| Scenario inválido | ID/name/contador inválido, steps no array, duplicate step IDs, timestamps inválidos |
| Paso inválido | Acción desconocida, campos indebidos/ausentes, estado desconocido, nodeId/edgeId equivocado de tipo o ausente |
| Guards | Steps, graph, tiempo, trabajos o emisiones exceden §14 |

Uniqueness de Scenario IDs y contadores de página se comprueba en la frontera de documento/autoría; `runScenario()` recibe sólo un Scenario y valida sus propios IDs. Otro Scenario inválido no bloquea uno válido, salvo errores compartidos de Structure/Behavior. Referencia existente en otra página cuenta como missing en ésta.

Prevalidar antes de crear sesión, incluso si la UI ya mostraba válido. Errores identifican fila/registro, mantienen la definición y deshabilitan Run. Reparación explícita: reasignar target, eliminar fila/override, reconectar/borrar edge colgante o restaurar mediante undo. Restaurar el nodo/arista con su identidad original vuelve a validar; crear otro con igual label no repara nada.

No aceptar JavaScript, eval, expressions, funciones, URLs de código ni extensiones que ejecuten instrucciones desconocidas. Son datos de operaciones cerradas. JSON del autor no se interpreta como código; UI usa texto seguro al mostrar nombres.

## 10. Engine, Playback y Renderer

### Archivos propuestos para implementar después

| Archivo | Responsabilidad futura |
|---|---|
| `js/scenario-engine.js` | Namespace encapsulado `FluyoScenarios`, validación semántica y runScenario puros; sin bootstrap ni globals editoriales |
| `js/scenario-playback.js` | Proyección pura de snapshot + Trace + playhead a estados/eventos visibles; sin RAF ni DOM |
| `js/editor-scenarios.js` | Panel, autoría, snapshot, ciclo de sesión, selección y coordinación; usa persistencia/undo existentes |
| `js/model.js` | Frontera v4/defaults/migración y persistencia de definitions |
| `js/editor-runtime.js` | Único RAF; reloj visual de sesión y entrega de overlay al renderer |
| `js/render.js` | Dibujo de datos runtime opcionales; sin reglas SEND |

Scripts clásicos encapsulados sin import/export ESM, npm ni build. Cargar engine antes de model si la frontera comparte validación de definición; playback y coordinador antes del bootstrap `editor-runtime.js`. En Node cargar engine en `node:vm` sin DOM ni config/model/editor; no agregar mocks de globals que oculten dependencia. Publicar sólo API necesaria en namespace, sin estado global de una corrida.

API engine: `FluyoScenarios.runScenario(structure,behaviors,scenario)` → Result de §5. Proyección mínima hecha por coordinador sobre copia; el engine no busca labels ni página activa. El snapshot visual sólo necesita la página y settings para resolver pintura; no copiar todo el proyecto/media innecesariamente.

### Playback

Engine calcula Trace de una vez. Playback aplica eventos por índice cuando `event.at <= playheadMs`, desde estados iniciales. Si salta un frame, consumir **todos** los eventos vencidos en orden; no perder terminales con timestamp idéntico. Estado resultante al final de timestamp refleja todos sus eventos, y log/highlights conservan cada uno.

Propuesta de pintura: `renderState.scenario` opcional con `{nodeStates,activeSends,edgeOutcomes,suppressDecorativeFlow:true,showAllNodes:true}` como datos de dibujo. Ausencia del campo mantiene comportamiento actual. Node states, sends y outcomes se derivan; renderer nunca evalúa availability ni decide success/fail.

- DOWN: badge con texto DOWN y borde distinguible; UP: status pequeño UP mientras la sesión está activa. No mutar `node.color`, `fill`, `pulse`, `anim`, opacity persistida ni label. No depender sólo del color para fallos.
- SEND exitoso: una partícula `from → to` sobre `edgePoints()`/`pointAt()`. Fallido: highlight del edge y marcador de fallo en el endpoint según reason, con texto en log; no dibujar entrega exitosa. Con source_down, marcador en source.
- Ocultar bolas decorativas continuas/single-flow y aparición build durante la sesión usando opciones de pintura; todos los nodos visibles. No sobrescribir settings ni `edge.animated`/`flowDir`. Animaciones internas de nodos siguen siendo estilo, no engine.
- Duración decorativa propuesta 300 ms de playback para partículas/highlights; es presentación posterior al evento instantáneo, nunca latency. Para SEND a 6000, terminal ya está en el log a 6000 y el movimiento visual dura hasta 6300. Varios sends a igual at se conservan como instancias por índice de Trace, sin colapsarlas por edgeId.
- Reloj visual usa RAF/performance sólo en coordinador: `playhead = elapsedVisual * speed`. Velocidad inicial 1x; engine independiente. Background/tab tardía puede saltar pintura, pero todos los eventos se aplican. El final visual espera último timestamp + cola decorativa; entonces COMPLETED conserva estados finales/log hasta Reset. Scenario vacío finaliza inmediatamente.
- Run desde IDLE; botón deshabilitado en RUNNING/COMPLETED, Reset disponible. No Pause en primer slice: Run/Reset alcanza para comprobar el flujo de seis segundos. El futuro Pause congela sólo playhead/partículas, Resume retoma base visual; jamás recalcula ni pausa engine.

Export PNG/JPG/SVG/GIF del diagrama conserva su conducta actual, sin overlays Scenarios en primer slice; datos runtime sólo en frame del editor. Guardar .fluyo.json durante playback guarda definición, no progreso.

### Frontera para Present

Snapshot + Trace + proyección de playback son suficientes para un Present futuro con su propio reloj y `makeReadOnlyRenderState()`. No depende del panel, selección o factories. Hoy Present y Scenario playback son mutuamente excluyentes; entrar en Present hace Reset, y Run no está disponible dentro de Present. No automatizar cambios de página ni Scenario en Share viewer. Esta frontera permite integrar después sin duplicar engine ni persistir Trace.

## 11. UI mínima de autoría

**Elección: pestaña Scenarios en el panel lateral derecho existente**, alternando con Propiedades. Es capacidad local al canvas/página, no modal independiente ni otro panel permanente inferior. Reusar comportamiento del panel móvil como cajón; lista desplazable, sin timeline gráfico. Canvas conserva su espacio y pan/zoom.

Contenido mínimo:

- Selector de Scenario de la página; Crear, nombre editable, duplicar/eliminar.
- Sección plegable «Estado inicial»: selector de nodo + UP/DOWN, defaults UP y opción retirar override. Compartida por todos los Scenarios de esa página, indicado en texto.
- Filas: tiempo `mm:ss.mmm`, acción, selector node o edge, estado si corresponde; borrar y subir/bajar en empates. + Añadir paso. Nuevo paso: SET_STATE UP al tiempo de la última fila o 0, target vacío hasta elegir; target vacío es borrador inválido, no creación de JSON malformado persistible (no guardar fila hasta completarla).
- Selector de edge muestra `source label (#id) → target label (#id) · edge #id`; node muestra label + ID. Labels repetidos no crean ambigüedad. Estado missing muestra ID y error, sin sustitución automática.
- Tiempo se convierte exactamente a entero ms: entrada decimal hasta tres cifras; no redondear silenciosamente. Selector cerrado de acciones/estados.
- Run y Reset, reloj virtual legible y lista de Trace readonly (mismo orden exacto). No scrubber, debugger, breakpoints, scripting ni conditions. Error por fila/Behavior/edge compartido y resumen; Run deshabilitado hasta reparar.
- Editar definition/Behavior es edición de documento con undo/autosave. Seleccionar Scenario, abrir pestaña, Run o Reset son runtime y no escriben documento.

## 12. Puntos futuros, sin implementación

Latencia/timeout/retry/backoff/DLQ/circuit breaker requerirán nuevas reglas y posiblemente configuración/eventos; la queue acepta trabajo generado y el Trace admite evolución versionada. No persistir una queue de mensajes ni elegir esos contratos ahora. No crear KafkaNode/KafkaFailure/KafkaRetry; perfiles futuros deberán expandirse a datos de primitivas conocidas.

Analytics posibles para tarea separada: `scenario_created` al completar creación válida; `scenario_run` tras validación y cálculo exitoso; `scenario_completed` tras final visual sin Reset. No instrumentar, modificar listas del proveedor ni emitir datos ahora. Una propuesta posterior debe revisar significado (engine completado frente a playback completado), taxonomía y privacidad: sólo señal agregada, nunca nombres, IDs, steps, Trace ni timestamps del usuario.

## 13. Ejemplo obligatorio end-to-end

### Structure, Behavior y Scenario persistidos (v4 propuesto)

Ejemplo completo de entrada propuesta; no archivo de fixture productivo. IDs reales del tipo ya utilizado por Fluyo, compartiendo contador entre nodos y edges:

```json
{
  "version": 4,
  "app": "fluyo",
  "doc": {
    "theme": "dark",
    "customBg": "",
    "cur": 0,
    "pages": [{
      "name": "Flujo de mensajes",
      "nextId": 8,
      "nodes": [
        {"id": 1, "shape": "rect", "x": 100, "y": 100, "label": "Producer"},
        {"id": 2, "shape": "rect", "x": 350, "y": 100, "label": "Kafka"},
        {"id": 3, "shape": "rect", "x": 600, "y": 100, "label": "Consumer"},
        {"id": 4, "shape": "rect", "x": 850, "y": 100, "label": "PostgreSQL"}
      ],
      "edges": [
        {"id": 5, "from": 1, "to": 2},
        {"id": 6, "from": 2, "to": 3},
        {"id": 7, "from": 3, "to": 4}
      ],
      "behaviors": [],
      "nextScenarioId": 2,
      "scenarios": [{
        "id": 1,
        "engineVersion": 1,
        "name": "Caída de Kafka",
        "nextStepId": 5,
        "steps": [
          {"id": 1, "at": 0, "action": "SET_STATE", "nodeId": 2, "state": "DOWN"},
          {"id": 2, "at": 1000, "action": "SEND", "edgeId": 5},
          {"id": 3, "at": 5000, "action": "SET_STATE", "nodeId": 2, "state": "UP"},
          {"id": 4, "at": 6000, "action": "SEND", "edgeId": 5}
        ]
      }]
    }]
  },
  "settings": {}
}
```

Defaults de estilo/geometría/settings se completan por la frontera existente. Behavior `[]` es toda la configuración necesaria: los cuatro nodos comienzan UP; no hay regla especial para labels Kafka o PostgreSQL.

### Event queue exacta

| Extracción | at (ms) | sequence | stepId | Trabajo | Estado nodo 2 después |
|---|---:|---:|---:|---|---|
| 1 | 0 | 0 | 1 | SET_STATE node 2 DOWN | DOWN |
| 2 | 1000 | 1 | 2 | SEND edge 5 | DOWN |
| 3 | 5000 | 2 | 3 | SET_STATE node 2 UP | UP |
| 4 | 6000 | 3 | 4 | SEND edge 5 | UP |

### Trace exacto

```json
{
  "engineVersion": 1,
  "scenarioId": 1,
  "events": [
    {"at": 0, "type": "state_changed", "stepId": 1, "nodeId": 2, "from": "UP", "to": "DOWN"},
    {"at": 1000, "type": "send_started", "stepId": 2, "edgeId": 5},
    {"at": 1000, "type": "send_failed", "stepId": 2, "edgeId": 5, "reason": "target_down"},
    {"at": 5000, "type": "state_changed", "stepId": 3, "nodeId": 2, "from": "DOWN", "to": "UP"},
    {"at": 6000, "type": "send_started", "stepId": 4, "edgeId": 5},
    {"at": 6000, "type": "send_succeeded", "stepId": 4, "edgeId": 5}
  ]
}
```

### Qué ve el usuario a 1x

Al iniciar, cuatro nodos visibles y reloj 00:00.000; Kafka recibe badge DOWN. A 00:01.000 log muestra started y failed contiguos, edge 5 resaltado y fallo en Kafka; no entrega ni propagación. A 00:05.000 Kafka muestra UP. A 00:06.000 aparecen started y succeeded, con partícula hacia Kafka durante 300 ms visuales; reloj lógico del resultado final sigue siendo 6000 ms. Consumer y PostgreSQL permanecen UP sin eventos ni partículas en edges 6/7. Después conserva log/estados hasta Reset. Reset recupera canvas normal y limpieza runtime.

Run #1, #2 y #500 generan exactamente estos seis eventos. Velocidad 2x futura comprime su reproducción a la mitad, sin cambiar ningún `at` ni evento. Para mostrar Consumer → PostgreSQL harían falta SEND explícitos adicionales; no pertenecen a esta prueba.

## 14. Límites y guards

Valores iniciales de implementación (operativos, revisables con medición; no cambiar la semántica UP/DOWN):

| Guard por ejecución | Propuesta inclusiva | Defensa |
|---|---:|---|
| MAX_STEPS | 1000 | acota autoría, sort y Run síncrono |
| MAX_VIRTUAL_TIME_MS | 86400000 (24 horas) | acota timestamps/sumas futuras; no espera tiempo real |
| MAX_WORK_ITEMS | 2000 | cuenta extracción de queue, incluidos trabajos futuros |
| MAX_TRACE_EVENTS | 2000 | cada SEND v1 emite dos; cada SET_STATE como máximo uno |
| MAX_NODES / MAX_EDGES | 10000 / 10000 | acota validación y snapshot semántico de página |

Comprobar steps y graph antes de ordenar/copiar para ejecutar; entrada JSON mantiene defensas vigentes del transporte, no usar estas cotas como nuevo límite global del formato. Límite de definición excedido se puede guardar/importar, pero no ejecutar. En v1 queue sólo tiene N pasos, sin loops ni trabajo generado. Guards de dequeue/append comprueban **antes** de exceder; si se dispara uno, abortar y devolver error sin Trace. No truncar ni producir success parcial.

No usar watchdog de wall-clock para decidir resultado lógico: variaría por equipo. Complejidad v1 O(V+E+B+N log N+eventos), memoria acotada. No heap, workers ni optimización anticipada. Estas cotas no prueban fluidez del renderer en todo equipo; medir un caso al límite en navegador y ajustar límites en una revisión técnica si hace falta.

## 15. Tests que debe tener la implementación y primer slice

### Plan de tests con resultados esperados

| Grupo | Caso / aserción |
|---|---|
| Determinismo | Mismo input congelado 100 veces: deep equality y JSON idéntico al Trace de §13; llamadas intercaladas con otro Scenario no contaminan estado |
| Irrelevancia visual | Cambiar labels, shape válida, estilo, `flowDir`, puntas, orden de nodes/edges/behaviors y velocidad visual: Trace idéntico |
| Ordering | SET_STATE DOWN → SEND al mismo at falla; SEND → SET_STATE DOWN tiene éxito. IDs invertidos no cambian orden; inputs sin ordenar se procesan por at/índice |
| Atomicidad | Dos SEND al mismo at producen started/terminal contiguos para cada step; varios SET_STATE al mismo at observan estado previo por sequence |
| State | UP → DOWN → UP exacto; repetición del mismo estado no emite; initialState DOWN y default UP correctos; no eventos sintéticos iniciales |
| SEND | Las cuatro combinaciones de §4, prioridad source_down, SEND repetido, aristas paralelas, self-edge válido y ninguna propagación implícita |
| Invalid references | node/edge inexistente, ID de tipo equivocado, endpoint ausente, Behavior huérfano y edge colgante no usado: error sin trace |
| Datos inválidos | negativos/fracciones/string/NaN/Infinity/overflow, action/state desconocidos, claves de otra acción, arrays incorrectos, duplicate entity/step/Scenario/Behavior IDs |
| No mutation/pureza | Deep-freeze de inputs; byte equality antes/después. Engine ejecuta en Node sin DOM, Canvas, storage, RAF, model ni Date/performance/random como servicios disponibles |
| Reset/playback | Run/Reset/Run reinicia states/queue; Reset IDLE y COMPLETED idempotente; cancelar partícula y callbacks tardíos; salto 0→6000 aplica seis eventos en orden; documento igual antes/después |
| Serialization | Crear/editar/duplicar/borrar, guardar/reabrir v4 y restaurar autosave mantienen IDs, counters, Behavior y orden de steps. Guardar en RUNNING no contiene trace/currentState/playhead |
| Migration | Fixtures históricos sin version y v1/2/3 abren con defaults; v4 opcional vacío; counters elevados; input no mutado; migración idempotente; versión 5 rechazada; campos malformados no borrados |
| Identidad/undo | Create → undo → create no reusa ID; borrar target → guardar/reabrir → crear no repara missing; undo target original sí repara; reemplazo de página no retargetea. Undo/redo incluye Behavior/Scenarios y conserva marcas altas |
| Páginas/copia | IDs iguales en páginas no colisionan; reordenar/renombrar y append conservan Scenarios; copiar selección remapea Behavior/endpoints y no copia Scenario; borrado de página elimina sus definiciones |
| Guards | Cota exacta admitida y +1 rechazada; MAX_TRACE_EVENTS exacto con 1000 SEND; fallo de guard interno sin Trace parcial; graph/virtual time/work items seguros |
| Renderer | Sin overlay mantiene frame actual; sesión muestra UP/DOWN, fallo con texto, success dirigido from/to y suprime flow/build sin mutar settings; ausencia de flujo en edges 6/7 |
| Fronteras existentes | Archivo/deep link/Share/viewer conservan v4 y referencias missing; viewer sólo preserva, no corre engine/playback; límites Share vigentes. Render boundary, editor-runtime y suites de import/Share existentes siguen pasando |
| Navegador | Recorrido completo §13 HTTP y file://; canvas/pan/zoom; cambio página, Present, import y cierre cancelan sesión; undo/autosave; SW upgrade/offline para assets nuevos. Sin red de Scenarios ni dependencias nuevas |

### Primer slice implementable EXACTO

Un solo incremento vertical, en este orden interno:

1. v4 en frontera común; defaults Behavior/Scenario por página; marcas de IDs, clipboard y undo/redo según §9; conservar archivo/autosave/deep link/Share/viewer.
2. Engine puro validado con únicamente SET_STATE, SEND, UP, DOWN, virtual queue y Trace de §4–§6; pruebas Node deterministas, sin DOM.
3. Pestaña Scenarios del panel derecho: Crear/seleccionar/nombrar/duplicar/eliminar Scenario; editar initialState; añadir/editar/eliminar/reordenar filas en empates sin JSON; mostrar missing/errores.
4. Run calcula Trace completo y lo reproduce a 1x; log readonly, badges de nodos, highlight de fallo y partícula de SEND exitoso mediante Canvas/geometry existentes. Un único RAF del editor.
5. Reset limpia sólo runtime; bloqueo de edición durante sesión, cancelación al cambiar contexto y persistencia exclusiva de definitions.
6. Tests de tabla, ejemplo §13 y regresiones de fronteras relevantes; CACHE/precache de scripts nuevos y documentación pública del formato v4.

Entregable comprobable: crear el diagrama de cuatro nodos, autorar las cuatro filas, guardar/reabrir, Run → seis eventos exactos, visualizar fallo/éxito y Reset sin modificación estructural. El mismo caso con tres nodos produce idéntico Trace. No Pause, selector de velocidades, scrubber, engine en viewer/Present, export de Trace ni otras acciones en este slice.

## Decisiones tomadas

- [D-011](../DECISIONS.md#d-011--scenarios-motor-puro-con-tiempo-virtual-determinista): ejecución local pura y reloj/cola deterministas.
- [D-012](../DECISIONS.md#d-012--scenarios-definiciones-persistidas-trace-derivado-y-playback-separado): runtime aislado, Trace derivado y frontera de playback.
- [D-013](../DECISIONS.md#d-013--scenarios-por-pagina-y-evolucion-del-formato-a-v4): alcance página, identidad y migración v4 futura.
- Decisiones específicas del incremento: Behavior separado con default UP; SET_STATE/SEND; desempate por índice explícito; source_down prioritario; panel derecho; Run/Reset; cotas iniciales §14.

## Archivos modificados

- `.ai/tasks/FLUYO-007.md` — especificación, evidencia, contratos, tests y handoff, siguiendo `_TEMPLATE.md`.
- `.ai/DECISIONS.md` — D-011–D-013 como contratos técnicos acordados para implementación posterior, no descripción de runtime implementado.
- `.ai/ARCHITECTURE.md` — precisión menor de modelo actual (versión comprobada y frontera) y referencia explícita al diseño pendiente.

## Pruebas

- Revisión dirigida del código y recorrido manual de reglas de §13: seis eventos exactos, sin propagación.
- Verificación de sintaxis de todos los bloques JSON de esta tarea y comprobación del ejemplo visual con la frontera **actual v3** usando una copia con sólo `version` adaptada a 3: geometría/IDs/defaults compatibles. Esto no certifica soporte v4 actual ni ejecuta un engine propuesto.
- `node test/render-boundary.cjs`, `node test/render-boundary-run.cjs`, `node test/editor-runtime.cjs`: PASS sobre runtime existente.
- `git diff --check` de los documentos modificados: PASS.
- Los tests futuros de §15 no se declaran ejecutados: todavía no existe implementación Scenarios. No se hizo QA visual de una UI inexistente.

## Pendientes / riesgos

- Se debe revisar arquitectura antes del slice; hay trabajo de identidad/undo imprescindible, no basta añadir un motor aislado.
- V4 no abre en lectores v3; la retrocompatibilidad es hacia documentos históricos. Revalidar todas las entradas que comparten la frontera y el viewer al implementar.
- Reproducibilidad depende de conservar engineVersion y reglas; cambios futuros incompatibles necesitan migración/versionado explícito.
- SEND instantáneo y partícula posterior pueden confundirse con latency: log/timestamps son autoridad y la UI no debe afirmar retraso lógico.
- Guards propuestos necesitan medición de navegador; no garantizan fluidez de grafos grandes.
- Renderer aún usa globals de documento; extensión de pintura debe conservar la frontera FLUYO-004 y no introducir reglas engine allí.
- Se observaron comentarios preexistentes en código de ejemplo con información que podría ser privada; no se copian ni se modifican en documentación pública. Conviene revisión aparte de confidencialidad.
- Estado/cambios previos FLUYO-006 preservados. Su bloqueo Share es independiente de esta entrega de arquitectura.

## Handoff

### Estado actual

Arquitectura completa, sin implementación productiva. DONE para diseño; recomendación para ejecución: **LISTO PARA REVISIÓN DE ARQUITECTURA**, seguido del slice exacto §15. No hay opciones A/B abiertas ni bloqueadores de diseño conocidos. No commit/push ni cambios propios a runtime, SW, PRODUCT o AGENTS.

### Próximo paso concreto

Revisar §3–§10 y el ejemplo §13, confirmar el contrato v4 de esta tarea y abrir una tarea de implementación con el alcance exacto §15. Comenzar por invariantes de IDs/undo/migración y tests de pureza/Trace. Implementar sólo después de esa revisión; esta sesión termina en arquitectura.
