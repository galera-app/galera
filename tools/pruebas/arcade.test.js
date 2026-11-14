'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar } = require('./cargar.js');
const A = cargar('arcade');

const preg = (n, correcta = 0, extra = {}) => Object.assign({ n, tipo: 'opcion', texto: 'Pregunta ' + n, opciones: ['a', 'b', 'c', 'd'], correcta, respuesta: 'porque sí' }, extra);
const sinAzar = () => 0;

test('multiplicador por racha: 1, 2 (desde 3), 3 (desde 6), 4 (desde 10)', () => {
  assert.deepEqual([0, 1, 2, 3, 5, 6, 9, 10, 50].map(A.mult), [1, 1, 1, 2, 2, 3, 3, 4, 4]);
});

test('maximo: las difíciles van en los lugares de mayor multiplicador', () => {
  assert.equal(A.maximo(0, 0), 0);
  assert.equal(A.maximo(3, 0), 400);   // multiplicadores 1, 1, 2
  assert.equal(A.maximo(3, 1), 500);   // +50 × 2 en el lugar del ×2
  assert.equal(A.maximo(10, 0), 100 * (1 + 1 + 2 + 2 + 2 + 3 + 3 + 3 + 3 + 4));
});

test('tableros: esTablero acepta los conocidos y los prácticos bien formados', () => {
  for (const t of ['teo-1p', 'teo-2p', 'teo-final', 'prac-x1', 'prac-a.b_c']) assert.equal(A.esTablero(t), true, t);
  for (const t of ['prac-', 'prac-Mayus', 'constructor', '__proto__', 'toString', '', null, undefined, 5, 'teo-3p', 'prac-' + 'a'.repeat(41)]) assert.equal(A.esTablero(t), false, String(t));
});

test('apuntesDe: filtra por la clave antes del primer guion', () => {
  const ids = ['e1-clase', 'e10-clase', 'e11a-x', 'p-algo', 'zz-otro', 'c-cierre'];
  assert.deepEqual(A.apuntesDe('teo-1p', ids), ['e1-clase', 'p-algo']);
  assert.deepEqual(A.apuntesDe('teo-2p', ids), ['e10-clase', 'e11a-x']);
  assert.equal(A.apuntesDe('teo-final', ids).length, 5);
  assert.deepEqual(A.apuntesDe('prac-x', ids), []);
  assert.deepEqual(A.apuntesDe('constructor', ids), []);
  assert.equal(A.claveApunte('e6b-clase-uno'), 'e6b');
});

test('banco: solo preguntas de opción válidas, más las difíciles del eje', () => {
  const apuntes = {
    'e1-a': { preguntas: [preg(1), preg(2, 0, { tipo: 'vf' }), preg(3, 7), preg(4, 0, { opciones: ['a', 'b'] }), preg(5, 0, { texto: '' }), preg(6, 1, { dificil: true })] },
    'e10-b': { preguntas: [preg(1)] },
    'zz-c': { preguntas: [preg(1)] }
  };
  const b = A.banco('teo-1p', apuntes, [preg(0, 2, { eje: 'e1' }), preg(0, 2, { eje: 'e10' }), preg(0, 9, { eje: 'e1' })]);
  assert.deepEqual(b.map(x => x.k), ['e1-a/1', 'e1-a/6', 'arcade/0']);
  assert.deepEqual(b.map(x => x.dificil), [false, true, true]);
  assert.deepEqual(A.banco('teo-1p', null, null), []);
  assert.deepEqual(A.banco('nada', apuntes, []), []);
  assert.equal(A.valida(null) == null || A.valida(null) === false, true);
});

