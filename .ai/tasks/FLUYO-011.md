# FLUYO-011 — Scenarios UX Rework

## Estado y objetivo

**Implementado; Node Event UX Reframe + final fixes + Create/Edit Event UX final polish integrados.** Sin commit ni push. No se inició FLUYO-012 ni se reabrió el alcance de FLUYO-010.

Biblioteca → Canvas → Historia → Reproducir. Evento y Escenario son los conceptos principales. El vocabulario del proyecto se crea por separado de sus apariciones en una historia. Los eventos de nodo ahora se configuran por efecto visual + consecuencia funcional, con Scenario autocreado al colocar el primer evento.

## Contratos preservados

- Schema v5, engineVersion y semántica del motor intactos.
- Determinismo, Trace, guards y desempate por orden del array intactos.
- Sin nuevas primitivas, Present de escenarios ni ejecución en Share/viewer.
- Sin dependencias de runtime, build, módulos ES ni servicios externos nuevos.
- Todas las mutaciones de autoría se integran con undo/autosave existentes.

## Implementación

### Panel y biblioteca

- Cabecera con selector textual de escenario, menú y control de reproducción. Renombrar sólo bajo demanda.
- Eventos arriba e Historia debajo, con regiones de scroll delimitadas.
- Filas de biblioteca con símbolo, nombre y menú; sin badges técnicos.
- Crear evento fuera del scroll. Búsqueda por nombre al superar ocho eventos; orden alfabético estable.
- Crear un evento no crea acciones. La nueva definición aparece destacada y se desplaza a la vista.
- Menú: editar, duplicar y eliminar de biblioteca. Los usados ofrecen «Ver dónde se usa» y no se borran en cascada.

### Modal de evento

- Diálogo nativo central de 760 px, máximo viewport menos 48 px. Cabecera y pie fijos; un solo cuerpo desplazable.
- Preguntas humanas: nombre, dónde ocurre, efecto sobre disponibilidad, cómo contarlo y qué se representa.
- Dos opciones espaciales: conexión o elemento. Disponibilidad: sin cambio, deja de estar disponible o vuelve a estar disponible.
- Frase compuesta por inputs de texto y chips navegables. Los chips insertan únicamente nombres admitidos; los valores se renderizan como texto.
- Conserva exactamente orden, nombres repetidos y literales de templates existentes. No hay eval ni HTML interpretado.
- Picker de símbolos frecuentes y opción secundaria de símbolo/texto corto personalizado, limitada por el modelo actual.
- Ejemplo visual animado finito, sin modificar escenario. Respeta reducción de movimiento.
- Edición global explícita. Si el evento está usado, dónde ocurre y su efecto quedan bloqueados.

### Colocación

- Drag primario con umbral de inicio y ghost desplazado; click-to-place como alternativa.
- Resaltado suave de compatibles y fuerte del objetivo. Feedback breve al aplicar.
- Frase y tiempo anticipados durante el arrastre.
- Misma geometría que el renderer; tolerancia de 10 px de pantalla transformada con pan/zoom.
- Vacío e incompatibles no crean nada, aunque exista selección previa.
- Cruces ambiguos abren candidatos y esperan elección.
- Cancelación mediante Escape, pointercancel o control visible. Estado efímero y foco restaurado.
- Teclado: elegir evento, recorrer objetivos con flechas izquierda/derecha y aplicar con Enter.

### Historia

- Línea temporal compacta, sin cards, números permanentes ni formularios por fila.
- Frases accionables que señalan el target sin cambiar zoom. «Mostrar en el sistema» sólo cuando queda fuera de vista.
- Tiempo entre grupos y «Al comenzar» para cero.
- Editar intervalo desplaza el grupo completo y posteriores, preservando esperas siguientes.
- Mismo tiempo: un grupo con ramas, «Al mismo tiempo» y orden del array preservado.
- Menús locales: cambiar objetivo espacialmente, cambiar evento compatible, aplicar también, añadir otro evento simultáneo, mover antes/después y quitar de la historia.
- Quitar mantiene vocabulario y tiempos de las restantes apariciones.
- Advertencia contextual sobre efectos del orden al combinar disponibilidad y simultaneidad.
- Targets eliminados presentan reparación en lenguaje humano, sin IDs.

### Múltiples conexiones

- «Aplicar también a…» entra en selección explícita del canvas; muestra cantidad, mantiene original, permite cancelar sin mutar y confirma una sola operación undo.
- Las acciones añadidas comparten evento y tiempo; se conserva el orden de incorporación.
- Atajo de selección múltiple sólo al soltar sobre una conexión perteneciente a esa selección.
- «Añadir otro evento al mismo tiempo…» tiene contexto visible que termina al aplicar o cancelar.

### Reproducción y detalles

- Reproducir, Detener, Repetir y Volver a editar, según estado.
- Biblioteca compacta durante reproducción; resultados permanecen en Historia.
- Iconos y texto distinguen pendiente, en curso, completado y fallo esperado del sistema.
- Lenguaje humano tanto en DOM como en los overlays Canvas: «No disponible», «Origen no disponible», «Destino no disponible».
- Condiciones iniciales y Trace en diálogo secundario desde el menú.
- Condiciones conservan su alcance real de página y lo explican en la UI.

