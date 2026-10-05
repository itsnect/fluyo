# FLUYO-018 — Autoría del diagrama desde MCP: bootstrap y auditoría

Estado: **AUDITORÍA COMPLETA (sin implementación)**. Sin commit, sin push. No se empieza FLUYO-019.
Fecha: 2 de octubre de 2026.
Owner/agente actual: libre.

> Esta tarea es la **fuente de verdad** de FLUYO-018. Es sólo diseño basado en el código real: no hay cambios en `js/`, `test/`, `sw.js`, ni en `fluyo-mcp`. Los spikes se ejecutaron fuera del repo (directorio temporal de la sesión) y se descartan; los resultados que importan están copiados aquí (§12 y anexos).
> **Repo público**: nada de este documento es confidencial.

## 0. Conclusión (léela primero)

1. **Es viable y de riesgo moderado.** El modelo ya expresa todo lo que hace falta (nodos, conexiones, Behaviors, EventTypes, Historias) y **la geometría de una conexión es 100 % derivada**: un agente que escribe `Cliente x=200,y=300` y `Comercio x=600,y=300` obtiene la conexión correcta sin calcular nada (verificado, §9).
2. **Lo que falta no es el modelo, es el dominio de edición del diagrama.** Hoy sólo existen como «funciones de dominio» `newNode`/`newEdge`, y **viven en `state.js`** (archivo del editor, no está en el kernel). Mover, redimensionar, retargetear, borrar, cambiar forma… son **código inline de los manejadores de la UI**. No hay nada que MCP pueda llamar.
3. **Ya existe una segunda implementación de nodos/conexiones**: `fluyo-mcp/src/diagram.ts` (`buildNode`/`buildEdge`/`editDiagram`), con su propio schema (zod), sin kernel, sin `FluyoIntegrity`, sin `baseRevision`. Produce un documento *casi* idéntico al del editor (§12: 5 campos `null` de diferencia), pero es exactamente el patrón que 017.x prohibió («MCP no debe reimplementar el modelo»).
4. **Recomendación:** *no evolucionar `edit_diagram`*. Congelarlo (legacy) y añadir las operaciones de diagrama **dentro de `author_document`**, ejecutando funciones nuevas de `model.js` que el editor también llame. El alcance natural de esas operaciones es `scope:"page"` (los ids de nodo/conexión son **por página**), así que no hace falta un scope nuevo.
5. **Hallazgo incómodo:** el propio editor puede producir documentos que `FluyoIntegrity` rechaza (borrar un nodo deja Steps y Behaviors huérfanos; el editor no consulta la integridad). Cualquier operación de borrado en MCP tendrá una política *más estricta* que el editor: hay que decidir qué hacer con eso (§18).
6. **Complejidad oculta que conviene conocer ya** (§19): `edge ↔ EventType` no existe en el modelo (la relación es por Step), las páginas no tienen id, `edit_diagram` usa otro modelo, ya hay un *segundo motor de geometría* en TS (para SVG), y el undo del editor no cubre los EventTypes.

## 1. Estado actual del modelo

Fuente: `js/model.js` (kernel), `js/state.js`, `js/document-integrity.js`, `js/scenario-engine.js`, `js/story-playback.js`.

### 1.1 Documento (`.fluyo.json`, schema v5)

```text
{ version:5, app:"fluyo",
  doc:{ theme, customBg, eventTypes[], nextEventTypeId, cur,
        pages:[ { name, nodes[], edges[], nextId, behaviors[], scenarios[], nextScenarioId } ] },
  settings:{ speed, dots, build, stagger, grid, snap, font, single } }
```

- `projectToSerializable(d, st)` es la **única definición** del formato. `projectFromProjectData(input)` es la **única frontera de entrada**: migra v1–v5, normaliza, rellena defaults y **repara en silencio** (contadores, Behaviors duplicados, `dots`/`speedFac`/`cur` acotados).
- `normalize` es idempotente (verificado). La **revisión** se calcula sobre el documento normalizado.

### 1.2 Página

- **No tiene `id`.** Se identifica **sólo por su índice** (`pageIndex`) en `doc.pages`. Borrar una página (`ui.js:473`, `doc.pages.splice`) desplaza los índices siguientes.
- Contiene: `nodes[]`, `edges[]`, un contador `nextId` **compartido entre nodos y conexiones** (por eso los ids de nodo y conexión **no colisionan nunca** dentro de la página y una conexión puede ser el `id 3` de un documento de dos nodos), `behaviors[]`, `scenarios[]` (= Historias) y `nextScenarioId`.
- Los ids son **por página**; un mismo número puede existir en dos páginas. Los ids de EventType son **globales al documento** (`doc.eventTypes`, `doc.nextEventTypeId`). Los ids de Step son **por Historia**.
- Operaciones de página (añadir, eliminar, renombrar, cambiar de página) **sólo existen en `ui.js`** (`blankPage` + `doc.pages.push`). No hay función de dominio ni operación en el kernel.

### 1.3 Identidad y contadores

`reserveStructureIds(pg, n)` (model.js) reserva `n` ids a partir de `max(pg.nextId, structuralNextId(pg))`; `structuralNextId` también cuenta ids referenciados por conexiones, Behaviors y Steps. Nunca se reutiliza un id (también en undo: `applySnap` conserva el máximo de los contadores). Esta función **ya está en el kernel** y la usan `newNode`, `newEdge` y `pasteClip`.

### 1.4 Qué NO existe en el modelo (corrige premisas)

- **Una conexión no tiene `eventTypeId` ni Behavior.** Su `label` es texto libre y no está ligado a ningún EventType. La relación conexión↔evento existe **sólo a través de un Step** (`{action:"SEND", edgeId, eventTypeId}`) dentro de una Historia. Una conexión puede tener 0, 1 o N eventos; un evento FLOW puede aplicarse a cualquier conexión.
- **Un Behavior es sólo disponibilidad inicial de un *nodo***: `{nodeId, initialState:"DOWN"}` (UP es el valor por defecto y se representa **sin** Behavior; `setInitialAvailability`). No hay Behaviors de conexión ni de página.
- **No hay grupos, contenedores, capas ni jerarquía.** Un nodo es una caja plana.

## 2. Estado actual del editor: qué es dominio y qué es UI

| # | Acción | Función real (dónde) | ¿Dominio reutilizable? | Observaciones |
|---|---|---|---|---|
| 1 | Crear nodo | `newNode(shape,x,y,extra)` (`state.js`) | **Cuerpo sí, ubicación no.** Está en `state.js`, que toca el DOM al cargarse (`document.getElementById("cv")`) y lee `P()` y `snapV`→`settings` globales | La etiqueta por defecto de iconos/GIF la fija el **llamador** (`interaction.js:346-347`: `ICONS[k].n`/`ANIMS[k].n`); el `color` del GIF también |
| 2 | Crear conexión | `newEdge(a,b,opts)` (`state.js`) | Igual que 1. Rechaza `a===b` (devuelve `null`) | **Defaults distintos según el gesto:** «modo conectar» → `route:"straight"`, lados `null` (`interaction.js:361`); arrastrar desde la flecha del nodo → `route:"ortho"`, `fromSide`, `toSide=nearestAnchorSide(...)` (`:593`) |
| 3 | Mover nodo | **Inline** en `pointermove` (`interaction.js:~500`): `nn.x=snapV(...)` | **No.** Sin función. Además traslada los waypoints de las conexiones internas del grupo y, para una conexión ortogonal con ruta manual y un solo extremo movido, la **realinea** (`realinearExtremos`) y **poda** (`podarWaypoints`) al soltar | Esa política de waypoints depende de `edgePoints` (`geometry.js`, fuera del kernel) |
| 4 | Cambiar tamaño | **Inline** en `pointermove` (`~:511`) | **No.** Mínimo 40×30, proporción fija en `image`/`icon`, redondeo a entero | |
| 5 | Cambiar texto | **Inline**: edición in-situ (`closeEditBox`, `o.label=...`) y panel (`ui.js:265`) | **No** (asignación directa, sin validación ni límite de longitud) | |
| 6 | Cambiar forma | `ui.js:279`: `n.shape=value` | **No.** No excluye campos incompatibles ni reajusta `w/h` al tamaño de la nueva forma; sólo se bloquea desde la UI para `image` e `icon` | |
| 7 | Eliminar nodo | `deleteSel()` (`selection.js`) | **Lógica sí, acoplada a `selN/selE`** | Quita el nodo **y las conexiones incidentes**. **No toca Behaviors ni Steps** (quedan huérfanos) |
| 8 | Eliminar conexión | `deleteSel()` | Ídem | Los Steps `SEND` sobre ella quedan huérfanos |
| 9 | Duplicar nodo | `dupSel()` = `copySel()`+`pasteClip()` (`selection.js`) | Parcial (acoplado a `clip`, `selN`) | Reserva ids en lote, desplaza `GRID`, copia conexiones **internas** y Behaviors; **no copia Steps** |
| 10 | Duplicar conexión | **No existe** como acción | — | Sólo como parte de una copia de grupo con ambos extremos |
| 11 | Conectar A→B | = 2 | = 2 | |
| 12 | Cambiar origen/destino | **Inline** `pointerup` de `endDrag` (`interaction.js:620-635`): `e.from=...; e.fromSide=...` | **No** | Repite el guard anti-auto-lazo (`tgt.id!==otro`) que ya está en `newEdge`; **no limpia waypoints** (el panel `fromSel/toSel` sí: `ui.js:284-285`) |
| 13 | Crear Behavior | `setInitialAvailability(pg,nodeId,state)` (**model.js**) | **Sí** | El editor lo envuelve en `scSetBehavior` (undo + autosave) |
| 14 | Asignar EventType | `createStep(sc, stepDefinitionForEvent(et, target, at))` (**model.js**) | **Sí** | |
| 15 | Deshacer | `undo()` (`selection.js`) | **No es dominio** (estado de sesión del editor) | Instantánea **sólo de la página** (`snapPage={pi, data:deep(P())}`, 60 niveles): **no incluye `doc.eventTypes`**; crear un EventType y deshacer lo deja creado |
| 16 | Rehacer | `redo()` | Ídem | |

