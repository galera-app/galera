"""Prueba de humo: las pantallas clave responden y sus CSS y JS locales existen.
Uso: python tools/humo.py https://galera.com.ar"""
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

RUTAS = ["/", "/legal/", "/glosario/", "/biblioteca/", "/simuladores/",
         "/datos/indice.json", "/datos/novedades.json", "/sitemap.xml"]


def pedir(url):
    req = urllib.request.Request(url, headers={"User-Agent": "galera-humo"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, ""
    except urllib.error.URLError as e:
        return str(e.reason), ""


def main(base):
    fallas = []
    for ruta in RUTAS:
        estado, cuerpo = pedir(base + ruta)
        if estado != 200:
            fallas.append(f"{ruta}: {estado}")
        elif "Directory listing for" in cuerpo:  # http.server del CI lista carpetas sin index.html; en producción son 404
            fallas.append(f"{ruta}: sin index.html")
        for rec in re.findall(r'(?:src|href)="([^"#]+\.(?:js|css)(?:\?[^"]*)?)"', cuerpo):
            url = urllib.parse.urljoin(base + ruta, rec)
            if url.startswith(base):
                estado, _ = pedir(url)
                if estado != 200:
                    fallas.append(f"{ruta} pide {rec}: {estado}")
    fallas = sorted(set(fallas))
    print("\n".join(fallas) or f"humo ok: {len(RUTAS)} rutas en {base}")
    return 1 if fallas else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1].rstrip("/")))
