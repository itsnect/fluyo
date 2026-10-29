# FLUYO-STORIES-2.0 · S2 · Propósito y variantes — auditoría

Fecha: 2026-10-29 · Base: `main` = `7aa22f1` (fluyo.space sirve `fluyo-static-v118`; `fluyo-mcp` en `464f4e0`) · Solo lectura: sin código, tests, CACHE, kernel, MCP, commits ni deploy.

**Estado: auditoría APROBADA (D1–D5 tal como se recomendaban). S2a READY FOR PO REVIEW** (worktree `fluyo-s2a`, rama `stories-2.0-s2a`, sin commit); ver «S2a · Implementación» al final.

Objetivo: que una Historia diga qué explica y que sus fallos y alternativas se vean juntos, sin bifurcar ninguna Historia. Regla que no cambia: **una Historia es lineal; las alternativas viven entre Historias.**

## Conclusión

S2 cabe **sin kernel, sin cambio de formato y sin MCP**. La clave es que las dos cosas que S2 necesita ya existen en el documento:

- **La familia ya existe: es la página.** Una página es un sistema y sus Historias son las formas de contarlo. Los tres ejemplos con Historias ya tienen exactamente esa forma, como muestra la tabla de abajo.
- **El propósito ya existe: son los dos nombres.** El nombre de la página dice qué sistema se explica («Compra online»). El nombre de la Historia dice qué cuenta esta forma («El banco no responde»).

| Página | Historias |
|---|---|
| Compra online | Compra con éxito · El banco no responde |
| Inicio de sesión (OAuth 2.0) | Iniciar sesión · El usuario no autoriza |
| Pedido asíncrono con cola | Un pedido · Un mensaje que falla |

Lo que falta es **mostrarlo y transportarlo**:

- una portada en el Viewer y en Present;
- «Otras formas» al terminar;
- que el enlace lleve la familia;
- y en el editor, ver y crear las otras formas sin diálogos.

Hay un único cambio fuera de la UI, en Share: `share-url.js`, que no es kernel ni codec. Revisa en parte la decisión 67.

---

## 1. Discovery

Lo que pide la visión, contra lo que ya tenemos:

| La visión pide | Hoy |
|---|---|
| Una Historia explica algo concreto | Tiene `name` (≤ 120). La página tiene `name`. Nadie los enseña juntos |
| Base + fallos + variantes | «Duplicar» y «Duplicar como fallo» (S1b) ya crean la copia **justo detrás** del original, en la misma página |
| Ver las relacionadas | En el editor, un selector «○ nombre» sin desenlace. En el Viewer, nada: el enlace lleva una sola Historia (dec. 67) |
| Éxito / fallo / alternativa | El desenlace se deduce del motor desde S1b: «Termina bien» o «Falla en el paso N». No hay tipo declarado |

Descartado para S2:

- **Declarar el tipo** (éxito, fallo o alternativa): el desenlace deducido ya distingue éxito y fallo sin mentir, y una «alternativa» es simplemente otra Historia que termina bien.
- **Un campo de propósito distinto del nombre**: el nombre ya admite una frase de 120 caracteres («Qué pasa cuando el banco no responde»).

## 2. Estado actual (código)

