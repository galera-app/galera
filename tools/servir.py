"""Servidor de dist/ para las pruebas (navegador, recorridos, rendimiento).

Se comporta como Cloudflare Pages: /x/ -> /x/index.html, /x -> /x.html o /x/index.html. Y comprime con gzip el HTML,
CSS, JS, JSON y SVG cuando el navegador lo pide, como el sitio real: sin esto Lighthouse mide un inicio mucho peor
que el de producción (el 9/11 dio 64 sin gzip y 89 con gzip; `python -m http.server` no comprime).
"""
import gzip
import http.server
import socketserver
import threading
from pathlib import Path
from urllib.parse import urlparse

COMPRIMIBLES = (".html", ".css", ".js", ".mjs", ".json", ".svg", ".webmanifest", ".xml", ".txt")
MINIMO_GZIP = 512  # bytes: por debajo no vale la pena


def quiere_gzip(cabecera):
    """True si Accept-Encoding admite gzip (o *) y no lo prohíbe con q=0."""
    for parte in (cabecera or "").lower().split(","):
        nombre, _, q = parte.partition(";")
        if nombre.strip() in ("gzip", "*"):
            q = q.replace(" ", "")
            return q not in ("q=0", "q=0.0", "q=0.00", "q=0.000")
    return False


def comprimible(ruta):
    return str(ruta).lower().endswith(COMPRIMIBLES)


class Manejador(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        p = Path(super().translate_path(path))
        if p.exists():
            return str(p)
        base = Path(self.directory)
        rel = urlparse(path).path.strip("/")
        for cand in (base / (rel + ".html"), base / rel / "index.html"):
            if cand.is_file():
                return str(cand)
        return str(p)

    def send_head(self):
        ruta = Path(self.translate_path(self.path))
        if (self.command in ("GET", "HEAD") and ruta.is_file() and comprimible(ruta)
                and quiere_gzip(self.headers.get("Accept-Encoding")) and not self.headers.get("Range")):
            datos = ruta.read_bytes()
            if len(datos) >= MINIMO_GZIP:
                cuerpo = gzip.compress(datos, 6)
                self.send_response(200)
                self.send_header("Content-Type", self.guess_type(str(ruta)))
                self.send_header("Content-Encoding", "gzip")
                self.send_header("Vary", "Accept-Encoding")
                self.send_header("Content-Length", str(len(cuerpo)))
                self.end_headers()
                import io
                return io.BytesIO(cuerpo)
        return super().send_head()

    def log_message(self, *a):  # sin ruido
        pass


def servir(dist):
    class S(socketserver.ThreadingMixIn, http.server.HTTPServer):
        daemon_threads = True
    S.allow_reuse_address = True
    S.handle_error = lambda self, request, client_address: None  # el navegador corta conexiones al cerrar: no es un error
    srv = S(("127.0.0.1", 0), lambda *a, **k: Manejador(*a, directory=str(dist), **k))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f"http://127.0.0.1:{srv.server_address[1]}"
