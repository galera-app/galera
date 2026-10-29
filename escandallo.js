// Escandallo: las cuentas del simulador, sin DOM (se prueban con probar.py).
// Sigue a la cátedra de Administración de la Empresa Editorial (FFyL, UBA): invendibles sobre el CPU,
// derechos de autor sobre el PVP y el resto de los gastos comerciales sobre el INU.
'use strict';
const Escandallo = (() => {
  const n = Num.parse;   // lector compartido (num.js)
  const pct = v => n(v) / 100;

  // Costo de impresión por demanda de un ejemplar: interior en pliegos A3 + tapa + encuadernado.
  function porDemanda(d) {
    const paginas = n(d.paginas), porPliego = n(d.porPliego) || 8, tapasPorPliego = n(d.tapasPorPliego) || 1;
    const pliegos = paginas / porPliego;
    const interior = pliegos * n(d.precioPliego), tapa = n(d.precioTapa) / tapasPorPliego, encuadernado = n(d.encuadernado);
    return { pliegos, interior, tapa, encuadernado, unitario: interior + tapa + encuadernado };
  }

  // Descuento comercial y plazo de cobro promedio ponderados por la participación de cada canal.
  function canales(L) {
    const filas = (L || []).map(c => ({ t: c.t || '', desc: n(c.desc), part: n(c.part), plazo: n(c.plazo) }))
      .map(c => Object.assign(c, { descPond: c.desc * c.part / 100, plazoPond: c.plazo * c.part / 100 }));
    const part = filas.reduce((s, c) => s + c.part, 0);
    return { filas, part, desc: filas.reduce((s, c) => s + c.descPond, 0), plazo: filas.reduce((s, c) => s + c.plazoPond, 0) };
  }

  function calcular(d) {
    const tirada = n(d.tirada), pvp = n(d.pvp);
    // Costo producto: el CPU directo, o el CPT (preproducción + industrial) dividido por la tirada.
    let pre = n(d.preproduccion), ind = 0, dem = null;
    if (d.modo === 'cpu') { pre = 0; ind = n(d.cpu) * tirada; }
    else if (d.modo === 'demanda') { dem = porDemanda(d); ind = dem.unitario * tirada; }
    else ind = n(d.industrial);
    const cpt = d.modo === 'cpu' ? n(d.cpu) * tirada : pre + ind;
    const cpu = d.modo === 'cpu' ? n(d.cpu) : tirada ? cpt / tirada : 0;

    const ch = d.usarCanales ? canales(d.canales) : null;
    const descPct = ch ? ch.desc : n(d.descuento);
    const descuento = pvp * descPct / 100, inu = pvp - descuento;

    const g = {
      invendibles: cpu * pct(d.invendibles),
      derechos: pvp * pct(d.derechos),
      incobrables: inu * pct(d.incobrables),
      comisiones: inu * pct(d.comisiones),
      flete: inu * pct(d.flete),
      publicidad: inu * pct(d.publicidad)
    };
    const gastos = Object.values(g).reduce((s, x) => s + x, 0);
    const cdu = cpu + gastos, mcu = inu - cdu, mcuPct = inu ? mcu / inu : 0;
    const cdt = cdu * tirada, ce = n(d.ce), cgt = cdt + ce;
    const pe = {
      estructura: mcu > 0 ? ce / mcu : null,          // ejemplares para que el MCU pague el CE
      edicion: inu > 0 ? cdt / inu : null,            // ejemplares para recuperar lo que costó la edición
      absorcion: inu > 0 ? (ce + cdt) / inu : null    // ejemplares para cubrir todo
    };
    return { tirada, pvp, pre, ind, cpt, cpu, dem, canales: ch, descPct, descuento, inu, gastos: g, totalGastos: gastos,
      cdu, cdt, ce, cgt, mcu, mcuPct, marginal: cdu, pe };
  }

  // El ejemplo de la clase 2 (Ejercicio 3): PVP $18.000, 40 %, tirada 2.000, CPU $2.100 → MCU $6.299,40 y MCU% 0,5833.
  const EJEMPLO = { modo: 'cpu', pvp: '18000', tirada: '2000', cpu: '2100', descuento: '40', usarCanales: false,
    canales: [{ t: 'Librerías', desc: '40', part: '60', plazo: '60' }, { t: 'Supermercados', desc: '50', part: '30', plazo: '90' }, { t: 'Kioscos', desc: '60', part: '10', plazo: '30' }],
    invendibles: '4,6', derechos: '5', flete: '3', comisiones: '2', publicidad: '6', incobrables: '2', ce: '',
    preproduccion: '', industrial: '', paginas: '200', porPliego: '8', precioPliego: '100', tapasPorPliego: '2', precioTapa: '400', encuadernado: '300' };

  // ---------- Comparador de títulos (Maradei 2013, cap. 5 y 4) ----------
  // Cada título trae INU (o PVP y descuento), CDU y Q (ventas estimadas). Se calculan MCU, MCT y MCT% por título, y
  // se clasifica cada uno según esté por encima o por debajo del promedio de MCT (A / C) y del MCT% promedio (B / D).
  const ACCIONES = {
    AB: { cuadrante: 'AB', accion: 'Dejarlo como está', tono: 'ok',
      texto: 'Se vende solo: deja más dinero que el promedio y con buena rentabilidad. No requiere esfuerzo extra: ocupate de los otros.' },
    AD: { cuadrante: 'AD', accion: 'Bajar costos o subir el precio', tono: 'ojo',
      texto: 'Vende bien pero rinde poco por cada peso que entra. Hay que mejorar el MCT%: bajar el CDU (presupuestos, papel, canales) o subir el PVP.' },
    CB: { cuadrante: 'CB', accion: 'Subir el marketing y las ventas', tono: 'ojo',
      texto: 'Es rentable pero se vende poco. Falta empuje: más difusión, más presencia en librerías, ofertas.' },
    CD: { cuadrante: 'CD', accion: 'Discontinuarlo', tono: 'mal',
      texto: 'Se vende poco y además rinde menos que el promedio. Es el candidato a dejar de editar.' }
  };

  // Un título: { t, pvp, desc, inu, cdu, q }. El INU tipeado manda; si no, sale del PVP y el descuento.
  function titulo(x) {
    const pvp = n(x.pvp), inu = n(x.inu) > 0 ? n(x.inu) : pvp * (1 - n(x.desc) / 100), cdu = n(x.cdu), q = n(x.q);
    return { t: String(x.t || '').trim(), pvp, inu, cdu, q, mcu: inu - cdu, mcuPct: inu ? (inu - cdu) / inu : 0,
      int: inu * q, mct: (inu - cdu) * q, cdt: cdu * q };
  }

  // o = { ce, ganancia }: estructura que deben cubrir entre todos los títulos y ganancia buscada (para el punto de equilibrio).
  function comparar(L, o) {
    o = o || {};
    const T = (L || []).map(titulo).filter(x => x.t || x.inu || x.cdu || x.q);
    T.forEach((x, i) => { if (!x.t) x.t = 'Título ' + (i + 1); });
    const ing = T.reduce((s, x) => s + x.int, 0), mcg = T.reduce((s, x) => s + x.mct, 0), cdt = T.reduce((s, x) => s + x.cdt, 0);
    const qTot = T.reduce((s, x) => s + x.q, 0);
    const mctP = T.length ? mcg / T.length : 0, mctPctP = ing ? mcg / ing : 0;   // MCTp y MCT%p
    T.forEach(x => {
      x.partIng = ing ? x.int / ing : 0;
      x.partMcg = mcg ? x.mct / mcg : 0;
      x.mctPct = x.int ? x.mct / x.int : 0;
      x.alto = x.mct >= mctP - 1e-9;                  // A: MCT igual o superior al promedio
      x.rentable = x.mctPct >= mctPctP - 1e-9;        // B: MCT% igual o superior al promedio
      Object.assign(x, ACCIONES[(x.alto ? 'A' : 'C') + (x.rentable ? 'B' : 'D')]);
    });
    const ce = n(o.ce), gan = n(o.ganancia);
    // Punto de equilibrio para varios títulos, suponiendo que se mantiene la mezcla de ventas estimada.
    let pe = null;
    if (T.length && ing > 0 && qTot > 0) {
      const reparto = (dinero) => { const f = dinero / ing; return { dinero, factor: f, libros: qTot * f,
        porTitulo: T.map(x => ({ t: x.t, dinero: x.int * f, libros: x.q * f })) }; };
      const queda = (nec) => mctPctP > 0 ? nec / mctPctP : null;                // $ de ingreso neto: (CE + ganancia) ÷ MCT%p
      const necesario = ce + gan, dinero = queda(necesario);
      pe = { mcuPromedio: mcg / qTot, inuPromedio: ing / qTot, cdt, necesario,
        costeoDirecto: dinero == null ? null : reparto(dinero),
        edicion: reparto(cdt),                                                   // solo recuperar lo que costó la edición
        absorcion: reparto(ce + cdt + gan),                                      // CE + CDT + ganancia, con la tirada ya impresa
        distribucion: { ing, cdt, ce, resultado: mcg - ce } };                   // con las ventas estimadas: ING = CDT + CE + resultado
    }
    return { titulos: T, ing, mcg, cdt, qTot, mctP, mctPctP, pe };
  }

  // El ejemplo del libro (cap. 5): siete títulos. Resultado: AB: R · AD: Q, S · CB: N, O · CD: M, P.
  const EJEMPLO_COMPARADOR = { ce: '', ganancia: '', titulos: [
    { t: 'M', pvp: '', desc: '', inu: '10', cdu: '8', q: '1000' }, { t: 'N', pvp: '', desc: '', inu: '8', cdu: '4', q: '500' },
    { t: 'O', pvp: '', desc: '', inu: '5', cdu: '2', q: '1600' }, { t: 'P', pvp: '', desc: '', inu: '1000', cdu: '900', q: '10' },
    { t: 'Q', pvp: '', desc: '', inu: '50', cdu: '45', q: '1500' }, { t: 'R', pvp: '', desc: '', inu: '25', cdu: '5', q: '500' },
    { t: 'S', pvp: '', desc: '', inu: '50', cdu: '40', q: '700' }] };

  return { calcular, canales, porDemanda, comparar, ACCIONES, EJEMPLO, EJEMPLO_COMPARADOR, n };
})();
if (typeof module !== 'undefined') module.exports = Escandallo;
