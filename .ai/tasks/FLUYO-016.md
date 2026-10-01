# FLUYO-016 — Historias como entidad de primer nivel

Estado: READY FOR COMMIT (016 + QA + 016.1) — sin commit ni push
Owner/agente actual: Claude Code

> Repo público: contenido apto para publicarse (AGENTS.md §9).

## 1. Estado actual (verificado en código)

- El modelo ya permite N `scenarios[]` por página (`page.scenarios`, `nextScenarioId` por página). Un Scenario = `{id, engineVersion, name, nextStepId, steps[]}`. **Los ids de Scenario y de Step son por página / por Scenario, no globales.**
- La UX lo trata como «un Scenario activo»: cabecera `Elegir escenario ▾` + `⋯` (Nuevo escenario, Renombrar, Eliminar escenario, Condiciones iniciales, Detalles técnicos). Lenguaje técnico visible (`Escenario`, `Crear escenario`).
- Línea base: `node --test test/*.test.cjs` = 456/456. SW `fluyo-static-v59`.

## 2. Cómo se representan hoy varios Scenarios

`doc.pages[i].scenarios[]`, en orden de array. No hay otra colección (`stories[]` no existe y no se crea). `createScenario`/`deleteScenario` (model.js) son las únicas fábricas; `normalizeScenarios` valida ids únicos y contadores que no bajan. No existe «duplicar»: hay que añadirlo al modelo (puro, sin DOM).

## 3. Cómo se selecciona el activo

`scActiveId` (editor-scenarios.js) es **estado efímero del editor** (no está en el documento ni en el `.fluyo.json`). `scActiveScenario()` busca `scActiveId` en la página actual y, si no está, cae en `scenarios[0]`.

Defectos encontrados (a corregir en esta tarea):
1. **Cambio de página**: `doc.cur=i` no toca `scActiveId`. Como los ids son por página, el id 2 de la página 1 «selecciona» el Scenario con id 2 de la página 2 (arbitrario), en vez de una Historia válida elegida a propósito.
2. Tras `undo`/`redo`, `scActiveId` puede apuntar a una Historia que ya no existe (hoy lo tapa el fallback a `scenarios[0]`).
3. `scSwitchScenario` no limpia `scSelectedStep`/`scContext`; los ids de Step sólo son únicos dentro de una Historia, así que un `scSelectedStep` heredado puede marcar un Step de otra Historia.

## 4. Cómo se comparte hoy

`createShareUrl(project, base, {kind, scenarioId})` → `applyShareKind` opera sobre la copia normalizada:
- `"diagram"`: vacía `scenarios` de **todas** las páginas.
- `"story"`: sube el Scenario activo a `scenarios[0]` de la página abierta, **pero deja todas las demás Historias** de esa página y de las demás páginas en el enlace (se pueden recuperar abriendo el JSON del enlace). Esto es lo que FLUYO-016 corrige.
- `editor-share.js#shareStory()` usa `scActiveScenario()` con pasos.

## 5. Cómo Present decide qué reproducir

`present-story.js`: `presentHasStory`/`presentPlay`/`presentPhase` leen `scActiveScenario()` y `scStatus`; `scRun({present:true})`. Cambiar de diapositiva (`goSlide`) hace `scReset()`. Ya reproduce «la Historia seleccionada»; no necesita cambios más allá de que la selección sea correcta por página.

## 6. Cómo Viewer decide qué reproducir

`viewer.js#storyScenario()` = `doc.pages[doc.cur].scenarios[0]` con pasos. No hay selector. Por tanto **un Share legacy con N scenarios reproduce `scenarios[0]`** (lo que ya hacía) y un Share nuevo, que lleva una sola Historia, la reproduce exactamente.

## 7. Estado del editor vs. documento

