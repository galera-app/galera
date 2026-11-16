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


def main():
    claro, oscuro = leer()
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
