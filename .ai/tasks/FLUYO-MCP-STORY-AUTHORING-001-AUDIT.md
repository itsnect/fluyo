# FLUYO-MCP-STORY-AUTHORING-001 · FASE 0 · Auditoría y diseño

Fecha: 2026-11-02 · Base: `fluyo` `origin/main` = `9eeeb42` (fluyo.space sirve `fluyo-static-v123`) · `fluyo-mcp` `main` = `464f4e0` (kernel `f1fe2c32`, idéntico a `9eeeb42` según `check:kernel`).

Sin código de producto, CACHE, commits, push ni deploy. Evidencia reproducible fuera del repo, en `C:\Proyectos\fluyo-new\FLUYO-MCP-STORY-AUTHORING-001-evidencia\`.

**Estado: READY FOR REVIEW. Recomendación: `READY TO IMPLEMENT S1`, con S1 redefinida (§ 12) y las decisiones D1–D5 del PO (§ 13).**

## 0. Conclusión

**La primitive ya existe.** Hoy, sin cambiar nada, un agente crea por MCP una Historia lineal y una con fallo real, y un humano las abre, reproduce, edita y vuelve a pasar por el MCP.

Lo comprobé de principio a fin:

- **Tres agentes externos** (2 Sonnet, 1 Haiku), solo con el catálogo y una intención, crearon Historias válidas con **0 rechazos**.
- **Los dos agentes a los que se pidió un fallo** usaron el fallo real del motor sin que nadie se lo indicara.
- **El Trace** de la vía MCP es **byte a byte** el de «Falla aquí».
- **La variante** por MCP es **byte a byte** la de «Otra forma desde aquí».

Por eso **no hacen falta tools nuevas, ni operaciones de fallo o variante, ni cambio de formato**. La tarea real es cerrar cinco huecos medidos:

| # | Hueco | Evidencia | Gravedad |
|---|---|---|---|
| G1 | **Un agente no puede abrir un enlace que le pasa un humano.** `LINK_REVISION_REQUIRED` sin salida | La ejecución R4 quedó **bloqueada** | Bloquea el flujo natural |
| G2 | **El MCP no conoce el desenlace.** «Sin fallos» / «Falla en el paso N» vive en `story-clock.js`, fuera del kernel | Ni `run_story` ni `describe_document` lo dan | S2 no puede cerrar su gate |
| G3 | **Un cambio puede alterar Historias ajenas en silencio** | `set_initial_availability` cambia una Historia de `completed` a `not_completed` con `ok:true`, sin aviso y con `touchedStories:[]` | Rompe el escenario D |
| G4 | **Los errores de schema no son estructurados** | Texto `MCP error -32602`, hasta 3,8 KB de ruido | Incumple § 12 del encargo |
| G5 | **Coste evitable** | `describe` 2,4–19,7 KB por llamada; hace falta un `run_story` extra solo para saber el desenlace | −63 % a −73 % de lo recibido |

## 1. Mapa del MCP actual

**Arquitectura.** Quince tools **puras y sin estado**: reciben JSON, devuelven JSON y no guardan nada. El kernel de Fluyo se ejecuta tal cual en un `vm` nuevo por llamada. El «documento» viaja en cada llamada, como JSON o como enlace `#d=`.

Esto importa: **«mutar el documento» no existe.** El MCP devuelve un documento nuevo; persistirlo es del humano o del cliente.

| Necesidad | Tool / operación | Estado |
|---|---|---|
| Documento, página, nodos, conexiones | `describe_document` (`pageIndex`, `includeSteps`) | Sí, sin selección de campos |
| Historias, pasos, frases | `describe_document` | Sí, sin desenlace |
| Biblioteca de eventos | `describe_document.eventTypes` | Sí |
| Ejecutar | `run_story`: Trace, estado por paso, `finalAvailability`, `traceDigest` | Sí, sin desenlace de la Historia |
| Crear Historia | `author_document`: `create_story` | Sí |
| Pasos | `add_step`, `remove_step`, `move_step`, `duplicate_step`, `retarget_step`, `set_wait`, `set_step_message`, `set_arrival_dependencies` | Sí |
| Corregir | `rename_story`, `delete_story`, `dryRun` (solo validar), lote atómico con `ref` | Sí |
| Variante | `duplicate_story` + `remove_step` | Sí, idéntica a la UI |
| Round-trip | `baseRevision` / `resultRevision` / `editorUrl` | Sí, salvo G1 |
| Mensajes | `add_step.message`, `set_step_message` (1–120, cualquier paso) | Sí |
| Token efficiency | `returnDocument:false`, enlace como `document`, JSON sin sangría | Parcial |
| Descriptions | Reglas críticas en los primeros 2 048 caracteres | Sí; solo en español |
| Errores del kernel | `code`, `operationIndex`, `field`, a veces candidatos | Buenos |
| Errores de schema (Zod) | Texto del SDK | **Malos (G4)** |

