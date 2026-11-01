// Galera sin conexión: primero la red (así cada publicación llega al instante) y, si no hay, lo último que se vio.
// Solo guarda páginas y archivos de este sitio; el buzón de Apps Script y Analytics (otros orígenes) no pasan por acá.
const CACHE = 'galera-sw-2';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || !u.pathname.startsWith(new URL('./', location.href).pathname)) return;
  e.respondWith(fetch(r).then(res => {
    if (res.ok) { const copia = res.clone(); caches.open(CACHE).then(c => c.put(r, copia)); }
    return res;
  }).catch(() => caches.match(r).then(m => m || (r.mode === 'navigate' ? caches.match(new URL('./', location.href).href) : Response.error()))));
});
