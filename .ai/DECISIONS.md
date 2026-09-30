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

## Composición de escenarios (FLUYO-011)

24. **Biblioteca → Canvas → Historia**. Evento y Escenario son el modelo mental visible; las primitivas y acciones internas quedan en código o diagnóstico técnico.
25. **Editor fuera del panel estrecho**. Crear/editar vocabulario usa un modal central con cuerpo desplazable y cabecera/pie visibles.
26. **Frases como texto y chips**. Los nombres se insertan mediante controles accesibles y se traducen al formato de template existente. No se evalúa HTML ni se reescriben silenciosamente templates anteriores.
27. **Historia temporal, no cards**. Grupos derivados por tiempo y orden estable del array en empates. La simultaneidad se expresa como «Al mismo tiempo» sin nueva entidad persistida.
28. **Drop espacial explícito**. Soltar en vacío nunca aplica a una selección previa. La multiselección sólo actúa si el objetivo real pertenece a ella. Los cruces ambiguos requieren elegir una conexión.
29. **Edición global y local separadas**. Cambiar un evento actualiza su vocabulario compartido; quitar de Historia conserva el evento. No hay eliminación en cascada de eventos en uso.
30. **Modo de colocación efímero**. Drag y click-to-place comparten targets y operaciones del modelo; Escape/pointercancel limpian estado y feedback. No hay un segundo sistema de undo.
31. **Movimiento temporal explícito**. Cambiar una espera desplaza el grupo completo y los posteriores. Mover antes/después intercambia posiciones temporales; a igual tiempo cambia el orden de resolución. Quitar una aparición no adelanta las siguientes.
32. **Eventos de nodo: presentación antes que primitiva**. El usuario configura el efecto visual (icono, mensaje, resaltado, parpadeo, atenuación, color) y una consecuencia funcional separada. El runtime dibuja los overlays; el step del motor sigue siendo `OCCURRENCE` o `SET_AVAILABILITY` según la consecuencia elegida.
33. **Efectos visuales solo en runtime**. `presentation.nodeEffects` se persiste en el EventType, pero el estado de overlay vive en la sesión de playback; Reset lo limpia.
34. **Auto-creación de Scenario**. Si no existe un Scenario en la página, colocar un evento crea uno por defecto y añade el paso en una sola operación de undo.
35. **EventType usado editable en presentación**. Nombre, frase, token, movimiento y efectos de nodo pueden cambiar; los pasos existentes conservan su acción original y la Historia no se reconstruye.

## Create/Edit Event UX final polish

36. **Inputs nativos ocultos, UI estilizada visible**. Los radio, checkbox y color `<input>` permanecen en el DOM para accesibilidad y teclado; la interfaz visual usa labels segmentados, chips de efecto y swatches sincronizados con ellos.
37. **Paleta de color centralizada**. `EVENT_SWATCHES` en `js/config.js` es la fuente de verdad para selectores de color del producto; cualquier selector futuro debe reutilizarla.
38. **Revelación progresiva con `<details>`**. Las secciones avanzadas de apariencia y comportamiento son acordeones nativos colapsados por defecto al crear; se abren automáticamente cuando el evento ya tiene configuración.
39. **Configuración de efectos adyacente**. Activar un chip de efecto despliega inmediatamente sus campos debajo del chip, no en una sección remota.
40. **Compactación por tipo de evento**. Los eventos de conexión ocultan los controles exclusivos de nodo (apariencia y comportamiento) sin cambiar el modelo subyacente.

## FLUYO-011 — Un Evento = un símbolo
`EventType.visual.value` es la única fuente del símbolo (Biblioteca, ghost, Historia, preview, Playback). `nodeEffects.showSymbol` solo controla visibilidad del overlay; no se permite un segundo icono. El nombre del Evento no se concatena a la frase salvo que se inserte `[Nombre del evento]`; `renderEventSentence` nunca pega marcadores a texto. Estilos de mensaje (tamaño/peso/tipografía/posición) son presets en `presentation.nodeEffects`, runtime-only.
