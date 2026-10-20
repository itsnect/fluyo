# FLUYO-STEP-REVERSE-003 — «Invertir sentido» en el menú de un Step FLOW

Estado: **READY FOR PUSH** (revisión final aprobada y commiteada en `fluyo` el 20-10-2026; sin push y sin deploy).
Owner/agente actual: libre.

> Repo público: este documento solo contiene decisiones técnicas del proyecto (AGENTS.md §9).

## Objetivo

Dar al editor la acción que faltaba tras STEP-REVERSE-002: en el menú de un Step FLOW, **«Invertir sentido»** alterna `reverse` del
Step sobre la MISMA conexión (A → B ⇄ B → A). Reutiliza el contrato de 002 (`setStepReverse`, decisión 237), sin operación de autoría
nueva y sin tocar el contrato `reverse`, Semantic Scenarios ni `observedFlow`.

Base: `fluyo` main = `702f269` (producción v97). `CACHE` v97 → **v98**.

## Alcance

### Incluye

- La entrada «Invertir sentido» en el menú del Step (solo FLOW), su hint y su acción (una entrada de Undo/Redo).
- `CACHE` v98.
- La decisión 240.
- Tests: unidad, mutaciones, Chrome real y el helper `undoReverseUi` para los alcances antiguos.

### No incluye

- El atajo «Añadir la respuesta» o cualquier otro control (fuera por indicación de la tarea).
- `fluyo-mcp`, el kernel, el motor, la autoría por lote, Viewer/Present/Share (no cambian de código).
- Semantic Scenarios y `observedFlow`.

## Decisiones tomadas

Decisión **240** en `.ai/DECISIONS.md`. En resumen:
- **Dónde**: grupo «Dónde» del menú, justo después de «Cambiar dónde ocurre…».
- **Hint**: dice cómo QUEDARÁ («Pasa a: DB → Servicio»). 001-D10 proponía «Ahora: A → B», pero eso ya lo dice
  «Cambiar dónde ocurre…» justo encima: repetirlo no informa.
- **Acción**: `pushUndo` + `setStepReverse(sc, id, !reverse)` + `scCommit`. Una entrada de Undo, el panel se repinta al momento, la
  selección del Step no cambia (decisión 189). Normal → inverso escribe `reverse:true`; inverso → normal quita la clave (nunca `false`).
- **Guardas**: solo con la Historia editable (no reproduciendo, motor v2) y con la conexión presente. Sin conexión la entrada sale
  desactivada (el Step se repara con «Elegir otro»).
- «Cambiar dónde ocurre» no cambia: ya conservaba el sentido desde 002 (decisión 238), y se comprueba de nuevo después de invertir.

## Archivos modificados

Archivos servidos:

| Archivo | Cambio |
|---|---|
| `js/editor-scenarios.js` | `scStoryMenu`: la entrada en el grupo «Dónde» (solo `SEND`). Nuevas `scReverseMenuItem` (rótulo, hint, desactivada sin conexión) y `scToggleStepReverse` (la acción). |
| `sw.js` | `CACHE` v97 → **v98** |

`model.js`, `story-authoring.js`, `scenario-engine.js`, `flow-semantics.js`, Viewer, Present, Share, `index.html` y CSS **no cambian**
(lo comprueban B4 y E1).

Documentación: `.ai/DECISIONS.md` (decisión 240) y este documento.

Tests nuevos:
- `test/fluyo-step-reverse-003.test.cjs`: 14 pruebas.
- `test/fluyo-step-reverse-003-mutations.cjs`: 16 mutaciones.
- `test/fluyo-step-reverse-003-browser.cjs`: Chrome real.
- `test/fluyo-step-reverse-003-undo.cjs`: `undoReverseUi`, para los alcances antiguos.

Tests adaptados (mecánico):
- **Constante CACHE v97 → v98** en las suites que la fijan (65 archivos; precedente de 002 y FASE 3).
- **`undoReverseUi` antes de `undoReverse`** en los alcances de 019-4a, 4b, d6, flow-fade, hit-test, prskin, FASE 1/2/3 y en I3 de 002.
- **002 · I1** («el menú NO tiene Invertir sentido»): ahora lo comprueba sobre el texto sin 003 (`undoReverseUi`).

## Pruebas

