# FLUYO-018.7a — Release 1 de 018.7: hotfix F1 + `set_theme` + orden Z + `duplicate_node`

Estado: **IMPLEMENTADO — READY FOR COMMIT (ver «Resultado» al final).** *(Estado anterior: diseño para revisión.)* Único archivo nuevo de código: el test de regresión de F1 (`test/fluyo-018-7a-f1.test.cjs`), que **falla hoy** (§1.4). No se ha modificado `model.js`, `state.js`, `selection.js`, `ui.js`, `sw.js`, kernel ni MCP. Sin commit, push ni deploy.
Fecha: 6 de octubre de 2026.
Owner/agente actual: libre.

> Repo público: nada de este documento es confidencial.
> Base: `FLUYO-018.7.md` (auditoría) y las decisiones del responsable: D1 = política D (solo `delete_page`, **release 2**), D3 = hotfix mínimo de F1 ya, D4 = Undo por referencia de página en 018.7c (**release 2**), D6 = `duplicate_page` fuera, `duplicate_node` dentro, D12 = dos releases.
> Release 2 (fuera de este documento): `delete_page` + Undo por referencia estable (018.7c).

## 0. Alcance de este release

| # | Pieza | Frontera |
|---|---|---|
| 1 | **F1**: borrar una página limpia Undo y Redo | solo editor (`ui.js`) |
| 2 | `set_theme` | dominio + editor + MCP + `describe_document` |
| 3 | Orden Z (`reorder_nodes`) | dominio + editor + MCP + `describe_document` |
| 4 | `duplicate_node` | dominio + editor (`dupSel`/`pasteClip`) + MCP |

**No incluye:** `delete_page`, `duplicate_page`, `duplicate_connection`, Undo por identidad de página, tope de páginas, `set_settings`, posiciones Z relativas, cualquier cambio de formato (sigue `version:5`, sin claves nuevas).

Orden de implementación propuesto (cada paso con sus tests antes de seguir): **(1) F1** → **(2) set_theme** → **(3) orden Z** → **(4) duplicate_node**. F1 es independiente y podría salir antes, por separado, si lo prefieres (pregunta Q1, §9).

---

## 1. F1 — Undo/Redo tras borrar una página

### 1.1 Causa raíz exacta
- `selection.js:162` — `snapPage()` devuelve `{pi:doc.cur, data:deep(P())}`: el snapshot identifica la página por su **índice** en `doc.pages`.
- `selection.js:164-172` — `applySnap(s)` hace `doc.cur = clamp(s.pi, 0, len-1)` y **sobrescribe** `nodes/edges/behaviors/scenarios` de `doc.pages[doc.cur]` con `s.data`.
- `ui.js:471-476` — la ✕ de la pestaña hace `doc.pages.splice(i,1)` **sin tocar `undoStack`/`redoStack`**. La única vía que vacía las pilas es `applyProjectData` (`state.js:152`).
- Consecuencia: tras un `splice`, un snapshot con `pi ≥ i` apunta a otra página (o, con `clamp`, a la última). Deshacer/rehacer escribe el contenido de una página en otra. Es **pérdida de datos** y ocurre hoy en producción. Con `pi` = última página el `clamp` lo enmascara por casualidad: el defecto depende de qué página se edita y de cuál se borra.
- Única puerta de borrado de página: `ui.js:471` (verificado: no hay otro `pages.splice`/`unshift`; `appendPagesFrom` solo añade al final, `addPage` también, y no desplazan índices).

### 1.2 Por qué limpiar Undo/Redo elimina el riesgo
El defecto exige que exista **alguna entrada de pila con índice de página que ya no significa lo mismo**. Vaciar `undoStack` y `redoStack` justo después del `splice` hace imposible esa condición: no queda ninguna entrada creada antes del borrado. Las entradas posteriores se crean con `snapPage()` sobre el estado ya reindexado, así que son correctas. Es la misma política que ya aplica `applyProjectData` al cambiar de documento. No hay otra estructura que guarde índices de página en el editor (`scLastPage` guarda el **objeto** página; `doc.cur` se recalcula). Coste aceptado y conocido: se pierde el historial de deshacer de **todas** las páginas, y borrar una página sigue sin poder deshacerse (se resuelve en 018.7c con Undo por referencia, D4).

### 1.3 Cambio mínimo (a aplicar tras tu aprobación)
En `ui.js`, dentro de `x.onclick`, **después de aceptar el `confirm`** y de `splice`: `undoStack.length=0; redoStack.length=0;`. Nada más: **no** se corrige `cur` (F2), **no** se cambia el mensaje del `confirm` (F3), **no** se añade guarda de Playback (F4) — todo eso es 018.7c. Cancelar el `confirm` no toca nada. `undoStack`/`redoStack` son `let` globales de `selection.js` (ámbito compartido de scripts clásicos), el mismo acceso que ya usa `state.js`.
- Efecto en `sw.js`: `ui.js` es asset servido ⇒ entra en el bump único de v63→v64 de este release. Si F1 sale solo (Q1), bump propio.

### 1.4 Reproducción con el código actual y test de regresión
Reproducido de nuevo con los archivos reales: `selection.js` y la función `renderTabs()` **extraída de `ui.js`** (clase `vm`, sin DOM real, `confirm` simulado) y pulsando la ✕ real de la pestaña. Con A·B·C, snapshot en B, editar B, borrar A, `undo()`: **C pasa a contener el contenido de B**.

Test dejado: `test/fluyo-018-7a-f1.test.cjs` (6 pruebas). Resultado actual: **4 fallan (reproducen el defecto), 2 pasan (guardas que deben seguir pasando)**:

