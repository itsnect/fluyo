# FLUYO-019-PRSKIN — «Construido» legible en la barra de Present (interfaz clara)

**Tipo:** micro-slice de polish (auditoría + cambio mínimo).
**Estado:** READY FOR COMMIT (19-10-2026). Sin commit, push ni deploy hasta el OK del owner.
**Base:** `d4fb06d` (HEAD = origin/main; fluyo.space sirve CACHE v91).
**Método:** Chrome real (Playwright `channel:"chrome"`, service worker bloqueado, repo servido en solo lectura). Contraste medido en píxeles y comparado con un clon de la base.

## Objetivo

Que el estado activo de `#prSkin` («Construido») se lea a la primera en la barra de Present, sin rediseñar Present ni la piel y sin tocar nada fuera de ese control.

## Diagnóstico

- El estado pulsado lo pinta la regla global `button[aria-pressed="true"]` (`css/system.css`), con `color:var(--active)` y `border-color:var(--active-rule)`; el anillo de teclado es `outline:var(--focus)`.
- La barra usa el material inverso (`.inverse, #presentBar, #presentStory`, `system.css`). Ese bloque redefine `--active-veil` y `--accent` en oliva pálido, pero **no** `--active`, `--active-rule` ni `--focus`, que se heredan de `:root`.
- Con la **interfaz clara**, `:root` da el oliva hondo (`--c-oliva` #4E5A3F): texto oliva oscuro sobre velo oliva pálido sobre la barra casi negra. **Texto 1,74:1; anillo de foco 2,49:1.**
- Con la **interfaz oscura**, `:root[data-ui-theme="dark"]` ya da oliva pálido y el botón se lee (7,68:1) por herencia. No había fallo.
- `#prSkin` (019.1) es el primer botón con `aria-pressed` dentro de la barra: por eso no había salido antes.
- No es un problema de opacidad (la barra mide `opacity:1` a la vista) ni del tema del lienzo (solo cambia algo el fondo, porque la barra es opaca al 86 %).

## Cambio

Una regla en `css/styles.css`, **solo para `#presentBar #prSkin`**, con los valores exactos de la interfaz oscura:

```css
#presentBar #prSkin{--active:var(--c-oliva-palido); --active-rule:rgba(195,205,164,.42); --focus:2px solid var(--c-oliva-palido);}
```

- No hay color nuevo. La barra clara queda igual que la oscura, que ya estaba aceptada, y el oliva pálido es el mismo `--accent` del material inverso.
- **`--focus` va en `#prSkin`, no en toda la barra.** Probado en Chrome: en `#presentBar` cambiaba también el anillo de «anterior», «siguiente» y «Salir» en la interfaz clara. Por el criterio del owner («si el token heredado modifica otros botones, limita el cambio al foco de `#prSkin`»), queda en el botón.
- **No se tocan:** `system.css` (el Viewer lo carga, y su `#prBar` es `.inverse`), la regla global de `aria-pressed`, `skin.js`, `render.js`, `geometry.js`, `interaction.js`, Viewer, Share, exportación, MCP y `FLUYO-019.4.md`. El Viewer no carga `styles.css`.
- `sw.js`: `CACHE` v91 → **v92**.

## Contraste (píxeles, Chrome real)

| Caso | Antes | Después |
|---|---|---|
| Interfaz clara · lienzo oscuro · Construido (texto) | 1,74:1 | **7,68:1** |
| Interfaz clara · lienzo crema · Construido (texto) | 1,19:1 | **5,22:1** |
| Interfaz clara · lienzo claro · Construido (texto) | 1,15:1 | **5,06:1** |
| Interfaz clara · foco de `#prSkin` (lienzo oscuro / crema / claro) | 2,49 / 1,70 / 1,65:1 | **10,96 / 7,49 / 7,26:1** |
| Interfaz clara · Plano (texto) | 13,65:1 | 13,65:1 (sin cambio) |
| Interfaz oscura · todo | igual | igual (píxel a píxel) |

Hover no cambia el estado pulsado (la regla de `aria-pressed` va después de `button:hover`): las mismas cifras.

## Archivos modificados

- `css/styles.css`: la regla y su comentario (junto a las de `#presentBar`).
- `sw.js`: `CACHE` v92.
- Tests, solo por el cambio de CACHE y de alcance:
  - el literal `fluyo-static-v91` → `v92` en 52 archivos (asserts y orígenes de las mutaciones «CACHE no sube»);
  - `test/fluyo-019-2-browser.cjs`: el smoke del service worker pasa a la base fija `d4fb06d` (v91 → v92);
  - `test/fluyo-019-d6.test.cjs`: su alcance lee la CACHE actual (≥ v91) en vez del literal;
  - `test/fluyo-019-flow-fade.test.cjs`: su alcance contra 266ac09 deshace la regla de PRSKIN en `styles.css`.
- Nuevos:
  - `test/fluyo-019-prskin.test.cjs` (vm): la regla está una vez y solo en `#prSkin`; sus valores son los de la interfaz oscura; contraste calculado desde los tokens con cualquier fondo detrás (la base no llegaba a 3:1); alcance frente a `d4fb06d`.
  - `test/fluyo-019-prskin-browser.cjs` (Chrome real): ver Pruebas.
- Esta tarea.

## Pruebas

- `node --test test/fluyo-019-prskin.test.cjs`: **4/4**.
- `node test/fluyo-019-prskin-browser.cjs` (Chrome real, Playwright vía `NODE_PATH`): **94/94** (unos 65 s). Cubre:
  - la matriz interfaz clara/oscura × lienzo oscuro/crema/claro × Plano/Construido × reposo/hover/foco por teclado, a 1440×900, más 390×844 táctil. Texto ≥ 4,5:1 y foco ≥ 3:1 en todos (peor texto 5,06:1, peor foco 7,26:1). La base falla en los 10 casos de interfaz clara + Construido;
  - Plano e interfaz oscura **idénticos a la base** en la captura del botón;
  - estilos calculados de todos los elementos, en el editor y en Present: solo cambia `#prSkin`, y solo con interfaz clara + Construido;
  - el anillo de foco de `prPrev`, `prNext` y `prExit` es el de la base en los dos temas;
  - 0 errores de página.
- Suites vm (`test/*.test.cjs`, 67 archivos) en el árbol de trabajo, comparadas una a una con un clon de `d4fb06d`:
  - mismos fallos que la base en 011-final-fixes, 012-1-qa, 017-2-qa, 018-17, 018-27, 019-5 y scenario-ui-dom;
  - 018-25: además falla «fixtures del MCP…», que solo corre con `fluyo-mcp` al lado (en el clon se salta). Es geometría pura y no depende de este cambio;
  - 018-24 n.º 9 y 019-2 n.º 13 comparan con `HEAD` y fallan solo mientras el cambio no esté commiteado. Simulado el commit en un clon desechable: 018-24 10/10; 019-2 solo con los preexistentes n.º 14 y 15; 019-prskin, 019-d6, 019-1, 019-hit-test, 019-flow-fade y 018-14b en verde.
- Navegador (regresión de lo que toca Present, tema de interfaz y CACHE), Chrome real, todo en verde:
  - `fluyo-019-2-browser`: 85/85, con el upgrade del service worker v91 (`d4fb06d`) → v92;
  - `fluyo-018-18-browser`: 427/427 (barra de Present);
  - `fluyo-018-14b-browser`: 532/532 (interfaz clara/oscura);
  - `fluyo-019-1-browser`: 59/59;
  - `fluyo-019-d6-browser`: 29/29.

## Pendientes / riesgos

- El anillo de foco de **los demás botones** de la barra (páginas, Salir, transporte de la Historia) sigue a 2,49:1 con la interfaz clara. Es la misma causa: el material inverso no redefine `--focus`. Queda fuera por decisión del owner. Si se quiere, el arreglo es mover `--focus` a `#presentBar` (una línea; ya medido: 10,96:1, sin otros cambios).
- CACHE v92 estaba prevista para 019.4a: pasa a la siguiente libre (v93).
- Sin DECISIONS nuevas. Es un arreglo local que aplica la decisión 185 («activo = oliva», ≥ 3:1) al material inverso.

## Handoff

- Implementado y verificado: la regla en `styles.css`, CACHE v92 y los tests.
- Próximo paso: OK del owner → commit solo en fluyo, excluyendo `.ai/tasks/FLUYO-019.4.md` → push → comprobar que fluyo.space sirve v92 → QA visual en producción (Present, interfaz clara, «Construido»).
