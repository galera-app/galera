#!/usr/bin/env python3
"""Control de enlaces de Galera.

Uso:
  python tools/armar.py --salida dist
  python tools/controlar_enlaces.py [dist] [--externos] [--json salida.json]

Por defecto revisa solo enlaces internos (href/src de las paginas de `dist`):
que la ruta exista y que el #ancla este entre los ids de la pagina destino.
Con --externos tambien junta las URL externas de las paginas y de los JSON
(`datos/*.json`, `resumenes/**/*.json`) y las consulta con cortesia: una vez
por URL, HEAD y si falla GET, maximo 4 en paralelo por dominio, con pausa.
Sale con 1 si hay enlaces internos rotos. No esta pensado para el CI.
"""
import json, re, sys, time, threading, collections
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, urljoin, unquote, quote
import urllib.request, urllib.error, ssl
from concurrent.futures import ThreadPoolExecutor

UA = "GaleraLinkCheck/1.0"
HOSTS_PROPIOS = {"galera.com.ar", "www.galera.com.ar", "prueba.galera.com.ar"}
URL_RE = re.compile(r"https?://[^\s\"'<>\]\\]+")
# Redes que piden login (siempre 200 o bloqueo) y nuestro propio R2 (se verifica con subir_descargas.py).
OMITIR = {"www.facebook.com", "es-la.facebook.com", "facebook.com", "m.facebook.com",
          "www.instagram.com", "instagram.com", "twitter.com", "x.com", "www.linkedin.com",
          "descargas.galera.com.ar"}
SALTAR = ("mailto:", "tel:", "javascript:", "data:", "blob:", "sms:", "whatsapp:")


