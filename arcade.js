// Arcade de Corrección de Estilo (0911): lógica sin DOM. La usa app.js y la prueba probar.py.
// Teórico: 3 vidas, 100 por acierto, multiplicador por racha y +50 por pregunta difícil (antes del multiplicador).
// Práctico: se toca el error en un texto con marcas {e|original|corrección|justificación} y {n|original}.
const Arcade = (() => {
  const TEMPORADA = '2026-2c-2p', MATERIA = '0911';
  const VIDAS = 3, PTS_ACIERTO = 100, BONO_DIFICIL = 50, PTS_ERROR = 100, PEN_SOBRE = 50, BONO_IMPECABLE = 200, TOP = 10;
  const RE_INI = /^[A-Z]{3}$/, RE_FECHA = /^\d{4}-\d\d-\d\d$/;

  // Claves de apunte (lo que va antes del primer guion del id) que entran en cada tablero teórico.
  const EJES = {
    'teo-1p': ['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e6b', 'e7', 'e8', 'e9', 'p', 'd'],
    'teo-2p': ['e10', 'e11a', 'e11b', 'e12', 'e13a', 'e13b', 'e14', 'g', 'm', 'pv', 'v']
  };
  EJES['teo-final'] = EJES['teo-1p'].concat(EJES['teo-2p'], ['c']);
  const TEORICOS = [['teo-1p', '1.er parcial', 'Individual · ejes E1 a E9, P y D'], ['teo-2p', '2.º parcial', 'Individual · ejes E10 a E14, G, M, PV y V'], ['teo-final', 'Final', 'Todos los ejes']];
  const claveApunte = id => String(id).split('-')[0];
  const ejesDe = t => Object.prototype.hasOwnProperty.call(EJES, t) ? EJES[t] : null;
  const esTablero = t => typeof t === 'string' && (!!ejesDe(t) || /^prac-[a-z0-9][\w.-]{0,39}$/.test(t));
  const apuntesDe = (tablero, ids) => (ejesDe(tablero) ? ids.filter(id => ejesDe(tablero).indexOf(claveApunte(id)) >= 0) : []);

  const mult = racha => racha >= 10 ? 4 : racha >= 6 ? 3 : racha >= 3 ? 2 : 1;
  const mezclar = (v, rnd) => { const a = v.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor((rnd || Math.random)() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };

  // ---------- teórico ----------
  // apuntes: { 'e1-clases…': {preguntas: [...]}}; dificiles: [{eje, texto, opciones, correcta, respuesta, dificil}] (lote propio del arcade).
  // Solo entran las de opción con 4 opciones y una correcta válida; ninguna V/F.
  const valida = p => p && p.tipo !== 'vf' && Array.isArray(p.opciones) && p.opciones.length === 4 && Number.isInteger(p.correcta) && p.correcta >= 0 && p.correcta < 4 && typeof p.texto === 'string' && p.texto;
  function banco(tablero, apuntes, dificiles) {
    const out = [];
    apuntesDe(tablero, Object.keys(apuntes || {})).forEach(id => (apuntes[id].preguntas || []).forEach(p => { if (valida(p) && (p.tipo === 'opcion' || p.tipo == null)) out.push({ k: id + '/' + p.n, p, dificil: p.dificil === true }); }));
    (dificiles || []).forEach((p, i) => { if (valida(p) && ejesDe(tablero) && ejesDe(tablero).indexOf(p.eje) >= 0) out.push({ k: 'arcade/' + i, p, dificil: true }); });
    return out;
  }
  // Máximo teórico: todas bien y las difíciles en los lugares de mayor multiplicador.
  function maximo(n, dificiles) {
    const m = []; for (let i = 1; i <= n; i++) m.push(mult(i));
    m.sort((a, b) => b - a);
    let t = 0; m.forEach((x, i) => { t += (PTS_ACIERTO + (i < dificiles ? BONO_DIFICIL : 0)) * x; });
    return t;
  }
  const maximoBanco = b => maximo(b.length, b.filter(x => x.dificil).length);
  function nueva(b, rnd) {
    const cola = mezclar(b, rnd).map(x => {
      const orden = mezclar([0, 1, 2, 3], rnd);
      return { k: x.k, texto: x.p.texto, respuesta: x.p.respuesta || '', dificil: x.dificil, opciones: orden.map(i => x.p.opciones[i]), correcta: orden.indexOf(x.p.correcta) };
    });
    return { cola, i: 0, vidas: VIDAS, puntos: 0, racha: 0, mejorRacha: 0, aciertos: 0, ultimo: null, fin: !cola.length };
  }
  // Responde la pregunta actual con la opción x. Devuelve lo que pasó; el estado queda en "ultimo" hasta llamar a siguiente().
  function responder(S, x) {
    if (S.fin || S.ultimo) return null;
    const q = S.cola[S.i], ok = Number(x) === q.correcta;
    let ganado = 0, m = 1;
    if (ok) { S.racha++; m = mult(S.racha); ganado = (PTS_ACIERTO + (q.dificil ? BONO_DIFICIL : 0)) * m; S.puntos += ganado; S.aciertos++; S.mejorRacha = Math.max(S.mejorRacha, S.racha); }
    else { S.racha = 0; S.vidas--; }
    S.ultimo = { ok, ganado, mult: m, elegida: Number(x) };
    return S.ultimo;
  }
  function siguiente(S) {
    if (!S.ultimo) return;
    S.ultimo = null; S.i++;
    if (S.vidas <= 0 || S.i >= S.cola.length) S.fin = true;
  }

  // ---------- práctico ----------
  // Texto con marcas → párrafos de palabras tocables. Cada palabra lleva "z": la zona (error o neutra) a la que pertenece, o -1.
  const RE_MARCA = /\{([en])\|([^{}|]*)((?:\|[^{}|]*)*)\}/g;
  function parsear(fuente) {
    if (typeof fuente !== 'string') throw new Error('el texto tiene que ser una cadena');
    const chars = [], zonas = [];   // chars: [caracter, zona]
    let ult = 0, m;
    const plano = (s) => { for (const c of s) chars.push([c, -1]); };
    RE_MARCA.lastIndex = 0;
    while ((m = RE_MARCA.exec(fuente))) {
      plano(fuente.slice(ult, m.index));
      ult = m.index + m[0].length;
      const campos = m[3] ? m[3].slice(1).split('|') : [], orig = m[2];
      if (!orig.trim()) throw new Error('marca sin texto original: ' + m[0]);
      if (m[1] === 'e' && (campos.length !== 2 || !campos[0].trim() || !campos[1].trim())) throw new Error('un error lleva {e|original|corrección|justificación}: ' + m[0]);
      if (m[1] === 'n' && campos.length > 1) throw new Error('una zona neutra lleva {n|original} o {n|original|nota}: ' + m[0]);
      const z = zonas.length;
      zonas.push(m[1] === 'e' ? { id: z, tipo: 'e', orig: orig.trim(), corr: campos[0].trim(), just: campos[1].trim() } : { id: z, tipo: 'n', orig: orig.trim(), nota: (campos[0] || '').trim() });
      for (const c of orig) chars.push([c, z]);
    }
    plano(fuente.slice(ult));
    if (/[{}]/.test(chars.map(c => c[0]).join(''))) throw new Error('llave sin cerrar o marca mal formada');
    const parrafos = [[]];
    let pal = '', zp = -1, n = 0;
    const cerrarPal = () => { if (pal) { parrafos[parrafos.length - 1].push({ w: pal, z: zp, i: n++ }); } pal = ''; zp = -1; };
    chars.forEach(([c, z], idx) => {
      if (/\s/.test(c)) {
        cerrarPal();
        // Un salto de línea (o dos) abre un párrafo nuevo.
        if (c === '\n' && parrafos[parrafos.length - 1].length) parrafos.push([]);
        return;
      }
      if (z >= 0) { if (zp >= 0 && zp !== z) throw new Error('dos marcas pegadas en «' + pal + c + '»: separalas con un espacio'); zp = z; }
      pal += c;
    });
    cerrarPal();
    const P = parrafos.filter(p => p.length);
    const tokens = [].concat(...P);
    zonas.forEach(z => { z.n = tokens.filter(t => t.z === z.id).length; if (!z.n) throw new Error('zona sin palabras'); });
    return { parrafos: P, tokens, zonas, errores: zonas.filter(z => z.tipo === 'e').length };
  }
  const maximoPractico = T => PTS_ERROR * T.errores + BONO_IMPECABLE;
  function nuevoPractico(T) { return { T, marcas: {}, halladas: [], sobre: 0, puntos: 0, fin: false, rindio: false, impecable: false }; }
  // Toca definitivamente la palabra i (el "Marcar"). Devuelve 'acierto', 'neutra', 'sobre' o 'repetida' (sin efecto).
  function marcar(S, i) {
    const t = S.T.tokens[i];
    if (S.fin || !t || S.marcas[i]) return 'repetida';
    if (t.z < 0) { S.marcas[i] = 's'; S.sobre++; S.puntos -= PEN_SOBRE; return 'sobre'; }
    const z = S.T.zonas[t.z];
    if (z.tipo === 'n') { S.T.tokens.forEach(x => { if (x.z === z.id) S.marcas[x.i] = 'n'; }); return 'neutra'; }
    S.T.tokens.forEach(x => { if (x.z === z.id) S.marcas[x.i] = 'e'; });
    S.halladas.push(z.id); S.puntos += PTS_ERROR;
    if (S.halladas.length === S.T.errores) cerrarPractico(S, false);
    return 'acierto';
  }
  function cerrarPractico(S, rindio) {
    if (S.fin) return S;
    S.fin = true; S.rindio = !!rindio;
    if (!rindio && S.halladas.length === S.T.errores && S.sobre === 0) { S.impecable = true; S.puntos += BONO_IMPECABLE; }
    return S;
  }
  const puntosFinales = S => Math.max(0, S.puntos);

  // ---------- puntajes locales ----------
  const cero = n => String(Math.max(0, Math.round(n))).padStart(6, '0');
  // Inserta [puntos, fecha, iniciales] en el top 10 de un tablero (de mayor a menor; a igual puntaje, la más antigua primero).
  function sumarTop(lista, reg) {
    const L = (lista || []).concat([reg]).sort((a, b) => b[0] - a[0]);
    return L.slice(0, TOP);
  }
  // Todo lo que entra por localStorage o por un archivo importado se reconstruye acá: solo iniciales A–Z, enteros y fechas.
  function sanear(a) {
    const out = { ini: '', mejores: {} };
    if (!a || typeof a !== 'object') return out;
    out.ini = RE_INI.test(a.ini || '') ? a.ini : '';
    const M = a.mejores && typeof a.mejores === 'object' ? a.mejores : {};
    Object.keys(M).slice(0, 60).forEach(t => {
      if (!esTablero(t) || !Array.isArray(M[t])) return;
      const L = M[t].slice(0, 50).filter(r => Array.isArray(r) && Number.isInteger(r[0]) && r[0] > 0 && r[0] <= 999999 && RE_FECHA.test(r[1] || '') && RE_INI.test(r[2] || ''))
        .map(r => [r[0], r[1], r[2]]).sort((x, y) => y[0] - x[0]).slice(0, TOP);
      if (L.length) out.mejores[t] = L;
    });
    return out;
  }
  const iniciales = s => String(s || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
  // Rueda del selector: sube o baja una letra de la A a la Z, dando la vuelta.
  const girar = (c, d) => String.fromCharCode(65 + ((c.charCodeAt(0) - 65 + d + 26) % 26));

  return { TEMPORADA, MATERIA, VIDAS, EJES, TEORICOS, esTablero, apuntesDe, claveApunte, mult, mezclar, valida, banco, maximo, maximoBanco, nueva, responder, siguiente,
    parsear, maximoPractico, nuevoPractico, marcar, cerrarPractico, puntosFinales, cero, sumarTop, sanear, iniciales, girar, RE_INI, TOP };
})();
if (typeof module !== 'undefined') module.exports = Arcade;
