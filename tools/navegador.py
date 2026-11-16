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
import time
import os
import re
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

RE_ID = re.compile(r"^(?!__proto__$|constructor$|prototype$)[\w.-]{1,60}$")
RE_NOTA = re.compile(r"^\d{1,2}(,\d{1,2})?$")
ESTADOS_VALIDOS = ("pendiente", "cursando", "regular", "aprobada")


def estado_js(estado):
    """Siembra el estado UNA sola vez por pestaña (marca en sessionStorage): una recarga muestra lo que la app guardó,
    no lo que sembramos."""
    return ("try { if (!sessionStorage.getItem('__sembrado')) { localStorage.setItem('cursada.v1', %s); sessionStorage.setItem('__sembrado', '1'); } } catch (e) {}"
            % json.dumps(json.dumps(estado)))


def host_de(url):
    return (urlparse(url or "").hostname or "").lower()


def es_ignorado(url):
    """Tercero que no corre en local, de la lista explícita (compara el host, no una subcadena de la URL)."""
    h = host_de(url)
    return any(h == t or h.endswith("." + t) for t in TERCEROS_IGNORADOS)


def preparar_contexto(browser, origen, siembra=None):
    # service_workers=block: el service worker de producción no debe esconder pedidos fallidos ni servir copias viejas.
    ctx = browser.new_context(service_workers="block", **IPHONE)
    ctx.add_init_script(INIT_JS)
    if siembra is not None:
        ctx.add_init_script(estado_js(siembra))
    host = urlparse(origen).netloc

    def red(route):
        u = urlparse(route.request.url)
        if u.netloc == host or u.scheme in ("data", "blob"):
            route.continue_()
        else:
            route.abort()  # nada sale de la máquina
    ctx.route("**/*", red)
    return ctx


def observar(page, fallas, origen):
    """Engancha los controles comunes. Solo se ignoran los terceros de la lista explícita: un recurso del mismo origen
    (o de un dominio no previsto) que falla hace fallar la pantalla."""
    host = urlparse(origen).netloc

    def consola(msg):
        if msg.type != "error":
            return
        loc = (msg.location or {}).get("url", "")
        if es_ignorado(loc):
            return  # tercero cortado a propósito
        fallas.append(f"consola: {msg.text[:200]}" + (f" ({loc})" if loc else ""))

    def respuesta(r):
        u = urlparse(r.url)
        if u.netloc == host and r.status >= 400:
            fallas.append(f"{r.status} en el mismo origen: {r.url}")

    def fallo_pedido(req):
        u = urlparse(req.url)
        motivo = str(req.failure or "")
        if u.netloc == host:
            if "ABORTED" not in motivo.upper():  # abortado = navegación o recarga en curso
                fallas.append(f"pedido fallido en el mismo origen: {req.url} ({motivo[:80]})")
        elif u.scheme in ("http", "https") and not es_ignorado(req.url):
            fallas.append(f"pedido a un dominio no previsto: {req.url}")

    page.on("console", consola)
    page.on("pageerror", lambda e: fallas.append(f"excepción de página: {str(e)[:200]}"))
    page.on("response", respuesta)
    page.on("requestfailed", fallo_pedido)


def esperar_h1(page, fallas):
    try:
        page.locator("h1").first.wait_for(state="visible", timeout=10000)
        if not page.locator("h1").first.inner_text().strip():
            fallas.append("el h1 está vacío")
    except Exception:
        fallas.append("no muestra su h1")
    page.wait_for_timeout(500)  # que terminen los scripts diferidos


def csp(page, fallas):
    for v in page.evaluate("window.__csp || []"):
        fallas.append(f"violación de CSP: {v}")


def sin_repetidos(xs):
    return list(dict.fromkeys(xs))


