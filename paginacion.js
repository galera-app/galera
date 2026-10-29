// Esquema de paginación de un libro: qué partes lleva, cuántas páginas ocupa cada una y dónde cae (recto o verso).
// Sin DOM: lo usa app.js y lo prueba probar.py.
const Paginacion = (() => {
  const n = Num.parse;   // lector compartido (num.js): acepta 4,6 y 4.6

  // Partes del libro, en el orden habitual. ini: 'recto' (página impar), 'verso' (par) o 'sigue' (a continuación). pags: páginas por defecto.
  // grupo: pre (preliminares), cue (cuerpo), fin (finales). El cuerpo (id 'cuerpo') se arma aparte, con los capítulos.
  const PARTES = [
    { id: 'anteportada', t: 'Anteportada (portadilla)', grupo: 'pre', pags: 1, ini: 'recto', on: true, ay: 'Hoja con solo el título de la obra. Va en página impar (recto) y su dorso suele quedar en blanco o llevar la colección u otras obras del autor.' },
    { id: 'colec', t: 'Colección y obras del autor', grupo: 'pre', pags: 1, ini: 'verso', on: false, ay: 'Dorso de la anteportada: nombre de la colección, director, otros títulos del autor.' },
    { id: 'portada', t: 'Portada', grupo: 'pre', pags: 1, ini: 'recto', on: true, ay: 'Título, autor, editorial y logo, completos. Siempre en recto.' },
    { id: 'derechos', t: 'Página de derechos (copyright)', grupo: 'pre', pags: 1, ini: 'verso', on: true, ay: 'Dorso de la portada: ©, ISBN, depósito legal, créditos de edición, diseño y corrección, datos de imprenta.' },
    { id: 'dedicatoria', t: 'Dedicatoria', grupo: 'pre', pags: 1, ini: 'recto', on: false, ay: 'Una página impar, con su dorso en blanco.' },
    { id: 'epigrafe', t: 'Epígrafe', grupo: 'pre', pags: 1, ini: 'recto', on: false, ay: 'Cita breve que abre la obra. Una página impar.' },
    { id: 'indice', t: 'Índice (al principio)', grupo: 'pre', pags: 2, ini: 'recto', on: true, ay: 'Tabla de contenidos. En libros en español suele ir al final; marcá solo uno de los dos.' },
    { id: 'agradec', t: 'Agradecimientos', grupo: 'pre', pags: 1, ini: 'recto', on: false, ay: 'Puede ir acá o al final del libro.' },
    { id: 'prologo', t: 'Prólogo', grupo: 'pre', pags: 4, ini: 'recto', on: false, ay: 'Texto de otra persona que presenta la obra. Abre en recto.' },
    { id: 'intro', t: 'Introducción', grupo: 'pre', pags: 6, ini: 'recto', on: false, ay: 'Texto del autor que presenta la obra. Abre en recto.' },
    { id: 'cuerpo', t: 'Cuerpo de la obra (capítulos)', grupo: 'cue', pags: 0, ini: 'recto', on: true, fija: true, ay: 'El texto principal. Sus páginas salen de lo que cargues arriba; cada capítulo puede abrir en recto.' },
    { id: 'epilogo', t: 'Epílogo', grupo: 'fin', pags: 3, ini: 'recto', on: false, ay: 'Cierre del texto, después del último capítulo.' },
    { id: 'apendice', t: 'Apéndices o anexos', grupo: 'fin', pags: 6, ini: 'recto', on: false, ay: 'Material complementario que no entra en el cuerpo.' },
    { id: 'notas', t: 'Notas', grupo: 'fin', pags: 8, ini: 'recto', on: false, ay: 'Notas agrupadas al final (en vez de al pie).' },
    { id: 'glosario', t: 'Glosario', grupo: 'fin', pags: 4, ini: 'recto', on: false, ay: 'Lista de términos con su definición.' },
    { id: 'biblio', t: 'Bibliografía', grupo: 'fin', pags: 6, ini: 'recto', on: false, ay: 'Las obras citadas, en recto.' },
    { id: 'indiceanal', t: 'Índice analítico u onomástico', grupo: 'fin', pags: 6, ini: 'recto', on: false, ay: 'Términos o nombres con su página.' },
    { id: 'indicefin', t: 'Índice (al final)', grupo: 'fin', pags: 2, ini: 'recto', on: false, ay: 'Tabla de contenidos al final, como en muchos libros en español. Marcá solo uno de los dos.' },
    { id: 'catalogo', t: 'Catálogo u otros títulos', grupo: 'fin', pags: 2, ini: 'recto', on: false, ay: 'Publicidad de la editorial.' },
    { id: 'colofon', t: 'Colofón', grupo: 'fin', pags: 1, ini: 'sigue', on: true, ay: 'Datos de impresión: imprenta, fecha, tirada, tipografías y papel. Va en la última página impresa, en recto o verso.' }
  ];
  const MULTIPLOS = [8, 16, 32, 64];
  const INI = { recto: 'recto (impar)', verso: 'verso (par)', sigue: 'a continuación' };

  // Valores de ejemplo: una novela de 200 páginas de texto en 10 capítulos.
  const EJEMPLO = { paginas: '200', caracteres: '', porPagina: '', capitulos: '10', capRecto: '1', capPortada: '0', multiplo: '16', partes: {
    anteportada: { on: true }, portada: { on: true }, derechos: { on: true }, dedicatoria: { on: true }, indice: { on: true }, agradec: { on: true },
    biblio: { on: false }, colofon: { on: true } } };

  // Estado de una parte: lo que cargó la persona o el valor por defecto.
  function estado(d, p) {
    const e = (d.partes || {})[p.id] || {};
    const pags = e.pags != null && String(e.pags).trim() !== '' ? Math.max(0, Math.round(n(e.pags))) : p.pags;
    return { on: e.on == null ? p.on : !!e.on, pags, ini: ['recto', 'verso', 'sigue'].indexOf(e.ini) >= 0 ? e.ini : p.ini };
  }

  // Páginas del texto: las que se cargaron o, si no, caracteres ÷ caracteres por página (redondeado hacia arriba).
  function paginasTexto(d) {
    const p = Math.round(n(d.paginas));
    if (p > 0) return { pags: p, desde: 'paginas' };
    const c = n(d.caracteres), cp = n(d.porPagina);
    return c > 0 && cp > 0 ? { pags: Math.ceil(c / cp), desde: 'caracteres' } : { pags: 0, desde: '' };
  }

  // Reparte las páginas del texto entre los capítulos: los primeros se quedan con el resto.
  const repartir = (total, k) => Array.from({ length: k }, (_, i) => Math.floor(total / k) + (i < total % k ? 1 : 0));

  // Arma la paginación: lista de tramos {t, id, grupo, desde, hasta, pags} y de páginas {n, id|null}.
  function armar(d) {
    const texto = paginasTexto(d), caps = Math.max(1, Math.min(60, Math.round(n(d.capitulos)) || 1));
    const multiplo = MULTIPLOS.indexOf(Math.round(n(d.multiplo))) >= 0 ? Math.round(n(d.multiplo)) : 16;
    const paginas = [], tramos = [];
    let sig = 1, enBlanco = 0;
    const blanca = () => { paginas.push({ n: sig++, id: null }); enBlanco++; };
    const poner = (t, id, grupo, k, ini, extra) => {
      if (k <= 0) return;
      if (ini === 'recto' && sig % 2 === 0) blanca();
      if (ini === 'verso' && sig % 2 === 1) blanca();
      const desde = sig;
      for (let i = 0; i < k; i++) paginas.push({ n: sig++, id });
      tramos.push(Object.assign({ t, id, grupo, desde, hasta: sig - 1, pags: k }, extra || {}));
    };
    PARTES.forEach(p => {
      const e = estado(d, p);
      if (!e.on) return;
      if (p.id !== 'cuerpo') { poner(p.t, p.id, p.grupo, e.pags, e.ini); return; }
      if (!texto.pags) return;
      const k = Math.min(caps, texto.pags), porCap = repartir(texto.pags, k), recto = d.capRecto !== '0' && d.capRecto !== 0, port = d.capPortada === '1' || d.capPortada === 1;
      porCap.forEach((c, i) => {
        if (port) poner(`Capítulo ${i + 1}: portadilla`, 'cuerpo', 'cue', 1, 'recto', { cap: i + 1, portadilla: true });
        poner(`Capítulo ${i + 1}`, 'cuerpo', 'cue', c, recto || port ? 'recto' : 'sigue', { cap: i + 1 });
      });
    });
    const contenido = sig - 1 - enBlanco;
    // Final: par, y múltiplo del pliego. Las que faltan son blancas (se pueden usar para lo que haga falta).
    const minimo = sig - 1;
    const total = minimo === 0 ? 0 : Math.ceil(minimo / multiplo) * multiplo;
    const blancasFinal = total - minimo;
    while (sig <= total) blanca();
    return { tramos, paginas, texto, capitulos: Math.min(caps, texto.pags || caps), multiplo, contenido, blancasEntre: enBlanco - blancasFinal, blancasFinal,
      minimo, total, hojas: total / 2, cuadernillos: total ? cuadernillos(total, multiplo) : { lista: [], resto: 0 },
      libres: blancasFinal };
  }

  // Cuadernillos del pliego elegido: total ÷ múltiplo (el múltiplo ya es un divisor del total).
  const cuadernillos = (total, m) => ({ lista: [{ paginas: m, cantidad: total / m }], resto: 0 });

  return { armar, estado, paginasTexto, PARTES, MULTIPLOS, INI, EJEMPLO, n };
})();
