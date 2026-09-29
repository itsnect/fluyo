# DECISIONS.md — Decisiones técnicas de Fluyo

## Formato y persistencia

1. **`.fluyo.json` versionado**. La clave `version` controla migraciones. Nunca se renombran claves ya guardadas (`shape`, `anim`, claves de catálogos…).
2. **IDs estables, numéricos e irreutilizables**. Cada entidad (nodo, edge, scenario, step, eventType) usa contadores `next*` que nunca bajan, incluso tras undo.
3. **Projecto sin build ni dependencias**. Scripts clásicos (`<script src>`) comparten ámbito global; no se usa `import` de nivel superior para preservar apertura desde `file://`.
4. **Sin backend**. Toda la persistencia es local (`localStorage`, archivos) o autocontenida en la URL (`#d=`).

## Canvas y render

5. **Canvas 2D único**. Toda la geometría se calcula en `js/geometry.js` y se dibuja en `js/render.js`. No hay nodos DOM sobre el lienzo.
6. **Viewport transformado**. `viewX`, `viewY`, `viewZoom` transforman coordenadas de pantalla a mundo en `js/interaction.js` y `js/render.js`.
7. **Service worker cache-first**. Cualquier cambio en assets servidos requiere bump de la constante `CACHE` en `sw.js`.

## Scenarios

8. **Motor determinista puro**. `js/scenario-engine.js` no usa DOM, timers, `Date`, `Math.random` ni estado mutable externo. El orden del array es el tie-break semántico.
9. **Trace como fuente de verdad**. El motor emite un Trace; `js/scenario-playback.js` lo proyecta a datos visuales.
10. **Engine versionado**. `engineVersion` es un contrato semántico. v1 soporta `SET_STATE` y `SEND`. v2 añade `OCCURRENCE` sin cambiar la semántica de v1.
11. **Playback sobre la lista de Steps**. El storyboard refleja el progreso en la misma lista que se edita.

## EventTypes (FLUYO-010)

12. **EventType separado de primitiva**. El usuario define el lenguaje y la representación; el engine solo conoce primitivas deterministas.
13. **EventType project-scoped**. Viven en `doc.eventTypes`, no por página, para poder reutilizarse en cualquier Scenario.
14. **Tres primitivas**: `FLOW` (algo recorre una conexión), `OCCURRENCE` (algo ocurre sobre un elemento), `SET_AVAILABILITY` (cambia disponibilidad UP/DOWN).
15. **Sentence templates allowlisted**. Solo `{source}`, `{target}` y `{name}`; renderizado como texto escapado, sin `eval` ni `innerHTML`.
16. **Visual token seguro**. String corto/emoji; no HTML, SVG ni URLs.
17. **Primitive immutable si está en uso**. Cambiar la primitiva de un EventType referenciado podría cambiar semántica; la UI lo bloquea.
18. **Mismo timestamp = mismo momento visual**. Los Steps con el mismo `at` se agrupan en el storyboard; el orden del array sigue siendo el tie-break.
19. **Multi-target como múltiples Steps**. Un mismo evento aplicado a varias edges simultáneamente se representa como varios `SEND` normales con igual `at` e `eventTypeId`; no hay nueva semántica de engine.
20. **Presentación no controla semántica**. Cambiar nombre, frase o token de un EventType no altera el Step ni el Trace.
21. **Compatibilidad hacia atrás**. Steps históricos sin `eventTypeId` siguen cargando, ejecutando y renderizando con fallback legacy.
22. **Eliminación segura**. No se permite borrar un EventType en uso; se indica cuántos momentos lo usan.
23. **Viewer preserva EventTypes**. El viewer no ejecuta Scenarios, pero conserva `eventTypes` en roundtrip.
