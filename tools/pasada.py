#!/usr/bin/env python3
"""Pasada de celular (paso 26 del plan): arma la lista de toques de la tanda según lo que cambió desde la última
versión publicada (tag `produccion`) y guarda cada resultado en un archivo de texto que la pasada siguiente lee.

    python tools/pasada.py              pasada interactiva: por cada toque, ok / falla / salteo (se guarda al instante)
    python tools/pasada.py --lista      solo muestra la lista, con el último resultado de cada toque (no pregunta ni guarda)
    python tools/pasada.py --autoprueba casos de la tabla (función pura; lo corre el CI)

Fuentes, sin copiar nada a mano:
- marco/sitio.json: las pantallas (clave, título y url). Una carpeta del repo con el nombre de una url (`carrera/`,
  `r/`, `simuladores/`) es de esa pantalla.
- tools/navegador.py: las rutas que el CI ya abre en iPhone (se lee la función pantallas() con ast).

Lo que cambió en un archivo se traduce a pantallas con REGLAS. Lo que no encaja en nada va como «revisar a mano».
Lo que quedó «sin verificar» en otros pasos va en FIJOS y sale en cada pasada hasta que se anota un ok.

El estado (`pasada-estado.txt`, en la raíz del repo, en .gitignore) tiene una línea por resultado:
    AAAA-MM-DD <TAB> id <TAB> ok|falla|salteo <TAB> nota
Al empezar, los toques que fallaron la última vez salen primero.
"""
import argparse
import ast
import datetime
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SITIO = RAIZ / "marco" / "sitio.json"
NAVEGADOR = RAIZ / "tools" / "navegador.py"
ESTADO = RAIZ / "pasada-estado.txt"
BASE = "produccion"
RESULTADOS = ("ok", "falla", "salteo")

# Pseudo-pantallas: no están en marco/sitio.json pero tienen toques propios.
PSEUDO = {"menu": "Menú y pie", "piezas": "Piezas de compartir", "fijo": "Fijo (sin verificar)"}

# Toques por pantalla (clave de marco/sitio.json o pseudo-pantalla). Dos o tres por pantalla, concretos.
TOQUES = {
    "carrera": [
        "Cargar una materia nueva, cambiarle el estado y ver que el promedio se actualiza",
        "Abrir la ficha de una materia aprobada: nota y fecha se ven completas",
        "Recargar la página: los datos siguen ahí y el menú no se corta",
    ],
    "horarios": [
        "Elegir dos materias que se pisan y ver el aviso de superposición",
        "Cambiar de comisión y comprobar que la grilla se redibuja sin saltos",
    ],
    "calendario": [
        "Pasar de la vista de mes a la de lista y comprobar las fechas de inscripción y de finales",
        "Tocar exportar (.ics): el archivo se descarga",
    ],
    "resumenes": [
        "Abrir un apunte y leerlo hasta el final, sin saltos de texto raros",
        "Tocar una pregunta de autoevaluación y ver la respuesta",
    ],
    "buscar": [
        "Escribir una palabra de la materia en el buscador y tocar un resultado",
        "Borrar el texto con la X y volver a escribir: no se traba",
    ],
    "simuladores": [
        "Abrir el escandallo, cambiar un número y ver el resultado",
        "Abrir un simulador de papel y comprobar que nada se sale de la pantalla",
    ],
    "imprimir": [
        "Elegir un PDF de prueba y leer el informe de sangrado y fuentes",
    ],
    "imprenta": [
        "Pegar un texto corto, generar el PDF y abrirlo",
    ],
    "glosario": [
        "Buscar un término y abrir su definición",
        "Mover el grafo con el dedo sin que la página se desplace",
    ],
    "eventos": [
        "Abrir una feria y tocar su fuente oficial",
    ],
    "directorio": [
        "Filtrar por tipo y abrir una ficha",
        "Bajar hasta el final de la lista sin que se corte ni se repita",
    ],
    "biblioteca": [
        "Filtrar por idioma y abrir un libro con su link oficial",
    ],
    "links": [
        "Tocar tres links de la lista y comprobar que abren el sitio oficial",
    ],
    "lecturas": [
        "Abrir un mapa de materia y tocar una lectura",
    ],
    "preguntas": [
        "Abrir una pregunta frecuente y tocar «dejar mi pregunta»",
    ],
    "novedades": [
        "Leer la última novedad y comprobar la fecha y la versión",
    ],
    "sostener": [
        "Tocar un aporte y comprobar que el link de pago abre en otra pestaña",
    ],
    "config": [
        "Cambiar un ajuste de avisos, recargar y comprobar que el cambio se mantiene",
        "Copiar los datos en un navegador de prueba y volver a importarlos",
    ],
    "arcade": [
        "Jugar una ronda de preguntas hasta perder las tres vidas",
    ],
    "inicio": [
        "Abrir el inicio y comprobar que la frase principal se lee entera",
        "Tocar el menú y entrar a Mi carrera y a Horarios",
    ],
    "/legal/": [
        "Abrir Legal y comprobar que el texto no se sale de la pantalla",
    ],
    "piezas": [
        "Compartir una materia aprobada: la imagen se ve entera y se puede descargar",
        "Compartir un horario: el texto de la vista previa es el correcto",
    ],
    "menu": [
        "Abrir el menú y recorrer Planificar, Estudiar y Producir",
        "Ir al pie y comprobar los links de Legal y Configuración",
    ],
}
# Pantalla sin toques propios: dos genéricos (así no queda ninguna pantalla sin nada que mirar).
GENERICO = [
    "Abrir la pantalla y comprobar que su título se lee",
    "Tocar el botón principal y volver atrás",
]

