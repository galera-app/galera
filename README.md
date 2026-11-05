# Galera

Gestor público y gratuito para estudiantes de Edición (FFyL, UBA): plan con notas, mesas, calendario, resúmenes, simuladores y horarios. https://galera.com.ar

Sitio estático, sin build. Lo personal queda en el navegador de cada persona.

## Cómo se publica

1. **PR**: corre el CI y Cloudflare arma una vista previa propia.
2. **Merge a `main`**: sale a `prueba.galera.com.ar` y queda esperando aprobación.
3. **Aprobar en Actions → Publicar** (entorno `produccion`): sale a `galera.com.ar`. El tag `produccion` marca el último código aprobado.

Los datos de la Facultad (`datos.yml`) salen solos a producción sobre ese tag, sin arrastrar pantallas sin aprobar. El sitio de prueba no indexa ni escribe en el buzón, el arcade o Analytics (`_headers`).

## Buscador (Pagefind)

La lupa de la cabecera abre `/buscar/`, que busca en todo el sitio con [Pagefind](https://pagefind.app): un índice estático en `/pagefind/`, sin servidor y sin costo. `tools/armar.py` lo arma al final del build (después del pre-render) sobre el `<main>` de cada página; `/buscar/`, la 404 y las páginas `noindex` no se indexan.

- **Local**: `pip install "pagefind[extended]==1.6.0"` (también sirve `npx pagefind` o un binario `pagefind` en el PATH). Sin Pagefind, `armar.py` avisa y el sitio queda sin buscador, pero no falla. `--sin-indice` lo saltea a propósito.
- **CI y `Publicar`**: instalan el paquete y arman con `GALERA_EXIGIR_BUSCADOR=1` (si falta el índice, el build falla).
- **Cloudflare Pages** (vista previa y `prueba.galera.com.ar`): el comando de build tiene que instalar Pagefind antes de armar. Comando actual: `python tools/armar.py --salida dist`; comando nuevo: `pip install "pagefind[extended]==1.6.0" && python tools/armar.py --salida dist` (salida `dist`, sin cambios). Si la imagen de build no trae `pip`, usar `python -m pip install ...`.
- **CSP**: el buscador usa WebAssembly, por eso `script-src` suma `'wasm-unsafe-eval'` (en `marco/sitio.json` y `_headers`). No hay nada externo.
- **Para sumar «respuestas rápidas»**: una página con un elemento `data-pagefind-filter="tipo:pregunta"` aparece primero y aparte en `/buscar/` (`buscarPf` en `app.js`). El texto oculto (`hidden`, `display:none`, `aria-hidden`) también se indexa, así que sirve para variantes de una pregunta. Pagefind no trae sinónimos: las variantes se escriben como texto.

