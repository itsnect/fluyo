"use strict";
/* FLUYO-018.7a — set_theme, orden Z y duplicate_node (dominio, autoría, paridad con el editor real). */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { makeEditor, SETUP, STATE } = require("./fluyo-018-7a-harness.cjs");
const golden = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "fluyo-018-7a-pasteclip-golden.json"), "utf8"));

const sel = (e, ids) => e.run(`selN=new Set(${JSON.stringify(ids)});selE=new Set();`);
const state = (e) => JSON.parse(e.run(STATE));

/* ───────── Caracterización de pasteClip/dupSel (escrita ANTES del refactor; el dominio debe reproducirla) ───────── */
test("caracterización: pegar una y dos veces (cascada de clip) = comportamiento previo al refactor", () => {
  const e = makeEditor(); e.run(SETUP); sel(e, [1, 2, 3]); e.run("copySel(); pasteClip();");
  assert.deepEqual(state(e), golden.paste1);
  assert.equal(e.clipboard.length, 1, "copySel escribe en el portapapeles del sistema (Ctrl+C)");
  e.run("pasteClip();");
  assert.deepEqual(state(e), golden.paste2);
});
test("caracterización: Ctrl+D de un nodo con Behavior, de un conjunto, dos veces seguidas y con clip previo", () => {
  let e = makeEditor(); e.run(SETUP); sel(e, [2]); e.run("dupSel();");
  assert.deepEqual(state(e), golden.dup_single);
  e = makeEditor(); e.run(SETUP); sel(e, [1, 2, 3]); e.run("dupSel();");
  assert.deepEqual(state(e), golden.dup_set);
  e.run("dupSel();");
  assert.deepEqual(state(e), golden.dup_twice);
  e = makeEditor(); e.run(SETUP); sel(e, [1, 4]); e.run("dupSel();");
  assert.deepEqual(state(e), golden.dup_1_4);
  e = makeEditor(); e.run(SETUP); sel(e, [1, 2, 3]); e.run("copySel();"); e.run("selN=new Set([4]); dupSel();");
  assert.deepEqual(state(e), golden.dup_keeps_clip, "dupSel no toca el portapapeles interno");
});
test("caracterización: una conexión sola no se duplica; un Undo deshace todo el duplicado", () => {
  let e = makeEditor(); e.run(SETUP); e.run("selN=new Set();selE=new Set([5]);dupSel();");
  assert.deepEqual(state(e), golden.dup_edge_only);
  e = makeEditor(); e.run(SETUP); sel(e, [3]); e.run("dupSel(); undo();");
  assert.deepEqual(state(e), golden.dup_undo);
});
