# FLUYO-STORIES-2.0 · S1 · Contar con clics — auditoría

Fecha: 2026-10-28 · Base: `main` = `c2c63ec` (fluyo.space sirve `fluyo-static-v116`) · Solo lectura: sin código, CACHE, commits ni deploy.

**Estado: auditoría APROBADA (D1 y D2 tal como se recomendaban). S1a IMPLEMENTADA · QA del PO aprobada, commiteada** (worktree `fluyo-s1a`, rama `stories-2.0-s1a`, CACHE v117); ver «S1a · Implementación» al final. S1b no empezada.

Objetivo: que crear una Historia se sienta como contar algo sobre el diagrama, no como programar un motor de eventos. Origen: el discovery STORIES-2.0 (MVP «Contar con clics»).

## Conclusión

S1 entero cabe **sin tocar el kernel, el formato ni el MCP**. Todo es editor y presentación sobre funciones que ya existen y que solo se **llaman**, sin modificarlas.

El kernel es lo que `fluyo-mcp/scripts/sync-kernel.ts` copia: `config.js`, `safe-svg.js`, `model.js`, `scenario-engine.js`, `scenario-playback.js`, `story-playback.js`, `document-integrity.js` y `story-authoring.js`. S1 no edita ninguno, así que `kernelId`, `engineVersion` 2, `version` 5 y la salida del MCP quedan byte a byte iguales.

## Lo que hay hoy

| Pregunta | Respuesta (código actual) |
|---|---|
| Dónde se crea un Evento | Diálogo de Evento: `scOpenEventDialog` → `scSaveEventType` → `createEventTypeIn` (`model.js`), en `doc.eventTypes`, que son del documento y no de la página. Para colocar un paso hay que tener antes un Evento: paleta, arrastre o `scBeginPlacement` → `scApplyTargets` → `stepDefinitionForEvent` + `createStep`. |
| Cómo es un paso | `{id, at, action: SEND\|OCCURRENCE\|SET_STATE, edgeId\|nodeId, state?, eventTypeId?, reverse?, message?}` (`validatePersistedStep`). **`eventTypeId` ya es opcional** en cualquier paso. Los momentos son grupos de pasos con el mismo `at` (`storyboardGroups`). |
| Cómo se genera hoy el fallo | Un paso `SET_STATE` con `state: "DOWN"` sobre el destino, en un momento anterior al envío. El motor emite `send_failed` con `reason: "target_down"` (o `"source_down"`). En los ejemplos lo hace un Evento «Caída» (`SET_AVAILABILITY`). |
| Cómo decide el motor éxito o fallo | `FluyoStory.run` → Trace. `FluyoStory.outcomes(trace, sc, page)` devuelve, por paso: `completed`, `not_completed` (con `reason` y `reasonNodeId`), `state_changed` o `narrated`. Un OCCURRENCE nunca falla: el motor lo registra igual. |
| Qué pasa al tocar el lienzo en Historias | Selecciona, como en Editar. Solo crea pasos con una colocación activa (`scCanvasPlacementPointer` / `scCanvasPlacementTap`). |
| Blanco de las conexiones | La colocación ya usa `scEdgeCandidates`, con un radio de 10 px de pantalla y un menú cuando hay ambigüedad. La selección normal usa `hitEdge`. |
| Frase del paso | `message` existe desde NARRATION-001, pero se edita en «⋯ → Mensaje del paso…» (`scEditStepMessage`). En la fila es una línea secundaria («…»), debajo del nombre del Evento. |
| Desenlace | No hay. Al terminar, Present y el Viewer dicen «N eventos no pudieron realizarse» (`FluyoStory.summary`). |

**Paso sin Evento:** el formato y el motor lo admiten, y el editor ya lo describe («X envía», «X se cae», «X ocurre»). Pero un SEND sin Evento **no pinta símbolo** al viajar (`drawEventToken` con token `""`), así que no sirve como paso implícito de conexión. Por eso el paso implícito necesita un Evento por defecto, como recomendaba el discovery (D1).

## 1. Alcance exacto de S1

1. **Tocar crea el paso.** En modo Historias, sin reproducción ni colocación activa, un toque (sin arrastre, ≤ 8 px) crea el paso al final de la Historia activa y la Historia se crea si no hay ninguna. Una sola entrada de Undo por toque.
   - **Toque en una conexión:** crea un SEND con el **tipo de paso implícito**.
     - Se reutiliza el Evento FLOW del último envío de esa Historia, para que en Compra online un toque reutilice «Petición».
     - Si no hay ninguno, se usa «Paso» («Step» en inglés), que se crea la primera vez en el idioma de la interfaz (regla 282). Lleva el símbolo ● y la plantilla «{source} → {target}».
   - **Toque en un nodo:** crea un OCCURRENCE con «Nota» («Note»), con la misma regla de reutilización.
   - Arrastrar sigue moviendo nodos. Los toques con modificador (Mayús, Ctrl) siguen seleccionando.