**Catálogo:** 54 691 B, unos 26,6 k tokens, de los que `author_document` son 29,8 KB. Guardia: 63 000 B, así que el margen es de **8 309 B**.

**Referencia de pruebas:** `npm test` 918/919. El fallo es anterior y ajeno a esta tarea: `fluyo-mcp-step-reverse-001` afirma que ningún documento del corpus usa `reverse`, y `compra-online` lo usa desde FLUYO-EXAMPLES-001. Hay que corregir ese test al empezar S1.

## 2. Mapa de Stories actual

```text
Page.scenarios[] = { id, engineVersion: 2, name, nextStepId, steps[], observedFlow?, arrivalDependencies? }
Step = { id, at, action: SEND | OCCURRENCE | SET_STATE, edgeId | nodeId, state?, eventTypeId?, reverse?, message? }
```

| Concepto | Modelo real | Dónde está la regla | ¿Lo tiene el MCP? |
|---|---|---|---|
| Momento | Pasos con el mismo `at` (`storyboardGroups`) | `model.js` | Sí |
| Frase | `step.message`, solo presentación | `model.js` | Sí |
| Sentido | `step.reverse`, misma conexión | `model.js` | Sí |
| Fallo | `SET_STATE DOWN` en un momento **anterior** al envío; el motor emite `send_failed / target_down` | Motor | Sí |
| «Falla aquí» | `SET_STATE DOWN` **sin evento**, en un hueco antes del envío | `editor-scenarios.js` (receta de UI) | Lee y edita ese paso; lo escribe con evento |
| Desenlace | Primer momento con `send_failed`; `ok` si no hay ninguno; nada sin pasos | **`story-clock.js`, no es kernel** | **No (G2)** |
| Variante | Otra Historia de la **misma página**; copia hasta el momento k (dec. 317) | `editor-scenarios.js` | Sí, por composición |
| Familia / «Otras formas» | Las demás Historias con pasos de la página (dec. 314) | `story-clock.js` | Derivable de `describe` |
| Parentesco | **No existe campo** (`variantOf` se descartó en la dec. 314) | — | — |
| Disponibilidad inicial | `page.behaviors`: **de la página, compartida por todas sus Historias** | `model.js` | Sí; origen de G3 |

**Aclaración sobre el gate S3.** El encargo habla de «parent/divergence semantics». En el modelo vigente no hay parentesco guardado: el punto de divergencia solo se deriva del prefijo común de pasos. S3 debe verificar eso y **no** añadir un campo.

**Transporte hacia el humano:**

| Vía | Qué lleva | Límite |
|---|---|---|
| `editorUrl` (`/#d=`) del MCP | Documento entero | 16 000 caracteres; abre en modo **Editar**, sin Historia elegida |
| Compartir (`/s/#d=`) | La Historia elegida y su familia; **quita las Historias de otras páginas** | Instantánea para el Viewer |
| Guardar (`.fluyo.json`) | Documento entero | Único camino completo desde la UI hacia el agente |
| Barra de direcciones tras editar | **El `#d=` no cambia: queda antiguo** | No sirve para volver al agente |

## 3. Resultados medidos (escenarios A–E)

Servidor real en memoria, compilado de `464f4e0`. Interfaz real en `fluyo.space` v123 con el navegador integrado.

| Escenario | Resultado | Evidencia |
|---|---|---|
| **A** éxito | ✅ 3 llamadas, 1 lote, 7 operaciones | UI: «Sin fallos» |
| **B** fallo | ✅ Envío a Banco `not_completed / target_down`, Banco DOWN al final | Editor, Viewer y Present: «Falla en el paso 3». El Viewer lista «Otras formas» con su desenlace |
| **C** referencia inválida | ✅ Rechazo estructurado y recuperable (§ 8) | 15 casos más los de revisión |
| **D** Historias existentes | ✅ en la autoría normal; ❌ con `set_initial_availability` (G3) | Sobre `compra-online`: JSON de las dos Historias, biblioteca y `traceDigest` idénticos |
| **E** round-trip | ✅ MCP → UI («Falla aquí») → guardado → MCP → edición y variante → UI | Sin editar, la Historia, nodos, conexiones, eventos y ajustes vuelven **byte a byte** |

