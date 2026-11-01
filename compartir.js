// Compartir: gestos para pasarle Galera a otra persona (ticket de difusión, sección A).
// Sin servidores ni terceros: las imágenes salen de un canvas, el QR es el del traspaso y los links llevan todo en el #.
// Nada de lo que se comparte lleva nombre ni datos personales. Las funciones se llaman desde app.js y arcade-ui.js.
const BRAND = { nombre: 'Galera', sitio: 'galera.com.ar', url: 'https://galera.com.ar/' };
const CV_FONDO = '#1f3a5f', CV_ACENTO = '#f2c14e', CV_FUENTE = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

// ---------- canvas ----------
function cvBase(w, h) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const c = cv.getContext('2d'); c.fillStyle = CV_FONDO; c.fillRect(0, 0, w, h);
  return [cv, c];
}
function cvTexto(c, t, x, y, px, peso, color, align) {
  c.font = `${peso} ${px}px ${CV_FUENTE}`; c.fillStyle = color || '#fff'; c.textAlign = align || 'left'; c.textBaseline = 'alphabetic'; c.fillText(t, x, y);
}
function cvLineas(c, texto, maxW, px, peso) {
  c.font = `${peso || 600} ${px}px ${CV_FUENTE}`;
  const out = []; let l = '';
  String(texto).split(/\s+/).forEach(p => { const t = l ? l + ' ' + p : p; if (l && c.measureText(t).width > maxW) { out.push(l); l = p; } else l = t; });
  if (l) out.push(l);
  return out;
}
function cvPie(c, w, h) {
  c.fillStyle = CV_ACENTO; c.fillRect(80, h - 150, 110, 8);
  cvTexto(c, BRAND.nombre, 80, h - 82, 46, 800);
  cvTexto(c, BRAND.sitio, 80, h - 38, 30, 400, 'rgba(255,255,255,.78)');
}
// Tarjeta cuadrada con un dato grande al centro.
function cvDato({ kicker, grande, lineas, barra }) {
  const [cv, c] = cvBase(1080, 1080);
  cvTexto(c, kicker.toUpperCase(), 80, 150, 34, 700, CV_ACENTO);
  cvTexto(c, grande, 80, 470, grande.length > 5 ? 190 : 250, 800);
  if (barra != null) {
    c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(80, 520, 920, 28);
    c.fillStyle = CV_ACENTO; c.fillRect(80, 520, Math.max(6, 920 * barra / 100), 28);
  }
  let y = barra != null ? 650 : 580;
  lineas.forEach(([t, px, peso]) => { cvLineas(c, t, 920, px, peso).slice(0, 4).forEach(l => { cvTexto(c, l, 80, y, px, peso); y += px * 1.3; }); y += 10; });
  cvPie(c, 1080, 1080);
  return cv;
}

