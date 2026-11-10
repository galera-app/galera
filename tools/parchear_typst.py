"""Parchea el glue de typst.ts (vendor/typst/*.mjs) para que ande con la CSP de Galera, que no admite eval.

wasm-bindgen arma algunas funciones con `new Function(...)`. Las que pide typst.ts 0.7.0 son pocas y fijas:
- "return this" (encontrar el objeto global) y "return 0" (función vacía);
- ("path", "return path") (identidad);
- "throw new Error('Dummy AccessModel…')" y "throw new Error('Dummy Registry…')" (sin archivos ni paquetes externos).
Se responden sin evaluar nada. Cualquier otro cuerpo tira un error que lo nombra (tools/probar_prensa.mjs lo detectaría).
Se corre una vez cada vez que se actualiza typst.ts; no hace nada si ya está aplicado.
Uso: python tools/parchear_typst.py
"""
from pathlib import Path

DIR = Path(__file__).resolve().parent.parent / "vendor" / "typst"
MARCA = "// Galera: sin eval (tools/parchear_typst.py)"
SHIM = MARCA + r"""
const galeraFuncion = (...a) => {
    const cuerpo = String(a[a.length - 1]).trim();
    let m;
    if (a.length === 1 && (m = /^return\s+(this|-?\d+(?:\.\d+)?|true|false|null|undefined)\s*;?$/.exec(cuerpo))) {
        const v = m[1] === 'this' ? globalThis : m[1] === 'undefined' ? undefined : JSON.parse(m[1]);
        return function () { return v; };
    }
    if (a.length === 2 && /^[A-Za-z_$][\w$]*$/.test(a[0]) && cuerpo === 'return ' + a[0]) return function (x) { return x; };
    if (a.length === 1 && (m = /^throw new Error\('([^'\\]*)'\)\s*;?$/.exec(cuerpo))) { const t = m[1]; return function () { throw new Error(t); }; }
    throw new Error('Galera: la CSP no admite Function(): ' + cuerpo.slice(0, 80));
};
"""

for f in ("typst_ts_web_compiler.mjs", "typst_ts_renderer.mjs"):
    p = DIR / f
    t = p.read_text(encoding="utf-8")
    if MARCA in t:
        print("ya parcheado:", f)
        continue
    n = t.count("new Function(")
    t = t.replace("new Function(", "galeraFuncion(")
    i = t.index("\n") + 1 if t.startswith("///") else 0
    p.write_text(t[:i] + SHIM + t[i:], encoding="utf-8", newline="\n")
    print(f, n, "reemplazos")
