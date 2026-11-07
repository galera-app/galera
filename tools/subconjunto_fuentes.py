"""Subconjuntos WOFF2 de las fuentes propias de Galera (fonts/), a partir de los originales en tools/fuentes-originales/.

Uso (necesita fonttools y brotli; el resto es stdlib):
    python tools/armar.py --salida dist            # el conjunto de caracteres se calcula sobre el sitio armado
    python tools/subconjunto_fuentes.py [--dist dist] [--ver]

Qué conserva: todos los caracteres que aparecen en el texto de dist/ (html, js, json, css, xml, sin pagefind/), más latín
básico, latín-1 y extendido A, puntuación general (comillas, rayas, puntos suspensivos), ℹ, flechas y símbolos de moneda y
matemáticos comunes. Instrument Sans: se fija el eje wdth (el sitio no usa font-stretch) y wght queda 400-700. Conserva y las features OpenType (kern, liga, tnum, pnum, case, frac, numr, dnom,
ordn, ccmp, locl, rvrn, calt, ss01-ss12). Gótica: solo letras, dígitos y puntuación de capitulares (::first-letter) y del nombre «galera».

Licencias: Instrument Sans y Literata son SIL OFL 1.1 sin Reserved Font Name (el copyright dice «Project Authors»); un subconjunto
es una versión modificada y se puede redistribuir con otro formato. UnifrakturMaguntia es OFL con Reserved Font Name
«UnifrakturMaguntia»: la versión modificada no puede llevar ese nombre, así que el script renombra la familia interna a «Galera Gotica»
(el nombre CSS del @font-face es un alias propio y no cambia). Los avisos de copyright y licencia del name table se conservan.

Cuando se agregan textos con caracteres nuevos: armar dist, volver a correr este script y commitear fonts/. Si un carácter nuevo
no está en el original (por ejemplo un símbolo raro), el navegador usa la fuente de sistema para ese carácter: se ve al correr
`--ver`, que lista los caracteres del sitio que ninguna fuente propia cubre."""
import argparse, re, sys
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont

RAIZ = Path(__file__).resolve().parent.parent
ORIG = RAIZ / "tools" / "fuentes-originales"
SALIDA = RAIZ / "fonts"
EXT = {".html", ".js", ".json", ".css", ".xml", ".txt", ".webmanifest", ".svg"}
BASE = (set(range(0x20, 0x7F)) | set(range(0xA0, 0x180)) | set(range(0x2010, 0x2028)) | set(range(0x2030, 0x2040)) | {0x2039, 0x203A, 0x2044, 0x20AC}
        | {0x2139, 0x2190, 0x2191, 0x2192, 0x2193, 0x2194, 0x2197, 0x2198, 0x21A9, 0x2212, 0x00D7, 0x00F7, 0x2248, 0x2260, 0x2264, 0x2265, 0x2022, 0x00B7})
FEATURES = ["kern", "liga", "clig", "calt", "tnum", "pnum", "lnum", "onum", "case", "frac", "numr", "dnom", "ordn", "ccmp", "locl", "rvrn", "mark", "mkmk", "rlig"] + [f"ss{i:02d}" for i in range(1, 13)]
GOTICA = set(range(0x20, 0x7F)) | set(range(0xC0, 0x100)) | {0xA1, 0xBF, 0xAB, 0xBB, 0x201C, 0x201D, 0x2018, 0x2019}
FUENTES = [("instrument-sans.woff2", None), ("literata.woff2", None), ("literata-italic.woff2", None), ("unifraktur.woff2", "gotica")]


def caracteres_sitio(dist):
    cs = set()
    for p in dist.rglob("*"):
        if p.is_file() and p.suffix.lower() in EXT and "pagefind" not in p.parts:
            t = p.read_text(encoding="utf-8", errors="ignore")
            t = re.sub("[\\\\]u([0-9a-fA-F]{4})", lambda m: chr(int(m.group(1), 16)), t)  # escapes de JSON
            cs.update(ord(c) for c in t)
    return {c for c in cs if c >= 0x20 and c not in range(0x80, 0xA0)}


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--dist", default=str(RAIZ / "dist"))
    ap.add_argument("--ver", action="store_true", help="solo informa los caracteres no cubiertos")
    a = ap.parse_args()
    sitio = caracteres_sitio(Path(a.dist))
    cubiertos = set()
    for nombre, modo in FUENTES:
        orig = TTFont(ORIG / nombre)
        cmap = set(orig.getBestCmap())
        if nombre != "unifraktur.woff2":
            cubiertos |= cmap
        quiero = (GOTICA if modo == "gotica" else (sitio | BASE)) & cmap
        if a.ver:
            continue
        op = subset.Options()
        op.flavor = "woff2"; op.layout_features = FEATURES; op.name_IDs = ["*"]; op.name_languages = ["*"]
        op.notdef_outline = True; op.glyph_names = False; op.hinting = False; op.layout_closure = True
        f = TTFont(ORIG / nombre)
        if nombre == "instrument-sans.woff2":  # el sitio no usa font-stretch: se fija wdth=100 y wght queda 400-700
            from fontTools.varLib import instancer
            f = instancer.instantiateVariableFont(f, {"wdth": 100, "wght": (400, 700)}, inplace=False)
            import io; b = io.BytesIO(); f.flavor = None; f.save(b); b.seek(0); f = TTFont(b)
        s = subset.Subsetter(op); s.populate(unicodes=quiero); s.subset(f)
        if modo == "gotica":
            for r in f["name"].names:
                if r.nameID in (1, 3, 4, 6, 16, 17):
                    r.string = r.toUnicode().replace("UnifrakturMaguntia", "Galera Gotica")
        f.flavor = "woff2"; f.save(SALIDA / nombre)
        print(f"{nombre}: {(ORIG/nombre).stat().st_size} -> {(SALIDA/nombre).stat().st_size} bytes, {len(quiero)} caracteres")
    faltan = sorted(c for c in sitio if c not in cubiertos and not (0x2000 <= c <= 0x200F) and c not in (0x20E3, 0xFE0F, 0x200D))
    print(f"Caracteres del sitio sin fuente propia ({len(faltan)}):", " ".join(f"{chr(c)}(U+{c:04X})" for c in faltan[:200]))


main()
