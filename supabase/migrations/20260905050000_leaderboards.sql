-- Leaderboards: kings (thrones held this season, optionally near a point)
-- and the best round per player at one bathroom.
create or replace function public.kings_leaderboard(in_lat double precision default null, in_lng double precision default null, radius_m double precision default null, lim integer default 50)
returns table(user_id uuid, display_name text, thrones bigint, best_rel integer, last_win timestamptz)
language sql stable
set search_path = public
as $$
  select t.user_id, t.display_name, count(*) as thrones, min(t.score - t.par)::int as best_rel, max(t.created_at) as last_win
  from public.thrones t
  join public.locations l on l.id = t.location_id
  where t.season = public.current_season()
    and (in_lat is null or in_lng is null or radius_m is null
         or st_dwithin(l.geog, st_setsrid(st_makepoint(in_lng, in_lat), 4326)::geography, radius_m))
  group by t.user_id, t.display_name
  order by thrones desc, best_rel asc, last_win asc
  limit lim;
$$;
grant execute on function public.kings_leaderboard(double precision, double precision, double precision, integer) to anon, authenticated, service_role;

create or replace function public.location_leaderboard(in_location text, lim integer default 20)
returns table(rank bigint, user_id uuid, display_name text, score integer, par integer, hole_scores integer[], elapsed_ms integer, played_at timestamptz)
language sql stable
set search_path = public
as $$
  with best as (
    select distinct on (r.user_id) r.user_id, r.score, r.par, r.hole_scores, r.elapsed_ms, r.created_at
    from public.runs r
    where r.location_id = in_location and r.season = public.current_season() and r.hole_scores is not null
    order by r.user_id, r.score, coalesce(r.elapsed_ms, 2147483647), r.created_at
  )
  select row_number() over (order by b.score, coalesce(b.elapsed_ms, 2147483647), b.created_at) as rank,
    b.user_id, p.display_name, b.score, b.par, b.hole_scores, b.elapsed_ms, b.created_at
  from best b join public.profiles p on p.id = b.user_id
  order by rank
  limit lim;
$$;
grant execute on function public.location_leaderboard(text, integer) to anon, authenticated, service_role;
