# FLUYO-018.4 — Política UX de borrado e integridad de Historias (editor)

Estado: **READY FOR COMMIT** (sin commit, push, deploy ni bump de sw.js). Decisiones aprobadas por el responsable: B, Behavior con el nodo, `confirm()` nativo con mensaje informativo (ver «Resultado»).
Continúa 018.3 (decisiones 71, 75, 89, 90; «Para 018.4» de `FLUYO-018.3.md`).

> Repo público: nada de este documento es confidencial.
> Bootstrap leído: `ARCHITECTURE.md`, `DECISIONS.md`, `FLUYO-018.md` §18/§21, `FLUYO-018.3.md`, `document-integrity.js`, `model.js` (`deleteNodeIn`/`deleteConnectionIn`), `selection.js` (`deleteSel`, Undo), `state.js`, `editor-scenarios.js` (panel, Behaviors, `scRun`), `scenario-engine.js` (referencias), `share-url.js`, `viewer.js`, `interaction.js` (tecla Supr).

## 1. Problema actual

El editor permite borrar un elemento o una conexión que una Historia usa, sin avisar y sin tocar la Historia. Resultado: Steps huérfanos y, además, **Behaviors huérfanos**. MCP, en cambio, rechaza ese mismo borrado (B2). Un usuario puede dejar su documento en un estado que el kernel considera inválido, sin enterarse.

Hallazgo nuevo respecto a lo documentado en 018.3 (verificado leyendo `scenario-engine.js` y `editor-scenarios.js`): el **Behavior huérfano es peor que el Step huérfano**.

| | Step huérfano | Behavior huérfano |
|---|---|---|
| Alcance del fallo | solo la Historia que lo usa | **todas las Historias de la página** (`missing_behavior_node` es un error de página; el motor no arranca ninguna) |
| ¿Se ve en el editor? | sí: la fila dice «El elemento/La conexión de este evento ya no existe» (`scIsTargetMissing`) | **no**: «Condiciones» (`scRenderBehaviors`) itera `P().nodes`; el nodo ya no está, así que la fila no existe |
| ¿Se puede arreglar desde la UI? | sí: borrar el momento o «Cambiar dónde ocurre…» | **no**: no hay ningún control que lo elimine |
| Share/Viewer | el Viewer falla al reproducir | ídem, para toda la página |

Solo hay Behavior cuando el nodo está en «No disponible» de partida (UP es implícito, sin Behavior).

## 2. Comportamiento de HEAD (editor)

- Todas las vías de borrado convergen en `deleteSel` (`selection.js:73`): botón, menú contextual (`mDel`), botón táctil, tecla Supr/Retroceso y Cortar (`cutSel`). Un solo punto de intercepción.
- `deleteSel` → `pushUndo()` → `removeEdges` + `removeNodes` (`state.js:28-29`) → `deleteConnectionIn`/`deleteNodeIn(…, {keepBehaviors:true})`. Quita nodo + conexiones incidentes. No toca Behaviors, Steps ni Historias, y no consulta `FluyoIntegrity`.
- Con Playback activo, Supr no hace nada (`interaction.js:876`).
- No hay confirmación de borrado de elementos. Sí hay `confirm()` nativo para «Eliminar historia» (`scDeleteScenario`), «Limpiar página» y «Eliminar página» (`ui.js`).
- Undo: `snapPage()` = copia profunda de la página (`nodes, edges, behaviors, scenarios`). Un `pushUndo` por gesto de borrado.

## 3. Comportamiento de MCP

`author_document` con `delete_node`/`delete_connection`: no comprueba al ejecutarse; valida el **estado final** y, si una Historia queda inválida, rechaza todo el lote con `REFERENCED_ENTITY` (entidad, Historias, Steps, operación, `cascadedFrom`). Retargetear/quitar pasos y borrar en el mismo lote es válido. `delete_node` **sí** quita el Behavior del nodo (cascada informada en `changes[].cascade`). Nunca borra Steps ni Historias.

## 4. Opciones

### A. Bloquear
«No puedes borrar este elemento porque lo usa la Historia X.»