// Diálogo con la imagen armada: se puede compartir (si el sistema lo permite) o bajar. Se muestra con data: porque la CSP no admite blob: en img.
let IMG_COMP = null;
function abrirImagen(cv, o) {
  cv.toBlob(blob => {
    if (!blob) return aviso('No se pudo armar la imagen');
    const file = new File([blob], o.archivo, { type: 'image/png' });
    const puede = !!(navigator.canShare && navigator.canShare({ files: [file] }));
    IMG_COMP = { blob, file, o };
    abrir(cab(o.titulo) + `<p class="chico tenue" style="margin-top:0">${esc(o.intro)}</p>
      <img class="img-comp" src="${cv.toDataURL('image/png')}" alt="${esc(o.alt)}" width="${cv.width}" height="${cv.height}">
      <div class="botones">${puede ? '<button class="btn" onclick="enviarImagen()">Compartir</button>' : ''}<button class="btn ${puede ? 'sec' : ''}" onclick="bajarImagen()">Descargar (.png)</button><button class="btn lin" onclick="cerrar()">Cerrar</button></div>`, 'img-comp');
  }, 'image/png');
}
function enviarImagen() {
  if (!IMG_COMP) return;
  const { file, o } = IMG_COMP;
  medir('share', { method: 'imagen', content_type: o.tipo, item_id: o.id || '' });
  navigator.share({ files: [file], title: o.titulo, text: o.texto || '' }).catch(() => { });
}
function bajarImagen() {
  if (!IMG_COMP) return;
  const { blob, o } = IMG_COMP, a = document.createElement('a');
  medir('share', { method: 'descarga', content_type: o.tipo, item_id: o.id || '' });
  a.href = URL.createObjectURL(blob); a.download = o.archivo; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// ---------- link y QR de la pantalla ----------
// Lo que se comparte es la página con vista previa (r/, simuladores/), no el # de la app, que WhatsApp no lee.
function urlCompartible() {
  if (V.tab === 'resumenes' && V.res.materia) return urlRes(V.res.materia, V.res.apunte);
  if (V.tab === 'simuladores' && V.sim) return urlSim(V.sim);
  return location.origin + rutaActual().split('#')[0];
}
function copiarLink(url) {
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(() => aviso('Link copiado'), () => aviso('No se pudo copiar el link'));
  else aviso('No se pudo copiar el link');
}
let QR_ACTUAL = null;
function abrirQR(url, titulo, tipo, id) {
  const m = Traspaso.qrDeTexto(url);
  if (!m) return aviso('No se pudo armar el QR de este link');
  QR_ACTUAL = { url, titulo, m };
  medir('share', { method: 'qr', content_type: tipo || 'pantalla', item_id: id || V.tab });
  abrir(cab('Código QR') + `<p style="margin-top:0"><b>${esc(titulo)}</b></p><div class="qr-caja">${Traspaso.qrSvg(m, 'Código QR de ' + titulo)}</div>
    <p class="chico tenue" style="text-align:center;overflow-wrap:anywhere">${esc(url)}</p>
    <p class="chico tenue">Sirve para pegarlo en una cartelera o en un apunte en papel: quien lo escanee abre esta misma pantalla.</p>
    <div class="botones"><button class="btn" onclick="bajarQR()">Descargar (.png)</button><button class="btn sec" onclick="copiarLink(QR_ACTUAL.url)">Copiar el link</button><button class="btn lin" onclick="cerrar()">Cerrar</button></div>`, 'qr');
}
function abrirQRPantalla() { abrirQR(urlCompartible(), document.title.replace(/\s*·\s*Galera$/, '') || BRAND.nombre, 'pantalla', V.tab); }
function bajarQR() {
  if (!QR_ACTUAL) return;
  const { m, titulo } = QR_ACTUAL, n = m.length, k = Math.max(6, Math.ceil(900 / (n + 8))), lado = (n + 8) * k, banda = 150;
  const cv = document.createElement('canvas'); cv.width = lado; cv.height = lado + banda;
  const c = cv.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, cv.width, cv.height); c.fillStyle = '#000';
  m.forEach((fila, y) => fila.forEach((v, x) => { if (v) c.fillRect((x + 4) * k, (y + 4) * k, k, k); }));
  const px = Math.min(44, Math.floor(lado / 16));
  cvLineas(c, titulo, lado - 80, px, 700).slice(0, 2).forEach((l, i) => cvTexto(c, l, lado / 2, lado + 6 + px * (i + 1) * 1.15, px, 700, '#000', 'center'));
  cvTexto(c, BRAND.sitio, lado / 2, lado + banda - 18, Math.floor(px * .7), 400, '#444', 'center');
  cv.toBlob(b => { if (!b) return; const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'cursada-qr.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }, 'image/png');
}

// ---------- autoevaluación: resultado e invitación ----------
function mandarApunte(materia, apunte) {
  const m = (D.resumenes.materias || []).find(x => x.id === materia), a = D.apuntes[materia + '/' + apunte];
  const txt = `Te paso este apunte${m ? ' de ' + m.nombre : ''}${a ? ': ' + a.titulo : ''}, con autoevaluación. Gratis y sin cuenta 👉 ${urlRes(materia, apunte)}`;
  medir('share', { method: 'whatsapp', content_type: 'apunte', item_id: materia + '/' + apunte });
  window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank', 'noopener');
}
function compartirResultado(materia, apunte, bien, total) {
  const m = (D.resumenes.materias || []).find(x => x.id === materia) || { nombre: '' }, a = D.apuntes[materia + '/' + apunte];
  if (!a) return;
  const cv = cvDato({ kicker: 'Autoevaluación · ' + m.nombre, grande: bien + ' de ' + total, barra: total ? Math.round(bien * 100 / total) : 0,
    lineas: [[a.titulo, 50, 700], [bien === total ? '¡Todas bien!' : 'Sigo practicando.', 38, 400]] });
  abrirImagen(cv, { archivo: 'cursada-resultado.png', titulo: 'Mi resultado', tipo: 'resultado', id: materia + '/' + apunte,
    intro: 'Es solo el puntaje y el nombre del apunte: no lleva tu nombre ni otros datos.', texto: `Me salió ${bien} de ${total} en la autoevaluación de «${a.titulo}». ¿Y a vos? ${urlRes(materia, apunte)}`,
    alt: `Tarjeta con el resultado: ${bien} de ${total} en la autoevaluación de ${a.titulo} (${m.nombre}), en Galera.` });
}
// Se muestra al final de cada autoevaluación.
function bloqueFinAuto(materia, apunte, bien, hechas, total) {
  const completa = total > 0 && hechas === total;
  return `<div class="gl-tarjeta gl-accion no-imprimir gl-m16"><div>${completa ? `Terminaste: <b>${bien} de ${total}</b>. ` : ''}<span class="gl-chico">¿Le sirve a alguien de tu cursada?</span></div>
    ${completa ? `<button class="gl-btn gl-btn--sec" type="button" onclick="compartirResultado(${arg(materia)},${arg(apunte)},${bien},${total})">Mi resultado en imagen</button>` : ''}
    <button class="gl-btn gl-btn--ter" type="button" onclick="mandarApunte(${arg(materia)},${arg(apunte)})">Mandale este apunte por WhatsApp</button></div>`;
}

// ---------- mi avance ----------
function compartirAvance() {
  const p = progreso(), av = Math.round(p.total[0] * 100 / p.total[1]);
  const cv = cvDato({ kicker: 'Mi carrera de Edición', grande: av + ' %', barra: av, lineas: [['Llevo el ' + av + ' % de la carrera.', 54, 700], [p.total[0] + ' de ' + p.total[1] + ' requisitos aprobados.', 38, 400]] });
  abrirImagen(cv, { archivo: 'cursada-avance.png', titulo: 'Mi avance', tipo: 'avance', id: String(av),
    intro: 'Solo el porcentaje: sin materias, notas ni nombre. Vos decidís si la compartís.', texto: `Llevo el ${av} % de la carrera de Edición. ${BRAND.url}`,
    alt: `Tarjeta: llevo el ${av} % de la carrera de Edición, ${p.total[0]} de ${p.total[1]} requisitos aprobados. Galera.` });
}

// ---------- mi semana ----------
// Dibuja la grilla semanal de las comisiones dadas (sin nombres de docentes ni datos personales).
function cvSemana(sel, titulo) {
  const [cv, c] = cvBase(1080, 1080);
  const bl = sel.flatMap(x => x.bloques.map(b => ({ x, b, d: b.dia, a: Horarios.min(b.desde), z: Horarios.min(b.hasta) })));
  const mats = [...new Set(sel.map(x => x.materia))];
  const dias = bl.some(e => e.d === 6) ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5];
  const ini = Math.min(...bl.map(e => Math.floor(e.a / 60))), fin = Math.max(Math.max(...bl.map(e => Math.ceil(e.z / 60))), ini + 6);
  const X = 150, Y = 270, W = 1000 - X, H = 900 - Y, cw = W / dias.length, ch = H / (fin - ini);
  cvTexto(c, 'MI CURSADA', 80, 120, 34, 700, CV_ACENTO);
  cvTexto(c, titulo, 80, 190, 56, 800);
  dias.forEach((d, i) => cvTexto(c, Horarios.DIAS[d].slice(0, 3), X + cw * i + cw / 2, 255, 26, 700, 'rgba(255,255,255,.85)', 'center'));
  c.strokeStyle = 'rgba(255,255,255,.14)'; c.lineWidth = 1;
  for (let h = ini; h <= fin; h++) {
    const y = Y + (h - ini) * ch; c.beginPath(); c.moveTo(X, y); c.lineTo(X + W, y); c.stroke();
    if ((h - ini) % 2 === 0 || fin - ini <= 8) cvTexto(c, String(h).padStart(2, '0') + ':00', X - 12, y + 9, 22, 400, 'rgba(255,255,255,.7)', 'right');
  }
  bl.forEach(({ x, b, d, a, z }) => {
    const i = dias.indexOf(d); if (i < 0) return;
    const bx = X + cw * i + 4, by = Y + (a / 60 - ini) * ch + 2, bw = cw - 8, bh = Math.max(34, (z - a) / 60 * ch - 4);
    c.fillStyle = COLORES[mats.indexOf(x.materia) % COLORES.length];
    c.beginPath(); c.roundRect ? c.roundRect(bx, by, bw, bh, 12) : c.rect(bx, by, bw, bh); c.fill();
    c.save(); c.beginPath(); c.rect(bx, by, bw, bh); c.clip();
    cvTexto(c, siglaMateria(x.materia), bx + 12, by + 34, 28, 800);
    if (bh > 70) cvTexto(c, b.desde + '-' + b.hasta, bx + 12, by + 62, 21, 400, 'rgba(255,255,255,.9)');
    c.restore();
  });
  cvPie(c, 1080, 1080);
  return cv;
}
function imagenSemana() {
  const sel = elegidas();
  if (!sel.length) return aviso('Elegí primero tus comisiones');
  const nombre = oferta().nombre || 'Mi semana';
  abrirImagen(cvSemana(sel, nombre), { archivo: 'cursada-mi-semana.png', titulo: 'Mi semana', tipo: 'horario', id: V.oferta,
    intro: 'Sin tu nombre ni tus notas: solo las materias y los horarios.', texto: 'Así me queda el cuatrimestre. Armalo vos también 👉 ' + BRAND.url,
    alt: 'Grilla semanal con las clases: ' + [...new Set(sel.map(x => siglaMateria(x.materia)))].join(', ') + '.' });
}
// Link de solo lectura: lleva la oferta y los ids de las comisiones elegidas, nada más.
let HOR_LINK = '';
function linkSemana() {
  const sel = elegidas();
  if (!sel.length) return aviso('Elegí primero tus comisiones');
  HOR_LINK = location.origin + location.pathname + '#horario=' + encodeURIComponent(V.oferta + '~' + sel.map(c => c.id).join('~'));
  const m = Traspaso.qrDeTexto(HOR_LINK);
  medir('share', { method: 'link', content_type: 'horario', item_id: V.oferta });
  abrir(cab('Link para ver mi horario') + `<p style="margin-top:0">Quien lo abra ve tu semana <b>en modo lectura</b>, sin cuenta y sin poder cambiar nada. No lleva notas ni otros datos tuyos.</p>
    ${m ? `<div class="qr-caja">${Traspaso.qrSvg(m, 'Código QR con tu horario')}</div>` : ''}
    <div class="botones"><button class="btn" onclick="copiarLink(HOR_LINK)">Copiar el link</button>${navigator.share ? '<button class="btn sec" onclick="navigator.share({title:\'Mi horario en Galera\',url:HOR_LINK}).catch(()=>{})">Compartir</button>' : ''}<button class="btn lin" onclick="cerrar()">Cerrar</button></div>`, 'hor-link');
}
function abrirSemanaCompartida(oferta_, ids) {
  const of = (D.ofertas || []).find(o => o.id === oferta_);
  const sel = of ? ids.map(id => of.comisiones.find(c => c.id === id)).filter(Boolean) : [];
  if (!sel.length) return abrir(cab('Horario compartido') + `<p>Este horario es de un cuatrimestre que no está cargado o el link quedó incompleto.</p><div class="botones"><button class="btn" onclick="cerrar()">Cerrar</button></div>`, 'hor-comp');
  const cv = cvSemana(sel, of.nombre);
  abrir(cab('Horario compartido') + `<p class="chico tenue" style="margin-top:0">Alguien te pasó su semana. Solo se puede mirar: no cambia nada de lo tuyo.</p>
    <img class="img-comp" src="${cv.toDataURL('image/png')}" alt="Grilla semanal del horario compartido" width="1080" height="1080">${listaSemana(sel)}
    <div class="botones"><button class="btn" onclick="cerrar();ir('horarios')">Armar el mío</button><button class="btn lin" onclick="cerrar()">Cerrar</button></div>`, 'hor-comp');
}

// ---------- pasarle el plan a un amigo ----------
// Va qué materias aprobó o cursa; no van notas, fechas, horarios, apuntes ni práctica.
function planParaAmigo() {
  const M = {};
  Object.keys(E.materias).forEach(id => {
    const m = E.materias[id];
    if (m.estado === 'aprobada' || m.estado === 'regular' || m.estado === 'cursando') M[id] = { estado: m.estado, opcion: m.opcion || '' };
  });
  return normalizar({ v: 1, perfil: E.perfil, materias: M });
}
let AMIGO_URL = '';
async function abrirPasarAmigo() {
  if (V.demo) return aviso('Estás viendo el ejemplo: salí del ejemplo para pasar tu plan');
  const e = planParaAmigo(), n = Object.keys(e.materias).length, T = 'Pasarle mi plan a un amigo';
  if (!n) return aviso('Marcá primero qué materias aprobaste o cursás');
  abrir(cab(T) + '<p class="cargando">Preparando el link…</p>', 'amigo');
  let t;
  try { t = await Traspaso.empaquetar(e, true); }
  catch (err) { return abrir(cab(T) + `<p class="alerta">${esc(err.message || 'No se pudo preparar el link.')}</p>`, 'amigo'); }
  AMIGO_URL = location.origin + location.pathname + '#datos=' + t;
  const m = Traspaso.qrDeTexto(AMIGO_URL);
  medir('share', { method: 'link', content_type: 'plan', item_id: 'amigo' });
  abrir(cab(T) + `<p style="margin-top:0">Tu amigo abre el link y ya tiene cargadas las <b>${n} ${n === 1 ? 'materia' : 'materias'}</b> en las que estás (aprobadas y cursando). <b>No van tus notas, fechas, horarios ni apuntes.</b></p>
    ${m ? `<div class="qr-caja">${Traspaso.qrSvg(m, 'Código QR con tu plan, sin notas')}</div>` : '<p class="chico tenue">Es un link largo para un QR: usá «Copiar el link».</p>'}
    <div class="botones"><button class="btn" onclick="copiarLink(AMIGO_URL)">Copiar el link</button>${navigator.share ? '<button class="btn sec" onclick="navigator.share({title:\'Mi plan en Galera\',url:AMIGO_URL}).catch(()=>{})">Compartir</button>' : ''}<button class="btn lin" onclick="cerrar()">Cerrar</button></div>
    <p class="chico tenue" style="margin-top:10px">El link lleva el plan adentro y no pasa por ningún servidor. Mandalo solo a quien quieras.</p>`, 'amigo');
}

// ---------- «¿Le sirve a alguien?» ----------
// Una vez por sesión y, como mucho, cada 14 días; se puede cortar para siempre. Se pide después de algo que salió bien, nunca antes.
const INVITA = 'cursada.invita';
function invitarCompartir(motivo, forzar) {
  if (V.demo || V.invito || document.querySelector('.galletas.on')) return; // no se pisa con la barra de cookies
  let est = {}; try { est = JSON.parse(localStorage.getItem(INVITA) || '{}') || {}; } catch (e) { }
  if (est.no || (!forzar && Date.now() - (est.ult || 0) < 14 * 864e5)) return;
  V.invito = true;
  try { localStorage.setItem(INVITA, JSON.stringify({ ult: Date.now(), no: false })); } catch (e) { }
  let el = document.getElementById('invita'); if (el) el.remove();
  el = document.createElement('div'); el.id = 'invita'; el.className = 'invita'; el.setAttribute('role', 'status');
  el.innerHTML = `<span class="crece">${motivo === 'instalada' ? '¡Listo, ya la tenés en el celular!' : '¡Qué bueno!'} <b>¿Le sirve a alguien de tu cursada?</b></span>
    <button class="btn ch" type="button" id="inv-si">Pasársela</button><button class="btn lin ch" type="button" id="inv-no">Ahora no</button><button class="enlace chico" type="button" id="inv-nunca">No preguntar más</button>`;
  document.body.appendChild(el);
  const quitar = () => { clearTimeout(t); el.remove(); };
  const t = setTimeout(quitar, 20000);
  el.querySelector('#inv-si').onclick = () => { quitar(); compartirCursada('invita-' + motivo); };
  el.querySelector('#inv-no').onclick = quitar;
  el.querySelector('#inv-nunca').onclick = () => { try { localStorage.setItem(INVITA, JSON.stringify({ ult: Date.now(), no: true })); } catch (e) { } quitar(); };
}
const invitarLuego = (motivo, ms) => setTimeout(() => invitarCompartir(motivo), ms || 2500);

// ---------- instalar como app ----------
let INSTALAR = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); INSTALAR = e; });
window.addEventListener('appinstalled', () => { INSTALAR = null; medir('instalada', {}); setTimeout(() => invitarCompartir('instalada', true), 1500); });
function instalarApp() {
  if (!INSTALAR) return aviso('Desde el menú del navegador podés usar «Agregar a la pantalla de inicio»');
  const p = INSTALAR; INSTALAR = null; p.prompt(); cerrar();
}
const puedeInstalar = () => !!INSTALAR;
if ('serviceWorker' in navigator && window.isSecureContext) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => { }));

