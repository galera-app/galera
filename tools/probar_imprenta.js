// Prueba de imprenta.js (analizador y imposición) con PDF armados acá mismo. Uso: node tools/probar_imprenta.js
// Sale con 1 si algo falla. No necesita red: usa vendor/pdf-lib.min.js.
'use strict';
const path = require('path');
global.PDFLib = require(path.join(__dirname, '..', 'vendor', 'pdf-lib.min.js'));
const Imprenta = require(path.join(__dirname, '..', 'imprenta.js'));
const L = global.PDFLib, MM = 72 / 25.4;
let fallas = 0;
const ok = (c, t) => { if (!c) { fallas++; console.error('FALLA: ' + t); } else console.log('ok   ' + t); };
const nivel = (R, id) => (R.chequeos.find(c => c.id === id) || {}).nivel;

// PNG de 8 × 8 px, rojo (RGB).
function png8() {
  const zlib = require('zlib');
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = b => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(8, 0); ih.writeUInt32BE(8, 4); ih[8] = 8; ih[9] = 2;
  const filas = []; for (let y = 0; y < 8; y++) filas.push(Buffer.from([0, ...Array(8).fill([255, 0, 0]).flat()]));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(Buffer.concat(filas))), chunk('IEND', Buffer.alloc(0))]);
}

