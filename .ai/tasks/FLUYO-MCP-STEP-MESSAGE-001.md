# FLUYO-MCP-STEP-MESSAGE-001 — `message` en un Step de elemento (kernel y web)

Estado: **READY FOR PUSH** (revisión aprobada por el PO y commiteada en `fluyo` el 21-10-2026 sobre `2da088e`; sin push y sin deploy).
Owner/agente actual: libre.

> Repo público: este documento solo contiene decisiones técnicas del proyecto (AGENTS.md §9).

## Objetivo

Que un paso de elemento (`OCCURRENCE`, `SET_STATE`) pueda decir su propio texto en el globo (`message`), en vez de obligar a crear un
EventType por frase solo para cambiar el texto. Es presentación pura: no cambia el Trace, los tiempos, `motion`, las dependencias de
llegada ni la semántica de la Historia.

Base: `fluyo` main = `2da088e` (producción v101, SCENARIOS-SEMANTICS-001 FASE 6). `CACHE` v101 → **v102**. Decisión **255**.

La auditoría previa (contrato candidato, medidas del caso real y del catálogo del MCP) la aprobó el PO con:

- **D-PO-1**: el editor permite ver, editar y quitar el `message` del paso.
- **D-PO-2**: al cargar, `message: ""` o solo espacios **rechaza** el documento (no se canonicaliza).
- `set_step_message {message: null}` quita el mensaje.
- **D-PO-3**: el contrato MCP será la variante V10, sin subir ningún tope del catálogo (eso es la tarea siguiente, en `fluyo-mcp`).

## Alcance

### Incluye

- Kernel (`model.js`): `STEP_MESSAGE_MAX_LEN`, `stepMessageValid`, `validatePersistedStep`, `stepDefinitionForEvent(…, message)` y
  `setStepMessage`.
- Motor (`scenario-engine.js`): ignora la clave en pasos de elemento (como `eventTypeId`); en un `SEND` sigue siendo un campo de más.
- Playback (`story-playback.js`, `stepMeta`): el globo dice el texto del paso, con el estilo y la duración de su evento. Es el único
  punto de pintura; editor, Present y Viewer lo heredan sin cambios.
- Autoría por lote (`story-authoring.js`): `add_step {message}` y `set_step_message {stepId, message|null}`.
- Editor (`editor-scenarios.js`, `styles.css`): la fila enseña el mensaje bajo la frase; «Mensaje del paso…» en el menú.
- `docs/index.html` (dos frases), `.ai/DECISIONS.md` (255), `sw.js` (v102).
- Tests: unidad, mutaciones, Chrome real, `undoMsg` para los alcances antiguos y la subida v101 → v102 de los tests que la fijan.

### No incluye

- `fluyo-mcp` (zod, catálogo, `describe_document`/`run_story`, sincronizar el kernel): tarea siguiente.
- Texto en los `SEND`, una duración propia del globo o `message` en la frase o en el título del momento.
- Un aviso en el modal del evento sobre los pasos con mensaje propio (recomendación de la auditoría no pedida en esta tarea).
- Migrar documentos con EventTypes de un solo uso.

## Contrato (decisión 255)

| Regla | Comportamiento |
|---|---|
| Dónde | Solo en `OCCURRENCE` y `SET_STATE` (cualquier `engineVersion`, como `eventTypeId`). En un `SEND`: rechazo en la carga, en el motor (`extra_fields`), en la integridad y en las operaciones |
| Forma | Texto de 1 a 120 unidades UTF-16 que no es solo espacios. Se guarda **tal cual**: sin `trim`, sin normalizar, **sin truncar** |
| Ausente | Lo de siempre (corpus idéntico byte a byte frente a `2da088e`) |
| `""`, solo espacios, > 120, no texto | El documento no abre (`invalid_document`; `FluyoIntegrity` → `invalid_step`) |
| Quitar | `setStepMessage(sc, id, null)`; el editor («Quitar mensaje») y `set_step_message {message:null}` |
| Copias | Se conserva sin código: `duplicateStep`, `retargetStep`, `storyboard*`, `duplicateScenario`, `importPagesIn`, Undo/Redo, «Usar otro evento aquí», guardar/abrir, autoguardado, Share |
| Texto | El globo dice el `message`; la frase (`sentenceTemplate`) y el título del momento (`et.name`) siguen siendo los del evento |
| Tiempo | Ni el motor ni el reloj lo leen. La duración del globo es la de su evento |
| Lectores anteriores | Lo rechazan entero: carga, motor, integridad, editor por `#d=` (avisa y conserva la sesión) y Viewer |
| Versión | `engineVersion` 2 y `version` 5 (decisión 234: extensión de v2) |

