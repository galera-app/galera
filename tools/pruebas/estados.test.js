'use strict';
// Estados de ejemplo de cursada.v1 (tools/estados/*.json) contra normalizar() de app.js.
// normalizar() vive dentro de app.js (461 KB, con DOM): no se puede requerir. Se recorta su texto entre dos marcas
// (de «const juegoVacio» a «function cargarEstado») y se corre en un contexto aislado con los stubs mínimos (ESTADOS, uid
// y, según el caso, los módulos Papel, Paginacion, Cronograma y Arcade). Si app.js cambia de lugar esas marcas, la prueba falla fuerte.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { cargar, raiz } = require('./cargar.js');

const app = fs.readFileSync(path.join(raiz, 'app.js'), 'utf8');
const linea = re => { const m = app.match(re); assert.ok(m, 'no encontré en app.js: ' + re); return m[0]; };
const desde = app.indexOf('const juegoVacio'), hasta = app.indexOf('function cargarEstado');
assert.ok(desde > 0 && hasta > desde, 'cambiaron las marcas de normalizar() en app.js');
const FUENTE = [linea(/^const ESTADOS = .*$/m), linea(/^const uid = .*$/m), app.slice(desde, hasta), '({ normalizar, estadoVacio })'].join('\n');

function contexto(conModulos) {
  const g = { console };
  if (conModulos) { g.Papel = cargar('papel'); g.Paginacion = cargar('paginacion'); g.Cronograma = cargar('cronograma'); g.Arcade = cargar('arcade'); }
  const ctx = vm.createContext(g);
  return vm.runInContext(FUENTE, ctx, { filename: 'app.js(normalizar)' });
}
const CON = contexto(true), SIN = contexto(false);
const j = x => JSON.parse(JSON.stringify(x));   // pasa por JSON: lo que exporta e importa la app, y de paso saca los objetos del contexto aislado
const norm = (N, raw) => j(N.normalizar(j(raw)));
const exportarImportar = (N, estado) => norm(N, JSON.parse(JSON.stringify(estado, null, 1)));   // exportar() hace stringify(E, null, 1); importar() parsea y normaliza

const DIR = path.join(raiz, 'tools', 'estados');
const ARCHIVOS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
const leer = f => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
const RE_ID = /^(?!__proto__$|constructor$|prototype$)[\w.-]{1,60}$/;
const objetoPlano = v => v && typeof v === 'object' && !Array.isArray(v);

test('hay entre 5 y 8 estados de ejemplo, todos JSON válidos con v: 1 o un caso roto a propósito', () => {
  assert.ok(ARCHIVOS.length >= 5 && ARCHIVOS.length <= 8, ARCHIVOS.join());
  ARCHIVOS.forEach(f => assert.equal(typeof leer(f), 'object', f));
});

