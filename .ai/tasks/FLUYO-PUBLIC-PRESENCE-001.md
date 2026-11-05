# FLUYO-PUBLIC-PRESENCE-001 — Correo de marca y redes oficiales en las superficies públicas

Estado: **Aprobada por el PO el 2026-11-05.** El push a `main` despliega producción en Vercel.
Owner/agente actual: libre

> Repo público: este documento no contiene métricas ni datos privados.

## Problema

Las páginas públicas daban un correo personal como contacto y no enlazaban los perfiles oficiales de Fluyo.

## Alcance

**Incluye:** `hello@fluyo.space` como contacto en Soporte, Privacidad y Términos, ES y EN; enlaces a Instagram, TikTok y YouTube en el menú «Más» del editor, en el pie de las páginas informativas y en una sección breve de Soporte; `README.md` y `SECURITY.md`; las fechas de Privacidad y Términos; CACHE v125.

**No incluye:** comportamiento del editor, Stories, MCP, analítica, onboarding, modelo de datos ni el Viewer. Sin embeds, feeds ni scripts de las plataformas.

## Decisiones

Ver decisiones 335 y 336 en `.ai/DECISIONS.md`.

## Lo que se mantiene

La identificación del responsable sigue igual en Privacidad y Términos, y el aviso de licencia en `README.md`. Cambia el canal de contacto, no la autoría.

## Cómo se comprueba

- `test/fluyo-public-presence-001.test.cjs`: alcance frente a `5d10065`, correo, redes, fechas y ausencia de embeds.
- `test/fluyo-public-presence-001-undo.cjs`: último eslabón de la cadena de alcances; `undoGeo` lo llama primero.
- La suite completa se compara por nombre, tipo y firma con la línea base de los 84 fallos históricos.

## Antes de publicar

Las fechas de Privacidad y Términos dicen 5 de noviembre de 2026. Si se publica otro día, hay que cambiarlas en los dos idiomas y en el test de esta tarea.
