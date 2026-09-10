-- Ranked wins on the leaderboard and the profile: matches from the random
-- opponent queue (no invite code) that the player won. Custom and friend
-- matches carry a code and do not count.

create or replace function public.ranked_wins(in_user uuid)
returns bigint language sql stable set search_path = public as $$
  select count(*) from public.matches m where m.status = 'done' and m.code is null and m.winner = in_user;
$$;
grant execute on function public.ranked_wins(uuid) to anon, authenticated, service_role;

drop function if exists public.kings_leaderboard(double precision, double precision, double precision, integer);
create function public.kings_leaderboard(in_lat double precision default null, in_lng double precision default null, radius_m double precision default null, lim integer default 50)
returns table(user_id uuid, display_name text, avatar jsonb, thrones bigint, best_rel integer, aces bigint, ranked_wins bigint, last_win timestamptz)
language sql stable set search_path = public as $$
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
  ), w as (
    select m.winner as user_id, count(*) as ranked_wins
    from public.matches m
    where m.status = 'done' and m.code is null and m.winner in (select user_id from k)
    group by m.winner
  )
  select k.user_id, k.display_name, k.avatar, k.thrones, k.best_rel, coalesce(a.aces, 0)::bigint as aces, coalesce(w.ranked_wins, 0)::bigint as ranked_wins, k.last_win
  from k left join a on a.user_id = k.user_id left join w on w.user_id = k.user_id
  order by k.thrones desc, k.best_rel asc, aces desc, ranked_wins desc, k.last_win asc
  limit lim;
$$;
grant execute on function public.kings_leaderboard(double precision, double precision, double precision, integer) to anon, authenticated, service_role;

-- The profile carries the same number, next to the all-matches counters.
create or replace function public.player_profile(in_user uuid)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'id', p.id,
    'name', p.display_name,
    'slogan', p.slogan,
    'avatar', p.avatar,
    'since', p.created_at,
    'house_tag', case when p.house then p.house_tag else null end,
    'thrones', (select count(*) from public.thrones t where t.user_id = p.id and t.season = public.current_season()),
    'aces', (select count(*) filter (where r.location_id is null and r.score = 1)
               + coalesce(sum((select count(*) from unnest(r.hole_scores) h where h = 1)), 0)
             from public.runs r where r.user_id = p.id and r.season = public.current_season()),
    'runs', (
      (select count(*) from public.runs r where r.user_id = p.id and r.location_id is not null)
      + (select count(*) from (select r.course_seed from public.runs r where r.user_id = p.id and r.course_seed is not null group by r.course_seed having count(*) >= 9) d)
      + (select count(*) from public.matches m where m.status = 'done' and ((m.p1 = p.id and m.p1_score is not null) or (m.p2 = p.id and m.p2_score is not null)))
    ),
    'best_rel', (
      select min(x.rel) from (
        select (sum(r.score) - sum(r.par))::int as rel
          from public.runs r where r.user_id = p.id and r.course_seed is not null
          group by r.course_seed having count(*) >= 9
        union all
        select (case when m.p1 = p.id then m.p1_score else m.p2_score end)
               - (select sum(ch.par)::int from public.course_holes ch where ch.seed = m.seed and ch.hole_index < m.holes)
          from public.matches m
          where m.status = 'done' and m.holes = 9
            and ((m.p1 = p.id and m.p1_score is not null) or (m.p2 = p.id and m.p2_score is not null))
            and (select count(*) from public.course_holes ch where ch.seed = m.seed and ch.hole_index < m.holes) = m.holes
      ) x
    ),
    'matches_won', (select count(*) from public.matches m where m.winner = p.id),
    'matches', (select count(*) from public.matches m where (m.p1 = p.id or m.p2 = p.id) and m.status = 'done'),
    'ranked_wins', public.ranked_wins(p.id),
    'points', public.throne_points(p.id),
    'streak', public.challenge_streak(p.id),
    'throne_list', coalesce((
      select jsonb_agg(jsonb_build_object('location_id', t.location_id, 'name', l.name, 'poi_type', l.poi_type, 'score', t.score, 'par', t.par, 'elapsed_ms', t.elapsed_ms, 'since', t.created_at) order by t.created_at desc)
      from public.thrones t join public.locations l on l.id = t.location_id
      where t.user_id = p.id and t.season = public.current_season()), '[]'::jsonb))
  from public.profiles p where p.id = in_user;
$$;
