# FLUYO-018.5 — Documento, páginas y reglas de entrada

Estado: **READY FOR COMMIT** (sin commit, push ni deploy). Continúa 018.4.1 (en producción: revisión `fluyo-mcp-00009-xnr`, 12 tools, `kernelId 90e70a27…a7a16`).

> Repo público: nada de este documento es confidencial.
> Bootstrap leído: `AGENTS.md`, `FLUYO-018.md` (§ páginas, límites), `FLUYO-018.2/.3/.4.md`, `model.js` (autoría 018.1–018.3), `story-authoring.js`, `state.js`, `ui.js` (pestañas de página), `fluyo-mcp/src/{authoring,stories,kernel,server}.ts`.

## 1. Auditoría (lo que existe hoy)

- Las páginas **no tienen id**: se identifican por `pageIndex`. Hoy solo existen en `ui.js` (`renderTabs`): el botón «＋» hace `doc.pages.push(blankPage("Página N+1"))` + `doc.cur`; el doble clic hace `pg.name = prompt(...)` (cualquier texto no vacío, sin límite). Borrar página (`splice`) no cambia en este slice.
- `author_document` solo conoce los scopes `story`, `page`, `eventType`. `create_page`/`rename_page` necesitan un scope nuevo, **`document`**, sin `pageIndex` en `create_page`.
- `createNodeIn` (018.1) valida forma y número, pero **no** el catálogo (`icon`, `anim`), el formato de color ni que `icon`/`anim` sean obligatorios en su forma; la normalización de la carga solo comprueba que sean cadenas. Un nodo `icon` sin `icon` se puede crear hoy.
- No hay topes de coordenadas, tamaño, nodos ni conexiones por página (solo el `guard_exceeded` del motor a 10 000).
- `BorderSchema` de MCP (compartido con `create_diagram`/`edit_diagram`, legacy) no incluye `none`; el dominio sí lo acepta.
- `capabilities.limits` de `describe_document` solo lleva los del motor de Historias.

## 2. Diseño

### 2.1 Una sola autoridad: páginas en `model.js`
`createPageIn(d, name?)` y `renamePageIn(d, pageIndex, name)` (puras sobre un documento `d`, errores `projectDataError`, nunca `TypeError`).

- `createPageIn`: añade **siempre al final**; sin nombre usa `"Página "+(n+1)` (el del editor); devuelve `{pageIndex, page}`. **No toca `d.cur`** (cambiar de página es del editor).
- `renamePageIn`: `pageIndex` entero existente (`page_not_found`), nombre cadena de 1..80 (`invalid_page_name`; vacío o solo espacios → rechazo). El nombre se guarda tal cual (como hacía el editor), no se recorta.
- Los nombres de páginas ya existentes (vacíos, >80) siguen cargándose: es regla de **entrada**, no de integridad.
- Editor: `state.js` añade `addPage()` / `renamePage(i,name)` (envoltorios como `editNode`); `ui.js` los usa en «＋» y doble clic. En el editor un nombre rechazado (>80) avisa con `alert`; vacío = cancelar (como hoy).

### 2.2 `FluyoAuthoring`
- Scope `document`: `create_page {name?}` y `rename_page {pageIndex, name}`. `changes[]`: `{entityKind:"page", pageIndex, name, created|renamed, from?}`. Las operaciones posteriores del lote usan ese `pageIndex` (se ve en el documento de trabajo del lote).
- Reglas de entrada de nodo (solo en autoría; `FluyoIntegrity` no cambia): color HEX `#rgb|#rrggbb|#rrggbbaa` en `color, fill, textBg, textColor, kwBg, kwColor` (null admitido donde el campo es anulable); `icon` y `anim` deben existir en `ICONS`/`ANIMS`; forma `icon` exige `icon`, forma `anim` exige `anim`; `border:"none"` válido. `update_node` valida solo las claves del **parche** (un valor antiguo inválido no se toca ni se revalida).
- Límites (`FluyoAuthoring.LIMITS`): `coordMax 100000`, `sizeMin 10`, `sizeMax 5000`, `maxNodesPerPage 300`, `maxConnectionsPerPage 600`.
  - Se evalúan **sobre el estado final del lote**, no por operación (crear y borrar en el mismo lote, o cruzar el tope y volver, es válido).
  - No son retroactivas: solo se comprueban (1) los **conteos** de las páginas cuyo nº de nodos/conexiones el lote **aumenta** respecto al documento de entrada, y (2) los **campos** `x,y,w,h` (y los puntos de `waypoints`) que el propio lote creó o escribió, y solo si el elemento sigue existiendo al final. Un documento antiguo que ya excede los topes se abre, se describe y se edita en lo demás.
  - Rechazo: `LIMIT_EXCEEDED {limit, limitName, actual, field, pageIndex, entity?, operationIndex}`, todo o nada.

### 2.3 MCP
`create_page`/`rename_page` en el schema (`scope:"document"`); `NodeSpec.border` acepta `none` (schema propio de autoría, **no** se toca `BorderSchema` legacy); `capabilities.limits` añade `maxNodesPerPage`, `maxConnectionsPerPage`, `coordMax` (más `sizeMin`/`sizeMax`), leídos del kernel; `authoringScopes` añade `document`; `edit_diagram` queda legacy (solo se documenta). `npm run sync:kernel`.

## 3. Fuera de alcance
`delete_page`, `duplicate_*`, orden Z, auto-layout, `set_theme`, `image` por MCP, enrutar `create_diagram`/`create_from_template`, retirada de `edit_diagram`, reglas que invaliden documentos antiguos, validación de colores de **conexión** (`lineColor`/`dotColor`: no estaba en el encargo; pendiente).