| Pregunta | Respuesta |
|---|---|
| ¿Dónde vive una Historia? | `pg.scenarios[]`: `{id, engineVersion, name, nextStepId, steps, arrivalDependencies?, observedFlow?}` |
| ¿Qué hace la carga con una clave desconocida de la Historia? | **La conserva.** `normalizeScenarios` (`model.js:540`) valida las claves conocidas y no filtra las demás. Un campo nuevo sobreviviría a la carga, al guardado, a Share (`projectFromProjectData` + `encodeDeepLink`, JSON → deflate) y al MCP. Pero por convención (dec. 215, `observedFlow`) toda clave persistida se normaliza en `model.js`, y eso es kernel: resincronización y `kernelId` nuevo. **S2 no añade ninguna.** |
| ¿Dónde cae la copia? | `duplicateScenario` (kernel) la inserta en `index+1`. «Duplicar como fallo» (S1b) usa lo mismo con el nombre «{nombre} — falla» |
| Renombrar | `scRenameScenario` muta `sc.name` en el editor (una entrada de Undo), desde «⋯ → Renombrar» en un popover |
| Cabecera de la Historia en el editor | `#scScenarioTitle` = «▾ {nombre}», que abre el selector (`scChooseScenario`) |
| Qué comparte Share | `applyShareKind` (`share-url.js`): **solo** la Historia elegida, como `scenarios[0]` de la página abierta (dec. 67) |
| Qué reproduce el Viewer | `storyScenario()` = `scenarios[0]` de la página, si tiene pasos. No hay selector |
| Portada del Viewer | Antes de reproducir: kicker «Historia» y título = nombre de la Historia. El nombre de la página **no se ve** con una sola página (`pgTabs` oculto si hay menos de 2) |
| Present | Reproduce la Historia activa del editor. Antes de reproducir, `#psTitle` = nombre de la Historia |
| Desenlace | `FluyoStoryClock.outcome(scenario, trace)` (`story-clock.js`, no es kernel). Present y el Viewer lo muestran **solo al terminar**; el editor, en una línea bajo el último momento |
| MCP | Sus enlaces abren el **editor** (`fluyo.space/#d=`) con el documento entero, no el Viewer. `list_stories`/`describe_document` ya listan las Historias por página, así que la familia ya es legible para un agente |
| Tamaño del enlace con la familia | Medido sobre los ejemplos (deflate + base64url): Compra online 1 423 → 1 567, OAuth 1 396 → 1 523, Pedido 1 546 → 1 744. Unos +150 caracteres, muy lejos del tope de 65 536 |

## 3. Problema UX

1. **Quien recibe un enlace no sabe qué va a ver.** No ve el sistema, ni cuántos momentos tiene, ni cómo acaba, hasta que llega al final.
2. **El fallo no viaja con el éxito.** S1b hace fácil crear «El banco no responde», pero para enseñarlo hay que compartir dos enlaces. El receptor nunca descubre el «¿y si falla?».
3. **En el editor, las Historias de una página no se leen como un conjunto.** El selector no dice cuál termina bien y cuál falla.
4. **Una alternativa sin fallo cuesta trabajo:** duplicar la Historia entera y borrar a mano los pasos que sobran.
5. **Nombrar está escondido** en «⋯ → Renombrar», y las Historias nacen como «Historia 1». El nombre es justo lo que S2 usa como propósito.

## 4. Propuesta

> **La página es el sistema. Sus Historias son las formas de contarlo. Cada una se nombra por lo que cuenta y muestra cómo acaba.**

- **Propósito** = nombre de la página (encima, pequeño) + nombre de la Historia (título). Sin campo nuevo.
- **Familia** = las Historias **con pasos** de la misma página, en su orden. Sin campo nuevo y sin concepto de «base» persistido.
- **Clase** = el desenlace deducido (S1b): «Termina bien» / «Falla en el paso N». Sin tipo declarado.
- **Variante** = «Duplicar como fallo» (ya existe) y **«Otra forma desde aquí»** (nueva): una copia hasta ese momento, para seguir contando por otro camino.
- **Share de una Historia** = esa Historia primero y, detrás, sus otras formas.
- **Viewer y Present** = portada → reproducción → «Otras formas».

## 5. Flujo principal

| # | Paso pedido | Cómo queda | Nuevo en S2 |
|---|---|---|---|
| 1 | Crear Historia | «Nueva historia» o el primer toque en el sistema (S1a) | — |
| 2 | Escribir propósito | El título de la cabecera **se edita en línea**: un toque abre el campo. Con «Nueva historia», el campo nace abierto con «¿Qué cuenta esta Historia?» y la semilla seleccionada. Escribir sustituye; Enter guarda | Sí |
| 3 | Construir la secuencia | Tocar conexiones y elementos, con la frase en la fila (S1a) | — |
| 4 | «Duplicar como fallo» / «Crear variante» | Fallo: menú de la Historia (S1b). Variante: **«Otra forma desde aquí»** en el menú de un paso | Variante sí |
| 5 | Elegir qué cambia | Fallo: «¿Dónde falla?» (S1b). Variante: la copia acaba en ese momento; se sigue tocando el sistema y el campo del nombre queda abierto («¿Qué cambia?») | Sí |
| 6 | Ver las relacionadas | El selector «▾» lista las Historias de la página con su desenlace. Present y el Viewer las ofrecen al terminar | Sí |

Ni un diálogo nuevo. Los dos únicos campos son el título en línea y la casilla de Share (§ 11).

## 6. Propósito

