# FLUYO-015 — Lenguaje visual para eventos en movimiento

Estado: IMPLEMENTADO — pendiente de revisión de producto; sin commit ni push
Owner/agente actual: Claude Code

> Repo público: contenido apto para publicarse (AGENTS.md §9).

## 1. Estado actual (verificado en código)

- `EventType` = `{id,name,primitive,sentenceTemplate,visual:{kind:"token",value},motion,presentation?,availability?}`. `visual.value` es la única fuente del símbolo (`eventSymbol`).
- `motion` ya existe: `fast|normal|slow` = **velocidad** (500/1100/1800 ms, `EVENT_MOTION_MS` / `MOTION_MS`). Sólo aplica a FLOW. En la UI se rotula «¿Cómo se mueve?» → colisiona con el nombre que pide esta tarea.
- `presentation` hoy sólo contiene `nodeEffects` (símbolo/mensaje/resaltado/duración visual). `normalizeEventTypePresentation`, `createEventType` y `updateEventType` **reconstruyen** `presentation` como `{nodeEffects}`: cualquier clave nueva se perdería si no se extiende el normalizador.
- Playback: `FluyoStory.stepMeta` (token, motion, nodeEffects, name) → `scenario-playback.js` (`activeSends`/`completedSends` con `progress`, `token`, `ageMs`) → `render.js#drawScenarioEdgeOverlay`. Hoy el símbolo sigue la conexión con `pointAt(pts, progress)` lineal, 20 px fijos, sin rastro; al terminar hay un anillo verde/rojo de 700 ms (`TERMINAL_MS`).
- Editor, Present y Viewer comparten receta (`FluyoStory`) y renderer (`render.js`). Viewer carga `model.js`, `render.js`, `story-playback.js`: un cambio ahí llega a los tres sin tocar Share.
- El **preview del modal** (`scUpdateEventPreview`) es HTML/CSS aparte (`.scPreviewPath`, `@keyframes scTravel`): **no** usa el renderer. Es justo lo que la tarea pide eliminar como fuente de verdad visual.
- Línea base: `node --test test/*.test.cjs` = 432/432.

## 2. Arquitectura propuesta

```
EventType.presentation.connectionEffects ──→ connectionVisualSpec(et)  (model.js, única especificación)
        │                                          │
        │                          FluyoStory.stepMeta → meta.connection
        │                                          │
        │                       scenario-playback (lo copia en activeSends/completedSends)
        │                                          ▼
        └──────────────→  render.js: drawEventToken / drawEventArrival (único pintor)
                                   ▲                         ▲
                       drawScenarioEdgeOverlay        preview del modal (canvas pequeño)
                       (Editor, Present, Viewer)
```

- **Una especificación**: `connectionVisualSpec(et)` en `model.js` (normaliza + añade símbolo), igual que `nodeEffectsVisualSpec`.
- **Un pintor**: `drawEventToken(c, pts, s, T)` y `drawEventArrival(c, pts, s, T)` en `render.js`. `drawScenarioEdgeOverlay` los llama; el preview del modal los llama con la misma forma de datos (`{progress, duration, token, connection, …}`). No hay animación CSS distinta.
- **Easing, rastro, halo y llegada son función pura del `progress`/`ageMs` ya existentes**: sin timers, sin estado persistente, sin listeners. La respiración usa `progress*duration` (determinista), no `Date.now()`.
- El motor (`scenario-engine.js`) no cambia ni se carga con estos datos. `stepMeta` no entra en el Trace.

## 3. Modelo de datos

`EventType.presentation.connectionEffects` (sólo se usa en FLOW; opcional):

| Campo | Valores | Defecto |
|---|---|---|
| `size` | `small` · `medium` · `large` (px en `model.js`: 15 / 20 / 28) | `medium` |
| `style` (forma de moverse) | `direct` · `smooth` · `impulse` | `direct` |
| `trail` | `none` · `subtle` · `marked` | `none` |
| `arrival` | `none` · `pulse` · `glow` · `bounce` | `none` |
| `during` | `none` · `halo` · `breathe` | `none` |

Para eventos de **elemento**: `presentation.nodeEffects.symbolSize` (`small|medium|large`, defecto `medium` = tamaño actual) → mismo control «Tamaño» para el símbolo de la Historia/cue.

