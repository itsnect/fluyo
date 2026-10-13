# FLUYO-018.21 — Dependencias de llegada en Historias

Estado: READY FOR COMMIT (sin commit, push ni deploy)
Owner/agente actual: libre

> Repo público: solo contenido técnico del proyecto open source.

## Objetivo

Que una Historia pueda decir **«este momento no empieza hasta que llegue este envío»** sin retrasar los eventos independientes y sin barrera global. Para ello:

- el motor y el Trace no cambian;
- la duración del viaje sigue siendo presentación;
- el momento sigue siendo atómico;
- las Historias existentes se reproducen igual.

Diseño y decisiones de partida: `.ai/tasks/FLUYO-018.20.md` (v4) y las decisiones del owner D1–D8.

## Decisiones cerradas por el owner

| Decisión | Contenido |
|---|---|
| D1 | Dependencias causales **explícitas** |
| D2 | A nivel de **Historia**, no como campo del Step |
| D3 | **E2**: si un momento espera, la Historia se pausa ahí; lo posterior se desplaza esa espera y conserva su ritmo |
| D4 | El momento es **atómico**: si cualquier Step espera, espera el momento entero |
| D5 | Solo hacia un Step `SEND` **anterior** y válido de la misma Historia |
| D6 | Primero editor y reproducción; **MCP en 018.22** |
| D7 | Contrato del dato: definido abajo |
| D8 | No se infieren dependencias ni se migran Historias |

Se registran como decisiones 168–173 en `.ai/DECISIONS.md`.

## D7 — Contrato del dato (definido antes de escribir código)

```json
"scenarios": [{
  "id": 1, "engineVersion": 2, "name": "…", "nextStepId": 4, "steps": [ … ],
  "arrivalDependencies": [ { "stepId": 3, "waitsForArrivalOf": [1] } ]
}]
```

- **Dónde**: en la Historia (Scenario). **Nunca en el Step**: `validatePersistedStep` y el motor (`invalid_scenario/extra_fields`) rechazan campos extra, y romperían a todos los lectores actuales (comprobado en 018.20).
- **Significado**: el momento del Step `stepId` no se hace visible antes de que llegue visualmente el token de cada `SEND` de `waitsForArrivalOf`.
- **Forma canónica**:
  - entradas ordenadas por `stepId`;
  - en cada entrada, ids únicos y en orden ascendente;
  - sin listas vacías.

  Sin dependencias, **el campo no existe**, así que el documento queda idéntico al de antes.
- **Validez**: se comprueba al reproducir, nunca al abrir.
  - `stepId` existe.
  - Cada id es un Step `SEND` de la misma Historia con `at` **estrictamente menor**.
  - Lo inválido se **ignora**, con una razón: `malformed`, `step_missing`, `send_missing`, `not_send` o `not_earlier`. Nunca bloquea la reproducción ni invalida el documento.
- **Versión**: `version` 5 y `engineVersion` 2, sin cambios. El campo es opcional y los lectores actuales lo conservan.

---

## Validación de diseño (antes de implementar; los números son los que hoy miden los tests)

Viaje «normal» = 1100 ms (`MOTION_MS`). Todo se midió con el Playback real a 1 ms.

