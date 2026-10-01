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

## FLUYO-012 — Historia manipulable y duración visual
41. **El arrastre en Historia es una capa de manipulación directa sobre la misma semántica de reordenar que el menú** (`storyboard*` en `js/model.js`). Los instantes son ranuras: el contenido se mueve, los tiempos se quedan. Unirse a un momento fija `at` al del ancla. Sacar un Step de un momento simultáneo a un hueco no se soporta (exigiría inventar un instante).
42. **La duración visual nunca cambia la semántica del Scenario**. `presentation.nodeEffects.visualDuration` (`brief` 700 ms · `normal` 1500 ms · `long` 3000 ms · `custom` 0,3–10 s) sólo controla cuánto dura el cue en Playback. No afecta a `step.at`, Trace, orden ni consecuencia funcional (un `DOWN` sigue vigente al terminar el cue). Sin bump de schema: el normalizador v5 lo preserva; ausente = Normal.
43. **Cues de nodo con identidad propia**: cada cue tiene duración, fade in/out y alpha propios; con cues solapados en un nodo, gana el iniciado más recientemente para símbolo/mensaje. Éxito/fallo de FLOW en el Canvas son pulsos breves de duración fija y central (`TERMINAL_MS`), nunca badges.

## FLUYO-012.1 — Fluyo cuenta historias
44. **La Historia manda; el tiempo absoluto se deriva de ella**. Las esperas pertenecen a los huecos: reordenar conserva el ritmo y, si un momento desaparece al unirse a otro, su espera se colapsa y las demás se conservan. Sin schema nuevo (los `at` persistidos se recalculan). Descartado: que la espera viaje con la tarjeta y `waits[]` persistido.
45. **Composición de cues por nodo = apilar** (más reciente pegado al elemento, máx. 3, un solo mensaje centrado). Descartado: «último gana» y timeline «Ahora/Antes».
46. **Lenguaje no técnico en la UI**: «¿Cuánto tiempo se ve?» (Poco tiempo/Normal/Mucho tiempo/Personalizado), «No se completó», «Llegó»; nada de éxito/fallo, ms ni «duración visual». La aparición es un objeto: al pulsarla ofrece su menú (ver 49).

## FLUYO-012.1 — QA final de producto
47. **Una sola política de «un momento desaparece»** (`storyboardCollapsedGroups`, `model.js`): al unirse a otro momento **o al eliminar su única aparición**, su espera se colapsa y los momentos posteriores se adelantan conservando sus propias esperas (A·3 s·B·4 s·C, eliminar B → A·4 s·C, nunca «7 s»). Eliminar el primer momento deja al siguiente como arranque (conserva el `at` inicial de la historia). Eliminar un miembro de un grupo simultáneo no mueve nada. Reemplaza el «quitar conserva los tiempos restantes» de FLUYO-011.
48. **Duplicar = misma hora, justo debajo** (`storyboardInsertDuplicate`): la copia comparte `at` con el original («Al mismo tiempo») y queda contigua en el array. Razón de producto: la persona no pidió ninguna espera y el modelo no puede guardar una «espera por defecto» sin inventar tiempo ni desplazar lo posterior; el 1 s anterior era un número escondido en el código (`DEFAULT_STEP_DELAY`). Descartado: +1 s (arbitrario, desplaza la historia) y preguntar una espera (fricción para una acción de un clic). Si quiere la copia en otro momento: Mover ▸ o cambiar la espera. Sin schema.
49. **Menú de una aparición agrupado, no administrativo**: cabecera «💵 Pago · Cliente paga a Comercio» y 4 secciones — *Evento* (Editar este evento… · Usar otro evento aquí…), *Dónde* (Cambiar dónde ocurre…), *Historia* (Duplicar · Mover ▸ Antes/Después/Al mismo tiempo que… · Añadir al mismo tiempo ▸ Otro evento…/Esta misma acción en otras conexiones…), *Eliminar*. **Editar ≠ Usar otro**: «Editar este evento» modifica el Evento de la biblioteca y afecta a todos sus usos (el menú lo dice: «Cambia “Pago” en sus N usos»); «Usar otro evento aquí» sólo cambia esa aparición. «Cambiar dónde ocurre» muestra el dónde actual («Cliente → Comercio»). «Al mismo tiempo que…» usa la misma operación (`storyboardMoveStep` join) que soltar sobre una fila: menú y arrastre comparten una sola capa de modelo.
50. **Límite documentado**: no hay forma de sacar un Step de un momento simultáneo a un hueco por arrastre (inventaría un instante). Con las reglas actuales se logra con Mover antes/después (el Step intercambia su ranura con el vecino) o editando la espera.

## FLUYO-013 — Present una Historia
51. **Present es una capa de presentación sobre el Playback existente, sin segundo motor**. La fase (ready/playing/finished) se deriva de `scStatus`; reproducir es `scRun({present:true})`; detener/salir es `scReset`. `FluyoPresentStory` (puro) sólo traduce Trace/Historia a texto humano (momento, progreso, consecuencia, cierre). Sin schema ni cambios en engine/playback.
52. **Present con Historia añade controles mínimos; sin Historia conserva las diapositivas** y nunca crea un Scenario. Un evento que no se completa es parte de la historia: se cuenta en lenguaje humano («Kafka no está disponible»), nunca como error.

## FLUYO-014 — Share Playback
53. **Una sola receta de reproducción para Editor, Present y Viewer** (`js/story-playback.js`, `FluyoStory`). La paridad es arquitectónica: los tres llaman a `FluyoStory.start/renderState/isFinished/describe`; ninguno ejecuta el motor ni construye Playback por su cuenta. Sin schema, sin cambios en motor, playback ni renderer. Reemplaza la decisión 23 («el viewer no ejecuta Scenarios»): ahora los ejecuta, pero con el mismo código que el editor.
54. **La Historia compartida es `scenarios[0]` de la página**. No hay Scenario activo persistido (`scActiveId` es efímero del editor), así que al compartir el Scenario activo del autor se coloca primero **en la copia** del snapshot; el documento del autor no cambia y el Viewer no ofrece cambiar de Historia. Límite: un Scenario por página en el Viewer.
55. **Compartir historia (por defecto) o sólo el diagrama**. El diálogo sólo ofrece la elección si hay Historia. «Sólo el diagrama» vacía `scenarios` en la copia. Mismo codec, mismo límite de 65536, mismo fragmento. Los Shares antiguos con Scenarios son reproducibles al abrirse (los datos ya viajaban en el enlace).
56. **El runtime de la Historia en el Viewer es efímero y por generación**: un solo bucle (`viewerLoop`), sin timers propios, descartado en cambio de documento/página/Present/«Abrir en Fluyo». Sin analytics nuevos: sólo `share_created` y `share_viewed`, sin propiedades.
57. **Share desde `file://` (FLUYO-014.1)**. El editor abierto con `start index.html` bloqueaba «Crear enlace» (botón deshabilitado, mensaje discreto) porque `createShareUrl` exigía origen http(s) y un enlace `file:///…/s/` no sirve a nadie más. El payload `#d=` es autocontenido (no depende del origen), así que sólo la base cambia: `shareBaseUrl()` (`share-url.js`) usa `SHARE_PUBLIC_ORIGIN = https://fluyo.space/` cuando el origen no es web; http(s) y localhost conservan su origen. `buildShareUrl` sigue exigiendo http(s). El diálogo avisa en lugar de bloquear. Límite: el visor público debe estar desplegado con la versión que entienda el payload (Historias, 014). SW v57 → v58.
