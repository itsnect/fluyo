# FLUYO-012 — Scenario Interaction & Visual Polish

Estado: LISTO PARA CIERRE — QA final de producto (012.1-QA) hecho; sin commit ni push
Owner/agente actual:

## Objetivo

Hacer que construir y reproducir una Historia se sienta directo y natural: Historia reordenable por arrastre, duración visual configurable para Eventos de elemento, overlays integrados en el Canvas y cues de Playback con entrada/salida suaves. Sin nuevas capacidades semánticas del motor.

## Por qué

La revisión final de FLUYO-011 dejó la percepción «funciona, pero se siente mecánico». Esta tarea pule interacción y presentación.

## Alcance

### Incluye
- Drag & drop de apariciones dentro de Historia sobre la semántica existente de Mover antes/después.
- `Duración visual` (Breve/Normal/Largo/Personalizado) en Personalizar apariencia.
- Composición de símbolo + mensaje, z-order estable, fill/dim/highlight recortados a la forma del nodo.
- Cues breves de éxito/fallo en el Canvas (sin badge).
- Fade in/out de cues, reduced motion.

### No incluye
Nuevas primitives, retries, latency, branching, conditions, variables, Pause, scrub, velocidad global, Present, Share Playback, editor de animación, sonido.

## Contexto necesario
`AGENTS.md`, `.ai/PRODUCT.md`, `.ai/ARCHITECTURE.md`, `.ai/DECISIONS.md`, `FLUYO-009/010/011`.

## Criterios de aceptación
Ver «Evaluación A–I» abajo: todos cumplidos (sujeto a QA independiente).

## 1. Semántica de reordenar (documentada, preservada)

Antes (FLUYO-011), `Mover antes/después` ordenaba los Steps por `(at, posición en array)` e **intercambiaba** el Step con su vecino: los timestamps se quedaban en sus posiciones («ranuras») y el array pasaba a ser la lista ordenada. Esa semántica se extrae sin cambios a `storyboardMoveByOne` (`js/model.js`); `scMoveStep` la invoca.

Reglas (comentadas en `model.js`):
- Orden efectivo = `at`, y a igualdad **posición en el array** (nunca `step.id`, nombre ni destino). Sigue siendo así en el motor (`enqueueSteps`).
- **Instantes = ranuras**: el contenido se mueve, los tiempos se quedan, así el ritmo («1 s después… 4 s después…») se conserva y no se inventan timestamps.
- **Hueco entre momentos** (`storyboardMoveStep`, `{kind:"gap"}`): sólo para un Step que es su propio momento; rota momentos conservando sus tiempos. Coincide con N × `Mover antes/después` cuando no hay simultáneos (test de equivalencia).
- **Unirse a un momento** (`{kind:"join"}`): `at` = `at` del ancla, posición de array antes/después de ella; el resto de tiempos no cambia; un momento que queda vacío desaparece.
- **No soportado v1 (documentado)**: sacar un Step de un momento simultáneo hacia un hueco entre momentos — exigiría inventar un instante. Se hace con Mover antes/después o editando la espera. Tampoco se arrastra el grupo completo (opcional).

## 2. Drag & drop en Historia

- Handle discreto (`⋮⋮`, opacidad .35, visible en hover/foco) por aparición; no existe durante Playback ni para filas con destino perdido.
- Pointer Events con pointer capture: umbral de 4 px, ghost (símbolo + nombre), fila origen atenuada, autoscroll del panel, indicador de drop (`soltar aquí` entre momentos / `al mismo tiempo` para unirse). El tiempo sigue viviendo en el hueco entre momentos (etiquetas de delay); el timestamp técnico no se muestra.
- Zonas (`storyboardDropTarget`, pura): tercio superior/inferior de una fila de un momento = hueco antes/después; centro de una fila única = unirse; entre filas de un momento simultáneo = unirse en esa posición. Los destinos sin cambio no muestran indicador ni crean undo.
- **Undo/redo**: un drop con efecto = un `pushUndo()`. Escape / `pointercancel`: sin cambios de documento, selección ni undo. Notificación «Historia reordenada.».
- **Alternativa accesible**: menú Mover antes/después intacto; además `Alt+↑/↓` sobre el handle.
- **Multi-target**: siguen siendo N Steps con el mismo `at`; no hay objeto `Moment` persistido.
- **Simultáneos**: array-order sigue siendo el desempate (test con ids engañosos comprobando el Trace).

