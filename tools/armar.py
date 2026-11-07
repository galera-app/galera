"""Arma Galera desde marco/: cabecera, pie, recursos del <head>, CSP y versiones ?v=. Una sola fuente, un solo armado.
Las páginas del repo llevan marcas en vez del marco repetido:
    <!--marco:csp-->  <!--marco:meta-->  <!--marco:recursos-->  <!--marco:cabecera-->  <!--marco:pie-->
El build las expande en la carpeta de salida (dist/); eso es lo que publican Cloudflare y GitHub Pages.
Fuente única: marco/sitio.json, marco/pie.tpl, marco/cabecera.tpl. También escribe marco.js (lo lee la app).

Uso: python tools/armar.py [--salida dist]   arma el sitio publicable (stdlib, sin dependencias)
     python tools/armar.py --servir 8772      lo arma en dist/ y lo sirve en http://127.0.0.1:8772 (para mirar cambios)
     python tools/armar.py --salida dist --sin-minificar   igual, sin minificar JS ni CSS (por defecto minifica si hay rjsmin y rcssmin)
     python tools/armar.py --marcar          pasa a marcas las páginas que traen el marco escrito (salida de los generadores)
     python tools/armar.py --salida dist --sin-indice   igual, sin armar el índice del buscador (Pagefind)
     python tools/armar.py --comprobar        no escribe; sale con 1 si hay páginas con el marco escrito, datos inválidos (preguntas, lecturas) o si el armado falla (lo corre el CI)
No toca prueba/. libro/planificador-de-libros.html es un archivo descargable: lleva el pie, pero conserva su cabecera y su <head>."""
import hashlib
import json
import unicodedata
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
M = RAIZ / "marco"
MARCA = json.loads((RAIZ / "datos" / "marca.json").read_text(encoding="utf-8"))
MARCA_USO = re.compile(r"\{\{marca\.(\w+)\}\}")


def con_marca(t):
    """{{marca.clave}} -> el valor de datos/marca.json (la frase, la firma, la ubicación). Una clave que no existe es un error del armado."""
    return MARCA_USO.sub(lambda m: MARCA[m.group(1)], t)


# marco/sitio.json también las usa: se expanden antes de leerlo, escapando lo que va dentro de un string JSON.
S = json.loads(MARCA_USO.sub(lambda m: json.dumps(MARCA[m.group(1)], ensure_ascii=False)[1:-1], (M / "sitio.json").read_text(encoding="utf-8")))
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
# Buscador: Pagefind indexa el <main> de cada página armada (y de ninguna más: ni /buscar/, ni la 404, ni las noindex).
SIN_INDICE = {"404.html", "buscar/index.html"}
# Chrome de pantalla que no es contenido (botones, migas, bloque de descarga, «¿Terminaste de leerlo?», vecinos, textos solo de impresión).
# Se repite en cada apunte y engorda fragmentos e índice sin sumar nada a la búsqueda.
EXCLUIR_INDICE = ".no-imprimir, .solo-imprimir, .indice-apunte"
# La versión que usan el CI, `Publicar` y el comando de build de Cloudflare (README): que sea la misma en todos lados.
PAGEFIND_VERSION = "1.6.0"
MAIN = re.compile(r'<main id="main"')
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
    extra = "".join(f'<a href="{P[k]["url"]}">{P[k]["t"]}</a>' for k in ("ingresantes", "legal", "prensa"))
    extra += "".join(f'<a href="{r["url"]}" rel="me noopener" target="_blank">{r["t"]}</a>' for r in P["redes"])
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


# Scripts que la app baja recién cuando una pantalla los necesita (los usa `cargarMods` en app.js; el prerender los suma todos).
# El orden dentro de cada grupo es el de ejecución. No van en app-cierre.tpl.
CARGA = {"horarios": ["horarios"], "grafo": ["grafo"], "arcade": ["arcade", "arcade-ui"],
         "sim": ["escandallo", "papel", "paginacion", "cronograma", "ecosistema", "formatos", "leyes", "contratos", "retos"]}

META_COMUN = ('<meta name="referrer" content="strict-origin-when-cross-origin">\n'
              '<meta name="author" content="Fidel Chaves">\n'
              '<meta name="color-scheme" content="light dark">')
