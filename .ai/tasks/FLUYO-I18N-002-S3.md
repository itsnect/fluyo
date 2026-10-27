# FLUYO-I18N-002 · S3 — Narrativa del motor y valores sembrados: auditoría (READ-ONLY)

Estado: **S3a CLOSED / VERIFIED / IN PRODUCTION** (2026-10-27, §24).
- `e39b7e3`, integrada en `main` por avance rápido y publicada (`7305355..e39b7e3`). fluyo.space sirve `fluyo-static-v114`.
- Kernel y `fluyo-mcp` (`464f4e0`) intactos.
- D-S3-12 = (a): solo claves para los grupos Seguridad y DevOps, sin tocar el cajón.
- Fuera de S3a, sin empezar: Propiedades (decisión 287), el cajón que no pinta Seguridad ni DevOps (bug aparte) y fr/ja/zh (S5).

Historia del documento:
Auditoría revisada y **D-S3-1…11 aprobadas por el PO** (decisiones 281–288, §21). Se empieza por **S3a, sin kernel**. Las reglas
K1 quedan reservadas para la resincronización de S2b. **Sin código, tests, `CACHE`, MCP, commit, push ni deploy.**
Tarea madre: `.ai/tasks/FLUYO-I18N-002.md`. Este archivo va aparte a propósito: S2a se está implementando a la vez en el mismo árbol,
y la sesión de S2 escribe en la tarea madre. Al cerrar S2, se puede enlazar o fundir aquí.

> Repo público: solo contenido técnico.

## 0. Base comprobada

- `main` = `origin/main` = `a0919e6` (S1, `CACHE` v110). En el árbol, **S2a en curso** (otra sesión): `js/i18n.js` (añade
  `FluyoI18n.list`) y `js/editor-scenarios.js` modificados, sin commit. Esta auditoría **no** da por hecha la arquitectura de S2:
  las líneas citadas de `editor-scenarios.js` son de `a0919e6`.
- Las decisiones D-S2-1…7 **no están registradas** (ni en la tarea ni en `DECISIONS.md`, que llega a la 280). Los comentarios del
  código en curso dicen «S2a», así que la partición S2a/S2b (D-S2-2) parece aceptada, pero no consta. Cada punto que depende de S2
  está marcado **[dep S2]**.
- **Kernel del MCP sincronizado**: los 8 archivos de `KERNEL_SCRIPTS` (`fluyo-mcp/scripts/sync-kernel.ts`: `config.js`,
  `safe-svg.js`, `model.js`, `scenario-engine.js`, `scenario-playback.js`, `story-playback.js`, `document-integrity.js`,
  `story-authoring.js`) tienen hoy el mismo sha256 que `fluyo-mcp/src/generated/kernel-sources.ts` (sincronizado desde `db380d3`).
- Volcado de literales por archivo y línea, fuera del repo: `s3-literals.tsv` en el scratchpad de la sesión.

## 1. Alcance exacto de S3

El plan (§9) definía S3 así: «errores del motor y de integridad por código en la UI; proveedor de texto en `describe`; nombres
sembrados inyectables (`model.js`), demo `?s=demo`, ejemplo incorporado; en inglés». Después de S1 y de la auditoría de S2, el
alcance real es este:

| Bloque | Qué | Archivos | ¿Es de S3? |
|---|---|---|---|
| **A · Narrativa de la reproducción** | 15 errores por código + reserva, «{x} no está disponible», «{x} vuelve a estar disponible», «No se completó · {x} no está disponible», «Reproducción terminada», «1 evento no pudo realizarse / N eventos…», «Elemento sin nombre» | `story-playback.js` (kernel), `viewer.js:169`, `present-story.js:163` | **[dep S2]** Según D-S2-1/D-S2-2 va en **S2b**. Solo vuelve a S3 si el PO elige D-S2-1 = B |
| **B · Valores sembrados del kernel** | «Página 1» (documento inicial), «Página {n}» (página nueva), «Historia {n}», «{name} copia» / «{name} copia {n}», «Nodo», «Texto», «Origen»/«Destino» (reserva de la frase) | `model.js` (kernel) y quien lo llama: `state.js`, `editor-scenarios.js`, `interaction.js` | **Sí** (núcleo de S3) |
| **C · Valores sembrados del editor** | Ejemplo incorporado (botón «Ejemplo»): página «Ejemplo» / «Ejemplo {n}», 8 etiquetas de nodo y 6 de conexión | `export.js:79–101` | **Sí** (cruza con D-EXAMPLES, S7) |
| **D · Nombres de `config.js`** | ≈ 75 nombres de icono y 8 de GIF (cajón, tooltip **y** etiqueta sembrada del nodo), 14 nombres de color de la paleta (tooltips), grupo de cajón «Seguridad» | `config.js` (kernel, **no se toca**), `ui.js` (cajones), `interaction.js:522–523` | **Sí** (el plan y S1 lo dejaron en S3) |
| **E · Frase del evento nuevo y «(copia)»** | `SC_DEFAULT_PHRASES` («{source} envía a {target}», «{target} cambia») y el sufijo « (copia)» del evento duplicado | `editor-scenarios.js:2395, 2430, 2477` | **[dep S2]** D-S2-3 recomienda hacerlo **en S2**. Solo vuelve a S3 si no |
| **F · Errores de integridad** | 10 mensajes por código + 2 avisos | `document-integrity.js` (kernel) | **No.** Ninguna superficie del producto los muestra (ver §5): son salida del MCP (D-MCP) |
| **G · Errores de autoría** | 123 textos | `story-authoring.js` (kernel) | **No.** Contrato del MCP (D-MCP). No lo cargan ni el editor ni el Viewer |
| **H · Fixture `?s=demo`** | 6 textos del documento demo | `share-loader.js:26–45` | **No se traduce** (fixture de desarrollo y tests); solo marcarlo para el escáner (D-S3-7) |
| **I · Reserva de la pista del lienzo vacío** | «Elige una forma o icono…» como valor por defecto de `opts.emptyHint` | `render.js:1399` | Residual: el editor y el Viewer ya pasan su texto traducido (S1); queda solo como reserva. Marcar o quitar |

**Superficie huérfana detectada (no es de S3, pero nadie la tiene):** **Propiedades** (≈ 154 textos en `#selBody` de `index.html`,
≈ 60 en `ui.js`: `SHAPE_NAMES`, «Código»/«Texto» del rótulo, «Automático…», «Sin relleno», «Sin fondo», «Del tema»…). S1 la
mandó a S2 y la auditoría de S2 la dejó fuera sin asignarle slice. Ver D-S3-9.

**Fuera de S3 (sin cambios):** `story-authoring.js`, `document-integrity.js`, las descripciones y errores propios del MCP (D-MCP),
`CODE_DEFAULT_LABEL` (es código SQL), nombres de fuente, el corte del globo y de etiquetas CJK en `render.js` (S4), los ejemplos
de `ejemplos/data/` y los títulos de `examples.js` (S7), los falsos positivos del escáner (`link-codec.js` «vacío», «versión»,
«no es un diagrama Fluyo»: son `Error.message` internos que nunca se muestran; `console.*`; nombres de tecla).

## 2. Archivos afectados

| Archivo | Bloque | Kernel MCP | Cambio previsto |
|---|---|---|---|
| `js/state.js` | B | no | `addPage()` pasa el nombre traducido a `createPageIn`; nombre de la primera página de un documento nuevo |
| `js/interaction.js` | B, D | no | etiqueta sembrada de icono/GIF con el nombre traducido; «Nodo»/«Texto» explícitos al crear |
| `js/ui.js` | D | no | cajón de iconos y GIFs (rótulo y tooltip), tooltips de la paleta, grupo «Seguridad» |
| `js/export.js` | C | no | ejemplo incorporado y `examplePageName` |
| `js/editor-scenarios.js` | B (Historia nueva y duplicada; «Origen»/«Destino» en filas) · E | no | **[dep S2]**: archivo de S2; S3 solo después de cerrar S2a |
| `js/model.js` | B | **sí** | solo si D-S3-3 = K1 (formateador opcional). Con K0, no se toca |
| `js/story-playback.js` | A | **sí** | solo si A vuelve a S3 (D-S2-1 = B) |
| `js/viewer.js`, `js/present-story.js` | A | no | solo si A vuelve a S3 |
| `js/render.js` | I | no | reserva de `emptyHint` (1 línea) |
| `js/i18n-en-editor.js` | B, C, D | no | claves nuevas (todo lo sembrado es del editor: el Viewer no crea contenido) |
| `js/i18n-en.js` (común) | A | no | solo si A vuelve a S3 |
| `sw.js` | — | no | `CACHE` a la siguiente libre (ver §18) |
| `js/config.js` | D | **sí** | **no se toca** (ver §9) |