### 2.1 Lógica duplicada o dispersa

- **Valores por defecto de nodo/conexión: tres copias** — `newNode`/`newEdge` (editor), `buildNode`/`buildEdge` (`diagram.ts`, MCP) y los defaults de `projectFromProjectData` (normalización).
- **Etiqueta por defecto por forma:** `newNode` (`state.js`) y `defaultLabelFor` (`diagram.ts`, con un comentario que dice «igual que newNode()»).
- **Guard anti-auto-lazo:** `newEdge` + `endDrag` (dos sitios de UI); **no existe como regla de documento** (§10).
- **Validez de `icon`/`anim`** (clave existente en el catálogo) y **formato de color**: sólo las comprueba MCP (`assertValidIcon`, `resolveColor`). `model.js` sólo exige «cadena».
- **Geometría:** `js/geometry.js` (editor) **y** un port en `fluyo-mcp/src/svg.ts` (con suite de paridad). Ya hay dos motores; no debe haber tres.
- **Reserva de ids:** correcta en el editor (`reserveStructureIds`); `editDiagram` hace `nextId=page.nextId; nextId++` a mano, sin `structuralNextId` (§4).

## 3. Estado actual de `edit_diagram` (`fluyo-mcp/src/diagram.ts`, `server.ts`)

| Pregunta | Respuesta |
|---|---|
| Operaciones | `add_node`, `update_node`, `remove_node`, `add_edge`, `update_edge`, `remove_edge`, `set_theme`, `rename_page`, `relayout` |
| Estructura que acepta | Documento completo en cada llamada + `pageIndex?` + `operations[]` validadas con **zod** (`OperationSchema`, `FluyoProjectSchema` con `.passthrough()`). **No** usa el schema/normalización del kernel |
| ¿Modifica directamente? | Muta una copia que le da zod y la devuelve: **stateless**, sin sesión |
| ¿Usa `FluyoIntegrity`? | **No.** Sólo revalida con zod (`parseOwnOutput`) |
| ¿Atomicidad? | Sí en el sentido trivial (cualquier `throw` aborta y no devuelve nada). **No** hay garantía de integridad del resultado |
| ¿`baseRevision`/`resultRevision`? | **No** a ninguno de los dos |
| ¿Comparte reglas con el editor? | **No.** `buildNode`/`buildEdge`/`defaultLabelFor` son reimplementaciones; coincide por coincidencia verificada, no por construcción |
| ¿Preparada para autoría real? | **No.** Es una operación legacy de la época «un diagrama = nodos+aristas» (v3) |

Hallazgos medidos con el documento del editor (§12) como entrada:

| Prueba | Resultado |
|---|---|
| `remove_node` / `remove_edge` con un Step usándolos | Acepta; devuelve un documento **inválido** (`missing_edge` en la Historia). Sin rechazo ni aviso |
| `remove_node` con Behavior | No limpia el Behavior (`behaviors` no está en su schema; pasa por `passthrough`) |
| `add_edge` A→A (auto-lazo) | **Acepta** (el editor lo rechaza) |
| `update_node` con `w:-5` | Devuelve un documento que el kernel rechaza (`invalid_document`): **no hay validación de dominio** |
| `update_node` con `w:-5` vía `OperationSchema` | zod lo **acepta** (`z.number()` sin mínimo): la validación de dominio no existe en ningún punto de la ruta |
| `update_edge` con `from` | `OperationSchema.safeParse` devuelve `{op, id}`: el campo se **elimina en silencio**. **No se puede retargetear una conexión**, algo que el editor sí hace (`endDrag`) |
| `add_node`/`add_edge` en un documento con Historias | Conserva `eventTypes`, `scenarios`, `nextScenarioId` (por `passthrough`); `nextId` correcto **si** el documento ya traía un contador coherente |
| Versión del documento resultante | La de entrada (`create_diagram` genera **v3** con `meta:{generator}`); `author_document` en cambio normaliza a **v5** y descarta `meta` |

**Decisión recomendada (§14):** *reemplazar, no evolucionar*. `edit_diagram` queda congelado y documentado como legacy (sin romper a quien lo use); la autoría real entra por `author_document` sobre el kernel. `create_diagram` y `relayout`/`layeredLayout` se tratan aparte (§20, 018.5).

## 4. Inventario de primitivas

Todas las formas son **el mismo registro de nodo** con campos opcionales por forma. No hay entidades distintas por forma.

| `shape` | Tamaño por defecto `[w,h]` (`DEFAULT_SIZES`) | Etiqueta por defecto | Campos propios | Creable por MCP hoy |
|---|---|---|---|---|
| `rect` | 180×70 | `"Nodo"` | — | sí |
| `cylinder` | 150×90 | `"Nodo"` | — | sí |
| `diamond` (rombo) | 160×100 | `"Nodo"` | — | sí |
| `circle` | 110×110 | `"Nodo"` | — | sí |
| `hex` (hexágono) | 170×80 | `"Nodo"` | — | sí |
| `text` | 200×40 | `"Texto"` | — (`color` hace de color del texto) | sí |
| `icon` | 120×92 | `""` → el editor pone `ICONS[k].n` | `icon` (clave de catálogo), `tint:false` | sí |
| `anim` (GIF animado) | 120×100 | `""` → el editor pone `ANIMS[k].n` | `anim` (clave de catálogo) | sí |
| `image` | 220×160 (o el natural) | `""` | `img` (**data URI** con los bytes) | **no** (no cabe por canal de texto) |
| `code` | 300×150 | `CODE_DEFAULT_LABEL` (SQL de ejemplo) | `lang:"sql"`, `keywords:null`, `kwBg:null`, `kwColor:null` | sí |

Circle, diamond y hex **no son primitivas distintas**: cambia el `shape`, que decide el dibujo y el punto de anclaje (`autoAnchor`).

## 5. Estructura real de los nodos

Salida literal de `newNode` en el editor (spike, sin normalizar), para `rect`:

```json
{"id":1,"shape":"rect","x":200,"y":300,"w":180,"h":70,"label":"Cliente","color":"#6a9fb5",
 "fill":null,"border":"solid","lblPos":"center","textBg":null,"textColor":null,
 "font":null,"bold":false,"pulse":false,"order":0}
```

