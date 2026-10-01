# FLUYO-013 — Present: presentar una Historia

Estado: FLUYO-013 — APPROVED (QA independiente hecha, 2 defectos P1/P2 corregidos); sin commit ni push
Owner/agente actual:

## Objetivo
Pasar de «estoy editando una historia» a «estoy presentando esta historia a otra persona»: Canvas + Historia + Playback en una superficie limpia, sin la complejidad del editor, reutilizando por completo el Playback existente.

## Problema
Fluyo ya tenía un modo Presentar (`P` / «▶ Presentar»): pantalla completa y una página por diapositiva, sin relación con los Scenarios. Para contar una Historia había que quedarse en el editor (panel de Historia visible, controles técnicos, pestaña de Scenarios).

## Modelo mental
`EDITOR → PRESENT (ready) → PLAYING → FINISHED`; `PLAYING → Detener → PRESENT`; `PRESENT / FINISHED → Salir / Volver a editar → EDITOR`.
Present decide **cómo se presenta**, nunca **qué ocurrió**. Es read-only.

## Alcance (slice mínimo)
- Reutiliza el modo Present existente (`enterPresent`/`exitPresent`, `body.presenting`): ya oculta editor, panel, rail y pestañas y encaja el diagrama.
- Con Historia en la página activa, la barra muestra **▶ Reproducir / ■ Detener / ↻ Repetir / ← Volver a editar / ✕ Salir**.
- Encabezado ligero (`#presentStory`): nombre de la Historia → nombre del momento en curso, puntos de progreso (≤ 12; si no, «n / total»), mensaje humano de consecuencia y cierre.
- Encaje con aire y hueco reservado para encabezado y barra (`fitViewPresent`); re-encaje en resize.
- Teclado: Espacio/Enter reproduce o repite; Esc detiene y, ya detenido, sale.

## Fuera de alcance
Timeline, scrubber, seek, pausa, velocidad, varios escenarios, Share/Viewer, schema, «Ver en la historia» (no se reutiliza sin ampliar el scope), analytics nuevos.

## Arquitectura
- `js/present-story.js` (nuevo, script clásico, tras `editor-scenarios.js`): `FluyoPresentStory` (puro: `moments`, `currentIndex`, `caption`, `failedCount`, `summary`) + `presentPhase()` (derivada de `scStatus`), `presentPlay/Stop`, `presentStoryRefresh()`, `fitViewPresent()`.
- **Sin segundo motor ni estado de fase propio**: `presentPlay()` llama a `scRun({present:true})`; la fase es `idle/running/completed` de `scStatus` traducida a ready/playing/finished. Tokens, cues, fill, dim, pulse y movimiento los pinta el Canvas existente (`buildScenarioRenderState`).
- `scRun(opts)` gana `opts.present`: no cambia la pestaña del panel. `scReset`, `scTick` (cada fotograma y al terminar) y el error de `scRun` llaman a `presentStoryRefresh()` (guardado con `typeof`).
- `ui.js`: `exitPresent` y `goSlide` hacen `scReset()` si hay playback (limpia RAF, playback, cues y el bloqueo de pestaña); `enterPresent` quita el foco del botón Presentar y encaja con `fitViewPresent`.
- `interaction.js`: teclas descritas arriba; un botón de la barra enfocado gestiona su propia tecla.
- `index.html` / `css/styles.css`: botones `psPlay/psStop/psEdit` y `#presentStory`. `sw.js`: precache de `present-story.js`, **CACHE v56**.
- No se tocó `scenario-engine.js`, `scenario-playback.js`, `model.js`, schema (sigue v5), EventTypes, Trace ni Viewer.

