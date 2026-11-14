// Carga los módulos del sitio como lo hace el navegador: scripts con globales (Num, Paginacion, Escandallo…).
// Los que tienen `module.exports` se pueden requerir; acá además se publican como global para los que dependen de otros.
'use strict';
const path = require('path');
const raiz = path.join(__dirname, '..', '..');
const cargar = (nombre, global_) => {
  const m = require(path.join(raiz, nombre + '.js'));
  if (global_) globalThis[global_] = m;
  return m;
};
cargar('num', 'Num');
cargar('paginacion', 'Paginacion');
cargar('escandallo', 'Escandallo');
module.exports = { cargar, raiz, Num: globalThis.Num };
