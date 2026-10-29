# FLUYO-STORIES-2.0 · S2b · Variantes en el editor — auditoría

Fecha: 2026-10-29 · Base: `origin/main` = `699bd7a` (fluyo.space sirve `fluyo-static-v119`) · Solo lectura: sin código, tests, CACHE, commits ni deploy.

**Estado: auditoría APROBADA (D1–D3). S2b IMPLEMENTED / VERIFIED**, lista para commit (worktree `fluyo-s2b`, rama `stories-2.0-s2b`, sin commit); ver «S2b · Implementación» al final.

Origen: el alcance de S2b de la auditoría S2 (`.ai/tasks/FLUYO-STORIES-2.0-S2.md`, § 8 y § 17) y las decisiones 314–316. La familia es la página; las variantes son Historias normales de esa página.

## Conclusión

**S2b es una slice de editor.** Todo cabe en `js/editor-scenarios.js`, más su CSS y sus textos:

- **Nombre:** `scRenameScenario` ya existe.
- **Desenlace en el selector:** `FluyoStoryClock.outcomeOf` ya existe (S2a).
- **Variante:** se arma con funciones del modelo que solo se llaman, sin modificarlas:
  - `duplicateScenario`;
  - `storyboardGroups`;
  - `FluyoStoryClock.pruneArrivalDependencies`.

**No hace falta tocar:** el kernel (`model.js`, `config.js`, `scenario-engine.js`, `scenario-playback.js`, `story-playback.js`, `story-authoring.js`, `document-integrity.js`, `safe-svg.js`), el formato, el codec de Share, Present, el Viewer ni `fluyo-mcp`.

**Ningún STOP.**

## Lo que hay hoy (código de `699bd7a`)

| Pregunta | Respuesta |
|---|---|
| Crear | `scNewScenario` → `createScenario(pg, defaultScenarioName(pg, scSeedNames()))`. Semilla «Historia N» en el idioma de la interfaz (283) |
| Renombrar | «⋯ → Renombrar» (`scScenarioMenu`) → `scRenameUI` abre un popover con campo y «Guardar nombre» → `scRenameScenario(name)`. Este último: recorta, rechaza vacío o > 120, no hace nada si no cambia, `pushUndo()`, `sc.name = …`, `scRenderHeader()` |
| Guardar / cargar / Share | `sc.name` es un campo de siempre. `normalizeScenarios` lo valida (no vacío, ≤ 120). Viaja en el `.fluyo.json`, el autoguardado y `#d=` sin nada nuevo |
| Cabecera | `#scScenarioTitle` es un botón «{nombre} ▾» que abre el selector (`scChooseScenario`). Su `textContent` lo fijan 016, 018-14b y 018-8 |
| Selector | `scChooseScenario` → `scMenu`, que solo admite rótulos: «● activa / ○ otra» + «+ Nueva historia». Sin desenlace |
| Desenlace | Hay una sola regla: `FluyoStoryClock.outcome(sc, trace)`. El editor la usa por `scOutcomeInfo(sc)`, la línea bajo el último momento, con un memo de una sola entrada para la Historia activa. Present y el Viewer la usan por `FluyoStoryClock.outcomeOf(page, sc)`, memo de 32 entradas por contenido |
| Menú de un paso | `scStoryMenu(step, anchor)` → `scMenuSections` (rótulo + `hint`). «Falla aquí» es la primera sección en los envíos |
| Reproduciendo | Las filas no tienen «⋯». Tocar una salta a su momento (`scSeekStep`). El «⋯» de la Historia sigue disponible y `scMomentNav().index` da el momento en curso (comprobado en v119) |
| Duplicar | `duplicateScenario(pg, id, fmt)` (kernel, solo se llama): copia JSON profunda e id nuevo e irreutilizable. La copia queda justo detrás de la original, con el nombre `fmt.copy(name)` único y recortado a 120. Copia todo: pasos con sus ids, `message`, `reverse`, `arrivalDependencies`, `observedFlow` y `nextStepId`. «Duplicar como fallo» (S1b) ya lo usa con `scFailCopyNames` |