`motion` (velocidad) **no cambia** de sitio ni de valores. Valor desconocido/inválido → se descarta campo a campo y vuelve al defecto (sin lanzar error: igual que `normalizeNodeEffects`).

## 4. UX propuesta

Modal de Evento (cabecera visible, cuerpo con scroll, pie fijo; el preview a la derecha, arriba y compacto en móvil):

- **Preview vivo** (canvas) «Así se verá»: nodo → conexión → nodo, símbolo recorriendo en bucle suave con pausa; se redibuja al cambiar cualquier opción y no necesita guardar. Un solo RAF mientras el diálogo está abierto y visible; se cancela al cerrar. `prefers-reduced-motion`: fotograma estático + «▶ Ver ejemplo».
- Para eventos de conexión, grupo **«Cómo viaja»** con botones visuales (segmentados con mini-ilustración):
  1. **Tamaño**: Pequeño · Mediano · Grande (el propio símbolo en tres tamaños).
  2. **Forma de moverse**: Directo `●──→` · Suave · Impulso.
  3. **Rastro**: Sin rastro · Sutil · Marcado.
  4. **Al llegar**: Nada · Pulso · Brillo · Rebote.
  5. Dentro de «Más detalles» (`<details>`, patrón de la decisión 38): **Velocidad** (Rápido · Normal · Lento — el antiguo «¿Cómo se mueve?») y **Mientras viaja** (Nada · Halo · Respirar).
- Eventos de elemento: sólo **Tamaño** del símbolo (junto a «Usa: ◎ Cambiar símbolo»). Nada de rastro/llegada (no hay recorrido).
- Lenguaje: sin easing/duration/trail/px/renderer. «¿Cómo se mueve?» pasa a significar la forma; la velocidad se rotula **«¿Qué tan rápido?»**.
- Sin selectores nuevos (`<select>`); controles `scSegmented` existentes + variante con mini-icono. Responsive 1366/768/390 sin scroll horizontal.

## 5. Qué NO se implementa

- Efectos por tipo de símbolo/evento (avión, camión, pago): el sistema no sabe qué representa el símbolo.
- Más de 3 formas / 3 rastros / 4 llegadas (el resto —partículas, estelas por color, curvas— se descarta).
- Color propio del rastro, duración del rastro configurable, opacidades, curvas editables.
- Efecto «al llegar» sobre sends fallidos (la falla conserva su anillo rojo; no se «celebra» un fallo).
- Rastro/llegada para eventos de elemento (OCCURRENCE/SET_AVAILABILITY).
- Cambios en engine, Trace, formato de Share, analytics, MCP, schema (sin bump). FLUYO-016.
- Exportación GIF/PNG (no pinta overlays de Scenario: `isExport`).

## 6. Compatibilidad

- Sin bump de schema (v5): `presentation` se extiende; el normalizador rellena defectos. Un EventType antiguo sin `connectionEffects`/`symbolSize` se reproduce **idéntico** a hoy (defectos = 20 px, lineal, sin rastro, sin efecto ⇒ mismo código de pintura que ahora).
- `createEventType`/`updateEventType`/`normalizeEventTypePresentation` preservan ambas claves (hoy las descartarían).
- Share/deep link: el snapshot ya incluye `doc.eventTypes`; los campos nuevos viajan sin tocar `share-url.js`. Viewer antiguo ignora claves desconocidas.
- Persistencia: sólo se escribe `connectionEffects` si el usuario lo configuró o si el EventType ya tenía `presentation`; no se rellenan documentos viejos al cargarlos.

## 7. Render compartido

Ver §2. `drawScenarioEdgeOverlay` pierde su código inline de partícula y llama a `drawEventToken`/`drawEventArrival`; el preview del modal llama a las mismas funciones. Present y Viewer ya usan `render.js` ⇒ cero implementaciones adicionales. `sw.js` CACHE v58 → v59.

## 8. Tests

- `test/fluyo-015.test.cjs` (vm): defaults, normalización, campos inválidos, persistencia en create/update/serialize/roundtrip, EventType legacy, tamaño/easing/rastro/llegada/composición como funciones puras del pintor (canvas mock), **Trace idéntico** con visual A/B/C, stepMeta no entra en el Trace, estado visual no persistente tras reset, ausencia de timers/listeners nuevos en el pintor.
- DOM falso: preview se actualiza, edición de EventType existente y usado, reset del modal.
- `test/fluyo-015-browser.cjs` (Chrome real): los 10 casos de la tarea + responsive 1366×768 / 768×1024 / 390×844 + capturas.