PRECARGA = ''.join(f'<link rel="preload" href="/fonts/{f}" as="font" type="font/woff2" crossorigin>\n' for f in ("instrument-sans.woff2", "unifraktur.woff2"))  # cuerpo/títulos y la «galera» de la cabecera
RECURSOS_APP = (PRECARGA + '<link rel="icon" type="image/png" href="/img/favicon-32.png">\n'
                '<link rel="apple-touch-icon" href="/img/icono-180.png">\n<link rel="manifest" href="/manifest.webmanifest">\n<meta name="theme-color" content="#0560C8">\n'
                '<script>try{var t=localStorage.getItem("cursada.tema");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t;if(localStorage.getItem("cursada.v1"))document.documentElement.classList.add("con-datos")}catch(e){}</script>\n'
                + "\n".join(f'<link rel="stylesheet" href="/{c}">' for c in CSS) + '\n<script defer src="/analitica.js"></script>')
RECURSOS = (PRECARGA + '<link rel="icon" type="image/png" href="/img/favicon-32.png">\n'
            '<link rel="apple-touch-icon" href="/img/icono-180.png">\n'
            + "\n".join(f'<link rel="stylesheet" href="/{c}">' for c in CSS)
            + '\n<script src="/menu.js" defer></script>\n<script src="/analitica.js"></script>')
QUITAR_CSP = re.compile(r'<meta http-equiv="Content-Security-Policy"[^>]*>')
QUITAR_META = re.compile(r'<meta (?:http-equiv="Content-Security-Policy"|name="referrer"|name="author"|name="color-scheme")[^>]*>\n')
QUITAR_REC = re.compile(r'<link rel="(?:icon|apple-touch-icon|preload)"[^>]*>\n|'
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


def para_indice(t, rel):
    """Marca el contenido principal para el buscador. Menú, pie y barras quedan afuera porque no están dentro de <main>."""
    if rel in SIN_INDICE or rel in SUELTAS or 'name="robots" content="noindex' in t:
        return t
    return MAIN.sub('<main data-pagefind-body id="main"', t, count=1)


def ids_reservados():
    """Ids que el router de app.js ya usa en el hash (#resumenes, #pedidos...): pestañas más los alias de desdeHash, leídos del código."""
    app = (RAIZ / "app.js").read_text(encoding="utf-8")
    m = re.search(r"function desdeHash\(\) \{(.*?)\n\}", app, re.S)
    alias = set(re.findall(r"p\[0\] === '([\w-]+)'", m.group(1))) if m else set()
    return set(S["pantallas"]) | set(S["tabs_ocultas"]) | alias


def firma_valida(f):
    """La misma regla que app.js (RE_FIRMA) y sugerencias/Codigo.gs: empieza con letra; letras, marcas, espacio, punto, apóstrofo y guion; 2 a 60."""
    return isinstance(f, str) and 2 <= len(f) <= 60 and f[0].isalpha() and f == f.strip() and "  " not in f and all(
        c.isalpha() or unicodedata.category(c).startswith("M") or c in " .'’-" for c in f)


def ids_de_preguntas():
    """Falla si un id de tema o de pregunta (respondida o sin responder) chocaría con el router (/preguntas/#resumenes saltaría a otra
    pantalla) o se repite, si una sin responder apunta a un tema que no existe o si una firma no cumple la regla."""
    datos = json.loads((RAIZ / "datos" / "preguntas.json").read_text(encoding="utf-8"))
    temas = [t["id"] for t in datos["temas"]]
    sin = datos.get("sinResponder", [])
    ids = temas + [p["id"] for t in datos["temas"] for p in t["preguntas"]] + [p["id"] for p in sin] + ["sin-" + t for t in temas]
    malos = [f"{i} (choca con el router de hashes)" for i in ids if i in ids_reservados()]
    malos += [f"{i} (repetido)" for i in sorted({i for i in ids if ids.count(i) > 1})]
    malos += [f"{p['id']} (sin responder con un tema que no existe: {p.get('tema')})" for p in sin if p.get("tema") not in temas]
    malos += [f"{p['id']} (sin responder sin pregunta)" for p in sin if not str(p.get("pregunta", "")).strip()]
    malos += [f"{p['id']} (firma inválida)" for t in datos["temas"] for p in t["preguntas"] if "firma" in p and not firma_valida(p["firma"])]
    return malos


def faq_jsonld(t, rel):
    """/preguntas/: agrega el JSON-LD FAQPage generado desde datos/preguntas.json (la misma fuente que la pantalla), con las respuestas en texto plano."""
    if rel != "preguntas/index.html":
        return t
    datos = json.loads((RAIZ / "datos" / "preguntas.json").read_text(encoding="utf-8"))
    plano = lambda s: re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", s)
    faq = {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
        {"@type": "Question", "name": p["pregunta"], "acceptedAnswer": {"@type": "Answer", "text": plano(p["respuesta"])}}
        for tema in datos["temas"] for p in tema["preguntas"]]}
    bloque = '<script type="application/ld+json">' + json.dumps(faq, ensure_ascii=False).replace("</", "<" + chr(92) + "/") + "</script>\n"
    return t.replace("</head>", bloque + "</head>", 1)


