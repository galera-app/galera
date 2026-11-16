// Compartir: gestos para pasarle Galera a otra persona (ticket de difusión, sección A).
// Sin servidores ni terceros: las imágenes salen de un canvas, el QR es el del traspaso y los links llevan todo en el #.
// Nada de lo que se comparte lleva nombre ni datos personales. Las funciones se llaman desde app.js y arcade-ui.js.
const BRAND = { nombre: 'Galera', sitio: 'galera.com.ar', url: 'https://galera.com.ar/' };
// Sistema de Galera: fondo blanco, tinta #212121, azul #0671E0, cinta de puntos arriba, «galera» en gótica con la g azul.
const CV = { fondo: '#fff', tinta: '#212121', t2: '#4D4D4D', t3: '#717171', linea: '#E3E8EE', punto: '#ABBED1', acento: '#0671E0', mal: '#C33025' };
const CV_FUENTE = '"Instrument Sans", system-ui, sans-serif', CV_GOTICA = '"UnifrakturMaguntia", "Times New Roman", serif';
const CV_ARCADE = '"Jacquard 24", monospace'; // gótica pixelada de la imagen del desafío (recorte de 5 KB)
// Las fuentes ya están en la página; esto solo pide que estén listas antes de dibujar.
['400 20px "UnifrakturMaguntia"', '400 20px "Instrument Sans"', '600 20px "Instrument Sans"', '700 20px "Instrument Sans"', '400 20px "Jacquard 24"', '400 20px "Literata"'].forEach(f => { try { document.fonts.load(f); } catch (e) { } });

// ---------- canvas ----------
// Hilera de puntos de radio r y paso p dentro de un rectángulo (barras y cintas del sistema).
function cvPuntos(c, x, y, w, h, color, p, r) {
  c.fillStyle = color;
  for (let j = 0; j + p <= h + 0.5; j += p) for (let i = 0; i + p <= w + 0.5; i += p) { c.beginPath(); c.arc(x + i + p / 2, y + j + p / 2, r, 0, 7); c.fill(); }
}
function cvBase(w, h) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const c = cv.getContext('2d'); c.fillStyle = CV.fondo; c.fillRect(0, 0, w, h);
  // Cinta de puntos que se apaga hacia la derecha, como en las imágenes del sitio.
  for (let j = 0; j < 4; j++) for (let i = 0; i < w / 12; i++) {
    const a = Math.max(0, 1 - (i * 12) / (w * 0.6)) * 0.45;
    if (a > 0.02) { c.fillStyle = `rgba(33,33,33,${a.toFixed(2)})`; c.beginPath(); c.arc(i * 12 + 6, j * 12 + 8, 3, 0, 7); c.fill(); }
  }
  return [cv, c];
}
function cvTexto(c, t, x, y, px, peso, color, align) {
  c.font = `${Math.min(peso, 700)} ${px}px ${CV_FUENTE}`; c.fillStyle = color || CV.tinta; c.textAlign = align || 'left'; c.textBaseline = 'alphabetic'; c.fillText(t, x, y);
}
function cvLineas(c, texto, maxW, px, peso) {
  c.font = `${Math.min(peso || 600, 700)} ${px}px ${CV_FUENTE}`;
  const out = []; let l = '';
  String(texto).split(/\s+/).forEach(p => { const t = l ? l + ' ' + p : p; if (l && c.measureText(t).width > maxW) { out.push(l); l = p; } else l = t; });
  if (l) out.push(l);
  return out;
}
// «galera» en gótica con la g azul; devuelve el ancho para poner algo al lado.
function cvMarca(c, x, y, px, align) {
  c.font = `400 ${px}px ${CV_GOTICA}`; c.textBaseline = 'alphabetic';
  const g = c.measureText('g').width, r = c.measureText('alera').width;
  const x0 = align === 'right' ? x - g - r : x;
  c.textAlign = 'left'; c.fillStyle = CV.acento; c.fillText('g', x0, y); c.fillStyle = CV.tinta; c.fillText('alera', x0 + g, y);
}
function cvPie(c, w, h) {
  c.fillStyle = CV.linea; c.fillRect(80, h - 140, w - 160, 2);
  cvMarca(c, 80, h - 52, 76);
  cvTexto(c, BRAND.sitio, w - 80, h - 56, 30, 400, CV.t2, 'right');
}
// Tarjeta cuadrada con un dato grande al centro.
function cvDato({ kicker, grande, lineas, barra }) {
  const [cv, c] = cvBase(1080, 1080);
  cvTexto(c, kicker.toUpperCase(), 80, 170, 30, 600, CV.t2);
  cvTexto(c, grande, 80, 480, grande.length > 5 ? 180 : 240, 600, CV.tinta);
  if (barra != null) {
    cvPuntos(c, 80, 530, 920, 27, CV.punto, 9, 3.4);
    cvPuntos(c, 80, 530, Math.max(18, Math.round(920 * barra / 100 / 9) * 9), 27, CV.acento, 9, 3.4);
  }
  let y = barra != null ? 660 : 590;
  lineas.forEach(([t, px, peso]) => { cvLineas(c, t, 920, px, peso).slice(0, 4).forEach(l => { cvTexto(c, l, 80, y, px, peso, peso < 600 ? CV.t2 : CV.tinta); y += px * 1.3; }); y += 10; });
  cvPie(c, 1080, 1080);
  return cv;
}

