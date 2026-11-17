#!/usr/bin/env python3
"""Recorridos punta a punta en navegador real (Playwright, paso 20 del plan).

Dos cosas, sobre el sitio ARMADO (dist/):
  1. Los 7 recorridos de riesgo (cargar y reabrir, exportar, borrar todo, importar, traspaso por link, compartir y consentimiento
     de Analytics), en Chromium y en WebKit, con las mismas condiciones de falla de navegador.py (consola, excepción, CSP, 404 propio).
  2. Un trinquete de acciones: cada acción registrada en ACC (`controlar_acciones.py --listar`) tiene que ejecutarse al menos una vez
     (en los recorridos o en el barrido) o figurar en tools/acciones-sin-recorrido.json. La lista solo se achica.

Cómo se sabe qué acción se ejecutó sin tocar app.js: un init script escucha los mismos 8 eventos que el despachador de app.js
(click→clic, change→cambio, input→entra, keydown→tecla, submit→envia, focusin→foco, toggle→abre, error→falla) y lee data-<evento>
con la misma regla que correr(): los cinco primeros en el elemento y sus ancestros, los otros tres solo en el elemento.

    python tools/armar.py --salida dist
    python tools/recorridos.py --navegador chromium|webkit|todos [--dist dist] [--actualizar] [--sin-barrido]
    python tools/recorridos.py --autoprueba        (casos de la lógica del trinquete; el CI la corre antes)

El trinquete se evalúa solo en Chromium (el barrido corre solo ahí); WebKit corre los recorridos de riesgo.
"""
import argparse
import json
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from urllib.parse import urlparse

sys.path.insert(0, str(Path(__file__).resolve().parent))
import navegador as N  # noqa: E402  (se reusa: servir, preparar_contexto, observar, IPHONE, ESTADO_EJEMPLO, comparar_estado…)

RAIZ = N.RAIZ
LISTA = Path(__file__).resolve().parent / "acciones-sin-recorrido.json"
# Rutas que abre algún recorrido o el barrido (lo que mapa_pruebas.py usa como nivel «recorrido»). Se escribe con --rutas.
VISITADAS = set()


def ir(page, ses, ruta):
    VISITADAS.add(ruta.split("#", 1)[0])
    page.goto(ses.origen + ruta, wait_until="networkidle", timeout=30000)
TOPE_SEGUNDOS = 4 * 60          # por navegador: si se pasa, se recorta el barrido, no los recorridos de riesgo
CONSENTIMIENTO = "fc-consent"

# Acciones que el barrido NO toca: borran, recargan, imprimen, descargan o sacan del sitio.
NO_TOCAR = {
    "borrarTodo": "borra todo lo que cargó la persona (lo cubre el recorrido 3)",
    "borrarTodoYa": "borra sin preguntar",
    "recargar": "recarga la página y corta el barrido",
    "imprimirPagina": "abre el diálogo de imprimir del navegador",
    "imprimir": "abre el diálogo de imprimir del navegador",
    "exportar": "descarga (lo cubre el recorrido 2)",
    "exportarCerrar": "descarga y cierra",
    "exportarIcs": "descarga un archivo",
    "aceptarTraspaso": "reemplaza los datos (lo cubre el recorrido 5)",
    # Error conocido del sitio que el barrido encontró (se arregla aparte; al arreglarlo, sacar estas tres y correr --actualizar):
    # en el comparador de escandallo, «Vaciar», «Quitar» y «＋ Título» dejan títulos vacíos y vComparador tira un TypeError
    # (n2 → cmpPasos con un valor indefinido) que rompe el dibujo de la pantalla.
    "vaciarCmp": "error conocido: el comparador se rompe con títulos vacíos",
    "quitarCmp": "error conocido: el comparador se rompe con títulos vacíos",
    "sumarCmp": "error conocido: el comparador se rompe con títulos vacíos",
}

