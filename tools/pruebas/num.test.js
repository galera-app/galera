'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Num } = require('./cargar.js');

test('Num.parse: formatos argentinos y de máquina', () => {
  assert.equal(Num.parse('18.000'), 18000);
  assert.equal(Num.parse('18000'), 18000);
  assert.equal(Num.parse('4,6'), 4.6);
  assert.equal(Num.parse('4.6'), 4.6);
  assert.equal(Num.parse('1.234,56'), 1234.56);
  assert.equal(Num.parse('1.234.567'), 1234567);
  assert.equal(Num.parse('1.234.567,5'), 1234567.5);
  assert.equal(Num.parse('0,5'), 0.5);
});

test('Num.parse: ignora espacios, $ y %', () => {
  assert.equal(Num.parse('$ 1.500'), 1500);
  assert.equal(Num.parse(' 50 % '), 50);
  assert.equal(Num.parse('4,6 %'), 4.6);
});

test('Num.parse: números ya numéricos y negativos', () => {
  assert.equal(Num.parse(42), 42);
  assert.equal(Num.parse(0), 0);
  assert.equal(Num.parse(-3), -3);
  assert.equal(Num.parse('-3'), -3);
  assert.equal(Num.parse('-1.000'), -1000);
  assert.equal(Num.parse(2.5), 2.5);
});

test('Num.parse: lo que no es número da 0, nunca NaN ni Infinity', () => {
  for (const v of ['', ' ', null, undefined, 'abc', 'x1', '--5', '1.5.5', 'Infinity', '-Infinity', 'NaN', Infinity, NaN, {}, [], '1,2,3']) {
    const r = Num.parse(v);
    assert.ok(Number.isFinite(r), `parse(${String(v)}) = ${r}`);
    assert.equal(r, 0, `parse(${String(v)})`);
  }
});

test('Num.parse: la coma manda sobre el punto', () => {
  assert.equal(Num.parse('1.000,5'), 1000.5);
  assert.equal(Num.parse('1000,5'), 1000.5);
  assert.equal(Num.parse('1,000'), 1);   // con coma son decimales: uno coma cero cero cero
});

test('Num.parse: un punto con cuatro cifras detrás o con dos es decimal', () => {
  assert.equal(Num.parse('1.0000'), 1);
  assert.equal(Num.parse('12.50'), 12.5);
  assert.equal(Num.parse('4.60'), 4.6);
});

// «0.125» se leía como 125, porque «punto + tres cifras» se tomaba siempre como miles. Un grupo de miles no puede
// ser el primero si empieza con 0: quien escribe 0.125 (un espesor, por ejemplo) quiere decir un decimal.
test('Num.parse: 0.125 es un decimal, no 125', () => {
  assert.equal(Num.parse('0.125'), 0.125);
  assert.equal(Num.parse('0.5'), 0.5);
  assert.equal(Num.parse('-0.125'), -0.125);
  assert.equal(Num.parse('0,125'), 0.125);
  assert.equal(Num.parse('0.250'), 0.25);
  assert.equal(Num.parse('00.125'), 0.125);
  assert.equal(Num.parse('12.5'), 12.5);
});

test('Num.parse: punto + tres cifras con un grupo inicial que no es 0 sigue siendo miles', () => {
  assert.equal(Num.parse('1.250'), 1250);
  assert.equal(Num.parse('10.500'), 10500);
  assert.equal(Num.parse('1.000.000'), 1000000);
  assert.equal(Num.parse('999.999'), 999999);
  assert.equal(Num.parse('-1.250'), -1250);
  assert.equal(Num.parse('1.250,5'), 1250.5);
});

test('Num.parse: bordes de punto + cifras', () => {
  assert.equal(Num.parse('1.2345'), 1.2345);
  assert.equal(Num.parse('0.1250'), 0.125);
  // Ambiguo de verdad: «1.250» puede ser 1,25 con un cero de más o mil doscientos cincuenta. Se lee como miles
  // (es lo que escribe quien copia de una planilla argentina); «1.250» como decimal hay que escribirlo «1,25».
  assert.equal(Num.parse('1.250'), 1250);
});