## 3. Textos estáticos (inventario completo)

### B · Kernel (`model.js`) — se guardan en el documento

| Texto | Dónde | Lo ve | Lo emite el MCP |
|---|---|---|---|
| «Página 1» | `model.js:7` (`doc` inicial), `:1374` (importar el formato antiguo `state`) | página del primer documento | sí (`create_diagram` parte del `doc` inicial) |
| «Página {n}» | `model.js:1023` (`createPageIn` sin nombre) ← `state.js:33` `addPage()` ← botón «＋» (`ui.js:917`) | pestaña nueva | sí (crear página sin nombre) |
| «Historia {n}» | `model.js:582–587` `defaultScenarioName` ← `editor-scenarios.js:396, 3163` | Historia nueva | sí (`create_story` sin nombre, `story-authoring.js:792`) |
| «{name} copia», «{name} copia {n}» | `model.js:588–595` `copyScenarioName` ← `duplicateScenario` ← `editor-scenarios.js:410` | Historia duplicada | sí (`duplicate_story` sin nombre) |
| «Escenario» | `model.js:571` (parámetro por defecto de `createScenario`) | **nadie**: el editor y el MCP siempre pasan nombre | — |
| «Nodo», «Texto» | `model.js:845` (`createNodeIn`) ← `newNode` (`state.js:7`) | etiqueta de una caja/forma o de un texto nuevo | sí (`create_node` sin `label`) |
| «Origen», «Destino» | `model.js:463–464` (`renderEventSentence`, cuando falta el extremo) | fila del paso en Historias (`editor-scenarios.js:126, 150`: se pasa `null` como origen) | sí, dentro de `sentence` |

### C · Ejemplo incorporado (`export.js`)

Página «Ejemplo» / «Ejemplo {n}» (`:79–83`); nodos «Funnel de ventas», «Visitantes», «Lead\nregistrado», «¿Califica?»,
«Oportunidad», «Propuesta\nenviada», «Cliente», «Descartado»; conexiones «visita», «formulario», «sí», «demo», «firma», «no»
(`:88–101`). **16 textos** (dos con salto de línea dentro).

### D · Nombres de `config.js` que ve la interfaz

- **Iconos (75)**, por grupo:
  - General: BD, Cola, Usuario, Usuarios, Móvil, Nube, Búsqueda, Seguridad, IA · *(marcas o siglas: Kafka, K8s, Web, API, Terminal)*.
  - Estados: Éxito, Error, Aviso, Info, Duda, Bloqueado, Reintento, Bug, Alerta.
  - Seguridad: Escudo, Clave, Cortafuegos, Certificado, Secretos.
  - DevOps: Registros, Pruebas, Autoescalado · *(Cron, Webhook, CI / CD)*.
  - Varios: Archivo, Carpeta, Correo, Mensajería, Reloj, Config, Servidor, Cache, Balanceador, Filtro, Flujo, Tabla, Integración,
    Purga, Métricas · *(CDN, DNS, Git, Docker)*.
  - GCP, AWS y Azure: marcas (GKE, Cloud SQL, Pub/Sub, BigQuery, Cloud Run, Storage, Vertex AI, Functions, Lambda, S3, EC2, DynamoDB,
    SQS, API GW, VM, Cosmos DB, Service Bus, AKS).
  - → **≈ 41–45 traducibles**, ≈ 30 marcas o siglas que no se traducen (lista exacta: D-S3-4).
- **GIFs (8)**: Cargando, Progreso, Ticket, Error, Éxito anim, Escribiendo, Subiendo, Latido.
- **Paleta (14)**, tooltips de los colores en Propiedades (`ui.js:263, 378`): Servicio, Eventos / Kafka, Datos, IA, Alerta,
  Externo, Config, Cache, Cola, Red, Almacén, Éxito, Error, Info.
- **Grupo del cajón «Seguridad»**: `drawerGroupName` (`ui.js:783–788`) traduce Estados, General y Varios, pero **no «Seguridad»**:
  hoy, con `?lang=en`, ese rótulo sale en español (hueco de S1). «DevOps», GCP, AWS y Azure no se traducen.
- **Dónde se ven**: el botón del cajón (`ui.js:799–800`, `826`: texto y `title`) y la **etiqueta sembrada** del nodo al soltarlo
  (`interaction.js:522–523`, `label: ICONS[k].n`).

### A · Narrativa (si vuelve a S3) — `story-playback.js`

`ERROR_MESSAGES` (15, `:40–56`), `ERROR_FALLBACK` (`:57`), `nodeText` «Elemento sin nombre» (`:159`), `caption` (`:235, 238`),
`summary` (`:251`), `describe` «Reproducción terminada» (`:268`). `NARRATED_NOTE` (`:108`) es solo salida del MCP (`outcomes`):
no se traduce. Detalle y claves: auditoría de S2, §2 y §7.

## 4. Valores por defecto que hoy están en español

Todos los de §3·B, §3·C y §3·D (etiqueta sembrada), más **[dep S2]** `SC_DEFAULT_PHRASES` y « (copia)» (§1·E). Quien crea con la
interfaz en inglés obtiene hoy: «Página 2», «Historia 2», «Historia 1 copia», «Nodo», «Texto», «Usuario», «Cargando», un funnel en
español y, en la fila del paso, «Origen».

Criterio (D-SEED del plan, D-S2-3; pendiente de confirmar por el PO, **D-S3-2**): **nacen en el idioma de la interfaz de quien crea;
después son contenido del autor** y nunca se retraducen.

## 5. Textos generados por el kernel

| Función (kernel) | Texto | Consumidor en el producto | Consumidor en el MCP |
|---|---|---|---|
| `FluyoStory.errorMessages` / `start` | 15 + reserva | `#scErrors` del editor, banda del Viewer (`viewer.js:182`) | — (el MCP usa `run`, con códigos) |
| `FluyoStory.caption` / `summary` / `describe` | consecuencias, cierre | `#scNow`, Present, Viewer, sonda de Present | no |
| `FluyoStory.sentence` / `nodeText` | frase del paso + «Elemento sin nombre» + «?» | — (el editor tiene su copia: `scNodeFallback`) | **sí** (`stories.ts:199, 434`) |
| `FluyoStory.outcomes` | `NARRATED_NOTE` | no | **sí** |
| `renderEventSentence` (`model.js`) | reservas «Origen»/«Destino» | filas del paso, vista previa del modal | **sí** (dentro de `sentence`) |
| `FluyoIntegrity` (`document-integrity.js`) | 10 errores + 2 avisos | **ninguno**: el editor solo llama a `removalImpact` (`selection.js:86`) y no lee `message`; el Viewer no carga el archivo | **sí** (`author_document`, `describe_document`) |
| `story-authoring.js` | 123 | ninguno (no se carga) | **sí** |
| `defaultScenarioName`, `copyScenarioName`, `createPageIn`, `createNodeIn`, `doc` inicial | §3·B | editor | **sí** |
| `config.js` (`ICONS[k].n`, `ANIMS[k].n`, `PALETTE[i].n`) | §3·D | cajones, tooltips, etiqueta sembrada | **sí**: `list_icons`/`list_anims` (generado por `sync-config.ts` en `src/generated/config.ts`, campo `label`) |

Conclusión: **lo único del kernel que la interfaz necesita traducir es la narrativa (A) y los valores sembrados (B)**. Integridad y
autoría son solo del MCP.

## 6. Concatenaciones problemáticas

| Sitio | Código | Problema | Tratamiento |
|---|---|---|---|
| `model.js:585–586` | `"Historia "+n` | orden fijo; ja/zh sin espacio o con contador delante | plantilla «Historia {n}» |
| `model.js:589–594` | `base+" copia"`, `base+" copia "+n`; recorte `120-" copia 999".length` | orden y **longitud del recorte calculada sobre el sufijo español** | plantillas «{name} copia» / «{name} copia {n}»; el recorte se mide con el sufijo **ya formateado** del idioma |
| `model.js:1023` | `"Página "+(n)` | zh «第 {n} 页» (número dentro) | plantilla «Página {n}» (ya existe `page.untitled` en el diccionario común con ese texto) |
| `export.js:80–82` | `"Ejemplo "+k` | igual | «Ejemplo {n}» |
| `model.js:463–464` | reserva insertada en la frase del autor | idioma mixto inevitable (la frase es del autor) | aceptado (decisión 260, R-S2-7): solo cambia la palabra de reserva |
| `story-playback.js:216` | `names.join(" · ")` (título del momento) | separador entre textos del autor | **no** es una lista con conjunción; « · » es neutro. Opcional: clave `story.momentSep` |
| `story-playback.js:235–251` | sujeto + verbo, plural a mano | ver auditoría S2 §4 | **[dep S2]** S2b |

