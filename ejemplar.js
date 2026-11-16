'use strict';
// Materia aprobada (paso 19): el ejemplar que se sortea al marcar una materia como aprobada.
// Reglas: propuestas/2026-11-12-materia-aprobada/lienzo/NIVELES.md. Pigmentos y probabilidades: datos/pigmentos.json (prob, en %).
// Fondos: datos/grabados.json, todos con la misma probabilidad (la rareza la da solo el pigmento).
// Se guarda con la materia como { p: pigmento, f: grabado, n: número (0 si no es numerado), r: 1 si ya usó el re-tiro }.
// Sin DOM: lo usan compartir.js, normalizar() de app.js y las pruebas de unidad.
const Ejemplar = (() => {
  const NIVELES = { tirada: 'Tirada', ilustrada: 'Edición ilustrada', numerado: 'Ejemplar numerado' };
  const RE_NOMBRE = /^[\p{L} ]{1,40}$/u, RE_GRAB = /^[\w-]{1,40}$/;

  // Elige un elemento según los pesos (en cualquier escala); rnd() devuelve [0, 1).
  function ponderado(lista, peso, rnd) {
    const total = lista.reduce((s, x) => s + peso(x), 0);
    let r = rnd() * total;
    for (const x of lista) { r -= peso(x); if (r < 0) return x; }
    return lista[lista.length - 1];
  }

  // Sortea las tres cosas a la vez: pigmento (por prob), fondo (parejo) y número (1 a 100, solo el numerado).
  function sortear(pigs, banco, rnd) {
    rnd = rnd || Math.random;
    const pig = ponderado(pigs.filter(p => p.prob > 0), p => p.prob, rnd);
    const f = banco[Math.floor(rnd() * banco.length)].id;
    return { p: pig.nombre, f, n: pig.nivel === 'numerado' ? 1 + Math.floor(rnd() * 100) : 0, r: 0 };
  }

  // Un solo re-tiro por materia: vuelve a sortear todo y queda fijo. Si ya se usó, devuelve null.
  function retirar(ej, pigs, banco, rnd) {
    if (!ej || ej.r) return null;
    return Object.assign(sortear(pigs, banco, rnd), { r: 1 });
  }

  // Forma de lo guardado (normalizar). Si el pigmento o el grabado dejaran de existir, resolver() lo cubre al dibujar.
  function sanear(x) {
    if (!x || typeof x !== 'object' || typeof x.p !== 'string' || !RE_NOMBRE.test(x.p) || typeof x.f !== 'string' || !RE_GRAB.test(x.f)) return null;
    const n = Number.isInteger(x.n) && x.n >= 1 && x.n <= 100 ? x.n : 0;
    return { p: x.p, f: x.f, n, r: x.r ? 1 : 0 };
  }

  // Datos para dibujar: el pigmento y el grabado completos, con respaldo estable si alguno ya no está en los datos.
  function resolver(ej, pigs, banco, id) {
    const h = [...String(id || '')].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
    const pig = pigs.find(p => p.nombre === ej.p) || pigs[0];
    const grab = banco.find(g => g.id === ej.f) || banco[h % banco.length];
    return { pig, grab, n: pig.nivel === 'numerado' ? (ej.n || 1 + h % 100) : 0, nivel: NIVELES[pig.nivel] || NIVELES.tirada, retiro: !ej.r };
  }

  const etiqueta = pig => (NIVELES[pig.nivel] || NIVELES.tirada) + ' · ' + pig.nombre;

  return { NIVELES, sortear, retirar, sanear, resolver, etiqueta };
})();
if (typeof module !== 'undefined') module.exports = Ejemplar;
