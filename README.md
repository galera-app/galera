# Galera

Gestor público y gratuito para estudiantes de Edición (FFyL, UBA): plan con notas, mesas, calendario, resúmenes, simuladores y horarios. https://galera.com.ar

Sitio estático, sin build. Lo personal queda en el navegador de cada persona.

## Cómo se publica

1. **PR**: corre el CI y Cloudflare arma una vista previa propia.
2. **Merge a `main`**: sale a `prueba.galera.com.ar` y queda esperando aprobación.
3. **Aprobar en Actions → Publicar** (entorno `produccion`): sale a `galera.com.ar`. El tag `produccion` marca el último código aprobado.

Los datos de la Facultad (`datos.yml`) salen solos a producción sobre ese tag, sin arrastrar pantallas sin aprobar. El sitio de prueba no indexa ni escribe en el buzón, el arcade o Analytics (`_headers`).

## Cabeceras de seguridad

Hoy `galera.com.ar` y `www` salen por GitHub Pages (IPs de GitHub, nameservers de Cloudflare solo para el DNS, registros sin proxy). GitHub Pages no deja poner cabeceras propias, así que producción no manda HSTS ni `frame-ancestors`. `_headers` solo lo lee Cloudflare Pages (prueba y vistas previas), y `desplegar.yml` lo saca de `dist/`. Para que lleguen a producción, con Cloudflare por delante:

1. SSL/TLS, Resumen: modo **Full (strict)** (nunca Flexible: GitHub fuerza https y daría bucle de redirecciones). Certificados de borde: «Usar siempre HTTPS» activado.
2. DNS: pasar a «Con proxy» (nube naranja) el registro `A` de `galera.com.ar` (los cuatro de GitHub) y el `CNAME` de `www` (`galera-app.github.io`). No tocar `prueba`, `descargas` ni los `MX`.
3. Reglas, Reglas de transformación, Modificar encabezado de respuesta, regla «Seguridad Galera»: cuando el nombre de host sea `galera.com.ar` o `www.galera.com.ar`, establecer (estático):
   - `Strict-Transport-Security: max-age=31536000` (sin `includeSubDomains` hasta confirmar en el panel de DNS que todo subdominio sirve https; sin `preload`)
   - `X-Content-Type-Options: nosniff`
   - `Referrer-Policy: strict-origin-when-cross-origin`
   - `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`
   - `X-Frame-Options: DENY`
   - `Content-Security-Policy: frame-ancestors 'none'` (solo eso: el resto de la política sigue en la meta de cada página, y las dos se aplican a la vez)
   Dejar apagado el interruptor de HSTS del panel, para no duplicar la cabecera.
4. Comprobar: `curl -sI https://galera.com.ar/` y `https://www.galera.com.ar/` (cabeceras nuevas, redirección www a apex intacta), la Imprenta (carga del WASM), el buzón y Analytics con consentimiento.
5. Marcha atrás: volver el registro a «Solo DNS» (nube gris). El HSTS que ya recibió un navegador dura un año: no se deshace desde el servidor.

Riesgos: con proxy, GitHub Pages puede mostrar «dominio mal configurado» y renovar peor su certificado (con Full strict, un certificado vencido en el origen corta el sitio con error 526; Full sin strict tolera eso); Cloudflare cachea JS, CSS e imágenes según el `Cache-Control` de GitHub (10 min), y los `?v=` de `armar.py` evitan ver versiones viejas; el flujo Publicar con aprobación no cambia, porque el despliegue sigue yendo a GitHub Pages. La alternativa, pasar producción a Cloudflare Pages, sí rompe ese flujo (la aprobación vive en Actions y habría que desplegar con token de Cloudflare) y obliga a separar en `_headers` lo de prueba (`noindex`, CSP restrictiva) por host.

## Buscador (Pagefind)

La lupa de la cabecera abre `/buscar/`, que busca en todo el sitio con [Pagefind](https://pagefind.app): un índice estático en `/pagefind/`, sin servidor y sin costo. `tools/armar.py` lo arma al final del build (después del pre-render) sobre el `<main>` de cada página; `/buscar/`, la 404 y las páginas `noindex` no se indexan.

- **Local**: `pip install "pagefind[extended]==1.6.0"` (también sirve `npx pagefind` o un binario `pagefind` en el PATH). Sin Pagefind, `armar.py` avisa y el sitio queda sin buscador, pero no falla. `--sin-indice` lo saltea a propósito.
- **CI y `Publicar`**: instalan el paquete y arman con `GALERA_EXIGIR_BUSCADOR=1` (si falta el índice, el build falla).
- **Minificado de JS y CSS** (solo en `dist/`, nunca en el repo fuente): `tools/armar.py` usa `rjsmin` y `rcssmin` (`pip install rjsmin==1.3.0 rcssmin==1.3.0`), que solo sacan espacios y comentarios (conservan los `/*! */` y no renombran nada). Es opcional: sin ellos el sitio sale igual, sin minificar, y avisa. Cada JS minificado pasa `node --check` y, si no compila, queda el original. `--sin-minificar` lo apaga (lo usa `probar.py`, que lee el código fuente). `ci.yml` y `desplegar.yml` lo instalan; `desplegar.yml` lo exige (`GALERA_EXIGIR_MINIFICADO=1`). **Cloudflare**: su comando de build no lo instala, así que ahí sale sin minificar; para minificar en prueba y vistas previas, comando `pip install "pagefind[extended]==1.6.0" rjsmin==1.3.0 rcssmin==1.3.0 && python tools/armar.py --salida dist`. Limitaciones: rjsmin se equivoca con `\/\/` dentro de una regex literal (por eso `urlSegura` usa `[/][/]`; la guardia `node --check` lo atrapa) y saca espacios dentro de plantillas anidadas, algo que `node --check` no nota. Por eso los JS con plantillas (backtick), `app.js` entre ellos, no se minifican hasta tener un minificador que las entienda (esbuild).
- **Cloudflare Pages** (vista previa y `prueba.galera.com.ar`): el comando de build tiene que instalar Pagefind antes de armar. Comando actual: `python tools/armar.py --salida dist`; comando nuevo: `pip install "pagefind[extended]==1.6.0" && python tools/armar.py --salida dist` (salida `dist`, sin cambios). Si la imagen de build no trae `pip`, usar `python -m pip install ...`.
- **CSP**: el buscador usa WebAssembly, por eso `script-src` suma `'wasm-unsafe-eval'` (en `marco/sitio.json` y `_headers`). No hay nada externo.
- **Para sumar «respuestas rápidas»**: una página con un elemento `data-pagefind-filter="tipo:pregunta"` aparece primero y aparte en `/buscar/` (`buscarPf` en `app.js`). El texto oculto (`hidden`, `display:none`, `aria-hidden`) también se indexa, así que sirve para variantes de una pregunta. Pagefind no trae sinónimos: las variantes se escriben como texto.

