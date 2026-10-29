// Formatos de papel (FPI): la serie A normalizada (IRAM/ISO), los pliegos y los formatos de libro que aparecen en la materia.
// Sin DOM: lo usa app.js y lo prueba probar.py. Medidas en milímetros (ancho × alto, siempre alto ≥ ancho).
const Formatos = (() => {
  const RAIZ2 = Math.SQRT2;

  // Serie A: A0 mide 841 × 1189 mm (1 m²) y cada número es la mitad del anterior, cortado por el lado largo.
  // Las medidas oficiales están redondeadas al milímetro, por eso la relación no da exactamente √2.
  const SERIE_A = [[841, 1189], [594, 841], [420, 594], [297, 420], [210, 297], [148, 210], [105, 148], [74, 105], [52, 74], [37, 52], [26, 37]]
    .map(([ancho, alto], i) => ({ id: 'a' + i, grupo: 'a', t: 'A' + i, n: i, ancho, alto }));

  const USO_A = {
    0: 'Formato básico de la serie: mide 1 m² (841 × 1189 mm). De ahí sale todo el resto.',
    3: 'Pliego de impresión de la impresión por demanda: el interior y las tapas del escandallo se cuentan en pliegos A3.',
    4: 'Como formato de libro entran 4 páginas por pliego A3.'
  };
  SERIE_A.forEach(f => { if (USO_A[f.n]) f.uso = USO_A[f.n]; });

  const cm = (a, b) => [Math.round(a * 10), Math.round(b * 10)];
  const pliego = (grupo, a, b, uso) => { const [ancho, alto] = cm(a, b); return { id: grupo + a + 'x' + b, grupo, t: a + ' × ' + b, ancho, alto, uso }; };
  const PLIEGOS = [
    pliego('p', 58, 92, 'Pliego de papel. Es el del ejemplo de la cátedra: 32 páginas de un libro de 13 × 20 cm por pliego.'),
    pliego('p', 63, 88, 'Pliego de papel. En el ejemplo de la cátedra tiene las mismas 32 páginas por pliego, pero más desperdicio y más kilos por resma.'),
    pliego('p', 65, 95, 'Pliego de papel. Es el de las tapas del ejemplo de la cátedra.'),
    pliego('p', 72, 102, 'Pliego estándar de papel.'),
    pliego('p', 82, 118, 'Pliego estándar de papel.'),
    pliego('c', 66, 100, 'Pliego estándar de cartulina.'),
    pliego('c', 76, 112, 'Pliego estándar de cartulina.'),
    pliego('c', 82, 112, 'Pliego estándar de cartulina.')
  ];

  const libro = (a, b, uso) => { const [ancho, alto] = cm(a, b); return { id: 'l' + a + 'x' + b, grupo: 'l', t: a + ' × ' + b, ancho, alto, uso }; };
  const LIBROS = [
    libro(13, 20, 'Formato cerrado del ejemplo de la cátedra para el interior.'),
    libro(14, 20, 'Formato cerrado del ejemplo de la cátedra para las tapas.'),
    libro(14, 21, 'Entran 8 páginas por pliego A3 en la impresión por demanda.'),
    libro(15, 22, 'Entran 4 páginas por pliego A3 en la impresión por demanda.')
  ];

  const GRUPOS = [
    { id: 'a', t: 'Serie A (IRAM/ISO)', corto: 'Serie A' },
    { id: 'p', t: 'Pliegos de papel', corto: 'Papel' },
    { id: 'c', t: 'Pliegos de cartulina', corto: 'Cartulina' },
    { id: 'l', t: 'Libros de la cátedra', corto: 'Libros' }
  ];
  const TODOS = [...SERIE_A, ...PLIEGOS, ...LIBROS];
  const porId = id => TODOS.find(f => f.id === id);

  // Relación de aspecto: lado largo ÷ lado corto. La serie A busca √2 ≈ 1,4142.
  const relacion = f => Math.max(f.ancho, f.alto) / Math.min(f.ancho, f.alto);
  // Cuánto se aparta de √2, en porcentaje (positivo: más alargado que la serie A).
  const desvio = f => (relacion(f) / RAIZ2 - 1) * 100;

  // Bipartir: se corta el lado largo por la mitad. Queda un rectángulo de (lado corto) × (lado largo ÷ 2), ordenado ancho ≤ alto.
  const bipartir = f => { const lado = Math.min(f.ancho, f.alto), mitad = Math.max(f.ancho, f.alto) / 2; return { ancho: Math.min(lado, mitad), alto: Math.max(lado, mitad) }; };
  // Cadena de n bipartes (incluye el formato de partida).
  const cadena = (f, n) => { const out = [{ ancho: f.ancho, alto: f.alto }]; for (let i = 0; i < n; i++) out.push(bipartir(out[i])); return out; };

  // Cuántos A(m) entran en un A(n) (m ≥ n): 2^(m−n).
  const entran = (n, m) => Math.pow(2, m - n);
  const area = f => f.ancho * f.alto / 1e6;   // m²

  // Mosaico: dos A0 (1682 × 1189 mm, apaisado) cortados una y otra vez por el lado largo. A0 ocupa la mitad izquierda y la
  // mitad derecha se parte en A1 + resto, el resto en A2 + resto, etc. Las medidas son las exactas (mitades sucesivas), no las redondeadas.
  const mosaico = () => {
    const A0 = SERIE_A[0], tiles = [{ id: 'a0', n: 0, x: 0, y: 0, w: A0.ancho, h: A0.alto }];
    let r = { x: A0.ancho, y: 0, w: A0.ancho, h: A0.alto };
    for (let n = 1; n <= 10; n++) {
      if (r.h >= r.w) { tiles.push({ id: 'a' + n, n, x: r.x, y: r.y, w: r.w, h: r.h / 2 }); r = { x: r.x, y: r.y + r.h / 2, w: r.w, h: r.h / 2 }; }
      else { tiles.push({ id: 'a' + n, n, x: r.x, y: r.y, w: r.w / 2, h: r.h }); r = { x: r.x + r.w / 2, y: r.y, w: r.w / 2, h: r.h }; }
    }
    return { ancho: A0.ancho * 2, alto: A0.alto, tiles, resto: r };
  };

  // Puntos de partida de la demostración «doblá a la mitad»: la serie A y dos formatos que no son √2.
  const BASES = [
    { id: 'a3', t: 'A3 (serie A)', ancho: 297, alto: 420 },
    { id: 'l14x21', t: 'Libro 14 × 21', ancho: 140, alto: 210 },
    { id: 'p65x95', t: 'Pliego 65 × 95', ancho: 650, alto: 950 }
  ];

  return { SERIE_A, PLIEGOS, LIBROS, GRUPOS, TODOS, BASES, RAIZ2, porId, relacion, desvio, bipartir, cadena, entran, area, mosaico };
})();
