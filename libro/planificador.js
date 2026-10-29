// Planificador de libros (Cursada): pantalla del cronograma editorial profesional.
// Las cuentas están en /cursada/cronograma.js; las plantillas, en plantillas.json (las arma libro_plantillas.py).
// Sin cuentas ni servidor: todo queda en este navegador (localStorage 'cursada.libro.v1'). Código MIT; plantillas CC BY (Fidel Chaves · Cursada).
(function () {
  'use strict';
  var KEY1 = 'cursada.libro.v1', KEY = 'cursada.libro.v2', MAX_LIBROS = 20;
  var BASE = '/';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var hoyISO = function () { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  var fmtF = function (s) { return s ? s.split('-').reverse().join('/') : ''; };
  var f1 = function (v) { return String(Math.round(v * 10) / 10).replace('.', ','); };
  var NOMBRES_TIPO = { FS: 'termina → empieza', SS: 'empieza → empieza', FF: 'termina → termina', SF: 'empieza → termina' };

  var P = null;            // plantillas.json
  var FERIADOS = [];       // 'AAAA-MM-DD'
  var ANIOS_FERIADOS = 0;  // último año con feriados publicados
  var S = null;            // el libro abierto (un elemento de C.libros)
  var C = null;            // el catálogo: { v, activo, vista, filtro, verRol, libros }
  var raiz = $('#planificador');
  var crT;

  function estadoNuevo(id) {
    var pl = P.plantillas.filter(function (x) { return x.id === id; })[0] || P.plantillas[0];
    return { v: 1, lid: lidLibre(), plantilla: pl.id, titulo: '', modo: 'desde', fecha: hoyISO(), metodo: 'gantt', plazo: '', equipo: {}, plegadas: {}, seg: {}, base: null, tareas: Cronograma.sanear(pl.tareas.map(function (t) { return Object.assign({}, t); }), 200) };
  }
  var ISO = /^\d{4}-\d{2}-\d{2}$/, IDT = /^[\w-]{1,12}$/;
  // Seguimiento: por id de tarea, avance (0-100) y fechas reales. Línea base: fechas planeadas al momento de fijarla.
  function segLimpio(r) {
    var o = {}; if (!r || typeof r !== 'object') return o;
    Object.keys(r).slice(0, 200).forEach(function (k) {
      var v = r[k]; if (!IDT.test(k) || !v || typeof v !== 'object') return;
      var av = Math.max(0, Math.min(100, Math.round(+v.av) || 0)), q = {};
      if (av) q.av = av; if (ISO.test(v.ri)) q.ri = v.ri; if (ISO.test(v.rf)) q.rf = v.rf;
      if (Object.keys(q).length) o[k] = q;
    });
    return o;
  }
  function baseLimpia(r) {
    if (!r || typeof r !== 'object' || !ISO.test(r.fecha) || !r.t || typeof r.t !== 'object') return null;
    var t = {};
    Object.keys(r.t).slice(0, 200).forEach(function (k) { var v = r.t[k]; if (IDT.test(k) && Array.isArray(v) && ISO.test(v[0]) && ISO.test(v[1])) t[k] = [v[0], v[1]]; });
    return Object.keys(t).length ? { fecha: r.fecha, t: t } : null;
  }
  function lidLibre() { var n = 1; while (C && C.libros.some(function (l) { return l.lid === 'L' + n; })) n++; return 'L' + n; }
  function normalizar(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var ok = P.plantillas.some(function (p) { return p.id === raw.plantilla; });
    var iso = /^\d{4}-\d{2}-\d{2}$/, equipo = {};
    if (raw.equipo && typeof raw.equipo === 'object') Object.keys(P.roles).forEach(function (k) { var v = String(raw.equipo[k] || '').replace(/[<>;,]/g, '').trim().slice(0, 40); if (v) equipo[k] = v; });
    return {
      v: 1, lid: /^L\d{1,3}$/.test(raw.lid) ? raw.lid : '', plantilla: ok ? raw.plantilla : 'blanco', titulo: String(raw.titulo || '').replace(/[<>]/g, '').slice(0, 80),
      modo: raw.modo === 'hasta' ? 'hasta' : 'desde', fecha: iso.test(raw.fecha) ? raw.fecha : hoyISO(),
      metodo: ['gantt', 'pert', 'roy'].indexOf(raw.metodo) >= 0 ? raw.metodo : 'gantt', plazo: String(raw.plazo || '').replace(/[^\d.,]/g, '').slice(0, 6),
      equipo: equipo, plegadas: raw.plegadas && typeof raw.plegadas === 'object' ? raw.plegadas : {}, tareas: Cronograma.sanear(raw.tareas, 200), seg: segLimpio(raw.seg), base: baseLimpia(raw.base)
    };
  }
  // Arma el catálogo desde lo guardado: un catálogo v2 o, si viene de la v1, un libro solo.
  function normalizarC(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var lista = Array.isArray(raw.libros) ? raw.libros : (raw.tareas ? [raw] : []), vistos = {}, libros = [];
    lista.slice(0, MAX_LIBROS).forEach(function (r) {
      var l = normalizar(r); if (!l) return;
      if (!l.lid || vistos[l.lid]) { var n = 1; while (vistos['L' + n]) n++; l.lid = 'L' + n; }
      vistos[l.lid] = 1; libros.push(l);
    });
    if (!libros.length) return null;
    var verRol = !!raw.verRol || (!raw.libros && lista.length && !!lista[0].verRol);
    return { v: 2, activo: vistos[raw.activo] ? raw.activo : libros[0].lid, vista: raw.vista === 'catalogo' ? 'catalogo' : 'libro', filtro: String(raw.filtro || '').replace(/[<>]/g, '').slice(0, 40), verRol: verRol, seguir: !!raw.seguir, libros: libros };
  }
  function guardar() { try { localStorage.setItem(KEY, JSON.stringify(C)); } catch (e) { /* sin almacenamiento: sigue andando */ } }
  function cargar() {
    try { var c = normalizarC(JSON.parse(localStorage.getItem(KEY))); if (c) return c; } catch (e) { /* se prueba con la v1 */ }
    try { return normalizarC(JSON.parse(localStorage.getItem(KEY1))); } catch (e) { return null; }
  }
  function abrir(lid) { var l = C.libros.filter(function (x) { return x.lid === lid; })[0]; if (l) { S = l; C.activo = l.lid; } }

  // ---------- responsables ----------
  // Quién hace una tarea: lo que se escribió en «Responsable» o, si está vacío, quien cubre el rol sugerido en el equipo del libro.
  function quienes(x, L) {
    var r = String(x.r || '').split(/[,;]+/).map(function (s) { return s.trim(); }).filter(Boolean);
    if (r.length) return r;
    var out = [];
    String(x.q || '').split(/[,;\s]+/).forEach(function (c) { var n = (L.equipo || {})[c]; if (n && out.indexOf(n) < 0) out.push(n); });
    return out;
  }
  function coincide(x, L) {
    var f = C.filtro; if (!f || !C.verRol) return true;
    var q = quienes(x, L);
    return f === '_sin' ? !q.length : q.some(function (n) { return n.toLowerCase() === f.toLowerCase(); });
  }
  function personas() {
    var vistos = {}, out = [];
    C.libros.forEach(function (L) { L.tareas.forEach(function (x) { if (x.na) return; quienes(x, L).forEach(function (n) { var k = n.toLowerCase(); if (!vistos[k]) { vistos[k] = 1; out.push(n); } }); }); });
    return out.sort(function (a, b) { return a.localeCompare(b, 'es'); });
  }
  function rolesTxt(q) { return String(q || '').split(/[,;\s]+/).filter(Boolean).map(function (c) { return P.roles[c] || c; }).join(', '); }
  function rolesDe(L) { var v = {}; L.tareas.forEach(function (x) { if (!x.na) String(x.q || '').split(/[,;\s]+/).forEach(function (c) { if (P.roles[c]) v[c] = 1; }); }); return Object.keys(P.roles).filter(function (c) { return v[c]; }); }

  // ---------- utilidades de tareas ----------
  var nro = function (id) { var i = S.tareas.findIndex(function (x) { return x.id === id; }); return i < 0 ? '?' : String(i + 1); };
  function preTexto(x) {
    return Cronograma.rels(x).map(function (q) { return nro(q.id) + (q.tipo === 'FS' && !q.lag ? '' : q.tipo + (q.lag ? (q.lag > 0 ? '+' : '') + q.lag : '')); }).join(', ');
  }
  function preLeer(txt, x) {
    var out = [], vistos = {};
    String(txt).split(/[,;\s]+/).forEach(function (tk) {
      var m = /^(\d{1,3})(FS|SS|FF|SF)?([+-]\d{1,3})?$/i.exec(tk.trim());
      if (!m) return;
      var y = S.tareas[parseInt(m[1], 10) - 1];
      if (!y || y === x) return;
      var tipo = (m[2] || 'FS').toUpperCase(), lag = m[3] ? parseInt(m[3], 10) : 0, k = y.id + tipo;
      if (vistos[k]) return; vistos[k] = 1;
      out.push(tipo === 'FS' && !lag ? y.id : { id: y.id, tipo: tipo, lag: lag });
    });
    return out;
  }
  function fases() { return P.fases.concat([{ id: '', t: 'Otras tareas' }]); }

  // ---------- cálculo ----------
  function calcular() {
    var ts = S.tareas;
    if (!ts.length) return { vacio: true };
    var res = S.metodo === 'pert' ? Cronograma.pert(ts, S.plazo) : Cronograma.calcular(ts, S.metodo);
    if (res.error) return { error: res.error };
    var fe = Cronograma.fechas(res, S.modo, S.fecha, FERIADOS, hoyISO());
    return { res: res, fe: fe };
  }
  var porId = function (arr) { var m = {}; arr.forEach(function (v) { m[v.id] = v; }); return m; };

  // ---------- pantalla ----------
  function boton(acc, t, cls, extra) { return '<button type="button" class="btn ' + (cls || '') + ' ch" data-acc="' + acc + '"' + (extra || '') + '>' + t + '</button>'; }

  function vista() {
    var chips = P.plantillas.map(function (p) {
      return '<button type="button" class="btn ' + (p.id === S.plantilla ? '' : 'sec') + ' ch" data-acc="plantilla" data-id="' + esc(p.id) + '" aria-pressed="' + (p.id === S.plantilla) + '" title="' + esc(p.d) + '">' + esc(p.t) + '</button>';
    }).join('');
    var pl = P.plantillas.filter(function (p) { return p.id === S.plantilla; })[0];
    var met = [['gantt', 'Gantt'], ['pert', 'PERT'], ['roy', 'Roy']].map(function (m) {
      return '<button type="button" class="btn ' + (S.metodo === m[0] ? '' : 'sec') + ' ch" data-acc="metodo" data-id="' + m[0] + '" aria-pressed="' + (S.metodo === m[0]) + '">' + m[1] + '</button>';
    }).join('');
    return tusLibros() + (C.vista === 'catalogo' ? catalogoVista() : libroVista(chips, pl, met)) +
      '<section class="tarjeta no-imprimir"><h2>' + (C.vista === 'catalogo' ? '2' : '4') + '. Guardar y exportar</h2>' +
      '<div class="fila">' + boton('pdf', 'Imprimir o guardar PDF', 'sec') + (C.vista === 'catalogo' ? '' : boton('ics', 'Calendario (.ics)', 'sec') + boton('csv', 'Planilla (.csv)', 'sec')) + boton('json', 'Copia completa (.json)', 'sec') +
      '<label class="btn lin ch" for="lb-importar">Abrir una copia (.json)</label><input id="lb-importar" type="file" accept="application/json,.json" class="solo-lector"></div>' +
      '<p class="chico tenue" style="margin:8px 0 0">Tus datos quedan solo en este navegador. La copia .json trae todos tus libros y te deja pasarlos a otro dispositivo o guardarlos; al abrirla, los libros se suman a los que ya tenés. El .ics y el .csv son del libro abierto y traen fechas solo si cargaste una fecha de inicio o de salida.</p></section>';
  }

  function tusLibros() {
    var chipsL = C.libros.map(function (l, n) {
      var on = C.vista === 'libro' && l.lid === C.activo;
      return '<button type="button" class="btn ' + (on ? '' : 'sec') + ' ch" data-acc="abrir" data-id="' + l.lid + '" aria-pressed="' + on + '">' + esc(l.titulo || 'Libro ' + (n + 1)) + '</button>';
    }).join('');
    var gente = personas();
    var filtro = C.verRol ? '<div class="campo-esc"><label class="c" for="lb-filtro">Ver solo las tareas de</label><select id="lb-filtro" data-f="filtro"><option value="">Todo el equipo</option>' +
      gente.map(function (n) { return '<option value="' + esc(n) + '"' + (n.toLowerCase() === C.filtro.toLowerCase() ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') +
      '<option value="_sin"' + (C.filtro === '_sin' ? ' selected' : '') + '>Sin responsable</option></select></div>' : '';
    return '<section class="tarjeta no-imprimir"><h2>Tus libros</h2>' +
      '<p class="chico tenue" style="margin:4px 0 8px">Cada libro tiene su cronograma. El <b>catálogo</b> los junta en una sola línea de tiempo, con una barra por título y sus hitos.</p>' +
      '<div class="fila" role="group" aria-label="Libros">' + boton('catalogo', '📚 Catálogo', C.vista === 'catalogo' ? '' : 'sec', ' aria-pressed="' + (C.vista === 'catalogo') + '"') + chipsL +
      boton('nuevo', '+ Libro nuevo', 'lin') + boton('duplicar', 'Duplicar este', 'lin') + boton('borrar', 'Quitar este', 'lin') + '</div>' +
      '<div class="fila" style="margin:10px 0 0"><label class="elige"><input type="checkbox" data-f="verRol"' + (C.verRol ? ' checked' : '') + '> Mostrar responsables</label><label class="elige"><input type="checkbox" data-f="seguir"' + (C.seguir ? ' checked' : '') + '> Seguimiento (avance, fechas reales y línea base)</label></div>' + (filtro ? '<div class="dos">' + filtro + '</div>' : '') + '</section>';
  }

  function libroVista(chips, pl, met) {
    return '<section class="tarjeta no-imprimir"><h2>1. Tu libro</h2>' +
      '<p class="chico tenue" style="margin:4px 0 8px">Partí de una plantilla: es el proceso completo, del original a la liquidación de derechos y la reimpresión. Podés sacar, sumar y cambiar lo que quieras; cada tarea se puede marcar «no aplica».</p>' +
      '<div class="fila" role="group" aria-label="Plantilla">' + chips + '</div>' +
      (pl ? '<p class="chico tenue" style="margin:8px 0 0">' + esc(pl.d) + '</p>' : '') +
      '<div class="dos"><div class="campo-esc"><label class="c" for="lb-titulo">Título del libro</label><input id="lb-titulo" data-f="titulo" value="' + esc(S.titulo) + '" placeholder="opcional" maxlength="80"></div>' +
      '<div class="campo-esc"><label class="c" for="lb-modo">Calendario</label><select id="lb-modo" data-f="modo"><option value="desde"' + (S.modo === 'desde' ? ' selected' : '') + '>Desde una fecha de inicio</option><option value="hasta"' + (S.modo === 'hasta' ? ' selected' : '') + '>Hacia atrás, desde la fecha de salida</option></select></div>' +
      '<div class="campo-esc"><label class="c" for="lb-fecha">' + (S.modo === 'hasta' ? 'Fecha de salida (fin)' : 'Fecha de inicio') + '</label><input id="lb-fecha" type="date" data-f="fecha" value="' + esc(S.fecha) + '"></div>' +
      '<div class="campo-esc"><label class="c" for="lb-plazo">Plazo para PERT (días hábiles)</label><input id="lb-plazo" data-f="plazo" inputmode="numeric" value="' + esc(S.plazo) + '" placeholder="opcional"></div></div>' +
      '<p class="chico tenue" style="margin:6px 0 0">Los días son hábiles: se saltean sábados, domingos y feriados nacionales.</p></section>' +
      '<section class="tarjeta"><div class="titulo-sec"><h2>2. El cronograma</h2></div>' +
      '<div class="fila no-imprimir" role="group" aria-label="Método" style="margin:6px 0 10px">' + met + boton('plegar', 'Plegar fases', 'lin') + boton('desplegar', 'Ver todas las tareas', 'lin') + '</div>' +
      '<div id="lb-res" aria-live="polite">' + resultado() + '</div></section>' +
      '<section class="tarjeta no-imprimir"><h2>3. Las tareas</h2>' +
      '<p class="chico tenue" style="margin:4px 0 8px">Cada tarea tiene su duración en días hábiles (en PERT, optimista, probable y pesimista) y las <b>previas</b>: el número de la tarea de la que depende. Para otros tipos de dependencia, sumá el tipo y el retardo: <code>12</code> (termina → empieza), <code>12SS+3</code> (empieza 3 días después de que empiece la 12), <code>12FF</code> (termina junto con la 12), <code>12SF-2</code> (empieza → termina). Las duraciones son <b>orientativas</b>: ajustalas a tu equipo.</p>' +
      equipoVista() + '<div id="lb-tareas">' + tablaTareas() + '</div></section>';
  }

  function tablaTareas() {
    var ts = S.tareas, usaPert = S.metodo === 'pert';
    if (!ts.length) return '<p class="vacio">Sin tareas: elegí una plantilla o sumá una.</p>';
    return fases().map(function (fa) {
      var lista = ts.map(function (x, i) { return { x: x, i: i }; }).filter(function (o) { return (o.x.f || '') === fa.id && coincide(o.x, S); });
      if (!lista.length && (fa.id === '' || C.filtro)) return '';
      var filas = lista.map(function (o) {
        var x = o.x, i = o.i, info = (P.info || {})[x.id], tpl = x.hito ? ' <span class="chip tin">hito</span>' : '';
        var cols = ['a', 'm', 'b'].map(function (k) { return usaPert ? '<td class="ctl" data-l="' + { a: 'Optimista', m: 'Probable', b: 'Pesimista' }[k] + '"><input class="nota" inputmode="decimal" data-i="' + i + '" data-k="' + k + '" aria-label="Estimación ' + { a: 'optimista', m: 'probable', b: 'pesimista' }[k] + ' de la tarea ' + (i + 1) + '" value="' + esc(x[k]) + '"></td>' : ''; }).join('');
        return '<tr class="' + (x.na ? 'lb-na' : '') + '"><td class="ctl"><b>' + (i + 1) + '</b></td>' +
          '<td class="cr-nombre"><input class="nota" data-i="' + i + '" data-k="t" aria-label="Nombre de la tarea ' + (i + 1) + '" value="' + esc(x.t) + '">' + tpl + (info ? ' <button type="button" class="enlace chico" data-acc="info" data-i="' + i + '" aria-expanded="false">Más</button>' : '') + '</td>' +
          '<td class="ctl" data-l="Días"><input class="nota" inputmode="decimal" data-i="' + i + '" data-k="d" aria-label="Duración en días de la tarea ' + (i + 1) + '" value="' + esc(x.d) + '"></td>' + cols +
          '<td class="ctl" data-l="Previas"><input class="nota" data-i="' + i + '" data-k="pre" aria-label="Previas de la tarea ' + (i + 1) + '" value="' + esc(preTexto(x)) + '" placeholder="—"></td>' +
          (C.seguir ? seguimientoCeldas(x, i) : '') +
          (C.verRol ? '<td class="ctl" data-l="Responsable"><input class="nota" list="lb-personas" data-i="' + i + '" data-k="r" aria-label="Responsable de la tarea ' + (i + 1) + '" value="' + esc(x.r) + '" placeholder="' + esc(quienes({ q: x.q }, S).join(', ') || '—') + '">' + (x.q ? '<small class="chico tenue lb-rol">' + esc(rolesTxt(x.q)) + '</small>' : '') + '</td>' : '') +
          '<td class="ctl"><label class="elige"><input type="checkbox" data-i="' + i + '" data-k="na"' + (x.na ? ' checked' : '') + ' aria-label="No aplica a la tarea ' + (i + 1) + '"> No aplica</label></td>' +
          '<td class="ctl"><button type="button" class="btn lin ch" data-acc="quitar" data-i="' + i + '" aria-label="Quitar la tarea ' + (i + 1) + '">✕</button></td></tr>' +
          (info ? '<tr class="lb-info" hidden id="lb-info-' + i + '"><td></td><td colspan="13" class="chico tenue">' + esc(info.desc) + '<br><b>Fuente:</b> ' + esc(info.src) + (x.ver ? ' <span class="chip ojo">duración orientativa, sin confirmar</span>' : '') + '</td></tr>' : '');
      }).join('');
      var cab = '<th>N.º</th><th>Tarea</th><th>Días</th>' + (usaPert ? '<th>a</th><th>m</th><th>b</th>' : '') + '<th>Previas</th>' + (C.seguir ? '<th>Avance %</th><th>Empezó</th><th>Terminó</th>' : '') + (C.verRol ? '<th>Responsable <span class="chico tenue">(rol sugerido)</span></th>' : '') + '<th></th><th></th>';
      return '<details class="lb-fase" open><summary><b>' + (fa.id ? fa.id + ' · ' : '') + esc(fa.t) + '</b> <span class="chico tenue">(' + lista.length + ')</span></summary>' +
        '<div class="tabla-scroll"><table class="tabla cr-tareas"><thead><tr>' + cab + '</tr></thead><tbody>' + filas + '</tbody></table></div>' +
        '<p style="margin:6px 0 12px"><button type="button" class="btn lin ch" data-acc="sumar" data-f="' + fa.id + '">+ Tarea en esta fase</button></p></details>';
    }).join('');
  }

  function seguimientoCeldas(x, i) {
    var q = S.seg[x.id] || {};
    var f = function (k, etq) { return '<td class="ctl" data-l="' + etq + '"><input class="nota" type="date" data-s="' + k + '" data-i="' + i + '" aria-label="' + etq + ' la tarea ' + (i + 1) + '" value="' + esc(q[k] || '') + '"></td>'; };
    return '<td class="ctl" data-l="Avance %"><input class="nota lb-av" inputmode="numeric" data-s="av" data-i="' + i + '" aria-label="Avance en porcentaje de la tarea ' + (i + 1) + '" value="' + esc(q.av || '') + '" placeholder="0"></td>' + f('ri', 'Fecha en que empezó') + f('rf', 'Fecha en que terminó');
  }
  // Avance de una lista de tareas, ponderado por duración (si todas duran 0, por cantidad).
  function avanceDe(ids, dur) {
    var tot = 0, ok = 0, n = 0, suma = 0;
    ids.forEach(function (id) { var av = (S.seg[id] || {}).av || 0; tot += dur[id]; ok += dur[id] * av / 100; n++; suma += av; });
    return tot > 0 ? ok / tot * 100 : n ? suma / n : 0;
  }
  function segResumen(res, fe) {
    var H = hoyISO(), fd = fe ? porId(fe.tareas) : {}, dur = {}, ids = [], hechas = 0, atras = 0;
    res.tareas.forEach(function (v) {
      if (v.na) return; dur[v.id] = v.dur || 0; ids.push(v.id);
      var av = (S.seg[v.id] || {}).av || 0;
      if (av >= 100) hechas++; else if (fd[v.id] && fd[v.id].hasta < H) atras++;
    });
    var dato = function (b, t) { return '<div class="dato"><b>' + b + '</b><span>' + t + '</span></div>'; };
    var out = '<div class="pag-datos no-imprimir">' + dato(Math.round(avanceDe(ids, dur)) + ' %', 'de avance') + dato(hechas + ' de ' + ids.length, 'tareas hechas') + (fe ? dato(atras, 'atrasadas (debían estar hechas)') : '');
    var b = S.base, nota = '';
    if (b && fe) {
      var fin = ids.map(function (id) { return b.t[id] && b.t[id][1]; }).filter(Boolean).sort().slice(-1)[0];
      if (fin) { var dd = Cronograma.habilesEntre(fin, fe.fin, FERIADOS); out += dato((dd > 0 ? '+' : '') + dd, 'días hábiles vs. la línea base'); }
      nota = 'Línea base fijada el ' + fmtF(b.fecha) + '. ';
    }
    out += '</div>';
    return out + '<div class="fila no-imprimir" style="margin:6px 0">' + boton('base', b ? 'Volver a fijar la línea base' : 'Fijar línea base', 'sec') + (b ? boton('sinbase', 'Quitar la línea base', 'lin') : '') + '</div>' +
      '<p class="chico tenue no-imprimir" style="margin:0 0 6px">' + nota + 'La <b>línea base</b> guarda las fechas planeadas de hoy para compararlas con lo que pase después (la raya fina bajo cada barra). Las fechas del plan no se corren solas con el avance: si el proyecto se atrasa, cambiá la fecha de inicio o las duraciones y mirá el desvío contra la base.</p>';
  }
  // Quién cubre cada rol en este libro: rellena las tareas que no tienen responsable propio.
  function equipoVista() {
    if (!C.verRol) return '';
    var roles = rolesDe(S);
    var opts = '<datalist id="lb-personas">' + personas().map(function (n) { return '<option value="' + esc(n) + '">'; }).join('') + '</datalist>';
    if (!roles.length) return opts;
    return opts + '<details class="lb-equipo"><summary><b>Equipo del libro</b> <span class="chico tenue">(quién cubre cada rol)</span></summary>' +
      '<p class="chico tenue" style="margin:6px 0">Escribí un nombre por rol y se asigna a todas las tareas de ese rol que no tengan responsable propio. Después podés cambiar tarea por tarea. Con dos nombres en una tarea, separalos con coma.</p>' +
      '<div class="dos">' + roles.map(function (c) { return '<div class="campo-esc"><label class="c" for="lb-eq-' + c + '">' + esc(P.roles[c]) + '</label><input id="lb-eq-' + c + '" list="lb-personas" data-eq="' + c + '" maxlength="40" value="' + esc((S.equipo || {})[c] || '') + '" placeholder="nombre"></div>'; }).join('') + '</div></details>';
  }

  // ---------- catálogo: una barra por título, con sus hitos ----------
  function aDia(iso) { var p = iso.split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]) / 864e5; }
  function deDia(n) { var d = new Date(n * 864e5); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0'); }
  function calcularDe(L) {
    var ts = L.tareas; if (!ts.length) return { vacio: true };
    var res = L.metodo === 'pert' ? Cronograma.pert(ts, L.plazo) : Cronograma.calcular(ts, L.metodo === 'roy' ? 'roy' : 'gantt');
    if (res.error) return { error: res.error };
    return { res: res, fe: Cronograma.fechas(res, L.modo, L.fecha, FERIADOS, hoyISO()) };
  }
  function catalogoVista() {
    return '<section class="tarjeta"><div class="titulo-sec"><h2>1. El catálogo</h2></div>' +
      '<p class="chico tenue no-imprimir" style="margin:4px 0 8px">Cada barra va de la primera a la última tarea del libro, según su fecha de inicio o de salida; los rombos son los hitos (contrato, ISBN, imprenta, lanzamiento…). Tocá el nombre para abrir el cronograma de ese libro.</p>' +
      '<div id="lb-res" aria-live="polite">' + catalogo() + '</div></section>';
  }
  function catalogo() {
    var filas = [], sin = [], H = hoyISO(), filtrando = !!(C.filtro && C.verRol);
    C.libros.forEach(function (L, n) {
      var nombre = L.titulo || 'Libro ' + (n + 1), c = calcularDe(L);
      if (c.vacio || c.error || !c.fe) return sin.push(nombre + (c.error ? ' (error en las dependencias)' : c.vacio ? ' (sin tareas)' : ' (sin fecha)'));
      var fd = porId(c.fe.tareas), visibles = L.tareas.filter(function (x) { return !x.na && coincide(x, L); });
      if (!visibles.length) return;
      var desde = visibles.map(function (x) { return fd[x.id].desde; }).sort()[0], hasta = visibles.map(function (x) { return fd[x.id].hasta; }).sort().slice(-1)[0];
      var hitos = visibles.filter(function (x) { return x.hito; }).map(function (x) { return { t: x.t, f: fd[x.id].hasta }; });
      filas.push({ lid: L.lid, nombre: nombre, desde: desde, hasta: hasta, hitos: hitos, tarde: !c.fe.llega && L.modo === 'hasta', n: visibles.length });
    });
    var avisoSin = sin.length ? '<p class="chico tenue" style="margin:8px 0 0">No se dibujan: ' + esc(sin.join('; ')) + '.</p>' : '';
    if (!filas.length) return '<p class="vacio">' + (filtrando ? 'Ningún libro tiene tareas para ese filtro.' : 'Sumá un libro con tareas y fecha para verlo acá.') + '</p>' + avisoSin;
    var min = Math.min.apply(null, filas.map(function (f) { return aDia(f.desde); })), max = Math.max.apply(null, filas.map(function (f) { return aDia(f.hasta); })), T = Math.max(max - min + 1, 1);
    var corta = function (iso) { return T > 330 ? fmtF(iso).slice(0, 6) + iso.slice(2, 4) : fmtF(iso).slice(0, 5); };
    var hoyD = aDia(H), marca = hoyD >= min && hoyD <= max ? '<span class="lb-hoy" data-izq="' + ((hoyD - min) / T * 100) + '" data-ancho="0" title="Hoy" aria-hidden="true"></span>' : '';
    var eje = '<div class="lb-eje" aria-hidden="true">';
    for (var k = 0; k <= 6; k++) eje += '<span data-p="' + (k / 6 * 100) + '">' + corta(deDia(Math.round(min + (T - 1) * k / 6))) + '</span>';
    eje += '</div>';
    var cuerpo = filas.map(function (f) {
      var izq = (aDia(f.desde) - min) / T * 100, ancho = Math.max((aDia(f.hasta) - aDia(f.desde) + 1) / T * 100, 0.8);
      var rombos = f.hitos.map(function (h) { return '<span class="lb-hito" data-izq="' + ((aDia(h.f) - min + 0.5) / T * 100) + '" data-ancho="0" title="' + esc(h.t + ' · ' + fmtF(h.f)) + '"></span>'; }).join('');
      return '<div class="cr-fila" role="listitem"><span class="cr-nom"><button type="button" class="lb-fase-bt" data-acc="abrir" data-id="' + f.lid + '">' + esc(f.nombre) + '</button></span>' +
        '<span class="cr-pista"><span class="cr-barra ' + (f.tarde ? 'tarde' : 'fase') + '" data-izq="' + izq + '" data-ancho="' + ancho + '" title="' + esc(f.nombre) + '"></span>' + rombos + marca + '</span>' +
        '<span class="cr-dias chico tenue">' + corta(f.desde) + '–' + corta(f.hasta) + (filtrando ? '<br>' + f.n + ' tareas' : '') + '</span></div>';
    }).join('');
    return (filtrando ? '<p class="chico" style="margin:0 0 6px">Solo las tareas de <b>' + esc(C.filtro === '_sin' ? 'nadie (sin responsable)' : C.filtro) + '</b>.</p>' : '') + eje + '<div class="cr-gantt lb-gantt" role="list">' + cuerpo + '</div>' +
      '<p class="chico tenue" style="margin:8px 0 0"><span class="cr-barra fase cr-ref"></span> Libro (de la primera a la última tarea) · <span class="lb-hito cr-ref"></span> Hito · <span class="lb-hoy cr-ref"></span> Hoy · <span class="cr-barra tarde cr-ref"></span> Ya no llega a la fecha de salida</p>' + avisoSin;
  }

  // ---------- resultados ----------
  function resultado() {
    if (C.vista === 'catalogo') return catalogo();
    var c = calcular();
    if (c.vacio) return '<p class="vacio">Sumá tareas para ver el cronograma.</p>';
    if (c.error) return '<p class="chico alerta" style="margin:0">⚠ ' + esc(c.error) + '</p>';
    var res = c.res, fe = c.fe, ts = S.tareas, T = res.total || 1, H = hoyISO();
    var dato = function (b, t) { return '<div class="dato"><b>' + b + '</b><span>' + t + '</span></div>'; };
    var criticas = res.tareas.filter(function (v) { return v.crit && !v.na; }).length;
    var out = '<div class="pag-datos">' + dato(f1(res.total), 'días hábiles en total') + (fe ? dato(fmtF(fe.inicio), 'inicio') + dato(fmtF(fe.fin), 'fin') : '') + dato(criticas, 'tareas críticas') +
      (S.metodo === 'pert' && res.prob != null ? dato(Math.round(res.prob * 100) + ' %', 'de llegar en ' + S.plazo + ' días') : '') + '</div>';
    if (S.titulo) out = '<p class="chico" style="margin:0 0 6px"><b>' + esc(S.titulo) + '</b></p>' + out;
    if (C.filtro && C.verRol) out = '<p class="chico" style="margin:0 0 6px">Solo las tareas de <b>' + esc(C.filtro === '_sin' ? 'nadie (sin responsable)' : C.filtro) + '</b> (las fechas y la ruta crítica son las del libro entero).</p>' + out;
    if (fe && S.modo === 'hasta' && !fe.llega) {
      var falta = Cronograma.habilesEntre(H, fe.inicio, FERIADOS);
      out += '<p class="chico alerta" style="margin:8px 0">⚠ Para salir el ' + fmtF(S.fecha) + ' tendrías que haber empezado el ' + fmtF(fe.inicio) + ': hoy faltan ' + Math.abs(falta) + ' días hábiles. ' + fe.tarde.length + ' tareas (en rojo) ya no llegan: acortá duraciones, superponé tareas o corré la fecha.</p>';
    } else if (fe && S.modo === 'hasta') {
      out += '<p class="chico" style="margin:8px 0">Para salir el ' + fmtF(S.fecha) + ' tenés que empezar el <b>' + fmtF(fe.inicio) + '</b>. Hoy te sobran ' + Cronograma.habilesEntre(H, fe.inicio, FERIADOS) + ' días hábiles.</p>';
    }
    if (fe && ANIOS_FERIADOS && parseInt(fe.fin.slice(0, 4), 10) > ANIOS_FERIADOS) {
      out += '<p class="chico tenue" style="margin:6px 0">Los feriados de ' + (ANIOS_FERIADOS + 1) + ' todavía no están publicados: las fechas de ese año no los descuentan.</p>';
    }
    if (C.seguir) out += segResumen(res, fe);
    if (S.metodo === 'gantt') return out + gantt(res, fe, T);
    return out + red(res, S.metodo) + tablaCritica(res);
  }

  function ejeX(fe, T) {
    var n = 6, marcas = '';
    for (var k = 0; k <= n; k++) {
      var d = Math.round(T * k / n);
      var t = fe ? fmtF(Cronograma.sumarHabiles(fe.inicio, Math.min(d, Math.max(0, Math.ceil(T) - 1)), FERIADOS)).slice(0, 5) : 'd' + d;
      marcas += '<span data-p="' + (k / n * 100) + '">' + esc(t) + '</span>';
    }
    return '<div class="lb-eje" aria-hidden="true">' + marcas + '</div>';
  }

  function gantt(res, fe, T) {
    var por = porId(res.tareas), fechaDe = fe ? porId(fe.tareas) : {}, ts = S.tareas, imprimiendo = !!window.__lbImprimiendo;
    var filas = '';
    fases().forEach(function (fa) {
      var lista = ts.map(function (x, i) { return { x: x, i: i }; }).filter(function (o) { return (o.x.f || '') === fa.id && !o.x.na && coincide(o.x, S); });
      if (!lista.length) return;
      var es = Math.min.apply(null, lista.map(function (o) { return por[o.x.id].es; })), ef = Math.max.apply(null, lista.map(function (o) { return por[o.x.id].ef; }));
      var crit = lista.some(function (o) { return por[o.x.id].crit; }), tarde = lista.some(function (o) { return fechaDe[o.x.id] && fechaDe[o.x.id].tarde; });
      var plegada = !imprimiendo && S.plegadas[fa.id || '_'];
      var desde = fe ? lista.map(function (o) { return fechaDe[o.x.id].desde; }).sort()[0] : '', hasta = fe ? lista.map(function (o) { return fechaDe[o.x.id].hasta; }).sort().slice(-1)[0] : '';
      var dFa = {}; lista.forEach(function (o) { dFa[o.x.id] = por[o.x.id].dur || 0; });
      var sgF = C.seguir ? { pct: avanceDe(lista.map(function (o) { return o.x.id; }), dFa) } : null;
      filas += barra((plegada ? '▸ ' : '▾ ') + (fa.id ? fa.id + ' · ' : '') + fa.t, es, ef, T, crit, tarde, true, fe ? fmtF(desde).slice(0, 5) + '–' + fmtF(hasta).slice(0, 5) : f1(es) + '–' + f1(ef), 'plegarfase', fa.id || '_', plegada, 0, sgF);
      if (!plegada) lista.forEach(function (o) {
        var v = por[o.x.id], fd = fechaDe[o.x.id];
        filas += barra((o.i + 1) + '. ' + o.x.t, v.es, v.ef, T, v.crit, fd && fd.tarde, false, fd ? fmtF(fd.desde).slice(0, 5) + '–' + fmtF(fd.hasta).slice(0, 5) : f1(v.es) + '–' + f1(v.ef), '', '', false, v.hol, C.seguir ? segBarra(o.x.id, fe) : null);
      });
    });
    return ejeX(fe, T) + '<div class="cr-gantt lb-gantt" role="list">' + filas + '</div>' +
      '<p class="chico tenue" style="margin:8px 0 0"><span class="cr-barra crit cr-ref"></span> Ruta crítica · <span class="cr-barra cr-ref"></span> Con holgura · <span class="cr-barra tarde cr-ref"></span> Ya no llega · <span class="cr-hol cr-ref"></span> Margen que puede demorarse' + (C.seguir ? ' · <span class="lb-prog cr-ref"></span> Avance · <span class="lb-base cr-ref"></span> Línea base · <span class="lb-real cr-ref"></span> Real' : '') + '</p>';
  }
  // Posiciones (en días hábiles desde el inicio) de la línea base y de las fechas reales de una tarea.
  function segBarra(id, fe) {
    var q = S.seg[id] || {}, o = { pct: q.av || 0 };
    if (!fe) return o;
    var pos = function (d) { return Cronograma.habilesEntre(fe.inicio, d, FERIADOS); }, b = S.base && S.base.t[id];
    if (b) o.base = [pos(b[0]), pos(b[1]) + 1];
    if (q.ri) o.real = [pos(q.ri), (q.rf ? pos(q.rf) : Math.max(pos(q.ri), pos(hoyISO()))) + 1];
    return o;
  }
  function barra(nombre, es, ef, T, crit, tarde, esFase, rotulo, acc, id, plegada, hol, sg) {
    var extra = '', pctTxt = '';
    if (sg) {
      if (sg.pct > 0) extra += '<span class="lb-prog" data-izq="' + (es / T * 100) + '" data-ancho="' + (Math.max((ef - es) / T * 100, 0.8) * Math.min(sg.pct, 100) / 100) + '"></span>';
      var tramo = function (cls, r) { var a = Math.max(0, Math.min(T, r[0])), z = Math.max(a, Math.min(T, r[1])); return z > a ? '<span class="' + cls + '" data-izq="' + (a / T * 100) + '" data-ancho="' + ((z - a) / T * 100) + '"></span>' : ''; };
      if (sg.base) extra += tramo('lb-base', sg.base);
      if (sg.real) extra += tramo('lb-real', sg.real);
      pctTxt = '<br>' + Math.round(sg.pct) + ' %';
    }
    var left = es / T * 100, ancho = Math.max((ef - es) / T * 100, 0.8);
    var tag = acc ? '<button type="button" class="lb-fase-bt" data-acc="' + acc + '" data-id="' + esc(id) + '" aria-expanded="' + !plegada + '">' + esc(nombre) + '</button>' : esc(nombre);
    return '<div class="cr-fila ' + (esFase ? 'lb-esfase' : '') + '" role="listitem"><span class="cr-nom">' + tag + '</span>' +
      '<span class="cr-pista"><span class="cr-barra ' + (tarde ? 'tarde' : crit ? 'crit' : '') + (esFase ? ' fase' : '') + '" data-izq="' + left + '" data-ancho="' + ancho + '" title="' + esc(nombre) + '"></span>' +
      (hol > 0 ? '<span class="cr-hol" data-izq="' + (ef / T * 100) + '" data-ancho="' + (hol / T * 100) + '"></span>' : '') + extra + '</span>' +
      '<span class="cr-dias chico tenue">' + esc(rotulo) + pctTxt + '</span></div>';
  }

  // Red de la ruta crítica (en un proyecto de 100 tareas, la red completa no se lee: se dibuja lo que manda).
  function red(res, tipo) {
    var por = porId(res.tareas), ts = S.tareas, ruta = res.ruta.filter(function (id) { return !por[id].na || por[id].dur > 0; }).slice(0, 60);
    if (!ruta.length) return '';
    var W = 178, Hh = 74, GX = 40;
    var nodos = ruta.map(function (id, k) {
      var v = por[id], x = 10 + k * (W + GX), y = 10, i = ts.findIndex(function (z) { return z.id === id; }) + 1, nom = v.t.length > 23 ? v.t.slice(0, 22) + '…' : v.t;
      var l2 = tipo === 'roy'
        ? '<text x="' + (x + 8) + '" y="' + (y + 44) + '" class="cr-t2">T: ' + f1(v.es) + ' · ' + f1(v.ef) + '</text><text x="' + (x + 8) + '" y="' + (y + 60) + '" class="cr-t2">L: ' + f1(v.ls) + ' · ' + f1(v.lf) + ' · h ' + f1(v.hol) + '</text>'
        : '<text x="' + (x + 8) + '" y="' + (y + 44) + '" class="cr-t2">te ' + f1(v.dur) + ' · σ² ' + f1(v.varianza || 0) + '</text><text x="' + (x + 8) + '" y="' + (y + 60) + '" class="cr-t2">' + f1(v.es) + ' → ' + f1(v.ef) + '</text>';
      var flecha = k ? '<path d="M' + (x - GX) + ' ' + (y + Hh / 2) + ' H' + x + '" class="cr-arco crit" marker-end="url(#lb-fl)"/>' : '';
      return flecha + '<g><rect x="' + x + '" y="' + y + '" width="' + W + '" height="' + Hh + '" rx="8" class="cr-nodo crit"/><text x="' + (x + 8) + '" y="' + (y + 20) + '" class="cr-t1">' + i + '. ' + esc(nom) + '</text>' + l2 + '</g>';
    }).join('');
    var ancho = 20 + ruta.length * W + (ruta.length - 1) * GX;
    return '<h3 style="margin:12px 0 6px">Ruta crítica (' + ruta.length + ' tareas)</h3><div class="cr-red" tabindex="0" role="img" aria-label="Ruta crítica de ' + ruta.length + ' tareas"><svg viewBox="0 0 ' + ancho + ' ' + (Hh + 20) + '" width="' + ancho + '" height="' + (Hh + 20) + '"><defs><marker id="lb-fl" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8z" class="cr-punta"/></marker></defs>' + nodos + '</svg></div>' +
      '<p class="chico tenue" style="margin:6px 0 0">' + (tipo === 'roy' ? 'En cada caja: <b>T</b> = inicio y fin más tempranos; <b>L</b> = más tardíos; <b>h</b> = holgura.' : 'En cada caja: duración esperada <b>te</b> = (a + 4m + b) ÷ 6 y varianza <b>σ²</b>.') + ' Solo se dibuja la ruta crítica; el resto está en la tabla de abajo.</p>';
  }
  function tablaCritica(res) {
    var ts = S.tareas, filas = res.tareas.filter(function (v) { return !v.na; }).slice().sort(function (a, b) { return a.hol - b.hol || a.es - b.es; }).slice(0, 15);
    return '<h3 style="margin:14px 0 6px">Las 15 tareas con menos holgura</h3><div class="tabla-scroll"><table class="tabla"><thead><tr><th>N.º</th><th>Tarea</th><th>Inicio</th><th>Fin</th><th>Holgura</th></tr></thead><tbody>' +
      filas.map(function (v) { return '<tr><td>' + (ts.findIndex(function (z) { return z.id === v.id; }) + 1) + '</td><td>' + esc(v.t) + '</td><td>' + f1(v.es) + '</td><td>' + f1(v.ef) + '</td><td>' + (v.crit ? '<b class="alerta">0 (crítica)</b>' : f1(v.hol)) + '</td></tr>'; }).join('') + '</tbody></table></div>';
  }

  // Posición y ancho de las barras, en porcentaje del total.
  function medidas(r) {
    r.querySelectorAll('[data-izq]').forEach(function (e) { e.style.left = e.dataset.izq + '%'; e.style.width = e.dataset.ancho + '%'; });
    r.querySelectorAll('.lb-eje span').forEach(function (e) { e.style.left = e.dataset.p + '%'; });
  }
  function pintarRes() {
    var r = $('#lb-res'); if (!r) return;
    r.innerHTML = resultado(); medidas(r);
  }
  function pintarTodo() {
    raiz.innerHTML = vista(); medidas(raiz);
  }
  function refrescar() { clearTimeout(crT); crT = setTimeout(guardar, 300); pintarRes(); }

  // ---------- eventos ----------
  function descargar(nombre, tipo, texto) {
    var a = document.createElement('a'), u = URL.createObjectURL(new Blob([texto], { type: tipo }));
    a.href = u; a.download = nombre; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 1000);
  }
  var nombreArchivo = function () { return (S.titulo || 'cronograma-del-libro').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'cronograma'; };
  function aviso(t) {
    var a = $('#lb-aviso'); if (!a) { a = document.createElement('p'); a.id = 'lb-aviso'; a.className = 'aviso no-imprimir'; a.setAttribute('role', 'status'); document.body.appendChild(a); }
    a.textContent = t; a.classList.add('on'); clearTimeout(a._t); a._t = setTimeout(function () { a.classList.remove('on'); }, 2600);
  }
  function exportar(k) {
    var c = calcular();
    if (k === 'json') return descargar(nombreArchivo() + '.json', 'application/json', JSON.stringify({ planificador: 'cursada-libro', v: 2, catalogo: C }, null, 1));
    if (c.vacio || c.error) return aviso(c.error || 'No hay tareas');
    if (k === 'csv') return descargar(nombreArchivo() + '.csv', 'text/csv;charset=utf-8', Cronograma.aCsv(S.tareas, c.res, c.fe));
    if (k === 'ics') { if (!c.fe) return aviso('Cargá una fecha para armar el calendario'); return descargar(nombreArchivo() + '.ics', 'text/calendar;charset=utf-8', Cronograma.aIcs(S.tareas, c.fe, S.titulo)); }
  }

  function acciones(e) {
    var b = e.target.closest ? e.target.closest('[data-acc]') : null; if (!b) return;
    var acc = b.dataset.acc, i = parseInt(b.dataset.i, 10);
    if (acc === 'plantilla') {
      if (b.dataset.id === S.plantilla) return;
      if (S.tareas.length && !confirm('Cambiar de plantilla reemplaza las tareas actuales. ¿Seguimos?')) return;
      var viejo = S, nuevo = estadoNuevo(b.dataset.id);
      nuevo.lid = viejo.lid; nuevo.titulo = viejo.titulo; nuevo.modo = viejo.modo; nuevo.fecha = viejo.fecha; nuevo.equipo = viejo.equipo;
      C.libros[C.libros.indexOf(viejo)] = nuevo; S = nuevo; guardar(); pintarTodo();
    } else if (acc === 'catalogo') { C.vista = 'catalogo'; guardar(); pintarTodo(); }
    else if (acc === 'abrir') { abrir(b.dataset.id); C.vista = 'libro'; guardar(); pintarTodo(); window.scrollTo(0, 0); }
    else if (acc === 'nuevo' || acc === 'duplicar') {
      if (C.libros.length >= MAX_LIBROS) return aviso('Máximo ' + MAX_LIBROS + ' libros');
      var n = acc === 'nuevo' ? estadoNuevo('narrativa') : normalizar(JSON.parse(JSON.stringify(S)));
      if (acc === 'nuevo') { n.modo = S.modo; n.fecha = S.fecha; } else n.titulo = (S.titulo ? S.titulo + ' (copia)' : '').slice(0, 80);
      n.lid = lidLibre(); C.libros.push(n); S = n; C.activo = n.lid; C.vista = 'libro'; guardar(); pintarTodo(); window.scrollTo(0, 0);
    } else if (acc === 'borrar') {
      if (!confirm('¿Quitar «' + (S.titulo || 'este libro') + '» del catálogo? No se puede deshacer (si querés conservarlo, bajá antes la copia .json).')) return;
      C.libros.splice(C.libros.indexOf(S), 1);
      if (!C.libros.length) { var nv = estadoNuevo('narrativa'); C.libros.push(nv); }
      abrir(C.libros[0].lid); guardar(); pintarTodo();
    } else if (acc === 'metodo') { S.metodo = b.dataset.id; guardar(); pintarTodo(); }
    else if (acc === 'plegar' || acc === 'desplegar') { S.plegadas = {}; if (acc === 'plegar') fases().forEach(function (fa) { S.plegadas[fa.id || '_'] = 1; }); guardar(); pintarRes(); }
    else if (acc === 'plegarfase') { var k = b.dataset.id; S.plegadas[k] = S.plegadas[k] ? 0 : 1; guardar(); pintarRes(); }
    else if (acc === 'info') { var r = $('#lb-info-' + i); if (r) { r.hidden = !r.hidden; b.setAttribute('aria-expanded', String(!r.hidden)); b.textContent = r.hidden ? 'Más' : 'Menos'; } }
    else if (acc === 'quitar') { var id = (S.tareas[i] || {}).id; if (id) { delete S.seg[id]; if (S.base) delete S.base.t[id]; } S.tareas.splice(i, 1); S.tareas.forEach(function (x) { x.pre = x.pre.filter(function (p) { return (typeof p === 'string' ? p : p.id) !== id; }); }); guardar(); pintarTodo(); }
    else if (acc === 'sumar') {
      if (S.tareas.length >= 200) return aviso('Máximo 200 tareas');
      var n = 1; while (S.tareas.some(function (x) { return x.id === 'U' + n; })) n++;
      var fa = b.dataset.f || '', pos = S.tareas.length;
      S.tareas.forEach(function (x, j) { if ((x.f || '') === fa) pos = j + 1; });
      S.tareas.splice(pos, 0, { id: 'U' + n, f: fa, q: '', na: 0, hito: 0, t: '', d: '1', a: '', m: '', b: '', pre: [] }); guardar(); pintarTodo();
    } else if (acc === 'base') {
      var c2 = calcular(); if (!c2.fe) return aviso('Cargá una fecha de inicio o de salida para fijar la línea base');
      var bt = {}; c2.fe.tareas.forEach(function (v) { bt[v.id] = [v.desde, v.hasta]; });
      S.base = { fecha: hoyISO(), t: bt }; guardar(); pintarRes(); aviso('Línea base fijada');
    } else if (acc === 'sinbase') { S.base = null; guardar(); pintarRes(); }
    else if (acc === 'pdf') { window.print(); }
    else if (['ics', 'csv', 'json'].indexOf(acc) >= 0) exportar(acc);
  }
  function campos(e) {
    var t = e.target, k = t.dataset.k, f = t.dataset.f;
    if (f) {
      if (f === 'verRol') { C.verRol = t.checked; guardar(); pintarTodo(); return; }
      if (f === 'seguir') { C.seguir = t.checked; guardar(); pintarTodo(); return; }
      if (f === 'filtro') { C.filtro = t.value; guardar(); pintarTodo(); return; }
      if (f === 'plazo') S.plazo = t.value.replace(/[^\d.,]/g, '').slice(0, 6);
      else if (f === 'titulo') { S.titulo = t.value.replace(/[<>]/g, '').slice(0, 80); var ch = $('[data-acc="abrir"][data-id="' + S.lid + '"]'); if (ch) ch.textContent = S.titulo || 'Libro ' + (C.libros.indexOf(S) + 1); }
      else if (f === 'modo') { S.modo = t.value === 'hasta' ? 'hasta' : 'desde'; guardar(); pintarTodo(); return; }
      else if (f === 'fecha') { if (!/^\d{4}-\d{2}-\d{2}$/.test(t.value)) return; S.fecha = t.value; }
      return refrescar();
    }
    if (t.dataset.eq) { var v = t.value.replace(/[<>;,]/g, '').slice(0, 40).trim(); if (v) S.equipo[t.dataset.eq] = v; else delete S.equipo[t.dataset.eq]; return refrescar(); }
    if (t.dataset.s) {
      var xs = S.tareas[parseInt(t.dataset.i, 10)]; if (!xs) return;
      var q = S.seg[xs.id] || (S.seg[xs.id] = {}), ks = t.dataset.s;
      if (ks === 'av') { var nv = Math.max(0, Math.min(100, Math.round(+t.value.replace(',', '.')) || 0)); if (nv) q.av = nv; else delete q.av; }
      else if (ISO.test(t.value)) q[ks] = t.value; else if (!t.value) delete q[ks]; else return;
      if (!Object.keys(q).length) delete S.seg[xs.id];
      return refrescar();
    }
    if (!k) return;
    var i = parseInt(t.dataset.i, 10), x = S.tareas[i]; if (!x) return;
    if (k === 't') x.t = t.value.replace(/[<>]/g, '').slice(0, 80);
    else if (k === 'r') x.r = t.value.replace(/[<>]/g, '').slice(0, 60);
    else if (k === 'na') { x.na = t.checked ? 1 : 0; t.closest('tr').classList.toggle('lb-na', t.checked); }
    else if (k === 'pre') { if (e.type !== 'change') return; x.pre = preLeer(t.value, x); t.value = preTexto(x); }
    else x[k] = t.value.replace(/[^\d.,]/g, '').slice(0, 6);
    refrescar();
  }
  function importar(e) {
    var f = e.target.files && e.target.files[0]; if (!f) return;
    if (f.size > 2e6) return aviso('El archivo es demasiado grande');
    var rd = new FileReader();
    rd.onload = function () {
      try {
        var j = JSON.parse(rd.result), n = normalizarC(j && j.catalogo ? j.catalogo : j && j.estado ? j.estado : j);
        if (!n) throw new Error('vacío');
        var sumados = 0;
        n.libros.forEach(function (l) { if (C.libros.length >= MAX_LIBROS) return; l.lid = lidLibre(); C.libros.push(l); sumados++; if (!sumados || sumados === 1) abrir(l.lid); });
        C.vista = 'libro'; guardar(); pintarTodo(); aviso(sumados === 1 ? 'Libro sumado al catálogo' : sumados + ' libros sumados al catálogo');
      } catch (er) { aviso('No pude leer ese archivo'); }
    };
    rd.readAsText(f); e.target.value = '';
  }

  // Al imprimir se despliega todo; al volver, se deja como estaba.
  window.addEventListener('beforeprint', function () { window.__lbImprimiendo = true; pintarRes(); });
  window.addEventListener('afterprint', function () { window.__lbImprimiendo = false; pintarRes(); });

  function iniciar() {
    raiz.addEventListener('click', acciones);
    raiz.addEventListener('input', function (e) { if (e.target.dataset.k !== 'pre' && e.target.type !== 'checkbox' && e.target.id !== 'lb-importar') campos(e); });
    raiz.addEventListener('change', function (e) { if (e.target.id === 'lb-importar') return importar(e); if (e.target.type === 'checkbox' || e.target.dataset.k === 'pre' || e.target.tagName === 'SELECT' || e.target.type === 'date') campos(e); });
    pintarTodo();
  }

  // En el archivo descargable los datos vienen incluidos (window.LIBRO_DATOS): no hay servidor al que pedirlos.
  var DATOS = window.LIBRO_DATOS;
  Promise.all(DATOS ? [DATOS.plantillas, DATOS.calendario] : [
    fetch(BASE + 'libro/plantillas.json').then(function (r) { return r.json(); }),
    fetch(BASE + 'datos/calendario-2026.json').then(function (r) { return r.json(); }).catch(function () { return null; })
  ]).then(function (r) {
    P = r[0];
    if (r[1] && Array.isArray(r[1].feriados)) {
      FERIADOS = r[1].feriados.map(function (f) { return f.fecha; }).filter(function (x) { return typeof x === 'string'; });
      ANIOS_FERIADOS = r[1].anio || 0;
    }
    C = cargar();
    if (!C) { C = { v: 2, activo: 'L1', vista: 'libro', filtro: '', verRol: false, seguir: false, libros: [] }; C.libros.push(estadoNuevo('narrativa')); C.activo = C.libros[0].lid; }
    abrir(C.activo);
    iniciar();
  }).catch(function () { raiz.innerHTML = '<p class="chico alerta">No pude cargar el planificador. Probá recargar la página.</p>'; });
})();
