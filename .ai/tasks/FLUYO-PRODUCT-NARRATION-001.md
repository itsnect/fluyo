# FLUYO-PRODUCT-NARRATION-001 — La frase del autor en cualquier paso de una Historia

**Estado: READY FOR PUSH** (23-10-2026). Integrada encima de 018.30 → I18N-001 (`6925ffe`) en la rama `feat/product-narration-001` del worktree `fluyo-narration`. Sin push ni deploy. D-PO-1..4 aprobadas por el PO.

- Base: `6925ffe` (FLUYO-I18N-001, CACHE v105), sobre `e82c821` (FLUYO-018.30, v104). Esta tarea sube CACHE a **v106**: es la tercera de la cadena.
- El trabajo vive en un worktree aparte, `fluyo-narration`, rama `feat/product-narration-001`. Las versiones anteriores al rebase quedan en las ramas `backup/product-narration-001-sobre-87a9d76` (v104) y `backup/product-narration-001-sobre-e82c821` (v105).
- El MCP vive en `fluyo-mcp-narration`, rama `feat/product-narration-001` sobre `731be50`.

## Objetivo

Una Historia cuenta qué ocurre en cada paso **sin crear un EventType por frase**. Cualquier paso puede llevar una frase propia, escrita por el autor, incluido un envío por una conexión. Ejemplos: «Cliente solicita el checkout», «Pagos cobra la tarjeta en el PSP».

Esa frase es lo que se lee al reproducir: en el editor, en Present, en el Viewer compartido y en el móvil. Es una capa de presentación: el motor, el reloj y el Trace no la ven. El evento del paso no cambia.

## Auditoría del contrato STEP-MESSAGE-001 (decisión 255)

`message` ya existía en los pasos de elemento (`OCCURRENCE`, `SET_STATE`) como texto del globo, con:

- forma canónica: 1 a 120 unidades UTF-16, no solo espacios, sin trim y nunca truncado;
- `null` para quitarlo;
- autoridad única: `setStepMessage`;
- operaciones: `add_step {message}` y `set_step_message`;
- Undo/Redo y duplicación ya resueltos.

Lo que faltaba para narrar eran dos cosas:

1. **El veto en `SEND`.** Estaba en cinco sitios:
   - `validatePersistedStep`;
   - `stepDefinitionForEvent`;
   - `setStepMessage`;
   - el filtro de claves del motor;
   - `messageOf`/`set_step_message` en `story-authoring.js`.

   Además, el editor solo ofrecía la entrada en pasos de elemento.
2. **Dónde se lee.** El título del momento (`FluyoStory.describe` → `moments`) decía siempre `et.name`. Un envío no tiene globo, así que su frase no se habría visto en ningún sitio.

**Modificación mínima:** quitar el veto y leer `message` en el título del momento. Se reutiliza la misma clave, la misma forma, la misma autoridad y las mismas operaciones. No hace falta un formato nuevo, una operación nueva ni otra solución en paralelo.

## Arquitectura elegida (decisión 258)

### Kernel

`model.js`, `scenario-engine.js` y `story-authoring.js`: `message` vale en cualquier acción. Solo se quita la condición `action === "SEND"`; las reglas de texto no cambian.

- El motor filtra la clave en cualquier acción, igual que hace con `eventTypeId`.
- `engineVersion` sigue en 2 y `version` en 5.

### Un único punto de lectura nuevo

`FluyoStory.momentText(step)` en `story-playback.js` devuelve `message` si el paso lo tiene y, si no, el nombre del evento, como hasta ahora.

- Lo usa `describe`, que ya alimentaba los tres rótulos: `#scNow` del editor, `#psTitle` de Present y `#stTitle` del Viewer. **`viewer.js` y `index.html` no cambian.**
- Un momento con varios pasos junta sus textos con « · », sin repetir.
- El globo sigue siendo solo de los pasos de elemento (`stepMeta`, sin cambios de comportamiento). En un envío, `message` nunca llega al lienzo.

### Legibilidad (D-PO-2)

