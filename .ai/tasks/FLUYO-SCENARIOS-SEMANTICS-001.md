# FLUYO-SCENARIOS-SEMANTICS-001 — Productización de Semantic Scenarios

Estado: **FASE 6 READY FOR PUSH** (2026-10-21; commit de FASE 6 sobre `a4bbf2f` aprobado por el PO, sin push ni deploy): cierre del PO aplicado sobre `a4bbf2f` (B1 en el pegado, B9 aceptado, «Automática · nombre», bandera retirada, «Semántica» en «Puntos»; decisiones 250–254, CACHE v101); 018.23 = base; vm 1566/83 = conjunto de la base; sin commit, push ni deploy (§ «FASE 6»).
con push y deploy (§ «FASE 5 — Publicación»); CACHE v100, decisiones 245–249. **FASE 4 CERRADA** (2026-10-20): `6701261` con push y deploy (fluyo.space sirve v99, smoke en producción 24/24). Ver § «Publicación» de FASE 4 · FASE 1 + FASE 2 publicadas (`eff5129`, v94) · FASE 3 publicada (`544fd4b`, v96) ·
FASE 4 (Scenario Experience) implementada sobre `main` `ae0d619` (producción v98), sin commit, push ni deploy · `CACHE` v99 · decisiones
241–244 · MCP: sin cambios · siguiente: revisión del PO. Ver § «FASE 4» y § Handoff.
Referencias históricas: línea congelada `59588a9` + `ca08fc1` + `2f9f418` (base `ce8e699`); `feat/scenario-semantics`
(`4fb5872`, `e47500f`, `94e50fa`).
Owner/agente actual: (libre)

> **Repo público**: este archivo puede terminar publicado. Solo contenido técnico apto para público (`AGENTS.md` §9).
>
> FASE 0 = auditoría + diseño + contrato + plan de integración + plan de pruebas. **Sin código de producto**, sin
> cherry-pick, merge ni rebase, sin cambios de schema, de tests ni de `sw.js`.
> Decisiones (ACEPTADAS por el PO el 2026-10-18): `.ai/architecture/SCENARIO-SEMANTICS-001.md` (D1–D12 y anexos). Aquí no se
> repiten; se enlazan. Lo implementado: `.ai/DECISIONS.md` 214–225 (en la línea congelada, 213–224; antes, 209–220; ver la
> decisión 214). Las secciones históricas de abajo conservan la numeración de su momento.

## Objetivo

Convertir en funcionalidad real el núcleo validado por el QA del PO sobre el prototipo: conexiones **Conexión / Flujo /
Requisito** (`edge.kind`), disponibilidad **AVAILABLE / UNAVAILABLE / UNKNOWN** y la **ruta observada** derivada durante una
Historia, para distinguir «cambió el estado de un nodo» de «cambió el comportamiento de la ruta».

## Por qué

PO QA sobre FLUYO-SCENARIO-PROTOTYPE-002: PASS → READY_FOR_PRODUCT_DESIGN. El PO confirmó: se entiende cuándo cambia un nodo
y la ruta sigue disponible; cuándo la caída del segundo worker cambia la ruta; UNKNOWN ≠ caído; REQUIRES no implica caída del
origen; «Ruta disponible» e «incluye estados por defecto» resultan naturales. La hipótesis central no se revalida.

## Alcance

### Incluye
Ver § 0 del registro de decisiones: núcleo, frontera de producto y cuatro niveles semánticos.

### No incluye
Salud, incidentes, degradado/afectado/bloqueado, impacto, causa, reintentos, colas, capacidad, latencia, SLA, vigilancia de
todos los pares, radio de impacto, clasificación automática de conexiones (IA/LLM/heurística), estado de Requisito,
rediseño del reloj de Historia, otra feature.

---

## 1. Bootstrap (FASE 0)

Leído: `AGENTS.md`; `.ai/ARCHITECTURE.md` (completo: Scenarios, EventTypes, Present 013, Share 014, lenguaje visual 015,
Historias 016, kernel 017.1–017.3, autoría 018.1–018.10, móvil/Propiedades 018.12–018.24, rutas 018.25, puntas 018.27,
piel 019.1–019.3, tinte 019.5, flow-fade); `.ai/DECISIONS.md` (70, 104, 107, 134, 197, 200–208);
`.ai/tasks/FLUYO-SCENARIO-PROTOTYPE-001.md` y `-002.md`; diffs completos `b534a97..9d36648` y `9d36648..f151dfe`;
código de `model.js`, `scenario-engine.js`, `scenario-playback.js`, `story-playback.js`, `story-clock.js`, `render.js`,
`selection.js`, `state.js`, `ui.js`, `editor-scenarios.js`, `share-url.js`, `link-codec.js`, `viewer.js`, `s/index.html`,
`sw.js`. MCP (`fluyo-mcp`, repo aparte, solo lectura; la tarea lo exige expresamente): `src/authoring.ts`, `src/model.ts`,
`src/stories.ts`, `src/server.ts`, `src/revision.ts`, `scripts/sync-kernel.ts`, tests de contrato.

### Estado de los repositorios (auditado el 2026-10-18)

| Repo / worktree | Rama | HEAD | Estado |
|---|---|---|---|
| `C:\Proyectos\fluyo-new\fluyo` | `main` | `266ac09` fix(019.5) | **trabajo ajeno sin commit** (FLUYO-019-FLOW-FADE / 019.4: `js/render.js`, `sw.js` → `CACHE` v89, `.ai/ARCHITECTURE.md`, `.ai/DECISIONS.md`, ~48 tests y 5 archivos sin seguimiento). **No tocado.** |
| `C:\Proyectos\fluyo-new\fluyo-scenario-proto` | `prototype/scenario-semantic-playback` | `f151dfe` (padre `9d36648`, base `b534a97`) | limpio |
| `C:\Proyectos\fluyo-new\fluyo-mcp` | `main` | `81154f1` | limpio; kernel sincronizado con `1ee65ee` (`check:kernel` OK) |

`main` avanzó un commit sobre la base del prototipo (`b534a97..266ac09`: 019.5, `geometry.js`, `render.js`, `export.js`,
`sw.js` v88). El prototipo y `main` usan **las mismas versiones de caché** (v88 y v89) para contenidos distintos.

---

## 2. Auditoría del estado actual (main `266ac09`)

| Tema | Dónde | Hallazgo |
|---|---|---|
| Conexión | `model.js` `normalizeProjectEdge` | no conoce `kind`; claves desconocidas se conservan (passthrough). Corpus (ejemplos + fixtures): 0 conexiones con `kind` |
| Autoría de conexión | `CONNECTION_SPEC_KEYS`/`CONNECTION_UPDATE_KEYS` (`model.js:683,789`) | `kind` no está: el editor no puede escribirlo por dominio; MCP lo rechaza |
| Disponibilidad | `SCENARIO_STATES`, `EVENT_TYPE_AVAILABILITY` (`model.js:62,65`), `VALID_STATES` (`scenario-engine.js:14`) | solo `UP|DOWN`; otro valor → documento ilegible |
| Inicial | `setInitialAvailability` (`model.js:653-660`) | `UP` = sin Behavior; solo se persiste `DOWN` |
| Motor | `runScenario` | `SET_STATE` emite `state_changed` solo si cambia; `SEND` falla solo con `DOWN` y se decide en su `at` |
| Playback | `scenario-playback.js` | `nodeStates` al cursor; token del `SEND` viaja `MOTION_MS` tras `at` |
| Pintado de estado | `render.js` `drawScenarioNodeOverlay` | solo `DOWN` (oscurecido); cualquier otro valor = disponible |
| Textos | `story-playback.js:222`, `editor-scenarios.js:134,1109,2277` | binarios UP/DOWN |
| Historia (dato) | `normalizeScenarios` | Steps con claves exactas; la Historia admite claves extra (precedente `arrivalDependencies`) |
| Copiar/pegar/duplicar | `copySel`, `pasteClip`, `dupSel` → `cloneStructureIn` | copia profunda de conexiones y Behaviors (sin validar Behaviors) |
| Undo | `pageSnap` (`deep(pg)`) + `libSnap` | conserva cualquier clave de conexión y de Historia |
| Share / `#d=` | `applyShareKind`, `link-codec.js` (JSON deflate) | passthrough; «Compartir historia» copia la Historia entera |
| Viewer | `s/index.html` | carga `model.js`, `render.js`, `story-*`; sin bandera |
| Versión | `projectFromProjectData` | `version > 5` → `unsupported_version` («necesita una versión más reciente»), ya cableado en el Viewer |
| Banderas | — | no existe infraestructura; patrón disponible: preferencias en `localStorage` (`fluyo.ui.*`) |
| Service worker | `sw.js` | cache-first; `./docs/` precacheado (`docs/` es servido) |

---

## 3. Inventario del prototipo (clasificación de producto)

| Pieza | Clasificación | Motivo |
|---|---|---|
| `edge.kind` opcional (`FLOWS_TO`/`REQUIRES`, ausente = Conexión) | **KEEP** | contrato D1/D2; escritura por dominio en vez de inline |
| Selector Conexión · Flujo · Requisito | **KEEP** (en Propiedades) | markup estático + `segBind`, no inyectado |
| UNKNOWN en el kernel (`model.js`, `scenario-engine.js`) | **REDESIGN** (diferido, D3) | rompe documentos en editores/MCP anteriores; `SEND` con UNKNOWN se completa |
| UNKNOWN en el diálogo de eventos | **REDESIGN** (diferido, D3) | dependía de la bandera; fuera de ella solo al editar uno existente |
| Selectores de flujo observado | **REDESIGN** | persistidos en la Historia (D5), con recuperación y resolución determinista |
| Derivación de ruta (`semantic-flow.js`) | **REDESIGN** | estado por alcanzabilidad (exacto), NO_PATH separado, horario visible siempre |
| Procedencia | **KEEP** (definición congelable, D4) | punto abierto: «Condiciones → Disponible» = DEFAULT |
| Calificador por defecto/explícito | **KEEP** | «incluye estados por defecto» en la línea de estado |
| Pintado de ruta (halo/fundas) | **KEEP/TUNE** | ver § Pintado del registro |
| Funda UNAVAILABLE | **KEEP** | |
| Barrido de transición | **KEEP** | |
| Pintado de ruta UNKNOWN | **KEEP** en el sistema, fuera del MVP | |
| Línea de tiempo de comportamiento | **KEEP** (D6) | derivada, horario visible, memoizada |
| Filas de ruta («vía Worker-A · disponible») | **REDESIGN** | ver § 3.1 |
| Fixture «Workers y flujo» | **PROTOTYPE_ONLY** | contiene UNKNOWN; se reescribe un fixture de pruebas sin UNKNOWN con los mismos casos |
| Bandera `?prototipo=escenario-semantico` | **REMOVE** | sustituida por la bandera labs (D10) |
| Cargador del prototipo (`protoLoadFixture`, gancho en `deeplink.js`) | **REMOVE** | |
| Ganchos `typeof proto…` (`render.js`, `ui.js`, `editor-runtime.js`) | **REMOVE** | en producto: `renderState`/spec y `refreshPanel` |
| Código de QA (estilos inyectados, `protoStripView` para tests) | **PROTOTYPE_ONLY** | estilos a `css/styles.css`; vista pura se reescribe |
| Capturas `.ai/qa/scenario-semantic-playback-002/` (20 PNG) | **PROTOTYPE_ONLY** | evidencia; no entra en `main` (repo público, binarios) |

### 3.1 Evidencia de rutas — REDESIGN

¿Ayudan a entender la ruta alternativa? **Sí cuando hay dos o más rutas** (es exactamente el caso del segundo worker que el
PO validó). ¿Añaden explicación técnica? **Sí** con el contador por fila («· 4 por defecto») y con más de dos rutas.
Contrato: filas solo con ≥ 2 rutas; nombradas por sus nodos distintivos; ≤ 3 filas + «+N rutas»; sin contador «por defecto»
por fila (la procedencia vive en la línea de estado; el detalle en el `title`); nunca en Viewer ni Present; «Rutas
truncadas» desaparece (el estado ya no depende de la enumeración).

---

## 4. Decisiones de producto

Ver `.ai/architecture/SCENARIO-SEMANTICS-001.md`: D1 `edge.kind`, D2 Conexión por defecto, D3 UNKNOWN (DEFER_AUTHORING),
D4 procedencia, D5 flujo observado (STORY_PERSISTED), D-Ruta (contrato formal), D6 timeline, D7 Viewer (V2), D8 Present,
D9 MCP, D10 bandera, D11 integración (B), D12 bloqueantes, § T tiempos, § Requisito, § Pintado, § Export, § V validación,
§ Autoría, § Undo.

Respuestas rápidas a la tarea: **D1** sí, propiedad opcional · **D2** sí, ausencia = Conexión · **D3** no se persiste
`"GENERIC"` · **D4** el selector pertenece a Propiedades · **D5** cambiar `kind` es Undoable (una entrada) · **D6** ningún
edge viejo se transforma en Flujo.

---

## 5. Matriz de superficies (disponibilidad)

Leyenda: ✔ sí · ✘ no · — no aplica. «Proto» = rama del prototipo; «MVP» = diseño propuesto (D3 = B).

| Superficie | AVAILABLE | UNAVAILABLE | UNKNOWN (hoy main) | UNKNOWN pintado distinto | UNKNOWN round-trip | Proto | MVP |
|---|---|---|---|---|---|---|---|
| Editor (carga/guardado) | ✔ | ✔ | ✘ documento ilegible | — | ✘ | acepta; distinto solo con bandera | rechaza (sin cambio) |
| Historia (motor/Trace) | ✔ | ✔ | ✘ `invalid_state` | — | — | acepta; `SEND` con UNKNOWN se completa ✘ | rechaza |
| Playback editor | ✔ | ✔ (oscurecido) | ✘ | — | — | pintado como disponible sin bandera ✘ | — |
| Present | ✔ | ✔ | ✘ | — | — | sin capas; UNKNOWN = disponible ✘ | — |
| Viewer | ✔ | ✔ | ✘ `invalid_document` | — | — | carga; UNKNOWN = disponible ✘ | rechaza |
| Share / `#d=` | ✔ | ✔ | transporta el JSON; el receptor lo rechaza | — | ✔ (bytes) | ✔ | — |
| MCP | ✔ | ✔ | ✘ `DOCUMENT_UNREADABLE`, enums zod `UP|DOWN` | — | ✘ | no sincronizado | rechaza (sin cambio) |
| Serialización (`model.js`) | ✔ | ✔ | ✘ | — | ✘ | ✔ | ✘ |
| Validación (`FluyoIntegrity`) | ✔ | ✔ | ✘ error | — | — | ✔ | ✘ error |
| Importar (archivo, «Añadir como página», `?ejemplo=`) | ✔ | ✔ | ✘ | — | — | ✔ | ✘ |
| Ejemplos | ✔ | ✔ | ninguno lo usa | — | — | — | — |
| Tests | ✔ | ✔ | ✘ | — | — | solo tests del prototipo | guardas de rechazo |

Gate «UNKNOWN nunca como AVAILABLE»: hoy se cumple **por rechazo**; el prototipo **lo viola** fuera de su bandera, en
Present y en el Viewer, y en el motor (`SEND`). El MVP lo cumple por rechazo; la tarea futura de UNKNOWN lo cumple por pintado
y semántica de motor (D3).

## 6. Matriz de compatibilidad

| Dirección | Qué ocurre realmente | Clase |
|---|---|---|
| Documento antiguo → editor nuevo | sin `kind` = Conexión; sin `observedFlow` y sin Flujo = no hay herramienta; UP/DOWN, Historias y Shares idénticos; guardado byte a byte igual | **SAFE** |
| Documento con `kind` → editor actual (`main`) | `kind` se conserva (passthrough) al cargar, guardar, copiar/pegar, duplicar, Undo, compartir; se pinta como Conexión; no se puede editar | **DEGRADED** (sin pérdida) |
| Documento con `kind` → Viewer actual / SW antiguo | se ve como Conexión | **DEGRADED** |
| Documento con `observedFlow` → editor actual | se conserva (dato de Historia, como `arrivalDependencies`); invisible; borrar un extremo no poda → ENDPOINT_MISSING en el editor nuevo, recuperable | **DEGRADED** |
| Documento con `kind`/`observedFlow` → MCP actual | conservados por `author_document` y tools de una operación; `describe_document` no los ve; `create_diagram`/plantillas no pueden crearlos (zod los quita) | **DEGRADED** |
| Documento con UNKNOWN → editor actual / Viewer actual / MCP actual | no abre: «no es un diagrama Fluyo válido» / `invalid_document` / `DOCUMENT_UNREADABLE`; riesgo de autoguardado ilegible por pegado entre versiones | **UNSUPPORTED** (por eso D3 = B) |
| Shares existentes | sin `kind` ni `observedFlow`: idénticos | **SAFE** |
| Historias existentes | sin cambio de Trace, Playback ni textos | **SAFE** |
| Comportamiento UP/DOWN existente | sin cambio (motor y Playback intactos) | **SAFE** |

## 7. Matriz de migración por archivo (`b534a97..f151dfe`)

| Archivo | Cambio del prototipo | Clase | Destino en producto |
|---|---|---|---|
| `js/semantic-flow.js` (nuevo) | derivación pura, procedencia, timeline | **rewrite cleanly** | módulo puro de ruta (no kernel), API equivalente; alcanzabilidad, NO_PATH, horario visible |
| `js/proto-semantic.js` (nuevo) | bandera, fixture, pintores, panel, herramienta, estilos | **prototype-only** (se reescriben piezas) | pintores → `render.js` vía spec/renderState; selector → `index.html` + `ui.js`; herramienta → `index.html` + `editor-scenarios.js` + `css/styles.css` |
| `js/render.js` | 2 ganchos `typeof` | **rewrite cleanly** | marcas estáticas por `edgeSemanticSpec(e)`; overlays desde `renderState` |
| `js/ui.js` | gancho en `refreshPanel` | **rewrite cleanly** | fila estática + `segSync` |
| `js/editor-runtime.js` | gancho por fotograma | **obsolete** | la herramienta se actualiza desde `scTick`/`scRenderNow` |
| `js/deeplink.js` | `urlBringsDocument` con bandera | **prototype-only** | — |
| `js/model.js` | UNKNOWN en sets; `eventTypePrimitiveFor('unknown')` | **obsolete** para el MVP (D3) | tarea de UNKNOWN; en su lugar: `kind` y `observedFlow` en normalización/autoría/cascada |
| `js/scenario-engine.js` | UNKNOWN en `VALID_STATES` | **obsolete** para el MVP | tarea de UNKNOWN (con decisión de `SEND`) |
| `js/story-playback.js` | frase de UNKNOWN | **rewrite** (diferido) | tarea de UNKNOWN |
| `js/editor-scenarios.js` | opción «Pasa a estado desconocido» con bandera | **rewrite** (diferido) | tarea de UNKNOWN |
| `index.html` | `<script>` del prototipo; `#scConsequenceUnknown` | **rewrite cleanly** / diferido | `<script>` del módulo de ruta; markup de selector y herramienta |
| `css/styles.css` | `.scChoice[hidden]` | **cherry-pickable** (trivial) pero solo útil con UNKNOWN | diferido |
| `sw.js` | `CACHE` v88 → v89 + precache del prototipo | **obsolete** (colisión con `main`) | cada fase sube a la siguiente versión libre |
| ~48 `test/*.cjs` | constante de caché | **obsolete** | se actualizan en cada fase con la versión real |
| `test/fluyo-019-2-browser.cjs`, `test/fluyo-019-3.test.cjs` | versiones de caché | **obsolete** | |
| `test/fluyo-scenario-prototype-001.test.cjs` (T1–T12) | tests del prototipo | **rewrite cleanly** | casos reutilizados en la suite de producto |
| `test/fluyo-scenario-prototype-002.test.cjs` (U1–U10) | tests del prototipo | **rewrite cleanly** | ídem; los de UNKNOWN pasan a guardas de rechazo |
| `.ai/tasks/FLUYO-SCENARIO-PROTOTYPE-00{1,2}.md` | contratos del prototipo | **cherry-pickable** (solo docs, opcional; decide el PO) | evidencia |
| `.ai/qa/scenario-semantic-playback-002/*.png` | capturas | **prototype-only** | se quedan en la rama |

Conclusión: **no hay código de producto cherry-pickable**. Estrategia B (D11).

---

## 8. Riesgos

1. **Anotación incorrecta silenciosa**: una conexión mal tipada o un sentido invertido dan un estado de ruta seguro pero
   falso. Conocido y aceptado; mitigación solo estructural (§ V del registro) y procedencia. Nunca IA.
2. **Lectura de «salud»**: «Ruta disponible» puede leerse como monitorización. Mitigación: textos aprobados, nota de alcance,
   sin respiración del halo, sin vocabulario de incidentes (§ 0 del registro).
3. **Deriva y colisiones durante la integración**: trabajo ajeno sin commit en `main` toca `render.js` y `sw.js` (v89);
   el kernel cambia (`model.js`) y obliga a resincronizar el MCP; colisión de caché demostrada (B8).
4. **Contradicción temporal C1** (B9) visible al mezclar `SEND` y `SET_STATE` en una ruta observada.
5. **Coste por fotograma**: el prototipo ejecuta el motor y serializa la Historia cada fotograma en edición. Producto: memoizar
   por firma del documento.
6. **Ambigüedad de estilo**: Requisito discontinuo vs. `e.dashed` del usuario (REDESIGN de la marca).
7. **Inconsistencia de procedencia**: «Condiciones → Disponible» = DEFAULT (decisión del PO, D4).

---

## 9. Rollout por fases (ninguna implementada)

Regla común: cada fase es un commit coherente sobre `main`, sube `CACHE` a la siguiente versión libre en ese momento si toca
archivos servidos, no mezcla trabajo ajeno, y deja documentos antiguos byte a byte iguales.

### FASE 1 — Modelo de conexión semántica + autoría en el editor
- **Alcance**: `kind` en `normalizeProjectEdge`, `CONNECTION_SPEC_KEYS`, `CONNECTION_UPDATE_KEYS`, `updateConnectionIn`
  (D1); `edgeKind` puro; selector en Propiedades con `editEdge` + Undo (tras la bandera); marcas estáticas Flujo/Requisito en
  el lienzo (sin bandera, D10); infraestructura de bandera labs; resincronizar kernel del MCP (mecánico).