## A · Nombre editable

- **Cambio mínimo:** un campo en línea en la cabecera.
  - Sustituye al botón mientras se edita, igual que `scInlineMessageField` hace con la frase (S1a).
  - Guarda con `scRenameScenario` (una entrada de Undo; sin cambio, ninguna).
  - Enter o perder el foco guardan; Escape deja el nombre como estaba. El Enter de un IME no confirma (229 / `isComposing`).
  - Vacío o solo espacios: no cambia nada.
- **Cómo se abre** (D2):
  - «⋯ → Renombrar» abre el campo en línea en vez del popover;
  - doble clic en el título;
  - se abre solo, con la semilla seleccionada, tras «Nueva historia» y «Otra forma desde aquí».
  - Un clic sigue abriendo el selector: el botón y su `textContent` no cambian.
- **Persistencia:** no hay nada que hacer; el nombre es `sc.name`.
- **Tests que lo fijan:**
  - `scRenameUI` y su popover solo aparecen en capas de deshacer antiguas (texto del código), no en aserciones de comportamiento.
  - El texto del título lo fijan 016, 018-14b, 018-8 e i18n-002-s2a/s4 (Chrome): no cambia.

## B · Desenlace en el selector

- **Dónde:** `scChooseScenario`.
- **Cambio:** pasar de `scMenu` a `scMenuSections`, que ya pinta un `hint` por fila. Cada Historia con pasos lleva de hint `FluyoStoryClock.outcomeText(FluyoStoryClock.outcomeOf(P(), s), FluyoI18n.t)`. Una Historia sin pasos no lleva hint.
- **Sin segunda implementación:** el punto común ya existe, `FluyoStoryClock.outcomeOf`, que es la misma ejecución que `scOutcomeInfo` y la misma que usan Present y el Viewer (S2a).
  - `scOutcomeInfo` no sirve para esto: su memo es de una sola Historia y se desharía al recorrer varias.
  - Un test vm debe comparar, para cada Historia de los ejemplos, el hint del selector con la línea del storyboard.
- **El rótulo no cambia:** «● nombre» / «○ nombre» y «+ Nueva historia» se conservan; el desenlace va en su propia línea (`scMenuHint`). Las aserciones de 016-browser (`/● Pago exitoso/`, `/○ Historia 1/`) siguen casando.

## C · «Otra forma desde aquí»

**Traza:** Historia actual → momento k (el del paso elegido) → `scBranchFrom(stepId)`:

1. Si se está reproduciendo, se detiene (`scReset`), y se cancela la colocación (`scCancelPlacement`), como hace `scDuplicateScenario`.
2. `at = storyboardGroups(src.steps)[k].at`, con k el grupo que contiene el paso.
3. `pushUndo()`, **una** entrada para todo.
4. `copy = duplicateScenario(pg, src.id, scBranchNames())`. Es la copia del kernel, detrás de la original, con el nombre «{nombre} — otra forma» / «— otra forma N» (claves `seed.storyBranch` / `seed.storyBranchN`, como `seed.storyFail`). Es contenido: no se retraduce.
5. `copy.steps = copy.steps.filter(s => s.at <= at)`: los momentos 1..k, incluido el del paso. Nada posterior.
6. `scSetArrivalDependencies(copy, FluyoStoryClock.pruneArrivalDependencies(copy))`, la misma poda que `scDeleteStep`. Quita las esperas de pasos que ya no existen; las demás se conservan.
7. `scSelectStory(copy.id)`, `scCommit()` y el nombre en línea (A).

Qué se conserva y qué no:

