"""Color fijo por materia (CP3 y CP10, 15/11/2026): reparte los pigmentos lisos de datos/pigmentos.json entre las materias de
datos/edicion.json y escribe el campo `pigmento` (el nombre) en cada una.

Uso:
    python tools/pigmentos_materias.py              # reparte y reescribe edicion.json (solo toca el campo pigmento)
    python tools/pigmentos_materias.py --controlar  # revisa que cada materia tenga un pigmento liso válido

Cómo reparte: recorre las materias (obligatorias, electivas y después idiomas y final) por cuatrimestre y módulo, y a cada una le da el pigmento que menos se repite entre las ya
repartidas que se pueden cursar en el mismo cuatrimestre (y, a igualdad, el menos usado en total y después el primero de la lista). Cuentan como vecinas las del mismo cuatrimestre y tramo (el CBC va aparte) con módulos a
una distancia de 1 o menos. Así, las que suelen ir juntas en la semana no comparten color. Si igual coinciden dos en una semana, compartir.js le da a la segunda
el siguiente libre al dibujar. Vale para horarios y «Mi semana»; el ejemplar de materia aprobada conserva su pigmento sorteado (CP10).
El reparto es determinista: correrlo de nuevo da lo mismo mientras no cambien las materias ni los pigmentos."""
import argparse, json, re, sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
EDICION = RAIZ / "datos" / "edicion.json"
PIGMENTOS = RAIZ / "datos" / "pigmentos.json"


def lisos():
    return [p["nombre"] for p in json.loads(PIGMENTOS.read_text(encoding="utf-8"))["pigmentos"] if p["plano"]]


def juntas(a, b):
    """¿Pueden caer en la misma semana? Mismo cuatrimestre, mismo tramo (el CBC va aparte) y módulos vecinos (o sin módulo)."""
    if not set(a.get("cuat") or []) & set(b.get("cuat") or []) or (a.get("grupo") == "cbc") != (b.get("grupo") == "cbc"):
        return False
    return a.get("modulo") is None or b.get("modulo") is None or abs(a["modulo"] - b["modulo"]) <= 1


def repartir(materias, pigs):
    # Primero las obligatorias de un solo cuatrimestre, después las que se dan en los dos (electivas) y al final las sin módulo
    # (idiomas, final), que pueden caer con cualquiera.
    orden = sorted(range(len(materias)), key=lambda i: (materias[i].get("modulo") is None, len(materias[i].get("cuat") or []) > 1,
                                                       min(materias[i].get("cuat") or ["9"]), materias[i].get("modulo") or 9, i))
    dado, uso = {}, {p: 0 for p in pigs}
    for i in orden:
        m = materias[i]
        vecinas = [dado[j] for j in dado if juntas(materias[j], m)]
        p = min(pigs, key=lambda p: (vecinas.count(p), uso[p], pigs.index(p)))
        dado[i] = p; uso[p] += 1
    return {materias[i]["id"]: p for i, p in dado.items()}


def escribir(asig):
    t = EDICION.read_text(encoding="utf-8")
    base = t.index('"materias": [')  # los grupos de arriba repiten algunos id
    for mid, p in asig.items():
        hall = list(re.compile(r'\{"id": ' + re.escape(json.dumps(mid)) + r', (?=(?:"pigmento": "[^"]*", )?"grupo": )').finditer(t, base))
        if len(hall) != 1:
            raise SystemExit(f"no encuentro la materia {mid} en una sola línea de edicion.json")
        i = hall[0].end()
        fin = t.index("\n", i)
        linea = re.sub(r'"pigmento": "[^"]*", ', "", t[i:fin])
        t = t[:i] + '"pigmento": ' + json.dumps(p, ensure_ascii=False) + ", " + linea + t[fin:]
    json.loads(t)
    EDICION.write_text(t, encoding="utf-8", newline="\n")


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--controlar", action="store_true")
    a = ap.parse_args()
    pigs = lisos()
    materias = json.loads(EDICION.read_text(encoding="utf-8"))["materias"]
    if not a.controlar:
        escribir(repartir(materias, pigs))
        materias = json.loads(EDICION.read_text(encoding="utf-8"))["materias"]
    malas = [m["id"] for m in materias if m.get("pigmento") not in pigs]
    for m in materias:
        print(f"{m['id']:12} {m.get('sigla', ''):8} {','.join(m.get('cuat') or []):12} {m.get('pigmento')}")
    if malas:
        print("ERROR materias sin pigmento liso válido:", ", ".join(malas), "(correr tools/pigmentos_materias.py)")
    sys.exit(1 if malas else 0)


if __name__ == "__main__":
    main()
