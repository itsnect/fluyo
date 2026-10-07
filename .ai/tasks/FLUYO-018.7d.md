# FLUYO-018.7d — La biblioteca de EventTypes entra en Undo/Redo

Estado: **IMPLEMENTADO — READY FOR COMMIT.** Sin commit, push ni deploy.
Fecha: 7 de octubre de 2026.
Owner/agente actual: libre.

> Repo público: nada de este documento es confidencial.
> Base: `FLUYO-018.7c.md` (Undo por referencia de página). Decisión del responsable: opción **(a)** — `doc.eventTypes` forma parte del estado
> restaurable por Undo/Redo. Slice aislado: no incluye `duplicate_page`, tope de páginas, UX nueva, Playback/Ctrl+Z ni el `confirm()`.

## Objetivo

Que esta secuencia deje de ser posible: borrar una página que usa un EventType → el EventType queda sin uso → eliminarlo desde la biblioteca →
deshacer el borrado de la página → la página vuelve con Steps que apuntan a un EventType inexistente (Historia inválida).

## Causa raíz

- Las entradas de Undo/Redo (`selection.js`) restauraban **solo la página** (`{kind:"page", page, data}`, `insertPage`, `removePage`): la
  biblioteca de EventTypes es del documento y quedaba fuera (decisión 82).
- Las tres operaciones de biblioteca del editor (`scSaveEventType` → `createEventType`/`updateEventType`, `scDeleteEventUI` → `deleteEventType`)
  **ya hacían `pushUndo()`** antes de mutar, pero esa entrada solo fotografiaba la página activa: Ctrl+Z no las revertía. El aviso «Evento
  eliminado de la biblioteca. Puedes deshacer el cambio.» era falso.
- Con 018.7c el borrado de página pasó a deshacerse; combinado con lo anterior, la página podía volver sin su EventType. La misma secuencia ya
  existía antes por otra ruta (quitar el paso → eliminar el EventType → deshacer el paso).

Reproducción antes del arreglo (`test/fluyo-018-7d.test.cjs` sobre el código de 018.7c): **5 de 8 pruebas fallan**; en la 1, el primer Undo
devolvía el documento sin «Pago» y el segundo dejaba la Historia de A inválida (`missing_event_type`).

## Diseño

Una sola representación: **toda entrada** de Undo/Redo lleva `lib`, la biblioteca tal como estaba antes de esa acción.

- `libSnap()` → `{objs, data, nextEventTypeId}`: los MISMOS objetos EventType (identidad, como las páginas en 018.7c) y una copia profunda
  de su contenido.
- `restoreLibrary(lib)`: devuelve a cada objeto su contenido (quita claves sobrantes y asigna la copia), repone el array con esos objetos
  (vuelven los eliminados, desaparecen los creados después) y **no baja** `nextEventTypeId` (un id nunca se reutiliza, como `nextId`).
- `pageSnap` (y por tanto `snapPage`/`pushUndo`/`pushUndoSnapshot`) y la entrada `insertPage` de `requestDeletePage` capturan `lib`.
- `stepHistory` es el **único** sitio que la aplica, para cualquier tipo de entrada: captura la biblioteca actual antes de aplicar (va en la
  inversa), aplica la parte de página (`applyHistoryEntry`, sin cambios) y, solo si la entrada aplica, restaura `lib`. Una entrada huérfana
  se descarta sin tocar la biblioteca.
- Sin cambios en `model.js` ni en el kernel: crear/editar/eliminar EventTypes y `deletePageIn`/`restorePageIn` siguen igual. Ningún llamador
  tuvo que cambiar: todos pasan ya por `pushUndo`.
- Siguen fuera de Undo (sin cambio): tema y fondo, crear y renombrar páginas, la navegación. `applyProjectData` sigue vaciando las pilas.
- Coste: una copia de `doc.eventTypes` por entrada (tope de 60 entradas).

## Contrato

Sin cambios de API, formato (`version:5`) ni MCP. Cambio de comportamiento del editor: Ctrl+Z / Ctrl+Y deshacen y rehacen crear, editar y
eliminar EventTypes, y cualquier Undo deja la biblioteca como estaba antes de la acción deshecha.