## 3. Duración visual de Eventos de elemento

- Modelo: `presentation.nodeEffects.visualDuration` ∈ `brief|normal|long|custom` y `visualDurationMs` (derivado; sólo manda en `custom`). **Sin bump de schema**: el normalizador v5 los preserva; Eventos legacy sin duración = `normal`.
- Presets: Breve 700 ms · Normal 1500 ms · Largo 3000 ms. (El default previo era 1100 ms; Normal sube a 1500 ms — cambio visual leve, sin efecto semántico.)
- Personalizado: segundos (input 0,3–10). **Límites**: 0,3 s mín. / 10 s máx. `parseVisualDurationSeconds` rechaza `0`, negativos, NaN, vacío, <0,3 o >10 (el guardado muestra «Escribe una duración entre 0,3 y 10 segundos.»); el normalizador acota valores persistidos fuera de rango y cae a Normal si es NaN.
- Ayuda: «Esto sólo cambia cuánto tiempo se ve el efecto. No cambia cuándo ocurre el evento.»
- **Garantía**: la duración se consume sólo en `scenario-playback.js` (`cueDuration`) vía `stepMeta`. El motor no la ve → Trace idéntico (test `Trace deep-equal`). La **consecuencia funcional persiste** al terminar el cue (test: nodo `DOWN` sigue `DOWN` y el SEND posterior falla).
- Ciclo de vida: `scTick` ahora espera a que terminen los cues de nodo; Reset descarta el playback (los cues no reaparecen).

## 4. Composición de overlays (`render.js`)

- `computeNodeCueLayout` (pura, testeable con `measure` inyectado): símbolo sobre el nodo; mensaje **arriba** apilado sobre el símbolo (sin solaparse), **abajo** bajo el nodo, **centro** dentro del nodo con ancho ≤ nodo, translucidez .92 y wrap. Wrap con ancho máx. 140–260 px. Colita hacia el elemento para que el mensaje pertenezca al diagrama.
- Z-order: base → fill/dim/highlight (en `drawNode`, recortados con `shapePath`+clip, por tanto siguen la forma real) → conexiones y tokens → símbolo/mensaje (pase posterior por nodo) → UI de selección. Dim .30 (legible), DOWN persistente .26.
- Cues concurrentes: cada cue conserva alpha/duración propios; fill/dim/highlight se dibujan por cue; para símbolo/mensaje gana el cue iniciado más recientemente (`nodeTextCue`) y al terminar vuelve a verse el anterior. Nada se escribe en `node.fill/label/font/opacity` (test estático + diseño runtime-only).

## 5. Cues de éxito / fallo

- Éxito: pulso verde que se expande y se desvanece en la punta de la conexión. Fallo: token que se desvanece en el último tramo + pulso rojo (en el destino; en el origen si `source_down`). Duración fija y central `TERMINAL_MS` = 700 ms, no configurable. Sin badges; Historia conserva ✓/✕ y la razón. Con `prefers-reduced-motion` el pulso no se expande, sólo se desvanece.

## 6. Transiciones de Playback

- `cueEnvelope(elapsed, duration)`: fade in 140 ms, fade out 280 ms (acotados a 1/3 de la duración), escala 0.92→1 en la entrada. Reduced motion: sin escala ni parpadeo (el blink pasa a resaltado estable; el mensaje/símbolo siguen visibles). FLOW conserva sus duraciones fast/normal/slow; sin velocidad global, Pause ni scrub.
- Historia: transición suave de fondo/color de estado (.25 s); detalle de fallo con fade; sin cambio de layout brusco.

