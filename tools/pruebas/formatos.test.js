'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
require('./cargar.js');
const F = require('../../formatos.js');

test('serie A: medidas oficiales y cada número es la mitad del anterior', () => {
  assert.equal(F.SERIE_A.length, 11);
  const A4 = F.porId('a4');
  assert.deepEqual([A4.t, A4.ancho, A4.alto], ['A4', 210, 297]);
  assert.deepEqual([F.porId('a0').ancho, F.porId('a0').alto], [841, 1189]);
  // el área baja a la mitad (con tolerancia: las medidas oficiales están redondeadas al mm)
  for (let i = 1; i <= 8; i++) {
    const r = F.area(F.porId('a' + i)) / F.area(F.porId('a' + (i - 1)));
    assert.ok(Math.abs(r - 0.5) < 0.02, `A${i}/A${i - 1} = ${r}`);
  }
  assert.ok(Math.abs(F.area(F.porId('a0')) - 1) < 1e-3, 'A0 mide 1 m²');
});

test('todos los formatos tienen id único, alto >= ancho y medidas positivas', () => {
  const ids = new Set();
  for (const f of F.TODOS) {
    assert.ok(!ids.has(f.id), 'id repetido ' + f.id);
    ids.add(f.id);
    assert.ok(f.ancho > 0 && f.alto >= f.ancho, `${f.id}: ${f.ancho} × ${f.alto}`);
    assert.ok(F.GRUPOS.some(g => g.id === f.grupo), `${f.id}: grupo desconocido`);
  }
});

test('porId: encuentra y devuelve undefined si no existe', () => {
  assert.equal(F.porId('l14x21').ancho, 140);
  assert.equal(F.porId('nada'), undefined);
  assert.equal(F.porId(undefined), undefined);
});

test('relación y desvío respecto de √2', () => {
  assert.ok(Math.abs(F.relacion(F.porId('a4')) - Math.SQRT2) < 0.001);
  assert.ok(Math.abs(F.desvio(F.porId('a4'))) < 0.1);
  assert.equal(F.relacion({ ancho: 300, alto: 100 }), 3);   // no depende de qué lado se llame ancho
  assert.equal(F.relacion({ ancho: 100, alto: 300 }), 3);
  assert.ok(F.desvio(F.porId('l14x21')) > 0, '14 × 21 es más alargado que la serie A');
  assert.ok(F.desvio({ ancho: 100, alto: 100 }) < 0, 'un cuadrado es menos alargado');
});

test('bipartir y cadena: A3 → A4 → A5', () => {
  assert.deepEqual(F.bipartir({ ancho: 297, alto: 420 }), { ancho: 210, alto: 297 });
  assert.deepEqual(F.bipartir({ ancho: 420, alto: 297 }), { ancho: 210, alto: 297 }, 'no importa la orientación');
  const c = F.cadena({ ancho: 297, alto: 420 }, 2);
  assert.equal(c.length, 3);
  assert.deepEqual(c[2], { ancho: 148.5, alto: 210 });
  assert.equal(F.cadena({ ancho: 10, alto: 20 }, 0).length, 1, 'cero cortes: solo el formato de partida');
});

test('entran: potencias de 2', () => {
  assert.equal(F.entran(3, 5), 4);
  assert.equal(F.entran(4, 4), 1);
  assert.equal(F.entran(0, 4), 16);
});

test('mosaico: el área de las piezas más el resto es la de los dos A0', () => {
  const m = F.mosaico();
  assert.equal(m.tiles.length, 11);
  assert.equal(m.ancho, 1682);
  const suma = m.tiles.reduce((s, t) => s + t.w * t.h, 0) + m.resto.w * m.resto.h;
  assert.ok(Math.abs(suma - m.ancho * m.alto) < 1e-6);
  m.tiles.forEach((t, i) => assert.equal(t.n, i));
});