def probar_pantalla(browser, nombre, ruta, estado, origen, hay_buscador):
    """Devuelve la lista de fallas de una pantalla (vacía si está bien)."""
    if nombre == "buscar" and not hay_buscador:
        if os.environ.get("GALERA_EXIGIR_BUSCADOR") == "1":
            return ["dist no trae /pagefind/ (el buscador) y se exige"]
        print("      (se saltea: este dist no trae Pagefind; el CI lo exige con GALERA_EXIGIR_BUSCADOR=1)")
        return []
    fallas = []
    ctx = preparar_contexto(browser, origen, estado)
    try:
        page = ctx.new_page()
        observar(page, fallas, origen)
        page.goto(origen + ruta, wait_until="networkidle", timeout=30000)
        esperar_h1(page, fallas)
        csp(page, fallas)
        if estado is not None:
            fallas += comparar_estado(page, estado, None)
    except Exception as e:  # tiempo agotado, navegación rota…
        fallas.append(f"no se pudo abrir: {str(e)[:200]}")
    finally:
        ctx.close()
    return sin_repetidos(fallas)


def esperado_de(entrada, extra):
    """Lo que tiene que sobrevivir de un estado de entrada: cada materia válida (id permitido y valor objeto) con su
    estado y su nota, si eran válidos. `extra` (tools/estados/esperado/<archivo>) suma materias con valores exactos y ausentes."""
    esp, ausentes = {}, []
    mats = entrada.get("materias") if isinstance(entrada.get("materias"), dict) else {}
    for id_, m in mats.items():
        if RE_ID.match(id_) and isinstance(m, dict):
            e = {}
            if m.get("estado") in ESTADOS_VALIDOS:
                e["estado"] = m["estado"]
            nota = m.get("nota")
            if isinstance(nota, str) and RE_NOTA.match(nota):
                e["nota"] = nota
            esp[id_] = e
        elif not isinstance(m, list):  # una lista se acepta como materia vacía (lenient): no se exige ni su presencia ni su ausencia
            ausentes.append(id_)
    for id_, e in ((extra or {}).get("materias") or {}).items():
        esp[id_] = dict(esp.get(id_, {}), **e)
    ausentes += (extra or {}).get("ausentes", [])
    return esp, sorted({a for a in ausentes if a not in esp})


def comparar_estado(page, entrada, extra):
    """Después de que la app normalizó: le pide que guarde (guardar(true), la misma función que usa al editar, sin marcar
    cambio), lee localStorage y compara con lo esperado; recarga y vuelve a comparar (el estado se sembró una sola vez);
    y repite lo que hacen exportar() e importar() (stringify de E, parse, normalizar) sin pasar por el selector de archivos."""
    fallas = []
    esp, ausentes = esperado_de(entrada, extra)
    listas = {k for k, v in (entrada.get("materias") or {}).items() if RE_ID.match(k) and isinstance(v, list)}  # una lista cuenta como materia vacía (lenient)

    def leer():
        return page.evaluate("JSON.parse(localStorage.getItem('cursada.v1') || 'null')")

    def comparar(guardado, cuando):
        if not guardado:
            return [f"{cuando}: no hay estado en localStorage"]
        out, mats = [], guardado.get("materias") or {}
        for id_, e in esp.items():
            if id_ not in mats:
                out.append(f"{cuando}: se perdió la materia {id_}")
                continue
            for k, v in e.items():
                if str(mats[id_].get(k)) != str(v):
                    out.append(f"{cuando}: {id_}.{k} es {mats[id_].get(k)!r} y debía ser {v!r}")
        for a in ausentes:
            if a in mats and page.evaluate("(a) => Object.prototype.hasOwnProperty.call(JSON.parse(localStorage.getItem('cursada.v1')).materias, a)", a):
                out.append(f"{cuando}: quedó la clave {a!r}, que debía descartarse")
        extras = set(mats) - set(esp) - listas
        if extras:
            out.append(f"{cuando}: materias que no estaban: {sorted(extras)}")
        return out

    try:
        page.evaluate("guardar(true)")
    except Exception as e:
        return [f"no pude pedirle a la app que guarde: {str(e)[:120]}"]
    fallas += comparar(leer(), "después de normalizar")
    ida_y_vuelta = page.evaluate(
        "() => { const a = JSON.parse(JSON.stringify(E, null, 1)); const b = normalizar(a);"
        " return JSON.stringify(b) === JSON.stringify(JSON.parse(JSON.stringify(E))); }")
    if not ida_y_vuelta:
        fallas.append("exportar e importar no devuelve lo mismo")
    page.reload(wait_until="networkidle")
    esperar_h1(page, fallas)
    fallas += comparar(leer(), "después de recargar")
    return fallas