for (const f of ARCHIVOS) {
  test(`${f}: se normaliza sin errores, con y sin los módulos cargados`, () => {
    const raw = leer(f);
    for (const N of [CON, SIN]) {
      const n = norm(N, raw);
      assert.equal(n.v, 1);
      assert.ok(objetoPlano(n.materias), 'importar() exige materias como objeto');
    }
  });

  test(`${f}: no pierde ninguna materia ni nota válida`, () => {
    const raw = leer(f), n = norm(CON, raw);
    const validas = Object.keys(raw.materias || {}).filter(id => RE_ID.test(id) && objetoPlano(raw.materias[id]));
    assert.ok(validas.length <= 200);
    for (const id of validas) {
      assert.ok(Object.prototype.hasOwnProperty.call(n.materias, id), `se perdió la materia ${id}`);
      const nota = raw.materias[id].nota;
      if (typeof nota === 'string' && /^\d{1,2}(,\d{1,2})?$/.test(nota)) assert.equal(n.materias[id].nota, nota, `nota de ${id}`);
      const e = raw.materias[id].estado;
      if (['pendiente', 'cursando', 'regular', 'aprobada'].includes(e)) assert.equal(n.materias[id].estado, e, `estado de ${id}`);
      const ex = (Array.isArray(raw.materias[id].examenes) ? raw.materias[id].examenes : []).filter(objetoPlano);
      assert.equal(n.materias[id].examenes.length, Math.min(ex.length, 60), `exámenes de ${id}`);
    }
    // nada que no estuviera: ni materias inventadas ni las claves peligrosas
    // (un valor que es una lista, como «0914»: [], hoy se acepta como materia vacía y pendiente: es lenient pero inofensivo)
    assert.deepEqual(Object.keys(n.materias).filter(id => !validas.includes(id) && !(RE_ID.test(id) && Array.isArray(raw.materias[id]))), []);
    assert.equal(Object.prototype.hasOwnProperty.call(n.materias, '__proto__'), false);
    assert.equal(({}).estado, undefined, 'no se contaminó Object.prototype');
  });

  test(`${f}: exportar e importar devuelve lo mismo (y normalizar es idempotente)`, () => {
    const raw = leer(f);
    for (const N of [CON, SIN]) {
      const a = norm(N, raw);
      assert.deepEqual(exportarImportar(N, a), a, 'exportar → importar');
      assert.deepEqual(norm(N, a), a, 'normalizar dos veces');
    }
  });

  test(`${f}: el estado normalizado entra en un QR o link sin cambios de forma (solo tipos JSON)`, () => {
    const a = norm(CON, leer(f));
    assert.deepEqual(a, JSON.parse(JSON.stringify(a)));
    assert.ok(JSON.stringify(a).length < 600000);
  });
}

test('01-vacio: queda igual que el estado vacío de la app', () => {
  // salvo juego.aprob: sin bloque «juego» queda en null a propósito (la primera vez se anotan las ya aprobadas sin hacer ruido)
  const esperado = j(CON.estadoVacio()); esperado.juego.aprob = null;
  assert.deepEqual(norm(CON, leer('01-vacio.json')), esperado);
});

test('02-a-medias: los campos que faltan (juego, arcade, lecturas, invitación…) se completan', () => {
  const n = norm(CON, leer('02-a-medias.json'));
  assert.deepEqual(Object.keys(n.materias), ['ipc', 'icse', '0902']);
  assert.equal(n.materias.ipc.aprobada, '2025-07-15');
  assert.deepEqual(n.materias['0902'].aplazos, ['1']);
  assert.deepEqual(n.lecturas, {});
  assert.equal(n.invitacion, '');
  assert.equal(n.descarga, '');
  assert.equal(n.juego.on, true);
  assert.equal(n.juego.aprob, null, 'sin dato de juego: la primera vez se anotan las aprobadas sin hacer ruido');
  assert.deepEqual(n.arcade, { ini: '', mejores: {} });
});

test('03-campos-desconocidos: lo que la app no conoce se descarta y lo válido se conserva', () => {
  const n = norm(CON, leer('03-campos-desconocidos.json'));
  for (const k of ['tema', 'ultimaVisita', 'version']) assert.ok(!(k in n), 'quedó ' + k);
  for (const k of ['favorita', 'color', 'comision']) assert.ok(!(k in n.materias.ipc) && !(k in n.materias['0911']), 'quedó ' + k);
  assert.ok(!('prioridad' in n.materias['0905']));
  assert.ok(!('recordar' in n.materias['0911'].examenes[0]));
  assert.ok(!('margenObjetivo' in n.escandallo));
  assert.ok(!('orden' in n.horarios['2026-2c']));
  assert.ok(!('puntos' in n.juego) && !('racha' in n.juego));
  assert.equal(n.perfil, 'profesional');
  assert.equal(n.materias.ipc.nota, '9');
  assert.equal(n.materias['0911'].examenes[0].fecha, '2026-09-28');
  assert.deepEqual(n.horarios['2026-2c'].elegidas, { '0911|Teórico': 'c1' });
  assert.equal(n.escandallo.invendibles, '4,6');
  assert.deepEqual(n.juego.aprob, ['ipc']);
});

