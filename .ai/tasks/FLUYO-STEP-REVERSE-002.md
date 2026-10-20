# FLUYO-STEP-REVERSE-002 — Contrato `reverse` en el kernel y lectura en todas las superficies

Estado: **READY FOR PUSH** (QA del PO: PASS, 93/93 en Chrome real, 20-10-2026; commiteada en `fluyo`, sin push y sin deploy).
Owner/agente actual: libre.

> Repo público: este documento solo contiene decisiones técnicas del proyecto (AGENTS.md §9).

## Objetivo

Implementar el contrato de `.ai/tasks/FLUYO-STEP-REVERSE-001.md` (D1–D12): un Step `SEND` con `reverse: true` recorre su conexión
de `to` a `from`. Afecta al motor, el Trace, el playback, el texto, el token, la autoría y la validación. Todo documento anterior
debe seguir dando exactamente lo mismo.

## Alcance

### Incluye

- **Kernel**: `traversalEnds`, validación estricta, canonicalización de `false`, `stepDefinitionForEvent` / `retargetStep` con el
  sentido y `setStepReverse`.
- **Motor y Trace**: el recorrido real y `reverse:true` en los tres eventos del envío.
- **Lectura**:
  - el playback, `outcomes`, `sentence` y `caption`;
  - el token (`render.js`);
  - las superficies del panel de Historia y la confirmación de borrado.
- **Autoría por lote**:
  - `{from,to}` resuelve primero la directa y después la inversa;
  - `{edgeId,reverse}` y `{ref,reverse}`;
  - `retarget_step` puede dar la vuelta;
  - los resultados de `add_step` y `duplicate_step`.
- **Editor**: «Cambiar dónde ocurre» conserva el sentido; la colocación múltiple compara por (conexión, sentido) y hereda el
  sentido.
- `CACHE` v97 y las decisiones 234–239.

### No incluye

- El menú «Invertir sentido» y su texto (STEP-REVERSE-003).
- `fluyo-mcp`: `sync:kernel`, Zod y README son el paso siguiente.
- Semantic Scenarios y `observedFlow`.
- La deuda previa de otros tests.

## Decisiones tomadas

Están en `.ai/DECISIONS.md`, decisiones **234–239** (D1–D12 de 001, con número). Además, se cerraron estos detalles que 001 no
fijaba:
- **v1**: `reverse` vale en un SEND de cualquier versión del motor, igual que `eventTypeId`. El contrato no lo restringía. El
  editor y la autoría siguen editando solo v2.
- **`false` en el motor**: el motor solo acepta `true`. `false` lo quita la carga y nunca llega al motor. Si alguien llama a
  `runScenario` con datos sin normalizar que traen `false`, recibe `invalid_scenario`.
- **Diagnóstico de integridad**: `FluyoIntegrity` canonicaliza igual que la carga (`canonicalizePersistedStep`). Así, un
  `reverse:false` en otro Step no se señala como `invalid_step` cuando la carga falla por otro motivo.
- **Resultado de `retarget_step`**: `reverse` y `previousReverse` solo aparecen si alguno de los dos es `true`. Normal → normal da
  el resultado de siempre, byte a byte.
- **Mensaje `TARGET_NOT_FOUND` de `{from,to}`**: ahora dice que también se buscó la inversa. El código y los datos no cambian.
- **Precedencia por nivel**: si existe una directa, decide ella aunque haya varias inversas. La ambigüedad se mide solo en el
  nivel que decide.

## Archivos modificados

Archivos servidos:

