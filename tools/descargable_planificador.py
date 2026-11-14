"""Rearma los estilos del planificador descargable (libro/planificador-de-libros.html) con los de Galera.

El descargable anda sin internet y desde el disco (file://), así que lleva todo adentro: los mismos CSS que
carga el sitio (tokens, estilos, galera, componentes y planificador.css) y las fuentes como data: URI.
Solo toca el primer <style> y la cabecera; el código y los datos (los <script>) quedan como están.

Uso:  python tools/descargable_planificador.py        (desde la raíz del repo)
"""
import base64
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
DESCARGABLE = RAIZ / "libro" / "planificador-de-libros.html"
CSS = ["tokens.css", "estilos.css", "galera.css", "componentes.css", "libro/planificador.css"]
FUENTES = [  # (familia, archivo, peso, estilo): las de galera.css
    ("Instrument Sans", "instrument-sans.woff2", "400 700", "normal"),
    ("Literata", "literata.woff2", "400 500", "normal"),
    ("Literata", "literata-italic.woff2", "400", "italic"),
    ("UnifrakturMaguntia", "unifraktur.woff2", "400", "normal"),
]
CABECERA_VIEJA = re.compile(r'<span class="logo" aria-hidden="true"></span>\s*<div><h1 class="nombre">Planificador de libros</h1><p>[^<]*</p></div>')
CABECERA = ('<div><p class="nombre"><a href="https://galera.com.ar/" aria-label="Galera, ir al sitio">galera</a></p>'
            '<p>Planificador de libros · archivo descargable, funciona sin internet</p></div>')
MAIN = '<main id="main" class="lectura-main lb-main">'
H1 = '<h1 class="sin-cap">Planificador de libros</h1>'
CR, LF = chr(13), chr(10)


def fuentes():
    reglas = []
    for familia, archivo, peso, estilo in FUENTES:
        b64 = base64.b64encode((RAIZ / "fonts" / archivo).read_bytes()).decode("ascii")
        reglas.append(f'@font-face{{font-family:"{familia}";src:url(data:font/woff2;base64,{b64}) format("woff2");'
                      f'font-weight:{peso};font-style:{estilo};font-display:swap}}')
    return LF.join(reglas)


def estilos():
    partes = ["/* Planificador de libros, archivo descargable: estilos de Galera (los arma tools/descargable_planificador.py). */", fuentes()]
    for nombre in CSS:
        t = (RAIZ / nombre).read_text(encoding="utf-8")
        t = re.sub(r"@import url\([^)]*\);?\s*", "", t)          # no anda desde el disco
        t = re.sub(r"@font-face\s*\{[^}]*\}\s*", "", t)          # van una sola vez, arriba, como data: URI
        partes.append(f"/* {nombre} */{LF}{t.strip()}")
    return LF.join(partes)


def main():
    crudo = DESCARGABLE.read_bytes().decode("utf-8")
    fin = CR + LF if CR + LF in crudo else LF                   # conserva los fines de línea del archivo
    html = crudo.replace(CR + LF, LF)
    i, j = html.index("<style>"), html.index("</style>")
    html = html[:i] + "<style>" + estilos().replace("</style", "<\\/style") + LF + html[j:]
    html, n = CABECERA_VIEJA.subn(CABECERA, html, count=1)
    if n == 0 and CABECERA not in html:
        sys.exit("No encontré la cabecera del descargable: revisá CABECERA_VIEJA.")
    if H1 not in html:
        html = html.replace(MAIN, MAIN + LF + H1, 1)
    DESCARGABLE.write_bytes(html.replace(LF, fin).encode("utf-8"))
    print(f"{DESCARGABLE.relative_to(RAIZ)}: {len(html.encode('utf-8')) // 1024} KB")


if __name__ == "__main__":
    main()
