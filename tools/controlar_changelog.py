#!/usr/bin/env python3
"""Control del CHANGELOG (paso 24): cada versión de datos/novedades.json tiene su entrada en CHANGELOG.md y al revés.

Uso, desde la raíz del repo:
  python tools/controlar_changelog.py              controla CHANGELOG.md contra datos/novedades.json (lo corre el CI)
  python tools/controlar_changelog.py --autoprueba casos de la función pura

Falla si: una novedad no tiene `v` entera, hay versiones repetidas, faltan versiones (huecos),
una versión está de un lado y no del otro, o el CHANGELOG no va de la más nueva a la más vieja.
Sin excepciones históricas: hoy las 185 versiones están de los dos lados.
"""
import argparse
import json
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent


def problemas_versiones(novedades, changelog):
    """Función pura: lista lo que no cierra entre las novedades y el CHANGELOG (vacía = todo bien)."""
    vers = [x.get("v") for x in novedades]
    if not all(isinstance(v, int) and not isinstance(v, bool) for v in vers):
        return ["hay novedades sin versión (v) entera"]
    chl = [int(m) for m in re.findall(r"^## v(\d+) ", changelog, re.M)]
    pub, reg, mal = set(vers), set(chl), []
    if len(pub) != len(vers):
        mal.append(f"versiones repetidas en novedades: {sorted({v for v in vers if vers.count(v) > 1})}")
    if len(reg) != len(chl):
        mal.append(f"versiones repetidas en el CHANGELOG: {sorted({v for v in chl if chl.count(v) > 1})}")
    if pub - reg:
        mal.append(f"faltan en el CHANGELOG: {sorted(pub - reg)}")
    if reg - pub:
        mal.append(f"en el CHANGELOG sin entrada en novedades.json: {sorted(reg - pub)}")
    if hueco := set(range(1, max(pub, default=0) + 1)) - pub:
        mal.append(f"huecos en novedades: {sorted(hueco)}")
    if desorden := [(a, b) for a, b in zip(chl, chl[1:]) if a <= b]:
        mal.append(f"CHANGELOG fuera de orden: {desorden}")
    return mal


def autoprueba():
    n = lambda *vs: [{"v": v} for v in vs]
    ch = lambda *vs: "".join(f"## v{v} · 2026-01-01\n- x\n" for v in vs)
    casos = [
        ("iguales y en orden pasan", problemas_versiones(n(2, 1), ch(2, 1)) == []),
        ("vacíos pasan", problemas_versiones([], "") == []),
        ("falta en el CHANGELOG", any("faltan en el CHANGELOG: [2]" in p for p in problemas_versiones(n(3, 2, 1), ch(3, 1)))),
        ("sobra en el CHANGELOG", any("sin entrada en novedades" in p for p in problemas_versiones(n(1), ch(2, 1)))),
        ("fuera de orden", any("fuera de orden" in p for p in problemas_versiones(n(3, 2, 1), ch(3, 1, 2)))),
        ("hueco en novedades", any("huecos" in p for p in problemas_versiones(n(3, 1), ch(3, 1)))),
        ("versión repetida en el CHANGELOG", any("repetidas en el CHANGELOG" in p for p in problemas_versiones(n(1), ch(1, 1)))),
        ("versión repetida en novedades", any("repetidas en novedades" in p for p in problemas_versiones(n(1, 1), ch(1)))),
        ("novedad sin v", problemas_versiones([{"v": None}], ch(1)) == ["hay novedades sin versión (v) entera"]),
        ("v no entera", problemas_versiones([{"v": "2"}], ch(2)) == ["hay novedades sin versión (v) entera"]),
        ("solo cuentan los títulos «## vN »", problemas_versiones(n(1), "texto ## v9 · x\n## v1 · x\n") == []),
    ]
    fallas = [nombre for nombre, ok in casos if not ok]
    for nombre in fallas:
        print("FALLA:", nombre)
    print(f"controlar_changelog --autoprueba: {len(casos) - len(fallas)}/{len(casos)} casos")
    return 1 if fallas else 0


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--autoprueba", action="store_true", help="correr los casos de la función pura")
    args = ap.parse_args(argv)
    if args.autoprueba:
        return autoprueba()
    novedades = json.loads((RAIZ / "datos" / "novedades.json").read_text(encoding="utf-8"))["novedades"]
    mal = problemas_versiones(novedades, (RAIZ / "CHANGELOG.md").read_text(encoding="utf-8"))
    for p in mal:
        print("FALLA:", p)
    print("CHANGELOG y novedades.json: " + ("no coinciden" if mal else f"{len(novedades)} versiones, coinciden y están en orden"))
    return 1 if mal else 0


if __name__ == "__main__":
    sys.exit(main())