- **Pruebas**: modelo (ausente = Conexión, round-trip FLOWS_TO/REQUIRES, `null` quita, string desconocido se conserva,
  otro tipo se quita, corpus byte a byte); autoría (rechazos); editor en vm (selector, Undo/Redo, una entrada, valor actual no
  apila, conexión nueva = Conexión); copiar/pegar/duplicar/Share/`#d=` conservan; Chrome real (1440/390, teclado, hoja
  móvil, 216 px); mutaciones; alcance contra HEAD.
- **Rollback**: revertir el commit; los documentos con `kind` siguen abriendo en el editor anterior (passthrough).
- **Aceptación**: corpus idéntico; `kind` editable solo con bandera; marcas visibles; `check:kernel` del MCP verde tras resync.

### FASE 2 — Contrato de disponibilidad (MVP sin UNKNOWN persistido)
- **Alcance**: `availabilityOf` tri-estado en el módulo de ruta; guardas de rechazo de UNKNOWN en todas las entradas
  (archivo, `#d=`, Viewer, «Añadir como página», pegado entre pestañas: validar Behaviors en `cloneStructureIn` con la regla de
  carga); procedencia (D4) con horario visible; decisión del PO sobre «Condiciones → Disponible».
- **Pruebas**: UNKNOWN rechazado por superficie (B1); procedencia: Behavior, `SET_STATE` sin cambio, `≤ t` inclusivo,
  dependencias de llegada, no altera el estado.
- **Rollback**: revertir; sin dato persistido nuevo.
- **Aceptación**: ninguna superficie acepta ni pinta UNKNOWN como disponible.

### FASE 3 — Derivación de ruta + flujo observado
- **Alcance**: D-Ruta por alcanzabilidad (AVAILABLE/UNKNOWN/UNAVAILABLE/NO_PATH); `scenario.observedFlow` (normalización
  conservadora, `setObservedFlowIn`, cascada en `deleteNodeIn`, aviso en `FluyoIntegrity`/`removalImpact`); `resolveObservedFlow`;
  herramienta bajo el transporte con selectores, estado, procedencia (tras la bandera); Undo; kernel del MCP resincronizado.
- **Pruebas**: ver § 10 «Derivación» y «Editor»; documento serializado sin claves derivadas (B6); ENDPOINT_MISSING y
  recuperación (B5).
- **Rollback**: revertir; `observedFlow` queda como passthrough inofensivo.
- **Aceptación**: estado exacto con > 64 caminos; NO_PATH distinto de UNAVAILABLE; borrar un extremo = una entrada de Undo.

### FASE 4 — Timeline + pintado en el lienzo (editor)
- **Alcance**: timeline derivada (D6), evidencia (§ 3.1), halo/fundas/barrido/transición local/pastilla (§ Pintado), regla
  de Requisito estable, reducir movimiento, piel «construido».
- **Pruebas**: § 10 «Scenario»; píxeles en Chrome real (crema/claro/oscuro, plano/construido); Requisito idéntico en todo
  instante; barrido solo en frontera.
- **Rollback**: revertir; sin dato persistido.
- **Aceptación**: «cambió un nodo» vs «cambió la ruta» legible en el fixture de producto.

### FASE 5 — Paridad Viewer / Present / Share / MCP / exportación
- **Alcance**: Viewer V2 (D7), Present (D8), exportación de marcas estáticas (§ Export), MCP (D9: `kind` en specs, describe con
  `connectionKind` y `observedFlow`, operación de flujo observado, port de marcas en `svg.ts`, test de deriva de
  disponibilidad), `docs/index.html`.
- **Pruebas**: § 10 «Superficies»; goldens compartidos editor ↔ MCP; Viewer con SW anterior.
- **Rollback**: revertir por repo (fluyo / fluyo-mcp) de forma independiente; el formato no cambia.
- **Aceptación**: misma ruta y mismo estado en editor, Present y Viewer para el mismo instante; MCP sin pérdidas.

### FASE 6 — QA manual + regresión
- **Alcance**: QA del PO (incluye fixture mixto SEND + SET_STATE para B9), regresión completa, documentos no semánticos,
  decisión de retirar la bandera, cierre de B1–B9.
- **Rollback**: mantener la bandera.
- **Aceptación**: B1, B4, B6, B7 verificados; B3, B5, B8 cerrados; B9 juzgado por el PO.

---

## 10. Contrato de pruebas (debe existir antes del release)

**Modelo**: ausente = Conexión · round-trip `FLOWS_TO` · round-trip `REQUIRES` · `kind` inválido (string conservado y leído
como Conexión; otro tipo quitado; autoría lo rechaza) · UNKNOWN rechazado en Step/Behavior/EventType (MVP) · documentos
antiguos byte a byte (ejemplos + fixtures) · `observedFlow` round-trip, duplicar Historia, «Compartir historia» lo lleva,
«Sólo el diagrama» no.

**Derivación**: Conexión ignorada · Requisito ignorado · ruta alternativa (un worker cae, ruta disponible) · todo caído
(UNAVAILABLE) · UNKNOWN + caído · UNKNOWN + disponible (estados sintéticos) · NO_PATH ≠ UNAVAILABLE · ciclos · > 64 caminos
(exactitud) · puntas/`flowDir` no cambian la semántica · procedencia no altera el estado · horario visible con dependencias
de llegada · determinismo (misma entrada → misma salida).

**Editor**: selector (ratón, teclado, hoja móvil, 216 px) · Undo/Redo de cada transición de tipo · UNKNOWN no ofrecido (MVP)
· selección de flujo observado (Undo, «Automática») · resolución estructural única / ambigua · borrado de extremo (cascada,
una entrada) · ENDPOINT_MISSING desde un documento externo · bandera apagada = editor de siempre.

**Scenario**: cambio de estado sin cambio de ruta (punto, sin barrido) · cambio de ruta (barra, barrido) · ruido (nodo fuera
de la ruta: nada) · vuelta del extremo · timeline completa (inicio, fin, número de cambios) · pausa/saltos mueven el cursor ·
Requisito estable en todo instante.

**Superficies**: Present (overlays, línea de estado, sin selectores) · Viewer (V2, sin bandera, SW anterior) · Share (`kind` y
`observedFlow` viajan) · MCP (goldens: `kind`, `observedFlow`, describe, export) · importar/exportar (SVG/PNG/JPG/GIF con
marcas estáticas, sin overlays; sin `kind` = salida de hoy) · regresión de documentos no semánticos (lienzo, SVG, raster,
Historia, Present, Viewer idénticos a HEAD) · alcance estático (sin restos del prototipo, B7) · service worker (upgrade de la
versión anterior a la nueva).

---

## 11. Bloqueantes

Ver D12 del registro (B1–B9 con clase y estado).

## Criterios de aceptación (FASE 0)

- [x] Estado de repos auditado sin modificar trabajo ajeno.
- [x] Diffs del prototipo estudiados y clasificados.
- [x] Contratos: `edge.kind`, disponibilidad, UNKNOWN, procedencia, flujo observado, ruta, timeline, Requisito, tiempos,
      Viewer, Present, Share, MCP, export, Undo, bandera, integración, bloqueantes.
- [x] Matrices de superficies, compatibilidad y migración.
- [x] Fases con pruebas, rollback y aceptación.
- [x] Solo documentación nueva: `.ai/architecture/SCENARIO-SEMANTICS-001.md` y esta tarea.

## Archivos modificados (FASE 0)

- `.ai/architecture/SCENARIO-SEMANTICS-001.md` — nuevo: registro de decisiones PROPUESTAS.
- `.ai/tasks/FLUYO-SCENARIOS-SEMANTICS-001.md` — nuevo: esta tarea.
- Ningún `.js`, `.css`, `.html`, test ni `sw.js`. Sin commit (AGENTS.md §6: sin commits salvo petición).

## Pruebas (FASE 0)

No aplica ejecución: FASE 0 no cambia código. Verificación: `git status` / `git diff` del worktree de `main` muestran solo los
dos archivos nuevos además del trabajo ajeno preexistente.

## FASE 1 — Modelo de conexión semántica + autoría en el editor (línea histórica `4fb5872`)

Rama `feat/scenario-semantics` (worktree `C:\Proyectos\fluyo-new\fluyo-scenario-semantics`) desde `main` `d31703e` (FLOW-FADE ya
commiteado durante FASE 0). En fluyo-mcp: rama `feat/scenario-semantics` (worktree `fluyo-mcp-scenario-semantics`) desde `81154f1`.
Commits (pedidos por el PO; sin push, sin merge): fluyo `4fb5872`, fluyo-mcp `63d97b8`.

### Hecho
- **Kernel** (`js/model.js`): `edge.kind` en `normalizeProjectEdge` (ausente no se rellena; `null`/no-texto se quitan; texto
  desconocido se conserva), `EDGE_KINDS`, `EDGE_KIND_GENERIC`, `edgeKind`, `authoringKind`; `kind` en `CONNECTION_SPEC_KEYS` y
  `CONNECTION_UPDATE_KEYS`; `createConnectionIn` lo valida. Decisión 214.
- **Bandera labs** (`js/ui.js`, `LABS_SEMANTICS`): `?labs=escenarios` / `?labs=off`, recordada en `localStorage`. Decisión 215.
- **Selector** «Semántica: Conexión · Flujo · Requisito» (`index.html` `#rowKind`/`#kindSeg`, primera fila de «Trazo»; `js/ui.js`
  `segBind("kindSeg")` → `pushUndo` + `editEdge`), solo con la bandera y en conexiones; `css/styles.css`: palabras enteras en la
  columna estrecha. Decisión 215.
- **Marcas estáticas** (`js/geometry.js` `edgeSemanticMarks`; `js/render.js` `drawEdgeSemanticMarks` dentro de `drawEdge`): Flujo =
  cuñas centradas en el tramo visible más largo, Requisito = anillo cerca del origen, sin discontinuo; sin bandera; no al
  exportar (FASE 5). Decisión 216.
- **Release**: `sw.js` `CACHE` v90 (v89 la usa FLOW-FADE); 47 tests actualizan la constante; `test/fluyo-019-2-browser.cjs` mide el
  upgrade desde `d31703e` (v89). Los tests de alcance de 019.5 y FLOW-FADE contra revisiones fijas pasan a medir su propio commit
  (decisión 217).
- **MCP**: `npm run sync:kernel` con `FLUYO_PATH` = este worktree → `src/generated/kernel-sources.ts` (`KERNEL_ID`
  `fb4ff8f4…54fe8`). Ningún schema cambia. Resincronizado desde el commit `4fb5872` y commiteado en `63d97b8`.

### Archivos modificados (FASE 1)
`js/model.js`, `js/geometry.js`, `js/render.js`, `js/ui.js`, `index.html`, `css/styles.css`, `sw.js`; tests: nuevos
`test/fluyo-scenarios-semantics-1.test.cjs` y `test/fluyo-scenarios-semantics-1-mutations.cjs`; 47 `test/*.cjs` (constante de
caché), `test/fluyo-019-2-browser.cjs`, `test/fluyo-019-5.test.cjs`, `test/fluyo-019-flow-fade.test.cjs`; docs: `.ai/DECISIONS.md`
(213–217), `.ai/ARCHITECTURE.md`, `.ai/architecture/SCENARIO-SEMANTICS-001.md` (ACEPTADO), esta tarea. fluyo-mcp:
`src/generated/kernel-sources.ts`.

### Pruebas (FASE 1)
- `node --test test/fluyo-scenarios-semantics-1.test.cjs`: 19/19. Mutaciones: 20/20 detectadas.
- Suite `node --test test/*.test.cjs`. Línea base (`d31703e`): 1273 tests, 81 fallos preexistentes (arneses antiguos sin
  `FluyoStoryClock` y comparaciones de alcance obsoletas). Con FASE 1 en el árbol, sin commit: 1292 tests, 94 fallos = los 81 +
  13 tests de alcance «idéntico a HEAD» que vigilan el cambio sin commit. Con FASE 1 commiteada (commit desechable en un
  worktree temporal, ya borrado): 1292 tests, 80 fallos, ninguno nuevo. **Corrección (cierre, V4)**: desde el commit real
  `4fb5872`, en su worktree (con `fluyo-mcp` al lado): 1292 tests, **81 fallos = exactamente los 81 de la línea base, 0
  nuevos**. El «80» venía del worktree temporal, sin `fluyo-mcp` al lado, donde 2 tests de fixtures del MCP se saltan.
- fluyo-mcp `npm test` con el kernel resincronizado: 748/748; `check:kernel` OK.
- Navegador real (panel del editor, Chromium, `127.0.0.1:8790`): 1440×900 (selector en una fila, clic → Flujo, Ctrl+Z/Ctrl+Y,
  flechas del radiogroup → Requisito, autoguardado con `kind`), 1024 (columna de 216 px: antes «Conexió/n», corregido: dos filas
  de palabras enteras), 375×812 (hoja móvil, objetivos de 44 px), `?labs=off` (sin fila, marcas visibles, tema crema), Present
  (marcas) y Share → Viewer (marcas, `kind` transportado). Defecto encontrado y corregido: las cuñas caían en un trozo de pasillo
  de la ruta ortogonal.
- **No verificado**: los `*-browser.cjs` (Playwright no está instalado en este entorno) y el upgrade del service worker v89 → v90
  (el navegador integrado dejó de registrar service workers en cualquier origen, también con `main` intacto, tras limpiar cachés
  durante la prueba: entorno, no este cambio).

### Pendiente / riesgos (FASE 1)
- En la hoja móvil «Trazo» empieza plegado (018.23): el selector está a un toque más, como el resto de controles. Sin cambio.
- Las marcas no salen en la exportación hasta FASE 5 (SVG + `export_diagram` a la vez).
- Commits hechos: fluyo `4fb5872`, fluyo-mcp `63d97b8`.

### Cierre de FASE 1 (criterios del PO V1–V4) — PASS

Chrome real **155.0.8059.80** (headless, perfil temporal limpio, CDP; los guiones viven fuera del repo).
- Árboles exportados con `git archive`: `d31703e` (v89) y `4fb5872` (v90).
- Servidor estático propio en `127.0.0.1` (`Cache-Control: no-cache`).
- Las marcas se cuentan envolviendo `drawEdgeSemanticMarks` y `render` (solo inspección) y se normalizan por fotograma.
- Las capturas están en el scratchpad de la sesión, no en el repo.

- **V1 — Editor → Present → Share → Viewer: PASS (19/19).**
  - Documento con Conexión, 2 FLOWS_TO y 1 REQUIRES, cargado por `#d=` con `?labs=escenarios`.
  - Editor:
    - aparece «Semántica»;
    - clics reales en «Flujo» y «Requisito», con 1 entrada de Undo cada uno;
    - Ctrl+Z, Ctrl+Z y Ctrl+Y reales; el selector refleja el valor;
    - el lienzo pinta por fotograma 2 Flujos (2 cuñas) + 1 Requisito (anillo), 3 Flujos al marcar la Conexión, y vuelve al
      estado inicial al deshacer.
  - Present (botón real): las mismas marcas y el selector no visible.
  - Share («sólo el diagrama», `createShareUrl`) → Viewer: fase `ready`, `kind` intacto en las 5 conexiones, mismas marcas.
  - Consola sin errores en editor, Present y Viewer.
- **V2 — service worker v89 → v90: PASS (11/11), mismo origen.**
  - `d31703e`: SW activado con `fluyo-static-v89` (60 entradas); la app es la anterior.
  - El servidor pasa a `4fb5872` y una navegación normal instala y activa el SW nuevo (skipWaiting + claim). Solo queda
    `fluyo-static-v90`, con 60 entradas y sin archivos nuevos.
  - La caché sirve `ui.js` y `geometry.js` nuevos, y al recargar la UI nueva (bandera, marcas, selector) está disponible.
  - Estable 3 s, sin `installing`/`waiting`; `sw.js` se pidió 3 veces, una por navegación, sin bucle.
  - Sin red, la app de FASE 1 sale de la caché v90. Sin errores de actualización de caché.
  - La limitación anterior era del navegador integrado, no del producto.
- **V3 — labs OFF: PASS (8/8).**
  - `?labs=off` apaga y borra la preferencia; sin parámetro sigue apagada.
  - Editor: selector oculto con una conexión seleccionada, y el documento sigue pintando Flujo y Requisito.
  - Present: muestra las marcas.
  - Viewer: muestra las marcas y no carga la bandera.
- **V4 — sin regresión fuera de Scenarios: PASS.**
  - Suite desde el commit real: 1292 tests y 81 fallos, el mismo conjunto exacto que la línea base (0 nuevos).
  - En Chrome, los 8 ejemplos (sin `kind`) son **idénticos byte a byte** en `d31703e` y en `4fb5872`:
    - el lienzo del editor en un instante fijo: sin selección, con nodo y conexión seleccionados, y «construido»;
    - el SVG exportado, plano y «construido»;
    - el lienzo del Viewer;
    - el documento tras duplicar, copiar/pegar, editar una conexión y Undo/Redo/Undo.
  - Selección, hit testing y carga/guardado: sus archivos no cambian (`selection.js`, `interaction.js`, `state.js`) y sus
    suites no tienen fallos nuevos.

**FASE 1 (`4fb5872`): IMPLEMENTED / VERIFIED sobre `d31703e`. Queda como referencia histórica; el candidato de producto es la
reconstrucción sobre `main` actual (abajo).**

## FASE 1 — Reconstrucción sobre `main` actual (candidato de producto)

Rama `feat/scenario-semantics-rebased` (worktree `C:\Proyectos\fluyo-new\fluyo-scenario-rebased`) desde `main` **`ce8e699`**
(= `origin/main`). La línea `feat/scenario-semantics` se conserva intacta para comparar: `4fb5872` (FASE 1), `e47500f`
(documentación) y `94e50fa` (FASE 2) son **referencias históricas**; su lógica no cambia aquí. Lo que cambió es la base.

### Por qué (segunda revisión del PO: APPROVE WITH CHANGES, C1–C3)
Detalle en `.ai/architecture/SCENARIO-SEMANTICS-001.md` § PO.
- **C1 — base divergente** (CACHE · DOCS · TEST): `main` avanzó con FLUYO-019-HIT-TEST (`ce8e699`), que usa la misma
  `CACHE` v90 que `4fb5872` y las decisiones 209–211. Un merge daría la v90 a un contenido distinto del v90 de `main` (un
  cliente instalado no actualizaría nunca) y conflictos en `.ai/ARCHITECTURE.md`, `.ai/DECISIONS.md`,
  `test/fluyo-019-2-browser.cjs`, `test/fluyo-019-5.test.cjs` y `test/fluyo-019-flow-fade.test.cjs`.
- **C2 — kernel del MCP** (MCP): `63d97b8` sincroniza con `4fb5872`; se resincroniza desde el commit nuevo.
- **C3 — W5 en FASE 1** (EDITOR · TEST): las cuñas de Flujo ya se pintan de origen a destino y pueden contradecir la punta
  visible; el aviso aprobado (decisión 220) entra con la autoría.

### Estrategia
- Ni cherry-pick ni rebase. Los hunks de código de `4fb5872` (`js/model.js`, `js/geometry.js`, `js/render.js`, `js/ui.js`,
  `index.html`, `css/styles.css`) se reaplican tal cual porque `ce8e699` no toca esas regiones (solo `isContainerNode` en
  `geometry.js`, en otro sitio): `git apply --check` limpio y revisado hunk a hunk.
- **CACHE v92**. La v91 sería la siguiente sobre `main` commiteado, pero el trabajo **sin commitear** de
  FLUYO-019-HIT-TEST-D6 en el checkout de `main` ya la usa (y reserva la decisión 212). Tomarla repetiría la colisión.
  Quien se integre segundo vuelve a subir `CACHE` en su momento (B8).
- **Decisiones 213–221** (antigua N → N + 4; ver la decisión 213). Las referencias de este archivo y del registro ya usan
  la numeración nueva. `main` 209–211 no se tocan.
- **Tests adaptados a la base** (no a los resultados): el contrato de FASE 1 mide contra `ce8e699` (corpus, `drawEdge`,
  alcance, `CACHE` v92 = v90 + 2). La constante de caché de 48 tests pasa a v92. Los tests de alcance de 019.5, FLOW-FADE y
  FLUYO-019-HIT-TEST miden en su propio commit (`266ac09`, `d31703e`, `ce8e699`; decisión 217) y el smoke del service worker
  de 019.2 instala `ce8e699` (v90) para medir el upgrade a v92. El contrato de 018.27 (`syncArrowSeg` termina en
  `syncArrowSizeSeg`) se respeta: `syncKindNote` va antes.

### Hecho (además de lo reaplicado de `4fb5872`)
- **W5**: `#kindNote` (`index.html`, justo después del selector, oculto por defecto); `flowArrowReversed(e)` y
  `syncKindNote(e)` (`js/ui.js`), llamado desde `refreshPanel` y `syncArrowSeg`. Solo con la bandera; solo Flujo con punta de
  inicio y sin punta final; solo lee.

### Archivos modificados
`js/model.js`, `js/geometry.js`, `js/render.js`, `js/ui.js`, `index.html`, `css/styles.css`, `sw.js` (v92); tests nuevos
`test/fluyo-scenarios-semantics-1.test.cjs` y `test/fluyo-scenarios-semantics-1-mutations.cjs`; 48 `test/*.cjs` (constante de
caché), `test/fluyo-019-2-browser.cjs`, `test/fluyo-019-5.test.cjs`, `test/fluyo-019-flow-fade.test.cjs`,
`test/fluyo-019-hit-test.test.cjs`; docs `.ai/DECISIONS.md` (213–221), `.ai/ARCHITECTURE.md`,
`.ai/architecture/SCENARIO-SEMANTICS-001.md`, esta tarea.

