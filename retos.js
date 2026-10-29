// Retos opcionales de los simuladores: situaciones con una condición que el propio simulador verifica (hay varias soluciones válidas).
// Sin DOM: lo usa app.js y lo prueba probar.py. Cada reto: prep() devuelve el estado del simulador a cargar; ok(estado) dice si está resuelto;
// ahora(estado) cuenta dónde está la persona (texto corto, sin juicio).
const Retos = (() => {
  const fmtN = x => String(Math.round(x * 100) / 100).replace('.', ',');
  const pg = e => { const r = Paginacion.armar(e || {}); return r; };
  const copia = o => JSON.parse(JSON.stringify(o));

  const PAGINACION = [
    { id: 'pag-sin-sobras', t: 'Cerrar en 128 sin sobras',
      enun: 'Una novela de 100 páginas de texto, en 5 capítulos que abren en recto, se imprime en pliegos de 16. Tildá y destildá partes (preliminares y finales) hasta que el libro tenga 128 páginas y no quede ninguna en blanco al final.',
      prep: () => ({ paginas: '100', caracteres: '', porPagina: '', capitulos: '5', capRecto: '1', capPortada: '0', multiplo: '16', partes: {} }),
      ok: e => { if (!e || Paginacion.n(e.paginas) !== 100 || Paginacion.n(e.capitulos) !== 5 || Paginacion.n(e.multiplo) !== 16 || e.capRecto === '0') return false;
        const r = pg(e); return r.total === 128 && r.blancasFinal === 0; },
      ahora: e => { if (!e) return ''; const r = pg(e); return `Ahora: ${r.total} páginas, ${r.blancasFinal} en blanco al final.`; } },
    { id: 'pag-prologo-epilogo', t: 'Con prólogo y epílogo, en 96',
      enun: 'Un ensayo de 64 páginas de texto, en 4 capítulos que abren en recto, lleva prólogo y epílogo. Armá el resto de las partes para que el libro termine justo en 96 páginas (6 pliegos de 16).',
      prep: () => ({ paginas: '64', caracteres: '', porPagina: '', capitulos: '4', capRecto: '1', capPortada: '0', multiplo: '16', partes: { prologo: { on: true }, epilogo: { on: true } } }),
      ok: e => { if (!e || Paginacion.n(e.paginas) !== 64 || Paginacion.n(e.capitulos) !== 4 || Paginacion.n(e.multiplo) !== 16 || e.capRecto === '0') return false;
        const on = id => Paginacion.estado(e, Paginacion.PARTES.find(p => p.id === id)).on;
        return on('prologo') && on('epilogo') && pg(e).total === 96; },
      ahora: e => { if (!e) return ''; return `Ahora: ${pg(e).total} páginas; buscás 96.`; } }
  ];

  const ESCANDALLO = [
    { id: 'esc-equilibrio', t: 'Equilibrio en 900 ejemplares',
      enun: 'Un libro de PVP $ 9.000, con 40 % de descuento y $ 3.000.000 de costos de estructura, tarda 1.463 ejemplares en pagar esa estructura. Bajá ese punto de equilibrio a 900 o menos, sin pasar de $ 11.000 de PVP (tocá el PVP, el descuento o el costo).',
      prep: () => Object.assign(copia(Escandallo.EJEMPLO), { pvp: '9000', ce: '3000000' }),
      ok: e => { if (!e) return false; const c = Escandallo.calcular(e); return c.pvp <= 11000 && c.pe.estructura != null && c.pe.estructura <= 900; },
      ahora: e => { if (!e) return ''; const c = Escandallo.calcular(e); return c.pe.estructura == null ? 'Ahora: el libro no deja margen.' : `Ahora: ${Math.ceil(c.pe.estructura)} ejemplares; buscás 900 o menos.`; } },
    { id: 'esc-margen', t: 'Margen de 60 % sin subir el precio',
      enun: 'Con el libro del ejemplo (PVP $ 18.000), el margen de contribución es de 58,3 %. Llevalo al 60 % o más sin subir el PVP: probá con el descuento, el costo por ejemplar o los gastos.',
      prep: () => copia(Escandallo.EJEMPLO),
      ok: e => { if (!e) return false; const c = Escandallo.calcular(e); return c.pvp <= 18000 && c.mcuPct >= 0.6; },
      ahora: e => { if (!e) return ''; const c = Escandallo.calcular(e); return `Ahora: ${fmtN(c.mcuPct * 100)} %; buscás 60 % o más.`; } }
  ];

  const POR_SIM = { paginacion: PAGINACION, escandallo: ESCANDALLO };
  // Dónde guarda cada simulador su estado en E.
  const CLAVE_EST = { paginacion: 'paginacion', escandallo: 'escandallo' };
  const todos = () => PAGINACION.concat(ESCANDALLO);
  return { POR_SIM, CLAVE_EST, todos };
})();
if (typeof module !== 'undefined') module.exports = Retos;
