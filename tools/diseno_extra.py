"""Partes del design system que salen del marco y de la app, no de los CSS: el mapa del sitio y los componentes de navegación.

Lo usa tools/diseno_generar.py. Fuentes (no se tocan): marco/sitio.json (y datos/marca.json, vía armar.py), sitemap.xml,
los íconos de la barra del celular en app.js (ICONO) y el marcado real de cabecera y pie (armar.cabecera, armar.pie).
"""
import re
import sys
from collections import Counter
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ / "tools"))
import armar  # noqa: E402  (lee marco/sitio.json con la marca ya expandida)

S = armar.S
AVISO_MAPA = "<!-- Generado por tools/diseno_generar.py desde marco/sitio.json y sitemap.xml. No editar a mano. -->"
PERFIL = {"estudiante": "Estudiante", "profesional": "Profesional del libro"}


def _item(i):
    """(título, url) de un id de pantalla o de una ruta suelta del menú («/legal/»)."""
    if i.startswith("/"):
        return i.strip("/").capitalize() or "Inicio", i
    p = S["pantallas"][i]
    return p["t"], p["url"]


def _celda(t):
    return str(t).replace("|", "\\|").replace("\n", " ")


def g_mapa():
    L = [AVISO_MAPA, "", "# Mapa del sitio", "",
         "Cómo está armada la navegación de galera.com.ar y qué páginas tiene. Sale de `marco/sitio.json` (la fuente del marco: menú, "
         "barra del celular, pie y simuladores) y de `sitemap.xml`. Para cambiar la navegación se edita `sitio.json` y se corre `tools/armar.py`.", ""]
    L += ["## Menú por perfil", "",
          "Galera tiene dos perfiles; cada uno ve los mismos grupos con otro orden y contenido. En escritorio, los grupos son pestañas de la "
          "cabecera con su fila de secciones; en el pie, columnas.", ""]
    for perfil, grupos in S["menu"].items():
        L += [f"### {PERFIL.get(perfil, perfil)}", "", "| Grupo | Secciones |", "|---|---|"]
        for nombre, ids in grupos:
            L.append(f"| {nombre} | " + " · ".join(f"[{_celda(t)}]({u})" for t, u in map(_item, ids)) + " |")
        L.append("")
    L += ["## Barra del celular", "", "Hasta 720 px la cabecera se reemplaza por una barra inferior: un botón por grupo (lleva a la última "
          "sección que usaste en él) y «Más» con el resto, el cambio de perfil, tus datos y la apariencia.", ""]
    for perfil, botones in S["barra_celular"].items():
        L += [f"### {PERFIL.get(perfil, perfil)}", "", "| Botón | Abre | Secciones del grupo |", "|---|---|---|"]
        for _, rotulo, ini, ids in botones:
            L.append(f"| {rotulo} | {_celda(_item(ini)[0])} | " + " · ".join(_celda(_item(i)[0]) for i in ids) + " |")
        L.append("")
    L += ["## Pantallas", "", "| Pantalla | Dirección | Para qué |", "|---|---|---|"]
    for i, p in S["pantallas"].items():
        L.append(f"| {_celda(p['t'])} | [{p['url']}]({p['url']}) | {_celda(p.get('desc', ''))} |")
    L += ["", "## Simuladores", "", "| Simulador | Materia | Qué hace |", "|---|---|---|"]
    for s in S["simuladores"]:
        L.append(f"| {_celda(s['t'])} | {s.get('materia', '')} | {_celda(s.get('d', ''))} |")
    P = S["pie"]
    L += ["", "## Pie", "", "Columnas con los mismos grupos del menú (perfil estudiante) más:", ""]
    for k in ("escribir", "ingresantes", "legal", "prensa"):
        if k in P:
            L.append(f"- [{_celda(P[k]['t'])}]({P[k]['url']})")
    L += [f"- {_celda(r['t'])}: {r['url']}" for r in P.get("redes", [])]
    urls = re.findall(r"<loc>https?://[^/]+(/[^<]*)</loc>", (RAIZ / "sitemap.xml").read_text(encoding="utf-8"))
    secc = Counter((u.strip("/").split("/")[0] or "(inicio)") for u in urls)
    L += ["", "## Páginas publicadas", "", f"`sitemap.xml` lista {len(urls)} páginas. Por sección:", "", "| Sección | Páginas |", "|---|---:|"]
    L += [f"| /{k}/ | {n} |" if k != "(inicio)" else f"| / | {n} |" for k, n in sorted(secc.items(), key=lambda x: (-x[1], x[0]))]
    return "\n".join(L) + "\n"


# ---------- componentes de navegación ----------

def _iconos():
    js = (RAIZ / "app.js").read_text(encoding="utf-8")
    m = re.search(r"const ICONO = \{(.*?)\};", js, re.S)
    return dict(re.findall(r"(\w+): '([^']+)'", m.group(1))) if m else {}