## 9. Riesgos

- Colisión de nombres «Movimiento/Cómo se mueve» → mitigado renombrando la velocidad.
- `scenario-playback` copia `connection` en activeSends/completedSends: el test de forma de datos existente podría fijar claves exactas → se revisa/ajusta.
- Rastro a ritmo de frame con muchos envíos simultáneos: ≤ 6 trazos/ghosts por send, sin asignaciones por frame relevantes.
- El canvas del preview debe escalar con devicePixelRatio y no producir scroll horizontal en 390 px.

## Decisiones tomadas (para DECISIONS.md al cerrar)

- La forma de moverse es presentación pura aplicada al `progress`; la duración no cambia ⇒ `finished`, Trace y orden intactos.
- La velocidad existente (`motion`) se conserva; sólo cambia su rótulo.
- Los efectos de llegada se pintan a partir de `completedSends` (ventana existente de 700 ms) sin nuevo estado.

## Handoff

### Qué se hizo
- **Modelo** (`js/model.js`): `presentation.connectionEffects` (size/style/trail/arrival/during), `nodeEffects.symbolSize`, `normalizeConnectionEffects`, `connectionVisualSpec`; `createEventType`/`updateEventType`/`validateEventType` los conservan. Sin bump de schema; ausente = defaults = comportamiento anterior.
- **Playback**: `FluyoStory.stepMeta` añade `connection`; `scenario-playback.js` sólo lo transporta a `activeSends`/`completedSends`.
- **Pintor único** (`js/render.js`): `drawEventToken` (forma, rastro, halo/respirar, tamaño), `drawEventArrival` (pulso/brillo/rebote), `drawFlowOverlay` (envíos + llegadas); `drawScenarioEdgeOverlay` delega en él. Tamaño del símbolo de nodo vía `SYMBOL_NODE_PX`.
- **Editor** (`index.html`, `js/editor-scenarios.js`, `css/styles.css`): grupo «¿Cómo viaja este evento?» (Tamaño · ¿Cómo se mueve? · ¿Deja rastro? · ¿Qué pasa al llegar?) con botones visuales; «Más detalles» = ¿Qué tan rápido? (la antigua velocidad) + ¿Y mientras viaja?; tamaño del símbolo en eventos de elemento. **Preview vivo** en canvas que llama a `drawFlowOverlay`; un RAF, cancelado al cerrar; sticky/compacto en móvil; `prefers-reduced-motion` respetado.
- `sw.js` CACHE v58 → v59 (y tests que fijaban v58).

### Archivos
Nuevos: `test/fluyo-015.test.cjs`, `test/fluyo-015-browser.cjs`. Modificados: `js/model.js`, `js/render.js`, `js/scenario-playback.js`, `js/story-playback.js`, `js/editor-scenarios.js`, `index.html`, `css/styles.css`, `sw.js`, `test/fluyo-010-qa.test.cjs`, `test/fluyo-011-browser.cjs`, `test/fluyo-013.test.cjs`, `test/fluyo-014.test.cjs` (sólo versión de caché), `.ai/ARCHITECTURE.md`, `.ai/DECISIONS.md` (58–61). Sin cambios en `scenario-engine.js`, `share-url.js`, `viewer.js`, `s/index.html`.

### Decisiones
Ver DECISIONS 58–61. Nombres finales: Tamaño (Pequeño/Mediano/Grande), ¿Cómo se mueve? (Directo/Suave/Impulso), ¿Deja rastro? (Sin rastro/Rastro sutil/Rastro marcado), ¿Qué pasa al llegar? (Nada/Pulso/Brillo/Rebote), ¿Y mientras viaja? (Nada/Halo/Respirar). Suave = seno; Impulso = cúbica (arranque lento, tramo medio rápido, frenada marcada). El rastro es neutro (color de texto del tema); halo/pulso/brillo usan el acento del producto.