### Pruebas
- `node --test test/fluyo-scenarios-semantics-1.test.cjs`: **21/21** (19 de `4fb5872` contra la base nueva + 2 de W5).
- Mutaciones `test/fluyo-scenarios-semantics-1-mutations.cjs`: **26/26** detectadas (20 + 6 de W5: sin bandera, Requisito,
  dos puntas, sin resincronizar al cambiar las puntas, invertir origen/destino, fuera de «Trazo»).
- Suite `node --test test/*.test.cjs`:
  - **Línea base `main` `ce8e699`**: 1302 tests, 81 fallos (preexistentes).
  - **FASE 1 commiteada** (commit desechable con el mismo árbol, en un worktree hermano con `fluyo-mcp` al lado): 1323 tests,
    81 fallos = **exactamente el mismo conjunto, 0 nuevos**. Sin commitear, 13 tests de alcance «idéntico a HEAD» fallan
    como es debido (vigilan el cambio en curso).
- Mutaciones de los tests adaptados (parte unitaria, `SKIP_BROWSER=1`): 019.5 **12/12**, FLOW-FADE **11/11**, HIT-TEST
  **11/11**. Medir el alcance en el commit dejaba sin detectar dos guardas de comportamiento, y se corrigió: «CACHE no sube»
  (FLOW-FADE y HIT-TEST vuelven a mirar también la `CACHE` del árbol, como 019.5) y U8 de FLOW-FADE (`drawEdge` se compara en
  el árbol descontando solo el bloque de marcas de esta tarea). Las partes B (Chrome vía Playwright) no se ejecutaron.

### QA en navegador (Chrome real 155.0.8059.80, headless, perfil limpio, CDP; guiones fuera del repo)
Servidor estático propio en `127.0.0.1` (`Cache-Control: no-cache`), árboles exportados de `ce8e699` y de esta rama. Las
marcas se cuentan envolviendo `drawEdgeSemanticMarks` por fotograma (solo inspección).
- **V1 — Editor → Present → Share → Viewer: PASS.** Documento con 2 Conexiones, 2 Flujos y 1 Requisito por `#d=` con
  `?labs=escenarios`; clic real sobre la conexión en el lienzo; clics reales en «Flujo»/«Requisito» (1 entrada de Undo cada
  uno; elegir el actual no apila); Ctrl+Z, Ctrl+Z, Ctrl+Y reales; flecha del radiogroup; marcas por fotograma (2+1 → 3+1 →
  2+2 → 3+1); autoguardado con `kind`. Present (botón real): mismas marcas, sin selector. Share → Viewer: `ready`, `kind`
  intacto en las 5 conexiones, mismas marcas, sin bandera. Consola sin errores.
- **W5 (C3): PASS.** Punta de inicio en un Flujo → aviso con los textos del PO; origen/destino intactos; sin aviso en
  Requisito, con dos puntas, con punta final o con un nodo seleccionado.
- **Acierto en contenedor (base nueva): PASS.** Un clic sobre una conexión entre dos hijos de una caja selecciona la conexión
  (decisión 209) y el selector la marca como Flujo.
- **Responsive: PASS.** 1024 px: columna de 182 px, «Conexión · Flujo · Requisito» en palabras enteras. 375 × 812 táctil
  (`pointer: coarse`): fila visible con «Trazo» abierto, objetivos de 44 px como el resto de segmentados.
- **V2 — service worker v90 (`ce8e699`) → v92, mismo origen: PASS (9/9).** v90 activada (60 entradas) → navegación normal →
  v92 instalada y activada (skipWaiting + claim), v90 borrada, mismas 60 entradas, la caché sirve `ui.js`, `geometry.js` e
  `index.html` nuevos; estable 3 s; `sw.js` una vez por navegación; sin red, la app de FASE 1 sale de la v92.
- **V3 — labs OFF: PASS.** `?labs=off` apaga y borra; sin parámetro sigue apagada; selector y aviso ocultos (también con un
  Flujo al revés); el documento sigue pintando Flujo y Requisito en editor, Present y Viewer.
- **V4 — sin regresión: PASS (8/8).** Los 8 ejemplos dan hashes idénticos en `ce8e699` y en la rama: lienzo del editor en un
  instante fijo (sin selección, con nodo, con conexión), SVG plano y «construido», lienzo del Viewer y el documento tras
  duplicar, copiar/pegar, editar una conexión y Undo/Redo/Undo. La medida no es vacía (selección e instante cambian el hash).
- **No ejecutado**: los `*-browser.cjs` del repo (Playwright no está instalado aquí; no se descarga nada). El guion propio
  cubre V1–V4.

### MCP (C2)
- **C2 — MCP: resuelto.** Rama `feat/scenario-semantics-rebased` de fluyo-mcp (worktree `fluyo-mcp-scenario-rebased`) desde
  `main` `81154f1`; commit `efb316f`: `npm run sync:kernel` con `FLUYO_PATH` = `59588a9`. `KERNEL_ID` `fb4ff8f4…54fe8`, el
  mismo que `63d97b8`, porque `model.js` es idéntico; solo cambia la revisión de origen. Línea base 748/748 (`81154f1` con
  fluyo `ce8e699`), y después 748/748 con `check:kernel` OK. `63d97b8` queda como referencia histórica.

### Pendiente / riesgos
- FLUYO-019-HIT-TEST-D6 (sin commitear en `main`) toca `geometry.js`, `render.js`, `export.js`, `sw.js` (v91) y
  `DECISIONS.md` (212). Quien se integre segundo resuelve CACHE y numeración, y repite V2 y V4.
- Las marcas siguen fuera de la exportación hasta FASE 5 (SVG + `export_diagram` a la vez).


## FASE 2 — FROZEN SEMANTIC CONTRACT (congelado antes del código)

Partición. El PO redefine FASE 2 como el **núcleo de derivación**. Del antiguo FASE 2 (§ 9) solo entra el rechazo de
UNKNOWN en la frontera de la derivación. `observedFlow` y la herramienta pasan a FASE 3; el pintado y la timeline, a FASE 4.

### Alcance

Entra: funciones puras de derivación.
- Alcanzabilidad exacta por `FLOWS_TO`.
- Estados AVAILABLE / UNAVAILABLE / NO_PATH.
- Procedencia DEFAULT / EXPLICIT.
- Seguridad ante ciclos.
- Conexión y Requisito se ignoran; UNKNOWN queda reservado y se rechaza.

**Fuera de FASE 2**:
- pintado y timeline;
- `observedFlow` y el panel de Historias;
- la UI de Viewer y Present;
- la autoría de UNKNOWN;
- `sw.js` y CACHE;
- `render.js`, `ui.js` e `index.html`;
- operaciones MCP nuevas (`get_flow_status`, `observe_flow`…).

### Ubicación

- **`js/flow-semantics.js`**, archivo nuevo: script clásico, puro, global `FluyoFlow`.
- Solo depende de `edgeKind` (`model.js`), el único lector de `kind` (decisión 214).
- **En FASE 2 no lo carga la app**: no está en `index.html`, en `s/index.html` ni en el precache, así que `sw.js` y CACHE
  no cambian.
  - Precedente: en 018.6, `story-authoring.js` estaba en `js/` sin que el editor lo cargara y sin subir CACHE.
- No entra en los `KERNEL_FILES` del MCP, así que no hace falta sincronizar el MCP.
- FASE 3 lo cablea en el editor (`<script>`, precache y CACHE).
- Si el MCP llega a exponer el estado, se decidirá entonces si entra al kernel.

### Entradas

- `page`: página normalizada (`nodes`, `edges`, `behaviors`).
- `states`: `{nodeId: "UP"|"DOWN"}`, en el vocabulario del motor (`UP` = AVAILABLE, `DOWN` = UNAVAILABLE).
  - Debe cubrir todos los nodos de la página; sale de `availabilityAt`.
- `t`: instante en ms, en el mismo reloj que los eventos y Steps que se pasan.
  - FASE 3 pasará el Trace visible (`FluyoStoryClock`) y `visibleAt`.

### API
| Función | Devuelve |
|---|---|
| `FluyoFlow.availabilityAt(page, events, t)` | `{nodeId: "UP"|"DOWN"}`: todo `UP`, después los Behaviors y después los `state_changed` del Trace con `at ≤ t`, en orden (la misma regla que el motor y el Playback) |
| `FluyoFlow.flowStatus(page, source, target, states)` | `"AVAILABLE"` · `"UNAVAILABLE"` · `"NO_PATH"` |
| `FluyoFlow.availabilityProvenance(page, steps, t, timeOf?)` | `{nodeId: "EXPLICIT"|"DEFAULT"}`; `timeOf(step)`, por defecto `step.at` |
| `FluyoFlow.flowAvailability(page, source, target, states, provenance)` | `{status, explicitPath}` (ver debajo) |

`explicitPath` de `flowAvailability`:
- `true` si existe un camino AVAILABLE con todos sus nodos EXPLICIT; `false` si no.
- `null` cuando el estado no es AVAILABLE.
- Es el dato para «incluye estados por defecto», no un cuarto estado.

Ninguna función enumera caminos ni los devuelve. No hay `BehaviorEngine`, `FlowModel` ni nada parecido.

### Semántica

G es el subgrafo dirigido de las conexiones con `edgeKind(e) === "FLOWS_TO"`, en sentido `from → to`.

| Estado | Regla |
|---|---|
| NO_PATH | no existe camino en G de `source` a `target`. Solo depende de la estructura. Texto de producto: «Sin ruta de flujo». No es UNAVAILABLE |
| AVAILABLE | existe un camino en G cuyos nodos están todos `UP` en `t`: origen, intermedios y destino |
| UNKNOWN | **reservado**: ningún camino AVAILABLE y algún camino sin `DOWN` que contiene UNKNOWN. Hoy es inalcanzable, porque UNKNOWN se rechaza en la entrada |
| UNAVAILABLE | existe camino en G, pero todos contienen al menos un nodo `DOWN` |

- **Precedencia**:
  1. sin camino → NO_PATH;
  2. si hay un camino disponible → AVAILABLE (domina a UNKNOWN);
  3. [UNKNOWN, reservado];
  4. si no → UNAVAILABLE.
- **Camino** = camino dirigido simple. Alcanzable equivale a que exista un camino simple, así que no hace falta enumerar.
- **`source == target`**: camino trivial de longitud 0 con ese único nodo.
  - Nodo `UP` → AVAILABLE; nodo `DOWN` → UNAVAILABLE; nunca NO_PATH.
  - Sin conflicto con la arquitectura: no es una conexión. El dominio prohíbe auto-lazos de conexión, no esto.
- **Por defecto**: un nodo sin afirmación es `UP` (`buildInitialStates`) y la derivación lo trata como AVAILABLE. La
  procedencia es aparte y no altera el estado.
- **Aislamiento**: Conexión (también con un `kind` desconocido, decisión 214) y Requisito no existen para la derivación,
  aunque unan los mismos nodos. Las puntas visibles y `flowDir` no cuentan (W5).

### Algoritmo (exacto, sin enumerar)

1. Construir la adyacencia de G.
2. **R_struct**: BFS desde `source` por G, con un conjunto de visitados. Si `target ∉ R_struct` → NO_PATH.
3. **R_avail**: el mismo BFS, restringido a nodos `UP` (vacío si `source` no es `UP`). Si `target ∈ R_avail` → AVAILABLE;
   si no → UNAVAILABLE.
   - Hueco para el futuro UNKNOWN: **R_unk**, restringido a `UP ∪ UNKNOWN`, entre el paso 3 y UNAVAILABLE. Sin implementar.
4. `explicitPath`: el mismo BFS, restringido a nodos que son `UP` **y** EXPLICIT.

- Coste: O(V+E) por consulta, sin tope.
- Los visitados garantizan que termina aunque haya ciclos.
- El resultado son booleanos de pertenencia: no depende del orden de nodos, conexiones, claves ni conjuntos.

### Procedencia (auditoría de la regla temporal actual)

- Reglas del motor (no se inventa otra):
  - un Behavior es dato de la página (Condiciones) y rige desde el inicio de todas sus Historias;
  - los `SET_STATE` se aplican en orden `(at, posición)`;
  - la última afirmación aplicable gana el valor.
- **EXPLICIT** en `t` cuando existe al menos una de estas afirmaciones:
  - un Behavior del nodo (cualquier valor válido);
  - un `SET_STATE` sobre el nodo con `timeOf(step) ≤ t`, cambie o no el valor.
- Toda afirmación es del usuario. Por eso «la última gana» decide el **valor** (motor) pero no la procedencia: tras la
  primera afirmación aplicable, el nodo es EXPLICIT y no vuelve a DEFAULT.
- **DEFAULT**: no hay ninguna afirmación aplicable y el estado es el por defecto de Fluyo.

**Condiciones (decisión del PO)**: una afirmación hecha en Condiciones cuenta como EXPLICIT.
- «No disponible» se guarda como Behavior `DOWN`, así que ya es EXPLICIT.
- **Conflicto con los datos de hoy** (documentado; no bloquea el núcleo):
  - «Disponible» en Condiciones **no deja rastro**, porque `setInitialAvailability` quita el Behavior. No se distingue de
    «nunca afirmado».
  - El núcleo aplica la regla a toda afirmación persistida, y un Behavior `UP` ya cuenta como EXPLICIT.
  - Para que la elección de Condiciones sea EXPLICIT, Condiciones tiene que **guardar** `{initialState:"UP"}`.
  - Ese cambio toca `model.js` (kernel, servido, así que sube CACHE) y `set_initial_availability` del MCP, y FASE 2 no puede
    hacerlo. Se propone para FASE 3, que ya sube CACHE.
  - El formato y el motor ya aceptan Behaviors `UP`.

### Entradas inválidas

No se adivina. El error es estructurado, `{code, field}`, como `projectDataError`.

| Caso | Código |
|---|---|
| `page` sin `nodes`/`edges` arrays | `invalid_document` (`page`) |
| `source`/`target` que no son nodos de la página | `node_not_found` (`source` / `target`) |
| estado ausente para un nodo, `UNKNOWN` o cualquier valor que no sea `UP`/`DOWN` (en `states`, Behaviors, `SET_STATE` o eventos) | `invalid_availability` (`field` = id del nodo). **Nunca** se coacciona a AVAILABLE, UNAVAILABLE ni DEFAULT |
| conexión `FLOWS_TO` con un extremo que no existe | `missing_edge_endpoint` (el código del motor) |
| `kind` que no es texto (documento sin normalizar) | `invalid_document` (`kind`). Un texto desconocido es Conexión (214), no un error |
| `t` no finito | `invalid_document` (`t`) |

### Oráculo (tests escritos en rojo antes del código)

- **Estructura**:
  - M1: un camino.
  - M2: un camino alternativo sobrevive.
  - M3: todos los caminos cerrados.
  - M4: prefijo compartido.
  - M5: bloqueador compartido.
  - M6: más de 64 caminos distintos; el único disponible está fuera de los 64 primeros en orden DFS del documento.
  - C1: ciclo con salida.
  - C2: ciclo sin salida → NO_PATH.
  - C3: ciclo con un nodo `DOWN` y una ruta externa disponible.
  - S1 Conexión, S2 Requisito, S3 la misma adyacencia con distintos `kind`.
  - `source == target`.
- **Estado**: origen caído, destino caído, intermedio caído, disponible por defecto.
- **Procedencia**:
  - sin afirmación → DEFAULT;
  - Behavior → EXPLICIT;
  - `SET_STATE` que cambia el valor → EXPLICIT;
  - `SET_STATE` del mismo valor → EXPLICIT;
  - Condiciones «No disponible» → EXPLICIT;
  - Condiciones «Disponible» persistida (Behavior `UP`) → EXPLICIT;
  - la última afirmación gana el valor;
  - `explicitPath`;
  - la procedencia no cambia el estado.
- **Seguridad**:
  - UNKNOWN rechazado en las cuatro entradas;
  - valor mal formado rechazado;
  - extremos ausentes;
  - determinismo con datos reordenados.
- **Propiedad**: grafos aleatorios con semilla fija frente a un oráculo de fuerza bruta (caminos simples, que solo existe en
  el test).
- **Equivalencia**: `availabilityAt` sobre el Trace de `FluyoStory.run` da el mismo estado que el Playback en cada instante.
- **Mutaciones** (todas deben morir):
  - incluir la Conexión;
  - incluir el Requisito;
  - ignorar el estado del origen;
  - ignorar el estado del destino;
  - quedarse solo con el primer camino;
  - tope de 64 caminos;
  - sin control de ciclos;
  - tratar el defecto como no disponible;
  - no contar como EXPLICIT el mismo valor;
  - coaccionar UNKNOWN.

### FASE 2 — Resultados de la implementación histórica (`94e50fa`, sobre `4fb5872`)

- **Orden**:
  1. El contrato se commiteó solo, en `e47500f`.
  2. Los tests se escribieron en rojo: sin el módulo falla la carga, y con un esqueleto «no implementado» fallan 32 de 33
     (pasa el de alcance).
  3. Después se escribió `js/flow-semantics.js`.
- **Archivos**:
  - `js/flow-semantics.js` (nuevo; la app no lo carga);
  - `test/fluyo-scenarios-semantics-2.test.cjs` y `test/fluyo-scenarios-semantics-2-mutations.cjs` (nuevos);
  - `test/fluyo-scenarios-semantics-1.test.cjs`: el alcance de FASE 1 se mide en su commit `4fb5872` (decisión 217);
  - docs: decisiones 222–224 (entonces 218–220), `.ai/ARCHITECTURE.md` y esta tarea.
- **No cambian**: `render.js`, `ui.js`, `index.html`, `s/index.html`, `sw.js`/CACHE, `model.js` ni el resto del kernel. Por
  tanto no hay UI, pintado, timeline ni `observedFlow`.
  - MCP: ningún archivo del kernel cambia, así que no hay sync (`check:kernel` sigue igual).
- **Tests**: `fluyo-scenarios-semantics-2.test.cjs` 33/33.
  - Grafos aleatorios: 600 con semilla fija, con ciclos, Conexión y Requisito, frente al oráculo de caminos simples. Se dan
    los tres estados.
  - M6 (testigo de más de 64 caminos):
    - 7 rombos dan 128 caminos simples; el único disponible es el 128.º en orden DFS del documento → AVAILABLE;
    - cerrando también ese camino → UNAVAILABLE;
    - 16 rombos (65 536 caminos) → AVAILABLE en menos de 500 ms.
- **Mutaciones**: 18/18 detectadas.
  - Las 10 que exige el PO: incluir la Conexión, incluir el Requisito, ignorar el origen, ignorar el destino, solo el primer
    camino, tope de 64, sin control de ciclos, defecto como no disponible, el mismo valor no EXPLICIT y UNKNOWN coaccionado.
  - Además: NO_PATH confundido con UNAVAILABLE, `source == target` como NO_PATH, dirección ignorada, `explicitPath` sin
    procedencia, Behavior no EXPLICIT, `t` exclusivo, estado ausente adivinado y conexión FLOWS_TO colgante ignorada.
- **Precisiones al contrato** (sin cambiar la semántica):
  - `flowAvailability` valida también el mapa de procedencia: `invalid_provenance` si falta un nodo o el valor no es
    `EXPLICIT`/`DEFAULT`; `invalid_document` (`provenance`) si no es un objeto.
  - `missing_edge_endpoint` lleva `field: "edges"`.
  - Un Behavior o evento sobre un nodo inexistente da `node_not_found` (`behaviors` / `events` / `steps`).
- **Corrección de un test** (no del contrato): la comprobación «cerrar también el último camino» de M6 tumbaba el nodo `a`
  del último rombo, que ya estaba caído. Se corrigió a `b`. El contrato no cambió.
- **Limitación conocida** (decisión 224): «Condiciones → Disponible» todavía no deja rastro, así que hoy deriva como
  DEFAULT. La regla ya está implementada para el Behavior `UP` persistido; falta que Condiciones lo guarde (FASE 3).

### FASE 2 — Reaplicación sobre la FASE 1 reconstruida (candidato de producto)

Sobre `59588a9` (FASE 1 reconstruida). Se conserva la **semántica** de `94e50fa`, no su historia: commit nuevo, sin
cherry-pick. La matemática no se rediseña: `main` `ce8e699` no cambió nada de lo que el módulo usa (`edgeKind` es idéntico, el
kernel no cambió y el Trace del motor tampoco).

**Auditoría de `94e50fa` (por archivo / hunk conceptual)**

| Clase | Qué |
|---|---|
| UNCHANGED | `js/flow-semantics.js`: toda la lógica (G = FLOWS_TO, BFS con visitados, NO_PATH / AVAILABLE / UNAVAILABLE, `source == target`, UNKNOWN rechazado, procedencia, errores). `test/fluyo-scenarios-semantics-2-mutations.cjs` (18 mutaciones). El cuerpo de los 33 tests de `test/fluyo-scenarios-semantics-2.test.cjs`. |
| REAPPLY | Contrato congelado de FASE 2 (§ arriba, de `e47500f`; entró con el commit de FASE 1, antes que este código). Decisiones de FASE 2. Sección de `.ai/ARCHITECTURE.md`. Resultados históricos (abajo). |
| ADAPT | Números de decisión en comentarios y docs (214–215 → 218–219; 218–220 → 222–224; «decisión 215» → 219; «decisión 213» → 217). `BASE` del test de FASE 2: `4fb5872` → `59588a9`. Alcance del test de FASE 1: se mide en `59588a9`, no en `4fb5872`. |
| OBSOLETE | Estado y handoff de `94e50fa` que describen la línea antigua (`4fb5872`, `CACHE` v90, «sin push» de aquella rama). La constante v90 en los tests. |
| CONFLICT | Ninguno: los archivos de `94e50fa` son nuevos o solo de esta tarea, y `ce8e699` no toca kernel, `edgeKind` ni el motor. |

**Pruebas**
- `node --test test/fluyo-scenarios-semantics-2.test.cjs`: **33/33** (con FASE 1: 54/54). Testigos conservados: camino
  alternativo, todos los caminos cerrados, prefijo compartido, ciclos, > 64 caminos (128 y 65 536), `source == target`,
  aislamiento de Conexión y de Requisito, rechazo de UNKNOWN, misma afirmación EXPLICIT, determinismo y 600 grafos aleatorios.
