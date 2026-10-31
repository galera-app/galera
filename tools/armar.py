"""Arma Galera desde marco/: cabecera, pie, recursos del <head>, CSP y versiones ?v=. Una sola fuente, un solo armado.
Las páginas del repo llevan marcas en vez del marco repetido:
    <!--marco:csp-->  <!--marco:meta-->  <!--marco:recursos-->  <!--marco:cabecera-->  <!--marco:pie-->
El build las expande en la carpeta de salida (dist/); eso es lo que publican Cloudflare y GitHub Pages.
Fuente única: marco/sitio.json, marco/pie.tpl, marco/cabecera.tpl. También escribe marco.js (lo lee la app).

Uso: python tools/armar.py [--salida dist]   arma el sitio publicable (stdlib, sin dependencias)
     python tools/armar.py --servir 8772      lo arma en dist/ y lo sirve en http://127.0.0.1:8772 (para mirar cambios)
     python tools/armar.py --marcar          pasa a marcas las páginas que traen el marco escrito (salida de los generadores)
     python tools/armar.py --comprobar        no escribe; sale con 1 si hay páginas con el marco escrito o si el armado falla (lo corre el CI)
No toca prueba/. libro/planificador-de-libros.html es un archivo descargable: lleva el pie, pero conserva su cabecera y su <head>."""
import hashlib
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
M = RAIZ / "marco"
S = json.loads((M / "sitio.json").read_text(encoding="utf-8"))
CHEV = '<svg class="cv" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>'
# Solo el planificador y su archivo descargable son independientes de la app: todo lo demás lleva la cabecera, el pie y los guiones de la app.
SUELTAS = {"libro/cronograma/index.html", "libro/planificador-de-libros.html", "prueba/index.html", "prueba/componentes/index.html"}
CSP_PAGINA = {"libro/cronograma/index.html": "estatica_estilos"}
DESCARGABLE = "libro/planificador-de-libros.html"
CSS = ["tokens.css", "estilos.css", "galera.css", "componentes.css"]
GRUPOS = S["menu"]["estudiante"]
ACTUAL = ' aria-current="page"'
# Lo que no se publica: control de versiones, CI, herramientas y las fuentes del marco.
NO_PUBLICAR = {".git", ".github", "tools", "marco", "dist", "__pycache__"}
MARCAS = ("csp", "meta", "recursos", "cabecera", "pie", "vista")


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
                     enlaces=cookies + '<a href="/config/">Tus datos</a><a href="mailto:hola@galera.com.ar">Contame qué falta</a>' + extra)


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
RECURSOS_APP = ('<link rel="icon" type="image/png" href="/img/favicon-32.png">\n'
                '<link rel="apple-touch-icon" href="/img/icono-180.png">\n<link rel="manifest" href="/manifest.webmanifest">\n<meta name="theme-color" content="#0560C8">\n'
                '<script>try{var t=localStorage.getItem("cursada.tema");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t}catch(e){}</script>\n'
                + "\n".join(f'<link rel="stylesheet" href="/{c}">' for c in CSS) + '\n<script defer src="/analitica.js"></script>')
RECURSOS = ('<link rel="icon" type="image/png" href="/img/favicon-32.png">\n'
            '<link rel="apple-touch-icon" href="/img/icono-180.png">\n'
            + "\n".join(f'<link rel="stylesheet" href="/{c}">' for c in CSS)
            + '\n<script src="/menu.js" defer></script>\n<script src="/analitica.js"></script>')
QUITAR_CSP = re.compile(r'<meta http-equiv="Content-Security-Policy"[^>]*>')
QUITAR_META = re.compile(r'<meta (?:http-equiv="Content-Security-Policy"|name="referrer"|name="author"|name="color-scheme")[^>]*>\n')
QUITAR_REC = re.compile(r'<link rel="(?:icon|apple-touch-icon)"[^>]*>\n|'
                        r'<link rel="stylesheet" href="/(?:' + "|".join(re.escape(c) for c in CSS) + r')[^"]*">\n|'
                        r'<script src="/menu\.js[^"]*" defer></script>\n|<script src="/analitica\.js[^"]*"></script>\n')
VERSION = re.compile(r'((?:src|href)="[^":?#]+\.(?:css|js))\?v=\w+"')


def expandir(t, rel):
    """Marcas -> marco. Toda página es la app, salvo las sueltas."""
    suelta = rel in SUELTAS
    csp = S["csp"][CSP_PAGINA.get(rel, "estatica" if suelta else "app")]
    reemplazos = {"csp": f'<meta http-equiv="Content-Security-Policy" content="{csp}">', "meta": META_COMUN, "recursos": RECURSOS if suelta else RECURSOS_APP,
                  "cabecera": cabecera(rel) if suelta else plantilla("app-cabecera.tpl"), "pie": pie() if suelta else pie(app=True) + "\n" + plantilla("app-cierre.tpl")}
    for k, v in reemplazos.items():
        t = t.replace(f"<!--marco:{k}-->", v)
    return t


def ruta_de(rel):
    return "/" + rel.removesuffix("index.html")