test('partida teórica: aciertos suman con multiplicador; tres errores terminan', () => {
  const b = A.banco('teo-1p', { 'e1-a': { preguntas: [1, 2, 3, 4, 5, 6].map(n => preg(n)) } });
  const S = A.nueva(b, sinAzar);
  assert.equal(S.cola.length, 6);
  assert.equal(S.vidas, 3);
  assert.equal(S.fin, false);
  const puntos = [];
  for (let i = 0; i < 3; i++) { const r = A.responder(S, S.cola[S.i].correcta); puntos.push(r.ganado); A.siguiente(S); }
  assert.deepEqual(puntos, [100, 100, 200], 'la tercera seguida vale ×2');
  assert.equal(S.racha, 3);
  assert.equal(A.responder(S, (S.cola[S.i].correcta + 1) % 4).ok, false);
  assert.equal(S.racha, 0);
  assert.equal(S.vidas, 2);
  assert.equal(A.responder(S, 0), null, 'no se responde dos veces la misma pregunta');
  A.siguiente(S);
  A.responder(S, (S.cola[S.i].correcta + 1) % 4); A.siguiente(S);
  assert.equal(S.vidas, 1);
  A.responder(S, (S.cola[S.i].correcta + 1) % 4); A.siguiente(S);
  assert.equal(S.vidas, 0);
  assert.equal(S.fin, true, 'sin vidas termina aunque queden preguntas');
  assert.equal(A.responder(S, 0), null);
});

test('partida teórica: terminar todas termina; el puntaje no supera el máximo', () => {
  const b = A.banco('teo-1p', { 'e1-a': { preguntas: [preg(1), preg(2, 1, { dificil: true }), preg(3)] } });
  const S = A.nueva(b, sinAzar);
  while (!S.fin) { A.responder(S, S.cola[S.i].correcta); A.siguiente(S); }
  assert.equal(S.aciertos, 3);
  // la difícil cae en el lugar que dicte el azar: nunca más que el máximo, nunca menos que sin bono (100+100+200) + 50
  assert.ok(S.puntos <= A.maximoBanco(b) && S.puntos >= 450, String(S.puntos));
  assert.equal(S.mejorRacha, 3);
});

test('nueva: mezcla opciones sin perder cuál es la correcta; banco vacío ya terminó', () => {
  const b = A.banco('teo-1p', { 'e1-a': { preguntas: [preg(1, 2)] } });
  for (let i = 0; i < 20; i++) {
    const S = A.nueva(b);
    const q = S.cola[0];
    assert.equal(q.opciones[q.correcta], 'c');
    assert.deepEqual([...q.opciones].sort(), ['a', 'b', 'c', 'd']);
  }
  assert.equal(A.nueva([]).fin, true);
  assert.equal(A.mezclar([1, 2, 3, 4], sinAzar).length, 4);
  assert.deepEqual(A.mezclar([], sinAzar), []);
});

test('parsear: errores y zonas neutras', () => {
  const T = A.parsear('El {e|perro|Perro|Mayúscula inicial} come.\nOtra {n|línea} más.');
  assert.equal(T.errores, 1);
  assert.equal(T.zonas.length, 2);
  assert.equal(T.parrafos.length, 2);
  assert.deepEqual(T.zonas[0], { id: 0, tipo: 'e', orig: 'perro', corr: 'Perro', just: 'Mayúscula inicial', n: 1 });
  assert.equal(T.tokens.length, 6);
  assert.equal(T.tokens.filter(t => t.z === 0).length, 1);
  assert.equal(A.maximoPractico(T), 100 + 200);
  assert.equal(A.parsear('sin marcas').errores, 0);
});

test('parsear: marcas mal formadas dan error claro', () => {
  const malas = ['{e|solo}', '{e|a|b}', '{e||b|c}', '{n|a|b|c}', '{e|a|b|c', 'llave } suelta', '{e|a|b|c}{e|d|e|f}'];
  for (const m of malas) assert.throws(() => A.parsear(m), Error, m);
  assert.throws(() => A.parsear(null), /cadena/);
  assert.throws(() => A.parsear(42), /cadena/);
});

