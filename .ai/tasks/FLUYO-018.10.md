# FLUYO-018.10 — Retirada de `edit_diagram`

Estado: **IMPLEMENTADO — READY FOR COMMIT** (ver §7–§9). Sin commit, push ni deploy.
Fecha: 7 de octubre de 2026.
Owner/agente actual: libre.

> Repo público: nada de este documento es confidencial.
> Base: `fluyo` `e9c3042`, `fluyo-mcp` `55bbff5` (018.9 desplegado). Fuentes: `.ai/ARCHITECTURE.md`, `.ai/DECISIONS.md` (hasta la 113),
> `FLUYO-018.5`…`018.9`, README del MCP, `src/{server,diagram,model,schema,errors,layout,propose-layout,link,authoring}.ts`,
> `scripts/verify-deploy.sh`, tests y mutaciones que citan `edit_diagram`; en Fluyo `js/{model,ui}.js`, `sw.js`, `docs/index.html`, `README.md`.

## 1. Qué es hoy `edit_diagram`

**Solo una tool MCP legacy** (decisión 96). No hay lógica de dominio que dependa de ella: el kernel (`model.js`, `story-authoring.js`) no la
conoce; nada de Fluyo la llama. Vive entera en `fluyo-mcp`:

| Pieza | Dónde | Consumidores además de `edit_diagram` |
|---|---|---|
| Registro de la tool | `server.ts` | — |
| `editDiagram` | `diagram.ts` | test `fluyo-018-6` (paridad de `relayout` con `propose_layout`) |
| `buildNode`, `buildEdge`, `defaultLabelFor`, `assertValidIcon/Anim`, `boundingBox`, `parseOwnOutput` | `diagram.ts` | ninguno |
| `describeInternalIssues` | `errors.ts` | solo `parseOwnOutput` |
| `resolveColor` | `schema.ts` | solo `buildNode`/`editDiagram` (`create_*` usan `colorNameToHex`) |
| `OperationSchema`, `editNodeFields`, `editEdgeFields`, `Operation`, `NodeBuildSpec` | `model.ts` | ninguno |
| `layoutPage` | `layout.ts` | **`propose_layout`** → se conserva |
| `BorderSchema`, `parseDocument`, `FluyoProjectSchema`, `describeDocumentIssues` | `model.ts`, `diagram.ts`, `errors.ts` | **`create_diagram`, `export_diagram`** → se conservan |

Kernel: **no cambia**. Ningún archivo de `fluyo/js` cambia.

## 2. Operaciones de `edit_diagram` y su reemplazo

| `edit_diagram` | Reemplazo | Diferencias |
|---|---|---|
| `add_node` (con `key`) | `author_document` `create_node` (con `ref`) | `x`,`y` obligatorios (antes, sin ellos, se colocaba a la derecha del contenido): el agente usa los `bounds` de `describe_document` o `propose_layout` después. Colores solo HEX (decisiones 94, 111). Reglas y límites del dominio. |
| `update_node` | `update_node` | Parche de las claves del editor. **No** cambia `icon`/`anim` ni convierte a/desde `icon`/`anim` (decisión 87) — ver §5 D2. |
| `remove_node` | `delete_node` | Además quita su Behavior y respeta B2 (decisiones 89–90). |
| `add_edge` / `update_edge` / `remove_edge` | `create_connection` / `update_connection` / `delete_connection` | `update_connection` además permite retarget. |
| `set_theme` | `set_theme` (operación y tool) | Además `customBg`. |
| `rename_page` | `rename_page` | `pageIndex` explícito; 1–80 caracteres. |
| `relayout` | `propose_layout` → `author_document` (lotes) | `propose_layout` es solo lectura (decisión 98) y por defecto vacía los waypoints solo de las conexiones cuyos extremos se mueven (antes: todos). |
| `pageIndex` por defecto = `doc.cur`, sin revisión | `pageIndex` explícito + `baseRevision` (`describe_document`) | Control optimista (decisión de 017.2). |
| Conserva la versión y las claves desconocidas de la entrada (`passthrough`) | Documento v5 normalizado | Decidido en 017.2. |
| **Respuesta con enlace `#d=` al documento editado** | **Ninguno**: `author_document` y las tools de una operación no devuelven enlace | **Capacidad sin sustituto — §5 D1.** |