También comprobado en la UI, sobre una Historia creada por MCP: menú completo del paso («Falla aquí», «Otra forma desde aquí», «Mensaje del paso…»), reproducción con marca de fallo y «Bank no está disponible», y «Añadir como página nueva» (válido, con ids de evento reasignados).

**Paridad con la UI:**

| Comparación | Resultado |
|---|---|
| «Falla aquí» frente a `add_step` (`SET_AVAILABILITY`) + `move_step {gapIndex}` | Mismos `at` y estados; **`traceDigest` idéntico**. La única diferencia es `eventTypeId` en el paso |
| «Otra forma desde aquí» frente a `duplicate_story` + `remove_step` | **Historia idéntica byte a byte**, mismo orden, original intacta, dependencia podada con su `cascade` |
| Operaciones del agente sobre un paso sin evento de la UI | `set_step_message`, `set_wait`, `move_step`, `retarget_step`, `duplicate_step`, `remove_step`: todas correctas |

La receta de «Otra forma» se reprodujo con las funciones reales del kernel, sin pulsar el botón. «Falla aquí» se comprobó además con un clic real: dio la misma forma de paso.

## 4. Missing primitives

| Primitive | Pieza | Toca |
|---|---|---|
| Leer un enlace ajeno | `describe_document` acepta enlace sin revisión y devuelve `revision` | `link-input.ts`, `server.ts` |
| Desenlace | `outcome` en `run_story`, `describe_document` y `author_document` | `sync-kernel.ts` (`story-clock.js` verbatim), `stories.ts`, `authoring.ts` |
| Guarda de Historias ajenas | Aviso `STORY_OUTCOME_CHANGED` | `authoring.ts` |
| Errores de schema | `SCHEMA_INVALID` estructurado | `server.ts` |
| Candidatos en `TARGET_NOT_FOUND` | Añadidos en la capa MCP desde el documento | `authoring.ts` |
| `refs` completos | También `story`, `step`, `eventType`, derivados de `changes[]` | `authoring.ts` |
| Respuesta compacta | `detail:"summary"` | `stories.ts`, `authoring.ts` |
| Descriptions | Story = Historia, receta del fallo, alcance de la disponibilidad inicial | `server.ts`, `authoring.ts` |

**Sobre `story-clock.js`.** Cargado en el `vm` del kernel funciona (+0,6 ms, 14,7 KB, sin DOM ni timers al cargar) y da el mismo desenlace que la UI en los tres ejemplos probados. Portarlo a TypeScript crearía una segunda regla, justo lo que el kernel evita. Moverlo a `story-playback.js` tocaría archivos servidos y consumiría v124.

## 5. Propuesta de tool contract

**Cero tools nuevas. Cero operaciones nuevas en S1.** Todos los cambios son aditivos y opcionales: un cliente antiguo recibe lo de siempre, con campos de más.

### `describe_document`

| Cambio | Contrato |
|---|---|
| `document` enlace **sin** `baseRevision` | Solo aquí. Devuelve `revision` y `linkRevisionUnverified:true`. Con revisión, igual que hoy. El resto de tools siguen exigiéndola |
| Enlace `/s/` | Añade `linkKind:"viewer"` y un aviso: es una instantánea sin las Historias de otras páginas |
| `detail:"full"\|"summary"` (por defecto `full`) | `summary`: `revision`, `valid`, nodos `{id,label,availability?}`, conexiones `{id,from,to,label?}`, eventos `{id,name,primitive,availability?}`, Historias `{storyId,name,stepCount,outcome}`, `unmodeled` |
| `stories[].outcome` | También en `full` |

### `run_story`

- Añade `storyOutcome`.
- `detail:"summary"` omite `trace` y `unmodeled`; conserva `steps` y `traceDigest`.

### `author_document`

- Añade `stories[]` con cada Historia tocada: `{pageIndex, storyId, name, stepCount, momentCount, outcome}`. También con `dryRun:true`, que así es la validación barata.
- Añade `warnings[]` `STORY_OUTCOME_CHANGED`.
- `refs[]` pasa a incluir `story`, `step` y `eventType`. El agente de R2 lo vio vacío aunque había usado `ref`.
- `detail:"summary"` omite `changes` y `unmodeled`.

