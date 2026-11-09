#!/usr/bin/env node
// Pruebas del generador de contratos (contratos.js): un caso por tipo, cláusulas elegibles, variantes, cálculos y salidas.
// Sin dependencias: node tools/probar_contratos.js   (desde la raíz del repo)
'use strict';
const path = require('path');
const assert = require('assert');
const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const C = require(path.join(__dirname, '..', 'contratos.js'));

let ok = 0, mal = 0;
const check = (cond, msg) => { if (cond) { ok++; console.log('  ok   ' + msg); } else { mal++; console.log('  FALLA ' + msg); } };
const todo = (r) => JSON.stringify(r.clausulas.map(c => c.texto));
const con = (id, extra) => Object.assign(C.defaults(id), extra);

// Datos completos de cada tipo (valores inventados para la prueba).
const PARTES = { p1: 'Ana Pérez', p2: 'Editorial Sur' };
const CASOS = {
  traduccion: { obra: 'Ficciones', editor: 'Ed. Sur', traductor: 'A. Pérez', autor: 'J. Doe', idioma: 'inglés', milPalabras: 100, mesesEntrega: 6, tiradaMin: 1000 },
  edicion: { obra: 'Ficciones', editor: 'Ed. Sur', autor: 'J. Doe', ejemplares: 1000, regalia: 10, mesesEntrega: 6 },
  cesion: { ...PARTES, obra: 'La casa', plazoAnios: 5, regalia: 8 },
  encargo: { ...PARTES, obra: 'Guion de un libro', entregables: 'un texto de 20.000 palabras', diasEntrega: 60, precio: 500000, proyecto: 'el libro «La casa»', plazoAnios: 3, desistPct: 20 },
  ilustracion: { ...PARTES, obra: 'La casa', trabajo: '12 ilustraciones interiores', diasEntrega: 45, precio: 300000, plazoAnios: 5, desistPct: 20 },
  correccion: { ...PARTES, obra: 'La casa', cantidad: 200, tarifa: 1500, diasEntrega: 30 },
  coedicion: { ...PARTES, obra: 'La casa', autor: 'J. Doe', tirada: 2000, costoA: 60, ejA: 60, terrA: 'Argentina', terrB: 'Chile', regalia: 10, mesesPublicacion: 12, plazoAnios: 5 },
  autoedicion: { ...PARTES, obra: 'La casa', tirada: 300, precio: 800000, mesesEjecucion: 4 },
  audiolibro: { ...PARTES, obra: 'La casa', autor: 'J. Doe', plazoAnios: 5, mesesPublicacion: 12, regalia: 20 }
};

console.log('Los tipos');
const TIPOS = ['traduccion', 'edicion', 'cesion', 'encargo', 'ilustracion', 'correccion', 'coedicion', 'autoedicion', 'audiolibro'];
check(JSON.stringify(Object.keys(C.MODELOS).sort()) === JSON.stringify(TIPOS.slice().sort()), 'hay nueve tipos de contrato');
TIPOS.forEach(id => {
  const cl = C.CLAUSULAS[id], ids = cl.map(c => c.id);
  check(cl.length >= 9, `${id}: tiene ${cl.length} cláusulas (9 o más)`);
  check(new Set(ids).size === ids.length, `${id}: los id de las cláusulas no se repiten`);
  check(cl.every(c => c.fuente && (c.f || (c.vars && c.vars.length))), `${id}: toda cláusula declara fuente y texto`);
  check(cl.every(c => c.porque), `${id}: toda cláusula trae su nota «por qué esto importa»`);
  check(cl.filter(c => c.opcional).length >= 3, `${id}: ofrece al menos tres cláusulas opcionales`);
  const m = C.MODELOS[id], fids = m.campos.map(c => c.id);
  check(new Set(fids).size === fids.length, `${id}: los campos del formulario no se repiten`);
  check(m.roles && m.roles.a && m.roles.b, `${id}: define el rol de cada parte`);
});