TRACKER_JS = """
(() => {
  const EVENTOS = [['click', 'clic', true], ['change', 'cambio', true], ['input', 'entra', true], ['keydown', 'tecla', true], ['submit', 'envia', true],
    ['focusin', 'foco', false], ['toggle', 'abre', false], ['error', 'falla', false]];
  const avisar = n => { try { window.__galeraAccion(n); } catch (e) { } };
  EVENTOS.forEach(([tipo, at, burbujea]) => document.addEventListener(tipo, e => {
    if (!burbujea) { const el = e.target; if (el && el.nodeType === 1 && el.hasAttribute('data-' + at)) avisar(el.getAttribute('data-' + at)); return; }
    for (let el = e.target; el && el.nodeType === 1; el = el.parentElement) if (el.hasAttribute('data-' + at)) avisar(el.getAttribute('data-' + at));
  }, true));
})();
"""

# Registra lo que el sitio le pide al sistema para compartir (no abre nada). `sin_share` lo deja sin navigator.share.
COMPARTIR_JS = """
window.__comp = { share: [], clip: [] };
// Que el sitio use el menú nativo también en WebKit: compartir() pide (pointer: coarse).
const __mm = window.matchMedia.bind(window);
window.matchMedia = (q) => /pointer:\\s*coarse/.test(q) ? { matches: true, media: q, onchange: null, addEventListener() { }, removeEventListener() { }, addListener() { }, removeListener() { } } : __mm(q);
try { Object.defineProperty(navigator, 'share', { configurable: true, value: SIN_SHARE ? undefined : (d) => { window.__comp.share.push(d); return Promise.resolve(); } }); } catch (e) { }
try { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (t) => { window.__comp.clip.push(String(t)); return Promise.resolve(); } } }); } catch (e) { }
"""


# ---------- lógica pura del trinquete (con sus casos en --autoprueba) ----------

def evaluar_trinquete(registradas, vistas, lista):
    """Devuelve las fallas del trinquete. `registradas`, `vistas` y `lista`: colecciones de nombres de acción."""
    registradas, vistas, lista = set(registradas), set(vistas), set(lista)
    fallas = []
    for a in sorted(registradas - vistas - lista):
        fallas.append(f"la acción «{a}» está registrada y ningún recorrido la ejecutó: sumale un recorrido (o, si no se puede, anotala en tools/acciones-sin-recorrido.json)")
    for a in sorted((lista & vistas) & registradas):
        fallas.append(f"la acción «{a}» ya se ejecuta en los recorridos: sacala de tools/acciones-sin-recorrido.json (la lista solo se achica)")
    for a in sorted(lista - registradas):
        fallas.append(f"tools/acciones-sin-recorrido.json nombra «{a}», que ya no existe en ACC: sacala")
    return fallas


def lista_nueva(registradas, vistas, lista_actual):
    """Lo que `--actualizar` escribe: las acciones sin recorrido, ordenadas. Solo puede achicarse: si habría que sumar una, es None."""
    sin = set(registradas) - set(vistas)
    if lista_actual is not None and not sin <= set(lista_actual):
        return None
    return sorted(sin)


def autoprueba():
    reg = {"a", "b", "c", "d"}
    casos = [
        ("todo cubierto", evaluar_trinquete(reg, {"a", "b", "c", "d"}, []), 0),
        ("lista que cubre lo no visto", evaluar_trinquete(reg, {"a", "b"}, ["c", "d"]), 0),
        ("acción nueva sin recorrido", evaluar_trinquete(reg, {"a", "b"}, ["c"]), 1),
        ("una de la lista sí se ejecutó", evaluar_trinquete(reg, {"a", "b", "c"}, ["c", "d"]), 1),
        ("la lista nombra una que ya no existe", evaluar_trinquete(reg, {"a", "b", "c", "d"}, ["zzz"]), 1),
        ("una vista que no está registrada no cuenta", evaluar_trinquete(reg, {"a", "b", "c", "d", "x"}, []), 0),
    ]
    mal = 0
    for nombre, fallas, esperadas in casos:
        ok = len(fallas) == esperadas
        mal += not ok
        print(f"  {'ok  ' if ok else 'FALLA'} {nombre} ({len(fallas)} fallas, esperaba {esperadas})")
    # --actualizar: solo se achica
    for nombre, res, esperado in [
        ("actualizar achica", lista_nueva(reg, {"a", "b", "c"}, ["c", "d"]), ["d"]),
        ("actualizar no suma", lista_nueva(reg, {"a"}, ["d"]), None),
        ("actualizar crea la primera vez", lista_nueva(reg, {"a", "b"}, None), ["c", "d"]),
    ]:
        ok = res == esperado
        mal += not ok
        print(f"  {'ok  ' if ok else 'FALLA'} {nombre}")
    print("autoprueba ok" if not mal else f"autoprueba: {mal} casos mal")
    return 1 if mal else 0


