#!/usr/bin/env python3
"""Pruebas de mantenimiento de Galera: rápidas, sin dependencias (solo biblioteca estándar).

Uso:
  python tools/armar.py --salida dist        # una vez, lo hace el CI
  python tools/probar.py [dist]              # todo (datos + sitio armado)
  python tools/probar.py --solo datos        # solo los JSON, no necesita dist/
  python tools/probar.py --solo sitio dist   # solo lo que mira el sitio armado

Qué protege:
  datos      JSON sin claves repetidas, esquema mínimo de cada archivo, ids únicos, fechas ISO válidas,
             archivos que nombra datos/indice.json, novedades.json (versiones seguidas, orden, URLs propias)
             y, si hay un CHANGELOG.md a mano (GALERA_CHANGELOG o ../CHANGELOG.md), que coincida con él.
  sitio      enlaces internos, sitemap contra páginas reales, robots.txt, metadatos compartibles,
             CSP (sin scripts en línea ni orígenes no declarados) y service worker + manifest.
Los simuladores tienen su prueba de humo aparte: node tools/probar_simuladores.js
Lo profundo de SEO (imágenes og, largos) sigue en tools/verificar_seo.py.
"""
import argparse
import datetime
import json
import os
import re
import subprocess
import sys
import unittest
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote

RAIZ = Path(__file__).resolve().parent.parent
DOMINIO = "https://galera.com.ar"
DIST = RAIZ / "dist"
SALTAR_DIRS = {".git", "node_modules", "dist", ".github", "pagefind"}

# Páginas indexables que a propósito no están en el sitemap (con el motivo).
SIN_SITEMAP = {
    "config/": "«Tus datos»: ajustes personales, sin contenido para buscadores",
}
# Los únicos scripts en línea admitidos: el que fija el tema antes de pintar (evita el parpadeo).
# Páginas sueltas a propósito (noindex): el planificador descargable y la maqueta de componentes no llevan CSP del marco.
SIN_CSP = {"libro/planificador-de-libros.html", "prueba/componentes/index.html"}
SCRIPT_LINEA_OK = ('try{var t=localStorage.getItem("cursada.tema")',)


# ───────────────────────── utilidades ─────────────────────────

def sin_repetidas(pares):
    d = {}
    for k, v in pares:
        if k in d:
            raise ValueError(f"clave repetida: {k!r}")
        d[k] = v
    return d


def cargar_json(p):
    return json.loads(Path(p).read_text(encoding="utf-8"), object_pairs_hook=sin_repetidas)


def json_del_repo():
    for p in sorted(RAIZ.rglob("*.json")):
        if SALTAR_DIRS & set(p.relative_to(RAIZ).parts):
            continue
        yield p