- Mutaciones `test/fluyo-scenarios-semantics-2-mutations.cjs`: **18/18**. FASE 1 sigue en 26/26 con FASE 2 en el árbol.
- Suite, FASE 2 commiteada (commit desechable con el mismo árbol, worktree hermano): **1356 tests, 81 fallos = los 81 de la
  línea base de `ce8e699`, 0 nuevos**.
- **Equivalencia semántica con `94e50fa`: PASS.** El módulo difiere solo en dos líneas de comentario. Además, un test
  diferencial (fuera del repo) carga el `flow-semantics.js` de `94e50fa` y el reaplicado sobre el mismo kernel y compara 80 000
  llamadas (20 000 casos con semilla fija, entradas válidas e inválidas, las cuatro funciones): 0 diferencias. Los tres
  estados y los errores `invalid_availability`, `invalid_provenance` y `missing_edge_endpoint` salen. Más 16 testigos dirigidos
  (el 128.º camino, todo cerrado, 65 536 caminos, ciclos, aislamiento, `source == target`, `node_not_found` y UNKNOWN):
  idénticos.
- MCP: FASE 2 no toca el kernel, así que no hay sync; `check:kernel` OK con el árbol de FASE 2.
- Sin rendering, timeline, `observedFlow` ni cambios en `sw.js`: el test de alcance de FASE 2 lo vigila. La app no carga el módulo.

## Reintegración sobre `0409f4d` (ventana de integración abierta por el PO, 2026-10-19)

Rama `feat/scenario-semantics-integration` (worktree `fluyo-scenario-integration`) desde `main` `0409f4d` (= `origin/main`,
producción en `CACHE` v93). Sin commit (AGENTS.md §6), sin merge y sin push. Solo FASE 1 + FASE 2: FASE 3 queda fuera.

**Inspección.** `main` avanzó desde `ce8e699` con `a000756` y `d4fb06d` (D6, decisión 212, v91), `22f82eb` (PRSKIN, v92),
`f5c36af` (019.4a, decisión 213, v93) y `0409f4d` (test de FLOW-FADE). Ninguno toca `model.js` (el kernel), `ui.js`,
`index.html`, el Story model ni el motor. D6 y 019.4a tocan `render.js`/`geometry.js`, pero en otras regiones: `drawEdge` sigue
llamando a las marcas con los puntos ya aterrizados (`pts`), como preveía la decisión 217. **Sin conflicto semántico**: el
contrato de `edge.kind`, la derivación y la procedencia no cambian.

**Línea base** (`0409f4d`, worktree limpio): `node --test test/*.test.cjs` → 1346 tests, 82 fallos preexistentes (62 s).

**Conflictos y resolución** (55, todos mecánicos; 0 en JS de producto):
- `sw.js` y 53 tests con el literal de `CACHE`: se toma `main` y se sube a **v94** (la siguiente libre).
- `test/fluyo-019-2-browser.cjs`: el smoke del service worker instala la revisión fija anterior **`0409f4d` (v93)** y mide el
  paso a v94.
- `.ai/DECISIONS.md` y `.ai/ARCHITECTURE.md`: unión (lo de `main` y luego lo de Scenarios). La 213 de `main` (019.4a) obliga a
  renumerar: **213–224 → 214–225** en DECISIONS, ARCHITECTURE, el registro, `js/flow-semantics.js` (solo comentarios) y los
  tests semánticos.
- Convención de los tests de alcance. La línea congelada hacía que los tests antiguos midieran en su commit (antigua
  decisión 217). `main`, en cambio, había pasado a deshacer en el texto los cambios posteriores (`fluyo-019-4a-undo.cjs`). Se
  sigue a `main`: **`test/fluyo-scenarios-semantics-undo.cjs`** deshace el parche de FASE 1 (leído de git, hunk a hunk; devuelve
  exactamente los seis archivos de `0409f4d`). Se conecta en los alcances de FLOW-FADE, HIT-TEST, D6, PRSKIN y 019.4a. La
  decisión 218 se reescribe para describirlo.
- Tests semánticos adaptados a la base, no a los resultados:
  - FASE 1 mide contra `0409f4d` (corpus, `drawEdge`, alcance, v94 = v93 + 1) y descuenta `js/flow-semantics.js`.
  - FASE 2 comprueba que en los archivos servidos solo está el parche de FASE 1 (el de `59588a9` sobre `ce8e699`, línea a línea)
    y que el módulo no se carga.
  - U0 de las mutaciones de FASE 1: v94 → v93.

**Validación dirigida (sin batería masiva):**
- Semánticos: FASE 1 21/21, FASE 2 33/33. Mutaciones: FASE 1 26/26, FASE 2 18/18.
- Suites tocadas (vm): 019.4a, PRSKIN, D6, HIT-TEST y FLOW-FADE, 98/98.
- Mutaciones (solo U):
  - 019.4a 15/15, D6 9/9, FLOW-FADE 11/11;
  - HIT-TEST 10/11. Sobrevive U0 («CACHE no sube, sigue v90»), y **también en `0409f4d`** (0/1). Es la misma diana débil
    que `0409f4d` corrigió solo en FLOW-FADE: preexistente y fuera de esta tarea.
- Suite vm en un commit desechable con el mismo árbol (worktree hermano, borrado después): 1400 tests, 82 fallos, **el
  mismo conjunto que la línea base; 0 nuevos, 0 arreglados**. Sin commitear, 13 tests «idéntico a HEAD» fallan, como es
  debido.
- `test/fluyo-019-2-browser.cjs` (Chrome real): 85/85, incluido el upgrade del service worker de v93 (`0409f4d`) a v94.
- QA en Chrome 155 (headless, guion fuera del repo): **48/48**.
  - **V4**: los 8 ejemplos dan hashes idénticos a `0409f4d` en el lienzo del editor (sin selección, con un nodo, con una
    conexión), la exportación plana y la construida, el SVG plano y el construido, y el Viewer. La medida no está vacía.
  - **V1**: con `?labs=escenarios`:
    - clic real sobre la conexión y clics reales en Flujo y Requisito (una entrada de Undo cada uno; elegir el actual no apila);
    - Ctrl+Z, Ctrl+Z y Ctrl+Y reales;
    - marcas contadas por fotograma;
    - autoguardado con `kind`;
    - Present con las mismas marcas;
    - Share → Viewer con `kind` intacto, las mismas marcas y sin selector.
  - **W5**: aviso solo en un Flujo con punta de inicio; origen y destino intactos.
  - **Piel «construido»** (base nueva: D6 + 019.4a): marcas en Present del editor y del Viewer; el SVG construido sin marcas
    (FASE 5).
  - **V3 labs OFF**: apagada por defecto, recordada, `?labs=off` la borra; selector y aviso ocultos; el documento sigue
    pintando; un documento sin `kind` hace 0 llamadas.
  - **V2**: el service worker pasa de v93 a v94 en el mismo origen; la v93 se borra; 60 → 60 entradas (`flow-semantics.js` no
    se precachea); sirve `ui.js`, `geometry.js` e `index.html` nuevos; sin red, la app integrada carga.
  - 0 errores de página.
- **MCP** (sin tocar):
  - `efb316f` (sobre `main` 81154f1) con `FLUYO_PATH` en el árbol integrado: `check:kernel` OK, porque el kernel es idéntico
    (`model.js` = el de `59588a9`). `npm test`: 747/749.
  - Línea base: 81154f1 contra fluyo `0409f4d` da 746/748 con **los mismos 2 fallos**: la brecha declarada de la piel de
    019.4a/D6 (fixtures compartidos y aterrizaje), pendiente del port.
  - El test de más es «`js/flow-semantics.js` es un script clásico», en verde.
  - El `main` del MCP sin `efb316f` **no** pasa `check:kernel` contra el árbol integrado: `efb316f` tiene que entrar a la vez.

**Archivos** (frente a `0409f4d`):
- Producto: `js/model.js`, `js/geometry.js`, `js/render.js`, `js/ui.js`, `index.html`, `css/styles.css`, `sw.js` (v94) y
  `js/flow-semantics.js` (nuevo, no servido).
- Tests nuevos: `test/fluyo-scenarios-semantics-{1,2}.test.cjs`, `-{1,2}-mutations.cjs` y `test/fluyo-scenarios-semantics-undo.cjs`.
- Tests adaptados: 53 por la `CACHE`, `fluyo-019-2-browser.cjs` (service worker) y los alcances de `fluyo-019-{4a,prskin,d6,hit-test,flow-fade}.test.cjs`.
- Docs: `.ai/DECISIONS.md`, `.ai/ARCHITECTURE.md`, `.ai/architecture/SCENARIO-SEMANTICS-001.md` y esta tarea.

**Riesgos residuales:**
- Con la piel, el anillo de Requisito queda junto al anillo de salida de la piel (`skinEdgePort`, 019.1), y se parecen. Ya
  pasaba en la línea congelada. El pintado con la piel es de FASE 4.
- El MCP sigue con la brecha de la piel de 019.4a/D6, que no es de esta tarea. Las marcas siguen fuera de la exportación hasta
  FASE 5.
- Fallos preexistentes que no se tocan:
  - el alcance de 019.5 (contra `b534a97`), roto desde 019.4a/HIT-TEST;
  - la U0 de HIT-TEST;
  - los 82 de la línea base.
- No se ejecutaron los demás `*-browser.cjs`. El guion de QA y 019-2-browser cubren las superficies afectadas. `ui.js`, el
  panel y su CSS no cambiaron en `main` desde la QA responsive de la línea congelada (solo la regla de `#prSkin`).

## FASE 3 — Story Observed Flow (ruta observada de una Historia) · READY FOR COMMIT (2026-10-20)

Base: `main` `16ee642` (= `origin/main`, producción v95) y fluyo-mcp `9ad8147`. Sin commit, sin merge, sin push y sin deploy.
CACHE v95 → **v96**. Decisiones **230–233**. Alcance pedido por el PO: solo FASE 3; FASE 4, 5 y 6 no se empiezan.

### Qué se implementó

| Pieza | Qué hace |
|---|---|
| Kernel (`js/model.js`) | `scenario.observedFlow = {from, to}` opcional con normalización conservadora (`normalizeObservedFlow`: ausente sigue ausente; par válido tal cual, también con claves futuras y extremos perdidos; `null` o formas rotas se quitan; la carga nunca falla). `setObservedFlowIn(pg, scenarioId, flow|null)`, la única escritura. Cascada en `deleteNodeIn` (devuelve `observedFlows`). Condiciones → «Disponible» guarda `{initialState:"UP"}` (`setInitialAvailability`). Decisiones 230 y 231 |
| Integridad (`js/document-integrity.js`) | `removalImpact(...).observedFlows` (`{pageIndex, storyId, storyName, endpoints}`): un aviso, fuera de `wouldInvalidate` |
| Autoría MCP (`js/story-authoring.js`) | `delete_node` añade `cascade.observedFlows` solo si había ruta. Ninguna operación nueva |
| Derivación (`js/flow-semantics.js`) | `flowNodes`, `resolveObservedFlow` (PAIR story/structural · ENDPOINT_MISSING · NO_PAIR) y `observedFlowAt` (composición de FASE 2 con el Trace visible y `visibleAt`). Las funciones de FASE 2 no cambian. Decisión 232 |
| Editor (`index.html`, `js/editor-scenarios.js`, `css/styles.css`) | `#scFlow` bajo el transporte, estático y oculto. Bloque «Ruta observada»: `scFlowModel`, `scRenderFlow`, `scFlowPick`, `scFlowWrite`. Ganchos en `scRenderStatus`, `scSetBehavior`, `scSelectStory`, `scSyncPage` y `scInitUI`. Decisión 233 |
| Carga (`index.html`, `sw.js`) | `flow-semantics.js` tras `story-clock.js`; en el precache; CACHE v96. El Viewer (`s/index.html`) no cambia |
| MCP (`fluyo-mcp`) | Solo `src/generated/kernel-sources.ts` (`npm run sync:kernel`). Ningún cambio de API ni de zod |

**Textos.** Se usan los aprobados: «Ruta disponible», «Ruta no disponible», «Sin ruta de flujo», « · incluye estados por defecto», «Al inicio · » y «Automática».

Dos casos no tenían texto aprobado:
- **Sin par**: «Elige origen y destino», el del prototipo que validó el QA del PO.
- **ENDPOINT_MISSING**: «Un extremo de la ruta ya no existe», derivado de W2. **Lo tiene que confirmar el PO.**

No es un conflicto conceptual: D5 fija el estado y la recuperación, pero no la frase.

**Sin conflicto con D5, D-Ruta, FASE 1/2 ni el modelo de Historia.** Precisiones mecánicas, documentadas en 230–233:
- un `observedFlow` con `from === to` se trata como forma rota y se quita (D5 exige dos nodos distintos);
- con el par estructural, el selector muestra «Automática · nombre»;
- elegir un extremo escribe los dos (el otro, el que muestra su selector); si el otro no tiene valor, la elección queda a medias en la sesión y no escribe;
- en el editor, Condiciones solo emite un cambio cuando el valor cambia: un nodo nunca tocado sigue sin Behavior (DEFAULT).

### Archivos modificados

- fluyo, producto: `js/model.js`, `js/document-integrity.js`, `js/story-authoring.js`, `js/flow-semantics.js`, `js/editor-scenarios.js`, `index.html`, `css/styles.css` y `sw.js`.
- fluyo, tests nuevos:
  - `test/fluyo-scenarios-semantics-3.test.cjs`;
  - `test/fluyo-scenarios-semantics-3-mutations.cjs`;
  - `test/fluyo-scenarios-semantics-3-browser.cjs`;
  - `test/fluyo-scenarios-semantics-3-undo.cjs`.
- fluyo, tests adaptados:
  - **Literales de CACHE**: v95 → v96 en 58 archivos, el cambio mecánico de cada slice.
  - **`undo3` cableado** en los alcances de FASE 1, FASE 2, 019.4b, 019.4a, D6, HIT-TEST, PRSKIN y FLOW-FADE (incluida la lista de solo-FASE-3 de FASE 1 y 2, el `sw.js` y las lecturas de `index.html`, `editor-scenarios.js` y `styles.css`).
  - **`fluyo-017-2.test.cjs`**: las dos aserciones de «UP no deja Behavior» pasan a la regla de la decisión 231.
- fluyo, documentación: `.ai/DECISIONS.md` (230–233; notas en 223 y 225), `.ai/ARCHITECTURE.md` (sección FASE 3) y esta tarea.
- fluyo-mcp: `src/generated/kernel-sources.ts`.
- Fuera: `.ai/tasks/FLUYO-019.4.md` y `.ai/tasks/FLUYO-STEP-REVERSE-001.md` están sin seguimiento y no son de FASE 3. **No se commitean con FASE 3.**

### Pruebas

- **`test/fluyo-scenarios-semantics-3.test.cjs`**, vm, **35/35**:
  - **A (kernel)**:
    - normalización conservadora e idempotente;
    - B4: corpus de ejemplos y fixtures idéntico byte a byte con el `model.js` de `16ee642`;
    - `setObservedFlowIn` con sus códigos;
    - cascada (B5) solo en las Historias que nombran el nodo;
    - `removalImpact`, `delete_node` del MCP, duplicar y `#d=`;
    - Condiciones guarda UP sin cambiar el Trace.
  - **B (derivación)**:
    - resolución en sus cuatro casos;
    - **aceptación de los dos workers** (disponible → cae A, sigue disponible → cae B, no disponible → sin estructura, NO_PATH);
    - NO_PATH ≠ UNAVAILABLE;
    - más de 64 caminos (128, con el único disponible en el último);
    - ciclos;
    - horario visible con dependencias de llegada, para el estado y para la procedencia;
    - procedencia;
    - determinismo;
    - B6: nada derivado se persiste;
    - 300 Historias aleatorias sin UNKNOWN.
  - **C (editor)**: el bloque real con `state.js` y `selection.js` reales:
    - visibilidad (labs, Flujo, eventos);
    - «Al inicio»;
    - reproducción, pausa, ⏮/⏭, terminada y Detener;
    - selectores;
    - Undo y Redo;
    - sin par;
    - ENDPOINT_MISSING;
    - `deleteSel` en la misma entrada de Undo;
    - memoización;
    - mismo Trace que la reproducción;
    - escritura del DOM solo si cambia.
  - **D (estático)**:
    - markup y textos;
    - carga y precache;
    - alcance frente a `16ee642`;
    - `undo3` exacto;
    - B7.
- **Mutaciones**, `test/fluyo-scenarios-semantics-3-mutations.cjs`: **25/25 detectadas**.
  - Derivación (6): ENDPOINT_MISSING cae al estructural o se trata como par; par estructural con varios orígenes o con todas las conexiones; procedencia sin `timeOf`; sin par observa el primer Flujo.
  - Cascada y kernel (8): sin cascada, cascada a todas o solo del origen; `removalImpact` mudo; normalización que reescribe o que rechaza; sin comprobar el nodo; Condiciones con la regla antigua.
  - Editor (11): sin labs; sin eventos; el final en lugar del inicio; «Al inicio» reproduciendo; matiz invertido; Undo sin cambio; sin completar el otro extremo; receta paralela al reproducir; sin memoización; DOM a cada llamada; selectores sin exclusión.
  - La U22 sobrevivía a la primera versión del test (las dos recetas dan el mismo Trace). Se añadió C9b: con un Trace de reproducción alterado, la herramienta lo sigue.
  - Equivalente, sin mutación: en edición, usar el Trace narrativo en lugar del visible. A t = 0 coinciden siempre, porque el primer momento nunca espera.
- **FASE 1 y FASE 2 con FASE 3 en el árbol**: 21/21 y 33/33. Mutaciones 26/26 y 18/18.
- **Chrome real**, `test/fluyo-scenarios-semantics-3-browser.cjs`: **47/47**.
  - V1–V4 a 1440 (ratón) y a 390 (dedo, hoja).
    - Primer «Ruta no disponible» a 3007 y 3035 ms (cae B a 3000).
    - Pausa: 1,8 s sin cambio.
    - Una entrada de Undo; Ctrl+Z la deshace.
    - Borrar el extremo y deshacer.
    - «Sin ruta de flujo» y ENDPOINT_MISSING.
    - En la hoja, la herramienta se ve entera también reproduciendo.
    - Sin errores de consola.
  - V5, labs apagado: cabecera de Historias igual píxel a píxel que en `16ee642`, a 1440 y a 390.
  - SW: v95 (`16ee642`) → v96 instalada y activada, la anterior borrada; `flow-semantics.js` sale de la caché.
- **Regresión**:
  - **vm completa, una sola vez**, en un clon desechable con commit desechable (fluyo y fluyo-mcp hermanos):
    - **1447 tests, 81 fallos**. Línea base `16ee642` en el mismo entorno: 1412/83.
    - **0 fallos nuevos.**
    - Los 2 que «dejan de fallar» (`fluyo-016` 016.1 y `fluyo-018-7d`) son un artefacto de fin de línea del checkout base: esos tests buscan texto con `\n` y el checkout dejó `editor-scenarios.js` en CRLF. No se deben a FASE 3.
  - **Navegador dirigido**: `fluyo-019-2-browser` 85/85 (SW y Viewer) y `fluyo-019-4b-browser` 49/49. No se lanzaron las 46 suites.
  - **MCP**:
    - `npm run sync:kernel`;
    - `check:kernel` OK;
    - `npm test` **757/757**.
    - Ningún test del MCP fijaba «UP quita el Behavior».
  - **En el árbol de trabajo** (sin commit), los alcances «contra HEAD» de 019-1 y 019-2 fallan. Es el artefacto conocido: pasan en el clon con commit.

### QA del PO (2026-10-20) — PASS · FASE 3 aprobada

Chrome real 155, con `?labs=escenarios` y el fixture de dos workers de `test/fluyo-scenarios-semantics-3-browser.cjs`.
- A 1440 px con ratón y a 390 px con dedo, en la hoja.
- El guion de QA vive fuera del repo; el árbol no se modificó.
- **49/49 comprobaciones.** Sin errores de consola.

| # | Comprobación | Resultado |
|---|---|---|
| 1 | Historia con `observedFlow` Cliente → BD | «Al inicio · Ruta disponible · incluye estados por defecto». Al reproducir: «Ruta disponible» hasta 1,5 s, **sigue** «Ruta disponible» al caer Worker A y pasa a «Ruta no disponible» a 3022 ms (1440) / 3051 ms (390), con el cambio en 3000 y hasta el final. Sin la conexión API → Cola: «Al inicio · Sin ruta de flujo», y «Sin ruta de flujo» reproduciendo (neutro) |
| 2 | Pausa y saltos | Pausado a ~2,04 s, de +0,3 s a +2,8 s reales el cursor no se mueve y sigue «Ruta disponible»: el cambio de los 3 s no llega. Al reanudar llega «Ruta no disponible». Desde «terminada», ⏮ ⏮ ⏮ ⏭ ⏭ = 3000 «no disponible» · 1500 «disponible» · 0 «disponible» · 1500 «disponible» · 3000 «no disponible». Tras un salto, en pausa, 2 s sin cambio |
| 3 | Selector y Undo | Origen → API escribe `{2,6}`; Destino → Worker B escribe `{2,5}`; «Automática» quita la clave y vuelve el par estructural. Una entrada de Undo cada vez. El botón ↶ de la cabecera ×3 da `{2,5}` → `{2,6}` → `{1,6}`, con los selectores siguiendo al documento. Rehacer correcto. Sin par: elegir solo el origen no escribe ni apila; el destino escribe los dos con una entrada |
| 4 | Textos pendientes | **Aceptados como UX final.** «Un extremo de la ruta ya no existe» se lee junto al «—» del selector afectado: dice qué pasa y dónde, y se recupera eligiendo otro nodo. «Elige origen y destino» es una instrucción directa en el único caso en que la herramienta no puede elegir |
| 5 | «Automática · nombre» | Se recorta **también a 1440**, no solo a 390. Visible: «Automática …»; el nombre no se ve con el selector cerrado (necesita 197 px y hay 123 a 1440; 245 y 158 a 390). Se ve entero en el desplegable nativo y en el `title`. Con una ruta elegida (`observedFlow`) los nombres se leen enteros: «Cliente → BD» a 390. **No bloquea** (ver debajo) |
| 6 | labs apagado | Con un documento que YA trae `observedFlow`, frente a `16ee642`, a 1440 y a 390: ningún elemento visible nuevo editando, en Historias ni reproduciendo. El panel de Historias y el de Propiedades de una conexión son idénticos píxel a píxel |

