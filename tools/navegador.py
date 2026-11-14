"""Pruebas en navegador real (Playwright): abre 8 pantallas con tamaño de iPhone (390 x 844, táctil) y falla si hay
errores de consola, excepciones de página, violaciones de CSP, pedidos al mismo origen con 404 o una pantalla sin su <h1>.

Corre contra el sitio ARMADO (dist/), no contra el fuente:
    python tools/armar.py --salida dist
    python tools/navegador.py --navegador chromium            (o webkit, o todos)
    python tools/navegador.py --navegador webkit --dist otra/ruta

Requiere:  pip install playwright  y  python -m playwright install --with-deps chromium webkit  (el CI lo hace).
Sin pytest: es un script que sale con 1 si algo falla.

Lo de terceros que no corre en local se ignora a propósito: Google Analytics / Tag Manager, el buzón de Apps Script
y las descargas del compilador de Typst. Esos pedidos se cortan en la red (no salen de la máquina) y su fallo no cuenta.
"""
import argparse
import http.server
import json
import os
import socketserver
import sys
import threading
from pathlib import Path
from urllib.parse import urlparse

RAIZ = Path(__file__).resolve().parent.parent
ESTADOS = Path(__file__).resolve().parent / "estados"

# Terceros que no corren en local (ver arriba). Todo lo que NO sea el mismo origen y no esté acá se corta igual,
# pero un fallo de un dominio desconocido sí se cuenta (para enterarnos si aparece un tercero nuevo).
TERCEROS_IGNORADOS = ("googletagmanager.com", "google-analytics.com", "script.google.com", "script.googleusercontent.com",
                      "descargas.galera.com.ar")

IPHONE = {"viewport": {"width": 390, "height": 844}, "device_scale_factor": 3, "has_touch": True, "is_mobile": True}

# Estado de ejemplo de «Mi carrera» (clave cursada.v1). Forma validada por normalizar() de app.js: ids de datos/edicion.json,
# estados de ESTADOS, notas «8» o «7,5», fechas AAAA-MM-DD, exámenes con tipo/fecha/hora.
ESTADO_EJEMPLO = {
    "v": 1, "carrera": "edicion", "perfil": "estudiante", "vioAyuda": True,
    "materias": {
        "ipc": {"estado": "aprobada", "nota": "8", "aprobada": "2025-07-15"},
        "icse": {"estado": "aprobada", "nota": "7,5", "aprobada": "2025-12-10"},
        "0902": {"estado": "cursando", "examenes": [{"id": "e1", "tipo": "Parcial", "fecha": "2026-10-05", "hora": "18:00", "detalle": "1.er parcial", "nota": ""}]},
        "0913": {"estado": "regular", "aplazos": ["1"]},
        "0914": {"estado": "pendiente"},
    },
    "horarios": {}, "leidos": {"0911/e1-clases": "2026-09-01"}, "practica": {},
    "copia": "2026-09-01", "modif": "2026-09-02", "primera": "2026-03-01", "visto": "2026-09-02",
}


class Manejador(http.server.SimpleHTTPRequestHandler):
    """Sirve dist/ como Cloudflare Pages: /x/ -> /x/index.html, /x -> /x.html o /x/index.html."""

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

    def log_message(self, *a):  # sin ruido
        pass


def servir(dist):
    class S(socketserver.ThreadingMixIn, http.server.HTTPServer):
        daemon_threads = True
    S.allow_reuse_address = True
    srv = S(("127.0.0.1", 0), lambda *a, **k: Manejador(*a, directory=str(dist), **k))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f"http://127.0.0.1:{srv.server_address[1]}"


def apunte_de_r(dist):
    """Un apunte publicado de /r/: el primero por orden alfabético (estable entre corridas)."""
    for carpeta in sorted((dist / "r").iterdir()):
        if carpeta.is_dir():
            for f in sorted(carpeta.glob("*.html")):
                if f.name != "index.html":
                    return f"/r/{carpeta.name}/{f.name}"
    raise SystemExit("dist/r no tiene ningún apunte")


def pantallas(dist):
    # (nombre, ruta, estado de localStorage o None)
    return [
        ("inicio", "/", None),
        ("mi carrera con datos", "/carrera/", ESTADO_EJEMPLO),
        ("horarios", "/horarios/", None),
        ("calendario", "/calendario/", None),
        ("apunte de /r/", apunte_de_r(dist), None),
        ("simulador de escandallo", "/simuladores/escandallo.html", None),
        ("directorio", "/directorio/", None),
        ("buscar", "/buscar/", None),
    ]


INIT_JS = """
window.__csp = [];
document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI));
"""


def estado_js(estado):
    return "try { localStorage.setItem('cursada.v1', %s); } catch (e) {}" % json.dumps(json.dumps(estado))