- **+** Es exactamente MCP; cero estados inválidos; implementación mínima; sin diálogo con decisiones.
- **−** Para un humano con el lienzo delante es un callejón sin salida: debe ir a cada Historia, borrar o redirigir los momentos y volver. Con selección múltiple (Ctrl+A → Supr) bloquea todo el borrado por un solo uso. «Cortar» queda bloqueado. Convierte la limpieza de un diagrama en una tarea de mantenimiento de Historias. Impide el caso legítimo «este elemento ya no existe en mi sistema; la Historia que lo contaba también está obsoleta».
- La razón por la que MCP rechaza (el agente no ve el resultado y actúa por lotes sin Undo) **no aplica** al editor: el humano ve el efecto y tiene Undo.

### B. Confirmar
«Este elemento se usa en 2 Historias. Si lo borras, esas Historias dejarán de funcionar.» [Cancelar] [Eliminar igualmente]

- **+** Respeta la Historia como capa explícita (no se modifica nada que el usuario no haya aceptado); informado; reversible con Undo; el usuario conserva el control del orden de trabajo; un solo gesto en el caso común (borrar algo que ninguna Historia usa) sin fricción alguna.
- **−** Permite dejar Historias rotas a propósito. Mitigación: las filas rotas ya se ven y se pueden reparar (retargetear/eliminar el momento); Undo deshace todo.
- Matiz: «dejarán de funcionar» es cierto pero poco accionable; mejor nombrar las Historias y cuántos momentos, y decir qué ocurre («esos momentos quedarán sin destino; podrás reasignarlos o eliminarlos»).

### C. Eliminar y limpiar automáticamente
Quitar el elemento y los Steps afectados.

- **+** Documento siempre válido.
- **−** Modifica la Historia sin que el usuario la haya tocado: contradice la preferencia expresada y la decisión 29 («no hay eliminación en cascada de eventos en uso») y la 89 («nada se limpia en silencio»). Quitar un Step cambia el ritmo narrativo (`storyboardCollapsedGroups` colapsa esperas); borrar el último Step vacía una Historia; en Historias múltiples el daño se reparte sin verse. Aunque haya Undo, el usuario no ve qué cambió.

### D. Otras alternativas valoradas
- **D1 — B + reparación guiada** («Eliminar y reasignar…»): al confirmar, ofrecer elegir otro destino. Es una funcionalidad nueva de producto (UI de selección de destino); fuera de alcance y no necesaria: «Cambiar dónde ocurre…» ya existe por Step.
- **D2 — Marcar Steps como «sin destino» en el modelo** (huérfano explícito y reparable). Cambia el modelo/schema: **prohibido en este slice**.
- **D3 — B con aviso no modal (toast «Se usaba en…» + Deshacer)**: borra primero y avisa después. Más fluido, pero la información llega tras el daño y el toast es fácil de perder; peor para selección múltiple y táctil.
- **D4 — Confirmación solo cuando hay impacto + cascada del Behavior propio del nodo (variante de B).** Ver recomendación.

## 5. Propuesta recomendada: **B (con la variante D4)**

1. **Confirmar solo si hay impacto.** Antes de borrar, calcular el impacto del borrado (ver plan §13). Sin Historias afectadas → se borra como hoy, sin diálogo ni fricción.
2. **Con impacto** → diálogo con las Historias y cuántos momentos de cada una; [Cancelar] [Eliminar igualmente]. Cancelar = no cambia nada (ni siquiera `pushUndo`). Eliminar = un `pushUndo` + el borrado.
3. **Nunca se tocan Steps ni Historias.** Tras confirmar quedan filas «ya no existe» que el usuario ve y repara cuando quiera (comportamiento ya existente).
4. **El Behavior del nodo borrado sí se quita con el nodo** (cascada), igual que MCP (decisión 90). Razones: es metadato del nodo (no narrativa propia); mantenerlo es un bug —invisible, irreparable y rompe **todas** las Historias de la página, incluso las que no usan el nodo—. El diálogo lo menciona solo cuando existe («…y su condición «No disponible»»). Esto cambia el `keepBehaviors:true` del editor y debe ir aprobado: es la única parte que no es solo UX.
5. **Cortar (`cutSel`) = copiar + borrar**: pasa por la misma confirmación; si se cancela, el portapapeles ya contiene la copia (aceptable, igual que hoy tras Ctrl+C).
6. **Presentación del diálogo**: ver pregunta de decisión 2 (nativo `confirm()` vs diálogo propio).