- **Id:** del contador compartido (`reserveStructureIds`). **Posición:** `x,y` = **centro** del nodo. **Tamaño:** `w,h` > 0.
- **`order`** = `P().nodes.length` al crear: es el orden de aparición de la animación `build`. **No es el orden Z**: ése es la **posición en el array** `nodes[]` (`bringToFront` etc.). Ambos forman parte de la revisión.
- **Opcionales de estilo** (todos con valor por defecto en el editor): `fill`, `border` (`solid|dashed|dotted|none`), `lblPos` (`center|top|bottom|left|right`), `textBg`, `textColor`, `font`, `bold`, `fs` (0/ausente = automático; acotado 8–96), `pulse`.
- Relaciones con otras entidades: **sólo entrantes** (conexiones por `from/to`; Behaviors por `nodeId`; Steps `OCCURRENCE`/`SET_STATE` por `nodeId`). El nodo no guarda nada de eso.
- Diferencia `buildNode` (MCP): añade `fs:null` y **no escribe** `font/bold/fill/border/lblPos/textBg/textColor` si el agente no los da (los rellena después la normalización). Es la única divergencia (§12).

## 6. Estructura real de las conexiones

```json
{"id":3,"from":1,"to":2,"fromSide":null,"toSide":null,"route":"straight","waypoints":[],
 "label":"Pago","font":null,"bold":false,"animated":true,"dashed":false,
 "startArrow":false,"endArrow":true,"flowDir":"normal"}
```

- **Identificación:** `id` del mismo contador que los nodos. **Origen/destino:** `from`/`to` (ids de nodo). **Dirección visual:** `startArrow`/`endArrow` + `flowDir` (`normal|reverse|alternate`, sólo invierte el sentido de los puntos animados, no la geometría). **El sentido lógico es `from→to`.**
- **Geometría persistida:** sólo `fromSide`/`toSide` (`n|e|s|w|null`; `null` = flotante), `route` (`straight|ortho`) y `waypoints[]` (puntos intermedios **manuales**, vacíos salvo que una persona arrastre un codo). **No se guardan los puntos de la ruta.**
- **Opcionales:** `label`, `lineColor`, `dotColor`, `fs`, `font`, `bold`, `dashed`, `animated`, `speedFac` (1–4), `dots` (1–6; propio sólo con `dotsGlobal:false`).
- **EventType / Behavior asociados:** **ninguno** (§1.4).
- **Si se mueve un nodo:** las conexiones se **rederivan solas** (verificado: mover B de y=300 a y=500 cambia los puntos de `edgePoints(e)`; el registro persistido no cambia). Si la conexión tiene waypoints, el editor los conserva/realinea durante el gesto (§2, fila 3).
- **Si se elimina un nodo:** el editor elimina las conexiones incidentes (y **no** limpia Steps ni Behaviors).
- **Dos conexiones entre el mismo par:** permitido por diseño (`parallelLane` las separa 28 px en carriles).

## 7. Behaviors

- Viven en `page.behaviors[]` (`{nodeId, initialState:"DOWN"}`); persistidos; el estado de ejecución **no** (lo produce el motor).
- Se crean con `setInitialAvailability(pg,nodeId,state)` (model.js, ya compartido): quita el Behavior existente y añade uno sólo si es `DOWN`.
- Obligatorios: `nodeId` entero ≥ 1 y `initialState ∈ {UP,DOWN}`. Derivado: el estado `UP` implícito. Persistente: sólo los `DOWN`.
- `{initialState:"UP"}` explícito es **válido pero no canónico** (el editor nunca lo escribe): dos documentos con la misma semántica y revisión distinta.
- Los duplicados por `nodeId` **no son un error**: `normalizeBehaviors` se queda con el último en silencio.
- La existencia del `nodeId` la comprueba el motor (`missing_behavior_node`).

## 8. EventTypes

(Detalle completo en `FLUYO-017.3.md` §1.) Lo relevante para el diagrama:

- Son **globales** al documento y **no referencian** nodos ni conexiones. Un `FLOW` se aplica a una conexión (`SEND`), un `OCCURRENCE`/`SET_AVAILABILITY` a un nodo (`OCCURRENCE`/`SET_STATE`); `eventTypeAllowedTargets` y `eventTypeActionSpec` (model.js) lo deciden.
- Quien une evento y diagrama es el **Step**: `{id, at, action, edgeId|nodeId, eventTypeId[, state]}`.
- Frase: `{source}`/`{target}` se resuelven con las **etiquetas de los nodos** extremos de la conexión (`renderEventSentence`). Por tanto **cambiar el texto de un nodo cambia la frase narrada** de todos los Steps que lo tocan. Importante para el aviso de impacto (§18).
- Observación del spike: un EventType `FLOW` creado por el editor **persiste también una rama `nodeEffects` por defecto** (`createEventTypeIn` siempre escribe `nodeEffects`). MCP produce lo mismo (misma función); no afecta a la ejecución.

## 9. Geometría

| Aspecto | Hoy |
|---|---|
| Posición | `x,y` = centro, en **coordenadas de mundo** (las mismas para todo el documento; **no** hay coordenadas «de página» distintas). `viewX/viewY/viewZoom` son estado de sesión del editor y **no** se guardan |
| Tamaño | `w,h` > 0. El mínimo 40×30 sólo lo aplica el gesto de redimensionar; el documento acepta cualquier valor finito positivo (verificado `w=1e9`) |
| Snap / rejilla | `GRID=20`; `settings.snap` (defecto `false`) hace que `snapV` cuantice **sólo durante los gestos**; con snap apagado, `snapV` redondea a **entero**. El documento nunca guarda decimales de gesto: de facto, los x/y del editor son enteros |
| Zoom / pan | Sólo sesión. `getBounds()` (+40 px) se calcula, no se guarda |
| Colisiones / límites | **No hay**: se pueden solapar nodos (verificado: dos nodos en el mismo punto) y no hay cota de coordenadas (verificado `x=1e300`) |
| Conexión al mover nodos | **Derivada**: `edgePoints(e)` (`geometry.js`) calcula anclas (`autoAnchor`/`sidePoint`), carriles paralelos y de puerto, y la ruta ortogonal con esquiva de cajas |
| Puntos intermedios | `waypoints[]` manuales; si existen, **mandan** sobre el cálculo (y la conexión sale del reparto de carriles) |

**¿Basta `Cliente x=200,y=300` / `Comercio x=600,y=300`? Sí.** Verificado en el spike:

```text
straight, lados null  → [(290,300),(510,300)]
ortho,   lados null   → [(290,300),(318,300),(400,300),(482,300),(510,300)]
mover B a y=500       → la ruta cambia sola; la arista guardada no cambia
redimensionar B       → idem
```

**El cliente (el agente) no necesita calcular geometría para crear.** Sólo necesita: (a) elegir `x,y` y, si quiere, `w,h` (hay defaults por forma), (b) opcionalmente `fromSide/toSide/route`. El cálculo de la ruta sólo hace falta para **dibujar** (lienzo, SVG), **colocar etiquetas** y **proponer posiciones** (auto-layout), nunca para escribir el documento.

Dónde vive hoy cada cálculo: `js/geometry.js` (editor; usa `P()` y `nodeById` globales; **no está en el kernel**); `fluyo-mcp/src/svg.ts` (port TS para exportar SVG, con paridad); `fluyo-mcp/src/layout.ts` (`layeredLayout`, **sólo existe en TS**, el editor no tiene auto-layout). **Conclusión:** la autoría no requiere ningún motor geométrico nuevo. El auto-layout es una *ayuda del agente* (genera números), no una regla del documento.

## 10. Integridad existente

`FluyoIntegrity.validateProject` compone normalización (`model.js`) + motor (`runScenario` con Historia sonda) + EventTypes. Matriz verificada con el documento del fixture (`✔` = rechazado):