def acciones_registradas():
    out = subprocess.run([sys.executable, str(Path(__file__).resolve().parent / "controlar_acciones.py"), "--listar"],
                         capture_output=True, text=True, encoding="utf-8", cwd=str(RAIZ), check=True).stdout
    return set(json.loads(out))


# ---------- contexto con seguimiento ----------

class Sesion:
    """Un navegador, un origen y el conjunto de acciones vistas (se acumula entre contextos y páginas)."""

    def __init__(self, browser, origen):
        self.browser, self.origen = browser, origen
        self.vistas = set()

    def contexto(self, siembra=None, consentimiento="denied", init=None, extra_init=()):
        """Contexto del celular de navegador.py + el rastreador de acciones. `consentimiento`: lo que ya eligió en el banner de
        cookies (None = no eligió, sale el banner)."""
        ctx = N.preparar_contexto(self.browser, self.origen, siembra)
        ctx.expose_binding("__galeraAccion", lambda source, nombre: self.vistas.add(nombre))
        ctx.add_init_script(TRACKER_JS)
        if consentimiento:
            ctx.add_init_script("try { localStorage.setItem('%s', '%s'); } catch (e) { }" % (CONSENTIMIENTO, consentimiento))
        for js in extra_init:
            ctx.add_init_script(js)
        return ctx


def correr_recorrido(nombre, fn, ses):
    """Corre un recorrido, devuelve sus fallas. Cualquier excepción corta el recorrido y cuenta como falla."""
    fallas = []
    t0 = time.perf_counter()
    try:
        fn(ses, fallas)
    except Exception as e:  # tiempo agotado, selector que no aparece…
        fallas.append(f"se cortó el recorrido: {(str(e).splitlines() or [repr(e)])[0][:220]}")
    print(f"  {'ok  ' if not fallas else 'FALLA'} {nombre} ({time.perf_counter() - t0:.1f} s)")
    fallas = N.sin_repetidos(fallas)
    for x in fallas:
        print(f"        - {x}")
    return fallas


def abrir_carrera(ses, fallas, siembra, **kw):
    ctx = ses.contexto(siembra, **kw)
    page = ctx.new_page()
    N.observar(page, fallas, ses.origen)
    ir(page, ses, "/carrera/")
    N.esperar_h1(page, fallas)
    return ctx, page


VACIO = {"v": 1, "perfil": "estudiante", "materias": {}}
MATERIA, NOTA, NOMBRE = "0911", "9", "Corrección de Estilo"
ESPERADO = {"materias": {MATERIA: {"estado": "aprobada", "nota": NOTA}}}


def guardado(page):
    return page.evaluate("JSON.parse(localStorage.getItem('cursada.v1') || 'null')")


def tiene_materia(est):
    m = ((est or {}).get("materias") or {}).get(MATERIA) or {}
    return m.get("estado") == "aprobada" and str(m.get("nota")) == NOTA


