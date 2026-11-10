// Pruebas del editor de Imprenta (imprenta-editor.js) en node: ortotipografía, Markdown → Typst y, con el motor real, los dos formatos.
// Uso: python tools/bajar_typst.py && node tools/probar_prensa.mjs   (PRENSA_SALIDA=carpeta guarda los PDF)
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const Prensa = require(path.join(RAIZ, 'imprenta-editor.js'));
const Imprenta = require(path.join(RAIZ, 'imprenta.js'));
globalThis.PDFLib = require(path.join(RAIZ, 'vendor', 'pdf-lib.min.js'));
let fallas = 0;
const ok = (c, t) => { console.log((c ? 'ok   ' : 'MAL  ') + t); if (!c) fallas++; };

// ---------- Ortotipografía ----------
let r = Prensa.orto('Era así... o no. . . Y siguió.');
ok(/^Era así… o no…/.test(r.texto) && r.cambios.suspensivos === 2, 'dos puntos suspensivos');
r = Prensa.orto('-Hola -dijo-. Mañana vemos.\n--¿Venís? -preguntó.\n– Bueno.');
ok(r.texto === '—Hola —dijo—. Mañana vemos.\n—¿Venís? —preguntó.\n—Bueno.', 'rayas de diálogo e incisos: ' + JSON.stringify(r.texto));
r = Prensa.orto('- un ítem\n- otro ítem\nteórico-práctico, 1990 - 1995');
ok(r.texto === '- un ítem\n- otro ítem\nteórico-práctico, 1990-1995', 'listas y palabras compuestas intactas; rango sin espacios');
r = Prensa.orto('Hola  mundo ,dijo ( bajito ) .  Fin  ');
ok(r.texto === 'Hola mundo, dijo (bajito). Fin  ', 'espacios (y conserva el doble espacio final de Markdown): ' + JSON.stringify(r.texto));
r = Prensa.orto('Dijo "hola" y “chau”.');
ok(r.texto === 'Dijo "hola" y “chau”.' && !r.total, 'las comillas se respetan por defecto');
ok(Prensa.orto('Dijo "hola" y “chau”.', { comillas: true }).texto === 'Dijo «hola» y «chau».', 'unificar comillas, si se pide');
ok(Prensa.orto('3,5 kg y 2,1').texto === '3,5 kg y 2,1', 'no toca decimales');
ok(Prensa.orto('```\na  b ...\n```').texto === '```\na  b ...\n```', 'no toca bloques de código');