## UX
- Antes de reproducir: diagrama centrado, título de la Historia en tenue y barra con «▶ Reproducir» destacado. La barra está a plena opacidad fuera de la reproducción; durante ella se aparta.
- Durante: la escena cuenta la historia; el encabezado sólo nombra el momento y muestra progreso.
- Consecuencias en lenguaje humano: «Kafka no está disponible», «No se completó · Kafka no está disponible», «X vuelve a estar disponible». Nunca `SEND`, `UP/DOWN`, `target_down`.
- Final: «Reproducción terminada»; si hubo eventos que no se completaron, «N evento(s) no pudo/pudieron realizarse» como línea secundaria (no es un error de Fluyo).
- **Decisión de UX documentada**: en una página **sin Historia**, Present sigue siendo el modo de diapositivas de siempre (no se rompen `P`, enlaces ni demos) y **no se crea ningún Scenario**; sólo no aparece «Reproducir». No se inventó una pantalla de aviso; si producto la prefiere, es un cambio acotado en `presentStoryRefresh`.
- Con pantalla completa, el navegador consume el primer Esc para salir de fullscreen y `fullscreenchange` ejecuta `exitPresent` (sale de Present directamente). Fullscreen no es requisito: Present funciona sin él.

## Estados / integridad
Present no escribe: sin `pushUndo`, sin `scheduleAutosave`, sin tocar `steps`, EventTypes ni `scActiveId`. El smoke compara `serializeProject()` + pilas de undo/redo + Steps antes y después de cada salida.

## Compatibilidad
Documentos v5 existentes; EventTypes sin `motion`/`presentation` (el smoke los borra y reproduce); `showIcon` histórico intacto (no se toca). Un evento sin nombre da un momento sin etiqueta (el título cae al nombre de la Historia).

## Tests
- `test/fluyo-013.test.cjs` (11, unit/contrato): helpers puros, lenguaje humano, expiración del mensaje, cierre, motor/playback intactos, assets/SW, limpieza en `exitPresent`/`goSlide`, Present sin escritura.
- `test/fluyo-013-browser.cjs` (Chrome real vía Playwright por NODE_PATH; acepta `playwright-core`): sin Historia (no crea Scenario); Cliente→Comercio con 💵 Pago + simultáneo + mensaje «Pago recibido» + duración breve; Producer→Kafka→Consumer con indisponibilidad (2 eventos no realizados); Repetir, Detener, Esc, Salir durante la reproducción, Volver a editar; residuos (RAF, playback, pestaña bloqueada, `body.presenting`); integridad; viewports 1366×768, 1920×1080, 768×1024 y 390×844 (sin scroll horizontal, barra y encabezado dentro, diagrama no tapado); documento antiguo. Capturas fuera del repo (`FLUYO_SHOTS`).
- Suite completa `node --test test/*.test.cjs`: **411/411**. `share-browser.cjs` pasa.
- Preexistente e independiente: `fluyo-011-browser.cjs` falla 4 subtests **también en HEAD** (etiquetas de menú renombradas en 012.1: «Aplicar también a…» / «Añadir otro evento al mismo tiempo…», y el test de upgrade del SW). No se tocó; sólo se actualizó su constante de caché a v56.

## Riesgos
- En táctil con varias páginas, tocar el canvas avanza de diapositiva (comportamiento previo en `interaction.js`) y por tanto detiene la Historia.
- `psSet` evita escrituras DOM redundantes por fotograma; los campos nuevos deben pasar por él.
- Momentos con varios eventos simultáneos se nombran con « · » (largo: parte con `overflow-wrap`).
- No se probó manualmente en pantalla táctil real ni en fullscreen real (headless).

## Criterio de producto (A–H)
A sí: barra «Reproducir / Salir» y título; sin editor. B sí: lenguaje humano, sin términos del motor. C sí: el Canvas ocupa la escena; el encabezado es un velo pequeño. D sí: momentos y mensajes, no parámetros. E sí: snapshot idéntico (documento, Steps, undo). F sí: «No se completó · Kafka no está disponible» y cierre secundario. G sí: probado sin solapes. H sí: `scRun` único; `FluyoPresentStory` sólo traduce.

## Próximo paso
Revisión de producto manual con `P`; decidir si «sin Historia» merece un aviso explícito y si «Ver en la historia» entra en un slice posterior. No iniciar FLUYO-014.

---

# QA independiente y adversarial — veredicto: **FLUYO-013 — APPROVED**