**Por qué el recorte no bloquea el cierre**:
- El estado de la ruta, que es lo que entrega FASE 3, se lee siempre entero.
- El caso de aceptación (una ruta configurada) muestra los nombres completos.
- En automático, el par se descubre con un toque (la lista nativa) o al pasar el ratón.
- La herramienta solo existe tras la bandera labs.

Queda como **deuda que debe resolverse antes de retirar la bandera** (FASE 6): con el selector cerrado, «Automática · nombre» no enseña el nombre, que es justo lo que esa etiqueta quería mostrar.

Corrige lo que decía el informe de implementación: «legible en escritorio» era inexacto, porque a 1440 también se recorta.

### Deuda y riesgos

1. **Textos**: aceptados en la QA del PO. **Recorte de «Automática · nombre»** (a 1440 y a 390): deuda no bloqueante; hay que resolverlo antes de retirar la bandera (FASE 6).
2. **W2 en `FluyoIntegrity`**: el aviso de ENDPOINT_MISSING en `validateProject`/`describe_document` no entra. Cambiaría la salida del MCP, así que va con FASE 5. Hoy solo lo ve la herramienta.
3. **Confirmación al borrar**: borrar un extremo no pide confirmación (política de 018.4: solo se confirma si se rompen Steps). Undo lo recupera; `removalImpact` ya lo informa por si el PO quiere avisarlo.
4. **B9** (contradicción temporal de SEND + SET_STATE): sigue pendiente del fixture de FASE 6.
5. **Coste por fotograma**: reproduciendo, se evalúa la derivación en cada fotograma, O(V + E + eventos), y el DOM solo se toca si cambia. No se midió con 300 nodos.
6. **La deuda general de tests no se tocó**: 81 fallos de base, CACHE escritos a mano (58 archivos subidos a v96) y alcances contra HEAD.

## FASE 4 — Scenario Experience · READY FOR REVIEW (2026-10-20)

Base: `main` `ae0d619` (= `origin/main`, producción v98; FASE 3 en `544fd4b`, STEP-REVERSE-002/003) y fluyo-mcp `497c81e`. Sin commit, sin
push y sin deploy. CACHE v98 → **v99**. Decisiones **241–244**. Alcance pedido por el PO: solo FASE 4 sobre el contrato cerrado de FASE 3; ni
FASE 5 ni FASE 6. **No cambian**: D5, D-Ruta, el contrato de `observedFlow`, AVAILABLE / UNAVAILABLE / NO_PATH, la derivación del estado
(funciones de FASE 2 y FASE 3 idénticas, test E2), STEP-REVERSE, la bandera labs ni fluyo-mcp.

### Auditoría previa (cómo dejó FASE 3 cada pieza)

| Pieza | Estado al empezar | Qué hace FASE 4 con ella |
|---|---|---|
| `observedFlow` / `resolveObservedFlow` | dato de la Historia; resolución PAIR (story/structural) · ENDPOINT_MISSING · NO_PAIR | solo lee el par resuelto |
| `observedFlowAt` | estado + procedencia con el Trace visible | sin cambios; la línea de estado sigue saliendo de aquí |
| `FluyoStoryClock` | horario visible (dependencias de llegada), pausa, saltos por momento | sin cambios; la timeline usa el mismo Trace visible y el cursor virtual |
| Herramienta (`#scFlow`) | selectores + línea de estado; base memoizada (reproducción o firma) | añade línea de tiempo, extremos y filas bajo el estado, sobre la MISMA base |
| Renderer | marcas estáticas Flujo/Requisito (sin bandera); overlays de Scenario (oscurecido DOWN, cues) desde `scenarioRuntime` | añade `scenarioRuntime.flow` (solo editor + labs + reproducción) y lo pinta en `drawEdge` y en `drawScenarioNodeOverlay` |
| Piel «construido» | capas de 019.4b: contenedores → conexiones → hojas → cues → marcas del editor; aterrizaje de la 213 | las fundas van con su conexión (bajo la línea pintada, aterrizada) y las marcas de nodo con su nodo: el orden de capas no cambia. N3 resuelto |
| Present | mismo `render()`, `presenting`; sin marcas de comportamiento de ruta | sigue igual (FASE 5): `scFlowOverlay` devuelve null en Present (medido en Chrome) |
| Viewer | no carga `flow-semantics.js`; `FluyoStory.renderState` sin `flow` | sin cambios (`viewer.js` y `s/index.html` idénticos) |

«Route overlays (W2)»: en el repositorio W2 solo nombra el aviso de ENDPOINT_MISSING (§ V); aquí se lee como las fundas y el barrido de la
ruta en el lienzo, verificados con el caso de aceptación de dos workers.

### Qué se implementó

| # | Pieza | Cómo |
|---|---|---|
| 1 | Semantic edge rendering | las marcas estáticas de FASE 1 no cambian; las fundas de comportamiento solo van en conexiones Flujo de la ruta (decisión 241) |
| 2 | Route overlays en el lienzo | `scFlowOverlay` (editor) → `scenarioRuntime.flow` → `drawRouteSleeve` (`render.js`): halo oliva estático, fundido de clase, barrido único en frontera (decisión 244) |
| 3 | UNAVAILABLE | funda terracota apagada fina y discontinua (señal propia) + pastilla «—» en el nodo no disponible + tramo terracota en la timeline + borde terracota de la herramienta (FASE 3) |
| 4 | Route rows | `routePaths`: ≥ 2 caminos, ≤ 3 filas «vía …» + «+N rutas», estado por fila en el instante (decisión 243) |
| 5 | Behavioral timeline | `routeTimeline` + `scFlowVisibleEnd`: tramos, punto (cambio de un nodo de la ruta) y barra (frontera), extremos «Inicio · Cambios de la ruta · Final», cursor solo reproduciendo (decisión 242) |
| 6 | Requirement estable | Requisito (y Conexión) nunca reciben funda; su trazo es idéntico en todo instante (vm y Chrome) |
| 7 | Piel «construido» | fundas sobre la línea aterrizada; pastilla y transición local sobre `skinExtent`; **N3**: sin anillo de salida donde se pinta el de Requisito (decisión 244) |
| 8 | N3 de la tarea: timeline derivada | nada se persiste ni apila Undo; se recalcula de estructura + Behaviors + Trace visible (A9, B5) |

**Textos.** Los del prototipo validado por el PO (§ 3.1 y D6): «disponible», «no disponible», «ninguno», «vía …», «+N rutas», y las etiquetas
«Inicio», «Cambios de la ruta», «Final». Dos variantes nuevas, **pendientes del PO**: «+1 ruta» (singular) y «+N rutas o más» (solo con ciclos
y más de 10 000 caminos; inalcanzable en diagramas reales).

### Archivos modificados

- Producto: `js/flow-semantics.js` (bloque FASE 4), `js/editor-scenarios.js` (bloque «Ruta observada» y `buildScenarioRenderState`),
  `js/render.js` (pintor de la ruta, gancho en `drawEdge` y `drawScenarioNodeOverlay`, N3), `index.html` (markup estático dentro de `#scFlow`),
  `css/styles.css` y `sw.js` (CACHE v99; el precache no cambia).
- Tests nuevos: `test/fluyo-scenarios-semantics-4.test.cjs`, `-4-mutations.cjs`, `-4-browser.cjs`, `-4-undo.cjs` (`undo4`).
- Tests adaptados: literal de CACHE v98 → v99 en 61 archivos; `undo4` encadenado antes de `undoReverseUi` en los alcances de FASE 1, FASE 2,
  FASE 3, STEP-REVERSE-002/003, 019.4b, 019.4a, D6, FLOW-FADE, HIT-TEST y PRSKIN; arnés vm de FASE 3 (`style`/`dataset` en los elementos
  falsos); `fluyo-018-18.test.cjs` (la proyección de `buildScenarioRenderState` se busca dentro de la función: ahora es `const rs = …`).
- Docs: `.ai/DECISIONS.md` (241–244), `.ai/ARCHITECTURE.md` (sección FASE 4) y esta tarea.
- Fuera: `.ai/tasks/FLUYO-019.4.md` (sin seguimiento) y `.ai/tasks/FLUYO-STEP-REVERSE-003.md` (cambio previo ajeno). fluyo-mcp: ninguno
  (ningún archivo de FASE 4 es kernel; test E4).

### Pruebas

- **`test/fluyo-scenarios-semantics-4.test.cjs`, vm, 34/34**:
  - **A (derivación)**: ruta y capas; NO_PATH ⇔ `flowStatus` y toda conexión de un camino simple está en la ruta (600 grafos); estado de las
    conexiones frente a un oráculo de caminos simples (400 grafos, con ciclos); timeline de aceptación; ruido, mismo instante, 0, vuelta del
    extremo, un solo estado, NO_PATH; horario visible con dependencia de llegada; filas (paralelas, 128 caminos sin enumerar, ciclos, 300 grafos
    frente al oráculo, `mustPass`); determinismo y B6.
  - **B (lienzo del editor)**: solo con labs, reproduciendo, con par y ruta, nunca en Present; aceptación instante a instante (clases, fundido,
    barrido, pastillas, transición local); pausa y saltos = reproducción continua; Requisito/Conexión nunca; Undo intacto.
  - **C (herramienta)**: edición sin cursor; cursor, filas y Detener; NO_PATH / sin par / ENDPOINT_MISSING / ruta lineal / «ninguno»;
    «+N»/«+1 ruta»; escrituras de DOM; Undo de lo persistido; memoización; fin visible = `isFinished` en 200 Historias aleatorias.
  - **D (pintor, lienzo que registra operaciones)**: funda bajo la línea, colores y discontinuo; fundido; barrido por capas, nunca con «reducir
    movimiento» ni al exportar; con la piel sobre la línea aterrizada; pastilla y transición local (y sobre `skinExtent`); Requisito idéntico en
    todo instante; N3; **sin `flow`, `drawEdge`, el pintor de nodo y un fotograma completo de los ejemplos (plano y piel, también reproduciendo)
    son los de `ae0d619` operación a operación**.
  - **E (estático)**: markup y orden de D6, textos, sin UNKNOWN ni vocabulario de salud, halo sin «respiración», alcance frente a `ae0d619`,
    `undo4` exacto, B7, fuera del kernel del MCP.
- **Mutaciones** `-4-mutations.cjs` (grupos A–D; el alcance mataría todas): **33/33 detectadas** — derivación (10), editor (13), pintor (10).
- **Suites dirigidas** con FASE 4 en el árbol: FASE 1/2/3, STEP-REVERSE-002/003, 019.4b, 019.4a, D6, FLOW-FADE, HIT-TEST, PRSKIN + FASE 4:
  **281/281**. Mutaciones antiguas: FASE 1 26/26, FASE 2 18/18, FASE 3 25/25, STEP-REVERSE-003 16/16.
- **Chrome real 155** (`-4-browser.cjs`, perfil limpio, terceros bloqueados): **76/76**.
  - 1440 (ratón) y 390 (dedo, hoja): timeline y filas en edición; reproducción muestreada (todo oliva → cae A: rama A terracota y B oliva, sin
    barrido → cae B: todo terracota con un barrido); píxeles en pausa en 0,8 · 2,3 · 4,2 s; Requisito idéntico píxel a píxel; pausa quieta;
    ⏮/⏭ reales; a 390 la herramienta entera en la hoja también reproduciendo; sin Undo; sin errores de consola.
  - Temas: crema + piel, oscuro, oscuro + piel, claro: cae A se distingue; N3 medido (7 anillos de salida de 8 conexiones por fotograma).
  - **labs apagado frente a `ae0d619`**, 1440 y 390: lienzo editando y reproduciendo (pausa en 0,8 · 2,3 · 3,3 s) y cabecera de Historias
    idénticos píxel a píxel.
  - Present con labs: 0 fundas, sin `flow`. «Reducir movimiento»: sin barrido. SW v98 (`ae0d619`) → v99: instalada, activada y la anterior borrada.
- **Navegador de slices anteriores (dirigido)**: FASE 3 47/47, 019.4b 49/49, 019.2 85/85 (SW y Viewer). No se lanzaron las 46 suites.
- **Regresión vm completa, una vez**, en clones desechables (fluyo y fluyo-mcp hermanos): base `ae0d619` **1495/83**; árbol con FASE 4 en un
  commit desechable **1529/83, el mismo conjunto: 0 nuevos, 0 arreglados**. La primera pasada encontró 2 fallos causados por esta tarea (un
  literal v98 en el test E2, que vigila 019-1, y la aserción textual de 018-18): corregidos y vueltos a medir.
- En el árbol de trabajo (sin commit), los alcances «contra HEAD» (018-18, 019-1, 019-2…) fallan: es el artefacto conocido; pasan con commit.

### Deuda y riesgos

1. ~~**Claro**: el halo oliva se leía gris sobre blanco.~~ **Resuelto** en los ajustes post-QA: oliva pálido `rgba(195,205,164,.55)`.
2. ~~**Textos nuevos pendientes**~~ **Resuelto**: «+1 ruta» aceptado; el caso no exacto dice «Más de 10 000 rutas».
3. **N3 sin bandera**: un documento con Requisito y la piel pierde el anillo de salida en esa conexión también con labs apagada, en Present y en
   el Viewer (regla de marca estática, D10). Hoy solo se crean Requisitos con labs. El SVG y el MCP no cambian hasta FASE 5.
4. **Ciclo interior** de una ruta: se pinta como parte de ella aunque ningún camino simple lo use (decisión 241).
5. **Densidad en la hoja a 390**: la herramienta mide 190 px con dos filas; con 3 filas + «+N» crece ~30 px. No se midió con 300 nodos.
6. **B9** (SEND + SET_STATE en la misma ventana) sigue para el fixture de FASE 6; ahora el barrido y las fundas lo hacen más visible.
7. Arrastrada de FASE 3: el recorte de «Automática · nombre» (antes de retirar la bandera) y W2 en `FluyoIntegrity` (FASE 5).

### QA del PO (2026-10-20) — CHANGES REQUESTED: 2 ajustes menores, ningún bloqueo de contrato

Chrome real 155 con `?labs=escenarios` y el fixture de dos workers de `-4-browser.cjs`, a 1440 (ratón) y 390 (dedo, hoja), en claro, crema
y oscuro, con y sin la piel «construido». Edición, reproducción, pausa, ⏮/⏭, cae A y después cae B. El guion de QA vive fuera del repo y el
árbol no se tocó durante la revisión. Resultado: 46 de 49 comprobaciones automáticas en verde. Las 3 rojas eran un error del guion (dos ⏮
desde «cae B» llevan al inicio, no a «cae A»); vuelto a medir con un solo ⏮: cursor 33,333 % y filas correctas.

| # | Revisión | Resultado |
|---|---|---|
| 1 | **Halo en claro** | **Requiere ajuste.** Medido junto a la rama disponible: fondo (240, 240, 240) → halo (209, 211, 207), saturación ≈ 2 %. Se distingue de la terracota (Δ 25, igual que en crema 27 y en oscuro 27) y del fondo (Δ 55), pero se lee como una **banda gris neutra**, no como oliva: en claro «disponible» parece «sin estado». En crema (saturación 9 %) y en oscuro se lee como oliva. Probado en la página, solo en tiempo de ejecución: subir el alfa del mismo oliva (`rgba(78,90,63,.32)`) solo oscurece el gris (4 %); el oliva pálido del sistema (`--c-oliva-palido` `#C3CDA4` al 55 %) da (210, 215, 195), 9 %: se lee como oliva y sigue separado de la terracota |
| 2a | **«+1 ruta»** | **Aceptado.** Natural en singular; con 4 caminos se lee «vía Worker A · disponible / vía Worker B / vía Worker C / +1 ruta», también a 390 en la hoja. Con 5 caminos («+2 rutas») las filas pasan a «vía Cola → Worker A…», porque Cola deja de estar en todos los caminos. Es correcto |
| 2b | **«+N rutas o más»** | **Requiere ajuste.** Con una malla con ciclos (109 601 caminos simples reales) se ve «**+9997 rutas o más**»: el número sale del tope interno de enumeración (10 000 − 3), aparenta una precisión que no existe y el «+» con «o más» es redundante. Es inalcanzable en diagramas reales, pero el texto no debe exponer el tope |
| 3 | **N3** (Requisito + piel) | **Aceptado y cerrado.** Por fotograma se cuentan 7 anillos de salida para 8 conexiones (el Requisito, sin él) en el editor con labs, en el editor con labs apagado, en Present y en el Viewer (Share → `s/`). La conexión API → Auth lleva un solo anillo, el de Requisito, y no se confunde con el estado. La exportación (SVG/PNG) sigue como en v98: sin marcas (FASE 5). Coherente en todas las superficies |
| 4 | **Comportamiento principal** | **PASS** a 1440, 1440 + piel y 390: disponible → halo oliva en las dos ramas; cae A → anillo en Worker A, rama A terracota y rama B oliva, **sin** barrido; cae B (cambio real de ruta) → un barrido único y anillo en Worker B; Requisito y Conexión nunca reciben funda; la timeline sigue la reproducción (0 → 100 %), queda quieta en pausa (44,444 % un segundo después) y ⏭/⏮ la llevan a 66,667 % / 33,333 %; Present reproduciendo: 0 fundas; Viewer reproduciendo: 0 fundas y no carga `flow-semantics.js`; exportar PNG/SVG en plena reproducción: sin fundas ni colores de la ruta; sin Undo y sin errores de consola |

**Cambios exactos que se piden** (sin contrato nuevo; los dos caben en las decisiones 243–244):
1. `js/render.js`, `ROUTE_MARK.claro.halo`: `"rgba(78,90,63,.20)"` → `"rgba(195,205,164,.55)"` (oliva pálido del sistema). Crema, oscuro y la
   terracota de los tres temas no cambian. Hay que actualizar: la nota de la decisión 244, el umbral de «claro» en `-4-browser.cjs` (el oliva
   tiene que medirse como oliva, no solo distinto) y una comprobación vm del color de claro en D1.
2. `js/editor-scenarios.js`, `scFlowTrackView`: si `d.paths.exact` es falso, la última fila dice «**Más de 10 000 rutas**» (el total, con el
   tope formateado y sin «+N»). El caso exacto sigue igual: «+N rutas» / «+1 ruta». Hay que actualizar: el texto de la decisión 243, un caso en
   C4 (malla con ciclos por encima del tope) y una mutación que lo vigile.

Después del ajuste: repetir solo `-4.test.cjs`, `-4-mutations.cjs` y `-4-browser.cjs` (y regenerar `undo4`), y pasar a READY FOR COMMIT.

**Decisiones cerradas por esta QA**: N3 (decisión 244, regla de marca estática sin bandera); «+1 ruta» (decisión 243); el comportamiento de
lienzo y timeline de las decisiones 241, 242 y 244 (oliva / terracota / barrido solo en frontera / anillo local / Requisito y Conexión
estables / nada en Present, Viewer ni exportación). **Quedan abiertas hasta el ajuste**: el color del halo en claro y el texto del recuento
inexacto.

### Ajustes post-QA (2026-10-20) — aplicados · READY FOR COMMIT

Solo los dos cambios pedidos. La semántica de FASE 4, D5, D-Ruta, AVAILABLE / UNAVAILABLE / NO_PATH, `observedFlow` y N3 no cambian.

| # | Ajuste | Cambio | Cobertura nueva |
|---|---|---|---|
| 1 | Halo en claro | `js/render.js`: `ROUTE_MARK.claro.halo` pasa de `"rgba(78,90,63,.20)"` a `"rgba(195,205,164,.55)"` (oliva pálido del sistema). Crema, oscuro y las tres terracotas, iguales | vm D1: el trazo del halo en claro es `rgba(195,205,164,.55)`, mismo grosor y sin discontinuo; la terracota de claro y el halo de crema no cambian. Chrome: en claro (plano y piel, 1440 y 390) el halo mide (212, 218, 197), tono 77°, saturación 10 % (antes 2 %), Δ 21 con la terracota. Mutación U36 |
| 2 | Recuento no exacto | `js/editor-scenarios.js`, `scFlowTrackView`: si el recuento no es exacto, la última fila es exactamente «Más de 10 000 rutas» (`SC_FLOW_WORDS.tooMany`). Exacto: «+1 ruta» / «+N rutas», como antes. Desaparece «o más» | vm C4b: malla con ciclos (109 601 caminos) → «Más de 10 000 rutas», sin «+N», sin «o más» y sin el tope menos las filas; E1: el texto existe y «o más» ya no. Chrome (1440 y 390): «+1 ruta», «+2 rutas» y «Más de 10 000 rutas», filas enteras a la vista. Mutaciones U34 (vuelve «+N … o más») y U35 (lo no exacto como exacto) |

Docs: decisiones 243 (texto del recuento no exacto) y 244 (colores del halo por tema) y `.ai/ARCHITECTURE.md`. `undo4` regenerado
(devuelve los cinco archivos exactos a `ae0d619`).

**Resultados finales**:
- vm de FASE 4: **35/35**. Mutaciones: **36/36**.
- Suites dirigidas: FASE 1/2/3, STEP-REVERSE-002/003, 019.4b, 019.4a, D6, FLOW-FADE, HIT-TEST, PRSKIN + FASE 4: **282/282**.
- Chrome real (`-4-browser.cjs`): **114/114**:
  - 1440 y 390;
  - claro, crema y oscuro, con y sin piel;
  - halo claro;
  - recuento;
  - edición, reproducción, pausa y saltos;
  - labs apagado = `ae0d619` píxel a píxel (lienzo y cabecera);
  - Present, reducir movimiento y SW v98 → v99.
- vm completa en el clon con commit desechable: **1530 / 83 fallos = el mismo conjunto de la base** (1495/83). 0 nuevos, 0 arreglados. No se lanzaron las 46 suites de navegador.

**Decisiones cerradas** (QA del PO + ajustes):
- N3 (244);
- «+1 ruta» y «Más de 10 000 rutas» (243);
- halo de claro `rgba(195,205,164,.55)` (244);
- comportamiento de lienzo y timeline (241, 242 y 244).

