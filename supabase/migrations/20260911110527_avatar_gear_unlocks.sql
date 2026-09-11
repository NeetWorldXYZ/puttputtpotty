-- Cosmetics only. Reuse verified achievement totals without changing their calculation.
create table public.avatar_gear_catalog (
  slot text not null check(slot in ('seat','ball')),
  item_id text not null,
  metric text not null check(metric in ('points','rankedWins','places','dailyDays','aces')),
  target integer not null check(target>0),
  primary key(slot,item_id)
);
alter table public.avatar_gear_catalog enable row level security;
revoke all on public.avatar_gear_catalog from public,anon,authenticated;
grant select on public.avatar_gear_catalog to service_role;
insert into public.avatar_gear_catalog(slot,item_id,metric,target) values
  ('ball','pearl','points',250),('ball','meteor','rankedWins',5),('ball','ooze','places',3),
  ('ball','glacier','dailyDays',5),('ball','hoops','rankedWins',15),('ball','sushi','aces',15),
  ('ball','orbit','points',1000),('ball','glaze','dailyDays',15),('ball','pirate','places',12),
  ('ball','dragonball','rankedWins',35),('ball','disco','aces',40),('ball','nebula','points',2800),
  ('ball','prism','points',5000),
  ('seat','varsity','points',350),('seat','ranger','places',4),('seat','wave','dailyDays',7),
  ('seat','tour','rankedWins',8),('seat','cosmic','points',1250),('seat','bones','aces',20),
  ('seat','wild','places',8),('seat','inferno','rankedWins',30),('seat','sprinkles','dailyDays',18),
  ('seat','circuit','points',2300),('seat','dragonscale','rankedWins',60),
  ('seat','monarch','points',4400),('seat','champion','aces',60);

create table public.avatar_gear_unlocks (
  user_id uuid not null references public.profiles(id) on delete cascade,
  slot text not null,
  item_id text not null,
  unlocked_at timestamptz not null default now(),
  primary key(user_id,slot,item_id),
  foreign key(slot,item_id) references public.avatar_gear_catalog(slot,item_id)
);
create index avatar_gear_unlocks_catalog_idx on public.avatar_gear_unlocks(slot,item_id);
alter table public.avatar_gear_unlocks enable row level security;
revoke all on public.avatar_gear_unlocks from public,anon,authenticated;
grant select,insert,update,delete on public.avatar_gear_unlocks to service_role;

create or replace function public.refresh_avatar_collection(in_user uuid)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare heads jsonb; shirts jsonb; balls jsonb;
begin
  heads:=refresh_avatar_heads(in_user);
  insert into avatar_gear_unlocks(user_id,slot,item_id)
    select in_user,slot,item_id from avatar_gear_catalog
    where coalesce((heads->'stats'->>metric)::integer,0)>=target
    on conflict do nothing;
  select coalesce(jsonb_agg(item_id order by item_id) filter(where slot='seat'),'[]'::jsonb),
         coalesce(jsonb_agg(item_id order by item_id) filter(where slot='ball'),'[]'::jsonb)
    into shirts,balls from avatar_gear_unlocks where user_id=in_user;
  return heads||jsonb_build_object('shirts',shirts,'balls',balls);
end;
$$;
revoke all on function public.refresh_avatar_collection(uuid) from public,anon,authenticated;
grant execute on function public.refresh_avatar_collection(uuid) to service_role;

-- Keep the existing account-link RPC compatible with cached clients and deployments.
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
  n:=move_account(old_id,new_id);
  if old_avatar is not null then update profiles set avatar=old_avatar where id=new_id; end if;
  return n;
end;
$$;
revoke all on function public.move_account_with_heads(uuid,uuid) from public,anon,authenticated;
grant execute on function public.move_account_with_heads(uuid,uuid) to service_role;

-- Direct REST profile edits cannot bypass the verified Edge Function equip check.
-- Existing equipped items and ordinary profile/name edits remain compatible.
create function public.guard_earned_gear()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if current_user in ('anon','authenticated') then
    if (tg_op='INSERT' or new.avatar->>'seat' is distinct from old.avatar->>'seat')
       and new.avatar->>'seat' in ('varsity','ranger','wave','tour','cosmic','bones','wild','inferno','sprinkles','circuit','dragonscale','monarch','champion') then
      raise exception 'Use the profile editor to verify earned shirts' using errcode='42501';
    end if;
    if (tg_op='INSERT' or new.avatar->>'ball' is distinct from old.avatar->>'ball')
       and new.avatar->>'ball' in ('pearl','meteor','ooze','glacier','hoops','sushi','orbit','glaze','pirate','dragonball','disco','nebula','prism') then
      raise exception 'Use the profile editor to verify earned balls' using errcode='42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_earned_gear() from public,anon,authenticated;
create trigger guard_earned_gear_before_profile before insert or update of avatar on public.profiles
  for each row execute function public.guard_earned_gear();

-- Credit accomplishments already achieved before this release.
do $$ declare player record;
begin
  for player in select id from profiles where not coalesce(is_bot,false) loop
    perform refresh_avatar_collection(player.id);
  end loop;
end; $$;
notify pgrst,'reload schema';
