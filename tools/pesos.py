"""Trinquete de peso: lo que el navegador tiene que bajar no puede crecer.

Mide sobre el sitio armado (dist/), en bytes y comprimido con gzip: `app.js`, cada CSS de la raíz y el total de
HTML + CSS + JS locales que referencia cada página tipo (PAGINAS). Falla si algo sube más de TOLERANCIA_PCT sobre
la base (`tools/rendimiento-base.json`, sección «pesos»). Es determinista: el mismo dist da los mismos números.

    python tools/pesos.py dist               controla contra la base (lo que corre el CI)
    python tools/pesos.py dist --actualizar  baja la base si algo pesa menos (y suma lo nuevo); nunca la sube
    python tools/pesos.py --autoprueba       casos de la lógica pura

Subir la base a propósito (algo crece legítimamente): editar el JSON a mano y explicarlo en el commit.
"""
import argparse
import gzip
import json
import re
import sys
from datetime import date
from pathlib import Path

BASE = Path(__file__).resolve().parent / "rendimiento-base.json"
TOLERANCIA_PCT = 1.0

# Páginas tipo: las cuatro de Lighthouse (rendimiento.py) más Mi carrera, que mide la respuesta a un toque.
PAGINAS = {
    "/": "inicio",
    "/r/0905/e2-soportes-y-papel.html": "apunte",
    "/simuladores/escandallo.html": "simulador",
    "/directorio/": "directorio",
    "/carrera/": "mi carrera",
}


def tam(datos):
    return {"bytes": len(datos), "gzip": len(gzip.compress(datos, 6, mtime=0))}


def archivo_de_ruta(dist, ruta):
    rel = ruta.split("?")[0].split("#")[0].strip("/")
    for c in (dist / rel, dist / (rel + ".html"), dist / rel / "index.html"):
        if c.is_file():
            return c
    return None


def recursos_locales(html, ruta_pagina):
    """Rutas absolutas de los scripts y hojas de estilo del mismo origen que carga la página."""
    base = ruta_pagina if ruta_pagina.endswith("/") else ruta_pagina.rsplit("/", 1)[0] + "/"
    out = []
    for etiqueta in re.findall(r"<script\b[^>]*>|<link\b[^>]*>", html, re.I):
        if etiqueta.lower().startswith("<link") and not re.search(r"rel\s*=\s*[\"']?stylesheet", etiqueta, re.I):
            continue
        m = re.search(r"""(?:src|href)\s*=\s*["']([^"']+)["']""", etiqueta, re.I)
        if not m:
            continue
        u = m.group(1)
        if re.match(r"^(https?:)?//|^data:", u):
            continue
        u = u.split("?")[0].split("#")[0]
        if not u.startswith("/"):
            u = base + u
        out.append(u)
    return sorted(set(out))


def medir(dist):
    """{'archivos': {nombre: {bytes, gzip}}, 'paginas': {ruta: {bytes, gzip, archivos}}}"""
    dist = Path(dist)
    archivos = {}
    for nombre in ["app.js"] + sorted(p.name for p in dist.glob("*.css")):
        f = dist / nombre
        if f.is_file():
            archivos[nombre] = tam(f.read_bytes())
    paginas = {}
    for ruta in PAGINAS:
        f = archivo_de_ruta(dist, ruta)
        if f is None:
            raise SystemExit(f"pesos: la página tipo {ruta} no está en {dist}")
        partes = [f]
        for r in recursos_locales(f.read_text(encoding="utf-8", errors="replace"), ruta):
            g = archivo_de_ruta(dist, r)
            if g is not None:
                partes.append(g)
        total = {"bytes": 0, "gzip": 0}
        for p in partes:
            t = tam(p.read_bytes())
            total["bytes"] += t["bytes"]
            total["gzip"] += t["gzip"]
        paginas[ruta] = {**total, "archivos": len(partes)}
    return {"archivos": archivos, "paginas": paginas}


def comparar(base, actual, tol_pct=TOLERANCIA_PCT):
    """Lista de fallas (strings). Pura: no toca el disco. Falla si algo sube más que la tolerancia o si
    algo de la base deja de medirse."""
    fallas = []
    for seccion in ("archivos", "paginas"):
        b, a = base.get(seccion, {}), actual.get(seccion, {})
        for nombre, vb in sorted(b.items()):
            if nombre not in a:
                fallas.append(f"{nombre} estaba en la base y ya no se mide")
                continue
            for clave in ("bytes", "gzip"):
                tope = vb[clave] * (1 + tol_pct / 100)
                if a[nombre][clave] > tope:
                    fallas.append(f"{nombre} ({clave}): {a[nombre][clave]} > base {vb[clave]} + {tol_pct:g} % ({tope:.0f})")
        for nombre in sorted(set(a) - set(b)):
            fallas.append(f"{nombre} no está en la base: correr `python tools/pesos.py dist --actualizar` y commitear el JSON")
    return fallas


