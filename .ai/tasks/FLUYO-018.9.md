# FLUYO-018.9 — `create_diagram` y `create_from_template` por el dominio (documento v5 canónico)

Estado: **IMPLEMENTADO — READY FOR COMMIT** (ver §8 QA). Sin commit, push ni deploy.
Fecha: 7 de octubre de 2026.
Owner/agente actual: libre.

> Repo público: nada de este documento es confidencial. Todas las pruebas usan documentos sintéticos.
> Fuentes: `FLUYO-018.8.md` (§3.2, §4.2, D6–D10), `.ai/ARCHITECTURE.md`, `.ai/DECISIONS.md` (hasta la 109); código de `fluyo/js`
> (`model.js`, `story-authoring.js`, `state.js`, `ui.js`, `render.js`, `viewer.js`, `share-url.js`, `deeplink.js`, `index.html`) y
> `fluyo-mcp/src` (`diagram.ts`, `schema.ts`, `model.ts`, `templates.ts`, `authoring.ts`, `server.ts`, `revision.ts`, `kernel.ts`, `link.ts`).

## Objetivo

Que `create_diagram` y `create_from_template` produzcan el **documento v5 canónico del dominio**: el mismo, byte a byte y con la misma
`revision`, que construir ese diagrama con `author_document`; mismos defaults, campos, validaciones y límites. Sin segundo motor.

## 1. Causa raíz

`createDiagram` (`diagram.ts`) era una **segunda fábrica de documentos**: escribía un v3 a mano (`buildNode`/`buildEdge` con defaults
propios, `meta.generator`, `settings` con rangos propios) y lo validaba con el zod `passthrough` de `model.ts`, no con el kernel. De ahí
las divergencias de la auditoría 018.8 §3.2 (etiqueta de `code`, `fs`/`lineColor`/`dotColor` sobrantes, `keywords`/`kwBg`/`kwColor`
ausentes, HEX laxo, auto-lazos, límites, nombre de página, `customBg`, `speed`/`stagger`, revisión distinta). Reproducidas antes de
tocar código con la batería nueva: **43/51** pruebas fallaban con la ruta antigua.

**Hallazgo durante la implementación (dominio):** `createNodeIn` (`model.js`) completaba los campos de `code` DESPUÉS de copiar el
spec, con `Object.assign(n,{lang, keywords:null, kwBg:null, kwColor:null})` solo si faltaba `lang`: sin `lang` **pisaba**
`keywords`/`kwBg`/`kwColor` (y unas `keywords` inválidas se descartaban en vez de rechazarse); con `lang`, los no pedidos quedaban
ausentes. Afectaba ya a `create_node` de `author_document` y, por la ruta del dominio, habría hecho perder `keywords` a `create_diagram`
(entrada válida hasta hoy). Se paró y se consultó: el responsable decidió **corregirlo en el dominio dentro de este slice** (decisión 113).
Reproducido: 14/19 pruebas de `test/fluyo-018-9.test.cjs` fallaban contra HEAD.

## 2. Diseño implementado

```text
create_diagram ──────────┐  key → ref · nombre de color → HEX · auto-layout (layeredLayout) — lo único propio de estas tools
create_from_template ────┘  (la plantilla da la entrada de create_diagram)
   └─► documento en blanco del editor: projectToSerializable(doc, settingsFromProjectData({...settings, ...ajustes}))   (model.js)
       └─► rename_page · set_theme · create_node · create_connection ─► FluyoAuthoring.apply (lotes ≤ 200 encadenados)
           └─► documento v5 canónico + revisionOfProject
```

- **Fuente de verdad del documento base:** el `doc` y los `settings` iniciales de `model.js` (el documento en blanco del editor; el
  editor no tiene «documento nuevo», 018.8 §3.2) evaluados en un kernel nuevo por llamada, con los ajustes pedidos pasados por
  `settingsFromProjectData` (la carga del editor) sobre el objeto `settings` del editor (orden de claves canónico).
- **Operaciones:** `rename_page` (si hay `pageName`), `set_theme` (si hay `theme`/`customBg`), un `create_node` por nodo (`ref` = `key`,
  colores ya en HEX, `x`/`y` del auto-layout si faltan) y un `create_connection` por arista. Lotes de `FluyoAuthoring.MAX_OPERATIONS`;
  dentro del lote las conexiones usan `{ref}` y entre lotes el `{id}` que devolvió `refs` (como `propose_layout`, por lotes).
- **Errores:** los del kernel, con la forma del rechazo de `author_document` (`{ok:false, valid:false, engineVersion, kernelId, errors,
  note}`, `isError`, sin documento) y traducidos al contrato de la tool: `input` (`nodes[i]`, `edges[j]`, `pageName`, `customBg`, `font`,
  `nodes`/`edges` en los límites de conteo), `key`, `requested` (conteos), mensaje de color que cita `list_colors` y sin el índice de
  operación interna. Lo que solo existe en la tool: `key` repetida → `DUPLICATE_REF`; arista hacia una `key` inexistente → `UNKNOWN_REF`;
  plantilla inexistente → `TEMPLATE_NOT_FOUND`; clave de `labelOverrides` desconocida → `INVALID_FIELD labelOverrides.<clave>`.