test('04-roto-tipos: tipos equivocados se corrigen o se descartan, sin tirar errores', () => {
  const n = norm(CON, leer('04-roto-tipos.json'));
  assert.equal(n.perfil, '');
  assert.equal(n.vioAyuda, true, 'cualquier valor verdadero cuenta como visto');
  assert.equal(n.materias.ipc.nota, '8');
  assert.equal(n.materias.icse.estado, 'pendiente', 'estado inventado');
  // Una nota que llega como NÚMERO (8) pasa el control (la regex la convierte a texto al probarla) y se guarda tal cual, como número.
  // Es inofensivo (todo el código la pasa por String), pero no coincide con «la nota es un texto».
  assert.equal(String(n.materias.icse.nota), '8');
  assert.equal(n.materias.icse.aprobada, '');
  assert.deepEqual(n.materias.icse.aplazos, []);
  assert.deepEqual(n.materias.icse.examenes, []);
  for (const mal of ['0902', '0913', 'id con espacios', '__proto__', 'constructor']) assert.equal(Object.prototype.hasOwnProperty.call(n.materias, mal), false, mal);
  assert.equal(n.materias['0915'].examenes.length, 2, 'solo los objetos');
  const [x, y] = n.materias['0915'].examenes;
  assert.ok(/^[\w.-]+$/.test(x.id), 'un id inválido se reemplaza');
  assert.deepEqual([x.fecha, x.hora, x.nota, x.tipo], ['', '', '', 'Otro']);
  assert.deepEqual([y.tipo, y.fecha, y.hora], ['Final', '2026-12-10', '10:30']);
  assert.equal(n.escandallo.modo, 'cpu');
  assert.equal(n.escandallo.pvp, '', 'un número no es un texto de cifras');
  assert.equal(n.escandallo.tirada, '', 'nada de «<script>»');
  assert.deepEqual(n.escandallo.canales, []);
  assert.deepEqual(n.comparador, { ce: '', ganancia: '', titulos: [] }, 'una lista cuenta como objeto: queda un comparador vacío');
  assert.equal(n.papel, null);
  assert.equal(n.paginacion, null);
  assert.deepEqual(n.horarios.b.propias, [], 'un bloque con la hora al revés no cuenta');
  assert.deepEqual(n.horarios.b.materias, []);
  assert.deepEqual(n.horarios.b.elegidas, {});
  assert.deepEqual(n.horarios.b.bloqueos, [{ dia: 1, desde: '08:00', hasta: '09:00', t: '' }]);
  assert.ok(!('a' in n.horarios));
  assert.deepEqual(n.leidos, {});
  assert.deepEqual(n.lecturas, {});
  assert.deepEqual(n.practica, { '0911/e1/2': [1, 2, '2026-01-01'] });
  assert.equal(n.descarga, '');
  assert.equal(n.invitacion, '');
  assert.equal(n.copia, '');
  assert.deepEqual(n.arcade, { ini: '', mejores: {} });
  assert.equal(n.juego.ultimo, '');
  assert.deepEqual(n.juego.hitos, []);
  assert.deepEqual(n.juego.rondas, {});
});