| # | Prueba | Hoy | Tras el hotfix |
|---|---|---|---|
| 1 | Undo tras borrar una página anterior no escribe el contenido de una página en otra | **falla** (`C:b0`) | pasa |
| 2 | Borrar una página vacía `undoStack` y `redoStack` | **falla** (`undoStack.length` = 1) | pasa |
| 3 | Redo tras borrar no restaura por índice | **falla** | pasa |
| 4 | Tras borrar, Undo no revierte nada y el estado es el esperado (páginas, contenido, selección limpia) | **falla** | pasa |
| 5 | Una edición posterior al borrado vuelve a ser deshacible | pasa | pasa (la pila no queda inutilizada) |
| 6 | Cancelar el `confirm` no borra ni toca las pilas | pasa | pasa |

Nota de ciclo de vida: las pruebas 2–4 codifican la política «vaciar». En 018.7c (Undo por referencia) se **reescribirán** (las pilas dejarán de vaciarse y borrar será deshacible); la 1 y la 5/6 se conservan.

### 1.5 Estado tras borrar una página (con el hotfix)
`doc.pages` sin la página; `doc.cur = min(cur, len-1)` (**comportamiento actual, F2 sin corregir**: con ≥4 páginas, borrar una anterior a la activa deja `cur` en otra página; se corrige en 018.7c); selección vacía (`clearSel`); `renderTabs`; autoguardado; `scSyncPage` descarta la Historia seleccionada (identidad de página); `undoStack = []`, `redoStack = []`; Ctrl+Z/Ctrl+Y no hacen nada hasta la siguiente edición.

### 1.6 Casos que deben cubrir los tests (los 6 de §1.4 más)
- Borrar la **primera**, **media** y **última** página, con la activa antes/igual/después (regresión F1 en cada combinación; matriz 3 páginas × índice borrado × índice del snapshot).
- Pilas con solo undo, solo redo, ambas, vacías.
- Borrar con una sola página no es posible (✕ ausente): sin cambios.
- Secuencia: editar → borrar → editar → undo → redo (la pila posterior funciona).
- Documento recién abierto (`applyProjectData`) y luego borrar: sin errores con pilas vacías.
- Chrome real (§8.4): el mismo escenario con ratón/teclado reales.

---

## 2. `set_theme`

### 2.1 Contrato
**Documento:** sin claves nuevas. Se escribe `doc.theme` y `doc.customBg` (§2 de la auditoría).
**Operación** (scope `document`; sin `pageIndex`):
```jsonc
{ "op": "set_theme", "scope": "document", "theme": "crema", "customBg": "#f4eee1" }
// customBg: HEX, o null / "" para quitar el fondo personalizado (vuelve al del tema)
```
- **Parche**: solo las claves presentes se escriben (`undefined` no pisa nada; decisión 87). Debe venir **al menos una**: ninguna ⇒ `INVALID_OPERATION`. Campos desconocidos ⇒ `INVALID_OPERATION` (como el resto de operaciones).
- **Idempotente**: escribir el valor que ya hay **no es error**; `changes[]` lleva `changed:false` y no altera `resultRevision`.
- `changes[]`: `{operation:"set_theme", scope:"document", entityKind:"document", changed, theme:{from,to}, customBg:{from,to}, affects:{stories:[]}}`.
- Errores: `INVALID_FIELD {field:"theme", allowed:[…]}` (no es clave de `THEMES`), `INVALID_FIELD {field:"customBg"}` (no HEX), `INVALID_OPERATION` (sin campos / campo desconocido).

### 2.2 Dominio (`model.js`)
`setThemeIn(d, patch)`:
- `patch.theme` (si está): debe ser clave propia de `THEMES` (`projectOwn`) ⇒ si no, `invalid_theme`. Es la **misma comprobación** que ya hace la carga (`model.js:1002`).
- `patch.customBg` (si está): `string` o `null`; `null` se guarda como `""` (así lo normaliza la carga). El dominio **no impone HEX** (la carga admite cualquier `string`; es una regla de **entrada** de autoría, igual que 94/97: no retroactiva).
- Todo o nada (valida antes de escribir). No toca autoguardado, Undo, ajustes ni páginas. Devuelve `{theme:{from,to}, customBg:{from,to}, changed}`.
- El kernel/`FluyoAuthoring` lo llama sobre la copia del lote; el editor lo llama sobre `doc`.

### 2.3 Editor
`themeSel.onchange`, `bgCustom.oninput` y `btnBgClear.onclick` (`ui.js:382,390-391`) llaman a `setThemeIn(doc, …)` y mantienen `scheduleAutosave()`. **Sin `pushUndo`** (el tema es del documento; el Undo es por página: decisión 82, límite conocido y documentado). `syncProjectControls` ya refleja el tema al cargar. Los valores del `<select>`/`<input type=color>` son siempre válidos, así que el editor no muestra errores nuevos.

### 2.4 MCP / `FluyoAuthoring`
- `story-authoring.js`: `set_theme:"document"` en `OPERATION_SCOPE`; campos `["theme","customBg"]` en `OPERATION_FIELDS`; handler que llama a `setThemeIn(ctx.d, patch)`; regla de entrada de `customBg` con `HEX_COLOR` (mismo patrón que `nodeInputRules`, solo claves presentes; `null` y `""` válidos). Traducción de `invalid_theme` → `INVALID_FIELD`.
- `fluyo-mcp`: `authoring.ts` (`z.strictObject({op:"set_theme", scope: documentScope, theme: z.enum(THEME_NAMES).optional(), customBg: z.string().max(9).nullable().optional()})`), descripción de `author_document` en `server.ts`. `THEME_NAMES` ya existe en `schema.ts` (derivado del kernel: no se duplica la lista a mano).
- `edit_diagram.set_theme` (legacy) **no cambia** (decisión 96).