test('práctico: aciertos, sobrecorrección, repetidas, neutras y bono impecable', () => {
  const nuevo = () => A.nuevoPractico(A.parsear('Uno {e|dos|Dos|a} tres {e|cuatro|Cuatro|b} cinco {n|seis} fin'));
  let S = nuevo();
  const idx = txt => S.T.tokens.find(t => t.w === txt).i;
  assert.equal(A.marcar(S, idx('dos')), 'acierto');
  assert.equal(A.marcar(S, idx('dos')), 'repetida');
  assert.equal(A.marcar(S, idx('seis')), 'neutra');
  assert.equal(S.puntos, 100, 'la neutra no suma ni resta');
  assert.equal(A.marcar(S, idx('tres')), 'sobre');
  assert.equal(S.puntos, 50);
  assert.equal(A.marcar(S, 999), 'repetida', 'índice inexistente');
  assert.equal(A.marcar(S, idx('cuatro')), 'acierto');
  assert.equal(S.fin, true, 'al encontrar todos los errores termina');
  assert.equal(S.impecable, false, 'hubo una sobrecorrección');
  assert.equal(A.puntosFinales(S), 150);
  assert.equal(A.marcar(S, idx('cinco')), 'repetida', 'terminada: no cambia nada');

  S = nuevo();
  A.marcar(S, idx('dos')); A.marcar(S, idx('cuatro'));
  assert.equal(S.impecable, true);
  assert.equal(S.puntos, 400);

  S = nuevo();
  A.marcar(S, idx('dos'));
  A.cerrarPractico(S, true);
  assert.equal(S.rindio, true);
  assert.equal(S.impecable, false);
  A.cerrarPractico(S, false);   // ya cerrada: no cambia
  assert.equal(S.rindio, true);

  S = nuevo();
  A.marcar(S, idx('tres')); A.marcar(S, idx('cinco')); A.marcar(S, idx('fin'));
  assert.equal(S.puntos, -150);
  assert.equal(A.puntosFinales(S), 0, 'el puntaje final no es negativo');
});

test('puntajes: cero, top 10, iniciales y rueda', () => {
  assert.equal(A.cero(5), '000005');
  assert.equal(A.cero(-3), '000000');
  assert.equal(A.cero(12.6), '000013');
  assert.equal(A.cero(1234567), '1234567');
  let top = [];
  for (let i = 1; i <= 12; i++) top = A.sumarTop(top, [i * 10, '2026-01-01', 'AAA']);
  assert.equal(top.length, 10);
  assert.equal(top[0][0], 120);
  assert.equal(top[9][0], 30);
  assert.deepEqual(A.sumarTop(undefined, [5, '2026-01-01', 'ABC']), [[5, '2026-01-01', 'ABC']]);
  assert.equal(A.iniciales('ab1c d'), 'ABC');
  assert.equal(A.iniciales(null), '');
  assert.equal(A.girar('A', -1), 'Z');
  assert.equal(A.girar('Z', 1), 'A');
  assert.equal(A.girar('M', 1), 'N');
});

test('sanear: reconstruye lo que viene de localStorage o de un archivo', () => {
  assert.deepEqual(A.sanear(null), { ini: '', mejores: {} });
  assert.deepEqual(A.sanear('x'), { ini: '', mejores: {} });
  assert.deepEqual(A.sanear([]), { ini: '', mejores: {} });
  const r = A.sanear({
    ini: 'abc',
    mejores: {
      'teo-1p': [[100, '2026-01-01', 'ABC'], [300, '2026-02-01', 'XYZ'], [0, '2026-01-01', 'ABC'], [1.5, '2026-01-01', 'ABC'], [10, 'ayer', 'ABC'], [10, '2026-01-01', 'ab'], 'x', [1000000, '2026-01-01', 'ABC']],
      'constructor': [[1, '2026-01-01', 'ABC']],
      'teo-2p': 'no es lista',
      'prac-ok': [[5, '2026-01-01', 'QQQ']],
      'prac-vacio': [[0, '2026-01-01', 'QQQ']]
    }
  });
  assert.equal(r.ini, '', 'iniciales en minúscula no valen');
  assert.deepEqual(Object.keys(r.mejores).sort(), ['prac-ok', 'teo-1p']);
  assert.deepEqual(r.mejores['teo-1p'], [[300, '2026-02-01', 'XYZ'], [100, '2026-01-01', 'ABC']]);
  assert.equal(A.sanear({ ini: 'ABC' }).ini, 'ABC');
});
