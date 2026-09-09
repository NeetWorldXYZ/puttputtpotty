-- Daily and weekly challenges, computed from what players already do (rounds,
-- thrones, matches, check-ins, finds). Three of each rotate on the period key.
-- Finishing one awards royal points; claims are recorded so points are paid once.
-- Days and weeks follow the daily course's clock (Eastern); weeks start Monday.

create table if not exists public.challenge_claims (
  user_id uuid not null references auth.users(id) on delete cascade,
  period text not null,
  key text not null,
  points integer not null,
  claimed_at timestamptz not null default now(),
  primary key (user_id, period, key)
);
alter table public.challenge_claims enable row level security;
drop policy if exists "own claims" on public.challenge_claims;
create policy "own claims" on public.challenge_claims for select to authenticated using (user_id = auth.uid());
grant select on public.challenge_claims to authenticated;

create or replace function public.challenge_periods()
returns table (day_key text, day_start timestamptz, day_end timestamptz, week_key text, week_start timestamptz, week_end timestamptz)
language sql stable
set search_path = public
as $$
  with e as (select (now() at time zone 'America/New_York') as local_now)
  select
    'd:' || to_char(local_now::date, 'YYYY-MM-DD'),
    (local_now::date)::timestamp at time zone 'America/New_York',
    (local_now::date + 1)::timestamp at time zone 'America/New_York',
    'w:' || to_char(local_now::date, 'IYYY-"W"IW'),
    (date_trunc('week', local_now)::date)::timestamp at time zone 'America/New_York',
    (date_trunc('week', local_now)::date + 7)::timestamp at time zone 'America/New_York'
  from e;
$$;

create or replace function public.challenge_items(in_user uuid, in_scope text)
returns table (key text, title text, emoji text, goal integer, progress integer, points integer)
language plpgsql stable security definer
set search_path = public
as $$
declare
  p record;
  s timestamptz;
  e timestamptz;
  pk text;
begin
  select * into p from challenge_periods();
  if in_scope = 'daily' then
    s := p.day_start; e := p.day_end; pk := p.day_key;
  else
    s := p.week_start; e := p.week_end; pk := p.week_key;
  end if;
  return query
  with pool as (
    select * from (values
      ('daily_play', 'Play today''s daily course', '⛳', 1, 20, 'daily'),
      ('daily_under', 'Finish a daily under par', '🔥', 1, 40, 'daily'),
      ('throne_round', 'Play a throne round', '🚽', 1, 20, 'daily'),
      ('throne_two', 'Play two different thrones', '👑', 2, 35, 'daily'),
      ('checkin', 'Check in at a bathroom', '📍', 1, 10, 'daily'),
      ('match_play', 'Play a quick match', '⚔️', 1, 20, 'daily'),
      ('match_win', 'Win a quick match', '🏆', 1, 35, 'daily'),
      ('ace', 'Make an ace', '🎯', 1, 30, 'daily'),
      ('birdies', 'Card three birdies on the daily', '🐦', 3, 25, 'daily'),
      ('w_throne_rounds', 'Play five throne rounds', '🚽', 5, 60, 'weekly'),
      ('w_hold', 'Hold three thrones at once', '👑', 3, 90, 'weekly'),
      ('w_claim', 'Take a throne', '🏰', 1, 50, 'weekly'),
      ('w_match_wins', 'Win three quick matches', '🏆', 3, 80, 'weekly'),
      ('w_daily_days', 'Play the daily on four days', '📅', 4, 60, 'weekly'),
      ('w_aces', 'Make three aces', '🎯', 3, 90, 'weekly'),
      ('w_rounds', 'Play ten rounds of any kind', '🧻', 10, 60, 'weekly'),
      ('w_found', 'Found a new bathroom', '🧭', 1, 40, 'weekly')
    ) as v(key, title, emoji, goal, points, scope)
    where v.scope = in_scope
  ),
  picked as (select * from pool order by md5(pk || pool.key) limit 3),
  daily_runs as (select r.* from runs r where r.user_id = in_user and r.course_seed is not null and r.location_id is null and r.created_at >= s and r.created_at < e),
  loc_runs as (select r.* from runs r where r.user_id = in_user and r.location_id is not null and r.created_at >= s and r.created_at < e),
  done_matches as (select m.* from matches m where m.status = 'done' and (m.p1 = in_user or m.p2 = in_user) and m.finished_at >= s and m.finished_at < e)
  select k.key, k.title, k.emoji, k.goal,
    least(k.goal, (case k.key
      when 'daily_play' then (select count(distinct d.course_seed) from daily_runs d)
      when 'daily_under' then (select count(*) from (select d.course_seed from daily_runs d group by d.course_seed having count(*) >= 9 and sum(d.score) < sum(d.par)) x)
      when 'throne_round' then (select count(*) from loc_runs)
      when 'throne_two' then (select count(distinct l.location_id) from loc_runs l)
      when 'checkin' then (select count(*) from checkins c where c.user_id = in_user and c.at >= s and c.at < e)
      when 'match_play' then (select count(*) from done_matches)
      when 'match_win' then (select count(*) from done_matches dm where dm.winner = in_user)
      when 'ace' then (select count(*) from daily_runs d where d.score = 1) + (select coalesce(sum((select count(*) from unnest(l.hole_scores) h where h = 1)), 0) from loc_runs l)
      when 'birdies' then (select count(*) from daily_runs d where d.score < d.par)
      when 'w_throne_rounds' then (select count(*) from loc_runs)
      when 'w_hold' then (select count(*) from thrones t where t.user_id = in_user and t.season = current_season())
      when 'w_claim' then (select count(*) from thrones t where t.user_id = in_user and t.season = current_season() and t.created_at >= s and t.created_at < e)
      when 'w_match_wins' then (select count(*) from done_matches dm where dm.winner = in_user)
      when 'w_daily_days' then (select count(distinct (d.created_at at time zone 'America/New_York')::date) from daily_runs d)
      when 'w_aces' then (select count(*) from daily_runs d where d.score = 1) + (select coalesce(sum((select count(*) from unnest(l.hole_scores) h where h = 1)), 0) from loc_runs l)
      when 'w_rounds' then (select count(distinct d.course_seed) from daily_runs d) + (select count(*) from loc_runs) + (select count(*) from done_matches)
      when 'w_found' then (select count(*) from locations l where l.founded_by = in_user and l.id like 'ppp:%' and l.created_at >= s and l.created_at < e)
      else 0 end)::integer)::integer,
    k.points
  from picked k;
