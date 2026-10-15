# FLUYO-019.3 — MCP: la piel «construido» (settings.skin) en `export_diagram`

Estado: **PENDIENTE** (contrato redactado en FLUYO-019.2; nada implementado). Código y tests en `fluyo-mcp`; en `fluyo`, solo este documento.
Base: fluyo con FLUYO-019.2 (`settings.skin`, golden compartido); fluyo-mcp `b4323e6` (018.28).
Owner/agente actual: libre.

> Repo público: solo contenido técnico del proyecto open source.
> Leer: `AGENTS.md`, esta tarea, `.ai/tasks/FLUYO-019.2.md` (D1 y D4), `.ai/ARCHITECTURE.md` §«Piel «construido» (2.5D)» y §«Conexiones (FLUYO-018.16)» (cómo se hace la paridad hoy). Código de fluyo: `js/skin.js` entero (160 líneas, puro) y `skinLayersToSVG`/`renderNodeToSVG`/`renderConnectorToSVG`/`buildSVGDocument` en `js/export.js`. Código del MCP: `scripts/sync-kernel.ts`, `src/model.ts` (`FluyoSettingsSchema`), `src/diagram.ts` (`SETTING_KEYS`), `src/svg.ts` (§cilindro, `edgeStroke`, `pageToSVG`), `src/server.ts` (`export_diagram`), `test/visual-regression.test.ts` y `test/fluyo-018-16.test.ts` (patrón del golden compartido).

## Objetivo

Que `export_diagram` produzca, para un documento con `settings.skin:"built"`, **el mismo SVG de la piel** que «Exportar → SVG» de la app (decisión 170: paridad editor = SVG = MCP), y que el kernel del MCP conozca la clave (normalización de lista cerrada de 019.2). Decidido en 019.2 (D4): **port a TypeScript en `svg.ts`**, no ejecución de `skin.js` desde el `vm`; el golden de fluyo es el contrato.

## Por qué

Desde 019.2 un documento puede llevar `settings.skin:"built"`: el editor lo exporta construido, el Viewer lo pinta construido y el share lo transporta. El MCP, hasta esta tarea, acepta la clave (`FluyoSettingsSchema` es `passthrough`) pero la ignora y exporta plano: es la brecha temporal aceptada en 019.2. Esta tarea la cierra con el mismo mecanismo que `cylinderSegments` (018.14a) y `edgeStroke` (018.16/018.27): port manual + test de paridad que ejecuta el JS real de fluyo en `vm`.

## Contrato (lo que fluyo ya entrega y el MCP debe cumplir)

