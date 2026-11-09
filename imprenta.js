// ANTES DE IMPRIMIR (v143, Galera Prensa tanda A): analiza un PDF ajeno (preflight básico) y lo impone como acaballado o fanzine.
// Todo pasa en el navegador con pdf-lib (MIT, /vendor/pdf-lib.min.js, se baja recién al elegir un archivo): el PDF no sale de la compu.
// Imprenta.* son las cuentas, sin DOM (se prueban en node con tools/probar_imprenta.js); vImprimir y lo que sigue es la pantalla.
'use strict';
const Imprenta = (() => {
  const MM = 72 / 25.4;   // puntos por milímetro
  const PDFLIB = '/vendor/pdf-lib.min.js?v=1.17.1';
  let promesa = null;
  function lib() {
    if (typeof PDFLib !== 'undefined') return Promise.resolve(PDFLib);
    return promesa || (promesa = new Promise((ok, mal) => {
      const s = document.createElement('script'); s.src = PDFLIB;
      s.onload = () => ok(PDFLib); s.onerror = () => { promesa = null; mal(new Error('No se pudo bajar pdf-lib')); };
      document.head.appendChild(s);
    }));
  }

  // Tamaños que se reconocen al corte (mm, vertical). Con 3 mm por lado de más, se lee como «con sangrado».
  const TAMANOS = [['A3', 297, 420], ['A4', 210, 297], ['A5', 148, 210], ['A6', 105, 148], ['Carta', 215.9, 279.4], ['Oficio', 215.9, 355.6],
    ['13 × 20 cm', 130, 200], ['14 × 20 cm', 140, 200], ['15 × 21 cm', 150, 210], ['15 × 23 cm', 150, 230], ['16 × 23 cm', 160, 230], ['17 × 24 cm', 170, 240]];
  const r1 = v => Math.round(v * 10) / 10;
  function reconocer(wmm, hmm) {
    const a = Math.min(wmm, hmm), b = Math.max(wmm, hmm), cerca = (x, y) => Math.abs(x - y) <= 0.6;
    for (const [n, w, h] of TAMANOS) {
      if (cerca(a, w) && cerca(b, h)) return { nombre: n, sangrado: 0 };
      for (const s of [3, 5]) if (cerca(a, w + 2 * s) && cerca(b, h + 2 * s)) return { nombre: n, sangrado: s };
    }
    return null;
  }

  // ---------- lectura de objetos ----------
  function herramientas(L, doc) {
    const N = s => L.PDFName.of(s);
    const look = x => x instanceof L.PDFRef ? doc.context.lookup(x) : x;
    const get = (d, k) => d && typeof d.get === 'function' && d instanceof L.PDFDict ? look(d.get(N(k))) : undefined;
    const nom = x => x instanceof L.PDFName ? x.decodeText ? x.decodeText() : String(x).replace(/^\//, '') : '';
    const num = x => x instanceof L.PDFNumber ? x.asNumber() : (typeof x === 'number' ? x : NaN);
    const items = a => a instanceof L.PDFArray ? a.asArray().map(look) : [];
    const bytes = s => {
      try {
        if (s instanceof L.PDFRawStream) return L.decodePDFRawStream(s).decode();
        if (s && s.getUnencodedContents) return s.getUnencodedContents();
        if (s && s.getContents) return s.getContents();
      } catch (e) { /* filtro que pdf-lib no sabe leer */ }
      return null;
    };
    return { N, look, get, nom, num, items, bytes };
  }

  // Lector mínimo de flujos de contenido: sigue q/Q/cm para saber a qué tamaño queda cada imagen (Do e imágenes en línea BI…EI),
  // y anota gs (transparencias) y los operadores de color RGB de texto y vectores (rg/RG).
  const esBlanco = c => c === 0 || c === 9 || c === 10 || c === 12 || c === 13 || c === 32;
  const esDelim = c => esBlanco(c) || c === 40 || c === 41 || c === 60 || c === 62 || c === 91 || c === 93 || c === 123 || c === 125 || c === 47 || c === 37;
  const texto = (b, i, j) => { let s = ''; for (let k = i; k < j; k++) s += String.fromCharCode(b[k]); return s; };
  const mult = (m, n) => [m[0] * n[0] + m[1] * n[2], m[0] * n[1] + m[1] * n[3], m[2] * n[0] + m[3] * n[2], m[2] * n[1] + m[3] * n[3], m[4] * n[0] + m[5] * n[2] + n[4], m[4] * n[1] + m[5] * n[3] + n[5]];
  function escanear(b, alOperador) {
    const n = b.length; let i = 0, ops = [];
    while (i < n) {
      const c = b[i];
      if (esBlanco(c)) { i++; continue; }
      if (c === 37) { while (i < n && b[i] !== 10 && b[i] !== 13) i++; continue; }
      if (c === 40) { let d = 1; i++; while (i < n && d > 0) { if (b[i] === 92) i += 2; else { if (b[i] === 40) d++; else if (b[i] === 41) d--; i++; } } ops.push({ s: 1 }); continue; }
      if (c === 60) { if (b[i + 1] === 60) { i += 2; ops.push({ d: 1 }); continue; } while (i < n && b[i] !== 62) i++; i++; ops.push({ s: 1 }); continue; }
      if (c === 62) { i += b[i + 1] === 62 ? 2 : 1; continue; }
      if (c === 91 || c === 93 || c === 123 || c === 125 || c === 41) { i++; continue; }
      if (c === 47) { let j = i + 1; while (j < n && !esDelim(b[j])) j++; ops.push({ n: texto(b, i + 1, j) }); i = j; continue; }
      let j = i; while (j < n && !esDelim(b[j])) j++;
      const w = texto(b, i, j); i = j;
      if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(w)) { ops.push({ v: +w }); continue; }
      if (w === 'true' || w === 'false' || w === 'null') { ops.push({ v: w === 'true' }); continue; }   // operandos, no operadores (p. ej. /IM true)
      if (w === 'ID') {   // datos binarios de una imagen en línea: hasta « EI »
        const par = ops; i++;
        let k = i; while (k < n - 2 && !(esBlanco(b[k]) && b[k + 1] === 69 && b[k + 2] === 73 && (k + 3 >= n || esDelim(b[k + 3])))) k++;
        i = k + 3; alOperador('BI', par); ops = []; continue;
      }
      if (w === 'BI') { ops = []; continue; }
      alOperador(w, ops); ops = [];
    }
  }

  function espacioColor(H, cs, prof) {
    cs = H.look(cs);
    if (prof > 4 || cs == null) return 'otro';
    const nm = H.nom(cs);
    if (nm) return ({ DeviceRGB: 'RGB', RGB: 'RGB', CalRGB: 'RGB', DeviceCMYK: 'CMYK', CMYK: 'CMYK', DeviceGray: 'gris', G: 'gris', CalGray: 'gris', Lab: 'RGB' })[nm] || 'otro';
    const it = H.items(cs); const t = H.nom(it[0]);
    if (t === 'ICCBased') { const n = H.num(H.get(it[1] && it[1].dict, 'N')); return n === 4 ? 'CMYK' : n === 1 ? 'gris' : 'RGB'; }
    if (t === 'Indexed' || t === 'I') return espacioColor(H, it[1], prof + 1);
    if (t === 'Separation' || t === 'DeviceN') return 'plana';
    if (t === 'CalRGB' || t === 'Lab') return 'RGB';
    if (t === 'CalGray') return 'gris';
    return 'otro';
  }

  async function analizar(datos) {
    const L = await lib();
    const cab = texto(datos, 0, Math.min(1024, datos.length)), mv = /%PDF-(\d\.\d)/.exec(cab);
    let doc;
    try { doc = await L.PDFDocument.load(datos, { ignoreEncryption: true, updateMetadata: false, throwOnInvalidObject: false }); }
    catch (e) { return { error: 'No pude leer el archivo como PDF. Puede estar dañado o no ser un PDF.' }; }
    const H = herramientas(L, doc), cat = doc.catalog;
    const R = { paginas: doc.getPageCount(), version: mv ? mv[1] : '?', cifrado: !!doc.isEncrypted, pdfx: '', pdfa: '', tamanos: [], fuentes: { total: 0, sin: [] },
      imagenes: { n: 0, minPpi: Infinity, bajas: [], color: { RGB: 0, CMYK: 0, gris: 0, plana: 0, otro: 0 }, bitmap: 0 }, transparencia: false, rgbVector: 0, anotaciones: 0, girada: 0, operadores: 0, truncado: false, chequeos: [] };
    const vc = H.nom(H.get(cat, 'Version')); if (vc && vc > R.version) R.version = vc;

    // PDF/X y PDF/A: OutputIntents (GTS_PDFX), el diccionario Info y los metadatos XMP.
    for (const oi of H.items(H.get(cat, 'OutputIntents'))) if (H.nom(H.get(oi, 'S')) === 'GTS_PDFX') R.pdfx = R.pdfx || 'PDF/X';
    const info = H.look(doc.context.trailerInfo.Info);
    const vx = H.get(info, 'GTS_PDFXVersion'); if (vx && vx.decodeText) R.pdfx = vx.decodeText();
    const meta = H.get(cat, 'Metadata'), xmp = meta ? H.bytes(meta) : null;
    if (xmp) {
      const t = texto(xmp, 0, Math.min(xmp.length, 200000));
      const x = /GTS_PDFXVersion(?:>|=")([^<"]+)/.exec(t); if (x) R.pdfx = x[1].trim();
      const a = /pdfaid:part(?:>|=")(\d)/.exec(t), c = /pdfaid:conformance(?:>|=")(\w)/.exec(t); if (a) R.pdfa = 'PDF/A-' + a[1] + (c ? c[1].toLowerCase() : '');
    }

    const fuentesVistas = new Set(), imagenesVistas = new Map(), formas = new Set();
    function revisarFuentes(res) {
      const F = H.get(res, 'Font'); if (!(F instanceof L.PDFDict)) return;
      for (const [k, ref] of F.entries()) {
        const clave = ref instanceof L.PDFRef ? ref.toString() : 'd' + fuentesVistas.size + H.nom(k);
        if (fuentesVistas.has(clave)) continue; fuentesVistas.add(clave);
        const f = H.look(ref); if (!(f instanceof L.PDFDict)) continue;
        R.fuentes.total++;
        const tipo = H.nom(H.get(f, 'Subtype')); if (tipo === 'Type3') continue;
        let fd = H.get(f, 'FontDescriptor');
        if (tipo === 'Type0') { const d = H.items(H.get(f, 'DescendantFonts'))[0]; fd = H.get(d, 'FontDescriptor'); }
        const inc = fd && (H.get(fd, 'FontFile') || H.get(fd, 'FontFile2') || H.get(fd, 'FontFile3'));
        if (!inc) { const nm = H.nom(H.get(f, 'BaseFont')).replace(/^[A-Z]{6}\+/, '') || 'sin nombre'; if (!R.fuentes.sin.includes(nm)) R.fuentes.sin.push(nm); }
      }
    }
    function datosImagen(d) {
      return { w: H.num(H.get(d, 'Width')) || H.num(H.get(d, 'W')), h: H.num(H.get(d, 'Height')) || H.num(H.get(d, 'H')),
        bit: H.get(d, 'ImageMask') && String(H.get(d, 'ImageMask')) === 'true' || H.num(H.get(d, 'BitsPerComponent')) === 1 };
    }
    function colocar(img, ctm, pag) {
      const ancho = Math.hypot(ctm[0], ctm[1]), alto = Math.hypot(ctm[2], ctm[3]);
      if (ancho < 2 || alto < 2 || !(img.w > 1) || !(img.h > 1)) return;   // puntitos y patrones: ruido
      const ppi = Math.round(Math.min(img.w / (ancho / 72), img.h / (alto / 72)));
      const umbral = img.bit ? 600 : 300;
      if (ppi < R.imagenes.minPpi) R.imagenes.minPpi = ppi;
      if (ppi < umbral && R.imagenes.bajas.length < 50) R.imagenes.bajas.push({ pag, ppi, bit: img.bit, mm: [Math.round(ancho / MM), Math.round(alto / MM)] });
    }
    function recorrer(contenido, res, ctm0, pag, prof) {
      if (!contenido || prof > 8) return;
      revisarFuentes(res);
      const pila = []; let ctm = ctm0.slice();
      escanear(contenido, (op, a) => {
        // Tope de operadores: un PDF con formas anidadas que se repiten puede crecer sin fin; pasado el tope, se deja de mirar.
        if (++R.operadores > 3e6) { R.truncado = true; return; }
        if (op === 'q') pila.push(ctm.slice());
        else if (op === 'Q') { if (pila.length) ctm = pila.pop(); }
        else if (op === 'cm' && a.length >= 6) { const m = a.slice(-6).map(x => x.v); if (m.every(x => typeof x === 'number')) ctm = mult(m, ctm); }
        else if (op === 'rg' || op === 'RG') R.rgbVector++;
        else if (op === 'gs' && a.length && a[a.length - 1].n) {
          const g = H.get(H.get(res, 'ExtGState'), a[a.length - 1].n);
          if (g instanceof L.PDFDict) {
            const ca = H.num(H.get(g, 'ca')), CA = H.num(H.get(g, 'CA')), sm = H.get(g, 'SMask'), bm = H.nom(H.get(g, 'BM'));
            if ((ca < 1) || (CA < 1) || (sm && H.nom(sm) !== 'None') || (bm && bm !== 'Normal' && bm !== 'Compatible')) R.transparencia = true;
          }
        } else if (op === 'BI') {
          const p = {}; for (let k = 0; k + 1 < a.length; k++) if (a[k].n && a[k + 1].v !== undefined) p[a[k].n] = a[k + 1].v;
          const img = { w: p.W || p.Width, h: p.H || p.Height, bit: p.IM === true || p.ImageMask === true || p.BPC === 1 || p.BitsPerComponent === 1 };
          R.imagenes.n++; colocar(img, ctm, pag);
        } else if (op === 'Do' && a.length && a[a.length - 1].n) {
          const XO = H.get(res, 'XObject'), ref = XO instanceof L.PDFDict ? XO.get(H.N(a[a.length - 1].n)) : null, x = H.look(ref);
          if (!x || !x.dict) return;
          const tipo = H.nom(H.get(x.dict, 'Subtype'));
          if (tipo === 'Image') {
            const clave = ref instanceof L.PDFRef ? ref.toString() : null;
            let img = clave && imagenesVistas.get(clave);
            if (!img) {
              img = datosImagen(x.dict);
              R.imagenes.n++;
              if (!img.bit) R.imagenes.color[espacioColor(H, H.get(x.dict, 'ColorSpace'), 0)]++; else R.imagenes.bitmap++;
              if (H.get(x.dict, 'SMask')) R.transparencia = true;
              if (clave) imagenesVistas.set(clave, img);
            }
            colocar(img, ctm, pag);
          } else if (tipo === 'Form') {
            const clave = ref instanceof L.PDFRef ? ref.toString() : '';
            if (clave && formas.has(clave)) return;   // una forma que se llama a sí misma
            if (clave) formas.add(clave);
            const mt = H.items(H.get(x.dict, 'Matrix')).map(H.num), m = mt.length === 6 && mt.every(isFinite) ? mt : [1, 0, 0, 1, 0, 0];
            const g = H.get(x.dict, 'Group'); if (g && H.nom(H.get(g, 'S')) === 'Transparency') R.transparencia = true;
            recorrer(H.bytes(x), H.get(x.dict, 'Resources') || res, mult(m, ctm), pag, prof + 1);
            if (clave) formas.delete(clave);
          }
        }
      });
    }

    const paginas = doc.getPages();
    paginas.forEach((p, i) => {
      const caja = k => { const b = H.get(p.node, k); return b ? (k === 'TrimBox' ? p.getTrimBox() : p.getBleedBox()) : null; };
      const media = p.getMediaBox(), trim = caja('TrimBox'), bleed = caja('BleedBox');
      const giro = ((p.getRotation().angle % 360) + 360) % 360; if (giro) R.girada++;
      let sangrado = null, corte = null, nombre = '', deducido = false;
      if (trim) {
        const B = bleed || p.getCropBox();   // sin BleedBox vale la CropBox (y si tampoco hay, la página entera)
        sangrado = Math.min(trim.x - B.x, trim.y - B.y, B.x + B.width - trim.x - trim.width, B.y + B.height - trim.y - trim.height) / MM;
        corte = [trim.width / MM, trim.height / MM];
        const rc = reconocer(corte[0], corte[1]); nombre = rc ? rc.nombre : '';
      } else {
        const rc = reconocer(media.width / MM, media.height / MM);
        if (rc) { nombre = rc.nombre; if (rc.sangrado) { sangrado = rc.sangrado; corte = [media.width / MM - 2 * rc.sangrado, media.height / MM - 2 * rc.sangrado]; deducido = true; } else { sangrado = 0; corte = [media.width / MM, media.height / MM]; } }
      }
      R.tamanos.push({ media: [r1(media.width / MM), r1(media.height / MM)], corte: corte && corte.map(r1), declarado: !!trim, sangrado: sangrado === null ? null : r1(sangrado), deducido, nombre });
      const an = H.items(H.get(p.node, 'Annots')); R.anotaciones += an.filter(a => !['Link'].includes(H.nom(H.get(a, 'Subtype')))).length;
      if (R.cifrado) return;
      const g = H.get(p.node, 'Group'); if (g && H.nom(H.get(g, 'S')) === 'Transparency') R.transparencia = true;
      const res = p.node.Resources();
      const cont = H.look(p.node.get(H.N('Contents')));
      const partes = cont instanceof L.PDFArray ? H.items(cont) : cont ? [cont] : [];
      const trozos = partes.map(H.bytes).filter(Boolean);
      let total = 0; trozos.forEach(t => { total += t.length + 1; });
      const todo = new Uint8Array(total); let o = 0; trozos.forEach(t => { todo.set(t, o); o += t.length; todo[o++] = 10; });
      recorrer(todo, res, [1, 0, 0, 1, 0, 0], i + 1, 0);
    });
    if (R.imagenes.minPpi === Infinity) R.imagenes.minPpi = null;
    R.chequeos = chequeos(R);
    return R;
  }

  // Semáforo: ok, aviso (puede pasar, conviene mirar) y mal (lo más probable es que la imprenta lo rebote).
  function chequeos(R) {
    const C = [], add = (id, nivel, t, d) => C.push({ id, nivel, t, d });
    if (R.cifrado) add('cifrado', 'mal', 'El PDF está protegido', 'Tiene contraseña o restricciones. La imprenta puede no poder abrirlo ni ripearlo; exportalo de nuevo sin protección. No pude revisar el contenido.');
    const T = R.tamanos, p0 = T[0] || {};
    const distintos = new Set(T.map(t => (t.corte || t.media).join('×'))).size;
    const medida = t => (t.corte || t.media).map(v => String(v).replace('.', ',')).join(' × ') + ' mm';
    add('tamano', distintos > 1 ? 'aviso' : 'ok', distintos > 1 ? 'Hay páginas de distinto tamaño' : 'Tamaño: ' + medida(p0) + (p0.nombre ? ' (' + p0.nombre + ')' : ''),
      distintos > 1 ? 'Encontré ' + distintos + ' tamaños distintos. En un libro, todas las páginas tienen que medir lo mismo al corte.' : (p0.declarado ? 'Es la medida al corte que declara el archivo (TrimBox).' : p0.corte ? 'El archivo no declara la caja de corte: la deduje del tamaño de la página.' : 'El archivo no declara la caja de corte y la medida no coincide con un formato conocido: confirmá el tamaño final con tu imprenta.'));
    const S = T.map(t => t.sangrado).filter(s => s !== null);
    if (!S.length) add('sangrado', 'aviso', 'No pude medir el sangrado', 'El archivo no declara las cajas de corte y sangrado. Si algo llega al borde, revisá en tu programa que tenga 3 mm de más por lado.');
    else if (Math.min(...S) < -0.1) add('sangrado', 'mal', 'La caja de sangrado es más chica que la de corte', 'El archivo declara cajas que no cierran: así, lo que llega al borde puede quedar con filo blanco. Exportá de nuevo con 3 mm de sangrado.');
    else {
      const min = Math.min(...S), deducido = T.some(t => t.deducido);
      if (min >= 2.9) add('sangrado', deducido ? 'aviso' : 'ok', 'Sangrado de ' + String(r1(min)).replace('.', ',') + ' mm', deducido ? 'Parece tener sangrado (la página mide el formato más 3 mm por lado), pero no declara la caja de corte. Avisale a la imprenta el tamaño final.' : 'Alcanza para lo que llega al borde.');
      else if (min > 0.1) add('sangrado', 'mal', 'Sangrado de ' + String(r1(min)).replace('.', ',') + ' mm: poco', 'Lo habitual son 3 mm por lado. Con menos, al refilar puede quedar un filo blanco.');
      else add('sangrado', 'aviso', 'Sin sangrado', 'La página mide exactamente el tamaño final. Si nada llega al borde, está bien; si hay fotos o fondos al corte, faltan 3 mm por lado.');
    }
    const f = R.fuentes.sin;
    if (!R.cifrado) add('fuentes', f.length ? 'mal' : 'ok', f.length ? (f.length === 1 ? 'Una fuente sin incrustar' : f.length + ' fuentes sin incrustar') : (R.fuentes.total ? 'Todas las fuentes están incrustadas' : 'No hay texto con fuentes'),
      f.length ? 'Sin incrustar: ' + f.slice(0, 8).join(', ') + (f.length > 8 ? '…' : '') + '. La imprenta las va a reemplazar y el texto puede correrse. Exportá incrustando las fuentes o pasalas a curvas.' : (R.fuentes.total ? R.fuentes.total + ' fuentes revisadas.' : 'Si el texto está en curvas o en imágenes, no hay nada que incrustar.'));
    const I = R.imagenes;
    if (!R.cifrado && I.n) {
      const b = I.bajas, peor = b.length ? b.reduce((x, y) => (y.ppi / (y.bit ? 600 : 300) < x.ppi / (x.bit ? 600 : 300) ? y : x)) : null;
      const nivel = !b.length ? 'ok' : peor.ppi < (peor.bit ? 300 : 150) ? 'mal' : 'aviso';
      add('resolucion', nivel, !b.length ? 'Resolución suficiente en todas las imágenes' : (b.length === 1 ? 'Una imagen' : b.length + (b.length === 50 ? ' o más' : '') + ' imágenes') + ' con poca resolución',
        !b.length ? 'La de menor resolución tiene ' + I.minPpi + ' ppp al tamaño en que está puesta (' + I.n + (I.n === 1 ? ' imagen revisada).' : ' imágenes revisadas).') : 'La peor: ' + peor.ppi + ' ppp en la página ' + peor.pag + (peor.bit ? ' (dibujo de línea: conviene 600 ppp o más)' : '') + '. Páginas: ' + [...new Set(b.map(x => x.pag))].slice(0, 12).join(', ') + '. Para imprenta, 300 ppp al tamaño impreso; en una fotocopia se nota menos.');
      const c = I.color;
      if (c.RGB) add('color', 'aviso', (c.RGB === 1 ? 'Una imagen' : c.RGB + ' imágenes') + ' en RGB', 'Para offset conviene pasarlas a CMYK (o a grises si el libro va en negro). Algunas imprentas convierten al ripear: preguntá con qué perfil. En digital o en casa, suele andar igual.');
      else add('color', 'ok', 'Imágenes en ' + (c.CMYK ? 'CMYK' : 'grises') + (c.plana ? ' y tintas planas' : ''), (c.CMYK + c.gris + c.plana + I.bitmap) + ' imágenes revisadas.');
    }
    if (!R.cifrado && R.rgbVector) add('vectores', 'aviso', 'Textos o vectores en RGB', 'Hay colores definidos en RGB fuera de las imágenes. Si es texto negro en RGB, puede salir con las cuatro tintas y verse borroso: conviene 100 % K. (Es una señal, no un análisis de color completo.)');
    if (!R.cifrado && R.transparencia) add('transparencia', R.pdfx && /1a|X-3/i.test(R.pdfx) ? 'mal' : 'aviso', 'Tiene transparencias', 'Sombras, opacidades o modos de fusión. Un RIP moderno (PDF/X-4) las procesa; para PDF/X-1a hay que acoplarlas antes.');
    add('pdfx', R.pdfx ? 'ok' : 'aviso', R.pdfx ? 'Declara ' + R.pdfx : 'No declara PDF/X', R.pdfx ? 'Galera no valida la norma completa: la imprenta o Acrobat Pro sí.' : 'Muchas imprentas digitales lo aceptan igual. Si es offset, preguntá si piden PDF/X-1a o X-4.' + (R.pdfa ? ' Es ' + R.pdfa + ', una norma de archivo, no de imprenta.' : ''));
    add('paginas', R.paginas % 4 ? 'aviso' : 'ok', R.paginas + (R.paginas === 1 ? ' página' : ' páginas'), R.paginas % 4 ? 'Para un acaballado hacen falta múltiplos de 4: sobran ' + (4 - R.paginas % 4) + ' en blanco. Para una rústica, preguntá el tamaño del pliego.' : 'Múltiplo de 4: sirve para acaballado.');
    if (R.anotaciones) add('anotaciones', 'aviso', 'Tiene comentarios o campos de formulario', 'Pueden no imprimirse, o imprimirse sin querer. Borralos o aplanalos antes de mandar.');
    if (R.truncado) add('truncado', 'aviso', 'El archivo es muy complejo: no lo revisé entero', 'Tiene demasiados elementos anidados. Lo que no llegué a mirar puede tener imágenes de poca resolución o transparencias.');
    if (R.girada) add('girada', 'aviso', R.girada === 1 ? 'Una página está girada' : R.girada + ' páginas están giradas', 'Tienen rotación en el archivo (pasa con los escaneos). Al imponer, Galera las endereza; igual, revisá que se vean derechas antes de mandarlas a la imprenta.');
    return C;
  }

  // ---------- imposición ----------
  const HOJAS = { a4: [297, 210], carta: [279.4, 215.9] };   // apaisadas, en mm
  // Orden de un acaballado: hoja s (0 = la de afuera), frente [n−1−2s, 2s] y dorso [2s+1, n−2−2s]; null = página en blanco.
  function ordenAcaballado(n) {
    const N = Math.ceil(n / 4) * 4, H = [];
    const pg = i => i < n ? i : null;
    for (let s = 0; s < N / 4; s++) H.push({ hoja: s, frente: [pg(N - 1 - 2 * s), pg(2 * s)], dorso: [pg(2 * s + 1), pg(N - 2 - 2 * s)] });
    return { N, hojas: H, blancas: N - n };
  }
  // Fanzine de una hoja (8 páginas, un corte): fila de arriba girada 180°: 5 4 3 2; fila de abajo: 6 7 8 1 (base 1).
  const FANZINE = [{ p: 4, c: 0, f: 1, g: true }, { p: 3, c: 1, f: 1, g: true }, { p: 2, c: 2, f: 1, g: true }, { p: 1, c: 3, f: 1, g: true },
    { p: 5, c: 0, f: 0 }, { p: 6, c: 1, f: 0 }, { p: 7, c: 2, f: 0 }, { p: 0, c: 3, f: 0 }];

  async function imponer(datos, o) {
    const L = await lib();
    o = Object.assign({ modo: 'acaballado', hoja: 'a4', guias: true, creep: 0 }, o || {});
    const src = await L.PDFDocument.load(datos, { ignoreEncryption: true, updateMetadata: false });
    if (src.isEncrypted) throw new Error('El PDF está protegido: no lo puedo imponer.');
    const pags = src.getPages(), n = pags.length;
    if (!n) throw new Error('El PDF no tiene páginas.');
    if (o.modo === 'fanzine' && n > 8) throw new Error('El fanzine de una hoja lleva 8 páginas y tu PDF tiene ' + n + '. Probá con acaballado.');
    const dst = await L.PDFDocument.create();
    dst.setProducer('Galera · galera.com.ar/antes-de-imprimir/'); dst.setCreator('Galera');
    // Se impone la página al corte (TrimBox) si el archivo la declara; si no, la página entera.
    const cajas = pags.map(p => { const t = p.node.get(L.PDFName.of('TrimBox')) ? p.getTrimBox() : p.getMediaBox(); return { left: t.x, bottom: t.y, right: t.x + t.width, top: t.y + t.height }; });
    // Una página sin contenido (blanca de verdad) no se puede incrustar: queda como hueco.
    const conCont = pags.map(p => !!p.node.get(L.PDFName.of('Contents')));
    const incr = await dst.embedPages(pags.filter((p, i) => conCont[i]), cajas.filter((c, i) => conCont[i]));
    let k = 0; const emb = pags.map((p, i) => conCont[i] ? incr[k++] : null);
    const rot = pags.map(p => ((p.getRotation().angle % 360) + 360) % 360).map(r => [0, 90, 180, 270].includes(r) ? r : 0);
    const i0 = emb.findIndex(Boolean), b0 = i0 < 0 ? { width: pags[0].getWidth(), height: pags[0].getHeight() } : emb[i0];
    const e0 = rot[Math.max(0, i0)] % 180 ? { width: b0.height, height: b0.width } : b0;
    const gris = L.rgb(0.6, 0.6, 0.6);
    const guia = (pg, x1, y1, x2, y2, rayada) => pg.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.4, color: gris, dashArray: rayada ? [3, 3] : undefined });
    // Pone la página i en la celda (x, y, w, h), achicada si no entra, pegada al lado `pegar` ('der', 'izq' o centro) y con giro de 180° si g.
    function poner(pg, i, x, y, w, h, pegar, g, corr) {
      if (i === null || i === undefined || i >= n || !emb[i]) return;
      // /Rotate de la página (escaneos): se endereza sumando el giro al dibujarla. a = giro final, antihorario.
      const e = emb[i], r = rot[i], de = r === 90 || r === 270, ew = de ? e.height : e.width, eh = de ? e.width : e.height;
      const esc = Math.min(1, w / ew, h / eh), pw = ew * esc, ph = eh * esc;
      let px = pegar === 'der' ? x + w - pw : pegar === 'izq' ? x : x + (w - pw) / 2;
      px += corr || 0;
      const py = y + (h - ph) / 2, a = (((g ? 180 : 0) - r) % 360 + 360) % 360;
      const [ox, oy] = { 0: [0, 0], 90: [pw, 0], 180: [pw, ph], 270: [0, ph] }[a];
      pg.drawPage(e, { x: px + ox, y: py + oy, xScale: esc, yScale: esc, rotate: L.degrees(a) });
    }
    let W, Hh, info;
    if (o.modo === 'fanzine') {
      [W, Hh] = (HOJAS[o.hoja] || HOJAS.a4).map(v => v * MM);
      const pg = dst.addPage([W, Hh]), cw = W / 4, ch = Hh / 2;
      for (const c of FANZINE) poner(pg, c.p, c.c * cw, c.f * ch, cw, ch, '', c.g);
      if (o.guias) {
        for (let k = 1; k < 4; k++) guia(pg, k * cw, 0, k * cw, Hh, true);
        guia(pg, 0, ch, cw, ch, true); guia(pg, 3 * cw, ch, W, ch, true);
        pg.drawLine({ start: { x: cw, y: ch }, end: { x: 3 * cw, y: ch }, thickness: 0.8, color: L.rgb(0.35, 0.35, 0.35) });   // el único corte
      }
      info = { hojas: 1, blancas: Math.max(0, 8 - n), caras: 1 };
    } else {
      const ord = ordenAcaballado(n);
      if (o.hoja === 'doble') { W = 2 * e0.width; Hh = e0.height; }
      else [W, Hh] = (HOJAS[o.hoja] || HOJAS.a4).map(v => v * MM);
      const mitad = W / 2, ultima = ord.hojas.length - 1;
      for (const h of ord.hojas) {
        // Desplazamiento (creep): las hojas de adentro se corren hacia el lomo, para que el refile les coma lo mismo que a las de afuera.
        const d = (o.creep || 0) * MM * h.hoja;
        for (const cara of [h.frente, h.dorso]) {
          const pg = dst.addPage([W, Hh]);
          poner(pg, cara[0], 0, 0, mitad, Hh, 'der', false, d);
          poner(pg, cara[1], mitad, 0, mitad, Hh, 'izq', false, -d);
          if (o.guias) { const m = 3 * MM; guia(pg, mitad, 0, mitad, m, false); guia(pg, mitad, Hh - m, mitad, Hh, false); }
        }
      }
      info = { hojas: ord.hojas.length, blancas: ord.blancas, caras: 2, ultima };
    }
    const bytes = await dst.save();
    return Object.assign({ bytes, ancho: r1(W / MM), alto: r1(Hh / MM) }, info);
  }

  return { lib, analizar, chequeos, imponer, ordenAcaballado, reconocer, escanear, FANZINE, HOJAS, MM };
})();
if (typeof module !== 'undefined') module.exports = Imprenta;