- **Ajustes:** sin `.default()` en el schema para página, tema ni ajustes (lo omitido es el valor del documento en blanco). Si
  `settingsFromProjectData` cambiaría un valor pedido (fuera de rango, tipografía desconocida) se rechaza con `INVALID_FIELD` en vez de
  abrirse con otro valor; los rangos de `speed`/`stagger` del schema son los del editor (`index.html` + `settingsFromProjectData`).
- **Dominio (`model.js`):** `createNodeIn` pone los defaults de `code` en el objeto base, antes del spec, que los sustituye clave a clave.
- `buildNode`/`buildEdge`/`defaultLabelFor` quedan (ya no exportados) solo para `edit_diagram` (legacy, sin cambios; retirada en 018.10).

## 3. Archivos

- **fluyo**: `js/model.js` (`createNodeIn`), `sw.js` (`CACHE` v67 → **v68**), `.ai/DECISIONS.md` (110–113), `.ai/ARCHITECTURE.md`, esta
  tarea. Tests nuevos: `test/fluyo-018-9.test.cjs` (19), `test/fluyo-018-9-mutations.cjs` (7), `test/fluyo-018-9-browser.cjs` (Chrome
  real). Adaptados solo por versión de caché (v67 → v68): `fluyo-010-qa`, `013`, `014`, `015`.
- **fluyo-mcp**: `src/diagram.ts` (adaptador), `src/schema.ts` (`paletteHexOf`, `colorNameToHex`), `src/model.ts` (schema de
  `create_diagram`), `src/templates.ts` (errores como datos), `src/server.ts` (las dos tools + descripciones), `src/generated/kernel-sources.ts`
  (`sync:kernel`), `README.md`. Tests: nuevo `test/fluyo-018-9.test.ts` (55) + `test/fixtures/fluyo-018-9-golden.json` (golden derivado de
  la ruta del DOMINIO; `UPDATE_GOLDEN=1` lo regenera), `scripts/mutate-018-9.ts` (30). Adaptados al contrato nuevo (D2): `link.test.ts`
  (`meta.generator`: lo creado ya no se firma; el passthrough de `edit_diagram` sigue probado con un documento firmado),
  `fluyo-017-1-qa.test.ts` y `fluyo-018-6.test.ts` (la salida es v5; la lectura de v3 se sigue probando con `version:3`).

## 4. Contrato

- **Salida:** `[resumen + enlace #d=, JSON]` como antes; el JSON es el documento **v5** canónico (claves `version, app, doc, settings`),
  sin `meta`. Rechazo: `[«Diagrama RECHAZADO (CODE): …», JSON {ok:false, valid:false, engineVersion, kernelId, errors, note}]`, `isError`.
- **Entrada de `create_diagram`:** mismas claves. `pageName`, `theme`, `grid`, `build`, `speed`, `dots`, `stagger`, `single` ahora
  opcionales sin default publicado (los del editor). `speed` 0,2–2 (antes 0,05–5), `stagger` 0,2–1,2 (antes 0–5), `dots` 1–6.
  `font` = familia CSS de `list_fonts`. `customBg` HEX o `""`. Colores: nombre de `list_colors` o HEX.
- **`create_from_template`:** misma entrada; mismas reglas y salida que `create_diagram`.
- 16 tools; `verify-deploy.sh` sin cambios.

## 5. Decisiones aplicadas

D1 (alcance) · D2 (v5, sin `meta.generator`: sin consumidores, confirmado por búsqueda en `fluyo` y `fluyo-mcp`) · D3 (nombres de color
solo en la entrada; el kernel no cambia para ellos) · D4 (validación del dominio; el adaptador solo transforma, traduce colores, construye
operaciones y traduce errores) · D5 (límites del kernel, sin recortes) · D6 (`SELF_LOOP`, también entre lotes) · D7 (rangos del editor)
· D8 (defaults del dominio; `code` cubierto) · D9 (paridad de campos con el documento canónico) · D10 (plantillas por la misma ruta) ·
D11 (revisión del documento v5 canónico; determinismo byte a byte) · D12 (compatibilidad, §6). Registradas como **110–112**; el arreglo
de `createNodeIn`, aprobado durante la implementación, como **113**.

## 6. Compatibilidad

