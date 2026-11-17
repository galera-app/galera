#!/usr/bin/env python3
"""Mapa de piezas y pruebas (paso 22 del plan).

Piezas: cada pantalla de marco/sitio.json (con url) y cada simulador (simuladores/<id>.html).
Cinco niveles de prueba, cada uno con su evidencia leída de los archivos (no escrita a mano):

  unidad      un módulo JS de la pieza tiene tools/pruebas/<módulo>.test.js, o lo nombra un probar_*.js/.mjs
              (probar_simuladores.js no cuenta: es el humo de los simuladores)
  humo        la url está en RUTAS de tools/humo.py, o un módulo de la pieza está en MODULOS de tools/probar_simuladores.js
  navegador   la url está en pantallas() de tools/navegador.py (el apunte de /r/ cuenta como prefijo /r/)
  recorrido   la url la abrió un recorrido o el barrido de tools/recorridos.py (lo deja --rutas)
  rendimiento la url está en PAGINAS de tools/pesos.py o PAGINAS_LAB de tools/rendimiento.py

Una url cubre a una pieza si es igual, o si termina en / (y no es /) y la evidencia empieza por ella.
Lo único escrito a mano es tools/mapa-piezas.json: qué módulos JS respaldan cada pieza. Falla si una pieza de
sitio.json no figura ahí, o si figura una que ya no existe.

Una pieza con menos de dos niveles va a tools/sin-dos-pruebas.json. Esa lista solo puede achicarse:
el control falla si aparece una pieza que no estaba.

    python tools/mapa_pruebas.py                     controla contra tools/sin-dos-pruebas.json (lo que corre el CI)
    python tools/mapa_pruebas.py --rutas X.json      además usa las rutas que dejó recorridos.py --rutas X.json
    python tools/mapa_pruebas.py --actualizar        achica la lista a lo que quedó (nunca suma)
    python tools/mapa_pruebas.py --autoprueba        casos de la lógica pura (el CI la corre antes)
"""
import argparse
import ast
import json
import re
import sys
from datetime import date
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
TOOLS = RAIZ / "tools"
LISTA = TOOLS / "sin-dos-pruebas.json"
MAPA = TOOLS / "mapa-piezas.json"
NIVELES = ("unidad", "humo", "navegador", "recorrido", "rendimiento")
MINIMO = 2


# ---------- lógica pura (con sus casos en --autoprueba) ----------

def cubre(evidencia, url):
    """La evidencia cubre la url: igual, o un prefijo de directorio (/r/ cubre /r/0905/x.html; / solo cubre /)."""
    return evidencia == url or (url != "/" and url.endswith("/") and evidencia.startswith(url))


def cubre_alguna(evidencias, url):
    return any(cubre(e, url) for e in evidencias)


def unidad_de(modulo, textos):
    """True si alguna prueba nombra el módulo: 'num.js', o 'num' / 'Num' entre comillas."""
    s, S = re.escape(modulo), re.escape(modulo.capitalize())
    pat = re.compile(rf"['\"`]{s}(\.js)?['\"`]|['\"`]{S}['\"`]|\b{s}\.js(?![\w-])")
    return any(pat.search(t) for t in textos.values())


def niveles_de(url, modulos, d):
    """Niveles que tiene una pieza. d: unidad (módulo -> bool), humo_rutas, humo_modulos, navegador_rutas,
    recorrido_rutas (None si no se pasó --rutas), rendimiento_rutas."""
    tiene = {
        "unidad": any(d["unidad"].get(m, False) for m in modulos),
        "humo": cubre_alguna(d["humo_rutas"], url) or any(m in d["humo_modulos"] for m in modulos),
        "navegador": cubre_alguna(d["navegador_rutas"], url),
        "recorrido": d["recorrido_rutas"] is not None and cubre_alguna(d["recorrido_rutas"], url),
        "rendimiento": cubre_alguna(d["rendimiento_rutas"], url),
    }
    return [n for n in NIVELES if tiene[n]]