2. **Evento implícito.** El camino principal no abre el diálogo de Evento. La biblioteca y la paleta siguen igual, para quien las quiera; no se renombran en S1.
3. **Frase en línea.**
   - Al crear un paso, el foco queda en un campo de frase dentro de su fila, con la frase por defecto del Evento como placeholder.
   - Enter o perder el foco confirma, y cuenta como una entrada de Undo. Escape cancela.
   - La fila muestra la frase como texto principal y el Evento queda como dato secundario.
   - Doble clic en la fila vuelve a editar la frase. «⋯ → Mensaje del paso…» se mantiene.
   - Con esto se levanta D-PO-4 de NARRATION-001.
4. **Blanco ancho.** En modo Historias el toque usa `scEdgeCandidates` con un radio de 12 px CSS, el AC3 del discovery, y el menú existente para elegir cuando hay ambigüedad.
5. **«Falla aquí».** Primera acción del menú de un paso SEND, el mismo que se abre al tocar la fila.
   - Crea un paso visible `SET_STATE DOWN` sobre el destino del recorrido (`traversalEnds`, que respeta `reverse`).
   - El paso no lleva Evento; lleva la frase «{Destino} no responde» en el idioma de la interfaz. A partir de ahí es contenido y nunca se retraduce.
   - Se coloca en un momento propio justo antes del momento del envío: `createStep` al final y después `storyboardMoveStep(steps, id, {kind: "gap", index})`. Los momentos posteriores conservan su orden y sus ranuras de tiempo, y las esperas de llegada siguen siendo válidas porque el orden se conserva.
   - Es un fallo real: al reproducir, el envío termina en `not_completed / target_down` con la consecuencia del motor, que también hace fallar lo que depende de ese nodo.
   - Una sola entrada de Undo.
   - No se ofrece si el envío ya no se completa.
6. **«Duplicar como fallo»**, en el menú de la Historia.
   - Usa `duplicateScenario`, con el nombre «{nombre} — falla» («{name} — fails»).
   - Después entra en un modo «Elige dónde falla», con una barra como la de colocación: tocar una fila de envío o una conexión usada aplica el punto 5. Escape sale y deja la copia sin cambios.
   - Son dos entradas de Undo: duplicar y fallar. La original no cambia.
7. **Desenlace.**
   - Se calcula del Trace con el mismo horario de la reproducción, incluidas las esperas de llegada, en `story-clock.js`, que no es kernel y ya comparten el editor, Present y el Viewer.
   - «Falla en el paso N»: N es el número del **momento** del primer paso `not_completed`, la misma unidad que el progreso «n / total».
   - «Termina bien»: la Historia tiene pasos y ninguno falla.
   - Si la Historia tiene errores o no tiene pasos, no se muestra nada.
   - Dónde se ve:
     - **Editor:** en la cabecera de la Historia activa y en el selector de Historias.
     - **Present y Viewer:** al terminar, una línea propia encima del resumen actual, que no cambia.
   - Antes de reproducir, en el Viewer, no se muestra: es la portada de S2.
8. **Texto de entrada.** El estado vacío deja de pedir «Crea un evento…» y dice «Toca una conexión o un elemento para contar el primer paso». No hay más cambios de texto.

**No entra** (va a S2 o más tarde): bifurcaciones dentro de una Historia, la portada y la continuación del Viewer, el propósito o `summary`, el tipo declarado (éxito, fallo o variante), «Duplicar como variante», la tira de momentos y el renombrado de «Eventos» a «Tipos de paso».

## 2. Archivos que tocaría

| Archivo | Para qué |
|---|---|
| `js/editor-scenarios.js` | Toque → paso (tipo implícito), frase en línea, «Falla aquí», «Duplicar como fallo» y su modo de elegir, desenlace en la cabecera y el selector, estado vacío |
| `js/interaction.js` | Al soltar un toque en modo Historias, llamar a `scCanvasTapStep` (lo mismo que hoy hace la colocación) |
| `js/story-clock.js` | `outcome(page, scenario)`: primer momento con `not_completed`, con el horario visible |
| `js/present-story.js` · `js/viewer.js` | La línea de desenlace al terminar |
| `js/i18n-en-editor.js` · `js/i18n-en.js` | Las claves nuevas (es + en; fr/ja/zh caen al inglés) |
| `css/styles.css` · `css/viewer.css` (si hace falta) | Campo de frase en la fila, barra «Elige dónde falla», línea de desenlace |
| `sw.js` | `CACHE` v117 |
| `test/` | Un test vm de S1, su QA en Chrome y la capa de deshacer de S1 para los tests de alcance (ver riesgos) |
| `.ai/tasks/FLUYO-STORIES-2.0-S1.md` | Este documento y su cierre |