// ---------- Markdown → Typst ----------
const T = Prensa.aTypst('# Título *uno*\n\nUn **fuerte** y _suave_ con #almohadilla, [enlace](https://galera.com.ar) y `código`.\n\n- uno\n- dos\n\n1. a\n2. b\n\n> cita\n\n***\n\n\\salto\n\nFin = 2 + 2 - 1 / 4 "x" <y> @z $w$', { capitular: false });
ok(/^= Título #emph\[uno\]$/m.test(T), 'título con cursiva');
ok(T.includes('#strong[fuerte]') && T.includes('#emph[suave]'), 'negrita y cursiva');
ok(T.includes('\\#almohadilla') && T.includes('#link("https://galera.com.ar")[enlace]') && T.includes('#raw("código")'), 'escapa # y arma enlaces y código');
const J = Prensa.aTypst('[mal](javascript:alert(1)) [data](data:text/html,x) [bien](https://galera.com.ar) [mail](mailto:a@b.ar) nulo\u0000 0\u0000');
ok(!J.includes('#link("javascript') && !J.includes('#link("data') && J.includes('#link("https://galera.com.ar")') && J.includes('#link("mailto:a@b.ar")'), 'enlaces: solo https, http y mailto:');
ok(!J.includes('\u0000'), 'se saca el carácter nulo de la entrada');
ok(/^- uno\n- dos$/m.test(T) && /^\+ a\n\+ b$/m.test(T), 'listas con viñeta y numeradas');
ok(T.includes('#quote(block: true)[cita]') && T.includes('#separador') && T.includes('#pagebreak()'), 'cita, separador y salto de página');
ok(T.includes('Fin \\= 2 \\+ 2 \\- 1 \\/ 4 \\"x\\" \\<y\\> \\@z \\$w\\$'), 'escapa los signos de Typst');
ok(/^#capitular\[E\]ra/m.test(Prensa.aTypst('Era una vez.', { capitular: true })), 'capitular en el primer párrafo');
ok(/^#capitular\[«E\]ra/m.test(Prensa.aTypst('«Era» una vez.', { capitular: true })), 'capitular con comilla de apertura');

// ---------- Motor real ----------
for (const f of ['typst_ts_web_compiler.mjs', 'typst_ts_renderer.mjs']) ok(!fs.readFileSync(path.join(RAIZ, 'vendor', 'typst', f), 'utf8').includes('new Function('), f + ': sin eval (la CSP no lo admite; ver tools/parchear_typst.py)');
const WASM = path.join(RAIZ, 'vendor', 'typst', 'typst_ts_web_compiler_bg.wasm');
if (!fs.existsSync(WASM)) { console.log('(sin el WASM de Typst: correr python tools/bajar_typst.py para probar el motor)'); }
else {
  const cm = await import(new URL('file:///' + path.join(RAIZ, 'vendor', 'typst', 'typst_ts_web_compiler.mjs').replace(/\\/g, '/')).href);
  const rm = await import(new URL('file:///' + path.join(RAIZ, 'vendor', 'typst', 'typst_ts_renderer.mjs').replace(/\\/g, '/')).href);
  await cm.default({ module_or_path: fs.readFileSync(WASM) });
  await rm.default({ module_or_path: fs.readFileSync(path.join(RAIZ, 'vendor', 'typst', 'typst_ts_renderer_bg.wasm')) });
  const b = new cm.TypstCompilerBuilder(); b.set_dummy_access_model();
  const dirF = path.join(RAIZ, 'vendor', 'typst', 'fuentes');
  for (const f of fs.readdirSync(dirF).filter(f => f.endsWith('.ttf'))) await b.add_raw_font(new Uint8Array(fs.readFileSync(path.join(dirF, f))));
  const C = await b.build(), R = await new rm.TypstRendererBuilder().build();
  const compilar = (src, fmt) => { C.add_source('/main.typ', src); const x = C.compile('/main.typ', null, fmt, 1); const d = x && x.result ? x.result : x; if (!(d instanceof Uint8Array)) throw new Error(JSON.stringify(x && x.diagnostics || x).slice(0, 600)); return d; };
  const texto = fs.readFileSync(path.join(RAIZ, 'tools', 'prensa-ejemplo.md'), 'utf8');
  const MM = 72 / 25.4, salida = process.env.PRENSA_SALIDA;
  for (const [formato, estilo, hoja] of [['fanzine', 'sobria', 'a4'], ['fanzine', 'literaria', 'carta'], ['acaballado', 'sobria', 'a4'], ['acaballado', 'literaria', 'a4']]) {
    const o = Object.assign({}, Prensa.DEF, { formato, estilo, hoja, titulo: 'Prueba de imprenta', autor: 'Galera' });
    const md = formato === 'fanzine' ? texto.split('\n').slice(0, 14).join('\n') : texto;
    const fuente = Prensa.documento(Prensa.orto(md).texto, o);
    let pdf;
    try { pdf = compilar(fuente, 'pdf'); } catch (e) { ok(false, `${formato} ${estilo}: compila (${e.message})`); continue; }
    const d = await PDFLib.PDFDocument.load(pdf), n = d.getPageCount(), p = d.getPage(0), M = Prensa.medidas(o);
    ok(Math.abs(p.getWidth() - (M.w + 2 * M.b) * MM) < 0.5 && Math.abs(p.getHeight() - (M.h + 2 * M.b) * MM) < 0.5, `${formato} ${estilo} ${hoja}: ${n} páginas de ${(M.w + 2 * M.b).toFixed(1)} × ${(M.h + 2 * M.b).toFixed(1)} mm`);
    if (formato === 'fanzine') ok(n <= 8, `${formato} ${estilo}: entra en 8 páginas`);
    else ok(n >= 4, `${formato} ${estilo}: varias páginas`);
    const v = compilar(fuente, 'vector'), s = R.session_from_artifact(v, 'vector'), svg = R.svg_data(s);
    ok(s.pages_info.page_count === n && svg.startsWith('<svg'), `${formato} ${estilo}: vista previa en SVG (${svg.length} caracteres)`);
    s.free();
    const I = await Imprenta.imponer(pdf, { modo: formato, hoja, guias: true, creep: 0 });
    ok(I.hojas >= 1 && I.bytes.length > 1000, `${formato} ${estilo}: impuesto en ${I.hojas} ${I.hojas === 1 ? 'hoja' : 'hojas'}`);
    if (salida) { fs.mkdirSync(salida, { recursive: true }); fs.writeFileSync(path.join(salida, `${formato}-${estilo}.pdf`), pdf); fs.writeFileSync(path.join(salida, `${formato}-${estilo}-impuesto.pdf`), I.bytes); fs.writeFileSync(path.join(salida, `${formato}-${estilo}.typ`), fuente); }
  }
  // El analizador de «Antes de imprimir» lee las fuentes incrustadas y el texto en negro de un canal.
  const A = await Imprenta.analizar(compilar(Prensa.documento(texto, Prensa.DEF), 'pdf'));
  ok(A.fuentes && A.fuentes.sin.length === 0, 'el analizador no encuentra fuentes sin incrustar');
  ok(!A.rgbVector, 'el analizador no encuentra textos en RGB (negro y azul en CMYK)');
}
console.log(fallas ? fallas + ' FALLAS' : 'todo bien');
process.exit(fallas ? 1 : 0);