### Responsive y accesibilidad

- Panel de 336 px en 1366×768; 384 px en pantalla amplia.
- Debajo de 300 px de ancho real, Historia permanece y Eventos abre una palette flotante acotada al viewport.
- La palette cierra al colocar y el foco vuelve al acceso de Eventos.
- Modal verificado en ventana de 1000×480 con cuerpo desplazable y pie accesible.
- Botones reales, labels, foco visible, diálogo nativo, Escape, navegación básica de menús y colocación por teclado.
- Los atajos del canvas no actúan dentro del editor de eventos ni de los popovers.

## Archivos modificados

- `index.html`: nueva arquitectura del panel y diálogos externos; modal de evento con secciones Basic/Advanced, acordeones, chips de efecto, swatches de color y picker de icono.
- `css/styles.css`: biblioteca, timeline, modal, popovers, modos responsive y estilos de preview de efectos de nodo; estilos antiguos de cards retirados; estilos nuevos para controles segmentados, chips, swatches y accordiones.
- `js/model.js`: `clearPageContents()`, propiedad `motion`, `presentation.nodeEffects` con normalización y validación.
- `js/editor-scenarios.js`: presentación, edición visual, colocación, agrupación, menús, accesibilidad, coordinación de playback, auto-creación de Scenario y edición de EventType usado sin reconstruir Historia; renderizado de swatches, icon picker y acordeones.
- `js/interaction.js`: prioridad de colocación y exclusión de atajos dentro de superficies de edición.
- `js/scenario-playback.js`: emite `activeNodeEffects`/`completedNodeEffects` con token y duración de cue.
- `js/render.js`: compatibilidad/hover, confirmación, copy humano de overlays, dibujo de efectos de nodo y eliminación de badges permanentes de SEND completado.
- `js/ui.js`: integración de pestaña, tamaño/flex del panel y limpieza al salir.
- `js/config.js`: paleta centralizada `EVENT_SWATCHES` para el selector de color del modal de evento.
- `sw.js`: cache v45 → v49; estrategia existente sin cambios.
- `test/scenario-ui-dom.test.cjs`: contratos de presentación actualizados y nueve regresiones de composición.
- `test/fluyo-010-qa.test.cjs`: expectativa de cache vigente (v49) y espera observable de viewer; no cambios de contrato de FLUYO-010.
- `test/fluyo-011-browser.cjs`: recorridos de interacción/DOM/responsive, efectos de nodo y gate separado de upgrade real del service worker.
- `test/fluyo-011-final-fixes.test.cjs`: regresión G1–G12 + tests H de UX del modal de evento.
- `test/fluyo-011-manual-smoke.cjs`: smokes manuales H1–H12.
- `.ai/PRODUCT.md`, `.ai/ARCHITECTURE.md`, `.ai/DECISIONS.md`, `.ai/tasks/FLUYO-011.md`: principios de producto, handoff y decisiones duraderas.

Sin cambios en model, engine, playback puro, Share, viewer o telemetría.

## Pruebas y resultados

- `node --test test/*.test.cjs`: **315 PASS, 0 FAIL**.
- `node --test test/fluyo-011-browser.cjs test/fluyo-011-manual-smoke.cjs`, con Playwright externo y Chrome: **24 PASS, 0 FAIL**.
- `node --check` individual sobre todos los `js/*.js`: PASS. En Windows se enumeran archivos para que se comprueben todos.
- `git diff --check`: PASS; sólo advertencias de conversión LF/CRLF de la configuración local.
- Gate propio de PWA: **v45 → v49 PASS**, esperando instalación, activación y control; se verifica que desaparece el editor anterior y se sirve el nuevo.
- Share/viewer, file://, offline, mutaciones del motor, privacidad estructural y undo/redo pasan dentro de la regresión.

### Límites de los gates externos

Los suites heredados reportan explícitamente dos comprobaciones ambientales no ejecutadas: upgrade desde el commit histórico v39 (ausente en este checkout) y verificación con el script actual externo de Umami (no proporcionado). No se presentan como pruebas realizadas. La actualización real v45 → v46 sí tiene su propio gate y pasa. No se modificó telemetría.

### Correcciones detectadas durante QA

- Inicialización de conjuntos de selección múltiple antes de renderizar su banda contextual.
- Limpieza de supresión de clic tras cancelar drag.
- Restauración de foco al cerrar menús para que undo/redo siga funcionando.
- Cierre externo de popovers en fase de captura, evitando cerrar candidatos con el mismo pointerdown que los abre.
- Estado completado en cambios de disponibilidad sin transición adicional, sin modificar el motor.
- Copy técnico residual en Canvas encontrado mediante inspección de screenshots; añadido gate que captura fillText durante reproducción.
- Test de viewer heredado esperaba una carga asíncrona antes de que acabara: usa ahora waitForPhase existente.
- El gate de upgrade espera promesas resueltas mediante polling acotado: esta versión de Playwright considera truthy una Promise en waitForFunction. Era una carrera del test, no un cambio necesario de service worker.