def ids_de_lecturas():
    """Mapas de lectura: falla si un id de mapa choca con el router, se repite, no tiene su página de entrada (lecturas/<id>/index.html) o su
    entrada en el sitemap, si una lectura se repite o apunta a un tramo o a una teoría que no existe."""
    datos = json.loads((RAIZ / "datos" / "lecturas.json").read_text(encoding="utf-8"))
    mapas = datos["mapas"]
    ids = [m["id"] for m in mapas]
    sitemap = (RAIZ / "sitemap.xml").read_text(encoding="utf-8")
    malos = [f"{i} (choca con el router de hashes)" for i in ids if i in ids_reservados()]
    malos += [f"{i} (repetido)" for i in sorted({i for i in ids if ids.count(i) > 1})]
    malos += [f"{m['id']} (falta lecturas/{m['id']}/index.html)" for m in mapas if not (RAIZ / "lecturas" / m["id"] / "index.html").is_file()]
    malos += [f"{m['id']} (falta en sitemap.xml)" for m in mapas if f"https://galera.com.ar/lecturas/{m['id']}/" not in sitemap]
    for m in mapas:
        nums, tramos, teoria = [o["num"] for o in m["obras"]], {t["num"] for t in m["tramos"]}, {x["n"] for x in m["teoria"]}
        malos += [f"{m['id']}: lectura {n} repetida" for n in sorted({n for n in nums if nums.count(n) > 1})]
        malos += [f"{m['id']}: lectura {o['num']} en un tramo que no existe ({o['tramo']})" for o in m["obras"] if o["tramo"] not in tramos]
        malos += [f"{m['id']}: lectura {o['num']} cita la teoría {x}, que no existe" for o in m["obras"] for x in o["teoria"] if x not in teoria]
        # póster A3 (v129): su página de entrada (noindex) y los textos cortos que usa
        malos += [f"{m['id']} (falta lecturas/{m['id']}/poster/index.html)"] if not (RAIZ / "lecturas" / m["id"] / "poster" / "index.html").is_file() else []
        malos += [f"{m['id']}: falta el bloque poster del mapa"] if not all(k in m.get("poster", {}) for k in ("subtitulo", "bajada", "nota_teoria", "pie", "alto")) else []
        malos += [f"{m['id']}: lectura {o['num']} sin poster{{titulo, autor, anio}}" for o in m["obras"] if not all((o.get("poster") or {}).get(k) for k in ("titulo", "autor", "anio"))]
        malos += [f"{m['id']}: teoría {x['n']} sin autor_corto, titulo_corto u obras_poster" for x in m["teoria"] if not all(x.get(k) for k in ("autor_corto", "titulo_corto", "obras_poster"))]
    return malos


def lecturas_jsonld(t, rel):
    """/lecturas/ y /lecturas/<id>/: agrega un ItemList (los mapas, o las obras de un mapa) generado desde datos/lecturas.json, la misma fuente que la pantalla."""
    if rel != "lecturas/index.html" and not re.fullmatch(r"lecturas/[\w.-]+/index\.html", rel):
        return t
    datos = json.loads((RAIZ / "datos" / "lecturas.json").read_text(encoding="utf-8"))
    if rel == "lecturas/index.html":
        items = [{"@type": "ListItem", "position": i + 1, "name": m["titulo"], "url": f"https://galera.com.ar/lecturas/{m['id']}/"} for i, m in enumerate(datos["mapas"])]
        lista = {"@context": "https://schema.org", "@type": "ItemList", "name": "Mapas de lectura de Letras (UBA)", "itemListElement": items}
    else:
        m = next((x for x in datos["mapas"] if x["id"] == rel.split("/")[1]), None)
        if m is None:
            return t
        items = [{"@type": "ListItem", "position": i + 1, "item": {"@type": "CreativeWork", "name": o["titulo"], "author": {"@type": "Person", "name": o["autor"]}}}
                 for i, o in enumerate(m["obras"])]
        lista = {"@context": "https://schema.org", "@type": "ItemList", "name": m["titulo"], "description": m["bajada"], "numberOfItems": len(items), "itemListElement": items}
    bloque = '<script type="application/ld+json">' + json.dumps(lista, ensure_ascii=False).replace("</", "<" + chr(92) + "/") + "</script>\n"
    return t.replace("</head>", bloque + "</head>", 1)