Por qué difiere de MCP sin incoherencia: MCP *rechaza* porque quien llama es un agente por lotes sin vista ni Undo; el editor *confirma* porque quien llama es una persona con el resultado delante y Undo. Ambos comparten la misma regla de fondo —**no se modifica una Historia en silencio**— y la misma detección (`FluyoIntegrity`).

## 6–11. Impactos

### 7. Undo
- Cancelar: sin `pushUndo`, sin cambios.
- Confirmar: un único `pushUndo` (el existente); `snapPage()` ya incluye `behaviors` y `scenarios`, así que Ctrl+Z restaura nodo, conexiones, Behavior y Historias intactas. Redo repite el borrado **sin** nueva confirmación (Redo restaura un snapshot, no pasa por `deleteSel`). Ningún cambio en `selection.js` de undo/redo. Los contadores de identidad no bajan (decisión 2): los ids borrados no se reutilizan.
- El diálogo se muestra **antes** de `pushUndo` (no dejar una entrada vacía).

### 8. Playback
- Con Playback activo Supr ya no actúa; los botones/menú de borrado: comprobar que respetan lo mismo (hoy solo se bloquea la tecla). Si no, la política se aplica igual y no hay diálogo (se mantiene lo existente: no se amplía el alcance).
- Historia rota tras «Eliminar igualmente»: `scRun` devuelve `started.errors` y `scRenderErrors` muestra el mensaje del motor («Un evento apunta a un elemento que ya no existe.»). Sin cambios en `story-playback`/`scenario-engine`. Con la cascada del Behavior, otras Historias de la página siguen reproduciéndose (hoy no).
- Present: usa `scRun({present:true})`; muestra el error por `presentStoryRefresh`, igual que hoy con Historias inválidas.

### 9. Share / Viewer
- `createShareUrl` no valida: comparte la Historia aunque esté rota y el Viewer falla al reproducir (`storyPlay` → `storyError`). Es una carencia **existente**, no se amplía ni se corrige aquí (fuera de alcance: «Share/Viewer» se estudia, no se modifica).
- Efecto de la política: reduce el número de documentos rotos que llegan a compartirse (al avisar antes) y, con la cascada del Behavior, elimina el caso «toda la página deja de reproducir en el Viewer».
- Riesgo residual para un slice posterior: avisar al compartir una Historia inválida.

### 10. Múltiples Historias
- El impacto se calcula en **todas** las Historias de la página (los ids de Historia son por página). El diálogo las lista: «Pago (3 momentos), Reembolso (1 momento)».
- Selección múltiple: **un solo diálogo** para todo el borrado (suma de nodos + conexiones + conexiones en cascada), no uno por elemento.
- Una Historia que no usa el elemento no se ve afectada (tampoco por el Behavior, tras la cascada).

### 11. Behavior
Ver §1 y §5.4. Resumen: cascada con el nodo (como MCP), sin diálogo propio salvo mención, restaurable con Undo; cierra el hueco de «invisible e irreparable». Es la única desviación respecto a «no tocar nada» y requiere aprobación explícita (pregunta 1).

## 12. Casos de edge

