"""Design system de Galera: genera lo derivado de diseno/ a partir de los CSS del repo.

Fuente (no se toca): tokens.css (colores, escala, familias) y el :root de componentes.css (--gl-click, --gl-on-mark).
Escribe en diseno/:
  tokens.json     los tokens en formato W3C (Design Tokens), claro y oscuro, para Figma o Tokens Studio
  contrastes.md   relación de contraste WCAG de los pares que usa el sitio, calculada
Y, solo si se pide, fuera del repo:
  vista.html      página para mirar el sistema con los CSS reales (base del artifact). No se commitea: no es una página
                  del sitio (lleva estilos en línea y no tiene marco ni meta og).

Uso: python tools/diseno_generar.py                    (escribe tokens.json y contrastes.md)
     python tools/diseno_generar.py --comprobar        (falla si lo derivado quedó viejo)
     python tools/diseno_generar.py --vista <carpeta>  (escribe <carpeta>/vista.html, con los CSS copiados al lado)
     python tools/diseno_generar.py --artifact <carpeta>  (escribe <carpeta>/project/, el contenido del artifact «Design System»)
"""
import json
import re
import shutil
import sys
from html import escape
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
RAIZ = Path(__file__).resolve().parent.parent
DISENO = RAIZ / "diseno"
AVISO = "Generado por tools/diseno_generar.py desde tokens.css y componentes.css. No editar a mano."


def bloques(css, selector):
    """Variables del primer bloque cuyo selector es exactamente `selector` (sin espacios)."""
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    for m in re.finditer(r"([^{}]+)\{([^{}]*)\}", css):
        if re.sub(r"\s+", "", m.group(1)) == selector:
            return dict(re.findall(r"--([\w-]+)\s*:\s*([^;]+?)\s*(?:;|$)", m.group(2)))
    raise SystemExit(f"No encontré el bloque {selector}")


def leer():
    tok = (RAIZ / "tokens.css").read_text(encoding="utf-8")
    comp = (RAIZ / "componentes.css").read_text(encoding="utf-8")
    claro = bloques(tok, ":root") | {k: v for k, v in bloques(comp, ":root").items() if k.startswith("gl-") and "#" in v}
    oscuro = bloques(tok, ':root[data-theme="dark"]') | bloques(comp, ':root[data-theme="dark"]')
    return claro, oscuro


def es_color(v):
    return bool(re.fullmatch(r"#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?", v))


def rgb(h):
    h = h.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]


def lum(h):
    return sum(k * (c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4) for k, c in zip((0.2126, 0.7152, 0.0722), rgb(h)))


def contraste(a, b):
    x, y = sorted((lum(a), lum(b)), reverse=True)
    return (x + 0.05) / (y + 0.05)


# (frente, fondo, mínimo, uso). Mínimo 4,5 texto normal; 3 texto grande, bordes y gráficos.
PARES = [
    ("texto", "bg", 4.5, "texto principal"),
    ("texto2", "bg", 4.5, "texto de apoyo"),
    ("tenue", "bg", 4.5, "ayudas y fechas"),
    ("tenue", "sup2", 4.5, "ayudas sobre Plata"),
    ("tenue-2", "bg", 4.5, "gris de componentes"),
    ("tenue-2", "tinta-suave", 4.5, "gris de componentes sobre cielo"),
    ("tinta", "bg", 4.5, "enlaces"),
    ("gl-click", "tinta-suave", 4.5, "botón secundario y contenedor con enlace"),
    ("gl-on-mark", "marca", 3, "botón primario (texto grande y peso 500)"),
    ("marca", "bg", 3, "capitular, g del logo, arco del anillo"),
    ("borde-campo", "bg", 3, "borde de campos"),
    ("estado-pen-texto", "estado-pen-fondo", 4.5, "estado pendiente"),
    ("estado-cur-texto", "estado-cur-fondo", 4.5, "estado cursando"),
    ("estado-reg-texto", "estado-reg-fondo", 4.5, "estado regular"),
    ("estado-apr-texto", "estado-apr-fondo", 4.5, "estado aprobada"),
    ("estado-error", "bg", 3, "borde y triángulo del aviso"),
    ("estado-ok-pleno", "bg", 3, "anillo completo"),
]


def valor(tema, k, claro):
    return tema.get(k, claro.get(k))