## 7. Responsive

1366×768 verificado en navegador: sin scroll horizontal, handle de 16 px (14 px ≤480 px) sin robar ancho, etiquetas de delay y grupos simultáneos legibles, Mover antes/después sigue en el menú. Touch: Pointer Events con `touch-action:none` en el handle (no optimizado a fondo).

## Archivos modificados
`js/model.js` (semántica storyboard, duración visual), `js/editor-scenarios.js` (drag, UI de duración, fin de playback), `js/scenario-playback.js` (duración por cue, envolvente, datos de cue), `js/render.js` (overlays, cues éxito/fallo), `index.html` (campo Duración visual), `css/styles.css`, `sw.js` (**v53**), `.ai/DECISIONS.md` (41–43), `.ai/ARCHITECTURE.md`, tests: `test/fluyo-012.test.cjs` (nuevo, 27), `test/fluyo-011-final-fixes.test.cjs` (+6 y ids de duración en el DOM falso), `test/fluyo-010-qa.test.cjs` y `test/fluyo-011-browser.cjs` (constante de cache).

## Pruebas
- `node --test test/*.test.cjs`: **364 PASS, 0 FAIL** (antes 331).
- `node --test test/*.cjs`: 371 PASS / 7 FAIL — los 7 son los `*-browser.cjs`/`manual-smoke` de Playwright (`Cannot find module 'playwright'`, fallo previo e idéntico, entorno sin el módulo). NOT RUN.
- `node --check js/*.js sw.js`: OK. `git diff --check`: sin errores de espacios (sólo avisos LF/CRLF).
- Cobertura nueva: reorder básico, equivalencia drag≡Mover antes, hueco no-op, momentos simultáneos, unirse al grupo + `at`, array-order con ids engañosos consumido por el motor, extracción no soportada, multi-target, inmutabilidad de entrada, drop targets, undo único, cancel, lock en Playback, presets/custom/bounds/NaN, legacy, Trace invariante, cue dura lo configurado (700/1500/3000/2500), consequence persiste, cues solapados independientes, reset, éxito/fallo con ventana fija, layout de overlay (above/center/below, wrap, sin solapamiento), política del cue más reciente.

## Smokes en navegador (panel integrado, servidor estático local)
Hecho: drag real Aprobación → entre Pago y Despacho (ritmo 1 s/4 s conservado) y Ctrl+Z restaura exacto; drag a medias con ghost/indicador y Escape sin cambios ni undo; unirse a un momento simultáneo con etiqueta «al mismo tiempo»; Aprobación con 📦/✓ + «Aprobado» grande semibold arriba + Largo + highlight: mensaje sobre símbolo sobre nodo, integrado; diálogo con Duración visual (Personalizado 0 → error; 2,5 → `custom:2500`); pulso verde de éxito congelando el reloj; 1366×768 sin scroll horizontal; Historia con 9 eventos y grupos.
NO hechos / limitados: cronometrado fino Breve/Normal/Largo (verificado por test de Playback, no con cronómetro), Caída→FLOW fallando con consecuencia (cubierto por test de motor/playback), cue de fallo visual, mensaje largo en screenshot, concurrencia Pago slow + Despacho fast visual (cubierta por tests de playback), suite Playwright.

## Screenshots
Capturadas sólo en la conversación (no añadidas al repo): Historia editable, ghost de arrastre, overlay símbolo+mensaje, diálogo con Duración visual, pulso de éxito, 1366×768. Faltan drop-indicator en viewport amplio, brief vs long comparativo y cue de fallo.

## Evaluación A–I
A. Reordenar por drag: SÍ. B. Reutiliza semántica, sin timestamps arbitrarios: SÍ (equivalencia probada). C. Colocar en grupo simultáneo con mismo `at`: SÍ. D. Duración visible decidible: SÍ. E. Trace idéntico: SÍ. F. Consequence persiste: SÍ. G. Overlays integrados: SÍ (revisión visual del agente; QA de producto pendiente). H. Éxito/fallo dejan Canvas limpio: SÍ. I. Playback conserva simultaneidad y cues solapados: SÍ.

