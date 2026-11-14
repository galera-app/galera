# Pruebas de Galera

Cuatro niveles, de lo más barato a lo más caro. Todo corre desde la raíz del repo. El CI (`.github/workflows/ci.yml`) corre los tres primeros y el de navegador en cada PR.

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
- Falla ante errores de consola, excepciones de página, violaciones de CSP, 404 del mismo origen o un `h1` ausente. Analytics, el buzón y las descargas de Typst se cortan en la red y se ignoran (lista `TERCEROS_IGNORADOS`).
- `--estados` además abre `/carrera/` con cada archivo de `tools/estados/`. Sin Pagefind en `dist`, `/buscar/` se saltea salvo `GALERA_EXIGIR_BUSCADOR=1` (el CI lo exige).
- Estados de ejemplo: `tools/estados/*.json`. Para sumar uno, copiá un estado exportado desde «Tus datos», sacale lo personal y probalo con `node --test tools/pruebas/estados.test.js`.

## 4. Rendimiento: pendiente

Sin implementar. Idea: medir peso transferido y tiempo de carga de las pantallas clave con el mismo `dist`, y fijar un trinquete de «no sube» como el de cobertura. No se fijan metas.

## Qué no cambia el sitio

Estas pruebas no llevan versión ni entrada en `datos/novedades.json`. Los cuatro módulos que ganaron `module.exports` (`num`, `horarios`, `formatos`, `paginacion`) se comportan igual en el navegador, donde `module` no existe.