### Forma del desenlace

```json
{ "status": "no_failures" }
{ "status": "failed", "moment": 3, "stepId": 3, "reason": "target_down", "reasonNode": { "id": 3, "label": "Bank" } }
{ "status": "empty" }
```

- `moment` empieza en 1, como «Falla en el paso N». Aviso: `run_story.steps[].moment` empieza en 0 y no se puede cambiar sin romper clientes. Se documenta.
- **Sin texto:** la etiqueta visible es de la UI y de su idioma.

### Lo que se descarta, con datos

| Propuesta | Por qué no |
|---|---|
| `create_story_from_prompt` | Opaco. Excluido por el encargo |
| `fail_step` / `falla_aqui` | La vía existente da el mismo Trace; 2/2 agentes la encontraron |
| `create_variant` / `branch_story` | La composición da una Historia idéntica. Se revisa en S3 solo si la QA con agentes falla |
| `add_steps` | Con 4 pasos ahorra poco; ROUND-TRIP-001 lo sitúa en −35 % en Historias largas. No es de este alcance |
| Tool de validación aparte | `dryRun` ya lo es |
| `update_story` / `replace_steps` | Ya cubierto por `remove_step`, `retarget_step`, `set_*`, y por `delete_story` + `create_story` en el mismo lote |
| Campo `variantOf` | Contra la dec. 314 |

## 6. Ejemplo completo: Agente → Historia

Intención: *«Explain a successful purchase.»*

**1. Inspeccionar** (propuesta; `detail` no existe aún)

```json
{ "document": "https://fluyo.space/#d=…", "pageIndex": 0, "detail": "summary" }
```

```json
{
  "revision": "sha256:988d…", "linkRevisionUnverified": true, "valid": true, "pageIndex": 0, "name": "Checkout",
  "nodes": [{"id":1,"label":"Store"},{"id":2,"label":"Payment"},{"id":3,"label":"Bank"}],
  "connections": [{"id":4,"from":1,"to":2},{"id":5,"from":2,"to":3}],
  "eventTypes": [], "stories": []
}
```

**2–4. Planificar, escribir y validar en un solo lote.** Estas operaciones son las que se ejecutaron hoy, sin cambios en el servidor:

```json
{
  "document": "https://fluyo.space/#d=…", "baseRevision": "sha256:988d…", "returnDocument": false,
  "operations": [
    {"op":"create_event_type","scope":"eventType","ref":"req","name":"Request","primitive":"FLOW","sentence":"{source} asks {target}"},
    {"op":"create_event_type","scope":"eventType","ref":"res","name":"Response","primitive":"FLOW","sentence":"{source} answers {target}"},
    {"op":"create_story","scope":"story","pageIndex":0,"ref":"s","name":"Successful purchase"},
    {"op":"add_step","scope":"story","pageIndex":0,"storyId":{"ref":"s"},"eventTypeId":{"ref":"req"},"target":{"edgeId":4},"message":"The store asks Payment to charge","ref":"m1"},
    {"op":"add_step","scope":"story","pageIndex":0,"storyId":{"ref":"s"},"eventTypeId":{"ref":"req"},"target":{"edgeId":5},"message":"Payment asks the bank to authorise","waitsForArrivalOf":[{"ref":"m1"}],"ref":"m2"},
    {"op":"add_step","scope":"story","pageIndex":0,"storyId":{"ref":"s"},"eventTypeId":{"ref":"res"},"target":{"edgeId":5,"reverse":true},"message":"The bank authorises","waitsForArrivalOf":[{"ref":"m2"}],"ref":"m3"},
    {"op":"add_step","scope":"story","pageIndex":0,"storyId":{"ref":"s"},"eventTypeId":{"ref":"res"},"target":{"edgeId":4,"reverse":true},"message":"Payment confirms: charged","waitsForArrivalOf":[{"ref":"m3"}]}
  ]
}
```

**5. Ejecutar.** La respuesta propuesta ya trae el resultado, así que `run_story` queda para cuando se quiera el detalle:

```json
{ "ok": true, "resultRevision": "sha256:57f6…", "editorUrl": "https://fluyo.space/#d=…",
  "stories": [{ "pageIndex":0, "storyId":1, "name":"Successful purchase", "stepCount":4, "momentCount":4, "outcome":{"status":"no_failures"} }] }
```