def barra_celular(perfil="estudiante", actual="planificar"):
    ico = _iconos()
    svg = lambda d: f'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="{d}"/></svg>'
    bot = "".join(f'<button type="button"{" aria-current=\"page\"" if id_ == actual else ""}>{svg(ico.get(ini, ""))}<span>{rot}</span></button>'
                  for id_, rot, ini, _ in S["barra_celular"][perfil])
    bot += f'<button type="button" aria-haspopup="dialog">{svg(ico.get("mas", ""))}<span>Más</span></button>'
    return f'<div class="ds-barra"><nav class="inferior" aria-label="Secciones principales">{bot}</nav></div>'


def css_barra(*hojas):
    """Las reglas de .inferior viven en una media query (≤720 px). Para la vista se repiten sin la query y sin el fixed."""
    reglas = []
    for h in hojas:
        for sel, cuerpo in re.findall(r"(\.inferior[^{}]*)\{([^{}]*)\}", h):
            if re.search(r"display\s*:\s*none", cuerpo):  # el estado oculto (escritorio, impresión, hoja abierta) no va en la vista
                continue
            cuerpo = re.sub(r"position\s*:\s*fixed", "position:static", cuerpo)
            reglas.append(", ".join(".ds-barra " + s.strip() for s in sel.split(",")) + "{" + cuerpo + "}")
    return "\n".join(reglas) + "\n.ds-barra{max-width:390px;border:1px solid var(--borde)}\n"


def previews_marco():
    """{nombre: (grupo, alto, html, guía)} de cabecera, barra del celular y pie, con el marcado que arma el build."""
    cab = armar.cabecera("carrera/index.html")
    pie = armar.pie()
    return {
        "Cabecera": ("Navegación", 150, cab,
                     "Cabecera de escritorio: «galera» en gótica con la g en `--marca`, los grupos del menú como pestañas (14 px) y debajo la fila "
                     "de secciones del grupo abierto. La pestaña y la sección actuales llevan `aria-current` y el subrayado de puntos en `--marca`.\n\n"
                     "No se escribe a mano: la arma `tools/armar.py` desde `marco/cabecera.tpl` y `marco/sitio.json` (ver la sección Mapa del sitio)."),
        "BarraCelular": ("Navegación", 90, barra_celular(),
                         "Barra inferior del celular (hasta 720 px): un botón por grupo con ícono y rótulo de 12 px siempre visibles, y «Más». "
                         "El actual va en `--tinta` con el ícono relleno de `--tinta-suave`. Cada botón mide 56 de alto.\n\n"
                         "La dibuja `app.js` (`dibujarInferior`) desde `barra_celular` de `marco/sitio.json`; los íconos son los de `ICONO`."),
        "Pie": ("Navegación", 420, pie,
                "Pie: bajada, aviso de que no es un sitio oficial, columnas con los grupos del menú, acciones (ayudar a Galera) y enlaces "
                "(cookies, tus datos, escribir, guía del ingresante, legal, prensa y redes).\n\nLo arma `tools/armar.py` desde `marco/pie.tpl`."),
    }


