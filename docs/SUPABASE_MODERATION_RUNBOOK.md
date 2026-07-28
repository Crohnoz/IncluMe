# IncluMe — procedimiento de moderación en Supabase

Este procedimiento permite operar el piloto antes de disponer de una interfaz administrativa autenticada. Debe ejecutarse únicamente desde Supabase Studio por una persona autorizada.

## Principios

- No copiar correos, nombres o teléfonos fuera del sistema.
- No publicar diagnósticos, credenciales, patentes, rostros ni acusaciones.
- No aprobar un lugar sin coordenadas comprobables.
- Registrar una nota breve y objetiva en cada decisión.
- Usar un `actor_label` reconocible, por ejemplo `enrique` o `equipo_temuko_01`.
- La disponibilidad es comunitaria y no una garantía en tiempo real.

## 1. Revisar la cola ciudadana

```sql
select *
from public.citizen_moderation_queue;
```

La vista incluye información privada para moderación y no está habilitada para usuarios públicos.

## 2. Clasificar un reporte

```sql
select public.moderate_citizen_report(
  'CIU-XXXXXXXXXXXX',
  'triaged',
  'Coordenadas y referencia revisadas inicialmente.',
  'enrique'
);
```

Estados permitidos mediante esta función:

- `pending`
- `triaged`
- `needs_clarification`
- `rejected`
- `archived`

`accepted` no se asigna manualmente: se establece al promover el reporte al catálogo.

## 3. Solicitar aclaración

```sql
select public.moderate_citizen_report(
  'CIU-XXXXXXXXXXXX',
  'needs_clarification',
  'Falta identificar el acceso exacto o confirmar las coordenadas.',
  'enrique'
);
```

La referencia pública mostrará el estado general, pero nunca expondrá la nota interna.

## 4. Publicar un estacionamiento aprobado

Antes de publicar, confirmar:

- coordenadas exactas;
- comuna y referencia;
- ruta sin escalones cuando esté informada;
- lado de transferencia;
- que las observaciones no incluyan datos personales.

```sql
select public.promote_citizen_report_to_parking(
  'CIU-XXXXXXXXXXXX',
  'right',
  'yes',
  'community_reviewed',
  'Aprobado después de revisar ubicación y condiciones observables.',
  'enrique'
);
```

Valores de transferencia:

- `unknown`
- `right`
- `left`
- `both`

Valores de ruta:

- `unknown`
- `yes`
- `no`

Niveles de confianza:

- `community_reviewed`
- `institutional`
- `field_audit`

La función:

1. crea o actualiza el registro canónico;
2. marca el reporte como `accepted`;
3. registra el evento del reporte;
4. registra el evento del catálogo.

## 5. Revisar solicitudes municipales

```sql
select *
from public.municipal_moderation_queue;
```

Actualizar una solicitud:

```sql
select public.moderate_municipal_request(
  'MUN-XXXXXXXXXXXX',
  'contacted',
  'Correo de respuesta enviado y pendiente de coordinación.',
  'enrique'
);
```

Estados permitidos:

- `new`
- `contacted`
- `meeting_scheduled`
- `pilot_scoping`
- `closed`
- `archived`

## 6. Consultar el historial

```sql
select
  entity_type,
  public_reference,
  action,
  previous_status,
  new_status,
  notes,
  actor_label,
  created_at
from public.intake_moderation_events
order by created_at desc
limit 100;
```

El historial no debe editarse manualmente.

## 7. Retirar temporalmente un lugar

Mientras exista solamente operación desde Studio:

```sql
update public.parking_locations
set is_published = false,
    moderation_status = 'archived'
where id = '<uuid-del-lugar>';
```

Después, registrar el evento manualmente o implementar una función específica antes de usar esta operación de forma habitual. La interfaz administrativa futura deberá convertir este paso en una acción auditada.

## 8. Métricas del piloto

```sql
select public.public_pilot_metrics();
```

La misma función alimenta el portal municipal y solo entrega cifras agregadas.

## 9. Comprobación pública

- Aplicación: `https://inclume-chile.netlify.app`
- Estado: `https://inclume-chile.netlify.app/estado/`
- Portal municipal: `https://inclume-municipalidades.netlify.app`

Después de cambiar un estado, consultar la referencia en `/estado/`. Después de aprobar un lugar, recargar el mapa ciudadano; la API del catálogo usa caché breve, por lo que la actualización puede tardar alrededor de un minuto.

## Pendiente operativo

Este runbook es una solución de piloto. El siguiente paso es una interfaz administrativa autenticada que use las mismas funciones SQL, conserve el historial y evite modificaciones directas de tablas.