- **Dónde vive:** en `page.name` y `scenario.name`, que ya existen. No necesita cambio de documento ni de kernel.
- **Editor:**
  - el título de la Historia pasa a editarse en línea, con `scRenameScenario` (una entrada de Undo; Escape cancela; el Enter de un IME no confirma, como en S1a);
  - el «▾» sigue abriendo el selector;
  - el nombre de la página aparece como kicker encima del título y se edita con el renombrado de página que ya existe.
- **Present y Viewer:**
  - kicker = nombre de la página;
  - título = nombre de la Historia;
  - si la página conserva su nombre semilla («Página 1» / «Page 1»), el kicker vuelve a decir «Historia», como hoy.
- **Share:** nada específico; los dos nombres ya viajan.
- **Documentos antiguos:** se ven igual que hoy, con más contexto. Ningún dato cambia.
- **Opción descartada para S2:** `scenario.purpose`, una frase aparte. Costaría:
  - normalizarla en `model.js`;
  - una op de autoría;
  - el zod estricto del MCP y la salida de `describe_document`/`list_stories`;
  - una resincronización y un `kernelId` nuevo.

  Todo ello para algo que el nombre ya cubre. Se reabre solo si la revisión demuestra que el nombre no basta (D2).

## 7. Variantes

| Pregunta | Respuesta |
|---|---|
| ¿Cómo se guarda la relación? | **No se guarda.** La relación es estar en la misma página |
| ¿Hace falta un campo nuevo? | No |
| ¿Kernel? | No. Se reutilizan `duplicateScenario`, `storyboardRemoveStep`, `pruneArrivalDependencies` y `createStep`, sin modificarlos |
| ¿MCP? | No. Un agente ya crea familias con `create_story`/`duplicate_story` en la misma página |
| Duplicar como fallo | Ya existe (S1b) |
| «Otra forma desde aquí» | En el menú de un paso: duplica la Historia (`duplicateScenario`, la copia queda detrás), conserva los momentos 1..k (k = el momento de ese paso, incluido), poda las esperas de llegada, selecciona la copia y abre su nombre en línea. La semilla es «{nombre} — otra forma». **Una** entrada de Undo; la original no cambia |
| Renombrar o eliminar una variante | Lo de siempre: título en línea; «Eliminar historia» con su confirmación |
| ¿Y si se elimina la «base»? | No hay base persistida, así que nada queda colgando. Las demás Historias siguen siendo la familia. En el Viewer, «principal» es siempre la que se compartió |
| Documentos antiguos | Cada página con más de una Historia con pasos ya es una familia. Los ejemplos ganan «Otras formas» sin tocar sus archivos |
| ¿Cómo se comparte una variante? | Como cualquier Historia: abre el enlace en esa variante y las demás quedan como «Otras formas» (§ 11) |

**Límite conocido:** si una página mezcla dos propósitos sin relación («Autenticar» y «Procesar pedido» sobre el mismo diagrama), se ofrecerán como «Otras formas» del mismo sistema. El rótulo lo decide el PO (D4). La salida sin kernel es usar otra página.

## 8. Editor

1. **Título en línea** (§ 6), con el kicker de la página.
2. **Selector con desenlace.** Cada fila del menú «▾»: «● Compra con éxito · Termina bien» / «○ El banco no responde · Falla en el paso 4». Se calcula con `FluyoStoryClock.outcome`, una ejecución del motor por Historia y memorizada como en la línea de S1b. Las Historias sin pasos no llevan desenlace.
3. **«Otra forma desde aquí»** en el menú del paso, junto a «Falla aquí» (§ 7). No se ofrece en el último momento, porque sería un duplicado.
4. **Lo que no cambia:** «Duplicar historia», «Duplicar como fallo», «Eliminar historia», la biblioteca y el orden de las Historias. No hay «Hacer principal».

## 9. Present

- **Antes de reproducir**, en `#presentStory`:
  - kicker con la página;
  - título con la Historia;
  - una línea: «Termina bien · N momentos» (D5).
- **Al terminar**, debajo del desenlace de S1b: «Otras formas», con hasta 3 botones (nombre + desenlace).
  - Elegir una equivale a `scSwitchScenario(id)` + `scRun({present:true})`.
  - Cambia la Historia activa del editor, que es estado efímero: ni el documento ni el Undo.
- Present ya trabaja dentro del editor con todas las Historias, así que **no depende de Share**.

## 10. Viewer

Estructura pedida contra lo que es posible hoy:

