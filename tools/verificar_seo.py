"""Revisa SEO, metadatos y vista previa (WhatsApp, LinkedIn, X) de las páginas HTML de un sitio estático.

Qué controla en cada página (las que tienen noindex solo se revisan en lo de la vista previa):
  title (10 a 70 caracteres) · meta description (50 a 170) · lang · viewport · canonical (https, termina donde debe)
  og:title, og:description, og:type, og:url, og:image (+ og:image:alt) · twitter:card
  la imagen existe en el sitio, es JPG o PNG (LinkedIn no lee bien WebP) y mide 1200×630 (2:1 aprox.)
  la URL está en sitemap.xml (si la página es indexable)

Uso (rutas absolutas):
  python verificar_seo.py <carpeta del sitio> [--solo-cambios] [--solo <subcarpeta>] [--dominio https://ficha.github.io]
  --solo-cambios: solo las páginas que cambiaron respecto de origin/main (para revisar un PR antes de mergear).
  --solo cursada: solo esa subcarpeta.
Sale con código 1 si hay fallas (los avisos no cortan).
"""
import argparse
import re
import subprocess
import sys
from html.parser import HTMLParser
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
SALTAR = ("_anterior", "node_modules", ".git", ".github", "_disenos", "_figma")


class Meta(HTMLParser):
    def __init__(self):
        super().__init__()
        self.title, self.en_title, self.meta, self.links, self.lang, self.ld = "", False, {}, {}, "", 0

    def handle_starttag(self, tag, a):
        a = dict(a)
        if tag == "html":
            self.lang = a.get("lang", "")
        elif tag == "title":
            self.en_title = True
        elif tag == "meta":
            k = a.get("property") or a.get("name")
            if k and "content" in a:
                self.meta.setdefault(k, a["content"])
        elif tag == "link" and a.get("rel") and a.get("href"):
            self.links.setdefault(a["rel"], a["href"])
        elif tag == "script" and a.get("type") == "application/ld+json":
            self.ld += 1

    def handle_endtag(self, tag):
        if tag == "title":
            self.en_title = False

    def handle_data(self, d):
        if self.en_title:
            self.title += d


def local_de(url, raiz, dominio):
    if url.startswith(dominio):
        return raiz / url[len(dominio):].lstrip("/").split("?")[0]
    return None


def revisar(path, raiz, dominio, sitemap):
    f, av = [], []
    txt = path.read_text(encoding="utf-8", errors="replace")
    m = Meta()
    m.feed(txt)
    M, rel = m.meta, path.relative_to(raiz).as_posix()
    noindex = "noindex" in M.get("robots", "").lower()
    t = m.title.strip()
    if not t:
        f.append("falta <title>")
    elif not 10 <= len(t) <= 70:
        av.append(f"title de {len(t)} caracteres (ideal: 10 a 70)")
    d = M.get("description", "")
    if not d:
        f.append("falta meta description")
    elif not 50 <= len(d) <= 170:
        av.append(f"description de {len(d)} caracteres (ideal: 50 a 170)")
    if not m.lang:
        f.append("falta lang en <html>")
    if "viewport" not in M:
        f.append("falta meta viewport")
    can = m.links.get("canonical") if isinstance(m.links.get("canonical"), str) else next((v for k, v in m.links.items() if "canonical" in k), "")
    if not noindex:
        if not can:
            f.append("falta link canonical")
        elif not can.startswith("https://"):
            f.append(f"canonical sin https: {can}")
    for k in ("og:title", "og:description", "og:type", "og:url", "og:image", "twitter:card"):
        if not M.get(k):
            f.append(f"falta {k}")
    if M.get("og:image") and not M.get("og:image:alt") and not M.get("twitter:image:alt"):
        av.append("falta og:image:alt")
    if M.get("og:url") and can and M["og:url"].rstrip("/") != can.rstrip("/"):
        av.append(f"og:url distinto del canonical ({M['og:url']} ≠ {can})")
    img = M.get("og:image", "")
    if img:
        if not img.startswith("https://"):
            f.append(f"og:image no es una URL https absoluta: {img}")
        if img.lower().endswith(".webp"):
            f.append("og:image es WebP (LinkedIn y otras redes no lo leen bien): usar JPG o PNG")
        loc = local_de(img, raiz, dominio)
        if loc is not None:
            if not loc.exists():
                f.append(f"og:image no existe en el sitio: {img}")
            else:
                try:
                    from PIL import Image
                    w, h = Image.open(loc).size
                    if abs(w / h - 1.91) > 0.15:
                        av.append(f"og:image de {w}×{h}: conviene 1200×630 (1,91:1)")
                    if w < 600:
                        f.append(f"og:image muy chica ({w}×{h})")
                except ImportError:
                    av.append("no pude medir la imagen: falta Pillow (usar el Python del sistema)")
                except Exception:
                    pass
                if loc.stat().st_size > 600_000:
                    av.append(f"og:image pesa {loc.stat().st_size // 1024} KB (WhatsApp prefiere menos de 300 KB)")
    if not noindex and can and sitemap is not None and can not in sitemap and can.rstrip("/") not in sitemap and (can.rstrip("/") + "/") not in sitemap:
        av.append("no está en sitemap.xml")
    if not noindex and not m.ld:
        av.append("sin datos estructurados (JSON-LD)")
    return rel, f, av


def cambiadas(raiz):
    def git(*a):
        return subprocess.run(["git", "-C", str(raiz), *a], capture_output=True, text=True, encoding="utf-8").stdout.split("\n")
    nombres = set(git("diff", "--name-only", "origin/main...HEAD")) | set(git("diff", "--name-only")) | set(git("ls-files", "--others", "--exclude-standard"))
    return {n for n in nombres if n.endswith(".html")}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("sitio")
    ap.add_argument("--solo-cambios", action="store_true")
    ap.add_argument("--solo", default="")
    ap.add_argument("--dominio", default="https://ficha.github.io")
    a = ap.parse_args()
    raiz = Path(a.sitio).resolve()
    sm = raiz / "sitemap.xml"
    sitemap = set(re.findall(r"<loc>(.*?)</loc>", sm.read_text(encoding="utf-8"))) if sm.exists() else None
    cambios = cambiadas(raiz) if a.solo_cambios else None
    paginas = []
    for p in sorted(raiz.rglob("*.html")):
        rel = p.relative_to(raiz).as_posix()
        if any(s in rel.split("/") for s in SALTAR) or "sync-conflict" in rel or (a.solo and not rel.startswith(a.solo.strip("/") + "/")):
            continue
        if cambios is not None and rel not in cambios:
            continue
        paginas.append(p)
    fallas = avisos = 0
    for p in paginas:
        rel, f, av = revisar(p, raiz, a.dominio, sitemap)
        fallas += len(f)
        avisos += len(av)
        if f or av:
            print(rel)
            for x in f:
                print("   FALLA  " + x)
            for x in av:
                print("   aviso  " + x)
    print(f"\n{len(paginas)} páginas revisadas: {fallas} fallas, {avisos} avisos.")
    sys.exit(1 if fallas else 0)


if __name__ == "__main__":
    main()