| Caso | Comportamiento propuesto |
|---|---|
| Borrar elemento sin uso en Historias, sin Behavior | Sin diálogo; igual que hoy |
| Borrar nodo sin Steps pero con Behavior | Sin diálogo de Historias; se quita el Behavior (cascada). Sin impacto narrativo; **¿diálogo?** No: no hay Historia afectada. El Undo lo restaura |
| Borrar nodo cuyas conexiones incidentes usa un `SEND` | Impacto por cascada: se nombra la Historia; el texto menciona «y sus conexiones» |
| Borrar solo la conexión usada | Impacto de conexión |
| Selección mixta (nodos + conexiones) con y sin uso | Un diálogo con el total |
| Conexión borrada en cascada no seleccionada y usada | Cuenta como impacto (lo simula `removalImpact`) |
| Historia ya inválida antes del borrado | Solo se cuentan errores **nuevos** (`impactBetween` ya resta los previos): no se culpa al borrado de lo ya roto |
| Todos los Steps de la Historia quedan huérfanos | Misma confirmación; la Historia queda rota pero no vacía; no se elimina |
| Historia vacía / página sin Historias | Sin diálogo, sin coste (atajo: si `scenarios.length===0`, no se simula) |
| Playback `running`/`completed` | Supr no actúa (existente); ver §8 |
| Cortar (Ctrl+X) | Misma confirmación (§5.5) |
| Deshacer tras confirmar, luego Redo | Sin confirmación en Redo |
| Documento antiguo (Behavior huérfano ya existente) | Fuera de alcance: no hay «reparar documento». Posible siguiente slice: indicador/limpieza de Behaviors huérfanos preexistentes |
| Borrar página / Limpiar página | Ya son destructivos y confirmados (borran sus Historias con la página: la Historia vive en la página). Sin cambios |
| Pegar/duplicar | No borran; sin cambios |
| Teclado: Supr con foco en el diálogo | Enter/Esc: Cancelar por defecto (acción destructiva); foco inicial en «Cancelar» |

## 13. Plan de implementación (tras aprobación; **no ejecutado**)

Alcance estricto: solo la política de borrado del editor y su UX. No se tocan MCP, kernel create/update/delete, geometría, refs, `describe_document`, modelo de Story, schema, efectos, navegación, diseño, móvil, FLUYO-019.

1. **Detección** (sin tocar el kernel): `FluyoIntegrity.removalImpact(project, {pageIndex, nodeIds, edgeIds})` ya simula `deleteSel` (nodos + incidentes + conexiones) y devuelve `affectedStories[{storyId, storyName, stepIds}]`. Se llama desde el editor con la serialización del proyecto actual. Hay que cargar `document-integrity.js` en `index.html` (hoy no la carga el editor; sin cambios de código en el archivo). Alternativa sin cargarlo: contar Steps con `nodeId`/`edgeId` afectados directamente en el editor, **evitando** dos fuentes de verdad — se descarta; se prefiere `FluyoIntegrity`.
2. **Coste**: `removalImpact` valida dos veces y clona el proyecto: aceptable por acción (no por frame). Atajo: `scenarios` vacío ⇒ no se llama. Gate: no se llama durante gestos.
3. **`selection.js`**: `deleteSel` calcula el impacto **antes** de `pushUndo`; sin impacto → igual que hoy; con impacto → confirmación; cancelar → return sin cambios.
4. **Texto del diálogo** (pura función testeable, `vm`): nombres de Historia, nº de momentos/Steps, mención de conexiones en cascada y del Behavior si lo hay. Lenguaje no técnico (decisión 46): «momentos», «Historias», nunca «Steps».
5. **Behavior**: `removeNodes` pasa a no usar `keepBehaviors` (cascada) — **solo si se aprueba la pregunta 1**. `deleteNodeIn` no cambia.
6. **Presentación**: según pregunta 2.
7. **Tests**: (a) vm: función de impacto/texto (0 / 1 / varias Historias / cascada / Behavior / Historia ya inválida); (b) paridad: el impacto del editor == `REFERENCED_ENTITY` de MCP para el mismo borrado (mismas Historias y Steps) — garantiza una sola regla de fondo; (c) `deleteSel` con `confirm` simulado: acepta/cancela, `undoStack` intacto al cancelar, un solo `pushUndo` al aceptar, Undo/Redo restauran nodo + Behavior + Historias; (d) Supr, botón, menú contextual, táctil y Cortar pasan por la misma puerta; (e) Playback activo; (f) Chrome real contra HEAD: documentos idénticos a HEAD cuando no hay impacto; con impacto, Historias intactas, filas «ya no existe», `scRun` con error legible, otras Historias de la página reproducen tras la cascada del Behavior; (g) mutaciones: quitar la confirmación, confirmar siempre, olvidar conexiones en cascada, no restaurar Behavior en Undo, `pushUndo` antes del diálogo.
8. **Docs**: decisión 91 en `DECISIONS.md` (política del editor), párrafo en `ARCHITECTURE.md` (estado B2 del editor), handoff en este archivo.
9. **Release**: toca `selection.js`, `state.js` (y `index.html` si se carga `FluyoIntegrity`): el release 018.x necesita el bump de `CACHE` en `sw.js`; no se hace aquí.

