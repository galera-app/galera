# Galera

Gestor público y gratuito para estudiantes de Edición (FFyL, UBA): plan con notas, mesas, calendario, resúmenes, simuladores y horarios. https://galera.com.ar

Sitio estático, sin build. Lo personal queda en el navegador de cada persona.

## Cómo se publica

1. **PR**: corre el CI y Cloudflare arma una vista previa propia.
2. **Merge a `main`**: sale a `prueba.galera.com.ar` y queda esperando aprobación.
3. **Aprobar en Actions → Publicar** (entorno `produccion`): sale a `galera.com.ar`. El tag `produccion` marca el último código aprobado.

Los datos de la Facultad (`datos.yml`) salen solos a producción sobre ese tag, sin arrastrar pantallas sin aprobar. El sitio de prueba no indexa ni escribe en el buzón, el arcade o Analytics (`_headers`).
