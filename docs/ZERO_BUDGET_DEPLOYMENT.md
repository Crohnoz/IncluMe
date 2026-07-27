# IncluMe — despliegue funcional con presupuesto $0

## Arquitectura del piloto

| Componente | Servicio | Costo inicial | Uso |
|---|---|---:|---|
| Aplicación Django | Render Web Service Free | $0 | HTML, API, moderación y PWA |
| Base de datos | Neon Free Postgres | $0 | Aportes, verificaciones, usuarios, auditoría y caché |
| Mapa base | OpenStreetMap raster | $0, best effort | Visualización interactiva normal |
| Búsqueda de destinos | Nominatim público | $0, uso limitado | Solo búsquedas enviadas expresamente |
| Navegación | Waze, Google Maps, Apple Maps | $0 para enlaces | Abrir coordenadas exactas |
| Código y CI | GitHub + Actions | $0 dentro de límites | Repositorio, PR y pruebas |

## Restricciones aceptadas

- Render Free duerme después de un periodo sin tráfico y puede tardar aproximadamente un minuto en despertar.
- El disco local de Render es efímero; no se utiliza SQLite ni se almacenan fotografías ahí.
- Render Postgres Free no se usa porque expira después de 30 días.
- Neon Free es suficiente para el piloto, pero tiene límites de almacenamiento y cómputo.
- OpenStreetMap y Nominatim son servicios comunitarios sin SLA.
- No se descargan mapas para uso offline ni se precargan zonas.
- Nominatim se utiliza con un máximo global de una petición por segundo, caché de 30 días, User-Agent identificable y sin autocompletado.
- La aplicación debe poder cambiar de proveedor mediante variables de entorno.

## 1. Crear la base gratuita en Neon

1. Crear un proyecto llamado `inclume-pilot`.
2. Elegir una región cercana a los usuarios cuando esté disponible.
3. Copiar la cadena de conexión PostgreSQL con SSL.
4. Guardarla; no publicarla en GitHub ni en capturas.

La cadena se configura en Render como `DATABASE_URL`.

## 2. Configurar Render

Crear o actualizar un Web Service gratuito conectado al repositorio IncluMe.

Variables obligatorias:

```text
DATABASE_URL=<cadena PostgreSQL de Neon>
INCLUME_ADMIN_USERNAME=<usuario de equipo>
INCLUME_ADMIN_EMAIL=<correo de recuperación>
INCLUME_ADMIN_PASSWORD=<contraseña larga y única>
```

Variables incluidas en `render.yaml`:

```text
DEBUG=false
CACHE_BACKEND=database
GEOCODING_URL=https://nominatim.openstreetmap.org/search
MAP_TILE_URL=https://tile.openstreetmap.org/{z}/{x}/{y}.png
```

El build realiza:

```text
python manage.py check --deploy
python manage.py collectstatic --noinput
python manage.py migrate
python manage.py createcachetable inclume_cache
python manage.py bootstrap_admin --require
```

`bootstrap_admin` es idempotente: crea la cuenta o restablece sus permisos y contraseña según las variables de entorno.

## 3. Corregir la rama antes del despliegue

El servicio histórico de Render apunta a una rama incorrecta. Antes de desplegar se debe decidir una sola ruta:

1. Fusionar el PR hacia la rama recuperada y configurar Render para esa rama; o
2. Reconciliar `main` con la historia recuperada mediante una migración controlada.

No se debe apuntar Render a `master`, porque esa rama no contiene la aplicación actual.

## 4. Primer acceso operativo

Después del despliegue:

1. Abrir `/health/` y confirmar `status: ok` y `database: ok`.
2. Abrir `/admin/` e iniciar sesión con las variables administrativas.
3. Abrir `/moderation/` y confirmar que la cuenta tiene acceso.
4. Crear un aporte de prueba desde el mapa avanzado.
5. Aprobarlo desde moderación.
6. Buscar un destino cercano y comprobar que aparece en el radio.
7. Abrir Waze y Google Maps desde un teléfono real.
8. Eliminar o marcar claramente el registro de prueba.

## 5. Política de búsqueda de destinos

La búsqueda pública de Nominatim solo puede ejecutarse cuando la persona presiona `Buscar destino`.

No implementar:

- autocompletado por cada tecla;
- búsquedas automáticas al mover el mapa;
- consultas periódicas;
- importaciones masivas;
- reverse geocoding en grilla;
- envío de información personal o confidencial.

La caché compartida evita repetir consultas iguales durante 30 días.

## 6. Datos reales del piloto

Comenzar con una zona pequeña, preferentemente Temuco:

- Hospital Regional;
- centros médicos;
- municipalidad;
- terminales;
- centros comerciales;
- estacionamientos de vía pública revisados presencialmente.

Cada registro debe tener como mínimo:

- coordenada exacta del espacio o acceso vehicular;
- nombre y referencia entendible;
- estado editorial aprobado;
- fecha de revisión;
- condiciones observables;
- advertencia de que la disponibilidad no es en tiempo real.

## 7. Límites para mantener costo cero

- No almacenar fotografías hasta disponer de almacenamiento externo seguro.
- No habilitar tareas periódicas ni workers.
- No usar seguimiento continuo de ubicación.
- Mantener consultas de radio con límite máximo de 10 km y 50 resultados.
- Revisar mensualmente almacenamiento, uso de Neon, horas y ancho de banda de Render.
- Mantener una exportación periódica de la base cuando el piloto empiece a contener datos valiosos.

## Fuentes operativas

- Render Free: https://render.com/docs/free
- Render Web Services: https://render.com/docs/web-services
- Neon Pricing: https://neon.com/pricing
- Nominatim Usage Policy: https://operations.osmfoundation.org/policies/nominatim/
- OSM Tile Usage Policy: https://operations.osmfoundation.org/policies/tiles/