// ---------- logros compartibles ----------
// Se calculan siempre desde lo que ya está cargado: no se guarda nada aparte. La imagen lleva solo el logro, sin materias, notas ni nombre.
const HITOS_AVANCE = [10, 25, 50, 75, 100];
const pctAvance = (ok, total) => total ? Math.floor(ok * 100 / total) : 0;
function logros() {
  const p = progreso(), T = p.total[1], av = pctAvance(p.total[0], T), L = [];
  const mk = (id, grande, frase, extra) => L.push(Object.assign({ id, grande, frase, kicker: 'Mi carrera de Edición', texto: frase + ' ¿Y vos? ' + BRAND.url }, extra));
  HITOS_AVANCE.filter(n => av >= n).forEach(n => mk('av' + n, n + ' %', 'Aprobé el ' + n + ' % de la carrera.', { barra: n, detalle: p.total[0] + ' de ' + T + ' requisitos aprobados.' }));
  const grado = D.plan.materias.filter(m => m.grupo === 'grado'), okG = grado.filter(m => (E.materias[m.id] || {}).estado === 'aprobada').length;
  if (okG >= 1) mk('primera', '1.ª', 'Aprobé mi primera materia de la carrera.', { detalle: 'El primer paso ya está.' });
  const cbc = D.plan.materias.filter(m => m.grupo === 'cbc');
  if (cbc.length && cbc.every(m => (E.materias[m.id] || {}).estado === 'aprobada')) mk('cbc', 'CBC', 'Terminé el Ciclo Básico Común.', { detalle: 'Todas las materias del CBC, aprobadas.' });
  if (p.idiomas[1] && p.idiomas[0] === p.idiomas[1]) mk('idiomas', 'Idiomas', 'Completé los idiomas de la carrera.', { detalle: p.idiomas[0] + ' de ' + p.idiomas[1] + ' niveles aprobados.' });
  if (p.final[1] && p.final[0] === p.final[1]) mk('final', 'Final', 'Aprobé la pasantía o la tesina.', { detalle: 'El último requisito del plan.' });
  return L;
}
// Hitos de avance que se cruzaron al pasar de «prev» a «ahora» materias aprobadas.
const hitosCruzados = (prev, ahora, T) => HITOS_AVANCE.filter(n => pctAvance(prev, T) < n && pctAvance(ahora, T) >= n).map(n => 'av' + n);
function compartirLogro(id) {
  const g = logros().find(x => x.id === id);
  if (!g) return aviso('Ese logro todavía no está');
  const cv = cvDato({ kicker: g.kicker, grande: g.grande, barra: g.barra == null ? null : g.barra, lineas: [[g.frase, 54, 700], [g.detalle || '', 36, 400]].filter(l => l[0]) });
  abrirImagen(cv, { archivo: 'cursada-logro-' + id + '.png', titulo: 'Mi logro', tipo: 'logro', id,
    intro: 'Solo el logro: sin materias, notas ni nombre. Vos decidís si lo compartís.', texto: g.texto,
    alt: `Tarjeta con el logro: ${g.frase} ${g.detalle || ''} Galera.` });
}
function abrirLogros() {
  if (V.demo) return aviso('Estás viendo el ejemplo: salí del ejemplo para ver tus logros');
  const L = logros(), p = progreso(), av = pctAvance(p.total[0], p.total[1]), sig = HITOS_AVANCE.find(n => n > av);
  const falta = sig ? Math.ceil(sig * p.total[1] / 100) - p.total[0] : 0;
  abrir(cab('Mis logros') + (L.length
    ? `<p class="chico tenue" style="margin-top:0">Cada uno se puede compartir como imagen sobria, sin tu nombre ni tus notas.</p>
      <ul class="lista-mas">${L.slice().reverse().map(g => `<li><button type="button" onclick="compartirLogro(${arg(g.id)})"><span>${esc(g.frase)}<small>${esc(g.detalle || '')}</small></span><i aria-hidden="true"></i></button></li>`).join('')}</ul>`
    : '<p class="vacio">Todavía no hay logros: marcá las materias que aprobaste y aparecen solos.</p>')
    + (falta > 0 ? `<p class="chico tenue">Para el ${sig} % te ${falta === 1 ? 'falta 1 requisito' : 'faltan ' + falta + ' requisitos'}.</p>` : '')
    + '<div class="botones"><button class="btn lin" onclick="cerrar()">Cerrar</button></div>', 'logros');
}

