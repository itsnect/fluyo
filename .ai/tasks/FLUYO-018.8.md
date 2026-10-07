# FLUYO-018.8 — Auditoría del siguiente slice: deuda previa («Añadir como página» pierde los EventTypes) antes de enrutar `create_diagram`/`create_from_template` por el kernel

Estado: **IMPLEMENTADO — READY FOR COMMIT** (ver §13 «Implementación»). Auditoría aprobada con D1–D5 según la recomendación. Sin commit, push ni deploy.
Fecha: 7 de octubre de 2026.
Owner/agente actual: libre.

> Repo público: nada de este documento es confidencial. Todas las pruebas usaron documentos sintéticos; ningún dato de usuarios.
> Fuentes leídas: `.ai/ARCHITECTURE.md`, `.ai/DECISIONS.md` (hasta la 107), `FLUYO-018.md` (§19–§21), `FLUYO-018.5.md`, `FLUYO-018.6.md`, `FLUYO-018.7.md`,
> `FLUYO-018.7a.md`, `FLUYO-018.7c.md`, `FLUYO-018.7d.md`; código de `fluyo/js` (`model.js`, `state.js`, `deeplink.js`, `viewer.js`,
> `share-loader.js`, `config.js`) y `fluyo-mcp/src` (`diagram.ts`, `model.ts`, `schema.ts`, `templates.ts`, `server.ts`, `link.ts`,
> `authoring.ts`, `revision.ts`).

---

## 1. Estado actual

### 1.1 Verificación post-deploy de FLUYO-018.7 (7 de octubre de 2026): **verde**

| Comprobación | Resultado |
|---|---|
| `https://mcp.fluyo.space/health` | `200 {"status":"ok","transport":"streamable-http","mode":"stateless"}` |
| `scripts/verify-deploy.sh https://mcp.fluyo.space` | **21/21** comprobaciones correctas |
| Cloud Run | servicio `fluyo-mcp` (us-central1), revisión activa `fluyo-mcp-00013-xpk`, Ready, **100 % del tráfico** |
| `kernelId` desplegado | `2dfa4df32c2a835732499111622233503619f04f6145ad4b8f2be8bcad0fa4c2` = `main` |
| Tools | exactamente **16**; `propose_layout` presente con `readOnlyHint:true` |
| Editor (`fluyo.space`, Vercel) | `sw.js` `CACHE = "fluyo-static-v66"`; la caché activa del SW es `fluyo-static-v66`; `model.js`, `selection.js`, `ui.js` servidos = `main` byte a byte |
| Logs de Cloud Run de la revisión | 0 entradas `ERROR`, 0 trazas; 4xx solo esperados (403/405 de `verify-deploy`, 429 de una ráfaga propia del smoke) |

### 1.2 Smoke funcional de 018.7 en producción (documentos sintéticos)

- **MCP** (cliente real del SDK contra `mcp.fluyo.space`): `delete_page` con `expectedName` correcto (A·B·C, activa B → B, C; `pageMap [{0→null},{1→0},{2→1}]`; `cur` del documento = B; `changes[].cur {from:1,to:1}` en índices del lote, decisión 105); B y C intactas; EventTypes globales intactos y `eventTypesFreed:[1]`; documento válido y sin Steps hacia EventTypes inexistentes; `PAGE_MISMATCH`, `CANNOT_DELETE_LAST_PAGE`, `PAGE_DELETED` y `REVISION_MISMATCH` sin documento; ningún rechazo mutó la entrada; lote con varios borrados + `rename_page` por índice del lote → `pageMap` correcto; `dryRun` = mismo `resultRevision`; 0 trazas. **Todo OK.**
- **Editor** (Chrome real contra `fluyo.space`, contexto limpio, telemetría externa bloqueada): ✕ de A con confirmación con impacto; la activa sigue siendo B; Ctrl+Z → A en su posición, B con su modificación, C intacta (documento exacto); Ctrl+Y exacto; eliminar «Pago» (sin uso) desde la biblioteca + Ctrl+Z ×2 → documento inicial válido; Ctrl+Y ×2 exacto; Playback completo; Share → Viewer abre y reproduce; 0 errores. **Todo OK.**
- Incidencia del propio guion (no del producto): una primera versión bloqueaba por error `js/analytics.js` y `js/editor-analytics.js` con un patrón demasiado amplio, lo que rompía el Viewer y el borrado desde la biblioteca; con el bloqueo limitado a `cloud.umami.is` todo pasa, y el Viewer de producción se verificó además por separado (editor prod/local × Viewer prod/local: `ready`).

