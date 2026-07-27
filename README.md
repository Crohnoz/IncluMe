# IncluMe

IncluMe es una aplicación Django mobile-first para encontrar, comparar y verificar estacionamientos accesibles. La navegación se delega a Waze, Google Maps, Apple Maps u otra aplicación compatible mediante coordenadas exactas.

## Estado

El desarrollo activo se encuentra en `feature/parking-community-mvp`. Producción todavía utiliza una historia de rama distinta; revisa el PR y `docs/PRODUCT_ROADMAP.md` antes de desplegar.

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
python -m compileall .
python manage.py makemigrations --check --dry-run
python manage.py check
python manage.py test
node --check static/parking.js
```

## Variables de entorno

- `SECRET_KEY`
- `DEBUG`
- `ALLOWED_HOSTS`
- `CSRF_TRUSTED_ORIGINS`
- `DATABASE_URL`
- `MAP_TILE_URL` opcional
- `MAP_TILE_ATTRIBUTION` opcional

## Guía para agentes

Lee `AGENTS.md` y `.agents/skills/inclume-product-engineering/SKILL.md` antes de realizar cambios.