### 2.5 `describe_document`
Añadir: `theme` (nombre), `customBg` (`""` si no hay) y `capabilities.themes` (`["dark","crema","claro"]`, **leídos del kernel**, no escritos a mano en `src/`). Lectura vía `READ_MODEL` de `stories.ts`. Es aditivo (clientes existentes no se rompen). Documentos antiguos: `theme` ausente ⇒ `dark`, `customBg` ausente ⇒ `""` (los pone la normalización).

### 2.6 Validaciones y límites
`theme` ∈ `THEMES`; `customBg` HEX (`#rgb`, `#rrggbb`, `#rrggbbaa`) o `null`/`""`; sin otros campos. Sin límites numéricos nuevos. Documentos con `customBg` no HEX: se abren, se muestran tal cual y **solo** se valida lo que el lote escribe (un `set_theme {theme}` sobre ellos no los toca).
Riesgo documentado, no validado: contraste ilegible entre `customBg` y el texto del tema (igual que en el editor).

### 2.7 Resto de interacciones
Historias, Steps, EventTypes, Behaviors: sin impacto (presentación pura). Share/Viewer: tema y `customBg` ya viajan en el documento (§2.4 de la auditoría): sin cambio de código; se verifica por prueba. Revisión: ambos campos forman parte de la revisión normalizada.

---

## 3. Orden Z — `reorder_nodes`

### 3.1 Representación actual (verificada)
Z = posición en `page.nodes[]` (el último queda encima; `render.js:972,1005`; hit-test `interaction.js:15-22` de atrás hacia delante). **No** existe campo `z`. `node.order` es el orden de **aparición** de la animación `build` (`render.js:22,26`) y las acciones de Z del editor **no lo tocan**. Las **conexiones se dibujan siempre debajo de todos los nodos** (`render.js:970-972,1004-1005`): no tienen Z propio. El orden del array forma parte de la revisión. `createNodeIn` añade al final ⇒ el orden de creación es el Z inicial. No se introduce ningún sistema nuevo.

### 3.2 Dominio (`model.js`)
- `reorderedNodeIds(pg, ids, placement)` — **pura**: devuelve la nueva secuencia de ids de `pg.nodes` sin tocar nada.
- `reorderNodesIn(pg, ids, placement)` — aplica esa secuencia reordenando **los mismos objetos** (identidad de nodo conservada) y devuelve `{changed, from:[ids…], to:[ids…]}`.
- `placement ∈ {"front","back","forward","backward"}` (desconocido ⇒ `invalid_placement`). Semántica = **el código actual de `selection.js:127-158`, movido tal cual**:
  - `front`: quita los seleccionados y los añade al final (conservan su orden **relativo del documento**).
  - `back`: los pone al principio, mismo criterio.
  - `forward`: recorre de arriba abajo; cada nodo seleccionado cuyo vecino superior **no** está seleccionado intercambia con él (un bloque contiguo sube un puesto como unidad; una selección discontinua mueve cada elemento un puesto — F8, se conserva).
  - `backward`: simétrica.
- Reglas: ids inexistentes ⇒ `node_not_found`; ids repetidos se ignoran; lista vacía ⇒ `invalid_document` (campo `nodes`); orden de los ids en la entrada **irrelevante** (manda el orden del documento, igual que el editor); un conjunto que ya está en su sitio ⇒ `changed:false`, sin error.
- No toca `order`, `x/y`, conexiones, Behaviors ni Historias.

### 3.3 Editor
Las cuatro funciones (`bringToFront`, `sendToBack`, `bringForward`, `sendBackward`) pasan a: si `!selN.size` salir; `plan = reorderedNodeIds(P(), [...selN], placement)`; si `plan` = orden actual **no** hacen nada (corrige F7: sin entrada de Undo vacía); si cambia: `pushUndo()` → `reorderNodesIn` → `scheduleAutosave()`. Un gesto = una entrada de Undo; Redo la rehace. Selección conservada (no se limpia). Se ignoran las conexiones seleccionadas. Pregunta Q2 (§9): añadir guarda `editorFrozen()` como `deleteSel` (a confirmar en Chrome si los botones son alcanzables durante el Playback; hoy no hay guarda).

### 3.4 MCP
```jsonc
{ "op": "reorder_nodes", "scope": "page", "pageIndex": 0,
  "nodes": [ {"id": 4}, {"ref": "fondo"} ], "to": "back" }   // to: front | back | forward | backward
```
- `nodes`: 1…100 entradas `{id}` o `{ref}` (misma resolución por página que `update_node`; ref de un nodo eliminado en el lote ⇒ mismo mensaje que hoy). Un id de conexión **no es un nodo** ⇒ `NODE_NOT_FOUND`.
- `changes[]`: `{operation:"reorder_nodes", entityKind:"node", changed, affects:{order:{from:[…], to:[…]}}}`. No-op válido (`changed:false`).
- Atomicidad: igual que cualquier operación (lote todo o nada); dentro del lote, el Z es el de aplicación (un `create_node` posterior queda encima de todo).
- Historias/Steps/EventTypes/Behaviors: ninguno (todo por id); el Trace de las Historias no cambia (test). `affects.stories:[]`.
- Revisión: el orden entra en `resultRevision`; un no-op no la cambia.
- Selección múltiple: la lista es la «selección»; el resultado equivale a seleccionar esos nodos en el editor y pulsar la misma acción.
- `describe_document`: añadir **`z`** a cada nodo de `pages[].nodes` (0 = fondo, índice del array) y documentar «orden = de fondo a frente». Sin `z` en el documento.