Entorno: Windows 11, Chrome del sistema (headless) vía `playwright-core` instalado **fuera del repo** (scratchpad, `NODE_PATH`), Node 22.18. Sin dependencias nuevas en el proyecto. No existe `.ai/tasks/FLUYO-012.1.md` (012.1 está dentro de `FLUYO-012.md`); se leyó ahí.

## Arquitectura (refutación intentada, no refutada)
Present no tiene segundo motor: `grep` de `runScenario|makePlayback|requestAnimationFrame|setInterval|createStep|pushUndo` en `present-story.js` → 0 (lo vigila `fluyo-013.test.cjs`). La única ejecución es `scRun` (misma función que el editor); no hay timers propios; la fase es `scStatus`; la duración visual sigue siendo `scenario-playback.js`. Paridad medida en Chrome: para 5 historias (simple, simultánea, con espera, con fallo, con efectos) el **Trace, el log, `stepMeta` y los estados finales son byte a byte idénticos** entre Editor y Present.

## Defectos encontrados y corregidos
| ID | Sev. | Pasos | Esperado | Actual | Causa raíz | Corrección | Test |
|---|---|---|---|---|---|---|---|
| D1 | P1 (cambia el estado del editor) | `enterPresent(); exitPresent()` en el mismo fotograma (o con `resize` entre medias) con la vista del editor en (33,44,×1.3) | La vista del editor no cambia | Tras salir, la vista pasa a (9,41,×1.15): el encaje diferido `scheduleEditorResize(fitViewPresent)` corría **después** de `exitPresent` | `fitViewPresent` no comprobaba `presenting` | `if(!presenting) return;` al inicio de `fitViewPresent` (`present-story.js`) | `fluyo-013-qa-browser` bloque 10/19 + unit «QA D1» |
| D2 | P2 (móvil) | 390×844, estado «listo» con Historia | Barra de una fila, 50 px | Barra partida en 2 filas (94 px) y encabezado estrecho: con `left:50%` el ancho shrink-to-fit se limita a media pantalla (195 px) y la reserva inferior (76 px) quedaba corta → un diagrama alto quedaba bajo la barra | CSS: faltaba `width:max-content` | `#presentBar` y `#presentStory` con `width:max-content` (+ `max-width` existente) | bloque 13/14/15 (diagrama alto @390), unit «QA D2» |
Ambos son bugs propios de FLUYO-013 (código de `present-story.js`/CSS nuevo). SW **no** se subió: sigue v56, que es la versión introducida por 013 y aún no publicada.

## Hallazgos sin corregir (no son defectos de 013 o son decisiones)
- **P2 (producto, ya documentado):** página con Historia no vacía **pero** `engineVersion` incompatible: se ofrece «Reproducir» y al pulsarlo se dice «Este escenario usa una versión de ejecución no soportada.»; no se ejecuta nada ni queda estado parcial (verificado). El editor deshabilita el botón; Present no. Candidato a ocultar «Reproducir» en un slice posterior.
- **P3:** `getBounds()` no incluye los overlays (burbujas de mensaje sobre un nodo): con un diagrama que llene la escena, una burbuja sobre la fila superior puede quedar bajo el encabezado. No reproducido como defecto en las capturas (hay ≥84 px de hueco), pero es el límite de la estrategia «sin segunda geometría».
- **P3:** el foco de teclado se pierde cuando el botón enfocado (Reproducir/Detener) se oculta al cambiar de fase.
- **Histórico (no tocado):** el toque en el lienzo avanza de diapositiva (`interaction.js`); en una sola página es no-op; con varias páginas detiene la Historia (verificado con `hasTouch`). Presente anterior verificado sin regresión: `P`, ←/→/Home/End, botones, tap, `Espacio` avanza (sin Historia), Esc sale, vista restaurada. Cambio **de 013** visible en el presente histórico: con una sola página ya no se muestra «1 / 1» ni las flechas (ocultas); es intencional.
- **Fullscreen:** en Chrome headless `requestFullscreen` entra; Esc físico lo gestiona el navegador y no se puede simular por CDP. Se probó `document.exitFullscreen()` (equivale al primer Esc): dispara `fullscreenchange` → `exitPresent` → limpieza total, sin residuos. Es decir, con pantalla completa activa el primer Esc **sale de Present**, no solo detiene la reproducción; Esc con `presenting` pero sin fullscreen sí detiene primero. Documentado, no se cambió.

