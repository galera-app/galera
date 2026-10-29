'use strict';
// «Pasar a otro dispositivo»: el estado de Galera comprimido dentro del # de un link y de un QR.
// No hay servidor: los datos viajan en el link (el # no se manda a ningún sitio) y se leen en el otro dispositivo.
// El generador de QR es propio (modo bytes, niveles M y L, versiones 1 a 40), sin librerías de terceros.
const Traspaso = (() => {
  // ---------- QR ----------
  // Tablas por versión (índice 1 a 40): palabras de corrección por bloque y cantidad de bloques.
  const ECC = { L: [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    M: [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28] };
  const BLOQUES = { L: [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
    M: [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49] };
  const FORMATO = { L: 1, M: 0 };   // bits del nivel de corrección en el código de formato

  const modulosTotales = v => {
    let r = (16 * v + 128) * v + 64;
    if (v >= 2) { const n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; }
    return r;
  };
  const capacidad = (v, n) => Math.floor(modulosTotales(v) / 8) - ECC[n][v] * BLOQUES[n][v];   // palabras de datos

  // Aritmética de Reed-Solomon en GF(256), polinomio 0x11D.
  const mulGF = (x, y) => { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z; };
  function divisor(grado) {
    const r = new Array(grado).fill(0); r[grado - 1] = 1;
    let raiz = 1;
    for (let i = 0; i < grado; i++) {
      for (let j = 0; j < r.length; j++) { r[j] = mulGF(r[j], raiz); if (j + 1 < r.length) r[j] ^= r[j + 1]; }
      raiz = mulGF(raiz, 2);
    }
    return r;
  }
  function resto(datos, div) {
    const r = new Array(div.length).fill(0);
    for (const b of datos) { const f = b ^ r.shift(); r.push(0); div.forEach((c, i) => { r[i] ^= mulGF(c, f); }); }
    return r;
  }

  const posAlineacion = v => {
    if (v === 1) return [];
    const n = Math.floor(v / 7) + 2, tam = v * 4 + 17, paso = v === 32 ? 26 : Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2, r = [6];
    for (let p = tam - 7; r.length < n; p -= paso) r.splice(1, 0, p);
    return r;
  };

  const MASCARAS = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x, y) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => x * y % 2 + x * y % 3 === 0,
    (x, y) => (x * y % 2 + x * y % 3) % 2 === 0, (x, y) => ((x + y) % 2 + x * y % 3) % 2 === 0];

  function penalidad(m) {
    const n = m.length; let p = 0, oscuros = 0;
    const linea = (get) => {   // reglas 1 y 3 sobre una fila o columna
      let corrida = 1, ult = get(0), bits = 0;
      for (let i = 0; i < n; i++) {
        const c = get(i);
        if (i > 0) { if (c === ult) { corrida++; if (corrida === 5) p += 3; else if (corrida > 5) p++; } else { corrida = 1; ult = c; } }
        bits = ((bits << 1) | (c ? 1 : 0)) & 0x7FF;
        if (i >= 10 && (bits === 0x5D0 || bits === 0x05D)) p += 40;   // 10111010000 y 00001011101
      }
    };
    for (let y = 0; y < n; y++) linea(i => m[y][i]);
    for (let x = 0; x < n; x++) linea(i => m[i][x]);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if (m[y][x]) oscuros++;
      if (x + 1 < n && y + 1 < n && m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) p += 3;
    }
    p += 10 * (Math.ceil(Math.abs(oscuros * 20 - n * n * 10) / (n * n)) - 1);
    return p;
  }

  // Devuelve la matriz de módulos (true = oscuro). nivel: 'M' o 'L'. Si no entra en la versión 40, devuelve null.
  // mascara (0 a 7) y version fuerzan esos valores: solo para las pruebas.
  function qr(bytes, nivel, mascara, version) {
    let v = version || 0;
    const bitsCuenta = vv => vv < 10 ? 8 : 16;
    if (!v) for (v = 1; v <= 40; v++) if (4 + bitsCuenta(v) + bytes.length * 8 <= capacidad(v, nivel) * 8) break;
    if (v > 40 || 4 + bitsCuenta(v) + bytes.length * 8 > capacidad(v, nivel) * 8) return null;
    const tam = v * 4 + 17, cap = capacidad(v, nivel);
    // 1. bits de datos: modo bytes (0100), cantidad, datos, terminador y relleno
    const bits = [];
    const poner = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    poner(4, 4); poner(bytes.length, bitsCuenta(v)); bytes.forEach(b => poner(b, 8));
    poner(0, Math.min(4, cap * 8 - bits.length));
    while (bits.length % 8) bits.push(0);
    const datos = []; for (let i = 0; i < bits.length; i += 8) datos.push(parseInt(bits.slice(i, i + 8).join(''), 2));
    for (let pad = 0xEC; datos.length < cap; pad ^= 0xEC ^ 0x11) datos.push(pad);
    // 2. bloques con corrección de errores, intercalados
    const nb = BLOQUES[nivel][v], ecc = ECC[nivel][v], crudo = Math.floor(modulosTotales(v) / 8), cortos = nb - crudo % nb, largoCorto = Math.floor(crudo / nb);
    const div = divisor(ecc), bloques = []; let k = 0;
    for (let i = 0; i < nb; i++) {
      const d = datos.slice(k, k + largoCorto - ecc + (i < cortos ? 0 : 1)); k += d.length;
      bloques.push({ d, e: resto(d, div) });
    }
    const final = [];
    for (let i = 0; i < largoCorto - ecc + 1; i++) bloques.forEach(b => { if (i < b.d.length) final.push(b.d[i]); });
    for (let i = 0; i < ecc; i++) bloques.forEach(b => final.push(b.e[i]));
    // 3. patrones de función
    const m = Array.from({ length: tam }, () => new Array(tam).fill(false)), fn = Array.from({ length: tam }, () => new Array(tam).fill(false));
    const fijar = (x, y, c) => { m[y][x] = c; fn[y][x] = true; };
    for (let i = 0; i < tam; i++) { fijar(6, i, i % 2 === 0); fijar(i, 6, i % 2 === 0); }
    const buscador = (cx, cy) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy; if (x >= 0 && x < tam && y >= 0 && y < tam) fijar(x, y, d !== 2 && d !== 4); } };
    buscador(3, 3); buscador(tam - 4, 3); buscador(3, tam - 4);
    const al = posAlineacion(v);
    al.forEach((cy, i) => al.forEach((cx, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === al.length - 1) || (i === al.length - 1 && j === 0)) return;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) fijar(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }));
    const formato = msk => {
      const d = (FORMATO[nivel] << 3) | msk; let r = d;
      for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
      const f = ((d << 10) | r) ^ 0x5412, b = i => ((f >>> i) & 1) !== 0;
      for (let i = 0; i <= 5; i++) fijar(8, i, b(i));
      fijar(8, 7, b(6)); fijar(8, 8, b(7)); fijar(7, 8, b(8));
      for (let i = 9; i < 15; i++) fijar(14 - i, 8, b(i));
      for (let i = 0; i < 8; i++) fijar(tam - 1 - i, 8, b(i));
      for (let i = 8; i < 15; i++) fijar(8, tam - 15 + i, b(i));
      fijar(8, tam - 8, true);
    };
    formato(0);
    if (v >= 7) {
      let r = v; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1F25);
      const f = (v << 12) | r;
      for (let i = 0; i < 18; i++) { const c = ((f >>> i) & 1) !== 0, a = tam - 11 + i % 3, b = Math.floor(i / 3); fijar(a, b, c); fijar(b, a, c); }
    }
    // 4. datos en zigzag
    let idx = 0;
    for (let der = tam - 1; der >= 1; der -= 2) {
      if (der === 6) der = 5;
      for (let vert = 0; vert < tam; vert++) for (let j = 0; j < 2; j++) {
        const x = der - j, y = ((der + 1) & 2) === 0 ? tam - 1 - vert : vert;
        if (!fn[y][x] && idx < final.length * 8) { m[y][x] = ((final[idx >>> 3] >>> (7 - (idx & 7))) & 1) !== 0; idx++; }
      }
    }
    // 5. máscara: la de menor penalidad (o la pedida)
    const aplicar = msk => { for (let y = 0; y < tam; y++) for (let x = 0; x < tam; x++) if (!fn[y][x] && MASCARAS[msk](x, y)) m[y][x] = !m[y][x]; };
    let mejor = mascara, pen = Infinity;
    if (mascara == null) {
      for (let i = 0; i < 8; i++) { aplicar(i); formato(i); const p = penalidad(m); if (p < pen) { pen = p; mejor = i; } aplicar(i); }
    }
    aplicar(mejor); formato(mejor);
    return m;
  }

  // El QR más chico que entre: nivel M (más tolerante a una pantalla sucia) y, si no entra, L.
  function qrDeTexto(texto) {
    const bytes = Array.from(new TextEncoder().encode(texto));
    return qr(bytes, 'M') || qr(bytes, 'L');
  }
  // SVG del QR con zona de silencio de 4 módulos; siempre negro sobre blanco, para que cualquier cámara lo lea.
  function qrSvg(m, etiqueta) {
    const n = m.length; let d = '';
    m.forEach((fila, y) => { for (let x = 0; x < n;) { if (!fila[x]) { x++; continue; } let l = 0; while (x + l < n && fila[x + l]) l++; d += `M${x + 4} ${y + 4}h${l}v1h-${l}z`; x += l; } });
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n + 8} ${n + 8}" role="img" aria-label="${etiqueta || 'Código QR'}" shape-rendering="crispEdges" class="qr"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
  }

  // ---------- estado <-> texto del link ----------
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  function aB64(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 3) {
      const n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0);
      s += B64[n >> 18] + B64[(n >> 12) & 63] + (i + 1 < bytes.length ? B64[(n >> 6) & 63] : '') + (i + 2 < bytes.length ? B64[n & 63] : '');
    }
    return s;
  }
  function deB64(s) {
    if (!/^[A-Za-z0-9_-]*$/.test(s) || s.length % 4 === 1) throw new Error('base64');
    const out = []; let acc = 0, n = 0;
    for (const c of s) { acc = (acc << 6) | B64.indexOf(c); n += 6; if (n >= 8) { n -= 8; out.push((acc >> n) & 255); acc &= (1 << n) - 1; } }
    return new Uint8Array(out);
  }

  // Lo que viaja: todo menos lo que es de este navegador (fechas de copia y de visita). La versión liviana
  // deja afuera el historial de práctica de las preguntas (lo que más pesa), para que entre en un QR.
  const paraEnviar = (E, liviano) => { const c = Object.assign({}, E); ['copia', 'modif', 'primera', 'visto'].forEach(k => delete c[k]); if (liviano) c.practica = {}; return c; };

  const HAY_COMPRESION = () => typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';
  async function correr(flujo, bytes, tope) {
    const w = flujo.writable.getWriter();
    w.write(bytes).catch(() => { }); w.close().catch(() => { });
    const r = flujo.readable.getReader(), partes = []; let total = 0;
    for (;;) {
      const { done, value } = await r.read();
      if (done) break;
      total += value.length;
      if (tope && total > tope) { r.cancel().catch(() => { }); throw new Error('demasiado grande'); }
      partes.push(value);
    }
    const out = new Uint8Array(total); let k = 0; partes.forEach(p => { out.set(p, k); k += p.length; });
    return out;
  }
  // Texto del link (lo que va después de #datos=). Un prefijo de una letra deja cambiar el formato más adelante.
  async function empaquetar(E, liviano) {
    if (!HAY_COMPRESION()) throw new Error('Este navegador no puede comprimir los datos.');
    const crudo = new TextEncoder().encode(JSON.stringify(paraEnviar(E, liviano)));
    return 'a' + aB64(await correr(new CompressionStream('deflate-raw'), crudo));
  }
  // Devuelve el objeto de estado (todavía sin normalizar). Falla si el texto está cortado o no es de Galera.
  async function desempaquetar(texto) {
    if (!HAY_COMPRESION()) throw new Error('Este navegador no puede leer los datos.');
    if (texto[0] !== 'a') throw new Error('versión desconocida');
    const bytes = await correr(new DecompressionStream('deflate-raw'), deB64(texto.slice(1)), 1e6);
    const e = JSON.parse(new TextDecoder().decode(bytes));
    if (!e || e.v !== 1 || typeof e.materias !== 'object') throw new Error('no es de Galera');
    return e;
  }

  return { qr, qrDeTexto, qrSvg, capacidad, aB64, deB64, paraEnviar, empaquetar, desempaquetar, HAY_COMPRESION };
})();
if (typeof module !== 'undefined') module.exports = Traspaso;