### 3.5 Undo/Redo
Editor: una entrada por acción **solo si hay cambio** (F7). El snapshot de página ya incluye el array `nodes` ⇒ restaura el orden. MCP: sin Undo (como el resto de `author_document`).

---

## 4. `duplicate_node`

> Nombre: se mantiene `duplicate_node` (decisión del responsable) aunque admita varios nodos, para duplicar **conjuntos con sus conexiones internas** (si fuera uno por operación, las conexiones entre ellos no podrían copiarse). Pregunta Q3 (§9): ¿`duplicate_node` con `nodes[]` o renombrar a `duplicate_nodes`?

### 4.1 Qué se duplica y qué no (paridad con `dupSel` actual, F5/F6)
| Entidad | Regla |
|---|---|
| **Nodos** indicados | copia profunda (incl. `img` ya saneado, `icon`, `anim`, estilos, `label`…), id nuevo, `order` = `nodes.length` al insertarla |
| **Conexiones internas** (ambos extremos dentro del conjunto, **estén o no seleccionadas**) | se copian con ids nuevos y `from/to` remapeados; mismos lados, ruta, etiqueta, colores, flujo y **waypoints desplazados** |
| Conexiones con un extremo fuera del conjunto | **no** se copian |
| **Behaviors** de los nodos copiados | **se copian** (`nodeId` remapeado); una copia de un nodo «No disponible» nace «No disponible». No cambia ninguna Historia ni su Trace |
| **Historias / Steps** | **nunca**: siguen apuntando al original. No se duplican, redirigen ni modifican |
| **EventTypes** | intactos (no se copian ni se tocan) |
| Selección de conexiones (`selE`) | se **ignora** (no hay «duplicar una conexión sola»; `duplicate_connection` diferida) |

### 4.2 Autoridad de dominio (`model.js`)
Una única función de clonado para el editor y para MCP:
- `cloneStructureIn(pg, snapshot, {dx, dy})` — inserta copias de `snapshot = {nodes, edges, behaviors}` en `pg`, desplazadas `dx,dy`. La usan **`pasteClip`** (que hoy también tiene su propia copia de esta lógica) y `duplicateNodesIn`. Evita un tercer sitio con reglas de ids/remapeo.
- `duplicateNodesIn(pg, ids, {dx, dy, connections:"internal"|"none"})` — construye el snapshot desde la propia página y llama a `cloneStructureIn`. Devuelve `{nodes:[{from,id}], connections:[{from,id}], behaviors:[…]}`.

### 4.3 IDs y orden (determinismo = paridad editor ↔ MCP)
- Los ids se reservan **en un solo bloque** (`reserveStructureIds(pg, nNodos + nConexiones)`) **antes de mutar nada**: agotamiento ⇒ `id_exhausted` sin copia parcial (como `pasteClip` hoy).
- Asignación **idéntica a `pasteClip`**: primero los nodos en el **orden del documento** (`pg.nodes`, no el de la lista de entrada), luego las conexiones en el orden de `pg.edges`. Así el resultado **no depende del orden en que se listaron** y coincide byte a byte con Ctrl+D del editor (test de paridad por revisión).
- `order` de cada copia = `pg.nodes.length` en el momento de insertarla (se anima al final y queda **encima** en Z, porque se añade al final del array).
- Los contadores nunca bajan; ids de `nodes`, `edges`, `behaviors.nodeId` no se reutilizan.

### 4.4 Posición y waypoints
Desplazamiento explícito `offset {x,y}` aplicado a `x,y` de cada copia y a **cada waypoint** de las conexiones copiadas (como `pasteClip`). **Por defecto** `GRID` (20,20), que es lo que hace Ctrl+D. El dominio **no hace snap ni redondea** (decisión 84): el editor ya no aplicaba snap al duplicar (verificado: `pasteClip` suma `GRID` sin `snapV`). La cascada de pegados sucesivos (`clip` se desplaza tras cada pegado) es **estado efímero del editor** y se queda en `pasteClip`.

### 4.5 Editor
- `dupSel`: si no hay `selN` ⇒ nada. Calcula/inserta con `duplicateNodesIn(P(), [...selN], {dx:GRID, dy:GRID})`; **un** `pushUndo` por duplicado (con el mismo orden relativo que hoy respecto a la reserva de ids: ver nota); selecciona **solo lo nuevo** (nodos + conexiones copiadas); `refreshPanel`. **No** llama a `copySel` ⇒ **deja de escribir en el portapapeles del sistema** (F5; cambio visible, a mejor, a registrar) y **no toca `clip`** (el portapapeles interno queda intacto, como hoy).
- `pasteClip`: pasa a `cloneStructureIn(P(), clip, {dx:GRID, dy:GRID})` y conserva su cascada de `clip`, su `pushUndo` y su selección. **Primero se escribe una prueba de caracterización con el `pasteClip` actual** (golden de ids, `order`, posiciones, waypoints, Behaviors, selección) y el refactor debe reproducirla exactamente.
- Nota de Undo/ids: hoy `pasteClip` reserva ids → `pushUndo` → muta. Con dominio “todo o nada”, el editor toma el snapshot antes (`snapPage()`), llama al dominio y, si no lanza, empuja ese snapshot a `undoStack` (helper de selección `pushUndoSnapshot`); si lanza (`id_exhausted`) no queda entrada de Undo. A confirmar en revisión (Q4).
- Guarda de Playback: `dupSel` ya está protegido en `interaction.js` (Ctrl+D) ; `mDup` del menú contextual se comprueba en Chrome.
- **Selección múltiple:** es el caso normal (conjunto); sin conexiones seleccionadas no cambia nada. Ver 4.1.

