'use strict';
// Sorteo de materia aprobada (ejemplar.js) contra las reglas de NIVELES.md y los datos de datos/pigmentos.json y grabados.json.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { cargar, raiz } = require('./cargar.js');

const Ejemplar = cargar('ejemplar');
const datos = f => JSON.parse(fs.readFileSync(path.join(raiz, 'datos', f), 'utf8'));
const PIGS = datos('pigmentos.json').pigmentos, BANCO = datos('grabados.json').grabados;
// Generador con semilla (mulberry32): el sorteo se repite igual en cada corrida.
const semilla = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

test('las probabilidades de pigmentos.json suman 100 y siguen la tabla de NIVELES.md', () => {
  const p = Object.fromEntries(PIGS.map(x => [x.nombre, x.prob]));
  assert.equal(Math.round(PIGS.reduce((s, x) => s + x.prob, 0) * 1e6) / 1e6, 100);
  assert.deepEqual(p, { 'bermellón': 40, 'ocre': 24, 'sepia': 16, 'verde cardenillo': 8.5, 'púrpura de múrice': 5.1, 'carmín de cochinilla': 3.4,
    'oro sobre papel': 1.5, 'oro y ultramar': 0.9, 'oro sobre negro': 0.6 });
  const nivel = n => PIGS.filter(x => x.nivel === n).reduce((s, x) => s + x.prob, 0);
  assert.deepEqual([nivel('tirada'), Math.round(nivel('ilustrada') * 10) / 10, nivel('numerado')], [80, 17, 3]);
});

test('el sorteo reparte pigmentos según prob y fondos parejos (200 000 tiradas)', () => {
  const rnd = semilla(19), N = 200000, pig = {}, fondo = {};
  for (let i = 0; i < N; i++) { const e = Ejemplar.sortear(PIGS, BANCO, rnd); pig[e.p] = (pig[e.p] || 0) + 1; fondo[e.f] = (fondo[e.f] || 0) + 1; }
  for (const x of PIGS) {
    const obs = pig[x.nombre] / N * 100, sd = Math.sqrt(x.prob * (100 - x.prob) / N);   // en puntos porcentuales
    assert.ok(Math.abs(obs - x.prob) < 5 * sd + 0.01, `${x.nombre}: ${obs.toFixed(3)} % contra ${x.prob} %`);
  }
  assert.equal(Object.keys(fondo).length, BANCO.length, 'salen todos los fondos del banco, de cualquier nivel');
  const esp = N / BANCO.length;
  Object.entries(fondo).forEach(([f, c]) => assert.ok(Math.abs(c - esp) < 5 * Math.sqrt(esp), `${f}: ${c} contra ${esp}`));
});

test('solo el ejemplar numerado lleva número, del 1 al 100', () => {
  const rnd = semilla(7), vistos = new Set();
  for (let i = 0; i < 50000; i++) {
    const e = Ejemplar.sortear(PIGS, BANCO, rnd), nivel = PIGS.find(p => p.nombre === e.p).nivel;
    if (nivel === 'numerado') { assert.ok(Number.isInteger(e.n) && e.n >= 1 && e.n <= 100, String(e.n)); vistos.add(e.n); }
    else assert.equal(e.n, 0);
    assert.equal(e.r, 0);
  }
  assert.ok(vistos.size > 90, 'el número recorre el rango');
});

test('un solo re-tiro: sortea las tres cosas de nuevo y después queda fijo', () => {
  const rnd = semilla(3), a = Ejemplar.sortear(PIGS, BANCO, rnd), b = Ejemplar.retirar(a, PIGS, BANCO, rnd);
  assert.equal(b.r, 1);
  assert.ok(PIGS.some(p => p.nombre === b.p) && BANCO.some(g => g.id === b.f));
  assert.equal(Ejemplar.retirar(b, PIGS, BANCO, rnd), null);
  assert.equal(Ejemplar.retirar(null, PIGS, BANCO, rnd), null);
});

test('sanear: acepta la forma guardada y descarta lo demás', () => {
  assert.deepEqual(Ejemplar.sanear({ p: 'oro y ultramar', f: 'dragon', n: 37, r: 1, x: 'basura' }), { p: 'oro y ultramar', f: 'dragon', n: 37, r: 1 });
  assert.deepEqual(Ejemplar.sanear({ p: 'ocre', f: 'monje', n: 500, r: 'sí' }), { p: 'ocre', f: 'monje', n: 0, r: 1 });
  [null, 'ocre', [], {}, { p: 'ocre' }, { p: '<b>', f: 'monje' }, { p: 'ocre', f: '../x' }, { p: 'x'.repeat(41), f: 'monje' }]
    .forEach(x => assert.equal(Ejemplar.sanear(x), null, JSON.stringify(x)));
});

test('resolver y etiqueta: «{Nivel} · {pigmento}», con respaldo si el dato ya no existe', () => {
  const r = Ejemplar.resolver({ p: 'verde cardenillo', f: 'dragon', n: 0, r: 0 }, PIGS, BANCO, '0911');
  assert.equal(Ejemplar.etiqueta(r.pig), 'Edición ilustrada · verde cardenillo');
  assert.equal(r.grab.id, 'dragon');
  assert.equal(r.retiro, true);
  const v = Ejemplar.resolver({ p: 'azul de Prusia', f: 'no-existe', n: 0, r: 1 }, PIGS, BANCO, '0911');
  assert.equal(v.pig.nombre, PIGS[0].nombre);
  assert.ok(BANCO.includes(v.grab));
  assert.equal(v.retiro, false);
  assert.equal(Ejemplar.resolver({ p: 'oro sobre negro', f: 'dragon', n: 0, r: 0 }, PIGS, BANCO, '0911').n > 0, true, 'el numerado siempre muestra número');
  assert.equal(Ejemplar.etiqueta(PIGS.find(p => p.nivel === 'numerado')), 'Ejemplar numerado · oro sobre papel');
});