**Lote:**

- `add_step {message}`: en un evento FLOW, `INVALID_OPERATION {field:"message"}` («un envío no tiene globo»); un texto inválido, `INVALID_FIELD`.
- `set_step_message {stepId, message}`: responde `{from, to, changed}` y `affects` solo de ese paso. No toca `at`, el orden, el evento, el objetivo, el sentido ni las dependencias.
  - `message:null` quita el mensaje.
  - Si el valor es el mismo que ya tiene, `changed:false`.
  - Sobre un `SEND` (también con `null`), `INVALID_OPERATION`.
  - Sin `message`, `INVALID_OPERATION`.

**Editor:**

- **Menú.** «Mensaje del paso…» está justo después de «Cambiar dónde ocurre…», solo en eventos de elemento. El hint dice lo que se ve ahora:
  - «…» si el paso tiene mensaje propio;
  - «Ahora el del evento: «…»» si usa el de su evento;
  - «Ahora sin mensaje» si no hay ninguno.
- **Popover.** Es el mismo patrón que «Renombrar»:
  - un campo de una línea con `maxlength` 120 y, como placeholder, el mensaje del evento;
  - «Guardar mensaje», que también se activa con Enter;
  - «Quitar mensaje», solo si el paso ya tiene uno.
- Guardar vacío no hace nada y lo explica: «Escribe el mensaje, o usa «Quitar mensaje».».
- Cada cambio es una entrada de Undo. La selección no cambia. Si no hay cambio, no se crea entrada.

## Archivos modificados

- `js/model.js` — la regla (`stepMessageValid`), la carga, `stepDefinitionForEvent` y `setStepMessage`.
- `js/scenario-engine.js` — el filtro de claves (una línea y su comentario).
- `js/story-playback.js` — `stepMeta`.
- `js/story-authoring.js` — `OPERATION_SCOPE`, `OPERATION_FIELDS`, `messageOf`, `add_step` y `set_step_message`.
- `js/editor-scenarios.js` — la fila, el menú, `scStepMessage`, `scMessageMenuItem`, `scEditStepMessage` y `scSetStepMessage`.
- `css/styles.css` — `.scStepMessage` y `.scMessageInput`.
- `docs/index.html` — la función en el editor y la clave en el formato.
- `sw.js` — `CACHE` v102.
- `.ai/DECISIONS.md` — decisión 255.
- Tests nuevos:
  - `test/fluyo-step-message-001.test.cjs`;
  - `test/fluyo-step-message-001-mutations.cjs`;
  - `test/fluyo-step-message-001-browser.cjs`;
  - `test/fluyo-step-message-001-undo.cjs` (`undoMsg`, `undoMsg6`, `undoMsg56`);
  - el fixture `test/fixtures/step-message/rag-mcp.fluyo.json`, el documento real de una prueba con un agente: 38 pasos y 9 eventos. Está en un subdirectorio para que no entre en los corpus de los tests antiguos, cuyos kernels anteriores no conocen `reverse`.
- Tests antiguos (regresión estándar):
  - 64 archivos suben `fluyo-static-v101` → `v102`.
  - Los alcances encadenan `undoMsg` antes de `undo6`/`undo56`: 13 `{ undo56: undo5 }` → `{ undoMsg56: undo5 }`, más FASE 4, 5 y 6.
  - 4 alcances descuentan las piezas de esta tarea: STEP-REVERSE-003 E1, FASE 4 E2, FASE 5 G3 y FASE 6 C2.
  - STEP-REVERSE-003 A3 compara su menú sin la entrada nueva.

## Pruebas