// ---------- felicitación al aprobar ----------
// Una barra al pie (no un diálogo) cuando una materia pasa a aprobada; si hay un diálogo abierto, espera a que se cierre.
// Se apaga con el interruptor de los elementos de juego, o con «No mostrar más».
const FELICITA = 'cursada.felicita';
let FELIC = null;
function felicitarAprobadas(ids, hitos) {
  if (V.demo || !juegoOn()) return;
  let est = {}; try { est = JSON.parse(localStorage.getItem(FELICITA) || '{}') || {}; } catch (e) { }
  if (est.no) return;
  FELIC = { ids: ((FELIC && FELIC.ids) || []).concat(ids), hitos: ((FELIC && FELIC.hitos) || []).concat(hitos) };
  setTimeout(mostrarFelicitacion, 900);
}
function mostrarFelicitacion() {
  const dlg = document.getElementById('dlg');
  if (!FELIC || (dlg && dlg.open)) return;
  const { ids, hitos } = FELIC; FELIC = null;
  const unica = ids.length === 1 ? datosMateria(ids[0]) : null, hito = hitos.length ? hitos[hitos.length - 1] : '';
  let el = document.getElementById('invita'); if (el) el.remove();
  el = document.getElementById('felicita'); if (el) el.remove();
  V.invito = true;
  el = document.createElement('div'); el.id = 'felicita'; el.className = 'invita'; el.setAttribute('role', 'status');
  el.innerHTML = `<span class="crece"><b>¡Aprobaste!</b> ¿Querés dejar tu apunte para quien viene detrás?${unica ? `<small class="tenue" style="display:block">${esc(nombreDe(unica))}</small>` : ''}</span>
    <button class="btn ch" type="button" id="fe-ap">Dejar mi apunte</button>${hito ? '<button class="btn sec ch" type="button" id="fe-lo">Compartir mi logro</button>' : ''}<button class="btn lin ch" type="button" id="fe-no">Ahora no</button><button class="enlace chico" type="button" id="fe-nunca">No mostrar más</button>`;
  document.body.appendChild(el);
  const quitar = () => { clearTimeout(t); el.remove(); };
  const t = setTimeout(quitar, 30000);
  el.querySelector('#fe-ap').onclick = () => { quitar(); sumarApunte(unica ? unica.id : ''); };
  if (hito) el.querySelector('#fe-lo').onclick = () => { quitar(); compartirLogro(hito); };
  el.querySelector('#fe-no').onclick = quitar;
  el.querySelector('#fe-nunca').onclick = () => { try { localStorage.setItem(FELICITA, JSON.stringify({ no: true })); } catch (e) { } quitar(); };
}
document.getElementById('dlg').addEventListener('close', () => { if (FELIC) setTimeout(mostrarFelicitacion, 500); });

