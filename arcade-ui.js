// Arcade de Corrección de Estilo (0911): la pantalla. La lógica (puntajes, rachas, parser) está en arcade.js; el estado guardado, en E.arcade (app.js).
// Es una sala aparte y opcional: Practicar y los elementos de juego siguen sin puntos ni comparaciones.
// URL /exec del Apps Script del tablero global (arcade/Codigo.gs, ticket 41). Vacía = solo récords locales.
const ARCADE_URL = 'https://script.google.com/macros/s/AKfycbwG83kKZYGe-MR1kXoSb08dzUAZHw3xnOuGQMSw_uq_UywgGFE3ZqElfFPX7FGseNQxDQ/exec';
let ARC = null, arcCargando = false;
const arcS = () => (V.arc = V.arc || { vista: 'sala', top: 'teo-2p', glob: {}, sel: -1, msg: '' });
const ARC_PRAC_RE = /^[a-z0-9][\w.-]{0,39}$/;

// Datos propios del arcade: el lote de preguntas difíciles y los textos del Práctico (solo los revisados por Fidel).
async function arcDatos() {
  if (ARC) return ARC;
  let d = {};
  try { const r = await fetch('/datos/arcade-0911.json'); if (!r.ok) throw new Error(); d = await r.json(); } catch (e) { d = {}; }
  const dif = Array.isArray(d.dificiles) ? d.dificiles.filter(p => Arcade.valida(p)) : [];
  const prac = [];
  (Array.isArray(d.practicos) ? d.practicos : []).forEach(x => {
    if (!x || !ARC_PRAC_RE.test(x.id || '') || x.revisado !== true || typeof x.titulo !== 'string') return;
    try { const T = Arcade.parsear(x.texto); if (T.errores) prac.push({ id: x.id, titulo: x.titulo.slice(0, 120), tema: txt(x.tema, 80), fuente: txt(x.fuente, 200), texto: x.texto, errores: T.errores }); } catch (e) { /* un texto mal marcado no entra */ }
  });
  return (ARC = { dificiles: dif, practicos: prac });
}
const arcNombre = t => { const x = Arcade.TEORICOS.find(y => y[0] === t); if (x) return 'Teórico · ' + x[1]; const p = ARC && ARC.practicos.find(y => 'prac-' + y.id === t); return p ? 'Práctico · ' + p.titulo : t; };
const arcCero = n => Arcade.cero(n);
const arcMejor = t => ((E.arcade.mejores[t] || [])[0] || [0])[0];

// ---------- guardar y enviar ----------
function arcRegistrar(tablero, puntos) {
  const ar = E.arcade, ini = Arcade.iniciales(ar.ini) || 'AAA', antes = arcMejor(tablero);
  if (puntos > 0) { ar.mejores[tablero] = Arcade.sumarTop(ar.mejores[tablero], [puntos, hoy(), ini]); ar.ini = ini; guardar(true); }
  return { record: puntos > 0 && puntos > antes, ini };
}
async function arcEnviar(tablero, ini, puntos, detalle) {
  if (!ARCADE_URL || puntos <= 0) return 'local';
  try {
    const r = await fetch(ARCADE_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ sitio: 'cursada-arcade', tablero, ini, puntos, temporada: Arcade.TEMPORADA, detalle }) });
    const j = await r.json();
    return j && j.ok ? 'enviado' : 'rechazado';
  } catch (e) { return 'local'; }
}
async function arcTopGlobal(tablero) {
  const A = arcS();
  if (!ARCADE_URL || !Arcade.esTablero(tablero)) return;
  A.glob[tablero] = 'cargando';
  try {
    const r = await fetch(ARCADE_URL + '?tablero=' + encodeURIComponent(tablero) + '&temporada=' + encodeURIComponent(Arcade.TEMPORADA));
    const j = await r.json();
    A.glob[tablero] = j && j.ok && Array.isArray(j.top) ? j.top.slice(0, Arcade.TOP).filter(f => Array.isArray(f) && Arcade.RE_INI.test(f[0] || '') && Number.isInteger(f[1])) : 'error';
  } catch (e) { A.glob[tablero] = 'error'; }   // sin red: se ve solo el top local, sin errores a la vista
  if (V.tab === 'arcade') render();
}

