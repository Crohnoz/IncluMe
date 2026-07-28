# Supabase — piloto público IncluMe

Esta carpeta versiona la infraestructura persistente utilizada por los sitios públicos de IncluMe.

## Proyecto desplegado

- Nombre: `inclume-chile`
- Ref: `azdrxkabzldwcmotzaor`
- Región: `sa-east-1`
- Plan confirmado al crear: `$0/mes`

No se deben incluir claves, contraseñas ni cadenas de conexión en el repositorio.

## Migraciones

Las migraciones crean:

- `citizen_reports`: reportes ciudadanos privados.
- `municipal_pilot_requests`: solicitudes institucionales privadas.
- `public_submission_limits`: límites diarios mediante fingerprints irreversibles.
- `parking_locations`: catálogo aprobado y publicable.
- funciones SQL para límite atómico, promoción moderada y métricas agregadas.

Todas las tablas tienen RLS habilitado y los roles `anon` y `authenticated` no poseen acceso directo. Las Edge Functions usan la credencial `service_role` inyectada por Supabase.

## Edge Functions

- `inclume-intake`: recibe y valida reportes y solicitudes.
- `inclume-catalog`: entrega únicamente estacionamientos aprobados y publicados.
- `inclume-status`: devuelve estado y fechas a partir de una referencia pública aleatoria.
- `inclume-metrics`: entrega métricas agregadas sin datos personales.

Cada función pública implementa controles propios de método, origen, validación y privacidad. `inclume-intake` también aplica honeypot, límite de tamaño y rate limiting diario.

## Despliegue

Con Supabase CLI autenticado y enlazado al proyecto:

```bash
supabase link --project-ref azdrxkabzldwcmotzaor
supabase db push
supabase functions deploy inclume-intake --no-verify-jwt
supabase functions deploy inclume-catalog --no-verify-jwt
supabase functions deploy inclume-status --no-verify-jwt
supabase functions deploy inclume-metrics --no-verify-jwt
```

`--no-verify-jwt` se utiliza porque son endpoints públicos controlados por lógica propia. No debe eliminarse la lista de orígenes, la validación de payload ni las políticas de base de datos.

## Principios de datos

- No solicitar diagnósticos ni credenciales de discapacidad.
- No publicar correos, nombres, teléfonos u observaciones privadas.
- No publicar automáticamente un reporte ciudadano.
- Promover al catálogo solo después de una decisión explícita de moderación.
- Exponer públicamente solo datos aprobados o métricas agregadas.