| Bloque | Posible con la arquitectura actual | Qué cambia |
|---|---|---|
| **Portada**: «Compra online» | Sí: `page.name` viaja | `viewer.js`: kicker = página (§ 6) |
| **Historia**: «Compra con éxito» | Sí | Ninguno (ya es el título) |
| Desenlace + nº de momentos antes de reproducir | Sí: `FluyoStoryClock.start` da el Trace sin reproducir (determinista) | `viewer.js` + `#stOutcome` también en la fase `ready` |
| [reproducción] | Sí | Ninguno |
| **Otras formas** al terminar | **Solo si el enlace las trae.** Hoy no las trae (dec. 67) | Share (§ 11) + `viewer.js`: un índice de Historia efímero en lugar de `scenarios[0]` fijo, y la tarjeta final |
| Elegir otra forma y reproducirla sin recargar | Sí: el runtime ya es efímero y se descarta por generación | `storyScenario()` lee el índice elegido; `storyReset` + `storyPlay` |

- En móvil (375×812), la tarjeta final sustituye a la línea del pie mientras está terminada; hay que medirla en la QA.
- No es un rediseño: es el mismo bloque `#stNow` con una línea y una lista de hasta 3 elementos.

## 11. Share

- **Enlace de Historia (nuevo):**
  - `scenarios` = [la elegida, …las otras **con pasos** de la página abierta, en su orden];
  - las de otras páginas siguen fuera;
  - las vacías no viajan.
- **Diálogo:** bajo el texto de la Historia, una casilla «Incluir sus otras formas (El banco no responde)», marcada por defecto.
  - Desmarcada, el enlace sale **byte a byte igual que en v118**.
  - Sin otras formas, la casilla no aparece.
- **Demasiado grande:** si el enlace con la familia supera el tope, se reintenta solo con la elegida y el diálogo lo dice. Medido: +150 caracteres en los ejemplos, así que es improbable.
- **Sin cambios:**
  - el enlace de diagrama;
  - el codec (`link-codec.js`), `deeplink.js` y `#d=`;
  - `version` 5 y `engineVersion` 2;
  - los enlaces del MCP.
- **Sin backend:** todo sigue dentro del fragmento `#d=`.
- **Decisión 67:** cambia «solo esa Historia» por «esa Historia primero y sus otras formas detrás». La garantía de privacidad pasa a ser la casilla. Hay que registrarla como decisión nueva.

## 12. Compatibilidad

| Caso | Resultado |
|---|---|
| Documento existente (archivo, localStorage, MCP) | Mismo JSON y mismo Trace. Solo se ven la portada, el selector con desenlace y «Otras formas» |
| Enlace v118 (una Historia) en el Viewer S2 | Portada nueva y sin «Otras formas» |
| Enlace anterior a 016 (N Historias) en el Viewer S2 | Reproduce `scenarios[0]` como siempre y ofrece las demás como «Otras formas» (mejora sin migración) |
| Enlace S2 (familia) en un Viewer v118 en caché | Reproduce `scenarios[0]` = la elegida e ignora las demás: sin error |
| Documento editado por el MCP | Sin efecto: S2 no lee ni escribe claves nuevas |
| Determinismo | Intacto: ni motor ni Trace cambian; el desenlace antes de reproducir es la misma ejecución |
| Ejemplos | Sus archivos no cambian. Ganan la portada y «Otras formas» |

## 13. Impacto en kernel y MCP

| Archivo | Clase | Cambio |
|---|---|---|
| `js/viewer.js` · `s/index.html` · `css/share.css` | UI | Portada (kicker de página, desenlace y momentos en `ready`), índice de Historia efímero, «Otras formas» |
| `js/present-story.js` · `index.html` · `css/styles.css` | UI | Portada y «Otras formas» en Present |
| `js/editor-scenarios.js` | UI | Título en línea, kicker de página, selector con desenlace, «Otra forma desde aquí» |
| `js/story-clock.js` | UI compartida (no es kernel) | `coverLine(scenario, trace, text)` («Termina bien · N momentos») y `siblings(page, scenario)`: una sola regla de familia para las tres superficies |
| `js/share-url.js` · `js/editor-share.js` | Share | `applyShareKind` con `withSiblings`; la casilla, el texto y el reintento sin familia |
| `js/i18n-en.js` · `js/i18n-en-editor.js` | UI | Claves nuevas en es y en; fr/ja/zh caen al inglés |
| `sw.js` | — | CACHE v119 (S2a) y v120 (S2b) |
| `.ai/DECISIONS.md` | — | Nueva decisión que sustituye la 67 en Share |
| **Kernel** (`config.js`, `safe-svg.js`, `model.js`, `scenario-engine.js`, `scenario-playback.js`, `story-playback.js`, `document-integrity.js`, `story-authoring.js`) | — | **Ninguno.** `kernelId` sin cambios |
| **Modelo / documento** | — | **Ninguno.** Sin claves nuevas |
| **Codec** (`link-codec.js`, `deeplink.js`) | — | **Ninguno** |
| **fluyo-mcp** | — | **Ninguno.** Sigue en `464f4e0`; el catálogo no crece |