### Publicación (2026-10-20) — CERRADA

- Push `ae0d619..6701261` a `origin/main`. Los dos `.md` ajenos (`FLUYO-STEP-REVERSE-003.md` y `FLUYO-019.4.md`) se quedan fuera, sin commit.
- Vercel sirve **v99** unos 6 s después del push. 12 archivos servidos coinciden byte a byte con `6701261`: `sw.js`, `index.html`, `render.js`,
  `editor-scenarios.js`, `flow-semantics.js`, `styles.css`, `model.js`, `story-clock.js`, `viewer.js`, `s/index.html`, `geometry.js` y `skin.js`.
- Smoke en producción con Chrome real (perfil limpio, terceros bloqueados, service worker activo), a 1440 y 390: **24/24**.
  - SW v99 activo y el código de FASE 4 cargado.
  - Timeline, extremos y filas en edición.
  - Lienzo: oliva → cae A (rama A terracota, sin barrido) → cae B (barrido); Requisito y Conexión sin funda.
  - Cursor y ⏮ correctos; halo de claro `rgba(195,205,164,.55)`.
  - Present sin fundas; labs apagado sin herramienta ni ruta.
  - Sin errores de consola.
- fluyo-mcp sin cambios. Siguiente CACHE libre: **v100**. FASE 5 no se empieza sin autorización.

## FASE 5 — Paridad de superficies · Auditoría (2026-10-20) · BLOCKED → resuelta por el PO (ver § «Implementación»)

Base: fluyo `6701261` (= `origin/main`, producción v99) y fluyo-mcp `497c81e`. El PO autorizó FASE 5 (Viewer, Present, Share,
exportación y MCP; § 9, D7, D8, D9, § Export). La auditoría se hizo antes de implementar. **No queda código**: un primer paso sobre
`flow-semantics.js` y `editor-scenarios.js` se revirtió al encontrar el bloqueo. El árbol es `6701261` más las notas `.md` previas. Sin
commit, push ni deploy. Ni CACHE ni decisiones nuevas.

### Qué existe ya y qué falta, por superficie

| Superficie | Ya existe (FASE 1–4) | Falta según el contrato de FASE 5 |
|---|---|---|
| Viewer (D7) | marcas estáticas de Flujo/Requisito sin bandera; N3 con la piel | no carga `flow-semantics.js`; `FluyoStory.renderState` sin `flow` (sin fundas, barrido ni marcas de nodo de la ruta); no hay línea de estado |
| Present (D8) | marcas estáticas | `scFlowOverlay` devuelve `null` en Present (FASE 4, mutación U12); `#psGroup` sin línea de estado |
| Share / `#d=` | `kind` y `observedFlow` viajan sin código nuevo (passthrough; «Compartir historia» pone la Historia elegida primero) | solo pruebas de superficie (§ 10) |
| Exportación (§ Export) | sin marcas en ninguna salida: `drawEdge` las salta con `isExport` y `renderConnectorToSVG` no las conoce (decisión 217) | marcas en SVG/PNG/JPG/GIF, N3 también al exportar, sin `kind` el byte a byte de hoy, overlays nunca |
| MCP (D9) | kernel sincronizado: conserva `kind` y `observedFlow` (passthrough) y la cascada de `delete_node` | zod: `ConnectionSpec`/`ConnectionPatch` rechazan `kind` (`strictObject`) y `EdgeSpec` de `create_diagram` lo quita; `describe_document` no expone `kind` ni `observedFlow`; no hay operación de ruta observada; `svg.ts` sin marcas; no hay test de deriva de disponibilidad (enums `UP|DOWN` en `authoring.ts`) |
| Integridad (§ V) | `removalImpact.observedFlows` | W2 (extremo perdido) y W3 (`kind` desconocido) como avisos de `FluyoIntegrity` (pendiente desde FASE 3) |
| `docs/index.html` | nada de Flujo, Requisito ni `observedFlow` | el contrato lo nombra en el alcance, pero no fija el contenido |

### Bloqueo: la línea de estado de la ruta no cabe donde la ponen D7 y D8 (medido en Chrome real)

D7 pone la línea de estado del Viewer «en la banda de la Historia». D8 la pone en el mando de Present (`#psGroup`).

FLUYO-018.18 fijó cómo son esos dos contenedores:
- **banda**: SOLO el transporte, en una fila de alto fijo («el lienzo no salta»);
- **mando**: grupos que nunca se parten.

Se midió con Chrome 155, el fixture de dos workers y `observedFlow`. El guion vive fuera del repo; el árbol no cambia.

Ancho de los textos aprobados (mono, `--fs-label`):

| Texto | Ancho |
|---|---|
| «Ruta disponible» | 99 px |
| «Sin ruta de flujo» | 112 px |
| «Ruta no disponible» | 119 px |
| «Ruta disponible · incluye estados por defecto» | 297 px |
| «Al inicio · Ruta disponible · incluye estados por defecto» | 376 px |

Espacio disponible en cada contenedor:

| Contenedor | 1440 px | 390 px |
|---|---|---|
| Banda del Viewer, reproduciendo (transporte de 339 px) | 1069 px libres | **19 px libres** |
| `#psGroup` de Present, reproduciendo | 315 px + texto, sobra sitio | 315 px; el mando ya está en su tope (374 px) y en dos filas: **no cabe** |
| `#psGroup` de Present, sin reproducir | 129 px + texto, sobra sitio | 129 + 376 = 505 px frente a 374: **no cabe** |

A 1440 cabe en los dos sitios; a 390, en ninguno. El contrato no dice qué hacer en ese caso. Cualquier solución cambia el diseño aprobado de
018.18 o la ubicación de D7/D8. El Viewer va **sin bandera**, así que es interfaz pública. Por eso no se elige aquí.

**Decisiones que necesita el PO**

1. **(Bloqueante) Dónde va la línea en pantallas estrechas.**
   - **(a) Una fila propia dentro del mismo contenedor**, solo en Historias con par resuelto:
     - la banda del Viewer pasa de 64 px a unos 84 px desde la carga, para que el lienzo no salte al reproducir;
     - en `#psGroup`, la línea va en otra fila bajo los botones.
     - Cumple D7 y D8 al pie de la letra; cambia el «alto fijo» de 018.18 en esas Historias.
   - **(b) En el rótulo sobre el lienzo**, donde ya se cuenta qué Historia y qué momento:
     - en el Viewer, `#stNow`, como línea propia; el rótulo pasa de dos líneas de alto fijo a tres en esas Historias;
     - en Present, `#presentStory`.
     - Una sola ubicación vale para el Viewer, el Present del Viewer (allí la banda se oculta y el transporte se muda al mando) y el Present
       del editor.
     - Cabe a 390: 297 px como mucho, frente a 366 y 359 px de tope. Contradice la ubicación literal de D7 y D8.
   - **(c) Seguir en la fila y recortar**:
     - a ≤ 480 px, Pausar y Detener solo con icono;
     - la línea con elipsis y el texto entero en `title`.
     - Cambia los rótulos del transporte de 018.18 y corta «incluye estados por defecto».
   - **Recomendación: (b)**. Está donde ya se lee la narrativa en las tres superficies, cabe a 390 sin tocar el transporte y es una sola
     ubicación.
2. **(Ligada a la 1) Present antes de reproducir.**
   - D8 solo dice «solo si hay par resuelto». Leído al pie de la letra, sin reproducir diría «Al inicio · …».
   - D7 limita el Viewer a «reproduciendo».
   - **Recomendación**: solo reproduciendo (también en pausa y terminada), como el Viewer y como las fundas, que solo existen reproduciendo.
     Así «mismo estado en el mismo instante» vale en las tres superficies.

**Decisiones menores que se tomarán así salvo indicación** (dentro del contrato; irían numeradas desde la 245):
- **Una receta.** Lo que se pinta de la ruta pasa de `scFlowOverlay` a una función pura `FluyoFlow.routeOverlay`, que usan el editor,
  Present y el Viewer. Lo mismo la línea, con `FluyoFlow.routeLine` y los textos de `SC_FLOW_WORDS`, con un test de igualdad. FASE 4 no
  cambia: sus pruebas se reapuntan; U12 y U27 se sustituyen por las de FASE 5.
- **Viewer.**
  - Carga `flow-semantics.js` entre `story-clock.js` y `viewer.js`, con guardas `typeof`.
  - Tiene la misma regla de existencia que la herramienta (D6: Flujo en la página y Historia con pasos).
  - ENDPOINT_MISSING y sin par: nada.
  - NO_PATH: solo la línea «Sin ruta de flujo», sin fundas.
- **Present**: los overlays siguen tras la bandera labs (D10); el Viewer no depende de ella (D7).
- **Exportación**:
  - las marcas van en SVG/PNG/JPG/GIF, en el mismo orden que el lienzo (línea → puntas → marcas → anillo de salida → rótulo);
  - N3 también al exportar (raster = SVG = MCP);
  - sin `kind`, el SVG y el raster de hoy byte a byte.
- **Integridad**: `validateProject` añade `warnings` solo si hay alguno, así un documento antiguo da la salida de hoy:
  - W2: `observed_flow_endpoint_missing`;
  - W3: `unknown_connection_kind`.
- **MCP**:
  - `kind: "FLOWS_TO" | "REQUIRES" | null` en `ConnectionSpec`, `ConnectionPatch` y `EdgeSpec`.
  - `describe_document`:
    - `connectionKind` solo en las conexiones que lo tienen (ausente = Conexión, D2);
    - `observedFlow: {source, target, sourceLabel, targetLabel}` solo si está guardado;
    - `warnings` solo si hay.
  - Operación `set_observed_flow` (alcance `story`): `{pageIndex, storyId, source, target}`, con id o `{ref}` del lote; `source:null,
    target:null` = «Automática». Es kernel, con `setObservedFlowIn`; obliga a resincronizar el kernel.
  - `svg.ts`: port literal de `edgeSemanticMarks` con un golden compartido generado por el SVG del editor en Chrome.
  - Test de deriva: los enums de disponibilidad de zod = `SCENARIO_STATES` y `EVENT_TYPE_AVAILABILITY` del kernel.
- **`docs/index.html`**, solo lo factual:
  - `kind` y `observedFlow` en el formato;
  - las marcas en la exportación;
  - `connectionKind`, `observedFlow` y `set_observed_flow` en el MCP.
  - Sin mencionar la bandera labs, que no tiene interruptor visible hasta FASE 6.
- **Operativo**: CACHE v99 → v100; `undo5` encadenado antes de `undo4` en los alcances antiguos; MCP: `sync:kernel` y `check:kernel`.

## FASE 5 — Paridad de superficies · Implementación · APROBADA · CERRADA (2026-10-20)

**Contexto**:
- Base: fluyo `6701261` (producción v99) y fluyo-mcp `497c81e`. Sin commit, push ni deploy. CACHE v99 → **v100**.
- Decisiones **245–249**.
- El PO cerró el bloqueo de la auditoría:
  1. **(b)**: la línea de estado va en el rótulo sobre el lienzo, y la fila de controles no cambia.
  2. En Present, la línea sale solo reproduciendo, en pausa o terminada.
  - Aceptó también las decisiones menores.
- No cambian: D5, D-Ruta, `observedFlow`, AVAILABLE / UNAVAILABLE / NO_PATH, la derivación y el pintado de FASE 3/4, STEP-REVERSE y la bandera labs.
- Las dos `.md` ajenas no se tocan.

**Lectura de la decisión 1**: la opción (b) se describía como «una sola ubicación» para el Viewer, su Present y el Present del editor. Por eso el rótulo se usa a cualquier ancho y no solo en pantallas estrechas: la banda y el mando son los de `6701261` a 1440 y a 390 (medido).

### Qué se implementó

| Superficie | Cambio |
|---|---|
| Receta compartida | `FluyoFlow.routeOverlay` (lo que pintaba `scFlowOverlay`, movido sin cambios) y `FluyoFlow.routeLine` (`flow-semantics.js`). El editor delega en ellas (decisión 245) |
| Present (labs) | `scFlowOverlay` ya no excluye Present: la misma ruta en el lienzo. `#psFlow` en `#presentStory`, solo reproduciendo y con par (`scFlowPresentLine`, `present-story.js`) |
| Viewer (sin bandera) | Carga `flow-semantics.js`. Funciones `storyFlowData`, `storyFlowOverlay` y `storyFlowLine` (`viewer.js`): la ruta en el lienzo y `#stFlow` en `#stNow`, solo reproduciendo. Misma regla de existencia que la herramienta. NO_PATH: solo la línea |
| Share | Sin código: `kind` y `observedFlow` viajan con «Compartir historia»; «Sólo el diagrama» lleva `kind` y ninguna Historia (medido) |
| Exportación | Marcas en PNG/JPG/GIF (`drawEdge` con `isExport`) y en SVG (`semanticMarksToSVG`, `export.js`), con N3; overlays nunca; sin `kind`, idéntico a `6701261` (decisión 247) |
| Integridad | `validateProject.warnings` (W2 `observed_flow_endpoint_missing`, W3 `unknown_connection_kind`), solo si hay (decisión 248) |
| Autoría (kernel) | `set_observed_flow` en `FluyoAuthoring` (`story-authoring.js`), con `setObservedFlowIn` (decisión 249) |
| MCP | Ver la lista de abajo (decisión 249) |
| Docs | `docs/index.html`, solo lo factual: `kind`/`observedFlow` en el formato, las marcas en la exportación, `connectionKind`/`observedFlow`/`set_observed_flow` en el MCP; sin la bandera labs |

Cambios en el MCP:
- `kind` en zod (`ConnectionSpec`, `ConnectionPatch`, `EdgeSpec`);
- `describe_document`: `connectionKind`, `observedFlow` y `warnings`, cada uno solo si lo hay;
- `set_observed_flow` en el schema;
- `svg.ts`: port de las marcas con N3 y golden compartido;
- test de deriva;
- `sync:kernel`;
- README y descripciones de las tools.

### Archivos

- **fluyo, producto**: `js/flow-semantics.js`, `js/editor-scenarios.js`, `js/present-story.js`, `js/viewer.js`, `js/render.js`, `js/export.js`,
  `js/document-integrity.js`, `js/story-authoring.js`, `index.html`, `s/index.html`, `css/styles.css`, `css/share.css`, `docs/index.html`, `sw.js` (v100).
- **fluyo, tests nuevos**:
  - `test/fluyo-scenarios-semantics-5.test.cjs`;
  - `-5-mutations.cjs`;
  - `-5-browser.cjs`;
  - `-5-undo.cjs` (`undo5`);
  - `test/fixtures/fluyo-scenarios-semantics-5-marcas-svg.json`, el golden.
- **fluyo, tests adaptados**:
  - Literal de CACHE v99 → v100 en 62 archivos.
  - `undo5` encadenado antes de `undo4` en los alcances antiguos.
  - Las listas de archivos de los alcances de FASE 1, 2 y 3 y de STEP-REVERSE-002/003 descuentan lo que solo cambia FASE 5.
  - `viewer-harness.cjs` carga `flow-semantics.js`, como el Viewer real.
  - En `fluyo-019-4a.test.cjs`, el harness carga `edgeKind` (las marcas ya se exportan).
  - FASE 4:
    - B1 y D7 (Present y N3 al exportar, por contrato de FASE 5) y E2–E4 (con `undo5`);
    - las mutaciones U12–U16 y U27, reapuntadas a la receta o invertidas;
    - el V5 de navegador.
  - FASE 1: la mutación U17, invertida («las marcas también se exportan» es ahora lo correcto).
- **fluyo, docs**:
  - `.ai/DECISIONS.md`: 245–249, más notas en 217 y 244;
  - `.ai/ARCHITECTURE.md`;
  - `.ai/architecture/SCENARIO-SEMANTICS-001.md`: notas en D7 y D8;
  - esta tarea.
- **fluyo-mcp**:
  - `src/authoring.ts`, `src/model.ts`, `src/stories.ts`, `src/svg.ts`, `src/server.ts`, `src/generated/kernel-sources.ts`, `README.md`;
  - tests: `test/fluyo-scenarios-semantics-5.test.ts` (nuevo), `scripts/mutate-scenarios-semantics-5.ts` (nuevo) y `test/fixtures/fluyo-scenarios-semantics-5-marcas-svg.json` (copia del golden);
  - `test/fluyo-mcp-step-reverse-001.test.ts`: la cabecera del kernel ya no fija la revisión 702f269, porque cualquier resincronización la cambia; el test sigue vigilando el contenido de STEP-REVERSE.

### Pruebas

**vm de FASE 5** (`-5.test.cjs`): **19/19**.
- La receta es la de `6701261` instante a instante en 150 Historias.
- Paridad Viewer = editor en 200 Historias y con dependencia de llegada.
- Present: rótulo, fases y labs.
- Viewer: existencia, NO_PATH, ENDPOINT_MISSING, sin par, SW anterior, memoización y `renderViewerFrame`.
- Raster y SVG: sin `kind`, iguales a `6701261` en los 8 ejemplos (plano y piel); con `kind`, marcas, orden y N3.
- El golden.
- W2/W3: los ejemplos y los fixtures dan la misma salida.
- `set_observed_flow`.
- Markup, vocabulario, alcance, `undo5` y docs.

**Mutaciones**:
- fluyo: **30/30**;
- MCP: **30/30**, entre ellas la deriva de disponibilidad y de `kind` y las del kernel copiado.

**Chrome real 155** (`-5-browser.cjs`): **85/85**.
- Viewer a 1440 y 390 (dedo):
  - sin línea antes de reproducir;
  - la línea en el rótulo a 0,8 · 2,3 · 4,2 s;
  - la ruta y la línea son las del editor en el mismo instante;
  - la línea cabe entera (327 de 357 px a 390);
  - la banda mide lo mismo que en `6701261`;
  - en el lienzo, rama A terracota y rama B oliva;
  - su Present: la línea en el rótulo y el mando igual.
- Present del editor a 1440 y 390:
  - sin línea antes de reproducir;
  - la línea en el rótulo, el mando igual que en `6701261` y la ruta en el lienzo;
  - labs apagado: nada.
- Share: las dos variantes; el Viewer de `6701261` abre el enlace sin errores.
- Exportación:
  - golden;
  - N3 en el SVG;
  - el PNG con `kind` cambia solo por las marcas;
  - los 8 ejemplos: SVG (plano y construido) y PNG idénticos a `6701261`;
  - el Viewer con ejemplos, igual.
- SW v99 → v100, con el Viewer nuevo en caché.
- 0 errores de consola.

**Regresión dirigida** en un clon con commit desechable (fluyo y fluyo-mcp hermanos):
- vm: FASE 1–5, STEP-REVERSE-002/003, 019.4b, 019.4a, D6, FLOW-FADE, HIT-TEST y PRSKIN: **301/301**.
- Mutaciones antiguas: FASE 1 26/26, FASE 2 18/18, FASE 3 25/25, FASE 4 36/36, STEP-REVERSE-003 16/16.
- Navegador: FASE 4 114/114, FASE 3 47/47, 019.2 85/85 (SW y Viewer), 019.4b 49/49. No se lanzaron las 46 suites.

**vm completa, una vez**: base `6701261` **1530/83**; árbol **1549/83**, **el mismo conjunto: 0 nuevos, 0 arreglados**.
- La primera pasada encontró un fallo causado por esta tarea: el harness del Viewer no cargaba `flow-semantics.js`. Corregido y vuelto a medir.

**MCP**:
- `sync:kernel` y `check:kernel` OK;
- `npm test` **823/823** (base 809, más 14 nuevos);
- catálogo de tools: 69 073 → 71 102 caracteres, por debajo del tope de 72 000.

### Deuda y riesgos

1. **Intermitencia del arnés de FASE 4 en el navegador** (V4, «labs apagado = `ae0d619`», a 1440).
   - El lienzo medido en segundo lugar a veces queda con otro encuadre (`viewX`/`viewY` +48 px con el mismo zoom), sea la base o el árbol.
   - Se reprodujo invirtiendo el orden, así que no es de FASE 5. Pasó 114/114 dos veces seguidas.
   - Es previa y no se toca: es un fallo histórico de la suite.
2. **La línea del Viewer va en el rótulo**:
   - el rótulo crece una línea mientras se reproduce una Historia con ruta;
   - la banda y el mando no cambian;
   - el rótulo sigue bajando al pie si tapa el destino del momento (`storyPlace`).
3. **Present solo con labs** (D10): el Viewer, sin bandera, muestra más que el Present del editor con labs apagado. Es lo que dicen D7, D8 y D10; se retira con la bandera (FASE 6).
4. Sin cambios, de antes:
   - el recorte de «Automática · nombre»;
   - B9 (fixture de FASE 6);
   - la densidad a 390 con 3 filas.

### Próximo paso

Revisión del PO de FASE 5. Con su OK:
- commit en fluyo, sin `.ai/tasks/FLUYO-019.4.md` ni `.ai/tasks/FLUYO-STEP-REVERSE-003.md`;
- después, commit en fluyo-mcp (opcional: `npm run sync:kernel` desde el commit de fluyo, para que la cabecera nombre la revisión);
- push y deploy, primero fluyo; comprobar que fluyo.space sirve v100;
- desplegar el MCP.

Siguiente CACHE libre después del push: v101. FASE 6 no se empieza sin autorización.

### Publicación (2026-10-20) — CERRADA

- **fluyo**:
  - Commit `a4bbf2f` (93 archivos), push `6701261..a4bbf2f` a `origin/main`.
  - Los dos `.md` ajenos (`FLUYO-019.4.md` y `FLUYO-STEP-REVERSE-003.md`) se quedan fuera, sin commit.
  - fluyo.space sirve **v100** unos 15 s después del push. Los 14 archivos servidos que toca FASE 5 coinciden con `a4bbf2f`:
    `sw.js`, `/`, `/s/`, `/docs/`, `flow-semantics.js`, `editor-scenarios.js`, `present-story.js`, `viewer.js`, `render.js`, `export.js`,
    `document-integrity.js`, `story-authoring.js`, `styles.css` y `share.css`.