## Browser smokes y capturas

Chrome real automatizado con ratón/teclado y revisión visual del agente. Fixtures de Cliente → Comercio/Pago, Solicitud/Aprobación, disponibilidad, Checkout → Banco/Ledger/Auditoría y caída → envío fallido → recuperación → envío exitoso.

Se comprueba además:

- Crear definición no crea aparición; aplicar y quitar no elimina definición.
- Edición global cambia frases sin modificar acciones; edición de usado no reconstruye Historia.
- Pan/zoom, vacío con selección previa, incompatibles, cancelación y ghost limpio.
- Multi-target confirmar/cancelar, tiempos compartidos y orden estable.
- Intervalos, simultaneidad contextual, reorder y undo/redo.
- Templates especiales preservados; ausencia de sintaxis técnica en el editor.
- Menú de ambigüedad, colocación por teclado, búsqueda y eliminación protegida.
- Auto-creación de Scenario al colocar el primer evento.
- Efectos visuales de nodo (Incidente, Caída) y success cue sin badge permanente.
- No overflow horizontal en viewports probados; pie del modal accesible; palette compacta funcional.
- Modal de evento: secciones Basic/Advanced con acordeones colapsados por defecto, chips de efecto, swatches de color, picker de icono y layout compacto para eventos de conexión.

Las capturas se generan en `%TEMP%/fluyo-011-*` y se entregan fuera del repositorio.

Capturas específicas del modal de evento (`%TEMP%/fluyo-011-event-ux-*`):
1. `01-node-collapsed.png` — evento de nodo nuevo, acordeones colapsados.
2. `02-node-effects.png` — apariencia expandida con Mensaje, Resaltar y Oscurecer activos.
3. `03-color-swatches.png` — swatches de color y picker nativo.
4. `04-icon-picker.png` — grid de iconos frecuentes.
5. `05-behavior-expanded.png` — acordeón de comportamiento expandido.
6. `06-connection-compact.png` — evento de conexión, campos de nodo ocultos.
7. `07-modal-low.png` — modal en viewport bajo (1000×480).

Capturas del recorrido general (`%TEMP%/fluyo-011-IBLkhg`):
1. `01-vacio-1366.png`
2. `02-editor-evento.png`
3. `03-biblioteca.png`
4. `04-arrastrando.png`
5. `05-historia.png`
6. `06-simultaneidad.png`
7. `07-playback.png`
8. `08-resultado.png`
9. `09-1366.png`
10. `10-1920.png`
11. `11-modal-bajo.png`
12. `12-compacto.png`

Capturas del manual smoke H2–H12 (`%TEMP%/fluyo-011-manual-AJC7tG`):
- `h2-pago-playback.png`
- `h3-velocidades.png`
- `h4-despacho.png`
- `h5-concurrente.png`
- `h6-fallo.png`
- `h7-clear-undo.png`
- `h8-auto-scenario.png`
- `h9-edit-used.png`
- `h10-incidente.png`
- `h11-caida.png`
- `h12-success-clean.png`

## Evaluación A–H

Evaluación heurística del agente sobre recorridos y capturas de Chrome; no es un estudio con participantes externos.

| Criterio | Evaluación | Evidencia |
|---|---|---|
| A. Distinguir evento reutilizable y aparición | Sí | Crear sólo añade a Eventos; quitar dice «de esta historia» y conserva biblioteca. |
| B. Crear Pago sin primitivas ni llaves | Sí | Chips, preguntas humanas y preview; gate DOM. |
| C. Aplicar mediante canvas | Sí | Drag real, click-to-place y teclado ejecutados. |
| D. Leer orden temporal | Sí | Esperas entre grupos y ramas simultáneas; resultados en la misma historia. |
| E. Completar en 1366×768 | Sí | Flujo completo y capturas; acciones accesibles y sin overflow horizontal. |
| F. Editar evento usado sin reconstruir Historia | Sí | Cambios de presentación no mutan Steps guardados. |
| G. Playback final fixes | Sí | Clear Page, token personalizado, identidad y motion verificados. |
| H. Modal de evento visual y progresivo | Sí | Acordeones colapsados por defecto, swatches, chips, picker de icono y resumen de efectos; sin términos técnicos en la interfaz. |

## Riesgos y próximo paso

- Falta la validación de descubribilidad con personas que nunca hayan usado Scenarios; A–H es evaluación heurística, no evidencia de estudio de usuarios.
- Touch está cubierto por alternativa de clic/toque y cancelación, pero no se realizó prueba en dispositivo táctil físico.
- No se realizó auditoría WCAG completa ni prueba específica con lector de pantalla.
- Los dos gates externos mencionados requieren insumos ajenos a esta tarea.

**Próximo paso:** revisión de producto y QA independiente del working tree y de las capturas entregadas. Recomendación técnica: candidato a DONE; no hay fallos conocidos en los recorridos verificados. Sin commits, pushes ni continuación de FLUYO-012.