## 3. Lo que no tocaría

- **El kernel:** `model.js`, `scenario-engine.js`, `scenario-playback.js`, `story-playback.js`, `story-authoring.js`, `document-integrity.js`, `config.js` y `safe-svg.js`.
- **`fluyo-mcp`.**
- **`render.js`:** no cambia cómo se pinta ningún paso; el paso implícito pinta con su Evento, como cualquier otro.
- **El formato:** `version`, `engineVersion` y el esquema del paso.
- **Share y el codec:** `share-url.js`, `editor-share.js`, `link-codec.js` y `deeplink.js`.
- **EXAMPLES:** `ejemplos/`, `js/examples.js` y la galería.
- **El diálogo de Evento**, salvo que se deje de abrir desde el camino principal.

## 4. Superficies, Undo, Share y ejemplos

- **Editor, Present y Viewer.**
  - La frase ya es el título del momento en las tres superficies (NARRATION-001), así que lo que se escribe en línea se ve igual en todas.
  - El paso «{Destino} no responde» se ve como cualquier otro: el nodo pasa a DOWN y aparece el aviso del motor «X no está disponible».
  - El desenlace sale de una sola función (`story-clock.js`) para las tres.
- **Undo.**
  - Tocar, confirmar la frase, «Falla aquí» y la creación implícita de la Historia o del Evento cuentan como **una** entrada cada uno.
  - «Duplicar como fallo» cuenta como dos.
  - La selección se conserva (018.24).
- **Share.**
  - No cambia nada: un paso implícito es un paso normal con un `eventTypeId` normal, y el enlace de una Historia (`scenarioId`) lo transporta como hoy.
  - Un documento existente produce el mismo enlace byte a byte.
- **Ejemplos.**
  - Sus archivos no cambian. Abren, reproducen y comparten igual.
  - Lo único nuevo que verán es el desenlace:

    | Historia | Desenlace |
    |---|---|
    | «El banco no responde» | Falla en el paso 4 |
    | «Un mensaje que falla» | Falla en el paso 4 |
    | «El usuario no autoriza» | **Termina bien** (ver D2) |

  - La fila de sus pasos pasa a mostrar la frase como texto principal.
- **Documentos existentes.** Mismo JSON y mismo Trace. Solo cambia la presentación de la fila y aparece la línea de desenlace.

## 5. Riesgos

1. **Tests históricos (coste, no producto).**
   - Cada cambio servido vuelve a romper los tests de alcance que comparan contra `HEAD`, como pasó en EXAMPLES. Habrá que añadir una capa de deshacer de S1 al final de la cadena; es el mismo trabajo mecánico de EXAMPLES, con el generador ya hecho.
   - Además, 17 archivos de test leen el texto de la fila (`scStepPrimary` / `scStepMessage`). Si la frase pasa a ser el texto principal, cambian de forma predecible.
   - Lo estimo en 0,5–1 día. **No es una ronda de QA:** es lo mínimo para que la suite vuelva a la base.
2. **Toque = paso** cambia un hábito: hoy, en Historias, tocar selecciona. Un toque accidental crea un paso, y se deshace con un Undo.
3. **El desenlace no debe contradecir la reproducción.** Hay que calcularlo con el horario visible, que incluye las esperas de llegada, y no con el Trace sin esperas.
4. **«Falla aquí» deja el nodo caído hasta el final.** Es la verdad del motor: los envíos posteriores al mismo nodo también fallan. El desenlace marca el primero.
5. **Móvil:** el campo en línea abre el teclado y el panel en hoja inferior debe dejar visible la fila. Se valida en 375×812.

## 6. Decisiones que necesitan al PO