### 4.6 MCP
```jsonc
{ "op": "duplicate_node", "scope": "page", "pageIndex": 0,
  "nodes": [ {"source": {"id": 3}, "ref": "api2"}, {"source": {"ref": "db"}, "ref": "db2"} ],
  "connections": "internal",             // "internal" (por defecto) | "none"
  "offset": { "x": 20, "y": 20 } }       // opcional; por defecto GRID
```
- `nodes`: 1…100 entradas; `source` = `{id}` o `{ref}` (misma resolución que `update_node`); `ref` opcional = **ref de la copia** (misma regla: única por página y tipo, `DUPLICATE_REF`, no se persiste). Una fuente repetida ⇒ `INVALID_OPERATION`.
- Las refs de las copias se publican en `refs[]` de la respuesta (como `create_node`) y se pueden usar en el mismo lote (`create_connection`, `reorder_nodes`, `update_node`, Steps…).
- Las **conexiones copiadas no reciben ref** (v1): salen en `changes[].created` con `{kind:"connection", from, id}`. Límite documentado: no se pueden referenciar dentro del mismo lote; se pueden usar por id en un lote posterior.
- `changes[]`: `{operation:"duplicate_node", entityKind:"node", created:[{kind, from, id, ref?}…], affects:{stories:[], connectionsWithWaypoints:[ids de las copiadas con waypoints]}}`.
- **Límites** (decisión 95, sobre el estado final y solo si el lote **aumenta** el conteo): `maxNodesPerPage` (300), `maxConnectionsPerPage` (600); `coordMax` para `x,y` y waypoints desplazados (se registran con `watch`/`countOps` como `create_node`).
- Errores: `NODE_NOT_FOUND`, `UNKNOWN_REF`, `DUPLICATE_REF`, `INVALID_FIELD` (`offset`, `connections`), `INVALID_OPERATION`, `LIMIT_EXCEEDED`, `ID_EXHAUSTED`, `PAGE_NOT_FOUND`.
- **Atomicidad:** una operación = un bloque todo o nada dentro del lote atómico (si la validación del estado final falla, no se escribe nada). Un `delete_node` previo en el mismo lote del nodo fuente ⇒ el mismo error con «eliminado por la operación N».

### 4.7 Historias, Steps, Behaviors e integridad
`FluyoIntegrity` valida el estado final como siempre: las copias no tienen Steps, no hay referencias nuevas, y los Behaviors copiados son de nodos que existen. El Trace de las Historias existentes **no cambia** (prueba explícita «Trace antes = Trace después»).

---

## 5. Impacto en kernel, SW, editor, MCP y deploy

### 5.1 Kernel (`sync:kernel`, `kernelId`)
- `model.js` (servido **y** del kernel): `setThemeIn`, `reorderedNodeIds`, `reorderNodesIn`, `cloneStructureIn`, `duplicateNodesIn`. Son funciones globales de script clásico (como `createNodeIn`); no requieren `window.*`.
- `story-authoring.js` (solo MCP, no asset del SW, **sí** del `kernelId`): operaciones `set_theme`, `reorder_nodes`, `duplicate_node`, reglas de entrada de `customBg`, refs de copias.
- `npm run sync:kernel` (cambia `src/generated/kernel-sources.ts` y el `kernelId`), luego `check:kernel`, `check:config`, `build`.

### 5.2 Service Worker
Cambian archivos servidos (`model.js`, `ui.js`, `selection.js`, y `state.js` solo si se añade el helper de Undo allí) ⇒ **un único bump `CACHE` v63 → v64** para todo el release. `story-authoring.js` no está en la lista de `sw.js` (verificado); no hay archivos nuevos servidos.

### 5.3 Editor
`ui.js` (F1, `themeSel`/`bgCustom`/`btnBgClear`), `selection.js` (Z, `dupSel`, `pasteClip`, helper de Undo), `model.js` (dominio). Sin cambios en `index.html`, `render.js`, `interaction.js` (salvo, si Q2/Chrome lo exige, guardas de Playback), `share-url.js`, `viewer.js`, `document-integrity.js`.

### 5.4 MCP (`fluyo-mcp`)
- `src/authoring.ts` (3 esquemas), `src/server.ts` (descripción de `author_document`), `src/stories.ts` (`theme`, `customBg`, `capabilities.themes`, `z` por nodo), `src/generated/kernel-sources.ts`, `README.md`, tests de contrato.
- **Riesgo medido (nuevo):** `tools/list` ocupa hoy **61 939 caracteres** de un tope de **62 000** (`test/tools.test.ts:100`, `test/fluyo-018-5.test.ts:112`). Tres operaciones nuevas (esquema + descripción) lo superarán con seguridad (estimación +3 000–4 000). Hay que **decidir** (Q5): (a) subir el tope a un valor justificado (propuesta: 68 000, con comentario del presupuesto) o (b) comprimir descripciones existentes. Recomendación: (a) + una pasada de recorte en lo redundante. Sin cambios en el número de tools (siguen 13): no cambian `verify-deploy.sh` ni los contratos «13 tools».
- `describe_document`: campos aditivos (clientes existentes no se rompen).