## Decisiones que requieren aprobación

1. **Política**: ¿B (confirmar solo si hay impacto, sin tocar Historias)? Recomendada. A y C descartadas por lo expuesto.
2. **Behavior**: ¿se quita con el nodo (cascada, como MCP)? Recomendado; es el único cambio de comportamiento que no es solo un aviso.
3. **Presentación**: `confirm()` nativo (coherente con «Eliminar historia»/«Limpiar página», sin UI nueva, pero botones «Aceptar/Cancelar» en lugar de «Eliminar igualmente»; el texto del mensaje puede nombrar la acción) o diálogo propio con [Cancelar] [Eliminar igualmente] (más claro, pero es UI nueva y roza «rediseño visual»). Recomendado: **nativo en este slice**, y diálogo propio si se decide un pase de UI posterior.

## Resultado final (cierre de 018.4)

Estado: **READY FOR COMMIT** (sin commit, push, deploy ni bump de `sw.js`). Decisiones aprobadas por el responsable: B (confirmar solo si hay impacto; un diálogo; cancelar = cero cambios y cero Undo), el Behavior se va con el nodo, `confirm()` nativo con mensaje informativo. Decisiones 91–92 en `DECISIONS.md`.

### Qué hace el editor ahora
- `deleteSel` (única puerta: Supr, botón del panel, «Eliminar» de la selección múltiple, papelera táctil y Cortar) calcula el impacto con `FluyoIntegrity.removalImpact`. Sin Historias afectadas → borra al instante. Con ellas → un `confirm()` que nombra Historias, momentos y destinos (y la condición de disponibilidad si el nodo tiene Behavior) → solo entonces `pushUndo` y borrado. Steps e Historias nunca se modifican.
- **Playback congela el borrado por cualquier vía** (`editorFrozen()`, en `selection.js`): con Playback en marcha o completado («Volver a editar») `deleteSel` y `cutSel` no hacen nada (ni diálogo, ni Undo, ni copia al portapapeles). Al volver a «idle» funcionan con la política normal.

### 1. Bugs corregidos
1. **Behavior huérfano al borrar un nodo desde el editor** (preexistente en HEAD): rompía *todas* las Historias de la página (también en el Viewer compartido), no se veía en «Condiciones» y no tenía reparación. Ahora el Behavior se va con el nodo y Undo lo restaura. Verificado en Chrome real contra HEAD: tras borrar un nodo con condición «No disponible», el Viewer reproduce «Solo pago» con el árbol de trabajo y **no** con HEAD.
2. **Borrado silencioso de elementos usados por Historias**: ahora hay confirmación informada (mismo detector que el B2 de MCP; paridad probada).
3. **Borrado durante el Playback**: la tecla Supr y Ctrl+X ya estaban guardadas, pero el botón del panel, «Eliminar»/«Cortar» de la selección múltiple y la papelera táctil seguían pudiendo iniciar el borrado (con la 018.4 inicial habrían abierto el confirm y registrado Undo). Todos los caminos comparten ahora la guarda central.

