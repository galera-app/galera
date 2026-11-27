# Design system de Galera

Lo vigente del diseño de Galera, en un solo lugar del repo. Reemplaza al lienzo de Claude Design (que cierra el 14/12/2026): el lienzo y cualquier vista (artifact, plancha) se derivan de acá, nunca al revés.

**Cada dato vive en un solo archivo.** Esta carpeta no repite valores: los nombra y dice dónde están. Si un valor cambia, se cambia en su fuente y lo derivado se regenera.

## Qué es fuente

| Qué | Dónde | Notas |
|---|---|---|
| Colores (claro y oscuro), radio, escala `--t-*`, familias | [`../tokens.css`](../tokens.css) | La única fuente de los valores que se ven. Ninguna otra hoja los redefine. |
| Componentes (`.gl-*`) y sus dos colores propios (`--gl-click`, `--gl-on-mark`) | [`../componentes.css`](../componentes.css) | Estados, aviso, anillo, tarjeta, botones, campo, títulos con capitular. |
| Cabecera, logo en la cabecera, pantallas de lectura | [`../galera.css`](../galera.css) | La g azul del logo es `::first-letter` en `--marca`. |
| Menú, pie, cabecera, CSP | [`../marco/`](../marco/) | `sitio.json` y `*.tpl`; el build los expande. |
| Fuentes | [`../fonts/`](../fonts/) (`.woff2`, subconjunto) | Originales en `tools/fuentes-originales/`; recorte con `tools/subconjunto_fuentes.py`. |
| Ícono de app y favicon | [`../img/`](../img/) (`icono-180/192/512.png`, `favicon-32.png`) | |
| Reglas de uso (lo que no está en el CSS) | Esta carpeta: [marca](marca.md), [tipografía](tipografia.md), [componentes](componentes.md), [reglas](reglas.md) | Texto, sin valores. |

## Qué se deriva

Lo genera `python tools/diseno_generar.py` leyendo `tokens.css`, `componentes.css`, `marco/sitio.json` y `sitemap.xml`. No se edita a mano; `--comprobar` falla si quedó viejo.

| Archivo | Qué es |
|---|---|
| [`tokens.json`](tokens.json) | Tokens en formato W3C, claro y oscuro (Figma, Tokens Studio). |
| [`contrastes.md`](contrastes.md) | Contraste WCAG de los pares que usa el sitio, calculado. |
| [`mapa.md`](mapa.md) | Mapa del sitio: menú por perfil, barra del celular, pantallas, simuladores, pie y páginas publicadas. Sale de `marco/sitio.json` y `sitemap.xml`. |
| `vista.html` | Página para mirar colores, escala y componentes con los CSS reales. Base del artifact. Se genera fuera del repo con `--vista <carpeta>` (no es una página del sitio). |
| Artifact «Design System» | [claude.ai/artifact/TiD3CMUFXHksbDiK8V8qbj](https://claude.ai/artifact/TiD3CMUFXHksbDiK8V8qbj) (desde el 20/11/2026; el anterior quedó en la otra cuenta). Su contenido (`project/`) sale de `--artifact <carpeta>`, fuera del repo: tokens, secciones (con el mapa), los componentes de `componentes.css` y los de navegación del marco (cabecera, barra del celular, pie), con `estilos.css` y `galera.css` en el bundle. Las imágenes y el índice se suben al publicar (`104-edicion-cursada/difusion/design-system/`). Lo que se edite ahí no vuelve al repo. |

La carpeta no se publica en el sitio (`NO_PUBLICAR` en `tools/armar.py`).

## Palabras

- **Tinta**, en las reglas de diseño, es el color del texto: `--texto`. No confundir con la variable `--tinta`, que es el azul de los enlaces.
- **Azul de marca**: `--marca` (trazos, la g, el botón primario). **Azul de texto**: `--tinta` / `--azul-texto` (enlaces, con contraste AA).
- **Plata**: `--sup2`. **Cielo**: `--tinta-suave`.
- **Capitular**: la primera letra del título en UnifrakturMaguntia y `--marca`.

## De dónde sale

Las láminas rehechas del lienzo (27/10/2026: Mapa, Componentes, Marca, Tipografía, Iniciales) y el código de `main` en v174. Donde no coinciden, manda el código y la diferencia queda en [reglas.md](reglas.md#pendientes).