### 1.3 Estado de la hoja de ruta
018.7 (a, c, d) desplegado. La hoja de ruta tentativa (018.6 §8) dejaba **018.8 = enrutar `create_diagram`/`create_from_template` por el kernel** y 018.9 = deprecación de `edit_diagram`.

---

## 2. Problema / oportunidad

### 2.1 Deuda previa encontrada (**bug de producción, anterior a 018.7**): «Añadir como página nueva» rompe las Historias de las páginas añadidas

`appendPagesFrom(d)` (`state.js:171-180`) engancha `nd.pages` al documento abierto **sin su biblioteca de EventTypes** (`nd.eventTypes` se descarta). Los Steps de las páginas añadidas conservan sus `eventTypeId`, que ahora se resuelven contra la biblioteca del documento **receptor**:

- Si el id no existe en el receptor → `missing_event_type`: Historia inválida.
- Si existe con otra primitiva → `event_type_action_mismatch`: Historia inválida.
- Si existe con **la misma primitiva** → **corrupción silenciosa**: el documento es *válido* y la Historia se reproduce con el evento equivocado (frase, símbolo, presentación de otro EventType).

Reproducido con el código real:
- `vm` + `appendPagesFrom` real: receptor con «Pago» (FLOW, id 1), entrante con «Alerta» (OCCURRENCE, id 1) → `eventTypes:["1:Pago:FLOW"]`, `valid:false`, `event_type_action_mismatch`. Entrante «Reembolso» (FLOW, id 1) → `valid:true`, el paso se reproduce como «Pago».
- **Chrome real, de punta a punta por la UI** (`main` en local, idéntico a producción): autor comparte una Historia → el destinatario, que tiene una sesión guardada, abre el enlace en el Viewer → «Abrir en Fluyo» (`btnOpen`/`stOpen`, `viewer.js:413-414`) → modal de documento entrante → «Añadirlo como página nueva» → la Historia añadida queda inválida.

**Alcance:** es el bucle central «compartir → abrir en el editor» (`openInFluyo` → deep link `#d=` → `presentIncomingDocument` → `incomingAsNewPage`). También entra por los deep links que devuelven `create_diagram`, `create_from_template` y `edit_diagram` (este conserva Historias y EventTypes de su entrada). Los ejemplos (`?ejemplo=`) no llevan Historias hoy. Es anterior a 018.7: `state.js` no ha cambiado aquí; 018.7d no lo empeora (el append no toca las pilas ni la biblioteca).

### 2.2 La oportunidad prevista: `create_diagram`/`create_from_template` por el kernel

Hoy hay **dos fábricas de documento**: `diagram.ts` (`createDiagram`, `buildNode`, `buildEdge`) escribe un v3 a mano, y el kernel (`createNodeIn`, `createConnectionIn`, `FluyoAuthoring`) es la autoridad de todo lo demás. Medido con el `dist` de `main` (§3.2): **el mismo diagrama da revisiones distintas** por las dos rutas y `create_diagram` acepta entradas que el kernel rechazaría.

### 2.3 Recomendación

**018.8 = cerrar la deuda de §2.1** (pequeña, de editor, con corrupción silenciosa de datos en un flujo principal). **Enrutar `create_diagram`/`create_from_template` por el kernel pasa a 018.9** con el diseño de §4.2, ya auditado y listo para decidir; la deprecación de `edit_diagram` pasa a 018.10. Razones: (1) es un defecto real en producción, no una mejora; (2) es independiente y no comparte archivos con la ruta de `create_diagram` (editor frente a MCP); (3) 018.9 no la arregla (la corrupción ocurre en el editor al fusionar, venga el documento de donde venga), y cuantas más Historias produzcan los agentes, más se expone.

Deudas de higiene (no bloquean; slices propios): `test/scenario-qa-mutations.cjs` (FLUYO-008) falla también en HEAD (su premisa «el Viewer no ejecuta Historias» es obsoleta desde FLUYO-014); `fluyo-011-browser` (3 obsoletos conocidos).

---

## 3. Auditoría del código

### 3.1 Fusión de documentos en el editor (deuda de §2.1)

