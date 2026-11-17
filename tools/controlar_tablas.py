"""Control del CI: las tablas de los apuntes (resumenes/<materia>/<apunte>.json) tienen encabezados.

Cada <th> lleva scope="col" o scope="row", y la primera celda de cada fila del cuerpo es un <th scope="row">
(así el lector de pantalla dice a qué fila y columna pertenece cada dato). Sale de resumenes.py (encabezar_tablas).
Uso: python tools/controlar_tablas.py [raíz del sitio, por defecto .]
"""
import json
import re
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")


def problemas_de(cuerpo):
    """Lista de problemas de las tablas de un cuerpo de apunte (vacía si está bien)."""
    out = []
    for i, t in enumerate(re.findall(r"<table>[\s\S]*?</table>", cuerpo), 1):
        if re.search(r"<th(?=[\s>])(?![^>]*\bscope=)", t):
            out.append(f"tabla {i}: hay un <th> sin scope")
        cuerpo_t = re.search(r"<tbody>([\s\S]*)</tbody>", t)
        for fila in re.findall(r"<tr>([\s\S]*?)</tr>", cuerpo_t.group(1) if cuerpo_t else ""):
            if not re.match(r'\s*<th scope="row"[ >]', fila):
                out.append(f"tabla {i}: una fila del cuerpo no empieza con <th scope=\"row\">")
                break
    return out


def main(raiz):
    carpeta = Path(raiz) / "resumenes"
    if not carpeta.is_dir():
        print(f"No hay carpeta resumenes/ en {raiz}")
        return 1
    fallas, n = [], 0
    for f in sorted(carpeta.glob("*/*.json")):
        d = json.loads(f.read_text(encoding="utf-8"))
        if not isinstance(d, dict) or "cuerpo" not in d:
            continue
        n += d["cuerpo"].count("<table>")
        fallas += [f"{f.relative_to(carpeta).as_posix()}: {p}" for p in problemas_de(d["cuerpo"])]
    if fallas:
        print(f"{len(fallas)} tablas sin encabezado de fila:")
        print("\n".join("  " + x for x in fallas[:40]))
        print("Arreglo: python resumenes.py (encabezar_tablas) en 104-edicion-cursada.")
        return 1
    print(f"ok: {n} tablas con encabezados de columna y de fila")
    return 0


def autoprueba():
    bien = '<table>\n<thead>\n<tr>\n<th scope="col">A</th>\n</tr>\n</thead>\n<tbody>\n<tr>\n<th scope="row">x</th>\n<td>y</td>\n</tr>\n</tbody>\n</table>'
    assert problemas_de(bien) == []
    assert problemas_de(bien.replace('<th scope="row">', "<td>").replace("</th>\n<td>y", "</td>\n<td>y")), "fila sin <th scope=row>"
    assert problemas_de(bien.replace('<th scope="col">', "<th>")), "th sin scope"
    return 0


if __name__ == "__main__":
    if "--autoprueba" in sys.argv:
        sys.exit(autoprueba())
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "."))