### 2. Comportamiento preexistente (sin cambios)
- Crear, mover, redimensionar, editar por panel, retarget por arrastre, Historias, Playback/Present, Undo/Redo, guardar/reabrir y Share/Viewer: **documentos idénticos a HEAD** paso a paso (`fluyo-018-3-browser.cjs`, adaptado: compara sin Behaviors huérfanos y fija que ese es el único cambio).
- Borrar un nodo/conexión sin Historias afectadas: documento idéntico a HEAD, sin diálogo, aunque la página tenga Historias (`fluyo-018-4-browser.cjs`, bloque A).
- Share no valida la Historia al compartir: una Historia rota se comparte y el Viewer falla al reproducirla.
- Los ids son por página: el impacto se calcula solo con la página activa (probado con un id coincidente en otra página).
- Documentos antiguos con Behavior huérfano: se abren igual que en HEAD; el Behavior huérfano se conserva (no hay reparación automática) y no se toca al borrar elementos ajenos.
- **Fallos que ya existían en HEAD** (verificados ejecutando el mismo test sobre `git archive HEAD`): `fluyo-011-browser.cjs` — 2 subtests («Multi-target por menú» y «Tiempo de grupo…» buscan botones con textos que 012.1 renombró) y el test «Service Worker v45 → v61» que exige que la versión de caché cambie respecto a HEAD (seguirá fallando hasta el bump del release). Los tres fallan igual en HEAD.
- `fluyo-013-qa-browser.cjs` check 16 (teclado de Present) falló UNA vez mientras corría en paralelo con otras suites y pasó 3/3 veces en solitario y en HEAD: intermitencia por carga, no relacionada.

### 3. Pendientes de producto
- `confirm()` nativo provisional: sustituirlo por el sistema visual definitivo (rediseño). Botones Aceptar/Cancelar en lugar de «Eliminar igualmente».
- Indicador/reparación de Behaviors huérfanos ya existentes en documentos antiguos.
- Avisar o bloquear al compartir una Historia inválida (Share/Viewer).
- Marcar visualmente qué Historias están rotas (selector de Historias).
- Decidir si borrar con Playback activo debe avisar («Detén la reproducción…») en lugar de ser un no-op silencioso (hoy es igual que Supr).

### 4. Pendientes del release 018.x *(cerrados: ver «Cierre del release 018.x» al final)*
- **Bump de `CACHE` en `sw.js`** (HEAD = v61; no se tocó) y actualizar los tests que fijan v61 (incluido el de SW de `fluyo-011-browser.cjs`).
- `sw.js` ya precachea `./js/document-integrity.js` e `index.html` lo carga: ambos viajan con el release.
- Kernel/MCP **sin cambios**: `check:kernel` y `check:config` OK, sin `sync:kernel`. Comentarios obsoletos en `model.js` (`deleteNodeIn`) y `document-integrity.js` («el editor todavía NO lo consulta») a corregir en el próximo `sync:kernel`.
- Revisar el `git diff` global de 018.1–018.4 (hay trabajo de 018.x sin commitear).

### Pruebas finales (todas ejecutadas)
| Comprobación | Resultado |
|---|---|
| `node --test test/*.test.cjs` | **838/838** (820 base + 14 de 018.4 + 4 de Playback) |
| `node --check` de `js/*.js`, `sw.js`, `test/*.cjs` | OK |
| `git diff --check` | OK (solo avisos LF/CRLF de git) |
| Mutaciones 018.4 | **18/18** (3 nuevas: guarda de Playback en `deleteSel`, en `cutSel` y «solo en marcha») |
| Mutaciones 018.3 | **60/60** |
| Browser 018.4 (`fluyo-018-4-browser.cjs`, Chrome 154 + Playwright, ratón/teclado/táctil reales) | **74/74** |
| Browser 018.3 contra HEAD | OK |
| Browser 013, 013-qa, 014, 015, 015-qa, 016, 017-3 | OK (013-qa: 1 intermitencia bajo carga, ver arriba) |
| Browser 011 | 2 subtests + SW fallan **igual en HEAD** |
| Browser qa-share-hash, scenario-qa, share, share-post-qa, share-realistic-size | OK |
| fluyo-mcp: `REQUIRE_FLUYO=1 npm test` | **460/460**; `check:kernel`, `check:config` OK |
| Mutación a nivel navegador (guarda de Playback eliminada en una copia) | el browser test falla (4 comprobaciones) |

