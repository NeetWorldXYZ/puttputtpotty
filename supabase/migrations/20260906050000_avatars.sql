-- Player avatars (porcelain, seat, hat, face, ball) on profiles, carried by
-- every read that shows a name.
alter table public.profiles add column if not exists avatar jsonb;

drop view if exists public.thrones;
create view public.thrones with (security_invoker = on) as
  select distinct on (r.location_id, r.season)
    r.location_id, r.season, r.user_id, p.display_name, p.avatar, r.score, r.par, r.hole_scores, r.elapsed_ms, r.created_at
  from public.runs r
  join public.profiles p on p.id = r.user_id
  where r.location_id is not null and r.hole_scores is not null
  order by r.location_id, r.season, r.score, coalesce(r.elapsed_ms, 2147483647), r.created_at;

drop function if exists public.nearby_locations(double precision, double precision, double precision);
create function public.nearby_locations(in_lat double precision, in_lng double precision, radius_m double precision default 2000)
returns table(
  id text, name text, poi_type text, lat double precision, lng double precision, theme text, difficulty text,
  hole_par integer, par integer, distance_m double precision,
  king_name text, king_score integer, king_user uuid, king_since timestamptz, king_holes integer[], king_elapsed_ms integer, king_avatar jsonb, run_count bigint)
language sql stable
set search_path = public
as $$
  select l.id, l.name, l.poi_type, l.lat, l.lng, l.theme, l.difficulty, l.hole_par, l.par,
    st_distance(l.geog, st_setsrid(st_makepoint(in_lng, in_lat), 4326)::geography) as distance_m,
    t.display_name as king_name, t.score as king_score, t.user_id as king_user, t.created_at as king_since, t.hole_scores as king_holes, t.elapsed_ms as king_elapsed_ms, t.avatar as king_avatar,
    (select count(*) from public.runs r where r.location_id = l.id and r.season = public.current_season()) as run_count
  from public.locations l
  left join public.thrones t on t.location_id = l.id and t.season = public.current_season()
  where st_dwithin(l.geog, st_setsrid(st_makepoint(in_lng, in_lat), 4326)::geography, radius_m)
  order by distance_m
  limit 200;
$$;
grant execute on function public.nearby_locations(double precision, double precision, double precision) to anon, authenticated, service_role;

drop function if exists public.kings_leaderboard(double precision, double precision, double precision, integer);
create function public.kings_leaderboard(in_lat double precision default null, in_lng double precision default null, radius_m double precision default null, lim integer default 50)
returns table(user_id uuid, display_name text, avatar jsonb, thrones bigint, best_rel integer, aces bigint, last_win timestamptz)
language sql stable
set search_path = public
as $$
  with k as (
    select t.user_id, t.display_name, t.avatar, count(*) as thrones, min(t.score - t.par)::int as best_rel, max(t.created_at) as last_win
    from public.thrones t
    join public.locations l on l.id = t.location_id
    where t.season = public.current_season()
      and (in_lat is null or in_lng is null or radius_m is null
           or st_dwithin(l.geog, st_setsrid(st_makepoint(in_lng, in_lat), 4326)::geography, radius_m))
    group by t.user_id, t.display_name, t.avatar
  ), a as (
    select r.user_id,
      count(*) filter (where r.location_id is null and r.score = 1)
      + coalesce(sum((select count(*) from unnest(r.hole_scores) h where h = 1)), 0) as aces
    from public.runs r
    where r.season = public.current_season() and r.user_id in (select user_id from k)
    group by r.user_id
  )
  select k.user_id, k.display_name, k.avatar, k.thrones, k.best_rel, coalesce(a.aces, 0)::bigint as aces, k.last_win
  from k left join a on a.user_id = k.user_id
  order by k.thrones desc, k.best_rel asc, aces desc, k.last_win asc
  limit lim;
$$;
grant execute on function public.kings_leaderboard(double precision, double precision, double precision, integer) to anon, authenticated, service_role;

drop function if exists public.course_leaderboard(text, integer);
create function public.course_leaderboard(in_seed text, lim integer default 20)
returns table(user_id uuid, display_name text, avatar jsonb, total integer, holes bigint, elapsed_ms bigint, finished_at timestamptz)
language sql stable
set search_path = public
as $$
  select r.user_id, p.display_name, p.avatar, sum(r.score)::int as total, count(*) as holes,
    sum(coalesce(r.elapsed_ms, 0))::bigint as elapsed_ms, max(r.created_at) as finished_at
  from public.runs r join public.profiles p on p.id = r.user_id
  where r.course_seed = in_seed
  group by r.user_id, p.display_name, p.avatar
  having count(*) >= 9
  order by total asc, elapsed_ms asc, finished_at asc
  limit lim;
$$;
grant execute on function public.course_leaderboard(text, integer) to anon, authenticated, service_role;

drop function if exists public.location_leaderboard(text, integer);
create function public.location_leaderboard(in_location text, lim integer default 20)
returns table(rank bigint, user_id uuid, display_name text, avatar jsonb, score integer, par integer, hole_scores integer[], elapsed_ms integer, played_at timestamptz)
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
    b.user_id, p.display_name, p.avatar, b.score, b.par, b.hole_scores, b.elapsed_ms, b.created_at
  from best b join public.profiles p on p.id = b.user_id
  order by rank
  limit lim;
$$;
grant execute on function public.location_leaderboard(text, integer) to anon, authenticated, service_role;

drop function if exists public.match_state(uuid);
create function public.match_state(in_id uuid)
returns table(id uuid, seed text, code text, status text, holes integer, p1 uuid, p2 uuid, p1_name text, p2_name text, p1_avatar jsonb, p2_avatar jsonb,
  p1_score integer, p1_holes integer[], p1_elapsed_ms integer, p2_score integer, p2_holes integer[], p2_elapsed_ms integer, winner uuid, forfeit boolean, started_at timestamptz, finished_at timestamptz)
language plpgsql security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  m public.matches;
begin
  select * into m from public.matches where matches.id = in_id;
  if not found or (m.p1 <> me and m.p2 is distinct from me) then raise exception 'no such match'; end if;
  if m.status = 'playing' and m.started_at < now() - (interval '10 minutes') * (m.holes / 3.0) and ((m.p1_score is not null) <> (m.p2_score is not null)) then
    update public.matches set status = 'done', forfeit = true, finished_at = now(),
      winner = case when p1_score is not null then p1 else p2 end
      where matches.id = in_id returning * into m;
  end if;
  return query select m.id, m.seed, m.code, m.status, m.holes, m.p1, m.p2,
    (select display_name from public.profiles where profiles.id = m.p1), (select display_name from public.profiles where profiles.id = m.p2),
    (select avatar from public.profiles where profiles.id = m.p1), (select avatar from public.profiles where profiles.id = m.p2),
    m.p1_score, m.p1_holes, m.p1_elapsed_ms, m.p2_score, m.p2_holes, m.p2_elapsed_ms, m.winner, m.forfeit, m.started_at, m.finished_at;
end;
$$;
grant execute on function public.match_state(uuid) to authenticated, service_role;
