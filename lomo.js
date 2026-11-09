// Calculadora de lomo y plantilla de tapa (Galera Prensa). Sigue los apuntes de Fundamentos de la Producción de Impresos:
// lomo ≈ hojas × espesor de una hoja (C, sección 5), mano = espesor ÷ gramaje (E2), tapa abierta = solapa + tapa + lomo + tapa + solapa (C).
// Lomo.* son las cuentas, sin DOM (se prueban en node con tools/probar_lomo.js). vLomo y lo que sigue es la pantalla.
// La plantilla en PDF usa pdf-lib (vendor/, MIT), que se baja recién al pedirla.
'use strict';
const Lomo = (() => {
  const MM = 72 / 25.4;
  const num = v => { const x = parseFloat(String(v == null ? '' : v).trim().replace(',', '.')); return isFinite(x) ? x : 0; };
  const ENC = { rustica: 'Rústica', solapas: 'Rústica con solapas', carton: 'Cartoné (tapa dura)', acaballado: 'Acaballado (abrochado)' };
  // Mano (volumen específico) de referencia: E2 da ~0,9 para couché y ~1,35 para papel de novela. El dato real lo da el proveedor.
  const PAPELES = [
    { id: 'catedra', t: 'Ejercicio de la cátedra: 80 g, 90 µm', g: 80, um: 90 },
    { id: 'novela70', t: 'Papel de novela 70 g (mano 1,35)', g: 70, mano: 1.35 },
    { id: 'couche115', t: 'Ilustración o couché 115 g (mano 0,9)', g: 115, mano: 0.9 },
    { id: 'otro', t: 'Otro: escribo el espesor o la mano' }
  ];
  const DEF = { ancho: '148', alto: '210', paginas: '160', enc: 'rustica', papel: 'catedra', modo: 'um', um: '90', gramaje: '80', mano: '1,1',
    guardas: '0', solapa: '80', carton: '2', ajuste: '0', sangrado: '3' };

  // d: datos como los escribe la persona (strings con coma). Devuelve todo en mm.
  function calcular(d) {
    d = Object.assign({}, DEF, d || {});
    const enc = ENC[d.enc] ? d.enc : 'rustica';
    const p = PAPELES.find(x => x.id === d.papel) || PAPELES[0];
    const ancho = num(d.ancho), alto = num(d.alto), paginas = Math.max(0, Math.round(num(d.paginas)));
    let um, gramaje = 0, mano = 0;
    if (p.id === 'otro') {
      if (d.modo === 'mano') { gramaje = num(d.gramaje); mano = num(d.mano); um = gramaje * mano; } else um = num(d.um);
    } else if (p.um) { um = p.um; gramaje = p.g; mano = um / p.g; } else { gramaje = p.g; mano = p.mano; um = p.g * p.mano; }
    const guardas = Math.max(0, Math.round(num(d.guardas)));
    const hojas = Math.ceil(paginas / 2) + guardas;
    const tripa = hojas * um / 1000;
    const carton = enc === 'carton' ? Math.max(0, num(d.carton)) : 0;
    const ajuste = num(d.ajuste);
    const lomo = enc === 'acaballado' ? 0 : Math.max(0, tripa + carton + ajuste);
    const solapa = enc === 'solapas' ? Math.max(0, num(d.solapa)) : 0;
    const sangrado = Math.max(0, Math.min(10, num(d.sangrado)));
    const abierta = { w: 2 * solapa + 2 * ancho + lomo, h: alto };
    const avisos = [];
    if (!(ancho > 0 && alto > 0)) avisos.push({ n: 'mal', t: 'Falta el tamaño del libro cerrado.' });
    if (!paginas) avisos.push({ n: 'mal', t: 'Falta la cantidad de páginas del interior.' });
    if (!(um > 0)) avisos.push({ n: 'mal', t: 'Falta el espesor de la hoja (o el gramaje y la mano).' });
    if (paginas % 2) avisos.push({ n: 'aviso', t: 'Un libro tiene una cantidad par de páginas: cada hoja tiene frente y dorso.' });
    if (enc === 'acaballado') {
      if (paginas % 4) avisos.push({ n: 'aviso', t: 'Un acaballado va en múltiplos de 4: sumá ' + (4 - paginas % 4) + ' en blanco.' });
      if (hojas > 12) avisos.push({ n: 'aviso', t: 'Son ' + hojas + ' hojas dobladas juntas: con más de 10 o 12, el centro sobresale y cuesta abrochar. Considerá rústica. (Práctica habitual: confirmalo con tu imprenta.)' });
    } else if (lomo > 0 && lomo < 5) avisos.push({ n: 'aviso', t: 'Con un lomo de menos de 5 mm, el texto del lomo casi no entra y cualquier corrimiento se nota: muchas imprentas recomiendan dejarlo liso. (Práctica habitual: confirmalo con tu imprenta.)' });
    if (enc === 'carton') avisos.push({ n: 'info', t: 'En cartoné, el forro de la tapa lleva además la vuelta sobre el cartón y la bisagra: pedí a la imprenta su esquema de tapa. La plantilla de abajo sirve para la sobrecubierta o como guía del lomo.' });
    return { enc, ancho, alto, paginas, hojas, guardas, um, gramaje, mano, tripa, carton, ajuste, lomo, solapa, sangrado, abierta,
      total: { w: abierta.w + 2 * sangrado, h: abierta.h + 2 * sangrado }, avisos, ok: ancho > 0 && alto > 0 && paginas > 0 && um > 0 };
  }

  // Paneles de la tapa abierta, de izquierda a derecha (vista desde afuera: la contratapa a la izquierda).
  function paneles(R) {
    const L = [];
    let x = 0;
    const add = (id, t, w) => { if (w > 0) L.push({ id, t, x, w }); x += w; };
    add('solapa-c', 'Solapa', R.solapa); add('contratapa', 'Contratapa', R.ancho); add('lomo', 'Lomo', R.lomo); add('tapa', 'Tapa', R.ancho); add('solapa-t', 'Solapa', R.solapa);
    return L;
  }

  const mm1 = v => (Math.round(v * 10) / 10).toLocaleString('es-AR', { maximumFractionDigits: 1 });
  const SEG = 5;   // zona de seguridad (mm): la misma de la checklist de «Antes de imprimir»

  // SVG de la plantilla, en mm. conTexto = rótulos (para la vista y el archivo).
  function svg(R, para) {
    const s = R.sangrado, W = R.total.w, H = R.total.h, P = paneles(R), fs = Math.max(3, Math.min(R.alto / 16, Math.min(...P.filter(p => p.id !== 'lomo').map(p => p.w)) / 8));
    const lineas = P.slice(1).map(p => `<line class="lm-pliegue" x1="${s + p.x}" y1="0" x2="${s + p.x}" y2="${H}"/>`).join('');
    const seguras = P.filter(p => p.w > 2 * SEG).map(p => `<rect class="lm-segura" x="${s + p.x + SEG}" y="${s + SEG}" width="${p.w - 2 * SEG}" height="${R.alto - 2 * SEG}"/>`).join('');
    const rot = P.map(p => {
      const cx = s + p.x + p.w / 2, cy = s + R.alto / 2, giro = p.id === 'lomo' ? ` transform="rotate(90 ${cx} ${cy})"` : '';
      const t = p.id === 'lomo' ? 'Lomo · ' + mm1(p.w) + ' mm' : p.t + ' · ' + mm1(p.w) + ' mm';
      return p.id === 'lomo' && p.w < fs * 1.2 ? '' : `<text class="lm-rot" x="${cx}" y="${cy}" font-size="${fs}" text-anchor="middle" dominant-baseline="middle"${giro}>${t}</text>`;
    }).join('');
    const estilo = para === 'archivo'
      ? '<style>.lm-sangre{fill:#fff;stroke:#e5007e;stroke-width:.25}.lm-corte{fill:none;stroke:#00a0e3;stroke-width:.35}.lm-pliegue{stroke:#e5007e;stroke-width:.25;stroke-dasharray:2 1.5}.lm-segura{fill:none;stroke:#888;stroke-width:.2;stroke-dasharray:1 1}.lm-rot{fill:#00a0e3;font-family:Helvetica,Arial,sans-serif}</style>' : '';
    const pie = para === 'archivo' ? `<text class="lm-rot" x="${s + 3}" y="${H - 1.2}" font-size="2.2">Galera · tapa abierta ${mm1(R.abierta.w)} × ${mm1(R.abierta.h)} mm + ${mm1(s)} mm de sangrado. Celeste: corte. Magenta: sangrado y pliegues. Gris: zona segura (${SEG} mm).</text>` : '';
    const tam = para === 'archivo' ? ` width="${W}mm" height="${H}mm"` : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" class="lm-svg" viewBox="0 0 ${W} ${H}"${tam} role="img" aria-label="Plantilla de tapa abierta: ${mm1(R.abierta.w)} por ${mm1(R.abierta.h)} mm, con lomo de ${mm1(R.lomo)} mm">${estilo}
<rect class="lm-sangre" x="0" y="0" width="${W}" height="${H}"/><rect class="lm-corte" x="${s}" y="${s}" width="${R.abierta.w}" height="${R.abierta.h}"/>${lineas}${seguras}${rot}${pie}</svg>`;
  }

  // Plantilla en PDF: página = tapa abierta + sangrado; TrimBox y BleedBox declarados, guías en colores de registro de pantalla.
  async function pdf(R, PDFLib) {
    const { PDFDocument, rgb, StandardFonts } = PDFLib;
    const doc = await PDFDocument.create();
    doc.setTitle('Plantilla de tapa · Galera'); doc.setCreator('Galera (galera.com.ar)'); doc.setProducer('pdf-lib');
    const s = R.sangrado, W = R.total.w * MM, H = R.total.h * MM, pg = doc.addPage([W, H]);
    pg.setBleedBox(0, 0, W, H); pg.setTrimBox(s * MM, s * MM, R.abierta.w * MM, R.abierta.h * MM);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const cel = rgb(0, 0.63, 0.89), mag = rgb(0.9, 0, 0.49), gris = rgb(0.55, 0.55, 0.55);
    const y = v => H - v * MM;   // de mm desde arriba a puntos desde abajo
    pg.drawRectangle({ x: s * MM, y: s * MM, width: R.abierta.w * MM, height: R.abierta.h * MM, borderColor: cel, borderWidth: 1 });
    const P = paneles(R);
    P.slice(1).forEach(p => pg.drawLine({ start: { x: (s + p.x) * MM, y: 0 }, end: { x: (s + p.x) * MM, y: H }, color: mag, thickness: 0.7, dashArray: [5, 4] }));
    P.filter(p => p.w > 2 * SEG).forEach(p => pg.drawRectangle({ x: (s + p.x + SEG) * MM, y: (s + SEG) * MM, width: (p.w - 2 * SEG) * MM, height: (R.alto - 2 * SEG) * MM, borderColor: gris, borderWidth: 0.5, borderDashArray: [2, 2] }));
    const fs = Math.max(7, Math.min(16, R.alto / 28 * MM));
    P.forEach(p => {
      const t = p.t + ' · ' + mm1(p.w) + ' mm', w = font.widthOfTextAtSize(t, fs), cx = (s + p.x + p.w / 2) * MM, cy = y(s + R.alto / 2);
      if (p.id === 'lomo') { if (p.w * MM >= fs * 1.2) pg.drawText(t, { x: cx + fs / 3, y: cy - w / 2, size: fs, font, color: cel, rotate: PDFLib.degrees(90) }); }
      else pg.drawText(t, { x: cx - w / 2, y: cy, size: fs, font, color: cel });
    });
    pg.drawText(`Galera · tapa abierta ${mm1(R.abierta.w)} × ${mm1(R.abierta.h)} mm + ${mm1(s)} mm de sangrado. Celeste: corte. Magenta: pliegues. Gris: zona segura (${SEG} mm). Borrá estas guías antes de mandar.`,
      { x: (s + 3) * MM, y: (s + 2) * MM, size: 5.5, font, color: gris, maxWidth: (R.abierta.w - 6) * MM });
    return doc.save();
  }

  const PDFLIB = '/vendor/pdf-lib.min.js?v=1.17.1';
  let promesa = null;
  function lib() {
    if (typeof PDFLib !== 'undefined') return Promise.resolve(PDFLib);
    return promesa || (promesa = new Promise((ok, mal) => {
      const s = document.createElement('script'); s.src = PDFLIB;
      s.onload = () => ok(PDFLib); s.onerror = () => { promesa = null; mal(new Error('No pude bajar la herramienta del PDF. Puede ser la conexión: probá de nuevo.')); };
      document.head.appendChild(s);
    }));
  }

  return { calcular, paneles, svg, pdf, lib, num, mm1, ENC, PAPELES, DEF, SEG };
})();
if (typeof module !== 'undefined') module.exports = Lomo;

// ---------- Pantalla ----------
function lomoS() { if (typeof V !== 'undefined' && !V.lomo) V.lomo = Object.assign({}, Lomo.DEF); return V.lomo; }
const lomoCampo = (k, t, suf, ayuda) => `<div class="campo-esc"><label class="c" for="lm-${k}">${t}</label>
  <div class="con-unidad"><input id="lm-${k}" maxlength="10" inputmode="decimal" autocomplete="off" value="${esc(lomoS()[k] || '')}" data-lomo="campo" data-lomo-k="${k}"${ayuda ? ` aria-describedby="lm-${k}-a"` : ''}>${suf ? `<span>${suf}</span>` : ''}</div>${ayuda ? `<p class="chico tenue u-m0" id="lm-${k}-a">${ayuda}</p>` : ''}</div>`;
const lomoSel = (k, t, opts) => `<div class="campo-esc"><label class="c" for="lm-${k}">${t}</label>
  <select id="lm-${k}" class="sel-pap" data-lomo="elegir" data-lomo-k="${k}">${opts.map(([v, x]) => `<option value="${esc(v)}"${String(lomoS()[k]) === v ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select></div>`;

function vLomo() {
  const s = lomoS(), otro = s.papel === 'otro';
  return `<div class="gl-lomo"><p class="u-mt0 chico tenue">Cuánto mide el lomo de tu libro y cómo queda la tapa abierta, con una plantilla para bajar y diseñar encima. El lomo sale de las hojas del interior por el espesor de cada hoja: el espesor lo da el proveedor del papel o la imprenta, y no se deduce solo del gramaje.</p>
    <div class="esc"><div class="esc-datos">
      <div class="tarjeta"><h3>1. El libro</h3><div class="dos">${lomoCampo('ancho', 'Ancho cerrado', 'mm')}${lomoCampo('alto', 'Alto cerrado', 'mm')}
        ${lomoCampo('paginas', 'Páginas del interior', 'págs.')}${lomoSel('enc', 'Encuadernación', Object.keys(Lomo.ENC).map(k => [k, Lomo.ENC[k]]))}
        ${s.enc === 'solapas' ? lomoCampo('solapa', 'Solapa (cada una)', 'mm') : ''}${s.enc === 'carton' ? lomoCampo('carton', 'Cartón del lomo', 'mm', 'Si el lomo lleva una pieza de cartón aparte: típicamente unos 2 mm.') : ''}</div></div>
      <div class="tarjeta"><h3>2. El papel del interior</h3><div class="dos">${lomoSel('papel', 'Papel', Lomo.PAPELES.map(p => [p.id, p.t]))}
        ${otro ? lomoSel('modo', 'Dato que tengo', [['um', 'Espesor de una hoja (µm)'], ['mano', 'Gramaje y mano']]) : ''}
        ${otro && s.modo !== 'mano' ? lomoCampo('um', 'Espesor de una hoja', 'µm', 'Lo da el proveedor (calibre). 1 mm = 1.000 µm.') : ''}
        ${otro && s.modo === 'mano' ? lomoCampo('gramaje', 'Gramaje', 'g/m²') + lomoCampo('mano', 'Mano (volumen específico)', 'cm³/g', 'Espesor ÷ gramaje. Couché: ~0,9; papel de novela: ~1,35.') : ''}
        ${lomoCampo('guardas', 'Guardas', 'hojas', 'Hojas que se suman al interior, si las lleva.')}</div></div>
      <div class="tarjeta"><h3>3. La tapa</h3><div class="dos">${lomoCampo('sangrado', 'Sangrado', 'mm', 'Lo habitual son 3 mm por lado.')}${lomoCampo('ajuste', 'Ajuste de la imprenta', 'mm', 'Si tu imprenta te pide sumar algo al lomo (por la cola o la cartulina), va acá.')}</div></div>
    </div><div class="esc-res" id="lm-res" aria-live="polite">${lomoRes()}</div></div></div>`;
}

function lomoRes() {
  const R = Lomo.calcular(lomoS()), f = Lomo.mm1;
  const av = R.avisos.map(a => `<li class="lm-${a.n}">${esc(a.t)}</li>`).join('');
  if (!R.ok) return `<div class="tarjeta"><h3>Lomo</h3><ul class="chico lm-av">${av}</ul></div>`;
  const cuenta = `${R.hojas} hojas${R.guardas ? ` (${R.hojas - R.guardas} del interior + ${R.guardas} de guardas)` : ''} × ${f(R.um)} µm = ${f(R.tripa)} mm${R.carton ? ` + ${f(R.carton)} mm de cartón` : ''}${R.ajuste ? ` ${R.ajuste > 0 ? '+' : '−'} ${f(Math.abs(R.ajuste))} mm de ajuste` : ''}`;
  const P = Lomo.paneles(R).map(p => f(p.w)).join(' + ');
  return `<div class="tarjeta"><h3>${R.enc === 'acaballado' ? 'Sin lomo: va doblado y abrochado' : 'Lomo: ' + f(R.lomo) + ' mm'}</h3>
      <p class="chico u-m0">${R.enc === 'acaballado' ? `El interior suma ${f(R.tripa)} mm de espesor (${R.hojas} hojas × ${f(R.um)} µm), pero en el pliegue no hay lomo plano.` : esc(cuenta) + '.'}${R.mano && R.gramaje ? ` <span class="tenue">(${f(R.gramaje)} g/m², mano ${String(Math.round(R.mano * 100) / 100).replace('.', ',')})</span>` : ''}</p>
      <p class="chico u-mt8">Tapa abierta: <b>${f(R.abierta.w)} × ${f(R.abierta.h)} mm</b> (${P}). Con ${f(R.sangrado)} mm de sangrado: ${f(R.total.w)} × ${f(R.total.h)} mm.</p>
      ${av ? `<ul class="chico lm-av">${av}</ul>` : ''}
      <p class="chico tenue">Es una aproximación: antes de cerrar la tapa, pedí a la imprenta el lomo con el papel real (o una maqueta en blanco).</p></div>
    <div class="tarjeta"><h3>La plantilla</h3><div class="lm-vista">${Lomo.svg(R, 'vista')}</div>
      <p class="chico tenue u-m0"><span class="lm-ley lm-ley-c"></span> corte · <span class="lm-ley lm-ley-p"></span> pliegues y sangrado · <span class="lm-ley lm-ley-s"></span> zona segura (${Lomo.SEG} mm)</p>
      <div class="fila u-margin-10px-0"><button class="btn ch" type="button" data-lomo="pdf">Bajar la plantilla (PDF)</button><button class="btn sec ch" type="button" data-lomo="svg">Bajar en SVG</button></div>
      <p class="chico tenue u-m0">El PDF trae declaradas las cajas de corte y de sangrado. Ponelo como capa de guía en tu programa y borrá las guías antes de exportar la tapa.</p></div>`;
}

function lomoBajar(bytes, tipo, ext) {
  const R = Lomo.calcular(lomoS());
  const url = URL.createObjectURL(new Blob([bytes], { type: tipo })), a = document.createElement('a');
  a.href = url; a.download = `tapa-${Lomo.mm1(R.ancho)}x${Lomo.mm1(R.alto)}-lomo-${Lomo.mm1(R.lomo)}mm.${ext}`.replace(/,/g, '_');
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
  if (typeof medir === 'function') medir('plantilla_tapa', { formato: ext, enc: R.enc });
}

if (typeof document !== 'undefined' && typeof document.addEventListener === 'function' && !window.lomoEventos) {
  window.lomoEventos = true;
  const blanco = e => { const t = e.target && e.target.closest ? e.target.closest('[data-lomo]') : null; return t && t.closest('.gl-lomo') ? t : null; };
  document.addEventListener('input', e => {
    const t = blanco(e); if (!t || t.dataset.lomo !== 'campo') return;
    lomoS()[t.dataset.lomoK] = t.value;
    const r = document.getElementById('lm-res'); if (r) r.innerHTML = lomoRes();
  });
  document.addEventListener('change', e => {
    const t = blanco(e); if (!t || t.dataset.lomo !== 'elegir') return;
    lomoS()[t.dataset.lomoK] = t.value;
    if (typeof render === 'function') render();
    const de = document.getElementById(t.id); if (de) de.focus();
  });
  document.addEventListener('click', async e => {
    const t = blanco(e); if (!t) return;
    const R = Lomo.calcular(lomoS()); if (!R.ok) return;
    if (t.dataset.lomo === 'svg') lomoBajar(Lomo.svg(R, 'archivo'), 'image/svg+xml', 'svg');
    if (t.dataset.lomo === 'pdf') {
      try { lomoBajar(await Lomo.pdf(R, await Lomo.lib()), 'application/pdf', 'pdf'); }
      catch (err) { if (typeof aviso === 'function') aviso(err.message); }
    }
  });
}