def g_contrastes(claro, oscuro):
    filas = ["# Contrastes", "", f"<!-- {AVISO} -->", "",
             "Relación WCAG de cada par, en claro y en oscuro. «Falla» marca lo que queda por debajo del mínimo.", "",
             "| Frente | Fondo | Uso | Mínimo | Claro | Oscuro |", "|---|---|---|---|---|---|"]
    fallas = 0
    for f, b, minimo, uso in PARES:
        celdas = []
        for tema in (claro, oscuro):
            a, c = valor(tema, f, claro), valor(tema, b, claro)
            if not (a and c and es_color(a) and es_color(c)):
                celdas.append("s/d")
                continue
            r = contraste(a, c)
            ok = r >= minimo
            fallas += not ok
            celdas.append(f"{r:.1f} : 1".replace(".", ",") + ("" if ok else " **falla**"))
        filas.append(f"| `--{f}` | `--{b}` | {uso} | {str(minimo).replace('.', ',')} | {celdas[0]} | {celdas[1]} |")
    filas += ["", f"Pares que fallan: {fallas}.", ""]
    return "\n".join(filas)


def g_tokens(claro, oscuro):
    def grupo(tema):
        out = {"color": {}, "tamano": {}, "fuente": {}, "radio": {}}
        for k, v in tema.items():
            if es_color(v):
                out["color"][k] = {"$type": "color", "$value": v}
            elif k.startswith("t-"):
                out["tamano"][k] = {"$type": "dimension", "$value": v}
            elif k in ("fuente", "serif", "gotica"):
                out["fuente"][k] = {"$type": "fontFamily", "$value": [p.strip().strip('"') for p in v.split(",")]}
            elif k == "radio":
                out["radio"][k] = {"$type": "dimension", "$value": v}
        return {k: v for k, v in out.items() if v}
    osc = {k: v for k, v in oscuro.items() if es_color(v)}
    return json.dumps({"$description": AVISO, "claro": grupo(claro), "oscuro": grupo(osc)}, ensure_ascii=False, indent=2) + "\n"


def g_vista(claro, oscuro):
    colores = [k for k, v in claro.items() if es_color(v)]
    muestras = "\n".join(
        f'<li><span class="m" style="background:{claro[k]}"></span><span class="m" style="background:{oscuro.get(k, claro[k])}"></span>'
        f'<code>--{escape(k)}</code><small>{claro[k]} · {oscuro.get(k, claro[k])}</small></li>' for k in colores)
    escala = "\n".join(f'<li style="font-size:var(--{k})"><code>--{k}</code> {escape(claro[k])} Mi carrera</li>' for k in claro if k.startswith("t-"))
    def tema_css(nombre, esquema, tema):
        return f".{nombre}{{color-scheme:{esquema};" + "".join(f"--{k}:{v};" for k, v in tema.items() if es_color(v)) + "background:var(--bg);color:var(--texto)}"
    osc_css = tema_css("claro", "light", claro) + "\n" + tema_css("oscuro", "dark", {**claro, **oscuro})
    comp = """<div class="panel">
<h1 class="gl-display">Mi carrera</h1>
<p class="gl-rotulo">Rótulo</p><p class="gl-cuerpo">Cuerpo de interfaz.</p><p class="gl-chico">Chico: metadatos y ayudas.</p>
<p><span class="gl-estado gl-pen"><span class="gl-ic"></span>Pendiente</span> <span class="gl-estado gl-cur"><span class="gl-ic"></span>Cursando</span>
<span class="gl-estado gl-reg"><span class="gl-ic"></span>Regular</span> <span class="gl-estado gl-apr"><span class="gl-ic"></span>Aprobada</span></p>
<div class="gl-aviso"><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2 21h20z" fill="none" stroke="currentColor" stroke-width="2"/></svg><div><b>Se superponen dos materias.</b>Coinciden los lunes de 18 a 20 h.</div></div>
<div class="gl-tarjeta"><span class="gl-estado gl-cur"><span class="gl-ic"></span>Cursando</span><b>Producción de Impresos</b><span class="gl-chico">Lunes y miércoles · 18 h</span></div>
<p><a class="gl-cont" href="#">Ir a Resúmenes</a></p>
<p><button class="gl-btn">Cargar nota</button> <button class="gl-btn gl-btn--sec">Ver mesas</button> <button class="gl-btn gl-btn--ter">Cancelar</button> <button class="gl-btn" disabled>Deshabilitado</button></p>
<label class="gl-campo"><span>Buscar un resumen</span><input type="text" placeholder="Teoría de los medios"></label>
<p class="logo">g<span>alera</span></p>
</div>"""
    return f"""<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>Galera · Design system</title>
<!-- {AVISO} -->
<link rel="stylesheet" href="tokens.css"><link rel="stylesheet" href="componentes.css">
<style>
body{{margin:0;padding:24px 16px;font-family:var(--fuente);background:var(--bg);color:var(--texto)}}
main{{max-width:1224px;margin:0 auto}} h2{{font-size:var(--t-xl);margin:40px 0 12px}}
ul{{list-style:none;padding:0;margin:0}} .colores{{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:8px}}
.colores li{{display:flex;align-items:center;gap:8px}} .colores small{{color:var(--tenue);font-size:var(--t-xs)}}
.m{{width:28px;height:28px;border:1px solid var(--borde);border-radius:var(--radio);flex:none}}
.escala li{{margin:4px 0}} .escala code{{font-size:var(--t-xs);color:var(--tenue)}}
.temas{{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px}} .panel{{padding:24px;border:1px solid var(--borde);border-radius:var(--radio);display:grid;gap:12px;align-content:start}}
.logo{{font-family:var(--gotica);font-size:56px;line-height:1;margin:8px 0;color:var(--marca)}} .logo span{{color:var(--texto)}}
{osc_css}
</style></head>
<body><main>
<p class="gl-rotulo">Galera · design system</p>
<h1 class="gl-display">Design system</h1>
<p class="gl-chico">Fuente: <code>tokens.css</code> y <code>componentes.css</code>. Reglas en <code>diseno/*.md</code>. Contrastes en <code>diseno/contrastes.md</code>.</p>
<h2>Colores (claro · oscuro)</h2>
<ul class="colores">
{muestras}
</ul>
<h2>Escala</h2>
<ul class="escala">
{escala}
</ul>
<h2>Componentes</h2>
<div class="temas">
{comp.replace('<div class="panel">', '<div class="panel claro">', 1)}
{comp.replace('<div class="panel">', '<div class="panel oscuro">', 1)}
</div>
</main></body></html>
"""