| Punto | Código | Hallazgo |
|---|---|---|
| Entrada | `deeplink.js:93-105` (`#d=`), `examples.js`, `viewer.js:327-345` → `share-loader.js:93` (`buildOpenInFluyoURL`) | Todas acaban en `presentIncomingDocument` (`state.js:223`) |
| Elegir «Añadir como página» | `state.js:260-272` `incomingAsNewPage` → `restoreMineOrWarn` → `appendPagesFrom(data)` → `saveAutosave(true)` | Gesto explícito del usuario |
| Fusión | `state.js:171-180` | `documentFromProjectData(d)` normaliza el entrante (con sus `eventTypes`), pero solo se copian `nd.pages`; tema y ajustes del entrante se ignoran **por diseño** (comentario `state.js:159-170`) — los EventTypes **no** estaban en esa decisión: el comentario ni los menciona (se escribió antes de 017) |
| Referencias entre documentos | `model.js` | Lo único global que una página referencia son los **EventTypes** (`doc.eventTypes`, `nextEventTypeId`). Nodos, conexiones, Behaviors, Historias y Steps son por página: no colisionan |
| Undo | `selection.js` (018.7c/7d) | El append no crea entrada ni vacía pilas. Las entradas existentes apuntan a páginas por referencia y llevan la biblioteca (`lib`): si el arreglo **añade** EventTypes a la biblioteca sin registrarlo, un Undo posterior de una acción anterior restauraría la biblioteca **sin** ellos y volvería a romper las páginas añadidas. El arreglo tiene que decidir Undo (§6, D3) |
| Dominio | `model.js` | No hay función de dominio para «importar páginas»; `createEventTypeIn` (`model.js:352`) ya asigna ids nuevos y nunca reutiliza |

### 3.2 `create_diagram` / `create_from_template` frente al kernel (medido con el `dist` de `main`)

**Fábrica de documentos**
- `createDiagram` (`diagram.ts:166-257`) escribe `version:3`, `meta:{generator:"fluyo-mcp"}`, `doc:{theme, pages:[page], cur:0, customBg}` y `settings` completos; `buildNode`/`buildEdge` (`diagram.ts:63-134`) tienen defaults propios. `create_from_template` (`server.ts:276-317`) llama a `createDiagram` con `templates.ts` (3 plantillas, colores por **nombre**). La salida se valida con el zod v3 de `model.ts` (`passthrough`), no con el kernel.
- El editor no tiene «documento nuevo»: el documento en blanco es el literal de `model.js:7` + `DEFAULT_SETTINGS`. El kernel ya sabe normalizar un documento mínimo (`projectFromProjectData`, `model.js:1151-1189`).

**Divergencias medidas (mismo diagrama, mismas posiciones)**

| Aspecto | `create_diagram` | Kernel / editor |
|---|---|---|
| Revisión del documento normalizado | `sha256:dea14db5…` | `sha256:78ddbd22…` (**distinta**) |
| Etiqueta por defecto de `code` | `"Nodo"` | `CODE_DEFAULT_LABEL` (`config.js:92`) — **bug de paridad** |
| Claves extra/ausentes | `fs:null` (nodo y arista), `lineColor:null`, `dotColor:null`; sin `keywords/kwBg/kwColor` en `code` | sin `fs`/`lineColor`/`dotColor`; `keywords/kwBg/kwColor:null` en `code` |
| Hex | acepta `#12345`, `#1234567` (no son CSS válidos: el lienzo los ignora en silencio) y `#1234` | regla de entrada HEX `#rgb`/`#rrggbb`/`#rrggbbaa` (decisión 94) |
| Nombres de color | sí (`resolveColor`, `schema.ts:98-108`, sin acentos ni mayúsculas; 7 nombres de `PALETTE`) | `author_document` **solo HEX** (decisión 94; descripción de `list_colors`) |
| Auto-lazo | aceptado | `self_loop` (decisión 84) |
| Límites (decisión 95) | 320 nodos, `x=1e7`, `w=1`, `h=99999`: aceptados | 300 nodos, `coordMax` 100000, `w/h` 10–5000 |
| `customBg` | cualquier texto (`"not-a-color"` aceptado) | HEX/`null`/`""` en `set_theme` (decisión 100) |
| Nombre de página | sin tope (200 caracteres aceptados) | 1–80 caracteres (decisión 93) |
| Ajustes | `speed` 0,05–5, `stagger` 0–5 en el schema | la carga los recorta (`settingsFromProjectData`: `speed` .2–2, `stagger` .2–1,2): un `speed:5` se abre como 2 |
| Versión | v3 + `meta.generator` | v5; `projectToSerializable` descarta `meta` |

