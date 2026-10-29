'use strict';
// Lector de números compartido por los simuladores (escandallo, papel, paginación).
// Acepta "18.000", "18000", "4,6" y "4.6": con coma, los puntos son de miles; sin coma, un punto seguido de
// tres cifras también (18.000), y si no, es decimal (4.6). Lo que no es número da 0.
const Num = (() => {
  const parse = v => {
    let s = String(v == null ? '' : v).replace(/[\s$%]/g, '');
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    const x = Number(s); return isFinite(x) ? x : 0;
  };
  return { parse };
})();
