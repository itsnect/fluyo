# FLUYO-018.29 — R1 + G1: el encabezado de Present por su alto real y saltar en pausa enseña el momento

Estado: COMMITTED en local tras la revisión del PO (sin push ni deploy)
Owner/agente actual: —

> El encargo llegó como «FLUYO-018.25 · R1 + G1», pero `FLUYO-018.25` ya existe (laneLayout, decisiones 190–196). Esta tarea toma el siguiente número libre de la serie 018, **018.29**. Origen: auditoría post-slices de 018.18 sobre `441a75c` / v102 (hallazgos R1 y G1).

## Objetivo

- **R1**: en Present, el encabezado nunca tapa el diagrama, tampoco en un teléfono apaisado, con o sin ruta de Flujo, y sin saltos de encuadre.
- **G1**: saltar a un momento con la reproducción en pausa lo enseña entero ya: globo, `message`, símbolo y resaltado completos en el primer fotograma, sin tocar el transporte.

## Alcance

### Incluye

- `fitViewPresent` (`js/present-story.js`): reserva medida del encabezado.
- `FluyoStoryClock.seek` / `FluyoStoryClock.reveal` (`js/story-clock.js`, fuera del kernel) y sus dos puntos de pintura: `buildScenarioRenderState` (editor y Present) y `renderViewerFrame` (Viewer).
- `sw.js`: CACHE v102 → v103 (y las aserciones de versión de los tests).

### No incluye (intacto, verificado por test de alcance)

- Kernel (`model.js`, `config.js`, `safe-svg.js`, `scenario-engine.js`, `scenario-playback.js`, `story-playback.js`, `document-integrity.js`, `story-authoring.js`), por tanto `fluyo-mcp`, `add_steps` y las descripciones del MCP.
- `render.js`, `geometry.js`, `export.js` (SVG/PNG), `share-url.js` y `link-codec.js` (URL corta), `flow-semantics.js`, `skin.js`, `index.html`, `s/index.html`, CSS.
- El resto de deudas de Playback (ver § Deuda encontrada).

## Auditoría (antes de implementar)

| Pieza | Hallazgo |
|---|---|
| `fitViewPresent` | `top = presentHasStory() ? 84 : 24`: alto fijo. Solo se llama al entrar, al cambiar de diapositiva y al redimensionar, nunca al reproducir. |
| `#presentStory` | Mide 52 px lista (título + puntos). Reproduciendo y en pausa, 75 px (+ mensaje). Con ruta, 95 px (+ `#psFlow`, decisión 246). Terminada con fallos, 96 px (+ cierre). Con `top:14px`, el borde llega a 89, 109 o 110, frente a los 84 reservados. |
| R1 medido (HEAD) | En 844×390 y 812×375, B9 con ruta: el encabezado tapa «Métricas» en todos los momentos. Sin ruta, el borde pasa de la caja del diagrama (89 > 84), pero los 40 u de aire de `getBounds` evitan tapar un nodo. En 1280×720 con ruta también pasa de la caja (109 > 106). |
| `goSlide` | Llama a `fitViewPresent()` antes de `updatePresentBar()`, así que el encabezado aún tiene la Historia de la página anterior. Con un alto medido eso importa. |
| `story-clock.js` `seek` | Crea un Playback con el origen desplazado y hace `tick` hasta `at`. Los cues del momento empiezan en `elapsed = 0`. |
| `cueEnvelope` (kernel) | `alpha = min(enter, exit)` con `enter = elapsed / min(140, d/3)`. A `elapsed = 0`, alpha 0. En pausa el reloj no avanza: el momento queda invisible mientras dure la pausa, no solo 140 ms. |
| `render.js` | `drawScenarioNodeCue` hace `if(cue.alpha <= 0) continue`: ni globo ni `message` ni símbolo. El resaltado se multiplica por alpha. |
| Superficies | Editor y Present pintan con `buildScenarioRenderState`; el Viewer con `renderViewerFrame`. Son las dos únicas llamadas a `FluyoStory.renderState`. |
| `message` | STEP-MESSAGE-001, decisión 255: el globo sale de `stepMeta → nodeEffects.message`. Es el mismo cue, con el mismo alpha. |
| Tests 018.18–018.24 | El test de 018.18 «saltar = reproducción continua» compara la proyección del kernel con alpha. Por eso G1 no puede vivir en el kernel ni en `seek` alterando el Playback: va en una capa posterior. |

**Mínima modificación**: R1 = medir el encabezado en `fitViewPresent`. G1 = una marca en `seek` (solo en pausa) y un filtro de presentación sobre la proyección, fuera del kernel. Ni el kernel ni `render.js` cambian.

## Contrato final

### R1 (decisión 256)

