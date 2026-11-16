# Reglas

## Accesibilidad

- Texto normal, 4,5 : 1 como mínimo; bordes de control y gráficos, 3 : 1. Los pares de `tokens.css` están pensados para eso en claro y en oscuro.
- Piso de 12 px (`--t-xs`). Nada de 11 px o menos.
- Táctiles de 44 en celular; compacto de 40 solo con puntero fino.
- Nunca color solo: ícono y palabra van con el color. Verde y naranja nunca son texto.
- Botones de ícono con `aria-label`; SVG decorativos con `aria-hidden`.
- Todo en rem; a 200 % de texto, las filas se apilan.

## Color

- Títulos en tinta (`--texto`); apoyo en `--texto2`. Texto chico en `--tenue` o más oscuro.
- El azul de marca (`--marca`) va en trazos, la g, la capitular y el botón primario; el texto azul usa `--tinta`.
- Todo color sale de una variable de `tokens.css`. Un hex suelto en otra hoja es un error (salvo piezas de color fijo, como el póster A3).

## Escritura

Español rioplatense, comillas latinas «», verbos en infinitivo en botones, espacio fino en las cifras de los anillos.

## Técnica

- Las fuentes se alojan en el sitio, como `.woff2`: la CSP no admite terceros.
- Sin estilos ni scripts en línea (CSP); el marco se arma con `tools/armar.py`.

## Pendientes

Diferencias entre las láminas y el código, sin resolver. Hasta que se decidan, manda el código.

1. **Tarjeta:** la lámina Componentes dice borde de 1 px en `--borde-campo` sin relleno; `componentes.css` (`.gl-tarjeta`) usa relleno Plata sin borde.
2. **`--tenue-2`:** gris de apoyo de componentes, distinto de `--tenue`. Decisión pendiente de Fidel (comentario en `tokens.css`).
3. **Escala de títulos:** 56, 40 y 28 px no son tokens; están sueltos en `.gl-display`, `.gl-t1` y `.gl-t2`.
4. **Ícono y favicon:** no se verificó que los PNG de `img/` usen el corrimiento de métrica de [marca.md](marca.md).
5. **`--tenue-2` sobre cielo** (`--tinta-suave`) da 4,1 : 1 en claro: no llega a 4,5 (ver [contrastes](contrastes.md)).
6. **`--estado-ok-pleno` no tiene valor oscuro**: el anillo completo queda en 2,7 : 1 sobre el fondo oscuro.