## 7. Pluralización y listas

- **S3 (B, C, D) no tiene plurales ni listas**: «Historia {n}», «Página {n}» y «copia {n}» son ordinales de nombre, no recuentos
  (no llevan `{one, other}`). `FluyoI18n.list` (S2a) no hace falta en S3.
- Solo la narrativa (A) tiene un plural: «1 evento no pudo realizarse / N eventos…» → `story.failedCount` `{one, other}`, con el
  término de D-S2-4 («step» en inglés). **[dep S2]**
- Números de los nombres: enteros pequeños en dígitos ASCII en los cinco idiomas (ja/zh usan dígitos de medio ancho en la UI); no
  necesitan `FluyoI18n.num`.

## 8. Lo que NO se traduce (contenido del autor)

- Cualquier nombre **ya guardado**, aunque sea un valor sembrado en español («Página 1», «Historia 2», «Nodo», «Usuario» de
  documentos existentes, de enlaces y de archivos). **Nunca** una heurística del tipo «si se llama "Página 1", traducirlo».
- Lo creado en otro idioma: un documento con «Page 1» abierto en español sigue diciendo «Page 1»; la página siguiente nacerá
  «Página 2» (documento mixto: consecuencia aceptada de D-SEED).
- Etiquetas, nombres de página, Historia y evento, `sentenceTemplate`, `message`, símbolos; el título del momento (`momentText`).
- `CODE_DEFAULT_LABEL` (SQL), nombres de fuente, marcas de icono, claves de `ICONS`/`ANIMS`/`THEMES`, códigos y enums.
- La salida del MCP (D-MCP): sigue en español byte a byte.
- El documento demo `?s=demo` (fixture de desarrollo; D-S3-7).

## 9. Qué parte afecta al MCP

| Pieza | Efecto en el MCP |
|---|---|
| `config.js` | **Ninguno si no se toca.** Los nombres se traducen por clave en la interfaz (`ui.js`, `interaction.js`); `config.js` sigue siendo la fuente española y la reserva. Tocarlo cambiaría `kernelId` **y** `src/generated/config.ts` (`sync-config --check` fallaría; `list_icons` cambiaría de salida) |
| `model.js` (B) | Con **K0** (§10): ninguno. Con **K1**: cambia `kernelId`; la salida del MCP sigue idéntica porque el MCP no pasa formateador |
| `story-playback.js` (A) | **[dep S2]** S2b: proveedor opcional, salida idéntica, resincronización |
| `document-integrity.js`, `story-authoring.js` | Ninguno (no se tocan) |
| Textos propios del MCP (descripciones, errores) | Ninguno (D-MCP) |

## 10. Qué parte exige resincronizar el kernel

- **Cualquier byte** en los 8 archivos de `KERNEL_SCRIPTS` cambia `kernelId` y exige `npm run sync:kernel` en `fluyo-mcp`, su commit
  y, para que el `kernelId` publicado coincida, su despliegue (precedente: KERNEL-SYNC-001).
- Además, en **este** repo hay guardas que lo exigen en el mismo cambio (decisión 70): `test/fluyo-scenarios-semantics-6.test.cjs`
  (C3: el sha256 de `model.js` debe ser el de `kernel-sources.ts` del MCP hermano) y `test/fluyo-018-27.test.cjs`. **Cambiar
  `model.js` sin resincronizar rompe la suite de fluyo.**
- Dos maneras de localizar B:
  - **K0 · sin kernel.** El editor pasa los valores ya traducidos: `createPageIn(doc, nombre)`, `newNode(…, {label})`,
    `createScenario(pg, nombre)`, `renderEventSentence(et, palabraOrigen, …)`; el documento inicial se nombra al arrancar si es
    nuevo. **Lo que no se puede sin kernel**: la regla de nombre único de «Historia {n}» y la de «copia {n}» (con su recorte a 120)
    viven en `model.js`; con K0 el editor tendría su propia copia de esas dos reglas (≈ 12 líneas), vigilada por un test que exige,
    en español, el mismo resultado que el kernel.
  - **K1 · con kernel.** `defaultScenarioName(pg, fmt?)`, `copyScenarioName(pg, name, fmt?)` y `duplicateScenario(pg, id, fmt?)`
    aceptan un formateador opcional; sin él, el español de hoy byte a byte. Una regla, sin copia. Exige resincronizar.
- **Recomendación**: K0 para página, nodo, texto, origen/destino y ejemplo (no necesitan kernel en ningún caso), y **K1 solo para
  las dos reglas de Historia, dentro de la MISMA ventana de resincronización que S2b** (`story-playback.js`). Así hay un único
  cambio de `kernelId` para A + B. Si S2b ya se hubiera publicado cuando llegue S3, K0 completo (evita una segunda resincronización).
  Ver D-S3-3.

## 11. Claves i18n estimadas

| Bloque | Claves | Diccionario |
|---|---:|---|
| Página nueva / primera página | 0–1 (se puede reutilizar `page.untitled` «Página {n}», común) | común (existe) |
| Historia nueva, copia, copia {n} | 3 (`seed.story`, `seed.storyCopy`, `seed.storyCopyN`) | editor |
| Nodo, Texto | 2 (`seed.node`, `seed.text`) | editor |
| Origen, Destino (reserva de la frase) | 2 (`seed.source`, `seed.target`) — **distintas** de las fichas del modal de S2, aunque el español coincida | editor |
| Ejemplo incorporado | 2 (página) + 14 (etiquetas) = 16 | editor |
| Iconos traducibles | ≈ 41–45 (`icon.<clave>`) | editor |
| GIFs | 8 (`anim.<clave>`) | editor |
| Paleta | 14 (`palette.<n>`) | editor |
| Grupo «Seguridad» | 1 (`drawer.groupSecurity`) | editor |
| Reserva de `emptyHint` | 0 (reutiliza la clave de S1 o se quita la reserva) | — |
| **Total S3 sin narrativa** | **≈ 88–95** | editor |
| + Narrativa si vuelve a S3 (A) | ≈ 22–25 | común |

Peso inglés estimado: editor +≈ 3 KB (lejos del presupuesto de 400 KB de la decisión 272).

## 12. Impacto en español

**Ninguno visible.** Requisito duro (como S1/S2): los mismos nombres sembrados byte a byte («Página 2», «Historia 3», «Historia 1
copia 2», «Nodo», «Texto», «Usuario», el funnel), el mismo recorte a 120, los mismos cajones y tooltips, y `serializeProject`
idéntico tras cada flujo de creación. Los ≈ 100 tests de fluyo que buscan «Historia », 22 que buscan «Página 1» y los del funnel
siguen valiendo porque el español no cambia. El MCP, idéntico.

## 13. Impacto en inglés

- Documentos nuevos nacen con «Page 1», «Page 2», «Story 1», «Story 1 copy», «Node», «Text», «User», «Loading»; el botón «Example»
  crea una página «Example» con el funnel en inglés.
- Cajones de iconos y GIFs y tooltips de la paleta en inglés; el grupo «Security».
- Con la narrativa (si va en S3 o S2b): «Paused · Bank is unavailable», «Playback finished», «2 steps couldn't run» (término según
  D-S2-4).
- **Documentos mixtos esperados**: un documento hecho en inglés y continuado en español tendrá «Page 1» y «Página 2». Es contenido,
  no se corrige.
- El MCP sigue sembrando en español («Página 1», «Historia 1», «Nodo») aunque el editor esté en inglés (D-MCP).

## 14. Requisitos para francés, japonés y chino