def mejorar(base, actual):
    """Nueva base: cada valor es el MENOR entre la base y lo medido; suma lo que no estaba. Nunca sube."""
    nueva = {s: {k: dict(v) for k, v in base.get(s, {}).items()} for s in ("archivos", "paginas")}
    for seccion in ("archivos", "paginas"):
        for nombre, va in actual.get(seccion, {}).items():
            if nombre not in nueva[seccion]:
                nueva[seccion][nombre] = dict(va)
                continue
            for clave in ("bytes", "gzip"):
                nueva[seccion][nombre][clave] = min(nueva[seccion][nombre][clave], va[clave])
    return nueva


def cargar():
    return json.loads(BASE.read_text(encoding="utf-8")) if BASE.is_file() else {}


def guardar(cfg):
    BASE.write_text(json.dumps(cfg, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def autoprueba():
    def base():
        return {"archivos": {"app.js": {"bytes": 1000, "gzip": 400}},
                "paginas": {"/": {"bytes": 2000, "gzip": 800, "archivos": 3}}}
    casos = []
    casos.append(("igual no falla", comparar(base(), base()) == []))
    c = base(); c["archivos"]["app.js"]["gzip"] = 404
    casos.append(("+1 % justo no falla", comparar(base(), c) == []))
    c["archivos"]["app.js"]["gzip"] = 405
    casos.append(("más de 1 % falla", len(comparar(base(), c)) == 1))
    c = base(); c["archivos"]["app.js"]["bytes"] = 11000
    casos.append(("+10 KB en app.js falla", any("app.js" in f for f in comparar(base(), c))))
    c = base(); c["paginas"]["/"]["gzip"] = 700; c["archivos"]["app.js"]["bytes"] = 500
    casos.append(("bajar no falla", comparar(base(), c) == []))
    c = base(); del c["archivos"]["app.js"]
    casos.append(("lo que desaparece falla", len(comparar(base(), c)) == 1))
    c = base(); c["archivos"]["nuevo.css"] = {"bytes": 5, "gzip": 5}
    casos.append(("un CSS nuevo sin base falla", len(comparar(base(), c)) == 1))
    c = base(); c["archivos"]["app.js"]["bytes"] = 900; c["archivos"]["nuevo.css"] = {"bytes": 5, "gzip": 5}
    m = mejorar(base(), c)
    casos.append(("mejorar baja y suma", m["archivos"]["app.js"]["bytes"] == 900 and "nuevo.css" in m["archivos"]))
    c = base(); c["archivos"]["app.js"]["bytes"] = 5000
    casos.append(("mejorar nunca sube", mejorar(base(), c)["archivos"]["app.js"]["bytes"] == 1000))
    html = '<link rel="stylesheet" href="/a.css?v=1"><script src="b.js"></script><script src="https://x.com/c.js"></script><link rel="icon" href="/i.png">'
    casos.append(("recursos locales", recursos_locales(html, "/x/") == ["/a.css", "/x/b.js"]))
    for n, v in casos:
        print("ok   " if v else "FALLA", n)
    return 0 if all(v for _, v in casos) else 1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("dist", nargs="?", default="dist")
    ap.add_argument("--actualizar", action="store_true")
    ap.add_argument("--autoprueba", action="store_true")
    a = ap.parse_args()
    if a.autoprueba:
        return autoprueba()
    actual = medir(a.dist)
    cfg = cargar()
    base = cfg.get("pesos", {})
    if a.actualizar:
        nueva = {**base, **mejorar(base, actual)}
        if nueva != {k: base.get(k) for k in ("archivos", "paginas")} or not base:
            nueva["fecha"] = date.today().isoformat()
        else:
            nueva["fecha"] = base.get("fecha", date.today().isoformat())
        cfg["pesos"] = nueva
        guardar(cfg)
        print(f"base de pesos al {nueva['fecha']} en {BASE.name}")
        return 0
    if not base:
        print("pesos: no hay base; corré con --actualizar")
        return 1
    for n, v in {**actual["archivos"], **actual["paginas"]}.items():
        print(f"  {n:36} {v['bytes']/1024:8.1f} KB · gzip {v['gzip']/1024:7.1f} KB")
    fallas = comparar(base, actual)
    for f in fallas:
        print("  FALLA", f)
    print("pesos ok" if not fallas else f"pesos: {len(fallas)} controles fallan")
    return 1 if fallas else 0


if __name__ == "__main__":
    sys.exit(main())
