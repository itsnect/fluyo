# FLUYO-018.7 — `delete_page`, `set_theme`, orden Z y `duplicate_*`: auditoría y diseño

Estado: **AUDITORÍA Y DISEÑO — a la espera de decisiones del responsable.** No se ha modificado código, tests, `sw.js`, kernel ni `DECISIONS.md`. Sin commit, push ni deploy.
Fecha: 6 de octubre de 2026.
Owner/agente actual: libre.

> Repo público: nada de este documento es confidencial.
> Fuentes: `.ai/ARCHITECTURE.md`, `.ai/DECISIONS.md` (1–98), `FLUYO-018.md`, `018.2`–`018.6`; código de `fluyo/js` (`model.js`, `story-authoring.js`, `state.js`, `selection.js`, `ui.js`, `interaction.js`, `render.js`, `share-url.js`, `viewer.js`, `config.js`, `document-integrity.js`, `editor-scenarios.js`) y `fluyo-mcp/src` (`stories.ts`, `authoring.ts`, `diagram.ts`, `server.ts`, `revision.ts`). Estado de release comprobado: ambos repos con árbol limpio (`fluyo` e86c7c4, `fluyo-mcp` 44722e6), `sw.js` en `CACHE = "fluyo-static-v63"`.

## 0. Resumen ejecutivo (léelo primero)

1. **Hallazgo grave previo a todo diseño (F1, verificado con un spike):** el borrado de página actual **corrompe datos con Undo**. Los snapshots de Undo guardan el **índice** de página (`snapPage → {pi, data}`) y `applySnap` escribe `data` en `doc.pages[pi]`. Al borrar una página anterior, el índice apunta a **otra** página y Ctrl+Z **sobrescribe su contenido** (spike: 3 páginas A·B·C, snapshot de B, borrar A, Undo → C pasa a tener el contenido de B). La pila de Undo solo se vacía en `applyProjectData`. Es independiente de MCP y existe hoy en producción.
2. **`delete_page`** no se puede añadir a MCP «tal cual» sin decidir tres cosas: (a) qué es Undo para una operación de estructura de documento (hoy el Undo es **por página**), (b) cómo se comportan los `pageIndex` dentro de un lote cuando una página desaparece (los índices se desplazan y **todas** las tablas internas de `FluyoAuthoring` están indexadas por `pageIndex`), (c) la política de impacto. Recomendación de política en §4.4: **D — híbrida por frontera** (cascada intrínseca a la página + confirmación con impacto en el editor + guarda `expectedName` en MCP).
3. **Orden Z** y **`set_theme`** son pequeños y mecánicos: el orden Z **ya existe** (posición en `page.nodes[]`; **no** es el campo `order`, que es el orden de la animación `build`); el tema ya existe (`doc.theme` ∈ `{dark, crema, claro}` + `doc.customBg`). Ambos son dominio nuevo en `model.js` + wrappers del editor + operación `FluyoAuthoring`. `describe_document` hoy **no expone** ni el tema ni el orden Z: hay que añadirlos.
4. **`duplicate_*`**: duplicar un grupo de nodos ya existe en el editor (acoplado a `clip`/`selN`, y con un efecto lateral: **pisa el portapapeles del sistema**). Recomendación: extraer a dominio **nodos (con conexiones internas y Behaviors)**; **diferir** `duplicate_connection` (sin gesto en el editor y sin valor visual: una conexión paralela exacta se dibuja encima de la original); `duplicate_page` solo si se acepta una entrada mínima de UI.
5. **Todo toca `model.js` (asset servido y del kernel) ⇒ bump de `CACHE` (v63→v64), `sync:kernel` (nuevo `kernelId`), QA en Chrome real y deploy de ambos repos.** Propuesta de partir la implementación en tres sub-slices (a, b, c) con un único deploy (§8).

Decisiones que necesito de ti: **§9** (D1–D12). La más importante es D1 (política de `delete_page`).

---

## 1. Alcance

### Incluye (diseño; la implementación espera tu decisión)
- `delete_page` (dominio, editor, MCP, Undo, `doc.cur`, última página, lote).
- `set_theme` (dominio, editor, MCP, lectura en `describe_document`).
- Orden Z (`reorder_nodes`, dominio compartido con las cuatro acciones del editor).
- `duplicate_*`: qué entidades, y su autoridad de dominio (`duplicate_nodes`; `duplicate_page` condicionada; `duplicate_connection` y otras, diferidas).
- Cambios necesarios en `describe_document`/`capabilities`.

### No incluye
`image` por MCP, enrutar `create_diagram`/`create_template` por el kernel (018.8 en la hoja de ruta), retirar `edit_diagram`, rediseño de `alert`/`confirm` nativos, tope de páginas **salvo decisión D9**, ajustes del documento distintos del tema (`speed`, `dots`, `grid`, `font`… = `settings`), layout, tests obsoletos de `fluyo-011-browser`.

---

## 2. Auditoría del estado actual

### 2.1 Inventario de lo existente

| Operación | Editor hoy | Dominio (`model.js`) | `author_document` | `edit_diagram` (legacy) |
|---|---|---|---|---|
| Borrar página | `ui.js:468-477`: `pages.splice` + `confirm("¿Eliminar «X»?")`; ✕ solo con >1 páginas | **no existe** | no | no |
| Tema | `ui.js:382`: `doc.theme=…; scheduleAutosave()` (sin Undo) | solo normalización en la carga (`model.js:1001-1002`) | no | `set_theme` (`diagram.ts:358`) |
| Fondo personalizado | `ui.js:390-391`: `doc.customBg` | solo «es string» (`model.js:1004-1005`) | no | solo al crear (`create_diagram`) |
| Orden Z | `selection.js:127-158`: `bringToFront/sendToBack/bringForward/sendBackward` (reordenan `P().nodes`) | **no existe** | no | no |
| Duplicar nodos | `dupSel` = `copySel`+`pasteClip` (`selection.js:75`) | **no existe** (lógica en el editor) | no | no |
| Duplicar conexión / página | no existe | no | no | no |
| Duplicar Historia / Step | `duplicateScenario` / `duplicateStep` | sí | `duplicate_story`, `duplicate_step` | — |

### 2.2 Cómo representa el documento cada cosa

