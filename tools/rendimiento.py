"""Rendimiento con presupuesto: laboratorio (Lighthouse) y respuesta a un toque, con trinquete.

Las dos medidas son más ruidosas que el peso (`tools/pesos.py`), así que llevan tolerancia. Todo arranca con el valor
de hoy, medido en el CI (la máquina de referencia), y no puede empeorar. Base: `tools/rendimiento-base.json`.

1. Laboratorio: Lighthouse en móvil sobre cuatro páginas tipo (PAGINAS_LAB), 3 corridas cada una, mediana. Se
   presupuestan LCP, TBT y CLS (no el puntaje). Tope: LCP y TBT hasta `lcp_pct`/`tbt_pct` % sobre la base; CLS hasta
   `cls_abs` sobre la base. Se pide a Lighthouse por `npx` con versión fija (LIGHTHOUSE); usa el Chromium de Playwright.
2. Toque: en Chromium, con la CPU frenada 4 veces, en /carrera/ con el estado de ejemplo: del toque al segundo cuadro
   pintado (dos requestAnimationFrame) al cambiar el estado de una materia, abrir su ficha y cambiar de vista. Mediana
   de 5. Tope: `toque_pct` % sobre la base y nunca menos de `toque_piso_ms`.
   El toque es sintético (`element.click()` / evento `change` dentro de la página): mide lo que tarda la app en
   responder, no la latencia del hardware de entrada.

    python tools/rendimiento.py dist                      controla contra la base (lo que corre el CI)
    python tools/rendimiento.py dist --actualizar         baja la base si algo mejoró (y suma lo nuevo); nunca la sube
    python tools/rendimiento.py dist --inicial            fija la base por primera vez (solo si no hay medidas)
    python tools/rendimiento.py dist --solo toque|lab     una de las dos medidas
    python tools/rendimiento.py dist --salida m.json      además guarda lo medido (para anotar la dispersión)
    python tools/rendimiento.py --autoprueba              casos de la lógica pura

Subir la base a propósito: editar el JSON a mano y explicarlo en el commit.
"""
import argparse
import json
import os
import shutil
import statistics
import subprocess
import sys
import tempfile
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from servir import servir  # noqa: E402

BASE = Path(__file__).resolve().parent / "rendimiento-base.json"
LIGHTHOUSE = "lighthouse@12.6.1"  # versión exacta: otra versión cambia los números
CORRIDAS_LAB = 3
CORRIDAS_TOQUE = 5
CPU_FRENO = 4

# Cuatro páginas tipo (las mismas que pesos.PAGINAS menos Mi carrera: Lighthouse no carga un estado en localStorage).
PAGINAS_LAB = {
    "/": "inicio",
    "/r/0905/e2-soportes-y-papel.html": "apunte",
    "/simuladores/escandallo.html": "simulador",
    "/directorio/": "directorio",
}
TOQUES = ("estado de una materia", "ficha de una materia", "cambio de vista")

TOLERANCIAS = {"lcp_pct": 25, "tbt_pct": 25, "cls_abs": 0.02, "toque_pct": 50, "toque_piso_ms": 100}


# ---------- lógica pura (con autoprueba) ----------

def mediana(xs):
    return statistics.median(xs)


def comparar(base, medido, tol=None):
    """Fallas (strings) de lo medido contra la base. `base` y `medido` tienen la forma del JSON:
    {'lab': {ruta: {'lcp_ms', 'tbt_ms', 'cls'}}, 'toque': {nombre: ms}}. Solo compara lo que `medido` trae."""
    t = {**TOLERANCIAS, **(tol or {})}
    fallas = []
    for ruta, m in sorted(medido.get("lab", {}).items()):
        b = base.get("lab", {}).get(ruta)
        if b is None:
            fallas.append(f"{ruta} (laboratorio) no está en la base: correr con --actualizar y commitear el JSON")
            continue
        for clave, pct in (("lcp_ms", t["lcp_pct"]), ("tbt_ms", t["tbt_pct"])):
            tope = b[clave] * (1 + pct / 100)
            if m[clave] > tope:
                fallas.append(f"{ruta} {clave[:-3].upper()}: {m[clave]:.0f} ms > base {b[clave]:.0f} ms + {pct} % ({tope:.0f})")
        if m["cls"] > b["cls"] + t["cls_abs"]:
            fallas.append(f"{ruta} CLS: {m['cls']:.3f} > base {b['cls']:.3f} + {t['cls_abs']}")
    for nombre, ms in sorted(medido.get("toque", {}).items()):
        b = base.get("toque", {}).get(nombre)
        if b is None:
            fallas.append(f"toque «{nombre}» no está en la base: correr con --actualizar y commitear el JSON")
            continue
        tope = max(b * (1 + t["toque_pct"] / 100), t["toque_piso_ms"])
        if ms > tope:
            fallas.append(f"toque «{nombre}»: {ms:.0f} ms > tope {tope:.0f} ms (base {b:.0f} ms)")
    return fallas