| Qué | Cómo |
|---|---|
| Frases y narración | Van en cada paso (`message`): se copian tal cual |
| Estados | Los `SET_STATE` de los momentos 1..k van con sus pasos (p. ej. un «Pagos no responde» de «Falla aquí»). Las condiciones iniciales son de la página (`behaviors`) y las comparten todas las Historias: no se copian ni se tocan |
| Pasos posteriores | Los filtra el paso 5. Al reproducir la copia termina en el momento k, con el desenlace que corresponda, y se sigue contando tocando el sistema (S1a añade al final con `defaultStepTime`) |
| Original intacta | `duplicateScenario` trabaja sobre una copia JSON y lo demás solo toca `copy`. Test: el JSON de la original es igual antes y después |
| Id y nombre | Id: `reserveProjectIds` vía `duplicateScenario`, nuevo e irreutilizable. Nombre: único por `copyScenarioName`. Los ids de paso son por Historia: la copia conserva los suyos y su `nextStepId`, que nunca baja |
| `observedFlow` | Es de la Historia y habla de nodos, no de pasos: se conserva |
| Undo | Una entrada: un Ctrl+Z quita la copia entera y la página vuelve exacta. Renombrarla después es otra entrada. La selección se conserva (018.24) |
| Cuándo se ofrece | En el último momento sale desactivada, con «Es el último paso: usa Duplicar historia». Con la Historia en una versión de motor no compatible, no se ofrece (`scEditable`) |

**Funciones que se reutilizan** (todas existentes; ninguna cambia):

- `duplicateScenario`, `copyScenarioName` vía `fmt`, `storyboardGroups`;
- `FluyoStoryClock.pruneArrivalDependencies`, `scSetArrivalDependencies`;
- `scSelectStory`, `scCommit`, `scMenuSections`.

## D · Kernel, formato y MCP

| Pieza | ¿Cambia? |
|---|---|
| `model.js`, `config.js`, `scenario-engine.js`, `scenario-playback.js`, `story-playback.js`, `story-authoring.js`, `document-integrity.js`, `safe-svg.js` | No. Solo se llaman `duplicateScenario`, `storyboardGroups` y `pruneArrivalDependencies` |
| Formato (`version` 5, `engineVersion` 2) | No. Una variante es una Historia normal; no hay `variantOf` (dec. 314) |
| Codec y Share | No. La variante viaja como otra forma de su página (dec. 315) |
| Present y Viewer | No. Ya muestran la familia de la página (S2a) |
| `fluyo-mcp` | No. `kernelId` sin cambios; un agente ya hace lo mismo con `duplicate_story` + `remove_step` |

**Resultado: sin STOP.**

## E · UX: el camino más corto

- **Editando:** «⋯» del paso (o tocar la fila) → **«Otra forma desde aquí»**. Va junto a «Falla aquí», en la misma primera sección. Se crea la copia hasta ese momento, con el nombre abierto para escribir «El usuario cancela». Enter, y se sigue tocando el sistema. **2 gestos y un nombre.**
- **Reproduciendo o en pausa:** las filas no tienen «⋯» (tocar una salta). El «⋯» de la Historia ofrece **«Otra forma desde el paso N»**, con N el momento en curso (`scMomentNav().index + 1`). Es el mismo `scBranchFrom` sobre el primer paso de ese momento; detiene la reproducción. Antes del primer momento no aparece (D1).

## F · Alcance

**Archivos servidos que cambian:**

| Archivo | Para qué |
|---|---|
| `js/editor-scenarios.js` | Nombre en línea (`scBeginInlineName` y un campo como el de la frase); selector con `scMenuSections` + desenlace; `scBranchFrom`, `scBranchNames`, «Otra forma desde aquí» en `scStoryMenu` y «Otra forma desde el paso N» en `scScenarioMenu`; «Renombrar» → en línea; abrir el nombre tras «Nueva historia» |
| `css/styles.css` | Campo del nombre en la cabecera (alto y tipografía del título) |
| `js/i18n-en-editor.js` | ~7 claves: `step.branchHere`, `step.branchHereHint`, `step.branchLast`, `stories.branchAt`, `seed.storyBranch`, `seed.storyBranchN`, `stories.nameEdit` |
| `sw.js` | CACHE **v120** |

**No cambian:** el kernel, `render.js`, `present-story.js`, `viewer.js`, `share-url.js`, `editor-share.js`, `story-clock.js`, `index.html` (la cabecera no cambia de estructura), ejemplos y `fluyo-mcp`.

**Tests nuevos:**