- **Smoke en producción** con Chrome real (perfil limpio, terceros bloqueados, service worker activo), a 1440 y 390: **14/14**.
  - SW v100 activo y controlando, con el código de FASE 5.
  - SVG con 12 cuñas y 1 anillo.
  - Present con labs: sin línea antes de reproducir; «Ruta no disponible» y la ruta en el lienzo a 4,2 s.
  - Share → Viewer:
    - sin línea antes de reproducir;
    - a 2,3 s, «Ruta disponible · incluye estados por defecto», entera en el rótulo;
    - rama A no disponible y B disponible;
    - la banda sigue en 64 px.
  - labs apagado: ni herramienta ni ruta.
  - 0 errores de consola.
- **fluyo-mcp**:
  - Commit `3d9cda7` (11 archivos; el kernel se resincronizó desde `a4bbf2f` y solo cambia la cabecera), push `497c81e..3d9cda7`.
  - Deploy con `deploy mcp.bat` (`gcloud run deploy fluyo-mcp --source . --region=us-central1`, proyecto `fluyo-mcp-prod`): revisión **`fluyo-mcp-00027-nxh`** con el **100 %** del tráfico (antes `fluyo-mcp-00026-nqb`).
  - `verify-deploy.sh https://mcp.fluyo.space`: **21/21**, dos veces. La espera de 60 s del `.bat` se saltó porque, sin consola, `timeout` no admite entrada redirigida; la segunda pasada se lanzó después a mano.
  - **Smoke de FASE 5 en producción: 9/9**:
    - `tools/list` con `set_observed_flow` (71 102 caracteres);
    - `create_diagram` guarda `kind`;
    - `export_diagram` con 4 cuñas y 1 anillo;
    - `describe_document` con `connectionKind`, `observedFlow` y etiquetas;
    - `set_observed_flow`;
    - W2/W3 sin invalidar.
- Esta nota de cierre se queda sin commit, como en FASE 4. Siguiente CACHE libre: **v101**. FASE 6 no se empieza sin autorización.

## FASE 6 — QA y regresión · READY FOR REVIEW (2026-10-20)

**Contexto**:
- Base: fluyo `a4bbf2f` (producción v100) y fluyo-mcp `2fc47c4` (FASE 5 + MCP-TOKEN-EFFICIENCY-003). Sin commit, push ni deploy.
- CACHE v100 → **v101**. Decisiones **250–251**.
- Las dos `.md` ajenas (`FLUYO-019.4.md`, `FLUYO-STEP-REVERSE-003.md`) no se tocan.

### Qué define FASE 6 (contrato, § 9 y D12)

- Alcance: QA del PO (con un fixture mixto SEND + SET_STATE para B9), regresión completa, documentos no semánticos, decisión de retirar la bandera y cierre de B1–B9.
- Aceptación: B1, B4, B6 y B7 verificados; B3, B5 y B8 cerrados; **B9 juzgado por el PO**. Rollback: mantener la bandera.
- La retirada de la bandera es **decisión del PO tras FASE 6** (D10). Antes hay que resolver el recorte de «Automática · nombre» (deuda de FASE 3).

### Auditoría: qué quedaba después de FASE 5

| Punto | Clase | Resultado |
|---|---|---|
| B9 (SEND en vuelo + SET_STATE que deja la ruta UNAVAILABLE) | decisión del PO | sin fixture ni test hasta ahora. Reproducido y medido (abajo). Semántica sin cambios |
| B1 (UNKNOWN nunca como disponible) | **bug real** | el pegado `fluyo::` copiaba un Behavior UNKNOWN sin validar y el documento dejaba de leerse, autoguardado incluido. Estaba en el plan de FASE 2 (§ 9) y se quedó fuera al partirla. **Corregido** (decisión 250) |
| B1, otras entradas | verificación | archivo, autoguardado, `?ejemplo=`, `#d=`, Viewer, «Añadir como página», autoría y Condiciones: ya rechazaban. Ahora con test por entrada |
| B7 | verificación | los tests anteriores no cubrían `ui.js`, `geometry.js`, `present-story.js` ni `link-codec.js`. Ahora se recorren los 48 archivos servidos |
| B3 (plantillas) | ya resuelto | `create_from_template` no recibe `kind`: sus plantillas son fijas y siguen la ruta de `create_diagram`, que lo conserva desde FASE 5 |
| B4, B5, B6, B8 | ya resuelto | cubiertos en FASE 1–5. B4 se amplía al pegar y duplicar el corpus; B8, v100 → v101 medido |
| «Automática · nombre» recortado | deuda / decisión de UX | solo bloquea la retirada de la bandera. Opciones medidas (abajo). Sin cambios |
| «Present solo con labs» | consecuencia de D10 | desaparece al retirar la bandera |
| Interruptor visible de labs | no contratado | D10 dice «sin interruptor visible hasta FASE 6», pero el contrato no define ninguno. No se inventa |
| UNKNOWN + caído / disponible en la derivación | no aplica | UNKNOWN no se persiste en el MVP (D3). Es de la tarea de UNKNOWN |

### B9 — qué significa hoy y cómo se valida

**Reproducido** con el motor, el reloj y la receta de la ruta reales (vm) y en Chrome (editor con labs, Present y Viewer, a 1440 y 390).

Fixture de la QA del PO: `test/fixtures/fluyo-scenarios-semantics-6-b9.json`.
- Es el de dos workers, con la ruta automática Cliente → BD.
- Se abre con «Abrir» (acepta `.json`) y `?labs=escenarios`.

| Historia | Qué pasa | Oráculo § T |
|---|---|---|
| 1. Cae el destino con el pedido en camino | Pedido Cola → Worker B a 2,5 s (llega a 3,6 s); Worker B cae a 3 s | **B9** dentro del vuelo |
| 2. Cae la BD con el pedido en camino | El mismo pedido; la BD cae a 3 s | **B9** dentro del vuelo |
| 3. La caída espera a que llegue el pedido | La Historia 1 con «Esperar a que llegue…» (decisión 200) | sin B9 en vuelo; **solo en el borde** |
| 4. Vuelve el destino con el pedido en camino | El pedido sale con Worker B caído (falla) y B vuelve a 3 s | **inversa**: fuera de la definición |

Lo que ve el usuario en la Historia 1 (igual en las tres superficies, medido):

| Instante | Línea | Funda Cola → Worker B | Pedido | Worker B | Mensaje |
|---|---|---|---|---|---|
| 2,9 s | Ruta disponible · incluye estados por defecto | oliva | en camino (45 %) | disponible | Worker A no está disponible |
| 3,0 s | **Ruta no disponible** | terracota + barrido | **sigue en camino** | no disponible | Worker B no está disponible |
| 3,65 s | Ruta no disponible | terracota | **llegó «completado»** (anillo verde 700 ms; «Llegó» en el registro; `completed` en `run_story`) | no disponible | Worker B no está disponible |

**Análisis de la semántica temporal**:
- Es **correcta según el contrato**:
  - T1: la ruta cambia en el instante del `SET_STATE`;
  - T2: los envíos nunca alimentan la ruta (quitar el envío deja la línea de tiempo idéntica);
  - C1: el motor decide el envío en su `at` (`scenario-engine.js`), con el destino aún disponible.
- **Es ambigua en la Historia 1**. El lienzo enseña, a la vez, un pedido que entra en un nodo ya caído dentro de una funda «no disponible» y una llegada «completada». Se puede leer como «Worker B lo recibió estando caído». La señal de éxito es débil (un anillo verde pequeño), pero el registro dice «Llegó».
- **No es engañosa en la Historia 2**: el salto llega a un nodo disponible y la ruta (que es otra cosa) no está disponible. Las dos cosas son ciertas (ruta ≠ salto).
- **La mitigación de autoría funciona**: con «Esperar a que llegue…» el cambio se ve justo en la llegada (3,6 s) y nunca con el pedido en camino. Pero la definición literal de § T, cerrada por arriba `(at, at + viaje]`, también cuenta ese borde: el cue verde de llegada coincide con el instante en que Worker B cae. El oráculo lo separa.
- **La inversa** (Historia 4) es simétrica:
  - el pedido ya «no se completó» al salir;
  - a 3 s el mensaje pasa a «Worker B vuelve a estar disponible» y la ruta a disponible;
  - el pedido se apaga en rojo al llegar a un nodo disponible.
  - § T no la incluye en B9.
- Es **preexistente** (C1 existe desde 013, sin rutas). Las fundas y el barrido de FASE 4 la hacen más visible.

**Cómo se valida** (sin cambiar la semántica, decisión 251): el oráculo en vm, el fixture y el guion de Chrome. Las capturas por instante se generan con `FLUYO_SHOTS` y quedan fuera del repo.

### Qué se implementó

| Pieza | Cambio |
|---|---|
| `js/model.js` (kernel) | `cloneStructureIn` valida los Behaviors con la regla de carga ANTES de mutar; si no, `invalid_document("behaviors")` (decisión 250) |
| `js/selection.js` | `pasteClip` atrapa ese rechazo como `dupSel`: no pega, no apila Undo ni lanza; `id_exhausted` se propaga |
| `sw.js` | CACHE v101 |
| fluyo-mcp | `sync:kernel` (solo `model.js`; `KERNEL_ID` nuevo). T8 de MCP-TOKEN-EFFICIENCY-003 comparaba hashes de respuestas que llevan el `kernelId`: ahora normaliza ese id al de la base (mismo largo) y sigue midiendo que nada más cambie |

### Archivos

- **fluyo, producto**: `js/model.js`, `js/selection.js`, `sw.js`.
- **fluyo, tests nuevos**:
  - `test/fluyo-scenarios-semantics-6.test.cjs` (14);
  - `-6-mutations.cjs` (15);
  - `-6-browser.cjs` (29);
  - `-6-undo.cjs` (`undo6`, `undo56`);
  - `test/fixtures/fluyo-scenarios-semantics-6-b9.json`.
- **fluyo, tests adaptados**:
  - CACHE v100 → v101 en 63 archivos;
  - `undo56` en lugar de `undo5` en 11 suites de alcance antiguas;
  - descuento de las piezas de FASE 6 en `-4.test.cjs` E2, `-5.test.cjs` G3 y `fluyo-step-reverse-003.test.cjs` E1.
- **fluyo, docs**: esta tarea, `.ai/DECISIONS.md` (250–251), `.ai/architecture/SCENARIO-SEMANTICS-001.md` (estado de D12 tras FASE 6).
- **fluyo-mcp**: `src/generated/kernel-sources.ts`, `test/fluyo-mcp-token-efficiency-003.test.ts`.

### Pruebas

- **vm de FASE 6: 14/14**.
  - A1: rechazo de UNKNOWN por entrada.
  - A2: el pegado, frente al bug de la base.
  - A3: el corpus pega y duplica igual que en `a4bbf2f`.
  - A4: `pasteClip`.
  - B1–B7: el oráculo B9 con el fixture, la Historia de aceptación sin B9, la semántica de § T fijada, T2, la mitigación, ruta ≠ salto y la inversa.
  - C1–C3: B7 en todos los archivos servidos, el alcance frente a `a4bbf2f` con `undo6` exacto, y el kernel del MCP.
- **Mutaciones: 15/15** (grupos A y B).
  - Las primeras versiones de M6 y M7 tenían un patrón no único (la misma línea está en `dupSel`).
  - M10 sobre `story-authoring.js` era equivalente (doble barrera con `model.js`): se mutó `model.js` y A1 comprueba Condiciones.
  - M14 y M15 se rehicieron para el caso que el fixture ejerce.
- **Regresión vm completa**, en clones desechables con commit y fluyo-mcp hermano: base `a4bbf2f` **1549 / 83 fallos**; árbol **1563 / 83**, **el mismo conjunto: 0 nuevos, 0 arreglados**.
  - La primera pasada dio un fallo causado por esta tarea: la guarda de CACHE de `fluyo-019-1` vio el literal `fluyo-static-v100` en C2. Se corrigió y se volvió a medir.
- **Dirigidas**: FASE 1–5, STEP-REVERSE-002/003, 019.4a, 019.4b, D6, FLOW-FADE, HIT-TEST y PRSKIN: 301/301. 018.7a dominio y 018.4: 41/41.
- **MCP**: `sync:kernel` y `check:kernel` OK; `npm test` **843/843**.
- **Alcance contra HEAD**: `fluyo-019-1` #15 falla en el árbol de trabajo, como cualquier alcance que lee HEAD, y pasa en el clon con commit (deuda general conocida).

### QA en Chrome (Chrome 155 real, headless, perfil limpio, SW bloqueado salvo en el smoke)

- **`-6-browser.cjs`: 29/29**.
  - **B9**, a 1440 (ratón) y 390 (dedo), las 4 Historias, en el editor con labs y en su Present, a 2,9 · 3,3 · 3,65 s: línea, funda, pedido, llegada y estado de Worker B según § T.
  - **Viewer** sin bandera: la misma ruta que el editor en el mismo instante y la misma línea.
  - **B1**: un evento de pegado real con `fluyo::`.
    - En `a4bbf2f` pega dos nodos y el documento ya no se lee.
    - En el árbol no pega, no apila Undo y no hay errores.
    - Con DOWN pega dos nodos con una entrada de Undo.
  - **SW** v100 → v101: instalada y activada, la anterior borrada, y la caché sirve el pegado nuevo.
  - 0 errores de consola.
- **Regresión de navegador**: FASE 5 85/85 (Viewer, Present, Share, exportación y SW), 018.7a (pegar y duplicar) 67 ✔ y 018.4 76/76.

### «Automática · nombre» (deuda de FASE 3; solo para retirar la bandera)

Medido en Chrome con el fixture: ancho del selector frente al que necesita «Automática · Cliente».

| Ancho | Hoy | Apilando origen y destino (cada selector a lo ancho) | Coste |
|---|---|---|---|
| 1440 | 125 / 201 px | 268 / 201 (cabe) | +22 px de herramienta |
| 768 | 119 / 249 | 256 / 249 (justo) | +28 |
| 390 | 160 / 249 | 338 / 249 (cabe) | +28 |

Con nombres largos se seguiría recortando. Es un cambio de disposición de una herramienta aprobada: no se implementa sin el PO.

### Deuda y riesgos

1. **B9**: la semántica no cambia. Si el PO la juzga engañosa, pasa a BLOCKER (D12) y hace falta una decisión de diseño:
   - cambiar el motor (decidir el envío en la llegada: otra versión del motor y del formato, kernel y MCP);
   - o una señal visual en el lienzo (la decisión 200 descartó avisos heurísticos de causalidad).
   - Ninguna cabe en FASE 6.
2. **Portapapeles**: los nodos y las conexiones de un `fluyo::` siguen sin la regla de carga (un nodo roto también dejaría el documento ilegible). No toca B1; se registra en la decisión 250.
3. **El registro del editor** dice «Llegó» en el instante de salida del envío (el Trace narrativo), antes de que el pedido llegue. Es preexistente y forma parte de C1.
4. **El MCP** necesita un deploy para que su kernel sea el de v101. El cambio no altera ninguna respuesta (`duplicate_node` copia Behaviors ya válidos), solo el `kernelId`.
5. **Intermitencia previa** del V4 de FASE 4 en el navegador (FASE 5, deuda 1): no se tocó.
6. Arrastrada: densidad de la herramienta a 390 con 3 filas.

### Para el PO (el punto exacto de revisión)

1. **Veredicto de B9**, con el fixture (Historias 1 y 2):
   - (a) **aceptable**: se queda como HIGH y el patrón de autoría «Esperar a que llegue…» es la respuesta (se documenta para autores);
   - (b) **engañoso**: pasa a BLOCKER y se abre una tarea de diseño (motor o señal visual); la bandera no se retira hasta entonces.
2. **Alcance de la definición**: ¿el borde (cambio en el mismo instante que la llegada, Historia 3) cuenta como B9? El oráculo lo separa; la definición literal lo incluye.
3. **La inversa** (Historia 4): ¿entra en el juicio de B9 o se queda fuera, como dice § T?
4. **Retirar la bandera**: ¿sí o no tras el veredicto? Si es sí, antes hay que elegir cómo resolver «Automática · nombre» (apilar, medido arriba, u otra opción).

```
SEMANTIC SCENARIOS — FASE 6 (QA y regresión)
BASE:      fluyo a4bbf2f (= origin/main, producción v100) · fluyo-mcp 2fc47c4
ESTADO:    READY FOR REVIEW · sin commit, push ni deploy
CACHE:     v101 · DECISIONES: 250–251
FASE 6:    vm 14/14 · mutaciones 15/15 · Chrome 29/29 (1440 y 390)
SUITE:     1563 / 83 fallos (base 1549 / 83) · 0 nuevos
MCP:       sync:kernel · check:kernel OK · 843/843
PO:        veredicto B9 (+ borde e inversa) · retirar la bandera (+ «Automática · nombre»)
```

### Cierre del PO (2026-10-20) — APPROVED WITH CHANGES · cambios aplicados · READY FOR REVIEW

Veredicto del PO:

1. **B9 ACEPTADO**, no es BLOCKER; se queda en HIGH. La semántica del motor es correcta y no cambia (ni FASE 4/5). Hay que documentar
   el caso y la mitigación.
2. **Historia 3 (borde)**: SÍ es B9, porque la ventana `(at, at+viaje]` es cerrada por arriba. Debe quedar cubierta en el test.
3. **Historia 4 (inversa)**: NO es B9. Se documenta como deuda o caso futuro, sin tarea ni cambio de semántica.
4. **«Automática · nombre»**: apilar origen y destino en anchos estrechos y mantener la fila cuando hay espacio. Validar a 390, 768 y 1440.
5. **Retirar `?labs=escenarios`**: SÍ, después del punto 4. Scenario Semantics queda habilitado por defecto.

**Qué se hizo**:

| Punto | Cambio |
|---|---|
| 1 | Decisión 251 reescrita (ACEPTADO, HIGH; semántica fijada). § T y D12 del registro, con el veredicto. `docs/index.html` («Conexiones»): dónde se elige el tipo; qué es la ruta observada; «la ruta cambia en el instante en que un nodo cambia de estado; un envío se decide al salir…»; «Esperar a que llegue…» como mitigación |
| 2 | El oráculo (`-6.test.cjs`, B1) mete el borde en `b9` con `boundary: true`. La Historia 3 da `{changeAt: 3600, arrival: 3600, boundary: true}`. En Chrome se mide también a 3,6 s: la llegada «completada» y la caída de Worker B en el mismo instante |
| 3 | La inversa se cuenta en `inverse`, nunca en `b9`, con el motivo en el test. En Chrome: «NO es B9: el envío ya había fallado al salir» |
| 4 | `css/styles.css`: `.scFlow` es su propio contenedor; `@container scflow (max-width: 539px)` apila los dos selectores a todo el ancho, con la flecha en vertical (↓). Sin cambios de marcado, de textos ni de interacción (decisión 252) |
| 5 | `ui.js`: fuera `LABS_SEMANTICS` (ni URL ni almacenamiento); «Semántica» y W5 en toda conexión. `editor-scenarios.js`: fuera `scFlowLabs`; la herramienta y la ruta en el lienzo y en Present, sin bandera. Comentarios de `index.html`, `render.js` y `present-story.js` (decisión 253) |

**Por qué la herramienta también se apila a 1440**:
- El PO pidió mantener la fila «cuando haya espacio».
- La condición mira el ancho de la herramienta, no el de la ventana. El panel mide unos 290 px en escritorio, y con la fila «Automática · Cliente» no cabe (125 px de 201).
- Con 540 px o más (forzado en el test), vuelve la fila de siempre.

Medido con el selector cerrado (texto + márgenes + flecha del selector):

| Ancho | Herramienta | «Automática · Cliente» | «Automática · BD» | Alto |
|---|---|---|---|---|
| 390 (dedo, hoja) | 358 px | 249 / 338 | 201 / 338 | 236 px |
| 768 (dedo, panel) | 276 px | 249 / 256 | 201 / 256 | 248 px |
| 1440 (ratón) | 288 px | 201 / 268 | 165 / 268 | 238 px |

A 768 el margen es el más justo (7 px). Un nombre de nodo largo puede seguir recortándose; se ve entero en la lista nativa y en el `title`.

**Tests adaptados a la bandera retirada**. Fijaban «sin bandera = editor de siempre» y ahora fijan «con o sin el valor antiguo, lo mismo»:
- `-1.test.cjs`: D10, el markup del selector y W5 ×2.
- `-3.test.cjs`: C1.
- `-4.test.cjs`: B1.
- `-5.test.cjs`: B1 y B2.
- Chrome: `-3-browser` V5, `-4-browser` V4 y `-5-browser` V2. Comparan sin parámetro, con `?labs=escenarios` y con `?labs=off`; en FASE 4, el lienzo editando sigue igual a la base.
- Mutaciones de la bandera:
  - FASE 1, U11 y U19, y FASE 3, U15: ahora la vuelven a poner.
  - FASE 1, U12 (`?labs=off`): retirada, ya no tiene objeto.
  - FASE 4, U11: retirada, equivalente sin bandera.
- Alcances: `undo6` regenerado para los 9 archivos servidos (con los hunks vecinos fusionados). Se descuenta en `-3` D3 y `step-reverse-002` I3.

### Batería final (2026-10-20) — DETENIDA: regresión real en 018.23 (sin arreglar, a la espera del PO)

**Regresión real**: la retirada de la bandera (decisión 253) deja «Semántica» a la vista en toda conexión. En la columna de Propiedades,
esa fila (unos 55–60 px, con la etiqueta encima) empuja «Puntas» y «Sentido de los puntos» fuera de la primera pantalla. Eso rompe el
contrato de 018.23 en escritorio bajo:

| Viewport | Comprobación de 018.23 | Base `a4bbf2f` | Árbol |
|---|---|---|---|
| 1280×720 (ratón) | flowDir y puntas en la primera pantalla | ✔ | **✘** |
| 1024×768 (ratón) | flowDir y puntas en la primera pantalla | ✔ | **✘** |
| 1280×720 | conexión con puntos: pantallas (≤ 1,0) | ✘ 1,06 (preexistente) | ✘ 1,16 |
| 1024×768 | conexión con puntos: pantallas (≤ 1,05) | ✘ 1,10 (preexistente) | ✘ 1,19 |
| 768×1024 (dedo) | conexión con puntos: pantallas (≤ 1,0) | ✔ 1,00 | **✘ 1,05** |
| 1440×900, 390×844 | — | ✔ | ✔ |