## 3. Plan

**Se elimina (MCP):** la tool `edit_diagram`; `editDiagram`; los helpers muertos de §1; `OperationSchema`/`editNodeFields`/`editEdgeFields`/
`Operation`/`NodeBuildSpec`; `resolveColor` y `describeInternalIssues`; imports que queden sin uso. Comentarios que la citan como existente.

**Se conserva:** `layoutPage`/`layeredLayout` (propose_layout, create_diagram), `parseDocument` (export_diagram), `BorderSchema` (create_diagram),
`buildOpenLink` (create_*). `propose_layout` sigue siendo solo lectura. Nada se mueve a `author_document`.

**Compatibilidad / deprecación:** retirada directa, sin stub: `tools/call edit_diagram` pasa a ser el error del SDK de tool inexistente
(sin trazas). Fue LEGACY desde 018.5 y su descripción ya remitía a `author_document`.

**Contrato:** `tools/list` = **15** tools (16 − 1, contado sobre `server.ts`). `verify-deploy.sh`: lista esperada sin `edit_diagram`, «las 15
tools». README del MCP: tabla de tools, ejemplo, enlace `#d=`, sección de `edit_diagram`, tests.

**Tests:**
- Eliminar los que prueban `edit_diagram` como tal (tools.test §edit_diagram, 018-5 «edit_diagram legacy no cambia», link.test de su enlace y del
  passthrough de `meta`). Reemplazar CON LA MISMA INTENCIÓN los que usaban `edit_diagram` como vehículo:
  · tools.test «un documento guardado por la app sobrevive» → `author_document` sobre los fixtures: solo cambia lo pedido respecto al documento normalizado;
  · tools.test «editar un id inexistente falla diciendo cuál» y «documento roto no filtra Zod» → `author_document`;
  · 018-6 «coincide con edit_diagram.relayout» → paridad `propose_layout` ↔ `layoutPage` y ↔ `create_diagram` (ya existe la segunda);
  · listas de tools (tools.test, 018-6, http.test) → 15.
- Nuevos (`test/fluyo-018-10.test.ts`): `edit_diagram` no está en `tools/list` (stdio e HTTP) y no se puede invocar; 15 tools con title y 4
  annotations; las operaciones de §2 por `author_document` (crear, modificar, retarget, eliminar, tema, renombrar, Z, duplicar, delete_page) y
  `propose_layout` → lotes; búsqueda estática: ningún `editDiagram`/`OperationSchema`/`buildNode` en `src/`.
- Mutaciones nuevas `scripts/mutate-018-10.ts`: vuelve el registro de la tool; vuelve el handler legacy sin registro (export vivo); se pierde
  una operación de `author_document`; `propose_layout` roto o mutante; recuento de tools; `verify-deploy.sh` desalineado. Revisar las
  mutaciones previas que citan `edit_diagram` (`mutate-018-5`: 2) y ejecutar las afectadas (017.3, 018.2, 018.3, 018.5, 018.6, 018.7a, 018.7c).

**Kernel / CACHE / Chrome:** kernel sin cambios. `CACHE` y Chrome dependen de §5 D3 (si se toca `docs/index.html`, que es un asset servido y
precacheado → `CACHE` v69 + navegador; si no, ni `CACHE` ni Chrome, por evidencia: no cambia nada servido).

## 4. Búsqueda estática (clasificación prevista)

