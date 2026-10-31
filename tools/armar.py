"""Arma el marco común de Galera desde marco/: cabecera, pie, recursos del <head>, CSP y versiones ?v=.
Fuente única: marco/sitio.json, marco/pie.tpl, marco/cabecera.tpl. También escribe marco.js, que lee la app.
Uso: python tools/armar.py             aplica el marco (idempotente)
     python tools/armar.py --comprobar  no escribe; sale con 1 si algo se apartó del marco (lo corre el CI)
Salta prueba/. libro/planificador-de-libros.html es un archivo descargable: lleva el pie, pero conserva su cabecera y su <head>."""
import hashlib
import json
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
M = RAIZ / "marco"
S = json.loads((M / "sitio.json").read_text(encoding="utf-8"))
COMPROBAR = "--comprobar" in sys.argv
CHEV = '<svg class="cv" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>'
CSP_PAGINA = {"index.html": "app", "libro/cronograma/index.html": "estatica_estilos"}
DESCARGABLE = "libro/planificador-de-libros.html"
CSS = ["tokens.css", "estilos.css", "galera.css", "componentes.css"]
GRUPOS = S["menu"]["estudiante"]
ACTUAL = ' aria-current="page"'
distintos = []
memoria = {}  # en modo comprobar, el contenido que tendría cada archivo: las huellas se calculan sobre eso


def leer(p):
    return memoria.get(p) or p.read_text(encoding="utf-8")


def escribir(p, t):
    """Escribe solo si cambió; en modo comprobar anota la diferencia."""
    if p.exists() and p.read_text(encoding="utf-8") == t:
        return
    distintos.append(p.relative_to(RAIZ).as_posix())
    memoria[p] = t
    if not COMPROBAR:
        p.write_text(t, encoding="utf-8", newline="\n")


def plantilla(nombre, **datos):
    t = (M / nombre).read_text(encoding="utf-8").strip()
    for k, v in datos.items():
        t = t.replace("{{" + k + "}}", v)
    return t


def enlace(i):
    return S["pantallas"][i]


def nav_pie():
    filas = []
    for n, ids in GRUPOS:
        its = [enlace(i) for i in ids if not enlace(i).get("solo_menu")]
        if n == "Galera":
            its.append(S["pie"]["escribir"])
        filas.append(f'<nav aria-label="{n}"><h2>{n}</h2>' + "".join(f'<a href="{x["url"]}">{x["t"]}</a>' for x in its) + "</nav>")
    return "\n".join(filas)


def pie(app=False):
    P = S["pie"]
    extra = "".join(f'<a href="{P[k]["url"]}">{P[k]["t"]}</a>' for k in ("ingresantes", "legal"))
    cookies = '<button class="enlace" type="button" id="cookies">Cambiar cookies</button>'
    comun = dict(bajada=P["bajada"], aviso=P["aviso"], nav=nav_pie())
    if app:
        return plantilla("pie.tpl", id_nav=' id="pie-nav"', **comun,
                         avisame='<div class="avisame" data-nov hidden><div class="crece"><b>¿Querés que te avise cuando agregue algo?</b>\n'
                                 '<p>Los lunes a las 8:00, solo las novedades que te importan. Gratis.</p></div>\n'
                                 '<button class="btn" type="button" onclick="avisame()">Avisame por mail</button></div>\n',
                         acciones='<span id="donar"></span><button class="btn sec" type="button" onclick="compartirCursada(\'pie\')">Pasásela a alguien</button>',
                         enlaces=cookies + '<button class="enlace" type="button" onclick="abrirDatos()">Tus datos</button>'
                                 '<button class="enlace" type="button" onclick="idea()">Contame qué falta</button>' + extra)
    return plantilla("pie.tpl", id_nav="", avisame="", **comun,
                     acciones='<a class="cafe" href="/sostener/">Invitar un cafecito</a>',
                     enlaces=cookies + '<a href="/#config">Tus datos</a><a href="mailto:hola@galera.com.ar">Contame qué falta</a>' + extra)


def cabecera(rel):
    ruta = "/" + rel.replace("index.html", "")
    act = None
    for i, (_, ids) in enumerate(GRUPOS):
        for id_ in ids:
            u = enlace(id_)["url"]
            if not u.startswith("/#") and ruta.startswith(u):
                act = i
    if act is None and ruta.startswith("/libro/"):
        act = 1
    tabs = "".join(
        f'<button type="button" class="tab" data-g="{i}" aria-expanded="{str(i == act).lower()}"{ACTUAL if i == act else ""}>{n}{CHEV}</button>'
        for i, (n, _) in enumerate(GRUPOS))
    filas = "".join(
        f'<nav class="sub" aria-label="{n}"{"" if i == act else " hidden"}>' + "".join(
            f'<a href="{enlace(x)["url"]}"{ACTUAL if ruta == enlace(x)["url"] else ""}>{enlace(x)["t"]}</a>' for x in ids) + "</nav>"
        for i, (n, ids) in enumerate(GRUPOS))
    return plantilla("cabecera.tpl",
                     pestanas=f'<nav class="pestanas" aria-label="Secciones">{tabs}</nav>',
                     filas=f'<div class="subw"{"" if act is not None else " hidden"}>{filas}</div>')


