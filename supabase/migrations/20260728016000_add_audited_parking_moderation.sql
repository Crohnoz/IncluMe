create or replace function public.moderate_parking_location(
  p_parking_id uuid,
  p_moderation_status text,
  p_is_published boolean,
  p_notes text default null,
  p_actor_label text default 'inclume_team'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  parking public.parking_locations%rowtype;
  clean_actor text := coalesce(nullif(trim(p_actor_label), ''), 'inclume_team');
begin
  if p_moderation_status not in ('pending','approved','rejected','archived') then
    raise exception 'invalid parking moderation status';
  end if;
  if p_moderation_status <> 'approved' and p_is_published then
    raise exception 'only approved locations can be published';
  end if;

  select * into parking
  from public.parking_locations
  where id = p_parking_id
  for update;

  if not found then
    raise exception 'parking location not found';
  end if;

  update public.parking_locations
  set moderation_status = p_moderation_status,
      is_published = p_is_published
  where id = parking.id;

  insert into public.intake_moderation_events (
    entity_type,
    entity_id,
    public_reference,
    action,
    previous_status,
    new_status,
    notes,
    actor_label
  ) values (
    'parking_location',
    parking.id,
    (
      select report.public_reference
      from public.citizen_reports report
      where report.id = parking.source_report_id
    ),
    case when p_is_published then 'catalog_record_published' else 'catalog_record_unpublished' end,
    parking.moderation_status || ':' || parking.is_published::text,
    p_moderation_status || ':' || p_is_published::text,
    p_notes,
    clean_actor
  );

  return parking.id;
end;
$$;

revoke all on function public.moderate_parking_location(uuid,text,boolean,text,text) from public, anon, authenticated;
grant execute on function public.moderate_parking_location(uuid,text,boolean,text,text) to service_role;

comment on function public.moderate_parking_location(uuid,text,boolean,text,text) is 'Publica, retira o cambia el estado de un lugar y registra la decisión editorial.';