def sin_dos(niveles):
    """Piezas (id -> niveles) con menos de MINIMO niveles, ordenadas."""
    return sorted(i for i, ns in niveles.items() if len(ns) < MINIMO)


def chequear(sin, comprometida):
    """Compara la lista calculada con la commiteada. nuevas: crece (falla). sobran: se puede achicar (no falla)."""
    return sorted(set(sin) - set(comprometida)), sorted(set(comprometida) - set(sin))


def faltantes(piezas, mapa):
    """Piezas sin entrada en el mapa, y entradas del mapa que ya no son piezas."""
    return sorted(set(piezas) - set(mapa)), sorted(set(mapa) - set(piezas))


def autoprueba():
    casos = 0
    fallas = []

    def caso(nombre, obtenido, esperado):
        nonlocal casos
        casos += 1
        if obtenido != esperado:
            fallas.append(f"{nombre}: {obtenido!r} (se esperaba {esperado!r})")

    caso("cubre: igual", cubre("/carrera/", "/carrera/"), True)
    caso("cubre: prefijo de directorio", cubre("/r/0905/x.html", "/r/"), True)
    caso("cubre: / solo cubre /", cubre("/carrera/", "/"), False)
    caso("cubre: / igual", cubre("/", "/"), True)
    caso("cubre: otra ruta no cubre", cubre("/lecturas/", "/legal/"), False)
    caso("cubre: prefijo sin barra final no cubre", cubre("/r0905", "/r/"), False)
    caso("cubre: subpágina de lecturas", cubre("/lecturas/argentina-siglo-xix/", "/lecturas/"), True)

    base = {"unidad": {}, "humo_rutas": [], "humo_modulos": set(), "navegador_rutas": [], "recorrido_rutas": None, "rendimiento_rutas": []}
    caso("niveles: sin evidencia", niveles_de("/x/", [], base), [])
    d = dict(base, unidad={"app": True}, humo_rutas=["/x/"])
    caso("niveles: unidad y humo", niveles_de("/x/", ["app"], d), ["unidad", "humo"])
    caso("niveles: módulo sin prueba no da unidad", niveles_de("/x/", ["leyes"], dict(base, unidad={"leyes": False})), [])
    caso("niveles: humo por módulo del simulador", niveles_de("/s.html", ["papel"], dict(base, humo_modulos={"papel"})), ["humo"])
    caso("niveles: recorrido sin --rutas no cuenta", niveles_de("/x/", [], dict(base, navegador_rutas=["/x/"], recorrido_rutas=None)), ["navegador"])
    caso("niveles: recorrido con --rutas", niveles_de("/x/", [], dict(base, recorrido_rutas=["/x/"], rendimiento_rutas=["/x/"])), ["recorrido", "rendimiento"])
    caso("niveles: orden fijo", niveles_de("/x/", ["app"], dict(base, unidad={"app": True}, rendimiento_rutas=["/x/"], navegador_rutas=["/x/"])),
         ["unidad", "navegador", "rendimiento"])

    niv = {"pantalla:a": ["unidad", "humo"], "pantalla:b": ["humo"], "pantalla:c": []}
    caso("sin_dos: lista las que tienen menos de dos", sin_dos(niv), ["pantalla:b", "pantalla:c"])
    caso("chequear: crece", chequear(["a", "b"], ["a"]), (["b"], []))
    caso("chequear: achica", chequear(["a"], ["a", "c"]), ([], ["c"]))
    caso("chequear: igual", chequear(["a"], ["a"]), ([], []))

    caso("faltantes: pieza sin mapa", faltantes(["pantalla:a", "pantalla:b"], {"pantalla:a": ["app"]}), (["pantalla:b"], []))
    caso("faltantes: mapa sin pieza", faltantes(["pantalla:a"], {"pantalla:a": ["app"], "pantalla:z": ["app"]}), ([], ["pantalla:z"]))

    caso("unidad: archivo que nombra el módulo", unidad_de("num", {"t": "cargar('num', 'Num');"}), True)
    caso("unidad: nombre con .js", unidad_de("app", {"t": "fs.readFileSync(path.join(raiz, 'app.js'))"}), True)
    caso("unidad: nombre de global cuenta", unidad_de("papel", {"t": "const P = 'Papel';"}), True)
    caso("unidad: prefijo no basta", unidad_de("papel", {"t": "'papelera' y papel.jsx"}), False)
    caso("unidad: comillas exactas", unidad_de("lomo", {"t": "probar('lomo.js-viejo')"}), False)

    if fallas:
        print("\n".join(fallas))
        print(f"mapa_pruebas --autoprueba: {len(fallas)} de {casos} casos fallan")
        return 1
    print(f"mapa_pruebas --autoprueba: {casos} casos ok")
    return 0


