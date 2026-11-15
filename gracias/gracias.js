// /gracias/: Mercado Pago vuelve a /gracias/?n=1, 2 o 3 (un link de regreso por plan) y el link de la tarjeta lleva ese nivel a la app (#aporte=N, v174).
// Sin el número, la app pregunta qué aporte se eligió.
(function () {
  var n = new URLSearchParams(location.search).get('n'), a = document.getElementById('g-tarjeta');
  if (a && /^[123]$/.test(n || '')) a.href = '/#aporte=' + n;
})();