- Documentación histórica válida (no se toca): `.ai/tasks/FLUYO-017*.md`, `FLUYO-018*.md` hasta 018.9, decisiones 96 y anteriores, `fluyo-mcp/docs/submission-test-cases.md` (D4).
- Referencia legítima: `fluyo/test/fluyo-017-2-qa.test.cjs` (comprueba que `author_document` NO tiene operaciones con esos nombres).
- A adaptar: los tests de §3; `mutate-018-5.ts`; `verify-deploy.sh`; README del MCP; comentarios en `authoring.ts`, `layout.ts`, `model.ts`,
  `propose-layout.ts`, `server.ts`; `fluyo/docs/index.html` y `fluyo/README.md` (D3).
- Código muerto: §1.

## 5. Decisiones (resueltas por el responsable)

- **D1 — el enlace `#d=` pertenece al RESULTADO de las operaciones de autoría, no a `edit_diagram`.** `author_document` (y con él `set_theme`,
  `reorder_nodes`, `duplicate_node`, que lo llaman) devuelve en cada respuesta con documento (no `dryRun`, no rechazo) el enlace al documento
  FINAL, con el mismo formato que ya usan `create_diagram`/`create_from_template`/`edit_diagram`. Una sola codificación (`link.ts`); sin tool
  nueva, sin almacenamiento, sin cambiar el formato. Sin truncar: si no cabe, el comportamiento actual (sin enlace y explicado), ahora además
  estructurado. Se demuestra la capacidad (tests + Chrome) ANTES de retirar `edit_diagram`.
- **D2 — aceptada la pérdida**: cambiar `icon`/`anim` de un nodo existente o convertirlo a/desde `icon`/`anim` deja de ser posible por MCP
  (decisión 87: tampoco en el editor). Sustituto: `delete_node` + `create_node` (ids nuevos; bloqueado por B2 si una Historia lo usa). Sin
  operación nueva.
- **D3 — actualizar** `fluyo/docs/index.html` y `fluyo/README.md` al contrato real (15 tools). `docs/` es un asset precacheado → `CACHE`
  v68 → **v69**, tests de caché, comprobación de precache y QA en Chrome (incluida `docs/index.html`). Sin bump adicional por el README.
- **D4 — no modificar** `fluyo-mcp/docs/submission-test-cases.md` (snapshot histórica). Comprobado: ningún script, test ni proceso la consume.

## 6. Diseño del enlace (D1)

- **Auditoría:** la codificación `#d=` ya es única: `buildOpenLink(project, env)` (`src/link.ts`), `#d=` = base64url([1] + deflate-raw(JSON del
  proyecto completo)), base `FLUYO_APP_URL` o `https://fluyo.space/`, tope `MAX_LINK_CHARS` = 16 000 caracteres (si no cabe → `null`; el lector
  del editor admite hasta 2 MB). La usan `create_diagram`, `create_from_template` y `edit_diagram` a través de `summarizeWithLink` (`server.ts`).
  No está acoplada a `edit_diagram`: no hay que extraer nada, solo reutilizarla.
- **`link.ts`:** `openLink(project, env)` → `{ok:true, url}` | `{ok:false, code:"LINK_TOO_LARGE", chars, maxChars, message}`; `buildOpenLink` queda
  como envoltorio (`url | null`) — misma codificación, una sola implementación.
- **`author_document`:** con documento devuelve `editorUrl` (o `editorUrlError` estructurado si no cabe) y una línea en el resumen. El
  documento del enlace es exactamente `document` (el proyecto final normalizado del kernel).
- **`create_diagram` / `create_from_template`:** ya devuelven el mismo enlace en el resumen; su JSON es el propio documento, así que no se le
  añade campo. Misma función, mismo texto si no cabe.
- Regresiones: enlace válido y decodificado = documento byte a byte (author_document, create_diagram, create_from_template), multipágina,
  tema, Historias/EventTypes/Behaviors, documento que no cabe (sin enlace, `LINK_TOO_LARGE`, sin truncar), entrada no mutada, `dryRun` y
  rechazos sin enlace; Chrome: MCP → `editorUrl` → editor → `serializeProject()` = documento.