Cobertura del browser 018.4: A) sin impacto idéntico a HEAD (nodo, conexión, Undo/Redo, crear/mover/redimensionar); B) con impacto: diálogo antes de modificar, cancelar = documento+selección+Undo/Redo+Behavior idénticos, aceptar = una entrada de Undo, Steps/Historias intactos, Behavior fuera y Undo/Redo, conexión usada (botón del panel), selección múltiple mixta (un diálogo, shift+clic real, «Eliminar» de la selección múltiple), sin afectados, nodo con Behavior sin Historias, Ctrl+X (cancelar/aceptar/pegar), diálogo nativo real; C) Playback en marcha y completado (Supr, botón, menú, Cortar por botón y Ctrl+X, papelera) y recuperación en «Volver a editar», Present; D) cambio de página; E) Share/Viewer contra HEAD y tras cancelar; F) documento antiguo con Behavior huérfano contra HEAD; G) 390×844, 768×1024 y 1024×700 táctiles (papelera, sin desbordamiento, sin errores). Capturas fuera del repo.

### Archivos de 018.4
Producto: `js/selection.js` (`deleteImpact`, `deleteConfirmMessage`, `editorFrozen`, `deleteSel`, `cutSel`), `js/state.js` (`removeNodes` sin `keepBehaviors`), `index.html` (carga `document-integrity.js`), `sw.js` (precache del archivo; **sin bump**).
Tests: `test/fluyo-018-4.test.cjs`, `test/fluyo-018-4-mutations.cjs`, `test/fluyo-018-4-browser.cjs`; ajustes en `test/fluyo-018-3.test.cjs`, `test/fluyo-018-3-mutations.cjs`, `test/fluyo-018-3-browser.cjs`.
Docs: este archivo, `.ai/ARCHITECTURE.md`, `.ai/DECISIONS.md`.

## Cierre del release 018.x (2026-10-05)

Estado: **018.x READY FOR COMMIT** en `fluyo` y `fluyo-mcp` (sin commit, push ni deploy). Alcance: solo cierre/release; ningún comportamiento ni operación nueva.

### Service worker
- `CACHE`: `fluyo-static-v61` → **`fluyo-static-v62`** (HEAD = v61).
- Assets servidos que cambiaron desde HEAD: `index.html`, `js/interaction.js`, `js/model.js`, `js/selection.js`, `js/state.js`, `js/ui.js`, `sw.js`. Cambiaron también `js/document-integrity.js` (solo comentarios) y `js/story-authoring.js`, que **no es un asset servido** (lo carga solo fluyo-mcp; ninguna página lo referencia, por eso no está en `sw.js`).
- Único asset nuevo para el SW: `js/document-integrity.js` (ahora lo carga el editor): añadido a `ASSETS`. Verificado con un script que todos los `<script src>`/`<link href>` de `index.html` y `s/index.html` están en `sw.js` y que el único `js/*.js` fuera del SW es `story-authoring.js`.
- Pines actualizados (solo los de v61): `test/fluyo-010-qa.test.cjs`, `test/fluyo-013.test.cjs`, `test/fluyo-014.test.cjs`, `test/fluyo-015.test.cjs`. Los demás tests leen `CACHE` de `sw.js` dinámicamente.

### Kernel y comentarios
- Comentarios obsoletos corregidos (solo comentarios): `js/document-integrity.js` (cabecera y `removalImpact`), `js/model.js` (`deleteNodeIn`).
- `fluyo-mcp`: `npm run sync:kernel` → `check:kernel` OK (`kernel-sources.ts` regenerado, solo cambian esos comentarios) y `check:config` OK.
- Docs sin referencias obsoletas: `ARCHITECTURE.md` (filas de `document-integrity`, `removalImpact`, sección 018.4), `DECISIONS.md` (71, 75, 90 apuntan a 91–92), `fluyo-mcp/README.md` (nota de paridad B2/editor) y avisos «resuelto en 018.4» en los handoffs `FLUYO-017.1`, `017.3`, `018`, `018.3`.