def cargar_materia(page, fallas):
    """Desde la pantalla: «Marcar las materias que ya aprobé» → casilla de la materia → su nota."""
    page.get_by_role("button", name="Marcar las materias que ya aprobé").click()
    page.locator(f'[data-f="ra-{MATERIA}"]').check()
    page.keyboard.press("Escape")
    # En el celular la nota de la lista está escondida: se carga desde «Cargar nota», que abre la ficha de la materia.
    page.locator(f"button[data-clic='abrirMateria'][data-clic-a='[\"{MATERIA}\"]']").filter(has_text="Cargar nota").click()
    campo = page.locator('#dlg[open] input[data-cambio="setNota"]')
    campo.fill(NOTA)
    campo.blur()  # dispara el change (más firme que Tab en WebKit)
    espera = "([id, n]) => { const m = (JSON.parse(localStorage.getItem('cursada.v1')) || {}).materias || {}; return !!m[id] && String(m[id].nota) === n; }"
    try:
        page.wait_for_function(espera, arg=[MATERIA, NOTA], timeout=2500)
    except Exception:
        campo.dispatch_event("change")   # el navegador no lo mandó con el blur
    page.keyboard.press("Escape")
    page.wait_for_function("([id, n]) => { const m = (JSON.parse(localStorage.getItem('cursada.v1')) || {}).materias || {}; return !!m[id] && String(m[id].nota) === n; }",
                           arg=[MATERIA, NOTA], timeout=10000)


def abrir_datos(page):
    """El diálogo «Tus datos» (exportar, cargar una copia, pasar a otro dispositivo, borrar todo)."""
    page.get_by_role("button", name="Tus datos", exact=True).click()
    page.locator("#dlg[open]").wait_for(state="visible", timeout=10000)


def descargar_json(page, boton):
    with page.expect_download(timeout=15000) as d:
        boton.click()
    return d.value.suggested_filename, Path(d.value.path()).read_text(encoding="utf-8")


# ---------- los 7 recorridos de riesgo ----------

def r1_cargar_y_reabrir(ses, fallas):
    ctx, page = abrir_carrera(ses, fallas, VACIO)
    try:
        cargar_materia(page, fallas)
        if not tiene_materia(guardado(page)):
            fallas.append(f"cursada.v1 no tiene {MATERIA} aprobada con nota {NOTA} después de cargarla")
        page.reload(wait_until="networkidle")
        N.esperar_h1(page, fallas)
        if not tiene_materia(guardado(page)):
            fallas.append("después de recargar, cursada.v1 perdió la materia o la nota")
        valor = page.locator(f'input[aria-label="Nota de {NOMBRE}"]').input_value()
        if valor != NOTA:
            fallas.append(f"después de recargar, la pantalla muestra la nota {valor!r} y debía ser {NOTA!r}")
        N.csp(page, fallas)
    finally:
        ctx.close()


def r2_exportar(ses, fallas, salida=None):
    ctx, page = abrir_carrera(ses, fallas, VACIO)
    try:
        cargar_materia(page, fallas)
        nombre, texto = descargar_json(page, page.get_by_role("button", name="Guardar una copia").first)
        try:
            copia = json.loads(texto)
        except ValueError:
            return fallas.append(f"la descarga {nombre} no es JSON")
        if not nombre.endswith(".json"):
            fallas.append(f"la descarga se llama {nombre}")
        if not tiene_materia(copia):
            fallas.append("la copia descargada no trae la materia cargada con su nota")
        if salida is not None:
            salida["texto"] = texto
        N.csp(page, fallas)
    finally:
        ctx.close()


def r3_borrar_todo(ses, fallas):
    ctx, page = abrir_carrera(ses, fallas, VACIO)
    try:
        cargar_materia(page, fallas)
        abrir_datos(page)
        page.get_by_role("button", name="Borrar todo lo que cargué").click()
        page.locator('dialog.conf [data-r="1"]').click()   # confirmar() es un diálogo propio
        page.wait_for_function("() => { const m = (JSON.parse(localStorage.getItem('cursada.v1')) || {}).materias || {}; return Object.keys(m).length === 0; }", timeout=10000)
        est = guardado(page)
        if est.get("materias") or est.get("horarios"):
            fallas.append(f"después de borrar todo quedó: {list((est.get('materias') or {}))}")
        if page.locator(f'input[aria-label="Nota de {NOMBRE}"]').input_value() != "":
            fallas.append("después de borrar todo la pantalla sigue mostrando la nota")
        page.reload(wait_until="networkidle")
        N.esperar_h1(page, fallas)
        if (guardado(page) or {}).get("materias"):
            fallas.append("después de borrar todo y recargar volvieron materias")
        N.csp(page, fallas)
    finally:
        ctx.close()


