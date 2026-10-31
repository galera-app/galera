// Galera: gestor para la carrera de Edición (FFyL, UBA). Todo corre en el navegador:
// el plan, el calendario y la oferta horaria son archivos de datos (datos/*.json) y lo que carga
// cada persona se guarda en su localStorage. Sin servidor ni cuentas.
'use strict';
// Anti-clickjacking (la CSP en <meta> no admite frame-ancestors): si otra página nos encuadra, salimos del marco.
if (window.top !== window.self) { try { window.top.location = window.self.location; } catch (e) { document.documentElement.style.display = 'none'; } }

const CLAVE = 'cursada.v1';
const ESTADOS = { pendiente: 'Pendiente', cursando: 'Cursando', regular: 'Regular (falta el final)', aprobada: 'Aprobada' };
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIAS_C = ['dom.', 'lun.', 'mar.', 'mié.', 'jue.', 'vie.', 'sáb.']; // con punto: "mar. 3 mar" (martes 3 de marzo) no se confunde
const COLORES = ['#1a5f78', '#7b4592', '#a8470f', '#276b44', '#a03352', '#4a59b8', '#7a5f12', '#2f6a70']; // todos con contraste de 5:1 o más contra texto blanco
const D = { busqueda: null, plan: null, calendario: null, ofertas: [], ofertasMeta: [], mesas: [], indice: null, resumenes: null, apuntes: {}, biblioteca: null, glosario: null, directorio: null, novedades: null, pedidos: null, sostener: null };
const TABS = [['carrera', 'Mi carrera'], ['horarios', 'Horarios'], ['calendario', 'Calendario'], ['resumenes', 'Resúmenes'], ['biblioteca', 'Biblioteca'], ['simuladores', 'Simuladores'], ['glosario', 'Glosario'], ['directorio', 'Directorio'], ['links', 'Links útiles'], ['novedades', 'Novedades'], ['sostener', 'Sostener'], ['config', 'Ajustes']];
// Perfil (E.perfil): «Estudiante» ve la carrera; «Profesional del libro» ve herramientas, eventos de la industria y links del sector.
const TABS_PRO = [['simuladores', 'Simuladores'], ['eventos', 'Eventos'], ['resumenes', 'Resúmenes'], ['biblioteca', 'Biblioteca'], ['glosario', 'Glosario'], ['directorio', 'Directorio'], ['links', 'Links útiles'], ['novedades', 'Novedades'], ['sostener', 'Sostener'], ['config', 'Ajustes']];
const TODAS_TABS = TABS.concat([['eventos', 'Eventos'], ['arcade', 'Arcade'], ['inicio', 'Inicio']]);   // el Arcade no tiene pestaña: se entra desde los Resúmenes de Corrección de Estilo
const esPro = () => E.perfil === 'profesional';
const tabsActivas = () => esPro() ? TABS_PRO : TABS;
const ajustarTab = () => { if (esPro() && V.tab !== 'inicio' && !TABS_PRO.some(t => t[0] === V.tab)) { V.tab = 'simuladores'; V.sim = ''; } };
const CONTACTO = 'fidelchaves96@gmail.com'; // el mismo mail público de ficha.github.io
const SOPORTE = 'soporte@galera.com.ar'; // errores y fallas de la app
const V = { sim: '', nov: '', bib: 'libros', perIdi: 'es', perTipo: '', bl: { q: '', origen: '', tema: '', mat: '', n: 0 }, tab: 'inicio', cambiaPerfil: false, vista: 'tabla', oferta: '', verPasados: false, calFiltro: 'todo', sugeridas: null, verAprobadas: false, verSem: false,
  res: { materia: '', apunte: '', sec: '' }, busq: '', quiz: {}, ayuda: {}, tema: '', glo: { q: '', mat: '', vista: 'lista', sel: -1, vb: null }, dir: { tipo: 'editorial', q: '', prov: '', linea: '', web: false, letra: '' },
  demo: null, prac: null, retos: false, ausencia: 0, retomado: false, recNota: false }; // demo: el estado real guardado aparte mientras se mira el ejemplo; prac: la ronda de práctica en curso
// Datos para donar por transferencia (sin comisión). Alias vacío = no se muestra el botón.
const DONAR = { alias: 'fidel.mercado', cvu: '0000003100037663540198', cafecito: 'https://cafecito.app/fidelchaves' };

// ---------- utilidades ----------
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Para pasar un dato como argumento de un manejador en línea (onclick="f(${arg(x)})"): JSON + escape de HTML.
// Así ningún texto (un nombre con apóstrofo, un archivo importado, un dato del PDF de la Facultad) puede romper ni inyectar código.
// Un link que viene de un JSON solo se usa si es http(s): esc() no frena un javascript:.
const urlSegura = u => /^https?:\/\//i.test(String(u == null ? '' : u)) ? esc(u) : '#';
const arg = v => esc(JSON.stringify(String(v == null ? '' : v)));
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const hoy = () => iso(new Date());
const fecha = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const fmt = s => { const d = fecha(s); return DIAS_C[d.getDay()] + ' ' + d.getDate() + ' ' + MESES[d.getMonth()]; };
const fmtRango = (a, b) => !b || a === b ? fmt(a) : fecha(a).getDate() + (a.slice(0, 7) === b.slice(0, 7) ? '' : ' ' + MESES[fecha(a).getMonth()]) + ' al ' + fecha(b).getDate() + ' ' + MESES[fecha(b).getMonth()];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
let avisoT;
// Los avisos de error o los largos duran más (5 s) para poder releerlos.
function aviso(t) { const a = $('#aviso'); a.textContent = t; a.classList.add('on'); clearTimeout(avisoT); avisoT = setTimeout(() => a.classList.remove('on'), /^No se pudo/.test(t) || t.length > 60 ? 5000 : 2400); }

// ---------- estado (localStorage) ----------
// copia: última descarga de la copia; modif: último cambio; primera y visto: para contar (sin datos personales) si la gente vuelve.
// practica: "materia/apunte/n" → [bien, mal, fecha] de cada pregunta practicada.
// juego: los elementos de juego (un interruptor general; todo informativo, sin puntos ni rachas): on, rondas (última de cada materia), hitos (registro de lo hecho),
// retos (resueltos), aprob (materias ya registradas), ultimo (último apunte abierto).
const juegoVacio = () => ({ on: true, rondas: {}, hitos: [], retos: {}, aprob: [], ultimo: '' });
function estadoVacio() { return { v: 1, carrera: 'edicion', perfil: '', vioAyuda: false, materias: {}, horarios: {}, escandallo: null, comparador: null, papel: null, paginacion: null, cronograma: null, leidos: {},
  copia: '', modif: '', primera: '', visto: '', practica: {}, juego: juegoVacio(), arcade: Arcade.sanear(null) }; }
// Todo lo que entra (de localStorage o de un archivo importado) se reconstruye campo por campo:
// solo tipos, formatos y largos esperados. Lo que no encaja se descarta.
const RE_ID = /^(?!__proto__$|constructor$|prototype$)[\w.-]{1,60}$/, RE_FECHA = /^\d{4}-\d\d-\d\d$/, RE_HORA = /^\d\d:\d\d$/;
const TIPOS = ['Teórico', 'Práctico', 'Teórico-práctico'];
const MODOS_ESC = ['cpu', 'offset', 'demanda'];
const CAMPOS_PAPEL = ['ancho', 'alto', 'paginas', 'solapa', 'lomo', 'tirada', 'demasia', 'gramaje', 'precioKg', 'fa', 'fb', 'calle', 'lateral', 'pinza', 'cola', 'forzar', 'espesor'];
const CAMPOS_ESC = ['pvp', 'tirada', 'cpu', 'preproduccion', 'industrial', 'paginas', 'porPliego', 'precioPliego', 'tapasPorPliego', 'precioTapa', 'encuadernado',
  'descuento', 'invendibles', 'derechos', 'incobrables', 'comisiones', 'flete', 'publicidad', 'ce'];
const txt = (v, n) => typeof v === 'string' ? v.slice(0, n) : '';
const lista = (v, n) => (Array.isArray(v) ? v : []).slice(0, n);
function normalizar(e) {
  const out = estadoVacio();
  if (!e || typeof e !== 'object') return out;
  out.vioAyuda = !!e.vioAyuda;
  out.perfil = e.perfil === 'profesional' || e.perfil === 'estudiante' ? e.perfil : '';
  const M = e.materias && typeof e.materias === 'object' ? e.materias : {};
  Object.keys(M).slice(0, 200).forEach(id => {
    const m = M[id];
    if (!RE_ID.test(id) || !m || typeof m !== 'object') return;
    out.materias[id] = {
      estado: ESTADOS[m.estado] ? m.estado : 'pendiente', opcion: RE_ID.test(m.opcion || '') ? m.opcion : '', detalle: txt(m.detalle, 200),
      nota: /^\d{1,2}(,\d{1,2})?$/.test(m.nota || '') ? m.nota : '', cuando: txt(m.cuando, 80), aprobada: RE_FECHA.test(m.aprobada || '') ? m.aprobada : '',
      apuntes: txt(m.apuntes, 5000), aplazos: lista(m.aplazos, 20).map(String).filter(a => /^[123]$/.test(a)),
      examenes: lista(m.examenes, 60).filter(x => x && typeof x === 'object').map(x => ({ id: RE_ID.test(x.id || '') ? x.id : uid(), tipo: txt(x.tipo, 30) || 'Otro',
        fecha: RE_FECHA.test(x.fecha || '') ? x.fecha : '', hora: RE_HORA.test(x.hora || '') ? x.hora : '', detalle: txt(x.detalle, 200), nota: txt(x.nota, 10) }))
    };
  });
  const bloque = b => b && typeof b === 'object' && Number(b.dia) >= 1 && Number(b.dia) <= 6 && RE_HORA.test(b.desde || '') && RE_HORA.test(b.hasta || '') && b.desde < b.hasta
    ? { dia: Number(b.dia), desde: b.desde, hasta: b.hasta } : null;
  const H = e.horarios && typeof e.horarios === 'object' ? e.horarios : {};
  Object.keys(H).slice(0, 40).forEach(k => {
    const h = H[k];
    if (!RE_ID.test(k) || !h || typeof h !== 'object') return;
    const elegidas = {};
    Object.keys(h.elegidas && typeof h.elegidas === 'object' ? h.elegidas : {}).slice(0, 100).forEach(c => { if (typeof h.elegidas[c] === 'string' && c.length <= 200) elegidas[c] = h.elegidas[c].slice(0, 120); });
    out.horarios[k] = {
      materias: lista(h.materias, 30).filter(x => typeof x === 'string').map(x => x.slice(0, 120)), elegidas, sinSabado: !!h.sinSabado, listo: !!h.listo,
      propias: lista(h.propias, 80).filter(c => c && typeof c === 'object').map(c => ({ id: RE_ID.test(c.id || '') ? c.id : 'p' + uid(), materia: txt(c.materia, 120).replace(/\|/g, '/'),
        tipo: TIPOS.indexOf(c.tipo) >= 0 ? c.tipo : 'Teórico-práctico', nombre: txt(c.nombre, 20), docente: txt(c.docente, 120), aula: txt(c.aula, 60),
        bloques: lista(c.bloques, 6).map(bloque).filter(Boolean), propia: true })).filter(c => c.materia && c.bloques.length),
      bloqueos: lista(h.bloqueos, 40).map(b => { const x = bloque(b); if (x) x.t = txt(b.t, 40); return x; }).filter(Boolean)
    };
  });
  // Simulador de escandallo: solo cifras (como texto, tal cual se tipearon) y los nombres de los canales.
  const cifra = v => typeof v === 'string' && /^[\d.,\s$%-]{0,20}$/.test(v) ? v : '';
  const S = e.escandallo;
  if (S && typeof S === 'object') {
    out.escandallo = { modo: MODOS_ESC.indexOf(S.modo) >= 0 ? S.modo : 'cpu', usarCanales: !!S.usarCanales,
      canales: lista(S.canales, 12).filter(c => c && typeof c === 'object').map(c => ({ t: txt(c.t, 40), desc: cifra(c.desc), part: cifra(c.part), plazo: cifra(c.plazo) })) };
    CAMPOS_ESC.forEach(k => { out.escandallo[k] = cifra(S[k]); });
  }
  // Comparador de títulos: la misma regla (cifras y nombres, con tope de largo y de cantidad).
  const C = e.comparador;
  if (C && typeof C === 'object') {
    out.comparador = { ce: cifra(C.ce), ganancia: cifra(C.ganancia),
      titulos: lista(C.titulos, 20).filter(t => t && typeof t === 'object').map(t => ({ t: txt(t.t, 40), pvp: cifra(t.pvp), desc: cifra(t.desc), inu: cifra(t.inu), cdu: cifra(t.cdu), q: cifra(t.q) })) };
  }
  // Cálculo de papel: cifras, y de las listas (formato, corte, paquete) solo valores conocidos.
  const P0 = e.papel;
  if (P0 && typeof P0 === 'object') {
    const de = (v, L, def) => L.indexOf(v) >= 0 ? v : def;
    out.papel = { tipo: de(P0.tipo, ['interior', 'tapa'], 'interior'), formato: de(P0.formato, Papel.FORMATOS.map(f => f.id).concat('otro'), '58x92'),
      cortes: de(P0.cortes, ['1', '2', '4'], '1'), hojasPaquete: de(P0.hojasPaquete, ['500', '250', '150', '100'], '500') };
    CAMPOS_PAPEL.forEach(k => { out.papel[k] = cifra(P0[k]); });
  }
  // Paginación: cifras, listas con valores conocidos y, por parte, tilde, páginas y dónde empieza.
  const G0 = e.paginacion;
  if (G0 && typeof G0 === 'object') {
    const de = (v, L, def) => L.indexOf(v) >= 0 ? v : def;
    out.paginacion = { multiplo: de(G0.multiplo, ['8', '16', '32', '64'], '16'), capRecto: de(G0.capRecto, ['0', '1'], '1'), capPortada: de(G0.capPortada, ['0', '1'], '0'), partes: {} };
    ['paginas', 'caracteres', 'porPagina', 'capitulos'].forEach(k => { out.paginacion[k] = cifra(G0[k]); });
    const PG = G0.partes && typeof G0.partes === 'object' ? G0.partes : {};
    Paginacion.PARTES.forEach(p => { const x = PG[p.id]; if (x && typeof x === 'object') out.paginacion.partes[p.id] = { on: typeof x.on === 'boolean' ? x.on : p.on, pags: cifra(x.pags), ini: de(x.ini, ['recto', 'verso', 'sigue'], p.ini) }; });
  }
  // Cronograma: método, plazo, inicio y tareas saneadas (cronograma.js).
  const C0 = e.cronograma;
  if (C0 && typeof C0 === 'object') out.cronograma = { metodo: ['gantt', 'pert', 'roy', 'comparar'].indexOf(C0.metodo) >= 0 ? C0.metodo : 'gantt', plazo: cifra(C0.plazo), inicio: /^\d{4}-\d{2}-\d{2}$/.test(C0.inicio) ? C0.inicio : '', tareas: Cronograma.sanear(C0.tareas) };
  // Elementos de juego: un interruptor, la última ronda de cada materia, el registro de lo hecho y los retos resueltos.
  const J = e.juego && typeof e.juego === 'object' ? e.juego : null;
  if (J) {
    out.juego.on = J.on !== false;
    const R = J.rondas && typeof J.rondas === 'object' ? J.rondas : {};
    Object.keys(R).slice(0, 100).forEach(id => { const x = R[id]; if (RE_ID.test(id) && Array.isArray(x) && Number.isInteger(x[0]) && Number.isInteger(x[1]) && x[0] >= 0 && x[1] >= x[0] && x[1] <= 99 && RE_FECHA.test(x[2] || '')) out.juego.rondas[id] = [x[0], x[1], x[2]]; });
    out.juego.hitos = lista(J.hitos, 60).filter(x => Array.isArray(x) && RE_FECHA.test(x[0] || '') && typeof x[1] === 'string' && x[1].trim()).map(x => [x[0], x[1].slice(0, 140)]);
    const T = J.retos && typeof J.retos === 'object' ? J.retos : {};
    Object.keys(T).slice(0, 30).forEach(id => { if (RE_ID.test(id) && RE_FECHA.test(T[id] || '')) out.juego.retos[id] = T[id]; });
    out.juego.aprob = Array.isArray(J.aprob) ? lista(J.aprob, 200).filter(x => typeof x === 'string' && RE_ID.test(x)) : null;
    out.juego.ultimo = /^\w[\w.-]{0,59}\/\w[\w.-]{0,59}$/.test(J.ultimo || '') ? J.ultimo : '';
  } else out.juego.aprob = null;   // sin dato: la primera vez se anotan las ya aprobadas sin hacer ruido
  out.arcade = Arcade.sanear(e.arcade);   // Arcade de Corrección de Estilo: iniciales y top local por tablero
  // Apuntes leídos: "materia/apunte" → fecha.
  const L = e.leidos && typeof e.leidos === 'object' ? e.leidos : {};
  Object.keys(L).slice(0, 500).forEach(k => { const p = k.split('/'); if (p.length === 2 && p.every(x => /^\w[\w.-]{0,59}$/.test(x)) && RE_FECHA.test(L[k])) out.leidos[k] = L[k]; });
  ['copia', 'modif', 'primera', 'visto'].forEach(k => { if (RE_FECHA.test(e[k] || '')) out[k] = e[k]; });
  // Práctica: por pregunta, cuántas veces salió bien y mal, y cuándo fue la última.
  const P = e.practica && typeof e.practica === 'object' ? e.practica : {};
  const veces = v => Number.isInteger(v) && v >= 0 ? Math.min(v, 999) : 0;
  Object.keys(P).slice(0, 3000).forEach(k => {
    const x = P[k];
    if (/^\w[\w.-]{0,59}\/\w[\w.-]{0,59}\/\d{1,4}$/.test(k) && Array.isArray(x) && RE_FECHA.test(x[2] || '')) out.practica[k] = [veces(x[0]), veces(x[1]), x[2]];
  });
  return out;
}
function cargarEstado() {
  try { const e = JSON.parse(localStorage.getItem(CLAVE)); if (e && e.v === 1) return normalizar(e); } catch (err) { }
  return estadoVacio();
}
// El estado se carga recién acá: normalizar() usa constantes (RE_ID, TIPOS…) que antes de este punto todavía no existen,
// y leerlo más arriba fallaba en silencio y arrancaba vacío (y el primer cambio pisaba lo guardado).
let E = cargarEstado();
// sinCambio: guarda datos de uso (visto, copia) sin contarlo como un cambio que pida una copia nueva.
function guardar(sinCambio) {
  if (V.demo) return; // el ejemplo no se guarda nunca: al salir vuelve lo de la persona, intacto
  if (!sinCambio) { E.modif = hoy(); if (conDatos()) primeraCarga(); }
  revisarAprobadas();
  try { localStorage.setItem(CLAVE, JSON.stringify(E)); } catch (err) { aviso('No se pudo guardar: tu navegador bloquea el almacenamiento (¿ventana privada?). Lo que cargues se pierde al cerrar. Bajá una copia desde «Mis datos».'); }
  // Pide al navegador que no borre estos datos cuando le falte espacio (no muestra carteles; si no puede, no pasa nada).
  if (!guardar.pedido && navigator.storage && navigator.storage.persist) { guardar.pedido = true; navigator.storage.persist().catch(() => { }); }
}
const mat = id => (E.materias[id] = E.materias[id] || { estado: 'pendiente', examenes: [] });
const datosMateria = id => D.plan.materias.find(m => m.id === id);
// Datos de la opción elegida en una electiva (programa, régimen), si los tiene.
function opcion(m) { const e = E.materias[m.id]; return (m.opciones || []).find(o => e && o.id === e.opcion) || null; }
// Programas de una materia (o de la opción elegida): uno oficial o varios (una página por cátedra).
// Si es una electiva sin elegir, junta los de todas sus opciones, con el nombre de cada una.
function programas(m, o) {
  const de = (x, pre) => (x.programas || (x.programa ? [{ t: 'Programa oficial' + (x.programa_anio || m.programa_anio ? ' (' + (x.programa_anio || m.programa_anio) + ')' : ''), url: x.programa }] : []))
    .map(p => ({ t: pre ? pre + ': ' + p.t : p.t, url: p.url }));
  if (o) return de(o);
  const propios = de(m);
  return propios.length || !m.opciones ? propios : m.opciones.flatMap(x => de(x, x.nombre));
}
const nombreDe = m => { const o = opcion(m), e = E.materias[m.id] || {}; return o ? o.nombre : (m.libre && e.detalle ? 'Seminario: ' + e.detalle : m.nombre); };

// ---------- carga de datos ----------
async function json(archivo) { const r = await fetch('datos/' + archivo); if (!r.ok) throw new Error(archivo); return r.json(); }
// Los idiomas no vienen en la planilla de la Facultad: los publica el Departamento de Lenguas Modernas (idiomas_lm.py).
// Se suman como comisiones de la misma oferta; si no se pueden cargar, la oferta queda como estaba.
async function conIdiomas(of) {
  const m = ((D.indice || {}).idiomas || []).find(x => x.id === of.id);
  if (!m) return of;
  try { const i = await json(m.archivo); of.comisiones = of.comisiones.concat(i.comisiones || []); of.idiomas = { fuente: i.fuente, actualizado: i.actualizado }; } catch (e) { /* sin idiomas */ }
  return of;
}
async function arrancar() {
  try {
    D.indice = await json('indice.json');
    const c = D.indice.carreras.find(x => x.id === E.carrera) || D.indice.carreras[0];
    // En paralelo, y solo lo que hace falta: el último cuatrimestre (los anteriores se piden si se eligen) y los dos últimos turnos de examen.
    const ult = a => a[a.length - 1];
    D.ofertasMeta = D.indice.ofertas.filter(o => o.carrera === c.id);
    const turnos = (D.indice.mesas || []).filter(o => o.carrera === c.id).slice(-2);
    const [plan, cal, of, ...mesas] = await Promise.all([json(c.archivo), json(ult(D.indice.calendarios).archivo),
      D.ofertasMeta.length ? json(ult(D.ofertasMeta).archivo).catch(() => null) : null].concat(turnos.map(m => json(m.archivo).catch(() => null))));
    D.plan = plan; D.calendario = cal; D.ofertas = of ? [await conIdiomas(of)] : []; D.mesas = mesas.filter(Boolean);
    V.oferta = of ? of.id : '';
  } catch (err) {
    $('#main').innerHTML = '<p class="vacio">No pude cargar esto (' + esc(err.message) + '). Puede ser la conexión. <button class="btn sec" type="button" onclick="location.reload()">Probar de nuevo</button></p>';
    return;
  }
  $('#subtitulo').textContent = 'Tus materias, tu promedio y tus horarios de ' + D.plan.nombre;
  registrarVisita();
  document.querySelectorAll('[data-nov]').forEach(el => { el.hidden = !NOVEDADES; });
  if (DONAR.alias) $('#donar').innerHTML = `<button class="btn sec ch" type="button" onclick="ir('sostener')">Invitar un cafecito</button>`;
  if (desdeHash() && V.tab === 'resumenes' && V.res.apunte) cargarApunte(); else render();
  iniciarPerfil();
  manejarLinkNov(); // links de los mails de novedades (#confirmar=, #novedades=, #baja=)
  cargarResumenes(); // índice chico: sirve para ofrecer los resúmenes desde la ficha de cada materia
}
// El hash dice dónde está cada quien: #pestaña, o #resumenes/materia/apunte/sección (links para compartir partes de un apunte).
const hashActual = () => V.tab === 'resumenes' ? ['resumenes', V.res.materia, V.res.apunte, V.res.sec].filter(Boolean).join('/') : V.tab === 'simuladores' ? ['simuladores', V.sim].filter(Boolean).join('/') : V.tab === 'novedades' && V.nov ? 'novedades/' + V.nov : V.tab === 'biblioteca' && V.bib !== 'libros' ? ['biblioteca', V.bib, V.bib === 'per' && V.perIdi !== 'es' ? V.perIdi : ''].filter(Boolean).join('/') : V.tab;
function desdeHash() {
  let p; try { p = decodeURIComponent(location.hash.slice(1)).split('/'); } catch (e) { return false; }
  if (p[0] === 'pedidos') p = ['novedades', 'pedidos'];   // la pestaña Pedidos pasó a Novedades (v14) y es su filtro "Lo que pidieron" (v20)
  if (p[0] === 'herramientas') p[0] = 'simuladores';   // v66: Simuladores se llama Herramientas; los links viejos (#simuladores/…) siguen andando
  if (p[0] === 'escandallo') p = ['simuladores', 'escandallo'];   // la pestaña Escandallo pasó a Simuladores (v15)
  if (!TODAS_TABS.some(t => t[0] === p[0])) return false;
  V.tab = p[0];
  if (V.tab === 'simuladores') V.sim = SIMULADORES.some(x => x.id === p[1]) ? p[1] : '';
  if (V.tab === 'novedades') V.nov = p[1] === 'pedidos' ? 'pedidos' : '';
  if (V.tab === 'biblioteca') { V.bib = p[1] === 'per' ? 'per' : 'libros'; V.perIdi = ['es', 'en', 'pt', 'de', 'fr'].indexOf(p[2]) >= 0 ? p[2] : 'es'; }
  if (V.tab === 'resumenes') {
    const [m = '', a = '', sec = ''] = p.slice(1).map(x => RE_ID.test(x) ? x : '');
    V.res = { materia: m, apunte: m && a, sec: m && a && sec };
  }
  return true;
}
const alCambiarHash = () => {
  if (/^#(datos|horario|desafio)=/.test(location.hash)) { manejarLinkNov(); return; }
  if (location.hash.slice(1) === hashActual() || !desdeHash()) return;
  if (V.tab === 'resumenes' && V.res.apunte) cargarApunte(); else { render(); window.scrollTo(0, 0); }
};
window.addEventListener('hashchange', alCambiarHash);
window.addEventListener('popstate', alCambiarHash);

// Para saber si Galera sirve (Analytics, solo con consentimiento): si quien cargó materias vuelve otro día, y a los cuántos días.
// Nunca viaja qué cargó: solo el número de días desde la primera carga.
function registrarVisita() {
  if (E.primera && E.visto && E.visto !== hoy()) V.ausencia = diasDesde(E.visto);
  if (!E.primera || E.visto === hoy()) return;
  const dias = Math.round((fecha(hoy()) - fecha(E.primera)) / 864e5);
  if (dias > 0) medir('vuelve', { dias, semana: Math.ceil(dias / 7) });
  E.visto = hoy(); guardar(true);
}
function primeraCarga() {
  if (E.primera || V.demo) return;
  E.primera = E.visto = hoy(); medir('primera_carga');
}
// ¿Qué te representa? Se pregunta una sola vez; quien ya tenía datos cargados sigue como estudiante, y quien llega por un link a una pantalla no es interrumpido.
function elegirPerfil() {
  abrir(`<div class="cab"><h2 class="crece" id="dlg-t">¿Qué te representa?</h2><button class="x" onclick="cerrar()" aria-label="Cerrar">✕</button></div>
    <p class="u-mt0 chico tenue">Así te muestro solo lo que te sirve. Lo podés cambiar cuando quieras desde «Más».</p>
    <div class="perfiles">
      <button class="perfil ${esPro() ? 'on' : ''}" type="button" onclick="ponerPerfil('profesional')"><b>Profesional del libro</b><span class="chico tenue">Herramientas, eventos de la industria y links del sector.</span></button>
      <button class="perfil ${E.perfil === 'estudiante' ? 'on' : ''}" type="button" onclick="ponerPerfil('estudiante')"><b>Estudiante</b><span class="chico tenue">Tu carrera de Edición: notas, horarios, calendario y resúmenes.</span></button>
    </div>`, 'perfil');
}
// Configuración: el perfil y los accesos a lo personal (datos, ajustes, cookies).
function vConfig() {
  const pr = esPro() ? 'profesional' : 'estudiante';
  const op = (p, ico, t, d) => `<button class="perfil ${pr === p ? 'on' : ''}" type="button" aria-pressed="${pr === p}" onclick="cambiarPerfil(${arg(p)})"><b>${t}</b><span class="chico tenue">${d}</span></button>`;
  let guardado = ''; try { guardado = localStorage.getItem('cursada.tema') || ''; } catch (e) { }
  const tema = guardado === 'dark' || guardado === 'light' ? guardado : 'auto';
  const sw = (id, on, t, d, fn) => `<div class="cfg-fila"><div class="crece"><b>${t}</b><span class="chico tenue">${d}</span></div><button class="sw" type="button" role="switch" id="${id}" aria-checked="${on}" aria-label="${esc(t)}" onclick="${fn}"></button></div>`;
  const stats = !!(window.galeraConsent && galeraConsent.on());
  return `<div class="titulo-sec"><h2>Configuración</h2></div><p class="chico tenue u-mt0">Tus datos viven en este dispositivo. Desde acá los movés o los borrás.</p>
    <div class="cfg-pag"><aside class="cfg-lado" aria-label="Secciones"><nav class="cfg-nav" aria-label="Configuración"><a href="#cfg-perfil" onclick="cfgIr(event,'cfg-perfil')">Perfil</a><a href="#cfg-apariencia" onclick="cfgIr(event,'cfg-apariencia')">Apariencia</a><a href="#cfg-avisos" onclick="cfgIr(event,'cfg-avisos')">Avisos</a><a href="#cfg-datos" onclick="cfgIr(event,'cfg-datos')">Datos</a></nav></aside>
    <div class="cfg-cuerpo">
      <section id="cfg-perfil"><h3>¿Qué te representa?</h3><p class="u-mt0 chico tenue">Elegí qué secciones ver. Podés volver acá cuando quieras.</p>
        <div class="perfiles">${op('estudiante', '🎓', 'Estudiante', 'Tu carrera de Edición: notas, horarios, calendario y resúmenes.')}${op('profesional', '📚', 'Profesional del libro', 'Herramientas, eventos de la industria y links del sector.')}</div></section>
      <section id="cfg-apariencia"><h3>Apariencia</h3>
        <div class="seg" role="group" aria-label="Tema">${[['auto', 'Automática'], ['light', 'Clara'], ['dark', 'Oscura']].map(([k, n]) => `<button type="button" class="${tema === k ? 'on' : ''}" aria-pressed="${tema === k}" onclick="ponerTema(${arg(k)})">${n}</button>`).join('')}</div>
        <p class="chico tenue">«Automática» sigue la configuración de tu dispositivo.</p></section>
      <section id="cfg-avisos"><h3>Avisos</h3>
        ${sw('sw-juego', !!E.juego.on, 'Avisos de progreso y retos', 'Cierres de ronda, repasos y registro de lo que hiciste. Sin puntos ni rachas.', 'setJuegoCfg(this)')}
        ${sw('sw-stats', stats, 'Estadísticas anónimas', 'Google Analytics cuenta visitas: no ve tus notas ni tus horarios.', 'setStats(this)')}
        <div class="cfg-fila"><div class="crece"><b>Mail de los lunes</b><span class="chico tenue">Novedades y mesas de la semana, solo lo que te importa.</span></div><button class="btn sec ch" type="button" onclick="avisame()">Configurar</button></div></section>
      <section id="cfg-datos"><h3>Datos</h3><p class="u-mt0 chico tenue">Se guardan solo en este navegador.${E.copia ? ' Tu última copia es del ' + fmt(E.copia) + '.' : ''}</p>
        <p class="fila"><button class="btn sec" type="button" onclick="abrirDatos()">Guardar una copia</button><button class="btn sec" type="button" onclick="abrirTraspaso()">Pasar a otro dispositivo</button><button class="btn pel" type="button" onclick="borrarTodo()">Borrar mis datos</button></p></section>
    </div></div>`;
}
function cfgIr(e, id) { e.preventDefault(); const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); }
function ponerTema(k) {
  if (k === 'auto') { delete raizHtml().dataset.theme; try { localStorage.removeItem('cursada.tema'); } catch (e) { } }
  else { raizHtml().dataset.theme = k; try { localStorage.setItem('cursada.tema', k); } catch (e) { } }
  pintarTema(); render();
}
function setJuegoCfg(b) { E.juego.on = b.getAttribute('aria-checked') !== 'true'; guardar(true); render(); }
function setStats(b) { if (!window.galeraConsent) return; const on = b.getAttribute('aria-checked') !== 'true'; galeraConsent.poner(on); b.setAttribute('aria-checked', String(on)); aviso(on ? 'Estadísticas activadas' : 'Estadísticas apagadas'); }
function cambiarPerfil(p) { if ((esPro() ? 'profesional' : 'estudiante') !== p) ponerPerfil(p); }
function ponerPerfil(p) {
  E.perfil = p === 'profesional' ? 'profesional' : 'estudiante';
  guardar(true); cerrar();
  V.tab = V.tab === 'config' ? 'config' : esPro() ? 'simuladores' : 'carrera'; V.sim = '';
  history.replaceState(null, '', '#' + hashActual()); render(); window.scrollTo(0, 0);
  medir('perfil', { perfil: E.perfil });
}
function iniciarPerfil() {
  if (E.perfil || V.demo || llegoTraspaso) return;   // quien llega con datos de otro dispositivo trae su perfil
  if (conDatos() || E.primera) { E.perfil = 'estudiante'; guardar(true); return; }
  // Sin datos ni perfil: la primera visita queda en el inicio con la pregunta abierta (v77; reemplaza al modal y a la franja).
}
// INICIO (v77): la portada reparte a las demás pantallas. El selector de perfil se pliega al elegir (queda una línea bajo el título) y tiene un «Cambiar».
const PERFILES_INICIO = [['estudiante', 'Estudiante', 'Plan, notas, horarios y apuntes de la carrera.'], ['profesional', 'Profesional del libro', 'Herramientas, eventos y contactos del sector.']];
const PLURAL_PERFIL = { estudiante: 'estudiantes', profesional: 'profesionales del libro' };
const BAJADAS = {
  estudiante: { carrera: 'Tus materias, notas y lo que te falta para recibirte.', horarios: 'Armá tu cuatrimestre y mirá si se pisan los horarios.', calendario: 'Inscripciones, mesas de final y feriados del año.', resumenes: 'Apuntes por materia y simulacros de parcial.', biblioteca: 'La bibliografía de cada materia, en un solo lugar.', glosario: 'Los términos de la carrera, explicados en corto.', simuladores: 'Papel, imposición, escandallo, cronogramas y contratos.', directorio: 'Editoriales de todo el país, de la A a la Z.', links: 'Campus, SIU Guaraní y trámites de la facultad.' },
  profesional: { simuladores: 'Papel, imposición, escandallo, cronogramas y contratos.', eventos: 'Ferias, jornadas y convocatorias del sector.', directorio: 'Editoriales, imprentas y distribuidoras del país.', links: 'Cámaras, organismos y recursos del sector.', resumenes: 'Los apuntes de la carrera, para repasar la teoría.', glosario: 'Términos de edición, imprenta y derecho de autor.', biblioteca: 'Libros sobre libros y manuales para consultar.' }
};
const ICONO_INICIO = {
  carrera: 'M4 11l8-6 8 6v8a1 1 0 0 1-1 1h-4v-5H9v5H5a1 1 0 0 1-1-1z', horarios: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2', calendario: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  resumenes: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5', biblioteca: 'M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h10', glosario: 'M5 4h9a5 5 0 0 1 5 5v11H5zM9 9h6M9 13h6',
  simuladores: 'M5 3h14v18H5zM8 7h8M8 11h2M12 11h2M8 15h2M12 15h2M8 18h2M12 18h2M16 15v3', directorio: 'M4 20V8l8-4 8 4v12M9 20v-6h6v6',
  links: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1', eventos: 'M3 10v4h4l6 4V6l-6 4zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11'
};
const ROMANOS = ['I', 'II', 'III', 'IV', 'V'];
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fechaLarga = s => { const d = fecha(s); return d.getDate() + ' de ' + MESES_LARGOS[d.getMonth()] + ' de ' + d.getFullYear(); };
function elegirEnInicio(p) {
  E.perfil = p === 'profesional' ? 'profesional' : 'estudiante'; V.cambiaPerfil = false; guardar(true); render();
  medir('perfil', { perfil: E.perfil });
  const h = document.querySelector('#main h2'); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
}
function cambiarEnInicio() { V.cambiaPerfil = true; render(); const b = document.querySelector('.op.on, .op'); if (b) b.focus({ preventScroll: true }); }
// La última edición (fecha y cuántas novedades trae para este perfil) sale de novedades.json; mientras no llegó, el colofón no la nombra.
function colofonInicio(per) {
  const lista = ((D.novedades && D.novedades.novedades) || []).filter(n => n.perfil === 'todos' || n.perfil === per);
  const f = lista.map(n => n.fecha).sort().pop(), n = lista.filter(x => x.fecha === f).length;
  const ed = f ? `Esta edición de Galera se actualizó el ${fechaLarga(f)} y trae <a href="#novedades">${n === 1 ? 'una novedad' : (['', '', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'][n] || n) + ' novedades'}</a>. ` : '';
  return `<p class="colofon">${ed}Se compuso en Instrument Sans y Literata, con la g en UnifrakturMaguntia, y se hizo en CABA, Argentina. Se sostiene con <a href="#sostener">cafecitos</a>; tus datos quedan en este navegador (<a href="#config">ajustes</a>).</p>`;
}
function vInicio() {
  cargarNovedades();
  const per = esPro() ? 'profesional' : 'estudiante', abierto = !E.perfil || V.cambiaPerfil;
  const grupos = GRUPOS_WEB[per].filter(g => g[0] !== 'Galera');
  const selector = abierto
    ? `<p class="inicio-sub">Elegí tu perfil: el índice se ordena según lo que hacés.</p>
      <div class="inicio-sel" role="group" aria-label="Perfil">${PERFILES_INICIO.map(([id, t, s]) => `<button type="button" class="op ${E.perfil === id ? 'on' : ''}" aria-pressed="${E.perfil === id}" onclick="elegirEnInicio(${arg(id)})"><b>${t}</b><span>${s}</span></button>`).join('')}</div>`
    : `<p class="inicio-cerr">Índice para <b>${PLURAL_PERFIL[per]}</b> · <button class="enlace" type="button" onclick="cambiarEnInicio()">Cambiar</button></p>`;
  return `<div class="inicio"><div class="inicio-tope"><h2>¿Qué venís a hacer?</h2>${selector}</div>
    <div class="inicio-sp"><div class="inicio-dv" role="separator"><span class="fl"></span></div></div>
    <div class="inicio-sumario"><h2 class="inicio-rot">Índice</h2>${grupos.map(([n, ids], i) => `<section class="inicio-grupo" aria-labelledby="ig-${i}"><h3 id="ig-${i}"><span class="num" aria-hidden="true">${ROMANOS[i]}</span><span class="gn">${n}</span></h3>
      <ul>${ids.map(id => `<li><a href="#${id}"><span class="ent-t"><b>${rotuloTab(id)}</b><span class="guia" aria-hidden="true"></span><span class="ent-ico"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONO_INICIO[id]}"/></svg></span></span><span class="ent-b">${BAJADAS[per][id]}</span></a></li>`).join('')}</ul></section>`).join('')}</div>
    <div class="inicio-sp"><div class="inicio-dv" role="separator"><span class="gl">· · ·</span></div></div>
    ${colofonInicio(per)}</div>`;
}
function ir(tab) {
  if (tab === 'resumenes' && V.tab === 'resumenes') V.res = { materia: '', apunte: '', sec: '' }; // tocar la pestaña de nuevo vuelve a las tarjetas
  if (tab === 'simuladores' && V.tab === 'simuladores') V.sim = '';   // tocar la pestaña de nuevo vuelve a las tarjetas
  if (tab === 'novedades') V.nov = '';   // tocar la pestaña vuelve a "Todo"
  V.prac = null; V.errNota = null; V.gAbierto = '';
  const cambia = V.tab !== tab;
  V.tab = tab; history[cambia ? 'pushState' : 'replaceState'](null, '', '#' + hashActual()); render(); window.scrollTo(0, 0);
  if (cambia) focoTitulo();
}
// Al cambiar de pestaña el foco va al título de la pantalla nueva (quien usa lector de pantalla o teclado no queda en el botón anterior).
function focoTitulo() { const h = document.querySelector('#main h2'); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); } }
// Identifica un control para devolverle el foco después de redibujar (si no, quien navega con teclado lo pierde en cada cambio).
const claveFoco = el => el.getAttribute('data-f') || el.id || ((el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 80) + '|' + el.tagName);
function conFoco(raiz, dibujar) {
  const act = document.activeElement, k = act && raiz.contains(act) ? claveFoco(act) : null;
  dibujar();
  if (k) { const el = [...raiz.querySelectorAll('input, select, textarea, button, a[href], summary')].find(x => claveFoco(x) === k); if (el) el.focus({ preventScroll: true }); }
}
// El título de la pestaña del navegador sigue al simulador abierto.
const TITULO_BASE = document.title;
const tituloPagina = () => { if (V.tab === 'arcade') return 'Arcade de Corrección de Estilo · Galera'; const x = V.tab === 'simuladores' && SIMULADORES.find(y => y.id === V.sim); return x ? x.t + ' · Galera' : V.tab === 'simuladores' ? 'Herramientas · Galera' : TITULO_BASE; };
function render() {
  ajustarTab();
  dibujarPestanas();
  dibujarInferior();
  document.body.dataset.tab = V.tab;
  $('#subtitulo').textContent = esPro() ? 'Herramientas, eventos y links para quienes trabajan con libros' : 'Tus materias, tu promedio y tus horarios de ' + (D.plan ? D.plan.nombre : 'Edición');
  document.title = tituloPagina();
  altoCab();
  const gr = grupoDe(V.tab); if (gr) (V.gUlt = V.gUlt || {})[gr[0]] = V.tab;
  conFoco($('#main'), () => { $('#main').innerHTML = (V.demo ? bandaEjemplo() : '') + subnav() + { inicio: vInicio, carrera: vCarrera, horarios: vHorarios, calendario: vCalendario, resumenes: vResumenes, biblioteca: vBiblioteca, simuladores: vSimuladores, glosario: vGlosario, directorio: vDirectorio, links: vLinks, novedades: vNovedades, sostener: vSostener, eventos: vEventos, arcade: vArcade, config: vConfig }[V.tab](); capitulares(); });
}
// Capitular de Iniciales: solo en el título de la pantalla (no en subtítulos) y si empieza con mayúscula y minúscula (nunca en cifras ni siglas, como «2.º cuatrimestre» o «CBC»).
function capitulares() { const h = document.querySelector('#main .titulo-sec h2'); if (h && /^[¿¡]?[A-ZÁÉÍÓÚÑ][a-záéíóúñü]/.test(h.textContent.trim())) h.classList.add('cap'); }
// La banda del ejemplo queda fija justo debajo de la cabecera: se mide su alto.
function altoCab() { const c = document.querySelector('.cabecera'); if (c) document.documentElement.style.setProperty('--alto-cab', c.offsetHeight + 'px'); }
window.addEventListener('resize', altoCab);
// Barra inferior del celular (≤720 px; en escritorio siguen las pestañas de arriba): cuatro destinos directos y "Más" con el resto.
const ICONO = { carrera: 'M4 11l8-6 8 6v8a1 1 0 0 1-1 1h-4v-5H9v5H5a1 1 0 0 1-1-1z', horarios: 'M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 10h16M9 3v4M15 3v4',
  calendario: 'M5 4h14v16H5zM5 9h14M9 13h2M13 13h2M9 16h2', simuladores: 'M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM8 7h8M8 11h2M12 11h2M8 15h2M12 15h2', eventos: 'M5 4h14v16H5zM5 9h14M12 12v5M9.5 14.5h5', glosario: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM9 8h6M9 12h6', links: 'M9 15l6-6M10 7l1-1a3.5 3.5 0 0 1 5 5l-1 1M14 17l-1 1a3.5 3.5 0 0 1-5-5l1-1', resumenes: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11', mas: 'M5 12h.01M12 12h.01M19 12h.01' };
// Grupos de navegación (v66). Mismos nombres para los dos perfiles, con otro contenido; en el celular cada grupo es un botón de la barra y
// sus pestañas aparecen como subnavegación fija arriba. Herramientas (los antiguos Simuladores) es un grupo propio y compartido.
const GRUPOS = {
  estudiante: [['planificar', 'Planificar', 'carrera', ['carrera', 'horarios', 'calendario']], ['estudiar', 'Estudiar', 'resumenes', ['resumenes', 'biblioteca', 'simuladores', 'glosario']]],
  profesional: [['descubrir', 'Eventos', 'eventos', ['eventos', 'directorio', 'links']], ['consultar', 'Consultar', 'resumenes', ['resumenes', 'glosario', 'biblioteca', 'simuladores']]]
};
const gruposActivos = () => GRUPOS[esPro() ? 'profesional' : 'estudiante'];
const grupoDe = tab => gruposActivos().find(g => g[3].includes(tab));
const svgIcono = d => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
function dibujarInferior() {
  const n = $('#inferior'); if (!n) return;
  const G = gruposActivos(), g = grupoDe(V.tab);
  n.innerHTML = G.map(([id, t, ini]) => `<button ${g && g[0] === id ? 'aria-current="page"' : ''} onclick="irGrupo(${arg(id)})">${svgIcono(ICONO[ini])}<span>${t}</span></button>`).join('')
    + `<button ${g || V.tab === 'inicio' ? '' : 'aria-current="page"'} aria-haspopup="dialog" onclick="abrirMas()">${svgIcono(ICONO.mas)}<span>Más</span></button>`;
}
// Tocar un grupo lleva a la última pestaña que usaste en él (o a la primera); tocarlo estando adentro vuelve al inicio de esa pestaña.
function irGrupo(id) {
  const g = gruposActivos().find(x => x[0] === id); if (!g) return;
  ir(g[3].includes(V.tab) ? V.tab : (V.gUlt && V.gUlt[id]) || g[2]);
}
// Subnavegación del celular: pestañas fijas del grupo actual, todas a la vista (en escritorio sigue la barra de arriba).
function subnav() {
  const g = grupoDe(V.tab); if (!g || g[3].length < 2) return '';
  const rot = Object.fromEntries(tabsActivas());
  return `<nav class="sn" aria-label="${g[1]}">${g[3].map(id => `<button type="button" ${V.tab === id ? 'aria-current="page"' : ''} onclick="ir(${arg(id)})">${rot[id]}</button>`).join('')}</nav>`;
}
const filaMas = (t, onclick, actual, sub) => `<li><button type="button" ${actual ? 'aria-current="page"' : ''} onclick="${onclick}"><span>${t}${sub ? `<small>${sub}</small>` : ''}</span><i aria-hidden="true"></i></button></li>`;
function abrirMas() {
  const otras = tabsActivas().filter(([id]) => !grupoDe(id));
  abrir(`${cab('Más')}<ul class="lista-mas">${otras.map(([id, t]) => filaMas(t, `cerrar();ir(${arg(id)})`, V.tab === id)).join('')}</ul>
    <ul class="lista-mas">${filaMas('Cambiar de perfil', 'cerrar();elegirPerfil()', false, esPro() ? 'Ahora: profesional del libro' : 'Ahora: estudiante')}${filaMas('Tus datos', 'abrirDatos()', false, E.copia ? 'Última: ' + fmt(E.copia) : 'Nunca')}${filaMas('Avisame por mail', 'avisame()', false, 'Los lunes, lo nuevo del sitio')}${filaMas('Avisos de progreso', 'abrirAjustes()')}${filaMas('Compartir esta pantalla', 'compartirPantalla()')}${filaMas('Código QR de esta pantalla', 'abrirQRPantalla()', false, 'Para pegar en una cartelera o un apunte')}${puedeInstalar() ? filaMas('Instalar en el celular', 'instalarApp()', false, 'Se abre como una app, también sin conexión') : ''}${filaMas('Sumá tu resumen', 'sumarApunte()', false, 'Para quien viene detrás; lo reviso antes de publicarlo')}${filaMas('Contame qué falta', 'idea()')}</ul>`, 'mas');
}
// Navegación de escritorio (v70, del design system nuevo): grupos en la cabecera, con su fila de secciones debajo; los mismos grupos arman las columnas del pie.
// Un grupo con una sola sección lleva directo a ella. En el celular se usa la barra inferior (GRUPOS).
const GRUPOS_WEB = {
  estudiante: [['Planificar', ['carrera', 'horarios', 'calendario']], ['Estudiar', ['resumenes', 'biblioteca', 'simuladores', 'glosario']], ['Descubrir', ['directorio', 'links']], ['Galera', ['novedades', 'sostener', 'config']]],
  profesional: [['Descubrir', ['eventos', 'directorio', 'links']], ['Consultar', ['resumenes', 'glosario', 'biblioteca', 'simuladores']], ['Galera', ['novedades', 'sostener', 'config']]]
};
const rotuloTab = id => (TODAS_TABS.find(t => t[0] === id) || [id, id])[1];
const CHEVRON = '<svg class="cv" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
function dibujarPestanas() {
  const G = GRUPOS_WEB[esPro() ? 'profesional' : 'estudiante'];
  $('#pestanas').innerHTML = G.map(([n, ids]) => ids.length === 1
    ? `<button type="button" class="tab" ${V.tab === ids[0] ? 'aria-current="page"' : ''} onclick="ir(${arg(ids[0])})">${n}</button>`
    : `<button type="button" class="tab" ${ids.includes(V.tab) ? 'aria-current="page"' : ''} aria-expanded="${V.gAbierto === n}" aria-controls="sub" onclick="alternarGrupo(${arg(n)})">${n}${CHEVRON}</button>`).join('');
  const ab = G.find(g => g[0] === V.gAbierto);
  $('#subw').hidden = !ab;
  $('#sub').setAttribute('aria-label', ab ? ab[0] : 'Secciones del grupo');
  $('#sub').innerHTML = ab ? ab[1].map(id => `<button type="button" ${V.tab === id ? 'aria-current="page"' : ''} onclick="ir(${arg(id)})">${rotuloTab(id)}</button>`).join('') : '';
  // Pie del lienzo: Planificar, Estudiar, Descubrir y Galera (las mismas columnas que el pie de las páginas estáticas).
  const PIE = esPro() ? [['Descubrir', ['eventos', 'directorio', 'links']], ['Consultar', ['resumenes', 'glosario', 'biblioteca', 'simuladores']], ['Galera', ['novedades', 'sostener', 'config']]]
    : [['Planificar', ['carrera', 'horarios', 'calendario']], ['Estudiar', ['resumenes', 'biblioteca', 'simuladores', 'glosario']], ['Descubrir', ['directorio', 'links']], ['Galera', ['novedades', 'sostener', 'config']]];
  $('#pie-nav').innerHTML = PIE.map(([n, ids]) => `<nav aria-label="${n}"><h2>${n}</h2>${ids.map(id => `<button type="button" onclick="ir(${arg(id)})">${({ simuladores: 'Simuladores', config: 'Configuración' })[id] || rotuloTab(id)}</button>`).join('')}${n === 'Galera' ? '<a href="mailto:hola@galera.com.ar">Escribir a Fidel</a><a href="mailto:soporte@galera.com.ar">Soporte</a><a href="/legal/#privacidad">Privacidad</a>' : ''}</nav>`).join('');
  pintarTema(); altoCab();
}
function alternarGrupo(n) { V.gAbierto = V.gAbierto === n ? '' : n; dibujarPestanas(); }
function cerrarGrupo() { if (!V.gAbierto) return false; V.gAbierto = ''; dibujarPestanas(); return true; }
// El botón tocado ya se redibujó cuando el clic llega acá (e.target quedó suelto del DOM): se mira el camino original del evento.
window.addEventListener('click', e => { if (V.gAbierto && !e.composedPath().some(n => n.classList && n.classList.contains('cabecera'))) cerrarGrupo(); });
window.addEventListener('keydown', e => { if (e.key === 'Escape' && cerrarGrupo()) { const b = document.querySelector('.pestanas .tab'); if (b) b.focus(); } });
// Tema: sigue al sistema hasta que se elige uno con el botón de la cabecera (se recuerda en este navegador).
const raizHtml = () => document.documentElement || { dataset: {} };
const temaActual = () => raizHtml().dataset.theme || (typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
function cambiarTema() {
  const t = temaActual() === 'dark' ? 'light' : 'dark';
  raizHtml().dataset.theme = t;
  try { localStorage.setItem('cursada.tema', t); } catch (err) { }
  pintarTema();
}
function pintarTema() {
  const b = $('#tema'); if (!b) return;
  const osc = temaActual() === 'dark';
  b.setAttribute('aria-label', osc ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'); b.title = osc ? 'Modo claro' : 'Modo oscuro'; b.setAttribute('aria-pressed', String(osc));
  b.innerHTML = osc ? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4"/></svg>' : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z"/></svg>';
}

// ---------- notas y promedios ----------
// Cada materia aprobada aporta su nota final; cada aplazo (final desaprobado) aporta la suya.
// Los idiomas no promedian. Se calcula con y sin CBC, y con y sin aplazos.
const num = v => { const n = Number(String(v == null ? '' : v).replace(',', '.')); return n > 0 ? n : null; };
function promedios() {
  const grupos = { cbc: [], carrera: [] };
  let aplazos = 0;
  D.plan.materias.forEach(m => {
    if (m.grupo === 'idiomas') return;
    const e = E.materias[m.id] || {}, g = m.grupo === 'cbc' ? 'cbc' : 'carrera';
    const n = e.estado === 'aprobada' ? num(e.nota) : null;
    if (n) grupos[g].push({ n, aplazo: false });
    (e.aplazos || []).forEach(a => { if (num(a)) { grupos[g].push({ n: num(a), aplazo: true }); aplazos++; } });
  });
  const prom = L => L.length ? L.reduce((s, x) => s + x.n, 0) / L.length : null;
  const sinAp = L => L.filter(x => !x.aplazo);
  const todo = grupos.cbc.concat(grupos.carrera);
  // nSinCbc y nConCbc: sobre cuántas notas sale cada promedio (aprobadas con nota más aplazos).
  return { aplazos, sinCbc: prom(grupos.carrera), conCbc: prom(todo), sinCbcSinAplazos: prom(sinAp(grupos.carrera)), conCbcSinAplazos: prom(sinAp(todo)),
    nSinCbc: grupos.carrera.length, nConCbc: todo.length };
}
const fmtProm = n => n == null ? '—' : n.toFixed(2).replace('.', ',');

// =====================================================================
// MI CARRERA
// =====================================================================
function progreso() {
  const de = g => D.plan.materias.filter(m => m.grupo === g);
  const ok = L => L.filter(m => (E.materias[m.id] || {}).estado === 'aprobada').length;
  const materias = de('cbc').concat(de('grado'));
  return { materias: [ok(materias), materias.length], idiomas: [ok(de('idiomas')), de('idiomas').length], final: [ok(de('final')), de('final').length],
    cursando: D.plan.materias.filter(m => (E.materias[m.id] || {}).estado === 'cursando').length,
    regulares: D.plan.materias.filter(m => (E.materias[m.id] || {}).estado === 'regular').length,
    total: [ok(D.plan.materias), D.plan.materias.length] };
}
// Hay algo cargado: una materia con estado, nota, aplazos o fechas. Sin eso, la pantalla arranca con una sola acción.
const conDatos = () => Object.keys(E.materias).some(id => { const m = E.materias[id]; return m.estado !== 'pendiente' || m.nota || (m.examenes || []).length || (m.aplazos || []).length; });
const diasDesde = s => Math.round((fecha(hoy()) - fecha(s)) / 864e5);

// ---------- elementos de juego ----------
// Todo es informativo: un registro de lo hecho, la comparación con la ronda anterior, el estado del repaso y retos opcionales.
// Sin puntos, niveles, rachas ni rankings; no se manda nada fuera del navegador. Un interruptor en "Mis datos" los apaga a todos.
const juegoOn = () => !!(E.juego && E.juego.on) && !V.demo;
function hito(texto) {
  if (!juegoOn() || E.juego.hitos.some(x => x[1] === texto)) return;
  E.juego.hitos.push([hoy(), texto.slice(0, 140)]);
  if (E.juego.hitos.length > 60) E.juego.hitos.shift();
  aviso('📌 ' + texto);
}
// Las materias que pasan a aprobadas se anotan una sola vez; las que ya estaban al empezar (o al importar una copia vieja) no hacen ruido.
function revisarAprobadas() {
  if (V.demo || !D.plan || !E.juego) return;
  const J = E.juego, ahora = D.plan.materias.filter(m => (E.materias[m.id] || {}).estado === 'aprobada').map(m => m.id);
  if (J.aprob === null) { J.aprob = ahora; return; }
  const nuevas = ahora.filter(id => J.aprob.indexOf(id) < 0);
  if (!nuevas.length) return;
  const antes = J.aprob.length;
  J.aprob = J.aprob.concat(nuevas);
  if (typeof felicitarAprobadas === 'function') felicitarAprobadas(nuevas, hitosCruzados(antes, ahora.length, D.plan.materias.length));   // compartir.js
  if (nuevas.length > 2) hito('Sumaste ' + nuevas.length + ' materias aprobadas');
  else nuevas.forEach(id => hito('Aprobaste ' + nombreDe(datosMateria(id))));
}
const cuandoFue = d => d === hoy() ? 'hoy' : 'el ' + fmt(d);
// Cierre de una ronda de Practicar: cuánto salió, contra la vez anterior de la persona (nunca contra otras) y qué apuntes conviene mirar.
function cerrarRonda() {
  const P = V.prac;
  if (!P || P.cerrada) return;
  P.cerrada = true;
  if (!juegoOn()) return;
  P.previa = E.juego.rondas[P.materia] || null;
  E.juego.rondas[P.materia] = [P.bien, P.cola.length, hoy()];
  hito('Primera ronda de Practicar');
  guardar(true);
}
function cierreRonda(P) {
  if (!juegoOn() || !P.cerrada) return '';
  const pr = P.previa, f = Object.values(P.fallos || {}).slice(0, 4);
  const comp = pr ? (P.bien * pr[1] > pr[0] * P.cola.length ? `Te salieron más que la vez anterior (${pr[0]} de ${pr[1]}, ${cuandoFue(pr[2])}).` : `La vez anterior fueron ${pr[0]} de ${pr[1]} (${cuandoFue(pr[2])}).`) : '';
  if (!comp && !f.length) return '';
  return `<div class="cierre-ronda chico">${comp ? `<p class="u-mb6">${comp}</p>` : ''}${f.length ? `<p class="u-m0">Si querés mirarlos de nuevo: ${f.map(a => `<button class="enlace" onclick="abrirApunte(${arg(P.materia)},${arg(a.id)})">${esc(a.clave)}: ${esc(a.t)}</button>`).join(' · ')}</p>` : ''}</div>`;
}
// Cómo viene el repaso de un apunte: se mira solo lo que se practicó. "Podés repasar" no es un vencimiento: es una sugerencia.
function repasoDe(mid, a) {
  const pref = mid + '/' + a.id + '/', vs = Object.keys(E.practica).filter(k => k.indexOf(pref) === 0).map(k => E.practica[k]);
  if (!vs.length) return null;
  return vs.some(r => r[1] > r[0]) || diasDesde(vs.map(r => r[2]).sort().pop()) >= 7 ? 'podés repasar' : 'fresco';
}
function chipRepaso(mid, a) {
  if (!juegoOn()) return '';
  const r = repasoDe(mid, a);
  return r === 'fresco' ? '<span class="chip ok">repaso: fresco</span>' : r ? '<span class="chip tin">repaso: podés repasar</span>' : E.leidos[mid + '/' + a.id] ? '' : '<span class="chico tenue">sin ver</span>';
}
// Al volver después de unos días: un solo aviso, sin conteo de días, dentro de Resúmenes (no en la pantalla de inicio).
function retomar() {
  if (!juegoOn() || V.retomado || V.ausencia < 3 || !E.juego.ultimo) return '';
  const [mid, aid] = E.juego.ultimo.split('/'), M = ((D.resumenes || {}).materias || []).find(x => x.id === mid), A = M && M.apuntes.find(x => x.id === aid);
  if (!A) return '';
  return `<div class="recordatorio retomar chico"><span class="crece">📖 Lo último que viste: <b>${esc(M.nombre)}</b>, ${esc(A.t)}.</span>
    <button class="btn ch" onclick="V.retomado=true;abrirApunte(${arg(mid)},${arg(aid)})">Seguir ahí</button><button class="btn lin ch" onclick="V.retomado=true;render()">Empezar otra cosa</button></div>`;
}
// Retos de los simuladores (retos.js): la condición la verifica el propio simulador, y hay más de una solución.
function vRetos(sim) {
  const L = Retos.POR_SIM[sim] || [];
  if (!L.length || !juegoOn()) return '';
  const est = E[Retos.CLAVE_EST[sim]], hechos = L.filter(r => E.juego.retos[r.id]).length;
  return `<details class="tarjeta reto" ${V.retos ? 'open' : ''} ontoggle="V.retos=this.open"><summary><b><span aria-hidden="true">🎯</span> Retos opcionales</b> <span class="chip" id="retos-n">${hechos} de ${L.length} resueltos</span></summary>
    <p class="chico tenue">Situaciones para practicar lo que enseña la cátedra, sin tiempo ni puntaje y con más de una solución. «Preparar el reto» carga el caso en este simulador y reemplaza lo que tengas cargado acá.</p>
    ${L.map(r => `<div class="reto-it"><p class="u-m0"><b>${esc(r.t)}</b> <span class="chip ok" data-reto-ok="${r.id}" ${E.juego.retos[r.id] ? '' : 'hidden'}>✓ resuelto</span></p>
      <p class="chico u-margin-4px-0">${esc(r.enun)}</p><p class="u-mb6 chico tenue" data-reto="${r.id}">${esc(est ? r.ahora(est) : '')}</p>
      <button class="btn sec ch" onclick="prepararReto(${arg(sim)},${arg(r.id)})">Preparar el reto</button></div>`).join('')}</details>`;
}
function prepararReto(sim, id) {
  const r = (Retos.POR_SIM[sim] || []).find(x => x.id === id);
  if (!r) return;
  E[Retos.CLAVE_EST[sim]] = r.prep(); V.retos = true; guardar(); render(); aviso('Reto cargado: ' + r.t);
}
function retosRefrescar() {
  if (!juegoOn() || V.tab !== 'simuladores') return;
  const L = Retos.POR_SIM[V.sim] || [], est = E[Retos.CLAVE_EST[V.sim]];
  L.forEach(r => {
    const t = document.querySelector(`[data-reto="${r.id}"]`), c = document.querySelector(`[data-reto-ok="${r.id}"]`);
    if (t) t.textContent = est ? r.ahora(est) : '';
    if (!E.juego.retos[r.id] && est && r.ok(est)) { E.juego.retos[r.id] = hoy(); hito('Resolviste el reto «' + r.t + '»'); guardar(true); }
    if (c) c.hidden = !E.juego.retos[r.id];
  });
  const n = $('#retos-n'); if (n) n.textContent = L.filter(r => E.juego.retos[r.id]).length + ' de ' + L.length + ' resueltos';
}
// Recorrido de una materia aprobada: un texto sobrio con lo que hiciste. Nada sale del navegador: se copia o se baja a mano, y la nota va solo si la tildás.
function textoRecorrido(id) {
  const m = datosMateria(id), e = mat(id), o = opcion(m), rid = (o && o.id) || m.id, R = ((D.resumenes || {}).materias || []).find(x => x.id === rid);
  const L = [`Aprobé ${nombreDe(m)}${e.aprobada ? ' el ' + fecha(e.aprobada).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}${e.cuando ? ' (' + e.cuando + ')' : ''}.`];
  if (V.recNota && num(e.nota)) L.push('Nota final: ' + e.nota + '.');
  if (R) L.push(`Apuntes leídos: ${leidosDe(R)} de ${R.apuntes.length}.`);
  const ks = Object.keys(E.practica).filter(k => k.indexOf(rid + '/') === 0);
  if (ks.length) L.push(`Preguntas practicadas: ${ks.length} distintas, ${ks.reduce((t, k) => t + E.practica[k][0] + E.practica[k][1], 0)} respuestas en total.`);
  return L;
}
function abrirRecorrido(id) {
  const L = textoRecorrido(id);
  abrir(cab('📋 Mi recorrido') + `<p class="u-mt0 chico tenue">Es un resumen para vos: se arma con lo que cargaste en este navegador y no se manda a ningún lado. Si querés compartirlo, copialo o bajalo vos.</p>
    <div class="tarjeta">${L.map(x => `<p class="u-margin-4px-0">${esc(x)}</p>`).join('')}</div>
    <label class="elige ${V.recNota ? 'on' : ''}"><input type="checkbox" data-f="rec-nota" ${V.recNota ? 'checked' : ''} onchange="V.recNota=this.checked;abrirRecorrido(${arg(id)})"><span>Incluir la nota final</span></label>
    <div class="botones"><button class="btn" onclick="copiarRecorrido(${arg(id)})">Copiar el texto</button><button class="btn sec" onclick="bajarRecorrido(${arg(id)})">Descargar (.txt)</button><button class="btn lin" onclick="cerrar()">Cerrar</button></div>`, 'rec:' + id);
}
function copiarRecorrido(id) {
  const t = textoRecorrido(id).join('\n');
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(() => aviso('Texto copiado'), () => aviso('No se pudo copiar. Seleccioná el texto y copialo a mano.'));
  else aviso('No se pudo copiar. Seleccioná el texto y copialo a mano.');
}
function bajarRecorrido(id) { descargar('mi-recorrido-' + id + '.txt', textoRecorrido(id).join('\n') + '\n', 'text/plain'); }
function setJuego(on) { E.juego.on = !!on; guardar(true); render(); abrirAjustes(); }
function borrarHitos() { E.juego.hitos = []; guardar(true); abrirAjustes(); }
function abrirAjustes() { abrir(cab('Ajustes') + bloqueJuego(), 'ajustes'); }
// Compartir la pantalla actual: el menú del sistema si existe; si no, se copia el link.
function compartirPantalla() {
  const url = location.href, titulo = document.title, texto = 'Mirá esto en Galera, el gestor para la carrera de Edición (FFyL, UBA).';
  const nativo = !!navigator.share;
  medir('share', { method: nativo ? 'nativo' : 'copiar', content_type: 'pantalla', item_id: V.tab });
  if (nativo) navigator.share({ title: titulo, text: texto, url }).catch(() => { });
  else if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(() => aviso('Link copiado'), () => aviso('No se pudo copiar: el link quedó en la barra de direcciones'));
  else aviso('No se pudo copiar: el link quedó en la barra de direcciones');
}
function bloqueJuego() {
  const J = E.juego, H = J.hitos.slice().reverse();
  return `<div class="titulo-sec u-margin-top-14px"><h3>Avisos de progreso</h3></div>
    <label class="elige ${J.on ? 'on' : ''}"><input type="checkbox" data-f="juego-on" ${J.on ? 'checked' : ''} onchange="setJuego(this.checked)"><span>Mostrar avisos de progreso y retos</span></label>
    <p class="chico tenue u-margin-top-6px">Son ayudas para ver cuánto avanzaste: el cierre de cada ronda de Practicar, el estado del repaso de cada apunte, retos en los simuladores, un aviso para retomar y el registro de lo que hiciste. No hay puntos, niveles ni rachas, no te comparan con nadie y no salen de este navegador.</p>
    ${H.length ? `<details class="registro"><summary>Lo que ya hiciste (${H.length})</summary><ul>${H.map(x => `<li><span class="tenue">${fmt(x[0])}</span> ${esc(x[1])}</li>`).join('')}</ul>
      <button class="btn lin ch" onclick="borrarHitos()">Borrar este registro</button></details>` : ''}`;
}
// Aprobadas sin nota: sin eso no hay promedio, así que se pide a la vista y no en letra chica.
function faltanNotas() {
  if (V.demo) return '';
  const sin = D.plan.materias.filter(m => m.grupo !== 'idiomas' && (E.materias[m.id] || {}).estado === 'aprobada' && !num((E.materias[m.id] || {}).nota));
  if (!sin.length) return '';
  return `<div class="recordatorio chico"><span class="crece">📝 <b>${sin.length === 1 ? 'Falta 1 nota' : 'Faltan ' + sin.length + ' notas'}</b> para tu promedio: ${esc(sin.slice(0, 3).map(m => m.nombre).join(', '))}${sin.length > 3 ? ' y ' + (sin.length - 3) + ' más' : ''}.</span>
    <button class="btn ch" onclick="abrirMateria(${arg(sin[0].id)})">Cargar nota</button></div>`;
}
function vCarrera() {
  const h = [];
  if (!conDatos()) h.push(vPortada());
  else {
    const p = progreso(), pr = promedios();
    const dato = (n, t, barra) => `<div class="dato"><b>${n}</b><span>${t}</span>${barra != null ? `<div class="barra"><i style="width:${barra}%"></i></div>` : ''}</div>`;
    // Avance: cada requisito del plan (CBC, materias de grado, niveles de idioma y pasantía o tesina) pesa lo mismo.
    const av = Math.round(p.total[0] * 100 / p.total[1]), avReg = Math.round(p.regulares * 100 / p.total[1]);
    const avance = `<div class="avance"><div class="aro" style="--p:${av};--r:${av + avReg}" role="progressbar" aria-label="Avance de la carrera" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${av}"><b>${av}&#8239;%</b></div>
      <div class="crece"><b>Llevás el ${av} % de la carrera</b><span class="chico tenue">${p.total[0]} de ${p.total[1]} requisitos aprobados${p.regulares ? ` · ${p.regulares} con el final pendiente (en mostaza)` : ''}</span>
        ${p.total[1] > p.total[0] ? `<span class="chico">Te ${p.total[1] - p.total[0] === 1 ? 'falta 1 requisito' : 'faltan ' + (p.total[1] - p.total[0]) + ' requisitos'}: <button class="enlace" type="button" onclick="V.vista='recorrido';render()">ver qué sigue</button></span>` : ''}</div></div>`;
    const n = pr.nSinCbc, notas = k => k + (k === 1 ? ' nota' : ' notas');
    // Solo los indicadores que dicen algo: los que están en cero no se muestran.
    h.push(`<div class="tarjeta">${avance}<div class="resumen">
      ${dato(p.materias[0] + '<small class="tenue u-font-size-1rem"> / ' + p.materias[1] + '</small>', 'materias aprobadas', Math.round(p.materias[0] * 100 / p.materias[1]))}
      ${p.idiomas[0] ? dato(p.idiomas[0] + '<small class="tenue u-font-size-1rem"> / ' + p.idiomas[1] + '</small>', 'niveles de idioma', Math.round(p.idiomas[0] * 100 / p.idiomas[1])) : ''}
      ${n ? dato(fmtProm(pr.sinCbc), 'promedio sin CBC · sobre ' + notas(n)) : ''}
      ${p.cursando ? dato(p.cursando, 'cursando ahora') : ''}${p.regulares ? dato(p.regulares, 'finales pendientes') : ''}${p.final[0] ? dato('✓', 'pasantía o tesina') : ''}</div>
      <p class="chico tenue u-margin-12px-0-0">${pr.nConCbc > n ? `Con el CBC: ${fmtProm(pr.conCbc)}, sobre ${notas(pr.nConCbc)}. ` : ''}${pr.aplazos ? `<b>Con ${pr.aplazos} ${pr.aplazos === 1 ? 'aplazo' : 'aplazos'}.</b> Sin contarlos: ${fmtProm(pr.sinCbcSinAplazos)} sin CBC y ${fmtProm(pr.conCbcSinAplazos)} con CBC. ` : ''}
        ${n ? `El promedio usa la nota final de cada materia aprobada${pr.aplazos ? '' : ' y los aplazos que cargues en cada materia'}; los idiomas no promedian.` : 'Para ver tu promedio, cargá la nota de cada materia aprobada.'}</p>
      ${faltanNotas()}
      ${proximo()}${recordatorioCopia()}
      <p class="chico compartir"><span class="tenue">¿Le sirve a alguien de tu cursada?</span> <button class="enlace" onclick="compartirCursada('carrera')">Pasásela por WhatsApp</button> · <button class="enlace" onclick="compartirAvance()">Mi avance en imagen</button> · <button class="enlace" onclick="abrirPasarAmigo()">Pasarle mi plan a un amigo</button> · <button class="enlace" onclick="abrirLogros()">Mis logros</button></p></div>`);
  }
  const lateral = conDatos() ? h.splice(0) : null;
  h.push(`<div class="u-mb10 fila"><div class="seg" role="group" aria-label="Vista"><button class="${V.vista === 'tabla' ? 'on' : ''}" aria-pressed="${V.vista === 'tabla'}" onclick="V.vista='tabla';render()">Tabla</button>
    <button class="${V.vista === 'recorrido' ? 'on' : ''}" aria-pressed="${V.vista === 'recorrido'}" onclick="V.vista='recorrido';render()">Recorrido sugerido</button></div><span class="crece"></span>
    ${conDatos() ? '<button class="btn sec ch" onclick="exportar()">⬇ Guardar una copia</button>' : ''}<button class="btn lin ch" onclick="window.print()">Imprimir</button></div>
    <p class="chico tenue u-margin-0-0-10px">${esc(D.plan.requisitos)} ${esc(D.plan.nota)}</p>`);
  h.push(V.vista === 'recorrido' ? vRecorrido() : D.plan.grupos.map(vGrupo).join(''));
  if (D.plan.verificado) h.push(`<p class="chico tenue verificado">✓ Datos verificados el ${fmt(D.plan.verificado)}. ${esc(D.plan.verificado_nota || '')}</p>`);
  return `<div class="carrera-2${lateral ? '' : ' solo'}">${lateral ? `<aside class="lateral">${lateral.join('')}</aside>` : ''}<div class="plan">${h.join('')}</div></div>`;
}
// Primera vez (o sin nada cargado): qué gana la persona, una sola acción y, como mucho, lo próximo del calendario.
function vPortada() {
  return `<div class="tarjeta portada"><h2>Armá tu cursada sin superposiciones y llevá tu promedio al día.</h2>
    <p class="chico tenue">Gratis y sin cuenta: lo que cargás queda solo en este navegador. <button class="enlace" onclick="abrirDatos()">Cómo funciona</button></p>
    <p><button class="btn" onclick="marcarRapido()">Marcar las materias que ya aprobé</button></p>
    <p class="chico">¿Querés ver cómo queda antes de cargar nada? <button class="enlace" onclick="verEjemplo()">Miralo con un ejemplo</button>.</p>
    <p class="chico">¿Recién empezás la carrera? <a href="ingresantes/">Mirá la guía del ingresante</a>: qué anotarte en el primer cuatrimestre.</p>
    ${proximo()}</div>`;
}
// Lo próximo que importa: la fecha más cercana de la persona o del calendario (inscripciones, exámenes y trámites).
function proximo() {
  const t = hoy(), cal = ((D.calendario || {}).eventos || []).filter(e => ['inscripcion', 'examen', 'tramite'].indexOf(e.tipo) >= 0);
  const e = cal.concat(misFechas()).filter(x => x.hasta >= t).sort((a, b) => a.desde < b.desde ? -1 : a.desde > b.desde ? 1 : 0)[0];
  const rep = repasos().find(r => r.desde === t);
  if (!e && !rep) return '';
  return `<p class="proximo chico">${e ? `<span class="tenue">Lo que viene:</span> <b>${esc(e.t)}</b>, ${e.desde < t ? 'hasta el ' + fmt(e.hasta) : fmtRango(e.desde, e.hasta)}. <button class="enlace" onclick="ir('calendario')">Ver el calendario</button>` : ''}
    ${rep ? `${e ? '<br>' : ''}<span aria-hidden="true">🧠</span> Hoy toca repasar ${esc(rep.nombre)}: <button class="enlace" onclick="empezarPractica(${arg(rep.res)})">practicar ${RONDA} preguntas</button>` : ''}</p>`;
}
// La copia, recordada donde sirve: cuando ya hay algo que perder y nunca se bajó, o cuando cambió desde la última (y pasó un mes).
function recordatorioCopia() {
  if (V.demo) return '';
  const cargadas = Object.keys(E.materias).filter(id => E.materias[id].estado !== 'pendiente').length;
  if (cargadas < 3 || (E.copia && (E.modif <= E.copia || diasDesde(E.copia) < 30))) return '';
  return `<div class="recordatorio chico"><span class="crece">💾 ${E.copia ? `Tu última copia es del ${fmt(E.copia)} y después cargaste cosas nuevas.` : `Ya cargaste ${cargadas} materias.`}
    Con una copia las recuperás si cambiás de celular o se borran los datos del navegador.</span><button class="btn sec ch" onclick="exportar()">Guardar una copia</button></div>`;
}
// Compartir: WhatsApp es por donde circula todo en la cursada. El mensaje es el mismo que el del mail de los lunes.
const MSJ_COMPARTIR = 'Te paso Galera: llevás las materias de Edición, el promedio y armás los horarios sin superposiciones. Gratis y sin cuenta 👉 https://galera.com.ar/';
function compartirCursada(donde) {
  medir('share', { method: 'whatsapp', content_type: 'cursada', item_id: donde });
  window.open('https://wa.me/?text=' + encodeURIComponent(MSJ_COMPARTIR), '_blank', 'noopener');
}
// Carga rápida: todas las materias en una lista, con «Aprobada» y «La curso». Las notas y las fechas, después, en cada materia.
function marcarRapido() {
  const fila = m => { const e = E.materias[m.id] || {};
    return `<div class="rapida"><span class="crece">${esc(nombreDe(m))}</span>
      <label class="chico"><input type="checkbox" data-f="ra-${esc(m.id)}" ${e.estado === 'aprobada' ? 'checked' : ''} onchange="marcaRapida(${arg(m.id)},'aprobada',this.checked)"> Aprobada</label>
      <label class="chico"><input type="checkbox" data-f="rc-${esc(m.id)}" ${e.estado === 'cursando' ? 'checked' : ''} onchange="marcaRapida(${arg(m.id)},'cursando',this.checked)"> La curso</label></div>`; };
  abrir(cab('¿Qué materias ya aprobaste?') + `<p class="u-mt0 chico tenue">Tildá las que aprobaste y las que estás cursando. Las notas y las fechas se cargan después, tocando cada materia.</p>
    ${D.plan.grupos.map(g => `<div class="c">${esc(g.nombre)}</div>` + D.plan.materias.filter(m => m.grupo === g.id).map(fila).join('')).join('')}
    <div class="botones"><button class="btn" onclick="cerrar();listoRapido()">Listo</button></div>`, 'rapido');
}
function marcaRapida(id, estado, si) {
  const e = mat(id);
  e.estado = si ? estado : e.estado === estado ? 'pendiente' : e.estado;
  guardar(); render(); marcarRapido();
}
function listoRapido() { if (conDatos()) { const p = progreso(); aviso('Listo: llevás el ' + Math.round(p.total[0] * 100 / p.total[1]) + ' % de la carrera'); window.scrollTo(0, 0); } }
// Ejemplo: una carrera a mitad de camino, para ver cómo queda antes de cargar nada. Mientras se mira, no se guarda nada.
function ejemploCarrera() {
  const en = d => { const x = new Date(); x.setDate(x.getDate() + d); return iso(x); };
  const ap = (nota, aprobada) => ({ estado: 'aprobada', nota, aprobada, examenes: [] });
  return normalizar({ v: 1, materias: {
    ipc: ap('8', '2023-07-12'), icse: ap('7', '2023-12-06'), '0902': ap('9', '2024-07-10'), '0913': ap('8', '2024-11-20'), '0915': ap('7', '2024-07-03'),
    '0916': ap('9', '2025-07-02'), '0918': ap('8', '2025-07-09'), '0919': ap('10', '2025-06-25'), ingles1: ap('7', '2024-12-04'),
    '0914': { estado: 'regular', examenes: [{ id: 'ej1', tipo: 'Final', fecha: en(45), hora: '18:00', detalle: '', nota: '' }] },
    '0911': { estado: 'cursando', examenes: [{ id: 'ej2', tipo: 'Parcial', fecha: en(9), hora: '16:00', detalle: '', nota: '' }] },
    '0905': { estado: 'cursando', examenes: [{ id: 'ej3', tipo: 'Parcial', fecha: en(16), hora: '', detalle: 'Entrega del proyecto', nota: '' }] },
    '0909': { estado: 'cursando', examenes: [] } } });
}
const bandaEjemplo = () => `<div class="banda-ejemplo"><span class="crece"><b>Estás viendo un ejemplo.</b> Tocá lo que quieras: no se guarda nada.</span><button class="btn ch" onclick="salirEjemplo()">Salir del ejemplo</button></div>`;
function verEjemplo() { if (V.demo) return; V.demo = E; E = ejemploCarrera(); V.tab = 'carrera'; cerrar(); render(); window.scrollTo(0, 0); medir('ver_ejemplo'); }
function salirEjemplo() { if (!V.demo) return; E = V.demo; V.demo = null; render(); window.scrollTo(0, 0); }
function proximaFecha(id) {
  const ex = ((E.materias[id] || {}).examenes || []).filter(x => x.fecha && x.fecha >= hoy()).sort((a, b) => a.fecha < b.fecha ? -1 : 1)[0];
  return ex ? `<span class="chip mos">${esc(ex.tipo)}: ${fmt(ex.fecha)}</span>` : '';
}
function vGrupo(g) {
  const L = D.plan.materias.filter(m => m.grupo === g.id);
  return `<div class="titulo-sec plan-h"><h2>${esc(g.nombre)}</h2><span class="chico tenue">${L.filter(m => (E.materias[m.id] || {}).estado === 'aprobada').length} de ${L.length}</span></div>
    ${g.ayuda ? `<p class="chico tenue u-margin-4px-0-8px">${esc(g.ayuda)}</p>` : ''}
    <div class="plan-tabla"><table class="tabla"><thead><tr><th>Materia</th><th>Se dicta</th><th>Estado</th><th>Nota</th><th><span class="solo-lector">Programa</span></th></tr></thead><tbody>
    ${L.map(m => {
      const e = E.materias[m.id] || { estado: 'pendiente' }, o = opcion(m);
      const cuat = (o && o.cuat) || m.cuat || [], reg = (o && o.regimen) || m.regimen, regNota = (o && o.regimen_nota) || m.regimen_nota, progs = programas(m, o);
      // Las electivas con opciones fijas se eligen acá mismo (los seminarios y la pasantía o tesina, desde su ficha).
      const elige = m.opciones && m.id !== 'final' ? `<select class="elige-op" data-f="op${esc(m.id)}" aria-label="¿Cuál cursaste o vas a cursar? (${esc(m.nombre)})" onchange="campo(${arg(m.id)},'opcion',this.value)">
        <option value="">¿Cuál elegiste?</option>${m.opciones.map(x => `<option value="${esc(x.id)}" ${e.opcion === x.id ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('')}</select>` : '';
      return `<tr class="${e.estado}"><td class="plan-n">${iconoEstado(e.estado)}<div class="plan-c"><button class="nombre" onclick="abrirMateria(${arg(m.id)})">${esc(nombreDe(m))}</button>${elige}
        <div class="chico tenue">${m.codigo || (o && o.codigo) ? esc(m.codigo || o.codigo) + ' · ' : ''}${m.electiva && !o && !(m.libre && e.detalle) && !elige ? 'A elegir · ' : ''}${reg ? esc(reg) : ''}${regNota ? ` <span class="chip ojo" title="${esc(regNota)}">cambió</span>` : ''} ${proximaFecha(m.id)}${(e.aplazos || []).length ? ` <span class="chip mal">${e.aplazos.length} ${e.aplazos.length === 1 ? 'aplazo' : 'aplazos'}</span>` : ''}</div></div></td>
        <td class="ctl">${cuat.map(c => `<span class="chip">${c}</span>`).join(' ')}</td>
        <td class="ctl" data-rot="Estado"><select aria-label="Estado de ${esc(m.nombre)}" onchange="setEstado(${arg(m.id)},this.value)">${Object.keys(ESTADOS).map(k => `<option value="${k}" ${e.estado === k ? 'selected' : ''}>${ESTADOS[k]}</option>`).join('')}</select></td>
        <td class="ctl" data-rot="Nota"><input class="nota" maxlength="5" inputmode="decimal" placeholder="Nota" aria-label="Nota de ${esc(m.nombre)}" value="${esc(valorNota(m.id, e))}"${attrsNota(m.id)} onchange="setNota(${arg(m.id)},this.value)">${msgNota(m.id)}</td>
        <td class="ctl">${progs.length === 1 ? `<a class="chico" href="${urlSegura(progs[0].url)}" target="_blank" rel="noopener">Programa</a>`
          : progs.length ? `<button class="enlace chico" onclick="abrirMateria(${arg(m.id)})">Programas</button>` : ''}</td></tr>`;
    }).join('')}</tbody></table></div>`;
}
function setEstado(id, estado) { mat(id).estado = estado; guardar(); render(); }
// El error de la nota se muestra junto al campo y conserva lo escrito (V.errNota = { id, v, msg, aplazo }).
const errNota = id => V.errNota && V.errNota.id === id ? V.errNota : null;
const attrsNota = id => errNota(id) ? ` aria-invalid="true" aria-describedby="err-nota-${esc(id)}"` : '';
const valorNota = (id, e) => errNota(id) ? errNota(id).v : e.nota || '';
const msgNota = id => { const x = errNota(id); return x ? `<span class="err-nota" id="err-nota-${esc(id)}" role="alert">${x.msg}${x.aplazo ? ` <button type="button" class="enlace chico" onclick="notaComoAplazo(${arg(id)})">Cargalo como aplazo</button>` : ''}</span>` : ''; };
function notaComoAplazo(id) {
  const x = errNota(id); if (!x || !x.aplazo) return;
  const m = mat(id); m.aplazos = (m.aplazos || []).concat(x.aplazo); V.errNota = null; guardar(); render();
}
function setNota(id, v) {
  const n = String(v).trim().replace(',', '.');
  if (n && !(Number(n) >= 1 && Number(n) <= 10)) { V.errNota = { id, v: String(v), msg: 'La nota va de 1 a 10.' }; render(); return; }
  if (n && Number(n) < 4) {
    const entera = /^[123]$/.test(n);
    V.errNota = { id, v: String(v), msg: entera ? 'Con menos de 4 es aplazo.' : 'Con menos de 4 es aplazo. Cargalo como 1, 2 o 3 en «Aplazos», dentro de la materia.', aplazo: entera ? n : '' };
    render(); return;
  }
  V.errNota = null;
  mat(id).nota = n.replace('.', ',');
  if (n && Number(n) >= 4 && mat(id).estado !== 'aprobada') mat(id).estado = 'aprobada';
  guardar(); render();
}
const MARCA = { cursando: 'cursando', regular: 'regular', aprobada: 'aprobada' };
// Íconos de estado de la hoja Marca: cuarto de círculo + palabra + color (se leen igual en escala de grises).
const iconoEstado = est => `<span class="ge ${ESTADO_CLS[est] || 'pen'}" aria-hidden="true"></span>`;
const ESTADO_CLS = { pendiente: 'pen', cursando: 'cur', regular: 'reg', aprobada: 'ok' };
const chipEstado = est => `<span class="tag-est ${ESTADO_CLS[est] || 'pen'}">${iconoEstado(est)}${esc(ESTADOS[est] || ESTADOS.pendiente)}</span>`;
function vRecorrido() {
  const celdas = [];
  D.plan.areas.forEach(a => {
    celdas.push(`<div class="area">${esc(a)}</div>`);
    for (let mod = 1; mod <= 4; mod++) {
      celdas.push('<div class="celda">' + D.plan.materias.filter(m => m.area === a && m.modulo === mod).map(m =>
        { const est = (E.materias[m.id] || {}).estado || 'pendiente';
          return `<button class="mat ${est}" onclick="abrirMateria(${arg(m.id)})">${esc(nombreDe(m))}${est === 'pendiente' ? '' : `<span class="marca-estado">${iconoEstado(est)}${MARCA[est]}</span>`}</button>`; }).join('') + '</div>');
    }
  });
  return `<p class="chico tenue">Orden sugerido por el Departamento de Edición, por áreas. No es obligatorio: la carrera no tiene correlatividades.
    ${['pendiente', 'cursando', 'regular', 'aprobada'].map(chipEstado).join(' ')}</p>
    <div class="recorrido"><div></div>${[1, 2, 3, 4].map(n => `<div class="cab">Módulo ${n}</div>`).join('')}${celdas.join('')}</div>
    <p class="chico tenue u-margin-top-12px">Idiomas y pasantía o tesina no figuran acá: se cursan en paralelo. Están en la vista Tabla.</p>`;
}

// ---------- ficha de una materia ----------
// k identifica el diálogo: si se redibuja el mismo (por ejemplo, al agregar un parcial), conserva el scroll y el foco.
function abrir(html, k) {
  const d = $('#dlg'), mismo = d.open && k && d.dataset.k === k, y = mismo ? $('.in', d).scrollTop : 0;
  const dibujar = () => { d.innerHTML = `<div class="in">${html}</div>`; };
  if (mismo) conFoco(d, dibujar); else dibujar();
  d.dataset.k = k || '';
  // Cada rótulo queda asociado a su control (para lectores de pantalla y para que el clic en el rótulo enfoque el campo).
  d.querySelectorAll('label.c').forEach((l, i) => {
    const c = l.nextElementSibling && (l.nextElementSibling.matches('input, select, textarea') ? l.nextElementSibling : l.nextElementSibling.querySelector('input, select, textarea'));
    if (c) { c.id = c.id || 'c' + i; l.htmlFor = c.id; }
  });
  if (!d.open) d.showModal();
  $('.in', d).scrollTop = y;
}
// Confirmación propia (reemplaza a confirm()): los botones dicen la acción. Devuelve una promesa.
function confirmar(msg, si, no) {
  return new Promise(res => {
    const d = document.createElement('dialog'); d.className = 'conf'; d.setAttribute('aria-label', msg);
    d.innerHTML = `<div class="in"><p class="u-mt0">${esc(msg)}</p><p class="fila u-justify-content-flex-end"><button class="btn sec" type="button" data-r="0">${esc(no || 'Mejor no')}</button><button class="btn" type="button" data-r="1">${esc(si || 'Seguir')}</button></p></div>`;
    d.addEventListener('close', () => { d.remove(); res(d.returnValue === '1'); });
    d.addEventListener('click', e => { const b = e.target.closest('[data-r]'); if (b) d.close(b.dataset.r); else if (e.target === d) d.close('0'); });
    document.body.appendChild(d); d.showModal(); $('[data-r="0"]', d).focus();
  });
}
function cerrar() { const d = $('#dlg'); if (d.open) d.close(); }
$('#dlg').addEventListener('click', e => { if (e.target.id === 'dlg') cerrar(); });
// El emoji que abre un título se oculta al lector de pantalla (no lo lee como parte del nombre).
const emo = t => String(t).replace(/^(\p{Extended_Pictographic}️?)\s*/u, '<span aria-hidden="true">$1</span> ');
const cab = t => `<div class="cab"><h2 class="crece" id="dlg-t">${emo(t)}</h2><button class="x" onclick="cerrar()" aria-label="Cerrar">✕</button></div>`;
const val = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };

// ---------- donar: vive en la pantalla «Cómo se sostiene» (vSostener) ----------
function copiar(t) {
  const listo = () => aviso('Copiado: ' + t);
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(listo, () => aviso('No se pudo copiar. Seleccioná el texto y copialo a mano.'));
  else aviso('No se pudo copiar. Seleccioná el texto y copialo a mano.');
}

function abrirMateria(id) {
  const m = datosMateria(id), e = mat(id), o = opcion(m);
  const progs = programas(m, o), reg = (o && o.regimen) || m.regimen, regNota = (o && o.regimen_nota) || m.regimen_nota, previas = (o && o.previas) || m.previas;
  const recursos = (D.plan.recursos || {})[(o && o.id) || m.id] || [];
  abrir(cab(esc(nombreDe(m))) + `
    <p class="u-m0 chico tenue">${[m.codigo || (o && o.codigo), m.area, m.modulo ? 'módulo ' + m.modulo : '', reg].filter(Boolean).map(esc).join(' · ')}</p>
    ${regNota ? `<p class="u-my6 chico">⚠️ ${esc(regNota)} <span class="tenue">Si cursaste otro año, vale el régimen de tu cursada.</span></p>` : ''}
    ${m.ayuda ? `<p class="chico">${esc(m.ayuda)}</p>` : ''}
    ${previas ? `<p class="u-my6 chico">💡 ${esc(previas)} <span class="tenue">(Sugerencia: la carrera no tiene correlatividades.)</span></p>` : ''}
    ${m.opciones ? `<label class="c">¿Cuál elegís?</label><select id="m-op" onchange="campo(${arg(id)},'opcion',this.value);abrirMateria(${arg(id)})"><option value="">Todavía no sé</option>${m.opciones.map(x => `<option value="${x.id}" ${e.opcion === x.id ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('')}</select>` : ''}
    ${m.libre ? `<label class="c">¿Qué seminario?</label><input id="m-det" maxlength="200" class="u-w100" value="${esc(e.detalle || '')}" placeholder="Nombre del seminario" onchange="campo(${arg(id)},'detalle',this.value)">` : ''}
    <div class="fila"><div class="crece"><label class="c">Estado</label><p class="u-m0">${chipEstado(e.estado)}</p><select class="u-w100" aria-label="Cambiar el estado" onchange="campo(${arg(id)},'estado',this.value)">${Object.keys(ESTADOS).map(k => `<option value="${k}" ${e.estado === k ? 'selected' : ''}>${ESTADOS[k]}</option>`).join('')}</select></div>
      <div><label class="c">Nota final</label><input class="nota u-width-90px" maxlength="5" inputmode="decimal" value="${esc(valorNota(id, e))}"${attrsNota(id)} onchange="setNota(${arg(id)},this.value)">${msgNota(id)}</div></div>
    <div class="fila"><div class="crece"><label class="c">Cuándo la cursaste o cursás</label><input maxlength="80" class="u-w100" value="${esc(e.cuando || '')}" placeholder="Ej.: 2.º cuatrimestre 2026" onchange="campo(${arg(id)},'cuando',this.value)"></div>
      <div><label class="c">Fecha de aprobación</label><input type="date" value="${esc(e.aprobada || '')}" onchange="campo(${arg(id)},'aprobada',this.value)"></div></div>
    <label class="c">Aplazos (finales desaprobados; cuentan para el promedio)</label>
    <div class="fila">${(e.aplazos || []).map((a, i) => `<span class="chip mal u-font-size-85rem_padding-4px-10px">${esc(a)} <button class="enlace u-color-inherit_text-decoration-none" onclick="borrarAplazo(${arg(id)},${i})" aria-label="Quitar aplazo">✕</button></span>`).join('')}
      <select id="m-ap" aria-label="Nota del aplazo"><option value="2">2</option><option value="1">1</option><option value="3">3</option></select>
      <button class="btn lin ch" onclick="sumarAplazo(${arg(id)})">＋ Agregar aplazo</button></div>
    ${mesasDe(m).length ? `<div class="c">Mesas de examen publicadas</div>` + mesasDe(m).map(x => `<div class="fila chico u-padding-4px-0"><span class="crece">${fmt(x.fecha)}${x.hora ? ', ' + esc(x.hora) + ' h' : ''}${x.aula ? ' · aula ' + esc(x.aula) : ''} <span class="tenue">(${esc(x.llamado || x.turno)})</span></span>
      ${x.fecha >= hoy() ? `<button class="btn lin ch" onclick="mesaAMisFechas(${arg(id)},${arg(x.fecha)},${arg(x.hora)},${arg(x.aula)})">Voy a esta</button>` : ''}</div>`).join('') : ''}
    ${progs.length ? `<div class="c">${progs.length === 1 ? 'Programa' : 'Programas'}</div>${progs.map(p => `<p class="u-margin-2px-0"><a href="${urlSegura(p.url)}" target="_blank" rel="noopener">${esc(p.t)} ↗</a></p>`).join('')}` : ''}
    ${vBibliografia((o && o.id) || m.id, id)}
    ${D.resumenes && D.resumenes.materias.some(x => x.id === ((o && o.id) || m.id)) ? `<p class="fila u-margin-12px-0-0"><button class="btn sec ch" onclick="cerrar();irResumenes(${arg((o && o.id) || m.id)})">📚 Resúmenes de esta materia</button>
      <button class="btn sec ch" onclick="empezarPractica(${arg((o && o.id) || m.id)})">🧠 Practicar con preguntas</button></p>` : ''}
    ${recursos.length ? `<div class="c">Apuntes y recursos</div>${recursos.map(r => `<p class="u-margin-2px-0"><a href="${urlSegura(r.url)}" target="_blank" rel="noopener">${esc(r.t)} ↗</a></p>`).join('')}` : ''}
    ${juegoOn() && e.estado === 'aprobada' ? `<p class="fila u-margin-10px-0-0"><button class="btn lin ch" onclick="abrirRecorrido(${arg(id)})">📋 Mi recorrido en esta materia</button></p>` : ''}
    <div class="titulo-sec"><h3>Parciales, entregas y finales</h3></div>
    ${(e.examenes || []).slice().sort((a, b) => (a.fecha || '') < (b.fecha || '') ? -1 : 1).map(x => `<div class="fila u-padding-6px-0_border-bottom-1px-solid-var-borde">
      <span class="crece"><b>${esc(x.tipo)}</b>${x.detalle ? ' · ' + esc(x.detalle) : ''}<span class="chico tenue u-display-block">${x.fecha ? fmt(x.fecha) + (x.hora ? ', ' + esc(x.hora) + ' h' : '') : 'sin fecha'}${x.nota ? ' · nota: ' + esc(x.nota) : ''}</span></span>
      <input class="nota u-width-70px" maxlength="10" inputmode="decimal" placeholder="Nota" aria-label="Nota de ${esc(x.tipo)}" data-f="n${esc(x.id)}" value="${esc(x.nota || '')}" onchange="notaExamen(${arg(id)},${arg(x.id)},this.value)">
      <button class="btn lin ch" onclick="borrarExamen(${arg(id)},${arg(x.id)})" aria-label="Borrar ${esc(x.tipo)}" data-f="b${esc(x.id)}">✕</button></div>`).join('') || '<p class="chico tenue">Todavía no cargaste fechas.</p>'}
    <div class="fila u-margin-top-8px"><select id="x-tipo" aria-label="Tipo de fecha"><option>Parcial</option><option>Recuperatorio</option><option>Entrega</option><option>Final</option><option>Otro</option></select>
      <input type="date" id="x-fecha" aria-label="Fecha"><input type="time" id="x-hora" aria-label="Hora (opcional)" class="u-width-110px"><input id="x-det" maxlength="200" class="crece" aria-label="Detalle (opcional)" placeholder="Detalle (opcional)">
      <button class="btn sec" onclick="sumarExamen(${arg(id)})">Agregar</button></div>
    <label class="c">Mis notas</label><textarea maxlength="5000" placeholder="Cátedra, comisión, bibliografía que falta, contactos…" onchange="campo(${arg(id)},'apuntes',this.value)">${esc(e.apuntes || '')}</textarea>
    <div class="botones"><button class="btn" onclick="cerrar()">Listo</button></div>`, 'm:' + id);
}
// Bibliografía del programa oficial (datos/bibliografia/<código>.json, la arma 104-edicion-cursada/bibliografia.py copiando
// cada referencia tal cual del PDF). Se baja recién al abrir la ficha; mientras, la ficha se dibuja sin ella.
D.biblio = {};
function vBibliografia(cod, idFicha) {
  const hay = ((D.indice || {}).bibliografia || []).find(b => b.codigo === cod);
  if (!hay) return '';
  const B = D.biblio[cod];
  if (!B) {
    if (B !== null) { D.biblio[cod] = null; json('bibliografia/' + cod + '.json').then(x => { D.biblio[cod] = x; }, () => { D.biblio[cod] = { grupos: [], error: true }; })
      .then(() => { const d = $('#dlg'); if (d.open && d.dataset.k === 'm:' + idFicha) abrirMateria(idFicha); }); }
    return '<div class="c">Bibliografía del programa</div><p class="chico tenue">Cargando…</p>';
  }
  if (B.error || !B.grupos.length) return '';
  const n = B.grupos.reduce((t, g) => t + g.obligatoria.length + g.complementaria.length, 0);
  const falta = r => (B.falta || []).some(f => r.includes(f));
  const lista = L => `<ul class="biblio">${L.map(r => `<li>${esc(r)}${falta(r) ? ` <button class="enlace chico" onclick="tengoTexto(${arg(r)})">¿Tenés este apunte? Avisame</button>` : ''}</li>`).join('')}</ul>`;
  return `<details class="biblio-prog" ${V.bib ? 'open' : ''} ontoggle="V.bib=this.open"><summary><b>📖 Bibliografía del programa ${B.anio}</b> <span class="chip">${n} textos</span></summary>
    <p class="u-my6 chico tenue">Copiada del programa oficial ${B.anio}: si tu cátedra tiene un programa más nuevo, manda ese.${(B.falta || []).length ? ' Los textos que todavía no tengo para armar apuntes están marcados.' : ''}</p>
    ${B.grupos.map(g => `${B.grupos.length > 1 || g.t !== 'General' ? `<h4>${esc(g.t)}</h4>` : ''}${g.obligatoria.length ? (g.complementaria.length ? '<p class="chico"><b>Obligatoria</b></p>' : '') + lista(g.obligatoria) : ''}
      ${g.complementaria.length ? `<details class="chico"><summary>Complementaria (${g.complementaria.length})</summary>${lista(g.complementaria)}</details>` : ''}`).join('')}</details>`;
}
function sumarAplazo(id) { const e = mat(id); (e.aplazos = e.aplazos || []).push(val('m-ap')); guardar(); render(); abrirMateria(id); }
function borrarAplazo(id, i) { mat(id).aplazos.splice(i, 1); guardar(); render(); abrirMateria(id); }
// Mesas de examen publicadas por la Facultad para una materia (o para la opción elegida de una electiva).
function mesasDe(m) {
  const ids = [m.id].concat((m.opciones || []).map(o => o.id));
  const e = E.materias[m.id] || {};
  return D.mesas.flatMap(t => t.mesas.filter(x => x.materia && ids.indexOf(x.materia) >= 0 && (!m.opciones || !e.opcion || x.materia === e.opcion)).map(x => Object.assign({ turno: t.nombre }, x)))
    .filter(x => x.fecha >= fechaHace(45)).sort((a, b) => a.fecha < b.fecha ? -1 : 1);
}
const fechaHace = dias => { const d = new Date(); d.setDate(d.getDate() - dias); return iso(d); };
function mesaAMisFechas(id, f, hora, aula) {
  mat(id).examenes.push({ id: uid(), tipo: 'Final', fecha: f, hora, detalle: aula ? 'Aula ' + aula : '', nota: '' });
  if (mat(id).estado === 'pendiente') mat(id).estado = 'regular';
  guardar(); render(); abrirMateria(id); aviso('Sumada a tus fechas');
}
function campo(id, k, v) { mat(id)[k] = v; if (k === 'aprobada' && v) mat(id).estado = 'aprobada'; guardar(); render(); }
function sumarExamen(id) {
  if (!val('x-fecha')) return aviso('Falta la fecha');
  mat(id).examenes.push({ id: uid(), tipo: val('x-tipo'), fecha: val('x-fecha'), hora: val('x-hora'), detalle: val('x-det'), nota: '' });
  guardar(); render(); abrirMateria(id);
}
function notaExamen(id, xid, v) { const x = mat(id).examenes.find(e => e.id === xid); if (x) { x.nota = v.trim(); guardar(); } }
function borrarExamen(id, xid) { mat(id).examenes = mat(id).examenes.filter(e => e.id !== xid); guardar(); render(); abrirMateria(id); }

// =====================================================================
// HORARIOS
// =====================================================================
function hor() { return (E.horarios[V.oferta] = E.horarios[V.oferta] || { materias: [], elegidas: {}, propias: [], bloqueos: [], sinSabado: false, listo: false }); }
const oferta = () => D.ofertas.find(o => o.id === V.oferta) || { comisiones: [], nombre: '' };
const comisiones = () => oferta().comisiones.concat(hor().propias);
// Id de materia de una comisión → nombre para mostrar (del plan, o el texto libre que se cargó a mano).
const extra = id => (oferta().extras || []).find(x => x.id === id);
function nombreMateria(id) { const x = extra(id); if (x) return x.tipo + ': ' + x.nombre; const m = D.plan.materias.find(x => x.id === id || (x.opciones || []).some(o => o.id === id)); if (!m) return id; const o = (m.opciones || []).find(x => x.id === id); return o ? o.nombre : m.nombre; }
const SIGLAS = { '0921': 'EEM', '0922': 'EPP', '0912': 'PPEP', '0923': 'PPIP', frances: 'FRA', aleman: 'ALE', italiano: 'ITA', portugues: 'POR' };
const siglaMateria = id => { const x = extra(id); if (x) return x.tipo.slice(0, 3).toUpperCase() + ' ' + x.nombre.split(/\s+/)[0]; if (SIGLAS[id]) return SIGLAS[id];
  const m = D.plan.materias.find(x => x.id === id); return m ? m.sigla : nombreMateria(id).split(/\s+/).map(w => w[0]).join('').slice(0, 5).toUpperCase(); };
// ¿La materia (o la opción de una electiva) de esta comisión ya figura como aprobada en Mi carrera?
function yaAprobada(id) {
  return D.plan.materias.some(m => (E.materias[m.id] || {}).estado === 'aprobada' && (m.id === id || (m.opciones || []).some(o => o.id === id && E.materias[m.id].opcion === id)));
}
function elegidas() { const h = hor(), C = comisiones(); return Object.keys(h.elegidas).filter(k => h.materias.indexOf(k.split('|')[0]) >= 0).map(k => C.find(c => c.id === h.elegidas[k])).filter(Boolean); }
const colorDe = id => COLORES[Math.max(0, hor().materias.indexOf(id)) % COLORES.length];

function vHorarios() {
  const h = hor(), of = oferta(), C = comisiones();
  const disponibles = [...new Set(C.map(c => c.materia))];
  const sel = elegidas(), ch = Horarios.choques(sel), r = Horarios.resumen(sel, h.bloqueos);
  // Con los horarios confirmados, la oferta y los avisos se pliegan en un resumen: queda a la vista solo la semana.
  const listo = h.listo && sel.length > 0;
  const out = [];
  out.push(`<div class="u-mb10 fila">${D.ofertasMeta.length > 1 ? `<select aria-label="Cuatrimestre" onchange="cambiarOferta(this.value)">${D.ofertasMeta.map(o => `<option value="${o.id}" ${o.id === V.oferta ? 'selected' : ''}>${esc(o.nombre)}</option>`).join('')}</select>` : `<h2>${esc(of.nombre)}</h2>`}
    <span class="crece"></span>${listo ? '' : '<button class="btn sec ch" onclick="horarioPropio()">＋ Cargar un horario a mano</button>'}</div>`);
  if (listo) out.push(vListo(sel, of));
  else {
  if (of.nota && !of.comisiones.length) out.push(`<div class="tarjeta chico">${esc(of.nota)}</div>`);
  if (of.fuente) out.push(`<p class="chico tenue">Oferta publicada por la Facultad${of.actualizado ? ', cargada el ' + fmt(of.actualizado) : ''}. <a href="${urlSegura(of.fuente)}" target="_blank" rel="noopener">Ver la planilla original</a>. Puede haber cambios de último momento.</p>`);
  if (of.idiomas) out.push(`<p class="chico tenue">Los idiomas (inglés, francés, alemán, italiano y portugués) los publica el Departamento de Lenguas Modernas${of.idiomas.actualizado ? ', cargados el ' + fmt(of.idiomas.actualizado) : ''}. <a href="${urlSegura(of.idiomas.fuente)}" target="_blank" rel="noopener">Ver el blog del Departamento</a>. Se inscriben por SUIGA, en «Otras materias, seminarios e idiomas».</p>`);

  // 1. Qué materias.
  out.push(`<div class="titulo-sec"><h2>1. ¿Qué querés cursar?</h2></div><div class="tarjeta">`);
  // Las que ya aprobaste no aparecen, salvo que las pidas o ya las hayas elegido. Los seminarios van aparte, plegados.
  const ocultas = disponibles.filter(id => yaAprobada(id) && h.materias.indexOf(id) < 0);
  const visibles = V.verAprobadas ? disponibles : disponibles.filter(id => ocultas.indexOf(id) < 0);
  const opcionMat = id => `<label class="elige">
      <input type="checkbox" data-f="q${esc(id)}" ${h.materias.indexOf(id) >= 0 ? 'checked' : ''} onchange="quieroCursar(${arg(id)},this.checked)">${h.materias.indexOf(id) >= 0 ? `<i class="elige-color" style="background:${colorDe(id)}" aria-hidden="true"></i>` : ''}<span>${esc(nombreMateria(id))}${yaAprobada(id) ? ' <small>(aprobada)</small>' : ''}</span></label>`;
  const sems = visibles.filter(id => extra(id)), mats = visibles.filter(id => !extra(id));
  const semAbierto = V.verSem || sems.some(id => h.materias.indexOf(id) >= 0);
  out.push(disponibles.length ? `<div class="eligen">${mats.map(opcionMat).join('')}</div>
    ${sems.length ? `<details class="sems" ${semAbierto ? 'open' : ''} ontoggle="V.verSem=this.open"><summary>Seminarios y PST <span class="chip">${sems.length}</span></summary><div class="eligen">${sems.map(opcionMat).join('')}</div></details>` : ''}
    ${ocultas.length ? `<p class="chico tenue u-margin-10px-0-0">${V.verAprobadas ? 'Se muestran también las que ya aprobaste.' : `No muestro ${ocultas.length === 1 ? 'una materia que ya aprobaste' : ocultas.length + ' materias que ya aprobaste'}.`}
      <button class="enlace" onclick="V.verAprobadas=!V.verAprobadas;render()">${V.verAprobadas ? 'Ocultarlas' : 'Mostrarlas'}</button></p>` : ''}`
    : '<p class="vacio u-padding-10px">No hay horarios cargados para este cuatrimestre. Cargá los de tus materias con «Cargar un horario a mano».</p>');
  out.push('</div>');

  // 2. Comisiones.
  if (h.materias.length) {
    out.push(`<div class="titulo-sec"><h2>2. Elegí comisiones</h2><span class="u-m0 botones"><button class="btn lin ch" onclick="bloqueo()">＋ Horario en que no puedo</button><button class="btn ch" onclick="sugerir()">✨ Sugerir combinaciones</button></span></div>
      <p class="u-mb8 chico tenue">Para sugerir, tengo en cuenta los horarios en que no podés${h.bloqueos.length ? ` (cargaste ${h.bloqueos.length})` : ''}. <label class="chico u-white-space-nowrap"><input type="checkbox" class="u-min-height-0" ${h.sinSabado ? 'checked' : ''} onchange="hor().sinSabado=this.checked;guardar();render()"> Evitar sábados</label></p>`);
    if (V.sugeridas) out.push(vSugeridas());
    Horarios.grupos(h.materias, C).forEach(g => {
      const clave = g.materia + '|' + g.tipo;
      out.push(`<div class="tarjeta" style="border-left:5px solid ${colorDe(g.materia)}"><b>${esc(nombreMateria(g.materia))}</b> <span class="chip">${esc(g.tipo)}</span>
        ${g.opciones.map(c => `<label class="comision"><input type="radio" data-f="r${esc(c.id)}" name="${esc(clave)}" ${h.elegidas[clave] === c.id ? 'checked' : ''} onchange="elegirComision(${arg(clave)},${arg(c.id)})">
          <span class="crece"><b>${esc(c.nombre || 'Única')}</b> · ${c.bloques.map(b => Horarios.DIAS[b.dia] + ' ' + b.desde + '-' + b.hasta).join(' y ')}
          <span class="chico tenue u-display-block">${[c.docente, c.aula, c.modalidad].filter(Boolean).map(esc).join(' · ')}${c.propia ? ' · cargado por vos' : ''}</span></span>
          ${c.propia ? `<button class="btn lin ch" onclick="event.preventDefault();borrarPropia(${arg(c.id)})" aria-label="Borrar este horario">✕</button>` : ''}</label>`).join('')}</div>`);
    });
    if (sel.length) out.push(`<div class="fila u-justify-content-flex-end_margin-top-4px"><span class="chico tenue">Se guarda solo. Cuando termines, plegá la oferta y quedate con tu semana.</span>
      <button class="btn" onclick="horariosListos()">✓ Listo, guardar mis horarios</button></div>`);
  }
  }

  // 3. La semana.
  out.push(`<div class="titulo-sec"><h2>${h.materias.length && !listo ? '3. ' : ''}Tu semana</h2>${h.materias.length ? '' : '<button class="btn lin ch" onclick="bloqueo()">＋ Horario en que no puedo</button>'}</div>`);
  if (ch.length) out.push(`<div class="tarjeta u-border-color-var-mal_background-var-mal-suave"><b>⚠ ${ch.length === 1 ? 'Hay una superposición' : 'Hay ' + ch.length + ' superposiciones'}</b>
    ${ch.map(x => `<div class="chico">${Horarios.DIAS[x.dia]} ${x.desde}-${x.hasta}: ${esc(siglaMateria(x.a.materia))} (${esc(x.a.tipo)}) con ${esc(siglaMateria(x.b.materia))} (${esc(x.b.tipo)})</div>`).join('')}</div>`);
  if (r.enBloqueo) out.push(`<div class="tarjeta u-border-color-var-ojo_background-var-ojo-suave"><b>Se pisa con un horario en que no podés</b> (${Math.round(r.enBloqueo / 60 * 10) / 10} h).</div>`);
  if (sel.length) out.push(`<p class="chico tenue">${r.dias.length} ${r.dias.length === 1 ? 'día' : 'días'} por semana (${r.dias.map(d => Horarios.DIAS[d].toLowerCase()).join(', ')}) · ${Math.round(r.clase / 60 * 10) / 10} h de clase${r.huecos ? ' · ' + Math.round(r.huecos / 60 * 10) / 10 + ' h de huecos' : ''}</p>`);
  out.push(grilla(sel, h.bloqueos, ch) + listaSemana(sel));
  const p = sel.length && periodoDe(V.oferta);
  if (p) out.push(`<div class="tarjeta fila u-margin-top-12px"><span class="crece chico u-min-width-220px">Llevá estas clases a Google Calendar u otro calendario: se repiten cada semana del ${fmt(p.desde)} al ${fmt(p.hasta)}${feriadosEn(p).length ? ', sin los feriados' : ''}.</span>
    <button class="btn sec ch" onclick="ayudaCalendario()">📅 Llevar a mi calendario</button></div>`);
  if (h.materias.length) out.push(`<div class="tarjeta fila u-margin-top-12px"><span class="crece chico u-min-width-220px">Pasale al grupo lo que vas a cursar${sel.length ? ' y tu semana: una imagen para las historias o un link que se abre solo para mirar' : ''}.</span>
    <button class="btn sec ch" onclick="abrirQueCursar()">💬 Qué voy a cursar</button>${sel.length ? '<button class="btn sec ch" onclick="imagenSemana()">📷 Mi semana en imagen</button><button class="btn sec ch" onclick="linkSemana()">🔗 Link para mirar</button>' : ''}</div>`);
  if (h.bloqueos.length) out.push(`<p class="chico tenue u-margin-top-8px">No puedo: ${h.bloqueos.map((b, i) => `${esc(b.t || '')} ${Horarios.DIAS[b.dia].toLowerCase()} ${b.desde}-${b.hasta} <button class="enlace" onclick="borrarBloqueo(${i})">quitar</button>`).join(' · ')}</p>`);
  return out.join('');
}
function vListo(sel, of) {
  const h = hor(), por = {};
  sel.forEach(c => { (por[c.materia] = por[c.materia] || []).push(c); });
  return `<div class="tarjeta"><div class="fila"><b>✓ Tus horarios están guardados</b><span class="crece"></span>
      <button class="btn lin ch" onclick="editarHorarios()">✏️ Cambiar materias o comisiones</button></div>
    <ul class="resumen-sel">${Object.keys(por).map(m => `<li style="border-left-color:${colorDe(m)}"><b>${esc(nombreMateria(m))}</b>
      <span class="chico tenue">${por[m].map(c => esc(c.tipo) + (c.nombre ? ' ' + esc(c.nombre) : '')).join(' · ')}</span></li>`).join('')}</ul>
    ${h.materias.length > Object.keys(por).length ? `<p class="chico u-margin-6px-0-0_color-var-ojo">Hay materias marcadas sin comisión elegida.</p>` : ''}
    ${of.fuente ? `<p class="u-mt6 chico tenue">Oferta${of.actualizado ? ' del ' + fmt(of.actualizado) : ''}, sujeta a cambios: <a href="${urlSegura(of.fuente)}" target="_blank" rel="noopener">planilla de la Facultad</a>.</p>` : ''}</div>`;
}
function horariosListos() {
  const h = hor(), faltan = Horarios.grupos(h.materias, comisiones()).filter(g => !h.elegidas[g.materia + '|' + g.tipo]);
  if (faltan.length) return aviso('Te falta elegir: ' + faltan.map(g => siglaMateria(g.materia) + ' (' + g.tipo.toLowerCase() + ')').join(', '));
  h.listo = true; V.sugeridas = null; guardar(); render(); window.scrollTo(0, 0); aviso('Horarios guardados'); invitarLuego('horarios', 3500);
}
function editarHorarios() { hor().listo = false; guardar(); render(); }
function listaSemana(sel) {
  const dias = [1, 2, 3, 4, 5, 6].map(d => [d, sel.flatMap(c => c.bloques.filter(b => b.dia === d).map(b => ({ c, b }))).sort((x, y) => x.b.desde < y.b.desde ? -1 : 1)]).filter(x => x[1].length);
  if (!dias.length) return '';
  return `<ul class="semana">${dias.map(([d, L]) => `<li><b>${Horarios.DIAS[d]}</b>${L.map(({ c, b }) => `<span>${b.desde}-${b.hasta} · ${esc(nombreMateria(c.materia))} (${esc(c.tipo.toLowerCase())}${c.nombre ? ' ' + esc(c.nombre) : ''})${c.aula ? ' · aula ' + esc(c.aula) : c.modalidad ? ' · ' + esc(c.modalidad.toLowerCase()) : ''}</span>`).join('')}</li>`).join('')}</ul>`;
}
function grilla(sel, bloqueos, ch) {
  const todos = sel.flatMap(c => c.bloques).concat(bloqueos);
  let desde = 8 * 60, hasta = 23 * 60;
  if (todos.length) { desde = Math.min(desde, ...todos.map(b => Math.floor(Horarios.min(b.desde) / 60) * 60)); hasta = Math.max(21 * 60, ...todos.map(b => Math.ceil(Horarios.min(b.hasta) / 60) * 60)); }
  const PX = 0.8, alto = (hasta - desde) * PX;
  const enChoque = new Set(ch.flatMap(x => [x.a.id, x.b.id]));
  const horas = []; for (let m = desde; m <= hasta; m += 60) horas.push(m);
  const col = d => `<div class="col" style="height:${alto}px">${horas.slice(0, -1).map(m => `<div class="linea" style="position:absolute;left:0;right:0;top:${(m - desde) * PX}px"></div>`).join('')}
    ${bloqueos.filter(b => b.dia === d).map(b => `<div class="bloque bloqueo" style="top:${(Horarios.min(b.desde) - desde) * PX}px;height:${(Horarios.min(b.hasta) - Horarios.min(b.desde)) * PX}px">${esc(b.t || 'No puedo')}</div>`).join('')}
    ${sel.flatMap(c => c.bloques.filter(b => b.dia === d).map(b => `<div class="bloque ${enChoque.has(c.id) ? 'choque' : ''}" title="${esc(nombreMateria(c.materia))} · ${esc(c.tipo)} ${esc(c.nombre || '')}" style="background:${colorDe(c.materia)};top:${(Horarios.min(b.desde) - desde) * PX}px;height:${(Horarios.min(b.hasta) - Horarios.min(b.desde)) * PX}px">
      <b>${esc(siglaMateria(c.materia))}</b>${esc(c.tipo)}<br>${b.desde}-${b.hasta}${c.aula ? '<br>' + esc(c.aula) : ''}</div>`)).join('')}</div>`;
  return `<div class="grilla" aria-hidden="true"><div class="dia"></div>${[1, 2, 3, 4, 5, 6].map(d => `<div class="dia">${Horarios.DIAS[d]}</div>`).join('')}
    <div style="height:${alto}px;position:relative">${horas.map(m => `<div class="hora" style="position:absolute;right:0;top:${(m - desde) * PX}px">${Horarios.hhmm(m)}</div>`).join('')}</div>
    ${[1, 2, 3, 4, 5, 6].map(col).join('')}</div>`;
}
async function cambiarOferta(id) {
  V.oferta = id; V.sugeridas = null;
  if (!D.ofertas.some(o => o.id === id)) {
    const m = D.ofertasMeta.find(o => o.id === id);
    try { D.ofertas.push(await conIdiomas(await json(m.archivo))); } catch (e) { aviso('No se pudo cargar ese cuatrimestre. Revisá la conexión y probá de nuevo.'); }
  }
  render();
}
function quieroCursar(id, si) { const h = hor(); h.materias = h.materias.filter(x => x !== id); if (si) h.materias.push(id); V.sugeridas = null; guardar(); render(); }
function elegirComision(clave, id) { hor().elegidas[clave] = id; guardar(); render(); }
function sugerir() {
  const h = hor();
  V.sugeridas = Horarios.sugerir(h.materias, comisiones(), { bloqueos: h.bloqueos, sinSabado: h.sinSabado }, 5);
  render();
}
function vSugeridas() {
  const s = V.sugeridas, h = hor();
  if (!s.combinaciones.length) return '<div class="tarjeta">No hay comisiones para combinar.</div>';
  return `<div class="tarjeta"><div class="fila"><b class="crece">Las mejores combinaciones</b>
    <label class="chico"><input type="checkbox" class="u-min-height-0" ${h.sinSabado ? 'checked' : ''} onchange="hor().sinSabado=this.checked;guardar();sugerir()"> Evitar sábados</label>
    <button class="btn lin ch" onclick="V.sugeridas=null;render()">Cerrar</button></div>
    <p class="chico tenue u-margin-4px-0-10px">${s.recortado ? 'Revisé una parte de las' : 'Revisé las'} ${s.total.toLocaleString('es-AR')} combinaciones posibles${s.sinChoques ? ' y me quedé con las que no tienen superposiciones' : '; ninguna está libre de superposiciones'}. Primero evito superposiciones, después tus horarios ocupados, y después busco menos días y menos huecos.</p>
    ${s.combinaciones.map((c, i) => `<div class="sugerencia ${i === 0 && !c.choques.length ? 'mejor' : ''}"><div class="fila"><span class="crece">
      ${c.choques.length ? `<span class="chip mal">${c.choques.length} superposición${c.choques.length > 1 ? 'es' : ''}</span>` : '<span class="chip ok">Sin superposiciones</span>'}
      ${c.resumen.enBloqueo ? '<span class="chip ojo">pisa un horario ocupado</span>' : ''}
      <span class="chip">${c.resumen.dias.length} días</span> <span class="chip">${Math.round(c.resumen.huecos / 60 * 10) / 10} h de huecos</span>
      <span class="chico tenue u-display-block_margin-top-4px">${c.comisiones.map(x => esc(siglaMateria(x.materia)) + ' ' + esc(x.tipo.slice(0, 1)) + (x.nombre ? ' ' + esc(x.nombre) : '') + ': ' + x.bloques.map(b => Horarios.DIAS[b.dia].slice(0, 2) + ' ' + b.desde).join('+')).join(' · ')}</span></span>
      <button class="btn ch" onclick="usarSugerida(${i})">Usar esta</button></div></div>`).join('')}</div>`;
}
function usarSugerida(i) { const h = hor(); V.sugeridas.combinaciones[i].comisiones.forEach(c => { h.elegidas[c.materia + '|' + c.tipo] = c.id; }); V.sugeridas = null; guardar(); render(); aviso('Combinación aplicada'); }
const opcionesDia = d => [1, 2, 3, 4, 5, 6].map(n => `<option value="${n}" ${n === d ? 'selected' : ''}>${Horarios.DIAS[n]}</option>`).join('');
function horarioPropio() {
  const planOps = D.plan.materias.flatMap(m => m.opciones && m.opciones.some(o => o.codigo) ? m.opciones.filter(o => o.codigo).map(o => [o.id, o.nombre]) : [[m.id, m.nombre]]);
  abrir(cab('Cargar un horario') + `<label class="c">Materia</label><select id="h-m" class="u-w100">${planOps.map(([id, n]) => `<option value="${id}">${esc(n)}</option>`).join('')}<option value="__otra">Otra (escribila abajo)</option></select>
    <input id="h-otra" class="u-width-100_margin-top-6px" maxlength="120" aria-label="Nombre de la materia, si no está en la lista" placeholder="Nombre, si no está en la lista">
    <div class="fila"><div class="crece"><label class="c">Tipo</label><select id="h-t" class="u-w100"><option>Teórico</option><option>Práctico</option><option>Teórico-práctico</option></select></div>
      <div class="crece"><label class="c">Comisión</label><input id="h-c" maxlength="20" class="u-w100" placeholder="Ej.: 2"></div></div>
    <div class="fila"><div><label class="c">Día</label><select id="h-d">${opcionesDia(1)}</select></div><div><label class="c">Desde</label><input type="time" id="h-a" value="19:00" step="900"></div><div><label class="c">Hasta</label><input type="time" id="h-b" value="21:00" step="900"></div></div>
    <div class="fila"><div class="crece"><label class="c">Docente (opcional)</label><input id="h-doc" maxlength="120" class="u-w100"></div><div class="crece"><label class="c">Aula o modalidad (opcional)</label><input id="h-aula" maxlength="60" class="u-w100"></div></div>
    <p class="chico tenue">Si la comisión cursa dos días, cargala dos veces con el mismo número de comisión: se juntan solas.</p>
    <div class="botones"><button class="btn" onclick="guardarPropio()">Agregar</button><button class="btn lin" onclick="cerrar()">Cancelar</button></div>`);
}
function guardarPropio() {
  const a = val('h-a'), b = val('h-b');
  if (!a || !b || Horarios.min(b) <= Horarios.min(a)) return aviso('La hora de fin es antes que la de inicio');
  let m = val('h-m');
  if (m === '__otra') { m = val('h-otra').replace(/\|/g, '/').slice(0, 120); if (!m) return aviso('Escribí el nombre de la materia'); }
  const h = hor(), tipo = val('h-t'), nombre = val('h-c'), bloque = { dia: Number(val('h-d')), desde: a, hasta: b };
  const igual = h.propias.find(c => c.materia === m && c.tipo === tipo && (c.nombre || '') === nombre);
  if (igual) igual.bloques.push(bloque);
  else h.propias.push({ id: 'p' + uid(), materia: m, tipo, nombre, docente: val('h-doc'), aula: val('h-aula'), bloques: [bloque], propia: true });
  if (h.materias.indexOf(m) < 0) h.materias.push(m);
  const c = igual || h.propias[h.propias.length - 1];
  if (!h.elegidas[m + '|' + tipo]) h.elegidas[m + '|' + tipo] = c.id;
  guardar(); cerrar(); render(); aviso('Horario agregado');
}
function borrarPropia(id) { const h = hor(); h.propias = h.propias.filter(c => c.id !== id); Object.keys(h.elegidas).forEach(k => { if (h.elegidas[k] === id) delete h.elegidas[k]; }); guardar(); render(); }
function bloqueo() {
  abrir(cab('Horario en que no puedo') + `<p class="u-mt0 chico tenue">Trabajo, otra cursada, lo que sea. Se tiene en cuenta al sugerir combinaciones.</p>
    <label class="c">Qué es (opcional)</label><input id="b-t" maxlength="40" class="u-w100" placeholder="Trabajo">
    <div class="fila"><div><label class="c">Día</label><select id="b-d"><option value="0">Lunes a viernes</option>${opcionesDia(0)}</select></div>
      <div><label class="c">Desde</label><input type="time" id="b-a" value="09:00" step="900"></div><div><label class="c">Hasta</label><input type="time" id="b-b" value="18:00" step="900"></div></div>
    <div class="botones"><button class="btn" onclick="guardarBloqueo()">Agregar</button><button class="btn lin" onclick="cerrar()">Cancelar</button></div>`);
}
function guardarBloqueo() {
  const a = val('b-a'), b = val('b-b'), d = Number(val('b-d'));
  if (!a || !b || Horarios.min(b) <= Horarios.min(a)) return aviso('La hora de fin es antes que la de inicio');
  (d ? [d] : [1, 2, 3, 4, 5]).forEach(dia => hor().bloqueos.push({ dia, desde: a, hasta: b, t: val('b-t') }));
  V.sugeridas = null; guardar(); cerrar(); render();
}
function borrarBloqueo(i) { hor().bloqueos.splice(i, 1); V.sugeridas = null; guardar(); render(); }

// =====================================================================
// CALENDARIO
// =====================================================================
function misFechas() {
  return D.plan.materias.flatMap(m => ((E.materias[m.id] || {}).examenes || []).filter(x => x.fecha).map(x => ({ t: x.tipo + ' de ' + nombreDe(m) + (x.detalle ? ' (' + x.detalle + ')' : ''), tipo: 'mio', desde: x.fecha, hasta: x.fecha, hora: x.hora, materia: m.id })));
}
function vCalendario() {
  const c = D.calendario, t = hoy();
  // De las mesas publicadas, al calendario van solo las de las materias que tenés regulares o en curso.
  const mias = D.plan.materias.filter(m => ['regular', 'cursando'].indexOf((E.materias[m.id] || {}).estado) >= 0)
    .flatMap(m => mesasDe(m).map(x => ({ t: 'Mesa de ' + nombreDe(m) + (x.aula ? ' (aula ' + x.aula + ')' : ''), tipo: 'mesa', desde: x.fecha, hasta: x.fecha, hora: x.hora, materia: m.id })));
  const fer = (c.feriados || []).map(f => ({ t: f.t, tipo: 'feriado', desde: f.fecha, hasta: f.fecha }));
  const todos = c.eventos.concat(fer, misFechas(), mias, repasos()).sort((a, b) => a.desde < b.desde ? -1 : a.desde > b.desde ? 1 : 0);
  // Filtro: "Mis fechas" son las que cargaste, las mesas de tus materias y los repasos; "Oficial" es el calendario de la Facultad y los feriados.
  const MIO = ['mio', 'mesa', 'repaso'], filtro = V.calFiltro || 'todo';
  const visibles = todos.filter(e => filtro === 'todo' || (filtro === 'mias') === (MIO.indexOf(e.tipo) >= 0));
  const futuros = visibles.filter(e => e.hasta >= t), pasados = visibles.filter(e => e.hasta < t);
  const periodo = c.periodos.find(p => p.desde <= t && p.hasta >= t);
  const chip = { examen: ['mal', 'Exámenes'], inscripcion: ['tin', 'Inscripción'], cursada: ['ok', 'Cursada'], tramite: ['ojo', 'Trámite'], info: ['', 'Info'], mio: ['mos', 'Tuyo'], mesa: ['mal', 'Mesa'], feriado: ['ojo', 'Feriado'], repaso: ['tin', 'Repaso'], especial: ['ojo', 'Feriado'] };
  const turnos = D.mesas.map(tn => `<details class="tarjeta"><summary class="u-cursor-pointer"><b>Mesas de examen: ${esc(tn.nombre)}</b> <span class="chico tenue">(${tn.mesas.length}, cargadas el ${fmt(tn.actualizado)})</span></summary>
    <p class="chico tenue">${esc(tn.nota)} <a href="${urlSegura(tn.fuente)}" target="_blank" rel="noopener">Ver la planilla de la Facultad</a>.</p>
    ${tn.mesas.map(x => `<div class="evento"><div class="cuando">${fmt(x.fecha)}</div><div class="crece">${esc(x.nombre)}<span class="chico tenue u-display-block">${[x.hora && x.hora + ' h', x.aula && 'aula ' + x.aula, x.llamado].filter(Boolean).map(esc).join(' · ')}</span></div></div>`).join('')}</details>`).join('');
  const fila = e => { const enCurso = e.desde <= t && e.hasta >= t; return `<div class="evento ${enCurso ? 'hoy' : ''} ${e.hasta < t ? 'pasado' : ''}"><div class="cuando">${fmtRango(e.desde, e.hasta)}</div>
    <div class="crece">${e.res ? `${esc(e.t)}: <button class="enlace" onclick="empezarPractica(${arg(e.res)})">practicar ${RONDA} preguntas</button>` : e.materia ? `<button class="enlace" onclick="abrirMateria(${arg(e.materia)})">${esc(e.t)}</button>` : esc(e.t)}${e.hora ? ' · ' + esc(e.hora) + ' h' : ''}${enCurso && e.desde !== e.hasta ? ' <span class="chico tenue">(en curso)</span>' : ''}</div>
    <span class="chip ${(chip[e.tipo] || chip.info)[0]}">${(chip[e.tipo] || chip.info)[1]}</span></div>`; };
  let semana = '';
  if (periodo) { const n = Math.floor((fecha(t) - fecha(periodo.desde)) / 6048e5) + 1, tot = Math.ceil((fecha(periodo.hasta) - fecha(periodo.desde)) / 6048e5); semana = `<div class="tarjeta"><b>${esc(periodo.nombre)}</b>: semana ${n} de ${tot}<div class="barra"><i style="width:${Math.round(n * 100 / tot)}%;background:var(--tinta)"></i></div></div>`; }
  if ((V.calVista || 'mes') === 'mes') return calMes(todos, t, semana, turnos);
  return `${semana}<div class="titulo-sec"><h2>Lo que viene</h2><span class="fila">${V.oferta && E.horarios[V.oferta] && elegidas().length && periodoDe(V.oferta) ? '<button class="btn sec ch" onclick="ayudaCalendario()">📅 Llevar mi cursada al calendario</button>' : ''}${misFechas().length ? '<button class="btn sec ch" onclick="exportarIcs()">Llevar mis fechas al calendario (.ics)</button>' : ''}</span></div>
    <div class="u-mb10 fila">${calVistaSeg()}<div class="seg" role="group" aria-label="Qué fechas ver">${[['todo', 'Todo'], ['mias', 'Mis fechas'], ['oficial', 'Oficial']].map(([k, n]) => `<button class="${filtro === k ? 'on' : ''}" aria-pressed="${filtro === k}" onclick="V.calFiltro=${arg(k)};render()">${n}</button>`).join('')}</div>
      <span class="crece"></span><button class="btn lin ch" onclick="ir(${arg('links')})">Cómo inscribirse y trámites</button></div>
    <p class="chico tenue u-margin-4px-0-8px">Calendario académico ${c.anio} de la Facultad más tus parciales y finales (se cargan desde cada materia, en Mi carrera). ${esc(c.nota)}
      ${repasos().length ? 'Antes de cada parcial o final de una materia con resumen, te sugiero tres repasos cortos: una semana, tres días y un día antes.' : ''}</p>
    <div class="tarjeta u-padding-6px-16px">${futuros.map(fila).join('') || '<p class="vacio">' + (filtro === 'mias' ? 'Todavía no cargaste fechas propias: se suman desde cada materia, en Mi carrera.' : 'No queda nada en el calendario de este año.') + '</p>'}</div>
    ${turnos}
    ${pasados.length ? `<button class="btn lin ch" onclick="V.verPasados=!V.verPasados;render()">${V.verPasados ? 'Ocultar' : 'Ver'} lo que ya pasó (${pasados.length})</button>${V.verPasados ? `<div class="tarjeta u-padding-6px-16px_margin-top-10px">${pasados.map(fila).join('')}</div>` : ''}` : ''}
    ${c.consultado ? `<p class="chico tenue verificado">✓ Calendario cotejado con la <a href="${urlSegura(c.fuente.url)}" target="_blank" rel="noopener">Secretaría Académica</a> el ${fmt(c.consultado)}. Los feriados salen de argentina.gob.ar y se actualizan solos (incluye los de la Ciudad, donde está la Facultad).</p>` : ''}`;
}
// Calendario en vista de mes (lienzo): filtros por tipo a un costado, cuadrícula y «Lo que viene» en la columna derecha.
const CAL_GRUPOS = [['fechas', 'Parciales e inscripciones', ['inscripcion', 'cursada', 'tramite', 'info', 'mio', 'repaso']], ['mesas', 'Mesas de examen', ['mesa', 'examen']], ['feriados', 'Feriados', ['feriado', 'especial']]];
const calGrupo = tipo => (CAL_GRUPOS.find(g => g[2].indexOf(tipo) >= 0) || CAL_GRUPOS[0])[0];
const calMarca = tipo => ({ mesas: 'r', feriados: 's' })[calGrupo(tipo)] || '';
function calVistaSeg() { const v = V.calVista || 'mes'; return `<div class="seg" role="group" aria-label="Vista">${[['mes', 'Mes'], ['lista', 'Lista']].map(([k, n]) => `<button type="button" class="${v === k ? 'on' : ''}" aria-pressed="${v === k}" onclick="V.calVista=${arg(k)};render()">${n}</button>`).join('')}</div>`; }
function calMover(d) {
  const [y, m] = (V.calMes || hoy().slice(0, 7)).split('-').map(Number), n = new Date(y, m - 1 + d, 1);
  V.calMes = iso(n).slice(0, 7); render();
}
function calMes(todos, t, previo, turnos) {
  const mes = V.calMes || t.slice(0, 7), [y, m] = mes.split('-').map(Number), ocultos = V.calOcultos || [];
  const soloMias = V.calFiltro === 'mias';
  const MIO = ['mio', 'mesa', 'repaso'];
  const vis = todos.filter(e => ocultos.indexOf(calGrupo(e.tipo)) < 0 && (!soloMias || MIO.indexOf(e.tipo) >= 0));
  const porDia = {};
  vis.forEach(e => { [e.desde, e.hasta].filter((x, i, a) => a.indexOf(x) === i).forEach(d => { (porDia[d] = porDia[d] || []).push(e); }); });
  const primero = new Date(y, m - 1, 1), vacios = (primero.getDay() + 6) % 7, dias = new Date(y, m, 0).getDate();
  const celdas = [];
  for (let i = 0; i < vacios; i++) celdas.push('<div class="cal-cel vacia" aria-hidden="true"></div>');
  for (let d = 1; d <= dias; d++) {
    const k = mes + '-' + String(d).padStart(2, '0'), ev = porDia[k] || [];
    celdas.push(`<div class="cal-cel ${k === t ? 'hoy' : ''}"><b>${d}</b>${ev.slice(0, 3).map(e => `<span class="cal-ev"><i class="cal-pt ${calMarca(e.tipo)}" aria-hidden="true"></i><span>${esc(e.t)}</span></span>`).join('')}${ev.length > 3 ? `<span class="chico tenue">+${ev.length - 3} más</span>` : ''}</div>`);
  }
  const prox = vis.filter(e => e.hasta >= t).slice(0, 5);
  const opc = (g, n) => { const on = ocultos.indexOf(g) < 0; return `<button type="button" class="cal-opt ${on ? 'on' : ''}" aria-pressed="${on}" onclick="calAlternar(${arg(g)})"><i class="cal-ck ${on ? 'on' : ''}" aria-hidden="true"></i>${n}</button>`; };
  const ag = e => { const d = fecha(e.desde); return `<div class="cal-ag"><div class="cal-fe"><b>${d.getDate()}</b>${MESES[d.getMonth()].toUpperCase()}</div><div><span>${esc(e.t)}</span><span class="chico tenue u-display-block">${[e.hasta !== e.desde && 'hasta el ' + fmt(e.hasta), e.hora && e.hora + ' h'].filter(Boolean).join(' · ') || ({ mesas: 'Mesa de examen', feriados: 'Feriado' })[calGrupo(e.tipo)] || 'Fecha'}</span></div></div>`; };
  const ref = (c, n) => `<span class="fila"><i class="cal-pt ${c}" aria-hidden="true"></i>${n}</span>`;
  return `${previo}<div class="titulo-sec"><h2>Calendario</h2><span class="fila">${V.oferta && E.horarios[V.oferta] && elegidas().length && periodoDe(V.oferta) ? '<button class="btn sec ch" onclick="ayudaCalendario()">📅 Llevar mi cursada al calendario</button>' : ''}</span></div>
    <p class="chico tenue u-mt0">Calendario académico ${D.calendario.anio} de la Facultad, tus fechas, las mesas de tus materias y los feriados. Los marcadores dicen qué hay cada día.</p>
    <div class="cal-pag"><aside class="cal-lado" aria-label="Filtros"><div class="nov-rot">Qué mostrar</div>${CAL_GRUPOS.map(g => opc(g[0], g[1])).join('')}
      <button type="button" class="cal-opt ${soloMias ? 'on' : ''}" aria-pressed="${soloMias}" onclick="V.calFiltro=${arg(soloMias ? 'todo' : 'mias')};render()"><i class="cal-ck ${soloMias ? 'on' : ''}" aria-hidden="true"></i>Solo mis fechas</button>
      <div class="nov-rot u-margin-top-24px">Referencias</div><div class="cal-ref chico tenue">${ref('', 'Parcial o inscripción')}${ref('r', 'Mesa de examen')}${ref('s', 'Feriado')}</div></aside>
    <section class="cal-mes" aria-label="Mes"><div class="fila cal-nav">${calVistaSeg()}<span class="crece"></span>
      <button class="btn sec ch" type="button" aria-label="Mes anterior" onclick="calMover(-1)">‹</button><b class="cal-tit">${MESES_LARGOS[m - 1]} ${y}</b><button class="btn sec ch" type="button" aria-label="Mes siguiente" onclick="calMover(1)">›</button>${mes !== t.slice(0, 7) ? '<button class="btn lin ch" type="button" onclick="V.calMes=null;render()">Hoy</button>' : ''}</div>
      <div class="cal-grilla" role="grid">${['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(x => `<div class="cal-dia" role="columnheader">${x}</div>`).join('')}${celdas.join('')}</div>
      <p class="chico tenue">Los feriados salen de argentina.gob.ar.</p></section>
    <aside class="cal-rail" aria-label="Lo que viene"><div class="nov-rot">Lo que viene</div>${prox.map(ag).join('') || '<p class="vacio">No queda nada con estos filtros.</p>'}
      <p><button class="btn sec u-w100" onclick="V.calVista=${arg('lista')};render()">Ver todo en lista</button></p></aside></div>${turnos}`;
}
function calAlternar(g) { const o = V.calOcultos = V.calOcultos || [], i = o.indexOf(g); if (i >= 0) o.splice(i, 1); else o.push(g); render(); }
// Repaso espaciado: antes de cada parcial o final de una materia con resumen, tres repasos cortos (7, 3 y 1 día antes).
// No se guardan: se calculan de las fechas que carga cada persona.
function repasos() {
  const R = (D.resumenes && D.resumenes.materias) || [], t = hoy(), out = [];
  D.plan.materias.forEach(m => {
    const o = opcion(m), res = (o && o.id) || m.id;
    if (!R.some(r => r.id === res)) return;
    ((E.materias[m.id] || {}).examenes || []).filter(x => x.fecha > t && ['Parcial', 'Recuperatorio', 'Final'].indexOf(x.tipo) >= 0).forEach(x => {
      [7, 3, 1].forEach(d => {
        const f = fecha(x.fecha); f.setDate(f.getDate() - d);
        if (iso(f) >= t) out.push({ t: 'Repaso para el ' + x.tipo.toLowerCase() + ' de ' + nombreDe(m), tipo: 'repaso', desde: iso(f), hasta: iso(f), res, nombre: nombreDe(m) });
      });
    });
  });
  return out;
}
function descargar(nombre, texto, tipo) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([texto], { type: tipo })); a.download = nombre; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
function exportarIcs() {
  const evs = misFechas().map((e, i) => ({ uid: 'cursada-' + i + '-' + e.desde.replace(/-/g, '') + '@ficha.github.io', t: e.t, fecha: e.desde, desde: /^\d\d?:\d\d$/.test(e.hora || '') ? e.hora.padStart(5, '0') : '' }));
  descargar('mis-fechas-cursada.ics', Horarios.ics(evs, hoy()), 'text/calendar');
}
// La cursada elegida en Horarios, como clases que se repiten cada semana entre el inicio y el fin del cuatrimestre
// (según el calendario académico) y sin los feriados que trae el calendario.
function periodoDe(id) { return ((D.calendario || {}).periodos || []).find(p => p.id.toLowerCase() === String(id).toLowerCase()) || null; }
function feriadosEn(p) { return ((D.calendario || {}).feriados || []).filter(f => f.fecha >= p.desde && f.fecha <= p.hasta); }
function exportarCursada() {
  const p = periodoDe(V.oferta), sel = elegidas();
  if (!p) return aviso('Todavía no tengo las fechas de este cuatrimestre');
  if (!sel.length) return aviso('Elegí primero tus comisiones');
  const fer = feriadosEn(p), clases = Horarios.clases(sel, p, fer.map(f => f.fecha));
  const evs = clases.map(x => ({
    uid: 'cursada-' + V.oferta + '-' + x.c.id + '-' + x.i + '@ficha.github.io',
    t: nombreMateria(x.c.materia) + ' (' + x.c.tipo.toLowerCase() + (x.c.nombre ? ' ' + x.c.nombre : '') + ')',
    fecha: x.primera, desde: x.b.desde, hasta: x.b.hasta, ultima: x.ultima, sin: x.sin,
    lugar: x.c.aula ? 'Aula ' + x.c.aula : x.c.modalidad || '',
    nota: [x.c.docente && 'Docente: ' + x.c.docente, p.nombre + ': del ' + fmt(p.desde) + ' al ' + fmt(p.hasta) + '.',
      x.sin.length ? 'Sin clase: ' + x.sin.map(s => fmt(s) + ' (' + fer.find(f => f.fecha === s).t + ')').join(', ') + '.' : '',
      'Horarios sujetos a cambios: confirmá en la planilla de la Facultad. Armado con Galera, galera.com.ar/'].filter(Boolean).join('\n')
  }));
  descargar('cursada-' + V.oferta.toLowerCase() + '.ics', Horarios.ics(evs, hoy()), 'text/calendar');
  aviso(evs.length === 1 ? 'Se bajó 1 clase semanal' : 'Se bajaron ' + evs.length + ' clases semanales');
}
function ayudaCalendario() {
  abrir(cab('Llevar la cursada a tu calendario') + `<p>Se baja un archivo <b>.ics</b> con cada clase como evento que se repite todas las semanas, desde el primer día del cuatrimestre hasta el último, sin los feriados.</p>
    <p><b>Google Calendar</b>: desde la compu, en calendar.google.com, ⚙ Configuración → Importar y exportar → Importar, y elegí el archivo. Conviene crear antes un calendario aparte (por ejemplo, «Facultad»): si después cambiás de comisión, lo borrás entero y volvés a importar.</p>
    <p><b>iPhone o Mac</b>: abrí el archivo y tocá «Agregar todo». <b>Outlook</b>: Agregar calendario → Cargar desde archivo.</p>
    <p class="chico tenue">El archivo se arma en tu navegador: no pasa por ningún servidor.</p>
    <div class="fila"><span class="crece"></span><button class="btn" onclick="exportarCursada();cerrar()">📅 Bajar el archivo</button></div>`);
}

// =====================================================================
// RESÚMENES: apuntes propios por materia (resumenes/*.json, los arma 104-edicion-cursada/resumenes.py)
// =====================================================================
function cargarResumenes() {
  return cargarResumenes.p = cargarResumenes.p || (async () => {
    try { const r = await fetch('resumenes/indice.json'); if (!r.ok) throw new Error(); D.resumenes = await r.json(); }
    catch (e) { D.resumenes = { materias: [], error: true }; }
    if (V.tab === 'resumenes') render();
  })();
}
// Navegar dentro de Resúmenes deja una entrada en el historial: el botón Atrás del celular vuelve a donde estabas.
function verRes(materia = '', apunte = '', sec = '') {
  if (![materia, apunte, sec].every(x => !x || RE_ID.test(x))) return;
  V.res = { materia, apunte, sec }; V.prac = null;
  history.pushState(null, '', '#' + hashActual());
  if (apunte) medir('select_content', { content_type: 'apunte', item_id: materia + '/' + apunte });
  if (apunte && juegoOn()) { E.juego.ultimo = materia + '/' + apunte; guardar(true); }
  if (apunte) cargarApunte(); else { render(); window.scrollTo(0, 0); }
}
function abrirApunte(materia, id) { verRes(materia, id); }
async function cargarApunte() {
  const k = V.res.materia + '/' + V.res.apunte;
  if (!D.apuntes[k]) {
    render();
    try { const r = await fetch('resumenes/' + k + '.json'); if (!r.ok) throw new Error(); D.apuntes[k] = await r.json(); }
    catch (e) { V.res.apunte = V.res.sec = ''; history.replaceState(null, '', '#' + hashActual()); aviso('No se pudo abrir el apunte. Revisá la conexión y recargá la página.'); }
  }
  await cargarResumenes(); // sin el índice no se dibuja el apunte (y no hay a qué sección bajar)
  render(); irSeccion();
}
function irSeccion() {
  const el = V.res.sec && (document.getElementById('s-' + V.res.sec) || document.getElementById('s-' + V.res.sec.slice(0, 50).replace(/-+$/, '')) || document.getElementById(V.res.sec));
  if (el) el.scrollIntoView(); else window.scrollTo(0, 0);
}
// Los links para compartir van a r/ (páginas con vista previa que arma resumenes_web.py): WhatsApp y las redes no leen el #.
const urlRes = (m, a, sec) => location.origin + location.pathname.replace(/[^/]*$/, '') + 'r/' + (a ? m + '/' + a + '.html' + (sec ? '#' + sec : '') : m ? m + '/' : '');
// Analytics: solo eventos de uso (qué se lee, se comparte o se busca), nunca lo que la persona carga. Respeta el consentimiento (analitica.js).
const medir = (ev, p) => { try { if (typeof gtag === 'function') gtag('event', ev, p || {}); } catch (e) { } };
function compartir(url, titulo, tipo, id) {
  const nativo = navigator.share && matchMedia('(pointer: coarse)').matches;
  medir('share', { method: nativo ? 'nativo' : 'copiar', content_type: tipo, item_id: id });
  if (nativo) navigator.share({ title: titulo, url }).catch(() => {});
  else if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(() => aviso('Link copiado'), () => aviso('No se pudo copiar: el link quedó en la barra de direcciones'));
  else aviso('No se pudo copiar: el link quedó en la barra de direcciones');
}
function linkSeccion(sec, titulo) {
  V.res.sec = sec; history.replaceState(null, '', '#' + hashActual());
  compartir(urlRes(V.res.materia, V.res.apunte, sec), titulo, sec ? 'seccion' : 'apunte', V.res.materia + '/' + V.res.apunte + (sec ? '#' + sec : ''));
}
// Cada h2/h3 del apunte recibe un id estable (sacado del título) y un botón para copiar su link.
const sinEtiquetas = h => h.replace(/<[^>]*>/g, '').replace(/&[#\w]+;/g, ' ').trim();
const slug = t => sinEtiquetas(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50).replace(/-+$/, '') || 'seccion';
function seccionar(a) {
  if (a.secciones) return a;
  const usados = {}; a.secciones = [];
  a.cuerpoConIds = a.cuerpo.replace(/<h([23])>([\s\S]*?)<\/h\1>/g, (_, n, html) => {
    let id = slug(html); if (usados[id]) id += '-' + (++usados[id]); else usados[id] = 1;
    const t = sinEtiquetas(html);
    a.secciones.push({ id, t, n: Number(n) });
    return `<h${n} id="s-${id}">${html}<button class="ancla" onclick="linkSeccion(${arg(id)},${arg(t)})" aria-label="Copiar el link a «${esc(t)}»" title="Copiar el link a esta parte">🔗</button></h${n}>`;
  });
  return a;
}
// Todas las materias de grado como tarjetas: arriba las que tienen resumen; abajo, en punteado, las que faltan.
function vResumenes() {
  if (!D.resumenes) { cargarResumenes(); return '<p class="cargando">Cargando los resúmenes…</p>'; }
  if (V.prac) return vPractica();
  if (V.res.apunte) return vApunte();
  const R = D.resumenes;
  if (R.error) return '<p class="vacio">No pude cargar los resúmenes. Puede ser la conexión. <button class="btn sec" type="button" onclick="location.reload()">Probar de nuevo</button></p>';
  const m = R.materias.find(x => x.id === V.res.materia);
  if (m) return vMateriaRes(m);
  const plan = id => D.plan.materias.find(x => x.id === id) || { id, nombre: id };
  const faltan = D.plan.materias.filter(p => p.grupo === 'grado' && !R.materias.some(r => r.id === p.id));
  // Las que la persona cursa o tiene para final van primero.
  const est = id => (E.materias[id] || {}).estado, suya = id => est(id) === 'cursando' || est(id) === 'regular';
  const primero = L => L.slice().sort((x, y) => suya(y.id) - suya(x.id));
  const marca = id => est(id) === 'cursando' ? '<span class="chip">la cursás</span>' : est(id) === 'regular' ? '<span class="chip">te falta el final</span>' : '';
  const cabeza = p => `<span class="fila">${p.sigla ? `<span class="clave">${esc(p.sigla)}</span>` : ''}<span class="crece"></span>${marca(p.id)}</span>`;
  return retomar() + `<p class="chico tenue">Mis apuntes de cada materia, hechos para estudiar: con preguntas para autoevaluarte y para practicar de a ${RONDA}.</p>
    <div class="busca-res"><label for="res-q">Buscar en los resúmenes</label>
      <input id="res-q" maxlength="100" type="search" autocomplete="off" placeholder="gramaje, punto de equilibrio…" aria-label="Buscar en los resúmenes" value="${esc(V.busq)}" onfocus="cargarBusqueda()" oninput="buscarRes(this.value)"></div>
    <div id="res-resultados" aria-live="polite">${resultadosRes()}</div>
    <p class="chico tenue"><a href="r/">Todos los apuntes en versión para leer</a> (sin abrir la app, para compartir o buscar en Google).</p>
    <div id="res-tarjetas" ${V.busq.trim().length >= 3 ? 'hidden' : ''}>
    <div class="titulo-sec"><h2>Con resumen</h2><span class="chico tenue">${R.materias.length} de ${R.materias.length + faltan.length} materias</span></div>
    <div class="res-grilla">${primero(R.materias).map(r => {
      const preg = r.apuntes.reduce((t, a) => t + (a.preguntas || 0), 0);
      return `<button class="res-mat" onclick="verRes(${arg(r.id)})">${cabeza(plan(r.id))}<b>${esc(r.nombre)}</b>
        <span class="chico tenue">${r.apuntes.length} apuntes${preg ? ` · ${preg} preguntas` : ''}${r.pdfs.length ? ` · ${r.pdfs.length} PDF` : ''}</span>
        <span class="chico tenue">Para ${esc(r.examen)} · ${r.anio}</span>${avanceLectura(r)}</button>`;
    }).join('')}</div>
    ${faltan.length ? `<div class="titulo-sec"><h2>Todavía sin resumen</h2><span class="chico tenue">Se suman a medida que las curso</span></div>
    <div class="res-grilla chica">${primero(faltan).map(p => `<div class="res-mat falta">${cabeza(p)}<b>${esc(p.nombre)}</b>
      <button class="enlace chico" onclick="pedirResumen(${arg(p.id)})">Pedila o compartí tus apuntes</button></div>`).join('')}</div>` : ''}</div>`;
}
function vMateriaRes(m) {
  return `<div class="fila"><button class="btn lin ch" onclick="verRes()">← Todas las materias</button><span class="crece"></span>
      <button class="btn lin ch" onclick="compartir(urlRes(${arg(m.id)}),${arg('Resúmenes de ' + m.nombre)},'materia',${arg(m.id)})">🔗 Compartir</button>
      <button class="btn lin ch" onclick="abrirQR(urlRes(${arg(m.id)}),${arg('Resúmenes de ' + m.nombre)},'materia',${arg(m.id)})" aria-label="Código QR de los resúmenes de ${esc(m.nombre)}">▦ QR</button></div>
    <div class="titulo-sec"><h2>${esc(m.nombre)}</h2><span class="chico tenue">Para ${esc(m.examen)} · ${m.anio}${leidosDe(m) ? ` · ✓ ${leidosDe(m)} de ${m.apuntes.length} leídos` : ''}</span></div>
    ${m.aviso ? `<div class="tarjeta" role="note"><p class="chico u-my6"><b>⚠️ Por verificar.</b> ${esc(m.aviso)}</p></div>` : ''}
    ${(m.faltan || []).length ? `<div class="tarjeta" role="note"><p class="chico u-my6"><b>📎 Textos que todavía no tengo</b> y que faltan en estos apuntes:</p>
      <ul class="biblio">${m.faltan.map(r => `<li>${esc(r)} <button class="enlace chico" onclick="tengoTexto(${arg(r)})">¿Tenés este texto? Mandámelo</button></li>`).join('')}</ul></div>` : ''}
    ${(n => n ? `<div class="tarjeta practicar fila"><span class="crece"><b><span aria-hidden="true">🧠</span> Practicar</b><span class="chico tenue u-display-block">${n} preguntas de todos los apuntes, de a ${RONDA}: primero las que nunca te salieron o te salieron mal.</span></span>
      <button class="btn" onclick="empezarPractica(${arg(m.id)})">Empezar</button></div>` : '')(m.apuntes.reduce((t, a) => t + (a.preguntas || 0), 0))}
    ${m.id === '0911' ? `<div class="tarjeta practicar fila"><span class="crece"><b><span aria-hidden="true">🕹️</span> Arcade</b><span class="chico tenue u-display-block">Una sala aparte y opcional, con puntos y récords: preguntas con tres vidas y racha, o tocar el error en un texto.</span></span>
      <button class="btn sec" onclick="irArcade()">Entrar</button></div>` : ''}
    ${m.id === '0909' ? `<p class="chico u-margin-4px-0-8px">🧮 Para practicar el escandallo con tus números: <button class="enlace" onclick="irSim('escandallo')">simulador de escandallo</button>.</p>` : ''}
    <div class="tarjeta u-padding-6px-16px">${m.apuntes.map(a => `<button class="evento fila-boton" onclick="abrirApunte(${arg(m.id)},${arg(a.id)})">
      <span class="clave">${esc(a.clave)}</span><span class="crece"><b>${esc(a.t)}</b><span class="chico tenue u-display-block">${a.min} min de lectura${a.preguntas ? ' · ' + a.preguntas + ' preguntas para autoevaluarte' : ''}</span></span>${E.leidos[m.id + '/' + a.id] ? '<span class="chip ok">✓ leído</span>' : ''}${chipRepaso(m.id, a)}<span aria-hidden="true">›</span></button>`).join('')}</div>
    ${m.pdfs.length ? `<details class="tarjeta"><summary class="resumen-pdf"><b>Hojas de repaso para imprimir</b> <span class="chip">${m.pdfs.length} PDF</span></summary>
      ${m.pdfs.map(p => `<a class="evento u-color-inherit_text-decoration-none" href="resumenes/${esc(encodeURI(p.archivo))}" target="_blank" rel="noopener">📄 <span class="crece">${esc(p.t)}</span> ↗</a>`).join('')}</details>` : ''}
    <div class="tarjeta fila"><span class="crece chico"><b>¿Tenés tu propio resumen de esta materia?</b><span class="tenue u-display-block">Sumalo para quien viene detrás. Lo reviso antes de publicarlo y te acredito si querés.</span></span>
      <button class="btn sec ch" onclick="sumarApunte(${arg(m.id)})">Sumá tu resumen</button></div>`;
}
const leidosDe = m => m.apuntes.filter(a => E.leidos[m.id + '/' + a.id]).length;
function avanceLectura(m) {
  const n = leidosDe(m);
  return n ? `<span class="chico">✓ ${n} de ${m.apuntes.length} leídos</span><span class="barra" aria-hidden="true"><i style="width:${Math.round(n / m.apuntes.length * 100)}%"></i></span>` : '';
}
function marcarLeido(k) {
  if (!/^[\w.-]{1,60}\/[\w.-]{1,60}$/.test(k)) return;
  if (E.leidos[k]) delete E.leidos[k];
  else {
    E.leidos[k] = hoy(); medir('marcar_leido', { item_id: k }); aviso('✓ Marcado como leído');
    const M = ((D.resumenes || {}).materias || []).find(x => x.id === k.split('/')[0]);
    if (M && leidosDe(M) === M.apuntes.length) hito(M.apuntes.length > 1 ? `Terminaste los ${M.apuntes.length} apuntes de ${M.nombre}` : `Terminaste el apunte de ${M.nombre}`);
  }
  guardar(); render();
}
function imprimir(k) { medir('imprimir', { item_id: k }); window.print(); }

// BUSCADOR: resumenes/busqueda.json (lo arma resumenes_web.py) se baja recién cuando alguien va a buscar.
function cargarBusqueda() {
  return cargarBusqueda.p = cargarBusqueda.p || (async () => {
    try {
      const r = await fetch('resumenes/busqueda.json'); if (!r.ok) throw new Error();
      const b = await r.json();
      b.s = b.s.map(([m, a, sec, t, x]) => ({ m, a, sec, t, x, nt: sinTildes(t + ' ' + (b.apuntes[m + '/' + a] || '')), nx: sinTildes(x) }));
      D.busqueda = b;
    } catch (e) { D.busqueda = { error: true, s: [] }; }
    if (V.tab === 'resumenes' && $('#res-resultados')) buscarRes(V.busq);
  })();
}
function buscarRes(q) {
  V.busq = q;
  const caja = $('#res-resultados'), tarjetas = $('#res-tarjetas');
  if (caja) caja.innerHTML = resultadosRes();
  if (tarjetas) tarjetas.hidden = q.trim().length >= 3;
  if (q.trim().length >= 3) cargarBusqueda();
  clearTimeout(buscarRes.t);
  buscarRes.t = setTimeout(() => { if (V.busq.trim().length >= 3 && D.busqueda) medir('search', { largo: V.busq.trim().length }); }, 1500);
}
// Marca las palabras buscadas en un tramo del texto (las posiciones salen del texto sin tildes, que mide lo mismo).
function resaltar(x, nx, pals, desde, hasta) {
  const marcas = [];
  pals.forEach(p => { for (let i = nx.indexOf(p, desde); i >= 0 && i < hasta; i = nx.indexOf(p, i + p.length)) marcas.push([i, Math.min(hasta, i + p.length)]); });
  marcas.sort((a, b) => a[0] - b[0]);
  let h = '', pos = desde;
  marcas.forEach(([i, f]) => { if (i < pos) return; h += esc(x.slice(pos, i)) + '<mark>' + esc(x.slice(i, f)) + '</mark>'; pos = f; });
  return h + esc(x.slice(pos, hasta));
}
function resultadosRes() {
  const q = sinTildes(V.busq.trim());
  if (q.length < 3) return '';
  if (!D.busqueda) return '<p class="cargando">Buscando…</p>';
  if (D.busqueda.error) return '<p class="vacio">No se pudo cargar el buscador. <button class="btn sec" type="button" onclick="location.reload()">Probar de nuevo</button></p>';
  const pals = q.split(/\s+/).filter(p => p.length > 1);
  const hallados = [];
  D.busqueda.s.forEach(s => {
    let puntos = 0;
    for (const p of pals) { const t = s.nt.includes(p), x = s.nx.includes(p); if (!t && !x) return; puntos += (t ? 5 : 0) + (x ? 1 : 0); }
    hallados.push([puntos, s]);
  });
  if (!hallados.length) return `<p class="vacio">No encontré «${esc(V.busq.trim())}» en los resúmenes. Probá con otra palabra o sin tildes.</p>`;
  hallados.sort((a, b) => b[0] - a[0]);
  const plan = id => (D.plan.materias.find(x => x.id === id) || {}).sigla || '';
  return `<p class="chico tenue">${hallados.length > 40 ? 'Los 40 más relevantes de ' : ''}${hallados.length} resultado${hallados.length === 1 ? '' : 's'}</p>
    <div class="tarjeta u-padding-6px-16px">${hallados.slice(0, 40).map(([, s]) => {
      const i = Math.max(0, ...pals.map(p => s.nx.indexOf(p)).filter(i => i >= 0).slice(0, 1)), desde = Math.max(0, i - 60), hasta = Math.min(s.x.length, i + 140);
      const ap = D.busqueda.apuntes[s.m + '/' + s.a] || '';
      return `<button class="evento fila-boton" onclick="verRes(${arg(s.m)},${arg(s.a)},${arg(s.sec)})">
        <span class="clave">${esc(plan(s.m))}</span><span class="crece"><b>${esc(s.t || ap)}</b>
        <span class="chico tenue u-display-block">${esc(D.busqueda.materias[s.m] || '')}${s.t ? ' · ' + esc(ap) : ''}</span>
        ${s.x ? `<span class="chico extracto">${desde ? '…' : ''}${resaltar(s.x, s.nx, pals, desde, hasta)}${hasta < s.x.length ? '…' : ''}</span>` : ''}</span><span aria-hidden="true">›</span></button>`;
    }).join('')}</div>`;
}
function pedirResumen(id) {
  const p = D.plan.materias.find(x => x.id === id) || { nombre: id };
  medir('pedir_resumen', { item_id: id });
  idea({ titulo: '📚 ' + p.nombre, intro: 'Todavía no hay resumen de esta materia. Contame si te serviría (y para cuándo), o si tenés apuntes propios que quieras compartir.',
    ejemplo: 'Ej.: la curso este cuatrimestre y me vendría bien para el primer parcial…', prefijo: '[Resúmenes] ' + (p.sigla || p.nombre) + ': ' });
}
const LETRAS = 'abcd';
function vApunte() {
  const { materia, apunte } = V.res, k = materia + '/' + apunte, a = D.apuntes[k];
  const m = D.resumenes.materias.find(x => x.id === materia) || { nombre: '', apuntes: [] };
  const volver = `<button class="btn lin ch" onclick="verRes(${arg(materia)})">← ${esc(m.nombre) || 'Resúmenes'}</button>`;
  if (!a) return `<div class="fila">${volver}</div><p class="cargando">Cargando el apunte…</p>`;
  const i = m.apuntes.findIndex(x => x.id === apunte), ant = m.apuntes[i - 1], sig = m.apuntes[i + 1];
  const q = V.quiz[k] = V.quiz[k] || {};
  const cerradas = a.preguntas.filter(p => p.tipo !== 'abierta'), hechas = cerradas.filter(p => q[p.n] != null), bien = hechas.filter(p => q[p.n] === p.correcta);
  const pregunta = (p, j) => {
    const r = q[p.n], ya = r != null;
    if (p.tipo === 'abierta') return `<div class="pregunta"><p><b>${j + 1}.</b> ${p.texto}</p><details><summary>Ver respuesta</summary><div class="chico">${p.respuesta}</div></details></div>`;
    const ops = p.tipo === 'vf' ? ['Verdadero', 'Falso'] : p.opciones;
    const correcta = p.tipo === 'vf' ? ops[p.correcta] : LETRAS[p.correcta] + ')';
    return `<div class="pregunta"><p><b>${j + 1}.</b> ${p.tipo === 'vf' ? '<span class="chip">V o F</span> ' : ''}${p.texto}</p>
      <div class="opciones ${p.tipo}">${ops.map((o, x) => `<button class="opcion ${ya ? (x === p.correcta ? 'bien' : x === r ? 'mal' : 'apagada') : ''}" ${ya ? 'aria-disabled="true"' : ''}
        data-f="q${p.n}-${x}" onclick="responder(${arg(k)},${p.n},${x})">${p.tipo === 'opcion' ? `<b>${LETRAS[x]})</b> ` : ''}${p.tipo === 'vf' ? esc(o) : o}</button>`).join('')}</div>
      ${ya ? `<p class="chico devolucion ${r === p.correcta ? 'ok' : 'no'}" role="status"><b>${r === p.correcta ? '✓ ¡Bien!' : '✗ Era ' + correcta}</b> ${p.respuesta}</p>` : ''}</div>`;
  };
  seccionar(a);
  const base = `#resumenes/${esc(materia)}/${esc(apunte)}/`;
  const indice = a.secciones.length > 2 ? `<details class="indice-apunte"><summary>En este apunte <span class="chip">${a.secciones.length} partes</span></summary><ol>
    ${a.secciones.map(x => `<li class="${x.n === 3 ? 'sub' : ''}"><a href="${base}${esc(x.id)}">${esc(x.t)}</a></li>`).join('')}
    ${a.preguntas.length ? `<li><a href="${base}autoevaluacion">Autoevaluación</a></li>` : ''}</ol></details>` : '';
  const leido = !!E.leidos[k];
  const botonLeido = donde => `<button class="btn ${leido ? 'sec' : 'lin'} ch" data-f="leido-${donde}" aria-pressed="${leido}" onclick="marcarLeido(${arg(k)})">${leido ? '✓ Leído' : 'Marcar como leído'}</button>`;
  const clave = a.preguntas.length ? `<section class="solo-imprimir"><h2>Respuestas</h2><ol>${a.preguntas.map(p => `<li>${p.tipo === 'abierta' ? '' : `<b>${p.tipo === 'vf' ? ['Verdadero', 'Falso'][p.correcta] : LETRAS[p.correcta] + ')'}</b> `}${p.respuesta}</li>`).join('')}</ol></section>` : '';
  return `<div class="fila no-imprimir">${volver}<span class="crece"></span>${botonLeido('arriba')}
      <button class="btn lin ch" onclick="imprimir(${arg(k)})" aria-label="Imprimir o guardar como PDF">🖨️</button>
      <button class="btn lin ch" onclick="linkSeccion('',${arg(a.titulo)})">🔗 Compartir</button>
      <button class="btn lin ch" onclick="abrirQR(urlRes(${arg(materia)},${arg(apunte)}),${arg(a.titulo)},'apunte',${arg(k)})" aria-label="Código QR de este apunte">▦ QR</button></div>
    <article class="tarjeta apunte"><p class="solo-imprimir chico">${esc(m.nombre)} · Resúmenes de Galera (galera.com.ar)</p><h2>${esc(a.titulo)}</h2>${indice}${a.cuerpoConIds}</article>
    ${a.preguntas.length ? `<div class="titulo-sec" id="autoevaluacion"><h2>Autoevaluación <button class="ancla" onclick="linkSeccion('autoevaluacion','Autoevaluación')" aria-label="Copiar el link a la autoevaluación" title="Copiar el link a esta parte">🔗</button></h2>
      ${cerradas.length ? `<span class="chico">${hechas.length ? `<b>${bien.length} de ${hechas.length}</b> bien` : 'Tocá la opción que te parezca correcta'}${hechas.length ? ` · <button class="enlace" onclick="V.quiz[${arg(k)}]={};render()">Empezar de nuevo</button>` : ''}</span>` : ''}</div>
      <div class="tarjeta">${a.preguntas.map(pregunta).join('')}</div>${bloqueFinAuto(materia, apunte, bien.length, hechas.length, cerradas.length)}` : ''}
    ${clave}
    <div class="tarjeta fin-apunte no-imprimir"><span class="crece">${leido ? '¡Listo! Lo tenés marcado como leído.' : '¿Terminaste de leerlo?'}</span>${botonLeido('abajo')}</div>
    <p class="solo-imprimir chico">Apunte de Fidel Chaves, hecho para estudiar: no reemplaza la bibliografía ni las clases. ${esc(urlRes(materia, apunte))}</p>
    <div class="fila no-imprimir u-margin-top-12px">${ant ? `<button class="btn lin ch" onclick="abrirApunte(${arg(materia)},${arg(ant.id)})">← ${esc(ant.clave)}</button>` : ''}<span class="crece"></span>
      ${sig ? `<button class="btn sec ch" onclick="abrirApunte(${arg(materia)},${arg(sig.id)})">${esc(sig.clave)}: ${esc(sig.t)} →</button>` : ''}</div>`;
}
function irResumenes(materia) { V.tab = 'resumenes'; verRes(materia); }
function responder(k, n, x) { const q = V.quiz[k] = V.quiz[k] || {}; if (q[n] != null) return; q[n] = Number(x); render(); }

// PRÁCTICA: las preguntas de todos los apuntes de una materia, de a diez. Primero las que salieron mal más veces que bien,
// después las que nunca salieron y al final las que ya sabés. Recordar sin mirar (y volver unos días después) es lo que más ayuda a retener.
const RONDA = 10;
async function empezarPractica(materia) {
  if (!RE_ID.test(materia || '')) return;
  await cargarResumenes();
  const m = (D.resumenes.materias || []).find(x => x.id === materia);
  if (!m) return aviso('Esta materia todavía no tiene preguntas');
  cerrar();
  V.tab = 'resumenes'; V.res = { materia, apunte: '', sec: '' }; history.replaceState(null, '', '#' + hashActual());
  V.prac = { materia, cargando: true }; render(); window.scrollTo(0, 0);
  try {
    await Promise.all(m.apuntes.map(async a => {
      const k = materia + '/' + a.id;
      if (!D.apuntes[k]) { const r = await fetch('resumenes/' + k + '.json'); if (!r.ok) throw new Error(); D.apuntes[k] = await r.json(); }
    }));
  } catch (e) { V.prac = null; render(); return aviso('No pude cargar las preguntas. Puede ser la conexión.'); }
  if (!V.prac || V.prac.materia !== materia) return; // se fue a otro lado mientras cargaba
  medir('practicar', { item_id: materia });
  nuevaRonda();
}
function nuevaRonda() {
  const materia = V.prac.materia, m = D.resumenes.materias.find(x => x.id === materia);
  const todas = m.apuntes.flatMap(a => (D.apuntes[materia + '/' + a.id].preguntas || []).map(p => ({ k: materia + '/' + a.id + '/' + p.n, p, ap: a })));
  const peso = x => {
    const r = E.practica[x.k];
    if (!r) return 1 + Math.random();                         // nunca salió: entre 1 y 2
    const neto = r[1] - r[0];
    return neto > 0 ? 2 + neto + Math.random() : Math.random() * 0.7 + Math.min(diasDesde(r[2]), 30) / 100; // mal: arriba; sabida: abajo
  };
  V.prac = { materia, cola: todas.map(x => [peso(x), x]).sort((a, b) => b[0] - a[0]).slice(0, RONDA).map(x => x[1]), i: 0, r: null, bien: 0, fallos: {} };
  render(); window.scrollTo(0, 0);
}
function anotarPrac(k, bien) {
  const r = E.practica[k] || [0, 0, hoy()];
  r[bien ? 0 : 1]++; r[2] = hoy(); E.practica[k] = r;
  if (bien) V.prac.bien++; else { const ap = V.prac.cola[V.prac.i].ap; V.prac.fallos[ap.id] = ap; }
  guardar(true);
}
function responderPrac(x) { const P = V.prac, it = P.cola[P.i]; if (P.r != null) return; P.r = Number(x); anotarPrac(it.k, P.r === it.p.correcta); render(); }
function verRespPrac() { V.prac.r = 'ver'; render(); }
function autoPrac(sabia) { if (V.prac.r !== 'ver') return; anotarPrac(V.prac.cola[V.prac.i].k, sabia); siguientePrac(); }
function siguientePrac() { V.prac.i++; V.prac.r = null; if (V.prac.i >= V.prac.cola.length) { cerrarRonda(); invitarLuego('practica', 4000); } render(); }
function vPractica() {
  const P = V.prac, m = (D.resumenes.materias || []).find(x => x.id === P.materia) || { nombre: '' };
  const volver = `<div class="fila"><button class="btn lin ch" onclick="V.prac=null;render()">← ${esc(m.nombre)}</button>`;
  if (P.cargando) return volver + '</div><p class="cargando">Juntando las preguntas…</p>';
  if (P.i >= P.cola.length) {
    const mal = P.cola.length - P.bien;
    return volver + `</div><div class="tarjeta practica"><h2>${P.bien} de ${P.cola.length} bien</h2>
      <p>${mal ? (mal === 1 ? 'La que fallaste vuelve' : 'Las ' + mal + ' que fallaste vuelven') + ' primero en la próxima ronda.' : '¡Todas bien! La próxima ronda trae preguntas que todavía no practicaste.'}</p>
      <p class="chico tenue">Practicar sin mirar el apunte, y volver a hacerlo unos días después, es lo que más ayuda a retener. Si cargás la fecha del parcial en Mi carrera, en el Calendario te sugiero cuándo repasar.</p>
      ${cierreRonda(P)}
      <div class="botones"><button class="btn" onclick="nuevaRonda()">Otra ronda</button><button class="btn lin" onclick="V.prac=null;render()">Volver a la materia</button></div></div>`;
  }
  const it = P.cola[P.i], p = it.p, r = P.r;
  let cuerpo;
  if (p.tipo === 'abierta') {
    cuerpo = r == null ? `<p class="chico tenue">Pensá la respuesta (o escribila en un papel) y después mirala.</p><div class="botones"><button class="btn" data-f="pq-ver" onclick="verRespPrac()">Ver la respuesta</button></div>`
      : `<div class="devolucion chico">${p.respuesta}</div><p class="chico u-margin-12px-0-0"><b>¿La sabías?</b></p>
        <div class="botones"><button class="btn sec" data-f="pq-si" onclick="autoPrac(true)">Sí, la sabía</button><button class="btn lin" data-f="pq-no" onclick="autoPrac(false)">No, o más o menos</button></div>`;
  } else {
    const ops = p.tipo === 'vf' ? ['Verdadero', 'Falso'] : p.opciones, ya = r != null;
    const correcta = p.tipo === 'vf' ? ops[p.correcta] : LETRAS[p.correcta] + ')';
    cuerpo = `<div class="opciones ${p.tipo}">${ops.map((o, x) => `<button class="opcion ${ya ? (x === p.correcta ? 'bien' : x === r ? 'mal' : 'apagada') : ''}" ${ya ? 'aria-disabled="true"' : ''}
        data-f="pq-${P.i}-${x}" onclick="responderPrac(${x})">${p.tipo === 'opcion' ? `<b>${LETRAS[x]})</b> ` : ''}${p.tipo === 'vf' ? esc(o) : o}</button>`).join('')}</div>
      ${ya ? `<p class="chico devolucion ${r === p.correcta ? 'ok' : 'no'}" role="status"><b>${r === p.correcta ? '✓ ¡Bien!' : '✗ Era ' + correcta}</b> ${p.respuesta}</p>
        <div class="botones"><button class="btn" data-f="pq-sig" onclick="siguientePrac()">${P.i + 1 < P.cola.length ? 'Siguiente' : 'Ver cómo me fue'}</button></div>` : ''}`;
  }
  return volver + `<span class="crece"></span><span class="chico tenue">Pregunta ${P.i + 1} de ${P.cola.length}</span></div>
    <div class="barra u-margin-8px-0-12px" aria-hidden="true" ><i style="width:${Math.round(P.i * 100 / P.cola.length)}%"></i></div>
    <div class="tarjeta practica"><p class="u-mb6 chico tenue">${esc(it.ap.clave)} · ${esc(it.ap.t)}</p>
    <p class="enunciado">${p.tipo === 'vf' ? '<span class="chip">V o F</span> ' : ''}${p.texto}</p>${cuerpo}</div>`;
}

// =====================================================================
// ECOSISTEMA DEL LIBRO (IAE): grafo de actores; los datos están en ecosistema.js. Estado solo de la sesión (V.eco).
// =====================================================================
let ecoVert = null;
window.addEventListener('resize', () => { if (V.tab === 'simuladores' && V.sim === 'ecosistema' && (window.innerWidth < 720) !== ecoVert) render(); });
const ecoS = () => (V.eco = V.eco || { sel: '', cat: '', paso: -1, prac: null });
// Zoom y desplazamiento del mapa: se cambia el viewBox del SVG sin volver a dibujar (V.eco.vb lo recuerda).
let ecoArrastro = false;
function ecoSetVB(s, x, y, w) {
  const fx = +s.dataset.fx, fy = +s.dataset.fy, fw = +s.dataset.fw, fh = +s.dataset.fh;
  w = Math.max(fw / 6, Math.min(fw, w)); const h = w * fh / fw;
  x = Math.max(fx, Math.min(fx + fw - w, x)); y = Math.max(fy, Math.min(fy + fh - h, y));
  s.setAttribute('viewBox', [x, y, w, h].map(n => +n.toFixed(1)).join(' '));
  s.classList.toggle('zoom', w < fw - 1);
  s.dataset.z = w < fw * 0.45 ? 2 : w < fw - 1 ? 1 : 0;
  (s.dataset.k === 'glo' ? V.glo : ecoS()).vb = w < fw - 1 ? [x, y, w, h] : null;
}
function ecoZoomEn(s, f, cx, cy) { // cx, cy: punto fijo, en coordenadas del mapa
  const v = s.viewBox.baseVal, w = v.width / f, k = w / v.width;
  ecoSetVB(s, cx - (cx - v.x) * k, cy - (cy - v.y) * k, w);
}
function ecoZoom(f) { const s = $('svg.eco'); if (!s) return; const v = s.viewBox.baseVal; ecoZoomEn(s, f, v.x + v.width / 2, v.y + v.height / 2); }
function ecoAjustar() { const s = $('svg.eco'); if (s) ecoSetVB(s, +s.dataset.fx, +s.dataset.fy, +s.dataset.fw); }
(function () {
  if (typeof document.addEventListener !== 'function') return;   // las pruebas corren sin navegador
  const dedos = new Map(); let ult = null, dist0 = 0, mov = 0;
  const aMapa = (s, px, py) => { const r = s.getBoundingClientRect(), v = s.viewBox.baseVal, k = Math.min(r.width / v.width, r.height / v.height);
    return [v.x + (px - r.left - (r.width - v.width * k) / 2) / k, v.y + (py - r.top - (r.height - v.height * k) / 2) / k]; };
  document.addEventListener('pointerdown', ev => {
    const s = ev.target.closest && ev.target.closest('svg.eco'); if (!s) return;
    dedos.set(ev.pointerId, { x: ev.clientX, y: ev.clientY }); ult = { x: ev.clientX, y: ev.clientY }; mov = 0; ecoArrastro = false;
    if (dedos.size === 2) { const [a, b] = [...dedos.values()]; dist0 = Math.hypot(a.x - b.x, a.y - b.y); }
  });
  document.addEventListener('pointermove', ev => {
    const s = $('svg.eco'); if (!s || !dedos.has(ev.pointerId)) return;
    dedos.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (dedos.size === 2) { // pellizco
      const [a, b] = [...dedos.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (dist0 > 0 && d > 0) { const [cx, cy] = aMapa(s, (a.x + b.x) / 2, (a.y + b.y) / 2); ecoZoomEn(s, d / dist0, cx, cy); ecoArrastro = true; }
      dist0 = d; return;
    }
    if (!s.classList.contains('zoom') || !ult) return;
    const dx = ev.clientX - ult.x, dy = ev.clientY - ult.y; mov += Math.abs(dx) + Math.abs(dy); ult = { x: ev.clientX, y: ev.clientY };
    if (mov < 6) return;
    ecoArrastro = true;
    const r = s.getBoundingClientRect(), v = s.viewBox.baseVal, k = Math.min(r.width / v.width, r.height / v.height);
    ecoSetVB(s, v.x - dx / k, v.y - dy / k, v.width);
  });
  const soltar = ev => { dedos.delete(ev.pointerId); dist0 = 0; if (dedos.size === 1) ult = { ...[...dedos.values()][0] }; };
  document.addEventListener('pointerup', soltar); document.addEventListener('pointercancel', soltar);
  document.addEventListener('wheel', ev => { // Ctrl + rueda (o gesto de pellizco del trackpad)
    const s = ev.target.closest && ev.target.closest('svg.eco'); if (!s || !(ev.ctrlKey || ev.metaKey)) return;
    ev.preventDefault(); const [cx, cy] = aMapa(s, ev.clientX, ev.clientY); ecoZoomEn(s, ev.deltaY < 0 ? 1.15 : 1 / 1.15, cx, cy);
  }, { passive: false });
})();
function ecoElegir(id) {
  if (ecoArrastro) { ecoArrastro = false; return; }
  const e = ecoS();
  if (e.prac) { // práctica: se responde tocando el nodo
    if (e.prac.resp) return;
    e.prac.resp = id; if (id === e.prac.cola[e.prac.i]) e.prac.ok++;
    render(); return;
  }
  e.sel = e.sel === id ? '' : id; e.paso = -1; render();
}
function ecoCat(c) { const e = ecoS(); e.cat = e.cat === c ? '' : c; render(); }
function ecoPaso(d) { const e = ecoS(), n = Ecosistema.RECORRIDO.length; e.sel = ''; e.prac = null; e.paso = d === 0 ? -1 : Math.max(0, Math.min(n - 1, (e.paso < 0 ? (d > 0 ? 0 : 0) : e.paso + d))); render(); }
function ecoPractica(on) {
  const e = ecoS(); e.sel = ''; e.paso = -1;
  e.prac = on ? { cola: Ecosistema.cola(Date.now() % 100000).slice(0, 10), i: 0, ok: 0, resp: null, fin: false } : null; render();
}
function ecoSig() { const p = ecoS().prac; if (p.i + 1 >= p.cola.length) p.fin = true; else { p.i++; p.resp = null; } render(); }
function ecoTecla(ev, id) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); ecoElegir(id); } }
function vEcosistema() {
  const E_ = Ecosistema, e = ecoS(), vert = window.innerWidth < 720;
  ecoVert = vert;
  const px = a => vert ? a.m[0] : a.x, py = a => vert ? a.m[1] : a.y;
  const prac = e.prac, paso = !prac && e.paso >= 0 ? E_.RECORRIDO[e.paso] : null;
  const cat = id => E_.CATEGORIAS.find(c => c.id === id);
  const sel = !prac && !paso && e.sel ? E_.por(e.sel) : null;
  const vec = sel ? E_.vecinos(sel.id) : [];
  const vecIds = new Set(vec.map(v => v.con));
  const activos = paso ? new Set(paso.ids) : null;
  const luz = a => { // true = destacado, false = atenuado
    if (prac) return true;
    if (sel) return a.id === sel.id || vecIds.has(a.id);
    if (activos) return activos.has(a.id);
    return !e.cat || a.cat === e.cat;
  };
  const arista = r => {
    const A = E_.por(r.a), B = E_.por(r.b);
    if (sel) return r.a === sel.id || r.b === sel.id;
    if (activos) return activos.has(r.a) && activos.has(r.b);
    return !e.cat || (A.cat === e.cat && B.cat === e.cat);
  };
  const rad = a => (a.r || 24) * (vert ? .85 : 1);
  const lineas = E_.RELACIONES.map(r => {
    const A = E_.por(r.a), B = E_.por(r.b), on = arista(r) && !prac;
    const dx = px(B) - px(A), dy = py(B) - py(A), L = Math.hypot(dx, dy) || 1;
    const x1 = px(A) + dx / L * rad(A), y1 = py(A) + dy / L * rad(A), x2 = px(B) - dx / L * (rad(B) + (r.dir ? 5 : 0)), y2 = py(B) - dy / L * (rad(B) + (r.dir ? 5 : 0));
    const foco = (sel || activos) && on;
    return `<line class="eco-ar ${r.tipo} ${foco ? 'foco' : ''} ${(sel || activos || e.cat) && !on ? 'apaga' : ''}" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" ${r.dir && r.tipo === 'cadena' ? 'marker-end="url(#eco-flecha)"' : ''}/>`;
  }).join('');
  const etiquetas = '';
  const nodos = E_.ACTORES.map(a => {
    const c = cat(a.cat), oculto = prac && !(prac.resp), ok = prac && prac.resp && a.id === prac.cola[prac.i], mal = prac && prac.resp === a.id && !ok;
    const partes = a.t.length > 15 && a.t.includes(' ') ? [a.t.slice(0, a.t.lastIndexOf(' ', 15) > 0 ? a.t.lastIndexOf(' ', 15) : a.t.indexOf(' ')), a.t.slice((a.t.lastIndexOf(' ', 15) > 0 ? a.t.lastIndexOf(' ', 15) : a.t.indexOf(' ')) + 1)] : [a.t];
    return `<g class="eco-n c${c.n} ${luz(a) ? '' : 'apaga'} ${sel && sel.id === a.id ? 'sel' : ''} ${ok ? 'bien' : ''} ${mal ? 'mal' : ''}" tabindex="0" role="button" data-f="eco-${a.id}"
        aria-label="${esc(prac ? 'Actor sin nombre, categoría ' + c.t : a.t + ', ' + c.t)}" onclick="ecoElegir(${arg(a.id)})" onkeydown="ecoTecla(event,${arg(a.id)})">
      <circle cx="${px(a)}" cy="${py(a)}" r="${rad(a)}"/><text class="eco-ico" x="${px(a)}" y="${py(a) + (a.r ? 9 : 7)}" text-anchor="middle" style="font-size:${(a.r ? 26 : 20) * (vert ? .85 : 1)}px">${a.ico}</text>
      ${prac && !prac.resp ? '' : `<text class="eco-t" text-anchor="middle" x="${px(a)}" y="${py(a) + rad(a) + 15}">${partes.map((p, i) => `<tspan x="${px(a)}" dy="${i ? 14 : 0}">${esc(p)}</tspan>`).join('')}</text>`}
    </g>`;
  }).join('');
  const P = E_.PAD, FW = (vert ? E_.WM : E_.W) + 2 * P, FH = (vert ? E_.HM : E_.H) + 2 * P;
  if (e.vbVert !== vert) { e.vb = null; e.vbVert = vert; }
  const vb = e.vb || [-P, -P, FW, FH];
  const lienzo = `<div class="eco-scroll"><div class="eco-zoom" role="group" aria-label="Zoom del mapa">
      <button class="btn lin ch" onclick="ecoZoom(1.4)" aria-label="Acercar">＋</button><button class="btn lin ch" onclick="ecoZoom(1/1.4)" aria-label="Alejar">－</button><button class="btn lin ch" onclick="ecoAjustar()" aria-label="Ver todo el mapa">⤢</button></div>
    <svg class="eco ${vert ? 'vert' : ''} ${vb[2] < FW - 1 ? 'zoom' : ''}" viewBox="${vb.map(n => +n.toFixed(1)).join(' ')}" data-fx="${-P}" data-fy="${-P}" data-fw="${FW}" data-fh="${FH}" role="group" aria-label="Mapa de los actores del ecosistema del libro. Los mismos actores están en la lista de abajo.">
    <defs><marker id="eco-flecha" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10 z" class="eco-punta"/></marker></defs>
    ${lineas}${etiquetas}${nodos}</svg></div>
    <p class="u-mb6 chico tenue">Acercá con ＋ o pellizcando; arrastrá para moverte (⤢ vuelve a ver todo).</p>`;
  const leyenda = Object.entries(E_.TIPOS).map(([k, t]) => `<span class="eco-ley"><svg width="34" height="8" aria-hidden="true"><line class="eco-ar ${k} foco" x1="1" y1="4" x2="33" y2="4"/></svg>${esc(t.t)}</span>`).join('');
  const filtros = `<div class="eligen u-margin-8px-0" role="group" aria-label="Resaltar una categoría" >${['', ...E_.CATEGORIAS.map(c => c.id)].map(c => `<button class="btn ${e.cat === c ? '' : 'lin'} ch" aria-pressed="${e.cat === c}" data-f="eco-cat-${c || 'todas'}" onclick="ecoCat(${arg(c)})">${c ? esc(cat(c).t) : 'Todas'}</button>`).join('')}</div>`;
  // Panel inferior según el modo
  let panel = '';
  if (prac) {
    const id = prac.cola[prac.i], a = E_.por(id), n = prac.cola.length;
    if (prac.fin) panel = `<div class="tarjeta"><h3 class="u-mt0">Terminaste: ${prac.ok} de ${n}</h3><p class="chico tenue">Repasá los actores que fallaste mirando sus vínculos en el mapa.</p>
      <div class="botones"><button class="btn" onclick="ecoPractica(true)">Otra ronda</button><button class="btn lin" onclick="ecoPractica(false)">Salir de la práctica</button></div></div>`;
    else panel = `<div class="tarjeta practica"><p class="u-mb6 chico tenue">Pregunta ${prac.i + 1} de ${n} · aciertos: ${prac.ok}</p>
      <p class="enunciado">¿Quién es? <b>${esc(a.pista)}</b></p>
      ${prac.resp ? `<p class="chico devolucion ${prac.resp === id ? 'ok' : 'no'}" role="status"><b>${prac.resp === id ? '✓ ¡Bien!' : '✗ Era: ' + esc(a.t)}</b> ${esc(a.d)}</p>
        <div class="botones"><button class="btn" data-f="eco-sig" onclick="ecoSig()">${prac.i + 1 < n ? 'Siguiente' : 'Ver cómo me fue'}</button></div>` : '<p class="chico tenue">Tocá el actor en el mapa (o en la lista de abajo).</p>'}
      <div class="botones"><button class="btn lin ch" onclick="ecoPractica(false)">Salir de la práctica</button></div></div>`;
  } else if (paso) {
    const n = E_.RECORRIDO.length;
    panel = `<div class="tarjeta"><p class="u-mb4 chico tenue">Paso ${e.paso + 1} de ${n}</p><h3 class="u-mb6">${esc(paso.t)}</h3><p class="u-margin-0-0-10px">${esc(paso.txt)}</p>
      <p class="chico">${paso.ids.map(i => `<button class="enlace" onclick="ecoElegir(${arg(i)})">${E_.por(i).ico} ${esc(E_.por(i).t)}</button>`).join(' · ')}</p>
      <div class="botones"><button class="btn lin ch" onclick="ecoPaso(-1)" ${e.paso === 0 ? 'disabled' : ''}>← Anterior</button><button class="btn ch" data-f="eco-paso-sig" onclick="ecoPaso(1)" ${e.paso === n - 1 ? 'disabled' : ''}>Siguiente →</button>
      <button class="btn lin ch" onclick="ecoPaso(0)">Salir del recorrido</button></div></div>`;
  } else if (sel) {
    const c = cat(sel.cat), porTipo = Object.keys(E_.TIPOS).map(k => ({ k, L: vec.filter(v => v.tipo === k) })).filter(x => x.L.length);
    panel = `<div class="tarjeta"><div class="fila"><span class="chip tin">${esc(c.t)}</span><span class="crece"></span><span class="chico tenue">Temario: unidad ${esc(sel.u)}</span></div>
      <h3 class="u-my6">${sel.ico} ${esc(sel.t)}</h3><p>${esc(sel.d)}</p>
      <h4 class="u-margin-12px-0-4px">Se relaciona con</h4>
      ${porTipo.map(x => `<p class="chico tenue u-margin-8px-0-2px">${esc(E_.TIPOS[x.k].t)}</p><ul class="eco-vinc">${x.L.map(v => `<li><button class="enlace" onclick="ecoElegir(${arg(v.con)})">${esc(E_.por(v.con).t)}</button> <span class="tenue">${esc(E_.frase(sel.id, v).replace(E_.por(v.con).t + ': ', '').replace(/^[→←] [^:]+: /, ''))}${v.dir ? (v.sale ? ' (→)' : ' (←)') : ''}</span></li>`).join('')}</ul>`).join('')}
      <div class="botones"><button class="btn lin ch" onclick="ecoElegir(${arg(sel.id)})">Quitar la selección</button></div></div>`;
  } else {
    panel = `<div class="tarjeta"><p class="u-mt0">Un libro no es solo una cadena (autor → editor → distribuidor → librero → lector): lo rodean <b>actores</b>, <b>prácticas</b> e <b>instituciones</b> que forman un <b>ecosistema</b>. Tocá un actor para ver con quién se vincula y qué tipo de vínculo es.</p>
      <p class="chico tenue u-margin-bottom-0">Según Rivera Mir («Ecosistema») y el temario de Introducción a la Actividad Editorial. La <b>bibliodiversidad</b> (la riqueza editorial como bien común) se defiende frente a la monopolización y la homogeneización. Es un esquema para estudiar: cada mercado tiene sus variantes.</p></div>`;
  }
  const botones = prac ? '' : `<div class="botones u-margin-bottom-8px"><button class="btn ch" data-f="eco-recorrido" onclick="ecoPaso(1)">▶ Seguir el recorrido de un libro</button><button class="btn sec ch" data-f="eco-practica" onclick="ecoPractica(true)">🎯 Practicar: ¿quién es?</button></div>`;
  const lista = `<details class="tarjeta" ${V.ecoLista ? 'open' : ''} ontoggle="V.ecoLista=this.open"><summary><b>Todos los actores, en lista</b></summary>${E_.CATEGORIAS.map(c => `<p class="chico tenue u-margin-10px-0-4px">${esc(c.t)}</p>
      <div class="eligen">${E_.ACTORES.filter(a => a.cat === c.id).map(a => `<button class="btn lin ch" onclick="ecoElegir(${arg(a.id)})">${a.ico} ${esc(prac && !prac.resp ? '¿?' : a.t)}</button>`).join('')}</div>`).join('')}</details>`;
  return `<p class="u-mt0 chico tenue">Los actores del mundo editorial como nodos de un grafo. Es un mapa de estudio: no guarda nada.</p>${botones}${prac ? '' : filtros}${lienzo}
    <p class="chico eco-leyendas">${leyenda}</p>${panel}${lista}`;
}

// =====================================================================
// BIBLIOTECA: libros recomendados para editar (datos/biblioteca.json; tapas en biblioteca/)
// =====================================================================
async function cargarBiblioteca() {
  if (D.biblioteca || cargarBiblioteca.va) return;
  cargarBiblioteca.va = true;
  try { D.biblioteca = await json('biblioteca.json'); } catch (e) { D.biblioteca = { libros: [], temas: [], error: true }; }
  if (V.tab === 'biblioteca') render();
}
// Tapa: la imagen guardada, o una tapa tipográfica si no hay (o si la imagen no carga).
const tapa = (l, grande) => `<div class="tapa ${grande ? 'grande' : ''}" style="--tono:${COLORES[(l.t.length + l.autor.length) % COLORES.length]}">
  <span class="tapa-texto"><b>${esc(l.t)}</b><small>${esc(l.autor)}</small></span>
  ${l.sinTapa ? '' : `<img src="biblioteca/${esc(l.id)}.jpg" alt="" loading="lazy" onerror="this.remove()">`}</div>`;
// Biblioteca tiene dos solapas: «Libros» (los recomendados, la colección «Libros sobre Libros» del FCE y los libros de la bibliografía de los programas, todo junto
// y filtrable por origen, tema y materia) y las publicaciones periódicas del sector.
const SOLAPAS_BIB = [['libros', 'Libros'], ['per', 'Publicaciones periódicas']];
const ORIGEN_LIBRO = { rec: 'Recomendado', fce: 'Libros sobre Libros (FCE)', prog: 'De la bibliografía de la carrera' };
const TEMA_FCE = { oficio: 'El oficio editorial', industria: 'La industria del libro', historia: 'Historia del libro y la lectura', lectura: 'Historia del libro y la lectura', tipografia: 'Diseño y tipografía', derechos: 'Derechos y contratos' };
async function cargarBibExtra(k, archivo) {
  if (D[k] || cargarBibExtra[k]) return;
  cargarBibExtra[k] = true;
  try { D[k] = await json(archivo); } catch (e) { D[k] = { error: true, libros: [], publicaciones: [], idiomas: [], tipos: [], temas: [], materias: {} }; }
  if (V.tab === 'biblioteca') render();
}
function ponerBib(s) { V.bib = s; history.replaceState(null, '', '#' + hashActual()); render(); }
function vBiblioteca() {
  const solapas = `<div class="eligen u-margin-bottom-12px" role="group" aria-label="Biblioteca" >${SOLAPAS_BIB.map(([k, t]) => `<button class="btn ${V.bib === k ? '' : 'lin'} ch" aria-pressed="${V.bib === k}" data-f="bib-${k}" onclick="ponerBib(${arg(k)})">${t}</button>`).join('')}</div>`;
  if (V.bib === 'per') return solapas + vPeriodicas();
  return solapas + vLibros();
}
// Un solo catálogo con la misma forma para los tres orígenes. La clave k es única (r:, f:, p:) y es la que usa la ficha.
function catalogoLibros() {
  const n = D.biblioteca.libros.length + D.sobre.libros.length + D.prog.libros.length;
  if (catalogoLibros.c && catalogoLibros.c.n === n) return catalogoLibros.c.L;
  const L = [], co = D.prog.coinciden || {};
  D.biblioteca.libros.forEach(l => L.push({ ...l, k: 'r:' + l.id, origen: 'rec', materias: co['r:' + l.id] || [] }));
  D.sobre.libros.forEach(l => L.push({ k: 'f:' + l.id, id: l.id, origen: 'fce', t: l.titulo, autor: l.autor, editorial: l.editorial, anio: l.anio, paginas: l.paginas, isbn: l.isbn, tema: TEMA_FCE[l.tema] || 'La industria del libro', url: l.url, materias: co['f:' + l.id] || [], sinTapa: true }));
  D.prog.libros.forEach(l => L.push({ k: 'p:' + l.id, id: l.id, origen: 'prog', t: l.titulo, autor: l.autor || 'Autoría sin datos', editorial: l.editorial, anio: l.anio, tema: l.tema, materias: l.materias || [], sinTapa: true }));
  catalogoLibros.c = { n, L };
  return L;
}
function librosFiltrados() {
  const f = V.bl, q = sinTildes(f.q).trim();
  return catalogoLibros().filter(l => (!f.origen || l.origen === f.origen) && (!f.tema || l.tema === f.tema) && (!f.mat || (l.materias || []).some(m => m.c === f.mat))
    && (!q || sinTildes([l.t, l.autor, l.editorial || ''].join(' ')).indexOf(q) >= 0));
}
function estanteLibros() {
  const L = librosFiltrados(), tope = V.bl.n || 48;
  if (!L.length) return '<p class="vacio">No hay libros con ese filtro.</p>';
  const mas = L.length > tope ? `<p class="u-margin-12px-0"><button class="btn sec" type="button" onclick="V.bl.n=${tope + 96};$('#bl-lista').innerHTML=estanteLibros()">Mostrar más (${L.length - tope} restantes)</button></p>` : '';
  return `<p class="u-mb8 chico tenue" aria-live="polite">${L.length} libro${L.length === 1 ? '' : 's'}</p><div class="estante">
    <button class="libro sumar" onclick="sugerirLibro()"><span class="tapa"><span>¿Falta algún libro para recomendar?<b>Avisame.</b></span></span></button>
    ${L.slice(0, tope).map(l => `<button class="libro" onclick="abrirLibro(${arg(l.k)})" aria-label="${esc(l.t)}, de ${esc(l.autor)}: ver ficha">${tapa(l)}
      <span class="libro-t">${esc(l.t)}</span><span class="libro-a">${esc(l.autor)}</span></button>`).join('')}</div>${mas}`;
}
function vLibros() {
  if (!D.biblioteca) { cargarBiblioteca(); return '<p class="cargando">Cargando la biblioteca…</p>'; }
  if (!D.sobre) { cargarBibExtra('sobre', 'libros-sobre-libros.json'); return '<p class="cargando">Cargando…</p>'; }
  if (!D.prog) { cargarBibExtra('prog', 'libros-programas.json'); return '<p class="cargando">Cargando…</p>'; }
  const B = D.biblioteca, f = V.bl;
  if (!B.libros.length) return '<p class="vacio">No se pudo cargar la biblioteca. <button class="btn sec" type="button" onclick="location.reload()">Probar de nuevo</button></p>';
  const todos = catalogoLibros(), temas = [...new Set(todos.map(l => l.tema))].sort((a, b) => a.localeCompare(b, 'es'));
  const mats = D.prog.materias || {}, cuenta = o => todos.filter(l => l.origen === o).length;
  const chip = (k, t, v, n) => `<button class="btn ${f[k] === v ? '' : 'lin'} ch" aria-pressed="${f[k] === v}" data-f="bl-${k}-${esc(v)}" onclick="V.bl.${k}=${arg(v)};V.bl.n=0;render()">${esc(t)}${n === undefined ? '' : ' (' + n + ')'}</button>`;
  return `<p class="u-mt0 chico tenue">${esc(B.nota)} Sumamos la colección «Libros sobre Libros» del Fondo de Cultura Económica y los libros de la bibliografía de los programas de la carrera, con las materias que los piden. Tocá una tapa para ver la ficha.</p>
    <div class="u-mb10 eligen" role="group" aria-label="Origen del libro">${chip('origen', 'Todos', '', todos.length)}${Object.keys(ORIGEN_LIBRO).map(o => chip('origen', ORIGEN_LIBRO[o], o, cuenta(o))).join('')}</div>
    <div class="dir-filtros u-margin-bottom-12px">
      <label class="solo-lector" for="bl-q">Buscar por título, autor o editorial</label>
      <input id="bl-q" type="search" autocomplete="off" placeholder="Buscar por título, autor o editorial" value="${esc(f.q)}" oninput="V.bl.q=this.value;V.bl.n=0;$('#bl-lista').innerHTML=estanteLibros()">
      <label class="solo-lector" for="bl-tema">Tema</label>
      <select id="bl-tema" onchange="V.bl.tema=this.value;V.bl.n=0;render()"><option value="">Todos los temas</option>${temas.map(t => `<option ${f.tema === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>
      <label class="solo-lector" for="bl-mat">Materia</label>
      <select id="bl-mat" onchange="V.bl.mat=this.value;V.bl.n=0;render()"><option value="">Todas las materias</option>${Object.keys(mats).sort().map(c => `<option value="${esc(c)}" ${f.mat === c ? 'selected' : ''}>${esc(c + ' · ' + mats[c])}</option>`).join('')}</select></div>
    <div id="bl-lista">${estanteLibros()}</div>
    <p class="chico tenue">Libros sobre Libros: datos bibliográficos de <a href="https://fce.com.ar/colecciones/libros-sobre-libros/" target="_blank" rel="noopener">Fondo de Cultura Económica Argentina</a>. Bibliografía de la carrera: tomada de los programas de cada materia; los datos de edición son los que figuran en el programa y puede haber ediciones más nuevas.</p>`;
}
const fechaCorta = f => f ? f.split('-').reverse().join('/') : '';
function vPeriodicas() {
  if (!D.per) { cargarBibExtra('per', 'periodicas.json'); return '<p class="cargando">Cargando…</p>'; }
  const P = D.per;
  if (!P.publicaciones.length) return '<p class="vacio">No se pudo cargar esta lista. <button class="btn sec" type="button" onclick="location.reload()">Probar de nuevo</button></p>';
  const cuenta = id => P.publicaciones.filter(p => p.idioma === id).length;
  const delIdioma = P.publicaciones.filter(p => p.idioma === V.perIdi);
  const L = delIdioma.filter(p => !V.perTipo || p.tipo === V.perTipo), tipos = P.tipos.filter(t => delIdioma.some(p => p.tipo === t.id));
  const nomTipo = id => (P.tipos.find(t => t.id === id) || {}).t || '';
  return `<p class="u-mt0 chico tenue">${esc(P.nota)}</p>
    <div class="u-mb10 eligen" role="group" aria-label="Idioma de la publicación">${P.idiomas.map(i => `<button class="btn ${V.perIdi === i.id ? '' : 'lin'} ch" aria-pressed="${V.perIdi === i.id}" data-f="peri-${i.id}" onclick="V.perIdi=${arg(i.id)};V.perTipo='';history.replaceState(null,'','#'+hashActual());render()">${esc(i.t)} (${cuenta(i.id)})</button>`).join('')}</div>
    ${tipos.length > 1 ? `<div class="eligen u-margin-bottom-12px" role="group" aria-label="Tipo de publicación" ><button class="btn ${V.perTipo ? 'lin' : ''} ch" aria-pressed="${!V.perTipo}" onclick="V.perTipo='';render()">Todas</button>${tipos.map(t => `<button class="btn ${V.perTipo === t.id ? '' : 'lin'} ch" aria-pressed="${V.perTipo === t.id}" onclick="V.perTipo=${arg(t.id)};render()">${esc(t.t)}</button>`).join('')}</div>` : ''}
    <p class="u-mb8 chico tenue" aria-live="polite">${L.length} publicacion${L.length === 1 ? '' : 'es'}</p>
    <div class="dir-grilla"><button class="dir-sumar" type="button" onclick="sugerirPeriodica()"><span>¿Falta alguna?<b>Sugerila.</b></span></button>${L.map(p => `<article class="tarjeta dir"><div class="fila"><h3 class="crece">${esc(p.t)}</h3><span class="chip tin">${esc(p.pais)}</span></div>
      <p class="chico tenue u-margin-2px-0-6px">${esc(nomTipo(p.tipo))} · ${esc(p.editor)}${p.aa ? ' · acceso abierto' : ''}</p>
      <p class="u-mb8">${esc(p.d)}</p>
      <p class="u-m0 chico"><a href="${urlSegura(p.url)}" target="_blank" rel="noopener">Sitio oficial ↗</a></p></article>`).join('')}</div>
    <p class="chico tenue">Revisadas el ${esc(fechaCorta(P.actualizado))}.</p>`;
}
function sugerirPeriodica() {
  idea({ titulo: '📰 Sugerir una publicación periódica', intro: 'Contame el nombre, el idioma y el sitio oficial de la revista o el medio del sector que sumarías.',
    ejemplo: 'Ej.: «Tal revista», en portugués, https://…', prefijo: '[Periódicas] ' });
}
function abrirLibro(k) {
  const l = catalogoLibros().find(x => x.k === k);
  if (!l) return;
  const dato = (t, v) => v ? `<dt>${t}</dt><dd>${esc(v)}</dd>` : '';
  const mats = (l.materias || []).map(m => `<li>${esc(m.c)} · ${esc((D.prog.materias || {})[m.c] || '')} <span class="chico tenue">(${m.n === 'obl' ? 'obligatoria' : 'complementaria'})</span></li>`).join('');
  abrir(cab(esc(l.t)) + `<div class="ficha-libro">${tapa(l, true)}<div class="crece">
      ${l.subtitulo ? `<p class="u-margin-0-0-6px_font-style-italic">${esc(l.subtitulo)}</p>` : ''}
      <p class="u-mb8"><b>${esc(l.autor)}</b></p><span class="chip tin">${esc(l.tema)}</span> <span class="chip">${esc(ORIGEN_LIBRO[l.origen])}</span>
      <dl class="datos-libro">${dato('Editorial', l.editorial)}${dato('Año de la edición', l.anio)}${dato('Páginas', l.paginas)}${dato('ISBN', l.isbn)}</dl></div></div>
    ${l.sinopsis ? `<p>${esc(l.sinopsis)}</p>` : ''}
    ${mats ? `<p class="u-margin-10px-0-4px"><b>Lo piden en la carrera:</b></p><ul class="chico">${mats}</ul>` : ''}
    ${l.link ? `<p><a href="${urlSegura(l.link.url)}" target="_blank" rel="noopener">${esc(l.link.t)} ↗</a></p>` : ''}
    ${l.url ? `<p><a href="${urlSegura(l.url)}" target="_blank" rel="noopener">Ficha del editor ↗</a></p>` : ''}
    <div class="botones"><button class="btn" onclick="cerrar()">Listo</button></div>`, 'l:' + k);
}
function sugerirLibro() {
  idea({ titulo: '📚 Recomendar un libro', intro: '¿Qué libro sumarías a la biblioteca? Contame el título, quién lo escribió y por qué sirve para editar.',
    ejemplo: 'Ej.: «Manual de edición», de tal autora: lo usé para…', prefijo: '[Biblioteca] ' });
}

// =====================================================================
// ESCANDALLO: simulador (las cuentas están en escandallo.js)
// =====================================================================
// =====================================================================
// FORMATOS DE PAPEL (FPI): serie A, pliegos y libros a escala; las medidas están en formatos.js. Estado solo de la sesión (V.fmt).
// =====================================================================
const fmtS = () => (V.fmt = V.fmt || { g: { a: true, p: false, l: false }, sel: 'a4', base: 'a3', pasos: 1 });
const fmtGrupoDe = f => (f.grupo === 'c' ? 'p' : f.grupo);
const fmtVisibles = () => { const s = fmtS(); return Formatos.TODOS.filter(f => s.g[fmtGrupoDe(f)]); };
const fmtN = (v, d) => n2(v, d == null ? 1 : d);
const fmtDv = d => { const r = Math.round(d * 10) / 10; return (r > 0 ? '+' : '') + fmtN(r === 0 ? 0 : r, 1) + ' %'; };
const fmtMed = f => `${fmtN(f.ancho)} × ${fmtN(f.alto)} mm`;
const fmtCm = f => `${fmtN(f.ancho / 10)} × ${fmtN(f.alto / 10)} cm`;
const fmtNombre = f => ({ a: '', p: 'Pliego ', c: 'Cartulina ', l: 'Libro ' }[f.grupo] || '') + f.t;
function fmtGrupo(id, on) { const s = fmtS(); s.g[id] = on; if (!fmtVisibles().length) s.g.a = true; if (!fmtVisibles().some(f => f.id === s.sel)) s.sel = fmtVisibles()[0].id; render(); }
function fmtSel(id) { fmtS().sel = id; render(); }
function fmtSelA(id) { const s = fmtS(); s.g.a = true; s.sel = id; render(); }
function fmtBase(id) { const s = fmtS(); s.base = id; s.pasos = 1; render(); }
function fmtPaso(d) { const s = fmtS(); s.pasos = Math.max(0, Math.min(4, s.pasos + d)); render(); }
// La serie A como mosaico: cada hoja es la mitad de la anterior y todas juntas llenan (casi) dos A0.
function mosaicoA(sel) {
  const m = Formatos.mosaico(), tam = m.alto / 30;
  const t = m.tiles.map(k => {
    const f = Formatos.SERIE_A[k.n], menor = Math.min(k.w, k.h), on = sel.id === k.id;
    const nombre = menor > m.alto / 24 ? `<text class="fmt-t ga ${on ? 'sel' : ''}" x="${k.x + k.w / 2}" y="${k.y + k.h / 2 + (menor > m.alto / 9 ? 0 : tam * 0.3)}" text-anchor="middle" font-size="${Math.min(tam * (k.n === 0 ? 3.2 : 2.4), menor / 3)}" font-weight="700">A${k.n}</text>` : '';
    const dims = menor > m.alto / 9 ? `<text class="fmt-t" x="${k.x + k.w / 2}" y="${k.y + k.h / 2 + Math.min(tam * 1.9, menor / 4)}" text-anchor="middle" font-size="${Math.min(tam * 0.95, menor / 7)}">${f.ancho} × ${f.alto}</text>` : '';
    return `<rect class="fmt-r ga ${on ? 'sel' : ''}" x="${k.x}" y="${k.y}" width="${k.w}" height="${k.h}" onclick="fmtSelA(${arg(k.id)})"><title>A${k.n}: ${f.ancho} × ${f.alto} mm</title></rect>${nombre}${dims}`;
  }).join('');
  const r = m.resto;
  const resto = `<rect class="fmt-resto" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}"><title>Lo que queda (otro A10)</title></rect>`;
  return `<p class="u-mt0 chico tenue">Dos A0 apaisados (1 m² cada uno). A0 ocupa una mitad y la otra se corta por el lado largo en A1 + el resto, y el resto en A2 + el resto, y así hasta A10: cada hoja es la mitad de la anterior. Tocá una hoja para ver su ficha.</p>
    <div class="fmt-dscroll"><svg class="fmt fmt-mos u-max-width-760px" viewBox="-6 -6 ${m.ancho + 12} ${m.alto + 12}" role="group" aria-label="Serie A de A0 a A10 como mosaico: cada hoja es la mitad de la anterior" >${t}${resto}</svg></div>
    <p class="chico tenue u-margin-bottom-0">A0 (1 m²) + A1 (½ m²) + A2 (¼ m²) + … se acercan a 2 m². Medidas en mm, las oficiales de la norma.</p>`;
}
function vFormatos() {
  const s = fmtS(), F = Formatos, vis = fmtVisibles(), sel = F.porId(s.sel) || vis[0];
  const grupo = (id, t) => `<label class="elige ${s.g[id] ? 'on' : ''}"><input type="checkbox" ${s.g[id] ? 'checked' : ''} onchange="fmtGrupo(${arg(id)},this.checked)"><span>${t}</span></label>`;
  // --- Diagrama: todos los formatos pegados en la misma esquina, a la misma escala ---
  const W = Math.max(...vis.map(f => f.ancho)), H = Math.max(...vis.map(f => f.alto)), pad = H * 0.03, fs = H / 36;
  const orden = [...vis].sort((a, b) => b.ancho * b.alto - a.ancho * a.alto);
  let ultimoY = -1e9;
  const rects = orden.map(f => `<rect class="fmt-r g${f.grupo} ${f.id === sel.id ? 'sel' : ''}" x="0" y="0" width="${f.ancho}" height="${f.alto}" onclick="fmtSel(${arg(f.id)})"><title>${esc(fmtNombre(f))}: ${esc(fmtMed(f))}</title></rect>`).join('');
  const etiquetas = [...vis].sort((a, b) => b.alto - a.alto).map(f => {
    const y = f.alto - fs * 0.35, dentro = f.ancho > fs * 2.2, elegida = f.id === sel.id;
    if (!elegida && (ultimoY - y < fs * 1.15 || !dentro)) return '';
    if (!elegida) ultimoY = y;
    return `<text class="fmt-t g${f.grupo} ${elegida ? 'sel' : ''}" x="${fs * 0.4}" y="${y}" font-size="${fs}">${esc(f.t)}</text>`;
  }).join('');
  const svg = `<svg class="fmt" viewBox="${-pad} ${-pad} ${W + pad * 2} ${H + pad * 2}" role="group" aria-label="Formatos de papel a escala, apoyados en la misma esquina. Los mismos formatos están en la lista de abajo." style="max-width:${Math.max(180, Math.round(520 * (W + pad * 2) / (H + pad * 2)))}px">${rects}${etiquetas}</svg>`;
  const chips = F.GRUPOS.filter(g => vis.some(f => f.grupo === g.id)).map(g => `<div class="fmt-grupo"><span class="chico tenue">${esc(g.t)}</span><div class="fila">${vis.filter(f => f.grupo === g.id).map(f =>
    `<button class="btn ch ${f.id === sel.id ? '' : 'sec'}" aria-pressed="${f.id === sel.id}" onclick="fmtSel(${arg(f.id)})">${esc(f.t)}</button>`).join('')}</div></div>`).join('');
  // --- Ficha del formato elegido ---
  const r = F.relacion(sel), dv = F.desvio(sel);
  const filas = [['Medida', `${fmtMed(sel)} (${fmtCm(sel)})`], ['Lado largo ÷ lado corto', `${fmtN(r, 3)}`], ['Respecto de √2 (1,414)', `${fmtDv(dv)}`], ['Superficie', `${fmtN(F.area(sel), sel.ancho * sel.alto >= 1e5 ? 3 : 4)} m²`]];
  if (sel.grupo === 'a') {
    if (sel.n < 10) { const m = F.SERIE_A[sel.n + 1]; filas.push(['Doblado a la mitad', `${m.t} (${fmtMed(m)})`]); }
    if (sel.n > 0) filas.push(['Entran en un A0', `${n2(F.entran(0, sel.n), 0)}`]);
  }
  const ficha = `<div class="tarjeta"><h3>${esc(fmtNombre(sel))}</h3><dl class="fmt-ficha">${filas.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
      ${sel.uso ? `<p class="u-mt8 chico">${esc(sel.uso)}</p>` : ''}</div>`;
  // --- Tabla de relaciones de aspecto, con la marca de √2 ---
  const tmin = 1, tmax = 1.8, pos = v => ((v - tmin) / (tmax - tmin) * 100).toFixed(1);
  const tabla = `<div class="fmt-tabla" role="table" aria-label="Relación de aspecto de cada formato"><div class="fmt-th" role="row"><span role="columnheader">Formato</span><span role="columnheader" class="num">Largo ÷ corto</span><span role="columnheader" class="num">Desvío</span><span role="columnheader">1,0 · √2 · 1,8</span></div>` +
    vis.map(f => { const rr = F.relacion(f), d = F.desvio(f), ok = Math.abs(d) < 0.5; return `<button class="fmt-fila ${f.id === sel.id ? 'sel' : ''}" role="row" onclick="fmtSel(${arg(f.id)})"><span role="cell">${esc(fmtNombre(f))}</span><span role="cell" class="num">${fmtN(rr, 3)}</span><span role="cell" class="num ${ok ? 'ok' : ''}">${fmtDv(d)}</span>
      <span role="cell" class="fmt-pista" aria-hidden="true"><i class="fmt-raiz" style="left:${pos(F.RAIZ2)}%"></i><i class="fmt-pto g${f.grupo} ${ok ? 'ok' : ''}" style="left:${pos(Math.min(tmax, rr))}%"></i></span></button>`; }).join('') + '</div>';
  // --- Demostración: doblar a la mitad ---
  const base = F.BASES.find(b => b.id === s.base) || F.BASES[0], cad = F.cadena(base, s.pasos), serie = base.id === 'a3';
  const rel = c => Math.max(c.ancho, c.alto) / Math.min(c.ancho, c.alto);
  const gap = cad[0].ancho * 0.12, total = cad.reduce((t, c) => t + c.ancho + gap, -gap), dh = cad[0].alto, dfs = dh / 14;
  let x = 0;
  const piezas = cad.map((c, i) => {
    const rr = rel(c), ok = Math.abs(rr / F.RAIZ2 - 1) < 0.005, ult = i === cad.length - 1, x0 = x;
    x += c.ancho + gap;
    return `<rect class="fmt-r gd ${ok ? 'ok' : 'mal'}" x="${x0}" y="0" width="${c.ancho}" height="${c.alto}"/>` +
      (ult && s.pasos < 4 ? `<line class="fmt-pliegue" x1="${x0}" y1="${c.alto / 2}" x2="${x0 + c.ancho}" y2="${c.alto / 2}"/>` : '') +
      `<text class="fmt-t ${ok ? 'ok' : 'mal'}" x="${x0 + c.ancho / 2}" y="${c.alto + dfs * 1.5}" font-size="${dfs}" text-anchor="middle">${fmtN(rr, 3)}</text>` +
      `<text class="fmt-t" x="${x0 + c.ancho / 2}" y="${c.alto + dfs * 2.9}" font-size="${dfs * 0.8}" text-anchor="middle">${fmtN(c.ancho)} × ${fmtN(c.alto)}</text>`;
  }).join('');
  const demo = `<svg class="fmt fmt-demo" viewBox="${-dh * 0.03} ${-dh * 0.04} ${total + dh * 0.06} ${dh + dfs * 3.6}" role="img" aria-label="Un ${esc(base.t)} doblado a la mitad ${s.pasos} ${s.pasos === 1 ? 'vez' : 'veces'}, con la relación de aspecto de cada mitad" style="max-width:${Math.max(160, Math.round(460 * (total + dh * 0.06) / (dh + dfs * 3.6)))}px">${piezas}</svg>`;
  const bases = F.BASES.map(b => `<button class="btn ch ${b.id === base.id ? '' : 'sec'}" aria-pressed="${b.id === base.id}" onclick="fmtBase(${arg(b.id)})">${esc(b.t)}</button>`).join('');
  const rels = cad.map(rel);
  const veredicto = serie ? 'Cada mitad es una réplica a escala del papel que se dobló: el largo ÷ corto no cambia.' : `Cada doblez cambia la forma: la relación salta entre ${fmtN(Math.min(...rels), 3)} y ${fmtN(Math.max(...rels), 3)}, así que las mitades no son semejantes al original.`;
  return `<p class="u-mt0 chico tenue">Los formatos de papel que aparecen en Fundamentos de la Producción de Impresos, dibujados a la misma escala y apoyados en una esquina: la serie A normalizada (IRAM/ISO), los pliegos de compra y los formatos de libro de la cátedra. Tocá uno para ver su medida y su relación de aspecto.</p>
    <div class="u-mb10 eligen">${grupo('a', '📐 Serie A')}${grupo('p', '📄 Pliegos')}${grupo('l', '📖 Libros')}</div>
    <div class="fmt-cols"><div class="tarjeta fmt-dib">${svg}</div><div>${ficha}</div></div>
    <div class="fmt-chips">${chips}</div>
    <div class="titulo-sec"><h2>La serie A, hoja por hoja</h2></div>
    <div class="tarjeta">${mosaicoA(sel)}</div>
    <div class="titulo-sec"><h2>¿Por qué la serie A mantiene su forma?</h2></div>
    <div class="tarjeta"><p class="u-mt0">En la serie A normalizada (IRAM/ISO; la norma internacional es la ISO 216) el lado largo es √2 ≈ 1,414 veces el corto. Con esa proporción, <b>al doblar una hoja a la mitad por el lado largo queda otra hoja de la misma forma</b>: A3 → A4 → A5… Por eso A0 (1 m²) se bipartiza sucesivamente y todos los formatos son semejantes entre sí, y un original en A4 se puede ampliar o reducir a A3 o A5 sin recortar ni dejar márgenes de sobra.</p>
      <p>La cuenta: si el largo ÷ corto es <i>x</i>, al doblar queda un rectángulo cuyo lado largo es el corto de antes y cuyo lado corto es la mitad del largo: su relación es 2 ÷ <i>x</i>. Para que sea igual que <i>x</i> hace falta que <i>x</i> = 2 ÷ <i>x</i>, es decir <i>x</i>² = 2 y <i>x</i> = √2.</p>
      <p class="chico tenue u-margin-bottom-0">Las medidas oficiales se redondean al milímetro hacia abajo (A5 mide 148 × 210 y no 148,5 × 210), así que la relación de cada formato es 1,414 solo aproximadamente.</p></div>
    <div class="tarjeta"><h3>Probalo: doblá a la mitad</h3>
      <div class="fila u-margin-bottom-8px"><span class="chico tenue">Partí de</span>${bases}</div>
      <div class="fmt-dscroll">${demo}</div>
      <div class="fila u-margin-8px-0"><button class="btn sec ch" onclick="fmtPaso(-1)" ${s.pasos <= 0 ? 'disabled' : ''}>− Desdoblar</button><button class="btn ch" onclick="fmtPaso(1)" ${s.pasos >= 4 ? 'disabled' : ''}>Doblar a la mitad</button><span class="chico tenue">Dobleces: ${s.pasos}. Debajo de cada hoja: largo ÷ corto y medidas en mm.</span></div>
      <p class="u-m0 chico">${veredicto}</p></div>
    <div class="titulo-sec"><h2>Relación de aspecto de cada formato</h2></div>
    <p class="u-mt0 chico tenue">Largo ÷ corto de cada formato y cuánto se aparta de √2. Los de la serie A dan 1,414; los libros y los pliegos de compra no siguen esa proporción, y por eso al bipartirlos cambia la forma.</p>
    ${tabla}`;
}

// =====================================================================
// LEYES (DEA): jerarquía de normas y traductor jurídico. Datos en leyes.js (borrador a revisar). Estado solo de la sesión (V.ley).
// =====================================================================
const leyS = () => (V.ley = V.ley || { vista: 'piramide', sel: 'l11723', q: '' });
function leyVista(v) { leyS().vista = v; render(); }
function leySel(id) { const s = leyS(); s.sel = id; s.vista = 'piramide'; render(); }
function leyTerminos() {
  const L = Leyes.buscar(leyS().q);
  if (!L.length) return '<p class="vacio">No hay términos con ese filtro.</p>';
  return `<p class="u-mb8 chico tenue">${L.length} término${L.length === 1 ? '' : 's'}</p>` + L.map(x => { const n = Leyes.normaPorId(x.norma);
    return `<article class="tarjeta glo"><h3 class="u-mb4">${esc(x.t)}</h3><p class="glo-def">${esc(x.simple)}</p>
      <p class="chico u-margin-4px-0-0"><b>En una editorial:</b> ${esc(x.ej)}</p>
      ${n ? `<p class="u-mt6 chico tenue">Aparece en: <button class="enlace" type="button" onclick="leySel(${arg(n.id)})">${esc(n.t)}</button></p>` : ''}</article>`; }).join('');
}
function vLeyes() {
  const s = leyS(), L = Leyes, sel = L.normaPorId(s.sel) || L.NORMAS[0];
  const pestana = (k, t) => `<button class="btn ch ${s.vista === k ? '' : 'lin'}" aria-pressed="${s.vista === k}" onclick="leyVista(${arg(k)})">${t}</button>`;
  const aviso = `<p class="chico tenue u-margin-0-0-10px">⚠️ Borrador: lo estoy revisando con mi cátedra. Son fichas y definiciones propias, no el texto de la ley, y <b>no son asesoramiento legal</b>: para un caso real, consultá el texto oficial y a un profesional.</p>`;
  const cab = `${aviso}<div class="u-mb10 eligen" role="group" aria-label="Qué ver">${pestana('piramide', '🔺 Jerarquía de normas')}${pestana('terminos', '🗣️ Traductor jurídico')}</div>`;
  if (s.vista === 'terminos') return cab + `<p class="u-mt0 chico tenue">Palabras del derecho editorial dichas en castellano común, con un ejemplo de editorial. Buscá un término o parte de lo que dice.</p>
    <label class="solo-lector" for="ley-q">Buscar un término</label>
    <input id="ley-q" type="search" autocomplete="off" placeholder="Buscar un término, por ejemplo «derecho moral»" value="${esc(s.q)}" class="u-width-100_margin-bottom-12px" oninput="V.ley.q=this.value;$('#ley-lista').innerHTML=leyTerminos()">
    <div id="ley-lista">${leyTerminos()}</div>`;
  const bandas = L.NIVELES.map(nv => { const ancho = 46 + (nv.n - 1) * 13.5;
    return `<div class="ley-banda n${nv.n}" style="width:${ancho}%"><b class="ley-bt">${esc(nv.t)}</b>
      <div class="fila ley-chips">${L.NORMAS.filter(n => n.nivel === nv.n).map(n => `<button class="btn ch ${n.id === sel.id ? '' : 'sec'}" aria-pressed="${n.id === sel.id}" onclick="leySel(${arg(n.id)})">${esc(n.t.split(' · ')[0])}</button>`).join('')}</div></div>`; }).join('');
  const nv = L.nivel(sel.nivel), dep = L.normaPorId(sel.depende), deps = L.dependientes(sel.id);
  const lista = (arr, vacio) => arr.length ? arr.map(n => `<button class="enlace" type="button" onclick="leySel(${arg(n.id)})">${esc(n.t.split(' · ')[0])}</button>`).join(', ') : vacio;
  const filas = [['Qué regula', sel.regula], ['A quién le sirve', sel.sirve], ['Año', sel.anio]];
  if (sel.arts) filas.push(['Artículos clave', sel.arts]);
  const ficha = `<div class="tarjeta"><span class="chip tin">${esc(nv.t)}</span><h3 class="u-margin-6px-0-4px">${esc(sel.t)}</h3>
    <dl class="fmt-ficha">${filas.map(([k, v]) => `<dt>${esc(k)}</dt><dd class="u-font-weight-400">${esc(v)}</dd>`).join('')}</dl>
    <p class="chico u-margin-10px-0-0"><b>Tiene que respetar a:</b> ${lista(L.debeRespetar(sel.id), 'nadie: está en la cima.')}</p>
    ${dep ? `<p class="chico u-margin-4px-0-0"><b>Se apoya en:</b> ${lista([dep], '')}</p>` : ''}
    ${deps.length ? `<p class="chico u-margin-4px-0-0"><b>Se apoyan en ella:</b> ${lista(deps, '')}</p>` : ''}
    <p class="chico u-margin-4px-0-0"><b>Está por encima de:</b> ${lista(L.queMandaSobre(sel.id), 'ninguna: es la más específica.')}</p>
    ${sel.nota ? `<p class="u-mt6 chico tenue">${esc(sel.nota)}</p>` : ''}
    <p class="acciones u-margin-10px-0-0"><a class="btn sec" href="${urlSegura(L.link(sel))}" target="_blank" rel="noopener">Leer la norma oficial en InfoLEG ↗</a></p></div>`;
  return cab + `<p class="u-mt0 chico tenue">Las normas que se ven en Derechos Editoriales y del Autor, ordenadas por jerarquía: una norma de abajo no puede contradecir a las de arriba. Tocá una para ver su ficha.</p>
    <div class="ley-cols"><div class="tarjeta ley-pir" role="group" aria-label="Pirámide de normas, de la Constitución arriba a las disposiciones abajo">${bandas}</div><div>${ficha}</div></div>
    <p class="chico tenue u-margin-top-12px">Hay normas que todavía no figuran porque no confirmé su link oficial (el Acuerdo ADPIC, la Ley 22.195, entre otras). Si te falta alguna, avisame con «Contame qué falta».</p>`;
}

// =====================================================================
// CONTRATOS modelo (traducción y edición). Datos y textos en contratos.js (borrador a revisar). Estado solo de la sesión (V.con).
// =====================================================================
const conS = () => { if (!V.con) V.con = { modelo: 'traduccion', v: { traduccion: Contratos.defaults('traduccion'), edicion: Contratos.defaults('edicion') } }; return V.con; };
function conModelo(id) { conS().modelo = id; render(); }
function conSet(k, val, num) { const s = conS(); s.v[s.modelo][k] = num ? (val === '' ? '' : Number(val)) : val; $('#con-prev').innerHTML = conPrev(); }
function conPrev() {
  const s = conS(), r = Contratos.generar(s.modelo, s.v[s.modelo]);
  const marca = t => esc(t).replace(/\[completar: [^\]]*\]/g, m => `<mark>${m}</mark>`);
  return (r.avisos.length ? `<div class="u-mb10 tarjeta" role="status">${r.avisos.map(a => `<p class="u-mb4 chico">⚠️ ${esc(a)}</p>`).join('')}</div>` : '')
    + `<p class="u-mb8 chico tenue">${r.falta.length ? `Faltan ${r.falta.length} dato${r.falta.length === 1 ? '' : 's'}: ${esc(r.falta.join(', '))}.` : 'No falta ningún dato.'}</p>`
    + r.clausulas.map(c => `<article class="tarjeta u-margin-bottom-8px"><h3 class="u-mb4">${c.n}. ${esc(c.t)}</h3><p class="u-m0">${marca(c.texto)}</p><p class="u-mt6 chico tenue">Fuente: ${esc(c.fuente)}</p></article>`).join('');
}
function conCampo(c, v) {
  const id = 'con-' + c.id, ayuda = c.ayuda ? `<span class="chico tenue u-display-block">${esc(c.ayuda)}</span>` : '';
  if (c.tipo === 'check') return `<label class="fila u-gap-8px_margin-4px-0"><input type="checkbox" ${v[c.id] ? 'checked' : ''} onchange="conSet(${arg(c.id)}, this.checked)"> <span>${esc(c.etq)}</span></label>`;
  if (c.tipo === 'opcion') return `<div class="u-margin-8px-0"><label for="${id}">${esc(c.etq)}</label><select id="${id}" onchange="conSet(${arg(c.id)}, this.value)">${c.opciones.map(([k, t]) => `<option value="${esc(k)}" ${v[c.id] === k ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></div>`;
  const n = c.tipo === 'num';
  return `<div class="u-margin-8px-0"><label for="${id}">${esc(c.etq)}</label>${ayuda}<input id="${id}" ${n ? 'type="number" min="0" step="any" inputmode="decimal"' : 'type="text"'} autocomplete="off" value="${esc(v[c.id])}" class="u-w100" oninput="conSet(${arg(c.id)}, this.value, ${n})"></div>`;
}
function conDescargar() { const s = conS(); descargar(`contrato-${s.modelo}.md`, Contratos.documento(s.modelo, s.v[s.modelo]), 'text/markdown;charset=utf-8'); }
function conCopiar() { const s = conS(), t = Contratos.documento(s.modelo, s.v[s.modelo]); if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(() => aviso('Contrato copiado'), () => aviso('No se pudo copiar. Descargalo en su lugar.')); else aviso('No se pudo copiar. Descargalo en su lugar.'); }
function vContratos() {
  const s = conS(), M = Contratos.MODELOS, m = M[s.modelo], v = s.v[s.modelo];
  const pestana = k => `<button class="btn ch ${s.modelo === k ? '' : 'lin'}" aria-pressed="${s.modelo === k}" onclick="conModelo(${arg(k)})">${esc(M[k].corto)}</button>`;
  let grupo = '';
  const campos = m.campos.map(c => { const h = c.grupo && c.grupo !== grupo ? `<p class="chico u-margin-10px-0-0"><b>${esc(c.grupo)}</b></p>` : ''; grupo = c.grupo || ''; return h + conCampo(c, v); }).join('');
  return `<p class="chico tenue u-margin-0-0-10px">⚠️ Borrador: lo revisa una docente antes de darlo por bueno. Es un <b>modelo orientativo, no asesoramiento legal</b>: antes de firmar, que lo revise un abogado. No se guarda ni se envía nada: lo que escribís queda en esta pantalla.</p>
    <div class="u-mb10 eligen" role="group" aria-label="Tipo de contrato">${pestana('traduccion')}${pestana('edicion')}</div>
    <p class="u-mt0 chico">${esc(m.d)}</p>
    <div class="ley-cols"><div class="tarjeta"><h3 class="u-mb4">Datos</h3>${campos}</div>
      <div><div class="acciones u-margin-0-0-10px"><button class="btn" onclick="conDescargar()">Descargar (.md)</button><button class="btn sec" onclick="conCopiar()">Copiar el texto</button></div><div id="con-prev">${conPrev()}</div></div></div>`;
}

// =====================================================================
// TARIFARIO (perfil profesional): datos/tarifas.json. Solo quién publica, rubro, unidad, fecha y link; los montos se leen en la fuente. Filtro de la sesión (V.tar).
// =====================================================================
async function cargarTarifas() {
  if (D.tarifas || cargarTarifas.va) return;
  cargarTarifas.va = true;
  try { D.tarifas = await json('tarifas.json'); } catch (e) { D.tarifas = { fuentes: [], rubros: [], error: true }; }
  if (V.sim === 'tarifario') render();
}
function tarRubro(id) { V.tar = id; render(); }
function vTarifario() {
  if (!D.tarifas) { cargarTarifas(); return '<p class="cargando">Cargando los tarifarios…</p>'; }
  const T = D.tarifas;
  if (T.error) return '<p class="vacio">No pude cargar esto. Puede ser la conexión. <button class="btn sec" type="button" onclick="location.reload()">Probar de nuevo</button></p>';
  const sel = V.tar || '', pestana = (k, t) => `<button class="btn ch ${sel === k ? '' : 'lin'}" aria-pressed="${sel === k}" onclick="tarRubro(${arg(k)})">${esc(t)}</button>`;
  const lista = T.fuentes.filter(f => !sel || f.rubro === sel);
  const desact = f => /desactualizado/i.test(f.estado || '');
  return `<p class="chico tenue u-margin-0-0-10px">${esc(T.nota.split(" controlado:")[0])}</p>
    <div class="u-mb10 eligen" role="group" aria-label="Rubro">${pestana('', 'Todos')}${T.rubros.map(r => pestana(r.id, r.t)).join('')}</div>
    ${lista.length ? lista.map(f => `<article class="tarjeta u-margin-bottom-8px">
      <h3 class="u-mb4">${esc(f.quien)}</h3>
      <p class="u-mb6">${esc(f.que)}</p>
      <p class="u-mb4 chico"><b>Unidad:</b> ${esc(f.unidad)}</p>
      <p class="u-mb4 chico"><b>Alcance:</b> ${esc(f.alcance)}</p>
      <p class="u-mb6 chico"><span class="chip ${desact(f) ? 'ojo' : 'ok'}">${desact(f) ? 'Desactualizado' : 'Edición ' + esc(f.edicion)}</span> <span class="chip">${esc(f.pais)} · ${esc(f.moneda)}</span> <span class="chip">Se actualiza: ${esc(f.actualiza)}</span></p>
      ${desact(f) || (f.estado && f.estado !== 'vigente') ? `<p class="u-mb6 chico tenue">⚠️ ${esc(f.estado)}</p>` : ''}
      <a class="btn sec" href="${urlSegura(f.url)}" target="_blank" rel="noopener">Ver los valores en la fuente ↗</a>
      ${f.controlado ? `<span class="chico tenue u-margin-left-8px">✓ Link revisado el ${fmt(f.controlado)}</span>` : ''}
    </article>`).join('') : '<p class="vacio">No hay tarifarios publicados para este rubro.</p>'}
    ${!sel && (T.huecos || []).length ? `<div class="titulo-sec"><h2>Lo que no se encontró</h2></div><div class="tarjeta"><ul class="u-margin-0_padding-left-18px">${T.huecos.map(h => `<li class="chico">${esc(h)}</li>`).join('')}</ul></div>` : ''}
    <p class="chico tenue">Los valores son orientativos y no obligatorios. Si conocés otro tarifario público, contámelo con 💡 Contame qué falta.</p>`;
}

// Los simuladores, por materia (el orden de la pestaña sale de acá).
const SIMULADORES = [
  { id: 'ecosistema', materia: '0902', ico: '🕸️', t: 'Ecosistema del libro', d: 'Los actores del mundo editorial como nodos de un grafo: quién se relaciona con quién y para qué. Seguí el recorrido de un libro o practicá quién es quién.' },
  { id: 'paginacion', materia: '0905', ico: '📑', t: 'Esquema de paginación', d: 'Las partes del libro, tildadas una por una: cuántas páginas lleva cada una, en recto o verso, y cuántas quedan en blanco hasta el múltiplo del pliego.' },
  { id: 'tarifario', materia: '0909', ico: '💲', t: 'Tarifario de referencia', d: 'Quién publica tarifas orientativas para traducción, corrección, diseño e ilustración: unidad, fecha de edición y link a la fuente. Sin montos copiados: se leen en el original.' },
  { id: 'contratos', materia: '0919', ico: '📝', t: 'Contratos modelo: traducción y edición', d: 'Completá los datos y armá un borrador de contrato de traducción (según el modelo de la AATI) o de edición (según los arts. 37 a 44 de la Ley 11.723), con la fuente de cada cláusula. Para descargar.' },
  { id: 'leyes', materia: '0919', ico: '⚖️', t: 'Leyes: jerarquía de normas y traductor jurídico', d: 'Las normas del derecho de autor y editorial ordenadas en una pirámide (qué manda sobre qué) y un traductor de términos jurídicos a castellano común, con ejemplos de editorial.' },
  { id: 'formatos', materia: '0905', ico: '📐', t: 'Formatos de papel y serie A', d: 'Los tamaños de FPI a escala (serie A, pliegos y libros) y por qué la serie A conserva su forma al doblarse: la relación de aspecto √2.' },
  { id: 'papel', materia: '0905', ico: '📄', t: 'Cálculo de papel e imposición', d: 'Pliegos, resmas, kilos y costo de los interiores o de la tapa, con pinza, cola, calles e imposición. Compara los formatos de pliego.' },
  { id: 'escandallo', materia: '0909', ico: '🧮', t: 'Escandallo de un título', d: 'Si el precio de un libro es viable: del PVP al margen de contribución, con los puntos de equilibrio.' },
  { id: 'cronograma', materia: '0905', ico: '🗓️', t: 'Cronograma: Gantt, PERT y Roy', d: 'Planificá la producción de un libro con tres métodos sobre las mismas tareas: barras de Gantt, red PERT con probabilidad de llegar a tiempo y red de Roy con ruta crítica y holguras. Usá cada uno o compará.' },
  { id: 'comparador', materia: '0909', ico: '⚖️', t: 'Comparador de títulos', d: 'Qué hacer con cada título del catálogo: dejarlo, bajarle costos, empujarlo o discontinuarlo.' }
];
// Explicaciones mínimas de cada concepto, según la cátedra de Administración de la Empresa Editorial.
const AYUDA = {
  pvp: 'Precio de venta al público. Lo fija el editor entre un piso (que cubra los costos) y un techo (lo que el mercado está dispuesto a pagar). El escandallo arranca acá.',
  tirada: 'Cantidad de ejemplares que se imprimen. El costo producto total se divide por la tirada para obtener el CPU.',
  modo: 'Cómo sabés lo que cuesta cada ejemplar: si ya tenés el CPU, si tenés los totales de una impresión offset o si es impresión por demanda.',
  cpu: 'Costo producto unitario: lo que cuesta producir cada ejemplar. CPU = CPT ÷ tirada.',
  preproduccion: 'Costos fijos del título, que no dependen de la tirada: corrección, diseño de tapa, traducción, armado de interiores, prólogo.',
  industrial: 'Costos variables, que dependen de la cantidad de ejemplares: imprenta, encuadernación, retractilado, fajas.',
  cpt: 'Costo producto total: preproducción + industriales. Son los costos directos de producir el título.',
  demanda: 'En la impresión por demanda se presupuesta cada ejemplar: interior (en pliegos A3) + tapa + encuadernado.',
  paginas: 'Cantidad de páginas del libro. Se divide por las páginas que entran en un pliego para saber cuántos pliegos lleva el interior.',
  porPliego: 'Cuántas páginas entran en un pliego A3: 8 en formato 14 × 21 cm; 4 en 15 × 22 cm o A4.',
  precioPliego: 'Lo que cuesta imprimir un pliego A3 del interior.',
  tapasPorPliego: 'Cuántas tapas entran en un pliego A3: 2 en 14 × 21 cm; 1 si llevan solapas, o en 15 × 22 cm y A4.',
  precioTapa: 'Lo que cuesta un pliego A3 de tapa (a color, en ilustración de 350 g). El costo de cada tapa depende de cuántas entran.',
  encuadernado: 'Precio fijo por ejemplar.',
  descuento: 'Lo que se queda la librería o el distribuidor por vender el libro: un porcentaje del PVP.',
  canales: 'Si vendés por varios canales, el descuento promedio ponderado es la suma, canal por canal, de descuento × participación ÷ 100.',
  plazo: 'Días que pasan entre que el canal vende el libro y la editorial lo cobra. Se pondera igual que el descuento.',
  inu: 'Ingreso neto unitario: lo que le llega a la editorial por cada libro. INU = PVP − descuento comercial.',
  invendibles: 'Previsión por libros que no se van a vender, por obsoletos o deteriorados. Se calcula sobre el CPU.',
  derechos: 'Lo que cobra el autor por cada ejemplar vendido, por lo general entre 8 y 15 % del PVP. Las obras de dominio público no pagan.',
  incobrables: 'Previsión por libros vendidos y facturados que nunca se cobran. Se calcula sobre el INU.',
  comisiones: 'Lo que cobran los vendedores por cada venta, además del sueldo. Se calcula sobre el INU.',
  flete: 'Flete o depósito contratado para este título (si son propios, van en el costo de estructura). Se calcula sobre el INU.',
  publicidad: 'Campaña de este título en particular (la publicidad institucional va en estructura). Se calcula sobre el INU.',
  gastos: 'Gastos comerciales: costos directos que aparecen al distribuir y vender el libro. Si el libro no se vendiera, no existirían.',
  cdu: 'Costo directo unitario: CPU + gastos comerciales. Lo que cuesta, en total, cada ejemplar.',
  mcu: 'Margen de contribución unitario: lo que queda del INU después de pagar el libro. MCU = INU − CDU. Con eso se paga la estructura.',
  mcuPct: 'MCU ÷ INU: qué parte de lo que entra por cada libro queda como margen. Con menos de 25 o 30 %, por lo general no conviene publicar.',
  cdt: 'Costo directo total: CDU × tirada.',
  ce: 'Costo de estructura: sueldos, alquiler, servicios… lo que no se puede atribuir a un título. Poné la parte que tiene que cubrir este libro (por ejemplo, la de un mes).',
  cgt: 'Costo global total: CDT + CE. Todos los costos de editar el libro.',
  marginal: 'Lo que cuesta producir un ejemplar más: es igual al CDU. Sube el CDT, pero no el costo de estructura.',
  peEstructura: 'Punto de equilibrio: cuántos libros hay que vender para que el margen pague la estructura. CE ÷ MCU.',
  peEdicion: 'Cuántos libros hay que vender para recuperar lo que costó la edición. CDT ÷ INU.',
  peAbsorcion: 'Cuántos libros hay que vender para cubrir todo, edición y estructura. (CE + CDT) ÷ INU.',
  cmpMct: 'Margen de contribución total: MCU × Q. Lo que aporta el título, en pesos, para pagar la estructura y dejar ganancia. Dice si el título se vende.',
  cmpMctPct: 'MCT% = MCT ÷ INT (es igual al MCU%). Cuánto de lo que ingresa por el título queda como margen. Dice si el título es rentable.',
  cmpIng: 'Ingreso neto total (INT) de cada título = INU × Q. El ingreso neto global (ING) es la suma de todos.',
  cmpMcg: 'Margen de contribución global: la suma de los MCT de todos los títulos. Es lo que la editorial tiene para pagar su estructura (CE) y ganar.',
  cmpProm: 'Los dos promedios que dividen el cuadro: MCTp = MCG ÷ cantidad de títulos y MCT%p = MCG ÷ ING. Un título es A si su MCT está por encima del promedio (C si no) y B si su MCT% lo está (D si no).',
  cmpPe: 'Punto de equilibrio para varios títulos, suponiendo que se mantiene la mezcla de ventas estimada: el ingreso neto necesario (CE + ganancia) se divide por el MCT%p, y se reparte entre los títulos según su peso en el ING.'
};
const escS = () => (E.escandallo = E.escandallo || JSON.parse(JSON.stringify(Escandallo.EJEMPLO)));
// "?" al lado de cada concepto: muestra u oculta su explicación (data-ay une el botón con su texto).
// El nombre accesible dice de qué concepto es la ayuda (si no se pasa t, sale de la primera frase de la explicación).
const nombreAy = (k, t) => String(t || (AYUDA[k] || '').split(/[:.]/)[0]).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 50);
const ay = (k, t) => `<button type="button" class="ayuda-q" aria-expanded="${V.ayuda[k] ? 'true' : 'false'}" aria-label="Qué es: ${esc(nombreAy(k, t))}" data-f="ay-${k}" onclick="verAyuda(${arg(k)})">?</button>`;
const exp = k => `<span class="explica" data-ay="${k}" ${V.ayuda[k] ? '' : 'hidden'}>${esc(AYUDA[k])}</span>`;
function verAyuda(k) {
  V.ayuda[k] = !V.ayuda[k];
  document.querySelectorAll(`[data-ay="${CSS.escape(k)}"]`).forEach(el => { el.hidden = !V.ayuda[k]; });
  document.querySelectorAll(`[data-f="ay-${CSS.escape(k)}"]`).forEach(el => el.setAttribute('aria-expanded', V.ayuda[k] ? 'true' : 'false'));
}
const campoEsc = (k, t, suf, ph) => `<div class="campo-esc"><label class="c" for="esc-${k}">${t} ${ay(k, t)}</label>${exp(k)}
  <div class="con-unidad">${suf === '$' ? '<span>$</span>' : ''}<input id="esc-${k}" maxlength="20" inputmode="decimal" autocomplete="off" value="${esc(escS()[k] || '')}" placeholder="${esc(ph || '')}" oninput="setEsc(${arg(k)},this.value)">${suf && suf !== '$' ? `<span>${suf}</span>` : ''}</div></div>`;
const $$ = v => { const r = Math.round(v * 100) / 100, d = Number.isInteger(r) ? 0 : 2; return (r < 0 ? '−$ ' : '$ ') + Math.abs(r).toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d }); };
const n2 = (v, d) => v.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: d == null ? 2 : d });

function vEscandalloUno() {
  const s = escS();
  const modo = (id, t) => `<label class="elige ${s.modo === id ? 'on' : ''}"><input type="radio" name="esc-modo" data-f="modo-${id}" ${s.modo === id ? 'checked' : ''} onchange="setEsc('modo',${arg(id)},true)"><span>${t}</span></label>`;
  return `<p class="u-mt0 chico tenue">El escandallo dice si el precio de un libro es viable: del PVP se descuenta lo que se queda el canal y lo que cuesta el libro, y lo que sobra (el margen de contribución) tiene que pagar la estructura de la editorial. Tocá <b>?</b> al lado de cada concepto para ver qué es. Basado en la cátedra de Administración de la Empresa Editorial; tus cifras se guardan en este navegador.</p>
    <div class="u-mb10 fila"><button class="btn sec ch" onclick="ejemploEsc()">Cargar el ejemplo de la clase</button><button class="btn lin ch" onclick="vaciarEsc()">Vaciar</button></div>
    <div class="esc">
    <div class="esc-datos">
      <div class="tarjeta"><h3>1. El libro</h3><div class="dos">${campoEsc('pvp', 'Precio de venta al público (PVP)', '$')}${campoEsc('tirada', 'Tirada', 'ejemplares')}</div></div>
      <div class="tarjeta"><h3>2. Lo que cuesta cada ejemplar ${ay('modo')}</h3>${exp('modo')}
        <div class="eligen u-margin-top-8px">${modo('cpu', 'Ya sé el CPU')}${modo('offset', 'Offset: tengo los costos totales')}${modo('demanda', 'Impresión por demanda')}</div>
        ${s.modo === 'cpu' ? campoEsc('cpu', 'Costo producto unitario (CPU)', '$')
          : s.modo === 'offset' ? `<div class="dos">${campoEsc('preproduccion', 'Costos de preproducción (totales)', '$')}${campoEsc('industrial', 'Costos industriales (totales)', '$')}</div>`
          : `<p class="u-mt8 chico tenue">${esc(AYUDA.demanda)}</p><div class="dos">${campoEsc('paginas', 'Páginas del libro', 'págs.')}${campoEsc('porPliego', 'Páginas por pliego A3', 'págs.', '8')}
            ${campoEsc('precioPliego', 'Precio del pliego A3 (interior)', '$')}${campoEsc('tapasPorPliego', 'Tapas por pliego A3', 'tapas', '2')}
            ${campoEsc('precioTapa', 'Precio del pliego A3 (tapa)', '$')}${campoEsc('encuadernado', 'Encuadernado por ejemplar', '$')}</div>`}</div>
      <div class="tarjeta"><h3>3. Lo que se queda el canal</h3>
        <label class="chico"><input type="checkbox" data-f="usar-canales" class="u-min-height-0" ${s.usarCanales ? 'checked' : ''} onchange="setEsc('usarCanales',this.checked,true)"> Vendo por varios canales (promedio ponderado) ${ay('canales')}</label>${exp('canales')}
        ${s.usarCanales ? vCanales(s) : campoEsc('descuento', 'Descuento comercial', '% del PVP')}</div>
      <div class="tarjeta"><h3>4. Gastos comerciales ${ay('gastos')}</h3>${exp('gastos')}<div class="dos">
        ${campoEsc('invendibles', 'Invendibles', '% del CPU')}${campoEsc('derechos', 'Derechos de autor', '% del PVP')}
        ${campoEsc('incobrables', 'Incobrables', '% del INU')}${campoEsc('comisiones', 'Comisión de vendedores', '% del INU')}
        ${campoEsc('flete', 'Flete y depósito', '% del INU')}${campoEsc('publicidad', 'Publicidad y marketing', '% del INU')}</div></div>
      <div class="tarjeta"><h3>5. La estructura (opcional)</h3>${campoEsc('ce', 'Costo de estructura que tiene que cubrir este libro', '$')}
        <p class="u-mt6 chico tenue">Con este dato calculo el costo global y los puntos de equilibrio.</p></div>
    </div>
    <div class="esc-res" id="esc-res" aria-live="polite">${escResultado()}</div></div>
    <div id="esc-pasos">${escPasos()}</div>`;
}
// ---------- Comparador de títulos ----------
const cmpS = () => (E.comparador = E.comparador || JSON.parse(JSON.stringify(Escandallo.EJEMPLO_COMPARADOR)));
// ---------- Pestaña Simuladores: una tarjeta por simulador, agrupadas por materia ----------
function vSimuladores() {
  const sim = SIMULADORES.find(x => x.id === V.sim);
  const plan = id => D.plan.materias.find(x => x.id === id) || { id, nombre: id, sigla: '' };
  if (sim) {
    const p = plan(sim.materia);
    return `<div class="fila"><button class="btn lin ch" onclick="irSim('')">← Todas las herramientas</button><span class="crece"></span>
        <button class="btn lin ch" onclick="compartir(urlSim(${arg(sim.id)}),${arg(sim.t)},'simulador',${arg(sim.id)})">🔗 Compartir</button>
        <button class="btn lin ch" onclick="abrirQR(urlSim(${arg(sim.id)}),${arg(sim.t)},'simulador',${arg(sim.id)})" aria-label="Código QR de este simulador">▦ QR</button></div>
      <div class="titulo-sec"><h2>${esc(sim.t)}</h2>${esPro() ? '' : `<span class="chico tenue">${esc(p.nombre)}</span>`}</div>` + (esPro() ? '' : vRetos(sim.id)) + { escandallo: vEscandalloUno, comparador: vComparador, papel: vPapel, paginacion: vPaginacion, cronograma: vCronograma, ecosistema: vEcosistema, formatos: vFormatos, leyes: vLeyes, contratos: vContratos, tarifario: vTarifario }[sim.id]();
  }
  if (esPro()) {
    const TEMAS = [['Producción y planificación', ['papel', 'paginacion', 'formatos', 'cronograma']], ['Costos y catálogo', ['escandallo', 'comparador']], ['Derecho', ['leyes', 'contratos']], ['Trabajo freelance', ['tarifario']], ['El sector', ['ecosistema']]];
    return `<p class="u-mt0 chico tenue">Calculadoras y mapas para quien hace libros. Tus cifras se guardan solo en este navegador.</p>
      <div class="titulo-sec"><h2>Planificar un libro</h2></div>
      <div class="res-grilla"><a class="res-mat u-text-decoration-none_color-inherit" href="libro/cronograma/" ><span class="fila"><span class="clave">Nuevo</span></span><b>🗓️ Planificador de libros</b><span class="chico tenue">Del original a la reimpresión: Gantt, PERT y Roy, con feriados, dependencias, varios títulos y responsables.</span></a></div>` +
      TEMAS.map(([t, ids]) => `<div class="titulo-sec"><h2>${esc(t)}</h2></div>
        <div class="res-grilla">${ids.map(i => SIMULADORES.find(x => x.id === i)).filter(Boolean).map(x => `<button class="res-mat" onclick="irSim(${arg(x.id)})"><b>${esc(x.t)}</b><span class="chico tenue">${esc(x.d)}</span></button>`).join('')}</div>`).join('');
  }
  const est = id => (E.materias[id] || {}).estado, marca = id => est(id) === 'cursando' ? '<span class="chip">la cursás</span>' : est(id) === 'regular' ? '<span class="chip">te falta el final</span>' : '';
  const materias = [...new Set(SIMULADORES.map(x => x.materia))].sort();
  return `<p class="u-mt0 chico tenue">Calculadoras y mapas para las materias de Edición. Cada uno está basado en lo que enseña su cátedra, y tus cifras se guardan solo en este navegador.</p>` +
    materias.map(id => {
      const p = plan(id);
      return `<div class="titulo-sec"><h2>${esc(p.nombre)}</h2></div>
        <div class="res-grilla">${SIMULADORES.filter(x => x.materia === id).map(x => `<button class="res-mat" onclick="irSim(${arg(x.id)})"><span class="fila"><span class="clave">${esc(p.sigla)}</span><span class="crece"></span>${marca(id)}</span>
          <b>${esc(x.t)}</b><span class="chico tenue">${esc(x.d)}</span></button>`).join('')}</div>`;
    }).join('');
}
// =====================================================================
// EVENTOS DE LA INDUSTRIA (perfil profesional): datos/eventos.json, solo fuentes oficiales; lo que no confirmó el organizador se marca «a confirmar».
// =====================================================================
async function cargarEventos() {
  if (D.eventos || cargarEventos.va) return;
  cargarEventos.va = true;
  try { D.eventos = await json('eventos.json'); } catch (e) { D.eventos = { eventos: [], error: true }; }
  if (V.tab === 'eventos') render();
}
function rangoEv(a, b) {
  const x = fecha(a), y = fecha(b || a);
  if (!b || a === b) return fmtLarga(a);
  if (x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth()) return x.getDate() + ' al ' + fmtLarga(b);
  return x.getDate() + ' de ' + MESES_LARGO[x.getMonth()] + (x.getFullYear() === y.getFullYear() ? '' : ' de ' + x.getFullYear()) + ' al ' + fmtLarga(b);
}
function vEventos() {
  if (!D.eventos) { cargarEventos(); return '<p class="cargando">Cargando los eventos…</p>'; }
  if (D.eventos.error) return '<p class="vacio">No pude cargar esto. Puede ser la conexión. <button class="btn sec" type="button" onclick="location.reload()">Probar de nuevo</button></p>';
  const h = hoy(), todos = D.eventos.eventos, pasado = e => e.desde && (e.hasta || e.desde) < h, hayPas = todos.some(pasado);
  const L = todos.filter(e => V.evPas || !pasado(e)).sort((a, b) => (a.desde || '9999') < (b.desde || '9999') ? -1 : 1);
  const tarjeta = e => `<div class="tarjeta nov-item"><div class="fila"><b class="nov-t crece">${esc(e.t)}</b>
      <span class="chip ${e.confirmada ? 'ok' : 'mos'}">${e.confirmada ? 'Confirmada' : 'A confirmar'}</span></div>
    <p class="u-mt6 chico"><b>${e.desde ? esc(rangoEv(e.desde, e.hasta)) : 'Fecha por confirmar'}</b>${e.lugar ? ' · ' + esc(e.lugar) : ''}</p>
    <p class="u-mt6 chico">${esc(e.d)}</p>
    ${e.nota ? `<p class="u-mt6 chico tenue">${esc(e.nota)}</p>` : ''}
    <p class="u-mt8 chico tenue"><span class="chip tin">${esc(e.ambito)}</span>${e.url ? ` · <a href="${urlSegura(e.url)}" target="_blank" rel="noopener">Sitio oficial ↗</a>` : ' · Sin sitio oficial verificado'}</p></div>`;
  let mes = '';
  const cuerpo = L.map(e => { const m = e.desde ? e.desde.slice(0, 7) : 'sin', cab = m !== mes ? (mes = m, `<div class="titulo-sec"><h2>${m === 'sin' ? 'Fecha por confirmar' : esc(MESES_LARGO[+m.slice(5) - 1][0].toUpperCase() + MESES_LARGO[+m.slice(5) - 1].slice(1) + ' de ' + m.slice(0, 4))}</h2></div>`) : ''; return cab + tarjeta(e); }).join('');
  return `<p class="u-mt0 chico tenue">Ferias y fechas del mundo del libro que importan a quien edita, vende o publica. Solo cuento lo que confirma el organizador; lo demás figura «a confirmar». ¿Falta alguno? <a href="#" onclick="idea(); return false">Avisame con 💡 Contame qué falta</a>.</p>
    ${hayPas ? `<p class="u-mt0 botones"><button class="btn lin ch" aria-pressed="${!!V.evPas}" onclick="V.evPas=!V.evPas;render()">${V.evPas ? 'Ocultar los que ya pasaron' : 'Ver los que ya pasaron'}</button></p>` : ''}
    ${cuerpo || '<p class="vacio">No hay eventos por venir cargados.</p>'}
    ${D.eventos.actualizado ? `<p class="chico tenue verificado">Revisados el ${esc(fmtLarga(D.eventos.actualizado))}.</p>` : ''}`;
}
// Los links para compartir van a la página propia de cada simulador (con vista previa para WhatsApp y Google): simuladores_web.py.
const urlSim = id => location.origin + location.pathname.replace(/[^/]*$/, '') + 'simuladores/' + id + '.html';
function irSim(id) {
  V.tab = 'simuladores'; V.sim = id; history.replaceState(null, '', '#' + hashActual()); render(); window.scrollTo(0, 0);
  if (id) medir('select_content', { content_type: 'simulador', item_id: id });
}
function vComparador() {
  const c = cmpS();
  const cel = (i, k, t, ph) => `<td><input maxlength="${k === 't' ? 40 : 20}" data-f="cmp${i}${k}" ${k === 't' ? '' : 'inputmode="decimal"'} aria-label="${t} del título ${i + 1}" value="${esc(c.titulos[i][k])}" placeholder="${esc(ph || '')}" oninput="setCmp(${i},${arg(k)},this.value)"></td>`;
  const filas = c.titulos.map((t, i) => `<tr>${cel(i, 't', 'Nombre', 'Título')}${cel(i, 'pvp', 'PVP')}${cel(i, 'desc', 'Descuento')}${cel(i, 'inu', 'INU')}${cel(i, 'cdu', 'CDU')}${cel(i, 'q', 'Ventas estimadas')}
    <td><button class="btn lin ch" aria-label="Quitar el título ${i + 1}" onclick="quitarCmp(${i})">✕</button></td></tr>`).join('');
  return `<p class="u-mt0 chico tenue">Compará varios títulos para decidir qué hacer con cada uno: cuál dejar como está, a cuál bajarle los costos, en cuál invertir más en marketing y cuál discontinuar. Cargá para cada uno el <b>INU</b> (o el PVP y el descuento), el <b>CDU</b> y las <b>ventas estimadas</b>; el INU y el CDU salen del escandallo de cada libro. Método de Maradei (<i>Administración editorial: herramientas útiles</i>, cap. 5). Tus cifras se guardan en este navegador.</p>
    <div class="u-mb10 fila"><button class="btn sec ch" onclick="ejemploCmp()">Cargar el ejemplo del libro</button><button class="btn sec ch" onclick="traerCmp()">Traer el libro del simulador</button><button class="btn lin ch" onclick="vaciarCmp()">Vaciar</button></div>
    <div class="tarjeta"><h3>Los títulos</h3><div class="tabla-scroll"><table class="tabla canales"><thead><tr><th>Título</th><th>PVP $</th><th>Desc. %</th><th>INU $</th><th>CDU $</th><th>Ventas (Q)</th><th><span class="solo-lector">Quitar</span></th></tr></thead><tbody>${filas}</tbody></table></div>
      <p class="u-mt6 chico tenue">Si cargás el INU, se usa ese; si no, se calcula como PVP − descuento. <button class="btn lin ch" onclick="sumarCmp()">＋ Título</button></p>
      <div class="dos">${campoCmp('ce', 'Costo de estructura (CE) para el punto de equilibrio', '$')}${campoCmp('ganancia', 'Ganancia buscada', '$')}</div></div>
    <div id="cmp-res" aria-live="polite">${cmpResultado()}</div>
    <div id="cmp-pasos">${cmpPasos()}</div>`;
}
const campoCmp = (k, t, suf) => `<div class="campo-esc"><label class="c" for="cmp-${k}">${t}</label><div class="con-unidad"><span>${suf}</span><input id="cmp-${k}" maxlength="20" inputmode="decimal" autocomplete="off" value="${esc(cmpS()[k] || '')}" oninput="setCmpG(${arg(k)},this.value)"></div></div>`;
function cmpResultado() {
  const c = cmpS(), r = Escandallo.comparar(c.titulos, c);
  if (r.titulos.length < 2 || r.ing <= 0) return '<div class="tarjeta"><p class="vacio u-padding-10px">Cargá al menos dos títulos con INU, CDU y ventas.</p></div>';
  const pc = (v, d) => n2(v * 100, d == null ? 1 : d) + ' %', lib = v => n2(Math.ceil(v - 1e-9), 0);
  const dato = (b, t, k) => `<div class="dato"><b>${b}</b><span>${t} ${ay(k, t)}</span>${exp(k)}</div>`;
  const grupos = ['AB', 'AD', 'CB', 'CD'].map(q => {
    const L = r.titulos.filter(x => x.cuadrante === q), a = Escandallo.ACCIONES[q];
    return `<div class="tarjeta" style="border-left:5px solid var(--${a.tono})"><div class="fila"><b class="crece">${a.accion}</b><span class="chip ${a.tono}">${q}</span></div>
      <p class="chico u-margin-4px-0">${L.length ? L.map(x => `<b>${esc(x.t)}</b>`).join(', ') : '<span class="tenue">Ninguno</span>'}</p><p class="u-m0 chico tenue">${a.texto}</p></div>`;
  }).join('');
  let pe = '';
  if (r.pe && (Escandallo.n(c.ce) > 0 || Escandallo.n(c.ganancia) > 0)) {
    const P = r.pe, tb = z => `<tr><th scope="row">Título</th>${r.titulos.map(x => `<th>${esc(x.t)}</th>`).join('')}<th>Total</th></tr>
      <tr><th scope="row">Libros</th>${z.porTitulo.map(x => `<td>${lib(x.libros)}</td>`).join('')}<td><b>${lib(z.libros)}</b></td></tr>
      <tr><th scope="row">Ingreso neto</th>${z.porTitulo.map(x => `<td>${$$(x.dinero)}</td>`).join('')}<td><b>${$$(z.dinero)}</b></td></tr>`;
    const bloque = (t, z, nota) => `<h4 class="u-margin-14px-0-4px">${t}</h4><p class="u-mb4 chico tenue">${nota}${z.factor > 1 ? ' <span class="chip mal">más que las ventas estimadas</span>' : ''}</p><div class="tabla-scroll"><table class="tabla">${tb(z)}</table></div>`;
    pe = `<div class="tarjeta"><h3>Puntos de equilibrio de los ${r.titulos.length} títulos ${ay('cmpPe')}</h3>${exp('cmpPe')}
      <p class="u-m0 chico tenue">Se mantiene la mezcla de ventas estimada. Ingreso neto promedio por libro: ${$$(P.inuPromedio)} · margen por libro: ${$$(P.mcuPromedio)}.</p>
      ${P.costeoDirecto ? bloque('Costeo directo: pagar la estructura y la ganancia', P.costeoDirecto, `(CE + ganancia) ÷ MCT%p = ${$$(P.necesario)} ÷ ${pc(r.mctPctP, 2)}`)
        : '<p class="chico alerta">El margen global es cero o negativo: ningún volumen paga la estructura.</p>'}
      ${bloque('Solo recuperar la edición', P.edicion, `Costo directo total de los títulos: ${$$(P.cdt)}`)}
      ${bloque('Costeo por absorción: estructura, edición y ganancia', P.absorcion, `CE + CDT + ganancia = ${$$(Escandallo.n(c.ce) + P.cdt + Escandallo.n(c.ganancia))} (con las tiradas ya impresas)`)}
      <h4 class="u-margin-14px-0-4px">Distribución del ingreso (con las ventas estimadas)</h4>
      <p class="u-m0 chico">Ingreso neto global ${$$(P.distribucion.ing)} = costo directo ${$$(P.distribucion.cdt)} + estructura ${$$(P.distribucion.ce)} + <b>${P.distribucion.resultado >= 0 ? 'ganancia' : 'pérdida'} ${$$(Math.abs(P.distribucion.resultado))}</b>.</p></div>`;
  }
  return `<div class="tarjeta"><h3>El panorama</h3><div class="resumen">
      ${dato($$(r.ing), 'Ingreso neto global (ING)', 'cmpIng')}${dato($$(r.mcg), 'Margen de contribución global (MCG)', 'cmpMcg')}
      ${dato(pc(r.mctPctP), 'MCT%p (promedio)', 'cmpProm')}${dato($$(r.mctP), 'MCTp (promedio por título)', 'cmpProm')}</div></div>
    <div class="titulo-sec"><h2>Qué hacer con cada título</h2></div><div class="esc-grupos">${grupos}</div>
    <div class="tarjeta"><h3>Los números de cada título</h3><div class="tabla-scroll"><table class="tabla"><thead><tr><th>Título</th><th>Q</th><th>INU</th><th>MCU</th><th>INT ${ay('cmpIng')}</th><th>MCT ${ay('cmpMct')}</th><th>MCT% ${ay('cmpMctPct')}</th><th>% del ING</th><th>% del MCG</th><th>Cuadrante</th></tr></thead><tbody>
      ${r.titulos.map(x => `<tr><td><b>${esc(x.t)}</b></td><td>${n2(x.q, 0)}</td><td>${$$(x.inu)}</td><td>${$$(x.mcu)}</td><td>${$$(x.int)}</td><td>${$$(x.mct)}</td><td>${pc(x.mctPct)}</td><td>${pc(x.partIng)}</td><td>${pc(x.partMcg, 2)}</td><td><span class="chip ${x.tono}">${x.cuadrante}</span></td></tr>`).join('')}
      <tr><td><b>Total</b></td><td>${n2(r.qTot, 0)}</td><td></td><td></td><td><b>${$$(r.ing)}</b></td><td><b>${$$(r.mcg)}</b></td><td><b>${pc(r.mctPctP)}</b></td><td>100 %</td><td>100 %</td><td></td></tr></tbody></table></div>
      <p class="u-mt8 chico tenue">A: MCT por encima del promedio (${$$(r.mctP)}) · C: por debajo · B: MCT% por encima del promedio (${pc(r.mctPctP)}) · D: por debajo. ${ay('cmpProm')}</p>${exp('cmpProm')}</div>
    ${pe}`;
}
// «Cómo se hace a mano»: el método general, paso a paso, y debajo de cada paso la cuenta con las cifras cargadas (si las hay).
const pasosMano = (intro, L) => `<div class="titulo-sec"><h2>✍️ Cómo se hace a mano</h2></div><div class="tarjeta pasos">
  <p class="u-mt0 chico tenue">${intro}</p><ol>${L.map(x => `<li>${x.replace(/\$ (?=\d)/g, () => '$ ')}</li>`).join('')}</ol></div>`;   // el signo $ no se separa de su número al cortar la línea
const conTus = (ok, t) => ok ? `<br><span class="tenue">Con tus números:</span> ${t}` : '';
function cmpPasos() {
  const c = cmpS(), r = Escandallo.comparar(c.titulos, c), ok = r.titulos.length >= 2 && r.ing > 0, x = r.titulos[0] || {};
  const pc = (v, d) => n2(v * 100, d == null ? 1 : d) + ' %', N = Escandallo.n, ce = N(c.ce), gan = N(c.ganancia), P = r.pe;
  const L = [
    `<b>Juntá tres datos por título:</b> el ingreso neto unitario (INU), el costo directo unitario (CDU) y las ventas estimadas (Q). El INU y el CDU salen del escandallo de cada libro; si el enunciado da el PVP y el descuento, INU = PVP × (1 − descuento ÷ 100).`,
    `<b>Calculá cada título por separado:</b> MCU = INU − CDU · ingreso neto total INT = INU × Q · margen total MCT = MCU × Q · MCT% = MCT ÷ INT. Conviene armar una tabla con una fila por título y una columna por cuenta.` +
      conTus(ok, `${esc(x.t)}: MCU = ${$$(x.inu)} − ${$$(x.cdu)} = ${$$(x.mcu)} · INT = ${$$(x.inu)} × ${n2(x.q, 0)} = ${$$(x.int)} · MCT = ${$$(x.mcu)} × ${n2(x.q, 0)} = ${$$(x.mct)} · MCT% = ${$$(x.mct)} ÷ ${$$(x.int)} = <b>${pc(x.mctPct)}</b>. Lo mismo con los demás (están en la tabla de arriba).`),
    `<b>Sumá la columna del INT y la del MCT:</b> el ingreso neto global ING = suma de los INT, y el margen de contribución global MCG = suma de los MCT.` +
      conTus(ok, `ING = ${r.titulos.map(t => $$(t.int)).join(' + ')} = <b>${$$(r.ing)}</b> · MCG = ${r.titulos.map(t => $$(t.mct)).join(' + ')} = <b>${$$(r.mcg)}</b>`),
    `<b>Sacá los dos promedios que dividen el cuadro:</b> MCTp = MCG ÷ cantidad de títulos, y MCT%p = MCG ÷ ING. Ojo: el MCT%p no es el promedio de los MCT% de cada título, porque pesa más el que más factura.` +
      conTus(ok, `MCTp = ${$$(r.mcg)} ÷ ${r.titulos.length} = <b>${$$(r.mctP)}</b> · MCT%p = ${$$(r.mcg)} ÷ ${$$(r.ing)} = <b>${pc(r.mctPctP)}</b>`),
    `<b>Ubicá cada título en el cuadro:</b> es A si su MCT es igual o mayor que el MCTp (se vende) y C si es menor; es B si su MCT% es igual o mayor que el MCT%p (es rentable) y D si es menor. AB: dejarlo como está · AD: bajar costos o subir el precio · CB: más marketing y ventas · CD: discontinuarlo.` +
      conTus(ok, r.titulos.map(t => `${esc(t.t)} → ${t.alto ? 'A' : 'C'} y ${t.rentable ? 'B' : 'D'}: <b>${t.cuadrante}</b>`).join(' · ')),
    `<b>Punto de equilibrio de todo el catálogo (si te dan el CE o una ganancia):</b> se supone que se mantiene la mezcla de ventas. El ingreso neto necesario es (CE + ganancia) ÷ MCT%p. Dividilo por el ING y te da un factor: los libros de cada título son Q × factor (y su ingreso, INT × factor). Redondeá los libros hacia arriba. Para solo recuperar la edición, el factor es CDT ÷ ING (CDT = suma de CDU × Q); por absorción, (CE + CDT + ganancia) ÷ ING.` +
      conTus(ok && P && P.costeoDirecto && (ce > 0 || gan > 0), P && P.costeoDirecto ? `(${$$(ce)} + ${$$(gan)}) ÷ ${pc(r.mctPctP, 2)} = ${$$(P.costeoDirecto.dinero)} · factor = ${$$(P.costeoDirecto.dinero)} ÷ ${$$(r.ing)} = ${n2(P.costeoDirecto.factor, 4)} · libros = ${n2(r.qTot, 0)} × ${n2(P.costeoDirecto.factor, 4)} = <b>${n2(Math.ceil(P.costeoDirecto.libros - 1e-9), 0)}</b> en total` : ''),
    `<b>Para cerrar, la distribución del ingreso:</b> resultado = MCG − CE, y tiene que cumplirse ING = CDT + CE + resultado. Si el resultado da negativo, es pérdida.` +
      conTus(ok && P && ce > 0, P ? `${$$(r.mcg)} − ${$$(ce)} = ${$$(P.distribucion.resultado)} · ${$$(P.distribucion.cdt)} + ${$$(ce)} + ${$$(P.distribucion.resultado)} = ${$$(r.ing)}` : '')
  ];
  return pasosMano(`El método de Maradei para cualquier ejercicio de comparación de títulos.${ok ? ' Debajo de cada paso, la cuenta con los títulos que cargaste.' : ' Cargá al menos dos títulos y vas a ver las cuentas con tus números.'}`, L);
}
let cmpT;
const guardarCmp = () => { clearTimeout(cmpT); cmpT = setTimeout(guardar, 300); };
const cmpRefrescar = () => { $('#cmp-res').innerHTML = cmpResultado(); $('#cmp-pasos').innerHTML = cmpPasos(); };
function setCmp(i, k, v) { const t = cmpS().titulos[i]; if (!t) return; t[k] = v; guardarCmp(); cmpRefrescar(); }
function setCmpG(k, v) { cmpS()[k] = v; guardarCmp(); cmpRefrescar(); }
const tituloVacio = () => ({ t: '', pvp: '', desc: '', inu: '', cdu: '', q: '' });
function sumarCmp() { const L = cmpS().titulos; if (L.length >= 20) return aviso('Hasta 20 títulos'); L.push(tituloVacio()); guardar(); render(); }
function quitarCmp(i) { cmpS().titulos.splice(i, 1); guardar(); render(); }
function ejemploCmp() { E.comparador = JSON.parse(JSON.stringify(Escandallo.EJEMPLO_COMPARADOR)); guardar(); render(); aviso('Ejemplo del libro cargado'); }
function vaciarCmp() { E.comparador = { ce: '', ganancia: '', titulos: [tituloVacio(), tituloVacio()] }; guardar(); render(); }
// Suma al comparador el libro que está en el simulador (su INU, su CDU y la tirada como ventas estimadas).
function traerCmp() {
  const r = Escandallo.calcular(escS());
  if (!r.inu || !r.tirada) return aviso('Completá el PVP y la tirada en el simulador');
  const L = cmpS().titulos;
  const f = v => String(Math.round(v * 100) / 100).replace('.', ','), t = { t: 'Libro del simulador', pvp: '', desc: '', inu: f(r.inu), cdu: f(r.cdu), q: String(r.tirada) };
  const vacio = L.findIndex(x => !x.inu && !x.cdu && !x.q);
  if (vacio >= 0) L[vacio] = t; else if (L.length >= 20) return aviso('Hasta 20 títulos'); else L.push(t);
  guardar(); render(); aviso('Libro del simulador agregado');
}

function vCanales(s) {
  return `<table class="tabla canales"><thead><tr><th>Canal</th><th>Descuento %</th><th>Participación %</th><th>Plazo de cobro (días) ${ay('plazo')}</th><th><span class="solo-lector">Quitar</span></th></tr></thead><tbody>
    ${s.canales.map((c, i) => `<tr><td><input maxlength="40" data-f="c${i}t" aria-label="Canal ${i + 1}" value="${esc(c.t)}" oninput="setCanal(${i},'t',this.value)"></td>
      ${['desc', 'part', 'plazo'].map(k => `<td><input maxlength="20" data-f="c${i}${k}" inputmode="decimal" aria-label="${{ desc: 'Descuento', part: 'Participación', plazo: 'Plazo de cobro' }[k]} del canal ${i + 1}" value="${esc(c[k])}" oninput="setCanal(${i},${arg(k)},this.value)"></td>`).join('')}
      <td><button class="btn lin ch" aria-label="Quitar el canal ${i + 1}" onclick="quitarCanal(${i})">✕</button></td></tr>`).join('')}</tbody></table>
    ${exp('plazo')}<button class="btn lin ch u-margin-top-6px" onclick="sumarCanal()">＋ Canal</button>`;
}
function escResultado() {
  const s = escS(), r = Escandallo.calcular(s);
  if (!r.pvp || !r.tirada) return '<div class="tarjeta"><p class="vacio u-padding-10px">Completá al menos el PVP y la tirada.</p></div>';
  const fila = (k, t, v, cls) => `<tr class="${cls || ''}"><th scope="row">${t} ${k ? ay(k, t) : ''}${k ? exp(k) : ''}</th><td>${v}</td></tr>`;
  const g = r.gastos, ch = r.canales;
  const pct = Math.round(r.mcuPct * 10000) / 100, nivel = r.mcu <= 0 ? 'mal' : pct < 25 ? 'mal' : pct < 30 ? 'ojo' : 'ok';
  // Los umbrales de 25 y 30 % son el criterio de la cátedra de Administración de la Empresa Editorial, no una regla general.
  const veredicto = { ok: 'Viable: el margen supera el 30 % (criterio de la cátedra).', ojo: 'En el límite: el margen está entre 25 y 30 % (criterio de la cátedra).', mal: r.mcu <= 0 ? 'No cierra: el libro cuesta más de lo que ingresa.' : 'No conviene: el margen es menor que el 25 % (criterio de la cátedra).' }[nivel];
  const pe = (k, t, v) => `<div class="dato"><b>${v == null ? '—' : n2(Math.ceil(v - 1e-9), 0)}</b><span>${t} ${ay(k)}</span>${exp(k)}${v != null && v > r.tirada ? '<span class="chip mal">más que la tirada</span>' : ''}</div>`;
  return `<div class="tarjeta"><h3>El escandallo</h3>
    ${ch ? `<p class="chico ${Math.abs(ch.part - 100) > 0.001 ? 'alerta' : 'tenue'}" style="margin:4px 0 8px">Descuento promedio ponderado: <b>${n2(ch.desc)} %</b> · plazo de cobro promedio: <b>${n2(ch.plazo, 1)} días</b>${Math.abs(ch.part - 100) > 0.001 ? ` · ⚠ las participaciones suman ${n2(ch.part)} %, no 100 %` : ''}</p>` : ''}
    ${r.dem ? `<p class="chico tenue u-margin-4px-0-8px">Por ejemplar: interior ${n2(r.dem.pliegos)} pliegos = ${$$(r.dem.interior)}, tapa ${$$(r.dem.tapa)} y encuadernado ${$$(r.dem.encuadernado)} → ${$$(r.dem.unitario)}.</p>` : ''}
    <table class="escandallo"><tbody>
      ${fila('pvp', 'PVP', $$(r.pvp))}
      ${fila('descuento', '− Descuento comercial (' + n2(r.descPct) + ' %)', $$(r.descuento))}
      ${fila('inu', '= Ingreso neto unitario (INU)', $$(r.inu), 'sub')}
      ${s.modo !== 'cpu' ? fila('cpt', 'Costo producto total (CPT)', $$(r.cpt), 'nota') : ''}
      ${fila('cpu', '− Costo producto unitario (CPU)', $$(r.cpu))}
      ${fila('invendibles', '− Invendibles', $$(g.invendibles))}${fila('derechos', '− Derechos de autor', $$(g.derechos))}
      ${fila('incobrables', '− Incobrables', $$(g.incobrables))}${fila('comisiones', '− Comisión de vendedores', $$(g.comisiones))}
      ${fila('flete', '− Flete y depósito', $$(g.flete))}${fila('publicidad', '− Publicidad y marketing', $$(g.publicidad))}
      ${fila('mcu', '= Margen de contribución unitario (MCU)', $$(r.mcu), 'total')}
      ${fila('mcuPct', 'MCU %', n2(r.mcuPct, 4) + ' <span class="tenue">(' + n2(pct) + ' %)</span>', 'total')}
    </tbody></table>
    <div class="veredicto ${nivel}"><div class="barra"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i><span class="marca25"></span><span class="marca30"></span></div><b>${veredicto}</b></div></div>
    <div class="tarjeta"><h3>Costos</h3><div class="resumen">
      <div class="dato"><b>${$$(r.cdu)}</b><span>Costo directo unitario (CDU), <b class="por">por ejemplar</b> ${ay('cdu')}</span>${exp('cdu')}</div>
      <div class="dato"><b>${$$(r.totalGastos)}</b><span>Gastos comerciales, <b class="por">por ejemplar</b> ${ay('gastos')}</span>${exp('gastos')}</div>
      <div class="dato"><b>${$$(r.cdt)}</b><span>Costo directo total (CDT), <b class="por">toda la tirada</b> ${ay('cdt')}</span>${exp('cdt')}</div>
      ${r.ce ? `<div class="dato"><b>${$$(r.cgt)}</b><span>Costo global total (CGT), <b class="por">toda la tirada</b> ${ay('cgt')}</span>${exp('cgt')}</div>` : ''}
      <div class="dato"><b>${$$(r.marginal)}</b><span>Costo marginal, <b class="por">un ejemplar más</b> ${ay('marginal')}</span>${exp('marginal')}</div></div></div>
    <div class="tarjeta"><h3>Puntos de equilibrio <span class="chico tenue">(en ejemplares)</span></h3><div class="resumen">
      ${r.ce ? pe('peEstructura', 'para pagar la estructura', r.pe.estructura) : ''}${pe('peEdicion', 'para recuperar la edición', r.pe.edicion)}${r.ce ? pe('peAbsorcion', 'para cubrir todo', r.pe.absorcion) : ''}</div>
      ${r.ce ? '' : '<p class="u-mt8 chico tenue">Cargá el costo de estructura (paso 5) para ver los otros dos.</p>'}</div>
    ${nivel !== 'ok' ? `<div class="tarjeta"><h3>Cómo mejorar el margen</h3><ul class="chico u-margin-0_padding-left-20px">
      <li>Bajar costos rubro por rubro: sacar las solapas, un papel de menor gramaje, otro presupuesto de imprenta.</li>
      <li>Si los costos ya no bajan, subir el PVP hasta el techo que pone el mercado.</li>
      <li>Revisar los canales: los de mayor descuento comen el margen.</li>
      <li>Recién si no se puede mover ni el piso ni el techo, se descarta el libro por inviable.</li></ul></div>` : ''}`;
}
function escPasos() {
  const s = escS(), r = Escandallo.calcular(s), ok = r.pvp > 0 && r.tirada > 0, N = Escandallo.n, g = r.gastos;
  const p = k => n2(N(s[k])) + ' %', ej = v => n2(Math.ceil(v - 1e-9), 0), ch = r.canales;
  const cpu = s.modo === 'offset' ? `CPT = ${$$(r.pre)} + ${$$(r.ind)} = ${$$(r.cpt)} · CPU = ${$$(r.cpt)} ÷ ${n2(r.tirada, 0)} = <b>${$$(r.cpu)}</b>`
    : s.modo === 'demanda' && r.dem ? `pliegos = ${n2(N(s.paginas), 0)} ÷ ${n2(N(s.porPliego) || 8, 0)} = ${n2(r.dem.pliegos)} · interior = ${n2(r.dem.pliegos)} × ${$$(N(s.precioPliego))} = ${$$(r.dem.interior)} · tapa = ${$$(N(s.precioTapa))} ÷ ${n2(N(s.tapasPorPliego) || 1, 0)} = ${$$(r.dem.tapa)} · CPU = ${$$(r.dem.interior)} + ${$$(r.dem.tapa)} + ${$$(r.dem.encuadernado)} = <b>${$$(r.cpu)}</b>`
    : `el CPU es dato: <b>${$$(r.cpu)}</b>`;
  const gasto = (t, base, k) => `${t} ${$$(base)} × ${p(k)} = ${$$(g[k])}`;
  const L = [
    `<b>Ordená los datos.</b> Anotá el PVP, la tirada, el costo de producción, el descuento y cada gasto comercial junto con <b>su base</b>: los invendibles se calculan sobre el CPU, los derechos de autor sobre el PVP y el resto (incobrables, comisiones, flete, publicidad) sobre el INU. Confundir la base es el error más común.`,
    `<b>Descuento e ingreso neto unitario (INU):</b> descuento = PVP × descuento % ÷ 100, e INU = PVP − descuento. Si se vende por varios canales, antes sacá el descuento promedio ponderado: canal por canal, descuento × participación ÷ 100, y sumalos (las participaciones tienen que sumar 100 %).` +
      conTus(ok, (ch ? `descuento ponderado = ${ch.filas.map(c => `${n2(c.desc)} × ${n2(c.part)} ÷ 100`).join(' + ')} = ${n2(r.descPct)} % · ` : '') + `descuento = ${$$(r.pvp)} × ${n2(r.descPct)} % = ${$$(r.descuento)} · INU = ${$$(r.pvp)} − ${$$(r.descuento)} = <b>${$$(r.inu)}</b>`),
    `<b>Costo producto unitario (CPU):</b> si el enunciado lo da, usalo. Si da los costos totales de una impresión offset, CPT = preproducción + industriales y CPU = CPT ÷ tirada. Si es impresión por demanda: pliegos = páginas ÷ páginas por pliego; interior = pliegos × precio del pliego; tapa = precio del pliego de tapa ÷ tapas por pliego; CPU = interior + tapa + encuadernado.` + conTus(ok, cpu),
    `<b>Gastos comerciales, por ejemplar:</b> cada porcentaje por su base. Invendibles = CPU × %; derechos = PVP × %; incobrables, comisiones, flete y publicidad = INU × % cada uno. Después sumalos.` +
      conTus(ok, [gasto('invendibles', r.cpu, 'invendibles'), gasto('derechos', r.pvp, 'derechos'), gasto('incobrables', r.inu, 'incobrables'), gasto('comisiones', r.inu, 'comisiones'), gasto('flete', r.inu, 'flete'), gasto('publicidad', r.inu, 'publicidad')].join(' · ') + ` · total = <b>${$$(r.totalGastos)}</b>`),
    `<b>Costo directo unitario (CDU):</b> CDU = CPU + gastos comerciales.` + conTus(ok, `${$$(r.cpu)} + ${$$(r.totalGastos)} = <b>${$$(r.cdu)}</b>`),
    `<b>Margen de contribución unitario (MCU) y MCU %:</b> MCU = INU − CDU, y MCU % = MCU ÷ INU. Con el criterio de la cátedra, más de 30 % es viable, entre 25 y 30 % está en el límite y menos de 25 % no conviene.` +
      conTus(ok, `MCU = ${$$(r.inu)} − ${$$(r.cdu)} = <b>${$$(r.mcu)}</b> · MCU % = ${$$(r.mcu)} ÷ ${$$(r.inu)} = <b>${n2(r.mcuPct, 4)}</b> (${n2(r.mcuPct * 100)} %)`),
    `<b>Costos de toda la tirada:</b> costo directo total CDT = CDU × tirada. Si te dan el costo de estructura (CE), el costo global total es CGT = CDT + CE.` +
      conTus(ok, `CDT = ${$$(r.cdu)} × ${n2(r.tirada, 0)} = <b>${$$(r.cdt)}</b>` + (r.ce ? ` · CGT = ${$$(r.cdt)} + ${$$(r.ce)} = <b>${$$(r.cgt)}</b>` : '')),
    `<b>Puntos de equilibrio, en ejemplares</b> (siempre se redondea hacia arriba: no se vende medio libro). Para recuperar la edición: CDT ÷ INU. Para pagar la estructura: CE ÷ MCU (si el MCU es cero o negativo, no hay punto de equilibrio). Para cubrir todo: (CE + CDT) ÷ INU. Si el resultado supera la tirada, con esa tirada no se llega.` +
      conTus(ok, `edición = ${$$(r.cdt)} ÷ ${$$(r.inu)} = ${n2(r.pe.edicion || 0)} → <b>${ej(r.pe.edicion || 0)}</b>` + (r.ce ? ` · estructura = ${r.pe.estructura == null ? 'no hay (el MCU no es positivo)' : `${$$(r.ce)} ÷ ${$$(r.mcu)} = ${n2(r.pe.estructura)} → <b>${ej(r.pe.estructura)}</b>`} · todo = (${$$(r.ce)} + ${$$(r.cdt)}) ÷ ${$$(r.inu)} = ${n2(r.pe.absorcion || 0)} → <b>${ej(r.pe.absorcion || 0)}</b>` : ''))
  ];
  return pasosMano(`El método para resolver cualquier escandallo con lápiz y calculadora, según la cátedra de Administración de la Empresa Editorial.${ok ? ' Debajo de cada paso, la cuenta con las cifras que cargaste.' : ' Completá el PVP y la tirada y vas a ver las cuentas con tus números.'}`, L);
}
let escT;
const escRefrescar = () => { $('#esc-res').innerHTML = escResultado(); $('#esc-pasos').innerHTML = escPasos(); };
function setEsc(k, v, todo) {
  escS()[k] = v;
  clearTimeout(escT); escT = setTimeout(guardar, 300);
  if (todo) render(); else escRefrescar();
  retosRefrescar();
}
function setCanal(i, k, v) { const c = escS().canales[i]; if (!c) return; c[k] = v; clearTimeout(escT); escT = setTimeout(guardar, 300); escRefrescar(); retosRefrescar(); }
function sumarCanal() { const L = escS().canales; if (L.length >= 12) return aviso('Hasta 12 canales'); L.push({ t: '', desc: '', part: '', plazo: '' }); guardar(); render(); }
function quitarCanal(i) { escS().canales.splice(i, 1); guardar(); render(); }
function ejemploEsc() { E.escandallo = JSON.parse(JSON.stringify(Escandallo.EJEMPLO)); guardar(); render(); aviso('Ejemplo de la clase 2 cargado'); }
function vaciarEsc() {
  const s = escS();
  CAMPOS_ESC.forEach(k => { s[k] = ''; });
  s.canales = [{ t: 'Librerías', desc: '', part: '', plazo: '' }];
  guardar(); render();
}

// =====================================================================
// CÁLCULO DE PAPEL E IMPOSICIÓN (FPI): las cuentas están en papel.js
// =====================================================================
Object.assign(AYUDA, {
  papTipo: 'Interiores: el pliego se plega en cuadernillos y se imponen dobles páginas (las dos páginas enfrentadas). Tapa: se imprime abierta (solapa + tapa + lomo + tapa + solapa), una pose por ejemplar.',
  papAncho: 'Formato del libro cerrado, en centímetros. Ancho y alto de una página (la tapa tiene el mismo alto).',
  papPaginas: 'Páginas del interior, sin la tapa. Se llevan al múltiplo de 8 más cercano por exceso (las que sobran son páginas en blanco).',
  papSolapa: 'Ancho de cada solapa, en cm. Poné 0 si la tapa no lleva solapas.',
  papLomo: 'Ancho del lomo, en cm. Si no lo sabés, calculalo con el espesor de la hoja en el cálculo de interiores y traelo acá.',
  papTirada: 'Ejemplares que querés tener. La demasía se suma aparte.',
  papDemasia: 'Papel de más para pruebas, puesta a punto y descarte, en % de la tirada. La cátedra usa 10 % de referencia (5 % en el TP integrador). No es la demasía de sangrado de las calles.',
  papGramaje: 'Gramaje en g/m². El papel se calcula por superficie y se paga por peso: el gramaje conecta las dos cosas.',
  papPrecio: 'Precio del kilo de papel. Cada papel (obra, ilustración) tiene el suyo.',
  papPaquete: 'Cómo se vende el papel. El papel de interiores se compra por resma (500 hojas); la cartulina y el ilustración, en paquetes de 100, 150 o 250. Se redondea hacia arriba al paquete entero.',
  papFormato: 'Pliego de compra: el formato estándar que se le pide a la papelera. Elegí el que mejor aproveche la superficie (abajo se comparan todos).',
  papCortes: 'Pliego de impresión: a veces el de compra se corta a la mitad o en cuartos para usar una máquina más chica. El papel entra siempre por su lado ancho.',
  papCalle: 'Calles: espacio entre piezas, 1 cm de referencia; con imágenes al corte no baja de 6 mm (3 mm de sangrado por lado). Laterales: margen en los extremos del lado largo (1 a 1,5 cm). Pinza: franja por donde la máquina agarra el papel (2 a 3 cm). Cola: la franja del extremo opuesto (1,5 a 2 cm). Pinza y cola se descuentan del lado corto del pliego de impresión.',
  papForzar: 'Opcional. Si la imprenta te dijo cuántas páginas entran por pliego de impresión (8, 16, 32…), poné ese dato y se usa en lugar de la imposición calculada.',
  papEspesor: 'Opcional. Espesor de una hoja en micrones (lo da el proveedor). Con eso se aproxima el lomo: hojas × espesor. En cartoné, sumá el cartón.',
  papKgResma: 'Kilos por resma = ancho × alto × gramaje ÷ 20.000 (cm, g/m²; resma de 500 hojas). El 20.000 pasa de cm² a m² y de g a kg ya multiplicado por las 500 hojas.',
  papPliegos: 'Pliegos de compra = ejemplares con demasía × pliegos de impresión por libro ÷ cortes. Interiores: pliegos por libro = páginas ÷ páginas por pliego.',
  papDesperdicio: 'Superficie del pliego de impresión que no ocupan las piezas: calles, pinza, cola, laterales y lo que no entra.',
  papCuadernillos: 'Si las páginas no dan un múltiplo exacto del pliego, el libro mezcla cuadernillos de distinto tamaño (32, 16, 8). Los chicos se repiten en el pliego, por eso la cuenta es proporcional.'
});
const papS = () => (E.papel = E.papel || JSON.parse(JSON.stringify(Papel.EJEMPLO)));
const papAy = k => 'pap' + k[0].toUpperCase() + k.slice(1);
// ayK: la clave de la ayuda; false = sin botón "?" (para no repetir el mismo botón en la pantalla).
const campoPap = (k, t, suf, ph, ayK) => `<div class="campo-esc"><label class="c" for="pap-${k}">${t} ${ayK === false ? '' : ay(ayK || papAy(k))}</label>${ayK === false ? '' : exp(ayK || papAy(k))}
  <div class="con-unidad">${suf === '$' ? '<span>$</span>' : ''}<input id="pap-${k}" maxlength="20" inputmode="decimal" autocomplete="off" value="${esc(papS()[k] || '')}" placeholder="${esc(ph || '')}" oninput="setPap(${arg(k)},this.value)">${suf && suf !== '$' ? `<span>${suf}</span>` : ''}</div></div>`;
const selPap = (k, t, opts, ayK) => `<div class="campo-esc"><label class="c" for="pap-${k}">${t} ${ay(ayK)}</label>${exp(ayK)}
  <select id="pap-${k}" class="sel-pap" onchange="setPap(${arg(k)},this.value,true)">${opts.map(([v, x]) => `<option value="${esc(v)}" ${String(papS()[k]) === String(v) ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></div>`;

function vPapel() {
  const s = papS(), tapa = s.tipo === 'tapa';
  const tipo = (id, t) => `<label class="elige ${s.tipo === id ? 'on' : ''}"><input type="radio" name="pap-tipo" data-f="pap-tipo-${id}" ${s.tipo === id ? 'checked' : ''} onchange="setPap('tipo',${arg(id)},true)"><span>${t}</span></label>`;
  return `<p class="u-mt0 chico tenue">Cuánto papel hay que comprar y cuánto cuesta: a partir del formato del libro, calcula cuántas piezas entran en cada pliego (con calles, pinza, cola y laterales), los pliegos, las resmas, los kilos y el costo. Tocá <b>?</b> al lado de cada dato para ver qué es. Basado en la guía de cálculo de papel de la cátedra de Fundamentos de la Producción de Impresos.</p>
    <div class="u-mb10 eligen">${tipo('interior', '📖 Interiores')}${tipo('tapa', '🗂️ Tapa')} ${ay('papTipo')}</div>${exp('papTipo')}
    <div class="fila u-margin-10px-0"><button class="btn sec ch" onclick="ejemploPap()">Cargar el ejemplo de la cátedra</button><button class="btn lin ch" onclick="vaciarPap()">Vaciar</button></div>
    <div class="esc"><div class="esc-datos">
      <div class="tarjeta"><h3>1. El libro</h3><div class="dos">${campoPap('ancho', 'Ancho cerrado', 'cm')}${campoPap('alto', 'Alto cerrado', 'cm', '', false)}
        ${tapa ? campoPap('solapa', 'Solapa (cada una)', 'cm', '0') + campoPap('lomo', 'Lomo', 'cm') : campoPap('paginas', 'Páginas del interior', 'págs.')}
        ${campoPap('tirada', 'Tirada', 'ejemplares')}${campoPap('demasia', 'Demasía', '% de la tirada', '10')}
        ${tapa ? '' : campoPap('espesor', 'Espesor de una hoja (opcional)', 'µm')}</div></div>
      <div class="tarjeta"><h3>2. El papel</h3><div class="dos">${campoPap('gramaje', 'Gramaje', 'g/m²')}${campoPap('precioKg', 'Precio del kilo', '$', '', 'papPrecio')}
        ${selPap('hojasPaquete', 'Se vende en', [['500', 'Resmas de 500 hojas'], ['250', 'Paquetes de 250'], ['150', 'Paquetes de 150'], ['100', 'Paquetes de 100']], 'papPaquete')}</div></div>
      <div class="tarjeta"><h3>3. El pliego</h3><div class="dos">${selPap('formato', 'Pliego de compra (cm)', Papel.FORMATOS.map(f => [f.id, f.t]).concat([['otro', 'Otro…']]), 'papFormato')}
        ${selPap('cortes', 'Pliego de impresión', Object.keys(Papel.CORTES).map(k => [k, Papel.CORTES[k]]), 'papCortes')}
        ${s.formato === 'otro' ? campoPap('fa', 'Medida del pliego: un lado', 'cm', '', false) + campoPap('fb', 'El otro lado', 'cm', '', false) : ''}</div></div>
      <div class="tarjeta"><h3>4. Calles, pinza y cola ${ay('papCalle')}</h3>${exp('papCalle')}<div class="dos">${campoPap('calle', 'Calles', 'cm', '1', false)}${campoPap('lateral', 'Laterales', 'cm', '1', false)}${campoPap('pinza', 'Pinza', 'cm', '3', false)}${campoPap('cola', 'Cola', 'cm', '2', false)}</div>
        ${tapa ? '' : campoPap('forzar', 'Páginas por pliego, si te lo dio la imprenta (opcional)', 'págs.')}
        <p class="u-mt6 chico tenue">Son medidas de referencia de la cátedra: confirmalas con la imprenta.</p></div>
    </div><div class="esc-res" id="pap-res" aria-live="polite">${papResultado()}</div></div>
    <div id="pap-cmp">${papComparacion()}</div>`;
}

// Dibujo del pliego de impresión: bandas de pinza y cola, laterales, y las piezas que entran.
function papDibujo(r) {
  const I = r.imp, L = I.largo, C = I.corto, m = r.m;
  const gw = I.nx * I.pw + Math.max(0, I.nx - 1) * m.calle, gh = I.ny * I.ph + Math.max(0, I.ny - 1) * m.calle;
  const x0 = m.lateral + (I.U - gw) / 2, y0 = m.pinza + (I.V - gh) / 2;
  let piezas = '';
  for (let i = 0; i < I.nx * I.ny; i++) {
    const cx = i % I.nx, cy = Math.floor(i / I.nx), x = x0 + cx * (I.pw + m.calle), y = y0 + cy * (I.ph + m.calle), usada = i < I.usadas;
    piezas += `<rect class="imp-pieza ${usada ? '' : 'sobra'}" x="${x}" y="${y}" width="${I.pw}" height="${I.ph}"/>`;
    if (usada && r.tipo === 'interior') piezas += I.rotada ? `<line class="imp-plie" x1="${x}" y1="${y + I.ph / 2}" x2="${x + I.pw}" y2="${y + I.ph / 2}"/>` : `<line class="imp-plie" x1="${x + I.pw / 2}" y1="${y}" x2="${x + I.pw / 2}" y2="${y + I.ph}"/>`;
  }
  const dim = `${n2(L, 1)} × ${n2(C, 1)} cm`;
  return `<svg class="imp" viewBox="-1 -1 ${L + 2} ${C + 2}" role="img" aria-label="Pliego de impresión de ${dim}: entran ${I.usadas} ${r.tipo === 'interior' ? 'dobles páginas' : 'tapas'} por cara">
    <rect class="imp-hoja" x="0" y="0" width="${L}" height="${C}"/>
    <rect class="imp-banda" x="0" y="0" width="${L}" height="${m.pinza}"/><rect class="imp-banda" x="0" y="${C - m.cola}" width="${L}" height="${m.cola}"/>
    <rect class="imp-banda lat" x="0" y="${m.pinza}" width="${m.lateral}" height="${C - m.pinza - m.cola}"/><rect class="imp-banda lat" x="${L - m.lateral}" y="${m.pinza}" width="${m.lateral}" height="${C - m.pinza - m.cola}"/>
    ${piezas}</svg>
    <p class="chico tenue u-margin-4px-0-0"><span class="imp-ref"></span> pinza y cola · <span class="imp-ref lat"></span> laterales · pliego de impresión de ${dim}${r.cortes > 1 ? ` (${r.cortes === 2 ? 'mitad' : 'cuarto'} del de compra)` : ''}</p>`;
}

function papResultado() {
  const s = papS(), r = Papel.calcular(s), tapa = r.tipo === 'tapa';
  if (r.incompleto) return `<div class="tarjeta"><p class="vacio u-padding-10px">Completá ${tapa ? 'el formato' : 'el formato, las páginas'}, la tirada, el gramaje y el pliego.</p></div>`;
  if (r.noEntra) return `<div class="tarjeta"><h3>No entra</h3>${papDibujo(r)}<p class="chico alerta">${tapa ? 'La tapa abierta' : 'Ni una doble página'} (${n2(r.pieza.w, 1)} × ${n2(r.pieza.h, 1)} cm) no entra en este pliego con esos márgenes. Probá otro formato, un corte menos o menos solapa.</p></div>`;
  const fila = (k, t, v, cls) => `<tr class="${cls || ''}"><th scope="row">${t} ${k ? ay(k, t) : ''}${k ? exp(k) : ''}</th><td>${v}</td></tr>`;
  const avisos = [];
  if (!tapa && r.sobra > 0) avisos.push(`Entran ${r.imp.encajan} dobles páginas por cara, pero el plegado exige una potencia de 2: se usan ${r.imp.usadas}.`);
  if (!tapa && r.blancas > 0) avisos.push(`${r.paginas} páginas no es múltiplo de 8: se agregan ${r.blancas} en blanco (${r.finales} en total).`);
  const cuad = !tapa && r.cuadernillos.lista.length && !r.cuadernillos.resto ? r.cuadernillos.lista.map(c => `${c.cantidad} de ${c.paginas}`).join(' + ') : '';
  const lomo = !tapa && Papel.n(s.espesor) > 0 ? Papel.lomo(r.finales, s.espesor) : 0;
  return `<div class="tarjeta"><h3>Imposición</h3>${papDibujo(r)}
    <p class="u-mt8"><b>${r.imp.usadas}</b> ${tapa ? (r.imp.usadas === 1 ? 'tapa' : 'tapas') : 'dobles páginas'} por cara${tapa ? '' : ` → <b>${r.porImpresion} páginas</b> por pliego de impresión`}${r.cortes > 1 ? ` · <b>${r.porCompra}</b> ${tapa ? 'tapas' : 'páginas'} por pliego de compra` : ''}.</p>
    <p class="chico tenue u-margin-2px-0-0">${tapa ? `Tapa abierta: ${n2(r.pieza.w, 1)} × ${n2(r.pieza.h, 1)} cm (solapa + tapa + lomo + tapa + solapa).` : `Doble página: ${n2(r.pieza.w, 1)} × ${n2(r.pieza.h, 1)} cm.`} Desperdicio de superficie: <b>${n2(r.desperdicio * 100, 1)} %</b> ${ay('papDesperdicio')}</p>${exp('papDesperdicio')}
    ${avisos.map(a => `<p class="u-mt6 chico alerta">⚠ ${esc(a)}</p>`).join('')}</div>
    <div class="tarjeta"><h3>El papel</h3><table class="escandallo"><tbody>
      ${fila('', 'Ejemplares con demasía (' + n2(r.dem) + ' %)', n2(r.ejemplares, 0))}
      ${tapa ? '' : fila('papCuadernillos', 'Pliegos de impresión por libro', n2(r.pliegosLibro, 3) + (cuad ? ` <span class="tenue">(${esc(cuad)} págs.)</span>` : ''))}
      ${fila('papPliegos', 'Pliegos de compra', n2(r.pliegos, 0), 'sub')}
      ${fila('', r.hojasPaq === 500 ? 'Resmas' : 'Paquetes de ' + r.hojasPaq, n2(r.paquetes, 0) + ` <span class="tenue">(${n2(r.hojas, 0)} hojas)</span>`)}
      ${fila('papKgResma', 'Kilos por resma de 500', n2(r.kgResma, 3) + ' kg')}
      ${fila('', 'Kilos totales', n2(r.kg, 2) + ' kg', 'sub')}
      ${r.precioKg ? fila('', 'Precio por resma · por hoja', $$(r.precioResma) + ' · ' + $$(r.precioHoja)) + fila('', 'Costo total del papel', $$(r.costo), 'total') + fila('', 'Por ejemplar (de la tirada pedida)', $$(r.costoEjemplar)) : ''}
    </tbody></table>${r.precioKg ? '' : '<p class="u-mt8 chico tenue">Cargá el precio del kilo para ver el costo.</p>'}</div>
    ${lomo ? `<div class="tarjeta"><h3>Lomo aproximado</h3><p class="u-m0"><b>${n2(lomo, 2)} cm</b> <span class="chico tenue">(${n2(r.finales / 2, 0)} hojas × ${esc(s.espesor)} µm)</span></p>
      <button class="btn lin ch u-margin-top-8px" onclick="lomoATapa(${arg(lomo.toFixed(2).replace('.', ','))})">Usarlo en la tapa</button></div>` : ''}${papPasos(r, s)}`;
}

// La misma cuenta, paso a paso y con los números de quien la hace (para poder repetirla a mano en el parcial).
function papPasos(r, s) {
  const tapa = r.tipo === 'tapa', I = r.imp, m = r.m, f = (v, d) => n2(v, d == null ? 2 : d), pie = I.pw, alt = I.ph;
  const L = [];
  L.push(tapa ? `<b>La tapa abierta:</b> solapa + tapa + lomo + tapa + solapa = ${f(Papel.n(s.solapa))} + ${f(r.ancho)} + ${f(Papel.n(s.lomo))} + ${f(r.ancho)} + ${f(Papel.n(s.solapa))} = <b>${f(r.pieza.w)} cm</b>, por ${f(r.alto)} cm de alto.`
    : `<b>La doble página</b> (las dos páginas enfrentadas): 2 × ${f(r.ancho)} = ${f(r.pieza.w)} cm de ancho por ${f(r.alto)} cm de alto.`);
  L.push(`<b>El pliego de impresión:</b> ${r.cortes === 1 ? 'el de compra entero' : r.cortes === 2 ? 'la mitad del de compra' : 'un cuarto del de compra'}, de ${f(I.largo, 1)} × ${f(I.corto, 1)} cm. El papel entra por su lado ancho: la pinza y la cola se restan del lado corto y los laterales, del largo.
    <br>Lado largo útil = ${f(I.largo, 1)} − 2 × ${f(m.lateral)} (laterales) = <b>${f(I.U, 1)} cm</b>
    <br>Lado corto útil = ${f(I.corto, 1)} − ${f(m.pinza)} (pinza) − ${f(m.cola)} (cola) = <b>${f(I.V, 1)} cm</b>`);
  L.push(`<b>Cuántas entran</b> (con ${f(m.calle)} cm de calle entre piezas), probando la pieza de ${f(pie)} × ${f(alt)} cm${I.rotada ? ' girada' : ''}:
    <br>A lo largo: (${f(I.U, 1)} + ${f(m.calle)}) ÷ (${f(pie)} + ${f(m.calle)}) = ${f((I.U + m.calle) / (pie + m.calle), 2)} → <b>${I.nx}</b>
    <br>A lo corto: (${f(I.V, 1)} + ${f(m.calle)}) ÷ (${f(alt)} + ${f(m.calle)}) = ${f((I.V + m.calle) / (alt + m.calle), 2)} → <b>${I.ny}</b>
    <br>${I.nx} × ${I.ny} = <b>${I.encajan}</b> ${tapa ? 'tapas' : 'dobles páginas'} por cara${!tapa && I.usadas !== I.encajan ? `. El plegado pide 1, 2, 4, 8, 16… dobles páginas: se usan <b>${I.usadas}</b>.` : '.'}`);
  if (tapa) L.push(`<b>Tapas por pliego de compra:</b> ${r.porImpresion} × ${r.cortes} = <b>${r.porCompra}</b>.`);
  else L.push(`<b>Páginas por pliego de impresión:</b> ${I.usadas} dobles páginas × 2 páginas × 2 caras = <b>${r.porImpresion}</b>.${Papel.n(s.forzar) > 0 ? ' (Usé el dato que cargaste de la imprenta.)' : ''}`);
  if (!tapa) {
    L.push(`<b>Páginas del libro:</b> ${f(r.paginas, 0)} ${r.blancas ? `→ el múltiplo de 8 más cercano por exceso es ${f(r.finales, 0)} (${r.blancas} en blanco)` : '(ya es múltiplo de 8)'}.
      <br>Pliegos de impresión por libro = ${f(r.finales, 0)} ÷ ${r.porImpresion} = <b>${f(r.pliegosLibro, 3)}</b>`);
  }
  L.push(`<b>Ejemplares con demasía:</b> ${f(r.tirada, 0)} × (1 + ${f(r.dem)} ÷ 100) = <b>${f(r.ejemplares, 0)}</b>.`);
  L.push(`<b>Pliegos de compra:</b> ${tapa ? `${f(r.ejemplares, 0)} ÷ ${r.porImpresion} tapas por pliego de impresión` : `${f(r.ejemplares, 0)} × ${f(r.pliegosLibro, 3)}`} = ${f(r.impresiones, 1)} pliegos de impresión${r.cortes > 1 ? ` ÷ ${r.cortes} cortes` : ''} = ${f(r.impresiones / r.cortes, 2)} → se redondea hacia arriba: <b>${f(r.pliegos, 0)}</b>.`);
  L.push(`<b>${r.hojasPaq === 500 ? 'Resmas' : 'Paquetes de ' + r.hojasPaq}:</b> ${f(r.pliegos, 0)} ÷ ${r.hojasPaq} = ${f(r.pliegos / r.hojasPaq, 2)} → <b>${f(r.paquetes, 0)}</b> (${f(r.hojas, 0)} hojas).`);
  L.push(`<b>Kilos por resma de 500 hojas:</b> (ancho × alto × gramaje) ÷ 20.000 = (${f(r.compra.b, 1)} × ${f(r.compra.a, 1)} × ${f(r.gramaje)}) ÷ 20.000 = <b>${f(r.kgResma, 3)} kg</b>.`);
  L.push(`<b>Kilos totales:</b> ${f(r.hojas, 0)} hojas × ${f(r.kgResma, 3)} ÷ 500 = <b>${f(r.kg, 2)} kg</b>.`);
  if (r.precioKg) L.push(`<b>Costo:</b> ${f(r.kg, 2)} kg × ${$$(r.precioKg)} = <b>${$$(r.costo)}</b>. Por ejemplar: ${$$(r.costo)} ÷ ${f(r.tirada, 0)} = ${$$(r.costoEjemplar)}.`);
  return `<details class="tarjeta pasos"><summary><b>✍️ Cómo se hace a mano</b></summary><p class="u-my6 chico tenue">La misma cuenta, paso a paso y con tus números.</p><ol>${L.map(x => `<li>${x}</li>`).join('')}</ol></details>`;
}

// Compara el mismo trabajo con cada formato de pliego de compra, del más barato al más caro.
function papComparacion() {
  const s = papS(), L = Papel.comparar(s);
  if (!L.length) return '';
  const tapa = s.tipo === 'tapa', precio = Papel.n(s.precioKg) > 0;
  return `<div class="tarjeta"><h3>Comparar formatos de pliego</h3>
    <p class="u-mb8 chico tenue">El mismo trabajo con cada formato de compra (pliego de impresión: ${esc(Papel.CORTES[s.cortes].toLowerCase())}). El más barato no siempre es el que parece más justo a ojo: cada formato pesa distinto por resma.</p>
    <div class="tabla-scroll"><table class="tabla"><thead><tr><th>Pliego</th><th>${tapa ? 'Tapas' : 'Págs.'} por pliego</th><th>Kg por resma</th><th>Pliegos</th><th>Kilos</th>${precio ? '<th>Costo</th><th>Dif.</th>' : ''}<th>Desperd.</th></tr></thead><tbody>
    ${L.map(x => `<tr ${x.id === s.formato ? 'class="sel"' : ''}><td><b>${esc(x.t)}</b>${x.mejor ? ' <span class="chip ok">más barato</span>' : ''}${x.id === s.formato ? ' <span class="chip tin">el tuyo</span>' : ''}</td>
      ${x.noEntra ? `<td colspan="${precio ? 7 : 5}" class="tenue">no entra</td>` : `<td>${x.porCompra}</td><td>${n2(x.kgResma, 2)}</td><td>${n2(x.pliegos, 0)}</td><td>${n2(x.kg, 1)}</td>${precio ? `<td>${$$(x.costo)}</td><td>${x.mejor ? '—' : '+' + n2(x.difPct * 100, 1) + ' %'}</td>` : ''}<td>${n2(x.desperdicio * 100, 1)} %</td>`}</tr>`).join('')}
    </tbody></table></div></div>`;
}
let papT;
function setPap(k, v, todo) {
  papS()[k] = v;
  clearTimeout(papT); papT = setTimeout(guardar, 300);
  if (todo) render(); else { $('#pap-res').innerHTML = papResultado(); $('#pap-cmp').innerHTML = papComparacion(); }
}
function ejemploPap() { const t = papS().tipo; E.papel = JSON.parse(JSON.stringify(t === 'tapa' ? Papel.EJEMPLO_TAPA : Papel.EJEMPLO)); guardar(); render(); aviso('Ejemplo de la cátedra cargado'); }
function vaciarPap() {
  const s = papS();
  CAMPOS_PAPEL.forEach(k => { s[k] = ''; });
  s.formato = '58x92'; s.cortes = '1'; s.hojasPaquete = s.tipo === 'tapa' ? '250' : '500';
  Object.assign(s, { calle: '1', lateral: '1', pinza: '3', cola: '2' });
  guardar(); render();
}
function lomoATapa(v) { const s = papS(); s.lomo = v; s.tipo = 'tapa'; guardar(); render(); aviso('Lomo pasado a la tapa'); }

// =====================================================================
// ESQUEMA DE PAGINACIÓN (FPI): las cuentas están en paginacion.js
// =====================================================================
Object.assign(AYUDA, {
  pagTexto: 'Las páginas que ocupa el texto principal, sin preliminares ni finales. Si todavía no lo sabés, cargá abajo los caracteres de la obra y los que entran por página.',
  pagCar: 'Caracteres con espacios de toda la obra (el procesador de texto los cuenta). Páginas del texto = caracteres ÷ caracteres por página, redondeado hacia arriba (cálculo tipográfico).',
  pagCaps: 'En cuántos capítulos se divide el texto. Las páginas se reparten en partes iguales (las que sobran van a los primeros).',
  pagRecto: 'En muchos libros cada capítulo abre en página impar (recto): si el anterior termina en recto, el dorso queda en blanco y eso suma páginas.',
  pagPortadilla: 'Cada capítulo lleva una hoja con solo su título (en recto, con el dorso en blanco): dos páginas más por capítulo.',
  pagMultiplo: 'El pliego de impresión define el múltiplo: el total de páginas se lleva al múltiplo de 8, 16, 32 o 64. Las que faltan son páginas en blanco al final (se pueden cubrir con paratextos o publicidad).',
  pagIni: 'Recto es la página impar (a la derecha al abrir el libro); verso, la par (a la izquierda). Si una parte debe abrir en recto y la página que sigue es par, queda una en blanco.'
});
Paginacion.PARTES.forEach(p => { AYUDA['pg' + p.id] = p.ay; });
const pagS = () => { const g = (E.paginacion = E.paginacion || { partes: {} }); g.partes = g.partes || {}; return g; };
const campoPag = (k, t, suf, ph, ayK) => `<div class="campo-esc"><label class="c" for="pag-${k}">${t} ${ayK === false ? '' : ay(ayK)}</label>${ayK === false ? '' : exp(ayK)}
  <div class="con-unidad"><input id="pag-${k}" maxlength="20" inputmode="numeric" autocomplete="off" value="${esc(pagS()[k] || '')}" placeholder="${esc(ph || '')}" oninput="setPag(${arg(k)},this.value)">${suf ? `<span>${suf}</span>` : ''}</div></div>`;
const pagTilde = (k, def) => pagS()[k] == null ? def : pagS()[k] === '1';
const tildePag = (k, t, ayK, def) => `<label class="elige ${pagTilde(k, def) ? 'on' : ''}"><input type="checkbox" data-f="pag-${k}" ${pagTilde(k, def) ? 'checked' : ''} onchange="setPag(${arg(k)},this.checked?'1':'0',true)"><span>${t}</span></label> ${ay(ayK)}${exp(ayK)}`;

function vPaginacion() {
  const g = pagS(), P = Paginacion;
  const fila = p => {
    const e = P.estado(g, p), x = g.partes[p.id] || {};
    return `<tr class="${e.on ? '' : 'apagada'}"><td class="ctl"><input type="checkbox" data-f="pg-on-${p.id}" aria-label="Incluir: ${esc(p.t)}" ${e.on ? 'checked' : ''} onchange="setPagParte(${arg(p.id)},'on',this.checked)"></td>
      <td><b>${esc(p.t)}</b> ${ay('pg' + p.id)}${exp('pg' + p.id)}</td>
      <td class="ctl">${p.fija ? '<span class="chico tenue">según el texto</span>' : `<input class="nota" inputmode="numeric" maxlength="6" data-f="pg-n-${p.id}" aria-label="Páginas de: ${esc(p.t)}" value="${esc(x.pags || '')}" placeholder="${p.pags}" oninput="setPagParte(${arg(p.id)},'pags',this.value)">`}</td>
      <td class="ctl"><select data-f="pg-i-${p.id}" aria-label="Dónde empieza: ${esc(p.t)}" onchange="setPagParte(${arg(p.id)},'ini',this.value)">${Object.keys(P.INI).map(k => `<option value="${k}" ${e.ini === k ? 'selected' : ''}>${P.INI[k]}</option>`).join('')}</select></td></tr>`;
  };
  const grupos = [['pre', 'Antes del texto (preliminares)'], ['cue', 'El texto'], ['fin', 'Después del texto']];
  return `<p class="u-mt0 chico tenue">Armá el esquema de paginación de un libro: tildá las partes que lleva, cargá cuántas páginas ocupa cada una y mirá en qué página cae, qué páginas quedan en blanco para que cada parte abra en recto y cuántas faltan para completar el pliego. Las páginas se cuentan desde la primera hoja impresa, sin las guardas ni la tapa.</p>
    <div class="fila u-margin-10px-0"><button class="btn sec ch" onclick="ejemploPag()">Cargar un ejemplo (novela de 200 págs.)</button><button class="btn sec ch" onclick="tildarPag(true)">Tildar todas</button><button class="btn sec ch" onclick="tildarPag(false)">Dejar las básicas</button><button class="btn lin ch" onclick="vaciarPag()">Vaciar</button></div>
    <div class="esc"><div class="esc-datos">
      <div class="tarjeta"><h3>1. El texto</h3><div class="dos">${campoPag('paginas', 'Páginas del texto', 'págs.', '', 'pagTexto')}${campoPag('capitulos', 'Capítulos', '', '1', 'pagCaps')}
        ${campoPag('caracteres', 'o caracteres de la obra', 'con espacios', '', 'pagCar')}${campoPag('porPagina', 'Caracteres por página', '', '', false)}</div>
        <div class="eligen u-margin-top-10px">${tildePag('capRecto', 'Cada capítulo abre en recto', 'pagRecto', true)}${tildePag('capPortada', 'Cada capítulo lleva portadilla', 'pagPortadilla', false)}</div>
        <div class="campo-esc"><label class="c" for="pag-multiplo">El total se lleva a un múltiplo de ${ay('pagMultiplo')}</label>${exp('pagMultiplo')}
          <select id="pag-multiplo" onchange="setPag('multiplo',this.value)">${P.MULTIPLOS.map(m => `<option value="${m}" ${String(g.multiplo || '16') === String(m) ? 'selected' : ''}>${m} páginas</option>`).join('')}</select></div></div>
      <div class="tarjeta"><h3>2. Las partes del libro ${ay('pagIni')}</h3>${exp('pagIni')}
        <div class="tabla-scroll"><table class="tabla pag-partes"><thead><tr><th><span class="solo-lector">Incluir</span></th><th>Parte</th><th>Páginas</th><th>Empieza en</th></tr></thead><tbody>
        ${grupos.map(([gr, t]) => `<tr class="grupo-pag"><td colspan="4"><b>${t}</b></td></tr>${P.PARTES.filter(p => p.grupo === gr).map(fila).join('')}`).join('')}</tbody></table></div></div>
    </div><div class="esc-res" id="pag-res" aria-live="polite">${pagResultado()}</div></div>`;
}

function pagResultado() {
  const g = pagS(), P = Paginacion, r = P.armar(g), n0 = v => n2(v, 0), parte = id => P.PARTES.find(p => p.id === id);
  const on = id => P.estado(g, parte(id)).on;
  if (!r.total) return `<div class="tarjeta"><p class="vacio u-padding-10px">Tildá las partes del libro y cargá las páginas del texto.</p></div>`;
  const avisos = [];
  if (on('cuerpo') && !r.texto.pags) avisos.push('Falta el texto: cargá sus páginas (o los caracteres y los caracteres por página) para que cuente.');
  if (r.texto.desde === 'caracteres') avisos.push(`Las páginas del texto salen de los caracteres: ${n0(r.texto.pags)} págs.`);
  if (on('indice') && on('indicefin')) avisos.push('Tenés el índice al principio y al final: elegí uno.');
  const dato = (b, t) => `<div class="dato"><b>${b}</b><span>${t}</span></div>`;
  const cuad = r.cuadernillos.lista.map(c => `${n0(c.cantidad)} de ${c.paginas}`).join(' + ');
  const filas = r.tramos.map(t => `<tr><td><span class="pag-cuad g-${t.grupo}"></span> ${esc(t.t)}</td><td>${t.pags === 1 ? 'pág. ' + t.desde : 'págs. ' + t.desde + ' a ' + t.hasta}</td><td>${t.pags}</td><td>${t.desde % 2 ? 'recto' : 'verso'}</td></tr>`).join('');
  // Dobles: la 1 va sola a la derecha; después, pares enfrentadas (2-3, 4-5…). La última, sola si el total es par.
  const pag = x => { if (!x) return '<span class="pag-h vacia"></span>'; const p = x.id && parte(x.id); return `<span class="pag-h ${p ? 'g-' + p.grupo : 'blanca'}" title="${p ? esc(p.t) : 'En blanco'}">${x.n}</span>`; };
  const L = r.paginas, dobles = [[null, L[0]]];
  for (let i = 1; i < L.length; i += 2) dobles.push([L[i], L[i + 1] || null]);
  return `<div class="tarjeta"><h3>El libro</h3>
    <div class="pag-datos">${dato(n0(r.total), 'páginas en total')}${dato(n0(r.contenido), 'con contenido')}${dato(n0(r.blancasEntre + r.blancasFinal), 'en blanco')}${dato(n0(r.hojas), 'hojas')}</div>
    <p class="u-mt8 chico">Páginas ocupadas: <b>${n0(r.minimo)}</b> (${n0(r.contenido)} con contenido y ${n0(r.blancasEntre)} en blanco para abrir en recto o verso). Para llegar a un múltiplo de ${r.multiplo} se agregan <b>${n0(r.blancasFinal)}</b> al final${r.blancasFinal ? ' (se pueden usar para notas, catálogo o un texto más largo)' : ''}. Cuadernillos: <b>${esc(cuad)}</b> págs.</p>
    ${avisos.map(a => `<p class="u-mt6 chico alerta">⚠ ${esc(a)}</p>`).join('')}</div>
    <div class="tarjeta"><h3>Página por página</h3><div class="tabla-scroll"><table class="tabla"><thead><tr><th>Parte</th><th>Dónde</th><th>Págs.</th><th>Abre en</th></tr></thead><tbody>${filas}
      ${r.blancasEntre + r.blancasFinal ? `<tr class="tenue"><td><span class="pag-cuad blanca"></span> En blanco</td><td colspan="3">${n0(r.blancasEntre)} intercaladas + ${n0(r.blancasFinal)} al final</td></tr>` : ''}</tbody></table></div></div>
    <div class="tarjeta"><h3>Dobles páginas</h3><div class="pag-dobles" role="img" aria-label="Esquema del libro: ${n0(r.total)} páginas, de la primera a la última">${dobles.map(d => `<span class="pag-dbl">${pag(d[0])}${pag(d[1])}</span>`).join('')}</div>
      <p class="u-mt8 chico tenue"><span class="pag-cuad g-pre"></span> Preliminares · <span class="pag-cuad g-cue"></span> Texto · <span class="pag-cuad g-fin"></span> Finales · <span class="pag-cuad blanca"></span> En blanco. La página 1 queda sola, a la derecha; después se enfrentan 2-3, 4-5, y así.</p></div>`;
}
let pagT;
function pagRefrescar() { clearTimeout(pagT); pagT = setTimeout(guardar, 300); const r = $('#pag-res'); if (r) r.innerHTML = pagResultado(); retosRefrescar(); }
function setPag(k, v, todo) { pagS()[k] = v; pagRefrescar(); if (todo) render(); }
function setPagParte(id, k, v) { const g = pagS(); (g.partes[id] = g.partes[id] || {})[k] = v; pagRefrescar(); }
function ejemploPag() { E.paginacion = JSON.parse(JSON.stringify(Paginacion.EJEMPLO)); guardar(); render(); aviso('Ejemplo cargado'); }
function tildarPag(todas) {
  const g = pagS();
  Paginacion.PARTES.forEach(p => { g.partes[p.id] = Object.assign(g.partes[p.id] || {}, { on: p.fija || (todas ? p.id !== 'indicefin' : p.on) }); });
  guardar(); render();
}
function vaciarPag() { E.paginacion = null; guardar(); render(); }

// Cronograma: interfaz (CSS grid / SVG propios). Se inserta en app.js.
// =====================================================================
// CRONOGRAMA (Gantt, PERT y Roy): las cuentas están en cronograma.js
// =====================================================================
Object.assign(AYUDA, {
  crMetodo: 'Los tres usan las mismas tareas y dependencias. Gantt dibuja barras en el tiempo; PERT trabaja con duraciones esperadas y probabilidades; Roy (método de los potenciales, MPM) muestra la red con fechas tempranas y tardías.',
  crDur: 'Duración de la tarea en días hábiles. Gantt y Roy usan este valor fijo.',
  crPert: 'PERT pide tres estimaciones: optimista (a, si todo sale bien), probable (m) y pesimista (b). Duración esperada = (a + 4m + b) ÷ 6.',
  crPre: 'Números de las tareas que tienen que terminar antes de que empiece esta, separados por coma (por ejemplo: 1, 3). Vacío si puede arrancar de entrada.',
  crPlazo: 'Cantidad de días hábiles que tenés para terminar. PERT calcula con qué probabilidad llegás (distribución normal sobre la ruta crítica).',
  crInicio: 'Fecha de arranque. Con ella, las duraciones se pasan a fechas salteando fines de semana y feriados.',
  crHolgura: 'Holgura total: cuántos días puede demorarse una tarea sin atrasar el proyecto. En la ruta crítica es 0.'
});
const crS = () => (E.cronograma = E.cronograma || { metodo: 'gantt', plazo: '', inicio: '', tareas: [] });
const crN = (id, ts) => { const i = ts.findIndex(x => x.id === id); return i < 0 ? '?' : String(i + 1); };
const crF = v => String(Math.round(v * 10) / 10).replace('.', ',');
const crFeriados = () => ((D.calendario && D.calendario.feriados) || []).map(f => f.fecha).filter(x => typeof x === 'string');
const crFecha = dias => { const c = crS(); if (!c.inicio) return ''; return Cronograma.sumarHabiles(c.inicio, dias, crFeriados()).split('-').reverse().join('/'); };

function vCronograma() {
  const c = crS(), M = c.metodo, ts = c.tareas;
  const pestana = (id, t) => `<button class="btn ${M === id ? '' : 'sec'} ch" aria-pressed="${M === id}" onclick="setCr('metodo',${arg(id)},true)">${t}</button>`;
  const usaPert = M === 'pert' || M === 'comparar';
  const fila = (x, i) => `<tr><td class="ctl"><b>${i + 1}</b></td>
    <td class="cr-nombre"><input class="nota" data-f="cr-t-${i}" aria-label="Nombre de la tarea ${i + 1}" value="${esc(x.t)}" oninput="setCrT(${i},'t',this.value)"></td>
    <td class="ctl" data-l="Días"><input class="nota" inputmode="decimal" data-f="cr-d-${i}" aria-label="Duración en días de la tarea ${i + 1}" value="${esc(x.d)}" oninput="setCrT(${i},'d',this.value)"></td>
    ${usaPert ? ['a', 'm', 'b'].map(k => `<td class="ctl" data-l="${{ a: 'Optimista', m: 'Probable', b: 'Pesimista' }[k]}"><input class="nota" inputmode="decimal" data-f="cr-${k}-${i}" aria-label="Estimación ${{ a: 'optimista', m: 'probable', b: 'pesimista' }[k]} de la tarea ${i + 1}" value="${esc(x[k])}" oninput="setCrT(${i},${arg(k)},this.value)"></td>`).join('') : ''}
    <td class="ctl" data-l="Previas"><input class="nota" data-f="cr-p-${i}" aria-label="Tareas previas de la tarea ${i + 1}" value="${esc(x.pre.map(p => crN(p, ts)).join(', '))}" placeholder="—" onchange="setCrPre(${i},this.value)"></td>
    <td class="ctl"><button class="btn lin ch" aria-label="Quitar la tarea ${i + 1}" onclick="quitarCr(${i})">✕</button></td></tr>`;
  return `<p class="u-mt0 chico tenue">Cargá las tareas de la producción de un libro, con su duración y de cuáles dependen, y mirala con tres métodos: <b>Gantt</b> (barras), <b>PERT</b> (tres estimaciones y probabilidad de llegar a tiempo) y <b>Roy</b> (red de potenciales con ruta crítica y holguras). Usá uno solo o compará los tres. Las duraciones del ejemplo son orientativas. ${ay('crMetodo')}</p>${exp('crMetodo')}
    <div class="fila u-margin-10px-0"><button class="btn sec ch" onclick="ejemploCr()">Cargar un ejemplo (libro de narrativa)</button><button class="btn sec ch" onclick="sumarCr()">+ Tarea</button><button class="btn lin ch" onclick="vaciarCr()">Vaciar</button></div>
    <div class="fila u-margin-10px-0" role="group" aria-label="Método" >${pestana('gantt', 'Gantt')}${pestana('pert', 'PERT')}${pestana('roy', 'Roy')}${pestana('comparar', 'Comparar')}</div>
    <div class="esc"><div class="esc-datos">
      <div class="tarjeta"><h3>1. Las tareas</h3>
        <div class="dos"><div class="campo-esc"><label class="c" for="cr-inicio">Fecha de inicio ${ay('crInicio')}</label>${exp('crInicio')}<input id="cr-inicio" type="date" value="${esc(c.inicio)}" onchange="setCr('inicio',this.value)"></div>
          <div class="campo-esc"><label class="c" for="cr-plazo">Plazo (días hábiles) ${ay('crPlazo')}</label>${exp('crPlazo')}<div class="con-unidad"><input id="cr-plazo" inputmode="numeric" value="${esc(c.plazo)}" placeholder="opcional" oninput="setCr('plazo',this.value)"><span>días</span></div></div></div>
        <div class="tabla-scroll"><table class="tabla cr-tareas"><thead><tr><th>N.º</th><th>Tarea</th><th>Días</th>${usaPert ? '<th title="Optimista">a</th><th title="Probable">m</th><th title="Pesimista">b</th>' : ''}<th>Previas</th><th><span class="solo-lector">Quitar</span></th></tr></thead>
        <tbody>${ts.length ? ts.map(fila).join('') : '<tr><td colspan="7" class="vacio">Sin tareas: cargá el ejemplo o sumá una.</td></tr>'}</tbody></table></div>
        <p class="chico tenue cr-ley">Qué es cada dato: <span>Días ${ay('crDur')}</span>${usaPert ? `<span>a, m y b ${ay('crPert')}</span>` : ''}<span>Previas ${ay('crPre')}</span></p>${exp('crDur')}${usaPert ? exp('crPert') + '<p class="u-mt6 chico tenue">a, m y b son opcionales: si no las cargás, PERT usa los días fijos.</p>' : ''}${exp('crPre')}</div>
    </div><div class="esc-res" id="cr-res" aria-live="polite">${crResultado()}</div></div>`;
}

function crResultado() {
  const c = crS(), M = c.metodo, ts = c.tareas;
  if (!ts.length) return '<div class="tarjeta"><p class="vacio u-padding-10px">Sumá tareas para ver el cronograma.</p></div>';
  const cmp = Cronograma.comparar(ts, c.plazo);
  if (cmp.error) return `<div class="tarjeta"><p class="u-m0 chico alerta">⚠ ${esc(cmp.error)}</p></div>`;
  const dato = (b, t) => `<div class="dato"><b>${b}</b><span>${t}</span></div>`;
  const nombres = ids => ids.map(id => `${crN(id, ts)}. ${esc((ts.find(x => x.id === id) || {}).t || '')}`).join(' → ');
  const fechaFin = d => crFecha(d) ? ` (≈ ${crFecha(d)})` : '';
  const gantt = () => {
    const r = cmp.gantt, T = r.total || 1;
    return `<div class="tarjeta"><h3>Gantt</h3><div class="pag-datos">${dato(crF(r.total), 'días hábiles en total')}${dato(r.criticas.length, 'tareas críticas')}</div>
      <p class="u-my6 chico">Termina a los <b>${crF(r.total)}</b> días${fechaFin(r.total)}.</p>
      <div class="cr-gantt" role="list">${r.tareas.map((v, i) => `<div class="cr-fila" role="listitem"><span class="cr-nom">${i + 1}. ${esc(v.t)}</span>
        <span class="cr-pista"><span class="cr-barra ${v.crit ? 'crit' : ''}" style="left:${v.es / T * 100}%;width:${Math.max(v.dur / T * 100, 0.8)}%" title="${esc(v.t)}: día ${crF(v.es)} al ${crF(v.ef)}"></span>${v.hol > 0 ? `<span class="cr-hol" style="left:${v.ef / T * 100}%;width:${v.hol / T * 100}%" title="Holgura: ${crF(v.hol)} días"></span>` : ''}</span>
        <span class="cr-dias chico tenue">${crF(v.es)}–${crF(v.ef)}</span></div>`).join('')}</div>
      <p class="u-mt8 chico tenue"><span class="cr-barra crit cr-ref"></span> Ruta crítica · <span class="cr-barra cr-ref"></span> Con holgura · <span class="cr-hol cr-ref"></span> Margen que puede demorarse ${ay('crHolgura')}</p>${exp('crHolgura')}</div>`;
  };
  // Red: columnas por nivel; cada nodo es una caja. Roy muestra fechas tempranas y tardías; PERT, duración esperada y varianza.
  const red = (r, tipo) => {
    const nv = Cronograma.niveles(ts), W = 168, H = 74, GX = 46, GY = 16, por = id => r.tareas.find(z => z.id === id);
    const cols = {}; r.tareas.forEach(v => { (cols[nv[v.id]] = cols[nv[v.id]] || []).push(v); });
    const nc = Object.keys(cols).length, filas = Math.max(...Object.values(cols).map(x => x.length));
    const pos = {}; Object.keys(cols).forEach(k => cols[k].forEach((v, j) => { pos[v.id] = { x: 10 + k * (W + GX), y: 10 + j * (H + GY) }; }));
    const ancho = 20 + nc * W + (nc - 1) * GX, alto = 20 + filas * H + (filas - 1) * GY;
    const flechas = r.tareas.flatMap(v => v.pre.map(p => {
      const a = pos[p], b = pos[v.id], crit = por(p).crit && v.crit && Math.abs(por(p).ef - v.es) < 1e-9;
      return `<path d="M${a.x + W} ${a.y + H / 2} C${a.x + W + GX / 2} ${a.y + H / 2},${b.x - GX / 2} ${b.y + H / 2},${b.x} ${b.y + H / 2}" class="cr-arco ${crit ? 'crit' : ''}" marker-end="url(#cr-fl)"/>`;
    })).join('');
    const nodos = r.tareas.map(v => {
      const p = pos[v.id], i = ts.findIndex(x => x.id === v.id) + 1;
      const l2 = tipo === 'roy'
        ? `<text x="${p.x + 8}" y="${p.y + 44}" class="cr-t2">T: ${crF(v.es)} · ${crF(v.ef)}</text><text x="${p.x + 8}" y="${p.y + 60}" class="cr-t2">L: ${crF(v.ls)} · ${crF(v.lf)} · h ${crF(v.hol)}</text>`
        : `<text x="${p.x + 8}" y="${p.y + 44}" class="cr-t2">te ${crF(v.dur)} · σ² ${crF(v.varianza)}</text><text x="${p.x + 8}" y="${p.y + 60}" class="cr-t2">${crF(v.es)} → ${crF(v.ef)} · h ${crF(v.hol)}</text>`;
      return `<g><rect x="${p.x}" y="${p.y}" width="${W}" height="${H}" rx="8" class="cr-nodo ${v.crit ? 'crit' : ''}"/><text x="${p.x + 8}" y="${p.y + 20}" class="cr-t1">${i}. ${esc(v.t.length > 22 ? v.t.slice(0, 21) + '…' : v.t)}</text>${l2}</g>`;
    }).join('');
    return `<div class="cr-red" tabindex="0" role="img" aria-label="Red de ${tipo === 'roy' ? 'Roy' : 'PERT'} con ${r.tareas.length} tareas; ruta crítica: ${esc(r.ruta.map(id => crN(id, ts)).join(', '))}"><svg viewBox="0 0 ${ancho} ${alto}" width="${ancho}" height="${alto}"><defs><marker id="cr-fl-${tipo}" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8z" class="cr-punta"/></marker></defs>${flechas.replace(/#cr-fl/g, '#cr-fl-' + tipo)}${nodos}</svg></div>`;
  };
  const roy = () => {
    const r = cmp.roy;
    return `<div class="tarjeta"><h3>Roy (potenciales)</h3><div class="pag-datos">${dato(crF(r.total), 'días hábiles en total')}${dato(r.criticas.length, 'tareas críticas')}</div>
      <p class="u-my6 chico">Ruta crítica: ${nombres(r.ruta)}.</p>${red(r, 'roy')}
      <p class="u-mt8 chico tenue">En cada caja: <b>T</b> = inicio y fin más tempranos; <b>L</b> = inicio y fin más tardíos; <b>h</b> = holgura ${ay('crHolgura')}. Las cajas y flechas resaltadas son la ruta crítica.</p>${exp('crHolgura')}</div>`;
  };
  const pert = () => {
    const r = cmp.pert, p = r.prob;
    return `<div class="tarjeta"><h3>PERT</h3><div class="pag-datos">${dato(crF(r.total), 'días esperados')}${dato(crF(r.desvio), 'desvío estándar (σ)')}${p == null ? '' : dato(Math.round(p * 100) + ' %', 'de llegar en ' + c.plazo + ' días')}</div>
      <p class="u-my6 chico">Duración esperada: <b>${crF(r.total)}</b> días${fechaFin(r.total)}. Con un 95 % de confianza, entre ${crF(Math.max(0, r.total - 2 * r.desvio))} y ${crF(r.total + 2 * r.desvio)} días.${p == null ? ' Cargá un plazo para ver la probabilidad de llegar.' : ''}</p>
      ${r.tareas.some(v => v.estimado) ? '' : '<p class="u-my6 chico alerta">⚠ Ninguna tarea tiene estimaciones a, m y b: PERT usa los días fijos y el desvío da 0. Cargalas arriba.</p>'}
      <p class="u-my6 chico">Ruta crítica: ${nombres(r.ruta)}.</p>${red(r, 'pert')}</div>`;
  };
  const comparar = () => {
    const g = cmp.gantt, ro = cmp.roy, pe = cmp.pert;
    const fila = (n, r, extra) => `<tr><td><b>${n}</b></td><td>${crF(r.total)}</td><td>${r.criticas.length}</td><td>${extra}</td></tr>`;
    return `<div class="tarjeta"><h3>Los tres, lado a lado</h3><div class="tabla-scroll"><table class="tabla"><thead><tr><th>Método</th><th>Días totales</th><th>Críticas</th><th>Qué agrega</th></tr></thead><tbody>
      ${fila('Gantt', g, 'Cuándo pasa cada cosa y qué se superpone.')}${fila('Roy', ro, 'Holguras y fechas límite de cada tarea.')}${fila('PERT', pe, `σ = ${crF(pe.desvio)} días${pe.prob == null ? '' : ', ' + Math.round(pe.prob * 100) + ' % de llegar'}.`)}</tbody></table></div>
      <p class="u-mt8 chico">${cmp.igualRutaGR ? 'Gantt y Roy coinciden: con duraciones fijas hacen la misma cuenta, solo cambia cómo se dibuja. ' : ''}${Math.abs(pe.total - g.total) > 0.05 ? `PERT da <b>${crF(pe.total)}</b> días contra <b>${crF(g.total)}</b> del Gantt: las estimaciones pesimistas pesan más que las optimistas.` : ''}</p>
      <p class="u-mt6 chico tenue">Cuándo conviene cada uno: <b>Gantt</b> para comunicar y seguir el plan; <b>Roy</b> para saber qué tareas pueden demorarse; <b>PERT</b> cuando las duraciones son inciertas (primeras tiradas, traducciones, obras nuevas).</p></div>`;
  };
  return M === 'gantt' ? gantt() : M === 'roy' ? roy() : M === 'pert' ? pert() : comparar() + gantt() + roy() + pert();
}
let crT;
function crRefrescar() { clearTimeout(crT); crT = setTimeout(guardar, 300); const r = $('#cr-res'); if (r) r.innerHTML = crResultado(); }
function setCr(k, v, todo) { crS()[k] = k === 'plazo' ? String(v).replace(/[^\d.,]/g, '').slice(0, 6) : v; crRefrescar(); if (todo) render(); }
function setCrT(i, k, v) { const x = crS().tareas[i]; if (!x) return; x[k] = k === 't' ? String(v).replace(/[<>]/g, '').slice(0, 80) : String(v).replace(/[^\d.,]/g, '').slice(0, 6); crRefrescar(); }
function setCrPre(i, v) {
  const ts = crS().tareas, x = ts[i]; if (!x) return;
  x.pre = [...new Set(String(v).split(/[,;\s]+/).map(n => ts[parseInt(n, 10) - 1]).filter(y => y && y !== x).map(y => y.id))];
  crRefrescar();
}
function sumarCr() { const ts = crS().tareas; if (ts.length >= 60) return aviso('Máximo 60 tareas'); let n = ts.length + 1; while (ts.some(x => x.id === 'T' + n)) n++; ts.push({ id: 'T' + n, t: '', d: '1', a: '', m: '', b: '', pre: [] }); guardar(); render(); }
function quitarCr(i) { const ts = crS().tareas, id = (ts[i] || {}).id; ts.splice(i, 1); ts.forEach(x => { x.pre = x.pre.filter(p => p !== id); }); guardar(); render(); }
function ejemploCr() { const c = crS(); c.tareas = Cronograma.sanear(Cronograma.EJEMPLO.map(x => ({ ...x, d: String(x.d), a: String(x.a), m: String(x.m), b: String(x.b) }))); guardar(); render(); aviso('Ejemplo cargado'); }
function vaciarCr() { E.cronograma = null; guardar(); render(); }

// =====================================================================
// GLOSARIO: términos clave de todas las materias (datos/glosario.json, armado con 104-edicion-cursada/glosario.py)
// Un término que se usa en varias materias lleva la etiqueta de cada una; si significa algo distinto en cada una, trae una acepción por materia.
// =====================================================================
async function cargarGlosario() {
  if (D.glosario || cargarGlosario.va) return;
  cargarGlosario.va = true;
  try { D.glosario = await json('glosario.json'); } catch (e) { D.glosario = { terminos: [], materias: [], error: true }; }
  if (V.tab === 'glosario') render();
}
const sinTildes = t => String(t == null ? '' : t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function glosarioFiltrado() { // índices de D.glosario.terminos
  const G = D.glosario, q = sinTildes(V.glo.q).trim(), r = [];
  G.terminos.forEach((x, i) => {
    if ((!V.glo.mat || x.materias.indexOf(V.glo.mat) >= 0)
      && (!q || sinTildes([x.t, x.sigla || '', (x.alias || []).join(' '), x.acepciones.map(a => a.def).join(' ')].join(' ')).indexOf(q) >= 0)) r.push(i);
  });
  return r;
}
const gloNombre = id => (D.glosario.materias.find(m => m.id === id) || {}).corto || id;
const gloChips = ids => ids.map(id => `<span class="chip tin" title="${esc((D.glosario.materias.find(m => m.id === id) || {}).nombre || '')}">${esc(gloNombre(id))}</span>`).join(' ');
const gloVec = () => D.glosario._v || (D.glosario._v = Grafo.vecinos(D.glosario));
const gloDisp = () => D.glosario._g || (D.glosario._g = Grafo.armar(D.glosario));
const gloEnlaces = (L, f) => L.map(j => `<button class="enlace" type="button" onclick="${f}(${j})">${esc(D.glosario.terminos[j].t)}</button>`).join(', ');
function glosarioLista() {
  const G = D.glosario, L = glosarioFiltrado(), v = gloVec();
  if (!L.length) return '<p class="vacio">No hay términos con ese filtro.</p>';
  let letra = '';
  return `<p class="u-mb8 chico tenue">${L.length} término${L.length === 1 ? '' : 's'}</p>` + L.map(i => {
    const x = G.terminos[i], rel = Grafo.juntos(v, i);
    const ini = sinTildes(x.t).charAt(0).toUpperCase(), cab = ini !== letra ? (letra = ini, `<div class="glo-letra" aria-hidden="true">${esc(ini)}</div>`) : '';
    const multi = x.acepciones.length > 1;
    return cab + `<article class="tarjeta glo" id="glo-t-${i}" tabindex="-1"><div class="fila"><h3 class="crece">${esc(x.t)}${x.sigla ? ` <span class="tenue">(${esc(x.sigla)})</span>` : ''}</h3>
      <span class="glo-tags">${gloChips(x.materias)}</span></div>
      ${multi ? `<p class="chico tenue u-margin-2px-0-6px">Significa algo distinto según la materia:</p>` : ''}
      ${x.acepciones.map((a, k) => `<p class="glo-def">${multi ? `<span class="glo-ac">${k + 1}. ${gloChips(a.materias)}</span> ` : ''}${esc(a.def)}</p>`).join('')}
      <p class="chico glo-rel">${rel.length ? `<span class="tenue">Relacionado con:</span> ${gloEnlaces(rel, 'gloIr')} · ` : ''}<button class="enlace" type="button" onclick="gloVer(${i})">Ver en el grafo</button></p></article>`;
  }).join('');
}
// Grafo: los términos son nodos y se unen cuando la definición de uno nombra al otro (datos/glosario.json, «relaciones»; lo arma glosario.py).
// La disposición sale de grafo.js; el zoom y el arrastre son los del mapa del Ecosistema (ecoSetVB y los eventos de svg.eco).
function gloGrafoHtml() {
  const G = D.glosario, g = gloDisp(), v = gloVec(), s = V.glo.sel, ok = new Set(glosarioFiltrado()), filtrando = ok.size < G.terminos.length;
  const ady = new Set(s >= 0 ? Grafo.juntos(v, s) : []), [fx, fy, W, H] = g.caja, vb = V.glo.vb || g.caja;
  const lineas = (G.relaciones || []).map(([a, b, t]) => {
    const foco = s >= 0 && (a === s || b === s), apaga = (s >= 0 && !foco) || (filtrando && !(ok.has(a) && ok.has(b)));
    return `<line class="gl-ar${t === 'v' ? ' v' : ''}${foco ? ' foco' : ''}${apaga ? ' apaga' : ''}" x1="${g.nodos[a].x}" y1="${g.nodos[a].y}" x2="${g.nodos[b].x}" y2="${g.nodos[b].y}"/>`;
  }).join('');
  const nodos = g.nodos.map((n, i) => {
    const r = +(4.5 + 1.7 * Math.sqrt(n.g)).toFixed(1), apaga = (s >= 0 && i !== s && !ady.has(i)) || (filtrando && !ok.has(i));
    const grande = i === s || ady.has(i) || n.g >= 4 || (filtrando && ok.size <= 25 && ok.has(i));
    return `<g class="gl-n c${n.m + 1}${i === s ? ' sel' : ''}${apaga ? ' apaga' : ''}" onclick="gloElegir(${i})"><circle class="gl-hit" cx="${n.x}" cy="${n.y}" r="${r + 7}"/><circle class="gl-p" cx="${n.x}" cy="${n.y}" r="${r}"/><text class="gl-t ${grande ? 'mayor' : 'menor'}" x="${n.x + r + 3}" y="${n.y + 4}">${esc(G.terminos[i].t)}</text></g>`;
  }).join('');
  const ley = G.materias.map((m, k) => `<span class="eco-ley"><svg width="12" height="12" aria-hidden="true" class="eco glo-sw"><circle cx="6" cy="6" r="5.5" class="gl-p c${k + 1}"/></svg>${esc(m.corto)}</span>`).join('');
  let panel;
  if (s < 0) panel = `<div class="tarjeta"><p class="u-mt0">Cada punto es un término y cada línea une dos términos cuando la definición de uno nombra al otro. Cuanto más conectado, más grande. Tocá un punto para ver su definición y con qué se conecta.</p>
    <p class="chico tenue u-margin-bottom-0">Las relaciones salen del texto de las definiciones: no es un mapa conceptual exhaustivo, sirve para encontrar caminos entre materias. Los términos sin líneas están en la lista.</p></div>`;
  else {
    const x = G.terminos[s], sale = v[s].sale.slice().sort((a, b) => a - b), entra = v[s].entra.slice().sort((a, b) => a - b);
    panel = `<div class="tarjeta glo" aria-live="polite"><div class="fila"><h3 class="u-m0 crece">${esc(x.t)}${x.sigla ? ` <span class="tenue">(${esc(x.sigla)})</span>` : ''}</h3><span class="glo-tags">${gloChips(x.materias)}</span></div>
      ${x.acepciones.map(a => `<p class="glo-def">${x.acepciones.length > 1 ? `<span class="glo-ac">${gloChips(a.materias)}</span> ` : ''}${esc(a.def)}</p>`).join('')}
      ${sale.length ? `<p class="chico u-margin-10px-0-2px"><span class="tenue">Su definición nombra a:</span> ${gloEnlaces(sale, 'gloElegir')}</p>` : ''}
      ${entra.length ? `<p class="chico u-margin-6px-0-2px"><span class="tenue">Lo nombran:</span> ${gloEnlaces(entra, 'gloElegir')}</p>` : ''}
      ${!sale.length && !entra.length ? '<p class="chico tenue">Ninguna definición lo nombra y él no nombra a otro término.</p>' : ''}
      <div class="botones"><button class="btn lin ch" type="button" onclick="gloIr(${s})">Ver en la lista</button><button class="btn lin ch" type="button" onclick="gloElegir(${s})">Quitar la selección</button></div></div>`;
  }
  return `<div class="eco-scroll"><div class="eco-zoom" role="group" aria-label="Zoom del grafo">
      <button class="btn lin ch" type="button" onclick="ecoZoom(1.4)" aria-label="Acercar">＋</button><button class="btn lin ch" type="button" onclick="ecoZoom(1/1.4)" aria-label="Alejar">－</button><button class="btn lin ch" type="button" onclick="ecoAjustar()" aria-label="Ver todo el grafo">⤢</button></div>
    <svg class="eco glo-g ${vb[2] < W - 1 ? 'zoom' : ''}" viewBox="${vb.map(n => +n.toFixed(1)).join(' ')}" data-k="glo" data-z="${vb[2] < W * 0.45 ? 2 : vb[2] < W - 1 ? 1 : 0}" data-fx="${fx}" data-fy="${fy}" data-fw="${W}" data-fh="${H}" aria-hidden="true">${lineas}${nodos}</svg></div>
    <p class="u-mb6 chico tenue">Acercá con ＋ o pellizcando para ver más nombres; arrastrá para moverte (⤢ vuelve a ver todo). La lista tiene lo mismo: cada término trae su «Relacionado con».</p>
    <div class="eco-leyendas">${ley}</div>${panel}`;
}
function glosarioCuerpo() { return V.glo.vista === 'grafo' ? gloGrafoHtml() : glosarioLista(); }
function gloElegir(i) { if (ecoArrastro) { ecoArrastro = false; return; } V.glo.sel = V.glo.sel === i ? -1 : i; render(); }
function gloVista(vista) { V.glo.vista = vista; V.glo.vb = null; render(); }
function gloVer(i) { V.glo.vista = 'grafo'; V.glo.sel = i; V.glo.vb = null; V.glo.q = ''; V.glo.mat = ''; render(); window.scrollTo(0, 0); }
function gloIr(i) { // salta a un término en la lista (saca los filtros para que esté)
  V.glo.vista = 'lista'; V.glo.q = ''; V.glo.mat = ''; render();
  const el = document.getElementById('glo-t-' + i); if (el) { el.scrollIntoView({ block: 'start' }); el.focus({ preventScroll: true }); }
}
function vGlosario() {
  if (!D.glosario) { cargarGlosario(); return '<p class="cargando">Cargando el glosario…</p>'; }
  const G = D.glosario;
  if (!G.terminos.length) return '<p class="vacio">No se pudo cargar el glosario. <button class="btn sec" type="button" onclick="location.reload()">Probar de nuevo</button></p>';
  const mats = [{ id: '', corto: 'Todas' }].concat(G.materias), vista = V.glo.vista === 'grafo' ? 'grafo' : 'lista';
  return `<p class="u-mt0 chico tenue">Los términos clave de cada materia, para buscar rápido. Si una palabra se usa en más de una materia, aparece con la etiqueta de cada una; si significa algo distinto en cada una, se separan las acepciones. Armado a partir de mis apuntes.</p>
    <div class="u-mb10 eligen" role="group" aria-label="Cómo ver el glosario"><button class="btn ${vista === 'lista' ? '' : 'lin'} ch" type="button" aria-pressed="${vista === 'lista'}" data-f="glo-vista-lista" onclick="gloVista('lista')">Lista</button><button class="btn ${vista === 'grafo' ? '' : 'lin'} ch" type="button" aria-pressed="${vista === 'grafo'}" data-f="glo-vista-grafo" onclick="gloVista('grafo')">Grafo de conceptos</button></div>
    <div class="u-mb10 eligen" role="group" aria-label="Filtrar por materia">${mats.map(m => `<button class="btn ${V.glo.mat === m.id ? '' : 'lin'} ch" aria-pressed="${V.glo.mat === m.id}" data-f="glo-${esc(m.id)}" title="${esc(m.nombre || '')}" onclick="V.glo.mat=${arg(m.id)};render()">${esc(m.corto)}</button>`).join('')}</div>
    <label class="solo-lector" for="glo-q">Buscar un término</label>
    <input id="glo-q" maxlength="100" type="search" autocomplete="off" placeholder="Buscar un término o parte de su definición" value="${esc(V.glo.q)}" class="u-width-100_margin-bottom-12px" oninput="V.glo.q=this.value;$('#glo-lista').innerHTML=glosarioCuerpo()">
    <div id="glo-lista">${glosarioCuerpo()}</div>`;
}

// =====================================================================
// DIRECTORIO: editoriales, imprentas, distribuidoras y librerías (datos/directorio.json; cada ficha lleva su fuente y la fecha en que se leyó)
// Los datos se bajan con 104-edicion-cursada/directorio_fuentes.py. Nunca hay domicilios de particulares ni correos.
// =====================================================================
async function cargarDirectorio() {
  if (D.directorio || cargarDirectorio.va) return;
  cargarDirectorio.va = true;
  try { D.directorio = await json('directorio.json'); } catch (e) { D.directorio = { actores: [], tipos: [], error: true }; }
  if (V.tab === 'directorio') render();
}
// Mapa de provincias: los trazos están en mapa-ar.js (lo genera 104-edicion-cursada/mapa_provincias.py desde Wikimedia Commons, CC BY-SA 3.0).
const nombreProv = p => ({ 'Ciudad Autónoma de Buenos Aires': 'CABA' })[p] || p;
// Inicial para el índice A–Z del Directorio: sin tildes ni signos; lo que no empieza con letra va a «#».
const inicialDir = a => { const c = sinTildes(a.n).replace(/[^a-z0-9]/g, '').charAt(0).toUpperCase(); return /[A-Z]/.test(c) ? c : '#'; };
const actoresDelTipo = () => D.directorio.actores.filter(a => a.tipo === V.dir.tipo);
function directorioFiltrado(sinProv) {
  const q = sinTildes(V.dir.q).trim();
  return actoresDelTipo().filter(a => (sinProv || !V.dir.prov || a.provincia === V.dir.prov) && (!V.dir.linea || (a.linea || []).indexOf(V.dir.linea) >= 0) && (!V.dir.web || a.web) && (!V.dir.letra || inicialDir(a) === V.dir.letra)
    && (!q || sinTildes([a.n, a.provincia, a.localidad || '', (a.linea || []).join(' '), (a.servicios || []).join(' '), (a.ferias || []).join(' ')].join(' ')).indexOf(q) >= 0));
}
function directorioLista() {
  const L = directorioFiltrado(), t = (D.directorio.tipos.find(x => x.id === V.dir.tipo) || {}).t || '';
  const sumar = `<button class="dir-sumar" type="button" onclick="sugerirActor()"><span>¿Falta alguien?<b>Sugerí un actor.</b></span></button>`;
  if (!L.length) return `<p class="vacio">${actoresDelTipo().length ? 'No hay fichas con ese filtro.' : esc(t) + ': todavía no hay fichas cargadas.'}</p><div class="dir-grilla">${sumar}</div>`;
  const tope = V.dir.n || 60, vis = L.slice(0, tope);
  const mas = L.length > tope ? `<p class="u-margin-12px-0"><button class="btn sec" type="button" onclick="V.dir.n=${tope + 120};$('#dir-lista').innerHTML=directorioLista()">Mostrar más (${L.length - tope} restantes)</button></p>` : '';
  return `<p class="u-mb8 chico tenue" aria-live="polite">${L.length} ficha${L.length === 1 ? '' : 's'}</p><div class="dir-grilla">${sumar}${vis.map(a => {
    const lin = a.linea || [], f = a.fuente || (D.directorio.fuentes || {})[a.fx] || {};
    return `<article class="tarjeta dir"><div class="fila"><h3 class="crece">${esc(a.n)}</h3>${a.provincia ? `<span class="chip tin">${esc(nombreProv(a.provincia))}</span>` : ''}</div>
      ${a.localidad ? `<p class="chico tenue u-margin-2px-0-0">${esc(a.localidad)}</p>` : ''}
      ${(a.ferias || []).length ? `<p class="chico tenue u-margin-2px-0-0">Estuvo en la ${esc(a.ferias.join(' y '))}</p>` : ''}
      ${lin.length ? `<p class="u-my6 glo-tags">${lin.slice(0, 4).map(x => `<span class="chip">${esc(x)}</span>`).join(' ')}${lin.length > 4 ? ` <span class="chip" title="${esc(lin.slice(4).join(', '))}">+${lin.length - 4}</span>` : ''}</p>` : ''}
      ${(a.servicios || []).length ? `<p class="u-mb6 chico tenue">Servicios: ${esc(a.servicios.join(', '))}</p>` : ''}
      <p class="u-m0 chico">${a.web ? `<a href="${urlSegura(a.web)}" target="_blank" rel="noopener">Sitio ↗</a> · ` : ''}${f.url ? `<a href="${urlSegura(f.url)}" target="_blank" rel="noopener">Fuente ↗</a>` : ''}${f.fecha ? ` <span class="tenue">(leída el ${esc(f.fecha.split('-').reverse().join('/'))})</span>` : ''}</p></article>`;
  }).join('')}</div>${mas}`;
}
// Los trazos del mapa pesan 50 KB y solo los usa el Directorio: se bajan la primera vez que se abre.
let mapaPidiendo = false;
function cargarMapa() {
  if (mapaPidiendo) return; mapaPidiendo = true;
  const s = document.createElement('script'); s.src = 'mapa-ar.js?v=1';
  s.onload = () => { const el = $('#dir-mapa'); if (el) el.innerHTML = directorioMapa(); };
  s.onerror = () => { mapaPidiendo = false; const el = $('#dir-mapa'); if (el) el.innerHTML = '<p class="chico tenue">No pudimos cargar el mapa. Podés filtrar por provincia con la lista.</p>'; };
  document.head.appendChild(s);
}
function directorioMapa() {
  if (typeof MAPA_AR === 'undefined') { cargarMapa(); return '<p class="chico tenue" role="status">Cargando el mapa…</p>'; }
  const cuenta = {}; directorioFiltrado(true).forEach(a => { if (a.provincia) cuenta[a.provincia] = (cuenta[a.provincia] || 0) + 1; });
  const M = MAPA_AR;
  return `<figure class="dir-fig"><svg class="dir-mapa" viewBox="${M.vb.join(' ')}" role="group" aria-label="Mapa de provincias: tocá una para filtrar">${Object.keys(M.prov).map(p => {
    const n = cuenta[p] || 0, sel = V.dir.prov === p, c = M.cen[p];
    return `<g class="${sel ? 'sel' : n ? 'con' : 'sin'}" role="button" tabindex="0" aria-pressed="${sel}" aria-label="${esc(p)}: ${n} ficha${n === 1 ? '' : 's'}" data-f="dir-${esc(p)}"
      onclick="V.dir.prov=${arg(sel ? '' : p)};V.dir.n=0;render()" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();V.dir.prov=${arg(sel ? '' : p)};V.dir.n=0;render()}">
      <title>${esc(nombreProv(p))}: ${n}</title><path d="${M.prov[p]}"/>${n ? `<text x="${c[0]}" y="${c[1] + 5}" text-anchor="middle">${n}</text>` : ''}</g>`;
  }).join('')}</svg><figcaption class="chico tenue">Mapa: <a href="https://commons.wikimedia.org/wiki/File:Argentina_politico.svg" target="_blank" rel="noopener">Wikimedia Commons</a> (CC BY-SA 3.0), recoloreado.</figcaption></figure>`;
}
function vDirectorio() {
  if (!D.directorio) { cargarDirectorio(); return '<p class="cargando">Cargando el directorio…</p>'; }
  const Dd = D.directorio;
  if (!Dd.actores.length) return '<p class="vacio">No se pudo cargar el directorio. <button class="btn sec" type="button" onclick="location.reload()">Probar de nuevo</button></p>';
  const tipo = Dd.tipos.find(x => x.id === V.dir.tipo) || Dd.tipos[0];
  const lineas = [...new Set(actoresDelTipo().flatMap(a => a.linea || []))].sort((a, b) => a.localeCompare(b, 'es'));
  const letras = [...new Set(actoresDelTipo().map(inicialDir))].sort();
  const provs = [...new Set(actoresDelTipo().map(a => a.provincia).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  return `<p class="u-mt0 chico tenue">${esc(Dd.nota)}</p>
    <div class="u-mb10 eligen" role="group" aria-label="Tipo de actor">${Dd.tipos.map(t => `<button class="btn ${V.dir.tipo === t.id ? '' : 'lin'} ch" aria-pressed="${V.dir.tipo === t.id}" data-f="dirt-${esc(t.id)}" onclick="V.dir={tipo:${arg(t.id)},q:'',prov:'',linea:'',web:false,letra:''};render()">${esc(t.t)} (${Dd.actores.filter(a => a.tipo === t.id).length})</button>`).join('')}</div>
    <p class="chico aviso-cob"><b>Cobertura.</b> ${esc(tipo.cobertura)}</p>
    <div class="dir-cab">
      <div class="dir-filtros">
        <label class="solo-lector" for="dir-q">Buscar por nombre o línea</label>
        <input id="dir-q" type="search" autocomplete="off" placeholder="Buscar por nombre o línea" value="${esc(V.dir.q)}" oninput="V.dir.q=this.value;V.dir.n=0;$('#dir-lista').innerHTML=directorioLista();$('#dir-mapa').innerHTML=directorioMapa()">
        ${lineas.length ? `<label class="solo-lector" for="dir-linea">Línea</label><select id="dir-linea" onchange="V.dir.linea=this.value;V.dir.n=0;render()"><option value="">Todas las líneas</option>${lineas.map(l => `<option value="${esc(l)}" ${V.dir.linea === l ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>` : ''}
        ${provs.length > 1 ? `<label class="solo-lector" for="dir-prov">Provincia</label><select id="dir-prov" onchange="V.dir.prov=this.value;V.dir.n=0;render()"><option value="">Todo el país</option>${provs.map(p => `<option value="${esc(p)}" ${V.dir.prov === p ? 'selected' : ''}>${esc(nombreProv(p))}</option>`).join('')}</select>` : ''}
        ${letras.length > 1 && actoresDelTipo().length > 60 ? `<div class="dir-letras" role="group" aria-label="Ir a la letra">${letras.map(l => `<button type="button" class="${V.dir.letra === l ? 'on' : ''}" aria-pressed="${V.dir.letra === l}" onclick="V.dir.letra=${arg(V.dir.letra === l ? '' : l)};V.dir.n=0;render()">${l}</button>`).join('')}</div>` : ''}
        <label class="dir-web"><input type="checkbox" ${V.dir.web ? 'checked' : ''} onchange="V.dir.web=this.checked;V.dir.n=0;render()"> Solo las que tienen sitio web</label>
        ${(V.dir.prov || V.dir.linea || V.dir.web || V.dir.q || V.dir.letra) ? `<button class="btn lin ch" type="button" onclick="V.dir={tipo:V.dir.tipo,q:'',prov:'',linea:'',web:false,letra:''};render()">Limpiar filtros ✕</button>` : ''}
      </div>
      <div id="dir-mapa">${directorioMapa()}</div>
    </div>
    <div id="dir-lista">${directorioLista()}</div>`;
}
function sugerirActor() {
  const t = ({ editorial: 'una editorial', imprenta: 'una imprenta', distribuidora: 'una distribuidora', libreria: 'una librería', papel: 'un productor de papel' })[V.dir.tipo] || 'un actor';
  idea({ titulo: '🗂️ Sugerir ' + t, intro: 'Contame el nombre, la provincia y el sitio web o la red pública donde figura. Solo datos de empresas o proyectos públicos: nada de domicilios ni teléfonos de particulares.',
    ejemplo: 'Ej.: «Editorial tal», Rosario, Santa Fe, sitio…', prefijo: '[Directorio] ' });
}

// =====================================================================
// LINKS ÚTILES y SUGERENCIAS
// =====================================================================
// CÓMO SE SOSTIENE: horas de trabajo, costos, cómo ayudar y el plan público.
// Datos: datos/sostener.json (lo cuenta .github/scripts/cursada_sostener.py cada lunes desde los commits), datos/sostener-costos.json (a mano)
// y datos/plan.json (el plan, agrupado por etapa). Nada de esto se escribe acá: esta pantalla solo lo dibuja.
// =====================================================================
async function cargarSostener() {
  if (D.sostener || cargarSostener.va) return;
  cargarSostener.va = true;
  const leer = a => json(a).catch(() => null);
  const [horas, costos, plan, claude] = await Promise.all([leer('sostener.json'), leer('sostener-costos.json'), leer('plan.json'), leer('sostener-claude.json')]);
  D.sostener = { horas, costos, plan, claude };
  if (V.tab === 'sostener') render();
}
const ESTADO_PLAN = { planeado: ['Planeado', 'tin'], 'en curso': ['En curso', 'mos'], listo: ['Listo', 'ok'] };
const MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const horasTxt = h => String(h).replace('.', ',') + (Number(h) === 1 ? ' hora' : ' horas');
function sostenerHoras(H, R) {
  if (!H || typeof H.horas_totales !== 'number') return '<p class="chico tenue">Las horas no se pudieron cargar ahora. Probá de nuevo más tarde.</p>';
  const meses = Object.entries(H.horas_por_mes || {}).map(([m, h]) => { const [a, n] = m.split('-'); return `<li>${esc(MESES_ES[Number(n) - 1] || m)} de ${esc(a)}: ${esc(horasTxt(h))}</li>`; }).join('');
  const rango = R && R.minimo > 0 && R.maximo >= R.minimo;
  const cabeza = rango
    ? `<p class="u-font-size-1-5rem_margin-0"><b>Entre ${esc(R.minimo)} y ${esc(R.maximo)} horas</b></p>
    <p class="chico tenue u-margin-2px-0-8px">de trabajo desde el ${esc(fmtLarga(H.primer_commit))}; lo más probable, unas ${esc(R.central)}. Actualizado el ${esc(fmtLarga(R.generado))}.</p>`
    : `<p class="u-font-size-1-5rem_margin-0"><b>${esc(horasTxt(H.horas_totales))}</b></p>
    <p class="chico tenue u-margin-2px-0-8px">de trabajo desde el ${esc(fmtLarga(H.primer_commit))}, en ${esc(H.sesiones)} sesiones. Actualizado el ${esc(fmtLarga(H.generado))}.</p>`;
  const nota = rango
    ? `<p class="u-m0 chico tenue">Cómo se cuenta: junto en una sola línea de tiempo cada cambio guardado en Galera y la hora de cada mensaje de mis sesiones de trabajo con Claude (solo la hora, nunca el contenido), y cuento una sesión mientras no pasen más de 10, 20 o 45 minutos sin actividad (más unos minutos de arranque). De ahí salen el mínimo, el valor central y el máximo. Es una estimación y no incluye el tiempo fuera de la pantalla, como pensar o probar en el celular. Solo con los cambios guardados, que cualquiera puede verificar en el <a href="https://github.com/Ficha/Ficha.github.io/commits/main/cursada" target="_blank" rel="noopener">historial público</a>, son ${esc(horasTxt(H.horas_totales))} (sesiones de hasta dos horas entre cambios, más 30 minutos de arranque).</p>`
    : `<p class="u-m0 chico tenue">Cómo se cuenta: se toman todos los cambios que se guardaron en Galera y se juntan en sesiones (si entre un cambio y el siguiente pasaron menos de dos horas, es la misma sesión). A cada sesión se le suman 30 minutos de arranque. Es una estimación, y cualquiera puede verificarla en el <a href="https://github.com/Ficha/Ficha.github.io/commits/main/cursada" target="_blank" rel="noopener">historial público</a>.</p>`;
  return `${cabeza}
    ${rango ? '' : (meses ? `<ul class="chico u-margin-0-0-8px_padding-left-18px">${meses}</ul>` : '')}
    ${nota}`;
}
function sostenerCostos(C) {
  if (!C || !Array.isArray(C.items)) return '<p class="chico tenue">Los costos no se pudieron cargar ahora.</p>';
  return `<ul class="lista-costos">${C.items.map(i => `<li><span>${esc(i.t)}${i.nota ? `<small class="tenue"> (${esc(i.nota)})</small>` : ''}</span><b>${i.monto == null ? 'a calcular' : esc(i.monto)}</b></li>`).join('')}</ul>
    ${C.actualizado ? `<p class="u-mt8 chico tenue">Actualizado el ${esc(fmtLarga(C.actualizado))}.</p>` : ''}`;
}
function sostenerPlan(P) {
  if (!P || !Array.isArray(P.etapas)) return '';
  return `<div class="titulo-sec"><h2>Tu ayuda me permitiría seguir con este plan:</h2></div>` + P.etapas.map(e => `<div class="tarjeta"><h3 class="u-mb6">${esc(e.t)}</h3>
    ${(e.items || []).map(i => { const [t, c] = ESTADO_PLAN[i.estado] || ESTADO_PLAN.planeado; return `<div class="plan-item"><div class="crece"><b>${esc(i.t)}</b><p class="chico tenue u-margin-2px-0-0">${esc(i.d)}</p></div><span class="chip ${c}">${t}</span></div>`; }).join('')}</div>`).join('');
}
function vSostener() {
  if (!D.sostener) { cargarSostener(); return '<p class="cargando">Cargando…</p>'; }
  const S = D.sostener, fila = (t, v) => `<div class="donar-fila"><span class="chico tenue">${t}</span><code>${esc(v)}</code><button class="btn sec" type="button" onclick="copiar(${arg(v)})">Copiar</button></div>`;
  return `<div class="titulo-sec"><h2>Cómo se sostiene Galera</h2></div>
    <p class="capital">Galera es gratis, no pide cuenta y no tiene publicidad. La hago yo, Fidel, estudiante de Edición, y esta pantalla cuenta cuánto trabajo lleva, cuánto cuesta y cómo ayudar si querés.</p>
    <div class="titulo-sec"><h2>Horas de trabajo</h2></div><div class="tarjeta">${sostenerHoras(S.horas, S.claude)}</div>
    <div class="titulo-sec"><h2>Costos</h2></div><div class="tarjeta">${sostenerCostos(S.costos)}
      <p class="u-margin-12px-0-0">Con más apoyo podría pagar un plan superior de Claude y avanzar más frentes por semana.</p></div>
    <div class="titulo-sec"><h2>Cómo ayudar</h2></div><div class="tarjeta">
      <p class="u-mt0">Si Galera te sirve, podés transferir lo que quieras desde cualquier banco o billetera: sin comisión y llega al instante.</p>
      ${DONAR.alias ? fila('Alias', DONAR.alias) : ''}${DONAR.cvu ? fila('CVU', DONAR.cvu) : ''}
      <div class="donar-fila"><span class="chico tenue">Cafecito</span><code>cafecito.app/fidelchaves</code><a class="btn sec" href="${urlSegura(DONAR.cafecito)}" target="_blank" rel="noopener">Abrir</a></div>
      <p class="chico u-margin-12px-0-0">¿Querés ayudar de otra forma? <a href="mailto:${CONTACTO}?subject=${encodeURIComponent('Galera: quiero ayudar')}">Escribime</a>.</p></div>
    ${sostenerPlan(S.plan)}`;
}

// =====================================================================
// NOVEDADES: el registro completo de lo que se fue publicando (datos/novedades.json, el mismo que arma el mail de los lunes).
async function cargarNovedades() {
  if (D.novedades || cargarNovedades.va) return;
  cargarNovedades.va = true;
  try { D.novedades = await json('novedades.json'); } catch (e) { D.novedades = { novedades: [], error: true }; }
  if (V.tab === 'novedades' || V.tab === 'inicio') render();
}
// PEDIDOS: lo que se pidió por 💡, resumido y sin datos personales (datos/pedidos.json lo baja cursada_datos.py de la planilla del buzón).
async function cargarPedidos() {
  if (D.pedidos || cargarPedidos.va) return;
  cargarPedidos.va = true;
  try { D.pedidos = await json('pedidos.json'); } catch (e) { D.pedidos = { pedidos: [], error: true }; }
  if (V.tab === 'novedades') render();
}
const ESTADO_PEDIDO = { nuevo: ['Recibido', ''], proceso: ['En proceso', 'mos'], hecho: ['Hecho', 'ok'], no: ['No por ahora', 'tin'] };
function verNov(modo) { V.nov = modo; history.replaceState(null, '', '#' + hashActual()); render(); }
function verVersionNov(v) {
  V.nov = ''; history.replaceState(null, '', '#' + hashActual()); render();
  const el = document.getElementById('nov-v' + v); if (el) el.scrollIntoView({ block: 'start' });
}
// Cada novedad lleva su perfil: estudiante (por defecto), profesional o todos. Cada perfil ve las suyas y las de todos.
const perfilNovVisible = x => { const p = x.perfil || 'estudiante'; return p === 'todos' || p === (esPro() ? 'profesional' : 'estudiante'); };
const filtroNov = () => `<p class="u-mt0 botones" role="group" aria-label="Qué ver en Novedades">${[['', 'Todo'], ['pedidos', 'Lo que pidieron']].map(([k, t]) =>
  `<button class="btn ch ${V.nov === k ? '' : 'lin'}" aria-pressed="${V.nov === k}" onclick="verNov(${arg(k)})">${t}</button>`).join('')}</p>`;
function vPedidos() {
  if (!D.pedidos || !D.novedades) { cargarPedidos(); cargarNovedades(); return '<p class="cargando">Cargando los pedidos…</p>'; }
  if (D.pedidos.error) return '<p class="vacio">No pude cargar esto. Puede ser la conexión. <button class="btn sec" type="button" onclick="location.reload()">Probar de nuevo</button></p>';
  const vers = new Set(D.novedades.novedades.map(x => x.v)), orden = { nuevo: 0, proceso: 0, hecho: 1, no: 2 };
  const L = D.pedidos.pedidos.filter(p => ESTADO_PEDIDO[p.estado]).sort((a, b) => (orden[a.estado] - orden[b.estado]) || (a.fecha < b.fecha ? 1 : -1));
  const tarjeta = p => { const [t, c] = ESTADO_PEDIDO[p.estado];
    return `<div class="tarjeta nov-item"><p class="u-m0">${esc(p.resumen)}</p>
      <p class="u-mt8 chico tenue"><span class="chip ${c}">${t}</span> · Pedido el ${fmtLarga(p.fecha)}${p.estado === 'hecho' && Number.isInteger(p.v) && vers.has(p.v) ? ` · <a href="#novedades" onclick="verVersionNov(${arg(p.v)}); return false">Salió en v${p.v} →</a>` : ''}</p></div>`; };
  return `<p class="u-mt0 chico tenue">Lo que se pidió con 💡 Contame qué falta, resumido y sin datos de quien lo mandó: primero lo que sigue pendiente, después lo que ya salió.</p>
    <p class="u-mt0 botones"><button class="btn lin ch" onclick="idea()">💡 Pedir algo</button></p>` +
    (L.length ? L.map(tarjeta).join('') : '<p class="vacio">Todavía nadie pidió nada. Estrenalo vos.</p>');
}
function vNovedades() {
  if (V.nov === 'pedidos') return filtroNov() + vPedidos();
  cargarPedidos();   // para marcar en cada novedad los pedidos que respondió (el vínculo vive en pedidos.json: estado hecho + v)
  if (!D.novedades) { cargarNovedades(); return filtroNov() + '<p class="cargando">Cargando las novedades…</p>'; }
  if (D.novedades.error) return filtroNov() + '<p class="vacio">No pude cargar esto. Puede ser la conexión. <button class="btn sec" type="button" onclick="location.reload()">Probar de nuevo</button></p>';
  const N = D.novedades.novedades.filter(x => Number.isInteger(x.v) && perfilNovVisible(x)), vers = [...new Set(N.map(x => x.v))].sort((a, b) => b - a);
  const tema = Object.fromEntries(TEMAS_NOV.map(([k, t]) => [k, t.split(' ')[0]]));
  const hechos = (D.pedidos && D.pedidos.pedidos || []).filter(p => p.estado === 'hecho' && Number.isInteger(p.v));
  const tarjeta = x => `<div class="nov-item"><h3 class="nov-t">${esc(x.titulo)}</h3>
    ${x.texto ? `<p class="u-mt6 nov-tx">${esc(x.texto)}</p>` : ''}
    ${hechos.filter(p => p.v === x.v).map(p => `<p class="u-mt6 chico"><span class="chip ok">Lo pidieron</span> «${esc(p.resumen)}» <a href="#novedades/pedidos" onclick="verNov('pedidos'); return false">Ver pedidos →</a></p>`).join('')}
    <p class="u-mt8 chico tenue">${tema[x.tipo] || ''} ${esc((TEMAS_NOV.find(t => t[0] === x.tipo) || ['', ''])[1].replace(/^\S+\s/, ''))}${x.para ? ' · Para: ' + esc(x.para) : ''}${enlaceNov(x.url)}</p></div>`;
  return filtroNov() + `<div class="nov-pag"><aside class="nov-lado tarjeta"><p class="nov-rot">Mail de los lunes</p><p class="u-mt0">Todo lo que se fue sumando a Galera, desde la primera versión hasta hoy. Es lo mismo que te llega por mail los lunes. Sin cuenta.</p>
    <p class="botones"><button class="btn ch" onclick="avisame()">Avisame por mail</button><button class="btn lin ch" onclick="idea()">Pedir algo</button></p></aside><section class="nov-lista" aria-label="Versiones">` +
    vers.map(v => { const L = N.filter(x => x.v === v).sort((a, b) => a.fecha < b.fecha ? 1 : -1);
      return `<article class="nov-fila" id="nov-v${v}"><div class="nov-ver"><b>v${v}</b>${v === vers[0] ? ' <span class="chip ok">última</span>' : ''}<span>${fmtLarga(L[0].fecha)}</span></div><div>${L.map(tarjeta).join('')}</div></article>`; }).join('') + '</section></div>';
}
const enlaceNov = u => { const r = typeof u === 'string' && /^https:\/\/ficha\.github\.io\/cursada\/(#[a-z]+)?$/.test(u) ? u.replace(/^https:\/\/ficha\.github\.io\/cursada\//, '') : ''; return r && r !== '#donar' ? ` · <a href="${esc(r)}">Verlo en Galera →</a>` : ''; };
const fmtLarga = s => { const d = fecha(s); return d.getDate() + ' de ' + MESES_LARGO[d.getMonth()] + ' de ' + d.getFullYear(); };
const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

async function cargarLinksLibro() {
  if (D.linksLibro || cargarLinksLibro.va) return;
  cargarLinksLibro.va = true;
  try { D.linksLibro = await json('links-libro.json'); } catch (e) { D.linksLibro = { grupos: [], error: true }; }
  if (V.tab === 'links') render();
}
function vLinksPro() {
  if (!D.linksLibro) { cargarLinksLibro(); return '<p class="cargando">Cargando los links…</p>'; }
  if (D.linksLibro.error) return '<p class="vacio">No pude cargar esto. Puede ser la conexión. <button class="btn sec" type="button" onclick="location.reload()">Probar de nuevo</button></p>';
  return `<p class="chico tenue">Los sitios oficiales que más se usan para registrar, informarse y moverse en el sector del libro. Si falta alguno, avisame con «Contame qué falta».</p>` +
    D.linksLibro.grupos.map(g => `<div class="titulo-sec"><h2>${esc(g.grupo)}</h2></div><div class="tarjeta u-padding-6px-16px">
      ${g.links.map(l => `<a class="evento u-text-decoration-none_color-inherit" href="${urlSegura(l.url)}" target="_blank" rel="noopener"><span class="crece"><b class="u-color-var-tinta">${esc(l.t)} ↗</b>
        ${l.d ? `<span class="chico tenue u-display-block">${esc(l.d)}</span>` : ''}</span></a>`).join('')}</div>`).join('') +
    `<div class="titulo-sec"><h2>En Galera</h2></div><div class="tarjeta u-padding-6px-16px">
      <a class="evento u-text-decoration-none_color-inherit" href="#simuladores/leyes" onclick="irSim('leyes'); return false"><span class="crece"><b class="u-color-var-tinta">Leyes del libro</b><span class="chico tenue u-display-block">La pirámide de normas y el traductor jurídico.</span></span></a>
      <a class="evento u-text-decoration-none_color-inherit" href="#simuladores/contratos" onclick="irSim('contratos'); return false"><span class="crece"><b class="u-color-var-tinta">Contratos modelo</b><span class="chico tenue u-display-block">Borrador de contrato de traducción o de edición, con la fuente de cada cláusula.</span></span></a>
      <a class="evento u-text-decoration-none_color-inherit" href="libro/cronograma/"><span class="crece"><b class="u-color-var-tinta">Planificador de libros</b><span class="chico tenue u-display-block">Del original a la reimpresión, con Gantt, PERT y Roy.</span></span></a></div>` +
    (D.linksLibro.verificado ? `<p class="chico tenue verificado">✓ Links revisados el ${fmt(D.linksLibro.verificado)}.</p>` : '');
}
function vLinks() {
  if (esPro()) return vLinksPro();
  const G = D.plan.guia;
  return (G ? `<div class="titulo-sec"><h2>Lo básico de la cursada</h2></div><div class="tarjeta guia">${G.items.map(i => `<details><summary>${esc(i.t)}</summary><p class="chico">${esc(i.d)}</p></details>`).join('')}
    <p class="chico tenue u-margin-10px-0-0">${esc(G.fuente)}</p></div>` : '') +
    `<p class="chico tenue">Los sitios oficiales que más se usan durante la cursada. Si falta alguno, avisame con «Contame qué falta».</p>` +
    `<div class="links-g3">${(D.plan.links || []).map(g => `<div class="tarjeta u-padding-6px-16px"><p class="nov-rot">${esc(g.grupo)}</p>
      ${g.links.map(l => `<a class="evento u-text-decoration-none_color-inherit" href="${urlSegura(l.url)}" target="_blank" rel="noopener"><span class="crece"><b class="u-color-var-tinta">${esc(l.t)} ↗</b>
        ${l.d ? `<span class="chico tenue u-display-block">${esc(l.d)}</span>` : ''}</span></a>`).join('')}</div>`).join('')}</div>` +
    (D.plan.verificado ? `<p class="chico tenue verificado">✓ Links revisados el ${fmt(D.plan.verificado)}.</p>` : '');
}
// El sitio es estático: la sugerencia va a un buzón aparte (un Apps Script, ver 104-edicion-cursada/sugerencias)
// que filtra bots y la anota en una planilla de Fidel. No viaja ningún dato de notas ni de horarios.
// Misma regla que RE_MAIL en sugerencias/Novedades.gs (el servidor vuelve a validar: esto es solo para avisar rápido).
const RE_MAIL = /^[^\s@<>"',;:()\[\]\\]{1,64}@[^\s@<>"',;:()\[\]\\]{1,100}\.[^\s@<>"',;:()\[\]\\]{2,20}$/;
const mailValido = m => typeof m === 'string' && m.length <= 120 && RE_MAIL.test(m);
const BUZON = 'https://script.google.com/macros/s/AKfycby-TbCIhqczXLYYUZXjagKyphO9sNYmZvTakpeUW_iI3lqSmahk_nUjBLJMBpFDkW5m/exec';
let ideaAbierta = 0, ideaPrefijo = '';
// El mismo buzón sirve para todo: o (opcional) cambia el título, la explicación, el ejemplo y un prefijo para el texto.
function idea(o) {
  o = o && typeof o === 'object' ? o : {};
  ideaAbierta = Date.now(); ideaPrefijo = o.prefijo || '';
  abrir(cab(esc(o.titulo || '💡 Contame qué falta')) + `<p class="u-mt0 chico tenue">${esc(o.intro || '¿Falta algo, hay un dato viejo o un error? ¿Se te ocurre una mejora? Escribilo y listo.')}</p>
    <textarea id="i-t" aria-label="Tu sugerencia" maxlength="2000" class="u-min-height-130px" placeholder="${esc(o.ejemplo || 'Ej.: cambió el horario de la comisión 3 de Corrección; estaría bueno poder…')}"></textarea>
    <input id="i-c" aria-label="Tu mail (opcional)" class="u-width-100_margin-top-8px" maxlength="120" type="email" placeholder="Tu mail, solo si querés que te responda (opcional)" autocomplete="email">
    <div aria-hidden="true" class="u-oculto"><label>No completar<input id="i-w" tabindex="-1" autocomplete="off"></label></div>
    <div class="botones"><button class="btn" id="i-b" onclick="mandarIdea()">Enviar</button><button class="btn lin" onclick="cerrar()">Cancelar</button></div>
    <p class="chico tenue" id="i-n">Le llega a Fidel. No se manda nada de tus notas ni de tus horarios. Si dejás un mail, se borra a los seis meses. <a href="#novedades/pedidos" onclick="cerrar()">Mirá lo que ya pidieron</a>.</p>`);
  setTimeout(() => $('#i-t').focus(), 50);
}
async function mandarIdea() {
  const texto = val('i-t'), contacto = val('i-c');
  if (texto.length < 5) return aviso('Escribí tu sugerencia');
  if (texto.length > 2000) return aviso('Es muy larga: máximo 2000 caracteres');
  if (contacto && !mailValido(contacto)) return aviso('Revisá el mail: parece que tiene un error (o dejalo vacío)');
  const boton = $('#i-b');
  boton.disabled = true; boton.textContent = 'Enviando…';
  try {
    // text/plain evita la consulta previa (preflight) del navegador, que Apps Script no responde.
    const r = await fetch(BUZON, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ sitio: 'cursada', texto: (ideaPrefijo + texto).slice(0, 2000), contacto, web: val('i-w'), ms: Date.now() - ideaAbierta, seccion: V.tab }) });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || 'No se pudo enviar');
    abrir(cab('Quedó anotado ✍️') + `<p class="u-mt0">${ideaPrefijo ? '¡Gracias por la recomendación!' : '¡Gracias!'} Cuando lo revise, vas a ver cómo va en <a href="#novedades/pedidos" onclick="cerrar()">Novedades → Lo que pidieron</a>.</p>
      <div class="botones"><button class="btn" onclick="cerrar()">Listo</button></div>`);
  } catch (e) {
    boton.disabled = false; boton.textContent = 'Enviar';
    // Si el buzón no responde, queda el plan B: el mail de siempre, con el texto ya cargado.
    $('#i-n').innerHTML = `No se pudo enviar (${esc(e.message || 'sin conexión')}). Probá de nuevo o <a href="mailto:${SOPORTE}?subject=${encodeURIComponent('Galera: sugerencia')}&body=${encodeURIComponent(texto)}">mandala por mail</a>.`;
  }
}

// =====================================================================
// DATOS: exportar, importar, borrar
// =====================================================================
// =====================================================================
// NOVEDADES POR MAIL: los lunes a las 8, lo nuevo del gestor que le importa a cada persona.
// Habla con el mismo script del buzón (Novedades.gs). Doble confirmación: el mail se guarda recién al confirmar desde el link.
// Los links de los mails son de este sitio: #confirmar=TOKEN, #novedades=TOKEN y #baja=TOKEN (se borran de la barra al abrirse).
// =====================================================================
// Apagado hasta desplegar Novedades.gs en el script del buzón (ver 104-edicion-cursada/REFERENCIA.md); con false no se ve el botón ni el cartel.
const NOVEDADES = true;
const TEMAS_NOV = [['herramientas', '🛠️ Funciones y herramientas nuevas'], ['resumenes', '📚 Resúmenes y apuntes nuevos'], ['fechas', '📅 Cambios en fechas, mesas de examen y horarios'], ['profesional', '💼 Novedades para profesionales del libro']];
let novAbierta = 0, novToken = '';
async function postNov(cuerpo) {
  // text/plain evita la consulta previa (preflight) del navegador, que Apps Script no responde.
  const r = await fetch(BUZON, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ sitio: 'cursada' }, cuerpo)) });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || 'No se pudo completar');
  return j;
}
const checksTemas = marcados => TEMAS_NOV.map(([k, t]) => `<label class="chico fila nov-op"><input type="checkbox" data-f="nt-${k}" id="nt-${k}" ${(marcados ? marcados.indexOf(k) >= 0 : (k !== 'profesional' || esPro())) ? 'checked' : ''}> <span>${t}</span></label>`).join('');
const temasMarcados = () => TEMAS_NOV.map(t => t[0]).filter(k => { const el = document.getElementById('nt-' + k); return el && el.checked; });
function avisame() {
  if (!NOVEDADES) return;
  const cursando = D.plan ? D.plan.materias.filter(m => (E.materias[m.id] || {}).estado === 'cursando') : [];
  novAbierta = Date.now();
  abrir(cab('🔔 Novedades de Galera') + `<p class="u-mt0">Dejame tu mail y los <b>lunes a las 8:00</b> te llega solo lo nuevo del gestor que te importa. Es gratis, y si un lunes no hay nada para vos, no te escribo.</p>
    <label class="c" for="n-m">Tu mail</label>
    <input id="n-m" type="email" class="u-w100" maxlength="120" autocomplete="email" placeholder="nombre@ejemplo.com">
    <div class="c">¿Qué querés recibir?</div>${checksTemas()}
    ${cursando.length ? `<label class="chico fila nov-op u-margin-top-6px"><input type="checkbox" id="n-mat" checked> <span>De las materias, solo las que estoy cursando (${cursando.map(m => esc(nombreDe(m))).join(', ')})</span></label>` : ''}
    <div aria-hidden="true" class="u-oculto"><label>No completar<input id="n-w" tabindex="-1" autocomplete="off"></label></div>
    <div class="botones"><button class="btn" id="n-b" onclick="enviarAviso()">Suscribirme</button><button class="btn lin" onclick="cerrar()">Cancelar</button></div>
    <p class="chico tenue" id="n-n">Uso tu mail solo para esto y no lo comparto. Primero te mando un mail para que confirmes (si no confirmás, se borra) y en cada novedad vas a tener el link para cambiar lo que recibís o darte de baja. No se manda nada de tus notas ni de tus horarios.</p>`, 'nov');
  setTimeout(() => $('#n-m').focus(), 50);
}
async function enviarAviso() {
  const email = val('n-m'), temas = temasMarcados();
  if (!mailValido(email)) return aviso('Revisá el mail: parece que tiene un error');
  if (!temas.length) return aviso('Elegí al menos un tema');
  const boton = $('#n-b'), solo = document.getElementById('n-mat');
  const materias = solo && solo.checked ? D.plan.materias.filter(m => (E.materias[m.id] || {}).estado === 'cursando').map(m => m.id) : [];
  boton.disabled = true; boton.textContent = 'Enviando…';
  try {
    await postNov({ accion: 'suscribir', email, temas, materias, web: val('n-w'), ms: Date.now() - novAbierta });
    abrir(cab('📬 Revisá tu mail') + `<p>Te mandé un mail a <b>${esc(email)}</b> para que confirmes. Tocá el botón que trae y listo: desde el próximo lunes te llegan las novedades.</p>
      <p class="chico tenue">Si no lo ves en unos minutos, mirá en <b>Spam</b> o <b>Promociones</b>. Si te equivocaste de mail, simplemente no lo confirmes y se borra solo.</p>
      <div class="botones"><button class="btn" onclick="cerrar()">Listo</button></div>`, 'nov');
  } catch (e) {
    boton.disabled = false; boton.textContent = 'Suscribirme';
    $('#n-n').innerHTML = `<span class="alerta">${esc(e.message || 'Sin conexión')}</span> Probá de nuevo en un rato, o escribime a <a href="mailto:${SOPORTE}">${SOPORTE}</a>.`;
  }
}
// Los links de los mails: se leen una vez y se borran de la barra de direcciones.
// «¿Tenés este apunte?»: abre el buzón de sugerencias con el texto que falta ya cargado.
function tengoTexto(ref) {
  idea({ titulo: '📎 ¿Tenés este texto?', intro: 'Si tenés el PDF o las fotos de este texto, avisame y te digo cómo pasármelo. Lo uso para armar los apuntes de la materia.',
    ejemplo: 'Ej.: lo tengo escaneado; ¿cómo te lo mando?', prefijo: 'Tengo este texto: ' + String(ref).slice(0, 200) + '. ' });
}
function manejarLinkNov() {
  if (manejarLinkCompartir()) return true;   // desafíos del Arcade y horarios compartidos (compartir.js)
  const dt = location.hash.match(/^#datos=([A-Za-z0-9_-]{8,120000})$/);   // «Pasar a otro dispositivo»: los datos viajan en el link
  if (dt) { history.replaceState(null, '', location.pathname + location.search); llegoTraspaso = true; recibirTraspaso(dt[1]); return true; }
  if (location.hash === '#donar') { history.replaceState(null, '', location.pathname + location.search); ir('sostener'); return true; }   // el botón del mail
  const t = location.hash.match(/^#tengo=(.{3,200})$/);   // links desde los apuntes y planes: #tengo=<texto que falta>
  if (t) { history.replaceState(null, '', location.pathname + location.search); let ref = ''; try { ref = decodeURIComponent(t[1]); } catch (e) { ref = t[1]; } tengoTexto(ref); return true; }
  const m = location.hash.match(/^#(confirmar|baja|novedades)=([0-9a-f-]{36})$/);
  if (!m) return false;
  history.replaceState(null, '', location.pathname + location.search);
  novToken = m[2];
  ({ confirmar: confirmarNov, baja: pedirBaja, novedades: verPrefsNov }[m[1]])();
  return true;
}
const errNov = e => `<p class="alerta">${esc(e.message || 'Sin conexión')}</p><p class="chico tenue">Probá de nuevo más tarde o escribime a <a href="mailto:${SOPORTE}">${SOPORTE}</a>.</p><div class="botones"><button class="btn" onclick="cerrar()">Cerrar</button></div>`;
async function confirmarNov() {
  abrir(cab('🔔 Novedades de Galera') + '<p class="cargando">Confirmando tu mail…</p>', 'nov');
  try {
    await postNov({ accion: 'confirmar', token: novToken });
    abrir(cab('✅ ¡Listo!') + `<p>Tu mail quedó confirmado. Desde el próximo lunes, a las 8:00, te llega lo nuevo de Galera que elegiste recibir. Si un lunes no hay nada para vos, no te escribo.</p>
      <div class="botones"><button class="btn" onclick="cerrar()">Seguir en Galera</button><button class="btn lin" onclick="verPrefsNov()">Cambiar lo que recibo</button></div>`, 'nov');
  } catch (e) { abrir(cab('No se pudo confirmar') + errNov(e), 'nov'); }
}
async function verPrefsNov() {
  abrir(cab('🔔 Lo que recibís') + '<p class="cargando">Buscando tus preferencias…</p>', 'nov');
  try {
    const p = await postNov({ accion: 'ver', token: novToken });
    const mats = D.plan ? D.plan.materias.filter(m => m.grupo !== 'idiomas' && m.grupo !== 'final') : [];
    abrir(cab('🔔 Lo que recibís') + `<p class="u-mt0">Cambiá lo que te llega los lunes a las 8:00.</p><div class="c">Temas</div>${checksTemas(p.temas)}
      <details class="u-margin-top-10px"><summary class="chico"><b>Limitar a algunas materias</b> (opcional)${p.materias.length ? ` · ${p.materias.length} elegidas` : ''}</summary>
        <p class="u-my6 chico tenue">Sin ninguna marcada, recibís de todas. Si marcás alguna, las novedades de una materia solo te llegan si es una de esas.</p>
        ${mats.map(m => `<label class="chico fila nov-op"><input type="checkbox" class="nm" value="${esc(m.id)}" data-f="nm-${esc(m.id)}" ${p.materias.indexOf(m.id) >= 0 ? 'checked' : ''}> <span>${esc(nombreDe(m))}</span></label>`).join('')}</details>
      <div class="botones"><button class="btn" id="n-g" onclick="guardarNov()">Guardar</button><button class="btn lin" onclick="pedirBaja()">Darme de baja</button><button class="btn lin" onclick="cerrar()">Cerrar</button></div>
      <p class="chico tenue" id="n-n"></p>`, 'nov');
  } catch (e) { abrir(cab('No se pudo abrir') + errNov(e), 'nov'); }
}
async function guardarNov() {
  const temas = temasMarcados(), materias = [...document.querySelectorAll('#dlg .nm:checked')].map(x => x.value);
  if (!temas.length) return aviso('Elegí al menos un tema (o darte de baja)');
  const b = $('#n-g'); b.disabled = true;
  try { await postNov({ accion: 'guardar', token: novToken, temas, materias }); cerrar(); aviso('Listo, guardé tus preferencias'); }
  catch (e) { b.disabled = false; $('#n-n').innerHTML = `<span class="alerta">${esc(e.message || 'Sin conexión')}</span>`; }
}
function pedirBaja() {
  abrir(cab('¿Darte de baja?') + `<p>Dejás de recibir las novedades y borro tu mail. Si más adelante querés volver, te suscribís de nuevo.</p>
    <div class="botones"><button class="btn" id="n-x" onclick="confirmarBaja()">Sí, darme de baja</button><button class="btn lin" onclick="cerrar()">Mejor no</button></div><p class="chico tenue" id="n-n"></p>`, 'nov');
}
async function confirmarBaja() {
  const b = $('#n-x'); b.disabled = true;
  try { await postNov({ accion: 'baja', token: novToken }); abrir(cab('Listo, ya estás de baja') + '<p>Listo: borré tu mail y no te escribo más. Gracias por haber estado.</p><div class="botones"><button class="btn" onclick="cerrar()">Cerrar</button></div>', 'nov'); }
  catch (e) { b.disabled = false; $('#n-n').innerHTML = `<span class="alerta">${esc(e.message || 'Sin conexión')}</span>`; }
}

function abrirDatos() {
  abrir(cab('Tus datos') + `<p class="u-mt0">Lo que cargás (notas, fechas, horarios) vive <b>solo en este navegador</b>. ${E.copia ? 'Tu última copia es del ' + fmt(E.copia) + '.' : 'Todavía no bajaste ninguna copia.'} Con una copia recuperás todo si cambiás de celular o se borran los datos.</p>
    <div class="botones"><button class="btn" onclick="exportar()">Descargar una copia</button>
      <label class="btn sec u-display-inline-flex_align-items-center_cursor-pointer">Cargar una copia<input type="file" accept=".json,application/json" hidden onchange="importar(this.files[0])"></label>
      <button class="btn sec" onclick="abrirTraspaso()">Pasar a otro dispositivo</button></div>
    <p class="chico tenue u-margin-top-10px">Te bajo un archivo con todo lo que cargaste. Guardalo donde quieras; para recuperarlo, «Cargar una copia». Si tenés los dos dispositivos a mano, «Pasar a otro dispositivo» hace lo mismo con un link o un QR, sin archivos.</p>
    <details class="registro"><summary>Cómo se guardan tus datos y qué privacidad tienen</summary>
    <p>Todo lo que cargás (notas, fechas, horarios) se guarda <b>solo en este navegador</b>. No guardo nada de lo que cargás: no hay cuentas ni servidor, y nadie más lo ve, ni siquiera yo. La única excepción es tu mail, si te suscribís a las novedades: lo uso solo para mandarte eso y te das de baja cuando quieras. Google Analytics (solo si aceptás las cookies) cuenta visitas, no tus datos.</p>
    <p><b>Queda guardado</b> aunque cierres la página o apagues la computadora: está ahí la próxima vez que entres desde <b>el mismo navegador y el mismo dispositivo</b>.</p>
    <p class="u-margin-bottom-4px"><b>Se pierde</b> (o no lo vas a ver) si:</p>
    <ul class="u-margin-top-0_padding-left-22px">
      <li>entrás desde otro dispositivo (el celular y la compu no se sincronizan) o desde otro navegador;</li>
      <li>usás una ventana de incógnito o privada: se borra al cerrarla;</li>
      <li>borrás los datos de navegación (cookies y datos de sitios) o desinstalás el navegador;</li>
      <li>usás Safari (iPhone, iPad o Mac) y pasás más de siete días sin entrar: Safari borra solo lo que guardan los sitios que no visitás (<a href="https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/" target="_blank" rel="noopener">lo explica WebKit</a>).</li>
    </ul>
    </details>
    <div class="zona-borrar"><p class="u-mb8 chico tenue">¿Compu compartida? Al terminar, guardá tu copia y borrá todo: lo que cargás queda en este navegador.</p>
      <button class="btn pel" onclick="borrarTodo()">Borrar todo lo que cargué</button></div>`, 'datos');
}
function exportar() {
  if (V.demo) return aviso('Estás viendo el ejemplo: salí del ejemplo para descargar tu copia');
  E.copia = hoy(); guardar(true);
  descargar('cursada-' + hoy() + '.json', JSON.stringify(E, null, 1), 'application/json');
  aviso('Copia guardada en tus descargas: ponela en un lugar seguro (la nube, un pendrive)');
  if (V.tab === 'carrera') render(); // se va el recordatorio de la copia
}
function importar(archivo) {
  if (!archivo) return;
  if (V.demo) { E = V.demo; V.demo = null; }
  if (archivo.size > 1e6) return aviso('Ese archivo es demasiado grande para ser una copia de Galera');
  const r = new FileReader();
  r.onload = () => {
    let e;
    try { e = JSON.parse(r.result); if (!e || e.v !== 1 || typeof e.materias !== 'object') throw new Error(); e = normalizar(e); }
    catch (err) { return aviso('Ese archivo no es una copia de Galera'); }
    // Cargar una copia reemplaza todo lo que hay: si ya hay datos, se pide confirmar y se baja antes una copia de lo actual.
    const hay = Object.keys(E.materias || {}).length + Object.keys(E.horarios || {}).length;
    if (hay) {
      confirmar('Esto reemplaza lo que tenés ahora (' + Object.keys(E.materias).length + ' materias con datos). Antes te bajo una copia de lo actual, por las dudas.', 'Reemplazar', 'Mejor no').then(ok => {
        if (!ok) return;
        descargar('cursada-antes-de-importar-' + hoy() + '.json', JSON.stringify(E, null, 1), 'application/json');
        E = e; guardar(); cerrar(); render(); aviso('Copia cargada');
      });
      return;
    }
    E = e; guardar(); cerrar(); render(); aviso('Copia cargada');
  };
  r.readAsText(archivo);
}
// ---------- pasar a otro dispositivo (traspaso.js): el estado en el # de un link o de un QR ----------
// Sin servidor: los datos van comprimidos dentro del link (el # no sale del navegador) y entran por normalizar().
let traspasoUrl = '', traspasoRecibido = null, llegoTraspaso = false;
const hayDatosCargados = e => Object.keys(e.materias || {}).length + Object.keys(e.horarios || {}).length;
async function abrirTraspaso(liviano) {
  if (V.demo) return aviso('Estás viendo el ejemplo: salí del ejemplo para pasar tus datos');
  if (!hayDatosCargados(E)) return aviso('Todavía no cargaste nada para pasar');
  const T = 'Pasar a otro dispositivo', volver = '<div class="botones"><button class="btn sec" onclick="abrirDatos()">Volver</button></div>';
  abrir(cab(T) + '<p class="cargando">Preparando el link…</p>', 'traspaso');
  let t;
  try { t = await Traspaso.empaquetar(E, liviano); }
  catch (err) { return abrir(cab(T) + `<p class="alerta">${esc(err.message || 'No se pudo preparar el link.')}</p><p class="chico tenue">Podés pasar tus datos con «Descargar una copia».</p>${volver}`, 'traspaso'); }
  traspasoUrl = location.origin + location.pathname + '#datos=' + t;
  const m = Traspaso.qrDeTexto(traspasoUrl);
  const qr = m
    ? `<div class="qr-caja">${Traspaso.qrSvg(m, 'Código QR con tus datos de Galera')}</div><p class="chico tenue u-text-align-center">En el otro dispositivo, abrí la cámara y apuntá al código.${liviano ? ' <b>Este QR no lleva el historial de práctica de las preguntas.</b>' : ''}</p>`
    : `<p class="alerta">Tus datos pesan demasiado para un QR${liviano ? ', incluso sin el historial de práctica' : ''}.</p>` + (liviano ? '' : '<div class="botones"><button class="btn sec" onclick="abrirTraspaso(true)">Hacer un QR sin el historial de práctica</button></div>') + '<p class="chico tenue">Usá el link o «Descargar una copia».</p>';
  abrir(cab(T) + `<p class="u-mt0">Tus notas, fechas y horarios van <b>dentro del link</b>: no pasan por ningún servidor. Abrilo en el otro dispositivo y, antes de reemplazar lo que haya ahí, te pide confirmar.</p>${qr}
    <div class="botones"><button class="btn" onclick="copiarTraspaso()">Copiar el link</button>${navigator.share ? '<button class="btn sec" onclick="compartirTraspaso()">Compartir</button>' : ''}<button class="btn sec" onclick="abrirDatos()">Volver</button></div>
    ${traspasoUrl.length > 6000 ? '<p class="chico tenue">Es un link largo: algunos chats lo cortan. Si pasa, usá «Descargar una copia».</p>' : ''}
    <details class="registro"><summary>Ver el link</summary><textarea id="tr-link" readonly rows="4" class="u-w100" aria-label="Link con tus datos">${esc(traspasoUrl)}</textarea></details>
    <p class="chico tenue u-margin-top-10px">Quien tenga este link o este QR puede ver lo que cargaste: no lo publiques ni se lo mandes a quien no corresponda.</p>`, 'traspaso');
}
function copiarTraspaso() {
  const a = $('#tr-link'), manual = () => { const d = a && a.closest('details'); if (d) d.open = true; if (a) { a.focus(); a.select(); } aviso('No pude copiarlo solo: copialo a mano desde el cuadro'); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(traspasoUrl).then(() => aviso('Link copiado'), manual); else manual();
}
function compartirTraspaso() { if (navigator.share) navigator.share({ title: 'Mis datos de Galera', url: traspasoUrl }).catch(() => { }); }
async function recibirTraspaso(t) {
  const T = 'Datos de otro dispositivo';
  abrir(cab(T) + '<p class="cargando">Leyendo los datos…</p>', 'recibir');
  let e;
  try { e = normalizar(await Traspaso.desempaquetar(t)); }
  catch (err) { return abrir(cab('No se pudo leer el link') + '<p>Este link no trae datos de Galera completos: puede haberse cortado al copiarlo o al mandarlo por un chat.</p><p class="chico tenue">Probá de nuevo desde el otro dispositivo, o usá «Descargar una copia» y «Cargar una copia».</p><div class="botones"><button class="btn" onclick="cerrar()">Cerrar</button></div>', 'recibir'); }
  traspasoRecibido = e;
  const actual = V.demo || E, hay = hayDatosCargados(actual), n = Object.keys(e.materias).length, h = Object.keys(e.horarios).length;
  const plural = (k, s, p) => k + ' ' + (k === 1 ? s : p);
  abrir(cab(T) + `<p class="u-mt0">Llegaron ${plural(n, 'materia con datos', 'materias con datos')} y ${plural(h, 'horario', 'horarios')}.</p>
    <p>${hay ? `Si seguís, <b>reemplazan lo que tenés ahora</b> en este navegador (${plural(Object.keys(actual.materias).length, 'materia con datos', 'materias con datos')}). Antes se baja una copia de lo actual, por las dudas.` : 'Todavía no tenés nada cargado acá, así que no se pisa nada.'}</p>
    <div class="botones"><button class="btn" onclick="aceptarTraspaso()">${hay ? 'Reemplazar mis datos' : 'Cargar estos datos'}</button><button class="btn sec" onclick="traspasoRecibido=null;cerrar()">No, dejar lo que tengo</button></div>`, 'recibir');
}
function aceptarTraspaso() {
  if (!traspasoRecibido) return cerrar();
  if (V.demo) { E = V.demo; V.demo = null; }
  if (hayDatosCargados(E)) descargar('cursada-antes-de-importar-' + hoy() + '.json', JSON.stringify(E, null, 1), 'application/json');
  E = traspasoRecibido; traspasoRecibido = null; guardar(); cerrar(); render(); aviso('Datos cargados');
}
function borrarTodo() { confirmar('¿Borrar todas tus notas, fechas y horarios de este navegador? No se puede deshacer.', 'Borrar todo', 'Mejor no').then(ok => { if (ok) borrarTodoYa(); }); }
function borrarTodoYa() { V.demo = null; E = estadoVacio(); guardar(); cerrar(); render(); aviso('Datos borrados'); }

arrancar();
