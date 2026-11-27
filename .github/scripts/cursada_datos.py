"""Actualiza los datos de Cursada (cursada/datos/) con lo que publica la Facultad.

Lee https://academica.filo.uba.ar/horarios-de-materias-y-seminarios, baja los PDF de la carrera
(la oferta horaria del cuatrimestre y las mesas del turno de examen) y los convierte en:
  cursada/datos/oferta-AAAA-NC.json    comisiones con día, horario, aula y docente
  cursada/datos/mesas-AAAA-turno.json  mesas de examen por materia
y actualiza cursada/datos/indice.json. Además suma a cada calendario-AAAA.json los feriados nacionales
del sitio oficial (https://www.argentina.gob.ar/feriados, que los publica en holidays-AAAA-es.json).

Uso:
  python .github/scripts/cursada_datos.py             baja de la web
  python .github/scripts/cursada_datos.py a.pdf b.pdf usa PDF locales (para probar)

Lo corre .github/workflows/cursada-datos.yml una vez por semana. Si la planilla no se deja leer
(menos materias o comisiones de lo razonable), termina con error y NO pisa los datos publicados.
Requiere: pip install pypdf
"""
import io
import json
import re
import sys
import time
import unicodedata
import urllib.request
from datetime import date
from pathlib import Path

from pypdf import PdfReader

RAIZ = Path(__file__).resolve().parents[2]
DATOS = RAIZ / "datos"
PAGINA = "https://academica.filo.uba.ar/horarios-de-materias-y-seminarios"
FERIADOS = "https://www.argentina.gob.ar/sites/default/files/holidays-{anio}-es.json"
# Los "no laborables" (religiosos, regionales) quedan afuera: son optativos y no suspenden la cursada.
TIPOS_FERIADO = {"inamovible", "trasladable", "turistico"}
# Buzón de sugerencias (Apps Script de 104-edicion-cursada/sugerencias): la acción "pedidos" devuelve solo
# fecha, resumen, estado y versión de las filas que tienen resumen público. Nunca el texto ni el contacto.
BUZON = "https://script.google.com/macros/s/AKfycby-TbCIhqczXLYYUZXjagKyphO9sNYmZvTakpeUW_iI3lqSmahk_nUjBLJMBpFDkW5m/exec"
ESTADOS_PEDIDO = {"nuevo", "proceso", "hecho", "no"}
NOTA_PEDIDOS = ("Lo que piden por 💡 Sugerencias, resumido y sin datos de quien lo mandó (lo escribe Fidel en la planilla; "
                "el texto original y el contacto nunca salen de ahí). estado: nuevo | proceso | hecho | no. "
                "fecha: cuándo llegó; v: versión de Cursada en que salió (solo si está hecho).")
CARRERA = {"id": "edicion", "rotulo": "EDICIÓN", "plan": "edicion.json"}
DIAS = {"LUNES": 1, "MARTES": 2, "MIERCOLES": 3, "JUEVES": 4, "VIERNES": 5, "SABADO": 6}
RE_DIA = re.compile(r"\b(LUNES|MARTES|MI[EÉ]RCOLES|JUEVES|VIERNES|S[AÁ]BADO)\b", re.I)
RE_HORA = re.compile(r"\b(\d{1,2})(?:[:.](\d\d))?\s*A\s*(\d{1,2})(?:[:.](\d\d))?\s*HS\.?-?\s*(.*)$", re.I)
RE_ETIQUETA = re.compile(r"^(Te[oó]rico\s*-?\s*Pr[aá]ctico|Te[oó]rico|Pr[aá]ctico|Comisi[oó]n\s*\d+|HORARIO)\b", re.I)


