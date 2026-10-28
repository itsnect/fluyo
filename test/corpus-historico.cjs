"use strict";
/* Corpus HISTÓRICO de ejemplos (FLUYO-EXAMPLES-001). Los tests de regresión de slices antiguas comparan el corpus publicado de
   ejemplos/data con el comportamiento de su commit base. Ese corpus ya no es fijo: EXAMPLES añade documentos con Historias (y la
   carpeta en/ de ediciones), que un commit antiguo no puede conocer. Estos tests verifican SOLO los archivos que existían en el
   commit que comprueban; los documentos nuevos los cubren los tests propios de EXAMPLES (test/fluyo-examples-001*.cjs).

   historicalExamples(root, rev): nombres de archivo (.json) de ejemplos/data en `rev` (por defecto, el último commit antes de
   EXAMPLES), ordenados. Sin git: lo que hay en disco menos lo que añade EXAMPLES. */
const fs = require("node:fs"), path = require("node:path");
const { execFileSync } = require("node:child_process");
const { NEW_FILES, BASE_EX } = require("./fluyo-examples-001-undo.cjs");
function historicalExamples(root, rev = BASE_EX) {
  try {
    const out = execFileSync("git", ["-C", process.env.FLUYO_GIT_ROOT || root, "ls-tree", "--name-only", rev, "ejemplos/data/"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return out.split("\n").filter((f) => f.endsWith(".json")).map((f) => f.slice("ejemplos/data/".length)).sort();
  } catch {
    return fs.readdirSync(path.join(root, "ejemplos", "data")).filter((f) => f.endsWith(".json") && !NEW_FILES.includes("ejemplos/data/" + f)).sort();
  }
}
module.exports = { historicalExamples };