# ---- Artifact «Design System» (claude.ai): la vista compartida entre las dos cuentas de Fidel. ----
# Escribe <carpeta>/project/… con la forma que pide ese tipo de artifact (tokens en listas, README y secciones,
# fuentes, bundle.css y una vista por componente). El índice (design-system.json, con los ids de los íconos subidos)
# no sale de acá: lo escribe quien publica, porque depende del artifact.

USO_COLOR = {
    "bg": "Fondo de la página.", "sup": "Superficie de tarjetas y campos.", "sup2": "Plata: fondos de apoyo y contenedores.",
    "borde": "Bordes decorativos y riel del anillo.", "borde-campo": "Borde de campos y controles (3 : 1).",
    "texto": "Tinta: texto principal, títulos y foco.", "texto2": "Texto de apoyo.", "tenue": "Ayudas y fechas; piso para texto chico.",
    "tenue-2": "Gris de componentes (decisión pendiente). Falla sobre cielo en claro (4,1 : 1).",
    "tinta": "Azul de texto: enlaces.", "tinta-suave": "Cielo: fondo de acción secundaria y contenedor con enlace.",
    "marca": "Azul de marca: la g del logo, la capitular, el arco del anillo, el botón primario.", "marca-suave": "Fondo suave de marca.",
    "ok": "Listo, aprobado.", "ok-suave": "Fondo de ok.", "ojo": "Atención.", "ojo-suave": "Fondo de atención.", "mal": "Error, peligro.", "mal-suave": "Fondo de error.",
    "estado-pen-fondo": "Estado pendiente: fondo.", "estado-pen-texto": "Estado pendiente: texto.", "estado-pen-aro": "Estado pendiente: aro del ícono.",
    "estado-cur-fondo": "Estado cursando: fondo.", "estado-cur-texto": "Estado cursando: texto.",
    "estado-reg-fondo": "Estado regular (falta el final): fondo.", "estado-reg-texto": "Estado regular: texto.",
    "estado-apr-fondo": "Estado aprobada: fondo.", "estado-apr-texto": "Estado aprobada: texto.",
    "estado-error": "Borde y triángulo del aviso de horario.", "estado-ok-pleno": "Anillo completo. Sin valor oscuro: falla en oscuro (2,7 : 1).",
    "azul-texto": "Igual a --tinta (alias histórico).", "azul-fondo": "Igual a --marca (alias histórico).",
    "sobre-color": "Texto sobre fondos de color propio (bloques del horario, tapas, ícono).",
    "gl-click": "Texto del botón secundario y del contenedor con enlace.", "gl-on-mark": "Texto del botón primario.",
}
FUENTES = [("Instrument Sans", "instrument-sans.woff2", "400 700", "normal"), ("Literata", "literata.woff2", "400 500", "normal"),
           ("Literata", "literata-italic.woff2", "400", "italic"), ("UnifrakturMaguntia", "unifraktur.woff2", "400", "normal")]