- `test/fluyo-stories-2-0-s2b.test.cjs`, vm sobre el arnés de S1b:
  - N: nombre en línea, Undo, IME, vacío y > 120;
  - B: hint del selector = línea del storyboard en los 3 ejemplos;
  - V: variante en el momento 1, en medio y en el último; momentos simultáneos; esperas podadas; original byte a byte; un Undo; `SET_STATE` y frases conservados;
  - E: inglés;
  - C: alcance, kernel y MCP.
- `test/fluyo-stories-2-0-s2b-mutations.cjs`: unas 15 mutaciones.
- `test/fluyo-stories-2-0-s2b-browser.cjs`: Chrome real, ratón y dedo. Cubre:
  - crear una variante desde la fila y desde el «⋯» en pausa;
  - escribir su nombre y seguir contando;
  - el selector con desenlaces;
  - Share de la familia con la variante;
  - móvil 375×812;
  - inglés.
- `test/fluyo-stories-2-0-s2b-undo.cjs`: capa de deshacer (base = el commit de S2a), que `undoS2a` llama primero. El generador existe (`gen-undo-s2a.py`, mismo patrón).

**Tests existentes que probablemente haya que adaptar** (solo identificados):

- **Mecánicos:**
  - los ~89 que comparan CACHE (v119 → v120);
  - los alcances que registran `PIECES_ST2A` (S0, S1, S2a, S2b, S3a, S3b de I18N-002; SHELL y su undo; S1a; S1b; S2a) registrarán también `PIECES_S2B`;
  - `undoS2a` llamará antes a `undoS2b`.
- **Por texto del código:** las capas de deshacer antiguas cuyas piezas cubren `scChooseScenario` o `scScenarioMenu` (`fluyo-i18n-001-undo`, `fluyo-i18n-002-s2a-undo`, S1b). Funcionan si `undoS2b` va primero en la cadena; si no, los alcances de i18n fallan.
- **Por menú:**
  - el test de S1b que lee el menú de un envío espera «Falla aquí» primero; sigue siéndolo, pero la sección tendrá 2 elementos;
  - E1 de S1b lee `scScenarioMenu` por rótulo, no por posición: sin cambio previsto.
- **Por captura:** `fluyo-i18n-002-s2a-browser.cjs` captura el popover «elegirHistoria»; con los hints crece de alto. Hay que ver si compara píxeles o solo recorta.

**Posibles regresiones:**

- el popover del selector, más alto en móvil;
- el campo en línea del nombre con el teclado del móvil (la hoja inferior; ver S1a);
- un doble clic en el título que también abra el selector, si no se filtra el primer clic (`dblclick` frente a `click`);
- Undo de la variante con la reproducción activa.

## Decisiones del PO

- **D1 · Reproduciendo, «Otra forma desde el paso N» en el «⋯» de la Historia** (detiene y crea). **Recomendado: sí.** Es lo que pide «estoy reproduciendo → quiero otra forma desde aquí» sin rediseñar las filas. Si no se acepta, solo se ofrece editando.
- **D2 · Nombre en línea**: «Renombrar» abre el campo en línea en vez del popover, también con doble clic en el título, y se abre solo tras «Nueva historia» y «Otra forma». **Recomendado: sí.** El clic simple sigue siendo el selector.
- **D3 · La variante incluye el momento elegido** (1..k). **Recomendado: sí.** «Desde aquí» = lo que ya pasó, igual. La otra opción, 1..k−1, deja fuera el momento en el que diverge.

Lo resuelvo sin pedir decisión:

- la semilla «— otra forma»;
- desactivada en el último momento;
- una sola entrada de Undo;
- el desenlace en el selector solo para Historias con pasos;
- es + en; fr/ja/zh caen al inglés.

## Acceptance criteria