META_COMUN = ('<meta name="referrer" content="strict-origin-when-cross-origin">\n'
              '<meta name="author" content="Fidel Chaves">\n'
              '<meta name="color-scheme" content="light dark">')
RECURSOS = ('<link rel="icon" type="image/png" href="/img/favicon-32.png">\n'
            '<link rel="apple-touch-icon" href="/img/icono-180.png">\n'
            + "\n".join(f'<link rel="stylesheet" href="/{c}">' for c in CSS)
            + '\n<script src="/menu.js" defer></script>\n<script src="/analitica.js"></script>')
QUITAR_META = re.compile(r'<meta (?:http-equiv="Content-Security-Policy"|name="referrer"|name="author"|name="color-scheme")[^>]*>\n')
QUITAR_REC = re.compile(r'<link rel="(?:icon|apple-touch-icon)"[^>]*>\n|'
                        r'<link rel="stylesheet" href="/(?:' + "|".join(re.escape(c) for c in CSS) + r')[^"]*">\n|'
                        r'<script src="/menu\.js[^"]*" defer></script>\n|<script src="/analitica\.js[^"]*"></script>\n')


def cabeza_estatica(t, csp):
    meta = f'<meta http-equiv="Content-Security-Policy" content="{csp}">\n{META_COMUN}\n'
    fin = t.index("</head>")
    h, resto = t[:fin], t[fin:]
    h = QUITAR_META.sub("", h)
    h = re.sub(r'(<meta name="viewport"[^>]*>\n)', lambda m: m.group(1) + meta, h, count=1)
    m = QUITAR_REC.search(h)
    pos = m.start() if m else len(h)
    h = h[:pos] + "\0" + h[pos:]
    h = QUITAR_REC.sub("", h).replace("\0", RECURSOS + "\n")
    return h + resto


def huella(p):
    """Número derivado del contenido. read_text unifica los saltos de línea: da igual en Windows y en el CI."""
    return str(int(hashlib.sha256(leer(p).encode()).hexdigest(), 16) % 10**8)


def versionar(t, base):
    def rep(m):
        ruta = m.group(2)
        p = RAIZ / ruta.lstrip("/") if ruta.startswith("/") else base / ruta
        return f'{m.group(1)}{ruta}?v={huella(p)}"' if p.is_file() else m.group(0)
    return re.sub(r'((?:src|href)=")([^":?#]+\.(?:css|js))(?:\?v=\w+)?"', rep, t)


def paginas():
    for p in sorted(RAIZ.rglob("*.html")):
        rel = p.relative_to(RAIZ).as_posix()
        if not rel.startswith(("prueba/", ".")):
            yield p, rel


def main():
    # Primero lo que entra en las huellas: marco.js y la carga diferida de app.js.
    publico = {k: S[k] for k in ("pantallas", "tabs", "tabs_ocultas", "menu", "barra_celular", "simuladores")}
    publico["escribir"] = S["pie"]["escribir"]
    escribir(RAIZ / "marco.js", "// Lo escribe tools/armar.py desde marco/sitio.json: no editar a mano.\nconst MARCO = "
             + json.dumps(publico, ensure_ascii=False, separators=(",", ":")) + ";\n")
    app = (RAIZ / "app.js").read_text(encoding="utf-8")
    escribir(RAIZ / "app.js", re.sub(r"mapa-ar\.js\?v=\w+", "mapa-ar.js?v=" + huella(RAIZ / "mapa-ar.js"), app))

    for p, rel in paginas():
        t = p.read_text(encoding="utf-8")
        if rel == "index.html":
            t = re.sub(r'(Content-Security-Policy" content=")[^"]*', lambda m: m.group(1) + S["csp"]["app"], t)
            t = re.sub(r'<footer class="pie">.*?</footer>', lambda m: pie(app=True), t, flags=re.S)
        else:
            if rel != DESCARGABLE:
                t = cabeza_estatica(t, S["csp"][CSP_PAGINA.get(rel, "estatica")])
                t = re.sub(r'<header class="cabecera">.*?</header>', lambda m: cabecera(rel), t, count=1, flags=re.S)
            t = re.sub(r'<footer class="pie">.*?</footer>', lambda m: pie(), t, flags=re.S)
        escribir(p, versionar(t, p.parent))

    if COMPROBAR:
        print("\n".join(f"se apartó del marco: {d}" for d in distintos[:20]) or "marco ok")
        if distintos:
            print(f"{len(distintos)} archivos. Corré: python tools/armar.py")
        return 1 if distintos else 0
    print(f"marco aplicado: {len(distintos)} archivos cambiados")
    return 0


if __name__ == "__main__":
    sys.exit(main())