def r4_importar(ses, fallas):
    """Importa el archivo del recorrido 2 en un navegador sin datos."""
    salida = {}
    r2_exportar(ses, fallas, salida)
    if "texto" not in salida:
        return fallas.append("no hay archivo del recorrido 2 para importar")
    ctx, page = abrir_carrera(ses, fallas, VACIO)
    try:
        abrir_datos(page)
        page.locator('input[type="file"][data-cambio="importar"]').set_input_files(
            files=[{"name": "galera-copia.json", "mimeType": "application/json", "buffer": salida["texto"].encode("utf-8")}])
        page.wait_for_function("() => { const m = (JSON.parse(localStorage.getItem('cursada.v1')) || {}).materias || {}; return Object.keys(m).length > 0; }", timeout=10000)
        fallas += N.comparar_estado(page, ESPERADO, None)
        if page.locator(f'input[aria-label="Nota de {NOMBRE}"]').input_value() != NOTA:
            fallas.append("después de importar la pantalla no muestra la nota")
        N.csp(page, fallas)
    finally:
        ctx.close()


def r5_traspaso(ses, fallas):
    ctx, page = abrir_carrera(ses, fallas, VACIO)
    try:
        cargar_materia(page, fallas)
        abrir_datos(page)
        page.get_by_role("button", name="Pasar a otro dispositivo").click()
        page.locator("#tr-link").wait_for(state="attached", timeout=15000)
        link = page.evaluate("document.querySelector('#tr-link').value")
        if "#datos=" not in link:
            return fallas.append(f"el link de traspaso no lleva #datos=: {link[:80]}")
        page.get_by_role("button", name="Copiar el link").click()
    finally:
        ctx.close()
    ctx2 = ses.contexto(None)     # contexto nuevo, sin datos
    try:
        p2 = ctx2.new_page()
        N.observar(p2, fallas, ses.origen)
        ir(p2, ses, urlparse(link).path + "#" + link.split("#", 1)[1])
        p2.get_by_role("button", name="Cargar estos datos").click(timeout=15000)
        p2.wait_for_function("() => { const m = (JSON.parse(localStorage.getItem('cursada.v1')) || {}).materias || {}; return Object.keys(m).length > 0; }", timeout=10000)
        fallas += N.comparar_estado(p2, ESPERADO, None)
        N.csp(p2, fallas)
    finally:
        ctx2.close()


def r6_compartir(ses, fallas):
    ruta = N.apunte_de_r(Path(ses.dist))
    for sin_share, donde in ((False, "navigator.share"), (True, "navigator.clipboard.writeText")):
        ctx = ses.contexto(None, extra_init=(COMPARTIR_JS.replace("SIN_SHARE", "true" if sin_share else "false"),))
        try:
            page = ctx.new_page()
            N.observar(page, fallas, ses.origen)
            ir(page, ses, ruta)
            N.esperar_h1(page, fallas)
            page.get_by_role("button", name="Compartir", exact=True).first.click()
            page.wait_for_function("k => window.__comp[k].length > 0", arg="clip" if sin_share else "share", timeout=5000)
            comp = page.evaluate("window.__comp")
            llamadas = comp["clip"] if sin_share else comp["share"]
            otras = comp["share"] if sin_share else comp["clip"]
            if len(llamadas) != 1 or otras:
                fallas.append(f"con {donde}: se llamó {len(llamadas)} vez/veces y la otra vía {len(otras)} (debía ser 1 y 0)")
            direccion = llamadas[0] if sin_share else (llamadas[0] or {}).get("url", "")
            if not str(direccion).endswith(ruta):
                fallas.append(f"con {donde}: la dirección compartida es {direccion!r} y debía terminar en {ruta}")
            N.csp(page, fallas)
        finally:
            ctx.close()