1. **AC1 · Nombre en línea.** «Renombrar» y el doble clic abren un campo en la cabecera. Enter guarda (una entrada de Undo), Escape deja el nombre como estaba, el IME no confirma y un nombre vacío no cambia nada. Guardar, recargar y compartir conservan el nombre.
2. **AC2 · Selector con desenlace.** Cada Historia con pasos muestra «Termina bien» o «Falla en el paso N», igual que la línea del storyboard al activarla. En los ejemplos: Compra con éxito / El banco no responde = Termina bien / Falla en el paso 4.
3. **AC3 · Otra forma desde aquí.** Desde el paso de un momento k, en 1 gesto, sale una Historia nueva:
   - justo detrás de la original y activa;
   - con los momentos 1..k (frases, sentidos y caídas incluidos) y nada posterior;
   - con las esperas a pasos quitados podadas;
   - con el nombre abierto para escribir.
4. **AC4 · Original intacta y Undo.** El JSON de la original es igual antes y después. Un Ctrl+Z devuelve la página exacta (salvo contadores, que nunca bajan). Redo la rehace.
5. **AC5 · Reproduciendo** (si D1). En pausa en el momento N, el «⋯» de la Historia ofrece «Otra forma desde el paso N»: detiene la reproducción y crea la variante 1..N.
6. **AC6 · Seguir contando.** Tras crearla, tocar el sistema añade pasos al final de la variante (S1a), y su desenlace se actualiza en el storyboard y en el selector.
7. **AC7 · Familia.** La variante aparece en «Otras formas» de Present y del Viewer y viaja en Share con la familia (S2a), sin cambios en esos archivos.
8. **AC8 · Nada se mueve por debajo.** Kernel, formato, codec, `render.js`, Present, Viewer, Share, ejemplos y `fluyo-mcp` quedan byte a byte iguales. La suite completa no suma fallos frente a la base.
9. **AC9 · Lenguaje.** es + en. Sin «Evento», «escenario» ni «primitiva» en lo nuevo.

## Riesgos

1. **Coste de tests (no de producto):** la capa de deshacer y las ~89 constantes de CACHE. Es mecánico y el generador ya está hecho.
2. **Cadena de deshacer:** S2b toca funciones que cubren piezas de capas antiguas (`scChooseScenario`, `scScenarioMenu`, `scStoryMenu`). `undoS2b` tiene que ir primero o los alcances de i18n fallan.
3. **Móvil:** el campo del nombre en la hoja inferior con el teclado abierto. Se mide en 375×812.
4. **Selector más alto:** con muchas Historias, el popover crece con los hints. Ya hace scroll; se comprueba en móvil.
5. **El doble clic en el título también abre el selector** con el primer clic. O se acepta (el selector se cierra al abrir el campo) o el campo se abre desde «Renombrar» y no por doble clic.

## Plan de implementación (una slice, un commit, v120)

1. `scBranchNames` y `scBranchFrom(stepId)` (§ C), con un test vm de la traza: momento 1, medio, último, simultáneos, esperas y original intacta.
2. «Otra forma desde aquí» en `scStoryMenu`, junto a «Falla aquí»; «Otra forma desde el paso N» en `scScenarioMenu` (D1).
3. `scBeginInlineName` y el campo en la cabecera; «Renombrar» lo usa; se abre solo tras crear (D2).
4. `scChooseScenario` → `scMenuSections` con el desenlace de `FluyoStoryClock.outcomeOf`.
5. Claves en inglés, CSS y CACHE v120.
6. Capa de deshacer, cadena (`undoS2a` → `undoS2b`), `PIECES_S2B` en los alcances y CACHE en los tests antiguos.

## Plan de QA

- **Propios:** vm (N, B, V, E, C), mutaciones y Chrome (§ F).
- **Suite completa** en un clon con S2b commiteada, comparada con los 83 fallos de la base.
- **Regresiones en Chrome**, secuenciales:
  - S2a, S1b, S1a;
  - EXAMPLES, NARRATION, 018.18, 018.29;
  - 014, 016;
  - I18N-002 S0, S1, S2a, S4.
- **Deuda conocida que no cuenta:** S3a 29/6, STEP-MESSAGE 3, SHELL 2.
- **Tras el deploy:** smoke de producción, el QA de Chrome de S2b contra fluyo.space.

## S2b · Implementación (29-10-2026)

PO: D1–D3 aprobadas. Base `699bd7a` (v119) → CACHE **v120**. Worktree `fluyo-s2b`, rama `stories-2.0-s2b`, sin commit.