## 7. Implementación

- **D1 primero (antes de retirar nada):** `link.ts` → `openLink` (estructurado) + `buildOpenLink` (envoltorio) + `openLinkLine`; `authoring.ts` añade
  `editorUrl` / `editorUrlError` al resultado con documento y una línea al resumen; `server.ts` usa la misma función para `create_*`. La
  capacidad se demostró con tests (9/9) y en Chrome real (MCP → `editorUrl` → editor: documento final byte a byte) antes de la retirada.
- **Retirada:** `server.ts` (registro, import, descripciones de `list_colors`, `author_document` y `propose_layout`, comentario de
  anotaciones), `diagram.ts` (solo `parseDocument` + adaptadores de 018.9), `model.ts` (sin `OperationSchema`/`editNodeFields`/`editEdgeFields`/
  `Operation`/`NodeBuildSpec`), `schema.ts` (sin `resolveColor`), `errors.ts` (sin `describeInternalIssues`), comentarios de `authoring.ts`,
  `layout.ts`, `propose-layout.ts`. `verify-deploy.sh`: 15. README del MCP: tabla, sección «Retirada de `edit_diagram`», enlace, lectura sin
  pérdida/edición normalizada, limitaciones.
- **Tests adaptados con la misma intención** (el sujeto dejó de existir o el vehículo era `edit_diagram`): `tools.test.ts` (contrato de 15; las
  ediciones por `author_document`; «un documento guardado por la app sobrevive»: ahora frente al documento NORMALIZADO, que es lo que la app
  tendría al abrirlo; documento roto: `DOCUMENT_UNREADABLE` en la edición y la ruta en `export_diagram`), `link.test.ts` (el enlace del documento
  editado es el de `author_document`; el caso «no cabe» usa un documento válido porque el kernel, como el editor, no acepta bytes de ruido como
  imagen), `fluyo-018-5` (sin el test «edit_diagram legacy no cambia»), `fluyo-018-6` (paridad `propose_layout` ↔ `layoutPage` nodo a nodo, en
  vez de ↔ `relayout`), recuentos 16 → 15 en 017.3, 018.5, 018.6, 018.7a, 018.7c, 018.9, `http.test.ts` (sin el caso de paridad de `edit_diagram`).
  `mutate-018-5.ts`: retiradas sus 2 mutaciones sobre `edit_diagram` (sujeto inexistente; lo vigila la batería de 018.10).
- **Editor (D3):** `docs/index.html` (tabla de 15 tools, recuentos, `edit_diagram` como retirada, consejo de layout), `README.md`, `sw.js` `CACHE` v69,
  tests de caché 010-qa/013/014/015.

## 8. QA

- MCP: `npm test` y `REQUIRE_FLUYO=1 npm test` **636/636**; `build`, `check:kernel`, `check:config`, `node --check dist/kernel.js`, `git diff --check`: OK.
  `fluyo-018-10.test.ts` 20/20 (6/9 de la parte del enlace fallaban antes de implementarlo).
- Fluyo: `node --test test/*.test.cjs` **1010/1010**; `node --check` de `js/*.js`, `sw.js`, `test/*.cjs`: OK. `fluyo-018-10.test.cjs` 5/5.
- Stdio real (`node dist/index.js`): 15 tools sin `edit_diagram`; `edit_diagram` → «Tool edit_diagram not found»; `create_diagram` v5 + enlace;
  `author_document` → `editorUrl` (v1) = documento final byte a byte; `describe_document` coherente; `propose_layout` solo lectura; rechazo sin enlace.
- HTTP: `scripts/verify-deploy.sh` contra `node dist/http.js` local **21/21** («las 15 tools del contrato»; el challenge con un valor sintético
  de `OPENAI_APPS_CHALLENGE`, que sin él da 404 a propósito).
