# IncluMe — acceso y rotación del centro de moderación

El centro interno se publica en:

```text
https://inclume-municipalidades.netlify.app/equipo/
```

La página es estática, tiene `noindex` y no contiene credenciales. El acceso real se valida en `inclume-admin` contra un hash SHA-256 privado almacenado en Supabase.

## Almacenamiento en el navegador

- La clave se guarda únicamente en `sessionStorage`.
- Se elimina al cerrar sesión o cerrar la pestaña.
- No se utiliza `localStorage`, cookies ni parámetros de URL.
- Cada request envía `Authorization: Bearer <clave>` solamente al dominio Supabase del proyecto.

## Aprovisionar una clave nueva

Generar localmente una clave aleatoria de al menos 32 bytes. Ejemplo:

```bash
python - <<'PY'
import hashlib
import secrets

key = "IM-" + secrets.token_urlsafe(32)
print("CLAVE:", key)
print("HASH:", hashlib.sha256(key.encode()).hexdigest())
PY
```

Guardar solamente el hash:

```sql
insert into public.moderator_api_keys (label, key_hash)
values ('nombre-del-moderador', '<sha256-hex>');
```

Entregar el texto claro una sola vez mediante un canal privado. No copiarlo en issues, commits, capturas públicas ni documentación.

## Revisar accesos

```sql
select id, label, is_active, created_at, last_used_at, expires_at
from public.moderator_api_keys
order by created_at desc;
```

`last_used_at` se actualiza cuando `inclume-admin` acepta una clave.

## Revocar inmediatamente

```sql
update public.moderator_api_keys
set is_active = false
where label = 'nombre-del-moderador';
```

La siguiente solicitud será rechazada con HTTP 401.

## Rotar una clave

1. Crear y probar la clave nueva.
2. Confirmar que `last_used_at` se actualice.
3. Revocar la clave antigua.
4. Cerrar las sesiones abiertas en los navegadores.

No reemplazar el hash de la clave antigua antes de probar la nueva; eso podría dejar al equipo sin acceso.

## Alcance del centro

La API permite:

- revisar colas ciudadanas e institucionales;
- cambiar estados mediante funciones SQL auditadas;
- aprobar un reporte y publicarlo en el catálogo;
- retirar o volver a publicar ubicaciones;
- revisar eventos de auditoría;
- consultar métricas agregadas.

No permite escribir directamente en las tablas desde el navegador. El rol `anon` no tiene acceso y la credencial `service_role` nunca sale de Supabase.

## Respuesta ante exposición

1. Revocar la clave afectada.
2. Crear una clave nueva.
3. Revisar `last_used_at` y `intake_moderation_events`.
4. Comprobar cambios recientes en `parking_locations` y estados de solicitudes.
5. Documentar el incidente sin volver a publicar la clave.