1. **Kernel.** `npm run sync:kernel` → `KERNEL_ID` nuevo (`model.js` con `SKIN_VALUES`, `projectSkin` y la normalización en `settingsFromProjectData`). `check:kernel` en verde. Comportamiento resultante del kernel (ya definido en fluyo, nada que decidir): `skin:"built"` se conserva; ausente, `"flat"`, otro string u otro tipo → **sin clave**. `create_diagram` y `author_document` heredan esto por construcción (normalizan con el kernel).
2. **Schema.** `FluyoSettingsSchema` (`src/model.ts`): `skin: z.enum(["flat","built"]).optional()` con descripción («aspecto en Present, exportación y Viewer; ausente = plano; el editor pinta plano»). Sigue `passthrough`, así que no cambia lo que se acepta, solo lo que se documenta. `create_diagram` (`src/diagram.ts`): `skin` entra en `SETTING_KEYS` y en `CreateDiagramInput`; sin operación nueva en `author_document` (los ajustes no tienen operación, como hasta ahora). `describe_document` no lista propiedades visuales: sin cambios.
3. **Port.** `src/skin.ts` (o una sección de `svg.ts`, como el cilindro) con las mismas funciones y nombres que `js/skin.js`: `skinActive(skin, zoom)`, `skinTones(color, theme, bg)`, `skinNode(n, theme, bg)`, `skinExtent(n)`, `skinPaintOrder(nodes)`, `skinEdgeLanding(pts, toSide)`, `skinEdgePort(p, lineColor, bg)`, `skinLabelFont(n, globalFont)`; constantes `SKIN_DEPTH=8`, `SKIN_MIN_PX=3`, `SKIN_FRONT_R=2`, `SKIN_LED_R=2.4`, `SKIN_LED_IN=10`, `SKIN_PORT_R=3`, `SKIN_PLINTH_H=7`, `SKIN_PLINTH_PAD=8`, `SKIN_TONES`, `SKIN_FLAT_SHAPES`. Un color no hex usa el mismo respaldo que `colHex` (fluyo `render.js`) → `DEFAULT_NODE_COLOR`.
4. **`pageToSVG(page, theme, {skin})`** (`svg.ts`) y `export_diagram` (`server.ts`) leen `project.settings.skin` y pasan `skin: projectSkin(settings)`; con `"built"`: (a) nodos en el orden de `skinPaintOrder`; (b) por nodo con piel, las capas como `<path d=… fill=… [stroke=… stroke-width=…] [stroke-dasharray=…] stroke-linejoin="round" [clip-path="url(#skin-clip-{id}-{k})"]/>` precedidas, cuando la capa lo pide, de `<clipPath id="skin-clip-{id}-{k}"><path d=…/></clipPath>` (exactamente `skinLayersToSVG` de `export.js`, mismo orden de atributos); el glifo del icono y el rótulo como siempre, con la voz de `skinLabelFont` cuando aplica; (c) por conexión, `pts = skinEdgeLanding(edgePoints(e), inferSide(B, último))` antes de `edgeStroke`, y el anillo de salida `<path d=… fill="{bg}" stroke="{lineColor}" stroke-width="1.5"/>` cuando no hay `startArrow`; (d) `skinActive(skin, 1)` decide (en SVG la escala es 1: la piel siempre se pinta si es `"built"`). Sin la clave, el SVG de hoy byte a byte.
5. **Tests.**
   - Copiar a `fluyo-mcp/test/fixtures`: `fluyo-019-1-skin.json` (golden de capas por pieza y tema), `fluyo-019-2-skin.fluyo.json` (documento con `skin:"built"`, crema: rect, rect dashed, cylinder, icon, hex, text; conexiones n/e/s/w, par y hermanas) y `fluyo-019-2-skin-svg.json` (las líneas de la piel del SVG del editor real, extraídas con `skinSvgLines`, cuya definición está en `fluyo/test/fluyo-019-2.test.cjs`). Añadirlos a `scripts/sync-fixtures.ts` si procede. `fluyo/test/fluyo-019-2.test.cjs` ya compara los tres archivos con los del MCP cuando los repos están al lado: deben ser byte a byte iguales.
   - `test/fluyo-019-3.test.ts`: el port, **capa a capa**, igual al golden 019.1 (`skinNode`/`skinExtent`/`skinEdgeLanding` por pieza y tema, con `THEMES[t].bg` y con `customBg`); `export_diagram` sobre el fixture 019.2 → `skinSvgLines(svg)` deepEqual al golden 019.2 (igual que `fluyo-018-16.test.ts` con las conexiones); el mismo fixture sin la clave → sin `skin-clip-` y sin cambios respecto a hoy; `create_diagram` con `skin:"built"` → el proyecto lleva la clave; con `skin:"flat"` → sin clave; `describe_document` sin cambios.
   - `test/visual-regression.test.ts`: paridad **ejecutando el `js/skin.js` real** en `vm` (como se hace con `geometry.js`) sobre los 8 ejemplos + las 3 fixtures de regresión, con `settings.skin:"built"` forzado: `skinNode` por nodo y tema, `skinEdgeLanding` por conexión, `skinPaintOrder` por página, vértice a vértice.
   - Mutaciones: `scripts/mutate-019-3.ts` (profundidad distinta, tonos invertidos, orden de capas, clip ausente, aterrizaje en s/w, port sin `skipWaiting`… las que hagan fallar la paridad).
6. **Compatibilidad.** Un documento sin la clave exporta igual que hoy (byte a byte). Un documento con `skin:"flat"` entra sin clave tras el kernel. Ningún campo nuevo fuera de `settings.skin`. `describe_document`, `propose_layout`, `run_story` y el resto de tools no cambian.

## Fuera

Bus, contenedor, exploded, isométrica, LED ligado al estado; PNG/GIF; cambios en `skin.js` de fluyo (si el port descubre una ambigüedad, se corrige el golden en fluyo en una tarea aparte, nunca se «adapta» el port).

## Handoff

### Estado actual
Contrato escrito (15-10-2026). Nada implementado en `fluyo-mcp`.

### Próximo paso concreto
En `fluyo-mcp`: `npm run sync:kernel` y `npm run check:kernel`; copiar los tres fixtures; escribir primero `test/fluyo-019-3.test.ts` contra el golden 019.1 y después el port, función a función, en el orden de `js/skin.js`.