def mejorar(base, medido):
    """Base nueva: el MENOR entre la base y lo medido en cada valor; suma lo que no estaba. Nunca sube."""
    nueva = {"lab": {r: dict(v) for r, v in base.get("lab", {}).items()}, "toque": dict(base.get("toque", {}))}
    for ruta, m in medido.get("lab", {}).items():
        if ruta not in nueva["lab"]:
            nueva["lab"][ruta] = dict(m)
        else:
            for k in ("lcp_ms", "tbt_ms", "cls"):
                nueva["lab"][ruta][k] = min(nueva["lab"][ruta][k], m[k])
    for n, ms in medido.get("toque", {}).items():
        nueva["toque"][n] = min(nueva["toque"].get(n, ms), ms)
    return nueva


def dispersion(corridas):
    """(max - min) / mediana, en %, de una lista de números. 0 si la mediana es 0."""
    med = mediana(corridas)
    return 0.0 if med == 0 else (max(corridas) - min(corridas)) / med * 100


def autoprueba():
    def base():
        return {"lab": {"/": {"lcp_ms": 3000, "tbt_ms": 200, "cls": 0.01}}, "toque": {"x": 80}}
    casos = []
    casos.append(("igual no falla", comparar(base(), base()) == []))
    m = base(); m["lab"]["/"]["lcp_ms"] = 3750
    casos.append(("LCP +25 % justo no falla", comparar(base(), m) == []))
    m["lab"]["/"]["lcp_ms"] = 3751
    casos.append(("LCP +25 % y un poco falla", len(comparar(base(), m)) == 1))
    m = base(); m["lab"]["/"]["tbt_ms"] = 251
    casos.append(("TBT +25 % falla", len(comparar(base(), m)) == 1))
    m = base(); m["lab"]["/"]["cls"] = 0.03
    casos.append(("CLS +0,02 justo no falla", comparar(base(), m) == []))
    m["lab"]["/"]["cls"] = 0.031
    casos.append(("CLS más de 0,02 falla", len(comparar(base(), m)) == 1))
    m = base(); m["toque"]["x"] = 100
    casos.append(("toque bajo el piso de 100 ms no falla", comparar(base(), m) == []))
    m["toque"]["x"] = 121
    casos.append(("toque sobre el piso y sobre +50 % falla", len(comparar(base(), m)) == 1))
    b = {"lab": {}, "toque": {"y": 400}}; m = {"toque": {"y": 600}}
    casos.append(("toque +50 % justo no falla", comparar(b, m) == []))
    m = {"toque": {"y": 601}}
    casos.append(("toque +50 % y un poco falla", len(comparar(b, m)) == 1))
    m = {"lab": {"/nueva": {"lcp_ms": 1, "tbt_ms": 1, "cls": 0}}}
    casos.append(("página sin base falla", len(comparar(base(), m)) == 1))
    m = base(); m["lab"]["/"]["lcp_ms"] = 2000; m["toque"]["z"] = 5
    n = mejorar(base(), m)
    casos.append(("mejorar baja y suma", n["lab"]["/"]["lcp_ms"] == 2000 and n["toque"]["z"] == 5))
    m = base(); m["lab"]["/"]["lcp_ms"] = 9000
    casos.append(("mejorar nunca sube", mejorar(base(), m)["lab"]["/"]["lcp_ms"] == 3000))
    casos.append(("mediana", mediana([3, 1, 2]) == 2))
    casos.append(("dispersión", dispersion([90, 100, 110]) == 20.0))
    for nom, ok in casos:
        print("ok   " if ok else "FALLA", nom)
    return 0 if all(ok for _, ok in casos) else 1