- **Orden visual (Z).** El documento **ya tiene** un sistema: la **posición en `page.nodes[]`**. `render.js:972/1005` dibuja `P().nodes` en orden (el último queda encima) y `interaction.js:15-22` hace el hit-test al revés (el último gana). **Las conexiones se dibujan siempre debajo de todos los nodos** (`render.js:970-972, 1004-1005`: primero `edges`, luego `nodes`): el orden Z solo existe **entre nodos**. El campo `order` de cada nodo **no es Z**: lo usa `render.js:22,26` para la animación `build` (`nodeAlpha`, `buildDuration`); las acciones de Z del editor **no lo tocan** (verificado: `bringToFront` solo reordena el array). El orden del array forma parte de la revisión (018 §17, `revision.ts` canoniza el JSON normalizado). `createNodeIn` añade al final ⇒ **el orden de creación es el orden Z inicial**. No hay `z`, ni se propone introducirlo.
- **Tema.** `config.js:54` define `THEMES = {dark, crema, claro}`, cada uno con `bg, grid, text, edge, edgeLbl, lblBg, codeBg, codeText, codeKwBg, codeKwText`. Persisten en el documento **solo dos campos**: `doc.theme` (nombre; la carga rechaza uno desconocido) y `doc.customBg` (string; la carga solo exige que sea `string`, el render lo usa como `fillStyle`; vacío = el del tema). Los colores de nodo son HEX literales, **no** relativos al tema: el tema afecta al fondo, rejilla, texto por defecto, conexiones, etiquetas y bloques `code`. Los tres renderers (lienzo, `export.js` SVG, `svg.ts` de MCP) leen `THEMES` del kernel. Los exportadores SVG no pintan fondo (verificado: sin `.bg`), así que `customBg` solo se ve en lienzo/PNG/GIF/Viewer. El resto de ajustes visuales (`speed, dots, build, stagger, grid, snap, font, single`) son `settings`, **no** tema.
- **Páginas.** `doc.pages[]` sin id; se identifican por posición (018.5/decisión 93). Una página contiene **todo** lo suyo: `nodes, edges, nextId, behaviors, scenarios, nextScenarioId`. Los ids de nodo/conexión/Historia/Step son **por página**. No hay **ninguna referencia entre páginas** (verificado: Steps apuntan a `nodeId/edgeId` de su página; Behaviors a nodos de su página). Lo único global son los **EventTypes** (`doc.eventTypes`, `nextEventTypeId`), que las Historias referencian por id. `doc.cur` (página activa) **se persiste**; la carga lo recorta (`clamp(…, 0, len-1)`).
- **Mínimo de páginas.** La carga **exige ≥1 página** (`model.js:995`: `pages.length` falsy ⇒ `projectDataError`); el Viewer y el kernel MCP (`normalizedProject`) también. Un documento con 0 páginas es ilegible (`DOCUMENT_UNREADABLE`).

### 2.3 Undo/Redo hoy
`snapPage()` = `{pi:doc.cur, data:deep(P())}`; `applySnap` recorta `pi`, y **sustituye** `nodes/edges/behaviors/scenarios` de `doc.pages[pi]` (los contadores no bajan). Pila de 60, se vacía **solo** en `applyProjectData`. Consecuencias:
- Es **por página y por índice**. Lo que no es contenido de página (tema, `customBg`, EventTypes, **lista de páginas**, `cur`) **no se deshace** (decisión 82).
- Crear una página añade al final: no desplaza índices, por eso nunca se manifestó. **Borrar** (y cualquier inserción/borrado en medio) desplaza índices ⇒ F1.
- «Limpiar página» (`clearPageContents`) **sí** se deshace (es contenido de página).

### 2.4 Share/Viewer
- `createShareUrl` normaliza una **copia** del documento actual y la codifica; `applyShareKind` usa `doc.cur` (la Historia compartida es una de la página abierta). El Viewer lee `doc.pages`, `doc.cur`, `doc.theme`, `doc.customBg` y nodos en el orden del array.
- No hay estado compartido entre un enlace ya creado y el documento: **borrar una página no invalida ningún enlace existente** (son snapshots inmutables). Lo que sí importa: el documento resultante debe tener ≥1 página y `cur` válido (si no, `applyShareKind` indexaría fuera de rango), y duplicar páginas/nodos agranda el payload (`MAX_SHARE_URL_LENGTH = 65536`, ya gestionado con `too_large`).

### 2.5 Estado de `describe_document` / `capabilities`
Hoy devuelve `currentPageIndex`, páginas con `nodes[{id,label,shape,icon,x,y,w,h}]` **en orden de array** (sin `z`), `bounds`, `behaviors`, y `capabilities {readsDocumentVersions, engineVersion, eventPrimitives, stepActions, limits, tools, authoring, authoringScopes:["story","page","eventType","document"]}`. **No expone** `theme`, `customBg` ni los temas válidos; el orden Z solo es deducible por la posición en la lista (no documentado).

---

## 3. Problemas encontrados

| # | Hallazgo | Gravedad | Dónde |
|---|---|---|---|
| **F1** | **Undo corrompe datos tras borrar página** (los snapshots llevan índice). Reproducido en `vm` con el `selection.js` y `model.js` reales (spike 1, anexo). | **Alta** (pérdida de datos, hoy en producción) | `selection.js:162-165`, `ui.js:473` |
| F2 | Al borrar una página **anterior** a la activa, `doc.cur=Math.min(cur,len-1)` deja `cur` apuntando a **otra** página (con ≥4 páginas, `cur=2` y borrar la 0 ⇒ `cur` sigue en 2, que ahora es la antigua 3). | Media | `ui.js:474` |
| F3 | El `confirm` de borrar página **no nombra el contenido** (nodos, Historias): borra Historias sin avisar de ellas (018.6 §1, confirmado). | Media | `ui.js:472` |
| F4 | ✕ de página **sin guarda de Playback** (otras estructurales: `scReset`, decisión 64; `deleteSel` está bloqueado por `editorFrozen`). Cambiar de página sí hace `scReset` vía `scSyncPage` (identidad de página), pero la ✕ no pasa por `renderTabs` antes de actuar sobre el Playback en curso: **por verificar en Chrome**. | Baja–media | `ui.js:471` |
| F5 | `dupSel` llama a `copySel`, que **escribe `fluyo::…` en el portapapeles del sistema** (`navigator.clipboard.writeText`): Ctrl+D pisa lo que la persona tuviera copiado. | Media (efecto lateral) | `selection.js:42,75` |
| F6 | `copySel` ignora `selE`: las conexiones copiadas son **todas las internas** a los nodos seleccionados (aunque no estén seleccionadas) y una conexión sola no se puede copiar/duplicar. | Informativa (comportamiento a conservar) | `selection.js:34-39` |
| F7 | `bringToFront/sendToBack/bringForward/sendBackward` hacen `pushUndo()` **siempre**, también cuando no cambia nada (nodo ya al frente) ⇒ entradas de Undo vacías; y no tienen guarda `editorFrozen` (por verificar si los botones están accesibles en Playback). | Baja | `selection.js:127-158` |
| F8 | `bringForward/sendBackward` mueven **un paso** cada bloque contiguo; con una selección discontinua el resultado depende del recorrido. Es el comportamiento actual: se conserva como regla. | Informativa | `selection.js:141-158` |
| F9 | `themeSel` y `customBg` **no entran en Undo** ni en `pushUndo`, y `customBg` acepta en la carga cualquier `string`. Para autoría hay que decidir validación (HEX) como en 94/97. | Baja | `ui.js:382,390`, `model.js:1004` |
| F10 | `describe_document` no publica tema ni `customBg`; un agente no puede saber el tema actual ni el orden Z de forma explícita. | Media (paridad de lectura) | `stories.ts` |
| F11 | `create_page` sigue sin tope de páginas (D3 de 018.6); `duplicate_page` lo agravaría (crecimiento exponencial de payload). | Baja (condicional) | — |
| F12 | **Todas** las tablas internas de `FluyoAuthoring` están indexadas por `pageIndex` (`diagramRefs`, `created`, `deleted`, `watch`, `countOps`, `baseCounts`, `touched` = `"${pageIndex}:${storyId}"`, `ctx.refs.stories`…). Un `delete_page` que desplace índices a mitad de lote las invalidaría. | **Diseño crítico** | `story-authoring.js:316-405, 839-895` |