## Pendientes / riesgos
- Extracción de un Step de un momento simultáneo a un hueco y drag de grupo completo: fuera de v1 (documentado).
- Con mensaje `Centro` el pill (translúcido) sigue tapando parcialmente la etiqueta durante el cue.
- Normal pasa de 1100 a 1500 ms para Eventos de nodo existentes.
- Drag táctil: no verificado en dispositivo real.
- Playwright no instalado: suites de navegador previas sin ejecutar.
- Símbolo/mensaje ya no comparten pase con la UI de selección (ahora quedan sobre ella): revisar en QA.

## Handoff

### Estado actual
Implementación completa en el working tree, sin commit. SW v53.

### Próximo paso concreto
Revisión de producto + QA independiente; ejecutar los `*-browser.cjs` donde exista `playwright`; decidir si se acepta Normal=1500 ms y si se quiere extracción de simultáneos en una tarea posterior.

---

# FLUYO-012.1 — Scenario Storytelling Refinement

Refinamiento de producto sobre FLUYO-012. Sin cambios en engine, Trace, Share, Viewer ni schema. SW **v54**. Sin commit ni push.

## Cambios conceptuales

**Fluyo cuenta historias**: una Historia es una sucesión de acontecimientos con esperas entre ellos, no una lista de pasos.

### A. Semántica temporal (documentada)
- *Antes (012)*: el modelo guarda `at` absolutos; Historia los muestra como esperas relativas («2 s después»). Reordenar rotaba contenido y dejaba los tiempos en sus ranuras (el ritmo no cambiaba), pero **unir un momento a otro dejaba los `at` posteriores intactos**, de modo que la espera del siguiente momento absorbía la del momento que desaparecía («3 s después» pasaba a «4 s después» sin que nadie lo tocara).
- *Ahora*: la Historia manda y el tiempo absoluto se deriva de ella. Regla final: **las esperas pertenecen a los huecos de la historia**. (1) Reordenar momentos conserva el ritmo (las esperas se quedan en los huecos). (2) Si un momento desaparece al unirse a otro, su espera se **colapsa**: los momentos posteriores se adelantan y conservan sus propias esperas. (3) El arranque de la historia se queda en el primer momento. No se inventan tiempos. Sin schema nuevo: los `at` siguen siendo la representación persistida y se recalculan desde la posición narrativa (`storyboardMoveStep`, `model.js`). Documentos existentes se leen igual.
- Descartado: que la espera viaje con la tarjeta arrastrada (obliga a inventar una espera para el primer momento desplazado) y `waits[]` persistido (exige schema).

### B. Lenguaje de la duración
«Duración visual» → **«¿Cuánto tiempo se ve?»**: *Poco tiempo · Normal · Mucho tiempo · Personalizado* (campo «Se ve durante … segundos»). Ayuda: «Esto solo cambia cómo se muestra. No cambia cuándo ocurre.» Sin ms ni jerga. Los ids/datos (`visualDuration`) no cambian.

### C. Composición de varios efectos en un nodo
**Política: apilar** (opción A). Los cues con símbolo/mensaje de un nodo se apilan: el más reciente pegado al elemento y los anteriores más lejos, hasta 3; cada cue conserva su fade y duración, así que al terminar el reciente los demás bajan sin perderse. Un mensaje en «Centro» sólo se dibuja si es el más reciente de los centrales (legibilidad). Fill/dim/highlight ya componían por cue. Descartadas: «último gana» (arbitraria, pierde información) y timeline con etiquetas «Ahora/Antes» (ruido visual).