| Archivo | Cambio |
|---|---|
| `js/model.js` | `traversalEnds` y `canonicalizePersistedStep`; `validatePersistedStep` (solo SEND, solo `true`); `normalizeScenarios`; `stepDefinitionForEvent(…, reverse)`; `retargetStep(…, reverse)`; `setStepReverse` |
| `js/scenario-engine.js` | Claves permitidas, el recorrido y `reverse:true` en `send_started`/`send_succeeded`/`send_failed` |
| `js/story-playback.js` | `outcomes` (`reverse`, `reasonNodeId`), `sentence` y `caption` con `traversalEnds` |
| `js/scenario-playback.js` | `reverse` en `activeSends`, `completedSends`, `logEvents` y `tick` |
| `js/render.js` | `drawScenarioEdgeOverlay`: copia invertida de `pts` para los envíos inversos |
| `js/story-authoring.js` | `targetOf` → `{id, reverse}`; `add_step`, `duplicate_step` y `retarget_step` |
| `js/document-integrity.js` | El diagnóstico canonicaliza antes de validar |
| `js/editor-scenarios.js` | `scEdgeLabel(id, reverse)`, `describeScenarioStep`, `scSendFailText` (nueva), `scRuntimeStateForStep`, registro, `scWhereLabel`, orden de «Esperar a que llegue…», retarget y colocación múltiple |
| `js/selection.js` | La confirmación de borrado nombra el recorrido |
| `sw.js` | `CACHE` v96 → **v97** |

`viewer.js`, `present-story.js`, `story-clock.js`, `flow-semantics.js`, `link-codec.js`, `share-url.js`, `index.html`,
`s/index.html` y CSS **no cambian** (lo comprueba el test I1).

Tests nuevos:
- `test/fluyo-step-reverse-002.test.cjs`: 34 pruebas.
- `test/fluyo-step-reverse-002-mutations.cjs`: 33 mutaciones.
- `test/fluyo-step-reverse-002-browser.cjs`: Chrome real.
- `test/fluyo-step-reverse-002-undo.cjs`: `undoReverse`, para los alcances antiguos.

Tests adaptados (mecánico):
- **Constante CACHE v96 → v97** en las 59 suites que la fijan (precedente de FASE 3).
- **`undoReverse` antes de `undo3`** en los alcances de 019-4a, 4b, d6, flow-fade, hit-test, prskin y FASE 1/2/3. En FASE 1/2/3
  hace falta además la lista `ONLY_REV`.
- **`fluyo-013.test.cjs`**: carga `config` + `safe-svg` + `model` antes que `story-playback.js`, como en Present y el Viewer.
  `caption` usa ahora `traversalEnds`.

## Pruebas

- **`node --test test/fluyo-step-reverse-002.test.cjs`: 34/34.** Cubre:
  - kernel: matriz de valores y acciones, canonicalización, `traversalEnds` atado al motor;
  - Trace byte a byte, `source_down`/`target_down` en los dos sentidos, ida y vuelta en el mismo momento, conexión bidireccional
    y bucle;
  - `outcomes`, `sentence`, `caption` y playback;
  - token y marcas (0,25 ↔ 0,75; la ruta no se muta; los dos sentidos a la vez);
  - autoría: directa, inversa, las dos, ambigua en cada nivel, inexistente, formas explícitas, incompatibles, retarget y duplicate;
  - integridad, Share `#d=` y editor (panel, motivo, registro, retarget con Undo/Redo, colocación múltiple, confirmación de
    borrado);
  - documentos antiguos: el corpus de `ejemplos/data` + `test/fixtures` frente a `544fd4b` es idéntico en carga, guardado,
    integridad, Trace, outcomes, frases, playback (40 ticks) y mensajes;
  - los mismos lotes de autoría dan lo mismo;
  - el lector `544fd4b` rechaza un documento con `reverse`;
  - alcance exacto.
- **Mutaciones (`node test/fluyo-step-reverse-002-mutations.cjs`): 33/33 detectadas.** Incluyen las cinco que pide la tarea:
  - R1: ignorar `reverse`;
  - R2 y R3: invertir source/target mal;
  - R4: `reasonNodeId` mal;
  - R5: token en el sentido de la conexión;
  - R6–R9: `reverse` inválido aceptado.
  Además: Trace sin la clave o con `false`, playback, caption, frase, outcomes, carga sin canonicalizar, integridad, autoría (sin
  la inversa, la inversa gana, ambigua, `{edgeId,reverse}`, `{from,to,reverse}`, elemento, retarget) y editor (retarget,
  colocación múltiple, etiqueta, motivo, registro, borrado).
