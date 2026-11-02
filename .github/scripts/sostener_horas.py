"""Galera: cuántas horas de trabajo lleva el proyecto, contadas desde el historial público.

Método (el mismo que se explica en «Cómo se sostiene»):
  1. Toma la fecha y hora de cada commit de este repo (todas las ramas, así los commits de cada PR cuentan aunque
     después se junten con squash) y de cursada/ en ficha.github.io hasta el 29/10/2026, cuando el código pasó acá
     (esas marcas están en datos/sostener-historia.json).
  2. Los junta en sesiones: si entre un commit y el siguiente pasaron menos de 2 horas, son la misma sesión.
  3. Cada sesión dura lo que pasó entre su primer y su último commit, más 30 minutos de arranque.
Es una estimación, no un reloj. Escribe datos/sostener.json; si nada cambió salvo la fecha, no lo reescribe.
Solo biblioteca estándar. Uso: python .github/scripts/sostener_horas.py (con el historial completo: fetch-depth 0)."""
import datetime
import json
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
SALIDA = RAIZ / "datos" / "sostener.json"
HISTORIA = RAIZ / "datos" / "sostener-historia.json"
HUECO = 2 * 3600
ARRANQUE = 30 * 60
AR = datetime.timezone(datetime.timedelta(hours=-3))


def marcas():
    r = subprocess.run(["git", "-C", str(RAIZ), "log", "--all", "--format=%ct %ae"], capture_output=True, text=True, check=True)
    # Sin los commits del bot (datos de la Facultad, estas mismas horas): no son trabajo y sumarían media hora cada vez.
    propios = {int(l.split()[0]) for l in r.stdout.splitlines() if l.strip() and "github-actions" not in l}
    previos = set(json.loads(HISTORIA.read_text(encoding="utf-8"))["commits"]) if HISTORIA.exists() else set()
    return sorted(propios | previos), len(propios | previos)


def sesiones(ts):
    out = []
    for t in ts:
        if out and t - out[-1][1] < HUECO:
            out[-1][1] = t
            out[-1][2] += 1
        else:
            out.append([t, t, 1])
    return out


def main():
    ts, n = marcas()
    if not ts:
        sys.exit("No hay commits: ¿el checkout trae todo el historial (fetch-depth: 0)?")
    ses = sesiones(ts)
    por_mes, total = {}, 0
    for ini, fin, _ in ses:
        seg = fin - ini + ARRANQUE
        total += seg
        mes = datetime.datetime.fromtimestamp(ini, AR).strftime("%Y-%m")
        por_mes[mes] = por_mes.get(mes, 0) + seg
    datos = {
        "horas_totales": round(total / 3600, 1),
        "horas_por_mes": {m: round(s / 3600, 1) for m, s in sorted(por_mes.items())},
        "sesiones": len(ses),
        "commits": n,
        "primer_commit": datetime.datetime.fromtimestamp(ts[0], AR).strftime("%Y-%m-%d"),
        "metodo": {"hueco_horas": HUECO // 3600, "arranque_minutos": ARRANQUE // 60},
    }
    if SALIDA.exists():
        previo = json.loads(SALIDA.read_text(encoding="utf-8"))
        if {k: v for k, v in previo.items() if k != "generado"} == datos:
            print(f"Sin cambios: {datos['horas_totales']} h, {datos['sesiones']} sesiones, {datos['commits']} commits.")
            return
    datos["generado"] = datetime.datetime.now(AR).strftime("%Y-%m-%d")
    SALIDA.write_text(json.dumps(datos, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"{datos['horas_totales']} h en {datos['sesiones']} sesiones ({datos['commits']} commits) desde {datos['primer_commit']}.")


if __name__ == "__main__":
    main()