def estados_viejos(browser, origen):
    """Cada estado de tools/estados/*.json: se siembra una vez, /carrera/ abre sin errores y lo válido sobrevive."""
    total = []
    for f in sorted(ESTADOS.glob("*.json")):
        est = json.loads(f.read_text(encoding="utf-8"))
        ex = ESTADOS / "esperado" / f.name
        extra = json.loads(ex.read_text(encoding="utf-8")) if ex.is_file() else None
        fallas = []
        ctx = preparar_contexto(browser, origen, est)
        try:
            page = ctx.new_page()
            observar(page, fallas, origen)
            page.goto(origen + "/carrera/", wait_until="networkidle", timeout=30000)
            esperar_h1(page, fallas)
            csp(page, fallas)
            fallas += comparar_estado(page, est, extra)
        except Exception as e:
            fallas.append(f"no se pudo abrir: {str(e)[:200]}")
        finally:
            ctx.close()
        fallas = sin_repetidos(fallas)
        print(f"  {'ok  ' if not fallas else 'FALLA'} estado {f.name}")
        for x in fallas:
            print(f"        - {x}")
        total += [f"{f.name}: {x}" for x in fallas]
    return total


MATERIA_APROBADA = "0911"
# Las esperas van como funciones con argumento: una expresión suelta se evalúa con eval y la CSP del sitio la frena.
EJ_GUARDADO = "id => ((JSON.parse(localStorage.getItem('cursada.v1')).materias[id] || {}).ejemplar || {})"
# Topes de rendimiento del paso 19 (con margen: el CI es más lento que una compu). Se miden en el celular emulado.
TOPE_PIEZA_MS, TOPE_ALBUM_MS = 6000, 8000   # en una compu: ~1,8 s el primer ejemplar (baja datos, fuentes y grabado), ~0,5 s el álbum


