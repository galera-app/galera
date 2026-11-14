'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar } = require('./cargar.js');
const E = cargar('escandallo');

const cerca = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} no está cerca de ${b}`);
const copia = o => JSON.parse(JSON.stringify(o));

test('el ejemplo de la clase 2 (ejercicio 3): MCU $ 6.299,40 y MCU % 0,5833', () => {
  const c = E.calcular(E.EJEMPLO);
  cerca(c.inu, 10800);
  cerca(c.descuento, 7200);
  cerca(c.gastos.invendibles, 2100 * 0.046);
  cerca(c.gastos.derechos, 900, 1e-9);
  cerca(c.totalGastos, 2400.6);
  cerca(c.cdu, 4500.6);
  cerca(c.mcu, 6299.4);
  cerca(c.mcuPct, 0.5833, 1e-4);
  assert.equal(c.cpu, 2100);
  assert.equal(c.cpt, 4200000);
});

test('puntos de equilibrio: estructura, edición y absorción', () => {
  const c = E.calcular(Object.assign(copia(E.EJEMPLO), { ce: '1000000' }));
  cerca(c.pe.estructura, 1000000 / c.mcu);
  cerca(c.pe.edicion, c.cdt / c.inu);
  cerca(c.pe.absorcion, (1000000 + c.cdt) / c.inu);
  cerca(c.cgt, c.cdt + 1000000);
});

test('sin margen (MCU <= 0), el equilibrio de estructura es null, no Infinity', () => {
  const c = E.calcular(Object.assign(copia(E.EJEMPLO), { cpu: '99999', ce: '5000' }));
  assert.ok(c.mcu < 0);
  assert.equal(c.pe.estructura, null);
  assert.ok(Number.isFinite(c.pe.edicion));
});

test('modo cpt: el costo unitario es (preproducción + industrial) ÷ tirada', () => {
  const c = E.calcular(Object.assign(copia(E.EJEMPLO), { modo: 'cpt', preproduccion: '500000', industrial: '1500000', tirada: '2000' }));
  assert.equal(c.cpt, 2000000);
  assert.equal(c.cpu, 1000);
});

test('modo demanda: pliegos A3, tapa y encuadernado por ejemplar', () => {
  const d = E.porDemanda(E.EJEMPLO);   // 200 págs ÷ 8 = 25 pliegos × 100 + tapa 400 ÷ 2 + 300
  assert.equal(d.pliegos, 25);
  assert.equal(d.interior, 2500);
  assert.equal(d.tapa, 200);
  assert.equal(d.unitario, 3000);
  const c = E.calcular(Object.assign(copia(E.EJEMPLO), { modo: 'demanda', tirada: '10' }));
  assert.equal(c.ind, 30000);
  assert.equal(c.cpu, 3000);
  // sin «por pliego» ni «tapas por pliego» usa 8 y 1
  const z = E.porDemanda({ paginas: '16', precioPliego: '10', precioTapa: '5', encuadernado: '0' });
  assert.equal(z.unitario, 2 * 10 + 5);
});

test('canales: descuento y plazo ponderados por participación', () => {
  const ch = E.canales(E.EJEMPLO.canales);   // 60/30/10
  cerca(ch.desc, 0.6 * 40 + 0.3 * 50 + 0.1 * 60);
  cerca(ch.plazo, 0.6 * 60 + 0.3 * 90 + 0.1 * 30);
  assert.equal(ch.part, 100);
  assert.deepEqual(E.canales([]), { filas: [], part: 0, desc: 0, plazo: 0 });
  assert.deepEqual(E.canales(undefined), { filas: [], part: 0, desc: 0, plazo: 0 });
  const c = E.calcular(Object.assign(copia(E.EJEMPLO), { usarCanales: true }));
  cerca(c.descPct, 45);
});

test('entradas vacías, texto o cero no producen NaN ni Infinity', () => {
  const malos = (v, ruta = 'r', out = []) => {
    if (typeof v === 'number' && !Number.isFinite(v)) out.push(ruta);
    else if (v && typeof v === 'object') Object.keys(v).forEach(k => malos(v[k], ruta + '.' + k, out));
    return out;
  };
  for (const d of [{}, { modo: 'cpu' }, { modo: 'demanda' }, { pvp: 'abc', tirada: 'x' }, Object.assign(copia(E.EJEMPLO), { tirada: '0' }), Object.assign(copia(E.EJEMPLO), { pvp: '0' }),
    Object.assign(copia(E.EJEMPLO), { descuento: '100' })]) {
    assert.deepEqual(malos(E.calcular(d)), [], JSON.stringify(d).slice(0, 60));
  }
});

test('el ejemplo se lee con coma o con punto como decimal', () => {
  const a = E.calcular(Object.assign(copia(E.EJEMPLO), { invendibles: '4,6' })), b = E.calcular(Object.assign(copia(E.EJEMPLO), { invendibles: '4.6' }));
  cerca(a.mcu, b.mcu);
});

test('comparador de títulos: el ejemplo del libro (cap. 5) clasifica los siete', () => {
  const r = E.comparar(E.EJEMPLO_COMPARADOR.titulos, E.EJEMPLO_COMPARADOR);
  const por = Object.fromEntries(r.titulos.map(t => [t.t, t.cuadrante]));
  assert.deepEqual(por, { M: 'CD', N: 'CB', O: 'CB', P: 'CD', Q: 'AD', R: 'AB', S: 'AD' });
  cerca(r.titulos.find(t => t.t === 'R').mct, 20 * 500);
  assert.equal(r.qTot, 5810);
  cerca(r.titulos.reduce((s, t) => s + t.partIng, 0), 1);
  assert.notEqual(r.pe, null, 'con ventas estimadas y margen positivo hay equilibrio, aunque la estructura sea 0');
});

test('comparador: el INU tipeado manda; si no, sale del PVP y el descuento', () => {
  const r = E.comparar([{ t: 'a', pvp: '100', desc: '40', inu: '', cdu: '30', q: '10' }, { t: 'b', pvp: '100', desc: '40', inu: '70', cdu: '30', q: '10' }]);
  assert.equal(r.titulos[0].inu, 60);
  assert.equal(r.titulos[1].inu, 70);
});

test('comparador: lista vacía o filas en blanco no rompen', () => {
  assert.deepEqual(E.comparar([]).titulos, []);
  assert.equal(E.comparar([]).pe, null);
  assert.equal(E.comparar(undefined).titulos.length, 0);
  assert.equal(E.comparar([{ t: '', pvp: '', desc: '', inu: '', cdu: '', q: '' }]).titulos.length, 0, 'fila totalmente vacía se descarta');
  const r = E.comparar([{ inu: '10', cdu: '5', q: '10' }]);
  assert.equal(r.titulos[0].t, 'Título 1');
});

test('comparador: punto de equilibrio con estructura y ganancia', () => {
  const r = E.comparar(E.EJEMPLO_COMPARADOR.titulos, { ce: '100000', ganancia: '50000' });
  assert.equal(r.pe.necesario, 150000);
  cerca(r.pe.costeoDirecto.dinero, 150000 / r.mctPctP);
  cerca(r.pe.distribucion.resultado, r.mcg - 100000);
  cerca(r.pe.costeoDirecto.porTitulo.reduce((s, x) => s + x.dinero, 0), r.pe.costeoDirecto.dinero);
});