// ---------- apuntes colaborativos ----------
// Sin formulario ni buzón: la persona me escribe por mail y yo reviso a mano lo que llegue (link o adjunto) antes de publicar nada.
// Así la página no recibe ni guarda nada de nadie: el mail se arma en el programa de correo de quien escribe.
function sumarApunte(id) {
  if (V.demo) return aviso('Estás viendo el ejemplo: salí del ejemplo para sumar tu resumen');
  const L = D.plan.materias.filter(m => m.grupo === 'cbc' || m.grupo === 'grado');
  abrir(cab('📚 Sumá tu resumen') + `<p class="chico tenue" style="margin-top:0">Si tenés un resumen de una materia que ya cursaste, mandámelo por mail para quien viene detrás. <b>Lo reviso antes de publicarlo</b> (que sea correcto, que sea tuyo y que cite la bibliografía) y te aviso si hace falta algún cambio.</p>
    <label class="c">Materia</label><select id="a-m" style="width:100%">${L.map(m => `<option value="${esc(m.id)}" ${m.id === id ? 'selected' : ''}>${esc(nombreDe(m))}</option>`).join('')}</select>
    <p class="chico tenue">Se abre tu programa de correo con el mensaje armado. Pegá el link a tu resumen (Drive, Docs…) o adjuntá el archivo, y aclarame cómo querés que te acredite.</p>
    <div class="botones"><button class="btn" onclick="mailApunte()">Escribirme por mail</button><button class="btn lin" onclick="cerrar()">Cancelar</button></div>
    <p class="chico tenue">¿No se abre? Escribí a <b>${esc(CONTACTO)}</b>. No se manda nada de tus notas ni de tus horarios.</p>`, 'apunte-nuevo');
}
function mailApunte() {
  const m = datosMateria(val('a-m')) || { id: val('a-m'), nombre: val('a-m') };
  const cuerpo = `Hola Fidel, te mando mi resumen de ${m.nombre} para Galera.

Link o adjunto: 
Cómo querés que te acredite (nombre, apodo o sin crédito): 

Es un resumen mío (o tengo permiso de quien lo hizo) y acepto que se publique en Galera con el crédito que indiqué.`;
  medir('sumar_apunte', { item_id: m.id });
  window.location.href = `mailto:${CONTACTO}?subject=${encodeURIComponent('Galera: resumen de ' + m.nombre)}&body=${encodeURIComponent(cuerpo)}`;
}