| Tema | Requisito |
|---|---|
| Plantillas con número | zh «第 {n} 页» (número dentro), ja «ページ {n}», fr «Page {n}»: el `{n}` siempre como marcador, nunca concatenado |
| Sufijo de copia | fr «{name} (copie)» / «{name} (copie {n})»; ja «{name} のコピー» / «{name} のコピー {n}»; zh «{name} 副本» / «{name} 副本 {n}» (propuestas para la revisión nativa). **El recorte a 120 se calcula con el sufijo formateado** del idioma, no con « copia 999» |
| Unicidad | se compara el texto exacto del idioma de quien crea (NFC); «Story 2» y «Historia 2» no chocan entre sí |
| Términos | Historia: fr «Histoire» ⚑ / «Scénario», ja «ストーリー», zh «故事»; Página: «Page» / «ページ» / «页面»; Nodo: «Nœud» / «ノード» / «节点»; Texto: «Texte» / «テキスト» / «文本» (glosario; revisión nativa, decisión 275) |
| Nombres de icono | forma natural de UI (ja en katakana cuando es lo habitual: «サーバー», «キャッシュ»; zh «服务器», «缓存»); las marcas no se traducen |
| Puntuación | ejemplo: «¿Califica?» → fr «Qualifié ?» (espacio fino, test de S0), ja «条件を満たす？», zh «符合条件？»; sin «¿» en ningún otro idioma |
| Mayúsculas | ninguna en código; nada de `toUpperCase` |
| Lienzo | etiquetas sembradas largas en fr («Équilibreur de charge») y CJK sin espacios: el corte y la medida de etiquetas son de **S4** (`render.js`) |
| Revisión | fr/ja/zh **no** se escriben en S3 (D-S3-11 = como D-S2-7): caen al inglés; se demuestran con los idiomas de prueba del arnés (`qps`, `qps-cjk`) |

## 15. Tests necesarios

| # | Qué | Cómo |
|---|---|---|
| 1 | **Español idéntico** | vm, oráculo de la base (`git show` del commit de partida): `createPageIn`, `defaultScenarioName`, `copyScenarioName`, `duplicateScenario`, `createNodeIn`, `renderEventSentence` y el ejemplo incorporado, sobre un corpus (0/1/2/N Historias, nombres ocupados, nombres de 118–120 caracteres, copias encadenadas). Chrome: cada flujo de creación en es → `serializeProject` byte a byte igual a la base; cajones y tooltips iguales; píxel a píxel en cajón de iconos, GIFs y paleta |
| 2 | **Inglés** | Chrome `?lang=en`: «＋», «Nueva historia», duplicar ×3, soltar caja, texto, icono y GIF, botón «Example» → los valores ingleses exactos; `missing()` vacío |
| 3 | **Nunca se retraduce** | documento con «Página 1»/«Historia 1»/«Nodo» abierto en en: intacto. Cambio en vivo es → en → es: ningún nombre cambia, ninguna entrada de Deshacer, ningún autoguardado extra |
| 4 | **Unicidad y recorte por idioma** | en y `qps-cjk`: «Story 2» ocupada → «Story 3»; «X copy», «X copy 2»; nombre de 120 → la copia mide ≤ 120 con el sufijo de ese idioma |
| 5 | **Paridad MCP** | `config.js`, `document-integrity.js`, `story-authoring.js` idénticos a la base. Con K1: sin formateador = salida española byte a byte; *goldens* del MCP sin cambios; `npm run check:kernel` tras resincronizar; C3 verde. Con K0: `model.js` idéntico a la base |
| 6 | **Catálogo de `config.js`** | cada clave `icon.*`/`anim.*`/`palette.*` tiene como texto base exactamente `ICONS[k].n`/`ANIMS[k].n`/`PALETTE[i].n` (si alguien cambia `config.js`, el test obliga a cambiar la clave); la lista de marcas sin clave es exacta; ningún nombre traducible sin clave |
| 7 | **El kernel no conoce la interfaz** | estático: ningún archivo de `KERNEL_SCRIPTS` menciona `FluyoI18n`, `document` ni `window` nuevos |
| 8 | **Diccionario correcto** | las claves de S3 están en el del editor (salvo `page.untitled` y, si va, la narrativa en el común); el Viewer no carga ninguna clave de S3 que no use |
| 9 | **Pseudo-idioma** | `qps` en Chrome: cajones, tooltips y cada valor sembrado salen entre corchetes (prueba de que pasan por `t()`); detector de desbordes en el cajón a 1440 y 390 |
| 10 | **Undo/Redo** | crear página, Historia, copia, nodo, icono y ejemplo en inglés: mismas entradas de Deshacer que hoy, documento exacto tras Undo/Redo |
| 11 | **Share/Viewer** | documento creado en inglés → Viewer en es: «Page 1», «Story 1», «User» tal cual (contenido) |
| 12 | **Offline** | SW con la `CACHE` nueva: sin red, los valores sembrados en inglés funcionan (sin archivos nuevos: `ASSETS` y `VIEWER_ASSETS` iguales) |
| 13 | **Trinquete** | `export.js` 13 → ≈ 4, `render.js` 2 → 1, `interaction.js` sin cambio (nombres de tecla), `model.js` y `config.js` sin cambio (kernel: su español es la reserva; regla de S2 «reserva del kernel» = migrado si hay clave con el mismo texto base) |
| 14 | **Primera página** | documento nuevo en en → «Page 1»; con sesión guardada, enlace `#d=`, `?ejemplo=` o archivo abierto, **no** se renombra nada |

## 16. Mutaciones recomendadas

Cada una debe hacer fallar algún test (`fluyo-i18n-002-s3-mutations.cjs`, como en las slices anteriores):

1. quitar el `label` explícito de `newNode` (vuelve «Nodo» del kernel con la interfaz en inglés);
2. cambiar el texto base de una reserva del kernel («Historia » → «Story »);
3. renombrar un «Página 1» existente al cambiar de idioma;
4. recortar con la longitud del sufijo español con un sufijo localizado más largo;
5. quitar el bucle de unicidad en la regla del editor (K0) o en el formateador (K1);
6. desalinear una clave `icon.*` de `ICONS[k].n`;
7. traducir una marca («Kafka» → «カフカ»);
8. cambiar `model.js` sin resincronizar el MCP (ya lo detecta C3; se mantiene como mutación);
9. mencionar `FluyoI18n` dentro de un archivo del kernel;
10. poner una clave de S3 en el diccionario común (o la narrativa en el del editor);
11. renombrar la primera página cuando se restaura una sesión.

## 17. Riesgos

| # | Riesgo | Mitigación |
|---|---|---|
| R-S3-1 | Dos ventanas de resincronización del MCP (S2b y S3) | K1 dentro de la ventana de S2b, o K0 completo (D-S3-3) |
| R-S3-2 | Con K0, la regla de nombres de Historia del editor diverge de la del kernel/MCP | test de igualdad en español contra el kernel (§15.1, 15.5) |
| R-S3-3 | La primera página «Page 1» al arrancar interfiere con restaurar sesión, `#d=`, `?ejemplo=` o con «Sesión guardada» | solo un documento recién creado y vacío; test §15.14; sin autoguardado ni Deshacer |
| R-S3-4 | Documentos mixtos («Page 1» + «Página 2») percibidos como fallo | es la decisión 260 + D-SEED; se documenta |
| R-S3-5 | `list_icons` del MCP en español y el cajón en inglés | aceptado (D-MCP); `config.js` intacto |
| R-S3-6 | El ejemplo incorporado se rehace en S7 (D-EXAMPLES) | 16 textos: coste bajo; decidir en D-S3-5 |
| R-S3-7 | Nombres de icono largos en fr o CJK desbordan el cajón (390 px) o la etiqueta del nodo | detector de desbordes (§15.9); etiqueta en lienzo, S4 |
| R-S3-8 | Concurrencia: S2a escribe ahora en `editor-scenarios.js`, `i18n.js` y, probablemente, `index.html` y `ui.js` | S3 empieza solo con S2a commiteada (y S2b, si va); una escritura cada vez (R12) |
| R-S3-9 | Propiedades sin slice | D-S3-9 |

## 18. Dependencias con S2

| # | Dependencia | Efecto en S3 |
|---|---|---|
| S2-1 | **D-S2-1 / D-S2-2** (narrativa en S2b o en S3) | Si S2b: S3 no toca `story-playback.js`, `viewer.js` ni `present-story.js`. Si D-S2-1 = B: A entra en S3 con el diseño de la auditoría de S2 (proveedor opcional) |
| S2-2 | **D-S2-3** (frase por defecto y «(copia)» del evento; «Historia N» y « copia») | Si S2 hace la frase y «(copia)», S3 no toca `editor-scenarios.js` salvo las llamadas de Historia nueva/duplicada y las reservas «Origen»/«Destino». «Historia N»/« copia» los recomienda S2 para S3 (o para la resincronización de S2b): coherente con D-S3-3 |
| S2-3 | **D-S2-4** («step» frente a «event») | término de `story.failedCount` en inglés (si A cae en S3) |
| S2-4 | Espacio de nombres de claves de S2 (`story.*`, `event.dialog.*`, `story.unnamed`) | S3 usa `seed.*`, `icon.*`, `anim.*`, `palette.*`, `example.*`: sin choques. «Origen»/«Destino» de S3 son reservas de la frase, **no** las fichas del modal de S2 (clave distinta) |
| S2-5 | `FluyoI18n.list` (S2a, en curso) | S3 no lo necesita |
| S2-6 | Archivos compartidos: `editor-scenarios.js` (S2), `ui.js` (S1/S2 una línea), `index.html` | S3 después de commitear S2a (y S2b) |
| S2-7 | Cadena de pruebas: `undoS3` bajo `undoS2` (o `undoS2b`); trinquete reescrito por S2 | se genera sobre el commit real de S2 |
| S2-8 | `CACHE` | S2a = v111, S2b = v112 (si se parte) → **S3 = v113**; si S2 no se parte, v112. Se comprueba la siguiente libre al implementar |

