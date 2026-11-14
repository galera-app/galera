'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../../horarios.js');

const bl = (dia, desde, hasta) => ({ dia, desde, hasta });
const com = (id, materia, tipo, ...bloques) => ({ id, materia, tipo, nombre: id, bloques });

test('min y hhmm son inversas', () => {
  assert.equal(H.min('09:30'), 570);
  assert.equal(H.min('9'), 540);
  assert.equal(H.min('00:00'), 0);
  assert.equal(H.hhmm(570), '09:30');
  assert.equal(H.hhmm(0), '00:00');
  assert.equal(H.hhmm(23 * 60 + 59), '23:59');
  for (const m of [0, 1, 59, 60, 601, 1439]) assert.equal(H.min(H.hhmm(m)), m);
});

test('sePisan: tocarse en el borde no es pisarse; otro día tampoco', () => {
  assert.equal(H.sePisan(bl(1, '10:00', '12:00'), bl(1, '12:00', '14:00')), false);
  assert.equal(H.sePisan(bl(1, '10:00', '12:00'), bl(1, '11:59', '14:00')), true);
  assert.equal(H.sePisan(bl(1, '10:00', '12:00'), bl(2, '10:00', '12:00')), false);
  assert.equal(H.sePisan(bl(1, '10:00', '14:00'), bl(1, '11:00', '12:00')), true, 'uno contiene al otro');
  assert.equal(H.sePisan(bl(1, '11:00', '12:00'), bl(1, '10:00', '14:00')), true);
});

test('choques: devuelve el tramo exacto que se pisa', () => {
  const a = com('A', 'M1', 'Teórico', bl(1, '10:00', '12:00'));
  const b = com('B', 'M2', 'Teórico', bl(1, '11:00', '13:00'), bl(3, '08:00', '09:00'));
  const c = com('C', 'M3', 'Teórico', bl(3, '09:00', '10:00'));
  const r = H.choques([a, b, c]);
  assert.equal(r.length, 1);
  assert.deepEqual([r[0].a.id, r[0].b.id, r[0].dia, r[0].desde, r[0].hasta], ['A', 'B', 1, '11:00', '12:00']);
  assert.deepEqual(H.choques([]), []);
  assert.deepEqual(H.choques([a]), []);
});

test('resumen: días, horas de clase, huecos y bloqueos', () => {
  const x = com('X', 'M1', 'Teórico', bl(1, '08:00', '10:00'), bl(1, '12:00', '14:00'));
  const y = com('Y', 'M2', 'Teórico', bl(3, '18:00', '20:00'));
  const r = H.resumen([x, y], [bl(1, '09:00', '13:00')]);
  assert.deepEqual(r.dias, [1, 3]);
  assert.equal(r.clase, 6 * 60);
  assert.equal(r.huecos, 120);
  assert.equal(r.enBloqueo, 60 + 60, 'una hora de cada bloque cae dentro del bloqueo');
  assert.equal(r.entrada, '08:00');
  assert.equal(r.salida, '20:00');
});

test('resumen: sin comisiones no inventa horarios', () => {
  assert.deepEqual(H.resumen([], []), { dias: [], clase: 0, huecos: 0, enBloqueo: 0, entrada: '', salida: '' });
  assert.equal(H.resumen([], undefined).clase, 0);
});

test('grupos: una entrada por (materia, tipo)', () => {
  const cs = [com('1', 'M', 'Teórico', bl(1, '8:00', '10:00')), com('2', 'M', 'Teórico', bl(2, '8:00', '10:00')), com('3', 'M', 'Práctico', bl(3, '8:00', '10:00')), com('4', 'Otra', 'Teórico', bl(4, '8:00', '10:00'))];
  const g = H.grupos(['M'], cs);
  assert.equal(g.length, 2);
  assert.equal(g.find(x => x.tipo === 'Teórico').opciones.length, 2);
  assert.deepEqual(H.grupos(['Inexistente'], cs), []);
});

test('sugerir: sin comisiones o sin materias, vacío y sin romper', () => {
  assert.deepEqual(H.sugerir([], []), { combinaciones: [], total: 0, recortado: false, sinChoques: false });
  assert.equal(H.sugerir(['M'], []).combinaciones.length, 0);
});

test('sugerir: prefiere la combinación sin choques', () => {
  const cs = [
    com('T1', 'A', 'Teórico', bl(1, '10:00', '12:00')),
    com('B1', 'B', 'Teórico', bl(1, '11:00', '13:00')),   // choca con T1
    com('B2', 'B', 'Teórico', bl(2, '10:00', '12:00'))
  ];
  const r = H.sugerir(['A', 'B'], cs, {}, 5);
  assert.equal(r.total, 2);
  assert.equal(r.sinChoques, true);
  assert.equal(r.combinaciones.length, 1, 'la poda deja solo lo posible');
  assert.deepEqual(r.combinaciones[0].comisiones.map(c => c.id).sort(), ['B2', 'T1']);
});

test('sugerir: si todo choca, igual devuelve combinaciones (con choques) y lo avisa', () => {
  const cs = [com('A1', 'A', 'Teórico', bl(1, '10:00', '12:00')), com('B1', 'B', 'Teórico', bl(1, '10:00', '12:00'))];
  const r = H.sugerir(['A', 'B'], cs, {}, 5);
  assert.equal(r.sinChoques, false);
  assert.equal(r.combinaciones.length, 1);
  assert.equal(r.combinaciones[0].choques.length, 1);
});

