-- One verified result per server-issued round clock, including concurrent retries.
alter table public.runs add column round_started_at timestamptz;
create unique index runs_throne_round_key on public.runs(user_id, location_id, round_started_at)
  where round_started_at is not null;

create function public.save_throne_round(p_run jsonb, p_started_at timestamptz)
returns public.runs language plpgsql security invoker set search_path = '' as $$
declare
  v_user uuid := (p_run->>'user_id')::uuid;
  v_location text := p_run->>'location_id';
  v_clock timestamptz;
  v_saved public.runs;
begin
  -- Serialize submissions against the check-in, not just the HTTP request.
  select started_at into v_clock from public.checkins
    where user_id = v_user and location_id = v_location for update;
  select * into v_saved from public.runs where user_id = v_user
    and location_id = v_location and round_started_at = p_started_at;
  if found then return v_saved; end if;
  if p_started_at is null or v_clock is distinct from p_started_at then
    raise exception 'Round is no longer active';
  end if;
  if p_started_at > now() or p_started_at < now() - interval '45 minutes' then
    raise exception 'Round expired';
  end if;
  insert into public.runs(user_id, location_id, hole_index, strokes, hole_scores,
    elapsed_ms, score, par, season, lat, lng, accuracy, round_started_at)
  values(v_user, v_location, 0, p_run->'strokes',
    array(select jsonb_array_elements_text(p_run->'hole_scores')::integer),
    (p_run->>'elapsed_ms')::integer, (p_run->>'score')::integer,
    (p_run->>'par')::integer, (p_run->>'season')::integer,
    (p_run->>'lat')::double precision, (p_run->>'lng')::double precision,
    (p_run->>'accuracy')::double precision, p_started_at)
  returning * into v_saved;
  update public.checkins set started_at = null
    where user_id = v_user and location_id = v_location;
  return v_saved;
end;
$$;
-- Only the authenticated Edge Function may save a server-replayed result.
revoke all on function public.save_throne_round(jsonb,timestamptz) from public, anon, authenticated;
grant execute on function public.save_throne_round(jsonb,timestamptz) to service_role;
