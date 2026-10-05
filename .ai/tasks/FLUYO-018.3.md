# FLUYO-018.3 — Modificar y eliminar estructura (nodos y conexiones) vía MCP

Estado: **HECHO** (sin commit, sin push, sin Cloud Run, sin FLUYO-019). Fecha: 2 de octubre de 2026.

> **Actualización (release 018.x):** lo que este documento deja «pendiente» sobre la política de borrado del editor se resolvió en `FLUYO-018.4.md` (decisiones 91–92) y el bump de `sw.js` (v61 → v62) se hizo en el cierre del release. El texto de abajo describe el estado al terminar 018.3.
Continúa 018.1 (dominio de creación, `createNodeIn`/`createConnectionIn`) y 018.2 (`create_node`/`create_connection` en `author_document`). Fuente de diseño: `FLUYO-018.md` §13, §14, §15, §18.

> Repo público: nada de este documento es confidencial.
> Nota de bootstrap: `FLUYO-018.1.md` no existe; el resultado de 018.1 está en `FLUYO-018.md` §22.

## 1. Arquitectura actual (auditada)

```text
Editor (gestos/panel) ──► edita registros inline        ← 018.3 los hace pasar por model.js
Editor newNode/newEdge ──► createNodeIn/createConnectionIn (018.1)
MCP author_document ─► FluyoAuthoring.apply ─► createNodeIn/createConnectionIn (018.2) ─► FluyoIntegrity (estado final)
```

`FluyoAuthoring.apply` ya: copia normalizada → lote en orden → `FluyoIntegrity.validateProject` del estado final contra la línea base → todo o nada. Refs de nodos/conexiones: `ctx.diagramRefs{nodes,edges}` por página y tipo.

## 2. Operaciones reales del editor detectadas

| Acción | Dónde (hoy) | Qué escribe |
|---|---|---|
| Mover nodos | `interaction.js` `pointermove` (`drag`) | `x,y` (con `snapV`); además, **gesto**: traslada `drag.wps` (waypoints de conexiones internas al grupo) y `realinearExtremos` + `podarWaypoints` de las ortogonales con ruta manual de un solo extremo movido |
| Redimensionar | `interaction.js` (`resizing`) | `w,h,x,y` (enteros; mín. 40×30 y proporción en `image`/`icon`: reglas del **gesto**) |
| Texto | `closeEditBox`, `ui.js` `lblEdit` | `label` (nodo y conexión) |
| Forma | `ui.js` `shapeSel` | `shape` ∈ {rect, cylinder, diamond, circle, hex, text, code}; el control se oculta en `image`/`icon`/`anim` |
| Estilo de nodo | `ui.js` swatches/`applyNodeVal`/selects | `color, fill, border, lblPos, textBg, textColor, font, bold, fs, pulse, order, tint` (icono), `lang, keywords, kwBg, kwColor` (código) |
| Estilo de conexión | `ui.js` | `route, fromSide, toSide, label, font, bold, fs, lineColor, dotColor, animated, dashed, startArrow, endArrow, flowDir, speedFac, dots, dotsGlobal`; «Ruta automática» = `waypoints:[]` |
| Retarget | `interaction.js` `endDrag` (pointerup) | `from`/`to` + `fromSide`/`toSide`; rechaza auto-lazo; **no toca waypoints**. El panel (`fromSel`/`toSel`) sí hace `waypoints=[]` |
| Waypoints | gestos `moverTramo`, `wpDrag` | valores intermedios del arrastre: **gesto**, no pasan por dominio |
| Borrar conexión / nodo | `selection.js` `deleteSel` | quita las conexiones elegidas, los nodos elegidos **y las conexiones incidentes**. No toca Behaviors ni Steps |

No editables hoy desde la UI (por tanto, **no** campos de `update_*`): `id`, `icon`, `anim`, `img`, forma de/hacia `image`/`icon`/`anim`.

## 3. Contrato de dominio (`model.js`)

`updateNodeIn(pg, id, patch, context?)`, `updateConnectionIn(pg, id, patch, context?)`, `deleteNodeIn(pg, id, context?)`, `deleteConnectionIn(pg, id, context?)`. Mismo patrón que 018.1: página explícita, sin DOM/global/snap/geometría, validan antes de mutar, errores `projectDataError(code, field?)`, nunca `TypeError`.