class Pagina(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.enlaces, self.ids = [], set()

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if a.get("id"):
            self.ids.add(a["id"])
        if tag == "a" and a.get("name"):
            self.ids.add(a["name"])
        for k in ("href", "src"):
            if a.get(k) and tag != "base":
                self.enlaces.append((tag, a[k]))
        if tag in ("img", "source") and a.get("srcset"):
            for p in a["srcset"].split(","):
                if p.strip():
                    self.enlaces.append((tag, p.strip().split()[0]))


def url_de(ruta: Path, raiz: Path) -> str:
    rel = ruta.relative_to(raiz).as_posix()
    if rel.endswith("index.html"):
        rel = rel[: -len("index.html")]
    return "/" + rel


def destino(raiz: Path, path: str):
    p = unquote(path).lstrip("/")
    for c in (raiz / p, raiz / p / "index.html", raiz / (p + ".html")):
        if c.is_file():
            return c
    return None


def internos(raiz: Path):
    paginas, ids = {}, {}
    for f in raiz.rglob("*.html"):
        if "pagefind" in f.parts:
            continue
        pp = Pagina()
        try:
            pp.feed(f.read_text(encoding="utf-8", errors="replace"))
        except Exception:
            pass
        paginas[f] = pp
        ids[f] = pp.ids
    rotos, ext, hashes = [], collections.defaultdict(set), []
    for f, pp in paginas.items():
        base = url_de(f, raiz)
        for tag, h in pp.enlaces:
            h = h.strip()
            if not h or h.startswith(SALTAR):
                continue
            if h.startswith("//"):
                h = "https:" + h
            s = urlsplit(h)
            if s.scheme in ("http", "https"):
                if s.netloc.lower() in HOSTS_PROPIOS:
                    s = urlsplit(s._replace(scheme="", netloc="").geturl())
                else:
                    ext[h.split("#")[0]].add(base)
                    continue
            ruta = urljoin(base, s.path) if s.path else base
            d = destino(raiz, ruta)
            if d is None:
                rotos.append((base, h, "ruta inexistente"))
                continue
            if s.fragment and d.suffix == ".html":
                fr = unquote(s.fragment)
                if fr and fr not in ids.get(d, set()):
                    # Las rutas tipo #resumenes de la app son del cliente: se anotan aparte.
                    (hashes if d == raiz / "index.html" else rotos).append(
                        (base, h, "ancla inexistente"))
    return rotos, hashes, ext


def externos_de_json(raiz_repo: Path):
    ext = collections.defaultdict(set)
    archivos = list((raiz_repo / "datos").rglob("*.json")) + list(
        (raiz_repo / "resumenes").rglob("*.json"))
    for f in archivos:
        try:
            t = f.read_text(encoding="utf-8")
        except Exception:
            continue
        for u in URL_RE.findall(t):
            u = u.rstrip(".,;:")
            while u.endswith(")") and u.count("(") < u.count(")"):
                u = u[:-1]  # parentesis de cierre que no es parte de la URL
            if urlsplit(u).netloc.lower() in HOSTS_PROPIOS:
                continue
            ext[u.split("#")[0]].add(f.relative_to(raiz_repo).as_posix())
    return ext


_ctx = ssl.create_default_context()


def pedir(url, metodo):
    url = quote(url, safe=":/?#[]@!$&'()*+,;=%~-._")  # URL con caracteres no ASCII
    req = urllib.request.Request(url, method=metodo, headers={"User-Agent": UA})
    class NoSeguir(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *a, **k):
            return None
    op = urllib.request.build_opener(NoSeguir, urllib.request.HTTPSHandler(context=_ctx))
    try:
        r = op.open(req, timeout=20)
        return r.status, r.headers.get("Location")
    except urllib.error.HTTPError as e:
        return e.code, e.headers.get("Location")


def consultar(url):
    """Sigue hasta 6 redirecciones; devuelve (estado_final, url_final, cadena, error)."""
    cadena, actual = [], url
    for _ in range(7):
        t0 = time.time()
        try:
            st, loc = pedir(actual, "HEAD")
            if st >= 400 or st in (405, 501):
                time.sleep(0.5)
                st, loc = pedir(actual, "GET")
        except Exception as e:
            try:
                time.sleep(0.5)
                st, loc = pedir(actual, "GET")
            except Exception as e2:
                return None, actual, cadena, type(e2).__name__ + ": " + str(e2)[:80]
        lento = time.time() - t0 > 8
        if st in (301, 302, 303, 307, 308) and loc:
            cadena.append((st, actual))
            actual = urljoin(actual, loc)
            continue
        return st, actual, cadena, "lento" if lento else None
    return None, actual, cadena, "demasiadas redirecciones"


def chequear_externos(urls):
    por_dominio = collections.defaultdict(list)
    for u in urls:
        if urlsplit(u).netloc.lower() in OMITIR:
            continue
        por_dominio[urlsplit(u).netloc].append(u)
    res = {}
    def dominio(lst):
        with ThreadPoolExecutor(4) as ex:
            def uno(u):
                r = consultar(u)
                time.sleep(0.4)
                return u, r
            for u, r in ex.map(uno, lst):
                res[u] = r
    ths = [threading.Thread(target=dominio, args=(l,)) for l in por_dominio.values()]
    # a lo sumo 8 dominios a la vez
    for i in range(0, len(ths), 8):
        for t in ths[i:i + 8]:
            t.start()
        for t in ths[i:i + 8]:
            t.join()
    return res


def clasificar(u, r):
    st, fin, cadena, err = r
    if st is None:
        return "roto" if err and ("Name or service" in err or "getaddrinfo" in err or "11001" in err) else "timeout"
    if st in (404, 410):
        return "roto"
    if st >= 400:
        return "error%d" % st
    if cadena:
        a, b = urlsplit(u), urlsplit(fin)
        if (b.path in ("", "/")) and a.path not in ("", "/"):
            return "redirige-a-home"
        return "redirige"
    return "lento" if err == "lento" else "ok"


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    raiz = Path(args[0] if args else "dist").resolve()
    repo = Path(__file__).resolve().parent.parent
    salida_json = None
    if "--json" in sys.argv:
        salida_json = sys.argv[sys.argv.index("--json") + 1]
        args = [a for a in args if a != salida_json]
        raiz = Path(args[0] if args else "dist").resolve()
    rotos, hashes, ext = internos(raiz)
    print(f"Internos: {len(rotos)} rotos; {len(hashes)} anclas de la app (rutas del cliente, solo aviso).")
    for p, h, m in rotos:
        print(f"  ROTO {p} -> {h} ({m})")
    informe = {"internos_rotos": rotos, "anclas_app": hashes}
    if "--externos" in sys.argv:
        for u, fs in externos_de_json(repo).items():
            ext[u] |= fs
        print(f"Externos: {len(ext)} URL unicas. Consultando con cortesia...")
        res = chequear_externos(list(ext))
        print(f"(omitidas por política: {sum(1 for u in ext if urlsplit(u).netloc.lower() in OMITIR)})")
        filas = []
        for u, r in sorted(res.items()):
            c = clasificar(u, r)
            filas.append({"url": u, "clase": c, "estado": r[0], "final": r[1],
                          "cadena": r[2], "error": r[3], "donde": sorted(ext[u])[:5]})
        informe["externos"] = filas
        cuenta = collections.Counter(f["clase"] for f in filas)
        print(dict(cuenta))
        for f in filas:
            if f["clase"] != "ok":
                print(f"  {f['clase']:16} {f['estado']} {f['url']} -> {f['final'] if f['final']!=f['url'] else ''} {f['error'] or ''}")
    if salida_json:
        Path(salida_json).write_text(json.dumps(informe, ensure_ascii=False, indent=1), encoding="utf-8")
    sys.exit(1 if rotos else 0)


if __name__ == "__main__":
    main()
