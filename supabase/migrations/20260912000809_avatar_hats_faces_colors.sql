-- Expand the existing permanent cosmetic collection, retaining service-only writes.
alter table public.avatar_gear_catalog drop constraint avatar_gear_catalog_slot_check;
alter table public.avatar_gear_catalog add constraint avatar_gear_catalog_slot_check check(slot in ('seat','ball','hat','face','porcelain'));
insert into public.avatar_gear_catalog(slot,item_id,metric,target) values
('hat','visor','points',200),
('hat','bucket','dailyDays',3),
('hat','cowboy','places',3),
('hat','beanie','points',650),
('hat','chef','aces',8),
('hat','piratehat','rankedWins',10),
('hat','viking','places',8),
('hat','wizard','points',1800),
('hat','safari','dailyDays',12),
('hat','hardhat','rankedWins',25),
('hat','propeller','aces',30),
('hat','party','points',3500),
('hat','toilethat','rankedWins',50),
('face','grin','points',200),
('face','smirk','dailyDays',3),
('face','shocked','places',3),
('face','laugh','points',650),
('face','tears','aces',8),
('face','heart','rankedWins',10),
('face','star','places',8),
('face','dizzy','points',1800),
('face','tongue','dailyDays',12),
('face','focused','rankedWins',25),
('face','monocle','aces',30),
('face','eyepatch','points',3500),
('face','zipit','rankedWins',50),
('porcelain','arctic','points',200),
('porcelain','lava','dailyDays',3),
('porcelain','deepsea','places',3),
('porcelain','radioactive','points',650),
('porcelain','cottoncandy','aces',8),
('porcelain','royalviolet','rankedWins',10),
('porcelain','rosegold','places',8),
('porcelain','copper','points',1800),
('porcelain','silver','dailyDays',12),
('porcelain','nightshade','rankedWins',25),
('porcelain','sunset','aces',30),
('porcelain','aurora','points',3500),
('porcelain','obsidian','rankedWins',50);
create or replace function public.refresh_avatar_collection(in_user uuid)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare heads jsonb; awards jsonb;
begin
  heads:=refresh_avatar_heads(in_user);
  insert into avatar_gear_unlocks(user_id,slot,item_id)
    select in_user,slot,item_id from avatar_gear_catalog
    where coalesce((heads->'stats'->>metric)::integer,0)>=target
    on conflict do nothing;
  select jsonb_build_object(
    'shirts',coalesce(jsonb_agg(item_id order by item_id) filter(where slot='seat'),'[]'::jsonb),
    'balls',coalesce(jsonb_agg(item_id order by item_id) filter(where slot='ball'),'[]'::jsonb),
    'hats',coalesce(jsonb_agg(item_id order by item_id) filter(where slot='hat'),'[]'::jsonb),
    'faces',coalesce(jsonb_agg(item_id order by item_id) filter(where slot='face'),'[]'::jsonb),
    'colors',coalesce(jsonb_agg(item_id order by item_id) filter(where slot='porcelain'),'[]'::jsonb)
  ) into awards from avatar_gear_unlocks where user_id=in_user;
  return heads||awards;
end;
$$;
revoke all on function public.refresh_avatar_collection(uuid) from public,anon,authenticated;
grant execute on function public.refresh_avatar_collection(uuid) to service_role;

create or replace function public.guard_earned_gear()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if current_user in ('anon','authenticated') then
    if (tg_op='INSERT' or new.avatar->>'seat' is distinct from old.avatar->>'seat') and new.avatar->>'seat' in ('varsity','ranger','wave','tour','cosmic','bones','wild','inferno','sprinkles','circuit','dragonscale','monarch','champion') then
      raise exception 'Use the profile editor to verify earned cosmetics' using errcode='42501';
    end if;
    if (tg_op='INSERT' or new.avatar->>'ball' is distinct from old.avatar->>'ball') and new.avatar->>'ball' in ('pearl','meteor','ooze','glacier','hoops','sushi','orbit','glaze','pirate','dragonball','disco','nebula','prism') then
      raise exception 'Use the profile editor to verify earned cosmetics' using errcode='42501';
    end if;
    if (tg_op='INSERT' or new.avatar->>'hat' is distinct from old.avatar->>'hat') and new.avatar->>'hat' in ('visor','bucket','cowboy','beanie','chef','piratehat','viking','wizard','safari','hardhat','propeller','party','toilethat') then
      raise exception 'Use the profile editor to verify earned cosmetics' using errcode='42501';
    end if;
    if (tg_op='INSERT' or new.avatar->>'face' is distinct from old.avatar->>'face') and new.avatar->>'face' in ('grin','smirk','shocked','laugh','tears','heart','star','dizzy','tongue','focused','monocle','eyepatch','zipit') then
      raise exception 'Use the profile editor to verify earned cosmetics' using errcode='42501';
    end if;
    if (tg_op='INSERT' or new.avatar->>'porcelain' is distinct from old.avatar->>'porcelain') and new.avatar->>'porcelain' in ('arctic','lava','deepsea','radioactive','cottoncandy','royalviolet','rosegold','copper','silver','nightshade','sunset','aurora','obsidian') then
      raise exception 'Use the profile editor to verify earned cosmetics' using errcode='42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_earned_gear() from public,anon,authenticated;
-- Credit prior accomplishments. Already-earned cosmetics remain permanent.
do $$ declare player record;
begin
  for player in select id from public.profiles where not coalesce(is_bot,false) loop
    perform public.refresh_avatar_collection(player.id);
  end loop;
end; $$;
notify pgrst,'reload schema';