| # | Caso | Datos | Resultado medido | Por qué |
|---|---|---|---|---|
| 1 | **Cadena** A→B→C | M1 A→B 0 · M2 «B recibe» 500 (espera a M1) · M3 B→C 1000 · M4 «C recibe» 1500 (espera a M3) | arrival(A→B) **1100** → M2 **1100** (pausa de 600) → M3 **1600** (+500 tras M2: conserva el ritmo) → arrival(B→C) = 1600 + 1100 = **2700** → M4 **2700** | La llegada se mide desde la salida **visible** |
| 1b | Cadena con las esperas por defecto del editor | 0 / 1000 / 2000 / 3000 | 0 · **1100** · 2100 · **3200** | — |
| 2 | **Independiente** | M1 A→B 0 · M2 «X cae» 500 · M3 «B recibe» 1000 (espera a M1) | M2 **500** (no se mueve) · M3 **1100** | E2 solo pausa **desde** el momento que espera. «X cae» va antes: nunca se toca. No hay barrera global. |
| 3 | **Dos llegadas** en un momento | M1 A→B (rápido, 500) y A→C (lento, 1800) · M2 {B recibe → A→B, C recibe → A→C} 1000 | M2 en **1800** | El momento es atómico y espera la **unión**: `max(1000, 500, 1800)`. Con solo la dependencia de C, también 1800. Separados (1000 y 1001): 1000 y 1800. |
| 4 | **Dos Steps, una dependencia** | M1 A→B 0 · M2 {X cae, B recibe → M1} 500 | M2 entero en **1100**, también «X cae» (su `at` sigue siendo 500) | Atómico: «X cae» está en el mismo momento que algo que espera. Si debe caer a los 500, va en su propio momento (caso 2). El editor lo dice: «Este momento (2 eventos) no empieza hasta que llegue…». |
| 5 | **Dependencia inválida** (a un `SEND` eliminado y otras ocho formas) | `waitsForArrivalOf:[77]`, de un Step eliminado, a un no-`SEND`, del mismo momento, hacia delante, id no entero, lista rota, campo que no es lista, entrada nula | Se reproduce **igual que sin dependencias**; se ignora con su razón | Nunca bloquea ni rompe. El editor, al eliminar un Step, ya limpia las dependencias que lo nombran. |
| 6 | **Ciclo** A↔B | `1 → 3` y `3 → 1` | 0 · 1100 (solo vale `3 → 1`; `1 → 3` → `not_earlier`). En el mismo momento, las dos se ignoran. | Solo cuentan envíos de momentos **anteriores**: el ciclo es imposible por construcción y el cálculo es una sola pasada. No hay tiempos infinitos. |
| 7 | **Historia antigua** (sin el campo) | Las 6 Historias v2 de `test/fixtures/*.fluyo.json` | **Idéntica fotograma a fotograma** a la reproducción anterior (`schedule.shifted = false`; el Trace ni se copia) | No se infiere nada de las conexiones: sin el campo, la cadena del caso 1 se ve en 0 / 500 / 1000 / 1500. |
| — | Varios envíos | Un paso espera a un envío lento (llega 1800) y a uno rápido (llega 800) | 1800 | La llegada más tardía |

El criterio de éxito (A → B; M1 A envía · M2 X ocurre · M3 B recibe, que espera a M1) se cumple: **M1 → viaje → M3 en 1100, y M2 conserva sus 500**. Medido en vm y en Chrome real: «X cae» se ve a los 501–502 ms con el token en vuelo, y «B recibe», a los 1101–1102 ms.

---

## Qué se hizo

| Archivo | Capa | Cambio |
|---|---|---|
| `js/story-clock.js` | Reproducción (fuera del kernel) | `arrivalDependencies` (lectura tolerante + razones), `arrivalCandidates`, `stepWaits`, `momentWaits`, `pruneArrivalDependencies`, `withArrivalWait`, `withoutArrivalWaits`, `copyArrivalWaits` (autoría pura, forma canónica). `travelMs` (la misma regla que `sendDuration` del Playback). `schedule` (E2: instante visible por momento, llegadas, qué espera cada momento). `visibleTrace` (copia del Trace con `at` visible y `narrativeAt`). `start` = `FluyoStory.start` + horario + copia **solo si algo se desplaza**. `visibleAt`. `momentTimes(sc, playback)` (visibles con reproducción; narrativos sin ella). `seek` por instantes visibles. `describe` (momento en curso visible). |
| `js/editor-scenarios.js` | Editor | `scRun` → `FluyoStoryClock.start`; `scVisibleAt`; filas, seguimiento, rótulo, ⏮/⏭ y encuadre del momento con instantes visibles (el momento se identifica por su `at` narrativo). Menú de la aparición: «Esperar a que llegue…». La línea de tiempo dice en el momento «No empieza hasta que llegue «…» (origen → destino)». Eliminar limpia; duplicar copia; todo con `pushUndo`. |
| `js/present-story.js` | Present | `describe` con el momento visible (una línea) |
| `js/viewer.js` | Viewer | `FluyoStoryClock.start`, `momentTimes(sc, playback)`, `describe` visible y encuadre del momento por `at` narrativo |
| `css/styles.css` | UI | `.scWaits`: una línea en el oliva del estado activo |
| `sw.js` | Release | `CACHE` v78 → **v79** (cambian archivos servidos; ninguno nuevo) |
| `.ai/ARCHITECTURE.md`, `.ai/DECISIONS.md` | Documentación | Sección «Dependencias de llegada»; decisiones 168–173 |
| `test/fluyo-018-21*.cjs` | Tests | Unitarios, Chrome y mutaciones nuevos |
| 30 tests históricos | Tests | Ver la nota siguiente |

Nota sobre los tests históricos: se actualizó `fluyo-static-v78` → `v79`, igual que en cada subida de `CACHE`. Además:

- `fluyo-018-18.test.cjs`: el literal de `scRun` pasa a `FluyoStoryClock.start(P(), sc, scNow())`.
- `fluyo-014.test.cjs`: «una sola receta» ahora comprueba que el Viewer usa `FluyoStoryClock.start` **y** que este llama a `FluyoStory.start` sin `runScenario`/`makePlayback`; Present usa `describe` a través de `FluyoStoryClock`.