## Resultado
### Contrato
```jsonc
{ "op":"create_page", "scope":"document", "name"?:"1–80 caracteres" }          // añade al final; changes[]: {entityKind:"page", pageIndex, entityId, created:true, name}
{ "op":"rename_page", "scope":"document", "pageIndex":0, "name":"1–80" }       // changes[]: {pageIndex, renamed:true, from, to}
```
Errores: `INVALID_NAME` (vacío, solo espacios, >80, no texto), `PAGE_NOT_FOUND`, `INVALID_OPERATION` (pageIndex ausente/no entero, campos extra, `ref` en create_page), `SCOPE_MISMATCH`. Reglas de nodo: `INVALID_FIELD {field}`. Límites: `LIMIT_EXCEEDED {limit, limitName, actual, field, pageIndex, entity?, operationIndex, operation}` (se listan todos). `describe_document`: `capabilities.limits` += `maxNodesPerPage, maxConnectionsPerPage, coordMax, sizeMin, sizeMax`; `authoringScopes` += `document`.

### Decisiones y desviaciones
Ver decisiones 93–96 en `DECISIONS.md`. Desviaciones: (1) `sizeMin/sizeMax` publicados además de los tres pedidos; (2) los puntos de `waypoints` cuentan para `coordMax`; (3) validación de color en todos los campos de color de nodo (no solo `color`); (4) colores de conexión sin validar (pendiente); (5) no retroactividad definida como «solo lo que el lote escribe / solo conteos que el lote aumenta»; (6) en el editor un nombre >80 avisa con `alert` (único cambio visible); (7) el pin del `kernelId` de 018.4.1 en `fluyo-018-4-1.test.ts` se sustituyó por un chequeo de formato (el kernel cambia legítimamente); (8) paridad de Historias: el editor se simula con las mismas funciones de `model.js` que usa el panel (el panel ya está cubierto por 017.2).

### QA
- Fluyo: `node --test test/*.test.cjs` **872/872** (838 + 34); `node --check` OK; `git diff --check` OK (solo avisos LF/CRLF). Mutaciones `fluyo-018-5-mutations.cjs` **44/44**.
- MCP: `npm test` y `REQUIRE_FLUYO=1 npm test` **509/509** (480 + 29); `build`, `check:kernel`, `check:config` OK; mutaciones `scripts/mutate-018-5.ts` **37/37**. kernelId nuevo `4ae328f2…4882` (`sync:kernel` hecho).
- stdio real (`node dist/index.js`): 12 tools; describe con límites; create_page + nodos + conexión + rename en un lote; `resultRevision` = revisión de describe; `LIMIT_EXCEEDED`/`INVALID_FIELD` sin trazas; dryRun sin documento; `REVISION_MISMATCH`.
- Paridad: editor real vs `author_document` multipágina, `deepStrictEqual` + mismo texto (orden de claves), nextId, cur, Historias en página existente y nueva, Trace idéntico; golden `fluyo-018-5-golden.json` compartido (MCP lo compara con `resultRevision`).
- Chrome real (`fluyo-018-5-browser.cjs`, Chrome 154): 9 documentos intermedios idénticos a HEAD, ＋, renombrar, cambiar de página, Historias, Playback, Undo/Redo, guardar/reabrir, Share/Viewer; 0 errores. Solo difiere el nombre de 81 caracteres (por diseño).
- Browser previas: 013, 013-qa, 014, 015, 016, 017-3, 018-3, 018-4 (74 comprobaciones), 018-5, qa-share-hash y share-realistic-size **pasan**; `share` queda «NOT RUN — environment» (necesita el script de Umami: dependencia preexistente). `fluyo-018-3-browser` y `fluyo-018-4-browser` fallaron en un primer pase por **assertions obsoletas**: comparaban contra un HEAD con Behavior huérfano, pero HEAD ya incluye 018.4. Se actualizaron (HEAD: 0 huérfanos; el Viewer reproduce la Historia en WT y en HEAD) sin debilitar nada ni tocar producto, y ahora pasan. Las baterías MCP de mutación 018-2 y 018-3 tenían un ancla obsoleta (el import `BorderSchema` de `authoring.ts`, retirado por no usarse): actualizada, 23/23 y 36/36.
- `sw.js`: `CACHE` v62 → **v63** (cambian `model.js`, `state.js`, `ui.js`); pines de v62 actualizados en 4 tests; verificado que todos los assets de `index.html` y `s/index.html` están precacheados (`story-authoring.js` solo lo carga MCP).

### Fuera de alcance / pendientes
`delete_page`, `duplicate_*`, orden Z, auto-layout, `set_theme`, `image` por MCP, enrutar `create_diagram`/`create_from_template`, retirar `edit_diagram`, validar colores de conexión, `alert` nativo provisional (rediseño).

### Archivos
Fluyo: `js/model.js`, `js/state.js`, `js/ui.js`, `js/story-authoring.js`, `sw.js`; tests nuevos `fluyo-018-5.test.cjs`, `-mutations.cjs`, `-browser.cjs`, `fixtures/fluyo-018-5-golden.json`; pines v63 y alcance en `fluyo-010-qa`, `013`, `014`, `015`, `017-2-qa`, `018-3`; docs `.ai/ARCHITECTURE.md`, `.ai/DECISIONS.md`. fluyo-mcp: `src/authoring.ts`, `stories.ts`, `server.ts`, `generated/kernel-sources.ts`, `README.md`; tests `fluyo-018-5.test.ts`, `fixtures/stories/fluyo-018-5-golden.json`, `scripts/mutate-018-5.ts`, ajustes en `017-1`, `017-1-qa`, `017-3`, `018-4-1`.