- **D1 · Tocar crea el paso en modo Historias**, en vez de seleccionar como hoy. Seleccionar queda con Mayús o Ctrl y arrastrar sigue moviendo nodos. **Recomendado: sí.** Es lo que pide el punto 1 del alcance, pero cambia un comportamiento existente.
- **D2 · Ruta alternativa sin fallo = «Termina bien».** «El usuario no autoriza» (OAuth) no tiene fallo de motor, así que el desenlace deducido dice «Termina bien». **Recomendado: aceptarlo en S1;** la marca «ruta alternativa» llega con el tipo declarado en S2. La otra opción es no mostrar desenlace en Historias sin fallo, pero eso pierde el «Termina bien» de las de éxito.

Todo lo demás lo resuelvo con la recomendación de arriba, sin pedir decisión:
- el Evento reutilizado o «Paso»/«Nota»;
- N = número de momento;
- el desenlace solo al final en Present y el Viewer;
- dos entradas de Undo al duplicar;
- la frase como texto principal de la fila.

## 7. Slices

Propongo dividir S1 en dos, cada una con su commit y su deploy, para dar valor antes:

| Slice | Contenido | CACHE |
|---|---|---|
| **S1a · Contar** | Tocar crea el paso (tipo implícito), frase en línea, blanco de 12 px, estado vacío | v117 |
| **S1b · Fallar** | «Falla aquí», «Duplicar como fallo», desenlace en el editor, Present y el Viewer | v118 |

S1a ya cumple por sí sola «un clic y una frase». S1b se apoya en ella, pero no comparte código delicado. Si el PO prefiere una sola entrega, sería un único commit con v117.

## S1a · Implementación (28-10-2026)

PO: D1 (tocar crea el paso; Mayús/Ctrl seleccionan; arrastrar mueve) y D2 («Termina bien» en una ruta alternativa, en S1b) aprobadas. Base `c2c63ec` (v116) → CACHE **v117**. Kernel, formato, `render.js` y `fluyo-mcp` sin cambios.

### Qué hace

- **Tocar cuenta.** En Historias, sin reproducción ni colocación, un toque (≤ 8 px, un dedo, sin Mayús/Ctrl/Cmd/Alt, botón principal) en una conexión o un elemento crea el paso al final de la Historia activa, o de una nueva. Prioridad del blanco: elemento hoja → conexión a ≤ 12 px de pantalla (`scEdgeCandidates(x, y, 12)`) → contenedor. Si hay varias conexiones casi a la misma distancia, se elige en el menú de siempre. El segundo clic de un doble clic no repite el paso (400 ms, mismo objetivo).
- **Tipo implícito**, sin diálogo:
  - se reutiliza el último Evento de esa clase (FLOW o OCCURRENCE) que ya usa la Historia; en Compra online, tocar reutiliza su evento de envío;
  - si no hay, «Paso» (FLOW, ●, `{source} → {target}`) o «Nota» (OCCURRENCE, 💬, «Algo ocurre en {target}»), creados la primera vez en el idioma de la interfaz («Step»/«Note») y después contenido: nunca se retraducen (282). Si ya existe uno con ese nombre y clase, se reutiliza.
- **Frase en línea.**
  - Al crear el paso, su fila trae un campo con la frase del tipo como sugerencia. Con ratón tiene el foco; con el dedo no se abre el teclado sobre el lienzo.
  - Enter o salir del campo la guardan; tocar el siguiente elemento la guarda también, porque el lienzo suelta el foco.
  - Vacía, la quita. Escape deja la que había. El Enter de un IME (229 o `isComposing`) no confirma.
  - Tocar la frase de una fila, o doble clic en la fila, la vuelve a editar; reproduciendo no hay campo. «⋯ → Mensaje del paso…» sigue igual.
- **Undo.** Un toque = una entrada (Historia, tipo y paso juntos). Guardar la frase = una entrada; sin cambios, ninguna. Seleccionar no queda en la entrada (se limpia antes).
- **Doble clic / doble toque en Historias**: ya no abren el texto del elemento ni quitan codos (un toque es contar).
- **Textos.**
  - El estado vacío de la Historia: «Toca una conexión o un elemento del sistema para contar el primer paso.»
  - El de la biblioteca: «Para empezar no hace falta: toca el sistema…»
  - Se retiran `stories.emptyDrag`, `stories.emptyWillAppear` y `event.emptyHint`; hay 8 claves nuevas en inglés.

### Diferencias con la auditoría

- **La fila conserva su jerarquía:** el Evento arriba y la frase debajo, ahora editable. La auditoría proponía la frase como texto principal. Se deja para no mover 17 archivos de test que leen la fila; la frase ya es lo que se lee al reproducir.
- **Móvil:** con la hoja plegada solo se ve la cabecera. Se cuenta tocando el sistema y la frase se escribe al ampliar «Historia», donde el campo del último paso espera abierto.
- **Teclas por código** (13/27) en el campo nuevo: no añade literales de tecla al trinquete de i18n (sigue en 9) y el IME queda cubierto.

