create or replace function public.public_pilot_metrics()
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select jsonb_build_object(
    'publishedLocations', (
      select count(*) from public.parking_locations
      where moderation_status = 'approved' and is_published = true
    ),
    'citizenReportsReceived', (
      select count(*) from public.citizen_reports
    ),
    'citizenReportsInReview', (
      select count(*) from public.citizen_reports
      where status in ('pending', 'triaged', 'needs_clarification')
    ),
    'citizenReportsAccepted', (
      select count(*) from public.citizen_reports
      where status = 'accepted'
    ),
    'communesReported', (
      select count(distinct lower(trim(commune))) from public.citizen_reports
    ),
    'lastActivityAt', greatest(
      coalesce((select max(updated_at) from public.parking_locations), '-infinity'::timestamptz),
      coalesce((select max(updated_at) from public.citizen_reports), '-infinity'::timestamptz)
    )
  );
$$;

revoke all on function public.public_pilot_metrics() from public, anon, authenticated;
grant execute on function public.public_pilot_metrics() to service_role;

comment on function public.public_pilot_metrics() is 'Métricas agregadas del piloto sin personas, contactos, coordenadas ni observaciones.';