# Niveles de la escala: (nombre, clase de componentes.css, familia, uso)
NIVELES = [("display", ".gl-display", "fuente", "Título de pantalla, con capitular."), ("titulo-1", ".gl-t1", "fuente", "Portadas de estudio, con capitular."),
           ("titulo-2", ".gl-t2", "fuente", "Secciones."), ("titulo-3", ".gl-t3", "fuente", "Tarjetas, subtítulos."),
           ("lectura", ".gl-lectura-texto", "serif", "Resúmenes, glosario; máximo 66 caracteres."), ("cuerpo", ".gl-cuerpo", "fuente", "Base de interfaz; nunca menos en campos."),
           ("chico", ".gl-chico", "fuente", "Segundo renglón, ayudas."), ("rotulo", ".gl-rotulo", "fuente", "Piso del sistema; versalitas +0,06 em.")]


def estilo_de(css, clase, tok):
    """Tamaño, interlineado y peso de la primera regla de `clase` en componentes.css (resuelve var(--t-*))."""
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    tam = alto = peso = None
    for m in re.finditer(r"([^{}]+)\{([^{}]*)\}", css):
        if clase not in [s.strip() for s in m.group(1).split(",")] or "@media" in m.group(1):
            continue
        d = m.group(2)
        if f := re.search(r"font:\s*(\d+)\s+([^/\s]+)/(\S+)", d):
            peso, tam, alto = peso or f.group(1), tam or f.group(2), alto or f.group(3)
        tam = tam or (re.search(r"font-size:\s*([^;]+)", d) or [None, None])[1]
        alto = alto or (re.search(r"line-height:\s*([^;]+)", d) or [None, None])[1]
        peso = peso or (re.search(r"font-weight:\s*(\d+)", d) or [None, None])[1]
    res = lambda v: tok.get(v[6:-1], v) if v and v.startswith("var(--") else v
    cero = lambda v: "0" + v if v and v.startswith(".") else v
    return cero(res(tam)), cero(res(alto)), int(peso or 400)


