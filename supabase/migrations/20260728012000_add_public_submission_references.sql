alter table public.citizen_reports
  add column public_reference text not null default ('CIU-' || upper(encode(gen_random_bytes(6), 'hex')));

alter table public.municipal_pilot_requests
  add column public_reference text not null default ('MUN-' || upper(encode(gen_random_bytes(6), 'hex')));

create unique index citizen_reports_public_reference_uidx
  on public.citizen_reports (public_reference);

create unique index municipal_requests_public_reference_uidx
  on public.municipal_pilot_requests (public_reference);

comment on column public.citizen_reports.public_reference is 'Referencia aleatoria para consultar estado sin exponer contenido ni identidad.';
comment on column public.municipal_pilot_requests.public_reference is 'Referencia aleatoria para consultar estado de la solicitud institucional.';
