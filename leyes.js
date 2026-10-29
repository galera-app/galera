// Visualizador de leyes (DEA, 0919): jerarquía de normas y traductor jurídico a castellano común.
// Sin DOM: lo usa app.js y lo prueba probar.py. Fichas y definiciones propias, sin copiar texto de ley.
// BORRADOR a revisar por Fidel: solo entran normas cuya ficha de InfoLEG se abrió y coincide (investigacion/03-leyes.md);
// los artículos clave están solo donde el programa de la cátedra los confirma.
const Leyes = (() => {
  const INFOLEG = 'https://servicios.infoleg.gob.ar/infolegInternet/verNorma.do?id=';

  // Niveles de la pirámide, de arriba (manda) a abajo.
  const NIVELES = [
    { n: 1, t: 'Constitución Nacional', d: 'Está en la cima. Ninguna otra norma puede contradecirla (arts. 17, 19, 43 y 75 inc. 19 y 22).' },
    { n: 2, t: 'Tratados internacionales', d: 'Tienen jerarquía superior a las leyes (art. 75 inc. 22). Se incorporan con una ley que los aprueba.' },
    { n: 3, t: 'Leyes nacionales', d: 'Las dicta el Congreso. Una ley posterior puede modificar a otra de su mismo nivel.' },
    { n: 4, t: 'Decretos', d: 'Los dicta el Poder Ejecutivo. Reglamentan una ley y no pueden ir más allá de lo que ella dice.' },
    { n: 5, t: 'Disposiciones y resoluciones', d: 'Las dictan organismos como la Dirección Nacional del Derecho de Autor. Detallan trámites; no pueden contradecir al decreto ni a la ley.' }
  ];

  // id, nivel, nombre corto, título, qué regula, a quién sirve, artículos clave (solo confirmados), de qué depende, id de InfoLEG.
  const NORMAS = [
    { id: 'cn', nivel: 1, t: 'Constitución Nacional', anio: '1853, reforma de 1994', regula: 'Reconoce al autor como propietario exclusivo de su obra por el plazo que fije la ley (art. 17), la privacidad (art. 19), el habeas data (art. 43) y da rango superior a los tratados (art. 75 inc. 22).', sirve: 'todos', arts: 'Arts. 17, 19, 43 y 75 inc. 19 y 22 (primer párrafo).', infoleg: 804, nota: 'El link es el texto ordenado de la Ley 24.430.' },
    { id: 'l25140', nivel: 2, t: 'Ley 25.140 · Ley aprobatoria de Berna, WCT y WPPT', anio: '1999', regula: 'Aprueba los artículos 1 a 21 y el anexo del Convenio de Berna y los dos tratados de internet de la OMPI (WCT y WPPT). Es la puerta por la que entran al derecho argentino.', sirve: 'todos', arts: '', infoleg: 60144, depende: 'cn' },
    { id: 'berna', nivel: 2, t: 'Convenio de Berna (1886, Acta de París 1971)', anio: '1886; Argentina, arts. 1 a 21 en 1999', regula: 'Protege las obras literarias y artísticas entre los países miembros. Se apoya en el trato nacional (a la obra extranjera se la protege como a la propia) y en que la protección no exige trámite de registro. Los arts. 22 a 38 (cuestiones administrativas) los había aprobado antes la Ley 22.195 (1980).', sirve: 'autor, editor', arts: 'Arts. 1 a 21 y anexo (aprobados por la Ley 25.140).', infoleg: 60144, depende: 'l25140' },
    { id: 'wct', nivel: 2, t: 'Tratado de la OMPI sobre Derecho de Autor (WCT, 1996)', anio: '1996; Argentina, 1999', regula: 'Actualiza Berna para el entorno digital: protege los programas de computación y las bases de datos como obras y reconoce el derecho de poner la obra a disposición del público por internet.', sirve: 'autor, editor', arts: '', infoleg: 60144, depende: 'l25140' },
    { id: 'wppt', nivel: 2, t: 'Tratado de la OMPI sobre Interpretación o Ejecución y Fonogramas (WPPT, 1996)', anio: '1996; Argentina, 1999', regula: 'Protege a los intérpretes y a los productores de fonogramas en el entorno digital. Para un libro importa sobre todo en el audiolibro: la lectura grabada tiene derechos propios.', sirve: 'editor, autor', arts: '', infoleg: 60144, depende: 'l25140' },
    { id: 'l11723', nivel: 3, t: 'Ley 11.723 · Propiedad intelectual', anio: '1933', regula: 'La ley central del derecho de autor: qué obras se protegen, el contrato de edición, el registro, el depósito legal y las sanciones.', sirve: 'todos', arts: 'Art. 31 (retrato), arts. 37 a 44 (contrato de edición; el 40 fija el número de ediciones, los ejemplares y la retribución), art. 57 (depósito legal), art. 61 (registro) y art. 62 (obras inéditas).', infoleg: 42755, depende: 'cn' },
    { id: 'l25036', nivel: 3, t: 'Ley 25.036 · Software', anio: '1998', regula: 'Modifica la 11.723 para proteger los programas de computación como obras.', sirve: 'autor', arts: 'Modifica los arts. 1, 4, 9 y 57 e incorpora el 55 bis.', infoleg: 54178, depende: 'l11723' },
    { id: 'l26570', nivel: 3, t: 'Ley 26.570 · Art. 5 bis', anio: '2009', regula: 'Incorpora el artículo 5 bis a la 11.723.', sirve: 'autor, editor', arts: 'Art. 5 bis.', infoleg: 161455, depende: 'l11723' },
    { id: 'l27588', nivel: 3, t: 'Ley 27.588 · Art. 36', anio: '2020', regula: 'Sustituye el artículo 36 de la 11.723 e incorpora los arts. 36 bis a 36 quinquies (excepciones para personas con discapacidades sensoriales).', sirve: 'autor, editor', arts: 'Arts. 36 y 36 bis a 36 quinquies.', infoleg: 345237, depende: 'l11723' },
    { id: 'l22399', nivel: 3, t: 'Ley 22.399 · ISBN', anio: '1981', regula: 'Hace obligatorio el ISBN en los libros que se editan en el país.', sirve: 'editor', arts: '', infoleg: 217687 },
    { id: 'l25446', nivel: 3, t: 'Ley 25.446 · Fomento del Libro y la Lectura', anio: '2001', regula: 'Política pública del libro y la lectura. La completan su decreto reglamentario y otras normas vinculadas.', sirve: 'editor, estudiante', arts: '', infoleg: 68006 },
    { id: 'l25326', nivel: 3, t: 'Ley 25.326 · Datos personales', anio: '2000', regula: 'Protege los datos personales y reglamenta el habeas data (privacidad).', sirve: 'editor, autor', arts: '', infoleg: 64790, depende: 'cn' },
    { id: 'ccyc', nivel: 3, t: 'Código Civil y Comercial (Ley 26.994)', anio: '2014, texto según Ley 27.077', regula: 'Derechos personalísimos (imagen, honor) y contratos en general. Reemplaza al viejo art. 1071 bis.', sirve: 'todos', arts: '', infoleg: 235975, depende: 'cn' },
    { id: 'd41223', nivel: 4, t: 'Decreto 41.223/1934', anio: '1934', regula: 'Reglamenta la Ley 11.723.', sirve: 'editor, autor', arts: '', infoleg: 180781, depende: 'l11723' },
    { id: 'd16697', nivel: 4, t: 'Decreto 16.697/1959', anio: '1959', regula: 'Declaración jurada mensual de las obras editadas (art. 61 de la 11.723).', sirve: 'editor', arts: '', infoleg: 85124, depende: 'l11723' },
    { id: 'd972', nivel: 4, t: 'Decreto 972/2024', anio: '2024', regula: 'Obras inéditas: depósito en custodia (art. 62 in fine de la 11.723). Deroga decretos anteriores y la Disp. DNDA 6/2019.', sirve: 'autor', arts: '', infoleg: 405907, depende: 'l11723' },
    { id: 'dnda14', nivel: 5, t: 'Disposición DNDA E 14/2017', anio: '2017', regula: 'Depósito legal (art. 57): reimpresiones con el mismo ISBN ante una intimación. No regula la asignación del ISBN.', sirve: 'editor', arts: '', infoleg: 302970, depende: 'l11723' }
  ];

  // Términos del traductor: norma = id de NORMAS donde aparece (opcional).
  const TERMINOS = [
    { t: 'Obra', simple: 'Una creación intelectual original expresada de alguna forma (un texto, una ilustración, una foto, un programa).', ej: 'El manuscrito de una novela es una obra apenas existe, aunque no esté publicada.', norma: 'l11723' },
    { t: 'Autor', simple: 'La persona que crea la obra. Es quien nace con los derechos sobre ella.', ej: 'La traductora es autora de su traducción, y el escritor, del original.', norma: 'l11723' },
    { t: 'Titular de derechos', simple: 'Quien tiene hoy los derechos de explotación de la obra. Puede ser el autor o alguien a quien se los cedió.', ej: 'Si el autor cedió sus derechos a una editorial, la editorial es la titular para esa explotación.', norma: 'l11723' },
    { t: 'Derecho moral', simple: 'El lazo personal del autor con su obra: que se lo reconozca como autor y que no se la deforme. Es de la persona y no se negocia como una mercadería.', ej: 'Cambiar el final de una novela sin consultar al autor toca su derecho moral.', norma: 'l11723' },
    { t: 'Derecho patrimonial', simple: 'El derecho a explotar la obra económicamente: reproducirla, venderla, traducirla, adaptarla.', ej: 'Imprimir y vender mil ejemplares es explotar el derecho patrimonial.', norma: 'l11723' },
    { t: 'Reproducción', simple: 'Hacer copias de una obra, en papel o en digital.', ej: 'Imprimir una tirada o subir el PDF a una tienda son reproducciones.', norma: 'l11723' },
    { t: 'Distribución', simple: 'Poner los ejemplares de la obra en circulación: venderlos o hacerlos llegar a las librerías.', ej: 'La distribuidora lleva el libro de la editorial a las librerías.' },
    { t: 'Cesión', simple: 'Cuando el titular transfiere a otro sus derechos de explotación, por contrato. Quien cede deja de tenerlos en lo cedido.', ej: 'El autor cede a la editorial los derechos de edición en español por cinco años.', norma: 'l11723' },
    { t: 'Licencia', simple: 'Un permiso para usar la obra de cierta manera, sin que cambie quién es el titular.', ej: 'Una editorial autoriza a otra a publicar una edición de bolsillo de su título.' },
    { t: 'Contrato de edición', simple: 'El contrato en el que el autor le permite a un editor reproducir y vender su obra, con condiciones de pago y de plazo.', ej: 'El contrato que firma el autor antes de que el libro entre a producción.', norma: 'l11723' },
    { t: 'Obra derivada', simple: 'Una obra que se apoya en otra ya existente: una traducción, una adaptación, una versión ilustrada.', ej: 'La traducción de un libro francés es una obra derivada del original.', norma: 'l11723' },
    { t: 'Traducción', simple: 'Pasar una obra a otro idioma. Es una obra derivada y necesita permiso del titular del original mientras esté protegido.', ej: 'Antes de traducir una novela alemana, la editorial negocia los derechos con quien los tiene.', norma: 'l11723' },
    { t: 'Obra inédita', simple: 'Una obra que todavía no se publicó.', ej: 'Un manuscrito que solo vio el editor.', norma: 'l11723' },
    { t: 'Obra publicada', simple: 'Una obra que ya se puso a disposición del público, con ejemplares en circulación.', ej: 'Un libro editado con ISBN y a la venta.', norma: 'l11723' },
    { t: 'Dominio público', simple: 'El estado de una obra cuando venció su plazo de protección: se puede usar sin pedir permiso ni pagar, respetando el nombre del autor.', ej: 'Una editorial reedita un clásico sin pagar derechos porque ya está en dominio público.', norma: 'l11723' },
    { t: 'Obra huérfana', simple: 'Una obra protegida cuyo titular no se puede identificar o ubicar, así que no hay a quién pedirle permiso.', ej: 'Una foto vieja sin firma que un editor quiere usar en una tapa.' },
    { t: 'Depósito legal', simple: 'La obligación del editor de entregar ejemplares de lo que publica a la entidad que indica la ley.', ej: 'Después de imprimir, el editor entrega los ejemplares del depósito legal.', norma: 'l11723' },
    { t: 'Registro de obra', simple: 'Inscribir la obra en la Dirección Nacional del Derecho de Autor. Deja constancia de la obra y de su titular.', ej: 'Una editorial registra el libro y guarda la constancia de inscripción.', norma: 'l11723' },
    { t: 'DNDA', simple: 'Dirección Nacional del Derecho de Autor: el organismo del Estado donde se registran las obras y se hace el depósito legal.', ej: 'Los trámites de registro y de obras inéditas se hacen ante la DNDA.', norma: 'dnda14' },
    { t: 'Declaración jurada mensual', simple: 'El informe mensual que presenta el editor con las obras que editó.', ej: 'Cada mes la editorial informa los títulos que salieron de imprenta.', norma: 'd16697' },
    { t: 'Obra inédita en custodia', simple: 'Guardar un original no publicado en un depósito oficial para tener constancia de que existía en esa fecha.', ej: 'Un autor deja su manuscrito en custodia antes de mandarlo a editoriales.', norma: 'd972' },
    { t: 'ISBN', simple: 'El número internacional que identifica a cada edición de un libro. En el país es obligatorio ponérselo a los libros que se editan.', ej: 'Cada edición lleva su ISBN; una edición nueva con otro formato, otro.', norma: 'l22399' },
    { t: 'Retrato', simple: 'La imagen de una persona. Publicarla suele requerir su consentimiento.', ej: 'Antes de poner la foto de una persona en una tapa, la editorial pide su autorización.', norma: 'l11723' },
    { t: 'Derechos personalísimos', simple: 'Derechos que protegen a la persona misma: su imagen, su honor, su intimidad. No son de contenido económico.', ej: 'Una biografía no autorizada puede chocar con el honor o la intimidad del biografiado.', norma: 'ccyc' },
    { t: 'Honor', simple: 'La buena reputación de una persona. Es uno de los derechos personalísimos.', ej: 'Afirmar un hecho falso sobre alguien en un libro de no ficción puede afectar su honor.', norma: 'ccyc' },
    { t: 'Dato personal', simple: 'Cualquier información que identifica a una persona: nombre, mail, dirección, DNI.', ej: 'La lista de mails de suscriptores de una editorial son datos personales.', norma: 'l25326' },
    { t: 'Habeas data', simple: 'El derecho a saber qué datos tiene alguien sobre uno y a pedir que los corrija o los borre.', ej: 'Un lector pide que lo saquen de la lista de novedades de una editorial.', norma: 'l25326' },
    { t: 'Base de datos', simple: 'Un conjunto organizado de datos personales: una lista de clientes, de autores, de suscriptores.', ej: 'La planilla de librerías y contactos de la editorial.', norma: 'l25326' },
    { t: 'Software', simple: 'Un programa de computación. Se protege como obra, con las reglas de la ley de propiedad intelectual.', ej: 'Una app de lectura que desarrolla una editorial es una obra de software.', norma: 'l25036' },
    { t: 'Convenio de Berna', simple: 'El tratado que hace que un país proteja las obras de autores de los otros países miembros sin trámite especial.', ej: 'Una novela uruguaya está protegida en Argentina sin que el autor haga nada acá.', norma: 'berna' },
    { t: 'Trato nacional', simple: 'El principio de Berna: cada país protege las obras extranjeras como protege las propias.', ej: 'Un autor chileno tiene en Argentina los mismos derechos que uno argentino.', norma: 'berna' },
    { t: 'WCT y WPPT', simple: 'Los dos tratados de internet de la OMPI (1996): actualizaron la protección para el mundo digital.', ej: 'Regulan, por ejemplo, la comunicación de una obra por internet.', norma: 'wct' },
    { t: 'OMPI', simple: 'La Organización Mundial de la Propiedad Intelectual, el organismo de la ONU que administra los tratados de derecho de autor.', ej: 'Los tratados WCT y WPPT salieron de la OMPI.', norma: 'l25140' },
    { t: 'Jerarquía de normas', simple: 'El orden de importancia de las normas: la Constitución, después los tratados, las leyes, los decretos y las disposiciones. La de abajo no puede contradecir a la de arriba.', ej: 'Una disposición de la DNDA no puede decir lo contrario a la Ley 11.723.', norma: 'cn' },
    { t: 'Ley aprobatoria', simple: 'La ley con la que el Congreso aprueba un tratado para que valga en el país.', ej: 'La Ley 25.140 aprobó el Convenio de Berna.', norma: 'l25140' },
    { t: 'Decreto reglamentario', simple: 'Un decreto del Poder Ejecutivo que detalla cómo se aplica una ley, sin cambiarla.', ej: 'El Decreto 41.223/1934 reglamenta la Ley 11.723.', norma: 'd41223' },
    { t: 'Disposición', simple: 'Una norma de un organismo del Estado, de menor rango que un decreto, para ordenar trámites.', ej: 'La DNDA fija por disposición cómo se hace el depósito legal.', norma: 'dnda14' },
    { t: 'Texto ordenado', simple: 'Una versión de la norma que junta el texto original con todas sus reformas, para leerlo de corrido.', ej: 'El link de la Constitución en InfoLEG es el texto ordenado.', norma: 'cn' },
    { t: 'Norma derogada', simple: 'Una norma que otra posterior dejó sin efecto.', ej: 'El Decreto 972/2024 derogó decretos anteriores sobre obras inéditas.', norma: 'd972' },
    { t: 'Fomento del libro', simple: 'Las políticas públicas para que se produzcan, circulen y se lean libros.', ej: 'La Ley 25.446 es la ley de fomento del libro y la lectura.', norma: 'l25446' },
    { t: 'Plagio', simple: 'Presentar como propia una obra ajena. Además de una falta ética, puede violar el derecho de autor.', ej: 'Copiar capítulos de otro libro sin citarlo y firmarlos como propios.', norma: 'l11723' },
    { t: 'Cita', simple: 'Usar un fragmento breve de una obra ajena, indicando la fuente y con un fin legítimo (comentar, enseñar, criticar).', ej: 'Reproducir tres líneas de una novela en una reseña, con su autor y título.', norma: 'l11723' },
    { t: 'Copyright', simple: 'El término anglosajón para el derecho de autor. El símbolo © se usa para avisar quién es el titular.', ej: 'La página de legales de un libro suele traer el © con el nombre del titular.' },
    { t: 'Piratería', simple: 'Copiar y vender obras sin permiso del titular. Es una infracción que la ley sanciona.', ej: 'Imprimir y vender fotocopias de un libro sin autorización.', norma: 'l11723' }
  ];

  const normaPorId = id => NORMAS.find(n => n.id === id) || null;
  const nivelDe = id => { const n = normaPorId(id); return n ? n.nivel : 0; };
  const nivel = n => NIVELES.find(x => x.n === n) || null;
  const link = n => (n && n.infoleg ? INFOLEG + n.infoleg : '');
  // Qué le debe obediencia a qué: una norma de nivel mayor (más abajo en la pirámide) no puede contradecir a las de nivel menor.
  const queMandaSobre = id => NORMAS.filter(n => n.nivel > nivelDe(id));
  const debeRespetar = id => NORMAS.filter(n => n.nivel < nivelDe(id));
  const dependientes = id => NORMAS.filter(n => n.depende === id);
  const sinTildes = t => String(t == null ? '' : t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const buscar = q => { const s = sinTildes(q).trim(); return s ? TERMINOS.filter(x => sinTildes([x.t, x.simple, x.ej].join(' ')).indexOf(s) >= 0) : TERMINOS.slice(); };
  // Dado dos normas, cuál manda (la de menor nivel; si son del mismo nivel, ninguna: la posterior modifica a la anterior).
  const cualManda = (a, b) => { const x = nivelDe(a), y = nivelDe(b); return x === y ? null : x < y ? a : b; };

  return { NIVELES, NORMAS, TERMINOS, normaPorId, nivelDe, nivel, link, queMandaSobre, debeRespetar, dependientes, buscar, cualManda, sinTildes };
})();