# ---------- medidas ----------

def ejecutable_chromium(p, canal):
    return p.chromium.executable_path if not canal else None


def lighthouse_una(url, chrome_path):
    """Una corrida de Lighthouse (móvil, solo rendimiento). Devuelve {'lcp_ms','tbt_ms','cls'}."""
    npx = shutil.which("npx") or shutil.which("npx.cmd")
    if not npx:
        raise SystemExit("rendimiento: falta npx (Node)")
    with tempfile.TemporaryDirectory() as tmp:
        salida = Path(tmp) / "lh.json"
        flags = "--headless=new --no-sandbox --disable-gpu"
        cmd = [npx, "--yes", LIGHTHOUSE, url, "--only-categories=performance", "--output=json",
               f"--output-path={salida}", f"--chrome-flags={flags}", "--quiet"]
        env = dict(os.environ)
        if chrome_path:
            env["CHROME_PATH"] = str(chrome_path)
        r = subprocess.run(cmd, capture_output=True, text=True, env=env, timeout=300)
        if r.returncode != 0 or not salida.is_file():
            raise SystemExit(f"Lighthouse falló en {url}: {(r.stderr or r.stdout).strip()[-400:]}")
        a = json.loads(salida.read_text(encoding="utf-8"))["audits"]
    return {"lcp_ms": a["largest-contentful-paint"]["numericValue"],
            "tbt_ms": a["total-blocking-time"]["numericValue"],
            "cls": a["cumulative-layout-shift"]["numericValue"]}


def medir_lab(origen, chrome_path):
    lab, crudo = {}, {}
    for ruta in PAGINAS_LAB:
        corridas = [lighthouse_una(origen + ruta, chrome_path) for _ in range(CORRIDAS_LAB)]
        crudo[ruta] = corridas
        lab[ruta] = {k: mediana([c[k] for c in corridas]) for k in ("lcp_ms", "tbt_ms", "cls")}
        m = lab[ruta]
        print(f"  lab {ruta}: LCP {m['lcp_ms']:.0f} ms · TBT {m['tbt_ms']:.0f} ms · CLS {m['cls']:.3f}"
              f"  (LCP {[round(c['lcp_ms']) for c in corridas]}, TBT {[round(c['tbt_ms']) for c in corridas]})")
    return lab, crudo


# Del toque al segundo cuadro pintado, medido dentro de la página.
JS_CUADROS = """() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r())))"""
JS_TOCAR = """async ([sel, i, valor]) => {
  const el = document.querySelectorAll(sel)[i];
  if (!el) throw new Error('no hay ' + sel + '[' + i + ']');
  const t0 = performance.now();
  if (valor !== null) { el.value = valor; el.dispatchEvent(new Event('change', {bubbles: true})); } else el.click();
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));
  return performance.now() - t0;
}"""


