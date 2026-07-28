create table public.moderator_api_keys (
  id uuid primary key default gen_random_uuid(),
  label text not null check (char_length(label) between 2 and 120),
  key_hash text not null unique check (key_hash ~ '^[a-f0-9]{64}$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  expires_at timestamptz
);

create index moderator_api_keys_active_hash_idx
  on public.moderator_api_keys (key_hash)
  where is_active = true;

alter table public.moderator_api_keys enable row level security;
revoke all on table public.moderator_api_keys from anon, authenticated;

comment on table public.moderator_api_keys is 'Hashes SHA-256 de claves administrativas para el centro de moderación del piloto.';

-- Las claves se aprovisionan fuera de las migraciones. Nunca versionar el valor
-- en texto claro ni su hash específico dentro del repositorio.
