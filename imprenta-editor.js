// Imprenta (Galera Prensa, tanda B): del texto al PDF listo para imprimir, en el navegador y sin servidor.
// Markdown o pegado desde Word/Docs (Turndown) → ortotipografía por script → Typst (typst.ts, Apache-2.0) → PDF.
// Prensa.* son las cuentas y las plantillas, sin DOM (se prueban en node con tools/probar_prensa.mjs). vImprenta y lo que sigue es la pantalla.
// Usa Imprenta.imponer (imprenta.js) para el PDF impuesto y pdf-lib para las cajas de corte. El motor de Typst se baja recién al pedirlo.
'use strict';
const Prensa = (() => {
  // ---------- Ortotipografía (sin IA, con informe). Las comillas se respetan: unificarlas es opcional y viene apagado. ----------
  const ORTO = {
    suspensivos: 'puntos suspensivos en un solo signo (…)',
    raya: 'rayas de diálogo',
    inciso: 'rayas de inciso en diálogos',
    rango: 'rangos de números sin espacios (1990-1995)',
    espacios: 'espacios de más o de menos',
    comillas: 'comillas unificadas en «»'
  };
  function orto(md, o) {
    o = o || {};
    const n = {}; const suma = (k, c) => { n[k] = (n[k] || 0) + c; };
    const cuenta = (t, re, k, por) => t.replace(re, (...a) => { suma(k, 1); return typeof por === 'function' ? por(...a) : por; });
    const lineas = String(md || '').replace(/\r\n?/g, '\n').split('\n');
    let enCodigo = false;
    const out = lineas.map(l => {
      if (/^```/.test(l)) { enCodigo = !enCodigo; return l; }
      if (enCodigo || /^ {4}/.test(l)) return l;
      let t = l;
      t = cuenta(t, /\.{3}(?!\.)|\. \. \./g, 'suspensivos', '…');
      // Raya de diálogo: guion, semirraya o dos guiones al empezar el párrafo y pegados al texto («-Hola»). «- Hola», con espacio, es una lista de Markdown.
      t = cuenta(t, /^(\s*)(?:--|[-–])(?=[\p{L}¿¡«“"'…])/u, 'raya', (m, s) => s + '—');
      t = cuenta(t, /^(\s*)[—–] +(?=\S)/u, 'raya', (m, s) => s + '—');
      if (/^\s*—/.test(t)) {
        // Incisos del narrador dentro del diálogo: « -dijo» → « —dijo», «dijo-.» → «dijo—.»
        t = cuenta(t, /(\s)(?:--|[-–])(?=\p{Ll})/gu, 'inciso', (m, s) => s + '—');
        t = cuenta(t, /(\p{L})(?:--|[-–])(?=[\s.,;:]|$)/gu, 'inciso', (m, a) => a + '—');
      }
      t = cuenta(t, /(\d) +- *(?=\d)|(\d)- +(?=\d)/g, 'rango', (m, a, b) => (a || b) + '-');
      // Espacios: dobles adentro del renglón (no la sangría ni el doble espacio final de Markdown), antes de signos de cierre y después de los de apertura.
      t = t.replace(/^(\s*)(.*?)( {2,})?$/, (m, s, cuerpo, fin) => s + cuenta(cuerpo, / {2,}/g, 'espacios', ' ') + (fin || ''));
      t = cuenta(t, /(\S) +(?=[,.;:)!?»”…](?:\s|$|[^\d]))/g, 'espacios', (m, a) => a);
      t = cuenta(t, /([(¿¡«“]) +/g, 'espacios', (m, a) => a);
      t = cuenta(t, /(\p{Ll}),(?=\p{L})/gu, 'espacios', (m, a) => a + ', ');
      if (o.comillas) t = cuenta(t, /"([^"\n]+)"|“([^”\n]+)”/g, 'comillas', (m, a, b) => '«' + (a || b) + '»');
      return t;
    });
    return { texto: out.join('\n'), cambios: n, total: Object.values(n).reduce((a, b) => a + b, 0) };
  }

  // ---------- Markdown → Typst ----------
  // Todo lo que el autor escribió va escapado: Typst no reinterpreta signos (comillas, guiones, asteriscos sueltos).
  const esc = t => t.replace(/[\\#*_`$<>@\[\]~=+\-\/"'{}]/g, c => '\\' + c);
  const cadena = t => '"' + t.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  // El carácter nulo es el marcador interno: se saca de lo que escribe el autor, para que no pueda resolver uno.
  const enLinea = t => enLineaInt(String(t).replace(/\u0000/g, ''));
  function enLineaInt(t) {
    const R = [];
    // Primero lo que no se toca (código y enlaces), después negritas y cursivas.
    t = t.replace(/`([^`]+)`/g, (m, c) => { R.push('#raw(' + cadena(c) + ')'); return '\u0000' + (R.length - 1) + '\u0000'; });
    t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, x, u) => {
      if (!/^(https?:|mailto:)/i.test(u)) return m;   // solo https, http y mailto: javascript:, data: y demás quedan como texto
      R.push('#link(' + cadena(u) + ')[' + enLineaInt(x) + ']'); return '\u0000' + (R.length - 1) + '\u0000'; });
    t = esc(t);
    t = t.replace(/\\\*\\\*(.+?)\\\*\\\*|\\_\\_(.+?)\\_\\_/g, (m, a, b) => '#strong[' + (a || b) + ']');
    t = t.replace(/\\\*(?!\s)(.+?)\\\*|(^|[^\p{L}\d])\\_(?!\s)(.+?)\\_(?![\p{L}\d])/gu, (m, a, pre, b) => a !== undefined ? '#emph[' + a + ']' : pre + '#emph[' + b + ']');
    return t.replace(/\u0000(\d+)\u0000/g, (m, i) => R[+i]);
  }
  // Bloques: títulos (#), párrafos, listas (-, *, +, 1.), citas (>), separadores (***, ---) y saltos de página (una línea con «\salto» o «<!-- salto -->»).
  function aTypst(md, o) {
    o = o || {};
    const L = String(md || '').replace(/\r\n?/g, '\n').split('\n'), out = [];
    let par = [], tipoLista = null, cita = [], primero = true;
    const cerrarPar = () => {
      if (!par.length) return;
      const txt = par.map((l, i) => enLinea(l.replace(/ {2,}$/, '')) + (/ {2,}$/.test(l) && i < par.length - 1 ? ' \\' : '')).join('\n');
      out.push(o.capitular && primero ? capitular(txt) : txt, '');
      primero = false; par = [];
    };
    const cerrarCita = () => { if (cita.length) { out.push('#quote(block: true)[' + cita.map(enLinea).join(' ') + ']', ''); cita = []; } };
    const cerrar = () => { cerrarPar(); cerrarCita(); if (tipoLista) { out.push(''); tipoLista = null; } };
    for (const l of L) {
      let m;
      if (/^\s*$/.test(l)) { cerrar(); continue; }
      if (/^\s*(\\salto|<!--\s*salto\s*-->)\s*$/i.test(l)) { cerrar(); out.push('#pagebreak()', ''); continue; }
      if ((m = l.match(/^(#{1,3})\s+(.+?)\s*#*\s*$/))) { cerrar(); out.push('='.repeat(m[1].length) + ' ' + enLinea(m[2]), ''); if (m[1].length === 1) primero = true; continue; }
      if (/^\s*([*\-_])(\s*\1){2,}\s*$/.test(l)) { cerrar(); out.push('#separador', ''); continue; }
      if ((m = l.match(/^>\s?(.*)$/))) { cerrarPar(); cita.push(m[1]); continue; }
      if ((m = l.match(/^\s*([-*+]|\d+[.)])\s+(.+)$/)) && (tipoLista || !par.length)) {
        cerrarPar(); cerrarCita();
        tipoLista = /\d/.test(m[1]) ? '+' : '-';
        out.push(tipoLista + ' ' + enLinea(m[2])); continue;
      }
      if (tipoLista && /^\s{2,}\S/.test(l)) { out[out.length - 1] += ' ' + enLinea(l.trim()); continue; }
      if (tipoLista) { out.push(''); tipoLista = null; }
      cerrarCita();
      par.push(l);
    }
    cerrar();
    return out.join('\n');
  }
  // Capitular elevada: la primera letra en gótica, más grande, sobre el renglón (Typst no corre el texto alrededor de una letra caída).
  function capitular(txt) {
    const m = txt.match(/^((?:\\.|[«“¿¡—])*)(\p{L})/u);
    if (!m) return txt;
    return '#capitular[' + m[1] + m[2] + ']' + txt.slice(m[0].length);
  }

  // ---------- Formatos y plantillas ----------
  const FORMATOS = {
    fanzine: { t: 'Fanzine de una hoja (8 páginas)', paginas: 8, cuerpo: 8, sangrado: 0 },
    acaballado: { t: 'Acaballado A5 (abrochado)', w: 148, h: 210, cuerpo: 10.5, sangrado: 3 }
  };
  const HOJA_FZ = { a4: [297, 210], carta: [279.4, 215.9] };   // apaisada: el fanzine es una grilla de 4 × 2
  const ESTILOS = { sobria: 'Sobria (la de los apuntes de Galera)', literaria: 'Literaria (para narrativa y poesía)' };
  const DEF = { formato: 'fanzine', hoja: 'a4', estilo: 'sobria', titulo: '', autor: '', cuerpo: '', capitular: true, numeros: true, portada: true, orto: true, comillas: false };
  const num = v => { const x = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(x) ? x : 0; };
  const f2 = x => (Math.round(x * 100) / 100).toString();

  function medidas(o) {
    const F = FORMATOS[o.formato] || FORMATOS.fanzine;
    if (o.formato === 'fanzine') { const H = HOJA_FZ[o.hoja] || HOJA_FZ.a4; return { w: H[0] / 4, h: H[1] / 2, b: 0, F }; }
    return { w: F.w, h: F.h, b: F.sangrado, F };
  }
  // El documento Typst completo. Negro del texto en un solo canal (100 % K) y el azul de Galera en CMYK, listos para imprenta.
  function documento(md, o) {
    o = Object.assign({}, DEF, o || {});
    const M = medidas(o), fz = o.formato === 'fanzine', lit = o.estilo === 'literaria';
    const cuerpo = Math.min(14, Math.max(6, num(o.cuerpo) || M.F.cuerpo));
    const renglon = cuerpo * (fz ? 1.3 : 15 / 10.5);
    const mg = fz ? { int: 6, ext: 6, sup: 7, inf: 9 } : { int: 15, ext: 13, sup: 15, inf: 18 };
    const b = M.b;
    const titulo = String(o.titulo || '').trim(), autor = String(o.autor || '').trim();
    const sans = '"Instrument Sans"', serif = '"Literata"';
    const L = [];
    L.push(`#set document(title: ${cadena(titulo || 'Sin título')}${autor ? ', author: ' + cadena(autor) : ''})`);
    L.push(`#let negro = cmyk(0%, 0%, 0%, 100%)`, `#let azul = cmyk(100%, 55%, 0%, 5%)`);
    L.push(`#set page(width: ${f2(M.w + 2 * b)}mm, height: ${f2(M.h + 2 * b)}mm, margin: (inside: ${f2(mg.int + b)}mm, outside: ${f2(mg.ext + b)}mm, top: ${f2(mg.sup + b)}mm, bottom: ${f2(mg.inf + b)}mm),`);
    L.push(`  header: context { let p = here().page(); if p > ${o.portada ? 2 : 1} and ${titulo ? 'true' : 'false'} { set text(size: ${f2(cuerpo * 0.75)}pt, fill: azul${lit ? '' : ', font: ' + sans}); align(center, ${lit ? 'smallcaps(' + cadena(titulo) + ')' : cadena(titulo)}) } },`);
    L.push(`  footer: context { let p = here().page(); if ${o.numeros ? 'true' : 'false'} and p > ${o.portada ? 1 : 0} { set text(size: ${f2(cuerpo * 0.8)}pt, fill: azul${lit ? '' : ', font: ' + sans}); align(center, str(p)) } })`);
    L.push(`#set text(font: ${serif}, size: ${f2(cuerpo)}pt, lang: "es", region: "AR", hyphenate: true, fill: negro, top-edge: 1em, bottom-edge: 0pt)`);
    L.push(`#set smartquote(enabled: false)`, `#show heading: set text(hyphenate: false)`);
    L.push(`#set par(justify: true, leading: ${f2(renglon - cuerpo)}pt, spacing: ${f2(renglon - cuerpo)}pt, first-line-indent: (amount: ${lit ? '1.2em' : '1em'}, all: false))`);
    L.push(`#set list(marker: box(width: 0.3em, height: 0.3em, fill: azul), indent: 0.4em)`, `#set enum(indent: 0.2em)`);
    L.push(`#set quote(block: true)`, `#show quote.where(block: true): it => pad(left: 1.2em, right: 0.6em, text(size: 0.92em, it.body))`);
    if (lit) L.push(`#show heading: it => { set text(font: ${serif}, weight: "regular", size: ${f2(cuerpo * 1.25)}pt); set align(center); v(${f2(renglon)}pt); smallcaps(it.body); v(${f2(renglon * 0.5)}pt) }`);
    else L.push(`#show heading: it => { set text(font: ${sans}, weight: "semibold", size: if it.level == 1 { ${f2(cuerpo * 1.35)}pt } else { ${f2(cuerpo * 1.1)}pt }, fill: azul); block(above: ${f2(renglon * 1.4)}pt, below: ${f2(renglon * 0.6)}pt, it.body) }`);
    L.push(`#let separador = align(center, block(above: ${f2(renglon)}pt, below: ${f2(renglon)}pt, text(fill: azul)[⁂]))`);
    L.push(`#let capitular(l) = text(font: ${lit ? serif : '"UnifrakturMaguntia"'}, size: 2.4em, fill: azul, l)`);
    if (o.portada && (titulo || autor)) {
      L.push(`#page(header: none, footer: none)[`, `  #set align(center + horizon)`, `  #set par(first-line-indent: 0pt)`);
      if (titulo) L.push(`  #text(font: ${lit ? serif : '"UnifrakturMaguntia"'}, size: ${f2(cuerpo * (fz ? 2.2 : 2.4))}pt, fill: azul, hyphenate: false, ${cadena(titulo)})`);
      if (autor) L.push(`  #v(${f2(renglon)}pt)`, `  #text(font: ${lit ? serif : sans}, size: ${f2(cuerpo * 1.2)}pt, ${lit ? 'smallcaps(' + cadena(autor) + ')' : cadena(autor)})`);
      L.push(`]`);
    }
    L.push('', aTypst(md, { capitular: o.capitular }));
    return L.join('\n');
  }

  return { orto, ORTO, aTypst, enLinea, documento, medidas, FORMATOS, ESTILOS, HOJA_FZ, DEF, num };
})();
if (typeof module !== 'undefined') module.exports = Prensa;

// ---------- Motor (typst.ts): compilador + renderer + fuentes OFL, bajados una vez y guardados por el navegador ----------
const Motor = (() => {
  const BASE = '/vendor/typst/';
  // D1 (consultas/104-galera-prensa.md): el WASM del compilador pesa 27 MB y no entra en Cloudflare Pages. Si se aloja en R2, cambia esta URL y se suma el host a connect-src.
  const WASM = BASE + 'typst_ts_web_compiler_bg.wasm?v=0.7.0';
  const FUENTES = ['Literata-Regular', 'Literata-Italic', 'Literata-Bold', 'Literata-BoldItalic', 'InstrumentSans-Regular', 'InstrumentSans-SemiBold', 'UnifrakturMaguntia-Book'];
  // El navegador ejecuta lo que le den: se baja el binario, se calcula su SHA-256 y solo si coincide con el fijado acá se inicializa.
  // Si el WASM se aloja en R2 (descargas.galera.com.ar), este control garantiza que sea el mismo que sale de tools/bajar_typst.py.
  const WASM_SHA256 = '1fc968438a672366dfec39c96c842c26ed29caff4eb1bcaab19a6c60867de5fd';
  const RENDERER_SHA256 = '5a93d7a8b3b7b43b0e679f3dafed966f74fc1653cc7ed6623f04a8a6550da725';
  async function binarioVerificado(url, esperado) {
    const nombre = url.split('/').pop().split('?')[0];
    const r = await fetch(url);
    if (!r.ok) throw new Error('No pude bajar ' + nombre);
    const buf = await r.arrayBuffer();
    const h = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', buf)), b => b.toString(16).padStart(2, '0')).join('');
    if (h !== esperado) throw new Error('El archivo ' + nombre + ' no es el esperado (huella distinta)');
    return buf;
  }
  let promesa = null, C = null, R = null;
  function prender(avance) {
    return promesa || (promesa = (async () => {
      const [cm, rm] = await Promise.all([import(BASE + 'typst_ts_web_compiler.mjs'), import(BASE + 'typst_ts_renderer.mjs')]);
      avance && avance('Bajando el motor de Typst (unos 27 MB sin comprimir, una sola vez)…');
      const [wc, wr] = await Promise.all([binarioVerificado(WASM, WASM_SHA256), binarioVerificado(BASE + 'typst_ts_renderer_bg.wasm?v=0.7.0', RENDERER_SHA256)]);
      await Promise.all([cm.default({ module_or_path: wc }), rm.default({ module_or_path: wr })]);
      avance && avance('Cargando las tipografías…');
      const b = new cm.TypstCompilerBuilder(); b.set_dummy_access_model();
      const bytes = await Promise.all(FUENTES.map(f => fetch(BASE + 'fuentes/' + f + '.ttf').then(r => { if (!r.ok) throw new Error('No pude bajar la tipografía ' + f); return r.arrayBuffer(); })));
      for (const x of bytes) await b.add_raw_font(new Uint8Array(x));
      C = await b.build(); R = await new rm.TypstRendererBuilder().build();
    })().catch(e => { promesa = null; throw e; }));
  }
  function compilar(fuente, fmt) {
    C.add_source('/main.typ', fuente);
    const r = C.compile('/main.typ', null, fmt, 1);
    const datos = r && r.result ? r.result : r instanceof Uint8Array ? r : null;
    if (!datos) throw new Error((r && r.diagnostics || []).map(d => d.message || JSON.stringify(d)).join(' · ') || 'Typst no devolvió nada');
    return datos;
  }
  // Ojo: el SVG se inserta con innerHTML y solo se le quitan los <script>. Lo demás lo frena la CSP sin 'unsafe-inline' (#74): no volver a permitirlo.
  function vista(fuente) {
    const v = compilar(fuente, 'vector'), s = R.session_from_artifact(v, 'vector');
    try { const P = s.pages_info, tam = []; for (let i = 0; i < P.page_count; i++) { const p = P.page(i); tam.push([p.width_pt, p.height_pt]); } return { svg: R.svg_data(s).replace(/<script[\s\S]*?<\/script>/g, ''), paginas: P.page_count, tam }; } finally { s.free(); }
  }
  return { prender, compilar, vista, listo: () => !!C, WASM };
})();

// PDF para la imprenta: cajas de corte y sangrado declaradas (Typst no las escribe) y, en acaballado, páginas en múltiplo de 4.
async function prensaPdf(o) {
  const L = await Imprenta.lib(), M = Prensa.medidas(o), MM = 72 / 25.4;
  const doc = await L.PDFDocument.load(Motor.compilar(Prensa.documento(prensaTexto(o), o), 'pdf'));
  const n = doc.getPageCount(), b = M.b * MM;
  if (o.formato === 'acaballado') for (let i = n; i % 4; i++) doc.addPage([(M.w + 2 * M.b) * MM, (M.h + 2 * M.b) * MM]);
  doc.getPages().forEach(p => { const w = p.getWidth(), h = p.getHeight(); p.setBleedBox(0, 0, w, h); p.setTrimBox(b, b, w - 2 * b, h - 2 * b); });
  doc.setProducer('Galera · galera.com.ar/imprenta/ (Typst)'); doc.setCreator('Galera');
  return { bytes: await doc.save(), paginas: doc.getPageCount(), blancas: doc.getPageCount() - n };
}

// ---------- Pantalla ----------
const PRENSA_EJEMPLO = `# Un fanzine en diez minutos

Escribí acá, o pegá desde Word o Google Docs: las negritas, las cursivas y los títulos se conservan. Galera arma las páginas mientras escribís... y corrige la ortotipografía por script: los puntos suspensivos, las rayas de diálogo, los espacios de más .

-¿Y las comillas? -preguntó alguien.

-Se respetan como las pusiste -le contestaron-. Unificarlas es opcional.

***

## Cómo se usa

- Un título va con # al principio del renglón; un subtítulo, con ##.
- Tres asteriscos solos en un renglón hacen un separador.
- Un renglón con \\salto empieza una página nueva.

Cuando te guste, bajá el PDF impuesto, imprimilo de un solo lado y seguí los pasos de armado.`;

function prensaS() {
  if (typeof V === 'undefined') return Object.assign({}, Prensa.DEF);
  if (!V.prensa) { V.prensa = Object.assign({}, Prensa.DEF, { texto: '' }); prensaAbrir(); }
  return V.prensa;
}
const prensaTexto = o => o.orto ? Prensa.orto(o.texto, { comillas: o.comillas }).texto : o.texto;

// Guardado en el navegador (IndexedDB): el borrador no sale de la compu.
const PrensaDB = {
  abrir() { return new Promise((ok, mal) => { if (typeof indexedDB === 'undefined') return mal(new Error('sin IndexedDB')); const r = indexedDB.open('galera-prensa', 1); r.onupgradeneeded = () => r.result.createObjectStore('proyectos'); r.onsuccess = () => ok(r.result); r.onerror = () => mal(r.error); }); },
  async leer() { const db = await this.abrir(); return new Promise(ok => { const q = db.transaction('proyectos').objectStore('proyectos').get('actual'); q.onsuccess = () => ok(q.result || null); q.onerror = () => ok(null); }); },
  async guardar(v) { const db = await this.abrir(); return new Promise(ok => { const t = db.transaction('proyectos', 'readwrite'); t.objectStore('proyectos').put(v, 'actual'); t.oncomplete = () => ok(true); t.onerror = () => ok(false); }); }
};
async function prensaAbrir() {
  try {
    const g = await PrensaDB.leer();
    if (g && typeof g.texto === 'string') { Object.assign(V.prensa, Prensa.DEF, g); if (V.tab === 'imprenta' && typeof render === 'function') render(); }
  } catch (e) { /* sin guardado: se trabaja igual */ }
}
let prensaReloj = null, prensaGuardo = null;
function prensaGuardar() {
  clearTimeout(prensaGuardo);
  prensaGuardo = setTimeout(() => { const s = prensaS(), g = {}; Object.keys(Prensa.DEF).concat('texto').forEach(k => { g[k] = s[k]; }); PrensaDB.guardar(g).catch(() => {}); }, 600);
}

function vImprenta() {
  const s = prensaS(), fz = s.formato === 'fanzine';
  if (typeof document !== 'undefined' && typeof PRERENDER === 'undefined') { prensaCargarTurndown(); if (Motor.listo()) setTimeout(prensaActualizar, 0); }   // cada render rehace la vista previa
  const sel = (k, t, opts) => `<label class="gl-pr-campo"><span>${t}</span><select data-pr="opcion" data-pr-k="${k}">${opts.map(([v, x]) => `<option value="${esc(v)}"${String(s[k]) === v ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select></label>`;
  const txt = (k, t, ph, w) => `<label class="gl-pr-campo"${w ? ` style="max-width:${w}"` : ''}><span>${t}</span><input data-pr="texto-op" data-pr-k="${k}" value="${esc(s[k] || '')}" placeholder="${esc(ph || '')}" autocomplete="off"${k === 'cuerpo' ? ' inputmode="decimal" maxlength="5"' : ' maxlength="120"'}></label>`;
  const chk = (k, t) => `<label class="gl-pr-chk"><input type="checkbox" data-pr="opcion" data-pr-k="${k}"${s[k] ? ' checked' : ''}> ${t}</label>`;
  return `<div class="gl-v gl-pr">
    <div class="gl-cab"><h1 class="gl-t1 sin-cap">Imprenta</h1></div>
    <p class="gl-baja">Escribí o pegá tu texto y Galera lo arma como fanzine o como acaballado, listo para imprimir en casa o mandar a la imprenta. Todo pasa en tu navegador: el texto no se sube a ningún lado.</p>
    <p class="gl-pr-celu gl-chico" role="note">El editor está pensado para una pantalla grande: en el celular se usa, pero incómodo. Para revisar un PDF o imponerlo, usá <a class="gl-enlace" href="/antes-de-imprimir/">Antes de imprimir</a>.</p>
    <div class="gl-pr-ops">
      ${sel('formato', 'Formato', Object.keys(Prensa.FORMATOS).map(k => [k, Prensa.FORMATOS[k].t]))}
      ${fz ? sel('hoja', 'Hoja', [['a4', 'A4'], ['carta', 'Carta']]) : ''}
      ${sel('estilo', 'Estilo', Object.keys(Prensa.ESTILOS).map(k => [k, Prensa.ESTILOS[k]]))}
      ${txt('titulo', 'Título', 'Sin título')}${txt('autor', 'Autor o autora', '')}${txt('cuerpo', 'Cuerpo (pt)', String(Prensa.FORMATOS[s.formato].cuerpo).replace('.', ','), '7rem')}
    </div>
    <div class="gl-pr-ops gl-pr-chks">${chk('portada', 'Portada con el título')}${chk('capitular', 'Capitular')}${chk('numeros', 'Números de página')}${chk('orto', 'Corregir la ortotipografía')}${s.orto ? chk('comillas', 'Unificar comillas en «»') : ''}</div>
    <div class="gl-pr-trabajo">
      <div class="gl-pr-izq">
        <label class="gl-pr-lbl" for="pr-texto">Tu texto <span class="gl-tenue">(Markdown: # título, **negrita**, *cursiva*)</span></label>
        <textarea id="pr-texto" class="gl-pr-texto" data-pr="texto" spellcheck="true" lang="es" placeholder="Escribí o pegá acá tu texto…">${esc(s.texto || '')}</textarea>
        <div class="gl-pr-fila"><button class="gl-btn gl-btn--sec" type="button" data-pr="ejemplo">Cargar un ejemplo</button><button class="gl-btn gl-btn--sec" type="button" data-pr="bajar-md">Bajar el texto (.md)</button>
          <label class="gl-btn gl-btn--sec gl-pr-abrir">Abrir un .md o .txt<input type="file" accept=".md,.txt,text/markdown,text/plain" data-pr="abrir-md" hidden></label></div>
        <div id="pr-orto" class="gl-chico" aria-live="polite">${prensaOrtoInforme()}</div>
      </div>
      <div class="gl-pr-der">
        <div id="pr-estado" class="gl-chico" aria-live="polite">${Motor.listo() ? '' : '<button class="gl-btn" type="button" data-pr="prender">Prender la vista previa</button> <span class="gl-tenue">Baja el motor de Typst: pesa unos 27 MB (alrededor de 10 MB en la conexión si el servidor lo comprime), una sola vez. Con datos móviles, mejor esperar al wifi.</span>'}</div>
        <div id="pr-vista" class="gl-pr-vista" aria-label="Vista previa de las páginas"></div>
        <div id="pr-salida">${prensaSalida()}</div>
      </div>
    </div></div>`;
}
function prensaOrtoInforme() {
  const s = prensaS();
  if (!s.orto || !s.texto) return '';
  const r = Prensa.orto(s.texto, { comillas: s.comillas });
  if (!r.total) return '<p class="gl-tenue">Ortotipografía: no encontré nada para corregir.</p>';
  const L = Object.keys(r.cambios).map(k => Prensa.ORTO[k] + ' (' + r.cambios[k] + ')');
  return `<p>Ortotipografía: en el PDF corrijo ${esc(L.join('; '))}. Tu texto queda como está. <button class="gl-btn gl-btn--sec gl-btn--ch" type="button" data-pr="aplicar-orto">Aplicarlo también al texto</button></p>`;
}
function prensaSalida() {
  const s = prensaS(), fz = s.formato === 'fanzine';
  if (!Motor.listo()) return '';
  return `<div class="gl-pr-fila"><button class="gl-btn" type="button" data-pr="pdf-impuesto">${fz ? 'Bajar el fanzine para imprimir' : 'Bajar el impuesto para imprimir en casa'}</button>
    <button class="gl-btn gl-btn--sec" type="button" data-pr="pdf-sueltas">Bajar las páginas sueltas${fz ? '' : ' (para la imprenta)'}</button></div>
    <p class="gl-chico gl-tenue">${fz ? 'El fanzine sale en una hoja ' + (s.hoja === 'carta' ? 'carta' : 'A4') + ' apaisada, con la línea de corte marcada.' : 'Las páginas sueltas llevan 3 mm de sangrado y las cajas de corte declaradas; el impuesto va en A4, a doble faz.'} Antes de mandarlo, pasalo por <a class="gl-enlace" href="/antes-de-imprimir/">Antes de imprimir</a>.</p>
    ${typeof pasosImp === 'function' ? pasosImp(fz) : ''}`;
}

async function prensaActualizar() {
  const s = prensaS(), est = document.getElementById('pr-estado'), vis = document.getElementById('pr-vista');
  if (!Motor.listo() || !vis) return;
  try {
    const t0 = performance.now(), r = Motor.vista(Prensa.documento(prensaTexto(s), s));
    vis.innerHTML = r.svg;
    // Typst no pinta el fondo de la página: se le pone el blanco del papel (solo en la vista; el PDF no lleva un rectángulo blanco).
    vis.querySelectorAll('g.typst-page').forEach((g, i) => { const t = r.tam[i]; if (!t) return; const q = document.createElementNS('http://www.w3.org/2000/svg', 'rect'); q.setAttribute('width', t[0]); q.setAttribute('height', t[1]); q.setAttribute('class', 'gl-pr-papel'); g.insertBefore(q, g.firstChild); });
    const fz = s.formato === 'fanzine', mal = fz && r.paginas > 8;
    if (est) est.innerHTML = mal ? `<p class="gl-pr-mal" role="alert">Tu texto ocupa ${r.paginas} páginas y el fanzine de una hoja lleva 8: achicá el cuerpo, recortá o pasá a acaballado.</p>`
      : `<p class="gl-tenue">${r.paginas === 1 ? 'Una página' : r.paginas + ' páginas'}${fz && r.paginas < 8 ? ' (las que faltan para 8 quedan en blanco)' : !fz && r.paginas % 4 ? ' (al imponer se suman ' + (4 - r.paginas % 4) + ' en blanco para llegar al múltiplo de 4)' : ''} · armado en ${Math.round(performance.now() - t0)} ms</p>`;
    s.paginas = r.paginas;
  } catch (e) {
    if (est) est.innerHTML = `<p class="gl-pr-mal" role="alert">No pude armar las páginas: ${esc(String(e.message || e)).slice(0, 300)}</p>`;
  }
}
function prensaProgramar() { clearTimeout(prensaReloj); prensaReloj = setTimeout(prensaActualizar, 350); }

async function prensaPrender() {
  const est = document.getElementById('pr-estado');
  const avance = t => { if (est) est.innerHTML = `<p class="gl-tenue">${esc(t)}</p>`; };
  try {
    avance('Preparando…');
    await Motor.prender(avance);
    if (typeof medir === 'function') medir('motor_typst', {});
    const sal = document.getElementById('pr-salida'); if (sal) sal.innerHTML = prensaSalida();
    prensaActualizar();
  } catch (e) {
    if (est) est.innerHTML = `<p class="gl-pr-mal" role="alert">No pude bajar el motor de Typst: ${esc(String(e.message || e)).slice(0, 200)}. Puede ser la conexión, o que este navegador no admita WebAssembly.</p>`;
  }
}

function prensaBajar(bytes, tipo, nombre) {
  const url = URL.createObjectURL(new Blob([bytes], { type: tipo })), a = document.createElement('a');
  a.href = url; a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
}
const prensaNombre = s => (String(s.titulo || 'galera').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'galera');
async function prensaPdfBajar(impuesto) {
  const s = prensaS();
  try {
    if (s.formato === 'fanzine' && (s.paginas || 0) > 8) throw new Error('el fanzine de una hoja lleva 8 páginas');
    const r = await prensaPdf(s);
    if (!impuesto) { prensaBajar(r.bytes, 'application/pdf', prensaNombre(s) + '-paginas.pdf'); aviso('Listo: ' + r.paginas + ' páginas' + (r.blancas ? ', con ' + r.blancas + ' en blanco al final' : '')); }
    else {
      const fz = s.formato === 'fanzine', I = await Imprenta.imponer(r.bytes, { modo: fz ? 'fanzine' : 'acaballado', hoja: fz ? s.hoja : 'a4', guias: true, creep: 0 });
      prensaBajar(I.bytes, 'application/pdf', prensaNombre(s) + '-' + (fz ? 'fanzine' : 'acaballado') + '.pdf');
      aviso('Listo: ' + (I.hojas === 1 ? 'una hoja' : I.hojas + ' hojas') + ' para imprimir');
    }
    if (typeof medir === 'function') medir('pdf_prensa', { formato: s.formato, salida: impuesto ? 'impuesto' : 'sueltas', estilo: s.estilo });
  } catch (e) { aviso('No pude armar el PDF: ' + (e.message || e)); }
}

// Pegado desde Word o Google Docs: el HTML del portapapeles pasa a Markdown con Turndown (MIT, /vendor/turndown.js).
let prensaTD = null;
function prensaTurndown() {
  if (prensaTD || typeof TurndownService === 'undefined') return prensaTD;
  prensaTD = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-', emDelimiter: '*', strongDelimiter: '**', hr: '***' });
  prensaTD.remove(['style', 'script', 'meta', 'title', 'img']);
  // Google Docs marca negritas y cursivas con estilos en <span>, no con <b> ni <i>.
  prensaTD.addRule('docs', {
    filter: n => n.nodeName === 'SPAN' && /font-weight:\s*(700|bold)|font-style:\s*italic/.test(n.getAttribute('style') || ''),
    replacement: (c, n) => { if (!c.trim()) return c; const st = n.getAttribute('style') || '', b = /font-weight:\s*(700|bold)/.test(st), i = /font-style:\s*italic/.test(st); return (b ? '**' : '') + (i ? '*' : '') + c + (i ? '*' : '') + (b ? '**' : ''); }
  });
  // El envoltorio <b style="font-weight:normal"> de Docs no es una negrita.
  prensaTD.addRule('docsB', { filter: n => n.nodeName === 'B' && /font-weight:\s*normal/.test(n.getAttribute('style') || ''), replacement: c => c });
  return prensaTD;
}
function prensaCargarTurndown() {
  if (typeof TurndownService !== 'undefined' || document.getElementById('pr-td')) return;
  const sc = document.createElement('script'); sc.id = 'pr-td'; sc.src = '/vendor/turndown.js?v=7.2.5'; document.head.appendChild(sc);
}

if (typeof document !== 'undefined' && typeof document.addEventListener === 'function' && !window.prensaEventos) {
  window.prensaEventos = true;
  const blanco = e => { const t = e.target && e.target.closest ? e.target.closest('[data-pr]') : null; return t && t.closest('.gl-pr') ? t : null; };
  const cambio = () => { prensaGuardar(); const o = document.getElementById('pr-orto'); if (o) o.innerHTML = prensaOrtoInforme(); prensaProgramar(); };
  document.addEventListener('input', e => {
    const t = blanco(e); if (!t) return;
    const s = prensaS();
    if (t.dataset.pr === 'texto') { s.texto = t.value; cambio(); }
    if (t.dataset.pr === 'texto-op') { s[t.dataset.prK] = t.value; cambio(); }
  });
  document.addEventListener('change', async e => {
    const t = blanco(e); if (!t) return;
    const s = prensaS();
    if (t.dataset.pr === 'opcion') {
      s[t.dataset.prK] = t.type === 'checkbox' ? t.checked : t.value;
      if (t.dataset.prK === 'formato') s.cuerpo = '';
      prensaGuardar(); const id = t.dataset.prK;
      if (typeof render === 'function') render();
      const de = document.querySelector(`.gl-pr [data-pr-k="${id}"]`); if (de) de.focus();
      prensaActualizar();
    }
    if (t.dataset.pr === 'abrir-md' && t.files && t.files[0]) {
      const f = t.files[0];
      if (f.size > 5e6) { aviso('El archivo es muy grande para el editor (más de 5 MB).'); return; }
      s.texto = await f.text(); if (!s.titulo) s.titulo = f.name.replace(/\.(md|txt)$/i, '');
      prensaGuardar(); if (typeof render === 'function') render(); prensaActualizar();
    }
  });
  document.addEventListener('click', e => {
    const t = blanco(e); if (!t) return;
    const s = prensaS(), a = t.dataset.pr;
    if (a === 'prender') prensaPrender();
    if (a === 'ejemplo') { if (s.texto && s.texto.trim() && !confirm('Esto reemplaza tu texto por el ejemplo. ¿Sigo?')) return; s.texto = PRENSA_EJEMPLO; s.titulo = s.titulo || 'Un fanzine en diez minutos'; prensaGuardar(); render(); prensaActualizar(); }
    if (a === 'aplicar-orto') { s.texto = Prensa.orto(s.texto, { comillas: s.comillas }).texto; prensaGuardar(); render(); prensaActualizar(); aviso('Listo: correcciones aplicadas al texto'); }
    if (a === 'bajar-md') prensaBajar(new TextEncoder().encode(s.texto || ''), 'text/markdown', prensaNombre(s) + '.md');
    if (a === 'pdf-sueltas') prensaPdfBajar(false);
    if (a === 'pdf-impuesto') prensaPdfBajar(true);
  });
  document.addEventListener('paste', e => {
    const t = blanco(e); if (!t || t.dataset.pr !== 'texto' || !e.clipboardData) return;
    const html = e.clipboardData.getData('text/html'), td = html && prensaTurndown();
    if (!td) return;   // sin HTML (o sin Turndown todavía): pega el texto plano, como siempre
    e.preventDefault();
    let md = td.turndown(html.replace(/<!--[\s\S]*?-->/g, '')).replace(/\n{3,}/g, '\n\n').replace(/^(\s*)([-*+]|\d+\.)\s{2,}/gm, '$1$2 ').trim();
    // Lo pegado con varios párrafos va como bloque aparte: no se pega al final del renglón anterior.
    if (/\n/.test(md)) {
      const antes = t.value.slice(0, t.selectionStart), despues = t.value.slice(t.selectionEnd);
      if (antes && !/\n\n$/.test(antes)) md = (/\n$/.test(antes) ? '\n' : '\n\n') + md;
      if (despues && !/^\n\n/.test(despues)) md += /^\n/.test(despues) ? '\n' : '\n\n';
    }
    t.setRangeText(md, t.selectionStart, t.selectionEnd, 'end');
    t.dispatchEvent(new Event('input', { bubbles: true }));
    aviso('Pegado con formato: títulos, negritas y cursivas pasaron a Markdown');
  });
}
// Al entrar a la pantalla: Turndown listo para el primer pegado y, si el motor ya estaba prendido, la vista al día.
function prensaAlEntrar() { prensaCargarTurndown(); if (Motor.listo()) setTimeout(prensaActualizar, 0); }