### D. Lenguaje de resultados
Fuera «éxito/fallo» de la interfaz: Historia usa «No se completó» (+ «X no está disponible»); el registro técnico usa «Llegó», «Sale», «Ocurre», «Origen/Destino no disponible», «No llegó». En código/docs: *resultado positivo / negativo de un envío* (`drawScenarioEdgeOverlay`). Sigue sin perder información y sin badges en el Canvas.

### E. La aparición como objeto
Pulsar una aparición (fuera de Playback) selecciona su destino y abre su menú (agrupado en el QA final; antes eran 9 acciones planas). «Editar» reutiliza el modal (edita el Evento en todos sus usos; el modal ya lo avisa). «Duplicar» (revisado en el QA final, ver abajo) crea la copia en el mismo momento, justo debajo (una operación de undo). «Quitar de esta historia» se renombra a **Eliminar** (el Evento sigue en la biblioteca).

## Compatibilidad
Sin cambios de schema ni de engine. `normalizeNodeEffects` sigue aceptando `showIcon` y documentos sin duración (= Normal). Los `at` persistidos no se reinterpretan.

## Tests (nuevos en 012.1)
Ritmo de esperas conservado al reordenar; unir colapsa la espera y conserva las demás (hacia delante y hacia atrás); apilado de cues (orden, sin solape, máx. 3, un solo centrado, cue sólo-highlight no apila); lenguaje humano del campo de duración y ausencia de ms/jerga; lenguaje de resultados; menú de la aparición; Duplicar (undo único, ritmo); compatibilidad legacy; tres historias (negocio/sistema/humano) corren en el motor. Se suman a los de 012 (duración no cambia el Trace, cleanup, reset, undo/redo, simultaneidad).
`node --test test/*.test.cjs`: **372 PASS, 0 FAIL**. `node --check js/*.js sw.js`: OK. Los `*-browser.cjs` de Playwright siguen sin ejecutarse (módulo ausente).

## Smokes en navegador (panel integrado)
1. **Negocio** (Cliente → Comercio: 💵 Realiza pago, 📦 Envía producto, ⭐ Recibe producto + «¡Pedido recibido!»): Historia se lee «Realiza pago / Cliente paga a Comercio / 2 s después…»; menú de la aparición verificado; overlay múltiple con ⭐ «¡Pedido recibido!» y 📨 «Gracias por tu compra» apilados sobre Cliente, sin solapamiento.
2. **Sistemas** (Producer → Kafka → Consumer, «Kafka se cae»): el último publish falla con «Kafka no está disponible» (✕ en Historia), Canvas limpio al terminar. (Un primer intento pareció «pasar» por un error de mi script de prueba, que creó el Step como Ocurrencia en vez de disponibilidad; corregido y repetido.)
3. **Humano** (Empleado → Jefe → RRHH: 📝 Solicita permiso, 👍 Aprueba solicitud con «Aprobado» verde, 🗂️ Actualiza registro): no parece software.
Capturas vistas en la conversación: Historia negocio, Historia sistema, Historia humana, overlay múltiple, Playback (aprobación del Jefe). No se guardan en el repo.

## Riesgos / pendientes
- El menú de la aparición tiene 9 acciones; conviene que producto valore agruparlas.
- «Duplicar» usa la espera por defecto de 1 s (no pregunta).
- Apilado: con mensajes largos y 3 cues la pila puede salir del área visible del Canvas.
- Colapso de espera sólo aplica al unirse a otro momento; «Mover antes/después» plano no cambió.
- Falta cronometrar a mano los presets y probar touch real.

## Estado recomendado
EN CURSO → listo para revisión de producto / QA independiente.

---

# FLUYO-012.1-QA — Final Product QA & Story Semantics

Pase adversarial de producto sobre FLUYO-012.1: ¿el modelo mental «una historia con esperas entre acontecimientos» funciona de verdad? Sin cambios de schema, engine, Trace, Share ni Viewer. SW **v55**. Sin commit ni push. No se inició FLUYO-013.

## 1. Problemas encontrados y causa