**Sin cambios**: motor (`scenario-engine.js`), Trace, `scenario-playback.js`, `story-playback.js`, `document-integrity.js`, `story-authoring.js`, `model.js`, `config.js`, render, geometría, exportación, `state.js`, `selection.js`, Share (`share-url.js`, `link-codec.js`), `index.html`, `s/index.html`, formato y fluyo-mcp. El test de alcance lo comprueba contra HEAD.

### UX

- **Dónde**: el menú de cada aparición (⋯ o tocar la fila) › sección *Historia* › **«Esperar a que llegue…»**.
- **El submenú** se titula «Este momento no empieza hasta que llegue…», o «Este momento (N eventos) no empieza…» si el momento tiene varios.
  - Lista solo los `SEND` válidos de momentos anteriores, primero los que llegan a donde ocurre el evento, cada uno con «origen → destino».
  - Los que ya espera llevan ✓ (pulsarlo quita la espera).
  - «No esperar» quita todas.
  - En el primer momento, o si no hay envíos anteriores, la opción aparece deshabilitada con «Antes tiene que haber un envío».
- **En la línea de tiempo**, bajo la espera del momento: «No empieza hasta que llegue «📨 Request» (A → B)».
- **Aviso al declarar**: «Este momento no empezará hasta que llegue «📨 Request».».
- Undo/Redo de una entrada.
- Capturas de escritorio 1440 y móvil 390: `d1440-dependencia.png` y `m390-dependencia.png` (FLUYO_SHOTS).

---

## Pruebas (dirigidas; sin batería histórica)

| Suite | Qué cubre | Resultado | Tiempo |
|---|---|---|---|
| `node --test test/fluyo-018-21.test.cjs` | Casos 1–7, varios envíos, motor/Trace intactos, salto = reproducción continua, formato con kernel del MCP y Share, autoría pura, editor real con Undo/Redo real, eliminar/duplicar, reproducir/pausar/saltar, Viewer, Present, alcance, release, integración | **20/20** | **1,4 s** |
| `node test/fluyo-018-21-browser.cjs` (Chrome real) | Crear la dependencia desde el menú con ratón (1440) y con el dedo (390); Undo/Redo con Ctrl+Z/Ctrl+Y; reproducir comprobando **cada fotograma** (≈ 196) que «B recibe» nunca se ve con el token en vuelo y que «X cae» sí se ve con el token en vuelo; pausar/reanudar; ⏮/⏭; Present (puntos, título, ⏭); Viewer (`/s/#d=` con la dependencia, progreso, pausa, ⏭) | **36/36**, sin errores de consola | **22 s** |
| `SKIP_BROWSER=1 node test/fluyo-018-21-mutations.cjs` | 16 mutaciones unitarias | **16/16 detectadas** | 33 s |
| `ONLY_MUT=B node test/fluyo-018-21-mutations.cjs` | 2 mutaciones en Chrome | **2/2 detectadas** | 25 s |

Mutaciones (sobre copias aisladas):

| Familia | Mutaciones |
|---|---|
| Dependencia ignorada | U1, B1 |
| Llegada demasiado pronto | U2 (desde la salida narrativa), U3 (viaje recortado) |
| Llegada demasiado tarde | U4 (cuenta el pulso de llegada) |
| Dependencia en el momento incorrecto | U5 |
| Momento no atómico | U6 |
| Independiente desplazado (barrera global) | U7, B7 |
| Sin pausa (E1) | U8 |
| Ciclo no controlado (esperas hacia delante o del mismo momento aceptadas) | U9 |
| `SEND` inexistente aceptado | U10 |
| Cualquier envío como candidato | U11 |
| Trace sin proyectar | U12 |
| Eliminar deja dependencias colgando | U13 |
| Viewer o Present con instantes narrativos | U14, U15 |
| Historia antigua inferida desde las conexiones | U16 |

Tests históricos ejecutados, solo los que tocan archivos cambiados (unitarios, segundos):

| Test | Resultado |
|---|---|
| `fluyo-018-18.test.cjs` | 13/13 |
| `fluyo-014.test.cjs` | 18/18 |
| `fluyo-013.test.cjs` | 11/11 |
| `fluyo-018-19.test.cjs` | 12/13 |

El fallo de `fluyo-018-19.test.cjs` es su test de **alcance contra HEAD** («story-clock, Viewer… idénticos a HEAD»): compara el árbol de trabajo con el commit anterior y vuelve a pasar en cuanto se commitee 018.21. No se ejecutaron las baterías históricas completas ni sus pasadas de Chrome.

**MCP real (sin modificarlo):**

