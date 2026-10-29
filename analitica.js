// Galera: Google Analytics con consentimiento (Consent Mode v2), igual que el resto del sitio.
// gtag.js NO se descarga hasta que la persona acepta: antes de eso no sale ningún pedido a Google (ni siquiera sin cookies).
// La decisión se guarda en "fc-consent", la misma clave que usa ficha.github.io: quien ya eligió
// en el sitio no vuelve a ver el aviso. Analytics nunca recibe lo que la persona carga en Galera.
window.dataLayer = window.dataLayer || [];
function gtag() { dataLayer.push(arguments); }
gtag('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });

const ID_GA = 'G-631LPGC1XE';
function cargarGA() {
  if (cargarGA.ok) return;
  cargarGA.ok = true;
  gtag('js', new Date());
  // Sin el # de la URL: ahí viajan los tokens de confirmar y baja de las novedades.
  gtag('config', ID_GA, { page_location: location.origin + location.pathname + location.search });
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID_GA;
  document.head.appendChild(s);
}
// Al rechazar o revocar se borran las cookies _ga que haya dejado una aceptación anterior.
function borrarCookiesGA() {
  const hosts = [location.hostname, '.' + location.hostname, '.' + location.hostname.split('.').slice(-2).join('.')];
  document.cookie.split(';').map(c => c.split('=')[0].trim()).filter(n => /^_ga/.test(n)).forEach(n => {
    document.cookie = n + '=; Max-Age=0; path=/';
    hosts.forEach(h => { document.cookie = n + '=; Max-Age=0; path=/; domain=' + h; });
  });
}

(function () {
  const CLAVE = 'fc-consent';
  const aplicar = v => {
    gtag('consent', 'update', { analytics_storage: v === 'granted' ? 'granted' : 'denied', ad_storage: 'denied' });
    if (v === 'granted') cargarGA(); else borrarCookiesGA();
  };
  let guardado = null;
  try { guardado = localStorage.getItem(CLAVE); } catch (e) { }
  if (guardado === 'granted' || guardado === 'denied') aplicar(guardado);

  function mostrar() {
    let b = document.getElementById('galletas');
    if (!b) {
      b = document.createElement('div');
      b.id = 'galletas';
      b.className = 'galletas';
      b.setAttribute('role', 'region');
      b.setAttribute('aria-label', 'Cookies');
      // Una barra baja de una línea, no un bloque: no tapa la primera pantalla.
      b.innerHTML = '<p>Google Analytics solo cuenta visitas: no ve tus notas ni tus horarios.</p>'
        + '<div class="botones"><button class="btn ch" type="button" data-v="granted">Aceptar</button>'
        + '<button class="btn lin ch" type="button" data-v="denied">Rechazar</button></div>';
      b.addEventListener('click', e => {
        const v = e.target.getAttribute && e.target.getAttribute('data-v');
        if (!v) return;
        try { localStorage.setItem(CLAVE, v); } catch (err) { }
        aplicar(v);
        b.classList.remove('on');
      });
      document.body.appendChild(b);
    }
    b.classList.add('on');
  }

  // Para la pantalla de Configuración: leer y cambiar la decisión sin pasar por la barra.
  window.galeraConsent = {
    on: () => { try { return localStorage.getItem(CLAVE) === 'granted'; } catch (e) { return false; } },
    poner: on => { const v = on ? 'granted' : 'denied'; try { localStorage.setItem(CLAVE, v); } catch (e) { } guardado = v; aplicar(v); const b = document.getElementById('galletas'); if (b) b.classList.remove('on'); }
  };

  document.addEventListener('DOMContentLoaded', () => {
    if (guardado !== 'granted' && guardado !== 'denied') mostrar();
    const cambiar = document.getElementById('cookies');
    if (cambiar) cambiar.addEventListener('click', mostrar);
  });
})();