1. **Eliminar dejaba esperas absurdas.** A·3 s·B·4 s·C, eliminar B → «A · 7 s · C». Causa: `scDeleteStep` sólo filtraba el Step; la política de colapso de 012.1 existía únicamente para «unirse a un momento». Dos reglas distintas para el mismo hecho («un momento desaparece»).
2. **Duplicar escondía un 1 s.** `DEFAULT_STEP_DELAY` se aplicaba sin que nadie lo pidiera y desplazaba toda la historia posterior. Causa: 012.1 asumió «copia = momento nuevo» para no tocar el modelo.
3. **El menú de una aparición tenía 9 filas planas** (Editar, Cambiar evento, Duplicar, Cambiar dónde ocurre, Aplicar también a…, Añadir…, Mover antes, Mover después, Eliminar): un panel administrativo. «Editar evento» vs «Cambiar evento» eran indistinguibles para alguien nuevo (uno edita la biblioteca, el otro sólo esa aparición).
4. El menú no podía expresar «unirse a un momento» (sólo el arrastre): menú y drag no cubrían las mismas operaciones.

No se encontraron discrepancias Historia↔motor: orden, `at`, Trace y Playback coinciden en todos los casos probados (ver 6).

## 2. Decisiones (también en DECISIONS 47–50)

- **Eliminar** comparte política con unirse (`storyboardCollapsedGroups`): la espera del momento que desaparece se colapsa; las demás se conservan.
- **Duplicar = Opción B (mismo momento)**. Evaluadas: A (inmediatamente después con separación mínima) obliga a inventar un instante o desplazar la historia; C (nuevo momento con espera explícita) añade fricción a una acción de un clic. B no inventa tiempo, no desplaza nada, es coherente con «Añadir otro evento al mismo tiempo» y la historia lo dice con la etiqueta «Al mismo tiempo». Si se quiere otro momento: Mover ▸. Sin schema. El 1 s ya no existe en el código.
- **Menú agrupado** con cabecera y submenús (ver 4). **Editar este evento…** (global; avisa «Cambia “X” en sus N usos») vs **Usar otro evento aquí…** (sólo esta aparición). **Cambiar dónde ocurre…** muestra «Ahora: Cliente → Comercio».
- Handle `⋮⋮` sin cambios: sólo él inicia el arrastre (la card no es draggable); equivalente por teclado Alt+↑/↓.

## 3. Semántica temporal final (inequívoca)

- El modelo persiste `at` absolutos; **Historia los deriva a esperas relativas en los huecos** y toda operación recalcula `at` desde la posición narrativa. Los `at` guardados no se «reinterpretan» al abrir: se leen tal cual. No hay contradicción: lo guardado es la proyección de la historia y ambas coinciden siempre (probado, incl. tras serializar).
- Orden efectivo = `at`; a igualdad, **posición en el array** (nunca `step.id`). El motor aplica la misma regla.
- **Base** A·2 s·B·5 s·C = t 0 / 2000 / 7000.
- **Mover antes** (C antes de B): A·2 s·C·5 s·B → `A@0 C@2000 B@7000`. El contenido se mueve; el ritmo (las esperas) se queda en los huecos.
- **Mover después** (A tras C): B·2 s·C·5 s·A → `B@0 C@2000 A@7000`.
- **Unirse a un momento**: `at` del ancla; si su momento original desaparece, su espera se colapsa (A·2 s·B·5 s·C, A se une a C → B·5 s·{C+A}).
- **Eliminar**: igual que unirse; si se elimina el primer momento, el siguiente pasa a ser el arranque (conserva el `at` inicial); eliminar un miembro de un grupo no mueve nada.
- **Simultaneidad**: reordenar dentro del grupo conserva el `at`; el desempate es el array (probado con ids 7/100/1/50/3: el motor ejecuta 50, 100, 1).
- **Sacar de un grupo a un hueco por arrastre: no soportado** (inventaría un instante). La UI lo rechaza sin cambios ni undo. Alternativas válidas: Mover antes/después (intercambia ranura) o editar la espera.
- **Duplicar**: mismo `at`, contiguo al original.
- **Undo/Redo** de drag, mover antes/después, unirse, eliminar, duplicar y cambiar espera: Steps, orden y `at` exactos. `nextStepId` nunca baja (decisión vigente: los ids no se reutilizan), por eso tras deshacer un Duplicar el contador queda +1; redo restaura el estado posterior incluyendo el contador.

