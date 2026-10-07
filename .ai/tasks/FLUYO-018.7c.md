# FLUYO-018.7c — `delete_page`, regla de `doc.cur` y Undo estructural por referencia de página

Estado: **IMPLEMENTADO — READY FOR COMMIT** (ver «Resultado»). Sin commit, push ni deploy.
Fecha: 6 de octubre de 2026.
Owner/agente actual: libre.

> Repo público: nada de este documento es confidencial.
> Base: `FLUYO-018.7.md` (auditoría, D1–D12) y `FLUYO-018.7a.md` (release 1, en producción). Decisiones aplicadas: **D1 = política D**
> (cascada intrínseca + confirmación con impacto y Undo en el editor + `expectedName` en MCP), **D2 = solo `expectedName`**, **D4 = U2**
> (Undo por identidad de página + entradas de estructura), **D5 = P-A** (índices estables en el lote + `pageMap`), D6 = sin `duplicate_page`,
> D9 = sin tope de páginas, pregunta menor (i) = el Playback se detiene (`scReset`) al aceptar.

## Objetivo

Cerrar la semántica de páginas: eliminar páginas con una única autoridad de dominio (editor y MCP), una regla única de `doc.cur`
y un Undo/Redo que identifica las páginas por referencia, de modo que borrar una página sea reversible y ninguna entrada pueda escribir
en otra página (F1). Sustituye el hotfix de 018.7a (vaciar Undo/Redo).

## Punto de partida (reproducido antes de tocar nada)

Con el `selection.js`, `model.js` y la ✕ real de `ui.js` (A·B·C, editar B, borrar A, Undo, Redo):

| Código | Tras borrar A | Tras Undo | Tras Redo |
|---|---|---|---|
| Sin hotfix (pre-018.7a) | `[B:edit, C:c0]`, cur=1 (C) | `[B:edit, C:b0]` — **C recibe el contenido de B** | `[B:edit, C:c0]` |
| HEAD (018.7a, hotfix) | `[B:edit, C:c0]`, cur=1 (**C**, F2), pilas vacías | sin efecto | sin efecto |
| 018.7c | `[B:edit, C:c0]`, cur=0 (**B**) | `[A, B:edit, C]`, cur=B | `[B:edit, C]`, cur=B |

El hotfix evitaba la corrupción a costa de perder todo el historial, dejar el borrado sin Undo y sin corregir F2/F3/F4.

## Contrato

### Dominio (`js/model.js`)
- `pageRemovalImpactIn(d, i)` → `{pageIndex, name, nodes, connections, behaviors, stories:[{storyId,name,steps,moments}], eventTypesFreed, isCurrent, isLastPage}` (pura).
- `pageCurAfterRemoval(cur, i, length)`: si la activa sobrevive sigue siendo la misma (`i<cur` → `cur-1`; `i>cur` → `cur`); si se borra, `min(i, length-2)` (la siguiente; la anterior si era la última). Independiente del orden de varios borrados (probado).
- `deletePageIn(d, i)` → `{pageIndex, page (el mismo objeto), impact, cur:{from,to}}`; errores `page_not_found`, `last_page`, `invalid_document`. No toca EventTypes.
- `restorePageIn(d, i, page)` → reinserta el mismo objeto en `i` (0…length) y conserva la página activa; errores `invalid_document(page|pageIndex|pages)`.

### Editor
- `requestDeletePage(i)` (`selection.js`), llamada por la ✕ de la pestaña (`ui.js`; no hay otra ruta: ni menú contextual, ni teclado, ni gesto táctil propio — la ✕ es la misma en táctil). Confirmación siempre; página vacía: `¿Eliminar «X»?` (igual que antes); con contenido: recuento + hasta 8 Historias con sus momentos + «puedes deshacerlo con Ctrl+Z» + «los eventos de la biblioteca se conservan». Cancelar: nada. Aceptar: `scReset()` si hay Playback, `deletePageIn`, una entrada `{kind:"insertPage", page, index, curPage}`, `clearSel`, `renderTabs`.
- Undo/Redo: entradas `page` / `insertPage` / `removePage` por referencia (decisión 104). Undo del borrado: misma página, mismo índice, la activa de antes. Redo: `deletePageIn` (misma regla de `cur`).