**6. Revisar.** El humano abre `editorUrl`, pulsa Historias y Reproducir. La Historia es como cualquier otra: la UI ofrece sobre ella «Falla aquí» y «Otra forma desde aquí», y la reproduce con «Sin fallos».

## 7. Ejemplo de fallo

Intención: *«Show what happens when the bank stops responding.»* Lote ejecutado hoy sobre el documento anterior:

```json
[
  {"op":"create_event_type","scope":"eventType","ref":"down","name":"Outage","primitive":"SET_AVAILABILITY","availability":"DOWN","sentence":"{target} stops responding"},
  {"op":"create_story","scope":"story","pageIndex":0,"ref":"f","name":"The bank stops responding"},
  {"op":"add_step","scope":"story","pageIndex":0,"storyId":{"ref":"f"},"eventTypeId":1,"target":{"edgeId":4},"message":"The store asks Payment to charge","ref":"m1"},
  {"op":"add_step","scope":"story","pageIndex":0,"storyId":{"ref":"f"},"eventTypeId":{"ref":"down"},"target":{"nodeId":3},"message":"The bank stops responding","waitsForArrivalOf":[{"ref":"m1"}]},
  {"op":"add_step","scope":"story","pageIndex":0,"storyId":{"ref":"f"},"eventTypeId":1,"target":{"edgeId":5},"message":"Payment tries to authorise… no answer"}
]
```

Resultado real del motor:

| Momento | Paso | Estado |
|---|---|---|
| 1 | Store → Payment | `completed` |
| 2 | Bank | `state_changed` (UP → DOWN) |
| 3 | Payment → Bank | `not_completed`, `target_down`, reasonNode Bank |

La UI dice **«Falla en el paso 3»** y Banco se ve caído. **Ningún texto del agente produce ese resultado:** lo produce el motor. El `storyOutcome` propuesto sería `{status:"failed", moment:3, stepId:3, reason:"target_down", reasonNode:{id:3,label:"Bank"}}`.

## 8. Estrategia de validación

El kernel rechaza **antes de devolver nada** y evalúa el **estado final** del lote. Probado hoy:

| Encargo | Hoy | Falta |
|---|---|---|
| Nodo inexistente | `TARGET_NOT_FOUND` | Candidatos |
| Conexión inexistente | `TARGET_NOT_FOUND`; `{from,to}` sin conexión también | Candidatos |
| Referencia cruzada de página | `TARGET_NOT_FOUND`, `STORY_NOT_FOUND` | — |
| Elemento donde va conexión, y al revés | `TARGET_INCOMPATIBLE` | — |
| Evento inexistente | `EVENT_TYPE_NOT_FOUND`, lista los válidos | — |
| Paso inexistente | `STEP_NOT_FOUND`, lista los válidos | — |
| Dependencia inválida | `INVALID_ARRIVAL_DEPENDENCY` con `candidates` | — |
| Borrar lo que una Historia usa | `REFERENCED_ENTITY`, explica qué y cómo arreglarlo | — |
| `ref` desconocido, también `__proto__` | `UNKNOWN_REF` | — |
| Mensaje solo con espacios | `INVALID_FIELD` | — |
| Revisión antigua | `REVISION_MISMATCH` con `actual` | — |
| Versión de documento desconocida | «no legible», `unsupported_version` | — |
| **Campo extra, tipo incorrecto, mensaje largo, operación inventada** | Texto `-32602`; **hasta 3 772 B** de ruido de unión Zod | **`SCHEMA_INVALID` (G4)** |
| Historia vacía | **Aceptada**: el modelo la admite; `status:"empty"` lo hará visible | — |

**`SCHEMA_INVALID` propuesto**, con la forma de los demás rechazos:

```json
{ "ok": false, "valid": false, "errors": [{
  "code": "SCHEMA_INVALID", "operationIndex": 0, "operation": "add_step",
  "field": "operations[0].target.nodeId", "expected": "entero ≥ 1 o {ref}", "received": "string",
  "message": "…" }],
  "note": "No se devolvió ningún documento: el original no se modificó." }
```

**Lo que el kernel no puede validar, y no debe:** si la Historia responde a la intención. Eso lo decide el humano al revisarla.

## 9. Coste en tokens

Flujo: inspeccionar, crear una Historia de 4 pasos y conocer el desenlace, trabajando con enlace. Densidades de TE-003: JSON ≈ 2,05 B/token, enlace ≈ 1,06 caracteres/token. **Son estimaciones.** «Hoy» es la respuesta real; «Propuesta» es la proyección de esa misma respuesta, sin prototipo.