// ---------- línea de afiche (CP1 a CP5, 15/11/2026) ----------
// Plan a un amigo y «Mi semana»: papel crudo o el oscuro de la app, lo elige quien comparte (CP4). Valores de los prototipos
// de propuestas/2026-11-12-materia-aprobada/lienzo/ (plan_amigo.py, mi_semana.py, compartir_oscuro.py).
// grab: el grabado de fondo; t3: texto tenue; mezcla: cuánto del pigmento va en el fondo de un bloque; modo: cómo se apoya la
// capitular azul sobre el grabado; grano: opacidad del ruido de papel; kicker: la línea en versalitas; sub: el horario dentro de
// un bloque; bloqueTinta: la sigla del bloque va en tinta (oscuro) o en su pigmento (claro).
const CV_TEMA = {
  claro: { papel: '#EEE6D3', tinta: '#1E1B18', azul: '#0671E0', azulTexto: '#0560C8', grab: '#9A8F7C', t3: '#6B6458', gris: '#C9C2B4',
    linea: 'rgba(30,27,24,.12)', regular: '#B9860A', mezcla: 0.28, modo: 'multiply', grano: 0.25, kicker: '#E0412C', sub: '#4A443B', bloqueTinta: false },
  oscuro: { papel: '#14171A', tinta: '#ECEFF1', azul: '#5AA9F5', azulTexto: '#5AA9F5', grab: '#59626A', t3: '#A3ABB1', gris: '#A3ABB1',
    linea: 'rgba(236,239,241,.14)', regular: '#D9B04E', mezcla: 0.42, modo: 'screen', grano: 0.08, kicker: '#F07A63', sub: '#A3ABB1', bloqueTinta: true },
};
function cvPapel(w, h, T) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const c = cv.getContext('2d'); c.fillStyle = T.papel; c.fillRect(0, 0, w, h);
  return [cv, c];
}
// Máscaras de img/grabados/ (tools/grabados_compartir.py, datos/grabados.json): se piden solo al compartir y quedan en memoria.
const GRABADOS = {};
function cvCargarGrabado(nombre) {
  if (!GRABADOS[nombre]) GRABADOS[nombre] = new Promise((ok, mal) => {
    const im = new Image(); im.onload = () => ok(im); im.onerror = () => { delete GRABADOS[nombre]; mal(new Error('grabado ' + nombre)); };
    im.src = '/img/grabados/' + nombre + '.webp';
  });
  return GRABADOS[nombre];
}
// Grabado teñido de un color: cubre el rectángulo (como background-size:cover) y se tiñe con source-in en un canvas aparte.
// nombre: id del grabado, o id-recorte («stradanus-semana-historia»). Devuelve una promesa.
async function cvGrabado(c, nombre, x, y, w, h, color, alfa) {
  const im = await cvCargarGrabado(nombre);
  const t = document.createElement('canvas'); t.width = Math.round(w); t.height = Math.round(h);
  const k = t.getContext('2d'), e = Math.max(w / im.width, h / im.height);
  k.drawImage(im, (w - im.width * e) / 2, (h - im.height * e) / 2, im.width * e, im.height * e);
  k.globalCompositeOperation = 'source-in'; k.fillStyle = color; k.fillRect(0, 0, w, h);
  c.save(); c.globalAlpha = alfa == null ? 0.85 : alfa; c.drawImage(t, x, y); c.restore();
}
// Letra gótica grande en azul: multiply sobre el papel claro y screen sobre el oscuro, para que el grabado se vea a través.
function cvCapitular(c, letra, x, y, px, T) {
  c.save(); c.font = `400 ${px}px ${CV_GOTICA}`; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  c.globalCompositeOperation = T.modo; c.fillStyle = T.azul; c.fillText(letra, x, y); c.restore();
}
// Ruido de papel: una tesela de 256 px que se arma una sola vez y se repite.
let GRANO = null;
function cvGrano(c, w, h, T) {
  if (!GRANO) {
    GRANO = document.createElement('canvas'); GRANO.width = GRANO.height = 256;
    const k = GRANO.getContext('2d'), d = k.createImageData(256, 256);
    for (let i = 3; i < d.data.length; i += 4) d.data[i] = Math.max(0, Math.random() * 0.55 - 0.12) * 255;
    k.putImageData(d, 0, 0);
  }
  c.save(); c.globalAlpha = T.grano; c.globalCompositeOperation = 'multiply';
  c.fillStyle = c.createPattern(GRANO, 'repeat'); c.fillRect(0, 0, w, h); c.restore();
}
// Pie de afiche: «galera» en gótica con la g azul a la izquierda y galera.com.ar a la derecha (más chico en la cuadrada).
function cvPie2(c, w, h, T, chico) {
  const y = chico ? h - 44 : h - 88, m = chico ? 60 : 80;
  c.font = `400 ${chico ? 56 : 84}px ${CV_GOTICA}`; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  const g = c.measureText('g').width;
  c.fillStyle = T.azul; c.fillText('g', m, y); c.fillStyle = T.tinta; c.fillText('alera', m + g, y);
  cvTexto(c, BRAND.sitio, w - m, y, chico ? 22 : 30, 400, T.tinta, 'right');
}