| Entrada | Antes | Ahora |
|---|---|---|
| Diagrama válido (nombres de color, `key`, auto-layout, rejilla) | v3 | v5 equivalente, mismas posiciones |
| `code` con `keywords`/`kwBg`/`kwColor` sin `lang` | se conservaban | se conservan (arreglo del dominio) |
| Auto-lazo, >300 nodos, >600 conexiones, `|x|>100000`, `w/h` fuera de 10–5000 | aceptados | `SELF_LOOP` / `LIMIT_EXCEEDED` |
| HEX no CSS (`#1234`, `#12345`, `#1234567`), `customBg` no HEX | aceptados | `INVALID_FIELD` |
| Nombre de página > 80 o en blanco | aceptado | `INVALID_NAME` |
| `speed` fuera de 0,2–2, `stagger` fuera de 0,2–1,2 | aceptados (el editor los recortaba al abrir) | rechazados por el schema |
| Tipografía global desconocida | aceptada (el editor la cambiaba por Georgia) | `INVALID_FIELD font` |
| Campos desconocidos en la entrada | ignorados | ignorados (sin cambios) |
| `meta.generator` | en lo creado | ya no; un documento firmado antiguo sigue abriéndose y `edit_diagram` lo conserva |

Todo consumidor lee v1–v5; la `revision` ya se calculaba sobre el documento normalizado.

## 7. Desviaciones

- **Arreglo en `model.js`** (fuera de D1): hallazgo bloqueante, consultado y aprobado (decisión 113). Implica `kernelId` nuevo, `CACHE`
  v68 y QA del editor en Chrome.
- **Tipografía global desconocida → `INVALID_FIELD`** (D7: el editor la cambiaría; no se deja «una segunda interpretación»). Es el único
  ajuste que antes se aceptaba con cualquier texto.
- **Mutante equivalente descartado:** «documento en blanco sin normalizar cuando no hay operaciones» sobrevivía porque el documento en
  blanco + `settingsFromProjectData` ya es idéntico a su normalización; se sustituyó por «ajustes sin `settingsFromProjectData`». La
  normalización explícita del caso sin operaciones se conserva (D2, por construcción).
- `DUPLICATE_REF`/`UNKNOWN_REF` para `key` las produce el adaptador (las `key` no existen en el dominio y, entre lotes, el kernel no podría
  verlas); reutilizan los códigos de `author_document`, no hay códigos nuevos salvo `TEMPLATE_NOT_FOUND`.

## 8. QA

- MCP: `npm test` y `REQUIRE_FLUYO=1 npm test` **618/618**; `build`, `check:kernel`, `check:config`, `node --check dist/kernel.js`,
  `git diff --check`: OK. Batería nueva `fluyo-018-9.test.ts` 55/55 (43/51 fallaban con la ruta antigua), incluido el servidor real por stdio.
- Fluyo: `node --test test/*.test.cjs` **1005/1005**; `node --check` de `js/*.js`, `sw.js`, `test/*.cjs`: OK. `fluyo-018-9.test.cjs` 19/19
  (14/19 fallaban contra HEAD).
- Mutaciones nuevas: MCP `mutate-018-9.ts` **30/30**; Fluyo `fluyo-018-9-mutations.cjs` **7/7**. Previas MCP: 017.3 30/30, 018.2 23/23,
  018.3 36/36, 018.5 37/37, 018.6 38/38, 018.7a 33/33, 018.7c 28/28. Previas Fluyo: 016 28/28, 017.3 31/31, 018.1 29/29, 018.2 26/26,
  018.3 60/60, 018.4 18/18, 018.5 44/44, 018.6 17/17, 018.7a 62/62, 018.7c 45/45, 018.7d 12/12, 018.8 21/21. Cinco mutaciones (Fluyo
  018.1 M8/M13/M23/M25, 018.2 D6; MCP 018.2) apuntaban al texto anterior de `createNodeIn`: patrones actualizados con la misma intención.
- Chrome real: `fluyo-018-9-browser.cjs` **36/36** (create_diagram + 3 plantillas → `#d=` en el editor y el Viewer locales; editor =
  documento de la tool byte a byte; 0 errores de consola). 016 (SW v68, offline), 014 (upgrade v56 → v68), 017.3, 018.3, 018.4, 018.5,
  018.7a: OK. 018.7c (2), 018.7d (1) y 018.8 (3) fallan SOLO en su oráculo «HEAD», e idénticamente en un clon limpio de HEAD `a57ea1e`:
  oráculos obsoletos previos (ver 018.8 §13.4), no tocados.

## 9. Kernel / CACHE

`kernelId` `175103329639689321c39a952e6b857addbd05cfe1cbffcc95e2cb857a85cb56` → **`5907c3e3a8e96d7c12a3b50698d23fc792ec63eb9e7a289bcab8c406f1801744`**
(solo `model.js`). `CACHE` **v68**.

## 10. Próximo paso

Revisión del responsable → commit (`fluyo` + `fluyo-mcp`) → deploy: `fluyo` primero (SW v68, `model.js`), luego `fluyo-mcp`. Después,
018.10: deprecación/retirada de `edit_diagram`.