PREVIEWS_EXTRA = {
    "Chip": ("Etiquetas", 60,
             '<div class="fila"><span class="gl-chip">Inscripción</span><span class="gl-chip gl-chip--ok">Confirmada</span>'
             '<span class="gl-chip gl-chip--aviso">A confirmar</span><span class="gl-chip gl-chip--mal">Exámenes</span>'
             '<span class="gl-chip gl-chip--neutro">sin ver</span></div>',
             "Chip: 20 de alto, radio `--radio` (no píldora). Etiqueta de tipo o de estado de un dato (evento, repaso, formato); no es un botón.\n\n"
             "Variantes: neutra, `--ok`, `--aviso`, `--mal` y `--neutro`. No reemplaza al estado de una materia (`.gl-estado`)."),
    "Enlace": ("Acciones", 60,
               '<p>Elegiste el perfil estudiante. <button class="gl-enlace" type="button">Cambiar</button></p>',
               "Enlace de acción: subrayado, en `--tinta`, con área táctil de 44. Para acciones secundarias dentro de un texto; "
               "la acción principal de una pantalla es un botón."),
    "Interruptor": ("Formularios", 70,
                    '<div class="fila"><button class="gl-sw" type="button" role="switch" aria-checked="true" aria-label="Avisos por mail"></button>'
                    '<button class="gl-sw" type="button" role="switch" aria-checked="false" aria-label="Modo compacto"></button></div>',
                    "Interruptor (`.gl-sw`, `role=\"switch\"`): para preferencias que se aplican al instante. Va con su rótulo al lado y la fila "
                    "entera es tocable (44)."),
    "Segmentado": ("Formularios", 70,
                   '<div class="gl-seg" role="group" aria-label="Apariencia"><button type="button" class="on" aria-pressed="true">Automática</button>'
                   '<button type="button" aria-pressed="false">Clara</button><button type="button" aria-pressed="false">Oscura</button></div>',
                   "Control segmentado (`.gl-seg`): una opción de pocas (2 a 4), siempre a la vista. Se usa para la apariencia en Configuración y en «Más»."),
    "Filtros": ("Formularios", 70,
                '<div class="gl-filtros" role="group" aria-label="Filtro"><button type="button" aria-pressed="true">Todas</button>'
                '<button type="button" aria-pressed="false">Con resúmenes</button></div>',
                "Filtros (`.gl-filtros`): botones con `aria-pressed` para acotar una lista (resúmenes, formato de descarga). Rectángulos de 44 con radio `--radio`."),
    "FilaMateria": ("Materia", 200,
                    '<div class="gl-tabla"><div class="gl-fila"><span class="gl-ic gl-apr"></span><span><b>Introducción al Pensamiento Científico</b>'
                    '<span class="meta">CBC</span></span><span class="cuat gl-chico">—</span><button class="gl-sel" type="button">Aprobada</button>'
                    '<span class="nota gl-num">8</span></div><div class="gl-fila"><span class="gl-ic gl-cur"></span><span><b>Producción de Impresos</b>'
                    '<span class="meta">Edición · 0905</span></span><span class="cuat gl-chico">1.º</span><button class="gl-sel" type="button">Cursando</button>'
                    '<span class="nota gl-num"></span></div><div class="gl-fila"><span class="gl-ic gl-pen"></span><span><b>Corrección de Estilo</b>'
                    '<span class="meta">Edición · 0911</span></span><span class="cuat gl-chico">2.º</span><button class="gl-sel" type="button">Pendiente</button>'
                    '<span class="nota gl-num"></span></div></div>',
                    "Fila de materia (`.gl-fila` dentro de `.gl-tabla`): ícono de estado · nombre y meta · cuatrimestre · estado (tocable) · nota tabular.\n\n"
                    "Es la unidad de Mi carrera. El estado se cambia tocándolo."),
    "Capitulo": ("Tipografía", 70,
                 '<div class="gl-cap"><span class="num">01</span><h2 class="gl-t2">Estados de una materia</h2></div>',
                 "Capítulo del sumario (`.gl-cap`): número y título con filete inferior de tinta. Ordena el Inicio y las páginas largas como un índice de libro."),
    "Consejo": ("Contenido", 90,
                '<p class="gl-tip">Tocá el estado de una materia para cambiarlo. <b>Regular</b> quiere decir que ya aprobaste la cursada y te falta '
                'rendir el final. Todo se guarda solo en este navegador.</p>',
                "Consejo (`.gl-tip`): explicación breve dentro de un «Cómo se calcula» o al pie de una herramienta. Texto, no aviso: sin color de señal."),
    "Vacio": ("Contenido", 60, '<p class="gl-vacio" role="status">No hay libros con ese filtro.</p>',
              "Estado vacío (`.gl-vacio`, `role=\"status\"`): una frase que dice qué pasó y, si hace falta, qué hacer. También para «Cargando…»."),
    "Migas": ("Navegación", 50,
              '<nav class="gl-migas gl-chico" aria-label="Ruta"><a href="#">Galera</a> › <a href="#">Resúmenes</a> › <span>Producción de Impresos</span></nav>',
              "Migas de pan (`.gl-migas`): en páginas de más de un nivel (resúmenes, apuntes). La última no es enlace."),
    "Invitacion": ("Contenido", 140,
                   '<section class="gl-invita" aria-labelledby="ds-inv"><div class="gl-crece"><b id="ds-inv">¿Te aviso lo que cambia?</b>'
                   '<p>Los lunes a las 8:00, solo las novedades que te importan. Gratis.</p></div><div class="gl-invita-b">'
                   '<button class="gl-btn" type="button">Avisame los lunes</button><button class="gl-btn gl-btn--sec" type="button">No, gracias</button></div></section>',
                   "Invitación (`.gl-invita`): tarjeta no modal para ofrecer algo una sola vez (las novedades por mail tras la primera carga). "
                   "Siempre con la salida a la vista."),
    "Tapa": ("Contenido", 220,
             '<div class="fila"><span class="gl-tapa"><span class="lomo"></span><span class="ti">Manual de estilo de la lengua española</span><span class="au">José Martínez de Sousa</span>'
             '<span class="tr"></span></span><span class="gl-tapa sumar"><span>¿Falta un libro?<b>Sugerir un libro</b></span></span></div>',
             "Tapa tipográfica (`.gl-tapa`): la Biblioteca muestra cada libro como una tapa de texto (título, autor, lomo), sin imágenes. "
             "La última tapa invita a sugerir un libro."),
}
