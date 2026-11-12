"""Control de capitulares: hace cumplir la regla de la inicial gótica y avisa de las letras ambiguas.

Regla (bloque 9 del plan de UX/UI, 12/11/2026): una sola inicial gótica por pantalla, en el h1; ninguna en títulos de tarjeta, subtítulos ni párrafos.
Recorre el sitio armado (python tools/armar.py --salida dist) y falla (sale con 1) si:
  1. El CSS pinta una inicial gótica (::first-letter con la fuente gótica) en un selector que no es de h1. Permitidos: .gl-display, .gl-t1 y
     `.lectura-main h1:not(.sin-cap)` (los dos primeros solo valen sobre un h1: ver 2). Una capitular nueva en una tarjeta, un h2 o un párrafo rompe acá.
  2. Una página trae una capitular (clase gl-display o gl-t1 sin `sin-cap`, o h1 dentro de .lectura-main) en un elemento que no es h1.
  3. Una página trae más de una capitular.
  4. Un JS arma un elemento con gl-display o gl-t1 que no es h1 ni h2 (el primer h2 de cada vista pasa a h1 en app.js: conTitulo).
  5. La primera letra de un h1 con capitular está en AMBIGUAS y no hay excepción aceptada. Arreglo habitual: sumar `sin-cap` al título
     (en el código de la vista o de la página); si se acepta tal cual, anotarlo en tools/capitulares-excepciones.json ({"ruta": ["Título", ...]}).
No cubre cuántos h2 con la clase caben en una misma vista armada por JS (solo uno se promueve a h1); eso se mira en el navegador.

Uso: python tools/controlar_capitulares.py [dist]

Por qué las letras ambiguas (UnifrakturMaguntia, fonts/unifraktur.woff2; rasterizadas con Pillow, 48 px, y comparadas por silueta, IoU):
  C/E 0,89; B/V 0,73; O/Q 0,67; N/R 0,58; I/J 0,57; I/Z 0,55 -> pares casi iguales: C E B V O Q N R I J Z.
  A y U (la A gótica se lee U), G y S (la S se lee G: «Simuladores» se leía «Gimuladores»), M y X (trazos de «VV», «W»): confusión de lectura
  que la silueta no mide bien. Quedan fuera de la lista las que se leen sin duda: D F H K L P T W Y (y las acentuadas, que heredan la base)."""
import html
import json
import re
import sys
import unicodedata
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
AMBIGUAS = set("SGIJ")
EXCEPCIONES = RAIZ / "tools" / "capitulares-excepciones.json"
TITULO = re.compile(r"<(h[1-6])\b([^>]*)>(.*?)</\1>", re.S)
ETIQUETA_CLASE = re.compile(r"<([a-z0-9]+)\b[^>]*\bclass=\"([^\"]*)\"", re.I)
PERMITIDOS_CSS = {".gl-display", ".gl-t1", ".lectura-main h1:not(.sin-cap)"}
REGLA_CSS = re.compile(r"([^{}]+)\{([^{}]*)\}")
GOTICA = re.compile(r"font-family:\s*(var\(--(gotica|gl-got)\)|[^;}]*unifraktur)", re.I)
HEADINGS = ("h1", "h2", "h3", "h4", "h5", "h6")


def con_capitular(etiqueta, clases, en_lectura):
    """True si el CSS pinta capitular en este elemento (.gl-display, .gl-t1, o h1 de .lectura-main; sin `sin-cap`)."""
    c = set(clases.split())
    if "sin-cap" in c:
        return False
    return bool({"gl-display", "gl-t1"} & c) or (etiqueta == "h1" and en_lectura)


def primera_letra(texto):
    """La que pinta ::first-letter: la primera letra, tras puntuación inicial. Sin acento (la gótica acentuada hereda la forma base)."""
    t = html.unescape(re.sub(r"<[^>]+>", "", texto)).strip()
    for ch in t:
        if ch.isalpha():
            return unicodedata.normalize("NFD", ch)[0], t
        if not unicodedata.category(ch).startswith("P") and ch != " ":
            return None, t  # emoji u otro símbolo: la capitular no se pinta como letra
    return None, t


