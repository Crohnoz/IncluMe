# Supabase — piloto público IncluMe

Esta carpeta versiona la infraestructura persistente utilizada por los sitios públicos de IncluMe.

## Proyecto desplegado

- Nombre: `inclume-chile`
- Ref: `azdrxkabzldwcmotzaor`
- Región: `sa-east-1`
- Plan confirmado al crear: `$0/mes`

No se deben incluir claves, contraseñas ni cadenas de conexión en el repositorio.

## Esquema

Las migraciones crean:

- `citizen_reports`: reportes ciudadanos privados.
- `municipal_pilot_requests`: solicitudes institucionales privadas.
- `public_submission_limits`: límites diarios mediante fingerprints irreversibles.
- `parking_locations`: catálogo aprobado y publicable.
- `intake_moderation_events`: historial inmutable de decisiones editoriales.
- vistas privadas para las colas ciudadana y municipal.
- funciones SQL para límite atómico, cambios de estado, publicación moderada, retirada auditada y métricas agregadas.

Todas las tablas tienen RLS habilitado y los roles `anon` y `authenticated` no poseen acceso directo. Las Edge Functions usan la credencial `service_role` inyectada por Supabase.

La ausencia de políticas RLS públicas es intencional: produce un estado de denegación total. La lectura o escritura ocurre únicamente mediante funciones controladas.

## Flujo de moderación

- `moderate_citizen_report`: clasifica, solicita aclaración, rechaza, archiva o reabre un reporte y crea un evento.
- `moderate_municipal_request`: actualiza una solicitud institucional y crea un evento.
- `promote_citizen_report_to_parking`: exige coordenadas, crea o actualiza el estacionamiento aprobado y registra eventos sobre el reporte y el catálogo.
- `moderate_parking_location`: publica, retira o cambia el estado del registro canónico y registra la decisión.

La firma antigua de publicación sin auditoría fue eliminada. Solo permanece la versión de seis argumentos que registra `actor_label`.

## Edge Functions

- `inclume-intake`: recibe y valida reportes y solicitudes.
- `inclume-catalog`: entrega únicamente estacionamientos aprobados y publicados.
- `inclume-status`: devuelve estado y fechas a partir de una referencia pública aleatoria.
- `inclume-metrics`: entrega métricas agregadas sin datos personales.

Cada función pública implementa controles propios de método, origen, validación y privacidad. `inclume-intake` también aplica honeypot, límite de tamaño y rate limiting diario.

## Historial del proyecto desplegado

Las migraciones del proyecto remoto fueron aplicadas mediante la integración Supabase con estas versiones:

```text
20260728020421 create_public_intake_tables
20260728020455 add_atomic_public_rate_limit
20260728022251 add_public_submission_references
20260728022637 create_persistent_parking_catalog
20260728024720 add_public_pilot_metrics
20260728030329 add_audited_intake_moderation
20260728030355 remove_legacy_unaudited_promotion_function
20260728031241 add_audited_parking_moderation
```

Los archivos locales utilizan una secuencia lógica para permitir reconstruir un proyecto nuevo. **No ejecutar `supabase db push` a ciegas sobre `azdrxkabzldwcmotzaor`**: primero comparar `supabase migration list` y reparar/alinear el historial si la CLI considera pendientes migraciones que ya existen.

## Despliegue en un proyecto nuevo

Con Supabase CLI autenticado y enlazado a un proyecto vacío:

```bash
supabase link --project-ref <project-ref>
supabase db push
supabase functions deploy inclume-intake --no-verify-jwt
supabase functions deploy inclume-catalog --no-verify-jwt
supabase functions deploy inclume-status --no-verify-jwt
supabase functions deploy inclume-metrics --no-verify-jwt
```

`--no-verify-jwt` se utiliza porque son endpoints públicos controlados por lógica propia. No debe eliminarse la lista de orígenes, la validación de payload ni las restricciones de base de datos.

## Comprobaciones realizadas

La primera transacción de prueba:

1. creó un reporte con referencia aleatoria;
2. lo cambió a `triaged`;
3. lo promovió al catálogo;
4. confirmó tres eventos de auditoría;
5. revirtió la transacción.

Una segunda transacción:

1. creó y publicó un lugar de prueba;
2. lo retiró mediante `moderate_parking_location`;
3. comprobó `archived` y `is_published=false`;
4. confirmó tres eventos auditados;
5. revirtió la transacción.

Después de ambos rollbacks quedaron cero reportes, cero estacionamientos y cero eventos de prueba. También se confirmó que no existe la firma de publicación antigua y que permanece una sola función auditada.

## Principios de datos

- No solicitar diagnósticos ni credenciales de discapacidad.
- No publicar correos, nombres, teléfonos u observaciones privadas.
- No publicar automáticamente un reporte ciudadano.
- Promover al catálogo solo después de una decisión explícita de moderación.
- Exponer públicamente solo datos aprobados o métricas agregadas.