PREVIEWS = {
    "Estado": ("Materia", 72, '<div class="fila"><span class="gl-estado gl-pen"><span class="gl-ic"></span>Pendiente</span><span class="gl-estado gl-cur"><span class="gl-ic"></span>Cursando</span><span class="gl-estado gl-reg"><span class="gl-ic"></span>Regular · falta el final</span><span class="gl-estado gl-apr"><span class="gl-ic"></span>Aprobada</span></div>',
               "Estado de una materia: ícono, palabra y color juntos, para que se lea igual en escala de grises.\n\nCuatro estados (`.gl-pen`, `.gl-cur`, `.gl-reg`, `.gl-apr`), solo de la materia. Colores: `--estado-*`. El choque de horarios no es un estado: es el Aviso."),
    "Aviso": ("Materia", 110, '<div class="gl-aviso"><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2 21h20zM12 10v5M12 17.5v.5" fill="none" stroke="currentColor" stroke-width="2"/></svg><div><b>Se superponen dos materias.</b>Producción de Impresos y Diseño Gráfico coinciden los lunes de 18 a 20 h. <a class="gl-enlace" href="#">Ver en Horarios</a></div></div>',
              "Aviso de horario: borde y triángulo en `--estado-error`, texto en tinta y una sola acción.\n\nVa aparte de los estados de la materia. Reemplaza a las rayas rojas."),
    "Anillo": ("Avance", 150, '<div class="fila"><span class="gl-anillo"><svg width="120" height="120" viewBox="0 0 120 120" aria-hidden="true"><circle class="riel" cx="60" cy="60" r="52" fill="none" stroke-width="10"/><circle class="arco" cx="60" cy="60" r="52" fill="none" stroke-width="10" stroke-dasharray="202.6 326.7" transform="rotate(-90 60 60)"/></svg><span class="cifra">62<small>%</small></span></span><span class="gl-anillo"><svg width="120" height="120" viewBox="0 0 120 120" aria-hidden="true"><circle class="arco completo" cx="60" cy="60" r="52" fill="none" stroke-width="10"/></svg><span class="cifra">100<small>%</small></span></span></div>',
               "Anillo de avance, siempre con la cifra adentro (tabular, en tinta).\n\nRiel `--borde`, arco `--marca`; completo, `--estado-ok-pleno` (sin valor oscuro: pendiente). La barra de puntos y las tramas ya no se usan."),
    "Tarjeta": ("Contenedores", 150, '<div class="gl-tarjeta"><span class="gl-estado gl-cur"><span class="gl-ic"></span>Cursando</span><b>Producción de Impresos</b><span class="gl-chico">Lunes y miércoles · 18 h</span><div class="gl-tarjeta-pie"><span>40 % del cuatrimestre</span></div></div>',
                "Tarjeta: radio `--radio`, sin sombra.\n\nEl CSS usa relleno Plata (`--sup2`) sin borde; la lámina dice borde de 1 px sin relleno. Pendiente de decidir."),
    "Contenedor": ("Contenedores", 130, '<div class="col"><div class="gl-cont">Mis materias</div><a class="gl-cont" href="#">Ir a Resúmenes</a></div>',
                   "Contenedor: Plata (`--sup2`); si es enlace, cielo (`--tinta-suave`) con flecha."),
    "Boton": ("Acciones", 80, '<div class="fila"><button class="gl-btn">Cargar nota</button><button class="gl-btn gl-btn--sec">Ver mesas</button><button class="gl-btn gl-btn--ter">Cancelar</button><button class="gl-btn" disabled>Deshabilitado</button></div>',
              "Botón: 44 de alto en toque; el compacto (`.gl-btn--c`, 40) solo en escritorio con puntero.\n\nPrimario sobre `--marca`, secundario sobre cielo, terciario subrayado. Verbos en infinitivo. Foco: contorno de 2 px en tinta."),
    "Campo": ("Formularios", 130, '<label class="gl-campo"><span>Buscar un resumen</span><input type="text" placeholder="Teoría de los medios"></label><div class="gl-ayuda"><span class="gl-chico">de tu carrera aprobada</span><a class="gl-enlace" href="#">Cómo se calcula</a></div>',
              "Campo de 48 con borde `--borde-campo`.\n\nLa ayuda es un subtítulo visible más un enlace con palabras; el «?» circular se retiró."),
    "Titulo": ("Tipografía", 220, '<div class="col"><h1 class="gl-display">Mi carrera</h1><h1 class="gl-t1">Resúmenes</h1><h2 class="gl-t2">Materias de grado</h2></div>',
               "Títulos con capitular: la primera letra del h1 en UnifrakturMaguntia al 112 %, en `--marca`; el resto en Instrument Sans 600, en tinta.\n\nUna por pantalla, solo en el h1. Nunca en subtítulos, tarjetas, cifras ni siglas. `.sin-cap` la saca."),
    "Logo": ("Marca", 140, '<div class="fila"><span class="logo l56">galera</span><span class="logo l32">galera</span><span class="logo l24">galera</span></div>',
             "Logo: «galera» entero, en minúscula, en UnifrakturMaguntia, en tinta, con la g en `--marca`.\n\n56 px en portadas, 32 en cabecera y pie, 24 como mínimo. Sin mayúscula inicial, sin otra gótica, sin sombras ni estiramiento."),
}
CSS_PREVIEW = (".fila{display:flex;flex-wrap:wrap;gap:12px;align-items:center}.col{display:grid;gap:12px}"
               ".logo{font-family:var(--gotica);color:var(--texto);line-height:1}.logo::first-letter{color:var(--marca)}"
               ".l56{font-size:56px}.l32{font-size:32px}.l24{font-size:24px}")


