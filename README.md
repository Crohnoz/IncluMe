# IncluMe

IncluMe es una aplicación Django mobile-first para encontrar, comparar y verificar estacionamientos accesibles. La navegación se delega a Waze, Google Maps, Apple Maps u otra aplicación compatible mediante coordenadas exactas.

## Estado

El desarrollo activo se encuentra en `feature/parking-community-mvp` y se revisa mediante el PR #2. Producción todavía utiliza una historia de rama distinta; revisa el PR y `docs/PRODUCT_ROADMAP.md` antes de desplegar.

La versión actual incluye:

- búsqueda, geolocalización explícita y preferencias funcionales;
- lista accesible equivalente al mapa;
- mejor opción y Plan B;
- navegación externa por coordenadas;
- aportes comunitarios retenidos para moderación;
- verificaciones positivas separadas de incidencias recientes;
- prevención temporal de verificaciones repetidas sin almacenar IP;
- detección de posibles estacionamientos duplicados por proximidad;
- lugares guardados y enlaces compartibles en el dispositivo;
- borradores de aportes y verificaciones pendientes cuando falla la conexión;
- caché local de la última lista disponible y base PWA instalable;
- health check de aplicación y base de datos.

## Desarrollo local

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export DEBUG=true
export SECRET_KEY=development-secret
python manage.py migrate
python manage.py runserver
```

En Windows PowerShell:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:DEBUG="true"
$env:SECRET_KEY="development-secret"
python manage.py migrate
python manage.py runserver
```

## Verificación

```bash
python -m compileall -q .
python manage.py makemigrations --check --dry-run
python manage.py check
python manage.py test
node --check static/parking.js
node --check static/parking-resilience.js
node --check static/service-worker.js
python -m json.tool static/manifest.webmanifest > /dev/null
```

## Endpoints operativos

- `GET /health/`: readiness de Django y conexión de base de datos.
- `GET /api/parkings/`: datos públicos de lugares publicados.
- `POST /api/parkings/submit/`: aporte nuevo bajo moderación.
- `POST /api/parkings/<id>/verify/`: confirmación o incidencia comunitaria.
- `GET /service-worker.js`: service worker con alcance global.

## Variables de entorno

- `SECRET_KEY`
- `DEBUG`
- `ALLOWED_HOSTS`
- `CSRF_TRUSTED_ORIGINS`
- `DATABASE_URL`
- `SECURE_HSTS_SECONDS`
- `SECURE_HSTS_INCLUDE_SUBDOMAINS` opcional
- `SECURE_HSTS_PRELOAD` opcional
- `MAP_TILE_URL` opcional
- `MAP_TILE_ATTRIBUTION` opcional

## Límites actuales

- La disponibilidad es comunitaria, no tiempo real.
- El modo offline conserva datos y encola verificaciones, pero no descarga tiles del mapa de forma masiva.
- Las fotografías todavía requieren almacenamiento y moderación seguros.
- La búsqueda por dirección aún no utiliza geocodificación externa.
- La detección de duplicados usa proximidad geográfica sin PostGIS durante el piloto.

## Guía para agentes

Lee `AGENTS.md` y `.agents/skills/inclume-product-engineering/SKILL.md` antes de realizar cambios.