## 19. Decisiones que necesita el PO (respondidas el 2026-10-27: ver §21)

- **D-S3-1 · ¿Dónde va la narrativa (A)?** Consecuencia directa de D-S2-1/D-S2-2. Recomendado: **S2b**, y S3 no la toca.
- **D-S3-2 · Valores sembrados en el idioma de quien crea** (confirmar D-SEED). Recomendado: **sí**; después son contenido y nunca
  se retraducen; el MCP sigue sembrando en español.
- **D-S3-3 · Nombres de Historia («Historia {n}», «copia {n}»): K0 o K1** (§10). Recomendado: **K1 en la misma resincronización
  que S2b**; si S2b ya está publicada cuando se implemente S3, **K0**. Página, nodo, texto, origen/destino y ejemplo van sin
  kernel en ambos casos.
- **D-S3-4 · Nombres de `config.js` por clave en la interfaz, sin tocar `config.js`** (iconos, GIFs, paleta). Recomendado: **sí**.
  Hay que fijar la lista de lo que **no** se traduce. Propuesta: marcas de nube y de producto (Kafka, K8s, GCP/AWS/Azure enteros,
  Git, Docker), siglas universales (API, CDN, DNS, CI / CD) y Web, Cron, Webhook. Sí llevan clave las siglas que cambian por
  idioma (BD → DB, IA → AI) y las palabras que en inglés coinciden pero en ja/zh no (Terminal, Cache, Config, Info, Bug, Error).
- **D-S3-5 · Ejemplo incorporado («Funnel de ventas»)**: traducirlo en S3 (16 textos) o esperar a D-EXAMPLES (S7). Recomendado:
  **en S3**, porque es lo primero que ve quien pulsa «Example» con la interfaz en inglés.
- **D-S3-6 · Integridad y autoría siguen en español** (confirmar D-MCP para `document-integrity.js` y `story-authoring.js`):
  ninguna superficie del producto los muestra. Recomendado: **sí**, y un test que lo vigile.
- **D-S3-7 · Fixture `?s=demo`**: no se traduce; se marca como no-interfaz para el escáner. Recomendado: **sí**.
- **D-S3-8 · «Página 1» al importar el formato antiguo `state`** (`model.js:1374`): se queda en español (es migración, kernel).
  Recomendado: **sí**.
- **D-S3-9 · Propiedades sin slice** (≈ 154 HTML + ≈ 60 JS). Recomendado: **slice propia** («S3b · Propiedades») después de S3,
  no mezclarla con los valores sembrados; alternativa: dentro de S3 (más grande).
- **D-S3-10 · Grupo «Seguridad» del cajón** (hueco de S1): arreglarlo en S3. Recomendado: **sí** (1 clave).
- **D-S3-11 · Solo inglés en S3** (como D-S2-7). Recomendado: **sí**; fr/ja/zh caen al inglés y se demuestran con `qps`/`qps-cjk`.

## 20. Qué se puede implementar independientemente

Independiente **lógicamente** de S2 (no depende de ninguna D-S2), aunque no en paralelo en este árbol (`CACHE`, diccionario,
trinquete y cadena de `undo` son compartidos; S2a está escribiendo):

| Pieza | Archivos | Depende de |
|---|---|---|
| **S3a-1** Nombres de `config.js` por clave (cajones, tooltips, etiqueta sembrada de icono/GIF, grupo «Seguridad») | `ui.js`, `interaction.js`, `i18n-en-editor.js` | D-S3-4, D-S3-10 |
| **S3a-2** Ejemplo incorporado | `export.js` | D-S3-5 |
| **S3a-3** Página nueva, primera página, «Nodo», «Texto» (sin kernel) | `state.js`, `interaction.js` | D-S3-2 |
| **S3a-4** Reserva de `emptyHint` | `render.js` | — |
| S3k Historia nueva/duplicada | `model.js` (K1) o `editor-scenarios.js` (K0) | D-S3-3 y S2b |
| S3k «Origen»/«Destino» en filas | `editor-scenarios.js` | S2a commiteada |
| A · Narrativa | `story-playback.js`, `viewer.js`, `present-story.js` | D-S2-1 |

Propuesta de corte: **S3a** (sin kernel: S3a-1…4 + «Origen»/«Destino») como una slice con `CACHE` propia tras S2a; **las reglas
de Historia (K1) dentro de S2b**, en su misma resincronización del MCP.

## 21. Decisiones del PO (2026-10-27) y alcance resultante

Todas las recomendaciones aprobadas, con estas decisiones definitivas (registradas como **281–288** en `.ai/DECISIONS.md`):

| D | Decisión | Nº |
|---|---|---|
| D-S3-1 | La narrativa de la reproducción queda en **S2b**; S3 no la duplica ni la mueve | 281 |
| D-S3-2 | Los valores sembrados nacen en el idioma activo; una vez guardados son contenido y **nunca** se retraducen | 282 |
| D-S3-3 | **K1**: formateador opcional en `model.js` para Historia nueva y copia, **dentro de la misma resincronización del kernel que S2b**. S3a no lo implementa | 283 |
| D-S3-4 | Nombres visibles de `config.js` por clave en la interfaz; `config.js` queda como fuente/reserva en español; las marcas no se traducen | 284 |
| D-S3-5 | El ejemplo «Funnel de ventas» entra en S3 (no S7) | 285 |
| D-S3-6 | Integridad (`document-integrity.js`) sigue en español: salida exclusiva del MCP | 286 |
| D-S3-7 | `story-authoring.js` sigue en español: salida exclusiva del MCP | 286 |
| D-S3-8 | `?s=demo` no se localiza; la importación del formato antiguo conserva «Página 1» | 286 |
| D-S3-9 | Propiedades: slice propia, fuera de S3 | 287 |
| D-S3-10 | El grupo «Seguridad» del cajón se corrige en S3 | 288 |
| D-S3-11 | En S3, solo inglés; fr/ja/zh según la revisión nativa (275) | 288 |

**Alcance resultante**

- **S3a · sin kernel** (la próxima; empieza cuando S2a esté commiteada, desde el `main` real y con la siguiente `CACHE` libre):
  - nombres de `config.js` por clave: cajón de iconos y GIFs (texto y `title`), tooltips de la paleta, etiqueta sembrada al soltar
    un icono o GIF (`interaction.js`), y el grupo «Seguridad»;
  - ejemplo incorporado (`export.js`: página «Ejemplo» / «Ejemplo {n}» y sus 14 etiquetas);
  - página nueva y primera página de un documento nuevo (`state.js`; la reserva `page.untitled` ya existe), «Nodo» y «Texto»
    pasados explícitamente al crear;
  - reserva `emptyHint` de `render.js`;
  - reserva «Origen»/«Destino» en las filas del paso (`editor-scenarios.js`, **después** de S2a).
  - Archivos: `state.js`, `interaction.js`, `ui.js` (cajones), `export.js`, `render.js`, `editor-scenarios.js` (solo las reservas),
    `i18n-en-editor.js`, `sw.js`. Kernel, MCP y `config.js` intactos (`model.js` byte a byte igual: la guarda C3 sigue verde sin
    resincronizar).
  - Tests: §15 sin el punto 5-K1 (con K0 para todo lo de S3a: `model.js` idéntico a la base), mutaciones §16 1, 3, 6, 7, 9, 10 y 11.
- **Reservado para S2b** (misma ventana de resincronización del kernel y del MCP): la narrativa (281) **y** las reglas K1 de
  Historia nueva y copia (283), con sus tests §15.4–15.5 y las mutaciones §16 2, 4, 5 y 8. Hasta entonces, «+ New story» y
  «Duplicate» siguen dando «Historia N» y «… copia» en inglés: es lo esperado y queda registrado.
- **Fuera**: integridad, autoría, `?s=demo`, importación antigua (286); Propiedades (287); fr/ja/zh (288).

