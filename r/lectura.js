// Páginas de lectura de Cursada. La arma resumenes_web.py: no editar a mano.
(function () {
  // Mide el clic en «Abrir en Cursada» (Analytics, con el consentimiento de analitica.js).
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('[data-abrir]') : null;
    if (a && typeof gtag === 'function') gtag('event', 'abrir_en_cursada', { item_id: a.getAttribute('data-abrir'), ubicacion: a.getAttribute('data-donde') || '', transport_type: 'beacon' });
  });
  // Los links viejos de la vista previa traían #seccion; los ids de esta página son s-seccion.
  var h = ''; try { h = decodeURIComponent(location.hash.slice(1)); } catch (e) { }
  if (/^[\w.-]{1,60}$/.test(h) && !document.getElementById(h)) {
    var el = document.getElementById('s-' + h);
    if (el) el.scrollIntoView();
  }
})();
