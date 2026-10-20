# FLUYO-019-MCP-PARITY — Paridad de la piel «construido» entre fluyo y fluyo-mcp (D6 + 019.4a)

**Estado: READY FOR COMMIT** (20-10-2026). Sin commit, sin push y sin deploy.

- Base: fluyo `ca47596` (019.4b, CACHE v95); fluyo-mcp `efb316f`.
- Sin decisión nueva: el comportamiento lo fijan las decisiones 212 (D6) y 213 (019.4a). Las dos quedan anotadas como portadas.
- Sin CACHE: en fluyo solo cambian tests y documentación; ningún archivo servido.

## Objetivo

Cerrar la brecha declarada en 019.4a y D6. `export_diagram` del MCP pinta, con `settings.skin:"built"`, la misma geometría que «Exportar → SVG» de fluyo:
- las capas contenedores → conexiones → hojas de D6;
- el aterrizaje por silueta de 019.4a.

## Qué se portó (fluyo-mcp)

| | Fuente (fluyo) | MCP |
|---|---|---|
| **019.4a** (decisión 213) | `js/skin.js`: `skinSilhouette`, `skinLineCuts`, `skinLayerSpan`, `skinEdgeLanding(pts, B)` y su memo `SKIN_LANDING_T` | `src/skin.ts`: port literal, misma matemática, mismas guardas y épsilon, misma clave de memo. Sustituye a la regla de 019.1 (`skinEdgeLanding(pts, toSide)`, n/e, d/2) |
| | `js/export.js` `renderConnectorToSVG`: `skinEdgeLanding(pts, B)` | `src/svg.ts` `renderConnectorToSVG`: con el destino (antes, `inferSide`) |
| **D6** (decisión 212) | `js/geometry.js`: `isContainerNode`, `containmentPaintOrder(nodes, order)` | `src/svg.ts`: port literal, genérico en el tipo del nodo |
| | `buildSVGDocument`: capas y sitio del `<defs>` | `pageToSVG`: contenedores → conexiones → hojas. El `<defs>` va antes de los contenedores si los hay, y si no, después de las conexiones |
| **F13** | `drawFlowBalls` en la línea pintada | **No aplica**: el SVG del MCP es estático y no tiene pelota ni puntos. No se inventa nada |

En plano, nada cambia (el SVG de siempre, byte a byte). Con la piel y sin contenedores, el orden de pintor de antes.

## Fixtures compartidos

Copiados byte a byte de `fluyo/test/fixtures` a `fluyo-mcp/test/fixtures`:
- `fluyo-019-1-skin.json`: sección `landing` con destino, `{in, out}` × 48;
- `fluyo-019-2-skin-svg.json`: conexiones aterrizadas;
- nuevos en el MCP: `fluyo-019-d6-capas.json` (13 casos con el orden calculado a mano) y `fluyo-019-d6-capas-svg.json` (SVG del editor, caso D).

Workarounds retirados:
- `fluyo/test/fluyo-019-2.test.cjs`: ya no hay `MCP_PENDING_4A` ni comparación con `22f82eb`. Con el MCP al lado, exige la igualdad de los tres archivos.
- `fluyo/test/fluyo-019-d6.test.cjs`: el «aún no está en fluyo-mcp» pasa a exigir que esté y sea idéntico.
- MCP, `fluyo-019-3.test.ts`: el test «byte a byte los de fluyo» cubre ahora los 6 fixtures.

## Tests

### Nuevos en el MCP

- **`test/fluyo-019-mcp-parity.test.ts`** (5):
  - los 13 casos del contrato D6 (contenedores, hojas e `isContainerNode`);
  - `pageToSVG` pinta ese orden, con las conexiones entre contenedores y hojas;
  - el sitio del `<defs>` con un icono, con contenedores y sin ellos;
  - el golden del caso D línea a línea: capas, trazos aterrizados, puntas, anillos y orden de los grupos. Solo se excluyen la cabecera `<svg>` (el MCP escribe el viewBox con dos decimales) y los `<text>`, por la medida de texto, que es la divergencia conocida;
  - plano y «sin contenedores» como antes.