**Transición v3 → v5.** Todo consumidor ya acepta v1–v5 (`projectFromProjectData`, `describe_document`, `author_document`, Viewer). `edit_diagram` acepta cualquier versión y **conserva** la de entrada. La `revision` ya se calcula sobre el documento normalizado (v5), así que un v3 y su v5 equivalente tienen la misma revisión. Emitir v5 no rompe la apertura en el editor ni en el Viewer.

**`meta.generator`.** Nada en Fluyo lo lee (ni editor, ni Viewer, ni telemetría): solo tests del MCP (`link.test.ts:241-273`). El editor lo descarta al guardar; `author_document` también. Hoy no responde a la pregunta que su comentario dice responder.

**Relación con `author_document`.** `author_document` ya crea nodos y conexiones con las reglas del editor, pero no puede: partir de un documento en blanco (lo construye el que llama), escribir los `settings` del documento ni maquetar (eso es `propose_layout`, decisión 98). `create_diagram` aporta justo eso: blanco + ajustes + `layeredLayout` + nombres de color + `key` → id.

**Contratos que dependen de la salida actual.** Tests del MCP que llaman a `create_diagram`/`create_from_template`: `tools.test.ts` (23 apariciones), `link.test.ts` (19, incluye `meta.generator`), `fluyo-018-6.test.ts` (10, paridad de posiciones con `propose_layout`; afirma `version 3` en `:392`), `http.test.ts` (3), `fluyo-017-1-qa.test.ts` (2), `fluyo-018-2.test.ts` (1). Fixtures de regresión visual (`test/fixtures/regresion-visual`). README y descripciones de tools (10 menciones). El enlace `#d=` (`link.ts`, tope 16 000 caracteres) codifica el proyecto completo.

---

## 4. Diseño propuesto

### 4.1 018.8 — Fusión de páginas con su biblioteca de EventTypes (recomendado como 018.8)

- **Dominio (`model.js`), autoridad única:** `importPagesIn(d, incomingDoc)` → añade al final las páginas del documento entrante (ya normalizado) **y** los EventTypes que sus Steps usan, con **ids nuevos** de `d` (`createEventTypeIn` reserva el contador; nunca se reutilizan), y **reescribe** el `eventTypeId` de esos Steps. Devuelve `{pageIndex (primera añadida), pages, eventTypes:[{from, to}], unresolved:[…]}`. Todo o nada. Tema, `customBg` y ajustes del receptor no cambian (decisión vigente del editor).
- **Editor (`state.js`):** `appendPagesFrom` llama a `importPagesIn` y conserva lo demás (activa la primera página nueva, `clearSel`, `renderTabs`, autoguardado). Política de Undo según D3.
- **Steps con `eventTypeId` que el entrante no define** (documento entrante ya inválido): se dejan **sin resolver con un id que no existe en el receptor** (nunca colisionan con un EventType del receptor) y se informan; el documento sigue mostrando el error previo en lugar de ganar uno silencioso. (D4.)
- Sin MCP: ninguna tool fusiona documentos; el kernel cambia (`model.js`) y hay que sincronizarlo, pero ningún contrato MCP cambia.

### 4.2 018.9 — `create_diagram`/`create_from_template` por el kernel (diseño auditado, para después)

**Sin cambios en `model.js` ni en el kernel** (no hay segundo consumidor de una fábrica):
1. MCP construye un proyecto mínimo `{version:5, app, doc:{theme, customBg, pages:[{name}]}, settings}` y lo normaliza el kernel (`projectFromProjectData`): blanco v5 del kernel, con los ajustes recortados como los recorta el editor.
2. Calcula posiciones como hoy (`layeredLayout`/rejilla), sin cambiar el algoritmo (decisión 98).
3. Traduce la entrada a operaciones de `author_document` (`create_node` con `ref = key`, `create_connection` con `{ref}`), resolviendo **antes** los nombres de color a HEX con la misma `resolveColor` (D6), y aplica `FluyoAuthoring.apply` en lotes de ≤200 encadenados internamente (como `propose_layout`).
4. Devuelve el documento v5 del kernel con el mismo formato de respuesta (resumen + enlace + JSON).