### 5.5 Deploy
Un solo release: **`fluyo` primero** (editor/Viewer con `model.js` nuevo, SW v64) y **después `fluyo-mcp`** (kernel sincronizado). Sin cambio de formato ni migración. Un MCP desplegado antes del editor no rompe nada (el formato no cambia), pero conviene el orden para que los documentos autorados abran en un editor que ya conoce las reglas. `verify-deploy.sh` **no cambia** (13 tools). Verificación posterior: `tools/list` = 13, `describe_document` con `theme/customBg/z`, caché del SW v64 activa.

---

## 6. Compatibilidad y documentos antiguos
- Formato sin cambios (`version:5`). v1–v4: `theme` ausente ⇒ `dark`, `customBg` ausente ⇒ `""`, `order` ausente ⇒ índice (normalización de carga, ya existe).
- Documentos con `customBg` no HEX, con nodos fuera de `coordMax` o con >300 nodos: se abren y se editan; las reglas de entrada solo evalúan lo que el lote escribe (94/95/97).
- Documentos de `create_diagram` (v3 con `meta`): `describe_document` los lee; `set_theme`/`reorder_nodes`/`duplicate_node` operan sobre su forma normalizada.
- Autoguardados anteriores y enlaces Share ya creados: sin cambios (no hay claves nuevas).

---

## 7. Decisiones que este diseño registra al cerrar (propuestas, **no** escritas)
99. F1: vaciar Undo/Redo al borrar página (hotfix); sustituido por Undo por referencia en 018.7c. 100. `set_theme {theme?, customBg?}` (parche, idempotente, `customBg` HEX de entrada no retroactiva; tema fuera de Undo). 101. Orden Z = posición en `nodes[]`; `reorder_nodes` con `front|back|forward|backward` y semántica movida del editor; no-op sin Undo; `z` solo en lectura. 102. `cloneStructureIn`/`duplicateNodesIn`: única autoridad de clonado (editor y MCP), conexiones internas, Behaviors copiados, Historias nunca, ids por documento-orden; `dupSel` ya no pisa el portapapeles.

---

## 8. Plan de QA

### 8.1 Tests unitarios (`test/fluyo-018-7a.test.cjs`, `vm`; golden compartido `test/fixtures/fluyo-018-7a-golden.json` con fluyo-mcp)
- **F1:** `fluyo-018-7a-f1.test.cjs` (6 pruebas, §1.4) + matriz de §1.6.
- **`set_theme`:** válido/ inválido; `customBg` HEX, `null`, `""`, no HEX (entrada) vs cargado no HEX (se abre y no se toca); parche (solo `theme`, solo `customBg`, ambos); ninguna clave; campo desconocido; idempotente (`changed:false`, misma `resultRevision`); todo o nada con otra operación fallida en el lote; documentos v1–v4.
- **Z:** las 4 posiciones con 1 nodo, bloque contiguo, selección discontinua, selección vacía, ya en su sitio (`changed:false`), ids inexistentes, id de conexión, ids repetidos, orden de entrada irrelevante, conservación de la identidad de los objetos, `order` y `x/y` intactos, conexiones intactas; con refs; nodo eliminado en el mismo lote.
- **`duplicate_node`:** un nodo; varios; con y sin conexiones internas; conexión con un extremo fuera (no se copia); conexión seleccionada pero sin nodos (no se copia); Behaviors copiados; nodo usado por Steps (las Historias no cambian y siguen ejecutándose); waypoints desplazados; `offset` por defecto y explícito; ids nuevos consecutivos en orden de documento; **independencia del orden de listado**; agotamiento de ids sin copia parcial; `order`; copia de `img`; refs de copias y uso en el mismo lote; `DUPLICATE_REF`/`UNKNOWN_REF`; límites sobre el estado final (300/600/`coordMax`), reducción posible en documento antiguo; `created[]`; todo o nada.
- **Caracterización de `pasteClip`** (escrita **antes** del refactor): golden con el comportamiento actual; el nuevo `cloneStructureIn` debe igualarlo.
- **Invariantes comunes:** «Trace antes = Trace después» para theme/Z/duplicar; el JSON del documento no contiene refs ni claves nuevas; `FluyoIntegrity.validateProject` válido tras cada operación.
- **Contrato MCP** (`fluyo-mcp/test/fluyo-018-7a.test.ts`): el golden compartido; `describe_document` expone `theme`, `customBg`, `capabilities.themes`, `z`; tope de `tools/list` (según Q5); HTTP y stdio de punta a punta (`describe_document` → `author_document` con las tres operaciones → `describe_document`); mensajes de error sin trazas; `REQUIRE_FLUYO=1 npm test`.

### 8.2 Mutaciones (`test/fluyo-018-7a-mutations.cjs`, `fluyo-mcp/scripts/mutate-018-7a.ts`; sobre copias, patrón 018.x)
- F1: quitar el vaciado de `undoStack`; vaciar solo una de las dos pilas; vaciar aunque se cancele el `confirm`.
- `set_theme`: aceptar tema desconocido; aceptar `customBg` no HEX en autoría; pisar con `undefined`; error si el valor no cambia; escribir `null` en lugar de `""`; añadir `pushUndo`.
- Z: no conservar el orden relativo; ordenar por la lista de entrada; `changed` siempre `true`; `pushUndo` también sin cambio; tocar `order`; mover conexiones; `forward` e `backward` intercambiados; no reordenar los mismos objetos (clonar).
- `duplicate_node`: copiar conexiones no internas; olvidar Behaviors; no desplazar waypoints; reutilizar ids; ids por orden de listado; copiar Steps; reservar ids tras mutar (copia parcial); omitir los límites; no remapear `from/to`; `order` constante; `dupSel` que sigue pisando el portapapeles; `pasteClip` que no usa el dominio.