// Diálogo con la imagen armada: se puede compartir (si el sistema lo permite) o bajar. Se muestra con data: porque la CSP no admite blob: en img.
// Las piezas de la línea de afiche traen o.dibujar(tema, formato), que devuelve el canvas (o una promesa): el diálogo suma
// Clara u Oscura (CP4: lo elige quien comparte) y Cuadrada o Historia, y vuelve a dibujar con cada cambio. o.formatos === false
// deja solo el tema. La última elección se recuerda en este navegador. Las piezas sin dibujar pasan el canvas hecho, como antes.
let IMG_COMP = null, IMG_GEN = 0; // IMG_GEN: solo vale el último dibujo pedido (dos toques seguidos o cerrar a mitad de camino)
const PREF_IMG = 'galera.imagen';
function prefImagen() {
  let p = {}; try { p = JSON.parse(localStorage.getItem(PREF_IMG) || '{}') || {}; } catch (e) { }
  return { tema: p.tema === 'oscuro' ? 'oscuro' : 'claro', formato: p.formato === 'cuadrada' ? 'cuadrada' : 'historia' };
}
function elegirImagen(k, v) {
  if (!IMG_COMP || !IMG_COMP.o.dibujar) return;
  const p = Object.assign(prefImagen(), { [k]: v });
  try { localStorage.setItem(PREF_IMG, JSON.stringify(p)); } catch (e) { }
  abrirImagen(null, IMG_COMP.o, true);
}
async function abrirImagen(cv, o, redibujo) {
  const gen = ++IMG_GEN;
  const vigente = () => gen === IMG_GEN && (!redibujo || ($('#dlg').open && $('#dlg').dataset.k === 'img-comp'));
  let opc = '', p = null;
  if (o.dibujar) {
    p = prefImagen();
    try { cv = await o.dibujar(CV_TEMA[p.tema], o.formatos === false ? null : p.formato); } catch (e) { return vigente() && aviso('No se pudo armar la imagen'); }
    if (!vigente()) return;
    const seg = (rotulo, k, ops) => `<div class="gl-seg" role="group" aria-label="${rotulo}">${ops.map(([v, n]) =>
      `<button type="button" class="${p[k] === v ? 'on' : ''}" aria-pressed="${p[k] === v}" data-clic="elegirImagen" data-clic-a="[${arg(k)},${arg(v)}]">${n}</button>`).join('')}</div>`;
    opc = `<div class="img-comp-opc">${seg('Fondo', 'tema', [['claro', 'Clara'], ['oscuro', 'Oscura']])}${o.formatos === false ? '' : seg('Formato', 'formato', [['cuadrada', 'Cuadrada'], ['historia', 'Historia']])}</div>`;
  }
  const alt = typeof o.alt === 'function' ? o.alt(p) : o.alt;
  cv.toBlob(blob => {
    if (!vigente()) return;
    if (!blob) return aviso('No se pudo armar la imagen');
    const file = new File([blob], o.archivo, { type: 'image/png' });
    const puede = !!(navigator.canShare && navigator.canShare({ files: [file] }));
    IMG_COMP = { blob, file, o };
    abrir(cab(o.titulo) + `<p class="chico tenue u-margin-top-0">${esc(o.intro)}</p>${opc}
      <img class="img-comp" src="${cv.toDataURL('image/png')}" alt="${esc(alt)}" width="${cv.width}" height="${cv.height}">
      <div class="botones">${puede ? '<button class="btn" data-clic="enviarImagen">Compartir</button>' : ''}<button class="btn ${puede ? 'sec' : ''}" data-clic="bajarImagen">Descargar (.png)</button><button class="btn lin" data-clic="cerrar">Cerrar</button></div>`, 'img-comp');
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
  abrir(cab('Código QR') + `<p class="u-margin-top-0"><b>${esc(titulo)}</b></p><div class="qr-caja">${Traspaso.qrSvg(m, 'Código QR de ' + titulo)}</div>
    <p class="chico tenue u-text-align-center_overflow-wrap-anywhere">${esc(url)}</p>
    <p class="chico tenue">Sirve para pegarlo en una cartelera o en un apunte en papel: quien lo escanee abre esta misma pantalla.</p>
    <div class="botones"><button class="btn" data-clic="bajarQR">Descargar (.png)</button><button class="btn sec" data-clic="copiarQrActual">Copiar el link</button><button class="btn lin" data-clic="cerrar">Cerrar</button></div>`, 'qr');
}
function abrirQRPantalla() { abrirQR(urlCompartible(), document.title.replace(/\s*·\s*Galera$/, '') || BRAND.nombre, 'pantalla', V.tab); }
function bajarQR() {
  if (!QR_ACTUAL) return;
  const { m, titulo } = QR_ACTUAL, n = m.length, k = Math.max(6, Math.ceil(900 / (n + 8))), lado = (n + 8) * k, banda = 150;
  const cv = document.createElement('canvas'); cv.width = lado; cv.height = lado + banda;
  const c = cv.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, cv.width, cv.height); c.fillStyle = CV.tinta;
  m.forEach((fila, y) => fila.forEach((v, x) => { if (v) c.fillRect((x + 4) * k, (y + 4) * k, k, k); }));
  const px = Math.min(44, Math.floor(lado / 16));
  cvLineas(c, titulo, lado - 80, px, 700).slice(0, 2).forEach((l, i) => cvTexto(c, l, lado / 2, lado + 6 + px * (i + 1) * 1.15, px, 700, CV.tinta, 'center'));
  cvMarca(c, lado / 2, lado + banda - 14, Math.floor(px * 1.1), 'center');
  cv.toBlob(b => { if (!b) return; const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'galera-qr.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }, 'image/png');
}

// ---------- autoevaluación: resultado e invitación ----------
function mandarApunte(materia, apunte) {
  const m = (D.resumenes.materias || []).find(x => x.id === materia), a = D.apuntes[materia + '/' + apunte];
  const txt = `Te paso este apunte${m ? ' de ' + m.nombre : ''}${a ? ': ' + a.titulo : ''}, con autoevaluación. Gratis y sin cuenta: ${urlRes(materia, apunte)}`;
  medir('share', { method: 'whatsapp', content_type: 'apunte', item_id: materia + '/' + apunte });
  window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank', 'noopener');
}
function compartirResultado(materia, apunte, bien, total) {
  const m = (D.resumenes.materias || []).find(x => x.id === materia) || { nombre: '' }, a = D.apuntes[materia + '/' + apunte];
  if (!a) return;
  const cv = cvDato({ kicker: 'Autoevaluación · ' + m.nombre, grande: bien + ' de ' + total, barra: total ? Math.round(bien * 100 / total) : 0,
    lineas: [[a.titulo, 50, 700], [bien === total ? '¡Todas bien!' : 'Sigo practicando.', 38, 400]] });
  abrirImagen(cv, { archivo: 'galera-resultado.png', titulo: 'Mi resultado', tipo: 'resultado', id: materia + '/' + apunte,
    intro: 'Es solo el puntaje y el nombre del apunte: no lleva tu nombre ni otros datos.', texto: `Me salió ${bien} de ${total} en la autoevaluación de «${a.titulo}». ¿Y a vos? ${urlRes(materia, apunte)}`,
    alt: `Tarjeta con el resultado: ${bien} de ${total} en la autoevaluación de ${a.titulo} (${m.nombre}), en Galera.` });
}
// Se muestra al final de cada autoevaluación.
function bloqueFinAuto(materia, apunte, bien, hechas, total) {
  const completa = total > 0 && hechas === total;
  return `<div class="gl-tarjeta gl-accion no-imprimir gl-m16"><div>${completa ? `Terminaste: <b>${bien} de ${total}</b>. ` : ''}<span class="gl-chico">¿Le sirve a alguien de tu cursada?</span></div>
    ${completa ? `<button class="gl-btn gl-btn--sec" type="button" data-clic="compartirResultado" data-clic-a="[${arg(materia)},${arg(apunte)},${ja(bien)},${ja(total)}]">Mi resultado en imagen</button>` : ''}
    <button class="gl-btn gl-btn--ter" type="button" data-clic="mandarApunte" data-clic-a="[${arg(materia)},${arg(apunte)}]">Mandale este apunte por WhatsApp</button></div>`;
}

// ---------- mi avance ----------
function compartirAvance() {
  const p = progreso(), av = Math.round(p.total[0] * 100 / p.total[1]);
  const cv = cvDato({ kicker: 'Mi carrera de Edición', grande: av + ' %', barra: av, lineas: [['Llevo el ' + av + ' % de la carrera.', 54, 700], [p.total[0] + ' de ' + p.total[1] + ' requisitos aprobados.', 38, 400]] });
  abrirImagen(cv, { archivo: 'galera-avance.png', titulo: 'Mi avance', tipo: 'avance', id: String(av),
    intro: 'Solo el porcentaje: sin materias, notas ni nombre. Vos decidís si la compartís.', texto: `Llevo el ${av} % de la carrera de Edición. ${BRAND.url}`,
    alt: `Tarjeta: llevo el ${av} % de la carrera de Edición, ${p.total[0]} de ${p.total[1]} requisitos aprobados. Galera.` });
}

// ---------- mi semana ----------
// Banda de afiche (Stradanus con el encuadre del prensista y la S gótica), «Mi semana», grilla de la primera a la última hora con
// bloques tenues en el pigmento fijo de cada materia (CP3, CP10) y leyenda con sigla y nombre. Sin docentes ni datos personales.
// Medidas del prototipo propuestas/2026-11-12-materia-aprobada/lienzo/mi_semana.py (historia y 1:1).
let PIGMENTOS = null;
const cargarPigmentos = () => PIGMENTOS || (PIGMENTOS = json('pigmentos.json').then(d => d.pigmentos).catch(e => { PIGMENTOS = null; throw e; }));
// Color de cada materia de la semana: su pigmento fijo; si otra de la misma semana ya lo usa (o no tiene, como las cargadas a mano),
// el siguiente liso libre.
// Dos pasadas, para que el color no dependa del orden en que se eligieron las comisiones: primero cada materia toma su pigmento si
// nadie lo tomó; después las que quedaron (sin pigmento o repetido) toman el siguiente libre.
function coloresSemana(ids, pigs) {
  const lisos = pigs.filter(p => p.plano), usados = new Set(), out = {}, resto = [];
  const propio = id => { const m = D.plan.materias.find(x => x.id === id || (x.opciones || []).some(o => o.id === id)); return m ? lisos.findIndex(p => p.nombre === m.pigmento) : -1; };
  ids.forEach(id => { const i = propio(id); if (i >= 0 && !usados.has(lisos[i].nombre)) { usados.add(lisos[i].nombre); out[id] = lisos[i].hex; } else resto.push([id, i]); });
  resto.forEach(([id, i]) => {
    const j = lisos.findIndex((p, k) => k > i && !usados.has(p.nombre)), k = j >= 0 ? j : lisos.findIndex(p => !usados.has(p.nombre));
    const x = k >= 0 ? k : (i >= 0 ? i : 0);
    usados.add(lisos[x].nombre); out[id] = lisos[x].hex;
  });
  return out;
}
// Mezcla un color con el papel del tema (a = cuánto del color).
function cvMezcla(hex, a, papel) {
  const h = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16)), c = h(hex), p = h(papel);
  return '#' + c.map((v, i) => Math.round(p[i] + (v - p[i]) * a).toString(16).padStart(2, '0')).join('');
}
// Texto con la parte de arriba en y (como top en CSS con line-height 1). o: fam, align, esp (letter-spacing en em), max (ancho).
function cvArriba(c, t, x, y, px, peso, color, o) {
  o = o || {};
  c.font = `${peso} ${px}px ${o.fam || CV_FUENTE}`; c.fillStyle = color; c.textAlign = o.align || 'left'; c.textBaseline = 'top';
  if ('letterSpacing' in c) c.letterSpacing = (o.esp || 0) * px + 'px';
  let s = String(t);
  if (o.max) while (s.length > 1 && c.measureText(s).width > o.max) s = s.slice(0, -2).trimEnd() + '…';
  c.fillText(s, x, y);
  if ('letterSpacing' in c) c.letterSpacing = '0px';
}
function cvSemana(sel, titulo) {
  const hhmm = s => s.endsWith(':00') ? s.slice(0, 2) : s;
  return async (T, formato) => {
    const [pigs] = await Promise.all([cargarPigmentos(), document.fonts.load('400 20px "Literata"').catch(() => { })]);
    const H = formato === 'cuadrada' ? 1080 : 1920, chico = H === 1080, e = chico ? 0.72 : 1;
    const [cv, c] = cvPapel(1080, H, T);
    const bl = sel.flatMap(x => x.bloques.map(b => ({ x, b, d: b.dia, a: Horarios.min(b.desde), z: Horarios.min(b.hasta) })));
    const ids = [...new Set(sel.map(x => x.materia))], col = coloresSemana(ids, pigs);
    // Banda
    const alto = chico ? 260 : 480;
    c.save(); c.beginPath(); c.rect(0, 0, 1080, alto); c.clip();
    await cvGrabado(c, chico ? 'stradanus-semana-cuadrada' : 'stradanus-semana-historia', 0, 0, 1080, alto, T.grab);
    cvCapitular(c, 'S', -30, alto * 0.98, Math.min(alto * 1.15, 340), T);
    c.restore();
    cvArriba(c, 'Mi semana', 70, chico ? 284 : 520, chico ? 64 : 104, 600, T.tinta, { esp: -0.035 });
    cvArriba(c, String(titulo).toUpperCase(), 74, chico ? 358 : 640, chico ? 18 : 24, 600, T.kicker, { esp: 0.12, max: 930 });
    // Grilla
    const dias = bl.some(x => x.d === 6) ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5];
    const h0 = Math.floor(Math.min(...bl.map(x => x.a)) / 60), h1 = Math.max(Math.ceil(Math.max(...bl.map(x => x.z)) / 60), h0 + 4);
    const top = chico ? 440 : 760, altoG = chico ? 420 : 640, L = chico ? 130 : 150, R = 1010, cw = (R - L) / dias.length, ph = altoG / (h1 - h0);
    const paso = h1 - h0 > 6 ? 2 : 1;
    dias.forEach((d, i) => cvArriba(c, Horarios.DIAS[d].slice(0, 3), L + i * cw + cw / 2, top - 46 * e, 30 * e, 600, T.tinta, { align: 'center' }));
    for (let h = h0; h <= h1; h += paso) {
      const y = top + (h - h0) * ph;
      c.fillStyle = T.linea; c.fillRect(L, y, R - L, 2);
      cvArriba(c, String(h).padStart(2, '0'), L - 80 * e, y - 14 * e, 28 * e, 400, T.t3);
    }
    bl.forEach(({ x, b, d, a, z }) => {
      const i = dias.indexOf(d); if (i < 0) return;
      const bx = L + i * cw + 5, by = top + (a / 60 - h0) * ph + 4, bw = cw - 10, bh = Math.max(30 * e, (z - a) / 60 * ph - 8), p = col[x.materia];
      c.fillStyle = cvMezcla(p, T.mezcla, T.papel); c.fillRect(bx, by, bw, bh);
      c.fillStyle = p; c.fillRect(bx, by, 8 * e, bh);
      c.save(); c.beginPath(); c.rect(bx, by, bw, bh); c.clip();
      const tx = bx + 22 * e, ty = by + 12 * e;
      cvArriba(c, siglaMateria(x.materia), tx, ty, 34 * e, 700, T.bloqueTinta ? T.tinta : p, { max: bw - 30 * e });
      if (bh > 74 * e) cvArriba(c, hhmm(b.desde) + '–' + hhmm(b.hasta), tx, ty + 40 * e, 24 * e, 400, T.sub);
      c.restore();
    });
    // Leyenda: sigla y nombre de cada materia. Los nombres reales son largos: en la historia van en una columna hasta seis materias
    // (dos si hay más); en la cuadrada, en dos columnas (tres si hay más de seis).
    // Si son muchas, las filas se achican para no pisar el pie. Las materias cargadas a mano dicen solo «Materia propia»: su nombre es
    // texto libre y podría llevar datos personales.
    const n = ids.length, cols = chico ? (n > 6 ? 3 : 2) : (n > 6 ? 2 : 1), x0 = 74, colw = 930 / cols, ly = chico ? 895 : 1450;
    const fila0 = chico ? (cols === 3 ? 30 : 33) : (cols === 1 ? 48 : 50), achica = Math.min(1, (chico ? 92 : 300) / (Math.ceil(n / cols) * fila0));
    const k = (chico ? (cols === 3 ? 0.6 : 0.66) : (cols === 1 ? 0.9 : 0.8)) * achica, fila = fila0 * achica;
    const conocida = id => D.plan.materias.some(x => x.id === id || (x.opciones || []).some(o => o.id === id)) || !!extra(id);
    ids.forEach((id, j) => {
      const lx = x0 + (j % cols) * colw, yy = ly + Math.floor(j / cols) * fila;
      c.fillStyle = col[id]; c.fillRect(lx, yy, 40 * k, 40 * k);
      cvArriba(c, siglaMateria(id), lx + 54 * k, yy + 6 * k, 28 * k, 700, T.tinta, { max: 80 * k });
      cvArriba(c, conocida(id) ? nombreMateria(id) : 'Materia propia', lx + 128 * k, yy + 4 * k, 30 * k, 400, T.tinta, { fam: '"Literata", Georgia, serif', max: colw - 146 * k });
    });
    cvGrano(c, 1080, H, T);
    cvPie2(c, 1080, H, T, chico);
    return cv;
  };
}
function imagenSemana() {
  const sel = elegidas();
  if (!sel.length) return aviso('Elegí primero tus comisiones');
  const nombre = oferta().nombre || 'Mi semana';
  abrirImagen(null, { archivo: 'galera-mi-semana.png', titulo: 'Mi semana', tipo: 'horario', id: V.oferta, dibujar: cvSemana(sel, nombre),
    intro: 'Sin tu nombre ni tus notas: solo las materias y los horarios.', texto: 'Así me queda el cuatrimestre. Armalo vos también: ' + BRAND.url,
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
  abrir(cab('Link para ver mi horario') + `<p class="u-margin-top-0">Quien lo abra ve tu semana <b>en modo lectura</b>, sin cuenta y sin poder cambiar nada. No lleva notas ni otros datos tuyos.</p>
    ${m ? `<div class="qr-caja">${Traspaso.qrSvg(m, 'Código QR con tu horario')}</div>` : ''}
    <div class="botones"><button class="btn" data-clic="copiarHorLink">Copiar el link</button>${navigator.share ? '<button class="btn sec" data-clic="compartirHorLink">Compartir</button>' : ''}<button class="btn lin" data-clic="cerrar">Cerrar</button></div>`, 'hor-link');
}
async function abrirSemanaCompartida(oferta_, ids) {
  const of = (D.ofertas || []).find(o => o.id === oferta_);
  const sel = of ? ids.map(id => of.comisiones.find(c => c.id === id)).filter(Boolean) : [];
  if (!sel.length) return abrir(cab('Horario compartido') + `<p>Este horario es de un cuatrimestre que no está cargado o el link quedó incompleto.</p><div class="botones"><button class="btn" data-clic="cerrar">Cerrar</button></div>`, 'hor-comp');
  // Si el grabado o los pigmentos no llegan, queda la lista sola.
  const cv = await cvSemana(sel, of.nombre)(CV_TEMA.claro, 'cuadrada').catch(() => null);
  abrir(cab('Horario compartido') + `<p class="chico tenue u-margin-top-0">Alguien te pasó su semana. Solo se puede mirar: no cambia nada de lo tuyo.</p>
    ${cv ? `<img class="img-comp" src="${cv.toDataURL('image/png')}" alt="Grilla semanal del horario compartido" width="1080" height="1080">` : ''}${listaSemana(sel)}
    <div class="botones"><button class="btn" data-clic="cerrarIr" data-clic-a="[&quot;horarios&quot;]">Armar el mío</button><button class="btn lin" data-clic="cerrar">Cerrar</button></div>`, 'hor-comp');
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
  abrir(cab(T) + `<p class="u-margin-top-0">Tu amigo abre el link y ya tiene cargadas las <b>${n} ${n === 1 ? 'materia' : 'materias'}</b> en las que estás (aprobadas y cursando). <b>No van tus notas, fechas, horarios ni apuntes.</b></p>
    ${m ? `<div class="qr-caja">${Traspaso.qrSvg(m, 'Código QR con tu plan, sin notas')}</div>` : '<p class="chico tenue">Es un link largo para un QR: usá «Copiar el link».</p>'}
    <div class="botones"><button class="btn" data-clic="copiarAmigoUrl">Copiar el link</button><button class="btn sec" data-clic="imagenPlan">Imagen</button>${navigator.share ? '<button class="btn sec" data-clic="compartirAmigoUrl">Compartir</button>' : ''}<button class="btn lin" data-clic="cerrar">Cerrar</button></div>
    <p class="chico tenue u-margin-top-10px">El link lleva el plan adentro y no pasa por ningún servidor. Mandalo solo a quien quieras.</p>`, 'amigo');
}

// Imagen del plan (CP1, CP5): afiche con la P gótica sobre un grabado sorteado del banco y la lista en Literata. Cada aprobada lleva
// su ejemplar (inicial azul sobre su grabado en su pigmento) y dice solo «aprobada»; regular en mostaza y cursando en azul. Sin nombre
// (CP11), sin notas ni fechas. Hasta que exista el sorteo de materia aprobada (paso 19), el ejemplar sale del pigmento fijo de la
// materia y de un grabado de su nivel elegido por el id de la materia, siempre el mismo. Medidas de lienzo/plan_amigo.py.
let GRABADOS_DATOS = null;
const cargarGrabados = () => GRABADOS_DATOS || (GRABADOS_DATOS = json('grabados.json').then(d => d.grabados).catch(e => { GRABADOS_DATOS = null; throw e; }));
const hashTexto = s => [...String(s)].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
const cuatrimestreHoy = () => { const d = new Date(); return (d.getMonth() < 7 ? '1.er' : '2.º') + ' cuatrimestre ' + d.getFullYear(); };
// Parte un texto en renglones de ancho máximo con la fuente dada.
function cvPartir(c, texto, maxW, font) {
  c.font = font; const out = []; let l = '';
  String(texto).split(/\s+/).forEach(p => { const t = l ? l + ' ' + p : p; if (l && c.measureText(t).width > maxW) { out.push(l); l = p; } else l = t; });
  if (l) out.push(l);
  return out;
}
function materiasPlan() {
  const e = planParaAmigo();
  return D.plan.materias.filter(m => e.materias[m.id]).map(m => {
    const x = e.materias[m.id], nombre = nombreMateria(x.opcion || m.id);
    return { id: m.id, nombre, ini: nombre.trim().charAt(0).toUpperCase(), estado: x.estado, pigmento: m.pigmento };
  });
}
function cvPlan(items) {
  let fondo = null; // el grabado de fondo se sortea una vez por diálogo: cambiar tema o formato no lo cambia
  return async (T, formato) => {
    const [pigs, banco] = await Promise.all([cargarPigmentos(), cargarGrabados(),
      document.fonts.load('400 20px "Literata"').catch(() => { }), document.fonts.load('italic 400 20px "Literata"').catch(() => { })]);
    const tiradas = banco.filter(g => g.nivel === 'tirada');
    if (!fondo) fondo = tiradas[Math.floor(Math.random() * tiradas.length)].id;
    const H = formato === 'cuadrada' ? 1080 : 1920, chico = H === 1080;
    const g = chico ? { gl: -150, gt: 40, gw: 600, gh: 880, cw: 450, ch: 930, px: -210, py: 830, ps: 760, x: 480, tt: 70, ts: 84, kt: 170, ks: 19, lt: 225, t: 46, letra: 50, f1: 25, f2: 19, mb: items.length > 5 ? 12 : 18, nm: 6, nota: 22, fin: 960 }
      : { gl: -200, gt: 260, gw: 780, gh: 1300, cw: 570, ch: 1920, px: -300, py: 1420, ps: 1250, x: 600, tt: 300, ts: 112, kt: 430, ks: 24, lt: 520, t: 64, letra: 70, f1: 31, f2: 24, mb: 26, nm: 20, nota: 28, fin: 1720 };
    const [cv, c] = cvPapel(1080, H, T);
    await cvGrabado(c, fondo, g.gl, g.gt, g.gw, g.gh, T.grab);
    c.save(); c.beginPath(); c.rect(0, 0, g.cw, g.ch); c.clip(); cvCapitular(c, 'P', g.px, g.py, g.ps, T); c.restore();
    cvArriba(c, 'Mi plan', g.x, g.tt, g.ts, 600, T.tinta, { esp: -0.035 });
    const x0 = g.x + 4, W = 1080 - 60 - x0;
    // Cuatrimestre y carrera (CP11: sin nombre); si no entran en un renglón (la historia es angosta), van en dos.
    const kick = [cuatrimestreHoy().toUpperCase(), 'EDICIÓN, FFYL'];
    c.font = `600 ${g.ks}px ${CV_FUENTE}`;
    const unaLinea = c.measureText(kick.join(' · ')).width * 1.12 <= W;
    (unaLinea ? [kick.join(' · ')] : kick).forEach((l, i) => cvArriba(c, l, x0, g.kt + i * g.ks * 1.4, g.ks, 600, T.kicker, { esp: 0.12, max: W }));
    // Si la lista no entra, se achica todo junto (hasta un 60 %). Si igual no entra (quien va avanzado), las aprobadas van en un solo
    // renglón, «N aprobadas», con el ejemplar de la primera, y se listan las regulares y las que cursa (Fidel, 16/11).
    const LIT = '"Literata", Georgia, serif';
    const medir = (lista, k) => lista.map(m => {
      const t = g.t * k, gap = t * 0.28, f1 = g.f1 * k, f2 = g.f2 * k;
      const ls = cvPartir(c, m.nombre, W - t - gap, `400 ${f1}px ${LIT}`), alto = ls.length * f1 * 1.1 + (m.resumen ? 0 : f2 * 1.3);
      return { m, t, gap, f1, f2, ls, alto, fila: Math.max(t, alto) };
    });
    const ajustar = lista => {
      for (let k = 1; ; k -= 0.05) {
        const filas = medir(lista, k), total = filas.reduce((s, f) => s + f.fila + g.mb * k, 0) + g.nm * k + g.nota * k * 1.3;
        if (g.lt + total <= g.fin || k <= 0.6) return { k, filas, entra: g.lt + total <= g.fin };
      }
    };
    let { k, filas, entra } = ajustar(items);
    const aprob = items.filter(m => m.estado === 'aprobada');
    if (!entra && aprob.length > 1) ({ k, filas } = ajustar([Object.assign({}, aprob[0], { resumen: true, nombre: aprob.length + ' aprobadas' }),
      ...items.filter(m => m.estado !== 'aprobada')]));
    let y = g.lt;
    for (const f of filas) {
      const { m, t, gap, f1, f2, ls, alto, fila } = f, cy = y + (fila - t) / 2;
      let etiqueta = m.resumen ? '' : m.estado, color;
      if (m.estado === 'aprobada') {
        const lisos = pigs.filter(p => p.plano), pig = lisos.find(p => p.nombre === m.pigmento) || lisos[hashTexto(m.id) % lisos.length];
        const deNivel = banco.filter(b => b.nivel === pig.nivel), grab = (deNivel.length ? deNivel : banco)[hashTexto(m.id) % (deNivel.length || banco.length)];
        c.fillStyle = pig.papel; c.fillRect(x0, cy, t, t);
        await cvGrabado(c, grab.id, x0, cy, t, t, pig.hex, 1);
        c.save(); c.beginPath(); c.rect(x0, cy, t, t); c.clip();
        cvArriba(c, m.ini, x0 + t * 0.09, cy - t * 0.07, g.letra * k, 400, pig.azul, { fam: CV_GOTICA });
        c.restore();
        color = T.bloqueTinta ? cvMezcla(pig.hex, 0.6, '#FFFFFF') : pig.hex;
      } else {
        color = m.estado === 'regular' ? T.regular : T.azulTexto;
        c.strokeStyle = color; c.lineWidth = 3; c.strokeRect(x0 + 1.5, cy + 1.5, t - 3, t - 3);
        c.font = `400 ${g.letra * k * 0.8}px ${CV_GOTICA}`; c.fillStyle = color; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(m.ini, x0 + t / 2, cy + t / 2 + 2);
      }
      let ty = y + (fila - alto) / 2;
      ls.forEach(l => { cvArriba(c, l, x0 + t + gap, ty, f1, 400, T.tinta, { fam: LIT }); ty += f1 * 1.1; });
      cvArriba(c, etiqueta, x0 + t + gap, ty + f2 * 0.15, f2, 'italic 400', color, { fam: LIT });
      y += fila + g.mb * k;
    }
    cvArriba(c, 'Armá el tuyo en galera.com.ar', x0, y + g.nm * k, g.nota * k, 'italic 400', T.t3, { fam: LIT, max: W });
    cvGrano(c, 1080, H, T);
    cvPie2(c, 1080, H, T, chico);
    return cv;
  };
}
function imagenPlan() {
  if (V.demo) return aviso('Estás viendo el ejemplo: salí del ejemplo para pasar tu plan');
  const items = materiasPlan();
  if (!items.length) return aviso('Marcá primero qué materias aprobaste o cursás');
  abrirImagen(null, { archivo: 'galera-mi-plan.png', titulo: 'Mi plan', tipo: 'plan', id: 'amigo', dibujar: cvPlan(items),
    intro: 'Sin tu nombre ni tus notas: solo las materias y en qué estado están.', texto: 'Así voy en la carrera. Armá tu plan en Galera: ' + BRAND.url,
    alt: 'Mi plan de Edición: ' + items.map(m => m.nombre + ', ' + m.estado).join('; ') + '.' });
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
// Los de la carrera se calculan desde lo que ya está cargado. Los de ayudar a Galera (v174) salen de E.extras: solo fechas y la figura elegida.
// La imagen lleva solo el logro, sin materias, notas, montos ni nombre.
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
  const X = E.extras || {}, ay = (id, grande, frase, detalle) => mk(id, grande, frase, { detalle, kicker: 'Ayudo a Galera', texto: frase + ' ' + BRAND.url });
  if (X.mail) ay('mail', 'Al día', 'Recibo las novedades de Galera por mail.', 'Los lunes, solo lo que me importa.');
  if (X.respuesta) ay('respuesta', 'Respuesta', 'Respondí una pregunta en Galera.', 'Para que la próxima persona no tenga que preguntar.');
  if (X.resumen) ay('resumen', 'Resumen', 'Sumé mis apuntes a Galera.', 'Para quien cursa después.');
  if (X.cafe) ay('cafe', 'Café', 'Le invité un café a Galera.', 'Para que siga gratis para quienes estudian Edición.');
  const fig = X.mecenas && (MECENAS[X.mecenas.n] || []).find(f => f.id === X.mecenas.fig);
  if (fig) ay('mecenas', fig.corto, 'Ayudo a Galera cada mes, como ' + fig.nombre + '.', fig.dato);
  return L;
}
// Hitos de avance que se cruzaron al pasar de «prev» a «ahora» materias aprobadas.
const hitosCruzados = (prev, ahora, T) => HITOS_AVANCE.filter(n => pctAvance(prev, T) < n && pctAvance(ahora, T) >= n).map(n => 'av' + n);
function compartirLogro(id) {
  const g = logros().find(x => x.id === id);
  if (!g) return aviso('Ese logro todavía no está');
  const cv = cvDato({ kicker: g.kicker, grande: g.grande, barra: g.barra == null ? null : g.barra, lineas: [[g.frase, 54, 700], [g.detalle || '', 36, 400]].filter(l => l[0]) });
  abrirImagen(cv, { archivo: 'galera-logro-' + id + '.png', titulo: 'Mi logro', tipo: 'logro', id,
    intro: 'Solo el logro: sin materias, notas ni nombre. Vos decidís si lo compartís.', texto: g.texto,
    alt: `Tarjeta con el logro: ${g.frase} ${g.detalle || ''} Galera.` });
}
function abrirLogros() {
  if (V.demo) return aviso('Estás viendo el ejemplo: salí del ejemplo para ver tus logros');
  const L = logros(), p = progreso(), av = pctAvance(p.total[0], p.total[1]), sig = HITOS_AVANCE.find(n => n > av);
  const falta = sig ? Math.ceil(sig * p.total[1] / 100) - p.total[0] : 0;
  abrir(cab('Mis logros') + (L.length
    ? `<p class="chico tenue u-margin-top-0">Cada uno se puede compartir como imagen sobria, sin tu nombre ni tus notas.</p>
      <ul class="lista-mas">${L.slice().reverse().map(g => `<li><button type="button" data-clic="compartirLogro" data-clic-a="[${arg(g.id)}]"><span>${esc(g.frase)}<small>${esc(g.detalle || '')}</small></span><i aria-hidden="true"></i></button></li>`).join('')}</ul>`
    : '<p class="vacio">Todavía no hay logros: marcá las materias que aprobaste y aparecen solos. También hay tarjetas por ayudar a Galera: confirmar el mail de los lunes, responder una pregunta, sumar tus apuntes o hacer un aporte.</p>')
    + (falta > 0 ? `<p class="chico tenue">Para el ${sig} % te ${falta === 1 ? 'falta 1 requisito' : 'faltan ' + falta + ' requisitos'}.</p>` : '')
    + '<div class="botones"><button class="btn lin" data-clic="cerrar">Cerrar</button></div>', 'logros');
}

// ---------- tarjetas por ayudar a Galera (v174) ----------
// Mail confirmado y respuesta enviada los marca la app sola. El aporte, el café y los apuntes no se pueden verificar desde acá:
// llegan por link (#aporte=N desde /gracias/, #cafe, #colaboro que Fidel manda al recibir un resumen) y se confía en quien lo abre, porque la tarjeta no da nada a cambio.
// Devuelve true solo si la tarjeta es nueva (fuera del ejemplo).
function ganarExtra(k) {
  if (V.demo || E.extras[k]) return false;
  E.extras[k] = hoy(); guardar(true); medir('logro_extra', { item_id: k });
  return true;
}
function logroExtra(k) {
  if (V.demo) return aviso('Estás viendo el ejemplo: salí del ejemplo para guardar tu tarjeta');
  ganarExtra(k); compartirLogro(k);
}
function elegirMecenas(n) {
  if (V.demo) return aviso('Estás viendo el ejemplo: salí del ejemplo para guardar tu tarjeta');
  const L = MECENAS[n];
  if (!L || !APORTES[n - 1]) return abrir(cab('Tu tarjeta por ayudar') + `<p class="chico tenue u-margin-top-0">Gracias por sumarte. ¿Qué aporte elegiste? Cada uno tiene su tarjeta, y en ninguna aparece el monto.</p>
    <ul class="lista-mas">${APORTES.map((x, i) => MECENAS[i + 1] ? `<li><button type="button" ${dAcc('elegirMecenas', String(i + 1))}><span>${esc(pesos(x.monto))} por mes</span><i aria-hidden="true"></i></button></li>` : '').join('')}</ul>
    <div class="botones"><button class="btn lin" data-clic="cerrar">Ahora no</button></div>`, 'logros');
  abrir(cab('Elegí tu tarjeta') + `<p class="chico tenue u-margin-top-0">Gracias por ayudar a Galera. Tu tarjeta lleva el nombre de alguien que hizo posibles libros y obras. Elegí cuál.</p>
    <ul class="lista-mas">${L.map(f => `<li><button type="button" ${dAcc('guardarMecenas', String(n), f.id)}><span>${esc(f.nombre)}<small>${esc(f.dato)}</small></span><i aria-hidden="true"></i></button></li>`).join('')}</ul>
    <div class="botones"><button class="btn lin" data-clic="cerrar">Ahora no</button></div>`, 'logros');
}
function guardarMecenas(n, fig) {
  if (V.demo || !(MECENAS[n] || []).some(f => f.id === fig)) return;
  E.extras.mecenas = { n: String(n), fig, f: hoy() }; guardar(true); medir('logro_extra', { item_id: 'aporte' + n });
  compartirLogro('mecenas');
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
  el.innerHTML = `<span class="crece"><b>¡Aprobaste!</b> ¿Querés dejar tu apunte para quien viene detrás?${unica ? `<small class="tenue u-display-block">${esc(nombreDe(unica))}</small>` : ''}</span>
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
  abrir(cab('Sumá tu resumen') + `<p class="chico tenue u-margin-top-0">Si tenés un resumen de una materia que ya cursaste, mandámelo por mail para quien viene detrás. <b>Lo reviso antes de publicarlo</b> (que sea correcto, que sea tuyo y que cite la bibliografía) y te aviso si hace falta algún cambio.</p>
    <label class="c">Materia</label><select class="u-width-100" id="a-m">${L.map(m => `<option value="${esc(m.id)}" ${m.id === id ? 'selected' : ''}>${esc(nombreDe(m))}</option>`).join('')}</select>
    <p class="chico tenue">Se abre tu programa de correo con el mensaje armado. Pegá el link a tu resumen (Drive, Docs…) o adjuntá el archivo, y aclarame cómo querés que te acredite.</p>
    <div class="botones"><button class="btn" data-clic="mailApunte">Escribirme por mail</button><button class="btn lin" data-clic="cerrar">Cancelar</button></div>
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
  return { nombres, of, texto: `Esto pienso cursar${of.nombre ? ' en ' + of.nombre : ' el próximo cuatrimestre'}: ${lista}. ¿Coincidimos en alguna? Armá el tuyo sin superposiciones: ${BRAND.url}` };
}
function abrirQueCursar() {
  const { nombres, of, texto } = queCursarDatos();
  if (!nombres.length) return aviso('Marcá primero qué querés cursar');
  const hay = elegidas().length > 0;
  abrir(cab('Qué voy a cursar') + `<p class="gl-chico">${esc(of.nombre || 'Próximo cuatrimestre')}. Para pasarle al grupo lo que pensás cursar y ver con quién coincidís: solo las materias, sin notas ni datos personales.</p>
    <ul class="resumen-sel qc">${nombres.map(n => `<li><span class="ge pen" aria-hidden="true"></span><b>${esc(n)}</b></li>`).join('')}</ul>
    <div class="botones"><button class="gl-btn" data-clic="mandarQueCursar">Mandar por WhatsApp</button><button class="gl-btn gl-btn--sec" data-clic="copiarQueCursar">Copiar el texto</button><button class="gl-btn gl-btn--sec" data-clic="imagenQueCursar">En imagen</button>${hay ? '<button class="gl-btn gl-btn--sec" data-clic="linkSemana">Link para mirar mi semana</button>' : ''}<button class="gl-btn gl-btn--ter" data-clic="cerrar">Cerrar</button></div>
    ${hay ? '' : '<p class="gl-chico">Cuando elijas las comisiones, también podés pasar el link de tu semana.</p>'}`, 'que-cursar');
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
  cvTexto(c, (of.nombre || 'Próximo cuatrimestre').toUpperCase(), 80, 150, 30, 600, CV.t2);
  cvTexto(c, 'Voy a cursar', 80, 260, 100, 600);
  const px = nombres.length > 7 ? 36 : 44;
  let y = 360;
  nombres.slice(0, 9).forEach(n => { cvLineas(c, n, 880, px, 500).slice(0, 2).forEach((l, i) => { if (!i) cvPuntos(c, 80, y - px * .8, 18, 18, CV.acento, 6, 2); cvTexto(c, l, 120, y, px, 500); y += px * 1.3; }); y += 14; });
  if (nombres.length > 9) cvTexto(c, 'y ' + (nombres.length - 9) + ' más', 120, y, px, 400, CV.t2);
  cvPie(c, 1080, 1080);
  abrirImagen(cv, { archivo: 'galera-que-cursar.png', titulo: 'Qué voy a cursar', tipo: 'que_cursar', id: V.oferta,
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
  const txt = `Hice ${arcCero(r.puntos)} en el Arcade de Corrección de Estilo (${arcNombre(A.tablero)}). ¿Me superás? ${DESAFIO_URL}`;
  medir('share', { method: 'whatsapp', content_type: 'desafio', item_id: A.tablero });
  window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank', 'noopener');
}
// Quien abre un desafío ve el puntaje a superar y decide si juega.
function abrirDesafio(tablero, semilla, puntos) {
  if (!Arcade.EJES[tablero] || !/^[a-z0-9]{4,10}$/.test(semilla) || !(puntos > 0 && puntos <= 999999)) return false;
  irArcade();
  abrir(cab('Te desafiaron') + `<p class="u-margin-top-0">Alguien hizo <b>${arcCero(puntos)}</b> en el Arcade de Corrección de Estilo (${esc(arcNombre(tablero))}). Es el mismo tablero, con las mismas preguntas en el mismo orden.</p>
    <div class="botones"><button class="btn" data-clic="cerrarArcTeo" data-clic-a="[${arg(tablero)},${arg(semilla)},${ja(puntos)}]">Aceptar el desafío</button><button class="btn lin" data-clic="cerrar">Ahora no</button></div>`, 'desafio');
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
  if (d) { history.replaceState(null, '', location.pathname + location.search); cargarGrupo('arcade').then(() => abrirDesafio(d[1], d[2], Number(d[3])), () => aviso('No pude abrir el desafío: probá de nuevo')); return true; }
  const s = h.match(/^#horario=(.{3,3000})$/);
  if (s) {
    let t = ''; try { t = decodeURIComponent(s[1]); } catch (e) { t = ''; }
    const p = t.split('~').slice(0, 40);
    history.replaceState(null, '', location.pathname + location.search);
    if (p.length < 2 || !p.every(x => RE_ID.test(x))) { aviso('Este link de horario está incompleto'); return true; }
    cargarGrupo('horarios').then(() => abrirSemanaCompartida(p[0], p.slice(1)), () => aviso('No pude abrir el horario: probá de nuevo')); return true;   // cvSemana usa Horarios (se baja bajo demanda)
  }
  return false;
}

// Manejadores por delegación (ver ACC en app.js).
window.ACC = window.ACC || {};
Object.assign(ACC, {
  cerrarArcTeo: (a, b, c) => { cerrar(); arcEmpezarTeo(a, b, c); },
  copiarQrActual: () => copiarLink(QR_ACTUAL.url),
  copiarHorLink: () => copiarLink(HOR_LINK),
  compartirHorLink: () => navigator.share({ title: 'Mi horario en Galera', url: HOR_LINK }).catch(() => { }),
  copiarAmigoUrl: () => copiarLink(AMIGO_URL),
  compartirAmigoUrl: () => navigator.share({ title: 'Mi plan en Galera', url: AMIGO_URL }).catch(() => { }),
});

// Acciones registradas para la delegación de eventos (late binding: se resuelven al hacer clic).
window.ACC = window.ACC || {};
Object.assign(ACC, {
  abrirLogros: (...a) => abrirLogros(...a), logroExtra: (...a) => logroExtra(...a), elegirMecenas: (...a) => elegirMecenas(...a), guardarMecenas: (...a) => guardarMecenas(...a), abrirPasarAmigo: (...a) => abrirPasarAmigo(...a), abrirQRPantalla: (...a) => abrirQRPantalla(...a),
  abrirQueCursar: (...a) => abrirQueCursar(...a), arcDesafiar: (...a) => arcDesafiar(...a), bajarImagen: (...a) => bajarImagen(...a),
  bajarQR: (...a) => bajarQR(...a), compartirAvance: (...a) => compartirAvance(...a), compartirLogro: (...a) => compartirLogro(...a),
  compartirResultado: (...a) => compartirResultado(...a), copiarQueCursar: (...a) => copiarQueCursar(...a),
  elegirImagen: (...a) => elegirImagen(...a), enviarImagen: (...a) => enviarImagen(...a), imagenPlan: (...a) => imagenPlan(...a), imagenQueCursar: (...a) => imagenQueCursar(...a), imagenSemana: (...a) => imagenSemana(...a),
  instalarApp: (...a) => instalarApp(...a), linkSemana: (...a) => linkSemana(...a), mailApunte: (...a) => mailApunte(...a),
  mandarApunte: (...a) => mandarApunte(...a), mandarQueCursar: (...a) => mandarQueCursar(...a), sumarApunte: (...a) => sumarApunte(...a),
});