test('sugerir: respeta comisiones fijas, el bloqueo y el sábado', () => {
  const cs = [
    com('P1', 'A', 'Práctico', bl(2, '08:00', '10:00')),
    com('P2', 'A', 'Práctico', bl(6, '08:00', '10:00')),
    com('P3', 'A', 'Práctico', bl(4, '08:00', '10:00'))
  ];
  assert.equal(H.sugerir(['A'], cs, { fijas: { 'A|Práctico': 'P3' } }).combinaciones[0].comisiones[0].id, 'P3');
  const sinSab = H.sugerir(['A'], cs, { sinSabado: true }, 3).combinaciones.map(c => c.comisiones[0].id);
  assert.equal(sinSab[sinSab.length - 1], 'P2', 'el sábado queda último');
  const bloq = H.sugerir(['A'], cs, { bloqueos: [bl(2, '08:00', '10:00')] }, 3).combinaciones.map(c => c.comisiones[0].id);
  assert.notEqual(bloq[0], 'P1', 'no empieza por la que cae en un horario bloqueado');
});

test('sugerir: tope de cantidad pedido', () => {
  const cs = [];
  for (let i = 1; i <= 6; i++) cs.push(com('X' + i, 'A', 'Teórico', bl(((i - 1) % 5) + 1, '08:00', '09:00')));
  assert.equal(H.sugerir(['A'], cs, {}, 2).combinaciones.length, 2);
  assert.equal(H.sugerir(['A'], cs, {}).combinaciones.length, 5, 'por defecto, 5');
});

test('clases: primera y última fecha dentro del período, con feriados', () => {
  const c = com('A', 'M', 'Teórico', bl(1, '10:00', '12:00'));
  const per = { desde: '2026-03-16', hasta: '2026-07-03' };   // el 16/3/2026 es lunes
  const r = H.clases([c], per, ['2026-04-06', '2026-04-07', '2026-02-02', '2026-07-06']);
  assert.equal(r.length, 1);
  assert.equal(r[0].primera, '2026-03-16');
  assert.equal(r[0].ultima, '2026-06-29');
  assert.deepEqual(r[0].sin, ['2026-04-06'], 'solo el feriado que cae en lunes y dentro del período');
});

test('clases: si el período empieza otro día, la primera clase es la siguiente', () => {
  const c = com('A', 'M', 'Teórico', bl(1, '10:00', '12:00'));
  const r = H.clases([c], { desde: '2026-03-18', hasta: '2026-04-30' });   // miércoles
  assert.equal(r[0].primera, '2026-03-23');
});

test('clases: un período más corto que una semana sin ese día no da clases', () => {
  const c = com('A', 'M', 'Teórico', bl(5, '10:00', '12:00'));
  assert.deepEqual(H.clases([c], { desde: '2026-03-16', hasta: '2026-03-18' }), []);
});

test('ics: estructura, escapes, plegado a 75 bytes y fin de línea CRLF', () => {
  const largo = 'Á'.repeat(60) + ', con coma; y punto y coma\ny salto';
  const t = H.ics([
    { uid: 'u1', t: 'Clase, con; cosas', fecha: '2026-03-16', desde: '10:00', hasta: '12:00', ultima: '2026-06-29', sin: ['2026-04-06'], lugar: 'Aula 1', nota: largo },
    { uid: 'u2', t: 'Examen', fecha: '2026-07-01' }
  ], '2026-01-01');
  assert.ok(t.startsWith('BEGIN:VCALENDAR\r\n') && t.endsWith('END:VCALENDAR\r\n'));
  assert.ok(!/[^\r]\n/.test(t), 'ningún salto de línea suelto');
  for (const l of t.split('\r\n')) assert.ok(Buffer.byteLength(l) <= 75, 'línea de más de 75 bytes: ' + l);
  const plano = t.replace(/\r\n /g, '');
  assert.ok(plano.includes('SUMMARY:Clase\\, con\\; cosas'));
  assert.ok(plano.includes('\\n'), 'el salto de línea se escapa');
  assert.ok(plano.includes('DTSTAMP:20260101T000000Z'));
  assert.ok(plano.includes('DTSTART;TZID=America/Argentina/Buenos_Aires:20260316T100000'));
  assert.ok(plano.includes('RRULE:FREQ=WEEKLY;UNTIL=20260630T025959Z'), 'UNTIL es el día siguiente a las 02:59:59 UTC');
  assert.ok(plano.includes('EXDATE;TZID=America/Argentina/Buenos_Aires:20260406T100000'));
  assert.ok(plano.includes('DTSTART;VALUE=DATE:20260701') && plano.includes('DTEND;VALUE=DATE:20260702'), 'sin hora: día entero');
  assert.equal(plano.split('BEGIN:VEVENT').length - 1, 2);
  assert.equal(plano.split('END:VEVENT').length - 1, 2);
});

test('ics: un evento de día entero el último día del mes termina el primero del siguiente', () => {
  const t = H.ics([{ uid: 'v', t: 'Y', fecha: '2026-01-31' }], '2026-01-01');
  assert.ok(t.includes('DTEND;VALUE=DATE:20260201'));
});

test('ics: sin eventos es un calendario válido y vacío', () => {
  const t = H.ics([], '2026-01-01');
  assert.ok(t.includes('BEGIN:VCALENDAR') && t.includes('END:VCALENDAR') && !t.includes('VEVENT'));
});
