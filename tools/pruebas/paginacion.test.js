'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar } = require('./cargar.js');
const P = cargar('paginacion');

test('paginasTexto: páginas cargadas, o caracteres ÷ caracteres por página redondeado hacia arriba', () => {
  assert.deepEqual(P.paginasTexto({ paginas: '200' }), { pags: 200, desde: 'paginas' });
  assert.deepEqual(P.paginasTexto({ paginas: '', caracteres: '100.001', porPagina: '2.000' }), { pags: 51, desde: 'caracteres' });
  assert.deepEqual(P.paginasTexto({ paginas: '', caracteres: '100000', porPagina: '2000' }), { pags: 50, desde: 'caracteres' });
  assert.deepEqual(P.paginasTexto({ paginas: '12,6' }), { pags: 13, desde: 'paginas' });
});

test('paginasTexto: entradas vacías, negativas o incompletas dan cero', () => {
  const cero = { pags: 0, desde: '' };
  assert.deepEqual(P.paginasTexto({}), cero);
  assert.deepEqual(P.paginasTexto({ paginas: '-5' }), cero);
  assert.deepEqual(P.paginasTexto({ caracteres: '1000' }), cero, 'faltan los caracteres por página');
  assert.deepEqual(P.paginasTexto({ caracteres: '1000', porPagina: '0' }), cero, 'sin dividir por cero');
  assert.deepEqual(P.paginasTexto({ paginas: 'abc' }), cero);
});

test('estado: usa los valores por defecto de la parte y respeta lo cargado', () => {
  const portada = P.PARTES.find(p => p.id === 'portada');
  assert.deepEqual(P.estado({}, portada), { on: true, pags: 1, ini: 'recto' });
  assert.deepEqual(P.estado({ partes: { portada: { on: false, pags: '3', ini: 'verso' } } }, portada), { on: false, pags: 3, ini: 'verso' });
  assert.equal(P.estado({ partes: { portada: { ini: 'cualquiera' } } }, portada).ini, 'recto', 'un valor inválido vuelve al por defecto');
  assert.equal(P.estado({ partes: { portada: { pags: '  ' } } }, portada).pags, 1, 'páginas vacías: por defecto');
  assert.equal(P.estado({ partes: { portada: { pags: '-4' } } }, portada).pags, 0, 'nunca negativas');
});

test('armar con el ejemplo: páginas en blanco, total en múltiplo de 16', () => {
  const r = P.armar(P.EJEMPLO);
  // anteportada 1 · blanca · portada 1 · derechos 1 · dedicatoria 1 · blanca · índice 2 · agradecimientos 1 · blanca · 10 capítulos de 20 · colofón 1
  assert.equal(r.minimo, 211);
  assert.equal(r.total, 224);
  assert.equal(r.multiplo, 16);
  assert.equal(r.contenido, 208);
  assert.equal(r.blancasEntre, 3);
  assert.equal(r.blancasFinal, 13);
  assert.equal(r.hojas, 112);
  assert.deepEqual(r.cuadernillos, { lista: [{ paginas: 16, cantidad: 14 }], resto: 0 });
  assert.equal(r.texto.pags, 200);
  assert.equal(r.capitulos, 10);
});

test('armar: los capítulos abren en recto (impar) y suman las páginas del texto', () => {
  const r = P.armar(P.EJEMPLO);
  const caps = r.tramos.filter(t => t.cap);
  assert.equal(caps.length, 10);
  caps.forEach(c => assert.equal(c.desde % 2, 1, `capítulo ${c.cap} empieza en la ${c.desde}`));
  assert.equal(caps.reduce((s, c) => s + c.pags, 0), 200);
});

test('armar: invariantes de la lista de páginas y de los tramos', () => {
  for (const d of [P.EJEMPLO, {}, { paginas: '37', capitulos: '3', multiplo: '8' }, { paginas: '500', capitulos: '60', capPortada: '1', multiplo: '64' }]) {
    const r = P.armar(d);
    assert.equal(r.paginas.length, r.total);
    r.paginas.forEach((p, i) => assert.equal(p.n, i + 1, 'numeración consecutiva'));
    assert.equal(r.total % r.multiplo, 0);
    assert.ok(r.total >= r.minimo);
    assert.equal(r.paginas.filter(p => p.id === null).length, r.blancasEntre + r.blancasFinal);
    let ultimo = 0;
    r.tramos.forEach(t => {
      assert.ok(t.desde > ultimo, 'los tramos no se pisan');
      assert.equal(t.hasta - t.desde + 1, t.pags);
      ultimo = t.hasta;
    });
  }
});

test('armar sin datos: solo las partes que están activas por defecto, y no rompe', () => {
  const r = P.armar({});
  assert.equal(r.texto.pags, 0);
  assert.ok(!r.tramos.some(t => t.id === 'cuerpo'));
  assert.ok(r.total > 0 && r.total % 16 === 0);
  assert.deepEqual(P.armar({ partes: Object.fromEntries(P.PARTES.map(p => [p.id, { on: false }])) }).total, 0, 'nada activo: cero páginas');
  assert.deepEqual(P.armar({ partes: Object.fromEntries(P.PARTES.map(p => [p.id, { on: false }])) }).cuadernillos, { lista: [], resto: 0 });
});

test('armar: múltiplo inválido vuelve a 16; capítulos se acotan entre 1 y 60 y al texto', () => {
  assert.equal(P.armar({ paginas: '100', multiplo: '7' }).multiplo, 16);
  assert.equal(P.armar({ paginas: '100', multiplo: '32' }).multiplo, 32);
  assert.equal(P.armar({ paginas: '100', capitulos: '0' }).capitulos, 1);
  assert.equal(P.armar({ paginas: '100', capitulos: '500' }).capitulos, 60);
  assert.equal(P.armar({ paginas: '5', capitulos: '20' }).capitulos, 5, 'no más capítulos que páginas');
  assert.equal(P.armar({ paginas: '100', capitulos: 'x' }).capitulos, 1);
});

test('armar: reparte las páginas entre capítulos sin perder ninguna', () => {
  const caps = P.armar({ paginas: '103', capitulos: '10', capRecto: '0', partes: {} }).tramos.filter(t => t.cap);
  assert.deepEqual(caps.map(c => c.pags), [11, 11, 11, 10, 10, 10, 10, 10, 10, 10], 'los primeros se quedan con el resto');
  assert.equal(caps.reduce((s, c) => s + c.pags, 0), 103);
  assert.equal(caps[1].desde, caps[0].hasta + 1, 'capRecto 0: siguen a continuación');
});

test('armar: portadilla de capítulo suma una página y obliga a recto', () => {
  const r = P.armar({ paginas: '30', capitulos: '3', capRecto: '1', capPortada: '1', partes: {} });
  const port = r.tramos.filter(t => t.portadilla);
  assert.equal(port.length, 3);
  port.forEach(t => { assert.equal(t.pags, 1); assert.equal(t.desde % 2, 1); });
});

test('armar: parte que abre en verso cae en página par', () => {
  const r = P.armar({ paginas: '', partes: { anteportada: { on: true }, colec: { on: true } } });
  const colec = r.tramos.find(t => t.id === 'colec');
  assert.equal(colec.desde % 2, 0);
});