---

## 4. `delete_page`

### 4.1 Comportamiento actual (resumen)
✕ en la pestaña (solo con ≥2 páginas) → `confirm("¿Eliminar «nombre»?")` → `splice`; `cur=min(cur,len-1)`; `clearSel`; `renderTabs`; autoguardado. Sin Undo (y con F1), sin aviso de Historias, sin guarda de Playback.

### 4.2 Qué depende de una página (verificado)
| Entidad | ¿Depende de la página? | Al borrarla |
|---|---|---|
| Nodos, conexiones | Sí (contenidas) | desaparecen |
| Behaviors (disponibilidad inicial) | Sí (`nodeId` de la página) | desaparecen **con su página** (no quedan huérfanos: la página entera se va) |
| Historias y Steps | Sí (contenidas; sus destinos son de la misma página) | desaparecen con la página; **nada queda colgando** |
| EventTypes | **No** (globales; solo los Steps los referencian) | se conservan; `usedBy` baja; un EventType que solo usaba esa página queda **sin usos** (editable en primitiva y borrable, decisión 79). No hay cascada |
| `nextId`, `nextScenarioId`, `nextStepId` | de la página | desaparecen con ella; no hay contador global afectado (`nextEventTypeId` no cambia). Los ids nunca se reutilizan **dentro** de una página viva |
| `doc.cur` | Sí (índice) | debe recalcularse (§4.5) |
| Enlaces Share ya creados | No | intactos |
| Historia activa (`scActiveId`) | efímera, por identidad de página | `scSyncPage` la descarta |

**Idea clave:** a diferencia de borrar un nodo (que deja Steps colgando y por eso existe B2), **borrar una página no rompe ninguna referencia**: la integridad referencial no es el problema. El problema es **pérdida de contenido narrativo** (Historias) y de trabajo, y la **irreversibilidad**.

### 4.3 Alternativas de política (las pedidas y una más)

**A. Bloquear si la página tiene Historias/dependencias.**
- Pros: seguro por defecto; ningún contenido narrativo se pierde por accidente; en MCP es composable (`delete_story` ×N + `delete_page` en el mismo lote: el estado final es válido).
- Contras: en el **editor** es un callejón sin salida para una persona (borrar Historias una a una antes de poder cerrar una página); la 018.4 descartó exactamente esto para nodos (decisión 91). «Dependencias» casi siempre = nodos, así que bloquear por contenido equivale a «solo se borran páginas vacías». Y no protege de lo realmente irrecuperable (los nodos).
- Veredicto: **no** para el editor. Para MCP solo tendría sentido limitado a Historias, y entonces es una versión de D (ver abajo).

**B. Confirmar mostrando el impacto y permitir eliminar.**
- Pros: coherente con 91 (editor confirma, no bloquea, no modifica Historias en silencio); la persona ve qué pierde («Página X: 14 elementos, 3 Historias, 22 momentos»). Con Undo, la confirmación incluso es opcional.
- Contras: **MCP no puede confirmar** (agente por lotes, sin vista): B no define qué hace MCP. El `confirm()` nativo es provisional (deuda conocida).
- Veredicto: **es la política del editor**; necesita complemento para MCP.

**C. Eliminar la página y limpiar dependencias (cascada pura).**
- Pros: es lo que ya hace el dominio de forma natural: la página lleva sus Historias y Behaviors consigo; no hay nada que «limpiar» fuera (no hay referencias entre páginas). Simple, determinista, atómico, composable.
- Contras: «silencioso» en MCP es el mayor radio de explosión de toda la API (una operación borra una página entera), irreversible vía MCP (no hay Undo; solo `baseRevision`/`dryRun`). El riesgo real no es la cascada sino **borrar la página equivocada** (el `pageIndex` es posicional).
- Veredicto: correcto como **semántica de dominio**; insuficiente como **política de frontera**.

**D. Híbrida por frontera: cascada intrínseca + confirmación con impacto + deshacer (editor) y guarda explícita de intención (MCP). — RECOMENDADA.**
- **Dominio** (`deletePageIn`): cascada intrínseca (C), todo o nada, con **detección compartida** de impacto (`pageRemovalImpactIn`: nodos, conexiones, Behaviors, Historias con sus momentos, EventTypes que quedarían sin uso) — la misma fuente para el aviso del editor y el `affects` de MCP, como `FluyoIntegrity.removalImpact` (decisión 71).
- **Editor** (B + Undo): `confirm` **siempre** (como hoy) pero con el impacto cuando la página no está vacía; sin Historias ni elementos, mensaje corto. **Deshacer restaura la página completa** (§4.7). Con Undo, la confirmación pasa de «última defensa» a «aviso».
- **MCP**: permitido, atómico, con cascada **informada** en `changes[].affects` (como `delete_node`, decisión 90), y con una **guarda de intención**: `expectedName` obligatorio (debe coincidir **exactamente** con el nombre de la página en `pageIndex`; si no, `PAGE_MISMATCH` y se rechaza todo el lote). Cuesta una cadena que el agente ya tiene de `describe_document` y elimina el error realista (índice equivocado). `dryRun` y `baseRevision` siguen aplicando.
- **No hay bloqueo por Historias** (a diferencia de A): borrar una Historia por MCP ya es posible sin protección (`delete_story`), y la página es solo su contenedor; consistente con el precedente. Sí se bloquea la **última página** (§4.6).
- Contra: dos «dialectos» (confirma vs. guarda) — el mismo patrón ya aceptado en 91 (editor confirma, MCP rechaza) y en 71.

**Variante D′ (si prefieres más protección en MCP):** además de `expectedName`, exigir `acknowledgeStories:true` cuando la página tiene Historias (rechazo `PAGE_HAS_STORIES` con el listado). Más seguro, más fricción, y rompe la analogía con `delete_story`. Lo dejo como decisión (D2).

**Recomendación: D.** Razón: la cascada es intrínseca (no hay dependencias externas), la pérdida real es de **trabajo**, y eso se mitiga con Undo + aviso en el editor y con una guarda de intención en MCP; bloquear (A) maltrata a la persona y limpiar en silencio (C) maltrata al agente.

### 4.4 Preguntas concretas que pediste

