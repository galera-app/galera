'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar } = require('./cargar.js');
const P = cargar('papel');

const cerca = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} no está cerca de ${b}`);
const copia = o => JSON.parse(JSON.stringify(o));

test('ejemplo de la cátedra (U2-3), interior: 32 páginas por pliego, 110 resmas, 2.347,84 kg, $ 3.521.760', () => {
  const r = P.calcular(P.EJEMPLO);
  assert.equal(r.finales, 320);
  assert.equal(r.porImpresion, 32);
  assert.equal(r.pliegosLibro, 10);
  assert.equal(r.ejemplares, 5500);
  assert.equal(r.resmas, 110);
  assert.equal(r.paquetes, 110);
  cerca(r.kgResma, 21.344);
  cerca(r.kg, 2347.84);
  cerca(r.costo, 3521760, 1e-3);
  assert.deepEqual(r.cuadernillos, { lista: [{ paginas: 32, cantidad: 10 }], resto: 0 });
});

test('ejemplo de la cátedra, tapas: 6 por pliego de compra, 3 paquetes, $ 389.025', () => {
  const r = P.calcular(P.EJEMPLO_TAPA);
  assert.equal(r.porCompra, 6);
  assert.equal(r.paquetes, 3);
  cerca(r.costo, 389025, 1e-3);
});

test('páginas que no son múltiplo de 8 se completan con blancas', () => {
  const r = P.calcular(Object.assign(copia(P.EJEMPLO), { paginas: '321' }));
  assert.equal(r.finales, 328);
  assert.equal(r.blancas, 7);
  assert.equal(P.calcular(Object.assign(copia(P.EJEMPLO), { paginas: '320' })).blancas, 0);
});

test('datos faltantes: incompleto, nunca un resultado inventado', () => {
  for (const campo of ['ancho', 'alto', 'paginas', 'gramaje', 'tirada']) {
    const r = P.calcular(Object.assign(copia(P.EJEMPLO), { [campo]: '' }));
    assert.equal(r.incompleto, true, campo);
    assert.equal(r.costo, undefined, campo);
  }
  assert.equal(P.calcular({}).incompleto, true);
  assert.equal(P.calcular(Object.assign(copia(P.EJEMPLO), { formato: '', fa: '', fb: '' })).incompleto, true);
  assert.equal(P.calcular(Object.assign(copia(P.EJEMPLO), { formato: '', fa: '65', fb: '95' })).incompleto, undefined, 'formato propio');
});

test('una pieza que no entra en el pliego avisa noEntra y no divide por cero', () => {
  const r = P.calcular(Object.assign(copia(P.EJEMPLO), { ancho: '200', alto: '300' }));
  assert.equal(r.noEntra, true);
  assert.ok(!Number.isNaN(r.porImpresion));
  assert.equal(r.costo, undefined);
});

test('entran: orientación, márgenes y calles', () => {
  const m = { calle: 0, lateral: 0, pinza: 0, cola: 0 };
  assert.equal(P.entran(100, 70, 10, 10, m).piezas, 70);
  assert.equal(P.entran(70, 100, 10, 10, m).piezas, 70, 'no importa qué lado se pase primero');
  const rotada = P.entran(100, 20, 20, 100, m);
  assert.equal(rotada.piezas, 1);
  assert.equal(rotada.rotada, true);
  assert.equal(P.entran(100, 70, 10, 10, { calle: 5, lateral: 0, pinza: 0, cola: 0 }).piezas, 7 * 5, 'con 5 de calle: 7 × 10 + 6 calles = 100; 5 × 10 + 4 calles = 70');
  assert.equal(P.entran(10, 10, 20, 20, m).piezas, 0, 'pieza más grande que el pliego');
});

test('potencia: la mayor potencia de 2 que no pasa', () => {
  assert.deepEqual([0, 0.5, 1, 2, 3, 7, 8, 9, 1000].map(P.potencia), [0, 0, 1, 2, 2, 4, 8, 8, 512]);
});

test('imponer: cortes por mitad y por cuarto', () => {
  const m = { calle: 0, lateral: 0, pinza: 0, cola: 0 };
  assert.deepEqual(P.imponer(65, 95, 2, { w: 10, h: 10 }, m).impresion, { a: 65, b: 47.5 });
  assert.deepEqual(P.imponer(65, 95, 4, { w: 10, h: 10 }, m).impresion, { a: 32.5, b: 47.5 });
  assert.deepEqual(P.imponer(95, 65, 1, { w: 10, h: 10 }, m).impresion, { a: 65, b: 95 });
  const r = P.imponer(100, 70, 1, { w: 10, h: 10, soloPotencia: true }, m);
  assert.equal(r.encajan, 70);
  assert.equal(r.usadas, 64, 'en interiores solo se usa una potencia de 2');
});

test('cuadernillos: pliegos enteros y los más chicos que completan, nunca menos de 8', () => {
  assert.deepEqual(P.cuadernillos(320, 32), { lista: [{ paginas: 32, cantidad: 10 }], resto: 0 });
  assert.deepEqual(P.cuadernillos(40, 32), { lista: [{ paginas: 32, cantidad: 1 }, { paginas: 8, cantidad: 1 }], resto: 0 });
  assert.deepEqual(P.cuadernillos(36, 32), { lista: [{ paginas: 32, cantidad: 1 }], resto: 4 });
  assert.deepEqual(P.cuadernillos(0, 32), { lista: [], resto: 0 });
});

test('lomo: hojas × espesor', () => {
  cerca(P.lomo(320, 100), 1.6);
  cerca(P.lomo('320', '100'), 1.6);
  assert.equal(P.lomo('', ''), 0);
});

test('comparar: ordena del más barato al más caro y marca el mejor', () => {
  const f = P.comparar(P.EJEMPLO);
  assert.equal(f.length, P.FORMATOS.length);
  const ok = f.filter(x => !x.noEntra);
  assert.ok(ok.length > 0);
  assert.equal(ok[0].mejor, true);
  assert.equal(ok.filter(x => x.mejor).length, 1);
  for (let i = 1; i < ok.length; i++) assert.ok(ok[i].costo >= ok[i - 1].costo);
  assert.equal(ok[0].difPct, 0);
  assert.deepEqual(P.comparar({}), []);
  // los que no entran van al final
  const idx = f.findIndex(x => x.noEntra);
  if (idx >= 0) f.slice(idx).forEach(x => assert.equal(x.noEntra, true));
});

test('márgenes en blanco usan los de la cátedra; un cero explícito se respeta', () => {
  assert.deepEqual(P.calcular(Object.assign(copia(P.EJEMPLO), { calle: '', pinza: '' })).m, { calle: 1, lateral: 1, pinza: 3, cola: 2 });
  assert.equal(P.calcular(Object.assign(copia(P.EJEMPLO), { calle: '0' })).m.calle, 0);
  assert.equal(P.calcular(Object.assign(copia(P.EJEMPLO), { calle: '-3' })).m.calle, 0, 'un margen negativo no existe');
});

test('forzar fija las páginas por pliego de impresión', () => {
  const r = P.calcular(Object.assign(copia(P.EJEMPLO), { forzar: '16' }));
  assert.equal(r.porImpresion, 16);
  assert.equal(r.pliegosLibro, 20);
});
