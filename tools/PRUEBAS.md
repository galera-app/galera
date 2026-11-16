# Pruebas de Galera

Cuatro niveles, de lo más barato a lo más caro. Todo corre desde la raíz del repo. El CI (`.github/workflows/ci.yml`) corre los tres primeros y el de navegador en cada PR; el de rendimiento va en su propio trabajo.

## 1. Unidad (JS, sin DOM): `node tools/pruebas_unidad.mjs`

- Pide Node 22 o más (el CI fija Node 22). Sin dependencias: usa `node --test` con su cobertura integrada.
- Corre las pruebas sueltas de `tools/` (`probar_simuladores.js`, `probar_lomo.js`, `probar_imprenta.js`, `probar_contratos.js`) y las de `tools/pruebas/*.test.js` (num, formatos, horarios, paginación, escandallo, papel, cronograma, arcade, retos, traspaso y los estados de `cursada.v1`).
- Queda afuera `tools/probar_prensa.mjs`: necesita bajar Typst de npm (`python tools/bajar_typst.py && node tools/probar_prensa.mjs`, paso propio del CI).
- Los módulos del sitio son scripts de navegador con globales. Los que dependen de otros (`Num`, `Paginacion`, `Escandallo`) se cargan con `tools/pruebas/cargar.js`.
- Una prueba marcada `todo` documenta un bug conocido: se ve en el informe pero no falla el comando. Al arreglar el bug, sacale el `todo`.

### El trinquete de cobertura

- `tools/cobertura-base.json` guarda el porcentaje de líneas de cada archivo y el total. `tools/controlar_cobertura.mjs` falla si alguno BAJA, o si un archivo de la base deja de medirse. No hay meta de porcentaje: solo «no baja».
- Los porcentajes salen de las líneas que reporta Node (reporter lcov); son un piso, no una garantía de que cada rama esté probada.
- Para subir la base, después de agregar pruebas: `node tools/pruebas_unidad.mjs --actualizar`. Solo puede subir (cada valor es el máximo entre la base y lo medido) y suma los archivos nuevos. Commiteá el JSON junto con las pruebas.
- Si una baja es legítima (se borró código), editá a mano el JSON en el mismo commit y explicalo en el mensaje.

## 2. Integración (sitio armado): `python tools/armar.py --salida dist` y `python tools/probar.py dist`

- `probar.py` revisa datos, sitemap, CSP, service worker y enlaces internos sobre `dist` (~25 s). Sin Pagefind local, falla `/buscar/` → `/pagefind/pagefind.js`: es del entorno, el CI sí lo trae.
- Los demás controles estáticos del CI: `armar.py --comprobar`, `controlar_acciones.py`, `controlar_descargas.py`, `controlar_capitulares.py dist`, `humo.py` y `verificar_seo.py dist --dominio https://galera.com.ar`.

## 3. Navegador real: `python tools/navegador.py --navegador chromium|webkit|todos`

- Playwright (`pip install playwright` y `python -m playwright install --with-deps chromium webkit`).
- Abre 8 pantallas con tamaño de iPhone (390 × 844, táctil) contra `dist`: inicio, Mi carrera con datos de ejemplo, Horarios, Calendario, un apunte de `/r/`, escandallo, Directorio y `/buscar/`.
- Además recorre «materia aprobada» (paso 19) en el mismo celular: marca Corrección de Estilo desde la carga rápida, abre el ejemplar desde «¡Aprobaste!», lo pasa a post, lo descarga, usa el único re-tiro y abre el álbum en sus tres vistas con la carrera entera aprobada. Falla si algo se sale de lo ancho de la pantalla.
- Falla ante errores de consola, excepciones de página, violaciones de CSP, 404 del mismo origen o un `h1` ausente. Analytics, el buzón y las descargas de Typst se cortan en la red y se ignoran (lista `TERCEROS_IGNORADOS`).
- `--estados` además abre `/carrera/` con cada archivo de `tools/estados/`. Sin Pagefind en `dist`, `/buscar/` se saltea salvo `GALERA_EXIGIR_BUSCADOR=1` (el CI lo exige).
- Estados de ejemplo: `tools/estados/*.json`. Para sumar uno, copiá un estado exportado desde «Tus datos», sacale lo personal y probalo con `node --test tools/pruebas/estados.test.js`.

## 4. Rendimiento con presupuesto (paso 21)

Trabajo `rendimiento` del CI, aparte de `controles`. Las tres medidas arrancan con el valor de hoy y no pueden empeorar; la base es `tools/rendimiento-base.json` (con fecha y origen). No se fijan metas.

- **Peso (determinista):** `python tools/pesos.py dist`. Mide `app.js`, cada CSS de la raíz y el total de HTML + CSS + JS locales de cinco páginas tipo (`/`, un apunte de `/r/`, el escandallo, `/directorio/` y `/carrera/`), en bytes y con gzip. Falla si algo sube más de 1 %. `--actualizar` solo baja la base y suma lo nuevo; `--autoprueba` corre los casos de la lógica.
- **Laboratorio:** `python tools/rendimiento.py dist --solo lab`. Lighthouse 12.6.1 (por `npx`, versión fija) en móvil, con el Chromium de Playwright, sobre las cuatro primeras páginas (Mi carrera no: Lighthouse no carga `localStorage`). Tres corridas, mediana. Se presupuestan LCP y TBT (hasta 25 % sobre la base; TBT, además, con 50 ms de margen porque puede valer 0) y CLS (hasta 0,02 sobre la base), no el puntaje. El servidor (`tools/servir.py`) comprime con gzip como el sitio real: sin gzip el inicio daba 64 en vez de 89.
- **Toque:** `python tools/rendimiento.py dist --solo toque`. Chromium con la CPU frenada 4 veces, en `/carrera/` con el estado de ejemplo: del toque al segundo cuadro pintado (dos `requestAnimationFrame`) al cambiar el estado de una materia, abrir su ficha y cambiar de vista. El toque es sintético (`click()` o evento `change` dentro de la página): mide la respuesta de la app, no el hardware de entrada. Mediana de 5. Tope: 50 % sobre la base y nunca menos de 100 ms.
- Subir la base a propósito: editar el JSON a mano y explicarlo en el commit. `python tools/rendimiento.py --autoprueba` corre los casos de los dos trinquetes.
- **Dispersión medida (5 corridas del CI, 16/11/2026):** LCP entre 5 % y 8 % de la mediana (tope 25 %: alcanza). TBT osciló de 0 a 43 ms: en porcentaje es enorme, en milisegundos no, por eso el margen de 50 ms. CLS idéntico en las 5. Toque 33 a 66 ms (±48 % de la mediana, pero siempre bajo el piso de 100 ms). El CLS del apunte (0,075) ya es mayor que el del resto: queda como base, a mejorar.
- Medido en el CI (ubuntu-latest). Sin verificar: cómo se comportan los números con otra versión de Chromium de Playwright; al subirla, revisar la base.
- Localmente: `python tools/rendimiento.py dist --canal chrome` usa el Chrome instalado (pero el Lighthouse local da otros números que el CI: no sirven de base).

## Qué no cambia el sitio

Estas pruebas no llevan versión ni entrada en `datos/novedades.json`. Los cuatro módulos que ganaron `module.exports` (`num`, `horarios`, `formatos`, `paginacion`) se comportan igual en el navegador, donde `module` no existe.
