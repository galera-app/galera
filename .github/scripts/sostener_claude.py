"""Galera: guarda el rango de horas medido con las sesiones de Claude (lo calcula horas_reales.py en la PC de Fidel y lo manda
por workflow_dispatch). Valida la forma antes de escribir datos/sostener-claude.json: es lo único que entra de afuera.
Uso: CLAUDE_JSON='{...}' python .github/scripts/sostener_claude.py"""
import datetime
import json
import os
import re
import sys
from pathlib import Path

SALIDA = Path(__file__).resolve().parents[2] / "datos" / "sostener-claude.json"
AR = datetime.timezone(datetime.timedelta(hours=-3))
FECHA = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def main():
    crudo = os.environ.get("CLAUDE_JSON", "").strip()
    if not crudo:
        print("Sin rango de Claude: no se toca sostener-claude.json.")
        return
    d = json.loads(crudo)
    for k in ("minimo", "central", "maximo", "ventanas", "mensajes"):
        if not isinstance(d.get(k), int) or isinstance(d.get(k), bool) or not 0 < d[k] < 100000:
            sys.exit(f"Campo inválido: {k}")
    if not d["minimo"] <= d["central"] <= d["maximo"]:
        sys.exit("El rango no es creciente.")
    for k in ("desde", "hasta"):
        if not FECHA.match(str(d.get(k, ""))):
            sys.exit(f"Fecha inválida: {k}")
    d = {k: d[k] for k in ("minimo", "central", "maximo", "ventanas", "mensajes", "desde", "hasta")}
    d["metodo"] = {"hueco_min": [10, 20, 45], "arranque_min": [10, 15, 20]}
    if SALIDA.exists():
        previo = json.loads(SALIDA.read_text(encoding="utf-8"))
        if {k: v for k, v in previo.items() if k != "generado"} == d:
            print("Sin cambios en el rango de Claude.")
            return
    d["generado"] = datetime.datetime.now(AR).strftime("%Y-%m-%d")
    SALIDA.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"Rango de Claude: {d['minimo']}–{d['maximo']} h (central {d['central']}).")


if __name__ == "__main__":
    main()