- `fitViewPresent` reserva arriba `max(24, borde inferior real de #presentStory)`. La caja del diagrama (`getBounds`, con su aire de 40 u) empieza ahí.
- El borde se mide con el encabezado en su forma **más alta**, desde el inicio (lista). Se añaden como filas sonda las que faltan en ese momento:
  - el mensaje;
  - el cierre de «terminada»: `FluyoStory.describe("finished", …)` sobre el Trace de la Historia; solo existe si algún envío falla;
  - la línea de la ruta, con su texto real (`scFlowPresentLine`), si la Historia la tiene.
- Las sondas llevan las mismas clases y `aria-hidden`. Se ponen y se quitan en la misma tarea, así que nunca se pintan ni se anuncian.
- Reproducir, pausar, saltar y terminar **no reencajan**: no hay salto. Redimensionar sí reencaja, con la misma regla.
- Antes de medir se repinta el encabezado de la página actual (esto corrige de paso el orden de `goSlide`).
- No hay parche por viewport. CSS y HTML no cambian.
- Límite conocido: un mensaje de consecuencia más largo que una línea no se reserva, porque no se conoce hasta reproducir. En vertical hay sitio de sobra (caja desde 322–361 px). En apaisado, el ancho máximo del rótulo (640 px) lo hace improbable.

### G1 (decisión 257)

- `FluyoStoryClock.seek` sigue aterrizando **exactamente** en `at`. Solo si el reloj está en pausa (también al saltar desde «terminada», que pausa, decisión 157) marca `playback.revealAt = at`.
- `FluyoStoryClock.reveal(rs, playback)` copia los cues de **ese** momento (`virtualAt === revealAt`) que aún están en su entrada (`enter < 1`) y les pone `alpha 1, enter 1`. Durante la entrada la salida no ha empezado, porque cada fade se acota a un tercio de la duración. Por eso «completo» es exactamente alpha 1.
- El editor y Present (`buildScenarioRenderState`) y el Viewer (`renderViewerFrame`) pasan su proyección por `reveal`.
- **Al reanudar**, el reloj sigue desde `at` y el cue sigue completo: no reaparece desde 0, no hay parpadeo. Pasada la entrada, la envolvente normal ya da 1. La duración, la salida y el fin del cue son idénticos a una reproducción continua.
- **No cambia**:
  - el reloj (no se mueve `at`, no se adelanta) ni hay un segundo reloj;
  - el Trace, el horario visible y las dependencias de llegada;
  - `motion`, `CUE_FADE_IN_MS` y el kernel (que sigue dando alpha 0 al entrar);
  - el documento y el Undo;
  - saltar reproduciendo (el cue entra con su fade) y la reproducción continua (`reveal` es la identidad).

## Diff (código)

- `js/present-story.js`: nueva `presentHeaderBottom()`. En `fitViewPresent`, `presentStoryRefresh()` antes de medir y `top=Math.max(24, presentHeaderBottom()-r.top)` en vez de `presentHasStory()?(small?84:84):24`.
- `js/story-clock.js`: en `seek`, `if(isPaused(c)) started.playback.revealAt = times[k];`. Nueva función `reveal`, exportada.
- `js/editor-scenarios.js`: `buildScenarioRenderState` pasa por `FluyoStoryClock.reveal`.
- `js/viewer.js`: `renderViewerFrame` pasa por `FluyoStoryClock.reveal`.
- `sw.js`: `fluyo-static-v103`.
- Tests: la versión v102 → v103 en las aserciones de CACHE de 66 tests. Solo cambia esa línea (verificado con `git diff --ignore-cr-at-eol --numstat`).
- Nuevos:
  - `test/fluyo-018-29.test.cjs` (vm, 10);
  - `test/fluyo-018-29-browser.cjs` (Chrome real);
  - `test/fluyo-018-29-mutations.cjs` (16 U + 6 B);
  - `test/fluyo-018-29-undo.cjs`: `undo029` deshace en texto esta tarea, para los alcances de slices anteriores, como `undoMsg` o `undo6`.
- Tests de alcance de slices anteriores, siguiendo la convención:
  - `fluyo-step-message-001-undo.cjs`: `undoMsg` aplica antes `undo029`, y sus `PIECES` exportan también las claves de 018.29;
  - `fluyo-step-message-001.test.cjs` (I1): el bucle «sin cambios» pasa por `undo029`;
  - `fluyo-scenarios-semantics-1/2/3.test.cjs` y `fluyo-step-reverse-002.test.cjs`: `js/story-clock.js` se descuenta solo si `undo029` lo devuelve exacto a su base (`ONLY029`).
- Docs: decisiones 256–257 en `.ai/DECISIONS.md`; fila de `story-clock.js` en `.ai/ARCHITECTURE.md`; esta tarea.

## Pruebas

### vm — `node --test test/fluyo-018-29.test.cjs` → 10/10