**Bloqueo:** S2a comparte con S3a `editor-scenarios.js`, `js/i18n.js`, los diccionarios, `CACHE`, la cadena de `undo` y el trinquete
de textos. Nota del estado del árbol en el momento de registrar las decisiones: los cambios de S2a sin commit (`editor-scenarios.js`,
`flow-semantics.js`, `i18n.js`, `present-story.js`, `selection.js`, `ui.js`, `viewer.js`) están en **este** checkout
(`C:\Proyectos\fluyo-new\fluyo`, rama `main`), no en un worktree aparte; S3 no ha tocado ninguno.

## 22. Recomprobación contra `86d910a` (S4 commiteada, 2026-10-27)

Lectura de §0–§21 contra el nuevo HEAD. Sin código, tests, `CACHE`, MCP ni commit.

- **HEAD de partida**: `86d910a` (S4) sobre `326872e` (S2a). `main` va 1 por delante de `origin/main` (S4 sin push). El código del
  árbol está limpio: lo único sin commit son documentos `.ai/` de otras sesiones.
- **`CACHE`**: `sw.js` = `fluyo-static-v112` (la usó S4, no S2b). Siguiente libre: **v113**. S2b, planificada en v112, también
  necesita una nueva: la que llegue segunda toma v114.
- **Kernel y MCP**: los 8 archivos de `KERNEL_SCRIPTS` no cambian entre `db380d3` y `86d910a`; el sha256 de cada blob coincide con
  `fluyo-mcp/src/generated/kernel-sources.ts`. S3a sigue sin tocar kernel, MCP ni `config.js`.
- **Qué hizo S4 en los archivos de S3a** (ningún solapamiento con las líneas de S3a):
  - `export.js`: `withCjkReserve` en la medida del SVG y `copyPageLang` en PNG/JPG/GIF. El ejemplo sigue en `:79–101`.
  - `interaction.js`: reserva CJK en la caja de edición (`:967`, `:977`). La etiqueta sembrada sigue en `:522–523`.
  - `ui.js`: Enter con IME en el renombrado de página (`:998`). Cajones (`:783–826`) y paleta (`:263`, `:378`) sin cambios.
  - `render.js`: la reserva `emptyHint` pasa de `:1399` a **`:1529`**, y ahora la usan también `withCjkReserve` (`:1530`) y
    `fillText` (`:1531`). S3a solo cambia el texto base de la reserva y conserva la reserva CJK.
  - `editor-scenarios.js`: Enter con IME y `data-cjk` en los segmentos de la frase.
  - `state.js` sin cambios (`addPage` en `:33`).
- **Lo que ya cerró S2a**:
  - Bloque E: frase por defecto `SC_DEFAULT_PHRASES` (`:2409`) y «(copia)» (`:2447`), decisión 291. S3a no los toca.
  - Las reservas «Origen»/«Destino» de las filas siguen pendientes. Las llamadas a `renderEventSentence` con un extremo `null`
    están en `editor-scenarios.js:132`, `:158` y `:3066–3070` (`scSentenceAt`). Las fichas del modal (`event.token.*`) y la vista
    previa (`event.preview.*`) ya están traducidas y no son de S3a.
- **Hallazgo que corrige §3 (D-S3-10)**: el rótulo «Seguridad» no sale en español con `?lang=en`: **no sale nunca**, ni en ningún
  idioma. Lo dice la lectura del código, no se ha probado en el navegador.
  - `buildDrawer` (`ui.js:793`) recorre una lista fija `["Estados","General","Varios","GCP","AWS","Azure"]`.
  - Los grupos `Seguridad` (5 iconos) y `DevOps` (6) de `config.js` no aparecen en esa lista. Ninguno de esos 11 iconos se puede
    elegir desde el cajón; solo llegan por el MCP o al importar.
  - Viene de `1bc0613` («25 iconos nuevos»), que añadió los grupos sin tocar la lista.
  - Traducir el rótulo no arregla nada visible. Pintar los grupos es un cambio de producto que también se ve en español, así que
    rompe el criterio «español idéntico» de §15.1 para el cajón.
  - **D-S3-12 = (a), aprobada por el PO (2026-10-27)**, registrada como precisión de la 288 en `.ai/DECISIONS.md` (sin número
    nuevo):
    - S3a solo prepara las claves `drawer.groupSecurity` y `drawer.groupDevOps` (texto base «Seguridad» y «DevOps»);
    - no cambia la lista de grupos visibles de `buildDrawer`;
    - no introduce ningún cambio funcional ni visual adicional, y el español queda visualmente idéntico;
    - (b), añadir los grupos al cajón, queda descartada en S3a.
  - **Bug / mejora independiente, fuera de FLUYO-I18N-002 S3a**: «los grupos Seguridad y DevOps (11 iconos) no aparecen nunca en
    el cajón de iconos». Va con tarea y `CACHE` propias; no se implementa ahora. Cuando se haga, `drawerGroupName` ya tendrá las
    dos claves.
  - Test de S3a asociado:
    - la lista de grupos de `buildDrawer` sigue siendo exactamente la de `86d910a`;
    - las dos claves existen en el diccionario del editor con su texto base;
    - el cajón en español es idéntico píxel a píxel.
- **Alcance de S3a**: igual que en §21 salvo lo anterior.
  - Archivos: `js/state.js`, `js/interaction.js`, `js/ui.js`, `js/export.js`, `js/render.js`, `js/editor-scenarios.js` (solo las
    3 reservas), `js/i18n-en-editor.js`, `sw.js` (v113).
  - Tests: los de S3a nuevos y las fijaciones de `CACHE`.
  - Cadena de deshacer: `undoS3a` se encadena bajo **`undoS4`**, no bajo `undoS2`.
- **Conflictos potenciales con S2b** (lógicos: ninguno; textuales: varios):
  - Comparten `i18n-en-editor.js` (claves nuevas en espacios distintos: `seed.*`, `icon.*`, `anim.*`, `palette.*`, `example.*`
    frente a `story.*`).
  - Comparten `sw.js` y las ≈ 80 fijaciones de `CACHE` en `test/`.
  - Comparten la cadena de deshacer y el trinquete del escáner.
  - `editor-scenarios.js`: trozos distintos. S2b cambia `:403` y `:417` (K1); S3a, `:132`, `:158` y `:3066–3070`.
  - `model.js`, `story-playback.js`, `viewer.js`, `present-story.js` e `i18n-en.js` son solo de S2b. La ventana de S2b recoge
    también lo pendiente de S4: `xml:lang` del SVG y celdas dobles de `code`.
  - Lo que toca S2b en `model.js` no cambia el resultado de S3a, porque S3a no lo toca.
  - Conclusión: **S3a y S2b en serie**, nunca a la vez. La segunda en llegar rehace sobre el commit de la primera la `CACHE`, la
    cadena de deshacer y la línea base del trinquete.
- **Dónde trabajar**: recomendado un **worktree aislado hermano**, `C:\Proyectos\fluyo-new\fluyo-s3a`, desde `86d910a`.
  - Así `../fluyo-mcp` sigue resolviendo para las guardas C3 y 018-27.
  - Evita escribir en un `main` con documentos `.ai/` sin commit de al menos tres sesiones.
  - Se integra en `main` por avance rápido si nadie ha commiteado en medio.

### 22.1 Secuencia fijada por el PO (2026-10-27)

**S4 → push / deploy / verificación → S2b → S3a.**

- S3a no empieza hasta que S4 esté cerrada en producción **y** S2b esté terminada. S2b es la próxima pieza de kernel/MCP y no
  debe haber dos sesiones a la vez sobre superficies relacionadas.
- S3a partirá del HEAD de ese momento, con la `CACHE` libre de ese momento. La v113 y la base `86d910a` de §22 quedan como
  referencia, no como compromiso.
- Antes de empezar S3a, volver al PO con:
  1. el HEAD exacto de partida;
  2. la `CACHE` libre;
  3. la confirmación de que S2b está cerrada;
  4. la lista final de archivos de S3a;
  5. la confirmación de que `model.js`, `config.js`, `story-playback.js` y el MCP quedan intactos;
  6. la confirmación de que D-S3-12 (a) se limita a preparar claves.
- Al rehacer la comprobación sobre el commit de S2b, hay que revisar:
  - las líneas de `editor-scenarios.js`, que S2b mueve con K1;
  - la cadena de deshacer, que pasa a ir bajo la de S2b;
  - la línea base del trinquete del escáner;
  - que las claves de S3a no choquen con las nuevas de S2b.

## 23. S3a implementada (2026-10-27) — READY FOR COMMIT

S4 y S2b están cerradas y en producción, y el PO autorizó S3a. Se trabajó en el worktree hermano `C:\Proyectos\fluyo-new\fluyo-s3a`
(rama `i18n-002-s3a`) desde `7305355`. No se tocó `main`. Sin commit, push ni deploy.

### Comprobaciones previas (§22.1, contra el estado real)