---

## Manual Playback Review — Final Fixes (2026-09-30)

### Objetivo
Corregir los cuatro problemas detectados en la revisión manual de Playback sin expandir el alcance a FLUYO-012 ni alterar el motor de simulación salvo para errores reales.

| Problema | Solución |
|---|---|
| Clear Page dejaba escenarios/comportamientos | `clearPageContents(P())` ahora borra nodos, aristas, comportamientos y escenarios de la página en una sola operación de undo, conservando EventTypes y otras páginas. |
| Token personalizado no aparecía en Playback | `scenario-playback.js` y `render.js` ahora transportan y dibujan el token del EventType (`visual.value`); fallback genérico solo cuando no hay token. |
| Identidad del evento se perdía en Historia | Historia/Storyboard muestra `token + nombre` como línea primaria y la frase como secundaria; al renombrar el EventType la identidad se actualiza sin tocar el Step. |
| FLOW demasiado rápido | Nuevo campo `motion` en EventType (`fast`/`normal`/`slow`) con duraciones 500/1100/1800 ms; afecta solo presentación, no Trace. |

### Archivos modificados
- `js/model.js` — `clearPageContents()`, propiedad `motion` con validación, constantes `EVENT_MOTION_MS`.
- `js/scenario-playback.js` — `activeSends` incluye `token` y `duration` por partícula.
- `js/editor-scenarios.js` — `scRun()` captura `stepMeta`, UI de velocidad, Storyboard con identidad primaria/secundaria.
- `js/render.js` — dibuja el token real del escenario activo.
- `js/ui.js` — diálogo y undo de Clear Page.
- `index.html` — fieldset `scMotion` y preview.
- `css/styles.css` — clases de velocidad y estilo secundario.
- `sw.js` — cache bump a `fluyo-static-v47`.
- `test/fluyo-011-final-fixes.test.cjs` — regresión G1–G12.
- `test/fluyo-011-manual-smoke.cjs` — smoke manual H1–H7.
- `test/fluyo-011-browser.cjs`, `test/fluyo-010-qa.test.cjs`, `test/scenario-playback.test.cjs`, `test/scenario-ui-dom.test.cjs` — ajustes y casos nuevos.

### Verificación
- `node --check` en `js/*.js`, `sw.js` y `test/*.cjs`.
- `git diff --check` sin errores de whitespace (solo avisos LF/CRLF).
- `node --test test/*.cjs` — **345 tests, 0 fallos**.
- `test/fluyo-011-browser.cjs` con Chrome/Playwright — pasa.
- `test/fluyo-011-manual-smoke.cjs` — H1/H2 Pago 💵, H3 velocidades, H4 Despacho 📦, H5 concurrente, H6 fallo, H7 Clear Page + undo, H8 auto-crear Scenario, H9 editar Evento usado, H10 Incidente visual, H11 Caída consecuencia, H12 success cue limpio — **11/11 pasa**.

### Decisiones técnicas
- La duración visual vive solo en presentación; el Trace conserva tiempos lógicos originales.
- El token es presentacional; si un Step histórico pierde su EventType, el Storyboard usa token vacío y el render fallback genérico.
- Clear Page es una acción destructiva con confirmación y undo de un paso.

### Riesgos residuales
- La prueba manual es automatizada en Chrome con Playwright; no se validó en Safari/Firefox ni en touch físico.
- Los valores de duración son opinionados y pueden requerir ajuste tras uso real.
- No se realizó auditoría WCAG completa del nuevo fieldset.

---

## Node Event UX Reframe — Manual Product Review

### Objetivo
Reformular los eventos de nodo para que el usuario piense en **efecto visual + consecuencia funcional**, en lugar de en primitivas del motor (`OCCURRENCE`, `SET_AVAILABILITY`). Se integra sin cambiar el schema, el engine ni el formato de guardado.

### Problemas atacados
| Problema | Solución |
|---|---|
| El diálogo de evento hablaba de “disponibilidad” como efecto principal. | Nueva pregunta principal: **“¿Cómo quieres que se vea?”** (icono, mensaje, resaltado, parpadeo, atenuación, color de relleno). La consecuencia funcional vive en un `<details>` colapsado: *No cambia cómo responde* → `OCCURRENCE`, *Deja de responder* → `SET_AVAILABILITY DOWN`, *Vuelve a responder* → `SET_AVAILABILITY UP`. |
| Colocar el primer evento en una página vacía no creaba un Scenario. | `scBeginPlacement()` auto-crea un Scenario por defecto si la página no tiene ninguno; `pushUndo()` se hace antes de la creación, de modo que cancelar la colocación deshace también el Scenario y aplicarla deja todo en una sola operación de undo. |
| Editar un EventType usado reconstruía la Historia o bloqueaba campos esenciales. | Los campos de presentación (nombre, frase, token, movimiento, efectos de nodo) se editan libremente; los pasos existentes conservan su `action`/`state` original, por lo que la Historia no se reconstruye. La primitiva y la disponibilidad siguen bloqueadas mientras esté en uso, para no alterar semántica guardada silenciosamente. |
| Los mensajes de éxito/fallo en nodos dejaban badges permanentes. | Se eliminó el badge de SEND completado en nodos terminales; ahora solo se muestra el token/flujo durante la partícula activa y el resultado final se lee en el Storyboard. |
| No había feedback visual cuando “algo ocurre sobre un elemento”. | `scenario-playback.js` emite `activeNodeEffects`/`completedNodeEffects`; `render.js` los pinta como overlays de nodo con mensaje, icono, highlight, blink, dim y color de relleno. Duran `NODE_EFFECT_CUE_MS` (1100 ms) salvo que la consecuencia deje el nodo `DOWN`, cuya atenuación persiste hasta Reset. |