Efectos: una sola fábrica de nodos y conexiones (defaults, ids, `code`, auto-lazo, límites y reglas de entrada del kernel); revisión idéntica a la del editor y `author_document` para el mismo diagrama; `buildNode`/`buildEdge` solo quedan para `edit_diagram` (legacy, decisión 96) hasta 018.10.

---

## 5. Contrato

### 5.1 018.8 (editor)
- Sin cambios de formato (`version:5`, sin claves nuevas) ni de MCP. Cambio visible: «Añadir como página nueva» conserva las Historias de las páginas añadidas con sus eventos; la biblioteca del receptor **crece** con los EventTypes importados (posibles nombres repetidos; están permitidos, decisión 81).
- Dominio: `importPagesIn(d, incoming)` con errores estructurados `invalid_document`, `id_exhausted`.

### 5.2 018.9 (MCP; a confirmar en su propio slice)
- Mismas entradas de `create_diagram` y `create_from_template` (incluidos nombres de color y `key`). Salida **v5** normalizada por el kernel; sin `meta` o con `meta` según D7.
- Errores nuevos posibles (antes aceptados): `SELF_LOOP`, `LIMIT_EXCEEDED` (300 nodos, 600 conexiones, `coordMax`, `w/h`), `INVALID_FIELD` (hex mal formado, `customBg`, nombre de página >80), según D8.
- `speed`/`stagger` fuera del rango del editor: recortar en silencio (como la carga) o rechazar (D9).
- Sin cambios en el número de tools (16) ni en `verify-deploy.sh`.

---

## 6. Decisiones que necesito aprobar

| # | Decisión | Opciones | Recomendación |
|---|---|---|---|
| **D1** | ¿Qué es 018.8? | **A** deuda de «Añadir como página» · B `create_diagram` por el kernel | **A**; `create_diagram` → 018.9, `edit_diagram` → 018.10 |
| D2 | EventTypes importados | **siempre nuevos** (ids nuevos, sin fusionar) · reutilizar uno idéntico del receptor · reutilizar por nombre | **siempre nuevos**: sin acoplar páginas que antes no compartían nada; por nombre es ambiguo |
| D3 | Undo de «Añadir como página» | **vaciar Undo/Redo** (como abrir documento, `applyProjectData`) · una entrada de estructura nueva que deshace la importación | **vaciar**: es una llegada de documento, no una edición; evita restaurar una biblioteca sin los EventTypes importados |
| D4 | Steps del entrante con `eventTypeId` inexistente en su propio documento | dejarlos apuntando a un id libre (error visible, como antes) · eliminarlos | **dejarlos sin resolver** (nada se limpia en silencio, decisión 89) |
| D5 | ¿Avisar al importar? | sin aviso · nota en el modal «se añadirán N eventos a tu biblioteca» | **sin aviso** en 018.8 (el resultado es el esperado); revisable en el rediseño |
| D6 (018.9) | Nombres de color en `create_diagram` | **conservarlos** (azúcar de entrada, se traducen a HEX antes del kernel) · solo HEX · aceptarlos también en `author_document` | **conservarlos solo en `create_diagram`/`create_from_template`** (compatibilidad; las plantillas los usan) |
| D7 (018.9) | `meta.generator` | quitarlo (nadie lo lee) · conservarlo añadiéndolo a la salida v5 | **quitarlo** y retirar sus tests, o conservarlo si hay un uso previsto que deba documentarse |
| D8 (018.9) | Reglas de entrada y límites del kernel en `create_diagram` | **aplicarlos** (un solo contrato) · mantener la laxitud actual | **aplicarlos**, con errores estructurados; cambio documentado como más estricto |
| D9 (018.9) | `speed`/`stagger`/`dots` fuera del rango del editor | **recortar en el schema** (alinear rangos con `settingsFromProjectData`) · recortar en silencio · rechazar | **alinear el schema** (rechazo zod claro) |
| D10 (018.9) | Versión de salida | **v5** · seguir en v3 | **v5** (todo consumidor la acepta; la revisión no cambia por la versión) |

---

## 7. Riesgos