# Archivo → pantallas. El primero que encaja gana; si ninguno encaja, se mira la carpeta (ver pantallas_de).
REGLAS = [
    (r"^index\.html$", ["inicio"]),
    (r"^horarios\.js$", ["horarios"]),
    (r"^datos/oferta", ["horarios", "calendario"]),
    (r"^datos/calendario", ["calendario"]),
    (r"^datos/directorio", ["directorio"]),
    (r"^datos/(novedades|plan)", ["novedades", "sostener"]),
    (r"^datos/(mecenas|sostener)", ["sostener"]),
    (r"^datos/marca\.json$", ["inicio", "menu"]),
    (r"^datos/pigmentos\.json$", ["carrera", "piezas"]),
    (r"^compartir\.js$", ["piezas"]),
    (r"^ejemplar\.js$", ["carrera", "piezas"]),
    (r"^app\.js$", ["carrera", "inicio"]),
    (r"^(escandallo|papel|formatos|paginacion|lomo|ecosistema)\.js$", ["simuladores"]),
    (r"^num\.js$", ["carrera", "simuladores"]),
    (r"^buscador\.js$", ["buscar"]),
    (r"^(grafo|glosario)", ["glosario"]),
    (r"^(imprenta|prensa)", ["imprenta"]),
    (r"^marco/", ["menu", "inicio"]),
    (r"^tools/armar\.py$", ["menu", "inicio"]),
    (r"^\.github/workflows/desplegar\.yml$", ["inicio"]),
    (r"^(estilos|tokens|componentes|galera)\.css$", ["menu", "inicio", "carrera"]),
    (r"^(menu|tema)\.js$", ["menu"]),
    (r"^sw\.js$", ["inicio", "carrera", "horarios", "calendario"]),
    (r"^manifest\.webmanifest$", ["inicio"]),
]

# Cambios que no tocan ninguna pantalla (tooling, documentos, propuestas).
IGNORADOS = re.compile(r"^(?!tools/armar\.py$|\.github/workflows/desplegar\.yml$)"
                       r"(\.github/|tools/|propuestas/|_fuentes/|sugerencias/|[^/]+\.md$|\.gitignore$)")

# Lo que quedó «sin verificar» en otros pasos (regla 8 del plan). Sale en cada pasada hasta que se anota un ok.
FIJOS = [
    ("materia-aprobada-iphone", "Materia aprobada (v180, sin verificar en iPhone real): marcar Corrección de Estilo "
     "desde la carga rápida, abrir «¡Aprobaste!», pasar el ejemplar a post y descargarlo"),
    ("sin-conexion-v182", "Sin conexión (v182, paso 27, sin verificar): tras una visita, cortar la red y abrir "
     "inicio, Mi carrera, Horarios y Calendario"),
    ("manifest-v181", "Instalar en iPhone (manifest de v181, sin verificar): el nombre, el ícono y los accesos a "
     "Mi carrera, Horarios, Calendario y Resúmenes"),
]


def leer_sitio(ruta=SITIO):
    """Pantallas de marco/sitio.json: {clave: {"t": título, "url": url}}."""
    return json.loads(ruta.read_text(encoding="utf-8"))["pantallas"]