## Decisiones

**107** en `DECISIONS.md`: la biblioteca de EventTypes entra en el estado restaurable por Undo/Redo; la decisión 82 deja de excluirla
(su regla de contadores que no bajan se mantiene).

## Desviaciones y hallazgos

- `libSnap` devuelve `null` si el documento no tiene `eventTypes` (solo ocurre en arneses de test antiguos que montan un `doc` mínimo; el
  editor siempre lo normaliza). Sin biblioteca no hay nada que restaurar.
- Tests de Chrome que codificaban la política anterior, adaptados preservando su intención: `fluyo-015-qa-browser.cjs` §11 (Ctrl+Z ahora
  devuelve la presentación anterior completa; Ctrl+Shift+Z la reaplica; Steps/Trace/IDs estables) y `fluyo-017-3-browser.cjs` §C (Ctrl+Z ×4 /
  Ctrl+Y ×4: página **y** biblioteca exactas en cada paso; el contador no baja).
- Anclas de mutación actualizadas (misma intención): 018.4 M13 (`pageSnap`), 018.7a F1a/F1c y 018.7c E2/E13 (`insertPage` lleva `lib`).
- L2 («la inversa no lleva la biblioteca») y L4 («`insertPage` sin `lib`») solo los detecta la prueba de invariante «toda entrada lleva
  `lib`»: con pilas LIFO la biblioteca previa a esas entradas ya coincide con la actual, así que su efecto no es observable de otro modo.
- `CACHE` v65 → **v66** (`selection.js` es un asset servido). Si 018.7c y 018.7d se commitean por separado, el commit de 018.7c lleva v65 y el de
  018.7d v66.

## Pruebas

- `test/fluyo-018-7d.test.cjs` (12): los 7 casos pedidos (página → EventType, Redo, EventType usado por otra página, crear y eliminar con
  identidad, operaciones consecutivas, ciclos, no regresión), cambio de primitiva (claves que aparecen/desaparecen), entrada huérfana,
  invariante «toda entrada lleva `lib`», comprobación estática de las rutas del editor y secuencias aleatorias (50×40) contra un modelo de
  documentos completos con integridad válida en cada paso.
- `test/fluyo-018-7d-mutations.cjs` (12).
- `test/fluyo-018-7d-browser.cjs`: Chrome real — ✕ de la pestaña, «⋯ → Eliminar de la biblioteca» (bloqueado si otra página lo usa),
  Ctrl+Z/Ctrl+Y, Playback de la Historia restaurada, 3 ciclos, recarga.

Resultados: ver el cierre de la sesión (sección «Resultado»).

## Resultado

- **Fluyo:** `node --test test/*.test.cjs` 961/961; `node --check` de `js/*.js`, `sw.js` y `test/*.cjs` OK; `git diff --check` OK.
- **MCP:** sin cambios: `npm test` y `REQUIRE_FLUYO=1 npm test` 563/563; `build`, `check:kernel` (kernelId sin cambio, `2dfa4df3…a4c2`), `check:config` y `node --check dist/kernel.js` OK.
- **Mutaciones:** nueva 018.7d 12/12. Previas que mutan `selection.js`: 016 28/28, 018.3 60/60, 018.4 18/18, 018.7a 62/62, 018.7c 45/45.
- **`scenario-qa-mutations.cjs` (FLUYO-008) falla ya en HEAD.** La mutación «viewer intenta ejecutar Scenario» sobrevive igual en un worktree limpio de HEAD: el Viewer reproduce Historias desde FLUYO-014. Es previo y ajeno a este slice; no se ha tocado.
- **Chrome real:** 018.7d OK; regresión 018.7c, 018.7a, 018.5, 018.4, 018.3 y 016 (incluye el SW) OK; 017.3 (§C adaptado) y 015-QA (§11 adaptado) OK.

## Próximo paso

Revisión del responsable → commit (018.7c + 018.7d) → deploy (`fluyo` primero con SW v66, luego `fluyo-mcp`, cuyo kernel no cambia en 018.7d).