def comando_pagefind():
    """`python -m pagefind` (paquete pagefind[extended]) o el binario `pagefind`. Con GALERA_PAGEFIND_NPX=1 también `npx pagefind@versión`
    (baja de internet: por eso no es automático). None si no hay ninguno."""
    pruebas = [[sys.executable, "-m", "pagefind"]]
    if shutil.which("pagefind"):
        pruebas.append(["pagefind"])
    if os.environ.get("GALERA_PAGEFIND_NPX") == "1" and shutil.which("npx"):
        pruebas.append([shutil.which("npx"), "--yes", f"pagefind@{PAGEFIND_VERSION}"])
    for c in pruebas:
        try:
            if subprocess.run(c + ["--version"], capture_output=True, timeout=120).returncode == 0:
                return c
        except (OSError, subprocess.SubprocessError):
            pass
    return None


def indexar(salida):
    """Arma salida/pagefind/ (el índice del buscador). Si falta Pagefind o falla, avisa y el sitio sale sin buscador (el resto se publica igual),
    salvo con GALERA_EXIGIR_BUSCADOR=1 (el CI y `Publicar`), donde es un error."""
    exigir = os.environ.get("GALERA_EXIGIR_BUSCADOR") == "1"
    c = comando_pagefind()
    if c is None:
        print(f"AVISO: no encontre Pagefind; el sitio queda sin buscador. Instalalo con: pip install \"pagefind[extended]=={PAGEFIND_VERSION}\"")
        return not exigir
    try:
        r = subprocess.run(c + ["--site", str(salida), "--force-language", "es", "--exclude-selectors", EXCLUIR_INDICE, "--quiet"], timeout=600)
        ok = r.returncode == 0 and (salida / "pagefind" / "pagefind.js").is_file()
        # La interfaz propia está en app.js (vBuscar): los componentes de interfaz de Pagefind no se publican.
        for f in (salida / "pagefind").glob("pagefind-*ui*"):
            f.unlink()
        (salida / "pagefind" / "pagefind-highlight.js").unlink(missing_ok=True)
    except (OSError, subprocess.SubprocessError) as e:
        print(f"AVISO: Pagefind fallo ({e})")
        ok = False
    if not ok:
        print("AVISO: no se pudo armar el indice; el sitio queda sin buscador.")
        shutil.rmtree(salida / "pagefind", ignore_errors=True)
    return ok or not exigir


def minificadores():
    """rjsmin y rcssmin (paquetes de pip, Python puro, no renombran nada). Opcionales: si faltan, el sitio sale sin minificar y avisa."""
    try:
        import rcssmin
        import rjsmin
        return rjsmin, rcssmin
    except ImportError:
        return None