- **`doc.cur` al borrar la actual:** regla única del dominio (porque `cur` es campo persistido y el borrado lo desplaza): sea `i` el índice borrado — si `i < cur` ⇒ `cur-1`; si `i == cur` ⇒ la página que queda **en la posición `i`** (la siguiente), o la anterior si era la última (`min(i, len-1)`); si `i > cur` ⇒ sin cambio. Corrige F2. El resultado se informa (`cur:{from,to}`). Distinto de `create_page` (que no toca `cur`: allí no hay desplazamiento y cambiar de página es navegación).
- **Borrar la última página / ¿siempre ≥1 página?** **Sí, siempre al menos una**: es un **invariante del formato** (la carga, el Viewer y el kernel rechazan 0 páginas). Dominio: error `last_page` ⇒ MCP `CANNOT_DELETE_LAST_PAGE`; editor: ✕ oculta con 1 página (ya ocurre). Alternativa para vaciar: «Limpiar página» (ya existe y se deshace). Cambiar el invariante (documento con 0 páginas) requeriría migrar la carga/Viewer/kernel: fuera de alcance, no recomendado.
- **IDs, `nextId` y referencias:** los ids son por página; no hay referencias entre páginas ni contadores globales afectados (la página y sus contadores desaparecen juntos). Una página nueva posterior empieza en `nextId:1`; no hay colisión posible. Si Undo restaura la página, restaura **el mismo objeto** con sus contadores (los ids siguen siendo irreutilizables dentro de ella).
- **¿Undo puede restaurar una página completa?** Hoy **no** (F1). Con el rediseño de §4.5 **sí**: la entrada de Undo guarda el objeto página y su posición; deshacer lo reinserta, rehacer lo vuelve a quitar.
- **Historias que apuntaban a esa página:** al ser contenido de la página, **se van con ella**; nada queda colgando. El impacto las lista (nombre, nº de momentos). Un enlace Share ya emitido no se ve afectado.
- **Behaviors de sus nodos:** desaparecen con la página (no hay Behavior huérfano posible, a diferencia de 92 donde el nodo se iba y la página no).
- **EventTypes:** intactos. Pueden quedar sin uso (se informa en el impacto como dato, no como acción).

### 4.5 Undo/Redo (tres opciones)

- **U1 — Vaciar las pilas al borrar/insertar páginas.** 1–2 líneas; elimina F1; pero destruye todo el historial por una acción, y borrar página sigue sin deshacerse. Válido como **parche urgente**.
- **U2 — Entradas de Undo por identidad de página + operación de estructura (RECOMENDADA).** El snapshot guarda la **referencia al objeto página** (no el índice): `applySnap` localiza `doc.pages.indexOf(page)` (si la página ya no está, la entrada se descarta sin tocar nada). Se añaden dos tipos de entrada de estructura: `deletePage{index,page}` (deshacer = reinsertar **el mismo objeto** en `index`; rehacer = quitarlo) y `insertPage{index,page}` para `duplicate_page`/`create_page`. Como la página restaurada es el **mismo objeto**, los snapshots anteriores de esa página **vuelven a ser válidos**. Cubre F1 de raíz. Coste: tocar `selection.js` (Undo), tests nuevos (incl. secuencias aleatorias), QA en Chrome. `scSyncPage` ya funciona por identidad de página. `cur` se restaura con la entrada. Límite 60 entradas igual que hoy.
- **U3 — No deshacer, solo corregir los índices** (desplazar `pi` de las entradas al borrar). Evita F1 pero «borrar página» sigue siendo irreversible y exige reescribir las entradas.

**Recomendación: U2**, y entretanto (si no se implementa 018.7c pronto) **U1 como hotfix** aparte (decisión D3). Tema y `customBg` **siguen fuera de Undo** (consistente con decisión 82; deshacerlos exigiría Undo de documento): ver §5.

### 4.6 Lote MCP: índices que se desplazan (F12)

Opciones:
- **P-A (RECOMENDADA): índices estables dentro del lote + compactación al final + `pageMap`.** Dentro de un lote, `pageIndex` significa «la posición al empezar el lote (más las páginas que `create_page` añadió al final)». `delete_page` **marca** la página (tombstone) y **no** desplaza nada; las operaciones posteriores sobre una página marcada fallan con `PAGE_DELETED` (con la operación que la borró, como `deletedNote` ya hace con nodos); al terminar el lote se **compacta**, se recalcula `cur` con la regla del §4.4 y se valida el **estado final** con `FluyoIntegrity`. La respuesta añade `pageMap:[{from, to|null}]` para que el agente actualice sus índices tras el lote. Ninguna tabla interna cambia de clave. Coherente con «el estado final decide» (decisiones 75/89/95).
- P-B: borrar y desplazar en el acto (índices «vivos»): las tablas internas (F12) y las refs de lotes previos quedan inconsistentes ⇒ alto riesgo. Descartada.
- P-C: permitir `delete_page` solo como operaciones finales del lote, en orden descendente de índice. Sencillo, pero impone un orden al agente y no resuelve `create_page`+uso+`delete_page`. Es el plan B si P-A resulta demasiado invasivo.

También para `duplicate_page`: **se añade siempre al final** (como `create_page`, decisión 93) para que no desplace índices; ver D6.

### 4.7 Contrato propuesto

**Dominio (`model.js`)**
- `pageRemovalImpactIn(d, pageIndex)` → `{pageIndex, name, nodes, connections, behaviors, stories:[{storyId, name, moments, steps}], eventTypesFreed:[id], isCurrent, isLast}` (pura; la usan el `confirm` del editor y `affects` de MCP).
- `deletePageIn(d, pageIndex)` → `{pageIndex, page, impact, cur:{from,to}}`; errores: `page_not_found(pageIndex)`, `last_page`. Aplica la regla de `cur`. Todo o nada. No toca EventTypes.
- `restorePageIn(d, index, page, cur?)` — inserción de un objeto página existente (Undo). 
- Nota: el editor sigue siendo dueño de `clearSel`, `scReset`, `renderTabs`, Undo y autoguardado.

**`FluyoAuthoring` (scope `document`)**
```jsonc
{ "op": "delete_page", "scope": "document", "pageIndex": 2, "expectedName": "Pagos" }
```
- Errores: `PAGE_NOT_FOUND`, `PAGE_MISMATCH {pageIndex, expectedName, actualName}`, `CANNOT_DELETE_LAST_PAGE`, `PAGE_DELETED` (uso posterior en el lote), `INVALID_FIELD`.
- `changes[]`: `{operation:"delete_page", entityKind:"page", entityId:pageIndex, deleted:true, name, affects:{pages:{nodes,connections,behaviors}, stories:[{pageIndex,storyId,name,moments,deleted:true}], eventTypesFreed:[…]}, cur:{from,to}}`.
- Respuesta del lote: `pageMap` (siempre presente cuando hay `delete_page`; opcional vacío si no).
- B2: sin cambio (no hay entidades de otra página que apunten a ésta). El estado final (≥1 página, `cur` válido, todas las Historias restantes ejecutables) lo valida el flujo normal.
- Límites: sin nuevos; la guarda de «≥1 página» es regla de dominio, no un límite de autoría.

**Editor**
- La ✕ pasa por `deletePageWithConfirm(i)` (en `selection.js` o `state.js`): `scReset()` si hay Playback (decisión 64) → impacto → `confirm` con el mensaje de impacto (no vacía) → `pushUndo`-de-estructura → `deletePageIn` → `clearSel`/`renderTabs`/autoguardado. Cancelar no deja entrada de Undo (el diálogo va antes, como 91).
- Mensaje propuesto: «La página «Pagos» tiene 14 elementos y 2 Historias (7 momentos). Si la eliminas se pierde todo esto (puedes deshacerlo con Ctrl+Z). ¿Eliminar página?». Sin contenido: «¿Eliminar «X»?».

**Selección múltiple:** no aplica (una página a la vez). Al borrar, `clearSel()`.

---

## 5. `set_theme`