`describe` marca `narrated: true` en el momento que tiene algún paso con `message`; sin frase no existe la clave. **Solo el título narrado** deja de cortarse con «…».

- Viewer: `viewer.js` pone `.narrated` en `#stTitle` (una línea); `share.css` lo deja envolver y el rótulo mide lo que su contenido (`width:max-content`, como `#presentStory`).
- Editor: `editor-scenarios.js` pone `.narrated` en `#scNowCaption`; `styles.css`, lo mismo.
- **Sin frase, todo es como en la base, también un título largo de varios eventos** («Notificación · Confirmación · Procesamiento»): una fila, «…», 53 px en el Viewer. Lo mide la parte S de la suite de Chrome contra `87a9d76`.
- *Corrección tras la revisión del 22-10:* la primera versión envolvía cualquier título y cambiaba los títulos largos sin frase. Lo destapó la suite de Chrome de 018.30 (apaisado, documento complejo).

### Present

`presentHeaderBottom` (decisión 256) reserva también el alto del título más largo de la Historia. Así una frase de 120 caracteres no tapa el diagrama.

### Editor

«Mensaje del paso…» aparece ahora también en el menú de un envío, tras «Invertir sentido».

- Hint: «Ahora se lee «Petición»».
- El campo propone de ejemplo la frase del evento.
- La ayuda dice: «Se lee al reproducir este paso, en lugar del nombre del evento».
- La fila del paso enseña la frase bajo la del evento.
- Guardar, cambiar y quitar siguen siendo una entrada de Undo cada uno, y la selección no cambia.

### Documentación

En `docs/index.html`, la función y la clave del formato.

## Diff (servido, frente a 6925ffe)

| Archivo | Cambio |
|---|---|
| `js/model.js` | veto `SEND` fuera de `validatePersistedStep`, `stepDefinitionForEvent` y `setStepMessage`; comentarios |
| `js/scenario-engine.js` | `k!=="message"` (filtra en cualquier acción) |
| `js/story-authoring.js` | `messageOf(v)` sin acción; `set_step_message` sin rechazo de SEND |
| `js/story-playback.js` | `momentText` + `describe` lo usa; `narrated` en el momento con frase; exportado |
| `js/editor-scenarios.js` | menú de un envío, hint, popover, `scStepMessage`/`scSetStepMessage` sin exclusión de SEND; `.narrated` en `#scNowCaption` |
| `js/present-story.js` | sonda del título narrado más largo en `presentHeaderBottom` |
| `js/viewer.js` | una línea: `.narrated` en `#stTitle` si el momento tiene frase |
| `css/share.css` | solo con `.stTitle.narrated`: `width:max-content`, `flex-wrap`, sin elipsis |
| `css/styles.css` | solo con `.scNowCaption.narrated`: `width:max-content`, sin elipsis |
| `docs/index.html` | dos párrafos |
| `sw.js` | CACHE v106 |
| `js/i18n-en.js` | el inglés de los 3 textos nuevos de «Mensaje del paso…» (I18N exige una entrada por clave) |

Más `.ai/DECISIONS.md`, que recibe la decisión 258.

Tests:

