-- A daily streak measures visits, not whether a challenge reward was claimed.
create table public.player_activity_days (
  user_id uuid not null references public.profiles(id) on delete cascade,
  activity_date date not null,
  primary key(user_id,activity_date)
);
alter table public.player_activity_days enable row level security;
revoke all on public.player_activity_days from public,anon,authenticated;
grant select,insert,delete on public.player_activity_days to service_role;

-- Recover only days supported by stored activity, using the game's Eastern clock.
insert into public.player_activity_days(user_id,activity_date)
select r.user_id,(r.created_at at time zone 'America/New_York')::date
from public.runs r join public.profiles p on p.id=r.user_id
union
select c.user_id,(c.claimed_at at time zone 'America/New_York')::date
from public.challenge_claims c join public.profiles p on p.id=c.user_id
union
select p.id,(p.last_seen_at at time zone 'America/New_York')::date
from public.profiles p where p.last_seen_at is not null
on conflict do nothing;

-- Extend the existing authenticated heartbeat; the caller cannot supply a player or date.
create or replace function public.heartbeat()
returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid();
begin
  if me is null then return; end if;
  update public.profiles set last_seen_at=now() where id=me;
  insert into public.player_activity_days(user_id,activity_date)
    select id,(now() at time zone 'America/New_York')::date from public.profiles where id=me
    on conflict do nothing;
end;
$$;
revoke all on function public.heartbeat() from public,anon;
grant execute on function public.heartbeat() to authenticated;

create or replace function public.challenge_streak(in_user uuid)
returns integer language sql stable security definer set search_path='' as $$
  with days as (
    select activity_date as d from public.player_activity_days
    where user_id=in_user and activity_date<=(now() at time zone 'America/New_York')::date
  ), ordered as (
    select d,max(d) over() anchor,(row_number() over(order by d desc)-1)::int n from days
  )
  select count(*)::int from ordered
  where anchor>=(now() at time zone 'America/New_York')::date-1 and d=anchor-n;
$$;
revoke all on function public.challenge_streak(uuid) from public,anon;
grant execute on function public.challenge_streak(uuid) to authenticated;

-- Account linking carries over verified activity days.
create or replace function public.move_account_with_heads(old_id uuid,new_id uuid)
returns text language plpgsql security invoker set search_path=public as $$
declare n text; old_avatar jsonb;
begin
  if old_id=new_id then raise exception 'same account'; end if;
  perform refresh_avatar_collection(old_id);
  perform refresh_avatar_collection(new_id);
  select avatar into old_avatar from profiles where id=old_id;
  insert into avatar_head_unlocks(user_id,head_id,unlocked_at)
    select new_id,head_id,unlocked_at from avatar_head_unlocks where user_id=old_id on conflict do nothing;
  insert into avatar_gear_unlocks(user_id,slot,item_id,unlocked_at)
    select new_id,slot,item_id,unlocked_at from avatar_gear_unlocks where user_id=old_id on conflict do nothing;
  insert into public.player_activity_days(user_id,activity_date)
    select new_id,activity_date from public.player_activity_days where user_id=old_id on conflict do nothing;
  n:=move_account(old_id,new_id);
  if old_avatar is not null then update profiles set avatar=old_avatar where id=new_id; end if;
  return n;
end;
$$;
revoke all on function public.move_account_with_heads(uuid,uuid) from public,anon,authenticated;
grant execute on function public.move_account_with_heads(uuid,uuid) to service_role;


notify pgrst,'reload schema';