Si el PO elige campos declarados (D1 o D2 con la alternativa), harían falta:

- `model.js`: normalizar la clave nueva;
- `document-integrity.js`: un aviso para una referencia rota;
- `story-authoring.js`: las ops;
- en fluyo-mcp: el zod, la salida de `describe_document`/`list_stories`, una resincronización del kernel y el presupuesto del catálogo.

Es decir, una slice de kernel y otra de MCP, como mínimo.

## 14. Acceptance criteria

1. **AC1 · Portada.** El enlace de «Compra con éxito» abre con «Compra online» encima, «Compra con éxito» como título, «Termina bien · N momentos» y un solo CTA de reproducir, en es y en. Una página con nombre semilla muestra «Historia», como hoy.
2. **AC2 · Otras formas en el Viewer.** Al terminar «Compra con éxito» aparece «Otras formas» con «El banco no responde · Falla en el paso 4». Al tocarla se reproduce sin recargar, sin cambiar la URL ni el documento instalado, y acaba en «Falla en el paso 4». Hay como máximo 3 entradas; sin otras formas no aparece nada.
3. **AC3 · Share.**
   - Con la casilla marcada, el payload lleva la elegida en `scenarios[0]` y las demás con pasos de esa página detrás. Ninguna de otra página y ninguna vacía.
   - Con la casilla desmarcada, el enlace es byte a byte el de v118.
   - El enlace de diagrama, también.
4. **AC4 · Compatibilidad de enlaces.** Un enlace v118 abre con portada y sin «Otras formas». Un enlace S2 en el Viewer v118 reproduce la elegida sin errores.
5. **AC5 · Present.** La portada muestra la misma línea que el Viewer. Al terminar, «Otras formas» cambia y reproduce la elegida; Esc, ←/→ y el Undo del editor no se ven afectados.
6. **AC6 · Selector.** El «▾» muestra cada Historia con pasos con su desenlace, y coincide siempre con el de su reproducción.
7. **AC7 · Otra forma desde aquí.** Desde el momento k de una Historia de n momentos se obtiene, con un gesto, una copia con los momentos 1..k:
   - colocada justo detrás de la original;
   - con las esperas de llegada podadas;
   - con el nombre abierto en línea.

   Un Undo la quita. La original no cambia.
8. **AC8 · Nombre en línea.** Un toque en el título lo edita. Enter guarda (una entrada de Undo), Escape cancela y el IME no confirma. «Nueva historia» abre el campo con la semilla seleccionada.
9. **AC9 · Nada se mueve por debajo.**
   - Kernel, `fluyo-mcp`, codec, formato, archivos de ejemplos y Trace quedan byte a byte iguales.
   - La suite completa no suma fallos respecto a la base (S2a sobre `7aa22f1`; S2b sobre S2a).
10. **AC10 · Lenguaje.** En AC1–AC8 no aparecen «Evento», «escenario», «disponibilidad», «primitiva» ni «Semántica».

## 15. Riesgos

1. **Página ≠ familia** cuando una página mezcla propósitos. El rótulo podría prometer de más (D4).
2. **Privacidad de Share:** pasan a viajar más Historias. La casilla las nombra y permite quitarlas (D3).
3. **El desenlace en la portada destripa el final.** Es deliberado (explicar, no sorprender), pero es decisión de producto (D5).
4. **El Viewer deja de tener `scenarios[0]` fijo.** El reinicio del runtime, la línea de ruta (`stFlow`) y el seguimiento de cámara deben reiniciarse con el índice: es el punto delicado de S2a.
5. **Espacio en móvil:** la tarjeta final compite con el pie en 375×812, y el alto de `#stNow` es fijo (018.18).
6. **Coste de tests (no de producto):** cada slice necesita su capa de deshacer para los alcances antiguos, como S1a y S1b. Es mecánico y su generador ya existe.
7. **Deuda conocida que no se toca:** `fluyo-i18n-002-s3a-browser.cjs` 29/6 y `fluyo-step-message-001-browser.cjs` 3.