### MCP (`author_document`, scope `document`)
```json
{ "op": "delete_page", "scope": "document", "pageIndex": 1, "expectedName": "Pagos" }
```
- `expectedName` obligatorio, texto, igualdad exacta con el nombre actual (`INVALID_FIELD {field:"expectedName"}` / `PAGE_MISMATCH {pageIndex, expectedName, actualName}`); `PAGE_NOT_FOUND`, `INVALID_OPERATION` (pageIndex mal formado o campo desconocido), `SCOPE_MISMATCH`, `CANNOT_DELETE_LAST_PAGE {pageIndex}`, `PAGE_DELETED {pageIndex, deletedBy:{operationIndex, operation}}`. Ningún rechazo devuelve documento.
- `changes[]`: `{operation:"delete_page", scope:"document", operationIndex, entityKind:"page", entityId, pageIndex, deleted:true, name, contents:{nodes,connections,behaviors,stories,steps}, affects:{stories:[{pageIndex,storyId,name,moments,steps,deleted:true}], eventTypesFreed:[ids]}, cur:{from,to}}` (índices del lote).
- Respuesta: `pageMap: [{from, to|null}]` solo si el lote eliminó páginas; `refs[]`/`touchedStories[]` en índices finales; resumen «N página(s) eliminada(s)… pageMap».
- Semántica del lote (decisión 105): índices estables (los del inicio + los de `create_page` al final), hueco para la eliminada, `cur` borrado a borrado, mínimo de una página en cada borrado, validación final traducida a índices del lote.
- Revisiones sin cambios: `REVISION_MISMATCH` antes de mutar, `resultRevision` = revisión del documento devuelto, `dryRun` = mismos `changes`/`pageMap`/`resultRevision` sin documento, lotes encadenables.
- `describe_document`: sin cambios (`pages[].pageIndex`, `pages[].name` y `currentPageIndex` bastan; decisión 106). Sin tool nueva: 16 tools.

## Decisiones tomadas

Registradas en `DECISIONS.md`: **103** (política y regla de `cur`), **104** (Undo por referencia; la 99 queda sustituida), **105** (lotes: índices estables, `pageMap`, coordenadas de la respuesta), **106** (`expectedName`, sin campo nuevo en `describe_document`, sin tool nueva).

## Desviaciones y hallazgos