def materia_aprobada(browser, origen):
    """Paso 19, punta a punta en el celular: marcar una materia como aprobada desde la carga rápida, la felicitación,
    el ejemplar (post e historia, descarga y un solo re-tiro), el álbum en sus tres vistas, los tiempos y que nada
    se salga de lo ancho de la pantalla."""
    fallas = []
    siembra = {"v": 1, "perfil": "estudiante", "materias": {}, "juego": {"on": True, "aprob": []}}
    ctx = preparar_contexto(browser, origen, siembra)
    ancho = lambda: page.evaluate("[document.documentElement.scrollWidth, innerWidth, (document.querySelector('#dlg[open]') || {}).scrollWidth || 0, (document.querySelector('#dlg[open]') || {}).clientWidth || 0]")
    imagen = lambda: page.evaluate("(() => { const i = document.querySelector('#dlg[open] img.img-comp'); return i ? [i.naturalWidth, i.naturalHeight] : null; })()")

    def vieja():
        """Marca la imagen que hay: la espera siguiente pide una nueva (el diálogo se rearma con cada dibujo)."""
        page.evaluate("document.querySelectorAll('#dlg img.img-comp').forEach(i => i.dataset.vieja = '1')")
        return time.perf_counter()

    def esperar_imagen(w, h, que, t0):
        try:
            page.wait_for_function("([w, h]) => { const i = document.querySelector('#dlg[open] img.img-comp:not([data-vieja])'); return !!i && i.complete && i.naturalWidth === w && i.naturalHeight === h; }", arg=[w, h], timeout=15000)
        except Exception:
            fallas.append(f"{que}: no apareció la imagen de {w} × {h} (hay {imagen()})")
        return (time.perf_counter() - t0) * 1000

    def sin_desborde(que):
        doc, vista, dlg, dlg_vista = ancho()
        if doc > vista + 1 or dlg > dlg_vista + 1:
            fallas.append(f"{que}: se sale de lo ancho (página {doc}/{vista}, diálogo {dlg}/{dlg_vista})")

    def ejemplar():
        return page.evaluate(f"(JSON.parse(localStorage.getItem('cursada.v1')).materias['{MATERIA_APROBADA}'] || {{}}).ejemplar || null")

    try:
        page = ctx.new_page()
        observar(page, fallas, origen)
        page.goto(origen + "/carrera/", wait_until="networkidle", timeout=30000)
        esperar_h1(page, fallas)
        page.get_by_role("button", name="Marcar las materias que ya aprobé").click()
        page.locator(f'[data-f="ra-{MATERIA_APROBADA}"]').check()
        page.wait_for_function(f"id => !!({EJ_GUARDADO})(id).p", arg=MATERIA_APROBADA, timeout=10000)
        ej = ejemplar()
        if not (ej and ej.get("p") and ej.get("f") and ej.get("r") == 0):
            fallas.append(f"el sorteo no quedó guardado con la materia: {ej}")
        page.keyboard.press("Escape")  # cierra la carga rápida: la felicitación espera a que no haya diálogo
        t0 = vieja()
        page.locator("#fe-ej").click(timeout=10000)
        ms = esperar_imagen(1080, 1920, "ejemplar en historia", t0)
        t0 = vieja()
        page.get_by_role("button", name="Post", exact=True).click()
        ms_post = esperar_imagen(1080, 1350, "ejemplar en post", t0)
        sin_desborde("diálogo del ejemplar")
        with page.expect_download(timeout=10000) as d:
            page.get_by_role("button", name="Descargar (.png)").click()
        if d.value.suggested_filename != f"galera-aprobe-{MATERIA_APROBADA}.png":
            fallas.append(f"la descarga se llama {d.value.suggested_filename}")
        # Un solo re-tiro: vuelve a sortear, queda guardado y el botón desaparece.
        page.get_by_role("button", name="Volver a tirar (una sola vez)").click()
        t0 = vieja()
        page.locator('dialog.conf [data-r="1"]').click()
        page.wait_for_function(f"id => ({EJ_GUARDADO})(id).r === 1", arg=MATERIA_APROBADA, timeout=10000)
        esperar_imagen(1080, 1350, "ejemplar después del re-tiro", t0)
        if page.get_by_role("button", name="Volver a tirar (una sola vez)").count():
            fallas.append("después del re-tiro sigue el botón de volver a tirar")
        # Álbum, con la carrera entera aprobada para medir el peor caso.
        page.evaluate("D.plan.materias.forEach(m => { mat(m.id).estado = 'aprobada'; }); guardar(true)")
        t0 = vieja()
        page.get_by_role("button", name="Ver el álbum").click()
        ms_album = esperar_imagen(1080, 1350, "álbum", t0)
        for vista in ("Índice", "Estante", "Grilla"):
            t0 = vieja()
            page.get_by_role("button", name=vista, exact=True).click()
            page.wait_for_function("v => (document.querySelector('#dlg .gl-seg[aria-label=\"Vista\"] .on') || {}).textContent === v", arg=vista, timeout=15000)
            ms_album = max(ms_album, esperar_imagen(1080, 1350, f"álbum, {vista}", t0))
            sin_desborde(f"álbum, {vista}")
        n = page.evaluate("D.plan.materias.filter(m => (JSON.parse(localStorage.getItem('cursada.v1')).materias[m.id] || {}).ejemplar).length")
        total = page.evaluate("D.plan.materias.length")
        if n != total:
            fallas.append(f"el álbum dejó {total - n} aprobadas sin ejemplar")
        print(f"      tiempos: ejemplar {ms:.0f} ms (post {ms_post:.0f}), álbum con {total} materias {ms_album:.0f} ms")
        if max(ms, ms_post) > TOPE_PIEZA_MS:
            fallas.append(f"el ejemplar tardó {max(ms, ms_post):.0f} ms (tope {TOPE_PIEZA_MS})")
        if ms_album > TOPE_ALBUM_MS:
            fallas.append(f"el álbum tardó {ms_album:.0f} ms (tope {TOPE_ALBUM_MS})")
        csp(page, fallas)
    except Exception as e:
        fallas.append(f"se cortó el recorrido: {str(e).splitlines()[0][:200]}")
    finally:
        ctx.close()
    return sin_repetidos(fallas)