### 5.1 Comportamiento actual
`<select id="themeSel">` (`ui.js:382`) escribe `doc.theme` y programa autoguardado; `customBg` (color nativo + «✕») escribe `doc.customBg`. Sin Undo, sin validación (el `<select>` y `<input type=color>` solo producen valores válidos). Render, PNG/GIF/SVG, Viewer y `svg.ts` leen el tema de `THEMES` (kernel).

### 5.2 Qué debe ser autorable por MCP
- **`theme`** (enum `dark|crema|claro`) — sí. Lo único que `edit_diagram.set_theme` hace hoy.
- **`customBg`** (HEX o `null`/vacío = el del tema) — **recomendado incluirlo** en la misma operación: es parte de «cómo se ve el lienzo», vive en el mismo objeto del documento y el panel lo muestra junto al tema. Regla de entrada **HEX** (`#rgb|#rrggbb|#rrggbbaa`, mismo `HEX_COLOR` de 94/97), no retroactiva.
- **No** `settings` (`speed, dots, build, stagger, grid, snap, font, single`): son preferencias de reproducción/edición, no tema. Si se quieren, serán una operación propia (`set_settings`), fuera de 018.7.
- **No** colores de nodo ni «recoloreo masivo por tema» (los colores de nodo son HEX literales).
- Riesgo de contraste conocido: un `customBg` oscuro con tema claro deja texto ilegible. Es una elección de autor, igual que en el editor; se **documenta**, no se valida.

### 5.3 Dominio y contrato
- `setThemeIn(d, {theme?, customBg?})` en `model.js`: `theme` debe ser clave propia de `THEMES` (`invalid_theme`), `customBg` string (`""`/`null`→`""`) — la regla HEX de **entrada** vive en `FluyoAuthoring` (no retroactiva: un `customBg` antiguo no HEX se abre y se conserva, como 94). Devuelve `{theme:{from,to}, customBg:{from,to}}`; **parche**: lo no enviado no cambia (`undefined` no pisa, como 87). Al menos un campo (`INVALID_OPERATION` si ninguno).
- `FluyoAuthoring`: `set_theme {theme?, customBg?}` scope `document`. Errores: `INVALID_FIELD {field:"theme"|"customBg"}`. `changes[]` con `from/to`.
- Editor: `themeSel.onchange` y `bgCustom.oninput`/`btnBgClear` llaman a `setThemeIn(doc, …)` (se conserva el autoguardado; **sin** `pushUndo`, F9). `oninput` del color dispara muchas veces: sin Undo no hay problema.
- **Undo:** sin cambio (el tema es del documento, no de la página; decisión 82). Documentado como límite conocido. Alternativa (Undo de documento) descartada por alcance.
- **Selección múltiple:** n/a.
- **Share/Viewer:** el tema y `customBg` ya viajan en el documento; no hay cambio. `applyShareKind` no los toca.
- **Historias/Steps/EventTypes/Behaviors:** sin impacto (presentación pura; `presentation` de EventTypes usa colores propios).
- **Revisión:** `theme` y `customBg` forman parte de la revisión normalizada ⇒ `set_theme` cambia `resultRevision`; idempotente (mismo valor ⇒ `resultRevision` = `baseRevision`; **no es error**).
- **`describe_document`:** añadir `theme`, `customBg` (`""` si no hay) y `capabilities.themes:["dark","crema","claro"]` leídos del kernel (`THEMES`), no duplicados en `src/`.

---

## 6. Orden Z

### 6.1 Comportamiento actual
Cuatro acciones sobre `selN` (solo nodos; la selección de conexiones se ignora): **al frente / al fondo / subir una capa / bajar una capa**, con botones de panel. Reordenan `P().nodes`; el orden relativo de la selección se conserva; `pushUndo` siempre (F7). `order` (animación `build`) no se toca: **visual y animación quedan desacoplados por diseño** (se documenta, no se «arregla»).

### 6.2 Autoridad correcta
Dominio compartido `reorderNodesIn(pg, ids, placement)` en `model.js`, con `placement ∈ {"front","back","forward","backward"}` (las cuatro del editor, **misma semántica incluida F8**). Devuelve `{changed, from:[ids…], to:[ids…]}`; **`changed:false` ⇒ el editor no hace `pushUndo`** (corrige F7). Reglas: `ids` deben existir (`node_not_found`), duplicados ignorados, vacío ⇒ error; el orden relativo de los afectados se conserva **tal como está en el documento** (no el orden en que se listaron: paridad con el editor).

### 6.3 Contrato MCP
```jsonc
{ "op": "reorder_nodes", "scope": "page", "pageIndex": 0,
  "nodes": [ {"id": 4}, {"ref": "fondo"} ], "to": "back" }
```
- Entidades por `{id}` o `{ref}` (misma resolución que `update_node`); `to` obligatorio con las cuatro posiciones. Sin posiciones relativas («encima de X»): no existen en el editor y para eso basta el orden de creación; se pueden añadir después sin romper el contrato.
- `changes[]`: `{operation:"reorder_nodes", entityKind:"node", affects:{order:{from:[…], to:[…]}}, changed}`. Un no-op es válido (`changed:false`).
- Atomicidad/revisión: el orden del array está en la revisión; la operación entra en el lote atómico igual que `update_node`. Con `create_node` en el mismo lote, el orden Z es el de aplicación.
- Impacto sobre Historias/Steps/EventTypes/Behaviors: **ninguno** (todo se referencia por id); el Trace no cambia (test de «Trace antes = Trace después»). Playback/Share/Viewer: el Viewer dibuja el array ⇒ el orden se conserva.
- Undo (editor): una entrada por acción **solo si `changed`**.
- Límites: ninguno nuevo.
- **Selección múltiple:** soportada (es el caso normal del editor); la operación MCP admite una lista. Conexiones seleccionadas: se ignoran (no tienen Z propio).
- `describe_document`: añadir `z` (0 = fondo) a cada nodo de `pages[].nodes` y documentar «lista en orden Z, de fondo a frente». Crecimiento de tamaño: pequeño; vigilar el tope de `tools/list` (62 000) por las descripciones nuevas.

---

## 7. `duplicate_*`

### 7.1 Estado actual de lo duplicable
- **Nodos (grupo):** `dupSel` = `copySel` (nodos seleccionados + conexiones **internas** + Behaviors de esos nodos → `clip`) + `pasteClip` (reserva ids en lote con `reserveStructureIds`, desplaza `GRID`=20 en x/y, asigna `order = nodes.length` creciente, remapea `from/to` y `nodeId` de Behaviors, **desplaza los waypoints** igual que el nodo, selecciona lo nuevo, **un** `pushUndo`). Luego `dupSel` restaura `clip` (pegados sucesivos intactos). No copia Historias ni Steps. Efectos laterales: F5 (pisa el portapapeles del sistema), F6 (ignora `selE`).
- **Conexión sola:** no existe.
- **Página:** no existe.
- **Historia / Step:** existen (`duplicate_story`, `duplicate_step`; fuera de 018.7).
- **EventType:** no existe en ninguna frontera.

### 7.2 Qué se duplica en 018.7 (recomendación)

