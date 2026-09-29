# ARCHITECTURE.md — Arquitectura técnica de Fluyo

## Stack

- HTML + CSS + JavaScript vanilla, sin build ni dependencias de runtime.
- Scripts clásicos (`<script src>`) que comparten ámbito global.
- Sin módulos ES: un `import` de nivel superior rompería la apertura desde `file://`.
- Canvas 2D para el editor y el viewer.
- Service worker cache-first para offline.

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `index.html` | Interfaz completa del editor. |
| `js/config.js` | Constantes: paleta, temas, tipografías, iconos, GIFs, tamaños. |
| `js/model.js` | Documento, páginas, fábricas, validación y migración de `.fluyo.json`. |
| `js/state.js` | Estado mutable del editor, autoguardado, viewport, interacción de alto nivel. |
| `js/selection.js` | Selección, portapapeles, deshacer/rehacer. |
| `js/geometry.js` | Geometría de nodos y aristas, rutas ortogonales, etiquetas. |
| `js/render.js` | Dibujado del canvas, bucle de animación, overlays de Scenario. |
| `js/interaction.js` | Ratón, teclado, zoom/pan, drag & drop del canvas. |
| `js/editor-runtime.js` | Bucle del editor, renderState, integración con playback. |
| `js/scenario-engine.js` | Motor determinista puro de Scenarios (v1/v2). |
| `js/scenario-playback.js` | Proyección de Trace a datos visuales (sin DOM). |
| `js/editor-scenarios.js` | Panel de Scenarios, storyboard, autoría, playback UI. |
| `js/ui.js` | Panel lateral, pestañas, cajones, controles de propiedades. |
| `js/export.js` | Guardar/abrir `.fluyo.json`, exportar GIF/PNG/JPG/SVG. |
| `js/deeplink.js` | Carga de documentos desde `#d=`. |
| `js/share-url.js` | Codificación de enlaces compartidos. |
| `js/editor-share.js` | Diálogo de compartir. |
| `js/viewer.js` | Viewer read-only de `/s/`. |
| `sw.js` | Service worker y cache. |

## Formato `.fluyo.json`

```text
{ version, app, doc, settings }
```

- `version`: entero. Actualmente 5.
- `doc`: `{ theme, customBg, cur, eventTypes, nextEventTypeId, pages }`.
- `page`: `{ name, nodes, edges, nextId, behaviors, scenarios, nextScenarioId }`.
- `settings`: `{ speed, dots, build, stagger, grid, snap, font, single }`.

Los `id` son únicos por página para nodos/edges; los contadores `nextId`, `nextScenarioId`, `nextStepId`, `nextEventTypeId` nunca bajan.

## Scenarios

- `Scenario` tiene `engineVersion`, `name`, `nextStepId` y `steps`.
- `Step` v1: `SET_STATE` (nodeId, state) o `SEND` (edgeId).
- `Step` v2: añade `OCCURRENCE` (nodeId/edgeId) y `eventTypeId` opcional en todos.
- El motor es determinista, puro y sin DOM/timers/aleatoriedad.

## EventTypes

- Project-scoped: viven en `doc.eventTypes`.
- Cada uno define `name`, `primitive`, `sentenceTemplate`, `visual` y, para `SET_AVAILABILITY`, `availability`.
- Las primitivas son: `FLOW`, `OCCURRENCE`, `SET_AVAILABILITY`.
- Los templates solo permiten placeholders allowlisted: `{source}`, `{target}`, `{name}`.

## Testing

- Tests en `test/*.cjs` con `node --test`.
- Motor y playback se ejecutan en `vm` sin DOM.
- Tests DOM usan un DOM falso.
- Browser smokes usan Chrome headless vía CDP.

## Restricciones duras

- Sin `import` de nivel superior.
- Sin backend ni almacenamiento remoto.
- Service worker cache-first: cualquier cambio en assets requiere bump de `CACHE`.
- Cualquier PR que toque un archivo servido debe subir la constante `CACHE` en `sw.js`.