- **Inversa de una edición (cambio colateral, a mejor):** antes, Undo empujaba a Redo la foto de la página ACTIVA; si se había navegado, Redo «restauraba» otra página y perdía la edición. Ahora la inversa es de la misma página. Solo cambia el caso «editar, navegar, deshacer, rehacer».
- **Coordenadas de la respuesta:** `changes[]`/errores en índices del lote; `refs`/`touchedStories` en índices finales (describen el documento nuevo). Sin `delete_page` coinciden, así que no cambia nada para los lotes existentes.
- **Nombre por defecto de `create_page` tras un borrado en el lote:** cuenta las páginas vivas («Página N+1»), igual que el editor.
- **`tools/list`:** 69 792 → 70 738 caracteres; tope de QA 70 000 → 72 000 (`tools`, `018-5`, `018-7a`).
- **Tests adaptados por contrato (no por comportamiento):** 25→26 operaciones (`fluyo-017-2-qa`), ancla `renamePageIn` (`fluyo-018-5`), v64→v65 (`010-qa`, `013`, `014`, `015`); `fluyo-018-7a-f1.test.cjs` reescrito con la semántica correcta (sin debilitarlo: se mantiene la regresión A·B·C y se añade la matriz completa 3×3×3).
- **Baterías previas con anclas obsoletas** (corregidas preservando la intención): 016 M23, 017.3 A8, 018.3 B1/B9, 018.4 M13, 018.5 Q4/Q7, 018.7a F1a–F1d (reescritas sobre el Undo por referencia: índice, copia, sin entrada, cancelar).
- **`fluyo-018-7a-browser.cjs`:** su oráculo era «HEAD = estado previo a 018.7a»; con 018.7a ya en HEAD se fija en su base `e86c7c4` (`FLUYO_HEAD_REF` lo cambia). Su sección F1 se adapta a 018.7c y su `SETUP` reinicia también `nextScenarioId` (la página que queda tras F1 puede ser una reinsertada por Undo).
- **`eventTypesFreed` (revisado a petición):** es solo información. `deletePageIn` no reasigna ni filtra `doc.eventTypes` (probado también por identidad de objetos); la única eliminación de EventTypes es `deleteEventTypeIn`, explícita. Lista los EventTypes que la página eliminada usaba y que ya no usa ninguna otra; uno usado también en otra página sobrevive y no aparece; uno usado solo en la eliminada **se conserva** (política de 018.7 §4.2/§4.4 y decisión 103), queda sin uso y desde entonces se puede cambiar de primitiva o eliminar de forma explícita (decisión 79). Regresiones: `fluyo-018-7c-domain` (3 casos, incluido Undo/Redo exacto con los usos de cada EventType) y `fluyo-mcp/test/fluyo-018-7c.test.ts`; mutaciones P11–P13 (Fluyo) y 2 nuevas en MCP.
- **Limitación PREVIA encontrada (decisión 82, no introducida por 018.7c):** la biblioteca de EventTypes no entra en Undo. Si se borra la página que usaba un EventType, se elimina ese EventType (ya sin uso) desde la biblioteca y se deshace el borrado de la página, la página vuelve con pasos que apuntan a un EventType inexistente (Historia inválida). Ocurre idéntico por la ruta anterior a 018.7c (quitar el paso → eliminar el EventType → deshacer). Además, el aviso del editor al eliminar un EventType dice «Puedes deshacer el cambio», pero ese Undo no lo restaura. Decidido después: opción (a), la biblioteca entra en Undo/Redo — **resuelto en FLUYO-018.7d** (decisión 107).
- **`fluyo-018-5-browser.cjs` (oráculo obsoleto):** comparaba contra un HEAD anterior a 018.5 (que aceptaba nombres de 81 caracteres). Con 018.5 en HEAD, el oráculo es HEAD actual: las dos comprobaciones de esa diferencia exigen ahora **igualdad** con HEAD (nombre rechazado con aviso, Viewer con los mismos nombres). Verde.
- **Playback y Undo:** Ctrl+Z no tiene guarda de Playback (preexistente, fuera de alcance); deshacer un borrado que cambia de página detiene el Playback vía `scSyncPage`.

## Resultado

Estado: **READY FOR COMMIT** en `fluyo` y `fluyo-mcp`. Sin commit, push ni deploy.

### Archivos
- **fluyo**: `js/model.js`, `js/selection.js`, `js/ui.js`, `js/story-authoring.js`, `sw.js` (v65), `.ai/ARCHITECTURE.md`, `.ai/DECISIONS.md` (103–106; 99 marcada como sustituida), esta tarea. Tests nuevos: `test/fluyo-018-7c.test.cjs`, `test/fluyo-018-7c-domain.test.cjs`, `test/fluyo-018-7c-harness.cjs`, `test/fluyo-018-7c-mutations.cjs`, `test/fluyo-018-7c-browser.cjs`, `test/fixtures/fluyo-018-7c-golden.json`. Adaptados: `fluyo-018-7a-f1.test.cjs` (semántica 018.7c), `fluyo-018-7a-browser.cjs` (oráculo `e86c7c4`, F1, `SETUP`), `fluyo-018-7a-mutations.cjs` (F1a–F1d), anclas de `fluyo-016/017-3/018-3/018-4/018-5-mutations.cjs`, contratos `fluyo-010-qa`, `013`, `014`, `015` (v65), `017-2-qa` (26 operaciones), `018-5` (ancla `renamePageIn`).
- **fluyo-mcp**: `src/authoring.ts` (schema `delete_page`, `pageMap`, resumen), `src/server.ts` (descripción), `src/generated/kernel-sources.ts` (sync), `README.md`, `scripts/mutate-018-7c.ts` (nuevo), anclas de `scripts/mutate-017-3.ts`, `mutate-018-3.ts`, `mutate-018-5.ts`; tests `test/fluyo-018-7c.test.ts` (nuevo), `test/fixtures/stories/fluyo-018-7c-golden.json` (copia del golden), tope de `tools/list` en `tools`, `fluyo-018-5`, `fluyo-018-7a`.

