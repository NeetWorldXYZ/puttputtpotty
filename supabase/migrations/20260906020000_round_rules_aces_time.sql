-- Daily board breaks ties on simulated time; kings board counts aces;
-- account moves between phones with a six-digit code.

drop function if exists public.course_leaderboard(text, integer);
create function public.course_leaderboard(in_seed text, lim integer default 20)
returns table(user_id uuid, display_name text, total integer, holes bigint, elapsed_ms bigint, finished_at timestamptz)
language sql stable
set search_path = public
as $$
  select r.user_id, p.display_name, sum(r.score)::int as total, count(*) as holes,
    sum(coalesce(r.elapsed_ms, 0))::bigint as elapsed_ms, max(r.created_at) as finished_at
  from public.runs r join public.profiles p on p.id = r.user_id
  where r.course_seed = in_seed
  group by r.user_id, p.display_name
  having count(*) >= 9
  order by total asc, elapsed_ms asc, finished_at asc
  limit lim;
$$;
grant execute on function public.course_leaderboard(text, integer) to anon, authenticated, service_role;

drop function if exists public.kings_leaderboard(double precision, double precision, double precision, integer);
create function public.kings_leaderboard(in_lat double precision default null, in_lng double precision default null, radius_m double precision default null, lim integer default 50)
returns table(user_id uuid, display_name text, thrones bigint, best_rel integer, aces bigint, last_win timestamptz)
language sql stable
set search_path = public
as $$
  with k as (
    select t.user_id, t.display_name, count(*) as thrones, min(t.score - t.par)::int as best_rel, max(t.created_at) as last_win
    from public.thrones t
    join public.locations l on l.id = t.location_id
    where t.season = public.current_season()
      and (in_lat is null or in_lng is null or radius_m is null
           or st_dwithin(l.geog, st_setsrid(st_makepoint(in_lng, in_lat), 4326)::geography, radius_m))
    group by t.user_id, t.display_name
  ), a as (
    -- holes-in-one this season: daily/custom holes scored 1, plus 1s inside throne rounds
    select r.user_id,
      count(*) filter (where r.location_id is null and r.score = 1)
      + coalesce(sum((select count(*) from unnest(r.hole_scores) h where h = 1)), 0) as aces
    from public.runs r
    where r.season = public.current_season() and r.user_id in (select user_id from k)
    group by r.user_id
  )
  select k.user_id, k.display_name, k.thrones, k.best_rel, coalesce(a.aces, 0)::bigint as aces, k.last_win
  from k left join a on a.user_id = k.user_id
  order by k.thrones desc, k.best_rel asc, aces desc, k.last_win asc
  limit lim;
$$;
grant execute on function public.kings_leaderboard(double precision, double precision, double precision, integer) to anon, authenticated, service_role;

-- Move-to-another-phone codes. Only the API touches this table.
create table if not exists public.link_codes (
  code text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null
);
alter table public.link_codes enable row level security;

-- The caller (new_id, a fresh guest) takes over everything old_id owned:
-- name, runs, thrones, matches, founded bathrooms. The guest's own plays go.
create or replace function public.move_account(old_id uuid, new_id uuid)
returns text
language plpgsql security definer
set search_path = public
as $$
declare n text;
begin
  if old_id = new_id then raise exception 'same account'; end if;
  select display_name into n from profiles where id = old_id;
  if n is null then raise exception 'no such account'; end if;
  delete from runs where user_id = new_id;
  delete from checkins where user_id = new_id;
  update runs set user_id = new_id where user_id = old_id;
  update checkins set user_id = new_id where user_id = old_id;
  update matches set p1 = new_id where p1 = old_id;
  update matches set p2 = new_id where p2 = old_id;
  update locations set founded_by = new_id where founded_by = old_id;
  delete from link_codes where user_id in (old_id, new_id);
  delete from profiles where id = old_id;
  insert into profiles (id, display_name) values (new_id, n)
    on conflict (id) do update set display_name = excluded.display_name;
  return n;
end;
$$;
revoke all on function public.move_account(uuid, uuid) from public, anon, authenticated;
grant execute on function public.move_account(uuid, uuid) to service_role;