- **Parche**: solo claves editables (lista cerrada); desconocida o `id`/`ref` → `invalid_document(campo)`. `undefined` se ignora (no pisa defaults). Se valida una copia superficial con la **misma normalización que la carga** (`normalizeProjectItem` + `normalizeProjectNode`/`normalizeProjectEdge`) y solo se vuelcan **las claves del parche** ya normalizadas (como el editor hoy: nada se «completa» por detrás). El `img` se excluye de la copia validada para no re-sanear la imagen en cada fotograma de un arrastre.
- **Reglas de nodo**: tipos estrictos (`bold/pulse/tint` booleanos…); `shape` solo hacia las 7 formas del selector y no desde `image`/`icon`/`anim` (regla de la UI); `tint` solo en `icon`; `lang/keywords/kwBg/kwColor` solo en `code`.
- **Reglas de conexión**: `source`/`target` (retarget; en el documento `from`/`to`) deben existir y no formar auto-lazo (`self_loop`, solo cuando se cambia un extremo: un auto-lazo antiguo no impide editar su etiqueta); `waypoints` = `[{x,y}]` finitos. **No se tocan los waypoints salvo que el parche los traiga** (igual que `endDrag`).
- **`deleteNodeIn`** quita el nodo, sus conexiones incidentes **y su Behavior** y devuelve `{node, connections[], behaviors[]}`. **`deleteConnectionIn`** quita la conexión. Nunca tocan Steps/Historias/EventTypes: eso lo decide el estado final (B2).
- Errores nuevos: `node_not_found`, `connection_not_found`.

## 4. Semántica de borrado e Historias (B2)

Política heredada (decisiones 75/77): **sin limpieza silenciosa**. Un lote que deje una Historia inválida se rechaza, y el rechazo nombra la entidad eliminada, la Historia y los Steps afectados, la operación causante y la razón.

- `delete_node`/`delete_connection` **no** comprueban impacto al ejecutarse: lo hace la validación del **estado final** (`FluyoIntegrity`), así que el orden no produce falsos rechazos (`retarget_step` o `update_connection` + `delete_node` valen en cualquier orden razonable).
- Atribución: cada error nuevo `missing_node`/`missing_edge` se asocia a la operación de borrado que eliminó esa entidad (también a las conexiones eliminadas **en cascada** por `delete_node`: `cascadedFrom`) y se agrupa en un único `REFERENCED_ENTITY {entity, affectedStories[], affectedSteps[], operationIndex, cascadedFrom?}`. Lo no atribuible sigue siendo `INTEGRITY_VIOLATION`.
- `deleteNodeIn` quita el Behavior del nodo (metadato del nodo; `changes[].cascade.behaviors` lo informa en MCP) salvo `context.keepBehaviors`. **El editor usa `deleteNodeIn` con `keepBehaviors:true`: su política de borrado no cambia** (ver Resultado). *(**Resuelto en FLUYO-018.4, decisiones 91–92**: el editor confirma antes de borrar lo que una Historia usa y quita el Behavior con el nodo.)*

## 5. Refs

Mismo mecanismo de 018.2 (por página y por tipo). Se amplía el lugar donde se aceptan `{ref}`:

- `update_node`/`delete_node`: `node: {ref}|{id}`; `update_connection`/`delete_connection`: `connection: {ref}|{id}`; `update_connection.source/target: {ref}|{id}`.
- Destinos de Steps: `add_step`/`retarget_step` `target`: `{ref}` (el tipo lo decide el evento: conexión o elemento), `{edgeId:{ref}}`, `{nodeId:{ref}}`, `{from:{ref},to:{ref}}`; `set_initial_availability.nodeId: {ref}`.
- Una ref desconocida → `UNKNOWN_REF` (de otra página: mensaje específico). Duplicada → `DUPLICATE_REF`. Una entidad eliminada en el lote conserva su ref (no se puede recrear con el mismo nombre) y su uso posterior falla con `NODE_NOT_FOUND`/`CONNECTION_NOT_FOUND` indicando la operación que la eliminó.

## 6. Geometría

Sin tercer sistema de geometría. Mover/redimensionar solo escribe `x,y,w,h`; la ruta de las conexiones se deriva en `geometry.js`. **Waypoints al mover**: el dominio no los toca (no hay geometría en el kernel); el gesto del editor sigue realineándolos con `geometry.js` encima de `updateNodeIn`. MCP, al mover/redimensionar/cambiar de forma, informa en `affects.connectionsWithWaypoints` qué conexiones incidentes tienen ruta manual (para que el agente decida enviar `waypoints:[]`). Decisión 2 de 018 §21 resuelta así: no se inventa semántica; se conserva e informa.