| Invariante | ¿Rechazado? | Código / dónde |
|---|---|---|
| Arista a nodo/origen inexistente | ✔ | `missing_edge_endpoint` (motor) |
| Id de nodo duplicado | ✔ | `duplicate_node_id` |
| Id de arista duplicado / id de arista = id de nodo | ✔ | `duplicate_edge_id` / `duplicate_structure_id` |
| `fromSide`/`toSide`/`route`/`flowDir`/`shape` desconocidos | ✔ | `invalid_document` (normalización) |
| Waypoint no numérico; `w,h ≤ 0`; `order<0`; `fs<0` | ✔ | `invalid_document` / `invalid_structure` |
| `lang` de `code` desconocida | ✔ | `invalid_document` |
| Behavior sobre nodo inexistente (incluye un id de arista) | ✔ | `missing_behavior_node` |
| Step `SEND` sobre arista inexistente o sobre un id de nodo | ✔ | `missing_edge` |
| Step `OCCURRENCE`/`SET_STATE` sobre nodo inexistente / sobre una arista | ✔ | `missing_node` |
| Step con EventType inexistente | ✔ | `missing_event_type` |
| Step incompatible con su EventType (acción, disponibilidad) | ✔ | `event_type_action_mismatch` |
| EventType de nodo usado como conexión y viceversa | ✔ | `event_type_action_mismatch` (+ `missing_*`) |
| «Historia válida pero diagrama inválido» | ✔ | La integridad es **del documento**: el error se atribuye a la Historia/Step afectado |
| Límites del motor | ✔ | `guard_exceeded`: 10 000 nodos y 10 000 conexiones por página, 1 000 Steps por Historia |
| Contador `nextId` menor que el máximo id | **reparado en silencio** | `structuralNextId` |
| Behaviors duplicados | **canonicalizado en silencio** (gana el último) | `normalizeBehaviors` |
| `dots`/`speedFac` fuera de rango | **acotado en silencio** | normalización |

## 11. Integridad faltante (no inventar reglas todavía)

Reglas que hoy **no** existen como regla del documento (todas verificadas como `VALID`):

| Falta | Dónde está hoy (si en algún sitio) | Observación |
|---|---|---|
| **Auto-lazo** (A→A) persistido | Sólo en la UI: `newEdge` y `endDrag` | Un documento con auto-lazo es válido; `edit_diagram` lo crea |
| **Conexión duplicada** A→B | — | **Por diseño** (carriles paralelos); no es un defecto. La ambigüedad se resuelve con `edgeId` (`AMBIGUOUS_TARGET` ya existe) |
| `icon`/`anim` inexistente en el catálogo; `shape:"icon"` sin `icon` | Sólo MCP (`assertValidIcon/Anim`) | El catálogo (`config.js`) **sí está en el kernel**: la regla puede vivir en `model.js` |
| Formato de color (`#rrggbb`) | Sólo MCP (`resolveColor`) | `model.js` acepta cualquier cadena; `hexA` del lienzo asume hex |
| Longitud de etiqueta | — | Un nodo con 200 000 caracteres es válido |
| Rango de coordenadas / tamaño máximo | — | `1e300` es válido |
| Behavior `{initialState:"UP"}` (no canónico) | — | Válido; produce revisión distinta |
| `shape` ↔ campos propios al cambiar de forma | — | Se heredan campos de la forma anterior |
| «Entidad sin Behavior cuando debería tenerlo» | — | **No procede**: ningún nodo *debe* tener Behavior (UP implícito) |
| Número de páginas, de EventTypes, de Behaviors | — | Sin tope |
| Nombre de página | — | `pg.name` ausente es válido |

**Precedente útil (017.3):** `eventSentenceHasStrayBraces` es una **regla de ENTRADA** que MCP aplica al escribir pero que el dominio **no** usa para rechazar lo ya guardado. Ese patrón («regla de entrada vs regla de documento persistido») es el que debería usarse para auto-lazo, icono/anim, color, tamaños y coordenadas: se exigen al **autorar**, no invalidan documentos antiguos.

## 12. Resultado del spike «Cliente ── Pago ──→ Comercio»

Spike descartable (fuera del repo): un `vm` con DOM falso que carga el **código real** del editor (`config`, `safe-svg`, `model`, `state`, `selection`, `geometry`, motor, playback, integridad, `story-authoring`) y reproduce los gestos llamando a las mismas funciones que los manejadores: `newNode`, `newEdge`, `createEventType(eventTypeDefinition(...))`, `createScenario`, `createStep(stepDefinitionForEvent(...))`. Luego, el camino MCP con `dist/` (sólo lectura): `createDiagram` + `author_document` (`create_event_type`, `create_story`, `add_step`).

### 12.1 Documento completo producido por el editor (sin normalizar)

Ver **Anexo A**. Ids: nodos `1` y `2`, conexión `3` (contador compartido, `nextId:4`), EventType `1`, Historia `1`, Step `1`. `FluyoIntegrity.validateProject` → `valid:true`, Historia ejecutable.

### 12.2 Comparación editor ↔ MCP

| Elemento | Editor | MCP (`createDiagram` + `author_document`) | ¿Igual? |
|---|---|---|---|
| IDs (nodos, conexión, EventType, Historia, Step) | 1, 2, 3, 1, 1, 1 | 1, 2, 3, 1, 1, 1 | ✔ |
| Geometría (`x,y,w,h`, lados, ruta, waypoints) | idéntica | idéntica | ✔ |
| Defaults de nodo (`border`, `lblPos`, `fill`, `bold`…) | los escribe `newNode` | los escribe la **normalización** | ✔ tras normalizar |
| Behavior | `[]` | `[]` | ✔ |
| EventType (incl. rama `nodeEffects` por defecto en FLOW) | idéntico | idéntico (misma función) | ✔ |
| Historia, Step (`at:0`, `SEND`, `edgeId:3`) | idéntico | idéntico | ✔ |
| Contadores (`nextId`, `nextEventTypeId`, `nextScenarioId`, `nextStepId`) | 4, 2, 2, 2 | 4, 2, 2, 2 | ✔ |
| Trace de la Historia (`run_story`) | — | — | ✔ idéntico |
| **Campos `null` extra de MCP** | — | `nodes[].fs:null` ×2, `edges[].fs:null`, `edges[].lineColor:null`, `edges[].dotColor:null` | ✘ **5 campos** |
| **Revisión** | `sha256:0d29c9b4…c6c4e5` | `sha256:2680fffe…3006e` | ✘ **distinta** |
| Versión de entrada → salida | v5 | `createDiagram` v3 + `meta` → `author_document` v5 sin `meta` | (normaliza) |

**Lectura:** el resultado es funcionalmente idéntico (mismo Trace), pero **las dos rutas no producen la misma revisión**, por 5 campos `null` que sólo `buildNode`/`buildEdge` escriben. Es una prueba directa de que mantener dos constructores es una fuente de deriva: no hay un solo bug, hay *dos fuentes de verdad* que hoy coinciden por casualidad.

### 12.3 ¿Se puede construir **sólo con funciones de dominio, sin DOM**?

| Pieza | ¿Existe en el kernel? |
|---|---|
| EventType, Historia, Step, Behavior, ids por contador | **Sí** (`model.js`) |
| **Crear nodo / crear conexión** | **No.** `newNode`/`newEdge` están en `state.js`. Sus **cuerpos** no usan el DOM, pero el **archivo** sí (`document.getElementById("cv")`, `cv.getContext`, `setTimeout`, `localStorage` al cargar) y las funciones leen `P()` y `snapV`→`settings` (globales). Extraerlas es barato: pasar `pg` (y `settings.snap`) como argumento, igual que se hizo con los EventTypes (`…In(d, …)`) |
| Mover / redimensionar / retargetear / cambiar texto o forma / borrar | **No existen como funciones**: son código inline de manejadores (§2) |
| Geometría (`edgePoints`) | Fuera del kernel (no hace falta para escribir) |

## 13. Paridad editor ↔ dominio

Objetivo: `Editor → dominio compartido → documento ← MCP authoring`.

**Debe extraerse a `model.js`** (nombres orientativos, siguiendo el patrón `…In(d,…)` de 017.3):