def norm(s):
    s = unicodedata.normalize("NFD", str(s)).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def bajar(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (cursada; galera.com.ar)"})
    for intento in range(3):  # el sitio de la Facultad a veces no contesta desde los servidores de GitHub
        try:
            return urllib.request.urlopen(req, timeout=45).read()
        except OSError as e:
            if intento == 2:
                raise
            print(f"aviso: {url} no contestó ({e}); reintento")
            time.sleep(10 * (intento + 1))


def links_de_la_carrera():
    """Los archivos de Drive que la página enlaza con el rótulo de la carrera (oferta y turno de examen) y,
    del turno de examen, los de las carreras de OTRAS_MESAS (materias del plan que se rinden ahí e idiomas)."""
    html = bajar(PAGINA).decode("utf-8", "replace")
    corte = re.search(r"TURNO DE EX[AÁ]MEN", html, re.I)
    ids = []
    for a in re.finditer(r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', html, re.S):
        href, texto = a.group(1), norm(re.sub(r"<[^>]+>", "", a.group(2)))
        examen = corte is not None and a.start() > corte.start()
        if texto == norm(CARRERA["rotulo"]) or (examen and texto in OTRAS_MESAS):
            m = re.search(r"/d/([\w-]+)", href) or re.search(r"[?&]id=([\w-]+)", href)
            if m:
                ids.append((m.group(1), href))
    return ids


def trozos(pdf_bytes):
    """Cada texto del PDF con su posición: (página, y, x, texto), de arriba hacia abajo."""
    out = []
    for p, pagina in enumerate(PdfReader(io.BytesIO(pdf_bytes)).pages):
        def visitar(texto, cm, tm, fd, fs, p=p):
            if texto.strip():
                out.append((p, round(tm[5]), round(tm[4]), texto.strip()))
        pagina.extract_text(visitor_text=visitar)
    return sorted(out, key=lambda t: (t[0], -t[1], t[2]))


def oracion(s):
    """TÍTULO EN MAYÚSCULAS → Título en mayúsculas (si ya viene en minúsculas, queda como está)."""
    letras = [c for c in s if c.isalpha()]
    if letras and sum(c.isupper() for c in letras) > 0.6 * len(letras):
        s = s.lower()
        s = re.sub(r"(^|[.“\"]\s*)([a-záéíóúñ])", lambda m: m.group(1) + m.group(2).upper(), s)
    return s.strip()


def hhmm(h, m):
    return f"{int(h):02d}:{int(m or 0):02d}"


# ------------------------------------------------------------------ oferta horaria

def leer_oferta(T, plan):
    texto = " ".join(t[3] for t in T[:12])
    m = re.search(r"(\d)\s*[°ºo]?\s*Cuatrimestre\s+(\d{4})", texto, re.I)
    # «Bimestre de Verano 2027», «Cursos de Verano 2027» y, desde 2027, «HORARIOS DE VERANO EDICIÓN 2027».
    verano = re.search(r"(?:(?:Bimestre|Curso)s?\s+de\s+Verano|Horarios?\s+de\s+Verano(?:\s+[^\W\d_]+)*?)\s+(\d{4})", texto, re.I)
    if m:
        oid, nombre = f"{m.group(2)}-{m.group(1)}C", f"{'1.er' if m.group(1) == '1' else '2.º'} cuatrimestre {m.group(2)}"
    elif verano:
        oid, nombre = f"{verano.group(1)}-V", f"Verano {verano.group(1)}"
    else:
        raise ValueError("no encuentro el cuatrimestre en el encabezado")

    # Bloques: título (una o más líneas) → PROFESOR: → filas.
    bloques, titulo, actual = [], [], None
    for p, y, x, t in T:
        if re.match(r"PROFESOR", t, re.I):
            actual = {"titulo": " ".join(titulo), "docente": re.sub(r"^PROFESOR(ES|A|AS)?\s*:?\s*", "", t, flags=re.I).strip(), "items": []}
            bloques.append(actual)
            titulo = []
        elif t in ("Día", "Dia", "Horario", "Aula"):
            continue  # encabezado de columnas (ojo: "HORARIO" en mayúsculas es la etiqueta de los seminarios)
        elif RE_ETIQUETA.match(t) and x < 220 and actual is not None:
            actual["items"].append(("etiqueta", p, y, RE_ETIQUETA.match(t).group(1)))
            resto = t[RE_ETIQUETA.match(t).end():].strip()
            if resto:
                T_extra = (p, y, x + 140, resto)
                _clasificar(actual, *T_extra)
        elif actual is not None and (RE_DIA.search(t) or RE_HORA.search(t) or (x >= 400 and not re.fullmatch(r"\d", t))):
            _clasificar(actual, p, y, x, t)
        elif re.fullmatch(r"\d{1,2}", t):
            continue  # número de página
        elif re.search(r"cuatrimestre|cartelera sujeta|^edici[oó]n$|verano", t, re.I) and not titulo and actual is None:
            continue
        elif re.search(r"cartelera sujeta a cambios", t, re.I):
            continue
        else:
            titulo.append(t)

    nombres = {}
    for m_ in plan["materias"]:
        for o in [m_] + m_.get("opciones", []):
            if o.get("codigo"):
                nombres[norm(o["nombre"])] = o["id"]
    comisiones, extras, avisos = [], [], []
    for b in bloques:
        tit = re.sub(r"\s+", " ", b["titulo"]).strip()
        clave = norm(tit)
        mid = nombres.get(clave) or next((i for n, i in nombres.items() if n in clave or clave in n), None)
        if not mid:
            limpio = re.sub(r'^(SEMINARIO(\s+DE)?|PST)\s*:?\s*', lambda mm: "", tit, count=1, flags=re.I).strip(' "“”')
            es_pst = bool(re.match(r"PST", tit, re.I))
            mid = "sem-" + "-".join(norm(limpio).split()[:5])
            extras.append({"id": mid, "nombre": oracion(limpio), "tipo": "PST" if es_pst else "Seminario"})
        filas = _filas(b["items"])
        if not filas:
            avisos.append(f"sin horarios: {tit}")
        for etiqueta, bloques_h, aulas in filas:
            e = norm(etiqueta)
            tipo = "Teórico-práctico" if ("practico" in e and "teorico" in e) or e == "horario" else "Teórico" if e.startswith("teorico") else "Práctico"
            n = (re.search(r"\d+", etiqueta) or [None])[0] if tipo == "Práctico" else ""
            aula = " / ".join(dict.fromkeys(a for a in aulas if a))
            virtual = bool(re.search(r"virtual", aula, re.I))
            comisiones.append({"id": f"{mid}-{'t' if tipo == 'Teórico' else 'tp' if tipo == 'Teórico-práctico' else 'c' + str(n)}",
                               "materia": mid, "tipo": tipo, "nombre": str(n or ""), "docente": b["docente"].title() if tipo != "Práctico" else "",
                               "aula": "" if virtual else aula, "modalidad": "Virtual" if virtual else "", "bloques": bloques_h})
    con_horario = {c["materia"] for c in comisiones}
    return {"id": oid, "carrera": CARRERA["id"], "nombre": nombre, "fuente": PAGINA, "actualizado": date.today().isoformat(),
            "nota": "Cartelera sujeta a cambios: confirmá siempre en la planilla de la Facultad.",
            "extras": [e for e in extras if e["id"] in con_horario], "comisiones": comisiones}, avisos


def _clasificar(bloque, p, y, x, t):
    d, h = RE_DIA.search(t), RE_HORA.search(t)
    if d:
        bloque["items"].append(("dia", p, y, DIAS[norm(d.group(1)).upper()]))
    if h:
        bloque["items"].append(("hora", p, y, (hhmm(h.group(1), h.group(2)), hhmm(h.group(3), h.group(4)))))
        if h.group(5).strip():
            bloque["items"].append(("aula", p, y, h.group(5).strip()))
    if not d and not h:
        bloque["items"].append(("aula", p, y, t))


def _cerca(items, p, y, tol, usados):
    mejor = None
    for i, (pp, yy, v) in enumerate(items):
        if i in usados or pp != p or abs(yy - y) > tol:
            continue
        if mejor is None or abs(yy - y) < abs(items[mejor][1] - y):
            mejor = i
    return mejor


def _filas(items):
    """[(etiqueta, [bloques], [aulas])]: une etiqueta, día, horario y aula de cada fila por cercanía vertical."""
    de = lambda k: [(p, y, v) for kk, p, y, v in items if kk == k]
    etiquetas, dias, horas, aulas = de("etiqueta"), de("dia"), de("hora"), de("aula")
    ud, ua, ue = set(), set(), set()
    filas = []
    for p, y, (desde, hasta) in horas:
        i = _cerca(dias, p, y, 5, ud)
        if i is None:
            continue
        ud.add(i)
        a = _cerca(aulas, p, y, 11, ua)
        if a is not None:
            ua.add(a)
        e = _cerca(etiquetas, p, y, 5, ue)
        if e is not None:
            ue.add(e)
        filas.append({"p": p, "y": y, "e": e, "bloque": {"dia": dias[i][2], "desde": desde, "hasta": hasta}, "aula": aulas[a][2] if a is not None else ""})
    # Las filas sin etiqueta toman, en orden, las etiquetas que quedaron sueltas; si no hay, son otro día de la fila anterior.
    libres = [i for i in range(len(etiquetas)) if i not in ue]
    out = []
    for f in filas:
        if f["e"] is None and libres:
            f["e"] = libres.pop(0)
        if f["e"] is None and out:
            out[-1][1].append(f["bloque"])
            out[-1][2].append(f["aula"])
        elif f["e"] is not None:
            out.append((etiquetas[f["e"]][2], [f["bloque"]], [f["aula"]]))
    # Una misma etiqueta repetida (una comisión con dos días) se junta.
    juntas = {}
    for et, bl, au in out:
        k = norm(et)
        if k in juntas:
            juntas[k][1].extend(bl)
            juntas[k][2].extend(au)
        else:
            juntas[k] = (et, bl, au)
    return list(juntas.values())


# ------------------------------------------------------------------ mesas de examen

# Del turno de examen también se leen las planillas de otras carreras, pero solo las materias que el plan
# de Edición toma de ellas, y la de Lenguas Modernas (idiomas). Cada regla: (comienzo del nombre, ya
# normalizado con norm(), id de la materia u opción del plan). La cátedra (PROF. X) se guarda aparte.
OTRAS_MESAS = {
    "letras": ("Letras", [(r"teoria y analisis literario\b", "tal")]),
    "bibliotecologia": ("Bibliotecología", [(r"metodos de investigacion en bibliotecologia\b", "biblio")]),
    "ciencias antropologicas": ("Antropología", [(r"epistemologia y metodos de investigacion social\b", "antropo")]),
    "lenguas modernas": ("Lenguas Modernas", [(r"(ingles|frances|aleman|italiano|portugues) nivel (elemental|medio|superior)$", None)]),
}
IDIOMAS = {"ingles": "Inglés", "frances": "Francés", "aleman": "Alemán", "italiano": "Italiano", "portugues": "Portugués"}
NIVELES = {"elemental": "1", "medio": "2", "superior": "3"}


def carrera_del_pdf(T):
    """El rótulo que la planilla trae debajo de «MESAS DE EXÁMENES» (EDICIÓN, LETRAS...), normalizado."""
    for i, t in enumerate(T):
        if re.fullmatch(r"MESAS? DE EX[AÁ]MEN(ES)?", t[3], re.I) and i + 1 < len(T):
            return norm(T[i + 1][3])
    return ""


def _lineas(items):
    """Agrupa los trozos del título por renglón (misma página y altura)."""
    out = []
    for p, y, x, t in items:
        if out and out[-1][0] == p and abs(out[-1][1] - y) <= 2:
            out[-1][2].append(t)
        else:
            out.append([p, y, [t]])
    return [" ".join(l[2]).strip() for l in out]


def _materia_de_otra(linea, reglas):
    """(id del plan, nombre para mostrar, cátedra) si el renglón es una materia que Edición toma de esa carrera."""
    cat = re.search(r"(?<![A-Z])PROF\.?\s+(.+)$", linea, re.I)
    base = linea[:cat.start()].strip() if cat else linea
    n = norm(base)
    for patron, mid in reglas:
        m = re.match(patron, n)
        if not m:
            continue
        if mid is None:  # idiomas: Inglés va a los tres niveles del plan; los demás, a la opción de «Otro idioma» (nivel 1)
            idi, niv = m.group(1), m.group(2)
            mid = f"ingles{NIVELES[niv]}" if idi == "ingles" else (idi if niv == "elemental" else "")
            return mid, f"{IDIOMAS[idi]}, nivel {niv}", ""
        return mid, oracion(base), oracion(cat.group(1)).title() if cat else ""
    return None


def leer_mesas(T, plan, carrera="edicion"):
    """Mesas de una planilla de turno de examen. Edición: todas sus materias; otra carrera: solo las de OTRAS_MESAS."""
    cab = " ".join(t[3] for t in T[:10])
    anio = (re.search(r"ACAD[EÉ]MICO:?\s*(\d{4})", cab, re.I) or re.search(r"(20\d\d)", cab)).group(1)
    turno = re.search(r"TURNO:?\s*([A-ZÁÉÍÓÚ]+)", cab, re.I).group(1).capitalize()
    nombres = {}
    for m_ in plan["materias"]:
        for o in [m_] + m_.get("opciones", []):
            if o.get("codigo"):
                nombres[norm(o["nombre"])] = o["id"]
    otra = OTRAS_MESAS.get(carrera)
    mesas, titulo, actual, en_titulo = [], [], None, False
    pendientes = []
    for p, y, x, t in T:
        if re.fullmatch(r"MATERIAS?|SEMINARIOS?|IDIOMAS?", t, re.I):
            titulo, en_titulo = [], True
        elif re.fullmatch(r"FECHA|HORARIO|LLAMADO|AULA", t, re.I):
            if en_titulo:
                # Un bloque puede traer varias materias con las mismas fechas (pasa en Letras y en idiomas).
                if otra:
                    cuales = [r for r in (_materia_de_otra(l, otra[1]) for l in _lineas(titulo)) if r]
                else:
                    tit = " ".join(t_[3] for t_ in titulo)
                    cuales = [(nombres.get(norm(tit), ""), oracion(tit), "")]
                    if not cuales[0][0]:
                        por_linea = [(nombres.get(norm(l), ""), oracion(l), "") for l in _lineas(titulo)]
                        if any(c[0] for c in por_linea):
                            cuales = por_linea
                actual = {"cuales": cuales, "items": []}
                pendientes.append(actual)
                en_titulo = False
        elif en_titulo:
            titulo.append((p, y, x, t))
        elif actual is not None and not re.fullmatch(r"\d", t):
            actual["items"].append((p, y, x, t))
    for a in pendientes:
        fechas = [(p, y, re.search(r"(\d{1,2})/(\d{1,2})/(\d{2,4})", t)) for p, y, x, t in a["items"] if re.search(r"\d{1,2}/\d{1,2}/\d{2,4}", t)]
        horas = [(p, y, re.search(r"(\d{1,2})[:.](\d\d)", t)) for p, y, x, t in a["items"] if re.search(r"\d{1,2}[:.]\d\d\s*HS", t, re.I)]
        llamados = [(p, y, t) for p, y, x, t in a["items"] if re.search(r"LLAMADO", t, re.I)]
        aulas = [(p, y, t) for p, y, x, t in a["items"] if x >= 400 and not re.search(r"LLAMADO|HS|/", t, re.I)]
        uh, ul, ua = set(), set(), set()
        for p, y, f in fechas:
            d, mth, yy = f.groups()
            h = _cerca(horas, p, y, 12, uh)
            ll = _cerca(llamados, p, y, 12, ul)
            au = _cerca(aulas, p, y, 12, ua)
            for s, i in ((uh, h), (ul, ll), (ua, au)):
                if i is not None:
                    s.add(i)
            # Un año anterior al del turno es una errata de la planilla (pasó: «02/12/25» en el turno diciembre 2026).
            yy = max(int(yy) + (2000 if int(yy) < 100 else 0), int(anio))
            for mid, nombre, catedra in a["cuales"]:
                mesa = {"materia": mid, "nombre": nombre,
                        "fecha": f"{yy}-{int(mth):02d}-{int(d):02d}",
                        "hora": f"{int(horas[h][2].group(1)):02d}:{horas[h][2].group(2)}" if h is not None else "",
                        "llamado": re.sub(r"\s+", " ", llamados[ll][2]).strip().capitalize() if ll is not None else "",
                        "aula": aulas[au][2] if au is not None else ""}
                if otra:
                    mesa["origen"] = otra[0]
                    if catedra:
                        mesa["catedra"] = catedra
                mesas.append(mesa)
    mid = f"{anio}-{norm(turno)}"
    return {"id": mid, "carrera": CARRERA["id"], "nombre": f"Turno {turno.lower()} {anio}", "fuente": PAGINA, "actualizado": date.today().isoformat(),
            "nota": "Cartelera sujeta a cambios: confirmá siempre en la planilla de la Facultad.", "mesas": sorted(mesas, key=lambda m: (m["fecha"], m["hora"]))}


# ------------------------------------------------------------------ feriados

def leer_feriados(anio):
    """Feriados nacionales del año según argentina.gob.ar: [{fecha, t, tipo}], ordenados y sin repetir."""
    d = json.loads(bajar(FERIADOS.format(anio=anio)).decode("utf-8"))
    out = {}
    for x in d["mainEntity"]["itemListElement"]:
        i = x["item"]
        fecha, tipo = i.get("startDate", ""), i.get("additionalProperty", {}).get("value", "")
        nombre = i.get("name", "")
        # Los feriados "especiales" son de una sola jurisdicción: cuentan si son de la Ciudad, donde está la Facultad
        # (por ejemplo, la visita del Papa del 10/11/2026). El nombre trae un link a la norma: se saca.
        caba = tipo == "especial" and "Ciudad Autónoma de Buenos Aires" in nombre
        if caba:
            nombre = re.sub(r"\s*\(\s*<a\b.*$", "", nombre, flags=re.S) + " (feriado en la Ciudad)"
        if fecha.startswith(f"{anio}-") and re.fullmatch(r"\d{4}-\d\d-\d\d", fecha) and (tipo in TIPOS_FERIADO or caba) and fecha not in out:
            out[fecha] = {"fecha": fecha, "t": re.sub(r"\s+", " ", re.sub(r"<[^>]*>", "", nombre)).strip()[:120], "tipo": tipo}
    return sorted(out.values(), key=lambda f: f["fecha"])


def actualizar_feriados(indice):
    """Suma los feriados a cada calendario-AAAA.json. Si el sitio falla o trae poco, avisa y deja los que había."""
    cambios = []
    for c in indice.get("calendarios", []):
        ruta = DATOS / c["archivo"]
        try:
            fer = leer_feriados(c["anio"])
        except Exception as e:  # un sitio caído no frena la oferta ni las mesas
            print(f"aviso: no pude leer los feriados {c['anio']}: {e}")
            continue
        if len(fer) < 8:
            print(f"aviso: los feriados {c['anio']} trajeron solo {len(fer)}; no los toco")
            continue
        cal = json.loads(ruta.read_text(encoding="utf-8"))
        if cal.get("feriados") != fer:
            cal["feriados"] = fer
            cal["fuente_feriados"] = {"t": "Feriados nacionales (argentina.gob.ar)", "url": "https://www.argentina.gob.ar/feriados"}
            ruta.write_text(json.dumps(cal, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
            cambios.append(c["archivo"])
        print(f"feriados {c['anio']}: {len(fer)}")
    return cambios


def actualizar_pedidos():
    """Baja de la planilla de sugerencias los pedidos con resumen público y escribe pedidos.json.
    Si el buzón falla o trae algo raro, deja el JSON anterior como estaba."""
    try:
        r = json.loads(bajar(BUZON + "?accion=pedidos").decode("utf-8"))
        if not r.get("ok") or not isinstance(r.get("pedidos"), list):
            raise ValueError(r.get("error") or "respuesta inesperada")
        versiones = {x.get("v") for x in json.loads((DATOS / "novedades.json").read_text(encoding="utf-8"))["novedades"]}
        pedidos = []
        for p in r["pedidos"]:
            resumen = re.sub(r"\s+", " ", "".join(c if c.isprintable() and c not in "<>" else " " for c in str(p.get("resumen", "")))).strip()[:200]
            fecha = str(p.get("fecha", ""))
            if not resumen or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", fecha) or p.get("estado") not in ESTADOS_PEDIDO:
                continue
            v = p.get("v")
            if p["estado"] != "hecho" or not isinstance(v, int) or v not in versiones:
                v = None
            pedidos.append({"fecha": fecha, "resumen": resumen, "estado": p["estado"], "v": v})
        if escribir("pedidos.json", {"nota": NOTA_PEDIDOS, "pedidos": pedidos}):
            print(f"pedidos: {len(pedidos)}")
            return ["pedidos.json"]
    except Exception as e:  # noqa: BLE001: cualquier falla deja el archivo publicado como estaba
        print(f"aviso: no se pudieron bajar los pedidos ({e}); queda el pedidos.json anterior")
    return []


# ------------------------------------------------------------------ principal

def escribir(nombre, datos):
    ruta = DATOS / nombre
    nuevo = json.dumps(datos, ensure_ascii=False, indent=1) + "\n"
    if ruta.exists():
        # Si lo único que cambia es la fecha de actualización, no se toca (para no commitear ruido).
        viejo = json.loads(ruta.read_text(encoding="utf-8"))
        if {**viejo, "actualizado": None} == {**datos, "actualizado": None}:
            return False
    ruta.write_text(nuevo, encoding="utf-8")
    return True


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    plan = json.loads((DATOS / CARRERA["plan"]).read_text(encoding="utf-8"))
    if len(sys.argv) > 1:
        pdfs = [Path(a).read_bytes() for a in sys.argv[1:]]
    else:
        ids = links_de_la_carrera()
        if not ids:
            sys.exit("No encontré los archivos de la carrera en la página de la Facultad.")
        pdfs = [bajar(f"https://drive.google.com/uc?export=download&id={i}") for i, _ in ids]
    indice = json.loads((DATOS / "indice.json").read_text(encoding="utf-8"))
    indice.setdefault("mesas", [])
    cambios = []
    turnos = {}  # id del turno → {"edicion": planilla de Edición, "otras": [mesas de otras carreras]}
    for pdf in pdfs:
        if pdf[:4] != b"%PDF":
            print("aviso: uno de los archivos no es un PDF; lo salteo")
            continue
        T = trozos(pdf)
        cab = " ".join(t[3] for t in T[:10])
        carrera = carrera_del_pdf(T)
        otra = next((k for k in OTRAS_MESAS if carrera.startswith(k)), None)
        es_mesas = bool(re.search(r"MESAS? DE EX[AÁ]MEN", " ".join(t[3] for t in T), re.I))
        if not es_mesas and not re.search(r"EDICI[ÓO]N", " ".join(t[3] for t in T[:3]), re.I):
            # Horarios de otras carreras (la Facultad los enlaza en la misma sección): no son de Edición.
            continue
        if es_mesas and carrera and not carrera.startswith(norm(CARRERA["rotulo"])):
            # Planillas de otras carreras: solo las de OTRAS_MESAS; si una no se deja leer, se avisa y siguen las de Edición.
            if not otra:
                continue
            try:
                m = leer_mesas(T, plan, otra)
            except Exception as e:
                print(f"aviso: no pude leer las mesas de {otra}: {e}")
                continue
            turnos.setdefault(m["id"], {}).setdefault("otras", []).extend(m["mesas"])
            print(f"mesas {m['id']} de {OTRAS_MESAS[otra][0]}: {len(m['mesas'])}")
            continue
        if es_mesas:
            m = leer_mesas(T, plan)
            if len(m["mesas"]) < 3:
                sys.exit(f"Las mesas de examen no se dejaron leer bien ({len(m['mesas'])} mesas). No toco nada.")
            turnos.setdefault(m["id"], {})["edicion"] = m
            print(f"mesas {m['id']}: {len(m['mesas'])} ({sum(1 for x in m['mesas'] if x['materia'])} reconocidas)")
        else:
            o, avisos = leer_oferta(T, plan)
            if o["id"].endswith("-V"):
                # La app toma como vigente la última oferta del índice: una de verano (solo seminarios) taparía el cuatrimestre.
                print(f"aviso: la oferta de {o['nombre']} se lee ({len(o['comisiones'])} comisiones) pero no se publica todavía")
                continue
            reconocidas = {c["materia"] for c in o["comisiones"] if not c["materia"].startswith("sem-")}
            if len(reconocidas) < 5 or len(o["comisiones"]) < 15:
                sys.exit(f"La oferta no se dejó leer bien ({len(reconocidas)} materias, {len(o['comisiones'])} comisiones). No toco nada.")
            archivo = f"oferta-{o['id'].lower()}.json"
            # Si ya había una oferta de este cuatrimestre y la nueva trae mucho menos, algo se leyó mal: no se pisa.
            if (DATOS / archivo).exists():
                antes = len(json.loads((DATOS / archivo).read_text(encoding="utf-8")).get("comisiones", []))
                if antes >= 15 and len(o["comisiones"]) < 0.6 * antes:
                    sys.exit(f"La oferta nueva trae {len(o['comisiones'])} comisiones y la publicada tiene {antes}. Parece una lectura fallida: no toco nada.")
            if len(pdf) > 5_000_000:
                sys.exit("El PDF de la oferta pesa demasiado para ser la planilla de siempre. No toco nada.")
            if escribir(archivo, o):
                cambios.append(archivo)
            if not any(x["id"] == o["id"] for x in indice["ofertas"]):
                indice["ofertas"].append({"id": o["id"], "nombre": o["nombre"], "carrera": CARRERA["id"], "archivo": archivo})
            print(f"oferta {o['id']}: {len(reconocidas)} materias del plan, {len(o['extras'])} seminarios, {len(o['comisiones'])} comisiones")
            for a in avisos:
                print("  aviso:", a)
    for tid, tn in turnos.items():
        m = tn.get("edicion")
        if not m:
            print(f"aviso: hay mesas de otras carreras del turno {tid} pero no la planilla de Edición; no las publico")
            continue
        m["mesas"] = sorted(m["mesas"] + tn.get("otras", []), key=lambda x: (x["fecha"], x["hora"], x["nombre"]))
        archivo = f"mesas-{m['id']}.json"
        if escribir(archivo, m):
            cambios.append(archivo)
        if not any(x["id"] == m["id"] for x in indice["mesas"]):
            indice["mesas"].append({"id": m["id"], "nombre": m["nombre"], "carrera": CARRERA["id"], "archivo": archivo})
    cambios += actualizar_feriados(indice)
    cambios += actualizar_pedidos()
    indice["ofertas"].sort(key=lambda x: x["id"])
    indice["mesas"].sort(key=lambda x: x["archivo"])
    if escribir("indice.json", indice):
        cambios.append("indice.json")
    print("cambios:", ", ".join(cambios) or "ninguno")


if __name__ == "__main__":
    main()