1. HEAD de partida: `7305355`, el cierre documental de S2b sobre `be050f8`. `main` = `origin/main`.
2. `CACHE`: producción sirve `fluyo-static-v113` (comprobado en `https://fluyo.space/sw.js`). S3a usa **v114**.
3. S2b, CLOSED / VERIFIED / IN PRODUCTION: `be050f8` y fluyo-mcp `464f4e0`, con su documento de cierre en `7305355`.
4. El alcance se recalculó sobre `7305355`; las líneas son las de §23.2.
5. Kernel y MCP: los 8 archivos de `KERNEL_SCRIPTS` en `7305355` tienen el mismo sha256 que `fluyo-mcp/src/generated/kernel-sources.ts`.
   S3a no cambia ninguno (`model.js`, `config.js`, `story-playback.js` y `safe-svg.js` incluidos), y tampoco `fluyo-mcp`.
6. D-S3-12 = (a): solo se preparan `drawer.groupSecurity` y `drawer.groupDevOps`. La lista de grupos del cajón (`ui.js`) queda
   igual que en la base.

### 23.1 Qué se hizo

- **Página nueva y primera página** (`state.js`):
  - `addPage` pasa `page.untitled` («Página {n}», la clave común que ya existía) a `createPageIn`.
  - Al cargar `state.js`, el documento en blanco del arranque se nombra en el idioma de la interfaz. Restaurar la sesión, abrir un
    archivo, `#d=` o `?ejemplo=` sustituyen después el documento entero, y lo que traen no se toca.
  - Un documento con contenido o con más de una página no se renombra.
- **«Nodo» y «Texto»** (`state.js`): `newNode` siembra la misma regla que `createNodeIn` (`seed.node`, `seed.text`), salvo para código,
  icono, imagen y GIF. Así lo cubren todas las creaciones del editor.
- **Nombres de `config.js`** (`state.js`):
  - Tablas `ICON_NAME_KEYS` (42 iconos), `ANIM_NAME_KEYS` (8 GIFs) y `PALETTE_NAME_KEYS` (14 colores, por su valor), con
    `iconName`, `animName` y `paletteName`.
  - Las llamadas `FluyoI18n.t` son literales porque el test de catálogo exige que cada clave esté en uso.
  - Las marcas no llevan clave: Kafka, K8s, Web, API, Cron, Webhook, CI / CD, CDN, DNS, Git, Docker y los grupos GCP, AWS y Azure enteros.
  - Sin `FluyoI18n` (arneses), se usa el nombre de `config.js`.
- **Etiqueta al soltar un icono o un GIF** (`interaction.js`): `iconName` / `animName`.
- **Cajones y paleta** (`ui.js`):
  - Los cajones usan `iconName` / `animName` en el texto y en el `title`, con `data-icon` / `data-anim`.
  - Las dos rejillas de la paleta usan `paletteName`, con `data-palette`.
  - `paintChromeText` repinta todo esto al cambiar de idioma en vivo.
  - `drawerGroupName` prepara Seguridad y DevOps sin cambiar la lista de grupos.
- **Ejemplo incorporado** (`export.js`): la página («Example», «Example {n}»; el nombre libre se busca en el idioma de la interfaz),
  más 8 nodos y 6 conexiones (16 claves `example.*`).
- **Reserva «Origen»** (`editor-scenarios.js`): `scSourceFallback()` (`seed.source`) en los cuatro sitios que pasaban `null`: las dos
  filas del paso, la vista previa del modal y `scSentenceAt`.
- **`render.js`**: la reserva de `emptyHint` pasa a ser `""`.
- **`i18n-en-editor.js`**: 85 claves nuevas.
- **`sw.js`**: `CACHE` v114.

### 23.2 Cambios de alcance frente a la auditoría

- **«Nodo»/«Texto»**: se resuelve en `newNode` (`state.js`), no en `interaction.js`. Es el único punto por el que crea el editor.
- **Las tablas de nombres viven en `state.js`**: las necesitan `interaction.js` y `ui.js`, y `state.js` carga antes que los dos.
- **«Destino» no necesita clave**: el editor siempre pasa el destino; solo se usa la reserva de origen (`seed.source`).
- **`render.js` sin reserva traducida**: `render.js` también lo carga el Viewer. Una clave del editor allí rompería la separación
  común/editor que vigila S0. El editor (`editor.emptyCanvas`) y el Viewer (`viewer.emptyPage`) ya pasan su texto, y la exportación
  de una página vacía está bloqueada. Solo cambia un arnés de pruebas sin `FluyoI18n`, que ahora no pinta texto en vez de pintar el
  español.
- **Claves**: 85, frente a las ≈ 88–95 estimadas. «Página {n}» reutiliza `page.untitled` (0 nuevas); `seed.target` no hace falta.
- **ja, fr y zh**: no llevan claves nuevas de S3a, pero `page.untitled` ya existía en sus diccionarios desde S0. Por eso, en ja, una
  página nueva nace «ページ 2» y el resto de valores sembrados cae al inglés. Es coherente con la política de esos diccionarios
  (decisión 275) y no se ha cambiado.
- **Ajustes de tests ajenos** (estrictamente necesarios):
  - 80 fijaciones de `CACHE` v113 → v114.
  - Línea base del trinquete reescrita: `export.js` pasa de 13 a 0 y `render.js` de 2 a 1.
  - El arnés de S2a extrae también `scSourceFallback`.
  - Los filtros de alcance de S0, S1, S2a y SHELL conocen las piezas de S3a.
  - El alcance de S2b deshace S3a antes de comparar.
  - `undoS2b` llama primero a `undoS3a`.

### 23.3 Tests

- `test/fluyo-i18n-002-s3a.test.cjs`: **8/8** (O, E, N, C, D, K, S, A).
  - O: español idéntico a `7305355`, ejecutando el código de la base y el de ahora.
  - E: inglés exacto; fr/ja/zh caen al inglés.
  - N: nunca se retraduce.
  - C: catálogo de `config.js`.
  - D: D-S3-12 = (a).
  - K: kernel y MCP intactos.
  - S: estático.
  - A: alcance.
- `test/fluyo-i18n-002-s3a-mutations.cjs`: **15/15 detectadas** (sin el test A).
- `test/fluyo-i18n-002-s3a-browser.cjs` (Chrome real por CDP): **35 ✔ · 0 ✘**.
  - Español frente a un `git archive` de `7305355`: documento byte a byte, cajones (texto, `title` y píxeles) y paleta idénticos.
  - Inglés: valores sembrados, cajones, marcas tal cual, seis grupos sin Seguridad ni DevOps, `missing()` vacío.
  - Cambio de idioma en vivo: el documento queda intacto y cajones y paleta se repintan.
  - Una sesión guardada en español y restaurada en inglés conserva «Página 1».
  - fr cae al inglés.
  - `qps` a 1440 y 390 px: todo pasa por `FluyoI18n` y el cajón no desborda.
- `test/fluyo-i18n-002-s3a-undo.cjs`: generado del diff `-U2`; reproduce la base exacta.
- Suite, regresiones y SHA: §23.4.

### 23.4 Suite y regresiones

- **Suite de fluyo** (`node --test test/*.test.cjs`): se corrió en dos clones desechables. Uno lleva S3a commiteada sobre `7305355`; el
  otro es la base.
  - S3a: **1 756 tests, 83 fallos**.
  - Base: 1 748 tests, 83 fallos.
  - **0 fallos nuevos y 0 arreglados por nombre**: los 83 son los históricos.
  - La primera pasada encontró 4 fallos nuevos, todos de tests ajenos (§23.2) y ya corregidos:
    - 018-15 leía la etiqueta de la herramienta de GIFs y el orden exacto de la rejilla de color;
    - los arneses de step-message y narration no conocían `scSourceFallback`.
- **Chrome real**:

  | Test | Resultado |
  |---|---|
  | S3a | 35 ✔ · 0 ✘ |
  | S2b | 26 ✔ · 0 ✘ (sin `FLUYO_BASE_ROOT`) |
  | S4 | 102 ✔ · 0 ✘ |
  | S2a | 179 ✔ · 0 ✘ (sin `FLUYO_BASE_ROOT`) |
  | S1 | 181 ✔ · 0 ✘ |
  | S0 | 384 ✔ · 1 ✘ |
  | I18N-001 | 78 ✔ · 0 ✘ |
  | PRODUCT-NARRATION-001 | 100/100 |
  | 018-15 (paleta y herramienta de GIFs) | 576 ✔ · 0 ✘ |
  | SHELL-001 | 139 ✔ · 0 ✘ |

  - El fallo de S0 es la carrera conocida del indicador de zoom (deuda T3), ajena a S3a.
  - S2b y S2a se corrieron sin `FLUYO_BASE_ROOT`: se saltan sus comparaciones con 326872e y a0919e6. El español idéntico de S3a se
    compara con `7305355` en su propio test.
  - Los de Playwright usan `playwright-core` por `NODE_PATH` desde el scratchpad.