// ---------- qué cursar el próximo cuatrimestre ----------
// El resultado del armador para pasarlo al grupo: qué materias elegí y, si ya elegí comisiones, el link para mirar la semana.
// Va el nombre de las materias y nada más: ni notas, ni docentes, ni qué aprobaste.
function queCursarDatos() {
  const h = hor(), of = oferta(), nombres = h.materias.map(nombreMateria);
  const lista = nombres.length > 1 ? nombres.slice(0, -1).join(', ') + ' y ' + nombres[nombres.length - 1] : nombres[0] || '';
  return { nombres, of, texto: `Esto pienso cursar${of.nombre ? ' en ' + of.nombre : ' el próximo cuatrimestre'}: ${lista}. ¿Coincidimos en alguna? Armá el tuyo sin superposiciones 👉 ${BRAND.url}` };
}
function abrirQueCursar() {
  const { nombres, of, texto } = queCursarDatos();
  if (!nombres.length) return aviso('Marcá primero qué querés cursar');
  const hay = elegidas().length > 0;
  abrir(cab('Qué voy a cursar') + `<p class="chico tenue" style="margin-top:0">${esc(of.nombre || 'Próximo cuatrimestre')}. Para pasarle al grupo lo que pensás cursar y ver con quién coincidís: solo las materias, sin notas ni datos personales.</p>
    <ul class="resumen-sel qc">${nombres.map(n => `<li><span class="ge pen" aria-hidden="true"></span><b>${esc(n)}</b></li>`).join('')}</ul>
    <div class="botones"><button class="btn" onclick="mandarQueCursar()">Mandar por WhatsApp</button><button class="btn sec" onclick="copiarQueCursar()">Copiar el texto</button><button class="btn sec" onclick="imagenQueCursar()">📷 En imagen</button>${hay ? '<button class="btn sec" onclick="linkSemana()">🔗 Link para mirar mi semana</button>' : ''}<button class="btn lin" onclick="cerrar()">Cerrar</button></div>
    ${hay ? '' : '<p class="chico tenue">Cuando elijas las comisiones, también podés pasar el link de tu semana.</p>'}`, 'que-cursar');
}
function mandarQueCursar() {
  medir('share', { method: 'whatsapp', content_type: 'que_cursar', item_id: V.oferta });
  window.open('https://wa.me/?text=' + encodeURIComponent(queCursarDatos().texto), '_blank', 'noopener');
}
function copiarQueCursar() {
  medir('share', { method: 'copiar', content_type: 'que_cursar', item_id: V.oferta });
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(queCursarDatos().texto).then(() => aviso('Texto copiado'), () => aviso('No se pudo copiar el texto'));
  else aviso('No se pudo copiar el texto');
}
function imagenQueCursar() {
  const { nombres, of, texto } = queCursarDatos();
  const [cv, c] = cvBase(1080, 1080);
  cvTexto(c, (of.nombre || 'Próximo cuatrimestre').toUpperCase(), 80, 150, 34, 700, CV_ACENTO);
  cvTexto(c, 'Voy a cursar', 80, 260, 100, 800);
  const px = nombres.length > 7 ? 36 : 44;
  let y = 360;
  nombres.slice(0, 9).forEach(n => { cvLineas(c, n, 900, px, 600).slice(0, 2).forEach((l, i) => { cvTexto(c, (i ? '   ' : '•  ') + l, 80, y, px, 600); y += px * 1.3; }); y += 14; });
  if (nombres.length > 9) cvTexto(c, 'y ' + (nombres.length - 9) + ' más', 80, y, px, 400, 'rgba(255,255,255,.78)');
  cvPie(c, 1080, 1080);
  abrirImagen(cv, { archivo: 'cursada-que-cursar.png', titulo: 'Qué voy a cursar', tipo: 'que_cursar', id: V.oferta,
    intro: 'Solo los nombres de las materias: sin docentes, notas ni datos personales.', texto,
    alt: 'Tarjeta con las materias que pienso cursar: ' + nombres.join(', ') + '. Galera.' });
}

