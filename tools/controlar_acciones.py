#!/usr/bin/env python3
"""Controla la delegación de eventos: la CSP no permite scripts en línea, así que cada data-clic/-cambio/... debe nombrar una acción registrada en ACC.

Falla si:
- queda un manejador en línea (onclick="…", onchange="…", etc.) en un HTML, una plantilla, un JS de la app o tools/armar.py;
- un data-<evento>="nombre" o dAcc('nombre') apunta a algo que no está en ACC.
Uso: python tools/controlar_acciones.py        (desde la raíz del repo)
"""
import re, sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
EVENTOS = "clic|cambio|entra|foco|tecla|envia|abre|falla"
EN_LINEA = re.compile(r'\son(?:click|change|input|focus|blur|keydown|keyup|keypress|submit|toggle|error|load|pointerenter|pointerover|touchstart|mouseover|mouseenter)\s*=\s*["\']', re.I)
JS = sorted(q.name for q in RAIZ.glob("*.js") if q.name not in ("marco.js", "sw.js"))


def leer(p):
    return p.read_text(encoding="utf-8")


registradas = set()
usos = []  # (archivo, nombre)
errores = []
for nombre_js in JS:
    t = leer(RAIZ / nombre_js)
    # Registro explícito: «nombre: (...a) => nombre(...a)» y las implementaciones de ACC (dos o cuatro espacios de sangría).
    registradas |= set(re.findall(r"([A-Za-z_$][\w$]*): \(\.\.\.a\) => ", t))
    for bloque in re.finditer(r"Object\.assign\(ACC, \{\n(.*?)\n\s*\}\);", t, re.S):
        registradas |= set(re.findall(r"^\s{2,4}([A-Za-z_$][\w$]*): \(", bloque.group(1), re.M))
        registradas |= set(re.findall(r"^\s{2,4}([A-Za-z_$][\w$]*): [^\n]*=>", bloque.group(1), re.M))

fuentes = [RAIZ / j for j in JS] + [RAIZ / "tools" / "armar.py"] + sorted((RAIZ / "marco").glob("*.tpl")) + [RAIZ / "marco" / "sitio.json"]
fuentes += [p for p in RAIZ.rglob("*.html") if ".claude" not in p.parts and "node_modules" not in p.parts and "dist" not in p.parts]
for p in fuentes:
    t = leer(p)
    for m in EN_LINEA.finditer(t):
        errores.append(f"{p.relative_to(RAIZ)}:{t[:m.start()].count(chr(10)) + 1}: manejador en línea ({m.group(0).strip()}…)")
    for n in re.findall(rf'data-(?:{EVENTOS})="([A-Za-z_$][\w$]*)"', t) + re.findall(r"dAcc\('([A-Za-z_$][\w$]*)'", t):
        usos.append((p.relative_to(RAIZ), n))

for p, n in sorted(set(usos), key=str):
    if n not in registradas:
        errores.append(f"{p}: la acción «{n}» no está registrada en ACC")

if errores:
    print("\n".join(errores))
    print(f"\n{len(errores)} problemas. Los manejadores van como data-clic=\"acción\" (ver ACC en app.js).")
    sys.exit(1)
print(f"Acciones: {len(set(n for _, n in usos))} usadas, {len(registradas)} registradas, 0 manejadores en línea.")
