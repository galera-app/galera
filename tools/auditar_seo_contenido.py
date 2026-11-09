#!/usr/bin/env python3
"""Auditoria de SEO de contenido sobre el sitio armado (solo lectura, no falla el CI).

Uso:
  python tools/armar.py --salida dist
  python tools/auditar_seo_contenido.py [dist] [--todo]

Revisa en las paginas indexables (sin noindex): title (20-65 caracteres), description
(70-165), un solo h1, canonical que coincide con la ruta, JSON-LD valido, img con alt,
html lang, viewport, titulos y descripciones repetidos, y que sitemap.xml tenga todas las
paginas indexables y ninguna de mas. Con --todo incluye tambien las paginas noindex.
Complementa a verificar_seo.py (que controla la presencia de og:*, canonical, etc.).
Sale siempre con 0: es un informe para priorizar, no una barrera."""
import collections, json, os, re, sys

DIST = next((a for a in sys.argv[1:] if not a.startswith('-')), 'dist')
TODO = '--todo' in sys.argv


def paginas():
    for raiz, dirs, nombres in os.walk(DIST):
        if 'pagefind' in raiz.split(os.sep):
            continue
        for n in sorted(nombres):
            if n.endswith('.html'):
                yield os.path.join(raiz, n)


def main():
    titulos, descs = collections.defaultdict(list), collections.defaultdict(list)
    canon_ok, avisos, n = set(), [], 0
    for p in paginas():
        h = open(p, encoding='utf-8', errors='replace').read()
        rel = '/' + os.path.relpath(p, DIST).replace(os.sep, '/')
        noindex = bool(re.search(r'<meta name="robots" content="[^"]*noindex', h))
        if noindex and not TODO:
            continue
        n += 1
        m = re.search(r'<title>(.*?)</title>', h, re.S)
        t = m.group(1).strip() if m else ''
        m = re.search(r'<meta name="description" content="([^"]*)"', h)
        d = m.group(1) if m else ''
        pr = []
        if not t: pr.append('sin title')
        elif not 20 <= len(t) <= 65: pr.append(f'title de {len(t)}')
        if not d: pr.append('sin description')
        elif not 70 <= len(d) <= 165: pr.append(f'description de {len(d)}')
        h1 = len(re.findall(r'<h1[\s>]', h))
        if h1 != 1: pr.append(f'{h1} h1')
        m = re.search(r'<link rel="canonical" href="https://galera\.com\.ar([^"]*)"', h)
        if not m: pr.append('sin canonical')
        else:
            canon_ok.add(m.group(1))
            if m.group(1).rstrip('/') != rel.replace('index.html', '').rstrip('/') and m.group(1) != rel:
                pr.append(f'canonical {m.group(1)} no coincide con la ruta')
        for blq in re.findall(r'<script type="application/ld\+json">(.*?)</script>', h, re.S):
            try: json.loads(blq)
            except ValueError: pr.append('JSON-LD invalido')
        if not noindex and 'application/ld+json' not in h: pr.append('sin JSON-LD')
        sin_alt = [i for i in re.findall(r'<img\b[^>]*>', h) if not re.search(r'\balt=', i)]
        if sin_alt: pr.append(f'{len(sin_alt)} img sin alt')
        if 'lang="es' not in h and 'lang="en' not in h: pr.append('sin html lang')
        if 'name="viewport"' not in h: pr.append('sin viewport')
        if t: titulos[t].append(rel)
        if d: descs[d].append(rel)
        if pr: avisos.append(f'{rel}: ' + ', '.join(pr))
    print(f'{n} paginas revisadas ({"con" if TODO else "sin"} noindex)')
    print('\n'.join(avisos) or 'Sin avisos por pagina.')
    for nombre, mapa in (('titulos repetidos', titulos), ('descripciones repetidas', descs)):
        rep = {k: v for k, v in mapa.items() if len(v) > 1}
        print(f'\n{nombre}: {len(rep)}')
        for k, v in rep.items(): print(f'  {len(v)} x {k[:70]} -> {v[:4]}')
    sm = os.path.join(DIST, 'sitemap.xml')
    if os.path.exists(sm):
        urls = set(re.findall(r'<loc>https://galera\.com\.ar(.*?)</loc>', open(sm, encoding='utf-8').read()))
        print('\nindexables fuera del sitemap:', sorted(canon_ok - urls) or 'ninguna')
        print('sitemap sin pagina indexable:', sorted(urls - canon_ok) or 'ninguna')


main()
