# Cambios de Cursada (ficha.github.io/cursada)

## v187 · 2026-11-20
- Qué vas a rendir (Calendario). `cursada_datos.py` lee, además de la planilla de Edición, las del turno de examen de Letras, Bibliotecología, Ciencias Antropológicas y Lenguas Modernas, y de ellas toma solo lo que el plan usa (`OTRAS_MESAS`): Teoría y Análisis Literario (`tal`, con cátedra), Métodos de investigación en bibliotecología (`biblio`), Epistemología y métodos de investigación social (`antropo`, con cátedra) e idiomas (Inglés elemental, medio y superior → `ingles1` a `ingles3`; el nivel elemental de los demás → su opción de «Otro idioma»; el resto, sin materia). Van al mismo `mesas-AAAA-turno.json` con `origen` y `catedra`; la carrera de cada PDF sale del rótulo bajo «MESAS DE EXÁMENES», un bloque con varias materias se parte por renglón, y si una planilla ajena falla se avisa y sigue Edición. Un año anterior al del turno se toma como errata (la planilla trae «02/12/25» en Edición Editorial). En `app.js`, `panelMesas()` reemplaza la lista de mesas: pestañas Edición / De otras carreras / Idiomas, una casilla por llamado (`alternarMesa`, estado `E.rendir` saneado con `RE_MESA`), aviso si dos elegidas caen a la misma hora, las elegidas entran como «Mesa» en Mis fechas y `exportarMesas()` baja `mis-mesas-galera.ics` con UID estable por mesa. Estilos `.gl-mesa*` en `componentes.css`. `datos.yml` pasa de lunes y jueves a todos los días. Novedad v187 en borrador (voz de Fidel). El press kit del PR #134 pasa a v188.

## v186 · 2026-11-17
- Detalles de buscadores (paso 34). `/config/` lleva `<meta name="robots" content="noindex">` (ya estaba fuera del sitemap). El inicio suma JSON-LD `Organization` y `WebSite` generados por `tools/armar.py` (`sitio_jsonld`) desde `datos/marca.json` (nombre, frase) y las redes de `marco/sitio.json`; el `WebSite` trae `SearchAction` hacia `/buscar/?q=`, que lee `app.js`. El `WebApplication` sigue. `tools/probar.py` (`test_config_noindex_y_jsonld_del_inicio`) lo controla. Novedad v186 menor, borrador para la voz de Fidel.

## v185 · 2026-11-16
- Apuntes sin saltos (paso 31). En `/r/…` el apunte prerenderizado ya no se reinserta al cargar: `cargarApunte()` no pasa por «Cargando el apunte…» si el artículo ya está en pantalla, y `ponerMain()` deja el DOM como está cuando lo que dibujaría `app.js` es lo mismo (salvo el bloque de descargas, que se llena al llegar su json, y el origen de la cita). Las tablas de los apuntes llevan `<th scope="col">` en la cabecera y `<th scope="row">` como primera celda de cada fila: lo hace `encabezar_tablas()` en `resumenes.py` (en 104, fuera del repo; idempotente), aplicado a los 102 `resumenes/*/*.json` con tablas (532 tablas) sin regenerar desde las fuentes, para no arrastrar los desvíos de 0911 y 0919; `tools/controlar_tablas.py` lo controla en el CI, `.apunte tbody th` conserva el aspecto de siempre. `tools/navegador.py` suma la prueba «apunte sin saltos» (artículo sin reinsertar, sin «Cargando», CLS ≤ 0,02, tablas con encabezado de fila). `test_generadores.py` suma `test_tablas_con_encabezado_de_fila`. Lighthouse local no corre (sin Playwright): el tope de CLS del CI se baja con `--actualizar` si mejora. Novedad v185 en borrador (voz de Fidel).

## v184 · 2026-11-16
- Directorio liviano (paso 30). La lista va por páginas de 50 fichas (Anterior/Siguiente, `dirPag` reemplaza a «Mostrar más») y la página armada trae solo la primera, no las ~2.000: `/directorio/` pasa de 1228,7 KB a 781,4 KB (gzip 242,8 a 220,0 KB) y la base de `tools/rendimiento-base.json` bajó con `pesos.py --actualizar`. Nuevo recorrido del Directorio en `tools/navegador.py` (paginar, buscar, filtrar por tipo, enlace de una ficha). Novedad v184 menor, borrador para la voz de Fidel.

## v183 · 2026-11-16
- Generadores de resúmenes arreglados y probados (paso 25). `resumenes.py` y `resumenes_web.py` (en 104, fuera del repo) escriben solo en `GALERA_DIR`, arman todo en memoria, escriben solo lo que cambió, no borran (huérfanos con `--podar`; los PDF de repaso nunca) y sin `--go` son simulacro. Módulo común `generadores_base.py`; prueba `test_generadores.py` (doble corrida, Inglés y Francés iguales al árbol, solo toca `r/`, `resumenes/` y `sitemap.xml`). En el repo: `r/frances/*` pasa de cuerpo escrito a cáscara con marcas, como Inglés; lastmod de esas dos URL. Novedad v183 (menor), texto provisorio para la voz de Fidel. Lo publicado de 0911 y 0919 difiere de las fuentes de hoy: no se tocó.

## v182 · 2026-11-16
- Sin conexión de verdad (paso 27). `sw.js` guarda por adelantado el núcleo (inicio, Mi carrera, Horarios, Calendario con sus estilos, scripts, fuentes y datos; unos 0,44 MB comprimidos, tope 1,5 MB) en `galera-nucleo-<huella>`; `tools/armar.py` calcula la lista y la huella al armar, así cada publicación que toque el núcleo cambia `sw.js` y el navegador lo actualiza solo (se borran los núcleos viejos; `galera-sw-2` con lo visitado se conserva). Archivos con `?v=`: primero la copia; páginas y datos: primero la red, y a los 4 s la copia. Pruebas: `test_service_worker_nucleo` en `probar.py` y la prueba sin red en `navegador.py` (contexto con service worker permitido). Sin verificar: WebKit en iPhone real. PR #123.

## v181 · 2026-11-16
- Identidad al instalar (paso 29). El `manifest.webmanifest` ya no está a mano en el repo: `tools/armar.py` lo escribe en `dist/` con el nombre, el nombre corto y la descripción de `datos/marca.json` (`titulo_home`, `nombre`, `desc_home`) y suma accesos directos a Mi carrera, Horarios, Calendario y Resúmenes (`accesos_app` en `marca.json`). `probar.py` (`test_manifest_desde_marca`) falla si el manifest no coincide con `marca.json`, si le falta un acceso o si un acceso no existe en el sitio armado. El nombre instalado pasa a ser el título de la home. Entrada de novedades y textos provisorios, a la espera de la voz de Fidel.

## v180 · 2026-11-16
- Materia aprobada (paso 19, adelantado). Al marcar una materia como aprobada se sortean pigmento, fondo y número (`ejemplar.js`, reglas de `NIVELES.md`, probabilidades en `prob` de `datos/pigmentos.json`). Se guardan con la materia (`ejemplar`, saneado en `normalizar()`), quedan aunque cambie el estado y admiten un solo re-tiro. Pieza «Aprobé {materia}» con «{Nivel} · {pigmento}» en post (1080×1350) e historia (`cvEjemplar`; `abrirImagen` acepta formatos y vistas propios). Álbum con grilla, índice y estante (`cvAlbum`), con selector que se recuerda. «¡Aprobaste!» ofrece «Ver mi ejemplar» siempre, la ficha suma «Mi ejemplar» y Mis logros «Mi álbum». El Plan a un amigo usa el ejemplar sorteado. Pruebas: unidad (`ejemplar.test.js`, sorteo con semilla), estados, y punta a punta con tiempos en el celular (`navegador.py`). Textos provisorios, a la espera de la voz de Fidel. Revisión de Opus sin bloqueantes; se aplicaron el índice en dos columnas, el sorteo como cambio, la relectura del re-tiro y las aprobadas sin ejemplar como pendientes. PR #119, tag `v180`.

## v179 · 2026-11-16
- Desafío del Arcade con imagen: `cvDesafio(tablero, puntos)` en historia, cuadrada y vista previa de enlace 1200×630, con grabado del banco teñido en cian, Jacquard 24 y el puntaje en oro. Botones «Mandar por WhatsApp» y «Vista previa para links (.png)». PR #118, mergeado a `main` junto con v175 a v178 por la rama `v176-compartir-base` (#113).

## v178 · 2026-11-16
- «Mi semana» y Plan a un amigo como afiches: banda de Stradanus, color fijo por materia (`datos/pigmentos.json`, `tools/pigmentos_materias.py --controlar` en el CI), Plan con ejemplares por materia aprobada y sin nombre de quien comparte. PR #117.

## v177 · 2026-11-15
- Design system de Galera en el repo (`diseno/`), para reemplazar al lienzo de Claude Design, que cierra el 14/12/2026. Fuente: `tokens.css` y `componentes.css` (no se repite ningún valor). `diseno/README.md` dice qué es fuente y qué se deriva; reglas de uso en `marca.md`, `tipografia.md`, `componentes.md` y `reglas.md`, sacadas de las láminas rehechas del 27/10. `tools/diseno_generar.py` genera `tokens.json` (W3C) y `contrastes.md` (17 pares, claro y oscuro), con `--vista <carpeta>` una página para mirar fuera del repo y con `--artifact <carpeta>` el contenido del artifact «Design System» (claude.ai/artifact/F5Xh9iymVB1yguGxd1nsYD: tokens en listas, brand book, fuentes, 9 componentes con vista, íconos y portada), la vista compartida entre las dos cuentas. El CI suma `diseno_generar.py --comprobar`; `diseno` va a `NO_PUBLICAR` (no sale en el sitio). Pendientes anotados en `reglas.md`: tarjeta con relleno o con borde, `--tenue-2` (4,1 : 1 sobre cielo), `--estado-ok-pleno` sin valor oscuro (2,7 : 1), títulos de 56/40/28 sin token y el corrimiento del ícono sin verificar. PR #115. Novedad v177 (menor). La v175 (retratos) y la v176 (#113) eran de otras sesiones: se mergea después de las dos (`probar.py` no admite huecos).