def g_artifact(destino, claro, oscuro):
    tok_css = (RAIZ / "tokens.css").read_text(encoding="utf-8")
    comp_css = (RAIZ / "componentes.css").read_text(encoding="utf-8")
    p = destino / "project"
    (p / "fonts").mkdir(parents=True, exist_ok=True)
    escribir = lambda ruta, t: ((p / ruta).parent.mkdir(parents=True, exist_ok=True), (p / ruta).write_text(t, encoding="utf-8", newline="\n"))
    colores = [{"name": k, "value": {"light": v.lower(), "dark": oscuro.get(k, v).lower()}, "usage": USO_COLOR.get(k, "")}
               for k, v in claro.items() if es_color(v)]
    grupos = [{"name": "Galera", "family": "fuente", "styles": []}]
    for nombre, clase, fam, uso in NIVELES:
        tam, alto, peso = estilo_de(comp_css, clase, claro)
        grupos[0]["styles"].append({"name": nombre, "family": fam, "fontSize": tam, "lineHeight": alto, "fontWeight": peso, "usage": uso, "sample": "Mi carrera"})
    tokens = {
        "name": "Galera", "version": 1,
        "meta": {"source": "github", "repo": "galera-app/galera", "paths": {"tokens": ["tokens.css", "componentes.css"], "fonts": ["fonts/"], "docs": ["diseno/"]},
                 "nota": AVISO},
        "color": {"themes": [{"id": "light", "name": "Claro"}, {"id": "dark", "name": "Oscuro"}], "tokens": colores},
        "type": {"fonts": [{"family": f, "file": "fonts/" + a, "weight": w, "style": s} for f, a, w, s in FUENTES],
                 "families": {k: claro[k] for k in ("fuente", "serif", "gotica")}, "groups": grupos},
        "radius": {"tokens": [{"name": "radio", "value": claro["radio"], "usage": "Un solo radio en todo el sistema."}]},
        "size": {"tokens": [{"name": k, "value": "0" + v if v.startswith(".") else v, "usage": "Escala de texto (tokens.css)."} for k, v in claro.items() if k.startswith("t-")]},
    }
    escribir("tokens.json", json.dumps(tokens, ensure_ascii=False, indent=2) + "\n")
    for _, a, _, _ in FUENTES:
        shutil.copyfile(RAIZ / "fonts" / a, p / "fonts" / a)
    # bundle.css: las variables que no son color (escala, familias con el nombre del sitio) y componentes.css sin @font-face.
    no_color = {k: v for k, v in bloques(tok_css, ":root").items() if not es_color(v) and k != "color-scheme"}
    raiz = ":root{" + "".join(f"--{k}:{v};" for k, v in no_color.items()) + "}\n"
    cuerpo = re.sub(r"@font-face\{[^}]*\}\n?", "", comp_css)
    escribir("components/bundle.css", f"/* {AVISO} */\n" + raiz + CSS_PREVIEW + "\n" + cuerpo)
    for nombre, (grupo, alto, html, guia) in PREVIEWS.items():
        escribir(f"components/{nombre}/preview.html", f'<!-- @dsCard group="{grupo}" height={alto} -->\n<div class="col">{html}</div>\n')
        escribir(f"components/{nombre}/README.md", f"# {nombre}\n\n{guia}\n")
    # Brand book: README del repo más las secciones, con los enlaces al repo hechos absolutos.
    base = "https://github.com/galera-app/galera/blob/main/"
    def md(nombre):
        t = (DISENO / nombre).read_text(encoding="utf-8")
        t = re.sub(r"\]\(\.\./([^)]*)\)", lambda m: f"]({base}{m.group(1)})", t)
        return re.sub(r"\]\(([a-z]+\.md)(#[^)]*)?\)", lambda m: f"]({base}diseno/{m.group(1)}{m.group(2) or ''})", t)
    escribir("README.md", f"> Vista del design system de Galera. La fuente está en el repo [`galera-app/galera`]({base}diseno/README.md), carpeta `diseno/`: lo que cambie acá no vuelve al repo. {AVISO}\n\n" + md("README.md"))
    for n in ("marca.md", "tipografia.md", "componentes.md", "reglas.md", "contrastes.md"):
        escribir(n, md(n))
    escribir("components/Cover/preview.html", g_portada())
    print("escrito", p)