## 4. Menú final de una aparición

```
💵 Pago
Cliente paga a Comercio
──────────────────────────
Editar este evento…            Cambia «Pago» en sus 3 usos
Usar otro evento aquí…         Sólo cambia esta aparición
──────────────────────────
Cambiar dónde ocurre…          Ahora: Cliente → Comercio
──────────────────────────
Duplicar                       Al mismo tiempo, justo debajo
Mover ▸                        Antes · Después · Al mismo tiempo que… ▸
Añadir al mismo tiempo ▸       Otro evento… · Esta misma acción en otras conexiones…
──────────────────────────
Eliminar
```

7 filas en el primer nivel (frente a 9). El submenú sustituye el contenido con «‹ Volver». Antes/Después se deshabilitan en los extremos.

## 5. Cambios (archivos)

`js/model.js` (`storyboardCollapsedGroups`, `storyboardRemoveStep`, `storyboardInsertDuplicate`), `js/editor-scenarios.js` (`scDeleteStep`, `scDuplicateStep`, `scStoryMenu`, `scMenuSections`, `scStepTitle`, `scWhereLabel`), `css/styles.css` (cabecera, separadores, hints), `sw.js` (**v55**), `.ai/DECISIONS.md` (47–50), `.ai/ARCHITECTURE.md`. Tests: `test/fluyo-012-1-qa.test.cjs` (nuevo, 30); ajustes en `fluyo-011-final-fixes` (Duplicar, menú), `scenario-ui-dom` (quitar colapsa), `fluyo-012` (menú); constantes de caché en `fluyo-010-qa` / `fluyo-011-browser`.

## 6. Tests

- `node --test test/*.test.cjs`: **402 PASS, 0 FAIL** (antes 372).
- `node --test test/*.cjs`: 409 PASS / 7 FAIL — los 7 son los `*-browser.cjs`/`manual-smoke` de Playwright (`Cannot find module 'playwright'`; **NOT RUN — environment**; no se instaló nada).
- `node --check js/*.js sw.js`: OK. `git diff --check`: sólo avisos LF/CRLF.
- Nuevos (editor real con DOM falso y undo real): caso base; Mover antes/después; drag ≡ menú; simultaneidad con ids engañosos; sacar de grupo; eliminar (medio / primero / último / miembro de grupo / arranque no nulo); duplicar (momento, grupo, límite); undo/redo exacto ×7 operaciones (steps, orden, `at`, contador); guardar → importar → deep link (codec real deflate) → copia editable con el mismo Trace; Playback de sólo lectura (sin handle, sin menú, sin mutaciones, esperas bloqueadas); menú agrupado sin jerga; Editar ≠ Usar otro; Mover ▸; Cambiar dónde ocurre; neutralidad de las tres historias (negocio, sistema, humana) sin `source/target/SEND/SET_STATE/UP/DOWN/success/failure/node/edge`; consecuencia funcional independiente de la duración visual. Cada caso comprueba el invariante **Historia (filas y esperas en el DOM) = timestamps = Trace = Playback**.
- Overlays, mensajes, cleanup, reset y duraciones siguen cubiertos por `fluyo-012.test.cjs` (apilado máx. 3, sin solape, un solo centrado, cue dura lo configurado, reset).

## 7. Browser smokes (panel integrado, servidor estático local; Playwright no disponible)