### QA
- Fluyo `node --test test/*.test.cjs`: **950/950**. `node --check` de `js/*.js`, `sw.js` y `test/*.cjs`: OK. `git diff --check`: OK.
- MCP `npm test` y `REQUIRE_FLUYO=1 npm test`: **563/563**. `npm run build`, `check:kernel`, `check:config`, `node --check dist/kernel.js`: OK. stdio real (`dist-test/src/index.js`): describe → `delete_page` → describe, revisiones encadenadas y `PAGE_MISMATCH` con índice desactualizado.
- Mutaciones nuevas: Fluyo **45/45**, MCP **28/28**. Previas Fluyo: 016 28/28, 017.3 31/31, 018.1 29/29, 018.2 26/26, 018.3 60/60, 018.4 18/18, 018.5 44/44, 018.6 17/17, 018.7a 62/62. Previas MCP: 017.3 30/30, 018.2 23/23, 018.3 36/36, 018.5 37/37, 018.6 38/38, 018.7a 33/33.
- Hallazgo de mutación: con el borrado registrado como entrada y pilas LIFO, «snapshot por índice» **por sí solo** no es observable (al deshacer en orden el índice vuelve a coincidir); lo detecta la comprobación estática «ninguna entrada guarda el índice». El defecto observable es índice + borrado fuera del historial (F1 original): E13 y F1a lo cubren. En MCP, `create_page` localiza la página creada con el `pageIndex` que devuelve el dominio, y la mutación de rango de `rename_page` se reescribió en la capa que lo valida para MCP (el dominio repite la comprobación; la batería Fluyo P8 la cubre).
- Chrome real: `fluyo-018-7c-browser.cjs` **OK** (contra HEAD); `fluyo-018-7a-browser.cjs` OK (67, oráculo `e86c7c4`); `018-4` OK (74), `018-3` OK, `017-3` OK, `016` OK (incluye SW). `018-5` OK (oráculo actualizado al HEAD actual). `fluyo-011-browser`: 3 obsoletos conocidos, no ejecutado.

### Paridad editor ↔ MCP
Golden compartido (6 casos: primera, activa con Historias y Behavior, posterior, última vacía, dos borrados en un lote, borrar y seguir editando): el documento del editor real (✕ + confirm) y el del kernel son idénticos (incluido `cur` y la revisión); el MCP reproduce la misma `resultRevision`, `pageMap` y `cur`. Paridad aleatoria (40 secuencias): gestos sucesivos = un lote por gesto = un solo lote con índices estables.

### Kernel / CACHE
`kernelId` `824b7656…e777a` → **`2dfa4df32c2a835732499111622233503619f04f6145ad4b8f2be8bcad0fa4c2`**; `check:kernel` confirma identidad con `fluyo/js`. `CACHE` v64 → **v65**; no hay archivos servidos nuevos (todos siguen precacheados). Formato sin cambios (`version:5`, sin claves nuevas). Orden de deploy: `fluyo` primero, luego `fluyo-mcp`.

### Próximo paso
Revisión del responsable → commit (dos repos) → deploy en el orden indicado.

## Pendientes / fuera de alcance

`duplicate_page`, tope de páginas, guarda de Playback para Ctrl+Z, sustituir el `confirm()` nativo por el sistema visual definitivo, deploy (orden: `fluyo` primero con SW v65, luego `fluyo-mcp`).