// ---------- sala ----------
function arcLetra(pos, d) {
  const ini = (Arcade.iniciales(E.arcade.ini) || 'AAA').split('');
  ini[pos] = Arcade.girar(ini[pos], d); E.arcade.ini = ini.join(''); guardar(true); render();
}
function arcSelIniciales() {
  const ini = (Arcade.iniciales(E.arcade.ini) || 'AAA').split('');
  return `<div class="arc-ini" role="group" aria-label="Tus iniciales: flechas arriba y abajo cambian la letra">${ini.map((c, i) => `<div class="arc-col">
    <button class="arc-fl" type="button" aria-label="Letra ${i + 1} siguiente" onclick="arcLetra(${i},1)">▲</button>
    <button class="arc-letra" type="button" data-f="ini-${i}" data-ini="${i}" aria-label="Letra ${i + 1}: ${c}">${c}</button>
    <button class="arc-fl" type="button" aria-label="Letra ${i + 1} anterior" onclick="arcLetra(${i},-1)">▼</button></div>`).join('')}</div>`;
}
document.addEventListener('keydown', e => {
  const b = e.target && e.target.closest && e.target.closest('.arc-letra');
  if (!b) return;
  const pos = Number(b.dataset.ini);
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); arcLetra(pos, e.key === 'ArrowUp' ? 1 : -1); }
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); const o = document.querySelector('.arc-letra[data-ini="' + (pos + (e.key === 'ArrowLeft' ? -1 : 1)) + '"]'); if (o) o.focus(); }
  else if (/^[a-zA-Z]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {   // escribir la letra directo
    e.preventDefault(); const ini = (Arcade.iniciales(E.arcade.ini) || 'AAA').split(''); ini[pos] = e.key.toUpperCase(); E.arcade.ini = ini.join(''); guardar(true); render();
    const o = document.querySelector('.arc-letra[data-ini="' + Math.min(2, pos + 1) + '"]'); if (o) o.focus();
  }
});
function arcTopHtml(t) {
  const L = E.arcade.mejores[t] || [], G = ARCADE_URL ? arcS().glob[t] : null;
  const fila = (n, ini, p, f) => `<li><span class="arc-n">${n}.</span> <b>${esc(ini)}</b> <span class="arc-pts">${arcCero(p)}</span>${f ? ` <span class="arc-f">${fmt(f)}</span>` : ''}</li>`;
  const local = L.length ? `<ol class="arc-top">${L.map((r, i) => fila(i + 1, r[2], r[0], r[1])).join('')}</ol>` : '<p class="arc-tenue">Todavía no jugaste este tablero.</p>';
  let glob = '';
  if (ARCADE_URL) {
    if (G == null) { arcTopGlobal(t); glob = '<p class="arc-tenue">Buscando el top de todos…</p>'; }
    else if (G === 'cargando') glob = '<p class="arc-tenue">Buscando el top de todos…</p>';
    else if (G === 'error') glob = '';   // sin conexión: se ve solo el top local
    else glob = `<h4 class="arc-h">Top de todos · ${esc(Arcade.TEMPORADA)}</h4>` + (G.length ? `<ol class="arc-top">${G.map((r, i) => fila(i + 1, r[0], r[1], r[2] || '')).join('')}</ol>` : '<p class="arc-tenue">Nadie jugó todavía este tablero: la primera marca es tuya.</p>');
  }
  return `<h4 class="arc-h">Tu top · ${esc(arcNombre(t))}</h4>${local}${glob}`;
}
function vArcade() {
  const A = arcS();
  if (!ARC && !arcCargando) { arcCargando = true; arcDatos().then(() => { arcCargando = false; if (V.tab === 'arcade') render(); }); }
  if (A.vista === 'cargando') return '<div class="arc" data-tema="arcade"><p class="arc-tenue">Juntando las preguntas…</p></div>';
  if (A.vista === 'teo') return vArcTeo(A);
  if (A.vista === 'prac') return vArcPrac(A);
  if (A.vista === 'fin') return vArcFin(A);
  const prac = ARC ? ARC.practicos : [];
  const tablero = (t, nombre, desc, accion) => `<div class="arc-tab ${A.top === t ? 'on' : ''}"><div class="crece"><b>${esc(nombre)}</b><div class="arc-tenue">${esc(desc)}</div>
      <div class="arc-rec">Tu mejor marca: <span class="arc-pts">${arcCero(arcMejor(t))}</span></div></div>
      <div class="arc-bt"><button class="arc-btn" type="button" onclick="${accion}">Jugar</button><button class="arc-btn sec" type="button" onclick="arcVerTop(${arg(t)})" aria-label="Ver el top de ${esc(nombre)}">🏆 Top</button></div></div>`;
  return `<div class="arc" data-tema="arcade">
    <div class="fila" style="margin:0 0 4px"><button class="arc-btn sec" type="button" onclick="irResumenes('0911')">← Resúmenes de Corrección de Estilo</button></div>
    <h2 class="arc-titulo">ARCADE</h2><p class="arc-sub">Corrección de Estilo · 2.º parcial</p>
    <p class="arc-start" aria-hidden="true">PRESS START</p>
    <p class="arc-tenue arc-centro">Una sala aparte y opcional: acá hay puntos y récords. Practicar sigue sin puntaje y sin compararte con nadie. Los puntos quedan en este navegador${ARCADE_URL ? ' y las marcas se suman al top de todos con tus tres letras (nada más)' : ''}. Para ver el ranking, tocá <b>🏆 Top</b> en cada tablero.</p>
    <p class="arc-tenue arc-centro">Preguntas y textos en borrador: pueden tener errores; si ves uno, contanos en Sugerencias.</p>
    <h3 class="arc-h">Tus iniciales</h3>${arcSelIniciales()}
    <h3 class="arc-h">Teórico · 3 vidas y racha</h3>
    <p class="arc-tenue">100 por acierto; la racha multiplica (×2 desde 3, ×3 desde 6, ×4 desde 10) y las difíciles suman 50 antes de multiplicar. Errar cuesta una vida y corta la racha. Sin reloj.</p>
    ${Arcade.TEORICOS.map(x => tablero(x[0], x[1], x[2], `arcEmpezarTeo(${arg(x[0])})`)).join('')}
    <h3 class="arc-h">Práctico · tocá el error</h3>
    <p class="arc-tenue">Leé el texto y tocá cada error: primero se resalta y después tocás <b>Marcar</b>. +100 por error, −50 por sobrecorregir, +200 si no sobrecorregiste.</p>
    ${prac.length ? prac.map(p => tablero('prac-' + p.id, p.titulo, p.errores + ' errores' + (p.tema ? ' · ' + p.tema : ''), `arcEmpezarPrac(${arg(p.id)})`)).join('') : ARC ? '<p class="arc-tenue">Los textos del Práctico llegan en los próximos días.</p>' : ''}
    <div class="arc-panel">${arcTopHtml(A.top)}</div>
  </div>`;
}
function arcVerTop(t) { arcS().top = t; render(); const p = document.querySelector('.arc-panel'); if (p) p.scrollIntoView({ block: 'start' }); }
function irArcade() { V.tab = 'arcade'; const A = arcS(); A.vista = 'sala'; history.replaceState(null, '', urlTab('arcade')); render(); window.scrollTo(0, 0); }
function arcSala() { arcS().vista = 'sala'; render(); window.scrollTo(0, 0); }