`describe_document` añade: nodos `x,y,w,h`; conexiones `route`, `fromSide`/`toSide` (si existen), `waypoints` (si existen); página `bounds {minX,minY,maxX,maxY}` (agregado de las cajas de los nodos, sin cálculo de rutas). Las refs son efímeras: no aparecen.

## 7. Plan

1. `model.js`: las cuatro funciones + conjuntos de claves.
2. Editor: envoltorios en `state.js` (`editNode`/`editEdge`/`removeNodes`/`removeEdges`) y reemplazo de las escrituras inline (panel, gestos, `deleteSel`).
3. `story-authoring.js`: 4 operaciones, refs ampliadas, B2 atribuido, `affects`.
4. fluyo-mcp: schema, descripción de la tool, `describe_document`, `sync:kernel`, tests.
5. Tests Fluyo + mutaciones; tests MCP + mutaciones; stdio; Chrome real; documentación.

## 8. Casos de QA

update_node (mover, resize, shape, label, estilo, campo desconocido, id inexistente, documento antiguo) · update_connection (label, route, sides, waypoints, retarget, source/target inexistente, auto-lazo, campo desconocido) · delete_connection (sin uso, con Historia, B2, retarget+delete) · delete_node (sin uso, con Historia, conexiones dependientes, B2, retarget+delete, Behavior, varias Historias) · refs (create→update, create→connection, create→step, create→update→delete, de otra página, desconocida, duplicada) · revision (baseRevision buena/mala, resultRevision determinista) · dryRun · atomicidad (fallo en la 1.ª, intermedia, validación final) · paridad editor ↔ MCP (`deepStrictEqual` sin normalizar).

## Resultado

Estado: **HECHO** (sin commit, sin push, sin Cloud Run, sin FLUYO-019). `sw.js` NO se tocó.

### Contrato MCP (`author_document`, todas `scope:"page"`, con `pageIndex`)

```jsonc
{ "op":"update_node",        "scope":"page", "pageIndex":0, "node":{"id":1}|{"ref":"a"}, "spec":{ "x":240, "w":200, "label":"…", "shape":"diamond", … } }
{ "op":"update_connection",  "scope":"page", "pageIndex":0, "connection":{"id":4}|{"ref":"k"}, "source"?:{…}, "target"?:{…}, "spec"?:{ "label":"…", "route":"ortho", "waypoints":[] } }
{ "op":"delete_node",        "scope":"page", "pageIndex":0, "node":{"id":2}|{"ref":"x"} }
{ "op":"delete_connection",  "scope":"page", "pageIndex":0, "connection":{"id":4}|{"ref":"k"} }
```

- Retarget **no** es una operación aparte: `source`/`target` de `update_connection` (`{ref}`|`{id}`).
- `spec` de `update_node`: `x, y, w, h, shape, label, color, fill, border (solid|dashed|dotted|none), lblPos, textBg, textColor, font, bold, pulse, order, fs, tint (icono), lang, keywords, kwBg, kwColor (código)`. `spec` de `update_connection`: `label, route, fromSide, toSide, waypoints, font, bold, fs, animated, dashed, startArrow, endArrow, flowDir, lineColor, dotColor, speedFac, dots, dotsGlobal`. Salen del código del editor (§2).
- Destinos de Steps con refs: `target: {ref} | {edgeId:{ref}} | {nodeId:{ref}} | {from:{ref},to:{ref}}`; `set_initial_availability.nodeId: {ref}`.
- `describe_document`: nodos `x,y,w,h`; conexiones `route`, `fromSide`/`toSide` y `waypoints` (solo si existen); página `bounds`.

### Semántica

- **Update**: parche; campos cerrados; `id`/`ref`/`icon`/`anim`/`img` no se modifican; `undefined` no pisa; `null` vacía lo anulable; la validación es la de la carga de documentos y solo se vuelcan las claves del parche normalizadas; todo o nada (un campo malo junto a uno bueno no cambia nada). `changes[]` trae `fields`, `from`, `to` (solo lo que cambió de verdad) y `affects`.
- **Delete**: `delete_node` quita el nodo, sus conexiones incidentes y su Behavior (`changes[].cascade`); `delete_connection` la conexión. Los contadores no bajan. Nunca se tocan Historias, Steps ni EventTypes.
- **B2**: validación sobre el estado final; `REFERENCED_ENTITY` por entidad eliminada con `entity`, `affectedStories`, `affectedSteps`, `operationIndex`, `operation`, `reason`, `integrityCodes` y `cascadedFrom` (conexión eliminada en cascada). Salida ordenada de forma estable (operación → nodo antes que sus conexiones → id).
- **Geometría**: sin tercer sistema; mover/redimensionar/retargetear conservan los waypoints; `affects.connectionsWithWaypoints` avisa; `waypoints:[]` = ruta automática. El gesto del editor sigue realineando waypoints con `geometry.js` encima de `updateNodeIn`.
- **Atomicidad / revision / dryRun**: sin cambios de mecanismo (copia → lote → estado final → todo o nada). `resultRevision` determinista; `dryRun` = mismos `changes`, `refs` y `resultRevision`, sin documento.