1. Alcance: kernel, render, geometría, exportación, enlace, URL corta, flow-semantics, skin, HTML y CSS idénticos a HEAD; CACHE v103; story-clock puro y fuera del kernel del MCP.
2. R1 estático: sin 84 fijo; reserva medida; refresh antes de medir; sondas con `aria-hidden` que se quitan; sin parche por viewport.
3. G1: en el complejo de 017.1 (Historias 1 y 2, y una variante con la recuperación 80 ms después de otro cue, que sigue en su entrada y no se revela) y en B9 (Historias 1, 3 y 4; la 3.ª espera una llegada), saltar en pausa a cada momento:
   - el cursor queda en `at` y el reloj no se mueve;
   - el kernel sigue dando alpha 0;
   - `reveal` da alpha 1 solo a los cues de ese momento, y el `message` sale completo.
4. `reveal` no toca el Playback ni los objetos de entrada; el Trace, el horario, la Historia y las dependencias quedan intactos.
5. Saltar reproduciendo: sin `revealAt`; el cue entra 0 → 0,5 a 70 ms. Reproducción continua: `reveal` es la identidad en cada fotograma de 0 a 8 s.
6. Saltar en pausa, esperar 15 s y reanudar: el cursor es `at + d` exacto. El cue sigue a 1 en +0/16/70/139 ms. De +140 ms al fin es idéntico a la reproducción continua, y termina cuando terminaba.
7. Editor real en vm, con ⏭, ⏮, la fila, Reanudar, saltar reproduciendo y ⏮ desde terminada:
   - el cue está completo en pausa y entra con fade reproduciendo;
   - el documento, el Trace y el Undo no cambian.
8. Cableado: el editor y el Viewer pasan por `reveal`, y no hay otra llamada a `FluyoStory.renderState`.
9. R1: las filas de «terminada» reservadas coinciden con las que Present pinta al terminar (mismo modelo y Trace; con y sin fallos).
10. `undo029` devuelve exactos a 441a75c los 4 archivos servidos que cambia esta tarea, y `undoMsg` lo lleva debajo.

### Chrome real — `node test/fluyo-018-29-browser.cjs` → **396 ✔ / 0 ✘**

Contra HEAD (v102, `FLUYO_ROOT` = copia de HEAD): 315 ✔ / 81 ✘. Las 81 son exactamente R1 y G1.

**R1**: Present del editor en 7 viewports (1440×900, 1280×720, 768×1024 con dedo, 390×844, 375×812, 844×390, 812×375) × 3 documentos (B9 con ruta, B9 sin `kind`, complejo de 017.1). En cada documento se mide en lista, reproduciendo, en pausa en cada uno de los 4 momentos y terminada. En todas las fases:
- el encuadre es idéntico (sin salto);
- el borde del encabezado no pasa de la caja del diagrama;
- ningún nodo queda debajo del encabezado ni del mando;
- no queda ninguna sonda en el DOM;
- la ruta se ve con ruta y no aparece sin ella;
- no hay errores de consola.

| viewport | documento | HEAD: caja desde · encabezado máx. | 018.29: caja desde · encabezado máx. |
|---|---|---|---|
| 844×390 | con ruta | 84 · 109,3 — **tapa «Métricas»** | 109,3 · 109,3 |
| 844×390 | sin ruta | 84 · 89 | 89 · 89 |
| 844×390 | complejo | 84 · 109,5 (terminada) | 109,5 · 109,5 |
| 812×375 | con ruta | 84 · 109,3 — **tapa «Métricas»** | 109,3 · 109,3 |
| 812×375 | sin ruta / complejo | 84 · 89 / 109,5 | 89 / 109,5 |
| 1280×720 | con ruta | 105,9 · 109,3 (pasa de la caja) | 118,5 · 109,3 |
| 1280×720 | sin ruta / complejo | 105,9 · 89 / 126,2 · 109,5 | 108,4 · 89 / 139 · 109,5 |
| 1440×900 | con ruta / sin / complejo | 162,5 / 162,5 / 185,5 | 175,2 / 165 / 198,3 |
| 768×1024 | con ruta / sin / complejo | 364,7 / 364,7 / 376,5 | 377,4 / 367,2 / 389,2 |
| 390×844 | con ruta / sin / complejo | 347,3 / 347,3 / 328,3 | 360,8 / 343,5 / 334,8 |
| 375×812 | con ruta / sin / complejo | 334,4 / 334,4 / 315,2 | 348 / 330,7 / 321,7 |

Donde el alto no limita (escritorio ancho, vertical), el diagrama solo se desplaza unos píxeles hacia abajo; el centrado vertical incluye ahora la reserva real. En apaisado se encoge lo que crece la reserva: hasta 25 px de alto con ruta.