| Dato | Dónde |
|---|---|
| Historias (`scenarios[]`), Steps, nombres | **Documento** (por página) |
| EventTypes | **Documento** (`doc.eventTypes`, del proyecto) |
| Historia activa (`scActiveId`), `scSelectedStep`, `scStatus`, `scPlayback`, placement | **Editor, efímero** |

No se añade `activeScenarioId` al documento.

## 8. Propuesta de UX

Cabecera del panel:

```text
HISTORIAS
[ ● Camino feliz ▾ ] [+] [⋯]
[ ▶ Reproducir ]
```

- El selector lista las Historias de la página con `●` (activa) / `○`; al final «+ Nueva historia».
- `[+]` crea al instante «Historia N» (primer número libre), sin modal, y la selecciona.
- `⋯`: Renombrar · Duplicar historia · Eliminar historia · Condiciones iniciales de esta página · Detalles.
- Sin Historias: estado vacío «Aún no hay historias» + botón «+ Nueva historia» (y arrastrar un evento sigue autocreándola).
- Duplicar: «X copia» (si ya existe, «X copia 2»…), inserta justo después del original, copia Steps (mismos EventTypes), selecciona la copia; 1 `pushUndo`.
- Eliminar: confirmación nativa con el nombre y nº de momentos («Eliminar la historia «B»? Los eventos de la biblioteca se conservan»). Selecciona otra (la vecina) y limpia Playback. Con una sola Historia se puede eliminar: el modelo ya permite cero y existe auto-creación.
- Toda acción estructural (cambiar, nueva, duplicar, eliminar, renombrar) detiene el Playback antes de actuar (`scReset`): sin restos visuales.
- Share: «Compartir historia» + nombre de la Historia seleccionada; «Compartir sólo el diagrama» sigue.
- Viewer: etiqueta pequeña «Historia» sobre el nombre.
- Vocabulario visible: Historia / Nueva historia / Duplicar historia / Renombrar / Eliminar. Nada de «escenario», `scenario`, `step`.

## 9. Compatibilidad

- **Documento**: sin cambio de schema (v5), sin `stories[]`. Documentos antiguos con 0/1/N scenarios abren igual (`Escenario 1` conserva su nombre).
- **Share nuevo**: lleva **sólo** la Historia seleccionada (en la página abierta, como `scenarios[0]`) y **ninguna Historia de otras páginas**; el resto de páginas viaja con `scenarios: []`. Los EventTypes del proyecto viajan completos (son vocabulario del proyecto, como hoy).
- **Share legacy** (`scenarios[]` con N): sin cambios en Viewer → se reproduce `scenarios[0]`, como antes. Documentado: sólo cambia lo que el editor *genera*.
- `createShareUrl` sin `options` conserva el comportamiento anterior (copia tal cual); el editor siempre pasa opciones. Con `kind:"story"` y un `scenarioId` que no existe en la página abierta no se comparte ninguna Historia (falla cerrado, no fuga).

## 10. Tests (`test/fluyo-016.test.cjs`, `test/fluyo-016-browser.cjs`)

