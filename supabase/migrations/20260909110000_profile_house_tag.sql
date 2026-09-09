-- The house account's tag on its profile card.
-- (Rounds played and best round as before: A round is a throne run,
-- a finished daily course, or a finished match (quick, bot or friend), one
-- each; practice and custom rounds never reach the server, so they never
-- counted. Best round is the best score to par over nine holes: daily
-- courses and nine-hole matches. (Daily holes are stored one row each, which
-- is why the old count ran to 73.)
create or replace function public.player_profile(in_user uuid)
returns jsonb
language sql stable
set search_path = public
as $$
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
    'points', (select coalesce(sum(c.points), 0) from public.challenge_claims c where c.user_id = p.id),
    'streak', public.challenge_streak(p.id),
    'throne_list', coalesce((
      select jsonb_agg(jsonb_build_object('location_id', t.location_id, 'name', l.name, 'poi_type', l.poi_type, 'score', t.score, 'par', t.par, 'elapsed_ms', t.elapsed_ms, 'since', t.created_at) order by t.created_at desc)
      from public.thrones t join public.locations l on l.id = t.location_id
      where t.user_id = p.id and t.season = public.current_season()), '[]'::jsonb))
  from public.profiles p where p.id = in_user;
$$;
grant execute on function public.player_profile(uuid) to anon, authenticated, service_role;
