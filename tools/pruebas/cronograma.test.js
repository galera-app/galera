'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar } = require('./cargar.js');
const C = cargar('cronograma');

const cerca = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} no está cerca de ${b}`);
const T = (id, d, ...pre) => ({ id, t: 'Tarea ' + id, d, pre });

test('el ejemplo: 67 días y la ruta por corrección, diagramación y pruebas', () => {
  const r = C.calcular(C.EJEMPLO, 'gantt');
  assert.equal(r.total, 67);
  assert.deepEqual(r.ruta, ['T1', 'T2', 'T3', 'T5', 'T6', 'T7', 'T9', 'T10', 'T11']);
  assert.deepEqual(r.criticas, r.ruta);
  const por = Object.fromEntries(r.tareas.map(v => [v.id, v]));
  assert.equal(por.T4.hol, 17, 'diseño de tapa: 45 − 28');
  assert.equal(por.T8.hol, 20, 'ISBN: 45 − 25');
  assert.equal(por.T2.es, 5);
  assert.equal(por.T11.ef, 67);
});

test('holgura libre nunca supera a la total, y las críticas tienen holgura cero', () => {
  const r = C.calcular(C.EJEMPLO, 'gantt');
  r.tareas.forEach(v => { assert.ok(v.hl <= v.hol + 1e-9, v.id); assert.ok(v.hol >= -1e-9, v.id); });
  r.tareas.filter(v => v.crit).forEach(v => assert.equal(v.hol, 0));
});

test('PERT: duración esperada (a + 4m + b) ÷ 6 y varianza ((b − a) ÷ 6)²', () => {
  const p = C.pertDe({ a: 3, m: 5, b: 10 });
  cerca(p.te, 5.5);
  cerca(p.v, (7 / 6) ** 2);
  assert.equal(p.ok, true);
  assert.deepEqual(C.pertDe({ d: 4 }), { te: 4, v: 0, ok: false }, 'sin estimaciones usa la duración fija');
  assert.equal(C.pertDe({ a: 2, b: 4 }).te, 3, 'sin probable usa el punto medio');
  assert.deepEqual(C.pertDe({}), { te: 0, v: 0, ok: false });
});

test('PERT del ejemplo: la probabilidad crece con el plazo', () => {
  const total = C.pert(C.EJEMPLO).total;
  assert.ok(total > 60 && total < 80);
  const base = C.pert(C.EJEMPLO, total);
  cerca(base.prob, 0.5, 0.01);
  assert.ok(C.pert(C.EJEMPLO, total + 20).prob > base.prob);
  assert.ok(C.pert(C.EJEMPLO, total - 20).prob < base.prob);
  assert.equal(C.pert(C.EJEMPLO).prob, null, 'sin plazo no hay probabilidad');
  assert.ok(base.desvio > 0);
});

test('PERT sin variación: la probabilidad es 0 o 1', () => {
  const ts = [T('A', 5), T('B', 5, 'A')];
  assert.equal(C.pert(ts, 10).prob, 1);
  assert.equal(C.pert(ts, 9).prob, 0);
});

test('normal: valores conocidos y simetría', () => {
  cerca(C.normal(0), 0.5, 1e-6);
  cerca(C.normal(1.96), 0.975, 1e-3);
  cerca(C.normal(-1.96), 0.025, 1e-3);
  for (const z of [0.3, 1, 2.5]) cerca(C.normal(z) + C.normal(-z), 1, 1e-6);
  assert.ok(C.normal(10) > 0.9999999 && C.normal(-10) < 1e-7);
});

test('errores claros: ciclo, predecesora inexistente, id repetido, autodependencia', () => {
  assert.match(C.calcular([T('A', 1, 'B'), T('B', 1, 'A')], 'gantt').error, /ciclo/);
  assert.match(C.calcular([T('A', 1, 'Z')], 'gantt').error, /no existe/);
  assert.match(C.calcular([T('A', 1), T('A', 2)], 'gantt').error, /mismo identificador/);
  assert.match(C.calcular([T('A', 1, 'A')], 'gantt').error, /sí misma/);
  assert.equal(C.pert([T('A', 1, 'Z')]).error !== undefined, true);
  assert.equal(C.comparar([T('A', 1, 'Z')]).error !== undefined, true);
  assert.deepEqual(C.niveles([T('A', 1, 'Z')]), {});
});

test('sin tareas: total cero, sin romper', () => {
  const r = C.calcular([], 'gantt');
  assert.equal(r.total, 0);
  assert.deepEqual(r.tareas, []);
  assert.deepEqual(r.ruta, []);
});

test('tareas en paralelo: la más larga es la crítica', () => {
  const r = C.calcular([T('A', 3), T('B', 7), T('C', 2, 'A', 'B')], 'gantt');
  assert.equal(r.total, 9);
  assert.deepEqual(r.ruta, ['B', 'C']);
  assert.equal(r.tareas.find(v => v.id === 'A').hol, 4);
});

test('tareas «no aplica» duran cero y no atrasan', () => {
  const r = C.calcular([Object.assign(T('A', 50), { na: 1 }), T('B', 3, 'A')], 'gantt');
  assert.equal(r.total, 3);
});

test('relaciones SS, FF y con retardo', () => {
  const ss = C.calcular([T('A', 10), { id: 'B', t: 'B', d: 5, pre: [{ id: 'A', tipo: 'SS', lag: 2 }] }], 'gantt');
  assert.equal(ss.tareas[1].es, 2);
  assert.equal(ss.total, 10);
  const ff = C.calcular([T('A', 10), { id: 'B', t: 'B', d: 4, pre: [{ id: 'A', tipo: 'FF', lag: 0 }] }], 'gantt');
  assert.equal(ff.tareas[1].es, 6, 'B termina junto con A');
  const fs = C.calcular([T('A', 3), { id: 'B', t: 'B', d: 2, pre: [{ id: 'A', tipo: 'FS', lag: 4 }] }], 'gantt');
  assert.equal(fs.tareas[1].es, 7);
  const neg = C.calcular([T('A', 5), { id: 'B', t: 'B', d: 2, pre: [{ id: 'A', tipo: 'FS', lag: -2 }] }], 'gantt');
  assert.equal(neg.tareas[1].es, 3, 'solapamiento por retardo negativo');
  assert.deepEqual(C.rels({ pre: [{ id: 'A', tipo: 'XX', lag: 'zzz' }, 'B'] }), [{ id: 'A', tipo: 'FS', lag: 0 }, { id: 'B', tipo: 'FS', lag: 0 }]);
});

test('niveles: la columna de cada tarea en la red', () => {
  assert.deepEqual(C.niveles([T('A', 1), T('B', 1, 'A'), T('C', 1, 'A'), T('D', 1, 'B', 'C')]), { A: 0, B: 1, C: 1, D: 2 });
});

test('comparar: los tres métodos con las mismas tareas', () => {
  const r = C.comparar(C.EJEMPLO, 70);
  assert.equal(r.gantt.total, 67);
  assert.equal(r.igualRutaGR, true);
  assert.ok(r.pert.prob > 0 && r.pert.prob < 1);
});

test('días hábiles: saltan fines de semana y feriados', () => {
  assert.equal(C.sumarHabiles('2026-03-20', 1), '2026-03-23', 'viernes + 1 = lunes');
  assert.equal(C.sumarHabiles('2026-03-21', 0), '2026-03-23', 'desde un sábado arranca el lunes');
  assert.equal(C.sumarHabiles('2026-03-20', 1, ['2026-03-23']), '2026-03-24');
  assert.equal(C.sumarHabiles('2026-03-16', 5), '2026-03-23');
  assert.equal(C.restarHabiles('2026-03-23', 1), '2026-03-20');
  assert.equal(C.restarHabiles('2026-03-22', 0), '2026-03-20', 'desde un domingo, el viernes anterior');
  assert.equal(C.habilesEntre('2026-03-20', '2026-03-23'), 1);
  assert.equal(C.habilesEntre('2026-03-23', '2026-03-20'), -1);
  assert.equal(C.habilesEntre('2026-03-16', '2026-03-16'), 0);
  assert.equal(C.habilesEntre('2026-03-16', '2026-03-23', ['2026-03-18']), 4);
  // ida y vuelta
  const f = C.sumarHabiles('2026-03-16', 37, ['2026-04-02', '2026-04-03']);
  assert.equal(C.restarHabiles(f, 37, ['2026-04-02', '2026-04-03']), '2026-03-16');
});

test('fechas: hacia adelante y hacia atrás desde una fecha de entrega', () => {
  const res = C.calcular([T('A', 3), T('B', 2, 'A')], 'gantt');
  const f = C.fechas(res, 'desde', '2026-03-16');
  assert.equal(f.inicio, '2026-03-16');
  assert.equal(f.tareas[0].desde, '2026-03-16');
  assert.equal(f.tareas[0].hasta, '2026-03-18');
  assert.equal(f.tareas[1].desde, '2026-03-19');
  assert.equal(f.fin, '2026-03-20');
  const h = C.fechas(res, 'hasta', '2026-03-20', [], '2026-03-18');
  assert.equal(h.inicio, '2026-03-16');
  assert.equal(h.fin, '2026-03-20');
  assert.equal(h.llega, false, 'empezaría antes de hoy');
  assert.deepEqual(h.tarde, ['A']);
  assert.equal(C.fechas(res, 'desde', ''), null);
  assert.equal(C.fechas({ error: 'x' }, 'desde', '2026-03-16'), null);
  assert.equal(C.fechas(null, 'desde', '2026-03-16'), null);
});

test('CSV: BOM, separador «;», comillas escapadas y fin de línea CRLF', () => {
  const ts = [{ id: 'T1', t: 'Una; con "comillas"', d: 3, pre: [] }, { id: 'T2', t: 'Dos', d: 2, pre: ['T1'] }];
  const res = C.calcular(ts, 'gantt');
  const csv = C.aCsv(ts, res, C.fechas(res, 'desde', '2026-03-16'));
  assert.ok(csv.startsWith('﻿N.º;Fase;Tarea'));
  assert.ok(csv.endsWith('\r\n'));
  assert.ok(csv.includes('"Una; con ""comillas"""'));
  const filas = csv.trim().split('\r\n');
  assert.equal(filas.length, 3);
  assert.ok(filas[2].split(';').includes('1'), 'la previa de Dos es la tarea n.º 1');
  assert.ok(C.aCsv([], null, null).includes('N.º'));
});

test('ICS del cronograma: un evento por tarea, sin las que no aplican', () => {
  const ts = [{ id: 'T1', t: 'Uno, dos', d: 3, pre: [] }, { id: 'T2', t: 'Dos', d: 2, pre: ['T1'], na: 1 }, { id: 'T3', t: 'Tres', d: 2, pre: ['T1'], q: 'Ana; Beto' }];
  const res = C.calcular(ts, 'gantt');
  const ics = C.aIcs(ts, C.fechas(res, 'desde', '2026-03-16'), 'Libro');
  assert.equal(ics.split('BEGIN:VEVENT').length - 1, 2);
  assert.ok(ics.includes('SUMMARY:Libro: Uno\\, dos'));
  assert.ok(ics.includes('DESCRIPTION:Responsable: Ana\\; Beto'));
  assert.ok(ics.includes('DTSTART;VALUE=DATE:20260316'));
  assert.ok(ics.includes('DTEND;VALUE=DATE:20260319'), 'termina el día siguiente al último (3 días hábiles: 16, 17 y 18)');
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
});

test('sanear: lo que viene de afuera se reconstruye', () => {
  assert.deepEqual(C.sanear(null), []);
  assert.deepEqual(C.sanear('x'), []);
  assert.deepEqual(C.sanear({}), []);
  const r = C.sanear([{ id: 'A', t: 'uno', d: '3', pre: [] }, { id: 'A', t: 'dos', d: '2', pre: ['A', 'Z', 'A_'] }, null, 7, { t: 'sin id', pre: 'no es lista' }]);
  assert.equal(r.length, 3);
  assert.equal(new Set(r.map(x => x.id)).size, 3, 'ids únicos');
  assert.deepEqual(r[1].pre, ['A'], 'sin autodependencia ni inexistentes (A_ es el id nuevo de sí misma)');
  assert.equal(C.sanear(Array.from({ length: 100 }, (_, i) => ({ id: 'x' + i, t: 'x' }))).length, 60, 'tope por defecto');
  assert.equal(C.sanear(Array.from({ length: 100 }, (_, i) => ({ id: 'x' + i, t: 'x' })), 5).length, 5);
  const sucio = C.sanear([{ id: 'a<b>', t: '<img>', q: '<x>', f: 'Z', d: '12abc' }])[0];
  assert.ok(!/[<>]/.test(JSON.stringify(sucio)), 'sin < ni >');
  assert.equal(sucio.f, '');
});
