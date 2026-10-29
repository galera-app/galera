// Perfil y tema de la página de prueba. Lo guardado vive solo en este navegador (claves propias, no toca «cursada.v1»).
(function () {
  var K = 'galera.prueba.perfil', T = 'galera.prueba.tema', raiz = document.documentElement;
  var leer = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } };
  var guardar = function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} };
  function aplicar(per, abierto) {
    var pro = per === 'profesional';
    document.querySelectorAll('[data-per]:not(button)').forEach(function (el) { el.hidden = el.getAttribute('data-per') !== (pro ? 'profesional' : 'estudiante'); });
    document.getElementById('plural').textContent = pro ? 'profesionales del libro' : 'estudiantes';
    document.getElementById('abierto').hidden = !abierto;
    document.getElementById('cerrado').hidden = abierto;
    document.getElementById('perfiles').hidden = !abierto;
    document.querySelectorAll('.op').forEach(function (b) { b.setAttribute('aria-pressed', String(!abierto && b.getAttribute('data-per') === per)); });
  }
  var per = leer(K);
  if (per !== 'estudiante' && per !== 'profesional') per = null;
  aplicar(per || 'estudiante', !per);
  document.querySelectorAll('.op').forEach(function (b) {
    b.addEventListener('click', function () { var p = b.getAttribute('data-per'); guardar(K, p); aplicar(p, false); });
  });
  document.getElementById('cambiar').addEventListener('click', function () { aplicar(leer(K) || 'estudiante', true); });
  var tema = leer(T), btn = document.getElementById('tema');
  if (tema === 'dark' || tema === 'light') raiz.setAttribute('data-theme', tema);
  var oscuro = function () { return raiz.getAttribute('data-theme') === 'dark' || (!raiz.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches); };
  var etiqueta = function () { btn.setAttribute('aria-label', oscuro() ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'); };
  etiqueta();
  btn.addEventListener('click', function () { var n = oscuro() ? 'light' : 'dark'; raiz.setAttribute('data-theme', n); guardar(T, n); etiqueta(); });
})();