def medir_toque(origen, canal):
    from playwright.sync_api import sync_playwright
    import navegador as nav
    res, crudo = {}, {}
    with sync_playwright() as p:
        kw = {"channel": canal} if canal else {}
        browser = p.chromium.launch(**kw)
        ctx = nav.preparar_contexto(browser, origen, nav.ESTADO_EJEMPLO)
        page = ctx.new_page()
        page.goto(origen + "/carrera/")
        page.wait_for_selector("select.gl-sel")
        page.evaluate(JS_CUADROS)
        cdp = ctx.new_cdp_session(page)
        cdp.send("Emulation.setCPUThrottlingRate", {"rate": CPU_FRENO})
        estados = ["cursando", "regular", "aprobada", "pendiente"]
        # Botones vAsig: 0 «Te faltan», 1 «Tabla» (la única con selectores de estado), 2 «Recorrido sugerido».
        page.evaluate(JS_TOCAR, ['[data-clic="vAsig"]', 1, None])
        crudo = {n: [] for n in TOQUES}
        page.evaluate(JS_TOCAR, ["select.gl-sel", 0, "regular"])  # calentamiento: primer render con el filtro
        for i in range(CORRIDAS_TOQUE):
            crudo[TOQUES[0]].append(page.evaluate(JS_TOCAR, ["select.gl-sel", 0, estados[i % 4]]))
            crudo[TOQUES[1]].append(page.evaluate(JS_TOCAR, ["button.gl-nombre", i, None]))
            page.keyboard.press("Escape")
            page.wait_for_function("!document.querySelector('dialog[open]')")
            crudo[TOQUES[2]].append(page.evaluate(JS_TOCAR, ['[data-clic="vAsig"]', 2, None]))
            crudo[TOQUES[2]].append(page.evaluate(JS_TOCAR, ['[data-clic="vAsig"]', 1, None]))  # y de vuelta a «Tabla»
        cdp.send("Emulation.setCPUThrottlingRate", {"rate": 1})
        browser.close()
    for n, xs in crudo.items():
        res[n] = mediana(xs)
        print(f"  toque «{n}»: {res[n]:.0f} ms  ({[round(x) for x in xs]})")
    return res, crudo


# ---------- principal ----------

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("dist", nargs="?", default="dist")
    ap.add_argument("--actualizar", action="store_true")
    ap.add_argument("--inicial", action="store_true")
    ap.add_argument("--solo", choices=["lab", "toque"])
    ap.add_argument("--salida", help="guarda lo medido (con las corridas crudas) en este JSON")
    ap.add_argument("--canal", help="usar el Chrome instalado (p. ej. chrome) en vez del Chromium de Playwright")
    ap.add_argument("--autoprueba", action="store_true")
    a = ap.parse_args()
    if a.autoprueba:
        return autoprueba()
    dist = Path(a.dist).resolve()
    if not (dist / "index.html").is_file():
        sys.exit(f"{dist} no es un sitio armado: python tools/armar.py --salida dist")
    from playwright.sync_api import sync_playwright
    srv, origen = servir(dist)
    medido, crudo = {}, {}
    chrome = None
    if a.solo != "toque":
        with sync_playwright() as p:
            chrome = None if a.canal else p.chromium.executable_path
        print(f"== laboratorio · {LIGHTHOUSE} · {origen}")
        medido["lab"], crudo["lab"] = medir_lab(origen, chrome)
    if a.solo != "lab":
        print(f"== toque · CPU x{CPU_FRENO} · /carrera/ con el estado de ejemplo")
        medido["toque"], crudo["toque"] = medir_toque(origen, a.canal)
    srv.shutdown()
    if a.salida:
        Path(a.salida).write_text(json.dumps({"medido": medido, "crudo": crudo}, ensure_ascii=False, indent=1), encoding="utf-8")
    cfg = json.loads(BASE.read_text(encoding="utf-8")) if BASE.is_file() else {}
    base = cfg.get("rendimiento", {})
    if a.actualizar or a.inicial:
        if a.inicial and (base.get("lab") or base.get("toque")):
            print("rendimiento: ya hay base; --inicial es solo para la primera vez (usá --actualizar)")
            return 1
        nueva = mejorar(base, medido)
        nueva["tolerancias"] = base.get("tolerancias", dict(TOLERANCIAS))
        nueva["fecha"] = date.today().isoformat()
        cfg["rendimiento"] = nueva
        BASE.write_text(json.dumps(cfg, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"base de rendimiento al {nueva['fecha']} en {BASE.name}")
        return 0
    if not (base.get("lab") or base.get("toque")):
        print("rendimiento: no hay base; correr con --inicial en el CI y commitear el JSON")
        return 1
    fallas = comparar(base, medido, base.get("tolerancias"))
    for f in fallas:
        print("  FALLA", f)
    print("rendimiento ok" if not fallas else f"rendimiento: {len(fallas)} controles fallan")
    return 1 if fallas else 0


if __name__ == "__main__":
    sys.exit(main())