console.log('Con los datos vacíos');
TIPOS.forEach(id => {
  const r = C.generar(id, C.defaults(id));
  check(r.falta.length > 0 && todo(r).includes('[completar:'), `${id}: marca lo que falta y no inventa valores`);
});

console.log('Con los datos completos');
TIPOS.forEach(id => {
  const r = C.generar(id, con(id, CASOS[id])), t = todo(r);
  check(r.falta.length === 0, `${id}: no falta ningún dato (${r.falta.join('; ')})`);
  check(!/undefined|NaN|\[object|\$\{/.test(t), `${id}: el texto no trae restos de código`);
  check(r.clausulas.every((c, i) => c.n === i + 1), `${id}: las cláusulas quedan numeradas de corrido`);
});
{
  const r = C.generar('cesion', con('cesion', CASOS.cesion));
  check(r.clausulas[0].texto.includes('Ana Pérez') && r.clausulas[0].texto.includes('«La casa»') && /CEDENTE/.test(r.clausulas[0].texto), 'cesion: las partes y la obra entran en la primera cláusula');
  check(todo(C.generar('cesion', con('cesion', { ...CASOS.cesion, dTraduc: false, dAdapt: false })))
    .includes('reproducción y edición en papel') && !todo(r).includes('traducción a otros idiomas'), 'cesion: solo se ceden los derechos tildados');
  check(todo(C.generar('cesion', con('cesion', { ...CASOS.cesion, exclusividad: 'noexclusiva' }))).includes('Es no exclusiva'), 'cesion: la exclusividad cambia el texto');
  check(todo(r).includes('Es exclusiva'), 'cesion: exclusiva por defecto');
  check(todo(C.generar('cesion', con('cesion', { ...CASOS.cesion, forma: 'unico', precio: 150000 }))).includes('pago único de $ 150.000'), 'cesion: el pago único se escribe con separador de miles');
  check(todo(C.generar('cesion', con('cesion', { ...CASOS.cesion, forma: 'mixto', precio: 50000 }))).includes('anticipo de $ 50.000'), 'cesion: anticipo más regalías');
}

console.log('Cláusulas elegibles y variantes');
{
  const base = con('cesion', CASOS.cesion), n0 = C.generar('cesion', base).clausulas.length;
  const conConf = C.generar('cesion', { ...base, inc_confidencialidad: true });
  check(conConf.clausulas.length === n0 + 1 && conConf.clausulas.some(c => c.id === 'confidencialidad'), 'una cláusula opcional prendida se suma');
  check(C.generar('cesion', { ...base, inc_registro: false }).clausulas.length === n0 - 1, 'una cláusula opcional incluida por defecto se puede sacar');
  const resc = v => C.generar('cesion', { ...base, ...v }).clausulas.find(c => c.id === 'rescision').texto;
  check(!resc({}).includes('sin expresar causa') && resc({ var_rescision: 'preaviso', diasPreaviso: 30 }).includes('preaviso fehaciente de 30 días'), 'la rescisión tiene dos variantes (con y sin preaviso)');
  check(resc({ var_rescision: 'preaviso' }).includes('[completar: días de preaviso]'), 'la variante con preaviso pide los días');
  const jur = v => C.generar('cesion', { ...base, ...v }).clausulas.find(c => c.id === 'jurisdiccion').texto;
  check(jur({}).includes('tribunales ordinarios'), 'jurisdicción: tribunales por defecto');
  check(jur({ var_jurisdiccion: 'negociacion' }).includes('negociación directa') && jur({ var_jurisdiccion: 'negociacion' }).includes('30 días'), 'jurisdicción: negociación previa');
  check(jur({ var_jurisdiccion: 'arbitraje' }).includes('arbitraje') && jur({ var_jurisdiccion: 'arbitraje' }).includes('[completar:'), 'jurisdicción: arbitraje pide la institución');
  check(C.generar('cesion', { ...base, inc_ia: true, var_ia: 'aviso' }).clausulas.find(c => c.id === 'ia').texto.includes('informará antes'), 'la cláusula de IA tiene variantes');
  check(C.generar('cesion', { ...base, inc_notificaciones: true }).falta.length === 2, 'las notificaciones piden los dos correos solo si se incluyen');
  const noti = C.generar('cesion', { ...base, inc_notificaciones: true, mail1: 'a@x.com', mail2: 'b@x.com' });
  check(noti.falta.length === 0 && todo(noti).includes('a@x.com'), 'las notificaciones usan los correos cargados');
  check(C.generar('autoedicion', con('autoedicion', CASOS.autoedicion)).clausulas.every(c => c.id !== 'isbn'), 'autoedicion: sin gestión de ISBN no aparece la cláusula del ISBN');
  const isbn = C.generar('autoedicion', con('autoedicion', { ...CASOS.autoedicion, sISBN: true, isbnTitular: 'prestador' }));
  check(isbn.clausulas.some(c => c.id === 'isbn') && isbn.avisos.some(a => /ISBN/.test(a)), 'autoedicion: con ISBN a nombre del prestador aparece la cláusula y un aviso');
  check(C.generar('autoedicion', con('autoedicion', CASOS.autoedicion)).clausulas.every(c => c.id !== 'distribucion'), 'autoedicion: la distribución solo aparece si se contrata');
  const aud = v => C.generar('audiolibro', con('audiolibro', { ...CASOS.audiolibro, ...v }));
  check(aud({}).clausulas.find(c => c.id === 'narracion').texto.includes('una persona') && aud({ narracion: 'sintetica' }).clausulas.find(c => c.id === 'narracion').texto.includes('voz sintética'), 'audiolibro: la narración humana o sintética cambia la cláusula');
  check(aud({ narracion: 'sintetica' }).avisos.some(a => /voz sintética/.test(a)), 'audiolibro: la voz sintética avisa que conviene revisarla');
  check(aud({ cesion: 'cesion' }).clausulas[0].texto.includes('cede a') && aud({}).clausulas[0].texto.includes('concede a'), 'audiolibro: licencia o cesión');
  check(aud({}).clausulas.some(c => c.id === 'ia'), 'audiolibro: incluye por defecto la cláusula de IA');
  const enc = v => C.generar('encargo', con('encargo', { ...CASOS.encargo, ...v })).clausulas.find(c => c.id === 'derechos').texto;
  check(enc({}).includes('licencia') && enc({ uso: 'cesion' }).includes('cede al'), 'encargo: licencia o cesión de los derechos');
  check(todo(C.generar('encargo', con('encargo', { ...CASOS.encargo, anticipoPct: 30 }))).includes('El 30 % se paga al firmar'), 'encargo: el anticipo se escribe en la cláusula del precio');
}

console.log('Cálculos y monedas');
{
  const cor = v => C.generar('correccion', con('correccion', { ...CASOS.correccion, ...v }));
  check(cor({}).clausulas.find(c => c.id === 'precio').texto.includes('total estimado de $ 300.000'), 'correccion: 200 páginas a $ 1.500 dan $ 300.000');
  check(cor({ unidad: 'proyecto', tarifa: 90000 }).clausulas.find(c => c.id === 'precio').texto.includes('$ 90.000 por el proyecto completo'), 'correccion: por proyecto, la tarifa es el total');
  check(cor({ unidad: 'proyecto', tarifa: 90000, cantidad: 5 }).avisos.length === 1, 'correccion: avisa si cargás cantidad en un proyecto');
  const usd = cor({ moneda: 'usd' });
  check(usd.falta.includes('Cotización para pagar en pesos') && usd.clausulas.find(c => c.id === 'precio').texto.includes('US$ 1.500'), 'correccion: en dólares pide la cotización y escribe US$');
  check(!cor({ moneda: 'usd', cotizacion: 'la del BCRA del día anterior' }).falta.length, 'correccion: con cotización no falta nada');
  check(C.miles(1234567.5) === '1.234.567,5' && C.miles(500) === '500', 'miles(): separa con puntos y coma decimal');
  const coe = C.generar('coedicion', con('coedicion', CASOS.coedicion)).clausulas.find(c => c.id === 'costos').texto;
  check(coe.includes('60 %') && coe.includes('40 %'), 'coedicion: B asume el resto de los costos y de los ejemplares');
  check(C.generar('coedicion', con('coedicion', { ...CASOS.coedicion, costoA: 120 })).avisos.some(a => /entre 0 y 100/.test(a)), 'coedicion: avisa si el porcentaje pasa de 100');
}

console.log('Avisos');
check(C.avisos('cesion', con('cesion', { plazoAnios: 30 })).some(a => /mucho tiempo/.test(a)), 'cesion: avisa si cedés por más de 10 años');
check(C.avisos('cesion', con('cesion', { plazoAnios: 5 })).length === 0, 'cesion: sin avisos con un plazo razonable');
check(C.avisos('traduccion', Object.assign(C.defaults('traduccion'), { regalia: 0.5, plazoAnios: 8, dominio: 'vigente' })).length === 2, 'traduccion: conserva los avisos de la AATI (regalía y plazo)');
check(C.avisos('traduccion', Object.assign(C.defaults('traduccion'), { dominio: 'publico' })).length === 1, 'traduccion: en dominio público el mínimo es 5 %');
check(!C.avisos('cesion', con('cesion', { plazoAnios: 8 })).some(a => /AATI/.test(a)), 'los tipos nuevos no repiten lo de la AATI');

console.log('Solo se citan artículos verificados');
{
  // Artículos cotejados con el texto de InfoLEG (Ley 11.723 y CCyC) para esta herramienta. Si se agrega otro, hay que verificarlo antes.
  const OK = new Set([4, 5, 6, 23, 24, 37, 38, 39, 40, 41, 42, 43, 44, 51, 52, 53, 54, 55, 790, 1077, 1078, 1083, 1086, 1087, 1088, 1091, 1251, 1252, 1253, 1254, 1255, 1256, 1257, 1261, 1262, 1614]);
  const malos = new Set();
  TIPOS.forEach(id => C.CLAUSULAS[id].forEach(c => {
    const textos = [c.fuente, c.porque, ...(c.vars ? [] : [])];
    textos.forEach(t => (String(t).match(/arts?\.\s*[\d.,\sya]+/g) || []).forEach(m => (m.replace(/arts?\./, '').match(/\d[\d.]*/g) || []).forEach(n => { if (!OK.has(Number(n.replace(/\.$/, ''))) && n !== '11.723' && !/^22/.test(n)) malos.add(`${id}/${c.id}: ${n}`); })));
  }));
  check(malos.size === 0, 'ninguna fuente cita un artículo fuera de la lista verificada' + (malos.size ? ': ' + [...malos].join(', ') : ''));
}

console.log('Salidas');
{
  const v = con('cesion', { ...CASOS.cesion, p1: 'Ana <script>x</script> & Cía.' });
  const md = C.documento('cesion', v), tx = C.texto('cesion', v), ht = C.html('cesion', v);
  check(md.startsWith('# CONTRATO DE CESIÓN DE DERECHOS DE AUTOR') && md.includes('no es asesoramiento legal') && md.includes('**1. Partes y objeto.**'), 'markdown: título, aviso legal y cláusulas');
  check(!tx.includes('**') && !tx.includes('&nbsp;') && tx.startsWith('CONTRATO DE CESIÓN') && tx.includes('1. Partes y objeto.'), 'texto plano: sin marcas de Markdown');
  check(!ht.includes('<script>') && ht.includes('&lt;script&gt;') && ht.includes('&amp; Cía.'), 'html: escapa lo que escribe quien usa la herramienta');
  check(ht.includes('<mark>[completar:') === C.generar('cesion', v).falta.length > 0, 'html: marca los datos que faltan');
  check(md.indexOf('Anexo') === -1 && C.documento('cesion', v, { notas: true }).includes('Anexo: notas de redacción'), 'el anexo de notas es opcional');
  check(C.documento('cesion', v, { notas: true }).includes('A revisar por abogado/a'), 'el anexo marca lo que revisa un/a abogado/a');
  check(C.texto('traduccion', C.defaults('traduccion')).includes('TRADUCTOR/A'), 'las firmas llevan el rol de cada parte');
}

console.log('.docx');
{
  const v = con('encargo', CASOS.encargo);
  const z = C.docx('encargo', v, { notas: true });
  check(z instanceof Uint8Array && z[0] === 0x50 && z[1] === 0x4b, 'el .docx es un ZIP (empieza con PK)');
  const tmp = path.join(os.tmpdir(), 'galera-contrato-prueba.docx');
  fs.writeFileSync(tmp, z);
  const py = cp.spawnSync('python', ['-I', '-c', [
    'import sys, zipfile, xml.dom.minidom as M',
    'z = zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None',
    'n = z.namelist(); assert "word/document.xml" in n and "[Content_Types].xml" in n and "_rels/.rels" in n, n',
    'for x in n: M.parseString(z.read(x))',
    'd = z.read("word/document.xml").decode("utf-8"); assert "Guion de un libro" in d and "ENCARGO" in d and "<w:highlight" in d or "[completar" not in d',
    'print("ok")'].join('\n'), tmp], { encoding: 'utf-8' });
  if (py.error) { console.log('  (sin Python: se omite la verificación del ZIP y del XML)'); }
  else check(py.status === 0 && /ok/.test(py.stdout), '.docx: el ZIP pasa testzip y todas sus partes son XML bien formado' + (py.status ? ' ' + py.stderr : ''));
  fs.unlinkSync(tmp);
  const a = C.docx('encargo', con('encargo'), {}), b = C.zip([{ nombre: 'a.txt', datos: 'hola' }]);
  check(a.length > 1500 && b.length > 22, 'el ZIP no queda vacío');
  check(C.crc32(new TextEncoder().encode('123456789')) === 0xCBF43926, 'crc32: valor de referencia del estándar');
}

// Franja «Borrador sin revisión profesional»: solo en los siete modelos sin fuente, en pantalla (vista), texto, Markdown, HTML de impresión y .docx.
{
  const SIN = ['cesion', 'encargo', 'ilustracion', 'correccion', 'coedicion', 'autoedicion', 'audiolibro'];
  const bytes = id => Buffer.from(C.docx(id, con(id, CASOS[id]), {})).toString('utf8');
  SIN.forEach(id => {
    const v = con(id, CASOS[id]), F = C.franja(id);
    check(F && /Borrador sin revisión profesional/.test(F.t), id + ': tiene franja de borrador');
    check(C.html(id, v, {}).includes('class="rc-franja"') && C.html(id, v, {}).includes('Borrador sin revisión profesional'), id + ': franja en el HTML de impresión');
    check(C.documento(id, v, {}).includes('BORRADOR SIN REVISIÓN PROFESIONAL') && C.texto(id, v, {}).includes('BORRADOR SIN REVISIÓN PROFESIONAL'), id + ': franja en Markdown y texto, no solo en el anexo');
    check(bytes(id).includes('BORRADOR SIN REVISIÓN PROFESIONAL'), id + ': franja en el .docx');
  });
  ['traduccion', 'edicion'].forEach(id => {
    const v = con(id, CASOS[id]);
    check(C.franja(id) === null && !C.html(id, v, {}).includes('rc-franja') && !bytes(id).includes('BORRADOR SIN REVISIÓN'), id + ': sin franja (tiene fuente)');
  });
}

console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