**G1**: Editor, Present y Viewer en 1440×900, 390×844, 844×390 y 812×375, con Historia con ruta y sin ruta. Las medidas salen del lienzo real, espiando `nodeRuntimeCues` y `fillText`:
- ⏭ y ⏮ en pausa aterrizan en `at` = 1500;
- en el primer fotograma el cue llega con alpha 1 y el texto del `message` se pinta con `globalAlpha` 1. En HEAD: alpha 0 y el `message` no se pinta;
- Reanudar sigue desde `at` (cursor = 1500 + el tiempo real transcurrido), con alpha mínimo 1 en todos los fotogramas siguientes. En HEAD reaparece desde 0;
- reproduciendo, ⏮ conserva la entrada (primer alpha < 1);
- los Steps, `at`, las dependencias, el Trace, el horario, el documento y el Undo quedan intactos;
- no hay errores de consola.

Capturas (scratchpad de la sesión, fuera del repo): `shots-029/` (018.29) y `shots-029-head/` (HEAD).
- `r1-l844-con-pausa.png`: en HEAD el encabezado tapa «Métricas»; en 018.29 queda libre.
- `g1-l844-present-seek.png`: en HEAD no hay globo; en 018.29 se ve «Worker A deja de aceptar pedidos».

### Regresión

- **Suite vm completa** (`node --test "test/*.test.cjs"`) en clones locales con git, con `fluyo-mcp` al lado (enlace de solo lectura), fuera del repo:
  - **HEAD 441a75c**: 1590 tests, 83 fallos. Es la misma línea base que la auditoría de v102.
  - **HEAD + este diff, sin commit**: 1600 tests (los 10 nuevos pasan), 89 fallos. Los 83 de siempre y 6 más, todos de la familia «idéntico a HEAD» o `git status`: 018.18, 018.21, 018.22, 018.25, 019.1 y 019.2 comparan `story-clock.js` o `editor-scenarios.js` con HEAD. Pasan al commitear.
  - **HEAD + este diff con commit simulado** (en el clon, no en el repo): 1600 tests, 83 fallos, **el mismo conjunto que HEAD**. 0 fallos nuevos, 0 arreglados.
- **Suites Chrome previas** (Chrome real, árbol de trabajo):
  - 018.18: 427 ✔ / 0 ✘, igual que la auditoría.
  - 018.21 (dependencias de llegada): 36 / 0.
  - STEP-MESSAGE-001: 86 / 86.
  - FASE 5: 85 / 0.
  - FASE 6: 52 / 0.
  - 018.24: 53 / 0.
  - 019-PRSKIN: 86 ✔ / 8 ✘. Son los **mismos 8 en HEAD**, verificado en el clon de 441a75c: la suite compara el número de elementos con `d4fb06d`, anterior a FASE 5. Es preexistente y ajeno a esta tarea.
- **Mutaciones** (`node test/fluyo-018-29-mutations.cjs`): U 16/16 y B 6/6 detectadas.
  - B13 (el cierre de «terminada» fuera de la reserva) solo se delata con poco alto: va en 844×390, porque en 1280×720 sobrevivía.

## Deuda encontrada (no se toca aquí)

1. **Mensaje de consecuencia de más de una línea**: no se reserva en R1 (ver contrato). En vertical (390×844) el complejo llega a 87 px en el 3.er momento, sin tapar nada. Si se quisiera reservarlo habría que precalcular todos los mensajes de la Historia.
2. **Viewer en teléfono vertical**: zoom 0,33–0,45 y etiquetas de 4–6 px. Es la deuda abierta de 018.18 § 6 («seguir el destino activo»), la siguiente slice recomendada por la auditoría.
3. **El encabezado en apaisado ocupa 109 de 390 px con ruta** (28 %). R1 hace que no tape, pero el diagrama se encoge. Si molesta, la solución es de diseño (una fila para título + puntos, o la ruta junto al mensaje), no de encaje.
4. **El test I1 de STEP-MESSAGE-001** dice «reloj, Viewer y Present sin diff» respecto a HEAD. Ahora falla en el repo con git porque story-clock, viewer y present-story cambian. Es de la familia «idéntico a HEAD» y pasa al commitear.
5. Fuera de G1, saltar **reproduciendo** sigue dejando el cue invisible el primer fotograma (entra con su fade de 140 ms). Es el comportamiento pedido («no alterar seek durante la reproducción»).

## Recomendación

**READY FOR REVIEW.** R1 y G1 quedan resueltos por la causa, con el alcance exacto: solo `present-story.js`, `story-clock.js` y dos líneas de cableado. No cambian el kernel, `render.js`, el MCP ni el formato.

Próximo paso: revisión del PO. Con su OK: commit en `fluyo` (CACHE v103), push y deploy, y después un smoke en producción de Present apaisado y de un seek en pausa. El MCP no necesita sincronizar nada (`story-clock.js` no es kernel). Siguiente CACHE libre tras esto: v104.
