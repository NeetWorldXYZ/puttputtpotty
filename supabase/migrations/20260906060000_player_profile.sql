-- One read for a player's public profile page: identity, season stats and thrones held.
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
    'thrones', (select count(*) from public.thrones t where t.user_id = p.id and t.season = public.current_season()),
    'aces', (select count(*) filter (where r.location_id is null and r.score = 1)
               + coalesce(sum((select count(*) from unnest(r.hole_scores) h where h = 1)), 0)
             from public.runs r where r.user_id = p.id and r.season = public.current_season()),
    'runs', (select count(*) from public.runs r where r.user_id = p.id),
    'best_rel', (select min(r.score - r.par) from public.runs r where r.user_id = p.id and r.hole_scores is not null),
    'matches_won', (select count(*) from public.matches m where m.winner = p.id),
    'matches', (select count(*) from public.matches m where (m.p1 = p.id or m.p2 = p.id) and m.status = 'done'),
    'throne_list', coalesce((
      select jsonb_agg(jsonb_build_object('location_id', t.location_id, 'name', l.name, 'poi_type', l.poi_type, 'score', t.score, 'par', t.par, 'elapsed_ms', t.elapsed_ms, 'since', t.created_at) order by t.created_at desc)
      from public.thrones t join public.locations l on l.id = t.location_id
      where t.user_id = p.id and t.season = public.current_season()), '[]'::jsonb))
  from public.profiles p where p.id = in_user;
$$;
grant execute on function public.player_profile(uuid) to anon, authenticated, service_role;
