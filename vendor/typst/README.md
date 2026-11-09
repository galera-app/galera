# vendor/typst: el motor de la Imprenta

Lo usa `imprenta-editor.js` (pantalla `/imprenta/`). Se baja recién cuando alguien aprieta «Prender la vista previa».

| Archivo | Qué es | Origen | Licencia |
|---|---|---|---|
| `typst_ts_web_compiler.mjs` | glue del compilador | npm `@myriaddreamin/typst-ts-web-compiler` 0.7.0 (Typst 0.14.2), parcheado | Apache-2.0 |
| `typst_ts_web_compiler_bg.wasm` | compilador (27 MB) | el mismo paquete; **no está en el repo**: lo baja `python tools/bajar_typst.py`, verificado contra la integridad de npm | Apache-2.0 |
| `typst_ts_renderer.mjs`, `typst_ts_renderer_bg.wasm` | vista previa en SVG | npm `@myriaddreamin/typst-ts-renderer` 0.7.0, glue parcheado | Apache-2.0 |
| `fuentes/*.ttf` | Literata, Instrument Sans, UnifrakturMaguntia | las de la plantilla LaTeX de los apuntes | SIL OFL 1.1 (`fuentes/OFL-*.txt`) |

- **Parche**: la CSP de Galera no admite `eval`, y el glue de wasm-bindgen arma unas pocas funciones con `new Function(...)`. `python tools/parchear_typst.py` las reemplaza por equivalentes sin evaluar nada. Hay que correrlo cada vez que se actualiza typst.ts; `tools/probar_prensa.mjs` falla si queda un `new Function(`.
- **Alojamiento del WASM**: pesa más que el tope de 25 MiB por archivo de Cloudflare Pages. Dónde vive en el sitio publicado es la consulta D1 (`407-personal-strategos/consultas/104-galera-prensa.md`); la URL está en `Motor.WASM`, en `imprenta-editor.js`.
- Licencia de Apache 2.0: `LICENSE-Apache-2.0.txt`.