def seccion_de_url(url):
    """'/carrera/' → 'carrera'. La portada ('/') no tiene sección."""
    return url.strip("/").split("/")[0]


def rutas_navegador(texto=None):
    """[(nombre, ruta)] de la función pantallas() de tools/navegador.py. ruta es None si se arma en código (el apunte de /r/)."""
    texto = texto if texto is not None else NAVEGADOR.read_text(encoding="utf-8")
    for nodo in ast.walk(ast.parse(texto)):
        if isinstance(nodo, ast.FunctionDef) and nodo.name == "pantallas":
            for ret in ast.walk(nodo):
                if isinstance(ret, ast.Return) and isinstance(ret.value, ast.List):
                    rutas = []
                    for t in ret.value.elts:
                        if isinstance(t, ast.Tuple) and len(t.elts) >= 2:
                            nombre, ruta = t.elts[0], t.elts[1]
                            rutas.append((nombre.value if isinstance(nombre, ast.Constant) else "?",
                                          ruta.value if isinstance(ruta, ast.Constant) else None))
                    return rutas
    raise SystemExit("tools/navegador.py: no encuentro pantallas()")


def pantallas_de(archivo, por_seccion):
    """Claves de pantalla que toca un archivo; None si no encaja en nada (va a «revisar a mano»)."""
    for patron, claves in REGLAS:
        if re.search(patron, archivo):
            return claves
    primera = archivo.split("/")[0]
    if "/" in archivo and primera in por_seccion:
        return [por_seccion[primera]]
    return None


def clasificar(archivos, sitio):
    """Función pura. Devuelve {"pantallas": {clave: [archivos]}, "revisar": [archivos], "ignorados": [archivos]}."""
    por_seccion = {seccion_de_url(p["url"]): k for k, p in sitio.items() if seccion_de_url(p["url"])}
    res = {"pantallas": {}, "revisar": [], "ignorados": []}
    for a in archivos:
        if IGNORADOS.search(a):
            res["ignorados"].append(a)
            continue
        claves = pantallas_de(a, por_seccion)
        if claves is None:
            res["revisar"].append(a)
            continue
        for c in claves:
            res["pantallas"].setdefault(c, []).append(a)
    return res


def etiqueta(clave, sitio):
    if clave in PSEUDO:
        return PSEUDO[clave]
    return sitio[clave]["t"] if clave in sitio else clave


def armar_plan(clasif, sitio):
    """Lista ordenada de toques: {id, pantalla, toque, motivo}. El id es estable entre pasadas."""
    plan = []
    for clave in sorted(clasif["pantallas"], key=lambda k: (k in PSEUDO, k)):
        motivo = ", ".join(sorted(set(clasif["pantallas"][clave])))
        for t in TOQUES.get(clave, GENERICO):
            plan.append({"id": f"{clave}|{t}", "pantalla": etiqueta(clave, sitio), "toque": t, "motivo": motivo})
    for a in clasif["revisar"]:
        plan.append({"id": f"revisar|{a}", "pantalla": "Revisar a mano",
                     "toque": f"Mirar {a} y decidir qué pantalla toca", "motivo": a})
    for ident, texto in FIJOS:
        plan.append({"id": f"fijo|{ident}", "pantalla": PSEUDO["fijo"], "toque": texto, "motivo": "paso sin verificar"})
    return plan


def leer_estado(ruta=ESTADO):
    """{id: (fecha, resultado, nota)} con el último resultado de cada toque."""
    ultimo = {}
    if not ruta.exists():
        return ultimo
    for linea in ruta.read_text(encoding="utf-8-sig").splitlines():
        partes = linea.split("\t")
        if len(partes) < 3 or linea.startswith("#") or partes[2] not in RESULTADOS:
            continue
        ultimo[partes[1]] = (partes[0], partes[2], partes[3] if len(partes) > 3 else "")
    return ultimo


def anotar(ruta, id_, resultado, nota, hoy):
    """Agrega una línea (y el encabezado si el archivo es nuevo). Limpia tabs y saltos de la nota."""
    nueva = not ruta.exists()
    limpia = re.sub(r"[\t\r\n]+", " ", nota).strip()
    with ruta.open("a", encoding="utf-8") as f:
        if nueva:
            f.write("# pasada de celular de Galera (tools/pasada.py). Una línea por resultado: fecha, id, ok|falla|salteo, nota.\n")
        f.write(f"{hoy}\t{id_}\t{resultado}\t{limpia}\n")