## Verificación
- `node --test test/*.test.cjs`: **413/413**. `node --check js/*.js sw.js`: OK. `git diff --check`: sin errores (solo avisos LF→CRLF).
- **Browser (todos ejecutados de verdad):** `fluyo-013-browser` OK; `fluyo-013-qa-browser` 14 bloques PASS (exit 0); `scenario-qa-browser` PASS; `share-browser` (viewer + editor inline) OK; `share-post-qa-browser`, `qa-share-hash-browser`, `share-realistic-size-browser` exit 0; `fluyo-011-manual-smoke` 12/12.
- `fluyo-011-browser`: 4 subtests fallan **igual que en HEAD** (verificado extrayendo HEAD a un directorio aparte): menús renombrados en 012.1 y upgrade del SW. No es regresión de 013.
- Cobertura QA: integridad (documento, steps, IDs/contadores, settings, undo/redo, `cur`) tras Play/Stop/Repeat/Play/Exit; entrada (sin Scenario, vacío, varios, engine 99); Stop/Repeat/Exit al inicio, mitad y final en 3 historias; carreras (Stop→Play y Exit→Play síncronos, Repeat×2, resize, cambio de página, `P`, 6 ciclos abrir/cerrar con tiempos variables); sin acumulación de tokens/mensajes ni aceleración (duraciones estables ±700 ms); lenguaje humano (regex negativa sobre todo el texto mostrado); progreso monótono, simultaneidad = 1 momento, Stop limpia, Repeat reinicia; teclado (Espacio/Enter/Esc/`P` en cada fase; no re-arrancan; botón enfocado gestiona su tecla); compatibilidad (sin `motion`, sin `visualDuration`, `showIcon` histórico: el JSON del documento y el undo no cambian); SW: caché solo v56 (v55 eliminada), `present-story.js` precacheado, Present y viewer funcionan **offline** tras reload.
- **Viewports** 1366×768, 1920×1080, 768×1024, 390×844 × diagramas pequeño (1 nodo), mediano (8), grande (24), ancho (12 en fila), alto (12 en columna), con overlays y simple: sin scroll horizontal/vertical, barra y encabezado dentro del viewport, diagrama no tapado ni cortado, botones Detener/Salir accesibles, estado «terminado» a 390 px en una fila. Capturas revisadas.

## Mutaciones (en copias; el árbol final no tiene ninguna)
Detectadas: M1 saltar `scReset` al salir (unit + smoke), M2 no cancelar RAF (QA), M3 no limpiar playback (unit + smoke), M5 modificar un Step al entrar (smoke), M6 modificar el Trace (smoke), M7 crear Scenario si no existe (smoke), M8 sin limpieza al cambiar de página (unit), M9 `scReset` sin volver a idle (unit), M10 reutilizar runtime anterior (QA), M11 undo al entrar (smoke), M12 pestaña Propiedades bloqueada tras reset (smoke), M14 doble playback (sin guards de `presentPlay`, `scRun` ni cancelación de RAF) (QA, tras endurecer el test). M4 (solo quitar la cancelación de RAF) y M13 (quitar los guards de `scRun`+RAF) **sobrevivían** porque `presentPlay` tiene su propio guard (defensa en profundidad, mutantes equivalentes desde Present); se endureció el test de bucles `scTick` por fotograma y M14 ya se detecta.

## Riesgos restantes
Los de «Hallazgos sin corregir». No se probó en táctil físico ni con Esc físico en fullscreen real.

## Archivos tocados por la QA
`js/present-story.js` (D1), `css/styles.css` (D2), `test/fluyo-013.test.cjs` (+2), nuevo `test/fluyo-013-qa-browser.cjs`.