- Mutaciones nuevas: MCP `mutate-018-10.ts` **20/20**; Fluyo `fluyo-018-10-mutations.cjs` **9/9**. Previas MCP: 017.3 30/30, 018.2 23/23,
  018.3 36/36, 018.5 35/35 (las 2 de `edit_diagram` retiradas), 018.6 38/38, 018.7a 33/33, 018.7c 28/28, 018.9 30/30. Previas Fluyo: 016 28/28,
  017.3 31/31, 018.1 29/29, 018.2 26/26, 018.3 60/60, 018.4 18/18, 018.5 44/44, 018.6 17/17, 018.7a 62/62, 018.7c 45/45, 018.7d 12/12,
  018.8 21/21, 018.9 7/7.
- Chrome real: `fluyo-018-10-browser.cjs` **18/18** (A: `author_document` y `set_theme` → `editorUrl` → editor sin sesión = documento final byte
  a byte, 2 páginas, tema, Historia, EventType, Behavior; B: tabla de `docs/` = 15 tools, `edit_diagram` solo como retirada, SW v69 con
  `./docs/` en caché y `docs/` offline; 0 errores). Regresión: 016 (SW v69, offline) OK, 014 (upgrade v56 → v69) OK, 017.3 OK, 018.9 36/36.

## 9. Kernel / CACHE

Kernel **sin cambios** (`kernelId` `5907c3e3a8e96d7c12a3b50698d23fc792ec63eb9e7a289bcab8c406f1801744`; `check:kernel` OK). `CACHE` v68 → **v69** solo por
`docs/index.html` (asset servido y precacheado en `PAGE_ASSETS`).

## 10. QA final: oráculos de navegador obsoletos (018.7c, 018.7d, 018.8)

Arrastrados desde 018.8 (§13.4): comparaban contra un HEAD anterior a la corrección que probaban. Reproducido antes de tocar nada
(copias temporales de los tres guiones volcando `a`/`h`): **HEAD y el árbol de trabajo dan valores idénticos en todo lo que cada guion
registra**; no hay regresión. Criterio de 018.5 (oráculo de 018.4 en `4587b5c`): si HEAD ya incluye la corrección, la assertion de HEAD
exige el comportamiento corregido e igual al del árbol de trabajo. Solo tests; sin cambios de producto, API, kernel ni docs públicas.

| Test | Assertion obsoleta | Escrita contra | Causa | Ahora exige |
|---|---|---|---|---|
| `fluyo-018-7c-browser` | HEAD salta a C al borrar una anterior (F2) | 018.7a `1c9755c` | 018.7c (`2d960d9`) corrigió F2 | `h.delFirst` = `a.delFirst` (activa B, 1 entrada de Undo) |
| `fluyo-018-7c-browser` | HEAD no deshace el borrado | 018.7a | 018.7c añadió Undo/Redo estructural | Ctrl+Z / Ctrl+Y / Ctrl+Z de HEAD = árbol de trabajo |
| `fluyo-018-7d-browser` | `!h.undo2.same` (HEAD no deshace) | 018.7a | 018.7c/7d (`2d960d9`) | `same(h, a)`: el guion entero idéntico |
| `fluyo-018-8-browser` (×3) | HEAD descarta la biblioteca, resuelve «Pago», reproduce 💵 | 018.7 `2d960d9` | 018.8 (`a57ea1e`, `importPagesIn`) | biblioteca, Steps («Reembolso»/«Confirmación»), recarga, ↩ y editor = Viewer iguales al árbol de trabajo; más `same(h, a)` |

Cobertura: 7c 29 → 29 comprobaciones, 7d 12 → 12, 8 19 → 20 (la igualdad del guion completo). Cabeceras y el comentario del corte del
guion de HEAD en 7c actualizados. Chrome real: 018.7c, 018.7d y 018.8 **OK**; 018.10 18/18; 016 y 014 OK. Fluyo 1010/1010; `git diff --check` OK.