| Función | Contenido | Quién la llama |
|---|---|---|
| `nodeDefinition` / `createNodeIn(pg, shape, x, y, extra, settings)` | defaults por forma (`DEFAULT_SIZES`, etiqueta, campos de `code`/`icon`/`anim`, `order`), id por `reserveStructureIds`, validación de entrada (icono/anim del catálogo, color hex, tamaños) | `state.js newNode` (envoltorio) y `FluyoAuthoring` |
| `createEdgeIn(pg, a, b, opts)` | defaults de conexión, guard anti-auto-lazo, extremos existentes | `state.js newEdge` y `FluyoAuthoring` |
| `updateNodeIn(pg, id, changes)` / `updateEdgeIn(pg, id, changes)` | lista cerrada de campos editables, validación de entrada, **todo-o-nada** (copia→valida→vuelca, como `updateEventTypeIn`); la conexión admite `from/to/fromSide/toSide/route` (retarget) | editor (panel) y `FluyoAuthoring` |
| `deleteNodesIn(pg, ids)` / `deleteEdgesIn(pg, ids)` | cascada de conexiones incidentes (lo que hace `deleteSel`) **y** del Behavior del nodo; devuelve qué quitó (`{edges, behaviors}`) | `deleteSel` (cambio de comportamiento del editor **sólo si se decide**, §18) y `FluyoAuthoring` |
| `moveNodeIn(pg, id, x, y)` | asignación con la política de waypoints (**decisión abierta**, §14) | gesto de mover y `FluyoAuthoring` |
| Reglas de entrada (`nodeEntryRules`) | auto-lazo, icono/anim, color hex, rangos | ambos |

**NO debe extraerse a `model.js`:**

- Geometría (`edgePoints`, anclas, carriles, `orthoRoute`), medición de texto, colocación de etiquetas: ya hay dos copias (editor + `svg.ts`); no se añade otra. La autoría no la necesita.
- Auto-layout (`layeredLayout`): ayuda del agente; se queda en TS (sugiere números que luego pasan por las operaciones).
- Gestos: hit-testing, `snapV` durante el arrastre, marquee, clipboard, desplazamiento `GRID` del pegado, `realinearExtremos`/`podarWaypoints` (se quedan en el editor; si MCP mueve un nodo, la política de waypoints se decide aparte).
- Undo/redo, selección, autosave, analítica, `pendingShape`…
- `resolveColor` (nombres semánticos → hex) puede quedarse en la capa de **entrada** de MCP; el dominio sólo exige `#rrggbb`.

**Coste del kernel:** al tocar `model.js` hay que regenerar `fluyo-mcp/src/generated/kernel-sources.ts` (`npm run sync:kernel`; `check:kernel` lo vigila) y subir `CACHE` en `sw.js` (decisión del proyecto para archivos servidos).

## 14. Conjunto mínimo de operaciones propuesto

**Alcance:** todas son `scope:"page"` con `pageIndex` (los ids de nodo/conexión son por página; el scope se define por *espacio de ids*: `story` → ids por Historia, `page` → ids por página, `eventType` → ids del documento). **No hace falta un scope nuevo.**

| Nivel | Operaciones | Para qué |
|---|---|---|
| **Mínimo para CONSTRUIR** (018.2) | `create_node`, `create_connection` | Con lo que ya existe (`create_event_type`, `create_story`, `add_step`, `set_initial_availability`) cierra el ciclo *diagrama → eventos → Historia → ejecutar* |
| **Mínimo para CORREGIR** (018.3) | `update_node` (texto, forma, color, `x`,`y`,`w`,`h`, estilo), `update_connection` (texto, ruta, lados, estilo, **`from`/`to`** = retarget) | `move_node`, `resize_node` y `change_shape` **no son operaciones**: son campos de `update_node` |
| **Para ELIMINAR con garantías** (018.4) | `delete_node`, `delete_connection` | Con B2 (§18) |
| Después, si hace falta | `create_page`, `rename_page`, `set_theme`/ajustes | Hoy sólo existen en `edit_diagram` (`rename_page`, `set_theme`) o en la UI |
| **Descartadas por ahora** | `duplicate_node`, `duplicate_connection`, `bring_to_front`/orden Z, `relayout`, `resize_node`, `move_node` | No son necesarias para construir un diagrama funcional. El auto-layout, si se quiere, sería una **herramienta de lectura** que *propone* `x,y` (el agente las aplica con `update_node`), no una operación de escritura |

Reparto conceptual por entidad: *documento* (tema, ajustes: fuera del mínimo); *página* (`set_initial_availability` ya existe; `create_page` después); *nodo* (`create/update/delete_node`); *conexión* (`create/update/delete_connection`); *EventType* (ya completo, 017.3); *Historia* (ya completo, 017.2).

Campos mínimos de `create_node`: `shape` (sin `image`), `x`, `y`, `label?`, `ref?`, `w?`, `h?`, `color?`, `icon?`/`anim?` (según forma), estilo opcional. De `create_connection`: `source`, `target` (id o `{ref}`), `label?`, `route?`, `fromSide?`, `toSide?`, `ref?`, estilo opcional.

## 15. Propuesta de referencias internas

Se generaliza el mecanismo existente (`ctx.refs = {stories, steps, eventTypes, none}`; `ctxRef(ctx, kind, v, what)`).

- Nuevos espacios de nombres: `nodes` y `edges`, cada ref asociada a `{id, pageIndex}`. Un `ref` de nodo es **por página** (igual que los ids).
- Dónde se admite `{ref}`: `create_connection.source/target`; `update_/delete_node|connection` (el id); y **se extiende a los destinos de operaciones existentes**: `add_step.target` / `retarget_step.target` (`{nodeId:{ref}}`, `{edgeId:{ref}}`, `{from:{ref},to:{ref}}`) y `set_initial_availability.nodeId` (hoy llama a `ctxRef(ctx,"none",…)`, un mapa siempre vacío: no puede referenciar nada creado en el lote).
- **Resolución hacia delante únicamente:** una ref sólo existe tras la operación que la crea. Eso excluye por construcción los ciclos de referencias y hace el orden de ids determinista.
- **Hallazgo:** hoy `create_story`/`duplicate_story` hacen `ctx.refs.stories.set(ref, …)` **sin comprobar duplicados**: una ref repetida **sobrescribe en silencio**. Para nodos y conexiones (donde un error cambia la topología) debe ser `DUPLICATE_REF`. (Se aplicaría también a las refs existentes.)
- Las ref **no se persisten** y viven sólo en el lote. La respuesta debe devolver un mapa explícito `refs:{cliente:{kind:"node", id:1}}` para que el agente use ids reales en la siguiente llamada (hoy hay que leerlo de `changes[].entityId`).
- Los espacios de nombres son independientes (`cliente` puede ser nodo y Historia sin conflicto).
- Borrar una entidad dentro del lote invalida su ref: una operación posterior que la use falla con `NODE_NOT_FOUND`/`EDGE_NOT_FOUND`.

## 16. Atomicidad

El esquema ya existe y se reutiliza tal cual (`FluyoAuthoring.apply`): copia profunda normalizada → operaciones secuenciales sobre la copia → validación del **estado final** con `FluyoIntegrity` contra la línea base (`baseline`: los errores *preexistentes* no se atribuyen al lote) → si un error nuevo aparece o una Historia tocada deja de ser ejecutable, `{ok:false}` **sin documento**. Nunca hay documento parcial.

Para el lote de ejemplo (`create_node` ×2 → `create_event_type` → `create_connection` → `create_story` → `add_step`) el resultado es *válido completo* o *rechazo completo*.

Qué se comprueba **por operación** y qué **sólo al final**:

| Por operación (regla de ENTRADA; el estado final no la ve) | Sólo en el estado final (`FluyoIntegrity`) |
|---|---|
| auto-lazo, `icon`/`anim`, color, rango de coordenadas/tamaño, forma de los campos, `ref` desconocida/duplicada, extremo existente | referencias de Steps/Behaviors/EventTypes, ids, límites del motor, ejecutabilidad de las Historias |

Esto sigue la regla 14 («integridad final») sin dejar escapar reglas que el estado final es incapaz de ver (un auto-lazo persistido es un documento válido).

## 17. Revisión

Hechos verificados (`revision = sha256(canonicalJson(documento normalizado))`):

| Operación | ¿Cambia la revisión? | Notas |
|---|---|---|
| Crear nodo / conexión | sí | además avanza `nextId` y añade al final de `nodes[]`/`edges[]` |
| Mover nodo / cambiar texto | sí | |
| Reordenar `nodes[]` (orden Z) | sí | el orden del array **forma parte** de la revisión |
| Avanzar `nextId` sin cambios visibles | sí | |
| Crear y luego borrar un nodo (en cualquier lote) | **no vuelve a la revisión original** | el contador **nunca retrocede** (ids irreutilizables, también en el editor): coherente, pero `A → +nodo → −nodo ≠ A` |
| Mismo lote dos veces sobre el mismo documento | **mismo `resultRevision`** (verificado) | determinista: ids asignados en orden de operación |

