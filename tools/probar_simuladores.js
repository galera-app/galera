#!/usr/bin/env node
// Prueba de humo de los simuladores: cargan sin DOM (como en el navegador, en un contexto aislado), exponen su API
// y calculan su ejemplo sin tirar errores ni devolver NaN/Infinity. Sin dependencias: node tools/probar_simuladores.js
'use strict';
const vm = require('vm'), fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..');
const ctx = vm.createContext({ console });
const MODULOS = { num: 'Num', papel: 'Papel', paginacion: 'Paginacion', formatos: 'Formatos', escandallo: 'Escandallo', leyes: 'Leyes',
  contratos: 'Contratos', cronograma: 'Cronograma', ecosistema: 'Ecosistema', retos: 'Retos' };
const fallas = [];
const falla = m => fallas.push(m);
for (const f of Object.keys(MODULOS)) {
  try { vm.runInContext(fs.readFileSync(path.join(raiz, f + '.js'), 'utf8'), ctx, { filename: f + '.js' }); }
  catch (e) { falla(`${f}.js no carga: ${e.message}`); }
}
const g = expr => vm.runInContext(expr, ctx);
function malos(v, ruta, out = []) {
  if (typeof v === 'number' && !Number.isFinite(v)) out.push(`${ruta} = ${v}`);
  else if (v && typeof v === 'object') for (const k of Object.keys(v)) malos(v[k], `${ruta}.${k}`, out);
  return out;
}
function caso(nombre, expr, valida) {
  try {
    const r = g(expr);
    if (r == null) return falla(`${nombre}: devolvió ${r}`);
    const m = malos(r, nombre);
    if (m.length) return falla(`${nombre}: números inválidos (${m.slice(0, 3).join('; ')})`);
    if (valida) { const e = valida(r); if (e) falla(`${nombre}: ${e}`); }
  } catch (e) { falla(`${nombre}: ${e.message}`); }
}
for (const [f, nombre] of Object.entries(MODULOS)) {
  if (g(`typeof ${nombre}`) !== 'object') falla(`${nombre} no quedó definido (${f}.js)`);
}
if (!fallas.length) {
  caso('Num.parse', `[Num.parse('18.000'), Num.parse('4,6'), Num.parse('4.6'), Num.parse('x')]`,
    r => (r[0] === 18000 && r[1] === 4.6 && r[2] === 4.6 && r[3] === 0) ? '' : `lee mal los números (${JSON.stringify(r)})`);
  caso('Papel.calcular', 'Papel.calcular(Papel.EJEMPLO)', r => r.errores && r.errores.length ? `el ejemplo da errores: ${r.errores}` : '');
  caso('Escandallo.calcular', 'Escandallo.calcular(Escandallo.EJEMPLO)');
  caso('Paginacion.armar', 'Paginacion.armar(Paginacion.EJEMPLO)', r => (r.tramos && r.tramos.length) ? '' : 'sin tramos');
  caso('Cronograma.calcular', 'Cronograma.calcular(Cronograma.EJEMPLO)', r => (r.tareas && r.tareas.length) ? '' : 'sin tareas');
  caso('Formatos', 'Formatos.TODOS.map(x => Formatos.area(x))');
  caso('Contratos.generar', `Object.keys(Contratos.MODELOS).map(m => Contratos.generar(m, Contratos.defaults(m)))`);
  caso('Leyes.buscar', `Leyes.buscar('ley')`);
  caso('Ecosistema', `Ecosistema.ACTORES.map(a => Ecosistema.vecinos(a.id))`);
  for (const [n, expr] of [['Formatos.TODOS', 'Formatos.TODOS'], ['Leyes.NORMAS', 'Leyes.NORMAS'], ['Ecosistema.ACTORES', 'Ecosistema.ACTORES']])
    if (!(g(expr).length > 0)) falla(`${n} está vacío`);
}
if (fallas.length) { console.error('Simuladores: ' + fallas.length + ' falla(s)\n - ' + fallas.join('\n - ')); process.exit(1); }
console.log('Simuladores: carga y cuentas de ejemplo ok (' + Object.keys(MODULOS).length + ' módulos)');