- **Chrome real (`node test/fluyo-step-reverse-002-browser.cjs`, Playwright vía `NODE_PATH`): 50/50, sin errores de consola.**
  - **Superficies**:
    - editor a 1440 en plano;
    - editor a 1440 con la piel (diagrama en espejo, entrada por el este);
    - editor a 390 con el dedo;
    - Present;
    - Viewer `/s/` a 1440 y a 390.
  - **Token pintado, frame a frame**:
    - la petición sube de Servicio a DB;
    - la respuesta baja de DB a Servicio sobre la MISMA conexión;
    - la respuesta de Servicio a API también baja;
    - con DB caída, la respuesta sale de DB apagada (alpha ≤ 0,25).
  - **Piel**: el retorno sale del punto aterrizado (a 0,5 u), no del ancla lógica (a 8 u).
  - **Texto**:
    - panel: «DB responde a Servicio» y motivo «DB no está disponible»;
    - registro: «DB → Servicio · Origen no disponible»;
    - Present y Viewer: «No se completó · DB no está disponible».
- **Mutaciones de FASE 3** (`fluyo-scenarios-semantics-3-mutations.cjs`): 25/25, sus patrones siguen vigentes.
- **Regresión dirigida**: todas en verde salvo lo listado en «Pendientes».
  - scenarios 28/28, scenario-playback 8/8, scenario-migration 14/14, scenario-ui 12/12, scenario-post-qa 21/21,
    scenario-independent-qa 28/28, event-types 18/18;
  - 010-qa 50/50, 012 34/34, 013 11/11, 014 18/18, 015 24/24, 016 50/50;
  - 017-1 34/34, 017-1-qa 52/52, 017-2 66/66, 017-3 59/59, 017-3-qa 14/14;
  - 018-1 29/29, 018-2 14/14, 018-3 35/35, 018-4 18/18, 018-5 34/34, 018-6 8/8, 018-7a 3/3, 018-7a-domain 23/23, 018-7c 13/13,
    018-9 19/19, 018-22 4/4;
  - viewer 28/28, share 10/10, qa-share 6/6, share-post-qa 9/9;
  - FASE 1 21/21, FASE 2 33/33, FASE 3 35/35;
  - 019-4a 19/19, 019-4b 12/12, 019-d6 21/21, 019-flow-fade 25/25, 019-hit-test 29/29, 019-prskin 4/4.
- No se ha corrido la batería completa (46 suites), por indicación de la tarea.

## QA del PO (20-10-2026): PASS

Se hizo en Chrome real, con un script fuera del repo y el árbol servido con el service worker bloqueado. Resultado: **93/93 y
ningún error de consola**. No se cambió código.

**Fixture**: UNA conexión, Cliente → API. La misma conexión cuenta también API → Cliente con `reverse:true`:
- la petición (A → B) y la respuesta (B → A);
- cae Cliente: petición y respuesta en el MISMO momento;
- vuelve Cliente y cae API: otra vez las dos.

**Gemelo de comparación**: la misma página con la conexión dibujada API → Cliente.

**Criterio**: un SEND `reverse:true` se comporta exactamente como un recorrido B → A, sin modificar la conexión ni afectar a los
SEND normales.

Comprobado:
- **Equivalencia con el gemelo dibujado**, todo idéntico:
  - el Trace, salvo la marca `reverse`;
  - los resultados (`source_down`/`target_down` y `reasonNodeId`);
  - las frases y los mensajes;
  - la ruta;
  - los tokens frame a frame: 0,000 u de diferencia a igual progreso.
- **Normal frente a reverse**:
  - la marca `reverse:true` solo aparece en el Trace de los Steps inversos;
  - los SEND normales siguen la ruta de Cliente → API, y los inversos su copia invertida;
  - la conexión no cambia tras reproducir, autorizar ni retargetear.
- **source_down / target_down**:
  - con Cliente caído: petición `source_down`, respuesta `target_down`;
  - con API caída: petición `target_down`, respuesta `source_down`;
  - el token se apaga desde la salida cuando el origen está caído;
  - el panel, el registro, Present y el Viewer nombran el nodo correcto.
- **Piel Construido** (en espejo): la conexión aterriza 8 u antes del ancla lógica, y la respuesta sale del punto aterrizado de la
  silueta.