Condiciones para mantener el determinismo:

1. Los ids se asignan **en el orden de las operaciones** del lote, con `reserveStructureIds` (sin azar ni relojes).
2. Los números se escriben tal como llegan. **Decisión abierta:** el editor sólo guarda enteros (snap/redondeo); si MCP admite decimales, la revisión sigue siendo determinista pero un documento con `x:203.4` nunca podría haber salido del editor. **Recomendación:** redondear a entero como entrada (`Math.round`) y reportarlo en `changes`.
3. `author_document` sigue necesitando el documento **completo** en cada llamada (stateless); con `baseRevision` obligatoria. No cambia.
4. El camino MCP y el del editor **deben producir el mismo JSON**; hoy no (§12.2) por los 5 `null` de `buildNode`/`buildEdge`. Con `createNodeIn`/`createEdgeIn` compartidas, la paridad pasa a ser verificable con un test de igualdad de revisión.

## 18. B2: borrado y referencias del diagrama

Política heredada de 017.x: *si una operación deja una Historia inválida, se rechaza el lote y se explica qué Historias/Steps quedarían afectados; retarget+borrar en el mismo lote es válido.*

**Qué puede detectarse** (todo con `FluyoIntegrity`, ya existente):

| Borrado | Qué queda inválido | Código |
|---|---|---|
| `delete_node` usado por `OCCURRENCE`/`SET_STATE` | los Steps sobre ese nodo | `missing_node` |
| `delete_node` con conexiones incidentes usadas por `SEND` | los Steps sobre esas conexiones (**cascada**) | `missing_edge` |
| `delete_node` con Behavior | el Behavior | `missing_behavior_node` |
| `delete_connection` usada por `SEND` | los Steps | `missing_edge` |

**Hallazgo (importante):** el **editor** no hace nada de esto. `deleteSel` borra el nodo y sus conexiones y deja Steps y Behaviors huérfanos; `FluyoIntegrity` dice explícitamente «el editor todavía NO lo consulta». Hoy un usuario puede producir con el editor un documento que el kernel considera inválido. Cualquier `delete_*` de MCP será **más estricto** que el editor. Es una decisión de producto (no se resuelve aquí): (a) aceptar la asimetría, (b) que el editor pase a avisar (confirmación «se usa en N lugares»), (c) que el editor también limpie. **No se cambia el editor en 018.** *(**Resuelto en FLUYO-018.4**: el editor confirma y quita el Behavior con el nodo; ver `FLUYO-018.4.md` y decisiones 91–92.)*

**Cómo se informa:** reutilizando `usageErrors` (`affectedStories`, `affectedSteps`) y añadiendo qué se llevó por delante la operación (`cascade:{edges:[…], behaviors:[…]}`) y los usos (`eventTypeUsagesIn`-estilo para nodos/conexiones).

**Retarget + delete en el mismo lote:** funciona *si la validación es sobre el estado final* (017.2 lo probó en ambos órdenes). **Trampa de diseño:** `delete_event_type` (017.3) comprueba el impacto **al momento** de la operación (exige quitar antes los Steps). Si `delete_node` copiara ese patrón sería **dependiente del orden** (borrar antes de retargetear fallaría) y contradiría la regla 14 y el comportamiento B2 de 017.2. **Propuesta:** `delete_node/connection` **no** comprueba impacto en el handler; registra en `ctx` qué borró (y en qué `operationIndex`) y deja que la validación final rechace; el rechazo se **enriquece** atribuyendo cada error a la operación de borrado que lo causó (`causedBy`).

**Behavior del nodo borrado:** precedente de 017.2 (llevaba consigo el Behavior). Es metadato del nodo, sin valor narrativo propio: propuesta **cascada** informada en `changes`, no rechazo. (Decisión abierta.)

**Compartir `FluyoIntegrity`:** todas las operaciones de diagrama; `removalImpact` ya simula exactamente la cascada del editor y puede alimentar un *preview* (`dryRun`) del borrado.

**Otras operaciones con impacto semántico (aviso, no rechazo):** `update_connection` con `from/to` y `update_node` con `label` cambian la **frase** de los Steps que usan esa conexión/nodo (`{source}`/`{target}`); se avisa en `affects` como ya hace `update_event_type`.

## 19. Riesgos

1. **Dos fuentes de verdad ya activas** (`newNode` vs `buildNode`): hoy difieren en 5 campos `null`, mañana en lo que se toque.
2. **Editor ≠ MCP en borrado** (§18): MCP puede ser más estricto que la herramienta de referencia.
3. **Política de waypoints al mover** un nodo (editor: conserva/realinea; panel y `relayout`: limpia). Si MCP edita documentos con rutas manuales, hay que elegir y declararlo (recomendación: limpiar los waypoints de las conexiones afectadas e informarlo, como `relayout`).
4. **Coordenadas decimales y paridad** (§17).
5. **Reglas de entrada vs documentos antiguos:** exigir color/icono/auto-lazo al autorar **no** debe invalidar documentos que ya existen (usar el patrón de 017.3).
6. **Segundo motor de geometría:** ya existe en TS para SVG. Añadir autoría **no** debe crear un tercero; el auto-layout debe quedar fuera del dominio.
7. **`describe_document` no da geometría** (decisión de 017.1: «sin coordenadas»). Un agente que modifica un diagrama necesita saber dónde hay hueco (§20.3). Si no se resuelve, creará nodos solapados.
8. **El undo del editor no cubre EventTypes** (`snapPage` sólo toma la página). Irrelevante para MCP (stateless), pero conviene saberlo si el editor llama a funciones compartidas dentro de transacciones.
9. **Páginas sin id:** `pageIndex` es inestable si se añaden operaciones de página (borrar/reordenar). Con `baseRevision` el riesgo se limita a un lote.
10. **Tamaño del documento:** MCP re-envía y re-recibe el documento completo en cada llamada; el límite HTTP por defecto es 1 MB. Autoría de diagramas grandes lo alcanza antes que las Historias.
11. **`edit_diagram`/`create_diagram` seguirán existiendo** produciendo v3: coexistencia de dos rutas de escritura hasta que se depreque (018.5).
12. **El kernel crece:** más código en `model.js` implica `sync:kernel`/`check:kernel` y subir `CACHE` (sw.js).

### 19.1 Seguridad y límites (dónde harían falta; no se implementan)

| Riesgo | Estado hoy | Dónde podría hacer falta un tope |
|---|---|---|
| Operaciones por lote | 200 (zod + `MAX_OPERATIONS`) ✔ | — |
| Nodos / conexiones por página | motor: `guard_exceeded` a 10 000 (verificado con 12 000 nodos, 103 ms de validación) | Un tope **de autoría** más bajo y *por lote/por página* (p. ej. cientos): el render es O(E²) en carriles paralelos y de puerto (`siblingCount`, `portLane`) |
| «Conexiones explosivas» (todos con todos) | sin tope más allá de 10 000 | Tope de conexiones por nodo o por lote; 200 ops × N lotes llega a 10 000 |
| Payload / documento gigante | 1 MB por petición HTTP ✔; sin tope en stdio | Tope de tamaño del documento **resultante** |
| Etiquetas / textos | **sin límite** (200 000 caracteres válidos) | Longitud máxima de `label` como regla de entrada |
| Coordenadas / tamaños | **sin cota** (`1e300`, `w=1e9` válidos) | Rango (p. ej. ±1e6) como regla de entrada |
| Ciclos de referencias | no posibles (resolución hacia delante) | — |
| Ciclos del grafo (A→B→A) | legítimos | — |
| Auto-lazo | válido en el documento | regla de entrada |
| Tiempo | `EVAL_TIMEOUT_MS=5 s` por evaluación del kernel ✔; el motor valida 2 veces por lote + línea base | Revisar coste si se admiten miles de nodos |
| Páginas, EventTypes | sin tope | Topes de entrada |

## 20. Experiencia del agente y propuesta de división

### 20.1 Flujo objetivo

```text
describe_document → (nuevo documento si hace falta) → author_document[diagrama + eventos + Historia] → run_story → corregir → run_story
```