def pidio_analytics(pedidos):
    return [u for u in pedidos if "googletagmanager.com" in (urlparse(u).hostname or "")]


def r7_consentimiento(ses, fallas):
    def abrir(ctx):
        pedidos = []
        ctx.on("request", lambda r: pedidos.append(r.url))   # también salen los que la red corta
        page = ctx.new_page()
        N.observar(page, fallas, ses.origen)
        ir(page, ses, "/")
        N.esperar_h1(page, fallas)
        page.wait_for_timeout(800)
        return page, pedidos

    # Antes de elegir: el cartel está y no sale ningún pedido. Con «Rechazar», tampoco; y el cartel no vuelve al recargar.
    ctx = ses.contexto(None, consentimiento=None)
    try:
        page, pedidos = abrir(ctx)
        if not page.locator("#galletas.on").count():
            fallas.append("sin elegir, no aparece el cartel de cookies")
        if pidio_analytics(pedidos):
            fallas.append(f"antes de elegir salió un pedido a Google: {pidio_analytics(pedidos)[0]}")
        page.locator("#galletas button[data-v='denied']").click()
        page.wait_for_timeout(800)
        if page.evaluate(f"localStorage.getItem('{CONSENTIMIENTO}')") != "denied":
            fallas.append("«Rechazar» no guardó fc-consent=denied")
        page.reload(wait_until="networkidle")
        N.esperar_h1(page, fallas)
        page.wait_for_timeout(800)
        if page.locator("#galletas.on").count():
            fallas.append("después de rechazar, el cartel vuelve al recargar")
        if pidio_analytics(pedidos):
            fallas.append(f"con «Rechazar» salió un pedido a Google: {pidio_analytics(pedidos)[0]}")
    finally:
        ctx.close()
    # Con «Aceptar», en un contexto nuevo: el pedido se intenta (la red lo corta).
    ctx = ses.contexto(None, consentimiento=None)
    try:
        page, pedidos = abrir(ctx)
        if pidio_analytics(pedidos):
            fallas.append("en el contexto nuevo salió un pedido a Google antes de aceptar")
        page.locator("#galletas button[data-v='granted']").click()
        deadline = time.time() + 8
        while time.time() < deadline and not pidio_analytics(pedidos):
            page.wait_for_timeout(200)
        if not pidio_analytics(pedidos):
            fallas.append("con «Aceptar» no se intentó el pedido a googletagmanager.com")
        if page.evaluate(f"localStorage.getItem('{CONSENTIMIENTO}')") != "granted":
            fallas.append("«Aceptar» no guardó fc-consent=granted")
    finally:
        ctx.close()


def r8_directorio(ses, fallas):
    ctx = ses.contexto(None)
    try:
        page = ctx.new_page()
        N.observar(page, fallas, ses.origen)
        N.recorrer_directorio(page, ses.origen, fallas)
    finally:
        ctx.close()


RECORRIDOS = [
    ("1 · cargar y volver a abrir", r1_cargar_y_reabrir),
    ("2 · exportar", r2_exportar),
    ("3 · borrar todo", r3_borrar_todo),
    ("4 · importar la copia", r4_importar),
    ("5 · traspaso por link", r5_traspaso),
    ("6 · compartir un apunte", r6_compartir),
    ("7 · consentimiento de Analytics", r7_consentimiento),
    ("8 · Directorio por páginas", r8_directorio),
]


# ---------- barrido (solo Chromium) ----------

