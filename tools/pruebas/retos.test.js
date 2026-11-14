'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar } = require('./cargar.js');   // publica Paginacion y Escandallo como globales, que Retos usa
const R = cargar('retos');
const Paginacion = globalThis.Paginacion, Escandallo = globalThis.Escandallo;

const copia = o => JSON.parse(JSON.stringify(o));

test('los retos están bien formados y sus ids no se repiten', () => {
  const todos = R.todos();
  assert.ok(todos.length >= 4);
  assert.equal(new Set(todos.map(r => r.id)).size, todos.length);
  for (const r of todos) {
    for (const k of ['id', 't', 'enun']) assert.equal(typeof r[k], 'string', `${r.id}.${k}`);
    for (const k of ['prep', 'ok', 'ahora']) assert.equal(typeof r[k], 'function', `${r.id}.${k}`);
  }
  for (const [sim, lista] of Object.entries(R.POR_SIM)) {
    assert.ok(R.CLAVE_EST[sim], 'clave de estado de ' + sim);
    lista.forEach(r => assert.ok(r.id.length > 3));
  }
});

test('el estado inicial de cada reto NO lo resuelve (si no, no sería un reto)', () => {
  for (const r of R.todos()) assert.equal(r.ok(r.prep()), false, r.id);
});

test('ok y ahora toleran estado vacío o nulo', () => {
  for (const r of R.todos()) {
    assert.equal(r.ok(null), false, r.id);
    assert.equal(r.ok(undefined), false, r.id);
    assert.equal(r.ahora(null), '', r.id);
    assert.equal(typeof r.ahora(r.prep()), 'string');
    assert.ok(r.ahora(r.prep()).startsWith('Ahora:'));
  }
});

test('prep devuelve objetos nuevos cada vez (no se comparten entre partidas)', () => {
  for (const r of R.todos()) {
    const a = r.prep(), b = r.prep();
    assert.notEqual(a, b, r.id);
    assert.deepEqual(a, b, r.id);
  }
});

test('«Cerrar en 128 sin sobras» tiene solución y exige no tocar los datos del libro', () => {
  const reto = R.POR_SIM.paginacion.find(r => r.id === 'pag-sin-sobras');
  const base = reto.prep();
  // Solución hallada con una búsqueda exhaustiva de hasta 6 partes encendidas (todas las demás, apagadas).
  const SOL = ['anteportada', 'colec', 'intro', 'apendice', 'notas', 'biblio'];
  const solucion = copia(base);
  Paginacion.PARTES.filter(p => p.id !== 'cuerpo').forEach(p => { solucion.partes[p.id] = { on: SOL.includes(p.id) }; });
  assert.equal(reto.ok(solucion), true);
  assert.equal(Paginacion.armar(solucion).total, 128);
  assert.equal(Paginacion.armar(solucion).blancasFinal, 0);
  for (const cambio of [{ paginas: '101' }, { capitulos: '6' }, { multiplo: '8' }, { capRecto: '0' }]) {
    assert.equal(reto.ok(Object.assign(copia(solucion), cambio)), false, 'cambiar ' + Object.keys(cambio)[0]);
  }
});

test('«Equilibrio en 900 ejemplares»: se resuelve bajando costos, pero no subiendo el PVP', () => {
  const reto = R.POR_SIM.escandallo.find(r => r.id === 'esc-equilibrio');
  const e = reto.prep();
  assert.equal(Math.ceil(Escandallo.calcular(e).pe.estructura), 1463, 'el enunciado dice 1.463 ejemplares');
  assert.equal(reto.ok(Object.assign(copia(e), { cpu: '500' })), true);
  assert.equal(reto.ok(Object.assign(copia(e), { pvp: '20000' })), false, 'subir el PVP por encima del tope no vale');
  assert.match(reto.ahora(e), /1463|1\.463/);
});

test('«Margen de 60 %»: el ejemplo da 58,3 % y se llega bajando el descuento', () => {
  const reto = R.POR_SIM.escandallo.find(r => r.id === 'esc-margen');
  assert.match(reto.ahora(reto.prep()), /58,33? %/);
  assert.equal(reto.ok(Object.assign(copia(reto.prep()), { descuento: '30' })), true);
  assert.equal(reto.ok(Object.assign(copia(reto.prep()), { descuento: '30', pvp: '19000' })), false, 'subir el PVP no cuenta');
});