def sin_conexion(browser, origen):
    """Paso 27: tras UNA visita, sin red, abren inicio, Mi carrera, Horarios y Calendario (el núcleo que sw.js guarda por adelantado).
    Es el único contexto con el service worker permitido; si el motor no lo ejecuta, la prueba lo dice y falla."""
    fallas = []
    ctx = browser.new_context(service_workers="allow", **IPHONE)
    ctx.add_init_script(INIT_JS)
    ctx.add_init_script(estado_js(ESTADO_EJEMPLO))
    host = urlparse(origen).netloc
    ctx.route("**/*", lambda route: route.continue_() if urlparse(route.request.url).netloc == host or urlparse(route.request.url).scheme in ("data", "blob") else route.abort())
    try:
        page = ctx.new_page()
        errores = []
        page.on("pageerror", lambda e: errores.append(f"excepción de página: {str(e)[:200]}"))
        page.goto(origen + "/", wait_until="networkidle", timeout=30000)
        esperar_h1(page, fallas)
        if not page.evaluate("navigator.serviceWorker.ready.then(() => true)"):
            return ["el service worker no quedó activo"]
        page.wait_for_timeout(500)
        guardadas = page.evaluate("caches.keys().then(ks => ks.filter(k => k.startsWith('galera-nucleo-')))")
        if len(guardadas) != 1:
            fallas.append(f"se esperaba un único caché del núcleo y hay: {guardadas}")
        ctx.set_offline(True)
        for nombre, ruta in (("inicio", "/"), ("Mi carrera", "/carrera/"), ("Horarios", "/horarios/"), ("Calendario", "/calendario/")):
            errores.clear()
            try:
                page.goto(origen + ruta, wait_until="load", timeout=30000)
                page.locator("h1").first.wait_for(state="visible", timeout=10000)
                page.wait_for_function("!document.querySelector('#main .cargando')", timeout=10000)
                page.wait_for_timeout(500)
                texto = page.locator("#main").inner_text()
                if "No pude cargar" in texto or "No se pudo cargar" in texto:
                    fallas.append(f"sin conexión · {nombre}: muestra un error de carga")
                if ruta == "/carrera/" and "Actividad Editorial" not in texto:
                    fallas.append("sin conexión · Mi carrera: no muestra las materias del plan")
            except Exception as e:
                fallas.append(f"sin conexión · {nombre}: no abrió ({str(e)[:160]})")
            fallas += [f"sin conexión · {nombre}: {x}" for x in errores]
    except Exception as e:
        fallas.append(f"prueba sin conexión: {str(e)[:200]}")
    finally:
        ctx.close()
    return sin_repetidos(fallas)


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
            fallas = materia_aprobada(browser, origen)
            print(f"  {'ok  ' if not fallas else 'FALLA'} materia aprobada (paso 19)")
            for x in fallas:
                print(f"        - {x}")
            todas += [f"{m} · materia aprobada: {x}" for x in fallas]
            fallas = sin_conexion(browser, origen)
            print(f"  {'ok  ' if not fallas else 'FALLA'} sin conexión (paso 27)")
            for x in fallas:
                print(f"        - {x}")
            todas += [f"{m} · sin conexión: {x}" for x in fallas]
            if a.estados:
                todas += [f"{m} · {x}" for x in estados_viejos(browser, origen)]
            browser.close()
    srv.shutdown()
    print(f"\n{'FALLARON ' + str(len(todas)) + ' controles' if todas else 'navegador ok'}")
    return 1 if todas else 0


if __name__ == "__main__":
    sys.exit(main())