### Cambios en el editor (todos pasan por el dominio)

`state.js`: `editNode`, `editEdge`, `editObj`, `removeEdges`, `removeNodes` (+ `domainOrNull`: un rechazo del dominio deja el registro intacto y devuelve `null`). `interaction.js`: mover, redimensionar, retarget por arrastre y confirmar texto. `ui.js`: todos los controles del panel de nodo y de conexión y «Ruta automática». `selection.js`: `deleteSel`. **Sigue siendo del editor** (gesto/geometría): `realinearExtremos`, `podarWaypoints`, `moverTramo`, arrastre de waypoints, orden Z, pegar/duplicar, la vista previa en vivo del texto.

### Desviaciones y hallazgos

1. **Política de borrado del editor: sin cambios (revertida la cascada de Behavior).** Una primera versión hacía que `deleteSel` quitara también el Behavior; se retiró por ser una decisión de producto no tomada. `deleteNodeIn` conserva la cascada (la usa MCP) y el editor pasa `keepBehaviors:true`. Hallazgo para la decisión futura: con el comportamiento actual, borrar un nodo con Behavior deja un Behavior huérfano que invalida las Historias (`missing_behavior_node`; el Viewer compartido no reproduce) — en HEAD y ahora igual. *(**Resuelto en FLUYO-018.4, decisiones 91–92**: el editor confirma antes de borrar lo que una Historia usa y quita el Behavior con el nodo.)*
   **Estado**: B2 en MCP implementado; B2/limpieza en el editor NO aplicados. La asimetría editor/MCP (MCP rechaza lotes que dejan Historias inválidas; el editor mantiene su comportamiento histórico) queda **deliberadamente pendiente de una decisión de producto** (bloquear, advertir/confirmar, limpiar dependencias u otra) para un slice posterior. *(**Resuelto en FLUYO-018.4, decisiones 91–92**: el editor confirma antes de borrar lo que una Historia usa y quita el Behavior con el nodo.)*
2. `fs` desde el panel se acota a 8–96 al instante (la carga ya lo acotaba al reabrir; el input aceptaba hasta 200). `dots: null` desde el panel se normaliza a su valor por defecto al instante (igual que al reabrir).
3. `border` acepta `none` en `update_node` (valor válido del documento y del selector). `create_node` (018.2) no lo ofrece: el `BorderSchema` de MCP quedó sin `none`. Pendiente, fuera de alcance.
4. Los tests de 017.x que fijaban «no existen `delete_*`/`update_*`» y «16 operaciones» se actualizaron al contrato nuevo (20 operaciones; `delete_*` con la forma antigua `{edgeId}`/`{nodeId}` → `INVALID_OPERATION`). `tools/list` pasa de ~50 KB a ~56 KB: tope de test subido a 60 000. Los topes de compacidad de `describe_document` se ajustaron porque ahora incluye geometría (documentado en los tests).
5. Mutaciones antiguas que apuntaban a código que 018.3 generalizó (`endpointOf` → `entityOf`; `explain(regress)` → `explainRemovals`) se actualizaron: `A4`/`A5` de 018-2 y `A8` de 017-3 (Fluyo) y las equivalentes de `mutate-018-2.ts` y `mutate-017-3.ts` (MCP). Las baterías previas siguen detectando todo (017-3: 31/31 y 30/30; 016: 28/28).
6. El orden de claves de `doc` en la respuesta MCP sigue el schema de entrada (preexistente): la paridad MCP es estructural (`deepStrictEqual` y revisión); la de Fluyo también es textual.
7. `FLUYO-018.1.md` no existe (el resultado de 018.1 está en `FLUYO-018.md` §22): el bootstrap leyó esa sección.

### Release

Este slice cambia `model.js`, `state.js`, `interaction.js`, `ui.js`, `selection.js` (assets servidos). **El release 018.x necesitará el bump de `CACHE` en `sw.js`** (HEAD = v61) y actualizar los tres tests que fijan v61; no se hizo aquí. *(**Hecho en el release 018.x: `CACHE` = v62.**)*

