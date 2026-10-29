// Generador de contratos modelo (traducción y edición). BORRADOR: lo revisa una docente antes de publicarlo como estable.
// Sin DOM: lo usa app.js y lo prueba probar.py. Textos propios, redactados sobre dos fuentes (investigacion/07-contratos.md):
// los arts. 37 a 44 de la Ley 11.723 (texto de InfoLEG) y los mínimos sugeridos del modelo de traducción de la AATI.
// Cada cláusula declara su fuente. No es asesoramiento legal.
const Contratos = (() => {
  const FALTA = e => `[completar: ${e}]`;
  const lista = (a, y = 'y') => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' ' + y + ' ' + a[a.length - 1];
  const TERR = { ar: 'la República Argentina', la: 'América Latina', hi: 'todo el ámbito de la lengua española' };
  const num = x => (x === '' || x == null || isNaN(Number(x))) ? null : Number(x);
  const pct = x => String(x).replace('.', ',');

  const CAMPOS_COMUNES = [
    { id: 'obra', etq: 'Título de la obra', tipo: 'texto', def: '' },
    { id: 'editor', etq: 'Nombre del editor o editorial', tipo: 'texto', def: '' },
    { id: 'ciudad', etq: 'Ciudad de los tribunales', tipo: 'texto', def: 'la Ciudad Autónoma de Buenos Aires' },
  ];

  const MODELOS = {
    traduccion: {
      id: 'traduccion', t: 'Contrato de traducción', corto: 'Traducción',
      d: 'Entre un editor y un traductor: el traductor cede ciertos derechos sobre su traducción. Sigue el modelo de la AATI y toma sus mínimos sugeridos como valores iniciales.',
      campos: [
        ...CAMPOS_COMUNES.slice(0, 2),
        { id: 'traductor', etq: 'Nombre del traductor o traductora', tipo: 'texto', def: '' },
        { id: 'autor', etq: 'Autor de la obra original', tipo: 'texto', def: '' },
        { id: 'idioma', etq: 'Idioma de la obra original', tipo: 'texto', def: '' },
        { id: 'territorio', etq: 'Territorio de la autorización', tipo: 'opcion', def: 'hi', opciones: [['ar', 'Argentina'], ['la', 'América Latina'], ['hi', 'Todo el ámbito hispano']] },
        { id: 'trade', etq: 'Edición trade', tipo: 'check', def: true, grupo: 'Formatos autorizados' },
        { id: 'bolsillo', etq: 'Edición de bolsillo', tipo: 'check', def: false, grupo: 'Formatos autorizados' },
        { id: 'digital', etq: 'Edición digital (solo modalidades conocidas hoy)', tipo: 'check', def: false, grupo: 'Formatos autorizados' },
        { id: 'dominio', etq: 'La obra original está', tipo: 'opcion', def: 'vigente', opciones: [['vigente', 'Con derechos vigentes'], ['publico', 'En dominio público']] },
        { id: 'milPalabras', etq: 'Anticipo: pesos cada mil palabras', tipo: 'num', def: '', ayuda: 'Tomalo de la tabla de aranceles que publica la AATI.' },
        { id: 'regalia', etq: 'Regalía sobre el precio de tapa (%)', tipo: 'num', def: 1, ayuda: 'Mínimo sugerido por la AATI: 1 % con obra vigente, 5 % en dominio público.' },
        { id: 'regaliaDigital', etq: 'Regalía digital (%)', tipo: 'num', def: 2.5, ayuda: 'Mínimo sugerido: 2,5 % con obra vigente, 5 % en dominio público.' },
        { id: 'mesesEntrega', etq: 'Plazo de entrega (meses)', tipo: 'num', def: '' },
        { id: 'tiradaMin', etq: 'Tirada mínima (ejemplares)', tipo: 'num', def: '' },
        { id: 'nEdiciones', etq: 'Cantidad de ediciones contempladas', tipo: 'num', def: 1 },
        { id: 'plazoAnios', etq: 'Duración del contrato (años)', tipo: 'num', def: 5, ayuda: 'La AATI recomienda el plazo más corto posible y nunca más de 5 años.' },
        { id: 'ventaMin', etq: 'Ventas anuales mínimas desde el 3.er año (ejemplares)', tipo: 'num', def: 50, ayuda: 'La AATI sugiere 50 como mínimo.' },
        { id: 'sinIA', etq: 'Ninguna de las partes usa IA generativa (traducir o entrenar)', tipo: 'check', def: true },
        ...CAMPOS_COMUNES.slice(2),
      ],
    },
    edicion: {
      id: 'edicion', t: 'Contrato de edición', corto: 'Edición',
      d: 'Entre un autor y un editor: el autor se obliga a entregar la obra y el editor a reproducirla, difundirla y venderla. Arma las cláusulas sobre los arts. 37 a 44 de la Ley 11.723.',
      campos: [
        ...CAMPOS_COMUNES.slice(0, 2),
        { id: 'autor', etq: 'Nombre del autor o autora', tipo: 'texto', def: '' },
        { id: 'territorio', etq: 'Territorio de la autorización', tipo: 'opcion', def: 'ar', opciones: [['ar', 'Argentina'], ['la', 'América Latina'], ['hi', 'Todo el ámbito hispano']] },
        { id: 'papel', etq: 'Edición en papel', tipo: 'check', def: true, grupo: 'Formatos autorizados' },
        { id: 'digital', etq: 'Edición digital (solo modalidades conocidas hoy)', tipo: 'check', def: false, grupo: 'Formatos autorizados' },
        { id: 'nEdiciones', etq: 'Cantidad de ediciones (art. 40)', tipo: 'num', def: 1 },
        { id: 'ejemplares', etq: 'Ejemplares de cada edición (art. 40)', tipo: 'num', def: '' },
        { id: 'regalia', etq: 'Regalía sobre el precio de tapa (%) (art. 40)', tipo: 'num', def: '', ayuda: 'El art. 40 exige que conste la retribución; sin ella se aplican los usos y costumbres.' },
        { id: 'anticipo', etq: 'Anticipo a cuenta de regalías (pesos; 0 si no hay)', tipo: 'num', def: 0 },
        { id: 'mesesEntrega', etq: 'Plazo de entrega de la obra (meses)', tipo: 'num', def: '' },
        { id: 'mesesPublicacion', etq: 'Plazo de publicación (meses desde la entrega)', tipo: 'num', def: 24, ayuda: 'El modelo de la AATI usa 2 años; el art. 42 manda fijar plazo.' },
        { id: 'plazoAnios', etq: 'Duración del contrato (años)', tipo: 'num', def: 5 },
        { id: 'cortesia', etq: 'Ejemplares de cortesía al autor', tipo: 'num', def: 5 },
        { id: 'descuento', etq: 'Descuento al autor en compras propias (%)', tipo: 'num', def: 40 },
        ...CAMPOS_COMUNES.slice(2),
      ],
    },
  };

  const defaults = id => { const v = {}; MODELOS[id].campos.forEach(c => { v[c.id] = c.def; }); return v; };

  // Texto de cada cláusula; `t` recibe un lector `g(id, etiqueta)` que devuelve el valor o el marcador [completar].
  const CLAUSULAS = {
    traduccion: [
      { t: 'Partes y objeto', fuente: 'Modelo AATI (reunidos y manifiestan)', f: g => `${g('editor')} (el EDITOR/A) y ${g('traductor')} (el TRADUCTOR/A) celebran este contrato. El EDITOR/A tiene los derechos de traducir al español y publicar la obra «${g('obra')}», de ${g('autor')}, escrita en ${g('idioma')} (la OBRA ORIGINAL). El TRADUCTOR/A realizará la traducción (la TRADUCCIÓN) y cederá al EDITOR/A ciertos derechos sobre ella, para su publicación, en los términos de este documento.` },
      { t: 'Autorizaciones', fuente: 'Modelo AATI, cláusula 1; Ley 11.723, art. 38', f: g => { const fm = [g.v.trade && 'edición trade', g.v.bolsillo && 'edición de bolsillo', g.v.digital && 'edición digital, solo bajo las modalidades conocidas al momento de la edición'].filter(Boolean); return `El TRADUCTOR/A autoriza al EDITOR/A, de modo irrevocable y sujeto a lo pactado aquí, a usar la TRADUCCIÓN en español para: ${fm.length ? lista(fm) : FALTA('al menos un formato')}. Todo formato o modalidad que no figure acá queda reservado al TRADUCTOR/A y solo puede explotarse con un acuerdo escrito aparte.${g.v.digital ? ' En la edición digital, el EDITOR/A protegerá la TRADUCCIÓN con cuidados equivalentes a los del entorno analógico (cifrado, rastreo, geobloqueo o protecciones similares).' : ''}`; } },
      { t: 'Territorio', fuente: 'Modelo AATI, cláusula 2', f: g => `La autorización rige para ${TERR[g.v.territorio] || FALTA('territorio')}.` },
      { t: 'Anticipo', fuente: 'Modelo AATI, cláusula 3.A', f: g => `El TRADUCTOR/A recibirá un anticipo de ${g('milPalabras', 'pesos cada mil palabras')} pesos cada mil palabras de la TRADUCCIÓN, contadas con el contador del programa en que se traduce. El anticipo no es reembolsable ni genera deuda del TRADUCTOR/A: se descuenta de las regalías. Se paga dentro de los 10 días corridos de aprobada la TRADUCCIÓN. Si por la inflación pasa un tiempo que cambie sustancialmente el valor, las partes renegociarán de buena fe. Si la traducción lleva más de 60 días, el anticipo se paga en tramos (por ejemplo, 50 % a la entrega de la mitad y 50 % a la aprobación).` },
      { t: 'Regalías y liquidación', fuente: 'Modelo AATI, cláusula 3.B a 3.D', f: g => { const pub = g.v.dominio === 'publico'; return `Amortizado el anticipo, el EDITOR/A pagará al TRADUCTOR/A el ${g('regalia', 'regalía')} % del precio de venta al público de cada ejemplar vendido${pub ? ' (la obra original está en dominio público)' : ''}.${g.v.digital ? ` En la edición digital, el ${g('regaliaDigital', 'regalía digital')} % del precio, calculado sobre cada ejemplar vendido, reproducido, clave de acceso entregada o descarga verificada.` : ''} El TRADUCTOR/A entregará facturas por lo que reciba. Cada año, durante el primer trimestre, el EDITOR/A enviará una liquidación del año anterior, aunque sea negativa, con ejemplares publicados, vendidos, en depósito, distribuidos y en consignación, y el precio de tapa. Pagará dentro de los 30 días de enviada.`; } },
      { t: 'Entrega, aceptación y revisión', fuente: 'Modelo AATI, cláusula 4', f: g => `El TRADUCTOR/A responde por la autoría, la calidad y la originalidad de la TRADUCCIÓN y la entregará dentro de ${g('mesesEntrega', 'meses')} meses desde el encargo, con una tolerancia de 30 días; pasada esa tolerancia, el EDITOR/A puede fijar una nueva fecha o terminar el contrato, y en ese caso se devuelve el anticipo recibido. El EDITOR/A aceptará, rechazará o pedirá revisión dentro de los 20 días corridos de la entrega, con criterios objetivos. Si pide revisión, el TRADUCTOR/A tiene 15 días para decidir si la hace sin cobrar más; si no la hace, el EDITOR/A puede encargarla a un tercero y descontar su costo justificado. Las pruebas de galera se devuelven corregidas dentro de los 15 días de recibidas.${g.v.sinIA ? ' El TRADUCTOR/A no usará herramientas de inteligencia artificial generativa para traducir.' : ''}` },
      { t: 'Edición', fuente: 'Modelo AATI, cláusula 5; Ley 11.723, arts. 40 y 44', f: g => `El EDITOR/A publicará como mínimo ${g('tiradaMin', 'tirada mínima')} ejemplares dentro de los 2 años de la entrega, con una tolerancia excepcional de 6 meses; si no lo hace, el TRADUCTOR/A puede dar por rescindido el contrato, conserva el anticipo y recupera las autorizaciones. El contrato contempla ${g('nEdiciones', 'ediciones')} edición(es). La edición se considera agotada cuando quedan sin vender menos del 10 % de los ejemplares, cuando pasan 12 meses sin liquidación o cuando, a los 3 años, las ventas anuales son menores a ${g('ventaMin', 'ventas mínimas')} ejemplares.${g.v.sinIA ? ' El EDITOR/A no usará la TRADUCCIÓN, ni autorizará su uso, para entrenar herramientas de inteligencia artificial generativa.' : ''}` },
      { t: 'Plazo del contrato', fuente: 'Modelo AATI, cláusula 6; Ley 11.723, arts. 43 y 44', f: g => `El contrato se extingue y los derechos vuelven al TRADUCTOR/A a los ${g('plazoAnios', 'años')} años de la firma o a los 2 años de agotada la última edición, lo que ocurra primero. Extinguido, el EDITOR/A tiene derecho de opción preferente para un nuevo contrato en iguales términos. Si a los 3 años cambiaron sustancialmente las condiciones del mercado digital, las partes renegociarán de buena fe. El EDITOR/A podrá vender los ejemplares que le queden durante 2 años desde la extinción y deberá retirar de inmediato la edición digital, si la hubiera.` },
      { t: 'Derecho moral y créditos', fuente: 'Modelo AATI, cláusula 7', f: () => `El TRADUCTOR/A tiene el derecho moral de ser reconocido como autor de la TRADUCCIÓN. Su nombre (o seudónimo) figurará en tapa, portada, portadilla y página de legales, y en catálogos, reseñas y publicidades donde figure el título, junto al del autor original y en un tamaño no inferior al 30 % del de este.` },
      { t: 'Ejemplares de cortesía', fuente: 'Modelo AATI, cláusula 8', f: g => `El EDITOR/A entregará al TRADUCTOR/A 5 ejemplares de cortesía de la primera edición y 2 de las siguientes, que no pueden venderse. El TRADUCTOR/A podrá comprar más con 40 % de descuento para uso propio o para regalar sin fines de lucro.${g.v.digital ? ' En la edición digital, el EDITOR/A dará al menos 2 claves de acceso.' : ''}` },
      { t: 'Stock excedente, saldo y destrucción', fuente: 'Modelo AATI, cláusulas 9 y 10', f: () => `Si dentro de los 2 años de la publicación el EDITOR/A tiene más stock del necesario, puede ofrecerlo al TRADUCTOR/A o destruir una parte, sin que eso termine el contrato, siempre que quede stock para la explotación normal, e informarlo en la liquidación anual. La venta en saldo o la destrucción total rescinden el contrato de pleno derecho: el TRADUCTOR/A recupera los derechos y el EDITOR/A corregirá los datos en las bases profesionales y los sitios de venta.` },
      { t: 'Cesión del contrato', fuente: 'Modelo AATI, cláusula 11', f: () => `Con aviso previo al TRADUCTOR/A, el EDITOR/A puede ceder este contrato en todo o en parte; en ese caso pagará al TRADUCTOR/A como mínimo el 30 % de lo obtenido, dentro de los 30 días, y quien lo reciba asume todas las obligaciones del EDITOR/A.` },
      { t: 'Ley aplicable y tribunales', fuente: 'Modelo AATI, cláusula 12', f: g => `Este contrato se rige por las leyes argentinas. Las partes constituyen domicilio en los indicados en el encabezamiento y se someten a los tribunales ordinarios de ${g('ciudad', 'ciudad')}, con renuncia a cualquier otro fuero.` },
    ],
    edicion: [
      { t: 'Partes y objeto', fuente: 'Ley 11.723, art. 37', f: g => `${g('autor')} (el AUTOR/A) se obliga a entregar la obra «${g('obra')}» a ${g('editor')} (el EDITOR/A), y este se obliga a reproducirla, difundirla y venderla. Rige cualquiera sea la forma o el sistema de reproducción o publicación.` },
      { t: 'Derechos que se conceden', fuente: 'Ley 11.723, arts. 38 y 39', f: g => { const fm = [g.v.papel && 'edición en papel', g.v.digital && 'edición digital, solo bajo las modalidades conocidas al momento de la edición'].filter(Boolean); return `El AUTOR/A conserva su derecho de propiedad intelectual y puede traducir, transformar y defender su obra, aun contra el EDITOR/A. El EDITOR/A solo tiene los derechos de impresión, difusión y venta, en ${fm.length ? lista(fm) : FALTA('al menos un formato')}, para ${TERR[g.v.territorio] || FALTA('territorio')}. No puede alterar el texto y solo corrige pruebas de imprenta si el AUTOR/A se niega o no puede hacerlo. Todo lo que no figure acá queda reservado al AUTOR/A.${g.v.digital ? ' En la edición digital, el EDITOR/A protegerá la obra con cuidados equivalentes a los del entorno analógico.' : ''}`; } },
      { t: 'Ediciones y ejemplares', fuente: 'Ley 11.723, art. 40', f: g => `Se convienen ${g('nEdiciones', 'ediciones')} edición(es) de ${g('ejemplares', 'ejemplares')} ejemplares cada una. Toda reimpresión o nueva edición se informa por escrito al AUTOR/A con su cantidad de ejemplares.` },
      { t: 'Retribución', fuente: 'Ley 11.723, art. 40; liquidación según modelo AATI, cláusula 3.D', f: g => { const a = num(g.v.anticipo); return `El contrato es oneroso. El EDITOR/A pagará al AUTOR/A el ${g('regalia', 'regalía')} % del precio de venta al público de cada ejemplar vendido.${a ? ` Al firmar, o a la aprobación del texto, abonará ${a} pesos como anticipo a cuenta de regalías, que no es reembolsable.` : ''} Cada año, durante el primer trimestre, el EDITOR/A enviará una liquidación del año anterior, aunque sea negativa, con ejemplares impresos, vendidos, en depósito, distribuidos y en consignación, y el precio de tapa. Pagará dentro de los 30 días de enviada.`; } },
      { t: 'Entrega de la obra', fuente: 'Ley 11.723, arts. 41 y 42', f: g => `El AUTOR/A entregará la obra dentro de ${g('mesesEntrega', 'meses')} meses de la firma. Si la obra se pierde en poder del EDITOR/A antes de editarse, este indemniza al AUTOR/A con la regalía que le habría correspondido; si se pierde en poder del AUTOR/A, este devuelve lo recibido a cuenta de regalías más los daños y perjuicios.` },
      { t: 'Publicación', fuente: 'Ley 11.723, art. 42; plazos según modelo AATI, cláusula 5', f: g => `El EDITOR/A publicará la obra dentro de ${g('mesesPublicacion', 'meses')} meses de recibida, con una tolerancia excepcional de 6 meses. Si no lo hace, el AUTOR/A puede dar por rescindido el contrato sin más trámite, conserva lo cobrado y recupera todos los derechos concedidos.` },
      { t: 'Duración y fin del contrato', fuente: 'Ley 11.723, arts. 43 y 44; plazo según modelo AATI, cláusula 6', f: g => `El contrato dura ${g('plazoAnios', 'años')} años desde la firma. Termina antes, cualquiera sea el plazo, si se agotan las ediciones convenidas (art. 44). Al vencer el plazo, si el EDITOR/A conserva ejemplares sin vender, el AUTOR/A puede comprarlos a precio de costo más un 10 % de bonificación; si no lo hace, el EDITOR/A puede seguir vendiéndolos en las condiciones de este contrato (art. 43).` },
      { t: 'Ejemplares y compras del autor', fuente: 'Modelo AATI, cláusula 8 (adaptada)', f: g => `El EDITOR/A entregará al AUTOR/A ${g('cortesia', 'ejemplares de cortesía')} ejemplares de cortesía de la primera edición, que no pueden venderse. El AUTOR/A podrá comprar más con ${g('descuento', 'descuento')} % de descuento sobre el precio de tapa, para uso propio o para regalar sin fines de lucro.` },
      { t: 'Créditos', fuente: 'Ley 11.723, art. 38; modelo AATI, cláusula 7 (adaptada)', f: () => `El nombre del AUTOR/A (o su seudónimo) figurará en tapa, portada y página de legales, y en catálogos, reseñas y publicidades donde figure el título de la obra.` },
      { t: 'Ley aplicable y tribunales', fuente: 'Modelo AATI, cláusula 12 (adaptada)', f: g => `Este contrato se rige por las leyes argentinas. Las partes constituyen domicilio en los indicados en el encabezamiento y se someten a los tribunales ordinarios de ${g('ciudad', 'ciudad')}, con renuncia a cualquier otro fuero.` },
    ],
  };

  // Devuelve cláusulas ya redactadas, la lista de datos que faltan y avisos sobre valores por debajo de lo sugerido.
  function generar(id, v) {
    const m = MODELOS[id], etq = {}; m.campos.forEach(c => { etq[c.id] = c.etq; });
    const falta = [];
    const g = (k, e) => { const x = v[k]; if (x === '' || x == null || (typeof x === 'string' && !x.trim())) { if (falta.indexOf(k) < 0) falta.push(k); return FALTA(e || etq[k].toLowerCase()); } return typeof x === 'number' ? pct(x) : x; };
    g.v = v;
    const clausulas = CLAUSULAS[id].map((c, i) => ({ n: i + 1, t: c.t, fuente: c.fuente, texto: c.f(g) }));
    return { modelo: m, clausulas, falta: falta.map(k => etq[k]), avisos: avisos(id, v) };
  }

  function avisos(id, v) {
    const a = [], n = k => num(v[k]);
    if (id === 'traduccion') {
      const pub = v.dominio === 'publico', minR = pub ? 5 : 1, minD = pub ? 5 : 2.5;
      if (n('regalia') != null && n('regalia') < minR) a.push(`La regalía (${pct(n('regalia'))} %) está por debajo del mínimo que sugiere la AATI (${pct(minR)} %).`);
      if (v.digital && n('regaliaDigital') != null && n('regaliaDigital') < minD) a.push(`La regalía digital (${pct(n('regaliaDigital'))} %) está por debajo del mínimo que sugiere la AATI (${pct(minD)} %).`);
      if (n('ventaMin') != null && n('ventaMin') < 50) a.push('La AATI sugiere un mínimo de 50 ejemplares anuales para considerar agotada la edición.');
    }
    if (n('plazoAnios') != null && n('plazoAnios') > 5) a.push(`La duración (${n('plazoAnios')} años) supera los 5 años que recomienda la AATI. Un plazo largo o abierto («por todo el término de la ley») fue discutido en tribunales.`);
    if (n('nEdiciones') != null && (n('nEdiciones') < 1 || n('nEdiciones') % 1)) a.push('La cantidad de ediciones tiene que ser un número entero desde 1.');
    return a;
  }

  // Documento completo en Markdown (para descargar o copiar).
  function documento(id, v) {
    const r = generar(id, v), m = r.modelo;
    const cab = id === 'traduccion'
      ? `En ______________, a los ___ días del mes de ______________ de ______, entre ${v.editor || FALTA('editor')} (domicilio y DNI: ______________) y ${v.traductor || FALTA('traductor')} (domicilio y DNI: ______________):`
      : `En ______________, a los ___ días del mes de ______________ de ______, entre ${v.editor || FALTA('editor')} (domicilio y DNI: ______________) y ${v.autor || FALTA('autor')} (domicilio y DNI: ______________):`;
    return [`# ${m.t.toUpperCase()}`, '', '> Borrador generado con Galera (galera.com.ar). Modelo orientativo: no es asesoramiento legal. Antes de firmar, que lo revise un abogado.', '', cab, '',
      ...r.clausulas.map(c => `**${c.n}. ${c.t}.** ${c.texto}`).flatMap(x => [x, '']),
      'Para que conste, las partes firman dos ejemplares de un mismo tenor.', '', '______________________ &nbsp;&nbsp;&nbsp;&nbsp; ______________________', id === 'traduccion' ? 'TRADUCTOR/A &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; EDITOR/A' : 'AUTOR/A &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; EDITOR/A', ''].join('\n');
  }

  return { MODELOS, CLAUSULAS, FALTA, defaults, generar, avisos, documento };
})();