**No cambian:**

- el kernel;
- el formato y el codec;
- Share, Present, el Viewer, `story-clock.js` y `render.js`;
- los ejemplos;
- `fluyo-mcp` (`464f4e0`).

Decisiones 317–318.

### Qué hace

- **«Otra forma desde aquí»** (`scBranchFrom`), en el ⋯ del paso, junto a «Falla aquí».
  - Llama a `duplicateScenario`, que deja la copia detrás de la original con id nuevo y el nombre «{nombre} — otra forma».
  - La copia conserva los momentos 1..k, incluido el del paso: frases, sentidos y caídas van con sus pasos.
  - Quita lo posterior y poda las esperas de llegada a lo quitado (`FluyoStoryClock.pruneArrivalDependencies`).
  - Deja la variante activa y su nombre en línea, seleccionado. Se sigue contando tocando el sistema.
  - La original no cambia. Una sola entrada de Undo.
  - En el último momento sale desactivada: «Es el último paso: usa «Duplicar historia»».
- **Reproduciendo (D1):** el ⋯ de la Historia ofrece «Otra forma desde el paso N», con N = el momento en curso (`scMomentNav`). Detiene la reproducción y crea 1..N. El storyboard no gana controles.
- **Nombre en línea (D2):**
  - lo abren «Renombrar», el doble clic en el título, «Nueva historia» y la variante;
  - el campo ocupa el sitio del botón «nombre ▾», que no cambia: un clic sigue siendo el selector;
  - guarda con `scRenameScenario` (una entrada de Undo; vacío o sin cambio, ninguna);
  - Escape lo deja como estaba; el Enter de un IME no confirma;
  - reproduciendo, abrirlo detiene la reproducción, como hacía el popover;
  - cambiar de Historia lo cierra;
  - el popover de renombrar y su clave `stories.saveName` se retiran.
- **Selector:** bajo cada nombre, el desenlace de `FluyoStoryClock.outcomeOf`, la misma regla que el storyboard, Present y el Viewer. Una Historia sin pasos no lleva desenlace.

### Diferencias con la auditoría

- **«Renombrar» reproduciendo detiene la reproducción y abre el campo.** Al principio no se abría; el adversarial de 016 en Chrome esperaba el comportamiento de siempre.
- **Quitar el campo con el foco dispara su `blur` en Chrome**, que volvía a pintar la cabecera: el campo se suelta antes de quitarlo. Lo encontró 016 en Chrome.

### Archivos

| Archivo | Cambio |
|---|---|
| `js/editor-scenarios.js` | `scBranchNames`, `scBranchMoment`, `scBranchMenuItem`, `scBranchNow`, `scBranchFrom`; `scBeginInlineName`, `scRenderInlineName`, `scInlineNameField`; el selector con `scMenuSections`; «Renombrar» en línea; el doble clic en el título; `scSelectStory` cierra el campo; sin `scRenameUI` |
| `css/styles.css` | `#scStoryNameInput` (también en la cabecera móvil) y `#scScenarioTitle[hidden]` |
| `js/i18n-en-editor.js` | 6 claves nuevas; se retira `stories.saveName` |
| `sw.js` | CACHE v120 |
| `.ai/DECISIONS.md` | 317–318 |
| `test/fluyo-stories-2-0-s2b.test.cjs` | 15 tests vm: V variante, N nombre, B selector, S guardar/cargar, E inglés, C alcance |
| `test/fluyo-stories-2-0-s2b-mutations.cjs` | 24 mutaciones (sin M14: la parada de la reproducción está en dos sitios y quitar uno no cambia el comportamiento) |
| `test/fluyo-stories-2-0-s2b-browser.cjs` | QA en Chrome real: A desde el paso, B reproduciendo, C renombrar, D selector/guardar/Share, E inglés, F móvil |
| `test/fluyo-stories-2-0-s2b-undo.cjs` | Capa de deshacer de S2b (`undoS2b`, base 699bd7a), generada del diff; `undoS2a` la llama primero |
| Alcances I18N-002 S0–S3b, SHELL y su undo, S1a, S1b, S2a | Registran `PIECES_ST2B` donde ya registraban S2a. El nombre evita el choque con `PIECES_S2B` de I18N-002 |
| `test/fluyo-i18n-001-baseline.json` | `editor-scenarios.js`: 9 → 8 textos sin migrar (el popover retirado tenía uno). Regenerada con `--write-baseline`, como pide el propio trinquete |
| 016 vm y Chrome, I18N-002 S4, S2a C1/C2/C3 | Ver la nota |
| 87 tests | CACHE v119 → v120 |

