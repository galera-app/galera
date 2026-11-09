// Redactor de contratos del libro (traducción, edición, cesión, encargo, ilustración, corrección, coedición, autoedición y audiolibro).
// BORRADOR: plantillas orientativas, no asesoramiento legal; las cláusulas marcadas `revisar` necesitan un/a abogado/a.
// Sin DOM: lo usa app.js y lo prueba probar.py. Textos propios, redactados sobre dos fuentes (investigacion/07-contratos.md):
// los arts. 37 a 44 de la Ley 11.723 (texto de InfoLEG) y los mínimos sugeridos del modelo de traducción de la AATI.
// Cada cláusula declara su fuente. No es asesoramiento legal.
const Contratos = (() => {
  const FALTA = e => `[completar: ${e}]`;
  const lista = (a, y = 'y') => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' ' + y + ' ' + a[a.length - 1];
  const TERR = { ar: 'la República Argentina', la: 'América Latina', hi: 'todo el ámbito de la lengua española', mu: 'todo el mundo' };
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

  // ---------------------------------------------------------------------------------------------------------------
  // Redactor: tipos nuevos, cláusulas elegibles (opcionales y con variantes) y notas «por qué esto importa».
  // Propiedades de una cláusula: id, t, fuente, f(g) o vars:[{k, etq, f}], porque (nota), ref:[{sim, t}] (otras herramientas de Galera),
  // opcional/def (se puede sacar; def = viene incluida), cond(v) (aparece solo si se cumple), revisar (sin norma que la respalde o
  // dudosa: «a revisar por abogado/a»). Cada campo puede traer si(v) para mostrarse solo cuando corresponde.
  // ---------------------------------------------------------------------------------------------------------------
  // Franja de borrador (texto provisorio, a aprobar por Fidel). Solo traducción y edición tienen fuente (modelo AATI, Ley 11.723 arts. 37 a 44); los otros siete son redacción propia sin revisión profesional.
  const CON_FUENTE = ['traduccion', 'edicion'];
  const FRANJA_T = 'Borrador sin revisión profesional';
  const FRANJA = 'Este modelo es una redacción de Galera sin respaldo en un modelo oficial ni revisión de un/a abogado/a. No lo firmes sin que lo lea un profesional.';
  const franja = id => CON_FUENTE.indexOf(id) < 0 ? { t: FRANJA_T, d: FRANJA } : null;
  const AVISO = 'Plantilla orientativa: no es asesoramiento legal. Antes de firmar, conviene que la revise un/a abogado/a.';
  const miles = n => { const s = String(Math.round(Number(n) * 100) / 100).replace('.', ','), p = s.split(','); return p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (p[1] ? ',' + p[1] : ''); };
  const T = (id, etq, def, x) => Object.assign({ id, etq, tipo: 'texto', def: def == null ? '' : def }, x);
  const N = (id, etq, def, x) => Object.assign({ id, etq, tipo: 'num', def: def == null ? '' : def }, x);
  const K = (id, etq, def, grupo, x) => Object.assign({ id, etq, tipo: 'check', def: !!def, grupo }, x);
  const O = (id, etq, def, opciones, x) => Object.assign({ id, etq, tipo: 'opcion', def, opciones }, x);
  const TERR_OPC = [['ar', 'Argentina'], ['la', 'América Latina'], ['hi', 'Todo el ámbito hispano'], ['mu', 'Todo el mundo']];
  const USD = v => v.moneda === 'usd';
  const MONEDA = [O('moneda', 'Moneda del pago', 'pesos', [['pesos', 'Pesos argentinos'], ['usd', 'Dólares estadounidenses']]),
    T('cotizacion', 'Cotización para pagar en pesos', '', { si: USD, ayuda: 'Definí cuál: por ejemplo, la cotización oficial de referencia del día hábil anterior al pago.' })];
  const pagoUsd = g => USD(g.v) ? ` Los pagos se harán en pesos, al tipo de cambio ${g('cotizacion', 'cotización de referencia')}.` : '';
  const PARTES = (e1, e2) => [T('p1', e1, ''), T('dom1', 'Domicilio (opcional)', '', { opcional: true }), T('p2', e2, ''), T('dom2', 'Domicilio (opcional)', '', { opcional: true })];
  const JUR = [T('ciudad', 'Ciudad de los tribunales', 'la Ciudad Autónoma de Buenos Aires'), N('diasNegociacion', 'Días de negociación previa', 30, { si: v => v.var_jurisdiccion === 'negociacion' }),
    T('arbitraje', 'Tribunal o institución de arbitraje', '', { si: v => v.var_jurisdiccion === 'arbitraje' })];
  const RESC = [N('diasIntimacion', 'Días para cumplir tras la intimación', 15, { ayuda: 'Si no pactás una cláusula resolutoria expresa, la ley pide un emplazamiento de no menos de 15 días (art. 1088 del CCyC).' }),
    N('diasPreaviso', 'Días de preaviso', '', { si: v => v.var_rescision === 'preaviso' })];
  const CONF = [N('anosConf', 'Años de confidencialidad tras terminar', 2, { si: v => v.inc_confidencialidad, ayuda: 'Valor de ejemplo: ajustalo.' })];
  const NOTIF = [T('mail1', 'Correo electrónico de la primera parte', '', { si: v => v.inc_notificaciones }), T('mail2', 'Correo electrónico de la segunda parte', '', { si: v => v.inc_notificaciones })];
  const OBJ_ESCRITO = 'Escribirlo evita discutir después qué se acordó.';

  // Cláusulas reutilizables. Se las pide con la función (ver más abajo) para que digan el rol de cada parte.
  const cJurisdiccion = () => ({ id: 'jurisdiccion', t: 'Ley aplicable y jurisdicción', fuente: 'Práctica contractual habitual; modelo AATI, cláusula 12 (adaptada)', revisar: true,
    porque: 'Elegir un lugar y un modo de resolver conflictos ahorra discusiones. Un arbitraje, además, tiene costos y reglas propias: si lo elegís, que un/a abogado/a revise la institución y el reglamento.',
    vars: [
      { k: 'tribunales', etq: 'Tribunales ordinarios', f: g => `Este contrato se rige por las leyes argentinas. Las partes constituyen domicilio en los indicados en el encabezamiento y se someten a los tribunales ordinarios de ${g('ciudad', 'ciudad')}, con renuncia a cualquier otro fuero.` },
      { k: 'negociacion', etq: 'Negociación previa y después tribunales', f: g => `Este contrato se rige por las leyes argentinas. Antes de iniciar cualquier acción, las partes intentarán resolver sus diferencias por negociación directa y de buena fe durante ${g('diasNegociacion', 'días de negociación')} días corridos desde que una notifique el reclamo a la otra. Si no lo logran, se someten a los tribunales ordinarios de ${g('ciudad', 'ciudad')}, con renuncia a cualquier otro fuero.` },
      { k: 'arbitraje', etq: 'Arbitraje', f: g => `Este contrato se rige por las leyes argentinas. Toda diferencia derivada de él se resolverá por arbitraje ante ${g('arbitraje', 'tribunal o institución de arbitraje')}, conforme a su reglamento y con sede en ${g('ciudad', 'ciudad')}.` }] });
  const cRescision = vuelve => ({ id: 'rescision', t: 'Resolución del contrato', fuente: 'CCyC, arts. 1077, 1083, 1086 a 1088', revisar: true,
    porque: 'El Código permite pactar una cláusula resolutoria expresa (art. 1086). Si no la pactás, rige la implícita (arts. 1087 y 1088), que exige un emplazamiento con apercibimiento de al menos 15 días, salvo excepciones. Pactarlo de antemano da certeza. Rescindir sin causa solo vale si el contrato lo permite (art. 1077): por eso hay una variante con preaviso.',
    vars: [
      { k: 'incumplimiento', etq: 'Solo por incumplimiento, con intimación previa', f: g => `Si una de las partes incumple una obligación esencial de este contrato, la otra puede intimarla por medio fehaciente (por ejemplo, carta documento) a cumplir dentro de ${g('diasIntimacion', 'días de intimación')} días corridos, bajo apercibimiento de resolver el contrato. Vencido ese plazo sin cumplimiento, el contrato queda resuelto por la sola comunicación fehaciente de la parte cumplidora, sin perjuicio de los daños que correspondan y de lo ya pagado por trabajos o derechos efectivamente entregados o usados.${(vuelve && vuelve(g.r)) ? ' ' + vuelve(g.r) : ''}` },
      { k: 'preaviso', etq: 'Por incumplimiento, o sin causa con preaviso', f: g => `Si una de las partes incumple una obligación esencial de este contrato, la otra puede intimarla por medio fehaciente (por ejemplo, carta documento) a cumplir dentro de ${g('diasIntimacion', 'días de intimación')} días corridos, bajo apercibimiento de resolver el contrato. Además, cualquiera de las partes puede terminar el contrato sin expresar causa, con un preaviso fehaciente de ${g('diasPreaviso', 'días de preaviso')} días corridos; en ese caso se paga lo ya realizado o entregado hasta la terminación y no hay otra indemnización.${(vuelve && vuelve(g.r)) ? ' ' + vuelve(g.r) : ''}` }] });
  const cConfidencialidad = () => ({ id: 'confidencialidad', t: 'Confidencialidad', fuente: 'Práctica contractual habitual (sin norma específica)', opcional: true, def: false, revisar: true,
    porque: 'Los originales inéditos y las condiciones económicas suelen ser reservados. Si no lo escribís, no hay deber expreso de callar.',
    f: g => `Las partes mantendrán en reserva la información no pública que se intercambien con motivo de este contrato (originales inéditos, condiciones económicas, datos de ventas) y no la usarán para otros fines. La obligación sigue vigente por ${g('anosConf', 'años de confidencialidad')} años después de terminado el contrato.` });
  const cIA = () => ({ id: 'ia', t: 'Inteligencia artificial generativa', fuente: 'Práctica contractual emergente (sin norma específica); modelo AATI, cláusulas 4 y 5 (adaptada)', opcional: true, def: false, revisar: true,
    porque: 'Es un tema nuevo y poco asentado. Si te importa que la obra no se use para entrenar sistemas, o que no se genere con ellos, dejalo escrito.',
    vars: [
      { k: 'prohibida', etq: 'Ninguna parte la usa sin consentimiento escrito', f: () => 'Ninguna de las partes usará herramientas de inteligencia artificial generativa para crear o modificar la obra o el trabajo objeto de este contrato, ni autorizará su uso para entrenar o ajustar sistemas de inteligencia artificial, sin el consentimiento previo y escrito de la otra.' },
      { k: 'aviso', etq: 'Se puede usar avisando; el entrenamiento, no', f: () => 'Si una parte quiere usar herramientas de inteligencia artificial generativa en el trabajo, lo informará antes por escrito y la otra podrá aceptarlo o no. Ninguna parte usará la obra, el trabajo ni su resultado para entrenar o ajustar sistemas de inteligencia artificial sin el consentimiento escrito de la otra.' }] });
  const cImprevision = () => ({ id: 'imprevision', t: 'Cambio extraordinario de circunstancias', fuente: 'CCyC, art. 1091', opcional: true, def: false,
    porque: 'Con inflación alta, un precio fijo puede quedar viejo en meses. El art. 1091 ya prevé la imprevisión; esta cláusula fija de antemano que se renegocia primero.',
    f: () => 'Si por circunstancias extraordinarias, ajenas a las partes y no asumidas por ellas, la prestación de una de ellas se volviera excesivamente onerosa, las partes se reunirán para renegociar de buena fe y adecuar este contrato. Si no llegan a un acuerdo, rige lo que la ley prevé para esa situación.' });
  const cNotificaciones = () => ({ id: 'notificaciones', t: 'Notificaciones', fuente: 'CCyC, art. 1078 (las declaraciones se comunican a la otra parte)', opcional: true, def: false,
    porque: 'Las intimaciones y las rescisiones deben llegar a la otra parte. Fijar domicilios y correos válidos evita discutir si algo se notificó.',
    f: g => `Las comunicaciones entre las partes se harán por escrito, a los domicilios del encabezamiento o a los correos electrónicos ${g('mail1', 'correo de la primera parte')} (${g.r.a}) y ${g('mail2', 'correo de la segunda parte')} (${g.r.b}), que las partes consideran válidos para notificarse. Cada parte avisa por escrito si cambia de domicilio o de correo.` });
  const cMoral = (sujeto, extra) => ({ id: 'moral', t: 'Derecho moral y créditos', fuente: 'Ley 11.723, art. 52',
    porque: 'Aunque el autor ceda la obra, la ley le conserva la fidelidad del texto y del título y la mención de su nombre (art. 52, según el texto de InfoLEG). Ponerlo en el contrato fija cómo y dónde se ve.',
    f: g => `Aunque se ceda o se licencie la explotación, ${sujeto(g.r)} conserva el derecho a que se respete la fidelidad del texto y del título y a que se mencione su nombre (o seudónimo) en cada copia o reproducción.${extra && extra(g) ? ' ' + extra(g) : ''}` });

  // ============================ Cesión de derechos de autor ============================
  MODELOS.cesion = { id: 'cesion', t: 'Contrato de cesión de derechos de autor', corto: 'Cesión de derechos',
    d: 'Una persona (autor/a o titular) cede a otra derechos de explotación económica de una obra ya existente: qué derechos, dónde, por cuánto tiempo, con o sin exclusividad y a cambio de qué.',
    roles: { a: 'CEDENTE', b: 'CESIONARIO/A' }, partes: [['p1', 'dom1'], ['p2', 'dom2']],
    campos: [...PARTES('Nombre del cedente (autor/a o titular)', 'Nombre del cesionario o cesionaria'),
      T('obra', 'Título y descripción de la obra', ''),
      K('dReprod', 'Reproducción y edición en papel', true, 'Derechos que se ceden'), K('dDigital', 'Edición digital (modalidades conocidas hoy)', false, 'Derechos que se ceden'),
      K('dTraduc', 'Traducción a otros idiomas', false, 'Derechos que se ceden'), K('dAdapt', 'Adaptación a otros formatos (teatro, cine, audio)', false, 'Derechos que se ceden', { ayuda: 'Cada adaptación suele merecer su propio contrato.' }),
      O('territorio', 'Territorio', 'ar', TERR_OPC), O('exclusividad', 'Exclusividad', 'exclusiva', [['exclusiva', 'Exclusiva'], ['noexclusiva', 'No exclusiva']]),
      N('plazoAnios', 'Duración de la cesión (años)', '', { ayuda: 'El plazo de protección general es de 70 años desde la muerte del autor (art. 5): ceder por menos tiempo deja margen para renegociar.' }),
      O('forma', 'Forma de retribución', 'regalia', [['regalia', 'Regalías sobre el precio de venta'], ['unico', 'Pago único'], ['mixto', 'Anticipo más regalías']]),
      N('precio', 'Pago único o anticipo', '', { si: v => v.forma !== 'regalia' }), N('regalia', 'Regalía sobre el precio de venta al público (%)', '', { si: v => v.forma !== 'unico' }),
      N('diasPago', 'Días para pagar', 30, { ayuda: 'Valor de ejemplo: ajustalo.' }), ...MONEDA, ...RESC, ...CONF, ...NOTIF, ...JUR] };
  CLAUSULAS.cesion = [
    { id: 'objeto', t: 'Partes y objeto', fuente: 'CCyC, art. 1614; Ley 11.723, art. 51', porque: 'Una cesión transfiere derechos; una licencia solo da permiso de uso. El art. 51 de la Ley 11.723 admite ceder la obra total o parcialmente, pero solo por el plazo legal y sin alterar título, forma ni contenido. Conviene que el contrato diga con precisión qué se transfiere.', ref: [{ sim: 'leyes', t: 'Ver la pirámide de normas y las fichas de la Ley 11.723' }],
      f: g => `${g('p1')} (el ${g.r.a}) cede a ${g('p2')} (el ${g.r.b}), en los términos de este contrato, los derechos de explotación económica de la obra «${g('obra')}» (la OBRA) que se detallan en la cláusula siguiente. El ${g.r.b} se obliga a pagar la retribución pactada.` },
    { id: 'derechos', t: 'Derechos cedidos y derechos reservados', fuente: 'Ley 11.723, arts. 51 y 38', porque: 'Lo que no se nombra se queda con el autor. Una cesión genérica («todos los derechos, presentes y futuros») deja dudas sobre qué se cedió; listar es más claro.',
      f: g => { const d = [g.v.dReprod && 'reproducción y edición en papel', g.v.dDigital && 'edición digital, solo bajo las modalidades conocidas al momento de la firma', g.v.dTraduc && 'traducción a otros idiomas', g.v.dAdapt && 'adaptación a otros formatos'].filter(Boolean); return `Se ceden únicamente estos derechos: ${d.length ? lista(d) : FALTA('al menos un derecho')}. Todo derecho, formato o modalidad que no figure acá queda reservado al ${g.r.a} y solo puede explotarse con un acuerdo escrito aparte. La cesión no alcanza al texto de la OBRA en otras formas que las indicadas ni a modalidades de explotación que hoy no existen.`; } },
    { id: 'territorio', t: 'Territorio y exclusividad', fuente: 'Ley 11.723, art. 51; práctica contractual', revisar: true, porque: 'La exclusividad es lo que más valor tiene para quien recibe los derechos: si la das, pedí a cambio mejor retribución o menos plazo. La no exclusiva te permite ceder lo mismo a varios.',
      f: g => `La cesión rige para ${TERR[g.v.territorio] || FALTA('territorio')}. ` + (g.v.exclusividad === 'noexclusiva' ? `Es no exclusiva: el ${g.r.a} conserva la facultad de ceder o licenciar los mismos derechos a terceros, y el ${g.r.b} no puede sublicenciarlos sin consentimiento escrito del ${g.r.a}.` : `Es exclusiva: mientras dure el contrato, el ${g.r.a} no cederá ni licenciará a terceros los mismos derechos en ese territorio, y el ${g.r.b} no puede sublicenciarlos sin consentimiento escrito del ${g.r.a}.`) },
    { id: 'plazo', t: 'Plazo', fuente: 'Ley 11.723, arts. 51 y 5', porque: 'El art. 51 dice que la cesión es válida durante el plazo legal; el art. 5 fija ese plazo (70 años desde el 1.º de enero del año siguiente a la muerte del autor, como regla general). Pactar un plazo menor te permite recuperar los derechos antes.',
      f: g => `La cesión dura ${g('plazoAnios', 'años de duración')} años desde la firma. Vencido el plazo, los derechos vuelven al ${g.r.a} de pleno derecho, sin necesidad de aviso, y el ${g.r.b} deja de explotar la OBRA.` },
    { id: 'retribucion', t: 'Retribución', fuente: 'Ley 11.723, art. 40 (por analogía con el contrato de edición); CCyC, art. 1614', revisar: true, porque: 'El art. 40 presume oneroso el contrato de edición. En una cesión conviene que figure el precio o la regalía y su base de cálculo, para no discutir qué se cobra.', ref: [{ sim: 'tarifario', t: 'Ver qué tarifarios públicos hay en el sector' }],
      f: g => { const f = g.v.forma, anual = ' Cada año, durante el primer trimestre, el ' + g.r.b + ' enviará una liquidación del año anterior, aunque sea negativa, con ejemplares vendidos y el precio de venta al público.'; const pago = ` Los pagos se harán dentro de los ${g('diasPago', 'días para pagar')} días corridos de ${f === 'unico' ? 'la firma' : 'enviada cada liquidación'}.`; const reg = `el ${g('regalia', 'regalía')} % del precio de venta al público de cada ejemplar vendido`; return (f === 'unico' ? `El ${g.r.b} pagará al ${g.r.a} un pago único de ${g.m('precio', 'monto')}, no reembolsable.` : f === 'mixto' ? `El ${g.r.b} pagará al ${g.r.a} un anticipo de ${g.m('precio', 'anticipo')}, no reembolsable y a cuenta de regalías, y luego ${reg}.${anual}` : `El ${g.r.b} pagará al ${g.r.a} ${reg}.${anual}`) + pago + pagoUsd(g); } },
    cMoral(r => r.a),
    { id: 'garantias', t: 'Titularidad y garantías', fuente: 'Práctica contractual habitual', opcional: true, def: true, revisar: true, porque: 'Si la obra tiene coautores, ilustraciones o textos de terceros, hay que tener sus permisos antes de ceder. Esta cláusula reparte la responsabilidad si aparece un reclamo.',
      f: g => `El ${g.r.a} declara que es titular de los derechos que cede, que no los cedió antes a otra persona en lo que este contrato abarca y que la OBRA no infringe derechos de terceros. Si un tercero reclamara, el ${g.r.a} responde en la medida de su declaración falsa, y ambos se avisarán sin demora de cualquier reclamo.` },
    { id: 'registro', t: 'Registro de la cesión', fuente: 'Ley 11.723, art. 53', opcional: true, def: true, revisar: true, ref: [{ sim: 'leyes', t: 'Ver el Registro y la DNDA en Leyes del libro' }],
      porque: 'Según el texto de InfoLEG, el art. 53 manda inscribir la cesión de obras literarias, científicas o musicales en el Registro Nacional de Propiedad Intelectual, y dice que sin esa inscripción no tiene validez. Consultá con un/a abogado/a cómo se hace hoy el trámite y qué efectos tiene.',
      vars: [{ k: 'cesionario', etq: 'Lo gestiona quien recibe los derechos', f: g => `Las partes acuerdan inscribir esta cesión en el Registro Nacional de Propiedad Intelectual. El trámite lo hará el ${g.r.b}, que asume su costo, y el ${g.r.a} firmará lo necesario.` },
        { k: 'cedente', etq: 'Lo gestiona quien cede', f: g => `Las partes acuerdan inscribir esta cesión en el Registro Nacional de Propiedad Intelectual. El trámite lo hará el ${g.r.a}, y el ${g.r.b} firmará lo necesario y reembolsará el costo.` }] },
    cRescision(r => `Resuelto el contrato, los derechos cedidos vuelven al ${r.a}.`), cConfidencialidad(), cIA(), cImprevision(), cNotificaciones(), cJurisdiccion()];

  // ============================ Encargo de obra intelectual ============================
  MODELOS.encargo = { id: 'encargo', t: 'Contrato de encargo de obra', corto: 'Encargo de obra',
    d: 'Una persona o empresa encarga a un/a autor/a una obra a medida (un texto, una fotografía, contenido) por un precio. Define entrega, revisiones, precio y qué pasa con los derechos.',
    roles: { a: 'COMITENTE', b: 'AUTOR/A' }, partes: [['p1', 'dom1'], ['p2', 'dom2']],
    campos: [...PARTES('Nombre del comitente (quien encarga)', 'Nombre del autor o autora'),
      T('obra', 'Descripción del encargo', '', { ayuda: 'Qué se hace, extensión, tema y destino.' }), T('entregables', 'Qué se entrega', '', { ayuda: 'Por ejemplo: un texto de 20.000 palabras en archivo editable.' }),
      N('diasEntrega', 'Plazo de entrega (días)', '', {}), N('revisiones', 'Rondas de revisión incluidas', 2), N('diasRespuesta', 'Días del comitente para responder', 10, { ayuda: 'Valor de ejemplo: ajustalo.' }),
      N('precio', 'Precio total', ''), ...MONEDA, N('anticipoPct', 'Porcentaje que se paga al firmar (%)', '', { ayuda: 'Dejalo vacío si no hay anticipo.' }), N('diasPago', 'Días para pagar el saldo', 30, { ayuda: 'Valor de ejemplo: ajustalo.' }),
      O('uso', 'Qué pasa con los derechos', 'licencia', [['licencia', 'Licencia de uso para un proyecto'], ['cesion', 'Cesión de los derechos de explotación']]),
      T('proyecto', 'Proyecto o uso autorizado', '', { si: v => v.uso !== 'cesion' }), O('territorio', 'Territorio', 'ar', TERR_OPC), N('plazoAnios', 'Duración de la licencia o cesión (años)', ''),
      K('credito', 'El nombre del autor figura como tal', true, 'Créditos'),
      N('desistPct', 'Compensación si el comitente desiste (% del precio restante)', '', { si: v => v.inc_desistimiento !== false, ayuda: 'Por la utilidad esperada (art. 1261 del CCyC). Definila de común acuerdo.' }),
      ...RESC, ...CONF, ...NOTIF, ...JUR] };
  CLAUSULAS.encargo = [
    { id: 'objeto', t: 'Objeto y naturaleza', fuente: 'CCyC, arts. 1251 y 1252', porque: 'El Código distingue obra (se promete un resultado entregable) de servicio (se promete una actividad). Acá se pacta una obra. Si el trabajo fuera en relación de dependencia, se regiría por el derecho laboral (art. 1252, última parte).', ref: [{ sim: 'leyes', t: 'Ver las normas que ordenan el sector' }],
      f: g => `${g('p2')} (el ${g.r.b}) se obliga a realizar, de forma independiente, la obra descrita como «${g('obra')}» (el ENCARGO) a favor de ${g('p1')} (el ${g.r.a}), y este se obliga a pagar el precio. Las partes declaran que se promete un resultado entregable y que entre ellas no hay relación de dependencia.` },
    { id: 'entrega', t: 'Entrega y plazo', fuente: 'CCyC, art. 1256', porque: 'Entre las obligaciones del contratista figura cumplir el plazo (art. 1256). Si la demora depende del comitente (material, respuestas), conviene que el plazo se suspenda.',
      f: g => `El ${g.r.b} entregará ${g('entregables', 'qué se entrega')} dentro de ${g('diasEntrega', 'plazo de entrega')} días corridos desde la firma. Si el ${g.r.a} demora el material o sus respuestas, el plazo se suspende por el mismo tiempo.` },
    { id: 'revisiones', t: 'Revisiones y aprobación', fuente: 'CCyC, art. 1257 (el comitente debe recibir la obra conforme a lo pactado); práctica contractual', revisar: true, porque: 'Sin un tope de revisiones, el trabajo se estira sin fin. Fijalo y acordá qué pasa si el comitente no responde.',
      f: g => `El precio incluye ${g('revisiones', 'rondas de revisión')} ronda(s) de revisión. El ${g.r.a} comunicará sus cambios por escrito dentro de ${g('diasRespuesta', 'días para responder')} días corridos de cada entrega; si no responde en ese plazo, la entrega se tiene por aprobada. Los cambios adicionales se presupuestan aparte.` },
    { id: 'precio', t: 'Precio y forma de pago', fuente: 'CCyC, arts. 1255, 1257 y 1262', porque: 'El precio lo fijan las partes (art. 1255). Si es global, no se puede reclamar más por más trabajo, y si nada se pacta se presume precio global (arts. 1255 y 1262). Por eso conviene dejar claro qué incluye.', ref: [{ sim: 'tarifario', t: 'Mirá los tarifarios públicos de referencia' }],
      f: g => { const a = num(g.v.anticipoPct); return `El precio total del ENCARGO es de ${g.m('precio', 'precio total')}, precio global por el trabajo descrito.${a ? ` El ${a} % se paga al firmar y el saldo, contra la entrega final.` : ' Se paga contra la entrega final.'} Los pagos se harán dentro de los ${g('diasPago', 'días para pagar')} días corridos de cada vencimiento.${pagoUsd(g)}`; } },
    { id: 'derechos', t: 'Derechos sobre la obra', fuente: 'Ley 11.723, arts. 4 y 51', revisar: true, porque: 'La ley reconoce como titular al autor (art. 4) y prevé que los derechos se transfieran por cesión (art. 51). Por eso conviene que el contrato diga si se cede o solo se licencia: encargar una obra no lo resuelve por sí solo.',
      vars: [{ k: 'licencia', etq: 'Licencia de uso para un proyecto', f: g => `El ${g.r.b} conserva la titularidad de la obra y concede al ${g.r.a} una licencia para usarla en ${g('proyecto', 'proyecto o uso autorizado')}, para ${TERR[g.v.territorio] || FALTA('territorio')}, por ${g('plazoAnios', 'años de duración')} años. Todo otro uso requiere un acuerdo escrito aparte.` },
        { k: 'cesion', etq: 'Cesión de los derechos de explotación', f: g => `El ${g.r.b} cede al ${g.r.a}, con exclusividad, los derechos de explotación económica de la obra para ${TERR[g.v.territorio] || FALTA('territorio')}, por ${g('plazoAnios', 'años de duración')} años, desde el pago total del precio. Todo derecho que no figure acá queda reservado al ${g.r.b}.` }] },
    cMoral(r => r.b, g => g.v.credito ? `El nombre del ${g.r.b} figurará como autor del ENCARGO en las publicaciones donde se use.` : `Las partes acuerdan que el ${g.r.b} no figurará con su nombre; esto no afecta su derecho a ser reconocido como autor si lo pide en el futuro.`),
    { id: 'terceros', t: 'Originalidad y terceros', fuente: 'CCyC, art. 1254', opcional: true, def: true, revisar: true, porque: 'El art. 1254 permite al contratista recurrir a terceros, salvo que se lo haya elegido por sus cualidades personales. Si importa quién hace el trabajo, decilo.',
      f: g => `El ${g.r.b} declara que el ENCARGO es original y que no infringe derechos de terceros. Se lo elige por sus cualidades personales: realizará el trabajo en persona y solo podrá recurrir a terceros con acuerdo escrito del ${g.r.a}, sin dejar de responder por el resultado.` },
    { id: 'desistimiento', t: 'Desistimiento del comitente', fuente: 'CCyC, art. 1261', opcional: true, def: true, revisar: true, porque: 'El comitente puede desistir del contrato de obra, pero debe indemnizar gastos, trabajos realizados y utilidad esperada (art. 1261); el juez puede reducir esa utilidad si fuera injusta. Fijar de antemano la compensación evita el juicio.',
      f: g => `El ${g.r.a} puede desistir del ENCARGO en cualquier momento. En ese caso paga los trabajos realizados hasta ese momento, los gastos justificados y, como compensación por la utilidad esperada, el ${g('desistPct', 'porcentaje de compensación')} % del precio que reste pagar.` },
    { id: 'portfolio', t: 'Muestra en portfolio', fuente: 'Práctica contractual habitual', opcional: true, def: false, revisar: true, porque: 'Muchos autores quieren mostrar el trabajo. Si hay confidencialidad o la obra es inédita, conviene dejar claro desde cuándo se puede.',
      f: g => `El ${g.r.b} podrá mostrar el ENCARGO ya publicado en su portfolio y sus redes, mencionando al ${g.r.a}, salvo lo que sea confidencial.` },
    cRescision(r => `Resuelto el contrato, el ${r.b} conserva lo pagado por lo ya realizado y los derechos sobre lo que no se haya pagado.`), cConfidencialidad(), cIA(), cImprevision(), cNotificaciones(), cJurisdiccion()];

  // ============================ Ilustración y diseño ============================
  MODELOS.ilustracion = { id: 'ilustracion', t: 'Contrato de ilustración o diseño', corto: 'Ilustración y diseño',
    d: 'Para encargar ilustraciones, una tapa o el diseño de un libro. Aclara usos autorizados, originales, créditos y la reserva del derecho de reproducción.',
    roles: { a: 'COMITENTE', b: 'ILUSTRADOR/A' }, partes: [['p1', 'dom1'], ['p2', 'dom2']],
    campos: [...PARTES('Nombre del comitente (quien encarga)', 'Nombre del ilustrador, ilustradora o diseñador/a'),
      T('obra', 'Título del libro o proyecto', ''), T('trabajo', 'Descripción del trabajo', '', { ayuda: 'Por ejemplo: 12 ilustraciones interiores en técnica digital, o diseño de tapa y contratapa.' }),
      N('diasEntrega', 'Plazo de entrega (días)', ''), N('revisiones', 'Rondas de ajuste incluidas', 2),
      N('precio', 'Precio total', ''), ...MONEDA, N('anticipoPct', 'Porcentaje que se paga al firmar (%)', '', { ayuda: 'Dejalo vacío si no hay anticipo.' }), N('diasPago', 'Días para pagar el saldo', 30, { ayuda: 'Valor de ejemplo: ajustalo.' }),
      K('uTapa', 'Tapa y contratapa', true, 'Usos autorizados'), K('uInterior', 'Interior del libro', true, 'Usos autorizados'), K('uPromo', 'Difusión y promoción del libro', true, 'Usos autorizados'), K('uDigital', 'Edición digital', false, 'Usos autorizados'), K('uProd', 'Productos derivados (merchandising)', false, 'Usos autorizados'),
      O('territorio', 'Territorio', 'ar', TERR_OPC), O('exclusividad', 'Exclusividad', 'exclusiva', [['exclusiva', 'Exclusiva para ese libro'], ['noexclusiva', 'No exclusiva']]), N('plazoAnios', 'Duración de la autorización (años)', ''),
      O('originales', 'Originales físicos', 'ilustrador', [['ilustrador', 'Quedan con el ilustrador'], ['comitente', 'Se entregan al comitente']]), K('abiertos', 'Se entregan archivos abiertos o editables', false, 'Archivos'),
      K('credito', 'El nombre del ilustrador figura en tapa o créditos', true, 'Créditos'), N('regalia', 'Regalía por venta (%)', '', { si: v => v.inc_regalias, ayuda: 'Solo si incluís la cláusula de regalías.' }),
      N('desistPct', 'Compensación si el comitente desiste (% del precio restante)', '', { ayuda: 'Por la utilidad esperada (art. 1261 del CCyC).' }),
      ...RESC, ...CONF, ...NOTIF, ...JUR] };
  CLAUSULAS.ilustracion = [
    { id: 'objeto', t: 'Objeto', fuente: 'CCyC, arts. 1251 y 1252', porque: 'Es un contrato de obra: se promete un resultado entregable (art. 1252). Si fuera en relación de dependencia, se regiría por el derecho laboral.', ref: [{ sim: 'leyes', t: 'Ver las normas que ordenan el sector' }],
      f: g => `${g('p2')} (el ${g.r.b}) se obliga a realizar, de forma independiente, el siguiente trabajo para el libro o proyecto «${g('obra')}»: ${g('trabajo', 'descripción del trabajo')} (la OBRA), a favor de ${g('p1')} (el ${g.r.a}), que se obliga a pagar el precio.` },
    { id: 'entrega', t: 'Entrega, plazos y ajustes', fuente: 'CCyC, art. 1256', porque: 'Un tope de ajustes protege tu tiempo; más allá de ese tope, se cobra aparte. Pasá siempre un boceto aprobado antes del trabajo final.',
      f: g => `El ${g.r.b} entregará la OBRA dentro de ${g('diasEntrega', 'plazo de entrega')} días corridos desde la firma, previa aprobación por escrito de bocetos o pruebas del ${g.r.a}. El precio incluye ${g('revisiones', 'rondas de ajuste')} ronda(s) de ajustes sobre lo aprobado; los cambios de rumbo o adicionales se presupuestan aparte. Si el ${g.r.a} demora material o respuestas, el plazo se suspende por el mismo tiempo.` },
    { id: 'precio', t: 'Precio y forma de pago', fuente: 'CCyC, arts. 1255, 1257 y 1262', porque: 'El precio lo fijan las partes (art. 1255) y, si es global, no se reclama más por más trabajo. Acordá qué incluye el precio, y comparalo con los tarifarios que publica el sector.', ref: [{ sim: 'tarifario', t: 'Mirá los tarifarios de ilustración y diseño' }],
      f: g => { const a = num(g.v.anticipoPct); return `El precio total de la OBRA es de ${g.m('precio', 'precio total')}, precio global.${a ? ` El ${a} % se paga al firmar y el saldo, contra la entrega final.` : ' Se paga contra la entrega final.'} Los pagos se harán dentro de los ${g('diasPago', 'días para pagar')} días corridos de cada vencimiento.${pagoUsd(g)}`; } },
    { id: 'usos', t: 'Usos autorizados y derecho de reproducción', fuente: 'Ley 11.723, arts. 54 y 51', porque: 'Según el texto de InfoLEG, el art. 54 dice que, salvo pacto en contrario, la cesión de una obra pictórica, escultórica, fotográfica o análoga no incluye el derecho de reproducción. Por eso es clave listar cada uso: lo que no figura, no está autorizado.',
      f: g => { const u = [g.v.uTapa && 'tapa y contratapa', g.v.uInterior && 'el interior del libro', g.v.uPromo && 'la difusión y promoción del libro', g.v.uDigital && 'la edición digital', g.v.uProd && 'productos derivados']; return `El ${g.r.b} autoriza expresamente al ${g.r.a} a reproducir la OBRA solo en: ${lista(u.filter(Boolean)).replace(/^$/, FALTA('al menos un uso'))}, para ${TERR[g.v.territorio] || FALTA('territorio')}, por ${g('plazoAnios', 'años de duración')} años, ${g.v.exclusividad === 'noexclusiva' ? 'de modo no exclusivo' : 'con exclusividad para ese libro'}. Todo otro uso, incluida la reproducción en otros libros, queda reservado al ${g.r.b} y requiere un acuerdo escrito aparte.`; } },
    { id: 'originales', t: 'Originales y archivos', fuente: 'Práctica contractual habitual', revisar: true, porque: 'Tener un original físico o un archivo no da derechos de reproducción: son cosas distintas. Aclarar quién se queda con los originales evita reclamos.',
      f: g => `${g.v.originales === 'comitente' ? `Los originales físicos de la OBRA se entregan al ${g.r.a}` : `Los originales físicos de la OBRA quedan en poder del ${g.r.b}`}, y esa entrega o tenencia no modifica los derechos que este contrato concede o reserva. ${g.v.abiertos ? `El ${g.r.b} también entregará los archivos abiertos o editables, solo para los usos autorizados en este contrato.` : `El ${g.r.b} entregará archivos finales, sin los archivos abiertos o editables.`}` },
    cMoral(r => r.b, g => g.v.credito ? `El nombre del ${g.r.b} figurará en la tapa o en los créditos de cada edición, y en las piezas de difusión donde figure el nombre del autor del libro.` : ''),
    { id: 'regalias', t: 'Regalías por venta', fuente: 'Práctica contractual habitual', opcional: true, def: false, revisar: true, porque: 'Además del precio, algunos acuerdos suman un porcentaje por ejemplar vendido. Si lo agregás, definí la base (precio de tapa, ingresos netos) y cómo se rinden las cuentas.',
      f: g => `Además del precio, el ${g.r.a} pagará al ${g.r.b} el ${g('regalia', 'regalía')} % del precio de venta al público de cada ejemplar vendido. Cada año, durante el primer trimestre, enviará una liquidación del año anterior, aunque sea negativa, y pagará dentro de los 30 días de enviada.` },
    { id: 'originalidad', t: 'Originalidad', fuente: 'Práctica contractual habitual', opcional: true, def: true, revisar: true, porque: 'Si hay imágenes de terceros, tipografías con licencia o referencias, quién responde por ellas debe estar claro.',
      f: g => `El ${g.r.b} declara que la OBRA es original y que no infringe derechos de terceros. El ${g.r.a} entregará por escrito los materiales y las licencias de lo que provea (textos, imágenes, tipografías) y responde por ellos.` },
    { id: 'desistimiento', t: 'Desistimiento del comitente', fuente: 'CCyC, art. 1261', opcional: true, def: true, revisar: true, porque: 'El comitente puede desistir, pero debe pagar gastos, trabajos realizados y utilidad esperada (art. 1261). Fijar de antemano esa compensación evita discutirla.',
      f: g => `El ${g.r.a} puede desistir en cualquier momento. En ese caso paga el trabajo realizado hasta ese momento, los gastos justificados y, como compensación por la utilidad esperada, el ${g('desistPct', 'porcentaje de compensación')} % del precio que reste pagar; el ${g.r.b} conserva todos los derechos sobre lo no pagado.` },
    cRescision(() => ''), cConfidencialidad(), cIA(), cImprevision(), cNotificaciones(), cJurisdiccion()];

  // ============================ Corrección y edición (servicios editoriales) ============================
  const UNIDADES = [['pagina', 'página'], ['milcar', 'mil caracteres con espacios'], ['palabra', 'palabra'], ['proyecto', 'proyecto (precio cerrado)'], ['hora', 'hora']];
  const UN_TXT = { pagina: 'página', milcar: 'mil caracteres con espacios', palabra: 'palabra', proyecto: 'proyecto', hora: 'hora' };
  MODELOS.correccion = { id: 'correccion', t: 'Contrato de servicios de corrección o edición', corto: 'Corrección y edición',
    d: 'Para contratar a un/a corrector/a o editor/a independiente: alcance del trabajo, criterio, unidad de cobro, rondas, plazos, confidencialidad y qué derechos no se mueven.',
    roles: { a: 'COMITENTE', b: 'PRESTADOR/A' }, partes: [['p1', 'dom1'], ['p2', 'dom2']],
    campos: [...PARTES('Nombre del comitente (quien contrata)', 'Nombre del prestador o prestadora'),
      T('obra', 'Título de la obra a trabajar', ''), O('servicio', 'Servicio', 'ortotipografica', [['ortotipografica', 'Corrección ortotipográfica'], ['estilo', 'Corrección de estilo'], ['edicion', 'Edición (trabajo sobre estructura y contenido)'], ['lectura', 'Lectura crítica o informe de lectura'], ['pruebas', 'Corrección de pruebas de galera']]),
      O('criterio', 'Criterio de corrección', 'rae', [['rae', 'Obras académicas vigentes de la RAE y la ASALE'], ['guia', 'Guía de estilo del comitente'], ['mixto', 'Las dos, con prioridad de la guía']]),
      N('cantidad', 'Cantidad de unidades', '', { ayuda: 'Páginas, miles de caracteres o palabras estimados; en «proyecto», dejalo en 1.' }), O('unidad', 'Unidad de cobro', 'pagina', UNIDADES), N('tarifa', 'Tarifa por unidad (o total, si es por proyecto)', ''), ...MONEDA,
      N('rondas', 'Pasadas de revisión incluidas', 1), N('diasEntrega', 'Plazo de entrega (días)', ''), N('anticipoPct', 'Porcentaje que se paga al firmar (%)', '', { ayuda: 'Dejalo vacío si no hay anticipo.' }), N('diasPago', 'Días para pagar', 30, { ayuda: 'Valor de ejemplo: ajustalo.' }),
      K('credito', 'El nombre del prestador figura en la página de legales', false, 'Créditos'),
      ...RESC, ...CONF, ...NOTIF, ...JUR] };
  const totalServ = v => { const c = num(v.cantidad), t = num(v.tarifa); if (t == null) return null; if (v.unidad === 'proyecto') return t; return c == null ? null : c * t; };
  CLAUSULAS.correccion = [
    { id: 'objeto', t: 'Objeto y naturaleza', fuente: 'CCyC, arts. 1251, 1252 y 1253', porque: 'El Código distingue servicio (una actividad independiente de su resultado) de obra (un resultado entregable) (art. 1252). La corrección suele ser un servicio: se promete diligencia profesional, no una obra libre de todo error. Y si el servicio es en relación de dependencia, rige el derecho laboral.', ref: [{ sim: 'tarifario', t: 'Mirá los tarifarios de corrección y edición' }],
      f: g => `${g('p2')} (el ${g.r.b}) prestará a ${g('p1')} (el ${g.r.a}), de forma independiente, el servicio de ${({ ortotipografica: 'corrección ortotipográfica', estilo: 'corrección de estilo', edicion: 'edición', lectura: 'lectura crítica', pruebas: 'corrección de pruebas de galera' })[g.v.servicio] || FALTA('servicio')} sobre la obra «${g('obra')}» (el TEXTO). Entre las partes no hay relación de dependencia; el ${g.r.b} elige los medios para realizar el trabajo y emite los comprobantes que le correspondan según su situación impositiva.` },
    { id: 'criterio', t: 'Alcance y criterio', fuente: 'Práctica editorial; CCyC, art. 1256', revisar: true, porque: 'Corregir sin criterio acordado es la mayor fuente de malentendidos: ¿se unifica la ortografía? ¿se reescribe? Decirlo antes evita pasadas de más.',
      f: g => `El trabajo se hará con el siguiente criterio: ${({ rae: 'las obras académicas vigentes de la RAE y la ASALE', guia: 'la guía de estilo que el ' + g.r.a + ' entregue por escrito', mixto: 'las obras académicas vigentes de la RAE y la ASALE y la guía de estilo del ' + g.r.a + ', que prevalece en caso de diferencia' })[g.v.criterio] || FALTA('criterio')}. El ${g.r.b} marcará sus cambios de modo que puedan revisarse (control de cambios o comentarios). Las decisiones finales sobre el contenido del TEXTO son del ${g.r.a} y de su autor/a; el ${g.r.b} no alterará el sentido del TEXTO sin consultar.` },
    { id: 'plazo', t: 'Plazo y pasadas', fuente: 'CCyC, art. 1256', porque: 'Cada pasada extra es trabajo extra. Definí cuántas incluye el precio.',
      f: g => `El ${g.r.b} entregará el TEXTO trabajado dentro de ${g('diasEntrega', 'plazo de entrega')} días corridos desde la recepción del archivo final. El precio incluye ${g('rondas', 'pasadas')} pasada(s) de revisión; las adicionales se presupuestan aparte. Si el ${g.r.a} cambia el TEXTO después de entregarlo al ${g.r.b}, el plazo y el precio se ajustan.` },
    { id: 'precio', t: 'Honorarios y pago', fuente: 'CCyC, arts. 1255 y 1257', porque: 'El precio lo fijan las partes (art. 1255). Dejá la unidad de cobro y la forma de contar por escrito (¿con o sin espacios? ¿bibliografía incluida?).', ref: [{ sim: 'tarifario', t: 'Compará con los tarifarios públicos' }],
      f: g => { const t = totalServ(g.v), u = g.v.unidad; const a = num(g.v.anticipoPct); const base = u === 'proyecto' ? `Los honorarios son de ${g.m('tarifa', 'monto del proyecto')} por el proyecto completo.` : `Los honorarios son de ${g.m('tarifa', 'tarifa')} por ${UN_TXT[u] || FALTA('unidad')}, sobre una cantidad estimada de ${g('cantidad', 'cantidad de unidades')} unidades de cobro${t != null ? `, lo que da un total estimado de ${(USD(g.v) ? 'US$ ' : '$ ') + miles(t)}` : ''}. La cantidad final se cuenta sobre el TEXTO definitivo recibido, con el contador del programa en que se trabaja.`; return `${base}${a ? ` El ${a} % se paga al firmar y el saldo, contra la entrega.` : ' Se paga contra la entrega.'} Los pagos se harán dentro de los ${g('diasPago', 'días para pagar')} días corridos de cada vencimiento.${pagoUsd(g)}`; } },
    { id: 'derechos', t: 'Derechos sobre el texto', fuente: 'Ley 11.723, arts. 4 y 52', revisar: true, porque: 'Corregir o editar no convierte al prestador en autor ni le da derechos sobre la obra. Si el trabajo de edición es muy profundo, conviene aclarar de antemano que no hay coautoría.',
      f: g => `El trabajo del ${g.r.b} no le da derechos de autor sobre el TEXTO, que sigue siendo de su autor/a o de quien corresponda. Los informes, notas y observaciones del ${g.r.b} pueden usarse para esta obra; su uso en otras obras requiere acuerdo escrito.${g.v.credito ? ` El nombre del ${g.r.b} figurará en la página de legales de la edición.` : ''}` },
    { id: 'responsabilidad', t: 'Alcance de la responsabilidad', fuente: 'CCyC, art. 1252', opcional: true, def: true, revisar: true, porque: 'Ninguna corrección garantiza un libro sin erratas. Dejar claro que se promete diligencia profesional, y no un resultado absoluto, protege al prestador; fijar rondas protege al comitente.',
      f: g => `El ${g.r.b} aplicará la diligencia propia de su oficio, pero no garantiza la ausencia total de errores. No responde por errores en partes del TEXTO que no se le hayan entregado, por cambios hechos después de su trabajo ni por los que surjan en etapas posteriores (maquetación, impresión).` },
    cConfidencialidad(), cIA(), cImprevision(), cNotificaciones(),
    cRescision(() => ''), cJurisdiccion()];
  CLAUSULAS.correccion.find(c => c.id === 'confidencialidad').def = true;

  // ============================ Coedición ============================
  MODELOS.coedicion = { id: 'coedicion', t: 'Contrato de coedición', corto: 'Coedición',
    d: 'Dos editoriales publican juntas un mismo libro: reparten costos, ejemplares, territorios, trámites y las cuentas con el autor.',
    roles: { a: 'EDITORIAL A', b: 'EDITORIAL B' }, partes: [['p1', 'dom1'], ['p2', 'dom2']],
    campos: [...PARTES('Nombre de la primera editorial (A)', 'Nombre de la segunda editorial (B)'),
      T('obra', 'Título de la obra', ''), T('autor', 'Autor o autora', ''), O('contratoAutor', 'Quién firma el contrato de edición con el autor', 'a', [['a', 'La editorial A'], ['b', 'La editorial B'], ['ambas', 'Las dos']]),
      N('tirada', 'Tirada total (ejemplares)', ''), N('costoA', 'Porcentaje de los costos que asume A (%)', '', { ayuda: 'B asume el resto.' }), N('ejA', 'Porcentaje de ejemplares que recibe A (%)', '', { ayuda: 'B recibe el resto.' }),
      T('terrA', 'Territorio de venta de A', ''), T('terrB', 'Territorio de venta de B', ''),
      O('isbn', 'Quién tramita ISBN y depósito legal', 'a', [['a', 'La editorial A'], ['b', 'La editorial B'], ['cada', 'Cada una para sus ejemplares']]),
      N('regalia', 'Regalía al autor (% del precio de tapa)', ''), O('liquida', 'Quién liquida al autor', 'a', [['a', 'La editorial A'], ['b', 'La editorial B']]), N('mesesPublicacion', 'Plazo para publicar (meses)', ''),
      N('plazoAnios', 'Duración del contrato (años)', ''), N('mesesInforme', 'Cada cuántos meses se informan las ventas', 6, { ayuda: 'Valor de ejemplo: ajustalo.' }),
      ...RESC, ...CONF, ...NOTIF, ...JUR] };
  const quien = (g, k) => k === 'ambas' ? 'ambas EDITORIALES' : k === 'cada' ? 'cada EDITORIAL' : 'la ' + (k === 'a' ? g.r.a : g.r.b);
  CLAUSULAS.coedicion = [
    { id: 'objeto', t: 'Objeto y naturaleza', fuente: 'Ley 11.723, art. 37; práctica editorial', revisar: true, porque: 'Coeditar es publicar juntos, repartiendo costos y ejemplares. Conviene aclarar que no es una sociedad: cada una actúa por su cuenta salvo lo pactado, y que un/a abogado/a revise cómo encaja en lo impositivo y societario.', ref: [{ sim: 'leyes', t: 'Ver la ficha de la Ley 11.723' }],
      f: g => `${g('p1')} (${g.r.a}) y ${g('p2')} (${g.r.b}) acuerdan coeditar la obra «${g('obra')}», de ${g('autor')} (la OBRA), reproduciéndola, difundiéndola y vendiéndola en los términos de este contrato. Este contrato no constituye una sociedad ni una persona jurídica: cada parte actúa por su cuenta, salvo lo pactado.` },
    { id: 'autor', t: 'Contrato con el autor', fuente: 'Ley 11.723, arts. 37 a 40', porque: 'Cada coeditor necesita derechos del autor para el territorio en que vende. El art. 40 exige que el contrato de edición diga el número de ediciones, los ejemplares de cada una y la retribución del autor: sin esos datos, se aplican los usos y costumbres.', ref: [{ sim: 'contratos', t: 'Armar el contrato de edición con el autor (tipo «Edición»)', tipo: 'edicion' }],
      f: g => `El contrato de edición con el autor lo firma${g.v.contratoAutor === 'ambas' ? 'n ambas EDITORIALES' : ' ' + quien(g, g.v.contratoAutor)} y debe cubrir, como mínimo, los territorios y formatos de esta coedición y los datos que exige el art. 40 de la Ley 11.723. Cada EDITORIAL recibirá copia de ese contrato y no podrá exceder lo que él autoriza.` },
    { id: 'tirada', t: 'Edición y tirada', fuente: 'Ley 11.723, art. 40', porque: 'La tirada y su reparto son la base económica del acuerdo. Si hay reimpresiones, que requieran acuerdo de ambas evita que una decida sola.',
      f: g => `La primera edición será de ${g('tirada', 'tirada total')} ejemplares. Toda reimpresión o nueva edición requiere el acuerdo escrito de ambas EDITORIALES y se informa al autor con su cantidad de ejemplares.` },
    { id: 'costos', t: 'Costos y ejemplares', fuente: 'Práctica editorial', revisar: true, porque: 'Aclará qué costos entran (corrección, diseño, papel, impresión, traducción, anticipo al autor) y cómo se rinden. Lo más común es que ejemplares y costos se repartan en la misma proporción, pero no es obligatorio.',
      f: g => { const a = num(g.v.costoA), e = num(g.v.ejA); return `${g.r.a} asume el ${g('costoA', 'porcentaje de costos de A')} % de los costos de producción de la edición${a != null ? ` y ${g.r.b} el ${pct(100 - a)} %` : ''}. Los ejemplares se reparten así: ${g.r.a} recibe el ${g('ejA', 'porcentaje de ejemplares de A')} %${e != null ? ` y ${g.r.b} el ${pct(100 - e)} %` : ''}. Cada parte factura y paga sus partes de modo que los comprobantes respondan a lo que cada una asumió.`; } },
    { id: 'territorios', t: 'Territorios y venta', fuente: 'Práctica editorial', revisar: true, porque: 'Si cada coeditor vende en su territorio, conviene decir qué pasa con las ventas por internet y con quien compra fuera de zona.',
      f: g => `${g.r.a} venderá su parte de los ejemplares en ${g('terrA', 'territorio de A')} y ${g.r.b} en ${g('terrB', 'territorio de B')}. Ninguna venderá activamente en el territorio de la otra sin su acuerdo escrito. Cada parte fija el precio de venta al público en su territorio y avisa a la otra.` },
    { id: 'isbn', t: 'ISBN y depósito legal', fuente: 'Ley 22.399 (ISBN); Ley 11.723 (depósito legal)', revisar: true, porque: 'Cada edición necesita su ISBN y cumplir el depósito legal. Acordá quién lo hace y cómo figuran las dos editoriales en la página de legales.', ref: [{ sim: 'leyes', t: 'Ver las fichas del ISBN y el depósito legal' }],
      f: g => `El ISBN y el depósito legal los tramita${g.v.isbn === 'cada' ? ' cada EDITORIAL para sus ejemplares' : ' ' + quien(g, g.v.isbn)}. En la página de legales y en la portada figurarán ambas EDITORIALES.` },
    { id: 'regalias', t: 'Regalías al autor', fuente: 'Ley 11.723, art. 40', porque: 'Alguien tiene que liquidarle al autor. Decidir quién y con qué datos evita que el autor reciba dos liquidaciones o ninguna.',
      f: g => `Se pagará al autor el ${g('regalia', 'regalía')} % del precio de venta al público de cada ejemplar vendido por ambas EDITORIALES. La liquidación la hace ${quien(g, g.v.liquida)} y la otra EDITORIAL le informa sus ventas cada ${g('mesesInforme', 'meses de informe')} meses.` },
    { id: 'informe', t: 'Informe de ventas', fuente: 'Práctica editorial; modelo AATI, cláusula 3.D (adaptada)', opcional: true, def: true, revisar: true, porque: 'Sin datos de ventas, no hay cuentas claras.',
      f: g => `Cada EDITORIAL enviará a la otra, cada ${g('mesesInforme', 'meses de informe')} meses, un informe con ejemplares vendidos, devueltos, en depósito y en consignación, y el precio de tapa.` },
    { id: 'publicacion', t: 'Plazos y duración', fuente: 'Ley 11.723, arts. 42 y 43', porque: 'El art. 42 manda fijar plazo de publicación; si falta, lo fija un tribunal. El art. 43 prevé qué pasa con los ejemplares que quedan al vencer el contrato.',
      f: g => `La OBRA se publicará dentro de ${g('mesesPublicacion', 'meses para publicar')} meses de la firma. El contrato dura ${g('plazoAnios', 'años de duración')} años desde la firma. Al vencer, cada EDITORIAL podrá seguir vendiendo sus ejemplares en las condiciones de este contrato, y las existencias de una pueden ser ofrecidas a la otra a precio de costo antes de venderlas a un tercero.` },
    { id: 'cesion', t: 'Prohibición de ceder', fuente: 'Práctica contractual habitual', opcional: true, def: false, revisar: true, porque: 'Si una editorial se vende, ¿la otra sigue de socia con un tercero? Esta cláusula lo evita.',
      f: g => `Ninguna de las EDITORIALES puede ceder este contrato ni sus derechos sin el consentimiento escrito de la otra.` },
    cConfidencialidad(), cIA(), cImprevision(), cNotificaciones(),
    cRescision(() => 'Resuelto el contrato, cada EDITORIAL conserva los ejemplares ya recibidos y paga lo que adeude.'), cJurisdiccion()];

  // ============================ Autoedición con servicios ============================
  MODELOS.autoedicion = { id: 'autoedicion', t: 'Contrato de autoedición con servicios', corto: 'Autoedición con servicios',
    d: 'Un/a autor/a paga a una editorial o estudio por servicios (corrección, diseño, impresión, distribución). Deja claro que el autor conserva todos los derechos y qué se compra exactamente.',
    roles: { a: 'AUTOR/A', b: 'PRESTADOR/A' }, partes: [['p1', 'dom1'], ['p2', 'dom2']],
    campos: [...PARTES('Nombre del autor o autora', 'Nombre de la editorial o estudio que presta el servicio'),
      T('obra', 'Título de la obra', ''),
      K('sCorreccion', 'Corrección', true, 'Servicios incluidos'), K('sDiseno', 'Diseño de tapa', true, 'Servicios incluidos'), K('sMaquet', 'Maquetación del interior', true, 'Servicios incluidos'), K('sISBN', 'Gestión de ISBN y depósito legal', false, 'Servicios incluidos'),
      K('sImpresion', 'Impresión', true, 'Servicios incluidos'), K('sDistrib', 'Distribución o venta en librerías', false, 'Servicios incluidos'), K('sDigital', 'Edición digital', false, 'Servicios incluidos'), K('sDifusion', 'Difusión y prensa', false, 'Servicios incluidos'),
      N('tirada', 'Tirada (ejemplares)', '', { si: v => v.sImpresion }), N('precio', 'Precio total de los servicios', ''), ...MONEDA, N('anticipoPct', 'Porcentaje que se paga al firmar (%)', '', { ayuda: 'Dejalo vacío si no hay anticipo.' }), N('diasPago', 'Días para pagar el saldo', 30, { ayuda: 'Valor de ejemplo: ajustalo.' }),
      N('mesesEjecucion', 'Plazo total de ejecución (meses)', ''), N('rondas', 'Rondas de corrección de pruebas incluidas', 2),
      O('isbnTitular', 'Titular del ISBN', 'autor', [['autor', 'El autor'], ['prestador', 'El prestador']], { si: v => v.sISBN }),
      K('abiertos', 'Se entregan al autor los archivos finales editables', true, 'Archivos'),
      O('stock', 'Quién guarda los ejemplares', 'autor', [['autor', 'Se entregan al autor'], ['prestador', 'Los guarda el prestador por cuenta del autor']], { si: v => v.sImpresion }),
      N('comision', 'Comisión del prestador por venta (%)', '', { si: v => v.sDistrib }), N('mesesInforme', 'Cada cuántos meses rinde cuentas', 6, { si: v => v.sDistrib, ayuda: 'Valor de ejemplo: ajustalo.' }),
      ...RESC, ...CONF, ...NOTIF, ...JUR] };
  CLAUSULAS.autoedicion = [
    { id: 'objeto', t: 'Objeto y naturaleza', fuente: 'CCyC, arts. 1251 y 1252; Ley 11.723, arts. 37 y 40', porque: 'Este no es un contrato de edición. En el de edición (arts. 37 y 40 de la Ley 11.723) el editor se obliga a reproducir y vender la obra y debe fijarse la retribución del autor; acá el autor paga por servicios y queda dueño de todo. Que el contrato lo diga claramente evita confusiones sobre quién invierte y quién gana.', ref: [{ sim: 'leyes', t: 'Ver la ficha de la Ley 11.723' }],
      f: g => `${g('p2')} (el ${g.r.b}) prestará a ${g('p1')} (el ${g.r.a}) los servicios editoriales detallados en la cláusula siguiente para la obra «${g('obra')}» (la OBRA). Este contrato es de prestación de servicios y no un contrato de edición: el ${g.r.b} no se obliga a editar la OBRA por su cuenta ni adquiere derechos sobre ella, y el ${g.r.a} no cobra regalías por los servicios.` },
    { id: 'servicios', t: 'Servicios incluidos', fuente: 'CCyC, art. 1251', porque: 'La lista de servicios define qué comprás. Todo lo que no figura, no está incluido y se presupuesta aparte.', ref: [{ sim: 'tarifario', t: 'Mirá los tarifarios de cada servicio' }],
      f: g => { const s = [g.v.sCorreccion && 'corrección', g.v.sDiseno && 'diseño de tapa', g.v.sMaquet && 'maquetación del interior', g.v.sISBN && 'gestión de ISBN y depósito legal', g.v.sImpresion && 'impresión', g.v.sDistrib && 'distribución o venta en librerías', g.v.sDigital && 'edición digital', g.v.sDifusion && 'difusión y prensa'].filter(Boolean); return `Los servicios incluidos son: ${s.length ? lista(s) : FALTA('al menos un servicio')}.${g.v.sCorreccion || g.v.sDiseno || g.v.sMaquet ? ` Incluye ${g('rondas', 'rondas de corrección')} ronda(s) de corrección de pruebas del ${g.r.a}.` : ''} Todo servicio no mencionado queda fuera y se presupuesta aparte.`; } },
    { id: 'precio', t: 'Precio y forma de pago', fuente: 'CCyC, arts. 1255 y 1257', porque: 'El precio lo fijan las partes (art. 1255). Pedí un presupuesto desglosado por servicio y guardá los comprobantes.',
      f: g => { const a = num(g.v.anticipoPct); return `El precio total de los servicios es de ${g.m('precio', 'precio total')}, precio global.${a ? ` El ${a} % se paga al firmar y el saldo, contra la entrega de la edición.` : ' Se paga contra la entrega de la edición.'} Los pagos se harán dentro de los ${g('diasPago', 'días para pagar')} días corridos de cada vencimiento.${pagoUsd(g)}`; } },
    { id: 'plazos', t: 'Plazos y aprobación de pruebas', fuente: 'CCyC, art. 1256', porque: 'Nada se imprime sin tu aprobación escrita de la prueba final: cualquier error posterior es costoso.',
      f: g => `El ${g.r.b} cumplirá los servicios dentro de ${g('mesesEjecucion', 'meses de ejecución')} meses desde la firma y la entrega del original definitivo. No se imprimirá ni publicará nada sin la aprobación escrita de la prueba final por el ${g.r.a}.` },
    { id: 'derechos', t: 'Derechos sobre la obra', fuente: 'Ley 11.723, arts. 4 y 38', porque: 'El autor es el titular (art. 4) y, aun en un contrato de edición, conserva sus derechos salvo que los renuncie (art. 38). Acá no cede nada: el prestador solo reproduce lo que se encargó.',
      f: g => `El ${g.r.a} conserva todos los derechos de autor sobre la OBRA, incluidos los de futuras ediciones, traducciones y adaptaciones. El ${g.r.b} no adquiere ningún derecho de explotación y solo está autorizado a reproducir la OBRA para cumplir los servicios contratados. El ${g.r.a} puede editar la OBRA con otras personas cuando quiera.` },
    { id: 'archivos', t: 'Archivos finales', fuente: 'Práctica contractual habitual', opcional: true, def: true, revisar: true, porque: 'Sin los archivos editables, cambiar de imprenta o hacer una reimpresión puede significar pagar de nuevo el diseño. Pedilos por escrito.',
      f: g => g.v.abiertos ? `Al terminar y con el precio pagado, el ${g.r.b} entregará al ${g.r.a} los archivos finales, editables y cerrados, de la maquetación y de la tapa, para su uso exclusivo en esta OBRA.` : `Al terminar y con el precio pagado, el ${g.r.b} entregará al ${g.r.a} los archivos finales cerrados (PDF de impresión). Los archivos editables quedan en poder del ${g.r.b}.` },
    { id: 'isbn', t: 'ISBN', fuente: 'Ley 22.399 (ISBN)', cond: v => v.sISBN, revisar: true, porque: 'Quién figura como titular del ISBN suele ser quien edita. Si el prestador gestiona el ISBN a su nombre, el autor puede quedar atado a él para reimprimir.', ref: [{ sim: 'leyes', t: 'Ver la ficha de la Ley 22.399' }],
      f: g => `El ISBN de la OBRA ${g.v.isbnTitular === 'prestador' ? `se gestiona a nombre del ${g.r.b}, que lo mantendrá vigente para las ediciones del ${g.r.a}` : `se gestiona a nombre del ${g.r.a}`}. El ${g.r.b} tramitará también el depósito legal.` },
    { id: 'ejemplares', t: 'Ejemplares', fuente: 'Práctica contractual habitual', cond: v => v.sImpresion, revisar: true, porque: 'Si el prestador guarda tus ejemplares, preguntá dónde, por cuánto tiempo y cuánto cobra.',
      f: g => `Se imprimirán ${g('tirada', 'tirada')} ejemplares. ${g.v.stock === 'prestador' ? `Los ejemplares son propiedad del ${g.r.a}; el ${g.r.b} los guarda por cuenta del ${g.r.a}, que podrá retirarlos cuando lo pida.` : `Los ejemplares se entregarán al ${g.r.a}, que es su propietario.`}` },
    { id: 'distribucion', t: 'Distribución y cuentas', fuente: 'Práctica editorial; modelo AATI, cláusula 3.D (adaptada)', cond: v => v.sDistrib, revisar: true, porque: 'Si el prestador vende por vos, definí la comisión, cada cuánto rinde cuentas y cuándo te paga.',
      f: g => `El ${g.r.b} distribuirá o venderá los ejemplares por cuenta del ${g.r.a} y cobrará una comisión del ${g('comision', 'comisión')} % del precio de venta al público de cada ejemplar vendido. Cada ${g('mesesInforme', 'meses de informe')} meses enviará al ${g.r.a} un informe con ejemplares vendidos, devueltos y en depósito, y le pagará lo que le corresponda dentro de los 30 días de enviado.` },
    { id: 'contenido', t: 'Responsabilidad por el contenido', fuente: 'Práctica contractual habitual', opcional: true, def: true, revisar: true, porque: 'El autor responde por el contenido; el prestador, por su trabajo. Dejarlo escrito reparte los riesgos.',
      f: g => `El ${g.r.a} declara que la OBRA es original y que no infringe derechos de terceros, y responde por su contenido. El ${g.r.b} responde por la calidad de los servicios contratados.` },
    cConfidencialidad(), cIA(), cImprevision(), cNotificaciones(),
    cRescision(r => `Resuelto el contrato, el ${r.a} conserva todos los derechos sobre la OBRA y paga lo ya realizado.`), cJurisdiccion()];

  // ============================ Audiolibro ============================
  MODELOS.audiolibro = { id: 'audiolibro', t: 'Contrato de cesión de derechos para audiolibro', corto: 'Audiolibro',
    d: 'Quien tiene los derechos de un libro autoriza a una productora a hacer y vender su versión en audio: formato, narración, territorio, plazo, regalías y qué pasa con la voz.',
    roles: { a: 'TITULAR', b: 'PRODUCTOR/A' }, partes: [['p1', 'dom1'], ['p2', 'dom2']],
    campos: [...PARTES('Nombre del titular de los derechos (autor/a o editorial)', 'Nombre de la productora de audio'),
      T('obra', 'Título de la obra', ''), T('autor', 'Autor o autora', ''), T('idioma', 'Idioma del audiolibro', 'español'),
      K('aIntegro', 'Audiolibro íntegro', true, 'Versiones'), K('aAbreviado', 'Versión abreviada', false, 'Versiones', { ayuda: 'Los cortes requieren aprobación del titular.' }),
      O('cesion', 'Qué se concede', 'licencia', [['licencia', 'Licencia exclusiva de uso'], ['cesion', 'Cesión de los derechos de edición en audio']]),
      O('territorio', 'Territorio', 'ar', TERR_OPC), O('exclusividad', 'Exclusividad', 'exclusiva', [['exclusiva', 'Exclusiva'], ['noexclusiva', 'No exclusiva']]), N('plazoAnios', 'Duración (años)', ''),
      O('narracion', 'Narración', 'humana', [['humana', 'Narración humana'], ['sintetica', 'Voz sintética (inteligencia artificial)']]),
      N('mesesPublicacion', 'Plazo para publicar el audiolibro (meses)', ''),
      O('forma', 'Forma de retribución', 'regalia', [['regalia', 'Regalías'], ['mixto', 'Anticipo más regalías'], ['unico', 'Pago único']]), N('precio', 'Anticipo o pago único', '', { si: v => v.forma !== 'regalia' }), ...MONEDA,
      O('base', 'Base de cálculo de la regalía', 'neto', [['neto', 'Ingresos netos que recibe la productora'], ['precio', 'Precio de venta al público']], { si: v => v.forma !== 'unico' }), N('regalia', 'Regalía (%)', '', { si: v => v.forma !== 'unico' }),
      N('mesesInforme', 'Cada cuántos meses se rinden cuentas', 6, { ayuda: 'Valor de ejemplo: ajustalo.' }), N('diasPago', 'Días para pagar', 30, { ayuda: 'Valor de ejemplo: ajustalo.' }),
      T('plataformas', 'Plataformas de distribución (opcional)', '', { si: v => v.inc_plataformas }),
      ...RESC, ...CONF, ...NOTIF, ...JUR] };
  CLAUSULAS.audiolibro = [
    { id: 'objeto', t: 'Objeto', fuente: 'CCyC, art. 1614; Ley 11.723, arts. 51 y 38', porque: 'Pasar un libro a audio es una forma distinta de explotarlo: el contrato de edición en papel no la incluye salvo que se lo pacte (art. 38: el editor solo tiene los derechos que se le conceden). La cesión de otra explotación requiere acuerdo expreso.', ref: [{ sim: 'leyes', t: 'Ver las fichas de la Ley 11.723' }],
      vars: [{ k: 'licencia', etq: 'Licencia exclusiva de uso', f: g => `${g('p1')} (el ${g.r.a}) concede a ${g('p2')} (el ${g.r.b}) una licencia para producir y explotar versiones en audio de la obra «${g('obra')}», de ${g('autor')} (la OBRA), en los términos de este contrato. El ${g.r.a} conserva la titularidad de los derechos.` },
        { k: 'cesion', etq: 'Cesión de los derechos en audio', f: g => `${g('p1')} (el ${g.r.a}) cede a ${g('p2')} (el ${g.r.b}) los derechos de edición y explotación en formato de audio de la obra «${g('obra')}», de ${g('autor')} (la OBRA), en los términos de este contrato. El ${g.r.a} conserva todos los demás derechos.` }] },
    { id: 'alcance', t: 'Versiones y reserva de derechos', fuente: 'Ley 11.723, arts. 38 y 52', porque: 'Un audiolibro no es un resumen: acotá qué versión se hace. El art. 52 conserva al autor la fidelidad del texto: cortes y cambios necesitan su aprobación.',
      f: g => { const a = [g.v.aIntegro && 'audiolibro íntegro', g.v.aAbreviado && 'versión abreviada']; return `El ${g.r.b} podrá producir y explotar en idioma ${g('idioma', 'idioma')}: ${lista(a.filter(Boolean)).replace(/^$/, FALTA('al menos una versión'))}. Los cortes, abreviaciones o cambios del texto requieren la aprobación previa y escrita del ${g.r.a}. Quedan reservados al ${g.r.a} los demás formatos (papel, digital, otras adaptaciones) y todo uso que no figure acá.`; } },
    { id: 'territorio', t: 'Territorio, exclusividad y plazo', fuente: 'Ley 11.723, art. 51; práctica contractual', revisar: true, porque: 'La exclusividad vale más: si la das, pedí mejor retribución o menos plazo. Fijá siempre un plazo.',
      f: g => `La autorización rige para ${TERR[g.v.territorio] || FALTA('territorio')}, por ${g('plazoAnios', 'años de duración')} años desde la firma, y ${g.v.exclusividad === 'noexclusiva' ? 'es no exclusiva' : 'es exclusiva'}. Vencido el plazo, los derechos vuelven al ${g.r.a}, y el ${g.r.b} retirará el audiolibro de todos los canales de venta en un plazo de 30 días.` },
    { id: 'narracion', t: 'Narración', fuente: 'Práctica contractual emergente (sin norma específica)', revisar: true, porque: 'La narración es la parte más delicada. Una voz humana implica sus propios derechos (los de quien narra); una voz sintética abre cuestiones nuevas, como no imitar a una persona real sin su permiso. Es un tema poco asentado: que lo revise un/a abogado/a.',
      vars: [{ k: 'humana', etq: 'Narración humana', f: g => `La narración la hará una persona, que el ${g.r.b} elige y contrata por su cuenta, y consigue de ella las autorizaciones necesarias para la explotación pactada. El ${g.r.b} responde ante el ${g.r.a} por esas autorizaciones. El ${g.r.a} puede aprobar una muestra antes de la grabación definitiva.` },
        { k: 'sintetica', etq: 'Voz sintética (inteligencia artificial)', f: g => `El ${g.r.a} autoriza que la narración se genere con voz sintética. No se podrá imitar ni clonar la voz de una persona real sin su autorización escrita, y el ${g.r.b} informará qué herramienta usa. El ${g.r.a} podrá aprobar una muestra antes de la versión definitiva.` }] },
    { id: 'publicacion', t: 'Plazo para publicar y reversión', fuente: 'Ley 11.723, art. 42 (por analogía); práctica contractual', revisar: true, porque: 'El art. 42 manda fijar plazo de publicación en la edición; en el audio conviene lo mismo, y que los derechos vuelvan si no se publica.',
      f: g => `El ${g.r.b} publicará el audiolibro dentro de ${g('mesesPublicacion', 'meses para publicar')} meses de la firma. Si no lo hace, el ${g.r.a} puede dar por terminado el contrato sin más trámite, conserva lo cobrado y recupera los derechos.` },
    { id: 'retribucion', t: 'Retribución', fuente: 'Ley 11.723, art. 40 (por analogía); CCyC, art. 1614', revisar: true, porque: 'Lo que más cambia el resultado es la base de cálculo: sobre ingresos netos (después de comisiones de las plataformas) o sobre el precio de venta. Que quede escrito. Y pedí rendiciones de cuentas periódicas.',
      f: g => { const f = g.v.forma, base = g.v.base === 'precio' ? 'del precio de venta al público' : 'de los ingresos netos que efectivamente recibe el ' + g.r.b + ' por la venta de la OBRA en audio, sin otras deducciones que las comisiones de las plataformas'; const reg = `el ${g('regalia', 'regalía')} % ${base}`; return (f === 'unico' ? `El ${g.r.b} pagará al ${g.r.a} un pago único de ${g.m('precio', 'monto')}, no reembolsable.` : f === 'mixto' ? `El ${g.r.b} pagará al ${g.r.a} un anticipo de ${g.m('precio', 'anticipo')}, no reembolsable y a cuenta de regalías, y luego ${reg}.` : `El ${g.r.b} pagará al ${g.r.a} ${reg}.`) + (f === 'unico' ? '' : ` Cada ${g('mesesInforme', 'meses de informe')} meses enviará una liquidación con ventas, plataformas y montos recibidos.`) + ` Los pagos se harán dentro de los ${g('diasPago', 'días para pagar')} días corridos.` + pagoUsd(g); } },
    { id: 'grabacion', t: 'La grabación', fuente: 'Práctica contractual habitual', revisar: true, porque: 'La grabación es un producto distinto del texto. Aclará quién se queda con ella al terminar el contrato y qué puede hacer con ella.',
      f: g => `El ${g.r.b} es dueño de los soportes y archivos de la grabación, pero no puede usarla ni explotarla fuera de los términos de este contrato. Vencido el plazo, dejará de explotarla y, si el ${g.r.a} lo pide, se la ofrecerá antes que a un tercero.` },
    cMoral(r => 'el autor de la OBRA', g => `Los créditos del audiolibro mencionarán al autor de la OBRA, ${g.v.narracion === 'sintetica' ? 'indicarán que la narración es sintética' : 'al narrador o narradora'} y al ${g.r.a}.`),
    { id: 'plataformas', t: 'Plataformas de distribución', fuente: 'Práctica contractual habitual', opcional: true, def: false, revisar: true, porque: 'Cada plataforma tiene sus propias reglas y comisiones. Nombrarlas fija dónde se vende.',
      f: g => `El audiolibro se distribuirá a través de: ${g('plataformas', 'plataformas')}. Para sumar otras, el ${g.r.b} necesita autorización escrita del ${g.r.a}.` },
    { id: 'cuentas', t: 'Rendición de cuentas y auditoría', fuente: 'Práctica contractual habitual', opcional: true, def: true, revisar: true, porque: 'Sin derecho a ver los números, la regalía es un acto de fe.',
      f: g => `El ${g.r.a} podrá pedir, una vez por año y con aviso de 15 días, los comprobantes de ventas y pagos recibidos de las plataformas.` },
    cConfidencialidad(),
    Object.assign(cIA(), { def: true, porque: 'Es la cláusula más importante en audio: una grabación puede usarse para clonar voces o entrenar sistemas. Si querés impedirlo, dejalo escrito.' }),
    cImprevision(), cNotificaciones(),
    cRescision(r => `Resuelto el contrato, los derechos vuelven al ${r.a}.`), cJurisdiccion()];

  // ---------------------------------------------------------------------------------------------------------------
  // Los dos modelos de origen (traducción y edición) también ganan roles, cláusulas elegibles y notas.
  // ---------------------------------------------------------------------------------------------------------------
  MODELOS.traduccion.roles = { a: 'TRADUCTOR/A', b: 'EDITOR/A' };
  MODELOS.edicion.roles = { a: 'AUTOR/A', b: 'EDITOR/A' };
  MODELOS.traduccion.cab = v => `entre ${v.editor || FALTA('editor')} (domicilio y DNI: ______________) y ${v.traductor || FALTA('traductor')} (domicilio y DNI: ______________)`;
  MODELOS.edicion.cab = v => `entre ${v.editor || FALTA('editor')} (domicilio y DNI: ______________) y ${v.autor || FALTA('autor')} (domicilio y DNI: ______________)`;
  ['traduccion', 'edicion'].forEach(id => MODELOS[id].campos.push(...RESC, ...CONF, ...NOTIF));
  const opcLegacy = (c, def) => Object.assign(c, { opcional: true, def: !!def });
  CLAUSULAS.traduccion.splice(CLAUSULAS.traduccion.length - 1, 0, opcLegacy(cRescision(r => `Resuelto el contrato, los derechos vuelven al ${r.a}.`)), cConfidencialidad(), cImprevision(), cNotificaciones());
  CLAUSULAS.edicion.splice(CLAUSULAS.edicion.length - 1, 0, opcLegacy(cRescision(r => `Resuelto el contrato, los derechos vuelven al ${r.a}.`)), cConfidencialidad(), cImprevision(), cNotificaciones());
  const NOTAS = {
    traduccion: {
      'Partes y objeto': 'Quien traduce es autor/a de su traducción (art. 4 de la Ley 11.723 la reconoce como titular a quien traduce con permiso del autor). Por eso el contrato es una cesión parcial y debe decir qué se cede.',
      'Autorizaciones': 'Lo que no se nombra queda reservado a quien traduce. Mientras la obra original esté protegida, traducir exige permiso de su titular.',
      'Territorio': 'El territorio limita dónde puede vender el editor. Más territorio, más valor de la cesión.',
      'Anticipo': 'El modelo de la AATI usa una tarifa por mil palabras. Comparala con el tarifario público antes de aceptar un número.',
      'Regalías y liquidación': 'Sin liquidación anual y facturas, no hay cómo controlar las ventas.',
      'Entrega, aceptación y revisión': 'Los plazos de aceptación y revisión evitan que el pago quede colgado.',
      'Edición': 'La tirada mínima y el plazo de publicación impiden que la traducción quede guardada sin salir.',
      'Plazo del contrato': 'Un plazo corto permite recuperar los derechos y renegociar. La AATI recomienda no pasar de 5 años.',
      'Derecho moral y créditos': 'El art. 23 de la Ley 11.723 condiciona la propiedad del derecho de traducción a que el contrato se inscriba en el Registro Nacional de Propiedad Intelectual dentro del año de publicación: consultá con un/a abogado/a cómo se hace el trámite.',
      'Ejemplares de cortesía': 'Es un detalle chico que suele olvidarse: pedilo por escrito.',
      'Stock excedente, saldo y destrucción': 'Evita que el libro se liquide o se destruya sin que quien tradujo se entere.',
      'Cesión del contrato': 'Si el editor vende el contrato, quien tradujo debería cobrar una parte.',
      'Ley aplicable y tribunales': 'Elegir lugar y ley evita discusiones sobre dónde reclamar.' },
    edicion: {
      'Partes y objeto': 'El art. 37 define el contrato de edición: el titular entrega la obra y el editor se obliga a reproducirla, difundirla y venderla.',
      'Derechos que se conceden': 'Los arts. 38 y 39 limitan al editor a los derechos de impresión, difusión y venta. Lo demás queda con el autor.',
      'Ediciones y ejemplares': 'El art. 40 exige que conste el número de ediciones y los ejemplares de cada una. Sin esos datos, se aplican los usos y costumbres del lugar.',
      'Retribución': 'El art. 40 también exige la retribución del autor y presume el contrato oneroso. Pedí una liquidación por escrito cada año.',
      'Entrega de la obra': 'El art. 41 reparte el riesgo si la obra se pierde.',
      'Publicación': 'El art. 42 manda fijar plazo de publicación; si no hay, lo fija un tribunal. Acordalo vos antes.',
      'Duración y fin del contrato': 'El art. 43 prevé qué pasa con los ejemplares que sobran, y el art. 44 termina el contrato cuando se agotan las ediciones.',
      'Ejemplares y compras del autor': 'Detalle práctico: pedilo por escrito.',
      'Créditos': 'La mención del nombre es parte del derecho moral del autor (art. 52).',
      'Ley aplicable y tribunales': 'Elegir lugar y ley evita discusiones sobre dónde reclamar.' } };
  const REFS = { traduccion: { 'Anticipo': [{ sim: 'tarifario', t: 'Mirá los tarifarios de traducción' }] }, edicion: { 'Partes y objeto': [{ sim: 'leyes', t: 'Ver la ficha de la Ley 11.723' }] } };
  Object.keys(NOTAS).forEach(id => CLAUSULAS[id].forEach(c => { if (NOTAS[id][c.t]) c.porque = NOTAS[id][c.t]; if (REFS[id][c.t]) c.ref = REFS[id][c.t]; }));
  CLAUSULAS.traduccion.find(c => c.t === 'Derecho moral y créditos').fuente = 'Modelo AATI, cláusula 7; Ley 11.723, arts. 23 y 52';

  const slug = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  // Suma, por cada cláusula elegible, el campo que la prende o la cambia de variante.
  (function completar() {
    Object.keys(MODELOS).forEach(id => {
      const m = MODELOS[id];
      CLAUSULAS[id].forEach(c => {
        if (!c.id) c.id = slug(c.t);
        if (c.opcional && !m.campos.some(x => x.id === 'inc_' + c.id)) m.campos.push(K('inc_' + c.id, 'Incluir «' + c.t + '»', c.def, 'Cláusulas a elegir'));
        if (c.vars && !c.campo && !m.campos.some(x => x.id === 'var_' + c.id)) m.campos.push(O('var_' + c.id, 'Cómo redactar «' + c.t + '»', c.vars[0].k, c.vars.map(x => [x.k, x.etq]), { grupo: 'Cláusulas a elegir' }));
      });
    });
  })();
  ['objeto', 'derechos'].forEach(k => { const c = CLAUSULAS.encargo.find(x => x.id === k); if (c && c.vars) c.campo = 'uso'; });
  CLAUSULAS.audiolibro.find(c => c.id === 'objeto').campo = 'cesion';
  CLAUSULAS.audiolibro.find(c => c.id === 'narracion').campo = 'narracion';
  // (el campo de variante de esas tres cláusulas ya existe en el formulario; se saca el duplicado si se había sumado)
  Object.keys(MODELOS).forEach(id => { MODELOS[id].campos = MODELOS[id].campos.filter(f => !(f.id.indexOf('var_') === 0 && CLAUSULAS[id].some(c => c.campo && 'var_' + c.id === f.id))); });
  const blanco = x => x === '' || x == null || (typeof x === 'string' && !x.trim());
  const incluida = (c, v) => { if (c.cond && !c.cond(v)) return false; if (c.opcional) { const x = v['inc_' + c.id]; return x == null ? !!c.def : !!x; } return true; };
  const variante = (c, v) => { const k = c.campo ? v[c.campo] : v['var_' + c.id]; return c.vars.find(x => x.k === k) || c.vars[0]; };
  const defaults2 = id => { const v = {}; MODELOS[id].campos.forEach(c => { v[c.id] = c.def; }); return v; };
  const visible = (c, v) => !c.si || !!c.si(v);

  // Devuelve cláusulas ya redactadas, la lista de datos que faltan y avisos sobre valores por debajo de lo sugerido.
  function generar(id, v) {
    const m = MODELOS[id], etq = {}; m.campos.forEach(c => { etq[c.id] = c.etq; });
    const falta = [];
    const g = (k, e) => { const x = v[k]; if (blanco(x)) { if (falta.indexOf(k) < 0) falta.push(k); return FALTA(e || (etq[k] || k).toLowerCase()); } return typeof x === 'number' ? pct(x) : x; };
    g.v = v; g.r = m.roles || {};
    g.m = (k, e) => blanco(v[k]) ? g(k, e) : (USD(v) ? 'US$ ' : '$ ') + miles(v[k]);
    let n = 0;
    const clausulas = [];
    CLAUSULAS[id].forEach(c => {
      if (!incluida(c, v)) return;
      const vr = c.vars ? variante(c, v) : null;
      clausulas.push({ n: ++n, id: c.id, t: c.t, fuente: c.fuente, texto: (vr || c).f(g), porque: c.porque || '', ref: c.ref || [], revisar: !!c.revisar, opcional: !!c.opcional, variante: vr ? vr.etq : '' });
    });
    return { modelo: m, clausulas, falta: falta.map(k => etq[k] || k), avisos: avisos(id, v) };
  }

  const entre0y100 = [['regalia', 'La regalía'], ['regaliaDigital', 'La regalía digital'], ['anticipoPct', 'El porcentaje al firmar'], ['desistPct', 'La compensación por desistir'], ['costoA', 'El porcentaje de costos'], ['ejA', 'El porcentaje de ejemplares'], ['comision', 'La comisión'], ['descuento', 'El descuento']];
  const AV_TIPO = {
    cesion: v => { const a = [], p = num(v.plazoAnios); if (p != null && p > 10) a.push(`Ceder por ${p} años es mucho tiempo: el plazo general de protección ya es de 70 años desde la muerte del autor (art. 5 de la Ley 11.723). Pensá si no conviene un plazo menor para poder renegociar.`); if (v.exclusividad === 'exclusiva' && v.forma === 'unico') a.push('Una cesión exclusiva con pago único te deja sin ingresos futuros por la obra: conviene que el pago lo compense.'); if (v.territorio === 'mu' && v.exclusividad === 'exclusiva') a.push('Ceder en exclusiva para todo el mundo limita mucho tus opciones: ¿de verdad el cesionario lo va a explotar en todos lados?'); return a; },
    encargo: v => { const a = []; if (v.uso === 'cesion' && num(v.plazoAnios) == null) a.push('Si cedés los derechos, definí por cuánto tiempo.'); return a; },
    ilustracion: v => { const a = []; if (v.uProd) a.push('Los productos derivados (merchandising) suelen valer aparte: revisá si el precio los contempla.'); if (!v.uTapa && !v.uInterior && !v.uPromo && !v.uDigital && !v.uProd) a.push('No marcaste ningún uso autorizado.'); return a; },
    correccion: v => { const a = [], t = totalServ(v); if (v.unidad === 'proyecto' && num(v.cantidad) != null && num(v.cantidad) !== 1) a.push('En «proyecto» la cantidad se ignora: la tarifa es el total.'); if (t != null && USD(v) === false && t < 0) a.push('El total no puede ser negativo.'); return a; },
    coedicion: v => { const a = []; if (v.terrA && v.terrB && String(v.terrA).trim().toLowerCase() === String(v.terrB).trim().toLowerCase()) a.push('Las dos editoriales tienen el mismo territorio de venta: revisá si querés repartirlos.'); return a; },
    autoedicion: v => { const a = []; if (v.sISBN && v.isbnTitular === 'prestador') a.push('Si el ISBN queda a nombre del prestador, para reimprimir vas a depender de él. Considerá pedirlo a tu nombre.'); if (v.sDistrib && !v.sImpresion) a.push('Marcaste distribución sin impresión: revisá si los ejemplares los provee otro.'); return a; },
    audiolibro: v => { const a = []; if (v.narracion === 'sintetica') a.push('La voz sintética es un terreno nuevo, con reglas poco asentadas. Que un/a abogado/a revise esa cláusula antes de firmar.'); if (v.base === 'precio' && v.forma !== 'unico') a.push('Con la regalía sobre el precio de venta, asegurate de que la productora también te rinda cuentas de lo que recibe de las plataformas.'); return a; } };
  function avisos(id, v) {
    const a = [], n = k => num(v[k]);
    if (id === 'traduccion') {
      const pub = v.dominio === 'publico', minR = pub ? 5 : 1, minD = pub ? 5 : 2.5;
      if (n('regalia') != null && n('regalia') < minR) a.push(`La regalía (${pct(n('regalia'))} %) está por debajo del mínimo que sugiere la AATI (${pct(minR)} %).`);
      if (v.digital && n('regaliaDigital') != null && n('regaliaDigital') < minD) a.push(`La regalía digital (${pct(n('regaliaDigital'))} %) está por debajo del mínimo que sugiere la AATI (${pct(minD)} %).`);
      if (n('ventaMin') != null && n('ventaMin') < 50) a.push('La AATI sugiere un mínimo de 50 ejemplares anuales para considerar agotada la edición.');
    }
    if (id === 'traduccion' || id === 'edicion') {
      if (n('plazoAnios') != null && n('plazoAnios') > 5) a.push(`La duración (${n('plazoAnios')} años) supera los 5 años que recomienda la AATI. Un plazo largo o abierto («por todo el término de la ley») fue discutido en tribunales.`);
      if (n('nEdiciones') != null && (n('nEdiciones') < 1 || n('nEdiciones') % 1)) a.push('La cantidad de ediciones tiene que ser un número entero desde 1.');
    } else if (AV_TIPO[id]) a.push(...AV_TIPO[id](v));
    if (id !== 'traduccion' && id !== 'edicion') entre0y100.forEach(([k, e]) => { if (MODELOS[id].campos.some(c => c.id === k) && n(k) != null && (n(k) < 0 || n(k) > 100)) a.push(`${e} tiene que estar entre 0 y 100.`); });
    if (id === 'coedicion' || id === 'autoedicion') { /* sin regla extra */ }
    return a;
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Documento: una estructura común que se vuelca a Markdown, texto plano, HTML (para imprimir) y .docx.
  // ---------------------------------------------------------------------------------------------------------------
  function estructura(id, v, o) {
    o = o || {};
    const r = generar(id, v), m = r.modelo, lug = 'En ______________, a los ___ días del mes de ______________ de ______, ';
    const nom = (k, e) => v[k] || FALTA(e), dom = k => v[k] ? `con domicilio en ${v[k]}` : 'domicilio y DNI o CUIT: ______________';
    const cab = lug + (m.cab ? m.cab(v) : `entre ${nom('p1', 'primera parte')} (${dom('dom1')}) y ${nom('p2', 'segunda parte')} (${dom('dom2')})`) + ':';
    return { id, franja: franja(id), titulo: m.t.toUpperCase(), aviso: 'Borrador generado con Galera (galera.com.ar). ' + AVISO, cab, clausulas: r.clausulas, falta: r.falta,
      cierre: 'Para que conste, las partes firman dos ejemplares de un mismo tenor.', firmas: [m.roles.a, m.roles.b], notas: !!o.notas };
  }
  const anexo = e => e.clausulas.map(c => ({ n: c.n, t: c.t, fuente: c.fuente, porque: c.porque, revisar: c.revisar }));
  const TIT_ANEXO = 'Anexo: notas de redacción (no forman parte del contrato)';
  const NOTA_ANEXO = 'Cada cláusula indica de dónde sale. Las marcadas «a revisar por abogado/a» no tienen una norma que las respalde o admiten opciones que conviene que un profesional evalúe.';

  function documento(id, v, o) {
    const e = estructura(id, v, o), L = [`# ${e.titulo}`, '', ...(e.franja ? [`> **${e.franja.t.toUpperCase()}.** ${e.franja.d}`, ''] : []), `> ${e.aviso}`, '', e.cab, '', ...e.clausulas.map(c => `**${c.n}. ${c.t}.** ${c.texto}`).flatMap(x => [x, '']), e.cierre, '', '______________________ &nbsp;&nbsp;&nbsp;&nbsp; ______________________', `${e.firmas[0]} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${e.firmas[1]}`, ''];
    if (e.notas) L.push('---', '', `## ${TIT_ANEXO}`, '', NOTA_ANEXO, '', ...anexo(e).flatMap(c => [`**${c.n}. ${c.t}.** Fuente: ${c.fuente}.${c.porque ? ' Por qué importa: ' + c.porque : ''}${c.revisar ? ' *A revisar por abogado/a.*' : ''}`, '']));
    return L.join('\n');
  }
  function texto(id, v, o) {
    const e = estructura(id, v, o), L = [e.titulo, '='.repeat(e.titulo.length), '', ...(e.franja ? [`>>> ${e.franja.t.toUpperCase()}. ${e.franja.d} <<<`, ''] : []), e.aviso, '', e.cab, '', ...e.clausulas.map(c => `${c.n}. ${c.t}. ${c.texto}`).flatMap(x => [x, '']), e.cierre, '', '______________________        ______________________', `${e.firmas[0]}${' '.repeat(Math.max(2, 30 - e.firmas[0].length))}${e.firmas[1]}`, ''];
    if (e.notas) L.push('', TIT_ANEXO.toUpperCase(), '', NOTA_ANEXO, '', ...anexo(e).flatMap(c => [`${c.n}. ${c.t}. Fuente: ${c.fuente}.${c.porque ? ' Por qué importa: ' + c.porque : ''}${c.revisar ? ' [A revisar por abogado/a]' : ''}`, '']));
    return L.join('\n');
  }
  const xesc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const marcar = s => xesc(s).replace(/\[completar: [^\]]*\]/g, m => `<mark>${m}</mark>`);
  // HTML autónomo del contrato (se usa para imprimir o guardar como PDF).
  function html(id, v, o) {
    const e = estructura(id, v, o);
    return `<h1>${xesc(e.titulo)}</h1>${e.franja ? `<p class="rc-franja"><b>${xesc(e.franja.t)}.</b> ${xesc(e.franja.d)}</p>` : ''}<p class="rc-aviso">${xesc(e.aviso)}</p><p>${marcar(e.cab)}</p>` + e.clausulas.map(c => `<p><b>${c.n}. ${xesc(c.t)}.</b> ${marcar(c.texto)}</p>`).join('') + `<p>${xesc(e.cierre)}</p><div class="rc-firmas"><p>______________________<br>${xesc(e.firmas[0])}</p><p>______________________<br>${xesc(e.firmas[1])}</p></div>`
      + (e.notas ? `<h2>${xesc(TIT_ANEXO)}</h2><p>${xesc(NOTA_ANEXO)}</p>` + anexo(e).map(c => `<p><b>${c.n}. ${xesc(c.t)}.</b> Fuente: ${xesc(c.fuente)}.${c.porque ? ' Por qué importa: ' + xesc(c.porque) : ''}${c.revisar ? ' <i>A revisar por abogado/a.</i>' : ''}</p>`).join('') : '');
  }

  // .docx sin dependencias: un ZIP sin comprimir con las partes mínimas de un documento de Word.
  let TABLA_CRC = null;
  function crc32(b) {
    if (!TABLA_CRC) { TABLA_CRC = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; TABLA_CRC[n] = c >>> 0; } }
    let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = TABLA_CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function zip(archivos) {
    const enc = new TextEncoder(), partes = [], central = []; let pos = 0;
    archivos.forEach(a => {
      const nom = enc.encode(a.nombre), dat = typeof a.datos === 'string' ? enc.encode(a.datos) : a.datos, crc = crc32(dat);
      const loc = new DataView(new ArrayBuffer(30)); loc.setUint32(0, 0x04034b50, true); loc.setUint16(4, 20, true); loc.setUint16(6, 0x0800, true); loc.setUint16(8, 0, true); loc.setUint16(10, 0, true); loc.setUint16(12, 0x21, true);
      loc.setUint32(14, crc, true); loc.setUint32(18, dat.length, true); loc.setUint32(22, dat.length, true); loc.setUint16(26, nom.length, true); loc.setUint16(28, 0, true);
      const cen = new DataView(new ArrayBuffer(46)); cen.setUint32(0, 0x02014b50, true); cen.setUint16(4, 20, true); cen.setUint16(6, 20, true); cen.setUint16(8, 0x0800, true); cen.setUint16(10, 0, true); cen.setUint16(12, 0, true); cen.setUint16(14, 0x21, true);
      cen.setUint32(16, crc, true); cen.setUint32(20, dat.length, true); cen.setUint32(24, dat.length, true); cen.setUint16(28, nom.length, true); cen.setUint32(42, pos, true);
      partes.push(new Uint8Array(loc.buffer), nom, dat); central.push(new Uint8Array(cen.buffer), nom); pos += 30 + nom.length + dat.length;
    });
    const tam = central.reduce((s, x) => s + x.length, 0), fin = new DataView(new ArrayBuffer(22));
    fin.setUint32(0, 0x06054b50, true); fin.setUint16(8, archivos.length, true); fin.setUint16(10, archivos.length, true); fin.setUint32(12, tam, true); fin.setUint32(16, pos, true);
    const todo = partes.concat(central, [new Uint8Array(fin.buffer)]), total = todo.reduce((s, x) => s + x.length, 0), sal = new Uint8Array(total); let p = 0;
    todo.forEach(x => { sal.set(x, p); p += x.length; }); return sal;
  }
  function docx(id, v, o) {
    const e = estructura(id, v, o), W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
    const run = (t, f) => { f = f || {}; const rpr = (f.b ? '<w:b/>' : '') + (f.i ? '<w:i/>' : '') + (f.sz ? `<w:sz w:val="${f.sz}"/>` : '') + (f.mark ? '<w:highlight w:val="yellow"/>' : ''); return `<w:r>${rpr ? `<w:rPr>${rpr}</w:rPr>` : ''}<w:t xml:space="preserve">${xesc(t)}</w:t></w:r>`; };
    const conMarcas = (t, f) => t.split(/(\[completar: [^\]]*\])/).filter(Boolean).map(s => run(s, Object.assign({}, f, /^\[completar:/.test(s) ? { mark: true } : {}))).join('');
    const par = (runs, p) => { p = p || {}; return `<w:p><w:pPr>${p.keep ? '<w:keepNext/>' : ''}<w:spacing w:after="${p.after == null ? 160 : p.after}" w:line="276" w:lineRule="auto"/><w:jc w:val="${p.jc || 'both'}"/></w:pPr>${runs}</w:p>`; };
    const celda = t => `<w:tc><w:tcPr><w:tcW w:w="4500" w:type="dxa"/></w:tcPr>${par(run('______________________'), { jc: 'center', after: 0 })}${par(run(t, { b: true }), { jc: 'center' })}</w:tc>`;
    const cuerpo = [par(run(e.titulo, { b: true, sz: 30 }), { jc: 'center', after: 240 }), ...(e.franja ? [par(run(e.franja.t.toUpperCase() + '. ', { b: true, mark: true }) + run(e.franja.d, { b: true }), { jc: 'left' })] : []), par(run(e.aviso, { i: true, sz: 20 }), { jc: 'left' }), par(conMarcas(e.cab)),
      ...e.clausulas.map(c => par(run(`${c.n}. ${c.t}. `, { b: true }) + conMarcas(c.texto))), par(run(e.cierre)),
      `<w:tbl><w:tblPr><w:tblW w:w="9000" w:type="dxa"/></w:tblPr><w:tblGrid><w:gridCol w:w="4500"/><w:gridCol w:w="4500"/></w:tblGrid><w:tr>${celda(e.firmas[0])}${celda(e.firmas[1])}</w:tr></w:tbl>`];
    if (e.notas) cuerpo.push(par(run(TIT_ANEXO, { b: true, sz: 26 }), { jc: 'left', keep: true }), par(run(NOTA_ANEXO, { i: true }), { jc: 'left' }), ...anexo(e).map(c => par(run(`${c.n}. ${c.t}. `, { b: true }) + run(`Fuente: ${c.fuente}.${c.porque ? ' Por qué importa: ' + c.porque : ''}${c.revisar ? ' A revisar por abogado/a.' : ''}`), { jc: 'left' })));
    const pie = '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1417" w:right="1417" w:bottom="1417" w:left="1417" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>';
    const X = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
    return zip([
      { nombre: '[Content_Types].xml', datos: X + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>' },
      { nombre: '_rels/.rels', datos: X + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
      { nombre: 'word/_rels/document.xml.rels', datos: X + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
      { nombre: 'word/styles.xml', datos: X + `<w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman" w:eastAsia="Times New Roman"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="es-AR"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style></w:styles>` },
      { nombre: 'word/document.xml', datos: X + `<w:document ${W}><w:body>${cuerpo.join('')}${pie}</w:body></w:document>` }]);
  }

  return { MODELOS, CLAUSULAS, FALTA, AVISO, franja, defaults: defaults2, generar, avisos, documento, texto, html, docx, estructura, zip, crc32, visible, incluida, miles };
})();
if (typeof module !== 'undefined') module.exports = Contratos;