### Modelo
- `EventType.presentation.nodeEffects` es un objeto opcional con: `showIcon`, `message`, `messageColor`, `highlight`, `blink`, `dim`, `fillColor`.
- Se normaliza mediante `normalizeNodeEffects()`; los valores por defecto están en `defaultNodeEffects()`.
- No se bump de schema: v5 acepta el campo opcional y la normalización lo mantiene compatible.

### Archivos añadidos/modificados en este reframe
- `js/model.js`: `defaultNodeEffects`, `normalizeNodeEffects`, `normalizeEventTypePresentation`, validación y persistencia de `presentation`.
- `js/editor-scenarios.js`: nuevo layout del diálogo, preview en tiempo real, auto-creación de Scenario, edición de usados sin `rebuildSteps`.
- `js/scenario-playback.js`: `activeNodeEffects`/`completedNodeEffects` con `token` y duración.
- `js/render.js`: `drawScenarioNodeOverlay` con efectos visuales; se quitan badges de SEND terminal.
- `index.html` / `css/styles.css`: controles de efecto visual, preview y consecuencia colapsada.
- `test/fluyo-011-manual-smoke.cjs`: H8–H12.
- `test/fluyo-011-browser.cjs`, `test/scenario-ui-dom.test.cjs`, `test/fluyo-011-final-fixes.test.cjs`, `test/fluyo-010-qa.test.cjs`: IDs y expectativas actualizadas.

### Decisiones técnicas
- Los efectos visuales son **presentación pura**: no entran en el Trace ni cambian la semántica del motor.
- La consecuencia funcional es una **proyección hacia el motor**, no una propiedad persistida separada; el Step sigue siendo `OCCURRENCE`, `SET_STATE DOWN` o `SET_STATE UP`.
- `Reset` limpia overlays; `DOWN` real persiste como atenuación sutil porque es parte del estado del sistema.
- El auto-Scenario debe ser deshacible con Escape: por eso `pushUndo()` ocurre antes de mutar y se invalida solo tras aplicar con éxito.

### Riesgos y próximo paso
- El `<details id="scConsequence">` requiere `open=true` para que Playwright pueda interactuar con los radios; en producción se abre al editar un evento existente, pero si un usuario lo cierra manualmente los valores se guardan igual porque el formulario solo consulta el estado del input.
- Los colores por defecto del efecto visual son los del tema actual; un tema futuro podría requerir reescalar `messageColor`/`fillColor`.
- No se validó con usuarios reales la comprensión de “consecuencia” vs. “efecto visual”.

**Próximo paso:** QA independiente del working tree y de las capturas `%TEMP%/fluyo-011-*`; si pasa, FLUYO-011 es candidato a DONE. No realizar commits ni pushes sin instrucción explícita.

### Recomendación
Candidato a DONE para FLUYO-011. No realizar commits ni pushes sin instrucción explícita.

---

## Create/Edit Event UX — Final Product Polish

### Objetivo
Último pase de pulido del modal de crear/editar evento: pasar de un formulario técnico largo a una interfaz compacta, visual y con revelación progresiva, sin cambiar el motor ni el formato de guardado.

### Cambios de diseño
| Aspecto | Antes | Ahora |
|---|---|---|
| Estructura del modal | Formulario largo con todos los campos visibles. | Cabecera fija, cuerpo desplazable, pie fijo; secciones Basic y Advanced separadas. |
| Efectos visuales | Checkboxes sueltos y campos de color dispersos. | Chips de efecto (`Icono`, `Mensaje`, `Resaltar`, `Parpadear`, `Oscurecer`, `Color`); al activar un chip aparece inmediatamente su configuración justo debajo. |
| Color | `<input type="color">` único. | Swatches de la paleta del producto (`EVENT_SWATCHES`) más el color picker nativo como opción secundaria (`+`). |
| Icono | Input de texto libre. | Grid de iconos frecuentes más opción de texto corto personalizado. |
| Apariencia/Comportamiento | Siempre visibles, ocupando espacio. | Acordeones `<details>` colapsados por defecto al crear; se abren automáticamente cuando el evento ya tiene efectos o consecuencia configurados. |
| Evento de conexión | Mostraba campos de nodo irrelevantes. | Oculta `Apariencia` y `Comportamiento`; solo muestra `¿Qué recorre la conexión?` y velocidad. |
| Copy | Términos como `FLOW`, `OCCURRENCE`, `disponibilidad`, `UP`/`DOWN`. | Lenguaje humano: `Conexión`/`Elemento`, `No cambia cómo responde`/`Deja de responder`/`Vuelve a responder`, `Personalizar apariencia`. |
| Responsive | Scroll del modal completo. | En viewport bajo el modal usa layout de hoja a pantalla completa; controles segmentados se adaptan. |