| Documento | Emitidos: hoy → propuesta | Recibidos: hoy → propuesta | Lecturas acumuladas: hoy → propuesta |
|---|---|---|---|
| 3 nodos, sin Historias | 2 904 → 1 763 (−39 %) | 5 356 → 1 850 (−65 %) | 10 295 → 2 388 (−77 %) |
| Compra online, 2 Historias | 5 126 → 3 460 (−33 %) | 8 268 → 2 591 (−69 %) | 18 495 → 3 345 (−82 %) |
| Microservicios | 4 444 → 2 786 (−37 %) | 7 097 → 2 644 (−63 %) | 14 545 → 3 460 (−76 %) |
| RAG, 38 pasos | 8 460 → 5 689 (−33 %) | 15 569 → 4 231 (−73 %) | 38 870 → 5 520 (−86 %) |

El catálogo se suma aparte: unos 26,6 k tokens fijos, salvo en clientes que cargan tools bajo demanda. Se estima que la propuesta añade +1,5–2,5 KB; hay margen, pero se mide en S1.

**El riesgo que el encargo temía, 50 KB de JSON irrelevante, no existe en la lectura:** `describe` cuesta 2,4–19,7 KB. Lo pesado es el **catálogo** y **reemitir el enlace** en cada llamada, y esto último ocurre con un servidor sin estado, por una promesa de privacidad que no se debe tocar.

**Por eso la mayor mejora es quitar una llamada:** con el desenlace en la respuesta de autoría, el camino feliz son 2 llamadas en vez de 3, y no hace falta reemitir el enlace para `run_story`.

**Reales con agentes (ejecución completa):** R1 6,4 KB enviados y 19,8 KB recibidos; R2 5,3 y 17,9; R3 4,7 y 14,6. R1 y R2 repitieron una autoría idéntica porque la salida del CLI se les truncó. Es un efecto de mi envoltorio, no del contrato.

**Contención con `unmodeled`.** Se repite en cada respuesta (753 B) y hoy es una decisión explícita: «es lo que impide que el agente lo invente». La propuesta lo conserva en `describe`, también en `summary`, y solo lo quita de las respuestas posteriores cuando se pide `summary`.

## 10. Riesgos de alucinación

| # | Riesgo | Medido | Respuesta |
|---|---|---|---|
| H1 | **Fallo solo de texto:** un envío normal con `message:"The bank does not respond: timeout!"` | `completed`, `ok:true`, sin aviso; la UI dice «Sin fallos» | `outcome` en la respuesta y receta en la description. No se detecta la intención en el texto |
| H2 | **Disponibilidad inicial como fallo:** `set_initial_availability` DOWN | La Historia de éxito pasa a `not_completed` en silencio | `STORY_OUTCOME_CHANGED` y aviso en la description |
| H3 | **Caída y envío en el mismo momento** | El envío termina `completed`: no falla | `outcome` en la respuesta y receta («en un momento ANTERIOR») |
| H4 | **Inventar sistema:** `create_node` en el mismo lote | 0/3 agentes lo hicieron. El contrato lo permite | Sin guarda en S1; se vigila en la QA. Si reaparece, `allowedScopes` |
| H5 | **Narrar lo no modelado:** «Timeout», «The bank approves» | R1, R2 y R3 lo hicieron como `OCCURRENCE` | Aceptable: sale como `narrated`, y `unmodeled` lo declara. Los tres avisaron al usuario |
| H6 | **Idioma:** catálogo solo en español | **R3 respondió a una petición en inglés con contenido en español**, sin acentos, sobre un sistema en inglés | Una regla en la description. Traducir el catálogo es otra tarea |
| H7 | **Copia inexacta del enlace** | **Me ocurrió a mí en esta auditoría:** al reescribir un enlace de 1 612 caracteres, pasé 1 454. El Viewer lo rechazó bien | Copiar programáticamente si se puede; el error ya lo explica. En R4 el agente lo extrajo con código |
| H8 | **Biblioteca inflada** | R3 creó 6 eventos para 7 pasos | Cosmético: frase del evento genérica; se vigila |

**Qué decide cada uno:**

| Agente | Kernel / motor |
|---|---|
| Qué explicar y con qué pasos | Si cada referencia existe y es compatible |
| Frases, nombres, orden narrativo | La acción derivada del evento |
| Dónde cae el sistema para contar un fallo | Si un envío se completa o falla, y por qué |
| Nombre de una variante | Tiempos, momentos e ids |
| — | El desenlace y el Trace |

