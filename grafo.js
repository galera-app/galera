// Grafo del glosario: dispone los términos como nodos y sus relaciones como aristas. Solo cuentas; la vista está en app.js.
// Entrada: datos/glosario.json (terminos + relaciones [i, j, tipo]: «la definición de i nombra a j» o «ver también» a mano).
// La disposición es determinista (misma semilla), con fuerzas simples: repulsión entre todos, resorte en cada relación,
// un resorte más flojo entre los términos de un mismo eje de una materia (no se dibuja) y un ancla por materia.
const Grafo = (() => {
  const W = 1000, H = 760;
  const ejes = t => { const s = []; t.acepciones.forEach(a => Object.keys(a.ref || {}).forEach(m => { if (a.ref[m]) s.push(m + '·' + a.ref[m]); })); return s; };

  function semilla(n) { return () => { n = (n + 0x6D2B79F5) | 0; let t = Math.imul(n ^ (n >>> 15), 1 | n); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // Para cada término, quién lo nombra y a quién nombra. tipo: 'm' (menciona) o 'v' (ver también).
  function vecinos(G) {
    const v = G.terminos.map(() => ({ sale: [], entra: [] }));
    (G.relaciones || []).forEach(([a, b]) => { if (a !== b && v[a] && v[b]) { v[a].sale.push(b); v[b].entra.push(a); } });
    return v;
  }
  const grado = (v, i) => v[i].sale.length + v[i].entra.length;
  const juntos = (v, i) => { const s = new Set(v[i].sale.concat(v[i].entra)); return [...s].sort((a, b) => a - b); };

  function armar(G) {
    const n = G.terminos.length, v = vecinos(G), az = semilla(2026);
    const mats = G.materias.map(m => m.id), ancla = {};
    mats.forEach((m, k) => { const a = 2 * Math.PI * k / mats.length + Math.PI / 4; ancla[m] = [W / 2 + 230 * Math.cos(a), H / 2 + 190 * Math.sin(a)]; });
    const P = G.terminos.map((t, i) => { const [ax, ay] = ancla[t.materias[0]] || [W / 2, H / 2]; return { x: ax + (az() - 0.5) * 160, y: ay + (az() - 0.5) * 160, vx: 0, vy: 0 }; });
    // resortes: relaciones (firmes) y mismo eje (flojos)
    const R = [], porEje = {};
    G.terminos.forEach((t, i) => ejes(t).forEach(e => (porEje[e] = porEje[e] || []).push(i)));
    (G.relaciones || []).forEach(([a, b]) => { if (a !== b) R.push([a, b, 46, 0.06]); });
    Object.keys(porEje).forEach(e => { const L = porEje[e]; for (let x = 0; x < L.length; x++) for (let y = x + 1; y < L.length; y++) R.push([L[x], L[y], 70, 0.008]); });
    const IT = 260;
    for (let it = 0; it < IT; it++) {
      const enf = 1 - it / IT;
      for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
        let dx = P[a].x - P[b].x, dy = P[a].y - P[b].y, d2 = dx * dx + dy * dy;
        if (d2 > 90000) continue;
        if (d2 < 1) { dx = az() - 0.5; dy = az() - 0.5; d2 = 1; }
        const d = Math.sqrt(d2), f = 900 / d2; dx /= d; dy /= d;
        P[a].vx += dx * f; P[a].vy += dy * f; P[b].vx -= dx * f; P[b].vy -= dy * f;
      }
      R.forEach(([a, b, len, k]) => {
        const dx = P[b].x - P[a].x, dy = P[b].y - P[a].y, d = Math.sqrt(dx * dx + dy * dy) || 1, f = (d - len) * k;
        P[a].vx += dx / d * f; P[a].vy += dy / d * f; P[b].vx -= dx / d * f; P[b].vy -= dy / d * f;
      });
      G.terminos.forEach((t, i) => {
        const [ax, ay] = ancla[t.materias[0]] || [W / 2, H / 2], p = P[i];
        p.vx += (ax - p.x) * 0.004; p.vy += (ay - p.y) * 0.004;
        p.vx += (W / 2 - p.x) * 0.0015; p.vy += (H / 2 - p.y) * 0.0015;
        const lim = 12 * enf + 1; p.vx = Math.max(-lim, Math.min(lim, p.vx * 0.85)); p.vy = Math.max(-lim, Math.min(lim, p.vy * 0.85));
        p.x += p.vx; p.y += p.vy;
      });
    }
    // Ajuste al lienzo, con margen
    const xs = P.map(p => p.x), ys = P.map(p => p.y), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const k = Math.min((W - 90) / ((x1 - x0) || 1), (H - 70) / ((y1 - y0) || 1));
    const ox = (W - (x1 - x0) * k) / 2, oy = (H - (y1 - y0) * k) / 2;
    const nodos = P.map((p, i) => ({ x: +((p.x - x0) * k + ox).toFixed(1), y: +((p.y - y0) * k + oy).toFixed(1), g: grado(v, i), m: Math.max(0, mats.indexOf(G.terminos[i].materias[0])) }));
    const nx = nodos.map(p => p.x), ny = nodos.map(p => p.y), cx0 = Math.min(...nx) - 70, cy0 = Math.min(...ny) - 30;
    return { v, nodos, caja: [+cx0.toFixed(1), +cy0.toFixed(1), +(Math.max(...nx) + 150 - cx0).toFixed(1), +(Math.max(...ny) + 30 - cy0).toFixed(1)] };
  }
  return { W, H, ejes, vecinos, grado, juntos, armar };
})();
if (typeof module !== 'undefined') module.exports = Grafo;