// =====================================================================
// PANTALLA «Antes de imprimir»: analizador, «Imponé tu PDF» y checklist (datos/antes-de-imprimir.json).
// El archivo vive solo en memoria (V.imp): no entra en cursada.v1 ni se manda a ningún lado. Lo tildado de la checklist dura la visita.
// =====================================================================
function cargarChecklist() {
  if (!cargarChecklist.va) cargarChecklist.va = (async () => {
    try { D.antes = await json('antes-de-imprimir.json'); } catch (e) { D.antes = { secciones: [], fuentes: {}, error: true }; }
    if (V.tab === 'imprimir') render();
  })();
  return cargarChecklist.va;
}
const impS = () => V.imp || (V.imp = { modo: 'acaballado', hoja: 'a4', guias: true, creep: '0', hechos: {} });
const NIVEL_IMP = { ok: ['gl-chip--ok', 'Bien'], aviso: ['gl-chip--aviso', 'Mirar'], mal: ['gl-chip--mal', 'Arreglar'] };
const pesoArchivo = b => b < 1048576 ? Math.max(1, Math.round(b / 1024)) + ' KB' : String(Math.round(b / 104857.6) / 10).replace('.', ',') + ' MB';
function vImprimir() {
  if (!D.antes) { cargarChecklist(); return '<div class="gl-v"><p class="gl-vacio" role="status">Cargando…</p></div>'; }
  const s = impS(), R = s.res;
  const cab = `<div class="gl-cab"><h2 class="gl-display">Antes de imprimir</h2></div>
    <p class="gl-baja">Revisá tu PDF antes de mandarlo a la imprenta, imponelo para imprimir un fanzine o un acaballado en casa y repasá la lista de lo que suele fallar en el ripeo. Todo pasa en tu navegador: el archivo no se sube a ningún lado.</p>`;
  const subir = `<section class="gl-imp-sec" aria-labelledby="imp-a"><h2 id="imp-a" class="gl-t2">Revisá tu PDF</h2>
    <div class="gl-imp-subir"><label class="gl-btn" for="imp-archivo">${s.nombre ? 'Elegir otro PDF' : 'Elegir un PDF'}</label>
      <input id="imp-archivo" class="u-oculto" type="file" accept="application/pdf,.pdf" onchange="impElegir(this)">
      ${s.nombre ? `<span class="gl-imp-arch"><b>${esc(s.nombre)}</b> · ${pesoArchivo(s.peso)}</span>` : '<span class="gl-tenue">Hasta 200 MB. Mejor si es el PDF final, el mismo que vas a mandar.</span>'}</div>
    <div role="status" aria-live="polite">${s.cargando ? '<p class="gl-baja">Revisando el archivo…</p>' : s.error ? `<p class="gl-imp-error" role="alert">${esc(s.error)}</p>` : ''}</div>
    ${R && !s.cargando ? resultadoImp(R) : ''}</section>`;
  return `<div class="gl-v gl-imp">${cab}${subir}${s.datos && !s.cargando && R && !R.error && !R.cifrado ? imponerImp(s, R) : ''}${checklistImp()}</div>`;
}
function resultadoImp(R) {
  if (R.error) return `<p class="gl-imp-error" role="alert">${esc(R.error)}</p>`;
  const cuenta = k => R.chequeos.filter(c => c.nivel === k).length, mal = cuenta('mal'), av = cuenta('aviso');
  const resumen = mal ? `Hay ${mal === 1 ? 'una cosa' : mal + ' cosas'} para arreglar antes de mandarlo.` : av ? `No encontré nada grave; ${av === 1 ? 'hay una cosa' : 'hay ' + av + ' cosas'} para mirar.` : 'No encontré problemas en lo que puedo medir.';
  return `<p class="gl-imp-resumen"><b>${resumen}</b> Versión de PDF ${esc(R.version)}.</p>
    <ul class="gl-imp-lista">${R.chequeos.map(c => `<li class="gl-imp-ch gl-imp-ch--${c.nivel}"><span class="gl-chip ${NIVEL_IMP[c.nivel][0]}">${NIVEL_IMP[c.nivel][1]}</span><div><b>${esc(c.t)}</b><p class="gl-baja">${esc(c.d)}</p></div></li>`).join('')}</ul>
    <p class="gl-baja gl-tenue">Galera mide tamaño, sangrado, fuentes, resolución, color de las imágenes, transparencias y páginas. No reemplaza el control de la imprenta: el color de textos y vectores, la carga de tinta y la norma PDF/X completa se revisan con Acrobat Pro o en la preprensa.</p>`;
}
function imponerImp(s, R) {
  const fz = s.modo === 'fanzine', n = R.paginas, o = Imprenta.ordenAcaballado(n);
  const opt = (k, v, t) => `<label class="gl-imp-opt"><input type="radio" name="imp-${k}" value="${esc(v)}"${s[k] === v ? ' checked' : ''} onchange="impOpcion(${arg(k)}, this.value)"> ${t}</label>`;
  const nota = fz ? (n > 8 ? `<p class="gl-imp-error" role="alert">El fanzine de una hoja lleva 8 páginas y tu PDF tiene ${n}. Probá con acaballado.</p>` : `<p class="gl-baja">Una sola hoja, de un solo lado${n < 8 ? `; quedan ${8 - n} páginas en blanco` : ''}. La línea más oscura es el único corte.</p>`)
    : `<p class="gl-baja">${o.hojas.length} ${o.hojas.length === 1 ? 'hoja' : 'hojas'} a doble faz${o.blancas ? `, con ${o.blancas} ${o.blancas === 1 ? 'página' : 'páginas'} en blanco al final` : ''}.</p>`;
  return `<section class="gl-imp-sec" aria-labelledby="imp-b"><h2 id="imp-b" class="gl-t2">Imponé tu PDF</h2>
    <p class="gl-baja">Para imprimir en casa o en la fotocopiadora: Galera acomoda las páginas en la hoja en el orden en que quedan al doblarla.</p>
    <fieldset class="gl-imp-campos"><legend>Formato</legend>${opt('modo', 'acaballado', 'Acaballado (hojas dobladas y abrochadas al medio)')}${opt('modo', 'fanzine', 'Fanzine de una hoja (8 páginas, un corte)')}</fieldset>
    <fieldset class="gl-imp-campos"><legend>Hoja</legend>${opt('hoja', 'a4', 'A4')}${opt('hoja', 'carta', 'Carta')}${fz ? '' : opt('hoja', 'doble', 'El doble de la página, sin achicar (para la imprenta)')}</fieldset>
    ${fz ? '' : `<div class="gl-campo gl-imp-creep"><label for="imp-creep">Desplazamiento por hoja (mm)</label><input id="imp-creep" inputmode="decimal" value="${esc(s.creep)}" onchange="impOpcion('creep', this.value)"><span class="gl-tenue">0 si son pocas hojas. Con papel de 80 g y más de 10 hojas, probá 0,1.</span></div>`}
    <label class="gl-imp-opt"><input type="checkbox"${s.guias ? ' checked' : ''} onchange="impOpcion('guias', this.checked ? '1' : '')"> Marcas de plegado y corte</label>
    ${nota}
    <div class="gl-imp-acc"><button class="gl-btn" type="button" onclick="impImponer()"${fz && n > 8 ? ' disabled' : ''}>Bajar el PDF impuesto</button></div>
    ${pasosImp(fz)}</section>`;
}
function pasosImp(fz) {
  const P = fz ? ['Imprimí la hoja de un solo lado, apaisada y al 100 % (sin «ajustar a la página»).', 'Doblala por la mitad a lo largo, con lo impreso hacia afuera, y después en cuatro a lo ancho, para marcar los pliegues.', 'Abrila y doblala a lo ancho por la mitad. Cortá con tijera la línea oscura del centro, desde el pliegue hasta el cruce de los pliegues.', 'Desplegala, doblala a lo largo y empujá los extremos hacia el centro: el corte se abre en rombo y se arma la cruz.', 'Plegala como un librito, con la tapa afuera.']
    : ['Imprimí a doble faz, al 100 % (sin «ajustar a la página») y volteando por el borde corto. Si tu impresora no hace doble faz, imprimí las caras impares del PDF, da vuelta la pila y después las pares.', 'Antes de la tirada, probá con una copia: doblala y fijate que las páginas queden en orden.', 'Apilá las hojas en el orden en que salieron, doblalas juntas por la mitad y abrochá en el pliegue (dos broches, a un cuarto de cada punta).', 'Si querés el borde parejo, refilá el lado abierto con guillotina o cúter y regla.'];
  return `<details class="gl-imp-pasos"><summary>Cómo armarlo</summary><ol>${P.map(p => `<li>${esc(p)}</li>`).join('')}</ol></details>`;
}
function checklistImp() {
  const A = D.antes, s = impS();
  if (!A.secciones.length) return '<p class="gl-vacio" role="alert">No se pudo cargar la lista. <button class="gl-btn gl-btn--sec" type="button" onclick="location.reload()">Probar de nuevo</button></p>';
  const total = A.secciones.reduce((t, x) => t + x.items.length, 0), hechos = Object.keys(s.hechos).length;
  const fuente = f => f === 'practica' ? '<span class="gl-tenue">Práctica habitual: confirmalo con tu imprenta.</span>' : A.fuentes[f] ? `<a class="gl-enlace" href="${esc(A.fuentes[f].url)}">Apunte: ${esc(A.fuentes[f].t)}</a>` : '';
  return `<section class="gl-imp-sec gl-imp-check" aria-labelledby="imp-c"><h2 id="imp-c" class="gl-t2">La lista antes de mandar</h2>
    <p class="gl-baja">Lo que más falla cuando un archivo llega a la imprenta, en orden. Los ítems marcados con «lo reviso arriba» los mide el analizador; el resto depende de vos y de tu imprenta. <span aria-live="polite">${hechos} de ${total} tildados.</span></p>
    ${A.secciones.map(sec => `<h3 class="gl-t3">${esc(sec.t)}</h3><ul class="gl-imp-items">${sec.items.map(it => `<li><label class="gl-imp-item"><input type="checkbox"${s.hechos[it.id] ? ' checked' : ''} onchange="impTildar(${arg(it.id)}, this.checked)"><span><b>${esc(it.t)}</b>${it.auto ? ' <span class="gl-chip gl-chip--neutro">lo reviso arriba</span>' : ''}<span class="gl-imp-d">${esc(it.d)}</span>${fuente(it.f)}</span></label></li>`).join('')}</ul>`).join('')}
    <div class="gl-imp-acc"><button class="gl-btn gl-btn--sec" type="button" onclick="window.print()">Imprimir la lista</button></div>
    <p class="gl-baja gl-tenue">Texto bajo licencia ${esc(A.licencia || 'CC BY-SA 4.0')}: podés copiarlo y adaptarlo citando a Galera. Sale de los apuntes de Fundamentos de la Producción de Impresos.</p></section>`;
}
async function impElegir(input) {
  const f = input.files && input.files[0]; if (!f) return;
  const s = impS();
  if (f.size > 200 * 1048576) { s.error = 'El archivo pesa más de 200 MB: es demasiado para revisarlo en el navegador.'; render(); return; }
  Object.assign(s, { nombre: f.name, peso: f.size, cargando: true, error: '', res: null, datos: null }); render();
  try {
    const datos = new Uint8Array(await f.arrayBuffer());
    s.res = await Imprenta.analizar(datos); s.datos = s.res.error ? null : datos;
    medir('pdf_analizado', { paginas: s.res.paginas || 0, problemas: (s.res.chequeos || []).filter(c => c.nivel === 'mal').length });
  } catch (e) { s.error = /pdf-lib/.test(e.message) ? 'No pude bajar la herramienta de lectura. Puede ser la conexión: probá de nuevo.' : 'No pude leer el archivo: ' + e.message; }
  s.cargando = false; render();
}
function impOpcion(k, v) { const s = impS(); s[k] = k === 'guias' ? !!v : v; if (k === 'modo' && v === 'fanzine' && s.hoja === 'doble') s.hoja = 'a4'; render(); }
function impTildar(id, si) { const s = impS(); if (si) s.hechos[id] = true; else delete s.hechos[id]; const p = document.querySelector('.gl-imp-check [aria-live]'); if (p) p.textContent = Object.keys(s.hechos).length + ' de ' + D.antes.secciones.reduce((t, x) => t + x.items.length, 0) + ' tildados.'; }
async function impImponer() {
  const s = impS(); if (!s.datos) return;
  const creep = Math.max(0, Math.min(2, parseFloat(String(s.creep).replace(',', '.')) || 0));
  try {
    const r = await Imprenta.imponer(s.datos, { modo: s.modo, hoja: s.hoja, guias: s.guias, creep });
    const url = URL.createObjectURL(new Blob([r.bytes], { type: 'application/pdf' })), a = document.createElement('a');
    a.href = url; a.download = (s.nombre || 'archivo.pdf').replace(/\.pdf$/i, '') + '-' + s.modo + '.pdf';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
    aviso('Listo: ' + (r.hojas === 1 ? 'una hoja' : r.hojas + ' hojas') + ' de ' + String(r.ancho).replace('.', ',') + ' × ' + String(r.alto).replace('.', ',') + ' mm');
    medir('pdf_impuesto', { formato: s.modo, hoja: s.hoja });
  } catch (e) { aviso('No se pudo imponer: ' + e.message); }
}