# ---------- lectura de los archivos ----------

def leer_json(p):
    return json.loads(p.read_text(encoding="utf-8"))


def asignacion(archivo, nombre):
    """Valor literal de una asignación de nivel de módulo (RUTAS, PAGINAS, PAGINAS_LAB), leído con ast."""
    for nodo in ast.parse(archivo.read_text(encoding="utf-8")).body:
        if isinstance(nodo, ast.Assign) and any(isinstance(t, ast.Name) and t.id == nombre for t in nodo.targets):
            return ast.literal_eval(nodo.value)
    raise SystemExit(f"{archivo.name}: no encuentro {nombre}")


def cadena_de_retorno(fn):
    """Primera ruta que devuelve una función: literal, o el prefijo fijo de una f-string (\"/r/{…}\" -> \"/r/\")."""
    for nodo in ast.walk(fn):
        if isinstance(nodo, ast.Return) and nodo.value is not None:
            v = nodo.value
            if isinstance(v, ast.Constant) and isinstance(v.value, str):
                return v.value
            if isinstance(v, ast.JoinedStr) and v.values and isinstance(v.values[0], ast.Constant):
                return v.values[0].value
    return None


def rutas_del_navegador():
    arbol = ast.parse((TOOLS / "navegador.py").read_text(encoding="utf-8"))
    funciones = {n.name: n for n in arbol.body if isinstance(n, ast.FunctionDef)}
    rutas = []
    for n in ast.walk(funciones["pantallas"]):
        if isinstance(n, ast.Tuple) and len(n.elts) == 3:
            v = n.elts[1]
            if isinstance(v, ast.Constant) and isinstance(v.value, str):
                rutas.append(v.value)
            elif isinstance(v, ast.Call) and isinstance(v.func, ast.Name) and v.func.id in funciones:
                rutas.append(cadena_de_retorno(funciones[v.func.id]))
    return [r for r in rutas if r]


def modulos_del_humo():
    texto = (TOOLS / "probar_simuladores.js").read_text(encoding="utf-8")
    bloque = re.search(r"MODULOS = \{(.*?)\};", texto, re.S).group(1)
    return set(re.findall(r"(\w+): '\w+'", bloque))


def textos_de_unidad():
    archivos = sorted((TOOLS / "pruebas").glob("*.test.js"))
    archivos += sorted(p for p in TOOLS.glob("probar_*") if p.suffix in (".js", ".mjs") and p.name != "probar_simuladores.js")
    return {p.name: p.read_text(encoding="utf-8") for p in archivos}


def piezas_del_sitio():
    sitio = leer_json(RAIZ / "marco" / "sitio.json")
    piezas = {f"pantalla:{k}": v["url"] for k, v in sitio["pantallas"].items() if isinstance(v, dict) and v.get("url")}
    piezas.update({f"simulador:{s['id']}": f"/simuladores/{s['id']}.html" for s in sitio.get("simuladores", [])})
    return piezas