test('05-completo-actual: lo que la app guarda hoy vuelve igual', () => {
  const raw = leer('05-completo-actual.json'), n = norm(CON, raw);
  assert.deepEqual(n.leidos, raw.leidos);
  assert.deepEqual(n.practica, raw.practica);
  assert.deepEqual(n.lecturas, raw.lecturas);
  assert.deepEqual(n.arcade, raw.arcade);
  assert.deepEqual(n.comparador, raw.comparador);
  assert.deepEqual(n.juego, raw.juego);
  assert.deepEqual(n.paginacion.partes, raw.paginacion.partes);
  assert.equal(n.paginacion.multiplo, '32');
  assert.equal(n.papel.formato, '65x95');
  assert.equal(n.papel.cola, '1.5');
  assert.equal(n.escandallo.pvp, '18.000');
  assert.deepEqual(n.escandallo.canales, raw.escandallo.canales);
  assert.deepEqual(n.cronograma.tareas.map(t => t.id), ['T1', 'T2']);
  assert.deepEqual(n.cronograma.tareas[1].pre, ['T1']);
  assert.deepEqual(n.horarios['2026-2c'].bloqueos, raw.horarios['2026-2c'].bloqueos);
  assert.equal(n.horarios['2026-2c'].propias[0].propia, true);
  assert.deepEqual(n.materias, Object.assign({}, ...Object.entries(raw.materias).map(([id, m]) => ({ [id]: Object.assign({ opcion: '', detalle: '', nota: '', cuando: '', aprobada: '', apuntes: '', aplazos: [], examenes: [] }, m) }))));
  assert.equal(n.descarga, 'A5');
  assert.equal(n.invitacion, 'cerrada');
});

test('05-completo-actual sin los módulos cargados: papel, paginación, cronograma y arcade pasan tal cual y se sanean al llegar', () => {
  const raw = leer('05-completo-actual.json');
  const sin = norm(SIN, raw), con = norm(CON, sin);
  assert.deepEqual(sin.papel, raw.papel);
  assert.deepEqual(sin.cronograma, raw.cronograma);
  assert.deepEqual(sin.arcade, raw.arcade);
  assert.equal(con.papel.formato, '65x95');
  assert.deepEqual(con, norm(CON, raw), 'cargar los módulos después da lo mismo que haberlos tenido desde el principio');
});

test('06-grande: entra todo lo que está dentro de los topes', () => {
  const raw = leer('06-grande.json'), n = norm(CON, raw);
  assert.equal(Object.keys(n.materias).length, Object.keys(raw.materias).length);
  assert.equal(Object.keys(n.horarios).length, 40);
  assert.equal(Object.keys(n.leidos).length, Object.keys(raw.leidos).length);
  assert.equal(Object.keys(n.practica).length, Object.keys(raw.practica).length);
  assert.equal(n.juego.hitos.length, 60);
  assert.equal(n.materias.ipc.examenes.length, 10);
  assert.equal(n.materias.ipc.apuntes.length, Math.min(raw.materias.ipc.apuntes.length, 5000), 'apuntes con tope de 5.000 caracteres');
});

test('los topes recortan sin romper: 250 materias, 70 exámenes, 4.000 preguntas', () => {
  const raw = { v: 1, materias: {}, practica: {} };
  for (let i = 0; i < 250; i++) raw.materias['m' + i] = { estado: 'aprobada' };
  raw.materias.m0.examenes = Array.from({ length: 70 }, (_, i) => ({ id: 'e' + i, tipo: 'Parcial' }));
  for (let i = 0; i < 4000; i++) raw.practica[`a/b/${i % 9999}`] = [1, 1, '2026-01-01'];
  const n = norm(CON, raw);
  assert.equal(Object.keys(n.materias).length, 200);
  assert.equal(n.materias.m0.examenes.length, 60);
  assert.equal(Object.keys(n.practica).length, 3000);
  assert.deepEqual(exportarImportar(CON, n), n);
});

test('entradas que no son un estado: devuelven el estado vacío', () => {
  const vacio = j(CON.estadoVacio());
  for (const x of [null, undefined, 5, 'texto', true]) assert.deepEqual(j(CON.normalizar(x)), vacio, String(x));
  const sinJuego = j(CON.estadoVacio()); sinJuego.juego.aprob = null;
  assert.deepEqual(norm(CON, []), sinJuego, 'una lista tampoco trae materias');
});
