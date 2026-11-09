// Pruebas de las cuentas de lomo.js (sin navegador): node tools/probar_lomo.js
'use strict';
const path = require('path');
const Lomo = require(path.join(__dirname, '..', 'lomo.js'));
let fallas = 0;
const ok = (c, t) => { console.log((c ? 'ok   ' : 'MAL  ') + t); if (!c) fallas++; };
const cerca = (a, b, e = 1e-6) => Math.abs(a - b) < e;

(async () => {
  // Ejercicio 8 de los apuntes (C_Calculos): 384 páginas, 90 µm por hoja → 17,28 mm.
  let R = Lomo.calcular({ paginas: '384', papel: 'catedra' });
  ok(R.hojas === 192 && cerca(R.lomo, 17.28), 'ejercicio de la cátedra: 384 págs. × 90 µm = 17,28 mm');
  ok(cerca(R.abierta.w, 2 * 148 + 17.28) && R.abierta.h === 210, 'rústica A5: tapa abierta = 2 × 148 + lomo');
  ok(cerca(R.total.w, R.abierta.w + 6) && cerca(R.total.h, 216), 'suma 3 mm de sangrado por lado');

  R = Lomo.calcular({ paginas: '200', papel: 'otro', modo: 'mano', gramaje: '70', mano: '1,35' });
  ok(cerca(R.um, 94.5) && cerca(R.lomo, 100 * 0.0945), 'gramaje × mano: 70 g × 1,35 = 94,5 µm');

  R = Lomo.calcular({ paginas: '160', papel: 'otro', modo: 'um', um: '100', guardas: '4', enc: 'solapas', solapa: '80' });
  ok(R.hojas === 84 && cerca(R.lomo, 8.4), 'guardas suman hojas');
  ok(cerca(R.abierta.w, 160 + 296 + 8.4), 'con solapas: 2 × 80 + 2 × 148 + lomo');
  ok(Lomo.paneles(R).map(p => p.id).join() === 'solapa-c,contratapa,lomo,tapa,solapa-t', 'paneles en orden: solapa, contratapa, lomo, tapa, solapa');

  R = Lomo.calcular({ paginas: '384', papel: 'catedra', enc: 'carton', carton: '2', ajuste: '0,5' });
  ok(cerca(R.lomo, 17.28 + 2 + 0.5), 'cartoné: suma cartón y ajuste');
  ok(R.avisos.some(a => a.n === 'info'), 'cartoné: avisa que la imprenta da el esquema');

  R = Lomo.calcular({ paginas: '30', papel: 'catedra', enc: 'acaballado' });
  ok(R.lomo === 0 && cerca(R.abierta.w, 296), 'acaballado: sin lomo');
  ok(R.avisos.some(a => /múltiplos de 4: sumá 2/.test(a.t)), 'acaballado: pide múltiplo de 4');
  R = Lomo.calcular({ paginas: '64', papel: 'catedra', enc: 'acaballado' });
  ok(R.avisos.some(a => /32 hojas/.test(a.t)), 'acaballado grueso: avisa');

  R = Lomo.calcular({ paginas: '48', papel: 'catedra' });
  ok(R.lomo < 5 && R.avisos.some(a => /menos de 5 mm/.test(a.t)), 'lomo fino: avisa');
  R = Lomo.calcular({ paginas: '', papel: 'catedra' });
  ok(!R.ok && R.avisos.some(a => a.n === 'mal'), 'sin páginas: no calcula');

  R = Lomo.calcular({ paginas: '384', papel: 'catedra', enc: 'solapas' });
  const s = Lomo.svg(R, 'archivo');
  ok(/width="\d+(\.\d+)?mm"/.test(s) && (s.match(/lm-pliegue/g) || []).length === 5 && /Lomo · 17,3 mm/.test(s), 'SVG: en mm, cuatro pliegues y el lomo rotulado');

  // PDF con pdf-lib: tamaño, cajas declaradas.
  const PDFLib = require(path.join(__dirname, '..', 'vendor', 'pdf-lib.min.js'));
  const bytes = await Lomo.pdf(R, PDFLib);
  const d = await PDFLib.PDFDocument.load(bytes), p = d.getPage(0), MM = 72 / 25.4;
  const t = p.getTrimBox(), b = p.getBleedBox(), m = p.getMediaBox();
  ok(cerca(m.width, R.total.w * MM, 0.01) && cerca(m.height, R.total.h * MM, 0.01), 'PDF: la página mide tapa abierta + sangrado');
  ok(cerca(t.x, 3 * MM, 0.01) && cerca(t.width, R.abierta.w * MM, 0.01) && cerca(b.width, m.width, 0.01), 'PDF: TrimBox y BleedBox declaradas');
  if (process.env.LOMO_SALIDA) require('fs').writeFileSync(process.env.LOMO_SALIDA, bytes);

  console.log(fallas ? fallas + ' FALLAS' : 'todo bien');
  process.exit(fallas ? 1 : 0);
})();
