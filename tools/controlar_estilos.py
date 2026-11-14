#!/usr/bin/env python3
"""Controla que no haya estilos en línea: la CSP (style-src 'self', sin 'unsafe-inline') bloquea el atributo style="…" y las etiquetas <style>.

Falla si aparece, en un HTML, una plantilla de marco/, un JS de la app o tools/armar.py:
- un atributo style="…" (también dentro de strings de JS que se vuelcan con innerHTML);
- una etiqueta <style>;
- 'unsafe-inline' en style-src de marco/sitio.json.
No cuenta `el.style.x = …` ni `style.setProperty` (CSSOM: la CSP no lo bloquea). Un valor dinámico va como
data-est="width:30%;left:2%" (lo aplica estilar() en app.js); un valor fijo, como clase u-* en estilos.css.
Excepciones: archivos descargables sin CSP (EXCEPCIONES) y pruebas del sitio de prueba.
Uso: python tools/controlar_estilos.py        (desde la raíz del repo)
"""
import json, re, sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
# Archivos que no pasan por la CSP del sitio: el descargable del Planificador (lleva su propio <style>) y los sitios de prueba.
EXCEPCIONES = {"libro/planificador-de-libros.html", "prueba/componentes/index.html", "prueba/index.html"}
# Los <style> dentro de un SVG que se baja como archivo (no se inserta en la página) están permitidos.
ESTILO_EN_ARCHIVO = {"lomo.js"}
ATRIBUTO = re.compile(r"""[\s'"`]style\s*=\s*["'\\]|style=\$\{""")
ETIQUETA = re.compile(r"<style[\s>]", re.I)
IGNORAR = ("vendor", "node_modules", "dist", ".claude", "_galera-armado")


def fuentes():
    for p in sorted(RAIZ.rglob("*")):
        rel = p.relative_to(RAIZ)
        if any(x in rel.parts for x in IGNORAR) or not p.is_file():
            continue
        if p.suffix in (".html", ".tpl", ".js", ".mjs") or rel.as_posix() == "tools/armar.py":
            if p.name in ("marco.js", "sw.js") or rel.parts[0] == "tools" and rel.name != "armar.py":
                continue
            yield rel, p


errores = []
for rel, p in fuentes():
    r = rel.as_posix()
    if r in EXCEPCIONES:
        continue
    for n, linea in enumerate(p.read_text(encoding="utf-8").splitlines(), 1):
        # Un comentario que cita style="…" (como el de imprenta-editor.js) no cuenta.
        if re.match(r"\s*(//|\*|/\*)", linea) or "estilos-ok" in linea:
            continue
        if ATRIBUTO.search(linea):
            errores.append(f"{r}:{n}: atributo style en línea (usá una clase u-* o data-est)")
        if ETIQUETA.search(linea) and p.name not in ESTILO_EN_ARCHIVO:
            errores.append(f"{r}:{n}: etiqueta <style> en línea (pasala a una hoja de estilos)")

for clave, csp in json.loads((RAIZ / "marco" / "sitio.json").read_text(encoding="utf-8"))["csp"].items():
    m = re.search(r"style-src([^;]*)", csp)
    if m and "'unsafe-inline'" in m.group(1):
        errores.append(f"marco/sitio.json: la CSP «{clave}» admite 'unsafe-inline' en style-src")

if errores:
    print("\n".join(errores))
    print(f"\n{len(errores)} problemas. La CSP no admite estilos en línea: ver el encabezado de tools/controlar_estilos.py.")
    sys.exit(1)
print("Estilos: 0 atributos style ni <style> en línea, style-src sin 'unsafe-inline'.")