def pantallas_barrido(dist):
    sitio = json.loads((RAIZ / "marco" / "sitio.json").read_text(encoding="utf-8"))
    rutas = [p["url"] for p in sitio["pantallas"].values() if isinstance(p, dict) and p.get("url")]
    rutas += [f"/simuladores/{s['id']}.html" for s in sitio.get("simuladores", []) if (dist / "simuladores" / f"{s['id']}.html").is_file()]
    rutas.append(N.apunte_de_r(dist))
    # /buscar/ queda afuera siempre: sin Pagefind (local) tendría otras acciones que en el CI y la lista dejaría de ser igual en los dos.
    return [r for r in dict.fromkeys(rutas) if r != "/buscar/"]


CANDIDATAS_JS = """(vistas) => {
  const hechas = new Set(vistas), vis = el => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length) && getComputedStyle(el).visibility !== 'hidden';
  return [...new Set([...document.querySelectorAll('[data-clic]')].filter(vis).map(el => el.getAttribute('data-clic')).filter(n => !hechas.has(n)))];
}"""


# Toca el primer elemento visible de la acción con element.click() (un clic de verdad para el despachador: sube por el DOM igual);
# no espera a que el elemento sea «tocable», así que un cartel encima no frena el barrido.
TOCAR_JS = """(n) => {
  const vis = el => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length) && getComputedStyle(el).visibility !== 'hidden';
  const el = [...document.querySelectorAll('[data-clic]')].find(e => e.getAttribute('data-clic') === n && vis(e));
  if (!el) return false;
  el.click();
  return true;
}"""


def cerrar_dialogos(page):
    page.evaluate("() => document.querySelectorAll('dialog[open]').forEach(d => { try { d.close(); } catch (e) { } })")