### 8.3 Paridad editor ↔ MCP
Mismas secuencias por el editor real (`vm`, arnés de 016/018) y por `author_document`: **documento idéntico (misma revisión)** para theme, las 4 posiciones Z (con selección contigua y discontinua) y `duplicate_node` (1 y N nodos, con conexiones y Behaviors); también con **secuencias aleatorias** (patrón `fluyo-017-2*`).

### 8.4 Chrome real (`test/fluyo-018-7a-browser.cjs`, Playwright externo vía `NODE_PATH`; working tree vs HEAD)
- **F1:** escenario A·B·C con ratón: editar B, borrar A, Ctrl+Z → C intacta; Ctrl+Y/Ctrl+Z sin efecto; editar tras borrar → Ctrl+Z funciona; cancelar el `confirm` no pierde el historial.
- **Tema:** `themeSel` y `customBg` (lienzo, exportar PNG/SVG/GIF, Viewer vía enlace, recarga persiste); Ctrl+Z **no** lo deshace (límite documentado).
- **Z:** los cuatro botones con 1 y varios nodos y selección discontinua; el hit-test coincide con lo pintado; no-op sin entrada de Undo; Ctrl+Z/Y; animación `build` intacta; botones durante Playback (para decidir Q2).
- **Duplicar:** Ctrl+D y menú «Duplicar» con 1 y N nodos, conexiones internas/externas, waypoints, Behaviors («No disponible» copiada), nodo usado por una Historia (la Historia sigue igual y se reproduce); selección final = lo nuevo; **el portapapeles del sistema no se pisa**; Ctrl+V posterior con el `clip` anterior; un solo Undo; duplicados sucesivos.
- **Share/Viewer:** enlace de un documento con tema/`customBg`, orden Z modificado y nodos duplicados: el Viewer dibuja el mismo orden y colores; Share de historia con nodo duplicado.
- **SW:** upgrade v63 → v64 (caché anterior → actual), offline.
- Viewports de escritorio y estrecho para pestañas y panel. Se mantienen fuera los 3 tests obsoletos conocidos de `fluyo-011-browser`.

### 8.5 Share/Viewer (también en tests `vm`)
`createShareUrl` + decodificación + `projectFromProjectData`: conserva `theme`, `customBg`, orden de `nodes[]`, copias duplicadas y Behaviors; `applyShareKind` sin cambios; Viewer (`viewer-harness`) dibuja en el orden recibido.

### 8.6 Undo/Redo
Z: una entrada por acción con cambio, ninguna sin cambio, Redo; duplicar: una entrada, Undo elimina nodos + conexiones + Behaviors copiados y deja ids sin reutilizar (contadores no bajan); tema: fuera de Undo (afirmado por test); F1: pilas vaciadas. Cobertura aleatoria de secuencias editar/Z/duplicar/deshacer/rehacer contra un modelo de referencia (sin borrar páginas).

### 8.7 Documentos antiguos
Fixtures v1–v4, `create_diagram` (v3 con `meta`), documento con `customBg` no HEX, con >300 nodos, con nodos sin `order`, con Behaviors huérfanos: se abren, `describe_document` los lee, y las tres operaciones los modifican sin invalidar lo no escrito.

### 8.8 Verificación final mínima
`node --test test/*.test.cjs` + mutaciones afectadas (018-3/018-5/018-6 y las nuevas); `node --check` de `js/*.js`, `sw.js`, tests; MCP: `npm test`, `REQUIRE_FLUYO=1 npm test`, `check:kernel`, `check:config`, `build`, mutaciones nuevas y las previas; stdio real de punta a punta; Chrome real; comprobar por diff que solo cambian los archivos esperados y que `CACHE` = v64.

---

## 9. Preguntas para tu revisión (con opción por defecto)

| # | Pregunta | Por defecto |
|---|---|---|
| Q1 | ¿Publico F1 **solo y antes** (SW v64 propio) o dentro del release único? | dentro del release, como **primer commit** (D12); si prefieres cerrarlo ya, bump propio y el release de 7a usa v65 |
| Q2 | Botones de Z (y `mDup`): ¿añadir guarda `editorFrozen()` como `deleteSel`? | sí, **si** Chrome confirma que son alcanzables en Playback; si no lo son, sin cambio |
| Q3 | Nombre de la operación: ¿`duplicate_node` con `nodes[]` (decidido) o `duplicate_nodes`? | `duplicate_node` con `nodes[]`, por tu decisión; alias descartado |
| Q4 | Undo de `dupSel`/`pasteClip`: ¿helper `pushUndoSnapshot` (snapshot antes, empujar si el dominio no lanza)? | sí (no deja entrada de Undo si `id_exhausted`) |
| Q5 | Tope de `tools/list` (61 939/62 000 hoy): ¿subir (propuesta 68 000) y/o recortar descripciones? | subir a 68 000 con presupuesto comentado + recorte de lo redundante |
| Q6 | Tras F1, el `confirm` de borrar página: ¿añadir «No se puede deshacer»? (la verdad desde ahora) | **no** en el hotfix mínimo; se rediseña en 018.7c con el impacto |
| Q7 | Conexiones copiadas sin ref en MCP (v1) | aceptado; si hace falta, `connectionRefs` después sin romper contrato |

**Detenido aquí.** No se implementa nada hasta tu revisión del diseño.


---

## Resultado (implementación)

