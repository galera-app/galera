"""Control de capitulares ambiguas: avisa de cada título con capitular gótica cuya primera letra se confunde en UnifrakturMaguntia y no lleva `sin-cap`.

Recorre el sitio armado (python tools/armar.py --salida dist) y mira los h1-h3 que el CSS pinta con capitular:
  .gl-display y .gl-t1 (salvo `sin-cap` o `gl-sin-inicial`), .gl-t3.gl-inicial, h2.cap y h1 dentro de .lectura-main (galera.css).
Si la primera letra está en AMBIGUAS y no hay excepción aceptada, sale con 1. Arreglo habitual: sumar la clase `sin-cap` al título (en el código de la
vista o de la página); si se acepta tal cual, anotarlo en tools/capitulares-excepciones.json ({"ruta": ["Título", ...]}).

Uso: python tools/controlar_capitulares.py [dist]

Por qué estas letras (UnifrakturMaguntia, fonts/unifraktur.woff2; rasterizadas con Pillow, 48 px, y comparadas por silueta, IoU):
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
TITULO = re.compile(r"<(h[1-3])\b([^>]*)>(.*?)</\1>", re.S)


def con_capitular(etiqueta, clases, en_lectura):
    c = set(clases.split())
    if "sin-cap" in c or "gl-sin-inicial" in c:
        return False
    return bool({"gl-display", "gl-t1"} & c) or ("gl-t3" in c and "gl-inicial" in c) or (etiqueta == "h2" and "cap" in c) or (etiqueta == "h1" and en_lectura)


def primera_letra(texto):
    """La que pinta ::first-letter: la primera letra, tras puntuación inicial. Sin acento (la gótica acentuada hereda la forma base)."""
    t = html.unescape(re.sub(r"<[^>]+>", "", texto)).strip()
    for ch in t:
        if ch.isalpha():
            return unicodedata.normalize("NFD", ch)[0], t
        if not unicodedata.category(ch).startswith("P") and ch != " ":
            return None, t  # emoji u otro símbolo: la capitular no se pinta como letra
    return None, t


def revisar(raiz):
    exc = json.loads(EXCEPCIONES.read_text(encoding="utf-8")) if EXCEPCIONES.is_file() else {}
    casos, vistos = [], 0
    for p in sorted(raiz.rglob("*.html")):
        rel = "/" + p.relative_to(raiz).as_posix().removesuffix("index.html")
        t = p.read_text(encoding="utf-8")
        for m in TITULO.finditer(t):
            k = re.search(r'class="([^"]*)"', m.group(2))
            if not con_capitular(m.group(1), k.group(1) if k else "", "lectura-main" in t[:m.start()]):
                continue
            letra, titulo = primera_letra(m.group(3))
            vistos += 1
            if letra and letra.upper() in AMBIGUAS and titulo not in exc.get(rel, []):
                casos.append((rel, m.group(1), letra.upper(), titulo))
    return vistos, casos


def main():
    raiz = Path(sys.argv[1] if len(sys.argv) > 1 else RAIZ / "dist").resolve()
    if not raiz.is_dir():
        print(f"no existe {raiz}: armá el sitio con python tools/armar.py --salida dist")
        return 1
    vistos, casos = revisar(raiz)
    for rel, et, letra, titulo in casos:
        print(f"capitular ambigua ({letra}): {rel} <{et}> «{titulo}»: agregá la clase sin-cap o anotá la excepción en tools/capitulares-excepciones.json")
    print(f"{vistos} títulos con capitular revisados, {len(casos)} ambiguos sin sin-cap")
    return 1 if casos else 0


if __name__ == "__main__":
    sys.exit(main())