def barrer(ses, dist, hasta, fallas, cortado):
    """En cada pantalla, toca el primer elemento visible de cada acción de clic que todavía no se vio."""
    ctx = ses.contexto(N.ESTADO_EJEMPLO)
    # Reloj fijo: calendario, mesas y cuatrimestre dependen de la fecha y cambiarían los botones de un día al otro.
    ctx.clock.set_fixed_time('2026-11-16T12:00:00')
    # Un clic que descarga o abre algo del sistema no debe colgar el barrido.
    ctx.on("dialog", lambda d: d.dismiss())
    page = ctx.new_page()
    errores = []
    N.observar(page, errores, ses.origen)
    tocadas = 0
    try:
        for ruta in pantallas_barrido(dist):
            if time.time() > hasta:
                cortado.append(ruta)
                break
            try:
                ir(page, ses, ruta)
                try:   # el apunte y otras pantallas se arman cuando llegan sus datos: sin esto, lo que se ve depende del momento
                    page.wait_for_function("() => !document.querySelector('.cargando')", timeout=5000)
                except Exception:
                    pass
                page.wait_for_timeout(300)
            except Exception:
                continue
            for _pasada in range(4):   # cada pasada recoge lo que apareció con los clics de la anterior (hasta que no quede nada nuevo)
                page.wait_for_timeout(200)
                try:
                    nombres = [n for n in page.evaluate(CANDIDATAS_JS, sorted(ses.vistas)) if n not in NO_TOCAR]
                except Exception:
                    break
                if not nombres:
                    break
                for n in nombres:
                    if time.time() > hasta:
                        break
                    if n in ses.vistas:
                        continue
                    try:
                        cerrar_dialogos(page)
                        antes = len(errores)
                        if page.evaluate(TOCAR_JS, n):
                            tocadas += 1
                        page.wait_for_timeout(60)
                        for i in range(antes, len(errores)):   # qué clic dejó el error
                            errores[i] = f"{ruta} tras «{n}»: {errores[i]}"
                        if urlparse(page.url).path != urlparse(ses.origen + ruta).path:
                            ir(page, ses, ruta)
                    except Exception:
                        pass   # la página se rompió o cambió: queda en la lista del trinquete
                    finally:
                        try:
                            cerrar_dialogos(page)
                        except Exception:
                            pass
    finally:
        ctx.close()
    fallas += [f"barrido: {x}" for x in N.sin_repetidos(errores)]
    return tocadas


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--navegador", choices=["chromium", "webkit", "todos"], default="chromium")
    ap.add_argument("--dist", default=str(RAIZ / "dist"))
    ap.add_argument("--actualizar", action="store_true", help="achica tools/acciones-sin-recorrido.json a lo que quedó sin ejecutar (solo puede achicarse; crea la lista si no existe)")
    ap.add_argument("--sin-barrido", action="store_true", help="solo los recorridos de riesgo (sin el barrido ni el trinquete)")
    ap.add_argument("--autoprueba", action="store_true", help="casos de la lógica del trinquete, sin navegador")
    ap.add_argument("--rutas", help="escribe en este JSON las rutas que abrieron los recorridos y el barrido (lo lee tools/mapa_pruebas.py)")
    a = ap.parse_args()
    if a.autoprueba:
        return autoprueba()
    dist = Path(a.dist).resolve()
    if not (dist / "index.html").is_file():
        sys.exit(f"{dist} no es un sitio armado: python tools/armar.py --salida dist")
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        sys.exit("Falta Playwright: pip install playwright && python -m playwright install chromium webkit")

    registradas = acciones_registradas()
    lista = json.loads(LISTA.read_text(encoding="utf-8")) if LISTA.is_file() else None
    srv, origen = N.servir(dist)
    motores = ["chromium", "webkit"] if a.navegador == "todos" else [a.navegador]
    todas = []
    with sync_playwright() as p:
        for m in motores:
            print(f"== {m} · iPhone 390 x 844 · {origen}")
            inicio = time.time()
            try:
                browser = getattr(p, m).launch()
            except Exception as e:
                print(f"  no se pudo lanzar {m}: {(str(e).splitlines() or [repr(e)])[0]}")
                todas.append(f"{m}: no se pudo lanzar")
                continue
            ses = Sesion(browser, origen)
            ses.dist = str(dist)
            for nombre, fn in RECORRIDOS:
                todas += [f"{m} · recorrido {nombre}: {x}" for x in correr_recorrido(nombre, fn, ses)]
            if m == "chromium" and not a.sin_barrido:
                fallas = []
                cortado = []
                tocadas = barrer(ses, dist, inicio + TOPE_SEGUNDOS, fallas, cortado)
                print(f"  barrido: {tocadas} clics; en total {len(ses.vistas & registradas)} de {len(registradas)} acciones ejecutadas ({time.time() - inicio:.0f} s)")
                for x in fallas:
                    print(f"        - {x}")
                todas += [f"{m} · {x}" for x in fallas]
                if cortado:
                    # Con el barrido a medias el trinquete daría falsas «acciones nuevas»: no se evalúa.
                    todas.append(f"{m} · el barrido se cortó por tiempo (tope {TOPE_SEGUNDOS} s) en {cortado[0]}: no se evaluó el trinquete")
                    print(f"  FALLA el barrido se cortó por tiempo en {cortado[0]}")
                    browser.close()
                    continue
                if a.actualizar:
                    nueva = lista_nueva(registradas, ses.vistas, lista)
                    if nueva is None:
                        todas.append("--actualizar: habría que sumar acciones a la lista; la lista solo se achica (editá el JSON a mano y explicalo en el commit)")
                    else:
                        LISTA.write_text(json.dumps(nueva, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
                        print(f"  tools/acciones-sin-recorrido.json: {len(nueva)} acciones sin recorrido")
                        lista = nueva
                tr = evaluar_trinquete(registradas, ses.vistas, lista if lista is not None else [])
                print(f"  {'ok  ' if not tr else 'FALLA'} trinquete de acciones ({len(lista or [])} sin recorrido en la lista)")
                for x in tr:
                    print(f"        - {x}")
                todas += [f"{m} · {x}" for x in tr]
            browser.close()
    srv.shutdown()
    if a.rutas:
        Path(a.rutas).write_text(json.dumps(sorted(VISITADAS), ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"\n{'FALLARON ' + str(len(todas)) + ' controles' if todas else 'recorridos ok'}")
    return 1 if todas else 0


if __name__ == "__main__":
    sys.exit(main())