## v176 · 2026-11-16
- Base de las imágenes de Compartir: 19 grabados de dominio público en `img/grabados/` (`tools/grabados_compartir.py`, créditos en `/legal/`), Jacquard 24 recortada, tema claro y oscuro (`CV_TEMA`) y selector «Clara / Oscura» y «Cuadrada / Historia» en el diálogo de imagen. PR #113.

## v175 · 2026-11-16
- La tarjeta de mecenas pasa a ser una lámina: grabado de oficio sorteado del banco, pigmento según el nivel del aporte y «Mecenas de Galera» bajo el nombre (`cvMecenas`). Reemplaza a la rama `v175-retratos`, que queda sin mergear. PR #116.

## v174 · 2026-11-15
- Tarjetas por ayudar a Galera, en «Mis logros» (`E.extras`, saneado en `normalizar()`). Mail confirmado y respuesta a una pregunta: las marca la app sola. Aporte mensual: `/gracias/?n=1|2|3` (`gracias/gracias.js`) lleva a `/#aporte=N` y la persona elige una de dos figuras por nivel (`MECENAS` en `app.js`: Isabella d’Este o Cayo Mecenas; Cristina de Suecia o Lorenzo de Médici; Victoria Ocampo o Federico de Montefeltro). La tarjeta nunca muestra el monto. Cafecito: `#cafe` o «Sumá tu tarjeta» en Cómo ayudar. Resúmenes: `galera.com.ar/#colaboro`, el link que Fidel pega al responder a quien manda apuntes. Aporte, café y resumen no se pueden verificar: se confía, porque la tarjeta no da nada a cambio. `#avisame` abre el formulario del mail de los lunes (para el mensaje a los grupos). Evento `logro_extra`. Revisión de Opus: «Mis logros» suma una fila en el menú «Más», porque el botón solo se veía en Mi carrera con materias cargadas; el dato de Victoria Ocampo pasa a revista en 1931 y editorial dos años después; los links nuevos andan también con Galera abierta (`alCambiarHash`); «tarjeta nueva» solo la primera vez. Queda aceptado que la figura deja deducir el nivel. PR #112. Novedad v174.

## v173 · 2026-11-15
- Aporte mensual (ticket 1, paso 38 del plan). `APORTES` en `app.js`, junto a `DONAR`, es el único lugar con montos y links de los tres planes de Mercado Pago Suscripciones ($2.000, $5.000 y $10.000); si la lista queda vacía, no se muestra nada. En `/sostener/`, la tarjeta «Aporte mensual» va primera en el riel, «Con plata» nombra los tres montos y el cafecito queda como aporte único. Evento `aporte_clic` (parámetro `escalon`: 1, 2, 3 o `unico`). Página nueva `/gracias/` (`noindex`), que es la URL de regreso de los planes. «Sostener» pasa a «ayudar» en lo visible: la pantalla se llama «Cómo ayudar», el botón del inicio y el pie dicen «Ayudar a Galera» y el colofón dice «aportes». La ruta `/sostener/` y los nombres internos no cambian. Legal suma «Aportes por Mercado Pago» y nombra a Mercado Pago entre los sitios de terceros. En el celular el riel queda al final, así que «Con plata» lleva los tres montos como links. El ítem del plan público pasa a «Cómo ayudar» (`plan-publico.json`, `plan_publico.py`), y `gen_legal_sostener.py` queda al día. Revisión de Opus: los dos bloqueantes eran afirmaciones sin verificar. «No hace falta cuenta» salió. La baja ahora se hace desde Mercado Pago, que en su checkout dice «Cancelá cuando quieras, sin costo». Se confirmó que los tres links abren el plan correcto (Galera 2000, 5000 y 10000). Queda pendiente el cobro de prueba de Fidel antes de «Publicar», y confirmar que los planes tienen `/gracias/` como URL de regreso. PR #111. Novedad v173.

## v172 · 2026-11-15
- El plan público (`datos/plan.json`: «Qué se viene» en Novedades y el plan de «Cómo se sostiene») deja de escribirse a mano. Los textos viven en `plan-publico.json` (104) y el estado de cada ítem lo saca `plan_publico.py` de las casillas de `propuestas/2026-11-14-plan-galera/PLAN.md`: todos los pasos tildados = listo, alguno = en curso, ninguno = planeado; un paso anotado «no va» no cuenta. Todo paso del plan tiene que estar en un ítem o en `internos`, o el script falla. Contenido nuevo: 16 ítems pendientes en 5 momentos (ahora, lo que sigue, después, 1.er cuatrimestre de 2027 y sin fecha) y 14 en «Ya salió»; «Galera con la cara nueva» y «Mudanza a galera.com.ar» pasan a listo, y «Herramientas del libro para profesionales» se reemplaza por el buscador de libros posibles (libro inverso) e ISBN. Controles: `test_plan_publico.py` (24 casos), `probar.py` de 104 (bloque 4) y dos pruebas en `tools/probar.py` (la que compara con el plan se saltea en el CI, como la del CHANGELOG). Sin cambios en la pantalla: solo datos y un comentario en `app.js`. Novedad v172 (menor). PR #110, con revisión de Opus (sin bloqueantes; se aplicaron sus mejoras 1, 2, 3 y 5). Mergeado el 15/11 (tag `v172`).

