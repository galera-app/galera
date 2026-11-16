# Tipografía

## Familias

| Familia | Variable | Para qué |
|---|---|---|
| Instrument Sans | `--fuente` | Toda la interfaz, títulos y formularios. Pesos 400 a 700. Cifras tabulares (`.gl-num`). |
| Literata | `--serif` | Lectura larga: resúmenes, glosario, Cómo se sostiene, Privacidad. Máximo 66 caracteres por línea. |
| UnifrakturMaguntia | `--gotica` | Solo dos usos: la capitular del título y el logo. Nunca en cifras ni en texto corrido. |

Las tres van como `.woff2` en `fonts/`, declaradas en `galera.css`.

## Escala

Los tamaños del cuerpo son la escala `--t-*` de `tokens.css` (`--t-xs` 12 px a `--t-2xl` 32 px). Los títulos grandes (56, 40, 28) están sueltos en las clases de `componentes.css`, no en tokens.

| Nivel | Clase | Escritorio | Celular | Peso | Uso |
|---|---|---|---|---|---|
| Display | `.gl-display` | 56/60 | 36/40 | 600 | Título de pantalla |
| Título 1 | `.gl-t1` | 40/44 | `--t-2xl`/36 | 600 | Portadas de estudio |
| Título 2 | `.gl-t2` | 28/36 | `--t-xl`/30 | 600 | Secciones |
| Título 3 | `.gl-t3` | `--t-lg`/28 | `--t-md`/26 | 600 | Tarjetas, subtítulos |
| Lectura | `.gl-lectura-texto` | `--t-md`/30 | 17/28 | 400 | Resúmenes, glosario |
| Cuerpo | `.gl-cuerpo` | `--t-base`/24 | igual | 400 a 500 | Base; nunca menos en campos |
| Chico | `.gl-chico` | `--t-sm`/20 | igual | 400 a 500 | Segundo renglón, ayudas |
| Rótulo | `.gl-rotulo` | `--t-xs`/16 | igual | 600 | Piso del sistema; versalitas +0,06 em |

Razón 1,25 redondeada a la grilla de 4. Todo en rem: a 200 % de texto las filas se apilan en vez de recortarse.

## Capitular

- Primera letra del título de pantalla en `--gotica` al 112 %, en `--marca`; el resto en Instrument Sans 600 y en tinta. Está en `.gl-display::first-letter`, `.gl-t1::first-letter` y `.lectura-main h1::first-letter`; `.sin-cap` la saca.
- Una por pantalla, solo en el h1 (lo controla `tools/controlar_capitulares.py`). Nunca en subtítulos, tarjetas, cifras («2.º cuatrimestre») ni siglas.
- Nunca va sola ni baja de 24 px: en Unifraktur la G, S, R, H, M y C cuestan, y la palabra completa da el contexto.
- **Capital de párrafo**: tres líneas de alto, solo en lectura larga (Cómo se sostiene, Privacidad y términos, resúmenes abiertos enteros). Es la excepción, no la regla.

## Descartado

Inter, Figtree, Public Sans, Atkinson Hyperlegible, IBM Plex, Source Sans; Geist Mono y toda monoespaciada para rótulos; Grenze Gotisch y las otras once capitulares candidatas; tamaños de 11 px o menos; cifras proporcionales en tablas.