def prerender(salida):
    """Corre las vistas de app.js sobre el sitio armado y vuelca el HTML en cada página con <!--marco:vista-->. Las demás reciben solo los menús."""
    vistas = {rel: p for p, rel in paginas(salida) if "<!--marco:vista-->" in p.read_text(encoding="utf-8")}
    with tempfile.TemporaryDirectory() as tmp:
        lista, sal = Path(tmp) / "rutas.txt", Path(tmp) / "pre.json"
        lista.write_text("\n".join(ruta_de(r) for r in vistas), encoding="utf-8")
        subprocess.run(["node", str(RAIZ / "tools" / "prerender.js"), str(salida), str(sal), "@" + str(lista)], check=True, timeout=300)
        pre = json.loads(sal.read_text(encoding="utf-8"))
    inicio = pre["/"]

    def menus(t, d):
        t = t.replace('id="pestanas" aria-label="Secciones"></nav>', f'id="pestanas" aria-label="Secciones">{d["pestanas"]}</nav>')
        return t.replace('id="inferior" aria-label="Secciones principales"></nav>', f'id="inferior" aria-label="Secciones principales">{d["inferior"]}</nav>')
    for p, rel in paginas(salida):
        if rel in SUELTAS:
            continue
        t = p.read_text(encoding="utf-8")
        d = pre.get(ruta_de(rel), inicio) if rel in vistas else inicio
        if rel in vistas:
            t = t.replace("<!--marco:vista-->", d["main"]).replace("<body>", f'<body data-tab="{d["tab"]}">', 1)
        escribir(p, menus(t, d))


def marcar(t, rel):
    """Marco escrito -> marcas (idempotente). Es la forma en que se guarda en el repo."""
    if "<!--marco:vista-->" not in t:
        if rel != DESCARGABLE and "<!--marco:recursos-->" not in t:
            fin = t.index("</head>")
            h, resto = t[:fin], t[fin:]
            h = QUITAR_META.sub("", h)
            h = re.sub(r'(<meta name="viewport"[^>]*>\n)', lambda m: m.group(1) + "<!--marco:csp-->\n<!--marco:meta-->\n", h, count=1)
            m = QUITAR_REC.search(h)
            pos = m.start() if m else len(h)
            h = h[:pos] + "\0" + h[pos:]
            h = QUITAR_REC.sub("", h).replace("\0", "<!--marco:recursos-->\n")
            t = h + resto
        if rel != DESCARGABLE:
            t = re.sub(r'<header class="cabecera">.*?</header>', "<!--marco:cabecera-->", t, count=1, flags=re.S)
    t = re.sub(r'<footer class="pie">.*?</footer>', "<!--marco:pie-->", t, flags=re.S)
    return VERSION.sub(r'\1"', t)


def huella(p):
    """Número derivado del contenido. read_text unifica los saltos de línea: da igual en Windows y en el CI."""
    return str(int(hashlib.sha256(p.read_text(encoding="utf-8").encode()).hexdigest(), 16) % 10**8)


def versionar(t, base, raiz):
    def rep(m):
        ruta = m.group(2)
        p = raiz / ruta.lstrip("/") if ruta.startswith("/") else base / ruta
        return f'{m.group(1)}{ruta}?v={huella(p)}"' if p.is_file() else m.group(0)
    return re.sub(r'((?:src|href)=")([^":?#]+\.(?:css|js))(?:\?v=\w+)?"', rep, t)


def paginas(raiz):
    for p in sorted(raiz.rglob("*.html")):
        rel = p.relative_to(raiz).as_posix()
        if not rel.startswith(("prueba/", ".", "dist/")):
            yield p, rel


def escribir(p, t):
    p.write_text(t, encoding="utf-8", newline="\n")


def construir(salida):
    """Copia el repo a `salida` sin lo que no se publica, escribe marco.js y expande las marcas."""
    if salida.exists():
        shutil.rmtree(salida)
    shutil.copytree(RAIZ, salida, ignore=lambda d, nombres: [n for n in nombres if n in NO_PUBLICAR and Path(d) == RAIZ])
    publico = {k: S[k] for k in ("pantallas", "tabs", "tabs_ocultas", "menu", "barra_celular", "simuladores")}
    for v in publico["pantallas"].values():
        v.pop("desc", None)
    publico["escribir"] = S["pie"]["escribir"]
    escribir(salida / "marco.js", "// Lo escribe tools/armar.py desde marco/sitio.json: no editar a mano.\nconst MARCO = "
             + json.dumps(publico, ensure_ascii=False, separators=(",", ":")) + ";\n")
    app = salida / "app.js"
    escribir(app, re.sub(r"s\.src = '/mapa-ar\.js[^']*'", "s.src = '/mapa-ar.js?v=" + huella(salida / "mapa-ar.js") + "'", app.read_text(encoding="utf-8")))
    sobran = []
    for p, rel in paginas(salida):
        escribir(p, versionar(expandir(p.read_text(encoding="utf-8"), rel), p.parent, salida))
    prerender(salida)
    for p, rel in paginas(salida):
        if "<!--marco:" in p.read_text(encoding="utf-8"):
            sobran.append(rel)
    return sobran


def main():
    args = sys.argv[1:]
    if "--marcar" in args or "--comprobar" in args:
        cambian = []
        for p, rel in paginas(RAIZ):
            t = p.read_text(encoding="utf-8")
            nuevo = marcar(t, rel)
            if nuevo != t:
                cambian.append(rel)
                if "--marcar" in args:
                    escribir(p, nuevo)
        if "--marcar" in args:
            print(f"marcadas: {len(cambian)} páginas")
            return 0
        print("\n".join(f"trae el marco escrito: {d}" for d in cambian[:20]))
        if cambian:
            print(f"{len(cambian)} páginas. Corré: python tools/armar.py --marcar")
        with tempfile.TemporaryDirectory() as tmp:
            sobran = construir(Path(tmp) / "sitio")
        print("\n".join(f"marca sin expandir: {d}" for d in sobran))
        if not cambian and not sobran:
            print("marco ok")
        return 1 if cambian or sobran else 0
    salida = Path(args[args.index("--salida") + 1]) if "--salida" in args else RAIZ / "dist"
    sobran = construir(salida.resolve())
    if sobran:
        print("marca sin expandir en:", ", ".join(sobran))
        return 1
    print(f"sitio armado en {salida}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
