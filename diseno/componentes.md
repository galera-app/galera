# Componentes

Todos viven en `componentes.css` con prefijo `gl-`, toman los colores de `tokens.css` y tienen versión oscura sin código propio. Un solo radio: `--radio`. Sin sombras (`--sombra: none`).

| Componente | Clase | Regla |
|---|---|---|
| Estado de una materia | `.gl-estado` + `.gl-pen`, `.gl-cur`, `.gl-reg`, `.gl-apr` | Ícono (círculo vacío, cuarto, mitad, check), palabra y color juntos: se leen igual en grises. Cuatro estados, solo de la materia. Colores: `--estado-*`. |
| Aviso de horario | `.gl-aviso` | Aparte de los estados. Borde y triángulo en `--estado-error`, texto en tinta, una acción. Reemplaza a las rayas rojas. |
| Anillo de avance | `.gl-anillo` | Siempre con la cifra adentro (tabular, en tinta). Riel `--borde`, arco `--marca`; completo, `--estado-ok-pleno`. |
| Tarjeta | `.gl-tarjeta` | Radio `--radio`, sin sombra. Ver [pendientes](reglas.md#pendientes): relleno o borde. |
| Contenedor | `.gl-cont` | Plata (`--sup2`); si es enlace, cielo (`--tinta-suave`) con flecha. |
| Botón | `.gl-btn`, `--sec`, `--ter`, `--c` | 44 de alto en toque; el compacto de 40 solo en escritorio con puntero. Primario sobre `--marca`. Verbos en infinitivo. |
| Enlace de acción | `.gl-enlace` | Subrayado, en `--tinta`, área de 44. |
| Campo y ayuda | `.gl-campo`, `.gl-ayuda` | Campo de 48, borde `--borde-campo`. La ayuda es un subtítulo visible y un enlace con palabras (sin «?» circular). |
| Foco | `:focus-visible` | Contorno de 2 px en tinta (`--texto`), separado 2 px. |
| Chip | `.gl-chip` | 20 de alto, radio `--radio` (no píldora). |
| Casillas y radios | ver «Casillas» en `componentes.css` | Marca visible de 20, área táctil de 44. |

## Descartado

Direcciones B a H del lienzo (tintero, grabado, ficha, medio tono, tabla de texto); el estado «Choque» (es un aviso del horario, no de la materia); tramas de rayas y barra de puntos para estados y avance; botones píldora, chips de radio 20 y switches de 16; el «?» circular; sombras duras; estados con color solo.
