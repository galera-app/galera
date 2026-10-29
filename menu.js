// Galera: menú con grupos de la cabecera de las páginas estáticas (el de la app lo arma app.js).
// Sin JS la fila del grupo actual queda visible; con JS, cada grupo abre y cierra su fila.
(function () {
  var cab = document.querySelector('.cabecera');
  if (!cab) return;
  var tabs = cab.querySelectorAll('.pestanas .tab[data-g]');
  var filas = cab.querySelectorAll('.subw .sub');
  var caja = cab.querySelector('.subw');
  if (!tabs.length || !caja) return;
  function abrir(i) {
    var ya = tabs[i] && tabs[i].getAttribute('aria-expanded') === 'true';
    Array.prototype.forEach.call(tabs, function (t, k) { t.setAttribute('aria-expanded', String(k === i && !ya)); });
    Array.prototype.forEach.call(filas, function (f, k) { f.hidden = !(k === i && !ya); });
    caja.hidden = ya;
  }
  Array.prototype.forEach.call(tabs, function (t, i) { t.addEventListener('click', function () { abrir(i); }); });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var abierta = !caja.hidden;
    Array.prototype.forEach.call(tabs, function (t) { t.setAttribute('aria-expanded', 'false'); });
    caja.hidden = true;
    if (abierta && tabs[0]) tabs[0].focus();
  });
  document.addEventListener('click', function (e) {
    if (!caja.hidden && !cab.contains(e.target)) abrir(-1);
  });
})();