- `node --test test/fluyo-step-message-001.test.cjs`: **24/24**.
  - Forma y límites UTF-16, con un par sustituto en el borde.
  - Ida y vuelta exacta.
  - `""` y solo espacios se rechazan.
  - Los tres lectores: carga, motor e integridad.
  - `stepMeta`, la frase y el título.
  - Trace, outcomes y horario visible **byte a byte iguales** con y sin `message`, también con dependencias.
  - El caso real de 38 pasos con 5 eventos: idéntico al original salvo el nombre, y reconstruido con un lote de 46 operaciones.
  - Todo lo que copia Steps.
  - `add_step` y `set_step_message`.
  - Share `#d=`.
  - Menú, Undo y Redo del editor.
  - Corpus sin `message` idéntico a `2da088e`.
  - Lector anterior.
  - Alcance.
- Mutaciones: **29/29 detectadas**, en `test/fluyo-step-message-001-mutations.cjs`. Excluye I1/I2, los alcances, que detectarían cualquier mutación sin probar nada.
- Chrome real (`test/fluyo-step-message-001-browser.cjs`, Playwright vía `NODE_PATH` y `FLUYO_OLD_ROOT` = árbol de `2da088e`): **92/92**.
  - Editor a 1440 (ratón, Enter, Ctrl+Z/Ctrl+Y) y a 390 (dedo, botones): fila, menú y hints; escribir, cambiar, 120 caracteres enteros, vacío, quitar, Undo/Redo exactos, duplicar, marcas mostradas como texto, guardar/abrir y autoguardado; reproducción con los globos a la hora de su momento, la misma que sin mensajes.
  - Present: los globos y los títulos son los del evento.
  - Viewer `/s/` a 1440 y 390.
  - Cliente anterior servido aparte: el editor avisa y no carga nada, ni a medias, y con sesión guardada no ofrece descartarla y el autoguardado queda intacto; el Viewer muestra «no es un diagrama Fluyo válido».
- Regresión en Chrome:
  - STEP-REVERSE-003 68/68, STEP-REVERSE-002 50/50, 018.21 36/36, 018.7d OK y FASE 6 52/52.
  - `fluyo-011-browser` falla igual en la base: arnés obsoleto que busca SW v45 → v61.
- Suite vm `node --test test/*.test.cjs`, en un clon con un **commit desechable** y `fluyo-mcp` al lado (los alcances «idénticos a HEAD» solo pasan con commit):
  - **1590 tests / 84 fallos = los 83 de la base `2da088e` (1566/83) + 1 esperado**;
  - el esperado es FASE 6 C3, «el kernel del MCP (repo hermano) lleva el `model.js` de este árbol»: pasa al sincronizar el kernel del MCP;
  - 0 arreglados.
- En el árbol de trabajo, sin commit, además fallan los alcances «idénticos a HEAD». Es el artefacto conocido.

## Pendientes / riesgos

- **Orden de publicación**: primero `fluyo` (v102). Después `fluyo-mcp` con `sync:kernel` y su contrato V10: `add_step.message`, `set_step_message`, y `message` en `describe_document`/`run_story`, que hoy construyen los pasos campo a campo y lo perderían. Hasta entonces, el MCP desplegado rechaza estos documentos («no legible»), como pasó con `reverse`.
- Clientes antiguos: rechazan el documento entero. El editor avisa con el mensaje genérico de enlace roto, ya existente desde `reverse`.
- Duración del globo: es la del evento, no la del texto. Un texto largo en un evento de duración «normal» se lee deprisa. Se acepta por diseño.
- Una palabra de 120 caracteres sin espacios desborda el globo. El trazado del globo no parte palabras, y así era ya con `nodeEffects.message`.

## Próximo paso

Commit hecho (revisión del PO aprobada). Fuera del commit quedan los cambios ajenos que ya estaban en el árbol:
`.ai/tasks/FLUYO-SCENARIOS-SEMANTICS-001.md`, `.ai/tasks/FLUYO-STEP-REVERSE-003.md` y `.ai/tasks/FLUYO-019.4.md`.

1. Con el OK del PO: push, y comprobar que fluyo.space sirve v102.
2. La tarea MCP de STEP-MESSAGE-001 sobre `fluyo-mcp` `8c9181d`.