def probar_pantalla(browser, nombre, ruta, estado, origen, hay_buscador):
    """Devuelve la lista de fallas de una pantalla (vacía si está bien)."""
    if nombre == "buscar" and not hay_buscador:
        if os.environ.get("GALERA_EXIGIR_BUSCADOR") == "1":
            return ["dist no trae /pagefind/ (el buscador) y se exige"]
        print("      (se saltea: este dist no trae Pagefind; el CI lo exige con GALERA_EXIGIR_BUSCADOR=1)")
        return []
    fallas = []
    # service_workers=block: el service worker de producción no debe esconder pedidos fallidos ni servir copias viejas.
    ctx = browser.new_context(service_workers="block", **IPHONE)
    try:
        ctx.add_init_script(INIT_JS)
        if estado is not None:
            ctx.add_init_script(estado_js(estado))
        host = urlparse(origen).netloc

        def red(route):
            u = urlparse(route.request.url)
            if u.netloc == host or u.scheme in ("data", "blob"):
                route.continue_()
            else:
                route.abort()  # nada sale de la máquina
        ctx.route("**/*", red)

        page = ctx.new_page()

        def ignorado(url):
            return any(t in (url or "") for t in TERCEROS_IGNORADOS)

        def consola(msg):
            if msg.type != "error":
                return
            loc = (msg.location or {}).get("url", "")
            # «Failed to load resource» de un tercero cortado a propósito: no cuenta.
            if ignorado(loc) or (loc and urlparse(loc).netloc != host and "Failed to load resource" in msg.text):
                if not ignorado(loc):
                    fallas.append(f"consola: pedido a un dominio no previsto ({loc}): {msg.text[:120]}")
                return
            fallas.append(f"consola: {msg.text[:200]}")

        def respuesta(r):
            if urlparse(r.url).netloc == host and r.status == 404:
                fallas.append(f"404 en el mismo origen: {r.url}")

        page.on("console", consola)
        page.on("pageerror", lambda e: fallas.append(f"excepción de página: {str(e)[:200]}"))
        page.on("response", respuesta)

        page.goto(origen + ruta, wait_until="networkidle", timeout=30000)
        try:
            page.locator("h1").first.wait_for(state="visible", timeout=10000)
            if not page.locator("h1").first.inner_text().strip():
                fallas.append("el h1 está vacío")
        except Exception:
            fallas.append("no muestra su h1")
        page.wait_for_timeout(500)  # que terminen los scripts diferidos
        for v in page.evaluate("window.__csp || []"):
            fallas.append(f"violación de CSP: {v}")
        if estado is not None:
            guardado = page.evaluate("JSON.parse(localStorage.getItem('cursada.v1') || 'null')")
            if not guardado or set(estado["materias"]) - set(guardado.get("materias", {})):
                fallas.append("la app perdió materias del estado de ejemplo")
    except Exception as e:  # tiempo agotado, navegación rota…
        fallas.append(f"no se pudo abrir: {str(e)[:200]}")
    finally:
        ctx.close()
    return fallas


def estados_viejos(browser, origen):
    """Cada estado de tools/estados/*.json cargado en localStorage: /carrera/ tiene que abrir sin errores."""
    total = []
    for f in sorted(ESTADOS.glob("*.json")):
        est = json.loads(f.read_text(encoding="utf-8"))
        fallas = _con_estado_crudo(browser, f.name, est, origen)
        print(f"  {'ok  ' if not fallas else 'FALLA'} estado {f.name}")
        for x in fallas:
            print(f"        - {x}")
        total += [f"{f.name}: {x}" for x in fallas]
    return total


def _con_estado_crudo(browser, nombre, crudo, origen):
    fallas = []
    ctx = browser.new_context(service_workers="block", **IPHONE)
    try:
        ctx.add_init_script(INIT_JS)
        ctx.add_init_script("try { localStorage.setItem('cursada.v1', %s); } catch (e) {}" % json.dumps(json.dumps(crudo)))
        host = urlparse(origen).netloc
        ctx.route("**/*", lambda r: r.continue_() if urlparse(r.request.url).netloc == host else r.abort())
        page = ctx.new_page()
        page.on("pageerror", lambda e: fallas.append(f"excepción de página: {str(e)[:200]}"))
        page.on("console", lambda m: m.type == "error" and "Failed to load resource" not in m.text and fallas.append(f"consola: {m.text[:200]}"))
        page.goto(origen + "/carrera/", wait_until="networkidle", timeout=30000)
        try:
            page.locator("h1").first.wait_for(state="visible", timeout=10000)
        except Exception:
            fallas.append("no muestra su h1")
        page.wait_for_timeout(500)
        fallas += [f"violación de CSP: {v}" for v in page.evaluate("window.__csp || []")]
    except Exception as e:
        fallas.append(f"no se pudo abrir: {str(e)[:200]}")
    finally:
        ctx.close()
    return fallas


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--navegador", choices=["chromium", "webkit", "todos"], default="chromium")
    ap.add_argument("--dist", default=str(RAIZ / "dist"))
    ap.add_argument("--estados", action="store_true", help="además, abrir /carrera/ con cada estado de tools/estados/")
    a = ap.parse_args()
    dist = Path(a.dist).resolve()
    if not (dist / "index.html").is_file():
        sys.exit(f"{dist} no es un sitio armado: python tools/armar.py --salida dist")
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        sys.exit("Falta Playwright: pip install playwright && python -m playwright install chromium webkit")

    srv, origen = servir(dist)
    hay_buscador = (dist / "pagefind" / "pagefind.js").is_file()
    motores = ["chromium", "webkit"] if a.navegador == "todos" else [a.navegador]
    todas = []
    with sync_playwright() as p:
        for m in motores:
            print(f"== {m} · iPhone 390 x 844 · {origen}")
            try:
                browser = getattr(p, m).launch()
            except Exception as e:
                print(f"  no se pudo lanzar {m}: {str(e).splitlines()[0]}")
                todas.append(f"{m}: no se pudo lanzar")
                continue
            for nombre, ruta, estado in pantallas(dist):
                fallas = probar_pantalla(browser, nombre, ruta, estado, origen, hay_buscador)
                print(f"  {'ok  ' if not fallas else 'FALLA'} {nombre} ({ruta})")
                for x in fallas:
                    print(f"        - {x}")
                todas += [f"{m} · {nombre}: {x}" for x in fallas]
            if a.estados:
                todas += [f"{m} · {x}" for x in estados_viejos(browser, origen)]
            browser.close()
    srv.shutdown()
    print(f"\n{'FALLARON ' + str(len(todas)) + ' controles' if todas else 'navegador ok'}")
    return 1 if todas else 0


if __name__ == "__main__":
    sys.exit(main())
