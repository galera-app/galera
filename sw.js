// Galera sin conexión. Dos cachés:
//  · galera-nucleo-<huella>: lo guarda por adelantado en «install» (inicio, Mi carrera, Horarios, Calendario, sus scripts, estilos, fuentes y datos).
//    La lista y la huella las escribe tools/armar.py en las dos líneas de abajo: no se editan a mano. Cada publicación cambia la huella,
//    así que el navegador instala el service worker nuevo solo. Si un archivo falla, la instalación falla entera y queda el service worker anterior.
//  · galera-sw-2: lo que cada persona fue visitando. Conserva el nombre para no perder lo ya guardado.
// Archivos con ?v= (no cambian nunca): primero la copia. Páginas y datos: primero la red (cada publicación llega al instante);
// si no contesta en 4 segundos y hay copia, se usa la copia. Sin red y sin copia: el inicio.
// Solo guarda páginas y archivos de este sitio; el buzón de Apps Script y Analytics (otros orígenes) no pasan por acá.
const NUCLEO = [];   // armar.py
const HUELLA = 'dev';   // armar.py
const CACHE = 'galera-sw-2', CACHE_NUCLEO = 'galera-nucleo-' + HUELLA, ESPERA = 4000;
const BASE = new URL('./', location.href).pathname;
const clave = u => u.pathname + u.search;
const delNucleo = u => NUCLEO.includes(clave(u));
const conVersion = u => /[?&]v=\w+/.test(u.search);

// Páginas y datos se piden saltando la caché HTTP (así el núcleo nunca guarda una copia vieja); lo que lleva ?v= es inmutable.
const pedir = ruta => fetch(conVersion(new URL(ruta, location.origin)) ? ruta : new Request(ruta, { cache: 'reload' })).then(res => {
  if (!res.ok) throw new Error(ruta + ' ' + res.status);
  return res;
});
async function llenarNucleo() {
  const c = await caches.open(CACHE_NUCLEO);
  await Promise.all(NUCLEO.map(async ruta => c.put(ruta, await pedir(ruta))));
}
self.addEventListener('install', e => e.waitUntil(llenarNucleo().then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== CACHE_NUCLEO).map(k => caches.delete(k)))).then(() => self.clients.claim())));

// Primero el núcleo (que siempre tiene lo más nuevo de lo suyo), después lo visitado.
async function buscar(r, navegacion) {
  const o = navegacion ? { ignoreSearch: true } : undefined;
  return (await (await caches.open(CACHE_NUCLEO)).match(r, o)) || (await (await caches.open(CACHE)).match(r, o));
}
async function guardar(r, u, res) {
  try { await (await caches.open(delNucleo(u) ? CACHE_NUCLEO : CACHE)).put(r, res); } catch (e) { /* sin lugar: se sigue sin guardar */ }
}
const sinRed = async (r, navegacion) => (await buscar(r, navegacion)) || (navegacion ? await buscar(BASE) : null) || Response.error();

self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url), nav = r.mode === 'navigate';
  if (r.method !== 'GET' || u.origin !== location.origin || !u.pathname.startsWith(BASE)) return;
  e.respondWith((async () => {
    if (conVersion(u)) {
      const m = await buscar(r);
      if (m) return m;
      try { const res = await fetch(r); if (res.ok) e.waitUntil(guardar(r, u, res.clone())); return res; } catch (err) { return Response.error(); }
    }
    return new Promise(ok => {
      let listo = false;
      const dar = res => { if (!listo) { listo = true; ok(res); } };
      const t = setTimeout(async () => { const m = await buscar(r, nav); if (m) dar(m); }, ESPERA);
      const red = fetch(r).then(res => { if (res.ok) e.waitUntil(guardar(r, u, res.clone())); return res; });
      red.then(res => { clearTimeout(t); dar(res); }, async () => { clearTimeout(t); dar(await sinRed(r, nav)); });
    });
  })());
});