def cambios_desde(base=BASE, hasta="HEAD", raiz=RAIZ):
    r = subprocess.run(["git", "-c", "core.quotePath=false", "-C", str(raiz), "diff", "--name-only", f"{base}..{hasta}"],
                       capture_output=True, text=True, encoding="utf-8")
    if r.returncode:
        raise SystemExit(f"git no pudo comparar {base}..{hasta}: {r.stderr.strip()}")
    return [x for x in r.stdout.splitlines() if x]


def marca(prev):
    if not prev:
        return ""
    fecha, res, nota = prev
    if res == "ok":
        return f"  (ok el {fecha})"
    return f"  (último: {res} el {fecha}{': ' + nota if nota else ''})"


def ordenar(plan, estado):
    """Lo que falló la última vez va primero; el resto en el orden del plan."""
    return sorted(plan, key=lambda it: estado.get(it["id"], ("", "", ""))[1] != "falla")


def mostrar(plan, estado, encabezado):
    print(encabezado)
    for n, it in enumerate(ordenar(plan, estado), 1):
        print(f"[{n:2}] {it['pantalla']} · {it['toque']}{marca(estado.get(it['id']))}")
    print(f"\n{len(plan)} toques.")


def pasada(plan, estado, ruta, hoy):
    cuenta = {r: 0 for r in RESULTADOS}
    for n, it in enumerate(ordenar(plan, estado), 1):
        print(f"\n[{n}/{len(plan)}] {it['pantalla']} · {it['toque']}{marca(estado.get(it['id']))}")
        resp = input("  ok / falla / salteo / q para cortar (enter = ok): ").strip().lower()
        if resp in ("q", "salir"):
            break
        if resp in ("f", "falla"):
            nota = input("  qué pasó: ").strip()
            res = "falla"
        elif resp in ("s", "salteo"):
            nota, res = input("  por qué (opcional): ").strip(), "salteo"
        else:
            nota, res = "", "ok"
        anotar(ruta, it["id"], res, nota, hoy)
        cuenta[res] += 1
    return cuenta


def autoprueba():
    fallas = []

    def chequear(nombre, cond):
        if not cond:
            fallas.append(nombre)

    sitio = leer_sitio()
    chequear("las urls de sitio.json son únicas", len(set(p["url"] for p in sitio.values())) == len(sitio))

    def toca(archivos):
        return clasificar(archivos, sitio)["pantallas"]

    chequear("horarios.js toca Horarios", toca(["horarios.js"]) == {"horarios": ["horarios.js"]})
    chequear("oferta toca Horarios y Calendario", set(toca(["datos/oferta-2026-2c.json"])) == {"horarios", "calendario"})
    chequear("compartir.js toca piezas", "piezas" in toca(["compartir.js"]))
    chequear("ejemplar.js toca Mi carrera y piezas", set(toca(["ejemplar.js"])) == {"carrera", "piezas"})
    chequear("carpeta carrera/ es Mi carrera", "carrera" in toca(["carrera/index.html"]))
    chequear("carpeta r/ es Resúmenes", "resumenes" in toca(["r/algo/apunte.html"]))
    chequear("marco/ toca el menú", "menu" in toca(["marco/sitio.json"]))
    chequear("sw.js toca el núcleo sin conexión",
             {"inicio", "carrera", "horarios", "calendario"} <= set(toca(["sw.js"])))
    chequear("un archivo sin regla va a «revisar a mano»",
             clasificar(["zona/nueva.js"], sitio)["revisar"] == ["zona/nueva.js"])
    chequear("el tooling no toca pantallas",
             clasificar(["README.md", "tools/pasada.py", ".github/workflows/ci.yml"], sitio)["pantallas"] == {})
    chequear("sin cambios no hay toques de pantalla", clasificar([], sitio)["pantallas"] == {})

    plan = armar_plan(clasificar(["horarios.js", "zona/nueva.js"], sitio), sitio)
    ids = [it["id"] for it in plan]
    chequear("los ids del plan son únicos", len(ids) == len(set(ids)))
    chequear("el plan trae los fijos sin verificar", sum(i.startswith("fijo|") for i in ids) == len(FIJOS))
    chequear("«revisar a mano» aparece en el plan", any(it["pantalla"] == "Revisar a mano" for it in plan))
    chequear("cada pantalla con toques propios trae 2 o 3 pasos concretos (una sola si es menor)",
             all(1 <= len(v) <= 3 for v in TOQUES.values()))
    chequear("el genérico trae 2 pasos", len(GENERICO) == 2)
    sin_toques = [k for k in sitio if k not in TOQUES]
    chequear("hay al menos una pantalla sin toques propios para probar el genérico", bool(sin_toques))
    if sin_toques:
        plan_gen = armar_plan({"pantallas": {sin_toques[0]: ["x"]}, "revisar": []}, sitio)
        propios = [it["toque"] for it in plan_gen if it["id"].startswith(f"{sin_toques[0]}|")]
        chequear("una pantalla sin toques propios usa el genérico", propios == GENERICO)

    for clave in REGLAS:
        for destino in clave[1]:
            chequear(f"la regla {clave[0]} apunta a una pantalla que existe ({destino})",
                     destino in sitio or destino in PSEUDO)
    for clave in TOQUES:
        chequear(f"los toques de {clave} apuntan a una pantalla que existe", clave in sitio or clave in PSEUDO)

    secciones = {seccion_de_url(p["url"]) for p in sitio.values()}
    for nombre, ruta in rutas_navegador():
        if ruta is None:  # el apunte de /r/ se arma en código (apunte_de_r): su sección es «r»
            continue
        chequear(f"la ruta de navegador «{nombre}» ({ruta}) es de una pantalla de sitio.json",
                 seccion_de_url(ruta) in secciones or ruta == "/")

    with tempfile.TemporaryDirectory() as tmp:
        ruta = Path(tmp) / "estado.txt"
        anotar(ruta, "carrera|x", "falla", "se vio\tmal\nhoy", "2026-12-06")
        anotar(ruta, "carrera|x", "ok", "", "2026-12-07")
        leido = leer_estado(ruta)
        chequear("el estado guarda el último resultado de cada toque",
                 leido.get("carrera|x") == ("2026-12-07", "ok", ""))
        linea_con_nota = ruta.read_text(encoding="utf-8").split("\n")[1]  # la primera anotación (la que trae tab y salto)
        chequear("las notas no rompen el formato (una línea, cuatro columnas)",
                 len(linea_con_nota.split("\t")) == 4 and linea_con_nota.split("\t")[3] == "se vio mal hoy")
        chequear("un estado vacío no falla", leer_estado(Path(tmp) / "no-existe.txt") == {})

    if fallas:
        print("FALLAN los casos de pasada.py:")
        for f in fallas:
            print("  -", f)
        return 1
    print("pasada.py: todos los casos pasan.")
    return 0


