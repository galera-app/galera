"""Compara colores computados de Galera entre dos armados (antes y después de tocar tokens).
Uso (con GALERA_ESTADO=<estado.json> carga ese estado en localStorage): python tools/comparar_colores.py medir <dist> <salida.json> [--capturas <carpeta> --prefijo antes]
     python tools/comparar_colores.py diff <antes.json> <despues.json> [--alias viejo=nuevo ...]
Mide, por pantalla, modo (claro, oscuro del sistema, oscuro elegido, claro elegido con sistema oscuro) y ancho (375, 1280):
color, fondo, bordes, contorno, relleno, trazo, sombra, imágenes de fondo (con var() ya resuelta), también de ::before, ::after y ::first-letter,
y el valor computado de cada variable --* de :root. Necesita Playwright con Chrome. Es una herramienta de revisión, no entra en el CI."""
import functools
import http.server
import json
import os
import sys
import threading
from pathlib import Path

PANTALLAS = {
    "inicio": "/", "carrera": "/carrera/", "horarios": "/horarios/", "resumenes": "/r/", "apunte": "/r/0902/",
    "simuladores": "/simuladores/", "glosario": "/glosario/", "directorio": "/directorio/", "planificador": "/libro/planificador-de-libros.html",
}
MODOS = {  # nombre: (esquema del sistema, tema elegido o None)
    "claro": ("light", None), "oscuro": ("dark", None), "oscuro-elegido": ("light", "dark"), "claro-elegido": ("dark", "light"),
}
ANCHOS = {"375": (375, 812), "escritorio": (1280, 800)}
PROPS = ["color", "backgroundColor", "borderTopColor", "borderRightColor", "borderBottomColor", "borderLeftColor", "outlineColor", "fill", "stroke",
         "boxShadow", "backgroundImage", "textDecorationColor", "caretColor", "columnRuleColor", "accentColor"]
JS = """(props) => {
  const out = {}; let n = 0;
  const camino = (e) => { const p = []; while (e && e.nodeType === 1 && p.length < 6) { p.push(e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.classList.length ? '.' + [...e.classList].slice(0, 2).join('.') : '')); e = e.parentElement; } return p.join('<'); };
  const vistos = {};
  for (const e of document.querySelectorAll('body, body *')) {
    if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(e.tagName)) continue;
    let k = camino(e); vistos[k] = (vistos[k] || 0) + 1; k = k + '#' + vistos[k];
    for (const ps of ['', '::before', '::after', '::first-letter']) {
      if (ps && !['::first-letter'].includes(ps)) { const c = getComputedStyle(e, ps).content; if (!c || c === 'none' || c === 'normal') continue; }
      if (ps === '::first-letter' && !e.textContent.trim()) continue;
      const cs = getComputedStyle(e, ps), o = {};
      for (const p of props) { const v = cs[p]; if (v && v !== 'none' && v !== 'rgba(0, 0, 0, 0)' && v !== 'auto') o[p] = v; }
      if (Object.keys(o).length) out[k + ps] = o;
    }
  }
  const vars = {}; const cs = getComputedStyle(document.documentElement); const nombres = new Set();
  for (const h of document.styleSheets) { try { for (const r of h.cssRules) { const t = r.cssText || ''; for (const m of t.matchAll(/--[\\w-]+(?=\\s*:)/g)) nombres.add(m[0]); if (r.cssRules) for (const q of r.cssRules) for (const m of (q.cssText || '').matchAll(/--[\\w-]+(?=\\s*:)/g)) nombres.add(m[0]); } } catch (e) {} }
  for (const v of [...nombres].sort()) vars[v] = cs.getPropertyValue(v).trim();
  return { elementos: out, vars };
}"""


def servir(raiz):
    h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(raiz))
    h.log_message = lambda *a, **k: None
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), h)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def medir(dist, salida, capturas=None, prefijo="antes"):
    from playwright.sync_api import sync_playwright
    srv = servir(dist)
    base = f"http://127.0.0.1:{srv.server_address[1]}"
    res = {}
    if capturas:
        Path(capturas).mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome")
        for modo, (esquema, tema) in MODOS.items():
            for an, (w, h) in ANCHOS.items():
                ctx = b.new_context(viewport={"width": w, "height": h}, color_scheme=esquema, reduced_motion="reduce", service_workers="block")
                if tema:
                    ctx.add_init_script(f"try{{localStorage.setItem('cursada.tema','{tema}')}}catch(e){{}}")
                if os.environ.get("GALERA_ESTADO"):  # archivo JSON con un estado de ejemplo (Mi carrera con materias cargadas)
                    ctx.add_init_script("try{localStorage.setItem('cursada.v1',%s)}catch(e){}" % json.dumps(Path(os.environ["GALERA_ESTADO"]).read_text(encoding="utf-8")))
                pg = ctx.new_page()
                for nom, ruta in PANTALLAS.items():
                    pg.goto(base + ruta, wait_until="networkidle")
                    pg.wait_for_timeout(700)
                    clave = f"{nom}|{modo}|{an}"
                    res[clave] = pg.evaluate(JS, PROPS)
                    if capturas and modo in ("claro", "oscuro"):
                        pg.screenshot(path=str(Path(capturas) / f"{prefijo}-{nom}-{an}-{modo}.png"))
                ctx.close()
        b.close()
    Path(salida).write_text(json.dumps(res, ensure_ascii=False, indent=0), encoding="utf-8")
    print("medido:", len(res), "combinaciones,", sum(len(v["elementos"]) for v in res.values()), "elementos")


def diff(a, b, alias):
    A = json.loads(Path(a).read_text(encoding="utf-8")); B = json.loads(Path(b).read_text(encoding="utf-8"))
    dif = 0
    for clave in A:
        ea, eb = A[clave]["elementos"], B.get(clave, {}).get("elementos", {})
        for k in sorted(set(ea) | set(eb)):
            if ea.get(k) != eb.get(k):
                dif += 1
                if dif <= 40:
                    pa, pb = ea.get(k, {}), eb.get(k, {})
                    cam = {p: (pa.get(p), pb.get(p)) for p in set(pa) | set(pb) if pa.get(p) != pb.get(p)}
                    print("DIF", clave, k, cam)
        va, vb = A[clave]["vars"], B[clave]["vars"]
        for v in sorted(va):
            nv = alias.get(v, v)
            if nv not in vb:
                print("VAR sin equivalente", clave, v); dif += 1
            elif va[v] != vb[nv]:
                print("VAR distinta", clave, v, va[v], "->", nv, vb[nv]); dif += 1
    print("diferencias:", dif)
    return dif


if __name__ == "__main__":
    a = sys.argv[1:]
    if a[0] == "medir":
        cap = a[a.index("--capturas") + 1] if "--capturas" in a else None
        pre = a[a.index("--prefijo") + 1] if "--prefijo" in a else "antes"
        medir(a[1], a[2], cap, pre)
    else:
        al = dict(x.split("=") for x in a[a.index("--alias") + 1:]) if "--alias" in a else {}
        sys.exit(1 if diff(a[1], a[2], al) else 0)
