"use strict";
/* FLUYO-I18N-002 S0 — Pseudo-idioma de PRUEBAS («qps»; nunca se publica ni se precachea). Cada texto de la interfaz se vuelve
   ⟦Ŧéxţö ãçéñţûãðö~~~⟧: acentuado (se ve a simple vista lo que NO pasa por FluyoI18n), un 40 % más largo (desbordes del francés y
   de idiomas aún más largos) y entre ⟦ ⟧ (lo que queda fuera de los corchetes en pantalla es texto sin migrar o contenido del
   autor). Los marcadores {param} se conservan. Lo usa test/fluyo-i18n-002-s0-browser.cjs: inyecta FLUYO_LOCALES.qps antes de que
   carguen los diccionarios y abre la página con ?lang=qps (js/i18n.js acepta cualquier diccionario cargado por ?lang, aunque no
   esté en LANGS ni publicado). */
const scan = require("./i18n-scan.cjs");

const MAP = { a: "ã", b: "ƀ", c: "ç", d: "ð", e: "é", f: "ƒ", g: "ĝ", h: "ĥ", i: "î", j: "ĵ", k: "ķ", l: "ļ", m: "ɱ", n: "ñ", o: "ö", p: "þ", q: "ǫ",
  r: "ŕ", s: "š", t: "ţ", u: "û", v: "ṽ", w: "ŵ", x: "ẋ", y: "ý", z: "ž", A: "Å", B: "Ɓ", C: "Ç", D: "Ð", E: "É", F: "Ƒ", G: "Ĝ", H: "Ĥ", I: "Î", J: "Ĵ",
  K: "Ķ", L: "Ļ", M: "Ṁ", N: "Ñ", O: "Ö", P: "Þ", Q: "Ǫ", R: "Ŕ", S: "Š", T: "Ŧ", U: "Û", V: "Ṽ", W: "Ŵ", X: "Ẋ", Y: "Ý", Z: "Ž" };
const OPEN = "⟦", CLOSE = "⟧";
function pseudo(text) {
  const parts = String(text).split(/(\{\w+\})/);
  const body = parts.map((p) => (/^\{\w+\}$/.test(p) ? p : p.replace(/[A-Za-z]/g, (c) => MAP[c] || c))).join("");
  const visible = String(text).replace(/\{\w+\}/g, "").length;
  return OPEN + body + "~".repeat(Math.max(1, Math.ceil(visible * 0.4))) + CLOSE;
}
/* Diccionario qps con TODAS las claves en uso, sacado del texto base (español). */
function pseudoDictionary() {
  const out = {};
  for (const u of scan.catalog().uses) {
    if (out[u.key] !== undefined) continue;
    out[u.key] = typeof u.es === "object" ? Object.fromEntries(Object.entries(u.es).map(([k, v]) => [k, pseudo(v)])) : pseudo(u.es);
  }
  return out;
}
module.exports = { pseudo, pseudoDictionary, OPEN, CLOSE };