**Documento de partida:** hoy no hay forma de *empezar vacío* sin `create_diagram` (que exige ≥1 nodo y produce v3). Necesidad: un documento en blanco v5 **generado por el kernel** (`blankPage` + defaults), por una herramienta de lectura o por `author_document` con documento vacío. A decidir en 018.2.

### 20.2 Qué necesita `describe_document` para poder modificar un diagrama (sin JSON gigante)

| Necesita | Hoy | Por qué |
|---|---|---|
| ids de nodo y conexión | ✔ | referencias estables: **por página, nunca reutilizadas** |
| `from`/`to`, etiqueta, forma | ✔ | identificar y conectar |
| `x,y` (y `w,h`) por nodo | ✘ (deliberadamente omitido en 017.1) | colocar nodos nuevos sin solapar; **opcional** (flag) para no inflar la respuesta |
| `bounds` de la página (rectángulo que ocupa) | ✘ | «poner el siguiente a la derecha» sin leer todos los nodos |
| `route`, `fromSide/toSide`, `hasWaypoints` por conexión | ✘ | saber si hay ruta manual (política de waypoints) |
| `revision` | ✔ | `baseRevision` |
| `pageIndex` y nombre | ✔ | las páginas no tienen id |
| Etiquetas duplicadas | parcial | si dos nodos se llaman igual, el agente debe usar ids |

Pueden omitirse: estilos (colores, fuentes, bordes), `fs`, `img`, contenido de `code`, `order`, presentación de eventos, waypoints (sólo un indicador). Referencias estables: **ids de nodo/conexión/EventType/Historia/Step** (las `ref` de un lote **no** lo son).

### 20.3 Propuesta de división

| Tarea | Contenido | Sin tocar |
|---|---|---|
| **FLUYO-018.1 — Dominio de edición del diagrama** | Extraer a `model.js`: `createNodeIn`, `createEdgeIn`, validación de entrada (auto-lazo, icono/anim, color, rango), blanco v5 por el kernel. El editor las llama (envoltorios en `state.js`) **sin cambiar su comportamiento**. Tests de paridad (defaults, revisión igual al camino `newNode`) | MCP, `edit_diagram`, borrado |
| **FLUYO-018.2 — Crear diagrama desde `author_document`** | `create_node`, `create_connection`; refs de nodo/conexión (+ `DUPLICATE_REF`, `refs` en la respuesta); destinos con `{ref}` en `add_step`/`retarget_step`/`set_initial_availability`; `describe_document` con geometría opcional + `bounds`; fixture Cliente→Pago→Comercio de extremo a extremo con paridad de revisión | actualizar/borrar |
| **FLUYO-018.3 — Modificar** | `updateNodeIn`/`updateEdgeIn` en el dominio y `update_node`/`update_connection` (mover, redimensionar, forma, retarget). **Decisión:** política de waypoints | borrar |
| **FLUYO-018.4 — Borrar con B2** | `deleteNodesIn`/`deleteEdgesIn` (cascada), `delete_node`/`delete_connection`, atribución `causedBy`, `dryRun` con `removalImpact`. **Decisión previa:** asimetría con el editor (§18) | cambiar el editor sin decisión | *(Planificado así; el 018.4 real fue la política de borrado del **editor**, `FLUYO-018.4.md`; el borrado MCP se hizo en 018.3.)*
| **FLUYO-018.5 (opcional)** | Congelar `edit_diagram`, enrutar `create_diagram` por el kernel, `create_page`, herramienta de lectura que *propone* layout | |

018.1 puede hacerse y mergearse sola sin riesgo de producto; el resto depende de ella.

### 20.4 Qué NO se implementaría todavía

`delete_*` (decisión B2 con el editor pendiente), `update_*` (waypoints), auto-layout en el dominio, `create_page`, `duplicate_*`, orden Z, `image`, límites numéricos (se documentan; se decidirán con 018.1), cualquier cambio de comportamiento del editor, de `edit_diagram` o de `create_diagram`.

## 21. Decisiones pendientes (para el responsable)

1. ¿Los `delete_*` de MCP pueden ser más estrictos que el editor, o el editor debe converger (aviso/limpieza)?
2. Política de waypoints al mover/retargetear por MCP: ¿limpiar e informar (recomendado) o rechazar?
3. ¿Coordenadas decimales: redondear a entero como entrada (recomendado) o conservarlas?
4. ¿Behavior del nodo borrado: cascada informada (recomendado) o rechazo?
5. ¿Auto-lazo: regla de entrada en el dominio (recomendado) o sólo de MCP?
6. Documento de partida: ¿herramienta de lectura que devuelve un blanco v5 o `author_document` con documento vacío?
7. ¿Topes de autoría (nodos por página, longitud de etiqueta, rango de coordenadas) en 018.1 o más tarde?

## 22. FLUYO-018.1 — Resultado (dominio de creación de nodos y conexiones)

Estado: **HECHO** (sin commit, sin push). Solo crear nodos y conexiones; sin update/delete, auto-layout, tools MCP, schema ni cambios de UX.

**API (model.js, clásico, sin DOM):** `createNodeIn(pg, spec, context?)` y `createConnectionIn(pg, spec, context?)`. Operan sobre UNA página explícita, devuelven el registro insertado y son todo o nada (validan una copia con la **misma normalización que la carga** —`normalizeProjectNode`/`normalizeProjectEdge`, extraídas de `projectFromProjectData` sin cambiar su comportamiento— y solo entonces reservan id e insertan). Errores = `projectDataError(code, field?)`: `invalid_document`(campo) · `source_not_found` · `target_not_found` · `self_loop` · `duplicate_structure_id` · `duplicate_ref` · `id_exhausted`. Nunca TypeError.

**Editor:** `newNode`/`newEdge` (state.js) son envoltorios: `createNodeIn(P(), {shape,x:snapV(x),y:snapV(y),...extra})` y `createConnectionIn(P(), {source,target,...opts})`. El snap sigue siendo del editor; `newEdge` traduce `self_loop` a `null` como siempre. No queda ninguna segunda implementación.

**Decisiones:**
- *Spec cerrada.* Solo claves que ya existen en documentos reales (nodo: las de la fila §5 +`img/tint/lang/keywords/kwBg/kwColor`; conexión: las de §6 + `speedFac/dots/dotsGlobal`). Una clave desconocida → `invalid_document`(campo). Conexión: `source`/`target` (no `from`/`to`).
- *Coordenadas/tamaños:* tal cual, sin redondeo ni snap. Con snap apagado el editor sigue guardando enteros (`snapV` redondea **antes** de llamar al dominio).
- *IDs:* sin `id` → `reserveStructureIds` (el del editor). Con `id` → entero seguro ≥1, no ocupado por nodo, conexión, Behavior ni Step de esa página (`duplicate_structure_id`); el contador avanza a `max(structuralNextId, id+1)`. Un hueco libre es válido.
- *ref:* no se persiste. `context.refs` (un Map ref→id **por tipo de entidad**, del lote) → `duplicate_ref` si se repite; se registra tras crear. Sin `context`, la ref solo se valida. Resolver `{ref}` de `source/target` a ids sigue siendo de la capa de autoría.
- *Geometría:* NO se reutiliza `geometry.js` porque la creación no calcula nada: persiste `fromSide/toSide/route/waypoints` con los defaults del editor (`null/null/"straight"/[]`) o los que reciba ya decididos; la ruta se deriva en `edgePoints` (verificado con test: Cliente(200,300)→Comercio(600,300) → `(290,300)…(510,300)`). No hay segundo sistema de geometría.
- *Behaviors:* crear un nodo NO crea Behavior (como el editor; UP implícito). La conexión no tiene Behavior ni EventType (`eventTypeId` es una clave rechazada).
- *Auto-lazo:* regla del dominio compartido (`self_loop`), comprobada antes que la existencia.
- *Quedan para MCP/authoring (no en el dominio):* `baseRevision`, resolución de refs de lote, límites numéricos (nodos, conexiones, payload), `resolveColor` (nombres→hex), icono/anim del catálogo, formato de color, longitudes, `image` (no se ofrece), atomicidad del lote.