// ---------- teórico ----------
async function arcEmpezarTeo(tablero, semilla, objetivo) {
  if (!Arcade.esTablero(tablero) || !Arcade.EJES[tablero]) return;
  const A = arcS(); A.vista = 'cargando'; render();
  try {
    await cargarResumenes();
    const m = D.resumenes.materias.find(x => x.id === Arcade.MATERIA), ids = Arcade.apuntesDe(tablero, m.apuntes.map(a => a.id));
    await Promise.all(ids.map(async id => {
      const k = Arcade.MATERIA + '/' + id;
      if (!D.apuntes[k]) { const r = await fetch('/resumenes/' + k + '.json'); if (!r.ok) throw new Error(); D.apuntes[k] = await r.json(); }
    }));
    const ap = {}; ids.forEach(id => { ap[id] = D.apuntes[Arcade.MATERIA + '/' + id]; });
    const dat = await arcDatos(), b = Arcade.banco(tablero, ap, dat.dificiles);
    if (b.length < 8) throw new Error('banco vacío');
    A.semilla = /^[a-z0-9]{4,10}$/.test(semilla || '') ? semilla : semillaNueva(); A.objetivo = objetivo > 0 ? Number(objetivo) : 0;
    A.tablero = tablero; A.S = Arcade.nueva(b, rndSemilla(A.semilla)); A.max = Arcade.maximoBanco(b); A.vista = 'teo'; A.res = null;
    medir('arcade', { item_id: tablero });
  } catch (e) { A.vista = 'sala'; aviso('No se pudieron cargar las preguntas'); }
  render(); window.scrollTo(0, 0);
}
function arcResp(x) { const S = arcS().S; if (S && Arcade.responder(S, x)) render(); }
function arcSig() {
  const A = arcS(), S = A.S; Arcade.siguiente(S);
  if (S.fin) return arcCerrar('teo');
  render();
}
async function arcCerrar(modo) {
  const A = arcS();
  const puntos = modo === 'teo' ? A.S.puntos : Arcade.puntosFinales(A.P.S), tablero = modo === 'teo' ? A.tablero : 'prac-' + A.P.id;
  const detalle = modo === 'teo' ? { aciertos: A.S.aciertos, racha: A.S.mejorRacha } : { errores: A.P.S.halladas.length, sobre: A.P.S.sobre, impecable: A.P.S.impecable };
  const g = arcRegistrar(tablero, puntos);
  A.res = { modo, tablero, puntos, record: g.record, ini: g.ini, estado: ARCADE_URL && puntos > 0 ? 'enviando' : 'local' };
  A.vista = modo === 'teo' ? 'fin' : 'prac'; A.glob[tablero] = null;
  render(); window.scrollTo(0, 0);
  const est = await arcEnviar(tablero, g.ini, puntos, detalle);
  if (A.res && A.res.tablero === tablero) { A.res.estado = est; A.glob[tablero] = null; if (V.tab === 'arcade') render(); }
}
const arcEnvioTexto = r => r.estado === 'enviando' ? 'Mandando tu marca al top de todos…' : r.estado === 'enviado' ? '✓ Tu marca ya está en el top de todos.' : r.estado === 'rechazado' ? 'El top de todos no aceptó esta marca; quedó en tu top.' : ARCADE_URL ? 'No hubo conexión: la marca quedó en tu top local.' : '';
function vArcTeo(A) {
  const S = A.S, q = S.cola[S.i], u = S.ultimo, m = Arcade.mult(Math.max(1, S.racha));
  const ult = S.vidas <= 0 || S.i + 1 >= S.cola.length;
  const ops = q.opciones.map((o, x) => {
    const cls = u ? (x === q.correcta ? 'bien' : x === u.elegida ? 'mal' : 'apagada') : '';
    return `<button class="arc-op ${cls}" type="button" ${u ? 'aria-disabled="true"' : ''} data-f="aq-${S.i}-${x}" onclick="arcResp(${x})"><b>${LETRAS[x]})</b> ${o}</button>`;
  }).join('');
  return `<div class="arc" data-tema="arcade">
    <div class="arc-marcador"><span class="arc-vidas" role="img" aria-label="Vidas: ${S.vidas} de ${Arcade.VIDAS}">${'♥'.repeat(S.vidas)}${'♡'.repeat(Arcade.VIDAS - S.vidas)}</span>
      <span class="arc-pts" aria-label="Puntaje">${arcCero(S.puntos)}</span><span class="arc-racha">${S.racha >= 3 ? '×' + m + ' · ' : ''}racha ${S.racha}</span></div>
    <p class="arc-tenue" style="margin:0 0 6px">${esc(arcNombre(A.tablero))} · pregunta ${S.i + 1}${q.dificil ? ' · <b class="arc-dif">DIFÍCIL +50</b>' : ''}</p>
    <div class="arc-card"><p class="arc-enun">${q.texto}</p><div class="arc-ops">${ops}</div>
    ${u ? `<p class="arc-dev ${u.ok ? 'ok' : 'no'}" role="status"><b>${u.ok ? '✓ ¡Bien! +' + u.ganado + (u.mult > 1 ? ' (×' + u.mult + ')' : '') : '✗ Era ' + LETRAS[q.correcta] + ')'}</b> ${q.respuesta}</p>
      <div class="botones"><button class="arc-btn" type="button" data-f="aq-sig" onclick="arcSig()">${ult ? 'Ver mi resultado' : 'Siguiente'}</button></div>` : ''}</div>
    <div class="fila"><button class="arc-btn sec" type="button" onclick="confirmar('¿Dejar la partida? No se guarda el puntaje.','Salir','Seguir jugando').then(o=>o&&arcSala())">Salir</button></div></div>`;
}
function vArcFin(A) {
  const S = A.S, r = A.res || { puntos: S.puntos, ini: 'AAA', tablero: A.tablero, estado: 'local' };
  const porque = S.vidas <= 0 ? 'Te quedaste sin vidas.' : '¡Respondiste todo el banco!';
  return `<div class="arc" data-tema="arcade"><h2 class="arc-titulo">GAME OVER</h2><p class="arc-sub">${esc(arcNombre(r.tablero))}</p>
    <div class="arc-card"><p class="arc-grande" aria-label="Puntaje final">${arcCero(r.puntos)}</p>
    ${r.record ? '<p class="arc-record">★ ¡NUEVO RÉCORD PERSONAL! ★</p>' : ''}
    <p>${porque} Aciertos: <b>${S.aciertos}</b> · mejor racha: <b>${S.mejorRacha}</b> · máximo posible en este tablero: <span class="arc-pts">${arcCero(A.max)}</span>.</p>
    ${arcMensajeDesafio(A, r.puntos)}<p class="arc-tenue">Jugaste como <b>${esc(r.ini)}</b>. ${arcEnvioTexto(r)}</p>
    <div class="botones"><button class="arc-btn" type="button" onclick="arcEmpezarTeo(${arg(r.tablero)})">Jugar de nuevo</button>${A.semilla && Arcade.EJES[r.tablero] ? '<button class="arc-btn" type="button" onclick="arcDesafiar()">Superame 🕹️</button>' : ''}<button class="arc-btn sec" type="button" onclick="arcS().top=${arg(r.tablero)};arcSala()">Ver el top</button></div></div></div>`;
}