Unit (vm): modelo (duplicar: ids nuevos, original intacto, nombre, 100+ Steps, nombres repetidos, engine incompatible, vacía), selección por página, Share (A/B/C, sólo lo seleccionado, otras páginas vacías, file://, localhost, producción), legacy (N, 1, doc antiguo), Viewer (reproduce la compartida, sin otras), Undo/Redo de cada operación, auto-creación, mutaciones. Browser (Chrome real): flujos de panel, Playback al cambiar/borrar/duplicar, Present, Share→Viewer, reload, Back/Forward, offline, responsive.

## 11. Riesgos

- Ids de Scenario/Step no globales → toda selección debe estar ligada a la página/Historia (§3).
- `scenario-playback`/`story-playback`/engine NO se tocan: sin loops nuevos.
- Los EventTypes de Historias no compartidas siguen viajando (vocabulario del proyecto). Documentado, no se poda para no cambiar el contrato de `nextEventTypeId`.
- Undo es por página (`snapPage`): crear/duplicar/eliminar/renombrar son una operación; cambiar de Historia no es una operación de Undo (estado de editor).
- Tests antiguos que fijan «Crear escenario»/«Escenario 1» deben actualizarse al nuevo vocabulario.

## Decisiones derivadas (para DECISIONS.md al cerrar)

Ninguna requirió detenerse: formato de Share, legacy, última Historia y selección entre páginas se derivan del modelo actual y de la especificación.

## Handoff

### Qué se hizo
- **Modelo** (`js/model.js`): `defaultScenarioName`, `copyScenarioName`, `duplicateScenario` (puros). Sin schema nuevo.
- **Panel** (`index.html`, `css/styles.css`, `js/editor-scenarios.js`): cabecera «HISTORIAS · [● nombre ▾] [+] [⋯]»; `+` crea «Historia N» al instante; menú ⋯: Renombrar · Duplicar historia · Eliminar historia · Condiciones · Detalles; selector con ●/○ y «+ Nueva historia»; estado vacío; pestaña «Escenarios» → «Historias»; textos visibles sin «escenario».
- **Selección**: `scSelectStory` (único punto) + `scSyncPage` (desde `renderTabs`, `js/ui.js`): la Historia activa es del editor y de la página; al cambiar de página/documento se descarta. Corrige el defecto de ids por página.
- **Playback**: cambiar/nueva/duplicar/eliminar/renombrar detienen y limpian antes de actuar; `scRun` ya no arranca una Historia vacía.
- **Share** (`js/share-url.js`, `js/editor-share.js`): el enlace nuevo lleva sólo la Historia seleccionada (ninguna otra, tampoco de otras páginas); sin Historia con momentos → sólo diagrama. **Viewer** (`js/viewer.js`, `s/index.html`, `css/share.css`): etiqueta «Historia» / «Historia · nombre». Legacy sin cambios (`scenarios[0]`).
- **Detalle**: Enter en el popover de renombrar reabría el menú ⋯ (el foco volvía al botón durante la misma pulsación) → `preventDefault`. Mensajes del motor en `story-playback.js` dicen «historia».
- `sw.js` CACHE v59 → v60 (se modificaron assets servidos).

### Archivos
Nuevos: `test/fluyo-016.test.cjs`, `test/fluyo-016-browser.cjs`, `test/fluyo-016-mutations.cjs`, `test/fluyo-016-harness.cjs`. Modificados: `js/model.js`, `js/editor-scenarios.js`, `js/share-url.js`, `js/editor-share.js`, `js/ui.js`, `js/viewer.js`, `js/story-playback.js` (sólo textos), `index.html`, `s/index.html`, `css/styles.css`, `css/share.css`, `sw.js`, `.ai/ARCHITECTURE.md`, `.ai/DECISIONS.md` (62–67) y tests antiguos que fijaban comportamiento reemplazado (versión de caché, «Historia 1», «+ Nueva historia», `scenarios.length` 2→1 en 014).

### Decisiones
Ver DECISIONS 62–67. Ninguna requirió detenerse (formato de Share, legacy, última Historia y selección entre páginas se derivan del modelo y de la especificación).

### Pruebas
- `node --test test/*.test.cjs`: **500/500** (línea base 456; +44 de `fluyo-016.test.cjs`).
- `node test/fluyo-016-browser.cjs` (Chrome real, Playwright externo): **16 bloques OK**, 0 errores de página, 0 telemetría — panel, Ctrl+Z/Ctrl+Y reales, Playback, Present, Share A/B/C, Viewer (reload, Back/Forward, página, Abrir en Fluyo), legacy, adversarial, file://·localhost·producción, responsive 1366×768 / 768×1024 / 390×844 (en ≤700 px el panel es el cajón ⚙), Viewer offline con SW.
- `node test/fluyo-016-mutations.cjs`: **18/18 mutaciones detectadas** sobre copias aisladas (compartir siempre `scenarios[0]`, mezclar Steps, no resetear Playback, duplicar compartiendo ids, eliminar la incorrecta, Share con no seleccionadas / otras páginas, Viewer con la última, activo persistido, página que conserva Historia, duplicar sin seleccionar / sin Undo, selección a Historia inexistente, editor sin selección, Step heredado, nueva sin Undo, Run de otra Historia, duplicar sin detener).
- `node --check js/*.js sw.js test/fluyo-016*.cjs` OK; `git diff --check` sin errores (sólo avisos LF/CRLF del entorno).
- Regresión en Chrome: `fluyo-013-browser`, `fluyo-013-qa-browser` (completo, ~4 min), `fluyo-014-browser` (13 bloques), `fluyo-015-browser` (15), `fluyo-015-qa-browser` (13), `scenario-qa-browser`, `share-post-qa-browser`, `share-browser`, `qa-share-hash-browser`, `fluyo-011-manual-smoke` → OK. Dos tests antiguos fijaban el comportamiento reemplazado (Share con TODAS las Historias) y se actualizaron a la política nueva: `fluyo-014-browser` / `fluyo-014.test` (`scenarios.length` 2→1, id desconocido → ninguna) y `scenario-qa-browser` (el Viewer recibe sólo la Historia seleccionada; el archivo guardado sí conserva todas). NOT RUN (entorno): gate de privacidad de share (requiere script Umami) y upgrade legacy v39.
- QA adversarial cubierto (tests + browser): A→B, A→otra página, A→abrir Share (bloqueado, ver 016.1), A→duplicar, eliminar la activa durante playback, eliminar la última, 150 Steps, mismos EventTypes, mismo nombre, vacía, motor incompatible, Undo tras duplicar, Redo tras eliminar, file:// / localhost / producción, legacy N/1/0, Viewer offline.

### Riesgos / pendiente
- Los EventTypes de Historias no compartidas siguen viajando en el enlace (vocabulario del proyecto; igual que en «sólo diagrama»). No se poda para no cambiar el contrato de `nextEventTypeId`.
- Un Share nuevo con varias páginas sólo lleva Historia en la página abierta; las demás páginas viajan sin Historia (antes 014 conservaba `scenarios[0]` de cada página).
- La selección no se recuerda por página: al volver a una página se elige su primera Historia.
- Duplicar una Historia con motor incompatible la copia tal cual (no editable), igual que el original.
- El editor en <700 px sigue usando el cajón ⚙ para el panel; no se rediseñó.
- Capturas (fuera del repo): `C:/Users/nectd/AppData/Local/Temp/fluyo-016-dExUhT/` (`01-panel-historias`, `02-pagina-2`, `03-share-dialog`, `04-viewer`, `05-panel-*`).

### Próximo paso concreto
Revisión manual de producto con las capturas; si se aprueba, commit/push y despliegue (SW v60). No se inició FLUYO-017.

## QA independiente (adversarial, Chrome real)

Resultado: **PASS** tras 2 correcciones mínimas.

### Bugs
1. **Undo de Duplicar/Nueva saltaba a la primera Historia.** Repro: seleccionar «C» → ⋯ Duplicar → Ctrl+Z → quedaba «A» (fallback a `scenarios[0]`), no «C». Causa: `scActiveScenario()` caía a la primera si la seleccionada desaparecía. Fix: `scPrevActiveId` (la Historia desde la que se cambió; se descarta al cambiar de página) como fallback previo a `scenarios[0]`. Severidad baja/media (UX). Regresión: `QA-016: Undo de Duplicar/Nueva…` + mutación M19.
2. **Jerga visible**: el diálogo de Evento decía «No afecta al tiempo del Scenario.» y Detalles «El Trace aparecerá aquí al ejecutar.». Fix: textos en lenguaje de producto. Regresión: `QA-016: ningún texto visible…` (barrido de `index.html` + mensaje) + mutación M24.

### Hallazgos de producto (NO modificados)
- «▶ Reproducir» deshabilitado (Historia vacía) se ve idéntico al habilitado (opacity 1, cursor pointer, sin `title`). Funcionalmente correcto (no reproduce).
- Abrir Share durante Playback **no detiene** la reproducción: muestra «Detén la reproducción…» y la Historia sigue activa. El handoff decía «abrir Share: detenido»; la implementación bloquea.
- Share desde Página 1 descarta las Historias de otras páginas y el diálogo no lo dice; los EventTypes de las Historias no compartidas sí viajan (documentado).
- Historias legacy conservan su nombre «Escenario N» (dato del usuario).
- El título del diálogo de Detalles sigue siendo «Detalles técnicos» (el menú dice «Detalles»).
- ⋯ pulsado dos veces reabre el menú en vez de cerrarlo (comportamiento común de popovers; Escape/clic fuera cierran).
- Ctrl+Z desde otra página deshace en la página donde se hizo el cambio y navega a ella (Undo por página, anterior a 016).
- La selección no se recuerda por página (documentado).
- La mutación M20 (no poder eliminar la última) se detecta por timeout de la suite (un test itera hasta vaciar); detecta, pero lento.

### Pruebas
`node --test test/*.test.cjs` 502/502 · `node --check` OK · `fluyo-016-mutations` 24/24 (M19–M24 nuevas, M9 reajustada) · browsers 016/015/014/scenario-qa OK · barridos propios (no versionados) en Chrome real: secciones 1–13 del plan QA, responsive 5 viewports, legacy generado con el código de HEAD. SW sigue en v60 (no hay despliegue previo de v60). Archivos tocados por la QA: `index.html`, `js/editor-scenarios.js`, `test/fluyo-016.test.cjs`, `test/fluyo-016-mutations.cjs`, esta nota.

## FLUYO-016.1 — Pulido final de UX

1. **Reproducir con Historia vacía**: `disabled` real + opacidad .45, `cursor:not-allowed`, `title` («Añade un evento a la historia para poder reproducirla.» / sin Historia / motor incompatible). Se habilita al añadir un momento y vuelve a deshabilitarse al quitarlo. Sin cambios de modelo ni Playback.
2. **Share durante Playback — decisión: BLOQUEAR (se mantiene el código; se corrige el handoff).** Razones: abrir un diálogo no debe detener ni modificar estado ajeno (Playback es estado efímero del editor); el editor está congelado en Playback (paleta y «Crear evento» deshabilitados) y Share debe representar una Historia estable; es la política de FLUYO-014. «Terminado» también cuenta como Playback hasta «Volver a editar», así que ahí el texto ahora dice «Pulsa «Volver a editar» antes de compartir.» (antes pedía «Detener», botón que no existe en ese estado). DECISIONS 68. El handoff original («abrir Share: detenido») era impreciso.
3. **⋯ interruptor**: `scMenuToggledOff` en `scMenu`/`scMenuSections` (⋯, selector, menú de momento). `scOpenPopover` no conmuta (renombrar, tiempo y usos lo llaman y esperan un popover). DECISIONS 69.
4. **«Detalles»** en menú y diálogo (antes «Detalles técnicos»).

Archivos: `js/editor-scenarios.js`, `js/editor-share.js` (sólo el texto de «terminado»), `css/styles.css`, `.ai/DECISIONS.md`, esta nota, `test/fluyo-016.test.cjs` (+4), `test/fluyo-016-browser.cjs` (bloque 6b), `test/fluyo-016-mutations.cjs` (M25–M28). SW sigue en v60 (sin despliegue previo). Sin cambios de schema, engine, Trace, payload de Share ni Viewer.

Pendiente (decisión de producto, no tocada): «Cerrar» de Share durante Playback deja la reproducción; el aviso de que Share excluye las Historias de otras páginas; el cambio de página por Undo.