## 16. Decisiones necesarias del PO

- **D1 · Familia = página, sin campo.** **Recomendado: sí.**
  - La alternativa es `scenario.variantOf`, que supone kernel, MCP y referencias rotas que gestionar.
  - Se reabre si una sola página necesita varias familias.
- **D2 · Propósito = nombre de la página + nombre de la Historia, sin campo `purpose`.** **Recomendado: sí.** La alternativa supone kernel y MCP (§ 6).
- **D3 · Share lleva las otras formas por defecto**, con una casilla para quitarlas. Sustituye la dec. 67. **Recomendado: sí.** La otra opción es dejarla desmarcada por defecto, pero entonces los ejemplos compartidos no enseñan su fallo.
- **D4 · Rótulo final.** «Otras formas» (el lenguaje de la visión) frente a «Otras Historias de este sistema» (siempre verdadero, aunque la página mezcle propósitos). **Recomendado: «Otras formas»**, con el límite de § 7 asumido.
- **D5 · Desenlace en la portada antes de reproducir.** **Recomendado: sí**, porque quien recibe el enlace debe saber qué va a entender.

Lo resuelvo sin pedir decisión:

- máximo 3 otras formas;
- sin «Hacer principal»;
- la semilla «— otra forma»;
- «Otra forma desde aquí» copia hasta el momento incluido;
- es + en.

## 17. Slices recomendadas

| Slice | Contenido | CACHE | Kernel / MCP |
|---|---|---|---|
| **S2a · Portada y otras formas** | Viewer (portada, «Otras formas», índice efímero), Present (portada y «Otras formas»), Share (familia, casilla, reintento), decisión que sustituye la 67 | v119 | No / No |
| **S2b · Variantes en el editor** | Título y página en línea, selector con desenlace, «Otra forma desde aquí» | v120 | No / No |

- **S2a va primero** porque es el salto visible: todo enlace nuevo, incluidos los de los ejemplos, pasa a contar el sistema, cómo acaba y qué más puede pasar, sin que el autor haga nada nuevo.
- S2b hace que crear esas formas sea natural.
- Las dos son independientes en código. Si el PO prefiere una sola entrega, sería un solo commit con v119.

**Fuera de S2:**

- bifurcaciones dentro de una Historia;
- campos declarados (`purpose`, `variantOf`, tipo);
- IA, plantillas, colaboración y vista previa social;
- backend y analíticas nuevas;
- rediseño del Viewer y tira de momentos (S4);
- copiar Historias entre páginas o documentos.

**Próximo paso:** revisión del PO (D1–D5). No se implementa nada hasta entonces.

## S2a · Implementación (29-10-2026)

PO: D1–D5 aprobadas tal como se recomendaban; «Otras formas» / «Other ways». Base `7aa22f1` (v118) → CACHE **v119**. Worktree `fluyo-s2a`, rama `stories-2.0-s2a`, **sin commit**. Kernel, formato, codec, `render.js`, `editor-scenarios.js`, ejemplos y `fluyo-mcp` (`464f4e0`) sin cambios. Decisiones 314–316.

### Qué hace

- **Portada** (Viewer y Present, antes de reproducir):
  - encima, el sistema: el nombre de la página. Si es el de semilla («Página N», «Page N» o la del idioma activo), dice «Historia», como hoy;
  - el nombre de la Historia, como título;
  - el desenlace, sin reproducir: «Termina bien» / «Falla en el paso N»;
  - un solo CTA, el de siempre.
- **Reproducción:** sin cambios.
- **«Otras formas»** (Viewer y Present, al terminar):
  - hasta 3 Historias más de la misma página, en su orden, con su nombre y su desenlace;
  - elegir una la abre en su portada, sin recargar ni tocar el documento;
  - en el Viewer la elección es efímera (`storyChoice`) y se olvida al cambiar de página o de documento;
  - en Present cambia la Historia activa del editor (`scSwitchScenario`), sin documento ni Deshacer, y se vuelve a encajar.