end;
$$;

-- Consecutive days (ending today, or yesterday if today is still open) with at least one daily challenge claimed.
create or replace function public.challenge_streak(in_user uuid)
returns integer
language sql stable security definer
set search_path = public
as $$
  with days as (
    select distinct substring(c.period from 3)::date as d from challenge_claims c where c.user_id = in_user and c.period like 'd:%'
  ),
  today as (select (now() at time zone 'America/New_York')::date as t),
  anchor as (
    select case
      when exists (select 1 from days, today where d = t) then (select t from today)
      when exists (select 1 from days, today where d = t - 1) then (select t from today) - 1
      else null end as a
  )
  select case when a is null then 0 else (
    select count(*)::integer from generate_series(0, 365) g
    where not exists (select 1 from generate_series(0, g) h where not exists (select 1 from days where d = a - h))
  ) end from anchor;
$$;

create or replace function public.challenge_board()
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  p record;
begin
  if me is null then return null; end if;
  select * into p from challenge_periods();
  return jsonb_build_object(
    'daily', jsonb_build_object('period', p.day_key, 'resets_at', p.day_end, 'items', (
      select coalesce(jsonb_agg(jsonb_build_object('key', i.key, 'title', i.title, 'emoji', i.emoji, 'goal', i.goal, 'progress', i.progress, 'points', i.points,
        'claimed', exists (select 1 from challenge_claims c where c.user_id = me and c.period = p.day_key and c.key = i.key)) order by i.points), '[]'::jsonb)
      from challenge_items(me, 'daily') i)),
    'weekly', jsonb_build_object('period', p.week_key, 'resets_at', p.week_end, 'items', (
      select coalesce(jsonb_agg(jsonb_build_object('key', i.key, 'title', i.title, 'emoji', i.emoji, 'goal', i.goal, 'progress', i.progress, 'points', i.points,
        'claimed', exists (select 1 from challenge_claims c where c.user_id = me and c.period = p.week_key and c.key = i.key)) order by i.points), '[]'::jsonb)
      from challenge_items(me, 'weekly') i)),
    'points', (select coalesce(sum(c.points), 0) from challenge_claims c where c.user_id = me),
    'streak', challenge_streak(me));
end;
$$;

create or replace function public.claim_challenge(in_period text, in_key text)
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  p record;
  it record;
  scope text;
begin
  if me is null then raise exception 'Sign in first'; end if;
  select * into p from challenge_periods();
  if in_period = p.day_key then scope := 'daily';
  elsif in_period = p.week_key then scope := 'weekly';
  else raise exception 'That challenge has expired'; end if;
  select * into it from challenge_items(me, scope) i where i.key = in_key;
  if not found then raise exception 'No such challenge'; end if;
  if it.progress < it.goal then raise exception 'Not done yet'; end if;
  insert into challenge_claims (user_id, period, key, points) values (me, in_period, in_key, it.points) on conflict do nothing;
  return it.points;
end;
$$;

revoke all on function public.challenge_periods() from public, anon;
revoke all on function public.challenge_items(uuid, text) from public, anon;
revoke all on function public.challenge_streak(uuid) from public, anon;
revoke all on function public.challenge_board() from public, anon;
revoke all on function public.claim_challenge(text, text) from public, anon;
grant execute on function public.challenge_periods() to authenticated;
grant execute on function public.challenge_items(uuid, text) to authenticated;
grant execute on function public.challenge_streak(uuid) to authenticated;
grant execute on function public.challenge_board() to authenticated;
grant execute on function public.claim_challenge(text, text) to authenticated;

-- Royal points and streak on the public profile.
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
    'points', (select coalesce(sum(c.points), 0) from public.challenge_claims c where c.user_id = p.id),
    'streak', public.challenge_streak(p.id),
    'throne_list', coalesce((
      select jsonb_agg(jsonb_build_object('location_id', t.location_id, 'name', l.name, 'poi_type', l.poi_type, 'score', t.score, 'par', t.par, 'elapsed_ms', t.elapsed_ms, 'since', t.created_at) order by t.created_at desc)
      from public.thrones t join public.locations l on l.id = t.location_id
      where t.user_id = p.id and t.season = public.current_season()), '[]'::jsonb))
  from public.profiles p where p.id = in_user;
$$;
grant execute on function public.player_profile(uuid) to anon, authenticated, service_role;