- `describe_document` lee como **válida y ejecutable** una Historia con `arrivalDependencies` (`kernelId cbb6ec00…`, el del repo).
- `author_document` (`set_wait`) devuelve el documento **con el campo intacto**.
- En vm: `FluyoAuthoring.normalizedProject`, `add_step`, `set_wait` y `rename_story` lo conservan, y «Compartir historia» (`#d=`) también.

Cómo ejecutar Chrome: `NODE_PATH=<carpeta con playwright-core> node test/fluyo-018-21-browser.cjs` (Chrome instalado; `FLUYO_BROWSER=chrome` por defecto). `playwright-core` no está en el repo: se usó una copia en el scratchpad de la sesión.

---

## Qué necesitará 018.22 (MCP) — contrato, no implementado

1. **Kernel**: el MCP necesita la misma regla de validez.
   - **Opción A** (recomendada): añadir `story-clock.js` a los archivos del kernel que copia fluyo-mcp (`scripts/sync-kernel.ts`, `KERNEL_FILES`, nuevo `KERNEL_ID`). Es puro, depende solo de kernel (`storyboardGroups`, `FluyoStory`, `FluyoScenarioPlayback`) y daría también los instantes visibles.
   - **Opción B**: mover `arrivalDependencies` / `arrivalCandidates` / `canonical` a `model.js`, y que `story-clock.js` los use.
2. **`FluyoAuthoring`** (`story-authoring.js`):
   - `add_step` + `waitsForArrivalOf?: (StepId | {ref})[]`;
   - **nueva operación** `set_arrival_dependencies {scope:"story", pageIndex, storyId, stepId, waitsForArrivalOf:[…]}`, que reemplaza la lista (`[]` la borra);
   - `remove_step` limpia las dependencias del Step y las que lo nombran (`changes[].dependenciesRemoved`);
   - `duplicate_step` copia la espera;
   - `move_step` / `set_wait` las conservan, aunque pueden volverse inválidas, lo que se informa como aviso;
   - rechazo `INVALID_ARRIVAL_DEPENDENCY {stepId, sendId, reason: send_missing|not_send|not_earlier}`;
   - todo sobre el estado final del lote, como B2.
3. **`describe_document`**: `waitsForArrivalOf` por paso y `waitsFor` por momento (la unión), más las ignoradas con su razón.
4. **`run_story`**: Trace **sin cambios**. Opcional: `visibleAt` por momento, marcado como presentación.
5. **Descripción de las herramientas y `unmodeled`**: explicar que una dependencia de llegada es de presentación («el momento no se ve antes de que llegue el envío»); el motor no la ve y no es latencia. Que el agente la declare cuando un evento representa una llegada.
6. **Tests en fluyo-mcp**: golden de una Historia con dependencias; paridad de `schedule` con el editor; `sync:kernel` y `check:kernel`.
7. **Hoy**, el MCP desplegado ya **lee y conserva** el campo, pero no lo muestra ni lo crea. `remove_step` del MCP actual puede dejar una dependencia colgando; es inofensivo, porque se ignora al reproducir.

---

## Riesgos

1. **`story-clock.js` sustituye `playback.trace` desde fuera del kernel.** Depende de que el Playback lea el Trace solo en `tick`/`isFinished` (hoy es así). U12 y el caso 7 lo vigilan.
2. **La duración del viaje se calcula en dos sitios** (`travelMs` y `sendDuration`, con la misma regla). Los tests miden las llegadas pintadas; U3/U4 detectan una desalineación.
3. **Dependencias que dejan de aplicar al reordenar.** Se conservan, pero se ignoran: la línea de tiempo y el menú solo muestran las válidas, así que una espera puede «desaparecer» al mover un paso detrás de su envío. Es coherente con D5, pero conviene vigilarlo en uso real.
4. **`model.js` no normaliza el campo.** Un valor mal formado que venga de fuera se conserva tal cual (se ignora al reproducir) hasta que el editor lo reescriba en forma canónica al editar una espera.
5. **Clientes con la caché anterior (v78)** ven la Historia sin esperas (comportamiento anterior) y conservan el campo al guardar.
6. **«Usar otro evento aquí»** puede convertir el envío esperado en un evento que no es `SEND`; la dependencia queda ignorada (no se borra).
7. **El registro del Trace del editor** (Detalles) muestra tiempos de reproducción, es decir, visibles. Es intencionado, porque es un registro de lo que se ve.

## Handoff

- **Próximo paso**: revisión del owner y commit de 018.21. Entra en el mismo commit `.ai/tasks/FLUYO-018.20.md` (diseño), que no estaba commiteado. Después, 018.22 (MCP) con el contrato de arriba; el panel de escritorio sigue aplazado.
- No hay commit, push ni deploy.

# FLUYO-018.21 — READY FOR COMMIT
