-- Where you stand on today's course: your rank among everyone who finished
-- it, however many that is (the top-20 board can't answer for #37).
create or replace function public.daily_standing(in_seed text)
returns table(rank bigint, of_players bigint, total integer, par integer, elapsed_ms bigint)
language sql stable
set search_path = public
as $$
  with rounds as (
    select r.user_id, sum(r.score)::int as total, sum(r.par)::int as par, sum(coalesce(r.elapsed_ms, 0))::bigint as elapsed_ms, max(r.created_at) as finished_at
    from public.runs r
    where r.course_seed = in_seed
    group by r.user_id
    having count(*) >= 9
  ),
  ranked as (
    select user_id, total, par, elapsed_ms, row_number() over (order by total asc, elapsed_ms asc, finished_at asc) as rank, count(*) over () as of_players
    from rounds
  )
  select rank, of_players, total, par, elapsed_ms from ranked where user_id = auth.uid();
$$;
revoke all on function public.daily_standing(text) from public, anon;
grant execute on function public.daily_standing(text) to authenticated, service_role;