def revisar_css(raiz):
    """Selectores con inicial gótica que no son de h1."""
    malos = []
    for css in sorted(raiz.rglob("*.css")):
        t = re.sub(r"/\*.*?\*/", "", css.read_text(encoding="utf-8"), flags=re.S)
        for m in REGLA_CSS.finditer(t):
            if not GOTICA.search(m.group(2)):
                continue
            for sel in m.group(1).split(","):
                sel = sel.strip()
                if sel.endswith("::first-letter") and sel.removesuffix("::first-letter").strip() not in PERMITIDOS_CSS:
                    malos.append((css.relative_to(raiz).as_posix(), sel))
    return malos


def revisar_js(raiz):
    """Elementos armados por JS con gl-display / gl-t1 que no son h1 ni h2."""
    malos = []
    for js in sorted(raiz.glob("*.js")):
        for m in ETIQUETA_CLASE.finditer(js.read_text(encoding="utf-8")):
            c = set(m.group(2).split())
            if {"gl-display", "gl-t1"} & c and "sin-cap" not in c and m.group(1).lower() not in ("h1", "h2"):
                malos.append((js.name, m.group(1), m.group(2)))
    return malos


def revisar(raiz):
    exc = json.loads(EXCEPCIONES.read_text(encoding="utf-8")) if EXCEPCIONES.is_file() else {}
    ambiguas, fuera_de_h1, repetidas, vistos, paginas = [], [], [], 0, 0
    for p in sorted(raiz.rglob("*.html")):
        paginas += 1
        rel = "/" + p.relative_to(raiz).as_posix().removesuffix("index.html")
        t = p.read_text(encoding="utf-8")
        n = 0
        for m in TITULO.finditer(t):
            k = re.search(r'class="([^"]*)"', m.group(2))
            if not con_capitular(m.group(1), k.group(1) if k else "", "lectura-main" in t[:m.start()]):
                continue
            n += 1
            letra, titulo = primera_letra(m.group(3))
            if m.group(1) != "h1":
                fuera_de_h1.append((rel, m.group(1), titulo))
            elif letra and letra.upper() in AMBIGUAS and titulo not in exc.get(rel, []):
                ambiguas.append((rel, "h1", letra.upper(), titulo))
        for m in ETIQUETA_CLASE.finditer(t):  # un p, div o span con la clase de capitular
            c = set(m.group(2).split())
            if m.group(1).lower() not in HEADINGS and {"gl-display", "gl-t1"} & c and "sin-cap" not in c:
                n += 1
                fuera_de_h1.append((rel, m.group(1).lower(), m.group(2)))
        vistos += n
        if n > 1:
            repetidas.append((rel, n))
    return vistos, paginas, ambiguas, fuera_de_h1, repetidas


def main():
    raiz = Path(sys.argv[1] if len(sys.argv) > 1 else RAIZ / "dist").resolve()
    if not raiz.is_dir():
        print(f"no existe {raiz}: armá el sitio con python tools/armar.py --salida dist")
        return 1
    vistos, paginas, ambiguas, fuera, repetidas = revisar(raiz)
    css, js = revisar_css(raiz), revisar_js(raiz)
    for arch, sel in css:
        print(f"capitular fuera de un h1 en el CSS: {arch}: {sel}: la inicial gótica es solo del h1 de la pantalla")
    for rel, et, titulo in fuera:
        print(f"capitular fuera de un h1: {rel} <{et}> «{titulo}»: quitá gl-display/gl-t1 o sumá sin-cap")
    for arch, et, clases in js:
        print(f"capitular fuera de un h1: {arch} <{et} class=\"{clases}\">: gl-display y gl-t1 son solo de títulos de pantalla (h1/h2)")
    for rel, n in repetidas:
        print(f"{n} capitulares en una página: {rel}: una sola por pantalla, en el h1")
    for rel, et, letra, titulo in ambiguas:
        print(f"capitular ambigua ({letra}): {rel} <{et}> «{titulo}»: agregá la clase sin-cap o anotá la excepción en tools/capitulares-excepciones.json")
    fallas = len(css) + len(fuera) + len(js) + len(repetidas) + len(ambiguas)
    print(f"{vistos} capitulares en {paginas} páginas: {len(css)} en CSS fuera de h1, {len(fuera)} en HTML fuera de h1, {len(js)} en JS fuera de h1/h2, "
          f"{len(repetidas)} páginas con más de una, {len(ambiguas)} ambiguas sin sin-cap")
    return 1 if fallas else 0


if __name__ == "__main__":
    sys.exit(main())
