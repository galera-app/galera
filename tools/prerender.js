// Pre-render de Galera: ejecuta las mismas vistas de app.js, sin navegador, y deja el HTML de cada pantalla.
// Uso: node tools/prerender.js <carpeta del sitio armado> <salida.json> <ruta ...|@archivo con una ruta por línea>
// Salida: { "/biblioteca/": { main, pestanas, inferior, pieNav, tab, titulo }, ... }.
// Sin dependencias. El DOM es un sustituto mínimo: las vistas son funciones que devuelven texto, así que casi no lo tocan.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const [raiz, salida, ...pedidas] = process.argv.slice(2);
if (!raiz || !salida) { console.error('uso: node tools/prerender.js <sitio> <salida.json> [ruta ...]'); process.exit(2); }

class El {
  constructor(id) { this.id = id; this.innerHTML = ''; this.textContent = ''; this.hidden = false; this.dataset = {}; this.style = { setProperty() {} }; this.value = ''; this.offsetHeight = 0; this.children = [];
    this.classList = { add() {}, remove() {}, toggle() {}, contains: () => false }; this.attrs = {}; }
  setAttribute(k, v) { this.attrs[k] = v; } getAttribute(k) { return this.attrs[k] ?? null; } removeAttribute(k) { delete this.attrs[k]; }
  addEventListener() {} removeEventListener() {} querySelector() { return null; } querySelectorAll() { return []; } appendChild(x) { return x; } remove() {} focus() {} scrollIntoView() {} contains() { return false; }
  showModal() {} close() {}
}
const porId = {};
const elemento = id => porId[id] = porId[id] || new El(id);
const documento = { title: 'Galera: tu carrera de Edición, en orden (UBA)', documentElement: new El('html'), body: new El('body'), head: new El('head'), activeElement: null, referrer: '', cookie: '',
  querySelector: s => { const m = /^#([\w-]+)$/.exec(s); return m ? elemento(m[1]) : null; }, querySelectorAll: () => [], getElementById: elemento, createElement: () => new El(''), addEventListener() {}, removeEventListener() {} };
const ubic = { pathname: '/', search: '', hash: '', origin: 'https://galera.com.ar', host: 'galera.com.ar', hostname: 'galera.com.ar', protocol: 'https:', get href() { return this.origin + this.pathname + this.search + this.hash; }, reload() {}, replace() {}, assign() {} };
const pon = u => { const x = new URL(u, ubic.origin); ubic.pathname = x.pathname; ubic.search = x.search; ubic.hash = x.hash; };
let pendientes = 0;
const fetchLocal = async url => {
  pendientes++;
  try {
    const u = new URL(String(url), ubic.origin + '/');
    if (u.origin !== ubic.origin) return { ok: false, json: async () => ({}) };
    const p = path.join(raiz, decodeURIComponent(u.pathname));
    if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) return { ok: false, status: 404, json: async () => { throw new Error('404 ' + p); } };
    const t = fs.readFileSync(p, 'utf8');
    return { ok: true, status: 200, text: async () => t, json: async () => JSON.parse(t) };
  } finally { setImmediate(() => pendientes--); }
};
const ventana = { addEventListener() {}, removeEventListener() {}, scrollTo() {}, innerWidth: 1280, innerHeight: 800, dataLayer: [] };
ventana.top = ventana; ventana.self = ventana; ventana.window = ventana;
const ctx = vm.createContext(Object.assign(ventana, {
  document: documento, location: ubic, fetch: fetchLocal, console, URL, URLSearchParams, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {}, requestAnimationFrame: () => 0,
  history: { pushState(_, __, u) { if (u != null) pon(u); }, replaceState(_, __, u) { if (u != null) pon(u); } }, navigator: { language: 'es-AR', onLine: true, userAgent: 'prerender', clipboard: null },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} }, matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
  PRERENDER: true, btoa: s => Buffer.from(s, 'binary').toString('base64'), atob: s => Buffer.from(s, 'base64').toString('binary'), TextEncoder, TextDecoder, Intl, crypto: { randomUUID: () => '0', getRandomValues: a => a },
}));
const espera = async () => { do { await new Promise(r => setImmediate(r)); await new Promise(r => setImmediate(r)); } while (pendientes > 0); };

(async () => {
  const shell = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8');
  const scripts = [...shell.matchAll(/<script defer src="\/?([\w-]+\.js)[^"]*"><\/script>/g)].map(m => m[1]).filter(s => s !== 'analitica.js');
  // Un solo guion: así `const` y `function` se comparten igual que entre <script> del navegador, y arrancar() queda para el final.
  for (const s of scripts) vm.runInContext(fs.readFileSync(path.join(raiz, s), 'utf8'), ctx, { filename: s });
  await espera();
  const ev = c => vm.runInContext(c, ctx);
  const rutas = pedidas[0] && pedidas[0][0] === '@' ? fs.readFileSync(pedidas[0].slice(1), 'utf8').split(/\r?\n/).filter(Boolean) : pedidas;
  const fuera = {};
  for (const r of rutas) {
    pon(r);
    await ev('prepararPrerender()'); await espera();
    ev('render()'); await espera(); ev('render()');
    fuera[r] = { main: elemento('main').innerHTML, pestanas: elemento('pestanas').innerHTML, inferior: elemento('inferior').innerHTML, pieNav: elemento('pie-nav').innerHTML, tab: ev('V.tab'), titulo: documento.title };
    if (!fuera[r].main || /class="cargando"|gl-vacio" role="(status|alert)"/.test(fuera[r].main)) { console.error('sin contenido: ' + r); process.exitCode = 1; }
  }
  fs.writeFileSync(salida, JSON.stringify(fuera));
  console.log('prerender: ' + rutas.length + ' rutas');
  process.exit(process.exitCode || 0);
})().catch(e => { console.error(e); process.exit(1); });