- **Un solo desenlace** para el editor, Present y el Viewer: `FluyoStoryClock.outcomeOf` es la misma ejecución del motor que usa el editor (S1b). El encabezado de Present reserva desde el principio el sitio de «Otras formas», así que el diagrama no se mueve al terminar (018.29 R1).
- **Share:**
  - el enlace de una Historia lleva, detrás de la elegida (que sigue siendo `scenarios[0]`), las demás Historias **con pasos** de la página abierta, en su orden. Ninguna de otras páginas, ninguna vacía;
  - el diálogo lo ofrece con la casilla «Incluir sus otras formas» y sus nombres. Está marcada cada vez que se abre y solo aparece si hay otras formas. Con «sólo el diagrama» se apaga;
  - desmarcada, el enlace es **byte a byte** el de v118;
  - si con la familia no cabe, se crea solo con la Historia y el diálogo lo dice;
  - un Viewer v118 en caché reproduce la elegida e ignora las demás.
- **Coste del enlace:** Compra online pasa de 1 467 a 1 610 caracteres (+143).
- **Idiomas:** es + en. fr/ja/zh caen al inglés, como en S1b.

### Diferencias con la auditoría

- **La portada no enseña «· N momentos»:** el encargo de S2a pedía sistema, Historia, desenlace y CTA, y una portada sobria.
- **Elegir otra forma la abre en su portada; no la reproduce sola.** «Abre esa Historia», y así su portada dice cómo acaba antes de verla.
- **Mientras se reproduce**, el kicker sigue siendo «Historia · {nombre}» (Viewer) y Present lo adopta igual. Así el encabezado tiene siempre una línea y no cambia de alto entre fases.
- **El título de la Historia en línea y el selector con desenlace del editor** no entran: son S2b.
- **En un teléfono apaisado** (altura ≤ 500 px), Present omite el kicker y «Otras formas».
  - Su encabezado no da para más filas sin tapar el diagrama o el mando (018.29 R1).
  - El Viewer en el teléfono los sigue mostrando, y Present en escritorio, tableta y vertical también.
  - Si el PO lo quiere también ahí, haría falta otra colocación (por ejemplo, en el mando).

### Archivos

| Archivo | Cambio |
|---|---|
| `js/story-clock.js` | `outcomeOf`, `phaseOutcome`, `otherForms`, `systemName` (no es kernel) |
| `js/viewer.js` · `s/index.html` · `css/share.css` | Portada, `storyChoice` / `storyOpen`, «Otras formas» (`#stOthers`) |
| `js/present-story.js` · `index.html` · `css/styles.css` | `#psKicker`, portada, `#psOthers`, `presentOpenStory`, reserva en `presentHeaderBottom` |
| `js/share-url.js` | `applyShareKind(…, {withOthers})` |
| `js/editor-share.js` · `index.html` · `css/styles.css` | La casilla, la nota y la reserva «si no cabe» |
| `js/i18n-en.js` · `js/i18n-en-editor.js` | `story.others` + 3 claves de Share |
| `sw.js` | CACHE v119 |
| `.ai/DECISIONS.md` | 314–316 (la 315 sustituye en parte a la 67) |
| `test/fluyo-stories-2-0-s2a.test.cjs` | 12 tests vm: S Share, V Viewer, K reglas, C alcance |
| `test/fluyo-stories-2-0-s2a-mutations.cjs` | 21 mutaciones |
| `test/fluyo-stories-2-0-s2a-browser.cjs` | QA en Chrome real: A Share, B Viewer, C enlace v118, D Present, E inglés/fr, F móvil |
| `test/fluyo-stories-2-0-s2a-undo.cjs` | Capa de deshacer de S2a (`undoS2a`, base 7aa22f1), generada del diff; `undoS1b` la llama primero |
| Alcances S0–S3b, SHELL, S1a, S1b | Registran `PIECES_ST2A` donde ya registraban S1b |
| 016, S1b C1/C2, I18N-002 S0, SEMANTICS-5 | Ver la nota de abajo |
| 86 tests | CACHE v118 → v119 |

**Ajustes a tests antiguos** (todos razonados; ninguno esconde una regresión):

- **016:** la portada del Viewer dice «Pedidos», no «Historia», porque es el cambio pedido (D2). Su contrato de Share se mira con S2a deshecha.
- **S1b C1/C2:** las líneas del desenlace y Share se miran con S2a deshecha.
- **I18N-002 S0 «Viewer en vivo»:**
  - permite que falten en fr/ja/zh solo `story.outcome.*` y `story.others`;
  - es la caída al inglés decidida en S1b: la portada pide el desenlace en japonés antes de reproducir;
  - cualquier otra clave que falte sigue fallando.
