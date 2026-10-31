// Filtros y búsqueda de las portadas con rejilla (Resúmenes, Biblioteca). Sin JS se ve todo.
(function () {
  var raiz = document.querySelector('[data-gl-filtros]');
  var busca = document.querySelector('[data-gl-busca]');
  if (!raiz && !busca) return;
  var items = Array.prototype.slice.call(document.querySelectorAll('[data-gl-item]'));
  var cuenta = document.querySelector('[data-gl-cuenta]');
  var vacio = document.querySelector('[data-gl-vacio]');
  var grupos = Array.prototype.slice.call(document.querySelectorAll('[data-gl-grupo]'));
  var filtro = 'todos';
  var sin = function (s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); };
  function aplicar() {
    var q = sin(busca && busca.value).trim(), n = 0, total = 0;
    items.forEach(function (el) {
      var ok = (filtro === 'todos' || el.getAttribute('data-cat') === filtro) && (!q || sin(el.getAttribute('data-t') || el.textContent).indexOf(q) >= 0);
      el.hidden = !ok;
      if (ok) n++;
      total++;
    });
    grupos.forEach(function (g) { g.hidden = !g.querySelector('[data-gl-item]:not([hidden])'); });
    if (cuenta) cuenta.textContent = (cuenta.getAttribute('data-plantilla') || '{n}').replace('{n}', n).replace('{total}', total);
    if (vacio) vacio.hidden = n > 0;
  }
  if (raiz) raiz.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-f]');
    if (!b) return;
    filtro = b.getAttribute('data-f');
    Array.prototype.forEach.call(raiz.querySelectorAll('button[data-f]'), function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
    aplicar();
  });
  if (busca) busca.addEventListener('input', aplicar);
  aplicar();
})();
