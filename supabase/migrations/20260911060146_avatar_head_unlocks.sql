create table if not exists public.avatar_head_unlocks (
  user_id uuid not null references public.profiles(id) on delete cascade,
  head_id text not null check (head_id in ('bubble','robot','swamp','vampire','shark','ghost','raccoon','flame','lion','diamond','basketball','pickle','doughnut')),
  unlocked_at timestamptz not null default now(),
  primary key (user_id, head_id)
);
alter table public.avatar_head_unlocks enable row level security;
revoke all on table public.avatar_head_unlocks from public, anon, authenticated;
grant select, insert, update, delete on table public.avatar_head_unlocks to service_role;

create index if not exists matches_ranked_winner_idx on public.matches(winner)
  where status='done' and code is null;
create index if not exists matches_done_p1_idx on public.matches(p1) where status='done';
create index if not exists matches_done_p2_idx on public.matches(p2) where status='done';

create or replace function public.refresh_avatar_heads(in_user uuid)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare
  points_n integer:=0; ranked_n integer:=0; places_n integer:=0;
  daily_n integer:=0; aces_n integer:=0; thrones_n integer:=0;
  unlocked jsonb;
begin
  if in_user is null or not exists(select 1 from profiles where id=in_user) then
    raise exception 'no such player';
  end if;
  points_n:=throne_points(in_user);
  select count(*)::int into ranked_n from matches
    where status='done' and code is null and winner=in_user;
  select count(distinct location_id)::int into places_n from runs
    where user_id=in_user and location_id is not null and hole_scores is not null;
  select count(distinct left(course_seed,10))::int into daily_n from (
    select course_seed from runs
    where user_id=in_user and location_id is null and course_seed is not null
    group by course_seed having count(*)>=9
  ) completed_daily;
  select (
    (select count(*) filter(where score=1)
       +coalesce(sum((select count(*) from unnest(hole_scores) h where h=1)),0)
     from runs where user_id=in_user)
    +(select coalesce(sum((select count(*) from unnest(
       case when p1=in_user then p1_holes else p2_holes end
     ) h where h=1)),0) from matches
       where status='done' and ((p1=in_user and p1_score is not null) or (p2=in_user and p2_score is not null)))
  )::int into aces_n;
  select count(*)::int into thrones_n from thrones
    where season=current_season() and user_id=in_user;

  insert into avatar_head_unlocks(user_id,head_id)
  select in_user,head_id from (values
    ('bubble',points_n>=450),('robot',ranked_n>=10),('swamp',places_n>=5),
    ('vampire',daily_n>=10),('shark',aces_n>=25),('ghost',points_n>=1750),
    ('raccoon',places_n>=15),('flame',ranked_n>=50),('lion',thrones_n>=5),
    ('diamond',points_n>=3850),('basketball',ranked_n>=25),
    ('pickle',places_n>=10),('doughnut',daily_n>=20)
  ) earned(head_id,qualified) where qualified
  on conflict do nothing;

  select coalesce(jsonb_agg(head_id order by head_id),'[]'::jsonb) into unlocked
    from avatar_head_unlocks where user_id=in_user;
  return jsonb_build_object(
    'unlocked',unlocked,
    'stats',jsonb_build_object('points',points_n,'rankedWins',ranked_n,'places',places_n,
      'dailyDays',daily_n,'aces',aces_n,'thrones',thrones_n)
  );
end;
$$;
revoke all on function public.refresh_avatar_heads(uuid) from public, anon, authenticated;
grant execute on function public.refresh_avatar_heads(uuid) to service_role;

create or replace function public.capture_royal_lion()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if new.location_id is not null and new.hole_scores is not null
     and (select count(*) from thrones where season=current_season() and user_id=new.user_id)>=5 then
    insert into avatar_head_unlocks(user_id,head_id) values(new.user_id,'lion') on conflict do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.capture_royal_lion() from public, anon, authenticated;
drop trigger if exists capture_royal_lion_after_run on public.runs;
create trigger capture_royal_lion_after_run after insert or update of hole_scores on public.runs
  for each row execute function public.capture_royal_lion();

create or replace function public.move_account_with_heads(old_id uuid,new_id uuid)
returns text language plpgsql security invoker set search_path=public as $$
declare n text;
begin
  insert into avatar_head_unlocks(user_id,head_id,unlocked_at)
    select new_id,head_id,unlocked_at from avatar_head_unlocks where user_id=old_id
    on conflict do nothing;
  n:=move_account(old_id,new_id);
  return n;
end;
$$;
revoke all on function public.move_account_with_heads(uuid,uuid) from public,anon,authenticated;
grant execute on function public.move_account_with_heads(uuid,uuid) to service_role;

-- Backfill every currently provable accomplishment before release.
do $$
declare player record;
begin
  for player in select id from profiles where not coalesce(is_bot,false) loop
    perform refresh_avatar_heads(player.id);
  end loop;
end;
$$;
notify pgrst,'reload schema';