**Ajustes a tests antiguos** (el comportamiento aprobado, no regresiones):

- **016 vm:** el selector es `scMenuSections`; se capturan sus rótulos.
- **016 Chrome:** «Renombrar» escribe en `#scStoryNameInput`.
- **I18N-002 S4:** cuenta los Enter con IME con S2b deshecha (el popover retirado era uno).
- **S2a:**
  - su «sin cambios» del editor pasa por `undoS2b`;
  - su diff de C3 excluye `editor-scenarios.js`.

### Pruebas

- **Propios:**
  - vm 15/15;
  - mutaciones 24/24;
  - Chrome 40/0, que cubre:
    - A desde el paso: variante 1..3 con frases, original byte a byte, una entrada de Undo, nombre con foco y seleccionado, Enter, seguir contando, tres Ctrl+Z → página exacta, dos Redo;
    - B reproduciendo: «Otra forma desde el paso 3» en pausa, detiene, 3 momentos, sin controles nuevos en el storyboard;
    - C doble clic y «Renombrar» en línea, vacío no cambia, un clic sigue siendo el selector;
    - D selector con desenlaces = `outcomeOf`, guardar/cargar y Share (el Viewer la ofrece en «Otras formas»);
    - E inglés;
    - F móvil 375×812 con el dedo.
- **Suite completa** en un clon con S2b commiteada: 1839 tests / 83 fallos, los mismos 83 de la base (`699bd7a`), 0 nuevos.
- **Regresiones en Chrome**, en el clon y en secuencia:

  | Prueba | Resultado |
  |---|---|
  | S2a | 50/0 |
  | S1b | 47/0 |
  | S1a | 35/0 |
  | EXAMPLES | 40/0 |
  | NARRATION | 100/100 |
  | 018.18 | 427/0 |
  | 018.21 | 36/0 |
  | 018.29 | sin fallos |
  | 018.30 | 402/0 |
  | 014 | 13 bloques OK |
  | 016 | 17 bloques OK |
  | SW-VIEWER | 63/0 |
  | SEMANTICS-5 | 85/0 |
  | i18n-001 | 78/0 |
  | I18N-002 S0 | 385/0 |
  | I18N-002 S1 | 181/0 |
  | I18N-002 S2a | 179/0 |
  | I18N-002 S2b | 26/0 |
  | I18N-002 S3b | 46/0 |
  | I18N-002 S4 | 102/0 |

  Tras las dos correcciones de la QA se repitieron S2b, 016, 014, S2a, S1b, S1a, S0, I18N-002 S2a y 018.18, todos en verde. En la primera tanda S0 dio 384/1 por el salto de zoom 80 % → 127 % ya conocido; en la repetición, 385/0.
- **Deuda conocida que no cuenta** (no se ejecutó de nuevo; sin relación con S2b): S3a 29/6, STEP-MESSAGE 3, SHELL 2.

### Riesgos

- **Un doble clic en el título** abre y cierra el selector con los dos primeros clics antes de abrir el campo. Es invisible en la práctica y el selector queda cerrado.
- **En móvil el campo del nombre abre el teclado.** Solo ocurre por un gesto explícito (menú o crear), nunca al tocar el lienzo (S1a).
- **Cada slice nueva** necesita su capa de deshacer. Con S2b la cadena es `… → undoS1b → undoS2a → undoS2b`.

### Próximo paso

Revisión del PO → commit en `stories-2.0-s2b`, merge a `main`, push y deploy (v120), y smoke de producción (el QA de Chrome de S2b contra fluyo.space).