## 11. Respuestas del encargo

1. **¿Qué puede hacer hoy el MCP con Stories?** Crear, leer, ejecutar, editar y borrar, en lote atómico. Fallo real y variante por composición (§ 1, § 3).
2. **¿Qué falta para el flujo completo?** Los cinco huecos G1–G5.
3. **¿Tools nuevas?** Ninguna.
4. **¿Qué se amplía?** `describe_document`, `run_story` y `author_document` (§ 5).
5. **¿Contratos a mantener?** Lote atómico, `baseRevision`, sin estado, kernel verbatim, formato v5, motor v2, dec. 314 y 317, respuestas compatibles, `unmodeled`, registro sin contenido, guardia de catálogo.
6. **¿Alucinación?** § 10.
7. **¿Validación determinista?** § 8.
8. **¿Agente o kernel?** § 10.
9. **¿APIs chatty?** Ya no lo son: un lote crea la Historia entera. La propuesta deja el camino feliz en 2 llamadas.
10. **¿Sin modificar el formato?** **Sí.** Ningún cambio de `version`, `engineVersion` ni esquema.

**Recuperación (§ 13 del encargo):** las operaciones reversibles y `dryRun` ya existen. No hace falta añadir ninguna.

**Seguridad (§ 24), comprobada en código:**

- Entrada Zod estricta con topes; lista cerrada de campos por operación.
- Las expresiones del kernel son constantes del código, nunca texto del cliente.
- `vm` por llamada, 5 s de tope.
- Enlace con 2 MiB de descompresión máxima; 1 MB de cuerpo HTTP y límite de respuesta; 30 peticiones/min.
- Sin acceso a disco ni red; el enlace nunca se abre, solo se decodifica.
- `FLUYO_APP_URL` viene del entorno, no del cliente.
- En `viewer.js`, `present-story.js` y `story-playback.js` no hay `innerHTML`; en el editor, el único caso medido limpia un contenedor. Un mensaje no inyecta nada.
- **Lo nuevo no abre superficie:** la lectura sin revisión es de solo lectura y sobre el mismo decodificador.
- **Cuidado:** calcular desenlaces antes y después ejecuta el motor por Historia. S1 debe acotarlo (25 Historias) y decir si se truncó.

**Observabilidad (§ 25).** `http-logging.ts` ya registra solo tool, estado, duración y bytes, con un tipo cerrado que no admite contenido. No se añade nada.

**Compatibilidad (§ 22).** Campos aditivos. Cambia `kernelId` por añadir `story-clock.js`; ya es un dato variable y los tests lo normalizan. Hay que adaptar `fluyo-017-1` (lista del kernel) y la nota de `fluyo-018-22`.

## 12. Plan de slices

**Ninguna slice consume CACHE ni toca archivos servidos.** v124 sigue libre. La release es del MCP: Cloud Run desde un worktree limpio, `verify-deploy` y smoke en producción, con aprobación.

### S1 · Autoría fiable de una Historia lineal

- **G1:** lectura de enlace ajeno y aviso de instantánea `/s/`.
- **G2:** `story-clock.js` en el kernel; `outcome` en las tres tools.
- **G4:** `SCHEMA_INVALID`, candidatos, mensaje de `LINK_REVISION_MISMATCH` que no acuse de mala copia.
- **G5:** `detail:"summary"`, `refs` completos.
- Descriptions: Story = Historia, idioma del contenido.
- Test antiguo de `step-reverse-001` corregido.
- Tests, mutaciones y comprobación de identidad sin flags, al estilo de TE-004.

**Gate:** el § 19 del encargo, y además R4 ya no se bloquea.

### S2 · Fallo

- **G3:** `STORY_OUTCOME_CHANGED`.
- Receta del fallo en la description: `SET_AVAILABILITY` DOWN en un momento anterior; `message` no produce fallos; la disponibilidad inicial afecta a toda la página.
- `reason` y `reasonNode` verificados con `source_down` y con `reverse`.
- Ninguna operación nueva.

**Gate:** el § 20. Reproducción en editor, Present y Viewer. Present solo lo comprobé en portada.

### S3 · Variantes

- Por defecto, **ni código de producto:** descripción de la receta y QA.
- Solo si la QA con agentes falla, `duplicate_story.upToStepId`.

**Gate:** el § 21, reinterpretado: misma página, prefijo común, sin campo de parentesco.

### QA por slice