// ---------- práctico ----------
function arcEmpezarPrac(id) {
  const A = arcS(), p = ARC && ARC.practicos.find(x => x.id === id);
  if (!p) return;
  let T; try { T = Arcade.parsear(p.texto); } catch (e) { return aviso('Este texto no se pudo cargar'); }
  A.P = { id: p.id, titulo: p.titulo, fuente: p.fuente, S: Arcade.nuevoPractico(T) }; A.sel = -1; A.msg = ''; A.res = null; A.vista = 'prac';
  medir('arcade', { item_id: 'prac-' + p.id });
  render(); window.scrollTo(0, 0);
}
function arcTocar(i) {
  const A = arcS(), S = A.P.S;
  if (S.fin || S.marcas[i]) return;
  if (A.sel === i) return arcMarcar();   // el segundo toque en la misma palabra también confirma
  A.sel = i; A.msg = ''; render();
}
function arcCancelar() { arcS().sel = -1; render(); }
function arcMarcar() {
  const A = arcS(), S = A.P.S, i = A.sel;
  if (i < 0 || S.fin) return;
  const r = Arcade.marcar(S, i); A.sel = -1;
  A.msg = r === 'acierto' ? '✓ ¡Era un error! +100' : r === 'sobre' ? '✗ Sobrecorrección: esa palabra estaba bien. −50' : r === 'neutra' ? 'Eso es opinable: no suma ni resta.' : '';
  if (S.fin) return arcCerrar('prac');
  render();
}
function arcRendirse() { const S = arcS().P.S; if (S.fin) return; Arcade.cerrarPractico(S, true); arcCerrar('prac'); }
function vArcPrac(A) {
  const P = A.P, S = P.S, T = S.T, fin = S.fin, r = A.res;
  const palabra = t => {
    const m = S.marcas[t.i], z = t.z >= 0 ? T.zonas[t.z] : null;
    let cls = '';
    if (m === 'e') cls = 'bien'; else if (m === 's') cls = 'sobre'; else if (m === 'n') cls = 'neutra';
    else if (fin && z && z.tipo === 'e') cls = 'perdida'; else if (A.sel === t.i) cls = 'sel';
    return `<button class="arc-pal ${cls}" type="button" data-f="w-${t.i}" ${fin || m ? 'aria-disabled="true"' : ''} aria-pressed="${A.sel === t.i}" onclick="arcTocar(${t.i})">${esc(t.w)}</button>`;
  };
  const barra = !fin && A.sel >= 0 ? `<div class="arc-accion" role="group" aria-label="Confirmar"><span class="arc-sel">«${esc(T.tokens[A.sel].w)}»</span>
      <button class="arc-btn" type="button" data-f="ac-marcar" onclick="arcMarcar()">Marcar</button><button class="arc-btn sec" type="button" onclick="arcCancelar()">Cancelar</button></div>` : '';
  const lista = fin ? `<div class="arc-card"><h3 class="arc-h">${S.impecable ? '★ CORRECTOR IMPECABLE +200 ★' : S.rindio ? 'Te rendiste' : 'Terminaste'}</h3>
      <p class="arc-grande" aria-label="Puntaje final">${arcCero(Arcade.puntosFinales(S))}</p>
      ${r && r.record ? '<p class="arc-record">★ ¡NUEVO RÉCORD PERSONAL! ★</p>' : ''}
      <p class="arc-tenue">Encontraste ${S.halladas.length} de ${T.errores} errores${S.sobre ? ' y sobrecorregiste ' + S.sobre + (S.sobre === 1 ? ' vez' : ' veces') : ''}. Jugaste como <b>${esc(r ? r.ini : (Arcade.iniciales(E.arcade.ini) || 'AAA'))}</b>. ${r ? arcEnvioTexto(r) : ''}</p>
      <h4 class="arc-h">Los errores del texto</h4>
      <ul class="arc-lista">${T.zonas.filter(z => z.tipo === 'e').map(z => `<li class="${S.halladas.indexOf(z.id) >= 0 ? 'ok' : 'no'}"><b>${S.halladas.indexOf(z.id) >= 0 ? '✓' : '✗'}</b> «${esc(z.orig)}» → «${esc(z.corr)}». ${esc(z.just)}</li>`).join('')}</ul>
      ${T.zonas.some(z => z.tipo === 'n') ? `<h4 class="arc-h">Opinables (no suman ni restan)</h4><ul class="arc-lista">${T.zonas.filter(z => z.tipo === 'n').map(z => `<li>«${esc(z.orig)}»${z.nota ? '. ' + esc(z.nota) : ''}</li>`).join('')}</ul>` : ''}
      ${P.fuente ? `<p class="arc-tenue">Fuente del texto: ${esc(P.fuente)}.</p>` : ''}
      <div class="botones"><button class="arc-btn" type="button" onclick="arcEmpezarPrac(${arg(P.id)})">Jugar de nuevo</button><button class="arc-btn sec" type="button" onclick="arcS().top=${arg('prac-' + P.id)};arcSala()">Ver el top</button></div></div>` : '';
  return `<div class="arc" data-tema="arcade">
    <div class="arc-marcador"><span class="arc-pts" aria-label="Puntaje">${arcCero(Math.max(0, S.puntos))}</span><span class="arc-racha">${S.halladas.length}/${T.errores} errores</span>
      ${fin ? '' : '<button class="arc-btn sec" type="button" onclick="confirmar(\'¿Te rendís? Se muestran los errores y se guarda el puntaje.\',\'Rendirme\',\'Seguir\').then(o=>o&&arcRendirse())">Me rindo</button>'}</div>
    <p class="arc-tenue" style="margin:0 0 6px">${esc(P.titulo)} · tocá una palabra y después <b>Marcar</b>.</p>
    <p class="arc-msg" role="status">${esc(A.msg || '')}</p>
    <div class="arc-texto">${T.parrafos.map(par => `<p>${par.map(palabra).join(' ')}</p>`).join('')}</div>
    ${barra}${lista}
    ${fin ? '' : '<div class="fila"><button class="arc-btn sec" type="button" onclick="confirmar(\'¿Dejar el texto? No se guarda el puntaje.\',\'Salir\',\'Seguir\').then(o=>o&&arcSala())">Salir</button></div>'}</div>`;
}