| Entidad | 018.7 | Motivo |
|---|---|---|
| **Nodos (uno o varios) + conexiones internas + Behaviors** | **Sí** → `duplicate_nodes` | Existe en el editor; paridad directa; valor real (clonar un componente) |
| Conexión sola (`duplicate_connection`) | **No (diferir)** | Sin gesto en el editor; una conexión paralela idéntica se dibuja encima de la original (sin offset de rutas paralelas) ⇒ sin valor visual; si se necesita, `create_connection` ya lo cubre |
| **Página** (`duplicate_page`) | **Condicional** (D6) | Valor alto (variantes, plantillas) y reutiliza la infraestructura de Undo de estructura de §4.5, pero **no tiene gesto en el editor** (haría falta menú de pestaña o botón: decisión de UX) |
| Historia / Step | Ya existen | — |
| EventType | No | Sin demanda; `create_event_type` basta |

### 7.3 Reglas de `duplicate_nodes` (dominio compartido)

Autoridad: `cloneStructureIn(pg, snapshot{nodes,edges,behaviors}, {dx,dy})` en `model.js` — **la misma** función para `pasteClip` (que puede pegar en **otra** página, hoy también sin dominio) y `duplicateNodesIn(pg, ids, opts)` (snapshot = la propia página). Un solo sitio para ids, remapeo y desplazamiento.

- **IDs:** nuevos, de `reserveStructureIds` en **un solo lote reservado antes de mutar** (todo o nada; agotamiento ⇒ `id_exhausted` sin pegado parcial, como hoy). `order` de cada copia = `nodes.length` en el momento de insertarla (igual que hoy: la copia se anima al final y queda **encima** en Z, porque se añade al final del array).
- **Refs:** las copias no se persisten con ref; en MCP cada entrada admite `ref` propia para poder usar la copia en el mismo lote (`create_connection`, `reorder_nodes`, Steps…). Las refs de copias se publican en `refs[]`.
- **Conexiones:** solo las **internas** (ambos extremos dentro del conjunto duplicado), remapeadas; las que unen a un nodo no duplicado **no** se copian (paridad F6). `lineColor/dotColor/etiqueta/ruta/lados/waypoints` se copian tal cual. Opción MCP `connections: "internal"` (por defecto) | `"none"`.
- **Geometría y waypoints:** desplazamiento explícito `offset {x,y}` (por defecto el del editor, `GRID`=20,20); se aplica a `x,y` de nodos y a **cada waypoint** de las conexiones copiadas (como `pasteClip`). El dominio **no hace snap ni redondea** (decisión 84); el editor aplica el suyo si lo desea. Límite de autoría `coordMax` sobre el estado final.
- **Behaviors:** **se copian** (paridad: una copia de un nodo «DOWN» nace «DOWN»). No cambia ninguna Historia existente (la copia no está en sus Steps); el Trace de las Historias existentes no cambia (test).
- **Historias/Steps:** **nunca** se duplican ni se redirigen; los Steps siguen apuntando al original. **EventTypes:** intactos.
- **Imágenes (`img`)**: se copia el dato saneado (deep copy); duplica el peso del documento (el límite de Share ya lo avisa).
- **Selección (editor):** tras duplicar, queda seleccionado **solo lo nuevo** (nodos + conexiones copiadas), como hoy. **Selección múltiple:** el caso normal; las conexiones seleccionadas se ignoran (F6, paridad). Sin nodos seleccionados no hace nada.
- **Portapapeles del sistema:** `dupSel` **dejará de escribir** en él (F5): el dominio no necesita `copySel`. Es un cambio visible (a mejor) a registrar.
- **Límites de autoría (MCP):** `maxNodesPerPage` (300) y `maxConnectionsPerPage` (600) sobre el estado final del lote, solo si el lote los **aumenta** (decisión 95); el editor sigue sin topes (paridad con pegar hoy).
- **Atomicidad y revisión:** una operación = un bloque atómico dentro del lote; `resultRevision` determinista (ids asignados en orden de la lista, que se canoniza por id de origen **ascendente** para que el orden de listado no cambie el resultado).

### 7.4 Contrato MCP
```jsonc
{ "op": "duplicate_nodes", "scope": "page", "pageIndex": 0,
  "nodes": [ {"source": {"id": 3}, "ref": "api2"}, {"source": {"ref": "db"}} ],   // source = {id}|{ref} del original; ref = ref de la copia (opcional)
  "connections": "internal",                                           // "internal" | "none"
  "offset": { "x": 20, "y": 20 } }                                     // opcional; por defecto el del editor
```
(La forma exacta de «fuente» vs «ref de la copia» se fija en D8; propongo `{source:{id}|{ref}, ref?}` por entrada, para no mezclar el campo `ref` de la fuente y de la copia.)
- Errores: `NODE_NOT_FOUND`, `UNKNOWN_REF`, `DUPLICATE_REF`, `INVALID_FIELD`, `LIMIT_EXCEEDED`, `ID_EXHAUSTED`.
- `changes[]`: `created:[{from, id, kind:"node"|"connection"}]`, `affects.stories:[]` (las Historias no cambian).

### 7.5 `duplicate_page` (si D6 = sí)
- `duplicatePageIn(d, pageIndex, name?)`: copia profunda de la página (`nodes, edges, behaviors, scenarios` y **sus contadores**: los ids son por página, no hay colisión; Historias y EventTypes compartidos por referencia a EventTypes globales, que **no** se copian). Nombre «X copia», «X copia 2» (recortado a `PAGE_NAME_MAX`, como `copyScenarioName`). **Se añade al final** (índices estables, §4.6) y devuelve `{pageIndex, page}`; **no** toca `doc.cur` (el editor la activa, como `addPage`). Undo: entrada `insertPage` de §4.5.
- Contraindicaciones: crecimiento del payload (Share `too_large`) y F11 ⇒ ligar a una decisión de tope de páginas (D9).
- UI mínima necesaria: entrada de menú (clic derecho en la pestaña) — **decisión de producto**; sin ella, diferir.

---

## 8. Plan de implementación

**Sin implementar nada hasta tus decisiones.** Propuesta de partir en sub-slices con un único release:

### 018.7a — `set_theme` + orden Z (pequeño, mecánico)
1. `model.js`: `setThemeIn`, `reorderNodesIn`. `selection.js`: las 4 acciones llaman a `reorderNodesIn` (con `pushUndo` solo si `changed`). `ui.js`: `themeSel`/`bgCustom`/`btnBgClear` llaman a `setThemeIn`.
2. `story-authoring.js`: `set_theme` (document), `reorder_nodes` (page); reglas de entrada (HEX de `customBg`); refs de `reorder_nodes`.
3. `fluyo-mcp`: `authoring.ts` (schemas), `server.ts` (descripción de `author_document`), `stories.ts` (`theme`, `customBg`, `capabilities.themes`, `z` por nodo); `sync:kernel`.

### 018.7b — `duplicate_nodes`
1. `model.js`: `cloneStructureIn`, `duplicateNodesIn`; `selection.js`: `pasteClip` y `dupSel` llaman al dominio (se elimina el efecto F5).
2. `story-authoring.js` + `authoring.ts` + `server.ts`: `duplicate_nodes`, refs de copias, `created[]`.