### Archivos

| Archivo | Cambio |
|---|---|
| `js/editor-scenarios.js` | Toque → paso (`scTapEnabled`, `scTapTarget`, `scImplicitEventType`, `scTapAddStep`, oyentes del lienzo), frase en línea (`scBeginInlineMessage`, `scInlineMessageField`, fila y repintado), radio de `scEdgeCandidates`, estados vacíos |
| `js/interaction.js` | Doble clic y doble toque: sin efecto en Historias |
| `css/styles.css` | Campo de la frase en la fila |
| `js/i18n-en-editor.js` | 8 claves nuevas, 3 retiradas |
| `sw.js` | CACHE v117 |
| `test/fluyo-stories-2-0-s1a.test.cjs` | 18 tests vm (A toque y tipo, B frase, C formato, kernel, alcance, textos) |
| `test/fluyo-stories-2-0-s1a-mutations.cjs` | 28 mutaciones |
| `test/fluyo-stories-2-0-s1a-browser.cjs` | QA en Chrome real (ratón y dedo por CDP) |
| `test/fluyo-stories-2-0-s1a-undo.cjs` | Capa de deshacer de S1a (`undoS1a`, base c2c63ec), generada del diff |
| `test/fluyo-examples-001-undo.cjs` | `undoEx` deshace antes S1a (cadena `… → undoS3b → undoEx → undoS1a`) |
| Tests de alcance S0, S1, S2a, S2b, S3a, S3b, SHELL y `fluyo-shell-001-undo.cjs` | Registran `PIECES_S1A` donde ya registraban EXAMPLES (razón A). En S3b, sus «sin cambios» pasan por `undoEx` |
| 84 tests | CACHE v116 → v117 |

### Pruebas

- **Propios:**
  - vm 18/18;
  - mutaciones 28/28;
  - Chrome 35/0, en dos vistas:
    - escritorio: 3 momentos narrados en 9 acciones sin diálogos, clic a 11 px sí y a 17 px no, arrastre, Mayús, doble clic, Undo/Redo de a uno y la frase en el Viewer de un enlace;
    - móvil 375×812 con el dedo, inglés y Compra online intacta hasta el primer toque.
- **Suite completa** en un clon con S1a commiteada: 1792 tests / 83 fallos, los mismos 83 de `HEAD` (`c2c63ec`), 0 nuevos.
- **Regresiones en Chrome**, en el clon con S1a commiteada:

  | Prueba | Resultado |
  |---|---|
  | S0 | 385/0 |
  | S1 | 181/0 |
  | S2a | 179/0 |
  | S2b | 26/0 |
  | S3b | 46/0 |
  | S4 | 102/0 |
  | EXAMPLES | 40/0 |
  | S3a | 29/6, los mismos 6 en `c2c63ec` sin S1a (ver abajo) |

  S0 y S3b fallaron una vez al lanzar cuatro Chrome en paralelo (zoom 80 % → 127 % y 39 px de ruido con un límite de 32). Solos, verdes. Con S3b se comparó además en `c2c63ec`: también 46/0.
- **Hallazgo previo, no de S1a:** el test en Chrome de S3a (`fluyo-i18n-002-s3a-browser.cjs`) falla 6 comprobaciones ya en `c2c63ec`, en producción.
  - Espera el «Ejemplo» anterior (Funnel de ventas, que se queda en Editar).
  - Desde EXAMPLES, «Ejemplo» carga Compra online y pasa a Historias, que oculta el carril. De ahí los dos fallos de contenido, el del documento, los dos de píxeles de los cajones y el de fr.
  - Es el test suponiendo el comportamiento anterior, no una regresión del producto. No estaba entre los 4 tests en Chrome revisados en EXAMPLES.
  - Arreglarlo es ajustar ese test (es EXAMPLES, fuera de S1a): **pendiente de decisión del PO**.

### Riesgos

- Un toque accidental en Historias crea un paso; se deshace con un Undo.
- En móvil la frase no se escribe junto al lienzo: hay que ampliar «Historia».
- Los pasos sin frase se titulan con el nombre de su tipo («Paso»).
- Cada slice nueva vuelve a necesitar su capa de deshacer para los alcances antiguos. Ya está generada por script; es mecánico.

### Próximo paso

Revisión del PO → commit en `stories-2.0-s1a`, merge a `main`, push y deploy (v117), y verificación en producción. Después, S1b (v118).