- **018.8 toca el editor y `model.js`:** bump de `CACHE` (v66 → v67), `sync:kernel` (nuevo `kernelId` aunque el MCP no use la función) y QA en Chrome real del flujo completo (Share → Viewer → «Abrir en Fluyo» → «Añadir como página»).
- **Interacción con Undo (018.7c/7d):** si D3 no se aplica bien, un Undo posterior podría restaurar la biblioteca sin los EventTypes importados. Debe cubrirse con tests y con una mutación específica.
- **Biblioteca que crece** al añadir el mismo documento varias veces (D2 «siempre nuevos»): aceptable; el usuario puede borrar los que no use.
- **018.9 rompe compatibilidad de entrada** (D8): diagramas que hoy se crean (auto-lazos, >300 nodos, hex no CSS, `customBg` inválido) pasarían a rechazarse. Mitigación: errores con el campo y el límite, nota en el README.
- **018.9 cambia la salida** (v5, claves distintas, sin `meta`): agentes que comprobaran `version===3` o `meta` (no consta ninguno fuera de los tests) y los ~58 usos en tests a actualizar; los fixtures de regresión visual no deberían cambiar (no dependen de las claves extra).
- **Tamaño de `tools/list`**: 70 738/72 000. 018.9 no debería crecerlo (mismo schema); si se alinean rangos o se cambian descripciones, medir.
- **Rate limit** del endpoint público (30/60 s por IP): a tener en cuenta en cualquier smoke post-deploy.

---

## 8. Impacto editor ↔ MCP

- **018.8:** solo editor (más el dominio compartido en `model.js`). Paridad: la función de dominio es la autoridad; el MCP no fusiona documentos. Tras 018.8, un documento con Historias que pasa por «Añadir como página» queda válido y cada paso conserva su evento.
- **018.9:** solo MCP en código; mejora la paridad: `create_diagram`, `create_from_template`, `author_document` y el editor producen **el mismo documento y la misma revisión** para el mismo diagrama (hoy no). El editor no cambia.

---

## 9. Impacto kernel / CACHE

| Slice | `model.js` | `kernelId` | `CACHE` | Chrome real |
|---|---|---|---|---|
| **018.8** | sí (`importPagesIn`) | cambia (`sync:kernel`; el MCP no la usa) | **v66 → v67** (`model.js`, `state.js`) | **obligatorio** |
| **018.9** | no | no cambia | no cambia | solo smoke: abrir los enlaces `#d=` v5 en el editor y en el Viewer |

---

## 10. Plan de QA

### 10.1 018.8
- **Unit (`vm`, editor real):** receptor y entrante con ids de EventType que colisionan (misma y distinta primitiva), con varios EventTypes, con EventTypes sin uso en el entrante (no se importan), con Steps sin EventType, con Steps hacia un id inexistente (D4), con varias páginas entrantes; ids nuevos sin reutilizar; `nextEventTypeId` del receptor; tema/ajustes del receptor intactos; Historias añadidas válidas y con el **mismo Trace** que en su documento original; documento resultante válido con `FluyoIntegrity`.
- **Undo (D3):** tras añadir, las pilas quedan vacías (o la entrada de estructura funciona) y ningún Undo deja Steps colgando.
- **Regresión permanente** del caso silencioso (misma primitiva) y del inválido.
- **Mutaciones** (≥15): no importar, reutilizar ids, no reescribir Steps, importar EventTypes no usados, tocar el tema/ajustes del receptor, no reservar el contador, no vaciar las pilas…
- **Chrome real:** Share → Viewer → «Abrir en Fluyo» → «Añadir como página» (con y sin sesión), reproducción de la Historia añadida, Ctrl+Z tras añadir, recarga; SW v67.
- Regresión completa (Fluyo y MCP, mutaciones previas, browsers 018.7c/7d).

### 10.2 018.9
- Paridad: `create_diagram`/`create_from_template` vs. editor/`author_document` (misma revisión) para las 3 plantillas y diagramas con todas las formas (incluida `code`).
- Compatibilidad: nombres de color (con y sin acentos), `key`, auto-layout y rejilla, posiciones iguales a las actuales (golden de `propose_layout`/`relayout`), enlace `#d=` abre en editor y Viewer.
- Reglas nuevas (D8/D9) con errores estructurados y sin trazas; lotes >200 operaciones encadenados.
- Mutaciones MCP; stdio real; `verify-deploy` sin cambios.

---

## 11. Fuera de alcance

`edit_diagram` (sigue legacy, decisión 96; su retirada es 018.10), `duplicate_page`, tope de páginas, `image` por MCP, `set_settings`, rediseño del `confirm()`/`alert()` nativos, guarda de Playback para Ctrl+Z, nombres de color en `author_document` (salvo que D6 diga otra cosa), cambios en `layeredLayout`, nuevas tools, la batería obsoleta `scenario-qa-mutations` y los 3 tests obsoletos de `fluyo-011-browser` (higiene, slices propios).