### 018.7c — `delete_page` (+ Undo de estructura)
1. `model.js`: `pageRemovalImpactIn`, `deletePageIn`, `restorePageIn` (+ `duplicatePageIn` si D6).
2. `selection.js`: Undo por identidad de página + entradas de estructura (U2); `ui.js`: ✕ con impacto, guarda de Playback, regla de `cur`.
3. `story-authoring.js`: tombstone de páginas, compactación final, `pageMap`, `PAGE_MISMATCH`, `PAGE_DELETED`, `CANNOT_DELETE_LAST_PAGE`.
4. `fluyo-mcp`: schema `delete_page`, respuesta con `pageMap`, descripciones.

### Orden y dependencias
a → b → c (c es el más invasivo; reutiliza Undo de estructura si se hace `duplicate_page`). **a** y **b** son independientes entre sí. Si se prefiere separar riesgos: a+b juntos, c como 018.8 (decisión D12).

### Impacto de `sw.js`, kernel y deploy
- **Todo toca `model.js`** (servido + kernel) y `selection.js`/`ui.js` (servidos) ⇒ **bump de `CACHE`** (v63 → v64, un solo bump para las tres partes) y QA de navegador obligatoria. `story-authoring.js` solo lo carga MCP (no es asset del SW), pero **sí** forma parte del `kernelId`.
- `fluyo-mcp`: `npm run sync:kernel` (modifica `src/generated/kernel-sources.ts`), `check:kernel`, `check:config`, `build`, contratos de tools (`tools/list` ya cerca del tope de 62 000 bytes: vigilar), README, `verify-deploy.sh` (nombres de tools **no** cambian: no hay tool nueva; sí cambia el esquema de `author_document`).
- Orden de deploy: **`fluyo` primero** (editor/Viewer con `model.js` nuevo, SW v64), luego `fluyo-mcp` con el kernel sincronizado (el kernel del MCP es una copia verbatim: un MCP desplegado antes de tener el editor no rompe nada, pero un documento autorado con `delete_page` debe abrir en un editor que ya soporte la regla de `cur`; el formato **no** cambia).
- **Sin cambio de formato**: sigue `version:5`, sin claves nuevas en el documento. Documentos antiguos: sin migración.

---

## 9. Decisiones pendientes

| # | Decisión | Opciones | Recomendación |
|---|---|---|---|
| **D1** | **Política de `delete_page`** | A bloquear · B confirmar · C cascada pura · **D híbrida** (§4.3) | **D**: cascada intrínseca + confirmación con impacto y Undo en el editor + `expectedName` en MCP |
| D2 | Protección extra en MCP | solo `expectedName` · + `acknowledgeStories:true` (D′) | solo `expectedName` (consistente con `delete_story`) |
| D3 | F1 (corrupción por Undo) | U1 hotfix ya · U2 en 018.7c · ambos | **ambos**: U1 como hotfix aparte si 018.7c no es inminente; U2 en 018.7c |
| D4 | Undo del borrado | U1 (vaciar) · **U2 (identidad + estructura)** · U3 | **U2** |
| D5 | Índices en el lote | **P-A (estables + `pageMap`)** · P-B · P-C | **P-A** (plan B: P-C) |
| D6 | `duplicate_page` | **sí, con UI mínima** · diferir | **diferir a 018.8** salvo que quieras la UI ya (comparte infraestructura con U2) |
| D7 | `duplicate_connection` | incluir · **diferir** | diferir |
| D8 | Forma de `duplicate_nodes` (`source`/`ref` por entrada; `connections`; `offset` por defecto) | §7.4 | `{source, ref?}` por entrada, `connections:"internal"`, `offset` por defecto = `GRID`(20,20) |
| D9 | Tope de páginas (`maxPagesPerDocument`) | sin tope · **regla de entrada** (valor a elegir, p. ej. 50) | tope de **entrada** no retroactivo, junto con `duplicate_page` (si D6=sí); si D6=diferir, también diferir |
| D10 | `customBg` en `set_theme` | incluir (HEX/null) · solo `theme` | **incluir** |
| D11 | Posiciones Z en MCP | 4 verbos del editor · + posiciones relativas («sobre X») | **4 verbos** (paridad) |
| D12 | Partición del release | a+b+c un deploy · **a+b ya, c después** | a+b+c con un deploy **o** a+b primero si prefieres no mezclar el cambio de Undo con lo mecánico |

Preguntas menores a confirmar (cada una tiene una opción por defecto): (i) ✕ de página en Playback: **`scReset` primero** (como el resto de acciones estructurales, 64) o bloquear como `deleteSel`; (ii) `dupSel` deja de escribir el portapapeles del sistema (F5) — cambio visible aceptado; (iii) un `reorder_nodes` en el que nada cambia es **válido** (`changed:false`), no error.

---

## 10. Plan de tests

**Fluyo (`test/fluyo-018-7.test.cjs`, `vm` + golden compartido `test/fixtures/fluyo-018-7-golden.json` con fluyo-mcp):**
- **Dominio**: `deletePageIn` (primera/media/última/actual/anterior a la actual/posterior; `cur` por cada caso; `last_page`; `page_not_found`; todo o nada; EventTypes intactos; impacto exacto: nodos, conexiones, Behaviors, Historias, momentos, `eventTypesFreed`); `restorePageIn`; `setThemeIn` (válido, inválido, parche, idempotente); `reorderNodesIn` (4 posiciones, selección contigua/discontinua, no-op `changed:false`, orden relativo conservado, F8); `cloneStructureIn`/`duplicateNodesIn` (ids nuevos en lote, `order`, remapeo `from/to`, solo internas, Behaviors copiados, waypoints desplazados, Steps no tocados, agotamiento de ids sin parcial, paridad con `pasteClip` original en un golden).
- **Autoría** (`FluyoAuthoring`): `delete_page` (P-A: borrar y seguir operando en otras páginas, `PAGE_DELETED`, `PAGE_MISMATCH`, `CANNOT_DELETE_LAST_PAGE`, `create_page`+`delete_page` en el mismo lote, `pageMap`, `cur`, estado final válido, dryRun igual a real); `set_theme` (HEX de `customBg`, no retroactiva); `reorder_nodes` con `{ref}`; `duplicate_nodes` (refs de copias usables, límites sobre estado final, orden de listado no cambia el resultado); todo-o-nada ante un error en la última operación; `baseRevision`/`resultRevision` deterministas.
- **Paridad editor ↔ dominio/MCP** (arnés `fluyo-016-harness`/editor real en `vm`): las mismas secuencias por el editor y por `author_document` dan **el mismo documento** (revisión idéntica), también con secuencias aleatorias (como `fluyo-017-2*`).
- **Invariantes**: **Trace antes = Trace después** para reorder/theme/duplicate; las Historias restantes siguen ejecutándose tras `delete_page`; el JSON del documento no contiene refs; sin claves nuevas.
- **Undo (U2)**: borrar + deshacer restaura la página **con el mismo objeto**, `cur` y snapshots anteriores válidos; el escenario F1 (A·B·C) **deja de corromper**; rehacer vuelve a borrar; secuencias aleatorias borrar/crear/editar/deshacer/rehacer contra un modelo de referencia; pila de 60; `applyProjectData` vacía.
- **Share/Viewer**: tras `delete_page`, `createShareUrl` genera enlace válido con `cur` correcto; el Viewer abre; `applyShareKind` con `cur` recalculado.
- **Contrato**: `describe_document` expone `theme`, `customBg`, `capabilities.themes`, `z` por nodo; documento antiguo sin `customBg`; tope de `tools/list` (62 000).

