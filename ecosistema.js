// Ecosistema del libro (IAE, 0902): los actores como nodos de un grafo. Solo datos y cuentas chicas; la vista está en app.js.
// Base: Rivera Mir, «Ecosistema» (actores, prácticas e institucionalidad), y el temario de Introducción a la Actividad Editorial
// (Edición, FFyL, UBA). Los vínculos son un esquema para estudiar, no un mapa exhaustivo: cada mercado tiene sus variantes.
const Ecosistema = (() => {
  // Cada categoría tiene un color (--eco1…--eco7 en estilos.css) y una banda del mapa.
  const CATEGORIAS = [
    { id: 'creacion', t: 'Creación', n: 1 },
    { id: 'edicion', t: 'Edición', n: 2 },
    { id: 'produccion', t: 'Producción', n: 3 },
    { id: 'circulacion', t: 'Circulación', n: 4 },
    { id: 'mediacion', t: 'Mediación y promoción', n: 5 },
    { id: 'formacion', t: 'Formación de lectores', n: 6 },
    { id: 'instituciones', t: 'Instituciones y regulación', n: 7 }
  ];
  // x, y sobre un lienzo de 920 × 700. u: dónde se ve en el temario. pista: para el modo práctica (sin decir el nombre).
  const ACTORES = [
    { id: 'autor', t: 'Autor', ico: '✍️', cat: 'creacion', x: 70, y: 380, u: '1.3',
      d: 'Escribe la obra. Es una figura intelectual y, a la vez, la contraparte contractual del editor: cede los derechos de edición y cobra por ellos (regalías).',
      pista: 'Firma el contrato de edición como contraparte del editor y cobra regalías por la obra.' },
    { id: 'agente', t: 'Agente literario', ico: '🤝', cat: 'creacion', x: 70, y: 255, u: '1.3',
      d: 'Intermediario cultural: representa al autor, negocia los contratos y vende derechos (a otras editoriales, otros países, el cine).',
      pista: 'Intermediario que representa al autor y negocia la cesión de derechos con las editoriales.' },
    { id: 'traductor', t: 'Traductor', ico: '🌐', cat: 'creacion', x: 70, y: 500, u: '1.3',
      d: 'Pasa la obra a otra lengua. Es autor de la versión traducida y trabaja por encargo de la editorial, que además negocia los derechos de la obra original.',
      pista: 'Trabaja por encargo para que una obra de otra lengua llegue al catálogo.' },
    { id: 'ilustrador', t: 'Ilustrador', ico: '🎨', cat: 'creacion', x: 70, y: 610, u: '1.3',
      d: 'Crea las imágenes del libro (tapa e interiores). Es clave en libros infantiles, de arte y de divulgación; se contrata por encargo.',
      pista: 'Crea las imágenes de un libro infantil o de arte por encargo de la editorial.' },
    { id: 'dircol', t: 'Director de colección', ico: '🧭', cat: 'edicion', x: 250, y: 255, u: '1.3 · 2.2',
      d: 'Define la línea y el perfil de una colección dentro del catálogo: qué títulos entran, en qué orden y con qué identidad.',
      pista: 'Define la línea y los títulos de una colección dentro del catálogo.' },
    { id: 'editor', t: 'Editor / editorial', ico: '📚', cat: 'edicion', x: 250, y: 380, r: 34, u: '1.3 · 2.1',
      d: 'Es el centro del proceso: elige qué publicar (catálogo y plan editorial), contrata a todo el equipo, financia la producción y decide cómo se vende. Está entre el polo cultural y el comercial.',
      pista: 'Elige qué publicar, financia la producción y articula las lógicas editorial, comercial, financiera e industrial.' },
    { id: 'corrector', t: 'Corrector', ico: '🔍', cat: 'edicion', x: 250, y: 500, u: '1.3',
      d: 'Revisa el texto: ortografía, gramática, estilo y coherencia, según la hoja de estilo de la editorial. Es una figura de la formación profesional.',
      pista: 'Revisa ortografía, estilo y coherencia del texto antes de que pase a diseño.' },
    { id: 'disenador', t: 'Diseñador y diagramador', ico: '📐', cat: 'edicion', x: 250, y: 610, u: '1.3',
      d: 'El diseñador piensa la identidad visual (tapa, tipografías, colección); el diagramador arma las páginas y deja los archivos listos para imprimir.',
      pista: 'Arma las páginas y la tapa y entrega los archivos listos para imprimir.' },
    { id: 'papelera', t: 'Productor de papel', ico: '🧻', cat: 'produccion', x: 440, y: 290, u: '1.3 · 2.3',
      d: 'Fabrica o provee el papel. Su costo y la disponibilidad (por ejemplo, las leyes de importación) condicionan cuántas editoriales y periódicos pueden existir.',
      pista: 'Provee el insumo cuyo precio e importación condiciona la multiplicación de editoriales.' },
    { id: 'imprenta', t: 'Impresor / imprenta', ico: '🖨️', cat: 'produccion', x: 440, y: 440, u: '1.3 · 2.3',
      d: 'Forma parte de los actores de la reproducción industrial: imprime y encuaderna la tirada que le encarga el editor. Incluye a tipógrafos y obreros gráficos.',
      pista: 'Imprime y encuaderna la tirada que le encarga la editorial.' },
    { id: 'distribuidor', t: 'Distribuidor', ico: '🚚', cat: 'circulacion', x: 640, y: 310, u: '3.1',
      d: 'Lleva los libros de la editorial a las librerías y otros puntos de venta, a cambio de un porcentaje del precio. Entre editor, distribuidor y librero hay afinidades y conflictos.',
      pista: 'Intermedia entre la editorial y las librerías y se queda con un porcentaje del precio de tapa.' },
    { id: 'librero', t: 'Librero', ico: '🏪', cat: 'circulacion', x: 640, y: 420, u: '3.1',
      d: 'Vende al lector y también recomienda, selecciona y arma una oferta. Trabaja con descuento sobre el precio de tapa. La ley de precio único busca protegerlo de la competencia de las grandes superficies.',
      pista: 'Vende al lector, selecciona qué mostrar y se beneficiaría de una ley de precio único.' },
    { id: 'superficies', t: 'Grandes superficies y kioscos', ico: '🛒', cat: 'circulacion', x: 640, y: 530, u: '3.1',
      d: 'Canales no tradicionales de venta: hipermercados, cadenas y puestos de periódicos. Mueven volumen, sobre todo de best sellers y fascículos.',
      pista: 'Canal no tradicional: puestos de diarios e hipermercados que venden libros.' },
    { id: 'plataformas', t: 'Plataformas digitales', ico: '📱', cat: 'circulacion', x: 640, y: 640, u: '3.1 · 5.3',
      d: 'Nuevos actores del comercio digital: tiendas en línea y de e-books, que cambian la cadena de valor, las fronteras y los territorios del mercado.',
      pista: 'Nuevo actor del comercio digital que vende e-books y cambia la cadena de valor.' },
    { id: 'lector', t: 'Lector', ico: '📖', cat: 'formacion', x: 850, y: 400, r: 34, u: '1.1',
      d: 'Es el destino y también parte activa: con sus prácticas (leer, prestar, comprar, recomendar) define límites y condiciones del ecosistema. La masificación del libro amplió el lectorado.',
      pista: 'Destinatario de todo el circuito; sus prácticas (leer, prestar, recomendar) también moldean el ecosistema.' },
    { id: 'critica', t: 'Crítica y prensa', ico: '📰', cat: 'mediacion', x: 130, y: 60, u: '3.3',
      d: 'Suplementos literarios, revistas especializadas y medios masivos: reseñan, difunden y legitiman los libros. Es una de las vías clásicas de la promoción.',
      pista: 'Reseña y legitima libros en suplementos literarios y revistas especializadas.' },
    { id: 'premios', t: 'Premios', ico: '🏆', cat: 'mediacion', x: 330, y: 60, u: '3.3',
      d: 'Consagran autores y obras y empujan ventas. Pueden ser estatales, de fundaciones o de las propias editoriales.',
      pista: 'Consagra obras y autores y empuja las ventas.' },
    { id: 'ferias', t: 'Ferias y festivales', ico: '🎪', cat: 'mediacion', x: 530, y: 60, u: '3.3 · 4.1',
      d: 'Encuentro de editores, libreros, autores y lectores. Las ferias profesionales también son el lugar del mercado de derechos y de las relaciones internacionales del sector.',
      pista: 'Reúne a editores, libreros y lectores, y es el lugar donde se compran y venden derechos.' },
    { id: 'redes', t: 'Blogs y redes', ico: '💬', cat: 'mediacion', x: 730, y: 60, u: '3.3',
      d: 'Blogs, redes sociales y estrategias de internet para promocionar libros y autores. Cambian quién recomienda y cómo se arma la comunidad lectora.',
      pista: 'Espacios digitales donde se promociona a autores y se recomiendan libros.' },
    { id: 'escuela', t: 'Escuela', ico: '🏫', cat: 'formacion', x: 330, y: 160, u: '4.2',
      d: 'Forma lectores. La obligatoriedad de la educación y las compras estatales de libros de texto marcaron la historia del mercado.',
      pista: 'Forma lectores y es destino de las compras estatales de libros de texto.' },
    { id: 'bibliotecas', t: 'Bibliotecas', ico: '🏛️', cat: 'formacion', x: 530, y: 160, u: '3.1 · 4.2',
      d: 'Red no comercial de distribución: dan acceso al libro por préstamo. Las hay estatales, populares y militantes («bibliotecas rojas»). Los bibliotecarios son actores del ecosistema.',
      pista: 'Red no comercial que da acceso al libro por préstamo.' },
    { id: 'promotores', t: 'Promotores de lectura', ico: '🔥', cat: 'formacion', x: 730, y: 160, u: '4.2',
      d: 'Trabajan para formar lectores fuera de la escuela: talleres, clubes, campañas. Muchas veces dependen de políticas públicas de promoción.',
      pista: 'Impulsa la lectura con talleres, clubes y campañas, a menudo desde políticas públicas.' },
    { id: 'estado', t: 'Estado', ico: '⚖️', cat: 'instituciones', x: 150, y: 690, u: '4.2',
      d: 'Regula y fomenta: leyes de derecho de autor, de precio único y de fomento del libro, exenciones fiscales, compras de libros, bibliotecas públicas, premios y ferias. Puede ser también «Estado editor».',
      pista: 'Con leyes y compras públicas (libros de texto, bibliotecas) regula y fomenta el sector; a veces edita.' },
    { id: 'camaras', t: 'Cámaras del libro', ico: '🏢', cat: 'instituciones', x: 330, y: 690, u: '4.1',
      d: 'Organizaciones empresariales que representan a editores, distribuidores o libreros ante el Estado y el público. En la Argentina, la Cámara Argentina del Libro.',
      pista: 'Organización empresarial que representa al sector ante el Estado (en la Argentina, la CAL).' },
    { id: 'derechos', t: 'Gestión de derechos', ico: '©️', cat: 'instituciones', x: 530, y: 690, u: '4.1 · 4.2',
      d: 'Entidades y sociedades de autores y editores que administran derechos, por ejemplo los de reprografía (fotocopias). En el temario: reprografía, ilegalidad frente a legitimidad.',
      pista: 'Administra derechos colectivos, como los de reprografía, de autores y editores.' },
    { id: 'cerlalc', t: 'Organismos regionales', ico: '🌎', cat: 'instituciones', x: 730, y: 690, u: '4.1',
      d: 'Instituciones como el Cerlalc (Centro Regional para el Fomento del Libro en América Latina y el Caribe) producen estudios y coordinan políticas del libro y la lectura. Muestran la escala continental del ecosistema.',
      pista: 'Organismo que estudia y coordina políticas del libro y la lectura en América Latina y el Caribe.' },
    { id: 'sociedad', t: 'Sociedad civil', ico: '✊', cat: 'instituciones', x: 850, y: 580, u: '4.1',
      d: 'Partidos, ONG y grupos organizados que crean sus propias instituciones del libro: librerías anarquistas, bibliotecas rojas, imprentas militantes, editoriales independientes.',
      pista: 'Grupos organizados que crean sus propias librerías, bibliotecas e imprentas militantes.' }
  ];
  // Disposición vertical para pantallas angostas (celular): el libro baja de la creación al lector y alrededor quedan el resto de los actores.
  const MOVIL = {
    agente: [55, 70], autor: [150, 70], traductor: [250, 70], ilustrador: [345, 70],
    dircol: [50, 185], editor: [160, 185], corrector: [265, 185], disenador: [350, 185],
    papelera: [110, 310], imprenta: [290, 310],
    distribuidor: [55, 425], librero: [150, 425], superficies: [250, 425], plataformas: [345, 425],
    lector: [200, 545],
    critica: [55, 665], premios: [150, 665], ferias: [250, 665], redes: [345, 665],
    escuela: [80, 780], bibliotecas: [200, 780], promotores: [320, 780],
    estado: [55, 895], camaras: [150, 895], derechos: [250, 895], cerlalc: [345, 895], sociedad: [200, 985]
  };
  ACTORES.forEach(a => { a.m = MOVIL[a.id]; });
  // a → b. tipo: cadena (el libro avanza), trabajo (encargo o representación), mediacion, regula (norma, apoyo y fomento).
  const R = (a, b, tipo, t, dir = true) => ({ a, b, tipo, t, dir });
  const RELACIONES = [
    R('agente', 'autor', 'trabajo', 'representa al autor', false),
    R('agente', 'editor', 'trabajo', 'negocia derechos con', false),
    R('autor', 'editor', 'cadena', 'cede derechos de edición (contrato)'),
    R('editor', 'dircol', 'trabajo', 'organiza su catálogo en colecciones con', false),
    R('editor', 'traductor', 'trabajo', 'encarga la traducción'),
    R('editor', 'ilustrador', 'trabajo', 'encarga las imágenes'),
    R('editor', 'corrector', 'trabajo', 'encarga la corrección'),
    R('editor', 'disenador', 'trabajo', 'encarga el diseño y la diagramación'),
    R('papelera', 'imprenta', 'cadena', 'provee el papel'),
    R('editor', 'imprenta', 'cadena', 'encarga la impresión de la tirada'),
    R('imprenta', 'distribuidor', 'cadena', 'entrega los ejemplares para distribuir'),
    R('editor', 'distribuidor', 'cadena', 'contrata la distribución'),
    R('distribuidor', 'librero', 'cadena', 'provee los libros (con descuento)'),
    R('distribuidor', 'superficies', 'cadena', 'provee los libros'),
    R('editor', 'plataformas', 'cadena', 'vende e-books y contenidos digitales'),
    R('librero', 'lector', 'cadena', 'vende y recomienda'),
    R('superficies', 'lector', 'cadena', 'vende'),
    R('plataformas', 'lector', 'cadena', 'vende y entrega en pantalla o a domicilio'),
    R('editor', 'critica', 'mediacion', 'envía ejemplares de prensa'),
    R('critica', 'lector', 'mediacion', 'orienta y legitima'),
    R('premios', 'autor', 'mediacion', 'consagra'),
    R('premios', 'lector', 'mediacion', 'orienta las compras'),
    R('ferias', 'editor', 'mediacion', 'reúne y abre el mercado de derechos', false),
    R('ferias', 'librero', 'mediacion', 'reúne', false),
    R('ferias', 'lector', 'mediacion', 'acerca al público', false),
    R('ferias', 'agente', 'mediacion', 'espacio de negociación', false),
    R('redes', 'lector', 'mediacion', 'recomiendan'),
    R('redes', 'autor', 'mediacion', 'difunden y acercan al autor', false),
    R('escuela', 'lector', 'mediacion', 'forma lectores'),
    R('bibliotecas', 'lector', 'mediacion', 'da acceso por préstamo'),
    R('promotores', 'lector', 'mediacion', 'impulsa la lectura'),
    R('editor', 'bibliotecas', 'cadena', 'vende y dona ejemplares'),
    R('estado', 'editor', 'regula', 'regula y fomenta (leyes, compras, subsidios)'),
    R('estado', 'librero', 'regula', 'regula (precio único) y apoya'),
    R('estado', 'escuela', 'regula', 'compra libros de texto y sostiene'),
    R('estado', 'bibliotecas', 'regula', 'sostiene bibliotecas públicas'),
    R('estado', 'promotores', 'regula', 'financia planes de lectura'),
    R('estado', 'papelera', 'regula', 'legisla importación e impuestos del papel'),
    R('camaras', 'editor', 'regula', 'representa y agrupa', false),
    R('camaras', 'estado', 'regula', 'interlocutor ante el Estado', false),
    R('camaras', 'ferias', 'regula', 'organiza ferias', false),
    R('derechos', 'autor', 'regula', 'administra derechos de', false),
    R('derechos', 'editor', 'regula', 'administra derechos de', false),
    R('cerlalc', 'estado', 'regula', 'estudia y asesora políticas', false),
    R('sociedad', 'bibliotecas', 'regula', 'crea bibliotecas populares y militantes'),
    R('sociedad', 'imprenta', 'regula', 'sostiene imprentas militantes'),
    R('sociedad', 'librero', 'regula', 'sostiene librerías propias')
  ];
  const TIPOS = {
    cadena: { t: 'El libro avanza', ay: 'Contrato, producción y venta: lo que recorre el libro desde el autor hasta el lector.' },
    trabajo: { t: 'Encargo o representación', ay: 'Quién contrata o representa a quién dentro de la edición.' },
    mediacion: { t: 'Mediación y promoción', ay: 'Quién orienta, legitima, recomienda o forma al lector.' },
    regula: { t: 'Norma, apoyo y fomento', ay: 'Leyes, compras, entidades gremiales y organizaciones que sostienen o regulan el sector.' }
  };
  // «Seguir un libro»: cada paso ilumina actores y cuenta qué pasa. Orden de la cadena de la Unidad 1 a la 4.
  const RECORRIDO = [
    { t: 'Nace el texto', ids: ['autor', 'agente'], txt: 'El autor escribe la obra. Si tiene un agente literario, este lo representa y ofrece el texto a las editoriales.' },
    { t: 'El editor decide', ids: ['autor', 'editor', 'dircol'], txt: 'El editor elige qué publicar según su catálogo y su plan editorial (a veces con un director de colección) y firma el contrato de edición: el autor cede derechos y cobra regalías.' },
    { t: 'Se arma el libro', ids: ['editor', 'traductor', 'ilustrador', 'corrector', 'disenador'], txt: 'La editorial encarga traducción, corrección, ilustración y diseño. Todo ese trabajo es la preproducción: costos fijos del título.' },
    { t: 'Se imprime', ids: ['editor', 'papelera', 'imprenta'], txt: 'El editor encarga la tirada a la imprenta, que consigue el papel. Acá aparece el aspecto industrial del libro: producirlo cuesta antes de vender un solo ejemplar.' },
    { t: 'Se distribuye', ids: ['imprenta', 'editor', 'distribuidor'], txt: 'La distribuidora lleva los ejemplares a los puntos de venta y se queda con un porcentaje del precio de tapa. Entre editor y distribuidor se negocian plazos, descuentos y consignaciones.' },
    { t: 'Se vende', ids: ['distribuidor', 'librero', 'superficies', 'plataformas'], txt: 'El libro llega a la librería, a las grandes superficies y kioscos o a las plataformas digitales. Cada canal tiene su descuento y su público.' },
    { t: 'Se lo da a conocer', ids: ['editor', 'critica', 'premios', 'ferias', 'redes'], txt: 'Prensa, premios, ferias y redes difunden el libro y lo legitiman. En las ferias profesionales, además, se compran y venden derechos.' },
    { t: 'Llega al lector', ids: ['librero', 'bibliotecas', 'escuela', 'promotores', 'lector'], txt: 'El lector lo compra, lo pide prestado a una biblioteca o lo recibe en la escuela. Promotores y docentes forman lectores: sin ellos la cadena no cierra.' },
    { t: 'El marco que lo sostiene', ids: ['estado', 'camaras', 'derechos', 'cerlalc', 'sociedad'], txt: 'Leyes, compras públicas, cámaras, entidades de derechos, organismos regionales y organizaciones civiles regulan o impulsan todo lo anterior. Mirado en conjunto, es un ecosistema: lo amenazan la monopolización y la homogeneización, y por eso se defiende la bibliodiversidad.' }
  ];
  const por = id => ACTORES.find(a => a.id === id);
  // Vínculos de un actor: [{con, t, tipo, sale}] (sale: el actor es el origen de la flecha)
  function vecinos(id) {
    return RELACIONES.filter(r => r.a === id || r.b === id).map(r => (
      { con: r.a === id ? r.b : r.a, t: r.t, tipo: r.tipo, sale: r.a === id, dir: r.dir }));
  }
  // Frase de un vínculo, leída desde el actor elegido.
  function frase(id, v) {
    const otro = por(v.con).t;
    if (!v.dir) return `${otro}: ${v.t}`;
    return v.sale ? `→ ${otro}: ${v.t}` : `← ${otro}: ${v.t}`;
  }
  // Orden fijo y mezclado de la práctica (determinístico por semilla, así se puede probar).
  function cola(semilla) {
    const ids = ACTORES.map(a => a.id); let s = semilla || 7;
    for (let i = ids.length - 1; i > 0; i--) { s = (s * 1103515245 + 12345) % 2147483648; const j = s % (i + 1); [ids[i], ids[j]] = [ids[j], ids[i]]; }
    return ids;
  }
  return { CATEGORIAS, ACTORES, RELACIONES, TIPOS, RECORRIDO, por, vecinos, frase, cola, W: 920, H: 750, WM: 400, HM: 1050, PAD: 16 };
})();