La sección § Autoría del registro ya lo avisaba: «columna estrecha… hoja móvil… sin rediseño salvo problema medido». Ahora está medido.
**No se ha tocado nada**: es una decisión de disposición de Propiedades.

**Opciones para el PO** (ninguna implementada):
- (a) «Semántica» en una sola línea (etiqueta y segmentado en la misma fila, como Ruta o Puntas, `inlineSeg`), con apilado solo bajo 240 px;
- (b) mover «Semántica» detrás de «Puntas» y «Sentido» (deja de ser la primera fila de «Trazo», § Autoría);
- (c) aceptar el desborde y relajar el umbral de 018.23.

**Resto de la batería** (verde o ya clasificado):
- **Chrome, base frente a árbol** (15 suites):
  - mismos resultados en FASE 3 (47/47), FASE 5 (85/85), 018.12 (6 fallos, los mismos en la base), 018.13, 018.14b, 018.17, 018.18, 018.24, 018.27, 019.2, 019.4b, STEP-REVERSE-003 (68/68) y 018.7a (67/67).
  - **FASE 4**: el árbol falló en V4 a 390 con la primera versión del test adaptado: la hoja de Historias crece al aparecer la herramienta sin bandera, así que el lienzo visible deja de ser el de la base. Clase (b), por el cambio sin commit. Con el test corregido, **117/117**.
- **Bandera**:
  - sin parámetro, `?labs=escenarios`, `?labs=off` y la clave antigua guardada dan lo mismo (`-6-browser`, FLAG, 1440 y 390).
  - En el código servido solo quedan dos comentarios históricos.
  - En los tests: el arnés vm que inyecta el valor antiguo (y prueba que no cuenta), suites que abren con `?labs=escenarios` (parámetro ignorado), mutaciones que vuelven a poner la bandera y el texto base de `undo6`. Ninguna dependencia funcional.
- **B9**:
  - Historia 3 = B9 en el borde (`changeAt` = `arrival` = 3600, `boundary: true`, test B1 vm y Chrome a 3,6 s).
  - Historia 4 fuera de B9 (`inverse`, nunca `b9`).
  - Motor sin cambios.
  - Caso documentado en la decisión 251, en § T y en `docs/index.html`.
- **«Automática · nombre»**: QA visual en contexto (panel o hoja completos, editando y reproduciendo) a 390, 768 y 1440. Origen y destino enteros, apilados, dentro de la herramienta, sin desborde del panel ni de la página. Las únicas cajas recortadas son las etiquetas `.srOnly`, a propósito.
- **Mutaciones**: FASE 1 25/25 · FASE 2 18/18 · FASE 3 25/25 · FASE 4 35/35 · FASE 5 30/30 · FASE 6 20/20.
  - U11 de FASE 4 («el lienzo recibe la ruta sin la bandera») dejó de ser válida: lo que detectaba es ahora el comportamiento pedido.
  - Sin bandera, quitar `scFlowShown` de `scFlowOverlay` es equivalente: sin Flujo no hay par ni ruta, y sin eventos no hay reproducción.
  - La regresión contraria (que la ruta vuelva a depender de la bandera) la capturan FASE 6 M16, FASE 3 U15 (C1, vm con el valor antiguo) y FASE 4 B1 (vm: sin y con el valor antiguo, la misma ruta), además de FLAG en Chrome.
- **vm completa**, en clones con commit: árbol **1565 / 83** frente a base **1549 / 83**, **el mismo conjunto: 0 nuevos**.
- **MCP**: `check:kernel` OK (idéntico a `fluyo/js`) · `npm test` **843/843**.

**Estado**: NO READY FOR COMMIT mientras no se resuelva 018.23. Sin commit, push ni deploy.

### Opción (a) del PO para 018.23 — probada y DETENIDA (2026-10-20): no cabe sin sacrificar algo; intento deshecho

Se probó «Semántica» en una línea con el patrón de Ruta y Puntas (`row inlineSeg`; el segmentado a su ancho natural; bajo 240 px se apila
con la regla común). Luego se **deshizo**: el árbol vuelve exactamente al estado verificado (undo6 exacto, vm FASE 1 + FASE 6 37/37).

Medido en Chrome, con una conexión con puntos en movimiento. «Margen» es lo que queda bajo «Sentido de los puntos» en la primera
pantalla de Propiedades.

| Viewport | Ancho de Propiedades | Margen en la base (sin la fila) | Fila «Semántica» hoy (apilada) | Margen en el árbol | En una línea |
|---|---|---|---|---|---|
| 1280×720 | 256 px | 57 px | 61 px | −3 px | **no cabe**: la etiqueta y las tres palabras piden unos 290 px; «Requisito» pasa a otra línea y la fila mide 64 px |
| 1024×768 | 192 px | **31 px** | 61 px | −30 px | **imposible**: bajo 240 px la regla común apila ya Ruta y Puntas; y aunque cupiera, una fila de una línea mide unos 38 px con su margen, más que los 31 disponibles |
| 768×1024 | 192 px | 149 px | 77 px | 72 px | se apila (columna estrecha); Sentido sigue a la vista |
| 1440×900 | 256 px | 237 px | 61 px | 177 px | — |

Conclusión: con las restricciones del PO (primera fila de «Trazo», sin cambiar textos, sin truncar, sin perder legibilidad), 018.23
**no se puede cumplir a 1024×768**. A 1280×720 cabría una fila de una línea (unos 38 px de 57), pero no la de «etiqueta + tres palabras»
en 256 px sin reducir la letra o el relleno de los botones. Hace falta una nueva decisión del PO.

### Decisión final del PO para 018.23 (2026-10-20) — «Semántica» en «Puntos» · aplicada · READY FOR COMMIT

**Decisión del PO** (después de medir las opciones (a), el final de «Trazo» y el final de «Dirección»):
- «Semántica» puede salir de «Trazo».
- No se relaja 018.23.
- La fila va en un grupo que ya viene plegado para las conexiones: **«Puntos»**.

**Cambio**:
- `index.html`: `#rowKind` y el aviso W5 (`#kindNote`, justo detrás) son la primera fila de `grpFlow`.
- Nada más en producto. Sin cambios en textos, controles, Undo, teclado ni contrato.
- El orden de grupos es el mismo en todos los anchos: Trazo · Dirección · Puntos · Texto.
- Decisión 254.

**Tests**:
- FASE 1: el markup del selector y W5 pasan a «Puntos». U13 y U24 solo se renombran.
- FASE 6:
  - nuevo D3: primera fila de «Puntos», W5 detrás, ausente de Trazo y Dirección, «Puntos» plegado en `primaryGroups`;
  - mutaciones nuevas M21 («Puntos» abierto por defecto) y M22 («Semántica» vuelve a «Trazo»).
- `undo6` regenerado.
- FASE 4, V4 (`-4-browser.cjs`): la comparación entre cargas esperaba la carrera del arranque, `setTimeout(centerView, 100)` en `state.js`. El encuadre sale 32,107 u 80,155 al azar en todas las versiones (medido: árbol, árbol sin la 254 y `a4bbf2f`). Es la deuda 1 de FASE 5. El arnés ahora espera y centra igual en las tres cargas. Desde entonces, 117/117 en cuatro pasadas seguidas.

**QA del PO en Chrome** (conexión con puntos en movimiento):

| Viewport | Puntas · Sentido (1ª pantalla) | Pantallas (= base) | «Semántica» plegada | Abierta: «Conexión · Flujo · Requisito» |
|---|---|---|---|---|
| 1280×720 | ✔ ✔ | 1,06 = 1,06 | no se pinta | 86 · 67 · 93 px, enteras; teclado y Undo ✔ |
| 1024×768 | ✔ ✔ | 1,10 = 1,10 | no se pinta | 65 · 45 · 72 px, enteras ✔ |
| 768 (dedo) | ✔ ✔ | 1,00 = 1,00 | no se pinta | 44 px de alto, enteras ✔ |
| 390 (dedo, hoja) | (acordeón) | 1,05 | no se pinta | 120 · 101 · 127 px, enteras ✔ |
| 1440 | ✔ ✔ | 1,00 = 1,00 | no se pinta | enteras ✔ |

**Cifras finales**:
- **018.23 en Chrome**: el árbol es igual a la base (211 ✔ · 2 ✘ en las dos). Los 2 ✘ son «conexión con puntos: pantallas» a 1280 (1,06) y 1024 (1,10): ya fallaban en `a4bbf2f`. Clase (a), preexistente. «Puntas y Sentido en la primera pantalla» vuelve a pasar en todos los anchos.
- **Chrome, base frente a árbol**: mismos resultados en 018.12 (6 ✘ preexistentes), 018.13, 018.14b, 018.17, 018.18, 018.24, 018.27, 019.2, 019.4b, STEP-REVERSE-003 (68/68), 018.7a (67/67), FASE 3 (47/47) y FASE 5 (85/85). FASE 4: 117/117 (×4). FASE 6: 52/52.
- **vm**:
  - FASE 6 17/17.
  - Dirigidas FASE 1–6, STEP-REVERSE-002/003 y 019.x: todas en verde.
  - 018.23/24/27 vm: solo fallan sus alcances contra HEAD y su «CACHE v84», como en cualquier árbol sin commit.
  - **Completa en clones con commit: árbol 1566 / 83 frente a base 1549 / 83, el mismo conjunto: 0 nuevos, 0 arreglados.**
- **Mutaciones**: FASE 1 25/25 · FASE 2 18/18 · FASE 3 25/25 · FASE 4 35/35 · FASE 5 30/30 · **FASE 6 22/22**.
- **MCP**: `check:kernel` OK · `npm test` 843/843.

**Deudas que quedan** (ninguna bloquea):
1. El aviso W5 vive ahora en un grupo plegado: se ve al abrir «Puntos» (consecuencia aceptada de la decisión 254).
2. 018.23 «pantallas» a 1280 y 1024: preexistente, como en la base.
3. La carrera de `setTimeout(centerView, 100)` del arranque sigue en el producto, aunque es inocua: el arnés de V4 ya no depende de ella.
4. La inversa de B9 queda como caso futuro (decisión 251).
5. Un nombre de nodo muy largo puede recortarse en la herramienta de la ruta (decisión 252).
6. Los nodos y las conexiones de un portapapeles `fluyo::` siguen sin la regla de carga (decisión 250).

**Estado: READY FOR PUSH** (2026-10-21). El PO aprobó el commit; se hizo un único commit en fluyo con esta nota dentro. Sin push ni deploy. fluyo-mcp (kernel resincronizado y T8) queda sin commit, para su propio commit cuando el PO lo pida.

Al hacer commit:
- fluyo primero, **sin** `.ai/tasks/FLUYO-019.4.md` ni `.ai/tasks/FLUYO-STEP-REVERSE-003.md`;
- después fluyo-mcp: `src/generated/kernel-sources.ts` y `test/fluyo-mcp-token-efficiency-003.test.ts`. Opcional: `npm run sync:kernel` desde el commit de fluyo para que la cabecera nombre la revisión.
- Después de push y deploy, la siguiente CACHE libre será la v102. El MCP necesita deploy para alinear su kernel.

## Handoff

### Estado tras FASE 6 (2026-10-20)

READY FOR PUSH (2026-10-21): commit único de FASE 6 en fluyo (sin `.ai/tasks/FLUYO-019.4.md` ni `.ai/tasks/FLUYO-STEP-REVERSE-003.md`). Próximo paso, con el OK del PO: push de fluyo y comprobar que fluyo.space sirve v101; después, commit, push y deploy de fluyo-mcp (kernel de v101). Siguiente CACHE libre: v102.

### Estado tras FASE 5 (2026-10-20)

```
SEMANTIC SCENARIOS — FASE 5 (paridad de superficies)
BASE:      fluyo 6701261 (= origin/main, producción v99) · fluyo-mcp 497c81e
ESTADO:    CERRADA · fluyo a4bbf2f (fluyo.space v100, smoke 14/14) · fluyo-mcp 3d9cda7 desplegado (§ «Publicación» de FASE 5)
CACHE:     v100 · DECISIONES: 245–249
FASE 5:    vm 19/19 · mutaciones 30/30 (fluyo) + 30/30 (MCP) · Chrome 85/85 (1440 y 390)
DIRIGIDAS: 301/301 · mutaciones antiguas 26 + 18 + 25 + 36 + 16 · navegador FASE 4 114/114, FASE 3 47/47, 019.2 85/85, 019.4b 49/49
SUITE:     1549 / 83 fallos (base 1530 / 83) · 0 nuevos
MCP:       sync:kernel · check:kernel OK · 823/823 · catálogo 71 102 (< 72 000)
```

### Estado tras la auditoría de FASE 5 (2026-10-20; histórico)

```
SEMANTIC SCENARIOS — FASE 5 (paridad de superficies)
BASE:      fluyo 6701261 (= origin/main, producción v99) · fluyo-mcp 497c81e
ESTADO:    BLOCKED · auditoría hecha · sin código (revertido) · sin commit, push ni deploy
BLOQUEO:   la línea de estado de la ruta no cabe a 390 px en la banda del Viewer (19 px libres) ni en #psGroup (mando en su tope de 374 px)
DECIDIR:   1) ubicación en pantallas estrechas (a / b / c; recomendada b) · 2) Present antes de reproducir (recomendado: solo reproduciendo)
```

### Próximo paso concreto (FASE 5; histórico: el PO eligió (b) y «solo reproduciendo»)

1. El PO responde las decisiones 1 y 2 de § «FASE 5 — Auditoría» (y, si quiere, corrige alguna de las menores).
2. Con eso se implementa FASE 5 completa, como dice esa sección: código, pruebas vm, mutaciones, Chrome a 1440 y 390, MCP. CACHE v100.
   Termina en READY FOR REVIEW, sin commit.

### Estado tras FASE 4 (2026-10-20)

```
SEMANTIC SCENARIOS — FASE 4 (Scenario Experience)
BASE:      fluyo ae0d619 (= origin/main, producción v98) · fluyo-mcp 497c81e (sin cambios)
ESTADO:    CERRADA · 6701261 en origin/main · fluyo.space sirve v99 · smoke de producción 24/24
CACHE:     v99 · DECISIONES: 241–244 (cerradas)
FASE 4:    vm 35/35 · mutaciones 36/36 · Chrome 114/114 (1440 y 390, claro/crema/oscuro con y sin piel, recuento, labs off = v98, Present, reducir movimiento, SW v98 → v99)
DIRIGIDAS: 282/282 · mutaciones antiguas 26 + 18 + 25 + 16 · navegador FASE 3 47/47, 019.4b 49/49, 019.2 85/85
SUITE:     1530 / 83 fallos (base 1495 / 83 en el mismo entorno) · 0 nuevos
```

### Próximo paso concreto

1. Commit hecho (sin `.ai/tasks/FLUYO-019.4.md` ni `.ai/tasks/FLUYO-STEP-REVERSE-003.md`); fluyo-mcp no cambia.
2. Push y deploy hechos: fluyo.space sirve v99 (§ «Publicación»). Siguiente CACHE libre: v100.
3. FASE 5 y FASE 6 no se empiezan sin autorización.

### Estado tras FASE 3 (2026-10-20; histórico)

```
SEMANTIC SCENARIOS — FASE 3 (Story Observed Flow)
BASE:      fluyo 16ee642 (= origin/main, producción v95) · fluyo-mcp 9ad8147
ESTADO:    READY FOR COMMIT · QA del PO: PASS (49/49, 1440 y 390) · sin commit · sin merge · sin push · sin deploy
CACHE:     v96 · DECISIONES: 230–233
FASE 3:    vm 35/35 · mutaciones 25/25 · Chrome 47/47 (1440 y 390, labs off = v95, SW v95 → v96)
FASE 1/2:  21/21 + 33/33 · mutaciones 26/26 + 18/18
SUITE:     1447 / 81 fallos (base 1412 / 83 en el mismo entorno) · 0 nuevos
NAVEGADOR: 019-2 85/85 · 019.4b 49/49 (dirigido; no las 46 suites)
MCP:       sync:kernel · check:kernel OK · 757/757 (sin commit)
```

### Próximo paso tras FASE 3 (histórico; cumplido en `544fd4b`, publicado en v96)

FASE 3 está **aprobada por el PO** (QA del 2026-10-20, § FASE 3 · QA del PO).

1. Con el OK de commit:
   - un commit en fluyo con los archivos de § FASE 3, sin `.ai/tasks/FLUYO-019.4.md` ni `.ai/tasks/FLUYO-STEP-REVERSE-001.md`;
   - otro en fluyo-mcp con `src/generated/kernel-sources.ts` (opcional: `npm run sync:kernel` desde el commit de fluyo para que la
     cabecera nombre la revisión).
2. Después, push de los dos (primero fluyo) y comprobar que fluyo.space sirve v96. Siguiente CACHE libre: v97.
3. Deuda no bloqueante: el recorte de «Automática · nombre», antes de retirar la bandera.
4. FASE 4, 5 y 6 no se empiezan sin autorización.

### Estado al reintegrar (2026-10-19; histórico)

```
SEMANTIC SCENARIOS — REINTEGRACIÓN
BASE:      0409f4d (main = origin/main, producción v93)
RAMA:      feat/scenario-semantics-integration (sin commit; staged en el worktree fluyo-scenario-integration)
FASE 1:    integrada · 21/21 · 26/26
FASE 2:    integrada · 33/33 · 18/18
CACHE:     v94 · DECISIONES: 214–225
MCP:       efb316f sin cambios · check:kernel OK · 747/749 (los 2 = brecha previa de la piel)
SUITE:     1400 / 82 fallos = línea base · 0 nuevos
QA:        48/48 Chrome real · 019-2-browser 85/85
ESTADO:    READY FOR INTEGRATION / MERGE — esperando aprobación del PO (sin merge ni push)
```

### Próximo paso al reintegrar (histórico; cumplido en `eff5129`)
Con la aprobación del PO:
1. Commit en `feat/scenario-semantics-integration` (o directo sobre `main`).
2. Merge en `main`.
3. En fluyo-mcp, `efb316f` en `main` a la vez. Opcional: `npm run sync:kernel` desde el commit de fluyo para que la cabecera
   nombre la revisión nueva; el contenido es idéntico.
4. Push de los dos y comprobar que producción sirve v94.

FASE 3 sigue sin autorizar.

### Estado al congelar (decisión del PO; histórico)

```
SEMANTIC SCENARIOS PRODUCT LINE
BASE:                 ce8e699
CURRENT PRODUCT MAIN: d4fb06d
FASE 1:               59588a9  READY_FOR_FINAL_REINTEGRATION
FASE 2:               ca08fc1  IMPLEMENTED / VERIFIED
MCP:                  efb316f  VERIFIED
CURRENT LINE:         FROZEN
PUSH: NO · MERGE: NO · FASE 3: NOT STARTED
NEXT:                 WAIT FOR PRODUCT MAIN INTEGRATION WINDOW
```

- FASE 0: hecha.
- FASE 1 (`59588a9`; fluyo-mcp `efb316f`): C1–C3 resueltos. Semánticos 21/21, mutaciones 26/26. Suite: 1323 tests, 81 fallos
  de la línea base, 0 regresiones nuevas. Chrome: Editor → Present → Share → Viewer, labs OFF, responsive, W5, service worker
  v90 → v92 y V4: PASS. Sin trabajo funcional pendiente.
- FASE 2 (`ca08fc1`): semánticos 33/33, mutaciones 18/18. Suite: 1356 tests, 81 fallos de la línea base, 0 regresiones
  nuevas. Equivalencia semántica con `94e50fa`: PASS (80 000 llamadas diferenciales + testigos dirigidos, 0 diferencias). Sin
  trabajo funcional pendiente.
- MCP (`efb316f`): `check:kernel` OK, 748/748.
- Referencias históricas, sin tocar y sin borrar: fluyo `4fb5872`, `e47500f`, `94e50fa` (rama `feat/scenario-semantics`);
  fluyo-mcp `63d97b8`. La línea nueva es la candidata de producto; la anterior queda como evidencia.
- `main` avanzó durante la reconstrucción: `ce8e699` → `a000756` → `d4fb06d` (FLUYO-019-HIT-TEST-D6, `CACHE` v91, decisión
  212). Contra `d4fb06d`: 55 conflictos mecánicos (`sw.js`, 52 constantes de caché en tests, `.ai/ARCHITECTURE.md`,
  `.ai/DECISIONS.md`) y 0 conflictos de código JS. No hay colisión de `CACHE` (v92) ni de decisiones (213–224). Por decisión
  del PO, la línea **no** se reintegra ahora y queda congelada: sin rebase, merge, cherry-pick ni amend, sin cambiar `CACHE` ni
  renumerar.
- Verificación pendiente solo para la integración final: el upgrade del service worker desde la versión de `main` en ese
  momento (hoy v91) a la nueva.

### Próximo paso al congelar (histórico; cumplido en § «Reintegración sobre `0409f4d`»)
Esperar a que producto abra la ventana de integración. Gate de la reintegración final, una sola vez:
1. `main` limpio; D6 y trabajos relacionados integrados; sin cambios ajenos sin commit en los archivos afectados.
2. Tomar su HEAD como base y medir su línea base.
3. Reaplicar FASE 1 + FASE 2 una vez y resolver los conflictos mecánicos.
4. `CACHE`: la siguiente libre respecto a ese `main` (v92 si sigue libre). Decisiones: resolver solo si `main` reclamó alguna
   de 213–224.
5. Suite completa, 0 regresiones nuevas.
6. Service worker: `CACHE` actual de `main` → la nueva.
7. Repetir V4 (regresión visual de los 8 ejemplos).
8. Revisión del PO de producto; después, decidir el merge.

FASE 3 (cablear `FluyoFlow` en el editor, `observedFlow`, Condiciones con `{initialState:"UP"}`, herramienta de ruta,
timeline, overlays, comportamiento de ruta en Viewer/Present, autoría de UNKNOWN) no se empieza sin autorización del PO.