**fluyo-mcp (`test/fluyo-018-7.test.ts`):** el golden compartido; HTTP/stdio de punta a punta (`describe_document` → `author_document` con `delete_page`+`pageMap` → `describe_document`); mensajes de error sin trazas; `REQUIRE_FLUYO=1 npm test`.

## 11. Plan de mutaciones (`test/fluyo-018-7-mutations.cjs`, `scripts/mutate-018-7.ts`)

Cada mutación debe hacer fallar al menos un test; se ejecutan sobre **copias** (patrón de 018.x):
- `deletePageIn`: no recalcular `cur`; `cur` solo clamp (F2); permitir borrar la última; no devolver impacto de Historias; tocar EventTypes; borrar por nombre en vez de índice.
- Undo: volver al snapshot por índice (F1); no reinsertar el **mismo objeto**; no vaciar `redo` al nueva acción; descartar en lugar de ignorar entradas de página ausente.
- `FluyoAuthoring`: ignorar `expectedName`; desplazar índices en el acto (P-B); olvidar `pageMap`; permitir operar sobre página marcada; no compactar al final; `set_theme` aceptando no-HEX; no idempotente; `reorder_nodes` ordenando por la lista en lugar de por el documento; `changed` siempre `true`; `duplicate_nodes` copiando conexiones **no** internas, olvidando Behaviors, no desplazando waypoints, reutilizando ids, copiando Steps, no aplicando límites sobre el estado final.
- `pasteClip`: no usar el dominio; seguir pisando el portapapeles del sistema (F5).
- Orden de listado de `duplicate_nodes` cambiando el resultado.

## 12. Plan de Chrome (Playwright externo vía `NODE_PATH`, contra el working tree y contra HEAD, como 018.3/018.5)

`test/fluyo-018-7-browser.cjs`, ratón y teclado reales:
- **Borrar página**: ✕ con página vacía (mensaje corto) y con contenido/Historias (mensaje de impacto; **Cancelar** no deja Undo; **Aceptar** + Ctrl+Z restaura nodos, conexiones, Historias, `cur` y pestaña en su sitio); borrar página anterior a la activa (la activa sigue siendo **la misma página**, F2); borrar la activa; última página (✕ ausente); **escenario F1** (A·B·C, editar B, borrar A, Ctrl+Z): C no cambia; Playback en curso + ✕ (F4); autoguardado y recarga; Share tras borrar; Present con páginas restantes.
- **Tema**: cambiar `themeSel` y `customBg` (render, PNG, SVG, GIF; Viewer vía enlace); Undo **no** lo deshace (documentado); recarga persiste.
- **Orden Z**: las cuatro acciones con 1 y varios nodos; hit-test coincide con lo dibujado; no-op no crea Undo; animación `build` intacta (`order` sin cambios).
- **Duplicar**: Ctrl+D y menú con 1 y varios nodos, con conexiones internas/externas, waypoints, Behaviors (condición «No disponible» copiada), nodo usado por una Historia (la Historia no cambia); selección final = lo nuevo; Ctrl+D **no** pisa el portapapeles (F5); Ctrl+V posterior con el `clip` anterior; un solo Undo.
- Upgrade del SW v63 → v64 (caché anterior → actual) y apertura offline.
- Viewports: escritorio y estrecho para pestañas con ✕ y cuadros de diálogo.
- Los tests obsoletos conocidos de `fluyo-011-browser` (3) se mantienen fuera.

## 13. Riesgos

- **Undo (U2)** es el cambio de mayor riesgo del slice (toca la pila global). Mitigación: tests de secuencias aleatorias contra un modelo, F1 como regresión explícita y QA en Chrome; U1 como hotfix si hay urgencia.
- **P-A (tombstones)** añade una fase de compactación a `FluyoAuthoring.apply` y un campo `pageMap` a la respuesta (cambio **aditivo** de contrato). Plan B: P-C.
- **Tamaño de `tools/list`** (tope de 62 000 bytes de 018.6): 5 operaciones nuevas en el esquema de `author_document` pueden agotarlo; hay que medir antes de escribir descripciones.
- **Cambio visible en el editor**: F2 (`cur`), F3 (mensaje de impacto), F5 (Ctrl+D ya no pisa el portapapeles), F7 (no-op sin Undo). Todos a mejor, pero son cambios de comportamiento a registrar en `DECISIONS.md` (99+).
- `confirm()` nativo sigue siendo provisional (deuda conocida de 018.4).

## 14. Decisiones a registrar tras tu elección (propuestas, **no** escritas todavía)

99. Política de `delete_page` (D1/D2) y regla de `cur`. 100. Undo de estructura de documento por identidad de página (D3/D4). 101. Índices estables y `pageMap` en lotes con borrado de página (D5). 102. Tema y orden Z como dominio compartido (`setThemeIn`, `reorderNodesIn`). 103. `cloneStructureIn`/`duplicate_nodes`: alcance, Behaviors copiados, Historias no.

---

## Anexo — Pruebas exploratorias (solo lectura, fuera del repo, descartadas)

Script en el directorio temporal de la sesión; carga `js/config.js`, `safe-svg.js`, `model.js` y `selection.js` **reales** en un `vm` con stubs mínimos (`selN`, `refreshPanel`, `scheduleAutosave`, `renderTabs`). No se ejecutó la batería de tests ni se modificó ningún archivo del repo.

| # | Hipótesis | Resultado |
|---|---|---|
| 1 | Undo tras borrar una página anterior corrompe otra página | **Confirmado.** Páginas A·B·C; `pushUndo` estando en B (`pi=1`); editar B; borrar A como `ui.js:473`; `undo()`. Antes: `[B:b-EDIT, C:c0]`. Después: `[B:b-EDIT, C:b0]` — el contenido de B se escribió **sobre C**. Con el snapshot en C (`pi=2`) el `clamp` coincidía por casualidad con la última página y no se manifestaba: el defecto depende de qué página y de cuántas hay |
| 2 | Las referencias internas de `FluyoAuthoring` dependen de `pageIndex` | **Confirmado por lectura** (`story-authoring.js`: `diagramRefs`, `created`, `deleted`, `watch`, `countOps`, `baseCounts`, `touched`) |
| 3 | El orden Z es la posición en el array y `order` es otra cosa | **Confirmado por lectura** (`render.js:22,26,972,1005`; `selection.js:127-158`; `interaction.js:15-22`; `model.js:730`) |
| 4 | `describe_document` no expone tema ni `customBg` ni `z` | **Confirmado** (`stories.ts:138,215`, `capabilities`) |
| 5 | Los exportadores SVG no pintan fondo | **Confirmado** (sin `.bg` en `export.js`/`svg.ts`): `customBg` solo afecta a lienzo/PNG/GIF/Viewer |
| 6 | Estado de repos | ambos limpios (`fluyo` e86c7c4, `fluyo-mcp` 44722e6); `CACHE` v63 |