1. Escenarios A–E automatizados.
2. Round-trip en Chrome real: abrir, reproducir, editar, guardar, volver a leer.
3. **Agentes externos con conector MCP nativo**, sin pistas, sobre un sistema **distinto** a Store/Payment/Bank para no optimizar contra un benchmark, y con un modelo pequeño.
4. Producción: smoke tras el deploy.

## 13. Decisiones del PO

- **D1 · Leer sin revisión un enlace que aporta un humano.** **Recomendado: sí, solo en `describe_document`.** TE-003 lo prohibió por la copia inexacta, y sigue siendo un riesgo real (H7). Pero el rechazo bloquea el caso principal, y el error solo afecta a la lectura hasta que el humano revise el resultado. Alternativa: exigir siempre el JSON.
- **D2 · `story-clock.js` en `KERNEL_SCRIPTS`, verbatim.** **Recomendado: sí.** Queda un comentario desfasado en el archivo («NO es kernel»), que se corrige en la próxima slice web para no gastar v124. Alternativa: mover `outcome` a `story-playback.js`, que consume v124.
- **D3 · Cambio de desenlace en Historias no tocadas: aviso o rechazo.** **Recomendado: aviso.** A veces es lo que se quiere. Alternativa: rechazo salvo `allowOutcomeChange:true`, más seguro y más caro.
- **D4 · Sin operación de fallo.** El MCP escribe con evento y la UI sin él, con el mismo Trace. **Recomendado: aceptar la diferencia.** Alternativa: `fail_step`, kernel y catálogo a cambio de nada medido.
- **D5 · Redefinir S1 como en el § 12.** El encargo pedía «crear una Story»; eso ya funciona. **Recomendado: aceptar.**

**Fuera de S1, para decidir después (tocan la web y v124):**

- **Abrir en la Historia:** `editorUrl` abre en Editar y sin elegir la Historia nueva. Son tres gestos, y los agentes tuvieron que explicarlo. Es la mayor fricción humana observada.
- **Copiar enlace de edición:** la barra queda antigua tras editar, así que de la UI al agente solo se vuelve con el archivo o con la instantánea de Compartir.
- **Catálogo en inglés** (H6).

## 14. Limitaciones de esta auditoría

- **El cliente fue un CLI propio,** no un conector MCP nativo. Por el mismo servidor y Zod, pero el conector real queda para la QA de S1.
- **El MCP fue una compilación local** de `464f4e0`, el commit de `main`; no llamé al endpoint de producción. La UI sí fue la de producción.
- **Muestra pequeña:** 4 ejecuciones. Bastan para descubrir bloqueos, no para dar tasas.
- **Los agentes solo vieron un sistema,** y Sonnet y Haiku no se probaron en todos los casos.
- **Tokens estimados** con densidades de TE-003; la columna «Propuesta» es una proyección.
- **Sin QA en móvil, Present reproduciendo, ni `fr`/`ja`/`zh`.**
- **Variantes por agentes:** no probadas; solo la paridad por receta y una variante mía.

## 15. Agent QA de referencia

Sin pistas internas: solo catálogo, documento e intención. Verificado con los registros y volviendo a ejecutar el documento final, no con lo que informó cada agente.

| Ejecución | Modelo | Entrada | Intención | Llamadas | Rechazos | Resultado del motor |
|---|---|---|---|---|---|---|
| R1 | Sonnet | JSON sin Historias | Compra con éxito | 4 | 0 | 7 pasos, «Sin fallos» |
| R2 | Sonnet | JSON con Historia de éxito | Banco no responde | 4 | 0 | 5 pasos, **«Falla en el paso 3», `target_down`**; Historia previa idéntica byte a byte |
| R3 | Haiku | JSON sin Historias | Banco no responde | 3 | 0 | 7 pasos, **«Falla en el paso 4», `target_down`**; contenido en español |
| R4 | Sonnet | **Solo un enlace** | Banco no responde | 2 | **2** | **Bloqueado (G1).** Se detuvo y pidió el archivo: correcto |

Observaciones de los agentes, útiles para el diseño:

- El catálogo nunca dice que «story» en el producto es «Historia», ni cómo se reproduce.
- No queda claro si un envío a un nodo caído cuenta como fallo; lo supieron al ejecutar.
- `LINK_REVISION_MISMATCH` afirmó «casi siempre es una copia inexacta» cuando el enlace era exacto.
- `refs` vacío, aunque se usaron `ref`, confunde.
