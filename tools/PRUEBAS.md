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

### Recorridos punta a punta y trinquete de acciones: `python tools/recorridos.py --navegador chromium|webkit|todos`

- Mismo `dist`, mismo celular y mismas condiciones de falla que `navegador.py` (lo importa: `servir`, `preparar_contexto`, `observar`, `comparar_estado`). Corre en el CI después de «Navegador real», con `--autoprueba` antes.
- **Siete recorridos de riesgo**, en Chromium y WebKit: (1) cargar una materia aprobada con nota desde la pantalla y volver a abrir, (2) exportar la copia, (3) borrar todo (con el diálogo propio de `confirmar()`), (4) importar la copia del recorrido 2 en un navegador vacío, (5) traspaso por link (se genera y se abre en un contexto nuevo), (6) compartir un apunte (con `navigator.share` y `clipboard.writeText` reemplazados; se prueba cada vía) y (7) consentimiento de Analytics (sin elegir y con «Rechazar» no sale ningún pedido a `googletagmanager.com`; con «Aceptar» se intenta).
- **Qué acciones se ejecutaron:** un init script escucha los mismos 8 eventos que el despachador de `app.js` y reporta cada `data-<evento>` que ve; no se toca `app.js`. La lista de acciones registradas sale de `python tools/controlar_acciones.py --listar`.
- **Barrido** (solo Chromium): después de los recorridos, en cada pantalla de `marco/sitio.json`, cada simulador y un apunte, se toca (con `element.click()`) el primer elemento visible de cada `data-clic` que todavía no se vio. Quedan afuera las acciones de `NO_TOCAR` (borran, recargan, imprimen o descargan, con el motivo de cada una) y `/buscar/` (ya la cubre `navegador.py`, y sin Pagefind local cambiaría la lista). Tope de 4 minutos por navegador: si se pasa, se recorta el barrido, no los recorridos de riesgo.
- **Trinquete:** `tools/acciones-sin-recorrido.json` lista las acciones registradas que ningún recorrido ejecuta. Falla si una acción registrada no se ejecutó y no está en la lista (acción nueva sin recorrido: sumale un recorrido), si una de la lista sí se ejecutó (sacala: solo se achica) o si la lista nombra una acción que ya no existe. `--actualizar` reescribe la lista con lo que quedó sin ejecutar y solo puede achicarla; sumar una a mano es empeorarlo a propósito y se explica en el commit.
- Lo que mide el trinquete es cobertura de clics, no de comportamiento: el barrido solo comprueba que no haya errores. El reloj del barrido está fijo (`2026-11-16`) para que las fechas no cambien los botones, pero los datos que se actualizan solos (oferta, mesas) pueden sumar o sacar un botón: si el CI se pone rojo sin cambio de código, es eso. Si el barrido se corta por tiempo, falla aparte y no se evalúa el trinquete.
- La lista se armó con el Chrome de Windows; el Chromium de Linux del CI no tiene `navigator.share`, y eso cambia qué botones de compartir se dibujan. Si el primer CI discrepa, regenerar la lista desde el CI.
- En local, sin navegadores de Playwright: usar el Chrome del sistema con `BrowserType.launch(channel="chrome")` (un envoltorio de diez líneas). WebKit solo corre en el CI.
- No se persigue vaciar la lista en este paso. El primer barrido encontró un error del sitio: en el comparador de escandallo, «Vaciar», «Quitar» y «＋ Título» tiran un `TypeError` que rompe el dibujo (`n2` ← `cmpPasos`). Las tres quedan en `NO_TOCAR` hasta que se arregle.

## 4. Rendimiento con presupuesto (paso 21)

Trabajo `rendimiento` del CI, aparte de `controles`. Las tres medidas arrancan con el valor de hoy y no pueden empeorar; la base es `tools/rendimiento-base.json` (con fecha y origen). No se fijan metas.