- **`scripts/mutate-019-parity.ts`**: 17 mutaciones.
  - 15 del MCP: aterrizaje (sin llamada, media silueta, penúltimo inclinado, sin guardas, desplazamiento fijo, sin `clip`, arco por la mitad opuesta, silueta con capas abiertas) y D6 (sin capas, capas en plano, padre mayor, hojas en orden de documento, empate de área, sitio del `<defs>`).
  - 2 de divergencia en la app.

### Adaptados en el MCP

- **`fluyo-019-3.test.ts`**:
  - el golden de `landing` con destino (48 casos; unos retroceden y otros no);
  - los invariantes de 019.4a sobre el documento de 019.2, con cada nodo como destino: mismo número de puntos, origen e intermedios intactos, la punta sobre su tramo y solo hacia atrás, el retroceso dentro de la silueta;
  - el orden de los grupos por capas;
  - 6 fixtures byte a byte.
- **`visual-regression.test.ts`**, paridad con el `skin.js` y el `geometry.js` reales en vm:
  - `skinSilhouette` por nodo y `skinEdgeLanding(pts, destino)` en el corpus, con cada nodo de la página como destino;
  - `isContainerNode`/`containmentPaintOrder` en el corpus y en los 13 casos;
  - 4 000 rutas aleatorias a las 11 formas: recta, codo, diagonal y cualquier ángulo, saliendo desde dentro y con tramos cortos;
  - 400 páginas aleatorias con áreas repetidas.
- **`scripts/mutate-019-3.ts`**: tres mutaciones obsoletas apuntaban a la regla de 019.1 y al orden sin capas. Una ya lo estaba desde 019.4a en el lado app. Se reescribieron sobre el código nuevo con la misma intención.

### Adaptados en fluyo

`fluyo-019-2.test.cjs` y `fluyo-019-d6.test.cjs`: igualdad estricta con el MCP.

## Resultados

- **MCP**:
  - `npm test`: **757/757** (base `efb316f`: 747/749; los 2 fallos eran la brecha);
  - `tsc` OK;
  - `check:kernel` OK;
  - `mutate-019-parity.ts`: 17/17;
  - `mutate-019-3.ts`: 24/24, con las tres reescritas.
- **fluyo vm**: 1412 tests, 82 fallos. Son los 81 de después de 019.4b más el alcance de 018-25, que mira `git status` y falla mientras haya cambios sin commit. Con un commit desechable en un clon pasa, y el resto de 018-25 es el mismo conjunto previo. **0 regresiones.**
- **fluyo navegador**: no se ejecuta, porque ningún archivo servido cambia.

## Divergencias restantes

- **Medida de texto** (previa, documentada en `svg.ts`): en los `<text>` y las cajas de etiqueta, la heurística del MCP frente a `getBBox`. No es piel.
- **Cabecera `<svg>`**: el MCP escribe el viewBox con dos decimales. Es previo y fuera de alcance.
- **Marcas de semántica** (Flujo/Requisito): fuera de la exportación en los dos repos hasta FASE 5 de Semantic Scenarios.

## Handoff

### Archivos modificados

- **fluyo-mcp**:
  - `src/skin.ts`, `src/svg.ts`;
  - `test/fluyo-019-3.test.ts`, `test/visual-regression.test.ts`, `test/fluyo-019-mcp-parity.test.ts` (nuevo);
  - `scripts/mutate-019-3.ts`, `scripts/mutate-019-parity.ts` (nuevo);
  - `test/fixtures/fluyo-019-1-skin.json`, `fluyo-019-2-skin-svg.json`, `fluyo-019-d6-capas.json` (nuevo), `fluyo-019-d6-capas-svg.json` (nuevo);
  - `test/fixtures/README.md`.
- **fluyo**:
  - `test/fluyo-019-2.test.cjs`, `test/fluyo-019-d6.test.cjs`;
  - `.ai/DECISIONS.md` (notas en 212 y 213), `.ai/ARCHITECTURE.md` (tres menciones de la brecha);
  - esta tarea.

### Próximo paso concreto

Con el OK, dos commits: uno en fluyo-mcp y otro en fluyo, este último sin `FLUYO-019.4.md`.

Después, push de los dos. No hace falta deploy de fluyo, porque no cambia ningún archivo servido.