**Diferencias respecto al editor anterior (todas justificadas):**
1. Un registro se **normaliza como al cargar** (p. ej. `dots`>6→6, `fs` fuera de 8–96 se acota, un `img` SVG se reescribe a base64). Para el editor es el mismo valor (ya llega normalizado y la normalización es idempotente; paridad verificada en las 10 formas).
2. `newEdge` con un extremo inexistente ahora lanza `source_not_found`/`target_not_found` (antes insertaba una conexión rota). Inalcanzable desde la UI. Obligó a ajustar un solo test (`scenario-post-qa`, agotamiento de ids), que ahora crea dos nodos reales antes de agotar el contador.
3. Una forma desconocida lanza `invalid_document` (antes caía a 160×70 y el documento resultante no cargaba).
4. Un `extra.id` ya no se ignora en silencio: se valida como id explícito (ningún llamador lo usa).
5. Un `undefined` en la spec se ignora (antes pisaba el default con `undefined`).
6. Se conserva la peculiaridad previa: un nodo `code` sin `lang` recibe `keywords:null` aunque se pasen `keywords`.

**Pruebas:** `test/fluyo-018-1.test.cjs` (29 tests: nodos por forma contra un oráculo con el código ORIGINAL de `newNode`/`newEdge` y contra el editor real, decimales, ids, refs, validaciones, conexión, atomicidad, paridad Cliente→Comercio→Pago con documento completo idéntico incluido el orden de claves, persistencia→integridad→Trace, documentos antiguos, spike descartable de una capa de authoring). `test/fluyo-018-1-mutations.cjs`: 29/29 mutaciones detectadas. Suite completa: 771/771.

**QA en Chrome real (018.1):** Chrome + Playwright, mismo guion de UI ejecutado contra el working tree y contra HEAD (`git show` a una carpeta temporal) y comparado. Ratón/teclado reales: 10 formas (incluye icono, GIF, imagen y código), etiquetas por doble clic, conexiones por clic (modo Flecha) y por arrastre de la flecha del nodo, mover/redimensionar, nodos cercanos/lejanos, paralelas, auto-lazo (rechazado), copiar/pegar/duplicar, borrar repetido; 3 EventTypes por el modal, Historia de 5 Steps, Playback, Present, Reset; Undo/Redo ×5 y rehacer ×5; guardar → reabrir → Playback; Share con Historia y solo diagrama (+ Viewer); botón Ejemplo, Limpiar, 8 ejemplos publicados, documento con Historia y multipágina. Resultado: 0 errores de consola/página, documentos y payloads de Share idénticos a HEAD, 0 regresiones. Única diferencia observada: un muestreo de estados de Playback con temporizador (flaky, no es comportamiento). `sw.js`: HEAD = v61; el working tree cambia assets servidos (model.js, state.js) → bump al publicar. fluyo-mcp no sincronizado.

**Pendiente de 018.2 (y avisos):** tools MCP `create_node`/`create_connection` en `FluyoAuthoring` (refs `nodes`/`edges`, `DUPLICATE_REF`, límites, `baseRevision`, mapa `refs` en la respuesta); regenerar `fluyo-mcp/src/generated/kernel-sources.ts` (`npm run sync:kernel`; `check:kernel` fallará hasta entonces porque cambió `model.js`) — no se tocó fluyo-mcp. `sw.js` NO se tocó (`CACHE` sigue en v61): tres tests existentes fijan v61; al cambiar model.js/state.js hay que subirlo (y esos tests) al publicar.

## Handoff

### Qué se hizo
Auditoría del modelo, del editor y de `edit_diagram`; spikes descartables de paridad, integridad, geometría, revisión y límites; diseño de las operaciones de diagrama y su división.

### Archivos modificados
- `.ai/tasks/FLUYO-018.md` — este documento. **Es el único cambio.** No hay cambios en `js/`, `test/`, `sw.js`, `fluyo-mcp` ni commits.

### Pruebas ejecutadas
Spikes en un directorio temporal de la sesión, fuera de ambos repos (descartados): editor real en `vm` con DOM falso, kernel y `dist/` de `fluyo-mcp` en modo lectura (sin recompilar). Se ejecutó el kernel (`FluyoIntegrity`, `FluyoAuthoring`, `projectFromProjectData`) sobre ~40 mutaciones del documento del fixture. No se ejecutó la suite de tests de los repos (no se modificó nada).

### Próximo paso concreto
(018.1 hecho: ver §22; el siguiente es 018.2.) Resolver las decisiones 1–7 (§21) —al menos 3, 5 y 7, que condicionan 018.1— y abrir FLUYO-018.1 (dominio de edición: `createNodeIn`/`createEdgeIn` + reglas de entrada), con un test que construya el fixture Cliente→Pago→Comercio por el editor y por MCP y compare **la revisión**.

---

## Anexo A — Documento serializado completo producido por el editor (fixture, sin normalizar)

```json
{"version":5,"app":"fluyo","doc":{"theme":"dark","customBg":"","eventTypes":[{"id":1,"name":"Pago","primitive":"FLOW","sentenceTemplate":"{source} paga a {target}","visual":{"kind":"token","value":"●"},"motion":"normal","presentation":{"nodeEffects":{"showSymbol":false,"symbolSize":"medium","message":"","messageColor":"","messageSize":"medium","messageWeight":"normal","messageFont":"default","messagePosition":"above","highlight":false,"blink":false,"dim":false,"fillColor":"","visualDuration":"normal","visualDurationMs":1500},"connectionEffects":{"size":"medium","style":"direct","trail":"none","arrival":"none","during":"none"}}}],"nextEventTypeId":2,"pages":[{"name":"Página 1","nodes":[{"id":1,"shape":"rect","x":200,"y":300,"w":180,"h":70,"label":"Cliente","color":"#6a9fb5","fill":null,"border":"solid","lblPos":"center","textBg":null,"textColor":null,"font":null,"bold":false,"pulse":false,"order":0},{"id":2,"shape":"rect","x":600,"y":300,"w":180,"h":70,"label":"Comercio","color":"#6a9fb5","fill":null,"border":"solid","lblPos":"center","textBg":null,"textColor":null,"font":null,"bold":false,"pulse":false,"order":1}],"edges":[{"id":3,"from":1,"to":2,"fromSide":null,"toSide":null,"route":"straight","waypoints":[],"label":"Pago","font":null,"bold":false,"animated":true,"dashed":false,"startArrow":false,"endArrow":true,"flowDir":"normal"}],"nextId":4,"behaviors":[],"scenarios":[{"id":1,"engineVersion":2,"name":"Compra","nextStepId":2,"steps":[{"id":1,"at":0,"eventTypeId":1,"action":"SEND","edgeId":3}]}],"nextScenarioId":2}],"cur":0},"settings":{"speed":0.5,"dots":3,"build":false,"stagger":0.45,"grid":true,"snap":false,"font":"Georgia, serif","single":false}}
```

Variante del gesto «arrastrar desde la flecha del nodo» (misma conexión, `id:3`): `{"fromSide":"e","toSide":"w","route":"ortho"}` → `edgePoints` = `(290,300) (318,300) (400,300) (482,300) (510,300)`.

## Anexo B — Diferencia exacta editor ↔ MCP (documento normalizado)

Únicas rutas distintas (todas con valor `null` sólo en MCP):
`doc.pages[0].nodes[0].fs`, `doc.pages[0].nodes[1].fs`, `doc.pages[0].edges[0].fs`, `doc.pages[0].edges[0].lineColor`, `doc.pages[0].edges[0].dotColor`.

## Anexo C — Fuentes revisadas

`js/model.js`, `js/state.js`, `js/selection.js`, `js/interaction.js`, `js/geometry.js`, `js/config.js` (`DEFAULT_SIZES`, `SIDES`, `DIR`), `js/ui.js`, `js/export.js`, `js/document-integrity.js`, `js/scenario-engine.js`, `js/story-authoring.js`, `js/editor-scenarios.js` (creación de EventTypes/Historias/Steps), `.ai/DECISIONS.md` (70–78), `.ai/tasks/FLUYO-017.2.md`/`017.3.md`; `fluyo-mcp/src/diagram.ts`, `model.ts`, `authoring.ts`, `kernel.ts`, `revision.ts`, `stories.ts`, `server.ts`, `svg.ts` (geometría), `generated/kernel-sources.ts` (archivos del kernel).