def minificar_todo(salida, solo=None, excepto=()):
    """Minifica los .js y .css de `salida` (nunca del repo fuente): saca espacios y comentarios, conserva los /*! */ y no cambia nombres.
    Va antes de calcular las huellas ?v=, así que la huella es la del archivo final. Si node está, cada JS minificado pasa `node --check`
    y, si no compila, se deja el original. Sin rjsmin/rcssmin: aviso y sale sin minificar (Cloudflare hoy está en ese caso).
    Con GALERA_EXIGIR_MINIFICADO=1 (desplegar.yml) la falta es un error."""
    m = minificadores()
    if m is None:
        print("AVISO: no estan rjsmin y rcssmin; el sitio sale sin minificar. Instalalos con: pip install rjsmin==1.3.0 rcssmin==1.3.0")
        return os.environ.get("GALERA_EXIGIR_MINIFICADO") != "1"
    rjs, rcs = m
    node = shutil.which("node")
    ok = True
    archivos = [solo] if solo else sorted(f for e in ("*.js", "*.css") for f in salida.rglob(e)
                                          if not f.relative_to(salida).as_posix().startswith(("prueba/", ".")) and f.name not in excepto)
    for f in archivos:
        t = f.read_text(encoding="utf-8")
        if f.suffix == ".js":
            if "`" in t:
                # rjsmin 1.3.0 saca espacios dentro de plantillas anidadas (`${a.map(x => `<a ${y}>`)}` -> `<a${y}>`, "Se actualiza: x" -> "Se actualiza:x")
                # y node --check no lo nota. Los JS con plantillas quedan sin minificar hasta tener un minificador que las entienda (esbuild).
                continue
            n = rjs.jsmin(t, keep_bang_comments=True)
            if node:
                with tempfile.TemporaryDirectory() as tmp:
                    c = Path(tmp) / "c.js"
                    c.write_text(n, encoding="utf-8")
                    if subprocess.run([node, "--check", str(c)], capture_output=True).returncode != 0:
                        print(f"AVISO: {f.name} minificado no compila; queda sin minificar")
                        ok = False
                        continue
        else:
            n = rcs.cssmin(t, keep_bang_comments=True)
        if len(n) < len(t):
            escribir(f, n)
    return ok or os.environ.get("GALERA_EXIGIR_MINIFICADO") != "1"


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


def construir(salida, indice=False, minificar=True):
    """Copia el repo a `salida` sin lo que no se publica, escribe marco.js y expande las marcas."""
    if salida.exists():
        shutil.rmtree(salida)
    shutil.copytree(RAIZ, salida, ignore=lambda d, nombres: [n for n in nombres if n in NO_PUBLICAR and Path(d) == RAIZ])
    publico = {k: S[k] for k in ("pantallas", "tabs", "tabs_ocultas", "menu", "barra_celular", "simuladores")}
    publico["escribir"] = S["pie"]["escribir"]
    publico["marca"] = {k: MARCA[k] for k in ("frase", "firma", "ubicacion")}   # solo lo que lee app.js
    publico["carga"] = CARGA
    publico["huellas"] = {n: huella(salida / f"{n}.js") for g in CARGA.values() for n in g}
    escribir(salida / "marco.js", "// Lo escribe tools/armar.py desde marco/sitio.json: no editar a mano.\nconst MARCO = "
             + json.dumps(publico, ensure_ascii=False, separators=(",", ":")) + ";\n")
    app = salida / "app.js"
    sobran = []
    # app.js se minifica al final: antes hay que poner la huella de mapa-ar.js, que tiene que ser la del archivo ya minificado.
    if minificar and not minificar_todo(salida, excepto=("app.js",)):
        sobran.append("minificado (no se pudo minificar y se exige)")
    escribir(app, re.sub(r"s\.src = '/mapa-ar\.js[^']*'", "s.src = '/mapa-ar.js?v=" + huella(salida / "mapa-ar.js") + "'", app.read_text(encoding="utf-8")))
    if minificar and not minificar_todo(salida, solo=app):
        sobran.append("minificado de app.js")
    for p, rel in paginas(salida):
        escribir(p, versionar(para_indice(lecturas_jsonld(faq_jsonld(con_marca(expandir(p.read_text(encoding="utf-8"), rel)), rel), rel), rel), p.parent, salida))
    prerender(salida)
    for p, rel in paginas(salida):
        if "<!--marco:" in p.read_text(encoding="utf-8"):
            sobran.append(rel)
    sobran += ["datos/preguntas.json: id " + m for m in ids_de_preguntas()]
    sobran += ["datos/lecturas.json: " + m for m in ids_de_lecturas()]
    if indice and not sobran and not indexar(salida):
        sobran.append("pagefind (no se pudo armar el índice del buscador)")
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
        print("\n".join(f"falla del armado: {d}" for d in sobran))
        if not cambian and not sobran:
            print("marco ok")
        return 1 if cambian or sobran else 0
    salida = Path(args[args.index("--salida") + 1]) if "--salida" in args else RAIZ / "dist"
    sobran = construir(salida.resolve(), indice="--sin-indice" not in args, minificar="--sin-minificar" not in args)
    if sobran:
        print("falla del armado (marca sin expandir o dato inválido):\n  " + "\n  ".join(sobran))
        return 1
    print(f"sitio armado en {salida}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
