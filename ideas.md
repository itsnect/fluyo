# Ideas

Aparcadero de ideas que **no** están implementadas y que no desvían el foco.
Apuntarla aquí es gratis; implementarla es una decisión aparte.

Si vas a coger algo de esta lista, abre un issue primero para acordar el
enfoque — algunas de estas ideas chocan con las restricciones del proyecto
(cero dependencias, cero build) y conviene hablarlo antes de escribir código.

---

## Evaluado y aparcado a propósito

Cosas que se estudiaron, tienen sentido, y se decidió no hacerlas ahora.

- **Workflow de CI mínimo** (`.github/workflows/`). `node --check` sobre `js/*.js`
  valida sintaxis con Node puro y cero instalaciones. Se le pueden sumar dos
  comprobaciones baratas: parsear los JSON (`manifest.webmanifest` y los
  ejemplos de `ejemplos/data/`), y **avisar si un PR toca archivos servidos sin
  subir la constante `CACHE` de `sw.js`** — ese despiste hace que los cambios no
  lleguen a quien ya tiene el service worker instalado, y muerde a cualquiera
  que trabaje en local. Si se añade validación de HTML, hace falta un `npx` en el
  runner: descarga solo en CI, nada comiteado.

- **Extremos de arista posicionales** (la «variante B»: fijar el extremo a un
  punto cualquiera del perímetro, tipo `exitX`/`exitY` de draw.io). Hoy un extremo
  se fija a un LADO —`fromSide`/`toSide`, cuatro valores más flotante— y eso ya se
  arrastra y se reengancha. Lo posicional es una tanda aparte, y estas cuatro
  cosas están medidas y conviene no volver a medirlas:

  - **Cruza al MCP.** `fromSide`/`toSide` ya son `SideSchema.nullable()` en
    `model.ts`, así que el anclaje por lado no tocó el servidor. Una fracción de
    perímetro es un campo nuevo: schema, los tres renderers y la migración de los
    documentos ya guardados.
  - **La fracción hay que expresarla contra `anchorBox(n)`, no contra `n`.** En un
    nodo `icon` la caja de anclaje es más estrecha que el nodo: medido, hasta
    **34 px** de desfase por lado. Con la caja lógica, «el 50 % del lado oeste»
    cae en el aire, que es exactamente el defecto que `anchorBox` arregló.
  - **Obliga a una exención de carril explícita.** `parallelLane` aplica el mismo
    `off` a los dos extremos **y al canal central**: fijar un extremo y dejar el
    otro en su carril descuadra el canal. Con el anclaje por lado no hace falta
    exención ninguna —no genera waypoints—, y por eso se eligió primero.
  - **Y hereda el hueco de los carriles paralelos** documentado en la nota (4) de
    `fluyo-mcp/test/visual-regression.test.ts`: el reparto separa las hermanas a
    lo largo del lado, así que la coordenada perpendicular es común a las dos.

- **Modal de atajos de teclado con `?`.** Los atajos ya están en el panel `#noSel`
  del `aside`, pero ese panel es `display:none` por debajo de 700 px, así que en
  móvil no hay forma de verlos. Si se añade el modal, **debe ser la única fuente
  de verdad** y el hint del panel reducirse a lo básico más un enlace; con dos
  listas se desincronizan en el primer PR que añada un atajo. El `.overlay`/`.card`
  ya existe, así que no hace falta CSS nuevo, y el handler global usa `ev.key`,
  así que `?` funciona en teclado español sin tocar nada.

---

## Bugs conocidos, sin arreglar

- **Handlers duplicados en `js/ui.js` (líneas ~215-228).** Un merge dejó
  `themeSel`, `speedIn`, `dotsIn`, `buildChk` y `staggerIn` asignados dos veces:
  primero **con** `scheduleAutosave()` y después **sin** él. Gana la segunda
  asignación, así que cambiar el tema, la velocidad de flujo, los puntos por
  flecha o la aparición **ya no dispara autoguardado**. Son cinco líneas
  duplicadas de más; borrar el segundo bloque debería bastar, pero conviene
  comprobar que el orden de asignación no oculta otra intención.

---

## Producto

- **Previews animados en `/ejemplos`.** Ahora son SVG estáticos generados con el
  propio exportador. Un GIF real mostraría el diferenciador del producto — el
  flujo en movimiento — justo en la página que más tráfico de búsqueda debería
  captar. Coste: peso de página y regenerarlos a mano al cambiar un ejemplo.

- **Más ejemplos.** Los cinco actuales cubren eventos, microservicios, auth, ETL
  y serverless. Faltan candidatos con búsqueda propia: CQRS y event sourcing,
  arquitectura hexagonal, replicación de base de datos, service mesh, CI/CD,
  RAG con base de datos vectorial, WebSockets en tiempo real.

- **Enlaces profundos que funcionen sin servidor.** `?ejemplo=<slug>` usa `fetch`,
  que el navegador bloquea en `file://`. Si los ejemplos se sirvieran como `.js`
  que llaman a una función de registro en lugar de como `.json`, cargarían
  también con doble clic, porque los scripts clásicos sí se permiten. A cambio
  se pierde que los archivos sean `.fluyo.json` descargables y reutilizables,
  que es una ventaja real. No está claro que el cambio valga la pena.

- **Plantillas dentro del editor.** El servidor MCP ya tiene `list_templates` y
  `create_from_template`. Exponer lo mismo en la UI evitaría que empezar con el
  lienzo vacío sea la única opción.

- **Exportar todas las páginas de una vez.** Hoy el export es por página. Un
  documento de seis páginas obliga a seis vueltas por el diálogo.

---

## Accesibilidad

Pendientes del repaso hecho al escribir la documentación. Lo que estaba bien:
el contraste (`--muted` sobre `--panel` da ≈9:1, por encima de AA) y que ya
existe `:focus-visible` con `outline` en botones, selects e inputs.

- **Fuentes de 8,5-9 px** en el rail de herramientas y en el cajón de iconos
  (`css/styles.css`, `.rail button` y `.iconGrid button`). Están por debajo de
  cualquier mínimo cómodo. Subirlas obliga a repensar el ancho de 64 px del
  rail, así que no es un cambio de una línea.

- **Editar texto exige doble clic.** No hay equivalente de teclado. Con un nodo
  seleccionado, `F2` o `Enter` debería abrir el `#editBox`. El handler ya existe
  en `js/interaction.js`; falta la vía de entrada.

- **El canvas no tiene alternativa accesible.** Un lector de pantalla no percibe
  nada del diagrama. Es inherente a un editor gráfico y no se resuelve barato;
  lo más realista sería generar un resumen textual de nodos y conexiones
  («API Gateway conecta con Kafka»), que además sería útil como export.

- **Cajones sin gestión de foco.** `#iconDrawer` y `#animDrawer` tienen
  `role="dialog"` y `Esc` los cierra, pero el foco no entra al abrirlos ni
  vuelve al botón al cerrarlos.

---

## Infraestructura

- **Fijar `gif.js` en local en vez de por CDN.** Es la única petición externa que
  queda. Servirlo desde `assets/` eliminaría la dependencia de red y el fallo
  por bloqueadores, a cambio de comitear código de terceros al repo — que roza
  la restricción de cero dependencias, aunque no añada build.

- **Ventana de reporte de la telemetría.** El plan Hobby de Umami puede quedarse
  corto si el tráfico crece. Conviene decidir de antemano qué pasa entonces, en
  vez de descubrirlo con los datos ya perdidos.