def construir(piezas):
    """Por pieza: (url, módulos del mapa). Falla si el mapa no coincide con sitio.json o nombra un módulo que no existe."""
    mapa_raw = leer_json(MAPA)
    mapa = {}
    for tipo, clave in (("pantallas", "pantalla"), ("simuladores", "simulador")):
        for k, mods in mapa_raw.get(tipo, {}).items():
            mapa[f"{clave}:{k}"] = mods
    sin_mapa, sobra = faltantes(piezas, mapa)
    errores = [f"{p}: sin entrada en tools/mapa-piezas.json (qué módulos JS la respaldan)" for p in sin_mapa]
    errores += [f"{p}: está en tools/mapa-piezas.json pero no es pantalla ni simulador de marco/sitio.json" for p in sobra]
    for p, mods in mapa.items():
        for m in mods:
            if not (RAIZ / f"{m}.js").is_file():
                errores.append(f"{p}: el módulo «{m}» no existe ({m}.js)")
    return {p: (piezas[p], mapa[p]) for p in piezas if p in mapa}, errores


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--rutas", help="JSON de rutas visitadas que escribe recorridos.py --rutas")
    ap.add_argument("--actualizar", action="store_true", help="achica tools/sin-dos-pruebas.json a lo que quedó (nunca suma)")
    ap.add_argument("--autoprueba", action="store_true", help="casos de la lógica pura, sin leer el sitio")
    a = ap.parse_args()
    if a.autoprueba:
        return autoprueba()

    piezas, errores = construir(piezas_del_sitio())
    if errores:
        print("\n".join(errores))
        print(f"\n{len(errores)} problemas con tools/mapa-piezas.json")
        return 1

    unidad_textos = textos_de_unidad()
    modulos = {m for _, mods in piezas.values() for m in mods}
    d = {
        "unidad": {m: (RAIZ / "tools" / "pruebas" / f"{m}.test.js").is_file() or unidad_de(m, unidad_textos) for m in modulos},
        "humo_rutas": asignacion(TOOLS / "humo.py", "RUTAS"),
        "humo_modulos": modulos_del_humo(),
        "navegador_rutas": rutas_del_navegador(),
        "recorrido_rutas": json.loads(Path(a.rutas).read_text(encoding="utf-8")) if a.rutas else None,
        "rendimiento_rutas": list(asignacion(TOOLS / "pesos.py", "PAGINAS")) + list(asignacion(TOOLS / "rendimiento.py", "PAGINAS_LAB")),
    }
    niveles = {p: niveles_de(url, mods, d) for p, (url, mods) in piezas.items()}
    sin = sin_dos(niveles)

    print(f"Piezas con menos de {MINIMO} pruebas ({len(sin)} de {len(piezas)}):")
    for p in sin:
        print(f"  - {p}: tiene {', '.join(niveles[p]) or 'ninguna'}")
    if a.rutas is None:
        print("(sin --rutas: no se cuenta el nivel recorrido)")

    comprometida = leer_json(LISTA)["piezas"] if LISTA.is_file() else None
    if a.actualizar:
        if comprometida is not None:
            nuevas, _ = chequear(sin, comprometida)
            if nuevas:
                print("--actualizar no suma piezas: " + ", ".join(nuevas) + ". Sumá pruebas o editá el JSON a mano y explicalo en el commit.")
                return 1
        LISTA.write_text(json.dumps({"_fecha": date.today().isoformat(),
                                     "_nota": "Piezas de marco/sitio.json y simuladores con menos de dos niveles de prueba. Solo puede achicarse: python tools/mapa_pruebas.py --rutas X.json --actualizar",
                                     "piezas": sin}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        print(f"tools/sin-dos-pruebas.json: {len(sin)} piezas")
        return 0

    if a.rutas is None:
        # Sin el nivel recorrido la lista sale más larga que la commiteada: no se controla. El CI pasa --rutas.
        print("Sin --rutas no se controla la lista (la controla el CI con las rutas de recorridos.py).")
        return 0
    if comprometida is None:
        print("Falta tools/sin-dos-pruebas.json: python tools/mapa_pruebas.py --rutas X.json --actualizar")
        return 1
    nuevas, sobran = chequear(sin, comprometida)
    if nuevas:
        print("Piezas nuevas sin dos pruebas (la lista no puede crecer): " + ", ".join(nuevas))
        return 1
    if sobran:
        print(f"La lista se puede achicar ({len(sobran)}): python tools/mapa_pruebas.py --actualizar")
    print("mapa de piezas ok")
    return 0


if __name__ == "__main__":
    sys.exit(main())