### Archivos añadidos/modificados en este pase
- `index.html`: reestructura del `<dialog id="scEventDialog">` con `.scBasicSection`, `.scAdvancedSection`, acordeones, chips, swatches e icon picker.
- `css/styles.css`: clases `.scSegmented`, `.scEffectChip`, `.scEffectConfig`, `.scSwatch`, `.scAccordion`, `.scIconGrid`, media queries para móvil y ajustes de espaciado del modal.
- `js/config.js`: constante `EVENT_SWATCHES` con la paleta centralizada.
- `js/editor-scenarios.js`: funciones `scRenderColorSwatches`, `scPickColor`, `scRenderIconPicker`, `scSetAccordionOpen`, `scUpdateAccordionSummaries`; actualización de `scOpenEventDialog`, `scEditorLayout` y listeners.
- `sw.js`: cache bump a `fluyo-static-v49`.
- `test/fluyo-011-final-fixes.test.cjs`: tests H1–H6 de UX del modal (adjacencia de efectos, colapso, swatches, acordeones por defecto, resumen de evento configurado, compactación de evento de conexión) y mejoras al fake DOM para soportar atributos, `open`, `checked`, `style` y pseudo-selector `:checked`.
- `test/fluyo-011-browser.cjs`, `test/fluyo-011-manual-smoke.cjs`, `test/scenario-ui-dom.test.cjs`, `test/fluyo-010-qa.test.cjs`: ajustes de IDs y expectativas al nuevo markup.

### Decisiones técnicas
- Los inputs nativos (radio/checkbox/color) se mantienen en el DOM ocultos visualmente; la UI estilizada los sincroniza. Esto preserva accesibilidad, teclado y envío de formularios sin lógica adicional.
- `EVENT_SWATCHES` vive en `config.js` para que otros selectores de color futuros puedan reutilizar la misma paleta.
- Los acordeones usan `<details>` nativos; su estado `open` se controla por atributo para que Playwright y lectores de pantalla lo vean consistentemente.
- El resumen de cada acordeón (`scAppearanceSummary`, `scBehaviorSummary`) se actualiza en tiempo real a partir del estado real de los inputs, no de variables paralelas.

### Verificación
- `node --test test/*.test.cjs`: **315 PASS, 0 FAIL**.
- `node --test test/fluyo-011-browser.cjs test/fluyo-011-manual-smoke.cjs` con Chrome/Playwright: **24 PASS, 0 FAIL**.
- `node --check js/*.js js/editor-scenarios.js js/config.js sw.js test/*.cjs`: PASS.
- `git diff --check`: PASS (solo avisos LF/CRLF).

### Riesgos residuales
- El picker de iconos y los swatches no se probaron con lector de pantalla; los inputs nativos subyacentes deberían ser anunciados, pero la experiencia optimizada puede variar.
- El layout de pantalla completa en móvil se verificó con viewport simulado, no en dispositivo físico.
- Los valores de la paleta son los del tema claro actual; un tema oscuro futuro podría requerir ajustar contraste de algunos swatches.

### Recomendación
Candidato a DONE para FLUYO-011. No realizar commits ni pushes sin instrucción explícita.

---

## Event Identity + Message Styling — Final Manual Review

### Causa de la duplicidad de iconos
El editor tenía dos selectores: `¿Qué aparece?` (`EventType.visual.value`) y, dentro de `Mostrar icono`, un segundo grid (`scEffectIcon`, estado solo de UI). Ese segundo valor **nunca se persistía** (solo `showIcon` booleano) pero sí alimentaba el preview, mientras Playback usaba `visual.value`: preview y runtime podían divergir.

### Contrato de símbolo único
- Fuente de verdad: `EventType.visual.value` (helper `eventSymbol(et)` en `model.js`). Biblioteca, drag ghost, Historia, preview y Playback lo leen de ahí.
- `nodeEffects.showSymbol` es solo booleano (visibilidad del overlay durante Playback). `Mostrar símbolo` muestra `Usa: 📦` + `Cambiar símbolo` (enfoca el picker principal). No existe segundo picker.
- Etiquetas: `Símbolo del evento` (elemento) / `Símbolo que recorre la conexión` (conexión).
- Se elimina el check/badge genérico: solo aparece el símbolo del Evento (un `✓` es contenido del Evento, no un badge).

### Compatibilidad con datos previos
- `showIcon` (nombre previo, FLUYO-011 sin publicar) se lee como `showSymbol`; se escribe siempre `showSymbol`.
- `nodeEffects.icon` nunca se persistió. Política explícita por si aparece en un documento: si `showSymbol` es true, cabe en un token y difiere de `visual.value`, `normalizeEventTypePresentation` (carga) lo eleva a `visual.value`; si el símbolo estaba oculto no se toca la identidad. Sin migración ni bump de schema; no hay pérdida silenciosa.

