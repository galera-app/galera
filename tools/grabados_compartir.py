"""Máscaras de grabados para las imágenes de Compartir (img/grabados/) y créditos en /legal/, a partir de datos/grabados.json.

Uso (necesita Pillow):
    python tools/grabados_compartir.py <carpeta_originales>     # arma las máscaras y los créditos
    python tools/grabados_compartir.py --controlar              # solo revisa que todo esté (sin originales)

Los originales no se guardan en el repo: se bajan de Wikimedia Commons con el título de cada grabado (`commons`), a una
carpeta aparte, con el nombre `<id>.<ext>`. Los que traen `ancho_fuente` se bajan achicados a ese ancho (el original es enorme).

Qué hace con cada grabado: por cada recorte (proporciones 0-1 sobre el original), pasa a gris, sube el contraste, invierte y
descuenta el tono del papel (`piso`), de modo que lo oscuro queda opaco y lo claro, transparente; un filtro de mediana
limpia el grano del papel. Las miniaturas a color (nivel «ilustrada») pasan por lo mismo y quedan en una sola tinta. La
salida es un WebP negro con alfa, de 600 px de ancho como máximo (1080 los recortes `semana-*`, que van a todo el ancho;
Fidel, 15/11) y menos de 150 KB: compartir.js lo tiñe en canvas con `source-in`. Nombre: `<id>.webp` para el recorte `base`
y `<id>-<recorte>.webp` para los demás.

datos/grabados.json es la única fuente de archivo, obra, licencia, nivel y recortes. Solo dominio público o CC0, nada
generado con IA. Los créditos de /legal/ se reescriben entre <!--grabados--> y <!--/grabados-->."""
import argparse, html, json, sys, urllib.parse
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
DATOS = RAIZ / "datos" / "grabados.json"
SALIDA = RAIZ / "img" / "grabados"
LEGAL = RAIZ / "legal" / "index.html"
ANCHO, ANCHO_BANDA, MAX_BYTES, PISO = 600, 1080, 150_000, 30
LICENCIAS = {"Dominio público", "CC0"}
NIVELES = {"tirada", "ilustrada"}
A, B = "<!--grabados-->", "<!--/grabados-->"


def cargar():
    return json.loads(DATOS.read_text(encoding="utf-8"))["grabados"]


def nombre(g, rec):
    return f"{g['id']}.webp" if rec == "base" else f"{g['id']}-{rec}.webp"


def mascara(im, caja, piso, ancho=ANCHO):
    from PIL import Image, ImageFilter, ImageOps
    W, H = im.size
    im = im.convert("L").crop((round(caja[0] * W), round(caja[1] * H), round(caja[2] * W), round(caja[3] * H)))
    if im.width > ancho:
        im = im.resize((ancho, round(im.height * ancho / im.width)), Image.LANCZOS)
    im = ImageOps.autocontrast(im, cutoff=2)
    alfa = ImageOps.invert(im).point(lambda p: max(0, min(255, int((p - piso) * 1.3))))
    alfa = alfa.filter(ImageFilter.MedianFilter(3)).point(lambda p: 0 if p < 40 else p)
    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    out.putalpha(alfa)
    return out


def guardar(img, ruta):
    for q in (70, 60, 50, 40):
        img.save(ruta, "WEBP", quality=q, alpha_quality=q, method=6)
        if ruta.stat().st_size < MAX_BYTES:
            return q
    raise SystemExit(f"{ruta.name}: pesa {ruta.stat().st_size} bytes aun en calidad 40")


def creditos(gs):
    filas = "".join(
        f'<li><span>{html.escape(g["obra"])}</span><span><a href="https://commons.wikimedia.org/wiki/'
        f'{urllib.parse.quote(g["commons"].replace(" ", "_"))}" target="_blank" rel="noopener">{g["licencia"]}</a></span></li>'
        for g in gs)
    return f'{A}\n<h3 id="imagenes">Imágenes</h3>\n<ul class="gl-renglones">{filas}</ul>\n{B}'


def escribir_legal(gs):
    t = LEGAL.read_text(encoding="utf-8")
    bloque = creditos(gs)
    if A in t:
        t = t[:t.index(A)] + bloque + t[t.index(B) + len(B):]
    else:  # primera vez: antes de Contacto
        t = t.replace('<h3 id="contacto">', bloque + '\n<h3 id="contacto">', 1)
    LEGAL.write_text(t, encoding="utf-8", newline="\n")


def controlar(gs):
    errores, ids = [], set()
    for g in gs:
        if g["id"] in ids:
            errores.append(f"id repetido: {g['id']}")
        ids.add(g["id"])
        if g["licencia"] not in LICENCIAS:
            errores.append(f"{g['id']}: licencia «{g['licencia']}» no admitida (solo dominio público o CC0)")
        if g["nivel"] not in NIVELES:
            errores.append(f"{g['id']}: nivel «{g['nivel']}» desconocido")
        if "base" not in g["recortes"]:
            errores.append(f"{g['id']}: falta el recorte base")
        for rec, caja in g["recortes"].items():
            if not (len(caja) == 4 and 0 <= caja[0] < caja[2] <= 1 and 0 <= caja[1] < caja[3] <= 1):
                errores.append(f"{g['id']}/{rec}: recorte inválido {caja}")
            r = SALIDA / nombre(g, rec)
            if not r.exists():
                errores.append(f"falta {r.relative_to(RAIZ).as_posix()}")
            elif r.stat().st_size >= MAX_BYTES:
                errores.append(f"{r.relative_to(RAIZ).as_posix()} pesa {r.stat().st_size} bytes (máximo {MAX_BYTES})")
    esperados = {nombre(g, rec) for g in gs for rec in g["recortes"]}
    errores += [f"sobra img/grabados/{p.name}" for p in SALIDA.glob("*.webp") if p.name not in esperados]
    if creditos(gs) not in LEGAL.read_text(encoding="utf-8"):
        errores.append("los créditos de /legal/ no coinciden con datos/grabados.json (correr el script)")
    return errores


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("originales", nargs="?", help="carpeta con <id>.<ext> bajados de Commons")
    ap.add_argument("--controlar", action="store_true", help="solo revisar, sin originales")
    a = ap.parse_args()
    gs = cargar()
    if not a.controlar:
        if not a.originales:
            ap.error("falta la carpeta de originales (o --controlar)")
        from PIL import Image
        src = Path(a.originales)
        SALIDA.mkdir(parents=True, exist_ok=True)
        for g in gs:
            orig = next((p for p in src.glob(f"{g['id']}.*")), None)
            if orig is None:
                raise SystemExit(f"falta el original de {g['id']} en {src}")
            im = Image.open(orig)
            for rec, caja in g["recortes"].items():
                img = mascara(im, caja, g.get("piso", PISO), ANCHO_BANDA if rec.startswith("semana") else ANCHO)
                ruta = SALIDA / nombre(g, rec)
                q = guardar(img, ruta)
                print(f"{ruta.name:28} {img.width}x{img.height} {ruta.stat().st_size // 1000} KB (q{q})")
        escribir_legal(gs)
    errores = controlar(gs)
    for e in errores:
        print("ERROR", e)
    print(f"{len(gs)} grabados, {sum(len(g['recortes']) for g in gs)} máscaras: {'mal' if errores else 'bien'}")
    sys.exit(1 if errores else 0)


if __name__ == "__main__":
    main()