- **Autoría y retarget_step**:
  - `{from: API, to: Cliente}` usa la MISMA conexión con `reverse:true`; si existe la directa, gana la directa;
  - varias inversas dan `AMBIGUOUS_TARGET`; sin conexión, `TARGET_NOT_FOUND`; `{from,to,reverse}` da `INVALID_OPERATION`;
  - `retarget_step` vuelve al sentido normal, da la vuelta en el sitio y resuelve `{from,to}`;
  - lo que escribe la autoría se reproduce bien en el editor.
- **Editor**:
  - «Cambiar dónde ocurre…» (con el hint «Ahora: API → Cliente») conserva el sentido al pasar a otra conexión;
  - Ctrl+Z y Ctrl+Y son exactos;
  - Duplicar conserva el sentido, y Ctrl+Z lo deshace;
  - recargar y «Recuperar» el autoguardado conserva el sentido;
  - el menú NO tiene «Invertir sentido» (es de 003).
- **Compartir**: el diálogo real («Compartir historia») no cambia el documento del autor. El Viewer `/s/` a 1440 y a 390 recibe el
  sentido, y el token y los mensajes coinciden.
- **Present**: el token y los mensajes coinciden.
- **Editor a 1440 y a 390 (con el dedo)**: el panel, el token y el registro son correctos.
- **Documentos antiguos sin reverse** (los tres fixtures con Historias), frente a `544fd4b` en Chrome:
  - idénticos en guardado, Trace, resultados, frases y playback (48 instantes);
  - los tokens van sobre su ruta normal, y ninguno lleva `reverse`.

## Pendientes / riesgos

- **Los fallos que quedan en la regresión dirigida no son de 002.** Se midieron frente a un clon limpio de `544fd4b`:
  - Fallan igual en la base:
    - `scenario-ui-dom` (21);
    - `011-final-fixes` (14);
    - `017-2-qa` (1);
    - `018-14b` (1);
    - `018-17` (2);
    - `019-5` (1).
  - Son alcances «idénticos a HEAD», que fallan con cualquier cambio sin commitear y vuelven a pasar al commitear:
    - `018-15`;
    - `018-18`;
    - `018-19`;
    - `018-21`;
    - `018-23`;
    - `018-24`;
    - `018-25` (y su fixture del MCP, que compara con HEAD);
    - `019-1` #15;
    - `019-2`.
  - `018-27` «fluyo-mcp lleva el kernel resincronizado» falla **a propósito**: el kernel cambió y el MCP aún no está
    sincronizado (paso siguiente).
- **Ventana de una carga en clientes antiguos** (D11). Está aceptada, como cuando llegó `OCCURRENCE`.
- **El MCP no debe exponer `reverse` hasta sincronizar el kernel.** Si no, el agente escribe documentos que su kernel rechaza.
- **El editor todavía no puede crear un Step inverso.** Solo los muestra bien cuando llegan por la autoría, Share o un archivo.
  Eso es 003.

## Handoff

### Estado actual

READY FOR PUSH (la QA del PO pasó: 93/93). Implementado, verificado y commiteado en `fluyo` (base `544fd4b`, CACHE v97). No hay push ni deploy; `fluyo-mcp` sigue sin sincronizar. El commit incluye el diseño
(`.ai/tasks/FLUYO-STEP-REVERSE-001.md`); `.ai/tasks/FLUYO-019.4.md` es ajeno y queda sin seguimiento.

### Próximo paso concreto

1. **Push** de `fluyo`, con el OK del PO, y comprobar que fluyo.space sirve v97. El commit ya incluye `.ai/tasks/FLUYO-STEP-REVERSE-001.md`;
   `.ai/tasks/FLUYO-019.4.md` queda fuera, sin seguimiento.
2. **En `fluyo-mcp`**:
   - `npm run sync:kernel` + `check:kernel`;
   - Zod de `target` con `reverse` (`{edgeId, reverse?}`, `{ref, reverse?}`);
   - `describe_document` y `run_story` en el sentido del recorrido;
   - README con el patrón petición/respuesta;
   - tests y mutaciones.
3. **FLUYO-STEP-REVERSE-003**: el slice de UI, con su auditoría en navegador. Incluye «Invertir sentido» en el menú del Step
   (`pushUndo` + `setStepReverse`, una entrada de Undo; la selección se conserva, decisión 189), el texto y el posible atajo
   «Añadir la respuesta».