- **Peso (determinista):** `python tools/pesos.py dist`. Mide `app.js`, cada CSS de la raíz y el total de HTML + CSS + JS locales de cinco páginas tipo (`/`, un apunte de `/r/`, el escandallo, `/directorio/` y `/carrera/`), en bytes y con gzip. Falla si algo sube más de 1 %. `--actualizar` solo baja la base y suma lo nuevo; `--autoprueba` corre los casos de la lógica.
- **Laboratorio:** `python tools/rendimiento.py dist --solo lab`. Lighthouse 12.6.1 (por `npx`, versión fija) en móvil, con el Chromium de Playwright, sobre las cuatro primeras páginas (Mi carrera no: Lighthouse no carga `localStorage`). Tres corridas, mediana. Se presupuestan LCP y TBT (hasta 25 % sobre la base; TBT, además, con 50 ms de margen porque puede valer 0) y CLS (hasta 0,02 sobre la base), no el puntaje. El servidor (`tools/servir.py`) comprime con gzip como el sitio real: sin gzip el inicio daba 64 en vez de 89.
- **Toque:** `python tools/rendimiento.py dist --solo toque`. Chromium con la CPU frenada 4 veces, en `/carrera/` con el estado de ejemplo: del toque al segundo cuadro pintado (dos `requestAnimationFrame`) al cambiar el estado de una materia, abrir su ficha y cambiar de vista. El toque es sintético (`click()` o evento `change` dentro de la página): mide la respuesta de la app, no el hardware de entrada. Mediana de 5. Tope: 50 % sobre la base y nunca menos de 100 ms.
- Subir la base a propósito: editar el JSON a mano y explicarlo en el commit. `python tools/rendimiento.py --autoprueba` corre los casos de los dos trinquetes.
- **Dispersión medida (5 corridas del CI, 16/11/2026, con gzip también en `/x/`):** LCP entre 3 % y 18 % de la mediana (el peor es `/directorio/`; tope 25 %: alcanza). TBT osciló de 0 a 39 ms: en porcentaje es enorme, en milisegundos no, por eso el margen de 50 ms. CLS idéntico en las 5. Toque 29 a 64 ms (±50 % de la mediana, pero siempre bajo el piso de 100 ms). El CLS del apunte (0,075) es mayor que el del resto: queda como base, a mejorar.
- Medido en el CI (ubuntu-latest). Sin verificar: cómo se comportan los números con otra versión de Chromium de Playwright; al subirla, revisar la base.
- Localmente: `python tools/rendimiento.py dist --canal chrome` usa el Chrome instalado (pero el Lighthouse local da otros números que el CI: no sirven de base).

## 5. Pasada de celular (paso 26): `python tools/pasada.py`

- Arma la lista de toques de la tanda según lo que cambió desde el tag `produccion` (`git diff --name-only produccion..HEAD`). Las pantallas salen de `marco/sitio.json` (url de cada una) y de `tools/navegador.py` (las rutas que el CI ya abre en iPhone, leídas con `ast`).
- Un archivo se traduce a pantallas con `REGLAS`; una carpeta con el nombre de una url es de esa pantalla. Lo que no encaja va como «revisar a mano». El tooling y los `.md` no tocan pantallas.
- Los toques (2 o 3 por pantalla) están en `TOQUES`. Lo que quedó «sin verificar» en otros pasos está en `FIJOS` y sale en cada pasada hasta que se anota un ok.
- Modos: sin argumentos, interactiva (ok / falla / salteo / q, cada respuesta se guarda al instante); `--lista` solo muestra; `--autoprueba` corre los casos (lo corre el CI).
- El estado va a `pasada-estado.txt` en la raíz del repo (en `.gitignore`): una línea por resultado. La pasada siguiente muestra primero lo que falló.

## 6. Mapa de piezas y pruebas (paso 22): `python tools/mapa_pruebas.py`

- Piezas: cada pantalla de `marco/sitio.json` con url y cada simulador (`simuladores/<id>.html`). Cinco niveles, cada uno con evidencia leída de los archivos: **unidad** (un módulo JS de la pieza tiene `tools/pruebas/<módulo>.test.js` o lo nombra un `probar_*.js`/`.mjs`; `probar_simuladores.js` no cuenta, es humo), **humo** (la url está en `RUTAS` de `humo.py`, o un módulo de la pieza está en `MODULOS` de `probar_simuladores.js`), **navegador** (la url está en `pantallas()` de `navegador.py`), **recorrido** (la url la abrió `recorridos.py`, que la deja con `--rutas X.json`) y **rendimiento** (la url está en `PAGINAS` de `pesos.py` o `PAGINAS_LAB` de `rendimiento.py`).
- Lo único a mano: `tools/mapa-piezas.json`, qué módulos JS respaldan cada pieza. Falla si una pieza de `sitio.json` no figura ahí o si figura una que ya no existe. Ojo: «app» (`app.js`) solo tiene prueba de unidad por `normalizar()` (`estados.test.js`); no prueba las pantallas que dibuja.
- Una pieza con menos de dos niveles va a `tools/sin-dos-pruebas.json` (con fecha). **Esa lista solo puede achicarse**: el CI (con `--rutas`) falla si aparece una pieza que no estaba. `--actualizar` achica la lista y se niega a sumar. Sin `--rutas` no se controla, porque sin el nivel recorrido la lista sale más larga.
- El nivel recorrido cuenta el barrido de `recorridos.py`, que abre todas las pantallas y simuladores. Por eso la lista depende de que el barrido termine: si se corta por tiempo, falla aparte.
- Autoprueba: `python tools/mapa_pruebas.py --autoprueba` (lo corre el CI antes).

## Qué no cambia el sitio

Estas pruebas no llevan versión ni entrada en `datos/novedades.json`. Los cuatro módulos que ganaron `module.exports` (`num`, `horarios`, `formatos`, `paginacion`) se comportan igual en el navegador, donde `module` no existe.
