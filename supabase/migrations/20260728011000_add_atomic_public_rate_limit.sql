create or replace function public.consume_public_submission_slot(
  p_fingerprint text,
  p_submission_kind text,
  p_daily_limit integer default 8
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  next_count integer;
begin
  if p_submission_kind not in ('citizen_report','municipal_request') then
    raise exception 'invalid submission kind';
  end if;
  if p_daily_limit < 1 or p_daily_limit > 100 then
    raise exception 'invalid daily limit';
  end if;

  insert into public.public_submission_limits (
    fingerprint,
    submission_kind,
    window_date,
    submission_count,
    updated_at
  ) values (
    p_fingerprint,
    p_submission_kind,
    current_date,
    1,
    now()
  )
  on conflict (fingerprint, submission_kind, window_date)
  do update set
    submission_count = public.public_submission_limits.submission_count + 1,
    updated_at = now()
  returning submission_count into next_count;

  return next_count <= p_daily_limit;
end;
$$;

revoke all on function public.consume_public_submission_slot(text,text,integer) from public, anon, authenticated;
grant execute on function public.consume_public_submission_slot(text,text,integer) to service_role;

comment on function public.consume_public_submission_slot(text,text,integer) is 'Consume un cupo diario por fingerprint irreversible y tipo de envío.';