## v171 · 2026-11-14
- Redactor de contratos: cotejo de las 34 citas de artículos (Ley 11.723, CCyC, Ley 22.399) contra el texto oficial de argentina.gob.ar/normativa (InfoLEG no respondía); tabla en `propuestas/2026-11-14-plan-galera/contratos-cotejo.md`. `contratos.js` suma `NORMAS` (URL oficial y fecha de cotejo por norma; la 22.399 queda «sin cotejar») y cada cláusula muestra «Texto oficial» en la vista previa y en el anexo de notas (md, txt, HTML, .docx). Corrección: la fuente de «Créditos» (edición) pasa de art. 38 a art. 52 de la Ley 11.723. Segundo cotejo independiente (14/11): confirmó las citas y corrigió la redacción de 8 referencias imprecisas (art. 42: si no hay plazo lo fija un tribunal; arts. 38 y 39 en audiolibro; presunción de precio global solo en el 1262; 1257 inc. c según el 1256; arts. 57 y 61 de depósito legal; 1077 «o la ley»; ficha del art. 61 en `leyes.js`). Siguen sin cotejar la Ley 22.399 y los decretos de `leyes.js`; las decisiones interpretativas (arts. 1252, 1743, 1768 y 1614) quedan en `407-personal-strategos/consultas/104-galera-contratos.md`. Prueba nueva en `tools/probar_contratos.js`. Novedad v171. Rama `v171-contratos-fuentes`, mergeado el 14/11 (tag `v171`, PR #109).

## v170 · 2026-11-14
- `Num.parse` ya no toma «punto + tres cifras» como miles cuando el primer grupo empieza con 0: `0.125` vale 0,125 y no 125 (patrón `/^-?[1-9]\d{0,2}(\.\d{3})+$/` en `num.js` y en la copia del planificador descargable). Afectaba a escandallo, papel, paginación y cronograma; `1.250`, `18.000` y `1.000.000` siguen siendo miles. Pruebas nuevas en `tools/pruebas/num.test.js`. Novedad v170. Pendiente de merge.

## v169 · 2026-11-14
- El planificador de libros descargable (`libro/planificador-de-libros.html`) pasa a la paleta de Galera, generado con `tools/descargable_planificador.py`; el hito pasa a rombo hueco (fondo + borde `--tinta`) para que se distinga de la barra. Novedad v169. PR #106, mergeado el 14/11 (tag `v169`).

## v168 · 2026-11-14
- Los UID de los `.ics` (Horarios, Calendario, planificador de libros) pasan a la dirección de Galera, y el `PRODID` de Horarios a `galera.com.ar`; la novedad avisa cómo evitar eventos duplicados. Novedad v168. PR #105, mergeado el 14/11 (tag `v168`).

## v167 · 2026-11-14
- Seguridad (M4, parte de estilos): la CSP saca `'unsafe-inline'` de `style-src`. Ningún HTML, plantilla ni JS lleva `style="…"` ni `<style>`: lo fijo pasó a clases `u-*` (`estilos.css`), lo dinámico a `data-est="width:30%"` que aplica `estilar()` en `app.js` (lista blanca `EST_OK`). El póster A3 usa `@page poster` + `.lp-hoja{page:poster}` en vez del `<style>` en línea; el SVG de Typst, reglas acotadas a `.typst-doc`. Control nuevo `tools/controlar_estilos.py` (también atrapa `setAttribute('style', …)`) en el CI, y prueba `test_sin_atributos_style` en `tools/probar.py` sobre `dist`. Póster medido en Edge headless contra `main`: una hoja A3 igual. Safari sin verificar. Novedad v167. PR #103, mergeado el 14/11 (tag `v167`).

## v166 · 2026-11-14
- La imagen de vista previa (`img/galera.jpg`, 1200 × 630) lleva la frase de la home: «Herramientas abiertas para quienes hacen libros en español y una guía para cursar Edición en la UBA», con kicker «Galera»; se fue «tu carrera de Edición, en orden». La frase se unificó en `datos/marca.json` (`frase`, `desc_home`, `alt_og_home`: sin coma, «una guía»). Novedad v166 (sin mail). PR #102, mergeado el 14/11 (tag `v166`).

## v165 · 2026-11-13
- Resumen nuevo: guía para el final de Francés, una sola para los tres niveles (Elemental, Medio y Superior). En `resumenes.py`, materia `frances` («Francés (niveles 1, 2 y 3)») con fuente en `_fuentes/apuntes-frances/`, sacada de `propuestas/2026-11-13-guia-frances/GUIA-PUBLICA.md`; aviso de materia porque la cátedra no publicó criterios, programa ni método. En `app.js` no hizo falta tocar nada: en el plan, Francés es la opción `frances` de «Otro idioma» y `resDe()` ya la lleva al resumen. Páginas `r/frances/`, buscador y sitemap con `galera_generar.py resumenes` y recorte a mano de lo que regenera de más (el generador reescribe el resto de `r/`). Descargas (A4, A5, cuadernillo, EPUB) generadas con `resumenes_latex.py --materia frances`. Novedad v165.

## v164 · 2026-11-13
- Resumen nuevo: guía para el final de Inglés, una sola para los tres niveles (Elemental, Medio y Superior). En `resumenes.py`, materia `ingles` («Inglés (niveles 1, 2 y 3)») con fuente en `_fuentes/apuntes-ingles/`, sacada de `propuestas/2026-11-12-guia-ingles/GUIA-PUBLICA.md`; aviso de materia porque del Superior no hay modelo publicado. En `app.js`, `resDe()` y `RES_DE` llevan las fichas de `ingles1`, `ingles2` e `ingles3` al mismo resumen (botón «Resúmenes de esta materia», texto del recorrido y repasos); el botón «Practicar con preguntas» y los repasos solo aparecen si la materia tiene preguntas. Páginas `r/ingles/`, entradas del buscador y del sitemap sumadas a mano: el generador reescribía el resto de `r/` con formato viejo. Novedad v164.

## v163 · 2026-11-12
- Colores de estado y escala tipográfica a tokens (bloque 11 del plan de UX/UI). Refactor, sin cambios visibles. Tanda 1: los `--gl-*` de estado de `componentes.css` (`--gl-bad`, `--gl-ok-full`, `--gl-pen-*`, `--gl-cur-*`, `--gl-reg-*`, `--gl-apr-*`) y los hex sueltos de `.tag-est` y `.marca-estado` (`galera.css`) pasan a `tokens.css` con los mismos valores en claro y en oscuro: `--estado-pen-fondo/texto/aro`, `--estado-cur-fondo/texto`, `--estado-reg-fondo/texto`, `--estado-apr-fondo/texto`, `--estado-error` y `--estado-ok-pleno`. Se quitan de `galera.css` las reglas que repetían el oscuro de esos chips (14 selectores). Tanda 2: los tamaños de `componentes.css` que coinciden exactamente con un paso (12, 14, 16, 18, 20, 24 y 32 px) usan `--t-xs` a `--t-2xl` (157 `font:` y 34 `font-size`); los que no coinciden se dejaron como estaban y están listados en `propuestas/2026-11-10-ux-ui/capturas-b11/tamanos-sin-token.md` para que Fidel decida si se suman pasos o se ajustan. `tools/comparar_colores.py` acepta `GALERA_ESTADO=<json>` para medir Mi carrera con materias cargadas. Pendiente: 10c y los hex que no son de estado.

## v162 · 2026-11-12
- Capa `--gl-*` de `componentes.css` (bloque 10 del plan de UX/UI, parte 10b). Se quitaron 13 alias exactos de los tokens base y sus 485 usos apuntan ahora al token base: `--gl-bg`→`--bg`, `--gl-card`→`--sup2`, `--gl-line`→`--borde`, `--gl-bd`→`--borde-campo`, `--gl-ink`→`--texto`, `--gl-t2`→`--texto2`, `--gl-lnk`→`--tinta`, `--gl-mark`→`--marca`, `--gl-sky`→`--tinta-suave`, `--gl-serif`→`--serif`, `--gl-got`→`--gotica`, `--gl-r`→`--radio`. `--gl-t3` (#717171) no es `--tenue` (#666): pasa a `tokens.css` como `--tenue-2` con su valor de siempre; decisión pendiente de Fidel. Quedan en `componentes.css` los de estado (`--gl-bad`, `--gl-ok-full`, `--gl-pen-*`, `--gl-cur-*`, `--gl-reg-*`, `--gl-apr-*`, del bloque 11), `--gl-click`, `--gl-on-mark`, `--gl-sans` (su pila de respaldo es más corta que la de `--fuente`) y las medidas de maqueta. Sin cambios visibles: `tools/comparar_colores.py` da 0 diferencias en 72 combinaciones (9 pantallas, 4 modos, 375 px y escritorio) y las 36 capturas son idénticas. La 10c (oscuro escrito una vez) espera decisión de Fidel.

## v161 · 2026-11-12
- Una sola fuente de tokens (bloque 10 del plan de UX/UI, parte 10a; la 10b queda para después). `tokens.css` ahora trae los valores que de verdad se ven, claro y oscuro (antes definía la paleta vieja y `galera.css` la pisaba); `galera.css` ya no redefine nada. `--mostaza` valía azul: pasa a `--marca` (que ya tenía el mismo valor en claro y en oscuro; se unen), `--mostaza-tinta` a `--tinta` (idénticos) y `--mostaza-suave` a `--marca-suave`. En `libro/planificador-de-libros.html` (página suelta, con su propia paleta de mostaza real) las variables pasan a `--oro`, `--oro-tinta` y `--oro-suave`, con los mismos valores. Se quitaron de `estilos.css` tres reglas que redefinían tokens que `galera.css` ya pisaba y no tenían efecto (paleta de impresión, `prefers-contrast: more` claro y oscuro); reactivarlas es decisión aparte. Prueba: `tools/comparar_colores.py` mide colores computados (color, fondo, bordes, contorno, relleno, trazo, sombra y fondos, también en `::before`, `::after` y `::first-letter`) de 9 pantallas en 4 modos y 2 anchos (133.764 elementos) y no encuentra diferencias; 36 capturas antes y después, idénticas píxel a píxel (`propuestas/2026-11-10-ux-ui/capturas-b10/`). Pendiente (10b): la capa `--gl-*` de `componentes.css` y el oscuro escrito una sola vez.

## v160 · 2026-11-12
- Regla de la inicial gótica (bloque 9 del plan de UX/UI): una sola por pantalla, en el h1, y ninguna en tarjetas. Se sacó la capitular de los títulos de tarjeta (`.gl-t3.gl-inicial`: materias en Resúmenes, simuladores, ofertas; la clase y el helper `sinIni` de `app.js` ya no hacen falta y salieron junto con `.gl-sin-inicial`), de los nombres de grupo del índice del inicio (`.gl-cap .gn`), de `h2.cap` (los subtítulos de las herramientas) y de la capital de párrafo `p.capital` (Privacidad, English, Prensa y Cómo se sostiene; la clase se quitó de las páginas). La g de la marca no se toca. `tools/controlar_capitulares.py` ahora hace cumplir la regla (falla si el CSS pinta gótica fuera de h1, si hay capitular en algo que no es h1, si hay más de una por página, o si un JS arma `gl-display` o `gl-t1` fuera de h1 y h2) y mantiene el aviso de letras ambiguas (S, G, I, J); corre en el CI como antes.

## v159 · 2026-11-12
- Grupo propio «Producir» en el menú (decisiones D1 y D2 de Fidel, 12/11): en `marco/sitio.json`, Simuladores, Antes de imprimir e Imprenta salen de «Estudiar» (que queda con Resúmenes, Biblioteca y Glosario) y forman el grupo «Producir» en el perfil estudiante; en el profesional, el grupo «Herramientas» pasa a llamarse «Producir» (mismo contenido; el id de la barra pasa de `herramientas` a `producir`). Lo mismo en `barra_celular`: la barra inferior del estudiante queda con cinco lugares (Planificar, Estudiar, Producir, Descubrir, Más), de 75 px de ancho a 375 px y 64 px a 320 px, con 56 px de alto y rótulos sin cortes; el profesional sigue con cuatro (Producir, Eventos, Consultar, Más). Se actualizan dos comentarios de `app.js`; la lógica no cambia. Verificado en los dos perfiles, claro y oscuro, a 320 px, 375 px y 1280 px (capturas en `propuestas/2026-11-10-ux-ui/capturas-b8/`). Bloque 8 del plan UX/UI. Apilado sobre #93.

## v158 · 2026-11-12
- Buscador a la vista en el inicio: en la vista de inicio (`vInicio()` en `app.js`, capa `gl-inicio`), debajo de la bajada, hay un campo de búsqueda (`.gl-bi` en `componentes.css`): lupa, filete de tinta, placeholder en serif itálica y el botón «Buscar» en versalitas; rótulo accesible «Buscar en Galera», foco con anillo visible y alto de 48 px (botón de 44 px). Al enviarlo, la acción `buscarInicio` (en `ACC`, sin manejadores en línea) carga la consulta en `V.bus.q` y llama a `ir('buscar')`: se llega al buscador de siempre (`/buscar/?q=`, Pagefind), que no cambia. Precarga el índice al enfocar (`data-precarga`). Verificado en 375 px y 1280 px, en claro y oscuro (capturas en `propuestas/2026-11-10-ux-ui/capturas-b7/`). Bloque 7 del plan UX/UI. Apilado sobre #92.

## v157 · 2026-11-12
- Un solo índice alfabético: el «Ir a la letra» del Glosario (`.gl-azs` / `.gl-az`, enlaces) y el del Directorio (`.dir-letras`, botones de 34 px con borde, que además tenían dos reglas distintas en `estilos.css` y `componentes.css`) pasan a ser el mismo componente: `azIndice()` en `app.js` dibuja A–Z (y «#» si hay) con las letras sin resultados apagadas (`.off`) y la elegida en `.on`; el Glosario le pasa enlaces y el Directorio, botones que filtran. Celdas de 44 px, mismo color, tamaño y foco en claro y oscuro, a 375 px y en escritorio. Se borran `.dir-letras` de `estilos.css`, `componentes.css` y de la copia en `libro/planificador-de-libros.html`. `.gl-letra` y `.glo-letra` no son índices sino los títulos de cada grupo de letra: no se tocan.

## v156 · 2026-11-11
- Apuntes en escritorio: el índice queda al margen, fijo, y el texto sin panel gris: desde 1100 px de ventana, el índice «En este apunte» (antes un `<details>` cerrado dentro del artículo) se ve siempre en una columna a la derecha del texto, con `position:sticky` debajo de la cabecera (`--alto-cab` + 24 px), `max-height` con `overflow:auto` si es más alto que la ventana, rótulo de 12 px, links a 14 px en `--gl-t2` y una línea fina a la izquierda; la sección que se lee lleva `aria-current="location"` (`IntersectionObserver` en `vigiarIndice()` de `app.js`, sin dependencias; si el navegador no lo tiene, queda sin resaltado). El apunte pasa a ir sobre `--bg` (sin fondo ni relleno) y el texto conserva su ancho (columna de 712 px, párrafos de 680 px: iguales antes y después). El índice es un `<nav aria-label="Índice del apunte">` aparte del `<details>`: cada uno se muestra solo en su rango (`display:none` en el otro, así que no aparecen dos veces para lectores de pantalla ni en el Tab); en impresión no sale. Por debajo de 1100 px, incluido el celular, no cambia nada. `vApunte` envuelve el artículo y el índice en `.gl-apunte-fila` (grilla solo desde 1100 px). Archivos: `app.js`, `componentes.css`, `datos/novedades.json`.

## v155 · 2026-11-10
- Aviso de Analytics en el celular: una franja, no una tarjeta: hasta 720 px el aviso (`.galletas`) pasa de tarjeta flotante con sombra y márgenes de 12 px, de 110 px de alto a 375 px de ancho (texto en dos renglones y botones debajo), a una franja de borde a borde pegada encima de la barra inferior: texto a 14 px a la izquierda y Aceptar y Rechazar a la derecha, de 44 px de alto y del mismo peso entre sí. A 375 px mide 67 px (el texto ocupa tres renglones: en dos no entra con dos botones de 44 px); a 320 px, 85 px (cuatro renglones). Mientras está visible, el `padding-bottom` del `body` pasa de 64 a 152 px más la zona segura, para que no tape el final de la página. Solo CSS (`estilos.css` y `galera.css`, dentro de `@media (max-width:720px)`): el texto, el HTML y la lógica de consentimiento no cambian; a 721 px o más tampoco. Sin probar en un iPhone real ni la zona segura inferior de iOS. Sale directo desde `main` (v154).

## v154 · 2026-11-10
- La cabecera de escritorio no se mueve al cargar: «Avisame» venía con `hidden` en el HTML y `app.js` lo mostraba recién al arrancar la app, lo que corría la lupa y los demás controles 103 px a la derecha (en `/` no pasaba porque ahí ya estaba visible). Ahora está siempre en `marco/app-cabecera.tpl`, y el botón del tema trae su ícono (la luna) en el HTML en vez de estar vacío hasta que `pintarTema` lo llena. A 1366 px, en las 8 páginas medidas (`/`, `/carrera/`, `/horarios/`, `/r/`, un apunte, `/simuladores/`, `/glosario/`, `/directorio/`), la lupa queda en x = 862,3 y los controles son siempre los mismos cinco, en el mismo orden (lupa, tema, Tus datos, Avisame, Compartir), al cargar y 2,5 s después, en claro y en oscuro. A 375 px no cambia (lupa, tema y Compartir; una fila de 65 px). Sin cambios en el menú, los textos ni los colores. Apilado sobre v153 (#88).

## v153 · 2026-11-10
- Apuntes en el celular: el título entra antes en la pantalla: En la página de un apunte, hasta 720 px, el título (H1) aparecía recién al 74 % de la primera pantalla (375 × 812) por lo que había encima: el «← volver» (repetía la última miga), las cuatro acciones en tres filas y la caja «Descargar este apunte» de 208 px. Ahora el «← volver» se oculta (las migas llevan a la materia), Marcar como leído, Imprimir, Compartir y QR van en una sola fila (44 px) y la caja de descarga queda en el botón y «Otros formatos» (116 px; su título y su frase quedan solo para lectores de pantalla). El título baja de 597 a 401 px en «Saussure» y de 637 a 441 px en «Del manuscrito a la industria». Solo CSS (`componentes.css`, `@media (max-width:720px)`); el HTML y el orden de foco no cambian, salvo que el «volver» oculto sale del recorrido con Tab. En 721 px o más no cambia nada (medido a 1366 y 721 px). Queda para otro bloque llevar las acciones después del título, lo que pide cambiar el HTML. Apilado sobre v152 (#87).

## v152 · 2026-11-10
- Párrafos con links: interlineado parejo en el celular: En pantallas de hasta 560 px, los botones-enlace dentro de una frase (`button.enlace`: «Cómo funciona», «Miralo con un ejemplo», «Ver el calendario» en Mi carrera) tenían `min-height:44px` e `inline-flex`, y estiraban su renglón (65 px el párrafo de 2 líneas, con un salto de 28 px y otro de 4,5 px). Ahora el área táctil la amplía un pseudo-elemento invisible (`::after`, `inset:-2px -4px`: 25 px de alto, el máximo que entra en el interlineado sin cruzarse con otros controles; los enlaces del pie conservan sus 44 px propios) y el párrafo queda en 42 px con 21 px entre renglones. Solo CSS (`componentes.css`); no cambia colores ni tipografías. Bloque 1 del plan de UX/UI (`propuestas/2026-11-10-ux-ui/PLAN.md`).

## v151 · 2026-11-10
- Invitación a recibir las novedades por mail: Tras tu primera carga de materias, al volver a Mi carrera o al Calendario aparece una sola vez una tarjeta (no un cartel que interrumpe) que ofrece avisarte los lunes de las mesas y fechas de tus materias. El botón abre el diálogo de suscripción con las materias que cursás ya marcadas; «No, gracias» la cierra y no vuelve. No aparece en el ejemplo, con datos traídos de otro dispositivo ni a quien ya pidió la suscripción. Se mide con `nov_invitacion_vista`, `nov_invitacion_clic` y `nov_invitacion_cerrada` (solo con consentimiento); `primera_carga` no cambia. (#86)

## v150 · 2026-11-10
- Suscripción por mail: más fácil de confirmar: El mensaje de cierre dice de qué remitente llega la confirmación (hola@galera.com.ar), con qué asunto y dónde buscarla si no aparece, y que el link sirve 7 días. Si el link se abre vencido, se ofrece volver a suscribirse en un toque. En el script de Apps Script (no es parte del sitio, se despliega con clasp): recordatorio único a los 3 días para quien no confirmó, asunto y primeras líneas de la confirmación sin tono promocional. (#85)

## v149 · 2026-11-10
- Imprenta: de tu texto a un fanzine: Escribí o pegá desde Word o Google Docs y Galera arma tu fanzine de una hoja o tu acaballado A5 mientras escribís, con la ortotipografía corregida por script. Bajás el PDF impuesto para imprimir en casa o las páginas sueltas con sangrado para la imprenta. El compilador de Typst se baja de descargas.galera.com.ar y se verifica antes de usarlo. (#77; mergeado el 14/11 (tag `v170`))

## v148 · 2026-11-09
- Tarifario de tarifarios: los valores, con su fuente: El tarifario ahora muestra los valores que publican las asociaciones y colegios de traducción, corrección, escritura, fotografía y licencias, tal como figuran en cada fuente, con su edición, la fecha en que se consultó y el enlace al original. Se puede filtrar por rubro y unidad, ver solo los vigentes y comparar un mismo concepto entre fuentes. Dos cifras de la UEE que parecen errores de tipeo de la fuente quedan copiadas como figuran y marcadas. (#82)

## v147 · 2026-11-09
- Dos mapas de lectura de literatura latinoamericana: Los mapas de lectura suman Literatura Latinoamericana I (cátedras de Añón y El Jaber, de la conquista al modernismo) y Literatura Latinoamericana II (cátedra de Torres, naturaleza y extractivismo): 58 lecturas con su teoría, su póster para imprimir y enlaces a ediciones libres cuando existen. (#84)

## v146 · 2026-11-09
- Redactor de contratos del libro (borrador): Armá borradores de contratos de traducción, edición, cesión de derechos, encargo, ilustración, corrección, coedición, autoedición y audiolibro, con la fuente de cada cláusula. Solo traducción y edición se apoyan en un modelo oficial: los otros siete llevan una franja de borrador sin revisión profesional. Nada se guarda ni se envía: se arma en tu navegador. (#81)

## v145 · 2026-11-09
- Calculadora de lomo y plantilla de tapa: Un simulador nuevo: con las páginas y el espesor del papel calcula el lomo de tu libro (rústica, con solapas o cartoné) y la tapa abierta con sangrado, y te baja una plantilla en PDF o SVG para diseñar encima. (#76)

## v144 · 2026-11-09
- Antes de imprimir: revisá tu PDF: Una pantalla nueva para no llevarte sorpresas en la imprenta: subí tu PDF y Galera revisa sangrado, fuentes, resolución de imágenes, color y páginas, sin que el archivo salga de tu compu. También lo impone como fanzine de una hoja o acaballado para imprimir en casa, y trae la lista de lo que más falla en el ripeo. (#75)

## v143 · 2026-11-09
- Directorio: nueva solapa de Instituciones: El Directorio suma una solapa con doce instituciones del mundo del libro: cámaras, agencias, la Biblioteca Nacional, ferias, gremios y asociaciones de traductores y escritores. Cada ficha trae su fuente y la fecha en que se leyó. (#78)

## v142 · 2026-11-07
- Galera, para quienes hacen libros: Ahora la portada dice lo que Galera ya era: herramientas abiertas para quienes hacen libros en español, y la guía para cursar Edición en la UBA. Cambiaron la frase de la portada, Prensa, la firma y los títulos de varias pantallas, y se sumó un resumen en inglés. (primera tanda del plan de público: P0 y P1 chicos, D1, D2, D6, D7)

## v141 · 2026-11-07
- Directorio sin enlaces muertos: Sacamos del Directorio los enlaces a sitios que ya no existen o que cambiaron de dueño, y actualizamos los de negocios que se mudaron. Las fichas siguen: solo se quitó el enlace. (#69, integración #70)

## v140 · 2026-11-07
- Letras más livianas: Las tipografías del sitio pesan un tercio menos y las del primer vistazo se piden antes, así que el texto aparece más rápido en el celular. (#66; novedad sumada el 7/11 en #71)

## v139 · 2026-11-07
- Cada pantalla baja solo lo que usa: Los simuladores, el arcade, los horarios y el grafo del glosario se cargan recién cuando entrás a esas pantallas. El resto del sitio abre con unos 150 KB menos. (#68; novedad sumada el 7/11 en #71)

## v138 · 2026-11-06
- Mejoras de accesibilidad: Se corrigió el contraste de los números de los apuntes y del peso en los botones de descarga, las tablas de los apuntes se pueden recorrer con el teclado y el calendario ahora se lee bien con lector de pantalla. (#67, integración #70)

## v137 · 2026-11-06
- Enlaces al día: Revisamos los enlaces del sitio: las leyes del simulador y de Derechos Editoriales ahora abren en Argentina.gob.ar (InfoLEG ya no responde) y más de doscientos enlaces del Directorio y de las bibliografías pasan directo a la dirección segura. (#64, integración #70)

## v136 · 2026-11-06
- Apuntes al día y avisos de borrador nuevos: Los apuntes de Corrección de Estilo ahora nombran los ejes con los códigos nuevos (T01a, T10a, P09b…) y el solucionario de las prácticas vuelve a mostrar todas sus partes. Los apuntes con aviso de borrador lo muestran sin emojis y te invitan a avisar con «Contame qué falta». (#63, integración #70)

## v135 · 2026-11-06
- Buscador con menos relleno: El buscador deja afuera los botones, las migas y el índice que se repiten en cada apunte, así los resultados muestran el texto que importa. (#61; novedad sumada el 7/11 en #71)

## v134 · 2026-11-06
- Seminario PST: desde qué ingreso: Aclaramos que el seminario de grado tiene que ser un seminario PST solo si ingresaste desde 2022, como indica el Departamento de Edición. (#60, integración #70)

## v133 · 2026-11-06
- Formularios de Horarios más claros: «Cargar un horario» y «Horario en que no puedo» ahora tienen cada campo con su etiqueta visible, del tamaño justo para tocar en el celular y sin textos cortados. Funcionan igual que antes. (#58, integración #70)

## v132 · 2026-11-06
- El buscador responde más rápido: Buscar en Galera tarda menos: ahora se cargan los primeros diez resultados y el resto aparece con «Ver más resultados». El buscador también se prepara antes de que empieces a escribir. (#57, integración #70)

## v131 · 2026-11-06
- Planificador de libros: más cómodo en el celular: El archivo descargable del planificador de libros ahora tiene un título propio para los lectores de pantalla, esquinas iguales a las del resto de Galera y botones, casillas y enlaces de 44 píxeles en el celular, para tocarlos sin errar. (#56, integración #70)

## v130 · 2026-11-06
- Arreglos de texto en preguntas frecuentes: Arreglos de texto en las preguntas frecuentes y en el aviso de respuestas demasiado largas. (#55, integración #70)

## v129 · 2026-11-06
- Mapas de lectura, cuatro arreglos. (1) Los programas en PDF de las cátedras daban «no encontrado» porque el Departamento de Letras mudó su sitio: ahora Galera guarda su copia en R2 (`descargas.galera.com.ar/programas/letras/2026/`) y el enlace dice «Programa 2026 en PDF (copia de Galera)», con otro al sitio del Departamento. (2) Póster A3 de cada mapa (`/lecturas/<id>/poster/`, noindex): reproduce los pósteres del lienzo a 1123 × 1587 px, con las lecturas que se marcan y tachan igual que en el mapa; en pantalla se escala al ancho, al imprimir sale a tamaño real (`@page` A3 vertical). El botón del mapa pasa a «Ver el póster». Los textos cortos del póster viven en `datos/lecturas.json` (`poster`, `autor_corto`, `titulo_corto`, `obras_poster`). (3) En el índice de mapas, la barra «X de N leídas» queda siempre al pie de cada tarjeta. (4) «Avisame por mail» suma el tema «Mapas de lectura nuevos» (`lecturas`); requiere desplegar `Novedades.gs`.

## v128 · 2026-11-06
- Mapas de lectura de Letras (/lecturas/, grupo Descubrir de los dos perfiles): tres mapas armados con los programas 2026 de Literatura Argentina I (cátedras A y B), Literatura Argentina II y Problemas de Literatura Argentina (FFyL, UBA), 82 lecturas en total. Cada mapa trae el hilo del programa, las lecturas por tramo como tarjetas que se marcan como leídas (se guarda solo en el navegador, en `cursada.v1`), un carril de teoría numerado (T1, T2…) enlazado desde cada lectura, el estado de derechos de la obra y un enlace a una edición libre cuando existe. Botón «Imprimir el póster» con una hoja de impresión propia. Datos en `datos/lecturas.json`; páginas de entrada con SEO, JSON-LD generado en el build desde el mismo archivo y control de ids y referencias en `armar.py --comprobar`.

## v127 · 2026-11-05
- Preguntas frecuentes: pestaña «Sin responder» (/preguntas/?ver=sin-responder) con 34 preguntas que Galera todavía no responde, tomadas de los vacíos de v124. Cada una abre un formulario para dejar la respuesta, con firma opcional y aceptación para publicarla; llega a la pestaña «respuestas» de la planilla del buzón (mismos topes y filtros anti-spam, sin HTML ni fórmulas) y no se publica sin revisión. Las firmas publicadas aparecen debajo de la respuesta y en la lista nueva de Colaboradores de Cómo se sostiene. Legal suma el párrafo de privacidad. Herramienta nueva: faq_responder.py.

## v126 · 2026-11-04
- Corrección de los textos de v115 a v124: mayúscula de «campus» y de «bibliotecas» en dos preguntas frecuentes y una repetición en la página de Prensa. En las novedades, se saca la mención de los impuestos de v118 y el link de v115 pasa a galera.com.ar/sostener/. El plan queda al día (buscador, descargas y preguntas listos; redes en curso).

## v125 · 2026-11-05
- Mi carrera en el celular: el anillo de avance y el resumen de requisitos van lado a lado, así que el promedio y lo que falta se ven antes. La descripción de la portada (buscadores) ya no menciona la Facultad. Los links a una sección de otra pantalla (como «Ver el plan completo» de Novedades) bajan hasta ella, y los títulos de Legal, Cómo se sostiene y similares ya no quedan tapados por la cabecera.

## v124 · 2026-11-04
- Preguntas frecuentes (/preguntas/): 45 respuestas en 11 temas (empezar la carrera, cursada, inscripción y horarios, idiomas, finales, sistemas, título, estudiar, contacto y sedes, eventos y trabajo, Galera), cada una con su link. El buscador muestra arriba, con la respuesta completa, hasta dos preguntas que coinciden con lo que escribís (también con otras palabras: «me anoto», «correlativas»). Al final, un formulario para dejar una pregunta que no esté. La página lleva el marcado FAQPage para los buscadores.

## v123 · 2026-11-04
- Buscador para todo el sitio: una lupa en la cabecera lleva a «Buscar en Galera» (/buscar/), que busca en los resúmenes, el glosario, los simuladores, los links y el resto de las pantallas. Usa Pagefind: el índice se arma al publicar y se baja solo cuando buscás, sin servidor. Si Analytics está aceptado, se cuenta cuando una búsqueda no encuentra nada (solo el término, hasta 50 caracteres).

## v122 · 2026-11-04
- Descargas de los resúmenes: en cada apunte, un botón para bajarlo en PDF A4, PDF A5, cuadernillo para imprimir (con la línea «Imprimí doble faz, borde corto; doblá al medio») o EPUB, con peso y páginas; Galera recuerda el último formato. En cada materia, «Descargar todo» con la lista de apuntes en el formato elegido. Los archivos viven en Cloudflare R2 (descargas.galera.com.ar). «Cómo se sostiene» suma ese gasto, de $0.

## v121 · 2026-11-02
- Lo que se comparte, con el estilo de Galera: las imágenes de «Mi avance», logros, resultados, «Mi semana» y «Qué voy a cursar» y el QR descargable pasan de azul marino y dorado a fondo blanco, cinta de puntos, azul de Galera y «galera» en gótica (fuentes propias). Sin emojis en los textos de WhatsApp ni en los títulos de los diálogos. Los archivos que se bajan se llaman `galera-…` (imágenes, .ics y copia de datos).

## v120 · 2026-11-02
- Horarios, como el tablero: las materias a la izquierda y la semana a la derecha, con la grilla de horas (rayas rojas si dos clases se pisan). En celular, selector de día y las clases del día en bloques. Sin colores por materia: el azul y los puntos son los de Galera.

## v119 · 2026-11-02
- Directorio: el mapa de provincias vuelve a estar siempre visible arriba de las fichas, en la columna central (sin el botón «Ver el mapa»).

## v118 · 2026-11-02
- «Cómo se sostiene»: horas de trabajo al día (rango medido con Claude y total por cambios guardados, sin contar los del bot); ahora se actualizan solas cada lunes antes del mail de novedades.
- Costos: el dominio salió $8.500 por año; se sacan los impuestos de Claude y la fila «Parte de ese gasto que va a Galera».
- El pie suma el enlace a la página de Prensa (la que se hizo en v116).

## v117 · 2026-11-02
- La descripción del perfil Trabajar, en el inicio, queda más corta: «…y los apuntes de Edición».

## v116 · 2026-11-02
- Galera suma sus redes (Instagram, LinkedIn, YouTube y el canal de WhatsApp), con los enlaces en el pie de todas las páginas.
- Nueva página de Prensa (/prensa/): qué es Galera, datos para citar, logo, colores y tipografías, y el contacto.
- Estadísticas con una propiedad de Google Analytics propia para galera.com.ar; Legal explica los parámetros UTM de los enlaces de las redes.

## v115 · 2026-11-01
- La Biblioteca muestra los libros con tapas tipográficas, más chicas y en más columnas.
- En el inicio, los perfiles pasan a llamarse «Estudiar» y «Trabajar»; Trabajar suma los apuntes de la carrera.
- El plan de Galera se actualizó y se lee más rápido; Novedades suma «Qué se viene» con el enlace al plan completo.

## v114 · 2026-10-31
- Cada pantalla tiene una sola versión y una dirección propia (/biblioteca/, /glosario/…); los links viejos siguen andando.
- En el celular, la barra de abajo está en todas las pantallas y suma Descubrir; Glosario y Directorio se ordenan por letra.

## v113 · 2026-10-31
- Los apuntes dejan los emojis de los avisos y los links; botones y desplegables más fáciles de tocar en el celular.
- Arreglo: las tablas largas de algunos apuntes ya no ensanchan la página en el celular.

## v112 · 2026-10-31
- Novedades, Links útiles y Configuración con el título, la grilla y las tarjetas del resto del sitio; los links se agrupan en tarjetas y suman accesos a Biblioteca, Glosario y Directorio.
- Arreglo: sin emojis en Novedades y en los avisos; los interruptores de Configuración tienen 44 px de alto para tocarlos.

## v111 · 2026-10-31
- Glosario, Ferias y eventos y Directorio con la grilla y las tarjetas del resto del sitio; buscador y filtros en cada uno.
- Arreglo: sin emojis ni símbolos sueltos en los botones del grafo y del directorio.

## v110 · 2026-10-31
- El inicio cierra con una ilustración de un caballero con estandarte, en azul de Galera y con versión para el modo oscuro.

## v109 · 2026-10-31
- Resúmenes, Simuladores y Biblioteca con la grilla y las tarjetas del resto del sitio; filtros y búsqueda en Resúmenes y Biblioteca.
- Arreglo: el título «Simuladores» se leía «Gimuladores» por la inicial gótica; las páginas de cada simulador ya no llevan emojis.

## v108 · 2026-10-31
- Privacidad y términos se lee mejor, en claro y en oscuro.
- «Cómo se sostiene» suma formas de colaborar con plata o con tiempo, un lugar para los mecenas y el plan al día.

## v107 · 2026-10-31
- Un solo marco para todo el sitio: La cabecera, el menú y el pie se arman desde un único lugar al publicar, así no quedan páginas con una versión vieja. (#28; novedad sumada el 7/11 en #71)

## v106 · 2026-10-31
- El menú, el pie y los nombres de las secciones son los mismos en todo el sitio.
- Arreglo: «Mi carrera» en el menú y el pie de las páginas estáticas abría el inicio; ahora abre tu carrera.

## v105 · 2026-10-31
- Horarios y Calendario rehechos con los componentes nuevos: materias y comisiones en filas simples, avisos de superposición, la semana en grilla y el mes con filtros. Sin emojis. Tus horarios guardados siguen igual.

## v104 · 2026-10-31
- El pie junta privacidad y términos en un solo enlace, a la derecha de la guía del ingresante; sale «Soporte» y la g de galera va en azul.

## v103 · 2026-10-31
- Eventos, Fuentes y Legal (privacidad y términos de uso) aparecen en el menú y en el pie. Herramientas vuelve a ser un grupo propio para quienes trabajan con libros.

## v102 · 2026-10-31
- Mi carrera rehecha con los componentes nuevos: avance y promedio, plan por grupos, y lo que viene y compartir al costado. Sin emojis. Tus datos guardados siguen igual.

## v101 · 2026-10-31
- Retoques: el inicio tiene el ancho del diseño y pasa a celular a los 720 px; las páginas estáticas suman al pie la fila de enlaces.

## v100 · 2026-10-31
- Inicio rehecho con los componentes nuevos: mismo índice y colofón, y botones más fáciles de tocar en el celular (también en el pie). Sin emojis en el pie.

## v99 · 2026-10-31
- Base del rediseño: componentes nuevos (estados, tarjetas, botones, filas) y una página de muestra interna. Todavía no cambia lo que ves.

## v98 · 2026-10-31
- Arreglo: Legal explica bien cómo darse de baja del aviso por mail (con el enlace de cada mail).

## v97 · 2026-10-31
- La página Legal suma la parte de privacidad y las direcciones de contacto (privacidad, soporte, prensa); el pie tiene enlaces a Soporte y Privacidad, y los errores de la app apuntan a soporte.

## v96 · 2026-10-30
- Hay una página Legal (datos, permisos, contacto) y un aviso propio para los enlaces que no existen.

## v95 · 2026-10-30
- El menú tiene cuatro grupos (Planificar, Estudiar, Descubrir y Galera) y el pie suma «Escribir a Fidel»; salieron los íconos de colores de Simuladores y de la elección de perfil.

## v94 · 2026-10-30
- Las páginas estáticas (Glosario, Biblioteca, Directorio, Simuladores, Cómo se sostiene y los resúmenes) tienen el título grande con inicial gótica y el contenido más ancho, como en el diseño.

## v93 · 2026-10-30
- La cabecera, el índice de inicio y el pie de Galera quedaron con las medidas, los colores y la tipografía del diseño (la letra de las bajadas ahora es Literata).

## v92 · 2026-10-30
- Textos de la app revisados con la hoja de estilo: números en letras y el mismo nombre para el botón «Contame qué falta».

## v91 · 2026-10-29
- Cada pantalla abre con su inicial en gótica, el pie quedó más corto y el modo oscuro ajustó sus colores.
- Arreglo: la bajada del inicio no estaba centrada y la barra de estadísticas tenía el texto y los botones desalineados.

## v90 · 2026-10-29
- Calendario por mes con filtros y «Lo que viene» al costado (la lista sigue ahí), Mi carrera con el ícono de estado de cada materia y Configuración con secciones (perfil, apariencia, avisos, datos) e interruptores para el tema, los avisos de progreso y las estadísticas anónimas.
- Horarios: las materias elegidas se marcan con un cuadradito de color en vez de pintar toda la fila.

## v89 · 2026-10-29
- Novedades, Links, Configuración y Horarios con la cara de Galera (Horarios: días en versalitas, líneas lisas, materias en filas y superposición con rayas rojas): Novedades por versión con el aviso del mail al costado, links en tres columnas y «Ajustes» pasa a llamarse «Configuración».
- Arreglo: al abrir un link directo antes de que cargue el plan, la consola mostraba un error.

## v88 · 2026-10-29
- Galera se ve igual en todo el sitio: nombre, íconos de estado de las materias, menú con grupos en las páginas de lectura y vistas previas con la marca nueva.
- Arreglo: los botones de la barra de Analytics tenían el texto descentrado.

## v87 · 2026-10-29
- Nuevo ícono (la g gótica en azul), cinta de puntos en la cabecera y pie reordenado con todas las secciones.

## v86 · 2026-10-29
- Los resúmenes, la biblioteca, el glosario y el resto de las páginas de lectura se ven con el estilo de Galera (nombre en gótica, azul, claro y oscuro).

## v85 · 2026-10-29
- Una página nueva, «En preprensa», adelanta lo que viene. Todavía no está enlazada desde el resto del sitio.

## v84 · 2026-10-29
- Arreglo: en Resúmenes, Edición de Publicaciones Periódicas (0922) tenía mal el nombre y decía «Para los parciales»; ahora dice «Para el final».

## v83 · 2026-10-28
- El buscador de resúmenes tiene un rótulo visible, y los avisos de error de carga dicen que puede ser la conexión.

## v82 · 2026-10-28
- Cabecera más clara: los íconos quedan alineados con el menú y, en pantallas anchas, dicen qué hacen. El grupo «Cursada» del menú pasa a llamarse «El sitio».

## v81 · 2026-10-28
- «Avisame por mail» también está en el menú Más, y «Sugerencias» pasó a llamarse «Contame qué falta».

## v80 · 2026-10-28
- Los tamaños de letra de títulos y textos siguen una sola escala; casi no se nota, pero todo queda más parejo.
- El Planificador de libros descargado se ve bien también sin internet.

## v79 · 2026-10-28
- Resúmenes nuevos de Estructura y Edición de Publicaciones Periodísticas (0922) y Teoría de los Medios y de la Cultura (0913), con aviso de las partes por verificar y la lista de textos que faltan.

## v78 · 2026-10-28
- En el inicio, el listado del sitio se llama «Índice» en lugar de «Sumario».

## v77 · 2026-10-27
- Cursada abre en un inicio nuevo: todo el sitio por grupos y un selector de perfil (estudiante o profesional del libro) que se pliega al elegir.

## v76 · 2026-10-27
- Los avisos de fecha y horario dicen qué falta, el reintento dice «Probar de nuevo» y las comillas de la interfaz son las latinas «así».
- Textos más directos en la copia de datos, la baja del mail, los errores de carga y el buscador de resúmenes.

## v75 · 2026-10-27
- Tarjetas, botones y campos usan un solo radio de esquina, más chico y parejo.

## v74 · 2026-10-27
- Arreglo: el menú de la cabecera en la computadora (Planificar, Estudiar, Descubrir) ya no se cierra solo al tocarlo.

## v73 · 2026-10-27
- Arreglo: otros 170 estilos repetidos del código pasan a clases compartidas, sin cambios visibles (claro, oscuro, escritorio y celular).

## v72 · 2026-10-27
- Los tamaños de letra se ordenan en cuatro medidas, así los textos quedan más parejos entre pantallas.
- Arreglo: se quitan unos 160 estilos repetidos del código, sin cambios visibles.

## v71 · 2026-10-27
- Al guardar una copia, Cursada te avisa dónde quedó y te recuerda ponerla en un lugar seguro.
- Los avisos salen arriba y ya no se pisan con la barra de cookies ni con las invitaciones.
- En el celular, Estado y Nota tienen rótulo visible, y las grillas que se mueven de costado muestran una sombra en el borde.

## v70 · 2026-10-27
- El mapa del Directorio se baja solo cuando abrís el Directorio, así el resto del sitio arranca más liviano.

## v69 · 2026-10-27
- La cabecera, la navegación y el pie se ordenan en grupos (Planificar, Estudiar, Herramientas, Descubrir, Cursada), con botón de modo claro y oscuro.
- La primera visita ya no abre una ventana: se ve el sitio y una franja ofrece el perfil de quienes trabajan con libros.
- Las confirmaciones (reemplazar una copia, borrar tus datos, salir del Arcade) tienen botones que dicen lo que hacen.
- Un solo nombre para cada acción: Tus datos, Guardar una copia, Avisame por mail, Contame qué falta, Sostener y Ajustes.

## v68 · 2026-10-27
- La Biblioteca avisa qué textos del programa faltan en Teoría de los Medios y en Periodísticas, con botón para avisar si los tenés.
- Arreglo: dos referencias de la Biblioteca (Informática 0915 y Derechos Editoriales 0919) ahora coinciden con el programa.

## v67 · 2026-10-27
- El Directorio suma 98 fichas: 17 imprentas, 8 distribuidoras, 46 librerías (varias del interior), 26 editoriales y una papelera, cada una con su fuente.

## v66 · 2026-10-26
- Los simuladores pasan a llamarse Herramientas. En el celular, la barra de abajo se ordena en grupos y las pestañas de cada grupo quedan fijas arriba.
- Al cargar una nota menor a 4, el aviso aparece junto al campo, no borra lo que escribiste y podés cargarla como aplazo con un toque.
- Arreglo: en el celular ya no sobra scroll, los diálogos no mueven el fondo y el botón de cerrar es más fácil de tocar. Quienes trabajan con libros ahora ven también los Resúmenes.

## v65 · 2026-10-25
- Logros para compartir como imagen («Aprobé el 50 % de la carrera»), y al aprobar una materia te invitamos a dejar tu apunte para quien viene detrás.
- Podés mandar tu resumen de cada materia por mail (se revisa antes de publicarlo). Nueva guía del ingresante con qué anotarte primero y el mapa del orden recomendado para compartir.
- Horarios: «Qué voy a cursar» arma el mensaje y la imagen para pasarle al grupo. La bajada ya no menciona a la facultad.

## v64 · 2026-10-24
- Compartir: tu resultado de la autoevaluación, tu avance y tu semana de horarios, como imagen (sin nombre ni datos personales).
- Compartir: código QR de cualquier pantalla, link de solo lectura para tu horario, pasarle tu plan a un amigo (sin notas) y desafío del Arcade con las mismas preguntas.
- Cursada se puede instalar en el celular y abre también sin conexión. Directorio: +95 editoriales.

## v63 · 2026-10-24
- Directorio: índice para saltar a una letra de la A a la Z.
- Arreglo: el logo se veía casi sin contraste en modo oscuro.
- Las pantallas de «Cargando…» muestran un indicador de espera (quieto si tenés activado reducir movimiento).

## v62 · 2026-10-24
- Directorio: 500 editoriales más del registro oficial del Ministerio de Cultura, fichas repetidas unidas y todo ordenado de la A a la Z.
- Directorio: filtro por provincia con lista, «solo con sitio web» y botón para limpiar filtros.

## v61 · 2026-10-23
- Arcade: las marcas se suman a un top de todos (con tres letras) y el botón 🏆 Top lleva directo al ranking.

## v60 · 2026-10-22
- Arcade de Corrección de Estilo: sala aparte y opcional con preguntas de tres vidas y racha (1.er parcial, 2.º parcial y Final) y un Práctico para tocar el error en un texto; récords en tu navegador.

## v59 · 2026-10-22
- Resúmenes de Edición Editorial y de las dos Informáticas (0914, 0916, 0917): apuntes, autoevaluaciones y un simulacro con respuestas por materia.

## v58 · 2026-10-21
- Resúmenes de Corrección de Estilo: apuntes de las clases 10 a 14, gerundios, tiempo y modo, determinativos, repaso final del 2.º parcial y dos simulacros nuevos con respuestas.

## v57 · 2026-10-21
- «Mis datos» suma «Pasar a otro dispositivo»: un QR y un link con tus notas, fechas y horarios, sin cuentas ni servidores; en el otro dispositivo se confirma antes de reemplazar.

## v56 · 2026-10-21
- Arreglo: todos los campos tienen un largo máximo y el mail de la suscripción y de las sugerencias se revisa antes de enviarse.

## v55 · 2026-10-21
- El simulador de escandallo y el comparador de títulos explican, al final, cómo hacer la cuenta a mano paso a paso, con tus cifras.

## v54 · 2026-10-20
- La Biblioteca junta en una sola lista los libros recomendados, «Libros sobre Libros» y más de 500 libros de la bibliografía de los programas, con filtros por origen, tema y materia.
- Cada libro muestra qué materias lo piden y si es obligatorio o complementario.

## v53 · 2026-10-20
- Todas las pestañas tienen el mismo ancho de página y los textos largos se leen más cómodos.
- Arreglo: el mapa del Directorio no mostraba el número de Salta ni el de Tierra del Fuego.

## v52 · 2026-10-20
- El Directorio suma 250 editoriales independientes que expusieron en la Feria de Editores (FED) 2025 y 2026, con sus temáticas y la fuente.

## v51 · 2026-10-20
- La Biblioteca suma «Libros sobre libros» (28 títulos del FCE) y «Publicaciones periódicas» del sector por idioma (español, inglés, portugués, alemán y francés), y se abre también al perfil profesional.

## v50 · 2026-10-20
- Horarios suma los idiomas (inglés, francés, alemán, italiano y portugués) del 2.º cuatrimestre 2026, que publica el Departamento de Lenguas Modernas aparte de la planilla de la Facultad.

## v49 · 2026-10-20
- Eventos suma convocatorias y subsidios del sector (Fondo Nacional de las Artes, CONABIP, Programa Sur, Ciudad de Buenos Aires) con fecha de cierre y fuente oficial; las de 2027 sin publicar figuran «a confirmar».

## v48 · 2026-10-20
- Arreglo: el grafo del glosario ya no une términos por palabras comunes (valor, lengua, punto…) y suma conexiones entre términos que sí se definen uno con otro.

## v47 · 2026-10-20
- El Directorio suma una solapa de productores de papel: las papeleras que fabrican papel obra, de diarios y cartulina, con provincia, localidad de la planta y fuente oficial.

## v46 · 2026-10-20
- Resúmenes de Derechos Editoriales y del Autor (borrador): apuntes de las nueve unidades con los fallos de la cursada y autoevaluación, con aviso de que falta revisarlos.

## v45 · 2026-10-20
- Más fácil de tocar en el celular: botones, links chicos, signos de ayuda, desplegables y casillas tienen un área de toque de 44 px, sin cambiar el diseño.
- Arreglo: dos textos con poco contraste en modo oscuro (porcentaje del simulador de formatos y datos de donación) y links rotos de la bibliografía de Derecho.

## v44 · 2026-10-20
- El glosario se puede ver como grafo de conceptos: cada término se une con los que nombra su definición; lo explorás tocando, acercando y filtrando por materia. La lista suma «Relacionado con» en cada término.

## v43 · 2026-10-20
- El Directorio suma más de 1.300 librerías de todo el país (datos abiertos oficiales), con búsqueda por nombre, provincia o barrio.

## v42 · 2026-10-20
- El pie lleva un solo link «Fuentes» con la lista completa de fuentes del sitio, y «Contanos» pasó a «Contame».

## v41 · 2026-10-19
- Tarifario de referencia, en Herramientas del profesional: qué colegios y asociaciones publican tarifas de traducción, corrección, diseño e ilustración, con unidad, fecha y link a la fuente.

## v40 · 2026-10-19
- En el Directorio, las provincias se eligen sobre el mapa real de Argentina, con la cantidad de fichas en cada una.

## v39 · 2026-10-19
- Contratos modelo: armás un borrador de contrato de traducción (modelo de la AATI) o de edición (Ley 11.723, arts. 37 a 44), con la fuente de cada cláusula. Borrador orientativo, no asesoramiento legal.

## v38 · 2026-10-19
- Nueva última pestaña, Configuración: ahí se cambia entre estudiante y profesional del libro, y están la copia de seguridad y los avisos. Sale el selector de la cabecera.
- En el pie, un botón «Visitá mi sitio».

## v37 · 2026-10-19
- El selector entre estudiante y profesional del libro está siempre a la vista en la cabecera (en la compu no se encontraba).
- El pie de página quedó más corto, con los mismos avisos de privacidad y cookies.

## v36 · 2026-10-19
- Planificador de libros: seguimiento. Marcás el avance de cada tarea, las fechas en que empezó y terminó, y fijás una línea base para ver cuánto te desviaste de lo planeado.
- El planificador se puede descargar como un solo archivo .html que funciona sin internet.

## v35 · 2026-10-19
- En Novedades, cada perfil ve lo suyo: el profesional del libro no ve los cambios de la carrera. En el mail de los lunes se puede elegir «Novedades para profesionales del libro».
- En Leyes del libro, el Convenio de Berna, el WCT y el WPPT tienen ahora cada uno su ficha.

## v34 · 2026-10-19
- Nuevo selector «¿Qué te representa?»: profesional del libro o estudiante. El profesional ve herramientas, un calendario de ferias y eventos del sector (con la fuente oficial y lo que falta confirmar) y links útiles del sector, sin las pestañas de la carrera.

## v33 · 2026-10-19
- Nuevo «Leyes del libro» (borrador): las normas del derecho de autor y editorial en una pirámide, con ficha y link oficial de cada una, y un traductor de términos jurídicos a castellano común.
- En Novedades, cada versión muestra qué pedidos respondió, y el pedido del planificador con Gantt quedó marcado como hecho.

## v32 · 2026-10-19
- Nuevo «Directorio del libro»: editoriales de todo el país (104 por ahora) para buscar por nombre, línea o provincia, con mapa y el enlace a la fuente de cada una. Imprentas, distribuidoras y librerías se irán sumando.

- El Directorio también aparece para quien elige el perfil profesional del libro.

## v31 · 2026-10-17
- Nuevo simulador «Formatos de papel y serie A»: los tamaños de FPI a escala (serie A, pliegos y libros) y una demostración de por qué la serie A conserva su forma al doblarse.

## v30 · 2026-10-17
- Planificador de libros: ahora guardás varios libros y los ves juntos en un catálogo (una barra por título, con sus hitos), y asignás responsables a las tareas con un filtro por persona.

## v29 · 2026-10-17
- Nuevo «Planificador de libros»: el cronograma de un libro del original a la reimpresión, con plantillas por tipo de libro, días hábiles con feriados y fecha de salida hacia atrás; se exporta a PDF, calendario, planilla o copia completa.

## v28 · 2026-10-17
- Nuevo simulador «Cronograma»: armá el plan de producción de un libro y mirá el mismo cronograma como Gantt, PERT (con probabilidad de llegar a tiempo) y Roy (ruta crítica y holguras), o compará los tres.

## v27 · 2026-10-15
- Nueva pantalla «Cómo se sostiene» (en «Más»): cuántas horas de trabajo lleva Cursada, qué cuesta, cómo ayudar con una transferencia o un cafecito, y el plan de lo que viene con el estado de cada cosa.
- El botón de donar del pie lleva a esa pantalla, que también tiene su página para compartir.

## v26 · 2026-10-15
- Nuevo botón Compartir (en la cabecera y en «Más») para mandar la pantalla que estás viendo, y el pie de página quedó ordenado en cuatro grupos.
- El botón de la cabecera que dice «Novedades» ahora se llama «Recibir por mail», y «Copia de seguridad» y «Ajustes» tienen su lugar en «Más».
- Arreglo: en la paginación, 4.6 y 4,6 ahora valen lo mismo; los campos se ven mejor, los avisos de error duran más y dicen qué hacer.

## v25 · 2026-10-15
- Resúmenes de Introducción a la Actividad Editorial: nueve apuntes sobre los prácticos más el del marco legal, simulacro, siete hojas de repaso y un repaso final. Son un borrador: los datos marcados [verificar] no están confirmados.

## v24 · 2026-10-15
- En el celular, las secciones pasan a una barra inferior (Carrera, Horarios, Calendario, «Estudiar» con Resúmenes, Biblioteca, Simuladores y Glosario, y «Más» con el resto), y la cabecera ocupa menos.
- En la compu, el resumen de tu avance (con un anillo de progreso) queda fijo a la izquierda y las materias usan el resto de la pantalla; en el celular, cada materia es una fila de una lista.
- El aviso de cookies es una tarjeta chica que ya no tapa el contenido, y los botones son más grandes para tocar.

## v23 · 2026-10-14
- Nuevo simulador «Ecosistema del libro» (Introducción a la Actividad Editorial): los actores del mundo editorial como nodos de un grafo, con sus vínculos, un recorrido paso a paso de un libro y una práctica de quién es quién.
- Glosario de Introducción a la Actividad Editorial (86 términos) y, en la bibliografía de esa materia, los textos que faltan quedan marcados con un link para avisar si los tenés.

## v22 · 2026-10-14
- Ayudas para ver cuánto avanzaste, todas apagables desde Mis datos: al terminar una ronda de Practicar ves cómo te fue contra la vez anterior y qué apuntes mirar, y cada apunte muestra si está fresco o podés repasarlo.
- Retos opcionales en los simuladores de paginación y de escandallo, un registro de lo que ya hiciste, un aviso para retomar el último apunte y un recorrido de cada materia aprobada. Sin puntos, niveles ni rachas.

## v21 · 2026-10-14
- Lo que pidieron vuelve, ahora dentro de Novedades: ves el estado de cada pedido y en qué versión salió.
- Al mandar una sugerencia te avisa dónde seguirla.

## v20 · 2026-10-14
- Más privacidad: Google Analytics no se carga hasta que lo aceptás, y al rechazarlo se borran sus cookies.
- Al cargar una copia de tus datos se te pide confirmar y se descarga antes una copia de lo que tenías.
- Arreglo: las novedades por mail ya no se pueden usar para mandarle mails repetidos a otra persona, y los contactos del buzón se borran a los 6 meses.

## v19 · 2026-10-13
- Simulador nuevo de Fundamentos de la Producción de Impresos: esquema de paginación. Tildás las partes del libro, cargás las páginas de cada una y ves en qué página cae todo, qué páginas quedan en blanco y cuántas faltan para el pliego.

## v18 · 2026-10-13
- Arreglo: si tenés materias aprobadas sin nota, Mi carrera te avisa cuántas faltan y te lleva a cargarlas, para que aparezca tu promedio.

## v17 · 2026-10-13
- Tesina: ahora explica en qué consiste, cómo se estructura y trae links a las tres tesinas de Edición publicadas en el Repositorio de Filo, para leerlas de ejemplo.

## v16 · 2026-10-13
- Cada simulador tiene su propia página, con vista previa al compartirlo por WhatsApp o redes y para que se encuentre en Google. Cada simulador trae un botón «Compartir».
- La portada de Cursada ahora también muestra imagen y descripción al compartirla.

## v15 · 2026-10-13
- La pestaña Escandallo pasó a ser Simuladores: una tarjeta por simulador, ordenadas por materia (el escandallo y el comparador de títulos siguen igual).
- Simulador nuevo de Fundamentos de la Producción de Impresos: cálculo de papel e imposición, para interiores o tapa. Con calles, pinza, cola y laterales, te da pliegos, resmas, kilos y costo, dibuja el pliego y compara los formatos.

## v14 · 2026-10-13
- La pestaña Pedidos se reemplazó por Novedades: el registro completo de todo lo que se fue sumando, de la primera versión a la última, con el formato del mail de los lunes.
- Quien dejó su mail y no confirmó (el mail de confirmación a veces cae en spam) ahora recibe igual las novedades, con un aviso arriba y el botón para confirmar.

## v13 · 2026-10-11
- Primera pantalla más simple: marcás de una vez las materias aprobadas o en curso, o lo mirás con un ejemplo. Te recuerda bajar la copia de tus datos.
- Practicar: rondas de 10 preguntas por materia y repasos sugeridos antes de cada parcial. La bibliografía de cada programa aparece en la ficha de la materia.
- Arreglo: faltaba el feriado del martes 10/11 en la Ciudad. Cada pestaña dice cuándo se verificaron sus datos.

## v12 · 2026-10-09
- Cada apunte tiene su página para leer completa, sin abrir la app: con índice, link a cada parte y la autoevaluación con las respuestas plegadas.
- Los apuntes se pueden encontrar en Google, y el blog ahora los enlaza.

## v11 · 2026-10-08
- Resúmenes: todas las materias en tarjetas (las que faltan se pueden pedir), buscador en todos los apuntes y «marcar como leído» con tu avance.
- Cada parte de un apunte tiene su link para compartir, con vista previa en WhatsApp y las redes; los apuntes se pueden imprimir con las respuestas.
- Arreglo: decía «Para el los parciales» en la pestaña Resúmenes.

## v10 · 2026-10-08
- Arreglo: el resumen de Verbos de Corrección de Estilo ya no da *abolir* como defectivo, y completa *soler*, *predecir* y *deber de*.

## v9 · 2026-10-08
- Pestaña nueva: Pedidos, con lo que piden por Sugerencias y si está nuevo, en proceso o hecho.
- Para recibirte: qué es la tesina, cómo hacer el pretrámite del título y cómo pedir el diploma; y Smart Marketing en la Biblioteca.
- Arreglo: Edición Editorial figura con final y Administración con promoción, con aviso de que el régimen cambia según el año.

## v8 · 2026-10-07
- Novedades por mail: dejás tu mail y los lunes a las 8 te llega solo lo nuevo de Cursada que te importa; cambiás lo que recibís o te das de baja desde cada mail.

## v7 · 2026-10-07
- Escandallo con comparador de títulos: te dice cuál dejar como está, a cuál bajarle los costos, en cuál invertir en marketing y cuál discontinuar, con el punto de equilibrio de todos juntos.
- Pestaña nueva: Glosario con los términos clave de cada materia, buscador y acepciones según la materia.
- Resúmenes de Administración completados con el libro de la cátedra. El botón de donar ahora es un botón.

## v6 · 2026-10-06
- «Doná para mantener este proyecto» muestra el alias y el CVU para transferir sin comisión, con botón de copiar.

## v5 · 2026-10-03
- Pestañas nuevas: Resúmenes (apuntes de Corrección de Estilo, Fundamentos y Administración, con autoevaluación), Biblioteca (libros recomendados para editar) y un simulador de escandallo.
- Barra con el avance de la carrera, la electiva se elige en la misma tabla, los programas que faltaban y "Lo básico de la cursada" para ingresantes.
- Arreglo: Teoría de los Medios y Marketing son de promoción directa, y Publicaciones Periódicas es con final.

## v4 · 2026-10-01
- Llevá tu cursada a Google Calendar u otro calendario: clases semanales del primer al último día del cuatrimestre, sin los feriados.
- En Horarios, "Listo, guardar mis horarios" pliega la oferta y deja a la vista tu semana.
- Los feriados nacionales salen del sitio oficial (argentina.gob.ar) y se ven en el Calendario. Arreglo: faltaba el 9/11.

## v3 · 2026-10-01
- Arreglo: lo guardado ya no se pierde al recargar la página.

## v2 · 2026-09-30
- Botón "Mis datos" y aviso de privacidad. En Horarios, las aprobadas se ocultan y los seminarios van plegados. Arreglo del ancho en el celular. Link a Cafecito.

## v1 · 2026-09-30
- Primera versión: plan, notas y promedios, calendario, horarios con choques y sugerencias, oferta y mesas que se actualizan solas, buzón de sugerencias.
