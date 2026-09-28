# PRODUCT.md — Visión y principios de Fluyo

Documento corto y estable. No es backlog ni roadmap. Ver `.ai/ARCHITECTURE.md` para lo técnico y `.ai/tasks/` para la ejecución.

---

# Visión

Fluyo busca convertirse en:

> La forma en que equipos técnicos entienden, explican y comunican cómo funciona su software.

## Loop principal actual

`Crear → Explicar → Presentar → Compartir`

- **Crear** — diagramas de arquitectura en el navegador, con animación de flujo.
- **Explicar** — el movimiento muestra el orden de los pasos; nadie tiene que reconstruirlo mentalmente.
- **Presentar** — aparición secuencial de elementos, export a GIF con bucle cíclico.
- **Compartir** — GIF/PNG/JPG/SVG, enlace con el documento en la URL (`#d=`), formato `.fluyo.json` versionable en git.

## Principios

- **Visual-first**: la interfaz es el lienzo; el valor está en lo que se ve.
- Los diagramas representan **conocimiento**, no sólo cajas: las conexiones y su animación significan flujo real.
- **Movimiento y presentación tienen significado**: no son decoración.
- **Compartir debe conservar la experiencia interactiva** tanto como el formato lo permite.
- **La IA trabaja sobre el contexto visual existente** (servidor MCP que produce `.fluyo.json` nativo), no como sustituto del editor.
- Evitar convertirse en un **whiteboard genérico**.
- Evitar convertirse simplemente en **"otro editor con AI"**.
- Priorizar **comportamiento real y retención** sobre cantidad de features.

---

Este documento se limita a la visión pública y estable de Fluyo. No incluye estrategia comercial, monetización, pricing, métricas internas, hipótesis competitivas ni roadmap: por ser un repositorio público, ese tipo de contenido no se registra aquí (ver `AGENTS.md` §9).