### Pruebas
- Línea base 432/432. Final: `node --test test/*.test.cjs` **453/453** (+21 de `fluyo-015.test.cjs`).
- **Trace antes = Trace después**: `fluyo-015.test.cjs` ejecuta el mismo Scenario con visual A (defecto), B (✈️ grande/impulso/rastro marcado/rebote/respirar) y C (⚡ pequeño/suave/sutil/brillo/halo): el Trace del motor es idéntico byte a byte, el del Playback es el del motor y la línea de tiempo (cursor, eventos, envíos, `finished`) es idéntica cada 100 ms. El browser lo repite con el modal real editando un EventType **usado** (Trace y Steps iguales antes/después). El motor no menciona ningún término visual.
- `node test/fluyo-015-browser.cjs` (Chrome real, Playwright externo): 15 bloques OK, 0 errores de consola/página — Pago con rastro; Pedido con rebote; ✈️ creado desde el modal; sin efectos (+ EventType legacy); simultáneos; fallido (sin pulso de llegada, conserva anillo rojo); mensaje+símbolo+rastro; Present; Viewer/Share; Reset/Detener (0 trazos y 0 símbolos tras Reset); editar EventType existente/usado; reset del modal; preview se detiene al cerrar; responsive 1366×768, 768×1024, 390×844 (header visible, cuerpo con scroll, footer fijo, sin scroll horizontal); evento de elemento; reducir movimiento.
- Regresión Chrome: `fluyo-014-browser` (13 bloques, incl. upgrade SW v56→v59 y offline) y `fluyo-013-browser` OK. NOT RUN: `fluyo-013-qa-browser`, `scenario-qa-browser`, `fluyo-011-*browser`, `share-browser` (`fluyo-011-browser` ya tenía 4 fallos previos documentados).
- `node --check js/*.js sw.js` OK; `git diff --check` sin errores (sólo avisos LF/CRLF del entorno).
- Capturas (fuera del repo): `C:\Users\nectd\AppData\Local\Temp\claude\C--Proyectos-fluyo-new\61764809-497e-41b8-8795-ef287a09d857\scratchpad\shots\` — `02-modal-nuevo-avion` (editor + preview), `07-modal-1366x768/768x1024/390x844`, `09-modal-390-scrolled`, `01/03/04-playback-*`, `05-present`, `06-viewer-share`, `08-modal-elemento`.

### Riesgos / pendiente
- Mutaciones sobre copias aisladas (como en 014) no ejecutadas; los tests de Trace y de pureza (sin timers) sí.
- El efecto de llegada dura la ventana existente de 700 ms; con envíos muy seguidos pueden solaparse (se pintan ambos).
- El rastro usa el color de texto del tema: discreto en temas claros por diseño (ajustable en `FLOW_TRAIL_SPEC`).
- `fluyo-mcp` (repo aparte) no conoce `connectionEffects`; no se tocó.
- El visor público debe desplegarse con esta versión para que los Shares reproduzcan los efectos (clientes antiguos los ignoran sin romperse).

### Próximo paso concreto
Revisión de producto con las capturas; si se aprueba, commit/push y despliegue (SW v59). No se inició FLUYO-016.

## QA adversarial final

Resultado: **FLUYO-015 — QA OK** (con una corrección y dos limitaciones preexistentes documentadas).

### Regresión
- `node --test test/*.test.cjs` **456/456** (+3 de QA: símbolo sólo desde `visual.value`, guard de cambio de documento, barrido de 108 combinaciones de efectos con Trace idéntico). `node --check js/*.js sw.js test/fluyo-015*.cjs` OK; `git diff --check` sin errores.
- Chrome real (Playwright): `fluyo-013-browser`, `fluyo-013-qa-browser`, `fluyo-014-browser`, `fluyo-015-browser` (15 bloques), **`fluyo-015-qa-browser` (13 bloques, nuevo)**, `scenario-qa-browser`, `share-post-qa-browser`, `share-browser`, `fluyo-011-manual-smoke` (12/12), `qa-share-hash-browser`, `share-realistic-size-browser` → todos OK. NOT RUN (entorno): gate de privacidad de share (requiere script Umami) y upgrade legacy v39 de `scenario-qa-browser`.
- `fluyo-011-browser`: 8 pass / 4 fail, **idéntico en HEAD sin FLUYO-015** (fallos preexistentes: «Aplicar también a…», «Añadir otro evento al mismo tiempo…» y el test de SW v45).

### Bugs
- **Corregido (cierre claro del requisito 15 «cambiar documento»)**: `applyProjectData` (Abrir archivo / enlace entrante / autosave) no detenía un Playback en curso → quedaba «Reproduciendo/Completada» con la Historia del documento anterior. Corrección: guard con `scReset()` en `applyProjectData` (`js/state.js`), tras normalizar (un archivo inválido no mata la reproducción). Protegido por unit (estático) y `fluyo-015-qa-browser` §12.
- **Test desactualizado por decisión de 015**: `fluyo-011-manual-smoke.cjs` pulsaba la velocidad (`scMotion`), ahora dentro de «Más detalles» → el test abre el acordeón antes.
- **Limitaciones preexistentes (no se tocan)**: (a) el Undo es por página (`snapPage` = `P()`); `doc.eventTypes` queda fuera, igual que nombre/frase/símbolo → Ctrl+Z no revierte la presentación de un EventType (sí deja Steps/Trace/IDs intactos; el test lo fija); (b) el modal no se abre mientras hay un Playback activo/«completado» (hay que pulsar Reiniciar).
- **Restantes**: ninguno bloqueante.

### Mutaciones (copias aisladas; ninguna en el árbol)
12/12 detectadas: M1 sin metadata visual (unit), M2 renderer ignora `trail` (unit), M3 llegada también en fallos (unit), M4 sin limpieza en Reset (browser), M5 `exitPresent` sin Reset (browser), M6 campo visual dentro del Trace (unit), M7 preview con otro renderer (unit — se reforzó el test tras no detectarla a la primera), M8 símbolo fijo (unit — idem, nuevo test), M9 forma de moverse ignorada (unit), M10 cambio de documento sin Reset (unit), M11 preview sin parar al cerrar (unit), M12 el motor menciona términos visuales (unit).

### Responsive / Share / SW
- 1366×768, 768×1024, 390×844 con todos los acordeones abiertos y mensaje de 120 caracteres, para evento de conexión y de nodo: header y footer visibles, cuerpo con scroll, sin scroll horizontal, ningún control/radio fuera del modal (los inputs ocultos de secciones `display:none` no cuentan), acordeones abrir/cerrar sin desbordes.
- Share con Historia (💵 Grande/Impulso/Marcado/Pulso): el payload lleva `connectionEffects` exactos y el Viewer recibe la misma especificación que preview/Editor/Present; «sólo diagrama»: 0 Scenarios y sin controles. Documento antiguo sin campos nuevos: abre, edita (defaults), reproduce, comparte y se ve igual, sin migración.
- SW v58 → v59: tras actualizar sólo queda `fluyo-static-v59`; `render.js`/`model.js`/`story-playback.js`/`editor-scenarios.js`/`styles.css` en caché son los de 015; Viewer y Share offline reproducen con rastro 28 px. Sin mezcla de versiones. No se subió otra versión (v59 aún no está desplegada; `state.js` va en el mismo release).

### Evaluación de producto (cualitativa)
- **Expresividad**: Tamaño, Rastro y Al llegar se notan al instante; Forma de moverse (Suave/Impulso) es sutil por diseño y sólo se aprecia comparando; «Mientras viaja» (Halo/Respirar) es el control que más sobra y por eso está en «Más detalles».
- **Cantidad de opciones**: razonable (4 visibles + 2 ocultas). No añadir más.
- **Nombres**: «¿Deja rastro?», «¿Qué pasa al llegar?» y «Tamaño» se entienden solos; «Impulso» vs «Suave» necesita el mini-dibujo; «Pulso/Brillo/Rebote» se aprenden con el preview.
- **Preview**: sí ayuda — es lo que explica las diferencias; en móvil quedar fijo arriba lo hace útil mientras se hace scroll.
- **Integración**: Pulso y Brillo usan el acento azul del producto y se sienten parte de Fluyo; el rastro «marcado» con emojis de color (p. ej. 💵) deja un churrete algo pesado frente a símbolos de un solo tono.
- **Distracción**: «Respirar» + «Rebote» + rastro marcado sobre el mismo evento es lo más llamativo; ninguno distrae por sí solo.
- **Combinaciones feas**: Grande + Rastro marcado en conexiones muy cortas (< ~100 px): el rastro cubre casi toda la conexión; Brillo/Halo sobre fondo claro («Crema/Claro») es más tenue. Se documenta; no se cambia en esta pasada.