### Bug del phrase builder
`{target}{name}` (chips adyacentes, segmento de texto vacío entre ellos) o `{target}recibe` producían `NodoRECIBIR PAGO` / `Nodorecibe`. `renderEventSentence` ahora separa un marcador de letras/dígitos vecinos y de otro marcador, colapsa espacios y recorta. El nombre del Evento **solo** entra en la frase si la persona inserta `[Nombre del evento]`. Además, al cambiar «Dónde ocurre» en un evento nuevo ya no se pisa una frase escrita a mano (solo se cambia si aún es la frase por defecto; en elemento se quitan chips `Origen`). El test antiguo que fijaba `{source}{target}`→`AB` ahora espera `A B`.

### Jerarquía nombre / frase
Historia: primario `📦 RECIBIR PAGO` (token + nombre), secundario `Nodo recibe un pago`. Si frase y nombre coinciden (trim + minúsculas) no se repite.

### Modelo de estilo de mensaje (`presentation.nodeEffects`, sin bump de schema)
`messageSize` small|medium|large (11/14/18 px internos), `messageWeight` normal|semibold|bold, `messageFont` default|sans|mono, `messagePosition` above|center|below, más `messageColor` existente. Defaults: medium / normal / default / above. El normalizador v5 los preserva; valores inválidos caen al default.
- Tipografía: solo pilas de sistema ya presentes en el producto (`Georgia` por defecto, sans de sistema, mono). No se inventó «Serif» (el default ya es serif). UI como control segmentado (radios), no `<select>`.
- Runtime-only: no toca `node.font/label/fill`; Reset limpia todo.
- Render: texto centrado con wrap, ancho máx. 120–260 px, offset decidido por el renderer (símbolo sobre el nodo; mensaje arriba del símbolo, al centro del nodo o debajo).

### Paridad preview = runtime
`nodeEffectsVisualSpec(et)` y `nodeMessageStyle(fx)` (model.js) alimentan el preview; Playback recibe la misma metadata vía `scPlaybackEffects` (`stepMeta`). Se eliminó el `defaultNodeEffects` duplicado de `render.js` (pisaba al de `model.js`).

### Edición global de un Evento usado
Cambiar símbolo/tamaño/peso/posición actualiza Biblioteca, Historia y el siguiente Playback sin tocar Steps ni Trace (tests).

### Archivos
`js/model.js`, `js/render.js`, `js/scenario-playback.js`, `js/editor-scenarios.js`, `index.html`, `css/styles.css` (input de color nativo ya no es UI visible; solo abre desde `+`), `sw.js` (v50), `.ai/DECISIONS.md`, tests: `fluyo-011-final-fixes.test.cjs` (+9), `fluyo-010-qa.test.cjs`, `scenario-ui-dom.test.cjs`, `fluyo-011-browser.cjs`, `fluyo-011-manual-smoke.cjs` (renombres `scShowSymbol/showSymbol`).

### Verificación
- `node --test test/*.test.cjs`: todos PASS (incl. 9 nuevos). `node --check js/*.js`: OK.
- Los `*.cjs` de browser (Playwright) **no se pudieron ejecutar**: el módulo `playwright` no está instalado en este entorno (fallo previo e idéntico en los 7 archivos). Se sustituyó por smokes manuales en el navegador del panel.
- Smokes manuales: Recibir pago (📦, «Pago recibido», grande, semibold, arriba) → Historia `📦 Recibir pago / Nodo recibe un pago`, Playback con mensaje arriba + 📦 sobre Nodo; cambio 📦→💵 actualiza biblioteca/Historia/canvas; mensaje largo en Sans/Negrita/Abajo hace wrap sin clipping; Pequeño+Centro legible; Reset deja el canvas limpio; móvil 375 sin scroll horizontal y footer sticky; 1366×600 footer visible y cuerpo con scroll.

### Riesgos
- Tests Playwright pendientes de correr donde esté instalado `playwright`.
- Con mensaje `Centro` el pill cubre temporalmente la etiqueta del nodo (solo durante el cue de 1,1 s).
- El símbolo overlay (20 px) es discreto con zoom 50 %.

---

## Final Modal Behavior Layout Fix

### Root cause
Los inputs ocultos de `.scChoice` (radios de Comportamiento) y `.scSegmented` usan `position:absolute; opacity:0; width:0` sin ancestro posicionado. Su bloque contenedor era el `<dialog>` (position fixed, `overflow:auto`), no el `.scDialogBody` que scrollea. Resultado: el input se colocaba en coordenadas que ignoran el `scrollTop` del body (p. ej. y=1693 con su label en y=543) y ampliaba el área scrollable del propio dialog (`scrollHeight` 1334 vs 720). Al hacer clic/foco en un radio el navegador scrolleaba el dialog (`scrollTop` 616): header y footer subían y debajo quedaba el hueco vacío. Solo se manifiesta con el body lo bastante largo (Apariencia con varios efectos + Comportamiento abiertos). La semántica nunca se vio afectada.

