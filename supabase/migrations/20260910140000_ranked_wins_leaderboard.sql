-- Public aggregate only: never expose private match rows or bypass their RLS
-- from the client. Match eligibility matches src/net/rankedRecord.ts.
create or replace function public.ranked_wins_leaderboard(
  in_users uuid[] default null,
  lim integer default 50
)
returns table(user_id uuid, display_name text, avatar jsonb, wins bigint)
language sql stable security definer
set search_path = public
as $$
  select p.id, p.display_name, p.avatar, count(*) as wins
  from public.matches m
  join public.profiles p on p.id = m.winner
  where m.status = 'done'
    and m.code is null
    and (in_users is null or p.id = any(in_users))
  group by p.id, p.display_name, p.avatar
  having count(*) > 0
  order by wins desc, p.display_name asc, p.id asc
  limit greatest(1, least(coalesce(lim, 50), 100));
$$;

revoke all on function public.ranked_wins_leaderboard(uuid[], integer) from public;
grant execute on function public.ranked_wins_leaderboard(uuid[], integer) to anon, authenticated, service_role;