- **`node --test test/fluyo-step-reverse-003.test.cjs`: 14/14.** Usa las funciones reales del editor sobre el kernel, `state.js` y
  `selection.js` reales (Undo/Redo de verdad). Cubre:
  - **menú**:
    - posición justo después de «Cambiar dónde ocurre…»;
    - sin la entrada nueva, el menú es el de `702f269` entrada a entrada;
    - hints «Pasa a: …» en los dos sentidos;
    - disponibilidad y ocurrencia no la tienen (menú idéntico a la base);
    - sin conexión: desactivada y sin efecto.
  - **acción**:
    - normal → inverso → Undo → Redo exacto sobre el documento entero;
    - una entrada de Undo y un commit;
    - la selección se conserva;
    - los demás Steps y la Historia (esperas, `nextStepId`…) intactos;
    - inverso → normal sin la clave, y dos inversiones devuelven el documento de partida;
    - en reproducción o con motor v1 no hace nada.
  - **después de invertir**:
    - etiqueta, frase y «Dónde»;
    - Trace con `reverse:true` y `source_down`;
    - `outcomes` y `activeSends`;
    - Duplicar hereda el sentido;
    - «Cambiar dónde ocurre» lo conserva.
  - **Share `#d=`**: el enlace lleva el Step invertido. El playback que usan Viewer y Present da el caption «No se completó · DB no está
    disponible», con `source_down` en el evento.
  - **alcance frente a `702f269`**: solo `editor-scenarios.js` y `sw.js`. `undoReverseUi` lo devuelve exacto.
- **Mutaciones (`node test/fluyo-step-reverse-003-mutations.cjs`): 16/16 detectadas.** Se juzgan con los bloques A–D, sin el de
  alcance, que mataría cualquier mutación sin decir nada. Lo que rompen:
  - el menú: sin la entrada, en Steps no FLOW, otro rótulo, el hint al revés, la posición;
  - la acción no alterna, escribe `false` o da la vuelta a la CONEXIÓN;
  - el Undo: sin entrada o con dos;
  - sin commit, o pierde la selección;
  - edita sin ser editable;
  - sin conexión: la entrada sigue activa, o la acción escribe igual;
  - «Cambiar dónde ocurre» olvida el sentido.
- **Chrome real (`node test/fluyo-step-reverse-003-browser.cjs`, Playwright vía `NODE_PATH`, service worker bloqueado): 68/68 en dos
  pasadas, sin errores de consola.**
  - **Editor a 1440 con ratón y a 390 con el dedo.** En el móvil, la hoja se abre con «Ampliar».
    - El menú real tiene «Invertir sentido» tras «Cambiar dónde ocurre…» («Ahora: Servicio → DB» / «Pasa a: DB → Servicio»). La
      entrada mide 296×51 px y cabe en pantalla.
    - El clic da la vuelta al Step 2 en la misma conexión. Hay una entrada de Undo y el panel dice al momento «DB responde a Servicio».
    - Ctrl+Z / Ctrl+Y en escritorio, y los botones Deshacer/Rehacer en móvil: exactos sobre el documento entero.
    - El Step 4 pasa de inverso a normal (sin la clave) y vuelve.
    - «Cae DB» no tiene la acción.
    - **Token pintado, frame a frame**: el Step 2 invertido baja de DB a Servicio (x 844 → 735) y la petición sube.
    - El motivo del Step 4 es «DB no está disponible».
    - Duplicar hereda `reverse`, y Undo quita la copia.
    - «Cambiar dónde ocurre…» dice «Ahora: DB → Servicio» y conserva el sentido al pasar a API → Servicio («Servicio responde a
      API»). Undo lo devuelve.
  - **Present** con el documento editado: el token baja y el mensaje dice «No se completó · DB no está disponible».
  - **Viewer `/s/`** a 1440 y a 390, con el enlace `#d=` creado desde el editor: llegan los Steps tal cual, el token baja y el mensaje
    es el mismo.
  - Capturas revisadas a mano (menú y panel invertido a 1440 y 390), fuera del repo.
- **Suites de alcance encadenadas (todas en verde)**:
  - 002: 34/34, y sus mutaciones 33/33;
  - 002 en Chrome: 50/50;
  - FASE 1 21/21, FASE 2 33/33, FASE 3 35/35;
  - 019-4a 19/19, 019-4b 12/12, 019-d6 21/21, 019-flow-fade 25/25, 019-hit-test 29/29, 019-prskin 4/4.
