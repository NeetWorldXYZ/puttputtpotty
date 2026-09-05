-- Ties on total strokes are broken by the time the round took: the server
-- records the start (start action) and the submission, so the phone cannot
-- report a time of its own.
alter table public.checkins add column if not exists started_at timestamptz;
alter table public.runs add column if not exists elapsed_ms integer;

drop view if exists public.thrones;
create view public.thrones with (security_invoker = on) as
  select distinct on (r.location_id, r.season)
    r.location_id, r.season, r.user_id, p.display_name, r.score, r.par, r.hole_scores, r.elapsed_ms, r.created_at
  from public.runs r
  join public.profiles p on p.id = r.user_id
  where r.location_id is not null and r.hole_scores is not null
  order by r.location_id, r.season, r.score, coalesce(r.elapsed_ms, 2147483647), r.created_at;

drop function if exists public.nearby_locations(double precision, double precision, double precision);
create function public.nearby_locations(in_lat double precision, in_lng double precision, radius_m double precision default 2000)
returns table(
  id text, name text, poi_type text, lat double precision, lng double precision, theme text, difficulty text,
  hole_par integer, par integer, distance_m double precision,
  king_name text, king_score integer, king_user uuid, king_since timestamptz, king_holes integer[], king_elapsed_ms integer, run_count bigint)
language sql stable
set search_path = public
as $$
  select l.id, l.name, l.poi_type, l.lat, l.lng, l.theme, l.difficulty, l.hole_par, l.par,
    st_distance(l.geog, st_setsrid(st_makepoint(in_lng, in_lat), 4326)::geography) as distance_m,
    t.display_name as king_name, t.score as king_score, t.user_id as king_user, t.created_at as king_since, t.hole_scores as king_holes, t.elapsed_ms as king_elapsed_ms,
    (select count(*) from public.runs r where r.location_id = l.id and r.season = public.current_season()) as run_count
  from public.locations l
  left join public.thrones t on t.location_id = l.id and t.season = public.current_season()
  where st_dwithin(l.geog, st_setsrid(st_makepoint(in_lng, in_lat), 4326)::geography, radius_m)
  order by distance_m
  limit 200;
$$;
grant execute on function public.nearby_locations(double precision, double precision, double precision) to anon, authenticated, service_role;