// ---------- desafío del Arcade ----------
// La misma semilla da el mismo orden de preguntas y de opciones: «Superame» juega el mismo tablero.
function rndSemilla(s) {
  let a = 0; for (const ch of String(s)) a = (Math.imul(a, 31) + ch.charCodeAt(0)) >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const semillaNueva = () => Math.random().toString(36).slice(2, 8).padEnd(6, '0');
let DESAFIO_URL = '';
function arcDesafiar() {
  const A = arcS(), r = A.res;
  if (!A.semilla || !r || !Arcade.EJES[A.tablero]) return;
  DESAFIO_URL = location.origin + location.pathname + '#desafio=' + A.tablero + '.' + A.semilla + '.' + r.puntos;
  const txt = `Hice ${arcCero(r.puntos)} en el Arcade de Corrección de Estilo (${arcNombre(A.tablero)}). ¿Me superás? 👉 ${DESAFIO_URL}`;
  medir('share', { method: 'whatsapp', content_type: 'desafio', item_id: A.tablero });
  window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank', 'noopener');
}
// Quien abre un desafío ve el puntaje a superar y decide si juega.
function abrirDesafio(tablero, semilla, puntos) {
  if (!Arcade.EJES[tablero] || !/^[a-z0-9]{4,10}$/.test(semilla) || !(puntos > 0 && puntos <= 999999)) return false;
  irArcade();
  abrir(cab('🕹️ Te desafiaron') + `<p style="margin-top:0">Alguien hizo <b>${arcCero(puntos)}</b> en el Arcade de Corrección de Estilo (${esc(arcNombre(tablero))}). Es el mismo tablero, con las mismas preguntas en el mismo orden.</p>
    <div class="botones"><button class="btn" onclick="cerrar();arcEmpezarTeo(${arg(tablero)},${arg(semilla)},${puntos})">Aceptar el desafío</button><button class="btn lin" onclick="cerrar()">Ahora no</button></div>`, 'desafio');
  return true;
}
function arcMensajeDesafio(A, puntos) {
  if (!A.objetivo) return '';
  const d = puntos - A.objetivo;
  return `<p class="arc-record">${d > 0 ? '★ ¡LO SUPERASTE! ★' : d === 0 ? 'EMPATE' : 'TE FALTARON ' + arcCero(-d)}</p><p class="arc-tenue">Marca a superar: <span class="arc-pts">${arcCero(A.objetivo)}</span></p>`;
}

// ---------- links que llegan en el # (se llama desde manejarLinkNov) ----------
function manejarLinkCompartir() {
  const h = location.hash;
  const d = h.match(/^#desafio=([\w-]{3,12})\.([a-z0-9]{4,10})\.(\d{1,6})$/);
  if (d) { history.replaceState(null, '', location.pathname + location.search); return abrirDesafio(d[1], d[2], Number(d[3])); }
  const s = h.match(/^#horario=(.{3,3000})$/);
  if (s) {
    let t = ''; try { t = decodeURIComponent(s[1]); } catch (e) { t = ''; }
    const p = t.split('~').slice(0, 40);
    history.replaceState(null, '', location.pathname + location.search);
    if (p.length < 2 || !p.every(x => RE_ID.test(x))) { aviso('Este link de horario está incompleto'); return true; }
    abrirSemanaCompartida(p[0], p.slice(1)); return true;
  }
  return false;
}