- **Español visualmente idéntico** en todo lo que S3a no debe cambiar:
  - el documento creado (`serializeProject`) es igual byte a byte;
  - los cajones de iconos y GIFs son iguales píxel a píxel, en texto y en `title`;
  - la paleta tiene el mismo `title` y `aria-label` en 373 muestras;
  - los nombres sembrados, el ejemplo y la frase con `{source}` son los mismos.

  Todo frente a `7305355`.

### 23.5 Para el commit

- **Base**: `7305355`; rama `i18n-002-s3a` del worktree `fluyo-s3a`.
- **Archivos servidos**:
  - `js/editor-scenarios.js`, `js/export.js`, `js/i18n-en-editor.js`, `js/interaction.js`, `js/render.js`, `js/state.js`, `js/ui.js`;
  - `sw.js` (v114).
- **Tests nuevos**: `test/fluyo-i18n-002-s3a.test.cjs`, `-mutations.cjs`, `-browser.cjs` y `-undo.cjs`.
- **Tests ajustados**: las 80 fijaciones de `CACHE`, `test/fluyo-i18n-001-baseline.json`, `fluyo-i18n-002-s2b-undo.cjs`, los alcances de
  S0, S1, S2a y S2b, `fluyo-shell-001-undo.cjs`, `fluyo-018-15.test.cjs`, `fluyo-step-message-001.test.cjs` y
  `fluyo-product-narration-001.test.cjs`.
- **Documento**: esta tarea, que es nueva en git.
  - La copia sin seguimiento que hay en el checkout de `main` (`C:\Proyectos\fluyo-new\fluyo\.ai\tasks\FLUYO-I18N-002-S3.md`) es la misma
    tarea en su versión anterior. Hay que borrarla antes de integrar la rama, o git se negará a sobrescribirla.
- **Sin cambios**: kernel, MCP, `config.js`, `.ai/DECISIONS.md` (S3a no crea decisiones nuevas: aplica 282, 284, 285, 287 y 288 con
  D-S3-12 = a) y la tarea madre.

## 24. Publicación — S3a CLOSED / VERIFIED / IN PRODUCTION (2026-10-27)

- **Commit**: `e39b7e3200dfcd96898da2751ec29dd987dc25fc` (árbol `920b4634…`), en la rama `i18n-002-s3a`.
  - Entró en `main` con `git merge --ff-only`: sin commit de merge.
  - Antes se borró la copia sin seguimiento de esta tarea que había en el checkout de `main`. Los documentos `.ai` sin commit de otras
    sesiones (14) quedaron intactos: mismo hash antes y después.
  - Push sin force: `7305355..e39b7e3`.
- **Producción**:
  - `https://fluyo.space/sw.js` sirve `fluyo-static-v114`.
  - Los **83 archivos servidos** (JS, CSS, HTML, manifest, assets y páginas) son **idénticos byte a byte** a `e39b7e3`.
- **Kernel y MCP**: `model.js`, `config.js`, `story-playback.js` y `safe-svg.js`, sin cambios frente a `7305355`. `fluyo-mcp` en `464f4e0`, limpio.
- **Smoke de S3a en producción** (Chrome real, telemetría bloqueada):
  - `test/fluyo-i18n-002-s3a-browser.cjs` con «ahora» = https://fluyo.space y base = un árbol local de `7305355`: **35 ✔ · 0 ✘**.
    Cubre:
    - español idéntico a la versión anterior: documento byte a byte, cajones píxel a píxel y paleta;
    - creación de página, nodo, texto, icono y GIF, y el ejemplo «Funnel de ventas»;
    - inglés con `?lang=en`: valores sembrados, cajones y paleta;
    - cambio de idioma en vivo sin retraducir;
    - sesión española restaurada en inglés;
    - fr cae al inglés;
    - `qps` a 1440 y 390 px.
  - Un smoke adicional da **13 ✔ · 0 ✘**:
    - «Origen» en la fila de Historias, y «Source» en inglés;
    - el contenido del autor no se traduce;
    - Share → Viewer en es y en en, con el documento intacto;
    - sin red, con el SW v114: el editor carga de la caché y siembra en inglés;
    - consola sin errores.
- **Regresiones sobre producción**:
  - Con CDP contra https://fluyo.space:

    | Test | Resultado |
    |---|---|
    | S2b | 26 ✔ · 0 ✘ |
    | S4 | 102 ✔ · 0 ✘ |

  - Con Playwright, sirviendo un árbol con los 83 archivos descargados de fluyo.space:

    | Test | Resultado |
    |---|---|
    | S0 | 385 ✔ · 0 ✘ |
    | S1 | 181 ✔ · 0 ✘ |
    | S2a | 179 ✔ · 0 ✘ (incluye la caché v114 sin red) |
    | I18N-001 | 78 ✔ · 0 ✘ |
    | SHELL-001 | 139 ✔ · 0 ✘ |
    | PRODUCT-NARRATION-001 | 100/100 |

## Handoff

- **S3a CLOSED / VERIFIED / IN PRODUCTION (2026-10-27)** (§24): `e39b7e3` en `main` y en fluyo.space, `CACHE` v114.
  - **Siguiente `CACHE` libre: v115.**
  - No hay trabajo de S3 en curso. Lo pendiente (Propiedades, el cajón de Seguridad y DevOps, fr/ja/zh) espera la decisión del PO.
- **S3a implementada (2026-10-27): READY FOR COMMIT** (§23). Worktree `C:\Proyectos\fluyo-new\fluyo-s3a`, rama `i18n-002-s3a`, base
  `7305355`, `CACHE` v114.
  - Tests: propios 8/8, mutaciones 15/15, Chrome 35/0, suite sin fallos nuevos.
  - Kernel y MCP intactos. Sin commit, push ni deploy.
  - **Próximo paso concreto**: OK del PO. Después, commit en la rama, integración en `main` por avance rápido (borrando antes la
    copia sin seguimiento de esta tarea en `main`), push, deploy y smoke en producción.
  - Quedan fuera: Propiedades (decisión 287), el cajón que no pinta Seguridad ni DevOps (bug aparte) y fr/ja/zh (S5).

- **D-S3-12 = (a) y secuencia (2026-10-27)**:
  - Estado: **READY / BLOCKED BY S4 (publicación) + S2b**.
  - D-S3-12 queda registrada como precisión de la 288: solo claves, sin tocar los grupos visibles; el cajón queda como bug aparte.
  - La secuencia es S4 → publicación → S2b → S3a (§22.1).
  - Sin código, tests, `CACHE`, MCP, commit, push ni deploy.

- **Recomprobación tras S4 (2026-10-27)**: §22. El alcance de S3a no cambia salvo D-S3-12 (grupos del cajón que no se pintan).
  Base `86d910a`, `CACHE` v113, kernel y MCP intactos, worktree hermano recomendado. S3 sigue **READY / BLOCKED** hasta el OK
  del PO.

- **Decisiones S3 (2026-10-27)**: el PO aprobó D-S3-1…11 (§21; decisiones 281–288). S3 = **READY / BLOCKED BY S2a**. Solo cambian
  documentos (`.ai/DECISIONS.md`, esta tarea y la tarea madre); sin código, tests, `CACHE`, MCP, commit, push ni deploy.
- **Próximo paso concreto (revisado)**: cuando S2a esté commiteada, implementar **S3a** (§21) desde ese `main`, con la siguiente
  `CACHE` libre, y parar antes del commit. **No** implementar K1: va con S2b.
- **Sesión de auditoría S3 (2026-10-27)**: inventario de narrativa, valores sembrados, nombres de `config.js`, integridad y
  autoría; consumidores en el producto y en el MCP; estado de sincronía del kernel (al día, `db380d3`); guardas C3/018-27;
  decisiones D-S3-1…11. **S3 READY FOR REVIEW.** Sin código, tests, `CACHE`, MCP, commit, push ni deploy.
- Archivos tocados: solo este documento (nuevo, sin commitear). La tarea madre no se ha modificado (la está escribiendo la sesión
  de S2).
- **Próximo paso concreto**: el PO responde D-S3-1…11 (sobre todo D-S3-3 junto con D-S2-1/2). Después, al cerrar S2a (y S2b, si
  va), implementar S3a desde el `main` real con la siguiente `CACHE` libre y parar antes del commit.
