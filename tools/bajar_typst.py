"""Baja el compilador de Typst para el navegador (typst.ts, Apache-2.0) a vendor/typst/.

El WASM pesa 27 MB: no va en el repo (está en .gitignore) y supera el tope de 25 MiB por archivo de Cloudflare Pages.
Dónde se aloja en el sitio publicado es la consulta D1 (407-personal-strategos/consultas/104-galera-prensa.md).
Este script lo usan las pruebas (CI y local) y el armado del sitio cuando haga falta.
Uso: python tools/bajar_typst.py   (no hace nada si ya está y coincide la huella)
"""
import base64
import hashlib
import io
import json
import sys
import tarfile
import urllib.request
from pathlib import Path

PAQUETE, VERSION = "@myriaddreamin/typst-ts-web-compiler", "0.7.0"
ARCHIVO = "package/pkg/typst_ts_web_compiler_bg.wasm"
DESTINO = Path(__file__).resolve().parent.parent / "vendor" / "typst" / "typst_ts_web_compiler_bg.wasm"
HUELLA = DESTINO.with_suffix(".wasm.sha256")


def main():
    if DESTINO.exists() and HUELLA.exists() and hashlib.sha256(DESTINO.read_bytes()).hexdigest() == HUELLA.read_text().strip():
        print("ya está:", DESTINO)
        return
    meta = json.load(urllib.request.urlopen(f"https://registry.npmjs.org/{PAQUETE}/{VERSION}", timeout=60))
    url, integridad = meta["dist"]["tarball"], meta["dist"]["integrity"]
    datos = urllib.request.urlopen(url, timeout=300).read()
    algo, esperado = integridad.split("-", 1)
    if base64.b64encode(hashlib.new(algo, datos).digest()).decode() != esperado:
        sys.exit("La descarga no coincide con la integridad que publica npm: no se usa.")
    with tarfile.open(fileobj=io.BytesIO(datos), mode="r:gz") as t:
        wasm = t.extractfile(ARCHIVO).read()
    DESTINO.parent.mkdir(parents=True, exist_ok=True)
    DESTINO.write_bytes(wasm)
    HUELLA.write_text(hashlib.sha256(wasm).hexdigest() + "\n")
    print(f"{DESTINO} ({len(wasm) / 1e6:.1f} MB, {PAQUETE}@{VERSION})")


if __name__ == "__main__":
    main()