---

## 12. Orden de implementación

1. **Aprobar D1–D5** (y, si se quiere dejar cerrado, D6–D10 para 018.9).
2. **018.8:** tests que reproducen el defecto (fallan hoy) → `importPagesIn` en `model.js` → `appendPagesFrom` → política de Undo (D3) → mutaciones → `sync:kernel` → `CACHE` v67 → Chrome real → regresión completa → `DECISIONS.md`/`ARCHITECTURE.md`/handoff. Deploy: `fluyo` primero, luego `fluyo-mcp` (solo kernel sincronizado).
3. **018.9:** auditoría corta de confirmación sobre este documento → implementación en `src/diagram.ts`/`server.ts` según §4.2 → tests de paridad y contratos → README.
4. **018.10:** deprecación pública de `edit_diagram`.

---

## 13. Implementación (7 de octubre de 2026)

Decisiones aprobadas: **D1** (018.8 = solo la importación de páginas/EventTypes; `create_diagram`/`create_from_template` → 018.9), **D2** (siempre EventTypes nuevos), **D3** (vaciar Undo/Redo), **D4** (no reparar lo ya inválido), **D5** (sin aviso nuevo). Registradas como **108** y **109** en `DECISIONS.md`.

### 13.1 Causa raíz
`appendPagesFrom` (`state.js`) normalizaba el entrante con `documentFromProjectData` pero solo copiaba `nd.pages`; `nd.eventTypes` se descartaba. Los Steps conservaban sus `eventTypeId`, que pasaban a resolverse contra la biblioteca del receptor (lo único global que una página referencia). Reproducido antes de tocar código: 24 de las 25 pruebas de `test/fluyo-018-8.test.cjs` fallaban (la 25.ª, «entrante sin EventTypes», pasa antes y después por diseño); p. ej. el paso importado de «Reembolso» devolvía `«Pago»` en `FluyoStory.stepMeta`. En Chrome, el oráculo HEAD del test de navegador reproduce el fallo silencioso (Historia válida, símbolo 💵 y metadata distinta de la del Viewer).

### 13.2 Diseño implementado
- **Dominio — `importPagesIn(d, incoming)`** (`model.js`, junto a `deletePageIn`/`restorePageIn`): copia profunda del entrante (no lo modifica ni conserva referencias); reserva en un bloque, sobre una copia del contador (todo o nada), un id nuevo del receptor por cada EventType del entrante —**todos**, también los que no usa ninguna Historia— y uno por cada id colgante distinto; remapea los `eventTypeId` de los Steps importados; valida los EventTypes con su id nuevo; solo entonces muta: `nextEventTypeId = primero + n`, `eventTypes.push(…)`, `pages.push(…)`. No toca `cur`, tema, fondo ni la identidad de lo que ya había.
- **Editor — `appendPagesFrom`**: `documentFromProjectData` → `importPagesIn(doc, nd)` → `doc.cur` = primera añadida → `undoStack.length=0; redoStack.length=0;` → `clearSel()`/`renderTabs()`. `incomingAsNewPage`, el modal y sus textos no cambian (D5).

### 13.3 Contrato
- `importPagesIn(d, incoming)` → `{pageIndex, pages, eventTypes:[{from,to}], unresolved:[{from,to}]}`. Errores: `invalid_document` (`pages` / `eventTypes` del receptor o del entrante, `page` si una página entrante ya está en el receptor, `incoming` si no es un objeto o es el mismo documento) e `id_exhausted`. Ningún error modifica el receptor.
- Formato sin cambios (`version:5`, sin claves nuevas). MCP sin cambios de contrato (16 tools; ninguna fusiona documentos).
- **Invariantes de las Historias**: cada Historia importada conserva exactamente su semántica (EventType completo salvo el id, frase renderizada, `FluyoStory.stepMeta`, Trace); las del receptor no cambian; un EventType de origen se convierte en un único EventType importado, compartido por todas las Historias y páginas que lo usaban; el documento combinado es válido si lo eran los dos, y si el entrante ya era inválido conserva exactamente los mismos errores (mismo código, Historia y Step).

