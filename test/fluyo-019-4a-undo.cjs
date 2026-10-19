"use strict";
/* FLUYO-019.4a — Deshace en un texto los cambios de 019.4a en js/skin.js, js/render.js y js/export.js.
   Lo usan los tests de alcance de slices anteriores (019-3, FLOW-FADE, HIT-TEST, D6, PRSKIN) para comparar el resto del
   archivo con su base, como hicieron D6 y PRSKIN con los suyos. El bloque del aterrizaje de skin.js se sustituye por el de
   22f82eb (git); los cambios puntuales de render.js y export.js, por su texto anterior. Si 019.4a cambia y esto no, los
   tests de alcance antiguos fallan: es lo que se quiere. El alcance de 019.4a lo vigila test/fluyo-019-4a.test.cjs. */
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const gitRoot = process.env.FLUYO_GIT_ROOT || root;
const BASE4A = "22f82eb";
const atBase4a = (f) => execFileSync("git", ["-C", gitRoot, "show", BASE4A + ":" + f], { encoding: "utf8" }).replace(/\r\n/g, "\n");

const LANDING_NEW = "/* ---- Aterrizaje por silueta (FLUYO-019.4a", LANDING_OLD = "/* Aterrizaje en la cara visible", LANDING_END = "/* Anillo de salida";
const block = (s, a, b) => { const i = s.indexOf(a), j = s.indexOf(b, i); return i >= 0 && j > i ? s.slice(i, j) : null; };

const RENDER = [
  ["  /* FLUYO-019.1/019.4a: con la piel la punta se para en la silueta visible del destino (copia; la ruta del documento no cambia) */\n  if(rs.skinOn && typeof skinEdgeLanding===\"function\") pts=skinEdgeLanding(pts, B);",
   "  /* FLUYO-019.1: con la piel la punta se posa en la cara visible (copia; la ruta del documento no cambia) */\n  if(rs.skinOn && typeof skinEdgeLanding===\"function\") pts=skinEdgeLanding(pts, inferSide(B, pts[pts.length-1]));"],
  ["      const p=pointAt(painted(seg), s/seg.L);", "      const p=pointAt(seg.pts, s/seg.L);"],
  ["drawFlowBalls(c,t,rs);", "drawFlowBalls(c,t);"],
];
const BALLS_HEAD = /\/\* FLUYO-019\.4a: con la piel, la pelota se coloca[\s\S]*?\*\/\nfunction drawFlowBalls\(c,t,rs\)\{\n  if\(!settings\.single\) return;\n  const landed=[^\n]*\n  const painted=seg=>\{\n[\s\S]*?\n  \};\n/;
const EXPORT = [
  ["  /* FLUYO-019.1/019.4a: el mismo aterrizaje que el lienzo (silueta del destino; copia; edgePoints no cambia) */\n  if(skinOn && typeof skinEdgeLanding===\"function\") pts=skinEdgeLanding(pts, B);",
   "  /* FLUYO-019.1: el mismo aterrizaje que el lienzo (copia; edgePoints no cambia) */\n  if(skinOn && typeof skinEdgeLanding===\"function\") pts=skinEdgeLanding(pts, inferSide(B, pts[pts.length-1]));"],
];
const all = (s, pairs) => pairs.reduce((acc, [a, b]) => acc.split(a).join(b), s);

function undo4a(file, src) {
  const f = file.replace(/\\/g, "/");
  if (f === "js/skin.js") {
    const now = block(src, LANDING_NEW, LANDING_END);
    if (!now) return src;
    return src.replace(now, block(atBase4a("js/skin.js"), LANDING_OLD, LANDING_END));
  }
  if (f === "js/render.js") return all(src.replace(BALLS_HEAD, "function drawFlowBalls(c,t){\n  if(!settings.single) return;\n"), RENDER);
  if (f === "js/export.js") return all(src, EXPORT);
  return src;
}
module.exports = { undo4a, BASE4A };