def main(argv=None):
    for flujo in (sys.stdout, sys.stdin):
        if hasattr(flujo, "reconfigure"):
            flujo.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--lista", action="store_true", help="solo mostrar la lista, sin preguntar ni guardar")
    ap.add_argument("--autoprueba", action="store_true", help="correr los casos de la tabla")
    ap.add_argument("--desde", default=BASE, help=f"versión base (por defecto: {BASE})")
    ap.add_argument("--estado", default=str(ESTADO), help="archivo de texto con los resultados anteriores")
    args = ap.parse_args(argv)

    if args.autoprueba:
        return autoprueba()

    sitio = leer_sitio()
    archivos = cambios_desde(args.desde)
    clasif = clasificar(archivos, sitio)
    plan = armar_plan(clasif, sitio)
    ruta = Path(args.estado)
    estado = leer_estado(ruta)
    sha = subprocess.run(["git", "-C", str(RAIZ), "rev-parse", "--short", args.desde],
                         capture_output=True, text=True).stdout.strip()
    hoy = datetime.date.today().isoformat()

    encabezado = (f"Pasada de celular · {hoy} · cambios desde {args.desde} ({sha}): {len(archivos)} archivos, "
                  f"{len(clasif['pantallas'])} pantallas, {len(clasif['revisar'])} para revisar a mano")
    if args.lista:
        mostrar(plan, estado, encabezado)
        return 0

    fechas = [v[0] for v in estado.values()]
    print(encabezado)
    print(f"Última pasada anotada: {max(fechas) if fechas else 'ninguna'}.")
    cuenta = pasada(plan, estado, ruta, hoy)
    estado = leer_estado(ruta)
    fallas = [it for it in plan if estado.get(it["id"], ("", ""))[1] == "falla"]
    print(f"\nResultado: {cuenta['ok']} ok, {cuenta['falla']} falla, {cuenta['salteo']} salteo"
          f"; quedan {len(plan) - sum(cuenta.values())} sin mirar.")
    for it in fallas:
        print(f"  falla: {it['pantalla']} · {it['toque']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
