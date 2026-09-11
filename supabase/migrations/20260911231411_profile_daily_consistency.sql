-- Public aggregate uses exactly the ranked leaderboard's eligibility rules.
-- Match rows keep their existing participant-only RLS.
create or replace function public.ranked_profile_record(in_user uuid)
returns table(wins bigint, matches bigint)
language sql stable security definer set search_path = ''
as $$
  select count(*) filter (where m.winner = in_user), count(*)
  from public.matches m
  where m.status = 'done' and m.code is null
    and (m.p1 = in_user or m.p2 = in_user);
$$;
revoke all on function public.ranked_profile_record(uuid) from public;
grant execute on function public.ranked_profile_record(uuid) to anon, authenticated, service_role;

-- Serialize daily submissions per player/day, including older AM/PM clients.
-- Keep historical rows and permit retries of an already-started day's holes.
create or replace function public.guard_daily_attempt()
returns trigger language plpgsql set search_path = '' as $$
declare first_seed text;
begin
  if new.location_id is not null or new.course_seed is null or new.course_seed !~ '^\d{4}-\d{2}-\d{2}-(am|pm)$' then return new; end if;
  if new.hole_index < 0 or new.hole_index > 8 then
    raise exception 'A daily round has nine holes';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text || left(new.course_seed,10), 0));
  select r.course_seed into first_seed from public.runs r
    where r.user_id = new.user_id and left(r.course_seed,10) = left(new.course_seed,10)
      and r.course_seed ~ '^\d{4}-\d{2}-\d{2}-(am|pm)$'
    order by r.created_at limit 1;
  if first_seed is not null and first_seed <> new.course_seed then
    raise exception 'One daily round per day. Your round is already started.';
  end if;
  if first_seed is null and left(new.course_seed,10) <> to_char(now() at time zone 'America/New_York','YYYY-MM-DD') then
    raise exception 'This daily course is no longer open';
  end if;
  if exists(select 1 from public.runs r where r.user_id=new.user_id and r.course_seed=new.course_seed and r.hole_index=new.hole_index) then
    raise exception 'already played this hole today';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_daily_attempt() from public;
drop trigger if exists guard_daily_attempt on public.runs;
create trigger guard_daily_attempt before insert on public.runs for each row execute function public.guard_daily_attempt();
