create table public.parking_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 140),
  location_reference text not null check (char_length(location_reference) between 2 and 220),
  commune text not null check (char_length(commune) between 2 and 80),
  latitude numeric(9,6) not null check (latitude between -58 and -15),
  longitude numeric(9,6) not null check (longitude between -112 and -64),
  transfer_side text not null default 'unknown' check (transfer_side in ('unknown','right','left','both')),
  step_free text not null default 'unknown' check (step_free in ('unknown','yes','no')),
  notes text not null default '' check (char_length(notes) <= 1200),
  confidence_label text not null default 'community_reviewed' check (confidence_label in ('community_reviewed','institutional','field_audit')),
  moderation_status text not null default 'approved' check (moderation_status in ('pending','approved','rejected','archived')),
  is_published boolean not null default true,
  source_report_id uuid unique references public.citizen_reports(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index parking_locations_public_geo_idx
  on public.parking_locations (is_published, moderation_status, latitude, longitude);
create index parking_locations_commune_idx
  on public.parking_locations (lower(commune));

alter table public.parking_locations enable row level security;
revoke all on table public.parking_locations from anon, authenticated;

create trigger parking_locations_set_updated_at
before update on public.parking_locations
for each row execute function public.set_updated_at();

create or replace function public.promote_citizen_report_to_parking(
  p_public_reference text,
  p_transfer_side text default 'unknown',
  p_step_free text default 'unknown',
  p_confidence_label text default 'community_reviewed',
  p_moderator_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  report public.citizen_reports%rowtype;
  parking_id uuid;
begin
  if p_transfer_side not in ('unknown','right','left','both') then
    raise exception 'invalid transfer side';
  end if;
  if p_step_free not in ('unknown','yes','no') then
    raise exception 'invalid step free value';
  end if;
  if p_confidence_label not in ('community_reviewed','institutional','field_audit') then
    raise exception 'invalid confidence label';
  end if;

  select * into report
  from public.citizen_reports
  where public_reference = upper(trim(p_public_reference))
  for update;

  if not found then
    raise exception 'report not found';
  end if;
  if report.latitude is null or report.longitude is null then
    raise exception 'report requires coordinates before publication';
  end if;

  insert into public.parking_locations (
    name,
    location_reference,
    commune,
    latitude,
    longitude,
    transfer_side,
    step_free,
    notes,
    confidence_label,
    moderation_status,
    is_published,
    source_report_id
  ) values (
    report.place_name,
    report.exact_reference,
    report.commune,
    report.latitude,
    report.longitude,
    p_transfer_side,
    p_step_free,
    report.observation,
    p_confidence_label,
    'approved',
    true,
    report.id
  )
  on conflict (source_report_id)
  do update set
    name = excluded.name,
    location_reference = excluded.location_reference,
    commune = excluded.commune,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    transfer_side = excluded.transfer_side,
    step_free = excluded.step_free,
    notes = excluded.notes,
    confidence_label = excluded.confidence_label,
    moderation_status = 'approved',
    is_published = true,
    updated_at = now()
  returning id into parking_id;

  update public.citizen_reports
  set status = 'accepted',
      reviewed_at = now(),
      moderator_notes = p_moderator_notes
  where id = report.id;

  return parking_id;
end;
$$;

revoke all on function public.promote_citizen_report_to_parking(text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.promote_citizen_report_to_parking(text,text,text,text,text) to service_role;

comment on table public.parking_locations is 'Catálogo persistente de estacionamientos aprobados para publicación.';
comment on function public.promote_citizen_report_to_parking(text,text,text,text,text) is 'Promueve de forma auditada un reporte ciudadano con coordenadas al catálogo publicado.';