- **Regresión dirigida (menú, editor de Historias, Share/Viewer)**:
  - 012 34/34, 016 50/50, 013 11/11, 014 18/18, 015 24/24;
  - 017-1 34/34, 017-2 66/66, 017-3 59/59;
  - 018-3 35/35, 018-15, 018-18 13/13, 018-19, 018-21 20/20, 018-22 4/4;
  - 019-3, 010-qa 50/50;
  - scenarios 28/28, scenario-ui 12/12, scenario-playback 8/8, scenario-migration 14/14, scenario-post-qa 21/21,
    scenario-independent-qa 28/28, event-types 18/18;
  - share 10/10, qa-share 6/6, share-post-qa 9/9, viewer 28/28.
- No se ha corrido la batería completa, por indicación de la tarea.

## Pendientes / riesgos

- **Los fallos que quedan en la regresión dirigida no son de 003.** Se midieron contra una copia limpia de `702f269`
  (`git archive`).
  - Fallan igual en la base:
    - `012-1-qa` (28);
    - `scenario-ui-dom` (21);
    - `011-final-fixes` (14);
    - `017-2-qa` (1);
    - `018-17` (1);
    - `019-5` (1).
  - Son alcances «idénticos a HEAD», que fallan con cualquier cambio sin commitear y vuelven a pasar al commitear:
    - `018-23`;
    - `018-24`;
    - `019-1` #15;
    - `019-2` (3).
  - Dependen de tener `fluyo-mcp` al lado, y ya fallaban en 002 por el kernel sin sincronizar:
    - `018-25` (el fixture del MCP);
    - `018-27`.
- **Descubrimiento**: la acción vive dentro del menú del Step. 001 ya lo señalaba como riesgo. No se ha medido con usuarios; si cuesta
  encontrarla, el atajo «Añadir la respuesta» es el candidato natural (otro slice).
- **El MCP** sigue sin exponer `reverse` hasta que se sincronice su kernel. Este slice no lo toca.
- Con el dedo, Chrome pinta su resaltado de toque (un recuadro azul claro) sobre el menú abierto, en el sitio del «⋯» pulsado. Es
  anterior a 003 y no lo afecta.

## Revisión final (20-10-2026): READY FOR COMMIT

Se revisó el diff completo frente a `702f269`. No hubo cambios funcionales.
- **Código servido**: solo `js/editor-scenarios.js` y `sw.js`.
  - `editor-scenarios.js`: la entrada del menú, `scReverseMenuItem` y `scToggleStepReverse`.
  - `sw.js`: la constante, de v97 a v98.
  - El contrato `reverse`, el kernel (`model.js` y el motor), la autoría, Semantic Scenarios, Viewer, Present y Share no tienen diff.
- **Contrato de 001/002**: la acción solo llama a `setStepReverse` con la Historia editable (motor v2, sin reproducir), sobre un
  `SEND` con conexión.
  - Escribe `reverse:true` o quita la clave, nunca `false`.
  - No toca `id`, `at`, el orden, la conexión ni el EventType.
- **Tests de slices anteriores**:
  - 71 líneas cambian solo v97 → v98, y son idénticas salvo la versión.
  - El resto es el encadenado de `undoReverseUi` en los alcances antiguos y en I1/I3 de 002.
- **Hint «Pasa a: …» en vez de «Ahora: …» (desviación de 001-D10)**: se mantiene.
  - Los hints del menú describen el EFECTO de la acción: «Cambia “X” en sus N usos», «Sólo cambia esta aparición», «Al mismo
    tiempo, justo debajo».
  - «Ahora: …» ya está en la entrada de encima. Repetido, no informa y no distingue un Step normal de uno inverso. «Pasa a: …» sí.
  - Queda en la decisión 240.
- **Suites, de nuevo tras la revisión**: 003 14/14, 002 34/34, FASE 3 35/35.

## Handoff

### Estado actual

READY FOR PUSH. Implementado, revisado y commiteado en `fluyo`, sobre `702f269`, con CACHE v98. No hay push ni deploy, y `fluyo-mcp`
no se ha tocado. `.ai/tasks/FLUYO-019.4.md` es ajeno: queda fuera del commit y sin seguimiento.

### Próximo paso concreto

1. **Push** de `fluyo`, con el OK del PO, y comprobar que fluyo.space sirve v98.
2. Después, el port al MCP (`sync:kernel`, Zod de `reverse`, `describe_document` y `run_story`, README), que ya estaba pendiente desde
   002.