- nuevos: `fluyo-product-narration-001.test.cjs` (vm, 22), `-browser.cjs` (Chrome, 131), `-mutations.cjs` (20) y `-undo.cjs` (`undoNarr`);
- la cadena: `undo029` aplica antes `undoNarr`, y `undoMsg` exporta sus claves;
- pines adaptados al contrato nuevo: STEP-MESSAGE-001 (A1–A3, B1, B2, C2, E1, E2, G1, G2), STEP-REVERSE-003 (editor sin «Mensaje» en el envío, vía `undoNarr`) y 018.18 (#scNow ya no es `nowrap`);
- pines de CACHE v105 → v106.

## Compatibilidad

- **Documentos existentes:** abren, se guardan, validan, ejecutan y se titulan igual que en la base (F2 y C3 sobre los ejemplos y las fixtures).
- **Una Historia sin `message`:** el título de cada momento es byte a byte el de la base, y los momentos no llevan la clave `narrated`. Rótulo del Viewer: mismo texto y mismo alto en 1440, 390 y 844×390.
- **Lector anterior (≤ v103, `87a9d76`):** **rechaza** un documento con `message` en un envío, en vez de leerlo mal (decisión 234). El Viewer dice «no es un diagrama Fluyo válido» y el editor avisa y no carga nada. Los documentos con `message` solo en elementos siguen abriendo en v102 y v103.
- **Determinismo:** Trace, outcomes, horario visible (`FluyoStoryClock.schedule`), envíos, cues y `motion` son idénticos con y sin frases (B2, C4 y R en el navegador).

## MCP (`fluyo-mcp-narration`, base 731be50)

- `sync:kernel` desde `fluyo-narration`.
- La forma publicada (sin descriptions) **no cambia**: no hay operaciones ni campos nuevos.
- Textos que cambian:
  - la description de `add_step.message`: «Frase de ESTE paso (cualquier evento, también FLOW): al reproducir es el título de su momento y, en un elemento, su globo. El evento y su frase no cambian. No cambia tiempos ni Trace.»;
  - la mención en `describe_document`: «la frase propia del paso, si la tiene»;
  - el README.
- `describe_document` y `run_story` ya proyectaban `message` de cualquier paso.
- **Catálogo:** `tools/list` pasa de 54 672 a **54 691 B** (+19 B; guarda de DESCRIPTIONS-001 ≤ 55 000).
- **Tests:**
  - `npm test`: **905/905** (896 + 9 de `fluyo-mcp-product-narration-001.test.ts`); mutaciones STEP-MESSAGE 27/27 (con los patrones del veto invertidos) y DESCRIPTIONS 12/12;
  - `check:kernel` y `check:config` OK;
  - pines de STEP-MESSAGE-001 del MCP adaptados.
- **Orden de publicación:** como en la decisión 255, primero `fluyo` y después el MCP con el kernel sincronizado.

## Pruebas

### vm (fluyo)

**Suite nueva: 22/22.** Cubre:

- carga en SEND (normal y reverse);
- fijar, cambiar y quitar;
- motor e integridad;
- títulos;
- reproducción idéntica;
- lote;
- editor con Undo/Redo;
- Share ida y vuelta;
- corpus antiguo idéntico;
- lector anterior;
- caso real;
- alcance.

**Mutaciones: 20/20 detectadas.**

**Árbol completo:**

- Sobre el commit final, encima de `6925ffe`: 1571 pasan / **84 fallan**, frente a 1550 / **83** en `6925ffe` limpio. El único extra es la C3 de FASE 6, que compara con el kernel del `fluyo-mcp` vecino; contra `fluyo-mcp-narration` (rama de esta tarea) pasa 17/17.
- Chrome encima de I18N: esta suite 131/131, I18N (es/en, 1440/390, editor, Present, Viewer) 78/78, 018.30 402/402. Mutaciones: esta suite 20/20, 018.30 20/20, I18N 9/9 (ad hoc: I18N no trae script propio), MCP 27/27 y 12/12.
- Ningún fallo es nuevo. Todos están ya en la base: 011-final-fixes, 012-1-qa, scenario-ui-dom, 018-25, 018-27 y otros.
- 018-25 y 018-27 fallan 2 veces menos, que son barridos de rutas no relacionados con esta tarea.
- 018-10 y la C3 de FASE 6 se saltan en el clon porque no tienen el repo hermano.
- Sin commit, además fallan los tests de alcance «idéntico a HEAD» (013, 014a/b, 015, 017, 018, 019, 021, 023, 024, 019-1 #15, 018-29 #1). Fallan siempre con cambios sin commit y pasan con el commit.
- La C3 de FASE 6 (kernel del MCP hermano) pasa contra `fluyo-mcp-narration`.

### Chrome real (`-browser.cjs`, service worker bloqueado): 131/131

- **Editor** a 1440 (ratón) y a 390 (dedo). El paso del envío (Petición) lleva el menú y el hint; se escriben las 6 frases y el documento queda EXACTAMENTE el del caso con 2 eventos. Undo/Redo son exactos y «Quitar mensaje» funciona. `#scNow` dice cada frase, entera.
- **Present** a 1440, 390 y 844×390, con frases normales y con una de 120 caracteres. El encabezado dice cada frase entera y nunca tapa el diagrama.
- **Viewer** a 1440, 390 y 844×390, sin frases, con frases y con 120 caracteres:
  - sin frases, el texto y el alto son idénticos a los de la base `87a9d76`, servida aparte; con títulos largos de varios eventos (documento complejo de 017.1), el Viewer, el rótulo del editor y el encaje de Present también (parte S);
  - con frases, cada una se lee entera y dentro de la pantalla;
  - con 120 caracteres, la frase pasa a varias líneas.
- El horario visible es idéntico.
- El cliente anterior no lo abre a medias.
- Sin errores de consola.

### Caso real

Cliente (web) → API Checkout → Servicio Pagos → PSP (Stripe), y Pagos → Base de datos. Historia «Pago con tarjeta», con 6 pasos (5 envíos, uno al revés, y una comprobación).

| | Antes (lo que hay) | Antes (eventos artificiales) | Ahora |
|---|---|---|---|
| Biblioteca | 2 eventos | 6 eventos de un solo uso | 2 eventos |
| Se lee | Petición · Comprobación · Petición · Petición · Petición · Petición | las 6 frases | las 6 frases |
| Para cambiar una frase | — | editar el evento (o crear otro) | «Mensaje del paso…» en ese paso |

Las 6 frases son:

1. Cliente solicita el checkout del carrito.
2. Checkout valida la sesión del cliente.
3. Checkout pide a Pagos cobrar $49.
4. Pagos cobra la tarjeta en el PSP.
5. El PSP confirma el pago.
6. El pedido queda confirmado y pagado.

## Decisiones del PO (aprobadas el 22-10-2026)

- **D-PO-1. APROBADO.** Si el paso tiene `message`, el título visible del momento muestra la frase en lugar del nombre del evento. El nombre del evento sigue en el modelo, en la fila del editor y en el MCP.
- **D-PO-2. APROBADO.** El rótulo puede crecer y envolver el texto, sin truncar con «…». La narración del autor tiene prioridad sobre mantener una sola línea.
- **D-PO-3. APROBADO.** En un paso de conexión, `message` solo aparece en el título del momento. No hay globo sobre la conexión.
- **D-PO-4. APROBADO.** La edición se queda en el menú «⋯» del paso. No hay edición directa en la fila en esta slice.

## Integración con FLUYO-I18N-001 (hecha, 23-10)

I18N-001 entró en `main` (`6925ffe`, CACHE v105, decisiones 260–261) encima de 018.30. Esta rama se rebasó encima, tercera de la cadena 018.30 → I18N-001 → PRODUCT-NARRATION-001. Los conflictos se resolvieron a mano, sin merge ciego; la receta está en `C:\Proyectos\fluyo-new\FLUYO-PRODUCT-NARRATION-001-integracion-i18n.py`.

1. `js/viewer.js`: se conservan las dos cosas, la marca `.narrated` del título (esta tarea) y el «En pausa» con `FluyoI18n.t` (I18N).
2. Los alcances antiguos con `sw.js` (SEMANTICS-4/5/6, STEP-MESSAGE I1, STEP-REVERSE-002/003, 018.30) quedan en la versión de I18N, que envuelve `sw.js` con `undoI18n`. Los pines suben a v106.
3. Cadena de undo: `undoNarr` va en la cima, **dentro de `undoI18n`**. `undo029` y `undo030` vuelven a su texto. `fluyo-i18n-001-undo.cjs` exporta `PIECES_NARR`. `undoMsg` suma esas claves, salvo las que I18N crea (`js/i18n-en.js`: no existe en las bases antiguas), igual que I18N hizo con `sw.js`.
4. Las piezas de `undoNarr` se regeneraron contra `6925ffe`: I18N cambió líneas de contexto (`stKicker`, `present-story.js`, `editor-scenarios.js`).
5. Convención de I18N (decisión 261): los 3 textos NUEVOS de esta tarea en el editor («Ahora se lee «X»» y las dos ayudas del campo) pasan por `FluyoI18n.t`, con su inglés en `js/i18n-en.js`. En español, el texto es el mismo. Al hacerlo se quitó una cadena «Ahora sin mensaje» duplicada. El trinquete de texto sin migrar solo baja: `editor-scenarios.js` 238 → 237 y `story-authoring.js` 124 → 123 (se va el texto del veto). La línea base se reescribió con `--write-baseline`, como manda el test.
6. El alcance de I18N (`fluyo-i18n-001.test.cjs`, «el kernel no cambia») lee con `undoNarr` antes de comparar. Los arneses del editor de esta suite y de STEP-MESSAGE cargan el runtime real `js/i18n.js`.
7. `.ai/DECISIONS.md`: 258 (esta), 259 (018.30), 260–261 (I18N), en orden.

## Integración con FLUYO-018.30 (hecha, 22-10)

018.30 hizo su commit en `main` (`e82c821`, CACHE v104, decisión 259) y esta rama se rebasó encima, segunda en integrarse. La receta está automatizada en `C:\Proyectos\fluyo-new\FLUYO-PRODUCT-NARRATION-001-integracion.py` y se probó antes en un clon desechable. Dentro del mismo commit:

1. `sw.js`: CACHE **v105**. En los tests, los pines `fluyo-static-v104` pasan a v105, y el `(104 - 1)` de H1 de esta suite pasa a `(105 - 1)`.
2. Base de esta tarea: `BASE` y `BASE_NARR` = `e82c821`. 018.30 no toca los archivos que deshace `undoNarr`, salvo `viewer.js`; ahí la línea de esta tarea entró sin conflicto y su pieza sigue valiendo.
3. Cadena de undo: `undoNarr` va en la cima, **dentro de `undo030`**. `undo029` vuelve a su texto. `fluyo-018-30-undo.cjs` exporta `PIECES_NARR` y `undoMsg` lo suma a sus claves.
4. `.ai/DECISIONS.md`: la 258 (esta) va antes de la 259 (018.30).
5. El alcance de 018.30 (`fluyo-018-30.test.cjs`, «lo que esta tarea NO toca») lee con `undoNarr` antes de comparar con su base, como hizo cada slice con los alcances anteriores.

Sus pruebas siguen verdes encima (suite de 018.30 13/13 y su Chrome; ver «Pruebas»).

## Riesgos y pendientes

- **FLUYO-I18N-001 (otra sesión, sin commit en la checkout principal)** también se ha puesto en **CACHE v105** y toca `index.html`, `editor-scenarios.js`, `present-story.js`, `viewer.js`, `ui.js` y `s/index.html`. Quien llegue segundo a `main` sube a v106 y encadena su `undo` encima, con la misma receta. No se ha tocado su trabajo.
- **Encaje del Viewer:** el Viewer de la base encaja el diagrama con el rótulo en reposo. Si una frase larga hace crecer el rótulo al reproducir, `storyPlace` lo baja al pie cuando taparía el destino del momento (comportamiento existente). 018.30 añade la cámara que sigue el momento.

## Próximo paso

1. Decidir el orden frente a FLUYO-I18N-001: llevar esta rama a `main` (fast-forward desde `e82c821`) cuando la checkout principal no tenga cambios sin commit de otra slice, o rebasarla otra vez si I18N llega antes (v106).
2. Commit del MCP en la rama `feat/product-narration-001` de `fluyo-mcp`: ya sincronizado con el sha final. Resincronizar si fluyo vuelve a cambiar de sha.
3. Push; deploy de fluyo.space (v105) antes que el MCP (Cloud Run); smoke en producción.