Estado: **READY FOR COMMIT** en `fluyo` y `fluyo-mcp` (sin commit, push ni deploy). `CACHE` v63 → **v64** (un único bump). `kernelId` = `824b76566e3c0715562b79aff2013e0445a1e21fe11b588795c89885e25e777a` (`sync:kernel` ejecutado, `check:kernel` y `check:config` OK). Decisiones 99–102 en `DECISIONS.md`.

### Contrato final
- **F1**: la ✕ de página vacía `undoStack` y `redoStack` (`ui.js`). Sin tocar `cur` ni el mensaje.
- **`set_theme {theme?, customBg?}`**: `setThemeIn`; parche idempotente; `customBg` HEX/`null`/`""` en autoría; sin Undo. **`reorder_nodes {pageIndex, nodes, to}`**: `reorderedNodeIds`/`reorderNodesIn`; `front|back|forward|backward`; `changed:false` válido y sin Undo. **`duplicate_node {pageIndex, nodes:[{source,ref?}], connections?, offset?}`**: `duplicateNodesIn`/`cloneStructureIn`, una operación atómica y una sola entrada de Undo (snapshot previo; si el dominio falla, ninguna).
- Editor y MCP llaman a las mismas funciones de `model.js`; `pasteClip` también usa `cloneStructureIn`; `dupSel` ya no pasa por `copySel`.
- **16 tools**: `set_theme`, `reorder_nodes` y `duplicate_node` son tools de una operación (envuelven `authorDocument`) **y** operaciones de `author_document`. `tools/list` ≈ 69 790 caracteres (tope de QA 70 000). `describe_document`: `theme`, `customBg`, `capabilities.themes`, `z` por elemento.

### Archivos
Fluyo: `js/model.js`, `js/selection.js`, `js/ui.js`, `js/story-authoring.js`, `sw.js`, `.ai/ARCHITECTURE.md`, `.ai/DECISIONS.md`; tests nuevos `test/fluyo-018-7a-{f1,domain}.test.cjs`, `test/fluyo-018-7a.test.cjs`, `-harness.cjs`, `-mutations.cjs`, `-browser.cjs`, fixtures `fluyo-018-7a-golden.json` y `fluyo-018-7a-pasteclip-golden.json`; ajustados por contrato (v64 y 22→25 operaciones): `fluyo-010-qa`, `013`, `014`, `015`, `017-2`, `017-2-qa`.
fluyo-mcp: `src/authoring.ts`, `src/server.ts`, `src/stories.ts`, `src/generated/kernel-sources.ts`, `README.md`, `scripts/verify-deploy.sh` (exige exactamente 16), `scripts/mutate-018-7a.ts`; tests `fluyo-018-7a.test.ts`, golden compartido, y contratos 13→16 / tope 70 000 en `tools`, `http` (+3 casos de paridad), `fluyo-017-3`, `018-5`, `018-6`; `fluyo-017-1-qa` (describe ya publica tema y `z`).

### QA
- Fluyo `node --test test/*.test.cjs`: **912/912**. MCP `npm test` y `REQUIRE_FLUYO=1 npm test`: **550/550**. `build`, `check:kernel`, `check:config`, `node --check`, `git diff --check`: OK.
- Mutaciones nuevas: Fluyo **62/62**, MCP **33/33**. Previas Fluyo: 016 28, 017-3 31, 018-1 29, 018-2 26, 018-3 60, 018-4 18, 018-5 44, 018-6 17 (todas detectadas). Previas MCP: 017-3 30, 018-2 23, 018-3 36, 018-5 37 y 018-6 38 detectadas (todas al 100 %).
- stdio real (`node dist/index.js`): 16 tools; describe → set_theme → reorder_nodes → duplicate_node → describe con cadena de revisiones coherente; `INVALID_FIELD`/`REVISION_MISMATCH` estructurados.
- Chrome real (`fluyo-018-7a-browser.cjs`, contra HEAD): todo ✔. F1 reproducido en HEAD (C recibe el contenido de B) y corregido; tres temas con píxeles reales, `customBg` válido, persistencia, documento con `customBg` inválido, Share/Viewer; Z (4 acciones, Mayús+clic, marco, hit-test, conexiones bajo nodos, Playback activo y completado); duplicar (1 y varios, conexiones internas sí/externas no, Behaviors, waypoints, ids, selección, Undo/Redo, portapapeles, menú «Duplicar», Share/Viewer) y documento v3. Regresión de los browser previos: 018-3, 018-4, 017-3 y 016 OK (016 incluye el SW v64 offline).

### Desviaciones y hallazgos
- **Interpretación de «16 tools»**: tools de una operación además de las operaciones de `author_document` (ver arriba); a confirmar.
- **Q2**: smoke real en Chrome: durante Playback activo y completado los botones de orden no son visibles y no hay atajo; no se añadió `editorFrozen()`.
- **Selección múltiple de Z**: el panel de selección múltiple nunca tuvo botones de orden (también en HEAD): no hay ruta de UI para reordenar varios nodos; la función sí lo soporta.
- Ctrl+C → Ctrl+D → Ctrl+V: HEAD pegaba el duplicado (consecuencia de F5); ahora pega lo copiado.
- `fluyo-018-5-browser.cjs` reporta 1 fallo **previo**: asume que HEAD acepta nombres de página de 81 caracteres y HEAD ya incluye 018.5. `fluyo-011-browser`: 3 obsoletos conocidos (no ejecutado).
- Cambios en tests previos por contrato (no por comportamiento): v63→v64 y 22→25 operaciones.
- Pendiente 018.7c: `delete_page`, Undo por referencia, F2/F3/F4; las pruebas 2–4 de F1 se reescribirán entonces.
