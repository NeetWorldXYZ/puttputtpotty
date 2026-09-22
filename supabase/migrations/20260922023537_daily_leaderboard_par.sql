-- Add round par without changing the response contract for older app versions.
create function public.course_leaderboard_with_par(in_seed text, lim integer default 20)
returns table(user_id uuid, display_name text, avatar jsonb, total integer, par integer,
  holes bigint, elapsed_ms bigint, finished_at timestamptz)
language sql stable security invoker set search_path = '' as $$
  select r.user_id, p.display_name, p.avatar, sum(r.score)::int as total,
    sum(r.par)::int as par, count(*) as holes,
    sum(coalesce(r.elapsed_ms, 0))::bigint as elapsed_ms, max(r.created_at) as finished_at
  from public.runs r join public.profiles p on p.id = r.user_id
  where r.course_seed = in_seed
  group by r.user_id, p.display_name, p.avatar
  having count(*) >= 9
  order by total asc, elapsed_ms asc, finished_at asc
  limit greatest(1, least(lim, 100));
$$;
revoke all on function public.course_leaderboard_with_par(text,integer) from public;
grant execute on function public.course_leaderboard_with_par(text,integer) to anon,authenticated,service_role;
notify pgrst,'reload schema';
