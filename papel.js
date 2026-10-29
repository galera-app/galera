// Cálculo de papel e imposición (Fundamentos de la Producción de Impresos): las cuentas, sin DOM (se prueban con probar.py).
// Sigue a la cátedra (Galarza / Fernández Chevichuk, "Guía básica para calcular papel"; "Cálculo de pliego y tipográfico"):
// kilos por resma = ancho × alto × gramaje ÷ 20.000 (cm, g/m², resma de 500 hojas); demasía sobre los ejemplares;
// la imposición resta calles, laterales, pinza y cola (valores estimativos: confirmar con la imprenta).
'use strict';
const Papel = (() => {
  const n = Num.parse;   // lector compartido (num.js)
  const E = 1e-9;
  const techo = v => Math.ceil(v - E);

  // Formatos comerciales de pliego de compra (ancho × alto en cm), según la cátedra.
  const FORMATOS = [
    { id: '58x92', t: '58 × 92', a: 58, b: 92 }, { id: '63x88', t: '63 × 88', a: 63, b: 88 }, { id: '65x95', t: '65 × 95', a: 65, b: 95 },
    { id: '72x102', t: '72 × 102', a: 72, b: 102 }, { id: '82x118', t: '82 × 118', a: 82, b: 118 },
    { id: '66x100', t: '66 × 100 (cartulina)', a: 66, b: 100 }, { id: '76x112', t: '76 × 112 (cartulina)', a: 76, b: 112 }, { id: '82x112', t: '82 × 112 (cartulina)', a: 82, b: 112 }
  ];
  const CORTES = { 1: 'Entero', 2: 'Mitad (½)', 4: 'Cuarto (¼)' };

  // Cuántas piezas de w × h entran en un pliego de impresión de a × b. El papel entra por su lado ancho: pinza y cola
  // se descuentan del lado corto y los laterales del lado largo. Se prueban las dos orientaciones de la pieza.
  function entran(a, b, w, h, m) {
    const largo = Math.max(a, b), corto = Math.min(a, b);
    const U = largo - 2 * m.lateral, V = corto - m.pinza - m.cola;
    const cuenta = (p, u) => p > 0 && u >= p - E ? Math.floor((u + m.calle + E) / (p + m.calle)) : 0;
    const A = { nx: cuenta(w, U), ny: cuenta(h, V), w, h }, B = { nx: cuenta(h, U), ny: cuenta(w, V), w: h, h: w };
    const mejor = A.nx * A.ny >= B.nx * B.ny ? A : B;
    return { piezas: mejor.nx * mejor.ny, nx: mejor.nx, ny: mejor.ny, largo, corto, U, V, pw: mejor.w, ph: mejor.h, rotada: mejor === B };
  }
  // La mayor potencia de 2 que no pasa de x (los plegados sucesivos dan 1, 2, 4, 8, 16… dobles páginas por cara).
  const potencia = x => { let p = 1; while (p * 2 <= x) p *= 2; return x >= 1 ? p : 0; };

  function normalizarMargenes(d) {
    const g = (k, def) => d[k] === '' || d[k] == null ? def : Math.max(0, n(d[k]));
    return { calle: g('calle', 1), lateral: g('lateral', 1), pinza: g('pinza', 3), cola: g('cola', 2) };
  }

  // Un pliego de compra a × b, con el corte elegido (1, 2 o 4 partes iguales por el lado largo). Devuelve el pliego de impresión
  // y cuántas piezas entran. pieza = { w, h, soloPotencia }: soloPotencia en interiores, porque el pliego se pliega.
  function imponer(a, b, cortes, pieza, m) {
    const largo = Math.max(a, b), corto = Math.min(a, b);
    // Mitad: se corta el lado largo en dos (65 × 95 → 65 × 47,5). Cuarto: dos cortes (la mitad de la mitad, por el otro lado).
    const imp = cortes === 1 ? [corto, largo] : cortes === 2 ? [corto, largo / 2] : [corto / 2, largo / 2];
    const r = entran(imp[0], imp[1], pieza.w, pieza.h, m);
    const util = pieza.soloPotencia ? potencia(r.piezas) : r.piezas;
    return Object.assign(r, { impresion: { a: imp[0], b: imp[1] }, encajan: r.piezas, usadas: util,
      aprovecha: util * pieza.w * pieza.h / (imp[0] * imp[1]) });
  }

  // d: datos del trabajo. d.tipo = 'interior' | 'tapa'.
  function calcular(d) {
    const tipo = d.tipo === 'tapa' ? 'tapa' : 'interior';
    const ancho = n(d.ancho), alto = n(d.alto), tirada = n(d.tirada), dem = n(d.demasia);
    const gramaje = n(d.gramaje), precioKg = n(d.precioKg), hojasPaq = n(d.hojasPaquete) || 500;
    const cortes = [1, 2, 4].indexOf(n(d.cortes)) >= 0 ? n(d.cortes) : 1;
    const m = normalizarMargenes(d);
    const out = { tipo, ancho, alto, tirada, dem, gramaje, precioKg, hojasPaq, cortes, m, errores: [] };

    // La pieza a imponer: interiores → doble página (las dos páginas enfrentadas, sin calle entre sí); tapa → tapa abierta.
    let pieza, paginas = 0, finales = 0, blancas = 0, solapa = 0, lomo = 0;
    if (tipo === 'interior') {
      paginas = n(d.paginas);
      if (!ancho || !alto || !paginas) return Object.assign(out, { incompleto: true });
      pieza = { w: 2 * ancho, h: alto, soloPotencia: true };
      finales = Math.ceil(paginas / 8 - E) * 8; blancas = finales - paginas;   // múltiplo de 8 como mínimo
    } else {
      solapa = n(d.solapa); lomo = n(d.lomo);
      if (!ancho || !alto) return Object.assign(out, { incompleto: true });
      pieza = { w: 2 * solapa + 2 * ancho + lomo, h: alto, soloPotencia: false };
    }
    out.pieza = pieza; out.paginas = paginas; out.finales = finales; out.blancas = blancas;

    const formato = FORMATOS.find(f => f.id === d.formato);
    const a = formato ? formato.a : n(d.fa), b = formato ? formato.b : n(d.fb);
    if (!a || !b || !gramaje || !tirada) return Object.assign(out, { incompleto: true });
    out.compra = { a: Math.min(a, b), b: Math.max(a, b) };
    return Object.assign(out, cuentas(out, d, a, b));
  }

  // Las cuentas completas para un formato dado (se reusa en la tabla de comparación).
  function cuentas(o, d, a, b) {
    const imp = imponer(a, b, o.cortes, o.pieza, o.m);
    const r = { imp };
    let porImpresion;                                  // páginas (interior) o tapas (tapa) por pliego de impresión
    if (o.tipo === 'interior') {
      porImpresion = n(d.forzar) > 0 ? n(d.forzar) : imp.usadas * 4;   // 2 caras × 2 páginas por doble página
      r.porCara = porImpresion / 2;
      r.dobles = imp.usadas;
    } else {
      porImpresion = imp.usadas; r.porCara = porImpresion;
    }
    r.porImpresion = porImpresion;
    if (porImpresion <= 0) { r.noEntra = true; return r; }
    r.porCompra = porImpresion * o.cortes;
    r.sobra = o.tipo === 'interior' && !(n(d.forzar) > 0) ? imp.encajan - imp.usadas : 0;
    r.desperdicio = 1 - imp.aprovecha;
    const ejemplares = techo(o.tirada * (1 + o.dem / 100));
    r.ejemplares = ejemplares;
    let impresiones;
    if (o.tipo === 'interior') {
      r.pliegosLibro = o.finales / porImpresion;       // pliegos de impresión por libro (regla de tres de la cátedra)
      r.cuadernillos = cuadernillos(o.finales, porImpresion);
      impresiones = ejemplares * r.pliegosLibro;
    } else impresiones = ejemplares / porImpresion;
    r.impresiones = impresiones;
    r.pliegos = techo(impresiones / o.cortes);         // pliegos de compra
    r.paquetes = techo(r.pliegos / o.hojasPaq);
    r.hojas = r.paquetes * o.hojasPaq;
    r.kgResma = a * b * o.gramaje / 20000;             // kilos por resma de 500 hojas
    r.kgHoja = r.kgResma / 500;
    r.kg = r.hojas * r.kgHoja;
    r.precioHoja = r.kgHoja * o.precioKg;
    r.precioResma = r.kgResma * o.precioKg;
    r.costo = r.kg * o.precioKg;
    r.costoEjemplar = o.tirada ? r.costo / o.tirada : 0;
    r.resmas = r.hojas / 500;
    return r;
  }

  // Cuadernillos de un libro de `paginas` páginas con pliegos de `porPliego`: los pliegos enteros y, si no cierra, los más chicos
  // que completan (la mitad, el cuarto…), nunca menos de 8 páginas.
  function cuadernillos(paginas, porPliego) {
    const L = []; let resto = paginas, t = porPliego;
    while (t >= 8 && resto > 0) { const k = Math.floor(resto / t + E); if (k > 0) { L.push({ paginas: t, cantidad: k }); resto -= k * t; } t /= 2; }
    return { lista: L, resto };
  }

  // La misma cuenta con cada formato de pliego de compra, del más barato al más caro.
  function comparar(d) {
    const base = calcular(d);
    if (base.incompleto) return [];
    const filas = FORMATOS.map(f => {
      const r = cuentas(base, d, f.a, f.b);
      return { id: f.id, t: f.t, a: f.a, b: f.b, noEntra: !!r.noEntra, porCompra: r.porCompra, porImpresion: r.porImpresion, kgResma: r.kgResma,
        pliegos: r.pliegos, kg: r.kg, costo: r.costo, desperdicio: r.desperdicio, impresion: r.imp.impresion };
    });
    const ok = filas.filter(x => !x.noEntra).sort((x, y) => x.costo - y.costo);
    if (ok.length) { ok[0].mejor = true; ok.forEach(x => { x.difPct = ok[0].costo ? (x.costo / ok[0].costo - 1) : 0; }); }
    return ok.concat(filas.filter(x => x.noEntra));
  }

  // Lomo aproximado de la tripa: hojas (páginas ÷ 2) × espesor de una hoja (micrones). Devuelve cm.
  const lomo = (paginas, micrones) => n(paginas) / 2 * n(micrones) / 10000;

  // El ejemplo de la cátedra (U2-3): 13 × 20 cm, 320 páginas, 5.000 ejemplares, bookcel 80 g, $1.500/kg, pliego 58 × 92 → 32 páginas
  // por pliego, 10 pliegos por libro, 110 resmas, 21,344 kg por resma, 2.347,84 kg y $3.521.760.
  const EJEMPLO = { tipo: 'interior', ancho: '13', alto: '20', paginas: '320', solapa: '7', lomo: '1', tirada: '5000', demasia: '10', gramaje: '80', precioKg: '1500',
    formato: '58x92', fa: '', fb: '', cortes: '1', hojasPaquete: '500', calle: '1', lateral: '1', pinza: '3', cola: '2', forzar: '', espesor: '' };
  // El ejemplo de tapas de la cátedra (U2-3): 14 × 20, lomo 1, solapas de 7, 3.000 ejemplares, ilustración 300 g a $2.800, pliego 65 × 95
  // cortado a la mitad: 6 tapas por pliego de compra, paquetes de 250 → 3 paquetes y $389.025.
  const EJEMPLO_TAPA = Object.assign({}, EJEMPLO, { tipo: 'tapa', ancho: '14', alto: '20', paginas: '', tirada: '3000', gramaje: '300', precioKg: '2800',
    formato: '65x95', cortes: '2', hojasPaquete: '250', pinza: '2', cola: '1.5' });

  return { calcular, comparar, imponer, entran, potencia, lomo, cuadernillos, FORMATOS, CORTES, EJEMPLO, EJEMPLO_TAPA, n };
})();
if (typeof module !== 'undefined') module.exports = Papel;