def g_portada():
    return """<!-- @dsCard height=288 -->
<style>
.tapa{position:relative;width:960px;height:288px;background:var(--bg);overflow:hidden;font-family:var(--fuente)}
.tapa svg{position:absolute;inset:0}
.b-marca{fill:var(--marca)}.b-tinta{fill:var(--texto)}.b-cielo{fill:var(--tinta-suave)}.b-plata{fill:var(--sup2)}.b-cur{fill:var(--estado-cur-texto)}
.g{font-family:var(--gotica);fill:var(--sobre-color)}.aro{fill:none;stroke:var(--sobre-color);stroke-width:2.5}
.nombre{position:absolute;left:48px;bottom:56px;max-width:440px;margin:0;font:400 120px/.92 var(--gotica);color:var(--texto)}
.nombre::first-letter{color:var(--marca)}
.lema{position:absolute;left:52px;bottom:28px;margin:0;font-size:14px;color:var(--texto2)}
</style>
<div class="tapa">
<!-- Derivación:
     bloques: --marca (alto, 240×288, la identidad), --texto (tinta, 96×144), --tinta-suave (cielo, 144×144), --sup2 (Plata, 96×144), --estado-cur-texto (franja de 24).
     disposición: una losa alta azul con satélites a la derecha, sangrando por arriba y abajo; todo a la derecha de x = 480, radio --radio (4).
     patrón: «una letra de display usada como forma»: la g de UnifrakturMaguntia, enorme y recortada por la losa, porque la marca es esa g.
     escalas: lados múltiplos de 24 y 48 (la grilla de 4 del sistema), radio --radio; cuatro aros de estado, como los cuartos de círculo. -->
<svg width="960" height="288" viewBox="0 0 960 288" aria-hidden="true">
<rect class="b-plata" x="480" y="0" width="96" height="144" rx="4"/>
<rect class="b-cielo" x="576" y="144" width="144" height="144" rx="4"/>
<rect class="b-tinta" x="480" y="144" width="96" height="144" rx="4"/>
<rect class="b-cur" x="576" y="120" width="144" height="24"/>
<rect class="b-marca" x="720" y="0" width="240" height="288"/>
<text class="g" x="738" y="300" font-size="330">g</text>
<circle class="aro" cx="528" cy="72" r="16"/>
<path class="aro" d="M612 72a16 16 0 1 0 32 0a16 16 0 1 0 -32 0M628 56a16 16 0 0 1 16 16h-16z"/>
</svg>
<p class="nombre">galera</p>
<p class="lema">Design system de la cursada de Edición (FFyL, UBA).</p>
</div>
"""


def main():
    claro, oscuro = leer()
    if "--artifact" in sys.argv:
        destino = Path(sys.argv[sys.argv.index("--artifact") + 1]).resolve()
        if destino == RAIZ or RAIZ in destino.parents:
            raise SystemExit("El artifact se arma fuera del repo.")
        g_artifact(destino, claro, oscuro)
        return
    if "--vista" in sys.argv:
        destino = Path(sys.argv[sys.argv.index("--vista") + 1]).resolve()
        if destino == RAIZ or RAIZ in destino.parents:
            raise SystemExit("La vista va fuera del repo (no es una página del sitio).")
        (destino / "fonts").mkdir(parents=True, exist_ok=True)
        for n in ("tokens.css", "componentes.css"):
            shutil.copyfile(RAIZ / n, destino / n)
        for f in (RAIZ / "fonts").glob("*.woff2"):
            shutil.copyfile(f, destino / "fonts" / f.name)
        (destino / "vista.html").write_text(g_vista(claro, oscuro), encoding="utf-8", newline="\n")
        print("escrito", destino / "vista.html")
        return
    salidas = {"tokens.json": g_tokens(claro, oscuro), "contrastes.md": g_contrastes(claro, oscuro)}
    if "--comprobar" in sys.argv:
        viejos = [n for n, t in salidas.items() if not (DISENO / n).exists() or (DISENO / n).read_text(encoding="utf-8") != t]
        if viejos:
            raise SystemExit("diseno/ quedó viejo: " + ", ".join(viejos) + ". Correr python tools/diseno_generar.py")
        print("diseno/ al día")
        return
    for n, t in salidas.items():
        (DISENO / n).write_text(t, encoding="utf-8", newline="\n")
        print("escrito", "diseno/" + n)


if __name__ == "__main__":
    main()