### 13.4 Desviaciones respecto a la auditoría
- **EventTypes sin uso del entrante: se importan.** §4.1/§10.1 proponían importar solo los que usan sus Steps. La orden de implementación pide no eliminar información salvo que el contrato lo indique explícitamente, y el contrato vigente trata la biblioteca como vocabulario del documento: viaja completa en los enlaces (decisión 67, también en «solo el diagrama») y un EventType sin uso se conserva hasta que alguien lo elimina de forma explícita (103, 79). Descartarlos habría sido la única pérdida silenciosa de la operación. Coste: la biblioteca crece algo más (aceptado en §7); el usuario puede eliminar los que no use.
- `invalid_document` usa el campo `incoming` para un entrante que no es un objeto o es el propio documento (la prueba de pureza del dominio de 018.1 prohíbe la palabra `document` entre `createNodeIn` y `clearPageContents`).
- **Oráculos de navegador obsoletos (previo, no tocado):** `fluyo-018-7c-browser.cjs` (2) y `fluyo-018-7d-browser.cjs` (1) comparan contra «HEAD = 018.7a», pero HEAD ya es 018.7 completo (`2d960d9`); fallan igual en un worktree limpio de HEAD. Con el árbol de trabajo de 018.8 sobre un worktree cuyo HEAD es `1c9755c` (018.7a) ambos dan **Chrome real OK**. Higiene para otro slice: parametrizar su referencia como `FLUYO_HEAD_REF` en 018.7a.

### 13.5 Archivos
- **fluyo**: `js/model.js` (`importPagesIn`), `js/state.js` (`appendPagesFrom`), `sw.js` (`CACHE` v66 → **v67**), `.ai/DECISIONS.md` (108, 109), `.ai/ARCHITECTURE.md`, esta tarea. Tests nuevos: `test/fluyo-018-8.test.cjs` (25), `test/fluyo-018-8-harness.cjs`, `test/fluyo-018-8-mutations.cjs` (21), `test/fluyo-018-8-browser.cjs`. Adaptados solo por versión de caché (v66 → v67): `fluyo-010-qa`, `013`, `014`, `015`.
- **fluyo-mcp**: `src/generated/kernel-sources.ts` (`sync:kernel`). Nada más.

### 13.6 QA
- Fluyo `node --test test/*.test.cjs`: **986/986**. `node --check` de `js/*.js`, `sw.js` y `test/*.cjs`: OK. `git diff --check` (los dos repos): OK.
- Casos obligatorios 1–10 cubiertos en `fluyo-018-8.test.cjs`, más D4 (Steps colgantes y primitiva incompatible preservados), contrato (forma del retorno, identidad, no mutación del entrante, todo o nada, contador), importar dos veces, paridad editor ↔ dominio (6 combinaciones + ida y vuelta por la normalización), comprobación estática, regresiones 018.7c (✕ + Undo/Redo de la página importada) y 018.7d (borrar páginas importadas → eliminar el EventType importado ya sin uso → Undo ×3) y 60 casos aleatorios con colisiones de ids y primitivas mezcladas.
- Mutaciones nuevas: **21/21**. Previas Fluyo: 016 28/28, 017.3 31/31, 018.1 29/29, 018.2 26/26, 018.3 60/60, 018.4 18/18, 018.5 44/44, 018.6 17/17, 018.7a 62/62, 018.7c 45/45, 018.7d 12/12. MCP (kernel regenerado): 017.3 30/30, 018.7c 28/28.
- MCP: `npm test` y `REQUIRE_FLUYO=1 npm test` **563/563**; `build`, `check:kernel`, `check:config`, `node --check dist/kernel.js`: OK.
- Chrome real: `fluyo-018-8-browser.cjs` **OK** (19 comprobaciones; flujo completo por la UI; oráculo HEAD reproduce el fallo); `014` OK (13 bloques), `016` OK (17; SW `fluyo-static-v67`, upgrade v56 → v67, offline), `017-3` OK, `018-7a` OK; `018-7c`/`018-7d` OK con su oráculo 018.7a (ver §13.4).

### 13.7 Kernel / CACHE
`kernelId` `2dfa4df3…a4c2` → **`175103329639689321c39a952e6b857addbd05cfe1cbffcc95e2cb857a85cb56`**; `check:kernel` confirma identidad con `fluyo/js`. `CACHE` **v67**; sin archivos servidos nuevos.

### 13.8 Próximo paso
Revisión del responsable → commit (`fluyo` + `fluyo-mcp`, solo el kernel sincronizado) → deploy: `fluyo` primero (SW v67), luego `fluyo-mcp`. Después, 018.9 (`create_diagram`/`create_from_template` por el kernel, D6–D10).