- **SEMANTICS-5:** extrae funciones sueltas de `viewer.js`. Recibe `storyChoice` y `storyOthers` como stubs, igual que ya hacía con la cámara.

### Pruebas

- **Propios:**
  - vm 12/12;
  - mutaciones 21/21;
  - Chrome 50/0, que cubre:
    - A Share: casilla marcada por defecto con los nombres, familia en el enlace, desmarcada = enlace de siempre byte a byte, «sólo el diagrama» la apaga, +143 caracteres, documento y Deshacer intactos;
    - B Viewer: portada, Reproducir, «Otras formas», elegir abre su portada sin recargar, acaba como anunciaba;
    - C enlace de una sola Historia: portada, sin «Otras formas»;
    - D Present: portada, final y otra forma; el desenlace coincide con el del editor y el del Viewer; el diagrama no se mueve; ni documento ni Deshacer cambian;
    - E inglés, fr cae al inglés, cambio de idioma en vivo sin tocar el documento;
    - F móvil 375×812 con el dedo, sin scroll horizontal.
- **Suite completa** en un clon con S2a commiteada: 1824 tests / 83 fallos, los mismos 83 de la base (`7aa22f1`), 0 nuevos.
- **Regresiones en Chrome:**

  | Prueba | Resultado |
  |---|---|
  | S1b | 47/0 |
  | S1a | 35/0 |
  | EXAMPLES | 40/0 |
  | NARRATION | 100/100 |
  | SW-VIEWER (incluye el Viewer sin red) | 63/0 |
  | SEMANTICS-5 | 85/0 |
  | 018.18 | 427/0 |
  | 018.21 | 36/0 |
  | 018.29 | 396/0 |
  | 018.30 | 402/0 |
  | 014 | 13 bloques OK |
  | 016 | 17 bloques OK |
  | i18n-001 | 78/0 |
  | I18N-002 S0 | 385/0 |
  | I18N-002 S1 | 181/0 |
  | I18N-002 S2a | 179/0 |
  | I18N-002 S2b | 26/0 |
  | I18N-002 S3b | 46/0 |
  | I18N-002 S4 | 102/0 |

- **Deuda conocida, igual en la base:**
  - S3a 29/6 (EXAMPLES);
  - STEP-MESSAGE 83/86;
  - SHELL 137/2: /ejemplos/ a 320 px y «Abrir en el editor»; mismos 2 fallos en `7aa22f1`.
- **No ejecutables en este entorno:** `share-*-browser.cjs` y `qa-share-hash-browser.cjs` piden el paquete `playwright` completo. Lo que cubren lo cubren 014, 016 y S2a.
- **Lo que S2a cambió en tests en Chrome antiguos** (el comportamiento aprobado, no regresiones):
  - 014 y 016: por defecto viaja la familia; desmarcada, se mantiene el contrato de 016 («sólo la Historia compartida»);
  - I18N-002 S0: el kicker de la portada es el nombre de la página;
  - I18N-002 S1: la nota «… y sus otras formas».
- **QA tipo producción** en el navegador integrado:
  - con el service worker activo, la caché es `fluyo-static-v119` y contiene `viewer.js`, `share-url.js` y `story-clock.js` de S2a;
  - con el servidor parado, el enlace de la familia abre desde la caché, reproduce y ofrece «Otras formas».
- **Durante la QA se corrigió:**
  - 018.29 detectó que, en un teléfono apaisado (844×390 y 812×375), el encabezado de Present con el kicker y la reserva de «Otras formas» empujaba el diagrama debajo del mando. Ver «Diferencias con la auditoría».
  - El control de texto sin traducir de I18N-002 S1 detectó los nombres de las otras formas en un solo nodo. Ahora va cada uno en el suyo, como el de la Historia.

### Riesgos

- Si una página mezcla propósitos sin relación, aparecen como «Otras formas» (D4 asumido). La salida es usar otra página.
- **Más Historias viajan en el enlace.** La casilla las nombra y deja quitarlas.
- **Present:** una Historia con otras formas reserva arriba una fila más desde el principio. El diagrama queda algo más bajo, pero no salta al terminar.
- **Móvil:** la tarjeta final crece unos 60 px (un botón de 44 px por forma). Se mide en el QA.
- **Cada slice nueva** vuelve a necesitar su capa de deshacer para los alcances antiguos. Es mecánico.

### Próximo paso

Revisión del PO → commit en `stories-2.0-s2a`, merge a `main`, push y deploy (v119), y verificación en producción. Después, S2b (v120).
