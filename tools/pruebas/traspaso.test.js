'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar } = require('./cargar.js');
const T = cargar('traspaso');

test('base64 sin relleno: ida y vuelta para todos los largos', () => {
  for (let n = 0; n <= 40; n++) {
    const b = Uint8Array.from({ length: n }, (_, i) => (i * 37 + n * 11) & 255);
    const s = T.aB64(b);
    assert.match(s, /^[A-Za-z0-9_-]*$/);
    assert.deepEqual(Array.from(T.deB64(s)), Array.from(b), 'largo ' + n);
  }
  assert.equal(T.aB64(new Uint8Array([255, 255, 255])), '____');
  assert.equal(T.aB64(new Uint8Array([])), '');
});

test('deB64 rechaza caracteres inválidos y largos imposibles', () => {
  assert.throws(() => T.deB64('ab+/'), /base64/);
  assert.throws(() => T.deB64('ab=='), /base64/);
  assert.throws(() => T.deB64('a'), /base64/, 'un solo carácter no alcanza para un byte');
  assert.throws(() => T.deB64('abcde'), /base64/);
  assert.deepEqual(Array.from(T.deB64('')), []);
});

test('paraEnviar saca lo propio del navegador y, en versión liviana, el historial', () => {
  const E = { v: 1, materias: { a: 1 }, copia: 1, modif: 2, primera: 3, visto: 4, practica: { x: [1, 2] } };
  assert.deepEqual(T.paraEnviar(E), { v: 1, materias: { a: 1 }, practica: { x: [1, 2] } });
  assert.deepEqual(T.paraEnviar(E, true), { v: 1, materias: { a: 1 }, practica: {} });
  assert.ok('copia' in E, 'no modifica el original');
});

test('empaquetar y desempaquetar: ida y vuelta, con tildes y emoji', async () => {
  const E = { v: 1, materias: { 'Teoría Ñandú': { nota: 8.5, obs: 'áéíóú 😀' } }, extra: [1, null, 'x'], copia: 'se va' };
  const txt = await T.empaquetar(E);
  assert.equal(txt[0], 'a');
  assert.match(txt, /^[A-Za-z0-9_-]+$/);
  const volvio = await T.desempaquetar(txt);
  assert.deepEqual(volvio, T.paraEnviar(E));
});

test('un estado repetitivo se comprime bastante', async () => {
  const E = { v: 1, materias: Object.fromEntries(Array.from({ length: 80 }, (_, i) => ['m' + i, { nota: 7, estado: 'aprobada' }])) };
  const txt = await T.empaquetar(E);
  assert.ok(txt.length < JSON.stringify(E).length / 3, `${txt.length} vs ${JSON.stringify(E).length}`);
});

test('desempaquetar rechaza lo que no es de Galera o está cortado', async () => {
  await assert.rejects(T.desempaquetar('b' + 'AAAA'), /versión/);
  await assert.rejects(T.desempaquetar(''), /versión|Cannot|undefined/);
  const bueno = await T.empaquetar({ v: 1, materias: {} });
  await assert.rejects(T.desempaquetar(bueno.slice(0, Math.floor(bueno.length / 2))), Error, 'cortado a la mitad');
  await assert.rejects(T.desempaquetar('a!!!!'), /base64/);
  await assert.rejects(T.desempaquetar(await T.empaquetar({ v: 2, materias: {} })), /no es de Galera/);
  await assert.rejects(T.desempaquetar(await T.empaquetar({ v: 1, materias: 'x' })), /no es de Galera/);
  await assert.rejects(T.desempaquetar(await T.empaquetar(null)), Error);
});

test('desempaquetar corta una bomba de descompresión (tope de 1 MB)', async () => {
  const grande = await T.empaquetar({ v: 1, materias: {}, relleno: 'a'.repeat(3e6) });
  assert.ok(grande.length < 20000, 'el link es chico pero el contenido, enorme');
  await assert.rejects(T.desempaquetar(grande), /demasiado grande/);
});

test('capacidad del QR: valores de la norma (versión 1 y 40)', () => {
  assert.equal(T.capacidad(1, 'L'), 19);
  assert.equal(T.capacidad(1, 'M'), 16);
  assert.equal(T.capacidad(40, 'L'), 2956);
  assert.equal(T.capacidad(40, 'M'), 2334);
  assert.ok(T.capacidad(10, 'L') > T.capacidad(10, 'M'));
});

test('QR: tamaño de 4 × versión + 17, cuadrado, con los buscadores de las esquinas', () => {
  const m = T.qrDeTexto('hola');
  assert.equal(m.length, 21, 'versión 1');
  m.forEach(f => assert.equal(f.length, 21));
  // el buscador de la esquina superior izquierda: anillo exterior oscuro, anillo claro, centro oscuro
  for (let i = 0; i < 7; i++) { assert.ok(m[0][i] && m[6][i] && m[i][0] && m[i][6]); }
  assert.ok(!m[1][1] && !m[1][5] && m[3][3]);
  const g = T.qrDeTexto('x'.repeat(200));
  assert.ok(g.length > 21 && (g.length - 17) % 4 === 0);
  assert.equal(T.qrDeTexto('x'.repeat(5000)), null, 'no hay versión que lo contenga');
});

test('QR: es determinista (mismo texto, misma matriz)', () => {
  assert.deepEqual(T.qrDeTexto('https://galera.com.ar/#datos=abc'), T.qrDeTexto('https://galera.com.ar/#datos=abc'));
  assert.notDeepEqual(T.qrDeTexto('uno'), T.qrDeTexto('dos'));
});

test('qrSvg: un SVG bien formado, con la etiqueta pedida y sin inyección', () => {
  const m = T.qrDeTexto('hola');
  const svg = T.qrSvg(m, 'Mi código');
  assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'));
  assert.ok(svg.includes('viewBox="0 0 29 29"'), '21 + 8 de zona de silencio');
  assert.ok(svg.includes('aria-label="Mi código"'));
  assert.ok(T.qrSvg(m).includes('aria-label="Código QR"'));
});
