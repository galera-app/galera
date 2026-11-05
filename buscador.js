// Carga el módulo de Pagefind (ESM) y lo deja en window.pagefindMod. Lo inyecta app.js la primera vez que se busca.
// Va en un archivo aparte para que app.js no lleve ningún import() (tools/prerender.js lo ejecuta con Node, sin navegador).
import('/pagefind/pagefind.js').then(m => { window.pagefindMod = m; window.dispatchEvent(new Event('pagefind-listo')); }, () => window.dispatchEvent(new Event('pagefind-error')));