def fecha_valida(s):
    if not isinstance(s, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", s):
        return False
    try:
        datetime.date.fromisoformat(s)
        return True
    except ValueError:
        return False


class Pagina(HTMLParser):
    """Junta lo que interesa de una página: metas, links, recursos, scripts en línea y atributos on*."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title, self._en_title = "", False
        self.meta, self.metas, self.links, self.recursos = {}, [], [], []
        self.lang, self.ld, self.en_linea, self.on_attrs, self.estilos = "", 0, [], [], 0
        self._script = None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "html":
            self.lang = a.get("lang", "")
        elif tag == "title":
            self._en_title = True
        elif tag == "meta":
            self.metas.append(a)
            k = a.get("property") or a.get("name")
            if k and "content" in a:
                self.meta.setdefault(k, a["content"])
        elif tag == "link" and a.get("href"):
            self.links.append(a)
            if "canonical" not in (a.get("rel") or ""):
                self.recursos.append((tag, a["href"], a.get("rel") or ""))
        elif tag == "script":
            if a.get("src"):
                self.recursos.append((tag, a["src"], ""))
            elif a.get("type") == "application/ld+json":
                self.ld += 1
            else:
                self._script = []
        elif tag == "style":
            self.estilos += 1
        elif tag in ("img", "iframe", "source", "audio", "video", "embed") and a.get("src"):
            self.recursos.append((tag, a["src"], ""))
        elif tag == "form" and a.get("action"):
            self.recursos.append((tag, a["action"], ""))
        for k in a:
            if k.startswith("on"):
                self.on_attrs.append(f"<{tag} {k}=…>")
        if tag == "a" and (a.get("href") or "").lower().startswith("javascript:"):
            self.on_attrs.append("<a href=javascript:…>")

    def handle_endtag(self, tag):
        if tag == "title":
            self._en_title = False
        elif tag == "script" and self._script is not None:
            self.en_linea.append("".join(self._script).strip())
            self._script = None

    def handle_data(self, d):
        if self._en_title:
            self.title += d
        if self._script is not None:
            self._script.append(d)

    @property
    def noindex(self):
        return "noindex" in self.meta.get("robots", "").lower()

    @property
    def canonical(self):
        return next((l["href"] for l in self.links if "canonical" in (l.get("rel") or "")), "")

    @property
    def csp(self):
        return [m.get("content", "") for m in self.metas if (m.get("http-equiv") or "").lower() == "content-security-policy"]


def parsear_csp(texto):
    d = {}
    for parte in texto.split(";"):
        t = parte.split()
        if t:
            d[t[0]] = t[1:]
    return d


def hosts_permitidos(csp, directiva):
    fuentes = csp.get(directiva) or csp.get("default-src") or []
    return fuentes


def host_cubierto(url, fuentes, origen_propio=DOMINIO):
    """¿La URL absoluta está permitida por la lista de fuentes de una directiva CSP?"""
    u = urlsplit(url)
    for f in fuentes:
        if f.startswith("'"):
            continue
        if f == "data:" or f == "blob:":
            continue
        if f.startswith("https://*."):
            if u.scheme == "https" and u.netloc.endswith(f[len("https://*"):]):
                return True
        elif f.startswith("http"):
            if f"{u.scheme}://{u.netloc}" == f.rstrip("/"):
                return True
    return f"{u.scheme}://{u.netloc}" == origen_propio and "'self'" in fuentes


def ruta_a_url(rel):
    return DOMINIO + "/" + ("" if rel == "index.html" else rel[:-len("index.html")] if rel.endswith("/index.html") else rel)


# ───────────────────────── datos ─────────────────────────

# archivo → (ruta a la lista o None si el archivo es la lista, {campo obligatorio: tipo})
ESQUEMAS = {
    "datos/novedades.json": ("novedades", {"v": int, "fecha": str, "tipo": str, "perfil": str, "titulo": str, "texto": str}),   # materias es opcional (vacío = todas)
    "datos/oferta-2026-2c.json": ("comisiones", {"id": str, "materia": str, "tipo": str, "docente": str, "bloques": list}),
    "datos/mesas-2026-septiembre.json": ("mesas", {"materia": str, "nombre": str, "fecha": str, "hora": str}),
    "datos/calendario-2026.json": ("feriados", {"fecha": str, "t": str, "tipo": str}),
    "datos/glosario.json": ("terminos", {"t": str, "materias": list, "acepciones": list}),
    "datos/directorio.json": ("actores", {"id": str, "tipo": str, "n": str}),
    "datos/biblioteca.json": ("libros", {"id": str, "t": str, "autor": str}),
    "datos/eventos.json": ("eventos", {"id": str, "t": str, "tipo": str, "desde": str, "hasta": str}),
    "datos/plan.json": ("etapas", {"id": str, "t": str, "items": list}),
    "datos/periodicas.json": ("publicaciones", {}),
    "datos/pedidos.json": ("pedidos", {}),
    "datos/preguntas.json": ("temas", {}),
}
# Archivos que no pueden quedar vacíos ni perder estas claves de primer nivel.
CLAVES_TOP = {
    "datos/indice.json": ("carreras", "calendarios", "ofertas", "mesas", "bibliografia"),
    "datos/edicion.json": ("id", "nombre", "plan"),
    "datos/marca.json": ("frase", "titulo_home", "desc_home"),
    "datos/tarifas.json": ("rubros", "fuentes"),
    "datos/simuladores-info.json": ("escandallo", "paginacion"),
    "datos/sostener.json": ("horas_totales", "commits"),
    "datos/libros-programas.json": ("materias", "libros"),
}
CLAVES_FECHA = {"actualizado", "consultado", "verificado", "fecha", "desde", "hasta"}
# Listas cuyos ids tienen que ser únicos: (archivo, ruta, campo)
IDS_UNICOS = [("datos/directorio.json", "actores", "id"), ("datos/biblioteca.json", "libros", "id"),
              ("datos/eventos.json", "eventos", "id"), ("datos/oferta-2026-2c.json", "comisiones", "id"),
              ("datos/plan.json", "etapas", "id")]


def fechas_malas(nodo, ruta=""):
    if isinstance(nodo, dict):
        for k, v in nodo.items():
            if k in CLAVES_FECHA and isinstance(v, str) and v != "" and not fecha_valida(v) and not (k in ("desde", "hasta") and re.fullmatch(r"([01]\d|2[0-3]):[0-5]\d", v)):
                yield f"{ruta}/{k} = {v!r}"
            else:
                yield from fechas_malas(v, f"{ruta}/{k}")
    elif isinstance(nodo, list):
        for i, v in enumerate(nodo):
            yield from fechas_malas(v, f"{ruta}[{i}]")


class TestDatos(unittest.TestCase):
    def test_json_sin_claves_repetidas(self):
        malos = []
        for p in json_del_repo():
            try:
                cargar_json(p)
            except Exception as e:
                malos.append(f"{p.relative_to(RAIZ).as_posix()}: {e}")
        self.assertEqual(malos, [])

    def test_esquema_minimo(self):
        malos = []
        for arch, (ruta, campos) in ESQUEMAS.items():
            d = cargar_json(RAIZ / arch)
            lista = d[ruta] if ruta else d
            if not isinstance(lista, list) or not lista:
                malos.append(f"{arch}: «{ruta}» debería ser una lista con elementos")
                continue
            for i, x in enumerate(lista):
                if not isinstance(x, dict):
                    malos.append(f"{arch}[{ruta}][{i}]: no es un objeto")
                    continue
                for c, t in campos.items():
                    if c not in x:
                        malos.append(f"{arch}[{ruta}][{i}]: falta «{c}»")
                    elif not isinstance(x[c], t) or isinstance(x[c], bool) and t is int:
                        malos.append(f"{arch}[{ruta}][{i}]: «{c}» debería ser {t.__name__}")
        for arch, claves in CLAVES_TOP.items():
            d = cargar_json(RAIZ / arch)
            malos += [f"{arch}: falta «{c}»" for c in claves if c not in d or d[c] in (None, "", [], {})]
        self.assertEqual(malos[:25], [])

    def test_ids_unicos(self):
        malos = []
        for arch, ruta, campo in IDS_UNICOS:
            vistos, ids = set(), [x[campo] for x in cargar_json(RAIZ / arch)[ruta]]
            for i in ids:
                if i in vistos:
                    malos.append(f"{arch}: id repetido {i!r}")
                vistos.add(i)
        self.assertEqual(malos, [])

    def test_fechas_iso_validas(self):
        malos = []
        for p in sorted((RAIZ / "datos").rglob("*.json")):
            malos += [f"{p.relative_to(RAIZ).as_posix()}{m}" for m in fechas_malas(cargar_json(p))]
        self.assertEqual(malos[:25], [])

    def test_indice_apunta_a_archivos_reales(self):
        idx = cargar_json(RAIZ / "datos/indice.json")
        faltan = []
        for grupo in ("carreras", "calendarios", "ofertas", "mesas"):
            for x in idx[grupo]:
                if not (RAIZ / "datos" / x["archivo"]).is_file():
                    faltan.append(f"datos/{x['archivo']}")
        for b in idx["bibliografia"]:
            if not (RAIZ / "datos/bibliografia" / f"{b['codigo']}.json").is_file():
                faltan.append(f"datos/bibliografia/{b['codigo']}.json")
        self.assertEqual(faltan, [])

    def test_bibliografia_coincide_con_el_indice(self):
        malos = []
        for b in cargar_json(RAIZ / "datos/indice.json")["bibliografia"]:
            p = RAIZ / "datos/bibliografia" / f"{b['codigo']}.json"
            if p.is_file():
                d = cargar_json(p)
                if d.get("codigo") != b["codigo"]:
                    malos.append(f"{p.name}: codigo {d.get('codigo')!r} ≠ {b['codigo']!r}")
        self.assertEqual(malos, [])

    def test_novedades_versiones_orden_y_urls(self):
        nv = cargar_json(RAIZ / "datos/novedades.json")["novedades"]
        vs = [x["v"] for x in nv]
        self.assertEqual(len(set(vs)), len(vs), "hay versiones repetidas")
        self.assertEqual(sorted(vs), list(range(1, max(vs) + 1)), "faltan versiones (huecos)")
        self.assertEqual(vs, sorted(vs, reverse=True), "novedades fuera de orden (la más nueva va primera)")
        self.assertTrue(all(fecha_valida(x["fecha"]) for x in nv), "fecha no ISO en novedades")
        self.assertTrue(all(x["tipo"] in ("herramientas", "resumenes", "fechas") for x in nv), "tipo desconocido")
        self.assertTrue(all(x["perfil"] in ("estudiante", "profesional", "todos") for x in nv), "perfil desconocido")
        malas = [x["v"] for x in nv if x.get("url") and not x["url"].startswith(DOMINIO + "/")
                 and not (x["v"] <= 100 and x["url"].startswith("https://ficha.github.io/cursada/"))]   # v85 quedó con la dirección vieja
        self.assertEqual(malas, [], "url de novedades que no es de galera.com.ar")

    def test_novedades_contra_changelog(self):
        cand = [os.environ.get("GALERA_CHANGELOG", ""), RAIZ / "CHANGELOG.md", RAIZ.parent / "CHANGELOG.md"]
        ch = next((Path(c) for c in cand if c and Path(c).is_file()), None)
        if ch is None:
            self.skipTest("no hay CHANGELOG.md a mano (en el CI no está: vive en 104-edicion-cursada)")
        nv = {x["v"] for x in cargar_json(RAIZ / "datos/novedades.json")["novedades"]}
        reg = [int(m) for m in re.findall(r"^## v(\d+) ", ch.read_text(encoding="utf-8"), re.M)]
        self.assertEqual(sorted(nv - set(reg)), [], "versiones publicadas que faltan en el CHANGELOG")
        self.assertEqual(sorted(set(reg) - nv), [], "versiones del CHANGELOG sin entrada en novedades.json")
        self.assertEqual(reg, sorted(reg, reverse=True), "CHANGELOG fuera de orden")


# ───────────────────────── sitio armado ─────────────────────────

_cache = {}


def paginas():
    """{ruta relativa: Pagina} de todo el HTML del sitio armado, salvo pagefind."""
    if "p" not in _cache:
        if not DIST.is_dir():
            raise unittest.SkipTest(f"no existe {DIST}: corré antes python tools/armar.py --salida dist")
        out = {}
        for p in sorted(DIST.rglob("*.html")):
            rel = p.relative_to(DIST).as_posix()
            if rel.startswith("pagefind/"):
                continue
            pg = Pagina()
            pg.feed(p.read_text(encoding="utf-8", errors="replace"))
            out[rel] = pg
        _cache["p"] = out
    return _cache["p"]


def sitemap_urls():
    return re.findall(r"<loc>\s*(.*?)\s*</loc>", (DIST / "sitemap.xml").read_text(encoding="utf-8"))


def url_a_archivo(url):
    """URL absoluta del sitio → archivo en dist/ (None si no es del sitio o no existe)."""
    u = urlsplit(url)
    if f"{u.scheme}://{u.netloc}" != DOMINIO:
        return None
    ruta = unquote(u.path).lstrip("/")
    for c in ([ruta + "index.html"] if ruta.endswith("/") or not ruta else [ruta, ruta + "/index.html"]):
        if (DIST / c).is_file():
            return c
    return None


class TestSitio(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        paginas()

    def test_enlaces_internos(self):
        r = subprocess.run([sys.executable, str(RAIZ / "tools/controlar_enlaces.py"), str(DIST)], capture_output=True, text=True, encoding="utf-8")
        self.assertEqual(r.returncode, 0, "enlaces internos rotos:\n" + (r.stdout + r.stderr)[-2500:])

    def test_sitemap_y_paginas_reales(self):
        urls = sitemap_urls()
        self.assertEqual(len(urls), len(set(urls)), "URLs repetidas en sitemap.xml")
        malas, noindex_en_mapa = [], []
        for u in urls:
            arch = url_a_archivo(u)
            if not u.startswith(DOMINIO + "/"):
                malas.append(f"fuera del dominio: {u}")
            elif arch is None:
                malas.append(f"no existe la página: {u}")
            elif arch in paginas() and paginas()[arch].noindex:
                noindex_en_mapa.append(u)
        self.assertEqual(malas, [], "sitemap.xml apunta a páginas inexistentes")
        self.assertEqual(noindex_en_mapa, [], "sitemap.xml lista páginas con noindex")
        en_mapa = {url_a_archivo(u) for u in urls}
        faltan = [r for r, pg in paginas().items() if not pg.noindex and r not in en_mapa and r.replace("index.html", "") not in SIN_SITEMAP]
        self.assertEqual(faltan, [], "páginas indexables que no están en sitemap.xml")

    def test_robots(self):
        txt = (DIST / "robots.txt").read_text(encoding="utf-8")
        self.assertIn(f"Sitemap: {DOMINIO}/sitemap.xml", txt)
        no = [l.split(":", 1)[1].strip() for l in txt.splitlines() if l.lower().startswith("disallow:")]
        self.assertNotIn("/", no, "robots.txt bloquea todo el sitio")
        bloqueadas = [u for u in sitemap_urls() if any(n and urlsplit(u).path.startswith(n) for n in no)]
        self.assertEqual(bloqueadas, [], "robots.txt bloquea URLs que están en el sitemap")

    def test_metadatos_de_paginas_compartibles(self):
        malas = []
        for rel, pg in paginas().items():
            if pg.noindex:
                continue
            m, f = pg.meta, []
            if not pg.title.strip():
                f.append("title")
            if not m.get("description"):
                f.append("description")
            if not pg.lang:
                f.append("lang")
            can = pg.canonical
            esperado = ruta_a_url(rel)
            if not can.startswith("https://"):
                f.append("canonical https")
            elif can.rstrip("/") != esperado.rstrip("/") and not (rel.endswith(".html") and can.rstrip("/") == esperado.rstrip("/")):
                f.append(f"canonical apunta a otra página ({can})")
            for k in ("og:title", "og:description", "og:type", "og:url", "og:image", "twitter:card"):
                if not m.get(k):
                    f.append(k)
            if m.get("og:image") and not m["og:image"].startswith("https://"):
                f.append("og:image absoluta")
            if f:
                malas.append(f"{rel}: falta/mal {', '.join(f)}")
        self.assertEqual(malas[:25], [])

    def test_csp_una_por_pagina_y_base_segura(self):
        malas = []
        for rel, pg in paginas().items():
            if rel in SIN_CSP:
                continue
            if len(pg.csp) != 1:
                malas.append(f"{rel}: {len(pg.csp)} CSP (debe haber una)")
                continue
            c = parsear_csp(pg.csp[0])
            if c.get("default-src") != ["'self'"]:
                malas.append(f"{rel}: default-src debe ser 'self'")
            if c.get("object-src") != ["'none'"] or c.get("base-uri") != ["'none'"]:
                malas.append(f"{rel}: object-src y base-uri deben ser 'none'")
            if "*" in c.get("script-src", []) or any(s in ("http:", "https:") for d in c.values() for s in d):
                malas.append(f"{rel}: CSP demasiado abierta")
        self.assertEqual(malas[:25], [])

    def test_csp_sin_scripts_en_linea(self):
        malas = []
        for rel, pg in paginas().items():
            if rel in SIN_CSP:
                continue
            c = parsear_csp(pg.csp[0]) if pg.csp else {}
            permite_linea = "'unsafe-inline'" in c.get("script-src", [])
            for s in pg.en_linea:
                if not s.startswith(SCRIPT_LINEA_OK):
                    malas.append(f"{rel}: script en línea no previsto ({s[:50]!r})")
            if not permite_linea:
                # Páginas «estáticas»: la CSP bloquea scripts y manejadores en línea, así que no puede haber ninguno.
                if pg.en_linea:
                    malas.append(f"{rel}: script en línea con CSP que no lo admite")
                malas += [f"{rel}: {a} con CSP que no admite manejadores en línea" for a in sorted(set(pg.on_attrs))]
            if "'unsafe-inline'" not in c.get("style-src", []) and pg.estilos:
                malas.append(f"{rel}: <style> en línea con CSP que no lo admite")
        self.assertEqual(malas[:25], [])

    def test_csp_origenes_declarados(self):
        malas = []
        directiva = {"script": "script-src", "link": "style-src", "img": "img-src", "iframe": "frame-src", "form": "form-action",
                     "source": "media-src", "audio": "media-src", "video": "media-src", "embed": "object-src"}
        for rel, pg in paginas().items():
            if rel in SIN_CSP:
                continue
            c = parsear_csp(pg.csp[0]) if pg.csp else {}
            for tag, url, rel_attr in pg.recursos:
                if not re.match(r"https?://", url):
                    continue
                if tag == "link" and not any(x in rel_attr for x in ("stylesheet", "preload", "modulepreload", "manifest", "icon")):
                    continue   # alternate, me, etc.: no se descargan
                d = "script-src" if (tag == "link" and "modulepreload" in rel_attr) else \
                    "img-src" if (tag == "link" and "icon" in rel_attr) else \
                    "font-src" if (tag == "link" and "preload" in rel_attr) else \
                    "manifest-src" if (tag == "link" and "manifest" in rel_attr) else directiva[tag]
                if not host_cubierto(url, hosts_permitidos(c, d)):
                    malas.append(f"{rel}: <{tag}> carga {url} y la CSP ({d}) no lo declara")
        self.assertEqual(malas[:25], [])

    def test_csp_conexiones_de_js_declaradas(self):
        """Todo fetch/sendBeacon/WebSocket del JS a un origen externo tiene que estar en connect-src de la CSP de la app."""
        app = None
        for rel, pg in paginas().items():
            if pg.csp and "'unsafe-inline'" in parsear_csp(pg.csp[0]).get("script-src", []):
                app = parsear_csp(pg.csp[0])
                break
        self.assertIsNotNone(app, "no encontré ninguna página con la CSP de la app")
        patron = re.compile(r"""(?:fetch|sendBeacon|WebSocket|EventSource|importScripts|XMLHttpRequest\(\)\.open)\(\s*(?:['"][A-Z]+['"]\s*,\s*)?['"`](https?://[^'"`\s]+)""")
        malas = []
        for p in sorted(DIST.glob("*.js")) + sorted(DIST.glob("*/*.js")):
            if "pagefind" in p.parts:
                continue
            for u in patron.findall(p.read_text(encoding="utf-8", errors="replace")):
                if not host_cubierto(u, app.get("connect-src", [])):
                    malas.append(f"{p.relative_to(DIST).as_posix()}: se conecta a {u} y connect-src no lo declara")
        self.assertEqual(malas, [])

    def test_service_worker_y_manifest(self):
        sw = (DIST / "sw.js").read_text(encoding="utf-8")
        faltan = []
        for ruta in set(re.findall(r"""['"`](\.?/[A-Za-z0-9_\-./]+\.[A-Za-z0-9]{2,5})['"`]""", sw)):
            if not (DIST / ruta.lstrip("./")).is_file():
                faltan.append(f"sw.js lista {ruta} y no existe")
        # Quien registra el service worker apunta a un archivo real.
        for p in list(DIST.glob("*.js")) + list(DIST.glob("*/index.html")) + [DIST / "index.html"]:
            for r in re.findall(r"""serviceWorker\s*\.\s*register\(\s*['"]([^'"]+)['"]""", p.read_text(encoding="utf-8", errors="replace")):
                if not (DIST / r.split("?")[0].lstrip("./")).is_file():
                    faltan.append(f"{p.name} registra {r} y no existe")
        mf = json.loads((DIST / "manifest.webmanifest").read_text(encoding="utf-8"))
        refs = [i["src"] for i in mf.get("icons", [])] + [s["src"] for sc in mf.get("screenshots", []) for s in [sc]] + \
               [i["src"] for sc in mf.get("shortcuts", []) for i in sc.get("icons", [])]
        for r in refs:
            if r.startswith("/") and not (DIST / r.lstrip("/")).is_file():
                faltan.append(f"manifest.webmanifest: no existe {r}")
        self.assertTrue(mf.get("icons"), "el manifest no tiene íconos")
        for k in ("start_url", "scope"):
            if mf.get(k, "/").startswith("/") and url_a_archivo(DOMINIO + mf.get(k, "/")) is None:
                faltan.append(f"manifest.webmanifest: {k}={mf[k]} no existe")
        self.assertEqual(faltan, [])


def main():
    global DIST
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("dist", nargs="?", default=str(RAIZ / "dist"))
    ap.add_argument("--solo", choices=("datos", "sitio"))
    ap.add_argument("-v", "--verbose", action="store_true")
    a = ap.parse_args()
    DIST = Path(a.dist).resolve()
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    suite = unittest.TestSuite()
    cargar = unittest.defaultTestLoader.loadTestsFromTestCase
    if a.solo != "sitio":
        suite.addTests(cargar(TestDatos))
    if a.solo != "datos":
        suite.addTests(cargar(TestSitio))
    r = unittest.TextTestRunner(verbosity=2 if a.verbose else 1).run(suite)
    sys.exit(0 if r.wasSuccessful() else 1)


if __name__ == "__main__":
    main()