### QA (todo ejecutado)

- Fluyo: `node --test test/*.test.cjs` **820/820** (785 + 35 nuevos); `node --check` de todos los `js/*.js` y `test/*.cjs` OK; `git diff --check` OK (solo avisos de fin de línea de git).
- fluyo-mcp: `npm test` y `REQUIRE_FLUYO=1 npm test` **460/460**; `npm run build`, `check:kernel` y `check:config` OK.
- Mutaciones: Fluyo `test/fluyo-018-3-mutations.cjs` **60/60** (018-2: 26/26 y 018-1: 29/29 siguen detectando; la mutación E3 se sustituyó por E3/E3b al revertir la cascada del editor: 59 → 60); MCP `scripts/mutate-018-3.ts` **36/36** (018-2: 23/23).
- stdio real (`node dist/index.js`): describe → author (crear + modificar + retarget + eliminar + Historia, una sola llamada con refs) → describe (valid, `revision` = `resultRevision`) → `run_story` `completed`; B2 → `REFERENCED_ENTITY` con `affectedSteps` y sin documento; quitar paso + eliminar en el mismo lote OK; `dryRun` sin documento; `baseRevision` mala → `REVISION_MISMATCH`; id inexistente → `NODE_NOT_FOUND`; sin trazas.
- Chrome real (`test/fluyo-018-3-browser.cjs`, Chrome 154 + Playwright, mismo guion contra el árbol de trabajo y contra HEAD): crear nodo, etiquetas, conexiones, mover, redimensionar, editar por panel, retarget por arrastre, Historia + Playback, borrar conexión y nodo, Undo/Redo, guardar/reabrir, Share y Viewer. **Los 15 documentos intermedios son idénticos a HEAD**, sin ninguna excepción (incluido borrar un nodo con Behavior y borrar un nodo usado por una Historia), Trace idéntico, Present, Undo/Redo, Share/Viewer con el mismo resultado que HEAD, 0 errores de consola.

### Para 018.4

- **Decisión de producto pendiente**: política de borrado del **editor** cuando la entidad la usa una Historia o tiene Behavior (bloquear, advertir/confirmar, limpiar dependencias u otra); hoy el editor no aplica B2 ni limpia nada (asimetría con MCP; decisiones 71/75/89/90). *(**Resuelto en FLUYO-018.4, decisiones 91–92**: el editor confirma antes de borrar lo que una Historia usa y quita el Behavior con el nodo.)*
- `create_page`/`rename_page`/`set_theme`, `duplicate_*`, orden Z, auto-layout como herramienta de lectura que proponga `x,y`.
- Topes de autoría (coordenadas, nodos por página, conexiones por nodo; decisión 7 de `FLUYO-018.md` §21).
- `border:"none"` en `create_node`; `image` por MCP (`atob`/`TextDecoder` en el `vm`).
- Congelar `edit_diagram` / enrutar `create_diagram` por el kernel (018.5).
- Bump de `sw.js` y release 018.x.

### Archivos modificados / nuevos

Fluyo: `js/model.js`, `js/state.js`, `js/selection.js`, `js/interaction.js`, `js/ui.js`, `js/story-authoring.js`; tests `test/fluyo-018-3.test.cjs`, `test/fluyo-018-3-mutations.cjs`, `test/fluyo-018-3-browser.cjs`, `test/fixtures/fluyo-018-3-golden.json`, y ajustes en `test/fluyo-017-2.test.cjs`, `test/fluyo-017-2-qa.test.cjs`, `test/fluyo-018-2-mutations.cjs`, `test/fluyo-017-3-mutations.cjs`; docs `.ai/tasks/FLUYO-018.3.md`, `.ai/ARCHITECTURE.md`, `.ai/DECISIONS.md`.
fluyo-mcp: `src/authoring.ts`, `src/stories.ts`, `src/server.ts`, `src/generated/kernel-sources.ts` (regenerado), `README.md`; tests `test/fluyo-018-3.test.ts`, `test/fixtures/stories/fluyo-018-3-golden.json`, `scripts/mutate-018-3.ts`, y ajustes en `test/fluyo-017-1.test.ts`, `test/fluyo-017-1-qa.test.ts`, `test/fluyo-017-2.test.ts`, `test/fluyo-017-3.test.ts`, `test/fluyo-018-2.test.ts`, `test/tools.test.ts`, `scripts/mutate-018-2.ts`, `scripts/mutate-017-3.ts`.
