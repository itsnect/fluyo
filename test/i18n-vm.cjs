"use strict";
/* FLUYO-I18N-002 S1 — Carga el idioma de la interfaz en un contexto vm, como lo hace la página: los diccionarios
   (js/i18n-<idioma>.js y js/i18n-<idioma>-editor.js) y después js/i18n.js. Para los arneses que ejecutan trozos del editor
   (ui.js, export.js, editor-share.js…) desde que el cromo pasa por FluyoI18n.t. Sin location ni localStorage en el contexto, el
   idioma es el español: los arneses ven exactamente los textos de siempre. No registra tests. */
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const DICT = /^i18n-[a-z]{2,3}(-editor)?\.js$/;
const FILES = [...fs.readdirSync(path.join(root, "js")).filter((f) => DICT.test(f)).sort().map((f) => "js/" + f), "js/i18n.js"];
function loadI18n(ctx) {
  for (const f of FILES) vm.runInContext(read(f), ctx, { filename: f });
  return ctx;
}
/* El mismo código como texto, para los arneses que concatenan fuentes antes de ejecutarlas. */
const I18N_SOURCE = FILES.map(read).join("\n;\n");
module.exports = { loadI18n, I18N_SOURCE, I18N_FILES: FILES };
