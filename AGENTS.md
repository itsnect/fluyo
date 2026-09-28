# AGENTS.md — Fluyo

Documento de arranque obligatorio para cualquier sesión de agente (Codex, Claude Code, OpenCode/Kimi).
Léete primero, luego la tarea. Nada más.

---

## 1. Qué es Fluyo

Fluyo (fluyo.space) es un producto que ayuda a equipos técnicos a **crear → explicar → presentar → compartir** cómo funciona su software y sus sistemas técnicos. Hoy es un editor de diagramas de arquitectura en el navegador donde las conexiones se mueven: puntos que recorren las flechas, nodos que laten y elementos que aparecen en secuencia. Todo ocurre en el cliente: sin backend, sin cuentas, sin build. La visión pública y estable está en `.ai/PRODUCT.md`.

## 2. Protocolo de bootstrap

Toda sesión debe seguir, en este orden:

1. Leer este `AGENTS.md`.
2. Leer la tarea especificada en `.ai/tasks/` (p. ej. `.ai/tasks/FLUYO-001.md`).
3. Leer **sólo** el contexto adicional que esa tarea liste explícitamente.
4. Hacer búsquedas dirigidas (grep/glob por símbolo, feature o ruta) cuando sea necesario.
5. Implementar.
6. Ejecutar las pruebas relevantes (ver `.ai/ARCHITECTURE.md` § Testing).
7. Actualizar la tarea con el handoff (sección 5).

## 3. Política de contexto

- **No** leas todo el repositorio para "entender el proyecto". El mapa ya existe en `.ai/ARCHITECTURE.md`.
- **No** leas todos los documentos `.ai`. Cada tarea indica qué necesita.
- **No** cargues contexto que la tarea no necesita.
- Preferir búsquedas concretas por símbolo, feature o ruta sobre lectura de directorios completos.
- Expandir contexto **sólo** cuando aparezca una dependencia real.
- No explorar repositorios hermanos (p. ej. `fluyo-mcp` es un repo aparte; el editor no depende de él).
- Evitar volver a investigar decisiones ya registradas en `.ai/DECISIONS.md`.

## 4. Fuente de verdad

| Tema | Fuente |
|---|---|
| Producto y visión | `.ai/PRODUCT.md` |
| Arquitectura técnica | `.ai/ARCHITECTURE.md` |
| Decisiones vigentes | `.ai/DECISIONS.md` |
| Ejecución y estado | `.ai/tasks/<TASK>.md` |
| Comportamiento real | El código del repositorio |

Si documentación y código discrepan en detalles técnicos, **el código manda** y debe corregirse la documentación relevante (otra tarea, o la misma si es menor).

## 5. Protocolo de handoff

Antes de finalizar una sesión, actualizar `.ai/tasks/<TASK>.md` con:

- qué se hizo (resumen breve);
- archivos modificados;
- decisiones tomadas (y, si son duraderas, añadirlas a `.ai/DECISIONS.md`);
- pruebas ejecutadas y su resultado;
- problemas pendientes / riesgos;
- **próximo paso concreto** para quien continúe.

Otro agente debe poder continuar el trabajo leyendo únicamente este `AGENTS.md` + la tarea.

## 6. Restricciones duras del proyecto

Estas restricciones describen el **estado técnico actual**, verificado contra el código y el historial. No son permanentes: complejidad futura (módulos ES, build, dependencias, backend, otra caché) se adopta sólo si una necesidad concreta la justifica, con decisión registrada en `.ai/DECISIONS.md` (ver principio rector allí). Mientras tanto, al tocar estos puntos respeta lo que hoy existe:

- **Hoy: sin build ni dependencias**: HTML + CSS + JS vanilla. Cambiarlo requiere decisión previa en `.ai/DECISIONS.md`.
- **Hoy: scripts clásicos** (no módulos ES): `js/*.js` se cargan como `<script src>` clásicos y comparten ámbito global. Un solo `import` de nivel superior rompería hoy la apertura desde `file://`. Un test en CI (vive en el repo del MCP) vigila la configuración actual.
- **Formato `.fluyo.json`**: versionado y retrocompatible. Los `id` son únicos por página y comparten `nextId` entre nodos y flechas; `x`,`y` son el centro del nodo. Nunca renombrar claves ya guardadas (`shape`, `anim`, claves de `ICONS`/`ANIMS`…).
- **Privacidad**: el contenido de los diagramas nunca sale del navegador. La telemetría (`js/analytics.js`) solo carga en el dominio oficial y solo envía valores de listas cerradas.
- **Service worker**: cualquier PR que toque un archivo servido debe subir la constante `CACHE` en `sw.js` (cache-first, sin revalidación).
- **Commits**: no crear commits ni pushes salvo petición explícita del usuario.

## 7. Cómo orientarse rápido

Mapa de una línea (detalle en `.ai/ARCHITECTURE.md`):

- `index.html` — interfaz completa (solo HTML).
- `js/config.js` — constantes: paleta, temas, tipografías, `ICONS`, `ANIMS`.
- `js/state.js` — documento, páginas, fábricas, autoguardado (`localStorage`).
- `js/selection.js` — selección, portapapeles, deshacer/rehacer.
- `js/geometry.js` — anclajes, rutas ortogonales, cálculo de flechas.
- `js/render.js` — dibujado del lienzo (canvas 2D) y bucle de animación.
- `js/interaction.js` — ratón, teclado, zoom/pan, pegar/soltar imágenes.
- `js/ui.js` — panel lateral, herramientas, cajones, pestañas de página.
- `js/export.js` — guardar/abrir `.fluyo.json`, exportar GIF/PNG/JPG/SVG.
- `js/deeplink.js` — documento embebido en la URL (`#d=`) sin pisar la sesión.
- `js/examples.js` — carga de ejemplos (`?ejemplo=`) con lista blanca.
- `js/analytics.js` — telemetría Umami, condicionada por hostname.
- `sw.js` / `manifest.webmanifest` — PWA y offline.
- `docs/`, `ejemplos/`, `privacidad/`, `soporte/` (+ variantes en inglés) — páginas estáticas.

Regla práctica: **¿dónde edito X?** → tabla en `CONTRIBUTING.md` § "¿Dónde edito cada cosa?".

## 8. Idioma

Todo el contenido que se genere para este repositorio (documentación, tareas, decisiones, mensajes de commit si se piden) se escribe en **español**.

## 9. Regla de confidencialidad (repo público)

**Este repositorio es público: cualquier archivo creado aquí es potencialmente visible por cualquiera.** Por tanto:

- Nunca registrar información confidencial, métricas privadas, credenciales, estrategia comercial ni roadmap privado en este repositorio.
- `.ai/PRODUCT.md` solo recoge la visión pública y estable (crear, explicar, presentar, compartir sistemas técnicos): nada de estrategia, monetización, pricing, métricas internas, hipótesis competitivas ni features no anunciadas.
- `.ai/DECISIONS.md` solo recoge decisiones técnicas del proyecto open source.
- `.ai/tasks/` solo contiene tareas que puedan ser públicas; escribe cada tarea asumiendo que puede terminar publicada en GitHub.
- Si algo no puede ser público, no se guarda en este repo: se queda fuera, en el chat o en sistemas privados.
- Si se encuentra documentación existente que parezca confidencial o estratégica, **no modificarla**: reportarla en el handoff de la tarea.