### QA final (después del bump)
| Comprobación | Resultado |
|---|---|
| `node --test test/*.test.cjs` (fluyo) | **838/838** |
| `node --check` de `js/*.js`, `test/*.cjs`, `sw.js` | OK |
| `git diff --check` (fluyo y fluyo-mcp) | OK (solo avisos LF/CRLF) |
| Mutaciones fluyo 018.1 / 018.2 / 018.3 / 018.4 / 017.3 / 016 | 29/29 · 26/26 · 60/60 · 18/18 · 31/31 · 28/28 |
| Mutaciones MCP 018.2 / 018.3 / 017.3 | 23/23 · 36/36 · 30/30 |
| fluyo-mcp `npm run build` | OK |
| fluyo-mcp `npm test` y `REQUIRE_FLUYO=1 npm test` | **460/460** y **460/460** |
| `check:kernel`, `check:config` | OK |
| Browser 013, 013-qa, 014, 015, 016, 017-3, 018-3 (contra HEAD), 018-4 (74 comprobaciones) | OK |
| Browser qa-share-hash, share, share-realistic-size, scenario-qa, share-post-qa | OK (scenario-qa y share-post-qa informan «NOT RUN — environment» en partes que requieren un commit histórico o el script de Umami: preexistente) |
| Browser 015-qa | OK (2/2 aislado). Falló UNA vez en la tanda secuencial (Timeout de 30 s al cargar el Viewer en el paso 15) y no se repitió: intermitente por carga |
| Browser 011 | **Falla, preexistente** (ver abajo) |

### Fallos conocidos (no se tocaron)
1. **`fluyo-011-browser.cjs`, subtests 4 y 6** («Multi-target por menú», «Tiempo de grupo…»): buscan los botones «Aplicar también a…» y «Añadir otro evento al mismo tiempo…», renombrados en 012.1. Fallan idéntico en `git archive HEAD` (ejecutado) y en el árbol, antes y después del bump.
2. **`fluyo-011-browser.cjs`, «Service Worker v45 → v61»**: reevaluado desde cero tras el bump (como se pidió). Antes fallaba en `notEqual(oldCache, nextCache)`; con v62 esa aserción pasa y falla la siguiente (`#scAppearance` debe ser 0 con los assets «antiguos»). Causa: el test toma como «checkout anterior» `git show HEAD:…` y asume que HEAD es anterior a la UI de apariencia de 011; HEAD ya contiene `#scAppearance` (2 apariciones en `HEAD:index.html`). El test es **obsoleto por diseño**, no una regresión: dará el mismo resultado sobre cualquier HEAD actual. Decisión: no arreglarlo en este release (fuera de alcance); reescribirlo contra un fixture congelado es trabajo aparte.
3. **`fluyo-013-qa-browser.cjs` check 16** (teclado de Present): falló una vez en la tanda de 018.4 mientras corría en paralelo con otras suites; pasó 3/3 aislado, pasa en HEAD y pasó de nuevo (1/1) en la tanda del release. Intermitente por carga.
4. **`fluyo-015-qa-browser.cjs`**: una intermitencia (arriba), 2/2 aislado.

### Comprobación de producto final (cubierta por las suites anteriores)
Historias (016 browser, mutaciones 016) · Playback/Present (013, 013-qa, 018-4 C) · EventTypes (017-3 browser, 015, 015-qa) · crear/modificar/borrar nodos y conexiones (018-3 browser contra HEAD, 018-4 A/B) · B2 editor/MCP (018-4: paridad del impacto con `REFERENCED_ENTITY`; MCP 460/460) · refs (MCP 018.2/018.3, mutaciones) · Share/Viewer (014, share*, 018-4 E) · documentos antiguos (016, 015-qa, 018-4 F) · Undo/Redo (018-4 B, 018-3) · responsive básico (013-qa, 011 responsive, 018-4 G a 390/768/1024).

### Archivos modificados en el release (por encima de 018.4)
`fluyo`: `sw.js` (v62), `js/document-integrity.js` y `js/model.js` (solo comentarios), `test/fluyo-010-qa.test.cjs`, `test/fluyo-013.test.cjs`, `test/fluyo-014.test.cjs`, `test/fluyo-015.test.cjs` (pines v62), `.ai/ARCHITECTURE.md`, `.ai/DECISIONS.md`, `.ai/tasks/FLUYO-017.1.md`, `FLUYO-017.3.md`, `FLUYO-018.md`, `FLUYO-018.3.md`, `FLUYO-018.4.md`. `fluyo-mcp`: `src/generated/kernel-sources.ts` (regenerado), `README.md`.
