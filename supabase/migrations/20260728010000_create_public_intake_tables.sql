create extension if not exists pgcrypto;

create table public.citizen_reports (
  id uuid primary key default gen_random_uuid(),
  report_type text not null check (report_type in (
    'nuevo_estacionamiento',
    'informacion_incorrecta',
    'acceso_bloqueado',
    'senalizacion_ausente',
    'ruta_con_barrera',
    'otro_cambio_observable'
  )),
  commune text not null check (char_length(commune) between 2 and 80),
  place_name text not null check (char_length(place_name) between 2 and 140),
  exact_reference text not null check (char_length(exact_reference) between 2 and 220),
  latitude numeric(9,6) check (latitude is null or latitude between -58 and -15),
  longitude numeric(9,6) check (longitude is null or longitude between -112 and -64),
  observation text not null check (char_length(observation) between 10 and 1200),
  contact_email text check (contact_email is null or char_length(contact_email) <= 180),
  good_faith_confirmed boolean not null default false check (good_faith_confirmed),
  status text not null default 'pending' check (status in ('pending','triaged','accepted','needs_clarification','rejected','archived')),
  source text not null default 'inclume_chile_web',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  moderator_notes text
);

create index citizen_reports_status_created_idx on public.citizen_reports (status, created_at desc);
create index citizen_reports_commune_idx on public.citizen_reports (lower(commune));

create table public.municipal_pilot_requests (
  id uuid primary key default gen_random_uuid(),
  institution text not null check (char_length(institution) between 2 and 160),
  territory text not null check (char_length(territory) between 2 and 100),
  contact_name text not null check (char_length(contact_name) between 2 and 120),
  contact_role text not null check (char_length(contact_role) between 2 and 140),
  institutional_email text not null check (char_length(institutional_email) <= 180),
  phone text check (phone is null or char_length(phone) <= 40),
  objective text not null check (objective in (
    'catastro_estacionamientos',
    'validacion_ciudadana',
    'rutas_entradas',
    'panel_exportacion',
    'otro_piloto'
  )),
  problem_description text not null check (char_length(problem_description) between 20 and 1800),
  consent_confirmed boolean not null default false check (consent_confirmed),
  status text not null default 'new' check (status in ('new','contacted','meeting_scheduled','pilot_scoping','closed','archived')),
  source text not null default 'inclume_municipal_web',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  internal_notes text
);

create index municipal_requests_status_created_idx on public.municipal_pilot_requests (status, created_at desc);
create index municipal_requests_territory_idx on public.municipal_pilot_requests (lower(territory));

create table public.public_submission_limits (
  fingerprint text not null,
  submission_kind text not null check (submission_kind in ('citizen_report','municipal_request')),
  window_date date not null default current_date,
  submission_count integer not null default 1 check (submission_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (fingerprint, submission_kind, window_date)
);

alter table public.citizen_reports enable row level security;
alter table public.municipal_pilot_requests enable row level security;
alter table public.public_submission_limits enable row level security;

revoke all on table public.citizen_reports from anon, authenticated;
revoke all on table public.municipal_pilot_requests from anon, authenticated;
revoke all on table public.public_submission_limits from anon, authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger citizen_reports_set_updated_at
before update on public.citizen_reports
for each row execute function public.set_updated_at();

create trigger municipal_requests_set_updated_at
before update on public.municipal_pilot_requests
for each row execute function public.set_updated_at();

comment on table public.citizen_reports is 'Reportes ciudadanos observables, sin datos clínicos ni credenciales.';
comment on table public.municipal_pilot_requests is 'Solicitudes institucionales para evaluar pilotos territoriales de IncluMe.';
comment on table public.public_submission_limits is 'Contadores diarios con fingerprints irreversibles para limitar abuso sin almacenar IP en texto claro.';
