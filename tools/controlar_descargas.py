"""Control del CI: cada apunte publicado tiene sus descargas, y cada descarga apunta a un apunte que existe.

Mira r/<materia>/<slug>.html (sin index.html) contra datos/descargas/<materia>.json (apuntes[].id) y falla con la lista de lo que
sobra o falta. Una materia con páginas y sin manifiesto también falla.
Para generar y subir lo que falta: publicar_descargas.py (en 104-edicion-cursada, propuestas/2026-10-27-inicio/noche/latex).
Uso: python tools/controlar_descargas.py [raíz del sitio, por defecto .]
"""
import json
import re
import sys
from pathlib import Path

# Excepciones explícitas, p. ej. un simulacro que no se descarga: "<materia>/<slug>" (sin .html).
SIN_DESCARGA = set()
# Entradas del manifiesto sin página propia (p. ej. un archivo extra): "<materia>/<id>".
SIN_PAGINA = set()


sys.stdout.reconfigure(encoding="utf-8")


def main(raiz):
    raiz = Path(raiz)
    if not (raiz / "r").is_dir():
        print(f"No hay carpeta r/ en {raiz}")
        return 1
    problemas = []
    materias = sorted(d.name for d in (raiz / "r").iterdir() if d.is_dir() and re.fullmatch(r"\d{4}", d.name))
    for m in materias:
        paginas = {p.stem for p in (raiz / "r" / m).glob("*.html")} - {"index"}
        man = raiz / "datos" / "descargas" / f"{m}.json"
        if not man.exists():
            if paginas - {s.split("/", 1)[1] for s in SIN_DESCARGA if s.startswith(m + "/")}:
                problemas.append(f"{m}: hay {len(paginas)} apuntes publicados y falta datos/descargas/{m}.json")
            continue
        ids = {a.get("id") for a in json.loads(man.read_text(encoding="utf-8")).get("apuntes", [])}
        for s in sorted(paginas - ids):
            if f"{m}/{s}" not in SIN_DESCARGA:
                problemas.append(f"{m}/{s}: apunte publicado sin descargas (falta en datos/descargas/{m}.json)")
        for s in sorted(ids - paginas):
            if f"{m}/{s}" not in SIN_PAGINA:
                problemas.append(f"{m}/{s}: descargas de un apunte que ya no existe (sobra en datos/descargas/{m}.json)")
    if problemas:
        print("Descargas desparejas con los apuntes publicados:")
        print("\n".join("  · " + p for p in problemas))
        print("Arreglo: correr publicar_descargas.py (ver README de propuestas/2026-10-27-inicio/noche/latex) o, si es a propósito, "
              "sumar la excepción a SIN_DESCARGA / SIN_PAGINA en tools/controlar_descargas.py.")
        return 1
    print(f"descargas ok: {len(materias)} materias, todos los apuntes con sus archivos")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "."))