(async () => {
  // 1. A5 con 3 mm de sangrado declarado, fuente estándar (sin incrustar) y una imagen RGB de 8 px a 40 mm (≈ 5 ppp).
  {
    const d = await L.PDFDocument.create(), f = await d.embedFont(L.StandardFonts.Helvetica), img = await d.embedPng(png8());
    for (let i = 0; i < 6; i++) {
      const p = d.addPage([(148 + 6) * MM, (210 + 6) * MM]);
      p.setTrimBox(3 * MM, 3 * MM, 148 * MM, 210 * MM); p.setBleedBox(0, 0, (148 + 6) * MM, (210 + 6) * MM);
      p.drawText('Página ' + (i + 1), { x: 20 * MM, y: 180 * MM, size: 12, font: f });
      if (i === 2) p.drawImage(img, { x: 30 * MM, y: 30 * MM, width: 40 * MM, height: 40 * MM });
    }
    const R = await Imprenta.analizar(await d.save());
    ok(R.paginas === 6, 'cuenta 6 páginas');
    ok(R.tamanos[0].declarado && R.tamanos[0].nombre === 'A5', 'reconoce A5 por la TrimBox');
    ok(R.tamanos[0].sangrado === 3 && nivel(R, 'sangrado') === 'ok', 'mide 3 mm de sangrado');
    ok(nivel(R, 'fuentes') === 'mal' && R.fuentes.sin.includes('Helvetica'), 'Helvetica sin incrustar');
    ok(R.imagenes.n === 1 && R.imagenes.bajas.length === 1 && R.imagenes.bajas[0].pag === 3, 'una imagen de baja resolución en la página 3');
    ok(Math.abs(R.imagenes.minPpi - 5) <= 1 && nivel(R, 'resolucion') === 'mal', 'resolución ≈ 5 ppp, marcada para arreglar');
    ok(R.imagenes.color.RGB === 1 && nivel(R, 'color') === 'aviso', 'imagen en RGB, aviso');
    ok(nivel(R, 'paginas') === 'aviso', '6 páginas no es múltiplo de 4');
    ok(nivel(R, 'pdfx') === 'aviso', 'no declara PDF/X');
  }
  // 2. A4 justo, sin cajas: se lee «sin sangrado»; carta con 3 mm de más se deduce.
  {
    const d = await L.PDFDocument.create(); d.addPage([210 * MM, 297 * MM]); d.addPage([210 * MM, 297 * MM]); d.addPage([210 * MM, 297 * MM]); d.addPage([210 * MM, 297 * MM]);
    const R = await Imprenta.analizar(await d.save());
    ok(R.tamanos[0].nombre === 'A4' && nivel(R, 'sangrado') === 'aviso' && nivel(R, 'paginas') === 'ok', 'A4 sin sangrado, 4 páginas');
    const d2 = await L.PDFDocument.create(); d2.addPage([(215.9 + 6) * MM, (279.4 + 6) * MM]);
    const R2 = await Imprenta.analizar(await d2.save());
    ok(R2.tamanos[0].nombre === 'Carta' && R2.tamanos[0].sangrado === 3 && R2.tamanos[0].deducido && nivel(R2, 'sangrado') === 'aviso', 'carta + 3 mm: sangrado deducido');
  }
  // 3. Un archivo que no es PDF.
  {
    const R = await Imprenta.analizar(new TextEncoder().encode('hola, esto no es un PDF'));
    ok(!!R.error, 'rechaza lo que no es PDF');
  }
  // 4. Orden del acaballado.
  {
    const o = Imprenta.ordenAcaballado(8);
    ok(JSON.stringify(o.hojas.map(h => [h.frente, h.dorso])) === '[[[7,0],[1,6]],[[5,2],[3,4]]]', 'orden de 8 páginas en 2 hojas');
    const o2 = Imprenta.ordenAcaballado(10);
    ok(o2.N === 12 && o2.blancas === 2 && o2.hojas[0].frente[0] === null && o2.hojas[0].frente[1] === 0, '10 páginas: 2 blancas al final, la contratapa queda en blanco');
  }
  // 5. Imponer: 10 páginas A5 en acaballado A4 y 8 en fanzine; el resultado se vuelve a leer.
  {
    const d = await L.PDFDocument.create(), f = await d.embedFont(L.StandardFonts.Helvetica);
    for (let i = 0; i < 10; i++) { const p = d.addPage([148 * MM, 210 * MM]); p.drawText(String(i + 1), { x: 60 * MM, y: 100 * MM, size: 40, font: f }); }
    const b = await d.save();
    const r = await Imprenta.imponer(b, { modo: 'acaballado', hoja: 'a4' });
    const R = await Imprenta.analizar(r.bytes);
    ok(r.hojas === 3 && r.blancas === 2 && R.paginas === 6, 'acaballado: 3 hojas, 6 caras');
    ok(R.tamanos[0].nombre === 'A4' && Math.round(R.tamanos[0].media[0]) === 297, 'hoja A4 apaisada');
    const rd = await Imprenta.imponer(b, { modo: 'acaballado', hoja: 'doble', creep: 0.1 });
    ok(Math.round(rd.ancho) === 296 && Math.round(rd.alto) === 210, 'hoja «doble»: 2 × 148 por 210');
    const d8 = await L.PDFDocument.create(); for (let i = 0; i < 8; i++) d8.addPage([105 * MM, 148 * MM]);
    const rf = await Imprenta.imponer(await d8.save(), { modo: 'fanzine', hoja: 'a4' });
    ok(rf.hojas === 1 && (await Imprenta.analizar(rf.bytes)).paginas === 1, 'fanzine: una hoja');
    let tiro = false; try { await Imprenta.imponer(b, { modo: 'fanzine' }); } catch (e) { tiro = /8 páginas/.test(e.message); }
    ok(tiro, 'fanzine con 10 páginas: avisa que lleva 8');
    // Páginas con /Rotate 90 (escaneos): se imponen sin error y el analizador las marca.
    const dr = await L.PDFDocument.create();
    for (let i = 0; i < 8; i++) { const p = dr.addPage([148 * MM, 105 * MM]); p.setRotation(L.degrees(90)); p.drawText(String(i + 1), { x: 60 * MM, y: 40 * MM, size: 40, font: await dr.embedFont(L.StandardFonts.Helvetica) }); }
    const br = await dr.save(), Rr = await Imprenta.analizar(br);
    ok(Rr.girada === 8 && nivel(Rr, 'girada') === 'aviso', 'marca las 8 páginas giradas');
    const rr = await Imprenta.imponer(br, { modo: 'fanzine', hoja: 'a4' });
    if (process.env.IMP_SALIDA) require('fs').writeFileSync(process.env.IMP_SALIDA, rr.bytes);
    ok(rr.hojas === 1, 'fanzine con páginas giradas: sin error');
  }
  // 7. BleedBox más chica que la TrimBox: se marca para arreglar.
  {
    const d = await L.PDFDocument.create(), p = d.addPage([160 * MM, 220 * MM]);
    p.setTrimBox(5 * MM, 5 * MM, 150 * MM, 210 * MM); p.setBleedBox(6 * MM, 6 * MM, 148 * MM, 208 * MM);
    ok(nivel(await Imprenta.analizar(await d.save()), 'sangrado') === 'mal', 'caja de sangrado más chica que la de corte');
  }
  // 6. El lector de contenido salta imágenes en línea y cadenas con paréntesis.
  {
    const ops = []; Imprenta.escanear(new TextEncoder().encode('q 100 0 0 50 10 10 cm BI /W 20 /H 10 /BPC 8 /CS /G ID \x01E\x02 EI Q (a (b) c) Tj 1 0 0 rg'), (op, a) => ops.push(op));
    ok(ops.join(' ') === 'q cm BI Q Tj rg', 'escanea q, cm, imagen en línea, Q, Tj y rg');
  }
  console.log(fallas ? fallas + ' fallas' : 'todo bien');
  process.exitCode = fallas ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