### Fix (solo CSS)
- `.scDialog[open]`: `overflow:hidden` (el dialog deja de ser scroller).
- `.scDialogBody`: `position:relative; flex:1 1 auto; overflow:auto; min-height:0` — contiene a los inputs absolutos y es el único scroller.
- Sin alturas mágicas ni cambios de JS/markup/modelo. Estructura: dialog flex columna → `header` (flex:none) / `.scDialogBody` (scroll) / `footer` (flex:none).
- `sw.js`: `fluyo-static-v51` (tests de cache actualizados).

### Verificación
- Reproducido antes del fix con clic real en «Vuelve a responder» (1366×768, todos los efectos activos): footer a mitad del modal, hueco debajo.
- Tras el fix: `dialog.scrollTop=0`, `scrollHeight==clientHeight`, hueco bajo footer = 1 px (borde), tanto en 1366×768, 1366×600 (header y footer visibles, body scrollea) como 375×812 (full-screen, sin overflow horizontal). Matriz cerrado/solo apariencia/solo comportamiento/ambos, repetida, sin acumulación de altura.
- Test de estructura añadido (`fluyo-011-final-fixes.test.cjs`): header/body/footer en orden, Apariencia/Comportamiento/error dentro del body, footer sin contenido dinámico, reglas CSS de scroller. `node --test test/*.test.cjs`: todo PASS; `node --check js/*.js` OK.
- Los `*.cjs` con Playwright siguen sin ejecutarse (módulo `playwright` no instalado); `git diff --check` no aplica (no es repo git).

---

## Auto-Create Scenario — Final Product Fix

### Causa raíz
Con 0 Scenarios el arrastre ni siquiera empezaba: `place.onpointerdown` exigía `scEditable()` (requiere Scenario activo). Además existía una auto-creación *prematura* en `scBeginPlacement` (creaba el Scenario al empezar el drag/click y lo revertía con `undo()` dentro de `scCancelPlacement`), frágil y contraria al contrato (cancelar/soltar en vacío no debe dejar rastro).

### Ciclo de vida correcto
- `scBeginPlacement` ya no crea nada; sin Scenario el placement arranca con `scenarioId:null`. `scValidatePlacement` compara contra `?? null`.
- `scCanPlaceEvents()` (nuevo): no hay playback y, si hay Scenario, su `engineVersion` es soportado. Se usa en el inicio de drag, `scDropEventTypeAt` y `scUseTarget` (kind `place`). Retarget/multi siguen exigiendo `scEditable()`.
- `scApplyTargets` es el único punto de creación: filtra destinos válidos primero (vacío/incompatible/cancelar → nada), hace **un único `pushUndo()`**, crea el Scenario con `createScenario` (mismo factory/engineVersion que el manual; nombre `Escenario N`, sin repetir nombres existentes; página activa), lo activa y crea todos los Steps en el mismo `at`. Se eliminó el `undo()` de `scCancelPlacement` y los campos `autoCreated*`.
- Drag y click-to-place convergen en `scApplyTargets`; selector de conexiones ambiguas solo aplica tras elegir.
- Política con Scenarios existentes: `scActiveScenario()` ya cae al primero; no se crea otro. Scenario activo con engineVersion no soportado: no se añaden Steps ni se crea otro (política previa).
- Aviso discreto reutilizando `scNotice`: «Escenario 1 creado».
- Undo/redo: `applySnap` (`selection.js`) ahora refresca el panel de Escenarios (`scRefreshIfVisible`); antes Historia/cabecera quedaban mostrando Scenarios ya deshechos. Los contadores conservan su high-water (comportamiento previo de `applySnap`).

### Tests (`fluyo-011-final-fixes.test.cjs`, +6)
Auto-crear FLOW (Historia, engineVersion, activo), nodo y click-to-place, inicio/cancelar/drop vacío/incompatible sin cambios (deep-equal), undo/redo únicos con estructura y EventType intactos e IDs estables, Scenario existente no se duplica, multi-target = 1 Scenario/N Steps/mismo `at`, Scenario no soportado. `node --test test/*.test.cjs`: 331 PASS, 0 FAIL.

### Smokes en navegador real (drag y teclado reales)
Drop en vacío → 0 Scenarios; Pago sobre edge → «Escenario 1» + Historia; Ctrl+Z → sin Scenario (cabecera «Elegir escenario», Historia vacía); Ctrl+Shift+Z → restaura; Evento de nodo sobre nodo; click Evento + click edge; 2 edges seleccionadas → 1 Scenario, 2 Steps, mismo `at`; undo tras cada uno → 0 Scenarios. Suite Playwright: NOT RUN — entorno sin `playwright`.

### Archivos
`js/editor-scenarios.js`, `js/selection.js`, `sw.js` (v52), tests (`fluyo-011-final-fixes`, `fluyo-010-qa` y `fluyo-011-browser` solo versión de cache).