1. **Negocio** (Cliente→Comercio): Historia 💵/📦/⭐; **Mover antes** real → `2@0 1@2000 3@7000`; **Ctrl+Z** → `1@0 2@2000 3@7000`; **Ctrl+Shift+Z** → de nuevo `2@0 1@2000 3@7000`: exacto.
2. **Sistema** (Producer→Kafka→Consumer): Kafka DOWN, intento de envío → «Kafka no está disponible» (✕); Kafka queda atenuado al terminar el cue (la consecuencia persiste).
3. **Humano** (Empleado→Jefe→RRHH): cubierto por el test de neutralidad y por el smoke de 012.1; no repetido a mano en este pase.
4. **Simultaneidad**: Pago + Notificación + Actualización en «Al mismo tiempo»; arrastre real (PointerEvents sobre el handle) dentro del grupo → cambia el orden, `at` sigue 2000 en las tres, indicador «al mismo tiempo», un undo, aviso «Historia reordenada.».
5. **Duplicar**: desde el menú → `2@0 1@2000 4@2000 3@7000`; etiquetas «Al comenzar / 2 s después / 5 s después» + «Al mismo tiempo»; aviso «Duplicado al mismo tiempo, justo debajo.». Undo/redo cubiertos por test.
6. **Overlays**: tres eventos sobre el mismo nodo (⭐ «¡Pedido recibido!», 📨 «Gracias por tu compra», ⚠ «Revisión manual requerida antes de continuar con el proceso», Mucho tiempo): pila de 3 sin solapamiento, mensaje largo con wrap, legible. Reset deja el Canvas limpio y vuelven los handles/menú.
Nota de entorno: con el viewport emulado a 1366×768 el canvas no aparecía en la captura (artefacto del panel); se verificó a tamaño nativo del panel.

## 8. Screenshots

Sólo en la conversación (no en el repo): Historia negocio, menú agrupado (cabecera + 4 secciones), submenú Mover, grupo simultáneo tras el drag, duplicación, overlay triple, Historia de sistema con fallo, Reset limpio. No capturados en este pase: Historia humana y playback de la aprobación (vistos en 012.1).

## 9. Riesgos y pendientes

- Sacar un Step de un grupo simultáneo a un hueco por arrastre sigue sin soporte (documentado, DECISIONS 50).
- Duplicar deja la copia «al mismo tiempo»: quien esperaba una copia secuencial debe usar Mover ▸ o editar la espera (se comunica con el hint «Al mismo tiempo, justo debajo» y el aviso).
- El submenú «Al mismo tiempo que…» lista todas las demás apariciones (hay scroll en historias largas).
- Drag táctil y cronometraje manual de presets de duración sin verificar en dispositivo real.
- Playwright ausente: los `*-browser.cjs` no se ejecutaron.
- Normal = 1500 ms (en vez de 1100) sigue pendiente de aceptación de producto.

## 10. Evaluación A–L

A. Semántica temporal inequívoca: **SÍ** (sección 3, probada). B. Reordenar sin discrepancia Historia/motor: **SÍ** (invariante en cada test). C. Simultaneidad mantiene `same at`: **SÍ**. D. Undo/redo exacto: **SÍ** (contador monótono por diseño). E. Duplicar comprensible: **SÍ**. F. Menú no administrativo: **SÍ** (7 filas, 4 secciones, submenús). G. Editar vs Cambiar inequívocos: **SÍ**. H. Negocio, sistema y humano con el mismo modelo, sin jerga: **SÍ**. I. Overlays no se pisan: **SÍ**. J. Consecuencia funcional independiente de la duración visual: **SÍ**. K. Playback read-only: **SÍ**. L. Sin regresiones: **SÍ**, salvo suites Playwright NOT RUN (entorno).

## 11. Estado recomendado

**DONE** para FLUYO-012 / 012.1, condicionado a que producto acepte (a) Duplicar «al mismo tiempo» y (b) Normal = 1500 ms. Próximo paso: ejecutar los `*-browser.cjs` donde exista Playwright y verificar touch real; después, FLUYO-013 (no iniciado).
